import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useDragControls, useReducedMotion } from 'framer-motion';
import { X, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { useBloqueoDeFondo } from '../../hooks/useBloqueoDeFondo';
import ImageUpload from '../../components/media/SubidaImagen';
import EncuadreMedia from '../../components/media/EncuadreMedia';
import { Rotulo } from './piezasAdmin';

/**
 * Las piezas de los panels que cargan tarjetas del inicio: Enlaces Origen
 * (EnlacesOrigen.tsx) y Recursos Origen (RecursosOrigen.tsx).
 *
 * La lista ordenable, el interruptor, la hoja del editor, los campos de título,
 * bajada y portada, y el "a dónde lleva". Están acá para que los dos panels sean
 * el mismo panel: una copia se vería parecida hoy y distinta dentro de dos meses.
 */

// ── Las funciones de la app a las que se puede apuntar ──────────────────
// Cada ruta está verificada contra App.tsx. Si alguna se renombra, acá
// queda un link que lleva a la pantalla de "no encontrado".

export interface FuncionDeOrigen { id: string; label: string; ruta: string }

export const FUNCIONES: FuncionDeOrigen[] = [
    { id: 'gcx', label: 'Grupos de Conexión', ruta: '/gcx' },
    { id: 'calendario', label: 'Calendario de GCX', ruta: '/gcx/calendario' },
    { id: 'eventos', label: 'Eventos', ruta: '/eventos' },
    { id: 'punto', label: 'Punto de Información', ruta: '/punto-de-informacion' },
    { id: 'nocturna', label: 'Nocturna (inscripción)', ruta: '/nocturna-inscripcion' },
    { id: 'audiencia', label: 'Audiencia de Servicios', ruta: '/audiencia-servicios' },
    { id: 'otra', label: 'Otra ruta de la app', ruta: '' },
];

// ── Las mismas reglas que los CHECK de la base ──────────────────────────

export const RUTA_OK = /^\/[^/\s]/;
export const URL_OK = /^https:\/\/[^/\s]+/i;

export const dominioDe = (url: string): string => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
};

/** Lo que se lee en la lista: "forms.gle/…" o "En Origen · Eventos". */
export const destinoCorto = (externo: boolean, destino: string): string => {
    if (externo) {
        const dominio = dominioDe(destino);
        if (!dominio) return destino || '—';
        try {
            const u = new URL(destino);
            return dominio + (u.pathname.length > 1 ? '/…' : '');
        } catch { return dominio; }
    }
    const f = FUNCIONES.find(x => x.ruta && x.ruta === destino);
    return `En Origen · ${f ? f.label : destino}`;
};

export interface EleccionDeDestino {
    tipo: 'interno' | 'externo';
    /** Cuál de las funciones de Origen, o 'otra'. */
    funcion: string;
    ruta: string;
    url: string;
}

export const destinoElegido = (e: EleccionDeDestino): string => {
    if (e.tipo === 'externo') return e.url.trim();
    if (e.funcion === 'otra') return e.ruta.trim();
    return FUNCIONES.find(f => f.id === e.funcion)?.ruta || '';
};

export const destinoElegidoValido = (e: EleccionDeDestino): boolean =>
    (e.tipo === 'externo' ? URL_OK.test(e.url.trim()) : RUTA_OK.test(destinoElegido(e)));

/** El borrador a partir de un destino ya guardado. */
export const leerDestino = (externo: boolean, destino: string): EleccionDeDestino => {
    const f = !externo ? FUNCIONES.find(x => x.ruta && x.ruta === destino) : undefined;
    return {
        tipo: externo ? 'externo' : 'interno',
        funcion: f ? f.id : 'otra',
        ruta: !externo && !f ? destino : '',
        url: externo ? destino : '',
    };
};

/**
 * El marco del encuadre: la MISMA proporción que la tarjeta del inicio
 * (components/inicio/SeccionDeEnlaces.tsx, FORMA = 4:3). Si acá se encuadra
 * en una caja y allá se dibuja en otra, lo que se eligió no es lo que se ve:
 * object-cover recorta según la proporción de la caja, no según el archivo.
 * Los números son los de una tarjeta de escritorio; lo que importa es que
 * 400/300 sea 4:3.
 */
