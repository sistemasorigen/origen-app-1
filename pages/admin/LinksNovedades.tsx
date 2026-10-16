import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useDragControls, useReducedMotion } from 'framer-motion';
import { X, Plus, GripVertical, ChevronUp, ChevronDown, Link2 } from 'lucide-react';
import { useBloqueoDeFondo } from '../../hooks/useBloqueoDeFondo';
import { PedidoConfirmacion, Rotulo } from './piezasAdmin';
import { TarjetaDeLink } from '../novedades/Novedades';
import {
    getLinksAdmin, crearLink, actualizarLink, borrarLink, reordenarLinks,
    diasParaVencer, hoyArgentino,
    type LinkDeNovedad, type TipoDeDestino,
} from '../../services/novedades';

/**
 * Los links de /novedades, desde el panel (design-claude/Admin - Links).
 *
 * Tres cosas que no se ven y conviene saber:
 *
 *   · El orden es el de la lista, y se guarda al soltar. Mientras guarda, la
 *     lista NO se vuelve a leer: si se leyera, el orden saltaría al viejo
 *     durante medio segundo y parecería que no se guardó. Si la base dice
 *     que no, recién ahí vuelve al orden anterior y lo avisa.
 *   · Las validaciones de acá son las mismas reglas que el CHECK de la base,
 *     escritas igual. No es una comodidad: es lo que evita que el panel deje
 *     guardar algo que la base va a rechazar.
 *   · La vista previa es la MISMA tarjeta que dibuja /novedades, importada.
 *     Una copia se vería parecida hoy y distinta dentro de dos meses.
 */

// ── Las funciones de la app a las que se puede apuntar ──────────────────
// Cada ruta está verificada contra App.tsx. Si alguna se renombra, acá
// queda un link que lleva a la pantalla de "no encontrado".

interface FuncionDeOrigen { id: string; label: string; ruta: string }

const FUNCIONES: FuncionDeOrigen[] = [
    { id: 'gcx', label: 'Grupos de Conexión', ruta: '/gcx' },
    { id: 'calendario', label: 'Calendario de GCX', ruta: '/gcx/calendario' },
    { id: 'eventos', label: 'Eventos', ruta: '/eventos' },
    { id: 'punto', label: 'Punto de Información', ruta: '/punto-de-informacion' },
    { id: 'nocturna', label: 'Nocturna (inscripción)', ruta: '/nocturna-inscripcion' },
    { id: 'audiencia', label: 'Audiencia de Servicios', ruta: '/audiencia-servicios' },
    { id: 'otra', label: 'Otra ruta de la app', ruta: '' },
];

// ── Las mismas reglas que el CHECK de novedades_links ───────────────────

const RUTA_OK = /^\/[^/\s]/;
const URL_OK = /^https:\/\/[^/\s]+/i;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "18 oct", en días de calendario y sin pasar por new Date('YYYY-MM-DD'). */
const fechaCorta = (iso: string): string => {
    const mes = Number(iso.slice(5, 7)) - 1;
    return `${Number(iso.slice(8, 10))} ${MESES[mes] || ''}`;
};

const dominioDe = (url: string): string => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
};

/** Lo que se lee en la columna del medio: "forms.gle/…" o "En Origen · Eventos". */
const destinoCorto = (l: LinkDeNovedad): string => {
    if (l.tipoDestino === 'externo') {
        const dominio = dominioDe(l.destino);
        if (!dominio) return l.destino || '—';
        try {
            const u = new URL(l.destino);
            return dominio + (u.pathname.length > 1 ? '/…' : '');
        } catch { return dominio; }
    }
    const f = FUNCIONES.find(x => x.ruta && x.ruta === l.destino);
    return `En Origen · ${f ? f.label : l.destino}`;
};

interface Estado { texto: string; fondo: string; tinta: string; tachado?: boolean }

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
    vence: string;
    visible: boolean;
    orden: number;
}

const VACIO: Borrador = {
    titulo: '', descripcion: '', tipo: 'interno',
    funcion: FUNCIONES[0].id, ruta: '', url: '', vence: '', visible: true, orden: 0,
};

