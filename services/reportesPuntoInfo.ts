import { supabase } from './supabaseClient';

/**
 * Los datos del tablero de Reportes de Punto de Información.
 *
 * Tres pantallas comen de acá: el tablero (/reportes/puntoinfo) y los dos
 * detalles (bautismos y presentación de niños). Las consultas están separadas
 * de las cuentas a propósito: todo lo que calcula es una función pura, que se
 * puede probar sola y que las pantallas pueden volver a usar sin pedirle nada
 * a la base.
 *
 * Dos reglas que valen para todo el archivo:
 *
 *   · Las fechas se comparan en hora argentina. Un 'YYYY-MM-DD' metido en
 *     new Date() es medianoche UTC, que acá es el día anterior a las 21:00:
 *     por eso el rango se arma con el huso explícito (-03:00), que en
 *     Argentina no cambia en todo el año.
 *   · Cuando algo falla, se loguea el motivo SIN datos de la gente y se
 *     devuelve null. La pantalla muestra su estado de error; no inventa
 *     números ni muestra una lista a medias.
 */

// ── Tipos ───────────────────────────────────────────────────────────────

/** El período elegido, en 'YYYY-MM-DD' y hora argentina. */
export interface Rango { desde: string; hasta: string; }

export type TipoDeMovimiento = 'Entrada' | 'Salida' | 'Ajuste';
export type ClaseDeProducto = 'Remeras' | 'Buzos' | 'Remeras Servolución';

/** El orden de todo el Punto: remeras, buzos, Servolución. */
export const CLASES_DE_PRODUCTO: ClaseDeProducto[] = ['Remeras', 'Buzos', 'Remeras Servolución'];
export type TipoDeSolicitud = 'bautismos' | 'presentaciones';
export type EstadoDeSolicitud = 'Pendiente' | 'Realizado' | 'Cancelado';

/**
 * Un reporte de stock entra como una novedad sola, no como veinte ajustes.
 * Una venta por transferencia, igual: una compra de tres prendas son tres
 * Salidas y se leen como UNA venta.
 */
export type TipoDeNovedad = TipoDeMovimiento | 'Reporte' | 'Venta';

export interface Novedad {
    id: string;
    tipo: TipoDeNovedad;
    /** "Se ingresaron 12 remeras talle 2" · "Nuevo reporte de stock" */
    frase: string;
    /** Sólo en los reportes: "+8 ingresos · −3 faltantes". */
    detalle?: string;
    /** El timestamp tal como vino de la base. */
    fecha: string;
    /** "Hoy 18:40" · "Ayer 11:05" · "12 oct 20:15" */
    cuando: string;
    /**
     * Quién lo hizo, con nombre y apellido, si quedó guardado.
     *
     * Lo copia un disparador de la base en cada alta. Los movimientos
     * anteriores a ese disparador tienen null y no hay de dónde sacarlo:
     * la pantalla dice que no quedó registrado y no inventa un nombre.
     */
    autor: string | null;
    producto: ClaseDeProducto | null;
    talle: number | null;
    /** El reporte que la generó: la fila se puede tocar y abre su detalle. */
    reportId?: string | null;
    /** La venta que la generó: la fila se puede tocar y abre su detalle. */
    ventaId?: string | null;
}

/** Las cuentas del período que encabezan la lista completa de novedades. */
export interface TotalesDeNovedades {
    /** Filas de la lista: un reporte de stock cuenta UNA, no sus veinte ajustes. */
    novedades: number;
    /** Unidades que entraron, y en cuántos ingresos. */
    unidadesIngresadas: number;
    ingresos: number;
    /** Unidades que salieron, y en cuántas ventas. */
    unidadesVendidas: number;
    ventas: number;
    /** Correcciones a mano, sin contar las que vinieron de un reporte. */
    ediciones: number;
    /** Conteos del stand. */
    reportes: number;
    /** Compras de /voluntarios. Son aparte: no se cargan en el stand. */
    ventasPorTransferencia: number;
}

export interface NovedadesCompletas {
    /** De la más nueva a la más vieja, como en el tablero. */
    novedades: Novedad[];
    totales: TotalesDeNovedades;
}

export interface KpisPuntoInfo {
    remeras: { enStock: number; bajoMinimo: number };
    buzos: { enStock: number; bajoMinimo: number };
    servolucion: { enStock: number; bajoMinimo: number };
    /** Si hay algún talle de Servolución cargado: sin ninguno, la pantalla no la muestra. */
    hayServolucion: boolean;
    bautismos: { pendientes: number; diasDeEspera: number | null };
    presentaciones: { pendientes: number; diasDeEspera: number | null };
}

export interface FilaDeTalle {
    talle: number;
    /** Lo que hay hoy. No depende del período. */
    stock: number;
    /** El mínimo configurado para ese talle. */
    minimo: number;
    /** Suma de las Entradas del período. */
    ingresaron: number;
    /** Suma de las Salidas del período. */
    vendieron: number;
}

