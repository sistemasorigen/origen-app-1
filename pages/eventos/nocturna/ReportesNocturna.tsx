// ════════════════════════════════════════════════════════════════════════
// /panel-eventos/nocturna/reportes — tablero de Nocturna.
//
// La estética es la de los reportes de todas las áreas, la que define
// components/Reportes/PiezasTablero.tsx: Manrope, fondo #f7f8fa, tarjetas
// blancas de borde fino, azul #2563eb. No es la familia de la planilla de
// Nocturna (AdminNocturna), y es a propósito: quien mira reportes compara
// áreas entre sí, y dos tableros con dos estéticas no se comparan a ojo.
//
// Los números salen SIEMPRE de services/reportesNocturna.ts. Esta pantalla
// no cuenta nada: pide la base una vez y dibuja.
//
// Las piezas que la librería no tiene están abajo, numeradas y comentadas:
// el medidor de anillo, el gráfico por minuto, las barras de conteo, las
// tablas y la fila de una tanda de entradas.
// ════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import {
    ResponsiveContainer, BarChart, Bar, Brush, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip,
} from 'recharts';
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import {
    C, FUENTE, Tarjeta, TituloTarjeta, NotaCobertura, Esqueleto, Kpi, Torta, FilaLeyenda,
} from '../../../components/Reportes/PiezasTablero';
import {
    getBaseNocturna, kpis, entradasVendidas, pesos, tortaAsistencia, porcentajeAsistencia, porMinuto,
    quienRetira, inscripcionesMultiples, asistenciaEnMultiples, listasDeRetiro,
    horarios, ordenarHorarios, horaDelMinuto, horaCorta, horaExacta,
    AZUL_SERIE, AMBAR_SERIE, GRIS_SERIE,
    BaseNocturna, PuntoPorMinuto, FilaDePrecio, FilaDeRetiro, FilaDeHorario, OrdenDeHorarios,
    getCodigosNocturna, FilaDeCodigo, ReporteDeCodigos,
} from '../../../services/reportesNocturna';
import { haciaLaFicha, SeccionDeReportes } from './compartido/volver';
import { User } from '../../../types';

interface Props {
    currentUser: User;
}

/**
 * Hace falta de verdad, no alcanza con `hidden md:block`: el eje del gráfico
 * por minuto lleva una marca cada 30 minutos en la compu y una cada hora en
 * el teléfono, y montar los dos deja un recharts midiendo un contenedor de
 * ancho cero. Las mismas cinco líneas que usa ReportesPuntoInfo.
 */
const useEsMovil = () => {
    const consulta = '(max-width: 767px)';
    const [es, setEs] = useState(() => typeof window !== 'undefined' && window.matchMedia(consulta).matches);
    useEffect(() => {
        const mq = window.matchMedia(consulta);
        const cambiar = () => setEs(mq.matches);
        mq.addEventListener('change', cambiar);
        return () => mq.removeEventListener('change', cambiar);
    }, []);
    return es;
};

const plural = (n: number, singular: string, plural_: string) => (n === 1 ? singular : plural_);

// ── Rótulo de sección ───────────────────────────────────────────────────

const RotuloDeSeccion: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h2
        className="m-0 mb-3 text-[12px] font-bold uppercase"
        style={{ color: C.tenue, letterSpacing: '.09em' }}
    >
        {children}
    </h2>
);

// ── Pieza propia 1: el medidor de anillo ────────────────────────────────

/**
 * "¿Cuántos vinieron?": un anillo con el porcentaje adentro.
 *
 * No es la `Torta` de la librería con otro texto al medio. La torta reparte un
 * total entre tramos y cada tramo tiene su tooltip; esto mide UNA cosa contra
 * su techo y no hay nada que mostrar al pasar el dedo. Por eso es un SVG a
 * mano y no un recharts: dos elementos, la pista y el arco.
 *
 * El arco se desliza hasta su valor con una transición sobre el recorte del
 * trazo. Durante la noche el número sube: que el anillo se mueva es la forma
 * de ver que entró gente desde la última vez que se miró. Con "reducir
 * movimiento" pedido, aparece ya puesto.
 */
const Medidor: React.FC<{
    porcentaje: number;
    acreditados: number;
    inscriptos: number;
}> = ({ porcentaje, acreditados, inscriptos }) => {
    const sinMovimiento = useReducedMotion();
    const GROSOR = 16;
    const RADIO = 74;
    const VUELTA = 2 * Math.PI * RADIO;
    const recorte = VUELTA * (1 - Math.max(0, Math.min(100, porcentaje)) / 100);

    return (
        <div className="flex flex-col items-center">
            <div className="relative" style={{ width: 180, height: 180 }}>
                <svg
                    viewBox="0 0 180 180"
                    width="100%"
                    height="100%"
                    role="img"
                    aria-label={`${porcentaje}% de los adolescentes inscriptos se acreditó: ${acreditados} de ${inscriptos}`}
                >
                    <circle cx="90" cy="90" r={RADIO} fill="none" stroke="#edeff2" strokeWidth={GROSOR} />
                    <circle
                        cx="90" cy="90" r={RADIO}
                        fill="none"
                        stroke={AZUL_SERIE}
                        strokeWidth={GROSOR}
                        strokeLinecap="round"
                        strokeDasharray={VUELTA}
                        strokeDashoffset={recorte}
                        // Arranca arriba y gira como un reloj: el anillo se
                        // lee como el avance de la noche.
                        transform="rotate(-90 90 90)"
                        style={{ transition: sinMovimiento ? 'none' : 'stroke-dashoffset .7s cubic-bezier(.22,.85,.32,1)' }}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span
                        className="text-[44px] font-semibold tabular-nums leading-none"
                        style={{ color: C.tinta, letterSpacing: '-.04em' }}
                    >
                        {porcentaje}%
                    </span>
                </div>
            </div>
            <p className="mt-4 m-0 text-[13.5px] font-semibold" style={{ color: C.medio }}>
                {acreditados} de {inscriptos} {plural(inscriptos, 'adolescente', 'adolescentes')}
            </p>
        </div>
    );
};

// ── Pieza propia 2: el gráfico por minuto ───────────────────────────────

interface FilaDelGrafico {
    minuto: number;
    acreditaron: number;
    /** Negativo a propósito: es lo que dibuja la mitad de abajo. */
    retiraronAbajo: number;
    retiraron: number;
}

/**
 * El globo del gráfico. Dice el minuto exacto y las dos cantidades.
 *
 * Lleva los dos puntos de color porque el gráfico no tiene leyenda aparte:
 * acá es donde se aprende cuál mitad es cuál.
 */
