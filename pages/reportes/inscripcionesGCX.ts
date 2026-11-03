// ════════════════════════════════════════════════════════════════════════
// /reportes/gcx — el gráfico de Inscripciones: cuánta gente se anotó y
// cuánta quedó aprobada, por día, semana o mes, con los eventos y servicios
// de esas fechas marcados encima.
//
// Puro, como periodoGCX.ts: trabaja sobre lo que el servicio ya trajo
// (crudo.inscripciones y getMarcasReportesGCX). Cambiar el período, la
// agrupación o la categoría no vuelve a la base.
// ════════════════════════════════════════════════════════════════════════
import type { CrudoReportesGCX, InscripcionCrudaGCX, MarcasReportesGCX } from '../../types';
import { Agrupacion, Rango, Tramo, tramosDelPeriodo } from './periodoGCX';

// ── Fechas ──────────────────────────────────────────────────────────────

const dos = (n: number) => String(n).padStart(2, '0');
const fechaDe = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const isoDe = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Un tramo por día, todos los días del rango: un día sin nadie queda en cero. */
export const tramosPorDia = (r: Rango): Tramo[] => {
    const salida: Tramo[] = [];
    for (let d = fechaDe(r.desde); isoDe(d) <= r.hasta; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
        const iso = isoDe(d);
        salida.push({ desde: iso, hasta: iso, etiqueta: `${d.getDate()}/${d.getMonth() + 1}`, titulo: `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}` });
    }
    return salida;
};

export const tramosDeInscripciones = (r: Rango, agrupacion: Agrupacion): Tramo[] =>
    agrupacion === 'dias' ? tramosPorDia(r) : tramosDelPeriodo(r, agrupacion);

// ── La temporada de las inscripciones ───────────────────────────────────

/**
 * La primera inscripción de los grupos de la temporada. La gente se anota
 * semanas antes de que arranquen las reuniones (en la Tercera 2026, desde
 * el 13/9 para grupos que empezaron el 5/10): el gráfico de Inscripciones
 * tiene que poder mostrar esas semanas.
 */
export const primeraInscripcion = (crudo: Pick<CrudoReportesGCX, 'inscripciones'>): string | null =>
    (crudo.inscripciones || []).reduce<string | null>((min, i) => (i.alta && (!min || i.alta < min) ? i.alta : min), null);

/**
 * El rango del gráfico de Inscripciones con "Toda la temporada": desde la
 * primera inscripción (si es anterior) hasta el fin de siempre. Los demás
 * gráficos no lo usan: su "Toda la temporada" no cambia.
 */
export const rangoDeInscripciones = (toda: Rango, primera: string | null): Rango =>
    primera && primera < toda.desde ? { desde: primera, hasta: toda.hasta } : toda;

// ── Eventos y servicios ─────────────────────────────────────────────────

export interface Marca {
    fecha: string;
    tipo: 'evento' | 'servicio';
    nombre: string;
    /** "Evento", "Nocturna", "CXV", "Domingo · Bautismos"… */
    detalle: string;
}

/** Las categorías de Audiencia que son en sí un servicio especial. */
export const CATEGORIAS_ESPECIALES = ['Evento', 'Conferencia', 'CXV'];

/**
 * Un servicio especial: los de categoría Evento, Conferencia o CXV, y los
 * domingos con un tipo distinto de "Tradicional" (Bautismos, Día de la
 * Madre, Invitado…). Un domingo sin tipo cargado se toma como tradicional.
 */
export const esServicioEspecial = (s: { categoria: string | null; tipo: string | null }) =>
    (!!s.categoria && CATEGORIAS_ESPECIALES.includes(s.categoria))
    || (s.categoria === 'Servicio de Domingo' && !!s.tipo && s.tipo !== 'Tradicional');

/**
 * Las marcas del rango, una por cosa que pasó, ordenadas por fecha.
 *
 * La Nocturna puede venir dos veces (eventos_general y su configuración):
 * si ya hay un evento ese día que la nombra, no se repite. Un servicio
 * cargado en dos horarios del mismo día es una sola marca.
 */
