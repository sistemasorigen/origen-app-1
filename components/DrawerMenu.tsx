import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    X,
    Menu,
    Home,
    Users,
    BarChart,
    Info,
    Book,
    Settings,
    FileText,
    Heart,
    HeartHandshake,
    ChevronDown,
    ChevronRight,
    LogOut,
    Sun,
    Moon
} from 'lucide-react';
import { User, UserRole } from '../types';
import { hasRole } from '../services/authUtils';

interface DrawerMenuProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: User | null;
    onLogout: () => void;
    isDarkMode?: boolean;
    onToggleTheme?: () => void;
    type?: 'drawer' | 'sidebar';
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
}

export const HamburgerButton: React.FC<{
    onClick: () => void;
    className?: string;
}> = ({ onClick, className = "" }) => (
    <button
        id="hamburger-menu-btn"
        onClick={onClick}
        className={`flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-100 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all group ${className}`}
        aria-label="Menú"
    >
        <Menu className="w-5 h-5 transition-transform group-hover:scale-110" />
    </button>
);

interface MenuItem {
    label: string;
    icon: React.ElementType;
    path?: string;
    roles?: UserRole[];
    subItems?: SubMenuItem[];
    action?: () => void;
}

interface SubMenuItem {
    label: string;
    path: string;
    roles?: UserRole[];
}

