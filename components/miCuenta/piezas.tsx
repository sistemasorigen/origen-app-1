import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBloqueoDeFondo } from '../../hooks/useBloqueoDeFondo';

/**
 * Las piezas de "Mi cuenta", según design-claude/MiCuentaLista.dc.html.
 *
 * EL TEMA VA POR VARIABLES CSS Y NO POR UN BOOLEANO.
 * El .dc calcula su paleta en JavaScript a partir de un `dark`, porque es un
 * prototipo que tiene su propio interruptor. Acá el modo oscuro es una CLASE
 * en el <html>, y un estilo en línea no escucha clases de sus ancestros. Si
 * se copiara el .dc tal cual habría que leer la clase con JS y mirarla con un
 * MutationObserver para no quedar desfasado. Con variables el navegador lo
 * resuelve solo, y además nada parpadea al cambiar de tema.
 *
 * Todo está scopeado por `#mi-cuenta`: index.html pisa inputs y selects de
 * toda la app con !important, y ese override sólo se gana por id. Es la misma
 * razón por la que /nocturna-inscripcion tiene su propio id.
 */

// ── Paleta ──────────────────────────────────────────────────────────────

export const ESTILOS_MI_CUENTA = `
#mi-cuenta {
    --mc-bg: #f6f6f4;
    --mc-card: #ffffff;
    --mc-surf: #f7f7f5;
    --mc-chip: #f2f2f0;
    --mc-hover: #f7f7f5;
    --mc-hover-card: #fcfcfb;
    --mc-sel: #f2f2f0;
    --mc-ink: #0a0a0a;
    --mc-prim: #0a0a0a;
    --mc-prim-ink: #ffffff;
    --mc-red: #d1343a;
    --mc-line: rgba(0,0,0,.06);
    --mc-dash: rgba(0,0,0,.14);
    --mc-shadow: 0 1px 2px rgba(0,0,0,.04), 0 1px 1px rgba(0,0,0,.02);
    --mc-skel: #ececea;
    --mc-track: #e5e5e2;
    --mc-amber-bg: #fbefd5;
    --mc-amber-ink: #8f5c00;
    --mc-green-bg: #dff3e4;
    --mc-green-ink: #1d6a38;
    --mc-overlay: rgba(0,0,0,.42);
    --mc-m66: rgba(0,0,0,.7);
    --mc-m50: rgba(0,0,0,.55);
    --mc-m38: rgba(0,0,0,.42);

    background: var(--mc-bg);
    color: var(--mc-ink);
    transition: background-color .4s ease, color .4s ease;
}

.dark #mi-cuenta {
    --mc-bg: #111110;
    --mc-card: #1b1b1a;
    --mc-surf: #232321;
    --mc-chip: #2a2a28;
    --mc-hover: #222220;
    --mc-hover-card: #202020;
    --mc-sel: #2a2a28;
    --mc-ink: #f4f4f2;
    --mc-prim: #ffffff;
    --mc-prim-ink: #0a0a0a;
    --mc-red: #ff6b70;
    --mc-line: rgba(255,255,255,.07);
    --mc-dash: rgba(255,255,255,.16);
    --mc-shadow: 0 1px 2px rgba(0,0,0,.3);
    --mc-skel: #2a2a28;
    --mc-track: #3a3a38;
    --mc-amber-bg: #3a2d12;
    --mc-amber-ink: #f2b84b;
    --mc-green-bg: #173322;
    --mc-green-ink: #7fdb9c;
    --mc-overlay: rgba(0,0,0,.6);
    --mc-m66: rgba(255,255,255,.7);
    --mc-m50: rgba(255,255,255,.55);
    --mc-m38: rgba(255,255,255,.42);
}

/* Los campos: el override global de index.html los deja blancos también en
   oscuro, con borde slate y radio chico. Scopeado por id se recupera el
   tratamiento del .dc. */
#mi-cuenta .mc-campo {
    width: 100%;
    height: 52px;
    padding: 0 16px;
    border-radius: 16px !important;
    border: 2px solid transparent !important;
    background: var(--mc-surf) !important;
    color: var(--mc-ink) !important;
    font: inherit;
    font-size: 16px;
    font-weight: 500;
    outline: none !important;
    box-shadow: none !important;
    transition: background-color .4s ease, color .4s ease, border-color .15s ease;
}
#mi-cuenta .mc-campo::placeholder { color: var(--mc-m38) !important; opacity: 1; }
#mi-cuenta .mc-campo:focus-visible {
    border-color: var(--mc-ink) !important;
    outline: 2px solid transparent !important;
    outline-offset: 2px;
}
#mi-cuenta .mc-campo--mal { border-color: var(--mc-ink) !important; }
#mi-cuenta textarea.mc-campo {
    height: auto;
    min-height: 96px;
    padding: 14px 16px;
    line-height: 1.45;
    resize: vertical;
}
#mi-cuenta input[type="date"].mc-campo { color-scheme: light; }
.dark #mi-cuenta input[type="date"].mc-campo { color-scheme: dark; }

/* Una sola entrada por pantalla, y sólo en el teléfono: es la que dice de
   qué lado venís. En escritorio las dos columnas están siempre, así que
   animar sería movimiento sin información. */
@keyframes mcEntraDerecha { from { opacity: 0; transform: translateX(42px); } to { opacity: 1; transform: none; } }
@keyframes mcEntraIzquierda { from { opacity: 0; transform: translateX(-42px); } to { opacity: 1; transform: none; } }
@keyframes mcAparece { from { opacity: 0; } to { opacity: 1; } }
@keyframes mcSube { from { transform: translateY(100%); } to { transform: none; } }
@keyframes mcSurge { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: none; } }
@keyframes mcTilde { 0% { transform: scale(.4); opacity: 0; } 60% { transform: scale(1.15); opacity: 1; } 100% { transform: none; } }
@keyframes mcGira { to { transform: rotate(360deg); } }
@keyframes mcLatido { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
@keyframes mcAvisoEntra { from { opacity: 0; transform: translate(-50%, 24px); } to { opacity: 1; transform: translate(-50%, 0); } }

#mi-cuenta .mc-der { animation: mcEntraDerecha .32s cubic-bezier(.2,.8,.3,1) both; }
#mi-cuenta .mc-izq { animation: mcEntraIzquierda .32s cubic-bezier(.2,.8,.3,1) both; }

@media (prefers-reduced-motion: reduce) {
    #mi-cuenta *, #mi-cuenta *::before, #mi-cuenta *::after {
        animation-duration: .01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: .01ms !important;
    }
}
`;

