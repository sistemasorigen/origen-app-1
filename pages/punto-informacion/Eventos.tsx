import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import ModalCompartirQR from '../../components/modals/ModalCompartirQR';
import { QrCode, Trash2, Calendar, ExternalLink, Plus, Clock, Edit2 } from 'lucide-react';

const Events: React.FC = () => {
    const navigate = useNavigate();
    const { events, deleteEvent, showNotification } = useStore();
    const [qrModal, setQrModal] = useState<{ open: boolean, title: string, url: string, link: string }>({ open: false, title: '', url: '', link: '' });

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        await deleteEvent(id);
        showNotification('Evento eliminado.');
    };

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

            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="font-black text-xl uppercase tracking-tight text-slate-900">Agenda de eventos</h3>
                <button
                    onClick={() => navigate('/punto-de-informacion/eventos/nuevo')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-black text-white font-bold uppercase text-xs tracking-widest rounded-lg hover:bg-slate-800 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Crear evento
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sortedEvents.map(ev => (
                    <div
                        key={ev.id}
                        onClick={() => setQrModal({ open: true, title: ev.name, url: getSafeQrUrl(ev.qrCodeUrl, ev.name, ev.link), link: ev.link || window.location.href })}
                        className="bg-white p-5 border border-slate-200 rounded-lg shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group flex items-start gap-4 relative"
                    >
                        <div className="w-24 h-24 bg-white border border-slate-200 rounded-lg flex-shrink-0 p-1">
                            <img src={getSafeQrUrl(ev.qrCodeUrl, ev.name, ev.link)} alt="QR" className="w-full h-full object-contain" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <h4 className="font-black text-slate-900 uppercase tracking-tight text-lg leading-tight mb-2 line-clamp-2">{ev.name}</h4>

                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                    <Calendar className="w-4 h-4 text-slate-400" />
                                    <span>{new Date(ev.date + 'T00:00:00').toLocaleDateString()}</span>
                                </div>
                                {(ev.startTime || ev.endTime) && (
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-100 inline-flex self-start px-2 py-0.5 rounded-full">
                                        <Clock className="w-3 h-3" />
                                        <span>{ev.startTime || '--:--'} - {ev.endTime || '--:--'}</span>
                                    </div>
                                )}
                                {ev.description && (
                                    <p className="text-xs font-medium text-slate-500 mt-2 line-clamp-2 border-l-2 border-slate-200 pl-2">{ev.description}</p>
                                )}
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                                <div>
                                    {ev.link && (
                                        <div className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#118f46] hover:text-slate-900 transition-colors">
                                            <ExternalLink className="w-3 h-3" /> Link externo
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/punto-de-informacion/eventos/nuevo?id=${ev.id}`); }}
                                        className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-black hover:bg-slate-100 transition-colors shadow-sm"
                                        title="Editar"
                                    >
                                        <Edit2 className="w-4 h-4 pointer-events-none" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => handleDelete(ev.id, e)}
                                        className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors shadow-sm"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="w-4 h-4 pointer-events-none" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                {sortedEvents.length === 0 && (
                    <div className="col-span-full py-12 text-center border border-dashed border-slate-200 rounded-lg bg-white">
                        <QrCode className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No hay eventos cargados</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Events;
