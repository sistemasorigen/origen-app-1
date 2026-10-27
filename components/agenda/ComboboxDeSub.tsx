import React, { useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Subdepartamento } from '../../services/agenda';
import { ErrorDeCampo, RotuloPaso, plural, sinAcentos } from '../../pages/admin/departamentos/piezas';
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
 * tarea queda esperando asignación— y no el fondo de la lista.
 */

interface Opcion { id: string | null; nombre: string; color: string; meta: string }

const SIN_ASIGNAR: Opcion = {
    id: null, nombre: 'Sin asignar todavía', color: 'rgba(0,0,0,.25)', meta: 'Queda esperando',
};

const ComboboxDeSub: React.FC<{
    subdepartamentos: Subdepartamento[];
    valor: string | null;
    onCambiar: (id: string | null) => void;
    /** Una tarea completada no cambia de equipo: lo rechaza la base. */
    bloqueado?: boolean;
    /** Por qué está bloqueado, en palabras. */
    motivoDelBloqueo?: string;
    error?: string | null;
}> = ({ subdepartamentos, valor, onCambiar, bloqueado = false, motivoDelBloqueo, error }) => {
    const [abierta, setAbierta] = useState(false);
    const [consulta, setConsulta] = useState('');
    const [resaltada, setResaltada] = useState(0);
    const idBase = useRef(`sub-${Math.random().toString(36).slice(2, 8)}`).current;

    const elegido = subdepartamentos.find(s => s.id === valor) ?? null;

    const opciones = useMemo<Opcion[]>(() => {
        const k = sinAcentos(consulta);
        const equipos: Opcion[] = subdepartamentos.map(s => ({
            id: s.id, nombre: s.nombre, color: s.color, meta: plural(s.cantMiembros, 'persona', 'personas'),
        }));
        return [SIN_ASIGNAR, ...equipos].filter(o => !k || sinAcentos(o.nombre).includes(k));
    }, [subdepartamentos, consulta]);

    const elegir = (o: Opcion) => {
        onCambiar(o.id);
        setAbierta(false);
        setConsulta('');
    };

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
        <div className="flex flex-col gap-2">
            <RotuloPaso id={`${idBase}-rotulo`}>Sub-departamento</RotuloPaso>
            <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2" aria-hidden="true">
                    <Punto color={elegido ? elegido.color : 'rgba(0,0,0,.2)'} tam={10} />
                </span>
                <input
                    role="combobox"
                    aria-labelledby={`${idBase}-rotulo`}
                    aria-expanded={abierta}
                    aria-controls={`${idBase}-lista`}
                    aria-autocomplete="list"
                    aria-activedescendant={abierta && opciones[resaltada] ? `${idBase}-op-${resaltada}` : undefined}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${idBase}-error` : undefined}
                    disabled={bloqueado}
                    value={abierta ? consulta : (elegido ? elegido.nombre : '')}
                    onChange={e => { setConsulta(e.target.value); setAbierta(true); setResaltada(0); }}
                    onFocus={() => { setAbierta(true); setConsulta(''); setResaltada(0); }}
                    // Un toque en una opción pasa por el blur: se espera un
                    // instante antes de cerrar para no comerse el click.
                    onBlur={() => window.setTimeout(() => setAbierta(false), 120)}
                    onKeyDown={alTeclear}
                    placeholder="Buscá o elegí uno"
                    autoComplete="off"
                    className="h-[50px] w-full pl-10 pr-10 text-[15px] font-semibold disabled:opacity-60"
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
                <div
                    id={`${idBase}-lista`}
                    role="listbox"
                    aria-labelledby={`${idBase}-rotulo`}
                    className="flex flex-col gap-0.5 rounded-[18px] bg-white p-1.5 shadow-[0_8px_28px_rgba(0,0,0,.12),0_0_0_1px_rgba(0,0,0,.06)]"
                >
                    {opciones.map((o, i) => (
                        <button
                            key={o.id ?? 'sin'}
                            id={`${idBase}-op-${i}`}
                            type="button"
                            role="option"
                            aria-selected={valor === o.id}
                            onMouseDown={e => e.preventDefault()}
                            onMouseEnter={() => setResaltada(i)}
                            onClick={() => elegir(o)}
                            className={`flex min-h-[46px] items-center gap-2.5 rounded-xl px-3 text-left text-[14.5px] font-bold text-[#0a0a0a] ${i === resaltada ? 'bg-[#f2f2f0]' : 'bg-transparent'}`}
                        >
                            <Punto color={o.color} tam={10} />
                            <span className="min-w-0 flex-1 truncate">{o.nombre}</span>
                            <span className="flex-none text-[12px] font-semibold text-black/[.55]">{o.meta}</span>
                        </button>
                    ))}
                    {opciones.length === 0 && (
                        <p className="m-0 p-3 text-[13.5px] font-semibold text-black/[.55]">
                            No hay sub-departamentos con ese nombre.
                        </p>
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