const aBorrador = (l: LinkDeNovedad): Borrador => {
    const f = l.tipoDestino === 'interno' ? FUNCIONES.find(x => x.ruta && x.ruta === l.destino) : undefined;
    return {
        id: l.id,
        titulo: l.titulo,
        descripcion: l.descripcion || '',
        tipo: l.tipoDestino,
        funcion: f ? f.id : 'otra',
        ruta: l.tipoDestino === 'interno' && !f ? l.destino : '',
        url: l.tipoDestino === 'externo' ? l.destino : '',
        vence: l.vence || '',
        visible: l.visible,
        orden: l.orden,
    };
};

const destinoDe = (b: Borrador): string => {
    if (b.tipo === 'externo') return b.url.trim();
    if (b.funcion === 'otra') return b.ruta.trim();
    return FUNCIONES.find(f => f.id === b.funcion)?.ruta || '';
};

const esValido = (b: Borrador) => {
    const titulo = b.titulo.trim().length >= 1 && b.titulo.trim().length <= 60;
    const destino = b.tipo === 'externo' ? URL_OK.test(b.url.trim()) : RUTA_OK.test(destinoDe(b));
    return { titulo, destino, todo: titulo && destino };
};

/** La tarjeta de la vista previa, armada con lo que hay escrito. */
const comoSeVeria = (b: Borrador): LinkDeNovedad => ({
    id: b.id || 'vista-previa',
    titulo: b.titulo.trim() || 'Título del link',
    descripcion: b.descripcion.trim() || null,
    tipoDestino: b.tipo,
    destino: destinoDe(b) || '/',
    vence: b.vence || null,
    visible: b.visible,
    orden: b.orden,
    createdAt: null,
});

// ── Piezas chicas ───────────────────────────────────────────────────────

const Interruptor: React.FC<{
    prendido: boolean;
    onClick: () => void;
    etiqueta: string;
}> = ({ prendido, onClick, etiqueta }) => (
    <button
        type="button"
        role="switch"
        aria-checked={prendido}
        aria-label={etiqueta}
        onClick={onClick}
        className="flex h-11 w-[52px] flex-none items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 rounded-full"
    >
        <span
            className="relative block h-[26px] w-11 rounded-full transition-colors"
            style={{ background: prendido ? '#0b7a53' : '#d6d4cf' }}
        >
            <span
                className="absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)] transition-[left]"
                style={{ left: prendido ? '21px' : '3px' }}
            />
        </span>
    </button>
);

const Pastilla: React.FC<{ estado: Estado }> = ({ estado }) => (
    <span
        className="inline-flex h-[26px] items-center whitespace-nowrap rounded-full px-[11px] text-[12px] font-semibold"
        style={{ background: estado.fondo, color: estado.tinta, textDecoration: estado.tachado ? 'line-through' : 'none' }}
    >
        {estado.texto}
    </span>
);

// ── La subsección ───────────────────────────────────────────────────────

