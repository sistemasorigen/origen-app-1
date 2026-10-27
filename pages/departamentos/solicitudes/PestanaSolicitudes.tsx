import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Inbox } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
    fechaYHora, getSolicitudesDepartamento, mensajeDeMotivo, revisarSolicitud,
    type Carpeta, type MotivoAgenda, type Solicitud,
} from '../../../services/agenda';
import FormularioTarea from '../../../components/agenda/FormularioTarea';
import type { AccionesDeAgenda, DatosParaEditar } from '../../../components/agenda/contratos';
import { Avatar } from '../../admin/departamentos/piezas';
import {
    BOTON_NEGRO, ChipColor, DivisorPlegable, Mensaje, guardarPlegadas, leerPlegadas, usePanel,
} from '../equipo/piezas';
import FormularioCarpeta from '../tareas/FormularioCarpeta';
import TarjetaSolicitud from './TarjetaSolicitud';

/**
 * La pestaña Solicitudes de un departamento: lo que le pidió el resto de la
 * iglesia (design-claude/Departamento - Tareas, pestaña Solicitudes).
 *
 * Dos grupos y nada más: las NUEVAS, que hay que revisar, y las ACEPTADAS,
 * que esperan convertirse en tarea. Las rechazadas no se guardan a la vista:
 * la RPC sólo devuelve esos dos estados, así que la lista es siempre lo que
 * queda por hacer y no un archivo.
 *
 * Aceptar no crea la tarea: la deja lista para asignar. Son dos decisiones
 * distintas —"sí, nos ocupamos" y "lo hace tal equipo tal día"— y muchas
 * veces las toma la misma persona en dos momentos.
 *
 * DOS ENCARGADOS A LA VEZ. Si otro revisó la misma solicitud un segundo
 * antes, la base contesta `ya_revisada` y acá se dice y se recarga, en vez de
 * dejar en pantalla una tarjeta que ya no existe.
 */

type Carga =
    | { estado: 'cargando' }
    | { estado: 'error'; motivo: MotivoAgenda }
    | { estado: 'listo'; solicitudes: Solicitud[] };

