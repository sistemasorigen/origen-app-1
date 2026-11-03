// ════════════════════════════════════════════════════════════════════════
// /reportes/gcx — la tarjeta "Inscripciones".
//
// Cuántas inscripciones nuevas hubo por día, semana o mes, con los eventos
// y servicios especiales marcados sobre la misma línea de tiempo. Cuenta sólo
// lo nuevo: no vuelve a contar a quien ya estaba inscripto.
// Las cuentas viven en inscripcionesGCX.ts (puro); acá sólo se dibuja.
//
// Las marcas acompañan, no explican: la bajada lo dice. Una barra alta al
// lado de un evento no prueba que el evento la haya causado.
// ════════════════════════════════════════════════════════════════════════
import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { C, FUENTE, EjeCategoria, Tarjeta, TituloTarjeta, NotaCobertura, Esqueleto, SinDatos } from '../../components/Reportes/PiezasTablero';
import { Agrupacion } from './periodoGCX';
import { Marca, TramoDeInscripciones } from './inscripcionesGCX';
import { fechaCorta } from './exportacion';

/** Los colores de las series y de las marcas. Las marcas no son azules: no son una serie más. */
export const COLOR_INSC = {
    nuevas: C.azul,
    evento: '#c2410c',
    servicio: '#7c3aed',
} as const;

const Punto: React.FC<{ color: string; redondo?: boolean }> = ({ color, redondo }) => (
    <span className={`w-[9px] h-[9px] shrink-0 ${redondo ? 'rounded-full' : 'rounded-sm'}`} style={{ background: color }} />
);

/**
 * La marca sobre el eje: un punto por tipo arriba de la línea, con la
 * cantidad al lado si en ese día, semana o mes hubo más de una. El
 * nombre completo está en el tooltip y en la lista de abajo.
 */
const MarcaEnEje: React.FC<{ viewBox?: { x: number; y: number }; eventos: number; servicios: number }> = ({ viewBox, eventos, servicios }) => {
    if (!viewBox) return null;
    const { x, y } = viewBox;
    const fila = (n: number, color: string, dy: number, tipo: string) => (
        <g key={tipo}>
            <circle cx={x} cy={y + dy} r={4.5} fill={color} stroke="#fff" strokeWidth={1.5}>
                <title>{n === 1 ? `1 ${tipo}` : `${n} ${tipo}s`}</title>
            </circle>
            {n > 1 && <text x={x + 7} y={y + dy + 3.5} fontSize={10.5} fontWeight={700} fill={color} fontFamily={FUENTE}>{n}</text>}
        </g>
    );
    return (
        <g>
            {eventos > 0 && fila(eventos, COLOR_INSC.evento, 2, 'evento')}
            {servicios > 0 && fila(servicios, COLOR_INSC.servicio, eventos > 0 ? 14 : 2, 'servicio')}
        </g>
    );
};

/**
 * El tooltip: el rango, cuántas inscripciones nuevas hubo, la lista completa
 * de grupos con las suyas (sin tope, como los demás tooltips del tablero) y
 * lo que pasó en esas fechas.
 */