const DrawerMenu: React.FC<DrawerMenuProps> = ({
    isOpen,
    onClose,
    currentUser,
    onLogout,
    isDarkMode,
    onToggleTheme,
    type = 'drawer',
    isCollapsed = false,
    onToggleCollapse
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [expandedItems, setExpandedItems] = useState<string[]>([]);
    const [shouldRender, setShouldRender] = useState(false);

    // Handle animation mounting
    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
        } else {
            const timer = setTimeout(() => setShouldRender(false), 500);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Prevent body scroll when menu is open (only for mobile drawer)
    useEffect(() => {
        if (type === 'drawer' && isOpen) {
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none'; // Prevent touch gestures on background
            document.documentElement.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
            document.documentElement.style.overflow = '';
            // Collapse all items when closing
            if (!shouldRender) setExpandedItems([]);
        }
        return () => {
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
            document.documentElement.style.overflow = '';
        };
    }, [isOpen, shouldRender]);

    const toggleExpand = (label: string) => {
        setExpandedItems(prev =>
            prev.includes(label)
                ? prev.filter(item => item !== label)
                : [...prev, label]
        );
    };

    const handleNavigation = (path: string) => {
        navigate(path);
        onClose();
    };

    const menuData: MenuItem[] = [
        {
            label: 'Inicio',
            icon: Home,
            path: '/',
            roles: [] // Visible to everyone
        },
        {
            label: 'Mis grupos',
            icon: Users,
            path: '/host-dashboard',
            roles: [UserRole.ANFITRION, UserRole.CO_ANFITRION]
        },
        {
            label: 'Coordinadores',
            icon: Users,
            path: '/coordinators', // Default path if clicked
            roles: [UserRole.SUPER_ADMIN, UserRole.COORDINATOR],
            subItems: [
                { label: 'Dashboard', path: '/coordinators?tab=dashboard' },
                { label: 'Grupos', path: '/coordinators?tab=groups' },
                { label: 'Asistencias', path: '/coordinators?tab=attendance' },
                { label: 'Calendario', path: '/coordinators?tab=calendar' }
            ]
        },
        {
            label: 'GCX',
            icon: BarChart,
            path: '/groups',
            roles: [], // Visible to everyone
            subItems: [
                {
                    label: 'Gestión',
                    path: '/groups?tab=GROUPS',
                    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS, UserRole.ENCARGADO_GRUPOS]
                },
                {
                    label: 'Anfitriones',
                    path: '/groups?tab=HOSTS',
                    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS, UserRole.ENCARGADO_GRUPOS]
                },
                { label: 'Coordinadores', path: '/groups?tab=COORDINATORS', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS] },
                { label: 'Categorías', path: '/groups?tab=CATEGORIES', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS] },
                { label: 'Etiquetas', path: '/groups?tab=TAGS', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS] },
                { label: 'Configuración', path: '/groups?tab=CONFIG', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS] }
            ]
        },
        {
            label: 'Punto de información',
            icon: Info,
            path: '/info-point',
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
            label: 'Reportes',
            icon: FileText,
            path: '/pastores',
            roles: [
                UserRole.SUPER_ADMIN,
                UserRole.PASTOR,
                UserRole.REPORTES,
                UserRole.ADMIN_GROUPS,
                UserRole.ENCARGADO_GRUPOS,
                UserRole.ADMIN_PUNTO,
                UserRole.ENCARGADO_PUNTO
            ],
            subItems: [
                {
                    label: 'Grupos de conexión',
                    path: '/pastores?tab=GROUPS',
                    roles: [
                        UserRole.SUPER_ADMIN,
                        UserRole.PASTOR,
                        UserRole.REPORTES,
                        UserRole.ADMIN_GROUPS,
                        UserRole.ENCARGADO_GRUPOS
                    ]
                },
                {
                    label: 'Punto de información',
                    path: '/pastores?tab=INFO',
                    roles: [
                        UserRole.SUPER_ADMIN,
                        UserRole.PASTOR,
                        UserRole.REPORTES,
                        UserRole.ADMIN_PUNTO,
                        UserRole.ENCARGADO_PUNTO
                    ]
                }
            ]
        },
        {
            label: 'Bienvenida',
            icon: Heart,
            path: '/welcome',
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
        {
            label: 'Cuidado Pastoral',
            icon: HeartHandshake,
            path: '/pastoral-care',
            roles: [UserRole.SUPER_ADMIN, UserRole.PASTOR]
        },
        {
            label: 'Tutoriales',
            icon: Book,
            path: '/tutorials',
            roles: []
        },
        {
            label: 'Sistemas',
            icon: Settings,
            path: '/admin',
            roles: [UserRole.SUPER_ADMIN],
            subItems: [
                { label: 'Usuarios', path: '/admin?tab=users' },
                { label: 'Configuración', path: '/admin?tab=config' },
                { label: 'Logs', path: '/admin?tab=logs' },
                { label: 'Base de datos', path: '/admin?tab=database' }
            ]
        }
    ];

    if (!shouldRender && type === 'drawer') return null;

    const isSidebar = type === 'sidebar';

    const SidebarContent = (
        <div
            className={`flex flex-col h-full bg-white dark:bg-zinc-950 border-r border-slate-200 dark:border-zinc-800 transition-all duration-300 ${isSidebar ? (isCollapsed ? 'w-20' : 'w-64') : 'w-full'}`}
        >
            {/* Header */}
            <div className={`h-16 flex items-center border-b border-gray-100/50 dark:border-zinc-800 shrink-0 ${isCollapsed ? 'justify-center px-0' : 'px-5 justify-start'}`}>
                {isSidebar ? (
                    <HamburgerButton onClick={onToggleCollapse || (() => { })} className="!bg-transparent !border-none hover:!bg-black/5" />
                ) : (
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-black/5 transition-colors group"
                    >
                        <X className="w-6 h-6 text-black dark:text-white group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                )}
            </div>

            {/* Menu Items */}
            <nav className={`flex-1 overflow-y-auto py-4 space-y-1 ${isCollapsed ? 'px-2' : 'px-4'}`}>
                {menuData.map((item, index) => {
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
                    const isExpanded = expandedItems.includes(item.label) || (isActive && !isCollapsed);

                    return (
                        <div key={index} title={isCollapsed ? item.label : undefined}>
                            <div className={`flex items-center rounded-xl transition-all duration-200 group ${isActive
                                ? 'bg-black text-white dark:bg-white dark:text-black shadow-lg shadow-black/10'
                                : isExpanded && !isCollapsed ? 'bg-black text-white' : 'text-gray-700 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
                                } ${isCollapsed ? 'justify-center mx-1' : ''}`}>
                                <button
                                    onClick={() => {
                                        if (item.path) handleNavigation(item.path);
                                        if (hasSubItems && !isCollapsed) toggleExpand(item.label);
                                        if (hasSubItems && isCollapsed && onToggleCollapse) onToggleCollapse();
                                    }}
                                    className={`flex-1 flex items-center gap-3 py-2.5 text-left ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}
                                >
                                    <item.icon className={`w-5 h-5 shrink-0 transition-colors ${isActive ? (isDarkMode ? 'text-black' : 'text-white dark:text-black') : 'text-gray-500 dark:text-zinc-500 group-hover:text-black dark:group-hover:text-white'}`} />
                                    {!isCollapsed && <span className="text-sm font-bold truncate">{item.label}</span>}
                                </button>
                                {!isCollapsed && hasSubItems && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); toggleExpand(item.label); }}
                                        className="pr-3 py-2.5 shrink-0"
                                    >
                                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} ${isActive ? 'text-white dark:text-black' : 'text-gray-400'}`} />
                                    </button>
                                )}
                            </div>

                            {!isCollapsed && hasSubItems && isExpanded && (
                                <div className="ml-6 pl-2 border-l border-gray-100 dark:border-zinc-800 mt-1 mb-2 space-y-1">
                                    {visibleSubItems.map((sub, si) => {
                                        const isSubActive = (location.pathname + location.search) === sub.path;
                                        return (
                                            <button
                                                key={si}
                                                onClick={() => handleNavigation(sub.path)}
                                                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${isSubActive
                                                    ? 'bg-black text-white dark:bg-white dark:text-black'
                                                    : 'text-gray-500 dark:text-zinc-500 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-black dark:hover:text-white'
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

            {/* Footer */}
            <div className={`p-4 border-t border-gray-100 dark:border-zinc-800 space-y-3 ${isCollapsed ? 'flex flex-col items-center px-2' : ''}`}>
                {currentUser && (
                    <div className={`flex items-center gap-3 px-1 ${isCollapsed ? 'justify-center cursor-pointer' : ''}`} title={isCollapsed ? currentUser.name : undefined}>
                        <div className="w-8 h-8 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-black text-xs shrink-0">
                            {currentUser.name ? currentUser.name.substring(0, 2).toUpperCase() : 'US'}
                        </div>
                        {!isCollapsed && (
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{currentUser.name}</p>
                                <p className="text-[10px] text-gray-500 dark:text-zinc-500 truncate">{currentUser.email}</p>
                            </div>
                        )}
                    </div>
                )}
                <div className="space-y-1 w-full">
                    {onToggleTheme && (
                        <button
                            onClick={onToggleTheme}
                            className={`w-full flex items-center gap-3 rounded-xl transition-all text-gray-600 dark:text-zinc-400 font-bold text-xs ${isCollapsed ? 'justify-center p-2' : 'px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800'}`}
                            title={isCollapsed ? "Alternar tema" : undefined}
                        >
                            <div className="relative w-4 h-4 flex items-center justify-center shrink-0">
                                <Sun className="absolute h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                            </div>
                            {!isCollapsed && <span>{isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>}
                        </button>
                    )}
                    {currentUser ? (
                        <button
                            onClick={() => { onLogout(); onClose(); }}
                            className={`w-full flex items-center gap-3 rounded-xl text-red-600 transition-all font-bold text-xs ${isCollapsed ? 'justify-center p-2' : 'px-3 py-2 hover:bg-red-50 dark:hover:bg-red-950/20'}`}
                            title={isCollapsed ? "Cerrar Sesión" : undefined}
                        >
                            <LogOut className="w-4 h-4 shrink-0" />
                            {!isCollapsed && <span>Cerrar Sesión</span>}
                        </button>
                    ) : (
                        !isCollapsed && (
                            <button
                                onClick={() => { handleNavigation('/login'); }}
                                className="w-full p-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs font-bold shadow-md hover:shadow-lg transition-all"
                            >
                                Iniciar Sesión
                            </button>
                        )
                    )}
                </div>
            </div>
        </div>
    );

    if (type === 'sidebar') {
        return (
            <aside className={`hidden md:block fixed inset-y-0 left-0 z-40 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
                {SidebarContent}
            </aside>
        );
    }

    return (
        <div className={`fixed inset-0 z-[60] flex justify-start md:hidden ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-500 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            />

            {/* Drawer Panel */}
            <div
                className={`relative w-[85vw] sm:w-[350px] h-full shadow-[-10px_0_20px_rgba(0,0,0,0.1)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
                style={{ touchAction: 'auto' }}
            >
                {SidebarContent}
            </div>
        </div>
    );
};

export default DrawerMenu;
