import type { Plataforma } from '../../src/utils/instalacion';
import {
    coincidencia, funcionPorId, puedeVer,
    type ContextoDeMenu, type GrupoDeFunciones, type MenuItem,
} from './menuFunciones';

/**
 * Las reglas de la barra de accesos rápidos, sin pantalla: lo que se puede
 * probar en Node. Las medidas salen de design-claude/Barra de accesos rapidos.dc.html.
 */

// ── Los botones fijos ──────────────────────────────────────────────────────

export interface BotonFijo {
    id: 'inicio' | 'gcx' | 'notificaciones' | 'perfil';
    nombre: string;
    ruta: string;
    /** El trazo del ícono en el diseño. Notificaciones usa ICONO_CAMPANA. */
    icono: string;
}

export const ICONO_CAMPANA = 'M6 16.5V11a6 6 0 0112 0v5.5l1.5 2h-15zM10 20.5a2 2 0 004 0';

export const BOTONES_FIJOS: BotonFijo[] = [
    { id: 'inicio', nombre: 'Inicio', ruta: '/', icono: 'M3 10.5L12 3l9 7.5M5.5 9v11.5h13V9' },
    { id: 'gcx', nombre: 'GCX', ruta: '/gcx', icono: 'M15.5 20v-1.5a4 4 0 00-4-4h-4a4 4 0 00-4 4V20M9.5 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 20v-1.5a4 4 0 00-3-3.85M16 4.15a3.5 3.5 0 010 6.7' },
    { id: 'notificaciones', nombre: 'Notificaciones', ruta: '/notificaciones', icono: ICONO_CAMPANA },
    { id: 'perfil', nombre: 'Perfil', ruta: '/perfil', icono: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 21a7.5 7.5 0 0115 0' },
];

/** El lugar del botón personalizado en la barra. */
export const LUGAR_PERSONALIZADO = 4;

// ── Medidas ────────────────────────────────────────────────────────────────

export interface MedidasDeBarra {
    anchos: number[];
    altoBoton: number;
    relleno: number;
    alto: number;
    ancho: number;
}

export const medidasDeBarra = (compacta: boolean): MedidasDeBarra => {
    const anchos = compacta ? [46, 46, 46, 46, 46] : [62, 62, 86, 62, 62];
    const altoBoton = compacta ? 42 : 60;
    const relleno = compacta ? 4 : 6;
    return {
        anchos, altoBoton, relleno,
        alto: altoBoton + relleno * 2,
        ancho: anchos.reduce((a, b) => a + b, 0) + relleno * 2,
    };
};

/** Lo que mide el reproductor de abajo, y lo que la barra se separa de él. */
const ALTO_REPRODUCTOR = 96;
const SEPARACION_REPRODUCTOR = 12;

/**
 * A cuánto del borde de abajo de la PÁGINA va la barra.
 *
 * El diseño mide desde el borde físico (24 en el iPhone, 20 en Android). Acá no
 * hay viewport-fit=cover: en un teléfono la página ya termina arriba de la barra
 * de gestos y no se puede bajar más, así que se deja lo justo para que no
 * se corte la sombra. En la compu no hay gestos: los 24 del diseño. Con música,
 * flota arriba del reproductor, sin taparlo.
 */
export const distanciaAbajo = (p: Plataforma, conReproductor: boolean): number => {
    if (conReproductor) return ALTO_REPRODUCTOR + SEPARACION_REPRODUCTOR;
    return p === 'compu' ? 24 : 12;
};

/** Lo que tiene que dejar libre el final de cada pantalla. */
export const espacioReservado = (p: Plataforma, conReproductor: boolean): number =>
    distanciaAbajo(p, conReproductor) + 72 + 20;

// ── Contador ───────────────────────────────────────────────────────────────

export const textoDelContador = (n: number): string => (n > 99 ? '99+' : String(n));

export const etiquetaDeNotificaciones = (n: number): string =>
    (n > 0 ? `Notificaciones, ${n} sin leer` : 'Notificaciones');

// ── Dónde estás ────────────────────────────────────────────────────────────

/** Qué botón se enciende en esa ruta: 0 a 4, o null si ninguno. */
export const botonActivo = (ruta: string, elegido: MenuItem | null): number | null => {
    if (ruta === '/') return 0;
    if (ruta.startsWith('/gcx')) return 1;
    if (ruta.startsWith('/notificaciones')) return 2;
    if (ruta.startsWith('/perfil')) return 3;
    if (elegido && coincidencia(elegido, ruta) > 0) return LUGAR_PERSONALIZADO;
    return null;
};

/** Tocar el botón de la pantalla donde ya estás no navega: sube. */
export const yaEstaEn = (rutaActual: string, destino: string): boolean => rutaActual === destino.split('?')[0];

// ── El buscador ────────────────────────────────────────────────────────────

const sinAcentos = (texto: string) => texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const filtrarGrupos = (grupos: GrupoDeFunciones[], busqueda: string): GrupoDeFunciones[] => {
    const q = sinAcentos(busqueda.trim());
    if (!q) return grupos;
    return grupos
        .map(g => ({ ...g, items: g.items.filter(i => sinAcentos(i.label).includes(q)) }))
        .filter(g => g.items.length > 0);
};

// ── Lo elegido ─────────────────────────────────────────────────────────────

export const claveDelElegido = (userId: string): string => `origen_barra_accesos_${userId}`;

export const leerElegido = (userId: string): string | null => {
    try { return localStorage.getItem(claveDelElegido(userId)); } catch { return null; }
};

export const guardarElegido = (userId: string, id: string | null): void => {
    try {
        if (id) localStorage.setItem(claveDelElegido(userId), id);
        else localStorage.removeItem(claveDelElegido(userId));
    } catch { /* queda hasta recargar */ }
};

/**
 * La función guardada, si esa persona la puede ver; si no, null (el "+").
 *
 * No se borra lo guardado: si le devuelven el rol, vuelve sola. Mientras se
 * pregunta por Agenda Origen se da por buena, porque puedeVer dice "no" hasta
 * tener la respuesta, y el botón parpadearía en cada apertura.
 */
export const resolverElegido = (id: string | null, ctx: ContextoDeMenu): MenuItem | null => {
    const funcion = id ? funcionPorId(id) : null;
    if (!funcion || funcion.fija) return null;
    const preguntando = ctx.agenda.cargando && (funcion.path === '/agenda' || funcion.path === '/departamentos');
    return preguntando || puedeVer(funcion, ctx) ? funcion : null;
};

// ── Lo que la tapa ─────────────────────────────────────────────────────────

/**
 * Lo que hace bajar la barra, sin tocar cada hoja:
 *   · data-modal-active en el body: lo pone useBloqueoDeFondo (42 pantallas);
 *   · aria-modal y role="dialog": las que no bloquean el fondo;
 *   · .fixed.inset-0 activo: las que no tienen ni una cosa ni la otra;
 *   · data-fijo-abajo: las botoneras fijas de una pantalla, que quedarían abajo
 *     de la barra.
 */
export const SELECTOR_TAPA = '[aria-modal="true"],[role="dialog"],.fixed.inset-0:not(.pointer-events-none),[data-fijo-abajo]';

export const INPUTS_SIN_TECLADO = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image', 'hidden']);

/** Si ese elemento abre el teclado del teléfono. */
export const abreTeclado = (el: { tagName?: string; type?: string; readOnly?: boolean; disabled?: boolean; inputMode?: string; isContentEditable?: boolean } | null): boolean => {
    if (!el || el.disabled || el.readOnly || el.inputMode === 'none') return false;
    if (el.isContentEditable) return true;
    if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
    return el.tagName === 'INPUT' && !INPUTS_SIN_TECLADO.has(el.type ?? 'text');
};

/** Con esa diferencia de alto, lo que achica la pantalla es el teclado. */
export const ACHIQUE_DE_TECLADO = 120;

/** Desde este ancho hay teclado físico: el diseño deja la barra puesta. */
export const ANCHO_SIN_TECLADO = 1280;

// ── Scroll ─────────────────────────────────────────────────────────────────

/** Qué tamaño corresponde: la regla del diseño. */
export const compactaAlMover = (compacta: boolean, y: number, delta: number): boolean => {
    if (y < 24) return false;
    if (delta > 3) return true;
    if (delta < -6) return false;
    return compacta;
};
