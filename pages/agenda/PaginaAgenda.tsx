import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, Check, ExternalLink } from 'lucide-react';
import { useAccesoAgenda } from '../../hooks/useAccesoAgenda';
import {
    fechaDesdeIso, fechaIso, hoyIso, mesYAnio, type Tarea, type TareaDetalle,
} from '../../services/agenda';
import DetalleTarea from '../../components/agenda/DetalleTarea';
import type { AccionesDeAgenda } from '../../components/agenda/contratos';
import { ModalConfirmacion, type PedidoConfirmacion } from '../admin/piezasAdmin';
import { BOTON_CHICO, BOTON_NEGRO, ESTILOS, ID_AGENDA, Mensaje, TARJETA } from '../departamentos/equipo/piezas';
import {
    SIN_ASIGNAR, apagadosRecordados, diasDeLaSemana, esVista, moverFecha, pasaElFiltro, recordarApagados,
    recordarTodo, recordarVista, textoDelPeriodo, todoRecordado, vistaRecordada, type Vista,
} from './calendario';
import { useTareasDeAgenda } from './useTareasDeAgenda';
import { EsqueletoDeVista } from './piezasAgenda';
import EncabezadoAgenda from './EncabezadoAgenda';
import PanelLateral, { InterruptorTodo, Leyenda, MiniCalendario, type ItemDeLeyenda } from './PanelLateral';
import { HojaDelDia, HojaFiltros } from './HojaFiltros';
import VistaSemana from './VistaSemana';
import VistaMes from './VistaMes';
import VistaLista from './VistaLista';

/**
 * /agenda — Agenda Origen, el calendario de cada uno
 * (design-claude/Agenda Origen).
 *
 * Muestra las tareas de los sub-departamentos donde la persona está, con las
 * vistas Día, Semana, Mes y Lista. Quien es encargado (o SUPER_ADMIN) tiene
 * además el interruptor "Todo el departamento", que suma las tareas de los
 * otros equipos y las que esperan asignación.
 *
 * La URL lleva la vista y la fecha (/agenda?vista=semana&fecha=2026-10-26) y
 * se actualiza con replace: moverse por el calendario no llena el historial.
 * /agenda?tarea=<id> abre esa tarea y lleva el calendario a su fecha; la
 * fecha sale del mismo pedido del detalle (onCargada), no de uno aparte.
 *
 * Qué se ve lo decide la base (agenda_mis_tareas). Esta pantalla sólo elige
 * el rango y, del lado del cliente, filtra por la leyenda.
 */

const useAncho = () => {
    const [ancho, setAncho] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280));
    useEffect(() => {
        const medir = () => setAncho(window.innerWidth);
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, []);
    return ancho;
};

/** Una fecha 'YYYY-MM-DD' que existe, o null. */
const fechaValida = (v: string | null): string | null =>
    v && /^\d{4}-\d{2}-\d{2}$/.test(v) && fechaIso(fechaDesdeIso(v)) === v ? v : null;

const VACIO_DEL_PERIODO: Record<Vista, { periodo: string; siguiente: string | null }> = {
    dia: { periodo: 'este día', siguiente: 'Ver el día siguiente' },
    semana: { periodo: 'esta semana', siguiente: 'Ver la semana que viene' },
    mes: { periodo: 'este mes', siguiente: 'Ver el mes que viene' },
    lista: { periodo: 'en estos días', siguiente: null },
};