// ── Medidas y clases que se repiten ─────────────────────────────────────

export const TARJETA = 'rounded-[26px] overflow-hidden';
export const ESTILO_TARJETA: React.CSSProperties = {
    background: 'var(--mc-card)',
    boxShadow: 'var(--mc-shadow)',
    transition: 'background-color .4s ease, color .4s ease, box-shadow .4s ease',
};

/** El rótulo de sección del .dc: 12px, semibold, muy espaciado. */
export const Rotulo: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <p
        className={`m-0 text-[12px] font-semibold tracking-[.07em] ${className}`}
        style={{ color: 'var(--mc-m38)' }}
    >
        {children}
    </p>
);

/** Los íconos del .dc, tal cual. */
export const ICONOS: Record<string, string> = {
    grupos: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20a6.5 6.5 0 0113 0M16 4.3a3.5 3.5 0 010 6.4M17.5 14a6.5 6.5 0 014 6',
    calendario: 'M4 6.5h16v13H4zM4 10.5h16M8.5 4v4M15.5 4v4',
    historial: 'M4 12a8 8 0 102.4-5.7M4 4.5V9h4.5M12 8v4.5l3 2',
    bolsa: 'M5 8h14l-1.2 12H6.2zM9 8a3 3 0 016 0',
    entrada: 'M3.5 7h17v3.2a1.8 1.8 0 000 3.6V17h-17v-3.2a1.8 1.8 0 000-3.6zM14.5 7v10',
    solicitud: 'M9 3.5h6v3H9zM9 5H6v15.5h12V5h-3M9 11.5h6M9 15.5h4',
    servir: 'M12 9.2c-1-1.8-4-1.5-4 .8 0 1.8 4 4 4 4s4-2.2 4-4c0-2.3-3-2.6-4-.8zM3 16h3.5l3.5 3h6.5l4.5-3.5M3 16v4',
    campana: 'M6 16.5V11a6 6 0 0112 0v5.5l1.5 2h-15zM10 20.5a2 2 0 004 0',
    celular: 'M7.5 3h9v18h-9zM11 18h2',
    luna: 'M19.5 14.5A7.5 7.5 0 019.5 4.5a7.5 7.5 0 1010 10z',
    escudo: 'M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z',
    candado: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 017 0v3M12 14.5v2',
    play: 'M12 3.5a8.5 8.5 0 110 17 8.5 8.5 0 010-17zM10 8.8v6.4l5.2-3.2z',
    chat: 'M4.5 5h15v11H10l-5.5 4z',
    bicho: 'M12 20a5 5 0 005-5v-4a5 5 0 00-10 0v4a5 5 0 005 5zM12 11v9M7 13H3.5M20.5 13H17M8.5 7L6 4.5M15.5 7L18 4.5',
    documento: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
    info: 'M12 3.5a8.5 8.5 0 110 17 8.5 8.5 0 010-17zM12 11v5.5M12 7.8v.2',
    flecha: 'M9.5 5.5L16 12l-6.5 6.5',
    atras: 'M14.5 5.5L8 12l6.5 6.5',
    afuera: 'M8 16L16.5 7.5M9.5 7.5h7v7',
    equis: 'M6 6l12 12M18 6L6 18',
    tilde: 'M5 12.5l4.5 4.5L19 7.5',
};

