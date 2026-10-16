// ════════════════════════════════════════════════════════════════════════
// /reportes/puntoinfo/novedades — todo lo que pasó en el Punto, en orden.
//
// El tablero muestra las 3 últimas novedades y de acá sale el resto. Es la
// misma familia visual que /reportes/puntoinfo: fondo #f7f8fa, tarjetas
// blancas de 1px, Manrope, azul #2563eb. Los iconos y los colores de cada
// tipo son los MISMOS que dibuja la tarjeta del tablero: si acá una venta se
// viera de otro color, dos pantallas de los mismos datos dejarían de
// leerse igual.
//
// Lo que esta pantalla hace distinto —y por qué:
//
//   · Agrupa por día. Los datos son una CRONOLOGÍA, no un padrón: el día es
//     la unidad con la que uno piensa ("¿qué pasó el domingo?"). Con el día
//     en el encabezado, cada fila muestra sólo la hora en vez de repetir
//     "14 oct" cuarenta veces en una columna de teléfono.
//   · No pagina. Partir una cronología en páginas de 8 rompe justo lo que se
//     viene a ver. En su lugar "Mostrar más" revela de a tandas: la primera
//     pintada es corta y la secuencia nunca se corta.
//   · No tiene buscador. Las otras pantallas de detalle buscan por nombre;
//     acá no hay nombres que buscar, y un campo que no sirve igual ocupa
//     lugar y hace dudar.
//
// Es SOLO DE LECTURA. Lo único que se puede tocar es un reporte de stock,
// que abre la misma ficha que abre el tablero.
// ════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    AlertCircle, ArrowDown, ArrowUp, ChevronLeft, ClipboardCheck, Download, Pencil,
} from 'lucide-react';
import { C, FUENTE, Tarjeta, Esqueleto } from '../../components/Reportes/PiezasTablero';
import HojaReporteStock from '../../components/Reportes/HojaReporteStock';
import SelectorDeRango, { atajosDeRango } from '../audiencia/SelectorDeRango';
import { rangoDeLaUrl, textoDeRango } from '../../components/Reportes/PlanillaSolicitudes';
import { descargarExcel } from './exportacion';
import {
    getNovedadesCompletas, diaArgentino, horaCorta, fechaYHora,
    type Novedad, type NovedadesCompletas, type TipoDeNovedad,
} from '../../services/reportesPuntoInfo';

// ── Tokens propios de esta pantalla ─────────────────────────────────────

/** Los mismos dos ámbares de la tarjeta del tablero. */
const AMBAR_FONDO = '#fbf0e2';
const AMBAR_TINTA = '#8a5a12';

/**
 * Cuántas filas se dibujan por tanda.
 *
 * Un mes del stand son decenas de novedades y un año, miles. Pintar dos mil
 * filas de una tarda y no sirve: nadie lee la dos mil sin antes leer la
 * veinte. Se muestran 40 —bastante más de lo que entra en una pantalla— y el
 * resto espera a que lo pidan.
 */
const POR_TANDA = 40;

const DIA_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MES_LARGO = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** El día anterior de un 'YYYY-MM-DD', sin pasar por husos. */
const diaAnterior = (dia: string): string => {
    const [a, m, d] = dia.split('-').map(Number);
    return new Date(Date.UTC(a, m - 1, d - 1)).toISOString().slice(0, 10);
};

/**
 * "Hoy · martes 14 de octubre" · "Ayer · lunes 13 de octubre" ·
 * "domingo 5 de octubre" · "domingo 5 de octubre de 2025".
 *
 * El año aparece sólo cuando no es el corriente: en un período de este mes,
 * repetirlo en cada encabezado no agrega nada.
 */
