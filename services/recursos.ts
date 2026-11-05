import { supabase } from './supabaseClient';

/**
 * Recursos Origen: el material de Origen y los podcasts de los pastores.
 *
 * Mismo molde que services/novedades.ts. Lo carga un SUPER_ADMIN y lo ve
 * cualquiera. Tres cuidados que no se ven:
 *
 *   · Las reglas de acá son las de los CHECK de sql/recursos_origen.sql,
 *     escritas igual. Lo que no las cumple no se guarda, no se abre y no entra
 *     en un iframe: son dos barreras para lo mismo, a propósito.
 *   · Los links se limpian antes de validar. Lo que se copia de Spotify suele
 *     traer /intl-es/ y ?si=…, y eso no es un error de quien carga: la base
 *     guarda siempre la forma limpia.
 *   · El inicio pide `visible = true` aunque la RLS ya lo filtre: la RLS le deja
 *     ver los ocultos a un SUPER_ADMIN, que tiene que ver el inicio como todos.
 */

// ── Tipos ───────────────────────────────────────────────────────────────

export type TipoDeRecurso = 'link' | 'archivo' | 'video' | 'podcast';
export type CategoriaDeRecurso = 'material' | 'podcast';
export type TipoDeArchivo = 'pdf' | 'imagen';

export interface Recurso {
    id: string;
    titulo: string;
    descripcion: string | null;
    tipo: TipoDeRecurso;
    categoria: CategoriaDeRecurso;
    destino: string;
    imagenUrl: string | null;
    focalX: number;
    focalY: number;
    zoom: number;
    archivoPath: string | null;
    archivoTipo: TipoDeArchivo | null;
    pastor: string | null;
    duracion: string | null;
    visible: boolean;
    orden: number;
    createdAt: string | null;
}

export interface RecursoParaGuardar {
    titulo: string;
    descripcion: string | null;
    tipo: TipoDeRecurso;
    destino: string;
    imagenUrl: string | null;
    focalX: number;
    focalY: number;
    zoom: number;
    archivoPath: string | null;
    archivoTipo: TipoDeArchivo | null;
    pastor: string | null;
    duracion: string | null;
    visible: boolean;
    orden?: number;
}

interface FilaCruda {
    id: string;
    titulo: string;
    descripcion: string | null;
    tipo: TipoDeRecurso;
    categoria: CategoriaDeRecurso;
    destino: string;
    imagen_url: string | null;
    focal_x: number | null;
    focal_y: number | null;
    zoom: number | string | null;
    archivo_path: string | null;
    archivo_tipo: TipoDeArchivo | null;
    pastor: string | null;
    duracion: string | null;
    visible: boolean;
    orden: number;
    created_at: string | null;
}

const mapear = (f: FilaCruda): Recurso => ({
    id: f.id,
    titulo: f.titulo,
    descripcion: f.descripcion,
    tipo: f.tipo,
    categoria: f.categoria,
    destino: f.destino,
    imagenUrl: f.imagen_url,
    focalX: Number(f.focal_x ?? 50),
    focalY: Number(f.focal_y ?? 50),
    // La base lo manda como texto, porque es numeric.
    zoom: Number(f.zoom ?? 1),
    archivoPath: f.archivo_path,
    archivoTipo: f.archivo_tipo,
    pastor: f.pastor,
    duracion: f.duracion,
    visible: f.visible,
    orden: f.orden,
    createdAt: f.created_at,
});

const aFila = (r: RecursoParaGuardar) => ({
    titulo: r.titulo,
    descripcion: r.descripcion,
    tipo: r.tipo,
    categoria: categoriaDe(r.tipo),
    destino: r.destino,
    imagen_url: r.imagenUrl,
    focal_x: Math.round(r.focalX),
    focal_y: Math.round(r.focalY),
    zoom: r.zoom,
    archivo_path: r.archivoPath,
    archivo_tipo: r.archivoTipo,
    pastor: r.pastor,
    duracion: r.duracion,
    visible: r.visible,
    ...(r.orden === undefined ? {} : { orden: r.orden }),
});

const aviso = (donde: string, error: unknown) => {
    const motivo = (error as { message?: string })?.message || String(error);
    console.error(`[recursos] ${donde}: ${motivo}`);
};

// ── Las reglas: las mismas que los CHECK de la base ─────────────────────

export const RUTA_OK = /^\/[^/\s]/;
export const URL_OK = /^https:\/\/[^/\s]+/i;
const ARCHIVO_OK = /^https:\/\/[^/\s]+\/storage\/v1\/object\/public\/recursos\/\S+$/i;
const VIDEO_OK = /^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^\s#]*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#/]\S*)?$/;
const EPISODIO_OK = /^https:\/\/open\.spotify\.com\/episode\/([A-Za-z0-9]{22})(?:\?\S*)?$/;

export const categoriaDe = (tipo: TipoDeRecurso): CategoriaDeRecurso =>
    (tipo === 'podcast' ? 'podcast' : 'material');

