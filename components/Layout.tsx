
import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserRole, AppConfig, User } from '../types';
import { hasRole } from '../services/authUtils';
import { db } from '../services/dbService';

import GlobalPlayer from './GlobalPlayer';
import DrawerMenu from './DrawerMenu';
import { useAudio } from '../contexts/AudioContext';
import {
    Menu, Moon, Sun,
    Home, Users, BarChart, Info, Book, Settings,
    FileText, Heart, HeartHandshake, ChevronDown, LogOut
} from 'lucide-react';

interface LayoutProps {
    children: React.ReactNode;
    userRole: UserRole | null;
    currentUser?: User | null;
    onLogout?: () => void;
    appConfig: AppConfig;
    onToggleTheme?: () => void;
    onVolunteerClick?: () => void;
}

const roleTranslations: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]: 'ADMINISTRADOR CENTRAL',
    [UserRole.ADMIN_PUNTO]: 'Encargado: Punto de Información',
    [UserRole.ADMIN_GROUPS]: 'Encargado: GCX',
    [UserRole.ADMIN_STORE]: 'ADMINISTRADOR: STORE',
    [UserRole.ADMIN_ALABANZA]: 'ADMINISTRADOR: ALABANZA',
    [UserRole.PASTOR]: 'PASTOR',
    [UserRole.ANFITRION]: 'ANFITRIÓN',
    [UserRole.CO_ANFITRION]: 'CO-ANFITRIÓN',
    [UserRole.VIEWER]: 'USUARIO COMÚN',
    [UserRole.VOLUNTEER]: 'VOLUNTARIO',
    [UserRole.VOLUNTARIO]: 'VOLUNTARIO',
    [UserRole.VOLUNTARIO_INFO]: 'VOLUNTARIO: PUNTO INFO',
    [UserRole.VOLUNTARIO_GRUPOS]: 'VOLUNTARIO: GRUPOS',
    [UserRole.ENCARGADO_PUNTO]: 'ENCARGADO: PUNTO',
    [UserRole.ENCARGADO_GRUPOS]: 'ENCARGADO: GRUPOS',
    [UserRole.ENCARGADO_STORE]: 'ENCARGADO: STORE',
    [UserRole.ENCARGADO_ALABANZA]: 'ENCARGADO: ALABANZA',
    [UserRole.USUARIO]: 'USUARIO',
    [UserRole.REPORTES]: 'REPORTES',
    [UserRole.COORDINATOR]: 'COORDINADOR',
    [UserRole.ENCARGADO_BIENVENIDA]: 'ENCARGADO: BIENVENIDA',
    [UserRole.VOLUNTARIO_BIENVENIDA]: 'VOL. BIENVENIDA'
};

interface SidebarItem {
    label: string;
    icon: React.ElementType;
    path?: string;
    roles?: UserRole[];
    subItems?: { label: string; path: string; roles?: UserRole[] }[];
}

