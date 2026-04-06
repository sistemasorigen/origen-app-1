import React, { useRef, useEffect, useState } from 'react';
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
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    // Detect reduced motion preference
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        setPrefersReducedMotion(mediaQuery.matches);

        const handleChange = (e: MediaQueryListEvent) => {
            setPrefersReducedMotion(e.matches);
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    // Auto-scroll to active item when it changes
    useEffect(() => {
        if (activeStage && itemRefs.current.get(activeStage)) {
            itemRefs.current.get(activeStage)?.scrollIntoView({
                behavior: prefersReducedMotion ? 'auto' : 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        }
    }, [activeStage, prefersReducedMotion]);

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        const currentIndex = stages.indexOf(activeStage);
        let newIndex = currentIndex;

        if (e.key === 'ArrowRight') {
            e.preventDefault();
            newIndex = (currentIndex + 1) % stages.length;
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            newIndex = (currentIndex - 1 + stages.length) % stages.length;
        } else if (e.key === 'Home') {
            e.preventDefault();
            newIndex = 0;
        } else if (e.key === 'End') {
            e.preventDefault();
            newIndex = stages.length - 1;
        }

        if (newIndex !== currentIndex) {
            onSelect(stages[newIndex]);
        }
    };

    return (
        <div className="w-full py-6 bg-white border-b-4 border-black">
            <div
                ref={scrollRef}
                role="tablist"
                className="flex items-center gap-4 overflow-x-auto px-4 sm:px-8 lg:px-12 no-scrollbar snap-x snap-mandatory py-4"
                style={{ scrollBehavior: prefersReducedMotion ? 'auto' : 'smooth' }}
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
                            role="tab"
                            aria-selected={isActive}
                            aria-label={`${stageLabels[stage]}${isActive ? ' (actual)' : ''}`}
                            onClick={() => onSelect(stage)}
                            onKeyDown={handleKeyDown}
                            className={`
                                flex-shrink-0 snap-center transition-all
                                border-2 focus:outline-none focus:ring-2 focus:ring-blue-500
                                ${prefersReducedMotion ? '' : 'duration-300 ease-out'}
                                ${isActive
                                    ? 'bg-black text-white px-6 py-2 text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] border-black'
                                    : 'bg-transparent text-black px-4 py-2 text-xs border-transparent hover:bg-neutral-100'
                                }
                            `}
                            style={{
                                transform: isActive && !prefersReducedMotion ? 'scale(1.1)' : 'scale(1)',
                                transition: prefersReducedMotion ? 'none' : 'all 300ms ease-out'
                            }}
                        >
                            <span className="font-black uppercase tracking-widest whitespace-nowrap">
                                {stageLabels[stage]}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Hint for scrolling / keyboard */}
            <div className="text-center mt-3 flex items-center justify-center gap-2 text-xs font-bold uppercase text-neutral-600">
                <span>← Desliza o usa flechas para navegar →</span>
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
