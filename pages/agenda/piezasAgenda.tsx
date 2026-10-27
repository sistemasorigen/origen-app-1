import React from 'react';
import { Check, ChevronRight, Clock, Folder } from 'lucide-react';
import { horarioDeTarea, type Tarea } from '../../services/agenda';
import { ESTADOS } from '../../src/contenido/agendaPaleta';
import { tinte } from '../admin/departamentos/piezas';
import { ChipEstado, Punto } from '../departamentos/equipo/piezas';
import { horarioHablado } from './calendario';

/**
 * Cómo se ve una tarea en la Agenda (design-claude/Agenda Origen), igual en
 * todas las vistas:
 *
 *   · el color es el de su sub-departamento;
 *   · completada → atenuada, con tilde y el nombre tachado suave;
 *   · esperando (sólo con "Todo el departamento") → gris, borde punteado y
 *     "Sin asignar".
 *
 * Cada tarea es un botón con la frase entera para el lector de pantalla:
 * "Diseño de flyer, 19:00 a 20:30, Diseño, en proceso".
 */

const GRIS = '#8a8a86';

export const colorDe = (t: Tarea): string => t.subdepartamento?.color || GRIS;
export const estaCompletada = (t: Tarea) => t.estado === 'completada';
export const estaEsperando = (t: Tarea) => t.estado === 'esperando' || !t.subdepartamento;

export const etiquetaDe = (t: Tarea): string =>
    [t.nombre, horarioHablado(t), t.subdepartamento?.nombre || 'sin asignar', ESTADOS[t.estado].etiqueta.toLowerCase()].join(', ');

/** El fondo, el filo de color y el borde de una tarea en la grilla. */
export const estiloDeTarea = (t: Tarea, alfa = '2e'): React.CSSProperties => {
    if (estaEsperando(t)) {
        return { background: 'rgba(0,0,0,.04)', boxShadow: 'none', outline: `1.5px dashed ${GRIS}`, outlineOffset: '-1.5px' };
    }
    const c = colorDe(t);
    return {
        background: tinte(c, alfa),
        boxShadow: `inset 3px 0 0 ${c}`,
        opacity: estaCompletada(t) ? 0.55 : undefined,
    };
};

/** El nombre, con el tachado suave de las completadas. */
export const NombreDeTarea: React.FC<{ tarea: Tarea; className?: string }> = ({ tarea, className = '' }) => (
    <span
        className={`min-w-0 ${className}`}
        style={estaCompletada(tarea) ? { textDecoration: 'line-through', textDecorationColor: 'rgba(0,0,0,.35)' } : undefined}
    >
        {estaCompletada(tarea) && <Check size={11} strokeWidth={3} className="-mt-0.5 mr-1 inline" aria-hidden="true" />}
        {tarea.nombre}
    </span>
);

/** Una pastilla de tarea: la banda "Todo el día" de la grilla y las celdas del mes. */
export const PastillaTarea: React.FC<{ tarea: Tarea; onAbrir: (id: string) => void; alto?: number }> = ({
    tarea, onAbrir, alto = 24,
}) => (
    <button
        type="button"
        onClick={() => onAbrir(tarea.id)}
        aria-label={etiquetaDe(tarea)}
        title={tarea.nombre}
        className="flex w-full min-w-0 items-center rounded-[7px] pl-[9px] pr-[7px] text-left text-[11.5px] font-bold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-1"
        style={{ height: alto, ...estiloDeTarea(tarea, '26') }}
    >
        <NombreDeTarea tarea={tarea} className="truncate" />
    </button>
);

/** La tarjeta de la vista Lista: barra de color, nombre, horario, sub, prioridad, carpeta y estado. */
export const TarjetaDeLista: React.FC<{ tarea: Tarea; onAbrir: (id: string) => void }> = ({ tarea, onAbrir }) => {
    const esperando = estaEsperando(tarea);
    return (
        <button
            type="button"
            onClick={() => onAbrir(tarea.id)}
            aria-label={etiquetaDe(tarea)}
            className="flex min-h-[72px] w-full gap-3 rounded-[22px] bg-white py-3.5 pl-3.5 pr-4 text-left shadow-[0_1px_2px_rgba(0,0,0,.05)] transition-shadow hover:shadow-[0_4px_14px_rgba(0,0,0,.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
            style={esperando ? { outline: `1.5px dashed ${GRIS}`, outlineOffset: '-1.5px' } : undefined}
        >
            <span aria-hidden="true" className="w-1 flex-none self-stretch rounded-full" style={{ background: colorDe(tarea), opacity: estaCompletada(tarea) ? 0.5 : 1 }} />
            <span className="flex min-w-0 flex-1 flex-col gap-[7px]">
                <span className={`text-[15px] font-bold leading-[1.3] ${estaCompletada(tarea) ? 'text-black/50' : 'text-[#0a0a0a]'}`}>
                    <NombreDeTarea tarea={tarea} />
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-black/[.62]">
                        <Clock size={13} strokeWidth={2} aria-hidden="true" />{horarioDeTarea(tarea)}
                    </span>
                    <span className="inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-[9px] text-[11.5px] font-bold text-black/[.78]" style={{ background: esperando ? 'rgba(0,0,0,.06)' : tinte(colorDe(tarea)) }}>
                        <Punto color={colorDe(tarea)} tam={7} />
                        {tarea.subdepartamento?.nombre || 'Sin asignar'}
                    </span>
                    <ChipEstado estado={tarea.estado} />
                    {tarea.prioridad && (
                        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-black/[.62]">
                            <Punto color={tarea.prioridad.color} tam={7} />{tarea.prioridad.nombre}
                        </span>
                    )}
                    {tarea.carpeta && (
                        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-black/[.62]">
                            <Folder size={12} strokeWidth={2} aria-hidden="true" style={{ color: tarea.carpeta.color }} />{tarea.carpeta.nombre}
                        </span>
                    )}
                </span>
            </span>
            <ChevronRight size={18} strokeWidth={2.2} className="flex-none self-center text-black/[.38]" aria-hidden="true" />
        </button>
    );
};

/** El esqueleto mientras carga: con la forma de la vista, no un spinner en blanco. */
export const EsqueletoDeVista: React.FC<{ vista: 'grilla' | 'mes' | 'lista' }> = ({ vista }) => (
    <div aria-busy="true" aria-label="Cargando tu agenda" className="flex flex-col gap-2.5">
        {vista === 'lista' ? (
            [0, 1, 2, 3].map(i => <div key={i} className="h-[72px] rounded-[22px] bg-white motion-safe:animate-[depBrillo_1.2s_infinite]" style={{ animationDelay: `${i * 0.1}s` }} />)
        ) : vista === 'mes' ? (
            <div className="grid grid-cols-7 gap-1 rounded-[22px] bg-white p-2">
                {Array.from({ length: 35 }, (_, i) => <div key={i} className="h-16 rounded-xl bg-[#f2f2f0] motion-safe:animate-[depBrillo_1.2s_infinite] md:h-24" />)}
            </div>
        ) : (
            <div className="h-[460px] rounded-[22px] bg-white p-3">
                <div className="h-full rounded-2xl bg-[#f2f2f0] motion-safe:animate-[depBrillo_1.2s_infinite]" />
            </div>
        )}
    </div>
);
