
import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import {
    X, Copy, Check, QrCode, Share2,
    Instagram, Facebook, Youtube, Music,
    ArrowRight, Megaphone, Calendar, Clock, MapPin, ExternalLink
} from 'lucide-react';
import { AppEvent, AppConfig, Announcement } from '../../types';
import { db } from '../../services/dbService';
import InfoPointCalendar from './CalendarioPuntoInformacion';
import QRCodeModal from '../../components/modals/ModalCodigoQR';

const LOGO_URL = '/origen-logo.png';

// Neo-brutalist accent colors for announcement cards
const ACCENT_COLORS = ['#FACC15', '#F87171', '#60A5FA', '#34D399', '#C084FC', '#FB923C'];

interface PublicHomeProps {
    viewMode: 'PUBLIC' | 'INTERNAL';
    onGoInternal: () => void;
    onGoPublic: () => void;
    canAccessPanel: boolean;
}

const PublicHome: React.FC<PublicHomeProps> = ({ viewMode, onGoInternal, onGoPublic, canAccessPanel }) => {
    const { events, announcements } = useStore();
    const [appConfig, setAppConfig] = useState<AppConfig>(db.getAppConfig());
    const [sharingEvent, setSharingEvent] = useState<AppEvent | null>(null);
    const [qrModal, setQrModal] = useState<{ open: boolean, title: string, url: string }>({ open: false, title: '', url: '' });
    const [isCopied, setIsCopied] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        setAppConfig(db.getAppConfig());
        setTimeout(() => setIsLoaded(true), 100);
    }, []);

    // Active announcements: manual override if present, else today is between startDate and endDate (inclusive)
    const today = new Date().toISOString().slice(0, 10);
    const activeAnnouncements: Announcement[] = announcements.filter(a => a.isActive !== false);

    // Upcoming events: sorted ascending by date, show all
    const upcomingEvents = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const getEventQrUrl = (event: AppEvent) => {
        const data = event.qrCodeUrl || event.link || `${event.name} - ${event.date}`;
        return getQrUrl(data);
    };

    // --- DATE HELPERS ---
    const parseLocalDate = (dateStr: string) => {
        if (!dateStr) return new Date();
        const parts = dateStr.split('-');
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    };

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
            try { await navigator.share(shareData); } catch { handleCopyLink(shareData.url); }
        } else {
            handleCopyLink(shareData.url);
        }
    };

    const getQrUrl = (textOrUrl: string) => {
        if (!textOrUrl) return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https%3A%2F%2Forigen.church`;
        
        if (textOrUrl.includes('quickchart.io')) {
            const match = textOrUrl.match(/[?&]text=([^&]+)/);
            if (match && match[1]) {
                return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${match[1]}`;
            }
        }
        
        if (textOrUrl.includes('api.qrserver.com')) {
            return textOrUrl;
        }

        return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(textOrUrl)}`;
    };

    const footerLinks = appConfig.footerLinks;
    const showCta = appConfig.infoPointConfig?.heroCtaText?.trim() && appConfig.infoPointConfig?.heroCtaLink?.trim();

    // CSS Animations
    const animationStyles = `
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        @keyframes pinDrop { from { opacity: 0; transform: translateY(-20px) scale(0.9); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-slideUp { animation: slideUp 0.6s ease-out forwards; }
        .animate-scaleIn { animation: scaleIn 0.5s ease-out forwards; }
        .animate-pinDrop { animation: pinDrop 0.5s ease-out forwards; }
        .stagger-1 { animation-delay: 0.1s; opacity: 0; }
        .stagger-2 { animation-delay: 0.2s; opacity: 0; }
        .stagger-3 { animation-delay: 0.3s; opacity: 0; }
        .stagger-4 { animation-delay: 0.4s; opacity: 0; }
        .stagger-5 { animation-delay: 0.5s; opacity: 0; }
        .border-animated::before {
            content: ''; position: absolute; inset: 0;
            border: 3px solid black;
            animation: borderDance 4s linear infinite;
        }
        @keyframes borderDance {
            0%, 100% { clip-path: inset(0 0 98% 0); }
            25% { clip-path: inset(0 98% 0 0); }
            50% { clip-path: inset(98% 0 0 0); }
            75% { clip-path: inset(0 0 0 98%); }
        }
    `;

    return (
        <>
            <style>{animationStyles}</style>

            <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white">

                <QRCodeModal
                    isOpen={qrModal.open}
                    onClose={() => setQrModal({ ...qrModal, open: false })}
                    title={qrModal.title}
                    qrUrl={qrModal.url}
                />

                {/* --- SHARE MODAL --- */}
                {sharingEvent && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-white/95 backdrop-blur-xl">
                        <div className="relative bg-white border-4 border-black w-full max-w-sm overflow-hidden animate-scaleIn shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                            <div className="absolute inset-0 border-animated pointer-events-none" />
                            <button
                                onClick={() => setSharingEvent(null)}
                                className="absolute top-4 right-4 p-2 border-2 border-black hover:bg-black hover:text-white transition-all z-10"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <div className="p-8 flex flex-col items-center text-center">
                                <img src={LOGO_URL} alt="Logo" className="h-16 w-auto object-contain mb-4 animate-float" />
                                <h3 className="text-2xl font-black uppercase tracking-tight mb-1">{sharingEvent.name}</h3>
                                <p className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-6">
                                    {parseLocalDate(sharingEvent.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </p>
                                <div className="bg-white border-4 border-black p-4 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                    <img src={getQrUrl(sharingEvent.link || `${sharingEvent.name} - ${sharingEvent.date}`)} alt="QR" className="w-44 h-44 object-contain" />
                                </div>
                                <div className="w-full space-y-3">
                                    <button
                                        onClick={() => handleCopyLink(sharingEvent.link || window.location.href)}
                                        className="w-full py-4 px-6 border-4 border-black font-black uppercase text-sm tracking-widest hover:bg-neutral-100 transition-all flex items-center justify-center gap-3"
                                    >
                                        {isCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                        {isCopied ? '¡Copiado!' : 'Copiar Link'}
                                    </button>
                                    {navigator.share && (
                                        <button
                                            onClick={() => handleWebShare(sharingEvent)}
                                            className="w-full py-4 px-6 bg-black text-white font-black uppercase text-sm tracking-widest hover:bg-neutral-800 transition-all flex items-center justify-center gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]"
                                        >
                                            <Share2 className="w-5 h-5" />
                                            Compartir
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- SUBNAV (desktop only — el toggle Público/Panel se quitó tanto acá como en mobile) --- */}
                <nav className="hidden md:block sticky top-16 z-50 bg-white border-b-4 border-black overflow-hidden select-none">
                    <div className="flex items-center justify-center w-full h-12 px-8 max-w-[1920px] mx-auto">
                        <h1 className="text-base font-black tracking-widest uppercase text-black">
                            Punto de Información
                        </h1>
                    </div>
                </nav>

                {/* --- BULLETIN BOARD SECTION --- */}
                <section className={`relative py-12 md:py-16 bg-neutral-50 border-b-4 border-black transition-all duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="max-w-7xl mx-auto px-4 md:px-8">
                        {/* Section Header */}
                        <div className={`mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 ${isLoaded ? 'animate-slideUp stagger-1' : 'opacity-0'}`}>
                            <div>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 border-4 border-black bg-yellow-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <Megaphone className="w-5 h-5 text-black" />
                                    </div>
                                    <span className="text-sm font-black text-neutral-400 uppercase tracking-[0.2em]">Tablero</span>
                                </div>
                                <h2 className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tight">
                                    Anuncios <span className="relative inline-block">
                                        Activos
                                        <span className="absolute -bottom-2 left-0 w-full h-2 bg-black" />
                                    </span>
                                </h2>
                            </div>
                        </div>

                        {/* Neo-Brutalist Cards Grid */}
                        {activeAnnouncements.length === 0 ? (
                            <div className={`py-20 text-center border-4 border-black border-dashed bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${isLoaded ? 'animate-slideUp stagger-2' : 'opacity-0'}`}>
                                <Megaphone className="w-16 h-16 mx-auto mb-4 text-neutral-200" />
                                <p className="text-neutral-400 font-black uppercase tracking-widest text-sm">Sin anuncios activos por ahora</p>
                                <p className="text-neutral-300 font-bold text-xs mt-1 uppercase tracking-wide">Los anuncios pueden gestionarse desde el Panel Interno</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                                {activeAnnouncements.map((ann, idx) => {
                                    const accent = ACCENT_COLORS[idx % ACCENT_COLORS.length];
                                    return (
                                        <div
                                            key={ann.id}
                                            className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 animate-slideUp flex flex-col"
                                            style={{ animationDelay: `${0.1 + idx * 0.07}s`, opacity: 0 }}
                                        >
                                            {/* Accent bar top */}
                                            <div className="h-2 w-full flex-shrink-0" style={{ backgroundColor: accent }} />

                                            <div className="p-6 flex flex-col flex-1">
                                                {/* Index badge + title */}
                                                <div className="flex items-start gap-3 mb-4">
                                                    <span
                                                        className="flex-shrink-0 w-8 h-8 flex items-center justify-center border-2 border-black text-xs font-black"
                                                        style={{ backgroundColor: accent }}
                                                    >
                                                        {String(idx + 1).padStart(2, '0')}
                                                    </span>
                                                    <h3 className="text-lg font-black uppercase tracking-tight leading-tight">
                                                        {ann.title}
                                                    </h3>
                                                </div>

                                                {ann.description && (
                                                    <p className="text-sm font-medium text-neutral-600 leading-relaxed mb-4 flex-1 border-l-4 border-black/10 pl-3">
                                                        {ann.description}
                                                    </p>
                                                )}

                                                {/* Footer */}
                                                <div className="mt-auto pt-4 border-t-2 border-black flex items-center justify-between gap-3 flex-wrap">
                                                    {ann.isPermanent ? (
                                                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2 py-1 border-2 border-black bg-black text-white">
                                                            ∞ Permanente
                                                        </span>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5">
                                                            <Calendar className="w-3.5 h-3.5 text-black" />
                                                            <span className="text-[10px] font-black uppercase tracking-widest">
                                                                Hasta {new Date(ann.endDate + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {ann.qrCodeUrl && (
                                                        <button
                                                            onClick={() => setQrModal({ open: true, title: ann.title, url: getQrUrl(ann.qrCodeUrl!) })}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-[10px] font-black uppercase tracking-widest border-2 border-black hover:bg-white hover:text-black transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none"
                                                        >
                                                            <QrCode className="w-3.5 h-3.5" /> QR
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>

                {/* --- EVENTS SECTION --- */}
                <section className={`py-12 md:py-16 bg-black text-white border-b-4 border-black transition-all duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="max-w-7xl mx-auto px-4 md:px-8">
                        {/* Section Header */}
                        <div className={`mb-8 ${isLoaded ? 'animate-slideUp stagger-3' : 'opacity-0'}`}>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 border-4 border-white bg-white text-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]">
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <span className="text-sm font-black text-white/50 uppercase tracking-[0.2em]">Agenda</span>
                            </div>
                            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tight">
                                Próximos <span className="relative inline-block">
                                    Eventos
                                    <span className="absolute -bottom-2 left-0 w-full h-2 bg-yellow-400" />
                                </span>
                            </h2>
                        </div>

                        {/* Events List or Empty State */}
                        {upcomingEvents.length === 0 ? (
                            <div className="py-20 text-center border-4 border-white/20 border-dashed">
                                <Calendar className="w-16 h-16 mx-auto mb-4 text-white/20" />
                                <p className="text-white/40 font-black uppercase tracking-widest text-sm">Sin eventos próximos</p>
                                <p className="text-white/20 font-bold text-xs mt-1 uppercase tracking-wide">Los eventos pueden gestionarse desde el Panel Interno</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {upcomingEvents.map((ev, idx) => {
                                    const dateObj = parseLocalDate(ev.date);
                                    const dayName = dateObj.toLocaleDateString('es-AR', { weekday: 'long' });
                                    const dayNum = dateObj.toLocaleDateString('es-AR', { day: '2-digit' });
                                    const monthName = dateObj.toLocaleDateString('es-AR', { month: 'long' });
                                    const accentColors = ['bg-yellow-400', 'bg-pink-400', 'bg-sky-400', 'bg-green-400', 'bg-purple-400', 'bg-orange-400'];
                                    const accent = accentColors[idx % accentColors.length];
                                    return (
                                        <div
                                            key={ev.id}
                                            className="border-4 border-white bg-white/5 hover:bg-white/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_0_0_rgba(255,255,255,0.2)] animate-slideUp"
                                            style={{ animationDelay: `${0.1 + idx * 0.07}s`, opacity: 0 }}
                                        >
                                            {/* Color accent bar */}
                                            <div className={`h-2 w-full ${accent}`} />

                                            <div className="p-5">
                                                {/* Date badge */}
                                                <div className="flex items-start justify-between gap-3 mb-4">
                                                    <div className="flex-none text-center border-4 border-white/30 px-3 py-2 min-w-[56px]">
                                                        <p className="text-xs font-black uppercase tracking-widest text-white/50">{dayName.slice(0, 3)}</p>
                                                        <p className="text-3xl font-black leading-none">{dayNum}</p>
                                                        <p className="text-xs font-black uppercase tracking-wider text-white/70 mt-0.5">{monthName.slice(0, 3)}</p>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-lg font-black uppercase tracking-tight leading-tight line-clamp-2">{ev.name}</h3>
                                                        {ev.type && (
                                                            <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-widest text-white/40 border border-white/20 px-2 py-0.5">
                                                                {ev.type}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {ev.description && (
                                                    <p className="text-sm text-white/60 font-semibold leading-relaxed mb-4 line-clamp-3">{ev.description}</p>
                                                )}

                                                {/* Meta row: time */}
                                                {(ev.startTime || ev.endTime) && (
                                                    <div className="flex items-center gap-1.5 mb-3">
                                                        <Clock className="w-3.5 h-3.5 text-white/40 flex-none" />
                                                        <span className="text-xs font-black text-white/60 uppercase tracking-widest">
                                                            {ev.startTime}{ev.endTime ? ` — ${ev.endTime}` : ''}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Actions */}
                                                <div className="flex gap-2 mt-4 pt-4 border-t-2 border-white/10">
                                                    {ev.link && (
                                                        <a
                                                            href={ev.link}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 border-2 border-white/30 text-xs font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all"
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" /> Ver más
                                                        </a>
                                                    )}
                                                    {(ev.qrCodeUrl || ev.link) && (
                                                        <button
                                                            onClick={() => setQrModal({ open: true, title: ev.name, url: getEventQrUrl(ev) })}
                                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white text-black border-2 border-white text-xs font-black uppercase tracking-widest hover:bg-yellow-400 hover:border-yellow-400 transition-all"
                                                        >
                                                            <QrCode className="w-3.5 h-3.5" /> QR
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => setSharingEvent(ev)}
                                                        className="flex items-center justify-center gap-1.5 py-2 px-3 border-2 border-white/30 text-xs font-black uppercase hover:bg-white hover:text-black transition-all"
                                                    >
                                                        <Share2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>

                {/* --- CALENDAR SECTION --- */}
                <section id="agenda-section" className={`py-12 md:py-16 bg-white border-b-4 border-black transition-all duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="max-w-7xl mx-auto px-4 md:px-8">
                        {/* Section Header */}
                        <div className={`mb-8 ${isLoaded ? 'animate-slideUp stagger-3' : 'opacity-0'}`}>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 border-4 border-black bg-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <span className="text-sm font-black text-neutral-400 uppercase tracking-[0.2em]">Calendario</span>
                            </div>
                            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tight">
                                Nuestra <span className="relative inline-block">
                                    Agenda
                                    <span className="absolute -bottom-2 left-0 w-full h-2 bg-black" />
                                </span>
                            </h2>
                        </div>

                        {/* CTA to go internal */}
                        {showCta && (
                            <div className="mb-6">
                                <a
                                    href={appConfig.infoPointConfig?.heroCtaLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-5 py-3 bg-white font-black text-sm uppercase tracking-widest border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all"
                                >
                                    {appConfig.infoPointConfig?.heroCtaText}
                                    <ArrowRight className="w-4 h-4" />
                                </a>
                            </div>
                        )}

                        {/* Embedded Calendar */}
                        <InfoPointCalendar />
                    </div>
                </section>

                {/* --- FOOTER --- */}
                <footer className={`bg-white border-t-4 border-black ${isLoaded ? 'animate-slideUp stagger-4' : 'opacity-0'}`}>
                    <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                            {/* Branding */}
                            <div className="flex items-center gap-4">
                                <img src={LOGO_URL} alt="Logo" className="h-14 w-auto object-contain hover:rotate-12 transition-transform duration-300" />
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight">Punto de Info</h3>
                                    <p className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Sistema Origen</p>
                                </div>
                            </div>

                            {/* Social Icons */}
                            <div className="flex items-center gap-3">
                                {footerLinks?.instagram && (
                                    <button
                                        onClick={() => window.open(footerLinks.instagram, '_blank')}
                                        className="w-14 h-14 border-4 border-black flex items-center justify-center hover:bg-black hover:text-white transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:-translate-y-1 hover:rotate-3"
                                        title="Instagram"
                                    >
                                        <Instagram className="w-6 h-6" />
                                    </button>
                                )}
                                {footerLinks?.facebook && (
                                    <button
                                        onClick={() => window.open(footerLinks.facebook, '_blank')}
                                        className="w-14 h-14 border-4 border-black flex items-center justify-center hover:bg-black hover:text-white transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:-translate-y-1 hover:-rotate-3"
                                        title="Facebook"
                                    >
                                        <Facebook className="w-6 h-6" />
                                    </button>
                                )}
                                {footerLinks?.youtube && (
                                    <button
                                        onClick={() => window.open(footerLinks.youtube, '_blank')}
                                        className="w-14 h-14 border-4 border-black flex items-center justify-center hover:bg-black hover:text-white transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:-translate-y-1 hover:rotate-3"
                                        title="YouTube"
                                    >
                                        <Youtube className="w-6 h-6" />
                                    </button>
                                )}
                                {footerLinks?.spotify && (
                                    <button
                                        onClick={() => window.open(footerLinks.spotify, '_blank')}
                                        className="w-14 h-14 border-4 border-black flex items-center justify-center hover:bg-black hover:text-white transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:-translate-y-1 hover:-rotate-3"
                                        title="Spotify"
                                    >
                                        <Music className="w-6 h-6" />
                                    </button>
                                )}
                            </div>

                            {/* Copyright */}
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
