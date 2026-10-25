import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getMediaFrameStyle } from '../ui/CarruselHero';
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Share } from 'lucide-react';
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
 * La forma de la tarjeta: 4:3, la MISMA que el marco del encuadre del panel
 * (pages/admin/EnlacesOrigen.tsx, MARCO). Que sean iguales no es cosmético:
 * el recorte de una imagen con object-cover depende de la proporción de la
 * caja, así que si el panel encuadra en 400×260 y la tarjeta mide 304×260,
 * lo que se eligió no es lo que se ve. Con una proporción fija, el recorte
 * es idéntico en el teléfono, en la compu y en la vista previa.
 *
 * El `min-h` es un piso para pantallas muy angostas (320px), donde la
 * proporción dejaría la tarjeta más corta que su propio texto y el botón
 * quedaría cortado. Ahí el recorte se desvía menos de un 1%: invisible.
 */
const FORMA = 'aspect-[4/3] min-h-[232px]';


/**
 * Qué hace cada toque:
 *
 *   · la tarjeta entera —y su botón "Ver detalles"— la despliega;
 *   · ya desplegada, abajo de todo aparece "Ir al enlace", que es lo único
 *     que lleva afuera.
 *
 * Son dos pasos y no uno a propósito: la bajada no entra en una tarjeta
 * cerrada, y mandar a alguien a un formulario sin que haya podido leer de
 * qué se trata es pedirle que adivine.
 *
 * Un enlace SIN bajada no tiene nada que desplegar: ahí la tarjeta es un
 * link y el botón dice "Ir al enlace" desde el principio.
 *
 * Al desplegarse, la tarjeta deja de tener la imagen de fondo y pasa a
 * tenerla de portada, arriba, como la tarjeta de un grupo de GCX. No es un
 * capricho: estirar una tarjeta con la imagen de fondo la deforma, y un
 * texto largo sobre una foto se vuelve ilegible.
 *
 * La portada conserva la MISMA caja 4:3 que tenía cerrada, así que la imagen
 * no se mueve ni cambia de recorte al abrir: lo único que viaja es el texto,
 * que baja de estar encima a estar debajo.
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
    /**
     * Abierta o cerrada lo decide la sección, no la tarjeta. En el riel
     * infinito cada enlace está dibujado tres veces: si cada copia llevara
     * su propio estado, desplegar una y seguir deslizando mostraría la
     * misma tarjeta cerrada un rato después.
     */
    abierta?: boolean;
    onAlternar?: () => void;
}> = ({ link, onAbrir, vistaPrevia = false, abierta = false, onAlternar }) => {
    const esExterno = link.tipoDestino === 'externo';
    const cierra = textoDeVencimiento(link.vence);
    const conImagen = !!link.imagenUrl;
    /**
     * Sin bajada no hay nada que desplegar: la tarjeta va derecho al link.
     * En la vista previa del panel también vale, aunque ahí no se pueda
     * tocar: lo que se muestra tiene que decir lo mismo que va a decir
     * publicada.
     */
    const hayDetalles = !!link.descripcion;
    const [compartiendo, setCompartiendo] = useState(false);
    /** El link que se comparte: el de afuera tal cual, o la pantalla de la app con su #. */
    const linkParaCompartir = esExterno
        ? link.destino
        : `${typeof window !== 'undefined' ? window.location.origin : 'https://app.origeniglesia.org'}/#${link.destino}`;
    /** Compartir va al lado de "Ir al enlace", y sólo cuando el botón dice eso. */
    const conCompartir = abierta || !hayDetalles;

    const sinMovimiento = useReducedMotion();

    const transicion = sinMovimiento
        ? { duration: 0 }
        : { duration: 0.32, ease: [0.16, 1, 0.3, 1] as const };

    // Cerrada y con imagen, el texto va encima de la foto: blanco. En
    // cualquier otro caso la tarjeta es blanca y el texto, oscuro.
    const sobreLaFoto = conImagen && !abierta;

    const alTocarLaTarjeta = () => {
        if (vistaPrevia) return;
        if (hayDetalles && onAlternar) onAlternar();
        else onAbrir();
    };

    const etiqueta = hayDetalles
        ? `${link.titulo}, ${abierta ? 'ocultar' : 'ver'} los detalles`
        : etiquetaDeLink(link);

    return (
        <motion.div
            layout={!vistaPrevia}
            transition={transicion}
            data-enlace
            role={vistaPrevia ? undefined : hayDetalles ? 'button' : 'link'}
            aria-expanded={hayDetalles ? abierta : undefined}
            tabIndex={vistaPrevia ? undefined : 0}
            aria-label={vistaPrevia ? undefined : etiqueta}
            aria-hidden={vistaPrevia || undefined}
            onClick={alTocarLaTarjeta}
            onKeyDown={vistaPrevia ? undefined : e => {
                // Sólo cuando el foco está en la tarjeta: si está en el botón
                // de adentro, el Enter es de él.
                if (e.target !== e.currentTarget) return;
                // Un div no recibe el Enter del navegador: hay que atender las
                // dos teclas a mano, como haría un <a> o un <button>.
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    alTocarLaTarjeta();
                }
            }}
            className={`relative overflow-hidden ${abierta ? '' : FORMA} rounded-2xl dark:shadow-none ${sobreLaFoto ? 'bg-slate-900' : 'bg-white dark:bg-zinc-900'} ${conImagen
                // Con imagen NO lleva borde, ni siquiera transparente: un
                // borde corre la portada un píxel para adentro al abrir, y
                // entonces el recorte deja de ser el mismo. La sombra alcanza
                // para despegarla del fondo.
                ? (abierta ? 'shadow-[0_4px_16px_rgba(15,23,42,0.08)]' : 'shadow-[0_1px_2px_rgba(15,23,42,0.04)]')
                : 'border border-slate-200 dark:border-zinc-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'} ${vistaPrevia ? '' : 'cursor-pointer hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(15,23,42,0.08)] dark:hover:border-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-zinc-950'}`}
        >
            {conImagen && (
                <motion.div
                    layout={!vistaPrevia}
                    transition={transicion}
                    // Cerrada ocupa toda la tarjeta; abierta es la portada de
                    // arriba. En las dos la caja es la misma 4:3, así que la
                    // imagen no se mueve ni cambia de recorte.
                    className={abierta ? 'relative w-full aspect-[4/3]' : 'absolute inset-0'}
                >
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
                    {/* Sin este velo, un título blanco sobre una foto clara
                        desaparece. Carga abajo, que es donde va el texto. */}
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/15"
                        animate={{ opacity: abierta ? 0 : 1 }}
                        transition={transicion}
                    />
                </motion.div>
            )}

            <motion.div
                layout={!vistaPrevia}
                transition={transicion}
                className={`flex flex-col p-[18px] ${abierta ? 'relative' : 'absolute inset-0'}`}
            >
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

                {/* Cerrada y con imagen, el texto se apoya abajo sobre la parte
                    oscura del velo; en cualquier otro caso arranca arriba. */}
                <div className={sobreLaFoto ? 'mt-auto' : cierra ? 'mt-3.5' : ''}>
                    <p className={`mb-0 text-[17.5px] leading-[1.3] font-bold tracking-[-0.01em] line-clamp-2 [overflow-wrap:anywhere] ${sobreLaFoto ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.35)]' : 'text-slate-900 dark:text-white'}`}>
                        {link.titulo}
                    </p>

                    {/* La bajada aparece recién al desplegar. Cerrada, la
                        tarjeta es el título y poco más: una bajada cortada a
                        mitad de palabra sobre una foto no se lee, y encima
                        tapa el arte. Entra con un poco de atraso para llegar
                        a una superficie que ya existe, no junto con ella. */}
                    {abierta && link.descripcion && (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={sinMovimiento ? { duration: 0 } : { duration: 0.2, delay: 0.1 }}
                            className="mt-1.5 mb-0 text-sm leading-[1.5] [overflow-wrap:anywhere] text-slate-500 dark:text-zinc-400"
                        >
                            {link.descripcion}
                        </motion.p>
                    )}
                </div>

                {/* El envoltorio es el que empuja: el botón queda pegado al pie
                    con 18px de aire, y así los botones de la fila quedan a la
                    misma altura aunque los textos midan distinto. */}
                <span className={`flex w-full gap-2 pt-[18px] ${sobreLaFoto ? '' : 'mt-auto'}`}>
                    {/* Compartir, a la izquierda y más chico: lo principal
                        sigue siendo ir. Abre el mismo panel que los grupos
                        (QR, copiar el link, WhatsApp). */}
                    {conCompartir && (
                        <button
                            type="button"
                            onClick={vistaPrevia ? undefined : e => { e.stopPropagation(); setCompartiendo(true); }}
                            tabIndex={vistaPrevia ? -1 : 0}
                            aria-label={`Compartir ${link.titulo}`}
                            className={`shrink-0 w-[46px] h-[46px] rounded-xl flex items-center justify-center transition-colors ${sobreLaFoto
                                ? 'bg-white/20 text-white backdrop-blur-sm hover:bg-white/30'
                                : 'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-white`}
                        >
                            <Share className="w-[18px] h-[18px]" strokeWidth={2.1} />
                        </button>
                    )}
                    <button
                        type="button"
                        // Cerrada, el botón hace lo mismo que la tarjeta y el
                        // click sube solo. Desplegada es el único que lleva
                        // afuera, así que ahí sí frena el click: si subiera,
                        // la tarjeta se cerraría en el mismo toque.
                        onClick={abierta ? e => { e.stopPropagation(); onAbrir(); } : undefined}
                        tabIndex={abierta ? 0 : -1}
                        aria-hidden={abierta ? undefined : true}
                        className={`flex-1 min-w-0 h-[46px] rounded-xl flex items-center justify-center gap-2 text-[14.5px] font-semibold ${sobreLaFoto
                            ? 'bg-white text-slate-900'
                            : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'}`}
                    >
                        {abierta || !hayDetalles ? (
                            <>
                                Ir al enlace
                                {esExterno
                                    ? <ExternalLink className="w-[15px] h-[15px]" strokeWidth={2.2} />
                                    : <ArrowRight className="w-4 h-4" strokeWidth={2.2} />}
                            </>
                        ) : (
                            <>
                                Ver detalles
                                <ChevronDown className="w-4 h-4" strokeWidth={2.4} />
                            </>
                        )}
                    </button>
                </span>
            </motion.div>

            {/* El panel se dibuja afuera (portal), pero en React sus clicks
                suben igual hasta la tarjeta: sin este freno, "Copiar link"
                la plegaba. `contents`: el envoltorio no ocupa lugar. */}
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
        </motion.div>
    );
};

