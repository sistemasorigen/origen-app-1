import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Modal del Panel GCX (design-claude/Admin GCX - Panel).
 *
 * Centrado y de 620px en escritorio, pegado a los bordes en mobile. Lo usan
 * todas las secciones para no repetir la caja: el contenido va como hijos y
 * los botones de abajo por `pie`.
 */

interface ModalPanelGCXProps {
    isOpen: boolean;
    onClose: () => void;
    titulo: string;
    subtitulo?: string;
    children: React.ReactNode;
    pie?: React.ReactNode;
    ancho?: string;
}

const ModalPanelGCX: React.FC<ModalPanelGCXProps> = ({ isOpen, onClose, titulo, subtitulo, children, pie, ancho = 'md:w-[620px]' }) => {
    useEffect(() => {
        if (!isOpen) return;
        const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', tecla);
        return () => document.removeEventListener('keydown', tecla);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[80]">
            <div className="absolute inset-0 bg-[rgba(10,10,10,.42)]" onClick={onClose} />
            <div
                role="dialog"
                aria-modal="true"
                aria-label={titulo}
                className={`absolute inset-x-3 top-12 flex max-h-[86vh] flex-col overflow-hidden rounded-[26px] bg-white shadow-[0_20px_50px_rgba(0,0,0,.25)] md:inset-x-auto md:left-1/2 md:top-[60px] md:-translate-x-1/2 ${ancho}`}
            >
                <div className="flex flex-none items-start gap-3.5 px-[22px] pt-5">
                    <div className="min-w-0 flex-1">
                        <p className="text-[18px] font-semibold tracking-[-0.015em] text-[#0a0a0a]">{titulo}</p>
                        {subtitulo && <p className="mt-[5px] text-[12.5px] font-medium text-black/[.62]">{subtitulo}</p>}
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Cerrar"
                        className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#f2f2f0] text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                    >
                        <X className="h-[15px] w-[15px]" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-auto px-[22px] pt-[18px]">
                    {children}
                </div>

                {pie && <div className="flex flex-none gap-2.5 px-[22px] pb-5 pt-[18px]">{pie}</div>}
            </div>
        </div>
    );
};

/** Botón negro del pie de un modal. */
export const BotonPrincipal: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', ...props }) => (
    <button
        {...props}
        className={`h-12 flex-1 rounded-full bg-[#0a0a0a] text-[14.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${className}`}
    />
);

/** Botón gris del pie de un modal. */
export const BotonSecundario: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', ...props }) => (
    <button
        {...props}
        className={`h-12 rounded-full bg-[#f2f2f0] px-[22px] text-[14.5px] font-semibold text-[#0a0a0a] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${className}`}
    />
);

export default ModalPanelGCX;
