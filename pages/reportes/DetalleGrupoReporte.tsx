// ════════════════════════════════════════════════════════════════════════
// /reportes/gcx/:groupId — detalle de un grupo, vista de análisis.
//
// Implementa design-claude/Reportes GCX - Detalle de Grupo.dc.html. Es una
// pantalla de DIAGNÓSTICO, no de gestión: contesta la pregunta antes de
// mostrar los datos — arriba de todo va el veredicto en una frase y los
// números que lo sostienen. Nadie edita nada acá; para eso está el panel
// del anfitrión.
//
// Mismos tokens de color y misma lógica de estados (cargando / sin datos /
// parcial) que pages/reportes/ReportesGCX.tsx, para que las dos pantallas
// del tablero se sientan como una sola herramienta.
// ════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { NOMBRE_MODALIDAD, modalidadDe, dondeSeReune } from '../../src/utils/modalidad';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { ArrowLeft, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import {
    TemporadaGCX, DetalleGrupoReporte as DetalleGrupoReporteDatos,
    MiembroDetalleReporte, GroupCategory, GroupTag,
} from '../../types';
import { supabaseService } from '../../services/supabaseService';

// ── Tokens (mismos valores que ReportesGCX.tsx) ─────────────────────────
const C = {
    fondo: '#f7f8fa',
    borde: '#e8e9ec',
    bordeSuave: '#eef0f3',
    tinta: '#0f172a',
    medio: '#374151',
    apagado: '#6b7280',
    tenue: '#9ca3af',
    linea: '#c3c7ce',
    azul: '#2563eb',
    verde: '#12783f',
    verdeFondo: '#eaf6ee',
    rojo: '#b42318',
    ambarTexto: '#8a5a12',
    ambarFondo: '#fff8f0',
    ambarBorde: '#f3ddc4',
    diagnostico: '#4371c5',
} as const;

const FUENTE = "Manrope, system-ui, sans-serif";
const NOMBRE_TEMPORADA: Record<TemporadaGCX, string> = { S1: '1', S2: '2', S3: '3' };

// ── Fechas, sin el corrimiento de UTC ────────────────────────────────────
const fechaLarga = (iso?: string | null): string => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
};
const fechaCorta = (iso?: string | null): string => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: '2-digit' });
};
const numero = (n: number, decimales = 1): string =>
    n.toLocaleString('es-AR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
const capitalizar = (s: string): string => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

// ── Piezas compartidas ───────────────────────────────────────────────────

const Tarjeta: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <div className={`bg-white rounded-[14px] ${className}`} style={{ border: `1px solid ${C.borde}` }}>
        {children}
    </div>
);

const Esqueleto: React.FC<{ alto: number; ancho?: string; className?: string }> = ({ alto, ancho = '100%', className = '' }) => (
    <div className={`rounded-md animate-pulse ${className}`} style={{ height: alto, width: ancho, background: '#eceef1' }} aria-hidden="true" />
);

/** Una de las 4 casillas de la franja de diagnóstico. */
const Casilla: React.FC<{
    titulo: string;
    valor: React.ReactNode;
    delta?: React.ReactNode;
    nota: string;
    riesgo?: boolean;
}> = ({ titulo, valor, delta, nota, riesgo }) => (
    <div
        className="rounded-[11px] p-4"
        style={{
            background: 'rgba(255,255,255,.07)',
            boxShadow: riesgo ? '0 0 0 1px rgba(255,190,120,.5) inset' : undefined,
        }}
    >
        <p className="m-0 text-[11px] font-semibold tracking-[.06em]" style={{ color: 'rgba(255,255,255,.5)' }}>{titulo}</p>
        <div className="flex items-baseline gap-2 mt-2.5">
            <span className="text-[25px] font-semibold tracking-[-.025em] text-white">{valor}</span>
            {delta}
        </div>
        <p className="mt-2 text-[11.5px] font-medium" style={{ color: 'rgba(255,255,255,.55)' }}>{nota}</p>
    </div>
);

const FilaConstancia: React.FC<{ nombre: string; asistidas: number; total: number; color: string }> = ({ nombre, asistidas, total, color }) => {
    const pct = total > 0 ? Math.round((asistidas / total) * 100) : 0;
    return (
        <div className="flex items-center gap-2.5">
            <span className="flex-1 min-w-0 text-[13px] font-medium truncate" style={{ color: C.medio }}>{nombre}</span>
            <div className="w-16 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: C.bordeSuave }}>
                <div className="h-full" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="w-9 text-right text-[12px] font-semibold shrink-0" style={{ color: C.medio }}>{asistidas}/{total}</span>
        </div>
    );
};

