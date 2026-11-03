// ════════════════════════════════════════════════════════════════════════
// /reportes/gcx — el gráfico de Inscripciones: cuántas inscripciones
// nuevas hubo por día, semana o mes, con los eventos y servicios de esas
// fechas marcados encima.
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
//
// Decisión de Ignacio (2026-11-03): el gráfico cuenta INSCRIPCIONES NUEVAS,
// una por inscripción, en la fecha en que se creó. No cuenta a los que ya
// estaban inscriptos: por eso no hay una serie de aprobaciones (volvía a
// contar a gente que se había anotado antes) y las derivaciones quedan
// afuera (son alguien que ya estaba en otro grupo). Quien se anota en dos
// grupos son dos inscripciones, cada una en su fecha y su grupo. Una
// inscripción de pareja es UNA inscripción.

export interface GrupoDelTramo {
    groupId: string;
    nombre: string;
    categoria: string;
    /** Inscripciones nuevas en ese grupo, en el tramo. */
    nuevas: number;
}

/** Una barra de Inscripciones: un día, una semana o un mes. */
export interface TramoDeInscripciones extends Tramo {
    /** Inscripciones creadas en el tramo (en cualquier estado), sin las derivaciones. */
    'Inscripciones nuevas': number;
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

/** Una inscripción nueva: no es una derivación desde otro grupo. */
const esNueva = (i: InscripcionCrudaGCX) => !i.derivada;

/**
 * La serie del gráfico: cuántas inscripciones nuevas se crearon en cada día,
 * semana o mes, aprobadas o no (pendientes y rechazadas también: alguien se
 * anotó). Cada inscripción cuenta una vez.
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
    const lista = deLaCategoria(crudo, categoriaId).filter(esNueva);
    return tramos.map(t => {
        const porGrupo = new Map<string, GrupoDelTramo>();
        let nuevas = 0;
        lista.forEach(i => {
            if (!i.alta || i.alta < t.desde || i.alta > t.hasta) return;
            nuevas += 1;
            const g = grupo.get(i.groupId);
            const fila = porGrupo.get(i.groupId) || {
                groupId: i.groupId,
                nombre: g?.nombre || 'Sin nombre',
                categoria: nombreCategoria.get(g?.categoriaId || '') || 'Sin categoría',
                nuevas: 0,
            };
            fila.nuevas += 1;
            porGrupo.set(i.groupId, fila);
        });
        const enTramo = marcas.filter(m => m.fecha >= t.desde && m.fecha <= t.hasta);
        return {
            ...t,
            'Inscripciones nuevas': nuevas,
            grupos: [...porGrupo.values()].sort((a, b) => b.nuevas - a.nuevas || a.nombre.localeCompare(b.nombre)),
            eventos: enTramo.filter(m => m.tipo === 'evento'),
            servicios: enTramo.filter(m => m.tipo === 'servicio'),
        };
    });
};

/**
 * Los totales del rango, para el título y la nota: las nuevas, cuántas de
 * ellas siguen pendientes o fueron rechazadas, y las derivaciones que quedaron
 * afuera.
 */
export const resumenDeInscripciones = (p: {
    crudo: Pick<CrudoReportesGCX, 'inscripciones' | 'grupos'>;
    rango: Rango;
    categoriaId: string;
}) => {
    const en = (f: string | null) => !!f && f >= p.rango.desde && f <= p.rango.hasta;
    const lista = deLaCategoria(p.crudo, p.categoriaId).filter(i => en(i.alta));
    const cuenta = (f: (i: InscripcionCrudaGCX) => boolean) => lista.filter(f).length;
    return {
        nuevas: cuenta(esNueva),
        pendientes: cuenta(i => esNueva(i) && i.estado === 'PENDING'),
        rechazadas: cuenta(i => esNueva(i) && i.estado === 'REJECTED'),
        derivaciones: cuenta(i => !esNueva(i)),
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
