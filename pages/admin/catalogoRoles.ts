import { User, UserRole } from '../../types';

/**
 * Catálogo de roles del panel de administración
 * (design-claude/Admin General).
 *
 * El diseño ordena los permisos en cinco niveles de acceso, de "toca todo" a
 * "toca lo suyo". Este archivo traduce ese orden a los roles que la app usa
 * de verdad: cada rol tiene un nivel y un área, y de ahí salen el acordeón
 * de asignación, el filtro del listado y el directorio.
 *
 * IMPORTANTE: son exactamente los mismos 19 roles que se podían asignar
 * antes, ni uno más. El enum UserRole tiene otros (ENCARGADO_GRUPOS,
 * VOLUNTARIO_INFO, REPORTES…) que las guardas de ruta sí respetan pero que
 * este panel nunca ofreció; algunos los agrega solo el selector de área de
 * un voluntario. Sumarlos acá cambiaría quién puede entrar a dónde, así que
 * es una decisión aparte y no parte de un rediseño.
 */

export type NivelAcceso = 0 | 1 | 2 | 3 | 4;

export interface DefinicionRol {
    rol: UserRole;
    nombre: string;
    nivel: NivelAcceso;
    area: string;
    /** Qué deja de poder hacer si se le quita. Se usa en la confirmación. */
    pierde: string;
}

export const CATALOGO_ROLES: DefinicionRol[] = [
    {
        rol: UserRole.SUPER_ADMIN, nombre: 'Super Admin', nivel: 0, area: 'Todo el sistema',
        pierde: 'Deja de administrar el sistema y de poder cambiar permisos.',
    },

    {
        rol: UserRole.ANFITRION, nombre: 'Anfitrión', nivel: 1, area: 'Grupos de Conexión',
        pierde: 'Deja de liderar su grupo: asistencia, solicitudes y miembros.',
    },
    {
        rol: UserRole.CO_ANFITRION, nombre: 'Co-anfitrión', nivel: 1, area: 'Grupos de Conexión',
        pierde: 'Deja de acompañar el grupo del que es co-anfitrión.',
    },

    {
        rol: UserRole.COORDINATOR, nombre: 'Coordinador', nivel: 2, area: 'Grupos de Conexión',
        pierde: 'Deja de ver y acompañar los grupos de sus categorías.',
    },

    {
        rol: UserRole.ADMIN_GROUPS, nombre: 'Encargado de Grupos', nivel: 3, area: 'Grupos de Conexión',
        pierde: 'Deja de entrar al Panel GCX y de aprobar grupos.',
    },
    {
        rol: UserRole.ADMIN_PUNTO, nombre: 'Encargado de Punto', nivel: 3, area: 'Punto de Información',
        pierde: 'Deja de gestionar el Punto de Información.',
    },
    {
        rol: UserRole.ADMIN_STORE, nombre: 'Encargado de Store', nivel: 3, area: 'Store',
        pierde: 'Deja de administrar la tienda.',
    },
    {
        rol: UserRole.ADMIN_ALABANZA, nombre: 'Encargado de Alabanza', nivel: 3, area: 'Alabanza',
        pierde: 'Deja de administrar el módulo de Alabanza.',
    },
    {
        rol: UserRole.ENCARGADO_BIENVENIDA, nombre: 'Encargado de Bienvenida', nivel: 3, area: 'Bienvenida',
        pierde: 'Deja de gestionar el seguimiento de visitantes.',
    },
    {
        rol: UserRole.ADMIN_CUIDADO_PASTORAL, nombre: 'Audiencia de servicios', nivel: 3, area: 'Cuidado Pastoral',
        pierde: 'Deja de cargar y ver la audiencia de los servicios.',
    },
    {
        rol: UserRole.ENCARGADO_EVENTOS, nombre: 'Encargado de Eventos', nivel: 3, area: 'Eventos',
        pierde: 'Deja de administrar los eventos.',
    },
    {
        rol: UserRole.ENCARGADO_NINEZ, nombre: 'Encargado de Niñez', nivel: 3, area: 'Niñez',
        pierde: 'Deja de administrar el módulo de Niñez.',
    },

    {
        rol: UserRole.VOLUNTEER, nombre: 'Voluntario', nivel: 4, area: 'Transversal',
        pierde: 'Deja de ver la sección donde servía como voluntario.',
    },
    {
        rol: UserRole.EVENTOS, nombre: 'Eventos', nivel: 4, area: 'Eventos',
        pierde: 'Deja de entrar a la gestión de eventos.',
    },
    {
        rol: UserRole.ACREDITACION, nombre: 'Acreditación', nivel: 4, area: 'Eventos',
        pierde: 'Deja de poder acreditar en la puerta del evento.',
    },
    {
        rol: UserRole.INFLUOS, nombre: 'Influos', nivel: 4, area: 'Niñez',
        pierde: 'Deja de entrar al módulo de menores.',
    },
    {
        rol: UserRole.PRODE, nombre: 'Prode', nivel: 4, area: 'Prode',
        pierde: 'Deja de administrar el Prode.',
    },
    {
        rol: UserRole.PASTOR, nombre: 'Reportes', nivel: 4, area: 'Transversal',
        pierde: 'Deja de ver los reportes de la iglesia.',
    },
    {
        rol: UserRole.VIEWER, nombre: 'Usuario', nivel: 4, area: 'Transversal',
        pierde: 'Es el rol base: sin él y sin ningún otro, no ve ninguna sección.',
    },
];

