import { supabase } from './supabaseClient';
import { supabaseService } from './supabaseService';
import { NocturnaInscripcion, NocturnaJoven } from '../types';

/**
 * Los datos del tablero de Reportes de Nocturna (/panel-eventos/nocturna/reportes).
 *
 * Mismo reparto que services/reportesPuntoInfo.ts: una sola función habla con
 * la base y todo lo que cuenta es una función pura que recibe esa base. Así
 * los números se pueden revisar sin conexión y la pantalla no calcula nada.
 *
 * Tres reglas que valen para todo el archivo:
 *
 *   · Sólo lee. No hay un solo INSERT, UPDATE ni RPC de escritura acá: quien
 *     acredita es el escáner (pages/eventos/nocturna/AcreditarNocturna.tsx) y
 *     este tablero mira lo que ese escáner dejó.
 *   · Las horas son de Buenos Aires. La ventana de la noche se declara con el
 *     huso explícito (-03:00), que en Argentina no cambia en el año, y los
 *     rótulos del eje salen del número de minuto con el huso puesto a mano:
 *     el tablero dice lo mismo abierto desde cualquier parte.
 *   · Si la consulta falla se devuelve null y se loguea el motivo SIN datos de
 *     la gente. La pantalla muestra su estado de error; no inventa números.
 */

// ── La noche ────────────────────────────────────────────────────────────

/**
 * La ventana del gráfico por minuto: de las 22:00 del 30 de octubre a las
 * 07:00 del 31. Son las dos únicas fechas del evento que vive en este archivo.
 *
 * PARA LA PRÓXIMA EDICIÓN: cambiar estas dos líneas y nada más. Todo lo demás
 * —los 540 minutos, los rótulos cada 30, la nota de lo que cayó afuera— sale
 * de ellas. La fecha del evento para la edad está aparte, en
 * src/utils/nocturna.ts (FECHA_DEL_EVENTO), porque esa la valida también la
 * base en sql/nocturna_fecha_de_corte.sql.
 */
export const VENTANA_INICIO = '2026-10-30T22:00:00-03:00';
export const VENTANA_FIN = '2026-10-31T07:00:00-03:00';

const MS_POR_MINUTO = 60_000;

/** 540 con la ventana de arriba. Sale de las constantes, no escrito a mano. */
export const MINUTOS_DE_LA_VENTANA = Math.round(
    (Date.parse(VENTANA_FIN) - Date.parse(VENTANA_INICIO)) / MS_POR_MINUTO,
);

// ── Tipos ───────────────────────────────────────────────────────────────

/** Lo que trae una sola consulta, y de lo que vive todo el tablero. */
export interface BaseNocturna {
    edicion: number;
    inscripciones: NocturnaInscripcion[];
    /** Los adolescentes de todas las inscripciones, en una sola lista. */
    jovenes: NocturnaJoven[];
    /** La marca más nueva que hay, para el "Actualizado 06:42". */
    ultimoDato: string | null;
}

export interface KpisNocturna {
    adolescentesInscriptos: number;
    acreditados: number;
    /** Inscriptos − acreditados: todos los que esa noche no entraron. */
    noVinieron: number;
    /** Los que alguien marcó como ausentes en la puerta. */
    marcadosAusentes: number;
    /** Los que no tienen ninguna marca: ni entraron ni los dieron por ausentes. */
    sinRegistrar: number;
    /** Una inscripción es una familia con su adulto responsable. */
    adultosResponsables: number;
    /** Acreditados que ya se fueron. No es un KPI; lo usa la nota del gráfico. */
    retirados: number;
}

export interface TramoDeAsistencia {
    nombre: string;
    valor: number;
    color: string;
}

export interface PuntoPorMinuto {
    /** 0 es el minuto de VENTANA_INICIO. */
    minuto: number;
    acreditaron: number;
    retiraron: number;
}

export interface SeriePorMinuto {
    puntos: PuntoPorMinuto[];
    /** Marcas que cayeron fuera de la ventana. Van en la nota al pie. */
    fuera: number;
}

