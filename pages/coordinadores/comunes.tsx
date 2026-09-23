import React from 'react';
import { Group, GroupCategory, GroupRegistration, GroupTag, TemporadaGCX } from '../../types';
import { getSeasonFromDate } from '../../services/supabaseService';

/**
 * Piezas compartidas del panel de coordinación
 * (design-claude/Coordinadores GCX).
 *
 * El panel entero se apoya en dos colores con significado: verde para "este
 * grupo viene bien" y ámbar para "acá hay que llamar a alguien". Todo lo
 * demás es neutro a propósito, así el ámbar se ve desde lejos.
 */

export const VERDE = '#0b7a53';
export const VERDE_PUNTO = '#16a34a';
export const AMBAR = '#7a4f10';
export const AMBAR_BARRA = '#e8b96a';

// ── Temporadas ────────────────────────

export interface Recorte {
    anio: number;
    temporada: TemporadaGCX;
}

export const TEMPORADAS: TemporadaGCX[] = ['S1', 'S2', 'S3'];
export const NUMERO_TEMPORADA: Record<TemporadaGCX, string> = { S1: '1', S2: '2', S3: '3' };

/** "2026-S3". Sirve de clave para comparar recortes sin armar objetos. */
export const claveRecorte = (r: Recorte) => `${r.anio}-${r.temporada}`;

/**
 * Año y temporada de un grupo, por su fecha de arranque. Es la misma regla
 * que usa /reportes/gcx (getSeasonFromDate), así un grupo cae en la misma
 * temporada en los dos lados. null: arranca fuera de las tres ventanas,
 * como los encuentros de un día del verano.
 */
export const recorteDeGrupo = (g: Group): Recorte | null => {
    const temporada = getSeasonFromDate(g.startDate);
    if (!temporada || !g.startDate) return null;
    const anio = new Date(g.startDate + 'T12:00:00').getFullYear();
    return Number.isNaN(anio) ? null : { anio, temporada };
};

/**
 * La temporada en curso, o la próxima del año si hoy cae entre dos. Después
 * del cierre de la tercera, la tercera: es la más reciente con datos.
 */
export const recorteDeHoy = (): Recorte => {
    const hoy = new Date();
    const md = (hoy.getMonth() + 1) * 100 + hoy.getDate();
    return {
        anio: hoy.getFullYear(),
        temporada: md <= 531 ? 'S1' : md <= 823 ? 'S2' : 'S3',
    };
};

/**
 * Si el grupo ya arrancó (fecha local, no UTC). Un grupo que todavía no
 * empezó no "nunca cargó asistencia": no tuvo ninguna reunión que cargar, y
 * contarlo en las alertas llenaba de falsos llamados la temporada próxima.
 */
export const yaArranco = (g: Group): boolean =>
    !g.startDate || g.startDate <= new Date().toLocaleDateString('en-CA');

const DIA_A_INDICE: Record<string, number> = {
    'Domingo': 0, 'Lunes': 1, 'Martes': 2,
    'Miércoles': 3, 'Miercoles': 3,
    'Jueves': 4, 'Viernes': 5,
    'Sábado': 6, 'Sabado': 6,
};

/**
 * El día en que al grupo le toca su primer encuentro: el primer `meetingDay`
 * que cae en o después de su fecha de arranque.
 *
 * No es lo mismo que `startDate`. Un grupo que arranca un lunes y se reúne
 * los jueves recién debe su primera asistencia tres días después, y avisar
 * el lunes sería avisar de algo que todavía no pasó.
 *
 * null si el grupo no tiene fecha o su día de encuentro no se entiende; el
 * que llama decide con qué respaldarlo.
 */
export const primeraReunion = (g: Group): string | null => {
    const indice = DIA_A_INDICE[g.meetingDay];
    if (!g.startDate || indice === undefined) return null;

    const cursor = new Date(g.startDate + 'T12:00:00');
    if (Number.isNaN(cursor.getTime())) return null;

    while (cursor.getDay() !== indice) cursor.setDate(cursor.getDate() + 1);
    return cursor.toLocaleDateString('en-CA');
};

