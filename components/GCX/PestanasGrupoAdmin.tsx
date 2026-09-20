import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Pestañas de un grupo (design-claude/Admin GCX - Detalle e Inscriptos).
 *
 * Las tres pantallas que cuelgan de un grupo —su ficha, sus inscriptos y el
 * alta a mano— son un solo lugar con tres pestañas. Van en la banda blanca
 * del armazón, así que se pasan por la prop `tabs`.
 *
 * Las tres SIEMPRE cuelgan de un grupo. "Agregar a mano" abierto desde el
 * panel, sin grupo, es otra pantalla —el buscador de grupos— y esa no lleva
 * pestañas: no hay una ficha ni unos inscriptos a los que saltar.
 *
 * El id viaja en la URL y no en `location.state` para que la pestaña
 * sobreviva a un refresh y el link se pueda pasar por mensaje.
 */

export type PestanaGrupo = 'detalle' | 'inscriptos' | 'agregar';

interface PestanasGrupoAdminProps {
    activa: PestanaGrupo;
    groupId?: string | null;
    /** Cuántas inscripciones tiene el grupo, para el globo de la pestaña. */
    nInscriptos?: number;
    /**
     * Mientras el grupo espera aprobación quedan SOLO la ficha: no tiene
     * inscriptos que mirar ni se le puede anotar gente, así que las otras dos
     * pestañas llevarían a pantallas vacías o a una acción que el guardado
     * rechaza. Se ocultan en vez de apagarse: apagadas siguen diciendo que
     * ahí hay algo, y todavía no lo hay.
     */
    pendiente?: boolean;
}

const PestanasGrupoAdmin: React.FC<PestanasGrupoAdminProps> = ({ activa, groupId, nInscriptos, pendiente }) => {
    const navigate = useNavigate();

    const pestana = (on: boolean, apagada = false) =>
        `flex h-[38px] flex-none items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${apagada
            ? 'cursor-not-allowed bg-[#f7f7f5] text-black/[.35]'
            : on
                ? 'bg-[#0a0a0a] text-white'
                : 'bg-[#f2f2f0] text-black/[.62] hover:text-[#0a0a0a]'}`;

    const globo = (on: boolean) =>
        `flex h-[21px] items-center rounded-full px-2 text-[11.5px] font-semibold ${on ? 'bg-white/20 text-white' : 'bg-[#eceae6] text-black/[.62]'}`;

    const sinGrupo = !groupId;

    return (
        <>
            <button
                onClick={() => groupId && navigate(`/admingcx/gestion-de-grupos/detalles/${groupId}`)}
                disabled={sinGrupo}
                className={pestana(activa === 'detalle', sinGrupo)}
            >
                Ficha del grupo
            </button>

            {!pendiente && (
                <>
                    <button
                        onClick={() => groupId && navigate(`/admingcx/gestion-de-grupos/inscriptos/${groupId}`)}
                        disabled={sinGrupo}
                        className={pestana(activa === 'inscriptos', sinGrupo)}
                    >
                        Inscriptos
                        {nInscriptos !== undefined && !sinGrupo && (
                            <span className={globo(activa === 'inscriptos')}>{nInscriptos}</span>
                        )}
                    </button>

                    <button
                        onClick={() => groupId && navigate(`/admingcx/gestion-de-grupos/agregar-grupo?grupo=${encodeURIComponent(groupId)}`)}
                        disabled={sinGrupo}
                        className={pestana(activa === 'agregar', sinGrupo)}
                    >
                        Agregar a mano
                    </button>
                </>
            )}
        </>
    );
};

export default PestanasGrupoAdmin;
