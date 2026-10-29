import { supabase } from './supabaseClient';
import { safeUUID } from './uuidUtils';

/**
 * Gestión de notificaciones (pantalla de Sistemas, /panel-admin?tab=notificaciones).
 *
 * Todo pasa por las RPC de sql/notif_catalogo.sql (automáticas),
 * sql/notif_programadas.sql (programadas) y sql/notif_prueba.sql ("Enviarme
 * una prueba"). Todas le responden sólo a SUPER_ADMIN y deciden ellas: acá
 * sólo se junta lo que eligió la persona y se traduce la respuesta.
 *
 * Mismo molde que services/agenda.ts: cada función devuelve { ok: true, … } o
 * { ok: false, motivo }. 'red' es "no se pudo hablar con la base", que no es
 * lo mismo que "no hay nada". 'no_disponible' es que la función todavía no
 * está instalada en la base (la de la prueba, si no se aplicó su SQL).
 *
 * Las horas viajan como 'HH:MM' (la base devuelve 'HH:MM:SS') y las fechas
 * como 'YYYY-MM-DD', sin pasar nunca por new Date (instrucciones, 7.10).
 */

// ── Tipos ───────────────────────────────────────────────────────────────

export type TipoAlerta = 'automatica' | 'programada';

/** Lo que la base puede contestar en vez de ok, más 'red' y 'no_disponible'. */
export type MotivoNotif =
    | 'sin_permiso' | 'no_existe' | 'eliminada' | 'no_es_programada' | 'no_eliminable'
    | 'texto_invalido' | 'variable_invalida' | 'url_invalida'
    | 'fechas_invalidas' | 'frecuencia_invalida' | 'horas_invalidas' | 'horas_repetidas'
    | 'audiencia_vacia' | 'rol_invalido' | 'usuario_invalido'
    | 'tope_invalido' | 'horario_invalido' | 'estado_invalido'
    | 'sin_dispositivos' | 'tope'
    | 'red' | 'no_disponible';

export interface Falla {
    ok: false;
    motivo: MotivoNotif;
    /** texto_invalido: qué campo ('nombre' | 'titulo' | 'mensaje'). */
    campo?: string;
    /** variable_invalida (automáticas): cuáles no son de la alerta. */
    variables?: string[];
}

// Como en agenda.ts: sin `strict`, el `motivo?: undefined` es lo que deja que
// `if (!r.ok)` separe las dos ramas.
export type Resultado<T> = ({ ok: true; motivo?: undefined; campo?: undefined; variables?: undefined } & T) | Falla;

export interface PersonaElegida { id: string; nombre: string | null; activa: boolean }

export interface Alerta {
    id: string;
    clave: string;
    tipo: TipoAlerta;
    nombre: string;
    /** Automáticas: se lee después de "Sale cuando…". */
    descripcionEvento: string | null;
    /** Automáticas: a quién le llega, en palabras. */
    destinatarioTexto: string | null;
    variables: string[];
    titulo: string;
    mensaje: string;
    url: string | null;
    typeLegacy: string;
    activa: boolean;
    noMolestar: boolean;
    nmDesde: string | null;
    nmHasta: string | null;
    maxPorDia: number | null;
    // Programadas (null en las automáticas).
    siempreActiva: boolean | null;
    desde: string | null;
    hasta: string | null;
    cadaNDias: number | null;
    horas: string[];
    audienciaTodos: boolean;
    audienciaRoles: string[];
    audienciaUsuarios: string[];
    /** Los textos de alcance TAL COMO los arma la base. */
    alcance: string | null;
    horario: string | null;
    vigencia: string | null;
    audienciaPersonas: number | null;
    audienciaConPush: number | null;
    audienciaDetalle: PersonaElegida[];
    /** timestamptz ISO, o null (pausada, vencida o sin más días). */
    proximoEnvio: string | null;
    enviados7d: number;
}

export interface RolDisponible { rol: string; personas: number }

// ── Lectura de lo que devuelve la base ───────────────────────────────────