export interface DefinicionNivel {
    titulo: string;
    sub: string;
    /** Resumen del acceso que da, para la tarjeta "Acceso actual". */
    resumen: string;
    detalle: string;
}

export const NIVELES: DefinicionNivel[] = [
    {
        titulo: 'Control total',
        sub: 'Ve y edita todo el sistema, incluidos los permisos de los demás. Una persona debería tenerlo, no más.',
        resumen: 'Control total del sistema',
        detalle: 'Puede cambiar los permisos de cualquier persona, incluidos los tuyos, y editar toda la configuración pública.',
    },
    {
        titulo: 'Anfitriones',
        sub: 'Lideran un grupo propio: su asistencia, sus solicitudes y sus miembros.',
        resumen: 'Anfitrión de un grupo',
        detalle: 'Administra su grupo completo: inscripciones, asistencia y miembros. No toca el resto del sistema.',
    },
    {
        titulo: 'Coordinadores',
        sub: 'Supervisan los grupos de una o más categorías y acompañan a sus anfitriones. Mirar y detectar, no editar.',
        resumen: 'Coordinación de un área',
        detalle: 'Trabaja sobre la gente y los datos de sus categorías, sin acceso a su configuración.',
    },
    {
        titulo: 'Encargados',
        sub: 'Administran un área completa: su gente, sus datos y su configuración.',
        resumen: 'Gestión de un área',
        detalle: 'Administra su módulo entero. No toca los permisos ni la configuración general de la app.',
    },
    {
        titulo: 'Operativos',
        sub: 'Acceso al trabajo concreto: su turno, su módulo, sus reportes.',
        resumen: 'Acceso operativo',
        detalle: 'Ve solamente lo suyo: su turno, su módulo o sus reportes.',
    },
];

// ── Lecturas ──────────────────────────

export const definicionDe = (rol: UserRole): DefinicionRol | undefined =>
    CATALOGO_ROLES.find(d => d.rol === rol);

/**
 * Nombres de los roles que existen en la base pero no se asignan desde acá.
 * Los tres de voluntariado se los agrega el selector de área al guardar, y
 * hay gente que arrastra alguno de los viejos. Sin esta tabla las pastillas
 * mostraban el valor crudo del enum, en mayúsculas y con guiones bajos.
 */
const NOMBRES_NO_ASIGNABLES: Partial<Record<UserRole, string>> = {
    [UserRole.VOLUNTARIO_GRUPOS]: 'Voluntario de Grupos',
    [UserRole.VOLUNTARIO_INFO]: 'Voluntario de Punto',
    [UserRole.VOLUNTARIO_BIENVENIDA]: 'Voluntario de Bienvenida',
    [UserRole.VOLUNTARIO]: 'Voluntario',
    [UserRole.USUARIO]: 'Usuario',
    [UserRole.ENCARGADO_GRUPOS]: 'Encargado de Grupos',
    [UserRole.ENCARGADO_PUNTO]: 'Encargado de Punto',
    [UserRole.ENCARGADO_STORE]: 'Encargado de Store',
    [UserRole.ENCARGADO_ALABANZA]: 'Encargado de Alabanza',
    [UserRole.REPORTES]: 'Reportes',
};

