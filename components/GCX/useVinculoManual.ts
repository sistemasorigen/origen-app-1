import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';

/**
 * Busca la cuenta de alguien escrito a mano.
 *
 * Escribir "Johanna Nasute" en el modo A mano dejaba sólo el texto: el grupo
 * quedaba con el nombre y sin `co_host_id`, así que esa persona no era
 * co-anfitriona de nada —no le aparecía el grupo, no le llegaban las
 * notificaciones y no contaba para el rol—. Si la persona tiene cuenta, el
 * modo a mano tiene que vincularla igual que el buscador.
 *
 * Vincula sólo cuando hay una coincidencia exacta y única. Dos personas que
 * se llaman igual, o un nombre que sólo coincide de a pedazos, no alcanzan
 * para decidir por quien carga el grupo: en ese caso queda el texto suelto,
 * que es lo que el modo a mano hacía siempre.
 */
export interface CuentaVinculada {
    id: string;
    name: string;
    email: string;
}

/** Sin acentos, sin mayúsculas y con un solo espacio: "Lucía" == "lucia". */
const normalizar = (s: string) =>
    (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export const useVinculoManual = (
    nombre: string,
    apellido: string,
    activo: boolean,
): { cuenta: CuentaVinculada | null; buscando: boolean } => {
    const [cuenta, setCuenta] = useState<CuentaVinculada | null>(null);
    const [buscando, setBuscando] = useState(false);

    const completo = `${(nombre || '').trim()} ${(apellido || '').trim()}`.trim();

    useEffect(() => {
        // Hacen falta las dos partes: con el nombre solo, "Ana" coincidiría
        // con la primera Ana de la lista.
        if (!activo || !nombre?.trim() || !apellido?.trim()) {
            setCuenta(null);
            return;
        }
        let vigente = true;
        const timer = setTimeout(async () => {
            setBuscando(true);
            try {
                const { data, error } = await supabase.rpc('buscar_personas', {
                    p_termino: completo,
                    p_por_email: false,
                    p_solo_activos: true,
                    p_limite: 8,
                });
                if (error) throw error;
                const exactas = ((data as any[]) || [])
                    .filter(u => normalizar(u.name) === normalizar(completo));
                if (vigente) setCuenta(exactas.length === 1 ? exactas[0] : null);
            } catch (e) {
                console.error('[Co-anfitrión a mano] no se pudo buscar la cuenta:', e);
                if (vigente) setCuenta(null);
            } finally {
                if (vigente) setBuscando(false);
            }
        }, 450);
        return () => { vigente = false; clearTimeout(timer); };
    }, [completo, activo, nombre, apellido]);

    return { cuenta, buscando };
};
