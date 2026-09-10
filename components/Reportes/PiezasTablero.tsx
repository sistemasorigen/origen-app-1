// ════════════════════════════════════════════════════════════════════════
// Piezas compartidas de los tableros de Reportes GCX.
//
// Salieron de pages/reportes/ReportesGCX.tsx cuando apareció la segunda
// pantalla (/reportes/gcx/comp-temp). Los tokens y los gráficos viven acá
// para que las dos pantallas dibujen exactamente lo mismo: si el azul o el
// alto de fila divergen, dos tableros de los mismos datos dejan de ser
// comparables a ojo.
//
// Esta familia visual NO es la neo-brutalist del resto de la app. Es el
// tablero de analítica claro que define design-claude/Reportes GCX.dc.html
// — blanco sobre #f7f8fa, borde de un pixel, azul #2563eb.
// ════════════════════════════════════════════════════════════════════════
import React from 'react';
import {
    ResponsiveContainer, PieChart, Pie, Cell,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { TemporadaGCX } from '../../types';

// ── Tokens del diseño ───────────────────────────────────────────────────
export const C = {
    fondo: '#f7f8fa',
    tarjeta: '#ffffff',
    borde: '#e8e9ec',
    bordeSuave: '#eef0f3',
    tinta: '#0f172a',
    medio: '#374151',
    apagado: '#6b7280',
    tenue: '#9ca3af',
    azul: '#2563eb',
    azulClaro: '#c9d4ea',
    rosa: '#ec4899',
    rosaClaro: '#f9c6de',
    gris: '#dfe3e8',
    ambar: '#f3ddc4',
    // Tercera serie de los gráficos de género. Neutro a propósito: "No
    // especificar" no es un punto medio entre azul y rosa, es otra respuesta.
    neutro: '#9ca3af',
} as const;

export const FUENTE = "Manrope, system-ui, sans-serif";

export const NOMBRE_TEMPORADA: Record<TemporadaGCX, string> = { S1: '1', S2: '2', S3: '3' };
export const TEMPORADAS: TemporadaGCX[] = ['S1', 'S2', 'S3'];

export const EjeCategoria = { fontFamily: FUENTE, fontSize: 12.5, fill: C.medio } as const;

/** Alto de una fila de barras. Fijo, para que dos gráficos con las mismas
 *  categorías midan igual y se puedan comparar sin recalibrar la vista. */
export const ALTO_FILA_BARRA = 46;

/**
 * Rampa secuencial para las tortas que parten por grupo en vez de por sí/no.
 *
 * Es monocroma a propósito: la cantidad que representa está ORDENADA (de
 * quien más carga a quien menos), y siete colores distintos dirían que son
 * siete categorías sin relación entre sí. El gris del final no es un paso
 * más de la rampa, es "todo lo demás".
 */
export const RAMPA_AZUL = ['#1e3a8a', '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'] as const;
export const COLOR_RESTO = '#dfe3e8';

const ESTILO_TOOLTIP = {
    fontFamily: FUENTE,
    fontSize: 12.5,
    borderRadius: 10,
    border: `1px solid ${C.borde}`,
} as const;

// ── Piezas ──────────────────────────────────────────────────────────────

/** Acepta atributos de div (`data-grafico`, `id`…) porque la pantalla los
 *  usa para marcar qué tarjeta imprimir. */
export const Tarjeta: React.FC<{
    children: React.ReactNode;
    className?: string;
    destacada?: boolean;
} & React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', destacada, style, ...resto }) => (
    <div
        className={`bg-white rounded-[14px] ${className}`}
        style={{
            border: `1px solid ${C.borde}`,
            boxShadow: destacada ? `0 0 0 1px ${C.ambar} inset` : undefined,
            ...style,
        }}
        {...resto}
    >
        {children}
    </div>
);

export const TituloTarjeta: React.FC<{
    titulo: string;
    detalle: string;
    extra?: React.ReactNode;
    /** Botones de descarga. Van debajo de `extra` en la misma columna
     *  derecha: la leyenda explica el gráfico y esto se lo lleva. */
    descargas?: React.ReactNode;
}> = ({ titulo, detalle, extra, descargas }) => (
    <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
            <p className="m-0 text-[15px] font-semibold" style={{ color: C.tinta }}>{titulo}</p>
            <p className="mt-[5px] text-[12.5px] font-medium" style={{ color: C.tenue }}>{detalle}</p>
        </div>
        {(extra || descargas) && (
            <div className="flex flex-col items-end gap-2 shrink-0">
                {extra}
                {descargas}
            </div>
        )}
    </div>
);

