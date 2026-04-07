import React, { useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface PushPermissionBannerProps {
    onAllow: () => Promise<NotificationPermission>;
    onDismiss: () => void;
}

const PushPermissionBanner: React.FC<PushPermissionBannerProps> = ({ onAllow, onDismiss }) => {
    const [showDeniedMsg, setShowDeniedMsg] = useState(false);
    const [shouldRender, setShouldRender] = useState(true);

    const handleAllow = async () => {
        const result = await onAllow();
        if (result === 'granted') {
            setShouldRender(false);
        } else if (result === 'denied') {
            setShowDeniedMsg(true);
            setTimeout(() => {
                setShowDeniedMsg(false);
                onDismiss();
            }, 3000);
        }
    };

    const handleDismiss = () => {
        setShouldRender(false);
        onDismiss();
    };

    return (
        <AnimatePresence>
            {shouldRender && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                    className={`w-full border-b-2 px-4 py-3 flex items-center gap-3 z-30 relative ${
                        showDeniedMsg
                            ? 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                            : 'bg-amber-50 border-amber-300 dark:bg-zinc-800 dark:border-zinc-700'
                    }`}
                >
                    <BellRing className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />

                    <p className="flex-1 text-sm font-medium text-amber-900 dark:text-amber-200">
                        {showDeniedMsg
                            ? 'No se pudo activar. Revisá los permisos del browser.'
                            : 'Activá notificaciones para enterarte cuando alguien se inscriba a tu grupo o haya actividad importante.'}
                    </p>

                    {!showDeniedMsg && (
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={handleAllow}
                                className="px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black text-xs font-black uppercase tracking-wide rounded-lg hover:opacity-80 transition-opacity"
                            >
                                Activar
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default PushPermissionBanner;