/**
 * Todas las fechas en que al grupo le tocó reunirse, de la primera a la
 * última, hasta hoy — o hasta su fecha de fin, si ya terminó.
 *
 * No deriva de `primeraReunion` ni al revés, aunque compartan el cálculo del
 * primer día: ésta devuelve vacío para un grupo que todavía no arrancó (no
 * tuvo ningún encuentro), y aquélla tiene que seguir respondiendo justamente
 * en ese caso, que es para lo que existe.
 */
export const fechasDeEncuentro = (g: Group): string[] => {
    const indice = DIA_A_INDICE[g.meetingDay];
    if (!g.startDate || indice === undefined) return [];

    const inicio = new Date(g.startDate + 'T12:00:00');
    if (Number.isNaN(inicio.getTime())) return [];

    const hoy = new Date().toLocaleDateString('en-CA');
    const limite = new Date((g.endDate && g.endDate < hoy ? g.endDate : hoy) + 'T12:00:00');
    if (Number.isNaN(limite.getTime()) || limite < inicio) return [];

    const cursor = new Date(inicio);
    while (cursor.getDay() !== indice) cursor.setDate(cursor.getDate() + 1);

    const fechas: string[] = [];
    while (cursor <= limite) {
        fechas.push(cursor.toLocaleDateString('en-CA'));
        cursor.setDate(cursor.getDate() + 7);
    }
    return fechas;
};

/** "jueves 1 de octubre". Mismo formato que las fechas de los reportes. */
export const fechaLarga = (fecha: string): string =>
    new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', {
        weekday: 'long', day: 'numeric', month: 'long',
    });

/**
 * Cuánto falta para una fecha, en palabras. Se compara a mediodía de los dos
 * lados para que el cambio de horario de verano no corra un día el resultado.
 */
export const cuantoFalta = (fecha: string): string => {
    const hoy = new Date(new Date().toLocaleDateString('en-CA') + 'T12:00:00');
    const dias = Math.round((new Date(fecha + 'T12:00:00').getTime() - hoy.getTime()) / 86400000);
    if (dias <= 0) return 'hoy';
    if (dias === 1) return 'mañana';
    if (dias < 7) return `en ${dias} días`;
    const semanas = Math.round(dias / 7);
    return semanas === 1 ? 'en una semana' : `en ${semanas} semanas`;
};

// ── Estado de un grupo ────────────────
export const esGrupoFinalizado = (g: Group): boolean => {
    if ((g.status as string) === 'finished') return true;
    if (!g.endDate) return false;
    return g.endDate < new Date().toISOString().split('T')[0];
};

/**
 * Cupo ocupado. Una inscripción de un grupo de parejas ocupa dos lugares:
 * es la misma regla que usan el catálogo y el panel de administración, y
 * tiene que dar el mismo número que ve un admin del mismo grupo.
 */
export const lugaresOcupados = (
    g: Group,
    categories: GroupCategory[],
    tags: GroupTag[]
): number => {
    const cat = categories.find(c => c.id === g.categoryId);
    const esParejas = (cat?.name?.toLowerCase() === 'parejas'
        || g.tags?.some(tId => tags.find(t => t.id === tId)?.name?.toLowerCase() === 'parejas'))
        && g.targetGender === 'Mixto';
    const inscriptos = g.registrations?.length || 0;
    return esParejas ? inscriptos * 2 : inscriptos;
};

/**
 * Las personas de una inscripción: el titular y, si la hay, la pareja.
 *
 * Es la misma identidad que "Personas únicas" de /reportes/gcx
 * (`personasDeInscripcion` en supabaseService): la cuenta de la persona y,
 * si no tiene, su mail; para la pareja, su cuenta, su mail o su nombre. Así
 * quien está en dos grupos es UNA persona en los dos tableros.
 *
 * `id` es cómo figura en group_attendance: el id de la inscripción, y la
 * pareja con el sufijo "-partner".
 */
