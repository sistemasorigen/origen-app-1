import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { CalendarRange, Check, ChevronDown, Clock } from 'lucide-react';
import {
    crearTarea, editarTarea, fechaYHora, getRepeticionesPosibles, hoyIso, mensajeDeMotivo,
    nuevoId, sello, sumarDias,
    type AlcanceSerie, type Carpeta, type DatosDeTarea, type Frecuencia, type MotivoAgenda,
    type OpcionRepeticion, type Persona, type Tarea, type TareaDetalle,
} from '../../services/agenda';
import { Avatar, ErrorDeCampo, RotuloDeCampo, tinte } from '../../pages/admin/departamentos/piezas';
import { Hoja, PieDeHoja, Punto, TARJETA } from '../../pages/departamentos/equipo/piezas';
import { diaYMes, enLista, largoDelPlazo, pendientesDeLaSerie, resumenCortoDeCuando, resumenDeCuando } from '../../pages/agenda/plazos';
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
 *
 * VARIOS EQUIPOS: al crear se puede elegir más de uno, o "Todos", y entonces es
 * obligatorio decir si la tarea es compartida:
 *   · Sí: UNA tarea con esos equipos (`p_subs`), que se completa cuando terminan
 *     todos. Lo resuelve la base (sql/agenda_tareas_compartidas.sql).
 *   · No: una copia por equipo, con su id. Cada uno la completa por su lado, y
 *     un reintento no duplica ninguna.
 *
 * TRES SECCIONES: La tarea, Quién la hace y Cuándo. Desde 1024 px van en dos
 * columnas y se ve todo; debajo, en una sola, con tres pastillas fijas para
 * saltar entre ellas. Las secciones son sólo presentación: las reglas y lo
 * que se manda no saben que existen.
 */

const MAXIMO_NOMBRE = 120;
const MAXIMO_DETALLES = 4000;
/** Desde cuántas letras libres se avisa cuánto queda. */
const AVISO_DETALLES = 300;
/** Lo que propone el horario cuando se apaga "Todo el día". */
const HORA_DESDE = '19:00';
const HORA_HASTA = '20:30';

/** Cuánto se espera antes de preguntarle a la base qué repeticiones entran. */
const ESPERA_OPCIONES = 350;
/** Lo que propone "Con plazo" la primera vez. */
const PLAZO_SUGERIDO = 30;

/**
 * Las frecuencias de "Un día · ¿Se repite?". Ahí se elige primero cada cuánto
 * y después hasta cuándo, así que la lista no puede esperar a la base: los
 * nombres son los de `agenda_frecuencia_texto`. SI ENTRA y CUÁNTAS VECES lo
 * sigue contestando la base (`getRepeticionesPosibles`) con el "Hasta".
 */
const FRECUENCIAS: Array<{ id: Frecuencia; nombre: string }> = [
    { id: 'todos_los_dias', nombre: 'Todos los días' },
    { id: 'dia_por_medio', nombre: 'Día por medio' },
    { id: 'cada_semana', nombre: 'Cada semana' },
    { id: 'semana_por_medio', nombre: 'Semana por medio' },
    { id: 'por_mes', nombre: 'Por mes' },
];

/**
 * El "Hasta" que se propone al elegir una frecuencia en "Un día": un largo
 * razonable para cada una (una semana de días, un mes de semanas, tres
 * meses de meses). Es sólo una propuesta; la persona lo cambia y la base dice
 * cuántas veces da.
 */
const HASTA_SUGERIDO: Record<Frecuencia, number> = {
    todos_los_dias: 6, dia_por_medio: 12, cada_semana: 28, semana_por_medio: 56, por_mes: 92,
};

type Campo = 'nombre' | 'sub' | 'carpeta' | 'fecha' | 'plazo' | 'repeticion' | 'horario' | 'prioridad' | 'detalles' | 'general';

/** Qué campo marca cada motivo de la base. */
const CAMPO: Partial<Record<MotivoAgenda, Campo>> = {
    nombre_invalido: 'nombre',
    sub_ajeno: 'sub', archivado: 'sub', completada: 'sub',
    es_compartida: 'sub', sin_equipos: 'sub', compartida_minimo: 'sub',
    carpeta_ajena: 'carpeta',
    prioridad_ajena: 'prioridad', prioridad_requerida: 'prioridad',
    fecha_invalida: 'fecha',
    plazo_invalido: 'plazo',
    repeticion_no_disponible: 'repeticion', demasiadas_repeticiones: 'repeticion',
    serie_invalida: 'repeticion', serie_completada: 'repeticion', alcance_invalido: 'repeticion',
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
    /**
     * La pantalla decide el aviso: el formulario no lo escribe. `veces` es
     * cuántas repeticiones se crearon o se cambiaron (1 si no es una serie),
     * para que el aviso pueda decir "Se crearon 6 repeticiones". `equipos` es
     * para cuántos equipos se creó (1 si fue uno solo o ninguno).
     */
    onGuardada: (tarea: Tarea, creada: boolean, veces?: number, equipos?: number) => void;
}

/**
 * "¿Se repite?": UNA barra que se despliega, la misma que la de Carpeta. Es
 * un select nativo a propósito: en el teléfono abre la rueda del sistema y el
 * lector de pantalla la anuncia sin ayuda. Las opciones que la base dice que
 * no entran siguen en la lista, deshabilitadas y con el motivo en el texto.
 */
const BarraDeRepeticion: React.FC<{
    valor: Frecuencia | null;
    /** El texto de "no se repite"; null si no se ofrece (al editar una serie). */
    sinRepetir: string | null;
    opciones: Array<{ id: Frecuencia; texto: string; apagada?: boolean }>;
    mal?: boolean;
    describe?: string;
    onCambiar: (f: Frecuencia | null) => void;
}> = ({ valor, sinRepetir, opciones, mal = false, describe, onCambiar }) => (
    <span className="relative block">
        <select
            aria-label="¿Se repite?"
            value={valor ?? ''}
            onChange={e => onCambiar((e.target.value || null) as Frecuencia | null)}
            aria-invalid={mal || undefined}
            aria-describedby={describe}
            className={`${CAMPO_CLASE} cursor-pointer pr-10`}
            style={conBorde(mal)}
        >
            {sinRepetir !== null && <option value="">{sinRepetir}</option>}
            {opciones.map(o => (
                <option key={o.id} value={o.id} disabled={o.apagada}>{o.texto}</option>
            ))}
        </select>
        <ChevronDown
            size={14}
            strokeWidth={2.4}
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-black/[.55]"
        />
    </span>
);

const CAMPO_CLASE = 'h-[50px] w-full px-4 text-[15px] font-semibold';
const conBorde = (mal: boolean) => (mal ? ({ '--ag-borde': '#b42318' } as React.CSSProperties) : undefined);

/** Desde acá entran las dos columnas sin apretar los campos. */
const MEDIDA_DOS_COLUMNAS = '(min-width: 1024px)';

