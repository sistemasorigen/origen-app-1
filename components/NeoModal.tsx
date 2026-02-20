import React, { useEffect, useState, ReactNode } from 'react';
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

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Body Scroll Lock & Focus Mode
    useEffect(() => {
        if (disableScrollLock) return;

        if (isOpen) {
            document.body.style.overflow = 'hidden';
            document.body.setAttribute('data-modal-active', 'true');
        } else {
            document.body.style.overflow = 'unset';
            document.body.removeAttribute('data-modal-active');
        }
        return () => {
            document.body.style.overflow = 'unset';
            document.body.removeAttribute('data-modal-active');
        };
    }, [isOpen]);

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
                                    ? 'rounded-t-2xl max-h-[90vh]'
                                    : 'rounded-xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-[90vh]'
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
                            drag={isMobile && !persistent ? "y" : false}
                            dragConstraints={{ top: 0, bottom: 0 }}
                            dragElastic={0.1}
                            onDragEnd={handleDragEnd}
                        >
                            {/* MOBILE DRAG HANDLE */}
                            {isMobile && (
                                <div className="w-full flex justify-center pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing">
                                    <div className="w-16 h-1.5 bg-neutral-300 rounded-full" />
                                </div>
                            )}

                            {/* HEADER */}
                            <div className={`flex items-center justify-between shrink-0 ${isMobile ? 'px-6 pt-2 pb-4' : 'px-6 pt-6 pb-4'}`}>
                                {title && (
                                    <h2 className="text-xl font-black uppercase tracking-tight text-black">
                                        {title}
                                    </h2>
                                )}
                                {!persistent && (
                                    <button
                                        onClick={onClose}
                                        className="p-1 hover:bg-black hover:text-white rounded-md transition-colors"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                )}
                            </div>

                            {/* BODY */}
                            <div id="neo-modal-scroll-container" className={`flex-1 overflow-y-auto overflow-x-hidden ${isMobile ? 'px-6 pb-8' : 'px-6 pb-6'}`}>
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
