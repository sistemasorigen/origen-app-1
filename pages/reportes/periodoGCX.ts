// ════════════════════════════════════════════════════════════════════════
// /reportes/gcx — el período dentro de la temporada y la agrupación por
// días, semanas o meses.
//
// Todo acá es PURO: recibe lo que el servicio ya trajo para la temporada
// (getReportesGCX, con su `crudo`) y devuelve lo mismo recortado a un
// período. Cambiar el período o la agrupación no vuelve a la base.
//
// Las cuentas son copia fiel de las del servicio (getAsistenciaPersonas,
// getGruposQueReportan, getCargaPorGrupo), con una sola diferencia: sólo
// entran las reuniones del período. Con el período igual a toda la temporada
// dan exactamente lo mismo que el servicio, y eso está probado con los datos
// reales; igual la pantalla, con "Toda la temporada", usa los números del
// servicio tal cual llegan.
//
// Fechas como 'YYYY-MM-DD' en hora local, nunca new Date('2026-10-05'): eso
// es UTC y en Argentina cae el día anterior.
// ════════════════════════════════════════════════════════════════════════
import type {
    ReportesGCXTemporada, AsistenciaPorFechaDia, CargaPorGrupoFila, AsistenciaPersonasReporte,
    GruposQueReportanReporte, ReporteModalidadGCX, ModalidadGrupo, ModoReunion, ReunionCrudaGCX,
} from '../../types';

/** Un rango de fechas, inclusive en las dos puntas. Igual que el de SelectorDeRango. */
export interface Rango { desde: string; hasta: string; }

// ── Fechas ──────────────────────────────────────────────────────────────

