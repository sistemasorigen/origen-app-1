import React, { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { WelcomeVisitor, VisitorStage } from '../../../types';
import VisitorCard from './VisitorCard';
import NewVisitorModal from './NewVisitorModal';
import VisitorDetailModal from './VisitorDetailModal';
import { Plus, GripHorizontal, RefreshCw } from 'lucide-react';

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
    'NEW': 'NUEVOS',
    'FILLED_FORM': 'FORM LLENO',
    'SECOND_CONTACT': '2° CONTACTO',
    'THIRD_CONTACT': '3° CONTACTO',
    'INTERESTED_GROWTH': 'INT. CRECER',
    'DOING_GROWTH': 'CRECIENDO',
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

    // Modals
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [selectedVisitor, setSelectedVisitor] = useState<WelcomeVisitor | null>(null);

    const fetchVisitors = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('welcome_visitors')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setVisitors(data);
        if (error) console.error('Error fetching visitors:', error);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchVisitors();
    }, []);

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
        <div className="h-full flex flex-col space-y-4 animate-fadeIn pb-4">
            {/* HEADER */}
            <div className="flex justify-between items-center mb-2 px-1">
                <div>
                    <h2 className="text-2xl font-black uppercase tracking-tighter text-black border-b-4 border-black inline-block pb-1 leading-none">
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
                        onClick={() => setIsNewModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-black text-white font-black uppercase tracking-widest border-2 border-black hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all"
                    >
                        <Plus size={20} />
                        Nuevo Ingresante
                    </button>
                </div>
            </div>

            {/* KANBAN BOARD */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
                <div className="flex gap-4 h-full min-w-[1200px] px-1">
                    {STAGES.map(stage => (
                        <div key={stage} className="flex-1 min-w-[280px] flex flex-col h-full">
                            {/* COLUMN HEADER */}
                            <div className={`p-3 border-2 border-black border-b-0 ${STAGE_COLORS[stage]} flex justify-between items-center`}>
                                <span className="font-black uppercase text-xs tracking-widest">{STAGE_LABELS[stage]}</span>
                                <span className="font-bold text-xs bg-black text-white px-2 py-0.5 rounded-full">
                                    {visitors.filter(v => v.stage === stage).length}
                                </span>
                            </div>

                            {/* COLUMN BODY */}
                            <div className="flex-1 border-2 border-black bg-slate-50/50 p-2 overflow-y-auto custom-scrollbar">
                                {visitors.filter(v => v.stage === stage).map(visitor => (
                                    <VisitorCard
                                        key={visitor.id}
                                        visitor={visitor}
                                        onClick={() => setSelectedVisitor(visitor)}
                                        onMove={moveVisitor}
                                    />
                                ))}
                                {visitors.filter(v => v.stage === stage).length === 0 && (
                                    <div className="h-24 flex items-center justify-center opacity-20">
                                        <GripHorizontal size={24} />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
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
    );
};

export default Bienvenida;
