import React, { useEffect, useRef, useState } from 'react';
import { FileText, Library, Link2, Play, Mic, Plus, Upload } from 'lucide-react';
import { PedidoConfirmacion } from './piezasAdmin';
import {
    CamposDeTarjeta, ElegirDestino, FilaVisible, HojaDelEditor, ListaOrdenable, PieDelEditor,
    destinoCorto, destinoElegido, destinoElegidoValido, leerDestino, FUNCIONES, ROTULO,
    type EleccionDeDestino, type Estado,
} from './piezasDeTarjetas';
import { TarjetaDeRecurso } from '../../components/inicio/SeccionDeRecursos';
import {
    actualizarRecurso, borrarArchivosDeRecurso, borrarRecurso, cambiarVisibleDeRecurso, categoriaDe, crearRecurso,
    esLinkExterno, getRecursosAdmin, idDeEpisodio, idDeVideo, miniaturaDeVideo, problemaDelArchivo, reordenarRecursos,
    subirArchivoDeRecurso, urlDeEpisodio, urlDeVideo, TIPOS_DE_ARCHIVO,
    type Recurso, type RecursoParaGuardar, type TipoDeArchivo, type TipoDeRecurso,
} from '../../services/recursos';

/**
 * Los recursos del inicio, desde Configuración de la app. Lo carga sólo
 * Sistemas: la base no deja escribir a ningún otro rol.
 *
 * Es el panel de Enlaces Origen con cuatro tipos: comparten la lista, la hoja,
 * los campos y la vista previa, que es la tarjeta de verdad.
 *
 * Lo que no se ve: un archivo se sube apenas se elige, antes de guardar, para
 * poder mostrar el avance. Por eso el editor lleva la cuenta de lo subido y no
 * guardado: si se cancela o se cambia, se borra del bucket y no queda basura.
 */

const TIPOS: { id: TipoDeRecurso; nombre: string; bajada: string; Icono: typeof Link2 }[] = [
    { id: 'link', nombre: 'Link', bajada: 'Una página o una pantalla de la app', Icono: Link2 },
    { id: 'archivo', nombre: 'Archivo', bajada: 'Un PDF o una imagen', Icono: FileText },
    { id: 'video', nombre: 'Video de YouTube', bajada: 'Se mira en la app', Icono: Play },
    { id: 'podcast', nombre: 'Podcast de Spotify', bajada: 'Se escucha en la app', Icono: Mic },
];

const nombreDelTipo = (t: TipoDeRecurso) => TIPOS.find(x => x.id === t)?.nombre || '';

const estadoDe = (r: Recurso): Estado => (r.visible
    ? { texto: 'Visible', fondo: '#e7f5ee', tinta: '#0b7a53' }
    : { texto: 'Oculto', fondo: '#f2f2f0', tinta: 'rgba(0,0,0,.62)' });

const detalleDe = (r: Recurso): string => {
    if (r.tipo === 'archivo') return r.archivoTipo === 'pdf' ? 'Archivo PDF' : 'Imagen';
    if (r.tipo === 'video') return 'Video de YouTube';
    if (r.tipo === 'podcast') return `Podcast · ${r.pastor || ''}`;
    return destinoCorto(esLinkExterno(r), r.destino);
};

// ── El borrador ─────────────────────────────────────────────────────────

interface Borrador extends EleccionDeDestino {
    id?: string;
    /** null = todavía no se eligió: es el primer paso de un alta. */
    tipoDeRecurso: TipoDeRecurso | null;
    titulo: string;
    descripcion: string;
    imagenUrl: string;
    focalX: number;
    focalY: number;
    zoom: number;
    archivoUrl: string;
    archivoPath: string;
    archivoTipo: TipoDeArchivo | null;
    urlVideo: string;
    urlPodcast: string;
    pastor: string;
    duracion: string;
    visible: boolean;
    orden: number;
}