const dos = (n: number) => String(n).padStart(2, '0');
export const isoDe = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
const fechaDe = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
};
const sumarDias = (iso: string, n: number) => {
    const d = fechaDe(iso);
    return isoDe(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};
/** El lunes de la semana de ese día: la semana va de lunes a domingo, como el calendario. */
const lunesDe = (iso: string) => {
    const d = fechaDe(iso);
    return isoDe(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)));
};
const primeroDelMes = (iso: string) => `${iso.slice(0, 7)}-01`;
const ultimoDelMes = (iso: string) => {
    const d = fechaDe(iso);
    return isoDe(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};
const menor = (a: string, b: string) => (a < b ? a : b);
const mayor = (a: string, b: string) => (a > b ? a : b);

/** Una fecha 'YYYY-MM-DD' que existe (no el 31 de junio). */
export const esFechaValida = (v: unknown): v is string =>
    typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && isoDe(fechaDe(v)) === v;

export const diasDelRango = (r: Rango) =>
    Math.round((fechaDe(r.hasta).getTime() - fechaDe(r.desde).getTime()) / 86400000) + 1;

export const mismoRango = (a: Rango, b: Rango) => a.desde === b.desde && a.hasta === b.hasta;

/** La parte de `r` que cae dentro de `tope`, o null si no se tocan. */
export const recortarAlRango = (r: Rango, tope: Rango): Rango | null => {
    const desde = mayor(r.desde, tope.desde);
    const hasta = menor(r.hasta, tope.hasta);
    return desde <= hasta ? { desde, hasta } : null;
};

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = MESES_LARGOS.map(m => m.slice(0, 3));
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const partes = (iso: string) => {
    const d = fechaDe(iso);
    return { dia: d.getDate(), mes: d.getMonth(), anio: d.getFullYear() };
};

/**
 * Dos fechas dichas en castellano, sin "del" adelante: "3 al 9 de noviembre",
 * "29 de septiembre al 5 de octubre", "3 de noviembre" si es un solo día.
 */
const entre = (r: Rango): string => {
    const a = partes(r.desde);
    const b = partes(r.hasta);
    if (r.desde === r.hasta) return `${a.dia} de ${MESES_LARGOS[a.mes]}`;
    if (a.anio !== b.anio) return `${a.dia} de ${MESES_LARGOS[a.mes]} de ${a.anio} al ${b.dia} de ${MESES_LARGOS[b.mes]} de ${b.anio}`;
    if (a.mes === b.mes) return `${a.dia} al ${b.dia} de ${MESES_LARGOS[b.mes]}`;
    return `${a.dia} de ${MESES_LARGOS[a.mes]} al ${b.dia} de ${MESES_LARGOS[b.mes]}`;
};

/** El período en una frase, para los vacíos: "del 3 al 9 de noviembre", "el 3 de noviembre". */
export const frasePeriodo = (r: Rango): string => (r.desde === r.hasta ? `el ${entre(r)}` : `del ${entre(r)}`);

// ── La temporada y sus atajos ───────────────────────────────────────────

export interface LimitesTemporada { inicio: string; fin: string; }

/**
 * De qué día a qué día va la temporada elegida.
 *
 * La base son las fechas de la configuración de temporadas (/admingcx/
 * temporadas), y se estira si los datos se salen de ahí: hay reuniones
 * cargadas un par de días antes del inicio (el 3/10 en la Tercera 2026) y
 * grupos que terminan después del fin configurado. Todo lo que cuenta "Toda
 * la temporada" tiene que poder elegirse en el calendario, si no un período
 * que la cubre entera daría menos que ella.
 */
export const limitesDeTemporada = (
    datos: Pick<ReportesGCXTemporada, 'asistenciaPorFecha' | 'cargaPorGrupo'> | null,
    anio: number,
    configurada: { startDate: string; endDate: string } | undefined,
): LimitesTemporada | null => {
    const fechas: string[] = [];
    if (configurada?.startDate && configurada?.endDate) {
        const ini = `${anio}-${configurada.startDate}`;
        const fin = `${anio}-${configurada.endDate}`;
        if (esFechaValida(ini) && esFechaValida(fin) && ini <= fin) fechas.push(ini, fin);
    }
    (datos?.asistenciaPorFecha || []).forEach(d => fechas.push(d.fecha));
    (datos?.cargaPorGrupo || []).forEach(g => g.dias.forEach(d => fechas.push(d.fecha)));
    const validas = fechas.filter(esFechaValida);
    if (validas.length === 0) return null;
    return { inicio: validas.reduce(menor), fin: validas.reduce(mayor) };
};

/** "Toda la temporada": del inicio al fin, o hasta hoy si está en curso. null si todavía no empezó. */
export const rangoDeToda = (lim: LimitesTemporada, hoy: string): Rango | null =>
    lim.inicio > hoy ? null : { desde: lim.inicio, hasta: menor(lim.fin, hoy) };

/**
 * Los atajos del calendario de los reportes.
 *
 * Una lista propia y no una variante de atajosDeRango: acá todo se recorta a
 * la temporada y nada pasa de hoy. Un atajo que no toca la temporada no se
 * muestra ("Mes pasado" en una temporada que empezó este mes), y uno que,
 * recortado, da lo mismo que otro de antes tampoco: dos botones que eligen
 * el mismo rango confunden.
 */
export const atajosDeTemporada = (toda: Rango, hoy: string): { etiqueta: string; rango: Rango }[] => {
    const lunes = lunesDe(hoy);
    const mesPasado = sumarDias(primeroDelMes(hoy), -1);
    const candidatos: Array<[string, Rango]> = [
        ['Toda la temporada', toda],
        ['Esta semana', { desde: lunes, hasta: sumarDias(lunes, 6) }],
        ['Semana pasada', { desde: sumarDias(lunes, -7), hasta: sumarDias(lunes, -1) }],
        ['Este mes', { desde: primeroDelMes(hoy), hasta: ultimoDelMes(hoy) }],
        ['Mes pasado', { desde: primeroDelMes(mesPasado), hasta: mesPasado }],
    ];
    const salida: { etiqueta: string; rango: Rango }[] = [];
    candidatos.forEach(([etiqueta, r]) => {
        const recortado = recortarAlRango(r, toda);
        if (!recortado || salida.some(a => mismoRango(a.rango, recortado))) return;
        salida.push({ etiqueta, rango: recortado });
    });
    return salida;
};

/**
 * El período que pide la URL, si sirve: dos fechas reales, en orden y dentro
 * de la temporada. Si no, null, y la pantalla vuelve a "Toda la temporada".
 */
export const periodoDeLaUrl = (desde: unknown, hasta: unknown, toda: Rango): Rango | null => {
    if (!esFechaValida(desde) || !esFechaValida(hasta) || desde > hasta) return null;
    if (desde < toda.desde || hasta > toda.hasta) return null;
    return { desde, hasta };
};

// ── Agrupación ──────────────────────────────────────────────────────────

export type Agrupacion = 'dias' | 'semanas' | 'meses';
export const AGRUPACIONES: Agrupacion[] = ['dias', 'semanas', 'meses'];
export const NOMBRE_AGRUPACION: Record<Agrupacion, string> = { dias: 'Días', semanas: 'Semanas', meses: 'Meses' };
/** Cómo lo dice la bajada de un gráfico: "por semana". */
export const POR_AGRUPACION: Record<Agrupacion, string> = { dias: 'por día', semanas: 'por semana', meses: 'por mes' };
/** Lo que no se entiende vuelve a "Días", que es como arranca el tablero. */
export const agrupacionValida = (v: unknown): Agrupacion => (v === 'semanas' || v === 'meses' ? v : 'dias');

/** Una barra de un gráfico agrupado: una semana o un mes, recortados al período. */
export interface Tramo {
    desde: string;
    hasta: string;
    /** Lo que va en el eje: "3–9 nov", "29 sep – 5 oct", "Oct 2026". */
    etiqueta: string;
    /** El encabezado del tooltip: "Semana del 3 al 9 de noviembre". */
    titulo: string;
}

const etiquetaDeSemana = (r: Rango) => {
    const a = partes(r.desde);
    const b = partes(r.hasta);
    if (r.desde === r.hasta) return `${a.dia} ${MESES_CORTOS[a.mes]}`;
    if (a.mes === b.mes && a.anio === b.anio) return `${a.dia}–${b.dia} ${MESES_CORTOS[b.mes]}`;
    return `${a.dia} ${MESES_CORTOS[a.mes]} – ${b.dia} ${MESES_CORTOS[b.mes]}`;
};

/**
 * Las semanas (de lunes a domingo) o los meses del período, en orden y sin
 * huecos: una semana sin reuniones también está, para que el eje no salte.
 * Las de las puntas se recortan al período y su etiqueta dice las fechas
 * recortadas.
 */
export const tramosDelPeriodo = (r: Rango, agrupacion: 'semanas' | 'meses'): Tramo[] => {
    const salida: Tramo[] = [];
    let cursor = r.desde;
    while (cursor <= r.hasta) {
        const finNatural = agrupacion === 'semanas' ? sumarDias(lunesDe(cursor), 6) : ultimoDelMes(cursor);
        const t: Rango = { desde: cursor, hasta: menor(finNatural, r.hasta) };
        const p = partes(t.desde);
        const mesEntero = t.desde === primeroDelMes(t.desde) && t.hasta === ultimoDelMes(t.desde);
        salida.push({
            ...t,
            etiqueta: agrupacion === 'semanas'
                ? etiquetaDeSemana(t)
                : `${mayuscula(MESES_CORTOS[p.mes])} ${p.anio}`,
            titulo: agrupacion === 'semanas'
                ? `Semana del ${entre(t)}`
                : mesEntero
                    ? `${mayuscula(MESES_LARGOS[p.mes])} de ${p.anio}`
                    : `${mayuscula(MESES_LARGOS[p.mes])} de ${p.anio}, ${frasePeriodo(t)}`,
        });
        cursor = sumarDias(t.hasta, 1);
    }
    return salida;
};

const porcentaje = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0);

