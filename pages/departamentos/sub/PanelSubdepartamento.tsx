import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Archive, ArrowLeft, CalendarDays, Home, Settings2, Users } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useAccesoAgenda } from '../../../hooks/useAccesoAgenda';
import {
    getSubdepartamento, mensajeDeMotivo,
    type MotivoAgenda, type PanelSubdepartamento as Datos,
} from '../../../services/agenda';
import SinAcceso from '../../../components/auth/SinAcceso';
import DetalleTarea from '../../../components/agenda/DetalleTarea';
import type { AccionesDeAgenda } from '../../../components/agenda/contratos';
import { ModalConfirmacion, type PedidoConfirmacion } from '../../admin/piezasAdmin';
import { BOTON_CHICO, BOTON_NEGRO, ESTILOS, ID_AGENDA, Mensaje, ROTULO } from '../equipo/piezas';
import NavegacionDeSecciones, { type Seccion } from '../NavegacionDeSecciones';
import PestanaInicioSub from './PestanaInicioSub';
import PestanaTareasSub from './PestanaTareasSub';
import PestanaEquipoSub from './PestanaEquipoSub';

/**
 * /departamentos/:id/sub/:subId — el panel de quien dirige un
 * sub-departamento (design-claude/Sub-departamento - Panel).
 *
 * QUIÉN ENTRA LO DECIDE LA BASE, como en el panel del departamento.
 * agenda_subdepartamento contesta sin_permiso a quien no dirige este sub ni
 * es encargado del departamento, no_existe si el id no está y archivado si
 * ya no es un equipo. El acceso en memoria (useAccesoAgenda) puede estar un
 * paso atrás —recién te pusieron a dirigirlo—; la base no.
 *
 * El :id de la URL es informativo: el departamento de verdad sale del sub. Si
 * no coinciden —un link viejo, un copiar y pegar a medias— se corrige la URL
 * con replace, para que compartirla vuelva a funcionar.
 *
 * Un ENCARGADO también puede entrar: ve lo mismo, más un link para ir a
 * administrarlo en el panel del departamento, que es donde están las
 * acciones que acá no van.
 */

type SeccionSub = 'inicio' | 'tareas' | 'equipo';

const SECCIONES: Seccion<SeccionSub>[] = [
    { id: 'inicio', etiqueta: 'Inicio', descripcion: 'Resumen y tareas asignadas', Icono: Home },
    { id: 'tareas', etiqueta: 'Tareas', descripcion: 'Por día y por carpeta', Icono: CalendarDays },
    { id: 'equipo', etiqueta: 'Equipo', descripcion: 'Tu equipo y a quién recurrir', Icono: Users },
];
const SECCION_INICIAL: SeccionSub = 'inicio';

type Carga = { estado: 'cargando' } | { estado: 'error'; motivo: MotivoAgenda } | { estado: 'listo'; datos: Datos };

const Esqueleto: React.FC = () => (
    <div aria-busy="true" aria-label="Cargando el sub-departamento" className="flex flex-col gap-2.5">
        <div className="grid grid-cols-3 gap-2.5">
            {[0, 1, 2].map(i => <div key={i} className="h-24 rounded-[24px] bg-white motion-safe:animate-[depBrillo_1.2s_infinite]" />)}
        </div>
        <div className="h-[110px] rounded-[22px] bg-white motion-safe:animate-[depBrillo_1.2s_.2s_infinite]" />
        <div className="h-[110px] rounded-[22px] bg-white motion-safe:animate-[depBrillo_1.2s_.3s_infinite]" />
    </div>
);