const MARCO = { ancho: 400, alto: 300 };

export const ROTULO = 'mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.07em] text-black/[.55]';

// ── Piezas chicas ───────────────────────────────────────────────────────

export interface Estado { texto: string; fondo: string; tinta: string; tachado?: boolean }

export const Interruptor: React.FC<{
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

// ── La lista ordenable ──────────────────────────────────────────────────

/**
 * El orden es el de la lista, y se guarda al soltar. Mientras guarda, la lista
 * NO se vuelve a leer: si se leyera, el orden saltaría al viejo durante medio
 * segundo y parecería que no se guardó. Si la base dice que no, recién ahí vuelve
 * al orden anterior (lo hace quien la usa, en onCambiarOrden).
 */
export const ListaOrdenable = <T extends { id: string; titulo: string; visible: boolean }>({
    lista, columna, guardando, estadoDe, detalleDe, onCambiarOrden, onAlternarVisible, onEditar, nota,
}: {
    lista: T[];
    /** El título de la primera columna: "Link", "Recurso". */
    columna: string;
    guardando: boolean;
    estadoDe: (item: T) => Estado;
    /** La línea de abajo del título. */
    detalleDe: (item: T) => string;
    onCambiarOrden: (nueva: T[]) => void;
    onAlternarVisible: (item: T) => void;
    onEditar: (item: T) => void;
    /** Lo que se agrega al pie, después de cómo se ordena. */
    nota?: string;
}) => {
    const [arrastrando, setArrastrando] = useState<string | null>(null);
    const [encima, setEncima] = useState<string | null>(null);

    const mover = (id: string, paso: -1 | 1) => {
        const i = lista.findIndex(l => l.id === id);
        const j = i + paso;
        if (i < 0 || j < 0 || j >= lista.length) return;
        const nueva = lista.slice();
        [nueva[i], nueva[j]] = [nueva[j], nueva[i]];
        onCambiarOrden(nueva);
    };

    const soltarSobre = (id: string) => {
        if (!arrastrando || arrastrando === id) { setArrastrando(null); setEncima(null); return; }
        const desde = lista.findIndex(l => l.id === arrastrando);
        const hasta = lista.findIndex(l => l.id === id);
        const nueva = lista.slice();
        const [movido] = nueva.splice(desde, 1);
        nueva.splice(hasta, 0, movido);
        setArrastrando(null);
        setEncima(null);
        onCambiarOrden(nueva);
    };

    return (
        <>
            {/* La cabecera de la planilla, sólo en la compu. */}
            <div className="hidden border-y border-[#f0efec] bg-[#fafaf8] px-[22px] py-2.5 md:grid md:grid-cols-[36px_minmax(0,1fr)_150px_64px_92px] md:gap-3.5">
                <span />
                <Rotulo className="text-black/[.5]">{columna}</Rotulo>
                <Rotulo className="text-black/[.5]">Estado</Rotulo>
                <Rotulo className="text-black/[.5]">Visible</Rotulo>
                <span />
            </div>

            <ul className="list-none p-0" style={{ opacity: guardando ? 0.75 : 1 }}>
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
                                <p className="mt-[3px] truncate text-[12.5px] text-black/60">{detalleDe(l)}</p>

                                {/* En el teléfono el estado y "Editar" van acá abajo. */}
                                <div className="mt-2.5 flex flex-wrap items-center gap-2 md:hidden">
                                    <Pastilla estado={estado} />
                                    <button
                                        type="button"
                                        onClick={() => onEditar(l)}
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
                                    onClick={() => onAlternarVisible(l)}
                                    etiqueta={`${l.visible ? 'Ocultar' : 'Mostrar'} ${l.titulo}`}
                                />
                            </div>

                            {/* En el teléfono el interruptor va a la derecha del título. */}
                            <span className="md:hidden">
                                <Interruptor
                                    prendido={l.visible}
                                    onClick={() => onAlternarVisible(l)}
                                    etiqueta={`${l.visible ? 'Ocultar' : 'Mostrar'} ${l.titulo}`}
                                />
                            </span>

                            <button
                                type="button"
                                onClick={() => onEditar(l)}
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
                {nota}
            </p>
        </>
    );
};

// ── La hoja del editor: desde abajo en el teléfono, modal en la compu ───

const CIERRA_EN = 90;

export const HojaDelEditor: React.FC<{
    abierto: boolean;
    titulo: string;
    onCerrar: () => void;
    children: React.ReactNode;
}> = ({ abierto, titulo, onCerrar, children }) => {
    // Se mide en el primer render: si arrancara en false, en un teléfono la
    // hoja montaría con la animación de escritorio (ver HojaDetalle).
    const [esMovil, setEsMovil] = useState(
        () => typeof window !== 'undefined' && window.innerWidth < 768,
    );
    const focoPrevio = useRef<HTMLElement | null>(null);
    const sinMovimiento = useReducedMotion();
    const arrastre = useDragControls();
    // En un ref: quien la usa pasa una función nueva en cada render, y con ella
    // en las dependencias el foco volvería atrás cada vez que el padre se dibuja.
    const cerrarRef = useRef(onCerrar);
    cerrarRef.current = onCerrar;

    useEffect(() => {
        const medir = () => setEsMovil(window.innerWidth < 768);
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, []);

    useEffect(() => {
        if (!abierto) return;
        focoPrevio.current = document.activeElement as HTMLElement;
        const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrarRef.current(); };
        document.addEventListener('keydown', alTeclear);
        return () => {
            document.removeEventListener('keydown', alTeclear);
            focoPrevio.current?.focus?.();
        };
    }, [abierto]);

    useBloqueoDeFondo(abierto);

    const transicion = sinMovimiento
        ? { duration: 0 }
        : { type: 'spring' as const, damping: 34, stiffness: 340 };

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
                        aria-label={titulo}
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
                                    {titulo}
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

                            {children}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

// ── Los campos de la tarjeta: título, bajada y portada ──────────────────

export interface CamposDeLaTarjeta {
    titulo: string;
    descripcion: string;
    /** La portada, con su encuadre. '' = sin imagen. */
    imagenUrl: string;
    focalX: number;
    focalY: number;
    zoom: number;
}

export const CamposDeTarjeta: React.FC<{
    valores: CamposDeLaTarjeta;
    onCambio: (cambios: Partial<CamposDeLaTarjeta>) => void;
    tituloValido: boolean;
    tituloTocado: boolean;
    onTocarTitulo: () => void;
    ejemploDeTitulo: string;
    /** "Imagen de fondo", "Portada". */
    rotuloDeImagen: string;
    /** La carpeta del bucket de imágenes. */
    carpeta: string;
}> = ({ valores, onCambio, tituloValido, tituloTocado, onTocarTitulo, ejemploDeTitulo, rotuloDeImagen, carpeta }) => (
    <>
        <label className="block">
            <span className={ROTULO}>Título</span>
            <input
                type="text"
                value={valores.titulo}
                maxLength={60}
                placeholder={ejemploDeTitulo}
                onChange={e => onCambio({ titulo: e.target.value })}
                onBlur={onTocarTitulo}
                className="h-[46px] w-full px-3.5 text-[14.5px] font-medium"
            />
        </label>
        <div className="mt-1.5 flex justify-between gap-2.5">
            <span className="text-[12px] font-semibold text-[#b42318]">
                {tituloTocado && !tituloValido ? 'Poné un título de hasta 60 caracteres.' : ''}
            </span>
            <span className="text-[12px] text-black/55">{valores.titulo.length}/60</span>
        </div>

        <label className="mt-3.5 block">
            <span className={ROTULO}>
                Descripción <span className="font-medium normal-case tracking-normal text-black/55">· opcional</span>
            </span>
            <textarea
                value={valores.descripcion}
                maxLength={140}
                rows={3}
                placeholder="Una línea que diga de qué se trata."
                onChange={e => onCambio({ descripcion: e.target.value })}
                className="w-full resize-none px-3.5 py-2.5 text-[14.5px] font-medium leading-[1.5]"
            />
        </label>
        <p className="mt-1.5 text-right text-[12px] text-black/55">{valores.descripcion.length}/140</p>

        {/* ── La imagen de fondo ── */}
        <p className={`${ROTULO} mt-3.5`}>
            {rotuloDeImagen} <span className="font-medium normal-case tracking-normal text-black/55">· opcional</span>
        </p>
        {/* La key lo vuelve a montar cuando cambia la imagen: el recuadro de
            subida lee `currentImage` una sola vez, al montarse, y la hoja se abre
            un cuadro antes de que llegue el borrador. Sin esto, editar un enlace
            que ya tiene imagen mostraba el recuadro vacío. */}
        <ImageUpload
            key={valores.imagenUrl || 'sin-imagen'}
            currentImage={valores.imagenUrl}
            folder={carpeta}
            // El recuadro también sabe quitarla: avisa con una url vacía, y ahí
            // el encuadre vuelve al centro.
            onImageUpload={url => onCambio({
                imagenUrl: url,
                ...(url ? {} : { focalX: 50, focalY: 50, zoom: 1 }),
            })}
            // 4:3, la forma de la tarjeta. El recuadro recorta el archivo al
            // subirlo, así que si recortara con otra forma, la tarjeta volvería a
            // recortar encima y se comería los costados de lo que se eligió.
            aspectRatio="4:3"
            className="caja-portada"
        />
        <p className="mt-1.5 text-[12px] text-black/60">
            Va arriba de la tarjeta, sin nada encima. El título y el botón van debajo.
        </p>

        {valores.imagenUrl && (
            <>
                {/* El marco es el de la tarjeta de verdad: lo que se deja a la
                    vista acá es lo que se va a ver en el inicio. */}
                <div className="mt-3">
                    <p className={ROTULO}>Encuadre</p>
                    <EncuadreMedia
                        mediaType="image"
                        imageUrl={valores.imagenUrl}
                        frameWidth={MARCO.ancho}
                        frameHeight={MARCO.alto}
                        value={{ focalX: valores.focalX, focalY: valores.focalY, zoom: valores.zoom }}
                        onChange={marco => onCambio(marco)}
                    />
                </div>
            </>
        )}
    </>
);

// ── "¿A dónde lleva?" ───────────────────────────────────────────────────

export const ElegirDestino: React.FC<{
    valor: EleccionDeDestino;
    onCambio: (cambios: Partial<EleccionDeDestino>) => void;
    tocado: boolean;
    onTocar: () => void;
}> = ({ valor, onCambio, tocado, onTocar }) => {
    const valido = destinoElegidoValido(valor);
    const urlLimpia = valor.url.trim();
    const esOtraRuta = valor.tipo === 'interno' && valor.funcion === 'otra';

    return (
        <>
            <p className={`${ROTULO} mt-4`}>¿A dónde lleva?</p>
            <div className="grid grid-cols-2 gap-2">
                {([['interno', 'Una función de Origen', 'Abre dentro de la app'],
                ['externo', 'Un link externo', 'Abre en otra pestaña']] as const).map(([tipo, titulo, bajada]) => {
                    const elegido = valor.tipo === tipo;
                    return (
                        <button
                            key={tipo}
                            type="button"
                            aria-pressed={elegido}
                            onClick={() => onCambio({ tipo })}
                            className={`flex min-h-[64px] flex-col items-start justify-center gap-0.5 rounded-[14px] px-3.5 py-2.5 text-left transition-colors ${elegido ? 'bg-[#0a0a0a] text-white' : 'bg-[#f7f7f5] text-[#0a0a0a]'}`}
                        >
                            <span className="text-[14px] font-semibold">{titulo}</span>
                            <span className="text-[12px] font-medium opacity-70">{bajada}</span>
                        </button>
                    );
                })}
            </div>

            {valor.tipo === 'interno' && (
                <>
                    <div role="radiogroup" aria-label="Función de Origen" className="mt-2.5 overflow-hidden rounded-[16px] border border-[#ecebe7]">
                        {FUNCIONES.map(f => {
                            const elegida = valor.funcion === f.id;
                            return (
                                <button
                                    key={f.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={elegida}
                                    onClick={() => onCambio({ funcion: f.id })}
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
                                value={valor.ruta}
                                placeholder="/ruta/de/la/app"
                                aria-label="Ruta de la app"
                                onChange={e => onCambio({ ruta: e.target.value })}
                                onBlur={onTocar}
                                className="mt-2.5 h-[46px] w-full px-3.5 font-mono text-[14.5px] font-medium"
                            />
                            <p
                                className="mt-1.5 text-[12px] font-semibold"
                                style={{ color: tocado && !valido ? '#b42318' : 'rgba(0,0,0,.6)' }}
                            >
                                {tocado && !valido
                                    ? 'La ruta tiene que empezar con “/”, no con “//”, y no llevar espacios.'
                                    : 'Por ejemplo: /eventos'}
                            </p>
                        </>
                    )}
                </>
            )}

            {valor.tipo === 'externo' && (
                <>
                    <input
                        type="url"
                        value={valor.url}
                        placeholder="https://"
                        aria-label="Dirección del link"
                        onChange={e => onCambio({ url: e.target.value })}
                        onBlur={onTocar}
                        className="mt-2.5 h-[46px] w-full px-3.5 text-[14.5px] font-medium"
                    />
                    <p
                        className="mt-1.5 text-[12px] font-semibold"
                        style={{ color: tocado && !valido ? '#b42318' : 'rgba(0,0,0,.6)' }}
                    >
                        {valido
                            ? `Abre ${dominioDe(urlLimpia) || urlLimpia} en otra pestaña`
                            : tocado
                                ? (urlLimpia ? 'Tiene que ser una dirección completa que empiece con https://' : 'Falta la dirección del link.')
                                : 'Pegá la dirección completa, con https://'}
                    </p>
                </>
            )}
        </>
    );
};

// ── El renglón de "Visible" y el pie ────────────────────────────────────

export const FilaVisible: React.FC<{ visible: boolean; onCambiar: () => void }> = ({ visible, onCambiar }) => (
    <div className="mt-4 flex items-center gap-3 rounded-[14px] bg-[#f7f7f5] py-1.5 pl-3.5 pr-1.5">
        <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-[#0a0a0a]">Visible</p>
            <p className="mt-0.5 text-[12px] text-black/60">
                {visible ? 'Aparece en el inicio al guardar.' : 'Se guarda, pero no se muestra.'}
            </p>
        </div>
        <Interruptor prendido={visible} onClick={onCambiar} etiqueta="Visible" />
    </div>
);

export const PieDelEditor: React.FC<{
    /** "Borrar link". Sin esto, no aparece: es un alta. */
    textoBorrar?: string;
    onBorrar?: () => void;
    onCancelar: () => void;
    onGuardar?: () => void;
    puedeGuardar?: boolean;
    guardando?: boolean;
}> = ({ textoBorrar, onBorrar, onCancelar, onGuardar, puedeGuardar = false, guardando = false }) => (
    <div className="mt-[22px] flex flex-wrap items-center gap-2.5 border-t border-[#f0efec] pt-4">
        {textoBorrar && (
            <button
                type="button"
                onClick={onBorrar}
                className="h-11 rounded-full px-3.5 text-[13.5px] font-semibold text-[#b42318] hover:bg-[#fdf1ef]"
            >
                {textoBorrar}
            </button>
        )}
        <div className="ml-auto flex w-full flex-col gap-2.5 md:w-auto md:flex-row">
            <button
                type="button"
                onClick={onCancelar}
                className="h-12 rounded-full bg-[#f2f2f0] px-5 text-[14px] font-semibold text-[#0a0a0a] md:h-11"
            >
                Cancelar
            </button>
            {onGuardar && (
                <button
                    type="button"
                    onClick={onGuardar}
                    disabled={!puedeGuardar || guardando}
                    className="h-12 rounded-full bg-[#0a0a0a] px-6 text-[14px] font-semibold text-white disabled:opacity-40 md:h-11"
                >
                    {guardando ? 'Guardando…' : 'Guardar'}
                </button>
            )}
        </div>
    </div>
);
