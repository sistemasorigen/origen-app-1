import React from 'react';
import { VisitorStage } from '../../types';

interface CircularStageMenuProps {
    stages: VisitorStage[];
    activeStage: VisitorStage;
    stageLabels: Record<VisitorStage, string>;
    onSelect: (stage: VisitorStage) => void;
}

const CircularStageMenu: React.FC<CircularStageMenuProps> = ({ stages, activeStage, stageLabels, onSelect }) => {
    // Determine the angle for each item
    // We want the Active item to be at -90deg (Top) or 0deg (Right)? 
    // Let's place Active at Top (-90 degrees in CSS logic usually starts from right=0)
    // Actually, let's just rotate the whole container so the active one is at the top.

    const activeIndex = stages.indexOf(activeStage);
    const total = stages.length;
    const anglePerItem = 360 / total;

    // Rotation needed to bring activeIndex to -90deg (top)
    // If index 0 is at -90deg. 
    // Item i is at -90 + (i * anglePerItem)
    // We want item activeIndex to be at -90.
    // So current rotation of item activeIndex is R_active = -90 + (activeIndex * anglePerItem)
    // We need to rotate the container by - (activeIndex * anglePerItem) to bring it back to -90 base? 
    // Let's just say we rotate the wheel so the active item is at the top.

    // Initial position: Item 0 is at Top (-90deg or 270deg)
    // Item angle = index * anglePerItem
    // Container rotation = - (activeIndex * anglePerItem)

    const rotation = -(activeIndex * anglePerItem);

    return (
        <div className="relative w-full max-w-3xl mx-auto h-[400px] flex items-center justify-center overflow-visible my-8">
            {/* Center Display (Static relative to screen, inside the wheel) */}
            <div className="absolute z-20 flex flex-col items-center justify-center w-48 h-48 bg-white border-[6px] border-black rounded-full shadow-[0px_0px_20px_rgba(0,0,0,0.1)]">
                <span className="text-xs font-black uppercase text-neutral-400 tracking-widest mb-1">ETAPA ACTUAL</span>
                <h3 className="text-xl font-black uppercase text-center leading-tight px-2">
                    {stageLabels[activeStage]}
                </h3>
            </div>

            {/* The Wheel Container */}
            <div
                className="absolute w-[600px] h-[600px] rounded-full border-2 border-dashed border-neutral-300 transition-transform duration-500 ease-out"
                style={{
                    transform: `rotate(${rotation}deg)`
                }}
            >
                {stages.map((stage, index) => {
                    const angle = index * anglePerItem;
                    const isActive = stage === activeStage;

                    // Position items on the rim of the 600px circle (radius 300px)
                    // We want index 0 at Top (-90 deg)
                    // x = r * cos(theta)
                    // y = r * sin(theta)
                    // theta needs to be in radians. 
                    // -90 deg is -PI/2 radians.
                    const thetaRad = (angle - 90) * (Math.PI / 180);
                    const radius = 300; // Half of width
                    const x = radius * Math.cos(thetaRad);
                    const y = radius * Math.sin(thetaRad);

                    // We need to counter-rotate the items so they stay upright
                    const counterRotation = -rotation;

                    return (
                        <div
                            key={stage}
                            onClick={() => onSelect(stage)}
                            className={`
                                absolute top-1/2 left-1/2 -ml-16 -mt-8 
                                w-32 h-16 
                                flex items-center justify-center 
                                cursor-pointer transition-all duration-300
                                ${isActive ? 'z-10 scale-110' : 'z-0 scale-90 opacity-60 hover:opacity-100'}
                            `}
                            style={{
                                transform: `translate(${x}px, ${y}px) rotate(${90 + angle}deg)`,
                                // For text readability, maybe we don't want them rotated? 
                                // User asked for "circular menu". Usually text follows the curve or stays upright.
                                // Let's try having them "spoke" outwards primarily, it looks cleaner for a wheel.
                                // "rotate(${90 + angle}deg)" makes them point outwards from center.
                            }}
                        >
                            <div className={`
                                px-4 py-2 border-2 border-black font-black uppercase text-xs tracking-wider text-center
                                shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
                                transition-all
                                ${isActive
                                    ? 'bg-black text-white scale-110 border-black'
                                    : 'bg-white text-black hover:bg-neutral-100'
                                }
                            `}>
                                {stageLabels[stage]}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Pointer / Indicator at Top */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-4 z-30">
                <div className="w-8 h-8 bg-black rotate-45 transform origin-center border-4 border-white shadow-lg"></div>
            </div>

            {/* Gradient Masks for nice fade effect on sides if it gets too wide */}
            <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-slate-50 to-transparent pointer-events-none z-10"></div>
            <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-slate-50 to-transparent pointer-events-none z-10"></div>
        </div>
    );
};

export default CircularStageMenu;