export const armarMarcas = (m: MarcasReportesGCX | null, r: Rango): Marca[] => {
    if (!m) return [];
    const en = (f: string) => f >= r.desde && f <= r.hasta;
    const salida: Marca[] = [];
    m.eventos.filter(e => en(e.fecha)).forEach(e => salida.push({ fecha: e.fecha, tipo: 'evento', nombre: e.nombre, detalle: 'Evento' }));
    m.nocturna.filter(n => en(n.fecha)).forEach(n => {
        const yaEsta = salida.some(x => x.fecha === n.fecha && /nocturna/i.test(x.nombre));
        if (!yaEsta) salida.push({ fecha: n.fecha, tipo: 'evento', nombre: n.edicion ? `Nocturna ${n.edicion}` : 'Nocturna', detalle: 'Nocturna' });
    });
    m.servicios.filter(s => en(s.fecha) && esServicioEspecial(s)).forEach(s => {
        // Un domingo se nombra por su tipo: el nombre cargado suele ser
        // "SERVICIO DE DOMINGO", que no dice qué tuvo de especial.
        const domingo = s.categoria === 'Servicio de Domingo';
        salida.push({
            fecha: s.fecha,
            tipo: 'servicio',
            nombre: domingo ? (s.tipo as string) : (s.nombre?.trim() || (s.categoria as string)),
            detalle: domingo ? 'Servicio de Domingo' : (s.categoria as string),
        });
    });
    const vistas = new Set<string>();
    return salida
        .filter(x => { const k = `${x.fecha}|${x.tipo}|${x.nombre}|${x.detalle}`; if (vistas.has(k)) return false; vistas.add(k); return true; })
        .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.tipo.localeCompare(b.tipo) || a.nombre.localeCompare(b.nombre));
};

// ── La serie ────────────────────────────────────────────────────────────

export interface GrupoDelTramo {
    groupId: string;
    nombre: string;
    categoria: string;
    seAnotaron: number;
    aprobadas: number;
    cambiaron: number;
}

/** Una barra de Inscripciones: un día, una semana o un mes. */
export interface TramoDeInscripciones extends Tramo {
    /** Personas que se anotaron (cualquier estado), sin las derivaciones. */
    'Se anotaron': number;
    /** Personas cuya inscripción quedó aprobada en esas fechas (approved_at), sin las derivaciones. */
    'Quedaron aprobadas': number;
    /** Derivaciones desde otro grupo aprobadas en esas fechas: la misma persona cambiando de grupo. */
    'Cambiaron de grupo': number;
    /** Grupo por grupo, lista completa, para el tooltip. */
    grupos: GrupoDelTramo[];
    eventos: Marca[];
    servicios: Marca[];
}

/** Las inscripciones de la categoría elegida ('' = todas). */
const deLaCategoria = (crudo: Pick<CrudoReportesGCX, 'inscripciones' | 'grupos'>, categoriaId: string) => {
    const lista = crudo.inscripciones || [];
    if (!categoriaId) return lista;
    const grupos = new Set(crudo.grupos.filter(g => (g.categoriaId || '') === categoriaId).map(g => g.id));
    return lista.filter(i => grupos.has(i.groupId));
};

/**
 * La serie del gráfico. Cuenta PERSONAS como "Inscripciones totales": la
 * pareja de una inscripción suma una más.
 *
 *  · Se anotaron: inscripciones creadas en el tramo, aprobadas o no
 *    (pendientes y rechazadas también: se anotaron). Una derivación no:
 *    es alguien que ya estaba en otro grupo.
 *  · Quedaron aprobadas: las aprobadas hoy, por el día en que se aprobaron.
 *    Las aprobadas sin fecha no se ubican (ver resumenDeInscripciones).
 *  · Cambiaron de grupo: las derivaciones aprobadas, por su aprobación.
 *
 * Las inscripciones borradas (bajas, o el origen de una derivación) no
 * existen más y no se pueden contar.
 */
