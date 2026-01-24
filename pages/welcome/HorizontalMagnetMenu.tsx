import React, { useRef, useEffect } from 'react';
import { VisitorStage } from '../../types';

interface HorizontalMagnetMenuProps {
    stages: VisitorStage[];
    activeStage: VisitorStage;
    stageLabels: Record<VisitorStage, string>;
    onSelect: (stage: VisitorStage) => void;
}

const HorizontalMagnetMenu: React.FC<HorizontalMagnetMenuProps> = ({ stages, activeStage, stageLabels, onSelect }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

    // Auto-scroll to active item when it changes
    useEffect(() => {
        if (activeStage && itemRefs.current.get(activeStage)) {
            itemRefs.current.get(activeStage)?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        }
    }, [activeStage]);

    return (
        <div className="w-full py-6 bg-white border-b-4 border-black">
            <div
                ref={scrollRef}
                className="flex items-center gap-4 overflow-x-auto px-[30%] md:px-[35%] no-scrollbar snap-x snap-mandatory scroll-smooth py-4"
            >
                {stages.map((stage) => {
                    const isActive = stage === activeStage;
                    return (
                        <button
                            key={stage}
                            ref={(el) => {
                                if (el) itemRefs.current.set(stage, el);
                                else itemRefs.current.delete(stage);
                            }}
                            onClick={() => onSelect(stage)}
                            className={`
                                flex-shrink-0 snap-center transition-all duration-300 ease-out
                                border-2
                                ${isActive
                                    ? 'bg-black text-white px-6 py-2 text-sm scale-110 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] border-black'
                                    : 'bg-transparent text-neutral-500 px-4 py-2 text-xs hover:text-black border-transparent hover:bg-neutral-100'
                                }
                            `}
                        >
                            <span className="font-black uppercase tracking-widest whitespace-nowrap">
                                {stageLabels[stage]}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Hint for scrolling */}
            <div className="text-center mt-2 flex items-center justify-center gap-2 text-[10px] font-bold uppercase text-neutral-400">
                <span>← Desliza para navegar →</span>
            </div>

            <style>{`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
};

export default HorizontalMagnetMenu;
