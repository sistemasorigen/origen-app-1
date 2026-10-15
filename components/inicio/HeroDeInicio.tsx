import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AppConfig } from '../../types';
import HeroCarousel from '../ui/CarruselHero';

/**
 * El banner principal de la portada.
 *
 * Es una pieza aparte porque son dos cosas juntas que tienen que viajar
 * juntas: el mapeo de los slides que carga el admin (con su slide de
 * respaldo y su proporción) y el div que lo monta a sangre bajo la navbar.
 * Separarlas es lo que hace que dos pantallas muestren "el mismo" banner
 * con dos alturas distintas.
 */
const HeroDeInicio: React.FC<{ config: AppConfig; isLoaded: boolean }> = ({ config, isLoaded }) => {
    const navigate = useNavigate();

    // El CTA del banner lo carga un admin y puede apuntar adentro o afuera
    // de la app. Un link externo pasado a navigate() rompe (React Router lo
    // trataría como ruta interna y caería en 404), así que se separan.
    const openBannerLink = (link: string) => {
        if (/^(https?:)?\/\//i.test(link) || link.startsWith('mailto:') || link.startsWith('tel:')) {
            window.open(link, '_blank', 'noopener,noreferrer');
        } else {
            navigate(link.startsWith('/') ? link : `/${link}`);
        }
    };

    // === HERO — a sangre y al ras del tope de la página ===
    // Vive fuera del contenedor con padding: la navbar es
    // transparente y se monta encima (Estructura.tsx sube el
    // contenido 64px en el dashboard), así que el hero llega
    // hasta el borde superior. Sólo se redondea abajo — arriba
    // va al ras, y a los costados también, porque un borde
    // superior recto contra un margen lateral se vería roto.
    // El alto compensa los 64px que tapa la navbar.
    return (
        <div
            id="dashboard-hero"
            className={`rounded-b-3xl overflow-hidden ${isLoaded ? 'animate-fadeIn' : 'opacity-0'}`}
        >
            <HeroCarousel
                slides={(config.banner?.slides && config.banner.slides.length > 0)
                    ? config.banner.slides.map(s => ({
                        id: s.id,
                        imageUrl: s.imageUrl,
                        mediaType: s.mediaType,
                        videoUrl: s.videoUrl,
                        focalX: s.focalX,
                        focalY: s.focalY,
                        zoom: s.zoom,
                        title: s.title,
                        titlePrefix: s.titlePrefix,
                        titleHighlight: s.titleHighlight,
                        subtitle: s.subtitle,
                        description: s.description,
                        // El CTA sólo se dibuja si tiene a dónde ir: un
                        // botón sin destino se ve igual que uno roto.
                        buttonText: s.buttonLink ? s.buttonText : undefined,
                        onButtonClick: s.buttonLink ? () => openBannerLink(s.buttonLink as string) : undefined
                    }))
                    : [
                        // Slide de respaldo: sólo se usa cuando el admin
                        // todavía no cargó ninguno.
                        {
                            id: 'default-hero',
                            imageUrl: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?q=80&w=2073&auto=format&fit=crop',
                            titlePrefix: 'Origen',
                            titleHighlight: 'App',
                            description: 'Áreas de Servicio'
                        }
                    ]
                }
                theme="soft"
                // Con medidas cargadas desde el admin manda esa proporción;
                // sin ellas se conserva el alto por viewport de siempre.
                aspectRatio={
                    config.banner?.frameWidth && config.banner?.frameHeight
                        ? `${config.banner.frameWidth} / ${config.banner.frameHeight}`
                        : undefined
                }
                heightClass="h-[46vh] sm:h-[50vh] md:h-[54vh] lg:h-[480px]"
                autoPlayInterval={5000}
            />
        </div>
    );
};

export default HeroDeInicio;
