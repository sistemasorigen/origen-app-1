import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useBloqueoDeFondo } from '../../hooks/useBloqueoDeFondo';
import { btnPrimario, btnSecundario } from './patron';

/**
 * Lo que pasa después de tocar Guardar.
 *
 * Antes el botón decía "Guardado" tres segundos y el anfitrión se quedaba en
 * la misma lista, sin saber si la reunión llegó o no. Acá la espera y el
 * resultado ocupan la pantalla: sube un panel con la carga, la carga se
 * convierte en un tilde verde cuando la base confirma, y recién entonces la
 * pantalla sigue sola.
 *
 * El velo bloquea los toques a propósito: mientras se guarda no hay nada que
 * tocar, y un segundo toque en Guardar mandaría la reunión dos veces.
 *
 * Con "menos movimiento" activado no sube ni se dibuja nada: los estados se
 * funden. La información es la misma; lo que se apaga es el adorno.
 */

export type EstadoGuardado = 'cerrado' | 'guardando' | 'listo' | 'error';

interface Props {
    estado: EstadoGuardado;
    /** "Asistencia guardada" o "Cambios guardados". */
    titulo: string;
    /** "12 de 15 presentes · miércoles, 9 de septiembre". */
    detalle?: string;
    /** Lo que dice mientras guarda. El Punto guarda otras cosas. */
    textoGuardando?: string;
    mensajeError?: string;
    onReintentar: () => void;
    onCerrar: () => void;
}

const VERDE = '#16a34a';
const ROJO = '#dc2626';

// El tilde se dibuja: el path va de pathLength 0 a 1. Las coordenadas son de
// un viewBox de 24, centrado para que el trazo quede óptico en el círculo.
const TILDE = 'M5 12.5l4.6 4.5L19 7.5';

