
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store';
import {
    QrCode,
    Instagram, Facebook, Youtube, Music,
    ArrowRight, Calendar, Clock, Megaphone
} from 'lucide-react';
import { AppEvent, AppConfig, Announcement, PuntoInfoBannerSlide } from '../../types';
import { db } from '../../services/dbService';
import { getPuntoInfoBannerSlides } from '../../services/supabaseService';
import HeroCarousel, { HeroSlideData } from '../../components/ui/CarruselHero';
import { useFullBleedHero } from '../../contexts/HeroContext';
import InfoPointCalendar from './CalendarioPuntoInformacion';
import ModalCompartirQR from '../../components/modals/ModalCompartirQR';

const LOGO_URL = '/origen-logo.png';

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

// ── Tokens de Home.tsx ──────────────────────────────────────────────────
// Esta pantalla no tiene estilo propio: usa el del Home. Los tokens se
// declaran acá arriba para que la intención quede explícita y no queden dos
// versiones distintas del mismo botón repartidas por el archivo.
const CARD = 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm';
const EYEBROW = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400';
const H2 = 'text-lg sm:text-xl font-bold uppercase tracking-tight leading-[1.05] text-slate-900 dark:text-white';
const META = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-zinc-500 tabular-nums';
const BODY = 'text-sm font-normal text-slate-500 dark:text-zinc-400 leading-relaxed';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:bg-black dark:hover:bg-slate-200 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20 dark:focus-visible:ring-white/20';
const BTN_SOFT = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 text-sm font-semibold hover:bg-slate-900 hover:text-white hover:border-slate-900 dark:hover:bg-white dark:hover:text-slate-900 transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20 dark:focus-visible:ring-white/20';
// Píldora de estado: mismo molde que los badges de cupo del Home.
const PILL = 'inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full';
// El mismo botón negro del Home, pero a lo ancho y en tamaño táctil (48px de
// alto). En el teléfono la acción de una tarjeta no debería ser una fichita
// apretada contra el borde: ocupa el pie entero, que además es donde el pulgar
// llega sin reacomodar la mano.
const BTN_PRIMARY_BLOCK = 'w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:bg-black dark:hover:bg-slate-200 active:scale-[0.98] touch-manipulation transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20 dark:focus-visible:ring-white/20';

// Alto mínimo de la tarjeta de anuncio: entradilla + dos líneas de título +
// cuatro de descripción + el pie. Iguala las tarjetas entre filas para que un
// anuncio largo no deje al resto flotando en el vacío.
//
// Arranca en `sm` a propósito: en mobile la grilla es de una sola columna, así
// que no hay nada con qué emparejar y un mínimo sólo agregaría aire muerto
// debajo de los anuncios de una línea. Ahí cada tarjeta mide lo que necesita.
const ANNOUNCEMENT_MIN_H = 'sm:min-h-[280px]';

/**
 * Vigencia de un anuncio, en la forma más corta que se entienda.
 *
 * Cuando empieza y termina el mismo día, "Del 30 ago al 30 ago" se lee como un
 * error de carga: es un solo día y se dice así.
 */
const formatVigencia = (startDate?: string, endDate?: string): string => {
    const fmt = (d: string) =>
        new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });

    if (startDate && endDate) {
        return startDate === endDate ? `El ${fmt(startDate)}` : `Del ${fmt(startDate)} al ${fmt(endDate)}`;
    }
    if (startDate) return `Desde el ${fmt(startDate)}`;
    if (endDate) return `Hasta el ${fmt(endDate)}`;
    return 'Activo';
};

/**
 * Descripción de un anuncio, recortada a cuatro líneas con "Ver más".
 *
 * Mismo criterio que la card de eventos del Home (EventoDescripcion en
 * pages/home/Home.tsx): el botón sólo aparece si el texto realmente no entra.
 * Se mide el recorte (scrollHeight > clientHeight) en vez de contar
 * caracteres, porque cuántas líneas ocupa depende del ancho de la columna —
 * el tablero pasa de 1 a 2 y a 3 columnas según el breakpoint, así que el
 * mismo texto entra en un tamaño de pantalla y se corta en otro. Un "Ver más"
 * debajo de una descripción de seis palabras es ruido.
 *
 * El estado vive acá adentro y no en el padre —al revés que en el Home— porque
 * en el tablero se ven todos los anuncios a la vez: expandir uno no tiene por
 * qué volver a recortar a los demás.
 */