// ── Diagnóstico ──────────────────────────────────────────────────────────
// Heurística propia, no pedida por la spec: la pantalla existe para dar un
// veredicto en una frase, y sin esto el "DIAGNÓSTICO" del diseño quedaría
// vacío. Las cuatro condiciones y sus umbrales son una decisión de diseño,
// no un número verificado con Ignacio — queda documentado acá para poder
// ajustarlo si no refleja lo que el equipo espera de un "grupo sano".
interface Veredicto { titulo: string; texto: string; }

const diagnosticar = (
    d: DetalleGrupoReporteDatos,
    personasInscriptas: number,
    ocupacionPct: number
): Veredicto => {
    const { asistencia, promedioIglesia, coAnfitrion } = d;

    if (!asistencia.reportaAsistencia) {
        const desde = fechaLarga(d.grupo.startDate);
        const semanas = asistencia.reunionesEsperadas;
        return {
            titulo: 'Sin datos para evaluar',
            texto: `El grupo arrancó el ${desde}${semanas > 0 ? ` y ya pasaron ${semanas} ${semanas === 1 ? 'semana' : 'semanas'} sin cargar una asistencia` : ' y todavía no cargó ninguna asistencia'}. No sabemos si se está reuniendo — es el problema a resolver antes de mirar cualquier otro número.`,
        };
    }

    const pctReportado = asistencia.reunionesEsperadas > 0
        ? asistencia.reuniones.length / asistencia.reunionesEsperadas
        : 1;
    const traeMenosQueLaIglesia = promedioIglesia != null && asistencia.promedioPresentes < promedioIglesia * 0.85;

    const motivos: string[] = [];
    let puntos = 0;
    if (pctReportado >= 0.8) puntos += 1;
    else motivos.push(`cargó ${asistencia.reuniones.length} de ${asistencia.reunionesEsperadas} reuniones esperadas`);

    if (ocupacionPct >= 70) puntos += 1;
    else if (personasInscriptas > 0) motivos.push(`tiene ${Math.round(ocupacionPct)}% del cupo ocupado`);

    if (!traeMenosQueLaIglesia) puntos += 1;
    else motivos.push(`trae ${numero(asistencia.promedioPresentes)} personas por reunión contra un promedio de ${numero(promedioIglesia as number)}`);

    if (coAnfitrion) puntos += 1;
    else motivos.push('no tiene co-anfitrión cargado');

    if (puntos >= 3) {
        const logros: string[] = [];
        if (pctReportado >= 0.95) logros.push('reporta todas las semanas');
        else if (pctReportado >= 0.8) logros.push('reporta con regularidad');
        if (ocupacionPct >= 95) logros.push('tiene el cupo completo');
        const base = logros.length ? capitalizar(logros.join(' y ')) : 'Viene reportando bien';
        const salvedad = motivos.length ? ` El único punto flojo es que ${motivos[0]}.` : '.';
        return { titulo: 'Grupo sano', texto: `${base}${salvedad}` };
    }

    if (puntos <= 1) {
        return { titulo: 'Grupo en riesgo', texto: `${capitalizar(motivos.join(', '))}.` };
    }

    return { titulo: 'Grupo en marcha', texto: `${capitalizar(motivos.join(', '))}.` };
};

// ── Pantalla ────────────────────────────────────────────────────────────

