import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { PendingStatus, Baptism } from '../../types';
import { Droplets, CheckSquare, Trash2, Edit2, Plus } from 'lucide-react';

const Baptisms: React.FC = () => {
    const navigate = useNavigate();
    const { baptisms, updateBaptism, deleteBaptism, showNotification } = useStore();

    const toggleStatus = async (b: Baptism, status: PendingStatus) => {
        const updateData: any = { ...b, status, isPending: status === PendingStatus.PENDING ? 1 : 0 };
        if (status === PendingStatus.COMPLETED) {
            updateData.completionDate = new Date().toISOString();
        }
        await updateBaptism(updateData);
        showNotification('Estado actualizado correctamente.');
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        await deleteBaptism(id);
        showNotification('Registro eliminado.');
    };

    return (
        <div className="animate-fadeIn p-1">
            <div className="flex items-center justify-between mb-6 border-b border-slate-200 pb-3">
                <h2 className="font-black text-xl text-slate-900 uppercase tracking-tight flex items-center gap-2">
                    <Droplets className="w-5 h-5 text-slate-400" />
                    Lista de bautismos
                </h2>
                <button
                    onClick={() => navigate('/punto-de-informacion/bautismos/nuevo')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-black text-white font-bold uppercase text-xs tracking-widest rounded-lg hover:bg-slate-800 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo bautismo
                </button>
            </div>

            <div className="space-y-3">
                {baptisms.map(b => (
                    <div key={b.id} className={`p-5 border border-slate-200 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center shadow-sm gap-4 transition-shadow hover:shadow-md ${b.isPending ? 'bg-white' : 'bg-slate-50'}`}>
                        <div>
                            <h4 className="font-black text-lg text-slate-900 uppercase tracking-tight">{b.firstName} {b.lastName}</h4>
                            <p className="text-sm font-medium text-slate-600">{b.email} • {b.phone}</p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-2 py-1 rounded-full">Anotado: {new Date(b.registrationDate).toLocaleDateString()}</span>
                                {b.completionDate && (
                                    <span className="text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-full">Realizado: {new Date(b.completionDate).toLocaleDateString()}</span>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-1.5 items-center w-full md:w-auto justify-end">
                            {b.isPending ? (
                                <>
                                    <button onClick={() => toggleStatus(b, PendingStatus.COMPLETED)} className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-colors" title="Marcar Realizado"><CheckSquare className="w-5 h-5" /></button>
                                    <button onClick={() => navigate(`/punto-de-informacion/bautismos/nuevo?id=${b.id}`)} className="p-2 text-slate-400 hover:text-black hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors" title="Editar"><Edit2 className="w-5 h-5" /></button>
                                    <button type="button" onClick={(e) => handleDelete(b.id, e)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 transition-colors"><Trash2 className="w-5 h-5 pointer-events-none" /></button>
                                </>
                            ) : (
                                <>
                                    <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full border ${b.status === PendingStatus.COMPLETED ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{b.status}</span>
                                    <button type="button" onClick={(e) => handleDelete(b.id, e)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4 pointer-events-none" /></button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
                {baptisms.length === 0 && (
                    <div className="p-12 text-center border border-dashed border-slate-200 rounded-lg bg-white">
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No hay registros</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Baptisms;
