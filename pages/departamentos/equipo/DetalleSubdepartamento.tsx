import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArrowLeft, ArrowLeftRight, Check, MoreHorizontal, Pencil, UserPlus } from 'lucide-react';
import {
    agregarMiembros, archivarSubdepartamento, fechaDesdeIso, fechaIso, getTareasSubdepartamento,
    guardarSubdepartamento, hoyIso, mensajeDeMotivo, reasignarTarea,
    type MotivoAgenda, type Subdepartamento, type Tarea,
} from '../../../services/agenda';
import { PALETA } from '../../../src/contenido/agendaPaleta';
import { useAuth } from '../../../contexts/AuthContext';
import DetalleTarea from '../../../components/agenda/DetalleTarea';
import type { AccionesDeAgenda, DatosParaEditar } from '../../../components/agenda/contratos';
import { Avatar, Cargando, ErrorDeCampo } from '../../admin/departamentos/piezas';
import HojaPersonas from './HojaPersonas';
import { useAccionesDeEquipo } from './accionesDeEquipo';
import {
    BOTON_CHICO, BOTON_GRIS, BOTON_ICONO, BOTON_NEGRO, ChipEstado, HojaElegir, Punto,
    ROTULO, TARJETA, fechaCorta, usePanel,
} from './piezas';

/**
 * El detalle de un sub-departamento (&sub=<id>), según "Departamento -
 * Equipo": nombre y color editables en el lugar, quién lo dirige, sus
 * integrantes, sus tareas y, al final, archivarlo.
 *
 * Las tareas son las del mes en curso ± 2 meses
 * (agenda_tareas_subdepartamento). Reasignar una la pasa a otro equipo del
 * mismo departamento.
 */

/** El mes en curso ± 2: del día 1 de hace dos meses al último día de dentro de dos meses. */
const rangoDeTareas = () => {
    const hoy = fechaDesdeIso(hoyIso());
    return {
        desde: fechaIso(new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1)),
        hasta: fechaIso(new Date(hoy.getFullYear(), hoy.getMonth() + 3, 0)),
    };
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

type CargaDeTareas = { estado: 'cargando' } | { estado: 'error'; motivo: MotivoAgenda } | { estado: 'listo'; tareas: Tarea[] };

