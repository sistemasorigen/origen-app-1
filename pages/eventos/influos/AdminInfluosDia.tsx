import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInfluosDiaRegistrations, deleteInfluosDiaRegistration, updateInfluosDiaTribu } from '../../../services/supabaseService';
import { InfluosDiaRegistration, InfluosDiaTribu, User } from '../../../types';
import { ChevronLeft, Search, Plus, Trash2, Loader2, Swords, Receipt, ChevronDown } from 'lucide-react';

interface AdminInfluosDiaProps {
    currentUser: User;
}

const AdminInfluosDia: React.FC<AdminInfluosDiaProps> = () => {
    const navigate = useNavigate();
    const [registrations, setRegistrations] = useState<InfluosDiaRegistration[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [tribuFilter, setTribuFilter] = useState<'all' | InfluosDiaTribu>('all');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [updatingTribuId, setUpdatingTribuId] = useState<string | null>(null);

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

    // Sin optimistic update: el badge sólo cambia de color cuando la DB
    // confirmó el nuevo valor. Si falla, se queda mostrando la tribu vieja
    // en vez de mentir un cambio que no se guardó.
    const handleTribuChange = async (id: string, tribu: InfluosDiaTribu) => {
        setUpdatingTribuId(id);
        const success = await updateInfluosDiaTribu(id, tribu);
        setUpdatingTribuId(null);
        if (success) {
            setRegistrations(prev => prev.map(r => r.id === id ? { ...r, tribu } : r));
        }
    };

    const filtered = registrations.filter(r => {
        if (tribuFilter !== 'all' && r.tribu !== tribuFilter) return false;

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

    // Conteo por tribu para el subtítulo — a las puertas del evento el
    // staff necesita saber de un vistazo cómo viene la carga de cada
    // equipo, no sólo el total.
    const countGarra = registrations.filter(r => r.tribu === 'Garra').length;
    const countTrueno = registrations.filter(r => r.tribu === 'Trueno').length;

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-5xl mx-auto">
                <button
                    onClick={() => navigate('/panel-eventos')}
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400 hover:text-black transition-colors mb-4"
                >
                    <ChevronLeft className="w-4 h-4" /> Panel de Eventos
                </button>

                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-3">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-black flex items-center gap-2">
                            <Swords className="w-6 h-6 md:w-7 md:h-7 text-teal-600 shrink-0" />
                            Tribal Wars
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            {registrations.length} inscripción{registrations.length !== 1 ? 'es' : ''} · {countGarra} Garra · {countTrueno} Trueno
                        </p>
                    </div>

                    {/* Ancho completo en mobile: es la acción primaria de la página
                        y en la puerta se toca con una sola mano, apurado. */}
                    <button
                        onClick={() => navigate('/eventos/admin/tribal-wars/nueva')}
                        className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white font-semibold text-sm rounded-lg hover:bg-slate-800 transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Inscripción manual
                    </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, apellido o tribu..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-full outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 text-sm bg-white transition-all"
                        />
                    </div>

                    {/* Filtro por tribu — mismo criterio de color que el badge de
                        cada tarjeta/fila, así el filtro activo anticipa lo que va
                        a mostrar. "Sin tribu" es sólo la etiqueta del botón: el
                        valor real que filtra sigue siendo 'No tengo'. */}
                    <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-full w-fit overflow-x-auto max-w-full">
                        <button
                            type="button"
                            onClick={() => setTribuFilter('all')}
                            aria-pressed={tribuFilter === 'all'}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${tribuFilter === 'all'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            Todos
                        </button>
                        <button
                            type="button"
                            onClick={() => setTribuFilter('Garra')}
                            aria-pressed={tribuFilter === 'Garra'}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${tribuFilter === 'Garra'
                                ? 'bg-red-600 text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            Garra
                        </button>
                        <button
                            type="button"
                            onClick={() => setTribuFilter('Trueno')}
                            aria-pressed={tribuFilter === 'Trueno'}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${tribuFilter === 'Trueno'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            Trueno
                        </button>
                        <button
                            type="button"
                            onClick={() => setTribuFilter('No tengo')}
                            aria-pressed={tribuFilter === 'No tengo'}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${tribuFilter === 'No tengo'
                                ? 'bg-slate-600 text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            Sin tribu
                        </button>
                    </div>
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
                            {searchTerm || tribuFilter !== 'all' ? 'Sin resultados para esa búsqueda' : 'Todavía no hay inscripciones'}
                        </div>
                    ) : filtered.map(r => (
                        <div key={r.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                            <div className="flex items-start justify-between gap-2 mb-3">
                                <div>
                                    <p className="font-bold text-sm text-slate-900">{r.firstName} {r.lastName}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">{r.age} años</p>
                                </div>
                                {/* El badge de tribu es el select: mismo color que antes,
                                    ahora editable. Nativo a propósito — en mobile abre el
                                    picker del sistema, más rápido de tocar que un dropdown
                                    custom para un cambio que puede pasar decenas de veces
                                    en la puerta (alguien se cambia de equipo, error de
                                    carga, etc). */}
                                <div className="relative inline-block shrink-0">
                                    <select
                                        value={r.tribu}
                                        onChange={e => handleTribuChange(r.id, e.target.value as InfluosDiaTribu)}
                                        disabled={updatingTribuId === r.id}
                                        aria-label={`Tribu de ${r.firstName} ${r.lastName}`}
                                        className={`appearance-none cursor-pointer pl-2.5 pr-6 py-1 rounded-full text-[10px] font-bold uppercase border-0 outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-slate-400 disabled:opacity-50 disabled:cursor-wait transition-colors ${tribuBadgeColor(r.tribu)}`}
                                    >
                                        <option value="Garra">Garra</option>
                                        <option value="Trueno">Trueno</option>
                                        <option value="No tengo">No tengo</option>
                                    </select>
                                    <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                                </div>
                            </div>

                            {/* Es entrada paga: sin esto no hay forma de verificar el pago
                                desde el celular, que es donde el staff de la puerta
                                realmente usa esta planilla. Va como badge tappable, no como
                                link de texto suelto — en la puerta se toca rápido y bajo
                                presión, un link angosto se falla. */}
                            <div className="flex flex-wrap gap-2 mb-4">
                                {r.comprobanteUrl ? (
                                    <a
                                        href={r.comprobanteUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase text-violet-700 bg-violet-50 hover:bg-violet-100 px-2.5 py-1.5 rounded-full transition-colors"
                                    >
                                        <Receipt className="w-3 h-3" /> Ver comprobante
                                    </a>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400 bg-slate-50 px-2.5 py-1.5 rounded-full">
                                        <Receipt className="w-3 h-3" /> Sin comprobante
                                    </span>
                                )}
                            </div>

                            <div className="flex gap-2">
                                {confirmDeleteId === r.id ? (
                                    <button
                                        onClick={() => handleDelete(r.id)}
                                        disabled={deletingId === r.id}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-black uppercase text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                                    >
                                        {deletingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '¿Confirmar borrado?'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setConfirmDeleteId(r.id)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
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
                            {searchTerm || tribuFilter !== 'all' ? 'Sin resultados para esa búsqueda' : 'Todavía no hay inscripciones'}
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Nombre</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Apellido</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Edad</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Tribu</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Comprobante</th>
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
                                            <div className="relative inline-block">
                                                <select
                                                    value={r.tribu}
                                                    onChange={e => handleTribuChange(r.id, e.target.value as InfluosDiaTribu)}
                                                    disabled={updatingTribuId === r.id}
                                                    aria-label={`Tribu de ${r.firstName} ${r.lastName}`}
                                                    className={`appearance-none cursor-pointer pl-2.5 pr-6 py-1 rounded-full text-[10px] font-bold uppercase border-0 outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-slate-400 disabled:opacity-50 disabled:cursor-wait transition-colors ${tribuBadgeColor(r.tribu)}`}
                                                >
                                                    <option value="Garra">Garra</option>
                                                    <option value="Trueno">Trueno</option>
                                                    <option value="No tengo">No tengo</option>
                                                </select>
                                                <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {r.comprobanteUrl ? (
                                                <a
                                                    href={r.comprobanteUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 hover:underline"
                                                >
                                                    Ver comprobante
                                                </a>
                                            ) : (
                                                <span className="text-xs text-slate-300">—</span>
                                            )}
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