/** Una barra de "Días con asistencia cargada" agrupada. */
export interface TramoDeCarga extends Tramo {
    /** Reuniones cargadas en el tramo: la suma de las barras de sus días. */
    Cargaron: number;
    /** Reuniones que tocaban y no se cargaron, sumadas igual. */
    NoCargaron: number;
    /** Sobre el total del tramo, nunca el promedio de los porcentajes de cada día. */
    porcentaje: number;
    /** Qué grupos cargaron y cuántas veces, con los presentes de cada vez. */
    lista: Array<{ id: string; nombre: string; capacidad: number; presentes: number[] }>;
    faltantes: Array<{ id: string; nombre: string; capacidad: number; veces: number }>;
}

/**
 * "Días con asistencia cargada" por semana o por mes. Cada barra SUMA lo de
 * sus días —las mismas barras de "Días"—, así el total de las semanas es el
 * mismo que el de los días.
 */
export const agruparCalendario = (dias: AsistenciaPorFechaDia[], tramos: Tramo[]): TramoDeCarga[] =>
    tramos.map(t => {
        const lista = new Map<string, { id: string; nombre: string; capacidad: number; presentes: number[] }>();
        const faltantes = new Map<string, { id: string; nombre: string; capacidad: number; veces: number }>();
        let cargaron = 0;
        let noCargaron = 0;
        dias.filter(d => d.fecha >= t.desde && d.fecha <= t.hasta)
            .sort((a, b) => a.fecha.localeCompare(b.fecha))
            .forEach(d => {
                cargaron += d.grupos.length;
                noCargaron += d.sinCargar.length;
                d.grupos.forEach(g => {
                    const fila = lista.get(g.id) || { id: g.id, nombre: g.nombre, capacidad: g.capacidad, presentes: [] };
                    fila.presentes.push(g.presentes);
                    lista.set(g.id, fila);
                });
                d.sinCargar.forEach(g => {
                    const fila = faltantes.get(g.id) || { id: g.id, nombre: g.nombre, capacidad: g.capacidad, veces: 0 };
                    fila.veces += 1;
                    faltantes.set(g.id, fila);
                });
            });
        const porNombre = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre);
        return {
            ...t,
            Cargaron: cargaron,
            NoCargaron: noCargaron,
            porcentaje: porcentaje(cargaron, cargaron + noCargaron),
            lista: [...lista.values()].sort(porNombre),
            faltantes: [...faltantes.values()].sort(porNombre),
        };
    });

