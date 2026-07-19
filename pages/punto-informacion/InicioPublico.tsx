
import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import {
    X, Copy, Check, QrCode, Share2,
    Instagram, Facebook, Youtube, Music,
    ArrowRight, Megaphone, Calendar, Clock, ExternalLink, Pin
} from 'lucide-react';
import { AppEvent, AppConfig, Announcement } from '../../types';
import { db } from '../../services/dbService';
import InfoPointCalendar from './CalendarioPuntoInformacion';
import ModalCompartirQR from '../../components/modals/ModalCompartirQR';

const LOGO_URL = '/origen-logo.png';

// lucide-react no trae íconos de marca, así que definimos los logos oficiales
// (con sus formas y colores reales) inline como componentes SVG.
const WhatsAppIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.359.101 11.892c0 2.096.546 4.142 1.588 5.945L0 24l6.335-1.652a11.96 11.96 0 005.71 1.454h.006c6.585 0 11.946-5.36 11.949-11.945a11.87 11.87 0 00-3.495-8.408" />
    </svg>
);

// Instagram — insignia con gradiente oficial + cámara blanca.
const InstagramIcon: React.FC<{ className?: string }> = ({ className }) => {
    const gid = React.useId();
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <defs>
                <radialGradient id={gid} cx="0.3" cy="1.05" r="1.1">
                    <stop offset="0" stopColor="#FED576" />
                    <stop offset="0.26" stopColor="#F47133" />
                    <stop offset="0.61" stopColor="#BC3081" />
                    <stop offset="1" stopColor="#4C63D2" />
                </radialGradient>
            </defs>
            <rect width="24" height="24" rx="6" fill={`url(#${gid})`} />
            <rect x="5" y="5" width="14" height="14" rx="4.2" fill="none" stroke="#fff" strokeWidth="1.7" />
            <circle cx="12" cy="12" r="3.3" fill="none" stroke="#fff" strokeWidth="1.7" />
            <circle cx="16.3" cy="7.7" r="1.15" fill="#fff" />
        </svg>
    );
};

// Facebook — insignia azul (#1877F2) con la "f" blanca.
const FacebookIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <rect width="24" height="24" rx="6" fill="#1877F2" />
        <path fill="#fff" d="M14.6 12.75h1.9l.3-2.35h-2.2V8.9c0-.68.2-1.14 1.17-1.14h1.25V5.66c-.22-.03-.97-.1-1.85-.1-1.83 0-3.08 1.12-3.08 3.17v1.62H9.9v2.4h2.19V19h2.51z" />
    </svg>
);

// YouTube — insignia roja (#FF0000) con el play blanco.
const YoutubeIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <rect y="4.5" width="24" height="15" rx="4.5" fill="#FF0000" />
        <path fill="#fff" d="M10 8.5l6 3.5-6 3.5z" />
    </svg>
);

// Spotify — círculo verde (#1ED760) con las ondas negras.
const SpotifyIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="12" fill="#1ED760" />
        <path fill="none" stroke="#000" strokeWidth="1.6" strokeLinecap="round" d="M6.8 9.4c3.2-.9 6.9-.7 9.8 1M7.2 12.6c2.7-.7 5.8-.5 8.1.9M7.6 15.5c2.2-.5 4.5-.4 6.4.7" />
    </svg>
);

