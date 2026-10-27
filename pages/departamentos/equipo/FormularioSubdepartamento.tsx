import React, { useRef, useState } from 'react';
import { Check } from 'lucide-react';
import {
    guardarSubdepartamento, mensajeDeMotivo, nuevoId,
    type MotivoAgenda, type Persona,
} from '../../../services/agenda';
import { PALETA } from '../../../src/contenido/agendaPaleta';
import SelectorDeEncargados from '../../admin/departamentos/SelectorDeEncargados';
import { ErrorDeCampo, RotuloPaso } from '../../admin/departamentos/piezas';
import { Hoja, PieDeHoja, usePanel } from './piezas';

/**
 * Crear un sub-departamento (design-claude/Departamento - Equipo: "Crear
 * sub-departamento"): nombre, color, quién lo dirige (una persona) y sus
 * miembros (varias). Quien dirige no se ofrece como miembro: cuenta una vez.
 *
 * El id se genera UNA vez al abrir: un doble toque o un reintento no crean
 * dos (agenda_guardar_subdepartamento es idempotente por id).
 */

const MAXIMO = 80;
type Campo = 'nombre' | 'color' | 'lider' | 'miembros' | 'general';
const CAMPO: Partial<Record<MotivoAgenda, Campo>> = {
    nombre_invalido: 'nombre', nombre_duplicado: 'nombre', color_invalido: 'color',
    lider_requerido: 'lider', usuario_inexistente: 'miembros',
};

const FormularioSubdepartamento: React.FC<{ onCerrar: () => void; onCreado: (id: string) => void }> = ({ onCerrar, onCreado }) => {
    const { depId, avisar, confirmar } = usePanel();
    const [id] = useState(nuevoId);
    const [nombre, setNombre] = useState('');
    const [color, setColor] = useState(PALETA[10].hex);   // Rosa, como el diseño
    const [lider, setLider] = useState<Persona[]>([]);
    const [miembros, setMiembros] = useState<Persona[]>([]);
    const [tocado, setTocado] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<{ campo: Campo; texto: string } | null>(null);
    const enviando = useRef(false);
    const campoNombre = useRef<HTMLInputElement>(null);

    const sinNombre = nombre.trim() === '';
    const sinLider = lider.length === 0;
    const hayCambios = !sinNombre || !sinLider || miembros.length > 0;
    const errorDe = (c: Campo) => (error?.campo === c ? error.texto : null);
    const errNombre = errorDe('nombre') ?? (tocado && sinNombre ? 'Escribí un nombre.' : null);
    const errLider = errorDe('lider') ?? (tocado && sinLider ? 'Elegí quién lo va a dirigir.' : null);

    const intentarCerrar = () => {
        if (guardando) return;
        if (!hayCambios) { onCerrar(); return; }
        confirmar({
            tipo: 'destructivo',
            rotulo: 'Cambios sin guardar',
            titulo: '¿Descartar el sub-departamento?',
            texto: 'Lo que cargaste se pierde.',
            etiquetaBoton: 'Descartar',
            onConfirmar: onCerrar,
        });
    };

    const elegirLider = (p: Persona[]) => {
        setLider(p);
        // Quien pasa a dirigir sale de los miembros: cuenta una vez.
        if (p[0]) setMiembros(m => m.filter(x => x.id !== p[0].id));
        if (error?.campo === 'lider') setError(null);
    };

    const crear = async () => {
        if (enviando.current) return;
        if (sinNombre || sinLider) {
            setTocado(true);
            if (sinNombre) campoNombre.current?.focus();
            return;
        }
        enviando.current = true;
        setGuardando(true);
        setError(null);
        const r = await guardarSubdepartamento({
            id, departamentoId: depId, nombre, color, liderId: lider[0].id, miembros: miembros.map(m => m.id),
        });
        enviando.current = false;
        setGuardando(false);
        if (!r.ok) { setError({ campo: CAMPO[r.motivo] ?? 'general', texto: mensajeDeMotivo(r.motivo) }); return; }
        avisar(`${nombre.trim()} está creado.`);
        onCreado(r.id);
    };

    return (
        <Hoja
            titulo="Crear sub-departamento"
            subtitulo="Los sub-departamentos son los equipos que reciben las tareas."
            onCerrar={intentarCerrar}
            ocupada={guardando}
            ancho={600}
            pie={(
                <PieDeHoja
                    onCancelar={intentarCerrar} onAceptar={crear} etiqueta="Crear"
                    guardando={guardando} apagado={sinNombre || sinLider}
                    falta={sinNombre && sinLider ? 'Faltan el nombre y quién lo va a dirigir.'
                        : sinNombre ? 'Falta el nombre.' : 'Falta elegir quién lo va a dirigir.'}
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
                    placeholder="Por ejemplo, Ilustración"
                    aria-invalid={!!errNombre}
                    aria-describedby={errNombre ? 'sub-error-nombre' : undefined}
                    autoComplete="off"
                    className="h-[50px] w-full px-4 text-[15px] font-semibold"
                    style={errNombre ? ({ '--ag-borde': '#b42318' } as React.CSSProperties) : undefined}
                />
                {errNombre && <ErrorDeCampo id="sub-error-nombre">{errNombre}</ErrorDeCampo>}
                {MAXIMO - nombre.length <= 15 && (
                    <span className="text-[12px] font-semibold text-black/[.58]">Quedan {MAXIMO - nombre.length} letras</span>
                )}
            </label>

            <div className="flex flex-col gap-2.5">
                <RotuloPaso id="sub-paso-color">Color</RotuloPaso>
                <div role="radiogroup" aria-labelledby="sub-paso-color" className="flex flex-wrap gap-2.5">
                    {PALETA.map(c => {
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
                {errorDe('color') && <ErrorDeCampo id="sub-error-color">{errorDe('color')}</ErrorDeCampo>}
            </div>

            <SelectorDeEncargados
                elegidos={lider}
                onCambiar={elegirLider}
                color={color}
                error={errLider}
                rotulo="Quién lo dirige"
                idBase="sub-lider"
                uno
                placeholder="Buscar entre todos los usuarios"
                etiquetaBusqueda="Buscar quién lo va a dirigir"
                textoAgregar="Elegir para dirigir"
                etiquetaElegidos="Quién lo dirige"
            />

            <SelectorDeEncargados
                elegidos={miembros}
                onCambiar={m => { setMiembros(m); if (error?.campo === 'miembros') setError(null); }}
                color={color}
                error={errorDe('miembros')}
                rotulo="Miembros"
                idBase="sub-miembros"
                excluir={lider.map(l => l.id)}
                placeholder="Buscar y sumar personas"
                etiquetaBusqueda="Buscar miembros"
                textoAgregar="Sumar como miembro"
                etiquetaElegidos="Miembros elegidos"
            />

            {errorDe('general') && <p role="alert" className="m-0 text-[13px] font-bold text-[#b42318]">{errorDe('general')}</p>}
        </Hoja>
    );
};

export default FormularioSubdepartamento;
