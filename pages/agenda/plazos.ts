import { fechaCorta, fechaDesdeIso, sumarDias, type Frecuencia, type Tarea } from '../../services/agenda';

/**
 * Las cuentas de las tareas CON PLAZO y de las que se repiten
 * (sql/agenda_plazos_y_repeticiones.sql, sección 39).
 *
 * Todo lo de acá es PURO: entra lo que ya vino de la base y sale texto o
 * geometría. Dos cosas NUNCA se calculan acá, y la base las manda resueltas:
 *
 *   · si una tarea está VENCIDA (`t.vencida`): la base usa hora argentina, y
 *     el navegador puede estar en otro huso o con el reloj corrido;
 *   · qué repetición entra en un plazo: eso lo contesta
 *     `getRepeticionesPosibles`, y duplicar la regla acá la desincronizaría.
 *
 * `diasRestantes` también viene de la base, contado hasta el último día de la
 * tarea y negativo si ya pasó.
 */

/** Una tarea de varios días: se completa cualquier día del plazo. */
export const esConPlazo = (t: Tarea): boolean => !!t.fechaHasta;

/** Una de las repeticiones de una serie. Es una tarea de un día. */
export const esRepeticion = (t: Tarea): boolean => !!t.serie;

/** El último día de la tarea: el fin del plazo, o su día. */
export const ultimoDia = (t: Tarea): string => t.fechaHasta || t.fecha;

/** Cuántos días abarca el plazo, contando el primero y el último. */
export const diasDePlazo = (t: Tarea): number =>
    esConPlazo(t) ? Math.round((fechaDesdeIso(t.fechaHasta as string).getTime() - fechaDesdeIso(t.fecha).getTime()) / 86400000) + 1 : 1;

/** Lo mismo, para dos fechas sueltas (el formulario, antes de que exista la tarea). */
export const largoDelPlazo = (desde: string, hasta: string): number =>
    Math.round((fechaDesdeIso(hasta).getTime() - fechaDesdeIso(desde).getTime()) / 86400000) + 1;

/**
 * Cuánto falta o cuánto hace que venció, en una línea.
 * Usa `diasRestantes` y `vencida` tal como vienen de la base.
 */
export const textoDeVencimiento = (t: Tarea): string => {
    const d = t.diasRestantes;
    if (t.estado === 'completada') return 'Completada';
    if (d > 1) return `Faltan ${d} días`;
    if (d === 1) return 'Falta 1 día';
    if (d === 0) return 'Vence hoy';
    if (d === -1) return 'Venció ayer';
    return `Venció hace ${-d} días`;
};

/**
 * "1/11": día y mes, sin el día de la semana. Es la forma corta de los
 * plazos, que siempre se leen de a dos fechas ("del 1/11 al 12/12") y con
 * `fechaCorta` ("Dom 1 nov") no entrarían en una tarjeta. Las etiquetas para
 * lector de pantalla siguen con la forma larga.
 */
export const diaYMes = (iso: string): string => {
    const d = fechaDesdeIso(iso);
    return `${d.getDate()}/${d.getMonth() + 1}`;
};

/** "Del 1/11 al 12/12". */
export const textoDelPlazo = (t: Tarea): string =>
    `Del ${diaYMes(t.fecha)} al ${diaYMes(ultimoDia(t))}`;

/**
 * Cuánto del plazo ya pasó, de 0 a 1, para la barra fina del detalle.
 * Antes de empezar, 0; pasado el último día, 1.
 */
export const progresoDePlazo = (t: Tarea, hoy: string): number => {
    const total = diasDePlazo(t);
    if (total <= 1) return 1;
    const pasados = Math.round((fechaDesdeIso(hoy).getTime() - fechaDesdeIso(t.fecha).getTime()) / 86400000);
    return Math.max(0, Math.min(1, pasados / (total - 1)));
};

/** "Día 9 de 42": en qué día del plazo estamos (1 el primero). */
export const diaDelPlazo = (t: Tarea, hoy: string): number => {
    const n = Math.round((fechaDesdeIso(hoy).getTime() - fechaDesdeIso(t.fecha).getTime()) / 86400000) + 1;
    return Math.max(1, Math.min(diasDePlazo(t), n));
};

/**
 * Cuántas repeticiones alcanza "Todas las que faltan", para el texto de la
 * pregunta. La cuenta exacta es de la base (`serie.pendientes`); mientras la
 * tarea no la traiga, se estima con su número: desde esta hasta la última.
 * La estimación sólo se pasa si esta repetición ya venció o si alguna
 * posterior ya se completó, y al guardar manda lo que diga la base.
 */
export const pendientesDeLaSerie = (t: Tarea): number => {
    const s = t.serie;
    if (!s) return 0;
    if (s.pendientes !== null && s.pendientes !== undefined) return s.pendientes;
    return Math.max(1, s.total - s.numero + 1);
};

/** "3 de 6". */
export const textoDeSerie = (t: Tarea): string =>
    t.serie ? `${t.serie.numero} de ${t.serie.total}` : '';

