import { supabase } from './supabaseClient';

/**
 * Testimonios de los GCX: quien fue parte de un GCX en la temporada cuenta lo
 * que vivió, y queda publicado para que cualquiera lo lea.
 *
 * Todo pasa por las RPC de sql/testimonios_gcx.sql. La base decide todo:
 * cuál es la temporada vigente, si la carga está abierta, quién puede
 * publicar y qué se ve. Acá sólo se junta lo que eligió la persona y se
 * traduce la respuesta.
 *
 * Mismo molde que services/agenda.ts y services/notificaciones.ts: cada
 * función devuelve { ok: true, … } o { ok: false, motivo }. 'red' es "no se
 * pudo hablar con la base", que NO es lo mismo que "no hay nada": una lista
 * que no se pudo traer se muestra como error, nunca como vacía
 * (instrucciones, 7.9). 'no_disponible' es que la función todavía no está en
 * la base (si no se aplicó el SQL).
 *
 * Las fechas llegan como 'YYYY-MM-DD' y se muestran armadas a mano, sin pasar
 * nunca por new Date('YYYY-MM-DD'), que en Argentina cae un día antes
 * (instrucciones, 7.10).
 *
 * Lo público (temporada, galería y detalle) anda sin sesión. A esas funciones
 * la base nunca les manda ids de usuario ni emails: de las personas, sólo el
 * nombre (y la foto del anfitrión y del co-anfitrión).
 */

// ── Tipos ───────────────────────────────────────────────────────────────

/** Lo que la base puede contestar en vez de ok, más 'red' y 'no_disponible'. */
export type MotivoTestimonios =
    | 'sin_sesion' | 'no_inscripto' | 'fuera_de_plazo' | 'fuera_de_temporada'
    | 'ya_publicado' | 'texto_invalido' | 'sin_consentimiento' | 'tope' | 'sin_nombre'
    | 'no_existe' | 'no_es_tuyo' | 'motivo_largo'
    | 'no_autorizado' | 'accion_invalida' | 'estado_invalido'
    | 'red' | 'no_disponible';

export interface Falla {
    ok: false;
    motivo: MotivoTestimonios;
    /** tope / texto_invalido / motivo_largo: el límite (5 por día, 30 por minuto, 1000, 500). */
    limite?: number;
    /** ya_publicado: el testimonio que ya estaba (para "Ver mi testimonio"). */
    id?: string;
    /** fuera_de_plazo / fuera_de_temporada: la temporada vigente. */
    temporada?: Temporada;
    /** estado_invalido: en qué estado está el testimonio. */
    estado?: string;
}

/**
 * `motivo?: undefined` en la rama buena no es decorativo: el proyecto compila
 * sin strictNullChecks, y ahí TypeScript no angosta la unión con `!r.ok`.
 */
export type Resultado<T> = ({ ok: true; motivo?: undefined } & T) | Falla;

export type ClaveTemporada = 'S1' | 'S2' | 'S3';

/** La temporada vigente: la actual, o la última que hubo. */
export interface Temporada {
    clave: ClaveTemporada;
    anio: number;
    /** 'Tercera temporada' */
    nombre: string;
    /** 'Tercera temporada · 2026', como lo muestra el diseño. */
    etiqueta: string;
    /** 'YYYY-MM-DD' */
    inicio: string;
    fin: string;
    /** Si hoy está entre el inicio y el fin. */
    enCurso: boolean;
    /** Si todavía se puede dejar un testimonio (hasta un mes después del fin). */
    cargaAbierta: boolean;
    /** Último día para dejarlo, 'YYYY-MM-DD'. */
    cargaHasta: string;
}

export interface Anfitrion {
    nombre: string;
    foto: string | null;
    /** 'Anfitriona' · 'Anfitrión' · 'Co-anfitriona' · 'Co-anfitrión' */
    rol: string;
}

/** Por qué un GCX apareció en una búsqueda. */
export type Coincidencia = 'grupo' | 'anfitrion' | 'testimonio';

/** Una tarjeta de la galería. */
export interface GrupoGaleria {
    id: string;
    nombre: string;
    portada: string | null;
    anfitriones: Anfitrion[];
    /** Cuántos testimonios publicados tiene. */
    testimonios: number;
    /** null sin búsqueda. */
    coincide: Coincidencia | null;
    /** coincide = 'testimonio': hasta dos nombres de quienes escribieron. */
    autores: string[];
    /** coincide = 'testimonio': cuántas personas coincidieron en total. */
    autoresTotal: number;
}

