import React, { useEffect, useRef, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { buscarUsuarios, mensajeDeMotivo, type Persona, type PersonaBuscada } from '../../../services/agenda';
import { Avatar, Cargando, ErrorDeCampo, RotuloPaso } from './piezas';

/**
 * El paso 4 del formulario: quiénes administran el departamento.
 *
 * Busca con agenda_buscar_usuarios (nombre o email, sin acentos) a partir de
 * 2 letras y 300 ms después de la última tecla. Cada búsqueda lleva un
 * número; una respuesta que llega tarde —la de "lu" después de la de
 * "luc"— se descarta, así un resultado viejo nunca pisa a uno nuevo.
 *
 * Quien ya está elegido no aparece en los resultados.
 */

const ESPERA_MS = 300;

type Busqueda =
    | { estado: 'quieto' }
    | { estado: 'corto' }
    | { estado: 'buscando' }
    | { estado: 'listo'; usuarios: PersonaBuscada[] }
    | { estado: 'error'; mensaje: string };

const SelectorDeEncargados: React.FC<{
    elegidos: Persona[];
    onCambiar: (personas: Persona[]) => void;
    /** El color del departamento: tiñe las iniciales. */
    color: string;
    /** Texto del error (falta elegir, o lo que dijo la base). */
    error: string | null;
}> = ({ elegidos, onCambiar, color, error }) => {
    const [texto, setTexto] = useState('');
    const [busqueda, setBusqueda] = useState<Busqueda>({ estado: 'quieto' });
    const pedido = useRef(0);

    useEffect(() => {
        const q = texto.trim();
        const numero = ++pedido.current;
        if (q.length === 0) { setBusqueda({ estado: 'quieto' }); return; }
        if (q.length < 2) { setBusqueda({ estado: 'corto' }); return; }
        setBusqueda({ estado: 'buscando' });
        const t = window.setTimeout(async () => {
            const r = await buscarUsuarios(q);
            if (numero !== pedido.current) return;   // llegó otra búsqueda después
            setBusqueda(r.ok
                ? { estado: 'listo', usuarios: r.usuarios }
                : { estado: 'error', mensaje: mensajeDeMotivo(r.motivo) });
        }, ESPERA_MS);
        return () => window.clearTimeout(t);
    }, [texto]);

    const yaElegidos = new Set(elegidos.map(p => p.id));
    const resultados = busqueda.estado === 'listo' ? busqueda.usuarios.filter(u => !yaElegidos.has(u.id)) : [];

    const agregar = (u: PersonaBuscada) => {
        onCambiar([...elegidos, { id: u.id, nombre: u.nombre, avatarUrl: u.avatarUrl }]);
        setTexto('');
    };

    return (
        <div className="flex flex-col gap-2.5" role="group" aria-labelledby="dep-paso-encargados">
            <RotuloPaso id="dep-paso-encargados">4 · Encargados del departamento</RotuloPaso>

            {elegidos.length > 0 && (
                <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Encargados elegidos">
                    {elegidos.map(p => (
                        <li key={p.id} className="flex h-11 items-center gap-2 rounded-full bg-[#f2f2f0] pl-1 text-[13.5px] font-bold text-[#0a0a0a]">
                            <Avatar persona={p} color={color} tam={34} />
                            <span className="max-w-[180px] truncate">{p.nombre || 'Sin nombre'}</span>
                            <button
                                type="button"
                                onClick={() => onCambiar(elegidos.filter(x => x.id !== p.id))}
                                aria-label={`Quitar a ${p.nombre || 'esta persona'}`}
                                className="flex h-11 w-11 items-center justify-center rounded-full text-black/[.62] hover:text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                            >
                                <X size={14} strokeWidth={2.4} aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <label
                className="dep-pastilla flex h-[50px] items-center gap-2.5 rounded-2xl bg-[#f6f6f4] px-3.5"
                style={{ boxShadow: error ? 'inset 0 0 0 2px #b42318' : 'inset 0 0 0 1px rgba(0,0,0,.06)' }}
            >
                <Search size={16} strokeWidth={2} className="flex-none text-black/50" aria-hidden="true" />
                <input
                    type="search"
                    value={texto}
                    onChange={e => setTexto(e.target.value)}
                    placeholder="Buscar por nombre o email"
                    aria-label="Buscar usuarios para sumar como encargados"
                    aria-invalid={!!error}
                    aria-describedby={error ? 'dep-error-encargados' : 'dep-ayuda-encargados'}
                    autoComplete="off"
                    className="campo-desnudo min-w-0 flex-1 text-[14.5px] font-semibold"
                />
                {busqueda.estado === 'buscando' && <span className="flex-none text-black/50"><Cargando /></span>}
            </label>

            {error && <ErrorDeCampo id="dep-error-encargados">{error}</ErrorDeCampo>}

            <div id="dep-ayuda-encargados" aria-live="polite" className="flex flex-col gap-0.5">
                {busqueda.estado === 'corto' && (
                    <p className="m-0 px-1 text-[12.5px] font-semibold text-black/[.6]">Escribí al menos 2 letras.</p>
                )}
                {busqueda.estado === 'error' && (
                    <p className="m-0 px-1 text-[12.5px] font-semibold text-[#b42318]">{busqueda.mensaje}</p>
                )}
                {busqueda.estado === 'listo' && resultados.length === 0 && (
                    <p className="m-0 px-1 text-[12.5px] font-semibold text-black/[.6]">
                        {busqueda.usuarios.length > 0
                            ? 'Ya elegiste a todas las personas que coinciden.'
                            : `No encontramos a nadie con “${texto.trim()}”. Probá con el email.`}
                    </p>
                )}
                {resultados.map(u => (
                    <button
                        key={u.id}
                        type="button"
                        onClick={() => agregar(u)}
                        className="flex min-h-[52px] items-center gap-3 rounded-[14px] px-2.5 py-1.5 text-left transition-colors hover:bg-[#f6f6f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                    >
                        <Avatar persona={u} color={color} tam={36} />
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-bold text-[#0a0a0a]">{u.nombre || 'Sin nombre'}</span>
                            <span className="block truncate text-[12.5px] font-medium text-black/[.6]">{u.email || 'Sin email'}</span>
                        </span>
                        <Plus size={18} strokeWidth={2.2} className="flex-none text-black/[.62]" aria-hidden="true" />
                        <span className="sr-only">Sumar como encargado</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default SelectorDeEncargados;
