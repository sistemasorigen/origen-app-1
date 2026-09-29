/**
 * Lo que las tres pantallas de Audiencia de Servicios tienen que entender
 * igual: cómo se suma un servicio, cómo se agrupan las áreas de voluntarios y
 * con qué servicio del año pasado se lo compara.
 *
 * Vive aparte porque la planilla, la carga y el detalle muestran los mismos
 * números en tres formas distintas, y si cada una los calculara por su cuenta
 * alcanzaría con tocar una para que dejaran de coincidir.
 *
 * Las fórmulas de `calcStats` vienen tal cual estaban en la planilla, sin
 * reacomodar: son los números que la iglesia viene reportando mes a mes, y
 * cambiar un denominador acá movería la serie histórica entera sin que nadie
 * lo haya pedido.
 */

// ─── Nombres reales de la base ────────────────────────────────────────────

/**
 * Las 16 áreas de voluntarios, agrupadas sólo para leerlas de corrido.
 *
 * Los grupos son una ayuda visual, no una regla de negocio: mover un área de
 * un grupo a otro no cambia ninguna cuenta, porque todas se suman juntas.
 */
export const GRUPOS_DE_AREAS: { titulo: string; items: { key: string; label: string }[] }[] = [
    {
        titulo: 'Técnica y producción',
        items: [
            { key: 'produccion', label: 'Producción' },
            { key: 'sonido', label: 'Sonido' },
            { key: 'visuales', label: 'Visuales' },
            { key: 'streaming', label: 'Streaming' },
            { key: 'camaras', label: 'Cámaras' },
            { key: 'fotos', label: 'Fotos' },
            { key: 'atmosfera', label: 'Atmosfera' },
        ],
    },
    {
        titulo: 'Recepción',
        items: [
            { key: 'conecta', label: 'Conecta' },
            { key: 'host_prevencion', label: 'Host + Prevención' },
            { key: 'sala_bienvenida', label: 'Sala de Bienvenida' },
            { key: 'punto_info', label: 'Punto de Información' },
            { key: 'store', label: 'Store' },
        ],
    },
    {
        titulo: 'Ministración y cuidado',
        items: [
            { key: 'equipo_ministracion', label: 'Equipo de Ministración' },
            { key: 'ea', label: 'EA' },
            { key: 'redes', label: 'Redes' },
            { key: 'profes_ninez', label: 'Profes Niñez' },
        ],
    },
];

/** Aplanado, en el orden en que se cargan. */
export const AREAS_VOLUNTARIOS = GRUPOS_DE_AREAS.flatMap(g => g.items);

export const CAMPOS_NINEZ = [
    { key: 'ninos_3_6', label: 'Niños 3 a 6' },
    { key: 'ninos_7_10', label: 'Niños 7 a 10' },
    { key: 'ninos_hd', label: 'Niños HD' },
    { key: 'borders', label: 'Borders' },
];

export const CAMPOS_SEGUIMIENTO = [
    { key: 'aceptaron', label: 'Aceptaron' },
    { key: 'asistieron_primera_vez', label: 'Asistieron por primera vez' },
    { key: 'reconciliaron', label: 'Reconciliaron' },
];

/** Métricas que sólo se miden los martes. */
export const CAMPOS_MARTES = [
    { key: 'podcast', label: 'Podcast' },
    { key: 'oracion', label: 'Oración' },
];

export const CATEGORIAS = [
    { nombre: 'Servicio de Domingo', detalle: '16 áreas de voluntarios' },
    { nombre: 'Martes', detalle: 'Podcast y oración' },
    { nombre: 'CXV', detalle: 'Como un domingo' },
    { nombre: 'Evento', detalle: 'Como un domingo' },
    { nombre: 'Conferencia', detalle: 'Como un domingo' },
];

export const TIPOS_DE_DOMINGO = [
    'Tradicional', 'Invitado', 'Día de la Madre', 'Día del Padre', 'Día del Niño',
    'Bautismos', 'Semana Santa', 'Servicio de Milagros', 'Navidad', 'Año Nuevo',
    'Acción de Gracias',
];

// ─── Cuentas ──────────────────────────────────────────────────────────────

const num = (v: any) => Number(v) || 0;

export interface EstadisticasServicio {
    totalVol: number;
    auditorioSinVol: number;
    auditorioConVol: number;
    ninezSinProfes: number;
    audNinezSinProfes: number;
    /** Todos los que estuvieron en el edificio: auditorio + niñez + voluntarios. */
    totalFinal: number;
    totalFinalConOnline: number;
    online: number;
    pctVol: number;
    /** Voluntarios distintos: los cargados menos los que sirvieron en dos áreas. */
    volUnicos: number;
    repetidos: number;
    /** Qué parte del total combinado siguió el servicio desde casa. */
    pctOnline: number;
}