const GloboDelMinuto: React.FC<{ active?: boolean; payload?: Array<{ payload: FilaDelGrafico }> }> = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const f = payload[0].payload;
    return (
        <div
            className="px-3 py-2.5 rounded-[10px] bg-white"
            style={{ border: `1px solid ${C.borde}`, fontFamily: FUENTE, boxShadow: '0 4px 14px rgba(15,23,42,.08)' }}
        >
            <p className="m-0 text-[12.5px] font-bold tabular-nums" style={{ color: C.tinta }}>
                {horaDelMinuto(f.minuto)}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
                <span className="w-[8px] h-[8px] rounded-full" style={{ background: AZUL_SERIE }} />
                <span className="text-[12px] font-semibold" style={{ color: C.medio }}>
                    {f.acreditaron} {plural(f.acreditaron, 'acreditó', 'acreditaron')}
                </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
                <span className="w-[8px] h-[8px] rounded-full" style={{ background: AMBAR_SERIE }} />
                <span className="text-[12px] font-semibold" style={{ color: C.medio }}>
                    {f.retiraron} {plural(f.retiraron, 'retiró', 'retiraron')}
                </span>
            </div>
        </div>
    );
};

/**
 * "Ingresos y retiros por minuto", de 22:00 a 07:00.
 *
 * Las dos series son espejadas sobre la línea del cero: las acreditaciones
 * crecen hacia arriba y los retiros hacia abajo. No es un adorno. Son los dos
 * sentidos del mismo movimiento —la noche se llena y después se vacía— y, al
 * no compartir el espacio, no hay dos barras peleando por el mismo pixel: en
 * 540 minutos sobre la pantalla de un teléfono, dos series del mismo lado se
 * tapan entre sí y hay que adivinar cuál está delante.
 *
 * El eje vertical es simétrico a propósito. Si cada mitad se escalara sola,
 * tres retiros se verían del mismo tamaño que quince ingresos.
 */
