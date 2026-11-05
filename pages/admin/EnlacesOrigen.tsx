import React, { useEffect, useState } from 'react';
import { Plus, Link2 } from 'lucide-react';
import { PedidoConfirmacion } from './piezasAdmin';
import {
    CamposDeTarjeta, ElegirDestino, FilaVisible, HojaDelEditor, ListaOrdenable, PieDelEditor,
    destinoCorto as destinoCortoDe, destinoElegido, destinoElegidoValido, leerDestino, FUNCIONES, ROTULO,
    type Estado,
} from './piezasDeTarjetas';
import { TarjetaDeLink } from '../../components/inicio/SeccionDeEnlaces';
import {
    getLinksAdmin, crearLink, actualizarLink, borrarLink, reordenarLinks,
    diasParaVencer, hoyArgentino,
    type LinkDeNovedad, type TipoDeDestino,
} from '../../services/novedades';

/**
 * Los enlaces del inicio, desde el panel (design-claude/Admin - Links).
 *
 * La tabla sigue llamándose novedades_links: nació junto con una página
 * /novedades que terminó siendo esta tira en el inicio. Renombrarla en
 * producción no arregla nada que esté roto.
 *
 * Tres cosas que no se ven y conviene saber:
 *
 *   · La lista, la hoja y los campos son piezas compartidas con Recursos Origen
 *     (piezasDeTarjetas.tsx). Acá queda lo que es propio de un enlace.
 *   · Las validaciones de acá son las mismas reglas que el CHECK de la base,
 *     escritas igual. No es una comodidad: es lo que evita que el panel deje
 *     guardar algo que la base va a rechazar.
 *   · La vista previa es la MISMA tarjeta que dibuja el inicio, importada.
 *     Una copia se vería parecida hoy y distinta dentro de dos meses.
 */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "18 oct", en días de calendario y sin pasar por new Date('YYYY-MM-DD'). */
const fechaCorta = (iso: string): string => {
    const mes = Number(iso.slice(5, 7)) - 1;
    return `${Number(iso.slice(8, 10))} ${MESES[mes] || ''}`;
};

/** Lo que se lee en la columna del medio: "forms.gle/…" o "En Origen · Eventos". */
const destinoCorto = (l: LinkDeNovedad): string => destinoCortoDe(l.tipoDestino === 'externo', l.destino);

const estadoDe = (l: LinkDeNovedad): Estado => {
    const dias = diasParaVencer(l.vence);
    if (dias !== null && dias < 0) return { texto: 'Vencido', fondo: '#f2f2f0', tinta: 'rgba(0,0,0,.5)', tachado: true };
    if (!l.visible) return { texto: 'Oculto', fondo: '#f2f2f0', tinta: 'rgba(0,0,0,.62)' };
    if (dias !== null && dias <= 7) return { texto: `Vence el ${fechaCorta(l.vence as string)}`, fondo: '#fbf0e2', tinta: '#8a5a12' };
    return { texto: 'Visible', fondo: '#e7f5ee', tinta: '#0b7a53' };
};

// ── El borrador del editor ──────────────────────────────────────────────

interface Borrador {
    id?: string;
    titulo: string;
    descripcion: string;
    tipo: TipoDeDestino;
    /** Cuál de las funciones de Origen, o 'otra'. */
    funcion: string;
    ruta: string;
    url: string;
    /** El fondo de la tarjeta, con su encuadre. '' = sin imagen. */
    imagenUrl: string;
    focalX: number;
    focalY: number;
    zoom: number;
    vence: string;
    visible: boolean;
    orden: number;
}

const VACIO: Borrador = {
    titulo: '', descripcion: '', tipo: 'interno',
    funcion: FUNCIONES[0].id, ruta: '', url: '',
    imagenUrl: '', focalX: 50, focalY: 50, zoom: 1,
    vence: '', visible: true, orden: 0,
};

const aBorrador = (l: LinkDeNovedad): Borrador => {
    const destino = leerDestino(l.tipoDestino === 'externo', l.destino);
    return {
        id: l.id,
        titulo: l.titulo,
        descripcion: l.descripcion || '',
        ...destino,
        imagenUrl: l.imagenUrl || '',
        focalX: l.focalX ?? 50,
        focalY: l.focalY ?? 50,
        zoom: l.zoom ?? 1,
        vence: l.vence || '',
        visible: l.visible,
        orden: l.orden,
    };
};