export const Icono: React.FC<{ d: string; tam?: number; grosor?: number; className?: string }> = ({
    d, tam = 19, grosor = 1.7, className = '',
}) => (
    <svg
        width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true" className={`flex-none ${className}`}
    >
        <path d={d} />
    </svg>
);

/** El círculo de 36px que lleva el ícono de cada fila. */
export const CirculoDeIcono: React.FC<{ d: string }> = ({ d }) => (
    <span
        className="w-9 h-9 flex-none rounded-full flex items-center justify-center"
        style={{ background: 'var(--mc-chip)', color: 'var(--mc-ink)', transition: 'background-color .4s ease, color .4s ease' }}
    >
        <Icono d={d} />
    </span>
);

// ── Fila ────────────────────────────────────────────────────────────────

export interface FilaProps {
    icono: string;
    nombre: string;
    detalle?: string;
    /** El número a la derecha: cuántos grupos, cuántas compras. */
    valor?: string | number | null;
    /** La pastilla roja de sin leer. */
    marca?: number;
    /** Abre algo de afuera de Mi cuenta: la flecha cambia. */
    externa?: boolean;
    activa?: boolean;
    onClick?: () => void;
    /** Un interruptor en vez de una flecha. */
    interruptor?: { prendido: boolean; onChange?: () => void; apagado?: boolean };
    /** La línea de ayuda debajo, con su propia acción. */
    ayuda?: { texto: string; onClick: () => void };
    /** La primera de un grupo no lleva línea arriba. */
    primera?: boolean;
}

