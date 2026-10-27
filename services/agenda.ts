import { supabase } from './supabaseClient';
import { safeUUID } from './uuidUtils';

/**
 * Agenda Origen: departamentos, sub-departamentos, tareas y solicitudes.
 *
 * El acceso NO va por rol: va por pertenencia. Quien es encargado de un
 * departamento, dirige un sub-departamento o es miembro de uno lo dice la
 * base (agenda_mi_acceso), no un UserRole. SUPER_ADMIN se comporta como
 * encargado de todos.
 *
 * Toda escritura va por RPC SECURITY DEFINER (sql/agenda_origen.sql). Acá no
 * se decide nada: ni el estado de una tarea —lo pone la base según tenga o
 * no sub-departamento—, ni quién puede qué. Desde el cliente sólo se junta
 * lo que la persona eligió y se traduce la respuesta.
 *
 * Cada función devuelve { ok: true, … } o { ok: false, motivo }. 'red' es
 * "no se pudo hablar con la base", que NO es lo mismo que "no hay nada": una
 * lista que no se pudo traer se muestra como error, nunca como vacía
 * (instrucciones, 7.9).
 *
 * Los ids de lo que se crea los genera el cliente (nuevoId): si el envío se
 * corta y se reintenta, el segundo llega con el mismo id y la base devuelve
 * lo que ya había en vez de duplicarlo. Por eso la pantalla tiene que generar
 * el id UNA vez y reusarlo en los reintentos.
 *
 * Fechas: siempre 'YYYY-MM-DD' en hora local, armadas a mano. Nunca
 * new Date('YYYY-MM-DD'), que se interpreta en UTC y en Argentina cae un día
 * antes (instrucciones, 7.10).
 */

// ── Tipos ───────────────────────────────────────────────────────────────

export type EstadoTarea = 'esperando' | 'en_proceso' | 'completada';
export type EstadoSolicitud = 'nueva' | 'aceptada' | 'rechazada' | 'asignada';

/** Lo que la base puede contestar en vez de ok, más 'red'. */
export type MotivoAgenda =
    | 'sin_sesion' | 'sin_permiso' | 'no_existe' | 'id_requerido' | 'id_en_uso'
    | 'nombre_invalido' | 'nombre_duplicado' | 'color_invalido' | 'icono_invalido'
    | 'sin_encargados' | 'usuario_inexistente' | 'lider_requerido'
    | 'detalles_largos' | 'detalles_cortos' | 'fecha_invalida' | 'horario_invalido'
    | 'sub_ajeno' | 'carpeta_ajena' | 'prioridad_ajena' | 'prioridad_requerida'
    | 'completada' | 'sin_sub' | 'estado_invalido'
    | 'rango_invalido' | 'rango_grande'
    | 'en_uso' | 'reemplazo_invalido' | 'ya_tiene' | 'lista_incompleta'
    | 'es_quien_dirige' | 'no_es_miembro' | 'mismo_sub'
    | 'solicitud_inexistente' | 'solicitud_ajena' | 'solicitud_no_aceptada' | 'ya_revisada'
    | 'accion_desconocida' | 'texto_corto' | 'limite_diario' | 'archivado'
    | 'red';

export type Falla = {
    ok: false;
    motivo: MotivoAgenda;
    /** en_uso: cuántas tareas usan la prioridad. */
    cantidad?: number;
    /** limite_diario: el tope (10). */
    limite?: number;
    /** ya_revisada / solicitud_no_aceptada: en qué estado está. */
    estado?: string;
};

/**
 * `motivo?: undefined` en la rama buena no es decorativo: el proyecto compila
 * sin strictNullChecks, y ahí TypeScript no angosta la unión con `!r.ok`.
 * Así `r.motivo` se puede leer siempre (y vale undefined si salió bien).
 */
export type Resultado<T> = ({ ok: true; motivo?: undefined } & T) | Falla;

export interface Persona {
    id: string;
    nombre: string | null;
    avatarUrl: string | null;
}

/** Lo que muestra una búsqueda. El email viene enmascarado si quien busca no es SUPER_ADMIN. */
export interface PersonaBuscada extends Persona {
    email: string | null;
}

export interface DepartamentoBase {
    id: string;
    nombre: string;
    color: string;
    /** Nombre lucide en kebab-case: ver src/contenido/agendaPaleta.ts. */
    icono: string;
}

export interface DepartamentoQueAdministro extends DepartamentoBase {
    enProceso: number;
    esperando: number;
    solicitudesNuevas: number;
}

export interface SubQueDirijo {
    id: string;
    departamentoId: string;
    departamentoNombre: string;
    nombre: string;
    color: string;
    enProceso: number;
}

/** Un equipo donde participo, como miembro o dirigiéndolo (una vez cada uno). */
export interface SubDondeParticipo {
    id: string;
    departamentoId: string;
    departamentoNombre: string;
    nombre: string;
    color: string;
    dirige: boolean;
}