/** Nota al pie de la tarjeta, con el número real. Nunca un banner. */
export const NotaCobertura: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p
        className="mt-5 pt-4 text-[12px] leading-[1.55] font-medium"
        style={{ borderTop: `1px solid ${C.bordeSuave}`, color: C.apagado }}
    >
        {children}
    </p>
);

/** Bloques grises con la forma del contenido real, no un spinner centrado. */
export const Esqueleto: React.FC<{ alto: number; ancho?: string; className?: string }> = ({ alto, ancho = '100%', className = '' }) => (
    <div
        className={`rounded-md animate-pulse ${className}`}
        style={{ height: alto, width: ancho, background: '#eceef1' }}
        aria-hidden="true"
    />
);

export const Kpi: React.FC<{
    titulo: string;
    detalle: string;
    valor: React.ReactNode;
    nota?: string;
    destacada?: boolean;
    children?: React.ReactNode;
}> = ({ titulo, detalle, valor, nota, destacada, children }) => (
    <Tarjeta className="px-5 py-[18px]" destacada={destacada}>
        <div className="flex items-start justify-between gap-2.5">
            <div>
                <p className="m-0 text-[13.5px] font-semibold" style={{ color: C.tinta }}>{titulo}</p>
                <p className="mt-1 text-[12px] font-medium" style={{ color: C.apagado }}>{detalle}</p>
            </div>
        </div>
        <p className="mt-[18px] m-0 text-[34px] font-semibold tracking-[-.03em]" style={{ color: C.tinta }}>{valor}</p>
        {children}
        {nota && <p className="mt-3 text-[12.5px] leading-[1.55] font-medium" style={{ color: C.apagado }}>{nota}</p>}
    </Tarjeta>
);

/** Torta con el número adentro, como la dibuja el diseño.
 *  `tamano` existe para la comparación, que pone tres al hilo en el ancho
 *  donde el tablero pone una sola. Los radios y el cuerpo tipográfico
 *  escalan con él para que la dona se lea igual de gruesa. */
export const Torta: React.FC<{
    datos: Array<{ nombre: string; valor: number; color: string }>;
    porcentaje: number;
    etiqueta: string;
    tamano?: number;
    /** Pisa el "NN%" del centro. Para tortas cuyo centro no es un porcentaje
     *  sino un total — 147 reuniones no es el 147% de nada. */
    centro?: React.ReactNode;
}> = ({ datos, porcentaje, etiqueta, tamano = 168, centro }) => {
    const escala = tamano / 168;
    return (
        <div className="relative shrink-0" style={{ width: tamano, height: tamano }}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={datos}
                        dataKey="valor"
                        nameKey="nombre"
                        innerRadius={58 * escala}
                        outerRadius={84 * escala}
                        startAngle={90}
                        endAngle={-270}
                        paddingAngle={0}
                        stroke="none"
                        isAnimationActive={false}
                    >
                        {datos.map(d => <Cell key={d.nombre} fill={d.color} />)}
                    </Pie>
                    <Tooltip
                        formatter={(v: number, n: string) => [`${v}`, n]}
                        contentStyle={ESTILO_TOOLTIP}
                    />
                </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span
                    className="font-semibold tracking-[-.03em]"
                    style={{ color: C.tinta, fontSize: Math.round(30 * escala) }}
                >
                    {centro ?? `${porcentaje}%`}
                </span>
                <span
                    className="mt-0.5 font-semibold"
                    style={{ color: C.tenue, fontSize: Math.max(10.5, 11.5 * escala) }}
                >
                    {etiqueta}
                </span>
            </div>
        </div>
    );
};

export const FilaLeyenda: React.FC<{ color?: string; nombre: string; valor: React.ReactNode; primera?: boolean }> = ({ color, nombre, valor, primera }) => (
    <div className={`flex items-center gap-2.5 ${primera ? '' : 'mt-3'}`}>
        {color && <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: color }} />}
        <span className="flex-1 text-[13px] font-semibold" style={{ color: C.medio }}>{nombre}</span>
        <span className="text-[13px] font-semibold" style={{ color: C.tinta }}>{valor}</span>
    </div>
);

