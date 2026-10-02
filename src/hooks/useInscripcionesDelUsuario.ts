import { useCallback, useEffect, useState } from 'react';
import { GroupRegistration, User } from '../../types';
import { supabaseService } from '../../services/supabaseService';

/**
 * En qué grupos está anotada esta persona, y con qué estado.
 *
 * Lo necesitan las dos pantallas que muestran tarjetas de GCX —el listado de
 * /gcx y el carrusel "Grupos para vos" del Home— porque es lo que decide si
 * el botón dice "Unirme", "Esperando respuesta" o "Ya sos miembro". Vivía
 * suelto adentro de Grupos.tsx; al traerlo acá las dos pantallas responden
 * igual, que es justamente lo que se rompe cuando hay dos copias.
 *
 * La parte que no es obvia es la de las parejas. Una inscripción de a dos
 * tiene un titular y un acompañante, y los dos tienen que ver el mismo
 * estado. El acompañante se reconoce de dos maneras porque las dos ocurren:
 * por `partnerUserId` cuando quedó vinculado, y por email cuando no —que es
 * lo que pasa si se lo cargó antes de que tuviera cuenta—. Mirar sólo el id
 * deja a media pareja viendo "Unirme" en un grupo donde ya está.
 */

export interface InscripcionesDelUsuario {
    inscripciones: GroupRegistration[];
    /** El estado de esta persona en ese grupo, o null si no se anotó. */
    estadoEnGrupo: (groupId: string) => 'PENDING' | 'APPROVED' | 'REJECTED' | null;
    /** Para volver a leer después de anotarse. */
    recargar: () => Promise<void>;
}

export const useInscripcionesDelUsuario = (
    currentUser: User | null | undefined,
): InscripcionesDelUsuario => {
    const [inscripciones, setInscripciones] = useState<GroupRegistration[]>([]);

    const recargar = useCallback(async () => {
        if (!currentUser) { setInscripciones([]); return; }
        try {
            const porId = await supabaseService.getUserRegistrations(currentUser.id, currentUser.email);

            // Segunda vuelta por email: cubre al acompañante que todavía no
            // quedó vinculado por id.
            let porEmail: GroupRegistration[] = [];
            if (currentUser.email) {
                porEmail = await supabaseService.getPartnerRegistrationsByEmail(currentUser.email);
            }

            const todas = [...porId];
            porEmail.forEach(r => {
                if (!todas.find(y => y.id === r.id)) todas.push(r);
            });

            setInscripciones(todas);
        } catch (err) {
            console.error('[useInscripcionesDelUsuario] No se pudieron traer las inscripciones:', err);
        }
    }, [currentUser]);

    useEffect(() => { recargar(); }, [recargar]);

    const estadoEnGrupo = useCallback((groupId: string) => {
        const deEsteGrupo = inscripciones.filter(r => {
            if (r.groupId !== groupId) return false;

            const esTitular = r.userId === currentUser?.id;
            const esPareja = (r.partnerUserId === currentUser?.id)
                || !!(currentUser?.email && r.partnerData?.email
                    && r.partnerData.email.toLowerCase().trim() === currentUser.email.toLowerCase().trim());

            return esTitular || esPareja;
        });

        // Aprobado gana sobre pendiente, y pendiente sobre rechazado. Un
        // rechazo se muestra —no se esconde— porque desde ahí se puede volver
        // a intentar, que es lo que necesita una pareja que quiere reanotarse.
        if (deEsteGrupo.some(r => r.status === 'APPROVED')) return 'APPROVED';
        if (deEsteGrupo.some(r => r.status === 'PENDING')) return 'PENDING';
        if (deEsteGrupo.some(r => r.status === 'REJECTED')) return 'REJECTED';
        return null;
    }, [inscripciones, currentUser]);

    return { inscripciones, estadoEnGrupo, recargar };
};
