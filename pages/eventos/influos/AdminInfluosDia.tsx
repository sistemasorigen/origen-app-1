import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInfluosDiaRegistrations, deleteInfluosDiaRegistration } from '../../../services/supabaseService';
import { InfluosDiaRegistration, User } from '../../../types';
import { ChevronLeft, Search, Plus, Trash2, Loader2, Flame } from 'lucide-react';

interface AdminInfluosDiaProps {
    currentUser: User;
}

const AdminInfluosDia: React.FC<AdminInfluosDiaProps> = () => {
    const navigate = useNavigate();
    const [registrations, setRegistrations] = useState<InfluosDiaRegistration[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const fetchRegistrations = async () => {
        setLoading(true);
        const data = await getInfluosDiaRegistrations();
        setRegistrations(data);
        setLoading(false);
    };

    useEffect(() => { fetchRegistrations(); }, []);

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        const success = await deleteInfluosDiaRegistration(id);
        setDeletingId(null);
        setConfirmDeleteId(null);
        if (success) {
            setRegistrations(prev => prev.filter(r => r.id !== id));
        }
    };

    const filtered = registrations.filter(r => {
        const term = searchTerm.toLowerCase().trim();
        if (!term) return true;
        return (
            r.firstName.toLowerCase().includes(term) ||
            r.lastName.toLowerCase().includes(term) ||
            r.tribu.toLowerCase().includes(term)
        );
    });

    const tribuBadgeColor = (tribu: string) => {
        if (tribu === 'Garra') return 'bg-red-50 text-red-700';
        if (tribu === 'Trueno') return 'bg-indigo-50 text-indigo-700';
        return 'bg-slate-100 text-slate-500';
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
                            <Flame className="w-7 h-7 text-teal-600" />
                            Día de Influos
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            {registrations.length} inscripción{registrations.length !== 1 ? 'es' : ''}
                        </p>
                    </div>

                    <button
                        onClick={() => navigate('/eventos/admin/dia-de-influos/nueva')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-black text-white font-semibold text-sm rounded-lg hover:bg-slate-800 transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Inscripción manual
                    </button>
                </div>

                <div className="relative mb-4 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, apellido o tribu..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-black text-sm bg-white"
                    />
                </div>

                {/* ── Mobile: tarjetas (la tabla no entra en el ancho y
                    "Acciones" quedaba recortado por el overflow-hidden
                    del contenedor) ── */}
                <div className="md:hidden space-y-3">
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 text-sm">
                            {searchTerm ? 'Sin resultados para esa búsqueda' : 'Todavía no hay inscripciones'}
                        </div>
                    ) : filtered.map(r => (
                        <div key={r.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                            <div className="flex items-start justify-between gap-2 mb-3">
                                <div>
                                    <p className="font-bold text-sm text-slate-900">{r.firstName} {r.lastName}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">{r.age} años</p>
                                </div>
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase shrink-0 ${tribuBadgeColor(r.tribu)}`}>
                                    {r.tribu}
                                </span>
                            </div>

                            <div className="flex gap-2">
                                {confirmDeleteId === r.id ? (
                                    <button
                                        onClick={() => handleDelete(r.id)}
                                        disabled={deletingId === r.id}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-black uppercase text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                                    >
                                        {deletingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '¿Confirmar borrado?'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setConfirmDeleteId(r.id)}
                                        className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
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
                            {searchTerm ? 'Sin resultados para esa búsqueda' : 'Todavía no hay inscripciones'}
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Nombre</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Apellido</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Edad</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Tribu</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="px-4 py-3 font-semibold text-sm text-slate-900">{r.firstName}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600">{r.lastName}</td>
                                        <td className="px-4 py-3 text-center text-sm text-slate-600">{r.age}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${tribuBadgeColor(r.tribu)}`}>
                                                {r.tribu}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end">
                                                {confirmDeleteId === r.id ? (
                                                    <button
                                                        onClick={() => handleDelete(r.id)}
                                                        disabled={deletingId === r.id}
                                                        className="px-2 py-1.5 text-[10px] font-black uppercase text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                                                    >
                                                        {deletingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirmar'}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => setConfirmDeleteId(r.id)}
                                                        className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
                                                        title="Borrar"
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

export default AdminInfluosDia;
