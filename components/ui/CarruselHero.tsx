
import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface HeroSlideData {
    id: string;
    // Opcional: sin ella, el fallback es directamente pantalla negra (ver
    // el fondo bg-black del contenedor y el branding condicional del <img> abajo).
    imageUrl?: string;
    mediaType?: 'image' | 'video';  // Ausente = 'image'
    videoUrl?: string;
    focalX?: number;
    focalY?: number;
    zoom?: number;
    eyebrow?: string;
    title?: string;           // New: Main headline
    subtitle?: string;        // New: Sub-headline
    titlePrefix?: string;     // Legacy
    titleHighlight?: string;  // Legacy
    description?: string;     // Legacy
    buttonText?: string;
    onButtonClick?: () => void;
    overlayColor?: string;
}

interface HeroCarouselProps {
    slides: HeroSlideData[];
    autoPlayInterval?: number;
    heightClass?: string;
    /** Proporción del encuadre, ej "1920 / 640". Si viene, reemplaza a heightClass. */
    aspectRatio?: string;
    theme?: 'default' | 'alabanza' | 'store' | 'infopoint' | 'groups' | 'prode' | 'soft';
}

/**
 * Traduce el encuadre de un slide a CSS.
 *
 * El medio siempre llena el marco (object-cover) y sobra por algún lado; el
 * punto focal decide qué borde se sacrifica. El zoom escala desde ese mismo
 * punto, no desde el centro: si no, alejarte del centro y después ampliar
 * movería el encuadre a un lugar que nadie eligió.
 *
 * Se exporta para que el editor del admin previsualice con exactamente la
 * misma fórmula que usa el banner real.
 */
export const getMediaFrameStyle = (
    slide: Pick<HeroSlideData, 'focalX' | 'focalY' | 'zoom'>
): React.CSSProperties => {
    const x = slide.focalX ?? 50;
    const y = slide.focalY ?? 50;
    const zoom = slide.zoom ?? 1;
    return {
        objectPosition: `${x}% ${y}%`,
        transform: zoom !== 1 ? `scale(${zoom})` : undefined,
        transformOrigin: `${x}% ${y}%`
    };
};

// Intenta reproducir un video — si el navegador lo
// rechaza (comúnmente porque todavía no bufereó lo
// suficiente en el primer intento), escucha 'canplay'
// y reintenta apenas el navegador confirma que ya
// puede arrancar. Sin esto, un rechazo temprano deja
// el video pausado para siempre sin ningún aviso.
const playWithRetry = (video: HTMLVideoElement) => {
    video.play().catch(() => {
        const retryOnReady = () => {
            video.play().catch(() => { /* el navegador decidió no reproducir, ahora sí definitivo */ });
        };
        video.addEventListener('canplay', retryOnReady, { once: true });
    });
};

