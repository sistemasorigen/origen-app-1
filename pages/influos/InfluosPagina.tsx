import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { InfluosAttendee } from '../../types';
import { Plus, RefreshCw, Users, Star, Search, Edit2, Trash2, UserPlus, X } from 'lucide-react';
import { ToastProvider, useToast } from '../punto-informacion/context/ContextoToast';
import InfluosNewModal from './InfluosModalNuevo';
import InfluosEditModal from './InfluosModalEditar';

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
    if (!t) return <span className="text-slate-300 dark:text-neutral-600 text-xs">—</span>;
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${t.bg} ${t.text}`}>
            {t.label}
        </span>
    );
};

// ── KPI CARD ──────────────────────────────────────────────────
// Mismo molde que las tarjetas del "Resumen del período" de
// AudienciaServiciosPrincipal.tsx: fondo tenue del color del dato, label en
// font-black diminuto con tracking ancho, número grande tabular y una línea
// de contexto abajo. Acá además son filtros, así que suman estado activo
// (color pleno) y foco visible.
interface KpiCardProps {
    icon: React.ReactNode;
    label: string;
    value: number;
    sub: string;
    active: boolean;
    onClick: () => void;
    idle: string;   // fondo + borde en reposo
    accent: string; // color del label en reposo
    on: string;     // fondo + borde activo
    ring: string;   // color del anillo de foco
}

const KpiCard: React.FC<KpiCardProps> = ({ icon, label, value, sub, active, onClick, idle, accent, on, ring }) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={`rounded-xl p-4 border text-left transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950 ${ring} ${active ? on : idle}`}
    >
        <p className={`text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-1.5 ${active ? 'text-white/70' : accent}`}>
            {icon}
            {label}
        </p>
        <p className={`text-3xl font-black tabular-nums leading-none ${active ? 'text-white' : 'text-black dark:text-white'}`}>
            {value.toLocaleString('es-AR')}
        </p>
        <p className={`text-[10px] font-medium mt-1 ${active ? 'text-white/60' : 'text-slate-400 dark:text-neutral-500'}`}>
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

    // Detectar ?action=new en la URL para abrir
    // el modal de creación automáticamente
    // (usado por el menú lateral)
    const [searchParams, setSearchParams] = useSearchParams();
    useEffect(() => {
        if (searchParams.get('action') === 'new') {
            setIsNewModalOpen(true);
            // Limpiar el query param para que no se
            // reabra el modal si el usuario recarga
            // o navega de vuelta
            searchParams.delete('action');
            setSearchParams(searchParams, { replace: true });
        }
    }, [searchParams]);

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

    const hayFiltros = filterType !== 'all' || tribeFilter !== 'all' || searchTerm !== '';

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 pb-16">
            {/* index.html impone `background-color: #fff !important` a TODO input
                de la app —también bajo .dark—, así que ninguna clase de Tailwind
                sobre el campo sobrevive. El marco lo dibuja el contenedor y el
                input se neutraliza acá por id, que es la única especificidad que
                le gana al override global. */}
            <style>{`
                #influos-search {
                    background-color: transparent !important;
                    border: 0 !important;
                    border-radius: 0 !important;
                    color: #0f172a !important;
                }
                .dark #influos-search { color: #ffffff !important; }
                #influos-search::placeholder { color: #94a3b8 !important; }
            `}</style>

            {/* ── HEADER ─────────────────────────────────────── */}
            {/* A sangre y con borde inferior, igual que Audiencia Servicios: la
                barra de título del módulo no es una tarjeta flotante. */}
            <div className="bg-white dark:bg-black border-b border-slate-200 dark:border-white">
                <div className="w-full px-4 sm:px-6 lg:px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
                            <Star className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tighter leading-none dark:text-white">Influos</h1>
                            <p className="text-[10px] text-slate-600 dark:text-neutral-400 font-mono uppercase tracking-wider">Gestión de Asistentes</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={fetchAttendees}
                            aria-label="Actualizar lista"
                            className="w-10 h-10 flex items-center justify-center border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-neutral-800 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black"
                        >
                            <RefreshCw className={`w-4 h-4 text-slate-700 dark:text-neutral-300 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={() => setIsNewModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black font-bold text-xs uppercase rounded-lg hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black"
                        >
                            <Plus className="w-4 h-4" />
                            Nuevo Asistente
                        </button>
                    </div>
                </div>
            </div>

            {/* ── CONTENT ────────────────────────────────────── */}
            <div className="w-full px-4 sm:px-6 lg:px-4 pt-8">

                {/* ── KPIs / FILTROS ─────────────────────────── */}
                <div className="grid grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
                    <KpiCard
                        icon={<Users className="w-3 h-3" />}
                        label="Total"
                        value={attendees.length}
                        sub="asistentes"
                        active={filterType === 'all'}
                        onClick={() => setFilterType('all')}
                        idle="bg-violet-50 dark:bg-violet-950/30 border-violet-100 dark:border-violet-900/50"
                        accent="text-violet-500 dark:text-violet-400"
                        on="bg-violet-600 border-violet-600"
                        ring="focus-visible:ring-violet-600"
                    />
                    <KpiCard
                        icon={<Star className="w-3 h-3" />}
                        label="Nuevos"
                        value={firstTimersCount}
                        sub="primera vez"
                        active={filterType === 'first_time'}
                        onClick={() => setFilterType('first_time')}
                        idle="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50"
                        accent="text-emerald-600 dark:text-emerald-400"
                        on="bg-emerald-600 border-emerald-600"
                        ring="focus-visible:ring-emerald-600"
                    />
                    <KpiCard
                        icon={<RefreshCw className="w-3 h-3" />}
                        label="Regulares"
                        value={returningCount}
                        sub="ya vinieron"
                        active={filterType === 'returning'}
                        onClick={() => setFilterType('returning')}
                        idle="bg-slate-50 dark:bg-neutral-800/50 border-slate-100 dark:border-neutral-700/50"
                        accent="text-slate-400 dark:text-neutral-500"
                        on="bg-slate-900 border-slate-900"
                        ring="focus-visible:ring-slate-900"
                    />
                    <KpiCard
                        icon={<span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />}
                        label="Trueno"
                        value={truenoCount}
                        sub="celeste"
                        active={tribeFilter === 'trueno'}
                        onClick={() => setTribeFilter(tribeFilter === 'trueno' ? 'all' : 'trueno')}
                        idle="bg-sky-50 dark:bg-sky-950/30 border-sky-100 dark:border-sky-900/50"
                        accent="text-sky-600 dark:text-sky-400"
                        on="bg-sky-500 border-sky-500"
                        ring="focus-visible:ring-sky-500"
                    />
                    <KpiCard
                        icon={<span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />}
                        label="Garra"
                        value={garraCount}
                        sub="naranja"
                        active={tribeFilter === 'garra'}
                        onClick={() => setTribeFilter(tribeFilter === 'garra' ? 'all' : 'garra')}
                        idle="bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/40"
                        accent="text-orange-600 dark:text-orange-400"
                        on="bg-orange-500 border-orange-500"
                        ring="focus-visible:ring-orange-500"
                    />
                </div>

                {/* ── BUSCADOR + CONTADOR ────────────────────── */}
                <div className="mb-5 space-y-3">
                    <div className="relative rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm focus-within:ring-2 focus-within:ring-black/5 dark:focus-within:ring-white/10 focus-within:border-black dark:focus-within:border-white transition-all">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                        <input
                            id="influos-search"
                            type="text"
                            placeholder="Buscar por nombre, apellido o teléfono..."
                            className="w-full pl-10 pr-10 py-3 text-sm font-medium"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                aria-label="Limpiar búsqueda"
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-slate-200 dark:bg-neutral-700 text-slate-500 dark:text-neutral-300 hover:bg-slate-300 dark:hover:bg-neutral-600 transition-colors"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center justify-between px-1">
                        <p className="text-xs text-slate-400 font-mono">
                            {filtered.length} de {attendees.length} asistente{attendees.length !== 1 ? 's' : ''}
                        </p>
                        {hayFiltros && (
                            <button
                                onClick={() => { setFilterType('all'); setTribeFilter('all'); setSearchTerm(''); }}
                                className="text-xs font-bold text-violet-600 hover:text-violet-800 underline underline-offset-2 transition-colors"
                            >
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                </div>

                {/* ── SKELETON ───────────────────────────────── */}
                {isLoading && (
                    <>
                        <div className="md:hidden space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-xl p-4 animate-pulse">
                                    <div className="flex justify-between mb-3">
                                        <div className="h-6 w-16 bg-slate-200 dark:bg-neutral-800 rounded-full" />
                                        <div className="flex gap-1.5">
                                            {[1, 2].map(j => <div key={j} className="w-11 h-11 bg-slate-200 dark:bg-neutral-800 rounded-lg" />)}
                                        </div>
                                    </div>
                                    <div className="h-6 w-3/4 bg-slate-200 dark:bg-neutral-800 rounded mb-3" />
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="h-4 bg-slate-200 dark:bg-neutral-800 rounded" />
                                        <div className="h-4 bg-slate-200 dark:bg-neutral-800 rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="hidden md:block bg-white dark:bg-black border border-slate-200 dark:border-white rounded-lg shadow-sm overflow-hidden">
                            <div className="p-4 space-y-3">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} className="flex gap-4">
                                        <div className="h-4 w-32 bg-slate-200 dark:bg-neutral-800 rounded animate-pulse" />
                                        <div className="h-4 w-32 bg-slate-200 dark:bg-neutral-800 rounded animate-pulse" />
                                        <div className="h-4 w-12 bg-slate-200 dark:bg-neutral-800 rounded animate-pulse" />
                                        <div className="h-4 w-28 bg-slate-200 dark:bg-neutral-800 rounded animate-pulse" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {/* ── EMPTY ──────────────────────────────────── */}
                {!isLoading && filtered.length === 0 && (
                    <div className="text-center py-16 px-4">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Star className="w-10 h-10 text-slate-400 dark:text-neutral-500" />
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-tight mb-2 dark:text-white">
                            {hayFiltros ? 'Sin resultados' : 'Sin asistentes aún'}
                        </h3>
                        <p className="text-slate-600 dark:text-neutral-400 text-sm mb-6 max-w-sm mx-auto">
                            {hayFiltros
                                ? 'Ningún asistente coincide con los filtros aplicados.'
                                : 'Comenzá a registrar asistentes para llevar el control de tribus y primeras visitas.'}
                        </p>
                        {hayFiltros ? (
                            <button
                                onClick={() => { setFilterType('all'); setTribeFilter('all'); setSearchTerm(''); }}
                                className="inline-flex items-center gap-2 px-5 py-3 border border-slate-300 dark:border-neutral-700 text-slate-700 dark:text-neutral-300 font-bold text-sm uppercase rounded-lg hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                            >
                                Limpiar filtros
                            </button>
                        ) : (
                            <button
                                onClick={() => setIsNewModalOpen(true)}
                                className="inline-flex items-center gap-2 px-5 py-3 bg-black dark:bg-white text-white dark:text-black font-bold text-sm uppercase rounded-lg hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                            >
                                <UserPlus className="w-4 h-4" />
                                Agregar primer asistente
                            </button>
                        )}
                    </div>
                )}

                {/* ── MOBILE: CARD LIST ──────────────────────── */}
                {!isLoading && filtered.length > 0 && (
                    <div className="md:hidden space-y-3">
                        {filtered.map(attendee => {
                            const tribeConf = getTribeConfig(attendee.tribe);
                            return (
                                <div key={attendee.id} className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-xl p-4 shadow-sm">
                                    {/* Top row: badge + acciones (44px de objetivo táctil) */}
                                    <div className="flex items-start justify-between mb-3">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${attendee.is_first_time ? 'bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300' : 'bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400'}`}>
                                            {attendee.is_first_time ? 'Primera vez' : 'Regular'}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => setEditingAttendee(attendee)}
                                                title="Editar"
                                                aria-label="Editar asistente"
                                                className="w-11 h-11 flex items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => { setDeleteTarget(attendee); setIsDeleteConfirmOpen(true); }}
                                                title="Eliminar"
                                                aria-label="Eliminar asistente"
                                                className="w-11 h-11 flex items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Nombre */}
                                    <h3 className="text-base font-bold uppercase tracking-tight text-black dark:text-white leading-tight mb-3">
                                        {attendee.first_name} {attendee.last_name}
                                    </h3>

                                    {/* Meta grid */}
                                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 border-t border-slate-200 dark:border-neutral-700 pt-3">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400 mb-0.5">Celular</p>
                                            <p className="text-sm font-bold text-black dark:text-white tabular-nums">{attendee.phone}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400 mb-0.5">Edad</p>
                                            <p className="text-sm font-bold text-black dark:text-white tabular-nums">{attendee.age} años</p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400 mb-1">Tribu</p>
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${tribeConf?.accent ?? 'bg-slate-200 dark:bg-neutral-700'}`} />
                                                <TribeBadge tribe={attendee.tribe} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <p className="text-xs text-slate-500 font-mono px-1 pt-1">
                            {filtered.length} asistente{filtered.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                )}

                {/* ── DESKTOP: TABLE ─────────────────────────── */}
                {!isLoading && filtered.length > 0 && (
                    <div className="hidden md:block bg-white dark:bg-black border border-slate-200 dark:border-white rounded-lg shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-white bg-slate-50 dark:bg-neutral-900">
                                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Nombre</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Apellido</th>
                                    <th className="text-center px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Edad</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Celular</th>
                                    <th className="text-center px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Tribu</th>
                                    <th className="text-center px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo</th>
                                    <th className="text-center px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((attendee, idx) => (
                                    <tr
                                        key={attendee.id}
                                        className={`border-b border-slate-100 dark:border-neutral-900 hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-neutral-900/30'}`}
                                    >
                                        <td className="px-4 py-3 font-bold uppercase tracking-tight text-slate-700 dark:text-neutral-300">{attendee.first_name}</td>
                                        <td className="px-4 py-3 font-bold uppercase tracking-tight text-slate-700 dark:text-neutral-300">{attendee.last_name}</td>
                                        <td className="px-3 py-3 font-black tabular-nums text-black dark:text-white text-center">{attendee.age}</td>
                                        <td className="px-4 py-3 font-mono text-sm font-bold tabular-nums text-black dark:text-white whitespace-nowrap">{attendee.phone}</td>
                                        <td className="px-3 py-3 text-center"><TribeBadge tribe={attendee.tribe} /></td>
                                        <td className="px-3 py-3 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${attendee.is_first_time ? 'bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300' : 'bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400'}`}>
                                                {attendee.is_first_time ? 'Primera vez' : 'Regular'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button
                                                    onClick={() => setEditingAttendee(attendee)}
                                                    title="Editar"
                                                    aria-label="Editar asistente"
                                                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 hover:border-amber-500 hover:bg-amber-500 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => { setDeleteTarget(attendee); setIsDeleteConfirmOpen(true); }}
                                                    title="Eliminar"
                                                    aria-label="Eliminar asistente"
                                                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 hover:border-red-500 hover:bg-red-500 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="px-4 py-3 border-t border-slate-100 dark:border-neutral-900 text-xs text-slate-400 font-mono">
                            {filtered.length} asistente{filtered.length !== 1 ? 's' : ''}
                        </div>
                    </div>
                )}
            </div>

            {/* ── DELETE CONFIRM ─────────────────────────────── */}
            {isDeleteConfirmOpen && deleteTarget && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-200 dark:border-neutral-700">
                            <h3 className="font-black uppercase tracking-tight text-base text-black dark:text-white leading-none">
                                Eliminar Asistente
                            </h3>
                        </div>
                        <div className="p-5">
                            <p className="text-slate-600 dark:text-neutral-300 text-sm mb-6 leading-relaxed">
                                ¿Estás seguro que querés eliminar a{' '}
                                <strong className="text-black dark:text-white font-bold">
                                    {deleteTarget.first_name} {deleteTarget.last_name}
                                </strong>
                                ? Esta acción no se puede deshacer.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setIsDeleteConfirmOpen(false); setDeleteTarget(null); }}
                                    className="flex-1 py-3 border border-slate-300 dark:border-neutral-700 rounded-lg text-slate-700 dark:text-neutral-300 font-bold text-sm uppercase hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDeleteConfirm}
                                    className="flex-1 py-3 bg-red-600 text-white rounded-lg font-bold text-sm uppercase hover:bg-red-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
                                >
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODALS ────────────────────────────────────── */}
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
