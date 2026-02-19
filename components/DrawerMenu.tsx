import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    X,
    Home,
    Users,
    BarChart,
    Info,
    Book,
    Settings,
    FileText,
    Heart,
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
}

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
    onToggleTheme
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

    // Prevent body scroll when menu is open
    useEffect(() => {
        if (isOpen) {
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
            roles: [UserRole.ANFITRION]
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

    if (!shouldRender) return null;

    return (
        <div className={`fixed inset-0 z-[60] flex justify-start ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-500 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            />

            {/* Drawer Panel */}
            <div
                className={`relative w-[85vw] sm:w-[350px] h-full bg-white/90 backdrop-blur-xl border-r border-white/20 shadow-[-10px_0_20px_rgba(0,0,0,0.1)] flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
                style={{ touchAction: 'auto' }} // Ensure touch actions work within the panel
            >
                {/* Header */}
                <div className="p-6 flex items-center justify-between border-b border-gray-100/50">
                    <h2 className="text-2xl font-black text-black tracking-tighter">MENÚ</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-black/5 transition-colors group"
                    >
                        <X className="w-6 h-6 text-black group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </div>

                {/* Menu Items */}
                <div
                    className="flex-1 overflow-y-auto py-4 px-4 space-y-2"
                    style={{ overscrollBehavior: 'contain' }} // Prevent scroll chain to background
                >
                    {menuData.map((item, index) => {
                        // Check visibility
                        if (currentUser && item.roles && item.roles.length > 0 && !hasRole(currentUser, item.roles)) {
                            return null;
                        }
                        // Start: Special check for HostDashboard
                        if (item.path === '/host-dashboard' && !currentUser) return null;
                        // End: Special check

                        // Check if active (Main Item)
                        // Active if:
                        // 1. Exact match for root '/'
                        // 2. Path starts with item.path (for non-root items)
                        // 3. One of its sub-items is active
                        const isActive = (item.path === '/' && location.pathname === '/') ||
                            (item.path !== '/' && item.path && location.pathname.startsWith(item.path)) ||
                            (item.subItems?.some(sub => location.pathname + location.search === sub.path));

                        const isExpanded = expandedItems.includes(item.label) || isActive; // Auto-expand if active? Maybe just keep manual expanion or auto-expand on load. 
                        // Let's keep manual expansion, but highlight the parent if deep inside.
                        // Actually, user wants to know where they are. 
                        // If we are in a sub-item, the parent should probably be expanded or at least highlighted.

                        // Let's rely on `expandedItems` for expansion, but maybe init it? 
                        // For now, let's just style the active state.

                        const isMetaActive = isActive;

                        const visibleSubItems = item.subItems?.filter(subItem => {
                            if (!currentUser) return false;
                            if (!subItem.roles || subItem.roles.length === 0) return true;
                            return hasRole(currentUser, subItem.roles);
                        }) || [];

                        const hasSubItems = visibleSubItems.length > 0;

                        return (
                            <div key={index} className="overflow-hidden">
                                <div
                                    className={`w-full flex items-center justify-between rounded-xl transition-all duration-200 group ${isMetaActive ? 'bg-black/5 text-black font-extrabold' :
                                        isExpanded ? 'bg-black text-white shadow-lg' : 'hover:bg-gray-50 text-gray-800'
                                        }`}
                                >
                                    <button
                                        onClick={() => {
                                            if (item.path) {
                                                handleNavigation(item.path);
                                            } else if (hasSubItems) {
                                                toggleExpand(item.label);
                                            }
                                        }}
                                        className="flex-1 flex items-center gap-4 p-4 text-left"
                                    >
                                        <item.icon className={`w-5 h-5 ${isMetaActive ? 'text-black' : isExpanded ? 'text-white' : 'text-gray-500 group-hover:text-black'}`} />
                                        <span className={`tracking-tight text-lg ${isMetaActive ? 'font-extrabold' : 'font-bold'}`}>{item.label}</span>
                                    </button>

                                    {hasSubItems && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleExpand(item.label);
                                            }}
                                            className="p-4 hover:bg-black/5 dark:hover:bg-white/10 rounded-r-xl transition-colors"
                                            aria-label={isExpanded ? "Colapsar menú" : "Expandir menú"}
                                        >
                                            <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-white' : 'text-gray-400 group-hover:text-black'}`} />
                                        </button>
                                    )}
                                </div>

                                {/* Sub-menu */}
                                <div
                                    className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                                        }`}
                                >
                                    <div className="overflow-hidden">
                                        <div className="pl-12 pr-2 py-2 space-y-1">
                                            {visibleSubItems.map((subItem, SubIndex) => {
                                                const isSubActive = location.pathname + location.search === subItem.path;
                                                return (
                                                    <button
                                                        key={SubIndex}
                                                        onClick={() => handleNavigation(subItem.path)}
                                                        className={`w-full text-left p-3 rounded-lg transition-colors text-sm font-medium ${isSubActive
                                                            ? 'bg-black text-white shadow-md'
                                                            : 'text-gray-600 hover:bg-gray-100 hover:text-black'
                                                            }`}
                                                    >
                                                        {subItem.label}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-gray-100/50 space-y-3 bg-gray-50/50">
                    {onToggleTheme && (
                        <button
                            onClick={onToggleTheme}
                            className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white hover:shadow-sm transition-all text-gray-600 font-bold"
                        >
                            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                            <span>{isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>
                        </button>
                    )}

                    {currentUser ? (
                        <button
                            onClick={() => {
                                onLogout();
                                onClose();
                            }}
                            className="w-full flex items-center gap-4 p-3 rounded-xl text-red-600 hover:bg-red-50 hover:shadow-sm transition-all font-bold"
                        >
                            <LogOut className="w-5 h-5" />
                            <span>Cerrar Sesión</span>
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                handleNavigation('/login');
                                onClose();
                            }}
                            className="w-full flex items-center gap-4 p-3 rounded-xl bg-black text-white hover:bg-gray-800 shadow-lg hover:shadow-xl transition-all font-bold justify-center"
                        >
                            <span>Iniciar Sesión</span>
                        </button>
                    )}

                    {currentUser && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="flex items-center gap-3 px-2">
                                <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-black text-sm">
                                    {currentUser.name ? currentUser.name.substring(0, 2).toUpperCase() : 'US'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-900 truncate">{currentUser.name}</p>
                                    <p className="text-xs text-gray-500 truncate">{currentUser.email}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DrawerMenu;