const VACIO: Borrador = {
    tipoDeRecurso: null, titulo: '', descripcion: '',
    imagenUrl: '', focalX: 50, focalY: 50, zoom: 1,
    tipo: 'externo', funcion: FUNCIONES[0].id, ruta: '', url: '',
    archivoUrl: '', archivoPath: '', archivoTipo: null,
    urlVideo: '', urlPodcast: '', pastor: '', duracion: '',
    visible: true, orden: 0,
};

const aBorrador = (r: Recurso): Borrador => ({
    ...VACIO,
    ...(r.tipo === 'link' ? leerDestino(esLinkExterno(r), r.destino) : {}),
    id: r.id,
    tipoDeRecurso: r.tipo,
    titulo: r.titulo,
    descripcion: r.descripcion || '',
    imagenUrl: r.imagenUrl || '',
    focalX: r.focalX,
    focalY: r.focalY,
    zoom: r.zoom,
    archivoUrl: r.tipo === 'archivo' ? r.destino : '',
    archivoPath: r.archivoPath || '',
    archivoTipo: r.archivoTipo,
    urlVideo: r.tipo === 'video' ? r.destino : '',
    urlPodcast: r.tipo === 'podcast' ? r.destino : '',
    pastor: r.pastor || '',
    duracion: r.duracion || '',
    visible: r.visible,
    orden: r.orden,
});

/** Lo que se guarda como destino: la forma limpia, sin lo que agrega el botón de copiar. */
const destinoDe = (b: Borrador): string => {
    if (b.tipoDeRecurso === 'link') return destinoElegido(b);
    if (b.tipoDeRecurso === 'archivo') return b.archivoUrl;
    if (b.tipoDeRecurso === 'video') {
        const id = idDeVideo(b.urlVideo);
        return id ? urlDeVideo(id) : '';
    }
    const id = idDeEpisodio(b.urlPodcast);
    return id ? urlDeEpisodio(id) : '';
};

/** Las mismas reglas que los CHECK de recursos_origen. */
const esValido = (b: Borrador) => {
    const titulo = b.titulo.trim().length >= 1 && b.titulo.trim().length <= 60;
    let destino = false;
    if (b.tipoDeRecurso === 'link') destino = destinoElegidoValido(b);
    if (b.tipoDeRecurso === 'archivo') destino = !!b.archivoUrl && !!b.archivoPath && !!b.archivoTipo;
    if (b.tipoDeRecurso === 'video') destino = !!idDeVideo(b.urlVideo);
    if (b.tipoDeRecurso === 'podcast') destino = !!idDeEpisodio(b.urlPodcast);
    const pastor = b.tipoDeRecurso !== 'podcast' || (b.pastor.trim().length >= 1 && b.pastor.trim().length <= 60);
    return { titulo, destino, pastor, todo: titulo && destino && pastor };
};

const aGuardar = (b: Borrador): RecursoParaGuardar => {
    const tipo = b.tipoDeRecurso as TipoDeRecurso;
    return {
        titulo: b.titulo.trim(),
        descripcion: b.descripcion.trim() || null,
        tipo,
        destino: destinoDe(b),
        imagenUrl: b.imagenUrl || null,
        focalX: b.focalX,
        focalY: b.focalY,
        zoom: b.zoom,
        archivoPath: tipo === 'archivo' ? b.archivoPath : null,
        archivoTipo: tipo === 'archivo' ? b.archivoTipo : null,
        pastor: tipo === 'podcast' ? b.pastor.trim() : null,
        duracion: tipo === 'podcast' ? (b.duracion.trim() || null) : null,
        visible: b.visible,
    };
};

/** La tarjeta de la vista previa, armada con lo que hay escrito. */
const comoSeVeria = (b: Borrador): Recurso => {
    const tipo = b.tipoDeRecurso || 'link';
    return {
        id: b.id || 'vista-previa',
        titulo: b.titulo.trim() || 'Título del recurso',
        descripcion: b.descripcion.trim() || null,
        tipo,
        categoria: categoriaDe(tipo),
        destino: destinoDe(b) || '/',
        imagenUrl: b.imagenUrl || null,
        focalX: b.focalX,
        focalY: b.focalY,
        zoom: b.zoom,
        archivoPath: b.archivoPath || null,
        archivoTipo: b.archivoTipo,
        pastor: b.pastor || null,
        duracion: b.duracion || null,
        visible: b.visible,
        orden: b.orden,
        createdAt: null,
    };
};