const TooltipInscripciones: React.FC<{ active?: boolean; payload?: Array<{ payload: TramoDeInscripciones }> }> = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const t = payload[0].payload;
    const marcas = [...t.eventos, ...t.servicios].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const dos = t.grupos.length > 12;
    return (
        // En el celular, una columna y nunca más ancho que la pantalla.
        <div className={`px-3 py-2.5 max-w-[calc(100vw-40px)] ${dos ? 'w-[280px] sm:w-[560px]' : 'w-[280px] sm:w-[320px]'}`} style={{ background: '#fff', border: `1px solid ${C.borde}`, borderRadius: 10, fontFamily: FUENTE }}>
            <p className="m-0 text-[12.5px] font-semibold" style={{ color: C.tinta }}>{t.titulo}</p>
            <p className="mt-0.5 m-0 text-[12px] font-medium" style={{ color: C.apagado }}>
                {t['Inscripciones nuevas']} {t['Inscripciones nuevas'] === 1 ? 'inscripción nueva' : 'inscripciones nuevas'}
            </p>
            {t.grupos.length > 0 && (
                <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${C.bordeSuave}` }}>
                    <div className="flex items-baseline gap-3">
                        <span className="flex-1 min-w-0 text-[11px] font-semibold" style={{ color: C.azul }}>
                            En {t.grupos.length} {t.grupos.length === 1 ? 'grupo' : 'grupos'}
                        </span>
                        <span className="shrink-0 text-[11px] font-semibold" style={{ color: C.tenue }}>nuevas</span>
                    </div>
                    <div className={dos ? 'grid grid-cols-1 sm:grid-cols-2 gap-x-5' : ''}>
                        {t.grupos.map(g => (
                            <div key={g.groupId} className="flex items-baseline gap-2 mt-1 min-w-0">
                                <span className="flex-1 min-w-0 truncate text-[12px] leading-[1.5] font-medium" style={{ color: C.medio }}>
                                    {g.nombre}<span style={{ color: C.tenue }}> · {g.categoria}</span>
                                </span>
                                <span className="shrink-0 text-[12px] font-semibold tabular-nums" style={{ color: C.tinta }}>
                                    {g.nuevas}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {marcas.length > 0 && (
                <div className="mt-2.5 pt-2.5" style={{ borderTop: `1px solid ${C.bordeSuave}` }}>
                    <p className="m-0 mb-1 text-[11px] font-semibold" style={{ color: C.apagado }}>En esas fechas</p>
                    {marcas.map(m => (
                        <div key={`${m.fecha}${m.tipo}${m.nombre}`} className="flex items-baseline gap-2 mt-1">
                            <Punto redondo color={m.tipo === 'evento' ? COLOR_INSC.evento : COLOR_INSC.servicio} />
                            <span className="flex-1 min-w-0 text-[12px] font-medium" style={{ color: C.medio }}>{m.nombre}</span>
                            <span className="shrink-0 text-[11.5px] font-semibold" style={{ color: C.tenue }}>{fechaCorta(m.fecha)} · {m.detalle}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export interface PropsInscripciones {
    cargando: boolean;
    serie: TramoDeInscripciones[];
    resumen: { nuevas: number; pendientes: number; rechazadas: number; derivaciones: number };
    /** Las marcas del rango, en orden, para la lista de abajo. */
    marcas: Marca[];
    agrupacion: Agrupacion;
    /** "26 oct – 1 nov 2026 · por semana", "Por semana" o null. */
    alcance: string | null;
    /** La primera inscripción, si el gráfico arranca antes de que empiecen los grupos. */
    arrancaAntes: string | null;
    /** "del 26 de octubre al 1 de noviembre" con un período elegido. */
    enElPeriodo: string | null;
    categorias: Array<{ id: string; nombre: string }>;
    categoria: string;
    onCategoria: (id: string) => void;
    verMarcas: boolean;
    onVerMarcas: (v: boolean) => void;
    descargas: React.ReactNode;
    className?: string;
}

const TarjetaInscripciones: React.FC<PropsInscripciones> = (p) => {
    const vacio = p.resumen.nuevas === 0;
    const n = p.serie.length;
    const intervalo = p.agrupacion === 'dias' ? Math.max(0, Math.ceil(n / 12) - 1)
        : p.agrupacion === 'semanas' ? Math.max(0, Math.ceil(n / 9) - 1) : 0;
    const ancho = p.agrupacion === 'dias' ? 9 : p.agrupacion === 'semanas' ? 22 : 36;
    const conMarcas = p.verMarcas ? p.serie.filter(t => t.eventos.length + t.servicios.length > 0) : [];

    return (
        <Tarjeta data-grafico="inscripciones" className={`px-[22px] py-5 mt-4 ${p.className || ''}`}>
            <TituloTarjeta
                titulo="Inscripciones"
                junto={p.cargando ? undefined : `${p.resumen.nuevas} ${p.resumen.nuevas === 1 ? 'inscripción nueva' : 'inscripciones nuevas'}`}
                detalle="Inscripciones nuevas en los grupos de la temporada, por la fecha en que se hicieron. No vuelve a contar a quien ya estaba inscripto."
                alcance={p.alcance}
                descargas={p.descargas}
                extra={!p.cargando ? (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 shrink-0">
                        {([
                            ['Inscripciones nuevas', COLOR_INSC.nuevas, false],
                            ...(p.verMarcas ? [['Eventos', COLOR_INSC.evento, true], ['Servicios', COLOR_INSC.servicio, true]] : []),
                        ] as Array<[string, string, boolean]>).map(([t, c, r]) => (
                            <div key={t} className="flex items-center gap-[7px]">
                                <Punto color={c} redondo={r} />
                                <span className="text-[12px] font-semibold" style={{ color: '#4b5563' }}>{t}</span>
                            </div>
                        ))}
                    </div>
                ) : undefined}
            />

            {/* Filtro por categoría y el interruptor de las marcas. Sólo
                tocan este gráfico. */}
            {!p.cargando && (
                <div className="no-print mt-4 flex flex-wrap items-center gap-3">
                    <div className="w-full overflow-hidden p-[3px] -m-[3px] sm:w-auto sm:overflow-visible sm:p-0 sm:m-0">
                        <select
                            value={p.categoria}
                            onChange={e => p.onCategoria(e.target.value)}
                            aria-label="Categoría de grupo para las inscripciones"
                            className="h-9 px-3 w-full sm:w-auto sm:min-w-[220px] max-w-[340px] text-[12.5px] font-semibold outline-none cursor-pointer"
                        >
                            <option value="">Todas las categorías</option>
                            {p.categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={p.verMarcas}
                        onClick={() => p.onVerMarcas(!p.verMarcas)}
                        className="h-9 pl-2 pr-3.5 rounded-[9px] flex items-center gap-2.5 text-[12.5px] font-semibold transition-colors hover:bg-slate-50"
                        style={{ border: `1px solid ${C.borde}`, color: C.medio, background: '#fff' }}
                    >
                        <span className="relative w-8 h-[18px] rounded-full transition-colors" style={{ background: p.verMarcas ? C.azul : C.gris }}>
                            <span className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all" style={{ left: p.verMarcas ? 16 : 2 }} />
                        </span>
                        Eventos y servicios
                    </button>
                </div>
            )}
            {!p.cargando && p.categoria && (
                <p className="solo-impresion mt-3 text-[12.5px] font-semibold" style={{ color: C.medio }}>
                    Categoría: {p.categorias.find(c => c.id === p.categoria)?.nombre}
                </p>
            )}

            {p.cargando ? (
                <div className="mt-[22px]"><Esqueleto alto={280} /></div>
            ) : vacio ? (
                <div style={{ height: 220 }} className="flex">
                    <SinDatos
                        titulo={p.enElPeriodo ? 'No hubo inscripciones nuevas en el período' : 'Todavía no hay inscripciones'}
                        detalle={p.enElPeriodo
                            ? `No hay inscripciones ${p.enElPeriodo}${p.categoria ? ' en esta categoría' : ''}. Probá con un período más largo.`
                            : `Los grupos de la temporada todavía no tienen inscripciones${p.categoria ? ' en esta categoría' : ''}.`}
                    />
                </div>
            ) : (
                <>
                    <div className="mt-[22px]" style={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={p.serie} margin={{ left: 0, right: 14, top: 22, bottom: 4 }} barGap={2}>
                                <CartesianGrid vertical={false} stroke={C.bordeSuave} />
                                <XAxis dataKey="etiqueta" interval={intervalo} tick={{ ...EjeCategoria, fontSize: 11.5, fill: C.apagado }} axisLine={false} tickLine={false} />
                                <YAxis width={32} allowDecimals={false} tick={{ ...EjeCategoria, fontSize: 11.5, fill: C.apagado }} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{ fill: 'rgba(37,99,235,.05)' }} content={<TooltipInscripciones />} />
                                {conMarcas.map(t => (
                                    <ReferenceLine
                                        key={t.desde}
                                        x={t.etiqueta}
                                        stroke={C.tenue}
                                        strokeDasharray="2 3"
                                        ifOverflow="visible"
                                        label={<MarcaEnEje eventos={t.eventos.length} servicios={t.servicios.length} />}
                                    />
                                ))}
                                <Bar dataKey="Inscripciones nuevas" fill={COLOR_INSC.nuevas} radius={[3, 3, 0, 0]} maxBarSize={ancho} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {p.verMarcas && (
                        <div className="mt-4">
                            <p className="m-0 text-[12.5px] font-semibold" style={{ color: C.tinta }}>En este período</p>
                            {p.marcas.length === 0 ? (
                                <p className="mt-1.5 text-[12.5px] font-medium" style={{ color: C.apagado }}>
                                    No hubo eventos ni servicios especiales en estas fechas.
                                </p>
                            ) : (
                                <ul className="m-0 mt-2 p-0 list-none grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-1.5">
                                    {p.marcas.map(m => (
                                        <li key={`${m.fecha}${m.tipo}${m.nombre}${m.detalle}`} className="flex items-baseline gap-2 min-w-0">
                                            <Punto redondo color={m.tipo === 'evento' ? COLOR_INSC.evento : COLOR_INSC.servicio} />
                                            <span className="shrink-0 text-[12px] font-semibold tabular-nums" style={{ color: C.medio }}>{fechaCorta(m.fecha)}</span>
                                            <span className="min-w-0 truncate text-[12.5px] font-medium" style={{ color: C.tinta }}>{m.nombre}</span>
                                            <span className="shrink-0 text-[12px] font-medium" style={{ color: C.tenue }}>{m.detalle}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    <NotaCobertura>
                        {p.arrancaAntes && `Incluye las semanas antes de que empiecen los grupos: la primera inscripción es del ${fechaCorta(p.arrancaAntes)}. `}
                        Cada inscripción cuenta una vez, en la fecha en que se hizo: quien se anota en dos grupos son dos inscripciones,
                        y una inscripción de pareja es una. No vuelve a contar a quien ya estaba inscripto: por eso no se cuentan las aprobaciones
                        {p.resumen.derivaciones > 0
                            ? ` ni ${p.resumen.derivaciones === 1 ? 'la derivación' : `las ${p.resumen.derivaciones} derivaciones`} desde otro grupo.`
                            : ' ni las derivaciones desde otro grupo.'}
                        {(p.resumen.pendientes > 0 || p.resumen.rechazadas > 0) && ` Incluye las que todavía no se aprobaron (${[
                            p.resumen.pendientes ? `${p.resumen.pendientes} ${p.resumen.pendientes === 1 ? 'pendiente' : 'pendientes'}` : '',
                            p.resumen.rechazadas ? `${p.resumen.rechazadas} ${p.resumen.rechazadas === 1 ? 'rechazada' : 'rechazadas'}` : '',
                        ].filter(Boolean).join(', ')}).`}{' '}
                        Las inscripciones borradas (las bajas) ya no existen y no se pueden contar.{' '}
                        Las marcas muestran qué pasó en esas fechas; no prueban que haya causado las inscripciones.
                    </NotaCobertura>
                </>
            )}
        </Tarjeta>
    );
};

export default TarjetaInscripciones;
