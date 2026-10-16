import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMediaFrameStyle } from '../ui/CarruselHero';
import { ArrowRight, ArrowUpRight, ExternalLink } from 'lucide-react';
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
 * El alto de la tarjeta, igual para todas y en los dos tamaños de pantalla.
 * Es fijo a propósito: con una imagen de fondo, una tarjeta que crece con su
 * texto deja a las de al lado con el recorte corrido.
 */
const ALTO = 'h-[260px]';


/**
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

    return (
        <div
            role={vistaPrevia ? undefined : 'link'}
            tabIndex={vistaPrevia ? undefined : 0}
            aria-label={vistaPrevia ? undefined : etiquetaDeLink(link)}
            aria-hidden={vistaPrevia || undefined}
            onClick={vistaPrevia ? undefined : onAbrir}
            onKeyDown={vistaPrevia ? undefined : e => {
                // Un div con role="link" no recibe el Enter del navegador:
                // hay que atender las dos teclas a mano, como haría un <a>.
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onAbrir();
                }
            }}
            className={`relative overflow-hidden ${ALTO} rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none ${conImagen
                ? 'bg-slate-900'
                : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800'} ${vistaPrevia ? '' : 'cursor-pointer transition-all duration-150 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(15,23,42,0.08)] dark:hover:border-zinc-600 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-zinc-950'}`}
        >
            {conImagen && (
                <>
                    {/* El encuadre sale de la misma función que dibuja los
                        banners de la home: lo que se eligió en el panel es
                        exactamente lo que se ve acá. */}
                    <img
                        src={link.imagenUrl as string}
                        alt=""
                        draggable={false}
                        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
                        style={getMediaFrameStyle(link)}
                    />
                    {/* Sin este velo, un título blanco sobre una foto clara
                        desaparece. Carga abajo, que es donde va el texto. */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/15" />
                </>
            )}

            <div className="relative flex flex-col h-full p-[18px]">
                <div className="flex flex-wrap gap-1.5">
                    <span className={`inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-full text-xs font-semibold whitespace-nowrap ${esExterno
                        ? 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300'
                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'}`}>
                        {esExterno ? (
                            <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2.4} />
                        ) : (
                            // La marca de "esto es de acá": un cuadradito con un
                            // punto calado, como en el diseño.
                            <span className="w-3.5 h-3.5 rounded bg-current flex items-center justify-center">
                                <span className={`w-[5px] h-[5px] rounded-full ${esExterno ? 'bg-slate-100' : 'bg-emerald-50'} dark:bg-zinc-900`} />
                            </span>
                        )}
                        {esExterno ? 'Link externo' : 'En Origen'}
                    </span>

                    {cierra && (
                        <span className="inline-flex items-center h-[26px] px-2.5 rounded-full text-xs font-semibold whitespace-nowrap bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                            {cierra}
                        </span>
                    )}
                </div>

                {/* Con imagen el texto se apoya abajo, sobre la parte oscura
                    del velo; sin imagen arranca arriba, como siempre. */}
                <div className={conImagen ? 'mt-auto' : 'mt-3.5'}>
                    <p className={`mb-0 text-[17.5px] leading-[1.3] font-bold tracking-[-0.01em] line-clamp-2 [overflow-wrap:anywhere] ${conImagen ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.35)]' : 'text-slate-900 dark:text-white'}`}>
                        {link.titulo}
                    </p>

                    {/* Sin descripción no queda hueco: el botón sube. */}
                    {link.descripcion && (
                        <p className={`mt-1.5 mb-0 text-sm leading-[1.5] [overflow-wrap:anywhere] ${conImagen ? 'text-white/85 line-clamp-2' : 'text-slate-500 dark:text-zinc-400 line-clamp-3'}`}>
                            {link.descripcion}
                        </p>
                    )}
                </div>

                {/* El envoltorio es el que empuja: el botón queda pegado al pie
                    con 18px de aire, y así los "Ir al enlace" de la fila quedan
                    a la misma altura aunque los textos midan distinto. */}
                <span className={`block w-full pt-[18px] ${conImagen ? '' : 'mt-auto'}`}>
                    <span className={`w-full h-[46px] rounded-xl flex items-center justify-center gap-2 text-[14.5px] font-semibold ${conImagen
                        ? 'bg-white text-slate-900'
                        : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'}`}>
                        Ir al enlace
                        {esExterno
                            ? <ExternalLink className="w-[15px] h-[15px]" strokeWidth={2.2} />
                            : <ArrowRight className="w-4 h-4" strokeWidth={2.2} />}
                    </span>
                </span>
            </div>
        </div>
    );
};

// ── Mientras llegan ─────────────────────────────────────────────────────

const Esqueleto: React.FC = () => (
    <div className={`p-[18px] rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 ${ALTO}`}>
        <div className="h-6 w-24 rounded-full bg-slate-200 dark:bg-zinc-800 animate-pulse" />
        <div className="mt-4 h-[18px] w-[85%] rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
        <div className="mt-3 h-[13px] w-full rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
        <div className="mt-2 h-[13px] w-[65%] rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
        <div className="mt-5 h-[46px] w-full rounded-xl bg-slate-200 dark:bg-zinc-800 animate-pulse" />
    </div>
);

// ── La sección ──────────────────────────────────────────────────────────

/** El riel del teléfono y la grilla de la compu, en un solo árbol. */
const FILA = 'flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-1 items-stretch';

/**
 * El ancho de una tarjeta. Las cuentas son las que hacen que entren justo:
 * dos tarjetas y un espacio de 16px, o tres y dos espacios.
 *
 * Cuando hay más de las que entran se les restan 26px, y esos 26px son los
 * que deja asomar a la siguiente. Sin eso, en la compu tres tarjetas llenan
 * la fila exacta y nada dice que haya una cuarta.
 */
const JUSTAS = 'snap-start shrink-0 w-[85%] sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]';
const CON_ASOMO = 'snap-start shrink-0 w-[85%] sm:w-[calc((100%-1rem)/2-26px)] lg:w-[calc((100%-2rem)/3-26px)]';

const SeccionDeEnlaces: React.FC = () => {
    const navigate = useNavigate();

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

            <div className={FILA}>
                {lista.map(l => (
                    <div key={l.id} className={TARJETA}>
                        <TarjetaDeLink link={l} onAbrir={() => abrirLink(l, navigate)} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SeccionDeEnlaces;