const DetalleGrupoReporte: React.FC = () => {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();

    const [datos, setDatos] = useState<DetalleGrupoReporteDatos | null>(null);
    const [cargando, setCargando] = useState(true);
    const [noEncontrado, setNoEncontrado] = useState(false);
    const [categorias, setCategorias] = useState<GroupCategory[]>([]);
    const [tags, setTags] = useState<GroupTag[]>([]);
    const [gruposSinCoAnfitrion, setGruposSinCoAnfitrion] = useState<{ sinCo: number; total: number } | null>(null);
    const [verTodosMiembros, setVerTodosMiembros] = useState(false);

    useEffect(() => {
        supabaseService.getGroupCategories().then(setCategorias);
        supabaseService.getGroupTags().then(setTags);
    }, []);

    const cargar = useCallback(async () => {
        if (!groupId) { setNoEncontrado(true); setCargando(false); return; }
        setCargando(true);
        setNoEncontrado(false);
        const res = await supabaseService.getDetalleGrupoReporte(groupId);
        if (!res) {
            setNoEncontrado(true);
            setDatos(null);
        } else {
            setDatos(res);
            // Comparación de "sin co-anfitrión" contra el resto de la temporada.
            // Reusa la misma base cacheada que promedioIglesia — si el
            // dashboard ya se visitó, esto no pide nada nuevo a la base.
            if (res.temporada && res.anio) {
                const kpis = await supabaseService.getKPIsReportesGCX(res.temporada, res.anio);
                if (kpis) setGruposSinCoAnfitrion({ sinCo: kpis.totalGrupos - kpis.coAnfitriones, total: kpis.totalGrupos });
            }
        }
        setCargando(false);
    }, [groupId]);

    useEffect(() => { cargar(); setVerTodosMiembros(false); }, [cargar]);

    const volver = () => {
        // No hay filtros en la URL de /reportes/gcx (temporada y año viven en
        // estado local de esa pantalla), así que hacia atrás en el historial
        // es lo más parecido a "donde estabas" que se puede ofrecer sin
        // cambiar esa pantalla.
        if (window.history.length > 1) navigate(-1);
        else navigate('/reportes/gcx');
    };

    const categoriaNombre = useMemo(
        () => categorias.find(c => c.id === datos?.grupo.categoryId)?.name || null,
        [categorias, datos]
    );
    const tagNombres = useMemo(
        () => (datos?.grupo.tags || []).map(id => tags.find(t => t.id === id)?.name).filter((n): n is string => !!n),
        [tags, datos]
    );

    const personasInscriptas = useMemo(
        () => (datos?.miembros || []).reduce((acc, m) => acc + (m.esPareja ? 2 : 1), 0),
        [datos]
    );
    const capacidad = datos?.grupo.maxCapacity || 0;
    const ocupacionPct = capacidad > 0 ? Math.min(100, Math.round((personasInscriptas / capacidad) * 100)) : 0;

    const veredicto = useMemo(
        () => datos ? diagnosticar(datos, personasInscriptas, ocupacionPct) : null,
        [datos, personasInscriptas, ocupacionPct]
    );

    // Datos para el gráfico de barras: fecha corta + presentes.
    const datosBarras = useMemo(
        () => (datos?.asistencia.reuniones || []).map(r => ({ fecha: fechaLarga(r.fecha), presentes: r.presentes, total: r.total })),
        [datos]
    );

    // Constancia de los miembros: ranking de asistencia. Solo los extremos —
    // "vienen siempre" y "se están desenganchando" — son los que ameritan
    // mirar; el medio no dice nada que la tabla no diga ya.
    const constancia = useMemo(() => {
        if (!datos) return { vienen: [] as MiembroDetalleReporte[], desenganchan: [] as MiembroDetalleReporte[] };
        const conRatio = datos.miembros
            .filter(m => m.totalReuniones >= 3) // menos de 3 reuniones no alcanza para hablar de "constancia"
            .map(m => ({ m, ratio: m.reunionesAsistidas / m.totalReuniones }));
        const vienen = conRatio.filter(x => x.ratio >= 0.8).sort((a, b) => b.ratio - a.ratio).map(x => x.m);
        const desenganchan = conRatio.filter(x => x.ratio <= 0.4).sort((a, b) => a.ratio - b.ratio).map(x => x.m);
        return { vienen, desenganchan };
    }, [datos]);

    const miembrosVisibles = verTodosMiembros ? (datos?.miembros || []) : (datos?.miembros || []).slice(0, 8);

    // ── Estados de carga y error ─────────────────────────────────────────
    if (cargando) {
        return (
            <div className="min-h-screen" style={{ background: C.fondo, fontFamily: FUENTE }}>
                <div className="bg-white px-7 py-3.5" style={{ borderBottom: `1px solid ${C.borde}` }}>
                    <Esqueleto alto={14} ancho="240px" />
                </div>
                <div className="max-w-[1200px] mx-auto px-7 py-6 flex flex-col gap-4">
                    <Tarjeta className="px-6 py-5"><Esqueleto alto={72} /></Tarjeta>
                    <Tarjeta className="px-6 py-6"><Esqueleto alto={160} /></Tarjeta>
                    <Tarjeta className="px-6 py-6"><Esqueleto alto={260} /></Tarjeta>
                </div>
            </div>
        );
    }

    if (noEncontrado || !datos) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: C.fondo, fontFamily: FUENTE }}>
                <Tarjeta className="px-8 py-9 text-center max-w-sm">
                    <p className="m-0 text-[16px] font-semibold" style={{ color: C.tinta }}>No encontramos este grupo</p>
                    <p className="mt-2.5 text-[13px] leading-[1.6] font-medium" style={{ color: C.apagado }}>
                        El enlace puede estar roto, o el grupo puede haber sido eliminado.
                    </p>
                    <button
                        type="button"
                        onClick={volver}
                        className="mt-5 h-10 px-5 rounded-[9px] text-[13px] font-semibold text-white"
                        style={{ background: C.azul }}
                    >
                        Volver al dashboard
                    </button>
                </Tarjeta>
            </div>
        );
    }

    const { grupo, asistencia, miembros, anfitrion, coAnfitrion, promedioIglesia, solicitudesPendientes } = datos;

    const estaFinalizado = !!(grupo.endDate && grupo.endDate < new Date().toLocaleDateString('en-CA'));
    const estado = estaFinalizado
        ? { texto: 'Finalizado', bg: '#f4f5f7', color: '#4b5563', punto: null as string | null }
        : grupo.status === 'rejected'
            ? { texto: 'Rechazado', bg: '#fdecea', color: '#b42318', punto: '#b42318' }
            : grupo.status === 'approved'
                ? { texto: 'Activo', bg: C.verdeFondo, color: C.verde, punto: C.verde }
                : { texto: 'En revisión', bg: '#fff8f0', color: C.ambarTexto, punto: '#c98a1f' };

    const meta = [
        categoriaNombre,
        [grupo.meetingDay, grupo.meetingTime].filter(Boolean).join(' '),
        dondeSeReune(grupo),
        (grupo.startDate && grupo.endDate) ? `${fechaCorta(grupo.startDate)} – ${fechaCorta(grupo.endDate)}` : null,
    ].filter(Boolean).join(' · ');

    const delta = promedioIglesia != null ? asistencia.promedioPresentes - promedioIglesia : null;

    const faltantes = asistencia.reunionesEsperadas - asistencia.reuniones.length;
    const notaReuniones = !asistencia.reportaAsistencia
        ? `Desde el ${fechaLarga(grupo.startDate)}`
        : faltantes <= 0
            ? 'Al día con la carga'
            : `Faltan ${faltantes} ${faltantes === 1 ? 'reunión' : 'reuniones'}`;

    const telefonoWhatsapp = anfitrion?.telefono ? anfitrion.telefono.replace(/\D/g, '') : null;

    return (
        <div className="min-h-screen" style={{ background: C.fondo, fontFamily: FUENTE, color: C.tinta }}>

            {/* ── Encabezado / breadcrumb ── */}
            <div className="bg-white px-7 py-3.5" style={{ borderBottom: `1px solid ${C.borde}` }}>
                <div className="max-w-[1200px] mx-auto flex items-center gap-4 flex-wrap">
                    <button
                        type="button"
                        onClick={volver}
                        className="h-9 px-3.5 rounded-[9px] flex items-center gap-2 text-[12.5px] font-semibold transition-colors hover:bg-slate-50"
                        style={{ border: `1px solid ${C.borde}`, color: C.medio }}
                    >
                        <ArrowLeft className="w-[15px] h-[15px]" strokeWidth={2.2} />
                        Volver al dashboard
                    </button>
                    <span className="text-[13px] font-medium" style={{ color: C.tenue }}>Reportes GCX</span>
                    <span className="text-[13px] font-medium" style={{ color: C.linea }}>/</span>
                    <span className="text-[13px] font-medium" style={{ color: C.tenue }}>
                        {datos.temporada ? `Temporada ${NOMBRE_TEMPORADA[datos.temporada]} · ${datos.anio}` : 'Sin temporada'}
                    </span>
                    <span className="text-[13px] font-medium" style={{ color: C.linea }}>/</span>
                    <span className="text-[13px] font-semibold truncate" style={{ color: C.tinta }}>{grupo.name}</span>
                </div>
            </div>

            <div className="max-w-[1200px] mx-auto px-7 py-6 flex flex-col gap-4">

                {/* ── Identidad ── */}
                <Tarjeta className="px-[22px] py-[18px] flex items-center gap-[22px] flex-wrap">
                    <div
                        className="w-[104px] h-[72px] rounded-[10px] shrink-0 overflow-hidden"
                        style={grupo.imageUrl ? undefined : { background: 'repeating-linear-gradient(135deg,#e6e4e0 0 9px,#dedbd6 9px 18px)' }}
                    >
                        {grupo.imageUrl && <img src={grupo.imageUrl} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="m-0 text-[22px] font-semibold tracking-[-.02em]" style={{ color: C.tinta }}>{grupo.name}</h1>
                            <span className="h-6 px-2.5 rounded-[6px] flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ background: estado.bg, color: estado.color }}>
                                {estado.punto && <span className="w-1.5 h-1.5 rounded-full" style={{ background: estado.punto }} />}
                                {estado.texto}
                            </span>
                            {datos.temporada && (
                                <span className="h-6 px-2.5 rounded-[6px] flex items-center text-[11.5px] font-semibold" style={{ background: '#f4f5f7', color: '#4b5563' }}>
                                    Temporada {NOMBRE_TEMPORADA[datos.temporada]} · {datos.anio}
                                </span>
                            )}
                        </div>
                        <p className="mt-2 text-[13px] font-medium" style={{ color: C.apagado }}>{meta || 'Sin datos de logística'}</p>
                    </div>
                    {tagNombres.length > 0 && (
                        <div className="flex gap-2 shrink-0 flex-wrap">
                            {tagNombres.map(t => (
                                <span key={t} className="h-7 px-3 rounded-[7px] flex items-center text-[12px] font-semibold" style={{ border: `1px solid ${C.borde}`, color: '#4b5563' }}>{t}</span>
                            ))}
                        </div>
                    )}
                </Tarjeta>

                {/* ── Diagnóstico ── */}
                <div className="rounded-[14px] p-6 grid gap-8 items-center" style={{ background: C.diagnostico, gridTemplateColumns: 'minmax(0,1.25fr) minmax(0,2fr)' }}>
                    <div className="min-w-0">
                        <p className="m-0 text-[11.5px] font-semibold tracking-[.07em]" style={{ color: 'rgba(255,255,255,.5)' }}>DIAGNÓSTICO</p>
                        <p className="mt-3 text-[27px] leading-[1.25] font-semibold tracking-[-.02em] text-white">{veredicto!.titulo}</p>
                        <p className="mt-3 text-[14px] leading-[1.6] font-medium" style={{ color: 'rgba(255,255,255,.72)' }}>{veredicto!.texto}</p>

                        {!asistencia.reportaAsistencia && (
                            <div className="flex gap-2.5 mt-5 flex-wrap">
                                {telefonoWhatsapp && (
                                    <a
                                        href={`https://wa.me/${telefonoWhatsapp}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="h-[42px] px-[18px] rounded-[9px] flex items-center gap-2 text-[13.5px] font-semibold"
                                        style={{ background: '#fff', color: C.tinta }}
                                    >
                                        <MessageCircle className="w-4 h-4" strokeWidth={2.2} />
                                        Escribirle a {anfitrion?.nombre.split(' ')[0] || 'el anfitrión'}
                                    </a>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5">
                        <Casilla
                            titulo="PRESENTES POR REUNIÓN"
                            valor={asistencia.reportaAsistencia ? numero(asistencia.promedioPresentes) : '—'}
                            delta={asistencia.reportaAsistencia && delta != null ? (
                                <span className="text-[12px] font-semibold" style={{ color: delta >= 0 ? '#7ee2a8' : '#ffb4a8' }}>
                                    {delta >= 0 ? '+' : ''}{numero(delta)}
                                </span>
                            ) : undefined}
                            nota={asistencia.reportaAsistencia
                                ? (promedioIglesia != null ? `Promedio iglesia: ${numero(promedioIglesia)}` : 'Sin referencia de la iglesia esta temporada')
                                : 'No se puede calcular'}
                        />
                        <Casilla
                            titulo="REUNIONES CARGADAS"
                            valor={<>{asistencia.reuniones.length}{asistencia.reunionesEsperadas > 0 && <span className="text-[12px] font-semibold ml-1.5" style={{ color: 'rgba(255,255,255,.5)' }}>de {asistencia.reunionesEsperadas}</span>}</>}
                            nota={notaReuniones}
                            riesgo={!asistencia.reportaAsistencia}
                        />
                        <Casilla
                            titulo="OCUPACIÓN"
                            valor={`${personasInscriptas}/${capacidad || '—'}`}
                            nota={capacidad === 0 ? 'Sin cupo cargado' : ocupacionPct >= 100 ? 'Cupo completo' : `${ocupacionPct}% del cupo`}
                        />
                        <Casilla
                            titulo="CO-ANFITRIÓN"
                            valor={coAnfitrion ? coAnfitrion.nombre : 'Sin cargar'}
                            nota={coAnfitrion ? 'Tiene reemplazo' : 'Si el anfitrión falta, no hay reemplazo'}
                            riesgo={!coAnfitrion}
                        />
                    </div>
                </div>

                {/* ── Asistencia reunión a reunión ── */}
                <Tarjeta className="px-[22px] py-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <p className="m-0 text-[15px] font-semibold" style={{ color: C.tinta }}>Asistencia reunión a reunión</p>
                            <p className="mt-[5px] text-[12.5px] font-medium" style={{ color: C.apagado }}>
                                {asistencia.reportaAsistencia
                                    ? `${asistencia.reuniones.length} ${asistencia.reuniones.length === 1 ? 'reunión cargada' : 'reuniones cargadas'}.`
                                    : `${asistencia.reunionesEsperadas} ${grupo.meetingDay ? `${grupo.meetingDay.toLowerCase()}s` : 'semanas'} transcurridos desde el inicio de la temporada.`}
                            </p>
                        </div>
                        {asistencia.reportaAsistencia && (
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-[7px]">
                                    <span className="w-[9px] h-[9px] rounded-sm" style={{ background: C.azul }} />
                                    <span className="text-[12px] font-semibold" style={{ color: '#4b5563' }}>Presentes</span>
                                </div>
                                {promedioIglesia != null && (
                                    <div className="flex items-center gap-[7px]">
                                        <span className="w-3.5 h-0.5" style={{ background: C.tenue }} />
                                        <span className="text-[12px] font-semibold" style={{ color: '#4b5563' }}>Promedio iglesia {numero(promedioIglesia)}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {asistencia.reportaAsistencia ? (
                        <div className="mt-6" style={{ height: 220 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={datosBarras} margin={{ left: -20, right: 8, top: 4, bottom: 4 }}>
                                    <CartesianGrid vertical={false} stroke={C.bordeSuave} />
                                    <XAxis dataKey="fecha" tick={{ fontFamily: FUENTE, fontSize: 11, fill: C.tenue }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                    <YAxis tick={{ fontFamily: FUENTE, fontSize: 11, fill: C.tenue }} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip
                                        formatter={(v: number, n: string, p: any) => [`${v} de ${p.payload.total}`, 'Presentes']}
                                        contentStyle={{ fontFamily: FUENTE, fontSize: 12.5, borderRadius: 10, border: `1px solid ${C.borde}` }}
                                    />
                                    {promedioIglesia != null && (
                                        <ReferenceLine y={promedioIglesia} stroke={C.tenue} strokeDasharray="5 4" strokeWidth={2} />
                                    )}
                                    <Bar dataKey="presentes" fill={C.azul} radius={[4, 4, 0, 0]} maxBarSize={28} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        // El vacío no se disimula: la misma tira de barras, todas en
                        // cero, con el hallazgo escrito arriba en vez de un gráfico
                        // que finge tener algo para mostrar.
                        <div className="relative mt-6" style={{ height: 140 }}>
                            <div className="flex items-end gap-2 h-full">
                                {Array.from({ length: Math.max(8, Math.min(26, asistencia.reunionesEsperadas || 12)) }).map((_, i) => (
                                    <div key={i} className="flex-1 rounded-t-[3px]" style={{ height: 6, background: '#f1f2f5' }} />
                                ))}
                            </div>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                                <p className="m-0 text-[15px] font-semibold" style={{ color: C.medio }}>
                                    {asistencia.reunionesEsperadas > 0 ? `${asistencia.reunionesEsperadas} reuniones sin ninguna carga` : 'Todavía no pasó ninguna reunión'}
                                </p>
                                <p className="mt-2 max-w-[420px] text-[12.5px] leading-[1.6] font-medium" style={{ color: C.apagado }}>
                                    Cada barra vacía es una reunión que pudo haber pasado y no quedó registrada. Este grupo no aparece en ninguno de los promedios del dashboard.
                                </p>
                            </div>
                        </div>
                    )}
                </Tarjeta>

                {/* ── Constancia de los miembros ── */}
                {asistencia.reportaAsistencia && (constancia.vienen.length > 0 || constancia.desenganchan.length > 0) && (
                    <Tarjeta className="px-[22px] py-5">
                        <p className="m-0 text-[15px] font-semibold" style={{ color: C.tinta }}>Constancia de los miembros</p>
                        <p className="mt-[5px] text-[12.5px] font-medium" style={{ color: C.apagado }}>
                            Sobre las {asistencia.reuniones.length} reuniones cargadas.
                        </p>

                        <div className="grid md:grid-cols-2 gap-x-8 gap-y-5 mt-4">
                            {constancia.vienen.length > 0 && (
                                <div>
                                    <p className="m-0 mb-3 text-[11.5px] font-semibold tracking-[.05em]" style={{ color: C.apagado }}>
                                        VIENEN SIEMPRE · {constancia.vienen.length}
                                    </p>
                                    <div className="flex flex-col gap-2.5">
                                        {constancia.vienen.slice(0, 8).map(m => (
                                            <FilaConstancia key={m.registrationId} nombre={m.nombre} asistidas={m.reunionesAsistidas} total={m.totalReuniones} color={C.verde} />
                                        ))}
                                    </div>
                                </div>
                            )}
                            {constancia.desenganchan.length > 0 && (
                                <div>
                                    <p className="m-0 mb-3 text-[11.5px] font-semibold tracking-[.05em]" style={{ color: C.apagado }}>
                                        SE ESTÁN DESENGANCHANDO · {constancia.desenganchan.length}
                                    </p>
                                    <div className="flex flex-col gap-2.5">
                                        {constancia.desenganchan.slice(0, 8).map(m => (
                                            <FilaConstancia key={m.registrationId} nombre={m.nombre} asistidas={m.reunionesAsistidas} total={m.totalReuniones} color={C.rojo} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Tarjeta>
                )}

                {/* ── Miembros ── */}
                <Tarjeta className="overflow-hidden">
                    <div className="px-[22px] py-4">
                        <p className="m-0 text-[15px] font-semibold" style={{ color: C.tinta }}>Miembros</p>
                        <p className="mt-[5px] text-[12.5px] font-medium" style={{ color: C.tenue }}>
                            {personasInscriptas} {personasInscriptas === 1 ? 'persona' : 'personas'} en {miembros.length} {miembros.length === 1 ? 'inscripción' : 'inscripciones'}
                            {miembros.filter(m => m.esPareja).length > 0 ? `: ${miembros.filter(m => m.esPareja).length} ${miembros.filter(m => m.esPareja).length === 1 ? 'es pareja' : 'son parejas'}.` : '.'}
                        </p>
                    </div>

                    {miembros.length === 0 ? (
                        <div className="px-[22px] py-10 text-center" style={{ borderTop: `1px solid ${C.bordeSuave}` }}>
                            <p className="m-0 text-[14px] font-semibold" style={{ color: C.medio }}>Todavía no hay miembros aprobados</p>
                        </div>
                    ) : (
                        <>
                            <div
                                className="grid gap-4 px-[22px] py-2.5"
                                style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1.2fr) minmax(0,1fr)', background: C.fondo, borderTop: `1px solid ${C.bordeSuave}`, borderBottom: `1px solid ${C.bordeSuave}` }}
                            >
                                <span className="text-[11.5px] font-semibold tracking-[.04em]" style={{ color: C.apagado }}>MIEMBRO</span>
                                <span className="text-[11.5px] font-semibold tracking-[.04em]" style={{ color: C.apagado }}>TELÉFONO</span>
                                <span className="text-[11.5px] font-semibold tracking-[.04em]" style={{ color: C.apagado }}>ASISTENCIA</span>
                            </div>
                            {miembrosVisibles.map(m => (
                                <div
                                    key={m.registrationId}
                                    className="grid gap-4 px-[22px] py-3 items-center"
                                    style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1.2fr) minmax(0,1fr)', borderBottom: `1px solid #f2f3f5` }}
                                >
                                    <div className="min-w-0">
                                        <p className="m-0 text-[13.5px] font-semibold truncate" style={{ color: C.tinta }}>
                                            {m.nombre}{m.esPareja && m.nombrePareja ? ` y ${m.nombrePareja}` : ''}
                                        </p>
                                        {(m.derivadoDe || m.esPareja) && (
                                            <p className="mt-[3px] text-[12px] font-medium truncate" style={{ color: C.tenue }}>
                                                {m.derivadoDe ? `Derivado desde ${m.derivadoDe}` : 'Pareja · una inscripción, dos personas'}
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-[13px] font-medium truncate" style={{ color: C.medio }}>{m.telefono || '—'}</span>
                                    <span className="text-[13px] font-semibold" style={{ color: C.medio }}>
                                        {asistencia.reportaAsistencia ? `${m.reunionesAsistidas}/${m.totalReuniones}` : '—'}
                                    </span>
                                </div>
                            ))}
                            {miembros.length > 8 && (
                                <button
                                    type="button"
                                    onClick={() => setVerTodosMiembros(v => !v)}
                                    className="w-full py-3 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold transition-colors hover:bg-slate-50"
                                    style={{ color: C.azul, borderTop: `1px solid ${C.bordeSuave}` }}
                                >
                                    {verTodosMiembros ? <>Mostrar menos <ChevronUp className="w-3.5 h-3.5" /></> : <>Ver las {miembros.length} inscripciones <ChevronDown className="w-3.5 h-3.5" /></>}
                                </button>
                            )}
                        </>
                    )}
                </Tarjeta>

                {/* ── Liderazgo + Ficha ── */}
                <div className="grid md:grid-cols-2 gap-4">
                    <Tarjeta className="px-[22px] py-5">
                        <p className="m-0 text-[15px] font-semibold" style={{ color: C.tinta }}>Liderazgo</p>
                        <div className="flex items-center gap-[13px] mt-[18px]">
                            <div className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-[13.5px] font-semibold shrink-0" style={{ background: '#eaf0fc', color: C.azul }}>
                                {(anfitrion?.nombre || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <p className="m-0 text-[13.5px] font-semibold" style={{ color: C.tinta }}>{anfitrion?.nombre || 'Sin anfitrión'}</p>
                                <p className="mt-[3px] text-[12.5px] font-medium" style={{ color: C.apagado }}>
                                    Anfitrión{anfitrion?.telefono ? ` · ${anfitrion.telefono}` : ''}
                                </p>
                            </div>
                        </div>

                        {coAnfitrion ? (
                            <div className="flex items-center gap-[13px] mt-3.5">
                                <div className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-[13.5px] font-semibold shrink-0" style={{ background: C.fondo, color: C.medio }}>
                                    {coAnfitrion.nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <p className="m-0 text-[13.5px] font-semibold" style={{ color: C.tinta }}>{coAnfitrion.nombre}</p>
                                    <p className="mt-[3px] text-[12.5px] font-medium" style={{ color: C.apagado }}>
                                        Co-anfitrión{coAnfitrion.telefono ? ` · ${coAnfitrion.telefono}` : ''}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-[11px] p-3.5 mt-3.5" style={{ background: C.ambarFondo, border: `1px solid ${C.ambarBorde}` }}>
                                <p className="m-0 text-[12.5px] font-semibold" style={{ color: C.ambarTexto }}>No tiene co-anfitrión</p>
                                <p className="mt-1.5 text-[12px] leading-[1.55] font-medium" style={{ color: C.apagado }}>
                                    Si {anfitrion?.nombre.split(' ')[0] || 'el anfitrión'} falta, el grupo no tiene quien lo conduzca ni quien cargue la asistencia.
                                    {gruposSinCoAnfitrion && gruposSinCoAnfitrion.total > 0 && ` Pasa en ${gruposSinCoAnfitrion.sinCo} de los ${gruposSinCoAnfitrion.total} grupos de la temporada.`}
                                </p>
                            </div>
                        )}

                        {solicitudesPendientes > 0 && (
                            <p className="mt-3.5 pt-3.5 text-[12.5px] font-medium" style={{ borderTop: `1px solid ${C.bordeSuave}`, color: C.apagado }}>
                                {solicitudesPendientes} {solicitudesPendientes === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'} de revisión.
                            </p>
                        )}
                    </Tarjeta>

                    <Tarjeta className="px-[22px] py-5">
                        <p className="m-0 text-[15px] font-semibold" style={{ color: C.tinta }}>Ficha del grupo</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 mt-[18px]">
                            {[
                                ['Categoría', categoriaNombre || 'Sin categoría'],
                                ['Modalidad', NOMBRE_MODALIDAD[modalidadDe(grupo)]],
                                ['Día y horario', [grupo.meetingDay, grupo.meetingTime].filter(Boolean).join(' ') || '—'],
                                ['Apunta a', `${grupo.targetGender || 'Mixto'} · ${grupo.minAge ?? 0} a ${grupo.maxAge ?? 100} años`],
                                ['Temporada', grupo.startDate && grupo.endDate ? `${fechaCorta(grupo.startDate)} – ${fechaCorta(grupo.endDate)}` : '—'],
                            ].map(([etiqueta, valor]) => (
                                <div key={etiqueta}>
                                    <p className="m-0 text-[11px] font-semibold tracking-[.05em]" style={{ color: C.tenue }}>{(etiqueta as string).toUpperCase()}</p>
                                    <p className="mt-1 text-[13px] font-semibold" style={{ color: C.tinta }}>{valor}</p>
                                </div>
                            ))}
                        </div>
                        {grupo.description && (
                            <p className="mt-4 pt-4 text-[13px] leading-[1.6] font-medium italic" style={{ borderTop: `1px solid ${C.bordeSuave}`, color: C.medio }}>
                                "{grupo.description}"
                            </p>
                        )}
                    </Tarjeta>
                </div>
            </div>
        </div>
    );
};

export default DetalleGrupoReporte;