const AnuncioDescripcion: React.FC<{ text: string }> = ({ text }) => {
    const ref = useRef<HTMLParagraphElement>(null);
    const [expanded, setExpanded] = useState(false);
    const [isClamped, setIsClamped] = useState(false);

    useEffect(() => {
        // Sólo se mide recortado: expandido, scrollHeight y clientHeight
        // coinciden y "Ver menos" desaparecería justo cuando hace falta.
        if (expanded) return;
        const el = ref.current;
        if (!el) return;
        const measure = () => setIsClamped(el.scrollHeight > el.clientHeight + 1);
        measure();
        // El recorte depende del ancho: rotar el teléfono o cruzar un
        // breakpoint cambia la cantidad de líneas.
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, [text, expanded]);

    return (
        <div className="mt-2.5 flex-1 flex flex-col items-start gap-1">
            <p ref={ref} className={`${BODY} ${expanded ? '' : 'line-clamp-4'}`}>
                {text}
            </p>
            {(isClamped || expanded) && (
                <button
                    onClick={() => setExpanded(v => !v)}
                    aria-expanded={expanded}
                    /* El `py-1.5` no es aire: es área táctil. Sin él el enlace
                       mide 20px de alto y en el teléfono se falla el toque. */
                    className="py-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 touch-manipulation rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 transition-colors"
                >
                    {expanded ? 'Ver menos' : 'Ver más'}
                </button>
            )}
        </div>
    );
};

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
    // Acceso rápido a redes: al tocar una red se despliega su QR + acciones de compartir.
    const [socialShare, setSocialShare] = useState<{ label: string, url: string, Icon: React.ComponentType<{ className?: string }> } | null>(null);
    const [bannerSlides, setBannerSlides] = useState<PuntoInfoBannerSlide[]>([]);

    // Esta pantalla abre con el hero a sangre, igual que el Home: la navbar
    // se monta encima transparente y el contenido sube 64px. Se lo declara al
    // Layout desde acá y no por ruta, porque `/punto-de-informacion` también
    // renderiza los paneles internos —fondo claro, sin hero— bajo el mismo
    // pathname.
    useFullBleedHero();

    useEffect(() => {
        setAppConfig(db.getAppConfig());
    }, []);

    useEffect(() => {
        getPuntoInfoBannerSlides().then(setBannerSlides);
    }, []);

    // Anuncios activos (override manual si existe)
    const activeAnnouncements: Announcement[] = announcements.filter(a => a.isActive !== false);

    // Próximos eventos: ascendente por fecha
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
        .pi-reveal { opacity: 0; animation: pi-rise .6s cubic-bezier(0.22,1,0.36,1) forwards; }
        @media (prefers-reduced-motion: reduce) {
            .pi-reveal { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
    `;

    return (
        <>
            <style>{animationStyles}</style>

            <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white font-sans flex flex-col selection:bg-slate-900 selection:text-white">

                <ModalCompartirQR
                    isOpen={qrModal.open}
                    onClose={() => setQrModal({ ...qrModal, open: false })}
                    title={qrModal.title}
                    qrUrl={qrModal.url}
                    link={qrModal.link}
                />

                {/* --- SHARE MODAL (evento) --- */}
                <ModalCompartirQR
                    isOpen={!!sharingEvent}
                    onClose={() => setSharingEvent(null)}
                    title={sharingEvent?.name || ''}
                    subtitle={sharingEvent ? parseLocalDate(sharingEvent.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : undefined}
                    qrUrl={sharingEvent ? getQrUrl(sharingEvent.link || `${sharingEvent.name} - ${sharingEvent.date}`) : ''}
                    link={sharingEvent?.link || window.location.href}
                />

                {/* --- SOCIAL SHARE MODAL (redes del footer) --- */}
                <ModalCompartirQR
                    isOpen={!!socialShare}
                    onClose={() => setSocialShare(null)}
                    title={socialShare?.label || ''}
                    qrUrl={socialShare ? getQrUrl(socialShare.url) : ''}
                    link={socialShare?.url || ''}
                />

                {/* === HERO — a sangre y al ras del tope de la página ===
                    Vive fuera del contenedor con padding, igual que en el Home:
                    la navbar es transparente y se monta encima (Estructura.tsx
                    sube el contenido 64px cuando hay hero a sangre), así que el
                    banner llega hasta el borde superior. Sólo se redondea abajo
                    — arriba va al ras, y a los costados también, porque un borde
                    superior recto contra un margen lateral se vería roto. */}
                <div className="rounded-b-3xl overflow-hidden">
                    {bannerSlides.length > 0 ? (
                        <HeroCarousel
                            slides={bannerSlides.map((s): HeroSlideData => ({
                                id: s.id,
                                imageUrl: s.mediaUrl,
                                mediaType: s.mediaType,
                                videoUrl: s.videoUrl,
                                focalX: s.focalX,
                                focalY: s.focalY,
                                zoom: s.zoom,
                                title: s.title,
                                subtitle: s.subtitle,
                            }))}
                            theme="soft"
                            heightClass="h-[46vh] sm:h-[50vh] md:h-[54vh] lg:h-[480px]"
                            autoPlayInterval={6000}
                        />
                    ) : (
                        /* Sin slides cargados. Va sobre fondo oscuro y no gris
                           claro a propósito: la navbar montada encima invierte
                           el logo a blanco, y sobre un fondo claro se volvería
                           invisible. Mismo alto y mismo registro tipográfico
                           que el tema `soft`, así que el cambio de un estado al
                           otro no mueve nada de la página. El pt-16 compensa
                           los 64px que tapa la navbar. */
                        <div className="h-[46vh] sm:h-[50vh] md:h-[54vh] lg:h-[480px] px-4 pt-16 flex items-center justify-center bg-slate-900 dark:bg-black">
                            <div className="text-center">
                                <img src={LOGO_URL} alt="Origen" className="h-9 sm:h-11 w-auto mx-auto mb-5 object-contain invert" />
                                <p className="text-3xl md:text-5xl lg:text-6xl font-bold uppercase tracking-tight leading-[1.05] text-white">
                                    Punto de información
                                </p>
                                <p className="mt-3 md:mt-4 text-base md:text-lg font-medium text-white/90 max-w-lg mx-auto">
                                    Todo lo que está pasando en Origen, en un solo lugar.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-16 flex-1">

                    {/* ============================================================
                        RESUMEN — qué hay hoy, en tres datos
                        Primer bloque bajo el hero, el mismo rol que "Próximos
                        eventos" en el Home: tres tarjetas del molde compartido.
                       ============================================================ */}
                    <section>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">

                            {/* Anuncios activos — dato, no acción: es la única
                                de las tres que no lleva a ningún lado. */}
                            <div className={`pi-reveal ${CARD} p-5 flex items-center gap-4`}>
                                <div className="shrink-0 p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                                    <Megaphone className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-2xl font-black tabular-nums tracking-[-0.03em] leading-none text-slate-900 dark:text-white">
                                        {activeAnnouncements.length}
                                    </p>
                                    <p className={`${EYEBROW} mt-1.5`}>
                                        {activeAnnouncements.length === 1 ? 'anuncio activo' : 'anuncios activos'}
                                    </p>
                                </div>
                            </div>

                            {/* Eventos próximos — lleva al módulo de Eventos.
                                Va con <Link> y no con un <a href="/eventos">: la app
                                monta un HashRouter, así que la URL real es "#/eventos"
                                y un ancla común dispararía una recarga completa contra
                                una ruta que el servidor no sirve. */}
                            <Link
                                to="/eventos"
                                title="Ver todos los eventos"
                                className={`pi-reveal group ${CARD} p-5 flex items-center gap-4 hover:shadow-lg hover:border-slate-300 dark:hover:border-zinc-700 transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20 dark:focus-visible:ring-white/20`}
                                style={{ animationDelay: '.05s' }}
                            >
                                <div className="shrink-0 p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                                    <Calendar className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-2xl font-black tabular-nums tracking-[-0.03em] leading-none text-slate-900 dark:text-white">
                                        {upcomingEvents.length}
                                    </p>
                                    <p className={`${EYEBROW} mt-1.5`}>
                                        {upcomingEvents.length === 1 ? 'evento próximo' : 'eventos próximos'}
                                    </p>
                                </div>
                                <ArrowRight className="w-4 h-4 shrink-0 text-slate-400 dark:text-zinc-500 transition-transform group-hover:translate-x-1" />
                            </Link>

                            {/* Redes — cada una despliega su QR para escanear desde el celular */}
                            {socialButtons.length > 0 && (
                                <div className={`pi-reveal ${CARD} p-5`} style={{ animationDelay: '.1s' }}>
                                    <p className={EYEBROW}>Seguinos</p>
                                    {/* Los botones se reparten el ancho de la tarjeta en vez de
                                        medir siempre lo mismo: así el objetivo táctil es el más
                                        grande que entre en cada pantalla y nunca desborda.
                                        El `min-w` es el mínimo cómodo para el pulgar (44px) y no
                                        el tamaño que se busca: flexbox lo usa como base para
                                        decidir cuántos entran por fila, así que ponerlo más alto
                                        mandaba la cuarta insignia sola a una segunda fila en
                                        pantallas de 320px. Con 44 entran las cuatro siempre y
                                        recién ahí crecen. El techo de 68px evita que en desktop
                                        estiren esta tarjeta de más contra las otras dos de la
                                        fila — en la práctica quedan entre 52 y 68px de lado. */}
                                    <div className="flex flex-wrap gap-2 sm:gap-3 mt-3">
                                        {socialButtons.map(({ key, label, url, Icon }) => (
                                            <button
                                                key={key}
                                                onClick={() => setSocialShare({ label, url, Icon })}
                                                className="flex-1 basis-0 min-w-[44px] max-w-[68px] aspect-square rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center touch-manipulation hover:border-slate-300 dark:hover:border-zinc-600 hover:shadow-md active:scale-95 transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20 dark:focus-visible:ring-white/20"
                                                title={label}
                                                aria-label={`Ver el QR de ${label}`}
                                            >
                                                <Icon className="w-7 h-7" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* ============================================================
                        ANUNCIOS
                       ============================================================ */}
                    <section className="pt-10 sm:pt-14">
                        <div className="pi-reveal flex items-baseline justify-between gap-3 mb-4" style={{ animationDelay: '.05s' }}>
                            <h2 className={H2}>Anuncios</h2>
                            {activeAnnouncements.length > 0 && (
                                <span className={`hidden sm:inline shrink-0 ${META}`}>
                                    {activeAnnouncements.length} en el tablero
                                </span>
                            )}
                        </div>

                        {activeAnnouncements.length === 0 ? (
                            <div className="pi-reveal bg-white dark:bg-zinc-900 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl py-14 px-6 text-center" style={{ animationDelay: '.1s' }}>
                                <p className="text-base font-bold text-slate-900 dark:text-white">Todavía no hay anuncios</p>
                                <p className={`${BODY} mt-1`}>Cuando el equipo publique algo nuevo, aparece acá.</p>
                            </div>
                        ) : (
                            /* Sin `items-start`: las tarjetas estiran a la altura de
                               su fila, y el min-h iguala también entre filas. */
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                                {activeAnnouncements.map((ann, idx) => (
                                    <div
                                        key={ann.id}
                                        className={`pi-reveal group ${CARD} ${ANNOUNCEMENT_MIN_H} hover:shadow-lg hover:border-slate-300 dark:hover:border-zinc-700 transition-all duration-200 flex flex-col`}
                                        style={{ animationDelay: `${0.1 + idx * 0.06}s` }}
                                    >
                                        <div className="p-5 sm:p-6 flex flex-col flex-1">
                                            {/* VIGENCIA — de entradilla, no al pie.
                                                Es lo único que cambia de un anuncio a otro
                                                (siempre activo vs. unas fechas), así que ordena
                                                la lectura desde arriba: cuándo → qué → detalle →
                                                acción. De paso le deja el pie entero al botón,
                                                que antes competía con la píldora por la misma
                                                fila y quedaba reducido a una fichita. */}
                                            <div className="mb-3">
                                                {ann.isPermanent ? (
                                                    <span className={`${PILL} bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400`}>
                                                        Permanente
                                                    </span>
                                                ) : (
                                                    <span className={`${PILL} bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300`}>
                                                        <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                        {formatVigencia(ann.startDate, ann.endDate)}
                                                    </span>
                                                )}
                                            </div>

                                            <h3 className="text-lg font-bold tracking-[-0.01em] leading-snug text-slate-900 dark:text-white line-clamp-2">
                                                {ann.title}
                                            </h3>

                                            {ann.description
                                                ? <AnuncioDescripcion text={ann.description} />
                                                /* Sin descripción el pie igual queda abajo de todo,
                                                   alineado con el de las demás tarjetas. */
                                                : <div className="flex-1" aria-hidden="true" />}

                                            {ann.qrCodeUrl && (
                                                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-zinc-800">
                                                    <button
                                                        onClick={() => setQrModal({ open: true, title: ann.title, url: getQrUrl(ann.qrCodeUrl!), link: ann.link || window.location.href })}
                                                        className={BTN_PRIMARY_BLOCK}
                                                    >
                                                        <QrCode className="w-5 h-5" /> Ver QR
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* ============================================================
                        PRÓXIMOS EVENTOS
                       ============================================================ */}
                    <section className="pt-10 sm:pt-14">
                        <div className="pi-reveal flex items-baseline justify-between gap-3 mb-4">
                            <h2 className={H2}>Próximos eventos</h2>
                            {upcomingEvents.length > 0 && (
                                <span className={`hidden sm:inline shrink-0 ${META}`}>
                                    {upcomingEvents.length} en agenda
                                </span>
                            )}
                        </div>

                        {upcomingEvents.length === 0 ? (
                            <div className="pi-reveal bg-white dark:bg-zinc-900 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl py-14 px-6 text-center" style={{ animationDelay: '.05s' }}>
                                <p className="text-base font-bold text-slate-900 dark:text-white">No hay eventos en agenda</p>
                                <p className={`${BODY} mt-1`}>Mirá el calendario de abajo para ver qué se viene.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                                {upcomingEvents.map((ev, idx) => {
                                    const dateObj = parseLocalDate(ev.date);
                                    const dayName = dateObj.toLocaleDateString('es-AR', { weekday: 'long' });
                                    const dayNum = dateObj.toLocaleDateString('es-AR', { day: '2-digit' });
                                    const monthName = dateObj.toLocaleDateString('es-AR', { month: 'long' });
                                    return (
                                        <div
                                            key={ev.id}
                                            className={`pi-reveal ${CARD} hover:shadow-lg hover:border-slate-300 dark:hover:border-zinc-700 transition-all duration-200 flex flex-col`}
                                            style={{ animationDelay: `${0.05 + idx * 0.06}s` }}
                                        >
                                            <div className="p-5 flex flex-col flex-1">
                                                {/* Fecha — el dato que define a un evento */}
                                                <div className="flex items-start gap-4 mb-4">
                                                    <div className="flex-none text-center rounded-xl px-3 py-2.5 min-w-[60px] bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                                                        <p className={EYEBROW}>{dayName.slice(0, 3)}</p>
                                                        <p className="text-2xl font-black tabular-nums tracking-[-0.03em] leading-none text-slate-900 dark:text-white my-1">{dayNum}</p>
                                                        <p className={EYEBROW}>{monthName.slice(0, 3)}</p>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-base sm:text-lg font-bold tracking-[-0.01em] leading-tight text-slate-900 dark:text-white line-clamp-2">{ev.name}</h3>
                                                        {ev.type && (
                                                            <span className={`${PILL} mt-2 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300`}>
                                                                {ev.type}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {ev.description && (
                                                    <p className={`${BODY} mb-4 line-clamp-3`}>{ev.description}</p>
                                                )}

                                                {(ev.startTime || ev.endTime) && (
                                                    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-zinc-300">
                                                        <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                                                        {ev.startTime}{ev.endTime ? ` – ${ev.endTime}` : ''}
                                                    </div>
                                                )}

                                                {(ev.qrCodeUrl || ev.link) && (
                                                    <div className="mt-auto pt-4">
                                                        <button
                                                            onClick={() => setQrModal({ open: true, title: ev.name, url: getEventQrUrl(ev), link: ev.link || window.location.href })}
                                                            className={`${BTN_PRIMARY} w-full`}
                                                        >
                                                            <QrCode className="w-4 h-4" /> Ver QR
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {/* ============================================================
                        CALENDARIO
                       ============================================================ */}
                    <section id="agenda-section" className="pt-10 sm:pt-14 scroll-mt-20">
                        <div className="pi-reveal flex items-baseline justify-between gap-3 mb-4">
                            <h2 className={H2}>Nuestra agenda</h2>
                            {showCta && (
                                <a
                                    href={appConfig.infoPointConfig?.heroCtaLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`shrink-0 ${BTN_SOFT}`}
                                >
                                    {appConfig.infoPointConfig?.heroCtaText}
                                    <ArrowRight className="w-4 h-4" />
                                </a>
                            )}
                        </div>

                        <InfoPointCalendar />
                    </section>
                </div>

                {/* --- FOOTER --- */}
                <footer className="relative z-10 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 py-8 sm:py-12 md:py-16 px-4 md:px-6 mt-auto">
                    <div className="max-w-7xl mx-auto flex flex-col items-center text-center md:text-left md:flex-row md:items-center md:justify-between gap-8 md:gap-12">

                        <div className="flex items-center gap-4">
                            <img src={LOGO_URL} alt="Origen" className="h-12 w-auto object-contain shrink-0 dark:invert" />
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-light tracking-[-0.02em] text-slate-900 dark:text-white">
                                    ¿Querés conocernos?
                                </h2>
                                <p className="text-slate-500 dark:text-zinc-400 text-sm md:text-base font-normal mt-1">
                                    Seguinos en nuestras redes y sé parte de la comunidad.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap justify-center gap-3 md:gap-4">
                            {footerLinks?.instagram && (
                                <button
                                    onClick={() => window.open(footerLinks.instagram, '_blank')}
                                    className="w-12 h-12 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-900 hover:text-white hover:border-slate-900 dark:hover:bg-white dark:hover:text-slate-900 transition-all duration-200"
                                    title="Instagram"
                                    aria-label="Abrir Instagram de Origen (nueva pestaña)"
                                >
                                    <Instagram className="w-5 h-5" />
                                </button>
                            )}
                            {footerLinks?.facebook && (
                                <button
                                    onClick={() => window.open(footerLinks.facebook, '_blank')}
                                    className="w-12 h-12 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-900 hover:text-white hover:border-slate-900 dark:hover:bg-white dark:hover:text-slate-900 transition-all duration-200"
                                    title="Facebook"
                                    aria-label="Abrir Facebook de Origen (nueva pestaña)"
                                >
                                    <Facebook className="w-5 h-5" />
                                </button>
                            )}
                            {footerLinks?.youtube && (
                                <button
                                    onClick={() => window.open(footerLinks.youtube, '_blank')}
                                    className="w-12 h-12 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-900 hover:text-white hover:border-slate-900 dark:hover:bg-white dark:hover:text-slate-900 transition-all duration-200"
                                    title="YouTube"
                                    aria-label="Abrir YouTube de Origen (nueva pestaña)"
                                >
                                    <Youtube className="w-5 h-5" />
                                </button>
                            )}
                            {footerLinks?.spotify && (
                                <button
                                    onClick={() => window.open(footerLinks.spotify, '_blank')}
                                    className="w-12 h-12 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-900 hover:text-white hover:border-slate-900 dark:hover:bg-white dark:hover:text-slate-900 transition-all duration-200"
                                    title="Spotify"
                                    aria-label="Abrir Spotify de Origen (nueva pestaña)"
                                >
                                    <Music className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="max-w-7xl mx-auto mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-slate-200 dark:border-zinc-800 text-center">
                        <p className="text-sm font-semibold text-slate-400 dark:text-zinc-500">
                            © {new Date().getFullYear()} Sistema Origen — Todos los derechos reservados
                        </p>
                        <p className="text-xs font-normal tracking-[0.06em] text-slate-300 dark:text-zinc-600 mt-2">
                            Powered by IQstudios
                        </p>
                    </div>
                </footer>
            </div>
        </>
    );
};

export default PublicHome;
