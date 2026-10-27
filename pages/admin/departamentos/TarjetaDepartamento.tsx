import React from 'react';
import { Trash2 } from 'lucide-react';
import type { DepartamentoAdmin } from '../../../services/agenda';
import { Avatar, IconoDeDepartamento, nombreDePila, plural, tinte } from './piezas';

/**
 * Un departamento en la lista: ícono en un círculo de su color, nombre, los
 * números y los encargados apilados (hasta 3).
 *
 * Tocar la tarjeta abre la edición —es lo que se hace casi siempre—. Los dos
 * botones de abajo son los del diseño; "Editar" es además el que encuentra
 * el teclado y el lector de pantalla (la tarjeta en sí no es un botón: no
 * puede tener otros botones adentro).
 */

/** "Lucía Ferreyra y Tomás Aguirre" · "Lucía, Tomás y 2 más". */
const textoEncargados = (encargados: DepartamentoAdmin['encargados']) => {
    if (encargados.length === 0) return 'Sin encargados';
    if (encargados.length <= 2) return encargados.map(e => e.nombre || 'Sin nombre').join(' y ');
    return `${encargados.slice(0, 2).map(e => nombreDePila(e.nombre)).join(', ')} y ${encargados.length - 2} más`;
};

const TarjetaDepartamento: React.FC<{
    departamento: DepartamentoAdmin;
    onEditar: () => void;
    onEliminar: () => void;
}> = ({ departamento: d, onEditar, onEliminar }) => {
    const resumen = [
        plural(d.cantSubdepartamentos, 'sub-departamento', 'sub-departamentos'),
        plural(d.cantMiembros, 'miembro', 'miembros'),
        plural(d.cantTareas, 'tarea', 'tareas'),
    ].join(' · ');

    return (
        <article
            onClick={onEditar}
            className="flex cursor-pointer flex-col gap-4 rounded-[26px] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,.04)] transition-shadow hover:shadow-[0_2px_14px_rgba(0,0,0,.07)]"
        >
            <div className="flex items-center gap-3.5">
                <span
                    className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full"
                    style={{ background: tinte(d.color), color: d.color }}
                >
                    <IconoDeDepartamento clave={d.icono} />
                </span>
                <div className="min-w-0 flex-1">
                    <h2 className="m-0 truncate text-[17px] font-bold tracking-[-0.01em] text-[#0a0a0a]">{d.nombre}</h2>
                    <p className="m-0 mt-[3px] text-[13px] font-semibold text-black/[.62]">{resumen}</p>
                </div>
            </div>

            <div className="flex items-center gap-2.5">
                {d.encargados.length > 0 && (
                    <div className="flex flex-none pl-1.5">
                        {d.encargados.slice(0, 3).map((e, i) => (
                            <span key={e.id} title={e.nombre || undefined} className={i ? '-ml-2' : '-ml-1.5'}>
                                <Avatar persona={e} color={d.color} tam={32} anillo />
                            </span>
                        ))}
                    </div>
                )}
                <p className="m-0 min-w-0 flex-1 text-[13px] font-semibold leading-[1.4] text-black/[.62]">
                    <span className="sr-only">Encargados: </span>
                    {textoEncargados(d.encargados)}
                </p>
            </div>

            <div className="flex gap-2 border-t border-black/[.06] pt-3.5">
                <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onEditar(); }}
                    aria-label={`Editar ${d.nombre}`}
                    className="h-11 flex-1 rounded-full bg-[#f2f2f0] text-[13.5px] font-bold text-black/[.66] transition-colors hover:text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                >
                    Editar
                </button>
                <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onEliminar(); }}
                    aria-label={`Eliminar ${d.nombre}`}
                    className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#f2f2f0] text-[#b42318] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                >
                    <Trash2 size={17} strokeWidth={1.9} aria-hidden="true" />
                </button>
            </div>
        </article>
    );
};

export default TarjetaDepartamento;
