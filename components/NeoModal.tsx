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
}

const NeoModal: React.FC<NeoModalProps> = ({ isOpen, onClose, title, children, persistent = false, maxWidth = 'max-w-2xl' }) => {
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
        hidden: isMobile
            ? { y: "100%" } // Mobile: Slide down
            : { opacity: 0, scale: 0.95 }, // Desktop: Fade
        visible: isMobile
            ? { y: 0, opacity: 1 }
            : { opacity: 1, scale: 1 },
        exit: isMobile
            ? { y: "100%" }
            : { opacity: 0, scale: 0.95 }
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
                        className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
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
                                bg-white !bg-white z-[100] flex flex-col isolate
                                ${isMobile
                                    ? 'rounded-t-2xl max-h-[90vh]' // Mobile Sheet
                                    : 'rounded-xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-[90vh]' // Desktop Card
                                }
                            `}
                            style={{ backgroundColor: 'white', opacity: 1, isolation: 'isolate', maxHeight: '90vh' }}
                            variants={modalVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking content


                            // Gestures (Mobile Only)
                            drag={!persistent && isMobile ? "y" : false}
                            dragConstraints={{ top: 0, bottom: 0 }}
                            dragElastic={{ top: 0, bottom: 0.2 }}
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
                            <div className={`flex-1 overflow-y-auto overflow-x-hidden ${isMobile ? 'px-6 pb-8' : 'px-6 pb-6'}`}>
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
