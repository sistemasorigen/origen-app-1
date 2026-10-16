import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getMediaFrameStyle } from '../ui/CarruselHero';
import { ArrowRight, ChevronDown, ExternalLink } from 'lucide-react';
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
 * para que la de al lado asome. Esa es toda la señal de "seguí": no hay
 * flechas ni puntos.
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
                <span className={`block w-full pt-[18px] ${sobreLaFoto ? '' : 'mt-auto'}`}>
                    <button
                        type="button"
                        // Cerrada, el botón hace lo mismo que la tarjeta y el
                        // click sube solo. Desplegada es el único que lleva
                        // afuera, así que ahí sí frena el click: si subiera,
                        // la tarjeta se cerraría en el mismo toque.
                        onClick={abierta ? e => { e.stopPropagation(); onAbrir(); } : undefined}
                        tabIndex={abierta ? 0 : -1}
                        aria-hidden={abierta ? undefined : true}
                        className={`w-full h-[46px] rounded-xl flex items-center justify-center gap-2 text-[14.5px] font-semibold ${sobreLaFoto
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

/** El riel del teléfono y la grilla de la compu, en un solo árbol. */
const FILA = 'flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-1 items-start';

/**
 * El ancho de una tarjeta. Las cuentas son las que hacen que entren justo:
 * dos tarjetas y un espacio de 16px, o tres y dos espacios.
 *
 * Cuando hay más de las que entran se les restan 26px, y esos 26px son los
 * que deja asomar a la siguiente. Sin eso, en la compu tres tarjetas llenan
 * la fila exacta y nada dice que haya una cuarta.
 */
const JUSTAS = 'snap-start shrink-0 w-[90%] sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]';
const CON_ASOMO = 'snap-start shrink-0 w-[90%] sm:w-[calc((100%-1rem)/2-26px)] lg:w-[calc((100%-2rem)/3-26px)]';

/**
 * Cuántas veces se dibuja la lista para que el riel no tenga punta. Son
 * tres y no dos para poder arrancar en la del medio: así sobra una copia
 * entera para cada lado y la vuelta se puede dar también hacia atrás, que
 * con el scroll nativo —que frena en cero— de otra forma no se puede.
 */
const COPIAS = 3;

const SeccionDeEnlaces: React.FC = () => {
    const navigate = useNavigate();
    const rielRef = useRef<HTMLDivElement>(null);
    /** Sólo tiene sentido dar la vuelta si lo que hay no entra en pantalla. */
    const [enRonda, setEnRonda] = useState(false);
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
        };
        medir();
        const observador = new ResizeObserver(medir);
        observador.observe(el);
        return () => observador.disconnect();
    }, [lista.length, enRonda]);

    /** Al entrar en ronda, el riel arranca en la copia del medio. */
    useLayoutEffect(() => {
        const el = rielRef.current;
        if (!el || !enRonda) return;
        el.scrollLeft = el.scrollWidth / COPIAS;
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
        const unaCopia = el.scrollWidth / COPIAS;
        if (el.scrollLeft > unaCopia * 1.75) el.scrollLeft -= unaCopia;
        else if (el.scrollLeft < unaCopia * 0.25) el.scrollLeft += unaCopia;
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
        </div>
    );
};

export default SeccionDeEnlaces;