const PestanaSolicitudes: React.FC = () => {
    const { depId, datos, recargar, avisar, confirmar, ir, avisarSolicitudesNuevas } = usePanel();
    const { user } = useAuth();

    const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
    const [plegadas, setPlegadas] = useState(() => leerPlegadas(depId));
    /** La solicitud que está esperando a la base. */
    const [ocupada, setOcupada] = useState<string | null>(null);
    const [saliendo, setSaliendo] = useState<string | null>(null);
    const [reciente, setReciente] = useState<string | null>(null);
    const [asignando, setAsignando] = useState<Solicitud | null>(null);
    const [pedidoDeCarpeta, setPedidoDeCarpeta] = useState<((c: Carpeta) => void) | null>(null);

    const relojes = useRef<number[]>([]);
    useEffect(() => () => relojes.current.forEach(window.clearTimeout), []);
    const luego = (fn: () => void, ms: number) => { relojes.current.push(window.setTimeout(fn, ms)); };

    const acciones = useMemo<AccionesDeAgenda>(() => ({ confirmar, avisar }), [confirmar, avisar]);

    const pedir = useCallback(async (silencioso = false) => {
        if (!silencioso) setCarga({ estado: 'cargando' });
        const r = await getSolicitudesDepartamento(depId);
        // Un fallo no es "no hay solicitudes" (instrucciones 7.9).
        if (!r.ok) {
            if (silencioso) avisar(`No se pudo actualizar: ${mensajeDeMotivo(r.motivo)}`, 'error');
            else setCarga({ estado: 'error', motivo: r.motivo });
            return;
        }
        setCarga({ estado: 'listo', solicitudes: r.solicitudes });
    }, [depId, avisar]);

    useEffect(() => { pedir(); }, [pedir]);

    const solicitudes = carga.estado === 'listo' ? carga.solicitudes : [];
    const nuevas = useMemo(() => solicitudes.filter(s => s.estado === 'nueva'), [solicitudes]);
    const aceptadas = useMemo(() => solicitudes.filter(s => s.estado === 'aceptada'), [solicitudes]);

    // La pastilla roja de la pestaña sale de acá en cuanto hay datos de
    // verdad: antes mostraba lo que recordaba agenda_mi_acceso.
    useEffect(() => {
        if (carga.estado === 'listo') avisarSolicitudesNuevas(nuevas.length);
    }, [carga.estado, nuevas.length, avisarSolicitudesNuevas]);

    const alternar = (clave: 'nuevas' | 'aceptadas') => setPlegadas(p => {
        const n = { ...p, [clave]: !p[clave] };
        guardarPlegadas(depId, n);
        return n;
    });

    /** Otro encargado llegó primero: se dice y se recarga. */
    const yaLaTocaron = async () => {
        avisar('Otro encargado ya la revisó.', 'error');
        await pedir(true);
    };

    const aceptar = async (s: Solicitud) => {
        if (ocupada) return;
        setOcupada(s.id);
        const r = await revisarSolicitud(s.id, 'aceptar');
        setOcupada(null);
        if (!r.ok) {
            if (r.motivo === 'ya_revisada' || r.motivo === 'solicitud_no_aceptada') { await yaLaTocaron(); return; }
            avisar(mensajeDeMotivo(r.motivo), 'error');
            return;
        }
        // Se despide de "Nuevas" y aparece marcada en "Tareas aceptadas".
        setSaliendo(s.id);
        setPlegadas(p => { const n = { ...p, aceptadas: false }; guardarPlegadas(depId, n); return n; });
        avisar('Solicitud aceptada. Queda lista para asignar.');
        luego(async () => {
            setSaliendo(null);
            setReciente(s.id);
            await pedir(true);
            luego(() => setReciente(null), 1200);
        }, 340);
    };

    const pedirRechazo = (s: Solicitud) => {
        const quien = s.solicitante?.nombre || 'esta persona';
        confirmar({
            tipo: 'destructivo',
            rotulo: 'Rechazar solicitud',
            titulo: `¿Rechazar la solicitud de ${quien}?`,
            // Sin email: a quien pidió le llega sólo la notificación en la app.
            texto: 'No se va a crear ninguna tarea. La solicitud sale de esta lista y le avisamos en sus notificaciones.',
            etiquetaBoton: 'Rechazar',
            onConfirmar: async () => {
                setOcupada(s.id);
                const r = await revisarSolicitud(s.id, 'rechazar');
                setOcupada(null);
                if (!r.ok) {
                    if (r.motivo === 'ya_revisada' || r.motivo === 'solicitud_no_aceptada') { await yaLaTocaron(); return; }
                    avisar(mensajeDeMotivo(r.motivo), 'error');
                    return;
                }
                avisar('Solicitud rechazada.');
                await pedir(true);
            },
        });
    };

    // ── Lo que hace falta para armar la tarea ───────────────────────────
    const edicion = useMemo<DatosParaEditar>(() => ({
        departamentoId: depId,
        subdepartamentos: datos.subdepartamentos,
        carpetas: datos.carpetas,
        prioridades: datos.prioridades,
        miNombre: user?.name ?? null,
        onPedirCarpeta: alCrear => setPedidoDeCarpeta(() => alCrear),
        onIrAConfig: () => ir('config'),
    }), [depId, datos, user?.name, ir]);

    /** El recuadro de arriba del formulario: de dónde viene esta tarea. */
    const referenciaDe = (s: Solicitud) => (
        <div
            className="flex items-center gap-3 rounded-[18px] bg-[#f6f6f4] px-3.5 py-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,.06)]"
            data-referencia="true"
        >
            <Avatar
                persona={s.solicitante ?? { nombre: null, avatarUrl: null }}
                color={datos.departamento.color}
                tam={34}
            />
            <span className="min-w-0 flex-1 text-[13.5px] font-semibold leading-[1.5] text-black/[.72]">
                Pedido por <strong className="text-[#0a0a0a]">{s.solicitante?.nombre || 'alguien de la iglesia'}</strong>
                {' · '}{fechaYHora(s.createdAt)}
                {s.prioridad && (
                    <>
                        {' · prioridad pedida: '}
                        <ChipColor color={s.prioridad.color ?? 'rgba(0,0,0,.4)'}>{s.prioridad.nombre}</ChipColor>
                    </>
                )}
            </span>
        </div>
    );

    const GRID = 'grid grid-cols-1 gap-2.5 pb-2 pt-3 md:grid-cols-[repeat(auto-fill,minmax(340px,1fr))]';
    const VACIO = 'col-span-full flex flex-col items-center rounded-[24px] bg-white px-5 py-9 text-center';

    return (
        <>
            {carga.estado === 'cargando' && (
                <div aria-busy="true" aria-label="Cargando las solicitudes" className="flex flex-col gap-2.5">
                    <div className="h-14 rounded-[20px] bg-white motion-safe:animate-[depBrillo_1.2s_infinite]" />
                    <div className="h-[200px] rounded-[24px] bg-white motion-safe:animate-[depBrillo_1.2s_.1s_infinite]" />
                    <div className="h-14 rounded-[20px] bg-white motion-safe:animate-[depBrillo_1.2s_.2s_infinite]" />
                </div>
            )}

            {carga.estado === 'error' && (
                <Mensaje titulo="No pudimos cargar las solicitudes" texto="Puede ser la conexión. Probá de nuevo en un momento.">
                    <button type="button" onClick={() => pedir()} className={`${BOTON_NEGRO} mt-5`}>Reintentar</button>
                </Mensaje>
            )}

            {carga.estado === 'listo' && (
                <div className="flex flex-col gap-3">
                    <DivisorPlegable
                        rotulo={<span className="text-[15px] font-bold">Nuevas</span>}
                        cuantas={nuevas.length}
                        abierto={!plegadas.nuevas}
                        onAlternar={() => alternar('nuevas')}
                        id="solicitudes-nuevas"
                        insignia
                        urgente
                        marca="nuevas"
                    >
                        <div className={GRID}>
                            {nuevas.length === 0 ? (
                                <div className={VACIO}>
                                    <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#f2f2f0] text-black/[.62]" aria-hidden="true">
                                        <Inbox size={24} strokeWidth={1.75} />
                                    </span>
                                    <p className="m-0 mt-3 text-[16px] font-bold">No hay solicitudes nuevas</p>
                                    <p className="m-0 mt-1.5 text-[13.5px] font-medium text-black/[.62]">
                                        Cuando alguien le pida una tarea a {datos.departamento.nombre}, aparece acá.
                                    </p>
                                </div>
                            ) : nuevas.map(s => (
                                <TarjetaSolicitud
                                    key={s.id}
                                    solicitud={s}
                                    color={datos.departamento.color}
                                    ocupada={ocupada === s.id}
                                    saliendo={saliendo === s.id}
                                    onAceptar={() => aceptar(s)}
                                    onRechazar={() => pedirRechazo(s)}
                                />
                            ))}
                        </div>
                    </DivisorPlegable>

                    <DivisorPlegable
                        rotulo={<span className="text-[15px] font-bold">Tareas aceptadas</span>}
                        cuantas={aceptadas.length}
                        abierto={!plegadas.aceptadas}
                        onAlternar={() => alternar('aceptadas')}
                        id="solicitudes-aceptadas"
                        insignia
                        marca="aceptadas"
                    >
                        <div className={GRID}>
                            {aceptadas.length === 0 ? (
                                <div className={VACIO}>
                                    <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#f2f2f0] text-black/[.62]" aria-hidden="true">
                                        <Inbox size={24} strokeWidth={1.75} />
                                    </span>
                                    <p className="m-0 mt-3 text-[16px] font-bold">No hay tareas aceptadas esperando asignación</p>
                                    <p className="m-0 mt-1.5 text-[13.5px] font-medium text-black/[.62]">
                                        Las que aceptes esperan acá hasta que las asignes a un equipo.
                                    </p>
                                </div>
                            ) : aceptadas.map(s => (
                                <TarjetaSolicitud
                                    key={s.id}
                                    solicitud={s}
                                    color={datos.departamento.color}
                                    ocupada={ocupada === s.id}
                                    reciente={reciente === s.id}
                                    onAsignar={() => setAsignando(s)}
                                />
                            ))}
                        </div>
                    </DivisorPlegable>
                </div>
            )}

            {asignando && (
                <FormularioTarea
                    modo="crear"
                    datos={edicion}
                    acciones={acciones}
                    titulo="Asignar tarea"
                    etiquetaDeAccion="Asignar tarea"
                    valoresIniciales={{ detalles: asignando.detalles }}
                    solicitudId={asignando.id}
                    referencia={referenciaDe(asignando)}
                    onCerrar={() => setAsignando(null)}
                    onGuardada={async tarea => {
                        setAsignando(null);
                        avisar(tarea.subdepartamento
                            ? `Tarea asignada a ${tarea.subdepartamento.nombre}.`
                            : 'Tarea asignada: queda esperando asignación a un equipo.');
                        // La solicitud pasa a 'asignada' y sale de la lista.
                        await pedir(true);
                    }}
                />
            )}

            {pedidoDeCarpeta && (
                <FormularioCarpeta
                    encima
                    onCerrar={() => setPedidoDeCarpeta(null)}
                    onGuardada={async carpeta => {
                        pedidoDeCarpeta(carpeta);
                        setPedidoDeCarpeta(null);
                        avisar(`Carpeta “${carpeta.nombre}” creada.`);
                        await recargar();
                    }}
                />
            )}
        </>
    );
};

export default PestanaSolicitudes;
