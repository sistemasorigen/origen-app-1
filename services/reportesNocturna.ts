import { supabase } from './supabaseClient';
import { supabaseService } from './supabaseService';
import { NocturnaInscripcion, NocturnaJoven, NocturnaRetiroTipo } from '../types';

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

// ── Las entradas y la plata ─────────────────────────────────────────────

export interface FilaDePrecio {
    /** El precio con el que se cobró esta tanda de entradas. */
    precio: number;
    entradas: number;
    /** precio × entradas. */
    pesos: number;
}

export interface EntradasVendidas {
    /** Una fila por precio distinto, de menor a mayor. */
    filas: FilaDePrecio[];
    /** Una entrada por adolescente inscripto. */
    entradas: number;
    /** La suma de todas las filas. */
    total: number;
    /**
     * Entradas sin precio propio, contadas con el de su inscripción. No es un
     * error —ver `precioDelJoven`—, pero la nota al pie lo dice para que el
     * número no parezca salido de la nada.
     */
    heredadas: number;
    /** Inscripciones sin comprobante cargado: plata que nadie vio entrar. */
    sinComprobante: number;
}

/**
 * Lo que se cobró por UN adolescente.
 *
 * El precio vive en el chico y no en la inscripción porque la promo de los 12
 * años es por chico: una familia puede tener un hijo de 12 a $40.000 y otro de
 * 14 a $50.000 en la misma inscripción. Hoy hay una así.
 *
 * El `??` no es decorativo. `nocturna_agregar_jovenes` —el formulario de "me
 * olvidé de anotar a un hijo"— inserta al chico SIN precio y le cobra a la
 * familia el `precio_unitario` de su inscripción: el comprobante se guarda por
 * `v_i.precio_unitario * v_n` (sql/nocturna_agregar_jovenes.sql). Ese es
 * entonces el precio de ese chico, y sin esta línea su entrada se contaría
 * en $0 sin que nada avise.
 */
const precioDelJoven = (j: NocturnaJoven, i: NocturnaInscripcion): number =>
    j.precio ?? i.precioUnitario;

/**
 * Cuántas entradas se vendieron a cada precio y cuánta plata es cada tanda.
 *
 * Son los precios con los que se cobró, no el precio de hoy: el del chico es
 * una foto del momento de inscribirse y no sigue a los cambios de
 * `nocturna_config`. Por eso el tablero muestra varios precios a la vez.
 *
 * Cuenta todas las inscripciones de la edición, igual que los KPI de arriba:
 * `entradas` da siempre lo mismo que "Adolescentes inscriptos".
 */
export const entradasVendidas = (base: BaseNocturna): EntradasVendidas => {
    const porPrecio = new Map<number, FilaDePrecio>();
    let entradas = 0;
    let total = 0;
    let heredadas = 0;
    let sinComprobante = 0;

    for (const i of base.inscripciones) {
        if (!i.comprobantePath) sinComprobante++;
        for (const j of i.jovenes || []) {
            const precio = precioDelJoven(j, i);
            if (j.precio == null) heredadas++;
            entradas++;
            total += precio;
            const fila = porPrecio.get(precio);
            if (fila) {
                fila.entradas++;
                fila.pesos += precio;
            } else {
                porPrecio.set(precio, { precio, entradas: 1, pesos: precio });
            }
        }
    }

    return {
        filas: [...porPrecio.values()].sort((a, b) => a.precio - b.precio),
        entradas,
        total,
        heredadas,
        sinComprobante,
    };
};

/** "$ 2.560.000", como se escribe la plata en los reportes de todas las áreas. */
const PESOS_AR = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
export const pesos = (n: number): string => `$ ${PESOS_AR.format(Math.round(n || 0))}`;

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

// ── ESPECÍFICOS (todo puro) ─────────────────────────────────────────────

