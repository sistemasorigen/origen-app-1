import React, { useState } from 'react';
import { Check, ChevronDown, type LucideIcon } from 'lucide-react';
import { Hoja } from './equipo/piezas';

/**
 * La navegación entre secciones de un panel de Agenda Origen
 * (design-claude/Departamento - Tareas y Sub-departamento - Panel: el control
 * "Secciones del departamento").
 *
 * POR QUÉ DOS FORMAS. La fila de pastillas funciona bien con tres o cuatro
 * secciones; con cinco ya no entra en 390 px y la última queda escondida
 * atrás de un borde que nadie sabe que se desliza. Así que desde 768 px queda
 * la fila, y en el teléfono una sola pastilla con la sección actual que abre
 * una hoja con todas, cada una con una línea que dice para qué es.
 *
 * Las dos formas convive en el DOM y se eligen con CSS (`md:hidden` /
 * `hidden md:flex`), no midiendo el ancho con JavaScript: así no parpadea al
 * entrar ni al rotar el teléfono (instrucciones, sección 8).
 *
 * La URL no la toca: avisa qué se eligió y el panel es el que navega, así el
 * botón atrás sigue recorriendo las secciones.
 */

export interface Seccion<T extends string> {
    id: T;
    etiqueta: string;
    /** Una línea que dice para qué es la sección, en la hoja del teléfono. */
    descripcion: string;
    Icono: LucideIcon;
    /** La pastilla roja: cuántas cosas hay sin revisar. 0 no se dibuja. */
    insignia?: number;
}

const Insignia: React.FC<{ cuantas: number; sobreNegro?: boolean; chica?: boolean }> = ({
    cuantas, sobreNegro = false, chica = false,
}) => (
    <span
        className={`flex flex-none items-center justify-center rounded-full font-extrabold ${chica ? 'h-5 min-w-[20px] px-1.5 text-[11px]' : 'h-[22px] min-w-[22px] px-[7px] text-[11.5px]'} ${sobreNegro ? 'bg-white text-[#0a0a0a]' : 'bg-[#dc2626] text-white'}`}
    >
        {cuantas}
        <span className="sr-only"> sin revisar</span>
    </span>
);

const NavegacionDeSecciones = <T extends string>({
    secciones, actual, onIr, titulo, idDelPanel, deshabilitado = false,
}: {
    secciones: Seccion<T>[];
    actual: T;
    onIr: (id: T) => void;
    /** "Secciones del departamento" / "Secciones". Titula la hoja y la lista. */
    titulo: string;
    /** El id del <div role="tabpanel"> que estas pestañas controlan. */
    idDelPanel: string;
    /** Mientras no hay datos, no se puede cambiar de sección. */
    deshabilitado?: boolean;
}) => {
    const [abierta, setAbierta] = useState(false);
    const laActual = secciones.find(s => s.id === actual) ?? secciones[0];
    const elegir = (id: T) => { setAbierta(false); onIr(id); };

    /**
     * La pastilla de la pastilla cerrada cuenta lo que hay en las OTRAS
     * secciones: con el desplegable cerrado, lo único que no se ve es eso, y
     * es justo lo que hay que avisar. Lo de la sección actual ya está a la
     * vista ahí abajo.
     */
    const enLasOtras = secciones
        .filter(s => s.id !== actual)
        .reduce((suma, s) => suma + (s.insignia || 0), 0);

    return (
        <>
            {/* Teléfono: una pastilla con la sección actual */}
            <div className="mt-4 flex pb-4 md:hidden">
                <button
                    type="button"
                    onClick={() => setAbierta(true)}
                    disabled={deshabilitado}
                    aria-haspopup="menu"
                    aria-expanded={abierta}
                    aria-controls={idDelPanel}
                    className="flex h-12 max-w-full items-center gap-2.5 rounded-full bg-[#0a0a0a] pl-[7px] pr-4 text-[14.5px] font-bold text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                >
                    <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-white/[.16]">
                        <laActual.Icono size={17} strokeWidth={1.9} aria-hidden="true" />
                    </span>
                    <span className="sr-only">{titulo}: </span>
                    <span className="flex-none whitespace-nowrap">{laActual.etiqueta}</span>
                    {enLasOtras > 0 && <Insignia cuantas={enLasOtras} sobreNegro chica />}
                    <ChevronDown size={14} strokeWidth={2.6} aria-hidden="true" className="flex-none opacity-75" />
                </button>
            </div>

            {/* Compu: la fila de pastillas */}
            <div
                role="tablist"
                aria-label={titulo}
                className="ag-fila-pestanas mt-4 hidden gap-2 overflow-x-auto pb-4 md:flex"
            >
                {secciones.map(({ id, etiqueta, Icono, insignia }) => {
                    const activa = actual === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={activa}
                            aria-controls={idDelPanel}
                            onClick={() => onIr(id)}
                            disabled={deshabilitado}
                            className={`flex h-11 flex-none items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${activa ? 'bg-[#0a0a0a] text-white' : 'bg-[#f2f2f0] text-black/[.66] hover:text-[#0a0a0a]'}`}
                        >
                            <Icono size={16} strokeWidth={1.9} aria-hidden="true" />
                            {etiqueta}
                            {!!insignia && <Insignia cuantas={insignia} sobreNegro={activa} chica />}
                        </button>
                    );
                })}
            </div>

            {abierta && (
                <Hoja titulo={titulo} onCerrar={() => setAbierta(false)} ancho={420}>
                    <div role="menu" aria-label={titulo} className="flex flex-col gap-0.5 pb-2">
                        {secciones.map(({ id, etiqueta, descripcion, Icono, insignia }) => {
                            const activa = actual === id;
                            const idDesc = `nav-${id}-desc`;
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    role="menuitem"
                                    aria-current={activa}
                                    // El nombre es la sección y la descripción va
                                    // aparte: si no, el nombre sería el párrafo
                                    // entero y "Tareas" entraría dentro de
                                    // "…que reciben las tareas".
                                    aria-label={etiqueta}
                                    aria-describedby={idDesc}
                                    onClick={() => elegir(id)}
                                    className={`flex min-h-[60px] items-center gap-3 rounded-2xl px-2.5 text-left transition-colors hover:bg-[#f6f6f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] ${activa ? 'bg-[#f6f6f4]' : ''}`}
                                >
                                    <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-white text-[#0a0a0a] shadow-[inset_0_0_0_1px_rgba(0,0,0,.08)]">
                                        <Icono size={17} strokeWidth={1.75} aria-hidden="true" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[14.5px] font-bold text-[#0a0a0a]">{etiqueta}</span>
                                        <span id={idDesc} className="mt-0.5 block text-[12.5px] font-medium leading-[1.35] text-black/[.58]">
                                            {descripcion}
                                        </span>
                                    </span>
                                    {!!insignia && <Insignia cuantas={insignia} />}
                                    {activa && <Check size={18} strokeWidth={2.6} aria-hidden="true" className="flex-none" />}
                                </button>
                            );
                        })}
                    </div>
                </Hoja>
            )}
        </>
    );
};

export default NavegacionDeSecciones;
