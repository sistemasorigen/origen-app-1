
import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import {
    X, Copy, Check, QrCode, Share2,
    Instagram, Facebook, Youtube, Music,
    ArrowRight, Megaphone, Calendar, Clock
} from 'lucide-react';
import { AppEvent, AppConfig, Announcement } from '../../types';
import { db } from '../../services/dbService';
import InfoPointCalendar from './InfoPointCalendar';
import QRCodeModal from '../../components/QRCodeModal';

const LOGO_URL = '/origen-logo.png';

// Pastel post-it colors cycling by card index
const POSTIT_COLORS = [
    'bg-yellow-200',
    'bg-pink-200',
    'bg-sky-200',
    'bg-green-200',
    'bg-purple-200',
    'bg-orange-200',
];

// Slight rotations cycling per card
const POSTIT_ROTATIONS = [
    'rotate-1',
    '-rotate-2',
    'rotate-2',
    '-rotate-1',
    'rotate-[1.5deg]',
    '-rotate-[1.5deg]',
];

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

    const getQrUrl = (text: string) => {
        const data = text || 'https://origen.church';
        return `https://quickchart.io/qr?text=${encodeURIComponent(data)}&size=300&margin=1`;
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

                {/* --- SUBNAV --- */}
                <nav className="sticky top-16 z-50 bg-white border-b-4 border-black">
                    {/* MOBILE: Two buttons layout (Title is provided by parent InfoPoint.tsx) */}
                    <div className="flex flex-col md:hidden w-full">
                        {/* Buttons */}
                        <div className="flex w-full h-11">
                            <button
                                onClick={onGoPublic}
                                className={`flex-1 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest transition-all border-r-4 border-black ${(viewMode as string) === 'PUBLIC' ? 'bg-black text-white' : 'bg-white text-black'}`}
                            >
                                <span className={(viewMode as string) === 'PUBLIC' ? 'text-white' : 'text-blue-500'}>🌐</span> WEB
                            </button>
                            <button
                                onClick={onGoInternal}
                                className={`flex-1 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest transition-all ${(viewMode as string) === 'INTERNAL' ? 'bg-black text-white' : 'bg-white text-black'}`}
                            >
                                <span className={(viewMode as string) === 'INTERNAL' ? 'text-white' : 'text-slate-400'}>⚙️</span> PANEL
                            </button>
                        </div>
                    </div>

                    {/* DESKTOP: Centered title + buttons on right */}
                    <div className="hidden md:flex items-center w-full h-12 px-8 max-w-[1920px] mx-auto">
                        <div className="flex-1" />
                        <h1 className="flex-none text-base font-black tracking-widest uppercase text-black">
                            Punto de Información
                        </h1>
                        <div className="flex-1 flex justify-end">
                            <div className="inline-flex border-2 border-black overflow-hidden" role="group">
                                <button
                                    onClick={onGoPublic}
                                    className={`px-4 py-1.5 text-[11px] font-black uppercase tracking-widest transition-all border-r-2 border-black ${viewMode === 'PUBLIC' ? 'bg-black text-white' : 'bg-white text-black hover:bg-slate-100'}`}
                                >
                                    Público
                                </button>
                                <button
                                    onClick={onGoInternal}
                                    className={`px-4 py-1.5 text-[11px] font-black uppercase tracking-widest transition-all ${viewMode === 'INTERNAL' ? 'bg-black text-white' : 'bg-white text-black hover:bg-slate-100'}`}
                                >
                                    Panel
                                </button>
                            </div>
                        </div>
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

                        {/* Post-it Cards Grid */}
                        {activeAnnouncements.length === 0 ? (
                            <div className={`py-20 text-center border-4 border-black border-dashed bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${isLoaded ? 'animate-slideUp stagger-2' : 'opacity-0'}`}>
                                <Megaphone className="w-16 h-16 mx-auto mb-4 text-neutral-200" />
                                <p className="text-neutral-400 font-black uppercase tracking-widest text-sm">Sin anuncios activos por ahora</p>
                                <p className="text-neutral-300 font-bold text-xs mt-1 uppercase tracking-wide">Los anuncios pueden gestionarse desde el Panel Interno</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
                                {activeAnnouncements.map((ann, idx) => {
                                    const color = POSTIT_COLORS[idx % POSTIT_COLORS.length];
                                    const rotation = POSTIT_ROTATIONS[idx % POSTIT_ROTATIONS.length];
                                    return (
                                        <div
                                            key={ann.id}
                                            className={`relative z-0 border-4 border-black shadow-[6px_6px_0px_0px_#000] ${color} ${rotation} hover:rotate-0 hover:-translate-y-2 transition-all duration-300 cursor-default animate-pinDrop`}
                                            style={{ animationDelay: `${0.1 + idx * 0.08}s`, opacity: 0 }}
                                        >
                                            {/* Pin decorative element */}
                                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-red-500 border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] z-10" />

                                            <div className="p-6 pt-8">
                                                <h3 className="text-xl font-black uppercase tracking-tight mb-3 leading-tight">
                                                    {ann.title}
                                                </h3>
                                                {ann.description && (
                                                    <p className="text-sm font-semibold text-black/70 leading-relaxed mb-4 line-clamp-4">
                                                        {ann.description}
                                                    </p>
                                                )}
                                                {!ann.isPermanent && (
                                                    <div className="flex items-center gap-1 pt-3 border-t-2 border-black/20">
                                                        <Calendar className="w-3.5 h-3.5 text-black/50" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-black/50">
                                                            Hasta: {new Date(ann.endDate + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                                                        </span>
                                                    </div>
                                                )}
                                                {ann.qrCodeUrl && (
                                                    <div className={`mt-4 pt-3 ${!ann.isPermanent ? 'border-t-2 border-black/20' : ''}`}>
                                                        <button
                                                            onClick={() => setQrModal({ open: true, title: ann.title, url: ann.qrCodeUrl! })}
                                                            className="flex items-center justify-center gap-2 w-full py-2 bg-black text-white text-xs font-black uppercase tracking-widest border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                                                        >
                                                            <QrCode className="w-4 h-4" /> Mostrar QR
                                                        </button>
                                                    </div>
                                                )}
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
                                <span className="text-sm font-black text-neutral-400 uppercase tracking-[0.2em]">Próximos Eventos</span>
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