const destinoDe = (b: Borrador): string => destinoElegido(b);

const esValido = (b: Borrador) => {
    const titulo = b.titulo.trim().length >= 1 && b.titulo.trim().length <= 60;
    const destino = destinoElegidoValido(b);
    return { titulo, destino, todo: titulo && destino };
};

/** La tarjeta de la vista previa, armada con lo que hay escrito. */
const comoSeVeria = (b: Borrador): LinkDeNovedad => ({
    id: b.id || 'vista-previa',
    titulo: b.titulo.trim() || 'Título del link',
    descripcion: b.descripcion.trim() || null,
    tipoDestino: b.tipo,
    destino: destinoDe(b) || '/',
    imagenUrl: b.imagenUrl || null,
    focalX: b.focalX,
    focalY: b.focalY,
    zoom: b.zoom,
    vence: b.vence || null,
    visible: b.visible,
    orden: b.orden,
    createdAt: null,
});

// ── La subsección ───────────────────────────────────────────────────────

const EnlacesOrigen: React.FC<{
    pedirConfirmacion: (p: PedidoConfirmacion) => void;
    avisar: (texto: string, tipo?: 'ok' | 'error') => void;
}> = ({ pedirConfirmacion, avisar }) => {
    const [links, setLinks] = useState<LinkDeNovedad[] | null>(null);
    const [error, setError] = useState(false);
    const [editando, setEditando] = useState<Borrador | null>(null);

    // Reordenar: mientras guarda, la lista se queda como la dejó la mano.
    const [guardandoOrden, setGuardandoOrden] = useState(false);

    const cargar = async () => {
        const lista = await getLinksAdmin();
        if (!lista) { setError(true); setLinks([]); return; }
        setError(false);
        setLinks(lista);
    };

    useEffect(() => { cargar(); }, []);

    // ── Orden ───────────────────────────────────────────────────────────

    const guardarOrden = async (nueva: LinkDeNovedad[]) => {
        const previa = links || [];
        setLinks(nueva);
        setGuardandoOrden(true);
        const ok = await reordenarLinks(nueva.map(l => l.id));
        setGuardandoOrden(false);
        if (!ok) {
            setLinks(previa);
            avisar('No se pudo guardar el orden. Quedó como estaba.', 'error');
        }
    };

    // ── Visible / oculto, con guardado inmediato ────────────────────────

    const alternarVisible = async (l: LinkDeNovedad) => {
        if (!links) return;
        const previa = links;
        setLinks(links.map(x => (x.id === l.id ? { ...x, visible: !x.visible } : x)));
        // Van TODOS los campos: el servicio arma la fila entera, así que lo
        // que no se mande se guardaría en null. Sin esto, prender y apagar
        // un enlace le borraba la imagen.
        const ok = await actualizarLink(l.id, {
            titulo: l.titulo,
            descripcion: l.descripcion,
            tipoDestino: l.tipoDestino,
            destino: l.destino,
            imagenUrl: l.imagenUrl,
            focalX: l.focalX,
            focalY: l.focalY,
            zoom: l.zoom,
            vence: l.vence,
            visible: !l.visible,
        });
        if (!ok) {
            setLinks(previa);
            avisar('No se pudo cambiar. Quedó como estaba.', 'error');
            return;
        }
        avisar(l.visible ? 'Oculto en el inicio' : 'Visible en el inicio');
    };

    // ── Guardar y borrar ────────────────────────────────────────────────

    const guardar = async (b: Borrador): Promise<boolean> => {
        const datos = {
            titulo: b.titulo.trim(),
            descripcion: b.descripcion.trim() || null,
            tipoDestino: b.tipo,
            destino: destinoDe(b),
            imagenUrl: b.imagenUrl || null,
            focalX: b.focalX,
            focalY: b.focalY,
            zoom: b.zoom,
            vence: b.vence || null,
            visible: b.visible,
        };

        if (b.id) {
            const ok = await actualizarLink(b.id, datos);
            if (!ok) return false;
            avisar('Cambios guardados');
        } else {
            // Al final de la fila: el orden lo decide quien ordena, no el reloj.
            const ultimo = (links || []).reduce((m, l) => Math.max(m, l.orden), -1);
            const creado = await crearLink({ ...datos, orden: ultimo + 1 });
            if (!creado) return false;
            avisar('Link creado: quedó al final de la lista');
        }

        await cargar();
        return true;
    };

    const pedirBorrar = (b: Borrador) => {
        pedirConfirmacion({
            tipo: 'destructivo',
            titulo: `¿Borrar «${b.titulo.trim() || 'este link'}»?`,
            texto: 'Deja de verse en el inicio al instante. No se puede deshacer desde acá.',
            detalleTitulo: 'A dónde llevaba',
            detalle: destinoDe(b) || '—',
            etiquetaBoton: 'Sí, borrar el link',
            onConfirmar: async () => {
                if (!b.id) return;
                const ok = await borrarLink(b.id);
                if (!ok) { avisar('No se pudo borrar.', 'error'); return; }
                setEditando(null);
                avisar('Link borrado');
                await cargar();
            },
        });
    };

    // ── Pantalla ────────────────────────────────────────────────────────

    const lista = links || [];
    const cargando = links === null;

    return (
        <div className="mt-3.5 overflow-hidden rounded-[20px] bg-white">

            <div className="flex flex-wrap items-start gap-x-4 gap-y-3 px-5 py-[18px] md:px-[22px]">
                <div className="min-w-0 flex-[1_1_240px]">
                    <p className="text-[16px] font-semibold text-[#0a0a0a]">
                        Enlaces Origen · {lista.length}
                    </p>
                    <p className="mt-1.5 text-[12.5px] font-medium leading-[1.55] text-black/[.62]">
                        Se muestran en el inicio, de a tres y en este orden.
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
                    Nuevo link
                </button>
            </div>

            {cargando && (
                <p className="px-5 pb-6 text-[13px] font-medium text-black/[.6] md:px-[22px]">Cargando los links…</p>
            )}

            {!cargando && error && (
                <p className="mx-5 mb-[22px] rounded-[16px] bg-[#fdf1ef] px-4 py-3.5 text-[13px] font-semibold leading-[1.55] text-[#a32218] md:mx-[22px]">
                    No se pudieron traer los enlaces. Probá recargar la página.
                </p>
            )}

            {!cargando && !error && lista.length === 0 && (
                <div className="mx-5 mb-[22px] flex flex-col items-center rounded-[16px] bg-[#f7f7f5] px-[22px] py-11 text-center md:mx-5">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ecebe7]">
                        <Link2 className="h-6 w-6 text-black/50" strokeWidth={2} />
                    </span>
                    <p className="mt-4 max-w-[320px] text-[14.5px] font-semibold leading-[1.55] text-[#0a0a0a]">
                        Todavía no hay enlaces. Creá el primero y va a aparecer en el inicio.
                    </p>
                    <button
                        type="button"
                        onClick={() => setEditando({ ...VACIO })}
                        className="mt-[18px] h-12 rounded-full bg-[#0a0a0a] px-[22px] text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                    >
                        Crear el primer link
                    </button>
                </div>
            )}

            {!cargando && lista.length > 0 && (
                <ListaOrdenable
                    lista={lista}
                    columna="Link"
                    guardando={guardandoOrden}
                    estadoDe={estadoDe}
                    detalleDe={destinoCorto}
                    onCambiarOrden={guardarOrden}
                    onAlternarVisible={alternarVisible}
                    onEditar={l => setEditando(aBorrador(l))}
                    nota="Los vencidos dejan de verse solos y quedan acá hasta que los borres."
                />
            )}

            <EditorDeLink
                borrador={editando}
                onCerrar={() => setEditando(null)}
                onGuardar={guardar}
                onBorrar={pedirBorrar}
            />
        </div>
    );
};