export interface QuienRetira {
    /** Inscripciones con AL MENOS un adolescente que retira el adulto que inscribió. */
    conElAdulto: number;
    /** Inscripciones con al menos uno que retira otra persona. */
    conOtraPersona: number;
    /**
     * Inscripciones donde TODOS se van solos: las únicas que no aparecen en
     * el gráfico. Una con un hermano que se va solo y otro que retira el
     * adulto sí aparece, del lado del adulto.
     */
    soloSeVanSolos: number;
    /**
     * Las que tienen hermanos de los dos tipos y por eso están contadas dos
     * veces. Sin este número las dos porciones suman más que el total y
     * parece un error de cuentas.
     */
    mixtas: number;
    /** Inscripciones que entran al gráfico: las que no son `soloSeVanSolos`. */
    enElGrafico: number;
}

/**
 * Quién retira, POR INSCRIPCIÓN y no por adolescente.
 *
 * Es la pregunta de la puerta: cuántas familias vienen a buscar a sus chicos
 * y cuántas mandan a otra persona. Contado por adolescente, una familia con
 * tres hermanos pesaría el triple que la de al lado.
 */
export const quienRetira = (base: BaseNocturna): QuienRetira => {
    let conElAdulto = 0;
    let conOtraPersona = 0;
    let soloSeVanSolos = 0;
    let mixtas = 0;

    for (const i of base.inscripciones) {
        const tipos = new Set<NocturnaRetiroTipo>((i.jovenes || []).map(j => j.retiro?.tipo).filter(Boolean) as NocturnaRetiroTipo[]);
        if (!tipos.size) continue;

        const adulto = tipos.has('adulto');
        const otra = tipos.has('otra_persona');

        if (!adulto && !otra) { soloSeVanSolos++; continue; }
        if (adulto) conElAdulto++;
        if (otra) conOtraPersona++;
        if (adulto && otra) mixtas++;
    }

    return {
        conElAdulto,
        conOtraPersona,
        soloSeVanSolos,
        mixtas,
        enElGrafico: base.inscripciones.length - soloSeVanSolos,
    };
};

export interface GrupoDeMultiples {
    /** '2', '3' o '4 o más'. */
    etiqueta: string;
    inscripciones: number;
    /** Cuántos adolescentes hay en total en ese grupo. */
    adolescentes: number;
}

/**
 * Las inscripciones de más de un adolescente, por cuántos tienen.
 *
 * El tope es "4 o más" porque de ahí para arriba son casos sueltos y cada uno
 * con su propia barra deja un gráfico de barras de una unidad.
 */
export const inscripcionesMultiples = (base: BaseNocturna): GrupoDeMultiples[] => {
    const grupos: GrupoDeMultiples[] = [
        { etiqueta: '2', inscripciones: 0, adolescentes: 0 },
        { etiqueta: '3', inscripciones: 0, adolescentes: 0 },
        { etiqueta: '4 o más', inscripciones: 0, adolescentes: 0 },
    ];

    for (const i of base.inscripciones) {
        const n = (i.jovenes || []).length;
        if (n < 2) continue;
        const grupo = n === 2 ? grupos[0] : n === 3 ? grupos[1] : grupos[2];
        grupo.inscripciones++;
        grupo.adolescentes += n;
    }

    return grupos;
};

export interface AsistenciaEnMultiples {
    todos: number;
    algunos: number;
    ninguno: number;
    /** El total de inscripciones con 2 o más, para la nota. */
    inscripciones: number;
}

/**
 * De las inscripciones con varios adolescentes, cuántas vinieron enteras.
 *
 * "Vino al menos uno" es la que importa en la puerta: es la familia que está
 * adentro y a la que le falta un hermano.
 */
export const asistenciaEnMultiples = (base: BaseNocturna): AsistenciaEnMultiples => {
    let todos = 0;
    let algunos = 0;
    let ninguno = 0;
    let inscripciones = 0;

    for (const i of base.inscripciones) {
        const jovenes = i.jovenes || [];
        if (jovenes.length < 2) continue;
        inscripciones++;

        const vinieron = jovenes.filter(j => estadoDelJoven(j) === 'acreditado').length;
        if (vinieron === jovenes.length) todos++;
        else if (vinieron > 0) algunos++;
        else ninguno++;
    }

    return { todos, algunos, ninguno, inscripciones };
};