export const personasDeInscripcion = (r: GroupRegistration): Array<{ clave: string; id: string }> => {
    const gente = [{ clave: r.userId || r.email || `reg-${r.id}`, id: String(r.id) }];
    if (r.partnerData) {
        const pd = r.partnerData;
        gente.push({
            clave: r.partnerUserId
                || pd.email
                || `${pd.firstName || ''}${pd.lastName || ''}`
                || `pareja-${r.id}`,
            id: `${r.id}-partner`,
        });
    }
    return gente;
};

/**
 * Quiénes están inscriptos en un grupo, sin repetir.
 *
 * Sólo las inscripciones aprobadas, igual que el tablero de reportes: una
 * pendiente todavía no es un lugar ocupado por nadie. Es lo que mide el
 * indicador "Inscriptos" del panel, y por eso puede no coincidir con el
 * cupo: el cupo cuenta lugares (una inscripción de parejas ocupa dos
 * aunque venga sola) y esto cuenta personas.
 */
export const personasDeGrupo = (g: Group): string[] => {
    const claves = new Set<string>();
    (g.registrations || []).forEach(r => {
        if (r.status !== 'APPROVED') return;
        personasDeInscripcion(r).forEach(({ clave }) => claves.add(clave));
    });
    return [...claves];
};

export const nombreAnfitrion = (g: Group): string =>
    `${g.leaderName || ''} ${g.leaderSurname || ''}`.trim() || 'Sin anfitrión';

export const primerNombre = (nombre: string): string => (nombre || '').split(' ')[0] || '';

/**
 * Iniciales para el círculo de una persona o la miniatura de un grupo.
 *
 * Se limpian los símbolos antes de cortar: media docena de grupos arrancan
 * con un emoji ("💜 El Libro Morado…") y tomar la primera posición del
 * string partía el par subrogado al medio, así que salía un rombo negro en
 * vez de una letra.
 */
export const iniciales = (nombre: string): string => {
    const soloTexto = (nombre || '').replace(/[^\p{L}\p{N}\s]/gu, ' ');
    return soloTexto
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(palabra => Array.from(palabra)[0])
        .join('')
        .toUpperCase() || '??';
};

export const conComa = (n: number): string => n.toFixed(1).replace('.', ',');

export const categoriaDe = (g: Group, categories: GroupCategory[]): string =>
    categories.find(c => c.id === g.categoryId)?.name || g.categoryName || 'Sin categoría';

/**
 * Abre WhatsApp con el teléfono del anfitrión. Devuelve false si el grupo no
 * tiene teléfono cargado, para que la pantalla pueda avisarlo en vez de
 * abrir una pestaña vacía.
 */
export const escribirlePorWhatsApp = (telefono?: string, mensaje?: string): boolean => {
    const limpio = (telefono || '').replace(/\D/g, '');
    if (!limpio) return false;
    const texto = mensaje ? `?text=${encodeURIComponent(mensaje)}` : '';
    window.open(`https://wa.me/${limpio}${texto}`, '_blank', 'noopener,noreferrer');
    return true;
};

// ── Cómo viene un grupo ───────────────
export type Tono = 'verde' | 'ambar';

export interface Senal {
    tono: Tono;
    /** Una línea para la tarjeta del listado. */
    texto: string;
    /** Título y explicación para la ficha del grupo. */
    titulo: string;
    detalle: string;
    /** Qué conviene hacer. */
    accion: string;
}

export interface GrupoConDatos {
    grupo: Group;
    /** Lugares ocupados del cupo: en parejas, una inscripción ocupa dos. */
    ocupados: number;
    /**
     * La identidad de cada persona inscripta, sin repetir. Es la misma que
     * "Personas únicas" de /reportes/gcx, así el panel y el tablero dan el
     * mismo número. Se guardan las claves y no un total para poder unirlas
     * entre grupos: quien está en dos es una sola persona.
     */
    personas: string[];
    capacidad: number;
    /** Reuniones con asistencia cargada, de la más nueva a la más vieja. */
    reportes: { fecha: string; presentes: number; ids: string[] }[];
    /** Presentes por reunión. 0 si nunca reportó. */
    promedio: number;
    reporta: boolean;
    bajas: number;
    finalizado: boolean;
    categoria: string;
}

