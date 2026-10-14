import React from 'react';

/**
 * Las piezas que repiten todas las listas del Punto de Información.
 *
 * Cinco pantallas distintas —eventos, presentaciones, anuncios, préstamos,
 * bautismos— hacen lo mismo: una tarjeta con su título y su acción arriba,
 * grupos que además cuentan, filas de una línea y un estado vacío que invita
 * a cargar el primero. Vivían copiadas cinco veces y se habían ido
 * separando: cada una con su borde, su tamaño de letra y su mayúscula.
 *
 * El idioma es el del login: minúsculas con tracking-tight, negro puro,
 * botones redondos, texto secundario en slate-500 y avisos en tonos suaves.
 */

// ── La tarjeta que envuelve toda la lista ───────────────────────────────
export const TarjetaDelPunto: React.FC<{
    titulo: string;
    bajada?: string;
    acciones?: React.ReactNode;
    children: React.ReactNode;
}> = ({ titulo, bajada, acciones, children }) => (
    <div className="animate-fadeIn">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 pt-5 pb-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-[22px] font-bold tracking-tight text-black leading-none">{titulo}</h2>
                    {bajada && <p className="text-sm text-slate-500 mt-1.5">{bajada}</p>}
                </div>
                {acciones && <div className="flex gap-2 shrink-0">{acciones}</div>}
            </div>
            {children}
        </div>
    </div>
);

// ── La cabecera de un grupo: separa y cuenta ────────────────────────────
export const CabeceraGrupo: React.FC<{ children: React.ReactNode; cuenta?: string }> = ({ children, cuenta }) => (
    <h3 className="sticky top-0 z-10 px-5 sm:px-6 py-2 bg-slate-50/95 backdrop-blur border-y border-slate-100 flex items-center justify-between gap-3 text-[13px] font-semibold text-slate-500">
        <span>{children}</span>
        {cuenta && <span className="tabular-nums font-normal text-slate-400">{cuenta}</span>}
    </h3>
);

// ── Una fila ────────────────────────────────────────────────────────────
export const Fila: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <li className="px-5 sm:px-6 py-3 flex items-center gap-2.5 sm:gap-3 hover:bg-slate-50/60 transition-colors">
        {children}
    </li>
);

export const ListaDeFilas: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <ul className="divide-y divide-slate-100">{children}</ul>
);

// ── Botones ─────────────────────────────────────────────────────────────
const TONOS = {
    quieto: 'text-slate-300 hover:text-black hover:bg-slate-100',
    listo: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100',
    peligro: 'text-slate-300 hover:text-red-600 hover:bg-red-50',
};

export const BotonCircular: React.FC<{
    icono: React.ElementType;
    etiqueta: string;
    onClick: (e: React.MouseEvent) => void;
    tono?: keyof typeof TONOS;
}> = ({ icono: Icono, etiqueta, onClick, tono = 'quieto' }) => (
    <button
        type="button"
        onClick={onClick}
        aria-label={etiqueta}
        title={etiqueta}
        className={`shrink-0 w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full transition-colors ${TONOS[tono]}`}
    >
        <Icono className="w-4 h-4 pointer-events-none" />
    </button>
);

export const BotonPrincipal: React.FC<{
    onClick: () => void;
    children: React.ReactNode;
    icono?: React.ElementType;
}> = ({ onClick, children, icono: Icono }) => (
    <button
        type="button"
        onClick={onClick}
        className="flex-1 sm:flex-none px-4 sm:px-5 py-3.5 bg-black text-white font-semibold text-sm rounded-full hover:bg-neutral-800 active:scale-[0.99] transition-all flex items-center justify-center gap-2 whitespace-nowrap"
    >
        {Icono && <Icono className="w-4 h-4" />}
        {children}
    </button>
);

export const BotonSecundario: React.FC<{
    onClick: () => void;
    children: React.ReactNode;
    icono?: React.ElementType;
}> = ({ onClick, children, icono: Icono }) => (
    <button
        type="button"
        onClick={onClick}
        className="flex-1 sm:flex-none px-4 sm:px-5 py-3.5 bg-slate-100 text-black font-semibold text-sm rounded-full hover:bg-slate-200 active:scale-[0.99] transition-all flex items-center justify-center gap-2 whitespace-nowrap"
    >
        {Icono && <Icono className="w-4 h-4" />}
        {children}
    </button>
);

// ── Cápsulas de estado ──────────────────────────────────────────────────
const PASTILLAS = {
    neutra: 'bg-slate-100 text-slate-700',
    buena: 'bg-emerald-50 text-emerald-700',
    aviso: 'bg-amber-50 text-amber-700',
    mala: 'bg-red-50 text-red-700',
};

export const Pastilla: React.FC<{
    children: React.ReactNode;
    tono?: keyof typeof PASTILLAS;
    onClick?: () => void;
    etiqueta?: string;
}> = ({ children, tono = 'neutra', onClick, etiqueta }) => {
    const clases = `shrink-0 rounded-full px-2.5 py-1 text-[13px] font-semibold tabular-nums ${PASTILLAS[tono]}`;
    if (!onClick) return <span className={clases}>{children}</span>;
    return (
        <button type="button" onClick={onClick} aria-label={etiqueta} title={etiqueta} className={`${clases} hover:brightness-95 transition-all`}>
            {children}
        </button>
    );
};

// ── Cuando no hay nada ──────────────────────────────────────────────────
export const EstadoVacio: React.FC<{
    icono: React.ElementType;
    titulo: string;
    texto: string;
    accion?: { texto: string; onClick: () => void; icono?: React.ElementType };
}> = ({ icono: Icono, titulo, texto, accion }) => (
    <div className="flex flex-col items-center text-center px-6 py-16 border-t border-slate-100">
        <span className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Icono className="w-6 h-6 text-slate-400" />
        </span>
        <h3 className="text-lg font-bold tracking-tight text-black">{titulo}</h3>
        <p className="text-sm text-slate-500 mt-1.5 mb-6 max-w-xs leading-relaxed">{texto}</p>
        {accion && (
            <button
                type="button"
                onClick={accion.onClick}
                className="px-5 py-3.5 bg-black text-white font-semibold text-sm rounded-full hover:bg-neutral-800 active:scale-[0.99] transition-all flex items-center gap-2"
            >
                {accion.icono && <accion.icono className="w-4 h-4" />}
                {accion.texto}
            </button>
        )}
    </div>
);

/** La fecha corta de siempre: "11/10". */
export const fechaCorta = (iso?: string) => {
    if (!iso) return '';
    const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
};
