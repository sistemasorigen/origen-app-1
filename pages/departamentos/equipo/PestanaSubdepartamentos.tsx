import React, { useMemo, useState } from 'react';
import { ChevronRight, LayoutGrid, Plus, Search } from 'lucide-react';
import { Avatar, sinAcentos } from '../../admin/departamentos/piezas';
import FormularioSubdepartamento from './FormularioSubdepartamento';
import { BOTON_NEGRO, Mensaje, Punto, TARJETA, usePanel } from './piezas';

/**
 * La lista de sub-departamentos (design-claude/Departamento - Equipo):
 * buscador por nombre o por quien dirige, "Crear sub-departamento", y una
 * planilla en la compu / tarjetas en el teléfono. Tocar uno abre su detalle
 * (&sub=<id>).
 */

const integrantes = (n: number) => `${n} ${n === 1 ? 'integrante' : 'integrantes'}`;

const PestanaSubdepartamentos: React.FC = () => {
    const { datos, recargar, ir } = usePanel();
    const [q, setQ] = useState('');
    const [creando, setCreando] = useState(false);

    const filas = useMemo(() => {
        const k = sinAcentos(q);
        if (!k) return datos.subdepartamentos;
        return datos.subdepartamentos.filter(s => sinAcentos(`${s.nombre} ${s.lider?.nombre || ''}`).includes(k));
    }, [datos.subdepartamentos, q]);

    return (
        <>
            <div className="flex flex-wrap items-center gap-2.5">
                <label className="dep-pastilla flex h-12 min-w-[200px] flex-1 items-center gap-2.5 rounded-full bg-white px-4 shadow-[0_1px_2px_rgba(0,0,0,.04)]">
                    <Search size={17} strokeWidth={2} className="flex-none text-black/50" aria-hidden="true" />
                    <input
                        type="search"
                        value={q}
                        onChange={e => setQ(e.target.value)}
                        placeholder="Buscar sub-departamento o persona"
                        aria-label="Buscar sub-departamento o quien lo dirige"
                        className="min-w-0 flex-1 text-[14.5px] font-semibold"
                    />
                </label>
                <button type="button" onClick={() => setCreando(true)} className={`${BOTON_NEGRO} flex-none pl-4`}>
                    <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
                    Crear sub-departamento
                </button>
            </div>

            {filas.length === 0 ? (
                <Mensaje
                    icono={<LayoutGrid size={26} strokeWidth={1.75} />}
                    titulo={q.trim() ? 'No encontramos ese sub-departamento' : 'Todavía no hay sub-departamentos'}
                    texto={q.trim() ? 'Probá con otro nombre o con el de quien lo dirige.' : 'Los sub-departamentos son los equipos que reciben las tareas.'}
                />
            ) : (
                <>
                    {/* Compu: la planilla */}
                    <div className={`${TARJETA} mt-4 hidden overflow-hidden md:block`}>
                        <table className="w-full border-collapse text-left">
                            <thead>
                                <tr className="border-b border-black/[.06] text-[11px] font-bold uppercase tracking-[0.08em] text-black/[.58]">
                                    <th scope="col" className="px-5 py-3.5 font-bold">Sub-departamento</th>
                                    <th scope="col" className="px-3 py-3.5 font-bold">Quién lo dirige</th>
                                    <th scope="col" className="px-3 py-3.5 font-bold">Miembros</th>
                                    <th scope="col" className="px-5 py-3.5"><span className="sr-only">Acciones</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filas.map(s => (
                                    <tr key={s.id} className="border-b border-black/[.05] last:border-0 hover:bg-[#fafaf8]">
                                        <td className="px-5 py-3">
                                            <span className="flex items-center gap-3 text-[15px] font-bold"><Punto color={s.color} tam={12} />{s.nombre}</span>
                                        </td>
                                        <td className="px-3 py-3">
                                            {s.lider ? (
                                                <span className="flex min-w-0 items-center gap-2.5 text-[14px] font-semibold">
                                                    <Avatar persona={s.lider} color={s.color} tam={32} />
                                                    <span className="truncate">{s.lider.nombre || 'Sin nombre'}</span>
                                                </span>
                                            ) : <span className="text-[14px] font-semibold text-black/[.55]">Sin nadie</span>}
                                        </td>
                                        <td className="px-3 py-3 text-[14px] font-semibold text-black/[.62]">{integrantes(s.cantMiembros)}</td>
                                        <td className="px-5 py-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() => ir('subdepartamentos', s.id)}
                                                aria-label={`Ver detalles de ${s.nombre}`}
                                                className="h-11 rounded-full bg-[#f2f2f0] px-4 text-[13px] font-bold text-black/[.66] hover:text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                            >
                                                Ver detalles
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Teléfono: tarjetas */}
                    <ul className="m-0 mt-4 flex list-none flex-col gap-2.5 p-0 md:hidden">
                        {filas.map(s => (
                            <li key={s.id}>
                                <button
                                    type="button"
                                    onClick={() => ir('subdepartamentos', s.id)}
                                    className={`${TARJETA} flex w-full items-center gap-3.5 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]`}
                                >
                                    <span className="w-1.5 self-stretch rounded-full" style={{ background: s.color }} aria-hidden="true" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[16px] font-bold text-[#0a0a0a]">{s.nombre}</span>
                                        <span className="mt-2 flex items-center gap-2 text-[13px] font-semibold text-black/[.62]">
                                            {s.lider && <Avatar persona={s.lider} color={s.color} tam={24} />}
                                            <span className="truncate">{s.lider?.nombre || 'Sin nadie que lo dirija'} · {integrantes(s.cantMiembros)}</span>
                                        </span>
                                    </span>
                                    <ChevronRight size={18} strokeWidth={2.2} className="flex-none text-black/[.38]" aria-hidden="true" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </>
            )}

            {creando && (
                <FormularioSubdepartamento
                    onCerrar={() => setCreando(false)}
                    onCreado={async () => { setCreando(false); await recargar(); }}
                />
            )}
        </>
    );
};

export default PestanaSubdepartamentos;
