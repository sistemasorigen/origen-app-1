import React, { useEffect, useState } from 'react';
import { useBloqueoDeFondo } from '../../hooks/useBloqueoDeFondo';

/**
 * Piezas compartidas del panel de administración
 * (design-claude/Admin General).
 */

/**
 * Si la persona pidió menos movimiento en su sistema, las transiciones del
 * panel se apagan. El panel de roles se abre igual, de una.
 */
export const useMenosMovimiento = (): boolean => {
    const [menos, setMenos] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const consulta = window.matchMedia('(prefers-reduced-motion: reduce)');
        const aplicar = () => setMenos(consulta.matches);
        aplicar();
        consulta.addEventListener('change', aplicar);
        return () => consulta.removeEventListener('change', aplicar);
    }, []);

    return menos;
};

/** Rótulo chico en versalitas. */
export const Rotulo: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <p className={`text-[11px] font-semibold uppercase tracking-[0.07em] ${className}`}>{children}</p>
);

/** Botón de la barra de navegación de la cabecera. */
export const BotonNav: React.FC<{
    activo: boolean;
    onClick: () => void;
    children: React.ReactNode;
    globo?: React.ReactNode;
}> = ({ activo, onClick, children, globo }) => (
    <button
        onClick={onClick}
        aria-current={activo ? 'page' : undefined}
        className={`flex h-[38px] flex-none items-center gap-[7px] rounded-full px-3.5 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 md:h-10 md:px-4 md:text-[13.5px] ${activo ? 'bg-[#0a0a0a] text-white' : 'bg-[#f2f2f0] text-black/[.62] hover:text-[#0a0a0a]'}`}
    >
        {children}
        {globo !== undefined && (
            <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${activo ? 'bg-white/20 text-white' : 'bg-white text-black/[.55]'}`}>
                {globo}
            </span>
        )}
    </button>
);

/** Campo de texto del panel: relleno gris, sin borde, foco negro. */
export const Campo: React.FC<{
    etiqueta: string;
    valor: string;
    onChange: (v: string) => void;
    tipo?: 'text' | 'email' | 'password' | 'url';
    placeholder?: string;
    ayuda?: string;
    autoComplete?: string;
}> = ({ etiqueta, valor, onChange, tipo = 'text', placeholder, ayuda, autoComplete }) => (
    <label className="block">
        <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.07em] text-black/[.55]">
            {etiqueta}
        </span>
        <input
            type={tipo}
            value={valor}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            autoComplete={autoComplete}
            className="h-[46px] w-full rounded-[14px] px-3.5 text-[13.5px] font-medium text-[#0a0a0a]"
        />
        {ayuda && (
            <span className="mt-[7px] block text-[11.5px] font-medium leading-[1.5] text-black/[.6]">{ayuda}</span>
        )}
    </label>
);

/**
 * Confirmación de una acción que cambia el acceso de alguien o borra algo.
 * Sube desde abajo en el teléfono y se centra en escritorio, como el diseño.
 */
export interface PedidoConfirmacion {
    tipo: 'destructivo' | 'control';
    titulo: string;
    texto: string;
    detalleTitulo: string;
    detalle: string;
    etiquetaBoton: string;
    onConfirmar: () => void;
}

export const ModalConfirmacion: React.FC<{
    pedido: PedidoConfirmacion | null;
    onCancelar: () => void;
}> = ({ pedido, onCancelar }) => {
    useBloqueoDeFondo(!!pedido);

    useEffect(() => {
        if (!pedido) return;
        const alSalir = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancelar(); };
        window.addEventListener('keydown', alSalir);
        return () => window.removeEventListener('keydown', alSalir);
    }, [pedido, onCancelar]);

    if (!pedido) return null;
    const destructivo = pedido.tipo === 'destructivo';

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={pedido.titulo}
            className="fixed inset-0 z-[120] flex items-end justify-center bg-[rgba(10,10,10,.42)] p-0 md:items-center md:p-10"
            onClick={onCancelar}
        >
            <div
                onClick={e => e.stopPropagation()}
                className="w-full rounded-t-[24px] bg-white px-6 pb-[22px] pt-6 md:max-w-[520px] md:rounded-[24px]"
            >
                <Rotulo className={destructivo ? 'text-[#a32218]' : 'text-black/[.52]'}>
                    {destructivo ? 'Acción destructiva' : 'Control total'}
                </Rotulo>
                <p className="mt-3 text-[20px] font-semibold leading-[1.35] tracking-[-0.018em] text-[#0a0a0a]">
                    {pedido.titulo}
                </p>
                <p className="mt-3 text-[13.5px] font-medium leading-[1.65] text-black/[.66]">{pedido.texto}</p>

                <div className="mt-4 rounded-[16px] bg-[#f7f7f5] px-4 py-3.5">
                    <p className="text-[12.5px] font-semibold text-[#0a0a0a]">{pedido.detalleTitulo}</p>
                    <p className="mt-1.5 text-[12.5px] font-medium leading-[1.55] text-black/[.64]">{pedido.detalle}</p>
                </div>

                <div className="mt-5 flex flex-col gap-2.5">
                    <button
                        onClick={pedido.onConfirmar}
                        autoFocus
                        className={`h-[52px] w-full rounded-full text-[14.5px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${destructivo ? 'bg-[#a32218]' : 'bg-[#0a0a0a]'}`}
                    >
                        {pedido.etiquetaBoton}
                    </button>
                    <button
                        onClick={onCancelar}
                        className="h-[52px] w-full rounded-full bg-[#f2f2f0] text-[14.5px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};
