// ════════════════════════════════════════════════════════════════════════
// Patrón común de /mis-grupos/:groupId — las 4 piezas que el diseño define
// una sola vez y se repiten idénticas en las seis pantallas de acción.
//
// Del diseño (Acciones - Patron y Asistencia.dc.html, turno 1):
//   1a Encabezado · 1b Flujo por pasos · 1c Confirmación · 1d Estado vacío
//
// Gradación de riesgo, que decide qué pieza usar:
//   Cotidiano  → asistencia, solicitudes. Un toque, sin confirmación.
//   Serio      → baja, derivación. Motivo obligatorio + HojaConfirmacion
//                con nombre propio y rojo SOLO en la consecuencia.
//   Definitivo → transferir el grupo. Pantalla propia en negro.
// ════════════════════════════════════════════════════════════════════════
import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useBloqueoDeFondo } from '../../../hooks/useBloqueoDeFondo';

// ── Tokens ──────────────────────────────────────────────────────────────
// Se exportan como strings para que las pantallas no reinventen valores.
export const T = {
    fondo: 'bg-[#f6f6f4] dark:bg-[#111110]',
    tarjeta: 'bg-white dark:bg-[#1b1b1a] shadow-[0_1px_3px_rgba(0,0,0,.05)]',
    // Superficie interna: listas, inputs, filas agrupadas.
    interna: 'bg-[#f7f7f5] dark:bg-[#232322]',
    // Chips y botones secundarios.
    chip: 'bg-[#f2f2f0] dark:bg-[#2a2a28]',
    tinta: 'text-[#0a0a0a] dark:text-white',
    // El diseño usa opacidades sobre negro, no grises nombrados.
    suave: 'text-black/50 dark:text-white/50',
    tenue: 'text-black/38 dark:text-white/38',
    borde: 'border-black/[.07] dark:border-white/10',
    // Rojo SOLO para la palabra de la consecuencia, nunca de fondo.
    riesgo: 'text-[oklch(0.52_0.19_25)] dark:text-[oklch(0.7_0.17_25)]',
    fuente: "font-['Manrope',system-ui,sans-serif]",
} as const;

// Base SIN medidas: ancho, alto y tamaño de letra los pone quien lo usa.
// Existe porque Tailwind resuelve las clases en conflicto por el orden del
// CSS generado, no por el orden en el atributo: agregarle `h-[52px]` a un
// string que ya trae `h-[58px]` no lo pisa, gana el que salió primero.
export const btnPrimarioBase =
    "rounded-full bg-black dark:bg-white text-white dark:text-black font-semibold " +
    "flex items-center justify-center gap-2.5 transition-opacity hover:opacity-[.88] active:opacity-80 " +
    "disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black/15";

export const btnSecundarioBase =
    "rounded-full bg-[#f2f2f0] dark:bg-[#2a2a28] text-[#0a0a0a] dark:text-white font-semibold " +
    "flex items-center justify-center gap-2 transition-colors hover:bg-[#e9e9e6] dark:hover:bg-[#333331] " +
    "disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black/10";

export const btnPrimario = `w-full h-[58px] text-[16.5px] ${btnPrimarioBase}`;

export const btnSecundario = `h-[56px] px-6 text-[16px] ${btnSecundarioBase}`;

// Rótulo de sección: MIEMBROS, ADMINISTRACIÓN, GRADACIÓN…
export const rotulo = "text-[12px] font-semibold uppercase tracking-[.07em] text-black/38 dark:text-white/38";

// ── 1a · Encabezado ─────────────────────────────────────────────────────
// Mobile: círculo de volver + nombre de la acción + grupo como subtítulo.
// Desktop: la misma información aplanada en un breadcrumb de una línea.
export const Encabezado: React.FC<{
    accion: string;
    grupo: string;
    onVolver: () => void;
}> = ({ accion, grupo, onVolver }) => (
    <>
        <div className="flex items-center gap-3.5 lg:hidden">
            <button
                type="button"
                onClick={onVolver}
                aria-label="Volver"
                className="w-10 h-10 shrink-0 rounded-full bg-[#f2f2f0] dark:bg-[#2a2a28] flex items-center justify-center transition-colors hover:bg-[#e9e9e6] dark:hover:bg-[#333331]"
            >
                <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={2.2} />
            </button>
            <div className="min-w-0">
                <p className="text-[18px] font-semibold tracking-[-.01em] truncate">{accion}</p>
                <p className="text-[13px] font-medium text-black/45 dark:text-white/45 truncate">{grupo}</p>
            </div>
        </div>

        <div className="hidden lg:flex items-center gap-3">
            <button
                type="button"
                onClick={onVolver}
                aria-label="Volver"
                className="w-9 h-9 shrink-0 rounded-full bg-[#f2f2f0] dark:bg-[#2a2a28] flex items-center justify-center transition-colors hover:bg-[#e9e9e6] dark:hover:bg-[#333331]"
            >
                <ArrowLeft className="w-4 h-4" strokeWidth={2.2} />
            </button>
            <span className="text-[13.5px] font-medium text-black/50 dark:text-white/50 truncate">{grupo}</span>
            <span className="text-[13.5px] font-medium text-black/28 dark:text-white/28">/</span>
            <span className="text-[13.5px] font-semibold truncate">{accion}</span>
        </div>
    </>
);