// ── La subsección ───────────────────────────────────────────────────────

const RecursosOrigen: React.FC<{
    pedirConfirmacion: (p: PedidoConfirmacion) => void;
    avisar: (texto: string, tipo?: 'ok' | 'error') => void;
}> = ({ pedirConfirmacion, avisar }) => {
    const [recursos, setRecursos] = useState<Recurso[] | null>(null);
    const [error, setError] = useState(false);
    const [editando, setEditando] = useState<Borrador | null>(null);
    const [guardandoOrden, setGuardandoOrden] = useState(false);

    const cargar = async () => {
        const lista = await getRecursosAdmin();
        if (!lista) { setError(true); setRecursos([]); return; }
        setError(false);
        setRecursos(lista);
    };

    useEffect(() => { cargar(); }, []);

    const guardarOrden = async (nueva: Recurso[]) => {
        const previa = recursos || [];
        setRecursos(nueva);
        setGuardandoOrden(true);
        const ok = await reordenarRecursos(nueva.map(r => r.id));
        setGuardandoOrden(false);
        if (!ok) {
            setRecursos(previa);
            avisar('No se pudo guardar el orden. Quedó como estaba.', 'error');
        }
    };

    const alternarVisible = async (r: Recurso) => {
        const previa = recursos || [];
        setRecursos(previa.map(x => (x.id === r.id ? { ...x, visible: !x.visible } : x)));
        const ok = await cambiarVisibleDeRecurso(r.id, !r.visible);
        if (!ok) {
            setRecursos(previa);
            avisar('No se pudo cambiar. Quedó como estaba.', 'error');
            return;
        }
        avisar(r.visible ? 'Oculto en el inicio' : 'Visible en el inicio');
    };

    const guardar = async (b: Borrador): Promise<boolean> => {
        const datos = aGuardar(b);
        if (b.id) {
            const antes = (recursos || []).find(r => r.id === b.id)?.archivoPath;
            const ok = await actualizarRecurso(b.id, datos);
            if (!ok) return false;
            // Cambió el archivo: el anterior recién se borra con la fila ya guardada.
            if (antes && antes !== datos.archivoPath) await borrarArchivosDeRecurso([antes]);
            avisar('Cambios guardados');
        } else {
            const ultimo = (recursos || []).reduce((m, r) => Math.max(m, r.orden), -1);
            const creado = await crearRecurso({ ...datos, orden: ultimo + 1 });
            if (!creado) return false;
            avisar('Recurso creado: quedó al final de la lista');
        }
        await cargar();
        return true;
    };

    const pedirBorrar = (b: Borrador) => {
        const conArchivo = b.tipoDeRecurso === 'archivo';
        const original = (recursos || []).find(r => r.id === b.id);
        pedirConfirmacion({
            tipo: 'destructivo',
            titulo: `¿Borrar «${b.titulo.trim() || 'este recurso'}»?`,
            texto: conArchivo
                ? 'Deja de verse en el inicio al instante y se borra también el archivo: el link que se haya compartido deja de funcionar. No se puede deshacer.'
                : 'Deja de verse en el inicio al instante. No se puede deshacer desde acá.',
            detalleTitulo: 'Qué es',
            detalle: b.tipoDeRecurso ? nombreDelTipo(b.tipoDeRecurso) : '—',
            etiquetaBoton: 'Sí, borrar el recurso',
            onConfirmar: async () => {
                if (!b.id) return;
                // Primero la fila: un archivo huérfano no se ve, y una tarjeta que
                // apunta a un archivo borrado, sí.
                const ok = await borrarRecurso(b.id);
                if (!ok) { avisar('No se pudo borrar.', 'error'); return; }
                setEditando(null);
                const archivo = original?.archivoPath;
                const sinResto = archivo ? await borrarArchivosDeRecurso([archivo]) : true;
                if (sinResto) avisar('Recurso borrado');
                else avisar('El recurso se borró, pero el archivo quedó guardado.', 'error');
                await cargar();
            },
        });
    };

    const lista = recursos || [];
    const cargando = recursos === null;

    return (
        <div className="mt-3.5 overflow-hidden rounded-[20px] bg-white">
            <div className="flex flex-wrap items-start gap-x-4 gap-y-3 px-5 py-[18px] md:px-[22px]">
                <div className="min-w-0 flex-[1_1_240px]">
                    <p className="text-[16px] font-semibold text-[#0a0a0a]">
                        Recursos Origen · {lista.length}
                    </p>
                    <p className="mt-1.5 text-[12.5px] font-medium leading-[1.55] text-black/[.62]">
                        El material de Origen y los podcasts. Se muestran en el inicio, en este orden.
                    </p>
                    <a
                        href="#/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex min-h-[32px] items-center gap-1.5 text-[12.5px] font-semibold text-[#0a0a0a] underline underline-offset-[3px]"
                    >
                        Ver el inicio ↗
                    </a>
                </div>
                <button
                    type="button"
                    onClick={() => setEditando({ ...VACIO })}
                    className="flex h-[44px] flex-none items-center gap-2 rounded-full bg-[#0a0a0a] px-[18px] text-[13px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 md:h-[38px] md:text-[12.5px]"
                >
                    <Plus className="h-4 w-4" strokeWidth={2.4} />
                    Nuevo recurso
                </button>
            </div>

            {cargando && (
                <p className="px-5 pb-6 text-[13px] font-medium text-black/[.6] md:px-[22px]">Cargando los recursos…</p>
            )}

            {!cargando && error && (
                <p className="mx-5 mb-[22px] rounded-[16px] bg-[#fdf1ef] px-4 py-3.5 text-[13px] font-semibold leading-[1.55] text-[#a32218] md:mx-[22px]">
                    No se pudieron traer los recursos. Probá recargar la página.
                </p>
            )}

            {!cargando && !error && lista.length === 0 && (
                <div className="mx-5 mb-[22px] flex flex-col items-center rounded-[16px] bg-[#f7f7f5] px-[22px] py-11 text-center md:mx-5">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ecebe7]">
                        <Library className="h-6 w-6 text-black/50" strokeWidth={2} />
                    </span>
                    <p className="mt-4 max-w-[320px] text-[14.5px] font-semibold leading-[1.55] text-[#0a0a0a]">
                        Todavía no hay recursos. Creá el primero y va a aparecer en el inicio.
                    </p>
                    <button
                        type="button"
                        onClick={() => setEditando({ ...VACIO })}
                        className="mt-[18px] h-12 rounded-full bg-[#0a0a0a] px-[22px] text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                    >
                        Crear el primer recurso
                    </button>
                </div>
            )}

            {!cargando && lista.length > 0 && (
                <ListaOrdenable
                    lista={lista}
                    columna="Recurso"
                    guardando={guardandoOrden}
                    estadoDe={estadoDe}
                    detalleDe={detalleDe}
                    onCambiarOrden={guardarOrden}
                    onAlternarVisible={alternarVisible}
                    onEditar={r => setEditando(aBorrador(r))}
                />
            )}

            <EditorDeRecurso
                borrador={editando}
                onCerrar={() => setEditando(null)}
                onGuardar={guardar}
                onBorrar={pedirBorrar}
            />
        </div>
    );
};

