// ════════════════════════════════════════════════════════════════════════
// /reportes/gcx — tablero de Grupos de Conexión.
//
// Implementa design-claude/Reportes GCX.dc.html. La jerarquía baja de lo
// general a lo particular en cuatro alturas: indicadores, tortas de
// participación, barras de composición y la tabla para bajar al grupo.
//
// Esta pantalla NO comparte estética con el resto de la app (neo-brutalist).
// El .dc define un tablero de analítica claro — blanco sobre #f7f8fa, borde
// de un pixel, azul #2563eb — y es la fuente de verdad de lo visual.
//
// Los números salen del servicio, nunca del .dc: la maqueta dibuja 17
// categorías y un 57% que no existen en la base.
//
// Los tokens y los gráficos (Torta, BarrasPorCategoria) viven en
// components/Reportes/PiezasTablero.tsx: los comparte con la pantalla de
// comparación entre temporadas, que tiene que dibujar exactamente lo mismo.
// ════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { ChevronLeft, ChevronRight, Search, ArrowLeftRight, ArrowRight, FileSpreadsheet, Printer } from 'lucide-react';
import { User, TemporadaGCX, ReportesGCXTemporada, ModalidadGrupo, ModoReunion, AsistenciaPersonasReporte, ResumenDemograficoReporte, TramosDeFrecuencia, ProgresoReportesGCX } from '../../types';
import { MODALIDADES, NOMBRE_MODALIDAD } from '../../src/utils/modalidad';
import { supabaseService } from '../../services/supabaseService';
import {
    C, FUENTE, NOMBRE_TEMPORADA, TEMPORADAS, EjeCategoria, RAMPA_AZUL, COLOR_RESTO,
    Tarjeta, TituloTarjeta, NotaCobertura, Esqueleto, Kpi, Torta, FilaLeyenda,
    SinDatos, LeyendaGenero, BarrasPorCategoria, PantallaCarga,
} from '../../components/Reportes/PiezasTablero';
import {
    ClaveGrafico, TITULO_GRAFICO, ORDEN_GRAFICOS, ContextoExport,
    hojasDe, descargarExcel, nombreArchivo,
    fechaCorta, fechaLarga,
} from './exportacion';

interface DiaDeCarga {
    fecha: string;
    etiqueta: string;
    Cargaron: number;
    NoCargaron: number;
    lista: Array<{ id: string; nombre: string; presentes: number; capacidad: number }>;
    faltantes: Array<{ id: string; nombre: string; capacidad: number }>;
}

/**
 * Tooltip del calendario de carga.
 *
 * Es propio y no el de Recharts porque la pregunta del gráfico no es cuántos
 * grupos cargaron ese día sino CUÁLES y CÓMO les fue: la barra da el número
 * y el tooltip tiene que dar cada grupo con sus asistentes sobre su cupo.
 *
 * La lista va COMPLETA, sin tope. Un "y 2 grupos más" deja justo afuera lo
 * que se vino a buscar, y la barra ya dijo cuántos son: si dice 10, tienen
 * que poder leerse los 10.
 *
 * No hay total de asistentes del día: sumar los presentes de diez grupos
 * distintos no se puede leer contra ningún cupo, así que el número no
 * significaría nada.
 */