const PaginaAgenda: React.FC = () => {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const { cargando: cargandoAcceso, acceso, fallo, esEncargadoDe, recargar } = useAccesoAgenda();
    const ancho = useAncho();
    const movil = ancho < 768;
    const escritorio = ancho >= 1024;
    const hoy = hoyIso();

    const [vista, setVista] = useState<Vista>(() => {
        const v = params.get('vista');
        if (esVista(v)) return v;
        return vistaRecordada() ?? (window.innerWidth >= 768 ? 'semana' : 'lista');
    });
    const [fecha, setFecha] = useState(() => fechaValida(params.get('fecha')) ?? hoyIso());
    const [tramos, setTramos] = useState(1);
    const [apagados, setApagados] = useState(() => new Set(apagadosRecordados()));
    const [todoElegido, setTodoElegido] = useState(todoRecordado);
    const [tareaAbierta, setTareaAbierta] = useState<string | null>(() => params.get('tarea'));
    /** Mientras el link ?tarea= no dijo su fecha, no se pide ningún período (sería pedir hoy de más). */
    const [esperandoLink, setEsperandoLink] = useState(() => !!params.get('tarea'));
    const [tareaDelLink, setTareaDelLink] = useState<TareaDetalle | null>(null);
    const [diaAbierto, setDiaAbierto] = useState<string | null>(null);
    const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
    const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'error' } | null>(null);
    const [confirmacion, setConfirmacion] = useState<PedidoConfirmacion | null>(null);
    /** Los subs de otros que fueron apareciendo con el interruptor prendido. */
    const [ajenos, setAjenos] = useState<Map<string, ItemDeLeyenda>>(() => new Map());
    const avisoT = useRef(0);

    const avisar = useCallback((texto: string, tipo: 'ok' | 'error' = 'ok') => {
        window.clearTimeout(avisoT.current);
        setAviso({ texto, tipo });
        avisoT.current = window.setTimeout(() => setAviso(null), 3500);
    }, []);
    useEffect(() => () => window.clearTimeout(avisoT.current), []);
    const acciones = useMemo<AccionesDeAgenda>(() => ({ confirmar: setConfirmacion, avisar }), [avisar]);

    const puedeTodo = acceso.superAdmin || acceso.encargado.length > 0;
    const todo = puedeTodo && todoElegido;
    const tieneAlgo = acceso.superAdmin || acceso.miembro.length > 0 || acceso.encargado.length > 0;

    const { estado, invalidar, rangos } = useTareasDeAgenda({
        vista, fecha, tramos, todo,
        habilitado: !cargandoAcceso && !fallo && tieneAlgo && !esperandoLink,
    });

    // La URL sigue a la vista y la fecha, sin sumar pasos al historial.
    // Sólo cuando cambian ellas: setParams cambia con cada cambio de URL, y si
    // estuviera en las dependencias, un link a otra fecha estando acá haría
    // que este efecto escriba la fecha VIEJA mientras el de abajo trae la
    // nueva, y se pisarían sin fin.
    const escribirUrl = useRef(setParams);
    escribirUrl.current = setParams;
    useEffect(() => {
        escribirUrl.current(p => {
            const n = new URLSearchParams(p);
            n.set('vista', vista);
            n.set('fecha', fecha);
            return n;
        }, { replace: true });
    }, [vista, fecha]);

    const irA = useCallback((nuevaVista: Vista, nuevaFecha: string) => {
        setVista(nuevaVista);
        setFecha(nuevaFecha);
        setTramos(1);
    }, []);
    const elegirVista = (v: Vista) => { recordarVista(v); irA(v, fecha); };
    const mover = (paso: -1 | 1) => irA(vista, moverFecha(vista, fecha, paso));

    // ── El link ?tarea= ─────────────────────────────────────────────────
    const esperandoLinkRef = useRef(esperandoLink);
    const alCargarTarea = useCallback((r: { ok: true; tarea: TareaDetalle } | { ok: false; motivo: string }) => {
        if (!esperandoLinkRef.current) return;
        if (r.ok) setTareaDelLink(r.tarea);
        else { esperandoLinkRef.current = false; setEsperandoLink(false); }   // sin permiso o no existe: el calendario queda donde estaba
    }, []);

    useEffect(() => {
        if (!tareaDelLink || cargandoAcceso) return;
        esperandoLinkRef.current = false;
        setEsperandoLink(false);
        setFecha(tareaDelLink.fecha);
        setTramos(1);
        // Si no es de un equipo suyo pero es encargada del departamento, la
        // tarea sólo aparece con el interruptor: se prende (no se recuerda).
        const sub = tareaDelLink.subdepartamento;
        const esMia = !!sub && acceso.miembro.some(m => m.id === sub.id);
        if (!esMia && esEncargadoDe(tareaDelLink.departamento.id)) setTodoElegido(true);
        setTareaDelLink(null);
    }, [tareaDelLink, cargandoAcceso, acceso, esEncargadoDe]);

    // Un link a /agenda?… estando ya en /agenda (una notificación, el
    // historial) no vuelve a montar la página: se sigue a la URL. Sólo
    // cuando la URL cambia; lo que escribe el efecto de arriba ya coincide.
    const vistaUrl = params.get('vista');
    const fechaUrl = params.get('fecha');
    const tareaUrl = params.get('tarea');
    useEffect(() => {
        const f = fechaValida(fechaUrl);
        if (esVista(vistaUrl) && vistaUrl !== vista) { setVista(vistaUrl); setTramos(1); }
        if (f && f !== fecha) { setFecha(f); setTramos(1); }
    }, [vistaUrl, fechaUrl]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!tareaUrl || tareaUrl === tareaAbierta) return;
        esperandoLinkRef.current = true;
        setEsperandoLink(true);
        setTareaAbierta(tareaUrl);
    }, [tareaUrl]); // eslint-disable-line react-hooks/exhaustive-deps

    const cerrarTarea = () => {
        setTareaAbierta(null);
        if (esperandoLinkRef.current) { esperandoLinkRef.current = false; setEsperandoLink(false); }
        if (params.get('tarea')) {
            setParams(p => { const n = new URLSearchParams(p); n.delete('tarea'); return n; }, { replace: true });
        }
    };

    // ── Leyenda y filtros ───────────────────────────────────────────────
    const tareas = estado.tipo === 'listo' ? estado.tareas : [];

    useEffect(() => {
        if (!todo || tareas.length === 0) return;
        const mios = new Set(acceso.miembro.map(m => m.id));
        let nuevos: Map<string, ItemDeLeyenda> | null = null;
        tareas.forEach(t => {
            const s = t.subdepartamento;
            if (!s || mios.has(s.id) || ajenos.has(s.id) || nuevos?.has(s.id)) return;
            nuevos = nuevos ?? new Map(ajenos);
            nuevos.set(s.id, { id: s.id, nombre: s.nombre, color: s.color, detalle: t.departamento.nombre });
        });
        if (nuevos) setAjenos(nuevos);
    }, [tareas, todo, acceso.miembro]); // eslint-disable-line react-hooks/exhaustive-deps

    const itemsDeLeyenda = useMemo<ItemDeLeyenda[]>(() => {
        const vistos = new Set<string>();
        const mios = acceso.miembro
            .filter(m => (vistos.has(m.id) ? false : (vistos.add(m.id), true)))
            .map(m => ({ id: m.id, nombre: m.nombre, color: m.color, detalle: m.departamentoNombre }));
        if (!todo) return mios;
        const otros = [...ajenos.values()]
            .filter(a => !vistos.has(a.id))
            .sort((a, b) => a.detalle.localeCompare(b.detalle) || a.nombre.localeCompare(b.nombre));
        return [...mios, ...otros, { id: SIN_ASIGNAR, nombre: 'Sin asignar', color: '', detalle: 'Esperando asignación', gris: true }];
    }, [acceso.miembro, ajenos, todo]);

    const cambiarApagado = (id: string) => setApagados(prev => {
        const n = new Set(prev);
        if (n.has(id)) n.delete(id); else n.add(id);
        recordarApagados([...n]);
        return n;
    });
    const mostrarTodos = () => { setApagados(new Set()); recordarApagados([]); };
    const cambiarTodo = () => {
        const n = !todo;
        recordarTodo(n);
        setTodoElegido(n);
    };

    const visibles = useMemo(() => tareas.filter(t => pasaElFiltro(t, apagados)), [tareas, apagados]);
    const conTareas = useMemo(() => new Set(visibles.map(t => t.fecha)), [visibles]);
    const filtrosPuestos = itemsDeLeyenda.filter(i => apagados.has(i.id)).length + (todo ? 1 : 0);

    const leyenda = (
        <Leyenda
            titulo={todo ? 'Sub-departamentos' : 'Mis sub-departamentos'}
            items={itemsDeLeyenda}
            apagados={apagados}
            onCambiar={cambiarApagado}
            onMostrarTodos={mostrarTodos}
        />
    );
    const interruptor = puedeTodo ? <InterruptorTodo prendido={todo} superAdmin={acceso.superAdmin} onCambiar={cambiarTodo} /> : null;
    const miniCalendario = (
        <MiniCalendario fecha={fecha} vista={vista} hoy={hoy} conTareas={conTareas} onElegir={d => irA(vista, d)} />
    );

    // ── El cuerpo ───────────────────────────────────────────────────────
    const abrir = (id: string) => { setDiaAbierto(null); setTareaAbierta(id); };
    const formaDelEsqueleto = vista === 'lista' ? 'lista' : vista === 'mes' ? 'mes' : 'grilla';

    const vacio = (() => {
        if (estado.tipo !== 'listo' || visibles.length > 0) return null;
        const v = VACIO_DEL_PERIODO[vista];
        if (tareas.length > 0) {
            const n = tareas.length;
            return (
                <AvisoDeVista
                    titulo={`Los filtros esconden ${n} ${n === 1 ? 'tarea' : 'tareas'} ${v.periodo}`}
                    accion={<button type="button" onClick={mostrarTodos} className={BOTON_CHICO}>Mostrar todos</button>}
                />
            );
        }
        return (
            <AvisoDeVista
                titulo={`${todo ? 'No hay tareas' : 'No tenés tareas'} ${v.periodo}`}
                accion={v.siguiente ? <button type="button" onClick={() => mover(1)} className={BOTON_CHICO}>{v.siguiente}</button> : null}
            />
        );
    })();

    const cuerpo = (() => {
        if (cargandoAcceso) return <EsqueletoDeVista vista={formaDelEsqueleto} />;
        if (fallo || estado.tipo === 'error') {
            return (
                <Mensaje titulo="No pudimos cargar tu agenda" texto="Puede ser la conexión. Probá de nuevo en un momento.">
                    <button type="button" onClick={() => (fallo ? recargar() : invalidar())} className={`${BOTON_NEGRO} mt-5`}>Reintentar</button>
                </Mensaje>
            );
        }
        if (!tieneAlgo) {
            return (
                <Mensaje
                    icono={<CalendarDays size={26} strokeWidth={1.75} />}
                    titulo="Todavía no formás parte de ningún departamento"
                    texto="Cuando un encargado te sume a un equipo, sus tareas van a aparecer acá. ¿Necesitás algo de un área? Pedilo en Solicitudes."
                />
            );
        }
        if (estado.tipo === 'cargando' || esperandoLink) return <EsqueletoDeVista vista={formaDelEsqueleto} />;

        if (vista === 'lista') {
            return (
                <VistaLista
                    fecha={fecha}
                    hasta={rangos[rangos.length - 1].hasta}
                    tareas={visibles}
                    hoy={hoy}
                    movil={movil}
                    cargandoMas={estado.cargandoMas}
                    onAbrir={abrir}
                    onVerMas={() => setTramos(t => t + 1)}
                    onElegirDia={d => irA('lista', d)}
                    vacio={vacio}
                />
            );
        }
        return (
            <div className="flex flex-col gap-3">
                {vacio}
                {vista === 'mes' ? (
                    <VistaMes
                        fecha={fecha}
                        tareas={visibles}
                        hoy={hoy}
                        movil={movil}
                        onAbrir={abrir}
                        onIrADia={d => irA('dia', d)}
                        onVerDia={setDiaAbierto}
                    />
                ) : (
                    <VistaSemana
                        dias={vista === 'dia' ? [fecha] : diasDeLaSemana(fecha)}
                        tareas={visibles}
                        hoy={hoy}
                        angosta={vista === 'semana' && ancho < 700}
                        onAbrir={abrir}
                        onIrADia={vista === 'semana' ? d => irA('dia', d) : undefined}
                    />
                )}
            </div>
        );
    })();

    const listoParaFiltrar = !cargandoAcceso && !fallo && tieneAlgo;

    return (
        <div id={ID_AGENDA} className="min-h-screen bg-[#f6f6f4]">
            <style>{ESTILOS}</style>

            {aviso && (
                <div role="status" className={`fixed left-1/2 top-20 z-[130] max-w-[calc(100%-32px)] -translate-x-1/2 rounded-full px-5 py-3 text-center text-[13.5px] font-semibold shadow-[0_10px_30px_rgba(0,0,0,.18)] ${aviso.tipo === 'ok' ? 'bg-[#0a0a0a] text-white' : 'bg-[#a32218] text-white'}`}>
                    {aviso.texto}
                </div>
            )}

            <div className="mx-auto flex max-w-[1440px] items-start gap-6 px-4 pb-12 pt-5 md:px-6 md:pt-6">
                {escritorio && listoParaFiltrar && (
                    <PanelLateral calendario={miniCalendario} leyenda={leyenda} interruptor={interruptor} />
                )}
                <div className="min-w-0 flex-1">
                    {listoParaFiltrar || cargandoAcceso ? (
                        <EncabezadoAgenda
                            vista={vista}
                            ceja={escritorio ? mesYAnio(fecha) : textoDelPeriodo(vista, fecha)}
                            periodo={textoDelPeriodo(vista, fecha)}
                            escritorio={escritorio}
                            movil={movil}
                            filtrosPuestos={filtrosPuestos}
                            onVista={elegirVista}
                            onMover={mover}
                            onHoy={() => irA(vista, hoy)}
                            onFiltros={() => setFiltrosAbiertos(true)}
                        />
                    ) : (
                        <h1 className="m-0 text-[26px] font-bold leading-[1.1] tracking-[-0.025em] text-[#0a0a0a] md:text-[30px]">Agenda Origen</h1>
                    )}
                    <div className="mt-3.5">{cuerpo}</div>
                </div>
            </div>

            {filtrosAbiertos && !escritorio && listoParaFiltrar && (
                <HojaFiltros
                    calendario={movil ? undefined : miniCalendario}
                    leyenda={leyenda}
                    interruptor={interruptor}
                    onCerrar={() => setFiltrosAbiertos(false)}
                />
            )}

            {diaAbierto && (
                <HojaDelDia
                    dia={diaAbierto}
                    hoy={hoy}
                    tareas={visibles.filter((t: Tarea) => t.fecha === diaAbierto)}
                    onAbrir={abrir}
                    onIrADia={() => { const d = diaAbierto; setDiaAbierto(null); irA('dia', d); }}
                    onCerrar={() => setDiaAbierto(null)}
                />
            )}

            {/* Sin `edicion`: en la Agenda no se edita ni se reasigna, sólo se cambia el estado. */}
            {tareaAbierta && (
                <DetalleTarea
                    key={tareaAbierta}
                    tareaId={tareaAbierta}
                    acciones={acciones}
                    onCerrar={cerrarTarea}
                    onCambio={invalidar}
                    onCargada={alCargarTarea}
                    pie={t => (esEncargadoDe(t.departamento.id) ? (
                        <button
                            type="button"
                            onClick={() => navigate(`/departamentos/${t.departamento.id}?tab=tareas`)}
                            className={`${BOTON_CHICO} mt-5 w-full`}
                        >
                            <ExternalLink size={15} strokeWidth={2} aria-hidden="true" />
                            Abrir en el departamento
                        </button>
                    ) : null)}
                />
            )}

            <ModalConfirmacion pedido={confirmacion} onCerrar={() => setConfirmacion(null)} />
        </div>
    );
};

/** El aviso de período vacío: va arriba de la vista, sin esconder la grilla. */
const AvisoDeVista: React.FC<{ titulo: string; accion: React.ReactNode }> = ({ titulo, accion }) => (
    <div role="status" className={`${TARJETA} flex flex-wrap items-center gap-3 px-5 py-4`}>
        <span aria-hidden="true" className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[rgba(21,128,61,.1)] text-[#15803d]">
            <Check size={18} strokeWidth={2.2} />
        </span>
        <p className="m-0 min-w-0 flex-1 text-[15px] font-bold text-[#0a0a0a]">{titulo}</p>
        {accion}
    </div>
);

export default PaginaAgenda;
