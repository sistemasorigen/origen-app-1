import React, { useMemo } from 'react';
import { User } from '../../types';
import {
    AREAS_DIRECTORIO,
    CATALOGO_ROLES,
    iniciales,
    rolesDe,
} from './catalogoRoles';
import { Rotulo } from './piezasAdmin';

/**
 * Directorio de responsables (design-claude/Admin General).
 *
 * Responde a una sola pregunta: a quién le pido algo de esta área. Se arma
 * solo, con los roles de coordinación y de encargado que ya están asignados,
 * y marca en ámbar las áreas que no tienen a nadie — que es el dato que más
 * cuesta descubrir cuando alguien deja de servir.
 *
 * Antes esta vista listaba a los 412 usuarios con sus etiquetas y solo se
 * llegaba escribiendo ?tab=leaders a mano. Ahora está en la barra y muestra
 * lo que su nombre promete; para ver a todos está el listado de Usuarios,
 * y tocando a una persona se abre su ficha, como antes.
 */

interface Props {
    usuarios: User[];
    onAbrir: (u: User) => void;
    cargando: boolean;
}

const DirectorioAdmin: React.FC<Props> = ({ usuarios, onAbrir, cargando }) => {
    const areas = useMemo(() => AREAS_DIRECTORIO.map(area => {
        const rolesDelArea = CATALOGO_ROLES.filter(d => d.area === area && (d.nivel === 2 || d.nivel === 3));
        const personas: { usuario: User; rol: string }[] = [];

        usuarios.forEach(u => {
            const suyos = rolesDe(u);
            rolesDelArea.forEach(def => {
                if (suyos.includes(def.rol)) personas.push({ usuario: u, rol: def.nombre });
            });
        });

        personas.sort((a, b) => (a.usuario.name || '').localeCompare(b.usuario.name || '', 'es'));
        return { area, personas };
    }), [usuarios]);

    if (cargando) {
        return (
            <div className="grid gap-3 [grid-template-columns:minmax(0,1fr)] md:[grid-template-columns:repeat(auto-fill,minmax(290px,1fr))]">
                {[0, 1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-[150px] rounded-[20px] bg-white" />
                ))}
            </div>
        );
    }

    return (
        <>
            <p className="mx-0.5 mb-3 max-w-[640px] text-[13px] font-medium leading-[1.6] text-black/[.62]">
                Quién responde por cada área del sistema. Es la vista que se consulta cuando hay que saber a quién
                pedirle algo; los permisos se editan desde Usuarios.
            </p>

            <div className="grid gap-3 [grid-template-columns:minmax(0,1fr)] md:[grid-template-columns:repeat(auto-fill,minmax(290px,1fr))]">
                {areas.map(({ area, personas }) => (
                    <div key={area} className="min-w-0 rounded-[20px] bg-white px-5 py-[18px]">
                        <div className="flex items-center gap-2.5">
                            <span className={`h-2 w-2 flex-none rounded-full ${personas.length ? 'bg-[#0a0a0a]' : 'bg-[#e8b96a]'}`} />
                            <Rotulo className="min-w-0 flex-1 truncate text-black/[.55]">{area}</Rotulo>
                            {personas.length > 0 && (
                                <span className="flex h-[22px] min-w-[22px] flex-none items-center justify-center rounded-full bg-[#f7f7f5] px-[7px] text-[11.5px] font-semibold text-black/[.55]">
                                    {personas.length}
                                </span>
                            )}
                        </div>

                        <div className="mt-4 flex flex-col gap-2.5">
                            {personas.length === 0 ? (
                                <div className="rounded-[14px] bg-[#fdf6ea] px-3.5 py-3">
                                    <p className="text-[12.5px] font-semibold text-[#7a4f10]">Sin responsable asignado</p>
                                    <p className="mt-1 text-[12px] font-medium leading-[1.5] text-black/[.62]">
                                        Nadie puede administrar esta área hasta que se asigne el rol.
                                    </p>
                                </div>
                            ) : personas.map(({ usuario, rol }) => (
                                <button
                                    key={`${usuario.id}-${rol}`}
                                    onClick={() => onAbrir(usuario)}
                                    className="flex w-full items-center gap-2.5 rounded-[14px] text-left transition-colors hover:bg-[#f7f7f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                >
                                    <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[#f2f2f0] text-[11.5px] font-semibold text-black/[.6]">
                                        {iniciales(usuario.name || usuario.email || '')}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[13.5px] font-semibold text-[#0a0a0a]">
                                            {usuario.name || 'Sin nombre'}
                                        </span>
                                        <span className="mt-[2px] block truncate text-[12px] font-medium text-black/[.6]">
                                            {rol}{usuario.isActive ? '' : ' · cuenta inactiva'}
                                        </span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
};

export default DirectorioAdmin;