/** Una barra de la línea de tiempo de un grupo, agrupada. */
export interface TramoDelGrupo extends Tramo {
    /** Cuántas de sus fechas de encuentro del tramo cargó y cuántas no. */
    'Cargó': number;
    'No cargó': number;
    porcentaje: number;
    dias: CargaPorGrupoFila['dias'];
}

export const agruparDiasDelGrupo = (dias: CargaPorGrupoFila['dias'], tramos: Tramo[]): TramoDelGrupo[] =>
    tramos.map(t => {
        const del = dias.filter(d => d.fecha >= t.desde && d.fecha <= t.hasta);
        const cargo = del.filter(d => d.cargada).length;
        return { ...t, 'Cargó': cargo, 'No cargó': del.length - cargo, porcentaje: porcentaje(cargo, del.length), dias: del };
    });

// ── Las cuentas del período ─────────────────────────────────────────────

interface Conteos {
    presentes: Set<string>;
    veces: Map<string, number>;
    posibles: Map<string, number>;
}

/** Lo mismo que _cargarBaseReportesGCX suma para la temporada, pero sólo con estas reuniones. */
const contarReuniones = (reuniones: ReunionCrudaGCX[]) => {
    const nuevo = (): Conteos => ({ presentes: new Set(), veces: new Map(), posibles: new Map() });
    const sumarUno = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) || 0) + 1);
    const todos = nuevo();
    const porModo: Record<ModoReunion, Conteos> = { presencial: nuevo(), online: nuevo() };
    const reportan = new Set<string>();
    const fechasPorGrupo = new Map<string, Set<string>>();
    reuniones.forEach(r => {
        reportan.add(r.groupId);
        if (!fechasPorGrupo.has(r.groupId)) fechasPorGrupo.set(r.groupId, new Set());
        fechasPorGrupo.get(r.groupId)!.add(r.fecha);
        const destinos = r.modo ? [todos, porModo[r.modo]] : [todos];
        destinos.forEach(c => {
            r.presentes.forEach(id => { c.presentes.add(id); sumarUno(c.veces, id); });
            r.padron.forEach(id => sumarUno(c.posibles, id));
        });
    });
    return { todos, porModo, reportan, fechasPorGrupo };
};

