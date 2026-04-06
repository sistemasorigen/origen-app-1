import React, { useState, useRef, useEffect } from 'react';
import { WelcomeVisitor, VisitorStage } from '../../types';
import { MoreHorizontal, GripVertical, Phone, User as UserIcon, Calendar } from 'lucide-react';

interface VisitorCardProps {
    visitor: WelcomeVisitor;
    onClick: () => void;
    onMove: (visitorId: string, newStage: VisitorStage) => void;
}

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
    'DOING_GROWTH': 'CRECER',
    'DOING_TRAINING': 'ENTRENAMIENTO',
    'VOLUNTEERS': 'VOLUNTARIOS',
    'NO_RESPONSE': 'NO RESPONDIÓ'
};

const VisitorCard: React.FC<VisitorCardProps> = ({ visitor, onClick, onMove }) => {
    const [showMenu, setShowMenu] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const handleMove = (e: React.MouseEvent, stage: VisitorStage) => {
        e.stopPropagation();
        onMove(visitor.id, stage);
        setShowMenu(false);
    };

    const toggleMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowMenu(!showMenu);
    };

    // Close on click outside
    useEffect(() => {
        if (!showMenu) return;
        const handleClickOutside = () => setShowMenu(false);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, [showMenu]);

    return (
        <div
            onClick={onClick}
            className={`group relative bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all cursor-pointer mb-3 ${showMenu ? 'z-[60]' : 'z-0'}`}
        >
            <div className="flex justify-between items-start mb-2">
                <h3 className="font-black uppercase text-sm leading-tight pr-6 break-words">
                    {visitor.first_name} {visitor.last_name}
                </h3>
                <div className="relative">
                    <button
                        ref={buttonRef}
                        onClick={toggleMenu}
                        aria-label={`Opciones para ${visitor.first_name} ${visitor.last_name}`}
                        aria-expanded={showMenu}
                        aria-haspopup="menu"
                        className="p-3 h-10 w-10 flex items-center justify-center hover:bg-neutral-100 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    >
                        <MoreHorizontal size={18} />
                    </button>

                    {/* Move Menu (Absolute) */}
                    {showMenu && (
                        <div
                            role="menu"
                            className="absolute right-0 top-full mt-1 z-[9999] w-48 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] py-1 animate-fadeIn"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-3 py-1 border-b-2 border-black bg-neutral-100 text-xs font-black uppercase tracking-widest text-neutral-700">
                                Mover a...
                            </div>
                            <div className="max-h-[300px] overflow-y-auto">
                                {STAGES.filter(s => s !== visitor.stage).map(stage => (
                                    <button
                                        key={stage}
                                        role="menuitem"
                                        onClick={(e) => handleMove(e, stage)}
                                        className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-black hover:text-white transition-colors uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {STAGE_LABELS[stage] || stage.replace('_', ' ')}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-700">
                    <UserIcon size={14} className="text-black" />
                    <span>{visitor.age ? `${visitor.age} Años` : '-'}</span>
                </div>
                {visitor.phone && (
                    <div className="flex items-center gap-2 text-xs font-bold text-neutral-700 truncate">
                        <Phone size={14} className="text-black" />
                        <span>{visitor.phone}</span>
                    </div>
                )}
                {visitor.created_at && (
                    <div className="flex items-center gap-2 text-xs font-bold text-neutral-700 truncate">
                        <Calendar size={14} className="text-black" />
                        <span>{new Date(visitor.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VisitorCard;
