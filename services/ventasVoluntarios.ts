import { supabase } from './supabaseClient';
import { comprimirImagen } from '../src/utils/nocturna';
import { safeUUID } from './uuidUtils';
import {
    fechaCorta, horaCorta, fechaYHora, limitesDelRango,
    type Rango, type ClaseDeProducto,
} from './reportesPuntoInfo';

/**
 * Comprar remeras y buzos del Punto desde /voluntarios.
 *
 * Cualquiera con sesión arma un pedido, lo paga con UNA transferencia y sube
 * el comprobante. No se mira el rol: el que compra es cualquiera, no el que
 * atiende el stand.
 *
 * Acá no se decide nada que valga plata. El precio, el total, el stock y el
 * código de la compra los pone la base, en registrar_venta_voluntario: si
 * esto mandara el total, cualquiera compraría un buzo a un peso editando el
 * pedido antes de enviarlo. Desde el cliente sólo se junta lo que la persona
 * eligió y se traduce la respuesta.
 *
 * El id de la compra lo genera el cliente a propósito, igual que en los
 * reportes de stock: si el envío se corta y se reintenta, el segundo llega
 * con el mismo id y la base devuelve la compra que ya había en vez de cobrar
 * dos veces.
 *
 * Las fechas se escriben en hora argentina con los helpers de
 * reportesPuntoInfo, que es donde vive esa regla para todo el Punto.
 */

// ── Tipos ───────────────────────────────────────────────────────────────

const BUCKET = 'voluntarios-comprobantes';
/** Lo mismo que acepta el bucket. Si no coinciden, Storage contesta 400. */
const PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
const LIMITE = 10 * 1024 * 1024;

/** Un talle con precio, para la pantalla. */
export interface TalleDisponible {
    code: string;
    /** '3', como lo guarda info_products. */
    size: string;
    precio: number;
}

export interface ClaseDelCatalogo {
    tipo: ClaseDeProducto;
    /** El precio de la clase. Si hay talles a distinto precio, el más bajo. */
    precio: number;
    /** Sólo los talles CON stock, del más chico al más grande. */
    talles: TalleDisponible[];
}

/** Un renglón del pedido, como lo arma la pantalla. */
export interface ItemDePedido {
    code: string;
    /** Entre 1 y 5. Lo vuelve a validar la base. */
    cantidad: number;
}

export interface PedidoDeVoluntario {
    /** Lo genera la pantalla una sola vez, para que el reintento no cobre dos veces. */
    id: string;
    items: ItemDePedido[];
    comprobantePath: string;
    /** Lo que la pantalla mostró. Si no coincide con la base, no se cobra. */
    totalEsperado: number;
    /** Sólo si la persona no tenía teléfono cargado. */
    telefono?: string;
    guardarTelefono?: boolean;
}

export type MotivoDeFalla =
    | 'sin_stock'
    | 'precio_cambio'
    | 'comprobante_invalido'
    | 'falta_telefono'
    | 'pedido_invalido'
    | 'red';

export interface TalleAgotado {
    code: string;
    type: ClaseDeProducto;
    size: string;
    disponible: number;
}

export type VentaRegistrada = {
    ok: true;
    /** true si ese id ya estaba guardado: no se cobró de nuevo. */
    repetido: boolean;
    id: string;
    codigo: string;
    total: number;
    unidades: number;
    createdAt: string;
};

export type VentaRechazada = {
    ok: false;
    motivo: MotivoDeFalla;
    /** Sólo en sin_stock: qué talle y cuánto queda. */
    items?: TalleAgotado[];
    /** Sólo en precio_cambio: el total que hay que transferir ahora. */
    total?: number;
};

export interface VentaDeVoluntario {
    id: string;
    codigo: string;
    /** El instante tal cual, para ordenar. */
    fecha: string;
    /** '14 oct 2026' y '09:35', en hora argentina. */
    fechaTexto: string;
    hora: string;
    userId: string;
    nombre: string | null;
    apellido: string | null;
    /** 'Carolina Méndez' o, si no quedó guardado, null. */
    nombreCompleto: string | null;
    telefono: string | null;
    email: string | null;
    total: number;
    unidades: number;
    comprobantePath: string;
    /** Cuando el Punto lo marco listo. null = todavia no. */
    listaAt: string | null;
    /** Cuando se lo llevaron. null = sigue en el Punto. */
    retiradaAt: string | null;
}