/** El id del video, o '' si no es un link de YouTube válido. */
export const idDeVideo = (url: string): string => VIDEO_OK.exec((url || '').trim())?.[1] || '';

/** El id del episodio, o '' si no es un link de un episodio de Spotify. */
export const idDeEpisodio = (url: string): string => {
    const limpio = (url || '').trim().replace(/^(https:\/\/open\.spotify\.com)\/intl-[a-zA-Z-]+\//, '$1/');
    return EPISODIO_OK.exec(limpio)?.[1] || '';
};

/** Lo que se guarda: siempre la misma forma, sin lo que agrega el botón de copiar. */
export const urlDeVideo = (id: string): string => `https://www.youtube.com/watch?v=${id}`;
export const urlDeEpisodio = (id: string): string => `https://open.spotify.com/episode/${id}`;

export const urlEmbebidaDeVideo = (id: string): string =>
    `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1`;
export const urlEmbebidaDeEpisodio = (id: string): string =>
    `https://open.spotify.com/embed/episode/${id}`;

/**
 * La miniatura de un video, para ofrecerla de portada. La grande no existe en
 * todos los videos: cuando falta, YouTube contesta 200 con un gris de 120 × 90.
 * Por eso hay que mirar el ancho, y no alcanza con que cargue. La chica existe
 * siempre, y las dos son 16:9, sin las franjas negras de hqdefault.
 */
export const miniaturaDeVideo = (id: string): Promise<string> => new Promise(resolve => {
    const chica = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
    const grande = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
    const prueba = new Image();
    prueba.onload = () => resolve(prueba.naturalWidth > 120 ? grande : chica);
    prueba.onerror = () => resolve(chica);
    prueba.src = grande;
});

/** Si el destino de un link abre afuera. El resto de los links son una ruta de la app. */
export const esLinkExterno = (r: Pick<Recurso, 'tipo' | 'destino'>): boolean =>
    r.tipo === 'link' && URL_OK.test(r.destino);

/** Lo que se comparte: la URL del recurso. Una ruta de la app, con su #. */
export const linkParaCompartir = (r: Pick<Recurso, 'tipo' | 'destino'>): string =>
    (r.tipo === 'link' && !esLinkExterno(r)
        ? `${typeof window !== 'undefined' ? window.location.origin : 'https://app.origeniglesia.org'}/#${r.destino}`
        : r.destino);

/** Qué hace "Ir al enlace", para el lector de pantalla. */
export const etiquetaDeRecurso = (r: Pick<Recurso, 'tipo' | 'destino' | 'titulo'>): string => {
    if (r.tipo === 'video') return `Ir al enlace: ${r.titulo}, ver el video`;
    if (r.tipo === 'podcast') return `Ir al enlace: ${r.titulo}, escuchar el podcast`;
    if (r.tipo === 'archivo') return `Ir al enlace: ${r.titulo}, abre el archivo en otra pestaña`;
    return esLinkExterno(r)
        ? `Ir al enlace: ${r.titulo}, abre en otra pestaña`
        : `Ir al enlace: ${r.titulo}, ir a esta pantalla`;
};

/**
 * Abre un link o un archivo. Es la segunda barrera: la primera es el CHECK.
 * El video y el podcast no pasan por acá: se abren en la hoja del inicio.
 */
export const abrirLinkOArchivo = (r: Recurso, navigate: (ruta: string) => void): void => {
    const destino = (r.destino || '').trim();
    if (r.tipo === 'link' && RUTA_OK.test(destino)) {
        navigate(destino);
        return;
    }
    if ((r.tipo === 'link' && URL_OK.test(destino)) || (r.tipo === 'archivo' && ARCHIVO_OK.test(destino))) {
        window.open(destino, '_blank', 'noopener,noreferrer');
        return;
    }
    console.error(`[recursos] destino rechazado (${r.tipo}): ${destino}`);
};

// ── Consultas ───────────────────────────────────────────────────────────

/** Los del inicio. null = no se pudieron traer: el bloque no aparece. */
export const getRecursosPublicos = async (): Promise<Recurso[] | null> => {
    const { data, error } = await supabase
        .from('recursos_origen')
        .select('*')
        .eq('visible', true)
        .order('orden', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) { aviso('getRecursosPublicos', error); return null; }
    return ((data || []) as FilaCruda[]).map(mapear);
};

/** Todos, también los ocultos. Sólo para SUPER_ADMIN. */
export const getRecursosAdmin = async (): Promise<Recurso[] | null> => {
    const { data, error } = await supabase
        .from('recursos_origen')
        .select('*')
        .order('orden', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) { aviso('getRecursosAdmin', error); return null; }
    return ((data || []) as FilaCruda[]).map(mapear);
};

export const crearRecurso = async (r: RecursoParaGuardar): Promise<Recurso | null> => {
    const { data, error } = await supabase
        .from('recursos_origen')
        .insert(aFila(r))
        .select()
        .single();

    if (error) { aviso('crearRecurso', error); return null; }
    return mapear(data as FilaCruda);
};

export const actualizarRecurso = async (id: string, r: RecursoParaGuardar): Promise<boolean> => {
    const { error } = await supabase.from('recursos_origen').update(aFila(r)).eq('id', id);
    if (error) { aviso('actualizarRecurso', error); return false; }
    return true;
};

/** Sólo prende o apaga: no le manda el resto de la fila. */
export const cambiarVisibleDeRecurso = async (id: string, visible: boolean): Promise<boolean> => {
    const { error } = await supabase.from('recursos_origen').update({ visible }).eq('id', id);
    if (error) { aviso('cambiarVisibleDeRecurso', error); return false; }
    return true;
};

export const borrarRecurso = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('recursos_origen').delete().eq('id', id);
    if (error) { aviso('borrarRecurso', error); return false; }
    return true;
};

