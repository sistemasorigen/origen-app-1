import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Clock } from 'lucide-react';
import {
    emailsAgendaActivos, crearTarea, editarTarea, fechaYHora, hoyIso, mensajeDeMotivo, nuevoId, sello,
    type Carpeta, type DatosDeTarea, type MotivoAgenda, type Tarea, type TareaDetalle,
} from '../../services/agenda';
import { Avatar, ErrorDeCampo, RotuloPaso, tinte } from '../../pages/admin/departamentos/piezas';
import { Hoja, PieDeHoja, Punto } from '../../pages/departamentos/equipo/piezas';
import ComboboxDeSub from './ComboboxDeSub';
import type { AccionesDeAgenda, DatosParaEditar } from './contratos';

/**
 * Cargar o cambiar una tarea (design-claude/Departamento - Tareas: "Crear
 * tarea" y "Editar tarea").
 *
 * La usan tres pantallas: la pestaña Tareas de un departamento, las
 * Solicitudes —que la abren con los detalles del pedido ya escritos y un
 * recuadro arriba diciendo quién lo pidió— y la Agenda. Por eso no sabe nada
 * de rutas ni de avisos: recibe los datos del departamento, devuelve la tarea
 * guardada y la pantalla decide qué decir.
 *
 * EL ESTADO LO PONE LA BASE. Sin sub-departamento la tarea queda "esperando";
 * con uno, "en proceso". Acá no se calcula nada: se manda lo que se eligió.
 *
 * El id se genera UNA vez al abrir en modo crear: un doble toque o un
 * reintento no crean dos tareas (agenda_crear_tarea es idempotente por id).
 */

const MAXIMO_NOMBRE = 120;
const MAXIMO_DETALLES = 4000;
/** Desde cuántas letras libres se avisa cuánto queda. */
const AVISO_DETALLES = 300;
/** Lo que propone el horario cuando se apaga "Todo el día". */
const HORA_DESDE = '19:00';
const HORA_HASTA = '20:30';

type Campo = 'nombre' | 'sub' | 'carpeta' | 'fecha' | 'horario' | 'prioridad' | 'detalles' | 'general';

/** Qué campo marca cada motivo de la base. */
const CAMPO: Partial<Record<MotivoAgenda, Campo>> = {
    nombre_invalido: 'nombre',
    sub_ajeno: 'sub', archivado: 'sub', completada: 'sub',
    carpeta_ajena: 'carpeta',
    prioridad_ajena: 'prioridad', prioridad_requerida: 'prioridad',
    fecha_invalida: 'fecha',
    horario_invalido: 'horario',
    detalles_largos: 'detalles', detalles_cortos: 'detalles',
};

export interface PropsFormularioTarea {
    modo: 'crear' | 'editar';
    /** Los equipos, carpetas y prioridades del departamento. */
    datos: DatosParaEditar;
    acciones: AccionesDeAgenda;
    /** En 'editar', la tarea que se está cambiando (con sus detalles). */
    tarea?: TareaDetalle;
    /** Arranca con estos valores: las Solicitudes mandan los detalles del pedido. */
    valoresIniciales?: Partial<DatosDeTarea>;
    /** Un recuadro arriba de todo: de dónde viene esta tarea. */
    referencia?: React.ReactNode;
    /** La solicitud que se está asignando. Pasa a agenda_crear_tarea. */
    solicitudId?: string | null;
    /** Por defecto "Crear tarea" / "Editar tarea". */
    titulo?: string;
    /** Por defecto "Crear tarea" / "Guardar cambios". */
    etiquetaDeAccion?: string;
    onCerrar: () => void;
    /** La pantalla decide el aviso: el formulario no lo escribe. */
    onGuardada: (tarea: Tarea, creada: boolean) => void;
}

const CAMPO_CLASE = 'h-[50px] w-full px-4 text-[15px] font-semibold';
const conBorde = (mal: boolean) => (mal ? ({ '--ag-borde': '#b42318' } as React.CSSProperties) : undefined);

