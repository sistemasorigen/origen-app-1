import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEventosGeneralAdmin, toggleEventoGeneralVisibility, deleteEventoGeneral } from '../../../services/supabaseService';
import { EventoGeneral, User } from '../../../types';
import { ChevronLeft, Search, Plus, Trash2, Eye, EyeOff, Edit2, Loader2, CalendarDays, Clock } from 'lucide-react';

interface AdminEventosGeneralProps {
    currentUser: User;
}

const AdminEventosGeneral: React.FC<AdminEventosGeneralProps> = () => {
    const navigate = useNavigate();
    const [eventos, setEventos] = useState<EventoGeneral[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const fetchEventos = async () => {
        setLoading(true);
        const data = await getEventosGeneralAdmin();
        setEventos(data);
        setLoading(false);
    };

    useEffect(() => { fetchEventos(); }, []);

    const handleToggleVisibility = async (evento: EventoGeneral) => {
        setTogglingId(evento.id);
        const success = await toggleEventoGeneralVisibility(evento.id, !evento.isVisible);
        setTogglingId(null);
        if (success) {
            setEventos(prev => prev.map(e => e.id === evento.id ? { ...e, isVisible: !e.isVisible } : e));
        }
    };

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        const success = await deleteEventoGeneral(id);
        setDeletingId(null);
        setConfirmDeleteId(null);
        if (success) {
            setEventos(prev => prev.filter(e => e.id !== id));
        }
    };

    const filtered = eventos.filter(e => {
        const term = searchTerm.toLowerCase().trim();
        if (!term) return true;
        return e.name.toLowerCase().includes(term);
    });

    const formatDateTime = (evento: EventoGeneral) => {
        const date = new Date(evento.startDate + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
        return evento.startTime ? `${date} · ${evento.startTime}` : date;
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-5xl mx-auto">
                <button
                    onClick={() => navigate('/panel-eventos')}
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400 hover:text-black transition-colors mb-4"
                >
                    <ChevronLeft className="w-4 h-4" /> Panel de Eventos
                </button>

                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                    <div>
                        <h1 className="text-3xl font-black uppercase tracking-tight text-black flex items-center gap-2">
                            <CalendarDays className="w-7 h-7 text-slate-700" />
                            Gestión de Eventos
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            {eventos.length} evento{eventos.length !== 1 ? 's' : ''}
                        </p>
                    </div>

                    <button
                        onClick={() => navigate('/eventos/admin/general/crear-evento')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-black text-white font-semibold text-sm rounded-lg hover:bg-slate-800 transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Crear carta de Evento
                    </button>
                </div>

                <div className="relative mb-4 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-black text-sm bg-white"
                    />
                </div>

                {/* ── Mobile: tarjetas (misma razón que en
                    AdminInfluosDia.tsx: la tabla con 3 acciones no
                    entra en el ancho y quedaba recortada por el
                    overflow-hidden del contenedor) ── */}
                <div className="md:hidden space-y-3">
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 text-sm">
                            {searchTerm ? 'Sin resultados para esa búsqueda' : 'Todavía no hay eventos cargados'}
                        </div>
                    ) : filtered.map(e => (
                        <div key={e.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                            <div className="flex items-start justify-between gap-2 mb-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    {e.imageUrl ? (
                                        <img src={e.imageUrl} alt={e.name} className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                            <CalendarDays className="w-4 h-4 text-slate-300" />
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm text-slate-900 truncate">{e.name}</p>
                                        <p className="text-xs text-slate-400 flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> {formatDateTime(e)}
                                        </p>
                                    </div>
                                </div>
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase shrink-0 ${e.isVisible ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {e.isVisible ? 'Visible' : 'Oculto'}
                                </span>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => navigate(`/eventos/admin/general/crear-evento?id=${e.id}`)}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                >
                                    <Edit2 className="w-3.5 h-3.5" /> Editar
                                </button>
                                <button
                                    onClick={() => handleToggleVisibility(e)}
                                    disabled={togglingId === e.id}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                >
                                    {togglingId === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : e.isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    {e.isVisible ? 'Ocultar' : 'Mostrar'}
                                </button>
                                {confirmDeleteId === e.id ? (
                                    <button
                                        onClick={() => handleDelete(e.id)}
                                        disabled={deletingId === e.id}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-black uppercase text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                                    >
                                        {deletingId === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '¿Confirmar?'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setConfirmDeleteId(e.id)}
                                        className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Desktop: tabla ── */}
                <div className="hidden md:block bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 text-sm">
                            {searchTerm ? 'Sin resultados para esa búsqueda' : 'Todavía no hay eventos cargados'}
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Evento</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Estado</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map(e => (
                                    <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                {e.imageUrl ? (
                                                    <img src={e.imageUrl} alt={e.name} className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                                        <CalendarDays className="w-4 h-4 text-slate-300" />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-sm text-slate-900 truncate">{e.name}</p>
                                                    <p className="text-xs text-slate-400 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" /> {formatDateTime(e)}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${e.isVisible ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {e.isVisible ? 'Visible' : 'Oculto'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end items-center gap-1">
                                                <button
                                                    onClick={() => navigate(`/eventos/admin/general/crear-evento?id=${e.id}`)}
                                                    className="p-1.5 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                                                    title="Editar"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleToggleVisibility(e)}
                                                    disabled={togglingId === e.id}
                                                    className={`p-1.5 rounded-lg transition-colors border ${e.isVisible ? 'text-slate-600 bg-slate-50 hover:bg-slate-100 border-slate-200' : 'text-white bg-slate-800 hover:bg-slate-700 border-slate-800'}`}
                                                    title={e.isVisible ? 'Ocultar' : 'Hacer visible'}
                                                >
                                                    {togglingId === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : e.isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                </button>
                                                {confirmDeleteId === e.id ? (
                                                    <button
                                                        onClick={() => handleDelete(e.id)}
                                                        disabled={deletingId === e.id}
                                                        className="px-2 py-1.5 text-[10px] font-black uppercase text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                                                    >
                                                        {deletingId === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirmar'}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => setConfirmDeleteId(e.id)}
                                                        className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminEventosGeneral;
