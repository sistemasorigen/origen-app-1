
import React from 'react';
import { Menu, ChevronLeft } from 'lucide-react';
import { useStore } from '../../store';

interface MobileHeaderProps {
    title: string;
    isRoot: boolean;
    onBack?: () => void;
    onOpenSidebar?: () => void;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({ title, isRoot, onBack, onOpenSidebar }) => {
    return (
        <div className="flex items-center justify-between w-full h-12 px-4 py-2 bg-white border-b-2 border-black shadow-sm lg:hidden">
            {/* Left Slot */}
            <div className="flex items-center w-10">
                {!isRoot && (
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 transition-colors rounded-lg hover:bg-slate-100"
                    >
                        <ChevronLeft className="w-6 h-6 text-black" />
                    </button>
                )}
            </div>

            {/* Center Slot - Title */}
            <div className="flex items-center justify-center flex-1 overflow-hidden text-center">
                <h1 className="text-lg font-black leading-none tracking-tight text-black uppercase truncate font-helvetica-bold">
                    {title}
                </h1>
            </div>

            {/* Right Slot - Placeholder for future actions */}
            <div className="w-10"></div>
        </div>
    );
};

export default MobileHeader;
