
import React, { useState } from 'react';
import { useStore } from '../../store';
import { Announcement } from '../../types';
import { Megaphone, Plus, Pencil, Trash2, X, Save, CheckCircle, AlertCircle, QrCode, Link as LinkIcon } from 'lucide-react';
import { safeUUID } from '../../services/uuidUtils';
import QRCodeModal from '../../components/modals/ModalCodigoQR';

const EMPTY_FORM: Omit<Announcement, 'id' | 'createdAt'> = {
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    isActive: true,
    isPermanent: false,
    link: '',
};

const Announcements: React.FC = () => {
    const { announcements, addAnnouncement, updateAnnouncement, deleteAnnouncement } = useStore();
    const [form, setForm] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saved, setSaved] = useState(false);
    const [qrModal, setQrModal] = useState<{ open: boolean, title: string, url: string }>({ open: false, title: '', url: '' });
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const today = new Date().toISOString().slice(0, 10);

    const getSafeQrUrl = (url: string | undefined, title: string, link: string | undefined) => {
        const fallbackText = link || title || 'https://origen.church';
        const defaultRender = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(fallbackText)}`;
        
        if (!url) return defaultRender;
        
        if (url.includes('quickchart.io')) {
            const match = url.match(/[?&]text=([^&]+)/);
            if (match && match[1]) {
                return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${match[1]}`;
            }
            return defaultRender;
        }
        return url;
    };

    const isAnnouncementActive = (a: Announcement) => {
        return a.isActive !== false;
    };

    const handleToggleActive = (a: Announcement) => {
        const newStatus = !isAnnouncementActive(a);
        updateAnnouncement({ ...a, isActive: newStatus });
    };

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.title.trim()) errs.title = 'El título es requerido.';
        if (!form.isPermanent) {
            if (!form.startDate) errs.startDate = 'Fecha de inicio requerida.';
            if (!form.endDate) errs.endDate = 'Fecha de fin requerida.';
            if (form.startDate && form.endDate && form.endDate < form.startDate) {
                errs.endDate = 'La fecha de fin no puede ser anterior a la de inicio.';
            }
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

        // Generate QR Code URL using qrserver
        const qrData = form.link ? form.link : `${form.title}${form.startDate ? ` - ${form.startDate}` : ''}`;
        const encodedData = encodeURIComponent(qrData || 'https://origen.church');
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedData}`;

        if (editingId) {
            const existing = announcements.find(a => a.id === editingId);
            if (existing) {
                updateAnnouncement({
                    ...existing,
                    ...form,
                    qrCodeUrl: qrUrl
                });
            }
            setEditingId(null);
        } else {
            const newAnn: Announcement = {
                id: safeUUID(),
                createdAt: new Date().toISOString(),
                ...form,
                qrCodeUrl: qrUrl
            };
            addAnnouncement(newAnn);
        }
        setForm(EMPTY_FORM);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };

    const handleEdit = (a: Announcement) => {
        setEditingId(a.id);
        const hasValidDates = a.startDate && a.endDate;
        const isActiveDefault = a.isPermanent || (hasValidDates && a.startDate <= today && a.endDate >= today);
        setForm({
            title: a.title,
            description: a.description,
            startDate: a.startDate || '',
            endDate: a.endDate || '',
            isActive: a.isActive ?? isActiveDefault,
            isPermanent: a.isPermanent || false,
            link: a.link || '',
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
        setDeleteConfirmId(id);
    };

    const confirmDelete = () => {
        if (deleteConfirmId) {
            deleteAnnouncement(deleteConfirmId);
            setDeleteConfirmId(null);
        }
    };

    return (
        <div className="space-y-6">
            <QRCodeModal
                isOpen={qrModal.open}
                onClose={() => setQrModal({ ...qrModal, open: false })}
                title={qrModal.title}
                qrUrl={qrModal.url}
            />

            {/* --- DELETE CONFIRM MODAL --- */}
            {deleteConfirmId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 w-full max-w-sm mx-4">
                        <div className="flex items-center gap-3 mb-4">
                            <Trash2 className="w-6 h-6 text-red-600 flex-shrink-0" />
                            <h2 className="text-lg font-black uppercase tracking-tighter">Eliminar anuncio</h2>
                        </div>
                        <p className="text-sm font-bold text-slate-600 mb-6">¿Seguro que querés eliminar este anuncio? Esta acción no se puede deshacer.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="flex-1 py-3 border-4 border-black font-black uppercase text-sm hover:bg-slate-100 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 py-3 bg-red-600 text-white border-4 border-black font-black uppercase text-sm hover:bg-red-700 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

                {/* Type Selection */}
                <div className="flex gap-4 p-1 bg-slate-100 border-4 border-black">
                    <button
                        onClick={() => setForm(f => ({ ...f, isPermanent: false }))}
                        className={`flex-1 py-2 text-xs font-black uppercase tracking-widest transition-all ${!form.isPermanent ? 'bg-black text-white' : 'text-black hover:bg-slate-200'}`}
                    >
                        Modo Manual
                    </button>
                    <button
                        onClick={() => setForm(f => ({ ...f, isPermanent: true }))}
                        className={`flex-1 py-2 text-xs font-black uppercase tracking-widest transition-all ${form.isPermanent ? 'bg-black text-white' : 'text-black hover:bg-slate-200'}`}
                    >
                        Modo Fijo (Fijo)
                    </button>
                </div>

                {/* Dates */}
                {!form.isPermanent && (
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
                )}

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

                {/* Link */}
                <div className="space-y-1">
                    <label className="text-xs font-black uppercase tracking-widest border-b-2 border-black mb-1 inline-block">Link (Para QR)</label>
                    <div className="relative">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
                        <input
                            type="text"
                            value={form.link}
                            onChange={e => setForm({ ...form, link: e.target.value })}
                            className="w-full pl-10 px-4 py-3 border-4 border-black font-bold text-black bg-white focus:outline-none placeholder:text-slate-300"
                            placeholder="https://formulario..."
                        />
                    </div>
                    <p className="text-[10px] font-bold text-neutral-500 uppercase mt-1">Si vacío, QR = Título + Fecha</p>
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
                    <>
                        {/* --- MOBILE CARD LIST (visible on sm, hidden on md+) --- */}
                        <div className="md:hidden divide-y-2 divide-black">
                            {announcements.map((a) => {
                                const active = isAnnouncementActive(a);
                                return (
                                    <div key={a.id} className={`p-4 space-y-3 ${active ? 'bg-white' : 'bg-slate-50'}`}>
                                        {/* Title + Status badge */}
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="font-black uppercase tracking-tight text-sm leading-tight flex-1">{a.title}</h3>
                                            <button
                                                onClick={() => handleToggleActive(a)}
                                                className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 border-2 border-black text-[10px] font-black uppercase transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-0.5 ${active ? 'bg-emerald-300 text-black' : 'bg-slate-200 text-slate-500'}`}
                                                title={active ? 'Click para desactivar' : 'Click para activar'}
                                            >
                                                {active ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                                {active ? 'Activo' : 'Inactivo'}
                                            </button>
                                        </div>

                                        {/* Dates row */}
                                        <div className="flex items-center gap-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                                            {a.isPermanent ? (
                                                <span className="inline-flex items-center gap-0.5 text-emerald-700 bg-emerald-100 px-2 py-0.5 border border-emerald-300 font-black">∞ Permanente</span>
                                            ) : (
                                                <>
                                                    <span>
                                                        Inicio: {a.startDate ? new Date(a.startDate + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}
                                                    </span>
                                                    <span>Fin: {a.endDate ? new Date(a.endDate + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}</span>
                                                </>
                                            )}
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex items-center gap-2 pt-1">
                                            {a.qrCodeUrl && (
                                                <button
                                                    onClick={() => setQrModal({ open: true, title: a.title, url: getSafeQrUrl(a.qrCodeUrl, a.title, a.link) })}
                                                    className="flex items-center gap-1.5 px-3 py-2 border-2 border-black bg-white text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-black hover:text-white transition-all active:shadow-none"
                                                >
                                                    <QrCode className="w-3.5 h-3.5" /> QR
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleEdit(a)}
                                                className="flex items-center gap-1.5 px-3 py-2 border-2 border-black bg-white text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-black hover:text-white transition-all active:shadow-none"
                                            >
                                                <Pencil className="w-3.5 h-3.5" /> Editar
                                            </button>
                                            <button
                                                onClick={() => handleDelete(a.id)}
                                                className="flex items-center gap-1.5 px-3 py-2 border-2 border-black bg-white text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-red-600 hover:text-white hover:border-red-600 transition-all active:shadow-none"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" /> Eliminar
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* --- DESKTOP TABLE (hidden on sm, visible on md+) --- */}
                        <div className="hidden md:block overflow-x-auto">
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
                                            <td className="px-6 py-4 font-black text-sm uppercase tracking-tight min-w-[160px]">
                                                {a.title}
                                            </td>
                                            <td className="px-4 py-4 text-sm font-bold text-slate-600">
                                                {!a.isPermanent && a.startDate ? new Date(a.startDate + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}
                                            </td>
                                            <td className="px-4 py-4 text-sm font-bold text-slate-600">
                                                {a.isPermanent ? (
                                                    <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-200">
                                                        ∞ Permanente
                                                    </span>
                                                ) : (
                                                    a.endDate ? new Date(a.endDate + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'
                                                )}
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
                                                    {a.qrCodeUrl && (
                                                        <button
                                                            onClick={() => setQrModal({ open: true, title: a.title, url: getSafeQrUrl(a.qrCodeUrl, a.title, a.link) })}
                                                            className="p-2 border-2 border-black hover:bg-black hover:text-white transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none active:translate-y-0.5"
                                                            title="Ver QR"
                                                        >
                                                            <QrCode className="w-4 h-4" />
                                                        </button>
                                                    )}
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
                    </>
                )}
            </div>
        </div>
    );
};

export default Announcements;
