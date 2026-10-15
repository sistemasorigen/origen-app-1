import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useBloqueoDeFondo } from '../../hooks/useBloqueoDeFondo';
import { C, FUENTE } from './PiezasTablero';

/**
 * La ficha de una solicitud, en las pantallas de detalle de Reportes del
 * Punto (design-claude/Reportes Punto de Informacion - Bautismos.dc.html).
 *
 * En el teléfono NO es un modal: es un panel que sube desde abajo, con
 * agarradera y arrastre para cerrar, porque la ficha se abre con el pulgar y
 * se cierra con el pulgar. En la compu es un modal centrado de 580px con su
 * cruz arriba a la derecha.
 *
 * La técnica es la de components/GCX/HojaInscripcion.tsx —medir el ancho en
 * el PRIMER render, bloquear el fondo como lo necesita iOS, Escape, devolver
 * el foco, respetar prefers-reduced-motion—, pero con los tokens de Reportes
 * y SIN el id `gcx-inscripcion`: esta hoja no tiene que heredar nada de la
 * familia visual de GCX.
 */

export interface CampoDeFicha {
    rotulo: string;
    valor: string;
    /** El estado va como pastilla, no como texto. */
    pastilla?: { fondo: string; tinta: string };
}

interface Props {
    abierta: boolean;
    onCerrar: () => void;
    /** "Solicitud de bautismo" */
    sub: string;
    /** El nombre de quien pidió: es el título de la ficha. */
    titulo: string;
    children: React.ReactNode;
}

/** Arrastrar más que esto cierra la hoja. Lo mismo que dibuja el .dc. */
const CIERRA_EN = 90;

const HojaDetalle: React.FC<Props> = ({ abierta, onCerrar, sub, titulo, children }) => {
    /**
     * Se mide en el PRIMER render, no en un efecto: si arranca en `false`, en
     * un teléfono la hoja monta con el `initial` de escritorio y la animación
     * queda varada a mitad de camino (el mismo problema que documenta
     * HojaInscripcion).
     */
    const [esMovil, setEsMovil] = useState(
        () => typeof window !== 'undefined' && window.innerWidth < 768,
    );
    const focoPrevio = useRef<HTMLElement | null>(null);
    const sinMovimiento = useReducedMotion();
    const arrastre = useDragControls();

    useEffect(() => {
        const medir = () => setEsMovil(window.innerWidth < 768);
        medir();
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, []);

    // Escape cierra, y al cerrar el foco vuelve a la fila que la abrió.
    useEffect(() => {
        if (!abierta) return;
        focoPrevio.current = document.activeElement as HTMLElement;
        const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
        document.addEventListener('keydown', alTeclear);
        return () => {
            document.removeEventListener('keydown', alTeclear);
            focoPrevio.current?.focus?.();
        };
    }, [abierta, onCerrar]);

    useBloqueoDeFondo(abierta);

    if (typeof document === 'undefined') return null;

    const transicion = sinMovimiento
        ? { duration: 0 }
        : { type: 'spring' as const, damping: 34, stiffness: 340 };

    return createPortal(
        <AnimatePresence>
            {abierta && (
                <motion.div
                    className="fixed inset-0 z-[120] flex items-end justify-center md:items-center md:p-6"
                    style={{ background: 'rgba(15,23,42,.45)', fontFamily: FUENTE }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: sinMovimiento ? 0 : 0.2 }}
                    onClick={onCerrar}
                >
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label={titulo}
                        className="relative flex w-full flex-col overflow-hidden bg-white md:w-[580px]"
                        style={{
                            borderRadius: esMovil ? '28px 28px 0 0' : '16px',
                            maxHeight: esMovil ? '92vh' : '90vh',
                            boxShadow: '0 24px 60px rgba(15,23,42,.25)',
                        }}
                        initial={esMovil ? { y: '100%', opacity: 1 } : { opacity: 0, y: 8, scale: 0.98 }}
                        animate={esMovil ? { y: 0, opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                        exit={esMovil ? { y: '100%', opacity: 1 } : { opacity: 0, y: 8, scale: 0.98 }}
                        transition={transicion}
                        // El arrastre arranca sólo desde la agarradera: desde el
                        // cuerpo competiría con el scroll de la ficha.
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
                                onPointerDown={e => arrastre.start(e)}
                                className="pt-2.5 pb-1.5 px-5 shrink-0 cursor-grab"
                                style={{ touchAction: 'none' }}
                            >
                                <span className="block mx-auto w-10 h-[5px] rounded-full" style={{ background: '#d1d5db' }} />
                            </div>
                        )}

                        <div className={`overflow-y-auto overscroll-contain ${esMovil ? 'px-5 pt-1.5 pb-[26px]' : 'px-6 py-[22px]'}`}>
                            <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="m-0 text-[12.5px] font-semibold" style={{ color: C.apagado }}>{sub}</p>
                                    <p className="mt-1.5 m-0 text-[20px] leading-[1.25] font-semibold tracking-[-.01em]" style={{ color: C.tinta }}>
                                        {titulo}
                                    </p>
                                </div>
                                {!esMovil && (
                                    <button
                                        type="button"
                                        onClick={onCerrar}
                                        aria-label="Cerrar"
                                        className="w-9 h-9 shrink-0 rounded-[10px] flex items-center justify-center"
                                        style={{ background: '#f1f2f4', color: C.medio }}
                                    >
                                        <X className="w-3.5 h-3.5" strokeWidth={2.4} />
                                    </button>
                                )}
                            </div>

                            {children}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body,
    );
};

/** Las filas rótulo / valor de la ficha. */
export const CamposDeFicha: React.FC<{ campos: CampoDeFicha[] }> = ({ campos }) => (
    <div className="mt-3.5">
        {campos.map(c => (
            <div
                key={c.rotulo}
                className="flex items-start justify-between gap-4 py-3"
                style={{ borderTop: `1px solid ${C.bordeSuave}` }}
            >
                <span className="shrink-0 text-[13px] font-medium" style={{ color: C.apagado }}>{c.rotulo}</span>
                {c.pastilla ? (
                    <span
                        className="inline-flex items-center h-6 px-2.5 rounded-full text-[12px] font-semibold whitespace-nowrap"
                        style={{ background: c.pastilla.fondo, color: c.pastilla.tinta }}
                    >
                        {c.valor}
                    </span>
                ) : (
                    <span className="min-w-0 text-right text-[13.5px] font-semibold" style={{ color: C.tinta, overflowWrap: 'anywhere' }}>
                        {c.valor}
                    </span>
                )}
            </div>
        ))}
    </div>
);

export default HojaDetalle;
