import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getMediaFrameStyle } from '../ui/CarruselHero';
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Share } from 'lucide-react';
import ModalCompartirQR from '../modals/ModalCompartirQR';
import {
    getLinksPublicos,
    abrirLink,
    etiquetaDeLink,
    textoDeVencimiento,
    type LinkDeNovedad,
} from '../../services/novedades';

/**
 * "Enlaces Origen": la tira de links que carga un SUPER_ADMIN desde el panel
 * (Configuración de la app → Links).
 *
 * Va en el inicio, entre Origen en Youvers y Grupos para vos. Es un riel que
 * se desliza con el dedo o con el trackpad, igual que el de los grupos: en
 * la compu entran tres y en el teléfono una, con la siguiente asomando para
 * que se note que hay más.
 *
 * Cuando hay más de los que entran, las tarjetas se angostan unos píxeles
 * para que la de al lado asome: esa es la señal de "seguí".
 *
 * En el teléfono alcanza, porque se desliza con el dedo. En la compu no: sin
 * barra y sin arrastre, quien no tenga un trackpad con desplazamiento
 * horizontal se queda en los primeros tres. Por eso en pantallas grandes el
 * riel lleva dos flechas, que aparecen al pasar el mouse por la sección —las
 * mismas que el carrusel de grupos, que está en la misma pantalla—.
 *
 * Si no hay links, o si no se pudieron traer, la sección no aparece y el
 * resto del inicio sigue igual.
 */

// ── La tarjeta ──────────────────────────────────────────────────────────

/**
 * La forma de la portada: 4:3, la MISMA que el marco del encuadre del panel
 * (pages/admin/EnlacesOrigen.tsx, MARCO). Que sean iguales no es cosmético:
 * el recorte de una imagen con object-cover depende de la proporción de la
 * caja, así que si el panel encuadra en 400×260 y la tarjeta mide 304×260,
 * lo que se eligió no es lo que se ve. Con una proporción fija, el recorte
 * es idéntico en el teléfono, en la compu y en la vista previa.
 */
const FORMA = 'aspect-[4/3]';


/**
 * La tarjeta se ve siempre entera: portada arriba y limpia, título, bajada y
 * los botones de compartir e ir. No se despliega ni se pliega: probamos con
 * "Ver detalles", primero de a una y después todas juntas, y era un toque
 * de más para leer algo que entra igual.
 *
 * Qué hace cada toque:
 *
 *   · la tarjeta entera —o "Ir al enlace"— lleva al enlace;
 *   · compartir abre el mismo panel que los grupos (QR, copiar el link,
 *     WhatsApp), y no lleva a ningún lado.
 *
 * Las artes de Origen ya traen su propio título: por eso la imagen va sola
 * arriba y el texto debajo, sobre blanco. Con el texto encima, la mitad de
 * abajo del arte quedaba tapada.
 *
 * También la usa el panel como vista previa mientras se carga un link
 * (pages/admin/EnlacesOrigen.tsx). Es la misma tarjeta, no una copia: lo que
 * se ve en el panel es literalmente lo que se va a publicar.
 */