export const tituloDelDia = (dia: string, hoy: string): string => {
    const [a, m, d] = dia.split('-').map(Number);
    // Mediodía UTC para que el día de la semana no se corra por el huso.
    const nombreDia = DIA_SEMANA[new Date(Date.UTC(a, m - 1, d, 12)).getUTCDay()];
    const anio = a === Number(hoy.slice(0, 4)) ? '' : ` de ${a}`;
    const fecha = `${nombreDia} ${d} de ${MES_LARGO[m - 1]}${anio}`;
    if (dia === hoy) return `Hoy · ${fecha}`;
    if (dia === diaAnterior(hoy)) return `Ayer · ${fecha}`;
    return fecha;
};

/** Un día del período con sus novedades, de la más nueva a la más vieja. */
export interface DiaDeNovedades {
    dia: string;
    novedades: Novedad[];
}

/** Las novedades repartidas por día argentino, sin perder el orden. */
export const agruparPorDia = (novedades: Novedad[]): DiaDeNovedades[] => {
    const dias: DiaDeNovedades[] = [];
    novedades.forEach(n => {
        const dia = diaArgentino(n.fecha);
        const ultimo = dias[dias.length - 1];
        if (ultimo && ultimo.dia === dia) ultimo.novedades.push(n);
        else dias.push({ dia, novedades: [n] });
    });
    return dias;
};

// ── Los filtros ─────────────────────────────────────────────────────────

type Filtro = 'todos' | TipoDeNovedad;

/**
 * El orden con el que se leen: primero todo, después lo que más pasa.
 *
 * Son cinco, así que van en una fila que se desliza en el teléfono en vez de
 * una grilla de dos columnas, que con cinco deja la última a medio ancho.
 */
const FILTROS: { clave: Filtro; label: string }[] = [
    { clave: 'todos', label: 'Todo' },
    { clave: 'Salida', label: 'Ventas' },
    { clave: 'Entrada', label: 'Ingresos' },
    { clave: 'Ajuste', label: 'Ediciones' },
    { clave: 'Reporte', label: 'Reportes' },
];

// ── Piezas ──────────────────────────────────────────────────────────────

/** El mismo cuerpo de KPI que las otras dos pantallas de detalle. */
const KpiDeNovedades: React.FC<{ label: string; valor: number; nota: string }> = ({ label, valor, nota }) => (
    <Tarjeta className="p-[14px] md:px-[18px] md:py-4">
        <p className="m-0 text-[12.5px] leading-[1.35] font-semibold" style={{ color: C.apagado }}>{label}</p>
        <p className="mt-2.5 m-0 text-[26px] md:text-[30px] leading-none font-semibold tracking-[-.02em] tabular-nums" style={{ color: C.tinta }}>
            {valor}
        </p>
        <p className="mt-[9px] m-0 text-[12px] leading-[1.45] font-medium" style={{ color: C.apagado }}>{nota}</p>
    </Tarjeta>
);

/** El redondel de cada tipo, igual que en el tablero. */
const iconoDe = (tipo: TipoDeNovedad) => {
    if (tipo === 'Reporte') return { Icono: ClipboardCheck, fondo: '#eaf0fc', tinta: '#1e3a8a' };
    if (tipo === 'Ajuste') return { Icono: Pencil, fondo: AMBAR_FONDO, tinta: AMBAR_TINTA };
    if (tipo === 'Entrada') return { Icono: ArrowDown, fondo: '#f1f2f4', tinta: C.medio };
    return { Icono: ArrowUp, fondo: '#f1f2f4', tinta: C.medio };
};

/**
 * Una fila de la lista.
 *
 * Es un botón sólo cuando hay algo que abrir: un reporte de stock. Un
 * movimiento suelto no lleva a ninguna parte, y dibujarlo como botón sería
 * prometer una ficha que no existe.
 */
