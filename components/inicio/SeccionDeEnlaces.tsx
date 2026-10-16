import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
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
 * Va en el inicio, entre Origen en Youvers y Grupos para vos. Muestra de a
 * tres y pasa a los tres siguientes con las flechas de los costados, que dan
 * la vuelta al llegar al final: con dos páginas, ningún botón queda muerto.
 *
 * En el teléfono las tres entran en un riel que se puede deslizar con el
 * dedo —igual que los grupos—, así la fila mide una tarjeta de alto y las
 * flechas quedan a los costados y no encima de nada.
 *
 * Si no hay links, o si no se pudieron traer, la sección no aparece y el
 * resto del inicio sigue igual.
 */

const POR_PAGINA = 3;

// ── La tarjeta ──────────────────────────────────────────────────────────

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
            className={`flex flex-col h-full p-[18px] rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none ${vistaPrevia ? '' : 'cursor-pointer transition-all duration-150 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(15,23,42,0.08)] dark:hover:border-zinc-600 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-zinc-950'}`}
        >
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
                            <span className="w-[5px] h-[5px] rounded-full bg-white dark:bg-zinc-900" />
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

            <p className="mt-3.5 mb-0 text-[17.5px] leading-[1.3] font-bold tracking-[-0.01em] text-slate-900 dark:text-white line-clamp-2 [overflow-wrap:anywhere]">
                {link.titulo}
            </p>

            {/* Sin descripción no queda hueco: el botón sube. */}
            {link.descripcion && (
                <p className="mt-1.5 mb-0 text-sm leading-[1.5] text-slate-500 dark:text-zinc-400 line-clamp-3 [overflow-wrap:anywhere]">
                    {link.descripcion}
                </p>
            )}

            {/* El botón se va al pie: con tres tarjetas al lado, el ojo
                necesita que todos los "Ir al enlace" estén a la misma altura. */}
            {/* El envoltorio es el que empuja: el botón queda pegado al pie
                con 18px de aire, y así los tres "Ir al enlace" de la fila
                quedan a la misma altura aunque los textos midan distinto. */}
            <span className="mt-auto block w-full pt-[18px]">
                <span className="w-full h-[46px] rounded-xl flex items-center justify-center gap-2 text-[14.5px] font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                    Ir al enlace
                    {esExterno
                        ? <ExternalLink className="w-[15px] h-[15px]" strokeWidth={2.2} />
                        : <ArrowRight className="w-4 h-4" strokeWidth={2.2} />}
                </span>
            </span>
        </div>
    );
};

// ── Mientras llegan ─────────────────────────────────────────────────────

const Esqueleto: React.FC = () => (
    <div className="p-[18px] rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
        <div className="h-6 w-24 rounded-full bg-slate-200 dark:bg-zinc-800 animate-pulse" />
        <div className="mt-4 h-[18px] w-[85%] rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
        <div className="mt-3 h-[13px] w-full rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
        <div className="mt-2 h-[13px] w-[65%] rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
        <div className="mt-5 h-[46px] w-full rounded-xl bg-slate-200 dark:bg-zinc-800 animate-pulse" />
    </div>
);

// ── La sección ──────────────────────────────────────────────────────────

/** El riel del teléfono y la grilla de la compu, en un solo árbol. */
const FILA = 'flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-1 items-stretch sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible lg:grid-cols-3';
const TARJETA = 'snap-start shrink-0 w-[85%] sm:w-auto';

const FLECHA = 'absolute top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-md flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 active:scale-95 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-zinc-950';

const SeccionDeEnlaces: React.FC = () => {
    const navigate = useNavigate();

    // null = todavía no llegaron, o no se pudieron traer. Las dos cosas se
    // ven igual: la sección no aparece y el resto del inicio sigue.
    const [links, setLinks] = useState<LinkDeNovedad[] | null>(null);
    const [cargando, setCargando] = useState(true);
    const [pagina, setPagina] = useState(0);

    useEffect(() => {
        getLinksPublicos()
            .then(setLinks)
            // El servicio ya atrapa los errores de la base y devuelve null;
            // esto es por si falla la red entera.
            .catch(() => setLinks(null))
            .finally(() => setCargando(false));
    }, []);

    const lista = links || [];
    const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
    const actual = Math.min(pagina, paginas - 1);
    const desde = actual * POR_PAGINA;
    const visibles = lista.slice(desde, desde + POR_PAGINA);

    // Mientras cargan, el lugar ya está tomado: si la sección apareciera de
    // golpe, el inicio daría un salto justo cuando se está por tocar algo.
    if (cargando) {
        return (
            <div className="lg:col-span-3" aria-busy="true">
                <div className="h-5 w-[170px] rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
                <div className="mt-3 h-[13px] w-[280px] max-w-full rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
                <div className={`${FILA} mt-4`}>
                    {[0, 1, 2].map(i => (
                        <div key={i} className={TARJETA}><Esqueleto /></div>
                    ))}
                </div>
            </div>
        );
    }

    if (lista.length === 0) return null;

    const ir = (paso: 1 | -1) => setPagina((actual + paso + paginas) % paginas);

    return (
        <div className="lg:col-span-3">
            <h2 className="text-lg sm:text-xl font-bold uppercase tracking-tight leading-[1.05] text-slate-900 dark:text-white">
                Enlaces Origen
            </h2>
            <p className="text-sm font-normal text-slate-500 dark:text-zinc-400 mb-4">
                Lo que está pasando en Origen, en un solo lugar.
            </p>

            <div className="relative">
                <div className={FILA}>
                    {visibles.map(l => (
                        <div key={l.id} className={TARJETA}>
                            <TarjetaDeLink link={l} onAbrir={() => abrirLink(l, navigate)} />
                        </div>
                    ))}
                </div>

                {paginas > 1 && (
                    <>
                        <button
                            type="button"
                            onClick={() => ir(-1)}
                            aria-label="Ver los tres enlaces anteriores"
                            className={`${FLECHA} -left-4 sm:-left-3`}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => ir(1)}
                            aria-label="Ver los tres enlaces siguientes"
                            className={`${FLECHA} -right-4 sm:-right-3`}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>

                        {/* Para quien no ve la pantalla: que el cambio se oiga. */}
                        <p aria-live="polite" className="sr-only">
                            {`Enlaces ${desde + 1} a ${desde + visibles.length} de ${lista.length}`}
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};

export default SeccionDeEnlaces;
