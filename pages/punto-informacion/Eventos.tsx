import React, { useState } from 'react';
import { useStore } from '../../store';
import { AppEvent } from '../../types';
import ModalCompartirQR from '../../components/modals/ModalCompartirQR';
import { QrCode, Trash2, Calendar, Link as LinkIcon, ExternalLink, Plus, Clock, Edit2, X } from 'lucide-react';
import { formatDateForInput, formatDateForDisplay } from '../../services/dateUtils';
import { safeUUID } from '../../services/uuidUtils';

const Events: React.FC = () => {
    const { events, addEvent, updateEvent, deleteEvent, showNotification } = useStore();
    const [qrModal, setQrModal] = useState<{ open: boolean, title: string, url: string, link: string }>({ open: false, title: '', url: '', link: '' });

    // Form State
    const [form, setForm] = useState({
        name: '',
        date: '',
        startTime: '',
        endTime: '',
        link: '',
        description: ''
    });

    // Edit Mode State
    const [editingId, setEditingId] = useState<string | null>(null);

    const resetForm = () => {
        setForm({ name: '', date: '', startTime: '', endTime: '', link: '', description: '' });
        setEditingId(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.date) {
            showNotification("El nombre y la fecha son obligatorios.", 'error');
            return;
        }

        // Generate QR Code URL using qrserver
        const qrData = form.link ? form.link : `${form.name} - ${form.date} ${form.startTime}`;
        const encodedData = encodeURIComponent(qrData || 'https://origen.church');
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedData}`;

        if (editingId) {
            // Update existing event
            const existingEvent = events.find(ev => ev.id === editingId);
            await updateEvent({
                ...existingEvent,
                id: editingId,
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
            // Create new event
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

        resetForm();
    };

    const handleEdit = (ev: AppEvent, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setEditingId(ev.id);
        setForm({
            name: ev.name,
            date: ev.date,
            startTime: ev.startTime || '',
            endTime: ev.endTime || '',
            link: ev.link || '',
            description: ev.description || ''
        });
    };

    const handleCancelEdit = () => {
        resetForm();
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        await deleteEvent(id);
        showNotification('Evento eliminado.');
    };

    // Sort events by date (newest first)
    const sortedEvents = [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const getSafeQrUrl = (url: string | undefined, name: string, link: string | undefined) => {
        const fallbackText = link || name || 'https://origen.church';
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

    return (
        <div className="space-y-8 animate-fadeIn p-1">
            <ModalCompartirQR
                isOpen={qrModal.open}
                onClose={() => setQrModal({ ...qrModal, open: false })}
                title={qrModal.title}
                qrUrl={qrModal.url}
                link={qrModal.link}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* FORM CARD */}
                <div className="lg:col-span-1">
                    <div className={`bg-white p-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sticky top-4 transition-all ${editingId ? 'bg-yellow-50' : ''}`}>
                        <div className="flex items-center justify-between mb-6 border-b-2 border-black pb-2">
                            <h3 className="font-black text-lg text-black uppercase tracking-tight flex items-center gap-2">
                                {editingId ? (
                                    <>
                                        <Edit2 className="w-5 h-5 text-black" /> Editar Evento
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-5 h-5 text-black" /> Crear Evento
                                    </>
                                )}
                            </h3>
                            {editingId && (
                                <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="p-1 text-black hover:bg-black hover:text-white border-2 border-transparent hover:border-black transition-colors"
                                    title="Cancelar Edición"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            )}
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-1">
                                <label className="text-xs font-black uppercase tracking-widest border-b-2 border-black mb-1 inline-block">Nombre del Evento</label>
                                <input
                                    type="text"
                                    required
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    className="w-full p-3 bg-white border-2 border-black rounded-lg outline-none font-bold focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                                    placeholder="Ej. Reunión de Jóvenes"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-black uppercase tracking-widest border-b-2 border-black mb-1 inline-block">Descripción (Opcional)</label>
                                <textarea
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    className="w-full p-3 bg-white border-2 border-black rounded-lg outline-none resize-none font-medium focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                                    placeholder="Breve descripción del evento..."
                                    rows={3}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-black uppercase tracking-widest border-b-2 border-black mb-1 inline-block">Fecha</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        readOnly
                                        value={formatDateForDisplay(form.date)}
                                        placeholder="DD/MM/AAAA"
                                        className="w-full p-3 bg-white border-2 border-black rounded-lg outline-none pointer-events-none font-bold"
                                    />
                                    <input
                                        type="date"
                                        required
                                        value={formatDateForInput(form.date)}
                                        onChange={e => setForm({ ...form, date: e.target.value })}
                                        onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                                        className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer appearance-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-black uppercase tracking-widest border-b-2 border-black mb-1 inline-block">Hora Inicio</label>
                                    <input
                                        type="time"
                                        value={form.startTime}
                                        onChange={e => setForm({ ...form, startTime: e.target.value })}
                                        className="w-full p-3 bg-white border-2 border-black rounded-lg outline-none font-bold focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-black uppercase tracking-widest border-b-2 border-black mb-1 inline-block">Hora Fin</label>
                                    <input
                                        type="time"
                                        value={form.endTime}
                                        onChange={e => setForm({ ...form, endTime: e.target.value })}
                                        className="w-full p-3 bg-white border-2 border-black rounded-lg outline-none font-bold focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-black uppercase tracking-widest border-b-2 border-black mb-1 inline-block">Link (Para QR)</label>
                                <div className="relative">
                                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
                                    <input
                                        type="text"
                                        value={form.link}
                                        onChange={e => setForm({ ...form, link: e.target.value })}
                                        className="w-full pl-10 p-3 bg-white border-2 border-black rounded-lg outline-none font-bold focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                                        placeholder="https://formulario..."
                                    />
                                </div>
                                <p className="text-[10px] font-bold text-neutral-500 uppercase mt-1">Si vacío, QR = Nombre + Fecha</p>
                            </div>

                            <button
                                type="submit"
                                className={`w-full py-4 font-black uppercase tracking-widest rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all flex items-center justify-center gap-2 ${editingId
                                    ? 'bg-green-500 text-black hover:bg-green-400'
                                    : 'bg-black text-white hover:bg-white hover:text-black'
                                    }`}
                            >
                                {editingId ? (
                                    <>
                                        <Edit2 className="w-5 h-5" /> Guardar Cambios
                                    </>
                                ) : (
                                    <>
                                        <QrCode className="w-5 h-5" /> Generar QR
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* EVENTS LIST */}
                <div className="lg:col-span-2">
                    <h3 className="font-black text-xl mb-6 uppercase tracking-tight border-b-4 border-black inline-block pb-1">Agenda Activa</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {sortedEvents.map(ev => (
                            <div
                                key={ev.id}
                                onClick={() => setQrModal({ open: true, title: ev.name, url: getSafeQrUrl(ev.qrCodeUrl, ev.name, ev.link), link: ev.link || window.location.href })}
                                className={`bg-white p-5 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all cursor-pointer group flex items-start gap-4 relative ${editingId === ev.id ? 'bg-neutral-50 border-dashed' : ''}`}
                            >
                                {/* QR Preview */}
                                <div className="w-24 h-24 bg-white border-2 border-black flex-shrink-0 p-1">
                                    <img src={getSafeQrUrl(ev.qrCodeUrl, ev.name, ev.link)} alt="QR" className="w-full h-full object-contain" />
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-black text-black uppercase tracking-tight text-lg leading-tight mb-2 line-clamp-2">{ev.name}</h4>

                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2 text-sm font-bold text-neutral-600">
                                            <Calendar className="w-4 h-4 text-black" />
                                            <span>{new Date(ev.date + 'T00:00:00').toLocaleDateString()}</span>
                                        </div>
                                        {(ev.startTime || ev.endTime) && (
                                            <div className="flex items-center gap-2 text-sm font-bold text-black bg-yellow-300 inline-flex self-start px-1 border border-black">
                                                <Clock className="w-3 h-3" />
                                                <span>{ev.startTime || '--:--'} - {ev.endTime || '--:--'}</span>
                                            </div>
                                        )}
                                        {ev.description && (
                                            <p className="text-xs font-medium text-neutral-500 mt-2 line-clamp-2 border-l-2 border-neutral-300 pl-2">{ev.description}</p>
                                        )}
                                    </div>

                                    {ev.link && (
                                        <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-blue-600 hover:text-black transition-colors">
                                            <ExternalLink className="w-3 h-3" /> Link Externo
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        type="button"
                                        onClick={(e) => handleEdit(ev, e)}
                                        className="p-2 bg-white border-2 border-black hover:bg-black hover:text-white transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                        title="Editar"
                                    >
                                        <Edit2 className="w-4 h-4 pointer-events-none" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => handleDelete(ev.id, e)}
                                        className="p-2 bg-white border-2 border-black hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="w-4 h-4 pointer-events-none" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {sortedEvents.length === 0 && (
                            <div className="col-span-full py-12 text-center border-4 border-dashed border-neutral-300">
                                <QrCode className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
                                <p className="text-neutral-400 font-bold uppercase tracking-widest">No hay eventos cargados</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Events;
