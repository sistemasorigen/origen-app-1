import React, { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { buscarUsuarios, type PersonaBuscada } from '../../../services/agenda';
import { estimarAudiencia, rolesDisponibles, type RolDisponible } from '../../../services/notificaciones';
import { nombreDeRol } from '../catalogoRoles';
import type { UserRole } from '../../../types';
import { iniciales } from '../departamentos/piezas';
import { Cargando, ErrorDeCampo, Perilla, RotuloPaso } from './piezas';

/**
 * "4 · A quién le llega" de una programada: toda la iglesia, o roles, y/o
 * personas puntuales. Se suman y sin repetir (lo resuelve la base).
 *
 * Abajo, la estimación en vivo con notif_estimar_audiencia: es la MISMA cuenta
 * que hace la emisión, así que el número que se ve es el que sale. Si pasa del
 * tope por emisión (5000), se pinta en rojo y el editor no deja guardar.
 */

export interface Elegida { id: string; nombre: string | null }

export interface Estimacion { personas: number; conPush: number; tope: number }

const SelectorDeAudiencia: React.FC<{
    todos: boolean;
    roles: string[];
    personas: Elegida[];
    onCambiar: (p: { todos?: boolean; roles?: string[]; personas?: Elegida[] }) => void;
    onEstimacion: (e: Estimacion | null) => void;
    error: string | null;
}> = ({ todos, roles, personas, onCambiar, onEstimacion, error }) => {
    const [disponibles, setDisponibles] = useState<RolDisponible[] | null>(null);
    const [falloRoles, setFalloRoles] = useState(false);
    const [q, setQ] = useState('');
    const [resultados, setResultados] = useState<PersonaBuscada[] | null>(null);
    const [buscando, setBuscando] = useState(false);
    const [estimacion, setEstimacion] = useState<Estimacion | null>(null);
    const [estimando, setEstimando] = useState(false);
    const pedido = useRef(0);

    useEffect(() => {
        rolesDisponibles().then(r => {
            if (r.ok) setDisponibles(r.roles); else setFalloRoles(true);
        });
    }, []);

    // Buscar personas: desde 2 letras, con una pausa para no pedir por tecla.
    useEffect(() => {
        const texto = q.trim();
        if (texto.length < 2) { setResultados(null); return; }
        setBuscando(true);
        const t = window.setTimeout(async () => {
            const r = await buscarUsuarios(texto);
            setBuscando(false);
            setResultados(r.ok ? r.usuarios : []);
        }, 280);
        return () => window.clearTimeout(t);
    }, [q]);

    // La estimación, con debounce. El número de pedido descarta respuestas
    // viejas que lleguen tarde.
    const clave = `${todos}|${roles.slice().sort().join(',')}|${personas.map(p => p.id).sort().join(',')}`;
    useEffect(() => {
        if (!todos && roles.length === 0 && personas.length === 0) {
            setEstimacion(null); onEstimacion(null); setEstimando(false); return;
        }
        const n = ++pedido.current;
        setEstimando(true);
        const t = window.setTimeout(async () => {
            const r = await estimarAudiencia(todos, roles, personas.map(p => p.id));
            if (n !== pedido.current) return;
            setEstimando(false);
            const e = r.ok ? { personas: r.personas, conPush: r.conPush, tope: r.tope } : null;
            setEstimacion(e);
            onEstimacion(e);
        }, 400);
        return () => window.clearTimeout(t);
    }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps

    const alternarRol = (rol: string) =>
        onCambiar({ roles: roles.includes(rol) ? roles.filter(r => r !== rol) : [...roles, rol] });

    const sumar = (p: PersonaBuscada) => {
        if (!personas.some(x => x.id === p.id)) onCambiar({ personas: [...personas, { id: p.id, nombre: p.nombre }] });
        setQ('');
        setResultados(null);
    };

    const pasaTope = !!estimacion && estimacion.personas > estimacion.tope;
    const sinNada = !todos && roles.length === 0 && personas.length === 0;

    return (
        <div className="flex flex-col gap-3">
            <RotuloPaso>4 · A quién le llega</RotuloPaso>

            <button
                type="button"
                role="switch"
                aria-checked={todos}
                onClick={() => onCambiar({ todos: !todos })}
                className="flex min-h-[60px] w-full items-center gap-3 rounded-[18px] bg-[#f6f6f4] px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
            >
                <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-bold text-[#0a0a0a]">Toda la iglesia</span>
                    <span className="mt-0.5 block text-[12.5px] font-medium text-black/[.6]">Todas las cuentas activas de la app</span>
                </span>
                <Perilla on={todos} />
            </button>

            {!todos && (
                <>
                    <div className="flex flex-col gap-2">
                        <span id="notif-roles" className="text-[13px] font-bold text-black/[.62]">O por roles</span>
                        {disponibles === null && !falloRoles && (
                            <span className="flex items-center gap-2 text-[12.5px] font-semibold text-black/[.55]"><Cargando tam={14} /> Cargando roles…</span>
                        )}
                        {falloRoles && <span className="text-[12.5px] font-semibold text-black/[.6]">No pudimos traer los roles. Cerrá y volvé a abrir el editor.</span>}
                        {disponibles && (
                            <div role="group" aria-labelledby="notif-roles" className="flex flex-wrap gap-1.5">
                                {disponibles.map(r => {
                                    const on = roles.includes(r.rol);
                                    return (
                                        <button
                                            key={r.rol}
                                            type="button"
                                            aria-pressed={on}
                                            onClick={() => alternarRol(r.rol)}
                                            className={`flex min-h-[40px] items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${on ? 'bg-[#0a0a0a] text-white' : 'bg-[#f2f2f0] text-[#0a0a0a] hover:bg-[#eaeae7]'}`}
                                        >
                                            {nombreDeRol(r.rol as UserRole)}
                                            <span className={`text-[11.5px] font-bold ${on ? 'text-white/65' : 'text-black/45'}`}>{r.personas}</span>
                                        </button>
                                    );
                                })}
                                {/* Un rol elegido que hoy no tiene a nadie (no viene en la lista). */}
                                {roles.filter(r => !disponibles.some(d => d.rol === r)).map(r => (
                                    <button
                                        key={r}
                                        type="button"
                                        aria-pressed
                                        onClick={() => alternarRol(r)}
                                        className="flex min-h-[40px] items-center gap-1.5 rounded-full bg-[#0a0a0a] px-3.5 text-[13px] font-semibold text-white"
                                    >
                                        {nombreDeRol(r as UserRole)} <span className="text-[11.5px] font-bold text-white/65">0</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2">
                        <span className="text-[13px] font-bold text-black/[.62]">Y/o personas puntuales</span>
                        {personas.length > 0 && (
                            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                                {personas.map(p => (
                                    <li key={p.id} className="flex h-9 items-center gap-1.5 rounded-full bg-[#f2f2f0] pl-1 pr-1.5">
                                        <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[10.5px] font-bold text-black/70">{iniciales(p.nombre)}</span>
                                        <span className="max-w-[180px] truncate text-[13px] font-semibold">{p.nombre || 'Sin nombre'}</span>
                                        <button
                                            type="button"
                                            onClick={() => onCambiar({ personas: personas.filter(x => x.id !== p.id) })}
                                            aria-label={`Sacar a ${p.nombre || 'esta persona'}`}
                                            className="flex h-7 w-7 items-center justify-center rounded-full text-black/55 hover:bg-white hover:text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                                        >
                                            <X size={14} strokeWidth={2.4} aria-hidden="true" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <label className="notif-pastilla flex h-12 items-center gap-2.5 rounded-full bg-[#f6f6f4] px-4">
                            <Search size={17} strokeWidth={2} className="flex-none text-black/50" aria-hidden="true" />
                            <input
                                type="search"
                                value={q}
                                onChange={e => setQ(e.target.value)}
                                placeholder="Buscar por nombre o email"
                                aria-label="Buscar personas"
                                autoComplete="off"
                                className="campo-desnudo min-w-0 flex-1 text-[14.5px] font-semibold"
                            />
                            {buscando && <Cargando tam={15} />}
                        </label>
                        {resultados && resultados.length > 0 && (
                            <div className="flex flex-col overflow-hidden rounded-[18px] border border-black/[.08]">
                                {resultados.slice(0, 6).map(u => {
                                    const ya = personas.some(p => p.id === u.id);
                                    return (
                                        <button
                                            key={u.id}
                                            type="button"
                                            disabled={ya}
                                            onClick={() => sumar(u)}
                                            className="flex min-h-[54px] items-center gap-3 px-3.5 py-2 text-left hover:bg-[#f6f6f4] focus-visible:bg-[#f6f6f4] focus-visible:outline-none disabled:opacity-45"
                                        >
                                            <span aria-hidden="true" className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#f2f2f0] text-[11px] font-bold text-black/70">{iniciales(u.nombre)}</span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-[14px] font-semibold">{u.nombre || 'Sin nombre'}</span>
                                                <span className="block truncate text-[12px] font-medium text-black/55">{ya ? 'Ya está elegida' : u.email}</span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {resultados && resultados.length === 0 && !buscando && (
                            <span className="text-[12.5px] font-semibold text-black/[.6]">No encontramos a nadie con ese nombre o email.</span>
                        )}
                    </div>
                </>
            )}

            {error && <ErrorDeCampo id="notif-error-audiencia">{error}</ErrorDeCampo>}

            <div
                role="status"
                className={`rounded-[16px] px-4 py-3 text-[13.5px] font-bold ${pasaTope ? 'bg-[#fdecea] text-[#b42318]' : 'bg-[#f6f6f4] text-[#0a0a0a]'}`}
            >
                {sinNada ? 'Todavía no elegiste a quién le llega.'
                    : estimando && !estimacion ? 'Calculando a cuántas personas le llega…'
                        : !estimacion ? 'No pudimos calcular a cuántas personas le llega.'
                            : pasaTope
                                ? `Le llega a ${estimacion.personas} personas: el máximo por envío es ${estimacion.tope}. Achicá la audiencia para poder guardar.`
                                : `Le llega a ${estimacion.personas} ${estimacion.personas === 1 ? 'persona' : 'personas'} · ${estimacion.conPush} con el push activado`}
            </div>
        </div>
    );
};

export default SelectorDeAudiencia;