const FormularioTarea: React.FC<PropsFormularioTarea> = ({
    modo, datos, acciones, tarea, valoresIniciales, referencia, solicitudId,
    titulo, etiquetaDeAccion, onCerrar, onGuardada,
}) => {
    // Lo que había al abrir: para saber si hay cambios que descartar.
    const inicial = useRef<DatosDeTarea>((() => {
        const base: DatosDeTarea = {
            subdepartamentoId: tarea?.subdepartamento?.id ?? null,
            carpetaId: tarea?.carpeta?.id ?? null,
            prioridadId: tarea?.prioridad?.id ?? null,
            nombre: tarea?.nombre ?? '',
            detalles: tarea?.detalles ?? null,
            fecha: tarea?.fecha || hoyIso(),
            todoElDia: tarea ? tarea.todoElDia : true,
            horaDesde: tarea?.horaDesde ?? null,
            horaHasta: tarea?.horaHasta ?? null,
        };
        // Sólo lo que vino de verdad: una clave con undefined no pisa nada.
        const pedido = Object.fromEntries(
            Object.entries(valoresIniciales ?? {}).filter(([, valor]) => valor !== undefined),
        ) as Partial<DatosDeTarea>;
        return { ...base, ...pedido };
    })()).current;

    const [id] = useState(nuevoId);
    const [sub, setSub] = useState<string | null>(inicial.subdepartamentoId);
    const [carpetaId, setCarpetaId] = useState<string | null>(inicial.carpetaId);
    const [prioridadId, setPrioridadId] = useState<string | null>(inicial.prioridadId);
    const [nombre, setNombre] = useState(inicial.nombre);
    const [detalles, setDetalles] = useState(inicial.detalles || '');
    const [fecha, setFecha] = useState(inicial.fecha);
    const [todoElDia, setTodoElDia] = useState(inicial.todoElDia);
    const [horaDesde, setHoraDesde] = useState(inicial.horaDesde || '');
    const [horaHasta, setHoraHasta] = useState(inicial.horaHasta || '');
    /** Las que se crearon desde acá, hasta que la pantalla de atrás se actualice. */
    const [carpetasNuevas, setCarpetasNuevas] = useState<Carpeta[]>([]);
    const [tocado, setTocado] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<{ campo: Campo; texto: string } | null>(null);

    const enviando = useRef(false);
    const campoNombre = useRef<HTMLInputElement>(null);
    const campoFecha = useRef<HTMLInputElement>(null);
    const idBase = useRef(`tarea-${Math.random().toString(36).slice(2, 8)}`).current;

    // La hora que corre, para la nota al pie de "crear".
    const [ahora, setAhora] = useState(() => new Date());
    useEffect(() => {
        if (modo !== 'crear') return;
        const reloj = window.setInterval(() => setAhora(new Date()), 20_000);
        return () => window.clearInterval(reloj);
    }, [modo]);

    const completada = tarea?.estado === 'completada';
    const carpetas = useMemo(() => [...datos.carpetas, ...carpetasNuevas], [datos.carpetas, carpetasNuevas]);
    const elegido = datos.subdepartamentos.find(s => s.id === sub) ?? null;

    /** Quién la va a ver: quien dirige el equipo elegido y sus integrantes. */
    const laVanAVer = useMemo(() => {
        if (!elegido) return [];
        return [
            ...(elegido.lider ? [{ ...elegido.lider, dirige: true }] : []),
            ...elegido.miembros.map(m => ({ ...m, dirige: false })),
        ];
    }, [elegido]);

    const sinNombre = nombre.trim() === '';
    const horarioIncompleto = !todoElDia && (!horaDesde || !horaHasta);
    const horarioAlReves = !todoElDia && !!horaDesde && !!horaHasta && horaHasta <= horaDesde;
    const horarioMal = horarioIncompleto || horarioAlReves;
    const invalido = sinNombre || !fecha || horarioMal;

    const errorDe = (c: Campo) => (error?.campo === c ? error.texto : null);
    const errNombre = errorDe('nombre') ?? (tocado && sinNombre ? 'Escribí un nombre para la tarea.' : null);
    const errFecha = errorDe('fecha') ?? (tocado && !fecha ? 'Elegí el día.' : null);
    const errHorario = errorDe('horario') ?? (
        horarioAlReves ? 'La hora de “Hasta” tiene que ser después de “Desde”.'
            : tocado && horarioIncompleto ? 'Completá desde y hasta qué hora.' : null);

    /**
     * Lo primero que falta, para el pie de la hoja. Es un RESUMEN que apunta
     * al campo: el detalle lo dice el error del campo, y repetir la misma
     * frase dos veces en la misma hoja es ruido.
     */
    const queFalta = sinNombre ? 'Falta el nombre de la tarea.'
        : !fecha ? 'Falta el día.'
            : horarioIncompleto ? 'Falta completar el horario.'
                : horarioAlReves ? 'Revisá el horario.'
                    : null;

    const hayCambios = nombre !== inicial.nombre
        || sub !== inicial.subdepartamentoId
        || carpetaId !== inicial.carpetaId
        || prioridadId !== inicial.prioridadId
        || (detalles || '') !== (inicial.detalles || '')
        || fecha !== inicial.fecha
        || todoElDia !== inicial.todoElDia
        || (horaDesde || '') !== (inicial.horaDesde || '')
        || (horaHasta || '') !== (inicial.horaHasta || '');

    const intentarCerrar = () => {
        if (guardando) return;
        if (!hayCambios) { onCerrar(); return; }
        acciones.confirmar({
            tipo: 'destructivo',
            rotulo: 'Cambios sin guardar',
            titulo: '¿Descartar los cambios?',
            texto: 'Lo que cargaste se pierde.',
            etiquetaBoton: 'Descartar',
            onConfirmar: onCerrar,
        });
    };

    const alCambiarCarpeta = (valor: string) => {
        if (valor === '__nueva') {
            datos.onPedirCarpeta?.(creada => {
                setCarpetasNuevas(l => [...l, creada]);
                setCarpetaId(creada.id);
            });
            return;
        }
        setCarpetaId(valor || null);
        if (error?.campo === 'carpeta') setError(null);
    };

    const guardar = async () => {
        if (enviando.current) return;
        if (invalido) {
            setTocado(true);
            if (sinNombre) campoNombre.current?.focus();
            else if (!fecha) campoFecha.current?.focus();
            return;
        }
        enviando.current = true;
        setGuardando(true);
        setError(null);
        const carga: DatosDeTarea = {
            subdepartamentoId: sub,
            carpetaId,
            prioridadId,
            nombre,
            detalles: detalles.trim() || null,
            fecha,
            todoElDia,
            horaDesde: todoElDia ? null : horaDesde,
            horaHasta: todoElDia ? null : horaHasta,
        };
        const r = modo === 'crear'
            ? await crearTarea({ ...carga, id, departamentoId: datos.departamentoId, solicitudId: solicitudId ?? null })
            : await editarTarea(tarea?.id ?? '', carga);
        enviando.current = false;
        setGuardando(false);
        if (!r.ok) { setError({ campo: CAMPO[r.motivo] ?? 'general', texto: mensajeDeMotivo(r.motivo) }); return; }
        onGuardada(r.tarea, modo === 'crear');
    };

    return (
        <Hoja
            titulo={titulo ?? (modo === 'crear' ? 'Crear tarea' : 'Editar tarea')}
            onCerrar={intentarCerrar}
            ocupada={guardando}
            ancho={620}
            pie={(
                <PieDeHoja
                    onCancelar={intentarCerrar}
                    onAceptar={guardar}
                    etiqueta={etiquetaDeAccion ?? (modo === 'crear' ? 'Crear tarea' : 'Guardar cambios')}
                    guardando={guardando}
                    apagado={invalido}
                    falta={queFalta}
                />
            )}
        >
            {referencia}

            {/* Nombre */}
            <label className="flex flex-col gap-2">
                <RotuloPaso>Nombre de la tarea</RotuloPaso>
                <input
                    ref={campoNombre}
                    value={nombre}
                    onChange={e => { setNombre(e.target.value); if (error?.campo === 'nombre') setError(null); }}
                    maxLength={MAXIMO_NOMBRE}
                    placeholder="Por ejemplo, Placa del almuerzo"
                    aria-invalid={!!errNombre}
                    aria-describedby={errNombre ? `${idBase}-err-nombre` : undefined}
                    autoComplete="off"
                    className={CAMPO_CLASE}
                    style={conBorde(!!errNombre)}
                />
                {errNombre && <ErrorDeCampo id={`${idBase}-err-nombre`}>{errNombre}</ErrorDeCampo>}
            </label>

            <ComboboxDeSub
                subdepartamentos={datos.subdepartamentos}
                valor={sub}
                onCambiar={elegido2 => { setSub(elegido2); if (error?.campo === 'sub') setError(null); }}
                bloqueado={completada}
                motivoDelBloqueo="Está completada: para cambiarle el equipo, primero volvela a En proceso."
                error={errorDe('sub')}
            />

            {/* Carpeta y día */}
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                    <RotuloPaso>Carpeta</RotuloPaso>
                    {/* El aria-label no es de más: con el rótulo envolviendo
                        al select, el nombre accesible sale "Carpeta" más el
                        texto de TODAS las opciones. Así queda en una palabra. */}
                    <span className="relative block">
                        <select
                            aria-label="Carpeta"
                            value={carpetaId ?? ''}
                            onChange={e => alCambiarCarpeta(e.target.value)}
                            className={`${CAMPO_CLASE} cursor-pointer pr-10`}
                            style={conBorde(!!errorDe('carpeta'))}
                        >
                            <option value="">Sin carpeta</option>
                            {carpetas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            {datos.onPedirCarpeta && <option value="__nueva">Nueva carpeta…</option>}
                        </select>
                        <ChevronDown
                            size={14}
                            strokeWidth={2.4}
                            aria-hidden="true"
                            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-black/[.55]"
                        />
                    </span>
                    {errorDe('carpeta') && <ErrorDeCampo id={`${idBase}-err-carpeta`}>{errorDe('carpeta')}</ErrorDeCampo>}
                </label>

                <label className="flex flex-col gap-2">
                    <RotuloPaso>Día</RotuloPaso>
                    <input
                        ref={campoFecha}
                        type="date"
                        value={fecha}
                        onChange={e => { setFecha(e.target.value); if (error?.campo === 'fecha') setError(null); }}
                        aria-invalid={!!errFecha}
                        aria-describedby={errFecha ? `${idBase}-err-fecha` : undefined}
                        className={CAMPO_CLASE}
                        style={conBorde(!!errFecha)}
                    />
                    {errFecha && <ErrorDeCampo id={`${idBase}-err-fecha`}>{errFecha}</ErrorDeCampo>}
                </label>
            </div>

            {/* Horario */}
            <div className="flex flex-col gap-2.5">
                <button
                    type="button"
                    role="switch"
                    aria-checked={todoElDia}
                    onClick={() => {
                        if (todoElDia) {
                            if (!horaDesde) setHoraDesde(HORA_DESDE);
                            if (!horaHasta) setHoraHasta(HORA_HASTA);
                        }
                        setTodoElDia(v => !v);
                        if (error?.campo === 'horario') setError(null);
                    }}
                    className="flex min-h-[52px] items-center gap-3 rounded-2xl bg-[#f6f6f4] px-3.5 text-left shadow-[inset_0_0_0_1px_rgba(0,0,0,.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                >
                    <Clock size={18} strokeWidth={1.9} aria-hidden="true" className="flex-none text-black/[.55]" />
                    <span className="flex-1 text-[14.5px] font-bold">Todo el día</span>
                    <span
                        aria-hidden="true"
                        className="relative h-7 w-12 flex-none rounded-full transition-colors"
                        style={{ background: todoElDia ? '#0a0a0a' : 'rgba(0,0,0,.16)' }}
                    >
                        <span
                            className="absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)] transition-[left]"
                            style={{ left: todoElDia ? 23 : 3 }}
                        />
                    </span>
                </button>

                {!todoElDia && (
                    <>
                        <div className="grid grid-cols-2 gap-2.5">
                            <label className="flex flex-col gap-1.5">
                                <span className="text-[13px] font-bold text-black/[.62]">Desde</span>
                                <input
                                    type="time"
                                    step={300}
                                    value={horaDesde}
                                    onChange={e => { setHoraDesde(e.target.value); if (error?.campo === 'horario') setError(null); }}
                                    aria-invalid={!!errHorario}
                                    aria-describedby={errHorario ? `${idBase}-err-horario` : undefined}
                                    className={CAMPO_CLASE}
                                    style={conBorde(!!errHorario && !horaDesde)}
                                />
                            </label>
                            <label className="flex flex-col gap-1.5">
                                <span className="text-[13px] font-bold text-black/[.62]">Hasta</span>
                                <input
                                    type="time"
                                    step={300}
                                    value={horaHasta}
                                    onChange={e => { setHoraHasta(e.target.value); if (error?.campo === 'horario') setError(null); }}
                                    aria-invalid={!!errHorario}
                                    aria-describedby={errHorario ? `${idBase}-err-horario` : undefined}
                                    className={CAMPO_CLASE}
                                    style={conBorde(!!errHorario && !!horaDesde)}
                                />
                            </label>
                        </div>
                        {errHorario && <ErrorDeCampo id={`${idBase}-err-horario`}>{errHorario}</ErrorDeCampo>}
                    </>
                )}
            </div>

            {/* Prioridad */}
            <div className="flex flex-col gap-2.5">
                <RotuloPaso id={`${idBase}-rot-prio`}>Prioridad</RotuloPaso>
                {datos.prioridades.length === 0 ? (
                    <p className="m-0 text-[13.5px] font-semibold leading-[1.5] text-black/[.62]">
                        Este departamento todavía no tiene prioridades.
                        {datos.onIrAConfig && (
                            <>
                                {' '}
                                <button
                                    type="button"
                                    onClick={datos.onIrAConfig}
                                    className="font-bold text-[#0a0a0a] underline underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                                >
                                    Cargarlas en Configuración
                                </button>
                            </>
                        )}
                    </p>
                ) : (
                    <div role="radiogroup" aria-labelledby={`${idBase}-rot-prio`} className="flex flex-wrap gap-1.5">
                        {datos.prioridades.map(p => {
                            const on = prioridadId === p.id;
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={on}
                                    // Se puede tocar de nuevo para quitarla: la prioridad es opcional.
                                    onClick={() => { setPrioridadId(on ? null : p.id); if (error?.campo === 'prioridad') setError(null); }}
                                    className={`flex min-h-[44px] items-center gap-2 rounded-full px-3.5 text-[13.5px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${on ? 'text-[#0a0a0a]' : 'bg-[#f2f2f0] text-black/[.62]'}`}
                                    style={on ? { background: tinte(p.color, '24'), boxShadow: `inset 0 0 0 2px ${p.color}` } : undefined}
                                >
                                    <Punto color={p.color} tam={9} />
                                    {p.nombre}
                                </button>
                            );
                        })}
                    </div>
                )}
                {errorDe('prioridad') && <ErrorDeCampo id={`${idBase}-err-prio`}>{errorDe('prioridad')}</ErrorDeCampo>}
            </div>

            {/* Detalles */}
            <label className="flex flex-col gap-2">
                <RotuloPaso>Detalles</RotuloPaso>
                <textarea
                    value={detalles}
                    onChange={e => { setDetalles(e.target.value); if (error?.campo === 'detalles') setError(null); }}
                    maxLength={MAXIMO_DETALLES}
                    rows={5}
                    placeholder="Qué hay que hacer, para cuándo y cualquier dato útil"
                    aria-describedby={errorDe('detalles') ? `${idBase}-err-det` : undefined}
                    className="min-h-[130px] w-full resize-y px-4 py-3.5 text-[15px] font-medium leading-[1.55]"
                    style={conBorde(!!errorDe('detalles'))}
                />
                {MAXIMO_DETALLES - detalles.length <= AVISO_DETALLES && (
                    <span className="text-[12px] font-semibold text-black/[.58]">
                        Quedan {MAXIMO_DETALLES - detalles.length} letras
                    </span>
                )}
                {errorDe('detalles') && <ErrorDeCampo id={`${idBase}-err-det`}>{errorDe('detalles')}</ErrorDeCampo>}
            </label>

            {/* La van a ver */}
            <div className="rounded-[18px] bg-[#f6f6f4] px-4 py-3.5">
                <RotuloPaso>La van a ver</RotuloPaso>
                {laVanAVer.length > 0 ? (
                    <>
                        <div className="mt-3 flex flex-wrap gap-x-3.5 gap-y-2.5">
                            {laVanAVer.map(p => (
                                <span key={p.id} className="flex items-center gap-2 text-[13px] font-bold">
                                    <Avatar persona={p} color={elegido?.color ?? '#0a0a0a'} tam={28} />
                                    {p.nombre || 'Sin nombre'}
                                    {p.dirige && <span className="font-semibold text-black/[.5]">· dirige</span>}
                                </span>
                            ))}
                        </div>
                        <p className="m-0 mt-3 text-[12.5px] font-semibold text-black/[.55]">
                            {emailsAgendaActivos() ? 'Les llega a la Agenda y por email.' : 'Les aparece en su Agenda.'}
                        </p>
                    </>
                ) : (
                    <p className="m-0 mt-2 text-[13.5px] font-semibold leading-[1.5] text-black/[.62]">
                        Nadie todavía: queda esperando asignación.
                    </p>
                )}
            </div>

            <p className="m-0 text-[12.5px] font-semibold text-black/[.5]">
                {modo === 'crear'
                    ? `Se va a registrar: ${sello(ahora)}${datos.miNombre ? ` · por ${datos.miNombre}` : ''}`
                    : `Creada el ${fechaYHora(tarea?.createdAt ?? null)}${tarea?.creador?.nombre ? ` por ${tarea.creador.nombre}` : ''}`}
            </p>

            {errorDe('general') && <p role="alert" className="m-0 text-[13px] font-bold text-[#b42318]">{errorDe('general')}</p>}
        </Hoja>
    );
};

export default FormularioTarea;
