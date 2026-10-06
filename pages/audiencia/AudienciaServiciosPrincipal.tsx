import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Check, ChevronDown, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { User } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import NeoModal from '../../components/ui/NeoModal';
import { useScrollRecordado } from '../../src/utils/scrollRecordado';
import {
    aFecha, anioDe, buscarAnioAnterior, calcStats, fechaCorta, fechaNumerica,
    fmt, horarioDe,
} from './datosDeAudiencia';
import SelectorDeRango, { Rango, atajosDeRango, etiquetaDeRango, rangoDelAnio } from './SelectorDeRango';

/**
 * La planilla de Audiencia de Servicios — design-claude/Audiencia de Servicios.
 *
 * Tres capas, de arriba abajo: qué período se está mirando (los filtros), cómo
 * viene ese período (tres números y la tendencia) y el detalle servicio por
 * servicio (las filas). El resumen dejó de ser un panel que había que abrir:
 * si la pantalla existe para ver cómo viene la asistencia, esos números tienen
 * que estar a la vista al entrar.
 *
 * El período es un rango de fechas (SelectorDeRango) y arranca en el último
 * año con datos, no en "todo": una lista que mezcla 2024 con 2026 no se puede
 * leer de corrido. Antes eran dos selects, año y mes, y no había forma de
 * mirar "las últimas seis semanas".
 *
 * El detalle de un servicio se fue a su propia página
 * (/audiencia-servicios/detalles/:id), donde antes eran dos modales sueltos.
 * Acá quedan las tres acciones de la fila: verlo, editarlo y borrarlo.
 */

interface Props { currentUser: User | null; }

const CLAVE_SCROLL = 'audiencia.servicios';
const TODOS = '';

/**
 * El rango elegido sobrevive a ir al detalle de un servicio y volver.
 *
 * La pantalla ya recuerda dónde estaba el scroll (useScrollRecordado): si el
 * rango volviera al año entero, ese scroll caería en otra fila. Va en
 * sessionStorage y no en localStorage: mañana se arranca de nuevo por el año.
 */
const CLAVE_RANGO = 'audiencia.servicios.rango';
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

const leerRangoGuardado = (): Rango | null => {
    try {
        const r = JSON.parse(sessionStorage.getItem(CLAVE_RANGO) || 'null');
        return r && FECHA_ISO.test(r.desde) && FECHA_ISO.test(r.hasta) && r.desde <= r.hasta ? r : null;
    } catch {
        return null;
    }
};

// ─── Piezas chicas ────────────────────────────────────────────────────────

/** Un filtro con forma de píldora: select nativo con la flecha dibujada encima. */
const Filtro: React.FC<{
    etiqueta: string;
    value: string;
    onChange: (v: string) => void;
    options: { label: string; value: string }[];
}> = ({ etiqueta, value, onChange, options }) => (
    <label className="relative block min-w-0">
        <span className="sr-only">{etiqueta}</span>
        <select
            aria-label={etiqueta}
            value={value}
            onChange={e => onChange(e.target.value)}
            className="filtro-pildora h-[42px] w-full cursor-pointer truncate pl-4 pr-9 text-[13px] font-semibold"
        >
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown
            className="pointer-events-none absolute right-3.5 top-[14px] h-[14px] w-[14px] text-black/[.55]"
            strokeWidth={2.6}
        />
    </label>
);

const ConfirmarBorrado: React.FC<{ onConfirm: () => void; onClose: () => void; cargando: boolean }> = ({
    onConfirm, onClose, cargando,
}) => (
    <NeoModal isOpen onClose={onClose} title="Eliminar registro" maxWidth="max-w-md">
        <p className="text-[14px] font-medium leading-[1.6] text-black/[.68]">
            Se borra el servicio y sus números. No se puede deshacer.
        </p>
        <div className="mt-6 flex gap-2.5">
            <button
                onClick={onClose}
                className="h-12 flex-1 rounded-full bg-[#f2f2f0] text-[14px] font-semibold text-[#0a0a0a] transition-colors hover:bg-[#e9e8e5]"
            >
                Cancelar
            </button>
            <button
                onClick={onConfirm}
                disabled={cargando}
                className="h-12 flex-1 rounded-full bg-[#a32218] text-[14px] font-semibold text-white transition-colors hover:bg-[#8c1c13] disabled:opacity-50"
            >
                {cargando ? 'Eliminando…' : 'Eliminar'}
            </button>
        </div>
    </NeoModal>
);

// ─── Pantalla ─────────────────────────────────────────────────────────────

