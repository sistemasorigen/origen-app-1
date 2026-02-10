import React, { useState } from 'react';
import { useStore } from '../../store';
import { PendingStatus, ChildPresentation } from '../../types';
import { Baby, CheckSquare, XSquare, Trash2, Edit2 } from 'lucide-react';
import { formatDateForInput, formatDateForDisplay } from '../../services/dateUtils';
import { safeUUID } from '../../services/uuidUtils';

const ChildPresentations: React.FC = () => {
    const { presentations, addPresentation, updatePresentation, deletePresentation, showNotification } = useStore();
    const [form, setForm] = useState({
        childName: '', childSurname: '',
        motherName: '', motherSurname: '',
        fatherName: '', fatherSurname: '',
        email: '', phone: ''
    });
    const [isEditing, setIsEditing] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isEditing) {
            const existing = presentations.find(p => p.id === isEditing);
            if (existing) {
                await updatePresentation({ ...existing, ...form });
                showNotification('¡Datos de presentación actualizados!');
            }
            setIsEditing(null);
        } else {
            await addPresentation({
                id: safeUUID(),
                ...form,
                isPending: 1,
                status: PendingStatus.PENDING
            });
            showNotification('¡Presentación agendada exitosamente!');
        }
        setForm({ childName: '', childSurname: '', motherName: '', motherSurname: '', fatherName: '', fatherSurname: '', email: '', phone: '' });
    };

    const handleEdit = (p: ChildPresentation) => {
        setIsEditing(p.id);
        setForm({
            childName: p.childName, childSurname: p.childSurname,
            motherName: p.motherName, motherSurname: p.motherSurname,
            fatherName: p.fatherName, fatherSurname: p.fatherSurname,
            email: p.email, phone: p.phone
        });
    };

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
        await deletePresentation(id);
        showNotification('Registro eliminado.');
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn p-1">
            <div className="lg:col-span-1">
                <div className="bg-white p-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sticky top-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <h3 className="font-black text-xl mb-6 text-black uppercase tracking-tight flex items-center gap-2 border-b-2 border-black pb-2">
                        <Baby className="w-6 h-6 text-black" /> {isEditing ? 'Editar Presentación' : 'Nueva Presentación'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Child */}
                        <div className="space-y-1 border-b-2 border-dashed border-neutral-300 pb-2">
                            <label className="text-xs font-black text-black uppercase tracking-widest bg-yellow-200 px-1">Datos del Niño/a</label>
                            <div className="grid grid-cols-2 gap-2 mt-1">
                                <input type="text" placeholder="Nombre" required value={form.childName} onChange={e => setForm({ ...form, childName: e.target.value })} className="w-full p-2 bg-white border-2 border-black rounded-lg outline-none font-bold text-sm focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all" />
                                <input type="text" placeholder="Apellido" required value={form.childSurname} onChange={e => setForm({ ...form, childSurname: e.target.value })} className="w-full p-2 bg-white border-2 border-black rounded-lg outline-none font-bold text-sm focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all" />
                            </div>
                        </div>

                        {/* Mother */}
                        <div className="space-y-1">
                            <label className="text-xs font-black text-neutral-500 uppercase tracking-widest">Madre</label>
                            <div className="grid grid-cols-2 gap-2">
                                <input type="text" placeholder="Nombre" value={form.motherName} onChange={e => setForm({ ...form, motherName: e.target.value })} className="w-full p-2 bg-white border-2 border-black rounded-lg outline-none font-bold text-sm focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all" />
                                <input type="text" placeholder="Apellido" value={form.motherSurname} onChange={e => setForm({ ...form, motherSurname: e.target.value })} className="w-full p-2 bg-white border-2 border-black rounded-lg outline-none font-bold text-sm focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all" />
                            </div>
                        </div>

                        {/* Father */}
                        <div className="space-y-1">
                            <label className="text-xs font-black text-neutral-500 uppercase tracking-widest">Padre</label>
                            <div className="grid grid-cols-2 gap-2">
                                <input type="text" placeholder="Nombre" value={form.fatherName} onChange={e => setForm({ ...form, fatherName: e.target.value })} className="w-full p-2 bg-white border-2 border-black rounded-lg outline-none font-bold text-sm focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all" />
                                <input type="text" placeholder="Apellido" value={form.fatherSurname} onChange={e => setForm({ ...form, fatherSurname: e.target.value })} className="w-full p-2 bg-white border-2 border-black rounded-lg outline-none font-bold text-sm focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all" />
                            </div>
                        </div>

                        {/* Contact */}
                        <div className="pt-2 space-y-2 border-t-2 border-dashed border-neutral-300">
                            <div className="space-y-1 mt-2">
                                <label className="text-xs font-black text-neutral-500 uppercase tracking-widest">Contacto</label>
                                <input type="email" placeholder="Email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full p-2 bg-white border-2 border-black rounded-lg outline-none font-bold text-sm focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all" />
                                <input type="tel" placeholder="Teléfono" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full p-2 bg-white border-2 border-black rounded-lg outline-none font-bold text-sm focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all mt-2" />
                            </div>
                        </div>

                        <div className="flex gap-2 pt-4">
                            <button type="submit" className="flex-1 py-3 bg-black text-white font-black uppercase tracking-widest border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-white hover:text-black hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all">{isEditing ? 'Guardar' : 'Agendar'}</button>
                            {isEditing && <button type="button" onClick={() => { setIsEditing(null); setForm({ childName: '', childSurname: '', motherName: '', motherSurname: '', fatherName: '', fatherSurname: '', email: '', phone: '' }); }} className="px-4 py-3 bg-white text-black font-bold border-2 border-black hover:bg-neutral-100 transition-colors">Cancelar</button>}
                        </div>
                    </form>
                </div>
            </div>

            <div className="lg:col-span-2">
                <h2 className="font-black text-2xl text-black uppercase tracking-tight mb-6 border-b-4 border-black inline-block pb-1">Agenda de Presentaciones</h2>
                <div className="space-y-4">
                    {presentations.map(p => (
                        <div key={p.id} className={`p-5 border-2 border-black flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] gap-4 transition-all ${p.isPending ? 'bg-white' : 'bg-neutral-100 opacity-75'}`}>
                            <div>
                                <h4 className="font-black text-xl text-black uppercase tracking-tight mb-1">{p.childName} {p.childSurname}</h4>
                                <div className="text-sm font-bold text-neutral-600 space-y-1 pl-2 border-l-2 border-neutral-300">
                                    <p>Mamá: {p.motherName} {p.motherSurname}</p>
                                    <p>Papá: {p.fatherName} {p.fatherSurname}</p>
                                    <p className="text-xs bg-black text-white px-1 inline-block">{p.email} • {p.phone}</p>
                                </div>
                                {p.completionDate && (
                                    <div className="flex items-center gap-3 mt-3">
                                        <span className="text-xs font-black uppercase bg-emerald-100 text-emerald-900 border-2 border-emerald-900 px-2 py-1">✅ Realizado: {new Date(p.completionDate).toLocaleDateString()}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2 items-center self-end sm:self-center">
                                {p.isPending ? (
                                    <>
                                        <button onClick={() => toggleStatus(p, PendingStatus.COMPLETED)} className="p-2 bg-emerald-100 text-emerald-700 border-2 border-emerald-700 hover:bg-emerald-700 hover:text-white transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" title="Marcar Realizado"><CheckSquare className="w-5 h-5" /></button>
                                        <button onClick={() => handleEdit(p)} className="p-2 bg-blue-100 text-blue-700 border-2 border-blue-700 hover:bg-blue-700 hover:text-white transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><Edit2 className="w-5 h-5" /></button>
                                        <button type="button" onClick={(e) => handleDelete(p.id, e)} className="p-2 bg-white text-red-600 border-2 border-black hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><Trash2 className="w-5 h-5 pointer-events-none" /></button>
                                    </>
                                ) : (
                                    <>
                                        <span className={`text-xs font-black uppercase px-2 py-1 border-2 border-black ${p.status === PendingStatus.COMPLETED ? 'bg-emerald-200 text-emerald-900' : 'bg-red-200 text-red-900'}`}>{p.status}</span>
                                        <button type="button" onClick={(e) => handleDelete(p.id, e)} className="p-2 text-neutral-400 hover:text-red-500 border-2 border-transparent hover:border-black hover:bg-white transition-all"><Trash2 className="w-4 h-4 pointer-events-none" /></button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                    {presentations.length === 0 && (
                        <div className="p-12 text-center border-4 border-dashed border-neutral-300">
                            <p className="text-neutral-400 font-bold uppercase tracking-widest">No hay presentaciones agendadas</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChildPresentations;
