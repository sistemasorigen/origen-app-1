import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, UserRole } from '../../types';
import { hasRole } from '../../services/authUtils';
import {
    CalendarDays, ChevronRight,
    Users, LayoutDashboard, Trophy
} from 'lucide-react';

interface PanelEventosProps {
    currentUser: User;
}

// Registro de paneles disponibles.
// Agregar aquí cada nuevo evento con panel propio.
const PANELES_EVENTOS = [
    {
        id: 'dia-del-padre',
        titulo: 'Día del Padre',
        descripcion: 'Gestión de inscripciones, puntos y ranking del evento.',
        ruta: '/eventos/admin/diadelpadre',
        icono: Users,
        color: '#F59E0B',  // amber
        roles: [
            UserRole.SUPER_ADMIN,
            UserRole.PASTOR,
            UserRole.ENCARGADO_EVENTOS,
        ]
    },
    {
        id:          'trivia',
        titulo:      'Trivia Origen',
        descripcion: 'Crear y gestionar juegos de trivia en vivo con PIN.',
        ruta:        '/trivia/admin',
        icono:       Trophy,
        color:       '#7C3AED',
        roles: [
            UserRole.SUPER_ADMIN,
            UserRole.PASTOR,
            UserRole.ENCARGADO_EVENTOS,
        ]
    },
];

const PanelEventos: React.FC<PanelEventosProps> = ({
    currentUser
}) => {
    const navigate = useNavigate();

    // Filtrar paneles accesibles según el rol
    const panelesVisibles = PANELES_EVENTOS.filter(p =>
        hasRole(currentUser, p.roles)
    );

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-4xl mx-auto
                px-4 md:px-8 py-10 md:py-14">

                {/* Header */}
                <div className="mb-8 pb-8
                    border-b border-gray-100">
                    <p className="text-[11px] font-medium
                        tracking-wide text-gray-400
                        uppercase mb-2">
                        Administración
                    </p>
                    <div className="flex items-center
                        justify-between gap-4">
                        <h1 className="text-3xl md:text-4xl
                            font-semibold text-gray-900
                            tracking-tight">
                            Panel de Eventos
                        </h1>
                        <LayoutDashboard
                            className="w-6 h-6 text-gray-300
                            shrink-0"
                            aria-hidden="true"
                        />
                    </div>
                    <p className="text-sm text-gray-400
                        font-normal mt-2">
                        Accedé al panel de administración
                        de cada evento.
                    </p>
                </div>

                {/* Sin acceso */}
                {panelesVisibles.length === 0 && (
                    <div className="flex flex-col
                        items-center justify-center
                        py-24 text-center">
                        <div className="w-14 h-14
                            rounded-2xl bg-gray-50
                            border border-gray-100
                            flex items-center
                            justify-center mb-4">
                            <CalendarDays
                                className="w-6 h-6
                                text-gray-300"
                                aria-hidden="true"
                            />
                        </div>
                        <p className="text-sm font-medium
                            text-gray-400">
                            No tenés paneles disponibles
                        </p>
                    </div>
                )}

                {/* Grid de paneles */}
                {panelesVisibles.length > 0 && (
                    <div className="grid grid-cols-1
                        sm:grid-cols-2 lg:grid-cols-3
                        gap-5">
                        {panelesVisibles.map(panel => {
                            const Icono = panel.icono;
                            return (
                                <button
                                    key={panel.id}
                                    type="button"
                                    onClick={() =>
                                        navigate(panel.ruta)
                                    }
                                    className="text-left
                                        bg-white rounded-2xl
                                        border border-gray-100
                                        shadow-[0_2px_8px_rgba(0,0,0,0.04)]
                                        p-6
                                        transition-all
                                        duration-200
                                        hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]
                                        hover:-translate-y-[2px]
                                        focus-visible:outline-none
                                        focus-visible:ring-2
                                        focus-visible:ring-gray-300
                                        focus-visible:ring-offset-2
                                        cursor-pointer
                                        flex flex-col gap-4"
                                >
                                    {/* Ícono con color */}
                                    <div
                                        className="w-11 h-11
                                            rounded-xl flex
                                            items-center
                                            justify-center"
                                        style={{
                                            backgroundColor:
                                                `${panel.color}18`
                                        }}
                                    >
                                        <Icono
                                            className="w-5 h-5"
                                            style={{
                                                color: panel.color
                                            }}
                                            aria-hidden="true"
                                        />
                                    </div>

                                    {/* Texto */}
                                    <div className="flex-1">
                                        <h3 className="text-base
                                            font-semibold
                                            text-gray-900
                                            tracking-tight
                                            mb-1">
                                            {panel.titulo}
                                        </h3>
                                        <p className="text-xs
                                            text-gray-400
                                            font-normal
                                            leading-relaxed">
                                            {panel.descripcion}
                                        </p>
                                    </div>

                                    {/* Flecha */}
                                    <div className="flex
                                        items-center gap-1
                                        text-xs font-medium
                                        text-gray-400">
                                        Ir al panel
                                        <ChevronRight
                                            className="w-3.5
                                            h-3.5"
                                            aria-hidden="true"
                                        />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PanelEventos;