const HeroCarousel: React.FC<HeroCarouselProps> = ({
    slides,
    autoPlayInterval = 6000,
    heightClass = 'h-screen',
    aspectRatio,
    theme = 'default'
}) => {
    const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
    const touchStartXRef = useRef<number | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    // Posición dentro de la pista (puede caer en el clon del final, ver abajo).
    const [index, setIndex] = useState(0);
    const [animate, setAnimate] = useState(true);
    const [isPaused, setIsPaused] = useState(false);

    const total = slides.length;
    // Con más de un slide se agrega al final un clon del primero. Avanzar del
    // último al primero pasa por el clon —o sea, sigue desplazándose hacia la
    // izquierda— y recién ahí se vuelve al índice 0 sin animación, en el
    // fotograma en que el clon está a la vista. Sin esto, el salto de vuelta
    // se vería como un barrido hacia la derecha recorriendo todo al revés.
    const hasLoop = total > 1;
    const track = hasLoop ? [...slides, slides[0]] : slides;
    // El clon representa al primer slide, así que para los dots vale como 0.
    const activeIndex = total > 0 ? index % total : 0;

    /**
     * Salta a una posición sin animar y devuelve la transición en el
     * fotograma siguiente. Los dos requestAnimationFrame son necesarios: con
     * uno solo el navegador todavía no pintó el salto, y al reactivar la
     * transición lo animaría — que es justo lo que se quiere evitar.
     */
    const jumpTo = (target: number, then?: () => void) => {
        setAnimate(false);
        setIndex(target);
        requestAnimationFrame(() => requestAnimationFrame(() => {
            setAnimate(true);
            then?.();
        }));
    };

    // Sólo reproduce el slide visible. El atributo autoPlay no alcanza: los
    // elementos persisten entre slides, así que sin esto los videos que ya
    // pasaron seguirían corriendo detrás gastando batería. El play() devuelve
    // una promesa que se rechaza si el navegador bloquea la reproducción —
    // sin catch quedaría un unhandled rejection en consola.
    // Las refs van por posición en la pista y no por id: el clon comparte el
    // id del primer slide y se pisarían entre sí en el Map.
    useEffect(() => {
        videoRefs.current.forEach((video, position) => {
            if (position === index) {
                playWithRetry(video);
            } else {
                video.pause();
            }
        });
    }, [index]);

    // Red de seguridad para cuando el video activo queda pausado por el
    // navegador sin que React se entere — el effect de arriba sólo llama a
    // play() cuando CAMBIA el índice, y hay dos formas de volver sin que
    // eso pase:
    //
    // 1. El hero sale del viewport y vuelve (scrollear hacia abajo por el
    //    resto del Home y volver arriba) — en mobile los navegadores suelen
    //    pausar/soltar el buffer de un <video> lejos de pantalla por
    //    memoria. Lo cubre el IntersectionObserver.
    // 2. Se cambia de pestaña (o se bloquea el celular) unos minutos y se
    //    vuelve — la posición de scroll no cambió, así que el hero ya
    //    estaba "intersectando" antes de irse y el observer de arriba NO
    //    dispara de nuevo al volver. Acá el navegador puede pausar/soltar
    //    el video igual, sólo que por estar la pestaña oculta en vez de
    //    estar fuera del viewport. Lo cubre visibilitychange.
    useEffect(() => {
        const resumeActiveVideo = () => {
            const video = videoRefs.current.get(index);
            if (video && video.paused) {
                playWithRetry(video);
            }
        };

        const root = rootRef.current;
        const observer = root
            ? new IntersectionObserver(([entry]) => {
                if (entry.isIntersecting) resumeActiveVideo();
            }, { threshold: 0 })
            : null;
        if (root && observer) observer.observe(root);

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') resumeActiveVideo();
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            observer?.disconnect();
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [index]);

    useEffect(() => () => {
        if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    }, []);

    useEffect(() => {
        if (!autoPlayInterval || isPaused || total <= 1) return;
        const interval = setInterval(() => setIndex(i => i + 1), autoPlayInterval);
        return () => clearInterval(interval);
    }, [isPaused, total, autoPlayInterval]);

    // Pausa mientras el usuario interactúa, y se reanuda sola. Antes
    // `isPaused` se activaba con el primer hover o toque y nada lo volvía
    // a apagar: el autoplay moría para siempre apenas tocabas el banner.
    const pauseTemporarily = () => {
        setIsPaused(true);
        if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = setTimeout(() => setIsPaused(false), 8000);
    };

    const resumeNow = () => {
        if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
        setIsPaused(false);
    };

    // Al terminar de entrar el clon se vuelve al original sin animación. El
    // clon es idéntico al primer slide, así que el cambio es invisible.
    const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
        if (e.propertyName !== 'transform' || e.target !== e.currentTarget) return;
        if (hasLoop && index === total) jumpTo(0);
    };

    const handleNext = () => {
        pauseTemporarily();
        setIndex(i => (i >= total ? i : i + 1));
    };

    const handlePrev = () => {
        pauseTemporarily();
        if (index === 0 && hasLoop) {
            // Mismo truco al revés: se salta al clon del final sin animar y
            // desde ahí se retrocede un paso. "Anterior" mueve un solo slide
            // en vez de barrer todo el carrusel.
            jumpTo(total, () => setIndex(total - 1));
            return;
        }
        setIndex(i => Math.max(0, i - 1));
    };

    const goToIndex = (target: number) => {
        pauseTemporarily();
        setIndex(target);
    };

    const handleUserInteraction = () => {
        pauseTemporarily();
    };

    // El swipe se maneja a mano porque la pista ya no es un contenedor con
    // scroll horizontal: sin esto el hero dejaría de ser deslizable en el
    // teléfono. El umbral distingue un swipe de un toque al pasar el dedo.
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartXRef.current = e.touches[0].clientX;
        handleUserInteraction();
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        const start = touchStartXRef.current;
        touchStartXRef.current = null;
        if (start === null || !hasLoop) return;
        const delta = e.changedTouches[0].clientX - start;
        if (Math.abs(delta) < 50) return;
        if (delta < 0) handleNext();
        else handlePrev();
    };

    if (!slides || slides.length === 0) return null;

    const animBase = "opacity-0";
    const animActive = "animate-fadeInUp";

    const getOverlayClass = () => {
        if (theme === 'alabanza') return 'bg-white/30 mix-blend-overlay';
        if (theme === 'infopoint') return 'bg-gradient-to-t from-black/60 via-black/20 to-transparent';
        if (theme === 'groups') return 'bg-gradient-to-t from-black/70 via-black/30 to-transparent';
        if (theme === 'prode') return 'bg-transparent';
        // Antes iba sin velo porque el texto traía su propio contorno negro.
        // Con la tipografía de Grupos —blanca lisa, sólo drop-shadow— el velo
        // es lo único que la sostiene sobre una foto clara. Va parejo arriba y
        // abajo, no cargado al pie como en `groups`, porque acá el bloque de
        // texto está centrado; de paso el tramo superior le da contraste al
        // logo blanco de la navbar montada encima.
        if (theme === 'soft') return 'bg-gradient-to-b from-black/55 via-black/45 to-black/55';
        return 'bg-gradient-to-b from-black/70 via-black/40 to-slate-900';
    };

    const getImageClass = () => {
        if (theme === 'alabanza') return 'grayscale brightness-110 contrast-125';
        return '';
    };

    return (
        <div
            ref={rootRef}
            // Con encuadre configurado manda la proporción; el min-height evita
            // que un marco panorámico (ej 1920×480) colapse a una franja de
            // 90px en un teléfono. Ahí el recorte lo resuelve el punto focal.
            className={`relative w-full ${aspectRatio ? '' : heightClass} group overflow-hidden bg-black`}
            style={aspectRatio ? { aspectRatio, minHeight: '240px' } : undefined}
            onMouseEnter={handleUserInteraction}
            onMouseLeave={resumeNow}
            onTouchStart={handleUserInteraction}
        >
            {/* TRACK — pista con translateX.
                No usa scroll nativo porque prefers-reduced-motion convierte
                scroll-behavior:smooth en salto instantáneo; transform en
                cambio siempre se anima porque esa preferencia no lo toca. */}
            <div
                className="w-full h-full"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <div
                    className="flex w-full h-full"
                    style={{
                        transform: `translateX(-${index * 100}%)`,
                        transition: animate ? 'transform 600ms cubic-bezier(0.25, 0.1, 0.25, 1)' : 'none',
                        willChange: 'transform'
                    }}
                    onTransitionEnd={handleTransitionEnd}
                >
                    {track.map((slide, idx) => {
                        const isActive = idx === activeIndex;

                        return (
                            <div key={`${slide.id}-${idx}`} className="w-full h-full flex-shrink-0 relative">
                                {/* Media Layer — imagen o video según mediaType.
                                    El video va muted + playsInline porque sin eso
                                    ningún navegador lo reproduce solo, y en iOS se
                                    abriría a pantalla completa. Sólo el slide
                                    visible reproduce: mantener tres videos corriendo
                                    en segundo plano quema batería sin que nadie los
                                    vea. `imageUrl` queda de poster, así que si el
                                    video tarda o falla igual se ve algo. */}
                            {slide.mediaType === 'video' && slide.videoUrl ? (
                                <video
                                    ref={el => {
                                        if (el) videoRefs.current.set(idx, el);
                                        else videoRefs.current.delete(idx);
                                    }}
                                    src={slide.videoUrl}
                                    poster={slide.imageUrl || undefined}
                                    autoPlay
                                    muted
                                    loop
                                    playsInline
                                    preload="auto"
                                    // Es decorado de fondo, no una pieza para mirar: sin
                                    // controles, sin menú contextual, sin picture-in-picture
                                    // y sin foco de teclado. `pointer-events-none` deja pasar
                                    // el click a lo que haya encima.
                                    disablePictureInPicture
                                    controlsList="nodownload noplaybackrate nofullscreen"
                                    tabIndex={-1}
                                    aria-hidden="true"
                                    style={getMediaFrameStyle(slide)}
                                    className={`w-full h-full pointer-events-none select-none ${theme === 'prode' ? 'object-contain bg-white' : 'object-cover'} ${getImageClass()}`}
                                />
                            ) : slide.imageUrl ? (
                                <img
                                    src={slide.imageUrl}
                                    alt={slide.title || slide.titlePrefix || ''}
                                    style={getMediaFrameStyle(slide)}
                                    className={`w-full h-full ${theme === 'prode' ? 'object-contain bg-white' : 'object-cover'} ${getImageClass()}`}
                                />
                            ) : null /* sin imagen ni video: queda el fondo negro del contenedor, nunca un ícono de imagen rota */}

                            {/* Overlay */}
                            <div className={`absolute inset-0 ${slide.overlayColor || getOverlayClass()}`}></div>

                            {/* Content */}
                            {/* El tema soft queda fuera del centrador compartido de
                                los demás temas porque resuelve su propio layout a
                                pantalla completa: centra el bloque contra la altura
                                real del banner y fija su propio max-width y padding
                                lateral, alineados con el resto de la página. */}
                            <div className={`absolute inset-0 ${theme === 'soft' ? '' : 'flex items-center justify-center p-6 text-center'}`}>
                                <div className={`relative z-10 ${theme === 'soft' ? 'w-full h-full' : 'max-w-5xl'}`}>
                                    {theme === 'store' ? (
                                        <div className="bg-white/90 p-8 md:p-12 backdrop-blur-sm border border-white/50 inline-block shadow-xl">
                                            <h2 className="text-4xl md:text-7xl font-black uppercase tracking-tighter leading-none mb-4 text-black">
                                                <span className={`inline-block ${animBase} ${isActive ? animActive : ''}`}>
                                                    {slide.titlePrefix}
                                                </span>{' '}
                                                <span className={`inline-block text-neutral-400 ${animBase} ${isActive ? `${animActive} animation-delay-200` : ''}`}>
                                                    {slide.titleHighlight}
                                                </span>
                                            </h2>
                                            {slide.buttonText && (
                                                <div className={`${animBase} ${isActive ? `${animActive} animation-delay-600` : ''}`}>
                                                    <button
                                                        onClick={slide.onButtonClick}
                                                        className="mt-4 px-8 py-3 bg-black text-white font-bold uppercase tracking-widest text-xs hover:bg-neutral-800 transition-all hover:scale-105"
                                                    >
                                                        {slide.buttonText}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ) : theme === 'alabanza' ? (
                                        <div className="bg-white/90 p-8 md:p-12 backdrop-blur-sm border border-white/50 inline-block">
                                            <h1 className="text-5xl md:text-8xl font-black text-black mb-4 tracking-tighter leading-[0.8] uppercase">
                                                <span className={`inline-block ${animBase} ${isActive ? animActive : ''}`}>
                                                    {slide.titlePrefix}
                                                </span><br />
                                                <span className={`inline-block text-neutral-400 ${animBase} ${isActive ? `${animActive} animation-delay-200` : ''}`}>
                                                    {slide.titleHighlight}
                                                </span>
                                            </h1>
                                            <p className={`text-lg md:text-xl text-neutral-600 font-medium max-w-xl mx-auto leading-relaxed tracking-wide uppercase ${animBase} ${isActive ? `${animActive} animation-delay-400` : ''}`}>
                                                {slide.description}
                                            </p>
                                            {slide.buttonText && (
                                                <div className={`mt-8 ${animBase} ${isActive ? `${animActive} animation-delay-600` : ''}`}>
                                                    <button
                                                        onClick={slide.onButtonClick}
                                                        className="px-8 py-3 border-2 border-black text-black font-bold uppercase tracking-widest text-xs hover:bg-black hover:text-white transition-all hover:scale-105"
                                                    >
                                                        {slide.buttonText}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ) : theme === 'infopoint' ? (
                                        // InfoPoint Layout - High contrast box with neobrutalist styling
                                        <div className="bg-white/95 p-6 md:p-10 backdrop-blur-md border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] inline-block">
                                            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-black mb-3 tracking-tighter leading-[0.9] uppercase">
                                                <span className={`inline-block ${animBase} ${isActive ? animActive : ''}`}>
                                                    {slide.titlePrefix}
                                                </span>
                                                {slide.titleHighlight && (
                                                    <>
                                                        <br />
                                                        <span className={`inline-block text-neutral-500 ${animBase} ${isActive ? `${animActive} animation-delay-200` : ''}`}>
                                                            {slide.titleHighlight}
                                                        </span>
                                                    </>
                                                )}
                                            </h1>
                                            {slide.description && (
                                                <p className={`text-base md:text-lg text-neutral-600 font-medium max-w-lg mx-auto leading-relaxed tracking-wide uppercase ${animBase} ${isActive ? `${animActive} animation-delay-400` : ''}`}>
                                                    {slide.description}
                                                </p>
                                            )}
                                            {slide.buttonText && (
                                                <div className={`mt-6 ${animBase} ${isActive ? `${animActive} animation-delay-600` : ''}`}>
                                                    <button
                                                        onClick={slide.onButtonClick}
                                                        className="px-8 py-3 bg-black text-white font-black uppercase tracking-widest text-xs hover:bg-neutral-800 transition-all hover:scale-105 border-2 border-black"
                                                    >
                                                        {slide.buttonText}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ) : theme === 'groups' ? (
                                        // Groups Layout - Left-aligned content at bottom
                                        <div className="w-full h-full flex items-end">
                                            <div className="w-full max-w-[1920px] mx-auto px-6 md:px-12 lg:px-16 py-10 md:py-14">
                                                <div className="max-w-2xl">
                                                    {/* Main Headline */}
                                                    <h1 className={`text-3xl md:text-5xl lg:text-6xl font-bold uppercase tracking-tight leading-[1.05] text-white drop-shadow-lg ${animBase} ${isActive ? animActive : ''}`}>
                                                        {slide.title || slide.titlePrefix || "GRUPOS DE CONEXIÓN"}
                                                    </h1>

                                                    {/* Sub-headline */}
                                                    <p className={`mt-3 md:mt-4 text-base md:text-lg font-medium text-white/90 max-w-lg ${animBase} ${isActive ? `${animActive} animation-delay-200` : ''}`}>
                                                        {slide.subtitle || slide.description || "Un lugar para conocer a otros y que otros te conozcan."}
                                                    </p>

                                                    {slide.buttonText && (
                                                        <div className={`mt-6 ${animBase} ${isActive ? `${animActive} animation-delay-400` : ''}`}>
                                                            <button
                                                                onClick={slide.onButtonClick}
                                                                className="px-8 py-3 bg-white text-black font-bold uppercase tracking-widest text-xs hover:bg-neutral-200 transition-all hover:scale-105 border-2 border-white"
                                                            >
                                                                {slide.buttonText}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : theme === 'prode' ? (
                                        // Prode Layout - Centered text, no dark overlay, strong shadows
                                        <div className="w-full h-full flex items-center justify-center">
                                            <div className="max-w-4xl px-6 md:px-12 py-10 md:py-14 text-center">
                                                {/* Main Headline */}
                                                <h1 className={`text-4xl md:text-5xl lg:text-7xl font-black uppercase tracking-tight leading-[1.05] text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] ${animBase} ${isActive ? animActive : ''}`}>
                                                    {slide.title || slide.titlePrefix || "PRODE MUNDIAL"}
                                                </h1>

                                                {/* Sub-headline */}
                                                <p className={`mt-4 md:mt-6 text-lg md:text-xl font-bold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] max-w-2xl mx-auto ${animBase} ${isActive ? `${animActive} animation-delay-200` : ''}`}>
                                                    {slide.subtitle || slide.description}
                                                </p>
                                                
                                                {slide.buttonText && (
                                                    <div className={`mt-8 ${animBase} ${isActive ? `${animActive} animation-delay-400` : ''}`}>
                                                        <button
                                                            onClick={slide.onButtonClick}
                                                            className="px-8 py-3 bg-white text-black font-black uppercase tracking-widest text-sm hover:bg-neutral-200 transition-all hover:scale-105 rounded-full shadow-xl"
                                                        >
                                                            {slide.buttonText}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : theme === 'soft' ? (
                                        // Soft Layout — mismo tratamiento tipográfico que el
                                        // tema `groups` (blanco liso, Bold, uppercase, tracking
                                        // ajustado y drop-shadow), pero con el bloque centrado
                                        // en el banner en vez de anclado abajo a la izquierda.
                                        // La legibilidad ya no la da el contorno del texto sino
                                        // el velo degradado — ver getOverlayClass().
                                        <div className="w-full h-full flex items-center justify-center">
                                            <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
                                                {/* Dos escalones de tamaño, de mayor a menor:
                                                    principal → destacado. Van en un solo h1 para
                                                    que el titular sea un encabezado y no dos. */}
                                                <div className="max-w-3xl mx-auto text-center">

                                                    <h1 className={`uppercase tracking-tight text-white drop-shadow-lg ${animBase} ${isActive ? animActive : ''}`}>
                                                        {/* 1 · TEXTO PRINCIPAL */}
                                                        <span className="block text-3xl md:text-5xl lg:text-6xl font-bold leading-[1.05]">
                                                            {slide.title || slide.titlePrefix}
                                                        </span>
                                                        {/* 2 · TEXTO DESTACADO — un escalón abajo en
                                                            tamaño y apenas más apagado en color, así
                                                            se lee como bajada del principal y no
                                                            como un segundo titular del mismo rango. */}
                                                        {slide.titleHighlight && (
                                                            <span className="block mt-1 text-xl md:text-3xl lg:text-4xl font-bold leading-[1.05] text-white/90">
                                                                {slide.titleHighlight}
                                                            </span>
                                                        )}
                                                    </h1>

                                                    {(slide.subtitle || slide.description) && (
                                                        <p className={`mt-3 md:mt-4 text-base md:text-lg font-medium text-white/90 max-w-lg mx-auto ${animBase} ${isActive ? `${animActive} animation-delay-200` : ''}`}>
                                                            {slide.subtitle || slide.description}
                                                        </p>
                                                    )}

                                                    {slide.buttonText && (
                                                        <div className={`mt-6 flex justify-center ${animBase} ${isActive ? `${animActive} animation-delay-400` : ''}`}>
                                                            <button
                                                                onClick={slide.onButtonClick}
                                                                className="px-8 py-3 rounded-xl bg-white text-black font-bold uppercase tracking-widest text-xs hover:bg-neutral-200 transition-all hover:scale-105 border-2 border-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/50"
                                                            >
                                                                {slide.buttonText}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        // Default / Dashboard Layout
                                        <>
                                            <div className={`${animBase} ${isActive ? animActive : ''}`}>
                                                <span className="inline-block py-1 px-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs sm:text-xs font-bold tracking-[0.2em] uppercase mb-2 sm:mb-6">
                                                    {slide.eyebrow || '¡Qué bueno que estés en casa!'}
                                                </span>
                                            </div>
                                            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-white tracking-tighter mb-2 sm:mb-6 drop-shadow-2xl leading-tight">
                                                <span className={`inline-block ${animBase} ${isActive ? animActive : ''}`}>
                                                    {slide.titlePrefix}
                                                </span>{' '}
                                                <br className={`sm:hidden ${!slide.titleHighlight ? 'hidden' : ''}`} />
                                                <span className={`inline-block text-white drop-shadow-md ${animBase} ${isActive ? `${animActive} animation-delay-200` : ''}`}>
                                                    {slide.titleHighlight}
                                                </span>
                                            </h1>
                                            {slide.description && (
                                                <p className={`text-lg sm:text-lg md:text-xl text-white/90 font-medium max-w-lg md:max-w-2xl mx-auto leading-relaxed tracking-wide ${animBase} ${isActive ? `${animActive} animation-delay-400` : ''}`}>
                                                    {slide.description}
                                                </p>
                                            )}

                                            {slide.buttonText && (
                                                <div className={`flex justify-center ${animBase} ${isActive ? `${animActive} animation-delay-600` : ''}`}>
                                                    <button
                                                        onClick={slide.onButtonClick}
                                                        className="px-6 py-3 md:px-8 md:py-4 bg-white text-slate-900 rounded-full font-bold text-xs md:text-sm uppercase tracking-wider hover:bg-slate-200 hover:scale-105 transition-all shadow-lg shadow-white/10"
                                                    >
                                                        {slide.buttonText}
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                </div>
            </div>

            {/* CONTROLS */}
            {slides.length > 1 && (
                <>
                    {/* Arrows */}
                    <button
                        onClick={handlePrev}
                        className="absolute top-1/2 left-4 -translate-y-1/2 p-3 bg-black/30 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 z-20 border border-white/20 hidden md:block"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                        onClick={handleNext}
                        className="absolute top-1/2 right-4 -translate-y-1/2 p-3 bg-black/30 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 z-20 border border-white/20 hidden md:block"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>

                    {/* Pagination Dots */}
                    <div className="absolute z-20 flex bottom-8 left-1/2 -translate-x-1/2 gap-3">
                        {slides.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => goToIndex(idx)}
                                className={`h-1.5 rounded-full transition-all duration-300 ${idx === activeIndex
                                    ? `w-8 ${theme === 'alabanza' || theme === 'store' || theme === 'infopoint' ? 'bg-black' : 'bg-white'}`
                                    : `w-2 ${theme === 'alabanza' || theme === 'store' || theme === 'infopoint' ? 'bg-black/40 hover:bg-black/60' : 'bg-white/40 hover:bg-white/60'}`
                                    }`}
                                aria-label={`Go to slide ${idx + 1}`}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default HeroCarousel;
