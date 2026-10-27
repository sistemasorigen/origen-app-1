import React from 'react';
import { Folder } from 'lucide-react';
import { horarioDeTarea, type Tarea } from '../../../services/agenda';
import { ChipColor, Punto } from '../equipo/piezas';

/**
 * Una tarea en la lista (design-claude/Departamento - Tareas).
 *
 * La barra de la izquierda es el color del equipo que la tiene; gris y con
 * la pastilla "Sin asignar" cuando todavía no tiene ninguno. Es lo que deja
 * barrer la lista con la vista y ver de quién es cada cosa sin leer.
 *
 * El nombre tachado es el único lugar donde se dice que está completada sin
 * repetir la pastilla del divisor: dentro de "Completadas" todas lo están.
 */

const TarjetaTarea: React.FC<{
    tarea: Tarea;
    onAbrir: () => void;
    /** Recién creada o recién cambiada: entra marcándose. */
    reciente?: boolean;
}> = ({ tarea, onAbrir, reciente = false }) => {
    const color = tarea.subdepartamento?.color || 'rgba(0,0,0,.3)';
    const completada = tarea.estado === 'completada';
    const horario = horarioDeTarea(tarea);

    // El texto está partido en pastillas: sin esto se lee de a pedazos (7.15).
    const descripcion = [
        tarea.nombre,
        horario,
        tarea.subdepartamento ? tarea.subdepartamento.nombre : 'Sin asignar',
        tarea.prioridad ? `prioridad ${tarea.prioridad.nombre}` : '',
        tarea.carpeta ? `carpeta ${tarea.carpeta.nombre}` : '',
    ].filter(Boolean).join(' · ');

    return (
        <button
            type="button"
            onClick={onAbrir}
            aria-label={descripcion}
            data-tarea={tarea.id}
            className={`flex min-h-[72px] w-full gap-3 rounded-[20px] bg-white py-3.5 pl-3.5 pr-4 text-left shadow-[0_1px_2px_rgba(0,0,0,.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${reciente ? 'motion-safe:animate-[depAparece_.3s_ease_both]' : ''}`}
        >
            <span aria-hidden="true" className="w-1 flex-none self-stretch rounded-full" style={{ background: color }} />
            <span className="flex min-w-0 flex-1 flex-col gap-[7px]">
                <span className={`text-[15px] font-bold leading-[1.3] ${completada ? 'text-black/[.5] line-through' : 'text-[#0a0a0a]'}`}>
                    {tarea.nombre}
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-0.5 whitespace-nowrap text-[12.5px] font-semibold text-black/[.62]">{horario}</span>
                    <ChipColor color={color}>{tarea.subdepartamento ? tarea.subdepartamento.nombre : 'Sin asignar'}</ChipColor>
                    {tarea.prioridad && <ChipColor color={tarea.prioridad.color}>{tarea.prioridad.nombre}</ChipColor>}
                    {tarea.carpeta && (
                        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-black/[.62]">
                            <Folder size={14} strokeWidth={1.9} aria-hidden="true" style={{ color: tarea.carpeta.color }} />
                            <span className="hidden md:inline">{tarea.carpeta.nombre}</span>
                        </span>
                    )}
                    {tarea.subdepartamento?.archivado && (
                        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-black/[.5]">
                            <Punto color="rgba(0,0,0,.3)" tam={6} />
                            Equipo archivado
                        </span>
                    )}
                </span>
            </span>
        </button>
    );
};

export default TarjetaTarea;
