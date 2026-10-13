/**
 * ¿Esta persona ya tiene otro grupo el mismo día que el que se está por
 * anotar?
 *
 * Pasó de verdad: alguien pidió entrar a un grupo de los viernes a las 18 y
 * después se anotó en otro de los viernes a las 20, y nadie le avisó. Esto es
 * sólo el aviso — nunca bloquea la inscripción, porque llegar a los dos puede
 * ser perfectamente posible y quien sabe eso es la persona, no la app.
 *
 * Acá vive la regla sola, sin Supabase: lo que entra son los compromisos ya
 * traídos y el grupo destino.
 */

/** Todo lo que compara fechas se hace en hora de acá. */
const ZONA_ARG = 'America/Argentina/Buenos_Aires';

/** Hoy, como 'YYYY-MM-DD' argentino. */
export const hoyArgentino = (): string =>
    new Date().toLocaleDateString('en-CA', { timeZone: ZONA_ARG });

/** Cómo está esta persona en ese otro grupo. */
export type RelacionGCX = 'APPROVED' | 'PENDING' | 'ANFITRION';

/** Un grupo en el que la persona ya está, con lo que hace falta para avisar. */
export interface CompromisoGCX {
    groupId: string;
    nombre: string;
    dia: string | null;
    /** Tal como viene de la base: '20:00', '20:00:00'… */
    hora: string | null;
    inicio: string | null;
    fin: string | null;
    estadoGrupo: string | null;
    online: boolean;
    /** "Ana Pérez" o "Ana Pérez y Luis Gómez". */
    anfitrion: string;
    dosAnfitriones: boolean;
    relacion: RelacionGCX;
}

/** El grupo al que se está por entrar. */
export interface DestinoGCX {
    id: string;
    meetingDay?: string | null;
    meetingTime?: string | null;
    startDate?: string | null;
    endDate?: string | null;
}

/**
 * "Miércoles" y "miercoles" son el mismo día. Se saca el acento con NFD, que
 * separa la letra de la tilde, y después se tira todo lo que sea tilde.
 */
export const normalizarDia = (dia?: string | null): string =>
    (dia ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim()
        .toLowerCase();

/** '20:00:00' → '20:00'. Lo que no tenga forma de hora vuelve vacío. */
export const horaCorta = (hora?: string | null): string => {
    const m = /^(\d{1,2}):(\d{2})/.exec((hora ?? '').trim());
    if (!m) return '';
    return `${m[1].padStart(2, '0')}:${m[2]}`;
};

/** Minutos desde la medianoche, o null si no hay hora. */
const enMinutos = (hora?: string | null): number | null => {
    const corta = horaCorta(hora);
    if (!corta) return null;
    const [h, m] = corta.split(':').map(Number);
    return h * 60 + m;
};

/**
 * Cuánto antes o después empieza A respecto de B, en palabras: "A la misma
 * hora", "2 h antes", "1 h 30 min después".
 */
export const diferenciaHoraria = (horaA?: string | null, horaB?: string | null): string => {
    const a = enMinutos(horaA);
    const b = enMinutos(horaB);
    if (a === null || b === null) return '';

    const delta = a - b;
    if (delta === 0) return 'A la misma hora';

    const abs = Math.abs(delta);
    const horas = Math.floor(abs / 60);
    const minutos = abs % 60;
    const cuanto = horas && minutos ? `${horas} h ${minutos} min`
        : horas ? `${horas} h`
            : `${minutos} min`;

    return `${cuanto} ${delta < 0 ? 'antes' : 'después'}`;
};

/** ¿Las dos temporadas se pisan? Sin alguna de las fechas, se asume que sí. */
const seSuperponen = (
    inicioA: string | null, finA: string | null,
    inicioB?: string | null, finB?: string | null,
): boolean => {
    if (inicioA && finB && inicioA > finB) return false;
    if (finA && inicioB && finA < inicioB) return false;
    return true;
};

/**
 * Los grupos de la persona que caen el mismo día que el destino, ordenados por
 * hora.
 *
 * Quedan afuera: el propio destino, los grupos terminados o no aprobados, los
 * de otra temporada —un viernes de S2 no choca con un viernes de S3— y los que
 * no tienen día cargado, que no se pueden comparar.
 */
export const gruposDelMismoDia = (
    destino: DestinoGCX,
    compromisos: CompromisoGCX[],
    hoy: string,
): CompromisoGCX[] => {
    const diaDestino = normalizarDia(destino.meetingDay);
    if (!diaDestino) return [];

    return (compromisos || [])
        .filter(c => {
            if (c.groupId === destino.id) return false;
            if ((c.estadoGrupo ?? '').toLowerCase() !== 'approved') return false;
            if (c.fin && c.fin < hoy) return false;
            if (!seSuperponen(c.inicio, c.fin, destino.startDate, destino.endDate)) return false;
            const dia = normalizarDia(c.dia);
            return !!dia && dia === diaDestino;
        })
        .sort((a, b) => (enMinutos(a.hora) ?? 0) - (enMinutos(b.hora) ?? 0));
};
