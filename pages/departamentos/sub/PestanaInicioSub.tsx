import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Folder } from 'lucide-react';
import {
    emailsAgendaActivos, cambiarEstadoTarea, diaYMes, fechaDeDia, getTarea, getTareasSubdepartamento, horarioDeTarea,
    mensajeDeMotivo, sumarDias,
    type MotivoAgenda, type PanelSubdepartamento, type Tarea,
} from '../../../services/agenda';
import type { AccionesDeAgenda } from '../../../components/agenda/contratos';
import { nombreDePila } from '../../admin/departamentos/piezas';
import { BOTON_NEGRO, ChipColor, ChipEstado, Mensaje, ROTULO, TARJETA } from '../equipo/piezas';

/**
 * El inicio del panel de un sub-departamento: los tres números y lo que hay
 * por hacer (design-claude/Sub-departamento - Panel).
 *
 * EL ORDEN ES EL MENSAJE. Primero lo de hoy, después lo que viene y al final
 * lo que venció: quien dirige un equipo abre esto para saber qué pasa hoy, no
 * para leer un archivo. Lo vencido no se esconde —sigue habiendo que hacerlo—
 * pero va último y con la fecha a la vista.
 *
 * Los detalles no vienen en la lista (agenda_tareas_subdepartamento manda lo
 * mínimo), así que "Ver detalles" los pide una vez y los deja abiertos. Lo
 * demás de la tarea está en su panel, que se abre tocando el nombre.
 */

/** La ventana que se le pide a la base: entra de sobra en el tope de 400 días. */
const ATRAS = 90;
const ADELANTE = 180;

type Carga =
    | { estado: 'cargando' }
    | { estado: 'error'; motivo: MotivoAgenda }
    | { estado: 'listo'; tareas: Tarea[] };

const Contador: React.FC<{ cuantas: number; texto: string; color: string }> = ({ cuantas, texto, color }) => (
    <div className={`${TARJETA} px-5 py-[18px]`}>
        <p className="m-0 text-[30px] font-extrabold leading-none tracking-[-0.02em] md:text-[34px]" style={{ color }}>
            {cuantas}
        </p>
        <p className="m-0 mt-2 text-[12.5px] font-bold leading-[1.3] text-black/[.62] md:text-[13.5px]">{texto}</p>
    </div>
);

