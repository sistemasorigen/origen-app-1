import React, { useState } from 'react';
import { useStore } from '../../store';
import { Loan, ProductType, INFO_POINT_SIZES } from '../../types';
import { Shirt, CheckCircle, Trash2, Clock } from 'lucide-react';
import { safeUUID } from '../../services/uuidUtils';

const Loans: React.FC = () => {
    const { loans, addLoan, updateLoan, deleteLoan, showNotification } = useStore();
    const [form, setForm] = useState({
        lenderName: '',
        lenderSurname: '',
        itemType: ProductType.REMERA,
        itemSize: '1'
    });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await addLoan({
                id: safeUUID(),
                ...form,
                loanDate: new Date().toISOString(),
                status: 'ACTIVE'
            });
            showNotification('¡Préstamo registrado exitosamente!');
            setForm({ lenderName: '', lenderSurname: '', itemType: ProductType.REMERA, itemSize: '1' });
        } catch (error) {
            console.error(error);
            showNotification('Error al crear préstamo', 'error');
        }
    };

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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn p-1">
            <div className="lg:col-span-1">
                <div className="bg-white p-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sticky top-4">
                    <h3 className="font-black text-xl mb-6 text-black uppercase tracking-tight flex items-center gap-2 border-b-2 border-black pb-2">
                        <Shirt className="w-6 h-6 text-black" /> Nuevo Préstamo
                    </h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <input type="text" placeholder="Nombre" required value={form.lenderName} onChange={e => setForm({ ...form, lenderName: e.target.value })} className="w-full p-3 bg-white border-2 border-black rounded-lg outline-none font-bold placeholder-neutral-500 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all" />
                            <input type="text" placeholder="Apellido" required value={form.lenderSurname} onChange={e => setForm({ ...form, lenderSurname: e.target.value })} className="w-full p-3 bg-white border-2 border-black rounded-lg outline-none font-bold placeholder-neutral-500 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all" />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-black uppercase tracking-widest border-b-2 border-black mb-1 inline-block">Prenda</label>
                                <select
                                    className="w-full p-3 bg-white border-2 border-black rounded-lg outline-none font-bold focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all appearance-none cursor-pointer"
                                    value={form.itemType}
                                    onChange={e => setForm({ ...form, itemType: e.target.value as ProductType })}
                                >
                                    {Object.values(ProductType).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-black uppercase tracking-widest border-b-2 border-black mb-1 inline-block">Talle</label>
                                <select
                                    className="w-full p-3 bg-white border-2 border-black rounded-lg outline-none font-bold focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all appearance-none cursor-pointer"
                                    value={form.itemSize}
                                    onChange={e => setForm({ ...form, itemSize: e.target.value })}
                                >
                                    {INFO_POINT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        <button type="submit" className="w-full py-3 bg-black text-white font-black uppercase tracking-widest border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-white hover:text-black hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all mt-4">Prestado</button>
                    </form>
                </div>
            </div>

            <div className="lg:col-span-2 space-y-8">
                <div>
                    <h2 className="font-black text-2xl text-black uppercase tracking-tight mb-6 border-b-4 border-black inline-block pb-1">Préstamos Activos</h2>
                    <div className="space-y-4">
                        {activeLoans.map(l => (
                            <div key={l.id} className="bg-white p-5 border-2 border-black flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all">
                                <div>
                                    <h4 className="font-black text-lg text-black uppercase tracking-tight">{l.lenderName} {l.lenderSurname}</h4>
                                    <p className="text-sm font-bold text-neutral-600 uppercase tracking-wide border-l-2 border-black pl-2 mt-1">{l.itemType} Talle {l.itemSize}</p>
                                    <p className="text-xs text-white bg-black font-black uppercase inline-block px-1 mt-2">Prestado: {new Date(l.loanDate).toLocaleDateString()} {new Date(l.loanDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                                <div className="flex gap-2 items-center mt-3 sm:mt-0 w-full sm:w-auto justify-end">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleReturn(l);
                                        }}
                                        className="px-4 py-2 bg-emerald-300 text-black border-2 border-black font-black text-xs uppercase hover:bg-emerald-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2 transition-all active:translate-y-1 active:shadow-none"
                                    >
                                        <CheckCircle className="w-4 h-4" /> Devolver
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => handleDelete(l.id, e)}
                                        className="p-2 text-black bg-white border-2 border-black hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="w-4 h-4 pointer-events-none" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {activeLoans.length === 0 && (
                            <div className="p-12 text-center border-4 border-dashed border-neutral-300">
                                <p className="text-neutral-400 font-bold uppercase tracking-widest">No hay préstamos activos</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="opacity-75 hover:opacity-100 transition-opacity">
                    <h2 className="font-black text-lg text-neutral-500 uppercase tracking-tight mb-4 border-b-2 border-neutral-300 inline-block">Historial de Devoluciones</h2>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {returnedLoans.slice().reverse().map(l => (
                            <div key={l.id} className="bg-neutral-100 p-3 flex justify-between items-center border-2 border-neutral-200 hover:border-black transition-colors">
                                <div>
                                    <span className="font-black text-sm uppercase text-neutral-700">{l.lenderName} {l.lenderSurname}</span>
                                    <span className="text-xs font-bold text-neutral-400 ml-2 border-l-2 border-neutral-300 pl-2">{l.itemType} {l.itemSize}</span>
                                    {l.returnDate && (
                                        <div className="text-[10px] text-emerald-700 font-black uppercase flex items-center gap-1 mt-1">
                                            <Clock className="w-3 h-3" /> Devuelto: {new Date(l.returnDate).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                                <button onClick={(e) => handleDelete(l.id, e)} className="text-neutral-400 hover:text-red-500 transition-colors p-2 cursor-pointer">
                                    <Trash2 className="w-4 h-4 pointer-events-none" />
                                </button>
                            </div>
                        ))}
                        {returnedLoans.length === 0 && <p className="text-xs font-bold text-neutral-300 uppercase">Sin historial</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Loans;
