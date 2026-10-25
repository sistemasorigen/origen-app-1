import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useBloqueoDeFondo } from '../../hooks/useBloqueoDeFondo';

interface ModalActualizacionProps {
    onConfirm: () => void;
    /**
     * Seguir con la versión vieja. Sólo se ofrece cuando la actualización ya
     * falló: ahí "Probar de nuevo" vuelve a traer el mismo bundle viejo, y
     * sin esta salida la app quedaría tapada sin forma de usarla.
     */
    onPosponer: () => void;
    /** Un reload anterior ya se intentó y volvió con la misma versión. */
    fallido?: boolean;
}

const ModalActualizacion: React.FC<ModalActualizacionProps> = ({ onConfirm, onPosponer, fallido = false }) => {
    // Siempre visible mientras está montado: bloquea desde que aparece.
    useBloqueoDeFondo(true);
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
                    {fallido ? 'No pudimos traer la versión nueva' : 'Hay una actualización disponible'}
                </h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                    {fallido
                        ? 'Lo intentamos varias veces y el servidor sigue entregando la anterior. Podés seguir usando esta: si algo se ve raro, probá de nuevo más tarde.'
                        : 'Origen App se actualizó. Refrescá la página para pasar a la versión nueva.'}
                </p>
                <button
                    onClick={handleConfirm}
                    disabled={reloading}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-black text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-60"
                >
                    <RefreshCw className={`w-4 h-4 ${reloading ? 'animate-spin' : ''}`} />
                    {reloading ? 'Actualizando...' : fallido ? 'Probar de nuevo' : 'Actualizar ahora'}
                </button>
                {/* Con una versión nueva no hay "ahora no": se actualiza. La
                    salida queda sólo cuando el reload ya se probó y el
                    servidor sigue entregando la anterior. */}
                {fallido && (
                    <button
                        onClick={onPosponer}
                        disabled={reloading}
                        className="w-full py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-60"
                    >
                        Seguir usando esta versión
                    </button>
                )}
            </div>
        </div>
    );
};

export default ModalActualizacion;
