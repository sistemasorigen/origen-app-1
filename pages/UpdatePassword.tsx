import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Lock, CheckCircle, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';

const UpdatePassword = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
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
                        setError('El enlace ha expirado. Solicita uno nuevo.');
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
                    setError('No se encontró el enlace de recuperación.');
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

        if (password.length < 6) {
            setError("La contraseña debe tener al menos 6 caracteres.");
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

    const goToLogin = () => {
        supabase.auth.signOut();
        window.location.href = '/';
    };

    // Show form immediately if session ready, otherwise show quick loading
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-black p-8 text-center">
                    <div className="mx-auto bg-white/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                        <Lock className="text-white w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-white uppercase tracking-wider">Nueva Contraseña</h1>
                    <p className="text-white/60 text-sm mt-2">Establece una nueva clave para tu cuenta</p>
                </div>

                <div className="p-8">
                    {success ? (
                        <div className="text-center py-6">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-8 h-8" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800 mb-2">¡Contraseña Actualizada!</h2>
                            <p className="text-slate-500 mb-6">Tu contraseña ha sido cambiada correctamente.</p>
                            <button onClick={goToLogin} className="w-full py-3 bg-black text-white font-bold rounded-lg hover:bg-slate-800">
                                Ir al Login
                            </button>
                        </div>
                    ) : !sessionReady && error ? (
                        <div className="text-center py-6">
                            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertCircle className="w-8 h-8" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800 mb-2">Enlace Inválido</h2>
                            <p className="text-slate-500 mb-4">{error}</p>
                            <button onClick={goToLogin} className="w-full py-3 bg-black text-white font-bold rounded-lg hover:bg-slate-800">
                                Ir al Login
                            </button>
                        </div>
                    ) : !sessionReady ? (
                        <div className="text-center py-4">
                            <Loader2 className="w-8 h-8 text-black animate-spin mx-auto mb-2" />
                            <p className="text-slate-500 text-sm">Verificando...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm">{error}</div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nueva Contraseña</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-lg focus:border-black"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirmar Contraseña</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-lg focus:border-black"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-black text-white font-bold uppercase rounded-lg hover:bg-neutral-800 flex justify-center items-center gap-2 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : <>Actualizar <ArrowRight className="w-5 h-5" /></>}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UpdatePassword;