// ── Mientras llegan ─────────────────────────────────────────────────────

const Esqueleto: React.FC = () => (
    <div className={`p-[18px] rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 ${FORMA}`}>
        <div className="h-6 w-24 rounded-full bg-slate-200 dark:bg-zinc-800 animate-pulse" />
        <div className="mt-4 h-[18px] w-[85%] rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
        <div className="mt-3 h-[13px] w-full rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
        <div className="mt-2 h-[13px] w-[65%] rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
        <div className="mt-5 h-[46px] w-full rounded-xl bg-slate-200 dark:bg-zinc-800 animate-pulse" />
    </div>
);

// ── La sección ──────────────────────────────────────────────────────────

/**
 * Las dos flechas de la compu. Redondas, chicas y por fuera del riel, como
 * las del carrusel de grupos.
 *
 * El `top` lo pone la sección, medido: no puede ser la mitad del riel porque
 * con una tarjeta desplegada el riel se estira y las flechas se irían para
 * abajo, lejos de las tarjetas cerradas.
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
 */
const FILA = 'relative flex gap-3 sm:gap-4 -mx-4 px-[44px] sm:mx-0 sm:px-0 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-1 items-start';

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
     * El alto de una tarjeta CERRADA, para poner las flechas a su mitad.
     *
     * Se calcula con el ancho —que es el que manda, por la proporción 4:3 de
     * FORMA— y no se mide la tarjeta: la primera puede estar desplegada, y
     * entonces las flechas se moverían al abrirla. El piso de 232 es el
     * `min-h` de FORMA, que gana en pantallas muy angostas.
     */
    const [altoCerrada, setAltoCerrada] = useState(232);
    /** Abierta o cerrada: lo sabe la sección, porque cada enlace se dibuja tres veces. */
    const [abiertoId, setAbiertoId] = useState<string | null>(null);

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
            if (tarjeta) setAltoCerrada(Math.max(232, (tarjeta.offsetWidth * 3) / 4));
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
                <div className={`${FILA} mt-4`}>
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
                <div ref={rielRef} onScroll={alDeslizar} className={FILA}>
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
                                    abierta={abiertoId === l.id}
                                    onAlternar={() => setAbiertoId(a => (a === l.id ? null : l.id))}
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
                            style={{ top: altoCerrada / 2 }}
                            className={`hidden sm:flex -left-3 ${FLECHA}`}
                        >
                            <ChevronLeft className="w-4 h-4" strokeWidth={2.2} />
                        </button>
                        <button
                            type="button"
                            onClick={() => correr(1)}
                            aria-label="Más enlaces"
                            style={{ top: altoCerrada / 2 }}
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