export const Fila: React.FC<FilaProps> = ({
    icono, nombre, detalle, valor, marca, externa, activa, onClick,
    interruptor, ayuda, primera,
}) => {
    const esInterruptor = !!interruptor;
    const inerte = esInterruptor && !!interruptor.apagado;

    const aria = [
        nombre,
        valor ? `, ${valor}` : '',
        marca ? `, ${marca} sin leer` : '',
    ].join('');

    return (
        <div style={{ borderTop: primera ? '0' : '1px solid var(--mc-line)' }}>
            <button
                type="button"
                role={esInterruptor ? 'switch' : 'button'}
                aria-checked={esInterruptor ? interruptor.prendido : undefined}
                aria-label={aria}
                disabled={inerte}
                onClick={esInterruptor ? interruptor.onChange : onClick}
                className="w-full min-h-[56px] flex items-center gap-3.5 px-4 py-2.5 border-0 font-[inherit] text-left"
                style={{
                    background: activa ? 'var(--mc-sel)' : 'transparent',
                    color: 'var(--mc-ink)',
                    cursor: inerte ? 'default' : 'pointer',
                    opacity: inerte ? .55 : 1,
                    transition: 'background-color .2s ease, color .4s ease',
                }}
            >
                <CirculoDeIcono d={icono} />

                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="text-[15px] leading-[1.3] font-semibold">{nombre}</span>
                    {detalle && (
                        <span className="text-[13px] leading-[1.4] font-medium text-pretty" style={{ color: 'var(--mc-m50)' }}>
                            {detalle}
                        </span>
                    )}
                </span>

                {valor ? (
                    <span className="flex-none text-[14.5px] font-medium" style={{ color: 'var(--mc-m50)' }}>{valor}</span>
                ) : null}

                {marca ? (
                    <span className="flex-none min-w-[22px] h-[22px] px-[7px] rounded-full bg-[#e5484d] text-white text-[12px] font-bold flex items-center justify-center">
                        {marca > 9 ? '9+' : marca}
                    </span>
                ) : null}

                {esInterruptor ? (
                    <span
                        aria-hidden="true"
                        className="relative flex-none w-[51px] h-[31px] rounded-full"
                        style={{
                            background: interruptor.prendido ? '#34c759' : 'var(--mc-track)',
                            transition: 'background-color .28s ease',
                        }}
                    >
                        <span
                            className="absolute top-[2px] left-[2px] w-[27px] h-[27px] rounded-full bg-white"
                            style={{
                                boxShadow: '0 2px 5px rgba(0,0,0,.22)',
                                transform: `translateX(${interruptor.prendido ? 20 : 0}px)`,
                                transition: 'transform .32s cubic-bezier(.3,1.35,.5,1)',
                            }}
                        />
                    </span>
                ) : (
                    <Icono
                        d={externa ? ICONOS.afuera : ICONOS.flecha}
                        tam={17}
                        grosor={2}
                        className="opacity-100"
                    />
                )}
            </button>

            {ayuda && (
                <button
                    type="button"
                    onClick={ayuda.onClick}
                    className="flex items-center gap-1 min-h-[44px] -mt-1.5 mb-1 ml-[66px] pr-2.5 border-0 bg-transparent font-[inherit] text-[13.5px] font-semibold underline underline-offset-[3px] cursor-pointer"
                    style={{ color: 'var(--mc-ink)' }}
                >
                    {ayuda.texto}
                    <Icono d={ICONOS.flecha} tam={14} grosor={2.2} />
                </button>
            )}
        </div>
    );
};

/** Un grupo de filas con su rótulo. */
export const GrupoDeFilas: React.FC<{ titulo?: string; children: React.ReactNode }> = ({ titulo, children }) => (
    <>
        {titulo && <Rotulo className="mt-7 mb-2.5 ml-1.5">{titulo}</Rotulo>}
        <div className={TARJETA} style={ESTILO_TARJETA}>{children}</div>
    </>
);

// ── Encabezado de una sub-pantalla ──────────────────────────────────────