export interface MiAcceso {
    superAdmin: boolean;
    encargado: DepartamentoQueAdministro[];
    dirijo: SubQueDirijo[];
    miembro: SubDondeParticipo[];
}

export interface DepartamentoAdmin extends DepartamentoBase {
    createdAt: string;
    encargados: Persona[];
    cantSubdepartamentos: number;
    /** Personas distintas entre todos sus equipos. */
    cantMiembros: number;
    cantTareas: number;
}

export interface Subdepartamento {
    id: string;
    nombre: string;
    color: string;
    lider: Persona | null;
    /** Sin quien dirige: ese va en `lider`. */
    miembros: Persona[];
    /** Quien dirige + miembros, cada persona una vez. */
    cantMiembros: number;
    enProceso: number;
}

export interface Carpeta {
    id: string;
    nombre: string;
    color: string;
    /** La "fecha de creación" de la hoja de la carpeta. */
    createdAt: string;
    cantTareas?: number;
}

export interface Prioridad {
    id: string;
    nombre: string;
    color: string;
    orden: number;
    /** Sólo en el panel del departamento: para "La usan N tareas". */
    cantTareas?: number;
}

export interface PanelDepartamento {
    departamento: DepartamentoBase & { createdAt: string };
    encargados: Persona[];
    subdepartamentos: Subdepartamento[];
    carpetas: Carpeta[];
    prioridades: Prioridad[];
}

export interface Tarea {
    id: string;
    departamento: DepartamentoBase;
    /**
     * archivado: el sub ya no existe como equipo. Sólo pasa con completadas,
     * que se conservan como historial (sql/agenda_archivar_subdepartamentos.sql).
     */
    subdepartamento: { id: string; nombre: string; color: string; archivado?: boolean } | null;
    carpeta: { id: string; nombre: string; color: string } | null;
    prioridad: { id: string; nombre: string; color: string; orden: number } | null;
    nombre: string;
    /** 'YYYY-MM-DD'. Para mostrarla, parsearla con fechaDesdeIso. */
    fecha: string;
    todoElDia: boolean;
    /** 'HH:MM' en 24 h, o null si es todo el día. */
    horaDesde: string | null;
    horaHasta: string | null;
    estado: EstadoTarea;
    asignadaAt: string | null;
    completadaAt: string | null;
    createdAt: string;
    updatedAt: string;
    creador: { id: string; nombre: string | null } | null;
    solicitud: {
        id: string;
        numero: number;
        createdAt: string;
        /** Lo que pidió la persona, aunque esa prioridad ya no exista. */
        prioridadNombre: string | null;
        solicitante: Persona | null;
    } | null;
}

export interface TareaDetalle extends Omit<Tarea, 'creador'> {
    detalles: string | null;
    /** Quien dirige primero y después los miembros, sin repetir. */
    laTienen: (Persona & { dirige: boolean })[];
    creador: Persona | null;
    completadaPor: Persona | null;
    /** Lo que puede hacer quien la mira: la pantalla no tiene que adivinarlo. */
    puedeEditar: boolean;
    puedeCambiarEstado: boolean;
}

export interface Solicitud {
    id: string;
    numero: number;
    estado: EstadoSolicitud;
    detalles: string;
    createdAt: string;
    revisadaAt: string | null;
    solicitante: Persona | null;
    /** id null: la prioridad se borró y queda el nombre que se pidió. */
    prioridad: { id: string | null; nombre: string; color: string | null } | null;
}

export interface PanelSubdepartamento {
    /** Hoy en Argentina, 'YYYY-MM-DD', según la base. */
    hoy: string;
    subdepartamento: { id: string; nombre: string; color: string };
    departamento: DepartamentoBase;
    lider: Persona | null;
    miembros: Persona[];
    /** Sólo nombre y foto: "a quién recurrir". */
    encargados: Persona[];
    contadores: { enProceso: number; completadasMes: number; paraHoy: number };
}

export interface DepartamentoParaSolicitar extends DepartamentoBase {
    prioridades: Prioridad[];
}

/** Lo que se carga en la hoja de una tarea. */
export interface DatosDeTarea {
    /** null = "Sin asignar todavía": la tarea queda 'esperando'. */
    subdepartamentoId: string | null;
    carpetaId: string | null;
    prioridadId: string | null;
    nombre: string;
    detalles: string | null;
    /** 'YYYY-MM-DD'. */
    fecha: string;
    todoElDia: boolean;
    /** 'HH:MM'. Se ignoran si todoElDia. */
    horaDesde: string | null;
    horaHasta: string | null;
}

// ── Fechas ──────────────────────────────────────────────────────────────

const dos = (n: number) => String(n).padStart(2, '0');

/**
 * Date → 'YYYY-MM-DD' en hora LOCAL. Es el mismo helper que isoDe de
 * pages/audiencia/SelectorDeRango.tsx; está copiado acá para no arrastrar
 * un componente de UI a la capa de servicios. toISOString() no sirve: pasa
 * a UTC, y a las 21 h en Argentina ya es mañana.
 */
