import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useBloqueoDeFondo } from '../../hooks/useBloqueoDeFondo';

/**
 * Contenedor de los modales de inscripción (design-claude/JoinFlow).
 *
 * En mobile no es un modal: es una hoja que sube desde abajo, con agarradera
 * y arrastre para cerrar. Así el teclado no la rompe cuando se abre sobre un
 * campo. En escritorio es un modal centrado de 520px.
 *
 * El bloqueo de scroll usa la misma técnica que NeoModal (position:fixed en el
 * body en vez de overflow:hidden), que es la que funciona en iOS Safari.
 */
interface HojaInscripcionProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    /** id del título, para que el lector de pantalla anuncie el diálogo */
    labelledBy?: string;
}

const HojaInscripcion: React.FC<HojaInscripcionProps> = ({ isOpen, onClose, children, labelledBy }) => {
    /**
     * Se mide en el PRIMER render, no en un efecto.
     *
     * Arrancando en `false`, en un teléfono pasaba esto: el panel montaba con
     * el `initial` de escritorio (`opacity: 0`) y empezaba a aparecer; el
     * efecto corría enseguida, `isMobile` pasaba a true, y el `animate` se
     * volvía `{ y: 0 }` — sin `opacity`. La opacidad quedaba varada a mitad de
     * camino, casi en cero: una hoja invisible sobre el velo, que igual se
     * comía los clicks y no dejaba inscribirse.
     */
    const [isMobile, setIsMobile] = useState(
        () => typeof window !== 'undefined' && window.innerWidth < 768
    );
    const contenedorRef = useRef<HTMLDivElement>(null);
    const focoPrevioRef = useRef<HTMLElement | null>(null);
    const sinMovimiento = useReducedMotion();

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    // Escape cierra, y al cerrar vuelve el foco a donde estaba.
    useEffect(() => {
        if (!isOpen) return;
        focoPrevioRef.current = document.activeElement as HTMLElement;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('keydown', onKey);
            focoPrevioRef.current?.focus?.();
        };
    }, [isOpen, onClose]);

    // Body scroll lock compatible con iOS Safari: se fija el body en su
    // posición actual y se restaura el scroll al cerrar.
    useBloqueoDeFondo(isOpen);

    if (typeof document === 'undefined') return null;

    const transicion = sinMovimiento
        ? { duration: 0 }
        : { type: 'spring' as const, damping: 34, stiffness: 340 };

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-[120] flex items-end justify-center md:items-center md:p-4"
                    style={{ background: isMobile ? 'rgba(10,10,10,.42)' : 'rgba(10,10,10,.5)' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: sinMovimiento ? 0 : 0.2 }}
                    onClick={onClose}
                >
                    <motion.div
                        ref={contenedorRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={labelledBy}
                        id="gcx-inscripcion"
                        className="relative flex w-full flex-col overflow-hidden bg-white md:w-[520px] dark:bg-[#17171A]"
                        style={{
                            borderRadius: isMobile ? '28px 28px 0 0' : '28px',
                            maxHeight: isMobile ? '92vh' : '90vh',
                            boxShadow: '0 18px 60px rgba(10,10,10,.28)',
                        }}
                        /* La opacidad va explícita en los tres keyframes de
                           mobile aunque ahí la hoja no se desvanezca: si el
                           modo cambia a mitad de una animación —girar el
                           teléfono, por ejemplo— el destino nuevo tiene que
                           llevar la hoja a opacidad 1 igual. Sin esto queda
                           donde la dejó la animación anterior. */
                        initial={isMobile ? { y: '100%', opacity: 1 } : { opacity: 0, scale: 0.97 }}
                        animate={isMobile ? { y: 0, opacity: 1 } : { opacity: 1, scale: 1 }}
                        exit={isMobile ? { y: '100%', opacity: 1 } : { opacity: 0, scale: 0.97 }}
                        transition={transicion}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {children}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default HojaInscripcion;