const sidebarData: SidebarItem[] = [
    { label: 'Inicio', icon: Home, path: '/', roles: [] },
    { label: 'Mis grupos', icon: Users, path: '/host-dashboard', roles: [UserRole.ANFITRION] },
    {
        label: 'Coordinadores', icon: Users, path: '/coordinators',
        roles: [UserRole.SUPER_ADMIN, UserRole.COORDINATOR],
        subItems: [
            { label: 'Dashboard', path: '/coordinators?tab=dashboard' },
            { label: 'Grupos', path: '/coordinators?tab=groups' },
            { label: 'Asistencias', path: '/coordinators?tab=attendance' },
            { label: 'Calendario', path: '/coordinators?tab=calendar' }
        ]
    },
    {
        label: 'GCX', icon: BarChart, path: '/groups', roles: [],
        subItems: [
            { label: 'Gestión', path: '/groups?tab=GROUPS', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS, UserRole.ENCARGADO_GRUPOS] },
            { label: 'Anfitriones', path: '/groups?tab=HOSTS', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS, UserRole.ENCARGADO_GRUPOS] },
            { label: 'Coordinadores', path: '/groups?tab=COORDINATORS', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS] },
            { label: 'Categorías', path: '/groups?tab=CATEGORIES', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS] },
            { label: 'Etiquetas', path: '/groups?tab=TAGS', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS] },
            { label: 'Configuración', path: '/groups?tab=CONFIG', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS] }
        ]
    },
    {
        label: 'Punto de información', icon: Info, path: '/info-point',
        roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO],
        subItems: [
            { label: 'Dashboard', path: '/info-point?view=PANEL' },
            { label: 'Buscar', path: '/info-point?view=SEARCH' },
            { label: 'Inventario', path: '/info-point?view=INVENTORY' },
            { label: 'Nuevo Producto', path: '/info-point?view=NEW_PRODUCT' },
            { label: 'Movimientos', path: '/info-point?view=MOVEMENTS' },
            { label: 'Eventos', path: '/info-point?view=EVENTS' },
            { label: 'Préstamos', path: '/info-point?view=LOANS' },
            { label: 'Bautismos', path: '/info-point?view=BAPTISMS' },
            { label: 'Presentaciones', path: '/info-point?view=PRESENTATIONS' },
            { label: 'Anuncios', path: '/info-point?view=ANNOUNCEMENTS' },
            { label: 'Configuración', path: '/info-point?view=ADMIN_PANEL', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO] },
        ]
    },
    {
        label: 'Reportes', icon: FileText, path: '/pastores',
        roles: [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.REPORTES, UserRole.ADMIN_GROUPS, UserRole.ENCARGADO_GRUPOS, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO],
        subItems: [
            { label: 'Grupos de conexión', path: '/pastores?tab=GROUPS', roles: [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.REPORTES, UserRole.ADMIN_GROUPS, UserRole.ENCARGADO_GRUPOS] },
            { label: 'Punto de información', path: '/pastores?tab=INFO', roles: [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.REPORTES, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO] }
        ]
    },
    {
        label: 'Bienvenida', icon: Heart, path: '/welcome',
        roles: [UserRole.SUPER_ADMIN, UserRole.ENCARGADO_BIENVENIDA, UserRole.VOLUNTARIO_BIENVENIDA],
        subItems: [
            { label: 'Incompletos', path: '/welcome?stage=NEW' },
            { label: 'Form Lleno', path: '/welcome?stage=FILLED_FORM' },
            { label: '2° Contacto', path: '/welcome?stage=SECOND_CONTACT' },
            { label: '3° Contacto', path: '/welcome?stage=THIRD_CONTACT' },
            { label: 'Int. Crecer', path: '/welcome?stage=INTERESTED_GROWTH' },
            { label: 'Creciendo', path: '/welcome?stage=DOING_GROWTH' },
            { label: 'Entrenamiento', path: '/welcome?stage=DOING_TRAINING' },
            { label: 'Voluntarios', path: '/welcome?stage=VOLUNTEERS' },
            { label: 'No Respondió', path: '/welcome?stage=NO_RESPONSE' }
        ]
    },
    { label: 'Cuidado Pastoral', icon: HeartHandshake, path: '/pastoral-care', roles: [UserRole.SUPER_ADMIN, UserRole.PASTOR] },
    { label: 'Tutoriales', icon: Book, path: '/tutorials', roles: [] },
    {
        label: 'Sistemas', icon: Settings, path: '/admin', roles: [UserRole.SUPER_ADMIN],
        subItems: [
            { label: 'Usuarios', path: '/admin?tab=users' },
            { label: 'Configuración', path: '/admin?tab=config' },
            { label: 'Logs', path: '/admin?tab=logs' },
            { label: 'Base de datos', path: '/admin?tab=database' }
        ]
    }
];