// ── 1b · Flujo por pasos ────────────────────────────────────────────────
// Segmentos, no números en círculos: se lee como progreso y ocupa una línea.
export const Pasos: React.FC<{
    actual: number;      // 1-indexado
    total: number;
    nombre: string;      // nombre del paso actual, a la derecha
}> = ({ actual, total, nombre }) => (
    <div>
        <div className="flex items-center justify-between gap-3">
            <p className={rotulo}>Paso {actual} de {total}</p>
            <p className="text-[13px] font-semibold text-black/45 dark:text-white/45 truncate">{nombre}</p>
        </div>
        <div className="flex gap-1.5 mt-3" role="progressbar" aria-valuenow={actual} aria-valuemin={1} aria-valuemax={total}>
            {Array.from({ length: total }, (_, i) => (
                <div
                    key={i}
                    className={`flex-1 h-[5px] rounded-full transition-colors ${i < actual ? 'bg-[#0a0a0a] dark:bg-white' : 'bg-[#e6e6e2] dark:bg-[#333331]'}`}
                />
            ))}
        </div>
    </div>
);

// Fila de botones del flujo: "Volver" al ancho de su texto, primaria al resto.
export const PasosBotones: React.FC<{
    onVolver?: () => void;
    onSiguiente: () => void;
    textoSiguiente: string;
    puedeSeguir: boolean;
    cargando?: boolean;
}> = ({ onVolver, onSiguiente, textoSiguiente, puedeSeguir, cargando }) => (
    <div className="flex gap-2.5">
        {onVolver && (
            <button type="button" onClick={onVolver} disabled={cargando} className={btnSecundario}>
                Volver
            </button>
        )}
        <button
            type="button"
            onClick={onSiguiente}
            disabled={!puedeSeguir || cargando}
            className={`${btnPrimario} flex-1`}
        >
            {textoSiguiente}
        </button>
    </div>
);

// Campo del flujo por pasos: 58px, radio 20, rótulo ADENTRO. El rótulo solo
// aparece cuando hay valor — vacío, el placeholder ya dice qué va.
export const Campo: React.FC<{
    etiqueta: string;
    valor: string;
    onChange: (v: string) => void;
    placeholder?: string;
    opcional?: boolean;
    tipo?: string;
    id?: string;
}> = ({ etiqueta, valor, onChange, placeholder, opcional, tipo = 'text', id }) => (
    <div className={`relative h-[58px] rounded-[20px] ${T.interna} px-[18px] flex flex-col justify-center`}>
        {valor && (
            <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[.06em] text-black/40 dark:text-white/40 pointer-events-none">
                {etiqueta}
            </label>
        )}
        {opcional && !valor && (
            <span className="absolute right-[18px] top-1/2 -translate-y-1/2 text-[12.5px] font-semibold text-black/35 dark:text-white/35">
                opcional
            </span>
        )}
        <input
            id={id}
            type={tipo}
            value={valor}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder || etiqueta}
            // campo-desnudo, no un style inline: el bloque de #gcx-accion en
            // index.html pinta los inputs con !important y una declaración
            // inline normal pierde contra eso — el campo salía blanco adentro
            // de su propia píldora gris.
            className="campo-desnudo w-full text-[15.5px] font-medium placeholder:text-black/35 dark:placeholder:text-white/35"
        />
    </div>
);