/**
 * Un grupo que ya pasó por la aprobación de un admin.
 *
 * El panel los muestra a todos —el recorte es la temporada, no el estado—,
 * pero a un grupo sin aprobar no se le puede reclamar la asistencia: no
 * recibe inscripciones ni puede cargar reuniones. Por eso no cuenta como
 * "sin reportar" ni entra en la lista de llamados.
 */
export const estaAprobado = (g: Group): boolean =>
    g.status === 'approved' || g.status === 'finished';

export const leerSenal = (g: GrupoConDatos, promedioIglesia: number): Senal => {
    const nombre = primerNombre(nombreAnfitrion(g.grupo));

    if (!estaAprobado(g.grupo)) {
        const rechazado = g.grupo.status === 'rejected';
        return {
            tono: 'ambar',
            texto: rechazado ? 'Rechazado' : 'Esperando aprobación',
            titulo: rechazado ? 'Rechazado' : 'Esperando aprobación',
            detalle: rechazado
                ? 'Un admin rechazó este grupo, así que no recibe inscripciones ni carga asistencia. Aparece acá porque su fecha de arranque cae en esta temporada.'
                : `Todavía no lo aprobó un admin de grupos. Hasta que eso pase no recibe inscripciones ni puede cargar asistencia, así que no hay nada que reclamarle a ${nombre}.`,
            accion: rechazado ? 'No hay nada que hacer' : 'Avisarle a un admin de grupos',
        };
    }

    if (!g.reporta) {
        return {
            tono: 'ambar',
            texto: 'Nunca cargó asistencia',
            titulo: 'Nunca cargó asistencia',
            detalle: `No sabemos si se está reuniendo. ${nombre} no cargó ninguna asistencia en toda la temporada, así que el grupo no entra en ningún promedio.`,
            accion: `Pedirle a ${nombre} que cargue la asistencia`,
        };
    }

    const prom = conComa(g.promedio);
    const ref = conComa(promedioIglesia);

    if (promedioIglesia > 0 && g.promedio < promedioIglesia) {
        return {
            tono: 'ambar',
            texto: `Promedio ${prom} · por debajo de ${ref}`,
            titulo: 'Viene bajando',
            detalle: `Promedia ${prom} presentes contra ${ref} de la iglesia, y tuvo ${g.bajas} ${g.bajas === 1 ? 'baja' : 'bajas'}. Vale una charla con ${nombre}.`,
            accion: `Escribirle a ${nombre}`,
        };
    }

    return {
        tono: 'verde',
        texto: `Promedio ${prom} · viene bien`,
        titulo: 'Funcionando bien',
        detalle: promedioIglesia > 0
            ? `Promedia ${prom} presentes contra ${ref} de la iglesia. Reporta todas las semanas.`
            : `Promedia ${prom} presentes y reporta todas las semanas.`,
        accion: `Escribirle a ${nombre}`,
    };
};

// ── Piezas visuales ───────────────────

/**
 * Pastilla de estado: activo, finalizado, o el estado de aprobación.
 *
 * El panel muestra todos los grupos de la temporada, también los que
 * todavía esperan la aprobación de un admin y los que fueron rechazados.
 * Uno de esos no es un grupo "activo" aunque su fecha de arranque ya haya
 * pasado, así que dice lo que es. Va en gris a propósito: en este panel el
 * ámbar significa "llamá a alguien", y aprobar un grupo no le toca al
 * coordinador.
 */
export const PastillaEstado: React.FC<{ finalizado: boolean; estado?: Group['status'] }> = ({ finalizado, estado }) => {
    const sinAprobar = estado === 'pending' || estado === 'rejected';
    const apagada = finalizado || sinAprobar;
    return (
        <span
            className={`flex h-[26px] flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-[11px] text-[11.5px] font-semibold ${apagada ? 'bg-[#f0efec] text-black/[.62]' : 'bg-[#e7f5ee] text-[#0b7a53]'}`}
        >
            <span className={`h-1.5 w-1.5 flex-none rounded-full ${apagada ? 'bg-[#8f8f8a]' : 'bg-[#16a34a]'}`} />
            {estado === 'pending' ? 'Sin aprobar' : estado === 'rejected' ? 'Rechazado' : finalizado ? 'Finalizado' : 'Activo'}
        </span>
    );
};

