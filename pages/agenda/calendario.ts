import {
    diaCompleto, fechaDesdeIso, fechaIso, fechaLarga, mesYAnio, rangoDeDias, sumarDias,
    type Tarea,
} from '../../services/agenda';

/**
 * Las cuentas del calendario de la Agenda: qué días muestra cada vista, qué
 * rango se le pide a la base, cómo se reparten las tareas que se pisan y lo
 * que se recuerda entre visitas.
 *
 * Todo trabaja con fechas 'YYYY-MM-DD' en hora local, armadas con los helpers
 * de services/agenda.ts (instrucciones 7.10: nada de new Date('YYYY-MM-DD')).
 * La semana empieza el LUNES.
 *
 * El tope de la base: agenda_mis_tareas no acepta más de 100 días entre
 * desde y hasta. Ninguna vista lo pasa: Día 1, Semana 7, Mes como mucho 42
 * (la grilla) y Lista va en tramos de 30.
 */

export type Vista = 'dia' | 'semana' | 'mes' | 'lista';
export const VISTAS: { id: Vista; etiqueta: string }[] = [
    { id: 'dia', etiqueta: 'Día' },
    { id: 'semana', etiqueta: 'Semana' },
    { id: 'mes', etiqueta: 'Mes' },
    { id: 'lista', etiqueta: 'Lista' },
];
export const esVista = (v: string | null): v is Vista => VISTAS.some(x => x.id === v);

export interface Rango { desde: string; hasta: string }

/** Los días que tiene un tramo de la Lista. */
export const DIAS_POR_TRAMO = 30;

/** El lunes de la semana de esa fecha. */
export const lunesDe = (iso: string): string => sumarDias(iso, -((fechaDesdeIso(iso).getDay() + 6) % 7));

/** Los días de una semana, de lunes a domingo. */
export const diasDeLaSemana = (iso: string): string[] => {
    const lunes = lunesDe(iso);
    return [0, 1, 2, 3, 4, 5, 6].map(i => sumarDias(lunes, i));
};

/** El primer día del mes de esa fecha. */
export const primeroDelMes = (iso: string): string => `${iso.slice(0, 8)}01`;

/**
 * La grilla de un mes: de lunes a domingo, 5 o 6 semanas (35 o 42 días).
 * La sexta fila sólo si el mes la necesita.
 */
export const grillaDelMes = (iso: string): string[] => {
    const inicio = lunesDe(primeroDelMes(iso));
    const mes = fechaDesdeIso(primeroDelMes(iso)).getMonth();
    const dias: string[] = [];
    for (let i = 0; i < 42; i++) {
        const dia = sumarDias(inicio, i);
        if (i === 35 && fechaDesdeIso(dia).getMonth() !== mes) break;
        dias.push(dia);
    }
    return dias;
};

/** Suma meses sin desbordar: del 31 de enero, un mes después es el 28/29 de febrero. */
export const sumarMeses = (iso: string, meses: number): string => {
    const d = fechaDesdeIso(primeroDelMes(iso));
    d.setMonth(d.getMonth() + meses);
    const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(Number(iso.slice(8, 10)), ultimo));
    return fechaIso(d);
};

/** Los rangos que pide la vista: uno, salvo la Lista, que pide sus tramos. */
export const rangosDeVista = (vista: Vista, fecha: string, tramos = 1): Rango[] => {
    if (vista === 'dia') return [{ desde: fecha, hasta: fecha }];
    if (vista === 'semana') return [{ desde: lunesDe(fecha), hasta: sumarDias(lunesDe(fecha), 6) }];
    if (vista === 'mes') {
        const g = grillaDelMes(fecha);
        return [{ desde: g[0], hasta: g[g.length - 1] }];
    }
    return Array.from({ length: tramos }, (_, i) => ({
        desde: sumarDias(fecha, i * DIAS_POR_TRAMO),
        hasta: sumarDias(fecha, i * DIAS_POR_TRAMO + DIAS_POR_TRAMO - 1),
    }));
};

/** La fecha del período anterior (−1) o siguiente (+1) de la vista. */
export const moverFecha = (vista: Vista, fecha: string, paso: -1 | 1): string => {
    if (vista === 'dia') return sumarDias(fecha, paso);
    if (vista === 'mes') return sumarMeses(fecha, paso);
    if (vista === 'lista') return sumarDias(fecha, paso * DIAS_POR_TRAMO);
    return sumarDias(fecha, paso * 7);
};

/**
 * Lo que se precarga después de mostrar un período: el anterior y el
 * siguiente (en la Lista, el tramo que viene después de los que hay).
 */
export const rangosVecinos = (vista: Vista, fecha: string, tramos: number): Rango[] => {
    if (vista === 'lista') {
        return [{
            desde: sumarDias(fecha, tramos * DIAS_POR_TRAMO),
            hasta: sumarDias(fecha, tramos * DIAS_POR_TRAMO + DIAS_POR_TRAMO - 1),
        }];
    }
    return [
        ...rangosDeVista(vista, moverFecha(vista, fecha, -1)),
        ...rangosDeVista(vista, moverFecha(vista, fecha, 1)),
    ];
};

