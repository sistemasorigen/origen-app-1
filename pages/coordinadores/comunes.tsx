import React from 'react';
import { Group, GroupCategory, GroupTag, TemporadaGCX } from '../../types';
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
    ocupados: number;
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

export const leerSenal = (g: GrupoConDatos, promedioIglesia: number): Senal => {
    const nombre = primerNombre(nombreAnfitrion(g.grupo));

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

/** Pastilla de estado: activo o finalizado. */
export const PastillaEstado: React.FC<{ finalizado: boolean }> = ({ finalizado }) => (
    <span
        className={`flex h-[26px] flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-[11px] text-[11.5px] font-semibold ${finalizado ? 'bg-[#f0efec] text-black/[.62]' : 'bg-[#e7f5ee] text-[#0b7a53]'}`}
    >
        <span className={`h-1.5 w-1.5 flex-none rounded-full ${finalizado ? 'bg-[#8f8f8a]' : 'bg-[#16a34a]'}`} />
        {finalizado ? 'Finalizado' : 'Activo'}
    </span>
);

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
