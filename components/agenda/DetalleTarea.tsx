import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowLeftRight, CalendarDays, Check, Folder, Pencil, Signal, Trash2, X,
} from 'lucide-react';
import {
    cambiarEstadoTarea, eliminarTarea, fechaDeDia, fechaYHora, getTarea, horarioDeTarea,
    mensajeDeMotivo, reasignarTarea,
    type MotivoAgenda, type TareaDetalle,
} from '../../services/agenda';
import { useBloqueoDeFondo } from '../../hooks/useBloqueoDeFondo';
import { Avatar, IconoDeDepartamento, plural } from '../../pages/admin/departamentos/piezas';
import {
    BOTON_CHICO, ChipEstado, HojaElegir, Punto, ROTULO,
} from '../../pages/departamentos/equipo/piezas';
import FormularioTarea from './FormularioTarea';
import type { AccionesDeAgenda, CambioDeTarea, DatosParaEditar } from './contratos';

/**
 * El detalle de una tarea: hoja desde abajo en el teléfono, panel lateral
 * desde 768 px (design-claude/Departamento - Tareas y Agenda Origen; es el
 * MISMO panel en las dos pantallas).
 *
 * QUIÉN PUEDE QUÉ LO DICE LA BASE. `agenda_tarea` devuelve `puedeEditar` y
 * `puedeCambiarEstado`; acá no se calcula ningún permiso. Un miembro abre el
 * mismo panel y ve los mismos datos, sin las acciones de encargado.
 *
 * `edicion` es lo que hace falta para editar o reasignar (los equipos, las
 * carpetas y las prioridades del departamento). La Agenda de un miembro no
 * los tiene, así que sin eso esas acciones no se ofrecen: no es un permiso,
 * es que no hay con qué.
 */

type Carga =
    | { estado: 'cargando' }
    | { estado: 'error'; motivo: MotivoAgenda }
    | { estado: 'listo'; tarea: TareaDetalle };

export interface PropsDetalleTarea {
    tareaId: string;
    acciones: AccionesDeAgenda;
    /** Sin esto, el panel no ofrece Editar, Reasignar ni Eliminar. */
    edicion?: DatosParaEditar;
    onCerrar: () => void;
    /** Cada cambio, para que la lista de atrás se actualice. */
    onCambio?: (cambio: CambioDeTarea) => void;
}

/** El patrón de un link dentro de los detalles. */
const LINKS = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/g;

/**
 * Los detalles, tal cual los escribieron: los saltos de línea se respetan y
 * los links se vuelven links. Se arma con nodos de React y nunca con HTML:
 * lo que escribe una persona no se interpreta.
 */
const Detalles: React.FC<{ texto: string }> = ({ texto }) => {
    const partes = useMemo(() => {
        const trozos: React.ReactNode[] = [];
        let desde = 0;
        let n = 0;
        for (const hallado of texto.matchAll(LINKS)) {
            const bruto = hallado[0];
            const i = hallado.index ?? 0;
            // La puntuación de la oración no es parte del link.
            const limpio = bruto.replace(/[.,;:!?)\]}'"»]+$/, '');
            if (i > desde) trozos.push(texto.slice(desde, i));
            trozos.push(
                <a
                    key={`l${n += 1}`}
                    href={limpio.startsWith('www.') ? `https://${limpio}` : limpio}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline underline-offset-[3px]"
                >
                    {limpio}
                </a>,
            );
            desde = i + limpio.length;
        }
        if (desde < texto.length) trozos.push(texto.slice(desde));
        return trozos;
    }, [texto]);

    return (
        <p className="m-0 whitespace-pre-line text-[14.5px] font-medium leading-[1.65] text-black/[.8]">
            {partes}
        </p>
    );
};

const Dato: React.FC<{ icono: React.ReactNode; children: React.ReactNode }> = ({ icono, children }) => (
    <div className="flex items-center gap-3">
        <span className="flex-none text-black/[.5]" aria-hidden="true">{icono}</span>
        <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-[14.5px] font-semibold">{children}</span>
    </div>
);

