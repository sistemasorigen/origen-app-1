import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { WelcomeVisitor, VisitorStage } from '../../types';
import VisitorCard from './TarjetaVisitante';
import NewVisitorModal from './ModalNuevoVisitante';
import VisitorDetailModal from './ModalDetalleVisitante';
import { ToastProvider } from '../punto-informacion/context/ContextoToast';
import { Plus, RefreshCw, Users, Search, X } from 'lucide-react';

import HorizontalMagnetMenu from './MenuMagneticoHorizontal';
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

const STAGE_CONFIG: Record<VisitorStage, { accent: string; pill: string; pillText: string }> = {
    'NEW':               { accent: 'bg-yellow-300',  pill: 'bg-yellow-300 border-yellow-400',  pillText: 'text-yellow-900' },
    'FILLED_FORM':       { accent: 'bg-blue-200',    pill: 'bg-blue-200 border-blue-300',      pillText: 'text-blue-900'   },
    'SECOND_CONTACT':    { accent: 'bg-blue-300',    pill: 'bg-blue-300 border-blue-400',      pillText: 'text-blue-900'   },
    'THIRD_CONTACT':     { accent: 'bg-indigo-300',  pill: 'bg-indigo-300 border-indigo-400',  pillText: 'text-indigo-900' },
    'INTERESTED_GROWTH': { accent: 'bg-purple-300',  pill: 'bg-purple-300 border-purple-400',  pillText: 'text-purple-900' },
    'DOING_GROWTH':      { accent: 'bg-purple-400',  pill: 'bg-purple-400 border-purple-500',  pillText: 'text-white'      },
    'DOING_TRAINING':    { accent: 'bg-pink-300',    pill: 'bg-pink-300 border-pink-400',      pillText: 'text-pink-900'   },
    'VOLUNTEERS':        { accent: 'bg-emerald-300', pill: 'bg-emerald-300 border-emerald-400',pillText: 'text-emerald-900'},
    'NO_RESPONSE':       { accent: 'bg-gray-300',    pill: 'bg-gray-300 border-gray-400',      pillText: 'text-gray-700'   },
};

