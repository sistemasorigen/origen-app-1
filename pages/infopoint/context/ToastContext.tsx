import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, AlertCircle, Info, X } from 'lucide-react';
import { safeUUID } from '../../../services/uuidUtils';

// --- Types ---
type ToastType = 'SUCCESS' | 'ERROR' | 'NEUTRAL';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    toast: {
        success: (message: string) => void;
        error: (message: string) => void;
        neutral: (message: string) => void;
    };
}

// --- Context ---
const ToastContext = createContext<ToastContextType | undefined>(undefined);

// --- Hook ---
export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context.toast;
};

// --- Toast Item Component (Handles Animation) ---
const ToastItem = ({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        // Trigger Entrance
        const enterTimer = requestAnimationFrame(() => setIsVisible(true));

        // Schedule Auto-Dismiss
        const dismissTimer = setTimeout(() => {
            handleDismiss();
        }, 3000);

        return () => {
            cancelAnimationFrame(enterTimer);
            clearTimeout(dismissTimer);
        };
    }, []);

    const handleDismiss = () => {
        setIsExiting(true);
        setIsVisible(false); // Trigger exit styles
        // Wait for animation to finish before removing from DOM
        setTimeout(() => {
            onRemove(toast.id);
        }, 300); // Matches duration-300
    };

    // Styling based on Type
    const getStyles = () => {
        switch (toast.type) {
            case 'SUCCESS':
                return {
                    borderColor: 'border-black',
                    textColor: 'text-[#118f46]', // Success Green
                    icon: <Check className="w-5 h-5 text-[#118f46]" strokeWidth={3} />
                };
            case 'ERROR':
                return {
                    borderColor: 'border-black',
                    textColor: 'text-red-600', // Error Red
                    icon: <AlertCircle className="w-5 h-5 text-red-600" strokeWidth={3} />
                };
            default:
                return {
                    borderColor: 'border-black',
                    textColor: 'text-black',
                    icon: <Info className="w-5 h-5 text-black" strokeWidth={3} />
                };
        }
    };

    const styles = getStyles();

    return (
        <div
            className={`
                pointer-events-auto
                flex items-center gap-3
                bg-white
                border-2 ${styles.borderColor}
                shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                px-4 py-3
                min-w-[300px] max-w-[90vw]
                transform transition-all duration-300 ease-out
                ${isVisible && !isExiting ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}
            `}
            role="alert"
        >
            <div className="flex-shrink-0">
                {styles.icon}
            </div>
            <p className={`flex-1 text-xs font-bold uppercase tracking-wide ${styles.textColor}`}>
                {toast.message}
            </p>
            <button
                onClick={handleDismiss}
                className="text-neutral-400 hover:text-black transition-colors"
                aria-label="Cerrar notificación"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

// --- Container (Handles Positioning) ---
const ToastContainer = ({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) => {
    return (
        <div className="fixed z-[9999] pointer-events-none flex flex-col gap-3
            /* Mobile: Top Center (below header) */
            top-4 left-1/2 -translate-x-1/2
            /* Desktop: Bottom Right */
            md:top-auto md:left-auto md:bottom-8 md:right-8 md:translate-x-0
        ">
            {toasts.map(t => (
                <ToastItem key={t.id} toast={t} onRemove={removeToast} />
            ))}
        </div>
    );
};

// --- Provider ---
export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: ToastType) => {
        const id = safeUUID();
        setToasts(prev => {
            // Stack max 3, remove oldest if needed
            const newToasts = [...prev, { id, message, type }];
            if (newToasts.length > 3) newToasts.shift();
            return newToasts;
        });
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const toast = {
        success: (msg: string) => addToast(msg, 'SUCCESS'),
        error: (msg: string) => addToast(msg, 'ERROR'),
        neutral: (msg: string) => addToast(msg, 'NEUTRAL'),
    };

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            {typeof window !== 'undefined' && createPortal(
                <ToastContainer toasts={toasts} removeToast={removeToast} />,
                document.body
            )}
        </ToastContext.Provider>
    );
};
