import { supabase } from './supabaseClient';
import { comprimirImagen } from '../src/utils/nocturna';
import { safeUUID } from './uuidUtils';

/**
 * Lo que necesita "Mi cuenta", y nada más.
 *
 * Del otro lado está sql/mi_cuenta.sql. Tres cosas que conviene saber antes
 * de tocar esto:
 *
 * 1 · LAS ALTAS VAN POR RPC, NO POR `insert()`. Las dos tablas nuevas
 *     (solicitudes_datos, reportes_problemas) tienen una `nota_interna` que
 *     la persona no debe ver, así que NO hay policy de SELECT para el dueño:
 *     lo propio se lee por RPC. Y como un `insert ... returning` exige pasar
 *     también la policy de lectura, un `insert().select()` desde acá falla
 *     con "new row violates row-level security policy", que no explica nada.
 *     Por eso el alta va por crear_solicitud_datos / crear_reporte_problema,
 *     que además devuelven el número que la pantalla muestra.
 *
 * 2 · LO QUE FALLA NO SIEMPRE ES UN ERROR. `ok:false` con un motivo es algo
 *     que la persona puede entender —ya pidió sus datos hace dos meses, el
 *     pedido no existe—. Los errores de verdad llegan como excepción.
 *
 * 3 · NADA DE DATOS DE OTROS. El detalle de una inscripción lo arma la base
 *     sin DNI, sin emails y sin teléfonos de terceros. Acá no se pide más.
 */

// ── Avisos ──────────────────────────────────────────────────────────────

const aviso = (donde: string, error: unknown) => {
    // Sólo el motivo. Una solicitud de datos lleva lo que la persona escribió
    // y un reporte puede llevar media pantalla: nada de eso va a la consola.
    const motivo = (error as { message?: string })?.message || String(error);
    console.error(`[miCuenta] ${donde}: ${motivo}`);
};

const BUCKET_CAPTURAS = 'reportes-capturas';
const CAPTURAS_PERMITIDAS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const CAPTURA_LIMITE = 5 * 1024 * 1024;

/**
 * La forma de todo lo que puede salir bien o mal.
 *
 * Interfaz y no unión discriminada a propósito: este tsconfig no tiene
 * `strict`, así que `if (!r.ok) return` no angosta el tipo y `r.datos` se
 * marcaría como error en la rama buena. Es la misma decisión que en
 * services/nocturnaEntrada.ts.
 */
export interface Resultado<T> {
    ok: boolean;
    datos?: T;
    motivo?: string;
    detalle?: string;
}

const falla = <T, >(motivo: string, detalle?: string): Resultado<T> => ({ ok: false, motivo, detalle });

/** Lo que devuelve una RPC que contesta {ok, …}. */
const deLaRpc = <T, >(data: any): Resultado<T> => {
    if (!data || typeof data !== 'object') return falla<T>('desconocido');
    if (data.ok === false) return { ok: false, motivo: data.motivo || 'desconocido', detalle: data.detalle };
    return { ok: true, datos: data as T };
};

// ════════════════════════════════════════════════════════════════════════
// MIS COMPRAS
// ════════════════════════════════════════════════════════════════════════

export type EstadoDePedido = 'Pagado' | 'Listo' | 'Retirado';

export interface LineaDePedido {
    nombre: string;
    tipo: string | null;
    talle: string | null;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
}

export interface CompraPropia {
    id: string;
    codigo: string;
    total: number;
    unidades: number;
    createdAt: string;
    listaAt: string | null;
    retiradaAt: string | null;
    estado: EstadoDePedido;
}

export interface DetalleDeCompra extends CompraPropia {
    lineas: LineaDePedido[];
}

/** La misma regla que estado_venta() en la base. */
export const estadoDePedido = (listaAt: string | null, retiradaAt: string | null): EstadoDePedido =>
    retiradaAt ? 'Retirado' : listaAt ? 'Listo' : 'Pagado';

const aCompra = (v: any): CompraPropia => ({
    id: v.id,
    codigo: v.codigo,
    total: Number(v.total) || 0,
    unidades: Number(v.unidades) || 0,
    createdAt: v.created_at,
    listaAt: v.lista_at ?? null,
    retiradaAt: v.retirada_at ?? null,
    estado: estadoDePedido(v.lista_at ?? null, v.retirada_at ?? null),
});

