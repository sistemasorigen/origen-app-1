import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import {
    crearPrioridadesSugeridas, eliminarPrioridad, guardarPrioridad, mensajeDeMotivo, nuevoId, ordenarPrioridades,
    type Falla, type Prioridad,
} from '../../../services/agenda';
import { PALETA, PRIORIDADES_SUGERIDAS } from '../../../src/contenido/agendaPaleta';
import { Cargando, ErrorDeCampo, RotuloPaso } from '../../admin/departamentos/piezas';
import {
    BOTON_CHICO, BOTON_GRIS, BOTON_ICONO, BOTON_NEGRO, ChipColor, Hoja, HojaElegir, PieDeHoja, TARJETA, usePanel,
} from './piezas';

/**
 * Configuración → Prioridades (design-claude/Departamento - Equipo).
 *
 * El orden importa: es el que ven las listas y la hoja de una tarea. Se
 * cambia arrastrando desde la manija (compu) o con las flechas ↑ ↓ (siempre
 * visibles: son también el camino del teclado). Cada cambio manda la lista
 * entera a agenda_ordenar_prioridades; si falla, vuelve al orden de antes.
 *
 * Borrar una prioridad en uso pide a cuál pasan sus tareas.
 */

/** Los 12 de la paleta y el gris de "Baja" (el de las sugeridas). */
const COLORES = [{ hex: PRIORIDADES_SUGERIDAS[0].hex, nombre: 'Gris' }, ...PALETA];

const usoDe = (n = 0) => (n === 0 ? 'Sin tareas' : `La usan ${n} ${n === 1 ? 'tarea' : 'tareas'}`);

const HojaPrioridad: React.FC<{ prioridad: Prioridad | null; onCerrar: () => void }> = ({ prioridad, onCerrar }) => {
    const { depId, avisar, recargar } = usePanel();
    const [id] = useState(() => prioridad?.id ?? nuevoId());
    const [nombre, setNombre] = useState(prioridad?.nombre ?? '');
    const [color, setColor] = useState(prioridad?.color ?? PALETA[2].hex);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const enviando = useRef(false);

    const guardar = async () => {
        if (enviando.current) return;
        if (!nombre.trim()) { setError('Escribí un nombre.'); return; }
        enviando.current = true;
        setGuardando(true);
        const r = await guardarPrioridad({ id, departamentoId: depId, nombre, color });
        enviando.current = false;
        setGuardando(false);
        if (!r.ok) { setError(mensajeDeMotivo(r.motivo)); return; }
        avisar(prioridad ? 'Prioridad guardada.' : `${nombre.trim()} está agregada.`);
        await recargar();
        onCerrar();
    };

    return (
        <Hoja
            titulo={prioridad ? 'Editar prioridad' : 'Agregar prioridad'}
            adelante={<ChipColor color={color}>{nombre.trim() || 'Vista previa'}</ChipColor>}
            onCerrar={onCerrar}
            ocupada={guardando}
            ancho={480}
            pie={<PieDeHoja onCancelar={onCerrar} onAceptar={guardar} etiqueta={prioridad ? 'Guardar' : 'Agregar'} guardando={guardando} apagado={!nombre.trim()} />}
        >
            <label className="flex flex-col gap-2">
                <RotuloPaso>Nombre</RotuloPaso>
                <input
                    value={nombre}
                    onChange={e => { setNombre(e.target.value); setError(null); }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); guardar(); } }}
                    maxLength={80}
                    autoFocus
                    placeholder="Por ejemplo, Para el domingo"
                    aria-invalid={!!error}
                    aria-describedby={error ? 'prio-error' : undefined}
                    className="h-[50px] w-full px-4 text-[15px] font-semibold"
                    style={error ? ({ '--ag-borde': '#b42318' } as React.CSSProperties) : undefined}
                />
                {error && <ErrorDeCampo id="prio-error">{error}</ErrorDeCampo>}
            </label>
            <div className="flex flex-col gap-2.5">
                <RotuloPaso id="prio-paso-color">Color</RotuloPaso>
                <div role="radiogroup" aria-labelledby="prio-paso-color" className="flex flex-wrap gap-2.5">
                    {COLORES.map(c => {
                        const on = color === c.hex;
                        return (
                            <button
                                key={c.hex}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                aria-label={c.nombre}
                                onClick={() => setColor(c.hex)}
                                className="flex h-11 w-11 items-center justify-center rounded-full text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-4"
                                style={{ background: c.hex, boxShadow: on ? `0 0 0 3px #fff, 0 0 0 5px ${c.hex}` : undefined }}
                            >
                                {on && <Check size={18} strokeWidth={3} aria-hidden="true" />}
                            </button>
                        );
                    })}
                </div>
            </div>
        </Hoja>
    );
};