// ── El editor ───────────────────────────────────────────────────────────

const EditorDeLink: React.FC<{
    borrador: Borrador | null;
    onCerrar: () => void;
    onGuardar: (b: Borrador) => Promise<boolean>;
    onBorrar: (b: Borrador) => void;
}> = ({ borrador, onCerrar, onGuardar, onBorrar }) => {
    const [b, setB] = useState<Borrador>(VACIO);
    const [tocado, setTocado] = useState<{ titulo?: boolean; destino?: boolean }>({});
    const [guardando, setGuardando] = useState(false);
    const [falloAlGuardar, setFalloAlGuardar] = useState(false);

    const abierto = borrador !== null;

    useEffect(() => {
        if (borrador) {
            setB(borrador);
            setTocado({});
            setFalloAlGuardar(false);
        }
    }, [borrador]);

    const v = esValido(b);

    const guardar = async () => {
        setTocado({ titulo: true, destino: true });
        if (!v.todo) return;
        setGuardando(true);
        const ok = await onGuardar(b);
        setGuardando(false);
        // Si la base lo rechaza, la hoja se queda abierta con todo escrito.
        if (ok) onCerrar(); else setFalloAlGuardar(true);
    };

    return (
        <HojaDelEditor abierto={abierto} titulo={b.id ? 'Editar link' : 'Nuevo link'} onCerrar={onCerrar}>
                            <div className="mt-4 grid items-start gap-[22px] md:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">

                                {/* ── El formulario ── */}
                                <div className="min-w-0">
                                    <CamposDeTarjeta
                                        valores={b}
                                        onCambio={cambios => setB(x => ({ ...x, ...cambios }))}
                                        tituloValido={v.titulo}
                                        tituloTocado={!!tocado.titulo}
                                        onTocarTitulo={() => setTocado(t => ({ ...t, titulo: true }))}
                                        ejemploDeTitulo="Ej.: Contanos tu testimonio"
                                        rotuloDeImagen="Imagen de fondo"
                                        carpeta="enlaces"
                                    />

                                    <ElegirDestino
                                        valor={b}
                                        onCambio={cambios => setB(x => ({ ...x, ...cambios }))}
                                        tocado={!!tocado.destino}
                                        onTocar={() => setTocado(t => ({ ...t, destino: true }))}
                                    />

                                    <label className="mt-4 block">
                                        <span className={ROTULO}>
                                            Vence <span className="font-medium normal-case tracking-normal text-black/55">· opcional</span>
                                        </span>
                                        <span className="flex items-center gap-2">
                                            <input
                                                type="date"
                                                value={b.vence}
                                                min={hoyArgentino()}
                                                onChange={e => setB({ ...b, vence: e.target.value })}
                                                className="h-[46px] min-w-0 flex-1 px-3.5 text-[14.5px] font-medium"
                                            />
                                            {b.vence && (
                                                <button
                                                    type="button"
                                                    onClick={() => setB({ ...b, vence: '' })}
                                                    className="h-9 flex-none rounded-full bg-[#f2f2f0] px-3 text-[12.5px] font-semibold text-[#0a0a0a]"
                                                >
                                                    Quitar
                                                </button>
                                            )}
                                        </span>
                                    </label>
                                    <p className="mt-1.5 text-[12px] text-black/60">El día siguiente deja de mostrarse solo.</p>

                                    <FilaVisible visible={b.visible} onCambiar={() => setB({ ...b, visible: !b.visible })} />
                                </div>

                                {/* ── La vista previa: la tarjeta del inicio ── */}
                                <div className="min-w-0">
                                    <p className={ROTULO}>Vista previa en el inicio</p>
                                    <div className="rounded-[18px] bg-slate-50 p-4">
                                        <TarjetaDeLink link={comoSeVeria(b)} onAbrir={() => { }} vistaPrevia />
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
                                    La base no aceptó el link. Revisá el destino: una ruta de la app empieza con “/”,
                                    y un link externo con “https://”. No se perdió nada de lo que escribiste.
                                </p>
                            )}

                            <PieDelEditor
                                textoBorrar={b.id ? 'Borrar link' : undefined}
                                onBorrar={() => onBorrar(b)}
                                onCancelar={onCerrar}
                                onGuardar={guardar}
                                puedeGuardar={v.todo}
                                guardando={guardando}
                            />
        </HojaDelEditor>
    );
};

export default EnlacesOrigen;