export interface ItemDeVenta {
    code: string;
    nombre: string | null;
    tipo: string | null;
    talle: string | null;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
}

export interface DetalleDeVenta {
    venta: VentaDeVoluntario;
    items: ItemDeVenta[];
}

// ── Avisos ──────────────────────────────────────────────────────────────

const aviso = (donde: string, error: unknown) => {
    // Sólo el motivo: un comprobante lleva nombre, CBU y monto, y una venta
    // lleva el teléfono de quien compró. Nada de eso va a la consola.
    const motivo = (error as { message?: string })?.message || String(error);
    console.error(`[ventasVoluntarios] ${donde}: ${motivo}`);
};

/** Lo que dijo la base, traducido a algo que la pantalla sepa mostrar. */
export const motivoDe = (mensaje: string): MotivoDeFalla => {
    if (mensaje.includes('comprobante_invalido')) return 'comprobante_invalido';
    if (mensaje.includes('falta_telefono')) return 'falta_telefono';
    if (mensaje.includes('pedido_invalido')) return 'pedido_invalido';
    // sin_sesion llega acá si la sesión venció entre que armó el pedido y
    // confirmó. Para la pantalla es lo mismo que un problema de red: volver
    // a intentar.
    return 'red';
};

// ── El comprobante ──────────────────────────────────────────────────────

/**
 * Sube el comprobante a la carpeta de quien compra.
 *
 * Las imágenes se comprimen como en Nocturna —una foto de celular pesa entre
 * 3 y 8 MB y el bucket corta en 10—; un PDF va tal cual, porque no hay nada
 * que achicar y rasterizarlo sería perder el original.
 *
 * La ruta es `${userId}/${uuid}.${ext}`: ni el nombre ni el DNI de nadie
 * viajan en el path. El nombre de un archivo se ve en cualquier log.
 */
