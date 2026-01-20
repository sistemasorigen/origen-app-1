import React, { useState } from 'react';
import { useStore } from '../../store';
import { PendingStatus, Baptism } from '../../types';
import { Droplets, CheckSquare, XSquare, Trash2, Edit2 } from 'lucide-react';
import { safeUUID } from '../../services/uuidUtils';

const Baptisms: React.FC = () => {
    const { baptisms, addBaptism, updateBaptism, deleteBaptism, showNotification } = useStore();
    const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
    const [isEditing, setIsEditing] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isEditing) {
            const existing = baptisms.find(b => b.id === isEditing);
            if (existing) {
                await updateBaptism({ ...existing, ...form });
                showNotification('¡Datos de bautismo actualizados!');
            }
            setIsEditing(null);
        } else {
            await addBaptism({
                id: safeUUID(),
                ...form,
                isPending: 1,
                status: PendingStatus.PENDING,
                registrationDate: new Date().toISOString()
            });
            showNotification('¡Inscripción a bautismo exitosa!');
        }
        setForm({ firstName: '', lastName: '', email: '', phone: '' });
    };

    const handleEdit = (b: Baptism) => {
        setIsEditing(b.id);
        setForm({ firstName: b.firstName, lastName: b.lastName, email: b.email, phone: b.phone });
    };

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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn p-1">
            <div className="lg:col-span-1">
                <div className="bg-white p-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sticky top-4">
                    <h3 className="font-black text-xl mb-6 text-black uppercase tracking-tight flex items-center gap-2 border-b-2 border-black pb-2">
                        <Droplets className="w-6 h-6 text-black" /> {isEditing ? 'Editar Bautismo' : 'Registro Bautismo'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <input type="text" placeholder="Nombre" required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className="w-full p-3 bg-white border-2 border-black rounded-lg outline-none font-bold placeholder-neutral-500 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all" />
                            <input type="text" placeholder="Apellido" required value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className="w-full p-3 bg-white border-2 border-black rounded-lg outline-none font-bold placeholder-neutral-500 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all" />
                        </div>
                        <input type="email" placeholder="Email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full p-3 bg-white border-2 border-black rounded-lg outline-none font-bold placeholder-neutral-500 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all" />
                        <input type="tel" placeholder="Teléfono" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full p-3 bg-white border-2 border-black rounded-lg outline-none font-bold placeholder-neutral-500 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all" />

                        <div className="flex gap-2 pt-2">
                            <button type="submit" className="flex-1 py-3 bg-black text-white font-black uppercase tracking-widest border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-white hover:text-black hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all">{isEditing ? 'Actualizar' : 'Registrar'}</button>
                            {isEditing && <button type="button" onClick={() => { setIsEditing(null); setForm({ firstName: '', lastName: '', email: '', phone: '' }); }} className="px-4 py-3 bg-white text-black font-bold border-2 border-black hover:bg-neutral-100 transition-colors">Cancelar</button>}
                        </div>
                    </form>
                </div>
            </div>

            <div className="lg:col-span-2">
                <h2 className="font-black text-2xl text-black uppercase tracking-tight mb-6 border-b-4 border-black inline-block pb-1">Lista de Bautismos</h2>
                <div className="space-y-4">
                    {baptisms.map(b => (
                        <div key={b.id} className={`p-5 border-2 border-black flex flex-col md:flex-row justify-between items-start md:items-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] gap-4 transition-all ${b.isPending ? 'bg-white' : 'bg-neutral-100 opacity-75'}`}>
                            <div>
                                <h4 className="font-black text-lg text-black uppercase tracking-tight">{b.firstName} {b.lastName}</h4>
                                <p className="text-sm font-bold text-neutral-600">{b.email} • {b.phone}</p>
                                <div className="flex items-center gap-3 mt-2">
                                    <span className="text-[10px] font-black uppercase bg-black text-white px-2 py-1">Anotado: {new Date(b.registrationDate).toLocaleDateString()}</span>
                                    {b.completionDate && (
                                        <span className="text-[10px] font-black uppercase bg-emerald-600 text-white px-2 py-1">Realizado: {new Date(b.completionDate).toLocaleDateString()}</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2 items-center w-full md:w-auto justify-end">
                                {b.isPending ? (
                                    <>
                                        <button onClick={() => toggleStatus(b, PendingStatus.COMPLETED)} className="p-2 bg-emerald-100 text-emerald-700 border-2 border-emerald-700 hover:bg-emerald-700 hover:text-white transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" title="Marcar Realizado"><CheckSquare className="w-5 h-5" /></button>
                                        <button onClick={() => handleEdit(b)} className="p-2 bg-blue-100 text-blue-700 border-2 border-blue-700 hover:bg-blue-700 hover:text-white transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><Edit2 className="w-5 h-5" /></button>
                                        <button type="button" onClick={(e) => handleDelete(b.id, e)} className="p-2 bg-white text-red-600 border-2 border-black hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><Trash2 className="w-5 h-5 pointer-events-none" /></button>
                                    </>
                                ) : (
                                    <>
                                        <span className={`text-xs font-black uppercase px-2 py-1 border-2 border-black ${b.status === PendingStatus.COMPLETED ? 'bg-emerald-200 text-emerald-900' : 'bg-red-200 text-red-900'}`}>{b.status}</span>
                                        <button type="button" onClick={(e) => handleDelete(b.id, e)} className="p-2 text-neutral-400 hover:text-red-500 border-2 border-transparent hover:border-black hover:bg-white transition-all"><Trash2 className="w-4 h-4 pointer-events-none" /></button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                    {baptisms.length === 0 && (
                        <div className="p-12 text-center border-4 border-dashed border-neutral-300">
                            <p className="text-neutral-400 font-bold uppercase tracking-widest">No hay registros</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Baptisms;
