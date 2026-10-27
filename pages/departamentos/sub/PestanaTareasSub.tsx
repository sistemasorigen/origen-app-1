import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import {
    fechaDesdeIso, fechaIso, getTareasSubdepartamento, mensajeDeMotivo,
    type Carpeta, type EstadoTarea, type MotivoAgenda, type PanelSubdepartamento, type Tarea,
} from '../../../services/agenda';
import SelectorDeRango, { atajosDeTareas, type Rango } from '../../audiencia/SelectorDeRango';
import { BOTON_NEGRO, Mensaje, guardarPlegadas, leerPlegadas } from '../equipo/piezas';
import ListaPorEstado from '../tareas/ListaPorEstado';

/**
 * Las tareas del sub-departamento, por estado, día y carpeta
 * (design-claude/Sub-departamento - Panel, pestaña Tareas).
 *
 * Es la misma lista que la del departamento —el mismo ListaPorEstado, el
 * mismo divisor plegable, el mismo selector de período— con tres diferencias
 * que son todas la misma: acá nadie crea ni edita. No hay divisor "Esperando
 * asignación" (una tarea sin equipo no es de ningún sub), no hay botones de
 * crear, y las carpetas se ven pero no se tocan.
 *
 * LAS CARPETAS SALEN DE LAS TAREAS. agenda_subdepartamento no devuelve las
 * carpetas del departamento, y pedirlas aparte sería pedir permiso de
 * encargado. Cada tarea trae la suya, así que la lista se arma con las que
 * aparecen; ordenadas por nombre, que es un orden que no depende de lo que
 * haya cargado ese período.
 */

const ESTADOS: EstadoTarea[] = ['en_proceso', 'completada'];