const PestanaInicioSub: React.FC<{
    subId: string;
    datos: PanelSubdepartamento;
    acciones: AccionesDeAgenda;
    /** Algo cambió: el panel vuelve a pedir sus contadores. */
    onCambio: () => void | Promise<void>;
    onAbrirTarea: (id: string) => void;
    /** Cambia cuando algo se tocó desde afuera (el detalle, por ejemplo). */
    version: number;
    miNombre: string | null;
}> = ({ subId, datos, acciones, onCambio, onAbrirTarea, version, miNombre }) => {
    const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
    const [abiertas, setAbiertas] = useState<Record<string, string | null>>({});
    const [pidiendo, setPidiendo] = useState<string | null>(null);
    const [saliendo, setSaliendo] = useState<string | null>(null);
    const relojes = useRef<number[]>([]);
    useEffect(() => () => relojes.current.forEach(window.clearTimeout), []);

    const hoy = datos.hoy;

    const pedir = useCallback(async () => {
        const r = await getTareasSubdepartamento(subId, sumarDias(hoy, -ATRAS), sumarDias(hoy, ADELANTE));
        // Un fallo no es "no hay tareas" (instrucciones 7.9).
        setCarga(r.ok ? { estado: 'listo', tareas: r.tareas } : { estado: 'error', motivo: r.motivo });
    }, [subId, hoy]);

    useEffect(() => { pedir(); }, [pedir, version]);

    /** Las que hay que hacer: hoy, después lo que viene, al final lo vencido. */
    const asignadas = useMemo(() => {
        const todas = carga.estado === 'listo' ? carga.tareas : [];
        const grupo = (t: Tarea) => (t.fecha === hoy ? 0 : t.fecha > hoy ? 1 : 2);
        // La RPC ya las manda por fecha, todo el día y hora; ordenar sólo por
        // grupo alcanza, porque Array#sort conserva el orden de las iguales.
        return todas.filter(t => t.estado === 'en_proceso').sort((a, b) => grupo(a) - grupo(b));
    }, [carga, hoy]);

    const verDetalles = async (t: Tarea) => {
        if (abiertas[t.id] !== undefined) {
            setAbiertas(a => { const n = { ...a }; delete n[t.id]; return n; });
            return;
        }
        setPidiendo(t.id);
        const r = await getTarea(t.id);
        setPidiendo(null);
        if (!r.ok) { acciones.avisar(mensajeDeMotivo(r.motivo), 'error'); return; }
        setAbiertas(a => ({ ...a, [t.id]: r.tarea.detalles }));
    };

    const pedirCompletar = (t: Tarea) => acciones.confirmar({
        tipo: 'control',
        rotulo: 'Completar',
        titulo: `¿Marcar “${t.nombre}” como completada?`,
        texto: emailsAgendaActivos()
            ? 'Sale de esta lista, pasa a Completadas y se les avisa por email a los encargados del departamento. Se puede volver a En proceso en cualquier momento.'
            : 'Sale de esta lista y pasa a Completadas. Se puede volver a En proceso en cualquier momento.',
        etiquetaBoton: 'Sí, completada',
        onConfirmar: async () => {
            const r = await cambiarEstadoTarea(t.id, 'completada');
            if (!r.ok) { acciones.avisar(mensajeDeMotivo(r.motivo), 'error'); return; }
            acciones.avisar(`“${t.nombre}” quedó completada.`);
            // Se despide antes de irse, así se ve cuál se fue.
            setSaliendo(t.id);
            relojes.current.push(window.setTimeout(async () => {
                setSaliendo(null);
                await Promise.all([pedir(), onCambio()]);
            }, 340));
        },
    });

    return (
        <>
            <h2 className="m-0 text-[22px] font-bold tracking-[-0.015em]">
                Hola{miNombre ? `, ${nombreDePila(miNombre)}` : ''}
            </h2>
            <p className="m-0 mt-1.5 text-[14.5px] font-medium text-black/[.62]">
                Esto es lo que tiene {datos.subdepartamento.nombre} por delante.
            </p>

            <div className="mt-[18px] grid grid-cols-3 gap-2.5">
                <Contador cuantas={datos.contadores.enProceso} texto="En proceso" color="#1d4ed8" />
                <Contador cuantas={datos.contadores.completadasMes} texto="Completadas este mes" color="#15803d" />
                <Contador cuantas={datos.contadores.paraHoy} texto="Para hoy" color="#0a0a0a" />
            </div>

            <h3 className={`${ROTULO} mb-3 mt-7`}>Tareas asignadas</h3>

            {carga.estado === 'cargando' && (
                <div aria-busy="true" aria-label="Cargando las tareas" className="flex flex-col gap-2.5">
                    {[0, 1].map(i => (
                        <div key={i} className="h-[120px] rounded-[22px] bg-white motion-safe:animate-[depBrillo_1.2s_infinite]" />
                    ))}
                </div>
            )}

            {carga.estado === 'error' && (
                <Mensaje titulo="No pudimos cargar las tareas" texto="Puede ser la conexión. Probá de nuevo en un momento.">
                    <button type="button" onClick={pedir} className={`${BOTON_NEGRO} mt-5`}>Reintentar</button>
                </Mensaje>
            )}

            {carga.estado === 'listo' && asignadas.length === 0 && (
                <div className={`${TARJETA} flex flex-col items-center px-6 py-10 text-center`}>
                    <span
                        className="flex h-14 w-14 items-center justify-center rounded-full"
                        style={{ background: 'rgba(21,128,61,.1)', color: '#15803d' }}
                        aria-hidden="true"
                    >
                        <Check size={24} strokeWidth={2.2} />
                    </span>
                    <p className="m-0 mt-3.5 text-[17px] font-bold">No hay tareas en proceso. ¡Al día!</p>
                    <p className="m-0 mt-1.5 text-[14px] font-medium text-black/[.62]">
                        Cuando les asignen algo, aparece acá.
                    </p>
                </div>
            )}

            {asignadas.length > 0 && (
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                    {asignadas.map(t => {
                        const vencida = t.fecha < hoy;
                        const detalles = abiertas[t.id];
                        const abierto = detalles !== undefined;
                        return (
                            <li key={t.id}>
                                <article
                                    data-tarea={t.id}
                                    className={`${TARJETA} flex gap-3 p-4 ${saliendo === t.id ? 'motion-safe:animate-[depSale_.34s_ease_both]' : ''}`}
                                >
                                    <span
                                        aria-hidden="true"
                                        className="w-1 flex-none self-stretch rounded-full"
                                        style={{ background: datos.subdepartamento.color }}
                                    />
                                    <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                                        <div className="flex flex-wrap items-start gap-2.5">
                                            <button
                                                type="button"
                                                onClick={() => onAbrirTarea(t.id)}
                                                className="min-w-[180px] flex-1 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                            >
                                                <span className="block text-[16px] font-bold leading-[1.3]">{t.nombre}</span>
                                                <span className="mt-1 block text-[13px] font-semibold text-black/[.62]">
                                                    {fechaDeDia(t.fecha, hoy)} · {horarioDeTarea(t)}
                                                </span>
                                            </button>
                                            <ChipEstado estado={t.estado} />
                                        </div>

                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {t.prioridad && <ChipColor color={t.prioridad.color}>{t.prioridad.nombre}</ChipColor>}
                                            {t.carpeta && (
                                                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-black/[.62]">
                                                    <Folder size={14} strokeWidth={2} aria-hidden="true" style={{ color: t.carpeta.color }} />
                                                    {t.carpeta.nombre}
                                                </span>
                                            )}
                                            {vencida && (
                                                <span className="text-[12.5px] font-bold text-[#a32218]">
                                                    Venció el {diaYMes(t.fecha)}
                                                </span>
                                            )}
                                        </div>

                                        {abierto && (
                                            <p className="m-0 whitespace-pre-line rounded-2xl bg-[#f6f6f4] px-3.5 py-3 text-[14px] font-medium leading-[1.6] text-black/[.8]">
                                                {detalles || 'Esta tarea no tiene detalles cargados.'}
                                            </p>
                                        )}

                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => verDetalles(t)}
                                                aria-expanded={abierto}
                                                disabled={pidiendo === t.id}
                                                className="flex h-11 items-center gap-1.5 rounded-full bg-[#f2f2f0] px-4 text-[13.5px] font-bold text-black/[.62] transition-colors hover:text-[#0a0a0a] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                            >
                                                {pidiendo === t.id ? 'Buscando…' : abierto ? 'Ocultar detalles' : 'Ver detalles'}
                                                <ChevronDown
                                                    size={14}
                                                    strokeWidth={2.4}
                                                    aria-hidden="true"
                                                    className="transition-transform"
                                                    style={{ transform: abierto ? 'rotate(180deg)' : undefined }}
                                                />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => pedirCompletar(t)}
                                                className="flex h-11 items-center gap-[7px] rounded-full bg-[#0a0a0a] pl-3.5 pr-[18px] text-[13.5px] font-bold text-white transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                            >
                                                <Check size={15} strokeWidth={2.6} aria-hidden="true" />
                                                Marcar como completada
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            </li>
                        );
                    })}
                </ul>
            )}
        </>
    );
};

export default PestanaInicioSub;
