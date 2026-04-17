import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { InfluosAttendee } from '../../types';
import { Plus, RefreshCw, Users, Star, Search, Edit2, Trash2, UserPlus } from 'lucide-react';
import { ToastProvider, useToast } from '../infopoint/context/ToastContext';
import InfluosNewModal from './InfluosNewModal';
import InfluosEditModal from './InfluosEditModal';

// ── TRIBE CONFIG ──────────────────────────────────────────────
const TRIBE_CONFIG: Record<string, { label: string; bg: string; text: string; accent: string }> = {
    'roja':             { label: 'Roja',     bg: 'bg-red-500',      text: 'text-white',      accent: 'bg-red-500' },
    'azul':             { label: 'Azul',     bg: 'bg-blue-500',     text: 'text-white',      accent: 'bg-blue-500' },
    'verde':            { label: 'Verde',    bg: 'bg-emerald-500',  text: 'text-white',      accent: 'bg-emerald-500' },
    'amarilla':         { label: 'Amarilla', bg: 'bg-yellow-400',   text: 'text-black',      accent: 'bg-yellow-400' },
    'violeta':          { label: 'Violeta',  bg: 'bg-violet-500',   text: 'text-white',      accent: 'bg-violet-500' },
    'rosa':             { label: 'Rosa',     bg: 'bg-pink-500',     text: 'text-white',      accent: 'bg-pink-500' },
    'celeste':          { label: 'Trueno',   bg: 'bg-sky-400',      text: 'text-white',      accent: 'bg-sky-400' },
    'trueno (celeste)': { label: 'Trueno',   bg: 'bg-sky-400',      text: 'text-white',      accent: 'bg-sky-400' },
    'naranja':          { label: 'Garra',    bg: 'bg-orange-500',   text: 'text-white',      accent: 'bg-orange-500' },
    'garra (naranja)':  { label: 'Garra',    bg: 'bg-orange-500',   text: 'text-white',      accent: 'bg-orange-500' },
    'blanca':           { label: 'Blanca',   bg: 'bg-gray-100',     text: 'text-gray-700',   accent: 'bg-gray-200' },
    'negra':            { label: 'Negra',    bg: 'bg-neutral-900',  text: 'text-white',      accent: 'bg-neutral-900' },
};

const getTribeConfig = (tribe?: string) => {
    if (!tribe) return null;
    return TRIBE_CONFIG[tribe.toLowerCase().trim()] ?? null;
};

const TribeBadge: React.FC<{ tribe?: string }> = ({ tribe }) => {
    const t = getTribeConfig(tribe);
    if (!t) return <span className="text-gray-400 text-xs italic">—</span>;
    return (
        <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-black uppercase tracking-wide ${t.bg} ${t.text}`}>
            {t.label}
        </span>
    );
};

// ── STAT CARD ─────────────────────────────────────────────────
interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: number;
    sub: string;
    active: boolean;
    onClick: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, sub, active, onClick }) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center justify-center py-4 px-2 gap-1 transition-colors active:opacity-70 min-h-[88px] ${
            active
                ? 'bg-violet-500 text-white'
                : 'bg-white dark:bg-zinc-900 text-black dark:text-white hover:bg-violet-50 dark:hover:bg-zinc-800'
        }`}
    >
        <div className={`flex items-center gap-1.5 ${active ? 'text-white/80' : 'text-violet-500'}`}>
            {icon}
            <span className={`text-[11px] font-black uppercase tracking-wider leading-none ${active ? 'text-white/80' : 'text-gray-500 dark:text-zinc-400'}`}>
                {label}
            </span>
        </div>
        <p className="text-[2rem] font-black leading-none tabular-nums">{value}</p>
        <p className={`text-[10px] font-bold uppercase leading-none ${active ? 'text-white/60' : 'text-gray-400 dark:text-zinc-500'}`}>
            {sub}
        </p>
    </button>
);

// ── TRIBE HELPERS ─────────────────────────────────────────────
const isTrueno = (tribe?: string) => {
    const t = tribe?.toLowerCase().trim();
    return t === 'celeste' || t === 'trueno (celeste)';
};
const isGarra = (tribe?: string) => {
    const t = tribe?.toLowerCase().trim();
    return t === 'naranja' || t === 'garra (naranja)';
};

