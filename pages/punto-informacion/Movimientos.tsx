import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { MovementType } from '../../types';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, Trash2, Plus, CreditCard } from 'lucide-react';

const Movements: React.FC = () => {
    const navigate = useNavigate();
    const { movements, deleteMovement, showNotification } = useStore();

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm('¿Eliminar este movimiento? El stock revertido no se puede deshacer.')) return;
        await deleteMovement(id);
        showNotification('Movimiento eliminado y stock revertido.');
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <div className="px-4 sm:px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 leading-tight">Historial de movimientos</h2>
                    <button
                        onClick={() => navigate('/punto-de-informacion/movimientos/nuevo')}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-black text-white font-bold uppercase text-[11px] tracking-widest rounded-lg hover:bg-slate-800 transition-colors shrink-0 flex-1 sm:flex-none whitespace-nowrap"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Nuevo movimiento
                    </button>
                </div>

                <div className="divide-y divide-slate-100">
                    {[...movements].reverse().map(m => (
                        <div key={m.id} className="p-4 sm:px-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-lg shrink-0 ${m.type === MovementType.IN ? 'bg-emerald-50 text-emerald-600' :
                                    m.type === MovementType.OUT ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                                    }`}>
                                    {m.type === MovementType.IN ? <ArrowUpRight className="w-5 h-5" /> :
                                        m.type === MovementType.OUT ? <ArrowDownLeft className="w-5 h-5" /> : <RefreshCw className="w-5 h-5" />}
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-slate-900 uppercase tracking-tight leading-tight">{m.productName}</h4>
                                    <p className="text-xs font-medium text-slate-500 uppercase mt-0.5">{new Date(m.date).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                                    {m.paymentMethod && (
                                        <p className="text-[10px] font-bold text-slate-600 uppercase mt-1.5 bg-slate-100 inline-flex items-center gap-1 px-2 py-0.5 rounded-full">
                                            <CreditCard className="w-3 h-3" /> {m.paymentMethod}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto mt-2 sm:mt-0 pl-14 sm:pl-0">
                                <span className="font-black text-2xl font-mono tabular-nums text-slate-900">
                                    {m.type === MovementType.OUT ? '-' : m.type === MovementType.IN ? '+' : ''}{m.quantity}
                                </span>
                                <button
                                    type="button"
                                    onClick={(e) => handleDelete(m.id, e)}
                                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Eliminar registro"
                                    aria-label={`Eliminar movimiento de ${m.productName}`}
                                >
                                    <Trash2 className="w-4 h-4 pointer-events-none" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {movements.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 border-t border-dashed border-slate-200 m-6">
                            <RefreshCw className="w-12 h-12 text-slate-300 mb-3" />
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm text-center">Sin movimientos registrados</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Movements;