const PanelGuardado: React.FC<Props> = ({
    estado, titulo, detalle, mensajeError, onReintentar, onCerrar,
    textoGuardando = 'Guardando la asistencia…',
}) => {
    const abierto = estado !== 'cerrado';
    const sinMovimiento = useReducedMotion();

    useBloqueoDeFondo(abierto);

    // Un golpecito al confirmar: el anfitrión está de pie, mirando a la gente
    // y no a la pantalla. Protegido porque iOS no lo tiene.
    useEffect(() => {
        if (estado === 'listo') {
            try { navigator.vibrate?.(30); } catch { /* el navegador no quiere */ }
        }
    }, [estado]);

    // Escape cierra, salvo mientras se guarda: ahí no hay nada que cancelar.
    useEffect(() => {
        if (!abierto || estado === 'guardando') return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [abierto, estado, onCerrar]);

    const anuncio = estado === 'guardando' ? textoGuardando
        : estado === 'listo' ? `${titulo}. ${detalle ?? ''}`
            : estado === 'error' ? `No se pudo guardar. ${mensajeError ?? ''}`
                : '';

    return createPortal(
        <AnimatePresence>
            {abierto && (
                <div className="fixed inset-0 z-[120] flex items-end justify-center">
                    {/* El velo come los toques. Tocarlo cierra sólo cuando ya
                        hay un resultado que se pueda dejar atrás. */}
                    <motion.div
                        className="absolute inset-0 bg-black/40"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => { if (estado !== 'guardando') onCerrar(); }}
                        aria-hidden="true"
                    />

                    <motion.div
                        role="status"
                        aria-live="polite"
                        className="relative w-full max-w-[430px] lg:max-w-[900px] bg-white dark:bg-[#1b1b1a] rounded-t-[28px] px-6 pt-8"
                        style={{ paddingBottom: 'calc(28px + env(safe-area-inset-bottom, 0px))' }}
                        initial={sinMovimiento ? { opacity: 0 } : { y: '100%' }}
                        animate={sinMovimiento ? { opacity: 1 } : { y: 0 }}
                        exit={sinMovimiento ? { opacity: 0 } : { y: '100%' }}
                        transition={sinMovimiento
                            ? { duration: 0.2 }
                            : { type: 'spring', stiffness: 420, damping: 38, mass: 0.9 }}
                    >
                        <span className="sr-only">{anuncio}</span>

                        <div className="flex flex-col items-center text-center">
                            <Circulo estado={estado} sinMovimiento={!!sinMovimiento} />

                            {estado === 'guardando' && (
                                <p className="mt-[22px] text-[17px] font-semibold tracking-[-.01em]">
                                    {textoGuardando}
                                </p>
                            )}

                            {estado === 'listo' && (
                                <>
                                    <p className="mt-[22px] text-[19px] font-semibold tracking-[-.01em]">{titulo}</p>
                                    {detalle && (
                                        <p className="mt-1.5 text-[14.5px] font-medium text-black/50 dark:text-white/50 first-letter:uppercase">
                                            {detalle}
                                        </p>
                                    )}
                                </>
                            )}

                            {estado === 'error' && (
                                <>
                                    <p className="mt-[22px] text-[19px] font-semibold tracking-[-.01em]">No se pudo guardar</p>
                                    <p className="mt-1.5 max-w-[300px] text-[14.5px] leading-[1.55] font-medium text-black/50 dark:text-white/50">
                                        {mensajeError || 'Revisá la conexión y probá de nuevo. Lo que marcaste sigue acá.'}
                                    </p>
                                    <button type="button" onClick={onReintentar} className={`${btnPrimario} mt-[26px] h-[54px] text-[16px]`}>
                                        Reintentar
                                    </button>
                                    <button type="button" onClick={onCerrar} className={`${btnSecundario} mt-2.5 w-full h-[54px] text-[16px]`}>
                                        Cerrar
                                    </button>
                                </>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body,
    );
};

/**
 * El mismo círculo de 64px en los tres estados: gira, se llena de verde, o se
 * pone rojo. Es una sola pieza que cambia, y no tres que se reemplazan, para
 * que la espera y el resultado se lean como un solo movimiento.
 */
const Circulo: React.FC<{ estado: EstadoGuardado; sinMovimiento: boolean }> = ({ estado, sinMovimiento }) => {
    if (estado === 'guardando') {
        return (
            <div className="w-16 h-16 rounded-full">
                <motion.svg
                    viewBox="0 0 48 48" className="w-16 h-16"
                    animate={sinMovimiento ? undefined : { rotate: 360 }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                >
                    {/* El anillo de atrás, y encima el arco que gira. En oscuro
                        se invierten: claro sobre fondo oscuro. */}
                    <circle cx="24" cy="24" r="20" fill="none" strokeWidth="4"
                        className="stroke-black/10 dark:stroke-white/15" />
                    <path d="M24 4a20 20 0 0 1 20 20" fill="none" strokeWidth="4" strokeLinecap="round"
                        className="stroke-[#0a0a0a] dark:stroke-white" />
                </motion.svg>
            </div>
        );
    }

    if (estado === 'listo') {
        return (
            <motion.div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: VERDE }}
                initial={sinMovimiento ? { opacity: 0 } : { scale: 0.9 }}
                animate={sinMovimiento ? { opacity: 1 } : { scale: [0.9, 1.08, 1] }}
                transition={sinMovimiento ? { duration: 0.2 } : { duration: 0.42, times: [0, 0.55, 1], ease: 'easeOut' }}
            >
                <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none"
                    stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <motion.path
                        d={TILDE}
                        initial={sinMovimiento ? { pathLength: 1 } : { pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={sinMovimiento ? { duration: 0 } : { duration: 0.35, delay: 0.12, ease: 'easeOut' }}
                    />
                </svg>
            </motion.div>
        );
    }

    return (
        <motion.div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: ROJO }}
            initial={sinMovimiento ? { opacity: 0 } : { scale: 0.92 }}
            animate={sinMovimiento ? { opacity: 1 } : { scale: 1 }}
            transition={{ duration: 0.2 }}
        >
            <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none"
                stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round">
                <path d="M7 7l10 10M17 7L7 17" />
            </svg>
        </motion.div>
    );
};

export default PanelGuardado;