/** Una de las tres tarjetas. El título se lee antes que los campos. */
const Seccion: React.FC<{
    numero: 1 | 2 | 3;
    titulo: string;
    bajada?: string;
    /** Lo que va a la derecha del título. */
    derecha?: string;
    idBase: string;
    refSeccion: React.RefObject<HTMLElement | null>;
    children: React.ReactNode;
}> = ({ numero, titulo, bajada, derecha, idBase, refSeccion, children }) => (
    <section ref={refSeccion} aria-labelledby={`${idBase}-seccion-${numero}`} className={`${TARJETA} flex flex-col gap-4 p-[18px] md:p-5`}>
        <div className="flex items-center gap-2.5">
            <div className="min-w-0 flex-none">
                <h3 id={`${idBase}-seccion-${numero}`} className="m-0 text-[12px] font-extrabold uppercase leading-[1.2] tracking-[0.08em] text-[#0a0a0a]">
                    {titulo}
                </h3>
                {bajada && <p className="m-0 mt-0.5 text-[12.5px] font-medium leading-[1.3] text-black/[.55]">{bajada}</p>}
            </div>
            {derecha && (
                <span className="ml-auto min-w-0 truncate text-right text-[12.5px] font-bold text-black/[.72]">{derecha}</span>
            )}
        </div>
        {children}
    </section>
);

