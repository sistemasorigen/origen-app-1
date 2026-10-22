import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
    X,
    Menu,
    Bell,
    Home,
    BarChart,
    Info,
    Book,
    Settings,
    Heart,
    HeartHandshake,
    ChevronUp,
    ChevronDown,
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
import { useBloqueoDeFondo } from '../../hooks/useBloqueoDeFondo';
import { useTema } from '../../contexts/TemaContext';
import { useSinLeer } from '../../contexts/NotificationContext';

// ══════════════════════════════════════════════════════════════════════
//  Los tokens del diseño (design-claude/Menu Deslizable.dc)
//
//  Van como clases de Tailwind y no como objeto de estilos en línea
//  porque el tema oscuro de esta app es la clase `dark` del <html>: con
//  estilos en línea habría que saber acá adentro qué tema está puesto,
//  y a este componente no se lo pasan (Estructura.tsx no manda
//  isDarkMode). La geometría que cambia por nivel —alturas, sangrías—
//  sí va en línea: son números, no colores.
// ══════════════════════════════════════════════════════════════════════
const PANEL = 'bg-[#f6f6f4] dark:bg-[#111110]';
const TARJETA = 'bg-white dark:bg-[#1b1b1a]';
const PASTILLA = 'bg-[#f2f2f0] dark:bg-[#2a2a28]';
const ENCIMA = 'hover:bg-[#ecebe7] dark:hover:bg-[#232321]';
const TINTA = 'text-[#0a0a0a] dark:text-[#f4f4f2]';
const M55 = 'text-black/55 dark:text-white/55';
const M66 = 'text-black/[0.66] dark:text-white/[0.66]';
const LINEA = 'border-black/[0.06] dark:border-white/[0.07]';
const GUIA = 'bg-black/10 dark:bg-white/10';
const FOCO = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-black/25 dark:focus-visible:ring-white/25';

/** Alto de cada nivel, en píxeles: la compu aprieta, el teléfono no. */
const ALTO = { pc: [42, 38, 34], movil: [46, 44, 44] };
/** Sangría de cada nivel. El nivel 1 arranca contra el borde. */
const SANGRIA = [0, 36, 56];

/**
 * La entrada en cascada de los ítems y el asomo del menú de cuenta.
 *
 * Va en un <style> del propio componente y no en index.html porque es lo
 * único que lo usa; prefers-reduced-motion lo apaga entero, igual que en
 * el .dc.
 */
const ANIMACIONES = `
@keyframes mdEntra { from { opacity: 0; transform: translateX(-14px) } to { opacity: 1; transform: none } }
@keyframes mdAsoma { from { opacity: 0; transform: translateY(6px) scale(.98) } to { opacity: 1; transform: none } }
@media (prefers-reduced-motion: reduce) {
  .md-menu *, .md-menu *::before, .md-menu *::after { animation: none !important; transition: none !important }
}
`;

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
 * El rojo de "sin leer": la única excepción a la paleta del menú, porque es
 * lo único que tiene que llamar la atención aunque el ojo esté en otra cosa.
 */
const ROJO = 'bg-[#e5484d] dark:bg-[#ff6369]';

/**
 * El pop de la marca cuando llega una notificación nueva.
 *
 * Devuelve un número que sólo cambia cuando el contador SUBE: se usa como
 * `key` para que la marca vuelva a entrar. Al bajar —marcar como leída— no
 * salta: lo que importa es lo que llega, no lo que se va.
 */
const usePop = (n: number): number => {
    const anterior = useRef(n);
    const [pop, setPop] = useState(0);
    useEffect(() => {
        if (n > anterior.current) setPop(p => p + 1);
        anterior.current = n;
    }, [n]);
    return pop;
};

/**
 * La marca roja sobre la foto de perfil.
 *
 * Va FUERA del círculo de la foto —que recorta lo que sobresale— y con un
 * borde del color de la tarjeta, que es lo que la despega de la imagen.
 * Apoyada en la esquina y apenas por fuera: así no tapa la cara.
 *
 * Se define acá afuera y no adentro del menú a propósito: un componente
 * declarado en el cuerpo de otro cambia de identidad en cada render, React
 * lo vuelve a montar y la animación de entrada se repetiría sola.
 */