export const TarjetaDeLink: React.FC<{
    link: LinkDeNovedad;
    onAbrir: () => void;
    /** En el panel la tarjeta se mira, no se toca: ni foco ni clicks. */
    vistaPrevia?: boolean;
}> = ({ link, onAbrir, vistaPrevia = false }) => {
    const esExterno = link.tipoDestino === 'externo';
    const cierra = textoDeVencimiento(link.vence);
    const conImagen = !!link.imagenUrl;
    const [compartiendo, setCompartiendo] = useState(false);
    /** El link que se comparte: el de afuera tal cual, o la pantalla de la app con su #. */
    const linkParaCompartir = esExterno
        ? link.destino
        : `${typeof window !== 'undefined' ? window.location.origin : 'https://app.origeniglesia.org'}/#${link.destino}`;

    const abrir = () => {
        if (!vistaPrevia) onAbrir();
    };

    return (
        <div
            data-enlace
            role={vistaPrevia ? undefined : 'link'}
            tabIndex={vistaPrevia ? undefined : 0}
            aria-label={vistaPrevia ? undefined : etiquetaDeLink(link)}
            aria-hidden={vistaPrevia || undefined}
            onClick={abrir}
            onKeyDown={vistaPrevia ? undefined : e => {
                // Sólo cuando el foco está en la tarjeta: si está en el botón
                // de compartir, el Enter es de él.
                if (e.target !== e.currentTarget) return;
                // Un div no recibe el Enter del navegador: hay que atenderlo a
                // mano, como haría un <a>.
                if (e.key === 'Enter') {
                    e.preventDefault();
                    abrir();
                }
            }}
            // h-full: el riel estira todas a la altura de la más alta, y así
            // los botones de la fila quedan en la misma línea.
            className={`relative overflow-hidden h-full flex flex-col rounded-2xl dark:shadow-none bg-white dark:bg-zinc-900 ${conImagen
                // Con imagen NO lleva borde, ni siquiera transparente: un
                // borde corre la portada un píxel para adentro, y entonces el
                // recorte deja de ser el del panel. La sombra alcanza para
                // despegarla del fondo.
                ? 'shadow-[0_4px_16px_rgba(15,23,42,0.08)]'
                : 'border border-slate-200 dark:border-zinc-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'} ${vistaPrevia ? '' : 'cursor-pointer hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(15,23,42,0.08)] dark:hover:border-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-zinc-950'}`}
        >
            {conImagen && (
                <div className={`relative w-full shrink-0 ${FORMA}`}>
                    {/* El encuadre sale de la misma función que dibuja los
                        banners de la home: lo que se eligió en el panel es
                        exactamente lo que se ve acá. */}
                    <img
                        src={link.imagenUrl as string}
                        alt=""
                        draggable={false}
                        className="w-full h-full object-cover pointer-events-none select-none"
                        style={getMediaFrameStyle(link)}
                    />
                </div>
            )}

            <div className="relative flex-1 flex flex-col p-[18px]">
                {/* La única pastilla que queda es la del cierre, que avisa
                    algo que no se sabe de otra forma. La de "Link externo" /
                    "En Origen" se fue: el ícono del botón ya dice si se abre
                    afuera o acá adentro, y el lector de pantalla lo escucha
                    en el nombre de la tarjeta. */}
                {cierra && (
                    <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center h-[26px] px-2.5 rounded-full text-xs font-semibold whitespace-nowrap bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                            {cierra}
                        </span>
                    </div>
                )}

                <div className={cierra ? 'mt-3.5' : ''}>
                    <p className="mb-0 text-[17.5px] leading-[1.3] font-bold tracking-[-0.01em] line-clamp-2 [overflow-wrap:anywhere] text-slate-900 dark:text-white">
                        {link.titulo}
                    </p>
                    {link.descripcion && (
                        <p className="mt-1.5 mb-0 text-sm leading-[1.5] [overflow-wrap:anywhere] text-slate-500 dark:text-zinc-400">
                            {link.descripcion}
                        </p>
                    )}
                </div>

                {/* El envoltorio es el que empuja: el botón queda pegado al pie
                    con 18px de aire, y así los botones de la fila quedan a la
                    misma altura aunque los textos midan distinto. */}
                <span className="flex w-full gap-2 pt-[18px] mt-auto">
                    {/* Compartir, a la izquierda y más chico: lo principal
                        sigue siendo ir. */}
                    <button
                        type="button"
                        onClick={vistaPrevia ? undefined : e => { e.stopPropagation(); setCompartiendo(true); }}
                        tabIndex={vistaPrevia ? -1 : 0}
                        aria-label={`Compartir ${link.titulo}`}
                        className="shrink-0 w-[46px] h-[46px] rounded-xl flex items-center justify-center transition-colors bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-white"
                    >
                        <Share className="w-[18px] h-[18px]" strokeWidth={2.1} />
                    </button>
                    {/* Hace lo mismo que la tarjeta: el click sube solo. Fuera
                        del orden del teclado, porque la tarjeta ya es el link. */}
                    <span
                        aria-hidden="true"
                        className="flex-1 min-w-0 h-[46px] rounded-xl flex items-center justify-center gap-2 text-[14.5px] font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    >
                        Ir al enlace
                        {esExterno
                            ? <ExternalLink className="w-[15px] h-[15px]" strokeWidth={2.2} />
                            : <ArrowRight className="w-4 h-4" strokeWidth={2.2} />}
                    </span>
                </span>
            </div>

            {/* El panel se dibuja afuera (portal), pero en React sus clicks
                suben igual hasta la tarjeta: sin este freno, "Copiar link"
                abría el enlace. `contents`: el envoltorio no ocupa lugar. */}
            {!vistaPrevia && (
                <span className="contents" onClick={e => e.stopPropagation()}>
                <ModalCompartirQR
                    isOpen={compartiendo}
                    onClose={() => setCompartiendo(false)}
                    title={link.titulo}
                    link={linkParaCompartir}
                    rotulo="COMPARTIR ENLACE"
                    queAbre="el enlace"
                />
                </span>
            )}
        </div>
    );
};