/** Botón segmentado de los pares Inscriptos/Bajas y Activos/Finalizados. */
export const Segmentado: React.FC<{
    opciones: { valor: string; label: string }[];
    valor: string;
    onChange: (v: string) => void;
    fondo?: string;
}> = ({ opciones, valor, onChange, fondo = 'bg-[#f2f2f0]' }) => (
    <div className={`flex flex-none gap-[3px] rounded-full p-[3px] ${fondo}`}>
        {opciones.map(o => (
            <button
                key={o.valor}
                type="button"
                onClick={() => onChange(o.valor)}
                aria-pressed={valor === o.valor}
                className={`h-8 whitespace-nowrap rounded-full px-3.5 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] ${valor === o.valor ? 'bg-[#0a0a0a] text-white' : 'text-black/[.62] hover:text-[#0a0a0a]'}`}
            >
                {o.label}
            </button>
        ))}
    </div>
);

/** Rótulo chico de sección, en versalitas. */
export const Rotulo: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <p className={`text-[11px] font-semibold uppercase tracking-[0.07em] ${className}`}>{children}</p>
);

// ── Tramos de asistencia ──────────────

/**
 * Los cinco tramos de "cuántas veces", en el mismo orden que /reportes/gcx.
 *
 * La rampa sí cambia. Allá son azules porque el azul es el color del tablero
 * y no quiere decir nada; acá el color quiere decir algo — verde es "esto
 * viene bien", ámbar es "hay que llamar a alguien". Así que va del verde de
 * "estuvo en todas" al ámbar de "no estuvo en ninguna", con el mismo verde
 * cada vez más lavado en el medio.
 */
export const TRAMOS_ASISTENCIA = [
    { clave: 'todas', nombre: 'A todas', color: VERDE },
    { clave: 'seisOMas', nombre: '6 o más veces', color: '#3f9b78' },
    { clave: 'cuatroACinco', nombre: '4 a 5 veces', color: '#79bc9f' },
    { clave: 'unaATres', nombre: '1 a 3 veces', color: '#b6dbc8' },
    { clave: 'ninguna', nombre: 'Ninguna', color: AMBAR_BARRA },
] as const;

export type ClaveTramo = typeof TRAMOS_ASISTENCIA[number]['clave'];
export type TramosContados = Record<ClaveTramo, number>;

/** Lo que necesita una torta para dibujarse: los cinco tramos y su base. */
export interface TortaDeTramos {
    conteo: TramosContados;
    total: number;
    pct: number;
}

/**
 * Reparte cosas contables —personas o grupos— en los cinco tramos.
 *
 * `completo` lo decide quien llama y no sale de `veces >= posibles`. Para un
 * grupo, "a todas" es no haberse salteado ninguna de las reuniones que le
 * tocaban, y una reunión corrida de día suma en `veces` sin tapar el hueco
 * que dejó la que faltó. Es justamente la cuenta que /reportes/gcx hace mal.
 */
export const clasificarTramos = (items: Array<{ veces: number; completo: boolean }>): TramosContados => {
    const acc: TramosContados = { todas: 0, seisOMas: 0, cuatroACinco: 0, unaATres: 0, ninguna: 0 };
    items.forEach(({ veces, completo }) => {
        if (veces === 0) acc.ninguna += 1;
        else if (completo) acc.todas += 1;
        else if (veces >= 6) acc.seisOMas += 1;
        else if (veces >= 4) acc.cuatroACinco += 1;
        else acc.unaATres += 1;
    });
    return acc;
};

/** Cierra el trío que pide una torta: los tramos, la base y el % del centro. */
export const armarTorta = (items: Array<{ veces: number; completo: boolean }>): TortaDeTramos => {
    const conteo = clasificarTramos(items);
    const total = items.length;
    return { conteo, total, pct: total > 0 ? Math.round(((total - conteo.ninguna) / total) * 100) : 0 };
};

