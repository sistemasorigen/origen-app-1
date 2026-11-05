import type React from 'react';
import {
    Home,
    BarChart,
    Info,
    HeartHandshake,
    Star,
    Trophy,
    CalendarDays,
    LayoutDashboard,
    Users,
    UserCheck,
    Baby,
    Compass,
    PartyPopper,
    Network,
    ClipboardCheck,
    Ticket,
    DoorOpen,
    Building2,
    FolderTree,
    ServerCog,
} from 'lucide-react';
import { User, UserRole } from '../../types';
import { hasRole } from '../../services/authUtils';

/**
 * Qué funciones tiene la app, y quién ve cada una.
 *
 * Es una sola lista para el menú deslizable y para la barra de accesos
 * rápidos: si una función cambia de ruta o de permisos, cambia en los dos
 * lados. Nada de acá toca el navegador ni pregunta a la base: lo que depende de
 * la sesión llega en `ContextoDeMenu`.
 */

export interface SubMenuItem {
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

export interface MenuItem {
    /**
     * El nombre estable de la función: lo que guarda la barra de accesos
     * rápidos. No es la ruta, que puede cambiar. Los grupos no tienen.
     */
    id?: string;
    /** Cómo se llama en el botón de la barra, donde no entra el nombre entero. */
    corto?: string;
    /** Ya tiene su botón fijo en la barra: no se ofrece para el personalizado. */
    fija?: boolean;
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
    /**
     * Un grupo de Administración (GCX, Personas, Organización): no navega,
     * despliega estos ítems, cada uno con su ícono, su ruta y sus permisos.
     * Dos niveles nada más: los hijos no tienen hijos. El grupo no tiene
     * roles propios: aparece si se ve alguno de sus hijos, y si se ve uno
     * solo, ese hijo va suelto (ver aplanar()).
     */
    children?: MenuItem[];
}

export interface MenuSection {
    titulo: string;
    /** "General" va sin rótulo: arranca directo. */
    conRotulo: boolean;
    items: MenuItem[];
}

/** Lo que hay que saber de quién mira para decidir qué ve. */
export interface ContextoDeMenu {
    currentUser: User | null;
    /** De qué departamentos de Agenda Origen forma parte (agenda_mi_acceso). */
    agenda: { cargando: boolean; puedeVerAgenda: boolean; puedeVerDepartamentos: boolean };
    prodeActivo: boolean;
}

// ─────────────────────────────────────────────────────────────────────
//  GENERAL — lo que usa cualquiera que entra a la app
// ─────────────────────────────────────────────────────────────────────
export const menuGeneral: MenuItem[] = [
    {
        id: 'inicio', fija: true, label: 'Inicio',
        icon: Home,
        path: '/',
        roles: []
    },
    {
        // Un solo click al buscador público de grupos. La administración de
        // GCX se mudó entera a "Panel GCX", en la sección de abajo.
        id: 'gcx', fija: true, label: 'GCX',
        icon: Compass,
        path: '/gcx',
        exact: true,
        roles: []
    },
    {
        id: 'eventos', corto: 'Eventos', label: 'Eventos',
        icon: PartyPopper,
        path: '/eventos',
        exact: true,
        roles: []
    },
    {
        // El calendario de cada uno (Agenda Origen): las tareas de sus
        // equipos. Sólo para quien pertenece a un departamento o a un
        // sub-departamento (ver puedeVer, más abajo).
        id: 'agenda', corto: 'Agenda', label: 'Agenda Origen',
        icon: CalendarDays,
        path: '/agenda',
        roles: [],
        requiresAuth: true,
    },
    {
        id: 'prode', corto: 'Prode', label: 'Prode Mundial',
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
export const menuAdmin: MenuItem[] = [
    {
        // Agrupado por área (pedido de Ignacio, 29-oct-2026): doce
        // entradas al mismo nivel se veían cargadas. Rutas, roles y
        // condiciones de cada hijo son los mismos de antes.
        label: 'GCX',
        icon: Network,
        children: [
            {
                // Un solo click, sin desplegable: entra directo a "Gestión
                // de grupos" (pedido de Ignacio, 28-oct-2026). Lo demás
                // —anfitriones, coordinadores, temporadas, categorías,
                // etiquetas, página pública— está en el menú propio del
                // panel (AdminGCXLayout), y crear grupo, agregar y bajas,
                // en la pantalla de grupos.
                id: 'panel-gcx', corto: 'Panel GCX', label: 'Panel GCX',
                icon: LayoutDashboard,
                path: '/admingcx/gestion-de-grupos',
                // Encendido en cualquier pantalla del panel, no sólo en grupos.
                activePaths: ['/admingcx'],
                roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS, UserRole.ENCARGADO_GRUPOS],
            },
            {
                // El tablero de GCX: el panel no lo enlaza, así que es su
                // única entrada. No es /reportes (Pastores.tsx), que sigue
                // en Punto de información.
                id: 'reportes-gcx', corto: 'Reportes', label: 'Reportes GCX',
                icon: BarChart,
                path: '/reportes/gcx',
                roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS, UserRole.ENCARGADO_GRUPOS],
            },
            {
                // Los grupos que lleva el anfitrión. No comparte rutas ni
                // roles con Panel GCX (el /admingcx del encargado).
                id: 'panel-anfitriones', corto: 'Anfitrión', label: 'Panel de anfitriones',
                icon: ClipboardCheck,
                path: '/mis-grupos',
                roles: [UserRole.ANFITRION, UserRole.CO_ANFITRION]
            },
            {
                id: 'panel-coordinadores', corto: 'Coordinación', label: 'Panel de coordinadores',
                icon: UserCheck,
                // Con ?tab=dashboard, igual que antes: el módulo abre por
                // pestañas y entrar sin una deja al coordinador en la
                // pestaña que el componente elija por defecto.
                path: '/coordinators?tab=dashboard',
                roles: [UserRole.SUPER_ADMIN, UserRole.COORDINATOR],
                // El prefijo mantiene el ítem encendido en las demás pestañas.
                activePaths: ['/coordinators']
            },
        ],
    },
    {
        // Es un índice, no una pantalla suelta: adentro están Nocturna,
        // Día del Niño, Día del Padre, Tribal Wars, General, Kahoot y la
        // administración del Prode. Por eso va sin desplegable.
        id: 'panel-eventos', corto: 'Panel eventos', label: 'Panel de eventos',
        icon: Ticket,
        path: '/panel-eventos',
        // Las pantallas que cuelgan del panel viven bajo otros prefijos.
        // En /eventos/admin/tribal-wars gana Influos, que la reclama con
        // un prefijo más largo (ver coincidencia()); quien no ve Influos
        // sigue viendo encendido este.
        activePaths: ['/eventos/admin', '/trivia/admin', '/panel-eventos/nocturna'],
        // ACREDITACION entra por Nocturna. Sin esto, quien sólo tiene ese
        // rol no veía NINGÚN ítem y la sección "Administración" entera
        // desaparecía: tenía permiso en la base y ninguna puerta en la app.
        roles: [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.ENCARGADO_EVENTOS, UserRole.ACREDITACION],
    },
    {
        label: 'Personas',
        icon: Users,
        children: [
            {
                id: 'bienvenida', corto: 'Bienvenida', label: 'Bienvenida',
                icon: DoorOpen,
                path: '/bienvenida',
                roles: [UserRole.SUPER_ADMIN, UserRole.ENCARGADO_BIENVENIDA, UserRole.VOLUNTARIO_BIENVENIDA],
            },
            {
                // Sin desplegable: Tribal Wars, que colgaba de acá, se abre
                // desde la pantalla de Influos (y desde Panel de eventos).
                id: 'influos', corto: 'Influos', label: 'Influos',
                icon: Star,
                path: '/influos',
                activePaths: ['/eventos/admin/tribal-wars'],
                roles: [UserRole.INFLUOS, UserRole.SUPER_ADMIN, UserRole.PASTOR],
            },
            {
                // Sin desplegable: la Configuración se abre desde /ninez.
                id: 'ninez', corto: 'Niñez', label: 'Niñez',
                icon: Baby,
                path: '/ninez',
                activePaths: ['/admin-ninez'],
                roles: [
                    UserRole.SUPER_ADMIN,
                    UserRole.PASTOR,
                    UserRole.ENCARGADO_NINEZ,
                ],
            },
        ],
    },
    {
        label: 'Organización',
        icon: Building2,
        children: [
            {
                // Agenda Origen. No va por roles: se ve según de qué
                // departamento es encargado cada uno y qué sub-departamento
                // dirige (agenda_mi_acceso). Ver puedeVer().
                id: 'departamentos', corto: 'Deptos.', label: 'Departamentos',
                icon: FolderTree,
                path: '/departamentos',
                requiresAuth: true,
            },
            {
                id: 'punto', corto: 'Info', label: 'Punto de información',
                icon: Info,
                // Un toque y estás en el panel, que ya tiene su propio menú
                // con las funciones agrupadas y los permisos de cada una.
                path: '/punto-de-informacion?view=PANEL',
                // El ?view= es para navegar; para encenderse alcanza el
                // pathname. Mismo caso que Panel de coordinadores.
                activePaths: ['/punto-de-informacion'],
                roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO, UserRole.VOLUNTARIO_INFO],
            },
            {
                id: 'audiencia', corto: 'Audiencia', label: 'Audiencia de servicios',
                icon: HeartHandshake,
                path: '/audiencia-servicios',
                roles: [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.ADMIN_CUIDADO_PASTORAL],
            },
        ],
    },
    {
        // Un solo click, sin desplegable: entra directo a "Usuarios"
        // (pedido de Ignacio, 28-oct-2026). Configuración, Departamentos
        // y los logs están en el menú propio del panel.
        id: 'sistemas', corto: 'Sistemas', label: 'Sistemas',
        icon: ServerCog,
        path: '/panel-admin?tab=users',
        // El ?tab= es para navegar; para encenderse alcanza el pathname,
        // en cualquier sección del panel.
        activePaths: ['/panel-admin'],
        roles: [UserRole.SUPER_ADMIN],
    },
];