const Layout: React.FC<LayoutProps> = ({ children, userRole, currentUser, onLogout, appConfig, onToggleTheme, onVolunteerClick }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { currentSong } = useAudio();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [expandedSidebarItems, setExpandedSidebarItems] = useState<string[]>([]);

    const isDashboard = location.pathname === '/';
    const isFullWidthPage = location.pathname === '/' || location.pathname === '/store' || location.pathname === '/groups' || location.pathname === '/info-point' || location.pathname === '/alabanza' || location.pathname.startsWith('/coordinators');

    const handleLogoutAction = () => {
        onLogout?.();
    };

    const toggleSidebarItem = (label: string) => {
        setExpandedSidebarItems(prev =>
            prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
        );
    };

    const roleLabel = useMemo(() => {
        if (!userRole) return '';
        if (currentUser?.roles && currentUser.roles.length > 0) {
            if (currentUser.roles.includes(UserRole.SUPER_ADMIN)) return roleTranslations[UserRole.SUPER_ADMIN];
            if (currentUser.roles.includes(UserRole.PASTOR)) return roleTranslations[UserRole.PASTOR];
            if (currentUser.roles.includes(UserRole.ADMIN_GROUPS)) return roleTranslations[UserRole.ADMIN_GROUPS];
            if (currentUser.roles.includes(UserRole.ADMIN_PUNTO)) return roleTranslations[UserRole.ADMIN_PUNTO];
            if (currentUser.roles.includes(UserRole.ENCARGADO_PUNTO)) return roleTranslations[UserRole.ENCARGADO_PUNTO];
            if (currentUser.roles.includes(UserRole.ENCARGADO_GRUPOS)) return roleTranslations[UserRole.ENCARGADO_GRUPOS];
            if (currentUser.roles.includes(UserRole.VOLUNTARIO_INFO)) return roleTranslations[UserRole.VOLUNTARIO_INFO];
            if (currentUser.roles.includes(UserRole.VOLUNTARIO_GRUPOS)) return roleTranslations[UserRole.VOLUNTARIO_GRUPOS];
            if (currentUser.roles.includes(UserRole.VOLUNTEER)) return roleTranslations[UserRole.VOLUNTEER];
            if (currentUser.roles.includes(UserRole.VOLUNTARIO)) return roleTranslations[UserRole.VOLUNTARIO];
            if (currentUser.roles.includes(UserRole.ANFITRION)) return roleTranslations[UserRole.ANFITRION];
        }
        if (userRole === UserRole.ANFITRION && currentUser) {
            if (currentUser.volunteerRoles?.includes('STORE') || currentUser.linkedGroupId === 'STORE') return 'VOLUNTARIO (STORE)';
            if (currentUser.volunteerRoles?.includes('PUNTO') || currentUser.linkedGroupId === 'PUNTO') return 'VOLUNTARIO (PUNTO)';
            if (currentUser.volunteerRoles?.includes('GROUPS') || currentUser.linkedGroupId === 'GROUPS') return 'VOLUNTARIO (GRUPOS)';
            return 'ANFITRIÓN';
        }
        return roleTranslations[userRole] || userRole;
    }, [userRole, currentUser]);

    const renderModuleBackground = () => {
        const modules = db.getModules();
        const currentModule = modules.find(m => location.pathname.startsWith(m.route) && m.route !== '/');
        const bgConfig = currentModule?.background || { type: 'default', value: '', overlayOpacity: 0 };
        if (bgConfig.type === 'default') return null;
        const style: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: 'none' };
        if (bgConfig.type === 'image' && bgConfig.value) {
            style.backgroundImage = `url(${bgConfig.value})`;
            style.backgroundSize = 'cover';
            style.backgroundPosition = 'center';
            style.backgroundAttachment = 'fixed';
        } else if (bgConfig.type === 'color' && bgConfig.value) {
            if (bgConfig.value.startsWith('bg-') || bgConfig.value.startsWith('from-')) {
                return (
                    <div className={`fixed inset-0 z-0 pointer-events-none ${bgConfig.value}`}>
                        {bgConfig.overlayOpacity > 0 && (
                            <div className="absolute inset-0 bg-black transition-opacity duration-300" style={{ opacity: bgConfig.overlayOpacity }}></div>
                        )}
                    </div>
                );
            } else {
                style.background = bgConfig.value;
            }
        }
        return (
            <div style={style}>
                {bgConfig.overlayOpacity > 0 && (
                    <div className="absolute inset-0 bg-black transition-opacity duration-300" style={{ opacity: bgConfig.overlayOpacity }}></div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen flex font-sans text-slate-900 dark:text-white bg-slate-50 dark:bg-black transition-colors duration-300 relative">

            {/* ============================================================ */}
            {/* MOBILE: Hamburger Drawer (hidden on md+)                     */}
            {/* ============================================================ */}
            <DrawerMenu
                isOpen={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                currentUser={currentUser}
                onLogout={handleLogoutAction}
                isDarkMode={false}
                onToggleTheme={onToggleTheme}
            />

            {/* ============================================================ */}
            {/* DESKTOP: Fixed Left Sidebar (hidden on mobile, visible md+)  */}
            {/* ============================================================ */}
            <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-64 md:z-40 bg-white dark:bg-zinc-950 border-r border-slate-200 dark:border-zinc-800 transition-colors duration-300">

                {/* Sidebar Logo */}
                <div className="h-16 flex items-center px-5 border-b border-slate-200 dark:border-zinc-800 shrink-0">
                    <Link to="/" className="flex items-center gap-3">
                        <img
                            src="/origen-logo.png"
                            alt="Origen"
                            className="h-8 w-auto object-contain dark:invert"
                        />
                    </Link>
                </div>

                {/* Sidebar Nav Items */}
                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
                    {sidebarData.map((item, index) => {
                        // Role visibility check
                        if (currentUser && item.roles && item.roles.length > 0 && !hasRole(currentUser, item.roles)) return null;
                        if (item.path === '/host-dashboard' && !currentUser) return null;

                        const isActive = (item.path === '/' && location.pathname === '/') ||
                            (item.path !== '/' && item.path && location.pathname.startsWith(item.path));

                        const visibleSubItems = item.subItems?.filter(sub => {
                            if (!currentUser) return false;
                            if (!sub.roles || sub.roles.length === 0) return true;
                            return hasRole(currentUser, sub.roles);
                        }) || [];

                        const hasSubItems = visibleSubItems.length > 0;
                        const isExpanded = expandedSidebarItems.includes(item.label) || isActive;

                        return (
                            <div key={index}>
                                {/* Main Item */}
                                <div className={`flex items-center rounded-lg group transition-all duration-150 ${isActive
                                    ? 'bg-black text-white dark:bg-white dark:text-black'
                                    : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-black dark:hover:text-white'
                                    }`}>
                                    <button
                                        onClick={() => {
                                            if (item.path) navigate(item.path);
                                            if (hasSubItems) toggleSidebarItem(item.label);
                                        }}
                                        className="flex-1 flex items-center gap-3 px-3 py-2.5 text-left"
                                    >
                                        <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white dark:text-black' : 'text-slate-500 dark:text-zinc-400 group-hover:text-black dark:group-hover:text-white'}`} />
                                        <span className={`text-sm font-semibold truncate ${isActive ? 'font-bold' : ''}`}>{item.label}</span>
                                    </button>
                                    {hasSubItems && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleSidebarItem(item.label); }}
                                            className="pr-3 py-2.5 shrink-0"
                                        >
                                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} ${isActive ? 'text-white dark:text-black' : 'text-slate-400'}`} />
                                        </button>
                                    )}
                                </div>

                                {/* Sub Items */}
                                {hasSubItems && isExpanded && (
                                    <div className="ml-4 pl-3 border-l border-slate-200 dark:border-zinc-700 mt-0.5 mb-1 space-y-0.5">
                                        {visibleSubItems.map((sub, si) => {
                                            const isSubActive = (location.pathname + location.search) === sub.path ||
                                                location.search && sub.path.includes(location.search);
                                            return (
                                                <button
                                                    key={si}
                                                    onClick={() => navigate(sub.path)}
                                                    className={`w-full text-left px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-100 ${isSubActive
                                                        ? 'bg-slate-900 text-white dark:bg-white dark:text-black'
                                                        : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-black dark:hover:text-white'
                                                        }`}
                                                >
                                                    {sub.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>

                {/* Sidebar Footer: User Info + Logout */}
                <div className="shrink-0 border-t border-slate-200 dark:border-zinc-800 p-4 space-y-3">
                    {currentUser && (
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-black text-xs shrink-0">
                                {currentUser.name ? currentUser.name.substring(0, 2).toUpperCase() : 'US'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser.name}</p>
                                <p className="text-[10px] text-slate-500 dark:text-zinc-500 truncate">{roleLabel}</p>
                            </div>
                        </div>
                    )}
                    {onToggleTheme && (
                        <button
                            onClick={onToggleTheme}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-black dark:hover:text-white transition-colors"
                        >
                            <Sun className="h-3.5 w-3.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                            <Moon className="absolute h-3.5 w-3.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                            <span>Alternar tema</span>
                        </button>
                    )}
                    {currentUser && (
                        <button
                            onClick={handleLogoutAction}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Cerrar Sesión</span>
                        </button>
                    )}
                </div>
            </aside>

            {/* ============================================================ */}
            {/* RIGHT SIDE: Top navbar + Main content                         */}
            {/* ============================================================ */}
            <div className="flex-1 flex flex-col min-w-0 md:ml-64">

                {renderModuleBackground()}

                {/* Navbar - shown on all sizes; hamburger hidden on md+ */}
                <nav className="sticky top-0 z-30 w-full bg-white/95 dark:bg-black/95 backdrop-blur-sm border-b border-slate-200 dark:border-zinc-800 transition-colors duration-300">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between h-16">

                            {/* Left: Hamburger (mobile only) + portal */}
                            <div className="flex-1 flex items-center gap-2 sm:gap-4">
                                {/* Hamburger: only visible on mobile */}
                                <button
                                    id="hamburger-menu-btn"
                                    onClick={() => setIsMenuOpen(true)}
                                    className="md:hidden flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-100 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all group"
                                    aria-label="Abrir menú"
                                >
                                    <Menu className="w-5 h-5 transition-transform group-hover:scale-110" />
                                </button>

                                {!isDashboard && (
                                    <div id="navbar-portal" className="hidden md:flex items-center ml-2"></div>
                                )}

                                {!userRole && onVolunteerClick && (
                                    <div className="hidden md:flex items-center pl-4 h-8 my-auto animate-fadeIn">
                                        <button
                                            onClick={onVolunteerClick}
                                            className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-600 hover:bg-black hover:text-white hover:border-black transition-all group uppercase tracking-wider"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                            </svg>
                                            <span>Voluntarios</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Center: Logo (mobile only — desktop logo is in sidebar) */}
                            <div className="flex-1 flex items-center justify-center md:justify-start">
                                <Link to="/" className="flex items-center md:hidden">
                                    <img
                                        src="/origen-logo.png"
                                        alt="Logo"
                                        className="h-10 sm:h-14 w-auto object-contain dark:invert transition-all"
                                    />
                                </Link>
                                {/* Desktop: breadcrumb / page title area (empty by default) */}
                                <div className="hidden md:block" />
                            </div>

                            {/* Right: Theme toggle + Login controls */}
                            <div className="flex-1 flex items-center gap-2 sm:gap-4 justify-end">
                                {onToggleTheme && (
                                    <button
                                        onClick={onToggleTheme}
                                        className="md:hidden p-2 rounded-full text-slate-500 hover:text-black dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
                                        aria-label="Alternar tema"
                                    >
                                        <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                                        <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 top-2" />
                                    </button>
                                )}
                                <div className="flex items-center gap-3">
                                    {!currentUser && (
                                        <div className="hidden md:flex items-center gap-2">
                                            <button className="text-sm font-bold text-slate-500 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors uppercase tracking-wider">
                                                Ingresar
                                            </button>
                                            <button className="px-5 py-2 rounded-full bg-black text-white dark:bg-white dark:text-black text-sm font-bold uppercase tracking-wider hover:bg-slate-800 dark:hover:bg-zinc-200 transition-colors shadow-lg shadow-slate-200 dark:shadow-zinc-900/50">
                                                Registrarse
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                </nav>

                {/* Main Content */}
                <main
                    id="main-content"
                    className={`flex-1 w-full mx-auto animate-fadeIn relative z-10 ${!isFullWidthPage ? 'max-w-7xl px-4 sm:px-6 lg:px-8 py-8' : ''} ${currentSong ? 'pb-32' : 'pb-8'}`}
                    role="main"
                >
                    {children}
                </main>

                {/* Global Player persistent across routes */}
                <GlobalPlayer />

            </div>
        </div>
    );
};

export default Layout;