// ── Las barras de varios días ────────────────────────────────────────────

/**
 * Un pedazo de una tarea con plazo dentro de una tira de días (una semana de
 * la grilla, o una fila del mes).
 */
export interface Barra {
    tarea: Tarea;
    /** Índice del primer y del último día que ocupa DENTRO de la tira (0..n-1). */
    inicio: number;
    fin: number;
    /** El plazo sigue antes del primer día de la tira, o después del último. */
    cortaAntes: boolean;
    cortaDespues: boolean;
    /** Qué fila ocupa, para que las que se pisan no se tapen. */
    carril: number;
}

/**
 * Reparte en carriles las tareas de una tira de días.
 *
 * Una tarea con plazo ocupa un pedazo continuo de la tira; una de un día
 * ocupa un solo lugar. Dos que comparten aunque sea un día no pueden ir en el
 * mismo carril. Se recorren por día de inicio (y a igual inicio, primero la
 * más larga, que es la que conviene arriba) y cada una toma el primer carril
 * libre a partir de su día de inicio. Es el mismo criterio que
 * `ubicarEnCarriles` usa con las horas, pero contando días.
 *
 * Las de un día entran por el mismo camino a propósito: así una tarea suelta
 * nunca queda tapada por una barra que le pasa por encima.
 *
 * Devuelve también cuántos carriles hicieron falta, que es lo que decide el
 * alto de la banda.
 */
export const repartirEnCarriles = (tareas: Tarea[], dias: string[]): { barras: Barra[]; carriles: number } => {
    if (dias.length === 0) return { barras: [], carriles: 0 };
    const primero = dias[0];
    const ultimo = dias[dias.length - 1];

    const dentro = tareas
        .filter(t => t.fecha <= ultimo && ultimoDia(t) >= primero)
        .map(t => {
            const fin = ultimoDia(t);
            const i = dias.indexOf(t.fecha);
            const f = dias.indexOf(fin);
            return {
                tarea: t,
                inicio: i < 0 ? 0 : i,
                fin: f < 0 ? dias.length - 1 : f,
                cortaAntes: t.fecha < primero,
                cortaDespues: fin > ultimo,
                carril: 0,
            };
        })
        .sort((a, b) => a.inicio - b.inicio || (b.fin - b.inicio) - (a.fin - a.inicio)
            || a.tarea.nombre.localeCompare(b.tarea.nombre, 'es'));

    /** Hasta qué día (inclusive) está ocupado cada carril. */
    const ocupado: number[] = [];
    dentro.forEach(b => {
        let libre = ocupado.findIndex(hasta => hasta < b.inicio);
        if (libre < 0) { libre = ocupado.length; ocupado.push(-1); }
        ocupado[libre] = b.fin;
        b.carril = libre;
    });

    return { barras: dentro, carriles: ocupado.length };
};

/** Las tiras de siete días de una grilla de mes (o de cualquier grilla de semanas). */
export const porSemanas = (dias: string[]): string[][] => {
    const filas: string[][] = [];
    for (let i = 0; i < dias.length; i += 7) filas.push(dias.slice(i, i + 7));
    return filas;
};

/**
 * Cuántas tareas toca un día: las de ese día más las barras que lo cruzan.
 * Es lo que tiene que contar el "+N más" del mes.
 */
export const cuantasTocanElDia = (dia: string, tareas: Tarea[]): number =>
    tareas.filter(t => (esConPlazo(t) ? t.fecha <= dia && (t.fechaHasta as string) >= dia : t.fecha === dia)).length;

// ── Agrupar para los paneles y la lista ──────────────────────────────────

/**
 * Las vencidas primero y ordenadas por cuánto hace que vencieron (la que hace
 * más que venció, arriba: es la que más urge).
 */
export const ordenPorVencimiento = (a: Tarea, b: Tarea): number =>
    a.diasRestantes - b.diasRestantes || a.nombre.localeCompare(b.nombre, 'es');

/**
 * Separa lo vencido del resto. Una tarea de un día de las de siempre nunca
 * está vencida: la base ya lo resuelve en `vencida`.
 */
export const separarVencidas = (tareas: Tarea[]): { vencidas: Tarea[]; resto: Tarea[] } => ({
    vencidas: tareas.filter(t => t.vencida).sort(ordenPorVencimiento),
    resto: tareas.filter(t => !t.vencida),
});

/**
 * En qué día se agrupa una tarea en las listas por día: una con plazo va en
 * el día en que VENCE (no en el que empieza), porque es la fecha que importa
 * para hacerla. Las demás, en su día.
 */
export const diaDeAgrupado = (t: Tarea): string => ultimoDia(t);

// ── El resumen del formulario ────────────────────────────────────────────

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** "los lunes", "los días 31; si el mes no lo tiene, el último día". */
export const comoCae = (frecuencia: Frecuencia, desde: string): string => {
    const d = fechaDesdeIso(desde);
    switch (frecuencia) {
        case 'cada_semana':
        case 'semana_por_medio':
            return `los ${DIAS_SEMANA[d.getDay()]}`;
        case 'por_mes':
            return `los días ${d.getDate()}; si el mes no lo tiene, el último día`;
        default:
            return '';
    }
};

