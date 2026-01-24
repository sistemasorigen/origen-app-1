import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { WelcomeVisitor, VisitorStage } from '../../types';
import { MoreHorizontal, GripVertical, Phone, User as UserIcon } from 'lucide-react';

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
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

    const handleMove = (e: React.MouseEvent, stage: VisitorStage) => {
        e.stopPropagation();
        onMove(visitor.id, stage);
        setShowMenu(false);
    };

    const toggleMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!showMenu && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            // Align right edge of menu with right edge of button
            // Menu width is w-48 (12rem = 192px)
            setMenuPos({
                top: rect.bottom + window.scrollY + 4,
                left: rect.right + window.scrollX - 192
            });
        }
        setShowMenu(!showMenu);
    };

    // Close on scroll
    useEffect(() => {
        if (!showMenu) return;
        const handleScroll = () => setShowMenu(false);
        window.addEventListener('scroll', handleScroll, true);
        return () => window.removeEventListener('scroll', handleScroll, true);
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
                        className="p-1 hover:bg-neutral-100 rounded-sm"
                    >
                        <MoreHorizontal size={16} />
                    </button>

                    {/* Move Menu (Portal) */}
                    {showMenu && createPortal(
                        <>
                            <div
                                className="fixed inset-0 z-[9998] bg-transparent"
                                onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}
                            />
                            <div
                                className="fixed z-[9999] w-48 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] py-1 animate-fadeIn"
                                style={{ top: menuPos.top, left: menuPos.left }}
                            >
                                <div className="px-3 py-1 border-b-2 border-black bg-neutral-100 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                                    Mover a...
                                </div>
                                <div className="max-h-[300px] overflow-y-auto">
                                    {STAGES.filter(s => s !== visitor.stage).map(stage => (
                                        <button
                                            key={stage}
                                            onClick={(e) => handleMove(e, stage)}
                                            className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-black hover:text-white transition-colors uppercase"
                                        >
                                            {STAGE_LABELS[stage] || stage.replace('_', ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>,
                        document.body
                    )}
                </div>
            </div>

            <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-600">
                    <UserIcon size={12} className="text-black" />
                    <span>{visitor.age ? `${visitor.age} Años` : '-'}</span>
                </div>
                {visitor.phone && (
                    <div className="flex items-center gap-2 text-xs font-bold text-neutral-600 truncate">
                        <Phone size={12} className="text-black" />
                        <span>{visitor.phone}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VisitorCard;
