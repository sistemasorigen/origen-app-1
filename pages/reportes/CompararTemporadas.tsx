// ════════════════════════════════════════════════════════════════════════
// /reportes/gcx/comp-temp — las 3 temporadas de un año, lado a lado.
//
// No hay .dc para esta pantalla. El lenguaje visual sale de
// design-claude/Reportes GCX.dc.html vía components/Reportes/PiezasTablero,
// que es el mismo que usa el tablero de una temporada. Misma familia, sin
// estilo nuevo.
//
// El problema de esta pantalla no es dibujar cuatro gráficos: es que se
// puedan comparar. Tres decisiones lo resuelven, y están anotadas donde
// pasan:
//   1. Escala compartida en las barras (dominioMax).
//   2. Orden de categorías compartido entre las tres temporadas.
//   3. Encabezado de temporada pegajoso mientras se recorre su gráfico.
// ════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { User, TemporadaGCX, ReportesGCXTemporada } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import {
    C, FUENTE, NOMBRE_TEMPORADA, TEMPORADAS, ALTO_FILA_BARRA,
    Tarjeta, TituloTarjeta, NotaCobertura, Esqueleto, Torta, FilaLeyenda,
    SinDatos, LeyendaGenero, BarrasPorCategoria, FilaBarraCategoria,
} from '../../components/Reportes/PiezasTablero';

type EstadoCarga = 'cargando' | 'ok' | 'error';
interface TemporadaCargada {
    estado: EstadoCarga;
    datos: ReportesGCXTemporada | null;
}

const CARGANDO: Record<TemporadaGCX, TemporadaCargada> = {
    S1: { estado: 'cargando', datos: null },
    S2: { estado: 'cargando', datos: null },
    S3: { estado: 'cargando', datos: null },
};

const promedio = (a: number[]) => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0;

/**
 * Toma las filas crudas de cada temporada y devuelve las tres series listas
 * para dibujarse una debajo de la otra.
 *
 * Hace dos cosas que no son cosméticas:
 *
 * - Unifica el eje de categorías. Las tres temporadas comparten la misma
 *   lista, en el mismo orden (por volumen total del año), rellenando con
 *   cero donde una temporada no tiene esa categoría. Sin esto la fila 3 del
 *   primer gráfico es "Finanzas" y la del segundo es "Matrimonios", y
 *   comparar exige leer las etiquetas una por una en vez de barrer con la
 *   vista en vertical.
 *
 * - Calcula el máximo del año, que después se le pasa a los tres gráficos
 *   como dominio fijo del eje X.
 */
const armarComparativo = (crudo: Record<TemporadaGCX, FilaBarraCategoria[]>) => {
    const peso = new Map<string, number>();
    TEMPORADAS.forEach(t => crudo[t].forEach(f => {
        peso.set(f.categoria, (peso.get(f.categoria) || 0) + f.Masculino + f.Femenino + f.NoEspecifica);
    }));

    const categorias = [...peso.entries()]
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([nombre]) => nombre);

    const datos = {} as Record<TemporadaGCX, FilaBarraCategoria[]>;
    let max = 0;
    TEMPORADAS.forEach(t => {
        const porNombre = new Map(crudo[t].map(f => [f.categoria, f]));
        datos[t] = categorias.map(c => porNombre.get(c) ?? { categoria: c, Masculino: 0, Femenino: 0, NoEspecifica: 0, nM: 0, nF: 0, nN: 0 });
        datos[t].forEach(f => { max = Math.max(max, f.Masculino, f.Femenino, f.NoEspecifica); });
    });

    return { categorias, datos, max: Math.max(1, max) };
};

// ── Piezas propias de la comparación ────────────────────────────────────

/** Rótulo de temporada. Se repite en cada columna y en cada bloque: es lo
 *  único que ubica al lector cuando ya scrolleó lejos del encabezado. */
const RotuloTemporada: React.FC<{ temporada: TemporadaGCX; detalle?: string }> = ({ temporada, detalle }) => (
    <div className="flex items-baseline gap-2.5">
        <span className="text-[13.5px] font-semibold" style={{ color: C.tinta }}>
            Temporada {NOMBRE_TEMPORADA[temporada]}
        </span>
        {detalle && <span className="text-[12px] font-medium" style={{ color: C.tenue }}>{detalle}</span>}
    </div>
);