const PorMinuto: React.FC<{ puntos: PuntoPorMinuto[]; esMovil: boolean; hayMarcas: boolean }> = ({ puntos, esMovil, hayMarcas }) => {
    const datos: FilaDelGrafico[] = useMemo(
        () => puntos.map(p => ({
            minuto: p.minuto,
            acreditaron: p.acreditaron,
            retiraronAbajo: -p.retiraron,
            retiraron: p.retiraron,
        })),
        [puntos],
    );

    /**
     * El techo de las dos mitades y sus marcas.
     *
     * Dejado a recharts, un eje de −3 a 3 sale "3 · 1 · 1 · 3": el cero no
     * aparece —que es justo la línea que separa los que entran de los que se
     * van— y el 1 figura dos veces sin decir de qué lado está. Acá el paso se
     * elige a mano para que haya dos marcas por mitad y el cero en el medio.
     *
     * El 1 de piso evita un eje de 0 a 0 antes del evento, que recharts
     * dibuja sin ninguna marca.
     */
    const { limite, marcasY } = useMemo(() => {
        const techo = Math.max(1, ...puntos.map(p => Math.max(p.acreditaron, p.retiraron)));
        const paso = Math.max(1, Math.ceil(techo / 2));
        return { limite: paso * 2, marcasY: [-paso * 2, -paso, 0, paso, paso * 2] };
    }, [puntos]);

    // Una marca cada 30 minutos; en el teléfono, cada dos horas. Dieciocho
    // rótulos de cinco caracteres en 270 px de ancho se pisan entre sí, y en
    // la foto del teléfono salían pegados uno al otro.
    const marcas = useMemo(() => {
        const cada = esMovil ? 120 : 30;
        const lista: number[] = [];
        for (let m = 0; m < puntos.length; m += cada) lista.push(m);
        return lista;
    }, [puntos.length, esMovil]);

    const ejes = { fontFamily: FUENTE, fontSize: 11, fill: C.apagado } as const;

    return (
        <div className="relative">
            <div style={{ height: esMovil ? 272 : 330 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={datos} margin={{ top: 6, right: 6, left: 0, bottom: 0 }} barCategoryGap={0}>
                        <CartesianGrid vertical={false} stroke={C.bordeSuave} />
                        <XAxis
                            dataKey="minuto"
                            ticks={marcas}
                            tickFormatter={(m: number) => horaDelMinuto(m)}
                            interval={0}
                            tick={ejes}
                            axisLine={false}
                            tickLine={false}
                            minTickGap={0}
                        />
                        <YAxis
                            domain={[-limite, limite]}
                            ticks={marcasY}
                            // La mitad de abajo guarda los retiros en
                            // negativo; el eje muestra cuántos son, no el signo.
                            tickFormatter={(v: number) => String(Math.abs(v))}
                            allowDecimals={false}
                            width={30}
                            tick={ejes}
                            axisLine={false}
                            tickLine={false}
                        />
                        <ReferenceLine y={0} stroke={C.gris} />
                        <Tooltip
                            content={<GloboDelMinuto />}
                            cursor={{ fill: 'rgba(37,99,235,.06)' }}
                        />
                        {/* El mismo stackId pone las dos en la misma columna:
                            con una positiva y otra negativa, recharts las
                            manda para lados opuestos del cero. */}
                        <Bar dataKey="acreditaron" stackId="noche" fill={AZUL_SERIE} isAnimationActive={false} />
                        <Bar dataKey="retiraronAbajo" stackId="noche" fill={AMBAR_SERIE} isAnimationActive={false} />
                        <Brush
                            dataKey="minuto"
                            height={30}
                            // Anchos para un dedo, no para un mouse.
                            travellerWidth={16}
                            tickFormatter={(m: number) => horaDelMinuto(m)}
                            stroke={C.azulClaro}
                            fill="#f3f5f8"
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Antes del evento el gráfico es correcto y está vacío: sin este
                texto parece que no cargó. */}
            {!hayMarcas && (
                <div className="absolute inset-x-0 top-[38%] flex justify-center px-6 pointer-events-none">
                    <p
                        className="m-0 max-w-[300px] text-center text-[13px] leading-[1.6] font-semibold"
                        style={{ color: C.apagado }}
                    >
                        Todavía no acreditó nadie. El gráfico se dibuja solo durante la noche del evento.
                    </p>
                </div>
            )}
        </div>
    );
};

// ── Pieza propia 3: barras de conteo ────────────────────────────────────

/**
 * Tres o cuatro categorías con su barra y su número.
 *
 * No es recharts y es a propósito: para tres barras horizontales, un gráfico
 * entero trae un contenedor que mide, un eje que autoescala y, en el
 * teléfono, un ancho que puede salir en cero. Dos divs con un ancho en
 * porcentaje dicen lo mismo, se leen igual de bien a 360 px y no pueden
 * fallar. El largo es contra la categoría más grande, no contra el total:
 * lo que se compara es una categoría con la otra.
 */
const BarrasDeConteo: React.FC<{
    filas: Array<{ etiqueta: string; valor: number; color: string }>;
}> = ({ filas }) => {
    const techo = Math.max(1, ...filas.map(f => f.valor));
    return (
        <div className="mt-[18px]">
            {filas.map((f, i) => (
                <div key={f.etiqueta} className={i ? 'mt-4' : ''}>
                    <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[13px] font-semibold truncate" style={{ color: C.medio }}>{f.etiqueta}</span>
                        <span className="shrink-0 text-[13.5px] font-semibold tabular-nums" style={{ color: C.tinta }}>{f.valor}</span>
                    </div>
                    <div className="mt-[7px] h-[9px] rounded-full overflow-hidden" style={{ background: '#eef0f3' }}>
                        <div
                            className="h-full rounded-full"
                            style={{ width: `${(f.valor / techo) * 100}%`, background: f.color }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};

// ── Pieza propia 4: las tablas ──────────────────────────────────────────

/** Diez filas de ~52 px: el alto con el que las tres listas quedan parejas. */
const FILAS_VISIBLES = 10;
const ALTO_DE_FILA = 52;

const BOTON_VER = {
    background: '#fff',
    border: `1px solid ${C.borde}`,
    color: C.tinta,
} as const;

/** "06:12:45" o el motivo por el que no hay hora. */
const horaDeRetiro = (f: FilaDeRetiro) => horaExacta(f.retiradoAt) ?? 'Todavía no registrado';

/**
 * Una de las tres listas de retiro.
 *
 * Cada fila entera es el botón, como en la planilla de solicitudes: en una
 * tabla de tres columnas angostas, apuntarle a un botón de 34 px desde el
 * teléfono es peor que tocar la fila.
 */
const TablaDeRetiro: React.FC<{
    titulo: string;
    filas: FilaDeRetiro[];
    esMovil: boolean;
    onVer: (f: FilaDeRetiro) => void;
}> = ({ titulo, filas, esMovil, onVer }) => (
    // `h-full` para que las tres queden parejas en la compu aunque una tenga
    // tres filas y la de al lado una sola.
    <Tarjeta className="h-full flex flex-col overflow-hidden">
        <div className="px-5 pt-[18px] pb-3">
            <p className="m-0 text-[14.5px] font-semibold" style={{ color: C.tinta }}>
                {titulo}
                <span className="tabular-nums" style={{ color: C.tenue }}> · {filas.length}</span>
            </p>
        </div>

        {filas.length === 0 ? (
            <div className="mx-5 mb-[18px] px-4 py-8 rounded-xl text-center" style={{ background: C.fondo }}>
                <p className="m-0 text-[13px] font-semibold" style={{ color: C.apagado }}>Nadie en esta lista.</p>
            </div>
        ) : (
            <div
                className="overflow-y-auto"
                // En la compu las tres listas miden lo mismo y la larga se
                // desplaza sola; en el teléfono, apilada, no hace falta.
                style={esMovil ? undefined : { maxHeight: FILAS_VISIBLES * ALTO_DE_FILA }}
            >
                {filas.map(f => (esMovil ? (
                    <div
                        key={f.jovenId}
                        className="flex items-center gap-3 px-4 py-3"
                        style={{ borderTop: `1px solid ${C.bordeSuave}` }}
                    >
                        <div className="flex-1 min-w-0">
                            <p className="m-0 text-[14px] font-semibold truncate" style={{ color: C.tinta }}>{f.adolescente}</p>
                            <p className="mt-0.5 m-0 text-[12px] font-medium tabular-nums" style={{ color: C.apagado }}>
                                {horaDeRetiro(f)}
                            </p>
                            {f.responsable !== '-' && (
                                <p className="mt-0.5 m-0 text-[12.5px] font-medium truncate" style={{ color: C.medio }}>
                                    {f.responsable}
                                </p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => onVer(f)}
                            aria-label={`Ver los detalles de la inscripción de ${f.adolescente}`}
                            className="shrink-0 h-11 px-3.5 rounded-[10px] text-[13px] font-semibold"
                            style={BOTON_VER}
                        >
                            Ver detalles
                        </button>
                    </div>
                ) : (
                    <div
                        key={f.jovenId}
                        role="button"
                        tabIndex={0}
                        onClick={() => onVer(f)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onVer(f); }
                        }}
                        aria-label={`Ver los detalles de la inscripción de ${f.adolescente}`}
                        className="grid gap-2.5 items-center px-5 py-2.5 cursor-pointer hover:bg-slate-50"
                        style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 34px', borderTop: `1px solid ${C.bordeSuave}` }}
                    >
                        <div className="min-w-0">
                            <p className="m-0 text-[13.5px] font-semibold truncate" title={f.adolescente} style={{ color: C.tinta }}>
                                {f.adolescente}
                            </p>
                            <p className="mt-[3px] m-0 text-[11.5px] font-medium tabular-nums" style={{ color: C.apagado }}>
                                {horaDeRetiro(f)}
                            </p>
                        </div>
                        <p className="m-0 text-[13px] font-medium truncate" title={f.responsable} style={{ color: C.medio }}>
                            {f.responsable}
                        </p>
                        <span
                            aria-hidden="true"
                            className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center"
                            style={BOTON_VER}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </span>
                    </div>
                )))}
            </div>
        )}
    </Tarjeta>
);

const GRILLA_HORARIOS = 'minmax(0,1.2fr) minmax(0,1.2fr) 104px 104px 124px';
const POR_PAGINA = 8;

/** La celda de una hora: la hora, el motivo, o nada. */
const celdaDeHora = (iso: string | null, ausente: boolean) =>
    horaExacta(iso) ?? (ausente ? 'Ausente' : '—');

/** La línea del teléfono: lo que pasó con ese adolescente, en una frase. */
const lineaDeHorario = (f: FilaDeHorario): string => {
    if (f.ausente) return 'Ausente';
    if (!f.ingreso) return 'Sin registrar';
    const entro = `Ingresó ${horaExacta(f.ingreso)}`;
    return f.egreso ? `${entro} · Salió ${horaExacta(f.egreso)}` : `${entro} · Todavía adentro`;
};

const BotonDeOrden: React.FC<{ activo: boolean; onClick: () => void; children: React.ReactNode }> = ({ activo, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={activo}
        className="h-11 md:h-[36px] px-3.5 rounded-[9px] text-[13px] font-semibold whitespace-nowrap"
        style={activo
            ? { background: C.tinta, color: '#fff' }
            : { background: 'transparent', color: C.medio }}
    >
        {children}
    </button>
);

// ── Pieza propia 5: la fila de una tanda de entradas ────────────────────

/**
 * "$ 40.000 · 37 entradas · $ 1.480.000".
 *
 * Tres columnas y no la `FilaLeyenda` de la librería, que tiene dos: acá la
 * del medio es la cantidad y la de la derecha la plata, y poner las dos del
 * mismo lado deja "37 entradas · $ 1.480.000" apretado en el teléfono.
 *
 * Sin punto de color al lado del precio, a propósito: no hay ningún gráfico
 * al lado al que estas filas le estén poniendo nombre.
 */
const FilaDeVenta: React.FC<{ fila: FilaDePrecio; primera: boolean }> = ({ fila, primera }) => (
    <div
        className="flex items-baseline gap-3 py-[9px]"
        style={primera ? undefined : { borderTop: `1px solid ${C.bordeSuave}` }}
    >
        <span className="w-[86px] shrink-0 text-[13.5px] font-semibold tabular-nums" style={{ color: C.tinta }}>
            {pesos(fila.precio)}
        </span>
        <span className="flex-1 text-[13px] font-medium" style={{ color: C.apagado }}>
            {fila.entradas} {plural(fila.entradas, 'entrada', 'entradas')}
        </span>
        <span className="text-[13.5px] font-semibold tabular-nums" style={{ color: C.tinta }}>
            {pesos(fila.pesos)}
        </span>
    </div>
);

/**
 * Las columnas de la tarjeta de códigos. El código se lleva lo que sobra;
 * los números van a la derecha y en cifras parejas para compararlos de
 * arriba abajo. Entra en 390 px sin scroll de costado.
 */
const GRILLA_CODIGOS = 'minmax(0,1fr) 40px 44px minmax(74px,auto) minmax(70px,auto)';

const FilaDeCodigoDescuento: React.FC<{ fila: FilaDeCodigo; aparte?: boolean }> = ({ fila, aparte }) => (
    <div
        role="row"
        className="grid items-baseline gap-x-2.5 py-[9px] text-[13px] tabular-nums"
        style={{ gridTemplateColumns: GRILLA_CODIGOS, borderTop: `1px solid ${aparte ? C.borde : C.bordeSuave}` }}
    >
        <span role="cell" className="min-w-0">
            <span className="block truncate font-semibold" style={{ color: fila.codigo ? C.tinta : C.apagado }}>
                {fila.codigo ?? 'Sin código'}
            </span>
            {fila.precio != null && (
                <span className="block text-[11.5px] font-medium" style={{ color: C.apagado }}>
                    {pesos(fila.precio)} c/u{fila.activo ? '' : ' · apagado'}
                </span>
            )}
        </span>
        <span role="cell" className="text-right font-semibold" style={{ color: C.tinta }}>{fila.usos}</span>
        <span role="cell" className="text-right font-medium" style={{ color: C.apagado }}>{fila.adolescentes}</span>
        <span role="cell" className="text-right font-semibold" style={{ color: C.tinta }}>{pesos(fila.recaudado)}</span>
        <span role="cell" className="text-right font-medium" style={{ color: C.apagado }}>
            {fila.codigo ? pesos(fila.descontado) : '—'}
        </span>
    </div>
);

// ── Esqueletos ──────────────────────────────────────────────────────────

const EsqueletoDelTablero: React.FC = () => (
    <>
        <RotuloDeSeccion>Importantes</RotuloDeSeccion>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map(i => (
                <Tarjeta key={i} className="px-5 py-[18px]">
                    <Esqueleto alto={13} ancho="72%" />
                    <Esqueleto alto={11} ancho="52%" className="mt-2.5" />
                    <Esqueleto alto={34} ancho="44%" className="mt-[18px]" />
                </Tarjeta>
            ))}
        </div>
        <Tarjeta className="p-5 mt-3">
            <Esqueleto alto={15} ancho="34%" />
            <Esqueleto alto={12} ancho="58%" className="mt-2" />
            <Esqueleto alto={34} ancho="30%" className="mt-[22px]" />
        </Tarjeta>
        <div className="grid lg:grid-cols-2 gap-3 mt-3">
            {[0, 1].map(i => (
                <Tarjeta key={i} className="p-5">
                    <Esqueleto alto={15} ancho="58%" />
                    <Esqueleto alto={12} ancho="78%" className="mt-2" />
                    <div className="mt-6 flex justify-center">
                        <Esqueleto alto={180} ancho="180px" className="rounded-full" />
                    </div>
                </Tarjeta>
            ))}
        </div>
        <Tarjeta className="p-5 mt-3">
            <Esqueleto alto={15} ancho="46%" />
            <Esqueleto alto={12} ancho="66%" className="mt-2" />
            <Esqueleto alto={300} className="mt-6" />
        </Tarjeta>
    </>
);

// ── Pantalla ────────────────────────────────────────────────────────────

const ReportesNocturna: React.FC<Props> = ({ currentUser }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const esMovil = useEsMovil();

    const [base, setBase] = useState<BaseNocturna | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(false);
    /** null mientras carga o si falló: la tarjeta de códigos dice cuál, el resto del tablero sigue. */
    const [codigos, setCodigos] = useState<ReporteDeCodigos | null>(null);
    const [errorCodigos, setErrorCodigos] = useState(false);

    /**
     * El orden y la página de la tabla de horarios viven en la URL, no en un
     * useState: así la ficha de una inscripción puede devolver a quien la
     * abrió al mismo lugar de la tabla del que salió, y recargar la pantalla
     * no pierde nada. Se escriben con `replace` para no llenar el historial
     * con un paso por cada clic.
     */
    const q = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const orden: OrdenDeHorarios = q.get('orden') === 'egreso' ? 'egreso' : 'ingreso';
    const paginaPedida = Math.max(0, Math.floor(Number(q.get('pagina')) || 0));

    const cambiarUrl = useCallback((cambios: Record<string, string | null>) => {
        const siguiente = new URLSearchParams(location.search);
        for (const [clave, valor] of Object.entries(cambios)) {
            if (valor === null) siguiente.delete(clave);
            else siguiente.set(clave, valor);
        }
        const texto = siguiente.toString();
        navigate({ search: texto ? `?${texto}` : '' }, { replace: true });
    }, [location.search, navigate]);

    const seccionRetiros = useRef<HTMLDivElement | null>(null);
    const seccionHorarios = useRef<HTMLDivElement | null>(null);

    const pedir = useCallback(async () => {
        setCargando(true);
        setError(false);
        setErrorCodigos(false);
        const [datos, deCodigos] = await Promise.all([getBaseNocturna(), getCodigosNocturna()]);
        setCodigos(deCodigos);
        setErrorCodigos(!deCodigos);
        if (!datos) { setError(true); setCargando(false); return; }
        setBase(datos);
        setCargando(false);
    }, []);

    useEffect(() => { void pedir(); }, [pedir]);

    const k = useMemo(() => (base ? kpis(base) : null), [base]);
    const venta = useMemo(() => (base ? entradasVendidas(base) : null), [base]);
    const tramos = useMemo(() => (base ? tortaAsistencia(base) : []), [base]);
    const serie = useMemo(() => (base ? porMinuto(base) : null), [base]);
    const pct = useMemo(() => (base ? porcentajeAsistencia(base) : 0), [base]);

    const retiros = useMemo(() => (base ? quienRetira(base) : null), [base]);
    const multiples = useMemo(() => (base ? inscripcionesMultiples(base) : []), [base]);
    const enMultiples = useMemo(() => (base ? asistenciaEnMultiples(base) : null), [base]);
    const listas = useMemo(() => (base ? listasDeRetiro(base) : null), [base]);
    const filasDeHorario = useMemo(
        () => (base ? ordenarHorarios(horarios(base), orden) : []),
        [base, orden],
    );

    const paginas = Math.max(1, Math.ceil(filasDeHorario.length / POR_PAGINA));
    const pagina = Math.min(paginaPedida, paginas - 1);
    const visibles = filasDeHorario.slice(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA);

    const actualizado = horaCorta(base?.ultimoDato ?? null);
    const hayMarcas = !!k && (k.acreditados > 0 || k.marcadosAusentes > 0);

    /** Abre la ficha dejando escrito de dónde salió, para la vuelta. */
    const verLaFicha = useCallback((inscripcionId: string, seccion: SeccionDeReportes) => {
        navigate(haciaLaFicha(inscripcionId, { orden, pagina, seccion }));
    }, [navigate, orden, pagina]);

    /**
     * Volver de una ficha no tiene que dejar a nadie arriba de todo.
     *
     * La ficha devuelve con `?ver=` diciendo de qué sección salió; se baja
     * hasta ahí una sola vez y se limpia el parámetro, para que una recarga
     * posterior abra la pantalla donde empieza.
     */
    const volvio = q.get('ver');
    useEffect(() => {
        if (cargando || !volvio) return;
        const destino = volvio === 'retiros' ? seccionRetiros.current : seccionHorarios.current;
        if (destino) destino.scrollIntoView({ block: 'start', behavior: 'auto' });
        cambiarUrl({ ver: null });
    }, [cargando, volvio, cambiarUrl]);

    return (
        <div className="min-h-screen" style={{ background: C.fondo, fontFamily: FUENTE }}>
            <div className="mx-auto max-w-[1240px] px-4 pt-[18px] pb-10 md:px-10 md:pt-[30px] md:pb-14">

                {/* ── Encabezado ── */}
                <div className="min-w-0">
                    <button
                        type="button"
                        onClick={() => navigate('/panel-eventos/nocturna')}
                        className="inline-flex items-center gap-1.5 min-h-9 text-[13px] font-semibold"
                        style={{ color: C.medio }}
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Panel de Nocturna
                    </button>
                    <h1
                        className="mt-1.5 m-0 text-[23px] md:text-[28px] leading-[1.15] font-semibold tracking-[-.02em]"
                        style={{ color: C.tinta }}
                    >
                        Reportes · Nocturna {base?.edicion ?? 2026}
                    </h1>
                    <p className="mt-1.5 m-0 text-[13.5px] font-medium" style={{ color: C.apagado }}>
                        {cargando
                            ? 'Buscando los datos…'
                            : actualizado
                                ? `Actualizado ${actualizado}`
                                : 'Todavía no hay datos cargados'}
                    </p>
                </div>

                <div className="mt-6 md:mt-7">
                    {cargando ? (
                        <EsqueletoDelTablero />
                    ) : error || !k || !venta || !serie ? (
                        <Tarjeta className="px-6 py-11 flex flex-col items-center text-center">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#fdecea' }}>
                                <AlertCircle className="w-[22px] h-[22px]" style={{ color: '#b42318' }} />
                            </div>
                            <p className="mt-4 m-0 text-[16px] font-semibold" style={{ color: C.tinta }}>
                                No pudimos cargar los reportes
                            </p>
                            <p className="mt-2 m-0 max-w-[380px] text-[13px] leading-[1.6] font-medium" style={{ color: C.apagado }}>
                                Revisá tu conexión e intentá de nuevo. Las inscripciones de Nocturna no se tocaron.
                            </p>
                            <button
                                type="button"
                                onClick={() => void pedir()}
                                className="h-11 px-5 mt-[18px] rounded-[10px] text-sm font-semibold"
                                style={{ background: C.tinta, color: '#fff' }}
                            >
                                Reintentar
                            </button>
                        </Tarjeta>
                    ) : (
                        <>
                            <RotuloDeSeccion>Importantes</RotuloDeSeccion>

                            {/* Nivel 1 — los cuatro números. 2×2 en el teléfono. */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                <Kpi
                                    titulo="Adolescentes inscriptos"
                                    detalle="Anotados en la edición"
                                    valor={k.adolescentesInscriptos}
                                />
                                <Kpi
                                    titulo="Adolescentes acreditados"
                                    detalle="Entraron por la puerta"
                                    valor={k.acreditados}
                                />
                                <Kpi
                                    titulo="Adolescentes que no vinieron"
                                    detalle="Inscriptos que no entraron"
                                    valor={k.noVinieron}
                                    nota={`${k.marcadosAusentes} ${plural(k.marcadosAusentes, 'marcado', 'marcados')} como ${plural(k.marcadosAusentes, 'ausente', 'ausentes')} en la puerta`}
                                />
                                <Kpi
                                    titulo="Adultos responsables"
                                    detalle="Uno por inscripción"
                                    valor={k.adultosResponsables}
                                />
                            </div>

                            {/* Nivel 1 y medio — la plata. Va acá y no en
                                ESPECÍFICOS porque "cuánto se juntó" se mira
                                tanto como "cuántos se anotaron". */}
                            <Tarjeta className="p-5 mt-3">
                                <TituloTarjeta
                                    titulo="Entradas vendidas"
                                    detalle="Cuántas se vendieron a cada precio y cuánta plata es cada tanda"
                                />
                                <div className="mt-5 flex flex-col sm:flex-row sm:items-start gap-5 sm:gap-8">
                                    <div className="sm:w-[208px] shrink-0">
                                        <p className="m-0 text-[12.5px] font-medium" style={{ color: C.apagado }}>
                                            Total
                                        </p>
                                        <p
                                            className="mt-1.5 m-0 text-[34px] leading-none font-semibold tracking-[-.03em] tabular-nums"
                                            style={{ color: C.tinta }}
                                        >
                                            {pesos(venta.total)}
                                        </p>
                                        <p className="mt-2.5 m-0 text-[12.5px] leading-[1.5] font-medium" style={{ color: C.apagado }}>
                                            {venta.entradas} {plural(venta.entradas, 'entrada', 'entradas')} en{' '}
                                            {k.adultosResponsables} {plural(k.adultosResponsables, 'inscripción', 'inscripciones')}
                                        </p>
                                    </div>
                                    {/* Con tope de ancho: estirada a los 1100
                                        px de la tarjeta, entre "4 entradas" y
                                        su plata hay medio metro de blanco y
                                        hay que seguir la fila con el dedo. */}
                                    <div className="w-full sm:flex-1 sm:max-w-[460px]">
                                        {venta.filas.length === 0 ? (
                                            <p className="m-0 text-[13px] font-medium" style={{ color: C.apagado }}>
                                                Todavía no se vendió ninguna entrada.
                                            </p>
                                        ) : venta.filas.map((f, i) => (
                                            <FilaDeVenta key={f.precio} fila={f} primera={i === 0} />
                                        ))}
                                    </div>
                                </div>
                                <NotaCobertura>
                                    Es el precio con el que se cobró cada entrada, no el de hoy: la promo de los 12 años
                                    y los aumentos quedan en la foto de cada inscripción.
                                    {venta.heredadas > 0 && (
                                        ` ${venta.heredadas} ${plural(venta.heredadas, 'entrada se contó', 'entradas se contaron')} con el precio de su inscripción, que es lo que se le cobró a la familia al sumar un hermano.`
                                    )}
                                    {venta.sinComprobante > 0 && (
                                        ` ${venta.sinComprobante} ${plural(venta.sinComprobante, 'inscripción no tiene', 'inscripciones no tienen')} comprobante cargado.`
                                    )}
                                </NotaCobertura>
                            </Tarjeta>

                            {/* Los códigos de descuento: una fila por código,
                                aunque nadie lo haya usado, y "Sin código" abajo
                                para comparar. Lo cuenta la base. */}
                            <Tarjeta className="p-5 mt-3">
                                <TituloTarjeta
                                    titulo="Códigos de descuento"
                                    detalle="Cuántas inscripciones usaron cada código y cuánto se descontó"
                                />
                                {errorCodigos ? (
                                    <p className="mt-4 m-0 text-[13px] font-medium" style={{ color: C.apagado }}>
                                        No pudimos traer los códigos. Los demás números del tablero no dependen de esto.
                                    </p>
                                ) : !codigos ? (
                                    <Esqueleto alto={120} className="mt-4" />
                                ) : (
                                    <div role="table" aria-label="Uso de los códigos de descuento" className="mt-4 w-full sm:max-w-[620px]">
                                        <div
                                            role="row"
                                            className="grid gap-x-2.5 pb-2 text-[11.5px] font-semibold"
                                            style={{ gridTemplateColumns: GRILLA_CODIGOS, color: C.apagado }}
                                        >
                                            <span role="columnheader">Código</span>
                                            <span role="columnheader" className="text-right">Usos</span>
                                            <span role="columnheader" className="text-right" title="Adolescentes">Adol.</span>
                                            <span role="columnheader" className="text-right">Recaudado</span>
                                            <span role="columnheader" className="text-right">Descuento</span>
                                        </div>
                                        {codigos.codigos.map(f => <FilaDeCodigoDescuento key={f.codigo} fila={f} />)}
                                        <FilaDeCodigoDescuento fila={codigos.sinCodigo} aparte />
                                    </div>
                                )}
                                <NotaCobertura>
                                    Usos son inscripciones: el código vale para todos los adolescentes de cada una.
                                    Recaudado es lo que pagaron esas familias; el descuento, cuánto menos pagaron
                                    contra el precio sin código.
                                </NotaCobertura>
                            </Tarjeta>

                            {/* Nivel 2 — el reparto y el porcentaje. */}
                            <div className="grid lg:grid-cols-2 gap-3 mt-3">
                                <Tarjeta className="p-5 flex flex-col">
                                    <TituloTarjeta
                                        titulo="Inscriptos y acreditados"
                                        detalle="Cómo se reparten los inscriptos de la edición"
                                    />
                                    <div className="mt-5 flex flex-col sm:flex-row items-center sm:items-start gap-6 flex-1">
                                        {/* Al centro va el TOTAL, no el
                                            porcentaje: el porcentaje es lo
                                            que mide la tarjeta de al lado, y
                                            el mismo número dos veces, uno
                                            junto al otro, no agrega nada. */}
                                        <Torta
                                            datos={tramos}
                                            porcentaje={pct}
                                            centro={k.adolescentesInscriptos}
                                            etiqueta="inscriptos"
                                            separador
                                        />
                                        <div className="w-full sm:w-auto sm:flex-1 sm:pt-2">
                                            {tramos.map((t, i) => (
                                                <FilaLeyenda
                                                    key={t.nombre}
                                                    color={t.color}
                                                    nombre={t.nombre}
                                                    valor={t.valor}
                                                    primera={i === 0}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    {!hayMarcas && (
                                        <NotaCobertura>
                                            Todavía no acreditó nadie: los {k.adolescentesInscriptos} inscriptos están sin registrar.
                                        </NotaCobertura>
                                    )}
                                </Tarjeta>

                                <Tarjeta className="p-5 flex flex-col">
                                    <TituloTarjeta
                                        titulo="¿Cuántos vinieron?"
                                        detalle="Acreditados sobre el total de inscriptos"
                                    />
                                    <div className="flex-1 flex items-center justify-center py-6">
                                        <Medidor
                                            porcentaje={pct}
                                            acreditados={k.acreditados}
                                            inscriptos={k.adolescentesInscriptos}
                                        />
                                    </div>
                                </Tarjeta>
                            </div>

                            {/* Nivel 3 — la noche, minuto a minuto. */}
                            <Tarjeta className="p-5 mt-3">
                                <TituloTarjeta
                                    titulo="Ingresos y retiros por minuto"
                                    detalle="De 22:00 a 07:00, hora de Buenos Aires. Arriba los ingresos, abajo los retiros."
                                />
                                <div className="mt-5">
                                    <PorMinuto puntos={serie.puntos} esMovil={esMovil} hayMarcas={k.acreditados > 0} />
                                </div>
                                <NotaCobertura>
                                    Cada punto es un minuto. Arrastrá la barra de abajo para acercar un tramo.
                                    {serie.fuera > 0 && (
                                        ` ${serie.fuera} ${plural(serie.fuera, 'registro cayó', 'registros cayeron')} fuera de 22:00–07:00.`
                                    )}
                                </NotaCobertura>
                            </Tarjeta>

                            {/* ───────────────────── ESPECÍFICOS ───────────────────── */}
                            <div className="mt-9">
                                <RotuloDeSeccion>Específicos</RotuloDeSeccion>
                            </div>

                            <div className="grid lg:grid-cols-3 gap-3">
                                <Tarjeta className="p-5 flex flex-col">
                                    <TituloTarjeta
                                        titulo="¿Quién los retira?"
                                        detalle="Por inscripción, no por adolescente"
                                    />
                                    {retiros && (
                                        <>
                                            <div className="mt-5 flex flex-col sm:flex-row items-center sm:items-start gap-5 flex-1">
                                                <Torta
                                                    datos={[
                                                        { nombre: 'El adulto que inscribió', valor: retiros.conElAdulto, color: AZUL_SERIE },
                                                        { nombre: 'Otra persona', valor: retiros.conOtraPersona, color: AMBAR_SERIE },
                                                    ]}
                                                    porcentaje={0}
                                                    centro={retiros.enElGrafico}
                                                    etiqueta="inscripciones"
                                                    tamano={140}
                                                    separador
                                                />
                                                <div className="w-full sm:w-auto sm:flex-1 sm:pt-1">
                                                    <FilaLeyenda primera color={AZUL_SERIE} nombre="El adulto que inscribió" valor={retiros.conElAdulto} />
                                                    <FilaLeyenda color={AMBAR_SERIE} nombre="Otra persona" valor={retiros.conOtraPersona} />
                                                </div>
                                            </div>
                                            <NotaCobertura>
                                                {retiros.soloSeVanSolos > 0
                                                    ? `${retiros.soloSeVanSolos} ${plural(retiros.soloSeVanSolos, 'inscripción se retira sola', 'inscripciones se retiran solos')} y no ${plural(retiros.soloSeVanSolos, 'entra', 'entran')} en este gráfico.`
                                                    : 'Ninguna inscripción se retira sola: todas entran en este gráfico.'}
                                                {retiros.mixtas > 0 && (
                                                    ` ${retiros.mixtas} ${plural(retiros.mixtas, 'tiene hermanos', 'tienen hermanos')} de los dos tipos y ${plural(retiros.mixtas, 'está contada', 'están contadas')} de los dos lados.`
                                                )}
                                            </NotaCobertura>
                                        </>
                                    )}
                                </Tarjeta>

                                <Tarjeta className="p-5 flex flex-col">
                                    <TituloTarjeta
                                        titulo="Inscripciones con varios adolescentes"
                                        detalle="Cuántas anotaron a más de uno"
                                    />
                                    <div className="flex-1">
                                        <BarrasDeConteo
                                            filas={[
                                                { etiqueta: '2 adolescentes', valor: multiples[0]?.inscripciones ?? 0, color: '#1d4ed8' },
                                                { etiqueta: '3 adolescentes', valor: multiples[1]?.inscripciones ?? 0, color: AZUL_SERIE },
                                                { etiqueta: '4 o más', valor: multiples[2]?.inscripciones ?? 0, color: '#93c5fd' },
                                            ]}
                                        />
                                    </div>
                                    <NotaCobertura>
                                        El número es de inscripciones, no de adolescentes. Las de uno solo no están acá.
                                    </NotaCobertura>
                                </Tarjeta>

                                <Tarjeta className="p-5 flex flex-col">
                                    <TituloTarjeta
                                        titulo="¿Vinieron todos?"
                                        detalle="De las inscripciones con dos o más"
                                    />
                                    {enMultiples && (
                                        <>
                                            <div className="flex-1">
                                                <BarrasDeConteo
                                                    filas={[
                                                        { etiqueta: 'Vinieron todos', valor: enMultiples.todos, color: AZUL_SERIE },
                                                        { etiqueta: 'Vino al menos uno', valor: enMultiples.algunos, color: AMBAR_SERIE },
                                                        { etiqueta: 'No vino ninguno', valor: enMultiples.ninguno, color: GRIS_SERIE },
                                                    ]}
                                                />
                                            </div>
                                            <NotaCobertura>
                                                Sobre {enMultiples.inscripciones} {plural(enMultiples.inscripciones, 'inscripción', 'inscripciones')} con varios adolescentes.
                                            </NotaCobertura>
                                        </>
                                    )}
                                </Tarjeta>
                            </div>

                            {/* Las tres listas de retiro. */}
                            <div ref={seccionRetiros} className="grid lg:grid-cols-3 gap-3 mt-3 scroll-mt-4">
                                {listas && ([
                                    ['Retirado por el adulto inscripto', listas.adulto],
                                    ['Retirado por otro adulto responsable', listas.otraPersona],
                                    ['Se retira solo', listas.solo],
                                ] as const).map(([titulo, filas]) => (
                                    <TablaDeRetiro
                                        key={titulo}
                                        titulo={titulo}
                                        filas={filas}
                                        esMovil={esMovil}
                                        onVer={f => verLaFicha(f.inscripcionId, 'retiros')}
                                    />
                                ))}
                            </div>

                            {/* Horarios de ingreso y egreso. */}
                            <div ref={seccionHorarios} className="mt-3 scroll-mt-4">
                                <Tarjeta className="flex flex-col overflow-hidden">
                                    <div className="px-5 pt-[18px] pb-4 flex flex-wrap items-start justify-between gap-3">
                                        <TituloTarjeta
                                            titulo="Horarios de ingreso y egreso"
                                            detalle="Una fila por adolescente inscripto, en hora de Buenos Aires"
                                        />
                                        <div
                                            role="group"
                                            aria-label="Ordenar la tabla"
                                            className="flex items-center gap-1 p-1 rounded-[11px] shrink-0"
                                            style={{ background: C.fondo }}
                                        >
                                            <BotonDeOrden
                                                activo={orden === 'ingreso'}
                                                onClick={() => cambiarUrl({ orden: 'ingreso', pagina: null })}
                                            >
                                                Por ingreso
                                            </BotonDeOrden>
                                            <BotonDeOrden
                                                activo={orden === 'egreso'}
                                                onClick={() => cambiarUrl({ orden: 'egreso', pagina: null })}
                                            >
                                                Por egreso
                                            </BotonDeOrden>
                                        </div>
                                    </div>

                                    {filasDeHorario.length === 0 ? (
                                        <div className="mx-5 mb-[18px] px-5 py-[34px] rounded-xl text-center" style={{ background: C.fondo }}>
                                            <p className="m-0 text-[15px] font-semibold" style={{ color: C.medio }}>Todavía no hay adolescentes inscriptos</p>
                                            <p className="mt-1.5 m-0 text-[13px] leading-[1.55] font-medium" style={{ color: C.apagado }}>
                                                La tabla se llena con cada inscripción que entra.
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            {!esMovil && (
                                                <>
                                                    <div
                                                        className="grid gap-3 px-5 py-2.5"
                                                        style={{ gridTemplateColumns: GRILLA_HORARIOS, background: C.fondo, borderTop: `1px solid ${C.bordeSuave}`, borderBottom: `1px solid ${C.bordeSuave}` }}
                                                    >
                                                        {['Adulto responsable', 'Adolescente', 'Hora de ingreso', 'Hora de egreso', ''].map((t, i) => (
                                                            <span key={i} className="text-[11px] font-semibold tracking-[.04em] truncate" style={{ color: C.apagado }}>
                                                                {t}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    {visibles.map(f => (
                                                        <div
                                                            key={f.jovenId}
                                                            className="grid gap-3 items-center px-5 py-[11px]"
                                                            style={{ gridTemplateColumns: GRILLA_HORARIOS, borderBottom: `1px solid #f2f3f5` }}
                                                        >
                                                            <span className="text-[13px] font-medium truncate" title={f.adulto} style={{ color: C.medio }}>{f.adulto}</span>
                                                            <span className="text-[13.5px] font-semibold truncate" title={f.adolescente} style={{ color: C.tinta }}>{f.adolescente}</span>
                                                            <span className="text-[13px] font-medium tabular-nums" style={{ color: f.ingreso ? C.tinta : C.apagado }}>
                                                                {celdaDeHora(f.ingreso, f.ausente)}
                                                            </span>
                                                            {/* "Ausente" se dice una vez, en el ingreso: es ahí
                                                                donde se pregunta si vino. Repetirlo en el egreso
                                                                sugiere dos datos distintos. */}
                                                            <span className="text-[13px] font-medium tabular-nums" style={{ color: f.egreso ? C.tinta : C.apagado }}>
                                                                {celdaDeHora(f.egreso, false)}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => verLaFicha(f.inscripcionId, 'horarios')}
                                                                aria-label={`Ver los detalles de la inscripción de ${f.adolescente}`}
                                                                className="h-[34px] px-3 rounded-[9px] text-[12.5px] font-semibold"
                                                                style={BOTON_VER}
                                                            >
                                                                Ver detalles
                                                            </button>
                                                        </div>
                                                    ))}
                                                </>
                                            )}

                                            {esMovil && visibles.map(f => (
                                                <div
                                                    key={f.jovenId}
                                                    className="flex items-center gap-3 px-4 py-3"
                                                    style={{ borderTop: `1px solid ${C.bordeSuave}` }}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <p className="m-0 text-[14.5px] font-semibold truncate" style={{ color: C.tinta }}>{f.adolescente}</p>
                                                        <p className="mt-0.5 m-0 text-[12.5px] font-medium truncate" style={{ color: C.medio }}>{f.adulto}</p>
                                                        <p className="mt-1 m-0 text-[12px] font-medium tabular-nums" style={{ color: C.apagado }}>
                                                            {lineaDeHorario(f)}
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => verLaFicha(f.inscripcionId, 'horarios')}
                                                        aria-label={`Ver los detalles de la inscripción de ${f.adolescente}`}
                                                        className="shrink-0 h-11 px-3.5 rounded-[10px] text-[13px] font-semibold"
                                                        style={BOTON_VER}
                                                    >
                                                        Ver detalles
                                                    </button>
                                                </div>
                                            ))}

                                            <div
                                                className="flex items-center justify-between gap-2.5 pl-5 pr-4 py-2.5"
                                                style={{ borderTop: `1px solid ${C.bordeSuave}`, background: '#fcfcfd' }}
                                            >
                                                <span className="text-[12.5px] tabular-nums" style={{ color: C.apagado }}>
                                                    {pagina * POR_PAGINA + 1}–{pagina * POR_PAGINA + visibles.length} de {filasDeHorario.length}
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => cambiarUrl({ pagina: String(Math.max(0, pagina - 1)) })}
                                                        disabled={pagina === 0}
                                                        aria-label="Página anterior"
                                                        className="w-11 h-11 md:w-[38px] md:h-[38px] rounded-[10px] flex items-center justify-center disabled:opacity-40"
                                                        style={{ background: '#fff', border: `1px solid ${C.borde}`, color: C.medio }}
                                                    >
                                                        <ChevronLeft className="w-[15px] h-[15px]" />
                                                    </button>
                                                    {!esMovil && Array.from({ length: paginas }, (_, i) => (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            onClick={() => cambiarUrl({ pagina: String(i) })}
                                                            aria-label={`Página ${i + 1}`}
                                                            aria-current={i === pagina ? 'page' : undefined}
                                                            className="min-w-[38px] h-[38px] px-2 rounded-[10px] text-[13px] font-semibold tabular-nums"
                                                            style={i === pagina
                                                                ? { background: C.tinta, border: `1px solid ${C.tinta}`, color: '#fff' }
                                                                : { background: '#fff', border: `1px solid ${C.borde}`, color: C.medio }}
                                                        >
                                                            {i + 1}
                                                        </button>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={() => cambiarUrl({ pagina: String(Math.min(paginas - 1, pagina + 1)) })}
                                                        disabled={pagina >= paginas - 1}
                                                        aria-label="Página siguiente"
                                                        className="w-11 h-11 md:w-[38px] md:h-[38px] rounded-[10px] flex items-center justify-center disabled:opacity-40"
                                                        style={{ background: '#fff', border: `1px solid ${C.borde}`, color: C.medio }}
                                                    >
                                                        <ChevronRight className="w-[15px] h-[15px]" />
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </Tarjeta>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportesNocturna;