/** Un testimonio publicado, tal como se ve en /testimonios/:id. */
export interface TestimonioPublico {
    id: string;
    /** El nombre de quien escribió; un menor de 18 (o sin fecha de nacimiento), "Nombre I." */
    autor: string;
    /** 'Tercera temporada' */
    temporada: string;
    anio: number;
    texto: string;
    corazones: number;
    /** Con sesión: si yo le di corazón. Sin sesión, siempre false. */
    yoDi: boolean;
    /** Con sesión: si lo escribí yo. Sin sesión, siempre false. */
    esMio: boolean;
}

export interface GrupoDetalle {
    id: string;
    nombre: string;
    portada: string | null;
    descripcion: string;
    anfitriones: Anfitrion[];
}

export type EstadoTestimonio = 'publicado' | 'eliminacion_solicitada' | 'oculto';

export type MiRolClave = 'anfitrion' | 'coanfitrion' | 'participante';

/**
 * Un GCX mío de la temporada, en /testimonios-gcx: donde tengo inscripción
 * aprobada o soy anfitrión o co-anfitrión (una sola vez cada uno).
 */
export interface MiGrupo {
    id: string;
    nombre: string;
    portada: string | null;
    anfitriones: Anfitrion[];
    /** 'Anfitrión' · 'Co-anfitrión' · 'Participante' */
    miRol: string;
    miRolClave: MiRolClave;
    yaPublicado: boolean;
    /** El mío en este GCX, si ya lo dejé. */
    testimonioId: string | null;
    estado: EstadoTestimonio | null;
}

/** Uno mío, en "Mis testimonios". */
export interface MiTestimonio {
    id: string;
    grupo: { id: string; nombre: string; portada: string | null };
    temporada: string;
    anio: number;
    texto: string;
    estado: EstadoTestimonio;
    corazones: number;
    /** timestamptz ISO */
    creado: string;
    eliminacionPedida: string | null;
    eliminacionMotivo: string | null;
    decision: 'pedido_rechazado' | 'oculto' | 'mostrado' | null;
    decidido: string | null;
    /** Si hoy se ve en /testimonios. */
    visible: boolean;
}

/** Uno, visto por Sistemas. */
export interface TestimonioAdmin {
    id: string;
    estado: EstadoTestimonio;
    texto: string;
    autor: { id: string; nombre: string | null; email: string | null };
    grupo: { id: string; nombre: string };
    temporada: ClaveTemporada;
    anio: number;
    corazones: number;
    creado: string;
    consentimiento: string;
    eliminacionPedida: string | null;
    eliminacionMotivo: string | null;
    estadoAntesDelPedido: 'publicado' | 'oculto' | null;
    decision: 'pedido_rechazado' | 'oculto' | 'mostrado' | null;
    decidido: string | null;
    decididoPor: string | null;
}

export type AccionModeracion = 'eliminar' | 'rechazar' | 'ocultar' | 'mostrar';

/** Los mismos límites que la base (CHECK de gcx_testimonios). */
export const LIMITE_TEXTO = 1000;
export const LIMITE_MOTIVO = 500;
/** Desde acá el contador avisa cuánto queda (el diseño: 900). */
export const AVISO_TEXTO = 900;

// ── Lectura de lo que viene de la base ──────────────────────────────────

type Crudo = Record<string, unknown>;

const obj = (x: unknown): Crudo | null => (x && typeof x === 'object' && !Array.isArray(x) ? x as Crudo : null);
const lista = (x: unknown): Crudo[] => (Array.isArray(x) ? x.map(obj).filter((o): o is Crudo => !!o) : []);
const txt = (x: unknown): string => (typeof x === 'string' ? x : x == null ? '' : String(x));
const txtONull = (x: unknown): string | null => (typeof x === 'string' && x !== '' ? x : null);
const num = (x: unknown): number => (typeof x === 'number' ? x : Number(x) || 0);
const textos = (x: unknown): string[] => (Array.isArray(x) ? x.map(txt).filter(Boolean) : []);
const si = (x: unknown): boolean => x === true;

const temporadaDe = (x: unknown): Temporada | null => {
    const t = obj(x);
    if (!t || !t.temporada) return null;
    const nombre = txt(t.nombre);
    const anio = num(t.anio);
    return {
        clave: txt(t.temporada) as ClaveTemporada,
        anio,
        nombre,
        etiqueta: `${nombre} · ${anio}`,
        inicio: txt(t.inicio),
        fin: txt(t.fin),
        enCurso: si(t.en_curso),
        cargaAbierta: si(t.carga_abierta),
        cargaHasta: txt(t.carga_hasta),
    };
};