type Crudo = Record<string, unknown>;
const obj = (x: unknown): Crudo | null => (x && typeof x === 'object' && !Array.isArray(x) ? x as Crudo : null);
const lista = (x: unknown): Crudo[] => (Array.isArray(x) ? x.map(obj).filter((o): o is Crudo => !!o) : []);
const txt = (x: unknown): string => (typeof x === 'string' ? x : x == null ? '' : String(x));
const txtONull = (x: unknown): string | null => (typeof x === 'string' && x !== '' ? x : null);
const num = (x: unknown): number => (typeof x === 'number' ? x : Number(x) || 0);
const numONull = (x: unknown): number | null => (x == null ? null : Number.isFinite(Number(x)) ? Number(x) : null);
const textos = (x: unknown): string[] => (Array.isArray(x) ? x.map(txt).filter(Boolean) : []);
/** '10:00:00' → '10:00'. */
const hhmm = (x: unknown): string | null => {
    const t = txtONull(x);
    return t ? t.slice(0, 5) : null;
};

const alertaDe = (a: Crudo): Alerta => {
    const det = obj(a.alcance_detalle);
    return {
        id: txt(a.id),
        clave: txt(a.clave),
        tipo: a.tipo === 'programada' ? 'programada' : 'automatica',
        nombre: txt(a.nombre),
        descripcionEvento: txtONull(a.descripcion_evento),
        destinatarioTexto: txtONull(a.destinatario_texto),
        variables: textos(a.variables),
        titulo: txt(a.titulo_plantilla),
        mensaje: txt(a.mensaje_plantilla),
        url: txtONull(a.url_plantilla),
        typeLegacy: txt(a.type_legacy),
        activa: a.activa === true,
        noMolestar: a.no_molestar === true,
        nmDesde: hhmm(a.no_molestar_desde),
        nmHasta: hhmm(a.no_molestar_hasta),
        maxPorDia: numONull(a.max_por_dia),
        siempreActiva: typeof a.siempre_activa === 'boolean' ? a.siempre_activa : null,
        desde: txtONull(a.desde),
        hasta: txtONull(a.hasta),
        cadaNDias: numONull(a.cada_n_dias),
        horas: (Array.isArray(a.horas) ? a.horas : []).map(hhmm).filter((h): h is string => !!h),
        audienciaTodos: a.audiencia_todos === true,
        audienciaRoles: textos(a.audiencia_roles),
        audienciaUsuarios: textos(a.audiencia_usuarios),
        alcance: txtONull(a.alcance),
        horario: det ? txtONull(det.horario) : null,
        vigencia: det ? txtONull(det.vigencia) : null,
        audienciaPersonas: numONull(a.audiencia_personas),
        audienciaConPush: numONull(a.audiencia_con_push),
        audienciaDetalle: lista(a.audiencia_detalle).map(p => ({
            id: txt(p.id), nombre: txtONull(p.nombre), activa: p.activa !== false,
        })),
        proximoEnvio: txtONull(a.proximo_envio),
        enviados7d: num(a.enviados_7d),
    };
};

const aviso = (donde: string, error: unknown) => {
    const motivo = (error as { message?: string })?.message || String(error);
    console.error(`[notificaciones] ${donde}: ${motivo}`);
};

/** La función no existe en la base (PostgREST: PGRST202). */
const noExiste = (error: unknown) => (error as { code?: string })?.code === 'PGRST202';

async function llamar<T extends object>(
    fn: string,
    args: Record<string, unknown>,
    mapear: (d: Crudo) => T,
): Promise<Resultado<T>> {
    try {
        const { data, error } = await supabase.rpc(fn, args);
        if (error) {
            aviso(fn, error);
            return { ok: false, motivo: noExiste(error) ? 'no_disponible' : 'red' };
        }
        const d = obj(data);
        if (!d) { aviso(fn, 'respuesta vacía'); return { ok: false, motivo: 'red' }; }
        if (d.ok !== true) {
            return {
                ok: false,
                motivo: (txt(d.motivo) || 'red') as MotivoNotif,
                ...(d.campo !== undefined ? { campo: txt(d.campo) } : {}),
                ...(d.variables !== undefined ? { variables: textos(d.variables) } : {}),
            };
        }
        return { ok: true, ...mapear(d) };
    } catch (e) {
        aviso(fn, e);
        return { ok: false, motivo: 'red' };
    }
}

