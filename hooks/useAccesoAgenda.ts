import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getMiAcceso, type MiAcceso } from '../services/agenda';

/**
 * Qué puede ver cada uno en Agenda Origen.
 *
 * El acceso va por pertenencia (encargado de un departamento, quien dirige un
 * sub-departamento), no por rol, así que no alcanza con hasRole: hay que
 * preguntarle a la base (agenda_mi_acceso). Se pregunta UNA vez por sesión y
 * el resultado se comparte entre todos los componentes que usen el hook.
 *
 * Vive en memoria, no en localStorage (instrucciones, 12.16): el caché nunca
 * decide acceso. Si se cierra la pestaña o cambia la persona, se vuelve a
 * preguntar. Las RPC igual vuelven a chequear todo en la base.
 *
 * Sin sesión no se llama a la base: el acceso es vacío.
 */

const VACIO: MiAcceso = { superAdmin: false, encargado: [], dirijo: [], miembro: [] };

interface Estado {
    /** De quién es lo guardado. Cambia la sesión → se pregunta de nuevo. */
    userId: string | null;
    acceso: MiAcceso;
    cargando: boolean;
    /** true si la última consulta falló: el acceso que queda es el vacío. */
    fallo: boolean;
}

let estado: Estado = { userId: null, acceso: VACIO, cargando: false, fallo: false };
let enCurso: Promise<void> | null = null;
const avisos = new Set<(e: Estado) => void>();

const publicar = (nuevo: Estado) => {
    estado = nuevo;
    avisos.forEach(fn => fn(estado));
};

const traer = (userId: string): Promise<void> => {
    // Recargar NO vuelve a "cargando" si ya había algo de esta persona: el
    // menú esconde "Departamentos" mientras carga, y una recarga (la que hace
    // /departamentos para tener los números al día) lo haría parpadear.
    const yaHabia = estado.userId === userId && !estado.fallo && !estado.cargando;
    if (!yaHabia) publicar({ ...estado, userId, cargando: true });
    const promesa = getMiAcceso().then(r => {
        // Si en el medio cambió la sesión, esta respuesta ya no es de nadie.
        if (estado.userId !== userId) return;
        if (r.ok) {
            publicar({ userId, acceso: { superAdmin: r.superAdmin, encargado: r.encargado, dirijo: r.dirijo, miembro: r.miembro }, cargando: false, fallo: false });
        } else if (!yaHabia) {
            publicar({ userId, acceso: VACIO, cargando: false, fallo: true });
        }
        // Una recarga que falla deja lo que había: es más cierto que vaciarlo.
    }).finally(() => { if (enCurso === promesa) enCurso = null; });
    enCurso = promesa;
    return promesa;
};

export const useAccesoAgenda = () => {
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const [actual, setActual] = useState<Estado>(estado);

    useEffect(() => {
        avisos.add(setActual);
        return () => { avisos.delete(setActual); };
    }, []);

    useEffect(() => {
        if (!userId) {
            if (estado.userId !== null || estado.acceso !== VACIO) {
                publicar({ userId: null, acceso: VACIO, cargando: false, fallo: false });
            }
            return;
        }
        // Una vez por sesión: si ya está (o se está trayendo) para esta persona, no se repite.
        if (estado.userId === userId && (enCurso || !estado.fallo)) {
            setActual(estado);
            return;
        }
        traer(userId);
    }, [userId]);

    const recargar = useCallback(() => (userId ? traer(userId) : Promise.resolve()), [userId]);

    // Mientras no corresponde a la sesión actual, se lo trata como cargando.
    const deEstaSesion = actual.userId === userId;
    const acceso = deEstaSesion ? actual.acceso : VACIO;
    const cargando = !!userId && (!deEstaSesion || actual.cargando);

    const esEncargadoDe = useCallback(
        (departamentoId: string) => acceso.superAdmin || acceso.encargado.some(d => d.id === departamentoId),
        [acceso],
    );
    const dirige = useCallback(
        (subdepartamentoId: string) => acceso.dirijo.some(s => s.id === subdepartamentoId),
        [acceso],
    );

    return {
        cargando,
        acceso,
        /** La última consulta falló (red): la pantalla puede ofrecer reintentar. */
        fallo: deEstaSesion && actual.fallo,
        puedeVerDepartamentos: acceso.superAdmin || acceso.encargado.length > 0 || acceso.dirijo.length > 0,
        esEncargadoDe,
        dirige,
        recargar,
    };
};

export default useAccesoAgenda;
