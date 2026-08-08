import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HeroCarousel, { HeroSlideData } from '../../components/ui/CarruselHero';
import { getNinezBannerSlides, getEventosGeneralPublic } from '../../services/supabaseService';
import { EventoGeneral, User, UserRole } from '../../types';
import { hasRole } from '../../services/authUtils';
import { Calendar, Clock, ExternalLink, Settings, Baby, ChevronRight } from 'lucide-react';

interface NinezProps {
    currentUser: User | null;
}

interface BotoneraItem {
    id: string;
    titulo: string;
    descripcion: string;
    ruta: string;
    icono: React.ComponentType<{ className?: string }>;
    roles: UserRole[];
}

// Registro de accesos de administración de Niñez.
// Agregar acá cada nueva función de /admin-ninez/*.
const BOTONERA_NINEZ: BotoneraItem[] = [
    {
        id: 'configuracion',
        titulo: 'Configuración',
        descripcion: 'Editar el banner principal de la página de Niñez.',
        ruta: '/admin-ninez/configuracion',
        icono: Settings,
        roles: [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.ENCARGADO_NINEZ]
    },
];

const formatDate = (dateStr: string): string =>
    new Date(dateStr + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });

const Ninez: React.FC<NinezProps> = ({ currentUser }) => {
    const navigate = useNavigate();
    const [slides, setSlides] = useState<HeroSlideData[]>([]);
    const [events, setEvents] = useState<EventoGeneral[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([getNinezBannerSlides(), getEventosGeneralPublic()])
            .then(([bannerData, eventsData]) => {
                setSlides(bannerData.map(s => ({
                    id: s.id,
                    imageUrl: s.imageUrl,
                    title: s.title,
                    subtitle: s.subtitle
                })));
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                setEvents(eventsData.filter(e => new Date(e.startDate + 'T00:00:00') >= today).slice(0, 4));
            })
            .finally(() => setLoading(false));
    }, []);

    const botoneraVisible = BOTONERA_NINEZ.filter(item =>
        currentUser ? hasRole(currentUser, item.roles) : false
    );

    return (
        <div className="min-h-screen bg-white">

            {/* Hero */}
            {slides.length > 0 ? (
                <HeroCarousel slides={slides} heightClass="h-[50vh] md:h-[60vh]" theme="groups" />
            ) : (
                !loading && (
                    <div className="h-[30vh] flex items-center justify-center bg-slate-50 border-b border-slate-100">
                        <div className="text-center">
                            <Baby className="w-10 h-10 text-slate-300 mx-auto mb-2" aria-hidden="true" />
                            <p className="text-sm text-slate-400">Niñez</p>
                        </div>
                    </div>
                )
            )}

            <div className="max-w-4xl mx-auto px-4 md:px-8 py-10 space-y-12">

                {/* Próximos eventos */}
                {!loading && events.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Próximos eventos</h2>
                            <button
                                type="button"
                                onClick={() => navigate('/eventos')}
                                className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
                            >
                                Ver todos los eventos <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                        </div>

                        <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-3">
                            {events.map(event => (
                                <div
                                    key={event.id}
                                    className="min-w-[240px] md:min-w-0 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-[2px] transition-all duration-200"
                                >
                                    {event.imageUrl && (
                                        <div className="aspect-square overflow-hidden">
                                            <img src={event.imageUrl} alt={event.name} className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                    <div className="p-4">
                                        <h3 className="text-sm font-semibold text-gray-900 tracking-tight leading-snug mb-2 line-clamp-2">
                                            {event.name}
                                        </h3>
                                        <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                                            <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                            <span>{formatDate(event.startDate)}</span>
                                        </div>
                                        {event.startTime && (
                                            <div className="flex items-center gap-2 text-gray-400 text-xs">
                                                <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                                <span>{event.startTime}{event.endTime && ` – ${event.endTime}`}</span>
                                            </div>
                                        )}
                                        {event.registrationLink && (
                                            <a
                                                href={event.registrationLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-3 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-black transition-all"
                                            >
                                                Inscribirse <ExternalLink className="w-3 h-3" aria-hidden="true" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Botonera de accesos */}
                {botoneraVisible.length > 0 && (
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 tracking-tight mb-5">Administración</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {botoneraVisible.map(item => {
                                const Icon = item.icono;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => navigate(item.ruta)}
                                        className="flex items-start gap-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-[2px] transition-all duration-200 text-left"
                                    >
                                        <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                                            <Icon className="w-5 h-5 text-slate-700" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-gray-900 text-sm mb-1">{item.titulo}</p>
                                            <p className="text-xs text-gray-400 leading-relaxed">{item.descripcion}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Ninez;
