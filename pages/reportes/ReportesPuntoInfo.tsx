// ════════════════════════════════════════════════════════════════════════
// /reportes/puntoinfo — tablero de Punto de Información.
//
// Implementa design-claude/Reportes Punto de Informacion.dc.html. El
// inventario de lo que dibuja, pieza por pieza, está en
// design-claude/INVENTARIO-REPORTES-PUNTO.md.
//
// Los números salen SIEMPRE de services/reportesPuntoInfo.ts: la maqueta
// inventa movimientos, bautismos y presentaciones que no existen.
//
// Dos cosas que el diseño separa a propósito:
//   · Los KPIs son el estado de HOY y no se tocan al cambiar el período:
//     se piden una sola vez al entrar.
//   · Todo lo demás es del período, y se vuelve a pedir cuando cambia.
//
// El período vive en la URL (?desde&hasta): recargar lo conserva y las dos
// pantallas de detalle lo heredan.
// ════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, LabelList,
} from 'recharts';
import { ChevronLeft, ArrowDown, ArrowUp, Pencil, Download, AlertCircle, ClipboardCheck } from 'lucide-react';
import {
    C, FUENTE, EjeCategoria, Tarjeta, Esqueleto,
} from '../../components/Reportes/PiezasTablero';
import SelectorDeRango, { Rango, atajosDeRango } from '../audiencia/SelectorDeRango';
import { descargarExcel } from './exportacion';
import ReportesDeStock from './ReportesDeStock';
import HojaReporteStock from '../../components/Reportes/HojaReporteStock';
import {
    getNovedades, getKpisPuntoInfo, getInventarioPuntoInfo, getPendientes, getDiasConMovimiento,
    fechaYHora, telParaLlamar,
    Novedad, KpisPuntoInfo, InventarioDelPunto, Pendientes, FilaDeTalle, ClaseDeProducto,
} from '../../services/reportesPuntoInfo';