// Un solo acento en todo el módulo: amarillo marcador, como
// un resaltador sobre el tablero de novedades. (Antes había un
// arcoíris de 6 colores que rotaba sin significado.)
const MARKER = '#FACC15';

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
    const [qrModal, setQrModal] = useState<{ open: boolean, title: string, url: string, link: string }>({ open: false, title: '', url: '', link: '' });
    const [isCopied, setIsCopied] = useState(false);
    // Acceso rápido a redes: al tocar una red se despliega su QR + acciones de compartir.
    const [socialShare, setSocialShare] = useState<{ label: string, url: string, Icon: React.ComponentType<{ className?: string }> } | null>(null);

    useEffect(() => {
        setAppConfig(db.getAppConfig());
    }, []);

    // Anuncios activos (override manual si existe)
    const activeAnnouncements: Announcement[] = announcements.filter(a => a.isActive !== false);

    // Próximos eventos: ascendente por fecha
    const upcomingEvents = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const nextEvent = upcomingEvents[0];

    // Fecha de hoy — la portada del tablero se fecha en vivo.
    const todayLabel = new Date().toLocaleDateString('es-AR', {
        weekday: 'long', day: 'numeric', month: 'long'
    });

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

    // WhatsApp: abre el compositor con el link de la red ya cargado.
    const handleWhatsAppShare = (url: string, label: string) => {
        const text = `Seguí a Origen en ${label}: ${url}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
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

    // Redes de la iglesia — solo las que estén cargadas en la config.
    const socialButtons = [
        { key: 'instagram', label: 'Instagram', url: footerLinks?.instagram, Icon: InstagramIcon },
        { key: 'facebook', label: 'Facebook', url: footerLinks?.facebook, Icon: FacebookIcon },
        { key: 'youtube', label: 'YouTube', url: footerLinks?.youtube, Icon: YoutubeIcon },
        { key: 'spotify', label: 'Spotify', url: footerLinks?.spotify, Icon: SpotifyIcon },
    ].filter(s => !!s.url) as { key: string, label: string, url: string, Icon: React.ComponentType<{ className?: string }> }[];

    // Una sola secuencia de entrada orquestada, con reduced-motion respetado.
    const animationStyles = `
        @keyframes pi-rise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
        @keyframes pi-pop  { from { opacity: 0; transform: scale(0.94); }     to { opacity: 1; transform: scale(1); } }
        .pi-reveal { opacity: 0; animation: pi-rise .6s cubic-bezier(0.22,1,0.36,1) forwards; }
        .pi-pop { animation: pi-pop .35s cubic-bezier(0.22,1,0.36,1) forwards; }
        @media (prefers-reduced-motion: reduce) {
            .pi-reveal, .pi-pop { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
    `;

    return (
        <>
            <style>{animationStyles}</style>

            <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white">

                <ModalCompartirQR
                    isOpen={qrModal.open}
                    onClose={() => setQrModal({ ...qrModal, open: false })}
                    title={qrModal.title}
                    qrUrl={qrModal.url}
                    link={qrModal.link}
                />

                {/* --- SHARE MODAL --- */}
                {sharingEvent && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-white/95 backdrop-blur-xl">
                        <div className="relative bg-white border-4 border-black w-full max-w-sm overflow-hidden pi-pop shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                            <button
                                onClick={() => setSharingEvent(null)}
                                className="absolute top-4 right-4 p-2 border-2 border-black hover:bg-black hover:text-white transition-all z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                                aria-label="Cerrar"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <div className="p-8 flex flex-col items-center text-center">
                                <img src={LOGO_URL} alt="Logo" className="h-16 w-auto object-contain mb-4" />
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
                                        className="w-full py-4 px-6 border-4 border-black font-black uppercase text-sm tracking-widest hover:bg-neutral-100 transition-all flex items-center justify-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                                    >
                                        {isCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                        {isCopied ? '¡Copiado!' : 'Copiar link'}
                                    </button>
                                    {navigator.share && (
                                        <button
                                            onClick={() => handleWebShare(sharingEvent)}
                                            className="w-full py-4 px-6 bg-black text-white font-black uppercase text-sm tracking-widest hover:bg-neutral-800 transition-all flex items-center justify-center gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
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

                {/* --- SOCIAL SHARE MODAL — QR + copiar + WhatsApp --- */}
                {socialShare && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-white/95 backdrop-blur-xl">
                        <div className="relative bg-white border-4 border-black w-full max-w-sm overflow-hidden pi-pop shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                            <button
                                onClick={() => setSocialShare(null)}
                                className="absolute top-4 right-4 p-2 border-2 border-black hover:bg-black hover:text-white transition-all z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                                aria-label="Cerrar"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <div className="p-8 flex flex-col items-center text-center">
                                <socialShare.Icon className="w-16 h-16 mb-4" />
                                <h3 className="text-2xl font-black uppercase tracking-tight mb-1">{socialShare.label}</h3>
                                <p className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-6">
                                    Escaneá o compartí
                                </p>
                                <div className="bg-white border-4 border-black p-4 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                    <img src={getQrUrl(socialShare.url)} alt={`QR ${socialShare.label}`} className="w-44 h-44 object-contain" />
                                </div>
                                <div className="w-full space-y-3">
                                    <button
                                        onClick={() => handleCopyLink(socialShare.url)}
                                        className="w-full py-4 px-6 border-4 border-black font-black uppercase text-sm tracking-widest hover:bg-neutral-100 transition-all flex items-center justify-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                                    >
                                        {isCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                        {isCopied ? '¡Copiado!' : 'Copiar link'}
                                    </button>
                                    <button
                                        onClick={() => handleWhatsAppShare(socialShare.url, socialShare.label)}
                                        className="w-full py-4 px-6 bg-[#25D366] text-white border-4 border-black font-black uppercase text-sm tracking-widest hover:bg-[#1eb958] transition-all flex items-center justify-center gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                                    >
                                        <WhatsAppIcon className="w-5 h-5" />
                                        Compartir vía WhatsApp
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ============================================================
                    SIGNATURE — MASTHEAD / PORTADA DE LA CARTELERA
                    El hero es la tesis: de un vistazo, qué pasa en Origen hoy.
                   ============================================================ */}
                <section className="bg-neutral-50 border-b-4 border-black">
                    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
                        <div className="pi-reveal border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">

                            {/* Top rule: identidad + fecha en vivo */}
                            <div className="flex items-stretch justify-between border-b-4 border-black">
                                <div className="flex items-center gap-3 px-4 md:px-6 py-3 min-w-0">
                                    <img src={LOGO_URL} alt="Origen" className="h-6 md:h-7 w-auto object-contain shrink-0" />
                                    <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.25em] text-neutral-400 truncate">
                                        Cartelera Origen
                                    </span>
                                </div>
                                <div className="flex items-center px-4 md:px-6 border-l-4 border-black" style={{ backgroundColor: MARKER }}>
                                    <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.15em] text-black whitespace-nowrap">
                                        {todayLabel}
                                    </span>
                                </div>
                            </div>

                            {/* Nameplate */}
                            <div className="px-4 md:px-8 py-8 md:py-12">
                                <h1 className="font-black uppercase leading-[0.82] tracking-tighter text-black text-[12vw] sm:text-[11vw] md:text-8xl lg:text-9xl">
                                    Punto de<br />Información
                                </h1>
                            </div>

                            {/* What's-on — resumen derivado de datos reales */}
                            <div className="flex flex-wrap border-t-4 border-black">
                                {/* Los dos contadores comparten fila siempre */}
                                <div className="flex shrink-0 divide-x-4 divide-black">
                                    <div className="flex items-baseline gap-2 px-4 md:px-6 py-4">
                                        <span className="text-3xl font-black tracking-tighter tabular-nums">{activeAnnouncements.length}</span>
                                        <span className="text-[11px] font-black uppercase tracking-widest text-neutral-500">
                                            {activeAnnouncements.length === 1 ? 'anuncio activo' : 'anuncios activos'}
                                        </span>
                                    </div>
                                    <div className="flex items-baseline gap-2 px-4 md:px-6 py-4">
                                        <span className="text-3xl font-black tracking-tighter tabular-nums">{upcomingEvents.length}</span>
                                        <span className="text-[11px] font-black uppercase tracking-widest text-neutral-500">
                                            {upcomingEvents.length === 1 ? 'evento próximo' : 'eventos próximos'}
                                        </span>
                                    </div>
                                </div>
                                {nextEvent && (
                                    <a
                                        href="#agenda-section"
                                        className="group flex items-center justify-between gap-3 basis-full sm:basis-0 sm:flex-1 px-4 md:px-6 py-4 border-t-4 sm:border-t-0 sm:border-l-4 border-black hover:bg-black hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-inset"
                                    >
                                        <span className="min-w-0">
                                            <span className="block text-[10px] font-black uppercase tracking-[0.25em] text-neutral-400 group-hover:text-neutral-300">Próximo</span>
                                            <span className="block text-sm font-black uppercase tracking-tight truncate">
                                                {nextEvent.name} · {parseLocalDate(nextEvent.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                                            </span>
                                        </span>
                                        <ArrowRight className="w-5 h-5 shrink-0 transition-transform group-hover:translate-x-1" />
                                    </a>
                                )}
                            </div>

                            {/* Acceso rápido a redes — cada una despliega su QR + compartir */}
                            {socialButtons.length > 0 && (
                                <div className="flex items-stretch border-t-4 border-black">
                                    <div className="hidden sm:flex items-center px-4 md:px-6 border-r-4 border-black shrink-0" style={{ backgroundColor: MARKER }}>
                                        <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.25em] text-black whitespace-nowrap">
                                            Seguinos
                                        </span>
                                    </div>
                                    <div className="flex flex-1 divide-x-4 divide-black">
                                        {socialButtons.map(({ key, label, url, Icon }) => (
                                            <button
                                                key={key}
                                                onClick={() => setSocialShare({ label, url, Icon })}
                                                className="group flex-1 flex flex-col items-center justify-center gap-1.5 px-2 py-4 hover:bg-black hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-inset"
                                                aria-label={`Compartir ${label} de la iglesia`}
                                            >
                                                <Icon className="w-5 h-5" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* ============================================================
                    LA CARTELERA — ANUNCIOS
                   ============================================================ */}
                <section className="py-12 md:py-16 bg-neutral-50 border-b-4 border-black">
                    <div className="max-w-7xl mx-auto px-4 md:px-8">
                        <div className="pi-reveal mb-8 flex items-end justify-between gap-4 border-b-4 border-black pb-4" style={{ animationDelay: '.05s' }}>
                            <div className="flex items-center gap-3">
                                <div className="p-2 border-2 border-black" style={{ backgroundColor: MARKER }}>
                                    <Megaphone className="w-5 h-5 text-black" />
                                </div>
                                <div>
                                    <span className="block text-[10px] font-black uppercase tracking-[0.25em] text-neutral-400">La cartelera</span>
                                    <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-none">Anuncios</h2>
                                </div>
                            </div>
                            {activeAnnouncements.length > 0 && (
                                <span className="hidden sm:inline text-xs font-black uppercase tracking-widest text-neutral-400 tabular-nums">
                                    {activeAnnouncements.length} en el tablero
                                </span>
                            )}
                        </div>

                        {activeAnnouncements.length === 0 ? (
                            <div className="pi-reveal py-16 text-center border-4 border-dashed border-black bg-white" style={{ animationDelay: '.1s' }}>
                                <Pin className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
                                <p className="text-neutral-500 font-black uppercase tracking-widest text-sm">El tablero está despejado</p>
                                <p className="text-neutral-400 font-bold text-xs mt-1 uppercase tracking-wide">Los anuncios se publican desde el panel interno</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                                {activeAnnouncements.map((ann, idx) => (
                                    <div
                                        key={ann.id}
                                        className="pi-reveal group relative bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 flex flex-col"
                                        style={{ animationDelay: `${0.1 + idx * 0.06}s` }}
                                    >
                                        {/* Push-pin — la nota clavada al tablero */}
                                        <div className="absolute -top-3 left-6 w-6 h-6 border-2 border-black rounded-full flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" style={{ backgroundColor: MARKER }}>
                                            <div className="w-1.5 h-1.5 rounded-full bg-black" />
                                        </div>

                                        <div className="p-6 pt-8 flex flex-col flex-1">
                                            <h3 className="text-lg font-black uppercase tracking-tight leading-tight mb-3">
                                                {ann.title}
                                            </h3>

                                            {ann.description && (
                                                <p className="text-sm font-medium text-neutral-600 leading-relaxed mb-4 flex-1 border-l-4 pl-3" style={{ borderColor: MARKER }}>
                                                    {ann.description}
                                                </p>
                                            )}

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
                                                        onClick={() => setQrModal({ open: true, title: ann.title, url: getQrUrl(ann.qrCodeUrl!), link: ann.link || window.location.href })}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-[10px] font-black uppercase tracking-widest border-2 border-black hover:bg-white hover:text-black transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                                                    >
                                                        <QrCode className="w-3.5 h-3.5" /> QR
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* ============================================================
                    AGENDA — PRÓXIMOS EVENTOS (sobre negro)
                   ============================================================ */}
                <section className="py-12 md:py-16 bg-black text-white border-b-4 border-black">
                    <div className="max-w-7xl mx-auto px-4 md:px-8">
                        <div className="pi-reveal mb-8 flex items-end justify-between gap-4 border-b-4 border-white/20 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 border-2 border-black text-black" style={{ backgroundColor: MARKER }}>
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <div>
                                    <span className="block text-[10px] font-black uppercase tracking-[0.25em] text-white/40">Agenda</span>
                                    <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-none">Próximos eventos</h2>
                                </div>
                            </div>
                            {upcomingEvents.length > 0 && (
                                <span className="hidden sm:inline text-xs font-black uppercase tracking-widest text-white/40 tabular-nums">
                                    {upcomingEvents.length} en agenda
                                </span>
                            )}
                        </div>

                        {upcomingEvents.length === 0 ? (
                            <div className="pi-reveal py-16 text-center border-4 border-white/20 border-dashed" style={{ animationDelay: '.05s' }}>
                                <Calendar className="w-12 h-12 mx-auto mb-4 text-white/20" />
                                <p className="text-white/50 font-black uppercase tracking-widest text-sm">Sin eventos próximos</p>
                                <p className="text-white/30 font-bold text-xs mt-1 uppercase tracking-wide">Los eventos se cargan desde el panel interno</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {upcomingEvents.map((ev, idx) => {
                                    const dateObj = parseLocalDate(ev.date);
                                    const dayName = dateObj.toLocaleDateString('es-AR', { weekday: 'long' });
                                    const dayNum = dateObj.toLocaleDateString('es-AR', { day: '2-digit' });
                                    const monthName = dateObj.toLocaleDateString('es-AR', { month: 'long' });
                                    return (
                                        <div
                                            key={ev.id}
                                            className="pi-reveal border-4 border-white bg-white/5 hover:bg-white/10 transition-all duration-200 hover:-translate-y-1 flex flex-col"
                                            style={{ animationDelay: `${0.05 + idx * 0.06}s` }}
                                        >
                                            <div className="p-5 flex flex-col flex-1">
                                                {/* Fecha — dato que sí importa para un evento */}
                                                <div className="flex items-start justify-between gap-3 mb-4">
                                                    <div className="flex-none text-center border-2 px-3 py-2 min-w-[56px] text-black" style={{ backgroundColor: MARKER, borderColor: '#000' }}>
                                                        <p className="text-[10px] font-black uppercase tracking-widest">{dayName.slice(0, 3)}</p>
                                                        <p className="text-3xl font-black leading-none tabular-nums">{dayNum}</p>
                                                        <p className="text-[10px] font-black uppercase tracking-wider mt-0.5">{monthName.slice(0, 3)}</p>
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

                                                {(ev.startTime || ev.endTime) && (
                                                    <div className="flex items-center gap-1.5 mb-3">
                                                        <Clock className="w-3.5 h-3.5 text-white/40 flex-none" />
                                                        <span className="text-xs font-black text-white/60 uppercase tracking-widest">
                                                            {ev.startTime}{ev.endTime ? ` — ${ev.endTime}` : ''}
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="flex gap-2 mt-auto pt-4 border-t-2 border-white/10">
                                                    {ev.link && (
                                                        <a
                                                            href={ev.link}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 border-2 border-white/30 text-xs font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" /> Ver más
                                                        </a>
                                                    )}
                                                    {(ev.qrCodeUrl || ev.link) && (
                                                        <button
                                                            onClick={() => setQrModal({ open: true, title: ev.name, url: getEventQrUrl(ev), link: ev.link || window.location.href })}
                                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white text-black border-2 border-white text-xs font-black uppercase tracking-widest transition-all hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                                                        >
                                                            <QrCode className="w-3.5 h-3.5" /> QR
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => setSharingEvent(ev)}
                                                        className="flex items-center justify-center gap-1.5 py-2 px-3 border-2 border-white/30 text-xs font-black uppercase hover:bg-white hover:text-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                                                        aria-label="Compartir evento"
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

                {/* ============================================================
                    CALENDARIO
                   ============================================================ */}
                <section id="agenda-section" className="py-12 md:py-16 bg-white border-b-4 border-black scroll-mt-20">
                    <div className="max-w-7xl mx-auto px-4 md:px-8">
                        <div className="pi-reveal mb-8 flex items-center gap-3 border-b-4 border-black pb-4">
                            <div className="p-2 border-2 border-black bg-black text-white">
                                <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="block text-[10px] font-black uppercase tracking-[0.25em] text-neutral-400">Calendario</span>
                                <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-none">Nuestra agenda</h2>
                            </div>
                        </div>

                        {showCta && (
                            <div className="mb-6">
                                <a
                                    href={appConfig.infoPointConfig?.heroCtaLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-5 py-3 bg-white font-black text-sm uppercase tracking-widest border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                                >
                                    {appConfig.infoPointConfig?.heroCtaText}
                                    <ArrowRight className="w-4 h-4" />
                                </a>
                            </div>
                        )}

                        <InfoPointCalendar />
                    </div>
                </section>

                {/* --- FOOTER --- */}
                <footer className="bg-white border-t-4 border-black">
                    <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                            <div className="flex items-center gap-4">
                                <img src={LOGO_URL} alt="Logo" className="h-14 w-auto object-contain" />
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight">Punto de Info</h3>
                                    <p className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Sistema Origen</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {footerLinks?.instagram && (
                                    <button
                                        onClick={() => window.open(footerLinks.instagram, '_blank')}
                                        className="w-14 h-14 border-4 border-black flex items-center justify-center hover:bg-black hover:text-white transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                                        title="Instagram"
                                    >
                                        <Instagram className="w-6 h-6" />
                                    </button>
                                )}
                                {footerLinks?.facebook && (
                                    <button
                                        onClick={() => window.open(footerLinks.facebook, '_blank')}
                                        className="w-14 h-14 border-4 border-black flex items-center justify-center hover:bg-black hover:text-white transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                                        title="Facebook"
                                    >
                                        <Facebook className="w-6 h-6" />
                                    </button>
                                )}
                                {footerLinks?.youtube && (
                                    <button
                                        onClick={() => window.open(footerLinks.youtube, '_blank')}
                                        className="w-14 h-14 border-4 border-black flex items-center justify-center hover:bg-black hover:text-white transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                                        title="YouTube"
                                    >
                                        <Youtube className="w-6 h-6" />
                                    </button>
                                )}
                                {footerLinks?.spotify && (
                                    <button
                                        onClick={() => window.open(footerLinks.spotify, '_blank')}
                                        className="w-14 h-14 border-4 border-black flex items-center justify-center hover:bg-black hover:text-white transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                                        title="Spotify"
                                    >
                                        <Music className="w-6 h-6" />
                                    </button>
                                )}
                            </div>

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
