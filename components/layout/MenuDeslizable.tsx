import React, { useState, useEffect, useRef } from 'react';
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
    ChevronUp,
    ChevronRight,
    ChevronsLeft,
    LogOut,
    LogIn,
    Sun,
    Moon,
    UserCircle,
    Star,
    Trophy,
    CalendarDays,
    CalendarRange,
    CalendarCheck,
    LayoutDashboard,
    Users,
    UserCheck,
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

/**
 * Hamburguesa de la navbar mobile.
 *
 * Sigue exportándose aunque el sidebar de escritorio ya no la use: Estructura.tsx
 * la monta en la barra superior del teléfono, que es el único lugar donde abrir
 * el menú necesita un disparador propio. En escritorio ese trabajo pasó al
 * bloque de marca del propio sidebar.
 */
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
            : 'text-slate-700 dark:text-zinc-200 drop-shadow-none hover:text-slate-900 dark:hover:text-white focus-visible:ring-slate-900/30 dark:focus-visible:ring-white/30'
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
    // de `path`.
    activePaths?: string[];
    /**
     * Marca el ítem activo solo con la ruta exacta, en vez de por prefijo.
     *
     * Lo necesitan los ítems de "General" cuyo prefijo es padre de rutas que
     * ahora viven en "Administración": sin esto, estar en
     * /eventos/admin/diadelnino encendería "Eventos" allá arriba, que es
     * justamente la mezcla que esta reorganización viene a deshacer.
     */
    exact?: boolean;
    roles?: UserRole[];
    requiresAuth?: boolean;
    subItems?: SubMenuItem[];
    subGroups?: SubGroup[];
}

interface MenuSection {
    titulo: string;
    items: MenuItem[];
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
    // Desplegable de la cuenta (pie del menú, sobre el chip del usuario).
    const [cuentaAbierta, setCuentaAbierta] = useState(false);
    const cuentaRef = useRef<HTMLDivElement>(null);
    // La lista scrolleable y el ítem donde estás parado ahora mismo.
    const navRef = useRef<HTMLElement>(null);
    const itemActivoRef = useRef<HTMLButtonElement>(null);

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