const FilaDeNovedad: React.FC<{ n: Novedad; onAbrirReporte: (id: string) => void }> = ({ n, onAbrirReporte }) => {
    const esReporte = n.tipo === 'Reporte';
    const { Icono, fondo, tinta } = iconoDe(n.tipo);
    const Elemento = esReporte ? 'button' : 'div';

    return (
        <Elemento
            data-novedad={n.id}
            {...(esReporte ? {
                type: 'button' as const,
                onClick: () => onAbrirReporte(n.reportId || ''),
                'aria-label': `Ver el reporte de stock de ${fechaYHora(n.fecha)}`,
            } : {})}
            className={`w-full flex items-start gap-3 px-5 py-[11px] text-left ${esReporte ? 'cursor-pointer hover:bg-slate-50' : ''}`}
            style={{ borderTop: `1px solid ${C.bordeSuave}` }}
        >
            <span
                className="w-[30px] h-[30px] rounded-full shrink-0 flex items-center justify-center"
                style={{ background: fondo, color: tinta }}
            >
                <Icono className="w-3.5 h-3.5" />
            </span>
            <div className="flex-1 min-w-0">
                <p className="m-0 text-[13.5px] leading-[1.45] font-medium" style={{ color: C.medio }}>{n.frase}</p>
                {n.detalle && (
                    <p className="mt-0.5 m-0 text-[12px] tabular-nums" style={{ color: C.tenue }}>{n.detalle}</p>
                )}
                {/* Quién lo hizo. Va siempre, también cuando no se sabe: el
                    renglón en blanco se lee como que la pantalla falló. */}
                <p className="mt-0.5 m-0 text-[12px]" style={{ color: C.tenue }}>
                    {n.autor ? `Por ${n.autor}` : 'No quedó registrado quién lo hizo'}
                </p>
            </div>
            {/* El día ya está en el encabezado del grupo: acá va sólo la hora. */}
            <span
                className="shrink-0 text-[12px] font-medium tabular-nums whitespace-nowrap pt-[3px]"
                style={{ color: C.tenue }}
            >
                {horaCorta(n.fecha)}
            </span>
        </Elemento>
    );
};

// ── La pantalla ─────────────────────────────────────────────────────────