export interface FilaDeRetiro {
    jovenId: string;
    inscripcionId: string;
    adolescente: string;
    /** El adulto que lo retira, o '-' cuando se va solo. */
    responsable: string;
    /** El instante del retiro, o null si todavía no se registró. */
    retiradoAt: string | null;
}

export interface ListasDeRetiro {
    adulto: FilaDeRetiro[];
    otraPersona: FilaDeRetiro[];
    solo: FilaDeRetiro[];
}

const nombreDe = (nombre?: string | null, apellido?: string | null) =>
    `${nombre || ''} ${apellido || ''}`.trim();

/**
 * Los adolescentes ACREDITADOS, repartidos por quién los retira.
 *
 * Sólo los acreditados: quien no entró no se va a retirar de ninguna manera,
 * y una lista de retiro con gente que no vino es una lista para equivocarse
 * en la puerta.
 */
export const listasDeRetiro = (base: BaseNocturna): ListasDeRetiro => {
    const listas: ListasDeRetiro = { adulto: [], otraPersona: [], solo: [] };

    for (const i of base.inscripciones) {
        const adultoDeLaInscripcion = nombreDe(i.adultoNombre, i.adultoApellido) || '—';

        for (const j of i.jovenes || []) {
            if (estadoDelJoven(j) !== 'acreditado') continue;

            const tipo = j.retiro?.tipo;
            const fila: FilaDeRetiro = {
                jovenId: j.id,
                inscripcionId: i.id,
                adolescente: nombreDe(j.nombre, j.apellido) || '—',
                responsable: tipo === 'adulto'
                    ? adultoDeLaInscripcion
                    : tipo === 'otra_persona'
                        ? (nombreDe(j.retiro?.nombre, j.retiro?.apellido) || 'Otra persona')
                        : '-',
                retiradoAt: j.retiradoAt,
            };

            if (tipo === 'adulto') listas.adulto.push(fila);
            else if (tipo === 'otra_persona') listas.otraPersona.push(fila);
            else listas.solo.push(fila);
        }
    }

    return listas;
};

export interface FilaDeHorario {
    jovenId: string;
    inscripcionId: string;
    adulto: string;
    adolescente: string;
    ingreso: string | null;
    egreso: string | null;
    /** Lo marcaron ausente en la puerta: no es lo mismo que no tener hora. */
    ausente: boolean;
}

/** Una fila por adolescente inscripto, con sus dos horas. */
export const horarios = (base: BaseNocturna): FilaDeHorario[] => {
    const filas: FilaDeHorario[] = [];

    for (const i of base.inscripciones) {
        const adulto = nombreDe(i.adultoNombre, i.adultoApellido) || '—';
        for (const j of i.jovenes || []) {
            filas.push({
                jovenId: j.id,
                inscripcionId: i.id,
                adulto,
                adolescente: nombreDe(j.nombre, j.apellido) || '—',
                ingreso: j.acreditadoAt,
                egreso: j.retiradoAt,
                ausente: estadoDelJoven(j) === 'ausente',
            });
        }
    }

    return filas;
};

export type OrdenDeHorarios = 'ingreso' | 'egreso';

/**
 * De la primera hora a la última, con los que no tienen esa hora al final.
 *
 * Ordenados al revés —los sin hora arriba— la tabla abre con una pantalla de
 * guiones y hay que paginar para llegar a lo que pasó.
 */
export const ordenarHorarios = (filas: FilaDeHorario[], orden: OrdenDeHorarios): FilaDeHorario[] =>
    [...filas].sort((a, b) => {
        const x = orden === 'ingreso' ? a.ingreso : a.egreso;
        const y = orden === 'ingreso' ? b.ingreso : b.egreso;
        if (x && y) return x.localeCompare(y) || a.adolescente.localeCompare(b.adolescente, 'es');
        if (x) return -1;
        if (y) return 1;
        // Entre dos sin hora, por nombre: así la lista del final es estable y
        // no se reacomoda sola entre dos cargas.
        return a.adolescente.localeCompare(b.adolescente, 'es');
    });

/** "23:14:07" en hora argentina. Null si no hay fecha. */
export const horaExacta = (iso: string | null): string | null => {
    if (!iso) return null;
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return null;
    return new Date(t).toLocaleTimeString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
};

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
