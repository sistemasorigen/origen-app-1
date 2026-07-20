import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { Loan } from '../../types';
import { Shirt, CheckCircle, Trash2, Clock, Plus } from 'lucide-react';

const Loans: React.FC = () => {
    const navigate = useNavigate();
    const { loans, updateLoan, deleteLoan, showNotification } = useStore();

    const handleReturn = async (loan: Loan) => {
        try {
            await updateLoan({
                ...loan,
                status: 'RETURNED',
                returnDate: new Date().toISOString()
            });
            showNotification('Devolución registrada correctamente.');
        } catch (error) {
            console.error("Error updating loan:", error);
            showNotification('Error al registrar devolución', 'error');
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        await deleteLoan(id);
        showNotification('Registro eliminado.');
    };

    const activeLoans = loans.filter(l => l.status === 'ACTIVE');
    const returnedLoans = loans.filter(l => l.status === 'RETURNED');

    return (
        <div className="animate-fadeIn p-1 space-y-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h2 className="font-black text-xl text-slate-900 uppercase tracking-tight flex items-center gap-2">
                    <Shirt className="w-5 h-5 text-slate-400" />
                    Préstamos activos
                </h2>
                <button
                    onClick={() => navigate('/punto-de-informacion/prestamos/nuevo')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-black text-white font-bold uppercase text-xs tracking-widest rounded-lg hover:bg-slate-800 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo préstamo
                </button>
            </div>

            <div className="space-y-3">
                {activeLoans.map(l => (
                    <div key={l.id} className="bg-white p-5 border border-slate-200 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-sm hover:shadow-md transition-shadow">
                        <div>
                            <h4 className="font-black text-lg text-slate-900 uppercase tracking-tight">{l.lenderName} {l.lenderSurname}</h4>
                            <p className="text-sm font-medium text-slate-600 uppercase tracking-wide border-l-2 border-slate-200 pl-2 mt-1">{l.itemType} Talle {l.itemSize}</p>
                            <p className="text-xs text-slate-600 bg-slate-100 font-bold uppercase inline-block px-2 py-0.5 rounded-full mt-2">Prestado: {new Date(l.loanDate).toLocaleDateString()} {new Date(l.loanDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <div className="flex gap-2 items-center mt-3 sm:mt-0 w-full sm:w-auto justify-end">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleReturn(l);
                                }}
                                className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold text-xs uppercase hover:bg-emerald-600 hover:text-white hover:border-emerald-600 flex items-center gap-2 transition-colors"
                            >
                                <CheckCircle className="w-4 h-4" /> Devolver
                            </button>
                            <button
                                type="button"
                                onClick={(e) => handleDelete(l.id, e)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 transition-colors"
                                title="Eliminar"
                            >
                                <Trash2 className="w-4 h-4 pointer-events-none" />
                            </button>
                        </div>
                    </div>
                ))}
                {activeLoans.length === 0 && (
                    <div className="p-12 text-center border border-dashed border-slate-200 rounded-lg bg-white">
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No hay préstamos activos</p>
                    </div>
                )}
            </div>

            <div>
                <h2 className="font-black text-base text-slate-500 uppercase tracking-tight mb-4">Historial de devoluciones</h2>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {returnedLoans.slice().reverse().map(l => (
                        <div key={l.id} className="bg-white p-3 flex justify-between items-center border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                            <div>
                                <span className="font-bold text-sm uppercase text-slate-700">{l.lenderName} {l.lenderSurname}</span>
                                <span className="text-xs font-medium text-slate-400 ml-2 border-l-2 border-slate-200 pl-2">{l.itemType} {l.itemSize}</span>
                                {l.returnDate && (
                                    <div className="text-[10px] text-emerald-700 font-bold uppercase flex items-center gap-1 mt-1">
                                        <Clock className="w-3 h-3" /> Devuelto: {new Date(l.returnDate).toLocaleDateString()}
                                    </div>
                                )}
                            </div>
                            <button onClick={(e) => handleDelete(l.id, e)} className="text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors p-2 cursor-pointer">
                                <Trash2 className="w-4 h-4 pointer-events-none" />
                            </button>
                        </div>
                    ))}
                    {returnedLoans.length === 0 && <p className="text-xs font-bold text-slate-300 uppercase">Sin historial</p>}
                </div>
            </div>
        </div>
    );
};

export default Loans;
