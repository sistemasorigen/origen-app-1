import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTutorial } from '../../src/hooks/useTutorial';
import { Sparkles, LayoutDashboard, Users, Home, Info, CheckCircle, Circle } from 'lucide-react';
import { hasRole } from '../../services/authUtils';
import { UserRole } from '../../types';

const TUTORIALS = [
    {
        id: 'dashboard',
        title: 'Panel Principal',
        description: 'Navegación básica, notificaciones y acceso a módulos.',
        icon: LayoutDashboard,
        path: '/dashboard?restartTutorial=true',
        color: 'bg-indigo-500'
    },
    {
        id: 'groups',
        title: 'Explorar Grupos',
        description: 'Cómo buscar, filtrar y unirte a grupos de conexión.',
        icon: Users,
        path: '/groups?restartTutorial=true',
        color: 'bg-purple-500'
    },
    {
        id: 'host',
        title: 'Panel de Anfitrión',
        description: 'Guía para líderes: crear grupos, gestionar miembros y asistencia.',
        icon: Home,
        path: '/host-dashboard?restartTutorial=true',
        color: 'bg-pink-500',
        roles: [UserRole.ANFITRION, UserRole.ADMIN_GROUPS, UserRole.SUPER_ADMIN]
    },
    {
        id: 'createGroup',
        title: 'Crear Grupo',
        description: 'Paso a paso para configurar un nuevo Grupo de Conexión.',
        icon: Users,
        path: '/host-dashboard?restartTutorial=true&modal=createGroup',
        color: 'bg-green-500',
        roles: [UserRole.ANFITRION, UserRole.ADMIN_GROUPS, UserRole.SUPER_ADMIN]
    },
    {
        id: 'welcome',
        title: 'Bienvenida',
        description: 'Gestión de nuevos visitantes y seguimiento de integración.',
        icon: Sparkles,
        path: '/welcome?restartTutorial=true',
        color: 'bg-yellow-500',
        roles: [UserRole.ENCARGADO_BIENVENIDA, UserRole.VOLUNTARIO_BIENVENIDA, UserRole.SUPER_ADMIN]
    },

];

const TutorialCard: React.FC<{ tutorial: typeof TUTORIALS[0], delay: string }> = ({ tutorial, delay }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    // Use the hook for specific tutorial logic (reset, verify)
    const { resetTutorial } = useTutorial(tutorial.id);

    // Safe access to progress for UI state
    const progress = (user as any)?.tutorial_progress || {};
    const isCompleted = !!progress[tutorial.id];
    const Icon = tutorial.icon;

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();

        if (isCompleted) {
            // If completed, RESET first, then navigate
            await resetTutorial();
        }

        // Navigate to the tutorial path
        navigate(tutorial.path);
    };

    return (
        <div
            onClick={handleClick}
            className="group relative cursor-pointer border-[3px] border-black dark:border-white bg-white dark:bg-black p-6 flex flex-col justify-between min-h-[280px] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[12px_12px_0px_0px_rgba(255,255,255,0.3)] hover:-translate-y-1 hover:-translate-x-1 transition-all duration-200"
            style={{ animationDelay: delay }}
        >
            {/* Decorative Gradient Overlay on Hover */}
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 ${tutorial.color.replace('bg-', 'bg-')}`} />

            <div>
                <div className="flex items-start justify-between mb-6">
                    {/* Neo-Brutalist Icon Box */}
                    <div className={`w-14 h-14 border-[3px] border-black dark:border-white flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] group-hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:group-hover:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] transition-all bg-white dark:bg-black`}>
                        <Icon className="w-7 h-7 text-black dark:text-white" />
                    </div>

                    {/* Status Badge */}
                    {isCompleted ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-400 border-[2px] border-black text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Listo
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 dark:bg-gray-800 border-[2px] border-black dark:border-gray-500 text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            <Circle className="w-3.5 h-3.5" />
                            Pendiente
                        </span>
                    )}
                </div>

                <h3 className="text-2xl font-black text-black dark:text-white mb-3 uppercase leading-none tracking-tight">
                    {tutorial.title}
                </h3>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
                    {tutorial.description}
                </p>
            </div>

            <div className="mt-auto pt-4 border-t-2 border-dashed border-gray-300 dark:border-gray-700 group-hover:border-black dark:group-hover:border-white transition-colors">
                <span className="flex items-center gap-2 text-sm font-black uppercase text-black dark:text-white group-hover:translate-x-2 transition-transform">
                    {isCompleted ? 'Repasar Tutorial' : 'Comenzar'}
                    <span className="text-xl">→</span>
                </span>
            </div>
        </div>
    );
};

const TutorialsPage: React.FC = () => {
    const { user } = useAuth();

    const visibleTutorials = TUTORIALS.filter(t => {
        if (!t.roles) return true;
        // @ts-ignore - Dynamic role check
        return hasRole(user, t.roles);
    });

    return (
        <div className="min-h-screen bg-white dark:bg-black p-4 md:p-8 font-sans selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">
            <div className="max-w-7xl mx-auto">
                <div className="mb-12 border-b-[3px] border-black dark:border-white pb-8">
                    <h1 className="text-4xl md:text-6xl font-black text-black dark:text-white mb-4 uppercase tracking-tighter">
                        Centro de <br className="hidden md:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">Aprendizaje</span>
                    </h1>
                    <p className="text-xl font-bold text-gray-600 dark:text-gray-400 max-w-2xl leading-relaxed">
                        Domina la plataforma Origen. Repasa los recorridos guiados y conviértete en un experto de tus herramientas.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {visibleTutorials.map((tutorial, idx) => (
                        <TutorialCard
                            key={tutorial.id}
                            tutorial={tutorial}
                            delay={`${idx * 0.1}s`}
                        />
                    ))}

                    {visibleTutorials.length === 0 && (
                        <div className="col-span-full py-12 text-center">
                            <p className="text-gray-500 italic">No hay tutoriales disponibles para tu rol actual.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TutorialsPage;
