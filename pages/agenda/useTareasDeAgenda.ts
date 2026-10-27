import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getMisTareas, type MotivoAgenda, type Tarea } from '../../services/agenda';
import { rangosDeVista, rangosVecinos, type Rango, type Vista } from './calendario';

/**
 * Las tareas de la Agenda, con caché por rango.
 *
 * agenda_mis_tareas no acepta más de 100 días, así que se pide SÓLO lo que se
 * ve (calendario.ts → rangosDeVista) y se guarda en memoria por rango: volver
 * a una semana ya vista no vuelve a la base. Después de mostrar un período se
 * precargan, en segundo plano, el anterior y el siguiente.
 *
 * La clave de la caché lleva el interruptor "Todo el departamento": con él
 * prendido la misma semana trae otra cosa.
 *
 * Una respuesta que llega cuando ya se cambió de período no pisa lo que se
 * ve: igual se guarda en la caché (es un dato bueno), pero no se muestra.
 *
 * Se invalida todo (y se vuelve a pedir lo visible) al cambiar el estado de
 * una tarea, al prender o apagar el interruptor, y cuando la pestaña vuelve a
 * estar a la vista después de más de 2 minutos escondida.
 */

const VUELTA_QUE_REFRESCA_MS = 2 * 60 * 1000;

// `motivo?: undefined` en la rama buena: sin strictNullChecks, `!r.ok` no angosta la unión.
type Respuesta = { ok: true; motivo?: undefined; tareas: Tarea[] } | { ok: false; motivo: MotivoAgenda };

export type EstadoDeLaAgenda =
    | { tipo: 'cargando' }
    | { tipo: 'error'; motivo: MotivoAgenda }
    | { tipo: 'listo'; tareas: Tarea[]; cargandoMas: boolean };

const claveDe = (todo: boolean, r: Rango) => `${todo ? 1 : 0}|${r.desde}|${r.hasta}`;

export const useTareasDeAgenda = ({ vista, fecha, tramos, todo, habilitado }: {
    vista: Vista;
    fecha: string;
    /** Sólo la Lista: cuántos tramos de 30 días hay pedidos. */
    tramos: number;
    todo: boolean;
    /** Sin departamentos, o con el acceso cargando, no se pide nada. */
    habilitado: boolean;
}) => {
    const cache = useRef(new Map<string, Tarea[]>());
    const enCurso = useRef(new Map<string, Promise<Respuesta>>());
    /** Cuántas consultas salieron a la base (lo miran las pruebas y nadie más). */
    const consultas = useRef(0);
    /**
     * Sube con cada invalidación: una consulta que estaba en vuelo cuando se
     * invalidó trae datos de antes, y esos no entran a la caché nueva.
     */
    const generacion = useRef(0);
    const [estado, setEstado] = useState<EstadoDeLaAgenda>({ tipo: 'cargando' });
    const [vuelta, setVuelta] = useState(0);

    const rangos = useMemo(() => rangosDeVista(vista, fecha, tramos), [vista, fecha, tramos]);
    const vecinos = useMemo(() => rangosVecinos(vista, fecha, tramos), [vista, fecha, tramos]);

    /** Lo que está en la caché, o lo que ya se está pidiendo, o una consulta nueva. */
    const pedir = useCallback((r: Rango): Promise<Respuesta> => {
        const k = claveDe(todo, r);
        const guardado = cache.current.get(k);
        if (guardado) return Promise.resolve({ ok: true, tareas: guardado });
        const yaVa = enCurso.current.get(k);
        if (yaVa) return yaVa;
        consultas.current += 1;
        const g = generacion.current;
        const p = getMisTareas(r.desde, r.hasta, todo).then((res): Respuesta => {
            if (g === generacion.current) enCurso.current.delete(k);
            if (!res.ok) return { ok: false, motivo: res.motivo };
            if (g === generacion.current) cache.current.set(k, res.tareas);
            return { ok: true, tareas: res.tareas };
        });
        enCurso.current.set(k, p);
        return p;
    }, [todo]);

    const claveVisible = `${rangos.map(r => claveDe(todo, r)).join(',')}#${vuelta}`;

    // El interruptor cambia lo que trae cada rango: lo viejo no sirve más.
    // Va ANTES del efecto que pide, para que la consulta nueva ya sea de la
    // generación nueva.
    const todoAnterior = useRef(todo);
    useEffect(() => {
        if (todoAnterior.current === todo) return;
        todoAnterior.current = todo;
        generacion.current += 1;
        cache.current.clear();
        enCurso.current.clear();
    }, [todo]);

    useEffect(() => {
        if (!habilitado) return;
        let vigente = true;
        const guardados = rangos.map(r => cache.current.get(claveDe(todo, r)));
        if (guardados.every(Boolean)) {
            setEstado({ tipo: 'listo', tareas: unir(guardados as Tarea[][]), cargandoMas: false });
        } else if (guardados[0] && vista === 'lista') {
            // "Ver más días": lo que ya estaba se sigue viendo mientras llega el tramo nuevo.
            setEstado({ tipo: 'listo', tareas: unir(guardados.filter(Boolean) as Tarea[][]), cargandoMas: true });
        } else {
            setEstado({ tipo: 'cargando' });
        }
        Promise.all(rangos.map(pedir)).then(respuestas => {
            if (!vigente) return;   // ya se cambió de período: no se pisa lo que se ve
            const falla = respuestas.find(r => !r.ok);
            if (falla) { setEstado({ tipo: 'error', motivo: falla.motivo }); return; }
            setEstado({ tipo: 'listo', tareas: unir(respuestas.map(r => (r.ok ? r.tareas : []))), cargandoMas: false });
            // La precarga, cuando lo visible ya está.
            vecinos.forEach(r => { pedir(r).catch(() => { /* la precarga falla en silencio */ }); });
        });
        return () => { vigente = false; };
    }, [claveVisible, habilitado]); // eslint-disable-line react-hooks/exhaustive-deps

    /** Tira la caché y vuelve a pedir lo que se ve. */
    const invalidar = useCallback(() => {
        generacion.current += 1;
        cache.current.clear();
        enCurso.current.clear();
        setVuelta(v => v + 1);
    }, []);

    // Volver a la pestaña después de un rato: lo de otros pudo cambiar.
    useEffect(() => {
        let escondidaDesde = 0;
        const alCambiar = () => {
            if (document.visibilityState === 'hidden') { escondidaDesde = Date.now(); return; }
            if (escondidaDesde && Date.now() - escondidaDesde > VUELTA_QUE_REFRESCA_MS) invalidar();
            escondidaDesde = 0;
        };
        document.addEventListener('visibilitychange', alCambiar);
        return () => document.removeEventListener('visibilitychange', alCambiar);
    }, [invalidar]);


    return { estado, invalidar, consultas, rangos };
};

/** Junta los tramos sin repetir tareas. */
const unir = (listas: Tarea[][]): Tarea[] => {
    const vistas = new Set<string>();
    const todas: Tarea[] = [];
    listas.forEach(l => l.forEach(t => { if (!vistas.has(t.id)) { vistas.add(t.id); todas.push(t); } }));
    return todas;
};
