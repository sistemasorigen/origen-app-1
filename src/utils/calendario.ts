// Genera un archivo .ics (estándar iCalendar) para la
// reunión semanal recurrente de un grupo. Sin
// dependencias: un .ics es texto plano.

const DIA_A_ICS: Record<string, string> = {
    'Domingo': 'SU', 'Lunes': 'MO', 'Martes': 'TU', 'Miércoles': 'WE',
    'Jueves': 'TH', 'Viernes': 'FR', 'Sábado': 'SA',
};

// Índice de día JS (0 = domingo) para calcular la primera ocurrencia.
const DIA_A_INDICE: Record<string, number> = {
    'Domingo': 0, 'Lunes': 1, 'Martes': 2, 'Miércoles': 3,
    'Jueves': 4, 'Viernes': 5, 'Sábado': 6,
};

/**
 * Primera fecha en la que cae `meetingDay` a partir de
 * `startDate` (inclusive). Si el grupo arranca un lunes
 * y se reúne los jueves, la primera reunión es ese
 * jueves, no el lunes.
 */
const primeraOcurrencia = (startDate: string, meetingDay: string): Date | null => {
    const objetivo = DIA_A_INDICE[meetingDay];
    if (objetivo === undefined) return null;

    // Parseo manual para evitar el corrimiento de zona
    // horaria de new Date('YYYY-MM-DD'), que interpreta
    // en UTC y en Argentina (UTC-3) puede caer un día antes.
    const [y, m, d] = startDate.split('-').map(Number);
    if (!y || !m || !d) return null;

    const fecha = new Date(y, m - 1, d);
    const diff = (objetivo - fecha.getDay() + 7) % 7;
    fecha.setDate(fecha.getDate() + diff);
    return fecha;
};

const dosDigitos = (n: number) => String(n).padStart(2, '0');

const formatoICS = (fecha: Date, hora: string): string => {
    const [hh, mm] = hora.split(':').map(Number);
    return `${fecha.getFullYear()}${dosDigitos(fecha.getMonth() + 1)}${dosDigitos(fecha.getDate())}T${dosDigitos(hh || 0)}${dosDigitos(mm || 0)}00`;
};

// Escapa los caracteres que el formato iCalendar trata
// como especiales. Sin esto, una dirección con coma
// rompe el archivo.
const escapar = (texto: string): string =>
    (texto || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

export interface DatosCalendario {
    nombre: string;
    meetingDay: string;
    meetingTime: string;
    startDate: string;
    endDate?: string;
    location?: string;
    isOnline?: boolean;
    descripcion?: string;
}

export const generarICS = (datos: DatosCalendario): string | null => {
    const inicio = primeraOcurrencia(datos.startDate, datos.meetingDay);
    const diaICS = DIA_A_ICS[datos.meetingDay];
    if (!inicio || !diaICS || !datos.meetingTime) return null;

    const dtStart = formatoICS(inicio, datos.meetingTime);

    // Fin del evento: 1.5 h después del inicio.
    const [hh, mm] = datos.meetingTime.split(':').map(Number);
    const fin = new Date(inicio);
    fin.setHours((hh || 0) + 1, (mm || 0) + 30);
    const dtEnd = formatoICS(fin, `${dosDigitos(fin.getHours())}:${dosDigitos(fin.getMinutes())}`);

    // Recurrencia semanal hasta endDate (si existe).
    let rrule = `RRULE:FREQ=WEEKLY;BYDAY=${diaICS}`;
    if (datos.endDate) {
        const [ey, em, ed] = datos.endDate.split('-').map(Number);
        if (ey && em && ed) {
            rrule += `;UNTIL=${ey}${dosDigitos(em)}${dosDigitos(ed)}T235959Z`;
        }
    }

    const ubicacion = datos.isOnline ? 'Online' : (datos.location || '');

    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Origen//GCX//ES',
        'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        `UID:gcx-${Date.now()}@origeniglesia.org`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        rrule,
        `SUMMARY:${escapar(datos.nombre)}`,
        `LOCATION:${escapar(ubicacion)}`,
        `DESCRIPTION:${escapar(datos.descripcion || 'Grupo de Conexión — Origen')}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT1H',
        'ACTION:DISPLAY',
        'DESCRIPTION:Recordatorio',
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR',
    ].join('\r\n'); // El estándar iCalendar exige CRLF.
};

export const descargarICS = (datos: DatosCalendario): boolean => {
    const contenido = generarICS(datos);
    if (!contenido) return false;

    const blob = new Blob([contenido], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${datos.nombre.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
};
