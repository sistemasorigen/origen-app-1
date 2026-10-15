import React from 'react';
import BannerLinkCarousel, { BannerLinkSlide } from './BannerLinkCarousel';

/**
 * Un bloque de banner de la portada: título, bajada y carrusel.
 *
 * Los dos que hay —Origen Música y Origen en Youvers— son el mismo bloque con
 * otros slides, así que el título y la bajada viajan acá al lado del
 * componente. Si quedaran escritos en cada pantalla, el día que cambie el
 * texto va a cambiar en una sola.
 */

export const MUSICA = {
    titulo: 'Origen Música',
    bajada: '¡Acá encontrarás nuestras canciones más recientes de Origen Música! Clickeá la canción para conocer más.',
};

export const YOUVERS = {
    titulo: 'Origen en Youvers',
    bajada: '¡Acá podrás encontrar todos los devocionales de Origen Iglesia!',
};

const SeccionDeBanner: React.FC<{
    titulo: string;
    bajada: string;
    slides: BannerLinkSlide[];
}> = ({ titulo, bajada, slides }) => {
    if (slides.length === 0) return null;

    return (
        <div className="lg:col-span-3">
            <h2 className="text-lg sm:text-xl font-bold uppercase tracking-tight leading-[1.05] text-slate-900 dark:text-white">{titulo}</h2>
            <p className="text-sm font-normal text-slate-500 dark:text-zinc-400 mb-4">
                {bajada}
            </p>
            <BannerLinkCarousel slides={slides} />
        </div>
    );
};

export default SeccionDeBanner;