/** El período, como lo dice el encabezado. */
export const textoDelPeriodo = (vista: Vista, fecha: string): string => {
    if (vista === 'dia') return diaCompleto(fecha);
    if (vista === 'mes') return mesYAnio(fecha);
    if (vista === 'semana') return rangoDeDias(lunesDe(fecha), sumarDias(lunesDe(fecha), 6));
    return `Desde el ${fechaLarga(fecha)}`;
};

// ── Horas ────────────────────────────────────────────────────────────────

/** 'HH:MM' → minutos desde la medianoche. */
export const minutos = (hhmm: string | null): number => {
    if (!hhmm) return 0;
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + (m || 0);
};

/** '19:00 a 20:30' (para leer en voz alta: el guion no se pronuncia bien). */
export const horarioHablado = (t: Pick<Tarea, 'todoElDia' | 'horaDesde' | 'horaHasta'>): string =>
    t.todoElDia || !t.horaDesde ? 'todo el día' : `${t.horaDesde} a ${t.horaHasta || t.horaDesde}`;

export interface Ubicada {
    tarea: Tarea;
    desde: number;
    hasta: number;
    /** En qué carril va y cuántos hay en su grupo: el ancho es 1/carriles. */
    carril: number;
    carriles: number;
}

/**
 * Las tareas con horario de un día, repartidas en carriles para que las que
 * se pisan queden lado a lado y no tapadas (el algoritmo del diseño).
 *
 * Se recorren por hora de inicio. Un GRUPO son las que se encadenan
 * pisándose; dentro del grupo cada tarea toma el primer carril que ya
 * quedó libre. Todas las del grupo comparten el ancho del carril más alto,
 * así las columnas se alinean. Una tarea que empieza cuando terminó todo lo
 * anterior abre un grupo nuevo, que vuelve a usar el ancho completo.
 */
export const ubicarEnCarriles = (tareas: Tarea[]): Ubicada[] => {
    const conHora = tareas
        .filter(t => !t.todoElDia && t.horaDesde)
        .map(t => {
            const desde = minutos(t.horaDesde);
            return { tarea: t, desde, hasta: Math.max(desde + 1, minutos(t.horaHasta || t.horaDesde)), carril: 0, carriles: 1 };
        })
        .sort((a, b) => a.desde - b.desde || b.hasta - a.hasta);

    const resultado: Ubicada[] = [];
    let grupo: Ubicada[] = [];
    let finDelGrupo = -1;
    let carriles: number[] = [];
    const cerrar = () => {
        const n = Math.max(1, ...grupo.map(g => g.carril + 1));
        grupo.forEach(g => { g.carriles = n; });
        resultado.push(...grupo);
        grupo = [];
        carriles = [];
    };
    conHora.forEach(u => {
        if (u.desde >= finDelGrupo) cerrar();
        let libre = carriles.findIndex(fin => fin <= u.desde);
        if (libre < 0) { libre = carriles.length; carriles.push(0); }
        carriles[libre] = u.hasta;
        u.carril = libre;
        grupo.push(u);
        finDelGrupo = Math.max(finDelGrupo, u.hasta);
    });
    cerrar();
    return resultado;
};

// ── Lo que se recuerda entre visitas ──────────────────────────────────────

/*
 * localStorage, siempre con try/catch: en navegación privada o con el
 * almacenamiento lleno tira error, y la Agenda tiene que andar igual (con los
 * valores de siempre). Nada de esto decide acceso: son preferencias.
 */
const CLAVE = { vista: 'agenda.vista', apagados: 'agenda.apagados', todo: 'agenda.todoElDepartamento' } as const;

const leer = (clave: string): string | null => {
    try { return window.localStorage.getItem(clave); } catch { return null; }
};
const escribir = (clave: string, valor: string) => {
    try { window.localStorage.setItem(clave, valor); } catch { /* sin almacenamiento: no se recuerda */ }
};

export const vistaRecordada = (): Vista | null => {
    const v = leer(CLAVE.vista);
    return esVista(v) ? v : null;
};
export const recordarVista = (v: Vista) => escribir(CLAVE.vista, v);

export const apagadosRecordados = (): string[] => {
    try {
        const v = JSON.parse(leer(CLAVE.apagados) || '[]');
        return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    } catch { return []; }
};
export const recordarApagados = (ids: string[]) => escribir(CLAVE.apagados, JSON.stringify(ids));

export const todoRecordado = (): boolean => leer(CLAVE.todo) === '1';
export const recordarTodo = (v: boolean) => escribir(CLAVE.todo, v ? '1' : '0');

/** La clave del chip "Sin asignar" de la leyenda (las tareas 'esperando'). */
export const SIN_ASIGNAR = '_sin_asignar';

/** Si una tarea pasa el filtro de la leyenda. */
export const pasaElFiltro = (t: Tarea, apagados: Set<string>): boolean =>
    t.subdepartamento ? !apagados.has(t.subdepartamento.id) : !apagados.has(SIN_ASIGNAR);