/**
 * Las compras propias. La RLS de ventas_voluntarios ya deja ver sólo las de
 * uno, así que acá no hace falta filtrar por user_id: si se filtrara y el id
 * viniera mal, la lista aparecería vacía sin que nadie sepa por qué.
 */
export const misCompras = async (): Promise<CompraPropia[]> => {
    try {
        const { data, error } = await supabase
            .from('ventas_voluntarios')
            .select('id, codigo, total, unidades, created_at, lista_at, retirada_at')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(aCompra);
    } catch (err) {
        aviso('misCompras', err);
        return [];
    }
};

export const detalleCompra = async (id: string): Promise<DetalleDeCompra | null> => {
    try {
        const { data, error } = await supabase
            .from('ventas_voluntarios')
            .select('id, codigo, total, unidades, created_at, lista_at, retirada_at, '
                + 'items:ventas_voluntarios_items(product_name, type, size, cantidad, precio_unitario, subtotal)')
            .eq('id', id)
            .maybeSingle();
        if (error) throw error;
        if (!data) return null;

        return {
            ...aCompra(data),
            lineas: ((data as any).items || []).map((l: any) => ({
                nombre: l.product_name,
                tipo: l.type ?? null,
                talle: l.size ?? null,
                cantidad: Number(l.cantidad) || 0,
                precioUnitario: Number(l.precio_unitario) || 0,
                subtotal: Number(l.subtotal) || 0,
            })),
        };
    } catch (err) {
        aviso('detalleCompra', err);
        return null;
    }
};

/**
 * El Punto marca un pedido listo o retirado.
 *
 * Es de /voluntarios y no de Mi cuenta, pero vive acá porque es la otra punta
 * de lo mismo: lo que esto marca es lo que la persona ve en su pedido.
 */
export const marcarVenta = async (
    id: string,
    estado: 'lista' | 'retirada',
): Promise<Resultado<{ estado: EstadoDePedido; lista_at: string | null; retirada_at: string | null }>> => {
    try {
        const { data, error } = await supabase.rpc('marcar_venta', { p_id: id, p_estado: estado });
        if (error) throw error;
        return deLaRpc(data);
    } catch (err) {
        aviso('marcarVenta', err);
        return falla('sin_conexion');
    }
};

// ════════════════════════════════════════════════════════════════════════
// MIS INSCRIPCIONES A EVENTOS
// ════════════════════════════════════════════════════════════════════════

export type EstadoDeInscripcion = 'proximo' | 'hoy' | 'pasado' | null;

export interface InscripcionPropia {
    id: string;
    evento: string;
    edicion: number;
    fecha: string | null;
    hora: string | null;
    adolescentes: number;
    estado: EstadoDeInscripcion;
}

export interface AdolescenteDeLaEntrada {
    /** Nombre de pila. La base no manda el apellido. */
    nombre: string;
    retiroTipo: string | null;
    /** "Juan P." cuando lo retira otra persona; null si no. */
    retira: string | null;
    acreditadoAt: string | null;
    retiradoAt: string | null;
    ausenteAt: string | null;
}

export interface DetalleDeInscripcion {
    id: string;
    codigoEntrada: string;
    evento: string;
    edicion: number;
    fecha: string | null;
    hora: string | null;
    estado: EstadoDeInscripcion;
    adulto: string;
    jovenes: AdolescenteDeLaEntrada[];
    faltaTelefonoDelAdulto: boolean;
    /** Nombres de pila de los que todavía no tienen teléfono. */
    jovenesSinTelefono: string[];
}

export const misInscripciones = async (): Promise<InscripcionPropia[]> => {
    try {
        const { data, error } = await supabase.rpc('mis_inscripciones_eventos');
        if (error) throw error;
        return (Array.isArray(data) ? data : []).map((i: any) => ({
            id: i.id,
            evento: i.evento,
            edicion: Number(i.edicion),
            fecha: i.fecha ?? null,
            hora: i.hora ?? null,
            adolescentes: Number(i.adolescentes) || 0,
            estado: (i.estado ?? null) as EstadoDeInscripcion,
        }));
    } catch (err) {
        aviso('misInscripciones', err);
        return [];
    }
};

