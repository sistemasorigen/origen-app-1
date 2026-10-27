import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { diaDeLaSemana, fechaDesdeIso, fechaLarga, type Tarea } from '../../services/agenda';
import { minutos, ubicarEnCarriles } from './calendario';
import { NombreDeTarea, PastillaTarea, estaCompletada, estiloDeTarea, etiquetaDe } from './piezasAgenda';

/**
 * Las vistas Semana y Día (design-claude/Agenda Origen): una grilla horaria
 * con una columna por día.
 *
 *   · De 07:00 a 23:00, 52 px por hora; si hay tareas antes o después, la
 *     grilla se estira hasta incluirlas.
 *   · Arriba, la banda "Todo el día". Con muchas en un día se pliega en
 *     "+N", que la despliega entera.
 *   · Cada tarea con horario es un bloque de alto proporcional a su
 *     duración (como mínimo media hora, para que se lea). Si no entra el
 *     horario, sólo el nombre.
 *   · Las que se pisan van lado a lado (calendario.ts → ubicarEnCarriles).
 *   · En el día de hoy, la línea roja de "ahora", que se mueve cada minuto.
 *
 * `angosta` es la semana en el teléfono: siete columnas finitas que entran
 * sin scroll de costado y muestran sólo los colores (el nombre lo tiene el
 * lector de pantalla y el detalle). El diseño lo resuelve así y no con tres
 * días.
 */

const HP = 52;
const H0 = 7;
const H1 = 23;
/** Cuántas de "Todo el día" se ven por día antes de plegarse. */
const TOPE_TODO_EL_DIA = 2;

const ahoraEnMinutos = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