const sinDatos = () => ({});

// ── Lo que usa la pantalla ───────────────────────────────────────────────

/** El id de una programada nueva: UNO por formulario, reusado en los reintentos. */
export const nuevoIdAlerta = (): string => safeUUID();

/** El catálogo entero, sin las eliminadas. */
export const getAlertas = () =>
    llamar<{ alertas: Alerta[]; personasConPush: number }>('notif_alertas_admin', {}, d => ({
        alertas: lista(d.alertas).map(alertaDe),
        personasConPush: num(d.personas_con_push),
    }));

export interface DatosProgramada {
    id: string;
    nombre: string;
    titulo: string;
    mensaje: string;
    url: string;
    siempreActiva: boolean;
    desde: string;
    hasta: string | null;
    cadaNDias: number;
    horas: string[];
    todos: boolean;
    roles: string[];
    usuarios: string[];
    noMolestar: boolean;
    nmDesde: string | null;
    nmHasta: string | null;
    maxPorDia: number | null;
    activa: boolean;
}

/** Crea (con el id del cliente: idempotente) o edita. */
export const guardarProgramada = (p: DatosProgramada) =>
    llamar<{ id: string; creada: boolean }>('notif_guardar_programada', {
        p_id: p.id,
        p_nombre: p.nombre,
        p_titulo: p.titulo,
        p_mensaje: p.mensaje,
        p_url: p.url,
        p_siempre_activa: p.siempreActiva,
        p_desde: p.desde,
        p_hasta: p.siempreActiva ? null : p.hasta,
        p_cada_n_dias: p.cadaNDias,
        p_horas: p.horas,
        p_audiencia_todos: p.todos,
        p_audiencia_roles: p.todos ? [] : p.roles,
        p_audiencia_usuarios: p.todos ? [] : p.usuarios,
        p_no_molestar: p.noMolestar,
        p_nm_desde: p.noMolestar ? p.nmDesde : null,
        p_nm_hasta: p.noMolestar ? p.nmHasta : null,
        p_max_por_dia: p.maxPorDia,
        p_activa: p.activa,
    }, d => ({ id: txt(d.id), creada: d.creada === true }));

/** Automáticas: sólo texto, pausa, no molestar y tope (lo demás lo decide la app). */
export const guardarAutomatica = (p: {
    id: string; titulo: string; mensaje: string; activa: boolean;
    noMolestar: boolean; nmDesde: string | null; nmHasta: string | null; maxPorDia: number | null;
}) =>
    llamar('notif_guardar_automatica', {
        p_id: p.id,
        p_titulo: p.titulo,
        p_mensaje: p.mensaje,
        p_activa: p.activa,
        p_no_molestar: p.noMolestar,
        p_desde: p.noMolestar ? p.nmDesde : null,
        p_hasta: p.noMolestar ? p.nmHasta : null,
        p_max_por_dia: p.maxPorDia,
    }, sinDatos);

/** Pausar o activar cualquier alerta. */
export const cambiarEstado = (id: string, activa: boolean) =>
    llamar('notif_cambiar_estado', { p_id: id, p_activa: activa }, sinDatos);

/** Baja lógica. Sólo programadas: en una automática la base dice no_eliminable. */
export const eliminarProgramada = (id: string) =>
    llamar('notif_eliminar_programada', { p_id: id }, sinDatos);

/** "Le llega a N personas · M con el push activado". */
export const estimarAudiencia = (todos: boolean, roles: string[], usuarios: string[]) =>
    llamar<{ personas: number; conPush: number; tope: number }>('notif_estimar_audiencia', {
        p_todos: todos, p_roles: todos ? [] : roles, p_usuarios: todos ? [] : usuarios,
    }, d => ({ personas: num(d.personas), conPush: num(d.con_push), tope: num(d.tope) || 5000 }));

