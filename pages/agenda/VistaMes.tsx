import React, { useMemo } from 'react';
import { fechaDesdeIso, fechaLarga, type Tarea } from '../../services/agenda';
import { grillaDelMes, primeroDelMes } from './calendario';
import { BarraDePlazo, PastillaTarea, colorDe, estaCompletada, estiloDeTarea } from './piezasAgenda';
import { PuntoVencida } from '../../components/agenda/piezasPlazo';
import { esConPlazo, porSemanas, repartirEnCarriles } from './plazos';

/**
 * La vista Mes (design-claude/Agenda Origen): de lunes a domingo, 5 o 6
 * semanas.
 *
 *   · Cada fila de semana dibuja primero las BARRAS de las tareas con plazo,
 *     que cruzan las celdas como en un calendario de verdad y siguen en la
 *     fila siguiente si el plazo no terminó. Abajo, las tareas de cada día.
 *   · Cada día muestra hasta 3 cosas (2 en el teléfono) y "+N más", que abre
 *     la lista de ese día. El "+N" cuenta también las barras que lo cruzan.
 *   · En el teléfono las tareas son barritas de color sin nombre, como en el
 *     diseño: una barrita de 8 px no se puede tocar con el dedo, así que lo
 *     que se toca es la celda entera, que abre la lista del día.
 *   · Tocar el número del día lleva a la vista Día de esa fecha.
 *   · Los días de otros meses van atenuados y hoy, resaltado.
 */

const CABECERA = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
/** El alto de cada carril de barras dentro de una fila de semana. */
const CARRIL = 20;