// Un ítem se muestra si el usuario cumple sus roles. Se calcula antes de
// pintar para poder ocultar el rótulo de una sección que quedó vacía: un
// "Administración" sin nada debajo le dice al voluntario que hay algo que
// no está viendo.
export const puedeVer = (item: MenuItem, { currentUser, agenda, prodeActivo }: ContextoDeMenu): boolean => {
    if (item.path === '/agenda') {
        // Sólo quien pertenece a un departamento o a un sub-departamento
        // (o SUPER_ADMIN). A quien no está en ninguno la pantalla no le
        // mostraba nada más que "Todavía no formás parte…". Mientras se
        // pregunta no aparece, para que no parpadee.
        if (!currentUser || agenda.cargando) return false;
        return agenda.puedeVerAgenda;
    }
    if (item.path === '/departamentos') {
        // Lo ve quien tiene algo adentro: SUPER_ADMIN, los encargados de un
        // departamento y quien dirige un sub-departamento. Mientras se
        // pregunta no aparece, para que no parpadee.
        if (!currentUser || agenda.cargando) return false;
        return agenda.puedeVerDepartamentos;
    }
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

/**
 * Los grupos, ya filtrados: un grupo aparece si se ve alguno de sus
 * hijos (con la misma puedeVer de cada ítem, incluido el "cargando" de
 * Departamentos). Con un solo hijo visible no hay grupo: ese hijo va
 * suelto, con su ícono —un anfitrión ve "Panel de anfitriones" sin
 * tener que abrir "GCX"—.
 */
const aplanar = (items: MenuItem[], ctx: ContextoDeMenu): MenuItem[] => items.flatMap(item => {
    if (!item.children) return puedeVer(item, ctx) ? [item] : [];
    const hijos = item.children.filter(i => puedeVer(i, ctx));
    if (hijos.length === 0) return [];
    if (hijos.length === 1) return hijos;
    return [{ ...item, children: hijos }];
});

/** Las secciones del menú para esa persona. */
export const armarSecciones = (ctx: ContextoDeMenu): MenuSection[] => [
    { titulo: 'General', conRotulo: false, items: aplanar(menuGeneral, ctx) },
    { titulo: 'Administración', conRotulo: true, items: aplanar(menuAdmin, ctx) },
].filter(seccion => seccion.items.length > 0);

/**
 * Cuánto de la ruta actual reclama un ítem: el largo del prefijo que
 * coincide, 0 si ninguno. Las rutas con ?query (Sistemas, Punto,
 * coordinadores) no coinciden por `path`: se encienden por activePaths.
 */
export const coincidencia = (item: MenuItem, ruta: string): number => {
    if (item.path === '/') return ruta === '/' ? 1 : 0;
    let largo = 0;
    if (item.path && (item.exact ? ruta === item.path : ruta.startsWith(item.path))) largo = item.path.length;
    for (const p of item.activePaths ?? []) {
        if (ruta.startsWith(p)) largo = Math.max(largo, p.length);
    }
    return largo;
};

// ── Para la barra de accesos rápidos ───────────────────────────────────────

export interface GrupoDeFunciones { titulo: string; items: MenuItem[] }

const todasLasHojas: MenuItem[] = [...menuGeneral, ...menuAdmin].flatMap(i => i.children ?? [i]);

export const funcionPorId = (id: string): MenuItem | null => todasLasHojas.find(i => i.id === id) ?? null;

/**
 * Lo que esa persona puede elegir para el botón personalizado, agrupado como
 * en el menú. Acá un hijo solo sigue bajo el nombre de su grupo: en una lista
 * con títulos, "GCX" con una sola fila se entiende mejor que una fila suelta.
 */
export const gruposParaElegir = (ctx: ContextoDeMenu): GrupoDeFunciones[] => {
    const visibles = (items: MenuItem[]) => items.filter(i => !i.fija && puedeVer(i, ctx));
    return [
        { titulo: 'GENERAL', items: visibles(menuGeneral) },
        ...menuAdmin.map(i => ({ titulo: i.label.toLocaleUpperCase('es'), items: visibles(i.children ?? [i]) })),
    ].filter(g => g.items.length > 0);
};
