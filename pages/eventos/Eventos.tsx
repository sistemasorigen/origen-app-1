import React, { useState, useEffect } from 'react';
import { getEventosGeneralPublic } from '../../services/supabaseService';
import { EventoGeneral } from '../../types';
import { Calendar, Clock, CalendarDays, ExternalLink } from 'lucide-react';

const Eventos: React.FC = () => {
    const [events, setEvents] = useState<EventoGeneral[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getEventosGeneralPublic()
            .then(data => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                setEvents(data.filter(e => new Date(e.startDate + 'T00:00:00') >= today));
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
    const rest = events.slice(1);

    return (
        <div className="min-h-screen bg-white">
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
                                className="relative rounded-2xl overflow-hidden"
                                style={{ minHeight: 280 }}
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

                                    <h2 className="text-2xl md:text-3xl font-semibold text-white tracking-tight leading-tight mb-3">
                                        {featured.name}
                                    </h2>

                                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-white/70 text-sm mb-5">
                                        <span className="flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {formatDate(featured.startDate)}
                                        </span>
                                        {featured.startTime && (
                                            <span className="flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" />
                                                {featured.startTime}{featured.endTime && ` – ${featured.endTime}`}
                                            </span>
                                        )}
                                    </div>

                                    {featured.registrationLink && (
                                        <a
                                            href={featured.registrationLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex self-start items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-gray-900 text-sm font-semibold hover:bg-gray-100 active:scale-[0.98] transition-all"
                                        >
                                            Inscribirse al evento <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-8 md:p-10">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-900 text-[11px] font-semibold text-white mb-4">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" aria-hidden="true" />
                                    Próximo
                                </span>

                                <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight leading-tight mb-3">
                                    {featured.name}
                                </h2>

                                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-gray-400 text-sm mb-5">
                                    <span className="flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {formatDate(featured.startDate)}
                                    </span>
                                    {featured.startTime && (
                                        <span className="flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5" />
                                            {featured.startTime}{featured.endTime && ` – ${featured.endTime}`}
                                        </span>
                                    )}
                                </div>

                                {featured.description && (
                                    <p className="text-sm text-gray-500 leading-relaxed mb-5">
                                        {featured.description}
                                    </p>
                                )}

                                {featured.registrationLink && (
                                    <a
                                        href={featured.registrationLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-black active:scale-[0.98] transition-all"
                                    >
                                        Inscribirse al evento <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                )}
                            </div>
                        )}

                        {featured.imageUrl && featured.description && (
                            <p className="mt-4 text-sm text-gray-500 leading-relaxed">
                                {featured.description}
                            </p>
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
                                    className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-[2px]"
                                >
                                    {event.imageUrl && (
                                        <div className="aspect-square overflow-hidden">
                                            <img
                                                src={event.imageUrl}
                                                alt={event.name}
                                                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                                            />
                                        </div>
                                    )}

                                    <div className="p-5">
                                        <h3 className="text-base font-semibold text-gray-900 tracking-tight leading-snug mb-3 line-clamp-2">
                                            {event.name}
                                        </h3>

                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2 text-gray-400 text-xs">
                                                <Calendar className="w-3.5 h-3.5 shrink-0" />
                                                <span>{formatDate(event.startDate)}</span>
                                            </div>
                                            {event.startTime && (
                                                <div className="flex items-center gap-2 text-gray-400 text-xs">
                                                    <Clock className="w-3.5 h-3.5 shrink-0" />
                                                    <span>{event.startTime}{event.endTime && ` – ${event.endTime}`}</span>
                                                </div>
                                            )}
                                        </div>

                                        {event.description && (
                                            <p className="mt-3 text-xs text-gray-400 leading-relaxed line-clamp-2">
                                                {event.description}
                                            </p>
                                        )}

                                        {event.registrationLink && (
                                            <a
                                                href={event.registrationLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-4 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-900 text-white text-xs font-semibold rounded-lg transition-all hover:bg-black"
                                            >
                                                Inscribirse al evento <ExternalLink className="w-3 h-3" />
                                            </a>
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