const VistaMes: React.FC<{
    fecha: string;
    tareas: Tarea[];
    hoy: string;
    movil: boolean;
    onAbrir: (id: string) => void;
    onIrADia: (iso: string) => void;
    onVerDia: (iso: string) => void;
}> = ({ fecha, tareas, hoy, movil, onAbrir, onIrADia, onVerDia }) => {
    const dias = useMemo(() => grillaDelMes(fecha), [fecha]);
    const semanas = useMemo(() => porSemanas(dias), [dias]);
    const mes = fechaDesdeIso(primeroDelMes(fecha)).getMonth();

    /** Las de un día, por fecha. Las de plazo van aparte, como barras. */
    const porDia = useMemo(() => {
        const m = new Map<string, Tarea[]>();
        tareas.filter(t => !esConPlazo(t)).forEach(t => {
            const l = m.get(t.fecha) ?? []; l.push(t); m.set(t.fecha, l);
        });
        return m;
    }, [tareas]);

    const conPlazo = useMemo(() => tareas.filter(esConPlazo), [tareas]);
    const tope = movil ? 2 : 3;

    return (
        <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_1px_2px_rgba(0,0,0,.04)]">
            <div className="grid grid-cols-7 border-b border-black/[.06]">
                {CABECERA.map(d => (
                    <span key={d} className="py-2.5 text-center text-[11px] font-bold tracking-[0.05em] text-black/[.55]">{d}</span>
                ))}
            </div>

            {semanas.map(semana => {
                const { barras, carriles } = repartirEnCarriles(conPlazo, semana);
                return (
                    <div key={semana[0]} className="relative">
                        {/* Las celdas de los días */}
                        <div className="grid grid-cols-7">
                            {semana.map(d => {
                                const lista = porDia.get(d) ?? [];
                                const cruzan = barras.filter(b => semana[b.inicio] <= d && semana[b.fin] >= d).length;
                                const delMes = fechaDesdeIso(d).getMonth() === mes;
                                const esHoy = d === hoy;
                                const ocultas = lista.length - tope;
                                const total = lista.length + cruzan;
                                return (
                                    <div
                                        key={d}
                                        className={`relative flex min-h-[68px] min-w-0 flex-col gap-[3px] overflow-hidden border-b border-r border-black/[.05] p-1 md:min-h-[112px] ${delMes ? '' : 'bg-[#fafaf9]'}`}
                                        // Lugar para las barras sólo si las hay: sin plazos, el
                                        // `p-1` de siempre, y la celda mide lo mismo que antes.
                                        style={carriles > 0 ? { paddingBottom: carriles * CARRIL + 2 } : undefined}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => onIrADia(d)}
                                            aria-label={`Ver el ${fechaLarga(d)}${esHoy ? ' (hoy)' : ''}`}
                                            aria-current={esHoy ? 'date' : undefined}
                                            className={`relative z-[2] h-7 min-w-[28px] self-start rounded-full px-1.5 text-[12.5px] font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] ${esHoy ? 'bg-[#dc2626] text-white' : delMes ? 'text-[#0a0a0a] hover:bg-[#f2f2f0]' : 'text-black/[.55] hover:bg-[#f2f2f0]'}`}
                                        >
                                            {fechaDesdeIso(d).getDate()}
                                        </button>

                                        {movil ? (
                                            <>
                                                {lista.slice(0, tope).map(t => (
                                                    <span
                                                        key={t.id}
                                                        aria-hidden="true"
                                                        className="h-2 w-full rounded-full"
                                                        style={{ background: colorDe(t), opacity: estaCompletada(t) ? 0.45 : 1 }}
                                                    />
                                                ))}
                                                {ocultas > 0 && <span aria-hidden="true" className="text-[10.5px] font-bold text-black/[.62]">+{ocultas}</span>}
                                                {total > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onVerDia(d)}
                                                        aria-label={`${total} ${total === 1 ? 'tarea' : 'tareas'} el ${fechaLarga(d)}`}
                                                        className="absolute inset-0 z-[1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0a0a0a]"
                                                    />
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                {lista.slice(0, tope).map(t => <PastillaTarea key={t.id} tarea={t} onAbrir={onAbrir} alto={22} />)}
                                                {ocultas > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onVerDia(d)}
                                                        aria-label={`Ver ${ocultas} más el ${fechaLarga(d)}`}
                                                        className="h-[22px] rounded-[7px] px-1.5 text-left text-[11.5px] font-bold text-black/[.62] hover:bg-[#f2f2f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                                                    >
                                                        +{ocultas} más
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Las barras de los plazos, apoyadas en el piso de la fila */}
                        {carriles > 0 && (
                            <div
                                className="pointer-events-none absolute inset-x-0 bottom-[3px] z-[3] grid grid-cols-7 gap-y-[2px] px-[3px]"
                                style={{ gridAutoRows: `${CARRIL - 2}px` }}
                            >
                                {barras.map(b => (
                                    <span
                                        key={b.tarea.id}
                                        // En el teléfono la barra no se toca: el toque pasa de
                                        // largo hasta el botón del día, como las barritas.
                                        className={`min-w-0 ${movil ? '' : 'pointer-events-auto'}`}
                                        style={{ gridColumn: `${b.inicio + 1} / span ${b.fin - b.inicio + 1}`, gridRow: b.carril + 1 }}
                                    >
                                        {movil ? (
                                            <span
                                                aria-hidden="true"
                                                className="flex h-3 w-full items-center gap-1 px-1"
                                                style={{
                                                    ...estiloDeTarea(b.tarea, '26'),
                                                    // Si viene de antes, sin el filo de color: no empieza acá.
                                                    ...(b.cortaAntes ? { boxShadow: 'none' } : {}),
                                                    borderRadius: `${b.cortaAntes ? 0 : 6}px ${b.cortaDespues ? 0 : 6}px ${b.cortaDespues ? 0 : 6}px ${b.cortaAntes ? 0 : 6}px`,
                                                }}
                                            >
                                                {b.tarea.vencida && <PuntoVencida tam={4} />}
                                            </span>
                                        ) : (
                                            <BarraDePlazo barra={b} onAbrir={onAbrir} alto={CARRIL - 2} />
                                        )}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default VistaMes;