export const serieDeInscripciones = (p: {
    crudo: Pick<CrudoReportesGCX, 'inscripciones' | 'grupos' | 'categorias'>;
    tramos: Tramo[];
    categoriaId: string;
    marcas: Marca[];
}): TramoDeInscripciones[] => {
    const { crudo, tramos, categoriaId, marcas } = p;
    const nombreCategoria = new Map((crudo.categorias || []).map(c => [c.id, c.nombre]));
    const grupo = new Map(crudo.grupos.map(g => [g.id, g]));
    const lista = deLaCategoria(crudo, categoriaId);
    return tramos.map(t => {
        const en = (f: string | null) => !!f && f >= t.desde && f <= t.hasta;
        const porGrupo = new Map<string, GrupoDelTramo>();
        const sumar = (i: InscripcionCrudaGCX, campo: 'seAnotaron' | 'aprobadas' | 'cambiaron') => {
            const g = grupo.get(i.groupId);
            const fila = porGrupo.get(i.groupId) || {
                groupId: i.groupId,
                nombre: g?.nombre || 'Sin nombre',
                categoria: nombreCategoria.get(g?.categoriaId || '') || 'Sin categoría',
                seAnotaron: 0, aprobadas: 0, cambiaron: 0,
            };
            fila[campo] += i.personas;
            porGrupo.set(i.groupId, fila);
        };
        let seAnotaron = 0, aprobadas = 0, cambiaron = 0;
        lista.forEach(i => {
            if (!i.derivada && en(i.alta)) { seAnotaron += i.personas; sumar(i, 'seAnotaron'); }
            if (i.estado === 'APPROVED' && en(i.aprobada)) {
                if (i.derivada) { cambiaron += i.personas; sumar(i, 'cambiaron'); }
                else { aprobadas += i.personas; sumar(i, 'aprobadas'); }
            }
        });
        const enTramo = marcas.filter(m => m.fecha >= t.desde && m.fecha <= t.hasta);
        return {
            ...t,
            'Se anotaron': seAnotaron,
            'Quedaron aprobadas': aprobadas,
            'Cambiaron de grupo': cambiaron,
            grupos: [...porGrupo.values()].sort((a, b) =>
                (b.seAnotaron + b.aprobadas + b.cambiaron) - (a.seAnotaron + a.aprobadas + a.cambiaron) || a.nombre.localeCompare(b.nombre)),
            eventos: enTramo.filter(m => m.tipo === 'evento'),
            servicios: enTramo.filter(m => m.tipo === 'servicio'),
        };
    });
};

/**
 * Los totales del rango, para el título y las notas. `sinFecha` son las
 * aprobadas que no tienen approved_at (inscripciones viejas): no se ubican
 * en ningún tramo y se dicen aparte. `derivacionesPendientes` se cuentan
 * para poder decir por qué no están en ninguna serie.
 */
export const resumenDeInscripciones = (p: {
    crudo: Pick<CrudoReportesGCX, 'inscripciones' | 'grupos'>;
    rango: Rango;
    categoriaId: string;
}) => {
    const en = (f: string | null) => !!f && f >= p.rango.desde && f <= p.rango.hasta;
    const lista = deLaCategoria(p.crudo, p.categoriaId);
    const suma = (f: (i: InscripcionCrudaGCX) => boolean) => lista.filter(f).reduce((a, i) => a + i.personas, 0);
    return {
        seAnotaron: suma(i => !i.derivada && en(i.alta)),
        aprobadas: suma(i => !i.derivada && i.estado === 'APPROVED' && en(i.aprobada)),
        cambiaron: suma(i => i.derivada && i.estado === 'APPROVED' && en(i.aprobada)),
        sinFecha: suma(i => !i.derivada && i.estado === 'APPROVED' && !i.aprobada),
        derivacionesNoAprobadas: suma(i => i.derivada && i.estado !== 'APPROVED'),
        pendientes: suma(i => !i.derivada && i.estado === 'PENDING' && en(i.alta)),
    };
};

/** Las categorías que tienen algún grupo en la temporada, por nombre. */
export const categoriasDeLaTemporada = (crudo: Pick<CrudoReportesGCX, 'grupos' | 'categorias'>) => {
    const usadas = new Set(crudo.grupos.map(g => g.categoriaId || '').filter(Boolean));
    return (crudo.categorias || []).filter(c => usadas.has(c.id)).sort((a, b) => a.nombre.localeCompare(b.nombre));
};

/**
 * Las marcas de un tramo, para dibujar: una por tipo, con su cantidad (en
 * "Días" casi siempre 1; en semanas y meses, "3 eventos").
 */
export const marcasDelTramo = (t: Pick<TramoDeInscripciones, 'eventos' | 'servicios'>) => ({
    eventos: t.eventos.length,
    servicios: t.servicios.length,
});