/**
 * El título de una sección, con su flecha de volver.
 *
 * La flecha sólo aparece cuando hay a dónde volver: en el teléfono siempre
 * (la sección reemplazó al índice), en escritorio nunca para una sección de
 * primer nivel —el índice está a la izquierda, a la vista— y sí para un
 * detalle que cuelga de otra sección.
 */
export const EncabezadoSubpagina: React.FC<{
    titulo: string;
    onVolver?: () => void;
    grande?: boolean;
    children?: React.ReactNode;
}> = ({ titulo, onVolver, grande, children }) => (
    <div className="flex items-center gap-3 min-h-[44px]">
        {onVolver && (
            <button
                type="button"
                onClick={onVolver}
                aria-label="Volver"
                className="w-11 h-11 flex-none border-0 rounded-full flex items-center justify-center cursor-pointer"
                style={{ background: 'var(--mc-chip)', color: 'var(--mc-ink)', transition: 'background-color .4s ease' }}
            >
                <Icono d={ICONOS.atras} tam={20} grosor={2} />
            </button>
        )}
        <h2
            className={`m-0 font-semibold tracking-[-.025em] leading-[1.15] ${grande ? 'text-[28px]' : 'text-[24px] lg:text-[28px]'}`}
        >
            {titulo}
        </h2>
        {children}
    </div>
);

// ── Panel: hoja desde abajo en el teléfono, modal en la compu ───────────

/**
 * Lo que el .dc llama sheet.
 *
 * En el teléfono sube desde abajo y se puede arrastrar para cerrarla; en la
 * compu es un modal centrado. Las dos frenan el fondo con useBloqueoDeFondo,
 * que es la regla de la casa (overflow:hidden no alcanza en iOS Safari).
 *
 * Va por portal al <body>: adentro del árbol quedaría atrapado por el
 * `transform` de la transición de pantalla, y un `position:fixed` adentro de
 * un elemento transformado se posiciona contra ESE elemento, no contra la
 * ventana. Es el mismo motivo por el que el visor de /eventos usa portal.
 */
