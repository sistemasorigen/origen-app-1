import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Lo que se muestra cuando alguien abre un link que no le corresponde.
 *
 * Antes TODAS las pantallas con permiso hacían lo mismo: `<Navigate to="/" />`.
 * Daba igual si la persona no tenía sesión o si la tenía y le faltaba el rol:
 * aparecía en el inicio sin una palabra. Quien recibía por WhatsApp el link de
 * una función del Punto no entendía si el link estaba roto, si tenía que
 * entrar con su cuenta o si no le correspondía.
 *
 * Ahora son dos caminos distintos:
 *
 *   · Sin sesión → al login, guardando a dónde quería ir, y después del login
 *     vuelve a ese mismo link. El destino viaja por los dos caminos que usa
 *     la app: `state.from` (login con email) y sessionStorage (login con
 *     Google, que recarga la página entera y se lleva puesto el state).
 *   · Con sesión y sin el rol → se lo dice: una hoja que sube desde abajo en
 *     el teléfono y un modal en la compu.
 */

/**
 * Deja anotado a dónde quería entrar, para después del login.
 *
 * sessionStorage y no state: el login con Google recarga la página y el
 * state de react-router no sobrevive a eso. App.tsx lo consume cuando el
 * perfil ya está completo.
 */
export const guardarDestino = (location: { pathname: string; search?: string }) => {
    try {
        sessionStorage.setItem('post_login_redirect', `${location.pathname}${location.search || ''}`);
    } catch {
        // Navegación privada con el almacenamiento bloqueado: queda el
        // state.from, que alcanza para el login con email.
    }
};

const SinAcceso: React.FC = () => {
    const { user, isLoadingSession, isLoadingProfile } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const sinMovimiento = useReducedMotion();
    const [esMovil, setEsMovil] = useState(
        () => typeof window !== 'undefined' && window.innerWidth < 768,
    );
    const [abierto, setAbierto] = useState(true);

    useEffect(() => {
        const medir = () => setEsMovil(window.innerWidth < 768);
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, []);

    const irAlInicio = () => {
        setAbierto(false);
        navigate('/', { replace: true });
    };

    // Sin lista de dependencias a propósito: se vuelve a suscribir en cada
    // render para que Escape use siempre el irAlInicio de este render.
    useEffect(() => {
        const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') irAlInicio(); };
        document.addEventListener('keydown', alTeclear);
        return () => document.removeEventListener('keydown', alTeclear);
    });

    // El árbol de rutas recién monta con el perfil en la mano, pero si algo
    // lo monta antes no se manda a nadie al login por no haber terminado de
    // leer la sesión.
    if (isLoadingSession || isLoadingProfile) return null;

    if (!user) {
        guardarDestino(location);
        return <Navigate to="/auth" replace state={{ from: location }} />;
    }

    const transicion = sinMovimiento
        ? { duration: 0 }
        : { type: 'spring' as const, damping: 34, stiffness: 340 };

    // Por portal al body: cuando esto sale adentro del panel del Punto, el
    // contenedor tiene un `animate-fadeIn` —o sea, un transform— y un
    // transform le roba al position:fixed su marco de referencia. Sin esto el
    // velo arrancaba abajo de la navbar y la hoja quedaba corrida.
    return (
        <>
            {/* Lo que queda en el lugar de la pantalla que no se puede ver.
                Vacío, pero del color de la app: detrás del aviso no tiene que
                asomar el blanco del navegador. */}
            <div className="min-h-screen bg-slate-50" />
            {createPortal(
                <AnimatePresence>
                {abierto && (
                    <motion.div
                        className="fixed inset-0 z-[130] flex items-end justify-center md:items-center md:p-6"
                        style={{ background: 'rgba(10,10,10,.45)' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: sinMovimiento ? 0 : 0.2 }}
                        onClick={irAlInicio}
                    >
                        <motion.div
                            role="alertdialog"
                            aria-modal="true"
                            aria-labelledby="sin-acceso-titulo"
                            aria-describedby="sin-acceso-texto"
                            className="w-full md:w-[440px] bg-white px-6 pt-7 pb-8 md:p-7"
                            style={{
                                borderRadius: esMovil ? '28px 28px 0 0' : '24px',
                                boxShadow: '0 18px 60px rgba(10,10,10,.28)',
                            }}
                            initial={esMovil ? { y: '100%', opacity: 1 } : { opacity: 0, scale: 0.97 }}
                            animate={esMovil ? { y: 0, opacity: 1 } : { opacity: 1, scale: 1 }}
                            exit={esMovil ? { y: '100%', opacity: 1 } : { opacity: 0, scale: 0.97 }}
                            transition={transicion}
                            onClick={e => e.stopPropagation()}
                        >
                            <span className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                                <Lock className="w-5 h-5 text-slate-500" />
                            </span>

                            <h1 id="sin-acceso-titulo" className="mt-4 m-0 text-[22px] font-bold tracking-tight text-black leading-tight">
                                No tenés acceso a esta pantalla
                            </h1>
                            <p id="sin-acceso-texto" className="mt-2 m-0 text-sm text-slate-500 leading-relaxed">
                                Tu cuenta está activa, pero no tiene los permisos para entrar acá.
                                Si lo necesitás para servir, pedíselo a quien coordina el área.
                            </p>

                            <button
                                type="button"
                                onClick={irAlInicio}
                                autoFocus
                                className="w-full py-4 mt-6 bg-black text-white font-semibold text-sm rounded-full hover:bg-neutral-800 active:scale-[0.99] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                            >
                                Ir al inicio
                            </button>
                        </motion.div>
                    </motion.div>
                )}
                </AnimatePresence>,
                document.body,
            )}
        </>
    );
};

export default SinAcceso;
