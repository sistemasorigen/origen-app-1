import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppProvider, useStore } from '../../store';
import { useAuth } from '../../contexts/AuthContext';
import { AppEvent } from '../../types';
import { safeUUID } from '../../services/uuidUtils';
import { formatDateForInput, formatDateForDisplay } from '../../services/dateUtils';
import { ArrowLeft, QrCode, Edit2, Link as LinkIcon, Loader2 } from 'lucide-react';

const PaginaNuevoEventoContent: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editId = searchParams.get('id');

    const { events, addEvent, updateEvent, showNotification } = useStore();
    const [form, setForm] = useState({
        name: '', date: '', startTime: '', endTime: '', link: '', description: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (editId) {
            const existing = events.find(ev => ev.id === editId);
            if (existing) {
                setForm({
                    name: existing.name,
                    date: existing.date,
                    startTime: existing.startTime || '',
                    endTime: existing.endTime || '',
                    link: existing.link || '',
                    description: existing.description || ''
                });
            }
        }
    }, [editId, events]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.date) {
            showNotification("El nombre y la fecha son obligatorios.", 'error');
            return;
        }

        setIsSaving(true);
        try {
            // Generar QR — mismo formato que el resto del proyecto (api.qrserver.com)
            const qrData = form.link ? form.link : `${form.name} - ${form.date} ${form.startTime}`;
            const encodedData = encodeURIComponent(qrData || 'https://origen.church');
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedData}`;

            if (editId) {
                const existingEvent = events.find(ev => ev.id === editId);
                await updateEvent({
                    ...existingEvent,
                    id: editId,
                    name: form.name,
                    description: form.description,
                    date: form.date,
                    startTime: form.startTime,
                    endTime: form.endTime,
                    link: form.link,
                    qrCodeUrl: qrUrl
                } as AppEvent);
                showNotification('¡Evento actualizado exitosamente!');
            } else {
                await addEvent({
                    id: safeUUID(),
                    name: form.name,
                    description: form.description,
                    date: form.date,
                    startTime: form.startTime,
                    endTime: form.endTime,
                    link: form.link,
                    qrCodeUrl: qrUrl,
                    createdAt: new Date().toISOString()
                } as AppEvent);
                showNotification('¡Evento creado y QR generado exitosamente!');
            }
            navigate('/punto-de-informacion?view=EVENTS');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-lg mx-auto">
                <button
                    onClick={() => navigate('/punto-de-informacion?view=EVENTS')}
                    className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-400 hover:text-black transition-colors mb-6"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Eventos
                </button>

                <div className="bg-white p-6 md:p-8 border border-slate-200 rounded-lg shadow-sm">
                    <h1 className="font-black text-xl mb-6 text-slate-900 uppercase tracking-tight flex items-center gap-2 border-b border-slate-200 pb-4">
                        {editId ? <Edit2 className="w-6 h-6 text-slate-400" /> : <QrCode className="w-6 h-6 text-slate-400" />}
                        {editId ? 'Editar Evento' : 'Crear Evento'}
                    </h1>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Nombre del Evento</label>
                            <input
                                type="text" required
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none text-sm font-medium text-slate-900 focus:border-black transition-colors"
                                placeholder="Ej. Reunión de Jóvenes"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Descripción (Opcional)</label>
                            <textarea
                                value={form.description}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                                className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none resize-none text-sm font-medium text-slate-900 focus:border-black transition-colors placeholder:text-slate-400"
                                placeholder="Breve descripción del evento..."
                                rows={3}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Fecha</label>
                            <div className="relative">
                                <input
                                    type="text" readOnly
                                    value={formatDateForDisplay(form.date)}
                                    placeholder="DD/MM/AAAA"
                                    className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none pointer-events-none text-sm font-medium text-slate-900"
                                />
                                <input
                                    type="date" required
                                    value={formatDateForInput(form.date)}
                                    onChange={e => setForm({ ...form, date: e.target.value })}
                                    onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                                    className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer appearance-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Hora Inicio</label>
                                <input
                                    type="time"
                                    value={form.startTime}
                                    onChange={e => setForm({ ...form, startTime: e.target.value })}
                                    className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none text-sm font-medium text-slate-900 focus:border-black transition-colors"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Hora Fin</label>
                                <input
                                    type="time"
                                    value={form.endTime}
                                    onChange={e => setForm({ ...form, endTime: e.target.value })}
                                    className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none text-sm font-medium text-slate-900 focus:border-black transition-colors"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Link (Para QR)</label>
                            <div className="relative">
                                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={form.link}
                                    onChange={e => setForm({ ...form, link: e.target.value })}
                                    className="w-full pl-10 p-3 bg-white border border-slate-300 rounded-lg outline-none text-sm font-medium text-slate-900 focus:border-black transition-colors placeholder:text-slate-400"
                                    placeholder="https://formulario..."
                                />
                            </div>
                            <p className="text-[10px] font-medium text-slate-400 uppercase mt-1">Si vacío, QR = Nombre + Fecha</p>
                        </div>

                        <button
                            type="submit"
                            disabled={isSaving}
                            className={`w-full py-3 font-bold uppercase tracking-widest text-xs rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${editId
                                ? 'bg-[#118f46] text-white hover:bg-[#0f7a3c]'
                                : 'bg-black text-white hover:bg-slate-800'
                                }`}
                        >
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : editId ? <Edit2 className="w-5 h-5" /> : <QrCode className="w-5 h-5" />}
                            {editId ? 'Guardar Cambios' : 'Generar QR'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

// Wrapper que provee el Store Context — mismo patrón
// que PuntoInformacion.tsx usa para sus vistas
// internas, ya que esta página es una ruta suelta
// que no hereda ese Provider.
const PaginaNuevoEvento: React.FC = () => {
    const { user } = useAuth();
    return (
        <AppProvider currentUser={user}>
            <PaginaNuevoEventoContent />
        </AppProvider>
    );
};

export default PaginaNuevoEvento;
