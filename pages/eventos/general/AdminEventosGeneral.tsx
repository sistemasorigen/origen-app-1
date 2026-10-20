// ════════════════════════════════════════════════════════════════════════
// /eventos/admin/general — la lista de los eventos de /eventos.
//
// Implementa design-claude/Eventos Generales.dc.html (pantalla "lista").
//
// Lo que el diseño cambió respecto de la tabla anterior:
//
//   · Los eventos se agrupan POR AÑO, y el año en curso se parte en dos:
//     primero lo que viene, de la fecha más cercana en adelante, y después
//     "YA PASARON", del más reciente al más viejo. Una tabla ordenada por
//     fecha a secas abre en enero, que es lo que menos importa.
//   · Las acciones salen de la fila: en la compu aparecen al pasar por
//     encima, y en el teléfono la fila entera abre un panel con todo. Tres
//     botones por fila en un teléfono no entran, y antes la tabla se
//     recortaba.
//   · Eliminar pide confirmación con el nombre adentro, no un "¿Confirmar?"
//     que reemplaza al botón.
// ════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { ChevronDown, ChevronLeft, Eye, EyeOff, Loader2, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import {
    getEventosGeneralAdmin, toggleEventoGeneralVisibility, deleteEventoGeneral,
} from '../../../services/supabaseService';
import { EventoGeneral, User } from '../../../types';
import {
    T, rotulo, rotuloChico, botonBase, ROJO_TEXTO, ROJO_FONDO,
    Pastilla, pastillasDe, IconoCalendario, Hoja, Aviso, useAviso,
    meta, esPasado, normalizar, hoyIso,
} from './piezas';

interface Props {
    currentUser: User;
}

/**
 * Las dos entradas y el destello de "recién guardado".
 *
 * Van en un <style> porque llevan retardo escalonado por sección, que no se
 * puede escribir como clase.
 */
const ESTILOS = `
@keyframes egIn { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
@keyframes egPulse { 0%, 100% { opacity: 1 } 50% { opacity: .55 } }
@keyframes egHi { 0%, 35% { background-color: rgba(214,170,60,.24) } 100% { background-color: transparent } }
#eventos-generales .eg-entra { animation: egIn .35s ease both }
#eventos-generales .eg-late { animation: egPulse 1.2s ease-in-out infinite }
#eventos-generales .eg-destaca { animation: egHi 1.9s ease both }
@media (prefers-reduced-motion: reduce) {
    #eventos-generales *, #eventos-generales *::before, #eventos-generales *::after {
        animation: none !important;
        transition: none !important;
    }
}
`;

/**
 * La tabla de la compu y la lista del teléfono son dos cosas distintas, no
 * la misma con otro ancho: se monta una sola. Mismo criterio que el resto
 * de los tableros.
 */
const useEsCompu = () => {
    const consulta = '(min-width: 1024px)';
    const [es, setEs] = useState(() => typeof window !== 'undefined' && window.matchMedia(consulta).matches);
    useEffect(() => {
        const mq = window.matchMedia(consulta);
        const cambiar = () => setEs(mq.matches);
        mq.addEventListener('change', cambiar);
        return () => mq.removeEventListener('change', cambiar);
    }, []);
    return es;
};

/** Las cinco columnas de la tabla. Cabecera y filas usan la MISMA grilla. */
const GRILLA = 'grid-cols-[48px_minmax(0,1.5fr)_minmax(0,1fr)_190px_176px] gap-[18px] items-center';

const BOTON_REDONDO = `w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-colors ${T.chipHover}`;

/** El cuadradito de la portada. Sin imagen, el ícono de calendario. */
const Portada: React.FC<{ url?: string; lado: number }> = ({ url, lado }) => (
    <span
        className={`shrink-0 rounded-[14px] flex items-center justify-center overflow-hidden ${url ? '' : `${T.chip} ${T.suave}`}`}
        style={{ width: lado, height: lado }}
    >
        {url
            ? <img src={url} alt="" className="w-full h-full object-cover" />
            : <IconoCalendario className={lado >= 56 ? 'w-[22px] h-[22px]' : 'w-5 h-5'} />}
    </span>
);

type Overlay =
    | { tipo: 'detalle'; id: string }
    | { tipo: 'eliminar'; id: string }
    | null;