// ── Mientras llegan ─────────────────────────────────────────────────────

const Esqueleto: React.FC = () => (
    <div className="rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
        <div className={`${FORMA} bg-slate-200 dark:bg-zinc-800 animate-pulse`} />
        <div className="p-[18px]">
            <div className="h-[18px] w-[85%] rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
            <div className="mt-[18px] h-[46px] w-full rounded-xl bg-slate-200 dark:bg-zinc-800 animate-pulse" />
        </div>
    </div>
);

// ── La sección ──────────────────────────────────────────────────────────

/**
 * Las dos flechas de la compu. Redondas, chicas y por fuera del riel, como
 * las del carrusel de grupos.
 *
 * El `top` lo pone la sección, medido: van a la mitad de la portada y no de
 * la tarjeta, que con el texto debajo es bastante más alta.
 */
const FLECHA = 'absolute -translate-y-1/2 w-9 h-9 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-md items-center justify-center text-slate-600 dark:text-zinc-300 opacity-0 group-hover/riel:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-slate-50 dark:hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-white z-10';

/**
 * El riel del teléfono y la grilla de la compu, en un solo árbol.
 *
 * En el teléfono el riel llega a los bordes de la pantalla (el -mx-4 se come
 * el px-4 de la página) y lleva 44px de relleno a cada lado: con la tarjeta
 * de 100vw-88px, la que está quieta queda centrada y de las de al lado se
 * ven 32px (44 menos el espacio de 12). Así se nota que hay más.
 *
 * El `relative` es para que el offsetLeft de cada tarjeta se mida desde el
 * riel, y no cambie con lo que se deslizó.
 *
 * La alineación vertical la pone quien lo usa: el riel estira todas las
 * tarjetas a la altura de la más larga, para que los botones queden en la
 * misma línea al deslizar; el esqueleto va arriba.
 */
const FILA = 'relative flex gap-3 sm:gap-4 -mx-4 px-[44px] sm:mx-0 sm:px-0 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-1';

/**
 * El ancho de una tarjeta. En el teléfono, el de la pantalla menos los dos
 * rellenos de FILA, y frena centrada. En la compu las cuentas son las que
 * hacen que entren justo: dos tarjetas y un espacio de 16px, o tres y dos
 * espacios, y frena al principio.
 *
 * Cuando hay más de las que entran se les restan 26px, y esos 26px son los
 * que deja asomar a la siguiente. Sin eso, en la compu tres tarjetas llenan
 * la fila exacta y nada dice que haya una cuarta.
 */
const JUSTAS = 'snap-center sm:snap-start shrink-0 w-[calc(100vw-88px)] sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]';
const CON_ASOMO = 'snap-center sm:snap-start shrink-0 w-[calc(100vw-88px)] sm:w-[calc((100%-1rem)/2-26px)] lg:w-[calc((100%-2rem)/3-26px)]';

/**
 * Cuántas veces se dibuja la lista para que el riel no tenga punta. Son
 * tres y no dos para poder arrancar en la del medio: así sobra una copia
 * entera para cada lado y la vuelta se puede dar también hacia atrás, que
 * con el scroll nativo —que frena en cero— de otra forma no se puede.
 */
const COPIAS = 3;

