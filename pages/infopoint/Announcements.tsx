
import React, { useState } from 'react';
import { useStore } from '../../store';
import { Announcement } from '../../types';
import { Megaphone, Plus, Pencil, Trash2, X, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { safeUUID } from '../../services/uuidUtils';

const EMPTY_FORM: Omit<Announcement, 'id' | 'createdAt'> = {
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    isActive: true,
};

const Announcements: React.FC = () => {
    const { announcements, addAnnouncement, updateAnnouncement, deleteAnnouncement } = useStore();
    const [form, setForm] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saved, setSaved] = useState(false);

    const today = new Date().toISOString().slice(0, 10);

    const isAnnouncementActive = (a: Announcement) => {
        if (a.isActive !== undefined) return a.isActive;
        return a.startDate <= today && a.endDate >= today;
    };

    const handleToggleActive = (a: Announcement) => {
        const newStatus = !isAnnouncementActive(a);
        updateAnnouncement({ ...a, isActive: newStatus });
    };

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.title.trim()) errs.title = 'El título es requerido.';
        if (!form.startDate) errs.startDate = 'Fecha de inicio requerida.';
        if (!form.endDate) errs.endDate = 'Fecha de fin requerida.';
        if (form.startDate && form.endDate && form.endDate < form.startDate) {
            errs.endDate = 'La fecha de fin no puede ser anterior a la de inicio.';
        }
        return errs;
    };

    const handleSave = () => {
        const errs = validate();
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }
        setErrors({});

        if (editingId) {
            const existing = announcements.find(a => a.id === editingId);
            if (existing) {
                updateAnnouncement({ ...existing, ...form });
            }
            setEditingId(null);
        } else {
            const newAnn: Announcement = {
                id: safeUUID(),
                createdAt: new Date().toISOString(),
                ...form,
            };
            addAnnouncement(newAnn);
        }
        setForm(EMPTY_FORM);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };

    const handleEdit = (a: Announcement) => {
        setEditingId(a.id);
        setForm({
            title: a.title,
            description: a.description,
            startDate: a.startDate,
            endDate: a.endDate,
            isActive: a.isActive ?? (a.startDate <= today && a.endDate >= today),
        });
        setErrors({});
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancel = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setErrors({});
    };

    const handleDelete = (id: string) => {
        if (window.confirm('¿Eliminar este anuncio?')) {
            deleteAnnouncement(id);
        }
    };

    return (
        <div className="space-y-6">
            {/* --- HEADER --- */}
            <div className="flex items-center gap-3 pb-4 border-b-4 border-black">
                <div className="p-3 bg-yellow-100 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <Megaphone className="w-6 h-6 text-black" />
                </div>
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-tighter">Gestor de Anuncios</h1>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Tablero público del Punto de Info</p>
                </div>
            </div>

            {/* --- FORM --- */}
            <div className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6 space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-black uppercase tracking-tighter">
                        {editingId ? '✏️ Editar Anuncio' : '+ Nuevo Anuncio'}
                    </h2>
                    {editingId && (
                        <button
                            onClick={handleCancel}
                            className="flex items-center gap-1 text-xs font-black uppercase px-3 py-1.5 border-2 border-black hover:bg-black hover:text-white transition-all"
                        >
                            <X className="w-3.5 h-3.5" />
                            Cancelar
                        </button>
                    )}
                </div>

                {/* Title */}
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest mb-1">Título *</label>
                    <input
                        type="text"
                        value={form.title}
                        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="Ej: Semana de Ayuno 2025"
                        className={`w-full px-4 py-3 border-4 font-bold text-black bg-white focus:outline-none focus:ring-0 placeholder:text-slate-300 ${errors.title ? 'border-red-500' : 'border-black'}`}
                    />
                    {errors.title && <p className="text-red-600 text-xs font-bold mt-1">{errors.title}</p>}
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest mb-1">Fecha de Inicio *</label>
                        <input
                            type="date"
                            value={form.startDate}
                            onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                            className={`w-full px-4 py-3 border-4 font-bold text-black bg-white focus:outline-none ${errors.startDate ? 'border-red-500' : 'border-black'}`}
                        />
                        {errors.startDate && <p className="text-red-600 text-xs font-bold mt-1">{errors.startDate}</p>}
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest mb-1">Fecha de Fin *</label>
                        <input
                            type="date"
                            value={form.endDate}
                            onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                            className={`w-full px-4 py-3 border-4 font-bold text-black bg-white focus:outline-none ${errors.endDate ? 'border-red-500' : 'border-black'}`}
                        />
                        {errors.endDate && <p className="text-red-600 text-xs font-bold mt-1">{errors.endDate}</p>}
                    </div>
                </div>

                {/* Description */}
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest mb-1">Descripción</label>
                    <textarea
                        value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Descripción breve del anuncio..."
                        rows={3}
                        className="w-full px-4 py-3 border-4 border-black font-bold text-black bg-white focus:outline-none resize-none placeholder:text-slate-300"
                    />
                </div>

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-6 py-4 bg-black text-white font-black uppercase tracking-widest text-sm border-4 border-black hover:bg-white hover:text-black transition-all duration-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5"
                >
                    {saved ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                    {saved ? '¡Guardado!' : editingId ? 'Actualizar Anuncio' : 'Crear Anuncio'}
                </button>
            </div>

            {/* --- TABLE --- */}
            <div className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <div className="px-6 py-4 bg-black text-white flex items-center justify-between">
                    <h2 className="text-base font-black uppercase tracking-widest">Anuncios Registrados</h2>
                    <span className="text-xs font-bold bg-yellow-400 text-black px-2 py-1 border-2 border-white">
                        {announcements.length} total
                    </span>
                </div>

                {announcements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 border-4 border-dashed border-slate-200 mx-6 my-6">
                        <Megaphone className="w-12 h-12 text-slate-200 mb-3" />
                        <p className="text-slate-400 font-black uppercase tracking-widest text-sm text-center">
                            Aún no hay anuncios.<br />¡Crea el primero!
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b-4 border-black bg-slate-50">
                                    <th className="text-left px-6 py-3 text-xs font-black uppercase tracking-widest">Título</th>
                                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-widest">Inicio</th>
                                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-widest">Fin</th>
                                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-widest">Estado</th>
                                    <th className="text-center px-4 py-3 text-xs font-black uppercase tracking-widest">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {announcements.map((a, idx) => (
                                    <tr key={a.id} className={`border-b-2 border-black ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-yellow-50 transition-colors`}>
                                        <td className="px-6 py-4 font-black text-sm uppercase tracking-tight max-w-[200px] truncate">
                                            {a.title}
                                        </td>
                                        <td className="px-4 py-4 text-sm font-bold text-slate-600">
                                            {new Date(a.startDate + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })}
                                        </td>
                                        <td className="px-4 py-4 text-sm font-bold text-slate-600">
                                            {new Date(a.endDate + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })}
                                        </td>
                                        <td className="px-4 py-4">
                                            <button
                                                onClick={() => handleToggleActive(a)}
                                                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border-2 border-black text-xs font-black uppercase transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-none ${isAnnouncementActive(a) ? 'bg-emerald-300 text-black hover:bg-emerald-400' : 'bg-slate-200 text-slate-500 hover:bg-slate-300 hover:text-black'
                                                    }`}
                                                title={isAnnouncementActive(a) ? 'Click para desactivar' : 'Click para activar'}
                                            >
                                                {isAnnouncementActive(a) ? (
                                                    <>
                                                        <CheckCircle className="w-3.5 h-3.5" />
                                                        Activo
                                                    </>
                                                ) : (
                                                    <>
                                                        <AlertCircle className="w-3.5 h-3.5" />
                                                        Inactivo
                                                    </>
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleEdit(a)}
                                                    className="p-2 border-2 border-black hover:bg-black hover:text-white transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none active:translate-y-0.5"
                                                    title="Editar"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(a.id)}
                                                    className="p-2 border-2 border-black hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none active:translate-y-0.5"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Announcements;
