// ════════════════════════════════════════════════════════════════════════
// Modalidad de un grupo: presencial, online o híbrido.
//
// En la base son dos columnas, groups.is_online y groups.is_hybrid, y un
// CHECK impide que las dos estén en true. En la interfaz es una sola
// elección. Estas funciones son el único lugar donde se traduce de una forma
// a la otra: si cada pantalla lo resolviera a mano, alguna terminaría
// mostrando "Online" para un híbrido.
// ════════════════════════════════════════════════════════════════════════
import { ModalidadGrupo, ModoReunion } from '../../types';

export const MODALIDADES: ModalidadGrupo[] = ['presencial', 'online', 'hibrido'];

export const NOMBRE_MODALIDAD: Record<ModalidadGrupo, string> = {
    presencial: 'Presencial',
    online: 'Online',
    hibrido: 'Híbrido',
};

export const NOMBRE_MODO_REUNION: Record<ModoReunion, string> = {
    presencial: 'Presencial',
    online: 'Online',
};

interface ConModalidad {
    isOnline?: boolean;
    isHybrid?: boolean;
    location?: string;
}

export const modalidadDe = (g: ConModalidad): ModalidadGrupo =>
    g.isHybrid ? 'hibrido' : g.isOnline ? 'online' : 'presencial';

/** Las dos columnas que se guardan para una modalidad elegida. */
export const banderasDe = (m: ModalidadGrupo): { isOnline: boolean; isHybrid: boolean } => ({
    isOnline: m === 'online',
    isHybrid: m === 'hibrido',
});

/** El único caso sin dirección es el online: el híbrido también se junta en persona. */
export const llevaDireccion = (m: ModalidadGrupo): boolean => m !== 'online';

/**
 * Dónde se reúne, en una línea: "Online", "Floresta" o "Floresta y online".
 *
 * `sinUbicacion` es lo que se muestra si un presencial no tiene dirección
 * cargada; cada pantalla ya tenía su propio texto para ese caso.
 */
export const dondeSeReune = (g: ConModalidad, sinUbicacion = ''): string => {
    const direccion = (g.location || '').trim();
    if (g.isHybrid) return direccion ? `${direccion} y online` : 'Híbrido';
    if (g.isOnline) return 'Online';
    return direccion || sinUbicacion;
};
