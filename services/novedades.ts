import { supabase } from './supabaseClient';

/**
 * Los links de /novedades.
 *
 * Una lista corta que carga un SUPER_ADMIN y que ve cualquiera. La base ya
 * filtra lo que no corresponde —oculto o vencido— con su RLS, así que acá no
 * se vuelve a filtrar: si alguna vez hay que cambiar la regla, se cambia en
 * un solo lugar.
 *
 * Dos cuidados que no se ven:
 *
 *   · Al abrir un link se vuelve a mirar el destino, aunque la base ya lo
 *     haya validado con un CHECK. Es la misma barrera dos veces: lo que
 *     termina adentro de window.open o de navigate no puede depender de que
 *     nadie se haya equivocado antes.
 *   · Las fechas de vencimiento son 'YYYY-MM-DD' y NO pasan por new Date():
 *     ahí serían medianoche UTC, que en Argentina es el día anterior a las
 *     21:00. Se comparan como día contra día.
 */

const HUSO = 'America/Argentina/Buenos_Aires';

// ── Tipos ───────────────────────────────────────────────────────────────

export type TipoDeDestino = 'interno' | 'externo';

export interface LinkDeNovedad {
    id: string;
    titulo: string;
    descripcion: string | null;
    tipoDestino: TipoDeDestino;
    destino: string;
    /** El fondo de la tarjeta. null = tarjeta blanca, con el texto solo. */
    imagenUrl: string | null;
    /** El encuadre de esa imagen, como en los banners: 0-100 % y 1 a 3. */
    focalX: number;
    focalY: number;
    zoom: number;
    /** 'YYYY-MM-DD' o null. Último día en que se muestra. */
    vence: string | null;
    visible: boolean;
    orden: number;
    createdAt: string | null;
}

/** Lo que se puede cargar o cambiar desde el panel (prompt 3). */
export interface LinkParaGuardar {
    titulo: string;
    descripcion?: string | null;
    tipoDestino: TipoDeDestino;
    destino: string;
    imagenUrl?: string | null;
    focalX?: number;
    focalY?: number;
    zoom?: number;
    vence?: string | null;
    visible?: boolean;
    orden?: number;
}

interface FilaCruda {
    id: string;
    titulo: string;
    descripcion: string | null;
    tipo_destino: string;
    destino: string;
    imagen_url: string | null;
    focal_x: number | null;
    focal_y: number | null;
    zoom: number | null;
    vence: string | null;
    visible: boolean;
    orden: number;
    created_at: string | null;
}

const mapear = (f: FilaCruda): LinkDeNovedad => ({
    id: f.id,
    titulo: f.titulo,
    descripcion: f.descripcion,
    tipoDestino: f.tipo_destino === 'externo' ? 'externo' : 'interno',
    destino: f.destino,
    imagenUrl: f.imagen_url,
    // La base los manda como texto cuando son numeric; el ?? no alcanza.
    focalX: Number(f.focal_x ?? 50),
    focalY: Number(f.focal_y ?? 50),
    zoom: Number(f.zoom ?? 1),
    vence: f.vence,
    visible: f.visible,
    orden: f.orden,
    createdAt: f.created_at,
});

const aFila = (l: LinkParaGuardar) => ({
    titulo: l.titulo,
    descripcion: l.descripcion ?? null,
    tipo_destino: l.tipoDestino,
    destino: l.destino,
    imagen_url: l.imagenUrl ?? null,
    focal_x: Math.round(l.focalX ?? 50),
    focal_y: Math.round(l.focalY ?? 50),
    zoom: l.zoom ?? 1,
    vence: l.vence ?? null,
    ...(l.visible === undefined ? {} : { visible: l.visible }),
    ...(l.orden === undefined ? {} : { orden: l.orden }),
});

const aviso = (donde: string, error: unknown) => {
    const motivo = (error as { message?: string })?.message || String(error);
    console.error(`[novedades] ${donde}: ${motivo}`);
};

// ── Cuentas puras ───────────────────────────────────────────────────────

/** Los días de un 'YYYY-MM-DD' como instante UTC, para restar días con días. */
const comoDia = (iso: string): number =>
    Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

/** Hoy en Argentina, 'YYYY-MM-DD'. */
export const hoyArgentino = (): string =>
    new Intl.DateTimeFormat('en-CA', { timeZone: HUSO }).format(new Date());

/**
 * Cuántos días faltan para que venza, en días de calendario argentinos.
 * 0 es hoy, 1 mañana, y un negativo ya venció. Sin vencimiento, null.
 */
