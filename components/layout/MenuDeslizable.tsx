import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    X,
    Menu,
    Home,
    BarChart,
    Info,
    Book,
    Settings,
    Heart,
    HeartHandshake,
    ChevronDown,
    ChevronRight,
    LogOut,
    LogIn,
    Sun,
    Moon,
    UserCircle,
    Star,
    Trophy,
    CalendarDays,
    Baby
} from 'lucide-react';
import { User, UserRole } from '../../types';
import { hasRole } from '../../services/authUtils';
import { supabaseService } from '../../services/supabaseService';

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
    /**
     * El ícono va montado sobre una foto o video, sin fondo de navbar
     * detrás: pasa a blanco con un halo que lo sostiene también sobre
     * imágenes claras. El color es una decisión del componente y no un
     * className de afuera porque `text-white` y `text-slate-700` tienen la
     * misma especificidad — cuál gana lo decidiría el orden de la hoja de
     * estilos, no el orden del atributo class.
     */
    onMedia?: boolean;
}> = ({ onClick, className = "", onMedia = false }) => (
    <button
        id="hamburger-menu-btn"
        onClick={onClick}
        style={{ transition: 'color 600ms ease-out, filter 600ms ease-out' }}
        className={`flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full focus-visible:outline-none focus-visible:ring-2 group ${onMedia
            ? 'text-white drop-shadow-[0_1px_5px_rgba(0,0,0,0.5)] focus-visible:ring-white/60'
            : 'text-slate-700 dark:text-zinc-200 drop-shadow-none hover:text-black dark:hover:text-white focus-visible:ring-slate-900/30 dark:focus-visible:ring-white/30'
            } ${className}`}
        aria-label="Menú"
    >
        <Menu className="w-5 h-5 transition-transform group-hover:scale-110" />
    </button>
);

interface SubMenuItem {
    label: string;
    path?: string;
    roles?: UserRole[];
    separator?: boolean;
    // Solo visible en el drawer mobile (se oculta en el sidebar desktop).
    mobileOnly?: boolean;
    // Prefijos adicionales de ruta que también cuentan
    // como "activo" para este sub-ítem, además del
    // match exacto de `path`. Útil cuando una sección
    // tiene una página secundaria bajo otro prefijo
    // (ej: Bautismos vive en /punto-de-informacion?view=BAPTISMS
    // pero su alta/edición vive en /punto-de-informacion/bautismos/nuevo).
    activePaths?: string[];
}

interface SubGroup {
    label: string;
    path?: string;
    roles?: UserRole[];
    subItems?: SubMenuItem[];
    separator?: boolean;
}

interface MenuItem {
    label: string;
    icon: React.ElementType;
    path?: string;
    // Prefijos adicionales de ruta que también
    // cuentan como "activo" para este ítem, además
    // de `path`. Útil cuando una sección tiene
    // páginas que viven bajo un prefijo distinto
    // (ej: GCX tiene admin en /admingcx en vez de
    // /gcx/admin).
    activePaths?: string[];
    roles?: UserRole[];
    requiresAuth?: boolean;
    subItems?: SubMenuItem[];
    subGroups?: SubGroup[];
    action?: () => void;
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
    // Estado del evento Día del Padre (visible/oculto en el menú). Activo por defecto.
    const [dpadreActivo, setDpadreActivo] = useState(true);
    const [prodeActivo, setProdeActivo] = useState(true);