export const detalleInscripcion = async (id: string): Promise<Resultado<DetalleDeInscripcion>> => {
    try {
        const { data, error } = await supabase.rpc('mi_inscripcion_detalle', { p_id: id });
        if (error) throw error;
        const r = deLaRpc<any>(data);
        if (!r.ok) return falla(r.motivo || 'no_existe');

        const d = r.datos;
        return {
            ok: true,
            datos: {
                id: d.id,
                codigoEntrada: d.codigo_entrada,
                evento: d.evento,
                edicion: Number(d.edicion),
                fecha: d.fecha ?? null,
                hora: d.hora ?? null,
                estado: (d.estado ?? null) as EstadoDeInscripcion,
                adulto: d.adulto,
                jovenes: (d.jovenes || []).map((j: any) => ({
                    nombre: j.nombre,
                    retiroTipo: j.retiro_tipo ?? null,
                    retira: j.retira ?? null,
                    acreditadoAt: j.acreditado_at ?? null,
                    retiradoAt: j.retirado_at ?? null,
                    ausenteAt: j.ausente_at ?? null,
                })),
                faltaTelefonoDelAdulto: !!d.faltantes?.adulto_telefono,
                jovenesSinTelefono: d.faltantes?.jovenes_sin_telefono || [],
            },
        };
    } catch (err) {
        aviso('detalleInscripcion', err);
        return falla('sin_conexion');
    }
};

// ════════════════════════════════════════════════════════════════════════
// SOLICITUDES DE DATOS (Ley 25.326)
// ════════════════════════════════════════════════════════════════════════

export type TipoDeSolicitud = 'acceso' | 'rectificacion' | 'supresion';
export type EstadoDeSolicitud = 'recibida' | 'en_curso' | 'resuelta';

export interface SolicitudPropia {
    id: string;
    /** Ya formateado por la base: "0042". */
    numero: string;
    tipo: TipoDeSolicitud;
    estado: EstadoDeSolicitud;
    mensaje: string | null;
    motivo: string | null;
    createdAt: string;
    resueltaAt: string | null;
}

export const misSolicitudes = async (): Promise<SolicitudPropia[]> => {
    try {
        const { data, error } = await supabase.rpc('mis_solicitudes_datos');
        if (error) throw error;
        return (Array.isArray(data) ? data : []).map((s: any) => ({
            id: s.id,
            numero: s.numero,
            tipo: s.tipo,
            estado: s.estado,
            mensaje: s.mensaje ?? null,
            motivo: s.motivo ?? null,
            createdAt: s.created_at,
            resueltaAt: s.resuelta_at ?? null,
        }));
    } catch (err) {
        aviso('misSolicitudes', err);
        return [];
    }
};

/**
 * Crea una solicitud y devuelve su número.
 *
 * `motivo: 'limite_6_meses'` trae en `detalle` la frase de la base, que está
 * escrita para mostrarse tal cual: dice desde cuándo se puede volver a pedir.
 */
export const crearSolicitudDatos = async (
    tipo: TipoDeSolicitud,
    mensaje?: string | null,
    motivo?: string | null,
): Promise<Resultado<{ id: string; numero: string }>> => {
    try {
        const { data, error } = await supabase.rpc('crear_solicitud_datos', {
            p_tipo: tipo,
            p_mensaje: mensaje ?? null,
            p_motivo: motivo ?? null,
        });
        if (error) throw error;
        return deLaRpc(data);
    } catch (err) {
        aviso('crearSolicitudDatos', err);
        return falla('sin_conexion');
    }
};

// ════════════════════════════════════════════════════════════════════════
// REPORTAR UN PROBLEMA
// ════════════════════════════════════════════════════════════════════════

export type EstadoDeReporte = 'nuevo' | 'visto' | 'resuelto';

export interface ReportePropio {
    id: string;
    numero: string;
    descripcion: string;
    pantalla: string | null;
    estado: EstadoDeReporte;
    createdAt: string;
}