const MarcaSinLeer: React.FC<{ n: number; quieto: boolean }> = ({ n, quieto }) => (
    <motion.span
        aria-hidden="true"
        initial={quieto ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={quieto ? { duration: 0 } : { duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        className={`absolute -top-1 -right-1 h-[18px] min-w-[18px] px-1 flex items-center justify-center rounded-full border-2 border-white dark:border-[#1b1b1a] text-[11px] font-semibold leading-none text-white ${ROJO}`}
    >
        {n > 9 ? '9+' : n}
    </motion.span>
);

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
}> = ({ onClick, className = "", onMedia = false }) => {
    /**
     * El punto de "sin leer", sin número: en la navbar no hay lugar para una
     * cifra, y lo único que tiene que decir es "entrá al menú". Sin sesión el
     * contador es 0, así que el punto no se dibuja.
     */
    const sinLeer = useSinLeer();

    return (
        <button
            id="hamburger-menu-btn"
            onClick={onClick}
            style={{ transition: 'color 600ms ease-out, filter 600ms ease-out' }}
            className={`relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full focus-visible:outline-none focus-visible:ring-2 group ${onMedia
                ? 'text-white drop-shadow-[0_1px_5px_rgba(0,0,0,0.5)] focus-visible:ring-white/60'
                : 'text-slate-700 dark:text-zinc-200 drop-shadow-none hover:text-slate-900 dark:hover:text-white focus-visible:ring-slate-900/30 dark:focus-visible:ring-white/30'
                } ${className}`}
            aria-label={sinLeer > 0 ? 'Menú, notificaciones sin leer' : 'Menú'}
        >
            <Menu className="w-5 h-5 transition-transform group-hover:scale-110" />
            {sinLeer > 0 && (
                /* Sobre el hero el borde va blanco siempre: ahí atrás no hay
                   navbar, hay una foto, y un borde oscuro desaparecería. */
                <span
                    aria-hidden="true"
                    className={`absolute top-1.5 right-1.5 w-[9px] h-[9px] rounded-full border-2 ${ROJO} ${onMedia ? 'border-white' : 'border-white dark:border-zinc-950'}`}
                />
            )}
        </button>
    );
};

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
    const { oscuro: temaOscuro, alternar: alternarTema } = useTema();
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
    const sinMovimiento = useReducedMotion();
    /**
     * Las que esperan sin leer. El contexto las actualiza en vivo por el
     * canal de Supabase, así que la marca aparece y se va sola.
     */
    const sinLeer = useSinLeer();
    const pop = usePop(sinLeer);

    /**
     * La píldora negra que marca dónde estás, y que se desliza de un ítem a
     * otro en vez de prenderse y apagarse.
     *
     * Es un solo recuadro por detrás de la lista: se mide el botón activo y
     * se la lleva a su caja. Cuando hay más de uno marcado —"Sistemas" y su
     * "Configuración", por ejemplo— va sobre el más profundo, que es el
     * lugar exacto; el de arriba se pinta igual, como hoy.
     *
     * Se mide con offset* y no con getBoundingClientRect porque los ítems
     * entran con un translateX: el rect devolvería la caja a mitad de la
     * animación y la píldora saldría corrida.
     */
    const listaRef = useRef<HTMLDivElement>(null);
    const [pildora, setPildora] = useState<{ t: number; l: number; w: number; h: number; mover: boolean } | null>(null);

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

    // El cajón del menú bloquea el fondo como cualquier modal. Antes usaba
    // overflow:hidden, que en iOS Safari no alcanza: el fondo se seguía
    // moviendo con el dedo. Ahora comparte el hook con el resto.
    useBloqueoDeFondo(type === 'drawer' && isOpen);

    useEffect(() => {
        // Al cerrarse, las secciones desplegadas vuelven a su lugar.
        if (!shouldRender) setExpandedItems([]);
    }, [shouldRender]);

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

    // Sin lista de dependencias a propósito: la píldora tiene que seguir a
    // la lista mientras un grupo se despliega, y eso dura varios cuadros. La
    // guarda de "si la caja no cambió, no toques el estado" es la que corta
    // el ciclo cuando la animación termina.
    const medirPildora = useCallback(() => {
        const lista = listaRef.current;
        if (!lista) return;
        {
            const marcados = lista.querySelectorAll<HTMLElement>('[data-activo="true"]');
            const el = marcados[marcados.length - 1];
            if (!el) { setPildora(p => (p === null ? p : null)); return; }
            // Se suma la cadena de offsetParent hasta la lista: los sub-ítems
            // viven dentro de filas posicionadas (las que sostienen las guías
            // verticales), así que su offsetTop solo no dice dónde están.
            let t = 0, l = 0;
            for (let n: HTMLElement | null = el; n && n !== lista; n = n.offsetParent as HTMLElement | null) {
                t += n.offsetTop;
                l += n.offsetLeft;
            }
            setPildora(p => {
                const igual = p && p.t === t && p.l === l
                    && p.w === el.offsetWidth && p.h === el.offsetHeight;
                if (igual) return p;
                return {
                    t, l, w: el.offsetWidth, h: el.offsetHeight,
                    // La primera vez aparece puesta; si no, se la vería venir
                    // desde la esquina de arriba cada vez que se abre el menú.
                    mover: !!p && !sinMovimiento,
                };
            });
        }
    }, [sinMovimiento]);

    useLayoutEffect(() => {
        const cuadro = requestAnimationFrame(medirPildora);
        return () => cancelAnimationFrame(cuadro);
    });

    /**
     * Y también cuando la barra cambia de ancho.
     *
     * Contraer y expandir es una transición de CSS: la lista se angosta sin
     * que React vuelva a pintar, así que la medición de arriba no se entera
     * y la píldora quedaría con el ancho viejo.
     */
    useEffect(() => {
        const lista = listaRef.current;
        if (!lista || typeof ResizeObserver === 'undefined') return;
        const observador = new ResizeObserver(() => medirPildora());
        observador.observe(lista);
        return () => observador.disconnect();
    }, [medirPildora]);

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
        // En escritorio el sidebar no se desmonta, así que "cerrarse" es
        // volver al riel de íconos. Se hace al navegar —no al abrir un
        // desplegable— para que sea el mismo trato que en mobile: elegiste
        // adónde ir, el menú se corre y la pantalla queda con todo el ancho.
        if (type === 'sidebar' && !isCollapsed) onToggleCollapse?.();
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
        // Tutoriales queda oculto: la entrada del menú y la ruta /tutoriales
        // están desactivadas. Para reponerlo hay que volver a agregar esta
        // entrada Y reactivar la ruta en App.tsx, que hoy redirige a inicio.
        // {
        //     label: 'Tutoriales',
        //     icon: Book,
        //     path: '/tutoriales',
        //     roles: [],
        //     requiresAuth: true
        // }
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
            // Reportes cuelga de acá pero vive bajo otro prefijo. Sin esto,
            // estar en el tablero de GCX dejaba el menú entero apagado y el
            // desplegable cerrado: el sub-ítem se enciende bien, pero no hay
            // forma de verlo. Mismo caso que "Panel de eventos" más abajo.
            activePaths: ['/reportes/gcx'],
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
                // El tablero de GCX, no /reportes (que es Pastores.tsx y sigue
                // colgando de Punto de información). El prefijo lo mantiene
                // encendido en el detalle de un grupo y en la comparación.
                { label: 'Reportes', path: '/reportes/gcx', roles: [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.REPORTES, UserRole.ADMIN_GROUPS, UserRole.ENCARGADO_GRUPOS] },
            ]
        },
        {
            // Los grupos que lleva el anfitrión. Va suelto y no colgado de
            // "Panel GCX": ese desplegable es el /admingcx del encargado de
            // grupos, y estos dos ni comparten rutas ni roles.
            label: 'Panel de Anfitrión',
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
            activePaths: ['/eventos/admin', '/trivia/admin', '/panel-eventos/nocturna'],
            // ACREDITACION entra por Nocturna. Sin esto, quien sólo tiene ese
            // rol no veía NINGÚN ítem y la sección "Administración" entera
            // desaparecía: tenía permiso en la base y ninguna puerta en la app.
            roles: [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.ENCARGADO_EVENTOS, UserRole.ACREDITACION],
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
            // Sin desplegable y sin paradas intermedias: un toque y estás en el
            // panel. Acá colgaba una copia de cada función del Punto —Anuncios,
            // Bautismos, Inventario, Reportes…— que había que mantener al día a
            // mano cada vez que el panel cambiaba; después quedaron dos puertas,
            // "Inicio" y "Panel de administración", para una sola pantalla. El
            // panel ya tiene su propio menú, con las funciones agrupadas y los
            // permisos de cada una: esto lleva ahí y listo.
            path: '/punto-de-informacion?view=PANEL',
            // El ?view= es para navegar; para encenderse alcanza el pathname.
            // Sin esto el ítem nunca quedaría activo —`location.pathname` no
            // empieza con "/punto-de-informacion?view=PANEL"— y el menú abriría
            // en el tope sin decir dónde estás. Mismo caso que Coordinadores.
            activePaths: ['/punto-de-informacion'],
            roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO],
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
        /** Cuántas sin leer: 0 o sin valor, no se dibuja la pastilla. */
        insignia?: number;
        /** Para cuando el texto de la fila no alcanza a decir todo. */
        etiqueta?: string;
    }> = ({ icon: Icono, label, onClick, danger, insignia = 0, etiqueta }) => (
        <button
            role="menuitem"
            onClick={onClick}
            aria-label={etiqueta}
            className={`w-full flex items-center gap-3 px-3 rounded-full text-sm font-semibold transition-colors duration-150 ${ENCIMA} ${danger
                ? 'text-[#b42318] dark:text-[#ff8a7a]'
                : TINTA
                }`}
            style={{ height: isSidebar ? 42 : 48 }}
        >
            <Icono className="w-[18px] h-[18px] shrink-0" />
            <span className="truncate">{label}</span>
            {insignia > 0 && (
                <span
                    aria-hidden="true"
                    className={`ml-auto shrink-0 h-[18px] min-w-[18px] px-1.5 flex items-center justify-center rounded-full text-[11px] font-semibold leading-none text-white ${ROJO}`}
                >
                    {insignia > 9 ? '9+' : insignia}
                </span>
            )}
        </button>
    );

    // ── Un ítem de menú (con o sin hijos) ────────────────────────────────
    /**
     * El lugar de cada ítem en la lista entera.
     *
     * Es para escalonar la entrada del cajón: cada fila entra 25 ms después
     * de la anterior, que es lo que hace que el menú se "despliegue" en vez
     * de aparecer de golpe. Se cuenta sobre las secciones ya filtradas por
     * rol, así que no quedan huecos de tiempo por ítems que no se ven.
     */
    const ordenDe = new Map<MenuItem, number>();
    secciones.forEach(sec => sec.items.forEach(it => ordenDe.set(it, ordenDe.size)));

    /**
     * El despliegue de un grupo: la altura se abre y se cierra, no aparece.
     *
     * Va con AnimatePresence y no con una transición de max-height como el
     * .dc porque ahí las filas cerradas quedan montadas en cero: acá, cuando
     * el grupo está cerrado, sus ítems no existen en la página —que es lo
     * que mide la foto de lógica, y lo que un lector de pantalla recorre.
     */
    const despliegue = {
        initial: { height: 0, opacity: 0 },
        animate: { height: 'auto' as const, opacity: 1 },
        exit: { height: 0, opacity: 0 },
        transition: sinMovimiento
            ? { duration: 0 }
            : { duration: 0.26, ease: [0.3, 0.7, 0.2, 1] as const },
    };

    /** El alto de cada nivel: la compu aprieta, el teléfono no. */
    const alto = ALTO[isSidebar ? 'pc' : 'movil'];
    /**
     * El texto de un ítem al contraer la barra.
     *
     * No se deja de dibujar: se desvanece y se queda sin ancho, que es lo
     * que hace que el ícono viaje suave al centro en vez de saltar.
     * Al expandir vuelve con un retraso, para que no aparezca encimado
     * mientras el panel todavía se está abriendo.
     */
    const textoQueSeVa = 'min-w-0 truncate text-left overflow-hidden';
    const estiloTexto: React.CSSProperties = {
        // Contraído no basta con apagarlo: tiene que dejar de ocupar, y el
        // separador tiene que irse con él. Por eso el espacio entre ícono y
        // texto es el margen del texto y no un `gap` del botón: así, con el
        // texto en cero, el ícono queda centrado en el riel de 80 px.
        flex: isCollapsed ? '0 1 0%' : '1 1 0%',
        marginLeft: isCollapsed ? 0 : 12,
        opacity: isCollapsed ? 0 : 1,
        transition: sinMovimiento ? 'none' : (isCollapsed ? 'opacity .1s ease' : 'opacity .16s ease .2s'),
    };

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
            // Hay sub-ítems que sólo tienen sentido en el teléfono. Hoy no los
            // usa nadie, pero el mecanismo queda: es una línea.
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

        // ── Sólo apariencia de acá abajo ────────────────────────────────
        //
        // La píldora va sobre el marcado MÁS PROFUNDO que esté a la vista.
        // Cuando estás en "Sistemas › Configuración" los dos cuentan como
        // activos —eso no cambió—, pero pintar los dos de negro repetía el
        // mismo dato dos veces: ahora el de arriba queda en tinta plena, que
        // es el "estás acá adentro" del diseño, y la píldora marca el final
        // del camino.
        const esSubActivo = (sub: SubMenuItem) => sub.path
            ? (location.pathname + location.search) === sub.path
            || (sub.activePaths?.some(p => location.pathname.startsWith(p)) ?? false)
            : false;
        const hijosALaVista = !isCollapsed && hasChildren && isExpanded;
        const conHijoMarcado = hijosALaVista && (
            visibleSubItems.some(sub => !sub.separator && esSubActivo(sub))
            || visibleSubGroups.some(group => {
                if (group.separator) return false;
                const conItems = (group.subItems?.length ?? 0) > 0;
                const grupoActivo = group.path
                    ? (location.pathname + location.search).startsWith(group.path)
                    : group.subItems?.some(s => (location.pathname + location.search) === s.path);
                if (!conItems) return !!grupoActivo;
                const abierto = expandedItems.includes(`${item.label}::${group.label}`) || !!grupoActivo;
                return abierto && (group.subItems ?? []).some(esSubActivo);
            })
        );
        const llevaPildora = isActive && !conHijoMarcado;

        // La cascada es del cajón del teléfono: en la compu la barra ya está
        // puesta y no hay entrada que acompañar.
        const entrada = !isSidebar && isOpen && !sinMovimiento
            ? `mdEntra .32s cubic-bezier(.2,.8,.2,1) ${(ordenDe.get(item) ?? 0) * 25}ms both`
            : undefined;

        return (
            <div key={key} title={isCollapsed ? item.label : undefined} style={{ animation: entrada }}>
                <button
                    // Sólo hay un activo por vez: es el ancla a la que el menú
                    // scrollea al abrirse.
                    ref={isActive ? itemActivoRef : undefined}
                    data-activo={isActive ? 'true' : undefined}
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
                    aria-current={isActive ? 'page' : undefined}
                    style={{
                        height: alto[0],
                        borderRadius: isCollapsed ? 14 : 999,
                        fontSize: isSidebar ? 14.5 : 15.5,
                    }}
                    className={`relative z-[1] w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-[14px]'} text-left font-semibold transition-colors duration-150 ${FOCO} ${llevaPildora
                        ? 'text-white dark:text-[#0a0a0a]'
                        : isActive
                            ? `${TINTA} ${ENCIMA}`
                            : `${M66} ${ENCIMA}`
                        }`}
                >
                    <item.icon className="w-[19px] h-[19px] shrink-0" strokeWidth={2} />
                    <span className={textoQueSeVa} style={estiloTexto}>{item.label}</span>
                    {hasChildren && !isCollapsed && (
                        <ChevronDown
                            className="w-4 h-4 shrink-0 ml-auto opacity-75 transition-transform duration-[250ms]"
                            style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}
                        />
                    )}
                </button>

                <AnimatePresence initial={false}>
                    {hijosALaVista && (
                    /* Sin borde ni sangría en el contenedor: cada fila trae su
                       propia guía vertical, que es lo que deja los tres niveles
                       alineados contra la misma columna. */
                    <motion.div className="relative overflow-hidden" {...despliegue}>
                        {/* SubGroups: secciones rotuladas, opcionalmente expandibles */}
                        {visibleSubGroups.map((group, gi) => {
                            if (group.separator) {
                                return (
                                    <div key={gi} className="relative flex items-end h-[38px] pb-2" style={{ paddingLeft: SANGRIA[1] + 12 }}>
                                        <span aria-hidden="true" className={`absolute left-[23px] top-0 bottom-0 w-[1.5px] ${GUIA}`} />
                                        <span className={`text-[11px] font-semibold uppercase tracking-[0.07em] ${M55} select-none`}>
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
                            const grupoConPildora = !hasGroupItems && !!isGroupActive;

                            return (
                                <div key={gi}>
                                    <div className="relative">
                                        <span aria-hidden="true" className={`absolute left-[23px] top-0 bottom-0 w-[1.5px] ${GUIA}`} />
                                        <button
                                            data-activo={!hasGroupItems && isGroupActive ? 'true' : undefined}
                                            onClick={() => {
                                                if (hasGroupItems) toggleExpand(groupKey);
                                                else if (group.path) handleNavigation(group.path);
                                            }}
                                            aria-expanded={hasGroupItems ? isGroupExpanded : undefined}
                                            style={{
                                                height: alto[1],
                                                marginLeft: SANGRIA[1],
                                                width: `calc(100% - ${SANGRIA[1]}px)`,
                                                borderRadius: 999,
                                                fontSize: 14,
                                            }}
                                            className={`relative z-[1] flex items-center gap-2 px-3 text-left transition-colors duration-150 ${FOCO} ${grupoConPildora
                                                ? 'font-semibold text-white dark:text-[#0a0a0a]'
                                                : isGroupActive
                                                    ? `font-semibold ${TINTA} ${ENCIMA}`
                                                    : `font-medium ${M66} ${ENCIMA}`
                                                }`}
                                        >
                                            <span className="flex-1 min-w-0 truncate">{group.label}</span>
                                            {hasGroupItems && (
                                                <ChevronDown
                                                    className="w-[15px] h-[15px] shrink-0 opacity-75 transition-transform duration-[250ms]"
                                                    style={{ transform: isGroupExpanded ? 'rotate(180deg)' : 'none' }}
                                                />
                                            )}
                                        </button>
                                    </div>
                                    <AnimatePresence initial={false}>
                                        {hasGroupItems && isGroupExpanded && (
                                        <motion.div className="overflow-hidden" {...despliegue}>
                                            {group.subItems!.map((sub, si) => {
                                                const isSubActive = (location.pathname + location.search) === sub.path
                                                    || (sub.activePaths?.some(p => location.pathname.startsWith(p)) ?? false);
                                                return (
                                                    <div key={si} className="relative">
                                                        <span aria-hidden="true" className={`absolute left-[23px] top-0 bottom-0 w-[1.5px] ${GUIA}`} />
                                                        <span aria-hidden="true" className={`absolute left-[47px] top-0 bottom-0 w-[1.5px] ${GUIA}`} />
                                                        <button
                                                            data-activo={isSubActive ? 'true' : undefined}
                                                            onClick={() => sub.path && handleNavigation(sub.path)}
                                                            aria-current={isSubActive ? 'page' : undefined}
                                                            style={{
                                                                height: alto[2],
                                                                marginLeft: SANGRIA[2],
                                                                width: `calc(100% - ${SANGRIA[2]}px)`,
                                                                borderRadius: 999,
                                                                fontSize: 13,
                                                            }}
                                                            className={`relative z-[1] flex items-center px-3 text-left truncate transition-colors duration-150 ${FOCO} ${isSubActive
                                                                ? 'font-semibold text-white dark:text-[#0a0a0a]'
                                                                : `font-medium ${M55} ${ENCIMA}`
                                                                }`}
                                                        >
                                                            {sub.label}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}

                        {/* subItems planos — con soporte de separadores */}
                        {visibleSubItems.map((sub, si) => {
                            if (sub.separator) {
                                return (
                                    <div key={si} className="relative flex items-end h-[38px] pb-2" style={{ paddingLeft: SANGRIA[1] + 12 }}>
                                        <span aria-hidden="true" className={`absolute left-[23px] top-0 bottom-0 w-[1.5px] ${GUIA}`} />
                                        <span className={`text-[11px] font-semibold uppercase tracking-[0.07em] ${M55} select-none`}>
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
                                <div key={si} className="relative">
                                    <span aria-hidden="true" className={`absolute left-[23px] top-0 bottom-0 w-[1.5px] ${GUIA}`} />
                                    <button
                                        data-activo={isSubActive ? 'true' : undefined}
                                        onClick={() => sub.path && handleNavigation(sub.path)}
                                        aria-current={isSubActive ? 'page' : undefined}
                                        style={{
                                            height: alto[1],
                                            marginLeft: SANGRIA[1],
                                            width: `calc(100% - ${SANGRIA[1]}px)`,
                                            borderRadius: 999,
                                            fontSize: 14,
                                        }}
                                        className={`relative z-[1] flex items-center px-3 text-left truncate transition-colors duration-150 ${FOCO} ${isSubActive
                                            ? 'font-semibold text-white dark:text-[#0a0a0a]'
                                            : `font-medium ${M66} ${ENCIMA}`
                                            }`}
                                    >
                                        {sub.label}
                                    </button>
                                </div>
                            );
                        })}
                    </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    const SidebarContent = (
        <div
            className={`md-menu flex flex-col h-full ${PANEL} ${isSidebar ? (isCollapsed ? 'w-20' : 'w-64') : 'w-full'}`}
            style={{
                fontFamily: 'Manrope, system-ui, sans-serif',
                // Una línea de 1px a la derecha, en vez de un borde: el borde
                // entra en la cuenta del ancho y hace saltar el contenido
                // cuando la barra se contrae.
                boxShadow: isSidebar ? `1px 0 0 ${'rgba(0,0,0,.06)'}` : 'none',
                transition: sinMovimiento ? 'none' : `width .26s cubic-bezier(.3,.7,.2,1)${isCollapsed ? ' .1s' : ''}`,
            }}
        >
            <style>{ANIMACIONES}</style>
            {/* ── MARCA ────────────────────────────────────────────────────
                Ocupa el lugar de la hamburguesa y hereda su único trabajo:
                contraer y expandir el panel. Un solo control, en los dos
                sentidos — contraído queda el isotipo y vuelve a abrir de un
                toque, así contraer nunca es un camino sin vuelta.
                Sin chevron: la flecha significa "acá se despliega algo", y lo
                que se despliega es el menú de cuenta, abajo. */}
            <div className="shrink-0">
                <div className={`flex items-center gap-1 pt-5 pb-2.5 ${isCollapsed ? 'justify-center px-2' : 'px-4'}`}>
                    {(() => {
                        const marca = (
                            <>
                                {/* El isotipo solo, sin pastilla detrás.
                                    favicon.png ya viene negro sobre transparente, así
                                    que en claro va tal cual: negro sobre el blanco del
                                    menú. En oscuro el fondo es zinc-950 y un logo negro
                                    ahí no se vería, por eso `dark:invert` lo pasa a
                                    blanco — es el único caso donde se toca el color. */}
                                <img
                                    src="/favicon.png"
                                    alt=""
                                    aria-hidden="true"
                                    className="w-9 h-9 object-contain shrink-0 dark:invert"
                                />
                                <span className={`${textoQueSeVa} text-[17px] font-semibold tracking-[-0.01em] ${TINTA}`} style={estiloTexto}>
                                    Origen
                                </span>
                                {isSidebar && !isCollapsed && (
                                    <ChevronsLeft className={`w-[18px] h-[18px] shrink-0 ml-auto ${M55}`} />
                                )}
                            </>
                        );

                        // En el drawer mobile no hay nada que contraer, así que
                        // la marca no finge ser un botón: es solo el rótulo.
                        if (!isSidebar) {
                            return (
                                <div className="flex flex-1 min-w-0 items-center px-1.5 py-2">
                                    {marca}
                                </div>
                            );
                        }

                        return (
                            <button
                                onClick={() => onToggleCollapse?.()}
                                aria-label={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
                                title={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
                                aria-expanded={!isCollapsed}
                                className={`h-[52px] flex items-center rounded-[18px] transition-colors duration-150 ${ENCIMA} ${FOCO} ${isCollapsed ? 'justify-center w-full px-0' : 'flex-1 min-w-0 px-1.5'
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
                            className={`w-11 h-11 shrink-0 ml-auto rounded-full ${PASTILLA} ${TINTA} flex items-center justify-center transition-colors group ${FOCO}`}
                        >
                            <X className="w-[17px] h-[17px] group-hover:rotate-90 transition-transform duration-300" />
                        </button>
                    )}
                </div>
            </div>

            {/* ── SECCIONES ───────────────────────────────────────────────
                Dos bloques separados por aire, no por una línea: la distancia
                ya dice que son cosas distintas y una regla más sumaría ruido
                a una columna que ya tiene bordes, pastillas y hilos. */}
            <nav
                ref={navRef}
                className={`flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide ${isCollapsed ? 'px-2' : 'px-4'} pb-3 ${isSidebar ? '' : 'contenido-del-overlay'}`}
                /* Lo mismo que el cuerpo de NeoModal, y por lo mismo: pan-y
                   deja el scroll vertical en manos del navegador; contain
                   impide que al llegar a un extremo el sobrante se le pase a
                   la página de atrás; el de WebKit es el envión de iOS. */
                style={{
                    touchAction: 'pan-y',
                    overscrollBehavior: 'contain',
                    WebkitOverflowScrolling: 'touch',
                }}
            >
                <div ref={listaRef} className="relative">
                    {/* La píldora, por detrás de todo (z-0 contra el z-[1] de
                        los botones). Sin ítem activo no se dibuja. */}
                    <div
                        aria-hidden="true"
                        className="absolute z-0 pointer-events-none bg-[#0a0a0a] dark:bg-white"
                        style={{
                            left: pildora?.l ?? 0,
                            top: pildora?.t ?? 0,
                            width: pildora?.w ?? 0,
                            height: pildora?.h ?? 0,
                            borderRadius: isCollapsed ? 14 : 999,
                            opacity: pildora ? 1 : 0,
                            transition: pildora?.mover
                                ? 'top .34s cubic-bezier(.3,.8,.2,1), left .34s cubic-bezier(.3,.8,.2,1), width .34s cubic-bezier(.3,.8,.2,1), height .34s cubic-bezier(.3,.8,.2,1), border-radius .2s, opacity .2s'
                                : 'opacity .2s',
                        }}
                    />
                    {secciones.map((seccion, si) => (
                        <div key={seccion.titulo}>
                            {/* Contraído el rótulo no entra, y en su lugar queda
                                un guión centrado: la marca de corte entre
                                bloques, que es lo único que hace falta ahí. */}
                            <div
                                className="relative flex items-end px-[14px] pb-2"
                                style={{ height: si === 0 ? 30 : 46 }}
                            >
                                <span
                                    className={`text-[12px] font-semibold uppercase tracking-[0.07em] whitespace-nowrap ${M55} select-none`}
                                    style={estiloTexto}
                                >
                                    {seccion.titulo}
                                </span>
                                <span
                                    aria-hidden="true"
                                    className="absolute left-1/2 bottom-[14px] w-[22px] h-[1.5px] -ml-[11px] rounded-sm bg-black/[0.14] dark:bg-white/[0.14] transition-opacity duration-150"
                                    style={{ opacity: isCollapsed ? 1 : 0 }}
                                />
                            </div>
                            {seccion.items.map((item, ii) => renderItem(item, `${seccion.titulo}-${ii}`))}
                        </div>
                    ))}
                </div>
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
                className={`relative shrink-0 border-t ${LINEA} ${isSidebar ? 'px-4 pt-3 pb-[18px]' : 'px-3 pt-2.5 pb-[34px]'} ${isCollapsed ? 'flex flex-col items-center px-2' : ''}`}
            >
                {currentUser ? (
                    <>
                        <button
                            onClick={() => setCuentaAbierta(v => !v)}
                            aria-haspopup="menu"
                            aria-expanded={cuentaAbierta}
                            /* Contraída la tarjeta es sólo la foto, así que
                               siempre lleva nombre. Con algo sin leer lo lleva
                               también expandida, para que el lector de pantalla
                               diga el número que se ve en rojo. */
                            aria-label={sinLeer > 0
                                ? `Cuenta de ${currentUser.name}, ${sinLeer} ${sinLeer === 1 ? 'notificación sin leer' : 'notificaciones sin leer'}`
                                : isCollapsed ? `Cuenta de ${currentUser.name}` : undefined}
                            title={isCollapsed ? currentUser.name : undefined}
                            className={`w-full flex items-center rounded-[22px] ${TARJETA} ${TINTA} shadow-[0_1px_3px_rgba(0,0,0,.05)] dark:shadow-none transition-colors duration-150 hover:bg-[#fbfbfa] dark:hover:bg-[#222220] ${FOCO} ${isCollapsed ? 'justify-center p-1.5' : isSidebar ? 'p-2' : 'py-1.5 pl-1.5 pr-2.5'
                                }`}
                        >
                            {/* La marca va afuera del círculo: adentro la
                                recortaría el overflow-hidden de la foto. */}
                            <div className="relative shrink-0">
                                <div className={`${isSidebar ? 'w-8 h-8' : 'w-10 h-10'} rounded-full overflow-hidden ${PASTILLA}`}>
                                    {currentUser.avatarUrl ? (
                                        <img
                                            src={currentUser.avatarUrl}
                                            alt=""
                                            aria-hidden="true"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className={`w-full h-full flex items-center justify-center font-semibold ${TINTA} ${isSidebar ? 'text-xs' : 'text-sm'}`}>
                                            {currentUser.name ? currentUser.name.substring(0, 2).toUpperCase() : 'US'}
                                        </div>
                                    )}
                                </div>
                                {sinLeer > 0 && (
                                    <MarcaSinLeer key={pop} n={sinLeer} quieto={!!sinMovimiento} />
                                )}
                            </div>
                            <div className={`${textoQueSeVa} flex flex-col items-start`} style={estiloTexto}>
                                <span className={`max-w-full text-sm font-semibold truncate ${TINTA}`}>{currentUser.name}</span>
                                <span className={`max-w-full mt-px text-[12.5px] font-medium truncate ${M55}`}>{currentUser.email}</span>
                            </div>
                            {!isCollapsed && (
                                <ChevronUp
                                    className={`w-4 h-4 shrink-0 ml-2 ${M55} transition-transform duration-[250ms] ${cuentaAbierta ? '' : 'rotate-180'}`}
                                />
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
                                className={`absolute z-50 p-1.5 rounded-[22px] ${TARJETA} shadow-[0_14px_40px_rgba(0,0,0,.16)] ${isCollapsed ? 'left-2 w-60 bottom-2' : 'left-4 right-4 bottom-[calc(100%-0.5rem)]'
                                    }`}
                                style={{ animation: sinMovimiento ? 'none' : 'mdAsoma .16s ease-out' }}
                            >
                                <FilaCuenta
                                    icon={UserCircle}
                                    label="Mi perfil"
                                    onClick={() => handleNavigation('/perfil')}
                                />
                                {/* handleNavigation ya cierra el panel de la
                                    cuenta y el menú: no hace falta pedirlo
                                    acá, igual que en Mi perfil. */}
                                <FilaCuenta
                                    icon={Bell}
                                    label="Notificaciones"
                                    insignia={sinLeer}
                                    etiqueta={sinLeer > 0 ? `Notificaciones, ${sinLeer} sin leer` : 'Notificaciones'}
                                    onClick={() => handleNavigation('/notificaciones')}
                                />
                                {/* El tema sale del contexto y no del prop:
                                    `onToggleTheme` no lo pasaba nadie, asi que
                                    esta fila no se dibujaba nunca. Ahora es la
                                    misma que el interruptor de Mi cuenta. */}
                                <FilaCuenta
                                    icon={temaOscuro ? Sun : Moon}
                                    label={temaOscuro ? 'Modo claro' : 'Modo oscuro'}
                                    onClick={() => { alternarTema(); setCuentaAbierta(false); }}
                                />
                                <div className={`my-1 mx-2.5 h-px ${GUIA}`} />
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
                        className={`w-full flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap bg-[#0a0a0a] dark:bg-white text-white dark:text-[#0a0a0a] text-[15px] font-semibold transition-transform active:scale-[.98] ${FOCO}`}
                        style={{
                            height: isSidebar ? 46 : 52,
                            borderRadius: isCollapsed ? 14 : 999,
                        }}
                        title={isCollapsed ? 'Iniciar Sesión' : undefined}
                    >
                        <LogIn className="w-[18px] h-[18px] shrink-0" />
                        <span
                            className="overflow-hidden"
                            style={{
                                opacity: isCollapsed ? 0 : 1,
                                maxWidth: isCollapsed ? 0 : 200,
                                transition: sinMovimiento ? 'none' : 'opacity .16s ease .2s, max-width .2s',
                            }}
                        >Iniciar Sesión</span>
                    </button>
                )}
            </div>
        </div>
    );

    if (type === 'sidebar') {
        return (
            <aside
                className={`hidden md:block fixed inset-y-0 left-0 z-40 ${isCollapsed ? 'w-20' : 'w-64'}`}
                style={{ transition: sinMovimiento ? 'none' : `width .26s cubic-bezier(.3,.7,.2,1)${isCollapsed ? ' .1s' : ''}` }}
            >
                {SidebarContent}
            </aside>
        );
    }

    return (
        <div className={`fixed inset-0 z-[60] flex justify-start md:hidden ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            {/* Backdrop */}
            {/* touchAction none: arrastrar detrás del menú no es un gesto de
                scroll. Antes esto lo daba `body.style.touchAction = 'none'`,
                que apagaba los gestos de toda la página (y obligaba al panel
                a llevar un `auto` de antídoto). Al pasar a useBloqueoDeFondo
                se perdió, y el arrastre sobre la tapa volvió a ser un scroll
                de verdad que no tiene a dónde ir: iOS lo resuelve rebotando
                la página y la lista del menú se queda sin su gesto. El tap
                para cerrar sigue andando: esto no afecta a los clicks. */}
            <div
                className={`absolute inset-0 bg-black/[0.42] transition-opacity duration-300 ease-out ${isOpen ? 'opacity-100' : 'opacity-0'}`}
                style={{ touchAction: 'none' }}
                onClick={onClose}
            />

            {/* Drawer Panel */}
            <div
                className={`relative w-[85vw] max-w-[350px] h-full overflow-hidden rounded-r-[28px] shadow-[12px_0_40px_rgba(0,0,0,0.18)] transition-transform duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] transform ${isOpen ? 'translate-x-0' : '-translate-x-[104%]'}`}
                style={{ touchAction: 'auto' }}
            >
                {SidebarContent}
            </div>
        </div>
    );
};

export default DrawerMenu;
