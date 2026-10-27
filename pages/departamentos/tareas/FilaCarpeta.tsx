import React from 'react';
import { ChevronDown, Folder, MoreHorizontal } from 'lucide-react';
import type { Carpeta } from '../../../services/agenda';
import { plural, tinte } from '../../admin/departamentos/piezas';

/**
 * La fila de una carpeta dentro de un día: se abre y se cierra con un toque,
 * y el ⋯ lleva a editarla o eliminarla (design-claude/Departamento -
 * Tareas).
 *
 * Abiertas por defecto: una carpeta cerrada esconde tareas, y la lista es
 * para ver todo lo que hay. Se cierra para despejar, no para empezar.
 *
 * Sin `onMenu` no se dibuja el ⋯: en el panel de quien dirige un
 * sub-departamento las carpetas se ven pero no se tocan.
 */

const FilaCarpeta: React.FC<{
    carpeta: Carpeta;
    cuantas: number;
    abierta: boolean;
    onAlternar: () => void;
    /** Sin esto, la carpeta no ofrece editarla ni eliminarla. */
    onMenu?: () => void;
    children: React.ReactNode;
}> = ({ carpeta, cuantas, abierta, onAlternar, onMenu, children }) => (
    <div
        className="rounded-[22px] transition-colors"
        style={{ background: abierta ? '#ebebe8' : '#fff' }}
    >
        <div className="flex items-center">
            <button
                type="button"
                onClick={onAlternar}
                aria-expanded={abierta}
                className={`flex min-h-[52px] min-w-0 flex-1 items-center gap-2.5 rounded-[22px] pl-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${onMenu ? 'pr-1' : 'pr-4'}`}
            >
                <Folder
                    size={18}
                    strokeWidth={1.9}
                    aria-hidden="true"
                    className="flex-none"
                    style={{ color: carpeta.color, fill: tinte(carpeta.color, '33') }}
                />
                <span className="min-w-0 flex-1 truncate text-[14.5px] font-bold text-[#0a0a0a]">{carpeta.nombre}</span>
                <span className="flex-none text-[13px] font-semibold text-black/[.55]">{plural(cuantas, 'tarea', 'tareas')}</span>
                <ChevronDown
                    size={16}
                    strokeWidth={2.4}
                    aria-hidden="true"
                    className="flex-none text-black/[.5] transition-transform"
                    style={{ transform: abierta ? undefined : 'rotate(-90deg)' }}
                />
            </button>
            {onMenu && (
                <button
                    type="button"
                    onClick={onMenu}
                    aria-label={`Opciones de la carpeta ${carpeta.nombre}`}
                    className="mr-1.5 flex h-11 w-11 flex-none items-center justify-center rounded-full text-black/[.62] transition-colors hover:bg-black/[.05] hover:text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                >
                    <MoreHorizontal size={18} strokeWidth={2.4} aria-hidden="true" />
                </button>
            )}
        </div>
        {abierta && <div className="flex flex-col gap-2 px-2 pb-2">{children}</div>}
    </div>
);

export default FilaCarpeta;
