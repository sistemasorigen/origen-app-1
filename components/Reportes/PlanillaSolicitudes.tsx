import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronLeft, ChevronRight, Download, Phone, Search, X } from 'lucide-react';
import { C, FUENTE, Tarjeta, Esqueleto } from './PiezasTablero';
import HojaDetalle, { CamposDeFicha, CampoDeFicha } from './HojaDetalle';
import SelectorDeRango, { Rango, atajosDeRango } from '../../pages/audiencia/SelectorDeRango';
import { descargarExcel } from '../../pages/reportes/exportacion';
import {
    getDetalle, telParaLlamar, telParaWhatsApp, diaArgentino, fechaCorta,
    Detalle, FilaDeDetalle, EstadoDeSolicitud, TipoDeSolicitud,
} from '../../services/reportesPuntoInfo';

/**
 * La planilla de solicitudes de las dos pantallas de detalle de Reportes del
 * Punto: bautismos y presentación de niños.
 *
 * Las dos maquetas —"Reportes Punto de Informacion - Bautismos.dc.html" y
 * "- Presentaciones.dc.html"— son el MISMO archivo con una línea distinta
 * (`PANTALLA = 'bautismos'` / `'presentaciones'`). Así que acá vive la
 * pantalla entera y cada página sólo trae su definición: qué columnas tiene
 * la tabla, qué campos muestra la ficha, por dónde busca y cómo se llaman
 * las cosas.
 *
 * Es SOLO DE LECTURA. Ningún botón de esta pantalla cambia el estado de una
 * solicitud: eso se hace desde el panel del Punto.
 */

// ── Lo que define cada pantalla ─────────────────────────────────────────

export type Celda =
    | { tipo: 'texto'; txt: string; sub?: string; fuerte?: boolean; tenue?: boolean }
    | { tipo: 'pastilla'; estado: EstadoDeSolicitud };

export interface ColumnaPlanilla {
    titulo: string;
    /** Su parte en el grid de la tabla: 'minmax(0,1.1fr)' o '104px'. */
    ancho: string;
    celda: (f: FilaDeDetalle) => Celda;
}

export interface DefinicionPlanilla {
    tipo: TipoDeSolicitud;
    /** El título de la pantalla. */
    titulo: string;
    /** "Bautismos" / "Presentaciones": arma los dos KPIs. */
    sustantivo: string;
    /** "Solicitud de bautismo": el rótulo de arriba de la ficha. */
    subFicha: string;
    /** El nombre que encabeza la fila del teléfono y la ficha. */
    nombreDe: (f: FilaDeDetalle) => string;
    columnas: ColumnaPlanilla[];
    campos: (f: FilaDeDetalle) => CampoDeFicha[];
    /** Los textos por los que busca el buscador. El teléfono lo agrega esta pieza. */
    buscarEn: (f: FilaDeDetalle) => (string | null)[];
    buscarPh: string;
    excel: (f: FilaDeDetalle) => Record<string, string | number>;
    /** "Bautismos", para el nombre del archivo. */
    archivo: string;
    /** "No hubo bautismos realizados en este período." */
    sinRealizados: string;
    /** La nota del pie. */
    nota: string;
}

// ── Piezas chicas ───────────────────────────────────────────────────────

