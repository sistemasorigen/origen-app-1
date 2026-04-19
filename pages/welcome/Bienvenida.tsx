import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { WelcomeVisitor, VisitorStage } from '../../types';
import VisitorCard from './VisitorCard';
import NewVisitorModal from './NewVisitorModal';
import VisitorDetailModal from './VisitorDetailModal';
import { ToastProvider } from '../infopoint/context/ToastContext';
import { Plus, RefreshCw, Users } from 'lucide-react';

import HorizontalMagnetMenu from './HorizontalMagnetMenu';
import { useTutorial } from '../../src/hooks/useTutorial';
import TutorialInvitation from '../../components/TutorialInvitation';
import TutorialController from '../../components/TutorialController';
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

    const quickStats = [
        { label: 'Total',       value: totalCount,                                                bg: 'bg-black',        text: 'text-white'        },
        { label: 'Nuevos',      value: visitors.filter(v => v.stage === 'NEW').length,            bg: 'bg-yellow-300',   text: 'text-yellow-900'   },
        { label: 'Voluntarios', value: visitors.filter(v => v.stage === 'VOLUNTEERS').length,     bg: 'bg-emerald-300',  text: 'text-emerald-900'  },
        { label: 'Sin resp.',   value: visitors.filter(v => v.stage === 'NO_RESPONSE').length,    bg: 'bg-gray-300',     text: 'text-gray-700'     },
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
            <div className="h-full flex flex-col animate-fadeIn">

                {/* ── HEADER ─────────────────────────────────────────── */}
                <div className="bg-white border-b-4 border-black px-4 sm:px-6 pt-4 pb-3">
                    <div className="flex items-start justify-between gap-3">
                        {/* Title block */}
                        <div>
                            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter text-black leading-none">
                                Tablero Bienvenida
                            </h2>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mt-1">
                                Pipeline de seguimiento · {totalCount} personas
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                                onClick={fetchVisitors}
                                aria-label="Actualizar datos"
                                className="h-10 w-10 flex items-center justify-center border-2 border-black bg-white hover:bg-neutral-100 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none cursor-pointer"
                            >
                                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                            </button>
                            <button
                                id="btn-new-visitor"
                                onClick={() => setIsNewModalOpen(true)}
                                className="flex items-center gap-2 h-10 px-4 bg-black text-white text-xs font-black uppercase tracking-widest border-2 border-black hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all cursor-pointer"
                            >
                                <Plus size={16} />
                                <span className="hidden sm:inline">Nuevo Ingresante</span>
                                <span className="sm:hidden">Nuevo</span>
                            </button>
                        </div>
                    </div>

                    {/* Quick stats strip */}
                    <div className="flex gap-2 mt-3 flex-wrap">
                        {quickStats.map(s => (
                            <div
                                key={s.label}
                                className={`flex items-center gap-1.5 px-3 h-8 border-2 border-black text-xs font-black uppercase ${s.bg} ${s.text}`}
                            >
                                <span className="tabular-nums">{s.value}</span>
                                <span className="opacity-60">{s.label}</span>
                            </div>
                        ))}
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
                <div className="flex-1 overflow-y-auto bg-slate-50 pb-48">

                    {/* Stage title banner */}
                    <div className={`${activeConfig.accent} border-b-4 border-black px-4 sm:px-6 py-3 flex items-center justify-between`}>
                        <div className="flex items-center gap-3">
                            <h3 className="text-sm sm:text-base font-black uppercase tracking-widest text-black leading-none">
                                {STAGE_LABELS[activeStage]}
                            </h3>
                            <span className="bg-black text-white text-xs font-black px-2 py-0.5 tabular-nums">
                                {activeCount}
                            </span>
                        </div>
                        <span className="text-[11px] font-bold uppercase text-black opacity-50 tabular-nums tracking-widest">
                            {stageIndex + 1} / {STAGES.length}
                        </span>
                    </div>

                    {/* Pipeline progress bar */}
                    <div className="flex h-1.5 border-b border-black">
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
                                        className="bg-white border-2 border-black p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] animate-pulse"
                                    >
                                        <div className="h-4 bg-gray-200 mb-3 w-3/4" />
                                        <div className="h-3 bg-gray-100 mb-2 w-1/2" />
                                        <div className="h-3 bg-gray-100 w-2/3" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Empty state */}
                        {!isLoading && activeCount === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 border-4 border-dashed border-black bg-white">
                                <div className={`w-16 h-16 ${activeConfig.accent} border-2 border-black flex items-center justify-center mb-4`}>
                                    <Users size={26} className="text-black" />
                                </div>
                                <p className="font-black uppercase text-lg text-black text-center leading-none">
                                    Sin ingresantes
                                </p>
                                <p className="text-xs font-bold uppercase text-gray-400 mt-1 text-center tracking-widest">
                                    en {STAGE_LABELS[activeStage]}
                                </p>
                                <button
                                    onClick={() => setIsNewModalOpen(true)}
                                    className="mt-6 flex items-center gap-2 h-10 px-5 bg-black text-white text-xs font-black uppercase tracking-widest border-2 border-black hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
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
