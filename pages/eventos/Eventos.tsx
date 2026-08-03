import React, { useState, useEffect } from 'react';
import { getEventosGeneralPublic } from '../../services/supabaseService';
import { EventoGeneral } from '../../types';
import { Calendar, Clock, CalendarDays, ExternalLink } from 'lucide-react';

const formatDate = (dateStr: string): string =>
    new Date(dateStr + 'T12:00:00')
        .toLocaleDateString('es-AR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });

interface EventCardProps {
    event: EventoGeneral;
}

// Card de evento — el flyer se muestra completo y sin recortar (w-full h-auto):
// es arte que trae su propio texto, así que la metadata va aparte, nunca superpuesta.
const EventCard: React.FC<EventCardProps> = ({ event }) => (
    <div className="rounded-2xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden bg-white">
        <div className="flex flex-col sm:flex-row">
            {event.imageUrl && (
                <div className="relative sm:w-64 md:w-80 shrink-0 bg-gray-50">
                    <img
                        src={event.imageUrl}
                        alt={event.name}
                        className="block w-full h-auto"
                    />
                </div>
            )}

            <div className="p-6 md:p-8 flex-1 min-w-0 flex flex-col justify-center">
                <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight leading-tight mb-3">
                    {event.name}
                </h2>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-gray-400 text-sm mb-4">
                    <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(event.startDate)}
                    </span>
                    {event.startTime && (
                        <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {event.startTime}{event.endTime && ` – ${event.endTime}`}
                        </span>
                    )}
                </div>

                {event.description && (
                    <p className="text-sm text-gray-500 leading-relaxed mb-5">
                        {event.description}
                    </p>
                )}

                {event.registrationLink && (
                    <a
                        href={event.registrationLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex self-start items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-black active:scale-[0.98] transition-all"
                    >
                        Inscribirse al evento <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                )}
            </div>
        </div>
    </div>
);

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

                {/* Todos los eventos — apilados en una sola lista */}
                {!loading && events.length > 0 && (
                    <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-5">
                            Próximos eventos
                        </p>

                        <div className="flex flex-col gap-5">
                            {events.map(event => (
                                <EventCard key={event.id} event={event} />
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default Eventos;
