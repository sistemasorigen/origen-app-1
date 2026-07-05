import React, { useEffect, useState, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X } from 'lucide-react';

interface NeoModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    persistent?: boolean; // If true, modal cannot be closed by user
    maxWidth?: string; // e.g. 'max-w-2xl', 'max-w-4xl'
    disableScrollLock?: boolean;
}

const NeoModal: React.FC<NeoModalProps> = ({ isOpen, onClose, title, children, persistent = false, maxWidth = 'max-w-2xl', disableScrollLock = false }) => {
    // Media Query for Responsive Animations
    const [isMobile, setIsMobile] = useState(false);

    const [isDraggingFromHandle, setIsDraggingFromHandle] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Body Scroll Lock — compatible con iOS Safari
    // Técnica: guardar scrollY → fijar body con
    // position:fixed → restaurar al cerrar.
    // Esto evita el congelamiento de scroll interno
    // que causa overflow:hidden en iOS.
    useEffect(() => {
        if (disableScrollLock) return;
        if (!isOpen) return;

        const scrollY = window.scrollY;

        // Fijar el body en su posición actual
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
        document.body.style.overflowY = 'scroll'; // evitar layout shift
        document.body.setAttribute('data-modal-active', 'true');

        return () => {
            // Restaurar posición y scroll
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            document.body.style.overflowY = '';
            document.body.removeAttribute('data-modal-active');
            // Volver al scroll original sin salto visual
            window.scrollTo({ top: scrollY, behavior: 'instant' as ScrollBehavior });
        };
    }, [isOpen, disableScrollLock]);

    // Animation Variants
    const backdropVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
    };

    const modalVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
        exit: { opacity: 0 }
    };

    // Drag Logic (Mobile Only)
    const handleDragEnd = (_: any, info: PanInfo) => {
        if (!persistent && isMobile && info.offset.y > 100) {
            onClose();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* BACKDROP */}
                    <motion.div
                        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" // Flexbox alignment
                        variants={backdropVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        onClick={!persistent ? onClose : undefined}
                        transition={{ duration: 0.2 }}
                    >
                        {/* MODAL CONTENT */}
                        <motion.div
                            className={`
                                relative w-full md:w-auto md:min-w-[500px] ${maxWidth}
                                bg-white !bg-white flex flex-col my-auto
                                ${isMobile
                                    ? 'rounded-3xl max-h-[90vh] shadow-2xl'
                                    : 'rounded-2xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-[90vh]'
                                }
                            `}
                            style={{ backgroundColor: 'white', opacity: 1 }} // Removed isolation: isolate
                            variants={modalVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            transition={{ duration: 0.2 }} // Simple fade, no springs to avoid transforms
                            onClick={(e) => e.stopPropagation()}
                            // Removed Drag on Desktop to guarantee no transforms
                            drag={isMobile && !persistent && isDraggingFromHandle ? "y" : false}
                            dragConstraints={{ top: 0, bottom: 0 }}
                            dragElastic={0.3}
                            dragMomentum={false}
                            onDragEnd={handleDragEnd}
                        >

                            {/* HEADER */}
                            <div className={`flex items-start justify-between shrink-0 ${isMobile ? 'px-6 pt-5 pb-2' : 'px-6 md:px-8 lg:px-10 pt-6 pb-2'}`}>
                                {title && (
                                    <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-black pr-4">
                                        {title}
                                    </h2>
                                )}
                                {!persistent && (
                                    <button
                                        onClick={onClose}
                                        className="p-1 hover:bg-slate-100 rounded-md transition-colors shrink-0 ml-auto"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                )}
                            </div>

                            {/* BODY */}
                            {/* touchAction pan-y: el browser maneja el
                                scroll vertical, Framer Motor no lo
                                intercepta. overscrollBehavior contain:
                                el scroll no se propaga al backdrop.
                                WebkitOverflowScrolling touch: momentum
                                scroll nativo en iOS Safari. */}
                            <div
                                id="neo-modal-scroll-container"
                                ref={scrollContainerRef}
                                className={`flex-1 overflow-y-auto overflow-x-hidden ${isMobile ? 'px-6 pb-8' : 'px-6 md:px-8 lg:px-10 pb-6 md:pb-8'}`}
                                style={{
                                    touchAction: 'pan-y',
                                    overscrollBehavior: 'contain',
                                    WebkitOverflowScrolling: 'touch',
                                }}
                                onPointerDown={(e) => {
                                    // Si el scroll tiene contenido scrollable,
                                    // cancelar cualquier drag activo del modal
                                    const el = scrollContainerRef.current;
                                    if (el && el.scrollHeight > el.clientHeight) {
                                        setIsDraggingFromHandle(false);
                                    }
                                }}
                            >
                                {children}
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default NeoModal;
