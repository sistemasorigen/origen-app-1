
import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface HeroSlideData {
    id: string;
    imageUrl: string;
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
    theme?: 'default' | 'alabanza' | 'store' | 'infopoint' | 'groups' | 'prode';
}

const HeroCarousel: React.FC<HeroCarouselProps> = ({
    slides,
    autoPlayInterval = 6000,
    heightClass = 'h-screen',
    theme = 'default'
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        if (!autoPlayInterval || isPaused || slides.length <= 1) return;
        const interval = setInterval(() => {
            if (scrollRef.current) {
                const nextIndex = (activeIndex + 1) % slides.length;
                scrollToIndex(nextIndex);
            }
        }, autoPlayInterval);
        return () => clearInterval(interval);
    }, [activeIndex, isPaused, slides.length, autoPlayInterval]);

    const handleScroll = () => {
        if (scrollRef.current) {
            const container = scrollRef.current;
            const newIndex = Math.round(container.scrollLeft / container.clientWidth);
            if (newIndex !== activeIndex) {
                setActiveIndex(newIndex);
            }
        }
    };

    const scrollToIndex = (index: number) => {
        if (scrollRef.current) {
            const container = scrollRef.current;
            container.scrollTo({
                left: container.clientWidth * index,
                behavior: 'smooth'
            });
        }
    };

    const handlePrev = () => {
        setIsPaused(true);
        const nextIndex = activeIndex === 0 ? slides.length - 1 : activeIndex - 1;
        scrollToIndex(nextIndex);
    };

    const handleNext = () => {
        setIsPaused(true);
        const nextIndex = (activeIndex + 1) % slides.length;
        scrollToIndex(nextIndex);
    };

    const handleUserInteraction = () => {
        setIsPaused(true);
    };

    if (!slides || slides.length === 0) return null;

    const animBase = "opacity-0";
    const animActive = "animate-fadeInUp";

    const getOverlayClass = () => {
        if (theme === 'alabanza') return 'bg-white/30 mix-blend-overlay';
        if (theme === 'infopoint') return 'bg-gradient-to-t from-black/60 via-black/20 to-transparent';
        if (theme === 'groups') return 'bg-gradient-to-t from-black/70 via-black/30 to-transparent';
        if (theme === 'prode') return 'bg-transparent';
        return 'bg-gradient-to-b from-black/70 via-black/40 to-slate-900';
    };

    const getImageClass = () => {
        if (theme === 'alabanza') return 'grayscale brightness-110 contrast-125';
        return '';
    };

    return (
        <div
            className={`relative w-full ${heightClass} group overflow-hidden bg-black`}
            onMouseEnter={handleUserInteraction}
            onTouchStart={handleUserInteraction}
        >
            {/* SCROLL CONTAINER */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide scroll-smooth"
                style={{ scrollBehavior: 'smooth', touchAction: 'pan-x' }}
            >
                {slides.map((slide, idx) => {
                    const isActive = idx === activeIndex;

                    return (
                        <div key={slide.id} className="w-full h-full flex-shrink-0 snap-center relative">
                            {/* Image Layer */}
                            <img
                                src={slide.imageUrl}
                                alt={slide.titlePrefix}
                                className={`w-full h-full ${theme === 'prode' ? 'object-contain bg-white' : 'object-cover'} transition-transform duration-700 ${getImageClass()}`}
                            />

                            {/* Overlay */}
                            <div className={`absolute inset-0 ${slide.overlayColor || getOverlayClass()}`}></div>

                            {/* Content */}
                            <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                                <div className="max-w-5xl relative z-10">
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
                                    ) : (
                                        // Default / Dashboard Layout
                                        <>
                                            <div className={`${animBase} ${isActive ? animActive : ''}`}>
                                                <span className="inline-block py-1 px-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs sm:text-xs font-bold tracking-[0.2em] uppercase mb-2 sm:mb-6">
                                                    ¡Qué bueno que estés en casa!
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
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-20">
                        {slides.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => { setIsPaused(true); scrollToIndex(idx); }}
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