export const fechaIso = (d: Date): string => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

/**
 * 'YYYY-MM-DD' → Date a la medianoche LOCAL, parseado a mano.
 * new Date('2026-10-26') sería el 25 a las 21 h en Argentina.
 */
export const fechaDesdeIso = (iso: string): Date => {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
};

export const hoyIso = (): string => fechaIso(new Date());

/** Suma días a una fecha 'YYYY-MM-DD' sin pasar por UTC. */
export const sumarDias = (iso: string, dias: number): string => {
    const d = fechaDesdeIso(iso);
    d.setDate(d.getDate() + dias);
    return fechaIso(d);
};

/**
 * Cómo se dicen las fechas de la Agenda.
 *
 * Los nombres de días y meses viven acá y en ningún otro lado del módulo:
 * la pestaña de tareas, el detalle, los formularios y la Agenda muestran la
 * misma fecha escrita igual. Todo parte de fechaDesdeIso, nunca de
 * new Date('YYYY-MM-DD').
 */
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const conMayuscula = (texto: string): string => texto.charAt(0).toUpperCase() + texto.slice(1);

/** '2026-10-26' → 'lunes 26 de octubre'. */
export const fechaLarga = (iso: string): string => {
    const d = fechaDesdeIso(iso);
    return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
};

/** '2026-10-26' → 'Lun 26 oct'. */
export const fechaCorta = (iso: string): string => {
    const d = fechaDesdeIso(iso);
    return `${conMayuscula(DIAS_CORTOS[d.getDay()])} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`;
};

/**
 * El título de un día en una lista: 'Hoy · lunes 26 de octubre',
 * 'Mañana · …', 'Ayer · …' o 'Miércoles 28 de octubre'.
 *
 * Hoy y mañana adelante porque es lo que se busca primero; el resto con la
 * fecha sola, que ya dice todo.
 */
export const fechaDeDia = (iso: string, hoy: string = hoyIso()): string => {
    if (iso === hoy) return `Hoy · ${fechaLarga(iso)}`;
    if (iso === sumarDias(hoy, 1)) return `Mañana · ${fechaLarga(iso)}`;
    if (iso === sumarDias(hoy, -1)) return `Ayer · ${fechaLarga(iso)}`;
    return conMayuscula(fechaLarga(iso));
};

/**
 * Un timestamp de la base → '26/10/2026 a las 14:32', en hora local.
 *
 * Acá sí se usa new Date: lo que viene es un instante completo con su zona
 * (to_jsonb de un timestamptz), no una fecha suelta. Se acepta el formato
 * con espacio en vez de T porque no todos los drivers lo escriben igual.
 */