const anfitrionesDe = (x: unknown): Anfitrion[] =>
    lista(x).map(a => ({ nombre: txt(a.nombre), foto: txtONull(a.foto), rol: txt(a.rol) }));

const grupoGaleriaDe = (g: Crudo): GrupoGaleria => ({
    id: txt(g.id),
    nombre: txt(g.nombre),
    portada: txtONull(g.portada),
    anfitriones: anfitrionesDe(g.anfitriones),
    testimonios: num(g.testimonios),
    coincide: (txtONull(g.coincide) as Coincidencia | null),
    autores: textos(g.autores),
    autoresTotal: num(g.autores_total),
});

const testimonioPublicoDe = (t: Crudo): TestimonioPublico => ({
    id: txt(t.id),
    autor: txt(t.autor),
    temporada: txt(t.temporada),
    anio: num(t.anio),
    texto: txt(t.texto),
    corazones: num(t.corazones),
    yoDi: si(t.yo_di),
    esMio: si(t.es_mio),
});

const miGrupoDe = (g: Crudo): MiGrupo => ({
    id: txt(g.id),
    nombre: txt(g.nombre),
    portada: txtONull(g.portada),
    anfitriones: anfitrionesDe(g.anfitriones),
    miRol: txt(g.mi_rol),
    miRolClave: txt(g.mi_rol_clave) as MiRolClave,
    yaPublicado: si(g.ya_publicado),
    testimonioId: txtONull(g.testimonio_id),
    estado: (txtONull(g.estado) as EstadoTestimonio | null),
});

const miTestimonioDe = (t: Crudo): MiTestimonio => {
    const g = obj(t.grupo) || {};
    return {
        id: txt(t.id),
        grupo: { id: txt(g.id), nombre: txt(g.nombre), portada: txtONull(g.portada) },
        temporada: txt(t.temporada),
        anio: num(t.anio),
        texto: txt(t.texto),
        estado: txt(t.estado) as EstadoTestimonio,
        corazones: num(t.corazones),
        creado: txt(t.creado),
        eliminacionPedida: txtONull(t.eliminacion_pedida),
        eliminacionMotivo: txtONull(t.eliminacion_motivo),
        decision: txtONull(t.decision) as MiTestimonio['decision'],
        decidido: txtONull(t.decidido),
        visible: si(t.visible),
    };
};

const testimonioAdminDe = (t: Crudo): TestimonioAdmin => {
    const a = obj(t.autor) || {};
    const g = obj(t.grupo) || {};
    return {
        id: txt(t.id),
        estado: txt(t.estado) as EstadoTestimonio,
        texto: txt(t.texto),
        autor: { id: txt(a.id), nombre: txtONull(a.nombre), email: txtONull(a.email) },
        grupo: { id: txt(g.id), nombre: txt(g.nombre) },
        temporada: txt(t.temporada) as ClaveTemporada,
        anio: num(t.anio),
        corazones: num(t.corazones),
        creado: txt(t.creado),
        consentimiento: txt(t.consentimiento),
        eliminacionPedida: txtONull(t.eliminacion_pedida),
        eliminacionMotivo: txtONull(t.eliminacion_motivo),
        estadoAntesDelPedido: txtONull(t.estado_antes_del_pedido) as TestimonioAdmin['estadoAntesDelPedido'],
        decision: txtONull(t.decision) as TestimonioAdmin['decision'],
        decidido: txtONull(t.decidido),
        decididoPor: txtONull(t.decidido_por),
    };
};

const aviso = (donde: string, error: unknown) => {
    const motivo = (error as { message?: string })?.message || String(error);
    console.error(`[testimonios] ${donde}: ${motivo}`);
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
            const t = temporadaDe(d.temporada);
            return {
                ok: false,
                motivo: (txt(d.motivo) || 'red') as MotivoTestimonios,
                ...(d.limite !== undefined ? { limite: num(d.limite) } : {}),
                ...(d.id !== undefined ? { id: txt(d.id) } : {}),
                ...(t ? { temporada: t } : {}),
                ...(d.estado !== undefined ? { estado: txt(d.estado) } : {}),
            };
        }
        return { ok: true, ...mapear(d) };
    } catch (e) {
        aviso(fn, e);
        return { ok: false, motivo: 'red' };
    }
}