const R_TORTA = 48;
const GROSOR_TORTA = 18;
const VUELTA = 2 * Math.PI * R_TORTA;

/**
 * El anillo de tramos con su leyenda.
 *
 * Es SVG a mano y no Recharts: el panel de coordinación no lo importa en
 * ningún lado, y un anillo de cinco arcos no justifica traer la librería.
 *
 * `lado` pone el anillo al costado de la leyenda de 640px para arriba. Lo
 * usan las tarjetas a lo ancho del panel; en la columna angosta de una ficha
 * las dos cosas no entran, así que ahí se apila siempre.
 */
export const TortaTramos: React.FC<TortaDeTramos & {
    etiqueta: string;
    rotuloBase: string;
    lado?: boolean;
}> = ({ conteo, total, pct, etiqueta, rotuloBase, lado = false }) => {
    // El largo de cada arco se mide sobre la posición acumulada y no de a uno:
    // así los arcos cierran la vuelta exacta en vez de dejar una hendija de
    // medio píxel entre tramo y tramo.
    let recorrido = 0;
    const arcos = TRAMOS_ASISTENCIA.map(t => {
        const valor = conteo[t.clave];
        const desde = (recorrido / Math.max(1, total)) * VUELTA;
        recorrido += valor;
        const hasta = (recorrido / Math.max(1, total)) * VUELTA;
        return { ...t, valor, desde, largo: hasta - desde };
    });

    return (
        <div className={lado ? 'flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7' : ''}>
            <div className={`relative mx-auto h-[168px] w-[168px] flex-none ${lado ? 'sm:mx-0 sm:h-[152px] sm:w-[152px]' : 'sm:h-[186px] sm:w-[186px]'}`}>
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
                    <circle cx="60" cy="60" r={R_TORTA} fill="none" stroke="#eceae6" strokeWidth={GROSOR_TORTA} />
                    {arcos.filter(a => a.valor > 0).map(a => (
                        <circle
                            key={a.clave}
                            cx="60" cy="60" r={R_TORTA}
                            fill="none"
                            stroke={a.color}
                            strokeWidth={GROSOR_TORTA}
                            strokeDasharray={`${a.largo} ${VUELTA - a.largo}`}
                            strokeDashoffset={-a.desde}
                        />
                    ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[32px] font-semibold tracking-[-0.035em] text-[#0a0a0a]">{pct}%</span>
                    <span className="mt-[3px] text-[11.5px] font-medium text-black/[.5]">{etiqueta}</span>
                </div>
            </div>

            <div className="min-w-0 flex-1">
                {arcos.map(a => (
                    <div key={a.clave} className="flex items-center gap-2.5 border-b border-[#f4f3f1] py-[9px]">
                        <span className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: a.color }} />
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-black/[.72]">
                            {a.nombre}
                        </span>
                        <span className="flex-none text-[12.5px] font-semibold tabular-nums text-[#0a0a0a]">
                            {a.valor}
                        </span>
                        <span className="w-[38px] flex-none text-right text-[12px] font-medium tabular-nums text-black/[.45]">
                            {total > 0 ? Math.round((a.valor / total) * 100) : 0}%
                        </span>
                    </div>
                ))}
                <div className="flex items-center justify-between gap-3 pt-[11px]">
                    <span className="text-[12.5px] font-medium text-black/[.62]">{rotuloBase}</span>
                    <span className="text-[12.5px] font-semibold tabular-nums text-[#0a0a0a]">{total}</span>
                </div>
            </div>
        </div>
    );
};

/** Tarjeta blanca de estado vacío. */
export const TarjetaVacia: React.FC<{
    titulo: string;
    texto: string;
    children?: React.ReactNode;
}> = ({ titulo, texto, children }) => (
    <div className="flex flex-col items-center rounded-[20px] bg-white px-[30px] py-12 text-center">
        <p className="text-[17px] font-semibold text-[#0a0a0a]">{titulo}</p>
        <p className="mt-[9px] max-w-[330px] text-[13.5px] font-medium leading-[1.6] text-black/[.62]">{texto}</p>
        {children}
    </div>
);
