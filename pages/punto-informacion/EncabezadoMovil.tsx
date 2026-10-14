import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { ViewState, User } from '../../types';

interface MobileHeaderProps {
    title: string;
    isRoot: boolean;
    onBack?: () => void;
    onOpenSidebar?: () => void;
    currentView?: ViewState;
    onNavigate?: (view: ViewState) => void;
    currentUser?: User | null;
}

/**
 * La barra del panel en el teléfono: dónde estás y cómo volver.
 *
 * Decía el título en mayúsculas pesadas y centrado, como un cartel. Ahora lo
 * dice en minúscula, con el peso justo para leerse de un vistazo sin gritar
 * —el mismo idioma que el resto del módulo— y la flecha de volver es un
 * botón redondo de 40px, que es lo que el pulgar busca.
 */
const MobileHeader: React.FC<MobileHeaderProps> = ({ title, isRoot, onBack }) => (
    <div className="flex items-center justify-between w-full h-14 px-3 bg-white border-b border-slate-200 lg:hidden">
        <div className="w-10 flex items-center">
            {!isRoot && (
                <button
                    type="button"
                    onClick={onBack}
                    aria-label="Volver"
                    className="w-10 h-10 flex items-center justify-center rounded-full text-black hover:bg-slate-100 active:bg-slate-200 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
            )}
        </div>

        <h1 className="flex-1 text-center text-[17px] font-bold tracking-tight text-black leading-none truncate px-1">
            {title}
        </h1>

        {/* Espaciador: mantiene el título centrado aunque no haya flecha. */}
        <div className="w-10" aria-hidden="true" />
    </div>
);

export default MobileHeader;
