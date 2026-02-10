
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import {
    LogIn, ArrowRight, ChevronRight, ChevronLeft, Clock,
    Share2, X, Copy, Check, QrCode, Instagram, Facebook, Youtube, Music,
    ExternalLink, Calendar, ArrowUpRight
} from 'lucide-react';
import { AppEvent, AppConfig } from '../../types';
import HeroCarousel, { HeroSlideData } from '../../components/HeroCarousel';
import { db } from '../../services/dbService';

// Logo URL
const LOGO_URL = '/origen-logo.png';

interface PublicHomeProps {
    onEnterPanel: () => void;
    canAccessPanel: boolean;
}

const PublicHome: React.FC<PublicHomeProps> = ({ onEnterPanel, canAccessPanel }) => {
    const { events } = useStore();
    const [appConfig, setAppConfig] = useState<AppConfig>(db.getAppConfig());
    const agendaRef = useRef<HTMLDivElement>(null);

    // --- SHARE MODAL STATE ---
    const [sharingEvent, setSharingEvent] = useState<AppEvent | null>(null);
    const [isCopied, setIsCopied] = useState(false);

    // Animated entrance state
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        setAppConfig(db.getAppConfig());
        // Trigger entrance animation
        setTimeout(() => setIsLoaded(true), 100);
    }, []);

    // Filter and Sort Events for the Agenda List
    const upcomingEvents = events
        .filter(e => new Date(e.date) >= new Date(new Date().setHours(0, 0, 0, 0)))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Helper for date formatting
    const parseLocalDate = (dateStr: string) => {
        if (!dateStr) return new Date();
        const parts = dateStr.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return new Date(year, month, day);
    };

    const getDayNumber = (dateStr: string) => parseLocalDate(dateStr).getDate();
    const getMonthName = (dateStr: string) => parseLocalDate(dateStr).toLocaleDateString('es-ES', { month: 'short' }).toUpperCase();
    const getDayName = (dateStr: string) => parseLocalDate(dateStr).toLocaleDateString('es-ES', { weekday: 'long' });

    // --- SHARE ACTIONS ---
    const handleCopyLink = (text: string) => {
        navigator.clipboard.writeText(text);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleWebShare = async (event: AppEvent) => {
        const dateObj = parseLocalDate(event.date);
        const shareData = {
            title: event.name,
            text: `Te invito a: ${event.name} el ${dateObj.toLocaleDateString()}`,
            url: event.link || window.location.href
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.log('Error al compartir', err);
            }
        } else {
            handleCopyLink(shareData.url);
        }
    };

    const getQrUrl = (text: string) => {
        // Use quickchart.io QR API (actively maintained and reliable)
        const data = text || 'https://origen.church';
        const encoded = encodeURIComponent(data);
        return `https://quickchart.io/qr?text=${encoded}&size=300&margin=1`;
    };

    // Horizontal scroll for agenda
    const scrollAgenda = (direction: 'left' | 'right') => {
        if (agendaRef.current) {
            const scrollAmount = 380;
            agendaRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    // Transform Banners for HeroCarousel from Config
    const banners = appConfig.infoPointConfig?.banners || [];
    const heroSlides: HeroSlideData[] = banners.map(b => ({
        id: b.id,
        imageUrl: b.imageUrl,
        titlePrefix: b.titlePrefix,
        titleHighlight: b.titleHighlight,
        description: b.description,
        overlayColor: b.overlayColor || 'bg-gradient-to-t from-white via-white/50 to-transparent'
    }));

    // CTA Button config
    const heroCtaText = appConfig.infoPointConfig?.heroCtaText;
    const heroCtaLink = appConfig.infoPointConfig?.heroCtaLink;
    const showCta = heroCtaText && heroCtaText.trim() && heroCtaLink && heroCtaLink.trim();

    const footerLinks = appConfig.footerLinks;

    // CSS Keyframes injected via style tag
    const animationStyles = `
        @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
        }
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInLeft {
            from { opacity: 0; transform: translateX(-30px); }
            to { opacity: 1; transform: translateX(0); }
        }
        @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.9); }
            to { opacity: 1; transform: scale(1); }
        }
        @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
        }
        @keyframes borderDance {
            0%, 100% { clip-path: inset(0 0 98% 0); }
            25% { clip-path: inset(0 98% 0 0); }
            50% { clip-path: inset(98% 0 0 0); }
            75% { clip-path: inset(0 0 0 98%); }
        }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-slideUp { animation: slideUp 0.6s ease-out forwards; }
        .animate-slideInLeft { animation: slideInLeft 0.6s ease-out forwards; }
        .animate-scaleIn { animation: scaleIn 0.5s ease-out forwards; }
        .animate-shimmer { 
            background: linear-gradient(90deg, transparent, rgba(0,0,0,0.05), transparent);
            background-size: 200% 100%;
            animation: shimmer 2s infinite;
        }
        .stagger-1 { animation-delay: 0.1s; opacity: 0; }
        .stagger-2 { animation-delay: 0.2s; opacity: 0; }
        .stagger-3 { animation-delay: 0.3s; opacity: 0; }
        .stagger-4 { animation-delay: 0.4s; opacity: 0; }
        .stagger-5 { animation-delay: 0.5s; opacity: 0; }
        .hover-lift { transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .hover-lift:hover { transform: translateY(-8px) scale(1.02); box-shadow: 0 20px 40px rgba(0,0,0,0.15); }
        .border-animated::before {
            content: '';
            position: absolute;
            inset: 0;
            border: 3px solid black;
            animation: borderDance 4s linear infinite;
        }
    `;

    return (
        <>
            <style>{animationStyles}</style>

            <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white relative overflow-hidden">

                {/* --- SHARE MODAL (PREMIUM WHITE) --- */}
                {sharingEvent && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-white/95 backdrop-blur-xl">
                        <div className="relative bg-white border-4 border-black w-full max-w-sm overflow-hidden animate-scaleIn shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                            {/* Animated border accent */}
                            <div className="absolute inset-0 border-animated pointer-events-none" />

                            <button
                                onClick={() => setSharingEvent(null)}
                                className="absolute top-4 right-4 p-2 border-2 border-black hover:bg-black hover:text-white transition-all duration-300 z-10"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="p-8 flex flex-col items-center text-center">
                                {/* Logo */}
                                <img
                                    src={LOGO_URL}
                                    alt="Logo"
                                    className="h-16 w-auto object-contain mb-4 animate-float"
                                />

                                <h3 className="text-2xl font-black uppercase tracking-tight mb-1">
                                    {sharingEvent.name}
                                </h3>
                                <p className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-6">
                                    {parseLocalDate(sharingEvent.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </p>

                                {/* QR Section */}
                                <div className="bg-white border-4 border-black p-4 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover-lift">
                                    <img
                                        src={getQrUrl(sharingEvent.link || `${sharingEvent.name} - ${sharingEvent.date}`)}
                                        alt="QR Code"
                                        className="w-44 h-44 object-contain"
                                    />
                                </div>

                                {/* Actions */}
                                <div className="w-full space-y-3">
                                    <button
                                        onClick={() => handleCopyLink(sharingEvent.link || window.location.href)}
                                        className="w-full py-4 px-6 border-3 border-black font-black uppercase text-sm tracking-widest hover:bg-neutral-100 transition-all duration-300 flex items-center justify-center gap-3 group"
                                        style={{ borderWidth: '3px' }}
                                    >
                                        {isCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5 group-hover:rotate-12 transition-transform" />}
                                        {isCopied ? '¡Copiado!' : 'Copiar Link'}
                                    </button>

                                    {navigator.share && (
                                        <button
                                            onClick={() => handleWebShare(sharingEvent)}
                                            className="w-full py-4 px-6 bg-black text-white font-black uppercase text-sm tracking-widest hover:bg-neutral-800 transition-all duration-300 flex items-center justify-center gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)] hover:-translate-y-0.5 group"
                                        >
                                            <Share2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                            Compartir
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- NAVBAR (CENTERED TITLE - GROUPS STYLE) --- */}
                <nav className={`sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 transition-all duration-700 h-16 md:h-20 ${isLoaded ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
                    <div className="w-full px-4 md:px-6 lg:px-12 h-full flex items-center justify-center relative max-w-[1920px] mx-auto">

                        {/* CENTER: Title - Always centered */}
                        <h1 className="text-base md:text-xl font-black tracking-tight uppercase text-black text-center">
                            Punto de Información
                        </h1>

                        {/* RIGHT SECTION: Panel Button - Absolute positioned */}
                        {canAccessPanel && (
                            <div className="absolute right-4 md:right-6 lg:right-12">
                                <button
                                    onClick={onEnterPanel}
                                    className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap border border-slate-200 text-slate-600 hover:border-black hover:text-black hover:bg-black hover:text-white group"
                                >
                                    <LogIn className="w-3.5 h-3.5" />
                                    <span>Panel</span>
                                </button>
                            </div>
                        )}
                    </div>
                </nav>

                {/* --- HERO BANNER (FULL WIDTH - EXPANDED 50%) --- */}
                <section className={`relative w-full transition-all duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="w-full">
                        <div className="relative overflow-hidden h-[38vh] min-h-[240px] max-h-[420px]">
                            {heroSlides.length > 0 ? (
                                <div className="relative w-full h-full">
                                    <HeroCarousel slides={heroSlides} theme="infopoint" heightClass="h-full" />

                                    {/* Gradient Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent pointer-events-none" />
                                </div>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-50 animate-shimmer">
                                    <img
                                        src={LOGO_URL}
                                        alt="Logo"
                                        className="h-24 w-auto object-contain mb-4 animate-float opacity-30"
                                    />
                                    <p className="text-neutral-400 font-bold uppercase tracking-widest text-sm">Sin banners</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* CTA Buttons Container - Always Below the Banner */}
                    <div className="w-full bg-white py-6 flex justify-center animate-slideUp stagger-3">
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                            {/* Primary CTA - Scroll to Agenda */}
                            <button
                                onClick={() => {
                                    const agendaSection = document.getElementById('agenda-section');
                                    agendaSection?.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="inline-flex items-center gap-3 px-8 py-4 bg-black text-white font-black text-sm uppercase tracking-widest hover:bg-white hover:text-black border-4 border-black transition-all duration-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 group"
                            >
                                <Calendar className="w-5 h-5" />
                                Nuestra Agenda
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>

                            {/* Secondary CTA - Configurable External Link */}
                            {showCta && (
                                <a
                                    href={heroCtaLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-3 px-6 py-3 bg-white text-black font-bold text-sm uppercase tracking-widest hover:bg-black hover:text-white border-3 border-black transition-all duration-300 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 group"
                                    style={{ borderWidth: '3px' }}
                                >
                                    {heroCtaText}
                                    <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                </a>
                            )}
                        </div>
                    </div>
                </section>

                {/* --- AGENDA (PREMIUM CARDS WITH BLACK FRAMES) --- */}
                <section id="agenda-section" className="relative py-16 md:py-20 bg-neutral-50 border-y-4 border-black">
                    {/* Section Header */}
                    <div className={`max-w-7xl mx-auto px-4 md:px-8 mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4 ${isLoaded ? 'animate-slideUp stagger-1' : 'opacity-0'}`}>
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 border-3 border-black bg-black text-white" style={{ borderWidth: '3px' }}>
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <span className="text-sm font-black text-neutral-400 uppercase tracking-[0.2em]">Próximos Eventos</span>
                            </div>
                            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tight">
                                Nuestra <span className="relative inline-block">
                                    Agenda
                                    <span className="absolute -bottom-2 left-0 w-full h-2 bg-black" />
                                </span>
                            </h2>
                        </div>

                        {/* Scroll Controls */}
                        {upcomingEvents.length > 2 && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => scrollAgenda('left')}
                                    className="p-4 border-3 border-black bg-white hover:bg-black hover:text-white transition-all duration-300 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                    style={{ borderWidth: '3px' }}
                                >
                                    <ChevronLeft className="w-6 h-6" />
                                </button>
                                <button
                                    onClick={() => scrollAgenda('right')}
                                    className="p-4 border-3 border-black bg-white hover:bg-black hover:text-white transition-all duration-300 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                    style={{ borderWidth: '3px' }}
                                >
                                    <ChevronRight className="w-6 h-6" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Events Scroll Container */}
                    {upcomingEvents.length === 0 ? (
                        <div className="max-w-7xl mx-auto px-4 md:px-8">
                            <div className="py-20 text-center border-4 border-black border-dashed bg-white">
                                <Calendar className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
                                <p className="text-neutral-400 font-bold uppercase tracking-widest">No hay eventos programados</p>
                            </div>
                        </div>
                    ) : (
                        <div
                            ref={agendaRef}
                            className="flex gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-hide px-4 md:px-8 pb-4"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            {/* Spacer for max-w-7xl alignment */}
                            <div className="hidden lg:block flex-shrink-0 w-[calc((100vw-1280px)/2-32px)]" />

                            {upcomingEvents.map((ev, index) => (
                                <div
                                    key={ev.id}
                                    className={`flex-shrink-0 w-[320px] md:w-[360px] snap-start ${isLoaded ? 'animate-slideUp' : 'opacity-0'}`}
                                    style={{ animationDelay: `${0.1 + index * 0.1}s`, opacity: 0 }}
                                >
                                    <div className="relative h-full bg-white border-4 border-black overflow-hidden hover-lift shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] group">
                                        {/* Date Header */}
                                        <div className="flex items-center justify-between px-5 py-4 bg-black text-white border-b-4 border-black">
                                            <div className="flex items-baseline gap-3">
                                                <span className="text-4xl font-black leading-none">
                                                    {getDayNumber(ev.date)}
                                                </span>
                                                <span className="text-sm font-bold uppercase tracking-wider opacity-80">
                                                    {getMonthName(ev.date)}
                                                </span>
                                            </div>
                                            <span className="text-xs font-bold uppercase opacity-60 capitalize">
                                                {getDayName(ev.date)}
                                            </span>
                                        </div>

                                        {/* Content */}
                                        <div className="p-5">
                                            {/* Time Badge */}
                                            {(ev.startTime || ev.endTime) && (
                                                <div className="inline-flex items-center gap-2 px-3 py-2 border-2 border-black mb-4 text-sm font-bold">
                                                    <Clock className="w-4 h-4" />
                                                    <span>{ev.startTime}{ev.endTime ? ` - ${ev.endTime}` : ''}</span>
                                                </div>
                                            )}

                                            {/* Event Title */}
                                            <h3 className="text-xl font-black uppercase tracking-tight mb-2 line-clamp-2 group-hover:underline decoration-4 underline-offset-4 transition-all">
                                                {ev.name}
                                            </h3>

                                            {/* Event Description */}
                                            {ev.description && (
                                                <p className="text-sm text-neutral-500 leading-relaxed mb-3 line-clamp-3">
                                                    {ev.description}
                                                </p>
                                            )}

                                            {/* Event Type */}
                                            {ev.type && (
                                                <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-4">
                                                    {ev.type}
                                                </p>
                                            )}

                                            {/* Share Button */}
                                            <button
                                                onClick={() => setSharingEvent(ev)}
                                                className="w-full mt-2 py-4 px-4 border-3 border-black font-black text-sm uppercase tracking-widest hover:bg-black hover:text-white transition-all duration-300 flex items-center justify-center gap-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-none group/btn"
                                                style={{ borderWidth: '3px' }}
                                            >
                                                <QrCode className="w-5 h-5 group-hover/btn:rotate-12 transition-transform" />
                                                <span>Compartir</span>
                                                <ArrowRight className="w-4 h-4 opacity-0 group-hover/btn:opacity-100 transition-all" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Spacer for max-w-7xl alignment */}
                            <div className="hidden lg:block flex-shrink-0 w-[calc((100vw-1280px)/2-32px)]" />
                        </div>
                    )}
                </section>

                {/* --- FOOTER (BOLD & STRUCTURED) --- */}
                <footer className={`bg-white border-t-4 border-black ${isLoaded ? 'animate-slideUp stagger-4' : 'opacity-0'}`}>
                    <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                            {/* Left: Branding */}
                            <div className="flex items-center gap-4">
                                <img
                                    src={LOGO_URL}
                                    alt="Logo"
                                    className="h-14 w-auto object-contain hover:rotate-12 transition-transform duration-300"
                                />
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight">Punto de Info</h3>
                                    <p className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Sistema Origen</p>
                                </div>
                            </div>

                            {/* Center: Social Icons */}
                            <div className="flex items-center gap-3">
                                {footerLinks?.instagram && (
                                    <button
                                        onClick={() => window.open(footerLinks.instagram, '_blank')}
                                        className="w-14 h-14 border-3 border-black flex items-center justify-center hover:bg-black hover:text-white transition-all duration-300 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:rotate-3 active:translate-y-0 active:shadow-none"
                                        style={{ borderWidth: '3px' }}
                                        title="Instagram"
                                    >
                                        <Instagram className="w-6 h-6" />
                                    </button>
                                )}
                                {footerLinks?.facebook && (
                                    <button
                                        onClick={() => window.open(footerLinks.facebook, '_blank')}
                                        className="w-14 h-14 border-3 border-black flex items-center justify-center hover:bg-black hover:text-white transition-all duration-300 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:-rotate-3 active:translate-y-0 active:shadow-none"
                                        style={{ borderWidth: '3px' }}
                                        title="Facebook"
                                    >
                                        <Facebook className="w-6 h-6" />
                                    </button>
                                )}
                                {footerLinks?.youtube && (
                                    <button
                                        onClick={() => window.open(footerLinks.youtube, '_blank')}
                                        className="w-14 h-14 border-3 border-black flex items-center justify-center hover:bg-black hover:text-white transition-all duration-300 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:rotate-3 active:translate-y-0 active:shadow-none"
                                        style={{ borderWidth: '3px' }}
                                        title="YouTube"
                                    >
                                        <Youtube className="w-6 h-6" />
                                    </button>
                                )}
                                {footerLinks?.spotify && (
                                    <button
                                        onClick={() => window.open(footerLinks.spotify, '_blank')}
                                        className="w-14 h-14 border-3 border-black flex items-center justify-center hover:bg-black hover:text-white transition-all duration-300 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:-rotate-3 active:translate-y-0 active:shadow-none"
                                        style={{ borderWidth: '3px' }}
                                        title="Spotify"
                                    >
                                        <Music className="w-6 h-6" />
                                    </button>
                                )}
                            </div>

                            {/* Right: Copyright */}
                            <div className="text-center md:text-right">
                                <p className="text-sm font-bold text-neutral-500 uppercase tracking-wider">
                                    © {new Date().getFullYear()} Sistema Origen
                                </p>
                                <p className="text-xs font-bold text-neutral-300 uppercase tracking-wider mt-1">
                                    Todos los derechos reservados
                                </p>
                            </div>
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
};

export default PublicHome;
