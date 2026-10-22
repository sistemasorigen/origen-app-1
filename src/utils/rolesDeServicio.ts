/**
 * Los roles, en el idioma de la persona que los tiene.
 *
 * Un rol en la base es un código: VOLUNTARIO_INFO, ENCARGADO_GRUPOS. Eso no
 * se le muestra a nadie. Acá vive la traducción, en UN solo lugar, para que
 * "Dónde sirvo" y cualquier otra pantalla que la necesite digan lo mismo.
 *
 * La ruta de "Ir al panel" es LA MISMA que usa el menú deslizable, a
 * propósito: si el menú lleva a /punto-de-informacion?view=PANEL y esto
 * llevara a /punto-de-informacion, serían dos puertas a la misma pantalla
 * que abren distinto.
 */

/** Los íconos salen del mismo juego que el resto de Mi cuenta. */
export type IconoDeServicio =
    | 'grupos' | 'info' | 'servir' | 'entrada' | 'campana' | 'escudo' | 'play' | 'documento';

export interface ServicioQueHace {
    /** La clave con la que se dedupla. Nunca se muestra. */
    clave: string;
    nombre: string;
    icono: IconoDeServicio;
    /** A dónde lleva "Ir al panel". Sin ruta, la tarjeta va sin botón. */
    ruta?: string;
}

/**
 * Qué significa cada rol. Sólo los que son SERVIR: los permisos puros
 * (VIEWER, USUARIO) no son un área y no aparecen.
 */
const POR_ROL: Record<string, Omit<ServicioQueHace, 'clave'>> = {
    ANFITRION: { nombre: 'Anfitrión/a de GCX', icono: 'grupos', ruta: '/mis-grupos' },
    CO_ANFITRION: { nombre: 'Co-anfitrión/a de GCX', icono: 'grupos', ruta: '/mis-grupos' },
    COORDINATOR: { nombre: 'Coordinador/a de GCX', icono: 'grupos', ruta: '/coordinators?tab=dashboard' },

    VOLUNTARIO_INFO: { nombre: 'Voluntario/a en el Punto de Información', icono: 'info', ruta: '/punto-de-informacion?view=PANEL' },
    ENCARGADO_PUNTO: { nombre: 'Encargado/a del Punto de Información', icono: 'info', ruta: '/punto-de-informacion?view=PANEL' },
    ADMIN_PUNTO: { nombre: 'Administra el Punto de Información', icono: 'info', ruta: '/punto-de-informacion?view=PANEL' },

    VOLUNTARIO_GRUPOS: { nombre: 'Voluntario/a en GCX', icono: 'grupos', ruta: '/admingcx' },
    ENCARGADO_GRUPOS: { nombre: 'Encargado/a de GCX', icono: 'grupos', ruta: '/admingcx' },
    ADMIN_GROUPS: { nombre: 'Administra GCX', icono: 'grupos', ruta: '/admingcx' },

    VOLUNTARIO_BIENVENIDA: { nombre: 'Voluntario/a en Bienvenida', icono: 'servir', ruta: '/bienvenida' },
    ENCARGADO_BIENVENIDA: { nombre: 'Encargado/a de Bienvenida', icono: 'servir', ruta: '/bienvenida' },

    ENCARGADO_EVENTOS: { nombre: 'Encargado/a de eventos', icono: 'entrada', ruta: '/panel-eventos' },
    ACREDITACION: { nombre: 'Acreditación en eventos', icono: 'entrada', ruta: '/panel-eventos' },

    ENCARGADO_ALABANZA: { nombre: 'Encargado/a de Alabanza', icono: 'play', ruta: '/alabanza' },
    ADMIN_ALABANZA: { nombre: 'Administra Alabanza', icono: 'play', ruta: '/alabanza' },

    INFLUOS: { nombre: 'Influos', icono: 'campana', ruta: '/influos' },
    REPORTES: { nombre: 'Mira los reportes', icono: 'documento', ruta: '/reportes/gcx' },

    PASTOR: { nombre: 'Pastor/a', icono: 'escudo' },
    SUPER_ADMIN: { nombre: 'Sistemas', icono: 'escudo', ruta: '/panel-admin' },
    ADMIN_CUIDADO_PASTORAL: { nombre: 'Cuidado pastoral', icono: 'escudo' },
};

/** Los `volunteer_roles`, que son otra lista y van por su cuenta. */
const POR_VOLUNTARIADO: Record<string, Omit<ServicioQueHace, 'clave'>> = {
    PUNTO: { nombre: 'Voluntario/a en el Punto de Información', icono: 'info', ruta: '/punto-de-informacion?view=PANEL' },
    GROUPS: { nombre: 'Voluntario/a en GCX', icono: 'grupos', ruta: '/admingcx' },
    STORE: { nombre: 'Voluntario/a en la tienda', icono: 'servir', ruta: '/store' },
};

/**
 * Todo lo que esta persona hace, sin repetir y sin códigos.
 *
 * Se deduplica por NOMBRE y no por rol: quien tiene VOLUNTARIO_INFO y además
 * 'PUNTO' en volunteer_roles sirve en un solo lugar, no en dos.
 */
export const serviciosDe = (persona: {
    role?: unknown;
    roles?: unknown[];
    volunteerRoles?: unknown[];
} | null | undefined): ServicioQueHace[] => {
    if (!persona) return [];

    const codigos = [
        String(persona.role ?? ''),
        ...((persona.roles as unknown[] | undefined) || []).map(String),
    ].filter(Boolean);

    const voluntariados = ((persona.volunteerRoles as unknown[] | undefined) || []).map(String);

    const salida: ServicioQueHace[] = [];
    const vistos = new Set<string>();

    const sumar = (clave: string, dato?: Omit<ServicioQueHace, 'clave'>) => {
        if (!dato || vistos.has(dato.nombre)) return;
        vistos.add(dato.nombre);
        salida.push({ clave, ...dato });
    };

    codigos.forEach(c => sumar(c, POR_ROL[c]));
    voluntariados.forEach(v => sumar(`vol:${v}`, POR_VOLUNTARIADO[v]));

    return salida;
};

/** ¿Es anfitrión o co-anfitrión? Lo usan el conteo y la tarjeta del grupo. */
export const esAnfitrionDeAlgo = (persona: { role?: unknown; roles?: unknown[] } | null | undefined): boolean => {
    if (!persona) return false;
    const codigos = [String(persona.role ?? ''), ...((persona.roles as unknown[] | undefined) || []).map(String)];
    return codigos.some(c => c === 'ANFITRION' || c === 'CO_ANFITRION');
};