const VistaSemana: React.FC<{
    dias: string[];
    tareas: Tarea[];
    hoy: string;
    angosta: boolean;
    onAbrir: (id: string) => void;
    /** Tocar el encabezado de un día lleva a la vista Día. Sin esto, no es un botón. */
    onIrADia?: (iso: string) => void;
}> = ({ dias, tareas, hoy, angosta, onAbrir, onIrADia }) => {
    const scroll = useRef<HTMLDivElement>(null);
    const [expandida, setExpandida] = useState(false);
    const [ahora, setAhora] = useState(ahoraEnMinutos);
    const esDia = dias.length === 1;

    useEffect(() => {
        const t = window.setInterval(() => setAhora(ahoraEnMinutos()), 60_000);
        return () => window.clearInterval(t);
    }, []);

    const porDia = useMemo(() => {
        const m = new Map<string, Tarea[]>();
        dias.forEach(d => m.set(d, []));
        tareas.forEach(t => m.get(t.fecha)?.push(t));
        return m;
    }, [dias, tareas]);

    const ubicadas = useMemo(() => new Map(dias.map(d => [d, ubicarEnCarriles(porDia.get(d) ?? [])])), [dias, porDia]);

    // La grilla se estira para que entren las tareas de madrugada o de noche.
    const { desde, hasta } = useMemo(() => {
        let a = H0 * 60;
        let z = H1 * 60;
        ubicadas.forEach(lista => lista.forEach(u => { a = Math.min(a, u.desde); z = Math.max(z, u.hasta); }));
        return { desde: Math.max(0, Math.floor(a / 60)), hasta: Math.min(24, Math.ceil(z / 60)) };
    }, [ubicadas]);
    const horas = Array.from({ length: hasta - desde }, (_, i) => desde + i);
    const y = (min: number) => ((min - desde * 60) / 60) * HP;

    // Al abrir (y al cambiar de período): la hora actual si hoy está a la
    // vista; si no, la primera tarea; si no, las 8.
    const primerDia = dias[0];
    useLayoutEffect(() => {
        const el = scroll.current;
        if (!el) return;
        let objetivo = (8 - desde) * HP;
        if (dias.includes(hoy)) objetivo = y(ahoraEnMinutos()) - HP;
        else {
            const primeras = dias.flatMap(d => ubicadas.get(d) ?? []).map(u => u.desde);
            if (primeras.length) objetivo = y(Math.min(...primeras)) - HP / 2;
        }
        el.scrollTop = Math.max(0, objetivo);
    }, [primerDia, dias.length]); // eslint-disable-line react-hooks/exhaustive-deps

    const todoElDia = dias.map(d => (porDia.get(d) ?? []).filter(t => t.todoElDia || !t.horaDesde));
    const hayTodoElDia = todoElDia.some(l => l.length > 0);
    const sobran = todoElDia.some(l => l.length > TOPE_TODO_EL_DIA);
    const columnas = `${angosta ? 40 : 52}px repeat(${dias.length}, minmax(0,1fr))`;

    return (
        <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_1px_2px_rgba(0,0,0,.04)]">
            {/* Encabezado de los días */}
            <div className="grid border-b border-black/[.06]" style={{ gridTemplateColumns: columnas }}>
                <span />
                {dias.map(d => {
                    const esHoy = d === hoy;
                    const contenido = (
                        <>
                            <span className={`text-[11px] font-bold tracking-[0.05em] ${esHoy ? 'text-[#dc2626]' : 'text-black/[.55]'}`}>{diaDeLaSemana(d)}</span>
                            <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-extrabold ${esHoy ? 'bg-[#dc2626] text-white' : 'text-[#0a0a0a]'}`}>
                                {fechaDesdeIso(d).getDate()}
                            </span>
                        </>
                    );
                    return onIrADia && !esDia ? (
                        <button
                            key={d}
                            type="button"
                            onClick={() => onIrADia(d)}
                            aria-label={`Ver el ${fechaLarga(d)}${esHoy ? ' (hoy)' : ''}`}
                            aria-current={esHoy ? 'date' : undefined}
                            className="flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-0.5 py-2 hover:bg-[#fafaf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0a0a0a]"
                        >
                            {contenido}
                        </button>
                    ) : (
                        <div key={d} aria-current={esHoy ? 'date' : undefined} className="flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-0.5 py-2">{contenido}</div>
                    );
                })}
            </div>

            {/* Todo el día */}
            {hayTodoElDia && (
                <div className="grid border-b border-black/[.06]" style={{ gridTemplateColumns: columnas }}>
                    <span className="flex items-start justify-end pr-1.5 pt-2 text-right text-[10px] font-bold leading-[1.2] text-black/[.55]">
                        Todo<br />el día
                    </span>
                    {todoElDia.map((lista, i) => {
                        const visibles = expandida ? lista : lista.slice(0, TOPE_TODO_EL_DIA);
                        const ocultas = lista.length - visibles.length;
                        if (angosta) {
                            // Barritas de 14 px no se tocan con el dedo: la celda entera
                            // es el botón y lleva al día, como en el mes del teléfono.
                            return (
                                <div key={dias[i]} className="relative flex min-w-0 flex-col gap-1 border-l border-black/[.05] p-1">
                                    {visibles.map(t => (
                                        <span key={t.id} aria-hidden="true" className="h-3.5 rounded-[7px]" style={estiloDeTarea(t, '26')} />
                                    ))}
                                    {ocultas > 0 && <span aria-hidden="true" className="text-center text-[11px] font-bold text-black/[.62]">+{ocultas}</span>}
                                    {lista.length > 0 && onIrADia && (
                                        <button
                                            type="button"
                                            onClick={() => onIrADia(dias[i])}
                                            aria-label={`${lista.length} ${lista.length === 1 ? 'tarea' : 'tareas'} de todo el día el ${fechaLarga(dias[i])}`}
                                            className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0a0a0a]"
                                        />
                                    )}
                                </div>
                            );
                        }
                        return (
                            <div key={dias[i]} className="flex min-w-0 flex-col gap-1 border-l border-black/[.05] p-1">
                                {visibles.map(t => <PastillaTarea key={t.id} tarea={t} onAbrir={onAbrir} />)}
                                {ocultas > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setExpandida(true)}
                                        aria-label={`Ver ${ocultas} más de todo el día`}
                                        className="h-6 rounded-[7px] text-[11px] font-bold text-black/[.62] hover:bg-[#f2f2f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                                    >
                                        +{ocultas}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                    {expandida && sobran && (
                        <button
                            type="button"
                            onClick={() => setExpandida(false)}
                            className="col-span-full h-9 text-[12px] font-bold text-black/[.62] hover:text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0a0a0a]"
                        >
                            Mostrar menos
                        </button>
                    )}
                </div>
            )}

            {/* La grilla horaria */}
            <div ref={scroll} className="relative h-[min(640px,calc(100dvh-300px))] min-h-[420px] overflow-y-auto overflow-x-hidden overscroll-contain">
                <div className="relative grid" style={{ gridTemplateColumns: columnas, height: horas.length * HP }}>
                    <div className="relative" aria-hidden="true">
                        {horas.map((h, i) => (
                            <span key={h} className="absolute right-1.5 text-[10.5px] font-bold text-black/[.5]" style={{ top: i * HP - 7, visibility: i === 0 ? 'hidden' : undefined }}>
                                {String(h).padStart(2, '0')}:00
                            </span>
                        ))}
                    </div>
                    {dias.map(d => {
                        const esHoy = d === hoy;
                        const lineaAhora = esHoy && ahora >= desde * 60 && ahora <= hasta * 60;
                        return (
                            <div key={d} className="relative min-w-0 border-l border-black/[.05]" style={esHoy ? { background: 'rgba(220,38,38,.025)' } : undefined}>
                                {horas.map((h, i) => <span key={h} aria-hidden="true" className="absolute inset-x-0 h-px bg-black/[.05]" style={{ top: i * HP }} />)}
                                {(ubicadas.get(d) ?? []).map(u => {
                                    const alto = Math.max(HP / 2 - 2, ((u.hasta - u.desde) / 60) * HP - 3);
                                    const ancho = 100 / u.carriles;
                                    const conHora = !angosta && alto > 44;
                                    // El bloque se ve como mide; lo que se toca, al menos 44 px.
                                    const extra = Math.max(0, (44 - alto) / 2);
                                    const estilo = estiloDeTarea(u.tarea);
                                    const filo = estilo.boxShadow && estilo.boxShadow !== 'none' ? `${estilo.boxShadow}, ` : '';
                                    return (
                                        <button
                                            key={u.tarea.id}
                                            type="button"
                                            onClick={() => onAbrir(u.tarea.id)}
                                            aria-label={etiquetaDe(u.tarea)}
                                            title={u.tarea.nombre}
                                            className="absolute z-[2] overflow-visible rounded-[10px] text-left focus-visible:z-[3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                                            style={{
                                                top: y(u.desde) + 1,
                                                height: alto,
                                                left: `calc(${u.carril * ancho}% + ${angosta ? 1 : 3}px)`,
                                                width: `calc(${ancho}% - ${angosta ? 2 : 6}px)`,
                                                ...estilo,
                                                // El filo blanco separa dos bloques que quedan pegados.
                                                boxShadow: `${filo}0 0 0 1.5px #fff`,
                                            }}
                                        >
                                            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0" style={{ top: -extra, bottom: -extra }} />
                                            {!angosta && (
                                                <span className="flex h-full flex-col overflow-hidden py-[5px] pl-[9px] pr-[7px]">
                                                    <span className={`font-bold leading-[1.25] text-[#0a0a0a] ${esDia ? 'text-[14px]' : 'text-[12px]'} ${alto > 60 ? 'line-clamp-2' : 'truncate'}`}>
                                                        <NombreDeTarea tarea={u.tarea} />
                                                    </span>
                                                    {conHora && (
                                                        <span className={`mt-0.5 truncate text-[11px] font-semibold ${estaCompletada(u.tarea) ? 'text-black/50' : 'text-black/[.62]'}`}>
                                                            {u.tarea.horaDesde}–{u.tarea.horaHasta}
                                                        </span>
                                                    )}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                                {lineaAhora && (
                                    <div aria-hidden="true" data-ahora="true" className="pointer-events-none absolute inset-x-0 z-[4] h-0.5 bg-[#dc2626]" style={{ top: y(ahora) }}>
                                        <span className="absolute -left-1 -top-[4px] h-2.5 w-2.5 rounded-full bg-[#dc2626]" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default VistaSemana;
