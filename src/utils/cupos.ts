import { GroupRegistration } from '../../types';

/**
 * Cupos de un GCX: cuántos lugares ocupa cada inscripción.
 *
 * Un lugar por persona. Una inscripción ocupa uno, o dos si vino con pareja.
 *
 * Lo que decide es la inscripción, no el grupo. Antes se miraba si el grupo
 * era "de parejas" —por categoría o por etiqueta— y se contaba cada
 * inscripción doble, viniera o no con alguien. En "Amando a nuestros hijos a
 * propósito", etiquetado `parejas`, cuatro personas que se anotaron solas
 * figuraban como ocho: 8/12 con ocho lugares libres de verdad.
 *
 * Es una sola regla para todas las pantallas a propósito: el cupo que ve el
 * admin en la lista, en la ficha y al agregar un miembro tiene que ser el
 * mismo número.
 */

type ConPareja = Pick<GroupRegistration, 'partnerData' | 'partnerUserId'>;

/** Si la inscripción trae pareja: con cuenta en la app, o cargada a mano. */
export const tienePareja = (r: ConPareja): boolean => {
    if (r.partnerUserId) return true;
    const p = r.partnerData;
    return !!p && !!(p.firstName?.trim() || p.lastName?.trim() || p.email?.trim());
};

export const lugaresQueOcupa = (r: ConPareja): number => (tienePareja(r) ? 2 : 1);

export const lugaresOcupados = (inscripciones: ConPareja[] | undefined | null): number =>
    (inscripciones || []).reduce((n, r) => n + lugaresQueOcupa(r), 0);