/** Una respuesta buena sin temporada sería un error de la base, no "no hay". */
const conTemporada = <T extends object>(d: Crudo, resto: T): T & { temporada: Temporada } => {
    const t = temporadaDe(d.temporada);
    if (!t) throw new Error('la base no mandó la temporada');
    return { ...resto, temporada: t };
};

async function llamarConTemporada<T extends object>(
    fn: string,
    args: Record<string, unknown>,
    mapear: (d: Crudo) => T,
): Promise<Resultado<T & { temporada: Temporada }>> {
    try {
        return await llamar(fn, args, d => conTemporada(d, mapear(d)));
    } catch (e) {
        aviso(fn, e);
        return { ok: false, motivo: 'red' };
    }
}

// ── Lo público (anda sin sesión) ────────────────────────────────────────

/** La temporada vigente, si la carga está abierta y hasta cuándo. */
export const getTemporadaTestimonios = () =>
    llamarConTemporada('testimonios_temporada', {}, () => ({}));

/**
 * La galería: todos los GCX aprobados de la temporada vigente, tengan o no
 * testimonios. La búsqueda va por nombre del GCX, del anfitrión o del
 * co-anfitrión, o de quien dejó un testimonio, sin mayúsculas ni acentos.
 */
export const getGruposTestimonios = (busqueda?: string) =>
    llamarConTemporada('testimonios_grupos', { p_busqueda: busqueda?.trim() || null }, d => ({
        grupos: lista(d.grupos).map(grupoGaleriaDe),
    }));

/** El detalle de un GCX y sus testimonios publicados, más nuevos primero. */
export const getGrupoTestimonios = (groupId: string) =>
    llamarConTemporada('testimonios_grupo', { p_group_id: groupId }, d => {
        const g = obj(d.grupo) || {};
        return {
            grupo: {
                id: txt(g.id),
                nombre: txt(g.nombre),
                portada: txtONull(g.portada),
                descripcion: txt(g.descripcion),
                anfitriones: anfitrionesDe(g.anfitriones),
            } as GrupoDetalle,
            testimonios: lista(d.testimonios).map(testimonioPublicoDe),
        };
    });

// ── Con sesión ──────────────────────────────────────────────────────────

/** Mis GCX de la temporada vigente y si ya dejé testimonio en cada uno. */
export const getMisGruposTestimonios = () =>
    llamarConTemporada('testimonios_mis_grupos', {}, d => ({
        grupos: lista(d.grupos).map(miGrupoDe),
        /**
         * Para la vista previa del modal, COMO SE VA A VER: un menor de 18 (o
         * sin fecha de nacimiento) ve "Nombre I.". null: la cuenta no tiene nombre.
         */
        miNombre: txtONull(d.mi_nombre),
    }));

/**
 * Publica. `consiento` es el "Confirmar" del modal: sin él la base no lo
 * guarda. Reintentar con el mismo texto devuelve el mismo (`yaExistia`).
 */
export const publicarTestimonio = (groupId: string, texto: string, consiento: boolean) =>
    llamar('testimonios_publicar', { p_group_id: groupId, p_texto: texto, p_consiento: consiento }, d => ({
        id: txt(d.id),
        yaExistia: si(d.ya_existia),
        grupo: txt(d.grupo),
    }));

/** Da (dar = true) o quita el corazón. Devuelve el contador nuevo. */
export const darCorazon = (testimonioId: string, dar: boolean) =>
    llamar('testimonios_corazon', { p_testimonio_id: testimonioId, p_dar: dar }, d => ({
        di: si(d.di),
        corazones: num(d.corazones),
    }));

/** Los míos, de todas las temporadas, para "Mis testimonios". */
export const getMisTestimonios = () =>
    llamarConTemporada('testimonios_mios', {}, d => ({
        testimonios: lista(d.testimonios).map(miTestimonioDe),
    }));

/** "Solicitar eliminación": lo oculta en el acto y le avisa a Sistemas. */
export const solicitarEliminacion = (testimonioId: string, motivo?: string) =>
    llamar('testimonios_solicitar_eliminacion', { p_id: testimonioId, p_motivo: motivo?.trim() || null }, d => ({
        /** Ya estaba pedido: no se volvió a avisar. */
        yaSolicitado: si(d.ya_solicitado),
    }));

// ── Sistemas (sólo SUPER_ADMIN) ─────────────────────────────────────────