export interface InventarioDelPunto {
    remeras: FilaDeTalle[];
    buzos: FilaDeTalle[];
    servolucion: FilaDeTalle[];
    hayServolucion: boolean;
}

export interface PendienteDelPunto {
    id: string;
    /** "Camila Ferreyra" o, en presentaciones, el nombre del niño. */
    nombre: string;
    /** "Laura Vera y Martín Ferreyra". Sólo en presentaciones. */
    padres: string | null;
    telefono: string | null;
    /** Cuándo se anotó. Timestamp de la base. */
    solicitud: string;
}

export interface Pendientes {
    /** De la solicitud más vieja a la más nueva. */
    primeros4: PendienteDelPunto[];
    total: number;
    nuevasEnPeriodo: number;
}

export interface FilaDeDetalle {
    id: string;
    solicitud: string;
    nombre: string;
    apellido: string | null;
    nombreCompleto: string;
    madre: string | null;
    padre: string | null;
    telefono: string | null;
    email: string | null;
    /** Sólo presentaciones: el día agendado ('YYYY-MM-DD'). */
    agendada: string | null;
    /** Cuándo se hizo. Null si todavía no. */
    realizacion: string | null;
    estado: EstadoDeSolicitud;
    /** El criterio de la app: is_pending / isPending, no el status. */
    pendiente: boolean;
}

export interface Detalle {
    filas: FilaDeDetalle[];
    /** Realizados con fecha de realización dentro del período. */
    realizadosEnPeriodo: number;
    /** Pendientes de hoy. No depende del período. */
    pendientesHoy: number;
}

// ── Fechas, siempre en hora argentina ───────────────────────────────────

const HUSO = 'America/Argentina/Buenos_Aires';
/** Argentina no mueve el reloj: -03:00 todo el año. */
const DESFASE = '-03:00';
const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** El día argentino de un instante, como 'YYYY-MM-DD'. */
export const diaArgentino = (fecha: Date | string): string => {
    const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
    if (Number.isNaN(d.getTime())) return '';
    // 'en-CA' da justo 'YYYY-MM-DD', que es lo que se compara y se ordena.
    return new Intl.DateTimeFormat('en-CA', { timeZone: HUSO }).format(d);
};

/**
 * El rango como dos instantes: del primer segundo del día "desde" al último
 * del día "hasta", en hora argentina. Es lo que se le pasa a PostgREST.
 */
export const limitesDelRango = ({ desde, hasta }: Rango) => ({
    arranca: `${desde}T00:00:00.000${DESFASE}`,
    termina: `${hasta}T23:59:59.999${DESFASE}`,
});

/** ¿Ese instante cae dentro del período? */
export const estaEnElRango = (fecha: string | null | undefined, rango: Rango): boolean => {
    if (!fecha) return false;
    const dia = diaArgentino(fecha);
    return !!dia && dia >= rango.desde && dia <= rango.hasta;
};

/** "23 sep 2026" */
export const fechaCorta = (fecha: string | null | undefined): string => {
    if (!fecha) return '';
    const dia = diaArgentino(fecha);
    if (!dia) return '';
    const [a, m, d] = dia.split('-');
    return `${Number(d)} ${MES_CORTO[Number(m) - 1]} ${a}`;
};