const AudienciaServiciosPrincipal: React.FC<Props> = () => {
    const navigate = useNavigate();

    const [registros, setRegistros] = useState<any[]>([]);
    const [cargando, setCargando] = useState(true);

    const [rango, setRango] = useState<Rango | null>(leerRangoGuardado);
    const [categoria, setCategoria] = useState(TODOS);
    const [horario, setHorario] = useState(TODOS);
    const [busqueda, setBusqueda] = useState('');

    /** Cuál de los servicios del período se compara contra el año anterior. */
    const [elegido, setElegido] = useState<string | null>(null);

    // La planilla vieja dejaba ordenar tocando el encabezado. El listado sigue
    // arrancando por el más nuevo —es lo que se viene a mirar— pero quien
    // necesita leer el año de principio a fin puede darlo vuelta.
    const [masViejoPrimero, setMasViejoPrimero] = useState(false);

    const [aBorrar, setABorrar] = useState<any | null>(null);
    const [borrando, setBorrando] = useState(false);
    const [aviso, setAviso] = useState('');

    const cargar = useCallback(async () => {
        setCargando(true);
        const data = await supabaseService.getServiceStatistics();
        setRegistros(data);
        setCargando(false);
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    useScrollRecordado(CLAVE_SCROLL, !cargando);

    const anios = useMemo(
        () => Array.from(new Set(registros.map(anioDe).filter(Boolean))).sort((a, b) => b - a),
        [registros]
    );

    // El período arranca en el último año con datos, no en el calendario: si
    // todavía no se cargó nada de este año la pantalla abriría vacía sin
    // explicar por qué.
    const rangoInicial = useMemo(() => (anios.length > 0 ? rangoDelAnio(anios[0]) : null), [anios]);
    useEffect(() => {
        if (!rango && rangoInicial) setRango(rangoInicial);
    }, [rango, rangoInicial]);

    useEffect(() => {
        if (!rango) return;
        try { sessionStorage.setItem(CLAVE_RANGO, JSON.stringify(rango)); } catch { /* sin storage, se pierde al volver */ }
    }, [rango]);

    const dentroDelRango = useCallback((r: any) => {
        const f = String(r.service_date || '').slice(0, 10);
        return !!rango && f >= rango.desde && f <= rango.hasta;
    }, [rango]);

    const delRango = useMemo(() => registros.filter(dentroDelRango), [registros, dentroDelRango]);

    // Las opciones salen del período, pero la elegida se queda aunque el rango
    // nuevo no la tenga: si desapareciera del select, el filtro seguiría
    // aplicado sin que se vea cuál es.
    const categorias = useMemo(() => {
        const s = new Set(delRango.map(r => r.category).filter(Boolean));
        if (categoria !== TODOS) s.add(categoria);
        return Array.from(s).sort();
    }, [delRango, categoria]);
    const horarios = useMemo(() => {
        const s = new Set(delRango.map(horarioDe).filter(Boolean));
        if (horario !== TODOS) s.add(horario);
        return Array.from(s).sort();
    }, [delRango, horario]);

    /**
     * Todo menos el rango: es la base de la tendencia, que mira más atrás que
     * el período elegido, y de los puntos del calendario.
     */
    const base = useMemo(() => {
        const t = busqueda.trim().toLowerCase();
        return registros.filter(r => {
            if (categoria !== TODOS && (r.category || '') !== categoria) return false;
            if (horario !== TODOS && horarioDe(r) !== horario) return false;
            if (t) {
                // Las observaciones entran en la búsqueda: son el único lugar donde
                // queda escrito por qué un domingo dio distinto —lluvia, bautismos,
                // un corte del streaming— y encontrar "bautismos" es justamente
                // cómo se llega a esos servicios cuando no se recuerda la fecha.
                const bolsa = [r.name, r.service_date, horarioDe(r), r.category, r.service_type, r.observations]
                    .filter(Boolean).join(' ').toLowerCase();
                if (!bolsa.includes(t)) return false;
            }
            return true;
        });
    }, [registros, categoria, horario, busqueda]);

    /** Los puntos del calendario: cuántos servicios hay cada día, con los mismos filtros. */
    const serviciosPorDia = useMemo(() => {
        const m = new Map<string, number>();
        base.forEach(r => {
            const f = String(r.service_date || '').slice(0, 10);
            if (f) m.set(f, (m.get(f) || 0) + 1);
        });
        return m;
    }, [base]);

    const atajos = useMemo(() => atajosDeRango(anios), [anios]);

    const filas = useMemo(() => {
        const signo = masViejoPrimero ? -1 : 1;
        return base.filter(dentroDelRango).sort((a, b) => {
            const d = (aFecha(b.service_date).getTime() - aFecha(a.service_date).getTime()) * signo;
            return d !== 0 ? d : horarioDe(a).localeCompare(horarioDe(b));
        });
    }, [base, dentroDelRango, masViejoPrimero]);

    /**
     * Los servicios del período que sí tienen asistencia cargada.
     *
     * Los martes no miden auditorio ni online —sólo podcast y oración— así que
     * dan cero. Si entraran en el promedio lo hundirían, y en la tendencia
     * dejarían huecos donde parece que ese día no vino nadie. Siguen listados
     * abajo con sus números; lo que no hacen es contar donde no tienen qué
     * aportar.
     */
    const conAsistencia = useMemo(
        () => filas.filter(r => calcStats(r).totalFinalConOnline > 0),
        [filas]
    );
    const sinAsistencia = filas.length - conAsistencia.length;

    /**
     * Los últimos doce servicios hasta el final del período elegido.
     *
     * Se toman de `base` a propósito: un mes solo suele tener cuatro o cinco
     * servicios, y una tendencia de cinco barras no muestra ninguna tendencia.
     * Así se ve de dónde viene el período que se está mirando, aunque las
     * barras se pasen para atrás —incluso al año anterior, si el rango arranca
     * en enero—.
     */
    const tendencia = useMemo(() => {
        if (conAsistencia.length === 0) return [];
        const corte = Math.max(...conAsistencia.map(r => aFecha(r.service_date).getTime()));
        return [...base]
            .filter(r => aFecha(r.service_date).getTime() <= corte && calcStats(r).totalFinalConOnline > 0)
            .sort((a, b) => {
                const d = aFecha(a.service_date).getTime() - aFecha(b.service_date).getTime();
                return d !== 0 ? d : horarioDe(a).localeCompare(horarioDe(b));
            })
            .slice(-12);
    }, [base, conAsistencia]);

    // Al cambiar de período la selección vieja puede no estar más entre las barras.
    const seleccionado = useMemo(() => {
        const enTendencia = tendencia.find(r => String(r.id) === String(elegido));
        if (enTendencia) return enTendencia;
        return tendencia.length > 0 ? tendencia[tendencia.length - 1] : (conAsistencia[0] || null);
    }, [tendencia, elegido, conAsistencia]);

    const comparable = useMemo(
        () => (seleccionado ? buscarAnioAnterior(seleccionado, registros) : null),
        [seleccionado, registros]
    );

    const resumen = useMemo(() => {
        if (conAsistencia.length === 0) return null;
        const conStats = conAsistencia.map(r => ({ r, s: calcStats(r) }));
        const total = conStats.reduce((a, x) => ({
            presencial: a.presencial + x.s.totalFinal,
            online: a.online + x.s.online,
            vol: a.vol + x.s.totalVol,
            base: a.base + x.s.audNinezSinProfes,
        }), { presencial: 0, online: 0, vol: 0, base: 0 });
        const n = conStats.length;
        const combinado = total.presencial + total.online;
        const mejor = conStats.reduce((a, b) => (b.s.totalFinalConOnline > a.s.totalFinalConOnline ? b : a));
        const menor = conStats.reduce((a, b) => (b.s.totalFinalConOnline < a.s.totalFinalConOnline ? b : a));
        return {
            n,
            promedio: combinado / n,
            promPresencial: total.presencial / n,
            promOnline: total.online / n,
            pctOnline: combinado > 0 ? (total.online / combinado) * 100 : 0,
            pctVol: total.base > 0 ? (total.vol / total.base) * 100 : 0,
            mejor, menor,
        };
    }, [conAsistencia]);

    const maxTendencia = Math.max(1, ...tendencia.map(r => calcStats(r).totalFinalConOnline));

    /** La fecha más nueva del período, sin depender de cómo esté ordenada la lista. */
    const ultimaFecha = filas.reduce(
        (a, r) => (!a || aFecha(r.service_date) > aFecha(a) ? r.service_date : a),
        '' as string
    );

    const rangoMovido = !!rango && !!rangoInicial
        && (rango.desde !== rangoInicial.desde || rango.hasta !== rangoInicial.hasta);
    const hayFiltros = rangoMovido || categoria !== TODOS || horario !== TODOS || busqueda.trim() !== '';
    const limpiar = () => {
        if (rangoInicial) setRango(rangoInicial);
        setCategoria(TODOS); setHorario(TODOS); setBusqueda(''); setElegido(null);
    };

    const borrar = async () => {
        if (!aBorrar) return;
        setBorrando(true);
        const ok = await supabaseService.deleteServiceStatistic(aBorrar.id);
        setBorrando(false);
        if (!ok) { setAviso('No pudimos eliminar el registro.'); setTimeout(() => setAviso(''), 3500); return; }
        setABorrar(null);
        cargar();
        setAviso('Registro eliminado');
        setTimeout(() => setAviso(''), 3000);
    };

    const verDetalle = (r: any) => navigate(`/audiencia-servicios/detalles/${r.id}`);
    const editar = (r: any) => navigate('/audiencia-servicios/new', { state: { record: r } });

    const titulo = rango ? etiquetaDeRango(rango) : 'Servicios';

    const botonRedondo = 'flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-[#f2f2f0] text-[#0a0a0a] transition-colors hover:bg-[#e6e5e1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2';
    const th = 'px-3.5 pb-3 pt-[14px] text-left text-[10.5px] font-semibold uppercase tracking-[0.06em] text-black/[.52]';

    return (
        <div id="audiencia-servicios" className="min-h-screen bg-[#f6f6f4] pb-14">

            {aviso && (
                <div
                    role="status"
                    className="fixed left-1/2 top-20 z-[130] -translate-x-1/2 rounded-full bg-[#0a0a0a] px-5 py-3 text-[13px] font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,.18)]"
                >
                    <span className="flex items-center gap-2"><Check className="h-4 w-4" />{aviso}</span>
                </div>
            )}

            {/* ── Encabezado y filtros ── */}
            <div className="border-b border-[#ecebe8] bg-white">
                <div className="mx-auto max-w-[1360px] px-4 pb-3.5 pt-4 md:px-7 md:pb-[18px] md:pt-5">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-black/[.55]">
                                Audiencia de Servicios
                            </p>
                            <h1 className="mt-[5px] text-[20px] font-semibold tracking-[-0.02em] text-[#0a0a0a] md:text-[24px]">
                                {titulo}
                            </h1>
                        </div>
                        <button
                            onClick={() => navigate('/audiencia-servicios/new')}
                            className="flex h-[46px] flex-none items-center gap-2 rounded-full bg-[#0a0a0a] pl-4 pr-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#242424] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                        >
                            <Plus className="h-4 w-4" strokeWidth={2.4} />
                            <span className="hidden sm:inline">Cargar servicio</span>
                            <span className="sm:hidden">Cargar</span>
                        </button>
                    </div>

                    {!cargando && registros.length > 0 && (
                        <>
                            <div className="mt-3.5 grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,290px)_minmax(0,220px)_minmax(0,190px)]">
                                {rango && (
                                    <div className="col-span-2 md:col-span-1">
                                        <SelectorDeRango
                                            valor={rango}
                                            onCambiar={r => { setRango(r); setElegido(null); }}
                                            serviciosPorDia={serviciosPorDia}
                                            atajos={atajos}
                                        />
                                    </div>
                                )}
                                <Filtro
                                    etiqueta="Categoría"
                                    value={categoria}
                                    onChange={v => { setCategoria(v); setElegido(null); }}
                                    options={[
                                        { label: 'Todas las categorías', value: TODOS },
                                        ...categorias.map(c => ({ label: c, value: c })),
                                    ]}
                                />
                                <Filtro
                                    etiqueta="Horario"
                                    value={horario}
                                    onChange={v => { setHorario(v); setElegido(null); }}
                                    options={[
                                        { label: 'Todos los horarios', value: TODOS },
                                        ...horarios.map(h => ({ label: h, value: h })),
                                    ]}
                                />
                            </div>

                            {/* El buscador no está en el diseño, pero era la única forma de llegar a
                                un servicio por nombre y sigue siendo la más rápida. Busca también
                                dentro de las observaciones. */}
                            <div className="relative mt-2">
                                <Search className="pointer-events-none absolute left-4 top-[13px] h-4 w-4 text-black/[.42]" />
                                <input
                                    type="text"
                                    value={busqueda}
                                    onChange={e => setBusqueda(e.target.value)}
                                    placeholder="Buscar por nombre, fecha, horario u observaciones"
                                    className="h-[42px] w-full pl-10 pr-10 text-[13px] font-medium"
                                />
                                {busqueda && (
                                    <button
                                        onClick={() => setBusqueda('')}
                                        aria-label="Limpiar la búsqueda"
                                        className="absolute right-3 top-[11px] flex h-5 w-5 items-center justify-center rounded-full bg-black/[.08] text-black/60 transition-colors hover:bg-black/15"
                                    >
                                        <X className="h-3 w-3" strokeWidth={2.6} />
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="mx-auto max-w-[1360px] px-4 pt-3.5 md:px-7 md:pt-5">

                {cargando && (
                    <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            {[0, 1, 2].map(i => (
                                <div key={i} className="h-[104px] animate-pulse rounded-[14px] border border-[#e8e9ec] bg-white" />
                            ))}
                        </div>
                        <div className="h-[280px] animate-pulse rounded-[14px] border border-[#e8e9ec] bg-white" />
                        {[0, 1, 2].map(i => (
                            <div key={i} className="h-[120px] animate-pulse rounded-[18px] bg-white md:h-[58px]" />
                        ))}
                    </div>
                )}

                {!cargando && registros.length === 0 && (
                    <div className="flex flex-col items-center rounded-[22px] bg-white px-[22px] py-10 text-center md:px-10 md:py-[60px]">
                        <div className="flex h-14 items-end gap-1.5">
                            <span className="h-[22px] w-3.5 rounded-t bg-[#eceae6]" />
                            <span className="h-[34px] w-3.5 rounded-t bg-[#eceae6]" />
                            <span className="h-7 w-3.5 rounded-t bg-[#eceae6]" />
                            <span className="h-1.5 w-3.5 rounded-t bg-[#eceae6]" />
                        </div>
                        <p className="mt-[22px] text-[19px] font-semibold text-[#0a0a0a]">Todavía no hay servicios cargados</p>
                        <p className="mt-2.5 max-w-[380px] text-[13.5px] font-medium leading-[1.65] text-black/[.62]">
                            Cada servicio se carga después de la reunión. Cuando esté el primero, acá
                            aparecen los promedios, la tendencia y la comparación contra el año anterior.
                        </p>
                        <button
                            onClick={() => navigate('/audiencia-servicios/new')}
                            className="mt-[22px] h-12 rounded-full bg-[#0a0a0a] px-[22px] text-[14.5px] font-semibold text-white transition-colors hover:bg-[#242424]"
                        >
                            Cargar el primero
                        </button>
                    </div>
                )}

                {!cargando && registros.length > 0 && filas.length === 0 && (
                    <div className="flex flex-col items-center rounded-[22px] bg-white px-[22px] py-10 text-center md:px-10 md:py-[60px]">
                        <div className="flex h-14 items-end gap-1.5">
                            <span className="h-[22px] w-3.5 rounded-t bg-[#eceae6]" />
                            <span className="h-[34px] w-3.5 rounded-t bg-[#eceae6]" />
                            <span className="h-7 w-3.5 rounded-t bg-[#eceae6]" />
                            <span className="h-1.5 w-3.5 rounded-t bg-[#eceae6]" />
                        </div>
                        <p className="mt-[22px] text-[19px] font-semibold text-[#0a0a0a]">Ningún servicio con estos filtros</p>
                        <p className="mt-2.5 max-w-[380px] text-[13.5px] font-medium leading-[1.65] text-black/[.62]">
                            Probá con otro rango de fechas, horario o categoría, o mirá el año completo.
                        </p>
                        <div className="mt-[22px] flex flex-wrap justify-center gap-2.5">
                            <button
                                onClick={limpiar}
                                className="h-12 rounded-full bg-[#0a0a0a] px-[22px] text-[14.5px] font-semibold text-white transition-colors hover:bg-[#242424]"
                            >
                                Ver todo {anios[0]}
                            </button>
                            <button
                                onClick={() => navigate('/audiencia-servicios/new')}
                                className="h-12 rounded-full bg-[#f2f2f0] px-[22px] text-[14.5px] font-semibold text-[#0a0a0a] transition-colors hover:bg-[#e6e5e1]"
                            >
                                Cargar un servicio
                            </button>
                        </div>
                    </div>
                )}

                {!cargando && resumen && (
                    <div className="mb-[22px]">
                        {/* ── Tres números del período ── */}
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div className="rounded-[14px] border border-[#e8e9ec] bg-white px-[18px] py-4">
                                <p className="text-[12px] font-semibold text-[#6b7280]">Promedio por servicio</p>
                                <p className="mt-2.5 text-[28px] font-semibold leading-none tracking-[-0.03em] text-[#0f172a]">
                                    {fmt(resumen.promedio)}
                                </p>
                                <p className="mt-1.5 text-[12px] font-medium text-[#6b7280]">
                                    {fmt(resumen.promPresencial)} presencial + {fmt(resumen.promOnline)} online
                                    {sinAsistencia > 0 && (
                                        <>
                                            {' '}· sobre {resumen.n} con asistencia cargada
                                        </>
                                    )}
                                </p>
                            </div>
                            <div className="rounded-[14px] border border-[#e8e9ec] bg-white px-[18px] py-4">
                                <p className="text-[12px] font-semibold text-[#6b7280]">Siguen online</p>
                                <p className="mt-2.5 text-[28px] font-semibold leading-none tracking-[-0.03em] text-[#6d4fc8]">
                                    {Math.round(resumen.pctOnline)}%
                                </p>
                                <p className="mt-1.5 text-[12px] font-medium text-[#6b7280]">del total combinado</p>
                            </div>
                            <div className="rounded-[14px] border border-[#e8e9ec] bg-white px-[18px] py-4">
                                <p className="text-[12px] font-semibold text-[#6b7280]">Son voluntarios</p>
                                <p className="mt-2.5 text-[28px] font-semibold leading-none tracking-[-0.03em] text-[#0f172a]">
                                    {Math.round(resumen.pctVol)}%
                                </p>
                                <p className="mt-1.5 text-[12px] font-medium text-[#6b7280]">de los presentes en el auditorio</p>
                            </div>
                        </div>

                        {/* ── Tendencia y comparación ── */}
                        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">

                            <div className="min-w-0 rounded-[14px] border border-[#e8e9ec] bg-white px-[18px] py-[18px] md:px-5">
                                <div className="flex flex-wrap items-start gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[15px] font-semibold text-[#0f172a]">Tendencia</p>
                                        <p className="mt-1 text-[12.5px] font-medium text-[#6b7280]">
                                            Últimos {tendencia.length} servicios
                                            {categoria !== TODOS ? ` · ${categoria}` : ''}
                                            {horario !== TODOS ? ` · ${horario}` : ''}
                                        </p>
                                    </div>
                                    <div className="flex flex-none gap-3.5">
                                        <span className="flex items-center gap-1.5">
                                            <span className="h-[9px] w-[9px] rounded-sm bg-[#2563eb]" />
                                            <span className="text-[11.5px] font-semibold text-[#4b5563]">Presencial</span>
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <span className="h-[9px] w-[9px] rounded-sm bg-[#a48ce8]" />
                                            <span className="text-[11.5px] font-semibold text-[#4b5563]">Online</span>
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-5 flex h-[170px] items-end gap-1 border-b border-[#e8e9ec] md:gap-2">
                                    {tendencia.map(r => {
                                        const st = calcStats(r);
                                        const activo = seleccionado && String(r.id) === String(seleccionado.id);
                                        return (
                                            <button
                                                key={r.id}
                                                onClick={() => setElegido(String(r.id))}
                                                title={`${fechaCorta(r.service_date)} ${horarioDe(r)} · ${fmt(st.totalFinalConOnline)}`}
                                                className="flex h-full min-w-0 flex-1 flex-col justify-end transition-opacity"
                                                style={{ opacity: activo ? 1 : 0.55 }}
                                            >
                                                <span
                                                    className="block rounded-t bg-[#a48ce8]"
                                                    style={{ height: `${(st.online / maxTendencia) * 100}%` }}
                                                />
                                                <span
                                                    className="block bg-[#2563eb]"
                                                    style={{ height: `${(st.totalFinal / maxTendencia) * 100}%` }}
                                                />
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="mt-[7px] flex gap-1 md:gap-2">
                                    {tendencia.map(r => {
                                        const activo = seleccionado && String(r.id) === String(seleccionado.id);
                                        const d = aFecha(r.service_date);
                                        return (
                                            <span
                                                key={r.id}
                                                className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-center text-[10.5px] font-medium"
                                                style={{ color: activo ? '#0f172a' : '#9ca3af' }}
                                            >
                                                {d.getDate()}/{d.getMonth() + 1}
                                            </span>
                                        );
                                    })}
                                </div>
                                <p className="mt-3.5 text-[12px] font-medium text-[#6b7280]">
                                    Tocá una barra para compararla con el año anterior.
                                </p>
                                <p className="mt-1 text-[12px] font-medium text-[#6b7280]">
                                    El más alto del período fue {fechaCorta(resumen.mejor.r.service_date)} con{' '}
                                    {fmt(calcStats(resumen.mejor.r).totalFinalConOnline)}
                                    {resumen.n > 1 && (
                                        <>
                                            {' '}· el más bajo, {fechaCorta(resumen.menor.r.service_date)} con{' '}
                                            {fmt(calcStats(resumen.menor.r).totalFinalConOnline)}
                                        </>
                                    )}.
                                </p>
                            </div>

                            <div className="min-w-0 rounded-[14px] border border-[#e8e9ec] bg-white px-[18px] py-[18px] md:px-5">
                                <p className="text-[15px] font-semibold text-[#0f172a]">Contra el año anterior</p>
                                <p className="mt-1 text-[12.5px] font-medium text-[#6b7280]">
                                    {seleccionado
                                        ? `${seleccionado.category || 'Sin categoría'} ${horarioDe(seleccionado)} · ${fechaCorta(seleccionado.service_date)}`
                                        : ''}
                                </p>

                                {seleccionado && comparable ? (() => {
                                    const act = calcStats(seleccionado);
                                    const ant = calcStats(comparable.registro);
                                    const max = Math.max(1, act.totalFinalConOnline, ant.totalFinalConOnline);
                                    // El año sale del servicio y no del período: un rango
                                    // puede cruzar de un año a otro.
                                    const anioSel = anioDe(seleccionado);
                                    const d = ant.totalFinalConOnline > 0
                                        ? Math.round((act.totalFinalConOnline / ant.totalFinalConOnline - 1) * 100)
                                        : null;
                                    const barras = [
                                        { r: seleccionado, s: act, etiqueta: `${fechaCorta(seleccionado.service_date)} ${anioSel}`, cAud: '#2563eb', cOn: '#a48ce8' },
                                        { r: comparable.registro, s: ant, etiqueta: `${fechaCorta(comparable.registro.service_date)} ${anioDe(comparable.registro)}`, cAud: '#9fb7ee', cOn: '#d2c6f3' },
                                    ];
                                    return (
                                        <>
                                            <div className="mt-4 flex items-baseline gap-2.5">
                                                <span
                                                    className="text-[32px] font-semibold leading-none tracking-[-0.03em]"
                                                    style={{ color: d === null ? '#6b7280' : d >= 0 ? '#12783f' : '#b42318' }}
                                                >
                                                    {d === null ? '—' : `${d > 0 ? '+' : ''}${d}%`}
                                                </span>
                                                <span className="text-[12.5px] font-medium text-[#6b7280]">
                                                    {d !== null && d >= 0 ? 'más' : 'menos'} que en {anioSel - 1}
                                                </span>
                                            </div>
                                            <div className="mt-4 flex flex-col gap-3">
                                                {barras.map(b => (
                                                    <div key={b.r.id}>
                                                        <div className="flex items-baseline justify-between gap-2.5">
                                                            <span className="text-[12.5px] font-semibold text-[#374151]">{b.etiqueta}</span>
                                                            <span className="text-[13px] font-semibold text-[#0f172a]">{fmt(b.s.totalFinalConOnline)}</span>
                                                        </div>
                                                        <div
                                                            className="mt-1.5 flex h-3.5 overflow-hidden rounded-[5px] bg-[#f2f3f5]"
                                                            style={{ width: `${(b.s.totalFinalConOnline / max) * 100}%` }}
                                                        >
                                                            <span
                                                                className="block"
                                                                style={{
                                                                    width: `${b.s.totalFinalConOnline > 0 ? (b.s.totalFinal / b.s.totalFinalConOnline) * 100 : 0}%`,
                                                                    background: b.cAud,
                                                                }}
                                                            />
                                                            <span
                                                                className="block"
                                                                style={{
                                                                    width: `${b.s.totalFinalConOnline > 0 ? (b.s.online / b.s.totalFinalConOnline) * 100 : 0}%`,
                                                                    background: b.cOn,
                                                                }}
                                                            />
                                                        </div>
                                                        <p className="mt-1 text-[11.5px] font-medium text-[#6b7280]">
                                                            {fmt(b.s.totalFinal)} presencial · {fmt(b.s.online)} online
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                            <button
                                                onClick={() => verDetalle(seleccionado)}
                                                className="mt-4 flex h-[38px] items-center gap-1.5 rounded-full bg-[#f2f2f0] px-4 text-[12px] font-semibold text-[#0a0a0a] transition-colors hover:bg-[#e6e5e1]"
                                            >
                                                Ver este servicio
                                                <ArrowUpRight className="h-3 w-3" strokeWidth={2.4} />
                                            </button>
                                        </>
                                    );
                                })() : (
                                    <div className="mt-4 rounded-[11px] bg-[#f7f8fa] px-4 py-3.5">
                                        <p className="text-[12.5px] font-medium leading-[1.55] text-[#4b5563]">
                                            No hay un servicio equivalente cargado el año anterior. La comparación
                                            aparece cuando existen los dos.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                )}

                {!cargando && filas.length > 0 && !resumen && (
                    <div className="mb-3.5 rounded-[14px] border border-[#e8e9ec] bg-white px-[18px] py-4">
                        <p className="text-[13px] font-medium leading-[1.55] text-[#4b5563]">
                            Estos servicios no miden auditorio ni online, así que no hay promedios ni
                            tendencia para mostrar. Abajo están igual, con lo que sí cargaron.
                        </p>
                    </div>
                )}

                {!cargando && filas.length > 0 && (
                    <>
                        {/* ── Las filas ── */}
                        <div className="mx-0.5 mb-2.5 flex items-baseline justify-between gap-2.5">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-black/[.55]">
                                Servicios cargados
                            </p>
                            <span className="text-[12px] font-semibold text-black/[.55]">
                                {filas.length} {filas.length === 1 ? 'servicio' : 'servicios'}
                                {hayFiltros ? ` de ${registros.length}` : ''}
                            </span>
                        </div>

                        {/* Teléfono: una tarjeta por servicio. */}
                        <div className="flex flex-col gap-2.5 md:hidden">
                            {filas.map(r => {
                                const st = calcStats(r);
                                const pAud = st.totalFinalConOnline > 0 ? (st.totalFinal / st.totalFinalConOnline) * 100 : 0;
                                const pOn = st.totalFinalConOnline > 0 ? (st.online / st.totalFinalConOnline) * 100 : 0;
                                // Un martes no tiene asistencia cargada: mostrarle un 0 grande y
                                // una barra vacía diría que no vino nadie, y lo que pasa es que
                                // eso no se mide. Va lo que sí cargó.
                                const sinAsist = st.totalFinalConOnline === 0;
                                const podcast = Number(r.podcast) || 0;
                                const oracion = Number(r.oracion) || 0;
                                return (
                                    <div key={r.id} className="rounded-[18px] bg-white px-4 pb-3.5 pt-4">
                                        <div className="flex items-start gap-3">
                                            <button onClick={() => verDetalle(r)} className="min-w-0 flex-1 text-left">
                                                <p className="text-[15px] font-semibold text-[#0a0a0a]">{fechaCorta(r.service_date)}</p>
                                                <p className="mt-0.5 truncate text-[12.5px] font-medium text-black/[.6]">
                                                    {r.category || 'Sin categoría'}
                                                    {horarioDe(r) ? ` · ${horarioDe(r)}` : ''}
                                                    {r.name ? ` · ${r.name}` : ''}
                                                </p>
                                            </button>
                                            {!sinAsist && (
                                                <div className="flex-none text-right">
                                                    <p className="text-[22px] font-semibold leading-none tracking-[-0.025em] text-[#0a0a0a]">
                                                        {fmt(st.totalFinalConOnline)}
                                                    </p>
                                                    <p className="mt-1 text-[11px] font-medium text-black/[.55]">total con online</p>
                                                </div>
                                            )}
                                        </div>

                                        {sinAsist ? (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <span className="flex h-7 items-center rounded-full bg-[#f2f2f0] px-2.5 text-[12px] font-semibold text-[#0a0a0a]">
                                                    Podcast {fmt(podcast)}
                                                </span>
                                                <span className="flex h-7 items-center rounded-full bg-[#f2f2f0] px-2.5 text-[12px] font-semibold text-[#0a0a0a]">
                                                    Oración {fmt(oracion)}
                                                </span>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="mt-3.5 flex h-2 overflow-hidden rounded-full bg-[#f2f2f0]">
                                                    <span className="block bg-[#2563eb]" style={{ width: `${pAud}%` }} />
                                                    <span className="block bg-[#a48ce8]" style={{ width: `${pOn}%` }} />
                                                </div>
                                                <div className="mt-2 flex justify-between gap-2.5">
                                                    <span className="text-[12px] font-semibold text-[#1d4ed8]">{fmt(st.totalFinal)} presencial</span>
                                                    <span className="text-[12px] font-semibold text-[#6d4fc8]">{fmt(st.online)} online</span>
                                                </div>
                                            </>
                                        )}

                                        <div className="mt-3 flex items-center gap-2 border-t border-[#f2f2f0] pt-3">
                                            {!sinAsist && (
                                                <span className="flex h-7 flex-none items-center gap-1.5 rounded-full bg-[#f2f2f0] px-2.5 text-[12px] font-semibold text-[#0a0a0a]">
                                                    {Math.round(st.pctVol)}%
                                                    <span className="font-semibold text-black/[.58]">vol · {fmt(st.totalVol)}</span>
                                                </span>
                                            )}
                                            <span className="min-w-0 flex-1" />
                                            <button onClick={() => verDetalle(r)} className={botonRedondo} title="Ver detalles" aria-label="Ver detalles">
                                                <ArrowUpRight className="h-[15px] w-[15px]" strokeWidth={2.3} />
                                            </button>
                                            <button onClick={() => editar(r)} className={botonRedondo} title="Editar" aria-label="Editar">
                                                <Pencil className="h-[14px] w-[14px]" strokeWidth={2.2} />
                                            </button>
                                            <button onClick={() => setABorrar(r)} className={botonRedondo} title="Eliminar" aria-label="Eliminar">
                                                <Trash2 className="h-[14px] w-[14px]" strokeWidth={2.2} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Escritorio: la planilla. */}
                        <div className="hidden overflow-hidden rounded-[18px] bg-white md:block">
                            <table className="w-full table-fixed">
                                <colgroup>
                                    <col className="w-[15%]" />
                                    <col className="w-[8%]" />
                                    <col className="w-[10%]" />
                                    <col className="w-[9%]" />
                                    <col className="w-[11%]" />
                                    <col className="w-[8%]" />
                                    <col className="w-[13%]" />
                                    <col className="w-[16%]" />
                                    <col className="w-[10%]" />
                                </colgroup>
                                <thead>
                                    <tr className="border-b border-[#eeeeec]">
                                        <th className={`${th} !p-0`}>
                                            <button
                                                onClick={() => setMasViejoPrimero(v => !v)}
                                                title={masViejoPrimero ? 'Mostrar primero el más nuevo' : 'Mostrar primero el más viejo'}
                                                className="flex w-full items-center gap-1 px-3.5 pb-3 pt-[14px] text-left text-[10.5px] font-semibold uppercase tracking-[0.06em] text-black/[.52] transition-colors hover:text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-inset"
                                            >
                                                Fecha
                                                <ChevronDown
                                                    className={`h-3 w-3 transition-transform ${masViejoPrimero ? 'rotate-180' : ''}`}
                                                    strokeWidth={2.6}
                                                />
                                            </button>
                                        </th>
                                        <th className={th}>Horario</th>
                                        <th className={`${th} text-right`}>Presencial</th>
                                        <th className={`${th} bg-[#f7f4fd] text-right !text-[#6d4fc8]`}>Online</th>
                                        <th className={`${th} bg-[#f7f4fd] text-right !text-[#6d4fc8]`}>Total c/ online</th>
                                        <th className={`${th} text-right`}>Volunt.</th>
                                        <th className={th}>% Voluntarios</th>
                                        <th className={th}>Observaciones</th>
                                        <th className={`${th} text-right`}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filas.map(r => {
                                        const st = calcStats(r);
                                        const pct = Math.round(st.pctVol);
                                        const sinAsist = st.totalFinalConOnline === 0;
                                        const guion = <span className="text-black/25">—</span>;
                                        return (
                                            <tr key={r.id} className="border-b border-[#f4f4f2] transition-colors hover:bg-[#fafafa]">
                                                <td className="min-w-0 py-2.5 pl-5 pr-3.5">
                                                    <p className="text-[13.5px] font-semibold text-[#0a0a0a]">{fechaCorta(r.service_date)}</p>
                                                    <p className="mt-0.5 truncate text-[11.5px] font-medium text-black/[.55]" title={r.name || r.category || ''}>
                                                        {r.category || 'Sin categoría'}{r.name ? ` · ${r.name}` : ''}
                                                    </p>
                                                </td>
                                                <td className="px-3.5 text-[13px] font-medium text-black/[.66]">{horarioDe(r) || '—'}</td>
                                                <td className="px-3.5 text-right text-[13.5px] font-semibold text-[#0a0a0a]">
                                                    {sinAsist ? guion : fmt(st.totalFinal)}
                                                </td>
                                                <td className="bg-[#f7f4fd] px-3.5 text-right text-[13.5px] font-semibold text-[#6d4fc8]">
                                                    {st.online > 0 ? fmt(st.online) : guion}
                                                </td>
                                                <td className="bg-[#f7f4fd] px-3.5 text-right text-[14px] font-bold text-[#0a0a0a]">
                                                    {sinAsist ? guion : fmt(st.totalFinalConOnline)}
                                                </td>
                                                <td className="px-3.5 text-right text-[13.5px] font-semibold text-[#0a0a0a]">
                                                    {sinAsist ? guion : fmt(st.totalVol)}
                                                </td>
                                                <td className="px-3.5">
                                                    {sinAsist ? (
                                                        <span className="text-[12.5px] font-medium text-black/[.38]">No se mide</span>
                                                    ) : (
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#f0efec]">
                                                                <div className="h-full bg-[#0a0a0a]" style={{ width: `${Math.min(100, pct * 4)}%` }} />
                                                            </div>
                                                            <span className="w-9 text-right text-[12.5px] font-bold text-[#0a0a0a]">{pct}%</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="min-w-0 px-3.5">
                                                    <span
                                                        className="block truncate text-[12.5px] font-medium"
                                                        style={{ color: r.observations ? 'rgba(0,0,0,.66)' : 'rgba(0,0,0,.38)' }}
                                                        title={r.observations || ''}
                                                    >
                                                        {r.observations || 'Sin observaciones'}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 pl-1.5 pr-4">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => verDetalle(r)}
                                                            title="Ver detalles"
                                                            aria-label="Ver detalles"
                                                            className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#f2f2f0] text-[#0a0a0a] transition-colors hover:bg-[#e6e5e1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-1"
                                                        >
                                                            <ArrowUpRight className="h-[14px] w-[14px]" strokeWidth={2.3} />
                                                        </button>
                                                        <button
                                                            onClick={() => editar(r)}
                                                            title="Editar"
                                                            aria-label="Editar"
                                                            className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#f2f2f0] text-[#0a0a0a] transition-colors hover:bg-[#e6e5e1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-1"
                                                        >
                                                            <Pencil className="h-[13px] w-[13px]" strokeWidth={2.2} />
                                                        </button>
                                                        <button
                                                            onClick={() => setABorrar(r)}
                                                            title="Eliminar"
                                                            aria-label="Eliminar"
                                                            className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#f2f2f0] text-[#0a0a0a] transition-colors hover:bg-[#f7dedb] hover:text-[#a32218] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a32218] focus-visible:ring-offset-1"
                                                        >
                                                            <Trash2 className="h-[13px] w-[13px]" strokeWidth={2.2} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <div className="border-t border-[#f4f4f2] px-5 py-3">
                                <p className="text-[11.5px] font-medium text-black/[.5]">
                                    {filas.length} {filas.length === 1 ? 'servicio' : 'servicios'} en pantalla ·{' '}
                                    {registros.length} cargados en total
                                    {conAsistencia.length > 0
                                        ? ` · el último es del ${fechaNumerica(ultimaFecha)}`
                                        : ''}
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {aBorrar && (
                <ConfirmarBorrado onConfirm={borrar} onClose={() => setABorrar(null)} cargando={borrando} />
            )}
        </div>
    );
};

export default AudienciaServiciosPrincipal;
