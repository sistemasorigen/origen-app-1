import React, { useMemo } from 'react';
import { fechaDeDia, hoyIso, type Carpeta, type EstadoTarea, type Tarea } from '../../../services/agenda';
import { ChipEstado, DivisorPlegable } from '../equipo/piezas';
import FilaCarpeta from './FilaCarpeta';
import TarjetaTarea from './TarjetaTarea';

/**
 * Un divisor de estado con todo lo que tiene adentro: día → carpetas →
 * tareas sueltas (design-claude/Departamento - Tareas).
 *
 * Los tres divisores siempre están, con su contador, aunque el período no
 * tenga nada de ese estado: un divisor que desaparece hace pensar que se
 * perdió algo. Un cero con una línea de texto dice lo mismo y no mueve la
 * pantalla de lugar cada vez que cambia el período.
 *
 * El orden de los días no es el mismo en los tres: lo que está esperando o en
 * proceso se ordena de lo más próximo a lo más lejano, porque es lo que hay
 * que hacer; lo completado, de lo más reciente a lo más viejo, porque es
 * historial y lo último es lo que se busca.
 */

const SIN_NADA: Record<EstadoTarea, string> = {
    esperando: 'No hay tareas esperando asignación en este período.',
    en_proceso: 'No hay tareas en proceso en este período.',
    completada: 'Todavía no se completó ninguna en este período.',
};

/**
 * Dentro de un día: primero las de todo el día, después por hora de inicio
 * y, a igual hora, por el orden de las prioridades del departamento (el que
 * se arma en Configuración). Las que no tienen prioridad, al final.
 */
export const ordenDentroDelDia = (a: Tarea, b: Tarea): number => {
    if (a.todoElDia !== b.todoElDia) return a.todoElDia ? -1 : 1;
    const ha = a.horaDesde || '';
    const hb = b.horaDesde || '';
    if (ha !== hb) return ha < hb ? -1 : 1;
    const pa = a.prioridad ? a.prioridad.orden : Number.MAX_SAFE_INTEGER;
    const pb = b.prioridad ? b.prioridad.orden : Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    return a.nombre.localeCompare(b.nombre, 'es');
};

interface Dia {
    fecha: string;
    carpetas: { carpeta: Carpeta; tareas: Tarea[] }[];
    sueltas: Tarea[];
}

const ListaPorEstado: React.FC<{
    estado: EstadoTarea;
    /** Ya filtradas por período y por este estado. */
    tareas: Tarea[];
    carpetas: Carpeta[];
    abierto: boolean;
    onAlternar: () => void;
    /** Qué carpetas están cerradas, por clave `estado|fecha|carpetaId`. */
    carpetasCerradas: Record<string, boolean>;
    onAlternarCarpeta: (clave: string) => void;
    onAbrirTarea: (id: string) => void;
    onMenuDeCarpeta: (carpeta: Carpeta) => void;
    /** La tarea que se acaba de guardar: entra marcándose. */
    reciente?: string | null;
}> = ({
    estado, tareas, carpetas, abierto, onAlternar,
    carpetasCerradas, onAlternarCarpeta, onAbrirTarea, onMenuDeCarpeta, reciente,
}) => {
    const hoy = hoyIso();

    const dias = useMemo<Dia[]>(() => {
        const porFecha = new Map<string, Tarea[]>();
        tareas.forEach(t => {
            const lista = porFecha.get(t.fecha);
            if (lista) lista.push(t); else porFecha.set(t.fecha, [t]);
        });
        const fechas = [...porFecha.keys()].sort();
        if (estado === 'completada') fechas.reverse();

        return fechas.map(fecha => {
            const delDia = (porFecha.get(fecha) || []).slice().sort(ordenDentroDelDia);
            const conCarpeta = carpetas
                .map(c => ({ carpeta: c, tareas: delDia.filter(t => t.carpeta?.id === c.id) }))
                .filter(g => g.tareas.length > 0);
            return { fecha, carpetas: conCarpeta, sueltas: delDia.filter(t => !t.carpeta) };
        });
    }, [tareas, carpetas, estado]);

    return (
        <DivisorPlegable
            rotulo={<ChipEstado estado={estado} grande />}
            cuantas={tareas.length}
            abierto={abierto}
            onAlternar={onAlternar}
            id={`tareas-${estado}`}
            marca={estado}
        >
            <div className="flex flex-col gap-[18px] pb-2 pt-4">
                {tareas.length === 0 && (
                    <p className="m-0 px-1.5 text-[13.5px] font-semibold text-black/[.55]">{SIN_NADA[estado]}</p>
                )}

                {dias.map(dia => (
                    <div key={dia.fecha} className="flex flex-col gap-2">
                        <h3
                            className="m-0 mb-0.5 px-1.5 text-[14px] font-bold"
                            style={{ color: dia.fecha === hoy ? '#0a0a0a' : 'rgba(0,0,0,.62)' }}
                        >
                            {fechaDeDia(dia.fecha, hoy)}
                        </h3>

                        {dia.carpetas.map(({ carpeta, tareas: adentro }) => {
                            const clave = `${estado}|${dia.fecha}|${carpeta.id}`;
                            const abiertaLaCarpeta = !carpetasCerradas[clave];
                            return (
                                <FilaCarpeta
                                    key={carpeta.id}
                                    carpeta={carpeta}
                                    cuantas={adentro.length}
                                    abierta={abiertaLaCarpeta}
                                    onAlternar={() => onAlternarCarpeta(clave)}
                                    onMenu={() => onMenuDeCarpeta(carpeta)}
                                >
                                    {adentro.map(t => (
                                        <TarjetaTarea
                                            key={t.id}
                                            tarea={t}
                                            reciente={reciente === t.id}
                                            onAbrir={() => onAbrirTarea(t.id)}
                                        />
                                    ))}
                                </FilaCarpeta>
                            );
                        })}

                        {dia.sueltas.map(t => (
                            <TarjetaTarea
                                key={t.id}
                                tarea={t}
                                reciente={reciente === t.id}
                                onAbrir={() => onAbrirTarea(t.id)}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </DivisorPlegable>
    );
};

export default ListaPorEstado;
