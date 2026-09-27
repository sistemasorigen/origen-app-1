import { Group, SeasonSettings } from '../../types';
import { getSeasonFromDate } from '../../services/supabaseService';

/**
 * Si un grupo pertenece a la temporada que hoy está abierta.
 *
 * La configuración marca una o más temporadas con `isOpen` y un `activeYear`.
 * Un grupo cae en una temporada por su fecha de inicio, así que está
 * habilitado cuando esa temporada está abierta Y el año coincide: sin mirar
 * el año, un grupo de la S3 del año pasado pasaría por bueno.
 *
 * Sirve para decidir a dónde se puede mandar gente. Un grupo aprobado de una
 * temporada cerrada sigue existiendo —se consulta, se reabre— pero recibir un
 * miembro nuevo ahí no significa nada: esa temporada ya pasó.
 *
 * Las fechas fuera de los tres rangos devuelven null en getSeasonFromDate, y
 * un grupo así no está en ninguna temporada: queda afuera.
 */
export const esDeTemporadaActiva = (
    grupo: Pick<Group, 'startDate'>,
    temporadas?: SeasonSettings | null,
): boolean => {
    if (!temporadas || !grupo.startDate) return false;

    const clave = getSeasonFromDate(grupo.startDate);
    if (!clave) return false;

    if (!temporadas.seasons?.[clave]?.isOpen) return false;

    const anio = new Date(grupo.startDate + 'T12:00:00').getFullYear();
    return anio === temporadas.activeYear;
};

/** "Tercer Temporada 2026", para poder decir por qué la lista está corta. */
export const nombreTemporadaActiva = (temporadas?: SeasonSettings | null): string => {
    if (!temporadas?.seasons) return 'la temporada activa';
    const abiertas = (['S1', 'S2', 'S3'] as const)
        .filter(k => temporadas.seasons[k]?.isOpen)
        .map(k => temporadas.seasons[k]?.label || k);
    if (abiertas.length === 0) return 'la temporada activa';
    return `${abiertas.join(' y ')} ${temporadas.activeYear}`;
};