// ── La consulta ─────────────────────────────────────────────────────────

const PAGINA = 1000;

const aviso = (donde: string, error: unknown) => {
    console.error(`[ReportesNocturna] ${donde}:`, error);
};

/**
 * Las inscripciones de la edición en curso con sus adolescentes embebidos.
 *
 * El select es el mismo que usa AdminNocturna, con los dos alias puestos a
 * mano. No es decoración: `nocturna_jovenes` apunta a `nocturna_inscripciones`
 * por DOS columnas a la vez (inscripcion_id, edicion) en una sola clave
 * compuesta, y pedir la relación sin nombrarla deja a PostgREST eligiendo
 * entre dos caminos. Con el alias no hay nada que elegir.
 *
 * Pagina de mil en mil: PostgREST corta en 1000 filas y devuelve 206 sin
 * error, así que una edición grande se contaría de menos en silencio.
 */
export const getBaseNocturna = async (): Promise<BaseNocturna | null> => {
    const config = await supabaseService.getNocturnaConfig();
    if (!config) {
        aviso('getBaseNocturna', 'no pudimos leer nocturna_config');
        return null;
    }

    const filas: any[] = [];
    for (let desde = 0; ; desde += PAGINA) {
        const { data, error } = await supabase
            .from('nocturna_inscripciones')
            .select('*, jovenes:nocturna_jovenes(*), comprobantes:nocturna_comprobantes(*)')
            .eq('edicion', config.edicion)
            .order('created_at', { ascending: true })
            .range(desde, desde + PAGINA - 1);

        if (error) { aviso('getBaseNocturna', error); return null; }

        const lote = data || [];
        filas.push(...lote);
        if (lote.length < PAGINA) break;
    }

    const inscripciones = filas.map(r => supabaseService._nocturnaInscripcionDesdeDb(r));
    const jovenes = inscripciones.flatMap(i => i.jovenes || []);

    return {
        edicion: config.edicion,
        inscripciones,
        jovenes,
        ultimoDato: ultimoDato(inscripciones, jovenes),
    };
};

/**
 * La marca más nueva que hay en la base.
 *
 * Antes del evento no hay ninguna acreditación, así que cae en la última
 * inscripción cargada: el encabezado dice "Actualizado" de un dato que existe
 * en vez de la hora del navegador, que no es un dato del evento.
 */
const ultimoDato = (inscripciones: NocturnaInscripcion[], jovenes: NocturnaJoven[]): string | null => {
    const marcas: Array<string | null> = [
        ...jovenes.flatMap(j => [j.acreditadoAt, j.ausenteAt, j.retiradoAt]),
        ...inscripciones.map(i => i.createdAt),
    ];
    let ultima: string | null = null;
    for (const m of marcas) {
        if (!m) continue;
        if (!ultima || m > ultima) ultima = m;
    }
    return ultima;
};

// ── Las cuentas (puras) ─────────────────────────────────────────────────

/**
 * En qué estado está un adolescente.
 *
 * `ausente` y `acreditado` son excluyentes en la base (el escáner borra uno al
 * poner el otro), pero el orden acá no es casual: si una fila llegara con las
 * dos marcas, vale la que dice que entró. Que alguien figure como ausente
 * habiendo pasado por la puerta es el error que se nota.
 */
export const estadoDelJoven = (j: NocturnaJoven): 'acreditado' | 'ausente' | 'pendiente' => {
    if (j.acreditadoAt) return 'acreditado';
    if (j.ausenteAt) return 'ausente';
    return 'pendiente';
};