export const nombreDeRol = (rol: UserRole): string =>
    definicionDe(rol)?.nombre
    ?? NOMBRES_NO_ASIGNABLES[rol]
    ?? String(rol).replace(/_/g, ' ');

/** Los roles que tiene un usuario, con el respaldo al campo singular viejo. */
export const rolesDe = (u: User): UserRole[] =>
    (u.roles && u.roles.length > 0 ? u.roles : (u.role ? [u.role] : []));

/**
 * Nivel de acceso de una persona: el más alto que le dé alguno de sus roles.
 * Un rol que este panel no conoce no baja el nivel — se ignora para el
 * cálculo pero se sigue mostrando como pastilla, así nadie pierde de vista
 * que lo tiene.
 */
export const nivelDe = (roles: UserRole[]): NivelAcceso => {
    const conocidos = roles
        .map(r => definicionDe(r)?.nivel)
        .filter((n): n is NivelAcceso => n !== undefined);
    return conocidos.length ? Math.min(...conocidos) as NivelAcceso : 4;
};

/** Roles que dan acceso real a algo. VIEWER es el rol base de cualquiera. */
export const rolesConAcceso = (roles: UserRole[]): UserRole[] =>
    roles.filter(r => r !== UserRole.VIEWER);

export type ClaveFiltro =
    | 'todos' | 'control' | 'anfitriones' | 'coordinadores'
    | 'encargados' | 'operativos' | 'voluntarios' | 'sinrol';

/** En qué cajón del filtro cae una persona. */
export const cajonDe = (u: User): Exclude<ClaveFiltro, 'todos' | 'voluntarios'> => {
    const roles = rolesDe(u);
    if (rolesConAcceso(roles).length === 0) return 'sinrol';
    switch (nivelDe(roles)) {
        case 0: return 'control';
        case 1: return 'anfitriones';
        case 2: return 'coordinadores';
        case 3: return 'encargados';
        default: return 'operativos';
    }
};

export const FILTROS: { id: ClaveFiltro; label: string }[] = [
    { id: 'todos', label: 'Todos' },
    { id: 'control', label: 'Control total' },
    { id: 'anfitriones', label: 'Anfitriones' },
    { id: 'coordinadores', label: 'Coordinadores' },
    { id: 'encargados', label: 'Encargados' },
    { id: 'operativos', label: 'Operativos' },
    // El listado viejo tenía una pestaña solo para voluntarios y se usa: un
    // voluntario cae en "Operativos" junto a Eventos, Prode y Reportes, así
    // que sin esta entrada no habría forma de aislarlos.
    { id: 'voluntarios', label: 'Voluntarios' },
    { id: 'sinrol', label: 'Sin rol' },
];

export const cumpleFiltro = (u: User, filtro: ClaveFiltro): boolean => {
    if (filtro === 'todos') return true;
    if (filtro === 'voluntarios') return rolesDe(u).includes(UserRole.VOLUNTEER);
    return cajonDe(u) === filtro;
};

/**
 * Áreas del directorio: quién responde por cada parte del sistema.
 * Se listan las áreas que tienen un rol de nivel 2 o 3 asociado, que son
 * las que tienen dueño; "Transversal" no es un área de nadie.
 */
export const AREAS_DIRECTORIO: string[] = Array.from(new Set(
    CATALOGO_ROLES
        .filter(d => d.nivel === 2 || d.nivel === 3)
        .map(d => d.area)
));

export const iniciales = (nombre: string): string => {
    const soloTexto = (nombre || '').replace(/[^\p{L}\p{N}\s]/gu, ' ');
    return soloTexto
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(palabra => Array.from(palabra)[0])
        .join('')
        .toUpperCase() || '??';
};