type ConteosPeriodo = ReturnType<typeof contarReuniones>;

/** Copia de getAsistenciaPersonas, sobre las reuniones del período. */
const asistenciaPersonasDe = (
    personas: ReportesGCXTemporada['crudo']['personas'],
    c: ConteosPeriodo,
    grupos: Set<string> | null,
    modo?: ModoReunion,
): AsistenciaPersonasReporte => {
    const conteo = modo ? c.porModo[modo] : c.todos;
    const porPersona = new Map<string, { reporta: boolean; asistio: boolean; veces: number; posibles: number; sinCargaAlguno: boolean }>();
    personas.forEach(p => {
        if (grupos && !grupos.has(p.groupId)) return;
        const persona = porPersona.get(p.clave) || { reporta: false, asistio: false, veces: 0, posibles: 0, sinCargaAlguno: false };
        if (c.reportan.has(p.groupId)) {
            persona.reporta = true;
            if (conteo.presentes.has(p.idAsistencia)) persona.asistio = true;
            persona.veces += conteo.veces.get(p.idAsistencia) || 0;
            persona.posibles += conteo.posibles.get(p.idAsistencia) || 0;
        } else {
            persona.sinCargaAlguno = true;
        }
        porPersona.set(p.clave, persona);
    });

    let asistieron = 0;
    let nuncaAsistieron = 0;
    let sinCarga = 0;
    const frecuencia = { todas: 0, seisOMas: 0, cuatroACinco: 0, unaATres: 0, ninguna: 0 };
    porPersona.forEach(persona => {
        if (!persona.asistio || persona.veces === 0) {
            nuncaAsistieron += 1;
            frecuencia.ninguna += 1;
            if (!persona.reporta) sinCarga += 1;
            return;
        }
        asistieron += 1;
        if (!persona.sinCargaAlguno && persona.veces >= persona.posibles) frecuencia.todas += 1;
        else if (persona.veces >= 6) frecuencia.seisOMas += 1;
        else if (persona.veces >= 4) frecuencia.cuatroACinco += 1;
        else frecuencia.unaATres += 1;
    });
    return { asistieron, nuncaAsistieron, sinCarga, total: porPersona.size, frecuencia };
};

/** Copia de getGruposQueReportan: las esperadas son las del período. */
const gruposQueReportanDe = (
    ids: string[],
    c: ConteosPeriodo,
    esperadas: Map<string, number>,
): GruposQueReportanReporte => {
    const idsQueNoReportan = ids.filter(id => !c.reportan.has(id));
    const frecuencia = { todas: 0, seisOMas: 0, cuatroACinco: 0, unaATres: 0, ninguna: 0 };
    ids.forEach(id => {
        if (!c.reportan.has(id)) { frecuencia.ninguna += 1; return; }
        const cargadas = c.fechasPorGrupo.get(id)?.size ?? 0;
        const tocaban = esperadas.get(id) ?? 0;
        if (tocaban > 0 && cargadas >= tocaban) frecuencia.todas += 1;
        else if (cargadas >= 6) frecuencia.seisOMas += 1;
        else if (cargadas >= 4) frecuencia.cuatroACinco += 1;
        else frecuencia.unaATres += 1;
    });
    return {
        reportan: ids.length - idsQueNoReportan.length,
        noReportan: idsQueNoReportan.length,
        total: ids.length,
        idsQueNoReportan,
        frecuencia,
    };
};