const PestanaConfiguracion: React.FC = () => {
    const { depId, datos, recargar, avisar, confirmar } = usePanel();
    const [lista, setLista] = useState<Prioridad[]>(datos.prioridades);
    const [ordenando, setOrdenando] = useState(false);
    const [hoja, setHoja] = useState<{ tipo: 'editar'; prioridad: Prioridad | null } | { tipo: 'reemplazo'; prioridad: Prioridad; cantidad: number } | null>(null);
    const [sugiriendo, setSugiriendo] = useState(false);
    const [arrastrada, setArrastrada] = useState<number | null>(null);
    const [encima, setEncima] = useState<number | null>(null);
    const [vivo, setVivo] = useState('');
    // Arrastrar es de la compu: en el teléfono un `draggable` le pelea el
    // scroll al dedo, y ahí están las flechas.
    const [esCompu, setEsCompu] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches);
    useEffect(() => {
        const m = window.matchMedia('(min-width: 768px)');
        const alCambiar = () => setEsCompu(m.matches);
        m.addEventListener('change', alCambiar);
        return () => m.removeEventListener('change', alCambiar);
    }, []);

    // Lo que trae la base manda, salvo en el medio de un cambio de orden.
    useEffect(() => { if (!ordenando) setLista(datos.prioridades); }, [datos.prioridades, ordenando]);

    const mover = async (desde: number, hasta: number) => {
        if (ordenando || desde === hasta || hasta < 0 || hasta >= lista.length) return;
        const antes = lista;
        const nueva = [...lista];
        const [p] = nueva.splice(desde, 1);
        nueva.splice(hasta, 0, p);
        setLista(nueva);
        setOrdenando(true);
        setVivo(`${p.nombre}, puesto ${hasta + 1} de ${nueva.length}.`);
        const r = await ordenarPrioridades(depId, nueva.map(x => x.id));
        if (!r.ok) {
            setLista(antes);
            avisar(`No se pudo guardar el orden: ${mensajeDeMotivo(r.motivo)}`, 'error');
        } else {
            await recargar();
        }
        setOrdenando(false);
    };

    const pedirBorrar = (p: Prioridad) => {
        if ((p.cantTareas ?? 0) > 0) { setHoja({ tipo: 'reemplazo', prioridad: p, cantidad: p.cantTareas ?? 0 }); return; }
        confirmar({
            tipo: 'destructivo',
            rotulo: 'Prioridades',
            titulo: `¿Eliminar “${p.nombre}”?`,
            texto: 'Ninguna tarea la usa. Las solicitudes que la pidieron siguen diciendo qué prioridad pidieron.',
            etiquetaBoton: 'Eliminar',
            onConfirmar: async () => {
                const r = await eliminarPrioridad(p.id);
                // Si mientras tanto alguien la usó, se pide el reemplazo.
                if (!r.ok && r.motivo === 'en_uso') { setHoja({ tipo: 'reemplazo', prioridad: p, cantidad: (r as Falla).cantidad ?? 0 }); return; }
                if (!r.ok) { avisar(mensajeDeMotivo(r.motivo), 'error'); return; }
                avisar(`Se eliminó “${p.nombre}”.`);
                await recargar();
            },
        });
    };

    const usarSugeridas = async () => {
        if (sugiriendo) return;
        setSugiriendo(true);
        const r = await crearPrioridadesSugeridas(depId);
        setSugiriendo(false);
        if (!r.ok) { avisar(mensajeDeMotivo(r.motivo), 'error'); return; }
        avisar('Listo: Baja, Normal, Alta y Urgente.');
        await recargar();
    };

    return (
        <section aria-labelledby="config-prioridades" className={`${TARJETA} max-w-[680px] p-[22px]`}>
            <div className="flex flex-wrap items-start gap-2.5">
                <div className="min-w-[200px] flex-1">
                    <h2 id="config-prioridades" className="m-0 text-[18px] font-bold">Prioridades</h2>
                    <p className="m-0 mt-1 text-[13.5px] font-medium leading-[1.5] text-black/[.62]">
                        {lista.length > 0
                            ? 'Ordenalas con las flechas, o arrastrando desde la manija en la compu. La primera es la menos urgente.'
                            : 'Sirven para que el equipo sepa qué hacer primero.'}
                    </p>
                </div>
                {lista.length > 0 && (
                    <button type="button" onClick={() => setHoja({ tipo: 'editar', prioridad: null })} className={BOTON_CHICO}>
                        <Plus size={16} strokeWidth={2.4} aria-hidden="true" />Agregar prioridad
                    </button>
                )}
            </div>

            <p className="sr-only" aria-live="polite">{vivo}</p>

            {lista.length > 0 ? (
                <ol className="m-0 mt-[18px] flex list-none flex-col gap-1.5 p-0">
                    {lista.map((p, i) => (
                        <li
                            key={p.id}
                            draggable={esCompu && !ordenando}
                            onDragStart={e => { setArrastrada(i); e.dataTransfer.effectAllowed = 'move'; }}
                            onDragOver={e => { if (arrastrada === null) return; e.preventDefault(); setEncima(i); }}
                            onDrop={e => { e.preventDefault(); if (arrastrada !== null) mover(arrastrada, i); setArrastrada(null); setEncima(null); }}
                            onDragEnd={() => { setArrastrada(null); setEncima(null); }}
                            // En el teléfono la fila se parte en dos (los cuatro
                            // botones de 44 px no entran al lado del nombre).
                            className={`flex min-h-[56px] flex-wrap items-center gap-x-2 rounded-2xl px-2 py-1 transition-colors ${encima === i && arrastrada !== i ? 'bg-[#eef4ff] shadow-[inset_0_2px_0_#2563eb]' : 'bg-[#f6f6f4]'} ${arrastrada === i ? 'opacity-50' : ''}`}
                        >
                            <span title="Arrastrá para ordenar" className="hidden cursor-grab text-black/[.38] md:flex" aria-hidden="true">
                                <GripVertical size={18} strokeWidth={2} />
                            </span>
                            <span className="flex min-w-[200px] flex-1 items-center gap-2 py-1.5">
                                <span className="w-[18px] flex-none text-center text-[12.5px] font-extrabold text-black/[.45]" aria-hidden="true">{i + 1}</span>
                                <span className="min-w-0 flex-none"><ChipColor color={p.color}>{p.nombre}</ChipColor></span>
                                <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-black/[.55]">{usoDe(p.cantTareas)}</span>
                            </span>
                            <span className="ml-auto flex flex-none items-center">
                            <button type="button" onClick={() => mover(i, i - 1)} disabled={i === 0 || ordenando} aria-label={`Subir ${p.nombre}`} className={BOTON_ICONO}>
                                <ArrowUp size={16} strokeWidth={2.2} aria-hidden="true" />
                            </button>
                            <button type="button" onClick={() => mover(i, i + 1)} disabled={i === lista.length - 1 || ordenando} aria-label={`Bajar ${p.nombre}`} className={BOTON_ICONO}>
                                <ArrowDown size={16} strokeWidth={2.2} aria-hidden="true" />
                            </button>
                            <button type="button" onClick={() => setHoja({ tipo: 'editar', prioridad: p })} aria-label={`Editar ${p.nombre}`} className={BOTON_ICONO}>
                                <Pencil size={15} strokeWidth={2} aria-hidden="true" />
                            </button>
                            <button type="button" onClick={() => pedirBorrar(p)} aria-label={`Eliminar ${p.nombre}`} className={`${BOTON_ICONO} text-[#b42318] hover:text-[#b42318]`}>
                                <Trash2 size={15} strokeWidth={1.9} aria-hidden="true" />
                            </button>
                            </span>
                        </li>
                    ))}
                </ol>
            ) : (
                <div className="mt-[18px] flex flex-col items-center rounded-[22px] bg-[#f6f6f4] px-5 py-8 text-center">
                    <p className="m-0 text-[16px] font-bold">Todavía no hay prioridades</p>
                    <p className="m-0 mt-1.5 max-w-[340px] text-[13.5px] font-medium leading-[1.55] text-black/[.62]">Podés empezar con las sugeridas y cambiarlas después.</p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                        <button type="button" onClick={usarSugeridas} disabled={sugiriendo} className={BOTON_NEGRO}>
                            {sugiriendo && <Cargando />}Usar las sugeridas (Baja, Normal, Alta, Urgente)
                        </button>
                        <button type="button" onClick={() => setHoja({ tipo: 'editar', prioridad: null })} className={`${BOTON_GRIS} bg-white`}>Crear una</button>
                    </div>
                </div>
            )}

            {hoja?.tipo === 'editar' && <HojaPrioridad prioridad={hoja.prioridad} onCerrar={() => setHoja(null)} />}

            {hoja?.tipo === 'reemplazo' && (
                <HojaElegir
                    titulo={`Eliminar “${hoja.prioridad.nombre}”`}
                    subtitulo={`Esta prioridad la usan ${hoja.cantidad} ${hoja.cantidad === 1 ? 'tarea' : 'tareas'}. ¿A cuál las pasamos?`}
                    opciones={lista.filter(p => p.id !== hoja.prioridad.id).map(p => ({ id: p.id, nombre: p.nombre, color: p.color, meta: usoDe(p.cantTareas) }))}
                    vacio="Es la única prioridad: creá otra antes de eliminarla."
                    etiqueta="Pasar y eliminar"
                    onElegir={async reemplazo => {
                        const r = await eliminarPrioridad(hoja.prioridad.id, reemplazo);
                        if (!r.ok) { avisar(mensajeDeMotivo(r.motivo), 'error'); return false; }
                        const destino = lista.find(p => p.id === reemplazo)?.nombre ?? 'la elegida';
                        avisar(`Se eliminó “${hoja.prioridad.nombre}”: ${r.tareasMovidas} ${r.tareasMovidas === 1 ? 'tarea pasó' : 'tareas pasaron'} a “${destino}”.`);
                        await recargar();
                        return true;
                    }}
                    onCerrar={() => setHoja(null)}
                />
            )}
        </section>
    );
};

export default PestanaConfiguracion;
