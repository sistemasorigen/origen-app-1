import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { WelcomeVisitor, VisitorStage } from '../../types';
import { ToastProvider } from '../punto-informacion/context/ContextoToast';
import {
    Plus, Users, Search, X, Eye, Trash2,
    ChevronUp, ChevronDown, BarChart3
} from 'lucide-react';
import FilterChip from '../../components/ui/FilterChip';

import { useTutorial } from '../../src/hooks/useTutorial';
import TutorialInvitation from '../../components/onboarding/InvitacionTutorial';
import TutorialController from '../../components/onboarding/ControladorTutorial';
import { tours } from '../../src/config/tours';

const STAGES: VisitorStage[] = [
    'NEW',
    'FILLED_FORM',
    'SECOND_CONTACT',
    'THIRD_CONTACT',
    'INTERESTED_GROWTH',
    'DOING_GROWTH',
    'DOING_TRAINING',
    'VOLUNTEERS',
    'NO_RESPONSE'
];

const STAGE_LABELS: Record<VisitorStage, string> = {
    'NEW': 'INCOMPLETOS',
    'FILLED_FORM': 'FORM LLENO',
    'SECOND_CONTACT': '2° CONTACTO',
    'THIRD_CONTACT': '3° CONTACTO',
    'INTERESTED_GROWTH': 'INT. CRECER',
    'DOING_GROWTH': 'CRECER',
    'DOING_TRAINING': 'ENTRENAMIENTO',
    'VOLUNTEERS': 'VOLUNTARIOS',
    'NO_RESPONSE': 'NO RESPONDIÓ'
};

// Píldoras al tono de AudienciaServiciosPrincipal (fondo 100 + texto 700):
// antes eran fondos saturados 300/400 que competían con el resto de la
// pantalla. El matiz sigue diferenciando etapa por etapa.
const STAGE_PILL: Record<VisitorStage, string> = {
    'NEW': 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
    'FILLED_FORM': 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400',
    'SECOND_CONTACT': 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400',
    'THIRD_CONTACT': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400',
    'INTERESTED_GROWTH': 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400',
    'DOING_GROWTH': 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400',
    'DOING_TRAINING': 'bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-400',
    'VOLUNTEERS': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
    'NO_RESPONSE': 'bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-400',
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

// '' = todas las etapas. Es el mismo centinela que usa FilterChip para
// distinguir "sin filtro" de "filtrado", así que el chip queda apagado solo
// cuando de verdad no hay filtro aplicado.
type StageFilter = VisitorStage | '';

const MENU_WIDTH = 176;  // w-44
const MENU_HEIGHT = 288; // max-h-72

// Píldora de etapa clickeable: abre el menú para mover a la persona de etapa
// sin entrar al detalle.
//
// El menú va por portal a document.body en vez de posicionarse dentro de la
// celda: el contenedor de la tabla es overflow-hidden (lo necesita para que
// las esquinas redondeadas recorten las filas), así que un absolute adentro
// quedaría cortado por el borde de la tabla.
const StageBadge: React.FC<{
    stage: VisitorStage;
    isSaving: boolean;
    onSelect: (stage: VisitorStage) => void;
    className?: string;
}> = ({ stage, isSaving, onSelect, className = '' }) => {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

    const openMenu = () => {
        const r = btnRef.current?.getBoundingClientRect();
        if (!r) return;
        // Abre hacia arriba si no entra abajo (las últimas filas de la planilla
        // quedan cerca del borde inferior de la ventana).
        const cabeAbajo = r.bottom + 6 + MENU_HEIGHT <= window.innerHeight;
        setPos({
            top: cabeAbajo ? r.bottom + 6 : Math.max(8, r.top - MENU_HEIGHT - 6),
            left: Math.max(8, Math.min(r.left, window.innerWidth - MENU_WIDTH - 8)),
        });
        setOpen(true);
    };

    // Al scrollear o redimensionar, el disparador se mueve y el menú (fixed) no
    // lo sigue: se cierra en vez de quedar flotando desalineado.
    useEffect(() => {
        if (!open) return;
        const close = () => setOpen(false);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [open]);

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                onClick={() => (open ? setOpen(false) : openMenu())}
                disabled={isSaving}
                title="Cambiar etapa"
                aria-haspopup="listbox"
                aria-expanded={open}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold uppercase tracking-wide whitespace-nowrap transition-opacity hover:opacity-75 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white focus-visible:ring-offset-1 ${STAGE_PILL[stage]} ${className}`}
            >
                {isSaving ? 'Guardando...' : STAGE_LABELS[stage]}
                <ChevronDown className={`w-3 h-3 shrink-0 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && pos && createPortal(
                <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
                    <div
                        role="listbox"
                        style={{ top: pos.top, left: pos.left, width: MENU_WIDTH, maxHeight: MENU_HEIGHT }}
                        className="fixed z-[61] bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-lg shadow-lg overflow-y-auto"
                    >
                        {STAGES.map(s => (
                            <button
                                key={s}
                                type="button"
                                role="option"
                                aria-selected={s === stage}
                                onClick={() => { setOpen(false); if (s !== stage) onSelect(s); }}
                                className={`w-full text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide transition-colors ${s === stage
                                    ? 'bg-black dark:bg-white text-white dark:text-black'
                                    : 'text-black dark:text-white hover:bg-slate-100 dark:hover:bg-neutral-800'
                                    }`}
                            >
                                {STAGE_LABELS[s]}
                            </button>
                        ))}
                    </div>
                </>,
                document.body
            )}
        </>
    );
};

