import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface ModalActualizacionProps {
    onConfirm: () => void;
}

const ModalActualizacion: React.FC<ModalActualizacionProps> = ({ onConfirm }) => {
    const [reloading, setReloading] = useState(false);

    const handleConfirm = () => {
        setReloading(true);
        onConfirm();
    };

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="modal-actualizacion-titulo"
        >
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 text-center space-y-4">
                <img src="/origen-logo-full.png" alt="Origen" className="h-8 mx-auto object-contain" />
                <h2 id="modal-actualizacion-titulo" className="text-lg font-bold text-slate-900">
                    Hay una actualización disponible
                </h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                    Origen App se actualizó. Necesitás refrescar la página para seguir usándola
                    sin errores.
                </p>
                <button
                    onClick={handleConfirm}
                    disabled={reloading}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-black text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-60"
                >
                    <RefreshCw className={`w-4 h-4 ${reloading ? 'animate-spin' : ''}`} />
                    {reloading ? 'Actualizando...' : 'Actualizar ahora'}
                </button>
            </div>
        </div>
    );
};

export default ModalActualizacion;
