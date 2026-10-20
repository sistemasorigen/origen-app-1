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
// Dos piezas son propias porque la librería no las tiene: el medidor de
// anillo y el gráfico por minuto. Las dos están abajo, comentadas.
// ════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import {
    ResponsiveContainer, BarChart, Bar, Brush, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip,
} from 'recharts';
import { AlertCircle, ChevronLeft } from 'lucide-react';
import {
    C, FUENTE, Tarjeta, TituloTarjeta, NotaCobertura, Esqueleto, Kpi, Torta, FilaLeyenda,
} from '../../../components/Reportes/PiezasTablero';
import {
    getBaseNocturna, kpis, tortaAsistencia, porcentajeAsistencia, porMinuto,
    horaDelMinuto, horaCorta, AZUL_SERIE, AMBAR_SERIE,
    BaseNocturna, PuntoPorMinuto,
} from '../../../services/reportesNocturna';
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
    const esMovil = useEsMovil();

    const [base, setBase] = useState<BaseNocturna | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(false);

    const pedir = useCallback(async () => {
        setCargando(true);
        setError(false);
        const datos = await getBaseNocturna();
        if (!datos) { setError(true); setCargando(false); return; }
        setBase(datos);
        setCargando(false);
    }, []);

    useEffect(() => { void pedir(); }, [pedir]);

    const k = useMemo(() => (base ? kpis(base) : null), [base]);
    const tramos = useMemo(() => (base ? tortaAsistencia(base) : []), [base]);
    const serie = useMemo(() => (base ? porMinuto(base) : null), [base]);
    const pct = useMemo(() => (base ? porcentajeAsistencia(base) : 0), [base]);

    const actualizado = horaCorta(base?.ultimoDato ?? null);
    const hayMarcas = !!k && (k.acreditados > 0 || k.marcadosAusentes > 0);

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
                    ) : error || !k || !serie ? (
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
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportesNocturna;