/** Sin datos explica por qué está vacío y ofrece la salida. */
export const SinDatos: React.FC<{ titulo: string; detalle: string; accion?: { texto: string; onClick: () => void } }> = ({ titulo, detalle, accion }) => (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10">
        <p className="m-0 text-[14.5px] font-semibold" style={{ color: C.medio }}>{titulo}</p>
        <p className="mt-2 max-w-[280px] text-[12.5px] leading-[1.6] font-medium" style={{ color: C.apagado }}>{detalle}</p>
        {accion && (
            <button
                type="button"
                onClick={accion.onClick}
                className="mt-4 text-[12.5px] font-semibold hover:underline"
                style={{ color: C.azul }}
            >
                {accion.texto}
            </button>
        )}
    </div>
);

/**
 * Los cuadraditos del encabezado de las barras.
 *
 * "No especificar" es una respuesta de la persona y tiene su propia barra.
 * Lo que NO está acá es el sin dato — las inscripciones cargadas a mano, sin
 * cuenta detrás — que no se grafica y se cuenta en la nota al pie.
 */
export const LeyendaGenero: React.FC = () => (
    <div className="flex items-center gap-4 shrink-0">
        {([['Masculino', C.azul], ['Femenino', C.rosa], ['No especificar', C.neutro]] as const).map(([t, c]) => (
            <div key={t} className="flex items-center gap-[7px]">
                <span className="w-[9px] h-[9px] rounded-sm" style={{ background: c }} />
                <span className="text-[12px] font-semibold" style={{ color: '#4b5563' }}>{t}</span>
            </div>
        ))}
    </div>
);

export interface FilaBarraCategoria {
    categoria: string;
    Masculino: number;
    Femenino: number;
    NoEspecifica: number;
    /** Tamaño de muestra detrás del promedio, solo en el gráfico de edades. */
    nM?: number;
    nF?: number;
    nN?: number;
}

/**
 * Barras HORIZONTALES a propósito: los nombres de categoría van completos en
 * el eje Y, alineados a la derecha, sin rotarse ni cortarse. Con 11 o con 17
 * filas la tarjeta crece hacia abajo y se lee como un ranking.
 *
 * `dominioMax` fija el tope del eje X. Sin él Recharts autoescala cada
 * gráfico por separado, y al apilar una temporada debajo de otra dos barras
 * del mismo largo terminan representando cantidades distintas — la
 * comparación visual miente. El tablero de una sola temporada no lo pasa
 * (no hay con qué comparar); la pantalla de comparación sí.
 */
export const BarrasPorCategoria: React.FC<{
    datos: FilaBarraCategoria[];
    dominioMax?: number;
    anchoEtiquetas?: number;
    alto?: number;
    formatoTooltip?: (valor: number, nombre: string, props: any) => [string, string];
}> = ({ datos, dominioMax, anchoEtiquetas = 152, alto, formatoTooltip }) => (
    <div style={{ height: alto ?? Math.max(220, datos.length * ALTO_FILA_BARRA) }}>
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datos} layout="vertical" margin={{ left: 8, right: 28, top: 4, bottom: 4 }} barGap={3}>
                <CartesianGrid horizontal={false} stroke={C.bordeSuave} />
                <XAxis
                    type="number"
                    domain={dominioMax !== undefined ? [0, dominioMax] : undefined}
                    tick={{ ...EjeCategoria, fontSize: 11.5, fill: C.apagado }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                />
                <YAxis type="category" dataKey="categoria" width={anchoEtiquetas} tick={EjeCategoria} axisLine={false} tickLine={false} />
                <Tooltip
                    cursor={{ fill: 'rgba(37,99,235,.05)' }}
                    formatter={formatoTooltip}
                    contentStyle={ESTILO_TOOLTIP}
                />
                <Bar dataKey="Masculino" fill={C.azul} radius={[0, 3, 3, 0]} barSize={11} />
                <Bar dataKey="Femenino" fill={C.rosa} radius={[0, 3, 3, 0]} barSize={11} />
                {/* El `name` existe porque el dataKey tiene que ser un
                    identificador y "NoEspecifica" no es como se le dice a una
                    persona en un tooltip. */}
                <Bar dataKey="NoEspecifica" name="No especificar" fill={C.neutro} radius={[0, 3, 3, 0]} barSize={11} />
            </BarChart>
        </ResponsiveContainer>
    </div>
);