export const kpis = (base: BaseNocturna): KpisNocturna => {
    let acreditados = 0;
    let marcadosAusentes = 0;
    let sinRegistrar = 0;
    let retirados = 0;

    for (const j of base.jovenes) {
        switch (estadoDelJoven(j)) {
            case 'acreditado':
                acreditados++;
                if (j.retiradoAt) retirados++;
                break;
            case 'ausente':
                marcadosAusentes++;
                break;
            default:
                sinRegistrar++;
        }
    }

    const adolescentesInscriptos = base.jovenes.length;

    return {
        adolescentesInscriptos,
        acreditados,
        noVinieron: adolescentesInscriptos - acreditados,
        marcadosAusentes,
        sinRegistrar,
        adultosResponsables: base.inscripciones.length,
        retirados,
    };
};

// Los tres colores de la torta, que son los mismos que usa el resto del
// tablero: el azul de PiezasTablero, el ámbar con el que la app marca lo que
// pide atención y el gris de "todo lo demás".
export const AZUL_SERIE = '#2563eb';
export const AMBAR_SERIE = '#e5ad5c';
export const GRIS_SERIE = '#dfe3e8';

/** Los tres tramos de la torta, con el color con el que se dibujan. */
export const tortaAsistencia = (base: BaseNocturna): TramoDeAsistencia[] => {
    const k = kpis(base);
    return [
        { nombre: 'Acreditados', valor: k.acreditados, color: AZUL_SERIE },
        { nombre: 'Marcados ausentes', valor: k.marcadosAusentes, color: AMBAR_SERIE },
        { nombre: 'Sin registrar', valor: k.sinRegistrar, color: GRIS_SERIE },
    ];
};

/**
 * Qué parte de los inscriptos entró, redondeado al entero.
 *
 * Sin inscriptos devuelve 0 y no NaN: la pantalla igual muestra su estado de
 * "todavía no hay acreditaciones", pero un NaN se escapa a cualquier parte.
 */
export const porcentajeAsistencia = (base: BaseNocturna): number => {
    const k = kpis(base);
    if (!k.adolescentesInscriptos) return 0;
    return Math.round((k.acreditados / k.adolescentesInscriptos) * 100);
};

/**
 * Un punto por minuto entre `desde` y `hasta`: cuántos acreditaron y cuántos
 * retiraron en ese minuto exacto.
 *
 * Están TODOS los minutos, también los vacíos. Un gráfico que sólo trae los
 * minutos con movimiento le pone al eje un tiempo elástico, y dos picos
 * separados por una hora aparecen pegados.
 */
export const porMinuto = (
    base: BaseNocturna,
    desde: string = VENTANA_INICIO,
    hasta: string = VENTANA_FIN,
): SeriePorMinuto => {
    const inicio = Date.parse(desde);
    const total = Math.max(0, Math.round((Date.parse(hasta) - inicio) / MS_POR_MINUTO));

    const puntos: PuntoPorMinuto[] = Array.from({ length: total }, (_, minuto) => ({
        minuto, acreditaron: 0, retiraron: 0,
    }));
    let fuera = 0;

    const sumar = (iso: string | null, clave: 'acreditaron' | 'retiraron') => {
        if (!iso) return;
        const t = Date.parse(iso);
        if (Number.isNaN(t)) return;
        const i = Math.floor((t - inicio) / MS_POR_MINUTO);
        if (i < 0 || i >= total) { fuera++; return; }
        puntos[i][clave]++;
    };

    for (const j of base.jovenes) {
        sumar(j.acreditadoAt, 'acreditaron');
        sumar(j.retiradoAt, 'retiraron');
    }

    return { puntos, fuera };
};

/**
 * El minuto 0 es las 22:00; el 75, las 23:15.
 *
 * El huso va puesto a mano porque el rótulo tiene que decir la hora del evento
 * en Buenos Aires, no la del reloj de quien está mirando el tablero.
 */
export const horaDelMinuto = (minuto: number, desde: string = VENTANA_INICIO): string =>
    horaCorta(new Date(Date.parse(desde) + minuto * MS_POR_MINUTO).toISOString()) || '';

/** "06:42" en hora argentina. Null si no hay fecha. */
export const horaCorta = (iso: string | null): string | null => {
    if (!iso) return null;
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return null;
    return new Date(t).toLocaleTimeString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
};