export const subirComprobanteVoluntario = async (
    file: File,
    userId: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> => {
    const MAL_ARCHIVO = 'Ese archivo no se puede subir: tiene que ser una imagen o un PDF de hasta 10 MB.';

    try {
        if (!file || file.size === 0) return { ok: false, error: MAL_ARCHIVO };

        const esPdf = file.type === 'application/pdf'
            || (!file.type && /\.pdf$/i.test(file.name || ''));

        // No se exige que file.type empiece con "image/": en Android la
        // galería entrega el archivo SIN tipo bastante seguido, y ese chequeo
        // rechazaba capturas perfectamente válidas. Lo que decide es si se
        // puede decodificar, y de eso se encarga comprimirImagen.
        if (!esPdf && file.type && !file.type.startsWith('image/')) {
            return { ok: false, error: MAL_ARCHIVO };
        }

        const subir = esPdf ? file : await comprimirImagen(file);

        // comprimirImagen devuelve el original cuando no pudo decodificarlo:
        // ahí el tipo es el que vino, y puede no servir.
        if (!PERMITIDOS.includes(subir.type)) {
            aviso('subirComprobanteVoluntario(tipo)', `declarado=${file.type || 'vacío'} final=${subir.type || 'vacío'}`);
            return { ok: false, error: MAL_ARCHIVO };
        }

        if (subir.size > LIMITE) {
            return { ok: false, error: MAL_ARCHIVO };
        }

        const ext = subir.type === 'application/pdf' ? 'pdf'
            : subir.type === 'image/png' ? 'png'
                : subir.type === 'image/webp' ? 'webp'
                    : subir.type === 'image/heic' ? 'heic'
                        : 'jpg';

        // La carpeta tiene que ser la propia: así lo exige la policy del
        // bucket, y así la RPC comprueba que el comprobante es de quien compra.
        const path = `${userId}/${safeUUID()}.${ext}`;

        const { error } = await supabase.storage
            .from(BUCKET)
            .upload(path, subir, { contentType: subir.type, upsert: false });

        if (error) throw error;
        return { ok: true, path };
    } catch (err) {
        aviso('subirComprobanteVoluntario', err);
        return { ok: false, error: 'El comprobante no se pudo subir' };
    }
};

// ── La compra ───────────────────────────────────────────────────────────

/**
 * Registra la compra. Todo el trabajo lo hace la base.
 *
 * Lo que vuelve con `ok:false` no es un error: es algo que la persona puede
 * resolver mirando la pantalla —se agotó un talle, cambió el precio— y el
 * pedido y el comprobante siguen en pie. Los errores de verdad llegan como
 * excepción y se traducen con motivoDe.
 */
export const registrarVentaVoluntario = async (
    pedido: PedidoDeVoluntario,
): Promise<VentaRegistrada | VentaRechazada> => {
    try {
        const { data, error } = await supabase.rpc('registrar_venta_voluntario', {
            p_id: pedido.id,
            p_items: pedido.items,
            p_comprobante_path: pedido.comprobantePath,
            p_total_esperado: pedido.totalEsperado,
            p_telefono: pedido.telefono ?? null,
            p_guardar_telefono: pedido.guardarTelefono ?? false,
        });

        if (error) {
            aviso('registrarVentaVoluntario', error);
            return { ok: false, motivo: motivoDe(error.message || '') };
        }

        const r = (data || {}) as Record<string, any>;

        if (!r.ok) {
            return {
                ok: false,
                motivo: (r.motivo as MotivoDeFalla) || 'red',
                items: r.items as TalleAgotado[] | undefined,
                total: r.total !== undefined ? Number(r.total) : undefined,
            };
        }

        return {
            ok: true,
            repetido: !!r.repetido,
            id: String(r.id),
            codigo: String(r.codigo),
            total: Number(r.total),
            unidades: Number(r.unidades),
            createdAt: String(r.created_at),
        };
    } catch (err) {
        aviso('registrarVentaVoluntario', err);
        return { ok: false, motivo: 'red' };
    }
};

// ── El catálogo ─────────────────────────────────────────────────────────

interface ProductoCrudo {
    code: string;
    name: string;
    type: string;
    size: string;
    price: number | null;
    stock: number | null;
}

/**
 * Qué se puede comprar hoy.
 *
 * Devuelve SÓLO los talles con stock y NO devuelve cuánto hay. Dos razones:
 * un talle sin unidades no es una opción que haya que mostrar en gris, y
 * "quedan 2" apura a la gente sin necesidad. Si justo se agota mientras
 * alguien compra, la base lo frena con sin_stock, que es donde ese chequeo
 * sirve de verdad.
 */
export const getCatalogoVoluntarios = async (): Promise<ClaseDelCatalogo[] | null> => {
    const { data, error } = await supabase
        .from('info_products')
        .select('code, name, type, size, price, stock');

    if (error) { aviso('getCatalogoVoluntarios', error); return null; }

    const filas = (data || []) as ProductoCrudo[];
    const clases: ClaseDeProducto[] = ['Remeras', 'Buzos'];

    return clases.map(tipo => {
        const talles = filas
            .filter(p => p.type === tipo && (p.stock ?? 0) > 0)
            .map(p => ({ code: p.code, size: p.size, precio: Number(p.price ?? 0) }))
            // Por número, no por texto: así el 10 va después del 9 y no
            // entre el 1 y el 2.
            .sort((a, b) => (Number(a.size) || 0) - (Number(b.size) || 0));

        return {
            tipo,
            // Todos los talles de una clase valen lo mismo, pero si alguna vez
            // divergen, el más barato es el que no promete de menos.
            precio: talles.length ? Math.min(...talles.map(t => t.precio)) : 0,
            talles,
        };
    });
};

// ── Para el panel (prompt 3) ────────────────────────────────────────────

interface VentaCruda {
    id: string;
    codigo: string;
    user_id: string;
    nombre: string | null;
    apellido: string | null;
    telefono: string | null;
    email: string | null;
    total: number | null;
    unidades: number | null;
    comprobante_path: string;
    created_at: string;
}

const mapearVenta = (v: VentaCruda): VentaDeVoluntario => {
    const entero = [v.nombre, v.apellido].filter(Boolean).join(' ').trim();
    return {
        id: v.id,
        codigo: v.codigo,
        fecha: v.created_at,
        fechaTexto: fechaCorta(v.created_at),
        hora: horaCorta(v.created_at),
        userId: v.user_id,
        nombre: v.nombre,
        apellido: v.apellido,
        nombreCompleto: entero || null,
        telefono: v.telefono,
        email: v.email,
        total: Number(v.total ?? 0),
        unidades: Number(v.unidades ?? 0),
        comprobantePath: v.comprobante_path,
        listaAt: (v as any).lista_at ?? null,
        retiradaAt: (v as any).retirada_at ?? null,
    };
};

/**
 * Las compras del período, de la más nueva a la más vieja.
 *
 * De a mil, porque PostgREST corta ahí sin avisar —HTTP 206 y error null— y
 * un período largo pasa ese techo sin problema.
 */
export const getVentasVoluntarios = async (rango: Rango): Promise<VentaDeVoluntario[] | null> => {
    const { arranca, termina } = limitesDelRango(rango);
    const PAGINA = 1000;
    const filas: VentaCruda[] = [];

    for (let desde = 0; ; desde += PAGINA) {
        const { data, error } = await supabase
            .from('ventas_voluntarios')
            .select('*')
            .gte('created_at', arranca)
            .lte('created_at', termina)
            .order('created_at', { ascending: false })
            .range(desde, desde + PAGINA - 1);

        if (error) { aviso('getVentasVoluntarios', error); return null; }
        const lote = (data || []) as VentaCruda[];
        filas.push(...lote);
        if (lote.length < PAGINA) break;
    }

    return filas.map(mapearVenta);
};

/**
 * Las ventas de esta lista de ids.
 *
 * Para el historial de Movimientos del Punto, que tiene los movimientos pero
 * no sabe el codigo, quien compro ni el total: eso vive en la venta. De a
 * tandas porque `.in()` con mil ids arma una URL que el servidor rechaza.
 */
export const getVentasPorIds = async (ids: string[]): Promise<Map<string, VentaDeVoluntario>> => {
    const porId = new Map<string, VentaDeVoluntario>();
    const unicos = Array.from(new Set(ids.filter(Boolean)));
    if (unicos.length === 0) return porId;

    const TANDA = 200;
    for (let i = 0; i < unicos.length; i += TANDA) {
        const { data, error } = await supabase
            .from('ventas_voluntarios')
            .select('*')
            .in('id', unicos.slice(i, i + TANDA));
        if (error) { aviso('getVentasPorIds', error); return porId; }
        (data || []).forEach((v: any) => porId.set(v.id, mapearVenta(v as VentaCruda)));
    }
    return porId;
};

/** Una compra con sus renglones. */
export const getDetalleVenta = async (id: string): Promise<DetalleDeVenta | null> => {
    const [venta, items] = await Promise.all([
        supabase.from('ventas_voluntarios').select('*').eq('id', id).maybeSingle(),
        supabase.from('ventas_voluntarios_items').select('*').eq('venta_id', id),
    ]);

    if (venta.error) { aviso('getDetalleVenta', venta.error); return null; }
    if (items.error) { aviso('getDetalleVenta(items)', items.error); return null; }
    if (!venta.data) return null;

    const ORDEN: Record<string, number> = { Remeras: 0, Buzos: 1 };
    const renglones = ((items.data || []) as any[])
        .map(i => ({
            code: i.product_code,
            nombre: i.product_name,
            tipo: i.type,
            talle: i.size,
            cantidad: Number(i.cantidad ?? 0),
            precioUnitario: Number(i.precio_unitario ?? 0),
            subtotal: Number(i.subtotal ?? 0),
        }))
        // Primero las remeras, después los buzos, y adentro del 1 al 10:
        // el mismo orden que usa la ficha de los reportes de stock.
        .sort((a, b) => {
            const porTipo = (ORDEN[a.tipo || ''] ?? 9) - (ORDEN[b.tipo || ''] ?? 9);
            if (porTipo !== 0) return porTipo;
            return (Number(a.talle) || 0) - (Number(b.talle) || 0);
        });

    return { venta: mapearVenta(venta.data as VentaCruda), items: renglones };
};

/**
 * URL firmada para mirar un comprobante.
 *
 * Vence en 5 minutos: alcanza para abrirlo y no sobrevive a que el link
 * quede pegado en un chat. La policy del bucket ya limita quién puede pedirla.
 */
export const getComprobanteVentaUrl = async (path: string): Promise<string | null> => {
    try {
        const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
        if (error) throw error;
        return data?.signedUrl || null;
    } catch (err) {
        aviso('getComprobanteVentaUrl', err);
        return null;
    }
};

/** Reexportado para que las pantallas de /voluntarios no importen dos módulos. */
export { fechaYHora };
