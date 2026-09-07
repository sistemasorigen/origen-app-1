
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { User } from '../../types';
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle, LogIn, Lock, ArrowLeft, Mail, AlertTriangle, Calendar, MailCheck, RefreshCw } from 'lucide-react';
// --- TUTORIAL INTEGRATION ---
import { useTutorial } from '../../src/hooks/useTutorial';
import TutorialController from '../../components/onboarding/ControladorTutorial';
import TutorialInvitation from '../../components/onboarding/InvitacionTutorial';
import { tours } from '../../src/config/tours';
import NeoModal from '../../components/ui/NeoModal';

interface AuthScreenProps {
    onLoginSuccess: (user: User) => void;
}

type AuthMode = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD';

const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
    const navigate = useNavigate();
    const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();

    const [mode, setMode] = useState<AuthMode>('LOGIN');
    // Splash de bienvenida — SOLO mobile (lg:hidden).
    // Arranca en true: en mobile, lo primero que se ve
    // es la imagen con los 2 botones. Al elegir "email"
    // pasa a false y aparece el formulario de siempre.
    // En desktop este estado existe pero es irrelevante:
    // el splash nunca se renderiza y el formulario
    // siempre se muestra.
    const [showMobileSplash, setShowMobileSplash] = useState(true);
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

    const MAX_ATTEMPTS = 5;
    const LOCKOUT_MS = 30_000; // 30 segundos

    const getRateLimit = () => {
        try {
            return JSON.parse(
                sessionStorage.getItem('login_rl') || 
                '{"attempts":0,"lockedUntil":0}'
            );
        } catch { return { attempts: 0, lockedUntil: 0 }; }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        const rl = getRateLimit();
        
        if (Date.now() < rl.lockedUntil) {
            const secs = Math.ceil((rl.lockedUntil - Date.now()) / 1000);
            setError(`Demasiados intentos. Esperá ${secs} segundos.`);
            return;
        }

        setLoading(true);
        setError(null);

        const result = await signIn(formData.email, formData.password);

        if (result.success) {
            sessionStorage.removeItem('login_rl');
            onLoginSuccess({ id: 'auth-user', name: 'User', email: formData.email, role: 'VIEWER', isActive: true } as User);
        } else {
            const newAttempts = rl.attempts + 1;
            sessionStorage.setItem('login_rl', JSON.stringify({
                attempts: newAttempts,
                lockedUntil: newAttempts >= MAX_ATTEMPTS 
                    ? Date.now() + LOCKOUT_MS : 0
            }));

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
                setModalErrorTitle("Datos incorrectos");
                setModalErrorMessage("El email o la contraseña no coinciden. Revisá los datos e intentá de nuevo.");
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

        if (formData.password.length < 8) {
            setError("La contraseña debe tener al menos 8 caracteres.");
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
    // El relleno y el radio reales de los inputs viven en index.html (#auth-form):
    // el override global con !important gana por especificidad sobre estas clases.
    // Acá quedan solo tipografía y espaciado, que ese override no toca.
    const inputClass = "w-full px-4 py-3.5 rounded-xl outline-none text-black font-medium placeholder-slate-400";
    const labelClass = "block text-[13px] font-semibold text-slate-700 mb-1.5";
    const buttonClass = "w-full py-4 bg-black text-white font-semibold rounded-full hover:bg-neutral-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex justify-center items-center gap-2 active:scale-[0.99]";
    const googleButtonClass = "w-full py-4 bg-slate-100 text-black font-semibold rounded-full hover:bg-slate-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex justify-center items-center gap-3 active:scale-[0.99]";

    const {
        isActive,
        showInvitation,
        startTutorial,
        completeTutorial,
        declineTemporary,
        dismissTutorial
    } = useTutorial('auth');

    // El splash solo aplica al modo LOGIN inicial. Si
    // el usuario fue a registrarse, a recuperar
    // contraseña, o ya completó el registro, el
    // formulario manda y el splash no vuelve a
    // aparecer — si no, quedaría atrapado.
    const splashVisible = showMobileSplash && mode === 'LOGIN' && !registrationComplete;

    // Una sola flecha para toda la pantalla mobile, con un paso atrás por vez:
    // confirmación → login → splash. Antes hacían falta dos botones apilados
    // en la misma esquina para cubrir lo mismo.
    const volverAtras = () => {
        setError(null);
        setSuccess(null);
        if (registrationComplete) {
            setRegistrationComplete(false);
            setMode('LOGIN');
            return;
        }
        if (mode !== 'LOGIN') {
            setMode('LOGIN');
            return;
        }
        setShowMobileSplash(true);
    };

    return (
        <>
        <div className="min-h-screen flex flex-col lg:flex-row bg-white font-sans text-black overflow-hidden">

            {/* ══ SPLASH MOBILE — lg:hidden, el desktop nunca lo renderiza ══ */}
            {splashVisible && (
                <div className="lg:hidden fixed inset-0 z-40 flex flex-col">
                    {/* Imagen de fondo (la misma que usa el panel de desktop) */}
                    <img
                        src="/auth-bg.jpg"
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                    {/* Degradado inferior: sostiene el nombre, la bajada y los botones */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />
                    {/* Velo superior: el logo y la flecha son blancos y el cielo de la
                        foto es claro — sin esto ninguno de los dos se lee */}
                    <div className="absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-black/50 to-transparent" />

                    <div className="relative z-10 flex-1 flex flex-col justify-end px-6 pb-10">
                        {/* mb-auto contra el justify-end del contenedor: empuja el logo
                            arriba y deja todo lo demás anclado abajo */}
                        <img
                            src="/origen-logo-full.png"
                            alt="Origen"
                            className="h-20 w-auto object-contain invert self-center mt-20 mb-auto"
                        />

                        <h1 className="text-white text-[30px] leading-none font-semibold tracking-tight text-center">
                            Origen App
                        </h1>
                        <p className="text-white/75 text-[15px] font-light text-center mt-2.5 mb-8">
                            Conectando a la comunidad.
                        </p>

                        <button
                            type="button"
                            onClick={() => setShowMobileSplash(false)}
                            className="w-full h-14 rounded-full bg-white text-slate-900 font-semibold text-sm flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform mb-3"
                        >
                            <Mail className="w-5 h-5" />
                            Continuar con email
                        </button>

                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="w-full h-14 rounded-full bg-white/10 border border-white/25 backdrop-blur-sm text-white font-semibold text-sm flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform disabled:opacity-50"
                        >
                            <GoogleIcon />
                            Continuar con Google
                        </button>
                    </div>
                </div>
            )}

            {/* Back to Home button.
                Sobre el splash queda solo la flecha en blanco: el texto oscuro no se
                leía sobre la foto y competía con el logo.

                OJO con las variantes lg: no se pueden sacar. `splashVisible` es un
                booleano de JS y vale true en desktop también — el splash se oculta
                por CSS (lg:hidden), no por estado. Sin el `lg:` de cada clase, el
                botón de desktop perdería la etiqueta y se volvería blanco. */}
            <button
                onClick={() => navigate('/')}
                aria-label="Volver al home"
                className={`absolute top-4 left-4 z-50 items-center gap-2 rounded-lg text-sm font-bold transition-all ${
                    splashVisible
                        ? 'flex p-3 text-white hover:bg-white/10 lg:px-3 lg:py-2 lg:text-slate-600 lg:hover:text-black lg:hover:bg-slate-100'
                        : 'hidden lg:flex px-3 py-2 text-slate-600 hover:text-black hover:bg-slate-100'
                }`}
            >
                <ArrowLeft className={splashVisible ? 'w-5 h-5 lg:w-4 lg:h-4' : 'w-4 h-4'} />
                <span className={splashVisible ? 'hidden lg:inline' : ''}>Volver al home</span>
            </button>

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
                run={isActive && !splashVisible}
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
            <div className={`w-full flex-1 lg:flex-none lg:w-1/2 flex-col justify-center lg:p-20 relative bg-white ${splashVisible ? 'hidden lg:flex' : 'flex'}`}>

                {/* Banda fotográfica — solo mobile. En desktop la foto ya ocupa
                    el panel izquierdo y una segunda banda sería redundante. */}
                <div className="lg:hidden relative h-40 shrink-0">
                    <img
                        src="/auth-bg.jpg"
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30" />
                    <button
                        type="button"
                        onClick={volverAtras}
                        aria-label="Volver"
                        className="absolute top-4 left-4 z-10 p-3 rounded-lg text-white hover:bg-white/10 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                </div>

                {/* La hoja blanca monta sobre la foto y el logo se apoya en la costura */}
                <div className="relative -mt-7 lg:mt-0 flex-1 rounded-t-[28px] lg:rounded-none bg-white px-6 pb-10 lg:p-0 lg:flex lg:flex-col lg:justify-center">

                    {/* El logo apoya sobre el blanco, no sobre la costura: es oscuro
                        y sobre la foto la mitad superior se perdía. */}
                    <img
                        src="/origen-logo.png"
                        alt="Origen"
                        className="lg:hidden h-11 w-auto object-contain mx-auto mt-5 mb-6"
                    />

                <div className="max-w-md mx-auto w-full">
                    {/* Registration Complete - Email Confirmation Card */}
                    {registrationComplete ? (
                        <div className="animate-fadeIn">
                            <div className="text-center">
                                <div className="flex justify-center mb-6">
                                    <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center">
                                        <MailCheck className="w-8 h-8 text-white" />
                                    </div>
                                </div>

                                <h2 className="text-[26px] lg:text-3xl font-bold tracking-tight text-black mb-2">
                                    Revisá tu email
                                </h2>

                                <p className="text-slate-500 text-sm leading-relaxed mb-4">
                                    Te mandamos un enlace de confirmación a:
                                </p>

                                <p className="text-black font-semibold text-center mb-5 bg-slate-100 py-3 px-4 rounded-xl break-all">
                                    {registeredEmail}
                                </p>

                                <p className="text-slate-500 text-sm leading-relaxed mb-7">
                                    Abrí el enlace para activar tu cuenta. Una vez confirmada, ya podés iniciar sesión.
                                </p>

                                {/* Messages */}
                                {error && (
                                    <div className="mb-4 p-3 bg-red-50 text-red-700 flex items-start gap-2 rounded-xl text-left">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                        <span className="text-sm font-bold">{error}</span>
                                    </div>
                                )}
                                {success && (
                                    <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 flex items-start gap-2 rounded-xl text-left">
                                        <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                        <span className="text-sm font-bold">{success}</span>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="space-y-3">
                                    <button
                                        onClick={() => {
                                            setRegistrationComplete(false);
                                            setMode('LOGIN');
                                            setError(null);
                                            setSuccess(null);
                                        }}
                                        className={buttonClass}
                                    >
                                        <LogIn className="w-4 h-4" />
                                        Iniciar sesión
                                    </button>

                                    <button
                                        onClick={handleResendConfirmation}
                                        disabled={resendLoading}
                                        className={googleButtonClass}
                                    >
                                        {resendLoading ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <>
                                                <RefreshCw className="w-4 h-4" />
                                                Reenviar email
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Helper text */}
                            <p className="text-[13px] text-slate-400 text-center mt-7">
                                ¿No te llegó? Revisá la carpeta de spam.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-7 text-center">
                                {mode === 'FORGOT_PASSWORD' && (
                                    // Solo desktop: en mobile este paso atrás ya lo da la
                                    // flecha sobre la foto, y tenerlo dos veces sobra.
                                    <button
                                        onClick={() => { setMode('LOGIN'); setError(null); setSuccess(null); }}
                                        className="hidden lg:flex items-center gap-2 text-slate-500 hover:text-black transition-colors mb-4 text-sm font-semibold"
                                    >
                                        <ArrowLeft className="w-4 h-4" /> Volver
                                    </button>
                                )}

                                <h2 className="text-[26px] lg:text-3xl font-bold tracking-tight text-black mb-2">
                                    {mode === 'LOGIN' ? 'Bienvenido de nuevo'
                                        : mode === 'REGISTER' ? 'Creá tu cuenta'
                                            : 'Recuperar contraseña'}
                                </h2>
                                <p className="text-slate-500 text-sm leading-relaxed max-w-[46ch] mx-auto">
                                    {mode === 'LOGIN' ? 'Iniciá sesión para ver los grupos, anotarte en las actividades y conectar con la comunidad.'
                                        : mode === 'REGISTER' ? 'Completá tus datos para unirte a Origen y empezar a participar.'
                                            : 'Escribí tu email y te mandamos un enlace para crear una contraseña nueva.'}
                                </p>
                            </div>

                            {/* Messages */}
                            {error && (
                                <div className="mb-6 p-4 bg-red-50 text-red-700 flex items-start gap-3 rounded-xl text-left animate-fadeIn">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                    <span className="text-sm font-bold">{error}</span>
                                </div>
                            )}
                            {success && (
                                <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 flex items-start gap-3 rounded-xl text-left animate-fadeIn">
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
                                            <label className={labelClass}>Fecha de nacimiento</label>
                                            <div className="relative">
                                                <div
                                                    className={`${inputClass} flex items-center justify-between pointer-events-none bg-slate-100 border border-transparent`}
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
                                        <label className={labelClass}>Confirmar contraseña</label>
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
                                    <div className="flex justify-end -mt-1">
                                        <button
                                            type="button"
                                            onClick={() => { setMode('FORGOT_PASSWORD'); setError(null); setSuccess(null); }}
                                            className="text-[13px] font-semibold text-slate-500 hover:text-black transition-colors"
                                        >
                                            ¿Olvidaste tu contraseña?
                                        </button>
                                    </div>
                                )}

                                <div className="space-y-3 pt-1">
                                    <button type="submit" disabled={loading} className={buttonClass}>
                                        {loading ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            mode === 'LOGIN' ? 'Ingresar'
                                                : mode === 'REGISTER' ? 'Crear cuenta'
                                                    : 'Enviar enlace'
                                        )}
                                    </button>

                                    {mode === 'LOGIN' && (
                                        <button
                                            id="google-login-btn"
                                            type="button"
                                            onClick={handleGoogleLogin}
                                            disabled={loading}
                                            className={googleButtonClass}
                                        >
                                            <GoogleIcon />
                                            Continuar con Google
                                        </button>
                                    )}
                                </div>
                            </form>

                            {mode !== 'FORGOT_PASSWORD' && (
                                <p className="mt-7 text-center text-sm text-slate-500">
                                    {mode === 'LOGIN' ? '¿No tenés cuenta? ' : '¿Ya tenés cuenta? '}
                                    <button
                                        type="button"
                                        onClick={() => { setMode(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN'); setError(null); setSuccess(null); }}
                                        className="font-semibold text-black underline underline-offset-4 decoration-2 hover:opacity-60 transition-opacity"
                                    >
                                        {mode === 'LOGIN' ? 'Registrate' : 'Iniciá sesión'}
                                    </button>
                                </p>
                            )}
                        </>
                    )}

                    <div className="mt-10 text-center text-[10px] text-slate-300 font-semibold tracking-wide">
                        Sistema de Gestión Integral {new Date().getFullYear()}
                    </div>
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
            variant="soft"
            hideCloseButton
        >
            <div className="flex flex-col items-center justify-center text-center pt-2 pb-2">
                <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-5">
                    <AlertTriangle className="w-7 h-7" />
                </div>
                <p className="text-slate-500 text-sm leading-relaxed mb-7">
                    {modalErrorMessage}
                </p>
                <button
                    onClick={() => setShowErrorModal(false)}
                    className={buttonClass}
                >
                    Entendido
                </button>
            </div>
        </NeoModal>
        </>
    );
};

export default AuthScreen;