const PanelSubdepartamento: React.FC = () => {
    const { id = '', subId = '' } = useParams();
    const [params, setParams] = useSearchParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { esEncargadoDe } = useAccesoAgenda();

    const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
    const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'error' } | null>(null);
    const [confirmacion, setConfirmacion] = useState<PedidoConfirmacion | null>(null);
    const [tareaAbierta, setTareaAbierta] = useState<string | null>(null);
    /** Sube cada vez que algo cambió: las pestañas se enteran y recargan. */
    const [version, setVersion] = useState(0);
    const avisoT = useRef(0);

    const pedida = params.get('tab') as SeccionSub | null;
    const seccion: SeccionSub = SECCIONES.some(s => s.id === pedida) ? (pedida as SeccionSub) : SECCION_INICIAL;

    const avisar = useCallback((texto: string, tipo: 'ok' | 'error' = 'ok') => {
        window.clearTimeout(avisoT.current);
        setAviso({ texto, tipo });
        avisoT.current = window.setTimeout(() => setAviso(null), 3500);
    }, []);

    const acciones = useMemo<AccionesDeAgenda>(() => ({ confirmar: setConfirmacion, avisar }), [avisar]);

    const cargar = useCallback(async () => {
        setCarga({ estado: 'cargando' });
        const r = await getSubdepartamento(subId);
        setCarga(r.ok ? { estado: 'listo', datos: r } : { estado: 'error', motivo: r.motivo });
    }, [subId]);
    useEffect(() => { cargar(); }, [cargar]);

    /** Vuelve a pedir los contadores, sin volver al esqueleto. */
    const recargar = useCallback(async () => {
        const r = await getSubdepartamento(subId);
        if (r.ok) setCarga({ estado: 'listo', datos: r });
        else avisar(`No se pudo actualizar: ${mensajeDeMotivo(r.motivo)}`, 'error');
    }, [subId, avisar]);

    const datos = carga.estado === 'listo' ? carga.datos : null;
    const depId = datos?.departamento.id ?? id;

    // El :id de la URL no manda: si no es el departamento del sub, se corrige.
    useEffect(() => {
        if (!datos || datos.departamento.id === id) return;
        const query = params.toString();
        navigate(`/departamentos/${datos.departamento.id}/sub/${subId}${query ? `?${query}` : ''}`, { replace: true });
    }, [datos, id, subId, params, navigate]);

    const ir = useCallback((destino: SeccionSub) => {
        const p = new URLSearchParams(params);
        p.set('tab', destino);
        setParams(p);
    }, [params, setParams]);

    // Al cambiar de sección se arranca desde arriba.
    useEffect(() => { window.scrollTo({ top: 0 }); }, [seccion]);

    const alCambiar = useCallback(async () => {
        setVersion(v => v + 1);
        await recargar();
    }, [recargar]);

    if (carga.estado === 'error' && (carga.motivo === 'sin_permiso' || carga.motivo === 'sin_sesion')) {
        return <SinAcceso volverA={{ etiqueta: 'Volver a Departamentos', ruta: '/departamentos' }} />;
    }

    const sub = datos?.subdepartamento ?? null;
    const soyEncargado = esEncargadoDe(depId);

    return (
        <div id={ID_AGENDA} className="min-h-screen bg-[#f6f6f4]">
            <style>{ESTILOS}</style>

            {aviso && (
                <div role="status" className={`fixed left-1/2 top-20 z-[130] max-w-[calc(100%-32px)] -translate-x-1/2 rounded-full px-5 py-3 text-center text-[13.5px] font-semibold shadow-[0_10px_30px_rgba(0,0,0,.18)] ${aviso.tipo === 'ok' ? 'bg-[#0a0a0a] text-white' : 'bg-[#a32218] text-white'}`}>
                    {aviso.texto}
                </div>
            )}

            {/* Encabezado (no <header>: index.css esconde los <header> mientras hay una hoja abierta). */}
            <div className="border-b border-black/[.06] bg-white" style={sub ? { boxShadow: `inset 0 3px 0 ${sub.color}` } : undefined}>
                <div className="mx-auto max-w-[1080px] px-4 pb-0 pt-5 md:px-8 md:pt-6">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => navigate('/departamentos')}
                            aria-label="Volver a Departamentos"
                            className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#f2f2f0] text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                        >
                            <ArrowLeft size={18} strokeWidth={2.2} aria-hidden="true" />
                        </button>
                        {sub && datos ? (
                            <>
                                <span
                                    aria-hidden="true"
                                    className="h-11 w-2 flex-none rounded-full"
                                    style={{ background: sub.color }}
                                />
                                <div className="min-w-0 flex-1">
                                    <p className={ROTULO}>
                                        Sub-departamento ·{' '}
                                        <span style={{ color: datos.departamento.color }}>{datos.departamento.nombre}</span>
                                    </p>
                                    <h1 className="m-0 mt-0.5 truncate text-[22px] font-bold tracking-[-0.02em] md:text-[26px]">{sub.nombre}</h1>
                                </div>
                                {soyEncargado && (
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/departamentos/${depId}?tab=subdepartamentos&sub=${subId}`)}
                                        className={`${BOTON_CHICO} hidden md:flex`}
                                    >
                                        <Settings2 size={15} strokeWidth={2} aria-hidden="true" />
                                        Administrar en el departamento
                                    </button>
                                )}
                            </>
                        ) : (
                            <div className="h-12 flex-1 rounded-2xl bg-[#f2f2f0] motion-safe:animate-[depBrillo_1.2s_infinite]" aria-hidden="true" />
                        )}
                    </div>

                    {soyEncargado && datos && (
                        <button
                            type="button"
                            onClick={() => navigate(`/departamentos/${depId}?tab=subdepartamentos&sub=${subId}`)}
                            className={`${BOTON_CHICO} mt-3 w-full md:hidden`}
                        >
                            <Settings2 size={15} strokeWidth={2} aria-hidden="true" />
                            Administrar en el departamento
                        </button>
                    )}

                    <NavegacionDeSecciones
                        secciones={SECCIONES}
                        actual={seccion}
                        onIr={ir}
                        titulo="Secciones"
                        idDelPanel="panel-sub"
                        deshabilitado={!datos}
                    />
                </div>
            </div>

            <div id="panel-sub" role="tabpanel" className="mx-auto max-w-[1080px] px-4 pb-12 pt-5 md:px-8 md:pt-6">
                {carga.estado === 'cargando' && <Esqueleto />}

                {carga.estado === 'error' && carga.motivo === 'no_existe' && (
                    <Mensaje titulo="Ese sub-departamento no existe" texto="Puede que lo hayan borrado, o que el link esté mal copiado.">
                        <button type="button" onClick={() => navigate('/departamentos')} className={`${BOTON_NEGRO} mt-5`}>Volver a Departamentos</button>
                    </Mensaje>
                )}

                {carga.estado === 'error' && carga.motivo === 'archivado' && (
                    <Mensaje
                        icono={<Archive size={26} strokeWidth={1.75} />}
                        titulo="Este sub-departamento fue archivado"
                        texto="Ya no recibe tareas y su equipo dejó de verlo. Las tareas que había quedaron como historial en el departamento."
                    >
                        <button type="button" onClick={() => navigate('/departamentos')} className={`${BOTON_NEGRO} mt-5`}>Volver a Departamentos</button>
                    </Mensaje>
                )}

                {carga.estado === 'error' && !['no_existe', 'archivado'].includes(carga.motivo) && (
                    <Mensaje titulo="No pudimos cargar el sub-departamento" texto="Puede ser la conexión. Probá de nuevo en un momento.">
                        <button type="button" onClick={cargar} className={`${BOTON_NEGRO} mt-5`}>Reintentar</button>
                    </Mensaje>
                )}

                {datos && seccion === 'inicio' && (
                    <PestanaInicioSub
                        subId={subId}
                        datos={datos}
                        acciones={acciones}
                        onCambio={alCambiar}
                        onAbrirTarea={setTareaAbierta}
                        version={version}
                        miNombre={user?.name ?? null}
                    />
                )}
                {datos && seccion === 'tareas' && (
                    <PestanaTareasSub
                        subId={subId}
                        datos={datos}
                        onAbrirTarea={setTareaAbierta}
                        avisar={avisar}
                        version={version}
                    />
                )}
                {datos && seccion === 'equipo' && <PestanaEquipoSub datos={datos} />}
            </div>

            {/* Sin `edicion`: acá no se edita ni se reasigna, sólo se cambia el estado. */}
            {tareaAbierta && (
                <DetalleTarea
                    key={tareaAbierta}
                    tareaId={tareaAbierta}
                    acciones={acciones}
                    onCerrar={() => setTareaAbierta(null)}
                    onCambio={alCambiar}
                />
            )}

            <ModalConfirmacion pedido={confirmacion} onCerrar={() => setConfirmacion(null)} />
        </div>
    );
};

export default PanelSubdepartamento;
