import { supabase } from './supabaseClient';
import { fechaCorta, horaCorta, limitesDelRango, type Rango, type ClaseDeProducto } from './reportesPuntoInfo';

/**
 * Reportar el stock del Punto.
 *
 * Al llegar al stand se cuenta lo que hay y se anota acá. Lo que no se
 * anota vale 0, salvo los tipos que se declaren no contados.
 *
 * Todo el trabajo lo hace la base, en la RPC registrar_reporte_stock: la
 * cuenta del "antes" tiene que leerse con los productos bloqueados, y los
 * movimientos y el stock nuevo tienen que entrar o no entrar juntos. Desde
 * acá sólo se manda el conteo y se traduce la respuesta.
 *
 * El id lo genera el cliente a propósito: si el envío se corta y se
 * reintenta, el segundo llega con el mismo id y la base avisa que ya estaba,
 * en vez de contar dos veces.
 */

// ── Tipos ───────────────────────────────────────────────────────────────

export interface ConteoDeProducto {
    code: string;
    /** Entre 1 y 9999. Lo que no se cuenta no se manda. */
    cantidad: number;
}

export type MotivoDeFalla = 'sin_permiso' | 'conteo_invalido' | 'red';

export interface ReporteGuardado {
    ok: true;
    /** true si ese id ya se había guardado: no se contó de nuevo. */
    repetido: boolean;
    totales: { ingresos: number; faltantes: number; cambios: number };
}

export interface ReporteRechazado {
    ok: false;
    motivo: MotivoDeFalla;
    /** Lo que dijo la base, para mostrar en pantalla cuando sirve. */
    detalle?: string;
}

export interface ReporteDeStock {
    id: string;
    /** El timestamp tal cual, para ordenar. */
    fecha: string;
    /** "14 oct 2026" y "09:35", en hora argentina. */
    fechaTexto: string;
    hora: string;
    autor: string | null;
    tiposOmitidos: ClaseDeProducto[];
    unidades: number;
    ingresos: number;
    faltantes: number;
    cambios: number;
    sinCambios: number;
}

export interface ItemDeReporte {
    productCode: string | null;
    productName: string | null;
    tipo: string | null;
    talle: string | null;
    antes: number;
    contado: number;
    diferencia: number;
}

export interface DetalleDeReporte {
    reporte: ReporteDeStock;
    items: ItemDeReporte[];
}

// ── Cuentas puras ───────────────────────────────────────────────────────

const ORDEN_TIPO: Record<string, number> = { Remeras: 0, Buzos: 1 };

/** Primero las remeras, después los buzos, y adentro del talle 1 al 10. */
export const ordenarItems = (items: ItemDeReporte[]): ItemDeReporte[] =>
    [...items].sort((a, b) => {
        const porTipo = (ORDEN_TIPO[a.tipo || ''] ?? 9) - (ORDEN_TIPO[b.tipo || ''] ?? 9);
        if (porTipo !== 0) return porTipo;
        return (parseInt(a.talle || '', 10) || 0) - (parseInt(b.talle || '', 10) || 0);
    });

/** De qué se queja la base, traducido a algo que la pantalla sepa mostrar. */
export const motivoDe = (mensaje: string): MotivoDeFalla => {
    if (mensaje.includes('sin_permiso')) return 'sin_permiso';
    if (mensaje.includes('conteo_invalido')) return 'conteo_invalido';
    return 'red';
};

// ── Consultas ───────────────────────────────────────────────────────────

const aviso = (donde: string, error: unknown) => {
    const motivo = (error as { message?: string })?.message || String(error);
    console.error(`[reportesDeStock] ${donde}: ${motivo}`);
};

interface ReporteCrudo {
    id: string;
    created_at: string;
    createdByName: string | null;
    tiposOmitidos: string[] | null;
    unidades: number | null;
    ingresos: number | null;
    faltantes: number | null;
    cambios: number | null;
    sinCambios: number | null;
}

const mapearReporte = (r: ReporteCrudo): ReporteDeStock => ({
    id: r.id,
    fecha: r.created_at,
    fechaTexto: fechaCorta(r.created_at),
    hora: horaCorta(r.created_at),
    autor: r.createdByName,
    tiposOmitidos: (r.tiposOmitidos || []) as ClaseDeProducto[],
    unidades: r.unidades ?? 0,
    ingresos: r.ingresos ?? 0,
    faltantes: r.faltantes ?? 0,
    cambios: r.cambios ?? 0,
    sinCambios: r.sinCambios ?? 0,
});

