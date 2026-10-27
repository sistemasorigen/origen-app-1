import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ROTULO } from '../departamentos/equipo/piezas';
import { VISTAS, type Vista } from './calendario';

/**
 * El encabezado de la Agenda (design-claude/Agenda Origen): la ceja con el
 * período, "Agenda Origen", Hoy ‹ › y el segmentado Día · Semana · Mes ·
 * Lista. A la derecha del segmentado, en escritorio, el período escrito
 * entero; por debajo de 1024 px, el botón "Filtros" con cuántos hay puestos.
 *
 * El segmentado entra en 390 px junto al botón de filtros: los botones son
 * de 44 px de alto y en el teléfono se achica el relleno, no el texto.
 */

const PASO: Record<Vista, [string, string]> = {
    dia: ['Día anterior', 'Día siguiente'],
    semana: ['Semana anterior', 'Semana siguiente'],
    mes: ['Mes anterior', 'Mes siguiente'],
    lista: ['30 días antes', '30 días después'],
};

const BOTON_REDONDO = 'flex h-11 flex-none items-center justify-center rounded-full bg-white text-[#0a0a0a] shadow-[0_1px_2px_rgba(0,0,0,.05)] hover:bg-[#fafaf9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2';

const EncabezadoAgenda: React.FC<{
    vista: Vista;
    /** La ceja: el mes en escritorio, el período entero más angosto. */
    ceja: string;
    /** El período escrito entero (sólo escritorio). */
    periodo: string;
    escritorio: boolean;
    movil: boolean;
    filtrosPuestos: number;
    onVista: (v: Vista) => void;
    onMover: (paso: -1 | 1) => void;
    onHoy: () => void;
    onFiltros: () => void;
}> = ({ vista, ceja, periodo, escritorio, movil, filtrosPuestos, onVista, onMover, onHoy, onFiltros }) => (
    <div className="flex flex-none flex-col gap-3.5">
        <div className="flex items-center gap-2.5">
            <div className="min-w-0 flex-1">
                <p className={`${ROTULO} truncate`} aria-live="polite">{ceja}</p>
                <h1 className="m-0 mt-1 text-[26px] font-bold leading-[1.1] tracking-[-0.025em] text-[#0a0a0a] md:text-[30px]">Agenda Origen</h1>
            </div>
            <div className="flex flex-none items-center gap-1.5">
                <button type="button" onClick={onHoy} className={`${BOTON_REDONDO} px-4 text-[13.5px] font-bold`}>Hoy</button>
                <button type="button" onClick={() => onMover(-1)} aria-label={PASO[vista][0]} className={`${BOTON_REDONDO} w-11`}>
                    <ChevronLeft size={18} strokeWidth={2.2} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => onMover(1)} aria-label={PASO[vista][1]} className={`${BOTON_REDONDO} w-11`}>
                    <ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" />
                </button>
            </div>
        </div>

        <div className="flex items-center gap-2">
            <div role="group" aria-label="Vista del calendario" className="flex min-w-0 gap-[3px] rounded-full bg-[#ebebe8] p-[3px]">
                {VISTAS.map(v => {
                    const on = v.id === vista;
                    return (
                        <button
                            key={v.id}
                            type="button"
                            onClick={() => onVista(v.id)}
                            aria-pressed={on}
                            className={`h-11 flex-none whitespace-nowrap rounded-full text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] ${movil ? 'px-2.5' : 'px-3.5'} ${on ? 'bg-white text-[#0a0a0a] shadow-[0_1px_3px_rgba(0,0,0,.1)]' : 'text-black/[.62] hover:text-[#0a0a0a]'}`}
                        >
                            {v.etiqueta}
                        </button>
                    );
                })}
            </div>
            <span className="flex-1" />
            {escritorio ? (
                <p className="m-0 truncate text-[12.5px] font-semibold text-black/[.58]">{periodo}</p>
            ) : (
                <button
                    type="button"
                    onClick={onFiltros}
                    aria-label={filtrosPuestos > 0 ? `Filtros, ${filtrosPuestos} ${filtrosPuestos === 1 ? 'puesto' : 'puestos'}` : 'Filtros'}
                    className={`${BOTON_REDONDO} gap-1.5 px-3 text-[13.5px] font-bold`}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" aria-hidden="true">
                        <path d="M4 7h16M7 12h10M10 17h4" />
                    </svg>
                    Filtros
                    {filtrosPuestos > 0 && (
                        <span aria-hidden="true" className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#0a0a0a] px-1.5 text-[11px] font-bold text-white">
                            {filtrosPuestos}
                        </span>
                    )}
                </button>
            )}
        </div>
    </div>
);

export default EncabezadoAgenda;
