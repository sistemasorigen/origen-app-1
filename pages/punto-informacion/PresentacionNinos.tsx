import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { PendingStatus, ChildPresentation } from '../../types';
import { Baby, CheckSquare, Trash2, Edit2, Plus, CalendarDays, CheckCircle2 } from 'lucide-react';

const ChildPresentations: React.FC = () => {
    const navigate = useNavigate();
    const { presentations, updatePresentation, deletePresentation, showNotification } = useStore();

    const toggleStatus = async (p: ChildPresentation, status: PendingStatus) => {
        const updateData: any = { ...p, status, isPending: status === PendingStatus.PENDING ? 1 : 0 };
        if (status === PendingStatus.COMPLETED) {
            updateData.completionDate = new Date().toISOString();
        }
        await updatePresentation(updateData);
        showNotification('Estado actualizado correctamente.');
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm('¿Eliminar este registro de presentación? Esta acción no se puede deshacer.')) return;
        await deletePresentation(id);
        showNotification('Registro eliminado.');
    };

    return (
        <div className="animate-fadeIn p-1">
            <div className="flex items-center justify-between mb-6 border-b border-slate-200 pb-3">
                <h2 className="font-black text-xl text-slate-900 uppercase tracking-tight flex items-center gap-2">
                    <Baby className="w-5 h-5 text-slate-400" />
                    Agenda de presentaciones
                </h2>
                <button
                    onClick={() => navigate('/punto-de-informacion/presentacion-ninos/nuevo')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-black text-white font-bold uppercase text-xs tracking-widest rounded-lg hover:bg-slate-800 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nueva presentación
                </button>
            </div>

            <div className="space-y-3">
                {presentations.map(p => (
                    <div key={p.id} className={`p-5 border border-slate-200 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-sm gap-4 transition-shadow hover:shadow-md ${p.isPending ? 'bg-white' : 'bg-slate-50'}`}>
                        <div>
                            <h4 className="font-black text-xl text-slate-900 uppercase tracking-tight mb-1">{p.childName} {p.childSurname}</h4>
                            <div className="text-sm font-medium text-slate-600 space-y-1 pl-2 border-l-2 border-slate-200">
                                <p>Mamá: {p.motherName} {p.motherSurname}</p>
                                <p>Papá: {p.fatherName} {p.fatherSurname}</p>
                                <p className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full inline-block">{p.email} • {p.phone}</p>
                            </div>
                            {p.isPending && p.scheduledDate && (
                                <div className="flex items-center gap-3 mt-3">
                                    <span className="inline-flex items-center gap-1 text-xs font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-full"><CalendarDays className="w-3 h-3" /> Agendado: {new Date(p.scheduledDate).toLocaleDateString()}</span>
                                </div>
                            )}
                            {p.completionDate && (
                                <div className="flex items-center gap-3 mt-3">
                                    <span className="inline-flex items-center gap-1 text-xs font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-full"><CheckCircle2 className="w-3 h-3" /> Realizado: {new Date(p.completionDate).toLocaleDateString()}</span>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-1.5 items-center self-end sm:self-center">
                            {p.isPending ? (
                                <>
                                    <button onClick={() => toggleStatus(p, PendingStatus.COMPLETED)} className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-colors" title="Marcar realizado" aria-label={`Marcar presentación de ${p.childName} ${p.childSurname} como realizada`}><CheckSquare className="w-5 h-5" /></button>
                                    <button onClick={() => navigate(`/punto-de-informacion/presentacion-ninos/nuevo?id=${p.id}`)} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-black hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors" title="Editar" aria-label={`Editar ${p.childName} ${p.childSurname}`}><Edit2 className="w-5 h-5" /></button>
                                    <button type="button" onClick={(e) => handleDelete(p.id, e)} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 transition-colors" aria-label={`Eliminar ${p.childName} ${p.childSurname}`}><Trash2 className="w-5 h-5 pointer-events-none" /></button>
                                </>
                            ) : (
                                <>
                                    <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full border ${p.status === PendingStatus.COMPLETED ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{p.status}</span>
                                    <button type="button" onClick={(e) => handleDelete(p.id, e)} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" aria-label={`Eliminar ${p.childName} ${p.childSurname}`}><Trash2 className="w-4 h-4 pointer-events-none" /></button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
                {presentations.length === 0 && (
                    <div className="p-12 text-center border border-dashed border-slate-200 rounded-lg bg-white">
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No hay presentaciones agendadas</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChildPresentations;
