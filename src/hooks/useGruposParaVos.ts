import { Group, GroupCategory, User } from '../../types';

/**
 * Qué grupos se le recomiendan a esta persona en la portada.
 *
 * Vivía adentro de pages/home/Home.tsx. Se movió tal cual —mismas señales,
 * mismo orden, mismo tope de ocho— para que /novedades recomiende
 * exactamente lo mismo que el inicio: dos copias de un criterio terminan
 * siempre en dos listas distintas.
 *
 * No memoriza nada a propósito: se recalcula en cada render, igual que
 * cuando era un par de IIFE adentro del Home.
 */

export interface GruposParaVos {
    /** Hasta ocho, ordenados por afinidad. */
    recomendados: Group[];
    /** La categoría donde más participa, si participa en alguna. */
    categoriaPrincipal?: string;
}

export const useGruposParaVos = (
    groups: Group[],
    categories: GroupCategory[],
    currentUser: User | null,
): GruposParaVos => {
    // --- Algoritmo de recomendación de "Grupos para vos" ---
    // Señal: a qué categorías pertenecen los grupos donde el usuario tiene
    // una inscripción APPROVED (participante real, no solicitud pendiente
    // ni rechazada). Cuantos más grupos aprobados tenga en una categoría
    // (ej. "La FEMME", "Currícula", "Finanzas"), más peso tiene esa
    // categoría a la hora de ordenar las recomendaciones.
    const isUserRegistration = (r: { userId?: string; email: string }) =>
        !!currentUser && (r.userId === currentUser.id || r.email === currentUser.email);

    // Mismo criterio de "Activo" que usa el resto de la app (ver
    // supabaseService.getGroupRegistrationAnalytics): aprobado y sin
    // haber pasado su fecha de fin — un grupo puede seguir con
    // status 'approved' en la base aunque su temporada ya terminó.
    const isGroupActive = (g: Group) =>
        g.status === 'approved' && (!g.endDate || new Date(g.endDate) >= new Date());

    const userCategoryWeights = (() => {
        const weights = new Map<string, number>();
        if (!currentUser) return weights;
        groups.forEach(g => {
            if (!g.categoryId) return;
            const isApprovedMember = g.registrations?.some(r => r.status === 'APPROVED' && isUserRegistration(r));
            if (isApprovedMember) {
                weights.set(g.categoryId, (weights.get(g.categoryId) || 0) + 1);
            }
        });
        return weights;
    })();

    const topCategoryName = (() => {
        const top = [...userCategoryWeights.entries()].sort((a, b) => b[1] - a[1])[0];
        return top ? categories.find(c => c.id === top[0])?.name : undefined;
    })();

    const recommendedGroups = (() => {
        // Solo grupos Activos; y no recomendar a los que ya pertenece o ya aplicó.
        const notJoined = groups.filter(g => !g.isHidden && isGroupActive(g) && !g.registrations?.some(isUserRegistration));
        const withOpenSpots = notJoined.filter(g => !g.capacityLocked && (g.maxCapacity - g.membersCount) > 0);
        const pool = withOpenSpots.length > 0 ? withOpenSpots : notJoined;

        if (userCategoryWeights.size === 0) return pool.slice(0, 8);

        // Orden estable: primero las categorías donde el usuario más
        // participa; dentro de un mismo peso, se preserva el orden original.
        const ranked = [...pool].sort((a, b) => {
            const weightA = (a.categoryId && userCategoryWeights.get(a.categoryId)) || 0;
            const weightB = (b.categoryId && userCategoryWeights.get(b.categoryId)) || 0;
            return weightB - weightA;
        });
        return ranked.slice(0, 8);
    })();

    return { recomendados: recommendedGroups, categoriaPrincipal: topCategoryName };
};