// ── MAIN COMPONENT ────────────────────────────────────────────
const InfluosContent: React.FC = () => {
    const toast = useToast();
    const [attendees, setAttendees] = useState<InfluosAttendee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [editingAttendee, setEditingAttendee] = useState<InfluosAttendee | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<InfluosAttendee | null>(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [filterType, setFilterType] = useState<'all' | 'first_time' | 'returning'>('all');
    const [tribeFilter, setTribeFilter] = useState<'all' | 'trueno' | 'garra'>('all');

    const fetchAttendees = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('influos_attendees')
            .select('*')
            .order('created_at', { ascending: false });
        if (data) setAttendees(data as InfluosAttendee[]);
        if (error) console.error('[Influos] Error:', error);
        setIsLoading(false);
    };

    useEffect(() => { fetchAttendees(); }, []);

    const filtered = attendees.filter(a => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = (
            a.first_name.toLowerCase().includes(term) ||
            a.last_name.toLowerCase().includes(term) ||
            a.phone.includes(term)
        );
        if (!matchesSearch) return false;
        if (filterType === 'first_time' && !a.is_first_time) return false;
        if (filterType === 'returning' && a.is_first_time) return false;
        if (tribeFilter === 'trueno' && !isTrueno(a.tribe)) return false;
        if (tribeFilter === 'garra' && !isGarra(a.tribe)) return false;
        return true;
    });

    const firstTimersCount = attendees.filter(a => a.is_first_time).length;
    const returningCount = attendees.filter(a => !a.is_first_time).length;
    const truenoCount = attendees.filter(a => isTrueno(a.tribe)).length;
    const garraCount = attendees.filter(a => isGarra(a.tribe)).length;

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        try {
            const { error } = await supabase
                .from('influos_attendees')
                .delete()
                .eq('id', deleteTarget.id);
            if (error) throw error;
            toast.success('Asistente eliminado.');
            fetchAttendees();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error desconocido';
            toast.error('Error al eliminar: ' + msg);
        } finally {
            setDeleteTarget(null);
            setIsDeleteConfirmOpen(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">

            {/* ── HEADER ─────────────────────────────────── */}
            <div className="bg-black text-white px-4 md:px-8 pt-5 pb-5 border-b-4 border-violet-500">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 bg-violet-500 flex items-center justify-center shrink-0">
                            <Star className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-none">
                                Influos
                            </h1>
                            <p className="text-violet-400 font-bold text-[11px] uppercase tracking-widest mt-0.5">
                                Gestión de Asistentes
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={fetchAttendees}
                            aria-label="Actualizar lista"
                            className="w-11 h-11 flex items-center justify-center border-2 border-white/30 hover:border-white transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 text-white ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={() => setIsNewModalOpen(true)}
                            className="h-11 flex items-center gap-2 px-4 bg-violet-500 text-white text-xs font-black uppercase tracking-widest border-2 border-violet-400 hover:bg-violet-400 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Nuevo</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ── STATS BAR ──────────────────────────────── */}
            <div className="bg-white dark:bg-zinc-900 border-b-2 border-black dark:border-zinc-700">
                {/* Fila 1: Total / Nuevos / Regulares */}
                <div className="max-w-7xl mx-auto grid grid-cols-3 divide-x-2 divide-black dark:divide-zinc-700">
                    <StatCard
                        icon={<Users size={14} />}
                        label="Total"
                        value={attendees.length}
                        sub="Asistentes"
                        active={filterType === 'all'}
                        onClick={() => setFilterType('all')}
                    />
                    <StatCard
                        icon={<Star size={14} />}
                        label="Nuevos"
                        value={firstTimersCount}
                        sub="Primera vez"
                        active={filterType === 'first_time'}
                        onClick={() => setFilterType('first_time')}
                    />
                    <StatCard
                        icon={<RefreshCw size={14} />}
                        label="Regulares"
                        value={returningCount}
                        sub="Ya vinieron"
                        active={filterType === 'returning'}
                        onClick={() => setFilterType('returning')}
                    />
                </div>

                {/* Fila 2: Trueno / Garra */}
                <div className="max-w-7xl mx-auto grid grid-cols-2 border-t-2 border-black dark:border-zinc-700 divide-x-2 divide-black dark:divide-zinc-700">
                    <button
                        onClick={() => setTribeFilter(tribeFilter === 'trueno' ? 'all' : 'trueno')}
                        className={`flex flex-col items-center justify-center py-4 px-2 gap-1 min-h-[80px] transition-colors active:opacity-70 ${
                            tribeFilter === 'trueno'
                                ? 'bg-sky-500 text-white'
                                : 'bg-white dark:bg-zinc-900 text-black dark:text-white hover:bg-sky-50 dark:hover:bg-zinc-800'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 shrink-0 ${tribeFilter === 'trueno' ? 'bg-white' : 'bg-sky-400'}`} />
                            <span className={`text-[11px] font-black uppercase tracking-wider leading-none ${tribeFilter === 'trueno' ? 'text-white/80' : 'text-gray-500 dark:text-zinc-400'}`}>
                                Trueno
                            </span>
                        </div>
                        <p className="text-[2rem] font-black leading-none tabular-nums">{truenoCount}</p>
                        <p className={`text-[10px] font-bold uppercase leading-none ${tribeFilter === 'trueno' ? 'text-white/60' : 'text-gray-400 dark:text-zinc-500'}`}>
                            Celeste
                        </p>
                    </button>
                    <button
                        onClick={() => setTribeFilter(tribeFilter === 'garra' ? 'all' : 'garra')}
                        className={`flex flex-col items-center justify-center py-4 px-2 gap-1 min-h-[80px] transition-colors active:opacity-70 ${
                            tribeFilter === 'garra'
                                ? 'bg-orange-500 text-white'
                                : 'bg-white dark:bg-zinc-900 text-black dark:text-white hover:bg-orange-50 dark:hover:bg-zinc-800'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 shrink-0 ${tribeFilter === 'garra' ? 'bg-white' : 'bg-orange-500'}`} />
                            <span className={`text-[11px] font-black uppercase tracking-wider leading-none ${tribeFilter === 'garra' ? 'text-white/80' : 'text-gray-500 dark:text-zinc-400'}`}>
                                Garra
                            </span>
                        </div>
                        <p className="text-[2rem] font-black leading-none tabular-nums">{garraCount}</p>
                        <p className={`text-[10px] font-bold uppercase leading-none ${tribeFilter === 'garra' ? 'text-white/60' : 'text-gray-400 dark:text-zinc-500'}`}>
                            Naranja
                        </p>
                    </button>
                </div>

            </div>

            {/* ── CONTENT ────────────────────────────────── */}
            <div className="max-w-7xl mx-auto px-4 md:px-8 pt-4 pb-16">

                {/* Buscador */}
                <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, apellido o teléfono..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 text-sm font-bold"
                        style={{ borderRadius: 0 }}
                    />
                </div>



                {/* Skeleton loading */}
                {isLoading && (
                    <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-[88px] bg-white dark:bg-zinc-800 animate-pulse border-l-4 border-gray-200" />
                        ))}
                    </div>
                )}

                {!isLoading && (
                    <>
                        {/* ── DESKTOP TABLE ───────────────────── */}
                        <div className="hidden md:block">
                            <table className="w-full border-2 border-black dark:border-white">
                                <thead>
                                    <tr className="bg-black text-white">
                                        <th className="px-4 py-3 text-left text-xs font-black uppercase">Nombre</th>
                                        <th className="px-4 py-3 text-left text-xs font-black uppercase">Apellido</th>
                                        <th className="px-4 py-3 text-left text-xs font-black uppercase">Edad</th>
                                        <th className="px-4 py-3 text-left text-xs font-black uppercase">Celular</th>
                                        <th className="px-4 py-3 text-left text-xs font-black uppercase">Tribu</th>
                                        <th className="px-4 py-3 text-left text-xs font-black uppercase">Tipo</th>
                                        <th className="px-4 py-3 text-left text-xs font-black uppercase">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-16 text-center">
                                                <div className="flex flex-col items-center gap-3 opacity-40">
                                                    <Star className="w-12 h-12" />
                                                    <span className="font-black uppercase text-lg">Sin asistentes registrados</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filtered.map(attendee => (
                                            <tr key={attendee.id} className="border-b border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800">
                                                <td className="px-4 py-3 font-bold text-sm dark:text-white">{attendee.first_name}</td>
                                                <td className="px-4 py-3 font-bold text-sm dark:text-white">{attendee.last_name}</td>
                                                <td className="px-4 py-3 font-bold text-sm dark:text-white">{attendee.age}</td>
                                                <td className="px-4 py-3 font-bold text-sm dark:text-white">{attendee.phone}</td>
                                                <td className="px-4 py-3"><TribeBadge tribe={attendee.tribe} /></td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 text-[10px] font-black uppercase ${attendee.is_first_time ? 'bg-violet-100 text-violet-700' : 'bg-neutral-100 text-neutral-500'}`}>
                                                        {attendee.is_first_time ? 'Primera vez' : 'Regular'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => setEditingAttendee(attendee)}
                                                            aria-label="Editar asistente"
                                                            className="w-9 h-9 flex items-center justify-center border-2 border-black dark:border-white hover:bg-amber-500 hover:border-amber-500 hover:text-white dark:text-white transition-all"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => { setDeleteTarget(attendee); setIsDeleteConfirmOpen(true); }}
                                                            aria-label="Eliminar asistente"
                                                            className="w-9 h-9 flex items-center justify-center border-2 border-black dark:border-white hover:bg-red-500 hover:border-red-500 hover:text-white dark:text-white transition-all"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* ── MOBILE CARDS ────────────────────── */}
                        <div className="md:hidden space-y-2">
                            {filtered.length === 0 ? (
                                <div className="flex flex-col items-center gap-4 py-16 text-center">
                                    <div className="w-16 h-16 border-2 border-gray-200 dark:border-zinc-700 flex items-center justify-center">
                                        <Star className="w-7 h-7 text-gray-300 dark:text-zinc-600" />
                                    </div>
                                    <div>
                                        <p className="font-black uppercase text-sm text-gray-500 dark:text-zinc-400">
                                            Sin asistentes registrados
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1 font-medium">
                                            Todavía no hay nadie en la lista
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setIsNewModalOpen(true)}
                                        className="flex items-center gap-2 px-6 h-11 bg-black text-white text-xs font-black uppercase tracking-widest border-2 border-black hover:bg-violet-600 hover:border-violet-600 transition-colors"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        Agregar primero
                                    </button>
                                </div>
                            ) : (
                                filtered.map(attendee => {
                                    const tribeConf = getTribeConfig(attendee.tribe);
                                    return (
                                        <div
                                            key={attendee.id}
                                            className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-zinc-700 flex overflow-hidden"
                                        >
                                            {/* Tribe accent bar */}
                                            <div className={`w-1.5 shrink-0 ${tribeConf?.accent ?? 'bg-gray-200 dark:bg-zinc-700'}`} />

                                            <div className="flex-1 p-3 min-w-0">
                                                {/* Name row */}
                                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                                    <p className="font-black text-[15px] text-black dark:text-white leading-tight truncate">
                                                        {attendee.first_name} {attendee.last_name}
                                                    </p>
                                                    <span className={`shrink-0 px-2 py-0.5 text-[10px] font-black uppercase ${attendee.is_first_time ? 'bg-violet-500 text-white' : 'bg-gray-100 dark:bg-zinc-700 text-gray-500 dark:text-zinc-300'}`}>
                                                        {attendee.is_first_time ? 'Nuevo' : 'Regular'}
                                                    </span>
                                                </div>

                                                {/* Meta row */}
                                                <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium mb-2">
                                                    {attendee.phone} · {attendee.age} años
                                                </p>

                                                {/* Tribe + actions row */}
                                                <div className="flex items-center justify-between gap-2">
                                                    <TribeBadge tribe={attendee.tribe} />
                                                    <div className="flex gap-1.5 shrink-0">
                                                        <button
                                                            onClick={() => setEditingAttendee(attendee)}
                                                            aria-label="Editar"
                                                            className="h-9 px-3 flex items-center gap-1.5 text-[11px] font-black uppercase border-2 border-black dark:border-zinc-600 hover:bg-amber-500 hover:border-amber-500 hover:text-white dark:text-white transition-all"
                                                        >
                                                            <Edit2 className="w-3 h-3" />
                                                            Editar
                                                        </button>
                                                        <button
                                                            onClick={() => { setDeleteTarget(attendee); setIsDeleteConfirmOpen(true); }}
                                                            aria-label="Eliminar"
                                                            className="h-9 px-3 flex items-center gap-1.5 text-[11px] font-black uppercase border-2 border-black dark:border-zinc-600 hover:bg-red-500 hover:border-red-500 hover:text-white dark:text-white transition-all"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                            Eliminar
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* ── DELETE CONFIRM ─────────────────────────── */}
            {isDeleteConfirmOpen && deleteTarget && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-white w-full max-w-sm">
                        <div className="px-5 py-4 border-b-2 border-black dark:border-zinc-700">
                            <h3 className="font-black uppercase text-base text-black dark:text-white leading-none">
                                ¿Eliminar asistente?
                            </h3>
                        </div>
                        <div className="p-5">
                            <p className="text-sm text-gray-600 dark:text-zinc-400 font-medium mb-5 leading-relaxed">
                                Se eliminará a{' '}
                                <strong className="text-black dark:text-white font-black">
                                    {deleteTarget.first_name} {deleteTarget.last_name}
                                </strong>{' '}
                                del sistema. Esta acción no se puede deshacer.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setIsDeleteConfirmOpen(false); setDeleteTarget(null); }}
                                    className="flex-1 h-12 border-2 border-black dark:border-white text-xs font-black uppercase hover:bg-gray-100 dark:hover:bg-zinc-800 dark:text-white transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDeleteConfirm}
                                    className="flex-1 h-12 bg-red-600 text-white border-2 border-red-600 text-xs font-black uppercase hover:bg-red-700 transition-colors"
                                >
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODALS ────────────────────────────────── */}
            <InfluosNewModal
                isOpen={isNewModalOpen}
                onClose={() => setIsNewModalOpen(false)}
                onSuccess={fetchAttendees}
            />
            <InfluosEditModal
                attendee={editingAttendee}
                isOpen={!!editingAttendee}
                onClose={() => setEditingAttendee(null)}
                onUpdate={fetchAttendees}
            />
        </div>
    );
};

const InfluosPage: React.FC = () => (
    <ToastProvider>
        <InfluosContent />
    </ToastProvider>
);

export default InfluosPage;
