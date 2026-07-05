import React, { createContext, useContext, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// ── Toast Context ─────────────────────────────
interface ToastContextValue {
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useAdminGCXToast = (): ToastContextValue => {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error('useAdminGCXToast debe usarse dentro de AdminGCXLayout');
    }
    return ctx;
};

interface AdminGCXLayoutProps {
    title: string;
    children: React.ReactNode;
    backTo?: string;
    backLabel?: string;
}

const AdminGCXLayout: React.FC<AdminGCXLayoutProps> = ({ title, children, backTo = '/gcx', backLabel = 'Volver a GCX' }) => {
    const navigate = useNavigate();

    const [notification, setNotification] = useState<{
        show: boolean;
        message: string;
        type: 'success' | 'error' | 'info';
    }>({ show: false, message: '', type: 'success' });

    const showToast = useCallback((
        message: string,
        type: 'success' | 'error' | 'info' = 'success'
    ) => {
        setNotification({ show: true, message, type });
        setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 3000);
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            <div className="min-h-screen bg-slate-50">
                <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">

                    {/* Header */}
                    <div className="mb-6">
                        <button
                            onClick={() => navigate(backTo)}
                            className="flex items-center gap-2 text-sm text-slate-400 hover:text-black transition-colors mb-4 font-bold uppercase tracking-wide"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            {backLabel}
                        </button>
                        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-black">
                            {title}
                        </h1>
                    </div>

                    {/* Contenido de la sección */}
                    <div>
                        {children}
                    </div>
                </div>

                {/* Toast */}
                {notification.show && (
                    <div className={`fixed bottom-4 right-4 z-50 px-6 py-3 rounded-lg shadow-xl text-white font-bold uppercase tracking-wide animate-fade-in-up ${
                        notification.type === 'error' ? 'bg-red-600' :
                        notification.type === 'info' ? 'bg-blue-600' : 'bg-[#118f46]'
                    }`}>
                        {notification.message}
                    </div>
                )}
            </div>
        </ToastContext.Provider>
    );
};

export default AdminGCXLayout;