export const misReportes = async (): Promise<ReportePropio[]> => {
    try {
        const { data, error } = await supabase.rpc('mis_reportes');
        if (error) throw error;
        return (Array.isArray(data) ? data : []).map((r: any) => ({
            id: r.id,
            numero: r.numero,
            descripcion: r.descripcion,
            pantalla: r.pantalla ?? null,
            estado: r.estado,
            createdAt: r.created_at,
        }));
    } catch (err) {
        aviso('misReportes', err);
        return [];
    }
};

/**
 * Sube la captura a la carpeta propia y devuelve su ruta.
 *
 * La carpeta tiene que ser `${uid}/`: lo exige la policy del bucket y lo
 * vuelve a comprobar la RPC. El nombre es un uuid y no el del archivo: un
 * nombre de archivo se ve en cualquier log y suele decir más de lo que parece
 * ("captura_pantalla_cuenta_bancaria.png").
 */
export const subirCapturaDeReporte = async (
    file: File,
    userId: string,
): Promise<Resultado<{ path: string }>> => {
    try {
        if (!file || file.size === 0) return falla('archivo_invalido');

        // No se exige que file.type empiece con "image/": en Android la
        // galería entrega el archivo sin tipo bastante seguido. Lo que decide
        // es si se puede decodificar, y de eso se encarga comprimirImagen.
        if (file.type && !file.type.startsWith('image/')) return falla('archivo_invalido');

        const subir = await comprimirImagen(file);
        if (!CAPTURAS_PERMITIDAS.includes(subir.type)) return falla('archivo_invalido');
        if (subir.size > CAPTURA_LIMITE) return falla('archivo_grande');

        const path = `${userId}/${safeUUID()}.jpg`;
        const { error } = await supabase.storage
            .from(BUCKET_CAPTURAS)
            .upload(path, subir, { contentType: subir.type, upsert: false });
        if (error) throw error;

        return { ok: true, datos: { path } };
    } catch (err) {
        aviso('subirCapturaDeReporte', err);
        return falla('sin_conexion');
    }
};

/**
 * Manda el reporte. La captura se sube antes, si hay.
 *
 * Si la captura falla, el reporte se manda igual y sin ella: lo que importa
 * es lo que la persona escribió, y perderlo por una foto que no subió sería
 * peor que no tener la foto.
 */
export const crearReporte = async (opciones: {
    descripcion: string;
    pantalla?: string | null;
    captura?: File | null;
    userId: string;
    versionApp?: string | null;
    dispositivo?: string | null;
}): Promise<Resultado<{ id: string; numero: string; sinCaptura?: boolean }>> => {
    const { descripcion, pantalla, captura, userId, versionApp, dispositivo } = opciones;
    let path: string | null = null;
    let sinCaptura = false;

    if (captura) {
        const subida = await subirCapturaDeReporte(captura, userId);
        if (subida.ok) path = subida.datos!.path;
        else sinCaptura = true;
    }

    try {
        const { data, error } = await supabase.rpc('crear_reporte_problema', {
            p_descripcion: descripcion,
            p_pantalla: pantalla ?? null,
            p_captura_path: path,
            p_version_app: versionApp ?? null,
            p_dispositivo: dispositivo ?? null,
        });
        if (error) throw error;
        const r = deLaRpc<{ id: string; numero: string }>(data);
        if (!r.ok) return r as Resultado<{ id: string; numero: string; sinCaptura?: boolean }>;
        return { ok: true, datos: { ...r.datos!, sinCaptura } };
    } catch (err) {
        aviso('crearReporte', err);
        return falla('sin_conexion');
    }
};

/** Lo que el navegador puede contar de sí mismo, para el reporte. */
export const describirDispositivo = (): string => {
    try {
        const ua = navigator.userAgent || '';
        const pantalla = `${window.screen?.width || 0}×${window.screen?.height || 0}`;
        return `${ua} · ${pantalla}`.slice(0, 200);
    } catch {
        return 'desconocido';
    }
};

// ════════════════════════════════════════════════════════════════════════
// LA BANDEJA DE SISTEMAS
// ════════════════════════════════════════════════════════════════════════

