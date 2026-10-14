/**
 * Fechas para los campos de formulario.
 *
 * El cuidado que piden estas dos funciones es el mismo de siempre: una fecha
 * sola —'2026-11-08'— la parsea el navegador como medianoche UTC, y en hora
 * argentina eso es todavía el día anterior. Si se la toca, el campo muestra
 * el 7 cuando la persona eligió el 8.
 *
 * Por eso: si ya viene como fecha sola, se devuelve tal cual. Sólo cuando
 * viene un instante completo se lo convierte a la fecha de acá.
 */

const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const dosDigitos = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' para un <input type="date">. */
export const formatDateForInput = (isoString: string | null | undefined): string => {
    if (!isoString) return '';
    if (SOLO_FECHA.test(isoString)) return isoString;

    const fecha = new Date(isoString);
    if (isNaN(fecha.getTime())) return '';

    // Los componentes locales, no los UTC: es el día que vio la persona.
    return `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`;
};

/** '08/11/2026' para mostrar. */
export const formatDateForDisplay = (isoString: string | null | undefined): string => {
    if (!isoString) return '';

    // El mediodía evita que la zona horaria corra la fecha un día.
    const fecha = SOLO_FECHA.test(isoString) ? new Date(`${isoString}T12:00:00`) : new Date(isoString);
    if (isNaN(fecha.getTime())) return '';

    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(fecha);
};

/**
 * Para guardar: mediodía UTC, que cae en el mismo día en todo el continente.
 */
export const normalizeDateForSave = (dateString: string): string => {
    if (!dateString) return '';
    return `${dateString}T12:00:00Z`;
};
