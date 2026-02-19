import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { WelcomeVisitor, VisitorStage } from '../../types';
import VisitorCard from './VisitorCard';
import NewVisitorModal from './NewVisitorModal';
import VisitorDetailModal from './VisitorDetailModal';
import { ToastProvider } from '../infopoint/context/ToastContext';
import { Plus, GripHorizontal, RefreshCw } from 'lucide-react';

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

const STAGE_COLORS: Record<VisitorStage, string> = {
    'NEW': 'bg-yellow-100',
    'FILLED_FORM': 'bg-blue-50',
    'SECOND_CONTACT': 'bg-blue-100',
    'THIRD_CONTACT': 'bg-indigo-100',
    'INTERESTED_GROWTH': 'bg-purple-100',
    'DOING_GROWTH': 'bg-purple-200',
    'DOING_TRAINING': 'bg-pink-100',
    'VOLUNTEERS': 'bg-emerald-100',
    'NO_RESPONSE': 'bg-gray-200'
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
            <div className="h-full flex flex-col space-y-4 animate-fadeIn pb-4">
                {/* HEADER */}
                <div className="flex justify-between items-center mb-2 px-1">
                    <div>
                        <h2 className="text-3xl font-black uppercase tracking-tighter text-black border-b-4 border-black inline-block pb-1 leading-none">
                            Tablero Bienvenida
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchVisitors}
                            className="p-2 border-2 border-black bg-white hover:bg-neutral-100 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none"
                        >
                            <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            id="btn-new-visitor"
                            onClick={() => setIsNewModalOpen(true)}
                            className="flex items-center gap-2 h-10 px-4 bg-black text-white text-xs font-black uppercase tracking-widest border-2 border-black hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all"
                        >
                            <Plus size={20} />
                            Nuevo Ingresante
                        </button>
                    </div>
                </div>

                {/* CIRCULAR NAVIGATION */}
                {/* HORIZONTAL MAGNET NAVIGATION */}
                <div id="visitor-stages-menu" className="flex-none">
                    <HorizontalMagnetMenu
                        stages={STAGES}
                        activeStage={activeStage}
                        stageLabels={STAGE_LABELS}
                        onSelect={setActiveStage}
                    />
                </div>

                {/* ACTIVE STAGE VISITORS GRID */}
                <div className="flex-1 bg-slate-50 border-t-4 border-black p-4 overflow-y-auto pb-48">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-black uppercase tracking-tight">
                                {STAGE_LABELS[activeStage]}
                                <span className="ml-3 text-lg bg-black text-white px-3 py-1 rounded-full">
                                    {visitors.filter(v => v.stage === activeStage).length}
                                </span>
                            </h3>
                        </div>

                        <div id="visitors-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {visitors.filter(v => v.stage === activeStage).map(visitor => (
                                <VisitorCard
                                    key={visitor.id}
                                    visitor={visitor}
                                    onClick={() => setSelectedVisitor(visitor)}
                                    // Modified move handler to refresh list if moved out of current stage
                                    onMove={async (id, stage) => {
                                        await moveVisitor(id, stage);
                                        // Optional: Auto-switch to new stage? No, better stay context.
                                    }}
                                />
                            ))}
                            {visitors.filter(v => v.stage === activeStage).length === 0 && (
                                <div className="col-span-full h-64 flex flex-col items-center justify-center opacity-30 border-4 border-dashed border-black rounded-xl">
                                    <GripHorizontal size={48} className="mb-4" />
                                    <span className="font-black uppercase text-xl">Sin Ingresantes en esta etapa</span>
                                </div>
                            )}
                        </div>
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