    // El desplegable de cuenta se cierra al tocar afuera o con Escape. Es un
    // menú flotante que se monta sobre la lista: sin esto queda abierto
    // tapando los últimos ítems mientras el usuario ya está mirando otra cosa.
    useEffect(() => {
        if (!cuentaAbierta) return;
        const alClickAfuera = (e: MouseEvent) => {
            if (cuentaRef.current && !cuentaRef.current.contains(e.target as Node)) {
                setCuentaAbierta(false);
            }
        };
        const alEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setCuentaAbierta(false);
        };
        document.addEventListener('mousedown', alClickAfuera);
        document.addEventListener('keydown', alEscape);
        return () => {
            document.removeEventListener('mousedown', alClickAfuera);
            document.removeEventListener('keydown', alEscape);
        };
    }, [cuentaAbierta]);

    // Contraer o expandir cambia el ancho del sidebar con una transición de
    // 300ms; el panel es `absolute` contra ese contenedor, así que se quedaría
    // viajando con él. Se cierra y listo.
    useEffect(() => {
        setCuentaAbierta(false);
    }, [isCollapsed]);

    /**
     * Al abrir el menú, mostrar el ítem donde estás parado.
     *
     * La lista tiene quince entradas y no entra en una pantalla de teléfono.
     * Abriéndose siempre en el tope, quien está en "Punto de información" o en
     * "Sistemas" —el fondo de Administración— veía el menú arrancar en "Inicio"
     * y tenía que scrollear a mano para encontrar dónde estaba. El menú tiene
     * que abrir mostrando la respuesta, no obligando a buscarla.
     *
     * Tres decisiones acá:
     *
     * - Se mueve `nav.scrollTop` a mano en vez de `scrollIntoView()`, porque
     *   ese método scrollea TODOS los ancestros scrolleables y en el sidebar de
     *   escritorio arrastraría también la página de atrás.
     * - Se mide con `getBoundingClientRect()` y no con `offsetTop`: el `<nav>`
     *   no está posicionado, así que el `offsetParent` de una fila es el panel
     *   del drawer y los números no darían contra el contenedor que scrollea.
     *   La diferencia entre dos rects es correcta igual mientras el drawer se
     *   desliza, porque ese movimiento es sólo en X.
     * - Salto seco, sin `smooth`: el menú tiene que aparecer ya puesto en su
     *   lugar. Una animación de scroll compitiendo con la entrada del drawer se
     *   ve como un tirón, y encima ignora `prefers-reduced-motion`.
     */
    useEffect(() => {
        // El drawer sólo existe montado; cerrado no hay nada que acomodar.
        if (type === 'drawer' && !isOpen) return;
        // `shouldRender` es la dependencia que de verdad importa, no `isOpen`.
        // El componente hace `return null` mientras vale false, así que en el
        // render en que `isOpen` se vuelve true el <nav> TODAVÍA no existe y
        // los refs están vacíos. Recién cuando `shouldRender` pasa a true hay
        // algo que medir — sin él en las dependencias este efecto corría una
        // sola vez, contra la nada, y el menú seguía abriendo en el tope.
        if (!shouldRender) return;

        // Un frame de espera: el ítem activo se auto-expande y sus hijos
        // cambian las alturas de todo lo que tiene debajo.
        const frame = requestAnimationFrame(() => {
            const nav = navRef.current;
            const item = itemActivoRef.current;
            if (!nav || !item) return;

            const nav_ = nav.getBoundingClientRect();
            const item_ = item.getBoundingClientRect();

            // Si ya se ve entero no se toca nada: mover la lista por gusto es
            // tan desorientador como no moverla cuando hace falta.
            if (item_.top >= nav_.top && item_.bottom <= nav_.bottom) return;

            // Centrado, no pegado al borde: se lee mejor "estás acá" cuando el
            // ítem tiene vecinos arriba y abajo. El navegador recorta solo el
            // scrollTop en los extremos de la lista.
            nav.scrollTop += item_.top - nav_.top - (nav.clientHeight - item_.height) / 2;
        });

        return () => cancelAnimationFrame(frame);
        // `expandedItems` queda afuera a propósito: si alguien abre otro
        // desplegable, la lista no debe saltar bajo su dedo.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, shouldRender, type, isCollapsed, location.pathname, location.search]);

    const toggleExpand = (label: string) => {
        setExpandedItems(prev =>
            prev.includes(label)
                ? prev.filter(item => item !== label)
                : [...prev, label]
        );
    };

    const handleNavigation = (path: string) => {
        navigate(path);
        setCuentaAbierta(false);
        onClose();
        // Subir al tope al navegar desde el menú. Sin esto, cambiar de vista dentro
        // de la misma ruta (ej. Punto de Información: de un panel admin a "Inicio")
        // deja la página a mitad de scroll. El pequeño delay espera a que el drawer
        // libere el bloqueo de scroll del body (overflow: hidden) antes de hacer scroll.
        setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: 'smooth' }), 60);
    };

    // ─────────────────────────────────────────────────────────────────────
    //  GENERAL — lo que usa cualquiera que entra a la app
    // ─────────────────────────────────────────────────────────────────────
    const menuGeneral: MenuItem[] = [
        {
            label: 'Inicio',
            icon: Home,
            path: '/',
            roles: []
        },
        {
            // Un solo click al buscador público de grupos. La administración de
            // GCX se mudó entera a "Panel GCX", en la sección de abajo.
            label: 'GCX',
            icon: BarChart,
            path: '/gcx',
            exact: true,
            roles: []
        },
        {
            label: 'Mi Calendario',
            icon: CalendarRange,
            path: '/gcx/calendario',
            roles: [UserRole.ANFITRION, UserRole.CO_ANFITRION, UserRole.USUARIO, UserRole.VIEWER]
        },
        {
            label: 'Eventos',
            icon: CalendarDays,
            path: '/eventos',
            exact: true,
            roles: []
        },
        {
            label: 'Prode Mundial',
            icon: Trophy,
            path: '/prode',
            requiresAuth: true,
            roles: [],
            // Solo la parte que juega el público. La administración del Prode
            // ya está publicada dentro de "Panel de eventos".
            subItems: [
                { label: 'Inicio', path: '/prode', roles: [] },
                { label: 'Ranking', path: '/prode/ranking', roles: [] },
                { label: 'Predicciones y resultados', path: '/prode/resultados', roles: [] },
            ]
        },
        {
            label: 'Tutoriales',
            icon: Book,
            path: '/tutoriales',
            roles: [],
            requiresAuth: true
        }
    ];

    // ─────────────────────────────────────────────────────────────────────
    //  ADMINISTRACIÓN — paneles de gestión, cada uno con su rol
    // ─────────────────────────────────────────────────────────────────────
    const menuAdmin: MenuItem[] = [
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
        },
        {
            label: 'Panel GCX',
            icon: LayoutDashboard,
            path: '/admingcx',
            roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS, UserRole.ENCARGADO_GRUPOS],
            subGroups: [
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
            ]
        },
        {
            // Los grupos que lleva el anfitrión. Va suelto y no colgado de
            // "Panel GCX": ese desplegable es el /admingcx del encargado de
            // grupos, y estos dos ni comparten rutas ni roles.
            label: 'Mis grupos',
            icon: Users,
            path: '/mis-grupos',
            roles: [UserRole.ANFITRION, UserRole.CO_ANFITRION]
        },
        {
            label: 'Coordinadores',
            icon: UserCheck,
            // Con ?tab=dashboard, igual que antes: el módulo abre por pestañas
            // y entrar sin una deja al coordinador en la pestaña que el
            // componente elija por defecto, que no tiene por qué ser esta.
            path: '/coordinators?tab=dashboard',
            roles: [UserRole.SUPER_ADMIN, UserRole.COORDINATOR],
            // El prefijo mantiene el ítem encendido en las demás pestañas.
            activePaths: ['/coordinators']
        },
        {
            // Es un índice, no una pantalla suelta: adentro están Día del Padre,
            // Día del Niño, Tribal Wars, General, Kahoot y la administración del
            // Prode. Por eso va sin desplegable —duplicarlo acá sería mantener
            // dos listas del mismo contenido.
            label: 'Panel de eventos',
            icon: CalendarCheck,
            path: '/panel-eventos',
            // Las pantallas que cuelgan del panel viven bajo otros prefijos.
            // Sin esto, estar adentro de Día del Niño dejaba el menú entero
            // apagado: "Eventos" (arriba, en General) ya no las reclama, y sin
            // ningún ítem encendido se pierde de dónde se entró.
            activePaths: ['/eventos/admin', '/trivia/admin'],
            roles: [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.ENCARGADO_EVENTOS],
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
                    label: 'Tribal Wars',
                    path: '/eventos/admin/tribal-wars',
                    roles: [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.ENCARGADO_EVENTOS, UserRole.INFLUOS]
                },
            ]
        },
        {
            label: 'Niñez',
            icon: Baby,
            path: '/ninez',
            activePaths: ['/admin-ninez'],
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
    ];

    // Un ítem se muestra si el usuario cumple sus roles. Se calcula antes de
    // pintar para poder ocultar el rótulo de una sección que quedó vacía: un
    // "Administración" sin nada debajo le dice al voluntario que hay algo que
    // no está viendo.
    const puedeVer = (item: MenuItem): boolean => {
        if (item.label === 'Prode Mundial') {
            if (!prodeActivo) return false;
            if (currentUser?.gender === 'Femenino') return false;
        }
        if (item.roles && item.roles.length > 0) {
            if (!currentUser) return false;
            if (!hasRole(currentUser, item.roles)) return false;
        }
        if (item.requiresAuth && !currentUser) return false;
        return true;
    };

    const secciones: MenuSection[] = [
        { titulo: 'General', items: menuGeneral.filter(puedeVer) },
        { titulo: 'Administración', items: menuAdmin.filter(puedeVer) },
    ].filter(seccion => seccion.items.length > 0);

    if (!shouldRender && type === 'drawer') return null;

    const isSidebar = type === 'sidebar';

    // ── Fila del desplegable de cuenta ───────────────────────────────────
    const FilaCuenta: React.FC<{
        icon: React.ElementType;
        label: string;
        onClick: () => void;
        danger?: boolean;
    }> = ({ icon: Icono, label, onClick, danger }) => (
        <button
            role="menuitem"
            onClick={onClick}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold transition-colors ${danger
                ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20'
                : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800'
                }`}
        >
            <Icono className="w-4 h-4 shrink-0" />
            <span className="truncate">{label}</span>
        </button>
    );

    // ── Un ítem de menú (con o sin hijos) ────────────────────────────────
    const renderItem = (item: MenuItem, key: React.Key) => {
        const isActive = item.path === '/'
            ? location.pathname === '/'
            : (
                (item.path
                    ? (item.exact
                        ? location.pathname === item.path
                        : location.pathname.startsWith(item.path))
                    : false)
                || (item.activePaths?.some(p => location.pathname.startsWith(p)) ?? false)
            );

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
            <div key={key} title={isCollapsed ? item.label : undefined}>
                <button
                    // Sólo hay un activo por vez: es el ancla a la que el menú
                    // scrollea al abrirse.
                    ref={isActive ? itemActivoRef : undefined}
                    onClick={() => {
                        if (hasChildren) {
                            // Tiene hijos: SOLO expande/colapsa, nunca navega.
                            // El "Inicio" dentro de los subItems es quien lleva
                            // a la raíz del módulo.
                            if (!isCollapsed) {
                                toggleExpand(item.label);
                            } else if (onToggleCollapse) {
                                onToggleCollapse();
                            }
                        } else if (item.path) {
                            handleNavigation(item.path);
                        }
                    }}
                    aria-expanded={hasChildren && !isCollapsed ? isExpanded : undefined}
                    className={`w-full flex items-center rounded-xl transition-colors duration-200 group text-left ${isCollapsed ? 'justify-center py-2.5 px-0' : 'gap-2 py-2.5 px-2'
                        } ${isActive
                        // Negro pleno = dónde estás parado, y hay uno solo.
                        // Abierto pero no activo va en gris claro: con nueve
                        // desplegables, pintar cada uno que se abre del mismo
                        // negro dejaba tres o cuatro "activos" a la vez y el
                        // color perdía la única cosa que tiene para decir.
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                        : isExpanded && !isCollapsed
                            ? 'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white'
                            : 'text-gray-700 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
                        }`}
                >
                    {/* Carril de despliegue, a la IZQUIERDA del ícono.
                        El hueco se reserva siempre —aunque el ítem no tenga
                        hijos— para que todos los íconos caigan sobre la misma
                        vertical: si el carril apareciera solo en los ítems con
                        flecha, la columna de íconos se movería fila por fila. */}
                    {!isCollapsed && (
                        <span className="w-4 shrink-0 flex items-center justify-center" aria-hidden="true">
                            {hasChildren && (
                                <ChevronRight
                                    className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''} ${isActive
                                        ? 'text-white dark:text-slate-900'
                                        : isExpanded
                                            ? 'text-slate-500 dark:text-zinc-400'
                                            : 'text-gray-400 dark:text-zinc-600'
                                        }`}
                                />
                            )}
                        </span>
                    )}
                    <item.icon
                        className={`w-5 h-5 shrink-0 transition-colors ${isActive
                            ? 'text-white dark:text-slate-900'
                            : isExpanded && !isCollapsed
                                ? 'text-slate-900 dark:text-white'
                                : 'text-gray-500 dark:text-zinc-500 group-hover:text-slate-900 dark:group-hover:text-white'
                            }`}
                    />
                    {!isCollapsed && <span className="text-sm font-bold truncate">{item.label}</span>}
                </button>

                {!isCollapsed && hasChildren && isExpanded && (
                    /* ml-8 alinea el hilo de los hijos con el ÍCONO del padre
                       (px-2 + carril de 16px + gap de 8px), no con su flecha. */
                    <div className="ml-8 pl-2 border-l border-gray-100 dark:border-zinc-800 mt-1 mb-2 space-y-1">
                        {/* SubGroups: secciones rotuladas, opcionalmente expandibles */}
                        {visibleSubGroups.map((group, gi) => {
                            if (group.separator) {
                                return (
                                    <div key={gi} className="px-3 pt-3 pb-1">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 dark:text-zinc-600 select-none">
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
                                    <button
                                        onClick={() => {
                                            if (hasGroupItems) toggleExpand(groupKey);
                                            else if (group.path) handleNavigation(group.path);
                                        }}
                                        aria-expanded={hasGroupItems ? isGroupExpanded : undefined}
                                        className={`w-full flex items-center gap-1.5 text-left px-2 py-1.5 text-xs font-bold rounded-lg transition-colors ${!hasGroupItems && isGroupActive
                                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                            : 'text-gray-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-zinc-800'
                                            }`}
                                    >
                                        <span className="w-3 shrink-0 flex items-center justify-center" aria-hidden="true">
                                            {hasGroupItems && (
                                                <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${isGroupExpanded ? 'rotate-90' : ''}`} />
                                            )}
                                        </span>
                                        <span className="truncate">{group.label}</span>
                                    </button>
                                    {hasGroupItems && isGroupExpanded && (
                                        <div className="ml-3 pl-2 border-l border-gray-100 dark:border-zinc-800 mt-0.5 mb-1 space-y-0.5">
                                            {group.subItems!.map((sub, si) => {
                                                const isSubActive = (location.pathname + location.search) === sub.path
                                                    || (sub.activePaths?.some(p => location.pathname.startsWith(p)) ?? false);
                                                return (
                                                    <button
                                                        key={si}
                                                        onClick={() => sub.path && handleNavigation(sub.path)}
                                                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${isSubActive
                                                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                                            : 'text-gray-500 dark:text-zinc-500 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white'
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

                        {/* subItems planos — con soporte de separadores */}
                        {visibleSubItems.map((sub, si) => {
                            if (sub.separator) {
                                return (
                                    <div key={si} className="px-3 pt-3 pb-1">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 dark:text-zinc-600 select-none">
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
                                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                        : 'text-gray-500 dark:text-zinc-500 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white'
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
    };

    const SidebarContent = (
        <div
            className={`flex flex-col h-full bg-white dark:bg-zinc-950 border-r border-slate-200 dark:border-zinc-800 transition-all duration-300 ${isSidebar ? (isCollapsed ? 'w-20' : 'w-64') : 'w-full'}`}
        >
            {/* ── MARCA ────────────────────────────────────────────────────
                Ocupa el lugar de la hamburguesa y hereda su único trabajo:
                contraer y expandir el panel. Un solo control, en los dos
                sentidos — contraído queda el isotipo y vuelve a abrir de un
                toque, así contraer nunca es un camino sin vuelta.
                Sin chevron: la flecha significa "acá se despliega algo", y lo
                que se despliega es el menú de cuenta, abajo. */}
            <div className="shrink-0 border-b border-gray-100/70 dark:border-zinc-800">
                <div className={`h-16 flex items-center gap-1 ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}>
                    {(() => {
                        const marca = (
                            <>
                                <span className="w-9 h-9 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center shrink-0">
                                    {/* favicon.png es el isotipo solo (negro sobre
                                        transparente). Se invierte a blanco sobre la
                                        pastilla oscura, y en modo oscuro la pastilla
                                        pasa a blanca y el isotipo vuelve a negro. */}
                                    <img src="/favicon.png" alt="" aria-hidden="true" className="w-5 h-5 object-contain invert dark:invert-0" />
                                </span>
                                {!isCollapsed && (
                                    <>
                                        <span className="flex-1 min-w-0 text-left">
                                            <span className="block text-sm font-black tracking-tight text-slate-900 dark:text-white leading-none truncate">
                                                Origen
                                            </span>
                                            <span className="block text-[11px] font-medium text-slate-400 dark:text-zinc-500 leading-none mt-1 truncate">
                                                App
                                            </span>
                                        </span>
                                        {isSidebar && (
                                            <ChevronsLeft className="w-4 h-4 shrink-0 text-slate-400 dark:text-zinc-600" />
                                        )}
                                    </>
                                )}
                            </>
                        );

                        // En el drawer mobile no hay nada que contraer, así que
                        // la marca no finge ser un botón: es solo el rótulo.
                        if (!isSidebar) {
                            return (
                                <div className="flex flex-1 min-w-0 items-center gap-2.5 px-2 py-2">
                                    {marca}
                                </div>
                            );
                        }

                        return (
                            <button
                                onClick={() => onToggleCollapse?.()}
                                aria-label={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
                                title={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
                                className={`flex items-center gap-2.5 rounded-xl transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 dark:focus-visible:ring-white/30 ${isCollapsed ? 'p-1.5' : 'flex-1 min-w-0 px-2 py-2'
                                    }`}
                            >
                                {marca}
                            </button>
                        );
                    })()}

                    {/* El drawer mobile conserva su cierre explícito: ahí el
                        menú tapa la pantalla y hay que poder salir. */}
                    {!isSidebar && (
                        <button
                            onClick={onClose}
                            aria-label="Cerrar menú"
                            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors group shrink-0"
                        >
                            <X className="w-5 h-5 text-slate-900 dark:text-white group-hover:rotate-90 transition-transform duration-300" />
                        </button>
                    )}
                </div>
            </div>

            {/* ── SECCIONES ───────────────────────────────────────────────
                Dos bloques separados por aire, no por una línea: la distancia
                ya dice que son cosas distintas y una regla más sumaría ruido
                a una columna que ya tiene bordes, pastillas y hilos. */}
            <nav ref={navRef} className={`flex-1 overflow-y-auto py-4 ${isCollapsed ? 'px-2' : 'px-3'}`}>
                {secciones.map((seccion, si) => (
                    <div key={seccion.titulo} className={si > 0 ? 'mt-7' : ''}>
                        {isCollapsed ? (
                            // Contraído no entra el rótulo: queda solo la marca
                            // de corte entre bloques, y nada arriba de todo.
                            si > 0 && <div className="h-px w-8 mx-auto mb-3 bg-slate-200 dark:bg-zinc-800" />
                        ) : (
                            <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-zinc-600 select-none">
                                {seccion.titulo}
                            </p>
                        )}
                        <div className="space-y-1">
                            {seccion.items.map((item, ii) => renderItem(item, `${seccion.titulo}-${ii}`))}
                        </div>
                    </div>
                ))}
            </nav>

            {/* ── PIE / CUENTA ────────────────────────────────────────────
                El chip del usuario es el disparador del menú de cuenta: quién
                sos y qué podés hacer con esa sesión viven en el mismo control,
                que es donde uno los va a buscar.
                El panel abre hacia ARRIBA. Es lo último de la columna: hacia
                abajo no hay lugar y quedaría cortado contra el borde de la
                ventana.
                Sin sesión el chip no existe, así que el ingreso va suelto y a
                la vista — nadie abre un desplegable para buscar cómo entrar. */}
            <div
                ref={cuentaRef}
                className={`relative p-4 border-t border-gray-100 dark:border-zinc-800 ${isCollapsed ? 'flex flex-col items-center px-2' : ''}`}
            >
                {currentUser ? (
                    <>
                        <button
                            onClick={() => setCuentaAbierta(v => !v)}
                            aria-haspopup="menu"
                            aria-expanded={cuentaAbierta}
                            aria-label={isCollapsed ? `Cuenta de ${currentUser.name}` : undefined}
                            title={isCollapsed ? currentUser.name : undefined}
                            className={`w-full flex items-center gap-3 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 dark:focus-visible:ring-white/30 ${cuentaAbierta ? 'bg-gray-100 dark:bg-zinc-800' : 'hover:bg-gray-100 dark:hover:bg-zinc-800'
                                } ${isCollapsed ? 'justify-center p-1.5' : 'px-2 py-2'}`}
                        >
                            <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 dark:border-zinc-700 shrink-0">
                                {currentUser.avatarUrl ? (
                                    <img
                                        src={currentUser.avatarUrl}
                                        alt=""
                                        aria-hidden="true"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-bold text-xs">
                                        {currentUser.name ? currentUser.name.substring(0, 2).toUpperCase() : 'US'}
                                    </div>
                                )}
                            </div>
                            {!isCollapsed && (
                                <>
                                    <div className="flex-1 min-w-0 text-left">
                                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{currentUser.name}</p>
                                        <p className="text-[10px] text-gray-500 dark:text-zinc-500 truncate">{currentUser.email}</p>
                                    </div>
                                    <ChevronUp
                                        className={`w-4 h-4 shrink-0 text-slate-400 dark:text-zinc-600 transition-transform duration-200 ${cuentaAbierta ? 'rotate-180' : ''}`}
                                    />
                                </>
                            )}
                        </button>

                        {cuentaAbierta && (
                            <div
                                role="menu"
                                /* Contraído el pie mide 80px: si el panel se
                                   ajustara al contenedor saldría de 64px de
                                   ancho y ninguna etiqueta entraría. Se le fija
                                   un ancho propio y desborda sobre el contenido,
                                   que es lo que hace cualquier menú de un rail
                                   angosto. */
                                className={`absolute bottom-[calc(100%-0.75rem)] z-50 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg shadow-slate-900/10 overflow-hidden py-1 ${isCollapsed ? 'left-2 w-56' : 'left-3 right-3'
                                    }`}
                            >
                                <FilaCuenta
                                    icon={UserCircle}
                                    label="Mi perfil"
                                    onClick={() => handleNavigation('/perfil')}
                                />
                                {onToggleTheme && (
                                    <FilaCuenta
                                        icon={isDarkMode ? Sun : Moon}
                                        label={isDarkMode ? 'Modo claro' : 'Modo oscuro'}
                                        onClick={() => { onToggleTheme(); setCuentaAbierta(false); }}
                                    />
                                )}
                                <div className="my-1 h-px bg-slate-100 dark:bg-zinc-800" />
                                <FilaCuenta
                                    icon={LogOut}
                                    label="Cerrar sesión"
                                    danger
                                    onClick={() => { setCuentaAbierta(false); onLogout(); onClose(); }}
                                />
                            </div>
                        )}
                    </>
                ) : (
                    <button
                        onClick={() => { handleNavigation('/auth'); onClose(); }}
                        className={`w-full flex items-center gap-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs uppercase tracking-wider transition-all hover:bg-black dark:hover:bg-slate-200 ${isCollapsed ? 'justify-center p-2' : 'px-3 py-2.5'}`}
                        title={isCollapsed ? 'Iniciar Sesión' : undefined}
                    >
                        <LogIn className="w-4 h-4 shrink-0" />
                        {!isCollapsed && <span>Iniciar Sesión</span>}
                    </button>
                )}
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