export const diasParaVencer = (vence: string | null | undefined): number | null => {
    if (!vence || vence.length < 10) return null;
    const dia = comoDia(vence);
    if (Number.isNaN(dia)) return null;
    return Math.round((dia - comoDia(hoyArgentino())) / 86400000);
};

/** La pastilla de la tarjeta. Sólo aparece cuando falta una semana o menos. */
export const textoDeVencimiento = (vence: string | null | undefined): string | null => {
    const dias = diasParaVencer(vence);
    if (dias === null || dias < 0 || dias > 7) return null;
    if (dias === 0) return 'Cierra hoy';
    if (dias === 1) return 'Cierra mañana';
    return `Cierra en ${dias} días`;
};

/** A dónde lleva, para que un lector de pantalla lo diga antes de entrar. */
export const etiquetaDeLink = (link: LinkDeNovedad): string =>
    link.tipoDestino === 'externo'
        ? `${link.titulo}, abre en otra pestaña`
        : `${link.titulo}, ir a esta pantalla`;

/**
 * Abre el link. Es la segunda barrera: la primera es el CHECK de la base.
 *
 * Interno tiene que ser una ruta de la app ('/algo', nunca '//dominio', que
 * el navegador trata como otro sitio). Externo, https:// y nada más —así no
 * entran javascript:, data: ni http://—. Lo que no cumple, no se abre.
 */
export const abrirLink = (link: LinkDeNovedad, navigate: (ruta: string) => void): void => {
    const destino = (link.destino || '').trim();

    if (link.tipoDestino === 'interno' && destino.startsWith('/') && !destino.startsWith('//')) {
        navigate(destino);
        return;
    }
    if (link.tipoDestino === 'externo' && destino.startsWith('https://')) {
        window.open(destino, '_blank', 'noopener,noreferrer');
        return;
    }

    console.error(`[novedades] destino rechazado (${link.tipoDestino}): ${destino}`);
};

// ── Consultas ───────────────────────────────────────────────────────────

/**
 * Los links que se muestran en /novedades. La RLS ya deja afuera los
 * ocultos y los vencidos; acá sólo se ordena.
 */
export const getLinksPublicos = async (): Promise<LinkDeNovedad[] | null> => {
    const { data, error } = await supabase
        .from('novedades_links')
        .select('*')
        .order('orden', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) { aviso('getLinksPublicos', error); return null; }
    return ((data || []) as FilaCruda[]).map(mapear);
};

// ── Lo que usa el panel (prompt 3) ──────────────────────────────────────

/** Todos, también los ocultos y los vencidos. Sólo para SUPER_ADMIN. */
export const getLinksAdmin = async (): Promise<LinkDeNovedad[] | null> => {
    const { data, error } = await supabase
        .from('novedades_links')
        .select('*')
        .order('orden', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) { aviso('getLinksAdmin', error); return null; }
    return ((data || []) as FilaCruda[]).map(mapear);
};

export const crearLink = async (link: LinkParaGuardar): Promise<LinkDeNovedad | null> => {
    const { data, error } = await supabase
        .from('novedades_links')
        .insert(aFila(link))
        .select()
        .single();

    if (error) { aviso('crearLink', error); return null; }
    return mapear(data as FilaCruda);
};

export const actualizarLink = async (id: string, cambios: Partial<LinkParaGuardar>): Promise<boolean> => {
    const { error } = await supabase
        .from('novedades_links')
        .update(aFila(cambios as LinkParaGuardar))
        .eq('id', id);

    if (error) { aviso('actualizarLink', error); return false; }
    return true;
};

export const borrarLink = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('novedades_links').delete().eq('id', id);
    if (error) { aviso('borrarLink', error); return false; }
    return true;
};

/**
 * Guarda el orden nuevo: cada id queda con la posición que ocupa en la
 * lista. Son tantos UPDATE como links, que para una lista de pantalla —diez,
 * quince— es menos ruido que una RPC propia. Si alguno falla, devuelve false
 * y la pantalla vuelve a leer: no deja el orden a medias en pantalla.
 */
export const reordenarLinks = async (ids: string[]): Promise<boolean> => {
    const resultados = await Promise.all(ids.map((id, i) =>
        supabase.from('novedades_links').update({ orden: i }).eq('id', id)));

    const falla = resultados.find(r => r.error);
    if (falla) { aviso('reordenarLinks', falla.error); return false; }
    return true;
};
