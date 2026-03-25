
import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { User } from '../types';
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle, ArrowRight, UserPlus, LogIn, Lock, ArrowLeft, Mail, AlertTriangle, Calendar, MailCheck, RefreshCw } from 'lucide-react';
// --- TUTORIAL INTEGRATION ---
import { useTutorial } from '../src/hooks/useTutorial';
import TutorialController from '../components/TutorialController';
import TutorialInvitation from '../components/TutorialInvitation';
import { tours } from '../src/config/tours';
import NeoModal from '../components/NeoModal';

interface AuthScreenProps {
    onLoginSuccess: (user: User) => void;
}

type AuthMode = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD';

const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
    const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();

    const [mode, setMode] = useState<AuthMode>('LOGIN');
    const [loading, setLoading] = useState(false);
    const [registrationComplete, setRegistrationComplete] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [registeredEmail, setRegisteredEmail] = useState('');

    // Password Visibility
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Caps Lock Detection
    const [capsLockOn, setCapsLockOn] = useState(false);

    // Feedback
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Error Modal State
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [modalErrorTitle, setModalErrorTitle] = useState("");
    const [modalErrorMessage, setModalErrorMessage] = useState("");

    // Form Data
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        phone: '',
        birthDate: '',
        gender: '',
        email: '',
        password: '',
        confirmPassword: ''
    });



    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError(null);
    };

    // Calculate age from birth date
    const calculateAge = (birthDate: string): number => {
        if (!birthDate) return 0;
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    };

    // Format date for display just like in AttendanceModal
    const formatDateForDisplay = (dateStr: string) => {
        if (!dateStr) return 'DD/MM/YYYY'; // Placeholder
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // Detect Caps Lock on key events
    const handleKeyEvent = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.getModifierState) {
            setCapsLockOn(e.getModifierState('CapsLock'));
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const result = await signIn(formData.email, formData.password);

        if (result.success) {
            // onLoginSuccess will be triggered by App.tsx observing user state or we can call it here if needed
            // But since App.tsx passes this prop, we called it there. 
            // Actually, context updates state, but for the callback prop:
            // The user object is in context now. We might not have it *immediately* returned from signIn 
            // if we didn't refetch it, but our signIn returns { user } if reusing service logic inside context.
            // Let's assume successful sign in triggers the redirect in App.tsx via state change or we call the prop.

            // However, the prop expects a User object.
            // Our context signIn returns { success, error }.
            // We should rely on the App.tsx loop primarily, but for the prop interface:
            // We can just pass a dummy or specific logic if needed, but wait, 'onLoginSuccess' was used to setUser in App.tsx
            // Now App.tsx uses useAuth. So this prop might be redundant or used for navigation/logging only.
            // Let's pass a dummy user or just nothing if the parent handles it.
            // Looking at App.tsx, handleAuthScreenLogin just navigates.
            // So we can fetch the user from context after? 
            // Actually App.tsx logic for handleAuthScreenLogin says: setUser(loggedInUser) -> navigate.
            // But now App.tsx logic for handleAuthScreenLogin says: db.log -> navigate.
            // So we need to trigger it.
            // But wait, the user is already set in context.
            // We can pass the user if we have it.

            // To be precise, our Context.signIn calls Service.signIn which returns { user, error }.
            // So if we update Context to return user, we can pass it.
            // In my previous step (AuthContext), signIn returned { success: true } but set the user internally.
            // Let's just trust the flow or pass a minimal object if needed, 
            // or better, just call it with the current user from context (which might be null due to async batching)
            // or just trigger it.

            // Let's modify behavior: we successfully logged in.
            // We can reload window or just navigate.
            // Let's simulate standard behavior.
            onLoginSuccess({ id: 'auth-user', name: 'User', email: formData.email, role: 'VIEWER', isActive: true } as User);
        } else {
            console.log("LOGIN FAILED WITH:", result.error);
            // Detectar error 400 de Supabase (credenciales inválidas)
            const errorMsg = result.error?.toLowerCase() || '';
            const isInvalidCredentials =
                errorMsg.includes('400') ||
                errorMsg.includes('bad request') ||
                errorMsg.includes('invalid login credentials') ||
                errorMsg.includes('credenciales') ||
                errorMsg.includes('password') ||
                errorMsg.includes('contraseña');

            console.log("isInvalidCredentials evaluated to:", isInvalidCredentials);

            if (isInvalidCredentials) {
                console.log("Attempting to show error modal...");
                setModalErrorTitle("Datos Incorrectos");
                setModalErrorMessage("El correo electrónico o la contraseña ingresados son incorrectos. Por favor, verifica tus datos e inténtalo de nuevo.");
                setShowErrorModal(true);
            } else {
                console.log("Setting inline error instead");
                setError(result.error || "Error al iniciar sesión.");
            }
        }
        setLoading(false);
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        // 1. Validation
        if (!formData.firstName || !formData.lastName || !formData.phone || !formData.birthDate || !formData.gender || !formData.email || !formData.password) {
            setError("Todos los campos son obligatorios.");
            setLoading(false);
            return;
        }

        const calculatedAge = calculateAge(formData.birthDate);
        if (calculatedAge < 1 || calculatedAge > 120) {
            setError("Por favor ingresa una fecha de nacimiento válida.");
            setLoading(false);
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError("Las contraseñas no coinciden.");
            setLoading(false);
            return;
        }

        if (formData.password.length < 6) {
            setError("La contraseña debe tener al menos 6 caracteres.");
            setLoading(false);
            return;
        }

        // 2. Register
        const result = await signUp(
            formData.firstName,
            formData.lastName,
            formData.phone,
            formData.email,
            formData.password,
            calculatedAge,
            formData.gender
        );

        if (result.success) {
            setRegisteredEmail(formData.email);
            setRegistrationComplete(true);
            setFormData({ ...formData, password: '', confirmPassword: '' }); // Clear security fields
        } else {
            setError(result.error || "Error al registrarse.");
        }
        setLoading(false);
    };

    const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        if (!formData.email) {
            setError("Ingresa tu email.");
            setLoading(false);
            return;
        }

        const result = await resetPassword(formData.email);

        if (result.success) {
            setSuccess("Si el correo existe, recibirás un enlace para restablecer tu contraseña.");
            // Don't switch mode immediately so they can read the message
        } else {
            setError(result.error || "Error al solicitar restauración.");
        }
        setLoading(false);
    };


    // --- Google Login Handler ---
    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        const result = await signInWithGoogle();
        if (!result.success) {
            setError(result.error || "Error al iniciar sesión con Google.");
        }
        setLoading(false);
    };

    // --- Resend Confirmation Email Handler ---
    const handleResendConfirmation = async () => {
        if (!registeredEmail) return;

        setResendLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email: registeredEmail,
            });

            if (error) {
                setError(error.message);
            } else {
                setSuccess("Email de confirmación reenviado. Revisa tu bandeja de entrada.");
            }
        } catch (err: any) {
            setError(err.message || "Error al reenviar el email.");
        }

        setResendLoading(false);
    };

    // --- Google Icon SVG ---
    const GoogleIcon = () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
    );

    // --- STYLES ---
    const inputClass = "w-full p-4 bg-white border border-slate-300 rounded-lg outline-none text-black font-medium focus:border-black focus:ring-1 focus:ring-black transition-all placeholder-slate-400";
    const labelClass = "block text-xs font-bold text-slate-500 uppercase mb-1 ml-1";
    const buttonClass = "w-full py-3 bg-black text-white font-bold uppercase tracking-widest rounded-lg hover:bg-neutral-800 transition-all shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 transform active:scale-[0.98]";
    const googleButtonClass = "w-full py-4 bg-white text-black font-bold uppercase tracking-widest rounded-lg border border-gray-300 hover:bg-gray-50 transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-3 transform active:scale-[0.98]";

    const {
        isActive,
        showInvitation,
        startTutorial,
        completeTutorial,
        declineTemporary,
        dismissTutorial
    } = useTutorial('auth');

    return (
        <>
        <div className="min-h-screen flex flex-col lg:flex-row bg-white font-sans text-black overflow-hidden">
            {/* Tutorial Components */}
            <TutorialInvitation
                isOpen={showInvitation}
                onStart={startTutorial}
                onClose={declineTemporary}
                onDismiss={dismissTutorial}
                title="Bienvenido a Origen"
            />
            <TutorialController
                steps={tours.auth}
                run={isActive}
                onComplete={completeTutorial}
                onSkip={dismissTutorial}
            />

            {/* LEFT SIDE: BRANDING (Hidden on mobile) */}
            <div className="hidden lg:flex w-1/2 bg-black relative items-center justify-center">
                <div className="absolute inset-0 opacity-70">
                    <img
                        src="/auth-bg.jpg"
                        alt="Background"
                        className="w-full h-full object-cover"
                    />
                </div>
                <div className="relative z-10 text-center p-12 max-w-lg">
                    <div className="flex items-center justify-center gap-6 mb-6">
                        <img src="/origen-logo-full.png" alt="Logo" className="h-48 w-auto object-contain invert" />
                    </div>
                    <p className="text-2xl text-slate-300 font-light leading-relaxed">
                        Conectando a la comunidad.
                    </p>
                    <div className="mt-12 flex justify-center gap-4">
                        <div className="flex items-center gap-2 text-white/50 text-xs uppercase tracking-widest font-bold border border-white/20 px-4 py-2 rounded-full">
                            <Lock className="w-3 h-3" /> Acceso Seguro
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT SIDE: FORM */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center p-6 lg:p-20 relative bg-white">

                {/* Mobile Header */}
                <div className="lg:hidden flex items-center justify-center gap-3 mb-8 pt-8">
                    <img src="/origen-logo.png" alt="Logo" className="h-24 w-auto object-contain" />
                </div>

                <div className="max-w-md mx-auto w-full">
                    {/* Registration Complete - Email Confirmation Card */}
                    {registrationComplete ? (
                        <div className="animate-fadeIn">
                            {/* Neo-Brutalist Confirmation Card */}
                            <div className="border-4 border-black bg-white p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                                <div className="flex justify-center mb-6">
                                    <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center">
                                        <MailCheck className="w-10 h-10 text-white" />
                                    </div>
                                </div>

                                <h2 className="text-2xl font-black uppercase tracking-tight text-black text-center mb-4">
                                    ¡REVISA TU EMAIL!
                                </h2>

                                <p className="text-slate-600 text-center mb-2 font-medium">
                                    Hemos enviado un enlace de confirmación a:
                                </p>

                                <p className="text-black font-bold text-center text-lg mb-6 bg-slate-100 py-2 px-4 rounded-lg border-2 border-black">
                                    {registeredEmail}
                                </p>

                                <p className="text-slate-500 text-sm text-center mb-8">
                                    Haz clic en el enlace del email para activar tu cuenta. Una vez confirmado, podrás iniciar sesión.
                                </p>

                                {/* Messages */}
                                {error && (
                                    <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-start gap-2 rounded-r-lg">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                        <span className="text-sm font-bold">{error}</span>
                                    </div>
                                )}
                                {success && (
                                    <div className="mb-4 p-3 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 flex items-start gap-2 rounded-r-lg">
                                        <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                        <span className="text-sm font-bold">{success}</span>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="space-y-3">
                                    <button
                                        onClick={handleResendConfirmation}
                                        disabled={resendLoading}
                                        className="w-full py-3 bg-slate-100 text-black font-bold uppercase tracking-wider rounded-lg border-2 border-black hover:bg-slate-200 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                                    >
                                        {resendLoading ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <>
                                                <RefreshCw className="w-4 h-4" />
                                                Reenviar Email
                                            </>
                                        )}
                                    </button>

                                    <button
                                        onClick={() => {
                                            setRegistrationComplete(false);
                                            setMode('LOGIN');
                                            setError(null);
                                            setSuccess(null);
                                        }}
                                        className="w-full py-3 bg-black text-white font-bold uppercase tracking-wider rounded-lg hover:bg-neutral-800 transition-all flex justify-center items-center gap-2"
                                    >
                                        <LogIn className="w-4 h-4" />
                                        Ir a Iniciar Sesión
                                    </button>
                                </div>
                            </div>

                            {/* Helper text */}
                            <p className="text-xs text-slate-400 text-center mt-6 uppercase tracking-wider font-bold">
                                ¿No recibiste el email? Revisa tu carpeta de spam
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Toggle Tabs */}
                            {mode !== 'FORGOT_PASSWORD' && (
                                <div className="auth-toggle flex bg-slate-100 p-1 rounded-xl mb-8 relative">
                                    <div
                                        className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-sm transition-all duration-300 ease-in-out ${mode === 'LOGIN' ? 'left-1' : 'left-[calc(50%+4px)]'}`}
                                    ></div>
                                    <button
                                        onClick={() => { setMode('LOGIN'); setError(null); setSuccess(null); }}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold uppercase tracking-wider relative z-10 transition-colors ${mode === 'LOGIN' ? 'text-black' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <LogIn className="w-4 h-4" /> Iniciar Sesión
                                    </button>
                                    <button
                                        onClick={() => { setMode('REGISTER'); setError(null); setSuccess(null); }}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold uppercase tracking-wider relative z-10 transition-colors ${mode === 'REGISTER' ? 'text-black' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <UserPlus className="w-4 h-4" /> Registrarse
                                    </button>
                                </div>
                            )}

                            <div className="mb-8">
                                {mode === 'FORGOT_PASSWORD' ? (
                                    <button
                                        onClick={() => { setMode('LOGIN'); setError(null); setSuccess(null); }}
                                        className="flex items-center gap-2 text-slate-500 hover:text-black transition-colors mb-4 text-sm font-bold uppercase tracking-wide"
                                    >
                                        <ArrowLeft className="w-4 h-4" /> Volver
                                    </button>
                                ) : null}

                                <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-black mb-2">
                                    {mode === 'LOGIN' ? 'BIENVENIDO A ORIGEN' : mode === 'REGISTER' ? 'Crear Cuenta' : 'Recuperar Clave'}
                                </h2>
                                <p className="text-slate-500 text-sm md:text-base font-medium">
                                    {mode === 'LOGIN' ? 'Inicia sesión para conectar.'
                                        : mode === 'REGISTER' ? 'Completa el formulario para unirte.'
                                            : 'Ingresa tu email para recibir instrucciones.'}
                                </p>
                            </div>

                            {/* Messages */}
                            {error && (
                                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-start gap-3 rounded-r-lg animate-fadeIn">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                    <span className="text-sm font-bold">{error}</span>
                                </div>
                            )}
                            {success && (
                                <div className="mb-6 p-4 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 flex items-start gap-3 rounded-r-lg animate-fadeIn">
                                    <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                    <span className="text-sm font-bold">{success}</span>
                                </div>
                            )}

                            <form id="auth-form" onSubmit={mode === 'LOGIN' ? handleLogin : mode === 'REGISTER' ? handleRegister : handleForgotPasswordSubmit} className="space-y-5">

                                {mode === 'REGISTER' && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
                                        <div>
                                            <label className={labelClass}>Nombre</label>
                                            <input name="firstName" type="text" placeholder="Juan" value={formData.firstName} onChange={handleChange} className={inputClass} />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Apellido</label>
                                            <input name="lastName" type="text" placeholder="Pérez" value={formData.lastName} onChange={handleChange} className={inputClass} />
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className={labelClass}>Email</label>
                                    <div className="relative">
                                        <input
                                            name="email"
                                            type="email"
                                            placeholder="nombre@ejemplo.com"
                                            value={formData.email}
                                            onChange={handleChange}
                                            className={inputClass}
                                        />
                                        {mode === 'FORGOT_PASSWORD' && <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />}
                                    </div>
                                </div>

                                {mode === 'REGISTER' && (
                                    <div className="animate-fadeIn">
                                        <label className={labelClass}>Teléfono</label>
                                        <input name="phone" type="tel" placeholder="+54 9 11..." value={formData.phone} onChange={handleChange} className={inputClass} />
                                    </div>
                                )}

                                {mode === 'REGISTER' && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
                                        <div>
                                            <label className={labelClass}>Fecha de Nacimiento</label>
                                            <div className="relative">
                                                <div
                                                    className={`${inputClass} flex items-center justify-between pointer-events-none bg-white`}
                                                >
                                                    <span className={!formData.birthDate ? 'text-gray-400' : 'text-gray-900'}>
                                                        {formatDateForDisplay(formData.birthDate)}
                                                    </span>
                                                    <Calendar className="w-5 h-5 text-gray-400" />
                                                </div>
                                                <input
                                                    name="birthDate"
                                                    type="date"
                                                    value={formData.birthDate}
                                                    onChange={handleChange}
                                                    onClick={(e) => {
                                                        try {
                                                            if ('showPicker' in e.currentTarget) {
                                                                (e.currentTarget as any).showPicker();
                                                            }
                                                        } catch (error) {
                                                            console.log('Error opening picker:', error);
                                                        }
                                                    }}
                                                    className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Sexo</label>
                                            <select
                                                name="gender"
                                                value={formData.gender}
                                                onChange={handleChange}
                                                className={inputClass}
                                            >
                                                <option value="">Seleccionar...</option>
                                                <option value="Masculino">Masculino</option>
                                                <option value="Femenino">Femenino</option>
                                                <option value="No especificar">No especificar</option>
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {mode !== 'FORGOT_PASSWORD' && (
                                    <div>
                                        <label className={labelClass}>Contraseña</label>
                                        <div className="relative">
                                            <input
                                                name="password"
                                                type={showPassword ? "text" : "password"}
                                                placeholder="••••••••"
                                                value={formData.password}
                                                onChange={handleChange}
                                                onKeyDown={handleKeyEvent}
                                                onKeyUp={handleKeyEvent}
                                                className={inputClass}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black transition-colors"
                                            >
                                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                            </button>
                                        </div>
                                        {capsLockOn && (
                                            <div className="flex items-center gap-2 mt-2 text-amber-600 animate-fadeIn">
                                                <AlertTriangle className="w-4 h-4" />
                                                <span className="text-xs font-bold uppercase">Bloq Mayús activado</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {mode === 'REGISTER' && (
                                    <div className="animate-fadeIn">
                                        <label className={labelClass}>Confirmar Contraseña</label>
                                        <div className="relative">
                                            <input
                                                name="confirmPassword"
                                                type={showConfirmPassword ? "text" : "password"}
                                                placeholder="••••••••"
                                                value={formData.confirmPassword}
                                                onChange={handleChange}
                                                onKeyDown={handleKeyEvent}
                                                onKeyUp={handleKeyEvent}
                                                className={inputClass}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black transition-colors"
                                            >
                                                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                            </button>
                                        </div>
                                        {capsLockOn && (
                                            <div className="flex items-center gap-2 mt-2 text-amber-600 animate-fadeIn">
                                                <AlertTriangle className="w-4 h-4" />
                                                <span className="text-xs font-bold uppercase">Bloq Mayús activado</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {mode === 'LOGIN' && (
                                    <div className="flex justify-end pt-1">
                                        <button
                                            type="button"
                                            onClick={() => { setMode('FORGOT_PASSWORD'); setError(null); setSuccess(null); }}
                                            className="text-xs font-bold uppercase tracking-wide text-slate-400 hover:text-black transition-colors"
                                        >
                                            ¿Olvidaste tu contraseña?
                                        </button>
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    {/* Google Button - Icon Only, Next to Login */}
                                    {mode === 'LOGIN' && (
                                        <button
                                            id="google-login-btn"
                                            type="button"
                                            onClick={handleGoogleLogin}
                                            disabled={loading}
                                            className="px-5 border-2 border-slate-200 hover:border-black rounded-xl flex items-center justify-center transition-colors hover:bg-slate-50"
                                            title="Continuar con Google"
                                        >
                                            <GoogleIcon />
                                        </button>
                                    )}

                                    <button type="submit" disabled={loading} className={`${buttonClass} flex-1`}>
                                        {loading ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                {mode === 'LOGIN' ? 'Ingresar'
                                                    : mode === 'REGISTER' ? 'Crear Cuenta'
                                                        : 'Enviar Enlace'}
                                                <ArrowRight className="w-5 h-5" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}

                    <div className="mt-12 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        Sistema de Gestion Integral {new Date().getFullYear()}
                    </div>
                </div>
            </div>
        </div>

        {/* Invalid Credentials Modal */}
        <NeoModal
            isOpen={showErrorModal}
            onClose={() => setShowErrorModal(false)}
            title={modalErrorTitle}
            maxWidth="max-w-sm"
        >
            <div className="flex flex-col items-center justify-center text-center p-4">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6 border-4 border-red-200">
                    <AlertTriangle className="w-8 h-8" />
                </div>
                <p className="text-slate-600 font-medium mb-8">
                    {modalErrorMessage}
                </p>
                <button
                    onClick={() => setShowErrorModal(false)}
                    className="w-full py-3 bg-black text-white font-bold uppercase tracking-widest rounded-lg hover:bg-neutral-800 transition-all border-2 border-black flex justify-center items-center"
                >
                    Entendido
                </button>
            </div>
        </NeoModal>
        </>
    );
};

export default AuthScreen;
