import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { Announcement } from '../../types';
import { Megaphone, Plus, Pencil, Trash2, CheckCircle, AlertCircle, QrCode } from 'lucide-react';
import ModalCompartirQR from '../../components/modals/ModalCompartirQR';

const Announcements: React.FC = () => {
    const navigate = useNavigate();
    const { announcements, updateAnnouncement, deleteAnnouncement } = useStore();
    const [qrModal, setQrModal] = useState<{ open: boolean, title: string, url: string, link: string }>({ open: false, title: '', url: '', link: '' });
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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

    const isAnnouncementActive = (a: Announcement) => a.isActive !== false;

    const handleToggleActive = (a: Announcement) => {
        updateAnnouncement({ ...a, isActive: !isAnnouncementActive(a) });
    };

    const handleDelete = (id: string) => setDeleteConfirmId(id);

    const confirmDelete = () => {
        if (deleteConfirmId) {
            deleteAnnouncement(deleteConfirmId);
            setDeleteConfirmId(null);
        }
    };

    return (
        <div className="space-y-6">
            <ModalCompartirQR
                isOpen={qrModal.open}
                onClose={() => setQrModal({ ...qrModal, open: false })}
                title={qrModal.title}
                qrUrl={qrModal.url}
                link={qrModal.link}
            />

            {deleteConfirmId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white border border-slate-200 rounded-lg shadow-xl p-6 w-full max-w-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-50 text-red-600 rounded-lg"><Trash2 className="w-5 h-5" /></div>
                            <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Eliminar anuncio</h2>
                        </div>
                        <p className="text-sm font-medium text-slate-500 mb-6">¿Seguro que querés eliminar este anuncio? Esta acción no se puede deshacer.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="flex-1 py-2.5 border border-slate-200 rounded-lg font-bold uppercase text-xs tracking-widest text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-bold uppercase text-xs tracking-widest hover:bg-red-700 transition-colors"
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">Anuncios registrados</h2>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold bg-slate-200 text-slate-600 px-2 py-1 rounded-full">
                            {announcements.length} total
                        </span>
                        <button
                            onClick={() => navigate('/punto-de-informacion/anuncios/nuevo')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white font-bold uppercase text-xs tracking-widest rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Nuevo anuncio
                        </button>
                    </div>
                </div>

                {announcements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 border border-dashed border-slate-200 rounded-lg m-6">
                        <Megaphone className="w-12 h-12 text-slate-300 mb-3" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-sm text-center">
                            Aún no hay anuncios.<br />¡Crea el primero!
                        </p>
                    </div>
                ) : (
                    <>
                        {/* --- MOBILE CARD LIST (visible on sm, hidden on md+) --- */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {announcements.map((a) => {
                                const active = isAnnouncementActive(a);
                                return (
                                    <div key={a.id} className={`p-4 space-y-3 ${active ? 'bg-white' : 'bg-slate-50'}`}>
                                        {/* Title + Status badge */}
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="font-bold uppercase tracking-tight text-sm leading-tight flex-1 text-slate-900">{a.title}</h3>
                                            <button
                                                onClick={() => handleToggleActive(a)}
                                                className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold uppercase transition-colors ${active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}
                                                title={active ? 'Click para desactivar' : 'Click para activar'}
                                            >
                                                {active ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                                {active ? 'Activo' : 'Inactivo'}
                                            </button>
                                        </div>

                                        {/* Dates row */}
                                        <div className="flex items-center gap-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                                            {a.isPermanent ? (
                                                <span className="inline-flex items-center gap-0.5 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-bold">∞ Permanente</span>
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
                                                    onClick={() => setQrModal({ open: true, title: a.title, url: getSafeQrUrl(a.qrCodeUrl, a.title, a.link), link: a.link || window.location.href })}
                                                    className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs font-bold uppercase text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                                                >
                                                    <QrCode className="w-3.5 h-3.5" /> QR
                                                </button>
                                            )}
                                            <button
                                                onClick={() => navigate(`/punto-de-informacion/anuncios/nuevo?id=${a.id}`)}
                                                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs font-bold uppercase text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                                            >
                                                <Pencil className="w-3.5 h-3.5" /> Editar
                                            </button>
                                            <button
                                                onClick={() => handleDelete(a.id)}
                                                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs font-bold uppercase text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
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
                                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-500">
                                    <tr>
                                        <th className="text-left px-6 py-3">Título</th>
                                        <th className="text-left px-4 py-3">Inicio</th>
                                        <th className="text-left px-4 py-3">Fin</th>
                                        <th className="text-left px-4 py-3">Estado</th>
                                        <th className="text-center px-4 py-3">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {announcements.map((a) => (
                                        <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-sm uppercase tracking-tight text-slate-900 min-w-[160px]">
                                                {a.title}
                                            </td>
                                            <td className="px-4 py-4 text-sm font-medium text-slate-600">
                                                {!a.isPermanent && a.startDate ? new Date(a.startDate + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}
                                            </td>
                                            <td className="px-4 py-4 text-sm font-medium text-slate-600">
                                                {a.isPermanent ? (
                                                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-xs font-bold">
                                                        ∞ Permanente
                                                    </span>
                                                ) : (
                                                    a.endDate ? new Date(a.endDate + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                <button
                                                    onClick={() => handleToggleActive(a)}
                                                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold uppercase transition-colors ${isAnnouncementActive(a) ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`}
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
                                                <div className="flex items-center justify-center gap-1">
                                                    {a.qrCodeUrl && (
                                                        <button
                                                            onClick={() => setQrModal({ open: true, title: a.title, url: getSafeQrUrl(a.qrCodeUrl, a.title, a.link), link: a.link || window.location.href })}
                                                            className="p-2 text-slate-400 hover:text-black hover:bg-slate-100 rounded transition-colors"
                                                            title="Ver QR"
                                                        >
                                                            <QrCode className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => navigate(`/punto-de-informacion/anuncios/nuevo?id=${a.id}`)}
                                                        className="p-2 text-slate-400 hover:text-black hover:bg-slate-100 rounded transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(a.id)}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
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