export const calcStats = (r: any): EstadisticasServicio => {
    const totalVol = AREAS_VOLUNTARIOS.reduce((a, f) => a + num(r[f.key]), 0);
    const auditorio = num(r.auditorio);
    const online = num(r.online);
    const ninezSinProfes = CAMPOS_NINEZ.reduce((a, f) => a + num(r[f.key]), 0);

    const auditorioSinVol = auditorio;
    const auditorioConVol = totalVol + auditorio;
    const audNinezSinProfes = auditorioSinVol + ninezSinProfes;
    const totalFinal = audNinezSinProfes + totalVol;
    const totalFinalConOnline = totalFinal + online;
    const pctVol = audNinezSinProfes > 0 ? (totalVol / audNinezSinProfes) * 100 : 0;

    const repetidos = num(r.voluntarios_repetidos);

    return {
        totalVol, auditorioSinVol, auditorioConVol, ninezSinProfes, audNinezSinProfes,
        totalFinal, totalFinalConOnline, online, pctVol,
        volUnicos: Math.max(0, totalVol - repetidos),
        repetidos,
        pctOnline: totalFinalConOnline > 0 ? (online / totalFinalConOnline) * 100 : 0,
    };
};

// ─── Formato ──────────────────────────────────────────────────────────────

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
    'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const fmt = (n: number) => Math.round(n).toLocaleString('es-AR');

/** Los ISO se leen al mediodía para que el huso no corra la fecha un día. */
export const aFecha = (iso: string) => new Date(String(iso) + 'T12:00:00');

export const fechaCorta = (iso: string) => {
    if (!iso) return '—';
    const d = aFecha(iso);
    return DIAS_CORTOS[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3).toLowerCase();
};

/**
 * "Domingo 20 de septiembre de 2026".
 *
 * El navegador devuelve "domingo, 20 de septiembre de 2026": va todo en
 * minúscula y con una coma que en un título sobra. Se saca la coma y se sube
 * sólo la primera letra a mano — con `capitalize` de CSS quedaba
 * "Domingo, 20 De Septiembre De 2026", con cada palabra en mayúscula.
 */
export const fechaLarga = (iso: string) => {
    if (!iso) return '—';
    const txt = aFecha(iso)
        .toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        .replace(',', '');
    return txt.charAt(0).toUpperCase() + txt.slice(1);
};

export const fechaNumerica = (iso: string) => {
    if (!iso) return '—';
    return aFecha(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/**
 * El horario que se muestra y por el que se filtra.
 *
 * Los registros nuevos traen la hora exacta (`service_hour`), pero los años
 * viejos sólo guardaron AM o PM. Se cae a lo que haya en vez de mostrar un
 * guion: sigue siendo la única manera de distinguir dos servicios del mismo
 * domingo.
 */
export const horarioDe = (r: any): string => r?.service_hour || r?.service_time || '';

export const anioDe = (r: any): number => Number(String(r?.service_date || '').slice(0, 4)) || 0;

const semanaDelMes = (iso: string) => Math.ceil(aFecha(iso).getDate() / 7);

// ─── Contra el año anterior ───────────────────────────────────────────────

export interface Comparable {
    registro: any;
    /** Qué se usó para emparejarlos, para poder decirlo en pantalla. */
    criterio: string;
}

/**
 * Busca con qué servicio del año pasado se compara este.
 *
 * Tres intentos, del más parecido al más flojo, y cada uno dice cómo salió
 * para que la pantalla no afirme "el mismo servicio" cuando en realidad
 * encontró otra cosa:
 *
 *   1 · misma categoría y mismo horario, en la semana equivalente (−364 días
 *       cae siempre en el mismo día de la semana, no en el mismo número).
 *   2 · igual pero sin mirar la categoría, porque durante años nadie la cargó
 *       y quedó nula en casi todo lo viejo.
 *   3 · mismo mes y misma semana del mes, que es la regla con la que venía
 *       funcionando la comparación hasta ahora.
 */
export const buscarAnioAnterior = (rec: any, todos: any[]): Comparable | null => {
    if (!rec?.service_date) return null;

    const anio = anioDe(rec);
    const objetivo = aFecha(rec.service_date);
    objetivo.setDate(objetivo.getDate() - 364);
    const horario = horarioDe(rec);
    const categoria = rec.category || '';

    const delAnioAnterior = todos.filter(r => r.id !== rec.id && anioDe(r) === anio - 1);
    if (delAnioAnterior.length === 0) return null;

    const masCercano = (lista: any[], dias: number) => {
        const conDistancia = lista
            .map(r => ({ r, d: Math.abs(aFecha(r.service_date).getTime() - objetivo.getTime()) }))
            .filter(x => x.d <= dias * 86400000)
            .sort((a, b) => a.d - b.d);
        return conDistancia.length ? conDistancia[0].r : null;
    };

    const mismoHorario = delAnioAnterior.filter(r => horarioDe(r) === horario);

    const exacto = masCercano(mismoHorario.filter(r => (r.category || '') === categoria), 10);
    if (exacto) return { registro: exacto, criterio: 'misma categoría y horario, semana equivalente' };

    const porHorario = masCercano(mismoHorario, 10);
    if (porHorario) return { registro: porHorario, criterio: 'mismo horario, semana equivalente' };

    const mes = aFecha(rec.service_date).getMonth();
    const semana = semanaDelMes(rec.service_date);
    const porSemana = delAnioAnterior.find(r =>
        aFecha(r.service_date).getMonth() === mes && semanaDelMes(r.service_date) === semana
    );
    if (porSemana) return { registro: porSemana, criterio: 'misma semana del mes' };

    return null;
};
