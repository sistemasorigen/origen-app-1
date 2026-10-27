import React, { useRef, useState } from 'react';
import { Check, Folder } from 'lucide-react';
import {
    fechaYHora, guardarCarpeta, mensajeDeMotivo, nuevoId, sello,
    type Carpeta, type MotivoAgenda,
} from '../../../services/agenda';
import { PALETA } from '../../../src/contenido/agendaPaleta';
import { ErrorDeCampo, RotuloPaso, tinte } from '../../admin/departamentos/piezas';
import { Hoja, PieDeHoja, usePanel } from '../equipo/piezas';

/**
 * Crear o editar una carpeta (design-claude/Departamento - Tareas: "Crear
 * carpeta").
 *
 * Una carpeta agrupa tareas de un mismo día —"Serie Noviembre", "Nocturna
 * 2026"— y no es más que un nombre y un color: no cambia quién hace la tarea
 * ni cuándo. Borrarla no borra ninguna tarea.
 *
 * `encima` es cuando se abre desde el formulario de la tarea ("Nueva
 * carpeta…"): queda arriba de esa hoja y abajo de las confirmaciones.
 *
 * El id se genera UNA vez al abrir: un doble toque no crea dos carpetas.
 */

const MAXIMO = 80;

const CAMPO: Partial<Record<MotivoAgenda, 'nombre' | 'color' | 'general'>> = {
    nombre_invalido: 'nombre', nombre_duplicado: 'nombre', color_invalido: 'color',
};

const FormularioCarpeta: React.FC<{
    /** Con carpeta, edita; sin ella, crea. */
    carpeta?: Carpeta;
    encima?: boolean;
    onCerrar: () => void;
    onGuardada: (carpeta: Carpeta) => void;
}> = ({ carpeta, encima = false, onCerrar, onGuardada }) => {
    const { depId, confirmar } = usePanel();
    const [id] = useState(() => carpeta?.id ?? nuevoId());
    const [nombre, setNombre] = useState(carpeta?.nombre ?? '');
    const [color, setColor] = useState(carpeta?.color ?? PALETA[1].hex);   // Índigo, como el diseño
    const [tocado, setTocado] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<{ campo: 'nombre' | 'color' | 'general'; texto: string } | null>(null);
    const enviando = useRef(false);
    const campoNombre = useRef<HTMLInputElement>(null);
    // El sello de "ahora" se congela al abrir: no es un reloj, es cuándo se cargó.
    const ahora = useRef(sello()).current;

    const editando = !!carpeta;
    const sinNombre = nombre.trim() === '';
    const hayCambios = nombre !== (carpeta?.nombre ?? '') || color !== (carpeta?.color ?? PALETA[1].hex);
    const errNombre = (error?.campo === 'nombre' ? error.texto : null)
        ?? (tocado && sinNombre ? 'Escribí un nombre para la carpeta.' : null);

    const intentarCerrar = () => {
        if (guardando) return;
        if (!hayCambios) { onCerrar(); return; }
        confirmar({
            tipo: 'destructivo',
            rotulo: 'Cambios sin guardar',
            titulo: editando ? '¿Descartar los cambios?' : '¿Descartar la carpeta?',
            texto: 'Lo que cargaste se pierde.',
            etiquetaBoton: 'Descartar',
            onConfirmar: onCerrar,
        });
    };

    const guardar = async () => {
        if (enviando.current) return;
        if (sinNombre) { setTocado(true); campoNombre.current?.focus(); return; }
        enviando.current = true;
        setGuardando(true);
        setError(null);
        const r = await guardarCarpeta({ id, departamentoId: depId, nombre, color });
        enviando.current = false;
        setGuardando(false);
        if (!r.ok) { setError({ campo: CAMPO[r.motivo] ?? 'general', texto: mensajeDeMotivo(r.motivo) }); return; }
        onGuardada(r.carpeta);
    };

    return (
        <Hoja
            titulo={editando ? 'Editar carpeta' : 'Crear carpeta'}
            subtitulo="Agrupa tareas del mismo día. No cambia quién las hace."
            adelante={(
                <span
                    aria-hidden="true"
                    className="flex h-11 w-11 flex-none items-center justify-center rounded-full"
                    style={{ background: tinte(color), color }}
                >
                    <Folder size={22} strokeWidth={1.75} />
                </span>
            )}
            onCerrar={intentarCerrar}
            ocupada={guardando}
            ancho={460}
            encima={encima}
            pie={(
                <PieDeHoja
                    onCancelar={intentarCerrar}
                    onAceptar={guardar}
                    etiqueta={editando ? 'Guardar' : 'Crear carpeta'}
                    guardando={guardando}
                    apagado={sinNombre}
                    falta="Falta el nombre de la carpeta."
                />
            )}
        >
            <label className="flex flex-col gap-2">
                <RotuloPaso>Nombre</RotuloPaso>
                <input
                    ref={campoNombre}
                    value={nombre}
                    onChange={e => { setNombre(e.target.value); if (error?.campo === 'nombre') setError(null); }}
                    maxLength={MAXIMO}
                    placeholder="Por ejemplo, Semana Santa"
                    aria-invalid={!!errNombre}
                    aria-describedby={errNombre ? 'carpeta-error-nombre' : undefined}
                    autoComplete="off"
                    className="h-[50px] w-full px-4 text-[15px] font-semibold"
                    style={errNombre ? ({ '--ag-borde': '#b42318' } as React.CSSProperties) : undefined}
                />
                {errNombre && <ErrorDeCampo id="carpeta-error-nombre">{errNombre}</ErrorDeCampo>}
                {MAXIMO - nombre.length <= 15 && (
                    <span className="text-[12px] font-semibold text-black/[.58]">Quedan {MAXIMO - nombre.length} letras</span>
                )}
            </label>

            <div className="flex flex-col gap-2.5">
                <RotuloPaso id="carpeta-paso-color">Color</RotuloPaso>
                <div role="radiogroup" aria-labelledby="carpeta-paso-color" className="flex flex-wrap gap-2.5">
                    {PALETA.map(c => {
                        const on = color === c.hex;
                        return (
                            <button
                                key={c.hex}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                aria-label={c.nombre}
                                onClick={() => { setColor(c.hex); if (error?.campo === 'color') setError(null); }}
                                className="flex h-11 w-11 items-center justify-center rounded-full text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-4"
                                style={{ background: c.hex, boxShadow: on ? `0 0 0 3px #fff, 0 0 0 5px ${c.hex}` : undefined }}
                            >
                                {on && <Check size={18} strokeWidth={3} aria-hidden="true" />}
                            </button>
                        );
                    })}
                </div>
                {error?.campo === 'color' && <ErrorDeCampo id="carpeta-error-color">{error.texto}</ErrorDeCampo>}
            </div>

            <div className="rounded-2xl bg-[#f6f6f4] px-3.5 py-3">
                <RotuloPaso>Fecha de creación</RotuloPaso>
                <p className="m-0 mt-1.5 text-[14px] font-semibold text-black/[.62]">
                    {editando ? fechaYHora(carpeta.createdAt) : ahora}
                </p>
            </div>

            {error?.campo === 'general' && <p role="alert" className="m-0 text-[13px] font-bold text-[#b42318]">{error.texto}</p>}
        </Hoja>
    );
};

export default FormularioCarpeta;