export interface SolicitudAdmin extends SolicitudPropia {
    userId: string;
    notaInterna: string | null;
    resueltaPor: string | null;
}

export interface ReporteAdmin extends ReportePropio {
    userId: string;
    capturaPath: string | null;
    versionApp: string | null;
    dispositivo: string | null;
    notaInterna: string | null;
}

/**
 * Las solicitudes, todas. La RLS ya exige SUPER_ADMIN: si quien mira no lo es,
 * vuelve vacío en vez de error, que es lo correcto —no hay nada que contarle.
 */
export const solicitudesAdmin = async (): Promise<SolicitudAdmin[]> => {
    try {
        const { data, error } = await supabase
            .from('solicitudes_datos')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map((s: any) => ({
            id: s.id,
            numero: String(s.numero).padStart(4, '0'),
            tipo: s.tipo,
            estado: s.estado,
            mensaje: s.mensaje ?? null,
            motivo: s.motivo ?? null,
            createdAt: s.created_at,
            resueltaAt: s.resuelta_at ?? null,
            userId: s.user_id,
            notaInterna: s.nota_interna ?? null,
            resueltaPor: s.resuelta_por ?? null,
        }));
    } catch (err) {
        aviso('solicitudesAdmin', err);
        return [];
    }
};

export const actualizarSolicitud = async (
    id: string,
    cambios: { estado?: EstadoDeSolicitud; notaInterna?: string | null },
    resueltaPor?: string,
): Promise<boolean> => {
    try {
        const fila: Record<string, unknown> = {};
        if (cambios.estado !== undefined) {
            fila.estado = cambios.estado;
            // Resolver deja fecha y firma; reabrir las borra, o quedarían
            // diciendo que se resolvió algo que sigue abierto.
            fila.resuelta_at = cambios.estado === 'resuelta' ? new Date().toISOString() : null;
            fila.resuelta_por = cambios.estado === 'resuelta' ? (resueltaPor ?? null) : null;
        }
        if (cambios.notaInterna !== undefined) fila.nota_interna = cambios.notaInterna;
        if (Object.keys(fila).length === 0) return true;

        const { error } = await supabase.from('solicitudes_datos').update(fila).eq('id', id);
        if (error) throw error;
        return true;
    } catch (err) {
        aviso('actualizarSolicitud', err);
        return false;
    }
};

export const reportesAdmin = async (): Promise<ReporteAdmin[]> => {
    try {
        const { data, error } = await supabase
            .from('reportes_problemas')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map((r: any) => ({
            id: r.id,
            numero: String(r.numero).padStart(4, '0'),
            descripcion: r.descripcion,
            pantalla: r.pantalla ?? null,
            estado: r.estado,
            createdAt: r.created_at,
            userId: r.user_id,
            capturaPath: r.captura_path ?? null,
            versionApp: r.version_app ?? null,
            dispositivo: r.dispositivo ?? null,
            notaInterna: r.nota_interna ?? null,
        }));
    } catch (err) {
        aviso('reportesAdmin', err);
        return [];
    }
};

export const actualizarReporte = async (
    id: string,
    cambios: { estado?: EstadoDeReporte; notaInterna?: string | null },
): Promise<boolean> => {
    try {
        const fila: Record<string, unknown> = {};
        if (cambios.estado !== undefined) fila.estado = cambios.estado;
        if (cambios.notaInterna !== undefined) fila.nota_interna = cambios.notaInterna;
        if (Object.keys(fila).length === 0) return true;

        const { error } = await supabase.from('reportes_problemas').update(fila).eq('id', id);
        if (error) throw error;
        return true;
    } catch (err) {
        aviso('actualizarReporte', err);
        return false;
    }
};

/** La captura, por 5 minutos. El bucket es privado: no hay URL pública. */
export const urlCapturaReporte = async (path: string): Promise<string | null> => {
    try {
        const { data, error } = await supabase.storage
            .from(BUCKET_CAPTURAS)
            .createSignedUrl(path, 300);
        if (error) throw error;
        return data?.signedUrl || null;
    } catch (err) {
        aviso('urlCapturaReporte', err);
        return null;
    }
};