const LinksNovedades: React.FC<{
    pedirConfirmacion: (p: PedidoConfirmacion) => void;
    avisar: (texto: string, tipo?: 'ok' | 'error') => void;
}> = ({ pedirConfirmacion, avisar }) => {
    const [links, setLinks] = useState<LinkDeNovedad[] | null>(null);
    const [error, setError] = useState(false);
    const [editando, setEditando] = useState<Borrador | null>(null);

    // Reordenar: mientras guarda, la lista se queda como la dejó la mano.
    const [guardandoOrden, setGuardandoOrden] = useState(false);
    const [arrastrando, setArrastrando] = useState<string | null>(null);
    const [encima, setEncima] = useState<string | null>(null);

    const cargar = async () => {
        const lista = await getLinksAdmin();
        if (!lista) { setError(true); setLinks([]); return; }
        setError(false);
        setLinks(lista);
    };

    useEffect(() => { cargar(); }, []);

    // ── Orden ───────────────────────────────────────────────────────────

    const guardarOrden = async (nueva: LinkDeNovedad[], previa: LinkDeNovedad[]) => {
        setLinks(nueva);
        setGuardandoOrden(true);
        const ok = await reordenarLinks(nueva.map(l => l.id));
        setGuardandoOrden(false);
        if (!ok) {
            setLinks(previa);
            avisar('No se pudo guardar el orden. Quedó como estaba.', 'error');
        }
    };

    const mover = (id: string, paso: -1 | 1) => {
        if (!links) return;
        const i = links.findIndex(l => l.id === id);
        const j = i + paso;
        if (i < 0 || j < 0 || j >= links.length) return;
        const nueva = links.slice();
        [nueva[i], nueva[j]] = [nueva[j], nueva[i]];
        guardarOrden(nueva, links);
    };

    const soltarSobre = (id: string) => {
        if (!links || !arrastrando || arrastrando === id) { setArrastrando(null); setEncima(null); return; }
        const desde = links.findIndex(l => l.id === arrastrando);
        const hasta = links.findIndex(l => l.id === id);
        const nueva = links.slice();
        const [movido] = nueva.splice(desde, 1);
        nueva.splice(hasta, 0, movido);
        setArrastrando(null);
        setEncima(null);
        guardarOrden(nueva, links);
    };

    // ── Visible / oculto, con guardado inmediato ────────────────────────

    const alternarVisible = async (l: LinkDeNovedad) => {
        if (!links) return;
        const previa = links;
        setLinks(links.map(x => (x.id === l.id ? { ...x, visible: !x.visible } : x)));
        const ok = await actualizarLink(l.id, {
            titulo: l.titulo,
            descripcion: l.descripcion,
            tipoDestino: l.tipoDestino,
            destino: l.destino,
            vence: l.vence,
            visible: !l.visible,
        });
        if (!ok) {
            setLinks(previa);
            avisar('No se pudo cambiar. Quedó como estaba.', 'error');
            return;
        }
        avisar(l.visible ? 'Oculto en Novedades' : 'Visible en Novedades');
    };

    // ── Guardar y borrar ────────────────────────────────────────────────

    const guardar = async (b: Borrador): Promise<boolean> => {
        const datos = {
            titulo: b.titulo.trim(),
            descripcion: b.descripcion.trim() || null,
            tipoDestino: b.tipo,
            destino: destinoDe(b),
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
            texto: 'Deja de verse en Novedades al instante. No se puede deshacer desde acá.',
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
                        Links de Novedades · {lista.length}
                    </p>
                    <p className="mt-1.5 text-[12.5px] font-medium leading-[1.55] text-black/[.62]">
                        Se muestran en /novedades en este orden.
                    </p>
                    <a
                        href="#/novedades"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex min-h-[32px] items-center gap-1.5 text-[12.5px] font-semibold text-[#0a0a0a] underline underline-offset-[3px]"
                    >
                        Ver la página ↗
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
                    No se pudieron traer los links. Probá recargar la página.
                </p>
            )}

            {!cargando && !error && lista.length === 0 && (
                <div className="mx-5 mb-[22px] flex flex-col items-center rounded-[16px] bg-[#f7f7f5] px-[22px] py-11 text-center md:mx-5">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ecebe7]">
                        <Link2 className="h-6 w-6 text-black/50" strokeWidth={2} />
                    </span>
                    <p className="mt-4 max-w-[320px] text-[14.5px] font-semibold leading-[1.55] text-[#0a0a0a]">
                        Todavía no hay links. Creá el primero y va a aparecer en Novedades.
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
                <>
                    {/* La cabecera de la planilla, sólo en la compu. */}
                    <div className="hidden border-y border-[#f0efec] bg-[#fafaf8] px-[22px] py-2.5 md:grid md:grid-cols-[36px_minmax(0,1fr)_150px_64px_92px] md:gap-3.5">
                        <span />
                        <Rotulo className="text-black/[.5]">Link</Rotulo>
                        <Rotulo className="text-black/[.5]">Estado</Rotulo>
                        <Rotulo className="text-black/[.5]">Visible</Rotulo>
                        <span />
                    </div>

                    <ul className="list-none p-0" style={{ opacity: guardandoOrden ? 0.75 : 1 }}>
                        {lista.map((l, i) => {
                            const estado = estadoDe(l);
                            const esElQueViaja = arrastrando === l.id;
                            return (
                                <li
                                    key={l.id}
                                    draggable
                                    onDragStart={e => {
                                        try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', l.id); } catch { /* algunos navegadores */ }
                                        setArrastrando(l.id);
                                    }}
                                    onDragOver={e => { if (arrastrando) { e.preventDefault(); setEncima(l.id); } }}
                                    onDrop={e => { e.preventDefault(); soltarSobre(l.id); }}
                                    onDragEnd={() => { setArrastrando(null); setEncima(null); }}
                                    className={`flex items-start gap-3 border-t border-[#f0efec] py-3.5 pl-3 pr-3.5 md:grid md:grid-cols-[36px_minmax(0,1fr)_150px_64px_92px] md:items-center md:gap-3.5 md:border-t-0 md:border-b md:border-[#f4f3f1] md:px-[22px] md:py-3 ${encima === l.id && !esElQueViaja ? 'md:bg-[#f3f8f5] md:shadow-[inset_0_2px_0_#0b7a53]' : 'bg-white'}`}
                                    style={{ opacity: esElQueViaja ? 0.45 : 1 }}
                                >
                                    {/* La manija, para arrastrar con el mouse. */}
                                    <span
                                        aria-hidden="true"
                                        title="Arrastrar para cambiar el orden"
                                        className="hidden h-9 w-9 cursor-grab items-center justify-center rounded-[10px] text-black/40 md:flex"
                                    >
                                        <GripVertical className="h-4 w-4" />
                                    </span>

                                    {/* Las flechas: en el teléfono son la única forma, y en
                                        la compu son la alternativa para quien no arrastra. */}
                                    <div className="flex flex-none flex-col gap-1 md:hidden">
                                        <button
                                            type="button"
                                            onClick={() => mover(l.id, -1)}
                                            disabled={i === 0}
                                            aria-label={`Subir ${l.titulo}`}
                                            className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2f2f0] text-[#0a0a0a] disabled:opacity-35"
                                        >
                                            <ChevronUp className="h-[15px] w-[15px]" strokeWidth={2.4} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => mover(l.id, 1)}
                                            disabled={i === lista.length - 1}
                                            aria-label={`Bajar ${l.titulo}`}
                                            className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2f2f0] text-[#0a0a0a] disabled:opacity-35"
                                        >
                                            <ChevronDown className="h-[15px] w-[15px]" strokeWidth={2.4} />
                                        </button>
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <p
                                            className="text-[14px] font-semibold leading-[1.35]"
                                            style={{
                                                color: estado.tachado ? 'rgba(0,0,0,.5)' : '#0a0a0a',
                                                textDecoration: estado.tachado ? 'line-through' : 'none',
                                            }}
                                        >
                                            {l.titulo}
                                        </p>
                                        <p className="mt-[3px] truncate text-[12.5px] text-black/60">{destinoCorto(l)}</p>

                                        {/* En el teléfono el estado y "Editar" van acá abajo. */}
                                        <div className="mt-2.5 flex flex-wrap items-center gap-2 md:hidden">
                                            <Pastilla estado={estado} />
                                            <button
                                                type="button"
                                                onClick={() => setEditando(aBorrador(l))}
                                                className="ml-auto h-11 rounded-full bg-[#f2f2f0] px-4 text-[13px] font-semibold text-[#0a0a0a]"
                                            >
                                                Editar
                                            </button>
                                        </div>
                                    </div>

                                    <span className="hidden md:inline-flex md:justify-self-start">
                                        <Pastilla estado={estado} />
                                    </span>

                                    {/* Las flechas de la compu, pegadas al interruptor. */}
                                    <div className="hidden md:flex md:items-center">
                                        <div className="mr-1 hidden flex-col md:flex">
                                            <button
                                                type="button"
                                                onClick={() => mover(l.id, -1)}
                                                disabled={i === 0}
                                                aria-label={`Subir ${l.titulo}`}
                                                className="flex h-5 w-5 items-center justify-center rounded text-black/50 disabled:opacity-30"
                                            >
                                                <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.4} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => mover(l.id, 1)}
                                                disabled={i === lista.length - 1}
                                                aria-label={`Bajar ${l.titulo}`}
                                                className="flex h-5 w-5 items-center justify-center rounded text-black/50 disabled:opacity-30"
                                            >
                                                <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.4} />
                                            </button>
                                        </div>
                                        <Interruptor
                                            prendido={l.visible}
                                            onClick={() => alternarVisible(l)}
                                            etiqueta={`${l.visible ? 'Ocultar' : 'Mostrar'} ${l.titulo}`}
                                        />
                                    </div>

                                    {/* En el teléfono el interruptor va a la derecha del título. */}
                                    <span className="md:hidden">
                                        <Interruptor
                                            prendido={l.visible}
                                            onClick={() => alternarVisible(l)}
                                            etiqueta={`${l.visible ? 'Ocultar' : 'Mostrar'} ${l.titulo}`}
                                        />
                                    </span>

                                    <button
                                        type="button"
                                        onClick={() => setEditando(aBorrador(l))}
                                        className="hidden h-[38px] rounded-full bg-[#f2f2f0] px-4 text-[13px] font-semibold text-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-white md:block"
                                    >
                                        Editar
                                    </button>
                                </li>
                            );
                        })}
                    </ul>

                    <p className="border-t border-[#f0efec] px-[22px] py-[13px] text-[12px] font-medium leading-[1.55] text-black/60">
                        <span className="hidden md:inline">Arrastrá desde la manija —o usá las flechas— para cambiar el orden. </span>
                        <span className="md:hidden">Usá las flechas para cambiar el orden. </span>
                        Los vencidos dejan de verse solos y quedan acá hasta que los borres.
                    </p>
                </>
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