export interface FiltrosModeracion {
    estado?: EstadoTestimonio | null;
    busqueda?: string;
    temporada?: ClaveTemporada | null;
    anio?: number | null;
    limite?: number;
}

/** Todos, con los pedidos de eliminación primero. */
export const getTestimoniosAdmin = (f: FiltrosModeracion = {}) =>
    llamar('testimonios_admin_listar', {
        p_estado: f.estado ?? null,
        p_busqueda: f.busqueda?.trim() || null,
        p_temporada: f.temporada ?? null,
        p_anio: f.anio ?? null,
        p_limite: f.limite ?? 200,
    }, d => {
        const c = obj(d.cantidades) || {};
        return {
            testimonios: lista(d.testimonios).map(testimonioAdminDe),
            cantidades: {
                publicado: num(c.publicado),
                eliminacionSolicitada: num(c.eliminacion_solicitada),
                oculto: num(c.oculto),
            },
        };
    });

/** eliminar (de verdad, con sus corazones) · rechazar el pedido · ocultar · mostrar. */
export const resolverTestimonio = (testimonioId: string, accion: AccionModeracion) =>
    llamar('testimonios_admin_resolver', { p_id: testimonioId, p_accion: accion }, d => ({
        /** null si se eliminó. */
        estado: txtONull(d.estado) as EstadoTestimonio | null,
        sinCambios: si(d.sin_cambios),
    }));

// ── Fechas, sin new Date ────────────────────────────────────────────────

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
    'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** '2026-12-29' → '29/12' ("Hasta el 29/12"). */
export const diaYMes = (fecha: string): string => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha || '');
    return m ? `${Number(m[3])}/${m[2]}` : '';
};

/** '2026-12-29' → '29 de diciembre' ("hasta el 29 de diciembre"). */
export const diaYMesLargo = (fecha: string): string => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha || '');
    return m ? `${Number(m[3])} de ${MESES[Number(m[2]) - 1] ?? ''}` : '';
};

// ── Mensajes ────────────────────────────────────────────────────────────

/** Lo que dijo la base, en palabras para la persona. Nunca el código crudo. */
export const mensajeDeMotivo = (f: { motivo?: MotivoTestimonios; limite?: number; temporada?: Temporada }): string => {
    switch (f.motivo ?? 'red') {
        case 'sin_sesion': return 'Tu sesión se cerró. Volvé a entrar y probá de nuevo.';
        case 'no_inscripto': return 'Para dejar un testimonio tenés que haber sido parte de este GCX en la temporada (inscripto, anfitrión o co-anfitrión).';
        case 'fuera_de_plazo': return f.temporada
            ? `Los testimonios de la ${f.temporada.etiqueta} cerraron el ${diaYMes(f.temporada.cargaHasta)}.`
            : 'La carga de testimonios de esta temporada ya cerró.';
        case 'fuera_de_temporada': return f.temporada
            ? `Este GCX no es de la ${f.temporada.etiqueta}.`
            : 'Este GCX no es de la temporada actual.';
        case 'ya_publicado': return 'Ya dejaste tu testimonio en este GCX.';
        case 'texto_invalido': return `Escribí tu testimonio: de 1 a ${f.limite ?? LIMITE_TEXTO} caracteres.`;
        case 'sin_consentimiento': return 'Para publicarlo tenés que confirmarlo.';
        case 'tope': return f.limite === 5
            ? 'Ya dejaste 5 testimonios hoy. Mañana podés dejar más.'
            : 'Vas muy rápido. Esperá un minuto y probá de nuevo.';
        case 'sin_nombre': return 'Tu cuenta no tiene nombre. Completalo en Mi cuenta y volvé.';
        case 'no_existe': return 'Este testimonio o este GCX ya no está.';
        case 'no_es_tuyo': return 'Sólo podés pedir eliminar tus propios testimonios.';
        case 'motivo_largo': return `El motivo puede tener hasta ${f.limite ?? LIMITE_MOTIVO} caracteres.`;
        case 'no_autorizado': return 'No tenés permiso para hacer esto. Lo administra Sistemas.';
        case 'accion_invalida': return 'Esa acción no existe.';
        case 'estado_invalido': return 'No se puede hacer eso en el estado en que está. Recargá y probá de nuevo.';
        case 'no_disponible': return 'Los testimonios todavía no están disponibles: falta instalar su base (sql/testimonios_gcx.sql).';
        case 'red':
        default: return 'No pudimos hablar con el servidor. Revisá la conexión y probá de nuevo.';
    }
};