/** Las tres pastillas de arriba, cuando las secciones van una abajo de la otra. */
const PastillasDeSeccion: React.FC<{
    visible: 1 | 2 | 3;
    completas: [boolean, boolean, boolean];
    onElegir: (n: 1 | 2 | 3) => void;
}> = ({ visible, completas, onElegir }) => (
    <nav aria-label="Secciones del formulario" className="contenido-del-overlay flex flex-none gap-1.5 px-4 pb-2.5 md:px-[22px]">
        {([[1, 'Tarea'], [2, 'Quién'], [3, 'Cuándo']] as const).map(([n, texto]) => {
            const on = visible === n;
            const lista = completas[n - 1];
            return (
                <button
                    key={n}
                    type="button"
                    onClick={() => onElegir(n)}
                    aria-current={on ? 'true' : undefined}
                    className={`flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${on ? 'bg-[#0a0a0a] text-white' : 'bg-white text-black/[.66] shadow-[0_1px_2px_rgba(0,0,0,.04)]'}`}
                >
                    {lista && (
                        <span
                            aria-hidden="true"
                            className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full ${on ? 'bg-white text-[#0a0a0a]' : 'bg-[#0a0a0a] text-white'}`}
                        >
                            <Check size={11} strokeWidth={3.2} />
                        </span>
                    )}
                    {texto}
                    {lista && <span className="sr-only">, completa</span>}
                </button>
            );
        })}
    </nav>
);

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
    /** Los equipos elegidos. Al editar es uno como máximo: una tarea es de un equipo. */
    const [subs, setSubs] = useState<string[]>(
        tarea?.compartida
            ? (tarea.equipos ?? []).filter(e => !e.archivado).map(e => e.id)
            : (inicial.subdepartamentoId ? [inicial.subdepartamentoId] : []));
    const eraCompartida = !!tarea?.compartida;
    const subsIniciales = useRef(subs).current;
    /** La respuesta a "¿La tarea es compartida?". null: todavía no contestó. */
    const [compartida, setCompartida] = useState<boolean | null>(null);
    const preguntaCompartida = modo === 'crear' && subs.length > 1;
    const esCompartida = eraCompartida || (preguntaCompartida && compartida === true);
    const faltaCompartida = preguntaCompartida && compartida === null;
    /**
     * "Sin asignar todavía", elegido a propósito. Es obligatorio elegir algo, y
     * esto es lo que distingue esa elección de no haber elegido nada: las dos
     * cosas tienen `subs` vacío. Una tarea que ya existe sin equipo la trae puesta.
     */
    const [sinAsignar, setSinAsignar] = useState(modo === 'editar' && !eraCompartida && !inicial.subdepartamentoId);
    const sub = subs[0] ?? null;
    const subDecidido = sinAsignar || subs.length > 0;
    const [carpetaId, setCarpetaId] = useState<string | null>(inicial.carpetaId);
    const [prioridadId, setPrioridadId] = useState<string | null>(inicial.prioridadId);
    const [nombre, setNombre] = useState(inicial.nombre);
    const [detalles, setDetalles] = useState(inicial.detalles || '');
    const [fecha, setFecha] = useState(inicial.fecha);
    /**
     * Las tres formas de una tarea viven en dos controles: "Con plazo" prende
     * `fechaHasta`, y dentro de un plazo `frecuencia` lo vuelve una serie.
     * Una tarea que ya existe NO se convierte en serie (la base contesta
     * `serie_invalida`), así que al editar la repetición sólo aparece si ya
     * era una.
     */
    const [conPlazo, setConPlazo] = useState(!!tarea?.fechaHasta || !!tarea?.serie);
    const [fechaHasta, setFechaHasta] = useState(
        tarea?.fechaHasta || tarea?.serie?.hasta || '');
    const [frecuencia, setFrecuencia] = useState<Frecuencia | null>(tarea?.serie?.frecuencia ?? null);
    const [opciones, setOpciones] = useState<OpcionRepeticion[]>([]);
    const [buscandoOpciones, setBuscandoOpciones] = useState(false);
    const [avisoRepeticion, setAvisoRepeticion] = useState<string | null>(null);
    const [todoElDia, setTodoElDia] = useState(inicial.todoElDia);
    const [horaDesde, setHoraDesde] = useState(inicial.horaDesde || '');
    const [horaHasta, setHoraHasta] = useState(inicial.horaHasta || '');
    /** Las que se crearon desde acá, hasta que la pantalla de atrás se actualice. */
    const [carpetasNuevas, setCarpetasNuevas] = useState<Carpeta[]>([]);
    const [tocado, setTocado] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<{ campo: Campo; texto: string } | null>(null);

    const [preguntandoAlcance, setPreguntandoAlcance] = useState(false);
    /** Si la persona eligió el "Hasta" a mano: entonces ya no se le propone otro. */
    const [hastaTocado, setHastaTocado] = useState(false);

    const [dosColumnas, setDosColumnas] = useState(
        () => typeof window !== 'undefined' && window.matchMedia(MEDIDA_DOS_COLUMNAS).matches,
    );
    const [cuandoFija, setCuandoFija] = useState(false);
    const [seccionVisible, setSeccionVisible] = useState<1 | 2 | 3>(1);
    const sinMovimiento = useReducedMotion();
    const raiz = useRef<HTMLDivElement>(null);
    const columnaCuando = useRef<HTMLDivElement>(null);
    const seccion1 = useRef<HTMLElement>(null);
    const seccion2 = useRef<HTMLElement>(null);
    const seccion3 = useRef<HTMLElement>(null);

    const enviando = useRef(false);
    /** El id de cada copia: el mismo en un reintento, para que la base no la duplique. */
    const idsPorEquipo = useRef(new Map<string | null, string>());
    /** Las copias que ya se crearon, por si una de las siguientes falla. */
    const creadas = useRef<Array<{ sub: string | null; tarea: Tarea | null; veces: number }>>([]);
    const campoNombre = useRef<HTMLInputElement>(null);
    const campoSub = useRef<HTMLInputElement>(null);
    const campoCompartida = useRef<HTMLButtonElement>(null);
    const campoFecha = useRef<HTMLInputElement>(null);
    const campoHasta = useRef<HTMLInputElement>(null);
    const campoHoraDesde = useRef<HTMLInputElement>(null);
    const campoHoraHasta = useRef<HTMLInputElement>(null);
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

    /**
     * Quién la va a ver: quien dirige cada equipo elegido y sus integrantes. Una
     * persona de dos equipos aparece una vez, y como "dirige" si dirige alguno.
     */
    const laVanAVer = useMemo(() => {
        const personas = new Map<string, Persona & { dirige: boolean; color: string }>();
        datos.subdepartamentos.filter(s => subs.includes(s.id)).forEach(s => {
            [
                ...(s.lider ? [{ ...s.lider, dirige: true }] : []),
                ...s.miembros.map(m => ({ ...m, dirige: false })),
            ].forEach(p => {
                const ya = personas.get(p.id);
                personas.set(p.id, ya ? { ...ya, dirige: ya.dirige || p.dirige } : { ...p, color: s.color });
            });
        });
        return [...personas.values()];
    }, [datos.subdepartamentos, subs]);

    /** Sin repetición, una tarea con plazo es siempre todo el día (lo fuerza la base). */
    const hayHorario = !conPlazo || !!frecuencia;
    /**
     * Hay un "Hasta" cuando es con plazo, o cuando es de un día y se repite:
     * las dos formas terminan en la MISMA serie (primer día, frecuencia y
     * último día), que es lo único que la base conoce.
     */
    const usaHasta = conPlazo || !!frecuencia;
    const esSerie = !!frecuencia;
    const laTarea = tarea ?? null;
    const eraSerie = !!laTarea?.serie;

    const sinNombre = nombre.trim() === '';
    const horarioIncompleto = hayHorario && !todoElDia && (!horaDesde || !horaHasta);
    const horarioAlReves = hayHorario && !todoElDia && !!horaDesde && !!horaHasta && horaHasta <= horaDesde;
    const horarioMal = horarioIncompleto || horarioAlReves;

    const plazoVacio = usaHasta && !fechaHasta;
    const plazoAlReves = usaHasta && !!fechaHasta && fechaHasta <= fecha;
    const plazoLargo = usaHasta && !!fechaHasta && largoDelPlazo(fecha, fechaHasta) > 367;
    const plazoMal = plazoVacio || plazoAlReves || plazoLargo;

    /**
     * En "Un día" la frecuencia se elige ANTES que el "Hasta": si no entra,
     * lo que hay que cambiar es el "Hasta", así que no se la saca (como en
     * "Con plazo") sino que se dice qué pasa. Lo de si entra es de la base.
     */
    const opcionElegida = opciones.find(o => o.frecuencia === frecuencia) ?? null;
    const repeticionNoEntra = !conPlazo && !!frecuencia && !plazoMal && !buscandoOpciones
        && !!opcionElegida && !opcionElegida.disponible;

    const sinEquipo = !subDecidido;
    const invalido = sinNombre || sinEquipo || faltaCompartida || !fecha || horarioMal || plazoMal || repeticionNoEntra;

    const errorDe = (c: Campo) => (error?.campo === c ? error.texto : null);
    const errNombre = errorDe('nombre') ?? (tocado && sinNombre ? 'Escribí un nombre para la tarea.' : null);
    const errSub = errorDe('sub') ?? (tocado && sinEquipo
        ? (eraCompartida ? 'Elegí al menos un sub-departamento.' : 'Elegí al menos un sub-departamento, o “Sin asignar todavía”.')
        : null);
    const errCompartida = tocado && faltaCompartida ? 'Elegí si la tarea es compartida.' : null;
    const errFecha = errorDe('fecha') ?? (tocado && !fecha ? 'Elegí el día.' : null);
    const errHorario = errorDe('horario') ?? (
        horarioAlReves ? 'La hora de “Hasta” tiene que ser después de “Desde”.'
            : tocado && horarioIncompleto ? 'Completá desde y hasta qué hora.' : null);
    const errPlazo = errorDe('plazo') ?? (
        plazoAlReves ? 'El último día tiene que ser posterior al primero.'
            : plazoLargo ? 'El plazo no puede pasar de un año.'
                : tocado && plazoVacio ? 'Elegí hasta qué día.' : null);
    const errRepeticion = errorDe('repeticion') ?? (repeticionNoEntra
        ? (opcionElegida?.superaTope
            ? 'Pasa de 200 repeticiones: elegí un “Hasta” más cercano.'
            : 'Hasta ese día no entra dos veces: elegí un “Hasta” más lejano.')
        : null);

    /**
     * TODO lo que no deja guardar, en el orden en que se ve en la hoja: el aviso
     * del pie lo dice y tocarlo lleva al primero. Son las mismas condiciones de
     * `invalido`: si no está acá, no frena el botón.
     */
    const queFrena = useMemo(() => {
        const delPlazo = plazoVacio ? { falta: 'hasta qué día', campo: campoHasta }
            : plazoAlReves || plazoLargo ? { revisar: 'el plazo', campo: campoHasta }
                : repeticionNoEntra ? { revisar: 'hasta cuándo se repite', campo: campoHasta }
                    : null;
        const delHorario = horarioIncompleto ? { falta: 'horario', campo: horaDesde ? campoHoraHasta : campoHoraDesde }
            : horarioAlReves ? { revisar: 'el horario', campo: campoHoraHasta }
                : null;
        // En "Con plazo" el "Hasta" está arriba del horario; en "Un día", abajo.
        return [
            sinNombre ? { falta: 'nombre', campo: campoNombre } : null,
            sinEquipo ? { falta: 'sub-departamento', campo: campoSub } : null,
            faltaCompartida ? { falta: 'si es compartida', campo: campoCompartida } : null,
            !fecha ? { falta: 'día', campo: campoFecha } : null,
            ...(conPlazo ? [delPlazo, delHorario] : [delHorario, delPlazo]),
        ].filter(x => x !== null);
    }, [sinNombre, sinEquipo, faltaCompartida, fecha, plazoVacio, plazoAlReves, plazoLargo, repeticionNoEntra,
        horarioIncompleto, horarioAlReves, horaDesde, conPlazo]);

    const queFalta = useMemo(() => {
        const faltan = queFrena.flatMap(x => ('falta' in x && x.falta ? [x.falta] : []));
        const revisar = queFrena.flatMap(x => ('revisar' in x && x.revisar ? [x.revisar] : []));
        return [
            faltan.length ? `Falta: ${enLista(faltan)}.` : '',
            revisar.length ? `Revisá ${enLista(revisar)}.` : '',
        ].filter(Boolean).join(' ') || null;
    }, [queFrena]);

    /** Marca los errores y lleva al primer campo que frena. */
    const irAlQueFalta = () => {
        setTocado(true);
        const campo = queFrena[0]?.campo.current;
        if (!campo) return;
        campo.focus({ preventScroll: true });
        const cuerpo = raiz.current?.closest('[data-cuerpo]');
        if (!cuerpo) return;
        // Después de pintar: los errores que aparecen ahora cambian el alto, y en
        // WebKit eso frena en seco un desplazamiento suave que ya arrancó. Y a
        // mano, no con scrollIntoView: sólo se mueve la hoja, nunca lo de atrás.
        window.requestAnimationFrame(() => {
            const caja = cuerpo.getBoundingClientRect();
            const lugar = campo.getBoundingClientRect();
            cuerpo.scrollTo({
                top: cuerpo.scrollTop + lugar.top - caja.top - (caja.height - lugar.height) / 2,
                behavior: sinMovimiento ? 'auto' : 'smooth',
            });
        });
    };

    /** Lo obligatorio de cada sección, para el tilde de las pastillas. */
    const completas: [boolean, boolean, boolean] = [
        !sinNombre,
        subDecidido && !faltaCompartida,
        !!fecha && !horarioMal && !plazoMal && !repeticionNoEntra,
    ];

    useEffect(() => {
        const medida = window.matchMedia(MEDIDA_DOS_COLUMNAS);
        const alCambiar = () => setDosColumnas(medida.matches);
        medida.addEventListener('change', alCambiar);
        return () => medida.removeEventListener('change', alCambiar);
    }, []);

    /** "Cuándo" queda fija sólo si entra entera: si no, su final sería inalcanzable. */
    useEffect(() => {
        const cuerpo = raiz.current?.closest('[data-cuerpo]');
        const columna = columnaCuando.current;
        if (!dosColumnas || !cuerpo || !columna) { setCuandoFija(false); return; }
        const medir = () => setCuandoFija(columna.offsetHeight + 26 <= cuerpo.clientHeight);
        const observador = new ResizeObserver(medir);
        observador.observe(columna);
        observador.observe(cuerpo);
        return () => observador.disconnect();
    }, [dosColumnas]);

    /** Qué sección se está viendo: la última cuyo borde de arriba ya llegó al tope. */
    useEffect(() => {
        const cuerpo = raiz.current?.closest('[data-cuerpo]');
        if (dosColumnas || !cuerpo) return;
        let cuadro = 0;
        const mirar = () => {
            cuadro = 0;
            const tope = cuerpo.getBoundingClientRect().top + 48;
            let vista: 1 | 2 | 3 = 1;
            if ((seccion2.current?.getBoundingClientRect().top ?? Infinity) <= tope) vista = 2;
            if ((seccion3.current?.getBoundingClientRect().top ?? Infinity) <= tope) vista = 3;
            const alFinal = cuerpo.scrollHeight > cuerpo.clientHeight
                && cuerpo.scrollTop + cuerpo.clientHeight >= cuerpo.scrollHeight - 2;
            setSeccionVisible(alFinal ? 3 : vista);
        };
        const alMover = () => { if (!cuadro) cuadro = window.requestAnimationFrame(mirar); };
        cuerpo.addEventListener('scroll', alMover, { passive: true });
        return () => {
            cuerpo.removeEventListener('scroll', alMover);
            if (cuadro) window.cancelAnimationFrame(cuadro);
        };
    }, [dosColumnas]);

    const irASeccion = (n: 1 | 2 | 3) => {
        const seccion = [seccion1, seccion2, seccion3][n - 1].current;
        const cuerpo = raiz.current?.closest('[data-cuerpo]');
        if (!seccion || !cuerpo) return;
        setSeccionVisible(n);
        cuerpo.scrollTo({
            top: cuerpo.scrollTop + seccion.getBoundingClientRect().top - cuerpo.getBoundingClientRect().top - 8,
            behavior: sinMovimiento ? 'auto' : 'smooth',
        });
    };

    const cambiaronLosEquipos = [...subs].sort().join() !== [...subsIniciales].sort().join();
    const hayCambios = nombre !== inicial.nombre
        || cambiaronLosEquipos
        || carpetaId !== inicial.carpetaId
        || prioridadId !== inicial.prioridadId
        || (detalles || '') !== (inicial.detalles || '')
        || fecha !== inicial.fecha
        || todoElDia !== inicial.todoElDia
        || (horaDesde || '') !== (inicial.horaDesde || '')
        || (horaHasta || '') !== (inicial.horaHasta || '')
        || (usaHasta ? fechaHasta : '') !== (laTarea?.fechaHasta || laTarea?.serie?.hasta || '')
        || frecuencia !== (laTarea?.serie?.frecuencia ?? null);

    /** Avisa a la pantalla lo que se creó; con varios equipos, cuántos fueron. */
    const terminarDeCrear = () => {
        const primera = creadas.current.find(c => c.tarea)?.tarea;
        if (primera) onGuardada(primera, true, creadas.current[0].veces, creadas.current.length);
        else onCerrar();
    };

    const intentarCerrar = () => {
        if (guardando) return;
        // Ya hay copias creadas: lo de atrás tiene que enterarse aunque falte alguna.
        if (creadas.current.length > 0) { terminarDeCrear(); return; }
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

    /**
     * Qué repeticiones entran en este plazo. La cuenta es de la BASE: acá no
     * se decide nada, sólo se pregunta y se espera un momento entre teclas
     * para no pedirlo con cada dígito de la fecha.
     */
    useEffect(() => {
        if (!usaHasta || !fechaHasta || plazoMal) { setOpciones([]); return; }
        let vivo = true;
        setBuscandoOpciones(true);
        const t = window.setTimeout(async () => {
            const r = await getRepeticionesPosibles(fecha, fechaHasta);
            if (!vivo) return;
            setBuscandoOpciones(false);
            setOpciones(r.ok ? r.opciones : []);
        }, ESPERA_OPCIONES);
        return () => { vivo = false; window.clearTimeout(t); };
    }, [usaHasta, fecha, fechaHasta, plazoMal]);

    /**
     * Si cambiaron las fechas y lo que estaba elegido ya no entra, se vuelve
     * a "No se repite" y se dice por qué: dejarlo elegido haría que la base
     * lo rechace recién al guardar.
     */
    useEffect(() => {
        // Sólo en "Con plazo", donde el plazo va primero. En "Un día" se
        // avisa en el campo (repeticionNoEntra) y se cambia el "Hasta".
        if (!conPlazo) return;
        if (!frecuencia || buscandoOpciones || opciones.length === 0) return;
        const o = opciones.find(x => x.frecuencia === frecuencia);
        if (o && o.disponible) return;
        setFrecuencia(null);
        setAvisoRepeticion(o && o.superaTope
            ? `“${o.nombre}” pasa de 200 repeticiones en este plazo. Volvió a “No se repite”.`
            : 'La repetición que habías elegido ya no entra en este plazo. Volvió a “No se repite”.');
    }, [opciones, buscandoOpciones, frecuencia, conPlazo]);

    const resumen = useMemo(() => resumenDeCuando({
        desde: fecha,
        hasta: usaHasta ? fechaHasta : null,
        frecuencia,
        frecuenciaTexto: opciones.find(o => o.frecuencia === frecuencia)?.nombre ?? null,
        veces: opciones.find(o => o.frecuencia === frecuencia)?.veces ?? null,
        todoElDia: !hayHorario || todoElDia,
        horaDesde,
        horaHasta,
    }), [fecha, fechaHasta, usaHasta, frecuencia, opciones, hayHorario, todoElDia, horaDesde, horaHasta]);

    /** Lo elegido en pocas palabras, para el encabezado de "Cuándo". */
    const resumenCorto = !fecha || plazoMal ? '' : resumenCortoDeCuando({
        desde: fecha,
        hasta: usaHasta ? fechaHasta : null,
        frecuencia,
        frecuenciaTexto: opcionElegida?.nombre ?? FRECUENCIAS.find(f => f.id === frecuencia)?.nombre ?? null,
        veces: !buscandoOpciones && opcionElegida?.disponible ? opcionElegida.veces : null,
        todoElDia: !hayHorario || todoElDia,
        horaDesde,
        horaHasta,
    });

    /** Cuántas repeticiones quedan por hacer, para el texto del alcance. */
    const pendientes = useMemo(() => (laTarea ? pendientesDeLaSerie(laTarea) : 0), [laTarea]);

    /**
     * En una repetición, si cambió la REGLA de la serie: el último día o cada
     * cuánto se repite. Eso sólo se puede con "Todas las que faltan" (la base
     * contesta alcance_invalido con "Solo esta").
     */
    const cambiaLaRegla = eraSerie && (
        fechaHasta !== (laTarea?.serie?.hasta || '') || frecuencia !== (laTarea?.serie?.frecuencia ?? null));

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

    /**
     * El plazo y la frecuencia que se mandan. En una repetición:
     *   · "Solo esta": ninguno de los dos. Una repetición no tiene plazo
     *     propio, y si viajaran la base contestaría alcance_invalido.
     *   · "Todas las que faltan": sólo si cambió la regla o el día. Mandarlos
     *     hace que la base borre las que faltan y las cree de nuevo, así que
     *     para un cambio de nombre o de horario no viajan.
     */
    const plazoQueViaja = (alcance: AlcanceSerie): Pick<DatosDeTarea, 'fechaHasta' | 'frecuencia'> => {
        if (modo === 'crear' || !eraSerie) {
            return { fechaHasta: usaHasta ? fechaHasta : null, frecuencia: modo === 'crear' ? frecuencia : null };
        }
        if (alcance === 'solo_esta') return { fechaHasta: null, frecuencia: null };
        return cambiaLaRegla || fecha !== inicial.fecha
            ? { fechaHasta, frecuencia }
            : { fechaHasta: null, frecuencia: null };
    };

    const nombreDeEquipo = (equipo: string | null) =>
        datos.subdepartamentos.find(s => s.id === equipo)?.nombre ?? 'ese equipo';

    /**
     * Una copia por equipo, de a una. Si una falla, las anteriores ya existen:
     * salen de lo elegido, y reintentar crea sólo las que faltan.
     */
    const crearParaCadaEquipo = async (carga: DatosDeTarea) => {
        const destinos: Array<string | null> = sinAsignar || esCompartida ? [null] : subs;
        for (const destino of destinos) {
            if (!idsPorEquipo.current.has(destino)) {
                idsPorEquipo.current.set(destino, idsPorEquipo.current.size === 0 ? id : nuevoId());
            }
            const r = await crearTarea({
                ...carga,
                subdepartamentoId: destino,
                subdepartamentoIds: esCompartida ? subs : null,
                id: idsPorEquipo.current.get(destino),
                departamentoId: datos.departamentoId,
                // La solicitud se asigna una vez: con la primera copia.
                solicitudId: creadas.current.length === 0 ? (solicitudId ?? null) : null,
            });
            if (!r.ok) {
                enviando.current = false;
                setGuardando(false);
                if (creadas.current.length === 0) {
                    setError({ campo: CAMPO[r.motivo] ?? 'general', texto: mensajeDeMotivo(r.motivo) });
                    return;
                }
                const hechas = creadas.current.map(c => c.sub);
                setSubs(l => l.filter(s => !hechas.includes(s)));
                setError({
                    campo: 'general',
                    texto: `Ya se crearon las de ${enLista(hechas.map(nombreDeEquipo))}. La de ${nombreDeEquipo(destino)} no: ${mensajeDeMotivo(r.motivo)}`,
                });
                const cuerpo = raiz.current?.closest('[data-cuerpo]');
                if (cuerpo) window.requestAnimationFrame(() => cuerpo.scrollTo({ top: cuerpo.scrollHeight }));
                return;
            }
            creadas.current.push({
                sub: destino,
                tarea: r.tarea ?? r.tareas[0] ?? null,
                veces: (r as { veces?: number }).veces ?? 1,
            });
        }
        enviando.current = false;
        setGuardando(false);
        terminarDeCrear();
    };

    const guardarDeVerdad = async (alcance: AlcanceSerie) => {
        enviando.current = true;
        setGuardando(true);
        setError(null);
        const sinHora = !hayHorario || todoElDia;
        const carga: DatosDeTarea = {
            subdepartamentoId: eraCompartida ? null : sub,
            // Si no cambiaron no viajan: la base dejaría igual lo que ya terminó cada uno.
            // Los archivados no están en la lista, pero siguen: se pierde lo que terminaron si no viajan.
            subdepartamentoIds: eraCompartida && cambiaronLosEquipos
                ? [...subs, ...(tarea?.equipos ?? []).filter(e => e.archivado).map(e => e.id)]
                : null,
            carpetaId,
            prioridadId,
            nombre,
            detalles: detalles.trim() || null,
            fecha,
            todoElDia: sinHora,
            horaDesde: sinHora ? null : horaDesde,
            horaHasta: sinHora ? null : horaHasta,
            ...plazoQueViaja(alcance),
        };
        if (modo === 'crear') { await crearParaCadaEquipo(carga); return; }
        const r = await editarTarea(tarea?.id ?? '', carga, alcance);
        enviando.current = false;
        setGuardando(false);
        if (!r.ok) { setError({ campo: CAMPO[r.motivo] ?? 'general', texto: mensajeDeMotivo(r.motivo) }); return; }
        const guardada = r.tarea ?? r.tareas[0] ?? null;
        if (guardada) onGuardada(guardada, false, Math.max(1, r.tareas.length || 1));
        else onCerrar();
    };

    const guardar = async () => {
        if (enviando.current) return;
        if (invalido) { irAlQueFalta(); return; }
        // Editar una repetición: primero hay que saber a cuáles alcanza.
        if (modo === 'editar' && eraSerie) { setPreguntandoAlcance(true); return; }
        await guardarDeVerdad('solo_esta');
    };

    const accion = etiquetaDeAccion ?? (modo === 'crear' ? 'Crear tarea' : 'Guardar cambios');

    return (
        <Hoja
            titulo={titulo ?? (modo === 'crear' ? 'Crear tarea' : 'Editar tarea')}
            onCerrar={intentarCerrar}
            ocupada={guardando}
            ancho={dosColumnas ? 940 : 620}
            gris
            bajoElTitulo={dosColumnas ? undefined : (
                <PastillasDeSeccion visible={seccionVisible} completas={completas} onElegir={irASeccion} />
            )}
            pie={(
                <PieDeHoja
                    onCancelar={intentarCerrar}
                    onAceptar={guardar}
                    etiqueta={preguntaCompartida && compartida === false ? accion.replace('tarea', `${subs.length} tareas`) : accion}
                    guardando={guardando}
                    apagado={invalido}
                    falta={queFalta}
                    onTocarFalta={irAlQueFalta}
                />
            )}
        >
            <div ref={raiz} className="flex flex-col gap-6">
                {referencia}

                <div className={dosColumnas ? 'grid grid-cols-2 items-start gap-6' : 'flex flex-col gap-6'}>
                    <div className="flex min-w-0 flex-col gap-6">
                        <Seccion numero={1} titulo="La tarea" bajada="Qué hay que hacer" idBase={idBase} refSeccion={seccion1}>
                            {/* Nombre */}
                            <label className="flex flex-col gap-1.5">
                                <RotuloDeCampo>Nombre de la tarea</RotuloDeCampo>
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

                            {/* Detalles */}
                            <label className="flex flex-col gap-1.5">
                                <RotuloDeCampo>Detalles</RotuloDeCampo>
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

                            {/* Prioridad */}
                            <div className="flex flex-col gap-2">
                                <RotuloDeCampo id={`${idBase}-rot-prio`}>Prioridad</RotuloDeCampo>
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

                            {/* Carpeta */}
                        <label className="flex flex-col gap-1.5">
                            <span className="flex items-baseline justify-between gap-2">
                                        <RotuloDeCampo>Carpeta</RotuloDeCampo>
                                        <span className="text-[12px] font-semibold text-black/[.5]">Opcional</span>
                                    </span>
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
                        </Seccion>

                        <Seccion numero={2} titulo="Quién la hace" bajada="A qué equipo le llega" idBase={idBase} refSeccion={seccion2}>
                            <ComboboxDeSub
                                subdepartamentos={datos.subdepartamentos}
                                valores={subs}
                                sinAsignarElegido={sinAsignar}
                                varios={modo === 'crear' || eraCompartida}
                                sinOpcionSinAsignar={eraCompartida}
                                refCampo={campoSub}
                                onCambiar={(equipos, sinEquipos) => {
                                    setSubs(equipos);
                                    setSinAsignar(sinEquipos);
                                    if (equipos.length < 2) setCompartida(null);
                                    if (error?.campo === 'sub') setError(null);
                                }}
                                bloqueado={completada}
                                motivoDelBloqueo={eraCompartida
                                    ? 'Está completada: para cambiarle los equipos, primero deshacé el finalizado de un equipo desde el detalle.'
                                    : 'Está completada: para cambiarle el equipo, primero volvela a En proceso.'}
                                error={errSub}
                            />

                            {preguntaCompartida && (
                                <div className="flex flex-col gap-1.5">
                                    <RotuloDeCampo id={`${idBase}-rot-compartida`}>¿La tarea es compartida?</RotuloDeCampo>
                                    <div
                                        role="radiogroup"
                                        aria-labelledby={`${idBase}-rot-compartida`}
                                        aria-describedby={errCompartida ? `${idBase}-err-compartida` : undefined}
                                        className="flex gap-1.5 rounded-2xl bg-[#f6f6f4] p-1 shadow-[inset_0_0_0_1px_rgba(0,0,0,.06)]"
                                        style={errCompartida ? { boxShadow: 'inset 0 0 0 1.5px #b42318' } : undefined}
                                    >
                                        {[
                                            { id: true, etiqueta: 'Sí, una sola tarea' },
                                            { id: false, etiqueta: 'No, una por equipo' },
                                        ].map(o => {
                                            const on = compartida === o.id;
                                            return (
                                                <button
                                                    key={String(o.id)}
                                                    ref={o.id ? campoCompartida : undefined}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={on}
                                                    onClick={() => setCompartida(o.id)}
                                                    className={`flex min-h-10 min-w-0 flex-1 items-center justify-center rounded-xl px-2 text-center text-[13px] font-bold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-1 ${on ? 'bg-white text-[#0a0a0a] shadow-[0_1px_3px_rgba(0,0,0,.1)]' : 'text-black/[.55] hover:text-[#0a0a0a]'}`}
                                                >
                                                    {o.etiqueta}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {errCompartida && <ErrorDeCampo id={`${idBase}-err-compartida`}>{errCompartida}</ErrorDeCampo>}
                                </div>
                            )}

                            {/* La van a ver: aparece recién cuando se decidió a quién le llega. */}
                            {subDecidido && (
                                <div className="rounded-[18px] bg-[#f6f6f4] px-4 py-3.5">
                                    <RotuloDeCampo>La van a ver</RotuloDeCampo>
                                    {laVanAVer.length > 0 ? (
                                        <>
                                            <div className="mt-3 flex flex-wrap gap-x-3.5 gap-y-2.5">
                                                {laVanAVer.map(p => (
                                                    <span key={p.id} className="flex items-center gap-2 text-[13px] font-bold">
                                                        <Avatar persona={p} color={p.color} tam={28} />
                                                        {p.nombre || 'Sin nombre'}
                                                        {p.dirige && <span className="font-semibold text-black/[.5]">· dirige</span>}
                                                    </span>
                                                ))}
                                            </div>
                                            <p className="m-0 mt-3 text-[12.5px] font-semibold text-black/[.55]">
                                                Les aparece en su Agenda y les llega una notificación.
                                        {esCompartida && ' Se completa cuando todos los equipos dan el finalizado.'}
                                        {preguntaCompartida && compartida === false && ' Cada equipo tiene su propia tarea.'}
                                                {esSerie && ' Les llega un solo aviso, no uno por cada repetición.'}
                                            </p>
                                        </>
                                    ) : (
                                        <p className="m-0 mt-2 text-[13.5px] font-semibold leading-[1.5] text-black/[.62]">
                                            Nadie todavía: queda esperando asignación.
                                        </p>
                                    )}
                                </div>
                            )}
                        </Seccion>
                    </div>

                    {/* Se queda quieta mientras se baja por la izquierda, si entra entera. */}
                    <div ref={columnaCuando} className={`min-w-0 ${cuandoFija ? 'sticky top-0' : ''}`}>
                        <Seccion numero={3} titulo="Cuándo" derecha={resumenCorto} idBase={idBase} refSeccion={seccion3}>
                            {/* Un día · Con plazo. En edición, una repetición no cambia
                                de forma: siempre es un día de su serie. */}
                            {!eraSerie && (
                                <div role="radiogroup" aria-labelledby={`${idBase}-seccion-3`} className="flex gap-1.5 rounded-2xl bg-[#f6f6f4] p-1 shadow-[inset_0_0_0_1px_rgba(0,0,0,.06)]">
                                    {[
                                        { id: false, etiqueta: 'Un día', icono: Clock },
                                        { id: true, etiqueta: 'Con plazo', icono: CalendarRange },
                                    ].map(o => {
                                        const on = conPlazo === o.id;
                                        const Icono = o.icono;
                                        return (
                                            <button
                                                key={String(o.id)}
                                                type="button"
                                                role="radio"
                                                aria-checked={on}
                                                onClick={() => {
                                                    setConPlazo(o.id);
                                                    setAvisoRepeticion(null);
                                                    if (error?.campo === 'plazo' || error?.campo === 'repeticion') setError(null);
                                                    if (o.id && !fechaHasta) setFechaHasta(sumarDias(fecha, PLAZO_SUGERIDO));
                                                }}
                                                className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13.5px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-1 ${on ? 'bg-white text-[#0a0a0a] shadow-[0_1px_3px_rgba(0,0,0,.1)]' : 'text-black/[.55] hover:text-[#0a0a0a]'}`}
                                            >
                                                <Icono size={15} strokeWidth={2.1} aria-hidden="true" />
                                                {o.etiqueta}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            <div className={conPlazo ? 'grid gap-2.5 sm:grid-cols-2' : ''}>
                                <label className="flex flex-col gap-1.5">
                                    <RotuloDeCampo>{conPlazo ? 'Desde' : frecuencia ? 'Primer día' : 'Día'}</RotuloDeCampo>
                                    <input
                                        ref={campoFecha}
                                        type="date"
                                        value={fecha}
                                        onChange={e => {
                                            setFecha(e.target.value);
                                            if (error?.campo === 'fecha') setError(null);
                                            // Un día que se repite: si el "Hasta" era el propuesto, se corre con el día.
                                            if (!conPlazo && frecuencia && !hastaTocado && e.target.value) {
                                                setFechaHasta(sumarDias(e.target.value, HASTA_SUGERIDO[frecuencia]));
                                            }
                                        }}
                                        aria-invalid={!!errFecha}
                                        aria-describedby={errFecha ? `${idBase}-err-fecha` : undefined}
                                        className={CAMPO_CLASE}
                                        style={conBorde(!!errFecha)}
                                    />
                                </label>
                                {conPlazo && (
                                    <label className="flex flex-col gap-1.5">
                                        <RotuloDeCampo>Hasta</RotuloDeCampo>
                                        <input
                                            ref={campoHasta}
                                            type="date"
                                            value={fechaHasta}
                                            min={sumarDias(fecha, 1)}
                                            onChange={e => {
                                                setFechaHasta(e.target.value);
                                                setAvisoRepeticion(null);
                                                if (error?.campo === 'plazo') setError(null);
                                            }}
                                            aria-invalid={!!errPlazo}
                                            aria-describedby={errPlazo ? `${idBase}-err-plazo` : undefined}
                                            className={CAMPO_CLASE}
                                            style={conBorde(!!errPlazo)}
                                        />
                                    </label>
                                )}
                            </div>
                            {errFecha && <ErrorDeCampo id={`${idBase}-err-fecha`}>{errFecha}</ErrorDeCampo>}
                            {conPlazo && errPlazo && <ErrorDeCampo id={`${idBase}-err-plazo`}>{errPlazo}</ErrorDeCampo>}
                            {conPlazo && !!fechaHasta && !plazoMal && (
                                <p className="m-0 text-[12.5px] font-semibold text-black/[.55]">
                                    {largoDelPlazo(fecha, fechaHasta)} días
                                </p>
                            )}

                            <div className="flex flex-col gap-1.5">
                                <RotuloDeCampo>Horario</RotuloDeCampo>
                                {/* Horario. Una tarea con plazo sin repetir es siempre de todo
                                    el día: un horario no significa nada repartido en seis semanas. */}
                                {!hayHorario ? (
                                    <p className="m-0 flex items-center gap-2.5 rounded-2xl bg-[#f6f6f4] px-3.5 py-3 text-[13.5px] font-semibold text-black/[.62]">
                                        <Clock size={17} strokeWidth={1.9} aria-hidden="true" className="flex-none text-black/[.45]" />
                                        Las tareas con plazo son de todo el día.
                                    </p>
                                ) : (
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
                                                    <RotuloDeCampo>Desde</RotuloDeCampo>
                                                    <input
                                                        ref={campoHoraDesde}
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
                                                    <RotuloDeCampo>Hasta</RotuloDeCampo>
                                                    <input
                                                        ref={campoHoraHasta}
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
                                    {esSerie && (
                                        <p className="m-0 text-[12.5px] font-semibold text-black/[.55]">
                                            El mismo horario para todas las repeticiones.
                                        </p>
                                    )}
                                </div>
                                )}
                            </div>

                            {/* Un día · ¿Se repite? Primero cada cuánto, después hasta cuándo.
                                Sólo al crear: una tarea que ya existe no se vuelve serie. */}
                            {!conPlazo && !eraSerie && modo === 'crear' && (
                                <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
                                    <legend className="mb-1.5 p-0"><RotuloDeCampo>¿Se repite?</RotuloDeCampo></legend>
                                    <BarraDeRepeticion
                                        valor={frecuencia}
                                        sinRepetir="No se repite"
                                        opciones={FRECUENCIAS.map(f => {
                                            // Cuántas veces (o por qué no) sólo en la elegida, y sólo
                                            // cuando ya contestó la base.
                                            const lista = frecuencia === f.id && !plazoMal && !buscandoOpciones && opcionElegida;
                                            const nota = !lista ? ''
                                                : opcionElegida.disponible ? `${opcionElegida.veces} veces`
                                                    : opcionElegida.superaTope ? 'pasa de 200 repeticiones' : 'no entra dos veces';
                                            return { id: f.id, texto: nota ? `${f.nombre} · ${nota}` : f.nombre };
                                        })}
                                        mal={repeticionNoEntra}
                                        describe={errRepeticion ? `${idBase}-err-rep` : undefined}
                                        onCambiar={f => {
                                            setFrecuencia(f);
                                            if (f && (!hastaTocado || !fechaHasta || fechaHasta <= fecha)) {
                                                setFechaHasta(sumarDias(fecha, HASTA_SUGERIDO[f]));
                                            }
                                            if (error?.campo === 'repeticion' || error?.campo === 'plazo') setError(null);
                                        }}
                                    />
                                    {frecuencia && (
                                        <label className="mt-2.5 flex flex-col gap-1.5">
                                            <RotuloDeCampo>Se repite hasta</RotuloDeCampo>
                                            <input
                                                ref={campoHasta}
                                                type="date"
                                                value={fechaHasta}
                                                min={sumarDias(fecha, 1)}
                                                onChange={e => {
                                                    setFechaHasta(e.target.value);
                                                    setHastaTocado(true);
                                                    if (error?.campo === 'plazo' || error?.campo === 'repeticion') setError(null);
                                                }}
                                                aria-invalid={!!errPlazo || repeticionNoEntra}
                                                aria-describedby={errPlazo ? `${idBase}-err-plazo` : errRepeticion ? `${idBase}-err-rep` : undefined}
                                                className={CAMPO_CLASE}
                                                style={conBorde(!!errPlazo || repeticionNoEntra)}
                                            />
                                        </label>
                                    )}
                                    {errPlazo && <ErrorDeCampo id={`${idBase}-err-plazo`}>{errPlazo}</ErrorDeCampo>}
                                    {errRepeticion && <ErrorDeCampo id={`${idBase}-err-rep`}>{errRepeticion}</ErrorDeCampo>}
                                </fieldset>
                            )}

                            {/* ¿Se repite? Las opciones y los "no" los decide la base. */}
                            {conPlazo && !plazoMal && (!eraSerie ? modo === 'crear' : true) && (
                                <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
                                    <legend className="mb-1.5 p-0"><RotuloDeCampo>¿Se repite?</RotuloDeCampo></legend>
                                    {buscandoOpciones && opciones.length === 0 ? (
                                        <p className="m-0 text-[13px] font-semibold text-black/[.55]">Buscando qué repeticiones entran…</p>
                                    ) : (
                                        <BarraDeRepeticion
                                            valor={frecuencia}
                                            // Una serie no se vuelve una tarea con plazo: al editar una
                                            // repetición, "No se repite" no está.
                                            sinRepetir={eraSerie ? null : 'No se repite'}
                                            opciones={opciones.map(o => ({
                                                id: o.frecuencia,
                                                texto: o.disponible
                                                    ? `${o.nombre} · ${o.veces} veces`
                                                    : `${o.nombre} · ${o.superaTope ? 'pasa de 200 repeticiones' : 'no entra dos veces'}`,
                                                apagada: !o.disponible,
                                            }))}
                                            mal={!!errRepeticion}
                                            describe={errRepeticion ? `${idBase}-err-rep` : undefined}
                                            onCambiar={f => {
                                                setFrecuencia(f);
                                                setAvisoRepeticion(null);
                                                if (error?.campo === 'repeticion') setError(null);
                                            }}
                                        />
                                    )}
                                    {avisoRepeticion && (
                                        <p role="status" className="m-0 text-[12.5px] font-semibold text-[#8a4b06]">{avisoRepeticion}</p>
                                    )}
                                    {errRepeticion && <ErrorDeCampo id={`${idBase}-err-rep`}>{errRepeticion}</ErrorDeCampo>}
                                </fieldset>
                            )}

                            {resumen && (
                                <p className="m-0 rounded-2xl bg-[#f6f6f4] px-3.5 py-2.5 text-[13px] font-semibold leading-[1.5] text-black/[.72]">
                                    {resumen}
                                </p>
                            )}
                        </Seccion>
                    </div>
                </div>

                    <p className="m-0 text-[12.5px] font-semibold text-black/[.5]">
                    {modo === 'crear'
                        ? `Se va a registrar: ${sello(ahora)}${datos.miNombre ? ` · por ${datos.miNombre}` : ''}`
                        : `Creada el ${fechaYHora(tarea?.createdAt ?? null)}${tarea?.creador?.nombre ? ` por ${tarea.creador.nombre}` : ''}`}
                </p>

                    {errorDe('general') && <p role="alert" className="m-0 text-[13px] font-bold text-[#b42318]">{errorDe('general')}</p>}
            </div>

            {preguntandoAlcance && (
                <Hoja
                    titulo="¿Qué querés cambiar?"
                    onCerrar={() => setPreguntandoAlcance(false)}
                    ocupada={guardando}
                    ancho={460}
                >
                    <p className="m-0 text-[14px] font-semibold leading-[1.55] text-black/[.72]">
                        Esta tarea se repite. Elegí a cuáles alcanza el cambio.
                    </p>
                    <div className="flex flex-col gap-2">
                        <BotonDeAlcance
                            titulo="Solo esta"
                            texto={cambiaLaRegla
                                ? 'No se puede: cambiaste el plazo o cada cuánto se repite, y eso vale para toda la serie.'
                                : `Cambia la repetición del ${diaYMes(inicial.fecha)} y nada más.`}
                            apagado={cambiaLaRegla}
                            onElegir={() => { setPreguntandoAlcance(false); void guardarDeVerdad('solo_esta'); }}
                        />
                        <BotonDeAlcance
                            titulo={`Todas las que faltan (${pendientes})`}
                            texto="Cambia las repeticiones de hoy en adelante que todavía no se completaron."
                            onElegir={() => { setPreguntandoAlcance(false); void guardarDeVerdad('las_que_faltan'); }}
                        />
                    </div>
                    <p className="m-0 text-[12.5px] font-semibold leading-[1.5] text-black/[.55]">
                        Las repeticiones que ya se completaron no cambian nunca.
                        {cambiaLaRegla
                            ? ' Con un plazo o una repetición nueva, las que faltan se arman de nuevo con los días nuevos.'
                            : ''}
                    </p>
                </Hoja>
            )}
        </Hoja>
    );
};

/** Una de las dos salidas de "¿Qué querés cambiar?". */
const BotonDeAlcance: React.FC<{ titulo: string; texto: string; onElegir: () => void; apagado?: boolean }> = ({
    titulo, texto, onElegir, apagado = false,
}) => (
    <button
        type="button"
        onClick={apagado ? undefined : onElegir}
        aria-disabled={apagado || undefined}
        className={`flex flex-col gap-1 rounded-2xl bg-[#f6f6f4] px-4 py-3.5 text-left shadow-[inset_0_0_0_1px_rgba(0,0,0,.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${apagado ? 'cursor-not-allowed opacity-60' : 'hover:bg-[#f0f0ed]'}`}
    >
        <span className="text-[14.5px] font-bold text-[#0a0a0a]">{titulo}</span>
        <span className="text-[12.5px] font-semibold leading-[1.45] text-black/[.62]">{texto}</span>
    </button>
);

export default FormularioTarea;
