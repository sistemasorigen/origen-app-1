import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls, useReducedMotion } from 'framer-motion';
import { useBloqueoDeFondo } from '../../hooks/useBloqueoDeFondo';

/**
 * El panel de la cartelera /gcx (design-claude/GCX - Tarjetas y pagina):
 * compartir un grupo, el aviso de restricción, la postulación a anfitrión y
 * la inscripción a un grupo (ModalUnirseGrupo, con id `gcx-inscripcion`).
 *
 * En el teléfono no es un modal: sube desde abajo, con agarradera y arrastre
 * para cerrar. En la compu es un modal centrado de 460 px (560 la
 * postulación).
 *
 * Misma técnica que HojaDetalle —medir el ancho en el PRIMER render, bloquear
 * el fondo como lo necesita iOS, Escape, devolver el foco,
 * prefers-reduced-motion—. Reemplazó a la vieja HojaInscripcion, que no
 * arrastraba y tenía un ancho fijo de 520.
 */

interface Props {
    abierta: boolean;
    onCerrar: () => void;
    /** id del título, para que el lector de pantalla anuncie el diálogo */
    etiquetadaPor: string;
    /** 460 para compartir y el aviso; 560 para la postulación. */
    ancha?: boolean;
    /** En el teléfono, la postulación ocupa el 92% del alto aunque sea corta. */
    alta?: boolean;
    /** Lo que queda fijo abajo (el botón de enviar). */
    pie?: React.ReactNode;
    /** Línea arriba del pie: la lleva el formulario, que scrollea detrás. */
    pieConLinea?: boolean;
    /** id del contenedor; la postulación lo usa para scopear sus campos. */
    id?: string;
    children: React.ReactNode;
}

/** Arrastrar más que esto cierra la hoja. */
const CIERRA_EN = 90;

const ENFOCABLES = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

const HojaGrupos: React.FC<Props> = ({ abierta, onCerrar, etiquetadaPor, ancha, alta, pie, pieConLinea, id, children }) => {
    const [esMovil, setEsMovil] = useState(
        () => typeof window !== 'undefined' && window.innerWidth < 768,
    );
    const hojaRef = useRef<HTMLDivElement>(null);
    const focoPrevio = useRef<HTMLElement | null>(null);
    const sinMovimiento = useReducedMotion();
    const arrastre = useDragControls();
    // En un ref para que el efecto del foco corra sólo al abrir: quien la usa
    // pasa una función nueva en cada render, y con ella en las dependencias
    // el foco saltaba al panel mientras se escribía en un campo.
    const cerrarRef = useRef(onCerrar);
    cerrarRef.current = onCerrar;

    useEffect(() => {
        const medir = () => setEsMovil(window.innerWidth < 768);
        medir();
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, []);

    // Escape cierra; Tab no se escapa del panel; al cerrar, el foco vuelve a
    // lo que lo abrió (la tarjeta, la franja).
    useEffect(() => {
        if (!abierta) return;
        focoPrevio.current = document.activeElement as HTMLElement;
        const t = window.setTimeout(() => hojaRef.current?.focus(), 0);
        const alTeclear = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { cerrarRef.current(); return; }
            if (e.key !== 'Tab' || !hojaRef.current) return;
            const lista = [...hojaRef.current.querySelectorAll<HTMLElement>(ENFOCABLES)];
            if (lista.length === 0) return;
            const primero = lista[0], ultimo = lista[lista.length - 1];
            const activo = document.activeElement;
            if (e.shiftKey && (activo === primero || activo === hojaRef.current)) { e.preventDefault(); ultimo.focus(); }
            else if (!e.shiftKey && activo === ultimo) { e.preventDefault(); primero.focus(); }
        };
        document.addEventListener('keydown', alTeclear);
        return () => {
            window.clearTimeout(t);
            document.removeEventListener('keydown', alTeclear);
            focoPrevio.current?.focus?.();
        };
    }, [abierta]);

    useBloqueoDeFondo(abierta);

    if (typeof document === 'undefined') return null;

    const transicion = sinMovimiento
        ? { duration: 0 }
        : esMovil
            ? { type: 'tween' as const, duration: 0.38, ease: [0.2, 0.8, 0.3, 1] as const }
            : { type: 'tween' as const, duration: 0.28, ease: [0.2, 0.8, 0.3, 1] as const };

    return createPortal(
        <AnimatePresence>
            {abierta && (
                <motion.div
                    className="gcx-m fixed inset-0 z-[120] flex items-end justify-center md:items-center md:p-10"
                    style={{ background: 'rgba(0,0,0,.42)' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: sinMovimiento ? 0 : 0.25 }}
                    onClick={onCerrar}
                >
                    <motion.div
                        ref={hojaRef}
                        id={id}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={etiquetadaPor}
                        tabIndex={-1}
                        className={`relative flex w-full flex-col overflow-hidden outline-none ${ancha ? 'md:max-w-[560px]' : 'md:max-w-[460px]'}`}
                        style={{
                            background: 'var(--g-card)',
                            color: 'var(--g-ink)',
                            borderRadius: esMovil ? '28px 28px 0 0' : 28,
                            maxHeight: esMovil ? '92dvh' : 'calc(100dvh - 80px)',
                            height: esMovil && alta ? '92dvh' : 'auto',
                            boxShadow: '0 20px 60px rgba(0,0,0,.25)',
                        }}
                        initial={esMovil ? { y: '100%', opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95, y: 0 }}
                        animate={esMovil ? { y: 0, opacity: 1, scale: 1 } : { opacity: 1, scale: 1, y: 0 }}
                        exit={esMovil ? { y: '100%', opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95, y: 0 }}
                        transition={transicion}
                        // El arrastre arranca sólo desde la agarradera: desde el
                        // cuerpo competiría con el scroll del formulario.
                        drag={esMovil ? 'y' : false}
                        dragListener={false}
                        dragControls={arrastre}
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={{ top: 0, bottom: 0.6 }}
                        onDragEnd={(_, info) => { if (info.offset.y > CIERRA_EN) onCerrar(); }}
                        onClick={e => e.stopPropagation()}
                    >
                        {esMovil && (
                            <div
                                aria-hidden="true"
                                onPointerDown={e => arrastre.start(e)}
                                className="flex-none pt-2.5 pb-1 cursor-grab"
                                style={{ touchAction: 'none' }}
                            >
                                <span className="block mx-auto w-10 h-[5px] rounded-[9px]" style={{ background: 'var(--g-line)' }} />
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={onCerrar}
                            aria-label="Cerrar"
                            className="gcx-hover-chip absolute top-3.5 right-3.5 z-[2] w-11 h-11 rounded-full border-0 flex items-center justify-center cursor-pointer"
                            style={{ background: 'var(--g-chip)', color: 'var(--g-ink)' }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                        </button>

                        <div
                            className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
                            style={{
                                padding: esMovil
                                    ? `18px 20px ${pie ? '24px' : 'calc(24px + env(safe-area-inset-bottom))'}`
                                    : '32px 32px 28px',
                            }}
                        >
                            {children}
                        </div>

                        {pie && (
                            <div
                                className="flex-none flex flex-col gap-2"
                                style={{
                                    padding: esMovil ? '12px 20px calc(28px + env(safe-area-inset-bottom))' : '16px 32px 24px',
                                    borderTop: pieConLinea ? '1px solid var(--g-line2)' : 0,
                                }}
                            >
                                {pie}
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body,
    );
};

export default HojaGrupos;
