import React from 'react';
import NeoModal from '../ui/NeoModal';
import { Sparkles, X, Play, Clock } from 'lucide-react';

interface TutorialInvitationProps {
    isOpen: boolean;
    title?: string;
    onStart: () => void;
    onDismiss: () => void; // "No volver a mostrar"
    onClose: () => void; // "Ahora no"
    disableScrollLock?: boolean;
}

const TutorialInvitation: React.FC<TutorialInvitationProps> = ({
    isOpen,
    title = '¿Te gustaría un recorrido rápido?',
    onStart,
    onDismiss,
    onClose,
    disableScrollLock = false
}) => {
    return (
        <NeoModal
            isOpen={isOpen}
            onClose={onClose}
            title="Tutorial Interactivo"
            maxWidth="max-w-md"
            disableScrollLock={disableScrollLock}
        >
            <div className="flex flex-col items-center text-center p-4">
                <img
                    src="/origen-logo.png"
                    alt="Origen Logo"
                    className="w-24 h-auto object-contain mb-6 drop-shadow-xl hover:scale-105 transition-transform duration-500"
                />

                <h3 className="text-2xl font-black text-slate-900 mb-3 uppercase tracking-tight">
                    {title}
                </h3>

                <p className="text-slate-600 mb-8 leading-relaxed font-medium">
                    ¡Bienvenido a la aplicación! Hemos preparado una guía breve para mostrarte las funciones clave de esta sección.
                </p>

                <div className="w-full space-y-3">
                    <button
                        onClick={onStart}
                        className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-indigo-500/30"
                    >
                        <Play className="w-5 h-5 fill-current" />
                        Iniciar Recorrido
                    </button>

                    <button
                        onClick={onClose}
                        className="w-full py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                        <Clock className="w-5 h-5" />
                        Ahora no
                    </button>

                    <button
                        onClick={onDismiss}
                        className="w-full py-2 px-4 text-xs font-medium text-slate-400 hover:text-red-500 transition-colors mt-4"
                    >
                        No volver a mostrar esto
                    </button>
                </div>
            </div>
        </NeoModal>
    );
};

export default TutorialInvitation;