export const fechaYHora = (ts: string | null): string => {
    if (!ts) return '';
    const d = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return '';
    return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} a las ${dos(d.getHours())}:${dos(d.getMinutes())}`;
};

/** 'lunes 26/10/2026 · 14:32': el sello al pie de los formularios. */
export const sello = (cuando: Date = new Date()): string =>
    `${DIAS[cuando.getDay()]} ${dos(cuando.getDate())}/${dos(cuando.getMonth() + 1)}/${cuando.getFullYear()}`
    + ` · ${dos(cuando.getHours())}:${dos(cuando.getMinutes())}`;

/** '19:00 – 20:30', o 'Todo el día'. */
export const horarioDeTarea = (t: Pick<Tarea, 'todoElDia' | 'horaDesde' | 'horaHasta'>): string =>
    t.todoElDia || !t.horaDesde ? 'Todo el día' : `${t.horaDesde} – ${t.horaHasta || t.horaDesde}`;

/** El id de algo nuevo. Generarlo UNA vez por envío y reusarlo si se reintenta. */
export const nuevoId = (): string => safeUUID();

// ── Mensajes ────────────────────────────────────────────────────────────

/** Lo que dijo la base, en palabras para la persona. */
export const mensajeDeMotivo = (motivo: MotivoAgenda, falla?: Pick<Falla, 'cantidad' | 'limite'>): string => {
    switch (motivo) {
        case 'sin_sesion': return 'Tu sesión se cerró. Volvé a entrar y probá de nuevo.';
        case 'sin_permiso': return 'No tenés permiso para hacer esto.';
        case 'no_existe': return 'Esto ya no existe. Puede que alguien lo haya borrado.';
        case 'id_requerido':
        case 'id_en_uso': return 'No se pudo guardar. Probá de nuevo.';
        case 'nombre_invalido': return 'Escribí un nombre.';
        case 'nombre_duplicado': return 'Ya hay uno con ese nombre.';
        case 'color_invalido': return 'Elegí un color.';
        case 'icono_invalido': return 'Elegí un ícono.';
        case 'sin_encargados': return 'Elegí al menos un encargado.';
        case 'usuario_inexistente': return 'Una de las personas elegidas ya no tiene cuenta.';
        case 'lider_requerido': return 'Elegí quién lo va a dirigir.';
        case 'detalles_largos': return 'El texto es demasiado largo.';
        case 'detalles_cortos': return 'Contanos un poco más: al menos 10 letras.';
        case 'fecha_invalida': return 'Elegí el día.';
        case 'horario_invalido': return 'La hora de fin tiene que ser después de la de inicio.';
        case 'sub_ajeno': return 'Ese sub-departamento no es de este departamento.';
        case 'carpeta_ajena': return 'Esa carpeta no es de este departamento.';
        case 'prioridad_ajena': return 'Esa prioridad no es de este departamento.';
        case 'prioridad_requerida': return 'Elegí una prioridad.';
        case 'completada': return 'Ya está completada. Para cambiarle el equipo, primero volvela a En proceso.';
        case 'sin_sub': return 'Se puede completar cuando esté asignada a un sub-departamento.';
        case 'estado_invalido': return 'Ese estado no se puede elegir.';
        case 'rango_invalido': return 'Elegí un período válido.';
        case 'rango_grande': return 'El período es muy largo. Elegí uno más corto.';
        case 'en_uso': return falla?.cantidad
            ? `La usan ${falla.cantidad} ${falla.cantidad === 1 ? 'tarea' : 'tareas'}. Elegí qué prioridad van a tener ahora.`
            : 'Está en uso. Elegí qué prioridad van a tener ahora sus tareas.';
        case 'reemplazo_invalido': return 'Elegí otra prioridad para reemplazarla.';
        case 'ya_tiene': return 'Este departamento ya tiene prioridades.';
        case 'lista_incompleta': return 'Faltan prioridades en la lista. Recargá y probá de nuevo.';
        case 'es_quien_dirige': return 'Es quien lo dirige. Primero elegí a otra persona para dirigirlo.';
        case 'no_es_miembro': return 'Esa persona ya no está en el sub-departamento.';
        case 'mismo_sub': return 'Elegí otro sub-departamento.';
        case 'solicitud_inexistente': return 'Esa solicitud ya no existe.';
        case 'solicitud_ajena': return 'Esa solicitud es de otro departamento.';
        case 'solicitud_no_aceptada': return 'Esa solicitud ya no está para asignar.';
        case 'ya_revisada': return 'Otra persona ya la revisó.';
        case 'accion_desconocida': return 'No se pudo hacer. Probá de nuevo.';
        case 'texto_corto': return 'Escribí al menos 2 letras.';
        case 'archivado': return 'Ese sub-departamento está archivado.';
        case 'limite_diario': return `Ya mandaste ${falla?.limite ?? 10} solicitudes hoy. Mañana podés mandar más.`;
        case 'red': return 'No pudimos conectarnos. Probá de nuevo en un momento.';
    }
};

// ── Lo crudo de la base (snake_case) ────────────────────────────────────

type Crudo = Record<string, unknown>;

const txt = (v: unknown): string => (typeof v === 'string' ? v : '');
const txtONull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);
const lista = (v: unknown): Crudo[] => (Array.isArray(v) ? (v as Crudo[]) : []);
const obj = (v: unknown): Crudo | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Crudo) : null);

const persona = (v: unknown): Persona | null => {
    const p = obj(v);
    return p ? { id: txt(p.id), nombre: txtONull(p.nombre), avatarUrl: txtONull(p.avatar_url) } : null;
};
const personas = (v: unknown): Persona[] => lista(v).map(persona).filter((p): p is Persona => !!p);

const departamentoBase = (d: Crudo): DepartamentoBase => ({
    id: txt(d.id), nombre: txt(d.nombre), color: txt(d.color), icono: txt(d.icono),
});

const colorido = (v: unknown): { id: string; nombre: string; color: string } | null => {
    const c = obj(v);
    return c ? { id: txt(c.id), nombre: txt(c.nombre), color: txt(c.color) } : null;
};

const prioridad = (p: Crudo): Prioridad => ({
    id: txt(p.id), nombre: txt(p.nombre), color: txt(p.color), orden: num(p.orden),
    ...(p.cant_tareas !== undefined ? { cantTareas: num(p.cant_tareas) } : {}),
});

const carpeta = (c: Crudo): Carpeta => ({
    id: txt(c.id), nombre: txt(c.nombre), color: txt(c.color), createdAt: txt(c.created_at),
    ...(c.cant_tareas !== undefined ? { cantTareas: num(c.cant_tareas) } : {}),
});

const tarea = (t: Crudo): Tarea => {
    const prio = obj(t.prioridad);
    const sol = obj(t.solicitud);
    const creador = obj(t.creador);
    return {
        id: txt(t.id),
        departamento: departamentoBase(obj(t.departamento) ?? {}),
        subdepartamento: (() => {
            const s = colorido(t.subdepartamento);
            return s ? { ...s, archivado: obj(t.subdepartamento)?.archivado === true } : null;
        })(),
        carpeta: colorido(t.carpeta),
        prioridad: prio ? { id: txt(prio.id), nombre: txt(prio.nombre), color: txt(prio.color), orden: num(prio.orden) } : null,
        nombre: txt(t.nombre),
        fecha: txt(t.fecha),
        todoElDia: t.todo_el_dia === true,
        horaDesde: txtONull(t.hora_desde),
        horaHasta: txtONull(t.hora_hasta),
        estado: txt(t.estado) as EstadoTarea,
        asignadaAt: txtONull(t.asignada_at),
        completadaAt: txtONull(t.completada_at),
        createdAt: txt(t.created_at),
        updatedAt: txt(t.updated_at),
        creador: creador ? { id: txt(creador.id), nombre: txtONull(creador.nombre) } : null,
        solicitud: sol ? {
            id: txt(sol.id),
            numero: num(sol.numero),
            createdAt: txt(sol.created_at),
            prioridadNombre: txtONull(sol.prioridad_nombre),
            solicitante: persona(sol.solicitante),
        } : null,
    };
};

const tareas = (v: unknown): Tarea[] => lista(v).map(tarea);

const subdepartamento = (s: Crudo): Subdepartamento => ({
    id: txt(s.id), nombre: txt(s.nombre), color: txt(s.color),
    lider: persona(s.lider),
    miembros: personas(s.miembros),
    cantMiembros: num(s.cant_miembros),
    enProceso: num(s.en_proceso),
});

const solicitud = (r: Crudo): Solicitud => {
    const p = obj(r.prioridad);
    return {
        id: txt(r.id),
        numero: num(r.numero),
        estado: txt(r.estado) as EstadoSolicitud,
        detalles: txt(r.detalles),
        createdAt: txt(r.created_at),
        revisadaAt: txtONull(r.revisada_at),
        solicitante: persona(r.solicitante),
        prioridad: p ? { id: txtONull(p.id), nombre: txt(p.nombre), color: txtONull(p.color) } : null,
    };
};

// ── El llamado ──────────────────────────────────────────────────────────

const aviso = (donde: string, error: unknown) => {
    // Sólo el motivo técnico: las respuestas llevan nombres y emails, y nada
    // de eso va a la consola.
    const motivo = (error as { message?: string })?.message || String(error);
    console.error(`[agenda] ${donde}: ${motivo}`);
};

/**
 * Llama a la RPC y separa las tres salidas: ok, la base dijo que no (con su
 * motivo) o no se pudo hablar con la base ('red').
 */
async function llamar<T extends object>(
    fn: string,
    args: Record<string, unknown>,
    mapear: (d: Crudo) => T,
): Promise<Resultado<T>> {
    try {
        const { data, error } = await supabase.rpc(fn, args);
        if (error) { aviso(fn, error); return { ok: false, motivo: 'red' }; }
        const d = obj(data);
        if (!d) { aviso(fn, 'respuesta vacía'); return { ok: false, motivo: 'red' }; }
        if (d.ok !== true) {
            return {
                ok: false,
                motivo: (txt(d.motivo) || 'red') as MotivoAgenda,
                ...(d.cantidad !== undefined ? { cantidad: num(d.cantidad) } : {}),
                ...(d.limite !== undefined ? { limite: num(d.limite) } : {}),
                ...(d.estado !== undefined ? { estado: txt(d.estado) } : {}),
            };
        }
        return { ok: true, ...mapear(d) };
    } catch (e) {
        aviso(fn, e);
        return { ok: false, motivo: 'red' };
    }
}

const sinDatos = () => ({});

// ── Acceso ──────────────────────────────────────────────────────────────

/** Qué ve cada uno: para el menú, las rutas y /departamentos. */
export const getMiAcceso = () =>
    llamar<MiAcceso>('agenda_mi_acceso', {}, d => ({
        superAdmin: d.super_admin === true,
        encargado: lista(d.encargado).map(x => ({
            ...departamentoBase(x),
            enProceso: num(x.en_proceso),
            esperando: num(x.esperando),
            solicitudesNuevas: num(x.solicitudes_nuevas),
        })),
        dirijo: lista(d.dirijo).map(x => ({
            id: txt(x.id), departamentoId: txt(x.departamento_id), departamentoNombre: txt(x.departamento_nombre),
            nombre: txt(x.nombre), color: txt(x.color), enProceso: num(x.en_proceso),
        })),
        miembro: lista(d.miembro).map(x => ({
            id: txt(x.id), departamentoId: txt(x.departamento_id), departamentoNombre: txt(x.departamento_nombre),
            nombre: txt(x.nombre), color: txt(x.color), dirige: x.dirige === true,
        })),
    }));

/** Hasta 20 personas. Sólo SUPER_ADMIN y encargados; mínimo 2 letras. */
export const buscarUsuarios = (texto: string) =>
    llamar<{ usuarios: PersonaBuscada[] }>('agenda_buscar_usuarios', { p_texto: texto }, d => ({
        usuarios: lista(d.usuarios).map(u => ({
            id: txt(u.id), nombre: txtONull(u.nombre), email: txtONull(u.email), avatarUrl: txtONull(u.avatar_url),
        })),
    }));

// ── Sistemas (SUPER_ADMIN) ──────────────────────────────────────────────

export const getDepartamentosAdmin = () =>
    llamar<{ departamentos: DepartamentoAdmin[] }>('agenda_departamentos_admin', {}, d => ({
        departamentos: lista(d.departamentos).map(x => ({
            ...departamentoBase(x),
            createdAt: txt(x.created_at),
            encargados: personas(x.encargados),
            cantSubdepartamentos: num(x.cant_subdepartamentos),
            cantMiembros: num(x.cant_miembros),
            cantTareas: num(x.cant_tareas),
        })),
    }));

/** Crea (sin id, o con uno nuevo) o edita. Reemplaza los encargados: al menos uno. */
export const guardarDepartamento = (datos: {
    id?: string; nombre: string; color: string; icono: string; encargados: string[];
}) =>
    llamar<{ id: string; creado: boolean }>('agenda_guardar_departamento', {
        p_id: datos.id ?? nuevoId(),
        p_nombre: datos.nombre.trim(),
        p_color: datos.color,
        p_icono: datos.icono,
        p_encargados: datos.encargados,
    }, d => ({ id: txt(d.id), creado: d.creado === true }));

export interface BorradoDeDepartamento {
    subdepartamentos: number; tareas: number; carpetas: number; prioridades: number; solicitudes: number;
}

export const eliminarDepartamento = (id: string) =>
    llamar<{ borrados: BorradoDeDepartamento }>('agenda_eliminar_departamento', { p_id: id }, d => {
        const b = obj(d.borrados) ?? {};
        return {
            borrados: {
                subdepartamentos: num(b.subdepartamentos), tareas: num(b.tareas), carpetas: num(b.carpetas),
                prioridades: num(b.prioridades), solicitudes: num(b.solicitudes),
            },
        };
    });

// ── Panel del departamento (encargados y SUPER_ADMIN) ───────────────────

export const getDepartamento = (departamentoId: string) =>
    llamar<PanelDepartamento>('agenda_departamento', { p_dep: departamentoId }, d => {
        const dep = obj(d.departamento) ?? {};
        return {
            departamento: { ...departamentoBase(dep), createdAt: txt(dep.created_at) },
            encargados: personas(d.encargados),
            subdepartamentos: lista(d.subdepartamentos).map(subdepartamento),
            carpetas: lista(d.carpetas).map(carpeta),
            prioridades: lista(d.prioridades).map(prioridad),
        };
    });

/** Rango de hasta 400 días; si no, 'rango_grande'. */
export const getTareasDepartamento = (departamentoId: string, desde: string, hasta: string) =>
    llamar<{ tareas: Tarea[] }>('agenda_tareas_departamento',
        { p_dep: departamentoId, p_desde: desde, p_hasta: hasta },
        d => ({ tareas: tareas(d.tareas) }));

const argsDeTarea = (datos: DatosDeTarea) => ({
    p_sub: datos.subdepartamentoId,
    p_carpeta: datos.carpetaId,
    p_prioridad: datos.prioridadId,
    p_nombre: datos.nombre.trim(),
    p_detalles: datos.detalles?.trim() || null,
    p_fecha: datos.fecha,
    p_todo_el_dia: datos.todoElDia,
    p_desde: datos.todoElDia ? null : datos.horaDesde,
    p_hasta: datos.todoElDia ? null : datos.horaHasta,
});

/**
 * Crea una tarea. El estado lo pone la base: sin sub-departamento queda
 * 'esperando'; con uno, 'en_proceso'. Con solicitudId, la solicitud tiene
 * que estar aceptada y pasa a 'asignada'.
 * `yaExistia`: era un reintento y la tarea ya estaba guardada.
 */
export const crearTarea = (datos: DatosDeTarea & { id?: string; departamentoId: string; solicitudId?: string | null }) =>
    llamar<{ tarea: Tarea; yaExistia: boolean }>('agenda_crear_tarea', {
        p_id: datos.id ?? nuevoId(),
        p_dep: datos.departamentoId,
        ...argsDeTarea(datos),
        p_solicitud: datos.solicitudId ?? null,
    }, d => ({ tarea: tarea(obj(d.tarea) ?? {}), yaExistia: d.ya_existia === true }));

/** Cambiarle el equipo a una completada devuelve 'completada'. */
export const editarTarea = (id: string, datos: DatosDeTarea) =>
    llamar<{ tarea: Tarea }>('agenda_editar_tarea', { p_id: id, ...argsDeTarea(datos) },
        d => ({ tarea: tarea(obj(d.tarea) ?? {}) }));

/** null = sacarla de todo equipo (vuelve a 'esperando'). */
export const reasignarTarea = (id: string, subdepartamentoId: string | null) =>
    llamar<{ tarea: Tarea }>('agenda_reasignar_tarea', { p_id: id, p_sub_nuevo: subdepartamentoId },
        d => ({ tarea: tarea(obj(d.tarea) ?? {}) }));

/** Si venía de una solicitud, la solicitud vuelve a 'aceptada'. */
export const eliminarTarea = (id: string) =>
    llamar('agenda_eliminar_tarea', { p_id: id }, sinDatos);

// Carpetas

export const guardarCarpeta = (datos: { id?: string; departamentoId: string; nombre: string; color: string }) =>
    llamar<{ carpeta: Carpeta }>('agenda_guardar_carpeta', {
        p_id: datos.id ?? nuevoId(),
        p_dep: datos.departamentoId,
        p_nombre: datos.nombre.trim(),
        p_color: datos.color,
    }, d => ({ carpeta: carpeta(obj(d.carpeta) ?? {}) }));

/** Sus tareas quedan sin carpeta. */
export const eliminarCarpeta = (id: string) =>
    llamar<{ tareasSinCarpeta: number }>('agenda_eliminar_carpeta', { p_id: id },
        d => ({ tareasSinCarpeta: num(d.tareas_sin_carpeta) }));

// Prioridades

/** Una nueva va al final del orden. */
export const guardarPrioridad = (datos: { id?: string; departamentoId: string; nombre: string; color: string }) =>
    llamar<{ prioridad: Prioridad }>('agenda_guardar_prioridad', {
        p_id: datos.id ?? nuevoId(),
        p_dep: datos.departamentoId,
        p_nombre: datos.nombre.trim(),
        p_color: datos.color,
    }, d => ({ prioridad: prioridad(obj(d.prioridad) ?? {}) }));

/** `ids` tiene que traer TODAS las prioridades del departamento, en el orden nuevo. */
export const ordenarPrioridades = (departamentoId: string, ids: string[]) =>
    llamar('agenda_ordenar_prioridades', { p_dep: departamentoId, p_ids: ids }, sinDatos);

/** En uso y sin reemplazo: { ok:false, motivo:'en_uso', cantidad }. */
export const eliminarPrioridad = (id: string, reemplazoId: string | null = null) =>
    llamar<{ tareasMovidas: number }>('agenda_eliminar_prioridad', { p_id: id, p_reemplazo: reemplazoId },
        d => ({ tareasMovidas: num(d.tareas_movidas) }));

/** Baja, Normal, Alta y Urgente, sólo si el departamento no tiene ninguna ('ya_tiene'). */
export const crearPrioridadesSugeridas = (departamentoId: string) =>
    llamar<{ prioridades: Prioridad[] }>('agenda_prioridades_sugeridas', { p_dep: departamentoId },
        d => ({ prioridades: lista(d.prioridades).map(prioridad) }));

// Sub-departamentos y su gente

/**
 * Crea con quien lo dirige y sus miembros, o edita nombre y color (quien
 * dirige y los miembros van por cambiarLider / agregarMiembros / …).
 */
export const guardarSubdepartamento = (datos: {
    id?: string; departamentoId: string; nombre: string; color: string; liderId: string | null; miembros: string[];
}) =>
    llamar<{ id: string; creado: boolean }>('agenda_guardar_subdepartamento', {
        p_id: datos.id ?? nuevoId(),
        p_dep: datos.departamentoId,
        p_nombre: datos.nombre.trim(),
        p_color: datos.color,
        p_lider: datos.liderId,
        p_miembros: datos.miembros,
    }, d => ({ id: txt(d.id), creado: d.creado === true }));

/**
 * Archiva el sub (no se borra: sql/agenda_archivar_subdepartamentos.sql).
 * Sus tareas sin completar vuelven a 'esperando'; las completadas quedan con
 * su sub, como historial. La respuesta dice cuántas de cada una.
 */
export const archivarSubdepartamento = (id: string) =>
    llamar<{ tareasAEsperando: number; completadasConservadas: number }>('agenda_archivar_subdepartamento', { p_id: id },
        d => ({ tareasAEsperando: num(d.tareas_a_esperando), completadasConservadas: num(d.completadas_conservadas) }));

export const agregarMiembros = (subdepartamentoId: string, userIds: string[]) =>
    llamar<{ agregados: number }>('agenda_agregar_miembros', { p_sub: subdepartamentoId, p_users: userIds },
        d => ({ agregados: num(d.agregados) }));

export const quitarMiembro = (subdepartamentoId: string, userId: string) =>
    llamar('agenda_quitar_miembro', { p_sub: subdepartamentoId, p_user: userId }, sinDatos);

export const moverMiembro = (origenId: string, destinoId: string, userId: string) =>
    llamar('agenda_mover_miembro', { p_sub_origen: origenId, p_sub_destino: destinoId, p_user: userId }, sinDatos);

/** Quien dirigía queda como miembro. */
export const cambiarLider = (subdepartamentoId: string, userId: string) =>
    llamar('agenda_cambiar_lider', { p_sub: subdepartamentoId, p_user: userId }, sinDatos);

/** Al menos uno. Lo puede hacer un encargado o SUPER_ADMIN. */
export const cambiarEncargados = (departamentoId: string, userIds: string[]) =>
    llamar('agenda_cambiar_encargados', { p_dep: departamentoId, p_users: userIds }, sinDatos);

// Solicitudes del departamento

/** Las nuevas (para revisar) y las aceptadas (para asignar). */
export const getSolicitudesDepartamento = (departamentoId: string) =>
    llamar<{ solicitudes: Solicitud[] }>('agenda_solicitudes_departamento', { p_dep: departamentoId },
        d => ({ solicitudes: lista(d.solicitudes).map(solicitud) }));

/** Sólo desde 'nueva'. Si otra persona ya la revisó: 'ya_revisada'. */
export const revisarSolicitud = (id: string, accion: 'aceptar' | 'rechazar') =>
    llamar<{ estado: EstadoSolicitud }>('agenda_revisar_solicitud', { p_id: id, p_accion: accion },
        d => ({ estado: txt(d.estado) as EstadoSolicitud }));

// ── Panel del sub-departamento (quien dirige, encargados, SUPER_ADMIN) ──

export const getSubdepartamento = (subdepartamentoId: string) =>
    llamar<PanelSubdepartamento>('agenda_subdepartamento', { p_sub: subdepartamentoId }, d => {
        const c = obj(d.contadores) ?? {};
        return {
            hoy: txt(d.hoy),
            subdepartamento: colorido(d.subdepartamento) ?? { id: '', nombre: '', color: '' },
            departamento: departamentoBase(obj(d.departamento) ?? {}),
            lider: persona(d.lider),
            miembros: personas(d.miembros),
            encargados: personas(d.encargados),
            contadores: {
                enProceso: num(c.en_proceso),
                completadasMes: num(c.completadas_mes),
                paraHoy: num(c.para_hoy),
            },
        };
    });

export const getTareasSubdepartamento = (subdepartamentoId: string, desde: string, hasta: string) =>
    llamar<{ tareas: Tarea[] }>('agenda_tareas_subdepartamento',
        { p_sub: subdepartamentoId, p_desde: desde, p_hasta: hasta },
        d => ({ tareas: tareas(d.tareas) }));

// ── Agenda (cualquiera con sesión) ──────────────────────────────────────

/**
 * Las tareas de mis equipos, en un rango de hasta 100 días. Con
 * todoElDepartamento, el encargado suma todo lo de sus departamentos
 * (también las 'esperando'); SUPER_ADMIN, todo.
 */
export const getMisTareas = (desde: string, hasta: string, todoElDepartamento = false) =>
    llamar<{ tareas: Tarea[] }>('agenda_mis_tareas',
        { p_desde: desde, p_hasta: hasta, p_todo_el_departamento: todoElDepartamento },
        d => ({ tareas: tareas(d.tareas) }));

export const getTarea = (id: string) =>
    llamar<{ tarea: TareaDetalle }>('agenda_tarea', { p_id: id }, d => {
        const t = obj(d.tarea) ?? {};
        return {
            tarea: {
                ...tarea(t),
                detalles: txtONull(t.detalles),
                laTienen: lista(t.la_tienen).map(p => ({ ...(persona(p) as Persona), dirige: p.dirige === true })),
                creador: persona(t.creador),
                completadaPor: persona(t.completada_por),
                puedeEditar: t.puede_editar === true,
                puedeCambiarEstado: t.puede_cambiar_estado === true,
            },
        };
    });

/** 'completada' o volver a 'en_proceso'. Una 'esperando' no se completa ('sin_sub'). */
export const cambiarEstadoTarea = (id: string, estado: 'completada' | 'en_proceso') =>
    llamar<{ tarea: Tarea }>('agenda_cambiar_estado_tarea', { p_id: id, p_estado: estado },
        d => ({ tarea: tarea(obj(d.tarea) ?? {}) }));

// ── Solicitudes (cualquiera con sesión) ─────────────────────────────────

export const getDepartamentosParaSolicitar = () =>
    llamar<{ departamentos: DepartamentoParaSolicitar[] }>('agenda_departamentos_para_solicitar', {}, d => ({
        departamentos: lista(d.departamentos).map(x => ({
            ...departamentoBase(x),
            prioridades: lista(x.prioridades).map(prioridad),
        })),
    }));

/**
 * Manda una solicitud. La prioridad tiene que ser de ese departamento (o
 * null si no tiene ninguna). Máximo 10 por persona por día argentino:
 * { ok:false, motivo:'limite_diario', limite:10 }.
 */
export const crearSolicitud = (datos: { id?: string; departamentoId: string; prioridadId: string | null; detalles: string }) =>
    llamar<{ id: string; numero: number; yaExistia: boolean; restantes: number | null }>('agenda_crear_solicitud', {
        p_id: datos.id ?? nuevoId(),
        p_dep: datos.departamentoId,
        p_prioridad: datos.prioridadId,
        p_detalles: datos.detalles.trim(),
    }, d => ({
        id: txt(d.id),
        numero: num(d.numero),
        yaExistia: d.ya_existia === true,
        restantes: d.restantes === undefined ? null : num(d.restantes),
    }));
