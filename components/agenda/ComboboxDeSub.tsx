import React, { useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { Subdepartamento } from '../../services/agenda';
import { ErrorDeCampo, RotuloDeCampo, plural, sinAcentos } from '../../pages/admin/departamentos/piezas';
import { Punto } from '../../pages/departamentos/equipo/piezas';

/**
 * Elegir el sub-departamento de una tarea: se escribe y la lista se filtra
 * (design-claude/Departamento - Tareas).
 *
 * Es un combobox y no un `<select>` porque un departamento puede tener
 * muchos equipos y el nombre se busca mejor escribiéndolo que bajando por
 * una lista. Anda con el teclado —flechas, Enter, Escape— y el Escape de
 * acá no cierra la hoja de atrás: cierra la lista.
 *
 * "Sin asignar todavía" va PRIMERO y no último: es una opción de verdad —la
 * tarea queda esperando asignación— y no el fondo de la lista. Excluye a las
 * demás: o la tarea queda esperando, o le llega a algún equipo.
 *
 * Con `varios` (al crear) se marcan uno o más equipos, o "Todos", y la lista
 * queda abierta hasta "Listo". Sin `varios` (al editar: una tarea que ya existe
 * es de un equipo) elegir uno cierra la lista.
 */

const ID_TODOS = '__todos';

interface Opcion { id: string | null; nombre: string; color: string; meta: string }

const SIN_ASIGNAR: Opcion = {
    id: null, nombre: 'Sin asignar todavía', color: 'rgba(0,0,0,.25)', meta: 'Queda esperando',
};

/** El punto cuando son varios equipos: ninguno de sus colores los representa a todos. */
const COLOR_VARIOS = 'rgba(0,0,0,.55)';

const ComboboxDeSub: React.FC<{
    subdepartamentos: Subdepartamento[];
    /** Los equipos elegidos. Vacío no dice si se eligió "Sin asignar todavía": eso es `sinAsignarElegido`. */
    valores: string[];
    sinAsignarElegido: boolean;
    /** Se puede elegir más de uno, o "Todos". */
    varios?: boolean;
    onCambiar: (valores: string[], sinAsignar: boolean) => void;
    /** Una tarea completada no cambia de equipo: lo rechaza la base. */
    bloqueado?: boolean;
    /** Por qué está bloqueado, en palabras. */
    motivoDelBloqueo?: string;
    error?: string | null;
    /** Para que el formulario pueda llevar hasta acá cuando falta elegir. */
    refCampo?: React.RefObject<HTMLInputElement | null>;
}> = ({
    subdepartamentos, valores, sinAsignarElegido, varios = false, onCambiar,
    bloqueado = false, motivoDelBloqueo, error, refCampo,
}) => {
    const [abierta, setAbierta] = useState(false);
    const [consulta, setConsulta] = useState('');
    const [resaltada, setResaltada] = useState(0);
    const idBase = useRef(`sub-${Math.random().toString(36).slice(2, 8)}`).current;

    const elegidos = subdepartamentos.filter(s => valores.includes(s.id));
    const todosElegidos = subdepartamentos.length > 1 && elegidos.length === subdepartamentos.length;
    const hayPunto = elegidos.length > 0 || sinAsignarElegido;

    /** Lo que dice el campo cerrado. */
    const textoElegido = (() => {
        if (elegidos.length === 0) return sinAsignarElegido ? SIN_ASIGNAR.nombre : '';
        if (elegidos.length === 1) return elegidos[0].nombre;
        if (todosElegidos) return `Todos (${elegidos.length})`;
        if (elegidos.length === 2) return `${elegidos[0].nombre} y ${elegidos[1].nombre}`;
        return `${elegidos[0].nombre}, ${elegidos[1].nombre} y ${elegidos.length - 2} más`;
    })();

    const opciones = useMemo<Opcion[]>(() => {
        const k = sinAcentos(consulta);
        const equipos: Opcion[] = subdepartamentos.map(s => ({
            id: s.id, nombre: s.nombre, color: s.color, meta: plural(s.cantMiembros, 'persona', 'personas'),
        }));
        const todos: Opcion[] = varios && subdepartamentos.length > 1
            ? [{
                id: ID_TODOS, nombre: 'Todos', color: COLOR_VARIOS,
                meta: plural(subdepartamentos.length, 'equipo', 'equipos'),
            }]
            : [];
        return [SIN_ASIGNAR, ...todos, ...equipos].filter(o => !k || sinAcentos(o.nombre).includes(k));
    }, [subdepartamentos, consulta, varios]);

    const estaElegida = (o: Opcion) => {
        if (o.id === null) return sinAsignarElegido;
        if (o.id === ID_TODOS) return todosElegidos;
        return valores.includes(o.id);
    };

    const elegir = (o: Opcion) => {
        setConsulta('');
        setResaltada(0);
        if (o.id === null) {
            onCambiar([], true);
            setAbierta(false);
            return;
        }
        if (o.id === ID_TODOS) {
            onCambiar(todosElegidos ? [] : subdepartamentos.map(s => s.id), false);
            return;
        }
        if (!varios) {
            onCambiar([o.id], false);
            setAbierta(false);
            return;
        }
        const id = o.id;
        onCambiar(valores.includes(id) ? valores.filter(v => v !== id) : [...valores, id], false);
    };

    const abrir = () => { setAbierta(true); setConsulta(''); setResaltada(0); };

    const alTeclear = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!abierta) { setAbierta(true); setResaltada(0); return; }
            const paso = e.key === 'ArrowDown' ? 1 : -1;
            setResaltada(i => (opciones.length ? (i + paso + opciones.length) % opciones.length : 0));
            return;
        }
        if (e.key === 'Enter' && abierta) {
            e.preventDefault();
            const o = opciones[resaltada];
            if (o) elegir(o);
            return;
        }
        if (e.key === 'Escape' && abierta) {
            // La hoja también cierra con Escape: primero se cierra la lista.
            e.preventDefault();
            e.stopPropagation();
            setAbierta(false);
            setConsulta('');
        }
    };

    return (
        <div className="flex flex-col gap-1.5">
            <RotuloDeCampo id={`${idBase}-rotulo`}>{varios ? 'Sub-departamentos' : 'Sub-departamento'}</RotuloDeCampo>
            <div className="relative">
                {hayPunto && (
                    <span className="pointer-events-none absolute left-4 top-1/2 z-[1] flex -translate-y-1/2" aria-hidden="true">
                        <Punto
                            color={elegidos.length === 1 ? elegidos[0].color : elegidos.length > 1 ? COLOR_VARIOS : SIN_ASIGNAR.color}
                            tam={10}
                        />
                    </span>
                )}
                <input
                    ref={refCampo}
                    role="combobox"
                    aria-labelledby={`${idBase}-rotulo`}
                    aria-expanded={abierta}
                    aria-controls={`${idBase}-lista`}
                    aria-autocomplete="list"
                    aria-activedescendant={abierta && opciones[resaltada] ? `${idBase}-op-${resaltada}` : undefined}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${idBase}-error` : undefined}
                    disabled={bloqueado}
                    value={abierta ? consulta : textoElegido}
                    onChange={e => { setConsulta(e.target.value); setAbierta(true); setResaltada(0); }}
                    onFocus={abrir}
                    // Con el foco ya adentro, el foco no vuelve a abrirla: la abre el toque.
                    onClick={() => { if (!abierta) abrir(); }}
                    // Un toque en una opción pasa por el blur: se espera un
                    // instante antes de cerrar para no comerse el click.
                    onBlur={() => window.setTimeout(() => setAbierta(false), 120)}
                    onKeyDown={alTeclear}
                    placeholder={varios ? 'Buscá o elegí uno o más' : 'Buscá o elegí uno'}
                    autoComplete="off"
                    className={`h-[50px] w-full ${hayPunto ? 'pl-10' : 'pl-4'} pr-10 text-[15px] font-semibold disabled:opacity-60`}
                    style={error ? ({ '--ag-borde': '#b42318' } as React.CSSProperties) : undefined}
                />
                <ChevronDown
                    size={15}
                    strokeWidth={2.4}
                    aria-hidden="true"
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-black/[.5]"
                />
            </div>

            {abierta && !bloqueado && (
                <div className="rounded-[18px] bg-white p-1.5 shadow-[0_8px_28px_rgba(0,0,0,.12),0_0_0_1px_rgba(0,0,0,.06)]">
                    <div
                        id={`${idBase}-lista`}
                        role="listbox"
                        aria-labelledby={`${idBase}-rotulo`}
                        aria-multiselectable={varios || undefined}
                        className="flex flex-col gap-0.5"
                    >
                        {opciones.map((o, i) => {
                            const marcada = estaElegida(o);
                            return (
                                <button
                                    key={o.id ?? 'sin'}
                                    id={`${idBase}-op-${i}`}
                                    type="button"
                                    role="option"
                                    aria-selected={marcada}
                                    onMouseDown={e => e.preventDefault()}
                                    onMouseEnter={() => setResaltada(i)}
                                    onClick={() => elegir(o)}
                                    className={`flex min-h-[46px] items-center gap-2.5 rounded-xl px-3 text-left text-[14.5px] font-bold text-[#0a0a0a] ${i === resaltada ? 'bg-[#f2f2f0]' : 'bg-transparent'}`}
                                >
                                    <Punto color={o.color} tam={10} />
                                    {/* "Sin asignar" no se suma a los demás, los reemplaza: no lleva círculo,
                                        y su nombre se lee entero aunque se corte lo de al lado. */}
                                    <span className={o.id === null ? 'flex-none' : 'min-w-0 flex-1 truncate'}>{o.nombre}</span>
                                    <span className={`text-[12px] font-semibold text-black/[.55] ${o.id === null ? 'ml-auto min-w-0 truncate' : 'flex-none'}`}>{o.meta}</span>
                                    {varios && o.id !== null && (
                                        <span
                                            aria-hidden="true"
                                            className={`flex h-5 w-5 flex-none items-center justify-center rounded-full ${marcada ? 'bg-[#0a0a0a] text-white' : 'shadow-[inset_0_0_0_1.5px_rgba(0,0,0,.2)]'}`}
                                        >
                                            {marcada && <Check size={12} strokeWidth={3.2} />}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                        {opciones.length === 0 && (
                            <p className="m-0 p-3 text-[13.5px] font-semibold text-black/[.55]">
                                No hay sub-departamentos con ese nombre.
                            </p>
                        )}
                    </div>
                    {varios && (
                        <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => { setAbierta(false); setConsulta(''); refCampo?.current?.blur(); }}
                            className="mt-1.5 flex h-11 w-full items-center justify-center rounded-xl bg-[#0a0a0a] text-[14px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                        >
                            Listo
                        </button>
                    )}
                </div>
            )}

            {bloqueado && motivoDelBloqueo && (
                <p className="m-0 text-[12.5px] font-semibold text-black/[.62]">{motivoDelBloqueo}</p>
            )}
            {error && <ErrorDeCampo id={`${idBase}-error`}>{error}</ErrorDeCampo>}
        </div>
    );
};

export default ComboboxDeSub;