export const Panel: React.FC<{
    abierto: boolean;
    onCerrar: () => void;
    etiqueta: string;
    children: React.ReactNode;
}> = ({ abierto, onCerrar, etiqueta, children }) => {
    const hoja = useRef<HTMLDivElement>(null);
    const arrastre = useRef<number | null>(null);
    const recorrido = useRef(0);

    useBloqueoDeFondo(abierto);

    useEffect(() => {
        if (!abierto) return;
        const alEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
        document.addEventListener('keydown', alEscape);
        return () => document.removeEventListener('keydown', alEscape);
    }, [abierto, onCerrar]);

    if (!abierto || typeof document === 'undefined') return null;

    const empezar = (e: React.PointerEvent) => {
        arrastre.current = e.clientY;
        recorrido.current = 0;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* el navegador no quiso */ }
        if (hoja.current) hoja.current.style.transition = 'none';
    };
    const mover = (e: React.PointerEvent) => {
        if (arrastre.current == null) return;
        const dy = Math.max(0, e.clientY - arrastre.current);
        recorrido.current = dy;
        if (hoja.current) hoja.current.style.transform = `translateY(${dy}px)`;
    };
    const soltar = () => {
        if (arrastre.current == null) return;
        const dy = recorrido.current;
        arrastre.current = null;
        if (hoja.current) {
            hoja.current.style.transition = 'transform .2s ease';
            hoja.current.style.transform = dy > 90 ? 'translateY(100%)' : '';
        }
        if (dy > 90) setTimeout(onCerrar, 180);
    };

    return createPortal(
        <div id="mi-cuenta-panel">
            <style>{ESTILOS_MI_CUENTA.replace(/#mi-cuenta\b/g, '#mi-cuenta-panel')}</style>
            <div
                onClick={onCerrar}
                className="fixed inset-0 z-[70] flex items-end md:items-center md:justify-center"
                style={{ background: 'var(--mc-overlay)', animation: 'mcAparece .2s ease' }}
            >
                <div
                    ref={hoja}
                    role="dialog"
                    aria-modal="true"
                    aria-label={etiqueta}
                    onClick={e => e.stopPropagation()}
                    className="w-full md:w-[460px] max-h-[92%] overflow-y-auto rounded-t-[28px] md:rounded-[28px] px-4 pb-[30px] md:px-6 md:pt-7 md:pb-6"
                    style={{
                        background: 'var(--mc-card)',
                        color: 'var(--mc-ink)',
                        boxShadow: '0 24px 60px rgba(0,0,0,.22)',
                        animation: 'mcSube .3s cubic-bezier(.2,.9,.3,1)',
                    }}
                >
                    <div
                        onPointerDown={empezar}
                        onPointerMove={mover}
                        onPointerUp={soltar}
                        onPointerCancel={soltar}
                        className="md:hidden flex justify-center pt-2.5 pb-3.5 cursor-grab"
                        style={{ touchAction: 'none' }}
                    >
                        <span className="w-10 h-[5px] rounded-full" style={{ background: 'var(--mc-m38)' }} />
                    </div>
                    {children}
                </div>
            </div>
        </div>,
        document.body,
    );
};

/** El título y el subtítulo de un panel. */
export const TituloDePanel: React.FC<{ titulo: string; detalle?: string }> = ({ titulo, detalle }) => (
    <>
        <p className="m-0 text-[20px] leading-[1.25] font-semibold tracking-[-.02em] text-center md:text-left">{titulo}</p>
        {detalle && (
            <p className="mt-2 mb-0 text-[15px] leading-[1.45] font-medium text-pretty text-center md:text-left" style={{ color: 'var(--mc-m50)' }}>
                {detalle}
            </p>
        )}
    </>
);

// ── Botones ─────────────────────────────────────────────────────────────

const BASE_BOTON = 'min-h-[52px] rounded-full border-0 font-[inherit] text-[15.5px] font-semibold cursor-pointer flex items-center justify-center gap-2';

export const BotonPrimario: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { ancho?: boolean }> = ({
    ancho, className = '', style, ...resto
}) => (
    <button
        type="button"
        className={`${BASE_BOTON} ${ancho ? 'w-full' : 'px-6'} ${className}`}
        style={{
            background: 'var(--mc-prim)',
            color: 'var(--mc-prim-ink)',
            opacity: resto.disabled ? .35 : 1,
            transition: 'opacity .2s ease, background-color .4s ease',
            ...style,
        }}
        {...resto}
    />
);

export const BotonSecundario: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { ancho?: boolean }> = ({
    ancho, className = '', style, ...resto
}) => (
    <button
        type="button"
        className={`${BASE_BOTON} ${ancho ? 'w-full' : 'px-5'} ${className}`}
        style={{ background: 'var(--mc-chip)', color: 'var(--mc-ink)', ...style }}
        {...resto}
    />
);

export const BotonFantasma: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { ancho?: boolean }> = ({
    ancho, className = '', style, ...resto
}) => (
    <button
        type="button"
        className={`${BASE_BOTON} ${ancho ? 'w-full' : 'px-5'} ${className}`}
        style={{ background: 'transparent', color: 'var(--mc-ink)', ...style }}
        {...resto}
    />
);

export const BotonRojo: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', style, ...resto }) => (
    <button
        type="button"
        className={`${BASE_BOTON} w-full ${className}`}
        style={{ background: 'var(--mc-chip)', color: 'var(--mc-red)', ...style }}
        {...resto}
    />
);

/** El girito de "estoy haciendo algo". */
export const Girito: React.FC<{ sobreOscuro?: boolean }> = ({ sobreOscuro }) => (
    <span
        className="w-[18px] h-[18px] rounded-full flex-none"
        style={{
            border: `2.5px solid ${sobreOscuro ? 'rgba(255,255,255,.3)' : 'var(--mc-chip)'}`,
            borderTopColor: sobreOscuro ? 'var(--mc-prim-ink)' : 'var(--mc-ink)',
            animation: 'mcGira .7s linear infinite',
        }}
    />
);