/**
 * El tablero recortado a un período: lo que depende de las fechas de las
 * reuniones se vuelve a contar sólo con las del período; lo demás (grupos,
 * anfitriones, personas, inscripciones, género, edades) queda como vino,
 * porque es de toda la temporada.
 *
 * Las reuniones ESPERADAS son las del período, con la regla de siempre: el
 * día de encuentro del grupo, dentro de su vigencia y hasta hoy. Contra las
 * de la temporada entera, una semana daría porcentajes falsamente bajos.
 */
export const vistaDelPeriodo = (datos: ReportesGCXTemporada, r: Rango): ReportesGCXTemporada => {
    const enRango = (f: string) => f >= r.desde && f <= r.hasta;
    const c = contarReuniones(datos.crudo.reuniones.filter(x => enRango(x.fecha)));
    const personas = datos.crudo.personas;

    const personasPorGrupo = new Map<string, string[]>();
    personas.forEach(p => {
        const lista = personasPorGrupo.get(p.groupId);
        if (lista) lista.push(p.idAsistencia); else personasPorGrupo.set(p.groupId, [p.idAsistencia]);
    });

    const cargaPorGrupo: CargaPorGrupoFila[] = datos.cargaPorGrupo.map(f => {
        const dias = f.dias.filter(d => enRango(d.fecha));
        const cargadas = c.fechasPorGrupo.get(f.groupId)?.size ?? 0;
        const esperadas = dias.length;
        const ids = personasPorGrupo.get(f.groupId) || [];
        return {
            ...f,
            cargadas,
            esperadas,
            sinCargar: Math.max(0, esperadas - cargadas),
            asistieron: ids.filter(id => c.todos.presentes.has(id)).length,
            dias,
        };
    });
    const esperadas = new Map(cargaPorGrupo.map(f => [f.groupId, f.esperadas]));

    const idsDe = (modalidad?: ModalidadGrupo) => datos.crudo.grupos
        .filter(g => !modalidad || g.modalidad === modalidad)
        .map(g => g.id);

    const reporteDe = (modalidad: ModalidadGrupo): ReporteModalidadGCX => {
        const ids = idsDe(modalidad);
        const conjunto = new Set(ids);
        const asistenciaPorGrupo: Record<string, AsistenciaPersonasReporte> = {};
        ids.forEach(id => { asistenciaPorGrupo[id] = asistenciaPersonasDe(personas, c, new Set([id])); });
        return {
            gruposQueReportan: gruposQueReportanDe(ids, c, esperadas),
            asistenciaPersonas: asistenciaPersonasDe(personas, c, conjunto),
            asistenciaPorGrupo,
            porModoReunion: modalidad === 'hibrido'
                ? {
                    presencial: asistenciaPersonasDe(personas, c, conjunto, 'presencial'),
                    online: asistenciaPersonasDe(personas, c, conjunto, 'online'),
                }
                : undefined,
        };
    };

    return {
        ...datos,
        asistenciaPersonas: asistenciaPersonasDe(personas, c, null),
        gruposQueReportan: gruposQueReportanDe(idsDe(), c, esperadas),
        asistenciaPorFecha: datos.asistenciaPorFecha.filter(d => enRango(d.fecha)),
        cargaPorGrupo,
        tablaGrupos: datos.tablaGrupos.map(f => ({ ...f, reportaAsistencia: c.reportan.has(f.groupId) })),
        porModalidad: { presencial: reporteDe('presencial'), online: reporteDe('online'), hibrido: reporteDe('hibrido') },
    };
};