const Bienvenida: React.FC = () => {
    const [visitors, setVisitors] = useState<WelcomeVisitor[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeStage, setActiveStage] = useState<VisitorStage>('NEW');

    // --- TUTORIAL INTEGRATION ---
    const {
        isActive,
        showInvitation,
        startTutorial,
        completeTutorial,
        declineTemporary,
        dismissTutorial
    } = useTutorial('welcome');

    // Modals
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [selectedVisitor, setSelectedVisitor] = useState<WelcomeVisitor | null>(null);

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
        setActiveStage(visitor.stage);
        setSelectedVisitor(visitor);
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

    // Listen for URL changes to switch tabs
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const stageParam = params.get('stage');
        if (stageParam && STAGES.includes(stageParam as VisitorStage)) {
            setActiveStage(stageParam as VisitorStage);
        }
    }, [location.search]);

    const moveVisitor = async (id: string, newStage: VisitorStage) => {
        // Optimistic update
        setVisitors(prev => prev.map(v => v.id === id ? { ...v, stage: newStage } : v));

        const { error } = await supabase
            .from('welcome_visitors')
            .update({ stage: newStage })
            .eq('id', id);

        if (error) {
            console.error('Error moving visitor:', error);
            fetchVisitors(); // Revert on error
        }
    };

    const activeConfig = STAGE_CONFIG[activeStage];
    const activeCount = visitors.filter(v => v.stage === activeStage).length;
    const stageIndex = STAGES.indexOf(activeStage);
    const totalCount = visitors.length;

    const kpis = [
        {
            value: totalCount,
            label: 'Nuevos Ingresantes',
            sub: 'Total general',
            bg: 'bg-black',
            text: 'text-white',
            subText: 'text-white/50',
            stage: null as VisitorStage | null,
        },
        {
            value: visitors.filter(v => v.stage === 'DOING_GROWTH').length,
            label: 'En Crecer',
            sub: 'Cursando el proceso',
            bg: 'bg-purple-400',
            text: 'text-white',
            subText: 'text-white/60',
            stage: 'DOING_GROWTH' as VisitorStage,
        },
        {
            value: visitors.filter(v => v.stage === 'DOING_TRAINING').length,
            label: 'Entrenamiento',
            sub: 'Futuros voluntarios',
            bg: 'bg-pink-300',
            text: 'text-pink-950',
            subText: 'text-pink-700',
            stage: 'DOING_TRAINING' as VisitorStage,
        },
        {
            value: visitors.filter(v => v.stage === 'NEW').length,
            label: 'Incompletos',
            sub: 'Sin formulario',
            bg: 'bg-yellow-300',
            text: 'text-yellow-950',
            subText: 'text-yellow-700',
            stage: 'NEW' as VisitorStage,
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
            <div className="h-full flex flex-col bg-slate-50 dark:bg-zinc-950 animate-fadeIn">

                {/* ── HEADER ─────────────────────────────────────────── */}
                <div className="p-4 sm:p-6 pb-0">
                    <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm px-4 sm:px-6 pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3">
                        {/* Title block */}
                        <div>
                            <h2 className="text-2xl sm:text-3xl font-bold uppercase tracking-tight text-slate-900 dark:text-white leading-none">
                                Tablero Bienvenida
                            </h2>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-400 mt-1">
                                Pipeline de seguimiento · {totalCount} personas
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                                onClick={fetchVisitors}
                                aria-label="Actualizar datos"
                                className="h-10 w-10 flex items-center justify-center rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
                            >
                                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                            </button>
                            <button
                                id="btn-new-visitor"
                                onClick={() => setIsNewModalOpen(true)}
                                className="flex items-center gap-2 h-10 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:bg-black dark:hover:bg-slate-200 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20 dark:focus-visible:ring-white/20"
                            >
                                <Plus size={16} />
                                <span className="hidden sm:inline">Nuevo Ingresante</span>
                                <span className="sm:hidden">Nuevo</span>
                            </button>
                        </div>
                    </div>

                    {/* Buscador global */}
                    <div ref={searchRef} className="relative mt-3">
                        <div className="flex items-center rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus-within:ring-4 focus-within:ring-slate-900/10 dark:focus-within:ring-white/10 focus-within:border-slate-400 dark:focus-within:border-zinc-600 transition-all">
                            <Search size={14} className="ml-3 shrink-0 text-slate-400 dark:text-zinc-500" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Buscar ingresante por nombre o apellido..."
                                value={searchQuery}
                                onFocus={() => setIsSearchOpen(true)}
                                onChange={e => {
                                    setSearchQuery(e.target.value);
                                    setIsSearchOpen(true);
                                }}
                                className="flex-1 h-9 px-3 text-sm font-medium text-slate-900 dark:text-white bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-500"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => { setSearchQuery(''); setIsSearchOpen(false); searchInputRef.current?.focus(); }}
                                    className="mr-2 p-0.5 text-slate-400 dark:text-zinc-500 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* Resultados */}
                        {isSearchOpen && searchQuery.trim().length >= 2 && (
                            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg z-50 flex flex-col overflow-hidden">
                                {searchResults.length === 0 ? (
                                    <p className="px-4 py-4 text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest text-center">
                                        Sin resultados para "{searchQuery}"
                                    </p>
                                ) : (
                                    <>
                                        <div className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border-b border-slate-100 dark:border-zinc-800">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                                                {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                        {searchResults.map(visitor => {
                                            const cfg = STAGE_CONFIG[visitor.stage];
                                            return (
                                                <button
                                                    key={visitor.id}
                                                    type="button"
                                                    onClick={() => handleSelectResult(visitor)}
                                                    className="flex items-center gap-3 px-4 py-3 text-left border-b border-slate-100 dark:border-zinc-800 last:border-b-0 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                                                >
                                                    {/* Avatar con iniciales */}
                                                    <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center text-[10px] font-black shrink-0">
                                                        {visitor.first_name[0]}{visitor.last_name?.[0] ?? ''}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-slate-900 dark:text-white uppercase leading-none truncate">
                                                            {visitor.first_name} {visitor.last_name}
                                                        </p>
                                                        {visitor.phone && (
                                                            <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 mt-0.5 truncate">
                                                                {visitor.phone}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {/* Stage badge */}
                                                    <span className={`shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${cfg.accent}`}>
                                                        {STAGE_LABELS[visitor.stage]}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* KPI cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                        {kpis.map(k => (
                            <button
                                key={k.label}
                                type="button"
                                onClick={() => k.stage && setActiveStage(k.stage)}
                                className={`flex flex-col justify-between p-3 min-h-[72px] rounded-xl text-left transition-all cursor-pointer ${k.bg} ${k.text} ${k.stage ? 'hover:brightness-95 active:scale-95' : 'cursor-default'}`}
                            >
                                <span className={`text-[10px] font-black uppercase tracking-widest leading-tight ${k.subText}`}>
                                    {k.sub}
                                </span>
                                <div>
                                    <p className="text-3xl font-black tabular-nums leading-none">{k.value}</p>
                                    <p className="text-[10px] font-black uppercase tracking-wider mt-0.5 opacity-80 leading-none">{k.label}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                    </div>
                </div>

                {/* ── STAGE NAVIGATION ───────────────────────────────── */}
                <div id="visitor-stages-menu" className="flex-none">
                    <HorizontalMagnetMenu
                        stages={STAGES}
                        activeStage={activeStage}
                        stageLabels={STAGE_LABELS}
                        onSelect={setActiveStage}
                    />
                </div>

                {/* ── CONTENT ────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-zinc-950 pb-48">

                    {/* Stage title banner */}
                    <div className={`${activeConfig.accent} border-b border-black/10 px-4 sm:px-6 py-3 flex items-center justify-between`}>
                        <div className="flex items-center gap-3">
                            <h3 className="text-sm sm:text-base font-bold uppercase tracking-tight text-black leading-none">
                                {STAGE_LABELS[activeStage]}
                            </h3>
                            <span className="bg-black text-white text-xs font-black px-2 py-0.5 rounded-full tabular-nums">
                                {activeCount}
                            </span>
                        </div>
                        <span className="text-[11px] font-bold uppercase text-black opacity-50 tabular-nums tracking-widest">
                            {stageIndex + 1} / {STAGES.length}
                        </span>
                    </div>

                    {/* Pipeline progress bar */}
                    <div className="flex h-1.5 border-b border-black/10">
                        {STAGES.map((s, i) => (
                            <div
                                key={s}
                                className={`flex-1 transition-all duration-300 ${activeConfig.accent}`}
                                style={{ opacity: i <= stageIndex ? 1 : 0.12 }}
                            />
                        ))}
                    </div>

                    {/* Grid area */}
                    <div className="p-4 sm:p-6 max-w-7xl mx-auto">

                        {/* Skeleton while loading */}
                        {isLoading && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {[1, 2, 3, 4].map(i => (
                                    <div
                                        key={i}
                                        className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-4 animate-pulse"
                                    >
                                        <div className="h-4 rounded bg-slate-200 dark:bg-zinc-800 mb-3 w-3/4" />
                                        <div className="h-3 rounded bg-slate-100 dark:bg-zinc-800 mb-2 w-1/2" />
                                        <div className="h-3 rounded bg-slate-100 dark:bg-zinc-800 w-2/3" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Empty state */}
                        {!isLoading && activeCount === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                                <div className={`w-16 h-16 ${activeConfig.accent} rounded-2xl flex items-center justify-center mb-4`}>
                                    <Users size={26} className="text-black" />
                                </div>
                                <p className="font-bold uppercase text-lg text-slate-900 dark:text-white text-center leading-none">
                                    Sin ingresantes
                                </p>
                                <p className="text-xs font-bold uppercase text-slate-400 dark:text-zinc-400 mt-1 text-center tracking-widest">
                                    en {STAGE_LABELS[activeStage]}
                                </p>
                                <button
                                    onClick={() => setIsNewModalOpen(true)}
                                    className="mt-6 flex items-center gap-2 h-10 px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:bg-black dark:hover:bg-slate-200 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20 dark:focus-visible:ring-white/20"
                                >
                                    <Plus size={14} />
                                    Registrar ingresante
                                </button>
                            </div>
                        )}

                        {/* Visitor grid */}
                        {!isLoading && activeCount > 0 && (
                            <div id="visitors-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {visitors.filter(v => v.stage === activeStage).map(visitor => (
                                    <VisitorCard
                                        key={visitor.id}
                                        visitor={visitor}
                                        onClick={() => setSelectedVisitor(visitor)}
                                        onMove={async (id, stage) => {
                                            await moveVisitor(id, stage);
                                            // Optional: Auto-switch to new stage? No, better stay context.
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* MODALS */}
                <NewVisitorModal
                    isOpen={isNewModalOpen}
                    onClose={() => setIsNewModalOpen(false)}
                    onSuccess={fetchVisitors}
                />

                <VisitorDetailModal
                    isOpen={!!selectedVisitor}
                    visitor={selectedVisitor}
                    onClose={() => setSelectedVisitor(null)}
                    onUpdate={fetchVisitors}
                />
            </div>
        </ToastProvider>
    );
};

export default Bienvenida;
