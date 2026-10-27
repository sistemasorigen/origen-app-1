import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, FolderPlus, LayoutGrid, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
    eliminarCarpeta, fechaDesdeIso, fechaIso, getTareasDepartamento, hoyIso, mensajeDeMotivo,
    type Carpeta, type EstadoTarea, type MotivoAgenda, type Tarea,
} from '../../../services/agenda';
import DetalleTarea from '../../../components/agenda/DetalleTarea';
import FormularioTarea from '../../../components/agenda/FormularioTarea';
import type { AccionesDeAgenda, CambioDeTarea, DatosParaEditar } from '../../../components/agenda/contratos';
import SelectorDeRango, { atajosDeTareas, type Rango } from '../../audiencia/SelectorDeRango';
import { plural } from '../../admin/departamentos/piezas';
import {
    BOTON_CHICO, BOTON_NEGRO, Hoja, Mensaje, guardarPlegadas, leerPlegadas, usePanel,
} from '../equipo/piezas';
import FormularioCarpeta from './FormularioCarpeta';
import ListaPorEstado from './ListaPorEstado';

/**
 * La pestaña Tareas de un departamento: todo lo que tiene, por estado, por
 * día y por carpeta (design-claude/Departamento - Tareas).
 *
 * CÓMO SE TRAEN LAS TAREAS. Al entrar se pide UNA ventana amplia —seis meses
 * para atrás y seis para adelante, que entra en el tope de 400 días de
 * agenda_tareas_departamento— y el período elegido se filtra en el cliente.
 * Así cambiar de período es instantáneo y el calendario puede poner un punto
 * en cada día que tiene algo, que es lo que hace entender de un vistazo
 * dónde buscar. Un período que se sale de esa ventana sí se le pide a la
 * base, aparte.
 *
 * Después de crear, editar, reasignar, completar o borrar se vuelve a pedir
 * la ventana. Es un viaje más, y a cambio nunca queda una lista que muestre
 * algo distinto de lo que hay en la base.
 */

const ESTADOS_EN_ORDEN: EstadoTarea[] = ['esperando', 'en_proceso', 'completada'];

