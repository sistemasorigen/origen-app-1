import React, { useEffect, useRef, useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import {
    guardarDepartamento, mensajeDeMotivo, nuevoId,
    type DepartamentoAdmin, type MotivoAgenda, type Persona,
} from '../../../services/agenda';
import { ICONOS, PALETA } from '../../../src/contenido/agendaPaleta';
import { motion, useDragControls, useReducedMotion } from 'framer-motion';
import { useBloqueoDeFondo } from '../../../hooks/useBloqueoDeFondo';
import SelectorDeEncargados from './SelectorDeEncargados';
import { Cargando, ErrorDeCampo, IconoDeDepartamento, RotuloPaso } from './piezas';

/**
 * Crear o editar un departamento (design-claude/Sistemas - Departamentos):
 * nombre, color, ícono y encargados, con la vista previa arriba.
 *
 * En el teléfono sube como hoja desde abajo; desde 768 px es un modal
 * centrado. Mismo patrón que la hoja de secciones de Administrador.
 *
 * El id de un departamento nuevo se genera UNA vez, al abrir: un doble toque
 * o un reintento después de un corte mandan el mismo id, y la base devuelve
 * el que ya había en vez de crear dos (agenda_guardar_departamento es
 * idempotente por id).
 *
 * Los errores de la base van debajo del campo que corresponde; lo que no es
 * de ningún campo (sin permiso, sin conexión) va arriba de los botones.
 */

const MAXIMO_NOMBRE = 80;

export type ModoFormulario = { tipo: 'crear' } | { tipo: 'editar'; departamento: DepartamentoAdmin };

type CampoConError = 'nombre' | 'color' | 'icono' | 'encargados' | 'general';

const CAMPO_DEL_MOTIVO: Partial<Record<MotivoAgenda, CampoConError>> = {
    nombre_invalido: 'nombre', nombre_duplicado: 'nombre',
    color_invalido: 'color', icono_invalido: 'icono',
    sin_encargados: 'encargados', usuario_inexistente: 'encargados',
};

interface Valores { nombre: string; color: string; icono: string; encargados: Persona[] }

const valoresIniciales = (modo: ModoFormulario): Valores => modo.tipo === 'editar'
    ? {
        nombre: modo.departamento.nombre,
        color: modo.departamento.color,
        icono: modo.departamento.icono,
        encargados: modo.departamento.encargados,
    }
    : { nombre: '', color: PALETA[0].hex, icono: ICONOS[0].clave, encargados: [] };

const mismos = (a: Valores, b: Valores) =>
    a.nombre.trim() === b.nombre.trim() && a.color === b.color && a.icono === b.icono
    && a.encargados.map(p => p.id).sort().join() === b.encargados.map(p => p.id).sort().join();

const FormularioDepartamento: React.FC<{
    modo: ModoFormulario;
    onCerrar: () => void;
    /** Ya guardado. Devuelve los ids de los encargados que quedaron. */
    onGuardado: (r: { creado: boolean; nombre: string; encargados: string[] }) => void;
    /** Pide la confirmación de borrar (la arma la sección, con los conteos). */
    onEliminar?: () => void;
    /** Pide "¿Descartar los cambios?" y, si se confirma, cierra. */
    onDescartar: () => void;
    /** Hay una confirmación encima: Escape es de ella, no de esta hoja. */
    confirmacionAbierta: boolean;
}> = ({ modo, onCerrar, onGuardado, onEliminar, onDescartar, confirmacionAbierta }) => {
    useBloqueoDeFondo(true);
    const [id] = useState(() => (modo.tipo === 'editar' ? modo.departamento.id : nuevoId()));
    const [inicial] = useState(() => valoresIniciales(modo));
    const [v, setV] = useState<Valores>(inicial);
    const [tocado, setTocado] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [errorBase, setErrorBase] = useState<{ campo: CampoConError; texto: string } | null>(null);
    const enviando = useRef(false);
    const panel = useRef<HTMLDivElement>(null);
    const campoNombre = useRef<HTMLInputElement>(null);

    /**
     * Cerrar deslizándola, como las hojas del módulo (equipo/piezas.tsx).
     * Esta hoja tiene su propio marco —es de Sistemas, no del panel— así que
     * el arrastre va copiado y no heredado: el patrón es el mismo, desde la
     * manija y el encabezado, y pasa por intentarCerrar, que es el que
     * pregunta "¿Descartar los cambios?".
     */
    const [esMovil, setEsMovil] = useState(
        () => typeof window !== 'undefined' && window.innerWidth < 768,
    );
    const sinMovimiento = useReducedMotion();
    const arrastre = useDragControls();

    useEffect(() => {
        const medir = () => setEsMovil(window.innerWidth < 768);
        medir();
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, []);

    const editando = modo.tipo === 'editar';
    const sinNombre = v.nombre.trim() === '';
    const sinEncargados = v.encargados.length === 0;
    const invalido = sinNombre || sinEncargados;
    const hayCambios = !mismos(v, inicial);

    const cambiar = (p: Partial<Valores>) => {
        setV(prev => ({ ...prev, ...p }));
        // Lo que dijo la base era sobre lo de antes: si se toca ese campo, se va.
        if (errorBase && (errorBase.campo === 'general' || Object.keys(p).includes(errorBase.campo))) setErrorBase(null);
    };

    const intentarCerrar = () => {
        if (guardando) return;
        if (hayCambios) onDescartar(); else onCerrar();
    };

    // El foco entra a la hoja: el teclado y el lector de pantalla arrancan ahí.
    useEffect(() => { panel.current?.focus(); }, []);

    useEffect(() => {
        const alTeclear = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !confirmacionAbierta) intentarCerrar();
        };
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    });

    const guardar = async () => {
        if (enviando.current) return;
        if (invalido) {
            setTocado(true);
            if (sinNombre) campoNombre.current?.focus();
            else document.querySelector<HTMLInputElement>('#dep-formulario input[type="search"]')?.focus();
            return;
        }
        enviando.current = true;
        setGuardando(true);
        setErrorBase(null);
        const encargados = v.encargados.map(p => p.id);
        const r = await guardarDepartamento({ id, nombre: v.nombre, color: v.color, icono: v.icono, encargados });
        enviando.current = false;
        setGuardando(false);
        if (!r.ok) {
            setErrorBase({ campo: CAMPO_DEL_MOTIVO[r.motivo] ?? 'general', texto: mensajeDeMotivo(r.motivo) });
            return;
        }
        onGuardado({ creado: r.creado, nombre: v.nombre.trim(), encargados });
    };

    const errorDe = (campo: CampoConError) => (errorBase?.campo === campo ? errorBase.texto : null);
    const errorNombre = errorDe('nombre') ?? (tocado && sinNombre ? 'Escribí un nombre para el departamento.' : null);
    const errorEncargados = errorDe('encargados') ?? (tocado && sinEncargados ? 'Elegí al menos un encargado.' : null);
    const quedan = MAXIMO_NOMBRE - v.nombre.length;
    const titulo = editando ? 'Editar departamento' : 'Crear departamento';
    /** Qué falta, en palabras: se lee arriba de los botones y lo anuncia el lector (como PieDeHoja). */
    const falta = !invalido || guardando ? ''
        : sinNombre && sinEncargados ? 'Falta el nombre y al menos un encargado.'
            : sinNombre ? 'Falta el nombre del departamento.'
                : 'Falta elegir al menos un encargado.';

    return (
        <div className="fixed inset-0 z-[110] flex items-end justify-center md:items-center md:p-10">
            <div className="absolute inset-0 bg-[rgba(10,10,10,.36)] motion-safe:animate-[depFade_.18s_ease_both]" onClick={intentarCerrar} />
            <motion.div
                id="dep-formulario"
                ref={panel}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="dep-form-titulo"
                className="relative flex max-h-[92dvh] w-full flex-col rounded-t-[28px] bg-white shadow-[0_-10px_40px_rgba(0,0,0,.18)] outline-none md:max-h-[calc(100dvh-64px)] md:max-w-[600px] md:rounded-[28px] md:shadow-[0_24px_60px_rgba(0,0,0,.22)]"
                initial={esMovil ? { y: '100%' } : { opacity: 0, y: 10, scale: 0.98 }}
                animate={esMovil ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
                transition={sinMovimiento ? { duration: 0 } : { type: 'spring', damping: 34, stiffness: 340 }}
                drag={esMovil ? 'y' : false}
                dragListener={false}
                dragControls={arrastre}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.6 }}
                onDragEnd={(_, info) => { if (info.offset.y > 90) intentarCerrar(); }}
            >
                <div
                    onPointerDown={esMovil ? e => arrastre.start(e) : undefined}
                    className="flex-none pb-1 pt-2.5 md:hidden"
                    style={esMovil ? { touchAction: 'none', cursor: 'grab' } : undefined}
                    data-manija="true"
                >
                    <span aria-hidden="true" className="mx-auto block h-[5px] w-11 rounded-full bg-black/[.16]" />
                </div>

                {/* La vista previa: así se va a ver en la lista y en la Agenda. */}
                <div
                    onPointerDown={esMovil ? e => arrastre.start(e) : undefined}
                    style={esMovil ? { touchAction: 'none' } : undefined}
                    className="flex flex-none items-center gap-3 px-[22px] pb-2 pt-[18px]"
                >
                    <span
                        className="flex h-14 w-14 flex-none items-center justify-center rounded-full text-white transition-colors duration-200"
                        style={{ background: v.color }}
                        aria-hidden="true"
                    >
                        <IconoDeDepartamento clave={v.icono} tam={26} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 id="dep-form-titulo" className="m-0 text-[19px] font-bold text-[#0a0a0a]">{titulo}</h2>
                        <p className="m-0 mt-0.5 truncate text-[13px] font-semibold text-black/[.58]">{v.nombre.trim() || 'Vista previa'}</p>
                    </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-[22px] overflow-y-auto overscroll-contain px-[22px] pb-4 pt-2.5">
                    {/* 1 · Nombre */}
                    <label className="flex flex-col gap-2">
                        <RotuloPaso>1 · Nombre del departamento</RotuloPaso>
                        <input
                            ref={campoNombre}
                            value={v.nombre}
                            onChange={e => cambiar({ nombre: e.target.value })}
                            maxLength={MAXIMO_NOMBRE}
                            placeholder="Por ejemplo, Bienvenida"
                            aria-invalid={!!errorNombre}
                            aria-describedby={errorNombre ? 'dep-error-nombre' : quedan <= 15 ? 'dep-cuenta-nombre' : undefined}
                            autoComplete="off"
                            className="h-[50px] w-full px-4 text-[15px] font-semibold"
                            // index.html pinta los campos de #admin-general con
                            // !important y un borde que sale de esta variable:
                            // redefinirla acá es lo único que le gana (también
                            // al foco, que la pone en negro).
                            style={errorNombre ? ({ '--panel-campo-borde': '#b42318' } as React.CSSProperties) : undefined}
                        />
                        <span className="flex items-start justify-between gap-3">
                            {errorNombre ? <ErrorDeCampo id="dep-error-nombre">{errorNombre}</ErrorDeCampo> : <span />}
                            {quedan <= 15 && (
                                <span id="dep-cuenta-nombre" className={`flex-none text-[12px] font-semibold ${quedan === 0 ? 'text-[#b42318]' : 'text-black/[.58]'}`}>
                                    {quedan === 1 ? 'Queda 1 letra' : `Quedan ${quedan} letras`}
                                </span>
                            )}
                        </span>
                    </label>

                    {/* 2 · Color */}
                    <div className="flex flex-col gap-2.5">
                        <RotuloPaso id="dep-paso-color">2 · Color</RotuloPaso>
                        <div role="radiogroup" aria-labelledby="dep-paso-color" className="flex flex-wrap gap-2.5">
                            {PALETA.map(c => {
                                const elegido = v.color === c.hex;
                                return (
                                    <button
                                        key={c.hex}
                                        type="button"
                                        role="radio"
                                        aria-checked={elegido}
                                        aria-label={c.nombre}
                                        onClick={() => cambiar({ color: c.hex })}
                                        className="flex h-11 w-11 items-center justify-center rounded-full text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-4"
                                        style={{ background: c.hex, boxShadow: elegido ? `0 0 0 3px #fff, 0 0 0 5px ${c.hex}` : undefined }}
                                    >
                                        {elegido && <Check size={18} strokeWidth={3} aria-hidden="true" />}
                                    </button>
                                );
                            })}
                        </div>
                        {errorDe('color') && <ErrorDeCampo id="dep-error-color">{errorDe('color')}</ErrorDeCampo>}
                    </div>

                    {/* 3 · Ícono */}
                    <div className="flex flex-col gap-2.5">
                        <RotuloPaso id="dep-paso-icono">3 · Ícono</RotuloPaso>
                        <div role="radiogroup" aria-labelledby="dep-paso-icono" className="grid grid-cols-[repeat(auto-fill,minmax(48px,1fr))] gap-1.5">
                            {ICONOS.map(i => {
                                const elegido = v.icono === i.clave;
                                return (
                                    <button
                                        key={i.clave}
                                        type="button"
                                        role="radio"
                                        aria-checked={elegido}
                                        aria-label={i.nombre}
                                        title={i.nombre}
                                        onClick={() => cambiar({ icono: i.clave })}
                                        className="flex h-12 items-center justify-center rounded-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                        style={elegido ? { background: v.color, color: '#fff' } : { background: '#f6f6f4', color: 'rgba(0,0,0,.62)' }}
                                    >
                                        <IconoDeDepartamento clave={i.clave} tam={21} />
                                    </button>
                                );
                            })}
                        </div>
                        {errorDe('icono') && <ErrorDeCampo id="dep-error-icono">{errorDe('icono')}</ErrorDeCampo>}
                    </div>

                    {/* 4 · Encargados */}
                    <SelectorDeEncargados
                        elegidos={v.encargados}
                        onCambiar={encargados => cambiar({ encargados })}
                        color={v.color}
                        error={errorEncargados}
                    />

                    {editando && onEliminar && (
                        <div className="border-t border-black/[.06] pt-4">
                            <button
                                type="button"
                                onClick={onEliminar}
                                disabled={guardando}
                                className="flex h-11 items-center gap-2 rounded-full px-1 text-[14px] font-bold text-[#b42318] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b42318] focus-visible:ring-offset-2 disabled:opacity-40"
                            >
                                <Trash2 size={17} strokeWidth={1.9} aria-hidden="true" />
                                Eliminar departamento
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex-none border-t border-black/[.06] px-[22px] pb-[calc(20px+env(safe-area-inset-bottom))] pt-3.5 md:pb-6">
                    {errorDe('general') && (
                        <p role="alert" className="m-0 mb-3 text-[13px] font-bold text-[#b42318]">{errorDe('general')}</p>
                    )}
                    {/* Siempre montada, aunque esté vacía: una región viva que nace
                        junto con su texto no siempre se anuncia. Vacía no ocupa. */}
                    <p id="dep-falta" role="status" className="m-0 mb-2.5 text-[12.5px] font-semibold leading-[1.45] text-black/[.62] empty:hidden">
                        {falta}
                    </p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={intentarCerrar}
                            disabled={guardando}
                            className="h-[50px] flex-1 rounded-full bg-[#f2f2f0] text-[14.5px] font-bold text-black/[.66] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 disabled:opacity-40"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={guardar}
                            // Se ve apagado, pero responde: al tocarlo marca lo
                            // que falta (instrucciones, 7.15). Por eso no lleva
                            // aria-disabled: anunciaría un botón que no hace nada.
                            aria-describedby={falta ? 'dep-falta' : undefined}
                            className={`flex h-[50px] flex-[1.4] items-center justify-center gap-2 rounded-full bg-[#0a0a0a] text-[14.5px] font-bold text-white transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${invalido ? 'opacity-[.32]' : ''}`}
                        >
                            {guardando && <Cargando />}
                            {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear departamento'}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default FormularioDepartamento;