// ── 1c · Confirmación de acción seria ───────────────────────────────────
// Hoja inferior con el nombre propio de lo que va a pasar. El rojo va
// únicamente en `consecuencia`, embebida en la frase — nunca de fondo.
export const HojaConfirmacion: React.FC<{
    abierta: boolean;
    titulo: string;
    antes?: string;
    consecuencia: string;
    despues?: string;
    textoConfirmar: string;
    onConfirmar: () => void;
    onCancelar: () => void;
    cargando?: boolean;
    /**
     * 'riesgo' (default) pinta la consecuencia en rojo: la acción es
     * irreversible. 'neutro' la deja en negro — se usa cuando lo que se
     * confirma es un pedido que alguien más tiene que aceptar, como la
     * derivación: destacar sí, alarmar no.
     */
    tono?: 'riesgo' | 'neutro';
    children?: React.ReactNode;   // tarjeta de contexto (persona, grupo…)
}> = ({ abierta, titulo, antes, consecuencia, despues, textoConfirmar, onConfirmar, onCancelar, cargando, tono = 'riesgo', children }) => {
    useBloqueoDeFondo(abierta);

    if (!abierta) return null;
    return (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/38" onClick={cargando ? undefined : onCancelar} />
            <div
                role="dialog"
                aria-modal="true"
                className={`${T.fuente} relative w-full sm:max-w-[420px] bg-white dark:bg-[#1b1b1a] rounded-t-[30px] sm:rounded-[30px] px-[22px] pt-3.5 pb-[26px] animate-slideIn`}
            >
                <p className="text-[21px] leading-[1.3] font-semibold tracking-[-.01em]">{titulo}</p>
                <p className="mt-3 text-[14.5px] leading-[1.6] font-medium text-black/55 dark:text-white/55">
                    {antes}<span className={`font-semibold ${tono === 'riesgo' ? T.riesgo : 'text-[#0a0a0a] dark:text-white'}`}>{consecuencia}</span>{despues}
                </p>
                {children && <div className="mt-[18px]">{children}</div>}
                <button type="button" onClick={onConfirmar} disabled={cargando} className={`${btnPrimario} mt-5`}>
                    {cargando ? 'Un momento…' : textoConfirmar}
                </button>
                <button type="button" onClick={onCancelar} disabled={cargando} className={`${btnSecundario} w-full mt-2.5`}>
                    Cancelar
                </button>
            </div>
        </div>
    );
};

// ── 1d · Estado vacío ───────────────────────────────────────────────────
// Un solo molde para las seis. Sin ilustraciones inventadas ni copy alegre.
export const Vacio: React.FC<{
    titulo: string;
    detalle: string;
    accion?: { texto: string; onClick: () => void };
}> = ({ titulo, detalle, accion }) => (
    <div className="flex flex-col items-center text-center px-8 pt-[52px] pb-14">
        <div
            className="w-[104px] h-[104px] rounded-full"
            style={{ background: 'repeating-linear-gradient(135deg,#e6e4e0 0 8px,#dedbd6 8px 16px)' }}
            aria-hidden="true"
        />
        <p className="mt-[26px] text-[19px] font-semibold tracking-[-.01em]">{titulo}</p>
        <p className="mt-2.5 max-w-[260px] text-[14.5px] leading-[1.6] font-medium text-black/50 dark:text-white/50">
            {detalle}
        </p>
        {accion && (
            <button type="button" onClick={accion.onClick} className={`${btnSecundario} mt-[26px] w-auto`}>
                {accion.texto}
            </button>
        )}
    </div>
);

// Fila de lista: el renglón tocable con chevron que usan los dos grupos de
// acciones del detalle y varias pantallas.
export const FilaAccion: React.FC<{
    texto: string;
    onClick: () => void;
    tenue?: boolean;          // registro de ADMINISTRACIÓN: sin fondo, apagado
    insignia?: React.ReactNode;
}> = ({ texto, onClick, tenue, insignia }) => (
    <button
        type="button"
        onClick={onClick}
        className={`w-full flex items-center gap-3 text-left transition-colors ${tenue
            ? 'h-[52px] hover:opacity-70'
            : 'h-[58px] px-[18px] hover:bg-black/[.03] dark:hover:bg-white/[.04]'}`}
    >
        <span className={`flex-1 truncate ${tenue
            ? 'text-[15px] font-medium text-black/55 dark:text-white/55'
            : 'text-[15px] font-semibold'}`}>
            {texto}
        </span>
        {insignia}
        <svg width={tenue ? 15 : 16} height={tenue ? 15 : 16} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            className={tenue ? 'text-black/25 dark:text-white/25' : 'text-black/30 dark:text-white/30'} aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
        </svg>
    </button>
);

export const Separador: React.FC = () => (
    <div className="h-px bg-black/[.06] dark:bg-white/[.08] mx-[18px]" aria-hidden="true" />
);
