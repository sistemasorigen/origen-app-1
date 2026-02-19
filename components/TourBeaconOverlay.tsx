import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowUp, ArrowDown, ArrowRight } from 'lucide-react';

interface TourBeaconOverlayProps {
    isVisible: boolean;
    targetId: string; // The ID of the element to point to (e.g., "hamburger-menu-btn")
    onClick?: () => void; // Optional: Handler for clicking the overlay/beacon
}

const TourBeaconOverlay: React.FC<TourBeaconOverlayProps> = ({ isVisible, targetId, onClick }) => {
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    // Track the target element's position
    useEffect(() => {
        if (!isVisible) return;

        const updatedRect = () => {
            const el = document.getElementById(targetId);
            if (el) {
                setTargetRect(el.getBoundingClientRect());
            }
        };

        updatedRect();
        window.addEventListener('resize', updatedRect);
        window.addEventListener('scroll', updatedRect, true);

        return () => {
            window.removeEventListener('resize', updatedRect);
            window.removeEventListener('scroll', updatedRect, true);
        };
    }, [isVisible, targetId]);

    if (!isVisible || !targetRect) return null;

    // Calculate position for the arrow (adjust based on where the menu is usually located - top left)
    // For hamburger menu, it's usually top-left, so we want the arrow to point TOP-LEFT or LEFT.
    // Let's position the arrow to the right of the target, pointing Left.

    // Default strategy: Point to the bottom-right corner of the element 
    const arrowX = targetRect.right + 20;
    const arrowY = targetRect.bottom + 20;

    return createPortal(
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    className="fixed inset-0 z-[9999] pointer-events-none" // pointer-events-none allows clicking through to the target? 
                // Wait, user wants to "touch that purple dot". So the dot itself (the target) must be clickable.
                // But we want an overlay "darkening the background". 
                // If we darken the background, we block clicks unless we use a mask or detailed z-index manipulation.
                // Easier approach: Dark overlay with a "hole" or just allow clicks on the overlay to trigger the tour?
                // "tocá ese punto violeta" -> Touch THE DOT.
                // So we must NOT block the dot.
                >
                    {/* Dark Overlay with "Hole" using clip-path or simple opacity */}
                    {/* Since clip-path with dynamic coords is complex, let's use a semi-transparent overlay that ignored pointer events for the target area? */}
                    {/* Actually, let's just make a dark overlay that DOES NOT cover the target? Hard. */}

                    {/* Alternative: A full screen dark overlay that IS clickable and dismisses/starts the tour? */}
                    {/* User said: "tocar ese punto violeta". So interaction is with the element. */}
                    {/* Let's try a backdrop that has `pointer-events: none` but visual darkness. */}
                    {/* BUT that would darken the target too. */}

                    {/* To highlight the target, we usually use a high z-index on the target relative to the overlay. */}
                    {/* We can't easily change the target's z-index from here without potential side effects. */}

                    {/* Let's use a SVG mask overlay approach for perfectly "cutting out" the target */}
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }}>
                        <svg width="100%" height="100%">
                            <defs>
                                <mask id="hole-mask">
                                    <rect width="100%" height="100%" fill="white" />
                                    {/* The Hole */}
                                    <circle cx={targetRect.left + targetRect.width / 2} cy={targetRect.top + targetRect.height / 2} r={Math.max(targetRect.width, targetRect.height) / 1.5 + 5} fill="black" />
                                </mask>
                            </defs>
                            <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#hole-mask)" />
                        </svg>
                    </div>

                    {/* Animated Arrow */}
                    <motion.div
                        className="fixed text-white font-bold text-lg flex flex-col items-center gap-2 z-[9999]"
                        style={{
                            left: targetRect.left + 50, // Slightly to the right
                            top: targetRect.top + 60, // Below
                        }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            animate={{ x: [-5, 5, -5], y: [-5, 5, -5] }} // Wiggle
                            transition={{ repeat: Infinity, duration: 2 }}
                        >
                            <ArrowLeft className="w-12 h-12 text-white -rotate-45" strokeWidth={3} />
                        </motion.div>
                        <span className="bg-indigo-600/90 px-3 py-1 rounded-full text-sm shadow-xl backdrop-blur-sm">
                            ¡Empieza por aquí!
                        </span>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default TourBeaconOverlay;
