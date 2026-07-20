import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseService } from '../../services/supabaseService';
import { hasRole } from '../../services/authUtils';
import { AppEvent, User, UserRole } from '../../types';
import {
    Calendar, MapPin, ArrowRight,
    CalendarDays, Trophy, Users, QrCode
} from 'lucide-react';
import ModalCompartirQR from '../../components/modals/ModalCompartirQR';

interface EventosProps {
    currentUser: User | null;
}

const Eventos: React.FC<EventosProps> = ({ currentUser }) => {
    const navigate = useNavigate();
    const [events, setEvents] = useState<AppEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [qrModal, setQrModal] = useState<{ open: boolean, title: string, url: string, link: string }>({ open: false, title: '', url: '', link: '' });

    const getEventQrUrl = (event: AppEvent) => {
        const data = event.qrCodeUrl || event.link || `${event.name} - ${event.date}`;
        return getQrUrl(data);
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

    useEffect(() => {
        supabaseService.getEvents()
            .then(data => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                setEvents(data.filter(e => new Date(e.date) >= today));
            })
            .finally(() => setLoading(false));
    }, []);

    const formatDate = (dateStr: string): string =>
        new Date(dateStr + 'T12:00:00')
            .toLocaleDateString('es-AR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });

    const featured = events[0] ?? null;
    const rest     = events.slice(1);

    const isAdmin = !!currentUser && hasRole(currentUser, [
        UserRole.SUPER_ADMIN,
        UserRole.PASTOR,
        UserRole.EVENTOS,
        UserRole.ENCARGADO_EVENTOS
    ]);

    return (
        <div className="min-h-screen bg-white">
            <ModalCompartirQR
                isOpen={qrModal.open}
                onClose={() => setQrModal({ ...qrModal, open: false })}
                title={qrModal.title}
                qrUrl={qrModal.url}
                link={qrModal.link}
            />

            <div className="max-w-4xl mx-auto px-4 md:px-8 py-10 md:py-14">

                {/* Header */}
                <div className="mb-8 pb-8 border-b border-gray-100">
                    <p className="text-[11px] font-medium tracking-wide text-gray-400 uppercase mb-2">
                        Origen · Comunidad
                    </p>
                    <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 tracking-tight">
                        Eventos
                    </h1>
                </div>

                {/* ── DÍA DEL PADRE ── */}
                <div className="mb-10">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-4">
                        Evento activo
                    </p>

                    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6 md:p-8">
                        <div className="flex items-center gap-2 mb-2">
                            <Trophy className="w-4 h-4 text-amber-500" />
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">
                                Día del Padre
                            </span>
                        </div>

                        <h2 className="text-xl font-semibold text-gray-900 tracking-tight mb-2">
                            Actividades y Ranking
                        </h2>
                        <p className="text-sm text-gray-500 leading-relaxed mb-6">
                            Inscribí a tu familia y participá en las actividades del Día del Padre.
                            Seguí el ranking en tiempo real.
                        </p>

                        {/* CTAs principales */}
                        <div className="flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={() => navigate('/eventos/ranking-diadelpadre')}
                                className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 cursor-pointer"
                            >
                                <Trophy className="w-4 h-4" aria-hidden="true" />
                                Ver Ranking
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/id-dpadre')}
                                className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-white border border-amber-200 text-gray-700 text-sm font-semibold hover:bg-amber-50 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 cursor-pointer"
                            >
                                <Users className="w-4 h-4" aria-hidden="true" />
                                Inscribirse
                            </button>
                        </div>

                        {/* Links de administración */}
                        {isAdmin && (
                            <div className="mt-5 pt-4 border-t border-amber-100 flex flex-wrap gap-4">
                                <button
                                    type="button"
                                    onClick={() => navigate('/eventos/puntuacion')}
                                    className="text-xs font-semibold text-amber-600 hover:text-amber-800 transition-colors flex items-center gap-1.5 min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:underline"
                                >
                                    Puntuación <ArrowRight className="w-3 h-3" aria-hidden="true" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="flex justify-center items-center py-16">
                        <div className="w-6 h-6 rounded-full border-2 border-gray-100 border-t-gray-300 animate-spin" />
                    </div>
                )}

                {/* Vacío */}
                {!loading && events.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
                            <CalendarDays className="w-6 h-6 text-gray-300" />
                        </div>
                        <p className="text-sm font-medium text-gray-400">
                            No hay eventos próximos
                        </p>
                    </div>
                )}

                {/* Card destacada */}
                {!loading && featured && (
                    <div className="mb-10">
                        {featured.imageUrl ? (
                            <div
                                className="relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-[0_12px_40px_rgba(0,0,0,0.15)] hover:-translate-y-[3px]"
                                style={{ minHeight: 280 }}
                                onClick={() => featured.link && window.open(featured.link, '_blank')}
                            >
                                <img
                                    src={featured.imageUrl}
                                    alt={featured.name}
                                    className="absolute inset-0 w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                                <div className="relative z-10 p-8 md:p-10 flex flex-col justify-end" style={{ minHeight: 280 }}>
                                    <span className="inline-flex self-start items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 text-[11px] font-semibold text-gray-800 mb-3">
                                        <span className="w-1.5 h-1.5 rounded-full bg-gray-800 shrink-0" aria-hidden="true" />
                                        Próximo
                                    </span>

                                    {featured.color && (
                                        <div className="w-2.5 h-2.5 rounded-full mb-2" style={{ backgroundColor: featured.color }} />
                                    )}

                                    <h2 className="text-2xl md:text-3xl font-semibold text-white tracking-tight leading-tight mb-3">
                                        {featured.name}
                                    </h2>

                                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-white/70 text-sm">
                                        <span className="flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {formatDate(featured.date)}
                                            {featured.startTime && <span>· {featured.startTime}</span>}
                                        </span>
                                        {featured.location && (
                                            <span className="flex items-center gap-1.5">
                                                <MapPin className="w-3.5 h-3.5" />
                                                {featured.location}
                                            </span>
                                        )}
                                    </div>

                                    {(featured.qrCodeUrl || featured.link) && (
                                        <div className="mt-4 flex items-center">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setQrModal({ open: true, title: featured.name, url: getEventQrUrl(featured), link: featured.link || window.location.href });
                                                }}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-black text-xs font-black uppercase tracking-widest rounded transition-all hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                                            >
                                                <QrCode className="w-4 h-4" /> QR
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div
                                className={`rounded-2xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-8 md:p-10 transition-all duration-200 hover:shadow-[0_8px_32px_rgba(0,0,0,0.10)] hover:-translate-y-[2px] ${featured.link ? 'cursor-pointer' : ''}`}
                                onClick={() => featured.link && window.open(featured.link, '_blank')}
                            >
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-900 text-[11px] font-semibold text-white mb-4">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" aria-hidden="true" />
                                    Próximo
                                </span>

                                {featured.color && (
                                    <div className="w-2.5 h-2.5 rounded-full mb-3" style={{ backgroundColor: featured.color }} />
                                )}

                                <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight leading-tight mb-3">
                                    {featured.name}
                                </h2>

                                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-gray-400 text-sm mb-4">
                                    <span className="flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {formatDate(featured.date)}
                                        {featured.startTime && <span>· {featured.startTime}</span>}
                                    </span>
                                    {featured.location && (
                                        <span className="flex items-center gap-1.5">
                                            <MapPin className="w-3.5 h-3.5" />
                                            {featured.location}
                                        </span>
                                    )}
                                </div>

                                {(featured.qrCodeUrl || featured.link) && (
                                    <div className="mt-4 flex items-center">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setQrModal({ open: true, title: featured.name, url: getEventQrUrl(featured), link: featured.link || window.location.href });
                                            }}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-xs font-black uppercase tracking-widest rounded transition-all hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                                        >
                                            <QrCode className="w-4 h-4" /> QR
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Grid de eventos */}
                {!loading && rest.length > 0 && (
                    <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-5">
                            Próximos eventos
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {rest.map(event => (
                                <div
                                    key={event.id}
                                    onClick={() => event.link && window.open(event.link, '_blank')}
                                    className={`bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-[2px] ${event.link ? 'cursor-pointer' : ''}`}
                                >
                                    {event.imageUrl && (
                                        <div className="h-40 overflow-hidden">
                                            <img
                                                src={event.imageUrl}
                                                alt={event.name}
                                                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                                            />
                                        </div>
                                    )}

                                    <div className="p-5">
                                        {event.color && (
                                            <div className="w-2.5 h-2.5 rounded-full mb-3" style={{ backgroundColor: event.color }} />
                                        )}

                                        <h3 className="text-base font-semibold text-gray-900 tracking-tight leading-snug mb-3 line-clamp-2">
                                            {event.name}
                                        </h3>

                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2 text-gray-400 text-xs">
                                                <Calendar className="w-3.5 h-3.5 shrink-0" />
                                                <span>
                                                    {formatDate(event.date)}
                                                    {event.startTime && <span>{' · '}{event.startTime}</span>}
                                                </span>
                                            </div>

                                            {event.location && (
                                                <div className="flex items-center gap-2 text-gray-400 text-xs">
                                                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                                                    <span className="truncate">{event.location}</span>
                                                </div>
                                            )}
                                        </div>

                                        {event.description && (
                                            <p className="mt-3 text-xs text-gray-400 leading-relaxed line-clamp-2">
                                                {event.description}
                                            </p>
                                        )}

                                        {(event.qrCodeUrl || event.link) && (
                                            <div className="mt-4 flex items-center">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setQrModal({ open: true, title: event.name, url: getEventQrUrl(event), link: event.link || window.location.href });
                                                    }}
                                                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-black text-white text-xs font-black uppercase tracking-widest rounded-lg transition-all hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                                                >
                                                    <QrCode className="w-4 h-4" /> QR
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default Eventos;