const ReportesPuntoInfoNovedades: React.FC = () => {
    const navigate = useNavigate();
    const { search } = useLocation();
    const rango = useMemo(() => rangoDeLaUrl(search), [search]);

    const [datos, setDatos] = useState<NovedadesCompletas | null>(null);
    const [cargando, setCargando] = useState(true);
    const [falla, setFalla] = useState(false);
    const [filtro, setFiltro] = useState<Filtro>('todos');
    const [tandas, setTandas] = useState(1);
    const [reporteAbierto, setReporteAbierto] = useState<string | null>(null);

    const pedir = useCallback(async () => {
        setCargando(true);
        setFalla(false);
        const d = await getNovedadesCompletas(rango);
        if (!d) setFalla(true); else setDatos(d);
        setCargando(false);
    }, [rango]);

    useEffect(() => { pedir(); }, [pedir]);
    // Período nuevo o filtro nuevo, lista desde arriba.
    useEffect(() => { setTandas(1); }, [rango.desde, rango.hasta, filtro]);

    const cambiarRango = (r: typeof rango) =>
        navigate({ search: `?desde=${r.desde}&hasta=${r.hasta}` }, { replace: true });

    const volver = () =>
        navigate({ pathname: '/reportes/puntoinfo', search: `?desde=${rango.desde}&hasta=${rango.hasta}` });

    const atajos = useMemo(() => atajosDeRango([new Date().getFullYear()]), []);

    const todas = datos?.novedades ?? [];
    const cuentaPorTipo = useMemo(() => {
        const c = new Map<Filtro, number>([['todos', todas.length]]);
        todas.forEach(n => c.set(n.tipo, (c.get(n.tipo) || 0) + 1));
        return c;
    }, [todas]);

    const filtradas = useMemo(
        () => (filtro === 'todos' ? todas : todas.filter(n => n.tipo === filtro)),
        [todas, filtro],
    );

    const tope = tandas * POR_TANDA;
    const visibles = filtradas.slice(0, tope);
    const faltan = filtradas.length - visibles.length;
    const porDia = useMemo(() => agruparPorDia(visibles), [visibles]);
    const hoy = useMemo(() => diaArgentino(new Date()), []);

    /** Los días que el calendario de arriba marca con un punto. */
    const diasConMovimiento = useMemo(() => {
        const dias = new Map<string, number>();
        todas.forEach(n => {
            const dia = diaArgentino(n.fecha);
            if (dia) dias.set(dia, (dias.get(dia) || 0) + 1);
        });
        return dias;
    }, [todas]);

    const bajarExcel = () => {
        if (filtradas.length === 0) return;
        descargarExcel(
            [{
                nombre: 'Novedades',
                filas: filtradas.map(n => ({
                    'FECHA Y HORA': fechaYHora(n.fecha),
                    'TIPO': n.tipo,
                    'NOVEDAD': n.frase,
                    'DETALLE': n.detalle || '',
                    'QUIÉN': n.autor || '',
                })),
            }],
            `Reportes-Punto-Novedades-${rango.desde}-a-${rango.hasta}.xlsx`,
        );
    };

    const t = datos?.totales;

    // ── Estados ─────────────────────────────────────────────────────────
    const EsqueletoNovedades = () => (
        <div aria-busy="true" className="mt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[0, 1, 2, 3].map(i => (
                    <Tarjeta key={i} className="p-[14px] md:px-[18px] md:py-4">
                        <Esqueleto alto={12} ancho="70%" />
                        <div className="mt-3"><Esqueleto alto={26} ancho="36%" /></div>
                        <div className="mt-3"><Esqueleto alto={11} ancho="60%" /></div>
                    </Tarjeta>
                ))}
            </div>
            <Tarjeta className="mt-5 px-5 py-[18px]">
                <Esqueleto alto={14} ancho="190px" />
                <div className="mt-4"><Esqueleto alto={38} /></div>
                <div className="mt-4 flex flex-col gap-2.5">
                    {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <Esqueleto key={i} alto={40} />)}
                </div>
            </Tarjeta>
        </div>
    );

    const nombreDelFiltro = FILTROS.find(f => f.clave === filtro)?.label.toLowerCase();

    return (
        <div className="min-h-screen" style={{ background: C.fondo, fontFamily: FUENTE }}>
            <div className="mx-auto max-w-[1240px] px-4 pt-[18px] pb-10 md:px-10 md:pt-[30px] md:pb-14">

                {/* ── Encabezado ── */}
                <div className="flex flex-wrap items-end justify-between gap-y-3.5 gap-x-6">
                    <div className="min-w-0 flex-1 basis-[300px]">
                        <button
                            type="button"
                            onClick={volver}
                            className="inline-flex items-center gap-1.5 min-h-9 text-[13px] font-semibold"
                            style={{ color: C.medio }}
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Reportes de Punto de Información
                        </button>
                        <h1 className="mt-1.5 m-0 text-[23px] md:text-[28px] leading-[1.15] font-semibold tracking-[-.02em]" style={{ color: C.tinta }}>
                            Novedades
                        </h1>
                        <p className="mt-1.5 m-0 text-[13.5px] font-medium" style={{ color: C.apagado }}>
                            {textoDeRango(rango)}
                        </p>
                    </div>
                    <div className="w-full md:w-auto md:min-w-[230px]">
                        <SelectorDeRango
                            valor={rango}
                            onCambiar={cambiarRango}
                            serviciosPorDia={diasConMovimiento}
                            atajos={atajos}
                        />
                    </div>
                </div>

                {falla ? (
                    <Tarjeta className="mt-6 px-6 py-11 flex flex-col items-center text-center">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#fdecea' }}>
                            <AlertCircle className="w-[22px] h-[22px]" style={{ color: '#b42318' }} />
                        </div>
                        <p className="mt-4 m-0 text-[16px] font-semibold" style={{ color: C.tinta }}>No pudimos cargar las novedades</p>
                        <p className="mt-2 m-0 max-w-[380px] text-[13px] leading-[1.6]" style={{ color: C.apagado }}>
                            Revisá tu conexión e intentá de nuevo. No se perdió nada: esta pantalla sólo lee.
                        </p>
                        <button
                            type="button"
                            onClick={pedir}
                            className="h-11 px-5 mt-[18px] rounded-[10px] text-sm font-semibold"
                            style={{ background: C.tinta, color: '#fff' }}
                        >
                            Reintentar
                        </button>
                    </Tarjeta>
                ) : cargando && !datos ? (
                    <EsqueletoNovedades />
                ) : (
                    <>
                        {/* ── Lo que se movió en el período ── */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                            <KpiDeNovedades
                                label="Unidades que ingresaron"
                                valor={t?.unidadesIngresadas ?? 0}
                                nota={t?.ingresos === 1 ? 'En 1 ingreso' : `En ${t?.ingresos ?? 0} ingresos`}
                            />
                            <KpiDeNovedades
                                label="Unidades que se vendieron"
                                valor={t?.unidadesVendidas ?? 0}
                                nota={t?.ventas === 1 ? 'En 1 venta' : `En ${t?.ventas ?? 0} ventas`}
                            />
                            <KpiDeNovedades
                                label="Ediciones de stock"
                                valor={t?.ediciones ?? 0}
                                nota="Correcciones hechas a mano"
                            />
                            <KpiDeNovedades
                                label="Reportes de stock"
                                valor={t?.reportes ?? 0}
                                nota="Conteos del stand"
                            />
                        </div>

                        {/* ── La lista ── */}
                        <Tarjeta className="mt-5 overflow-hidden">
                            <div className="px-5 pt-[18px] pb-4">
                                <p className="m-0 text-[15px] font-semibold" style={{ color: C.tinta }}>
                                    Todo lo que pasó, en orden
                                </p>
                                <p className="mt-1 m-0 text-[12.5px]" style={{ color: C.tenue }}>
                                    De lo más nuevo a lo más viejo · {textoDeRango(rango)}
                                </p>

                                <div className="flex flex-wrap items-center gap-2.5 mt-3.5">
                                    {/* Cinco filtros no entran en el ancho de un teléfono:
                                        la fila se desliza y el quinto asoma, que avisa que
                                        hay más. Para que ese asomo se lea como "seguí para
                                        el costado" y no como un corte, los chips se quedan
                                        con el ancho entero y el Excel baja. */}
                                    <div
                                        role="tablist"
                                        aria-label="Filtrar por tipo"
                                        className="flex items-center gap-1.5 w-full md:w-auto md:flex-1 min-w-0 overflow-x-auto scrollbar-hide"
                                    >
                                        {FILTROS.map(f => {
                                            const activa = filtro === f.clave;
                                            return (
                                                <button
                                                    key={f.clave}
                                                    type="button"
                                                    role="tab"
                                                    aria-selected={activa}
                                                    onClick={() => setFiltro(f.clave)}
                                                    className="h-11 md:h-[38px] px-3 shrink-0 rounded-[10px] flex items-center justify-center gap-[7px] text-[13px] font-semibold whitespace-nowrap"
                                                    style={{ background: activa ? C.tinta : '#f1f2f4', color: activa ? '#fff' : C.medio }}
                                                >
                                                    {f.label}
                                                    <span
                                                        className="text-[12px] font-semibold tabular-nums"
                                                        style={{ color: activa ? 'rgba(255,255,255,.7)' : C.apagado }}
                                                    >
                                                        {cuentaPorTipo.get(f.clave) || 0}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={bajarExcel}
                                        disabled={filtradas.length === 0}
                                        aria-label="Descargar en Excel"
                                        className="h-11 md:h-[38px] px-3.5 shrink-0 ml-auto md:ml-0 rounded-[10px] inline-flex items-center gap-2 text-[13px] font-semibold disabled:opacity-40"
                                        style={{ background: '#fff', border: `1px solid ${C.borde}`, color: C.medio }}
                                    >
                                        <Download className="w-[15px] h-[15px]" />
                                        Excel
                                    </button>
                                </div>
                            </div>

                            {porDia.length > 0 ? (
                                <>
                                    {porDia.map(d => (
                                        <div key={d.dia}>
                                            {/* El encabezado del día dice QUÉ día y CUÁNTO
                                                pasó: por eso cada fila de abajo puede
                                                mostrar sólo la hora. */}
                                            <div
                                                className="flex items-baseline justify-between gap-3 px-5 py-2"
                                                style={{
                                                    background: C.fondo,
                                                    borderTop: `1px solid ${C.bordeSuave}`,
                                                    borderBottom: `1px solid ${C.bordeSuave}`,
                                                }}
                                            >
                                                <h2 className="m-0 text-[12.5px] font-semibold" style={{ color: C.medio }}>
                                                    {tituloDelDia(d.dia, hoy)}
                                                </h2>
                                                <span className="shrink-0 text-[12px] font-medium tabular-nums" style={{ color: C.tenue }}>
                                                    {d.novedades.length === 1 ? '1 novedad' : `${d.novedades.length} novedades`}
                                                </span>
                                            </div>
                                            {d.novedades.map(n => (
                                                <FilaDeNovedad
                                                    key={n.id}
                                                    n={n}
                                                    onAbrirReporte={id => setReporteAbierto(id || null)}
                                                />
                                            ))}
                                        </div>
                                    ))}

                                    <div
                                        data-pie
                                        className="flex items-center justify-between gap-2.5 pl-5 pr-4 py-2.5"
                                        style={{ borderTop: `1px solid ${C.bordeSuave}`, background: '#fcfcfd' }}
                                    >
                                        <span className="text-[12.5px] tabular-nums" style={{ color: C.apagado }}>
                                            {faltan > 0
                                                ? `${visibles.length} de ${filtradas.length}`
                                                : `${filtradas.length} ${filtradas.length === 1 ? 'novedad' : 'novedades'}`}
                                        </span>
                                        {faltan > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setTandas(n => n + 1)}
                                                className="h-11 md:h-[38px] px-3.5 rounded-[10px] text-[13px] font-semibold"
                                                style={{ background: '#fff', border: `1px solid ${C.borde}`, color: C.tinta }}
                                            >
                                                Mostrar {Math.min(faltan, POR_TANDA)} más
                                            </button>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="mx-5 mb-[18px] px-5 py-[34px] rounded-xl flex flex-col items-center text-center" style={{ background: C.fondo }}>
                                    <p className="m-0 text-[15px] font-semibold" style={{ color: C.medio }}>
                                        {filtro === 'todos'
                                            ? 'No hubo movimientos en este período.'
                                            : `No hubo ${nombreDelFiltro} en este período.`}
                                    </p>
                                    <p className="mt-1.5 m-0 max-w-[360px] text-[13px] leading-[1.55]" style={{ color: C.apagado }}>
                                        {filtro === 'todos'
                                            ? 'Elegí otro período en el calendario de arriba.'
                                            : 'Probá con otro tipo o con otro período.'}
                                    </p>
                                    {filtro !== 'todos' && todas.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setFiltro('todos')}
                                            className="h-11 px-[18px] mt-3.5 rounded-[10px] text-[13.5px] font-semibold"
                                            style={{ background: '#fff', border: `1px solid ${C.borde}`, color: C.tinta }}
                                        >
                                            Ver todo
                                        </button>
                                    )}
                                </div>
                            )}

                            <p className="m-0 px-5 pt-3 pb-3.5 text-[12px] leading-[1.5]" style={{ borderTop: `1px solid ${C.bordeSuave}`, color: C.apagado }}>
                                Un reporte de stock entra como una sola novedad: tocalo para
                                ver qué se contó talle por talle. Es solo de lectura.
                            </p>
                        </Tarjeta>
                    </>
                )}
            </div>

            {/* La misma ficha que abre la tarjeta del tablero. */}
            <HojaReporteStock reporteId={reporteAbierto} onCerrar={() => setReporteAbierto(null)} />
        </div>
    );
};

export default ReportesPuntoInfoNovedades;