const AdminEventosGeneral: React.FC<Props> = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const esCompu = useEsCompu();
    const sinMovimiento = useReducedMotion();
    const { aviso, avisar } = useAviso();

    const [eventos, setEventos] = useState<EventoGeneral[]>([]);
    const [cargando, setCargando] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [abiertos, setAbiertos] = useState<Record<number, boolean>>({});
    const [overlay, setOverlay] = useState<Overlay>(null);
    const [cambiando, setCambiando] = useState<string | null>(null);
    const [borrando, setBorrando] = useState<string | null>(null);
    /** El que se acaba de guardar: se enciende un momento para encontrarlo. */
    const [destacado, setDestacado] = useState<string | null>(null);

    const hoy = useMemo(() => hoyIso(), []);
    const anioActual = Number(hoy.slice(0, 4));

    const pedir = useCallback(async () => {
        setCargando(true);
        const data = await getEventosGeneralAdmin();
        setEventos(data);
        setCargando(false);
        // El año en curso abre desplegado; los demás, cerrados.
        setAbiertos(a => (Object.keys(a).length ? a : { [anioActual]: true }));
    }, [anioActual]);

    useEffect(() => { void pedir(); }, [pedir]);

    /**
     * Al volver de guardar, el formulario manda `?guardado=<id>`: se
     * despliega su año, se lo enciende un momento y se limpia el parámetro
     * para que una recarga no vuelva a encenderlo.
     */
    useEffect(() => {
        const id = new URLSearchParams(location.search).get('guardado');
        if (!id || cargando) return;
        const ev = eventos.find(e => e.id === id);
        if (ev) {
            setAbiertos(a => ({ ...a, [Number(ev.startDate.slice(0, 4))]: true }));
            setDestacado(id);
            window.setTimeout(() => setDestacado(d => (d === id ? null : d)), 1900);
        }
        navigate({ search: '' }, { replace: true });
    }, [location.search, cargando, eventos, navigate]);

    const alternarVisible = async (ev: EventoGeneral) => {
        setCambiando(ev.id);
        const ok = await toggleEventoGeneralVisibility(ev.id, !ev.isVisible);
        setCambiando(null);
        if (!ok) { avisar('No se pudo cambiar. Probá de nuevo.'); return; }
        setEventos(prev => prev.map(e => (e.id === ev.id ? { ...e, isVisible: !e.isVisible } : e)));
        avisar(ev.isVisible ? 'Oculto de /eventos' : 'Visible en /eventos');
    };

    const eliminar = async (id: string) => {
        setBorrando(id);
        const ok = await deleteEventoGeneral(id);
        setBorrando(null);
        setOverlay(null);
        if (!ok) { avisar('No se pudo eliminar. Probá de nuevo.'); return; }
        setEventos(prev => prev.filter(e => e.id !== id));
        avisar('Evento eliminado');
    };

    const editar = (id: string) => navigate(`/eventos/admin/general/crear-evento?id=${id}`);

    // ── Lo que se muestra ───────────────────────────────────────────────
    const consulta = busqueda.trim();
    const filtrados = useMemo(() => {
        if (!consulta) return eventos;
        const q = normalizar(consulta);
        return eventos.filter(e => normalizar(e.name).includes(q));
    }, [eventos, consulta]);

    /**
     * Un año, sus filas y su cuenta.
     *
     * El año en curso se parte: primero lo que viene y después lo que ya
     * pasó. Los otros años van enteros, del más viejo al más nuevo: ahí ya
     * no hay "lo que viene", es historia y se lee como una línea de tiempo.
     */
    const anios = useMemo(() => {
        const porAnio = new Map<number, EventoGeneral[]>();
        for (const e of filtrados) {
            const y = Number(e.startDate.slice(0, 4));
            const lista = porAnio.get(y);
            if (lista) lista.push(e);
            else porAnio.set(y, [e]);
        }

        return [...porAnio.keys()].sort((a, b) => b - a).map(anio => {
            const suyos = porAnio.get(anio)!;
            const porFecha = (a: EventoGeneral, b: EventoGeneral) => a.startDate.localeCompare(b.startDate);

            let filas: Array<{ tipo: 'rotulo'; texto: string } | { tipo: 'evento'; ev: EventoGeneral }> = [];
            if (anio === anioActual) {
                const vienen = suyos.filter(e => !esPasado(e.startDate, hoy)).sort(porFecha);
                const pasaron = suyos.filter(e => esPasado(e.startDate, hoy)).sort((a, b) => porFecha(b, a));
                filas = vienen.map(ev => ({ tipo: 'evento' as const, ev }));
                if (pasaron.length) {
                    filas.push({ tipo: 'rotulo', texto: 'YA PASARON' });
                    filas.push(...pasaron.map(ev => ({ tipo: 'evento' as const, ev })));
                }
            } else {
                filas = [...suyos].sort(porFecha).map(ev => ({ tipo: 'evento' as const, ev }));
            }

            const ocultos = suyos.filter(e => !e.isVisible).length;
            return {
                anio,
                filas,
                cuenta: `${suyos.length} ${suyos.length === 1 ? 'evento' : 'eventos'}`
                    + (ocultos ? ` · ${ocultos} ${ocultos === 1 ? 'oculto' : 'ocultos'}` : ''),
            };
        });
    }, [filtrados, anioActual, hoy]);

    // Buscando, todas las secciones se abren: si no, el resultado podría
    // estar adentro de un año plegado y la búsqueda parecería no encontrar.
    const estaAbierto = (anio: number) => (consulta ? true : !!abiertos[anio]);
    const alternarAnio = (anio: number) => {
        if (consulta) return;
        setAbiertos(a => ({ ...a, [anio]: !a[anio] }));
    };

    const elDelOverlay = overlay ? eventos.find(e => e.id === overlay.id) ?? null : null;
    const vacio = !cargando && eventos.length === 0;
    const sinResultados = !cargando && eventos.length > 0 && !!consulta && filtrados.length === 0;

    // ── Pantalla ────────────────────────────────────────────────────────
    return (
        <div id="eventos-generales" className={`min-h-screen ${T.fondo} ${T.tinta} ${T.fuente}`}>
            <style>{ESTILOS}</style>

            <div className="eg-entra max-w-[1160px] mx-auto px-4 pt-[59px] pb-14 lg:px-10 lg:pt-12 lg:pb-20">

                <button
                    type="button"
                    onClick={() => navigate('/panel-eventos')}
                    aria-label="Volver a Panel de eventos"
                    className={`w-11 h-11 rounded-full flex items-center justify-center ${T.chip} ${T.chipHover} ${T.foco} transition-colors`}
                >
                    <ChevronLeft className="w-[18px] h-[18px]" strokeWidth={2.2} />
                </button>

                {/* ── Encabezado ── */}
                <div className="flex flex-wrap items-end gap-x-6 gap-y-4 mt-[18px]">
                    <div className="flex-1 basis-[320px] min-w-0">
                        <p className={rotulo}>EVENTOS</p>
                        <h1 className="mt-2 m-0 text-[30px] lg:text-[36px] leading-[1.08] font-semibold tracking-[-.03em]">
                            Eventos generales
                        </h1>
                        <p className={`mt-2 m-0 text-[15.5px] leading-[1.5] ${T.suave}`}>
                            Lo que se publica en /eventos y en el inicio.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/eventos/admin/general/crear-evento')}
                        className={`${botonBase} ${T.primario} ${T.foco} basis-full w-full h-[58px] text-[16.5px] px-[22px]
                            lg:basis-auto lg:w-auto lg:h-[50px] lg:text-[15px] hover:opacity-[.88] active:scale-[.98]`}
                    >
                        <Plus className="w-[18px] h-[18px]" strokeWidth={2.4} />
                        Nuevo evento
                    </button>
                </div>

                {/* ── Buscador ── */}
                {/* El anillo de foco lo lleva la píldora, no el campo: el
                    campo es transparente adentro (ver index.html). */}
                <div className={`flex items-center gap-2.5 h-[52px] mt-5 pl-[18px] pr-2 rounded-full lg:max-w-[420px]
                    ${T.superficie} shadow-[inset_0_0_0_1px_rgba(0,0,0,.06)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,.07)]
                    focus-within:ring-4 focus-within:ring-black/15 dark:focus-within:ring-white/20`}
                >
                    <Search className={`w-[18px] h-[18px] shrink-0 ${T.suave}`} strokeWidth={2.2} />
                    <input
                        type="search"
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        placeholder="Buscar por nombre"
                        aria-label="Buscar eventos por nombre"
                        className="flex-1 min-w-0 h-full border-0 bg-transparent text-[16px] font-medium outline-none placeholder:text-black/40 dark:placeholder:text-white/40"
                    />
                    {!!busqueda && (
                        <button
                            type="button"
                            onClick={() => setBusqueda('')}
                            aria-label="Limpiar la búsqueda"
                            className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${T.chip} ${T.chipHover} ${T.foco} transition-colors`}
                        >
                            <X className="w-3.5 h-3.5" strokeWidth={2.4} />
                        </button>
                    )}
                </div>

                {/* ── Cargando ── */}
                {cargando && (
                    <div aria-busy="true" className="mt-7">
                        <div className={`eg-late h-[26px] w-[90px] mb-3.5 ml-1.5 rounded-lg bg-[#ecebe7] dark:bg-[#262624]`} />
                        <div className={`rounded-[26px] ${T.tarjeta}`}>
                            {['58%', '46%', '62%', '50%'].map((ancho, i) => (
                                <div key={ancho} className={`flex items-center gap-3.5 px-4 py-3.5 ${i ? `border-t ${T.linea}` : ''}`}>
                                    <div className="eg-late w-14 h-14 shrink-0 rounded-[14px] bg-[#ecebe7] dark:bg-[#262624]" />
                                    <div className="flex-1 min-w-0">
                                        <div className="eg-late h-3.5 rounded-lg bg-[#ecebe7] dark:bg-[#262624]" style={{ width: ancho }} />
                                        <div className="eg-late h-[11px] mt-2.5 rounded-lg bg-[#ecebe7] dark:bg-[#262624]" style={{ width: `calc(${ancho} - 18%)` }} />
                                    </div>
                                    <div className="eg-late w-16 h-6 rounded-full bg-[#ecebe7] dark:bg-[#262624]" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Todavía no hay nada ── */}
                {vacio && (
                    <div className={`mt-7 px-6 py-[60px] rounded-[28px] flex flex-col items-center text-center ${T.tarjeta}`}>
                        <span className={`w-16 h-16 rounded-full flex items-center justify-center ${T.chip} ${T.suave}`}>
                            <IconoCalendario className="w-7 h-7" grosor={1.6} />
                        </span>
                        <p className="mt-5 m-0 text-[18px] font-semibold">Todavía no hay eventos</p>
                        <p className={`mt-2 m-0 text-[14.5px] leading-[1.55] ${T.suave}`}>
                            Creá el primero y va a aparecer en /eventos.
                        </p>
                        <button
                            type="button"
                            onClick={() => navigate('/eventos/admin/general/crear-evento')}
                            className={`${botonBase} ${T.primario} ${T.foco} h-[50px] px-[22px] mt-[22px] text-[15px] hover:opacity-[.88]`}
                        >
                            Nuevo evento
                        </button>
                    </div>
                )}

                {/* ── La búsqueda no encontró nada ── */}
                {sinResultados && (
                    <div className={`mt-7 px-6 py-12 rounded-[28px] flex flex-col items-center text-center ${T.tarjeta}`}>
                        <p className="m-0 text-[17px] font-semibold [overflow-wrap:anywhere]">
                            Ningún evento coincide con «{consulta}»
                        </p>
                        <button
                            type="button"
                            onClick={() => setBusqueda('')}
                            className={`${botonBase} ${T.chip} ${T.chipHover} ${T.foco} h-11 px-[18px] mt-[18px] text-[14px]`}
                        >
                            Limpiar la búsqueda
                        </button>
                    </div>
                )}

                {/* ── Un año, una sección ── */}
                {anios.map(({ anio, filas, cuenta }, i) => {
                    const abierto = estaAbierto(anio);
                    return (
                        <section
                            key={anio}
                            className={`eg-entra ${i === 0 ? 'mt-7' : 'mt-[18px]'}`}
                            style={{ animationDelay: `${i * 60}ms` }}
                        >
                            <button
                                type="button"
                                onClick={() => alternarAnio(anio)}
                                aria-expanded={abierto}
                                aria-controls={`eg-anio-${anio}`}
                                disabled={!!consulta}
                                className={`w-full min-h-[56px] mb-3 pl-1.5 pr-1 py-1.5 rounded-[20px]
                                    flex items-center gap-3 text-left transition-colors ${T.pasar} ${T.foco}
                                    disabled:cursor-default`}
                            >
                                <span className="text-[26px] lg:text-[30px] leading-none font-semibold tracking-[-.03em]">
                                    {anio}
                                </span>
                                <span className={`text-[14.5px] font-semibold ${T.suave}`}>{cuenta}</span>
                                <span className={`ml-auto w-11 h-11 shrink-0 rounded-full flex items-center justify-center ${T.chip}`}>
                                    <ChevronDown
                                        className={`w-[18px] h-[18px] transition-transform duration-[250ms] ${abierto ? 'rotate-180' : ''}`}
                                        strokeWidth={2.2}
                                        aria-hidden="true"
                                    />
                                </span>
                            </button>

                            <div
                                id={`eg-anio-${anio}`}
                                className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(.3,.7,.2,1)]"
                                style={{ gridTemplateRows: abierto ? '1fr' : '0fr' }}
                                inert={!abierto}
                            >
                                <div className="overflow-hidden min-h-0">
                                    <div className={`rounded-[26px] overflow-hidden mb-1 ${T.tarjeta}`}>
                                        {esCompu && (
                                            <div className={`grid ${GRILLA} px-5 pt-3.5 pb-2.5 border-b ${T.linea}`}>
                                                <span />
                                                <span className={rotuloChico}>NOMBRE</span>
                                                <span className={rotuloChico}>FECHA Y HORARIO</span>
                                                <span className={rotuloChico}>ESTADO</span>
                                                <span />
                                            </div>
                                        )}

                                        {filas.map((fila, j) => {
                                            if (fila.tipo === 'rotulo') {
                                                return (
                                                    <p key="ya-pasaron" className={`m-0 px-4 pt-[18px] pb-2 border-t ${T.linea} ${rotulo}`}>
                                                        {fila.texto}
                                                    </p>
                                                );
                                            }

                                            const ev = fila.ev;
                                            const anterior = filas[j - 1];
                                            const conLinea = !!anterior && anterior.tipo === 'evento';
                                            const saliendo = borrando === ev.id;
                                            const pastillas = pastillasDe(ev, hoy);

                                            return (
                                                <div
                                                    key={ev.id}
                                                    className={`overflow-hidden transition-[max-height,opacity] duration-[280ms] ${destacado === ev.id ? 'eg-destaca' : ''}`}
                                                    style={{ maxHeight: saliendo ? 0 : 160, opacity: saliendo ? 0 : 1 }}
                                                >
                                                    {conLinea && <div className={`h-px ml-[86px] ${T.linea.replace('border-', 'bg-')}`} />}

                                                    {!esCompu ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setOverlay({ tipo: 'detalle', id: ev.id })}
                                                            aria-label={`${ev.name}, ${meta(ev)}, ${ev.isVisible ? 'visible' : 'oculto'}`}
                                                            className={`w-full min-h-[80px] flex items-center gap-3.5 px-4 py-3 text-left ${T.foco}`}
                                                        >
                                                            <Portada url={ev.imageUrl} lado={56} />
                                                            <span className="flex-1 min-w-0 flex flex-col gap-1">
                                                                <span className="text-[15.5px] leading-[1.3] font-semibold truncate">{ev.name}</span>
                                                                <span className={`text-[13.5px] font-medium ${T.suave}`}>{meta(ev)}</span>
                                                            </span>
                                                            <span className="shrink-0 flex flex-col items-end gap-[5px]">
                                                                {pastillas.map(p => (
                                                                    <Pastilla key={p.texto} clase={p.clase}>{p.texto}</Pastilla>
                                                                ))}
                                                            </span>
                                                        </button>
                                                    ) : (
                                                        <div
                                                            role="button"
                                                            tabIndex={0}
                                                            onClick={() => setOverlay({ tipo: 'detalle', id: ev.id })}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOverlay({ tipo: 'detalle', id: ev.id }); }
                                                            }}
                                                            aria-label={`${ev.name}, ${meta(ev)}, ${ev.isVisible ? 'visible' : 'oculto'}`}
                                                            className={`group grid ${GRILLA} px-5 py-3 cursor-pointer transition-colors ${T.pasar} ${T.foco}`}
                                                        >
                                                            <Portada url={ev.imageUrl} lado={48} />
                                                            <span className="min-w-0 text-[15px] font-semibold truncate" title={ev.name}>{ev.name}</span>
                                                            <span className={`min-w-0 text-[14px] font-medium truncate ${T.suave}`}>{meta(ev)}</span>
                                                            <span className="flex flex-wrap gap-1.5">
                                                                {pastillas.map(p => (
                                                                    <Pastilla key={p.texto} clase={p.clase}>{p.texto}</Pastilla>
                                                                ))}
                                                            </span>
                                                            <span className="flex items-center justify-end gap-1">
                                                                {/* Las tres acciones aparecen al pasar por encima o al
                                                                    llegar con el teclado. El "…" está siempre: es la
                                                                    salida para quien no usa mouse y la única en el
                                                                    teléfono. */}
                                                                <span className={`flex gap-1 transition-opacity duration-150
                                                                    opacity-0 pointer-events-none
                                                                    group-hover:opacity-100 group-hover:pointer-events-auto
                                                                    group-focus-within:opacity-100 group-focus-within:pointer-events-auto`}
                                                                >
                                                                    <button
                                                                        type="button"
                                                                        onClick={e => { e.stopPropagation(); editar(ev.id); }}
                                                                        aria-label={`Editar ${ev.name}`}
                                                                        className={`${BOTON_REDONDO} ${T.chip} ${T.foco}`}
                                                                    >
                                                                        <Pencil className="w-4 h-4" strokeWidth={2} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={e => { e.stopPropagation(); void alternarVisible(ev); }}
                                                                        aria-label={ev.isVisible ? `Ocultar ${ev.name} de /eventos` : `Mostrar ${ev.name} en /eventos`}
                                                                        className={`${BOTON_REDONDO} ${T.chip} ${T.foco}`}
                                                                    >
                                                                        {cambiando === ev.id
                                                                            ? <Loader2 className="w-4 h-4 animate-spin" />
                                                                            : ev.isVisible
                                                                                ? <EyeOff className="w-4 h-4" strokeWidth={2} />
                                                                                : <Eye className="w-4 h-4" strokeWidth={2} />}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={e => { e.stopPropagation(); setOverlay({ tipo: 'eliminar', id: ev.id }); }}
                                                                        aria-label={`Eliminar ${ev.name}`}
                                                                        className={`${BOTON_REDONDO} ${T.chip} ${ROJO_TEXTO} ${T.foco}`}
                                                                    >
                                                                        <Trash2 className="w-4 h-4" strokeWidth={2} />
                                                                    </button>
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={e => { e.stopPropagation(); setOverlay({ tipo: 'detalle', id: ev.id }); }}
                                                                    aria-label={`Más acciones de ${ev.name}`}
                                                                    className={`${BOTON_REDONDO} bg-transparent ${T.suave} hover:bg-[#f2f2f0] dark:hover:bg-[#2a2a28] ${T.foco}`}
                                                                >
                                                                    <MoreHorizontal className="w-[17px] h-[17px]" />
                                                                </button>
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </section>
                    );
                })}
            </div>

            {/* ── El panel de un evento ── */}
            <Hoja
                abierta={overlay?.tipo === 'detalle' && !!elDelOverlay}
                etiqueta="Detalle del evento"
                ancha
                onCerrar={() => setOverlay(null)}
            >
                {elDelOverlay && (
                    <>
                        <div className={`w-full aspect-[16/10] rounded-[22px] flex items-center justify-center overflow-hidden ${elDelOverlay.imageUrl ? '' : T.chip}`}>
                            {elDelOverlay.imageUrl
                                ? <img src={elDelOverlay.imageUrl} alt="" className="w-full h-full object-cover" />
                                : (
                                    <span className={`flex flex-col items-center gap-2 ${T.tenue}`}>
                                        <IconoCalendario className="w-[30px] h-[30px]" grosor={1.6} />
                                        <span className="text-[12.5px] font-semibold">Sin portada</span>
                                    </span>
                                )}
                        </div>
                        <div className="px-1 pt-[18px]">
                            <div className="flex flex-wrap gap-1.5">
                                {pastillasDe(elDelOverlay, hoy).map(p => (
                                    <Pastilla key={p.texto} clase={p.clase}>{p.texto}</Pastilla>
                                ))}
                            </div>
                            <p className="mt-3 m-0 text-[21px] leading-[1.2] font-semibold tracking-[-.02em] [overflow-wrap:anywhere]">
                                {elDelOverlay.name}
                            </p>
                            <p className={`mt-1.5 m-0 text-[14.5px] font-semibold ${T.suave}`}>{meta(elDelOverlay)}</p>
                            {!!elDelOverlay.description && (
                                <p className="mt-3 m-0 text-[14.5px] leading-[1.55]">{elDelOverlay.description}</p>
                            )}
                            {!!elDelOverlay.registrationLink && (
                                <div className={`flex items-center gap-2.5 mt-3.5 px-3.5 py-3 rounded-2xl ${T.superficie}`}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                                        strokeLinecap="round" strokeLinejoin="round"
                                        className={`w-[17px] h-[17px] shrink-0 ${T.suave}`} aria-hidden="true">
                                        <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
                                    </svg>
                                    <span className="min-w-0 text-[13.5px] font-semibold [overflow-wrap:anywhere]">
                                        {elDelOverlay.registrationLink.replace(/^https:\/\//, '')}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col gap-2.5 mt-[22px]">
                            <button
                                type="button"
                                onClick={() => editar(elDelOverlay.id)}
                                className={`${botonBase} ${T.primario} ${T.foco} w-full h-14 lg:h-[50px] text-[15.5px] hover:opacity-[.88]`}
                            >
                                Editar
                            </button>
                            <button
                                type="button"
                                onClick={() => void alternarVisible(elDelOverlay)}
                                className={`${botonBase} ${T.chip} ${T.chipHover} ${T.foco} w-full h-14 lg:h-[50px] text-[15.5px]`}
                            >
                                {cambiando === elDelOverlay.id && <Loader2 className="w-[15px] h-[15px] animate-spin" />}
                                {elDelOverlay.isVisible ? 'Ocultar de /eventos' : 'Mostrar en /eventos'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setOverlay({ tipo: 'eliminar', id: elDelOverlay.id })}
                                className={`${botonBase} ${ROJO_TEXTO} ${T.foco} w-full h-12 text-[15.5px] bg-transparent`}
                            >
                                Eliminar
                            </button>
                        </div>
                    </>
                )}
            </Hoja>

            {/* ── Confirmar eliminar ── */}
            <Hoja
                abierta={overlay?.tipo === 'eliminar' && !!elDelOverlay}
                etiqueta="Eliminar evento"
                onCerrar={() => setOverlay(null)}
            >
                {elDelOverlay && (
                    <>
                        <div className="px-1 pt-3.5 text-center">
                            <p className="m-0 text-[20px] leading-[1.3] font-semibold tracking-[-.015em] [overflow-wrap:anywhere]">
                                ¿Eliminar «{elDelOverlay.name}»?
                            </p>
                            <p className={`mt-2 m-0 text-[14.5px] leading-[1.5] ${T.suave}`}>
                                Se borra de /eventos y del inicio. No se puede deshacer.
                            </p>
                        </div>
                        <div className="flex flex-col lg:flex-row-reverse gap-2.5 mt-[22px]">
                            <button
                                type="button"
                                onClick={() => void eliminar(elDelOverlay.id)}
                                disabled={borrando === elDelOverlay.id}
                                className={`${botonBase} ${ROJO_FONDO} ${T.foco} w-full h-14 lg:h-[50px] text-[15.5px] text-white hover:opacity-[.88] disabled:opacity-60`}
                            >
                                {borrando === elDelOverlay.id && <Loader2 className="w-[15px] h-[15px] animate-spin" />}
                                Eliminar
                            </button>
                            <button
                                type="button"
                                onClick={() => setOverlay(null)}
                                className={`${botonBase} ${T.chip} ${T.chipHover} ${T.foco} w-full h-14 lg:h-[50px] text-[15.5px]`}
                            >
                                Cancelar
                            </button>
                        </div>
                    </>
                )}
            </Hoja>

            <Aviso texto={aviso} abajo={sinMovimiento ? '32px' : '40px'} />
        </div>
    );
};

export default AdminEventosGeneral;
