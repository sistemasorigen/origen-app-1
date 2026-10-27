import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fechaDeDia, fechaDesdeIso, fechaLarga, mesYAnio, sumarDias, type Tarea } from '../../services/agenda';
import { lunesDe } from './calendario';
import { TarjetaDeLista } from './piezasAgenda';

/**
 * La vista Lista (design-claude/Agenda Origen): las tareas agrupadas por día,
 * desde el día elegido, en tramos de 30 días con "Ver más días".
 *
 * En el teléfono, arriba, la tira de días deslizable (tres semanas: la
 * anterior, la del día elegido y la siguiente) con un punto en los días que
 * tienen tareas. Tocar un día que ya está cargado lleva a ese día en la
 * lista; uno anterior al primero cargado mueve la lista para que empiece ahí.
 */

const DIA_CORTO = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

const VistaLista: React.FC<{
    fecha: string;
    /** Hasta qué día está cargado (el fin del último tramo). */
    hasta: string;
    tareas: Tarea[];
    hoy: string;
    movil: boolean;
    cargandoMas: boolean;
    onAbrir: (id: string) => void;
    onVerMas: () => void;
    onElegirDia: (iso: string) => void;
    /** Lo que se muestra cuando el período no tiene tareas (va debajo de la tira). */
    vacio: React.ReactNode;
}> = ({ fecha, hasta, tareas, hoy, movil, cargandoMas, onAbrir, onVerMas, onElegirDia, vacio }) => {
    const grupos = useMemo(() => {
        const m = new Map<string, Tarea[]>();
        tareas.forEach(t => {
            if (t.fecha < fecha || t.fecha > hasta) return;
            const l = m.get(t.fecha) ?? []; l.push(t); m.set(t.fecha, l);
        });
        return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
    }, [tareas, fecha, hasta]);
    const conTareas = useMemo(() => new Set(grupos.map(([d]) => d)), [grupos]);
    const [elegido, setElegido] = useState(fecha);
    useEffect(() => { setElegido(fecha); }, [fecha]);
    const lista = useRef<HTMLDivElement>(null);

    const irAlDia = (iso: string) => {
        if (iso < fecha || iso > hasta) { onElegirDia(iso); return; }
        setElegido(iso);
        // El primer día con tareas desde el elegido.
        const destino = grupos.find(([d]) => d >= iso)?.[0];
        const el = destino ? lista.current?.querySelector<HTMLElement>(`[data-dia="${destino}"]`) : null;
        el?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    };

    return (
        <div className="flex flex-col gap-4">
            {movil && <TiraDeDias fecha={fecha} elegido={elegido} hoy={hoy} conTareas={conTareas} onElegir={irAlDia} />}

            {grupos.length === 0 ? vacio : (
                <div ref={lista} className="flex max-w-[760px] flex-col gap-[22px]">
                    {grupos.map(([dia, del]) => (
                        <section key={dia} data-dia={dia} aria-labelledby={`agenda-dia-${dia}`} className="flex scroll-mt-20 flex-col gap-2">
                            <h2
                                id={`agenda-dia-${dia}`}
                                className={`mx-1 mb-0.5 font-bold tracking-[-0.01em] ${dia === hoy ? 'text-[17px] text-[#0a0a0a]' : 'text-[15px] text-black/[.62]'}`}
                            >
                                {fechaDeDia(dia, hoy)}
                            </h2>
                            {del.map(t => <TarjetaDeLista key={t.id} tarea={t} onAbrir={onAbrir} />)}
                        </section>
                    ))}
                </div>
            )}

            <div className="max-w-[760px]">
                <button
                    type="button"
                    onClick={onVerMas}
                    disabled={cargandoMas}
                    className="h-11 w-full rounded-full bg-white text-[14px] font-bold text-[#0a0a0a] shadow-[0_1px_2px_rgba(0,0,0,.05)] hover:bg-[#fafaf9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 disabled:text-black/[.55]"
                >
                    {cargandoMas ? 'Cargando más días…' : 'Ver más días'}
                </button>
                <p className="mt-2 text-center text-[12.5px] font-semibold text-black/[.58]">
                    Hasta el {fechaLarga(hasta)}
                </p>
            </div>
        </div>
    );
};

/** La tira del teléfono: 48 × 72, deslizable, con el mes que se está mirando arriba. */
const TiraDeDias: React.FC<{
    fecha: string;
    elegido: string;
    hoy: string;
    conTareas: Set<string>;
    onElegir: (iso: string) => void;
}> = ({ fecha, elegido, hoy, conTareas, onElegir }) => {
    const inicio = sumarDias(lunesDe(fecha), -7);
    const dias = useMemo(() => Array.from({ length: 21 }, (_, i) => sumarDias(inicio, i)), [inicio]);
    const tira = useRef<HTMLDivElement>(null);
    const [mes, setMes] = useState(mesYAnio(fecha));

    // Arranca mostrando la semana del día elegido.
    useEffect(() => {
        const el = tira.current;
        if (!el) return;
        el.scrollLeft = 7 * 54;
        setMes(mesYAnio(sumarDias(inicio, 7)));
    }, [inicio]);

    const alDeslizar = () => {
        const el = tira.current;
        if (!el) return;
        const idx = Math.max(0, Math.min(dias.length - 1, Math.round(el.scrollLeft / 54)));
        const m = mesYAnio(dias[idx]);
        if (m !== mes) setMes(m);
    };

    return (
        <div>
            <p aria-live="polite" className="mx-0.5 mb-2.5 text-[14px] font-bold text-[#0a0a0a]">{mes}</p>
            <div
                ref={tira}
                onScroll={alDeslizar}
                className="-mx-4 flex snap-x snap-mandatory gap-1.5 overflow-x-auto px-4 pb-0.5 [scroll-padding-left:16px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
                {dias.map(d => {
                    const on = d === elegido;
                    const esHoy = d === hoy;
                    const tiene = conTareas.has(d);
                    return (
                        <button
                            key={d}
                            type="button"
                            onClick={() => onElegir(d)}
                            aria-label={`${fechaLarga(d)}${esHoy ? ' (hoy)' : ''}${tiene ? ', con tareas' : ''}`}
                            aria-pressed={on}
                            className={`flex h-[72px] w-12 flex-none snap-start flex-col items-center justify-center gap-[3px] rounded-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${on ? 'bg-[#0a0a0a] text-white' : esHoy ? 'bg-white text-[#dc2626] shadow-[inset_0_0_0_1.5px_#dc2626]' : 'bg-white text-[#0a0a0a]'}`}
                        >
                            <span className="text-[11px] font-bold tracking-[0.04em] opacity-70">{DIA_CORTO[fechaDesdeIso(d).getDay()]}</span>
                            <span className="text-[17px] font-extrabold">{fechaDesdeIso(d).getDate()}</span>
                            <span aria-hidden="true" className={`h-[5px] w-[5px] rounded-full ${tiene ? (on ? 'bg-white' : 'bg-[#0a0a0a]') : 'bg-transparent'}`} />
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default VistaLista;