// ── El editor: panel desde abajo en el teléfono, modal en la compu ──────

const CIERRA_EN = 90;

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

    // Se mide en el primer render: si arrancara en false, en un teléfono la
    // hoja montaría con la animación de escritorio (ver HojaDetalle).
    const [esMovil, setEsMovil] = useState(
        () => typeof window !== 'undefined' && window.innerWidth < 768,
    );
    const focoPrevio = useRef<HTMLElement | null>(null);
    const sinMovimiento = useReducedMotion();
    const arrastre = useDragControls();

    const abierto = borrador !== null;

    useEffect(() => {
        if (borrador) {
            setB(borrador);
            setTocado({});
            setFalloAlGuardar(false);
        }
    }, [borrador]);

    useEffect(() => {
        const medir = () => setEsMovil(window.innerWidth < 768);
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, []);

    useEffect(() => {
        if (!abierto) return;
        focoPrevio.current = document.activeElement as HTMLElement;
        const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
        document.addEventListener('keydown', alTeclear);
        return () => {
            document.removeEventListener('keydown', alTeclear);
            focoPrevio.current?.focus?.();
        };
    }, [abierto, onCerrar]);

    useBloqueoDeFondo(abierto);

    const v = esValido(b);
    const urlLimpia = b.url.trim();
    const rutaLimpia = b.ruta.trim();
    const esOtraRuta = b.tipo === 'interno' && b.funcion === 'otra';

    const guardar = async () => {
        setTocado({ titulo: true, destino: true });
        if (!v.todo) return;
        setGuardando(true);
        const ok = await onGuardar(b);
        setGuardando(false);
        // Si la base lo rechaza, la hoja se queda abierta con todo escrito.
        if (ok) onCerrar(); else setFalloAlGuardar(true);
    };

    const transicion = sinMovimiento
        ? { duration: 0 }
        : { type: 'spring' as const, damping: 34, stiffness: 340 };

    const rotulo = 'mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.07em] text-black/[.55]';

    return (
        <AnimatePresence>
            {abierto && (
                <motion.div
                    className="fixed inset-0 z-[120] flex items-end justify-center bg-[rgba(10,10,10,.42)] md:items-center md:p-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: sinMovimiento ? 0 : 0.2 }}
                    onClick={onCerrar}
                >
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label={b.id ? 'Editar link' : 'Nuevo link'}
                        onClick={e => e.stopPropagation()}
                        className="flex w-full flex-col overflow-hidden bg-white md:w-[920px] md:max-w-full"
                        style={{
                            borderRadius: esMovil ? '24px 24px 0 0' : '24px',
                            maxHeight: esMovil ? '92vh' : '88vh',
                        }}
                        initial={esMovil ? { y: '100%' } : { opacity: 0, y: 8, scale: 0.98 }}
                        animate={esMovil ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
                        exit={esMovil ? { y: '100%' } : { opacity: 0, y: 8, scale: 0.98 }}
                        transition={transicion}
                        drag={esMovil ? 'y' : false}
                        dragListener={false}
                        dragControls={arrastre}
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={{ top: 0, bottom: 0.6 }}
                        onDragEnd={(_, info) => { if (info.offset.y > CIERRA_EN) onCerrar(); }}
                    >
                        {esMovil && (
                            <div
                                onPointerDown={e => arrastre.start(e)}
                                className="shrink-0 cursor-grab px-5 pb-1 pt-2.5"
                                style={{ touchAction: 'none' }}
                            >
                                <span className="mx-auto block h-[5px] w-10 rounded-full bg-[#d6d4cf]" />
                            </div>
                        )}

                        <div className="overflow-y-auto overscroll-contain px-5 pb-[26px] pt-1.5 md:px-7 md:py-6">
                            <div className="flex items-center gap-3">
                                <p className="flex-1 text-[19px] font-semibold tracking-[-0.01em] text-[#0a0a0a]">
                                    {b.id ? 'Editar link' : 'Nuevo link'}
                                </p>
                                <button
                                    type="button"
                                    onClick={onCerrar}
                                    aria-label="Cerrar"
                                    className="hidden h-9 w-9 items-center justify-center rounded-full bg-[#f2f2f0] md:flex"
                                >
                                    <X className="h-3.5 w-3.5 text-[#0a0a0a]" strokeWidth={2.4} />
                                </button>
                            </div>

                            <div className="mt-4 grid items-start gap-[22px] md:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">

                                {/* ── El formulario ── */}
                                <div className="min-w-0">
                                    <label className="block">
                                        <span className={rotulo}>Título</span>
                                        <input
                                            type="text"
                                            value={b.titulo}
                                            maxLength={60}
                                            placeholder="Ej.: Contanos tu testimonio"
                                            onChange={e => setB({ ...b, titulo: e.target.value })}
                                            onBlur={() => setTocado(t => ({ ...t, titulo: true }))}
                                            className="h-[46px] w-full px-3.5 text-[14.5px] font-medium"
                                        />
                                    </label>
                                    <div className="mt-1.5 flex justify-between gap-2.5">
                                        <span className="text-[12px] font-semibold text-[#b42318]">
                                            {tocado.titulo && !v.titulo ? 'Poné un título de hasta 60 caracteres.' : ''}
                                        </span>
                                        <span className="text-[12px] text-black/55">{b.titulo.length}/60</span>
                                    </div>

                                    <label className="mt-3.5 block">
                                        <span className={rotulo}>
                                            Descripción <span className="font-medium normal-case tracking-normal text-black/55">· opcional</span>
                                        </span>
                                        <textarea
                                            value={b.descripcion}
                                            maxLength={140}
                                            rows={3}
                                            placeholder="Una línea que diga de qué se trata."
                                            onChange={e => setB({ ...b, descripcion: e.target.value })}
                                            className="w-full resize-none px-3.5 py-2.5 text-[14.5px] font-medium leading-[1.5]"
                                        />
                                    </label>
                                    <p className="mt-1.5 text-right text-[12px] text-black/55">{b.descripcion.length}/140</p>

                                    <p className={`${rotulo} mt-3.5`}>¿A dónde lleva?</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {([['interno', 'Una función de Origen', 'Abre dentro de la app'],
                                        ['externo', 'Un link externo', 'Abre en otra pestaña']] as const).map(([tipo, titulo, bajada]) => {
                                            const elegido = b.tipo === tipo;
                                            return (
                                                <button
                                                    key={tipo}
                                                    type="button"
                                                    aria-pressed={elegido}
                                                    onClick={() => setB({ ...b, tipo })}
                                                    className={`flex min-h-[64px] flex-col items-start justify-center gap-0.5 rounded-[14px] px-3.5 py-2.5 text-left transition-colors ${elegido ? 'bg-[#0a0a0a] text-white' : 'bg-[#f7f7f5] text-[#0a0a0a]'}`}
                                                >
                                                    <span className="text-[14px] font-semibold">{titulo}</span>
                                                    <span className="text-[12px] font-medium opacity-70">{bajada}</span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {b.tipo === 'interno' && (
                                        <>
                                            <div role="radiogroup" aria-label="Función de Origen" className="mt-2.5 overflow-hidden rounded-[16px] border border-[#ecebe7]">
                                                {FUNCIONES.map(f => {
                                                    const elegida = b.funcion === f.id;
                                                    return (
                                                        <button
                                                            key={f.id}
                                                            type="button"
                                                            role="radio"
                                                            aria-checked={elegida}
                                                            onClick={() => setB({ ...b, funcion: f.id })}
                                                            className={`flex w-full items-center gap-2.5 border-b border-[#f4f3f1] px-3.5 py-3 text-left text-[14px] font-medium last:border-b-0 ${elegida ? 'bg-[#f7f7f5] text-[#0a0a0a]' : 'text-black/[.72]'}`}
                                                        >
                                                            <span
                                                                className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border-2"
                                                                style={{ borderColor: elegida ? '#0a0a0a' : '#d6d4cf' }}
                                                            >
                                                                {elegida && <span className="h-2 w-2 rounded-full bg-[#0a0a0a]" />}
                                                            </span>
                                                            <span className="flex-1">{f.label}</span>
                                                            {f.ruta && (
                                                                <span className="hidden truncate font-mono text-[12px] text-black/50 md:block">{f.ruta}</span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {esOtraRuta && (
                                                <>
                                                    <input
                                                        type="text"
                                                        value={b.ruta}
                                                        placeholder="/ruta/de/la/app"
                                                        aria-label="Ruta de la app"
                                                        onChange={e => setB({ ...b, ruta: e.target.value })}
                                                        onBlur={() => setTocado(t => ({ ...t, destino: true }))}
                                                        className="mt-2.5 h-[46px] w-full px-3.5 font-mono text-[14.5px] font-medium"
                                                    />
                                                    <p
                                                        className="mt-1.5 text-[12px] font-semibold"
                                                        style={{ color: tocado.destino && !v.destino ? '#b42318' : 'rgba(0,0,0,.6)' }}
                                                    >
                                                        {tocado.destino && !v.destino
                                                            ? 'La ruta tiene que empezar con “/”, no con “//”, y no llevar espacios.'
                                                            : 'Por ejemplo: /eventos'}
                                                    </p>
                                                </>
                                            )}
                                        </>
                                    )}

                                    {b.tipo === 'externo' && (
                                        <>
                                            <input
                                                type="url"
                                                value={b.url}
                                                placeholder="https://"
                                                aria-label="Dirección del link"
                                                onChange={e => setB({ ...b, url: e.target.value })}
                                                onBlur={() => setTocado(t => ({ ...t, destino: true }))}
                                                className="mt-2.5 h-[46px] w-full px-3.5 text-[14.5px] font-medium"
                                            />
                                            <p
                                                className="mt-1.5 text-[12px] font-semibold"
                                                style={{ color: tocado.destino && !v.destino ? '#b42318' : 'rgba(0,0,0,.6)' }}
                                            >
                                                {v.destino
                                                    ? `Abre ${dominioDe(urlLimpia) || urlLimpia} en otra pestaña`
                                                    : tocado.destino
                                                        ? (urlLimpia ? 'Tiene que ser una dirección completa que empiece con https://' : 'Falta la dirección del link.')
                                                        : 'Pegá la dirección completa, con https://'}
                                            </p>
                                        </>
                                    )}

                                    <label className="mt-4 block">
                                        <span className={rotulo}>
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

                                    <div className="mt-4 flex items-center gap-3 rounded-[14px] bg-[#f7f7f5] py-1.5 pl-3.5 pr-1.5">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[14px] font-semibold text-[#0a0a0a]">Visible</p>
                                            <p className="mt-0.5 text-[12px] text-black/60">
                                                {b.visible ? 'Aparece en Novedades al guardar.' : 'Se guarda, pero no se muestra.'}
                                            </p>
                                        </div>
                                        <Interruptor
                                            prendido={b.visible}
                                            onClick={() => setB({ ...b, visible: !b.visible })}
                                            etiqueta="Visible"
                                        />
                                    </div>
                                </div>

                                {/* ── La vista previa: la tarjeta de /novedades ── */}
                                <div className="min-w-0">
                                    <p className={rotulo}>Vista previa en Novedades</p>
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

                            <div className="mt-[22px] flex flex-wrap items-center gap-2.5 border-t border-[#f0efec] pt-4">
                                {b.id && (
                                    <button
                                        type="button"
                                        onClick={() => onBorrar(b)}
                                        className="h-11 rounded-full px-3.5 text-[13.5px] font-semibold text-[#b42318] hover:bg-[#fdf1ef]"
                                    >
                                        Borrar link
                                    </button>
                                )}
                                <div className="ml-auto flex w-full flex-col gap-2.5 md:w-auto md:flex-row">
                                    <button
                                        type="button"
                                        onClick={onCerrar}
                                        className="h-12 rounded-full bg-[#f2f2f0] px-5 text-[14px] font-semibold text-[#0a0a0a] md:h-11"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={guardar}
                                        disabled={!v.todo || guardando}
                                        className="h-12 rounded-full bg-[#0a0a0a] px-6 text-[14px] font-semibold text-white disabled:opacity-40 md:h-11"
                                    >
                                        {guardando ? 'Guardando…' : 'Guardar'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default LinksNovedades;
