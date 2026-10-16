import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, ExternalLink } from 'lucide-react';
import { User } from '../../types';
import HeroDeInicio from '../../components/inicio/HeroDeInicio';
import SeccionDeBanner, { MUSICA, YOUVERS } from '../../components/inicio/SeccionDeBanner';
import SeccionGruposParaVos from '../../components/inicio/SeccionGruposParaVos';
import PieDeInicio from '../../components/inicio/PieDeInicio';
import { useBannersDeInicio } from '../../src/hooks/useBannersDeInicio';
import {
    getLinksPublicos,
    abrirLink,
    etiquetaDeLink,
    textoDeVencimiento,
    type LinkDeNovedad,
} from '../../services/novedades';

/**
 * /novedades — lo que está pasando en Origen, en un solo lugar.
 *
 * Es pública: se entra con sesión o sin ella. Casi toda la pantalla son las
 * piezas compartidas con el inicio (el banner, los dos carruseles, los
 * grupos y el pie), así que lo único propio de acá es la grilla de links.
 * Nada de eso se copia del Home a mano: si el inicio cambia, esta pantalla
 * cambia con él.
 */

// ── La tarjeta de un link ───────────────────────────────────────────────

/**
 * Se exporta porque el panel la usa como vista previa mientras se carga un
 * link (pages/admin/LinksNovedades.tsx). Es la misma tarjeta, no una copia:
 * lo que se ve en el panel es literalmente lo que se va a publicar.
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
            className={`flex flex-col p-[18px] rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none ${vistaPrevia ? '' : 'cursor-pointer transition-all duration-150 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(15,23,42,0.08)] dark:hover:border-zinc-600 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-zinc-950'}`}
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

            <span className="mt-[18px] w-full h-[46px] rounded-xl flex items-center justify-center gap-2 text-[14.5px] font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                Ir al enlace
                {esExterno
                    ? <ExternalLink className="w-[15px] h-[15px]" strokeWidth={2.2} />
                    : <ArrowRight className="w-4 h-4" strokeWidth={2.2} />}
            </span>
        </div>
    );
};

// ── Mientras llegan ─────────────────────────────────────────────────────

const GRILLA = 'grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))] md:[grid-template-columns:repeat(auto-fill,minmax(340px,1fr))] items-start';

const Esqueletos: React.FC = () => (
    <div aria-busy="true" className="lg:col-span-3">
        <div className="h-[11px] w-[70px] rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
        <div className="mt-2.5 h-5 w-[190px] rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
        <div className="mt-3 h-[13px] w-[300px] max-w-full rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
        <div className={`${GRILLA} mt-[22px]`}>
            {[0, 1, 2].map(i => (
                <div key={i} className="p-[18px] rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                    <div className="h-6 w-24 rounded-full bg-slate-200 dark:bg-zinc-800 animate-pulse" />
                    <div className="mt-4 h-[18px] w-[85%] rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
                    <div className="mt-3 h-[13px] w-full rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
                    <div className="mt-2 h-[13px] w-[65%] rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
                    <div className="mt-5 h-[46px] w-full rounded-xl bg-slate-200 dark:bg-zinc-800 animate-pulse" />
                </div>
            ))}
        </div>
    </div>
);

// ── La pantalla ─────────────────────────────────────────────────────────

const Novedades: React.FC<{ currentUser: User | null }> = ({ currentUser }) => {
    const navigate = useNavigate();
    const { config, footerLinks, isLoaded, musicaSlides, youversSlides } = useBannersDeInicio();

    // null = todavía no llegaron, o no se pudieron traer. Las dos cosas se
    // ven igual en pantalla: la sección no aparece y el resto sigue.
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

    return (
        <div className="w-full min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white font-sans flex flex-col relative">

            <HeroDeInicio config={config} isLoaded={isLoaded} />

            <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-16 flex-1">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">

                    {cargando ? <Esqueletos /> : (links && links.length > 0 && (
                        <section aria-labelledby="novedades-titulo" className="lg:col-span-3 animate-fadeIn">
                            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Origen</p>
                            <h1 id="novedades-titulo" className="mt-2 mb-0 text-lg sm:text-xl font-bold uppercase tracking-tight leading-[1.05] text-slate-900 dark:text-white">
                                Novedades
                            </h1>
                            <p className="mt-2 mb-0 text-sm font-normal leading-[1.5] text-slate-500 dark:text-zinc-400">
                                Lo que está pasando en Origen, en un solo lugar.
                            </p>

                            <div className={`${GRILLA} mt-[22px]`}>
                                {links.map(l => (
                                    <TarjetaDeLink key={l.id} link={l} onAbrir={() => abrirLink(l, navigate)} />
                                ))}
                            </div>
                        </section>
                    ))}

                    <SeccionDeBanner {...MUSICA} slides={musicaSlides} />
                    <SeccionDeBanner {...YOUVERS} slides={youversSlides} />

                    <SeccionGruposParaVos currentUser={currentUser} />
                </div>
            </div>

            <PieDeInicio footerLinks={footerLinks} isLoaded={isLoaded} />
        </div>
    );
};

export default Novedades;