// ── El editor ───────────────────────────────────────────────────────────

const PILDORA = 'h-11 rounded-full bg-[#f2f2f0] px-4 text-[13px] font-semibold text-[#0a0a0a] disabled:opacity-50';
const ERROR = 'mt-1.5 text-[12px] font-semibold text-[#b42318]';
const AYUDA = 'mt-1.5 text-[12px] text-black/60';

const EditorDeRecurso: React.FC<{
    borrador: Borrador | null;
    onCerrar: () => void;
    onGuardar: (b: Borrador) => Promise<boolean>;
    onBorrar: (b: Borrador) => void;
}> = ({ borrador, onCerrar, onGuardar, onBorrar }) => {
    const [b, setB] = useState<Borrador>(VACIO);
    const [tocado, setTocado] = useState<{ titulo?: boolean; destino?: boolean; pastor?: boolean }>({});
    const [guardando, setGuardando] = useState(false);
    const [falloAlGuardar, setFalloAlGuardar] = useState(false);
    const [avance, setAvance] = useState<number | null>(null);
    const [errorDeArchivo, setErrorDeArchivo] = useState('');
    const [buscandoMiniatura, setBuscandoMiniatura] = useState(false);

    const elegirArchivo = useRef<HTMLInputElement>(null);
    /** Lo subido en esta edición y todavía sin guardar: si se cancela, se borra. */
    const sinGuardar = useRef<string | null>(null);
    /** Cambia al cerrar: una subida que termina después ya no tiene a quién avisarle. */
    const turno = useRef(0);

    const abierto = borrador !== null;

    useEffect(() => {
        if (borrador) {
            setB(borrador);
            setTocado({});
            setFalloAlGuardar(false);
            setAvance(null);
            setErrorDeArchivo('');
        }
    }, [borrador]);

    const v = esValido(b);
    const subiendo = avance !== null;
    const cambiar = (cambios: Partial<Borrador>) => setB(x => ({ ...x, ...cambios }));

    const descartarLoSubido = () => {
        if (sinGuardar.current) borrarArchivosDeRecurso([sinGuardar.current]);
        sinGuardar.current = null;
    };

    // Acá y no en un botón: la hoja se cierra también desde afuera, al confirmar
    // el borrado de un recurso, y lo subido en esa edición no puede quedar suelto.
    useEffect(() => {
        if (abierto) return;
        turno.current += 1;
        descartarLoSubido();
    }, [abierto]);

    const guardar = async () => {
        setTocado({ titulo: true, destino: true, pastor: true });
        if (!v.todo || subiendo) return;
        setGuardando(true);
        const ok = await onGuardar(b);
        setGuardando(false);
        if (ok) {
            // Ya es el archivo del recurso: al cerrar no hay nada que descartar.
            sinGuardar.current = null;
            onCerrar();
        } else {
            setFalloAlGuardar(true);
        }
    };

    const cambiarDeTipo = () => {
        descartarLoSubido();
        turno.current += 1;
        setAvance(null);
        setErrorDeArchivo('');
        setTocado({});
        // Una portada que era el archivo se va con el archivo.
        setB(x => ({
            ...x,
            tipoDeRecurso: null,
            archivoUrl: '', archivoPath: '', archivoTipo: null,
            ...(x.imagenUrl && x.imagenUrl === x.archivoUrl ? { imagenUrl: '', focalX: 50, focalY: 50, zoom: 1 } : {}),
        }));
    };

    const alElegirArchivo = async (archivo: File | undefined) => {
        if (elegirArchivo.current) elegirArchivo.current.value = '';
        if (!archivo) return;
        const problema = problemaDelArchivo(archivo);
        setErrorDeArchivo(problema);
        if (problema) return;

        const mio = turno.current;
        setAvance(0);
        try {
            const subido = await subirArchivoDeRecurso(archivo, setAvance);
            if (mio !== turno.current) {
                // Se cerró la hoja mientras subía.
                borrarArchivosDeRecurso([subido.path]);
                return;
            }
            descartarLoSubido();
            sinGuardar.current = subido.path;
            setB(x => ({
                ...x,
                archivoUrl: subido.url, archivoPath: subido.path, archivoTipo: subido.tipo,
                ...(x.imagenUrl && x.imagenUrl === x.archivoUrl ? { imagenUrl: '', focalX: 50, focalY: 50, zoom: 1 } : {}),
            }));
            setTocado(t => ({ ...t, destino: true }));
        } catch (e) {
            if (mio === turno.current) setErrorDeArchivo((e as Error).message);
        } finally {
            if (mio === turno.current) setAvance(null);
        }
    };

    const usarMiniatura = async () => {
        const id = idDeVideo(b.urlVideo);
        if (!id) return;
        setBuscandoMiniatura(true);
        const url = await miniaturaDeVideo(id);
        setBuscandoMiniatura(false);
        cambiar({ imagenUrl: url, focalX: 50, focalY: 50, zoom: 1 });
    };

    const titulo = b.id ? 'Editar recurso' : 'Nuevo recurso';

    // ── Primer paso de un alta: el tipo ─────────────────────────────────
    // Mira también el borrador que llega: al abrir un recurso que ya existe, `b`
    // tarda un render en cargarse y no tiene que asomar este paso.
    if (abierto && !borrador?.id && b.tipoDeRecurso === null) {
        return (
            <HojaDelEditor abierto titulo={titulo} onCerrar={onCerrar}>
                <p className="mt-1.5 text-[13.5px] font-medium text-black/[.62]">¿Qué vas a publicar?</p>
                <div className="mt-3.5 grid gap-2 md:grid-cols-2">
                    {TIPOS.map(({ id, nombre, bajada, Icono }) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => cambiar({ tipoDeRecurso: id })}
                            className="flex min-h-[72px] items-center gap-3.5 rounded-[14px] bg-[#f7f7f5] px-3.5 py-2.5 text-left text-[#0a0a0a] transition-colors hover:bg-[#ecebe7]"
                        >
                            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white">
                                <Icono className="h-5 w-5" strokeWidth={2} />
                            </span>
                            <span className="flex min-w-0 flex-col gap-0.5">
                                <span className="text-[14px] font-semibold">{nombre}</span>
                                <span className="text-[12px] font-medium opacity-70">{bajada}</span>
                            </span>
                        </button>
                    ))}
                </div>
                <PieDelEditor onCancelar={onCerrar} />
            </HojaDelEditor>
        );
    }

    return (
        <HojaDelEditor abierto={abierto} titulo={titulo} onCerrar={onCerrar}>
            <div className="mt-4 grid items-start gap-[22px] md:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
                <div className="min-w-0">
                    {/* El tipo elegido. En un recurso que ya existe no se cambia:
                        sería otro recurso, con otros campos. */}
                    <div className="mb-3.5 flex min-h-11 items-center gap-2.5">
                        <span className="inline-flex h-[30px] items-center rounded-full bg-[#0a0a0a] px-3 text-[12.5px] font-semibold text-white">
                            {b.tipoDeRecurso ? nombreDelTipo(b.tipoDeRecurso) : ''}
                        </span>
                        {!b.id && (
                            <button type="button" onClick={cambiarDeTipo} className="min-h-11 px-1 text-[12.5px] font-semibold text-black/[.62] underline underline-offset-[3px]">
                                Cambiar el tipo
                            </button>
                        )}
                    </div>

                    {/* ── Lo propio de cada tipo ── */}
                    {b.tipoDeRecurso === 'archivo' && (
                        <div className="mb-4">
                            <p className={ROTULO}>El archivo</p>
                            <input
                                ref={elegirArchivo}
                                type="file"
                                accept={TIPOS_DE_ARCHIVO}
                                aria-label="Elegir el archivo"
                                onChange={e => alElegirArchivo(e.target.files?.[0])}
                                style={{ display: 'none' }}
                            />
                            {subiendo ? (
                                <div className="rounded-[14px] bg-[#f7f7f5] px-3.5 py-3">
                                    <p className="text-[13px] font-semibold text-[#0a0a0a]">Subiendo… {avance}%</p>
                                    <div
                                        role="progressbar"
                                        aria-label="Avance de la subida"
                                        aria-valuenow={avance ?? 0}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#ecebe7]"
                                    >
                                        <div className="h-full rounded-full bg-[#0a0a0a] transition-[width]" style={{ width: `${avance}%` }} />
                                    </div>
                                </div>
                            ) : b.archivoUrl ? (
                                <div className="flex flex-wrap items-center gap-2.5 rounded-[14px] bg-[#f7f7f5] px-3.5 py-2.5">
                                    <span className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-[10px] bg-white">
                                        {b.archivoTipo === 'imagen'
                                            ? <img src={b.archivoUrl} alt="" className="h-full w-full object-cover" />
                                            : <FileText className="h-5 w-5 text-[#0a0a0a]" strokeWidth={2} />}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[13.5px] font-semibold text-[#0a0a0a]">{b.archivoTipo === 'pdf' ? 'PDF subido' : 'Imagen subida'}</p>
                                        <a href={b.archivoUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] font-semibold text-black/[.62] underline underline-offset-[3px]">
                                            Abrir el archivo ↗
                                        </a>
                                    </div>
                                    <button type="button" onClick={() => elegirArchivo.current?.click()} className="h-11 rounded-full bg-white px-4 text-[13px] font-semibold text-[#0a0a0a]">
                                        Cambiar
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => elegirArchivo.current?.click()}
                                    className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#0a0a0a] text-[14px] font-semibold text-white"
                                >
                                    <Upload className="h-4 w-4" strokeWidth={2.2} />
                                    Elegir un PDF o una imagen
                                </button>
                            )}
                            {errorDeArchivo
                                ? <p role="alert" className={ERROR}>{errorDeArchivo}</p>
                                : <p className={AYUDA}>PDF, JPG, PNG o WebP. Hasta 20 MB.</p>}
                            {b.archivoTipo === 'imagen' && b.archivoUrl && !subiendo && (
                                b.imagenUrl === b.archivoUrl
                                    ? <p className={AYUDA}>Esta imagen es la portada.</p>
                                    : (
                                        <button
                                            type="button"
                                            onClick={() => cambiar({ imagenUrl: b.archivoUrl, focalX: 50, focalY: 50, zoom: 1 })}
                                            className={`${PILDORA} mt-2.5`}
                                        >
                                            Usar esta imagen como portada
                                        </button>
                                    )
                            )}
                        </div>
                    )}

                    {b.tipoDeRecurso === 'video' && (
                        <div className="mb-4">
                            <label className="block">
                                <span className={ROTULO}>Link del video de YouTube</span>
                                <input
                                    type="url"
                                    value={b.urlVideo}
                                    placeholder="https://www.youtube.com/watch?v=…"
                                    onChange={e => cambiar({ urlVideo: e.target.value })}
                                    onBlur={() => setTocado(t => ({ ...t, destino: true }))}
                                    className="h-[46px] w-full px-3.5 text-[14.5px] font-medium"
                                />
                            </label>
                            {tocado.destino && !v.destino
                                ? <p className={ERROR}>{b.urlVideo.trim() ? 'No es el link de un video de YouTube. Copialo desde el botón Compartir del video.' : 'Falta el link del video.'}</p>
                                : <p className={AYUDA}>Se mira adentro de la app.</p>}
                            {v.destino && (
                                <button type="button" onClick={usarMiniatura} disabled={buscandoMiniatura} className={`${PILDORA} mt-2.5`}>
                                    {buscandoMiniatura ? 'Buscando la miniatura…' : 'Usar la miniatura del video como portada'}
                                </button>
                            )}
                        </div>
                    )}

                    {b.tipoDeRecurso === 'podcast' && (
                        <div className="mb-4">
                            <label className="block">
                                <span className={ROTULO}>Link del episodio de Spotify</span>
                                <input
                                    type="url"
                                    value={b.urlPodcast}
                                    placeholder="https://open.spotify.com/episode/…"
                                    onChange={e => cambiar({ urlPodcast: e.target.value })}
                                    onBlur={() => setTocado(t => ({ ...t, destino: true }))}
                                    className="h-[46px] w-full px-3.5 text-[14.5px] font-medium"
                                />
                            </label>
                            {tocado.destino && !v.destino
                                ? <p className={ERROR}>{b.urlPodcast.trim() ? 'Tiene que ser el link de un episodio: open.spotify.com/episode/… No sirve el del programa entero.' : 'Falta el link del episodio.'}</p>
                                : <p className={AYUDA}>Se escucha adentro de la app.</p>}

                            <div className="mt-3.5 grid grid-cols-[minmax(0,1fr)_132px] gap-2.5">
                                <label className="block min-w-0">
                                    <span className={ROTULO}>Pastor</span>
                                    <input
                                        type="text"
                                        value={b.pastor}
                                        maxLength={60}
                                        placeholder="Quién habla"
                                        onChange={e => cambiar({ pastor: e.target.value })}
                                        onBlur={() => setTocado(t => ({ ...t, pastor: true }))}
                                        className="h-[46px] w-full px-3.5 text-[14.5px] font-medium"
                                    />
                                </label>
                                <label className="block min-w-0">
                                    <span className={ROTULO}>
                                        Duración <span className="font-medium normal-case tracking-normal text-black/55">· opcional</span>
                                    </span>
                                    <input
                                        type="text"
                                        value={b.duracion}
                                        maxLength={20}
                                        placeholder="32 min"
                                        aria-label="Duración, opcional"
                                        onChange={e => cambiar({ duracion: e.target.value })}
                                        className="h-[46px] w-full px-3.5 text-[14.5px] font-medium"
                                    />
                                </label>
                            </div>
                            {tocado.pastor && !v.pastor && <p className={ERROR}>Falta el nombre del pastor.</p>}
                        </div>
                    )}

                    <CamposDeTarjeta
                        valores={b}
                        onCambio={cambiar}
                        tituloValido={v.titulo}
                        tituloTocado={!!tocado.titulo}
                        onTocarTitulo={() => setTocado(t => ({ ...t, titulo: true }))}
                        ejemploDeTitulo="Ej.: Liderar con honra"
                        rotuloDeImagen="Portada"
                        carpeta="recursos"
                    />

                    {b.tipoDeRecurso === 'link' && (
                        <ElegirDestino
                            valor={b}
                            onCambio={cambiar}
                            tocado={!!tocado.destino}
                            onTocar={() => setTocado(t => ({ ...t, destino: true }))}
                        />
                    )}

                    <FilaVisible visible={b.visible} onCambiar={() => cambiar({ visible: !b.visible })} />
                </div>

                {/* ── La vista previa: la tarjeta del inicio ── */}
                <div className="min-w-0">
                    <p className={ROTULO}>Vista previa en el inicio</p>
                    <div className="rounded-[18px] bg-slate-50 p-4">
                        <TarjetaDeRecurso recurso={comoSeVeria(b)} onAbrir={() => { }} vistaPrevia />
                    </div>
                    {!b.visible && (
                        <p className="mt-2.5 px-0.5 text-[12px] font-semibold text-slate-500">
                            Oculto: no se va a ver hasta que lo prendas.
                        </p>
                    )}
                </div>
            </div>

            {falloAlGuardar && (
                <p className="mt-4 rounded-[14px] bg-[#fdf1ef] px-4 py-3 text-[13px] font-semibold leading-[1.5] text-[#a32218]">
                    No se pudo guardar. Revisá los datos y probá de nuevo: no se perdió nada de lo que escribiste.
                </p>
            )}

            <PieDelEditor
                textoBorrar={b.id ? 'Borrar recurso' : undefined}
                onBorrar={() => onBorrar(b)}
                onCancelar={onCerrar}
                onGuardar={guardar}
                puedeGuardar={v.todo && !subiendo}
                guardando={guardando}
            />
        </HojaDelEditor>
    );
};

export default RecursosOrigen;
