import React from 'react';
import BannerLinkCarousel, { BannerLinkSlide } from './BannerLinkCarousel';

/**
 * Un bloque de banner de la portada: título, bajada y carrusel.
 *
 * Hoy es sólo Origen Música. Origen en Youvers pasó a ser Recursos Origen
 * (SeccionDeRecursos.tsx). El título y la bajada viajan acá al lado del
 * componente: el día que cambie el texto, cambia en un solo lugar.
 */

export const MUSICA = {
    titulo: 'Origen Música',
    bajada: '¡Acá encontrarás nuestras canciones más recientes de Origen Música! Clickeá la canción para conocer más.',
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
