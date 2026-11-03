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

// ── Con qué temporada abre /reportes/gcx ─────────────────────────────────

type ClaveTemporada = 'S1' | 'S2' | 'S3';
const CLAVES: ClaveTemporada[] = ['S1', 'S2', 'S3'];

/**
 * Las fechas de inicio de getSeasonFromDate, para cuando no hay
 * configuración. Son las mismas de la regla con la que un grupo cae en una
 * temporada.
 */
const INICIO_SIN_CONFIGURACION: Record<ClaveTemporada, string> = { S1: '03-23', S2: '06-29', S3: '10-05' };

export interface TemporadaParaAbrir {
    temporada: ClaveTemporada;
    anio: number;
    /** Qué regla decidió, para las pruebas y para quien lea el código. */
    motivo: 'url' | 'abierta' | 'ultima-que-empezo' | 'sin-configuracion';
}

const mmddValido = (s?: string) => !!s && /^\d{2}-\d{2}$/.test(s);

/**
 * La última temporada que empezó, mirando este año y el anterior, según las
 * fechas de inicio que se le pasan.
 */
const ultimaQueEmpezo = (inicios: Partial<Record<ClaveTemporada, string>>, hoy: string): { temporada: ClaveTemporada; anio: number } | null => {
    const anioHoy = Number(hoy.slice(0, 4));
    const candidatas = [anioHoy - 1, anioHoy].flatMap(anio => CLAVES
        .filter(k => mmddValido(inicios[k]))
        .map(k => ({ temporada: k, anio, inicio: `${anio}-${inicios[k]}` })))
        .filter(c => c.inicio <= hoy)
        .sort((a, b) => b.inicio.localeCompare(a.inicio));
    return candidatas[0] ? { temporada: candidatas[0].temporada, anio: candidatas[0].anio } : null;
};

/**
 * Con qué temporada y año abre el tablero de Reportes GCX, en este orden:
 *
 *   1. La de la URL, si trae temporada y año válidos: volver desde el detalle
 *      de un grupo o un link compartido muestran lo que se estaba mirando.
 *   2. La ABIERTA en la configuración (isOpen) del año activo. Si hay más de
 *      una, la que ya empezó con el inicio más reciente; si ninguna empezó,
 *      la que empieza primero.
 *   3. Si no hay ninguna abierta, la última que empezó según los inicios
 *      configurados, mirando este año y el anterior: en enero sigue siendo la
 *      Tercera del año pasado.
 *   4. Sin configuración: la temporada de hoy según getSeasonFromDate, o la
 *      última que empezó con sus fechas fijas si hoy no cae en ninguna.
 *
 * `hoy` es 'YYYY-MM-DD' en hora argentina. Es pura: no lee nada.
 */
export const temporadaParaAbrir = (p: {
    url?: { temporada?: string | null; anio?: number | null };
    config: SeasonSettings | null | undefined;
    hoy: string;
}): TemporadaParaAbrir => {
    const { url, config, hoy } = p;
    if (url?.temporada && (CLAVES as string[]).includes(url.temporada) && url.anio && Number.isInteger(url.anio)) {
        return { temporada: url.temporada as ClaveTemporada, anio: url.anio, motivo: 'url' };
    }

    const seasons = config?.seasons;
    if (config && seasons && Number.isInteger(config.activeYear)) {
        const abiertas = CLAVES
            .filter(k => seasons[k]?.isOpen && mmddValido(seasons[k]?.startDate))
            .map(k => ({ temporada: k, inicio: `${config.activeYear}-${seasons[k].startDate}` }));
        if (abiertas.length > 0) {
            const empezadas = abiertas.filter(a => a.inicio <= hoy).sort((a, b) => b.inicio.localeCompare(a.inicio));
            const elegida = empezadas[0] ?? [...abiertas].sort((a, b) => a.inicio.localeCompare(b.inicio))[0];
            return { temporada: elegida.temporada, anio: config.activeYear, motivo: 'abierta' };
        }
        const ultima = ultimaQueEmpezo(
            Object.fromEntries(CLAVES.map(k => [k, seasons[k]?.startDate])) as Partial<Record<ClaveTemporada, string>>,
            hoy,
        );
        if (ultima) return { ...ultima, motivo: 'ultima-que-empezo' };
    }

    const deHoy = getSeasonFromDate(hoy);
    if (deHoy) return { temporada: deHoy, anio: Number(hoy.slice(0, 4)), motivo: 'sin-configuracion' };
    const anterior = ultimaQueEmpezo(INICIO_SIN_CONFIGURACION, hoy)
        ?? { temporada: 'S3' as ClaveTemporada, anio: Number(hoy.slice(0, 4)) - 1 };
    return { ...anterior, motivo: 'sin-configuracion' };
};
