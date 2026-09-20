import React, { useMemo, useState } from 'react';
import { User } from '../../types';
import {
    ClaveFiltro,
    FILTROS,
    cumpleFiltro,
    definicionDe,
    iniciales,
    nombreDeRol,
    rolesConAcceso,
    rolesDe,
} from './catalogoRoles';

/**
 * Listado de usuarios (design-claude/Admin General).
 *
 * El filtro por rol dejó de ser una fila de pestañas y pasó a ser un
 * desplegable: los cajones son ocho y en el teléfono se salían de la
 * pantalla. Adentro se ve cuánta gente hay en cada uno antes de elegir.
 */

interface Props {
    usuarios: User[];
    busqueda: string;
    onBusqueda: (v: string) => void;
    filtro: ClaveFiltro;
    onFiltro: (f: ClaveFiltro) => void;
    onAbrir: (u: User) => void;
    onNuevo: () => void;
    cargando: boolean;
}

const UsuariosAdmin: React.FC<Props> = ({
    usuarios, busqueda, onBusqueda, filtro, onFiltro, onAbrir, onNuevo, cargando,
}) => {
    const [menuAbierto, setMenuAbierto] = useState(false);

    const conteos = useMemo(() => {
        const mapa = {} as Record<ClaveFiltro, number>;
        FILTROS.forEach(f => {
            mapa[f.id] = f.id === 'todos'
                ? usuarios.length
                : usuarios.filter(u => cumpleFiltro(u, f.id)).length;
        });
        return mapa;
    }, [usuarios]);

    const listados = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        return usuarios
            .filter(u => cumpleFiltro(u, filtro))
            .filter(u => !q
                || (u.name || '').toLowerCase().includes(q)
                || (u.email || '').toLowerCase().includes(q));
    }, [usuarios, filtro, busqueda]);

    const activo = FILTROS.find(f => f.id === filtro) || FILTROS[0];

    return (
        <>
            <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex h-11 w-full min-w-0 items-center gap-2.5 rounded-full bg-white pl-[17px] pr-2 md:w-auto md:min-w-[190px] md:flex-1">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,.58)" strokeWidth={2.2} strokeLinecap="round" className="flex-none">
                        <circle cx="11" cy="11" r="6.5" />
                        <path d="M16 16l4 4" />
                    </svg>
                    <input
                        type="text"
                        value={busqueda}
                        onChange={e => onBusqueda(e.target.value)}
                        placeholder="Buscar por nombre o email"
                        className="campo-desnudo min-w-0 flex-1 text-[13.5px] font-medium text-[#0a0a0a]"
                    />
                    {busqueda && (
                        <button
                            onClick={() => onBusqueda('')}
                            aria-label="Limpiar la búsqueda"
                            className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-[#f2f2f0]"
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth={2.4} strokeLinecap="round">
                                <path d="M6 6l12 12M18 6L6 18" />
                            </svg>
                        </button>
                    )}
                </div>
                <button
                    onClick={onNuevo}
                    className="flex h-11 flex-none items-center gap-2 rounded-full bg-[#0a0a0a] px-[18px] text-[13.5px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                    Nuevo usuario
                </button>
            </div>

            {/* Filtro por rol */}
            <div className="relative z-10 mt-3">
                <button
                    onClick={() => setMenuAbierto(v => !v)}
                    aria-expanded={menuAbierto}
                    className={`flex h-[46px] w-full items-center gap-2.5 rounded-full px-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 md:w-auto md:min-w-[340px] ${filtro === 'todos' ? 'bg-white text-[#0a0a0a]' : 'bg-[#0a0a0a] text-white'}`}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                        <path d="M4 7h16M7 12h10M10 17h4" />
                    </svg>
                    <span className={`hidden text-[11px] font-semibold uppercase tracking-[0.07em] sm:block ${filtro === 'todos' ? 'text-black/[.55]' : 'text-white/50'}`}>
                        Filtrar por rol
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{activo.label}</span>
                    <span className={`flex h-[22px] min-w-[22px] flex-none items-center justify-center rounded-full px-[7px] text-[11.5px] font-semibold ${filtro === 'todos' ? 'bg-[#f2f2f0] text-black/[.55]' : 'bg-white/20 text-white'}`}>
                        {conteos[filtro]}
                    </span>
                    <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round"
                        className={`flex-none transition-transform duration-200 ${menuAbierto ? 'rotate-180' : ''}`}
                    >
                        <path d="M6 9l6 6 6-6" />
                    </svg>
                </button>

                {menuAbierto && (
                    <>
                        <div className="fixed inset-0 z-0" onClick={() => setMenuAbierto(false)} />
                        <div className="absolute left-0 top-[52px] z-10 w-full rounded-[20px] bg-white p-2 shadow-[0_14px_40px_rgba(0,0,0,.16)] md:w-[300px]">
                            {FILTROS.map(f => {
                                const on = f.id === filtro;
                                return (
                                    <button
                                        key={f.id}
                                        onClick={() => { onFiltro(f.id); setMenuAbierto(false); }}
                                        className={`flex h-11 w-full items-center gap-2.5 rounded-[14px] px-3 text-[13.5px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] ${on ? 'bg-[#f2f2f0]' : 'hover:bg-[#f7f7f5]'}`}
                                    >
                                        <span className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full ${on ? 'bg-[#0a0a0a] text-white' : 'bg-[#f2f2f0] text-transparent'}`}>
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M5 12.5l4.5 4.5L19 6.5" />
                                            </svg>
                                        </span>
                                        <span className="min-w-0 flex-1 text-left">{f.label}</span>
                                        <span className="flex h-[22px] min-w-[22px] flex-none items-center justify-center rounded-full bg-[#f7f7f5] px-[7px] text-[11.5px] font-semibold text-black/[.55]">
                                            {conteos[f.id]}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            <p className="mx-0.5 mt-3.5 text-[12px] font-semibold text-black/[.6]">
                {cargando
                    ? 'Buscando usuarios…'
                    : `${listados.length} de ${usuarios.length} usuarios${filtro === 'todos' ? '' : ` · ${activo.label}`}`}
            </p>

            {cargando ? (
                <div className="mt-3 grid gap-2.5 [grid-template-columns:minmax(0,1fr)] md:[grid-template-columns:repeat(auto-fill,minmax(310px,1fr))]">
                    {[0, 1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-[102px] rounded-[18px] bg-white" />
                    ))}
                </div>
            ) : listados.length === 0 ? (
                <div className="mt-3 flex flex-col items-center rounded-[20px] bg-white px-[30px] py-12 text-center">
                    <p className="text-[17px] font-semibold text-[#0a0a0a]">Ningún usuario coincide</p>
                    <p className="mt-[9px] max-w-[320px] text-[13.5px] font-medium leading-[1.6] text-black/[.62]">
                        Probá con el nombre completo o el email, o sacá el filtro de rol.
                    </p>
                    <button
                        onClick={() => { onBusqueda(''); onFiltro('todos'); }}
                        className="mt-[18px] h-[46px] rounded-full bg-[#f2f2f0] px-[22px] text-[14px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                    >
                        Limpiar búsqueda y filtros
                    </button>
                </div>
            ) : (
                <div className="mt-3 grid gap-2.5 [grid-template-columns:minmax(0,1fr)] md:[grid-template-columns:repeat(auto-fill,minmax(310px,1fr))]">
                    {listados.map(u => (
                        <TarjetaUsuario key={u.id} usuario={u} onAbrir={() => onAbrir(u)} />
                    ))}
                </div>
            )}
        </>
    );
};

const TarjetaUsuario: React.FC<{ usuario: User; onAbrir: () => void }> = ({ usuario, onAbrir }) => {
    const [fotoRota, setFotoRota] = useState(false);
    // VIEWER es el rol base de cualquiera: no dice nada sobre a qué entra,
    // así que la tarjeta muestra los que sí dan acceso y, si no hay ninguno,
    // la marca ámbar de "Sin rol".
    const conAcceso = rolesConAcceso(rolesDe(usuario));

    return (
        <button
            onClick={onAbrir}
            className="flex w-full min-w-0 items-center gap-3 rounded-[18px] bg-white px-4 py-3.5 text-left transition-shadow hover:shadow-[0_2px_14px_rgba(0,0,0,.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
        >
            <div className="relative flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-full bg-[#f2f2f0] text-[12.5px] font-semibold text-black/[.58]">
                {iniciales(usuario.name || usuario.email || '')}
                {usuario.avatarUrl && !fotoRota && (
                    <img
                        src={usuario.avatarUrl}
                        alt=""
                        onError={() => setFotoRota(true)}
                        className="absolute inset-0 h-full w-full object-cover"
                    />
                )}
            </div>

            <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-[#0a0a0a]">{usuario.name || 'Sin nombre'}</p>
                <p className="mt-[3px] truncate text-[12px] font-medium text-black/[.6]">{usuario.email}</p>
                <div className="mt-2 flex flex-wrap gap-[5px]">
                    {!usuario.isActive && (
                        <span className="flex h-[23px] items-center rounded-full bg-[#fdf6ea] px-2.5 text-[11px] font-semibold text-[#7a4f10]">
                            Inactiva
                        </span>
                    )}
                    {conAcceso.length === 0 ? (
                        <span className="flex h-[23px] items-center rounded-full bg-[#fdf6ea] px-2.5 text-[11px] font-semibold text-[#7a4f10]">
                            Sin rol
                        </span>
                    ) : (
                        conAcceso.map(r => {
                            const fuerte = (definicionDe(r)?.nivel ?? 4) <= 1;
                            return (
                                <span
                                    key={r}
                                    className={`flex h-[23px] items-center rounded-full px-2.5 text-[11px] font-semibold ${fuerte ? 'bg-[#0a0a0a] text-white' : 'bg-[#f2f2f0] text-black/[.66]'}`}
                                >
                                    {nombreDeRol(r)}
                                </span>
                            );
                        })
                    )}
                </div>
            </div>

            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,.4)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                <path d="M9 6l6 6-6 6" />
            </svg>
        </button>
    );
};

export default UsuariosAdmin;