/** Columna o bloque de una temporada que no se pudo dibujar. Borde punteado
 *  y el mismo alto que sus hermanas: se lee como una temporada sin datos, no
 *  como un hueco del layout. */
const BloqueVacio: React.FC<{ titulo: string; detalle: string; alto?: number }> = ({ titulo, detalle, alto }) => (
    <div
        className="rounded-[12px] flex flex-col items-center justify-center text-center px-5 py-8"
        style={{ border: `1px dashed ${C.gris}`, minHeight: alto }}
    >
        <p className="m-0 text-[13.5px] font-semibold" style={{ color: C.tenue }}>{titulo}</p>
        <p className="mt-1.5 max-w-[260px] text-[12px] leading-[1.55] font-medium" style={{ color: C.tenue }}>{detalle}</p>
    </div>
);

/**
 * Un indicador con las tres temporadas apiladas.
 *
 * No estaba en el pedido original. Es lo que responde "¿mejoramos o
 * empeoramos?" sin scrollear ni un pixel — los cuatro gráficos contestan
 * "¿en qué?", que es la pregunta siguiente.
 */
const KpiComparado: React.FC<{
    titulo: string;
    detalle: string;
    valores: Record<TemporadaGCX, number | null>;
}> = ({ titulo, detalle, valores }) => {
    const presentes = TEMPORADAS.map(t => valores[t]).filter((v): v is number => v !== null);
    const max = Math.max(1, ...presentes);

    return (
        <Tarjeta className="px-5 py-[18px]">
            <p className="m-0 text-[13.5px] font-semibold" style={{ color: C.tinta }}>{titulo}</p>
            <p className="mt-1 text-[12px] font-medium" style={{ color: C.apagado }}>{detalle}</p>

            <div className="mt-[18px] flex flex-col gap-3">
                {TEMPORADAS.map((t, i) => {
                    const v = valores[t];
                    // La diferencia se calcula contra la temporada anterior que sí
                    // trajo datos, no contra la anterior a secas: si S2 falló, S3
                    // se compara con S1 en vez de no compararse con nada.
                    const anterior = TEMPORADAS.slice(0, i).map(p => valores[p]).filter((x): x is number => x !== null).pop();
                    const delta = v !== null && anterior !== undefined ? v - anterior : null;

                    return (
                        <div key={t} className="flex items-center gap-3">
                            <span className="w-[22px] shrink-0 text-[12.5px] font-semibold" style={{ color: C.apagado }}>
                                S{NOMBRE_TEMPORADA[t]}
                            </span>
                            <div className="flex-1 min-w-0 h-[7px] rounded-full overflow-hidden" style={{ background: C.bordeSuave }}>
                                <div
                                    className="h-full rounded-full"
                                    style={{ width: v === null ? 0 : `${Math.round((v / max) * 100)}%`, background: C.azul }}
                                />
                            </div>
                            <span className="w-[42px] shrink-0 text-right text-[15px] font-semibold" style={{ color: v === null ? C.gris : C.tinta }}>
                                {v === null ? '—' : v}
                            </span>
                            {/* Sin verde ni rojo: en el mismo año S3 siempre cae
                                fuerte por calendario, y pintarlo de rojo lo leería
                                como un problema cuando es la forma normal del año. */}
                            <span className="w-[38px] shrink-0 text-right text-[12px] font-semibold" style={{ color: C.tenue }}>
                                {delta === null ? '' : delta === 0 ? '=' : delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
                            </span>
                        </div>
                    );
                })}
            </div>
        </Tarjeta>
    );
};

/** Una columna de torta. Se usa dos veces, con distinto par de valores. */
const ColumnaTorta: React.FC<{
    temporada: TemporadaGCX;
    estado: EstadoCarga;
    hayGrupos: boolean;
    parte: number;
    resto: number;
    etiqueta: string;
    nombreParte: string;
    nombreResto: string;
    pie: React.ReactNode;
}> = ({ temporada, estado, hayGrupos, parte, resto, etiqueta, nombreParte, nombreResto, pie }) => {
    const base = parte + resto;

    if (estado === 'error') {
        return <BloqueVacio alto={196} titulo={`Temporada ${NOMBRE_TEMPORADA[temporada]}`} detalle="No se pudieron traer los datos de esta temporada." />;
    }
    if (base === 0) {
        return (
            <BloqueVacio
                alto={196}
                titulo={`Temporada ${NOMBRE_TEMPORADA[temporada]}`}
                detalle={hayGrupos
                    ? 'Los grupos existen pero todavía no cargaron nada.'
                    : 'Sin grupos en esta temporada.'}
            />
        );
    }
    return (
        <div>
            <RotuloTemporada temporada={temporada} detalle={`${base} en la base`} />
            <div className="flex items-center gap-[18px] mt-3.5">
                <Torta
                    tamano={132}
                    datos={[
                        { nombre: nombreParte, valor: parte, color: C.azul },
                        { nombre: nombreResto, valor: resto, color: C.azulClaro },
                    ]}
                    porcentaje={Math.round((parte / base) * 100)}
                    etiqueta={etiqueta}
                />
                <div className="min-w-0 flex-1">
                    <FilaLeyenda primera color={C.azul} nombre={nombreParte} valor={parte} />
                    <FilaLeyenda color={C.azulClaro} nombre={nombreResto} valor={resto} />
                    <div className="h-px my-3.5" style={{ background: C.bordeSuave }} />
                    {pie}
                </div>
            </div>
        </div>
    );
};

/** Un bloque de barras de una temporada, con su rótulo pegajoso. */
const BloqueBarras: React.FC<{
    temporada: TemporadaGCX;
    estado: EstadoCarga;
    hayGrupos: boolean;
    anio: number;
    datos: FilaBarraCategoria[];
    max: number;
    detalle: string;
    formatoTooltip?: (valor: number, nombre: string, props: any) => [string, string];
    primero?: boolean;
}> = ({ temporada, estado, hayGrupos, anio, datos, max, detalle, formatoTooltip, primero }) => (
    <div className={primero ? '' : 'mt-6 pt-6'} style={primero ? undefined : { borderTop: `1px solid ${C.bordeSuave}` }}>
        {/* Pegajoso bajo la navbar de la app (h-16): cuando estás mirando la
            fila 9 del tercer gráfico, el rótulo sigue arriba diciendo cuál de
            las tres temporadas estás leyendo. */}
        <div className="sticky top-16 z-10 bg-white py-2">
            <RotuloTemporada temporada={temporada} detalle={detalle} />
        </div>
        {estado === 'error' ? (
            <BloqueVacio alto={140} titulo="No se pudo traer esta temporada" detalle="Las otras dos siguen siendo válidas." />
        ) : !hayGrupos ? (
            <BloqueVacio alto={140} titulo="Todavía no arrancó" detalle={`La temporada ${NOMBRE_TEMPORADA[temporada]} de ${anio} no tiene grupos.`} />
        ) : datos.every(f => f.Masculino === 0 && f.Femenino === 0 && f.NoEspecifica === 0) ? (
            <BloqueVacio alto={140} titulo="Sin datos para este gráfico" detalle="Los grupos de la temporada no tienen inscripciones con estos datos cargados." />
        ) : (
            // Todas las temporadas dibujan el mismo alto porque comparten
            // categorías: las tres tarjetas miden igual y las filas se alinean.
            <BarrasPorCategoria
                datos={datos}
                dominioMax={max}
                alto={Math.max(200, datos.length * ALTO_FILA_BARRA)}
                formatoTooltip={formatoTooltip}
            />
        )}
    </div>
);

// ── Pantalla ────────────────────────────────────────────────────────────

const CompararTemporadas: React.FC<{ currentUser: User }> = () => {
    const navigate = useNavigate();
    const [params] = useSearchParams();

    const anioDeLaUrl = Number(params.get('anio'));
    const [anio, setAnio] = useState(
        Number.isInteger(anioDeLaUrl) && anioDeLaUrl > 2000 ? anioDeLaUrl : new Date().getFullYear()
    );
    const [porTemporada, setPorTemporada] = useState<Record<TemporadaGCX, TemporadaCargada>>(CARGANDO);

    // Cambiar de año rápido dispara varias tandas de tres consultas. El token
    // descarta las respuestas de la tanda vieja en vez de dejar que pisen a
    // las de la nueva.
    const tanda = useRef(0);

    const cargar = useCallback(async () => {
        const mia = ++tanda.current;
        setPorTemporada(CARGANDO);

        // En paralelo, y allSettled: una temporada que falla no se lleva
        // puestas a las otras dos. Son ~5 consultas por temporada y la caché
        // del servicio es por clave temporada-año, así que acá no ayuda:
        // igual conviene que los tres viajes se solapen en vez de encadenarse.
        const resultados = await Promise.allSettled(
            TEMPORADAS.map(t => supabaseService.getReportesGCX(t, anio))
        );
        if (mia !== tanda.current) return;

        const siguiente = {} as Record<TemporadaGCX, TemporadaCargada>;
        TEMPORADAS.forEach((t, i) => {
            const r = resultados[i];
            siguiente[t] = r.status === 'fulfilled' && r.value
                ? { estado: 'ok', datos: r.value }
                : { estado: 'error', datos: null };
        });
        setPorTemporada(siguiente);
    }, [anio]);

    useEffect(() => { cargar(); }, [cargar]);

    const cargando = TEMPORADAS.some(t => porTemporada[t].estado === 'cargando');
    const fallaronTodas = !cargando && TEMPORADAS.every(t => porTemporada[t].estado === 'error');
    const anioVacio = !cargando && !fallaronTodas &&
        TEMPORADAS.every(t => (porTemporada[t].datos?.kpis.totalGrupos ?? 0) === 0);

    const tieneGrupos = (t: TemporadaGCX) => (porTemporada[t].datos?.kpis.totalGrupos ?? 0) > 0;

    const valorKpi = (leer: (d: ReportesGCXTemporada) => number): Record<TemporadaGCX, number | null> => {
        const r = {} as Record<TemporadaGCX, number | null>;
        TEMPORADAS.forEach(t => { const d = porTemporada[t].datos; r[t] = d ? leer(d) : null; });
        return r;
    };

    // ── Series de barras, ya unificadas y con el máximo del año ─────────
    const genero = useMemo(() => {
        const crudo = {} as Record<TemporadaGCX, FilaBarraCategoria[]>;
        TEMPORADAS.forEach(t => {
            crudo[t] = (porTemporada[t].datos?.generoPorCategoria || []).map(f => ({
                categoria: f.categoriaNombre,
                Masculino: f.masculino,
                Femenino: f.femenino,
                NoEspecifica: f.noEspecifica,
            }));
        });
        return armarComparativo(crudo);
    }, [porTemporada]);

    const edad = useMemo(() => {
        const crudo = {} as Record<TemporadaGCX, FilaBarraCategoria[]>;
        TEMPORADAS.forEach(t => {
            crudo[t] = (porTemporada[t].datos?.edadesPorCategoria || [])
                .filter(f => f.masculino.length > 0 || f.femenino.length > 0 || f.noEspecifica.length > 0)
                .map(f => ({
                    categoria: f.categoriaNombre,
                    Masculino: promedio(f.masculino),
                    Femenino: promedio(f.femenino),
                    NoEspecifica: promedio(f.noEspecifica),
                    nM: f.masculino.length,
                    nF: f.femenino.length,
                    nN: f.noEspecifica.length,
                }));
        });
        return armarComparativo(crudo);
    }, [porTemporada]);

    // ── Render ──────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen" style={{ background: C.fondo, fontFamily: FUENTE, color: C.tinta }}>

            {/* ── Encabezado ── */}
            <div className="bg-white px-7 py-5" style={{ borderBottom: `1px solid ${C.borde}` }}>
                <div className="max-w-[1440px] mx-auto flex items-center gap-7 flex-wrap">
                    <div className="min-w-0 flex-1">
                        <button
                            type="button"
                            onClick={() => navigate(`/reportes/gcx`)}
                            className="flex items-center gap-1.5 text-[12.5px] font-semibold hover:underline"
                            style={{ color: C.azul }}
                        >
                            <ArrowLeft className="w-[13px] h-[13px]" strokeWidth={2.4} />
                            Volver al tablero
                        </button>
                        <h1 className="mt-2 m-0 text-[19px] font-semibold tracking-[-.01em]" style={{ color: C.tinta }}>
                            Comparar temporadas
                        </h1>
                        <p className="mt-[5px] text-[13px] font-medium" style={{ color: C.apagado }}>
                            Las tres temporadas de {anio}, con la misma escala en todos los gráficos.
                        </p>
                    </div>

                    {/* Año. La temporada no se elige acá: se muestran las tres. */}
                    <div className="flex items-center gap-2.5">
                        <span className="text-[12.5px] font-medium" style={{ color: C.apagado }}>Año</span>
                        <div className="flex items-center gap-1 rounded-[10px] p-1" style={{ background: '#f4f5f7', border: `1px solid ${C.borde}` }}>
                            <button
                                type="button"
                                onClick={() => setAnio(a => a - 1)}
                                aria-label="Año anterior"
                                className="w-8 h-8 rounded-[7px] bg-white flex items-center justify-center transition-colors hover:bg-slate-50"
                                style={{ border: `1px solid ${C.borde}` }}
                            >
                                <ChevronLeft className="w-[15px] h-[15px]" style={{ color: C.medio }} strokeWidth={2.2} />
                            </button>
                            <span className="min-w-[66px] text-center text-[15px] font-semibold" style={{ color: C.tinta }}>{anio}</span>
                            <button
                                type="button"
                                onClick={() => setAnio(a => a + 1)}
                                aria-label="Año siguiente"
                                className="w-8 h-8 rounded-[7px] bg-white flex items-center justify-center transition-colors hover:bg-slate-50"
                                style={{ border: `1px solid ${C.borde}` }}
                            >
                                <ChevronRight className="w-[15px] h-[15px]" style={{ color: C.medio }} strokeWidth={2.2} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-[1440px] mx-auto px-7 py-6">

                {fallaronTodas ? (
                    <Tarjeta className="px-6 py-8 text-center">
                        <p className="m-0 text-[14.5px] font-semibold" style={{ color: C.medio }}>No se pudo traer ninguna temporada</p>
                        <p className="mt-2 text-[12.5px] font-medium" style={{ color: C.apagado }}>
                            Revisá la conexión y volvé a intentar.
                        </p>
                        <button
                            type="button"
                            onClick={cargar}
                            className="mt-4 h-9 px-4 rounded-[9px] text-[12.5px] font-semibold text-white"
                            style={{ background: C.azul }}
                        >
                            Reintentar
                        </button>
                    </Tarjeta>
                ) : anioVacio ? (
                    <Tarjeta className="px-6 py-14 text-center">
                        <p className="m-0 text-[15px] font-semibold" style={{ color: C.medio }}>
                            {anio} no tiene grupos en ninguna temporada
                        </p>
                        <p className="mt-2.5 mx-auto max-w-[420px] text-[12.5px] leading-[1.6] font-medium" style={{ color: C.apagado }}>
                            No hay nada que comparar todavía. Probá con otro año desde el selector del encabezado.
                        </p>
                        <button
                            type="button"
                            onClick={() => setAnio(a => a - 1)}
                            className="mt-4 text-[12.5px] font-semibold hover:underline"
                            style={{ color: C.azul }}
                        >
                            Ver {anio - 1}
                        </button>
                    </Tarjeta>
                ) : (
                    <>
                        {/* ── Indicadores comparados ── */}
                        <div className="flex items-end justify-between gap-5 mb-3.5">
                            <div>
                                <p className="m-0 text-[11.5px] font-semibold tracking-[.06em]" style={{ color: C.apagado }}>
                                    EL AÑO DE UN VISTAZO
                                </p>
                                <p className="mt-1.5 text-[12.5px] font-medium" style={{ color: C.apagado }}>
                                    {cargando
                                        ? 'Trayendo las tres temporadas a la vez.'
                                        : 'La diferencia de cada temporada es contra la anterior del mismo año.'}
                                </p>
                            </div>
                        </div>

                        {cargando ? (
                            <div className="grid grid-cols-3 gap-4">
                                {[0, 1, 2].map(i => (
                                    <Tarjeta key={i} className="px-5 py-[18px]">
                                        <Esqueleto alto={14} ancho="46%" />
                                        <div className="mt-2"><Esqueleto alto={11} ancho="68%" /></div>
                                        <div className="mt-[22px] flex flex-col gap-3">
                                            {[0, 1, 2].map(j => <Esqueleto key={j} alto={12} />)}
                                        </div>
                                    </Tarjeta>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-4">
                                <KpiComparado
                                    titulo="Grupos"
                                    detalle="Activos en cada temporada."
                                    valores={valorKpi(d => d.kpis.totalGrupos)}
                                />
                                <KpiComparado
                                    titulo="Personas únicas"
                                    detalle="Gente distinta alcanzada."
                                    valores={valorKpi(d => d.kpis.personasUnicas)}
                                />
                                <KpiComparado
                                    titulo="Inscripciones"
                                    detalle="Una persona puede estar en varios grupos."
                                    valores={valorKpi(d => d.kpis.inscripcionesTotales)}
                                />
                            </div>
                        )}

                        {/* ── Torta 1 · Asistencia ── */}
                        <Tarjeta className="px-[22px] py-5 mt-4">
                            <TituloTarjeta
                                titulo="Asistencia de personas"
                                detalle="Qué parte de los inscriptos está asistiendo, temporada por temporada."
                            />
                            {cargando ? (
                                <div className="grid grid-cols-3 gap-6 mt-[22px]">
                                    {[0, 1, 2].map(i => <Esqueleto key={i} alto={168} />)}
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-3 gap-6 mt-[22px]">
                                        {TEMPORADAS.map(t => {
                                            const a = porTemporada[t].datos?.asistenciaPersonas;
                                            const r = porTemporada[t].datos?.gruposQueReportan;
                                            return (
                                                <ColumnaTorta
                                                    key={t}
                                                    temporada={t}
                                                    estado={porTemporada[t].estado}
                                                    hayGrupos={tieneGrupos(t)}
                                                    parte={a?.asistieron ?? 0}
                                                    resto={a?.nuncaAsistieron ?? 0}
                                                    etiqueta="asiste"
                                                    nombreParte="Asiste"
                                                    nombreResto="No asiste"
                                                    pie={
                                                        <div className="flex items-center gap-2.5">
                                                            <span className="flex-1 text-[12px] font-medium" style={{ color: C.apagado }}>
                                                                Fuera del cálculo
                                                            </span>
                                                            <span className="text-[12px] font-semibold" style={{ color: C.medio }}>
                                                                {a?.sinDatos ?? 0} en {r?.noReportan ?? 0} grupos
                                                            </span>
                                                        </div>
                                                    }
                                                />
                                            );
                                        })}
                                    </div>
                                    {/* El sinDatos se muestra, no se esconde: es casi la mitad
                                        del padrón y sin él los tres porcentajes se leerían como
                                        si cubrieran a todos los inscriptos. */}
                                    <NotaCobertura>
                                        Cada porcentaje se calcula solo sobre las personas de los grupos que cargaron
                                        asistencia. Las que están en grupos que no reportan quedan fuera del cálculo y
                                        se cuentan aparte, debajo de cada torta.
                                    </NotaCobertura>
                                </>
                            )}
                        </Tarjeta>

                        {/* ── Torta 2 · Grupos que reportan ── */}
                        <Tarjeta className="px-[22px] py-5 mt-4">
                            <TituloTarjeta
                                titulo="Reporte de asistencia"
                                detalle="Cantidad de Grupos que reportan asistencias."
                            />
                            {cargando ? (
                                <div className="grid grid-cols-3 gap-6 mt-[22px]">
                                    {[0, 1, 2].map(i => <Esqueleto key={i} alto={168} />)}
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-3 gap-6 mt-[22px]">
                                        {TEMPORADAS.map(t => {
                                            const r = porTemporada[t].datos?.gruposQueReportan;
                                            return (
                                                <ColumnaTorta
                                                    key={t}
                                                    temporada={t}
                                                    estado={porTemporada[t].estado}
                                                    hayGrupos={tieneGrupos(t)}
                                                    parte={r?.reportan ?? 0}
                                                    resto={r?.noReportan ?? 0}
                                                    etiqueta="reporta"
                                                    nombreParte="Reporta"
                                                    nombreResto="No reporta"
                                                    pie={
                                                        <div className="flex items-center gap-2.5">
                                                            <span className="flex-1 text-[12px] font-medium" style={{ color: C.apagado }}>
                                                                Grupos activos
                                                            </span>
                                                            <span className="text-[12px] font-semibold" style={{ color: C.medio }}>
                                                                {r?.total ?? 0}
                                                            </span>
                                                        </div>
                                                    }
                                                />
                                            );
                                        })}
                                    </div>
                                    <NotaCobertura>
                                        Un grupo cuenta como que reporta si cargó al menos una reunión. Con pocos grupos
                                        el porcentaje se mueve mucho por un solo grupo: mirá también el número absoluto.
                                    </NotaCobertura>
                                </>
                            )}
                        </Tarjeta>

                        {/* ── Barras 1 · Género ── */}
                        <Tarjeta className="px-[22px] py-5 mt-4">
                            <TituloTarjeta
                                titulo="Género por categoría"
                                detalle={cargando
                                    ? 'Cargando las tres temporadas…'
                                    : `Las tres temporadas comparten escala (0 a ${genero.max}) y orden de categorías.`}
                                extra={<LeyendaGenero />}
                            />
                            {cargando ? (
                                <div className="mt-[22px]"><Esqueleto alto={340} /></div>
                            ) : genero.categorias.length === 0 ? (
                                <div className="mt-[22px] flex" style={{ height: 200 }}>
                                    <SinDatos titulo="Sin inscripciones en el año" detalle="No hay a quién clasificar en ninguna de las tres temporadas." />
                                </div>
                            ) : (
                                <>
                                    <div className="mt-3">
                                        {TEMPORADAS.map((t, i) => (
                                            <BloqueBarras
                                                key={t}
                                                primero={i === 0}
                                                temporada={t}
                                                estado={porTemporada[t].estado}
                                                hayGrupos={tieneGrupos(t)}
                                                anio={anio}
                                                datos={genero.datos[t]}
                                                max={genero.max}
                                                detalle={`${porTemporada[t].datos?.kpis.personasUnicas ?? 0} personas · ${porTemporada[t].datos?.kpis.totalGrupos ?? 0} grupos`}
                                            />
                                        ))}
                                    </div>
                                    <NotaCobertura>
                                        Las categorías van en el mismo orden en los tres gráficos, con las que no
                                        existen en una temporada dibujadas en cero. Cada persona cuenta una vez por
                                        categoría. Las personas cargadas a mano por su anfitrión no tienen género
                                        registrado y no entran en el gráfico.
                                    </NotaCobertura>
                                </>
                            )}
                        </Tarjeta>

                        {/* ── Barras 2 · Edades ── */}
                        <Tarjeta className="px-[22px] py-5 mt-4">
                            <TituloTarjeta
                                titulo="Edades por categoría"
                                detalle={cargando
                                    ? 'Cargando las tres temporadas…'
                                    : `Edad promedio de hombres y mujeres. Escala común de 0 a ${edad.max} años.`}
                                extra={<LeyendaGenero />}
                            />
                            {cargando ? (
                                <div className="mt-[22px]"><Esqueleto alto={340} /></div>
                            ) : edad.categorias.length === 0 ? (
                                <div className="mt-[22px] flex" style={{ height: 200 }}>
                                    <SinDatos titulo="Sin edades cargadas" detalle="Ninguna inscripción del año tiene fecha de nacimiento ni edad registrada." />
                                </div>
                            ) : (
                                <>
                                    <div className="mt-3">
                                        {TEMPORADAS.map((t, i) => (
                                            <BloqueBarras
                                                key={t}
                                                primero={i === 0}
                                                temporada={t}
                                                estado={porTemporada[t].estado}
                                                hayGrupos={tieneGrupos(t)}
                                                anio={anio}
                                                datos={edad.datos[t]}
                                                max={edad.max}
                                                detalle={`${edad.datos[t].reduce((a, f) => a + (f.nM ?? 0) + (f.nF ?? 0) + (f.nN ?? 0), 0)} personas con edad conocida`}
                                                formatoTooltip={(v, n, p) => {
                                                    const muestra = n === 'Masculino' ? p.payload.nM
                                                        : n === 'Femenino' ? p.payload.nF
                                                            : p.payload.nN;
                                                    return [`${v} años · ${muestra} ${muestra === 1 ? 'persona' : 'personas'}`, n];
                                                }}
                                            />
                                        ))}
                                    </div>
                                    <NotaCobertura>
                                        Es un promedio: una categoría con dos personas y otra con cuarenta se dibujan
                                        igual de largas. El tooltip trae el tamaño de la muestra detrás de cada barra.
                                        Rango 10 a 100 años, el mismo que usa el tablero por defecto.
                                    </NotaCobertura>
                                </>
                            )}
                        </Tarjeta>
                    </>
                )}
            </div>
        </div>
    );
};

export default CompararTemporadas;
