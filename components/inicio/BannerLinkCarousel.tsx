import React, { useState, useEffect, useRef } from 'react';
import { getMediaFrameStyle } from '../ui/CarruselHero';

// Un slide de banner clickeable, en el mínimo común denominador de los dos
// banners de la home: el de "Origen Música" (tabla propia, imagen o video) y
// el de "Origen en Youvers" (config, solo imágenes). MusicaBannerSlide entra
// acá tal cual; los de Youvers se normalizan en el Dashboard.
export interface BannerLinkSlide {
    id: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    videoUrl?: string;
    focalX?: number;
    focalY?: number;
    zoom?: number;
    title?: string;
    targetUrl: string;
}

// Carrusel de banner clickeable — misma técnica de transición que
// CarruselHero.tsx (translateX + transition cubic-bezier), pero
// simplificado: acá no hay overlay de texto de CTA, cada slide entero ES
// el link (se abre en pestaña nueva al clickear). Se arrastra con el dedo
// o el mouse vía Pointer Events —mismo enfoque que EncuadreMedia.tsx—: la
// pista sigue al puntero en vivo y al soltar decide si cambia de slide o
// vuelve a su lugar.
const BannerLinkCarousel: React.FC<{ slides: BannerLinkSlide[] }> = ({ slides }) => {
    const [index, setIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffsetPx, setDragOffsetPx] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const dragStartXRef = useRef<number | null>(null);
    // Distingue un drag de un click: si el puntero se movió más que el
    // umbral, el click que el navegador dispara al soltar no debe abrir
    // el link del slide.
    const draggedRef = useRef(false);

    useEffect(() => {
        setIndex(0);
    }, [slides.length]);

    // El interval es único y persistente — no se destruye ni se recrea en
    // cada toggle de isPaused (hover, click, drag), a diferencia de la
    // versión anterior. isPausedRef se sincroniza en cada render y el
    // propio interval lo lee en cada tick, así que pausar/reanudar nunca
    // reinicia la cuenta de 5s.
    //
    // Esto además importa por un problema real: cada slide es un link con
    // target="_blank" — al clickear se abre una pestaña nueva y ÉSTA
    // pestaña (la del Home) pasa a segundo plano. Los navegadores frenan
    // agresivamente los timers de las pestañas ocultas, así que aunque el
    // estado esté bien, el reloj real puede quedar en pausa mientras no se
    // la mira. Por eso, al volver a estar visible, si ya pasó de sobra un
    // ciclo completo, se avanza una vez de una en vez de esperar a que el
    // browser decida retomar el interval por su cuenta.
    const isPausedRef = useRef(isPaused);
    isPausedRef.current = isPaused;
    const lastTickRef = useRef(Date.now());

    useEffect(() => {
        if (slides.length <= 1) return;
        const AUTOPLAY_MS = 5000;
        const id = setInterval(() => {
            if (isPausedRef.current) return;
            lastTickRef.current = Date.now();
            setIndex(i => (i + 1) % slides.length);
        }, AUTOPLAY_MS);

        const handleVisibility = () => {
            if (document.visibilityState !== 'visible' || isPausedRef.current) return;
            if (Date.now() - lastTickRef.current >= AUTOPLAY_MS) {
                lastTickRef.current = Date.now();
                setIndex(i => (i + 1) % slides.length);
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            clearInterval(id);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [slides.length]);

    if (slides.length === 0) return null;

    const safeIndex = Math.min(index, slides.length - 1);

    // Cualquier cambio manual de slide (drag o dots) cuenta como "tick"
    // para el reloj de arriba — si no, la reanudación al volver de una
    // pestaña oculta podría dispararse enseguida después de un cambio
    // manual reciente.
    const goToIndex = (target: number) => {
        lastTickRef.current = Date.now();
        setIndex(target);
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (slides.length <= 1) return;
        dragStartXRef.current = e.clientX;
        draggedRef.current = false;
        setIsDragging(true);
        setIsPaused(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (dragStartXRef.current === null) return;
        let delta = e.clientX - dragStartXRef.current;
        // Resistencia en los bordes: no hay nada detrás del primer o
        // último slide, así que arrastrar "hacia afuera" frena en vez de
        // cortar en seco.
        const atStart = safeIndex === 0 && delta > 0;
        const atEnd = safeIndex === slides.length - 1 && delta < 0;
        if (atStart || atEnd) delta = delta / 3;
        if (Math.abs(delta) > 8) draggedRef.current = true;
        setDragOffsetPx(delta);
    };

    const endDrag = () => {
        if (dragStartXRef.current === null) return;
        const width = containerRef.current?.clientWidth || 1;
        const threshold = Math.max(40, width * 0.18);
        const delta = dragOffsetPx;
        dragStartXRef.current = null;
        setIsDragging(false);
        setIsPaused(false);
        setDragOffsetPx(0);

        if (Math.abs(delta) > threshold) {
            if (delta < 0) goToIndex(Math.min(slides.length - 1, safeIndex + 1));
            else goToIndex(Math.max(0, safeIndex - 1));
        }
    };

    const handleSlideClick = (e: React.MouseEvent) => {
        if (draggedRef.current) e.preventDefault();
    };

    return (
        <div
            ref={containerRef}
            className={`relative w-full overflow-hidden rounded-2xl h-[200px] sm:h-[260px] md:h-[320px] lg:h-[380px] bg-black ${slides.length > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
            style={{ touchAction: 'pan-y' }}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
        >
            <div
                className="flex w-full h-full select-none"
                style={{
                    transform: `translateX(calc(-${safeIndex * 100}% + ${dragOffsetPx}px))`,
                    transition: isDragging ? 'none' : 'transform 600ms cubic-bezier(0.25, 0.1, 0.25, 1)',
                    willChange: 'transform'
                }}
            >
                {slides.map(slide => (
                    <a
                        key={slide.id}
                        href={slide.targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleSlideClick}
                        onDragStart={(e) => e.preventDefault()}
                        className="relative w-full h-full shrink-0 block group"
                        style={{ minWidth: '100%' }}
                        aria-label={slide.title || 'Ver más'}
                    >
                        {/* El zoom del hover vive en el envoltorio, no en el medio:
                            el encuadre ya ocupa el `transform` del <img> con su propio
                            scale, y un style inline le gana siempre a la clase. Además
                            el recorte pasa a salir de getMediaFrameStyle, la misma
                            función que dibuja el preview del editor — antes acá se
                            aplicaba el punto focal pero se ignoraba el zoom, así que un
                            slide acercado en el admin se publicaba sin acercar. */}
                        <div className="absolute inset-0 overflow-hidden transition-transform duration-300 group-hover:scale-[1.02]">
                            {slide.mediaType === 'video' && slide.videoUrl ? (
                                <video
                                    src={slide.videoUrl}
                                    poster={slide.mediaUrl}
                                    className="w-full h-full object-cover pointer-events-none"
                                    style={getMediaFrameStyle(slide)}
                                    autoPlay muted loop playsInline
                                />
                            ) : slide.mediaUrl ? (
                                <img
                                    src={slide.mediaUrl}
                                    alt={slide.title || ''}
                                    draggable={false}
                                    className="w-full h-full object-cover pointer-events-none"
                                    style={getMediaFrameStyle(slide)}
                                />
                            ) : null /* sin imagen ni video: queda el fondo negro del contenedor */}
                        </div>
                        {slide.title && (
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 sm:p-5 pt-10 sm:pt-14">
                                <p className="text-white font-bold text-lg sm:text-xl md:text-2xl leading-snug tracking-tight drop-shadow-md">{slide.title}</p>
                            </div>
                        )}
                    </a>
                ))}
            </div>

            {slides.length > 1 && (
                <div className="absolute bottom-3 right-3 flex gap-1.5 z-10">
                    {slides.map((_, i) => (
                        <button
                            key={i}
                            onClick={(e) => { e.preventDefault(); goToIndex(i); }}
                            className={`w-1.5 h-1.5 rounded-full transition-all ${i === safeIndex ? 'bg-white w-4' : 'bg-white/50'}`}
                            aria-label={`Ir al slide ${i + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default BannerLinkCarousel;
