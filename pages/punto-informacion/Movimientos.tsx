import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { MovementType } from '../../types';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, Trash2, Plus } from 'lucide-react';

const Movements: React.FC = () => {
    const navigate = useNavigate();
    const { movements, deleteMovement, showNotification } = useStore();

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        await deleteMovement(id);
        showNotification('Movimiento eliminado y stock revertido.');
    };

    return (
        <div className="animate-fadeIn p-1">
            <div className="flex items-center justify-between mb-6 border-b border-slate-200 pb-3">
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Historial de movimientos</h2>
                <button
                    onClick={() => navigate('/punto-de-informacion/movimientos/nuevo')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-black text-white font-bold uppercase text-xs tracking-widest rounded-lg hover:bg-slate-800 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo movimiento
                </button>
            </div>

            <div className="space-y-3">
                {[...movements].reverse().map(m => (
                    <div key={m.id} className="bg-white p-4 border border-slate-200 rounded-lg flex justify-between items-center shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg ${m.type === MovementType.IN ? 'bg-emerald-50 text-emerald-600' :
                                m.type === MovementType.OUT ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                                }`}>
                                {m.type === MovementType.IN ? <ArrowUpRight className="w-6 h-6" /> :
                                    m.type === MovementType.OUT ? <ArrowDownLeft className="w-6 h-6" /> : <RefreshCw className="w-6 h-6" />}
                            </div>
                            <div>
                                <h4 className="font-black text-lg text-slate-900 uppercase tracking-tight">{m.productName}</h4>
                                <p className="text-xs font-medium text-slate-500 uppercase">{new Date(m.date).toLocaleString()}</p>
                                {m.paymentMethod && (
                                    <p className="text-[10px] font-bold text-slate-600 uppercase mt-0.5 bg-slate-100 inline-block px-2 py-0.5 rounded-full">
                                        💳 {m.paymentMethod}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <span className="font-black text-3xl font-mono tabular-nums text-slate-900">{m.quantity}</span>
                            <button
                                type="button"
                                onClick={(e) => handleDelete(m.id, e)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 transition-colors"
                                title="Eliminar Registro"
                            >
                                <Trash2 className="w-5 h-5 pointer-events-none" />
                            </button>
                        </div>
                    </div>
                ))}
                {movements.length === 0 && (
                    <div className="p-12 text-center border border-dashed border-slate-200 rounded-lg bg-white">
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Sin movimientos registrados</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Movements;