export interface Cuando {
    desde: string;
    hasta?: string | null;
    frecuencia?: Frecuencia | null;
    /** Cómo se lee la frecuencia ("Cada semana"), tal como la nombra la base. */
    frecuenciaTexto?: string | null;
    veces?: number | null;
    todoElDia: boolean;
    horaDesde?: string | null;
    horaHasta?: string | null;
}

/**
 * El resumen en lenguaje simple que va debajo del "¿Cuándo?", para que nadie
 * tenga que deducir de tres controles qué va a pasar:
 *
 *   · "Plazo: del 1/11 al 12/12 · se completa cualquier día"
 *   · "Se repite cada semana, los lunes, del 3/11 al 12/12 · 6 veces · 08:00 a 09:30"
 */
export const resumenDeCuando = (c: Cuando): string => {
    if (!c.hasta) return '';
    const plazo = `del ${diaYMes(c.desde)} al ${diaYMes(c.hasta)}`;
    const horario = c.todoElDia || !c.horaDesde
        ? 'todo el día'
        : `${c.horaDesde} a ${c.horaHasta || c.horaDesde}`;

    if (!c.frecuencia) return `Plazo: ${plazo} · se completa cualquier día`;

    const cae = comoCae(c.frecuencia, c.desde);
    const nombre = (c.frecuenciaTexto || '').toLowerCase();
    const veces = c.veces ? ` · ${c.veces} ${c.veces === 1 ? 'vez' : 'veces'}` : '';
    return `Se repite ${nombre}${cae ? `, ${cae}` : ''}, ${plazo}${veces} · ${horario}`;
};

/**
 * Lo mismo en pocas palabras, para un encabezado: "mié 4 nov · Todo el día",
 * "1/11 – 12/12" o "Cada semana · 6 veces". Las veces son las que dijo la base.
 */
export const resumenCortoDeCuando = (c: Cuando): string => {
    if (c.frecuencia) {
        return [c.frecuenciaTexto, c.veces ? `${c.veces} ${c.veces === 1 ? 'vez' : 'veces'}` : ''].filter(Boolean).join(' · ');
    }
    if (c.hasta) return `${diaYMes(c.desde)} – ${diaYMes(c.hasta)}`;
    const dia = fechaCorta(c.desde).toLowerCase();
    if (c.todoElDia) return `${dia} · Todo el día`;
    return c.horaDesde && c.horaHasta ? `${dia} · ${c.horaDesde} a ${c.horaHasta}` : dia;
};

/** "nombre, día y horario". */
export const enLista = (l: string[]): string =>
    (l.length < 2 ? l.join('') : `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}`);

/**
 * "Diseño ya terminó · falta Video". Vacío si quien mira no recibió el avance:
 * un integrante no ve a los otros equipos.
 */
export const avanceDeTarea = (t: Pick<Tarea, 'compartida' | 'equipos'>): string => {
    if (!t.compartida || !t.equipos) return '';
    const hechos = t.equipos.filter(e => e.finalizadoAt).map(e => e.nombre);
    const faltan = t.equipos.filter(e => !e.finalizadoAt && !e.archivado).map(e => e.nombre);
    if (faltan.length === 0) return hechos.length > 0 ? 'Terminaron todos los equipos' : 'Sin equipos activos';
    if (hechos.length === 0) return `Falta ${enLista(faltan)}`;
    return `${enLista(hechos)} ya ${hechos.length === 1 ? 'terminó' : 'terminaron'} · ${faltan.length === 1 ? 'falta' : 'faltan'} ${enLista(faltan)}`;
};

/** Qué equipo nombrar en una tarjeta. */
export const nombreDeEquipos = (t: Pick<Tarea, 'subdepartamento' | 'compartida' | 'equipos'>): string =>
    t.subdepartamento?.nombre ?? (t.compartida ? 'Compartida' : 'Sin asignar');

/** Los equipos de una tarea, para el filtro de la Agenda. */
export const equiposDeLaTarea = (t: Pick<Tarea, 'subdepartamento' | 'equipos'>): string[] =>
    (t.subdepartamento ? [t.subdepartamento.id] : (t.equipos ?? []).map(e => e.id));

/** Los días que cubre algún plazo, para marcarlos en la tira del teléfono. */
export const diasCubiertos = (tareas: Tarea[], desde: string, hasta: string): Set<string> => {
    const cubiertos = new Set<string>();
    tareas.filter(esConPlazo).forEach(t => {
        let d = t.fecha < desde ? desde : t.fecha;
        const fin = (t.fechaHasta as string) > hasta ? hasta : (t.fechaHasta as string);
        while (d <= fin) { cubiertos.add(d); d = sumarDias(d, 1); }
    });
    return cubiertos;
};
