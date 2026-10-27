import React from 'react';
import { fechaDeDia, type Tarea } from '../../services/agenda';
import { BOTON_NEGRO, Hoja } from '../departamentos/equipo/piezas';
import { TarjetaDeLista } from './piezasAgenda';

/**
 * Las hojas de la Agenda:
 *
 *   · HojaFiltros: por debajo de 1024 px, lo que en escritorio es la columna
 *     de la izquierda (la leyenda y el interruptor; en tablet también el
 *     mini-calendario). Los cambios se aplican en el momento; "Listo" sólo
 *     cierra.
 *   · HojaDelDia: el "+N más" del mes, con todas las tareas de ese día.
 */

export const HojaFiltros: React.FC<{
    calendario?: React.ReactNode;
    leyenda: React.ReactNode;
    interruptor: React.ReactNode | null;
    onCerrar: () => void;
}> = ({ calendario, leyenda, interruptor, onCerrar }) => (
    <Hoja
        titulo="Filtros"
        subtitulo="Elegí qué tareas ver en el calendario"
        onCerrar={onCerrar}
        ancho={460}
        pie={<button type="button" onClick={onCerrar} className={`${BOTON_NEGRO} w-full`}>Listo</button>}
    >
        <div className="flex flex-col gap-5">
            {calendario}
            {leyenda}
            {interruptor && <div className="border-t border-black/[.06] pt-3">{interruptor}</div>}
        </div>
    </Hoja>
);

export const HojaDelDia: React.FC<{
    dia: string;
    hoy: string;
    tareas: Tarea[];
    onAbrir: (id: string) => void;
    onIrADia: () => void;
    onCerrar: () => void;
}> = ({ dia, hoy, tareas, onAbrir, onIrADia, onCerrar }) => (
    <Hoja
        titulo={fechaDeDia(dia, hoy)}
        subtitulo={`${tareas.length} ${tareas.length === 1 ? 'tarea' : 'tareas'}`}
        onCerrar={onCerrar}
        ancho={480}
        pie={<button type="button" onClick={onIrADia} className={`${BOTON_NEGRO} w-full`}>Ver el día completo</button>}
    >
        <div className="flex flex-col gap-2">
            {tareas.map(t => <TarjetaDeLista key={t.id} tarea={t} onAbrir={onAbrir} />)}
        </div>
    </Hoja>
);
