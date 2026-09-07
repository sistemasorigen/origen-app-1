import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { CheckCircle, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

const UpdatePassword = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [sessionReady, setSessionReady] = useState(false);

    // Quick session setup from URL tokens
    useEffect(() => {
        const setupSession = async () => {
            console.log('UpdatePassword: Quick session setup');

            // Get tokens from URL hash immediately
            const hash = window.location.hash;
            const params = new URLSearchParams(hash.startsWith('#') ? hash.substring(1) : hash);
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token') || '';

            if (accessToken) {
                try {
                    // Set session directly - this is fast
                    const { data, error } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken
                    });

                    if (error) {
                        console.error('Session error:', error);
                        setError('El enlace ya venció. Pedí uno nuevo desde la pantalla de ingreso.');
                    } else if (data.session) {
                        console.log('Session ready!');
                        setSessionReady(true);
                        window.history.replaceState(null, '', '/');
                    }
                } catch (e: any) {
                    setError(e.message);
                }
            } else {
                // No tokens in URL - check if we already have a session
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    setSessionReady(true);
                } else {
                    setError('No encontramos el enlace de recuperación en la dirección.');
                }
            }
        };

        setupSession();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setError("Las contraseñas no coinciden.");
            return;
        }

        // 8 y no 6: es el mínimo real que exige Supabase desde que se subió
        // password_min_length. Con 6 el form dejaba pasar y el error volvía
        // crudo y en inglés desde la API.
        if (password.length < 8) {
            setError("La contraseña debe tener al menos 8 caracteres.");
            return;
        }

        setLoading(true);
        setError(null);

        const { error: updateError } = await supabase.auth.updateUser({ password });

        if (updateError) {
            setError(updateError.message);
        } else {
            setSuccess(true);
        }
        setLoading(false);
    };

    const goToLogin = async () => {
        // Se espera el signOut: antes se navegaba en el mismo tick y la
        // petición quedaba a medias al descargarse la página.
        await supabase.auth.signOut();
        // HashRouter: la ruta vive en el hash, sin el '#/' cae en el home.
        window.location.href = '/#/auth';
    };

    // Mismo lenguaje visual que /auth: campos rellenos, botón píldora,
    // títulos en sentence case.
    const inputClass = "w-full px-4 py-3.5 rounded-xl outline-none text-black font-medium placeholder-slate-400";
    const labelClass = "block text-[13px] font-semibold text-slate-700 mb-1.5";
    const buttonClass = "w-full py-4 bg-black text-white font-semibold rounded-full hover:bg-neutral-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex justify-center items-center gap-2 active:scale-[0.99]";

    return (
        <div className="min-h-screen relative flex flex-col lg:items-center lg:justify-center font-sans text-black">
            {/* Fondo de desktop: la tarjeta flota sobre la foto. */}
            <img
                src="/auth-bg.jpg"
                alt=""
                aria-hidden="true"
                className="hidden lg:block fixed inset-0 w-full h-full object-cover"
            />
            <div className="hidden lg:block fixed inset-0 bg-black/60" />

            {/* Banda mobile: contenedor propio de 160px para que el object-cover
                recorte por el centro y se vean las caras, igual que en /auth.
                Con la imagen a pantalla completa se veía solo el cielo. */}
            <div className="lg:hidden relative h-40 shrink-0">
                <img
                    src="/auth-bg.jpg"
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/30" />
            </div>

            <div className="relative flex-1 lg:flex-none flex flex-col w-full lg:max-w-md -mt-7 lg:mt-0 lg:py-12">
                <div className="bg-white rounded-t-[28px] lg:rounded-3xl lg:shadow-2xl px-6 pb-10 lg:p-8 flex-1 lg:flex-none">

                    <img
                        src="/origen-logo.png"
                        alt="Origen"
                        className="h-11 w-auto object-contain mx-auto mt-5 mb-6 lg:mt-0"
                    />

                    {success ? (
                        <div className="text-center">
                            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5">
                                <CheckCircle className="w-7 h-7" />
                            </div>
                            <h1 className="text-[26px] font-bold tracking-tight text-black mb-2">
                                Contraseña actualizada
                            </h1>
                            <p className="text-slate-500 text-sm leading-relaxed mb-7">
                                Ya podés entrar a Origen con tu contraseña nueva.
                            </p>
                            <button onClick={goToLogin} className={buttonClass}>
                                Iniciar sesión
                            </button>
                        </div>
                    ) : !sessionReady && error ? (
                        <div className="text-center">
                            <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-5">
                                <AlertCircle className="w-7 h-7" />
                            </div>
                            <h1 className="text-[26px] font-bold tracking-tight text-black mb-2">
                                Enlace inválido
                            </h1>
                            <p className="text-slate-500 text-sm leading-relaxed mb-7">{error}</p>
                            <button onClick={goToLogin} className={buttonClass}>
                                Iniciar sesión
                            </button>
                        </div>
                    ) : !sessionReady ? (
                        <div className="text-center py-6">
                            <Loader2 className="w-7 h-7 text-black animate-spin mx-auto mb-3" />
                            <p className="text-slate-500 text-sm">Verificando el enlace…</p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-7 text-center">
                                <h1 className="text-[26px] font-bold tracking-tight text-black mb-2">
                                    Nueva contraseña
                                </h1>
                                <p className="text-slate-500 text-sm leading-relaxed max-w-[46ch] mx-auto">
                                    Elegí una contraseña para tu cuenta. Tiene que tener al menos 8 caracteres.
                                </p>
                            </div>

                            <form id="reset-form" onSubmit={handleSubmit} className="space-y-5">
                                {error && (
                                    <div className="p-4 bg-red-50 text-red-700 flex items-start gap-3 rounded-xl text-left">
                                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                        <span className="text-sm font-bold">{error}</span>
                                    </div>
                                )}

                                <div>
                                    <label className={labelClass}>Nueva contraseña</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className={inputClass}
                                            placeholder="••••••••"
                                            required
                                            minLength={8}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className={labelClass}>Confirmar contraseña</label>
                                    <div className="relative">
                                        <input
                                            type={showConfirmPassword ? "text" : "password"}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className={inputClass}
                                            placeholder="••••••••"
                                            required
                                            minLength={8}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black transition-colors"
                                        >
                                            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-1">
                                    <button type="submit" disabled={loading} className={buttonClass}>
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Guardar contraseña'}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}

                    <div className="mt-10 text-center text-[10px] text-slate-300 font-semibold tracking-wide">
                        Sistema de Gestión Integral {new Date().getFullYear()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UpdatePassword;