const POR_PAGINA = 8;
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const dos = (n: number) => String(n).padStart(2, '0');
const isoDeHoy = () => { const d = new Date(); return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`; };

/** Los colores de cada estado, los mismos del tablero. */
export const PASTILLA: Record<EstadoDeSolicitud, { fondo: string; tinta: string }> = {
    Pendiente: { fondo: '#fbf0e2', tinta: '#8a5a12' },
    Realizado: { fondo: '#eaf0fc', tinta: '#1e3a8a' },
    Cancelado: { fondo: '#f1f2f4', tinta: '#4b5563' },
};

/** El período que viene en la URL. Sin él, del 1 del mes a hoy. */
export const rangoDeLaUrl = (search: string): Rango => {
    const q = new URLSearchParams(search);
    const desde = q.get('desde');
    const hasta = q.get('hasta');
    if (desde && hasta && ES_FECHA.test(desde) && ES_FECHA.test(hasta) && desde <= hasta) return { desde, hasta };
    const hoy = isoDeHoy();
    return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
};

/**
 * "8 nov 2026", para los campos que pueden venir SIN hora.
 *
 * `presentations.scheduledDate` es una columna `date`: llega como
 * '2026-11-08' pelado, y eso parseado como instante es medianoche UTC, que en
 * Argentina es el día ANTERIOR. Por eso un día suelto se escribe a mano y
 * sólo lo que trae hora pasa por el formateador del servicio. La fecha de
 * realización de una presentación cae acá por lo mismo: cuando no hay
 * completionDate, vale el día agendado.
 */
export const fechaDeDia = (valor: string | null | undefined): string => {
    if (!valor) return '—';
    if (ES_FECHA.test(valor)) {
        const [a, m, d] = valor.split('-');
        return `${Number(d)} ${MES[Number(m) - 1]} ${a}`;
    }
    return fechaCorta(valor) || '—';
};

/** "1 oct – 14 oct 2026". El año de la izquierda sólo si cambia. */
export const textoDeRango = ({ desde, hasta }: Rango) => {
    const diaMes = (iso: string) => `${Number(iso.slice(8, 10))} ${MES[Number(iso.slice(5, 7)) - 1]}`;
    const fin = `${diaMes(hasta)} ${hasta.slice(0, 4)}`;
    if (desde === hasta) return fin;
    const mismoAnio = desde.slice(0, 4) === hasta.slice(0, 4);
    return `${diaMes(desde)}${mismoAnio ? '' : ` ${desde.slice(0, 4)}`} – ${fin}`;
};

/**
 * La tabla y la lista son dos cosas distintas, no la misma con otro ancho:
 * se monta una sola. (El mismo criterio y el mismo hook del tablero.)
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

/** Sin acentos y en minúscula: así busca cualquiera que escribe apurado. */
const normalizar = (s: string | null | undefined) =>
    String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const KpiDeDetalle: React.FC<{ label: string; valor: number; nota: string }> = ({ label, valor, nota }) => (
    <Tarjeta className="p-[14px] md:px-[18px] md:py-4">
        <p className="m-0 text-[12.5px] leading-[1.35] font-semibold" style={{ color: C.apagado }}>{label}</p>
        <p className="mt-2.5 m-0 text-[26px] md:text-[30px] leading-none font-semibold tracking-[-.02em] tabular-nums" style={{ color: C.tinta }}>
            {valor}
        </p>
        <p className="mt-[9px] m-0 text-[12px] leading-[1.45] font-medium" style={{ color: C.apagado }}>{nota}</p>
    </Tarjeta>
);

const Pastilla: React.FC<{ estado: EstadoDeSolicitud; className?: string }> = ({ estado, className = '' }) => (
    <span
        className={`inline-flex items-center h-6 px-2.5 rounded-full text-[12px] font-semibold whitespace-nowrap ${className}`}
        style={{ background: PASTILLA[estado].fondo, color: PASTILLA[estado].tinta }}
    >
        {estado}
    </span>
);

const CeldaDeTabla: React.FC<{ celda: Celda }> = ({ celda }) => {
    if (celda.tipo === 'pastilla') return <Pastilla estado={celda.estado} />;
    return (
        <div className="min-w-0">
            <p
                className="m-0 text-[13px] truncate"
                style={{ fontWeight: celda.fuerte ? 600 : 500, color: celda.fuerte ? C.tinta : celda.tenue ? C.apagado : C.medio }}
            >
                {celda.txt}
            </p>
            {celda.sub && <p className="mt-0.5 m-0 text-[12px]" style={{ color: C.tenue }}>{celda.sub}</p>}
        </div>
    );
};

// ── La pantalla ─────────────────────────────────────────────────────────

const PlanillaSolicitudes: React.FC<{ def: DefinicionPlanilla }> = ({ def }) => {
    const navigate = useNavigate();
    const { search } = useLocation();
    const rango = useMemo(() => rangoDeLaUrl(search), [search]);
    const esMovil = useEsMovil();

    const [detalle, setDetalle] = useState<Detalle | null>(null);
    const [cargando, setCargando] = useState(true);
    const [falla, setFalla] = useState(false);
    const [tab, setTab] = useState<'todos' | EstadoDeSolicitud>('todos');
    const [consulta, setConsulta] = useState('');
    const [pagina, setPagina] = useState(0);
    const [abierto, setAbierto] = useState<string | null>(null);

    const pedir = useCallback(async () => {
        setCargando(true);
        setFalla(false);
        const datos = await getDetalle(def.tipo, rango);
        if (!datos) setFalla(true);
        else setDetalle(datos);
        setCargando(false);
    }, [def.tipo, rango]);

    useEffect(() => { pedir(); }, [pedir]);
    // Período nuevo, planilla desde la primera página.
    useEffect(() => { setPagina(0); }, [rango.desde, rango.hasta]);

    const cambiarRango = (r: Rango) =>
        navigate({ search: `?desde=${r.desde}&hasta=${r.hasta}` }, { replace: true });

    const volver = () =>
        navigate({ pathname: '/reportes/puntoinfo', search: `?desde=${rango.desde}&hasta=${rango.hasta}` });

    const atajos = useMemo(() => atajosDeRango([new Date().getFullYear()]), []);

    const base = detalle?.filas ?? [];

    /** Los días que el calendario marca con un punto. */
    const diasConSolicitudes = useMemo(() => {
        const dias = new Map<string, number>();
        const sumar = (fecha: string | null) => {
            if (!fecha) return;
            const dia = diaArgentino(fecha);
            if (dia) dias.set(dia, (dias.get(dia) || 0) + 1);
        };
        base.forEach(f => { sumar(f.solicitud); sumar(f.realizacion); });
        return dias;
    }, [base]);

    // ── Pestañas, búsqueda y paginado ───────────────────────────────────
    const q = normalizar(consulta.trim());
    const digitos = consulta.replace(/\D/g, '');

    const coincide = useCallback((f: FilaDeDetalle) => {
        if (!q) return true;
        if (def.buscarEn(f).some(campo => normalizar(campo).includes(q))) return true;
        // Con tres dígitos ya es una búsqueda por teléfono y no un nombre.
        return digitos.length >= 3 && (f.telefono || '').replace(/\D/g, '').includes(digitos);
    }, [def, q, digitos]);

    const porTab = useMemo(
        () => base.filter(f => tab === 'todos' || f.estado === tab).filter(coincide),
        [base, tab, coincide],
    );

    const paginas = Math.max(1, Math.ceil(porTab.length / POR_PAGINA));
    const pag = Math.min(pagina, paginas - 1);
    const visibles = porTab.slice(pag * POR_PAGINA, pag * POR_PAGINA + POR_PAGINA);

    const pestanas: { clave: 'todos' | EstadoDeSolicitud; label: string; n: number }[] = [
        { clave: 'todos', label: 'Todos', n: base.length },
        { clave: 'Pendiente', label: 'Pendientes', n: base.filter(f => f.estado === 'Pendiente').length },
        { clave: 'Realizado', label: 'Realizados', n: base.filter(f => f.estado === 'Realizado').length },
        { clave: 'Cancelado', label: 'Cancelados', n: base.filter(f => f.estado === 'Cancelado').length },
    ];

    const bajarExcel = () => {
        if (porTab.length === 0) return;
        descargarExcel(
            [{ nombre: def.archivo, filas: porTab.map(def.excel) }],
            `Reportes-Punto-${def.archivo}-${rango.desde}-a-${rango.hasta}.xlsx`,
        );
    };

    const ficha = abierto ? base.find(f => f.id === abierto) || null : null;
    const telLlamar = ficha ? telParaLlamar(ficha.telefono) : null;
    const telWhatsApp = ficha ? telParaWhatsApp(ficha.telefono) : null;

    const grid = def.columnas.map(c => c.ancho).join(' ');

    // ── Estados ─────────────────────────────────────────────────────────
    const EsqueletoPlanilla = () => (
        <div aria-busy="true" className="mt-6">
            <div className="grid grid-cols-2 gap-3">
                {[0, 1].map(i => (
                    <Tarjeta key={i} className="p-[14px] md:px-[18px] md:py-4">
                        <Esqueleto alto={12} ancho="70%" />
                        <div className="mt-3"><Esqueleto alto={26} ancho="36%" /></div>
                        <div className="mt-3"><Esqueleto alto={11} ancho="60%" /></div>
                    </Tarjeta>
                ))}
            </div>
            <Tarjeta className="mt-5 px-5 py-[18px]">
                <Esqueleto alto={14} ancho="180px" />
                <div className="mt-4"><Esqueleto alto={44} /></div>
                <div className="mt-2.5 flex flex-col gap-2.5">
                    {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <Esqueleto key={i} alto={40} />)}
                </div>
            </Tarjeta>
        </div>
    );

    const vacioTitulo = consulta.trim()
        ? `Ninguna solicitud coincide con “${consulta.trim()}”`
        : tab === 'Realizado'
            ? def.sinRealizados
            : 'No hay solicitudes en este período.';
    const vacioTexto = consulta.trim()
        ? 'Probá con otro nombre o con parte del teléfono.'
        : 'Elegí otro período en el calendario de arriba.';

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
                            {def.titulo}
                        </h1>
                        <p className="mt-1.5 m-0 text-[13.5px] font-medium" style={{ color: C.apagado }}>
                            {textoDeRango(rango)}
                        </p>
                    </div>
                    <div className="w-full md:w-auto md:min-w-[230px]">
                        <SelectorDeRango
                            valor={rango}
                            onCambiar={cambiarRango}
                            serviciosPorDia={diasConSolicitudes}
                            atajos={atajos}
                        />
                    </div>
                </div>

                {falla ? (
                    <Tarjeta className="mt-6 px-6 py-11 flex flex-col items-center text-center">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#fdecea' }}>
                            <AlertCircle className="w-[22px] h-[22px]" style={{ color: '#b42318' }} />
                        </div>
                        <p className="mt-4 m-0 text-[16px] font-semibold" style={{ color: C.tinta }}>No pudimos cargar las solicitudes</p>
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
                ) : cargando && !detalle ? (
                    <EsqueletoPlanilla />
                ) : (
                    <>
                        {/* ── Dos KPIs ── */}
                        <div className="grid grid-cols-2 gap-3 mt-6">
                            <KpiDeDetalle
                                label={`${def.sustantivo} realizados`}
                                valor={detalle?.realizadosEnPeriodo ?? 0}
                                nota="En el período elegido"
                            />
                            <KpiDeDetalle
                                label={`${def.sustantivo} pendientes`}
                                valor={detalle?.pendientesHoy ?? 0}
                                nota="No depende del período"
                            />
                        </div>

                        {/* ── La planilla ── */}
                        <Tarjeta className="mt-5 overflow-hidden">
                            <div className="px-5 pt-[18px] pb-4">
                                <p className="m-0 text-[15px] font-semibold" style={{ color: C.tinta }}>Todas las solicitudes</p>
                                <p className="mt-1 m-0 text-[12.5px]" style={{ color: C.tenue }}>
                                    {textoDeRango(rango)} · más los pendientes de hoy
                                </p>

                                <div className="flex flex-wrap items-center gap-2.5 mt-3.5">
                                    <div role="tablist" aria-label="Filtrar por estado" className="grid grid-cols-2 gap-1.5 w-full md:flex md:flex-wrap md:w-auto">
                                        {pestanas.map(p => {
                                            const activa = tab === p.clave;
                                            return (
                                                <button
                                                    key={p.clave}
                                                    type="button"
                                                    role="tab"
                                                    aria-selected={activa}
                                                    onClick={() => { setTab(p.clave); setPagina(0); }}
                                                    className="h-11 md:h-[38px] px-3 rounded-[10px] flex items-center justify-center gap-[7px] text-[13px] font-semibold whitespace-nowrap"
                                                    style={{ background: activa ? C.tinta : '#f1f2f4', color: activa ? '#fff' : C.medio }}
                                                >
                                                    {p.label}
                                                    <span className="text-[12px] font-semibold tabular-nums" style={{ color: activa ? 'rgba(255,255,255,.7)' : C.apagado }}>
                                                        {p.n}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div
                                        className="flex items-center gap-2 h-11 md:h-[38px] pl-3 pr-2 rounded-[10px] min-w-0 flex-1 md:flex-[1_1_240px]"
                                        style={{ background: '#fff', border: `1px solid ${C.borde}` }}
                                    >
                                        <Search className="w-4 h-4 shrink-0" style={{ color: C.tenue }} />
                                        <input
                                            type="search"
                                            value={consulta}
                                            onChange={e => { setConsulta(e.target.value); setPagina(0); }}
                                            placeholder={def.buscarPh}
                                            aria-label="Buscar"
                                            className="flex-1 min-w-0 h-full bg-transparent border-0 outline-none text-sm"
                                            style={{ color: C.tinta }}
                                        />
                                        {consulta.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => { setConsulta(''); setPagina(0); }}
                                                aria-label="Limpiar la búsqueda"
                                                className="w-[30px] h-[30px] shrink-0 rounded-lg flex items-center justify-center"
                                                style={{ background: '#f1f2f4', color: C.medio }}
                                            >
                                                <X className="w-3 h-3" strokeWidth={2.6} />
                                            </button>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={bajarExcel}
                                        disabled={porTab.length === 0}
                                        aria-label="Descargar en Excel"
                                        className="h-11 md:h-[38px] px-3.5 rounded-[10px] inline-flex items-center gap-2 text-[13px] font-semibold disabled:opacity-40"
                                        style={{ background: '#fff', border: `1px solid ${C.borde}`, color: C.medio }}
                                    >
                                        <Download className="w-[15px] h-[15px]" />
                                        Excel
                                    </button>
                                </div>
                            </div>

                            {porTab.length > 0 ? (
                                <>
                                    {!esMovil && (
                                        <>
                                            <div
                                                className="grid gap-3 px-5 py-2.5"
                                                style={{ gridTemplateColumns: grid, background: C.fondo, borderTop: `1px solid ${C.bordeSuave}`, borderBottom: `1px solid ${C.bordeSuave}` }}
                                            >
                                                {def.columnas.map(c => (
                                                    <span key={c.titulo} className="text-[11px] font-semibold tracking-[.04em] truncate" style={{ color: C.apagado }}>
                                                        {c.titulo}
                                                    </span>
                                                ))}
                                            </div>
                                            {visibles.map(f => (
                                                <div
                                                    key={f.id}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => setAbierto(f.id)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAbierto(f.id); }
                                                    }}
                                                    aria-label={`Ver la ficha de ${def.nombreDe(f)}`}
                                                    className="grid gap-3 items-center px-5 py-[11px] cursor-pointer hover:bg-slate-50"
                                                    style={{ gridTemplateColumns: grid, borderBottom: `1px solid #f2f3f5` }}
                                                >
                                                    {def.columnas.map(c => <CeldaDeTabla key={c.titulo} celda={c.celda(f)} />)}
                                                </div>
                                            ))}
                                        </>
                                    )}

                                    {esMovil && visibles.map(f => (
                                        <div
                                            key={f.id}
                                            className="flex items-center gap-3 pl-5 pr-4 py-3"
                                            style={{ borderTop: `1px solid ${C.bordeSuave}` }}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="m-0 text-[14.5px] font-semibold truncate" style={{ color: C.tinta }}>
                                                    {def.nombreDe(f)}
                                                </p>
                                                <Pastilla estado={f.estado} className="mt-1.5" />
                                            </div>
                                            {/* El rótulo dice de quién es: en una lista, ocho
                                                "Ver detalles" idénticos no le sirven a nadie que
                                                navegue por teclado o con lector de pantalla. */}
                                            <button
                                                type="button"
                                                onClick={() => setAbierto(f.id)}
                                                aria-label={`Ver la ficha de ${def.nombreDe(f)}`}
                                                className="shrink-0 h-11 px-3.5 rounded-[10px] text-[13px] font-semibold"
                                                style={{ background: '#fff', border: `1px solid ${C.borde}`, color: C.tinta }}
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
                                            {pag * POR_PAGINA + 1}–{pag * POR_PAGINA + visibles.length} de {porTab.length}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => setPagina(p => Math.max(0, p - 1))}
                                                disabled={pag === 0}
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
                                                    onClick={() => setPagina(i)}
                                                    aria-label={`Página ${i + 1}`}
                                                    aria-current={i === pag ? 'page' : undefined}
                                                    className="min-w-[38px] h-[38px] px-2 rounded-[10px] text-[13px] font-semibold tabular-nums"
                                                    style={i === pag
                                                        ? { background: C.tinta, border: `1px solid ${C.tinta}`, color: '#fff' }
                                                        : { background: '#fff', border: `1px solid ${C.borde}`, color: C.medio }}
                                                >
                                                    {i + 1}
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => setPagina(p => Math.min(paginas - 1, p + 1))}
                                                disabled={pag >= paginas - 1}
                                                aria-label="Página siguiente"
                                                className="w-11 h-11 md:w-[38px] md:h-[38px] rounded-[10px] flex items-center justify-center disabled:opacity-40"
                                                style={{ background: '#fff', border: `1px solid ${C.borde}`, color: C.medio }}
                                            >
                                                <ChevronRight className="w-[15px] h-[15px]" />
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="mx-5 mb-[18px] px-5 py-[34px] rounded-xl flex flex-col items-center text-center" style={{ background: C.fondo }}>
                                    <p className="m-0 text-[15px] font-semibold" style={{ color: C.medio }}>{vacioTitulo}</p>
                                    <p className="mt-1.5 m-0 max-w-[360px] text-[13px] leading-[1.55]" style={{ color: C.apagado }}>{vacioTexto}</p>
                                    {consulta.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => { setConsulta(''); setPagina(0); }}
                                            className="h-11 px-[18px] mt-3.5 rounded-[10px] text-[13.5px] font-semibold"
                                            style={{ background: '#fff', border: `1px solid ${C.borde}`, color: C.tinta }}
                                        >
                                            Limpiar la búsqueda
                                        </button>
                                    )}
                                </div>
                            )}

                            <p className="m-0 px-5 pt-3 pb-3.5 text-[12px] leading-[1.5]" style={{ borderTop: `1px solid ${C.bordeSuave}`, color: C.apagado }}>
                                {def.nota}
                            </p>
                        </Tarjeta>
                    </>
                )}
            </div>

            {/* ── La ficha ── */}
            <HojaDetalle
                abierta={!!ficha}
                onCerrar={() => setAbierto(null)}
                sub={def.subFicha}
                titulo={ficha ? def.nombreDe(ficha) : ''}
            >
                {ficha && (
                    <>
                        <CamposDeFicha campos={def.campos(ficha)} />
                        {(telLlamar || telWhatsApp) && (
                            <div className={`grid gap-2.5 mt-4 ${telLlamar && telWhatsApp ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                {telLlamar && (
                                    <a
                                        href={telLlamar}
                                        className="h-12 rounded-[10px] flex items-center justify-center gap-2 text-[14.5px] font-semibold"
                                        style={{ background: C.tinta, color: '#fff' }}
                                    >
                                        <Phone className="w-4 h-4" />
                                        Llamar
                                    </a>
                                )}
                                {telWhatsApp && (
                                    <a
                                        href={telWhatsApp}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="h-12 rounded-[10px] flex items-center justify-center gap-2 text-[14.5px] font-semibold"
                                        style={{ background: '#f1f2f4', color: C.tinta }}
                                    >
                                        WhatsApp
                                    </a>
                                )}
                            </div>
                        )}
                    </>
                )}
            </HojaDetalle>
        </div>
    );
};

export default PlanillaSolicitudes;