const DetalleTarea: React.FC<PropsDetalleTarea> = ({ tareaId, acciones, edicion, onCerrar, onCambio }) => {
    const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
    const [editando, setEditando] = useState(false);
    const [reasignando, setReasignando] = useState(false);
    const [ocupado, setOcupado] = useState(false);
    /** Se acabó de completar: el tilde entra con su animación. */
    const [reciencompletada, setRecienCompletada] = useState(false);
    const panel = useRef<HTMLDivElement>(null);

    useBloqueoDeFondo(true);

    const cargar = useCallback(async () => {
        setCarga({ estado: 'cargando' });
        const r = await getTarea(tareaId);
        setCarga(r.ok ? { estado: 'listo', tarea: r.tarea } : { estado: 'error', motivo: r.motivo });
    }, [tareaId]);
    useEffect(() => { cargar(); }, [cargar]);

    useEffect(() => { panel.current?.focus(); }, []);
    useEffect(() => {
        const alTeclear = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !ocupado && !editando && !reasignando) onCerrar();
        };
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    }, [ocupado, editando, reasignando, onCerrar]);

    const tarea = carga.estado === 'listo' ? carga.tarea : null;

    /** A qué otros equipos se puede pasar. */
    const otros = useMemo(
        () => (edicion?.subdepartamentos ?? []).filter(s => s.id !== tarea?.subdepartamento?.id),
        [edicion, tarea],
    );

    const cambiarEstado = async (a: 'completada' | 'en_proceso') => {
        setOcupado(true);
        const r = await cambiarEstadoTarea(tareaId, a);
        setOcupado(false);
        if (!r.ok) { acciones.avisar(mensajeDeMotivo(r.motivo), 'error'); return; }
        setRecienCompletada(a === 'completada');
        acciones.avisar(a === 'completada' ? 'Tarea completada.' : 'La tarea volvió a En proceso.');
        onCambio?.({ tipo: 'guardada', tarea: r.tarea, creada: false });
        await cargar();
    };

    const pedirCompletar = () => tarea && acciones.confirmar({
        tipo: 'control',
        rotulo: 'Completar',
        titulo: `¿Marcar “${tarea.nombre}” como completada?`,
        // TODO prompt 8: cuando estén los emails, decir que les avisamos a los encargados.
        texto: 'Pasa a Completadas. Se puede volver a En proceso en cualquier momento.',
        etiquetaBoton: 'Sí, completada',
        onConfirmar: () => { cambiarEstado('completada'); },
    });

    const pedirEliminar = () => tarea && acciones.confirmar({
        tipo: 'destructivo',
        rotulo: 'Eliminar tarea',
        titulo: `¿Eliminar “${tarea.nombre}”?`,
        texto: [
            tarea.laTienen.length && tarea.subdepartamento
                ? `Se borra de la Agenda de ${plural(tarea.laTienen.length, 'persona', 'personas')} de ${tarea.subdepartamento.nombre}.`
                : '',
            tarea.solicitud ? 'La solicitud vuelve a quedar para asignar.' : '',
            'Esto no se puede deshacer.',
        ].filter(Boolean).join(' '),
        etiquetaBoton: 'Eliminar tarea',
        onConfirmar: async () => {
            const r = await eliminarTarea(tareaId);
            if (!r.ok) { acciones.avisar(mensajeDeMotivo(r.motivo), 'error'); return; }
            acciones.avisar('Tarea eliminada.');
            onCambio?.({ tipo: 'eliminada', id: tareaId });
            onCerrar();
        },
    });

    const pedirReasignar = (destinoId: string) => {
        const destino = otros.find(s => s.id === destinoId);
        if (!destino || !tarea) return false;
        acciones.confirmar({
            tipo: 'control',
            rotulo: tarea.subdepartamento ? 'Reasignar tarea' : 'Asignar tarea',
            titulo: `¿${tarea.subdepartamento ? 'Pasar' : 'Asignar'} “${tarea.nombre}” a ${destino.nombre}?`,
            // TODO prompt 8: cuando estén los emails, decir que les llega un aviso.
            texto: tarea.subdepartamento
                ? `Los integrantes de ${destino.nombre} la van a ver en su Agenda, y deja de estar en la de ${tarea.subdepartamento.nombre}.`
                : `Los integrantes de ${destino.nombre} la van a ver en su Agenda y la tarea pasa a En proceso.`,
            etiquetaBoton: tarea.subdepartamento ? `Pasar a ${destino.nombre}` : `Asignar a ${destino.nombre}`,
            onConfirmar: async () => {
                const r = await reasignarTarea(tareaId, destino.id);
                if (!r.ok) { acciones.avisar(mensajeDeMotivo(r.motivo), 'error'); return; }
                acciones.avisar(`Ahora la tiene ${destino.nombre}.`);
                onCambio?.({ tipo: 'guardada', tarea: r.tarea, creada: false });
                await cargar();
            },
        });
        return true;
    };

    const completada = tarea?.estado === 'completada';
    const puedeTocar = !!tarea?.puedeEditar && !!edicion;

    return (
        <>
            <div className="fixed inset-0 z-[105] flex items-end justify-center md:items-stretch md:justify-end md:p-3">
                <div
                    className="absolute inset-0 bg-[rgba(10,10,10,.36)] motion-safe:animate-[depFade_.18s_ease_both] md:bg-[rgba(10,10,10,.12)]"
                    onClick={() => { if (!ocupado) onCerrar(); }}
                />
                <div
                    ref={panel}
                    tabIndex={-1}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Detalle de la tarea"
                    className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-10px_40px_rgba(0,0,0,.18)] outline-none motion-safe:animate-[depSube_.26s_cubic-bezier(.2,.8,.2,1)_both] md:h-full md:max-h-none md:w-[420px] md:rounded-[28px] md:shadow-[0_20px_60px_rgba(0,0,0,.2)] md:motion-safe:animate-[depCostado_.22s_ease_both]"
                >
                    <span aria-hidden="true" className="mx-auto mt-2.5 block h-[5px] w-11 flex-none rounded-full bg-black/[.16] md:hidden" />
                    <div className="flex flex-none justify-end px-3 pt-3 md:pt-3">
                        <button
                            type="button"
                            onClick={onCerrar}
                            aria-label="Cerrar el detalle"
                            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f2f2f0] text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                        >
                            <X size={16} strokeWidth={2.2} aria-hidden="true" />
                        </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[22px] pb-5">
                        {carga.estado === 'cargando' && (
                            <div aria-busy="true" aria-label="Cargando la tarea" className="flex flex-col gap-3 pt-2">
                                <div className="h-7 w-3/4 rounded-xl bg-[#f2f2f0] motion-safe:animate-[depBrillo_1.2s_infinite]" />
                                <div className="h-[30px] w-40 rounded-full bg-[#f2f2f0] motion-safe:animate-[depBrillo_1.2s_infinite]" />
                                {[0, 1, 2, 3].map(i => (
                                    <div key={i} className="h-5 rounded-lg bg-[#f6f6f4] motion-safe:animate-[depBrillo_1.2s_infinite]" />
                                ))}
                            </div>
                        )}

                        {carga.estado === 'error' && (
                            <div className="flex flex-col items-start gap-3 pt-2">
                                <p className="m-0 text-[17px] font-bold">
                                    {carga.motivo === 'no_existe' ? 'Esta tarea ya no existe'
                                        : carga.motivo === 'sin_permiso' ? 'No podés ver esta tarea'
                                            : 'No pudimos cargar la tarea'}
                                </p>
                                <p className="m-0 text-[14px] font-medium leading-[1.6] text-black/[.62]">
                                    {carga.motivo === 'no_existe' ? 'Puede que alguien la haya eliminado mientras la mirabas.'
                                        : carga.motivo === 'sin_permiso' ? 'Es de un equipo del que no formás parte.'
                                            : mensajeDeMotivo(carga.motivo)}
                                </p>
                                {carga.motivo !== 'no_existe' && carga.motivo !== 'sin_permiso' && (
                                    <button type="button" onClick={cargar} className={BOTON_CHICO}>Reintentar</button>
                                )}
                            </div>
                        )}

                        {tarea && (
                            <>
                                <div className="flex items-start gap-3">
                                    <span
                                        aria-hidden="true"
                                        className="mt-1 h-[30px] w-[5px] flex-none rounded-full"
                                        style={{ background: tarea.subdepartamento?.color || 'rgba(0,0,0,.3)' }}
                                    />
                                    <h2 className="m-0 flex-1 text-[21px] font-bold leading-[1.25] tracking-[-0.015em]">{tarea.nombre}</h2>
                                </div>

                                <div className="mt-3 flex">
                                    <ChipEstado estado={tarea.estado} grande conCheck={reciencompletada && completada} />
                                </div>

                                <div className="mt-5 flex flex-col gap-3.5">
                                    <Dato icono={<CalendarDays size={18} strokeWidth={1.75} />}>
                                        {fechaDeDia(tarea.fecha)} · {horarioDeTarea(tarea)}
                                    </Dato>

                                    <Dato icono={(
                                        <span
                                            className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-white"
                                            style={{ background: tarea.departamento.color }}
                                        >
                                            <IconoDeDepartamento clave={tarea.departamento.icono} tam={11} grosor={2.2} />
                                        </span>
                                    )}>
                                        {tarea.departamento.nombre}
                                        <span className="text-black/[.38]">›</span>
                                        {tarea.subdepartamento ? (
                                            <span className="inline-flex items-center gap-1.5">
                                                <Punto color={tarea.subdepartamento.color} tam={8} />
                                                {tarea.subdepartamento.nombre}
                                                {tarea.subdepartamento.archivado && (
                                                    <span className="font-semibold text-black/[.5]">(archivado)</span>
                                                )}
                                            </span>
                                        ) : <span className="text-black/[.55]">Sin asignar</span>}
                                    </Dato>

                                    <Dato icono={<Signal size={18} strokeWidth={1.75} />}>
                                        {tarea.prioridad ? (
                                            <span className="inline-flex items-center gap-1.5">
                                                <Punto color={tarea.prioridad.color} tam={8} />
                                                {tarea.prioridad.nombre}
                                            </span>
                                        ) : <span className="text-black/[.55]">Sin prioridad</span>}
                                    </Dato>

                                    <Dato icono={<Folder size={18} strokeWidth={1.75} />}>
                                        {tarea.carpeta ? (
                                            <span className="inline-flex items-center gap-1.5">
                                                <Punto color={tarea.carpeta.color} tam={9} />
                                                {tarea.carpeta.nombre}
                                            </span>
                                        ) : <span className="text-black/[.55]">Sin carpeta</span>}
                                    </Dato>
                                </div>

                                <h3 className={`${ROTULO} mb-2.5 mt-6`}>La tienen</h3>
                                {tarea.laTienen.length > 0 ? (
                                    <ul className="m-0 flex list-none flex-col gap-2 p-0">
                                        {tarea.laTienen.map(p => (
                                            <li key={p.id} className="flex items-center gap-2.5">
                                                <Avatar persona={p} color={tarea.subdepartamento?.color || '#0a0a0a'} tam={32} />
                                                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{p.nombre || 'Sin nombre'}</span>
                                                {p.dirige && <span className="flex-none text-[11.5px] font-bold text-black/[.5]">Dirige</span>}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="m-0 text-[13.5px] font-medium text-black/[.62]">
                                        Todavía no se asignó a un sub-departamento.
                                    </p>
                                )}

                                {tarea.detalles && (
                                    <>
                                        <h3 className={`${ROTULO} mb-2 mt-6`}>Detalles</h3>
                                        <Detalles texto={tarea.detalles} />
                                    </>
                                )}

                                <div className="mt-5 flex flex-col gap-1 rounded-2xl bg-[#f6f6f4] px-3.5 py-3">
                                    {completada && tarea.completadaAt && (
                                        <p className="m-0 text-[12.5px] font-bold leading-[1.5] text-[#15803d]">
                                            Completada el {fechaYHora(tarea.completadaAt)}
                                            {tarea.completadaPor?.nombre ? ` por ${tarea.completadaPor.nombre}` : ''}
                                        </p>
                                    )}
                                    <p className="m-0 text-[12.5px] font-semibold leading-[1.5] text-black/[.55]">
                                        Creada el {fechaYHora(tarea.createdAt)}
                                        {tarea.creador?.nombre ? ` por ${tarea.creador.nombre}` : ''}
                                    </p>
                                    {tarea.solicitud && (
                                        <p className="m-0 text-[12.5px] font-semibold leading-[1.5] text-black/[.55]">
                                            Solicitada por {tarea.solicitud.solicitante?.nombre || 'alguien de la iglesia'} el {fechaYHora(tarea.solicitud.createdAt)}
                                        </p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {tarea && (tarea.puedeEditar || tarea.puedeCambiarEstado) && (
                        <div className="flex flex-none flex-col gap-2 border-t border-black/[.06] px-[18px] pb-[calc(18px+env(safe-area-inset-bottom))] pt-3 md:pb-[18px]">
                            {tarea.puedeEditar && (
                                <div className="flex gap-1.5">
                                    {puedeTocar && (
                                        <>
                                            <button type="button" onClick={() => setEditando(true)} className={`${BOTON_CHICO} flex-1`}>
                                                <Pencil size={15} strokeWidth={2} aria-hidden="true" />
                                                Editar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setReasignando(true)}
                                                disabled={completada || otros.length === 0}
                                                title={completada ? 'Ya está completada: primero volvela a En proceso.'
                                                    : otros.length === 0 ? 'No hay otro sub-departamento en este departamento.' : undefined}
                                                aria-describedby={completada ? 'detalle-tarea-porque' : undefined}
                                                className={`${BOTON_CHICO} flex-1`}
                                            >
                                                <ArrowLeftRight size={15} strokeWidth={2} aria-hidden="true" />
                                                {tarea.subdepartamento ? 'Reasignar' : 'Asignar'}
                                            </button>
                                        </>
                                    )}
                                    <button
                                        type="button"
                                        onClick={pedirEliminar}
                                        aria-label={`Eliminar la tarea ${tarea.nombre}`}
                                        className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#f2f2f0] text-[#b42318] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b42318] focus-visible:ring-offset-2"
                                    >
                                        <Trash2 size={16} strokeWidth={1.9} aria-hidden="true" />
                                    </button>
                                </div>
                            )}
                            {completada && (
                                <span id="detalle-tarea-porque" className="sr-only">
                                    Ya está completada: para cambiarle el equipo, primero volvela a En proceso.
                                </span>
                            )}

                            {tarea.puedeCambiarEstado && tarea.estado === 'en_proceso' && (
                                <button
                                    type="button"
                                    onClick={pedirCompletar}
                                    disabled={ocupado}
                                    className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#0a0a0a] text-[15px] font-bold text-white transition-opacity disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                >
                                    <Check size={17} strokeWidth={2.4} aria-hidden="true" />
                                    Marcar como completada
                                </button>
                            )}
                            {tarea.puedeCambiarEstado && completada && (
                                <button
                                    type="button"
                                    onClick={() => cambiarEstado('en_proceso')}
                                    disabled={ocupado}
                                    className="flex h-[52px] w-full items-center justify-center rounded-full bg-[#f2f2f0] text-[15px] font-bold text-black/[.66] transition-colors hover:text-[#0a0a0a] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                >
                                    Volver a En proceso
                                </button>
                            )}
                            {tarea.puedeCambiarEstado && tarea.estado === 'esperando' && (
                                <p className="m-0 text-center text-[13px] font-semibold text-black/[.55]">
                                    Se puede completar cuando esté asignada a un sub-departamento.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {editando && tarea && edicion && (
                <FormularioTarea
                    modo="editar"
                    datos={edicion}
                    acciones={acciones}
                    tarea={tarea}
                    onCerrar={() => setEditando(false)}
                    onGuardada={async guardada => {
                        setEditando(false);
                        acciones.avisar('Cambios guardados.');
                        onCambio?.({ tipo: 'guardada', tarea: guardada, creada: false });
                        await cargar();
                    }}
                />
            )}

            {reasignando && tarea && (
                <HojaElegir
                    titulo={tarea.subdepartamento ? 'Reasignar tarea' : 'Asignar a un sub-departamento'}
                    subtitulo={tarea.subdepartamento
                        ? `“${tarea.nombre}” hoy la tiene ${tarea.subdepartamento.nombre}. ¿A qué sub-departamento pasa?`
                        : `“${tarea.nombre}” está esperando asignación. ¿Qué equipo se encarga?`}
                    opciones={otros.map(s => ({
                        id: s.id, nombre: s.nombre, color: s.color, meta: plural(s.cantMiembros, 'persona', 'personas'),
                    }))}
                    vacio="No hay otro sub-departamento en este departamento."
                    etiqueta={tarea.subdepartamento ? 'Reasignar' : 'Asignar'}
                    onElegir={pedirReasignar}
                    onCerrar={() => setReasignando(false)}
                />
            )}
        </>
    );
};

export default DetalleTarea;