// ── Tokens que el .dc usa y PiezasTablero no tiene ──────────────────────
/** El talle que está por debajo del mínimo. */
const AMBAR = '#e5ad5c';
const AMBAR_TINTA = '#8a5a12';
const AMBAR_FONDO = '#fbf0e2';
const TARJETA_ALERTA = { background: '#fffaf4', border: '1px solid #f3ddc4' } as const;

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const dos = (n: number) => String(n).padStart(2, '0');
const isoDeHoy = () => { const d = new Date(); return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`; };
const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Las mismas cinco líneas que usa SelectorDeRango, copiadas porque ahí son
 * privadas y ese archivo se reutiliza tal cual.
 *
 * Acá hace falta de verdad y no alcanza con `hidden md:block`: el gráfico y
 * la lista de talles son dos cosas distintas, y montar las dos deja un
 * recharts midiendo un contenedor de ancho cero en el teléfono.
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

/** "1 oct – 14 oct 2026". El año de la izquierda sólo si cambia. */
const textoDeRango = ({ desde, hasta }: Rango) => {
    const diaMes = (iso: string) => `${Number(iso.slice(8, 10))} ${MES[Number(iso.slice(5, 7)) - 1]}`;
    const fin = `${diaMes(hasta)} ${hasta.slice(0, 4)}`;
    if (desde === hasta) return fin;
    const mismoAnio = desde.slice(0, 4) === hasta.slice(0, 4);
    return `${diaMes(desde)}${mismoAnio ? '' : ` ${desde.slice(0, 4)}`} – ${fin}`;
};

/**
 * El período sale de la URL, no de un useState: así recargar la página lo
 * conserva y "Ver más detalles" lo puede pasar tal cual.
 *
 * Sin parámetros, el mes en curso hasta hoy.
 */
const rangoDeLaUrl = (search: string): Rango => {
    const q = new URLSearchParams(search);
    const desde = q.get('desde');
    const hasta = q.get('hasta');
    if (desde && hasta && ES_FECHA.test(desde) && ES_FECHA.test(hasta) && desde <= hasta) {
        return { desde, hasta };
    }
    const hoy = isoDeHoy();
    return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
};

type Pestana = 'resumen' | 'stock';

// ── Piezas chicas ───────────────────────────────────────────────────────

const TituloSeccion: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <h2 className={`m-0 text-[18px] font-semibold tracking-[-.01em] ${className}`} style={{ color: C.tinta }}>
        {children}
    </h2>
);

const KpiDelPunto: React.FC<{ label: string; valor: number; nota: string; alerta?: boolean }> = ({ label, valor, nota, alerta }) => (
    <Tarjeta className="p-[14px] md:px-[18px] md:py-4" style={alerta ? TARJETA_ALERTA : undefined}>
        <p className="m-0 text-[12.5px] leading-[1.35] font-semibold" style={{ color: C.apagado }}>{label}</p>
        <p className="mt-2.5 m-0 text-[26px] md:text-[30px] leading-none font-semibold tracking-[-.02em] tabular-nums" style={{ color: C.tinta }}>
            {valor}
        </p>
        <p className="mt-[9px] m-0 text-[12px] leading-[1.45] font-medium" style={{ color: alerta ? AMBAR_TINTA : C.apagado }}>
            {nota}
        </p>
    </Tarjeta>
);

/** La pastilla azul de "N nuevas en el período". */
const Pastilla: React.FC<{ children: React.ReactNode; activa: boolean }> = ({ children, activa }) => (
    <span
        className="shrink-0 inline-flex items-center h-[26px] px-2.5 rounded-full text-[12px] font-semibold whitespace-nowrap"
        style={activa ? { background: '#eaf0fc', color: '#1e3a8a' } : { background: '#f1f2f4', color: C.apagado }}
    >
        {children}
    </span>
);

const BotonExcel: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <button
        type="button"
        onClick={onClick}
        aria-label="Descargar el inventario en Excel"
        className="shrink-0 h-11 md:h-[38px] px-3.5 rounded-[10px] bg-white flex items-center gap-[7px] text-[13px] font-semibold"
        style={{ border: `1px solid ${C.borde}`, color: C.tinta }}
    >
        <Download className="w-[15px] h-[15px]" />
        Excel
    </button>
);

// ── La pantalla ─────────────────────────────────────────────────────────

const ReportesPuntoInfo: React.FC = () => {
    const navigate = useNavigate();
    const { search } = useLocation();
    const rango = useMemo(() => rangoDeLaUrl(search), [search]);
    /** La pestaña también vive en la URL: recargar o compartir la conserva. */
    const pestana: Pestana = new URLSearchParams(search).get('pestana') === 'stock' ? 'stock' : 'resumen';
    const esMovil = useEsMovil();

    // De hoy, no del período: se piden una sola vez.
    const [kpis, setKpis] = useState<KpisPuntoInfo | null>(null);
    const [fallaKpis, setFallaKpis] = useState(false);

    // Del período.
    const [novedades, setNovedades] = useState<Novedad[] | null>(null);
    const [inventario, setInventario] = useState<InventarioDelPunto | null>(null);
    const [bautismos, setBautismos] = useState<Pendientes | null>(null);
    const [presentaciones, setPresentaciones] = useState<Pendientes | null>(null);
    const [diasConMovimiento, setDiasConMovimiento] = useState<Map<string, number>>(new Map());
    const [cargandoPeriodo, setCargandoPeriodo] = useState(true);
    const [fallaPeriodo, setFallaPeriodo] = useState(false);

    const [modo, setModo] = useState<Record<ClaseDeProducto, 'stock' | 'periodo'>>({ Remeras: 'stock', Buzos: 'stock' });
    /** El tooltip que se abre al tocar una fila en el teléfono. */
    const [tocado, setTocado] = useState<{ clase: ClaseDeProducto; talle: number } | null>(null);
    /** El reporte de stock que se está mirando, abierto desde Novedades. */
    const [reporteAbierto, setReporteAbierto] = useState<string | null>(null);

    const pedirKpis = useCallback(async () => {
        setFallaKpis(false);
        const k = await getKpisPuntoInfo();
        if (k) setKpis(k); else setFallaKpis(true);
    }, []);

    const pedirPeriodo = useCallback(async () => {
        setCargandoPeriodo(true);
        setFallaPeriodo(false);
        const [nov, inv, bau, pres, dias] = await Promise.all([
            getNovedades(rango),
            getInventarioPuntoInfo(rango),
            getPendientes('bautismos', rango),
            getPendientes('presentaciones', rango),
            getDiasConMovimiento(rango),
        ]);
        if (!nov || !inv || !bau || !pres) {
            setFallaPeriodo(true);
        } else {
            setNovedades(nov);
            setInventario(inv);
            setBautismos(bau);
            setPresentaciones(pres);
            setDiasConMovimiento(dias || new Map());
        }
        setCargandoPeriodo(false);
    }, [rango]);

    useEffect(() => { pedirKpis(); }, [pedirKpis]);
    useEffect(() => { pedirPeriodo(); }, [pedirPeriodo]);

    /** El período y la pestaña viajan juntos en la URL. */
    const urlCon = (r: Rango, p: Pestana) =>
        `?desde=${r.desde}&hasta=${r.hasta}${p === 'stock' ? '&pestana=stock' : ''}`;

    const cambiarRango = (r: Rango) => {
        navigate({ search: urlCon(r, pestana) }, { replace: true });
        setTocado(null);
    };

    const verDetalle = (ruta: string) =>
        navigate({ pathname: ruta, search: `?desde=${rango.desde}&hasta=${rango.hasta}` });

    const atajos = useMemo(() => atajosDeRango([new Date().getFullYear()]), []);
    const error = fallaKpis || fallaPeriodo;
    const primeraCarga = cargandoPeriodo && !inventario;

    const bajarExcel = () => {
        if (!inventario) return;
        const hoja = (filas: FilaDeTalle[]) => filas.map(f => ({
            'Talle': f.talle,
            'Stock actual': f.stock,
            'Mínimo': f.minimo,
            'Ingresaron (período)': f.ingresaron,
            'Se vendieron (período)': f.vendieron,
        }));
        descargarExcel(
            [{ nombre: 'Remeras', filas: hoja(inventario.remeras) }, { nombre: 'Buzos', filas: hoja(inventario.buzos) }],
            `Reportes-Punto-Inventario-${rango.desde}-a-${rango.hasta}.xlsx`,
        );
    };

    // ── Inventario ──────────────────────────────────────────────────────
    const TarjetaDeProducto: React.FC<{ clase: ClaseDeProducto; filas: FilaDeTalle[] }> = ({ clase, filas }) => {
        const esPeriodo = modo[clase] === 'periodo';
        const totalIngresos = filas.reduce((n, f) => n + f.ingresaron, 0);
        const totalVentas = filas.reduce((n, f) => n + f.vendieron, 0);
        const sinMovimientos = esPeriodo && totalIngresos + totalVentas === 0;
        const tope = Math.max(1, ...filas.map(f => (esPeriodo ? Math.max(f.ingresaron, f.vendieron) : f.stock)));

        const textoDelTalle = (f: FilaDeTalle) => esPeriodo
            ? `Talle ${f.talle} · Ingresaron ${f.ingresaron} · Se vendieron ${f.vendieron}`
            : `Talle ${f.talle} · ${f.stock} ${f.stock === 1 ? 'unidad' : 'unidades'} · mínimo ${f.minimo}`;

        const boton = (activo: boolean) => ({
            height: 40, padding: '0 10px', border: 0, borderRadius: 8,
            background: activo ? '#fff' : 'transparent',
            color: activo ? C.tinta : C.apagado,
            boxShadow: activo ? '0 1px 2px rgba(15,23,42,.12)' : 'none',
            fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const,
        });

        return (
            <Tarjeta className="px-5 pt-[18px] pb-3.5 min-w-0">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                        <p className="m-0 text-[15px] font-semibold" style={{ color: C.tinta }}>{clase}</p>
                        <p className="mt-1 m-0 text-[12.5px]" style={{ color: C.tenue }}>
                            {esPeriodo ? `Ingresos y ventas por talle · ${textoDeRango(rango)}` : 'Unidades por talle, hoy'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex gap-0.5 rounded-[11px] p-[3px]" style={{ background: '#f1f2f4' }}>
                            <button type="button" aria-pressed={!esPeriodo} style={boton(!esPeriodo)}
                                onClick={() => { setModo(m => ({ ...m, [clase]: 'stock' })); setTocado(null); }}>
                                Stock actual
                            </button>
                            <button type="button" aria-pressed={esPeriodo} style={boton(esPeriodo)}
                                onClick={() => { setModo(m => ({ ...m, [clase]: 'periodo' })); setTocado(null); }}>
                                En el período
                            </button>
                        </div>
                        <BotonExcel onClick={bajarExcel} />
                    </div>
                </div>

                {esPeriodo && (
                    <p className="mt-3.5 m-0 text-[13px] font-semibold tabular-nums" style={{ color: C.medio }}>
                        Ingresaron {totalIngresos} · Se vendieron {totalVentas}
                    </p>
                )}

                <div className="flex flex-wrap gap-3.5 mt-3">
                    {(esPeriodo
                        ? [{ c: C.azul, t: 'Ingresaron' }, { c: C.azulClaro, t: 'Se vendieron' }]
                        : [{ c: C.azul, t: 'En stock' }, { c: AMBAR, t: 'Por debajo del mínimo' }]
                    ).map(l => (
                        <span key={l.t} className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: C.apagado }}>
                            <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: l.c }} />
                            {l.t}
                        </span>
                    ))}
                </div>

                {sinMovimientos ? (
                    <div
                        className="mt-4 rounded-xl flex items-center justify-center p-5 text-center text-[13px] leading-[1.5] min-h-[200px] md:min-h-[258px]"
                        style={{ background: C.fondo, color: C.apagado }}
                    >
                        No hubo ingresos ni ventas de {clase.toLowerCase()} en este período.
                    </div>
                ) : (
                    <>
                        {/* Compu: barras verticales, una columna por talle. */}
                        {!esMovil && <div className="mt-6">
                            <ResponsiveContainer width="100%" height={236}>
                                <BarChart data={filas} margin={{ top: 22, right: 0, left: 0, bottom: 0 }} barCategoryGap="22%">
                                    <XAxis dataKey="talle" tickLine={false} axisLine={{ stroke: C.borde }} tick={EjeCategoria} />
                                    <YAxis hide domain={[0, tope]} />
                                    <Tooltip
                                        cursor={{ fill: '#f3f6fc' }}
                                        wrapperStyle={{ outline: 'none' }}
                                        content={({ active, payload }) => {
                                            if (!active || !payload?.length) return null;
                                            return (
                                                <div className="px-[11px] py-2 rounded-[9px] text-[12px] font-semibold"
                                                    style={{ background: C.tinta, color: '#fff', fontFamily: FUENTE }}>
                                                    {textoDelTalle(payload[0].payload as FilaDeTalle)}
                                                </div>
                                            );
                                        }}
                                    />
                                    {esPeriodo ? (
                                        <>
                                            <Bar dataKey="ingresaron" fill={C.azul} radius={[5, 5, 0, 0]}>
                                                <LabelList dataKey="ingresaron" position="top" style={{ fontSize: 11.5, fontWeight: 600, fill: C.medio }} />
                                            </Bar>
                                            <Bar dataKey="vendieron" fill={C.azulClaro} radius={[5, 5, 0, 0]}>
                                                <LabelList dataKey="vendieron" position="top" style={{ fontSize: 11.5, fontWeight: 600, fill: C.medio }} />
                                            </Bar>
                                        </>
                                    ) : (
                                        <Bar dataKey="stock" radius={[5, 5, 0, 0]}>
                                            {filas.map(f => (
                                                <Cell key={f.talle} fill={f.stock <= f.minimo ? AMBAR : C.azul} />
                                            ))}
                                            <LabelList dataKey="stock" position="top" style={{ fontSize: 11.5, fontWeight: 600, fill: C.medio }} />
                                        </Bar>
                                    )}
                                </BarChart>
                            </ResponsiveContainer>
                            <p className="mt-1 m-0 text-center text-[11.5px]" style={{ color: C.tenue }}>Talle</p>
                        </div>}

                        {/* Teléfono: una fila por talle, la barra acostada. */}
                        {esMovil && <div className="mt-4">
                            <div
                                className="grid gap-2.5 pb-1.5 text-[11px] font-semibold tracking-[.04em]"
                                style={{ gridTemplateColumns: `40px minmax(0,1fr) ${esPeriodo ? '58px' : '34px'}`, color: C.tenue }}
                            >
                                <span>TALLE</span><span /><span className="text-right">{esPeriodo ? 'ING. · VEND.' : 'UNIDADES'}</span>
                            </div>
                            {filas.map(f => {
                                const abierto = tocado?.clase === clase && tocado.talle === f.talle;
                                const barra = (valor: number, color: string) => (
                                    <div className="h-[7px] rounded-full overflow-hidden" style={{ background: '#f1f3f6' }}>
                                        <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.round((valor / tope) * 100))}%`, background: valor ? color : '#d1d5db' }} />
                                    </div>
                                );
                                return (
                                    <div key={f.talle} className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setTocado(abierto ? null : { clase, talle: f.talle })}
                                            aria-label={textoDelTalle(f)}
                                            className="w-full grid items-center gap-2.5 min-h-[44px] text-left"
                                            style={{ gridTemplateColumns: `40px minmax(0,1fr) ${esPeriodo ? '58px' : '34px'}` }}
                                        >
                                            <span className="text-[13px] font-semibold" style={{ color: C.medio }}>{f.talle}</span>
                                            <span className="flex flex-col gap-[3px] min-w-0">
                                                {esPeriodo ? (
                                                    <>
                                                        {barra(f.ingresaron, C.azul)}
                                                        {barra(f.vendieron, C.azulClaro)}
                                                    </>
                                                ) : (
                                                    <span className="block h-3 rounded-full overflow-hidden" style={{ background: '#f1f3f6' }}>
                                                        <span className="block h-full rounded-full" style={{ width: `${Math.max(2, Math.round((f.stock / tope) * 100))}%`, background: f.stock ? (f.stock <= f.minimo ? AMBAR : C.azul) : '#d1d5db' }} />
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-right text-[13px] font-semibold tabular-nums whitespace-nowrap" style={{ color: C.tinta }}>
                                                {esPeriodo ? `${f.ingresaron} · ${f.vendieron}` : f.stock}
                                            </span>
                                        </button>
                                        {abierto && (
                                            <div role="tooltip"
                                                className="absolute left-10 top-[calc(100%-2px)] z-10 px-[11px] py-2 rounded-[9px] text-[12px] leading-[1.4] font-semibold max-w-[calc(100%-40px)]"
                                                style={{ background: C.tinta, color: '#fff' }}>
                                                {textoDelTalle(f)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>}
                    </>
                )}

                <p className="mt-4 pt-3 m-0 text-[12px] leading-[1.5]" style={{ borderTop: `1px solid ${C.bordeSuave}`, color: C.apagado }}>
                    El mínimo de cada talle se configura en Punto de Información.
                </p>
            </Tarjeta>
        );
    };

    // ── Planillas de pendientes ─────────────────────────────────────────
    const Planilla: React.FC<{
        titulo: string;
        datos: Pendientes;
        columnas: string[];
        grilla: string;
        volanta: string;
        vacio: string;
        conPadres?: boolean;
        ruta: string;
    }> = ({ titulo, datos, columnas, grilla, volanta, vacio, conPadres, ruta }) => {
        const detalle = datos.total > 4
            ? `4 de ${datos.total} · los que más esperan, primero`
            : datos.total === 0
                ? 'Nadie está esperando'
                : `${datos.total === 1 ? '1 pendiente' : `${datos.total} pendientes`} · los que más esperan, primero`;
        const nuevas = datos.nuevasEnPeriodo === 0
            ? 'Sin solicitudes nuevas en el período'
            : datos.nuevasEnPeriodo === 1
                ? '1 solicitud nueva en el período'
                : `${datos.nuevasEnPeriodo} solicitudes nuevas en el período`;

        return (
            <Tarjeta className="overflow-hidden min-w-0">
                <div className="px-5 pt-[18px] pb-3.5 flex items-start justify-between gap-2.5 flex-wrap">
                    <div className="min-w-0">
                        <p className="m-0 text-[15px] font-semibold" style={{ color: C.tinta }}>{titulo}</p>
                        <p className="mt-1 m-0 text-[12.5px]" style={{ color: C.tenue }}>{detalle}</p>
                    </div>
                    <Pastilla activa={datos.nuevasEnPeriodo > 0}>{nuevas}</Pastilla>
                </div>

                {datos.primeros4.length > 0 ? (
                    <>
                        <div className="hidden md:grid gap-3.5 px-5 py-2.5"
                            style={{ gridTemplateColumns: grilla, background: C.fondo, borderTop: `1px solid ${C.bordeSuave}`, borderBottom: `1px solid ${C.bordeSuave}` }}>
                            {columnas.map(c => (
                                <span key={c} className="text-[11px] font-semibold tracking-[.04em]" style={{ color: C.apagado }}>{c}</span>
                            ))}
                        </div>
                        {datos.primeros4.map(p => {
                            const tel = telParaLlamar(p.telefono);
                            const celdas = (
                                <>
                                    <div className="min-w-0">
                                        <p className="m-0 text-[12.5px] md:text-[13px] font-semibold leading-[1.4]" style={{ color: C.medio }}>{volanta}</p>
                                        <p className="mt-0.5 m-0 text-[12px]" style={{ color: C.tenue }}>{fechaYHora(p.solicitud)}</p>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="m-0 text-[15px] md:text-[13.5px] font-semibold leading-[1.4]" style={{ color: C.tinta, overflowWrap: 'anywhere' }}>{p.nombre}</p>
                                    </div>
                                    {conPadres && (
                                        <div className="min-w-0">
                                            <p className="m-0 text-[13px] font-medium leading-[1.4]" style={{ color: C.medio, overflowWrap: 'anywhere' }}>{p.padres || '—'}</p>
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        {tel ? (
                                            <a href={tel} className="inline-flex items-center h-11 md:h-7 text-[13.5px] font-semibold whitespace-nowrap" style={{ color: C.azul }}>
                                                {p.telefono}
                                            </a>
                                        ) : (
                                            <p className="m-0 text-[13px]" style={{ color: C.tenue }}>—</p>
                                        )}
                                    </div>
                                </>
                            );
                            // Una sola fila: apilada en el teléfono, en grilla en la
                            // compu. Dos copias en el DOM duplicarían cada teléfono
                            // para quien lee con un lector de pantalla.
                            return (
                                <div
                                    key={p.id}
                                    className="px-5 py-3.5 flex flex-col gap-[3px] border-t border-t-[#eef0f3] md:py-3 md:gap-3.5 md:grid md:items-center md:border-t-0 md:border-b md:border-b-[#f2f3f5]"
                                    style={{ gridTemplateColumns: grilla }}
                                >
                                    {celdas}
                                </div>
                            );
                        })}
                    </>
                ) : (
                    <div className="mx-5 mb-3.5 px-4 py-[26px] rounded-xl flex flex-col items-center gap-2.5 text-center" style={{ background: C.fondo }}>
                        <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: '#eceef1' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.tenue} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
                        </span>
                        <span className="text-[13.5px] font-semibold" style={{ color: C.apagado }}>{vacio}</span>
                    </div>
                )}

                <div className="px-3 pt-1 pb-1.5" style={{ borderTop: `1px solid ${C.bordeSuave}` }}>
                    <button type="button" onClick={() => verDetalle(ruta)}
                        className="inline-flex items-center gap-1.5 min-h-[44px] px-2 text-[13.5px] font-semibold"
                        style={{ color: C.azul }}>
                        Ver más detalles →
                    </button>
                </div>
            </Tarjeta>
        );
    };

    // ── Esqueletos ──────────────────────────────────────────────────────
    const EsqueletoTablero = () => (
        <div aria-busy="true" className="flex flex-col gap-5 mt-6">
            <Tarjeta className="px-5 py-[18px]">
                <Esqueleto alto={14} ancho="140px" />
                <div className="mt-4 flex flex-col gap-2">
                    {[0, 1, 2].map(i => <Esqueleto key={i} alto={38} />)}
                </div>
            </Tarjeta>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[0, 1, 2, 3].map(i => (
                    <Tarjeta key={i} className="p-[14px] md:px-[18px] md:py-4">
                        <Esqueleto alto={12} ancho="70%" />
                        <div className="mt-3"><Esqueleto alto={26} ancho="40%" /></div>
                        <div className="mt-3"><Esqueleto alto={11} ancho="85%" /></div>
                    </Tarjeta>
                ))}
            </div>
            <div className="grid md:grid-cols-2 gap-4">
                {[0, 1].map(i => (
                    <Tarjeta key={i} className="px-5 py-[18px]">
                        <Esqueleto alto={14} ancho="120px" />
                        <div className="mt-[18px]"><Esqueleto alto={240} /></div>
                    </Tarjeta>
                ))}
            </div>
            <div className="grid md:grid-cols-2 gap-4">
                {[0, 1].map(i => (
                    <Tarjeta key={i} className="px-5 py-[18px]">
                        <Esqueleto alto={14} ancho="170px" />
                        <div className="mt-2.5 flex flex-col gap-2.5">
                            {[0, 1, 2, 3].map(j => <Esqueleto key={j} alto={44} />)}
                        </div>
                    </Tarjeta>
                ))}
            </div>
        </div>
    );

    // ── Pantalla ────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen" style={{ background: C.fondo, fontFamily: FUENTE }}>
            <div className="mx-auto max-w-[1240px] px-4 pt-[18px] pb-10 md:px-10 md:pt-[30px] md:pb-14">

                {/* ── Encabezado ── */}
                <div className="flex flex-wrap items-end justify-between gap-y-3.5 gap-x-6">
                    <div className="min-w-0 flex-1 basis-[300px]">
                        <button type="button" onClick={() => navigate('/punto-de-informacion')}
                            className="inline-flex items-center gap-1.5 min-h-9 text-[13px] font-semibold"
                            style={{ color: C.medio }}>
                            <ChevronLeft className="w-4 h-4" />
                            Punto de Información
                        </button>
                        <h1 className="mt-1.5 m-0 text-[23px] md:text-[28px] leading-[1.15] font-semibold tracking-[-.02em]" style={{ color: C.tinta }}>
                            Reportes de Punto de Información
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

                {/* ── Las dos pestañas. El calendario de arriba vale para las dos. ── */}
                <div role="tablist" aria-label="Qué mirar" className="grid grid-cols-2 gap-1.5 mt-4 md:flex md:w-auto">
                    {([['resumen', 'Resumen'], ['stock', 'Reportes de stock']] as const).map(([clave, label]) => {
                        const activa = pestana === clave;
                        return (
                            <button
                                key={clave}
                                type="button"
                                role="tab"
                                aria-selected={activa}
                                onClick={() => navigate({ search: urlCon(rango, clave) }, { replace: true })}
                                className="h-11 md:h-[38px] px-4 rounded-[10px] flex items-center justify-center text-[13px] font-semibold whitespace-nowrap"
                                style={{ background: activa ? C.tinta : '#f1f2f4', color: activa ? '#fff' : C.medio }}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>

                {pestana === 'stock' ? (
                    <ReportesDeStock rango={rango} esMovil={esMovil} />
                ) : error ? (
                    <Tarjeta className="mt-6 px-6 py-11 flex flex-col items-center text-center">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#fdecea' }}>
                            <AlertCircle className="w-[22px] h-[22px]" style={{ color: '#b42318' }} />
                        </div>
                        <p className="mt-4 m-0 text-[16px] font-semibold" style={{ color: C.tinta }}>No pudimos cargar los reportes</p>
                        <p className="mt-2 m-0 max-w-[380px] text-[13px] leading-[1.6]" style={{ color: C.apagado }}>
                            Revisá tu conexión e intentá de nuevo. Los datos de Punto de Información no se perdieron.
                        </p>
                        <button type="button" onClick={() => { pedirKpis(); pedirPeriodo(); }}
                            className="h-11 px-5 mt-[18px] rounded-[10px] text-sm font-semibold"
                            style={{ background: C.tinta, color: '#fff' }}>
                            Reintentar
                        </button>
                    </Tarjeta>
                ) : primeraCarga || !kpis ? (
                    <EsqueletoTablero />
                ) : (
                    <>
                        {/* ── Novedades ── */}
                        <Tarjeta className="mt-6 overflow-hidden">
                            <div className="px-5 pt-[18px] pb-3.5">
                                <p className="m-0 text-[15px] font-semibold" style={{ color: C.tinta }}>Novedades</p>
                                <p className="mt-1 m-0 text-[12.5px]" style={{ color: C.tenue }}>Los últimos 3 movimientos del período</p>
                                <div className="mt-2.5">
                                    {cargandoPeriodo ? (
                                        <div className="flex flex-col gap-2">{[0, 1, 2].map(i => <Esqueleto key={i} alto={38} />)}</div>
                                    ) : novedades && novedades.length > 0 ? (
                                        novedades.map(n => {
                                            const esAjuste = n.tipo === 'Ajuste';
                                            const esReporte = n.tipo === 'Reporte';
                                            const Icono = esReporte ? ClipboardCheck
                                                : n.tipo === 'Entrada' ? ArrowDown
                                                    : n.tipo === 'Salida' ? ArrowUp : Pencil;
                                            // El reporte se toca y abre su ficha; los movimientos
                                            // sueltos no tienen a dónde llevar.
                                            const Fila = esReporte ? 'button' : 'div';
                                            return (
                                                <Fila
                                                    key={n.id}
                                                    {...(esReporte ? {
                                                        type: 'button' as const,
                                                        onClick: () => setReporteAbierto(n.reportId || null),
                                                        'aria-label': `Ver el reporte de stock de ${n.cuando}`,
                                                    } : {})}
                                                    className={`w-full flex items-start gap-3 py-[11px] text-left ${esReporte ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                                                    style={{ borderTop: `1px solid ${C.bordeSuave}` }}
                                                >
                                                    <span className="w-[30px] h-[30px] rounded-full shrink-0 flex items-center justify-center"
                                                        style={esReporte
                                                            ? { background: '#eaf0fc', color: '#1e3a8a' }
                                                            : { background: esAjuste ? AMBAR_FONDO : '#f1f2f4', color: esAjuste ? AMBAR_TINTA : C.medio }}>
                                                        <Icono className="w-3.5 h-3.5" />
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="m-0 text-[13.5px] leading-[1.45] font-medium" style={{ color: C.medio }}>{n.frase}</p>
                                                        {n.detalle && (
                                                            <p className="mt-0.5 m-0 text-[12px] tabular-nums" style={{ color: C.tenue }}>{n.detalle}</p>
                                                        )}
                                                        {/* Quién lo hizo. Un solo renglón para los
                                                            cuatro tipos: el verbo ya lo dice la frase
                                                            de arriba. */}
                                                        <p className="mt-0.5 m-0 text-[12px]" style={{ color: C.tenue }}>
                                                            {n.autor ? `Por ${n.autor}` : 'No quedó registrado quién lo hizo'}
                                                        </p>
                                                    </div>
                                                    <span className="shrink-0 text-[12px] font-medium whitespace-nowrap pt-0.5" style={{ color: C.tenue }}>{n.cuando}</span>
                                                </Fila>
                                            );
                                        })
                                    ) : (
                                        <div className="px-3.5 py-3 rounded-[10px] text-[13px]" style={{ background: C.fondo, color: C.apagado }}>
                                            No hubo movimientos en este período.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* La misma tira que cierra las dos planillas de
                                pendientes: desde el tablero se ven 3, y de acá
                                sale el resto. */}
                            <div className="px-3 pt-1 pb-1.5" style={{ borderTop: `1px solid ${C.bordeSuave}` }}>
                                <button type="button" onClick={() => verDetalle('/reportes/puntoinfo/novedades')}
                                    className="inline-flex items-center gap-1.5 min-h-[44px] px-2 text-[13.5px] font-semibold"
                                    style={{ color: C.azul }}>
                                    Ver más →
                                </button>
                            </div>
                        </Tarjeta>

                        {/* ── KPIs: de hoy, no del período ── */}
                        <p className="mt-7 mb-2.5 m-0 text-[12.5px]" style={{ color: C.tenue }}>
                            Estos números son de hoy: no cambian con el período.
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <KpiDelPunto
                                label="Remeras en stock" valor={kpis.remeras.enStock} alerta={kpis.remeras.bajoMinimo > 0}
                                nota={kpis.remeras.bajoMinimo > 0
                                    ? `${kpis.remeras.bajoMinimo} ${kpis.remeras.bajoMinimo === 1 ? 'talle' : 'talles'} por debajo del mínimo`
                                    : 'Todos los talles sobre el mínimo'}
                            />
                            <KpiDelPunto
                                label="Buzos en stock" valor={kpis.buzos.enStock} alerta={kpis.buzos.bajoMinimo > 0}
                                nota={kpis.buzos.bajoMinimo > 0
                                    ? `${kpis.buzos.bajoMinimo} ${kpis.buzos.bajoMinimo === 1 ? 'talle' : 'talles'} por debajo del mínimo`
                                    : 'Todos los talles sobre el mínimo'}
                            />
                            <KpiDelPunto
                                label="Bautismos pendientes" valor={kpis.bautismos.pendientes}
                                nota={kpis.bautismos.pendientes > 0 && kpis.bautismos.diasDeEspera !== null
                                    ? `La más antigua espera hace ${kpis.bautismos.diasDeEspera} ${kpis.bautismos.diasDeEspera === 1 ? 'día' : 'días'}`
                                    : 'No hay pendientes'}
                            />
                            <KpiDelPunto
                                label="Presentaciones pendientes" valor={kpis.presentaciones.pendientes}
                                nota={kpis.presentaciones.pendientes > 0 && kpis.presentaciones.diasDeEspera !== null
                                    ? `La más antigua espera hace ${kpis.presentaciones.diasDeEspera} ${kpis.presentaciones.diasDeEspera === 1 ? 'día' : 'días'}`
                                    : 'No hay pendientes'}
                            />
                        </div>

                        {/* ── Inventario ── */}
                        <TituloSeccion className="mt-8 mb-3">Inventario</TituloSeccion>
                        <div className="grid md:grid-cols-2 gap-4">
                            {cargandoPeriodo || !inventario ? (
                                [0, 1].map(i => (
                                    <Tarjeta key={i} className="px-5 py-[18px]">
                                        <Esqueleto alto={14} ancho="120px" />
                                        <div className="mt-[18px]"><Esqueleto alto={240} /></div>
                                    </Tarjeta>
                                ))
                            ) : (
                                <>
                                    <TarjetaDeProducto clase="Remeras" filas={inventario.remeras} />
                                    <TarjetaDeProducto clase="Buzos" filas={inventario.buzos} />
                                </>
                            )}
                        </div>

                        {/* ── Bautismos y presentaciones ── */}
                        <TituloSeccion className="mt-8 mb-3">Bautismos y Presentaciones de niños</TituloSeccion>
                        <div className="grid md:grid-cols-2 gap-4 items-start">
                            {cargandoPeriodo || !bautismos || !presentaciones ? (
                                [0, 1].map(i => (
                                    <Tarjeta key={i} className="px-5 py-[18px]">
                                        <Esqueleto alto={14} ancho="170px" />
                                        <div className="mt-2.5 flex flex-col gap-2.5">
                                            {[0, 1, 2, 3].map(j => <Esqueleto key={j} alto={44} />)}
                                        </div>
                                    </Tarjeta>
                                ))
                            ) : (
                                <>
                                    <Planilla
                                        titulo="Bautismos pendientes"
                                        datos={bautismos}
                                        columnas={['SOLICITUD', 'NOMBRE Y APELLIDO DEL SOLICITANTE', 'NÚMERO DE TELÉFONO']}
                                        grilla="minmax(0,1.15fr) minmax(0,1.2fr) minmax(0,.9fr)"
                                        volanta="Solicitud de bautismo"
                                        vacio="No hay bautismos pendientes."
                                        ruta="/reportes/puntoinfo/bautismos-detalles"
                                    />
                                    <Planilla
                                        titulo="Presentaciones pendientes"
                                        datos={presentaciones}
                                        columnas={['SOLICITUD', 'NOMBRE Y APELLIDO DEL NIÑO', 'NOMBRE Y APELLIDO DE LOS PADRES', 'TELÉFONO DE CONTACTO']}
                                        grilla="minmax(0,1.05fr) minmax(0,1fr) minmax(0,1.35fr) minmax(0,.95fr)"
                                        volanta="Solicitud de Presentación"
                                        vacio="No hay presentaciones pendientes."
                                        conPadres
                                        ruta="/reportes/puntoinfo/presentacion-detalles"
                                    />
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* La misma ficha que abre la planilla de la otra pestaña. */}
            <HojaReporteStock reporteId={reporteAbierto} onCerrar={() => setReporteAbierto(null)} />
        </div>
    );
};

export default ReportesPuntoInfo;
