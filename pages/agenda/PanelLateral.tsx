import React, { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { fechaDesdeIso, fechaLarga, mesYAnio, sumarDias } from '../../services/agenda';
import { ROTULO, TARJETA } from '../departamentos/equipo/piezas';
import { grillaDelMes, lunesDe, sumarMeses, type Vista } from './calendario';

/**
 * La columna de la Agenda (design-claude/Agenda Origen): el mini-calendario,
 * la leyenda de sub-departamentos y el interruptor "Todo el departamento".
 *
 * Desde 1024 px va fija a la izquierda. Más angosto, la leyenda y el
 * interruptor (y en tablet también el mini-calendario) van en HojaFiltros,
 * que usa estas mismas piezas.
 */

export interface ItemDeLeyenda {
    id: string;
    nombre: string;
    color: string;
    /** El departamento, o "Esperando asignación" para el chip "Sin asignar". */
    detalle: string;
    /** El chip "Sin asignar": gris, sin color de sub. */
    gris?: boolean;
}

const DIAS_MINI = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export const MiniCalendario: React.FC<{
    fecha: string;
    vista: Vista;
    hoy: string;
    /** Los días que tienen tareas entre lo cargado: llevan un punto. */
    conTareas: Set<string>;
    onElegir: (iso: string) => void;
}> = ({ fecha, vista, hoy, conTareas, onElegir }) => {
    const [mes, setMes] = useState(fecha);
    // Si el calendario se mueve a otro mes, el mini lo acompaña.
    useEffect(() => { setMes(fecha); }, [fecha]);
    const dias = grillaDelMes(mes);
    const delMes = fechaDesdeIso(mes).getMonth();
    const lunes = lunesDe(fecha);

    const marcado = (d: string) => (vista === 'semana' ? d >= lunes && d <= sumarDias(lunes, 6) : vista === 'dia' || vista === 'lista' ? d === fecha : false);

    return (
        <div className={`${TARJETA} px-4 pb-3.5 pt-[18px]`}>
            <div className="flex items-center gap-1 px-0.5 pb-2.5">
                <p className="m-0 flex-1 text-[14px] font-bold" aria-live="polite">{mesYAnio(mes)}</p>
                <button type="button" onClick={() => setMes(sumarMeses(mes, -1))} aria-label="Mes anterior" className={BOTON_MINI}>
                    <ChevronLeft size={16} strokeWidth={2.2} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => setMes(sumarMeses(mes, 1))} aria-label="Mes siguiente" className={BOTON_MINI}>
                    <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
                </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5">
                {DIAS_MINI.map((d, i) => (
                    <span key={i} aria-hidden="true" className="flex h-6 items-center justify-center text-[10.5px] font-bold text-black/[.5]">{d}</span>
                ))}
                {dias.map(d => {
                    const esHoy = d === hoy;
                    const enMes = fechaDesdeIso(d).getMonth() === delMes;
                    const tiene = conTareas.has(d);
                    return (
                        <button
                            key={d}
                            type="button"
                            onClick={() => onElegir(d)}
                            aria-label={`${fechaLarga(d)}${esHoy ? ' (hoy)' : ''}${tiene ? ', con tareas' : ''}`}
                            aria-current={esHoy ? 'date' : undefined}
                            className={`relative flex h-[34px] items-center justify-center rounded-[10px] text-[12.5px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] ${esHoy ? 'bg-[#dc2626] text-white' : marcado(d) ? 'bg-[#f2f2f0] text-[#0a0a0a]' : enMes ? 'text-[#0a0a0a] hover:bg-[#f6f6f4]' : 'text-black/[.38] hover:bg-[#f6f6f4]'}`}
                        >
                            {fechaDesdeIso(d).getDate()}
                            <span aria-hidden="true" className={`absolute bottom-1 h-1 w-1 rounded-full ${tiene ? (esHoy ? 'bg-white' : 'bg-black/[.45]') : 'bg-transparent'}`} />
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const BOTON_MINI = 'flex h-[34px] w-[34px] items-center justify-center rounded-full text-black/[.62] hover:bg-[#f2f2f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]';

/** La leyenda: un chip por sub que prende o apaga sus tareas. */
export const Leyenda: React.FC<{
    titulo: string;
    items: ItemDeLeyenda[];
    apagados: Set<string>;
    onCambiar: (id: string) => void;
    onMostrarTodos: () => void;
}> = ({ titulo, items, apagados, onCambiar, onMostrarTodos }) => (
    <div>
        <div className="mb-3 flex min-h-[24px] items-center gap-2 px-0.5">
            <p className={`${ROTULO} flex-1`}>{titulo}</p>
            {apagados.size > 0 && items.some(i => apagados.has(i.id)) && (
                <button
                    type="button"
                    onClick={onMostrarTodos}
                    className="-my-2.5 h-11 rounded-full px-2.5 text-[12.5px] font-bold text-[#0a0a0a] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                >
                    Mostrar todos
                </button>
            )}
        </div>
        <div className="flex flex-col gap-1">
            {items.map(i => {
                const on = !apagados.has(i.id);
                const color = i.gris ? 'rgba(0,0,0,.4)' : i.color;
                return (
                    <button
                        key={i.id}
                        type="button"
                        role="switch"
                        aria-checked={on}
                        onClick={() => onCambiar(i.id)}
                        className="flex min-h-[44px] items-center gap-[11px] rounded-[14px] px-2.5 text-left hover:bg-[#f6f6f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                    >
                        <span
                            aria-hidden="true"
                            className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[7px] motion-safe:transition-colors"
                            style={on ? { background: color } : { boxShadow: `inset 0 0 0 2px ${color}` }}
                        >
                            {on && <Check size={12} strokeWidth={3.4} color="#fff" />}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-bold text-[#0a0a0a]">{i.nombre}</span>
                            <span className="mt-px block truncate text-[11.5px] font-semibold text-black/[.58]">{i.detalle}</span>
                        </span>
                    </button>
                );
            })}
        </div>
    </div>
);

/** "Todo el departamento" (o "Todos los departamentos" para quien administra todo). */
export const InterruptorTodo: React.FC<{
    prendido: boolean;
    superAdmin: boolean;
    onCambiar: () => void;
}> = ({ prendido, superAdmin, onCambiar }) => (
    <button
        type="button"
        role="switch"
        aria-checked={prendido}
        onClick={onCambiar}
        className="flex min-h-[48px] w-full items-center gap-3 rounded-[14px] px-2.5 py-1 text-left hover:bg-[#f6f6f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
    >
        <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-bold text-[#0a0a0a]">{superAdmin ? 'Todos los departamentos' : 'Todo el departamento'}</span>
            <span className="mt-0.5 block text-[11.5px] font-semibold leading-[1.4] text-black/[.58]">Ver también las tareas de los demás</span>
        </span>
        <span aria-hidden="true" className={`relative h-7 w-12 flex-none rounded-full motion-safe:transition-colors ${prendido ? 'bg-[#0a0a0a]' : 'bg-black/[.16]'}`}>
            <span className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)] motion-safe:transition-[left] ${prendido ? 'left-[23px]' : 'left-[3px]'}`} />
        </span>
    </button>
);

/** La columna fija de escritorio. */
const PanelLateral: React.FC<{
    calendario: React.ReactNode;
    leyenda: React.ReactNode;
    interruptor: React.ReactNode | null;
}> = ({ calendario, leyenda, interruptor }) => (
    <aside aria-label="Calendario y filtros" className="flex w-[264px] flex-none flex-col gap-3.5 xl:w-[288px]">
        {calendario}
        <div className={`${TARJETA} px-4 py-[18px]`}>
            {leyenda}
            {interruptor && <div className="mt-3 border-t border-black/[.06] pt-3">{interruptor}</div>}
        </div>
    </aside>
);

export default PanelLateral;