/** El mes en curso, entero. */
const mesEntero = (iso: string): Rango => {
    const d = fechaDesdeIso(iso);
    return {
        desde: fechaIso(new Date(d.getFullYear(), d.getMonth(), 1)),
        hasta: fechaIso(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    };
};

/** Seis meses para atrás y seis para adelante: entra en el tope de 400 días. */
const ventanaDe = (iso: string): Rango => {
    const d = fechaDesdeIso(iso);
    return {
        desde: fechaIso(new Date(d.getFullYear(), d.getMonth() - 6, 1)),
        hasta: fechaIso(new Date(d.getFullYear(), d.getMonth() + 7, 0)),
    };
};

type Fuente = { rango: Rango; tareas: Tarea[] };

const PestanaTareasSub: React.FC<{
    subId: string;
    datos: PanelSubdepartamento;
    onAbrirTarea: (id: string) => void;
    avisar: (texto: string, tipo?: 'ok' | 'error') => void;
    version: number;
}> = ({ subId, datos, onAbrirTarea, avisar, version }) => {
    const hoy = datos.hoy;
    const ventana = useRef(ventanaDe(hoy)).current;

    const [rango, setRango] = useState<Rango>(() => mesEntero(hoy));
    const [ventanaCargada, setVentanaCargada] = useState<Fuente | null>(null);
    const [afuera, setAfuera] = useState<Fuente | null>(null);
    const [cargando, setCargando] = useState(true);
    const [cargandoAfuera, setCargandoAfuera] = useState(false);
    const [motivo, setMotivo] = useState<MotivoAgenda | null>(null);

    // El recuerdo de los plegados es por SUB, no por departamento: son dos
    // pantallas distintas con dos listas distintas.
    const [plegadas, setPlegadas] = useState(() => leerPlegadas(subId));
    const [carpetasCerradas, setCarpetasCerradas] = useState<Record<string, boolean>>({});

    const dentroDeLaVentana = useCallback(
        (r: Rango) => r.desde >= ventana.desde && r.hasta <= ventana.hasta,
        [ventana],
    );

    const pedirVentana = useCallback(async (silencioso = false) => {
        if (!silencioso) { setCargando(true); setMotivo(null); }
        const r = await getTareasSubdepartamento(subId, ventana.desde, ventana.hasta);
        if (!silencioso) setCargando(false);
        if (!r.ok) {
            // Un fallo no es "no hay tareas" (instrucciones 7.9).
            if (silencioso) avisar(`No se pudo actualizar: ${mensajeDeMotivo(r.motivo)}`, 'error');
            else setMotivo(r.motivo);
            return;
        }
        setMotivo(null);
        setVentanaCargada({ rango: ventana, tareas: r.tareas });
    }, [subId, ventana, avisar]);

    useEffect(() => { pedirVentana(); }, [pedirVentana]);
    // Algo se tocó en el detalle: la lista se trae de nuevo, sin esqueleto.
    useEffect(() => { if (version > 0) pedirVentana(true); }, [version, pedirVentana]);

    // Un período fuera de la ventana se le pide a la base.
    useEffect(() => {
        if (dentroDeLaVentana(rango)) { setAfuera(null); setCargandoAfuera(false); return; }
        let vigente = true;
        setCargandoAfuera(true);
        getTareasSubdepartamento(subId, rango.desde, rango.hasta).then(r => {
            if (!vigente) return;
            setCargandoAfuera(false);
            if (r.ok) setAfuera({ rango, tareas: r.tareas });
            else { setAfuera(null); avisar(`No pudimos traer ese período: ${mensajeDeMotivo(r.motivo)}`, 'error'); }
        });
        return () => { vigente = false; };
    }, [subId, rango.desde, rango.hasta, dentroDeLaVentana, avisar]);

    const haciaLaBase = !dentroDeLaVentana(rango);
    const fuente = haciaLaBase ? afuera : ventanaCargada;

    const visibles = useMemo(
        () => (fuente?.tareas ?? []).filter(t => t.fecha >= rango.desde && t.fecha <= rango.hasta),
        [fuente, rango.desde, rango.hasta],
    );

    /** Los puntos del calendario: cuántas tareas hay en cada día de lo cargado. */
    const porDia = useMemo(() => {
        const m = new Map<string, number>();
        const sumar = (lista: Tarea[]) => lista.forEach(t => m.set(t.fecha, (m.get(t.fecha) || 0) + 1));
        sumar(ventanaCargada?.tareas ?? []);
        if (afuera) sumar(afuera.tareas.filter(t => t.fecha < ventana.desde || t.fecha > ventana.hasta));
        return m;
    }, [ventanaCargada, afuera, ventana]);

    /** Las carpetas que aparecen en lo cargado, por nombre. */
    const carpetas = useMemo<Carpeta[]>(() => {
        const vistas = new Map<string, Carpeta>();
        (ventanaCargada?.tareas ?? []).concat(afuera?.tareas ?? []).forEach(t => {
            if (t.carpeta && !vistas.has(t.carpeta.id)) {
                vistas.set(t.carpeta.id, { ...t.carpeta, createdAt: '' });
            }
        });
        return [...vistas.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    }, [ventanaCargada, afuera]);

    const porEstado = useMemo(() => {
        const m: Record<EstadoTarea, Tarea[]> = { esperando: [], en_proceso: [], completada: [] };
        visibles.forEach(t => { if (m[t.estado]) m[t.estado].push(t); });
        return m;
    }, [visibles]);

    const esperando = cargando || (haciaLaBase && cargandoAfuera && !afuera);
    const vacio = !esperando && !motivo && visibles.length === 0;

    return (
        <>
            <div className="flex">
                <div className="w-full md:w-auto md:min-w-[250px]">
                    <SelectorDeRango
                        valor={rango}
                        onCambiar={setRango}
                        serviciosPorDia={porDia}
                        atajos={atajosDeTareas()}
                        permitirFuturo
                        nombreDelConteo={{ uno: 'tarea', varios: 'tareas' }}
                    />
                </div>
            </div>

            {esperando && (
                <div aria-busy="true" aria-label="Cargando las tareas" className="mt-5 flex flex-col gap-2.5">
                    <div className="h-14 rounded-[20px] bg-white motion-safe:animate-[depBrillo_1.2s_infinite]" />
                    <div className="h-[76px] rounded-[22px] bg-white motion-safe:animate-[depBrillo_1.2s_.1s_infinite]" />
                    <div className="h-14 rounded-[20px] bg-white motion-safe:animate-[depBrillo_1.2s_.2s_infinite]" />
                </div>
            )}

            {!esperando && motivo && (
                <Mensaje
                    titulo="No pudimos cargar las tareas"
                    texto={motivo === 'rango_grande' || motivo === 'rango_invalido'
                        ? mensajeDeMotivo(motivo)
                        : 'Puede ser la conexión. Probá de nuevo en un momento.'}
                >
                    <button type="button" onClick={() => pedirVentana()} className={`${BOTON_NEGRO} mt-5`}>Reintentar</button>
                </Mensaje>
            )}

            {vacio && (
                <Mensaje
                    icono={<CalendarDays size={26} strokeWidth={1.75} />}
                    titulo="No hay tareas en este período"
                    texto="Elegí otras fechas arriba para ver lo que vino antes o lo que viene después."
                />
            )}

            {!esperando && !motivo && !vacio && (
                <div className="mt-5 flex flex-col gap-3">
                    {ESTADOS.map(estado => (
                        <ListaPorEstado
                            key={estado}
                            estado={estado}
                            tareas={porEstado[estado]}
                            carpetas={carpetas}
                            abierto={!plegadas[estado]}
                            onAlternar={() => setPlegadas(p => {
                                const n = { ...p, [estado]: !p[estado] };
                                guardarPlegadas(subId, n);
                                return n;
                            })}
                            carpetasCerradas={carpetasCerradas}
                            onAlternarCarpeta={clave => setCarpetasCerradas(c => ({ ...c, [clave]: !c[clave] }))}
                            onAbrirTarea={onAbrirTarea}
                            prefijoDeId="tareas-sub"
                        />
                    ))}
                    <p className="m-0 mt-1 px-2 text-[12.5px] font-semibold text-black/[.58]">
                        Los divisores que pliegues quedan así la próxima vez que entres.
                    </p>
                </div>
            )}
        </>
    );
};

export default PestanaTareasSub;