const TooltipDia: React.FC<{ active?: boolean; payload?: Array<{ payload: DiaDeCarga }> }> = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;

    return (
        <div
            className="px-3 py-2.5 w-[300px]"
            style={{ background: '#fff', border: `1px solid ${C.borde}`, borderRadius: 10, fontFamily: FUENTE }}
        >
            <p className="m-0 text-[12.5px] font-semibold" style={{ color: C.tinta }}>{fechaLarga(d.fecha)}</p>
            <p className="mt-0.5 m-0 text-[12px] font-medium" style={{ color: C.apagado }}>
                {d.Cargaron} de {d.Cargaron + d.NoCargaron} {d.Cargaron + d.NoCargaron === 1 ? 'grupo' : 'grupos'} de ese día
            </p>

            <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${C.bordeSuave}` }}>
                <div className="flex items-baseline gap-3">
                    <span className="flex-1 min-w-0 text-[11px] font-semibold" style={{ color: C.azul }}>
                        Cargaron ({d.Cargaron})
                    </span>
                    {/* Sin este rótulo, "5/12" se lee como los inscriptos sobre
                        el cupo, que es lo que muestra la tabla de abajo. Acá el
                        numerador es otra cosa: quiénes fueron ese día. */}
                    <span className="shrink-0 text-[11px] font-semibold" style={{ color: C.tenue }}>asistieron / cupo</span>
                </div>

                {d.lista.map(g => (
                    <div key={g.id} className="flex items-baseline gap-3 mt-1">
                        <span className="flex-1 min-w-0 text-[12px] leading-[1.5] font-medium truncate" style={{ color: C.medio }}>
                            {g.nombre}
                        </span>
                        <span className="shrink-0 text-[12px] font-semibold tabular-nums" style={{ color: C.tinta }}>
                            {/* Un grupo sin cupo cargado no dibuja "5/0". */}
                            {g.capacidad > 0 ? `${g.presentes}/${g.capacidad}` : g.presentes}
                        </span>
                    </div>
                ))}
            </div>

            {d.faltantes.length > 0 && (
                <div className="mt-2.5 pt-2.5" style={{ borderTop: `1px solid ${C.bordeSuave}` }}>
                    <p className="m-0 mb-1 text-[11px] font-semibold" style={{ color: C.apagado }}>
                        No cargaron ({d.NoCargaron})
                    </p>
                    {d.faltantes.map(g => (
                        <p key={g.id} className="m-0 mt-1 text-[12px] leading-[1.5] font-medium truncate" style={{ color: C.tenue }}>
                            {g.nombre}
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
};

/**
 * Cuántos grupos se dibujan como porción propia antes de agrupar el resto.
 *
 * Una torta de 30 porciones no se lee: las últimas veinte son astillas del
 * mismo grosor y el gráfico deja de decir quién es quién. Con siete
 * nombrados y un "otros N" se responde la pregunta ("quiénes son") sin
 * mentir sobre el total, que sigue completo.
 */
const TOPE_PORCIONES = 7;

const armarPorciones = (filas: Array<{ nombre: string; valor: number }>) => {
    const conValor = filas.filter(f => f.valor > 0).sort((a, b) => b.valor - a.valor || a.nombre.localeCompare(b.nombre));
    const visibles = conValor.slice(0, TOPE_PORCIONES);
    const resto = conValor.slice(TOPE_PORCIONES);

    // Anotado a mano: RAMPA_AZUL es `as const`, así que sin esto el tipo de
    // `color` se infiere como la unión de sus siete literales y el gris del
    // "otros N" no entra.
    const datos: Array<{ nombre: string; valor: number; color: string }> =
        visibles.map((f, i) => ({ nombre: f.nombre, valor: f.valor, color: RAMPA_AZUL[i] }));
    if (resto.length > 0) {
        datos.push({
            nombre: `Otros ${resto.length} ${resto.length === 1 ? 'grupo' : 'grupos'}`,
            valor: resto.reduce((a, f) => a + f.valor, 0),
            color: COLOR_RESTO,
        });
    }

    return {
        datos,
        total: conValor.reduce((a, f) => a + f.valor, 0),
        conAporte: conValor.length,
        enResto: resto.length,
    };
};

/**
 * Los dos botones de descarga de cada tarjeta.
 *
 * Van con `no-print` porque de lo contrario aparecerían dentro del propio
 * PDF, ofreciendo descargar el papel que ya tenés en la mano.
 */
const BotonesDescarga: React.FC<{
    onExcel: () => void;
    onPdf: () => void;
    /** El de "todos juntos" es la acción principal de la pantalla y se ve. */
    destacado?: boolean;
}> = ({ onExcel, onPdf, destacado }) => {
    const clase = destacado
        ? 'h-9 px-3.5 rounded-[9px] flex items-center gap-2 text-[12.5px] font-semibold transition-colors'
        : 'h-8 px-2.5 rounded-[8px] flex items-center gap-1.5 text-[12px] font-semibold transition-colors hover:bg-slate-50';
    const estilo = destacado
        ? { background: '#fff', border: `1px solid ${C.borde}`, color: C.medio }
        : { color: C.apagado };

    return (
        <div className="no-print flex items-center gap-1.5 shrink-0">
            <button type="button" onClick={onExcel} className={clase} style={estilo} title="Descargar los datos en Excel">
                <FileSpreadsheet className="w-[14px] h-[14px]" strokeWidth={2.2} />
                Excel
            </button>
            <button type="button" onClick={onPdf} className={clase} style={estilo} title="Guardar como PDF desde el diálogo de impresión">
                <Printer className="w-[14px] h-[14px]" strokeWidth={2.2} />
                PDF
            </button>
        </div>
    );
};

interface DiaDelGrupo {
    fecha: string;
    etiqueta: string;
    /** 0 o 1. Dos series para que Recharts pinte cada día de un color. */
    Cargó: number;
    'No cargó': number;
    presentes: number;
    personas: number;
}

/**
 * Tooltip de la línea de tiempo de un grupo.
 *
 * La barra sólo dice si cargó o no; el dato de cuánta gente fue vive acá,
 * porque poner la altura en personas mezclaría dos unidades en un mismo eje.
 */
const TooltipDiaGrupo: React.FC<{ active?: boolean; payload?: Array<{ payload: DiaDelGrupo }> }> = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const cargo = d['Cargó'] === 1;

    return (
        <div
            className="px-3 py-2.5"
            style={{ background: '#fff', border: `1px solid ${C.borde}`, borderRadius: 10, fontFamily: FUENTE }}
        >
            <p className="m-0 text-[12.5px] font-semibold" style={{ color: C.tinta }}>{fechaLarga(d.fecha)}</p>
            <p className="mt-0.5 m-0 text-[12px] font-semibold" style={{ color: cargo ? C.azul : C.apagado }}>
                {cargo ? 'Cargó la asistencia' : 'No cargó la asistencia'}
            </p>
            {cargo && (
                <p className="mt-1.5 m-0 text-[12px] font-medium" style={{ color: C.medio }}>
                    {d.presentes} {d.presentes === 1 ? 'presente' : 'presentes'}
                    {d.personas > 0 && ` de ${d.personas} inscriptos`}
                </p>
            )}
        </div>
    );
};

const GRUPOS_POR_PAGINA = 7;

/**
 * Números de página a dibujar: 1 … 4 5 6 … 12.
 *
 * Hoy una temporada tiene ~30 grupos (5 páginas) y entran todos, pero la
 * ventana evita que un año grande, o una búsqueda vacía sobre muchos grupos,
 * dibuje una fila de números que no entra en la tarjeta.
 */
const paginasVisibles = (actual: number, total: number): Array<number | '…'> => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const cerca = [actual - 1, actual, actual + 1].filter(p => p > 1 && p < total);
    const salida: Array<number | '…'> = [1];
    if (cerca[0] > 2) salida.push('…');
    salida.push(...cerca);
    if (cerca[cerca.length - 1] < total - 1) salida.push('…');
    salida.push(total);
    return salida;
};

// ── Por modalidad ───────────────────────────────────────────────────────

const TEXTO_MODALIDAD: Record<ModalidadGrupo, { titulo: string; singular: string; plural: string }> = {
    presencial: { titulo: 'Presencial', singular: 'presencial', plural: 'presenciales' },
    online: { titulo: 'Online', singular: 'online', plural: 'online' },
    hibrido: { titulo: 'Híbrido', singular: 'híbrido', plural: 'híbridos' },
};

interface PropsModalidad {
    datos: ReportesGCXTemporada | null;
    cargando: boolean;
    temporada: TemporadaGCX;
    anio: number;
    onVerGrupo: (groupId: string) => void;
}

const TAMANO_TORTA = 148;

/**
 * Torta de dos porciones con su leyenda y la base del cálculo. La usan todas
 * las tarjetas de esta sección: cambia qué se cuenta, no cómo se dibuja.
 */
const TortaAsistencia: React.FC<{
    a: AsistenciaPersonasReporte;
    si: string;
    no: string;
    etiqueta: string;
    rotuloBase: string;
    valorBase: number;
    arriba?: string;
}> = ({ a, si, no, etiqueta, rotuloBase, valorBase, arriba = 'mt-[22px]' }) => {
    const base = a.asistieron + a.nuncaAsistieron;
    const pct = base > 0 ? Math.round((a.asistieron / base) * 100) : 0;
    return (
        <div className={`flex items-center gap-[22px] ${arriba} flex-1`}>
            <Torta
                tamano={TAMANO_TORTA}
                datos={[
                    { nombre: si, valor: a.asistieron, color: C.azul },
                    { nombre: no, valor: a.nuncaAsistieron, color: C.azulClaro },
                ]}
                porcentaje={pct}
                etiqueta={etiqueta}
            />
            <div className="min-w-0 flex-1">
                <FilaLeyenda primera color={C.azul} nombre={si} valor={a.asistieron} />
                <FilaLeyenda color={C.azulClaro} nombre={no} valor={a.nuncaAsistieron} />
                <div className="h-px my-3.5" style={{ background: C.bordeSuave }} />
                <div className="flex items-center gap-2.5">
                    <span className="flex-1 text-[12.5px] font-medium" style={{ color: C.apagado }}>{rotuloBase}</span>
                    <span className="text-[12.5px] font-semibold" style={{ color: C.medio }}>{valorBase}</span>
                </div>
            </div>
        </div>
    );
};

/**
 * Los tramos de frecuencia, del más constante al que nunca fue (o nunca
 * cargó). Los usan "Asistencia de personas" y "Reporte de asistencia".
 *
 * Escala secuencial de un solo tono (son tramos ordenados, no categorías
 * sueltas), validada con el script de dataviz: los vecinos se distinguen con
 * visión normal y con daltonismo. "Ninguna" es gris y no azul: es ausencia.
 * Los dos pasos claros tienen poco contraste contra el blanco, por eso la
 * leyenda lleva siempre cantidad y porcentaje escritos.
 */
const TRAMOS_FRECUENCIA: Array<{ clave: keyof TramosDeFrecuencia; nombre: string; color: string }> = [
    { clave: 'todas', nombre: 'A todas', color: '#172554' },
    { clave: 'seisOMas', nombre: '6 o más veces', color: '#1e40af' },
    { clave: 'cuatroACinco', nombre: '4 a 5 veces', color: '#3b82f6' },
    { clave: 'unaATres', nombre: '1 a 3 veces', color: '#8ab4f8' },
    { clave: 'ninguna', nombre: 'Ninguna', color: '#e5e7eb' },
];

/**
 * Torta de frecuencia. El centro sigue diciendo lo de siempre: qué parte fue
 * (o cargó) al menos una vez, que es todo menos "Ninguna".
 */
const TortaFrecuencia: React.FC<{
    frecuencia: TramosDeFrecuencia;
    total: number;
    /** "asiste" o "reporta": el rótulo bajo el porcentaje del centro. */
    etiqueta: string;
    /** "Personas" o "Grupos": el renglón del total. */
    rotuloTotal: string;
    tamano?: number;
    arriba?: string;
    /** Leyenda siempre debajo de la torta, aunque al lado entre. Las dos
     *  tortas de la primera fila la usan para leerse igual, una al lado de
     *  la otra. */
    apilada?: boolean;
}> = ({ frecuencia, total, etiqueta, rotuloTotal, tamano = 168, arriba = 'mt-[22px]', apilada }) => {
    const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;
    return (
        // flex-wrap: si al lado de la torta no entra la leyenda sin partir
        // renglones (tarjetas angostas, como la de Reporte de asistencia), la
        // leyenda baja y ocupa todo el ancho en vez de apretarse en 120px.
        // Apilada, el contenido va arriba (content-start) y no centrado: si no,
        // una nota más larga en una tarjeta que en la de al lado corre la torta
        // y las dos de la misma fila quedan a distinta altura.
        <div className={`flex flex-wrap items-center justify-center gap-x-6 gap-y-5 ${apilada ? 'content-start' : ''} ${arriba} flex-1`}>
            <Torta
                tamano={tamano}
                separador
                datos={TRAMOS_FRECUENCIA.map(t => ({ nombre: t.nombre, valor: frecuencia[t.clave], color: t.color }))}
                porcentaje={pct(total - frecuencia.ninguna)}
                etiqueta={etiqueta}
            />
            <div className={`min-w-[172px] flex-1 [&_span]:whitespace-nowrap ${apilada ? 'basis-full' : ''}`}>
                {TRAMOS_FRECUENCIA.map((t, i) => (
                    <FilaLeyenda
                        key={t.clave}
                        primera={i === 0}
                        color={t.color}
                        nombre={t.nombre}
                        valor={<>{frecuencia[t.clave]}<span className="font-medium" style={{ color: C.tenue }}> · {pct(frecuencia[t.clave])}%</span></>}
                    />
                ))}
                <div className="h-px my-3.5" style={{ background: C.bordeSuave }} />
                <div className="flex items-center gap-2.5">
                    <span className="flex-1 text-[12.5px] font-medium" style={{ color: C.apagado }}>{rotuloTotal}</span>
                    <span className="text-[12.5px] font-semibold" style={{ color: C.medio }}>{total}</span>
                </div>
            </div>
        </div>
    );
};

/** Una modalidad: sus gráficos, filtrados. */
const BloqueModalidad: React.FC<PropsModalidad & { modalidad: ModalidadGrupo }> = ({ modalidad, datos, cargando, temporada, anio, onVerGrupo }) => {
    const [elegido, setElegido] = useState('');

    const reporte = datos?.porModalidad[modalidad];
    const nombre = TEXTO_MODALIDAD[modalidad];

    // La lista sale de los ids que ya filtró el servicio: una sola definición
    // de qué grupo es de cada modalidad, la de ahí.
    const grupos = useMemo(() => (datos?.tablaGrupos || [])
        .filter(f => !!reporte?.asistenciaPorGrupo[f.groupId])
        .sort((a, b) => a.nombre.localeCompare(b.nombre)), [datos, reporte]);

    // Derivado, igual que en "Un grupo en detalle": al cambiar de temporada el
    // id guardado ya no existe y cae al primero.
    const grupoActual = grupos.find(g => g.groupId === elegido) ?? grupos[0];
    const deGrupo = grupoActual ? reporte?.asistenciaPorGrupo[grupoActual.groupId] : undefined;

    const reportan = reporte?.gruposQueReportan;
    const pctReporta = reportan && reportan.total > 0 ? Math.round((reportan.reportan / reportan.total) * 100) : 0;
    const asistencia = reporte?.asistenciaPersonas;

    // Tarjeta 3, igual en las tres modalidades: un grupo a la vez. En los
    // híbridos suma sus reuniones en persona y las online.
    const tarjetaGrupo = () => {
        const nuncaCargo = !!deGrupo && deGrupo.total > 0 && deGrupo.sinCarga === deGrupo.total;
        return (
            <Tarjeta className="px-[22px] py-5 flex flex-col">
                <TituloTarjeta
                    titulo="Asistencia de un grupo"
                    detalle={modalidad === 'hibrido'
                        ? 'Elegí un grupo híbrido: suma sus reuniones en persona y las online.'
                        : `Elegí un grupo ${nombre.singular} para ver a su gente.`}
                />
                <select
                    value={grupoActual?.groupId ?? ''}
                    onChange={e => setElegido(e.target.value)}
                    aria-label={`Grupo ${nombre.singular} a mirar`}
                    className="no-print mt-4 h-9 px-3 w-full text-[12.5px] font-semibold outline-none cursor-pointer"
                >
                    {grupos.map(g => (
                        <option key={g.groupId} value={g.groupId}>{g.nombre}</option>
                    ))}
                </select>
                {/* El selector no va al papel, así que sin esto la hoja no
                    diría de qué grupo es la torta. */}
                <p className="solo-impresion mt-3 text-[12.5px] font-semibold" style={{ color: C.medio }}>
                    {grupoActual?.nombre}
                </p>

                {!deGrupo || deGrupo.total === 0 ? (
                    <SinDatos titulo="Sin inscriptos" detalle="Nadie se anotó en este grupo todavía." />
                ) : (
                    <>
                        <TortaAsistencia a={deGrupo} si="Asiste" no="No asiste" etiqueta="asiste" rotuloBase="Inscriptos" valorBase={deGrupo.total} arriba="mt-[18px]" />
                        <NotaCobertura>
                            {nuncaCargo
                                ? <>
                                    Este grupo nunca cargó asistencia, así que sus {deGrupo.total}{' '}
                                    {deGrupo.total === 1 ? 'persona cuenta' : 'personas cuentan'} como que no asisten.{' '}
                                    <button
                                        type="button"
                                        onClick={() => onVerGrupo(grupoActual!.groupId)}
                                        className="no-print font-semibold hover:underline"
                                        style={{ color: C.azul }}
                                    >
                                        Ver el grupo
                                    </button>
                                </>
                                : 'Basta con figurar presente en una reunión para contar como que asiste. Cada pareja cuenta como dos personas.'}
                        </NotaCobertura>
                    </>
                )}
            </Tarjeta>
        );
    };

    // Tarjetas 1 y 2 de los híbridos: a qué reuniones fue la gente.
    const tarjetaModo = (modo: ModoReunion) => {
        const a = reporte?.porModoReunion?.[modo];
        const texto = modo === 'online' ? 'online' : 'en persona';
        if (!a || !reportan) return null;
        return (
            <Tarjeta className="px-[22px] py-5 flex flex-col">
                <TituloTarjeta
                    titulo={modo === 'online' ? 'Asistencia online' : 'Asistencia presencial'}
                    detalle={`Quiénes fueron a alguna reunión ${texto}, en todos los grupos híbridos.`}
                />
                {a.total === 0 ? (
                    <SinDatos titulo="Todavía no hay inscriptos" detalle="Nadie se anotó en los grupos híbridos de esta temporada." />
                ) : reportan.reportan === 0 ? (
                    // Nadie cargó nada todavía: un 0 % se leería como que no
                    // va nadie, cuando lo que pasa es que no arrancó la carga.
                    <SinDatos
                        titulo="Ningún grupo híbrido cargó asistencia"
                        detalle="El gráfico aparece con la primera carga. Desde ahí, los grupos que no carguen cuentan a su gente como ausente."
                    />
                ) : (
                    <>
                        <TortaAsistencia
                            a={a}
                            si={modo === 'online' ? 'Fue online' : 'Fue en persona'}
                            no={modo === 'online' ? 'Nunca online' : 'Nunca en persona'}
                            etiqueta={modo === 'online' ? 'fue online' : 'en persona'}
                            rotuloBase="Personas"
                            valorBase={a.total}
                        />
                        <NotaCobertura>
                            Cuenta sólo las reuniones que el anfitrión marcó como {modo === 'online' ? 'online' : 'presenciales'}
                            {' '}al tomar asistencia, sobre las {a.total} personas de los grupos híbridos.
                            {a.sinCarga > 0 && ` ${a.sinCarga === 1 ? 'Una está' : `${a.sinCarga} están`} en grupos que nunca cargaron y ${a.sinCarga === 1 ? 'cuenta' : 'cuentan'} como que no fue${a.sinCarga === 1 ? '' : 'ron'}.`}
                        </NotaCobertura>
                    </>
                )}
            </Tarjeta>
        );
    };

    return (
        <div>
            <div className="flex items-baseline gap-2.5 mb-3">
                <h3 className="m-0 text-[15px] font-semibold" style={{ color: C.tinta }}>{nombre.titulo}</h3>
                {!cargando && reportan && (
                    <span className="text-[12.5px] font-medium" style={{ color: C.apagado }}>
                        {reportan.total} {reportan.total === 1 ? 'grupo' : 'grupos'}
                    </span>
                )}
            </div>

            {cargando ? (
                <div className="grid gap-4 grid-cols-1 xl:grid-cols-3">
                    {[0, 1, 2].map(i => (
                        <Tarjeta key={i} className="px-[22px] py-5 flex flex-col">
                            <Esqueleto alto={14} ancho="52%" />
                            <div className="mt-2"><Esqueleto alto={11} ancho="70%" /></div>
                            <div className="flex items-center gap-6 mt-[22px] flex-1">
                                <Esqueleto alto={TAMANO_TORTA} ancho={`${TAMANO_TORTA}px`} className="!rounded-full shrink-0" />
                                <div className="flex-1"><Esqueleto alto={13} /><div className="mt-3"><Esqueleto alto={13} /></div></div>
                            </div>
                        </Tarjeta>
                    ))}
                </div>
            ) : !reporte || !reportan || !asistencia || reportan.total === 0 ? (
                // Borde punteado, como la temporada que no arrancó: se lee como
                // algo que todavía no existe, no como una carga que falló. Y
                // chico: tres tortas vacías ocuparían una fila para decir nada.
                <div className="bg-white rounded-[14px] px-6 py-7 text-center" style={{ border: `1px dashed ${C.gris}` }}>
                    <p className="m-0 text-[14.5px] font-semibold" style={{ color: C.medio }}>
                        Todavía no hay grupos {nombre.plural} en la temporada {NOMBRE_TEMPORADA[temporada]} de {anio}
                    </p>
                    <p className="mt-2 mx-auto max-w-[560px] text-[12.5px] leading-[1.6] font-medium" style={{ color: C.apagado }}>
                        Un grupo aparece acá cuando se lo marca como {nombre.singular} al crearlo o editarlo, y con el
                        primero se llenan sus gráficos.
                    </p>
                </div>
            ) : modalidad === 'hibrido' ? (
                <div className="fila-graficos grid gap-4 grid-cols-1 xl:grid-cols-3">
                    {tarjetaModo('online')}
                    {tarjetaModo('presencial')}
                    {tarjetaGrupo()}
                </div>
            ) : (
                <div className="fila-graficos grid gap-4 grid-cols-1 xl:grid-cols-3">

                    <Tarjeta className="px-[22px] py-5 flex flex-col">
                        <TituloTarjeta
                            titulo="Grupos que reportan"
                            detalle={`Cuántos de los grupos ${nombre.plural} cargan asistencia.`}
                        />
                        <TortaFrecuencia frecuencia={reportan.frecuencia} total={reportan.total} etiqueta="reporta" rotuloTotal="Grupos" tamano={TAMANO_TORTA} />
                        <NotaCobertura>
                            {reportan.total === 1
                                ? `Sobre el único grupo ${nombre.singular} activo de la temporada.`
                                : `Sobre los ${reportan.total} grupos ${nombre.plural} activos de la temporada.`}{' '}
                            Un grupo cuenta como que reporta si cargó al menos una reunión.
                        </NotaCobertura>
                    </Tarjeta>

                    <Tarjeta className="px-[22px] py-5 flex flex-col">
                        <TituloTarjeta
                            titulo="Asistencia de personas"
                            detalle={`La gente de todos los grupos ${nombre.plural}, sumada.`}
                        />
                        {asistencia.total === 0 ? (
                            <SinDatos
                                titulo="Todavía no hay inscriptos"
                                detalle={`Nadie se anotó en los grupos ${nombre.plural} de esta temporada.`}
                            />
                        ) : reportan.reportan === 0 ? (
                            <SinDatos
                                titulo={`Ningún grupo ${nombre.singular} cargó asistencia`}
                                detalle="El gráfico aparece con la primera carga. Desde ahí, los grupos que no carguen cuentan a su gente como ausente."
                            />
                        ) : (
                            <>
                                <TortaFrecuencia frecuencia={asistencia.frecuencia} total={asistencia.total} etiqueta="asiste" rotuloTotal="Personas" tamano={TAMANO_TORTA} />
                                {/* Los que cuentan como ausentes por falta de carga se
                                    dicen, igual que en la torta general. */}
                                <NotaCobertura>
                                    {asistencia.sinCarga > 0
                                        ? `Sobre las ${asistencia.total} personas de los grupos ${nombre.plural}. ${asistencia.sinCarga === 1 ? 'Una está' : `${asistencia.sinCarga} están`} sólo en ${reportan.noReportan === 1 ? 'el grupo que nunca cargó' : `los ${reportan.noReportan} grupos que nunca cargaron`} asistencia y ${asistencia.sinCarga === 1 ? 'cuenta' : 'cuentan'} como que no ${asistencia.sinCarga === 1 ? 'asiste' : 'asisten'}.`
                                        : `Sobre las ${asistencia.total} personas de los grupos ${nombre.plural}. Todos cargaron asistencia.`}
                                </NotaCobertura>
                            </>
                        )}
                    </Tarjeta>

                    {tarjetaGrupo()}
                </div>
            )}
        </div>
    );
};

/**
 * Presencial, Online e Híbrido, una debajo de la otra.
 *
 * Apiladas y no en pestañas: en la temporada 3 de 2026 ya había 10 grupos
 * online de 28, y la pregunta de esta sección es si la gente responde
 * distinto según el formato. Así cada torta queda alineada con su par de la
 * otra modalidad y se compara de un vistazo, y el PDF lleva todas. Una
 * modalidad sin grupos ocupa un recuadro chico, no tres tortas.
 *
 * Híbrido no repite los mismos tres gráficos: lo que interesa de esos grupos
 * es cuánta gente va en persona y cuánta online.
 */
const SeccionModalidad: React.FC<PropsModalidad> = (props) => {
    const { datos, cargando, temporada, anio } = props;
    const temporadaSinGrupos = !cargando && !!datos && datos.kpis.totalGrupos === 0;

    return (
        <div data-grafico="modalidad" className="mt-8">
            <div className="mb-3.5">
                <p className="m-0 text-[11.5px] font-semibold tracking-[.06em]" style={{ color: C.apagado }}>
                    POR MODALIDAD
                </p>
                <p className="mt-1.5 text-[12.5px] font-medium" style={{ color: C.apagado }}>
                    Los mismos indicadores, separados según dónde se reúne cada grupo.
                </p>
            </div>

            {temporadaSinGrupos ? (
                // Un solo aviso: tres recuadros vacíos dirían lo mismo tres veces.
                <div className="bg-white rounded-[14px] px-6 py-7 text-center" style={{ border: `1px dashed ${C.gris}` }}>
                    <p className="m-0 text-[14.5px] font-semibold" style={{ color: C.medio }}>
                        La temporada {NOMBRE_TEMPORADA[temporada]} de {anio} todavía no tiene grupos
                    </p>
                    <p className="mt-2 text-[12.5px] font-medium" style={{ color: C.apagado }}>
                        Los gráficos por modalidad aparecen con el primer grupo.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-7">
                    {MODALIDADES.map(m => <BloqueModalidad key={m} modalidad={m} {...props} />)}
                </div>
            )}
        </div>
    );
};

// ── Pantalla ────────────────────────────────────────────────────────────

const ReportesGCX: React.FC<{ currentUser: User }> = () => {
    const navigate = useNavigate();

    const anioActual = new Date().getFullYear();
    const [anio, setAnio] = useState(anioActual);
    const [temporada, setTemporada] = useState<TemporadaGCX>('S1');
    const [datos, setDatos] = useState<ReportesGCXTemporada | null>(null);
    const [cargando, setCargando] = useState(true);
    const [fallo, setFallo] = useState(false);

    const [edadMin, setEdadMin] = useState(10);
    const [edadMax, setEdadMax] = useState(100);
    const [busqueda, setBusqueda] = useState('');

    // ── Carga del tablero ───────────────────────────────────────────────
    // Tres fases: la barra sube, la barra se va, y recién entonces entra el
    // tablero. Separarlas es lo que hace que el tablero no aparezca a medias
    // debajo de una barra que todavía se está yendo.
    const [progreso, setProgreso] = useState<ProgresoReportesGCX>({ pct: 0, etapa: '' });
    const [fase, setFase] = useState<'cargando' | 'saliendo' | 'listo'>('cargando');
    const [barraVisible, setBarraVisible] = useState(false);

    // A quien pidió menos movimiento en su sistema no se le hace esperar la
    // animación de salida: el tablero entra apenas están los datos.
    const sinMovimiento = useMemo(
        () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
        []
    );

    const cargar = useCallback(async () => {
        setCargando(true);
        setFallo(false);
        setProgreso({ pct: 0, etapa: '' });
        setFase('cargando');
        setBarraVisible(false);
        const res = await supabaseService.getReportesGCX(temporada, anio, setProgreso);
        if (!res) { setFallo(true); setDatos(null); }
        else setDatos(res);
        setProgreso({ pct: 100, etapa: 'Listo' });
        setCargando(false);
    }, [temporada, anio]);

    useEffect(() => { cargar(); }, [cargar]);

    // La barra no aparece de inmediato: con la base cacheada el tablero
    // vuelve en decenas de milisegundos y sería un parpadeo. Si llega antes
    // de este cuarto de segundo, nunca se la ve.
    useEffect(() => {
        if (fase !== 'cargando') return;
        const id = window.setTimeout(() => setBarraVisible(true), 220);
        return () => window.clearTimeout(id);
    }, [fase]);

    // Datos listos: se deja ver el 100% un instante y ahí arranca la salida.
    useEffect(() => {
        if (cargando || fase !== 'cargando') return;
        if (fallo || sinMovimiento || !barraVisible) { setFase('listo'); return; }
        const id = window.setTimeout(() => setFase('saliendo'), 280);
        return () => window.clearTimeout(id);
    }, [cargando, fallo, fase, barraVisible, sinMovimiento]);

    // El rango etario filtra sin volver a pedir el resto del tablero: la base
    // ya está cacheada en el servicio, así que esto es una segunda pasada
    // sobre los mismos datos, no otra consulta.
    const [edades, setEdades] = useState<ReportesGCXTemporada['edadesPorCategoria']>([]);
    // El total de la nota va aparte de las filas: sumarlas contaría dos veces
    // a quien está en grupos de dos categorías.
    const [resumenEdad, setResumenEdad] = useState<ResumenDemograficoReporte | null>(null);
    useEffect(() => {
        let vigente = true;
        supabaseService.getEdadesPorCategoria(temporada, anio, edadMin, edadMax)
            .then(r => { if (vigente && r) setEdades(r); });
        supabaseService.getResumenDemografico(temporada, anio, 'edad', edadMin, edadMax)
            .then(r => { if (vigente) setResumenEdad(r); });
        return () => { vigente = false; };
    }, [temporada, anio, edadMin, edadMax]);

    const hayGrupos = !!datos && datos.kpis.totalGrupos > 0;

    const temporadaAnterior = TEMPORADAS[Math.max(0, TEMPORADAS.indexOf(temporada) - 1)];

    // ── Datos derivados para los gráficos ───────────────────────────────
    const asistencia = datos?.asistenciaPersonas;
    const baseAsistencia = asistencia ? asistencia.asistieron + asistencia.nuncaAsistieron : 0;
    const pctAsiste = baseAsistencia > 0 ? Math.round((asistencia!.asistieron / baseAsistencia) * 100) : 0;

    const reportan = datos?.gruposQueReportan;
    const pctReporta = reportan && reportan.total > 0 ? Math.round((reportan.reportan / reportan.total) * 100) : 0;

    const datosGenero = useMemo(() => (datos?.generoPorCategoria || []).map(f => ({
        categoria: f.categoriaNombre,
        Masculino: f.masculino,
        Femenino: f.femenino,
        NoEspecifica: f.noEspecifica,
        sinDato: f.sinDato,
    })), [datos]);

    const promedio = (a: number[]) => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0;
    const datosEdad = useMemo(() => edades
        .filter(f => f.masculino.length > 0 || f.femenino.length > 0 || f.noEspecifica.length > 0)
        .map(f => ({
            categoria: f.categoriaNombre,
            Masculino: promedio(f.masculino),
            Femenino: promedio(f.femenino),
            NoEspecifica: promedio(f.noEspecifica),
            nM: f.masculino.length,
            nF: f.femenino.length,
            nN: f.noEspecifica.length,
        })), [edades]);

    // Personas únicas, no la suma de las barras (ver resumenDemografico).
    const sinDatoGenero = datos?.demografia.sinDato ?? 0;
    const totalGenero = datos?.demografia.personas ?? 0;
    const noEspecificaGenero = datos?.demografia.noEspecifica ?? 0;
    const sinDatoEdad = resumenEdad?.sinDato ?? 0;
    const totalEdad = resumenEdad?.personas ?? 0;

    // ── Descargas ───────────────────────────────────────────────────────
    // Qué gráfico se está imprimiendo. null = el tablero completo.
    const [imprimiendo, setImprimiendo] = useState<ClaveGrafico | null>(null);

    const contextoExport: ContextoExport = { temporada, anio, edadMin, edadMax };

    const bajarExcel = useCallback((clave: ClaveGrafico | null) => {
        if (!datos) return;
        const claves = clave ? [clave] : ORDEN_GRAFICOS;
        const hojas = claves.flatMap(k => hojasDe(k, datos, edades, contextoExport));
        descargarExcel(hojas, nombreArchivo(
            contextoExport,
            clave ? TITULO_GRAFICO[clave] : 'todos los graficos',
            'xlsx'
        ));
    }, [datos, edades, temporada, anio, edadMin, edadMax]);

    /**
     * El PDF sale del diálogo de impresión del navegador ("Guardar como
     * PDF"), que es el patrón que ya usa PanelInteracciones y evita sumar
     * una dependencia para renderizar de nuevo gráficos que ya están
     * dibujados.
     *
     * Los dos rAF no son supersticiosos: `setImprimiendo` recién se refleja
     * en el DOM en el próximo pintado, y window.print() bloquea el hilo. Sin
     * esperar, el diálogo se abre leyendo el DOM viejo y sale el tablero
     * entero en vez del gráfico elegido.
     */
    const bajarPdf = useCallback((clave: ClaveGrafico | null) => {
        setImprimiendo(clave);
        requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    }, []);

    // Volver al tablero completo cuando se cierra el diálogo. Va por evento y
    // no con un timeout: el usuario puede tardar en elegir impresora, y
    // limpiar antes deja el PDF a medio armar.
    useEffect(() => {
        const alTerminar = () => setImprimiendo(null);
        window.addEventListener('afterprint', alTerminar);
        return () => window.removeEventListener('afterprint', alTerminar);
    }, []);

    /** Marca la tarjeta que el CSS de impresión tiene que reponer cuando se
     *  imprime un gráfico solo. */
    const claseImpresion = (clave: ClaveGrafico) => imprimiendo === clave ? 'imprimir-este' : '';

    const descargas = (clave: ClaveGrafico) => (
        <BotonesDescarga onExcel={() => bajarExcel(clave)} onPdf={() => bajarPdf(clave)} />
    );

    // ── Grupo elegido en la lupa ────────────────────────────────────────
    const [grupoElegido, setGrupoElegido] = useState('');

    // ── Disciplina de carga, grupo por grupo ────────────────────────────
    const carga = datos?.cargaPorGrupo || [];

    const tortaMasReportan = useMemo(
        () => armarPorciones(carga.map(f => ({ nombre: f.nombre, valor: f.cargadas }))),
        [carga]
    );
    const tortaNoReportan = useMemo(
        () => armarPorciones(carga.map(f => ({ nombre: f.nombre, valor: f.sinCargar }))),
        [carga]
    );

    // Los que nunca cargaron NADA. No aportan área a la torta de la izquierda
    // (su valor es 0), así que el número va en la nota o desaparecen.
    const nuncaCargaron = carga.filter(f => f.cargadas === 0).length;

    const gruposPorNombre = useMemo(
        () => [...carga].sort((a, b) => a.nombre.localeCompare(b.nombre)),
        [carga]
    );

    // Derivado, no corregido con un efecto: al cambiar de temporada la lista
    // es otra y el id guardado ya no existe. Cayendo al primero, la tarjeta
    // nunca queda en blanco ni renderiza un frame vacío.
    const grupoActual = gruposPorNombre.find(g => g.groupId === grupoElegido) ?? gruposPorNombre[0];

    const pctAsistieron = grupoActual && grupoActual.personas > 0
        ? Math.round((grupoActual.asistieron / grupoActual.personas) * 100)
        : 0;
    const pctCargadas = grupoActual && grupoActual.esperadas > 0
        ? Math.round((grupoActual.cargadas / grupoActual.esperadas) * 100)
        : 0;

    // Una entrada por día de encuentro del grupo elegido, cargado o no.
    const diasDelGrupo = useMemo<DiaDelGrupo[]>(() => (grupoActual?.dias || []).map(d => ({
        fecha: d.fecha,
        etiqueta: fechaCorta(d.fecha),
        'Cargó': d.cargada ? 1 : 0,
        'No cargó': d.cargada ? 0 : 1,
        presentes: d.presentes,
        personas: grupoActual?.personas ?? 0,
    })), [grupoActual]);

    const intervaloGrupo = Math.max(0, Math.ceil(diasDelGrupo.length / 10) - 1);

    // ── Calendario de carga de asistencia ───────────────────────────────
    const diasDeCarga = useMemo<DiaDeCarga[]>(() => (datos?.asistenciaPorFecha || []).map(d => ({
        fecha: d.fecha,
        etiqueta: fechaCorta(d.fecha),
        Cargaron: d.grupos.length,
        NoCargaron: d.sinCargar.length,
        lista: d.grupos,
        faltantes: d.sinCargar,
    })), [datos]);

    const resumenCarga = useMemo(() => {
        const distintos = new Set<string>();
        let reuniones = 0;
        let faltas = 0;
        (datos?.asistenciaPorFecha || []).forEach(d => {
            reuniones += d.grupos.length;
            faltas += d.sinCargar.length;
            d.grupos.forEach(g => distintos.add(g.id));
        });
        return { reuniones, faltas, grupos: distintos.size };
    }, [datos]);

    // Con una temporada de diez semanas hay entre 40 y 70 días con carga: si
    // se etiquetaran todos, el eje sería una mancha. Uno de cada N, con N
    // elegido para que queden ~12 rótulos.
    const intervaloEje = Math.max(0, Math.ceil(diasDeCarga.length / 12) - 1);

    const filasTabla = useMemo(() => {
        const t = busqueda.trim().toLowerCase();
        const filas = datos?.tablaGrupos || [];
        if (!t) return filas;
        return filas.filter(f =>
            f.nombre.toLowerCase().includes(t) ||
            f.anfitrion.toLowerCase().includes(t) ||
            (f.coAnfitrion || '').toLowerCase().includes(t)
        );
    }, [datos, busqueda]);

    // ── Paginado de la tabla ────────────────────────────────────────────
    const [pagina, setPagina] = useState(1);

    // Volver a la primera cuando cambia el conjunto: si estabas en la página 4
    // y buscás algo con dos resultados, la tabla quedaría vacía.
    useEffect(() => { setPagina(1); }, [busqueda, temporada, anio]);

    const totalPaginas = Math.max(1, Math.ceil(filasTabla.length / GRUPOS_POR_PAGINA));
    // Derivada, no corregida con un efecto: así nunca se renderiza una página
    // vacía en el frame intermedio.
    const paginaActual = Math.min(pagina, totalPaginas);
    const desde = (paginaActual - 1) * GRUPOS_POR_PAGINA;
    const filasPagina = filasTabla.slice(desde, desde + GRUPOS_POR_PAGINA);

    // Altura fija por gráfico: el tablero no salta al cambiar de temporada.
    const ALTO_GRAFICO = 460;

    return (
        // El id lo usa la regla de index.html que neutraliza el override
        // global de inputs (borde slate y radio 0.5rem con !important).
        <div
            id="gcx-reportes"
            data-imprimir={imprimiendo ?? undefined}
            className="min-h-screen"
            style={{ background: C.fondo, fontFamily: FUENTE, color: C.tinta }}
        >

            {/* ── Encabezado ── */}
            <div className="encabezado-tablero bg-white px-7 py-5" style={{ borderBottom: `1px solid ${C.borde}` }}>
                <div className="max-w-[1440px] mx-auto flex items-center gap-7 flex-wrap">
                    <div className="min-w-0 flex-1">
                        <h1 className="m-0 text-[19px] font-semibold tracking-[-.01em]" style={{ color: C.tinta }}>
                            Reportes Grupo de Conexión
                        </h1>
                        <p className="mt-[5px] text-[13px] font-medium" style={{ color: C.apagado }}>
                            {cargando
                                ? 'Cargando la temporada…'
                                : hayGrupos
                                    ? `Participación, composición y desempeño de los ${datos!.kpis.totalGrupos} grupos activos.`
                                    : 'Participación, composición y desempeño de los grupos de conexión.'}
                        </p>
                        {/* Los selectores no van al papel, así que sin esto la hoja
                            no diría de qué temporada es. */}
                        <p className="solo-impresion mt-1.5 text-[13px] font-semibold" style={{ color: C.medio }}>
                            Temporada {NOMBRE_TEMPORADA[temporada]} de {anio}
                        </p>
                    </div>

                    {/* Año */}
                    <div className="no-print flex items-center gap-1 rounded-[10px] p-1" style={{ background: '#f4f5f7', border: `1px solid ${C.borde}` }}>
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

                    {/* Temporada */}
                    <div className="no-print flex items-center gap-2.5">
                        <span className="text-[12.5px] font-medium" style={{ color: C.apagado }}>Temporada</span>
                        <div className="flex gap-[3px] rounded-[10px] p-[3px]" style={{ background: '#f4f5f7', border: `1px solid ${C.borde}` }}>
                            {TEMPORADAS.map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setTemporada(t)}
                                    aria-pressed={temporada === t}
                                    className="w-[38px] h-8 rounded-[7px] flex items-center justify-center text-[14px] font-semibold transition-colors"
                                    style={temporada === t
                                        ? { background: C.azul, color: '#fff' }
                                        : { color: '#4b5563' }}
                                >
                                    {NOMBRE_TEMPORADA[t]}
                                </button>
                            ))}
                        </div>

                        {!cargando && !fallo && datos && (
                            <BotonesDescarga
                                destacado
                                onExcel={() => bajarExcel(null)}
                                onPdf={() => bajarPdf(null)}
                            />
                        )}

                        {/* Se lleva el año en la query: la comparación abre sobre
                            el mismo año que estabas mirando, no sobre el actual. */}
                        <button
                            type="button"
                            onClick={() => navigate(`/reportes/gcx/comp-temp?anio=${anio}`)}
                            className="h-[38px] px-4 rounded-[10px] flex items-center gap-2 text-[13.5px] font-semibold transition-colors hover:bg-slate-50"
                            style={{ background: '#fff', border: `1px solid ${C.borde}`, color: C.medio }}
                        >
                            <ArrowLeftRight className="w-[15px] h-[15px]" strokeWidth={2.2} />
                            Comparar temporadas
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-[1440px] mx-auto px-7 py-6">

                {/* Mientras carga, en el lugar del tablero va la barra. No
                    conviven: el tablero entra cuando la barra terminó de
                    irse, así no se lo ve armarse a pedazos por debajo. */}
                {fase !== 'listo' ? (
                    barraVisible ? (
                        <PantallaCarga
                            objetivo={progreso.pct}
                            etapa={progreso.etapa}
                            detalle={`Temporada ${NOMBRE_TEMPORADA[temporada]} · ${anio}`}
                            saliendo={fase === 'saliendo'}
                            onSalida={() => setFase('listo')}
                        />
                    ) : (
                        /* El cuarto de segundo antes de mostrar la barra: se
                           reserva el alto para que nada salte después. */
                        <div style={{ minHeight: '58vh' }} aria-hidden="true" />
                    )
                ) : (
                <div className="animate-fadeIn">

                {fallo && (
                    <Tarjeta className="px-6 py-8 text-center">
                        <p className="m-0 text-[14.5px] font-semibold" style={{ color: C.medio }}>No se pudieron traer los datos</p>
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
                )}

                {!fallo && (
                    <>
                        {/* ── Panorama ── */}
                        <div data-grafico="indicadores" className={claseImpresion('indicadores')}>
                        <div className="flex items-end justify-between gap-5 mb-3.5">
                            <div>
                                <p className="m-0 text-[11.5px] font-semibold tracking-[.06em]" style={{ color: C.apagado }}>
                                    PANORAMA DE LA TEMPORADA
                                </p>
                                <p className="mt-1.5 text-[12.5px] font-medium" style={{ color: C.apagado }}>
                                    {cargando
                                        ? 'Buscando los grupos de la temporada elegida.'
                                        : hayGrupos
                                            ? 'Todo lo de abajo responde al año y la temporada elegidos en el encabezado.'
                                            : `Temporada ${NOMBRE_TEMPORADA[temporada]} de ${anio} · todavía no arrancó.`}
                                </p>
                            </div>
                            {!cargando && datos && descargas('indicadores')}
                        </div>

                        {cargando ? (
                            <div className="grid gap-4 grid-cols-2 xl:grid-cols-3 [@media(min-width:1500px)]:!grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.55fr)]">
                                {[0, 1, 2, 3, 4].map(i => (
                                    <Tarjeta key={i} className="px-5 py-[18px]">
                                        <Esqueleto alto={14} ancho="52%" />
                                        <div className="mt-2"><Esqueleto alto={11} ancho="70%" /></div>
                                        <div className="mt-[22px]"><Esqueleto alto={30} ancho="38%" /></div>
                                        <div className="mt-4"><Esqueleto alto={11} ancho="86%" /></div>
                                    </Tarjeta>
                                ))}
                            </div>
                        ) : !hayGrupos ? (
                            // Borde punteado y el mismo alto: se lee como una
                            // temporada que no arrancó, no como una carga fallida.
                            <div className="grid gap-4 grid-cols-2 xl:grid-cols-3 [@media(min-width:1500px)]:!grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.55fr)]">
                                {['Grupos', 'Anfitriones', 'Co-anfitriones', 'Personas únicas'].map(t => (
                                    <div key={t} className="bg-white rounded-[14px] px-5 py-[18px]" style={{ border: `1px dashed ${C.gris}` }}>
                                        <p className="m-0 text-[13.5px] font-semibold" style={{ color: C.tenue }}>{t}</p>
                                        <p className="mt-[18px] m-0 text-[34px] font-semibold tracking-[-.03em]" style={{ color: C.gris }}>0</p>
                                    </div>
                                ))}
                                <Tarjeta className="px-5 py-[18px] flex flex-col justify-center">
                                    <p className="m-0 text-[14.5px] font-semibold" style={{ color: C.medio }}>
                                        La temporada {NOMBRE_TEMPORADA[temporada]} todavía no tiene grupos
                                    </p>
                                    <p className="mt-2 text-[12.5px] leading-[1.6] font-medium" style={{ color: C.apagado }}>
                                        Los grupos se crean unas semanas antes del inicio. Los indicadores se llenan
                                        solos cuando aparezca el primero.
                                    </p>
                                    {temporada !== 'S1' && (
                                        <button
                                            type="button"
                                            onClick={() => setTemporada(temporadaAnterior)}
                                            className="mt-3.5 self-start text-[12.5px] font-semibold hover:underline"
                                            style={{ color: C.azul }}
                                        >
                                            Ver la temporada {NOMBRE_TEMPORADA[temporadaAnterior]}
                                        </button>
                                    )}
                                </Tarjeta>
                            </div>
                        ) : (
                            <div className="grid gap-4 grid-cols-2 xl:grid-cols-3 [@media(min-width:1500px)]:!grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.55fr)]">
                                <Kpi
                                    titulo="Grupos"
                                    detalle="Activos en la temporada."
                                    valor={datos!.kpis.totalGrupos}
                                />
                                <Kpi
                                    titulo="Anfitriones"
                                    detalle="Líderes principales únicos."
                                    valor={datos!.kpis.anfitriones}
                                    nota={datos!.kpis.anfitriones < datos!.kpis.totalGrupos
                                        ? `${datos!.kpis.totalGrupos - datos!.kpis.anfitriones} ${datos!.kpis.totalGrupos - datos!.kpis.anfitriones === 1 ? 'grupo comparte' : 'grupos comparten'} anfitrión con otro.`
                                        : undefined}
                                />
                                <Kpi
                                    titulo="Co-anfitriones"
                                    detalle="Líderes de apoyo únicos."
                                    valor={datos!.kpis.coAnfitriones}
                                    destacada
                                    nota={`${datos!.kpis.totalGrupos - datos!.kpis.coAnfitriones} ${datos!.kpis.totalGrupos - datos!.kpis.coAnfitriones === 1 ? 'grupo depende' : 'grupos dependen'} de una sola persona`}
                                />
                                <Kpi
                                    titulo="Personas únicas"
                                    detalle="Usuarios distintos inscriptos."
                                    valor={datos!.kpis.personasUnicas}
                                    nota="Es la cantidad real de gente alcanzada por los grupos."
                                />
                                <Kpi
                                    titulo="Inscripciones totales"
                                    detalle="Una persona puede estar en varios grupos."
                                    valor={
                                        <span className="flex items-baseline gap-2.5">
                                            {datos!.kpis.inscripcionesTotales}
                                            <span className="text-[12.5px] font-medium" style={{ color: C.apagado }}>
                                                {datos!.kpis.personasUnicas} personas ·{' '}
                                                {(datos!.kpis.inscripcionesTotales / Math.max(1, datos!.kpis.personasUnicas)).toFixed(1)} grupos por persona
                                            </span>
                                        </span>
                                    }
                                >
                                    <div className="grid grid-cols-3 gap-3 mt-4">
                                        {[
                                            ['En 1 grupo', datos!.kpis.distribucion.unGrupo],
                                            ['En 2 grupos', datos!.kpis.distribucion.dosGrupos],
                                            ['En 3 o más', datos!.kpis.distribucion.tresOMas],
                                        ].map(([t, v]) => (
                                            <div key={t as string} className="rounded-[10px] px-3 py-2.5" style={{ background: C.fondo }}>
                                                <p className="m-0 text-[11.5px] font-medium" style={{ color: C.apagado }}>{t}</p>
                                                <p className="mt-1 m-0 text-[18px] font-semibold" style={{ color: C.tinta }}>{v}</p>
                                            </div>
                                        ))}
                                    </div>
                                </Kpi>
                            </div>
                        )}

                        {/* Cierra el envoltorio de PANORAMA, abierto arriba para
                            que los cinco indicadores se impriman como un bloque. */}
                        </div>

                        {/* ── Tortas ── */}
                        <div className="fila-graficos grid gap-4 mt-4" style={{ gridTemplateColumns: 'minmax(0,1.15fr) minmax(0,1fr) minmax(0,1fr)' }}>

                            <Tarjeta data-grafico="asistencia" className={`px-[22px] py-5 flex flex-col ${claseImpresion('asistencia')}`}>
                                <TituloTarjeta
                                    titulo="Asistencia de personas"
                                    detalle="Qué parte de los inscriptos está asistiendo."
                                    descargas={descargas('asistencia')}
                                />
                                {cargando ? (
                                    <div className="flex items-center gap-6 mt-[22px] flex-1">
                                        <Esqueleto alto={168} ancho="168px" className="!rounded-full shrink-0" />
                                        <div className="flex-1"><Esqueleto alto={13} /><div className="mt-3"><Esqueleto alto={13} /></div></div>
                                    </div>
                                ) : baseAsistencia === 0 || (reportan?.reportan ?? 0) === 0 ? (
                                    <SinDatos
                                        titulo="Todavía no hay asistencia cargada"
                                        detalle={`Ningún grupo reportó reuniones en la temporada ${NOMBRE_TEMPORADA[temporada]} de ${anio}. El gráfico aparece con la primera carga.`}
                                    />
                                ) : (
                                    <>
                                        <TortaFrecuencia frecuencia={asistencia!.frecuencia} total={asistencia!.total} etiqueta="asiste" rotuloTotal="Personas" apilada />
                                        {/* Los ausentes por falta de carga no se esconden en el
                                            número: son casi un tercio del padrón. */}
                                        <NotaCobertura>
                                            Sobre las {asistencia!.total} personas inscriptas en los {reportan?.total ?? 0} grupos de la
                                            temporada. Cada persona cuenta una vez aunque esté en más de un grupo, y sus veces son las
                                            reuniones cargadas a las que fue, sumando todos sus grupos. Quien fue a todas las reuniones
                                            de sus grupos cuenta en "A todas" aunque hayan sido pocas.
                                            {asistencia!.sinCarga > 0 && ` De las que no asisten, ${asistencia!.sinCarga} están sólo en los ${reportan?.noReportan ?? 0} grupos que nunca cargaron asistencia y cuentan como ausentes.`}
                                        </NotaCobertura>
                                    </>
                                )}
                            </Tarjeta>

                            <Tarjeta data-grafico="reportan" className={`px-[22px] py-5 flex flex-col ${claseImpresion('reportan')}`}>
                                <TituloTarjeta
                                    titulo="Reporte de asistencia"
                                    detalle="Cantidad de Grupos que reportan asistencias."
                                    descargas={descargas('reportan')}
                                />
                                {cargando ? (
                                    <div className="flex items-center gap-6 mt-[22px] flex-1">
                                        <Esqueleto alto={168} ancho="168px" className="!rounded-full shrink-0" />
                                        <div className="flex-1"><Esqueleto alto={13} /><div className="mt-3"><Esqueleto alto={13} /></div></div>
                                    </div>
                                ) : !hayGrupos ? (
                                    <SinDatos titulo="Sin grupos en la temporada" detalle="No hay nada que reportar todavía." />
                                ) : (
                                    <>
                                        <TortaFrecuencia frecuencia={reportan!.frecuencia} total={reportan!.total} etiqueta="reporta" rotuloTotal="Grupos" apilada />
                                        <NotaCobertura>
                                            Sobre los {reportan!.total} grupos activos de la temporada. Las veces son los días con
                                            asistencia cargada. "A todas" es el grupo que cargó todas las reuniones que le tocaban
                                            hasta hoy según su día de encuentro, aunque hayan sido pocas.
                                        </NotaCobertura>
                                    </>
                                )}
                            </Tarjeta>

                            <Tarjeta data-grafico="cobertura" className={`px-[22px] py-5 flex flex-col ${claseImpresion('cobertura')}`}>
                                <TituloTarjeta
                                    titulo="Cobertura de los datos"
                                    detalle="Qué parte del padrón alimenta cada gráfico."
                                    descargas={descargas('cobertura')}
                                />
                                {cargando ? (
                                    <div className="mt-[22px] flex-1"><Esqueleto alto={60} /><div className="mt-4"><Esqueleto alto={60} /></div></div>
                                ) : !hayGrupos ? (
                                    <SinDatos titulo="Sin padrón" detalle="La cobertura aparece cuando haya inscripciones." />
                                ) : (
                                    <div className="mt-[22px] flex-1 flex flex-col gap-4">
                                        <div>
                                            <div className="flex items-baseline justify-between gap-3">
                                                <span className="text-[13px] font-semibold" style={{ color: C.medio }}>Género y edades</span>
                                                <span className="text-[13px] font-semibold" style={{ color: C.tinta }}>
                                                    {totalGenero - sinDatoGenero} de {totalGenero}
                                                </span>
                                            </div>
                                            <p className="mt-1.5 text-[12px] leading-[1.5] font-medium" style={{ color: C.apagado }}>
                                                {sinDatoGenero} {sinDatoGenero === 1 ? 'persona fue cargada' : 'personas fueron cargadas'} a mano por su anfitrión y no
                                                {sinDatoGenero === 1 ? ' tiene' : ' tienen'} datos demográficos.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </Tarjeta>
                        </div>

                        {/* ── Barras ── */}
                        <div className="fila-graficos grid grid-cols-2 gap-4 mt-4">

                            <Tarjeta data-grafico="genero" className={`px-[22px] py-5 ${claseImpresion('genero')}`}>
                                <TituloTarjeta
                                    titulo="Género por categoría"
                                    detalle="Inscriptos por categoría de grupo, ordenados de mayor a menor."
                                    extra={<LeyendaGenero />}
                                    descargas={descargas('genero')}
                                />
                                {cargando ? (
                                    <div className="mt-[22px]"><Esqueleto alto={ALTO_GRAFICO - 60} /></div>
                                ) : datosGenero.length === 0 ? (
                                    <div style={{ height: ALTO_GRAFICO - 60 }} className="flex">
                                        <SinDatos titulo="Sin inscripciones" detalle="No hay a quién clasificar todavía en esta temporada." />
                                    </div>
                                ) : (
                                    <>
                                        <div className="mt-[22px]">
                                            <BarrasPorCategoria datos={datosGenero} />
                                        </div>
                                        <NotaCobertura>
                                            Sobre {totalGenero - sinDatoGenero} de {totalGenero} personas, de las cuales{' '}
                                            {noEspecificaGenero} eligieron "No especificar". Las {sinDatoGenero} restantes fueron
                                            cargadas a mano por su anfitrión, no tienen cuenta detrás y por eso no entran en el
                                            gráfico: es una diferencia entre no decirlo y no habérselo preguntado nunca. Cada
                                            persona cuenta una vez por categoría: quien está en grupos de dos categorías aparece
                                            en las dos barras.
                                        </NotaCobertura>
                                    </>
                                )}
                            </Tarjeta>

                            <Tarjeta data-grafico="edades" className={`px-[22px] py-5 ${claseImpresion('edades')}`}>
                                <TituloTarjeta
                                    titulo="Edades por categoría"
                                    detalle="Edad promedio de hombres y mujeres en cada categoría."
                                    extra={<LeyendaGenero />}
                                    descargas={descargas('edades')}
                                />

                                <div className="flex items-center gap-3 mt-4 rounded-[10px] px-3.5 py-2.5" style={{ background: C.fondo }}>
                                    <span className="text-[12px] font-medium shrink-0" style={{ color: C.apagado }}>Rango etario</span>
                                    <input
                                        type="number" min={0} max={120} value={edadMin}
                                        onChange={e => setEdadMin(Math.min(Number(e.target.value) || 0, edadMax))}
                                        aria-label="Edad mínima"
                                        className="w-14 h-8 rounded-[7px] text-center text-[12.5px] font-semibold"
                                        style={{ border: `1px solid ${C.borde}`, background: '#fff', color: C.tinta }}
                                    />
                                    <span className="text-[12.5px] font-medium" style={{ color: C.tenue }}>a</span>
                                    <input
                                        type="number" min={0} max={120} value={edadMax}
                                        onChange={e => setEdadMax(Math.max(Number(e.target.value) || 0, edadMin))}
                                        aria-label="Edad máxima"
                                        className="w-14 h-8 rounded-[7px] text-center text-[12.5px] font-semibold"
                                        style={{ border: `1px solid ${C.borde}`, background: '#fff', color: C.tinta }}
                                    />
                                    <span className="text-[12px] font-medium" style={{ color: C.tenue }}>años</span>
                                </div>

                                {cargando ? (
                                    <div className="mt-4"><Esqueleto alto={ALTO_GRAFICO - 110} /></div>
                                ) : datosEdad.length === 0 ? (
                                    <div style={{ height: ALTO_GRAFICO - 110 }} className="flex">
                                        <SinDatos
                                            titulo="Nadie entra en ese rango"
                                            detalle={`Ninguna persona inscripta tiene entre ${edadMin} y ${edadMax} años, o falta su fecha de nacimiento.`}
                                            accion={{ texto: 'Volver a 10 – 100', onClick: () => { setEdadMin(10); setEdadMax(100); } }}
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <div className="mt-4">
                                            <BarrasPorCategoria
                                                datos={datosEdad}
                                                formatoTooltip={(v, n, p) => {
                                                    const muestra = n === 'Masculino' ? p.payload.nM
                                                        : n === 'Femenino' ? p.payload.nF
                                                            : p.payload.nN;
                                                    return [`${v} años · ${muestra} ${muestra === 1 ? 'persona' : 'personas'}`, n];
                                                }}
                                            />
                                        </div>
                                        <NotaCobertura>
                                            Sobre {totalEdad - sinDatoEdad} de {totalEdad} personas. Las {sinDatoEdad} restantes no
                                            tienen fecha de nacimiento registrada o quedan fuera del rango elegido. Cada
                                            persona cuenta una vez por categoría.
                                        </NotaCobertura>
                                    </>
                                )}
                            </Tarjeta>
                        </div>

                        {/* ── Quién carga y quién no, grupo por grupo ── */}
                        <div className="fila-graficos grid grid-cols-2 gap-4 mt-4">

                            <Tarjeta data-grafico="masReportan" className={`px-[22px] py-5 flex flex-col ${claseImpresion('masReportan')}`}>
                                <TituloTarjeta
                                    titulo="Quiénes reportan más"
                                    detalle="Reuniones cargadas por cada grupo de la temporada."
                                    descargas={descargas('masReportan')}
                                />
                                {cargando ? (
                                    <div className="flex items-center gap-6 mt-[22px] flex-1">
                                        <Esqueleto alto={168} ancho="168px" className="!rounded-full shrink-0" />
                                        <div className="flex-1"><Esqueleto alto={13} /><div className="mt-3"><Esqueleto alto={13} /></div></div>
                                    </div>
                                ) : tortaMasReportan.total === 0 ? (
                                    <SinDatos
                                        titulo="Nadie cargó todavía"
                                        detalle={`Ninguno de los ${datos!.kpis.totalGrupos} grupos de la temporada registró reuniones.`}
                                    />
                                ) : (
                                    <>
                                        <div className="flex items-center gap-6 mt-[22px] flex-1">
                                            <Torta
                                                datos={tortaMasReportan.datos}
                                                porcentaje={0}
                                                centro={tortaMasReportan.total}
                                                etiqueta="reuniones"
                                            />
                                            <div className="min-w-0 flex-1">
                                                {tortaMasReportan.datos.map((d, i) => (
                                                    <FilaLeyenda
                                                        key={d.nombre}
                                                        primera={i === 0}
                                                        color={d.color}
                                                        nombre={d.nombre}
                                                        valor={d.valor}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <NotaCobertura>
                                            Reparte las {tortaMasReportan.total} reuniones cargadas entre los{' '}
                                            {tortaMasReportan.conAporte} grupos que cargaron al menos una.
                                            {nuncaCargaron > 0 && ` Los otros ${nuncaCargaron} nunca cargaron nada y no ocupan lugar en la torta: están en el gráfico de al lado.`}
                                        </NotaCobertura>
                                    </>
                                )}
                            </Tarjeta>

                            <Tarjeta data-grafico="noReportan" className={`px-[22px] py-5 flex flex-col ${claseImpresion('noReportan')}`}>
                                <TituloTarjeta
                                    titulo="Quiénes no reportan"
                                    detalle="Reuniones que cada grupo debía cargar y no cargó."
                                    descargas={descargas('noReportan')}
                                />
                                {cargando ? (
                                    <div className="flex items-center gap-6 mt-[22px] flex-1">
                                        <Esqueleto alto={168} ancho="168px" className="!rounded-full shrink-0" />
                                        <div className="flex-1"><Esqueleto alto={13} /><div className="mt-3"><Esqueleto alto={13} /></div></div>
                                    </div>
                                ) : tortaNoReportan.total === 0 ? (
                                    // Que no haya deuda es una buena noticia y se dice como tal,
                                    // no como un gráfico vacío.
                                    <SinDatos
                                        titulo="No falta ninguna reunión"
                                        detalle={`Los ${datos!.kpis.totalGrupos} grupos de la temporada cargaron todas las reuniones que les correspondían hasta hoy.`}
                                    />
                                ) : (
                                    <>
                                        <div className="flex items-center gap-6 mt-[22px] flex-1">
                                            <Torta
                                                datos={tortaNoReportan.datos}
                                                porcentaje={0}
                                                centro={tortaNoReportan.total}
                                                etiqueta="sin cargar"
                                            />
                                            <div className="min-w-0 flex-1">
                                                {tortaNoReportan.datos.map((d, i) => (
                                                    <FilaLeyenda
                                                        key={d.nombre}
                                                        primera={i === 0}
                                                        color={d.color}
                                                        nombre={d.nombre}
                                                        valor={d.valor}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <NotaCobertura>
                                            Cuenta, por grupo, cuántas veces cayó su día de encuentro sin que nadie cargue la
                                            reunión: {tortaNoReportan.total} en total, repartidas entre {tortaNoReportan.conAporte}{' '}
                                            de los {datos!.kpis.totalGrupos} grupos. No es lo mismo que no reportar nunca — un grupo
                                            que cargó 8 de 10 aporta 2 acá.
                                        </NotaCobertura>
                                    </>
                                )}
                            </Tarjeta>
                        </div>

                        {/* ── Lupa sobre un grupo ── */}
                        <Tarjeta data-grafico="grupoDetalle" className={`px-[22px] py-5 mt-4 ${claseImpresion('grupoDetalle')}`}>
                            <TituloTarjeta
                                titulo="Un grupo en detalle"
                                detalle="Elegí un grupo de la temporada para ver su asistencia y su disciplina de carga."
                                descargas={descargas('grupoDetalle')}
                                extra={!cargando && gruposPorNombre.length > 0 ? (
                                    <select
                                        value={grupoActual?.groupId ?? ''}
                                        onChange={e => setGrupoElegido(e.target.value)}
                                        aria-label="Grupo a mirar en detalle"
                                        className="h-9 px-3 min-w-[240px] max-w-[340px] shrink-0 text-[12.5px] font-semibold outline-none cursor-pointer"
                                    >
                                        {gruposPorNombre.map(g => (
                                            <option key={g.groupId} value={g.groupId}>{g.nombre}</option>
                                        ))}
                                    </select>
                                ) : undefined}
                            />

                            {cargando ? (
                                <div className="grid grid-cols-2 gap-6 mt-[22px]">
                                    {[0, 1].map(i => (
                                        <div key={i} className="flex items-center gap-[22px]">
                                            <Esqueleto alto={148} ancho="148px" className="!rounded-full shrink-0" />
                                            <div className="flex-1"><Esqueleto alto={13} /><div className="mt-3"><Esqueleto alto={13} /></div></div>
                                        </div>
                                    ))}
                                </div>
                            ) : !grupoActual ? (
                                <div style={{ height: 180 }} className="flex">
                                    <SinDatos
                                        titulo="Sin grupos en la temporada"
                                        detalle={`La temporada ${NOMBRE_TEMPORADA[temporada]} de ${anio} todavía no tiene grupos que mirar.`}
                                    />
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-6 mt-[22px]">

                                        {/* Asistencia de la gente del grupo */}
                                        <div>
                                            <p className="m-0 text-[13px] font-semibold" style={{ color: C.tinta }}>
                                                Personas que asistieron
                                            </p>
                                            {grupoActual.personas === 0 ? (
                                                <div style={{ height: 148 }} className="flex">
                                                    <SinDatos titulo="Sin inscriptos" detalle="Nadie se anotó en este grupo todavía." />
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-[22px] mt-3.5">
                                                    <Torta
                                                        tamano={148}
                                                        datos={[
                                                            { nombre: 'Asistió', valor: grupoActual.asistieron, color: C.azul },
                                                            { nombre: 'Nunca asistió', valor: grupoActual.personas - grupoActual.asistieron, color: C.azulClaro },
                                                        ]}
                                                        porcentaje={pctAsistieron}
                                                        etiqueta="asistió"
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <FilaLeyenda primera color={C.azul} nombre="Asistió alguna vez" valor={grupoActual.asistieron} />
                                                        <FilaLeyenda color={C.azulClaro} nombre="Nunca asistió" valor={grupoActual.personas - grupoActual.asistieron} />
                                                        <div className="h-px my-3.5" style={{ background: C.bordeSuave }} />
                                                        <div className="flex items-center gap-2.5">
                                                            <span className="flex-1 text-[12.5px] font-medium" style={{ color: C.apagado }}>Inscriptos</span>
                                                            <span className="text-[12.5px] font-semibold" style={{ color: C.medio }}>{grupoActual.personas}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Disciplina de carga del anfitrión */}
                                        <div>
                                            <p className="m-0 text-[13px] font-semibold" style={{ color: C.tinta }}>
                                                Reuniones cargadas
                                            </p>
                                            {grupoActual.esperadas === 0 ? (
                                                // Sin reuniones esperadas el porcentaje no existe: un 0%
                                                // acusaría al anfitrión de no cargar algo que todavía no pasó.
                                                <div style={{ height: 148 }} className="flex">
                                                    <SinDatos
                                                        titulo="Todavía no le toca"
                                                        detalle="Su día de encuentro no cayó ninguna vez desde que arrancó, o no tiene día de encuentro cargado."
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-[22px] mt-3.5">
                                                    <Torta
                                                        tamano={148}
                                                        datos={[
                                                            { nombre: 'Cargadas', valor: grupoActual.cargadas, color: C.azul },
                                                            { nombre: 'Sin cargar', valor: grupoActual.sinCargar, color: C.azulClaro },
                                                        ]}
                                                        porcentaje={pctCargadas}
                                                        etiqueta="cargó"
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <FilaLeyenda primera color={C.azul} nombre="Cargadas" valor={grupoActual.cargadas} />
                                                        <FilaLeyenda color={C.azulClaro} nombre="Sin cargar" valor={grupoActual.sinCargar} />
                                                        <div className="h-px my-3.5" style={{ background: C.bordeSuave }} />
                                                        <div className="flex items-center gap-2.5">
                                                            <span className="flex-1 text-[12.5px] font-medium" style={{ color: C.apagado }}>Le tocaban</span>
                                                            <span className="text-[12.5px] font-semibold" style={{ color: C.medio }}>{grupoActual.esperadas}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Misma familia que "Días con asistencia cargada": mismo
                                        par de azules, mismo eje de fechas, mismo tooltip. Lo
                                        que cambia es el eje Y, que acá se oculta: para UN
                                        grupo el valor de cada día es sí o no, y un eje que
                                        sólo dice 0 y 1 es ruido. Queda una línea de tiempo de
                                        cumplimiento, que es lo que el dato es. */}
                                    {diasDelGrupo.length > 0 && (
                                        <div className="mt-6 pt-5" style={{ borderTop: `1px solid ${C.bordeSuave}` }}>
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="min-w-0">
                                                    <p className="m-0 text-[13px] font-semibold" style={{ color: C.tinta }}>
                                                        Sus días de encuentro, uno por uno
                                                    </p>
                                                    <p className="mt-[5px] text-[12.5px] font-medium" style={{ color: C.tenue }}>
                                                        Cada barra es una fecha en la que le tocaba reunirse. Pasá el mouse para ver
                                                        cuánta gente fue.
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-4 shrink-0">
                                                    {([['Cargó', C.azul], ['No cargó', C.azulClaro]] as const).map(([t, c]) => (
                                                        <div key={t} className="flex items-center gap-[7px]">
                                                            <span className="w-[9px] h-[9px] rounded-sm" style={{ background: c }} />
                                                            <span className="text-[12px] font-semibold" style={{ color: '#4b5563' }}>{t}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="mt-4" style={{ height: 190 }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={diasDelGrupo} margin={{ left: 0, right: 8, top: 4, bottom: 4 }} barGap={2}>
                                                        <CartesianGrid vertical={false} stroke={C.bordeSuave} />
                                                        <XAxis
                                                            dataKey="etiqueta"
                                                            interval={intervaloGrupo}
                                                            tick={{ ...EjeCategoria, fontSize: 11.5, fill: C.apagado }}
                                                            axisLine={false}
                                                            tickLine={false}
                                                        />
                                                        {/* Oculto: su único valor posible es 0 o 1. */}
                                                        <YAxis hide domain={[0, 1]} />
                                                        <Tooltip cursor={{ fill: 'rgba(37,99,235,.05)' }} content={<TooltipDiaGrupo />} />
                                                        <Bar dataKey="Cargó" fill={C.azul} radius={[3, 3, 0, 0]} maxBarSize={11} />
                                                        <Bar dataKey="No cargó" fill={C.azulClaro} radius={[3, 3, 0, 0]} maxBarSize={11} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    )}

                                    <NotaCobertura>
                                        Los dos porcentajes miden cosas distintas y no se comparan entre sí. El de la izquierda
                                        es sobre las {grupoActual.personas} personas inscriptas del grupo — cada pareja cuenta
                                        como dos — y basta con figurar presente en una reunión para contar como que asistió.
                                        El de la derecha es sobre las {grupoActual.esperadas} veces que cayó su día de encuentro
                                        desde que arrancó hasta hoy: 100% es que cargó todas, 0% que no cargó ninguna. Si el
                                        grupo nunca cargó asistencia, todas sus personas cuentan como que no asistieron.
                                        La línea de tiempo llega hasta hoy, no hasta el fin de temporada: los encuentros
                                        que todavía no pasaron no son reuniones sin cargar.
                                    </NotaCobertura>
                                </>
                            )}
                        </Tarjeta>

                        {/* ── Calendario de carga ── */}
                        <Tarjeta data-grafico="calendario" className={`px-[22px] py-5 mt-4 ${claseImpresion('calendario')}`}>
                            <TituloTarjeta
                                descargas={descargas('calendario')}
                                titulo="Días con asistencia cargada"
                                detalle="Cuáles reportaron y cuáles debían reportar y no lo hicieron. Pasá el mouse por una barra para ver los nombres."
                                extra={!cargando && diasDeCarga.length > 0 ? (
                                    <div className="flex items-center gap-4 shrink-0">
                                        {([['Cargaron', C.azul], ['No cargaron', C.azulClaro]] as const).map(([t, c]) => (
                                            <div key={t} className="flex items-center gap-[7px]">
                                                <span className="w-[9px] h-[9px] rounded-sm" style={{ background: c }} />
                                                <span className="text-[12px] font-semibold" style={{ color: '#4b5563' }}>{t}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : undefined}
                            />
                            {cargando ? (
                                <div className="mt-[22px]"><Esqueleto alto={300} /></div>
                            ) : diasDeCarga.length === 0 ? (
                                <div style={{ height: 240 }} className="flex">
                                    <SinDatos
                                        titulo="Ningún grupo cargó asistencia todavía"
                                        detalle={`En la temporada ${NOMBRE_TEMPORADA[temporada]} de ${anio} no hay ninguna reunión registrada. La primera carga dibuja la primera barra.`}
                                    />
                                </div>
                            ) : (
                                <>
                                    {/* Barras VERTICALES, al revés que los dos gráficos de
                                        arriba: acá el eje horizontal es el tiempo, y el
                                        tiempo se lee de izquierda a derecha. Los otros dos
                                        son rankings de categorías, que es otra cosa. */}
                                    <div className="mt-[22px]" style={{ height: 300 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={diasDeCarga} margin={{ left: 0, right: 8, top: 4, bottom: 4 }} barGap={2}>
                                                <CartesianGrid vertical={false} stroke={C.bordeSuave} />
                                                <XAxis
                                                    dataKey="etiqueta"
                                                    interval={intervaloEje}
                                                    tick={{ ...EjeCategoria, fontSize: 11.5, fill: C.apagado }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                />
                                                <YAxis
                                                    width={32}
                                                    allowDecimals={false}
                                                    tick={{ ...EjeCategoria, fontSize: 11.5, fill: C.apagado }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                />
                                                <Tooltip cursor={{ fill: 'rgba(37,99,235,.05)' }} content={<TooltipDia />} />
                                                {/* Mismo par de azules que las tortas de arriba:
                                                    el pleno es lo que pasó, el claro lo que
                                                    faltó. No se apilan — apiladas, la altura
                                                    total sería "grupos de ese día" y taparía
                                                    justo la comparación que interesa. */}
                                                <Bar dataKey="Cargaron" fill={C.azul} radius={[3, 3, 0, 0]} maxBarSize={9} />
                                                <Bar dataKey="NoCargaron" name="No cargaron" fill={C.azulClaro} radius={[3, 3, 0, 0]} maxBarSize={9} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <NotaCobertura>
                                        {resumenCarga.reuniones} {resumenCarga.reuniones === 1 ? 'reunión cargada' : 'reuniones cargadas'} por{' '}
                                        {resumenCarga.grupos} de los {datos!.kpis.totalGrupos} grupos, repartidas en {diasDeCarga.length}{' '}
                                        {diasDeCarga.length === 1 ? 'día' : 'días'} entre el {fechaCorta(diasDeCarga[0].fecha)} y el{' '}
                                        {fechaCorta(diasDeCarga[diasDeCarga.length - 1].fecha)}, y {resumenCarga.faltas}{' '}
                                        {resumenCarga.faltas === 1 ? 'reunión que quedó sin cargar' : 'reuniones que quedaron sin cargar'}.{' '}
                                        La barra clara cuenta sólo los grupos que se reúnen ESE día de la semana y ya estaban
                                        vigentes en esa fecha — un grupo de los lunes no falta un jueves. Sólo aparecen los días con
                                        al menos una carga: un día en el que nadie reportó nada todavía no está en el eje.
                                    </NotaCobertura>
                                </>
                            )}
                        </Tarjeta>

                        {/* ── Por modalidad ── */}
                        <SeccionModalidad
                            datos={datos}
                            cargando={cargando}
                            temporada={temporada}
                            anio={anio}
                            onVerGrupo={id => navigate(`/reportes/gcx/${id}`)}
                        />

                        {/* ── Tabla ── */}
                        <Tarjeta data-grafico="tabla" className={`mt-4 overflow-hidden ${claseImpresion('tabla')}`}>
                            <div className="px-[22px] py-5 flex items-start justify-between gap-5">
                                <div className="min-w-0">
                                    <p className="m-0 text-[15px] font-semibold" style={{ color: C.tinta }}>Detalle por grupo</p>
                                    <p className="mt-[5px] text-[12.5px] font-medium" style={{ color: C.tenue }}>
                                        {cargando
                                            ? 'Cargando los grupos…'
                                            : `${filasTabla.length} ${filasTabla.length === 1 ? 'grupo' : 'grupos'} en la temporada ${NOMBRE_TEMPORADA[temporada]} de ${anio}.`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2.5 shrink-0">
                                    <div className="h-9 px-3.5 rounded-[9px] flex items-center gap-2.5 min-w-[230px]" style={{ border: `1px solid ${C.borde}` }}>
                                        <Search className="w-[15px] h-[15px] shrink-0" style={{ color: C.tenue }} strokeWidth={2.2} />
                                        <input
                                            type="text"
                                            value={busqueda}
                                            onChange={e => setBusqueda(e.target.value)}
                                            placeholder="Buscar un grupo o anfitrión"
                                            className="campo-desnudo flex-1 min-w-0 text-[12.5px] font-medium outline-none"
                                            style={{ color: C.tinta, padding: 0 }}
                                        />
                                    </div>
                                    {!cargando && datos && descargas('tabla')}
                                </div>
                            </div>

                            <div
                                className="grid gap-5 px-[22px] py-[11px]"
                                style={{
                                    gridTemplateColumns: 'minmax(0,2fr) minmax(0,1.4fr) minmax(0,1.4fr) minmax(0,1.6fr) 150px',
                                    background: C.fondo,
                                    borderTop: `1px solid ${C.bordeSuave}`,
                                    borderBottom: `1px solid ${C.bordeSuave}`,
                                }}
                            >
                                {['GRUPO', 'ANFITRIÓN', 'CO-ANFITRIÓN', 'OCUPACIÓN'].map(t => (
                                    <span key={t} className="text-[11.5px] font-semibold tracking-[.04em]" style={{ color: C.apagado }}>{t}</span>
                                ))}
                                <span />
                            </div>

                            {cargando ? (
                                [0, 1, 2, 3, 4].map(i => (
                                    <div key={i} className="px-[22px] py-3.5" style={{ borderBottom: `1px solid #f2f3f5` }}>
                                        <Esqueleto alto={14} ancho="34%" />
                                    </div>
                                ))
                            ) : filasTabla.length === 0 ? (
                                <div className="px-[22px] py-12 text-center">
                                    <p className="m-0 text-[14px] font-semibold" style={{ color: C.medio }}>
                                        {busqueda ? 'Ningún grupo coincide con la búsqueda' : 'Todavía no hay grupos en esta temporada'}
                                    </p>
                                    <p className="mt-2 text-[12.5px] font-medium" style={{ color: C.apagado }}>
                                        {busqueda
                                            ? `Probá con otro nombre. Buscaste "${busqueda}".`
                                            : 'Cuando se apruebe el primero, aparece acá.'}
                                    </p>
                                </div>
                            ) : (
                                filasPagina.map(f => {
                                    const pct = f.capacidad > 0 ? Math.min(100, Math.round((f.inscriptos / f.capacidad) * 100)) : 0;
                                    return (
                                        <div
                                            key={f.groupId}
                                            className="grid gap-5 px-[22px] py-3.5 items-center"
                                            style={{
                                                gridTemplateColumns: 'minmax(0,2fr) minmax(0,1.4fr) minmax(0,1.4fr) minmax(0,1.6fr) 150px',
                                                borderBottom: `1px solid #f2f3f5`,
                                            }}
                                        >
                                            <div className="min-w-0">
                                                <p className="m-0 text-[13.5px] font-semibold truncate" style={{ color: C.tinta }}>{f.nombre}</p>
                                                <p className="mt-[3px] text-[12px] font-medium truncate" style={{ color: C.tenue }}>
                                                    {[f.categoriaNombre, `${f.diaReunion} ${f.horaReunion}`.trim(), f.modalidad !== 'presencial' ? NOMBRE_MODALIDAD[f.modalidad] : null]
                                                        .filter(Boolean).join(' · ')}
                                                </p>
                                            </div>
                                            <span className="text-[13px] font-medium truncate" style={{ color: C.medio }}>{f.anfitrion}</span>
                                            <span className="text-[13px] font-medium truncate" style={{ color: f.coAnfitrion ? C.medio : C.tenue }}>
                                                {f.coAnfitrion || '—'}
                                            </span>
                                            <div className="flex items-center gap-[11px]">
                                                <div className="flex-1 min-w-0 h-[7px] rounded-full overflow-hidden" style={{ background: C.bordeSuave }}>
                                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: C.azul }} />
                                                </div>
                                                <span className="text-[12.5px] font-semibold whitespace-nowrap" style={{ color: C.medio }}>
                                                    {f.inscriptos}/{f.capacidad}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/reportes/gcx/${f.groupId}`)}
                                                className="flex items-center gap-1.5 text-[12.5px] font-semibold hover:underline justify-self-start"
                                                style={{ color: C.azul }}
                                            >
                                                Ver más detalles
                                                <ArrowRight className="w-[13px] h-[13px]" strokeWidth={2.4} />
                                            </button>
                                        </div>
                                    );
                                })
                            )}

                            {!cargando && totalPaginas > 1 && (
                                <div className="px-[22px] py-3.5 flex items-center justify-between gap-5 flex-wrap">
                                    <span className="text-[12.5px] font-medium" style={{ color: C.apagado }}>
                                        Mostrando {desde + 1}–{desde + filasPagina.length} de {filasTabla.length}
                                    </span>

                                    <nav className="flex items-center gap-1.5" aria-label="Paginado de grupos">
                                        <button
                                            type="button"
                                            onClick={() => setPagina(paginaActual - 1)}
                                            disabled={paginaActual === 1}
                                            aria-label="Página anterior"
                                            className="w-8 h-8 rounded-[9px] bg-white flex items-center justify-center transition-colors enabled:hover:bg-slate-50 disabled:cursor-not-allowed"
                                            style={{ border: `1px solid ${C.borde}` }}
                                        >
                                            <ChevronLeft
                                                className="w-[15px] h-[15px]"
                                                style={{ color: paginaActual === 1 ? C.gris : C.medio }}
                                                strokeWidth={2.2}
                                            />
                                        </button>

                                        {paginasVisibles(paginaActual, totalPaginas).map((p, i) => (
                                            p === '…' ? (
                                                <span
                                                    key={`salto-${i}`}
                                                    className="w-6 text-center text-[12.5px] font-semibold"
                                                    style={{ color: C.tenue }}
                                                    aria-hidden="true"
                                                >
                                                    …
                                                </span>
                                            ) : (
                                                <button
                                                    key={p}
                                                    type="button"
                                                    onClick={() => setPagina(p)}
                                                    aria-label={`Página ${p}`}
                                                    aria-current={p === paginaActual ? 'page' : undefined}
                                                    className="min-w-8 h-8 px-2 rounded-[9px] flex items-center justify-center text-[12.5px] font-semibold transition-colors"
                                                    style={p === paginaActual
                                                        ? { background: C.azul, color: '#fff', border: `1px solid ${C.azul}` }
                                                        : { background: '#fff', color: C.medio, border: `1px solid ${C.borde}` }}
                                                >
                                                    {p}
                                                </button>
                                            )
                                        ))}

                                        <button
                                            type="button"
                                            onClick={() => setPagina(paginaActual + 1)}
                                            disabled={paginaActual === totalPaginas}
                                            aria-label="Página siguiente"
                                            className="w-8 h-8 rounded-[9px] bg-white flex items-center justify-center transition-colors enabled:hover:bg-slate-50 disabled:cursor-not-allowed"
                                            style={{ border: `1px solid ${C.borde}` }}
                                        >
                                            <ChevronRight
                                                className="w-[15px] h-[15px]"
                                                style={{ color: paginaActual === totalPaginas ? C.gris : C.medio }}
                                                strokeWidth={2.2}
                                            />
                                        </button>
                                    </nav>
                                </div>
                            )}
                        </Tarjeta>
                    </>
                )}

                </div>
                )}
            </div>
        </div>
    );
};

export default ReportesGCX;