export const reordenarRecursos = async (ids: string[]): Promise<boolean> => {
    const resultados = await Promise.all(ids.map((id, i) =>
        supabase.from('recursos_origen').update({ orden: i }).eq('id', id)));

    const falla = resultados.find(r => r.error);
    if (falla) { aviso('reordenarRecursos', falla.error); return false; }
    return true;
};

// ── Los archivos ────────────────────────────────────────────────────────

const BUCKET = 'recursos';

/** Lo mismo que el bucket: si no coincide, Storage contesta 400 ó 413. */
export const TOPE_DE_ARCHIVO = 20 * 1024 * 1024;
const EXTENSIONES: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};
export const TIPOS_DE_ARCHIVO = Object.keys(EXTENSIONES).join(',');

/** Por qué no se puede subir este archivo, o '' si se puede. */
export const problemaDelArchivo = (archivo: { type: string; size: number }): string => {
    if (!EXTENSIONES[archivo.type]) return 'Tiene que ser un PDF o una imagen JPG, PNG o WebP.';
    if (archivo.size > TOPE_DE_ARCHIVO) {
        const mb = (archivo.size / 1024 / 1024).toFixed(1).replace('.', ',');
        return `El archivo pesa ${mb} MB y el máximo es 20 MB.`;
    }
    return '';
};

export interface ArchivoSubido { path: string; url: string; tipo: TipoDeArchivo }

/**
 * Sube un archivo y va avisando el porcentaje. Va por XMLHttpRequest porque
 * supabase.storage.upload no informa el avance, y 20 MB por datos móviles son
 * un rato largo mirando una pantalla quieta.
 *
 * Rechaza con un texto listo para mostrar.
 */
export const subirArchivoDeRecurso = async (
    archivo: File,
    alAvanzar: (porcentaje: number) => void,
): Promise<ArchivoSubido> => {
    const problema = problemaDelArchivo(archivo);
    if (problema) throw new Error(problema);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Se cerró la sesión. Volvé a entrar y probá de nuevo.');

    const azar = Math.random().toString(36).slice(2, 10);
    const path = `${Date.now()}_${azar}.${EXTENSIONES[archivo.type]}`;
    const base = import.meta.env.VITE_SUPABASE_URL as string;
    const clave = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

    await new Promise<void>((resolve, reject) => {
        const pedido = new XMLHttpRequest();
        pedido.open('POST', `${base}/storage/v1/object/${BUCKET}/${path}`);
        pedido.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
        pedido.setRequestHeader('apikey', clave);
        pedido.setRequestHeader('x-upsert', 'false');
        pedido.setRequestHeader('Content-Type', archivo.type);
        pedido.upload.onprogress = e => {
            if (e.lengthComputable) alAvanzar(Math.round((e.loaded / e.total) * 100));
        };
        pedido.onload = () => {
            if (pedido.status >= 200 && pedido.status < 300) { resolve(); return; }
            aviso('subirArchivoDeRecurso', `${pedido.status} ${pedido.responseText}`);
            reject(new Error(pedido.status === 413
                ? 'El archivo supera el máximo de 20 MB.'
                : 'No se pudo subir el archivo. Probá de nuevo.'));
        };
        pedido.onerror = () => reject(new Error('Se cortó la conexión mientras subía. Probá de nuevo.'));
        pedido.send(archivo);
    });

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { path, url: data.publicUrl, tipo: archivo.type === 'application/pdf' ? 'pdf' : 'imagen' };
};

/**
 * Borra archivos del bucket. Storage contesta bien aunque no haya borrado nada
 * (sin permiso devuelve una lista vacía), así que se mira cuántos borró.
 */
export const borrarArchivosDeRecurso = async (paths: string[]): Promise<boolean> => {
    if (paths.length === 0) return true;
    const { data, error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) { aviso('borrarArchivosDeRecurso', error); return false; }
    return (data || []).length === paths.length;
};