/**
 * El espacio entre tarjetas, el mismo que pone `sm:gap-4` en FILA. Va acá
 * porque la flecha corre "una tarjeta", y una tarjeta es su ancho más el
 * espacio que la separa de la siguiente. Las flechas son sólo de la compu,
 * así que el gap-3 del teléfono no entra en la cuenta.
 */
const ESPACIO = 16;

const SeccionDeEnlaces: React.FC = () => {
    const navigate = useNavigate();
    const rielRef = useRef<HTMLDivElement>(null);
    const sinMovimiento = useReducedMotion();
    /** Sólo tiene sentido dar la vuelta si lo que hay no entra en pantalla. */
    const [enRonda, setEnRonda] = useState(false);
    /**
     * El alto de la portada, para poner las flechas a su mitad. Se calcula
     * con el ancho, que es el que manda por la proporción 4:3 de FORMA.
     */
    const [altoPortada, setAltoPortada] = useState(232);

    // null = todavía no llegaron, o no se pudieron traer. Las dos cosas se
    // ven igual: la sección no aparece y el resto del inicio sigue.
    const [links, setLinks] = useState<LinkDeNovedad[] | null>(null);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        getLinksPublicos()
            .then(setLinks)
            // El servicio ya atrapa los errores de la base y devuelve null;
            // esto es por si falla la red entera.
            .catch(() => setLinks(null))
            .finally(() => setCargando(false));
    }, []);

    const lista = links || [];
    // "Las que entran" son tres, que es lo que muestra la compu.
    const TARJETA = lista.length > 3 ? CON_ASOMO : JUSTAS;

    /**
     * ¿Desborda? Se mide el ancho de UNA copia contra el del riel. Si todo
     * entra —dos o tres enlaces en la compu—, no se repite nada: ver el
     * mismo enlace dos veces al lado del otro es peor que no poder seguir.
     */
    useLayoutEffect(() => {
        const el = rielRef.current;
        if (!el) { setEnRonda(false); return; }
        const medir = () => {
            const unaCopia = el.scrollWidth / (enRonda ? COPIAS : 1);
            setEnRonda(unaCopia > el.clientWidth + 8);
            const tarjeta = el.querySelector<HTMLElement>('[data-copia]');
            if (tarjeta) setAltoPortada((tarjeta.offsetWidth * 3) / 4);
        };
        medir();
        const observador = new ResizeObserver(medir);
        observador.observe(el);
        return () => observador.disconnect();
    }, [lista.length, enRonda]);

    /**
     * Lo que mide una copia entera, de la primera tarjeta de una a la primera
     * de la siguiente. scrollWidth / COPIAS no sirve: suma el relleno del
     * riel y le falta un espacio, y con eso el salto dejaba la tarjeta corrida
     * unos píxeles del centro.
     */
    const anchoDeCopia = (el: HTMLElement) => {
        const a = el.querySelector<HTMLElement>('[data-copia="0"]');
        const b = el.querySelector<HTMLElement>('[data-copia="1"]');
        return a && b ? b.offsetLeft - a.offsetLeft : el.scrollWidth / COPIAS;
    };

    /**
     * Al entrar en ronda, el riel arranca en la primera tarjeta de la copia
     * del medio: centrada en el teléfono, pegada al borde en la compu.
     */
    useLayoutEffect(() => {
        const el = rielRef.current;
        if (!el || !enRonda) return;
        const tarjeta = el.querySelector<HTMLElement>('[data-copia="1"]');
        if (!tarjeta) return;
        const centrada = getComputedStyle(tarjeta).scrollSnapAlign.includes('center');
        el.scrollLeft = centrada
            ? tarjeta.offsetLeft - (el.clientWidth - tarjeta.offsetWidth) / 2
            : tarjeta.offsetLeft;
    }, [enRonda, lista.length]);

    /**
     * El salto. Cuando el dedo se acerca a una punta, el riel se corre una
     * copia entera: como lo que hay a los dos lados es idéntico, no se ve
     * nada. Se hace cuando el deslizamiento FRENÓ, no durante: tocar
     * scrollLeft a mitad de la inercia la corta en seco.
     */
    const volverAlMedio = () => {
        const el = rielRef.current;
        if (!el || !enRonda) return;
        const unaCopia = anchoDeCopia(el);
        if (el.scrollLeft > unaCopia * 1.75) el.scrollLeft -= unaCopia;
        else if (el.scrollLeft < unaCopia * 0.25) el.scrollLeft += unaCopia;
    };

    /**
     * Una tarjeta por click, con la misma cuenta que el carrusel de grupos.
     *
     * En ronda no hace falta frenar en las puntas: el salto de
     * `volverAlMedio` corre el riel una copia entera cuando esto termina, así
     * que siempre hay algo del otro lado. Sin ronda las flechas no se
     * dibujan, porque no hay nada a dónde ir.
     */
    const correr = (direccion: 1 | -1) => {
        const el = rielRef.current;
        if (!el) return;
        const tarjeta = el.querySelector<HTMLElement>('[data-copia]');
        const paso = tarjeta ? tarjeta.offsetWidth + ESPACIO : el.clientWidth * 0.8;
        el.scrollBy({ left: paso * direccion, behavior: sinMovimiento ? 'auto' : 'smooth' });
    };

    const frenado = useRef<number | undefined>(undefined);
    const alDeslizar = () => {
        window.clearTimeout(frenado.current);
        frenado.current = window.setTimeout(volverAlMedio, 140);
    };

    // Mientras cargan, el lugar ya está tomado: si la sección apareciera de
    // golpe, el inicio daría un salto justo cuando se está por tocar algo.
    if (cargando) {
        return (
            <div className="lg:col-span-3" aria-busy="true">
                <div className="h-5 w-[170px] rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
                <div className="mt-3 h-[13px] w-[280px] max-w-full rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
                <div className={`${FILA} items-start mt-4`}>
                    {[0, 1, 2].map(i => (
                        <div key={i} className={JUSTAS}><Esqueleto /></div>
                    ))}
                </div>
            </div>
        );
    }

    if (lista.length === 0) return null;

    return (
        <div className="lg:col-span-3">
            <h2 className="text-lg sm:text-xl font-bold uppercase tracking-tight leading-[1.05] text-slate-900 dark:text-white">
                Enlaces Origen
            </h2>
            <p className="text-sm font-normal text-slate-500 dark:text-zinc-400 mb-4">
                Lo que está pasando en Origen, en un solo lugar.
            </p>

            <div className="relative group/riel">
                <div ref={rielRef} onScroll={alDeslizar} className={`${FILA} items-stretch`}>
                    {Array.from({ length: enRonda ? COPIAS : 1 }).map((_, copia) =>
                        lista.map(l => (
                            <div
                                key={`${copia}-${l.id}`}
                                data-copia={copia}
                                // Las copias son las mismas tarjetas repetidas: un
                                // lector de pantalla tiene que leer la lista una
                                // sola vez.
                                aria-hidden={copia > 0 || undefined}
                                className={TARJETA}
                            >
                                <TarjetaDeLink
                                    link={l}
                                    onAbrir={() => abrirLink(l, navigate)}
                                />
                            </div>
                        )),
                    )}
                </div>

                {/* Sólo cuando hay a dónde ir. Con tres enlaces o menos en la
                    compu entran todos y una flecha no llevaría a ninguna
                    parte. En el teléfono no van: ahí se desliza con el dedo,
                    y dos botones encima taparían la tarjeta. */}
                {enRonda && (
                    <>
                        <button
                            type="button"
                            onClick={() => correr(-1)}
                            aria-label="Enlaces anteriores"
                            style={{ top: altoPortada / 2 }}
                            className={`hidden sm:flex -left-3 ${FLECHA}`}
                        >
                            <ChevronLeft className="w-4 h-4" strokeWidth={2.2} />
                        </button>
                        <button
                            type="button"
                            onClick={() => correr(1)}
                            aria-label="Más enlaces"
                            style={{ top: altoPortada / 2 }}
                            className={`hidden sm:flex -right-3 ${FLECHA}`}
                        >
                            <ChevronRight className="w-4 h-4" strokeWidth={2.2} />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default SeccionDeEnlaces;