const DetalleSubdepartamento: React.FC<{ sub: Subdepartamento }> = ({ sub }) => {
    const { depId, datos, recargar, avisar, confirmar, ir } = usePanel();
    const { user } = useAuth();
    const acciones = useAccionesDeEquipo();
    const [editando, setEditando] = useState(false);
    const [borrador, setBorrador] = useState({ nombre: sub.nombre, color: sub.color });
    const [guardandoNombre, setGuardandoNombre] = useState(false);
    const [errorNombre, setErrorNombre] = useState<string | null>(null);
    const [agregando, setAgregando] = useState(false);
    const [reasignando, setReasignando] = useState<Tarea | null>(null);
    const [tareaAbierta, setTareaAbierta] = useState<string | null>(null);
    const [carga, setCarga] = useState<CargaDeTareas>({ estado: 'cargando' });
    const campo = useRef<HTMLInputElement>(null);

    const cargarTareas = useCallback(async () => {
        setCarga({ estado: 'cargando' });
        const { desde, hasta } = rangoDeTareas();
        const r = await getTareasSubdepartamento(sub.id, desde, hasta);
        setCarga(r.ok ? { estado: 'listo', tareas: r.tareas } : { estado: 'error', motivo: r.motivo });
    }, [sub.id]);
    useEffect(() => { cargarTareas(); }, [cargarTareas]);

    // ── Nombre y color, en el lugar ─────────────────────────────────────
    const empezarEdicion = () => {
        setBorrador({ nombre: sub.nombre, color: sub.color });
        setErrorNombre(null);
        setEditando(true);
        window.setTimeout(() => campo.current?.focus(), 0);
    };
    const guardarNombre = async () => {
        if (guardandoNombre) return;
        if (!borrador.nombre.trim()) { setErrorNombre('Escribí un nombre.'); return; }
        setGuardandoNombre(true);
        const r = await guardarSubdepartamento({
            id: sub.id, departamentoId: depId, nombre: borrador.nombre, color: borrador.color,
            liderId: sub.lider?.id ?? null, miembros: [],
        });
        setGuardandoNombre(false);
        if (!r.ok) { setErrorNombre(mensajeDeMotivo(r.motivo)); return; }
        setEditando(false);
        avisar('Cambios guardados.');
        await recargar();
    };

    // ── Reasignar ───────────────────────────────────────────────────────
    const otros = datos.subdepartamentos.filter(s => s.id !== sub.id);
    const pedirReasignar = (t: Tarea, destinoId: string) => {
        const destino = otros.find(s => s.id === destinoId);
        if (!destino) return;
        confirmar({
            tipo: 'control',
            rotulo: 'Reasignar tarea',
            titulo: `¿Pasar “${t.nombre}” a ${destino.nombre}?`,
            // TODO prompt 8: cuando estén los emails, decir que les llega un aviso.
            texto: `Los integrantes de ${destino.nombre} la van a ver en su Agenda, y deja de estar en la de ${sub.nombre}.`,
            etiquetaBoton: `Pasar a ${destino.nombre}`,
            onConfirmar: async () => {
                const r = await reasignarTarea(t.id, destino.id);
                if (!r.ok) { avisar(mensajeDeMotivo(r.motivo), 'error'); return; }
                avisar(`“${t.nombre}” pasó a ${destino.nombre}.`);
                await Promise.all([cargarTareas(), recargar()]);
            },
        });
    };

    // ── Archivar ────────────────────────────────────────────────────────
    const pedirArchivo = () => confirmar({
        tipo: 'destructivo',
        rotulo: 'Archivar',
        titulo: `¿Archivar ${sub.nombre}?`,
        texto: 'Las tareas pendientes vuelven a Esperando asignación. Las completadas se conservan. Sus integrantes dejan de verlo.',
        etiquetaBoton: 'Archivar sub-departamento',
        onConfirmar: async () => {
            const r = await archivarSubdepartamento(sub.id);
            if (!r.ok) { avisar(mensajeDeMotivo(r.motivo), 'error'); return; }
            const partes = [
                r.tareasAEsperando ? `${plural(r.tareasAEsperando, 'tarea volvió', 'tareas volvieron')} a Esperando asignación` : '',
                r.completadasConservadas ? `${plural(r.completadasConservadas, 'completada queda', 'completadas quedan')} en el historial` : '',
            ].filter(Boolean);
            avisar(`Se archivó ${sub.nombre}${partes.length ? `: ${partes.join(' y ')}` : ''}.`);
            ir('subdepartamentos', null);
            await recargar();
        },
    });

    const tareas = carga.estado === 'listo' ? carga.tareas : [];

    // Tocar una tarea abre el MISMO panel que en la pestaña Tareas: acá no
    // hay una versión chica del detalle. Sin onPedirCarpeta, el formulario de
    // edición no ofrece "Nueva carpeta…": las carpetas se arman allá.
    const accionesDeTarea = useMemo<AccionesDeAgenda>(() => ({ confirmar, avisar }), [confirmar, avisar]);
    const edicionDeTarea = useMemo<DatosParaEditar>(() => ({
        departamentoId: depId,
        subdepartamentos: datos.subdepartamentos,
        carpetas: datos.carpetas,
        prioridades: datos.prioridades,
        miNombre: user?.name ?? null,
        onIrAConfig: () => ir('config'),
    }), [depId, datos, user?.name, ir]);

    return (
        <>
            <button type="button" onClick={() => ir('subdepartamentos', null)} className={`${BOTON_CHICO} pl-3`}>
                <ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" />
                Sub-departamentos
            </button>

            {/* Nombre */}
            <section aria-label="Nombre y color" className={`${TARJETA} mt-4 p-[22px]`}>
                {!editando ? (
                    <div className="flex flex-wrap items-center gap-3.5">
                        <Punto color={sub.color} tam={16} />
                        <h2 className="m-0 min-w-0 flex-1 text-[24px] font-bold tracking-[-0.02em] md:text-[26px]">{sub.nombre}</h2>
                        <button type="button" onClick={empezarEdicion} className={BOTON_CHICO}>
                            <Pencil size={15} strokeWidth={2} aria-hidden="true" />
                            Editar nombre
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3.5">
                        <input
                            ref={campo}
                            value={borrador.nombre}
                            onChange={e => { setBorrador(b => ({ ...b, nombre: e.target.value })); setErrorNombre(null); }}
                            onKeyDown={e => {
                                if (e.key === 'Enter') { e.preventDefault(); guardarNombre(); }
                                if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEditando(false); }
                            }}
                            maxLength={80}
                            aria-label="Nombre del sub-departamento"
                            aria-invalid={!!errorNombre}
                            aria-describedby={errorNombre ? 'sub-detalle-error' : undefined}
                            className="h-[52px] w-full px-4 text-[18px] font-bold"
                            style={errorNombre ? ({ '--ag-borde': '#b42318' } as React.CSSProperties) : undefined}
                        />
                        {errorNombre && <ErrorDeCampo id="sub-detalle-error">{errorNombre}</ErrorDeCampo>}
                        <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-2">
                            {PALETA.map(c => {
                                const on = borrador.color === c.hex;
                                return (
                                    <button
                                        key={c.hex}
                                        type="button"
                                        role="radio"
                                        aria-checked={on}
                                        aria-label={c.nombre}
                                        onClick={() => setBorrador(b => ({ ...b, color: c.hex }))}
                                        className="flex h-11 w-11 items-center justify-center rounded-full text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-4"
                                        style={{ background: c.hex, boxShadow: on ? `0 0 0 3px #fff, 0 0 0 5px ${c.hex}` : undefined }}
                                    >
                                        {on && <Check size={17} strokeWidth={3} aria-hidden="true" />}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setEditando(false)} disabled={guardandoNombre} className={`${BOTON_GRIS} flex-1 md:flex-none`}>Cancelar</button>
                            <button type="button" onClick={guardarNombre} disabled={guardandoNombre} className={`${BOTON_NEGRO} flex-1 md:flex-none`}>
                                {guardandoNombre && <Cargando />}Guardar
                            </button>
                        </div>
                    </div>
                )}
                <p className="m-0 mt-3 text-[13.5px] font-semibold text-black/[.58]">
                    {plural(sub.cantMiembros, 'integrante', 'integrantes')} · {plural(sub.enProceso, 'tarea en proceso', 'tareas en proceso')} · {datos.departamento.nombre}
                </p>
            </section>

            <div className="mt-3.5 grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
                <div className="flex flex-col gap-3.5">
                    {/* Quién lo dirige */}
                    <section aria-labelledby="sub-quien" className={`${TARJETA} p-5`}>
                        <h3 id="sub-quien" className={`${ROTULO} mb-3`}>Quién lo dirige</h3>
                        <div className="flex items-center gap-3">
                            {sub.lider
                                ? <Avatar persona={sub.lider} color={sub.color} tam={46} />
                                : <span className="h-[46px] w-[46px] flex-none rounded-full bg-[#f2f2f0]" aria-hidden="true" />}
                            <span className="min-w-0 flex-1 truncate text-[15.5px] font-bold">{sub.lider?.nombre || 'Nadie todavía'}</span>
                            <button type="button" onClick={() => acciones.cambiarQuienDirige(sub)} className={BOTON_CHICO}>Cambiar</button>
                        </div>
                    </section>

                    {/* Integrantes */}
                    <section aria-labelledby="sub-integrantes" className={`${TARJETA} p-5`}>
                        <h3 id="sub-integrantes" className={`${ROTULO} mb-2.5`}>Integrantes · {sub.miembros.length}</h3>
                        {sub.miembros.length === 0 ? (
                            <p className="m-0 py-2 text-[14px] font-semibold text-black/[.58]">Todavía no hay integrantes además de quien lo dirige.</p>
                        ) : (
                            <ul className="m-0 flex list-none flex-col p-0">
                                {sub.miembros.map(m => (
                                    <li key={m.id} className="flex min-h-[56px] items-center gap-3 border-b border-black/[.05] last:border-0">
                                        <Avatar persona={m} color={sub.color} tam={36} />
                                        <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">{m.nombre || 'Sin nombre'}</span>
                                        <button type="button" onClick={() => acciones.abrirMenu(sub, m)} aria-label={`Opciones para ${m.nombre || 'esta persona'}`} className={BOTON_ICONO}>
                                            <MoreHorizontal size={18} strokeWidth={2.4} aria-hidden="true" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <button type="button" onClick={() => setAgregando(true)} className={`${BOTON_CHICO} mt-3 w-full`}>
                            <UserPlus size={16} strokeWidth={2.1} aria-hidden="true" />
                            Agregar integrantes
                        </button>
                    </section>
                </div>

                {/* Tareas */}
                <section aria-labelledby="sub-tareas" className={`${TARJETA} p-5`}>
                    <h3 id="sub-tareas" className={`${ROTULO} mb-1`}>Tareas{carga.estado === 'listo' ? ` · ${tareas.length}` : ''}</h3>
                    <p className="m-0 mb-2 text-[12.5px] font-semibold text-black/[.55]">Del mes en curso, dos meses para atrás y dos para adelante.</p>
                    {carga.estado === 'cargando' && (
                        <div aria-busy="true" className="flex flex-col gap-2 py-2">
                            {[0, 1, 2].map(i => <div key={i} className="h-14 rounded-2xl bg-[#f2f2f0] motion-safe:animate-[depBrillo_1.2s_infinite]" />)}
                        </div>
                    )}
                    {carga.estado === 'error' && (
                        <div className="py-3">
                            <p className="m-0 text-[14px] font-semibold text-[#b42318]">{mensajeDeMotivo(carga.motivo)}</p>
                            <button type="button" onClick={cargarTareas} className={`${BOTON_CHICO} mt-2`}>Reintentar</button>
                        </div>
                    )}
                    {carga.estado === 'listo' && tareas.length === 0 && (
                        <p className="m-0 py-3 text-[14px] font-semibold text-black/[.58]">Todavía no hay tareas para este sub-departamento.</p>
                    )}
                    {tareas.length > 0 && (
                        <ul className="m-0 flex list-none flex-col p-0">
                            {tareas.map(t => {
                                const completada = t.estado === 'completada';
                                return (
                                    <li key={t.id} className="flex flex-wrap items-center gap-3.5 border-b border-black/[.05] py-3 last:border-0">
                                        <span className="w-[92px] flex-none text-[12.5px] font-bold leading-[1.35] text-black/[.66]">
                                            {fechaCorta(t.fecha)}<br />
                                            <span className="font-semibold text-black/[.55]">{t.todoElDia ? 'Todo el día' : `${t.horaDesde}–${t.horaHasta}`}</span>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setTareaAbierta(t.id)}
                                            aria-label={`Ver ${t.nombre}`}
                                            className="flex min-w-[160px] flex-1 flex-col items-start gap-1.5 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                        >
                                            <span className="text-[14.5px] font-bold">{t.nombre}</span>
                                            <span className="flex flex-wrap items-center gap-1.5">
                                                <ChipEstado estado={t.estado} />
                                                {t.carpeta && (
                                                    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-black/[.62]">
                                                        <Punto color={t.carpeta.color} tam={8} />{t.carpeta.nombre}
                                                    </span>
                                                )}
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setReasignando(t)}
                                            disabled={completada || otros.length === 0}
                                            title={completada ? 'Ya está completada: no se reasigna.' : otros.length === 0 ? 'No hay otro sub-departamento.' : undefined}
                                            aria-describedby={completada ? `sub-tarea-${t.id}-porque` : undefined}
                                            className={BOTON_CHICO}
                                        >
                                            <ArrowLeftRight size={14} strokeWidth={2} aria-hidden="true" />
                                            Reasignar
                                        </button>
                                        {completada && <span id={`sub-tarea-${t.id}-porque`} className="sr-only">Ya está completada: no se reasigna.</span>}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            </div>

            <div className="mt-6 border-t border-black/[.06] pt-5">
                <button
                    type="button"
                    onClick={pedirArchivo}
                    className="flex h-11 items-center gap-2 rounded-full px-1 text-[14px] font-bold text-[#b42318] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b42318] focus-visible:ring-offset-2"
                >
                    <Archive size={17} strokeWidth={1.9} aria-hidden="true" />
                    Archivar sub-departamento
                </button>
            </div>

            {acciones.nodo}

            {agregando && (
                <HojaPersonas
                    titulo={`Agregar integrantes a ${sub.nombre}`}
                    subtitulo="Van a ver las tareas de este sub-departamento en su Agenda."
                    excluir={[...(sub.lider ? [sub.lider.id] : []), ...sub.miembros.map(m => m.id)]}
                    color={sub.color}
                    etiqueta={n => (n > 1 ? `Agregar ${n}` : 'Agregar')}
                    etiquetaBusqueda="Buscar personas para sumar"
                    textoAgregar="Elegir"
                    onAceptar={async personas => {
                        const r = await agregarMiembros(sub.id, personas.map(p => p.id));
                        if (!r.ok) { avisar(mensajeDeMotivo(r.motivo), 'error'); return false; }
                        avisar(r.agregados === 1 ? 'Se sumó 1 integrante.' : `Se sumaron ${r.agregados} integrantes.`);
                        await recargar();
                        return true;
                    }}
                    onCerrar={() => setAgregando(false)}
                />
            )}

            {tareaAbierta && (
                <DetalleTarea
                    key={tareaAbierta}
                    tareaId={tareaAbierta}
                    acciones={accionesDeTarea}
                    edicion={edicionDeTarea}
                    onCerrar={() => setTareaAbierta(null)}
                    onCambio={async cambio => {
                        if (cambio.tipo === 'eliminada') setTareaAbierta(null);
                        await Promise.all([cargarTareas(), recargar()]);
                    }}
                />
            )}

            {reasignando && (
                <HojaElegir
                    titulo="Reasignar tarea"
                    subtitulo={`“${reasignando.nombre}”. ¿A qué sub-departamento pasa?`}
                    opciones={otros.map(s => ({ id: s.id, nombre: s.nombre, color: s.color, meta: plural(s.cantMiembros, 'integrante', 'integrantes') }))}
                    vacio="No hay otro sub-departamento en este departamento."
                    etiqueta="Elegir"
                    onElegir={id => { pedirReasignar(reasignando, id); return true; }}
                    onCerrar={() => setReasignando(null)}
                />
            )}
        </>
    );
};

export default DetalleSubdepartamento;
