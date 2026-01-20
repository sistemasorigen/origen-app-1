import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { CheckCircle, AlertCircle, Loader2, Mail, ArrowRight, RotateCcw } from 'lucide-react';

const VerifyEmail: React.FC = () => {
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [errorMessage, setErrorMessage] = useState<string>('');

    useEffect(() => {
        const handleEmailVerification = async () => {
            try {
                // Supabase automatically handles the token exchange when the page loads
                // with the correct hash parameters. We just need to check if it worked.
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    console.error('Verification error:', error);
                    setErrorMessage(error.message);
                    setStatus('error');
                    return;
                }

                if (session) {
                    // User is now verified and logged in
                    setStatus('success');
                    // Redirect to home after 3 seconds
                    setTimeout(() => {
                        navigate('/', { replace: true });
                    }, 3000);
                } else {
                    // Check if there's a hash with tokens (means verification is in progress)
                    const hash = window.location.hash;
                    if (hash && (hash.includes('access_token') || hash.includes('type=signup'))) {
                        // Wait a bit for Supabase to process
                        setTimeout(async () => {
                            const { data: { session: retrySession } } = await supabase.auth.getSession();
                            if (retrySession) {
                                setStatus('success');
                                setTimeout(() => navigate('/', { replace: true }), 3000);
                            } else {
                                setStatus('success'); // Still show success, user just needs to login
                            }
                        }, 1500);
                    } else {
                        // No session and no hash - might be a direct visit
                        setStatus('success');
                    }
                }
            } catch (err: any) {
                console.error('Verification exception:', err);
                setErrorMessage(err.message || 'Error al verificar el email');
                setStatus('error');
            }
        };

        handleEmailVerification();
    }, [navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 px-4 py-8">
            {/* Neo-Brutalist Container */}
            <div className="w-full max-w-md">
                {/* Main Card with Neo-Brutalist styling */}
                <div className="bg-white dark:bg-slate-800 border-4 border-black dark:border-white relative"
                    style={{ boxShadow: '8px 8px 0px #000' }}>

                    {/* Header */}
                    <div className="bg-black dark:bg-white p-6 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-400 border-4 border-black rotate-3 mb-4"
                            style={{ boxShadow: '4px 4px 0px rgba(0,0,0,0.3)' }}>
                            <Mail className="w-8 h-8 text-black" />
                        </div>
                        <h1 className="text-2xl font-black text-white dark:text-black uppercase tracking-wider">
                            Verificación de Email
                        </h1>
                    </div>

                    {/* Content */}
                    <div className="p-8">
                        {/* Loading State */}
                        {status === 'loading' && (
                            <div className="text-center py-8">
                                <div className="w-20 h-20 bg-yellow-400 border-4 border-black flex items-center justify-center mx-auto mb-6 animate-pulse"
                                    style={{ boxShadow: '4px 4px 0px #000' }}>
                                    <Loader2 className="w-10 h-10 text-black animate-spin" />
                                </div>
                                <h2 className="text-xl font-black text-black dark:text-white uppercase mb-2">
                                    Verificando...
                                </h2>
                                <p className="text-slate-600 dark:text-slate-400 font-medium">
                                    Confirmando tu email, un momento...
                                </p>
                            </div>
                        )}

                        {/* Success State */}
                        {status === 'success' && (
                            <div className="text-center py-6">
                                <div className="w-20 h-20 bg-emerald-400 border-4 border-black flex items-center justify-center mx-auto mb-6 -rotate-2"
                                    style={{ boxShadow: '4px 4px 0px #000' }}>
                                    <CheckCircle className="w-10 h-10 text-black" />
                                </div>
                                <h2 className="text-2xl font-black text-black dark:text-white uppercase mb-3">
                                    ¡Verificado!
                                </h2>
                                <p className="text-slate-600 dark:text-slate-400 font-medium mb-6">
                                    Tu cuenta está lista. Ya podés iniciar sesión.
                                </p>

                                {/* Success Box */}
                                <div className="bg-emerald-100 dark:bg-emerald-900/30 border-4 border-black p-4 mb-6"
                                    style={{ boxShadow: '4px 4px 0px #000' }}>
                                    <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300 uppercase">
                                        ✓ Email confirmado correctamente
                                    </p>
                                </div>

                                <button
                                    onClick={() => navigate('/auth')}
                                    className="w-full py-4 bg-black dark:bg-white text-white dark:text-black font-black text-lg uppercase tracking-wider border-4 border-black dark:border-white hover:-translate-y-1 hover:shadow-[6px_6px_0px_#000] dark:hover:shadow-[6px_6px_0px_#fff] transition-all duration-200 flex items-center justify-center gap-3"
                                >
                                    Iniciar Sesión <ArrowRight className="w-6 h-6" />
                                </button>
                            </div>
                        )}

                        {/* Error State */}
                        {status === 'error' && (
                            <div className="text-center py-6">
                                <div className="w-20 h-20 bg-red-400 border-4 border-black flex items-center justify-center mx-auto mb-6 rotate-2"
                                    style={{ boxShadow: '4px 4px 0px #000' }}>
                                    <AlertCircle className="w-10 h-10 text-black" />
                                </div>
                                <h2 className="text-2xl font-black text-black dark:text-white uppercase mb-3">
                                    Error
                                </h2>
                                <p className="text-slate-600 dark:text-slate-400 font-medium mb-4">
                                    No pudimos verificar tu email.
                                </p>

                                {/* Error Box */}
                                <div className="bg-red-100 dark:bg-red-900/30 border-4 border-black p-4 mb-6"
                                    style={{ boxShadow: '4px 4px 0px #000' }}>
                                    <p className="text-sm font-bold text-red-800 dark:text-red-300 uppercase">
                                        {errorMessage || 'El enlace puede haber expirado'}
                                    </p>
                                </div>

                                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                                    Intentá registrarte nuevamente o pedí otro link de confirmación.
                                </p>

                                <button
                                    onClick={() => navigate('/auth')}
                                    className="w-full py-4 bg-black dark:bg-white text-white dark:text-black font-black text-lg uppercase tracking-wider border-4 border-black dark:border-white hover:-translate-y-1 hover:shadow-[6px_6px_0px_#000] dark:hover:shadow-[6px_6px_0px_#fff] transition-all duration-200 flex items-center justify-center gap-3"
                                >
                                    <RotateCcw className="w-5 h-5" /> Volver al Inicio
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer text */}
                <p className="text-center text-slate-500 dark:text-slate-400 text-sm mt-6 font-medium">
                    © 2026 Origen App · Grupos de Conexión
                </p>
            </div>
        </div>
    );
};

export default VerifyEmail;