/** Los roles con al menos una persona activa, para los chips. */
export const rolesDisponibles = () =>
    llamar<{ roles: RolDisponible[] }>('notif_roles_disponibles', {}, d => ({
        roles: lista(d.roles).map(r => ({ rol: txt(r.rol), personas: num(r.personas) })),
    }));

/** "Enviarme una prueba": el texto del editor, sólo a quien la pide. */
export const probarTexto = (titulo: string, mensaje: string, url: string | null, alertaId: string | null) =>
    llamar<{ quedan: number }>('notif_probar_texto', {
        p_titulo: titulo, p_mensaje: mensaje, p_url: url, p_alerta_id: alertaId,
    }, d => ({ quedan: num(d.quedan) }));

// ── Mensajes ────────────────────────────────────────────────────────────

/** Lo que dijo la base, en palabras para la persona. Nunca el código crudo. */
export const mensajeDeMotivo = (f: { motivo?: MotivoNotif; campo?: string; variables?: string[] }): string => {
    switch (f.motivo ?? 'red') {
        case 'sin_permiso': return 'No tenés permiso para hacer esto. Lo administra Sistemas.';
        case 'no_existe': return 'Esta alerta ya no existe. Puede que alguien la haya eliminado.';
        case 'eliminada': return 'Esta alerta se eliminó y ya no se puede editar.';
        case 'no_es_programada': return 'Esta alerta es de la app: sólo se puede cambiar el texto, el horario y el tope.';
        case 'no_eliminable': return 'Las alertas de la app no se pueden eliminar. Si no querés que suene, pausala.';
        case 'texto_invalido':
            return f.campo === 'nombre' ? 'Ponele un nombre a la alerta.'
                : f.campo === 'titulo' ? 'Escribí un título (hasta 60 letras).'
                    : f.campo === 'mensaje' ? 'Escribí el mensaje (hasta 160 letras).'
                        : 'Revisá el título y el mensaje: no pueden quedar vacíos ni pasarse del largo.';
        case 'variable_invalida': return f.variables?.length
            ? `Esta alerta no conoce ${f.variables.map(v => `{${v}}`).join(', ')}. Usá sólo las variables de la lista.`
            : 'Las alertas programadas llevan texto fijo: sacá lo que está entre llaves { }.';
        case 'url_invalida': return 'Elegí una pantalla de la app para abrir al tocarla.';
        case 'fechas_invalidas': return 'La fecha de fin tiene que ser igual o posterior al inicio.';
        case 'frecuencia_invalida': return 'Elegí cada cuántos días se repite: entre 1 y 365.';
        case 'horas_invalidas': return 'Elegí entre 1 y 5 horarios.';
        case 'horas_repetidas': return 'Hay dos horarios iguales.';
        case 'audiencia_vacia': return 'Elegí a quién le llega: toda la iglesia, un rol o una persona.';
        case 'rol_invalido': return 'Uno de los roles elegidos ya no existe. Sacalo y probá de nuevo.';
        case 'usuario_invalido': return 'Una de las personas elegidas ya no tiene cuenta. Sacala y probá de nuevo.';
        case 'tope_invalido': return 'El máximo por día tiene que ser entre 1 y 20.';
        case 'horario_invalido': return 'El horario de no molestar necesita un inicio y un fin distintos.';
        case 'estado_invalido': return 'No se pudo cambiar el estado. Probá de nuevo.';
        case 'sin_dispositivos': return 'Activá las notificaciones en este dispositivo para recibir la prueba (Mi cuenta › Notificaciones).';
        case 'tope': return 'Ya mandaste 10 pruebas hoy. Mañana podés mandar más.';
        case 'no_disponible': return 'La prueba todavía no está disponible: falta instalar su función en la base (sql/notif_prueba.sql).';
        case 'red':
        default: return 'No pudimos hablar con el servidor. Revisá la conexión y probá de nuevo.';
    }
};