/** El mes en curso, entero: del 1 al último día. */
const mesEntero = (iso: string): Rango => {
    const d = fechaDesdeIso(iso);
    return {
        desde: fechaIso(new Date(d.getFullYear(), d.getMonth(), 1)),
        hasta: fechaIso(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    };
};

/** Seis meses para atrás y seis para adelante, de mes entero a mes entero. */
const ventanaDe = (iso: string): Rango => {
    const d = fechaDesdeIso(iso);
    return {
        desde: fechaIso(new Date(d.getFullYear(), d.getMonth() - 6, 1)),
        hasta: fechaIso(new Date(d.getFullYear(), d.getMonth() + 7, 0)),
    };
};

type Fuente = { rango: Rango; tareas: Tarea[] };

const PestanaTareas: React.FC = () => {
    const { depId, datos, recargar, avisar, confirmar, ir } = usePanel();
    const { user } = useAuth();

    const hoy = useRef(hoyIso()).current;
    const ventana = useRef(ventanaDe(hoy)).current;

    const [rango, setRango] = useState<Rango>(() => mesEntero(hoy));
    const [ventanaCargada, setVentanaCargada] = useState<Fuente | null>(null);
    const [afuera, setAfuera] = useState<Fuente | null>(null);
    const [cargando, setCargando] = useState(true);
    const [cargandoAfuera, setCargandoAfuera] = useState(false);
    const [motivo, setMotivo] = useState<MotivoAgenda | null>(null);

    const [plegadas, setPlegadas] = useState(() => leerPlegadas(depId));
    const [carpetasCerradas, setCarpetasCerradas] = useState<Record<string, boolean>>({});

    const [abierta, setAbierta] = useState<string | null>(null);
    const [creando, setCreando] = useState(false);
    const [carpetaEnEdicion, setCarpetaEnEdicion] = useState<Carpeta | null>(null);
    const [creandoCarpeta, setCreandoCarpeta] = useState(false);
    const [menuDeCarpeta, setMenuDeCarpeta] = useState<Carpeta | null>(null);
    /** El formulario de la tarea pidió una carpeta nueva y espera cuál es. */
    const [pedidoDeCarpeta, setPedidoDeCarpeta] = useState<((c: Carpeta) => void) | null>(null);
    const [reciente, setReciente] = useState<string | null>(null);
    const marca = useRef(0);

    const acciones = useMemo<AccionesDeAgenda>(() => ({ confirmar, avisar }), [confirmar, avisar]);

    const dentroDeLaVentana = useCallback(
        (r: Rango) => r.desde >= ventana.desde && r.hasta <= ventana.hasta,
        [ventana],
    );

    // ── Traer ───────────────────────────────────────────────────────────
    const pedirVentana = useCallback(async (silencioso = false) => {
        if (!silencioso) { setCargando(true); setMotivo(null); }
        const r = await getTareasDepartamento(depId, ventana.desde, ventana.hasta);
        if (!silencioso) setCargando(false);
        if (!r.ok) {
            // Un fallo no es "no hay tareas" (instrucciones 7.9).
            if (silencioso) avisar(`No se pudo actualizar: ${mensajeDeMotivo(r.motivo)}`, 'error');
            else setMotivo(r.motivo);
            return;
        }
        setMotivo(null);
        setVentanaCargada({ rango: ventana, tareas: r.tareas });
    }, [depId, ventana, avisar]);

    useEffect(() => { pedirVentana(); }, [pedirVentana]);

    // Un período fuera de la ventana se le pide a la base.
    useEffect(() => {
        if (dentroDeLaVentana(rango)) { setAfuera(null); setCargandoAfuera(false); return; }
        let vigente = true;
        setCargandoAfuera(true);
        getTareasDepartamento(depId, rango.desde, rango.hasta).then(r => {
            if (!vigente) return;
            setCargandoAfuera(false);
            if (r.ok) setAfuera({ rango, tareas: r.tareas });
            else { setAfuera(null); avisar(`No pudimos traer ese período: ${mensajeDeMotivo(r.motivo)}`, 'error'); }
        });
        return () => { vigente = false; };
    }, [depId, rango.desde, rango.hasta, dentroDeLaVentana, avisar]);

    const haciaLaBase = !dentroDeLaVentana(rango);
    const fuente = haciaLaBase ? afuera : ventanaCargada;

    const visibles = useMemo(
        () => (fuente?.tareas ?? []).filter(t => t.fecha >= rango.desde && t.fecha <= rango.hasta),
        [fuente, rango.desde, rango.hasta],
    );

    /** Los puntos del calendario: cuántas tareas hay en cada día de lo cargado. */
    const porDia = useMemo(() => {
        const m = new Map<string, number>();
        const sumar = (lista: Tarea[]) => lista.forEach(t => m.set(t.fecha, (m.get(t.fecha) || 0) + 1));
        sumar(ventanaCargada?.tareas ?? []);
        // Lo de afuera, sin repetir lo que ya trajo la ventana.
        if (afuera) sumar(afuera.tareas.filter(t => t.fecha < ventana.desde || t.fecha > ventana.hasta));
        return m;
    }, [ventanaCargada, afuera, ventana]);

    const porEstado = useMemo(() => {
        const m: Record<EstadoTarea, Tarea[]> = { esperando: [], en_proceso: [], completada: [] };
        visibles.forEach(t => { if (m[t.estado]) m[t.estado].push(t); });
        return m;
    }, [visibles]);

    // ── Cambios ─────────────────────────────────────────────────────────
    const marcarReciente = (id: string) => {
        setReciente(id);
        window.clearTimeout(marca.current);
        marca.current = window.setTimeout(() => setReciente(null), 1600);
    };

    const alCambiar = useCallback(async (cambio: CambioDeTarea) => {
        if (cambio.tipo === 'guardada') marcarReciente(cambio.tarea.id);
        await pedirVentana(true);
        if (haciaLaBase) {
            const r = await getTareasDepartamento(depId, rango.desde, rango.hasta);
            if (r.ok) setAfuera({ rango, tareas: r.tareas });
        }
    }, [pedirVentana, haciaLaBase, depId, rango.desde, rango.hasta]);

    const alCrearTarea = async (tarea: Tarea) => {
        setCreando(false);
        // El divisor donde cayó se abre: si no, la tarea se crea y no se ve.
        setPlegadas(p => { const n = { ...p, [tarea.estado]: false }; guardarPlegadas(depId, n); return n; });

        const afueraDelPeriodo = tarea.fecha < rango.desde || tarea.fecha > rango.hasta;
        if (afueraDelPeriodo) {
            setRango(r => ({
                desde: tarea.fecha < r.desde ? tarea.fecha : r.desde,
                hasta: tarea.fecha > r.hasta ? tarea.fecha : r.hasta,
            }));
        }
        avisar(tarea.subdepartamento
            ? `Tarea creada${afueraDelPeriodo ? '. Ampliamos el período para mostrarla.' : '.'}`
            : `Tarea creada: queda esperando asignación${afueraDelPeriodo ? ', y ampliamos el período para mostrarla' : ''}.`);
        await alCambiar({ tipo: 'guardada', tarea, creada: true });
    };

    const pedirBorrarCarpeta = (carpeta: Carpeta) => {
        const cuantas = carpeta.cantTareas ?? 0;
        confirmar({
            tipo: 'destructivo',
            rotulo: 'Eliminar carpeta',
            titulo: `¿Eliminar la carpeta “${carpeta.nombre}”?`,
            texto: cuantas
                ? `Las ${plural(cuantas, 'tarea', 'tareas')} de “${carpeta.nombre}” quedan sin carpeta. No se borra ninguna tarea.`
                : 'No tiene ninguna tarea adentro. No se borra nada más.',
            etiquetaBoton: 'Eliminar carpeta',
            onConfirmar: async () => {
                const r = await eliminarCarpeta(carpeta.id);
                if (!r.ok) { avisar(mensajeDeMotivo(r.motivo), 'error'); return; }
                avisar(r.tareasSinCarpeta
                    ? `Se eliminó “${carpeta.nombre}”: ${plural(r.tareasSinCarpeta, 'tarea quedó', 'tareas quedaron')} sin carpeta.`
                    : `Se eliminó “${carpeta.nombre}”.`);
                await Promise.all([recargar(), pedirVentana(true)]);
            },
        });
    };

    // ── Lo que hace falta para editar o reasignar ───────────────────────
    const edicion = useMemo<DatosParaEditar>(() => ({
        departamentoId: depId,
        subdepartamentos: datos.subdepartamentos,
        carpetas: datos.carpetas,
        prioridades: datos.prioridades,
        miNombre: user?.name ?? null,
        onPedirCarpeta: alCrear => setPedidoDeCarpeta(() => alCrear),
        onIrAConfig: () => ir('config'),
    }), [depId, datos, user?.name, ir]);

    const sinEquipos = datos.subdepartamentos.length === 0;
    const esperando = cargando || (haciaLaBase && cargandoAfuera && !afuera);
    const vacio = !esperando && !motivo && visibles.length === 0;

    return (
        <>
            {/* Barra: período y las dos acciones */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="w-full md:w-auto md:min-w-[250px]">
                    <SelectorDeRango
                        valor={rango}
                        onCambiar={setRango}
                        serviciosPorDia={porDia}
                        atajos={atajosDeTareas()}
                        permitirFuturo
                        nombreDelConteo={{ uno: 'tarea', varios: 'tareas' }}
                    />
                </div>
                <span className="hidden flex-1 md:block" />
                <button type="button" onClick={() => setCreandoCarpeta(true)} className={`${BOTON_CHICO} h-12 flex-1 md:flex-none`}>
                    <FolderPlus size={16} strokeWidth={2} aria-hidden="true" />
                    Crear carpeta
                </button>
                <button type="button" onClick={() => setCreando(true)} className={`${BOTON_NEGRO} flex-1 pl-4 md:flex-none`}>
                    <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
                    Crear tarea
                </button>
            </div>

            {sinEquipos && (
                <div className="mt-3.5 flex flex-wrap items-center gap-3 rounded-[22px] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,.04)]">
                    <p className="m-0 min-w-0 flex-1 text-[14px] font-semibold leading-[1.5]">
                        Para asignar tareas, primero creá un sub-departamento.
                        <span className="block font-medium text-black/[.62]">
                            Mientras no haya ninguno, las tareas quedan en Esperando asignación.
                        </span>
                    </p>
                    <button type="button" onClick={() => ir('subdepartamentos', null)} className={BOTON_CHICO}>
                        <LayoutGrid size={15} strokeWidth={2} aria-hidden="true" />
                        Crear uno
                    </button>
                </div>
            )}

            {esperando && (
                <div aria-busy="true" aria-label="Cargando las tareas" className="mt-5 flex flex-col gap-2.5">
                    <div className="h-14 rounded-[20px] bg-white motion-safe:animate-[depBrillo_1.2s_infinite]" />
                    <div className="mx-1 my-1 h-3.5 w-44 rounded-lg bg-[#e8e8e5] motion-safe:animate-[depBrillo_1.2s_infinite]" />
                    <div className="h-[76px] rounded-[22px] bg-white motion-safe:animate-[depBrillo_1.2s_.1s_infinite]" />
                    <div className="h-[76px] rounded-[22px] bg-white motion-safe:animate-[depBrillo_1.2s_.2s_infinite]" />
                    <div className="h-14 rounded-[20px] bg-white motion-safe:animate-[depBrillo_1.2s_.3s_infinite]" />
                </div>
            )}

            {!esperando && motivo && (
                <Mensaje
                    titulo="No pudimos cargar las tareas"
                    texto={motivo === 'rango_grande' || motivo === 'rango_invalido'
                        ? mensajeDeMotivo(motivo)
                        : 'Puede ser la conexión. Probá de nuevo en un momento.'}
                >
                    <button type="button" onClick={() => pedirVentana()} className={`${BOTON_NEGRO} mt-5`}>Reintentar</button>
                </Mensaje>
            )}

            {vacio && (
                <Mensaje
                    icono={<CalendarDays size={26} strokeWidth={1.75} />}
                    titulo="No hay tareas en este período"
                    texto="Elegí otras fechas arriba o cargá la primera tarea."
                >
                    <button type="button" onClick={() => setCreando(true)} className={`${BOTON_NEGRO} mt-5 pl-4`}>
                        <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
                        Crear tarea
                    </button>
                </Mensaje>
            )}

            {!esperando && !motivo && !vacio && (
                <div className="mt-5 flex flex-col gap-3">
                    {ESTADOS_EN_ORDEN.map(estado => (
                        <ListaPorEstado
                            key={estado}
                            estado={estado}
                            tareas={porEstado[estado]}
                            carpetas={datos.carpetas}
                            abierto={!plegadas[estado]}
                            onAlternar={() => setPlegadas(p => {
                                const n = { ...p, [estado]: !p[estado] };
                                guardarPlegadas(depId, n);
                                return n;
                            })}
                            carpetasCerradas={carpetasCerradas}
                            onAlternarCarpeta={clave => setCarpetasCerradas(c => ({ ...c, [clave]: !c[clave] }))}
                            onAbrirTarea={setAbierta}
                            onMenuDeCarpeta={setMenuDeCarpeta}
                            reciente={reciente}
                        />
                    ))}
                    <p className="m-0 mt-1 px-2 text-[12.5px] font-semibold text-black/[.5]">
                        Los divisores que pliegues quedan así la próxima vez que entres.
                    </p>
                </div>
            )}

            {abierta && (
                <DetalleTarea
                    key={abierta}
                    tareaId={abierta}
                    acciones={acciones}
                    edicion={edicion}
                    onCerrar={() => setAbierta(null)}
                    onCambio={alCambiar}
                />
            )}

            {creando && (
                <FormularioTarea
                    modo="crear"
                    datos={edicion}
                    acciones={acciones}
                    onCerrar={() => setCreando(false)}
                    onGuardada={alCrearTarea}
                />
            )}

            {(creandoCarpeta || carpetaEnEdicion || pedidoDeCarpeta) && (
                <FormularioCarpeta
                    carpeta={carpetaEnEdicion ?? undefined}
                    encima={!!pedidoDeCarpeta}
                    onCerrar={() => { setCreandoCarpeta(false); setCarpetaEnEdicion(null); setPedidoDeCarpeta(null); }}
                    onGuardada={async carpeta => {
                        const avisoCreada = !carpetaEnEdicion;
                        pedidoDeCarpeta?.(carpeta);
                        setCreandoCarpeta(false);
                        setCarpetaEnEdicion(null);
                        setPedidoDeCarpeta(null);
                        avisar(avisoCreada ? `Carpeta “${carpeta.nombre}” creada.` : 'Cambios guardados.');
                        await Promise.all([recargar(), pedirVentana(true)]);
                    }}
                />
            )}

            {menuDeCarpeta && (
                <Hoja
                    titulo={menuDeCarpeta.nombre}
                    subtitulo={plural(menuDeCarpeta.cantTareas ?? 0, 'tarea', 'tareas')}
                    onCerrar={() => setMenuDeCarpeta(null)}
                    ancho={420}
                >
                    <div role="menu" aria-label={`Opciones de ${menuDeCarpeta.nombre}`} className="flex flex-col gap-1 pb-2">
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => { setCarpetaEnEdicion(menuDeCarpeta); setMenuDeCarpeta(null); }}
                            className="flex min-h-[52px] items-center gap-3 rounded-2xl px-3 text-left text-[14.5px] font-bold text-[#0a0a0a] hover:bg-[#f6f6f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                        >
                            <Pencil size={18} strokeWidth={1.9} aria-hidden="true" />
                            Editar carpeta
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => { const c = menuDeCarpeta; setMenuDeCarpeta(null); pedirBorrarCarpeta(c); }}
                            className="flex min-h-[52px] items-center gap-3 rounded-2xl px-3 text-left text-[14.5px] font-bold text-[#b42318] hover:bg-[#fdf3f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b42318]"
                        >
                            <Trash2 size={18} strokeWidth={1.9} aria-hidden="true" />
                            Eliminar carpeta
                        </button>
                    </div>
                </Hoja>
            )}
        </>
    );
};

export default PestanaTareas;