/**
 * Manda el conteo. Devuelve qué pasó, sin tirar: la pantalla tiene que
 * poder decir "no tenés permiso" o "revisá las cantidades" sin romperse.
 */
export const registrarReporteStock = async (
    { id, conteo, tiposOmitidos = [] }: { id: string; conteo: ConteoDeProducto[]; tiposOmitidos?: ClaseDeProducto[] },
): Promise<ReporteGuardado | ReporteRechazado> => {
    const { data, error } = await supabase.rpc('registrar_reporte_stock', {
        p_id: id,
        p_conteo: conteo,
        p_tipos_omitidos: tiposOmitidos,
    });

    if (error) {
        aviso('registrarReporteStock', error);
        return { ok: false, motivo: motivoDe(error.message || ''), detalle: error.message };
    }

    const r = (data || {}) as { ok?: boolean; repetido?: boolean; ingresos?: number; faltantes?: number; cambios?: number };
    if (!r.ok) {
        aviso('registrarReporteStock', 'la base no devolvió ok');
        return { ok: false, motivo: 'red' };
    }

    return {
        ok: true,
        repetido: r.repetido === true,
        totales: { ingresos: r.ingresos ?? 0, faltantes: r.faltantes ?? 0, cambios: r.cambios ?? 0 },
    };
};

/** Los reportes del período, del más nuevo al más viejo. */
export const getReportesDeStock = async (rango: Rango): Promise<ReporteDeStock[] | null> => {
    const { arranca, termina } = limitesDelRango(rango);
    const { data, error } = await supabase
        .from('stock_reports')
        .select('*')
        .gte('created_at', arranca)
        .lte('created_at', termina)
        .order('created_at', { ascending: false });

    if (error) { aviso('getReportesDeStock', error); return null; }
    return ((data || []) as ReporteCrudo[]).map(mapearReporte);
};

/**
 * Todos los ítems de varios reportes, para bajarlos juntos a Excel.
 *
 * Pide de a 1000 porque supabase-js corta ahí sin avisar, y un período con
 * muchos reportes son veinte filas por reporte.
 */
export const getItemsDeReportes = async (
    ids: string[],
): Promise<Array<ItemDeReporte & { reportId: string }> | null> => {
    if (ids.length === 0) return [];
    const PAGINA = 1000;
    const filas: Array<ItemDeReporte & { reportId: string }> = [];

    for (let desde = 0; ; desde += PAGINA) {
        const { data, error } = await supabase
            .from('stock_report_items')
            .select('*')
            .in('reportId', ids)
            .range(desde, desde + PAGINA - 1);
        if (error) { aviso('getItemsDeReportes', error); return null; }
        const lote = (data || []) as any[];
        lote.forEach(i => filas.push({
            reportId: i.reportId,
            productCode: i.productCode,
            productName: i.productName,
            tipo: i.type,
            talle: i.size,
            antes: i.antes ?? 0,
            contado: i.contado ?? 0,
            diferencia: i.diferencia ?? 0,
        }));
        if (lote.length < PAGINA) return filas;
    }
};

/** Un reporte con todo lo que se contó, ordenado como la pantalla lo muestra. */
export const getDetalleReporteStock = async (id: string): Promise<DetalleDeReporte | null> => {
    const [cabecera, items] = await Promise.all([
        supabase.from('stock_reports').select('*').eq('id', id).maybeSingle(),
        supabase.from('stock_report_items').select('*').eq('reportId', id),
    ]);

    if (cabecera.error) { aviso('getDetalleReporteStock', cabecera.error); return null; }
    if (items.error) { aviso('getDetalleReporteStock(items)', items.error); return null; }
    if (!cabecera.data) return null;

    const crudos = (items.data || []) as Array<{
        productCode: string | null; productName: string | null; type: string | null;
        size: string | null; antes: number | null; contado: number | null; diferencia: number | null;
    }>;

    return {
        reporte: mapearReporte(cabecera.data as ReporteCrudo),
        items: ordenarItems(crudos.map(i => ({
            productCode: i.productCode,
            productName: i.productName,
            tipo: i.type,
            talle: i.size,
            antes: i.antes ?? 0,
            contado: i.contado ?? 0,
            diferencia: i.diferencia ?? 0,
        }))),
    };
};
