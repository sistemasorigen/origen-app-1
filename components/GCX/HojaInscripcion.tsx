import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, PanInfo, useReducedMotion } from 'framer-motion';

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
    const [isMobile, setIsMobile] = useState(false);
    const [arrastrando, setArrastrando] = useState(false);
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
    useEffect(() => {
        if (!isOpen) return;
        const scrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
        document.body.style.overflowY = 'scroll';
        document.body.setAttribute('data-modal-active', 'true');
        return () => {
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            document.body.style.overflowY = '';
            document.body.removeAttribute('data-modal-active');
            window.scrollTo({ top: scrollY, behavior: 'instant' as ScrollBehavior });
        };
    }, [isOpen]);

    const onDragEnd = (_: unknown, info: PanInfo) => {
        if (isMobile && info.offset.y > 100) onClose();
    };

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
                        initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.97 }}
                        animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1 }}
                        exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.97 }}
                        transition={transicion}
                        onClick={(e) => e.stopPropagation()}
                        drag={isMobile && arrastrando ? 'y' : false}
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={0.25}
                        dragMomentum={false}
                        onDragEnd={onDragEnd}
                    >
                        {/* Agarradera: solo desde acá se arrastra, para no
                            secuestrar el scroll del contenido. */}
                        {isMobile && (
                            <div
                                className="flex flex-none cursor-grab justify-center pb-0.5 pt-2.5 active:cursor-grabbing"
                                onPointerDown={() => setArrastrando(true)}
                                onPointerUp={() => setArrastrando(false)}
                                onPointerCancel={() => setArrastrando(false)}
                            >
                                <span className="h-[5px] w-[42px] rounded-full bg-[#DCDCDE] dark:bg-[#3A3A3E]" />
                            </div>
                        )}
                        {children}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default HojaInscripcion;
