import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppProvider, useStore } from '../../store';
import { useAuth } from '../../contexts/AuthContext';
import { Announcement } from '../../types';
import { safeUUID } from '../../services/uuidUtils';
import { ArrowLeft, Save, CheckCircle, Link as LinkIcon, X } from 'lucide-react';

const EMPTY_FORM: Omit<Announcement, 'id' | 'createdAt'> = {
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    isActive: true,
    isPermanent: false,
    link: '',
};

const PaginaNuevoAnuncioContent: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editId = searchParams.get('id');

    const { announcements, addAnnouncement, updateAnnouncement } = useStore();
    const [form, setForm] = useState(EMPTY_FORM);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saved, setSaved] = useState(false);

    const today = new Date().toISOString().slice(0, 10);

    useEffect(() => {
        if (editId) {
            const a = announcements.find(ann => ann.id === editId);
            if (a) {
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
            }
        }
    }, [editId, announcements]);

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

    const handleSave = async () => {
        const errs = validate();
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }
        setErrors({});

        // Anuncios permanentes no muestran date pickers, pero la DB
        // requiere start_date NOT NULL — inyectamos valores default.
        const finalForm = form.isPermanent
            ? { ...form, startDate: form.startDate || today, endDate: form.endDate || '2099-12-31' }
            : form;

        const qrData = finalForm.link ? finalForm.link : `${finalForm.title}${finalForm.startDate ? ` - ${finalForm.startDate}` : ''}`;
        const encodedData = encodeURIComponent(qrData || 'https://origen.church');
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedData}`;

        let success = false;

        if (editId) {
            const existing = announcements.find(a => a.id === editId);
            if (existing) {
                success = await updateAnnouncement({
                    ...existing,
                    ...finalForm,
                    qrCodeUrl: qrUrl
                });
            }
        } else {
            const newAnn: Announcement = {
                id: safeUUID(),
                createdAt: new Date().toISOString(),
                ...finalForm,
                qrCodeUrl: qrUrl
            };
            success = await addAnnouncement(newAnn);
        }

        // Si falló (ej. la base rechazó los datos), se deja el
        // formulario tal cual para que el usuario no pierda lo
        // que escribió — el aviso de error ya lo muestra el store.
        if (!success) return;

        setSaved(true);
        setTimeout(() => {
            setSaved(false);
            navigate('/punto-de-informacion?view=ANNOUNCEMENTS');
        }, 1200);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-lg mx-auto">
                <button
                    onClick={() => navigate('/punto-de-informacion?view=ANNOUNCEMENTS')}
                    className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-400 hover:text-black transition-colors mb-6"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Anuncios
                </button>

                <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 md:p-8 space-y-4">
                    <div className="flex items-center justify-between mb-2 border-b border-slate-200 pb-4">
                        <h1 className="text-lg font-black uppercase tracking-tight text-slate-900">
                            {editId ? 'Editar anuncio' : 'Nuevo anuncio'}
                        </h1>
                        {editId && (
                            <button
                                onClick={() => navigate('/punto-de-informacion?view=ANNOUNCEMENTS')}
                                className="flex items-center gap-1 text-xs font-bold uppercase px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                                Cancelar
                            </button>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Título *</label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                            placeholder="Ej: Semana de Ayuno 2025"
                            className={`w-full px-4 py-3 border rounded-lg text-sm font-medium text-slate-900 bg-white outline-none focus:border-black transition-colors placeholder:text-slate-400 ${errors.title ? 'border-red-400' : 'border-slate-300'}`}
                        />
                        {errors.title && <p className="text-red-600 text-xs font-bold mt-1">{errors.title}</p>}
                    </div>

                    <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                        <button
                            onClick={() => setForm(f => ({ ...f, isPermanent: false }))}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-md transition-colors ${!form.isPermanent ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            Modo Manual
                        </button>
                        <button
                            onClick={() => setForm(f => ({ ...f, isPermanent: true }))}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-md transition-colors ${form.isPermanent ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            Modo Fijo
                        </button>
                    </div>

                    {!form.isPermanent && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Fecha de Inicio *</label>
                                <input
                                    type="date"
                                    value={form.startDate}
                                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                                    className={`w-full px-4 py-3 border rounded-lg text-sm font-medium text-slate-900 bg-white outline-none focus:border-black transition-colors ${errors.startDate ? 'border-red-400' : 'border-slate-300'}`}
                                />
                                {errors.startDate && <p className="text-red-600 text-xs font-bold mt-1">{errors.startDate}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Fecha de Fin *</label>
                                <input
                                    type="date"
                                    value={form.endDate}
                                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                                    className={`w-full px-4 py-3 border rounded-lg text-sm font-medium text-slate-900 bg-white outline-none focus:border-black transition-colors ${errors.endDate ? 'border-red-400' : 'border-slate-300'}`}
                                />
                                {errors.endDate && <p className="text-red-600 text-xs font-bold mt-1">{errors.endDate}</p>}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Descripción</label>
                        <textarea
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Descripción breve del anuncio..."
                            rows={3}
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm font-medium text-slate-900 bg-white outline-none focus:border-black transition-colors resize-none placeholder:text-slate-400"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Link (para QR)</label>
                        <div className="relative">
                            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={form.link}
                                onChange={e => setForm({ ...form, link: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg text-sm font-medium text-slate-900 bg-white outline-none focus:border-black transition-colors placeholder:text-slate-400"
                                placeholder="https://formulario..."
                            />
                        </div>
                        <p className="text-[10px] font-medium text-slate-400 uppercase mt-1">Si vacío, QR = Título + Fecha</p>
                    </div>

                    <button
                        onClick={handleSave}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-black text-white font-bold uppercase tracking-widest text-xs rounded-lg hover:bg-slate-800 transition-colors"
                    >
                        {saved ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                        {saved ? '¡Guardado!' : editId ? 'Actualizar anuncio' : 'Crear anuncio'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Wrapper que provee el Store Context — mismo patrón
// que PuntoInformacion.tsx usa para sus vistas
// internas, ya que esta página es una ruta suelta
// que no hereda ese Provider.
const PaginaNuevoAnuncio: React.FC = () => {
    const { user } = useAuth();
    return (
        <AppProvider currentUser={user}>
            <PaginaNuevoAnuncioContent />
        </AppProvider>
    );
};

export default PaginaNuevoAnuncio;