/** "10:17", en 24 horas y hora argentina. */
export const horaCorta = (fecha: string | null | undefined): string => {
    if (!fecha) return '';
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('es-AR', {
        timeZone: HUSO, hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(d);
};

/** "23 sep 2026 · 10:17" */
export const fechaYHora = (fecha: string | null | undefined): string => {
    if (!fecha) return '';
    return `${fechaCorta(fecha)} · ${horaCorta(fecha)}`;
};

/** "Hoy 18:40" · "Ayer 11:05" · "12 oct 20:15" */
export const cuandoTexto = (fecha: string, ahora: Date = new Date()): string => {
    const dia = diaArgentino(fecha);
    const hoy = diaArgentino(ahora);
    const hora = horaCorta(fecha);
    if (dia === hoy) return `Hoy ${hora}`;
    if (dia === diaAnterior(hoy)) return `Ayer ${hora}`;
    const [, m, d] = dia.split('-');
    return `${Number(d)} ${MES_CORTO[Number(m) - 1]} ${hora}`;
};

/** El día anterior de un 'YYYY-MM-DD', sin pasar por husos. */
const diaAnterior = (dia: string): string => {
    const [a, m, d] = dia.split('-').map(Number);
    const x = new Date(Date.UTC(a, m - 1, d - 1));
    return x.toISOString().slice(0, 10);
};

/** "$ 68.000", como se escribe la plata en todo el Punto. */
const PESOS_AR = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
export const pesos = (n: number): string => `$ ${PESOS_AR.format(Math.round(n || 0))}`;

/** Cuántos días pasaron desde esa solicitud hasta hoy. */
export const diasDeEspera = (fecha: string | null | undefined, ahora: Date = new Date()): number | null => {
    if (!fecha) return null;
    const dia = diaArgentino(fecha);
    const hoy = diaArgentino(ahora);
    if (!dia || !hoy) return null;
    const aMs = (x: string) => Date.UTC(+x.slice(0, 4), +x.slice(5, 7) - 1, +x.slice(8, 10));
    return Math.max(0, Math.round((aMs(hoy) - aMs(dia)) / 86400000));
};

// ── Las frases de las novedades ─────────────────────────────────────────

const SINGULAR: Record<ClaseDeProducto, string> = { Remeras: 'remera', Buzos: 'buzo', 'Remeras Servolución': 'remera Servolución' };
const PLURAL: Record<ClaseDeProducto, string> = { Remeras: 'remeras', Buzos: 'buzos', 'Remeras Servolución': 'remeras Servolución' };
const ARTICULO: Record<ClaseDeProducto, string> = { Remeras: 'una', Buzos: 'un', 'Remeras Servolución': 'una' };

interface MovimientoCrudo {
    id: string;
    productCode: string | null;
    productName: string | null;
    type: string;
    quantity: number;
    date: string;
    createdByName?: string | null;
    previousStock?: number | null;
    reportId?: string | null;
    ventaId?: string | null;
}

/** Lo que se pide de ventas_voluntarios para armar la novedad. */
interface VentaCrudaMinima {
    id: string;
    codigo: string;
    nombre: string | null;
    apellido: string | null;
    total: number | null;
    created_at: string;
}

/** Lo que se pide de stock_reports para armar la novedad. */
interface ReporteCrudoMinimo {
    id: string;
    created_at: string;
    createdByName: string | null;
    ingresos: number | null;
    faltantes: number | null;
}

/**
 * La frase de una novedad, con la concordancia que pidió Ignacio:
 * "Se ingresó 1 remera talle 2" / "Se ingresaron 12 remeras talle 2",
 * "Se vendió una remera talle 3" / "Se vendieron 2 buzos talle 3".
 *
 * El ajuste dice en cuánto quedó y, si el movimiento guardó el "antes",
 * también de cuánto venía. Los movimientos viejos no lo tienen: ahí el
 * paréntesis no va, porque ese número no existe.
 */
export const fraseDeMovimiento = (
    tipo: TipoDeMovimiento,
    cantidad: number,
    producto: ClaseDeProducto | null,
    talle: number | null,
    stockAnterior?: number | null,
): string => {
    const clase = producto || 'Remeras';
    const sing = SINGULAR[clase];
    const plural = PLURAL[clase];
    const cola = talle ? ` talle ${talle}` : '';

    if (tipo === 'Entrada') {
        return cantidad === 1
            ? `Se ingresó 1 ${sing}${cola}`
            : `Se ingresaron ${cantidad} ${plural}${cola}`;
    }
    if (tipo === 'Salida') {
        return cantidad === 1
            ? `Se vendió ${ARTICULO[clase]} ${sing}${cola}`
            : `Se vendieron ${cantidad} ${plural}${cola}`;
    }
    const antes = stockAnterior === null || stockAnterior === undefined ? '' : ` (antes ${stockAnterior})`;
    return `Se editó el stock de ${plural}${cola}: quedó en ${cantidad}${antes}`;
};

/**
 * "2 remeras y 1 buzo" · "1 remera" · "2 remeras, 1 buzo"
 *
 * Agrupa por PRENDA y no por talle a propósito. Donde esto se lee —una
 * frase de novedad, una columna angosta de la planilla— la pregunta es
 * cuánto salió, no qué talles: los talles están en la ficha, que es donde
 * sirven. Con `y` arma la frase; con coma, la celda.
 */
export const resumenDePrendas = (
    prendas: { producto: ClaseDeProducto | null; cantidad: number }[],
    union: ' y ' | ', ' = ' y ',
): string => {
    const porClase = new Map<string, number>();
    prendas.forEach(p => {
        const clase = p.producto || 'Remeras';
        porClase.set(clase, (porClase.get(clase) || 0) + (p.cantidad || 0));
    });

    // En el orden de todo el resto del Punto.
    const partes = CLASES_DE_PRODUCTO
        .filter(c => (porClase.get(c) || 0) > 0)
        .map(c => {
            const n = porClase.get(c) as number;
            return `${n} ${n === 1 ? SINGULAR[c] : PLURAL[c]}`;
        });

    if (partes.length === 0) return 'sin prendas';
    if (partes.length === 1) return partes[0];
    return partes.slice(0, -1).join(', ') + union + partes[partes.length - 1];
};

/** "REMERAS-3" o "Remeras Talle 3" → 3. */
export const talleDe = (code: string | null, nombre: string | null): number | null => {
    const porNombre = /talle\s*(\d+)/i.exec(nombre || '');
    if (porNombre) return Number(porNombre[1]);
    const porCodigo = /-(\d+)\s*$/.exec(code || '');
    return porCodigo ? Number(porCodigo[1]) : null;
};

/** "REMERAS-3" o "Remeras Talle 3" → 'Remeras'. "SERVOLUCION-3" → 'Remeras Servolución'. */
export const claseDe = (code: string | null, nombre: string | null): ClaseDeProducto | null => {
    const texto = `${code || ''} ${nombre || ''}`.toLowerCase();
    // Antes que "remera": "Remeras Servolución" también dice remera.
    if (texto.includes('servoluci')) return 'Remeras Servolución';
    if (texto.includes('remera')) return 'Remeras';
    if (texto.includes('buzo')) return 'Buzos';
    return null;
};

// ── Teléfonos ───────────────────────────────────────────────────────────

/**
 * Para el botón de llamar. Cualquier cosa con dígitos sirve: el teléfono es
 * texto libre y marcar un número incompleto es problema del teléfono, no de
 * la pantalla.
 */
export const telParaLlamar = (tel: string | null | undefined): string | null => {
    const digitos = (tel || '').replace(/\D/g, '');
    if (digitos.length < 6) return null;
    return `tel:+${normalizarArgentino(digitos) || digitos}`;
};

/**
 * Para WhatsApp hace falta el número completo y bien formado: 549 + 10
 * dígitos. Si no llega a eso devuelve null y el botón no se muestra, que es
 * mejor que abrir un chat con un número que no existe.
 */
export const telParaWhatsApp = (tel: string | null | undefined): string | null => {
    const n = normalizarArgentino((tel || '').replace(/\D/g, ''));
    return n ? `https://wa.me/${n}` : null;
};

/**
 * Lleva lo que haya a 549 + 10 dígitos, que es como se escriben los móviles
 * argentinos afuera: saca el 0 de larga distancia y el 15, y agrega el 9 si
 * falta. Si después de eso no da, devuelve null.
 */
const normalizarArgentino = (digitos: string): string | null => {
    let n = digitos;
    if (n.startsWith('0054')) n = n.slice(4);
    if (n.startsWith('54')) n = n.slice(2);
    if (n.startsWith('9')) n = n.slice(1);
    if (n.startsWith('0')) n = n.slice(1);
    // El 15 va después del código de área: 11 15 5555 0000.
    const con15 = /^(\d{2,4})15(\d{6,8})$/.exec(n);
    if (con15) n = con15[1] + con15[2];
    return n.length === 10 ? `549${n}` : null;
};

// ── Consultas ───────────────────────────────────────────────────────────

const aviso = (donde: string, error: unknown) => {
    // Sólo el motivo: nunca filas, que llevan teléfonos y emails.
    const motivo = (error as { message?: string })?.message || String(error);
    console.error(`[reportesPuntoInfo] ${donde}: ${motivo}`);
};

/**
 * supabase-js corta en 1000 filas y no avisa (HTTP 206, error null). Esto
 * pide de a 1000 hasta que deja de venir una página llena.
 */
const traerTodo = async <T>(
    tabla: string,
    orden: { columna: string; ascendente: boolean },
): Promise<T[] | null> => {
    const PAGINA = 1000;
    const filas: T[] = [];
    for (let desde = 0; ; desde += PAGINA) {
        const { data, error } = await supabase
            .from(tabla)
            .select('*')
            .order(orden.columna, { ascending: orden.ascendente })
            .range(desde, desde + PAGINA - 1);
        if (error) { aviso(`traerTodo(${tabla})`, error); return null; }
        const lote = (data || []) as T[];
        filas.push(...lote);
        if (lote.length < PAGINA) return filas;
    }
};

interface ProductoCrudo {
    code: string;
    name: string;
    type: string;
    size: string;
    stock: number | null;
    minStock: number | null;
}

/**
 * Cuántos movimientos se piden para quedarse con las 3 novedades.
 *
 * Un reporte de stock puede traer veinte ajustes y entrar como UNA novedad:
 * si se pidieran sólo 3 movimientos, un reporte se comería la tarjeta entera
 * y taparía lo que pasó después.
 */
const MOVIMIENTOS_PARA_NOVEDADES = 30;

/**
 * Las cabeceras de los reportes que tocaron estos movimientos.
 *
 * Los totales de un reporte salen de stock_reports, que es donde los dejó la
 * RPC: son los de verdad y además traen el nombre de quien contó.
 *
 * Devuelve null sólo si la consulta falló. Un mapa vacío es un período sin
 * reportes, que es normal.
 */
const pedirCabeceras = async (
    movimientos: MovimientoCrudo[],
    donde: string,
): Promise<Map<string, ReporteCrudoMinimo> | null> => {
    const ids = Array.from(new Set(
        movimientos.map(m => m.reportId).filter((x): x is string => !!x),
    ));
    const cabeceras = new Map<string, ReporteCrudoMinimo>();
    if (ids.length === 0) return cabeceras;

    // `.in()` con mil ids arma una URL que el servidor rechaza, así que va
    // de a tandas.
    const TANDA = 200;
    for (let i = 0; i < ids.length; i += TANDA) {
        const { data, error } = await supabase
            .from('stock_reports')
            .select('id, created_at, createdByName, ingresos, faltantes')
            .in('id', ids.slice(i, i + TANDA));
        if (error) { aviso(`${donde}(reportes)`, error); return null; }
        (data || []).forEach((r: any) => cabeceras.set(r.id, r));
    }
    return cabeceras;
};

/**
 * Las cabeceras de las ventas que tocaron estos movimientos.
 *
 * El código, quién compró y cuánto pagó viven en ventas_voluntarios: el
 * movimiento solo sabe que salió una prenda.
 */
const pedirVentas = async (
    movimientos: MovimientoCrudo[],
    donde: string,
): Promise<Map<string, VentaCrudaMinima> | null> => {
    const ids = Array.from(new Set(
        movimientos.map(m => m.ventaId).filter((x): x is string => !!x),
    ));
    const ventas = new Map<string, VentaCrudaMinima>();
    if (ids.length === 0) return ventas;

    const TANDA = 200;
    for (let i = 0; i < ids.length; i += TANDA) {
        const { data, error } = await supabase
            .from('ventas_voluntarios')
            .select('id, codigo, nombre, apellido, total, created_at')
            .in('id', ids.slice(i, i + TANDA));
        if (error) { aviso(`${donde}(ventas)`, error); return null; }
        (data || []).forEach((v: any) => ventas.set(v.id, v));
    }
    return ventas;
};

/**
 * De movimientos crudos a las filas que se leen en pantalla.
 *
 * Lo usan las DOS pantallas —la tarjeta del tablero y la lista completa—
 * para que la misma venta se lea con la misma frase en las dos. Es pura: no
 * toca la base.
 */
const armarNovedades = (
    movimientos: MovimientoCrudo[],
    catalogo: Pick<ProductoCrudo, 'code' | 'type' | 'size'>[],
    cabeceras: Map<string, ReporteCrudoMinimo>,
    ventas: Map<string, VentaCrudaMinima>,
): Novedad[] => {
    const porCodigo = new Map(catalogo.map(p => [p.code, p] as const));
    const novedades: Novedad[] = [];
    const yaPuesto = new Set<string>();

    /** Qué clase de prenda es un movimiento, con el catálogo o con el nombre. */
    const claseDelMovimiento = (m: MovimientoCrudo): ClaseDeProducto | null => {
        const p = m.productCode ? porCodigo.get(m.productCode) : null;
        return (p?.type as ClaseDeProducto) || claseDe(m.productCode, m.productName);
    };

    movimientos.forEach(m => {
        // ── Una compra entera, en una sola línea ──
        if (m.ventaId) {
            if (yaPuesto.has(m.ventaId)) return;
            yaPuesto.add(m.ventaId);
            const v = ventas.get(m.ventaId);

            // Las prendas salen de los movimientos de ESA venta: cada uno es
            // una Salida con su cantidad. No hace falta pedirle los ítems a
            // la base para escribir la frase.
            const prendas = movimientos
                .filter(x => x.ventaId === m.ventaId)
                .map(x => ({ producto: claseDelMovimiento(x), cantidad: x.quantity }));

            const quien = [v?.nombre, v?.apellido].filter(Boolean).join(' ').trim();
            const fecha = v?.created_at || m.date;
            novedades.push({
                id: `venta-${m.ventaId}`,
                tipo: 'Venta',
                frase: `Venta por transferencia: ${resumenDePrendas(prendas)}`,
                detalle: [quien || null, v ? pesos(v.total ?? 0) : null].filter(Boolean).join(' · ') || undefined,
                fecha,
                cuando: cuandoTexto(fecha),
                // Quién la cargó es el disparador de la base, que para una
                // compra es quien compró: ya está en el detalle.
                autor: null,
                producto: null,
                talle: null,
                ventaId: m.ventaId,
            });
            return;
        }

        // ── Un reporte entero, en una sola línea ──
        if (m.reportId) {
            if (yaPuesto.has(m.reportId)) return;
            yaPuesto.add(m.reportId);
            const r = cabeceras.get(m.reportId);
            const ingresos = r ? (r.ingresos ?? 0) : 0;
            const faltantes = r ? (r.faltantes ?? 0) : 0;
            // La fecha del reporte, no la del movimiento que lo trajo: los
            // movimientos de un reporte comparten el instante igual.
            const fecha = r?.created_at || m.date;
            novedades.push({
                id: `reporte-${m.reportId}`,
                tipo: 'Reporte',
                frase: 'Nuevo reporte de stock',
                detalle: `+${ingresos} ingresos · −${faltantes} faltantes`,
                fecha,
                cuando: cuandoTexto(fecha),
                autor: (r?.createdByName) || m.createdByName || null,
                producto: null,
                talle: null,
                reportId: m.reportId,
            });
            return;
        }

        // ── Un movimiento suelto, como siempre ──
        const p = m.productCode ? porCodigo.get(m.productCode) : null;
        const producto = (p?.type as ClaseDeProducto) || claseDe(m.productCode, m.productName);
        const talle = p?.size ? Number(p.size) : talleDe(m.productCode, m.productName);
        const tipo = m.type as TipoDeMovimiento;
        novedades.push({
            id: m.id,
            tipo,
            frase: fraseDeMovimiento(tipo, m.quantity, producto, talle, m.previousStock),
            fecha: m.date,
            cuando: cuandoTexto(m.date),
            autor: m.createdByName || null,
            producto,
            talle,
        });
    });

    // Ya vienen del más nuevo al más viejo; agrupar no cambia ese orden.
    return novedades;
};

export const getNovedades = async (rango: Rango): Promise<Novedad[] | null> => {
    const { arranca, termina } = limitesDelRango(rango);

    const [movs, prods] = await Promise.all([
        supabase.from('movements').select('*').gte('date', arranca).lte('date', termina)
            .order('date', { ascending: false }).limit(MOVIMIENTOS_PARA_NOVEDADES),
        supabase.from('info_products').select('code, type, size'),
    ]);

    if (movs.error) { aviso('getNovedades', movs.error); return null; }
    if (prods.error) { aviso('getNovedades(productos)', prods.error); return null; }

    // El Promise.all mezcla dos consultas distintas y TypeScript afloja el
    // tipo de las filas: se nombra acá, una vez.
    const catalogo = (prods.data || []) as Pick<ProductoCrudo, 'code' | 'type' | 'size'>[];
    const movimientos = (movs.data || []) as MovimientoCrudo[];

    const [cabeceras, ventas] = await Promise.all([
        pedirCabeceras(movimientos, 'getNovedades'),
        pedirVentas(movimientos, 'getNovedades'),
    ]);
    if (!cabeceras || !ventas) return null;

    return armarNovedades(movimientos, catalogo, cabeceras, ventas).slice(0, 3);
};

/**
 * TODAS las novedades del período, para /reportes/puntoinfo/novedades.
 *
 * Acá no hay límite de 30: la pantalla es justamente la lista entera. Los
 * movimientos se piden de a mil porque PostgREST corta ahí sin avisar
 * —HTTP 206 y error null—, y un período largo pasa ese techo sin problema.
 *
 * Los totales se cuentan sobre los movimientos y no sobre las filas: un
 * reporte de stock es UNA fila pero puede traer veinte ajustes, y sumar esos
 * ajustes como "ediciones a mano" diría algo que no pasó.
 */
export const getNovedadesCompletas = async (rango: Rango): Promise<NovedadesCompletas | null> => {
    const { arranca, termina } = limitesDelRango(rango);

    const PAGINA = 1000;
    const movimientos: MovimientoCrudo[] = [];
    for (let desde = 0; ; desde += PAGINA) {
        const { data, error } = await supabase
            .from('movements').select('*')
            .gte('date', arranca).lte('date', termina)
            .order('date', { ascending: false })
            .range(desde, desde + PAGINA - 1);
        if (error) { aviso('getNovedadesCompletas', error); return null; }
        const lote = (data || []) as MovimientoCrudo[];
        movimientos.push(...lote);
        if (lote.length < PAGINA) break;
    }

    const prods = await supabase.from('info_products').select('code, type, size');
    if (prods.error) { aviso('getNovedadesCompletas(productos)', prods.error); return null; }
    const catalogo = (prods.data || []) as Pick<ProductoCrudo, 'code' | 'type' | 'size'>[];

    const [cabeceras, ventas] = await Promise.all([
        pedirCabeceras(movimientos, 'getNovedadesCompletas'),
        pedirVentas(movimientos, 'getNovedadesCompletas'),
    ]);
    if (!cabeceras || !ventas) return null;

    const novedades = armarNovedades(movimientos, catalogo, cabeceras, ventas);

    // Los sueltos: lo que vino de un reporte o de una venta ya está contado
    // en su reporte o en su venta.
    const sueltos = movimientos.filter(m => !m.reportId && !m.ventaId);
    const deTipo = (t: TipoDeMovimiento) => sueltos.filter(m => m.type === t);
    const entradas = deTipo('Entrada');
    const salidas = deTipo('Salida');
    const unidades = (ms: MovimientoCrudo[]) => ms.reduce((n, m) => n + (m.quantity || 0), 0);

    return {
        novedades,
        totales: {
            novedades: novedades.length,
            unidadesIngresadas: unidades(entradas),
            ingresos: entradas.length,
            unidadesVendidas: unidades(salidas),
            ventas: salidas.length,
            ediciones: deTipo('Ajuste').length,
            reportes: novedades.filter(n => n.tipo === 'Reporte').length,
            ventasPorTransferencia: novedades.filter(n => n.tipo === 'Venta').length,
        },
    };
};

/**
 * Los números de arriba. NO dependen del período: son el estado de hoy, y
 * por eso la pantalla los pide una sola vez.
 */
export const getKpisPuntoInfo = async (): Promise<KpisPuntoInfo | null> => {
    const [prods, bauts, press] = await Promise.all([
        supabase.from('info_products').select('type, stock, minStock'),
        supabase.from('baptisms').select('registration_date, is_pending').eq('is_pending', 1),
        supabase.from('presentations').select('created_at, isPending').eq('isPending', 1),
    ]);

    if (prods.error) { aviso('getKpisPuntoInfo(productos)', prods.error); return null; }
    if (bauts.error) { aviso('getKpisPuntoInfo(bautismos)', bauts.error); return null; }
    if (press.error) { aviso('getKpisPuntoInfo(presentaciones)', press.error); return null; }

    const resumen = (clase: ClaseDeProducto) => {
        const lista = (prods.data || []).filter(p => p.type === clase);
        return {
            enStock: lista.reduce((n, p) => n + (p.stock ?? 0), 0),
            // El mismo criterio con el que avisa el Inventario del panel.
            bajoMinimo: lista.filter(p => (p.stock ?? 0) <= (p.minStock ?? 0)).length,
        };
    };

    const masVieja = (fechas: (string | null | undefined)[]) => {
        const validas = fechas.filter(Boolean).sort() as string[];
        return validas.length ? diasDeEspera(validas[0]) : null;
    };

    return {
        remeras: resumen('Remeras'),
        buzos: resumen('Buzos'),
        servolucion: resumen('Remeras Servolución'),
        hayServolucion: (prods.data || []).some(p => p.type === 'Remeras Servolución'),
        bautismos: {
            pendientes: (bauts.data || []).length,
            diasDeEspera: masVieja((bauts.data || []).map(b => b.registration_date)),
        },
        presentaciones: {
            pendientes: (press.data || []).length,
            diasDeEspera: masVieja((press.data || []).map(p => p.created_at)),
        },
    };
};

/**
 * Arma las diez filas de un tipo. Función pura: se le dan los productos y
 * los movimientos del período y devuelve la tabla.
 *
 * Siempre del talle 1 al 10, exista o no el producto: una fila que falta se
 * lee como un error de carga, y un cero se lee como un cero.
 *
 * Los Ajustes no suman: un ajuste no es una entrada ni una venta, es una
 * corrección de lo que había.
 */
export const armarFilasDeTalle = (
    clase: ClaseDeProducto,
    productos: ProductoCrudo[],
    movimientos: MovimientoCrudo[],
): FilaDeTalle[] => {
    const porTalle = new Map<number, ProductoCrudo>();
    productos.filter(p => p.type === clase).forEach(p => {
        const t = Number(p.size);
        if (t >= 1 && t <= 10) porTalle.set(t, p);
    });

    const ingresaron = new Map<number, number>();
    const vendieron = new Map<number, number>();
    movimientos.forEach(m => {
        const p = m.productCode ? productos.find(x => x.code === m.productCode) : null;
        const suClase = (p?.type as ClaseDeProducto) || claseDe(m.productCode, m.productName);
        if (suClase !== clase) return;
        const talle = p?.size ? Number(p.size) : talleDe(m.productCode, m.productName);
        if (!talle || talle < 1 || talle > 10) return;
        const bolsa = m.type === 'Entrada' ? ingresaron : m.type === 'Salida' ? vendieron : null;
        if (bolsa) bolsa.set(talle, (bolsa.get(talle) || 0) + m.quantity);
    });

    return Array.from({ length: 10 }, (_, i) => {
        const talle = i + 1;
        const p = porTalle.get(talle);
        return {
            talle,
            stock: p?.stock ?? 0,
            minimo: p?.minStock ?? 0,
            ingresaron: ingresaron.get(talle) || 0,
            vendieron: vendieron.get(talle) || 0,
        };
    });
};

export const getInventarioPuntoInfo = async (rango: Rango): Promise<InventarioDelPunto | null> => {
    const { arranca, termina } = limitesDelRango(rango);

    const [prods, movs] = await Promise.all([
        supabase.from('info_products').select('code, name, type, size, stock, minStock'),
        supabase.from('movements').select('*').gte('date', arranca).lte('date', termina),
    ]);

    if (prods.error) { aviso('getInventarioPuntoInfo(productos)', prods.error); return null; }
    if (movs.error) { aviso('getInventarioPuntoInfo(movimientos)', movs.error); return null; }

    const productos = (prods.data || []) as ProductoCrudo[];
    const movimientos = (movs.data || []) as MovimientoCrudo[];

    return {
        remeras: armarFilasDeTalle('Remeras', productos, movimientos),
        buzos: armarFilasDeTalle('Buzos', productos, movimientos),
        servolucion: armarFilasDeTalle('Remeras Servolución', productos, movimientos),
        hayServolucion: productos.some(p => p.type === 'Remeras Servolución'),
    };
};

/** Los días del período que tuvieron movimientos, para los puntitos del calendario. */
export const getDiasConMovimiento = async (rango: Rango): Promise<Map<string, number> | null> => {
    const { arranca, termina } = limitesDelRango(rango);
    const { data, error } = await supabase
        .from('movements').select('date').gte('date', arranca).lte('date', termina);
    if (error) { aviso('getDiasConMovimiento', error); return null; }

    const porDia = new Map<string, number>();
    (data || []).forEach(m => {
        const dia = diaArgentino(m.date);
        if (dia) porDia.set(dia, (porDia.get(dia) || 0) + 1);
    });
    return porDia;
};

interface BautismoCrudo {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string | null;
    registration_date: string | null;
    completion_date: string | null;
    is_pending: number | null;
    status: string | null;
}

interface PresentacionCruda {
    id: string;
    childName: string;
    childSurname: string;
    motherName: string | null;
    motherSurname: string | null;
    fatherName: string | null;
    fatherSurname: string | null;
    email: string | null;
    phone: string | null;
    scheduledDate: string | null;
    completionDate: string | null;
    isPending: number | null;
    status: string | null;
    created_at: string | null;
}

const nombreCompleto = (nombre?: string | null, apellido?: string | null) =>
    [nombre, apellido].filter(Boolean).join(' ').trim();

/**
 * "Pendiente" es lo que mira la app, no el status: las dos pantallas del
 * panel (Bautismos.tsx y PresentacionNinos.tsx) filtran por isPending. Hoy
 * las dos columnas coinciden en todas las filas; si alguna vez dejan de
 * coincidir, el reporte y el panel van a decir lo mismo.
 */
const esPendiente = (valor: number | null | undefined) => valor === 1;

const estadoDe = (status: string | null | undefined): EstadoDeSolicitud => {
    if (status === 'Realizado' || status === 'Cancelado') return status;
    return 'Pendiente';
};

const filaDeBautismo = (b: BautismoCrudo): FilaDeDetalle => ({
    id: b.id,
    solicitud: b.registration_date || '',
    nombre: b.first_name,
    apellido: b.last_name,
    nombreCompleto: nombreCompleto(b.first_name, b.last_name),
    madre: null,
    padre: null,
    telefono: b.phone,
    email: b.email,
    agendada: null,
    realizacion: b.completion_date,
    estado: estadoDe(b.status),
    pendiente: esPendiente(b.is_pending),
});

const filaDePresentacion = (p: PresentacionCruda): FilaDeDetalle => {
    const madre = nombreCompleto(p.motherName, p.motherSurname) || null;
    const padre = nombreCompleto(p.fatherName, p.fatherSurname) || null;
    return {
        id: p.id,
        solicitud: p.created_at || '',
        nombre: p.childName,
        apellido: p.childSurname,
        nombreCompleto: nombreCompleto(p.childName, p.childSurname),
        madre,
        padre,
        telefono: p.phone,
        email: p.email,
        agendada: p.scheduledDate,
        // Las presentaciones viejas pueden tener el status en 'Realizado' sin
        // completionDate: ahí vale el día agendado, que es cuando se hizo.
        realizacion: p.completionDate || (estadoDe(p.status) === 'Realizado' ? p.scheduledDate : null),
        estado: estadoDe(p.status),
        pendiente: esPendiente(p.isPending),
    };
};

/** Todas las filas de un tipo, ya mapeadas y paginadas. */
const traerSolicitudes = async (tipo: TipoDeSolicitud): Promise<FilaDeDetalle[] | null> => {
    if (tipo === 'bautismos') {
        const filas = await traerTodo<BautismoCrudo>('baptisms', { columna: 'registration_date', ascendente: false });
        return filas ? filas.map(filaDeBautismo) : null;
    }
    const filas = await traerTodo<PresentacionCruda>('presentations', { columna: 'created_at', ascendente: false });
    return filas ? filas.map(filaDePresentacion) : null;
};

/** Los que están esperando, con los cuatro que más esperan adelante. */
export const getPendientes = async (tipo: TipoDeSolicitud, rango: Rango): Promise<Pendientes | null> => {
    const filas = await traerSolicitudes(tipo);
    if (!filas) return null;

    const pendientes = filas
        .filter(f => f.pendiente)
        .sort((a, b) => a.solicitud.localeCompare(b.solicitud));

    return {
        primeros4: pendientes.slice(0, 4).map(f => ({
            id: f.id,
            nombre: f.nombreCompleto,
            padres: tipo === 'presentaciones'
                ? ([f.madre, f.padre].filter(Boolean).join(' y ') || null)
                : null,
            telefono: f.telefono,
            solicitud: f.solicitud,
        })),
        total: pendientes.length,
        nuevasEnPeriodo: filas.filter(f => estaEnElRango(f.solicitud, rango)).length,
    };
};

/**
 * La tabla del detalle: los pendientes de hoy —todos, sin importar el
 * período— más lo que pasó dentro del período, que es lo que dibuja el
 * diseño. Ordenada de la solicitud más nueva a la más vieja.
 */
export const getDetalle = async (tipo: TipoDeSolicitud, rango: Rango): Promise<Detalle | null> => {
    const filas = await traerSolicitudes(tipo);
    if (!filas) return null;

    const delPeriodo = filas.filter(f =>
        f.pendiente
        || estaEnElRango(f.solicitud, rango)
        || estaEnElRango(f.realizacion, rango));

    return {
        filas: delPeriodo.sort((a, b) => b.solicitud.localeCompare(a.solicitud)),
        realizadosEnPeriodo: filas.filter(f =>
            f.estado === 'Realizado' && estaEnElRango(f.realizacion, rango)).length,
        pendientesHoy: filas.filter(f => f.pendiente).length,
    };
};