const Bienvenida: React.FC = () => {
    const navigate = useNavigate();
    const [visitors, setVisitors] = useState<WelcomeVisitor[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [stageFilter, setStageFilter] = useState<StageFilter>('');

    // Arranca cerrado siempre: el resumen es contexto, no la tarea. Lo primero
    // que tiene que verse al entrar es la lista de ingresantes.
    const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(true);

    // --- TUTORIAL INTEGRATION ---
    const {
        isActive,
        showInvitation,
        startTutorial,
        completeTutorial,
        declineTemporary,
        dismissTutorial
    } = useTutorial('welcome');

    // Eliminar — confirmación inline en 2 clicks, mismo patrón que AdminDiaNino.tsx
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Cambio de etapa desde la píldora de la planilla
    const [savingStageId, setSavingStageId] = useState<string | null>(null);
    const [stageError, setStageError] = useState<string | null>(null);

    // Buscador global
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setIsSearchOpen(false);
                setSearchQuery('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const searchResults = searchQuery.trim().length >= 2
        ? visitors.filter(v =>
            `${v.first_name} ${v.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
        ).slice(0, 8)
        : [];

    const handleSelectResult = (visitor: WelcomeVisitor) => {
        navigate(`/bienvenida/v/${visitor.id}`);
        setIsSearchOpen(false);
        setSearchQuery('');
    };

    const fetchVisitors = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('welcome_visitors')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) {
            console.log('Fetched visitors:', data);
            setVisitors(data);
        }
        if (error) console.error('Error fetching visitors:', error);
        setIsLoading(false);
    };

    const location = useLocation();

    useEffect(() => {
        fetchVisitors();
    }, []);

    // Deep-link ?stage=X — mismo mecanismo que antes, ahora alimenta el
    // filtro de la planilla en vez de la pestaña activa del Kanban.
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const stageParam = params.get('stage');
        if (stageParam && STAGES.includes(stageParam as VisitorStage)) {
            setStageFilter(stageParam as VisitorStage);
        }
    }, [location.search]);

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        const { error } = await supabase.from('welcome_visitors').delete().eq('id', id);
        setDeletingId(null);
        setConfirmDeleteId(null);
        if (!error) {
            setVisitors(prev => prev.filter(v => v.id !== id));
        }
    };

    // Optimista con rollback, igual que el moveVisitor del Kanban que reemplazó
    // esta pantalla: la fila cambia de etapa al instante (y sale de la lista si
    // hay un filtro puesto, que es lo que uno espera al moverla) y solo vuelve
    // atrás si Supabase rechaza el update.
    const handleStageChange = async (id: string, newStage: VisitorStage) => {
        const previous = visitors.find(v => v.id === id)?.stage;
        if (!previous || previous === newStage) return;

        setStageError(null);
        setSavingStageId(id);
        setVisitors(prev => prev.map(v => (v.id === id ? { ...v, stage: newStage } : v)));

        const { error } = await supabase
            .from('welcome_visitors')
            .update({ stage: newStage })
            .eq('id', id);

        setSavingStageId(null);

        if (error) {
            console.error('Error updating stage:', error);
            setVisitors(prev => prev.map(v => (v.id === id ? { ...v, stage: previous } : v)));
            setStageError('No se pudo cambiar la etapa. Volvé a intentar.');
            setTimeout(() => setStageError(null), 4000);
        }
    };

    const totalCount = visitors.length;
    const filteredVisitors = visitors.filter(v => stageFilter === '' || v.stage === stageFilter);

    // Sin color por tarjeta: el color queda reservado para UNA sola cosa con
    // significado real, marcar cuál filtro está activo ahora mismo. "Total"
    // es un filtro más (limpia a todas las etapas), no un adorno sin acción.
    const kpis: { value: number; label: string; sub: string; stage: StageFilter }[] = [
        {
            value: totalCount,
            label: 'Nuevos ingresantes',
            sub: 'total general',
            stage: '',
        },
        {
            value: visitors.filter(v => v.stage === 'DOING_GROWTH').length,
            label: 'En Crecer',
            sub: 'cursando el proceso',
            stage: 'DOING_GROWTH',
        },
        {
            value: visitors.filter(v => v.stage === 'DOING_TRAINING').length,
            label: 'Entrenamiento',
            sub: 'futuros voluntarios',
            stage: 'DOING_TRAINING',
        },
        {
            value: visitors.filter(v => v.stage === 'NEW').length,
            label: 'Incompletos',
            sub: 'sin formulario',
            stage: 'NEW',
        },
    ];

    return (
        <ToastProvider>
            <TutorialInvitation
                isOpen={showInvitation}
                onStart={startTutorial}
                onClose={declineTemporary}
                onDismiss={dismissTutorial}
                title="Bienvenido a Recepcción"
            />
            <TutorialController
                steps={tours.welcome}
                run={isActive}
                onComplete={completeTutorial}
                onSkip={dismissTutorial}
            />
            <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 pb-16 animate-fadeIn">

                {/* ── HEADER ─────────────────────────────────────────── */}
                <div className="bg-white dark:bg-black border-b border-slate-200 dark:border-white">
                    <div className="w-full px-4 sm:px-6 lg:px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tighter leading-none">Tablero Bienvenida</h1>
                            <p className="text-[10px] text-slate-600 dark:text-neutral-400 font-mono uppercase tracking-wider">Pipeline de seguimiento</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                id="btn-new-visitor"
                                onClick={() => navigate('/bienvenida/nuevo')}
                                className="flex items-center gap-2 px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black font-bold text-xs uppercase rounded-lg hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                            >
                                <Plus className="w-4 h-4" />
                                Nuevo Ingresante
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── CONTENT ────────────────────────────────────────── */}
                <div className="w-full px-4 sm:px-6 lg:px-4 pt-8">

                    {isLoading && (
                        <>
                            <div className="mb-5 space-y-3">
                                <div className="h-14 bg-slate-200 dark:bg-neutral-800 rounded-2xl animate-pulse" />
                                <div className="h-12 bg-slate-200 dark:bg-neutral-800 rounded-xl animate-pulse" />
                                <div className="h-10 w-64 bg-slate-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
                            </div>
                            <div className="md:hidden space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 animate-pulse">
                                        <div className="flex justify-between mb-3">
                                            <div className="h-6 w-24 bg-slate-200 dark:bg-neutral-800 rounded-full" />
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
                            <div className="hidden md:block bg-white dark:bg-black border border-slate-200 dark:border-white rounded-lg shadow-sm overflow-x-auto">
                                <div className="p-4 space-y-3">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <div key={i} className="flex gap-4">
                                            <div className="h-4 w-24 bg-slate-200 dark:bg-neutral-800 rounded animate-pulse" />
                                            <div className="h-4 w-48 bg-slate-200 dark:bg-neutral-800 rounded animate-pulse" />
                                            <div className="h-4 w-16 bg-slate-200 dark:bg-neutral-800 rounded animate-pulse" />
                                            <div className="h-4 w-28 bg-slate-200 dark:bg-neutral-800 rounded animate-pulse" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {!isLoading && totalCount === 0 && (
                        <div className="text-center py-16 px-4">
                            <div className="w-20 h-20 bg-slate-100 dark:bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Users className="w-10 h-10 text-slate-400 dark:text-neutral-500" />
                            </div>
                            <h3 className="text-lg font-black uppercase tracking-tight mb-2">Sin ingresantes aún</h3>
                            <p className="text-slate-600 dark:text-neutral-400 text-sm mb-6 max-w-sm mx-auto">
                                Registrá a cada persona que llega por primera vez para poder hacerle seguimiento.
                            </p>
                            <button
                                onClick={() => navigate('/bienvenida/nuevo')}
                                className="inline-flex items-center gap-2 px-5 py-3 bg-black dark:bg-white text-white dark:text-black font-bold text-sm uppercase rounded-lg hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                            >
                                <Plus className="w-4 h-4" />
                                Registrar el primero
                            </button>
                        </div>
                    )}

                    {/* ── RESUMEN DEL PIPELINE (plegable, cerrado al entrar) ── */}
                    {!isLoading && totalCount > 0 && (
                        <div className="mb-6 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-2xl overflow-hidden shadow-sm">
                            <button
                                type="button"
                                onClick={() => setIsSummaryCollapsed(c => !c)}
                                aria-expanded={!isSummaryCollapsed}
                                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-inset"
                            >
                                <div className="flex items-center gap-2.5">
                                    <BarChart3 className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                                    <span className="text-sm font-bold uppercase tracking-tight text-black dark:text-white">
                                        Resumen
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 font-mono normal-case">
                                        {totalCount} persona{totalCount !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                {isSummaryCollapsed
                                    ? <ChevronDown className="w-4 h-4 text-slate-400" />
                                    : <ChevronUp className="w-4 h-4 text-slate-400" />
                                }
                            </button>

                            {!isSummaryCollapsed && (
                                <div className="border-t border-slate-200 dark:border-neutral-700 px-5 py-5">
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                        {kpis.map(k => {
                                            const isActiveKpi = stageFilter === k.stage;
                                            return (
                                                <button
                                                    key={k.label}
                                                    type="button"
                                                    onClick={() => setStageFilter(k.stage)}
                                                    className={`rounded-xl p-4 border text-left transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900 ${isActiveKpi
                                                        ? 'bg-black dark:bg-white border-black dark:border-white'
                                                        : 'bg-slate-50 dark:bg-neutral-800/50 border-slate-100 dark:border-neutral-700/50 hover:border-slate-300 dark:hover:border-neutral-600'
                                                        }`}
                                                >
                                                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isActiveKpi ? 'text-white/60 dark:text-black/60' : 'text-slate-400 dark:text-neutral-500'}`}>
                                                        {k.label}
                                                    </p>
                                                    <p className={`text-3xl font-black tabular-nums leading-none ${isActiveKpi ? 'text-white dark:text-black' : 'text-black dark:text-white'}`}>
                                                        {k.value}
                                                    </p>
                                                    <p className={`text-[10px] font-medium mt-1 ${isActiveKpi ? 'text-white/60 dark:text-black/60' : 'text-slate-400 dark:text-neutral-500'}`}>
                                                        {k.sub}
                                                    </p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[10px] text-slate-400 dark:text-neutral-500 font-medium mt-4">
                                        Tocá una tarjeta para filtrar la lista por esa etapa.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── BUSCADOR + FILTRO ── */}
                    {!isLoading && totalCount > 0 && (
                        <div className="mb-5 space-y-3">
                            <div ref={searchRef} className="relative">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Buscar por nombre o apellido..."
                                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 bg-white text-black font-medium placeholder:text-slate-400 focus:outline-none focus:border-black focus:ring-2 focus:ring-black/5 transition-all text-sm shadow-sm"
                                    value={searchQuery}
                                    onFocus={() => setIsSearchOpen(true)}
                                    onChange={e => {
                                        setSearchQuery(e.target.value);
                                        setIsSearchOpen(true);
                                    }}
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => { setSearchQuery(''); setIsSearchOpen(false); searchInputRef.current?.focus(); }}
                                        aria-label="Limpiar búsqueda"
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 transition-colors"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}

                                {/* Resultados */}
                                {isSearchOpen && searchQuery.trim().length >= 2 && (
                                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-xl shadow-lg z-50 flex flex-col overflow-hidden">
                                        {searchResults.length === 0 ? (
                                            <p className="px-4 py-4 text-xs font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-widest text-center">
                                                Sin resultados para "{searchQuery}"
                                            </p>
                                        ) : (
                                            <>
                                                <div className="px-3 py-1.5 bg-slate-50 dark:bg-neutral-800 border-b border-slate-100 dark:border-neutral-700">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500">
                                                        {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}
                                                    </p>
                                                </div>
                                                {searchResults.map(visitor => (
                                                    <button
                                                        key={visitor.id}
                                                        type="button"
                                                        onClick={() => handleSelectResult(visitor)}
                                                        className="flex items-center gap-3 px-4 py-3 text-left border-b border-slate-100 dark:border-neutral-800 last:border-b-0 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors"
                                                    >
                                                        <div className="w-8 h-8 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center text-[10px] font-black shrink-0">
                                                            {visitor.first_name[0]}{visitor.last_name?.[0] ?? ''}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-bold text-black dark:text-white uppercase leading-none truncate">
                                                                {visitor.first_name} {visitor.last_name}
                                                            </p>
                                                            {visitor.phone && (
                                                                <p className="text-[10px] font-mono text-slate-400 dark:text-neutral-500 mt-1 truncate">
                                                                    {visitor.phone}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${STAGE_PILL[visitor.stage]}`}>
                                                            {STAGE_LABELS[visitor.stage]}
                                                        </span>
                                                    </button>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Filtro de etapa. Mismo id que el menú Kanban que
                                reemplazó (#visitor-stages-menu): el tour de
                                onboarding (tours.ts) apunta este ancla por id. */}
                            <div id="visitor-stages-menu" className="w-full sm:w-64">
                                <FilterChip
                                    label="Todas las etapas"
                                    value={stageFilter}
                                    onChange={v => setStageFilter(v as StageFilter)}
                                    activeColor="bg-violet-600 border-violet-600 text-white"
                                    // Misma tipografía que las píldoras de etapa de la
                                    // tabla: son literalmente los mismos rótulos, y era
                                    // el único control de la página en caja baja y sin
                                    // tracking.
                                    textClassName="text-[11px] font-bold uppercase tracking-wide"
                                    options={[
                                        { label: 'Todas las etapas', value: '' },
                                        ...STAGES.map(s => ({ label: STAGE_LABELS[s], value: s }))
                                    ]}
                                />
                            </div>

                            <div className="flex items-center justify-between px-1">
                                <p className="text-xs text-slate-400 font-mono">
                                    {filteredVisitors.length} de {totalCount} ingresantes
                                </p>
                                {stageFilter && (
                                    <button
                                        onClick={() => setStageFilter('')}
                                        className="text-xs font-bold text-violet-600 hover:text-violet-800 underline underline-offset-2 transition-colors"
                                    >
                                        Limpiar filtros
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Mismo id que el grid Kanban que reemplazó (#visitors-grid). */}
                    <div id="visitors-grid">
                        {!isLoading && totalCount > 0 && filteredVisitors.length === 0 && (
                            <div className="text-center py-16 px-4 border border-dashed border-slate-300 dark:border-neutral-700 rounded-2xl bg-white dark:bg-neutral-900">
                                <h3 className="text-lg font-black uppercase tracking-tight mb-2">Nadie en esta etapa</h3>
                                <p className="text-slate-600 dark:text-neutral-400 text-sm mb-6">
                                    Todavía no hay ingresantes en {stageFilter ? STAGE_LABELS[stageFilter] : 'esta etapa'}.
                                </p>
                                <button
                                    onClick={() => setStageFilter('')}
                                    className="inline-flex items-center gap-2 px-5 py-3 border border-slate-300 dark:border-neutral-700 font-bold text-sm uppercase rounded-lg hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                                >
                                    Ver todas las etapas
                                </button>
                            </div>
                        )}

                        {/* ── Mobile: tarjetas ── */}
                        {!isLoading && filteredVisitors.length > 0 && (
                            <div className="md:hidden space-y-3">
                                {filteredVisitors.map(visitor => (
                                    <div key={visitor.id} className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-xl p-4 shadow-sm">
                                        {/* Top row: etapa + acciones (44px de área táctil) */}
                                        <div className="flex items-start justify-between gap-2 mb-3">
                                            <StageBadge
                                                stage={visitor.stage}
                                                isSaving={savingStageId === visitor.id}
                                                onSelect={s => handleStageChange(visitor.id, s)}
                                                className="text-[11px] !py-2"
                                            />
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    onClick={() => navigate(`/bienvenida/v/${visitor.id}`)}
                                                    title="Ver detalles"
                                                    aria-label="Ver detalles"
                                                    className="w-11 h-11 flex items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 hover:bg-black hover:text-white hover:border-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                {confirmDeleteId === visitor.id ? (
                                                    <button
                                                        onClick={() => handleDelete(visitor.id)}
                                                        disabled={deletingId === visitor.id}
                                                        className="h-11 px-3 flex items-center justify-center rounded-lg bg-red-600 text-white text-[11px] font-bold uppercase hover:bg-red-700 transition-colors disabled:opacity-50"
                                                    >
                                                        {deletingId === visitor.id ? 'Eliminando...' : 'Confirmar'}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => setConfirmDeleteId(visitor.id)}
                                                        title="Eliminar"
                                                        aria-label="Eliminar ingresante"
                                                        className="w-11 h-11 flex items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Nombre */}
                                        <h3 className="text-base font-bold uppercase tracking-tight text-black dark:text-white leading-tight mb-3">
                                            {visitor.first_name} {visitor.last_name}
                                        </h3>

                                        {/* Meta grid */}
                                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 border-t border-slate-200 dark:border-neutral-800 pt-3">
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400 mb-0.5">Fecha</p>
                                                <p className="text-sm font-bold text-black dark:text-white tabular-nums font-mono">{fmtDate(visitor.created_at)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400 mb-0.5">Edad</p>
                                                <p className="text-sm font-bold text-black dark:text-white tabular-nums">{visitor.age ?? '—'}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400 mb-0.5">Teléfono</p>
                                                {visitor.phone ? (
                                                    <a
                                                        href={`https://wa.me/${visitor.phone.replace(/\D/g, '')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono hover:underline"
                                                    >
                                                        {visitor.phone}
                                                    </a>
                                                ) : (
                                                    <p className="text-sm font-bold text-slate-300 dark:text-neutral-700">—</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <p className="text-xs text-slate-500 font-mono px-1 pt-1">
                                    {filteredVisitors.length} ingresante{filteredVisitors.length !== 1 ? 's' : ''}
                                </p>
                            </div>
                        )}

                        {/* ── Desktop: tabla ── */}
                        {!isLoading && filteredVisitors.length > 0 && (
                            <div className="hidden md:block bg-white dark:bg-black border border-slate-200 dark:border-white rounded-lg shadow-sm overflow-hidden">
                                <table className="table-fixed w-full text-sm">
                                    <colgroup>
                                        <col style={{ width: '14%' }} />
                                        {/* Nombre cede 3 puntos para que la píldora de
                                            etapa entre con el chevron sin partirse. */}
                                        <col style={{ width: '29%' }} />
                                        <col style={{ width: '21%' }} />
                                        <col style={{ width: '10%' }} />
                                        <col style={{ width: '16%' }} />
                                        <col style={{ width: '10%' }} />
                                    </colgroup>
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-white bg-slate-50 dark:bg-neutral-900">
                                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest leading-tight text-slate-400">Fecha</th>
                                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest leading-tight text-slate-400">Nombre y Apellido</th>
                                            <th className="text-left px-3 py-3 text-[10px] font-black uppercase tracking-widest leading-tight text-slate-400">Etapa</th>
                                            <th className="text-center px-3 py-3 text-[10px] font-black uppercase tracking-widest leading-tight text-slate-400">Edad</th>
                                            <th className="text-left px-3 py-3 text-[10px] font-black uppercase tracking-widest leading-tight text-slate-400">Teléfono</th>
                                            <th className="text-center px-4 py-3 text-[10px] font-black uppercase tracking-widest leading-tight text-slate-400">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredVisitors.map((visitor, idx) => (
                                            <tr key={visitor.id} className={`border-b border-slate-100 dark:border-neutral-900 hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-neutral-900/30'}`}>
                                                <td className="px-4 py-3 font-mono text-sm font-bold tabular-nums whitespace-nowrap">
                                                    {fmtDate(visitor.created_at)}
                                                </td>
                                                <td className="px-4 py-3 font-bold uppercase tracking-tight text-slate-700 dark:text-neutral-300 truncate">
                                                    <span className="block truncate" title={`${visitor.first_name} ${visitor.last_name}`}>
                                                        {visitor.first_name} {visitor.last_name}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <StageBadge
                                                        stage={visitor.stage}
                                                        isSaving={savingStageId === visitor.id}
                                                        onSelect={s => handleStageChange(visitor.id, s)}
                                                        className="text-[10px]"
                                                    />
                                                </td>
                                                <td className="px-3 py-3 font-black tabular-nums text-black dark:text-white text-center text-sm">
                                                    {visitor.age ?? <span className="text-slate-300 dark:text-neutral-700 font-normal">—</span>}
                                                </td>
                                                <td className="px-3 py-3">
                                                    {visitor.phone ? (
                                                        <a
                                                            href={`https://wa.me/${visitor.phone.replace(/\D/g, '')}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums hover:underline"
                                                        >
                                                            {visitor.phone}
                                                        </a>
                                                    ) : (
                                                        <span className="text-slate-300 dark:text-neutral-700 text-sm">—</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => navigate(`/bienvenida/v/${visitor.id}`)}
                                                            title="Ver detalles"
                                                            aria-label="Ver detalles"
                                                            className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-700 hover:border-black dark:hover:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-1"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        {confirmDeleteId === visitor.id ? (
                                                            <button
                                                                onClick={() => handleDelete(visitor.id)}
                                                                disabled={deletingId === visitor.id}
                                                                className="h-9 px-2.5 flex items-center justify-center rounded-lg bg-red-600 text-white text-[10px] font-bold uppercase hover:bg-red-700 transition-colors disabled:opacity-50"
                                                            >
                                                                {deletingId === visitor.id ? 'Eliminando...' : 'Confirmar'}
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => setConfirmDeleteId(visitor.id)}
                                                                title="Eliminar"
                                                                aria-label="Eliminar ingresante"
                                                                className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-700 hover:border-red-500 hover:bg-red-500 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="px-4 py-3 border-t border-slate-100 dark:border-neutral-900 text-xs text-slate-400 font-mono">
                                    {filteredVisitors.length} ingresante{filteredVisitors.length !== 1 ? 's' : ''}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* El ToastProvider vive dentro de este componente, así que
                    Bienvenida no puede usar useToast(). Aviso fijo, mismo
                    patrón que el toast de AudienciaServiciosPrincipal. */}
                {stageError && (
                    <div className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg z-[70] flex items-center gap-2 animate-fadeIn">
                        <X className="w-4 h-4 shrink-0" />
                        <span className="font-bold text-sm">{stageError}</span>
                    </div>
                )}
            </div>
        </ToastProvider>
    );
};

export default Bienvenida;