    useEffect(() => {
        supabaseService.getAppConfig()
            .then(cfg => {
                if (cfg?.dpadreConfig) setDpadreActivo(cfg.dpadreConfig.isActive);
                if (cfg?.prodeConfig) setProdeActivo(cfg.prodeConfig.isActive);
            })
            .catch(() => { /* fallback: queda activo */ });
    }, []);

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
        // Subir al tope al navegar desde el menú. Sin esto, cambiar de vista dentro
        // de la misma ruta (ej. Punto de Información: de un panel admin a "Inicio")
        // deja la página a mitad de scroll. El pequeño delay espera a que el drawer
        // libere el bloqueo de scroll del body (overflow: hidden) antes de hacer scroll.
        setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: 'smooth' }), 60);
    };

    const menuData: MenuItem[] = [
        {
            label: 'Inicio',
            icon: Home,
            path: '/',
            roles: []
        },
        {
            label: 'Audiencia Servicios',
            icon: HeartHandshake,
            path: '/audiencia-servicios',
            roles: [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.ADMIN_CUIDADO_PASTORAL],
        },
        {
            label: 'Bienvenida',
            icon: Heart,
            path: '/bienvenida',
            roles: [UserRole.SUPER_ADMIN, UserRole.ENCARGADO_BIENVENIDA, UserRole.VOLUNTARIO_BIENVENIDA],
            subItems: [
                { label: 'Inicio', path: '/bienvenida' },
                { label: 'Incompletos', path: '/bienvenida?stage=NEW' },
                { label: 'Form Lleno', path: '/bienvenida?stage=FILLED_FORM' },
                { label: '2° Contacto', path: '/bienvenida?stage=SECOND_CONTACT' },
                { label: '3° Contacto', path: '/bienvenida?stage=THIRD_CONTACT' },
                { label: 'Int. Crecer', path: '/bienvenida?stage=INTERESTED_GROWTH' },
                { label: 'Creciendo', path: '/bienvenida?stage=DOING_GROWTH' },
                { label: 'Entrenamiento', path: '/bienvenida?stage=DOING_TRAINING' },
                { label: 'Voluntarios', path: '/bienvenida?stage=VOLUNTEERS' },
                { label: 'No Respondió', path: '/bienvenida?stage=NO_RESPONSE' }
            ]
        },
        {
            label: 'GCX',
            icon: BarChart,
            path: '/gcx',
            activePaths: ['/admingcx', '/coordinators', '/mis-grupos'],
            roles: [],
            subGroups: [
                // ── Acceso general ───────────────────────────
                { label: 'Inicio', path: '/gcx', roles: [] },
                { label: 'Mis grupos', path: '/mis-grupos', roles: [UserRole.ANFITRION, UserRole.CO_ANFITRION] },
                { label: 'Mi Calendario', path: '/gcx/calendario', roles: [UserRole.ANFITRION, UserRole.CO_ANFITRION, UserRole.USUARIO, UserRole.VIEWER] },
                // ── Separador: Coordinación ──────────────────
                { label: 'Coordinación', separator: true, roles: [UserRole.SUPER_ADMIN, UserRole.COORDINATOR] },
                { label: 'Coordinadores', path: '/coordinators?tab=dashboard', roles: [UserRole.SUPER_ADMIN, UserRole.COORDINATOR] },
                // ── Separador: Administración ────────────────
                { label: 'Administración', separator: true, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS, UserRole.ENCARGADO_GRUPOS] },
                {
                    label: 'Gestión de grupos',
                    path: '/admingcx/gestion-de-grupos',
                    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS, UserRole.ENCARGADO_GRUPOS],
                    subItems: [
                        { label: 'Ver todos los grupos', path: '/admingcx/gestion-de-grupos' },
                        { label: 'Crear grupo', path: '/admingcx/gestion-de-grupos/crear-grupo' },
                        { label: 'Agregar grupo', path: '/admingcx/gestion-de-grupos/agregar-grupo' },
                        { label: 'Solicitudes de baja', path: '/admingcx/gestion-de-grupos/bajas' },
                    ]
                },
                { label: 'Gestión de anfitriones', path: '/admingcx/gestion-de-anfitriones', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS, UserRole.ENCARGADO_GRUPOS] },
                { label: 'Gestión de coordinadores', path: '/admingcx/gestion-de-coordinadores', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS] },
                { label: 'Categorías', path: '/admingcx/categorias', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS] },
                { label: 'Etiquetas', path: '/admingcx/etiquetas', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS] },
                { label: 'Configuración', path: '/admingcx/configuracion', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS] },
                { label: 'Temporadas', path: '/admingcx/temporadas', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS] },
                { label: 'Reportes', path: '/reportes', roles: [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.REPORTES, UserRole.ADMIN_GROUPS, UserRole.ENCARGADO_GRUPOS] },
            ],
            subItems: []
        },
        {
            label: 'Influos',
            icon: Star,
            path: '/influos',
            roles: [UserRole.INFLUOS, UserRole.SUPER_ADMIN, UserRole.PASTOR],
            subItems: [
                {
                    label: 'Panel Influos',
                    path: '/influos',
                    roles: [UserRole.INFLUOS, UserRole.SUPER_ADMIN, UserRole.PASTOR]
                },
                {
                    label: 'Administración',
                    separator: true,
                    roles: [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.ENCARGADO_EVENTOS, UserRole.INFLUOS]
                },
                {
                    label: 'Tribal Wars',
                    path: '/eventos/admin/tribal-wars',
                    roles: [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.ENCARGADO_EVENTOS, UserRole.INFLUOS]
                },
            ]
        },
        {
            label: 'Prode Mundial',
            icon: Trophy,
            path: '/prode',
            requiresAuth: true,
            roles: [],
            subItems: [
                {
                    label: 'Inicio',
                    path: '/prode',
                    roles: []
                },
                {
                    label: 'Ranking',
                    path: '/prode/ranking',
                    roles: []
                },
                {
                    label: 'Predicciones y resultados',
                    path: '/prode/resultados',
                    roles: []
                },
                {
                    label: 'Administración',
                    separator: true,
                    roles: [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.PRODE]
                },
                {
                    label: 'Configuración',
                    path: '/prode/administracion?tab=configuracion',
                    roles: [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.PRODE]
                },
                {
                    label: 'Partidos',
                    path: '/prode/administracion?tab=partidos',
                    roles: [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.PRODE]
                },
                {
                    label: 'Resultados',
                    path: '/prode/administracion?tab=resultados',
                    roles: [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.PRODE]
                },
                {
                    label: 'Ranking',
                    path: '/prode/administracion?tab=ranking',
                    roles: [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.PRODE]
                },
                {
                    label: 'Predicciones',
                    path: '/prode/administracion?tab=predicciones',
                    roles: [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.PRODE]
                },
            ]
        },
        {
            label: 'Eventos',
            icon: CalendarDays,
            path: '/eventos',
            roles: [],
            subItems: [
                {
                    label: 'Próximos eventos',
                    path: '/eventos',
                    roles: []
                },
                // ── ADMINISTRACIÓN ────────────────
                {
                    label: 'Administración',
                    separator: true,
                    roles: [
                        UserRole.SUPER_ADMIN,
                        UserRole.PASTOR,
                        UserRole.ENCARGADO_EVENTOS,
                        UserRole.ENCARGADO_NINEZ,
                        UserRole.ACREDITACION,
                    ]
                },
                {
                    label: 'Panel de eventos',
                    path: '/panel-eventos',
                    roles: [
                        UserRole.SUPER_ADMIN,
                        UserRole.PASTOR,
                        UserRole.ENCARGADO_EVENTOS,
                    ]
                },
                {
                    // Mismos roles que el guard real de la ruta en
                    // App.tsx — Encargado Niñez también administra este
                    // módulo, aunque viva bajo Eventos en el menú.
                    label: 'Día del Niño',
                    path: '/eventos/admin/diadelnino',
                    roles: [
                        UserRole.SUPER_ADMIN,
                        UserRole.PASTOR,
                        UserRole.ENCARGADO_EVENTOS,
                        UserRole.ENCARGADO_NINEZ,
                        UserRole.ACREDITACION,
                    ]
                },
                // ── DÍA DEL PADRE (solo si el evento está activo) ──
                ...(dpadreActivo ? [
                    {
                        label: 'Día del Padre',
                        separator: true,
                        roles: []
                    },
                    {
                        label: 'Ranking',
                        path: '/eventos/ranking-diadelpadre',
                        roles: []
                    },
                    {
                        label: 'Puntuación',
                        path: '/eventos/puntuacion',
                        roles: [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.EVENTOS, UserRole.ENCARGADO_EVENTOS]
                    },
                ] : []),
            ]
        },
        {
            // Módulo interno: fuera del radar público. Con `roles: []` el ítem
            // se mostraba a cualquiera, incluso sin sesión. Los roles son los
            // mismos que ya declara Ninez.tsx para su botonera y App.tsx para
            // el guard de la ruta — los tres lugares tienen que coincidir.
            label: 'Niñez',
            icon: Baby,
            path: '/ninez',
            roles: [
                UserRole.SUPER_ADMIN,
                UserRole.PASTOR,
                UserRole.ENCARGADO_NINEZ,
            ],
            subItems: [
                {
                    // Se repiten los roles en vez de heredarlos del padre: los
                    // subItems se filtran por su cuenta, así que si mañana
                    // alguien vuelve a abrir el ítem padre, este no queda
                    // público por descuido.
                    label: 'Panel Niñez',
                    path: '/ninez',
                    roles: [
                        UserRole.SUPER_ADMIN,
                        UserRole.PASTOR,
                        UserRole.ENCARGADO_NINEZ,
                    ]
                },
                // ── ADMINISTRACIÓN ────────────────
                {
                    label: 'Administración',
                    separator: true,
                    roles: [
                        UserRole.SUPER_ADMIN,
                        UserRole.PASTOR,
                        UserRole.ENCARGADO_NINEZ,
                    ]
                },
                {
                    label: 'Configuración',
                    path: '/admin-ninez/configuracion',
                    roles: [
                        UserRole.SUPER_ADMIN,
                        UserRole.PASTOR,
                        UserRole.ENCARGADO_NINEZ,
                    ]
                },
            ]
        },
        {
            label: 'Punto de información',
            icon: Info,
            path: '/punto-de-informacion',
            roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO],
            subItems: [
                { label: 'Inicio', path: '/punto-de-informacion' },
                { label: 'Administración', separator: true },
                { label: 'Menú principal', path: '/punto-de-informacion?view=PANEL', mobileOnly: true },
                { label: 'Dashboard', path: '/punto-de-informacion?view=SUMMARY' },
                { label: 'Anuncios', path: '/punto-de-informacion?view=ANNOUNCEMENTS', activePaths: ['/punto-de-informacion/anuncios'] },
                { label: 'Bautismos', path: '/punto-de-informacion?view=BAPTISMS', activePaths: ['/punto-de-informacion/bautismos'] },

                { label: 'Configuración', path: '/punto-de-informacion?view=ADMIN_PANEL', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO] },
                { label: 'Eventos', path: '/punto-de-informacion?view=EVENTS', activePaths: ['/punto-de-informacion/eventos'] },
                { label: 'Inventario', path: '/punto-de-informacion?view=INVENTORY' },
                { label: 'Movimientos', path: '/punto-de-informacion?view=MOVEMENTS', activePaths: ['/punto-de-informacion/movimientos'] },

                { label: 'Presentaciones', path: '/punto-de-informacion?view=PRESENTATIONS', activePaths: ['/punto-de-informacion/presentacion-ninos'] },
                { label: 'Préstamos', path: '/punto-de-informacion?view=LOANS', activePaths: ['/punto-de-informacion/prestamos'] },
                { label: 'Reportes', path: '/reportes', roles: [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.REPORTES, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO] },
            ]
        },
        {
            label: 'Sistemas',
            icon: Settings,
            path: '/panel-admin',
            roles: [UserRole.SUPER_ADMIN],
            subItems: [
                { label: 'Usuarios', path: '/panel-admin?tab=users' },
                { label: 'Configuración', path: '/panel-admin?tab=config' },
                { label: 'Logs', path: '/panel-admin?tab=logs' }
            ]
        },
        {
            label: 'Tutoriales',
            icon: Book,
            path: '/tutoriales',
            roles: [],
            requiresAuth: true
        }
    ].filter(item => {
        // Excluir Prode si está inactivo, o para mujeres
        if (item.label === 'Prode Mundial') {
            if (!prodeActivo) return false;
            if (currentUser?.gender === 'Femenino') return false;
        }
        return true;
    });

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
                    if (item.roles && item.roles.length > 0) {
                        if (!currentUser) return null;
                        if (!hasRole(currentUser, item.roles)) return null;
                    }
                    if (item.requiresAuth && !currentUser) return null;

                    const isActive = (item.path === '/' && location.pathname === '/') ||
                        (item.path !== '/' && item.path && location.pathname.startsWith(item.path)) ||
                        (item.activePaths?.some(p => location.pathname.startsWith(p)) ?? false);

                    const visibleSubItems = item.subItems?.filter(sub => {
                        // "Menú principal" es exclusivo de mobile: ocultar en el sidebar desktop.
                        if (sub.mobileOnly && isSidebar) return false;
                        // Sin roles: público (separadores sin roles incluidos)
                        if (!sub.roles || sub.roles.length === 0) return true;
                        // Con roles: requiere login y el rol (aplica a items y separadores)
                        if (!currentUser) return false;
                        return hasRole(currentUser, sub.roles);
                    }) || [];

                    const visibleSubGroups = item.subGroups?.filter(group => {
                        if (!group.roles || group.roles.length === 0) return true;
                        if (!currentUser) return false;
                        return hasRole(currentUser, group.roles);
                    }) || [];

                    const hasSubItems = visibleSubItems.length > 0;
                    const hasSubGroups = visibleSubGroups.length > 0;
                    const hasChildren = hasSubItems || hasSubGroups;
                    const isExpanded = expandedItems.includes(item.label) || (isActive && !isCollapsed);

                    return (
                        <div key={index} title={isCollapsed ? item.label : undefined}>
                            <div className={`flex items-center rounded-xl transition-all duration-200 group ${isActive
                                ? 'bg-black text-white dark:bg-white dark:text-black shadow-lg shadow-black/10'
                                : isExpanded && !isCollapsed ? 'bg-black text-white' : 'text-gray-700 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
                                } ${isCollapsed ? 'justify-center mx-1' : ''}`}>
                                <button
                                    onClick={() => {
                                        if (hasChildren) {
                                            // Tiene hijos: SOLO expande/colapsa,
                                            // nunca navega. El "Inicio" dentro
                                            // de los subItems es quien navega
                                            // a la ruta raíz del módulo.
                                            if (!isCollapsed) {
                                                toggleExpand(item.label);
                                            } else if (onToggleCollapse) {
                                                onToggleCollapse();
                                            }
                                        } else if (item.path) {
                                            // Sin hijos: navega directo,
                                            // como siempre.
                                            handleNavigation(item.path);
                                        }
                                    }}
                                    className={`flex-1 flex items-center gap-3 py-2.5 text-left ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}
                                >
                                    <item.icon className={`w-5 h-5 shrink-0 transition-colors ${isActive ? (isDarkMode ? 'text-black' : 'text-white dark:text-black') : 'text-gray-500 dark:text-zinc-500 group-hover:text-black dark:group-hover:text-white'}`} />
                                    {!isCollapsed && <span className="text-sm font-bold truncate">{item.label}</span>}
                                </button>
                                {!isCollapsed && hasChildren && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); toggleExpand(item.label); }}
                                        className="pr-3 py-2.5 shrink-0"
                                    >
                                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} ${isActive ? 'text-white dark:text-black' : 'text-gray-400'}`} />
                                    </button>
                                )}
                            </div>

                            {!isCollapsed && hasChildren && isExpanded && (
                                <div className="ml-6 pl-2 border-l border-gray-100 dark:border-zinc-800 mt-1 mb-2 space-y-1">
                                    {/* SubGroups: gray labeled sections, optionally expandable */}
                                    {visibleSubGroups.map((group, gi) => {
                                        // ── Separator ─────────────────────────────
                                        if (group.separator) {
                                            return (
                                                <div key={gi} className="px-3 pt-3 pb-1">
                                                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-neutral-400 dark:text-zinc-600 select-none">
                                                        {group.label}
                                                    </span>
                                                </div>
                                            );
                                        }

                                        const groupKey = `${item.label}::${group.label}`;
                                        const hasGroupItems = (group.subItems?.length ?? 0) > 0;
                                        const isGroupActive = group.path
                                            ? (location.pathname + location.search).startsWith(group.path)
                                            : group.subItems?.some(s => (location.pathname + location.search) === s.path);
                                        const isGroupExpanded = expandedItems.includes(groupKey) || (!!isGroupActive && hasGroupItems);

                                        return (
                                            <div key={gi}>
                                                <div className="flex items-center rounded-lg transition-colors group/sg">
                                                    <button
                                                        onClick={() => {
                                                            if (!hasGroupItems && group.path) handleNavigation(group.path);
                                                            if (hasGroupItems) toggleExpand(groupKey);
                                                        }}
                                                        className={`flex-1 text-left px-3 py-1.5 text-xs font-bold transition-colors rounded-lg ${!hasGroupItems && isGroupActive
                                                            ? 'bg-black text-white dark:bg-white dark:text-black'
                                                            : 'text-gray-500 dark:text-zinc-500 hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-zinc-800'
                                                            }`}
                                                    >
                                                        {group.label}
                                                    </button>
                                                    {hasGroupItems && (
                                                        <button
                                                            onClick={() => toggleExpand(groupKey)}
                                                            className="pr-2 py-1.5 shrink-0 text-gray-500 dark:text-zinc-500"
                                                        >
                                                            <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${isGroupExpanded ? 'rotate-90' : ''}`} />
                                                        </button>
                                                    )}
                                                </div>
                                                {hasGroupItems && isGroupExpanded && (
                                                    <div className="ml-3 pl-2 border-l border-gray-100 dark:border-zinc-800 mt-0.5 mb-1 space-y-0.5">
                                                        {group.subItems!.map((sub, si) => {
                                                            const isSubActive = (location.pathname + location.search) === sub.path
                                                                || (sub.activePaths?.some(p => location.pathname.startsWith(p)) ?? false);
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

                                    {/* Regular subItems — con soporte de separadores */}
                                    {visibleSubItems.map((sub, si) => {
                                        if (sub.separator) {
                                            return (
                                                <div key={si} className="px-3 pt-3 pb-1">
                                                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-neutral-400 dark:text-zinc-600 select-none">
                                                        {sub.label}
                                                    </span>
                                                </div>
                                            );
                                        }
                                        const isSubActive = sub.path
                                            ? (location.pathname + location.search) === sub.path
                                                || (sub.activePaths?.some(p => location.pathname.startsWith(p)) ?? false)
                                            : false;
                                        return (
                                            <button
                                                key={si}
                                                onClick={() => sub.path && handleNavigation(sub.path)}
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
                        <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-black dark:border-white shrink-0">
                            {currentUser.avatarUrl ? (
                                <img
                                    src={currentUser.avatarUrl}
                                    alt={currentUser.name || 'Avatar'}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-black text-xs">
                                    {currentUser.name ? currentUser.name.substring(0, 2).toUpperCase() : 'US'}
                                </div>
                            )}
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
                    {currentUser && (
                        <button
                            onClick={() => { handleNavigation('/perfil'); }}
                            className={`w-full flex items-center gap-3 rounded-xl transition-all text-gray-600 dark:text-zinc-400 font-bold text-xs ${isCollapsed ? 'justify-center p-2' : 'px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800'}`}
                            title={isCollapsed ? 'Mi Perfil' : undefined}
                        >
                            <UserCircle className="w-4 h-4 shrink-0" />
                            {!isCollapsed && <span>Mi Perfil</span>}
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
                        <button
                            onClick={() => { handleNavigation('/auth'); onClose(); }}
                            className={`w-full flex items-center gap-3 rounded-xl bg-black dark:bg-white text-white dark:text-black font-black text-xs uppercase tracking-wider transition-all border-2 border-black hover:opacity-80 ${isCollapsed ? 'justify-center p-2' : 'px-3 py-2.5'}`}
                            title={isCollapsed ? "Iniciar Sesión" : undefined}
                        >
                            <LogIn className="w-4 h-4 shrink-0" />
                            {!isCollapsed && <span>Iniciar Sesión</span>}
                        </button>
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