// ── Aviso flotante ──────────────────────────────────────────────────────

/** El toast del .dc: una línea abajo, que se va sola. */
export const useAvisoFlotante = () => {
    const [aviso, setAviso] = useState<string | null>(null);
    const reloj = useRef<number | null>(null);

    useEffect(() => () => { if (reloj.current) window.clearTimeout(reloj.current); }, []);

    const avisar = (texto: string) => {
        setAviso(texto);
        if (reloj.current) window.clearTimeout(reloj.current);
        reloj.current = window.setTimeout(() => setAviso(null), 2600);
    };

    const Aviso = () => {
        if (!aviso || typeof document === 'undefined') return null;
        return createPortal(
            <div
                role="status"
                className="fixed left-1/2 bottom-[104px] z-[80] max-w-[calc(100%-32px)] px-5 py-3 rounded-full text-[14.5px] font-semibold text-center"
                style={{
                    background: 'var(--mc-prim, #0a0a0a)',
                    color: 'var(--mc-prim-ink, #fff)',
                    boxShadow: '0 8px 24px rgba(0,0,0,.2)',
                    animation: 'mcAvisoEntra .28s cubic-bezier(.2,.9,.3,1) both',
                }}
            >
                {aviso}
            </div>,
            document.body,
        );
    };

    return { avisar, Aviso };
};

// ── Esqueletos ──────────────────────────────────────────────────────────

export const Hueso: React.FC<{ ancho?: string; alto?: number; redondo?: boolean; className?: string }> = ({
    ancho = '100%', alto = 13, redondo, className = '',
}) => (
    <div
        className={className}
        style={{
            width: ancho,
            height: alto,
            background: 'var(--mc-skel)',
            borderRadius: redondo ? 999 : 8,
            animation: 'mcLatido 1.2s ease-in-out infinite',
        }}
    />
);

/** Lo que se ve mientras una sección todavía no existe o está cargando. */
export const EsqueletoDeSeccion: React.FC<{ filas?: number }> = ({ filas = 3 }) => (
    <div aria-busy="true" aria-label="Cargando" className="flex flex-col gap-3 mt-6">
        {Array.from({ length: filas }).map((_, i) => (
            <div key={i} className={`${TARJETA} flex gap-3.5 p-4`} style={ESTILO_TARJETA}>
                <Hueso ancho="56px" alto={56} />
                <div className="flex-1 pt-1">
                    <Hueso ancho={['58%', '44%', '52%'][i % 3]} alto={14} />
                    <div className="h-2.5" />
                    <Hueso ancho={['80%', '70%', '64%'][i % 3]} alto={11} />
                </div>
            </div>
        ))}
    </div>
);

// ── Vacío ───────────────────────────────────────────────────────────────

export const Vacio: React.FC<{
    icono: string;
    titulo: string;
    detalle?: string;
    accion?: { texto: string; onClick: () => void };
}> = ({ icono, titulo, detalle, accion }) => (
    <div className="flex flex-col items-center text-center px-4 pt-[72px] pb-6">
        <span
            className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
            style={{ background: 'var(--mc-chip)' }}
        >
            <Icono d={icono} tam={30} grosor={1.5} />
        </span>
        <p className="mt-5 mb-0 text-[18px] leading-[1.3] font-semibold tracking-[-.015em] text-balance">{titulo}</p>
        {detalle && (
            <p className="mt-2 mb-0 max-w-[320px] text-[15px] leading-[1.45] font-medium text-pretty" style={{ color: 'var(--mc-m50)' }}>
                {detalle}
            </p>
        )}
        {accion && <BotonPrimario onClick={accion.onClick} className="mt-[22px] min-h-[48px]">{accion.texto}</BotonPrimario>}
    </div>
);
