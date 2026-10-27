import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, LayoutGrid, Settings, Users, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getDepartamento, mensajeDeMotivo, type MotivoAgenda, type PanelDepartamento as Datos } from '../../services/agenda';
import { useAccesoAgenda } from '../../hooks/useAccesoAgenda';
import SinAcceso from '../../components/auth/SinAcceso';
import { ModalConfirmacion, type PedidoConfirmacion } from '../admin/piezasAdmin';
import { IconoDeDepartamento, tinte } from '../admin/departamentos/piezas';
import {
    BOTON_NEGRO, ESTILOS, ID_AGENDA, Mensaje, ProveedorDelPanel, ROTULO, type ContextoDelPanel, type Pestana,
} from './equipo/piezas';
import PestanaSubdepartamentos from './equipo/PestanaSubdepartamentos';
import DetalleSubdepartamento from './equipo/DetalleSubdepartamento';
import PestanaPersonal from './equipo/PestanaPersonal';
import PestanaConfiguracion from './equipo/PestanaConfiguracion';
import PestanaTareas from './tareas/PestanaTareas';

/**
 * /departamentos/:id — el panel de un departamento de Agenda Origen
 * (design-claude/Departamento - Equipo y el encabezado de Departamento -
 * Tareas).
 *
 * Lee agenda_departamento(id) una vez y lo reparte a las pestañas por
 * contexto. Lo que cambia algo vuelve a pedirlo (`recargar`), sin volver al
 * esqueleto.
 *
 * La pestaña vive en la URL (?tab=), y el detalle de un sub-departamento
 * también (&sub=): el botón atrás del navegador recorre las pestañas y sale
 * del detalle. /departamentos/:id/sub/:subId NO se usa acá: es el panel de
 * quien dirige (prompt 6).
 *
 * Quién entra lo decide la base: agenda_departamento contesta sin_permiso a
 * quien no es encargado (ni SUPER_ADMIN) y no_existe si el id no está. El
 * acceso en memoria (useAccesoAgenda) puede estar un paso atrás —recién te
 * sumaron de encargado—; la base no.
 */

/**
 * Las pestañas, en orden. "Tareas" es la primera y la inicial: es lo que un
 * encargado viene a ver. El prompt 5 suma "Solicitudes" agregando una
 * entrada acá y un caso abajo.
 */
const PESTANAS: { id: Pestana; etiqueta: string; Icono: LucideIcon }[] = [
    { id: 'tareas', etiqueta: 'Tareas', Icono: CalendarDays },
    { id: 'subdepartamentos', etiqueta: 'Sub-departamentos', Icono: LayoutGrid },
    { id: 'personal', etiqueta: 'Personal', Icono: Users },
    { id: 'config', etiqueta: 'Configuración', Icono: Settings },
];
/** Los links viejos sin ?tab caen acá. */
const PESTANA_INICIAL: Pestana = 'tareas';

type Carga = { estado: 'cargando' } | { estado: 'error'; motivo: MotivoAgenda } | { estado: 'listo'; datos: Datos };

const Esqueleto: React.FC = () => (
    <div aria-busy="true" aria-label="Cargando el departamento" className="flex flex-col gap-2.5">
        <div className="h-12 rounded-full bg-white motion-safe:animate-[depBrillo_1.2s_infinite]" />
        {[0, 1, 2].map(i => <div key={i} className="h-[72px] rounded-[22px] bg-white motion-safe:animate-[depBrillo_1.2s_infinite]" />)}
    </div>
);

const PanelDepartamento: React.FC = () => {
    const { id = '' } = useParams();
    const [params, setParams] = useSearchParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { acceso } = useAccesoAgenda();
    const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
    const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'error' } | null>(null);
    const [confirmacion, setConfirmacion] = useState<PedidoConfirmacion | null>(null);
    const avisoT = useRef(0);

    const pedida = params.get('tab') as Pestana | null;
    const pestana: Pestana = PESTANAS.some(p => p.id === pedida) ? (pedida as Pestana) : PESTANA_INICIAL;
    const subAbierto = pestana === 'subdepartamentos' ? params.get('sub') : null;

    const avisar = useCallback((texto: string, tipo: 'ok' | 'error' = 'ok') => {
        window.clearTimeout(avisoT.current);
        setAviso({ texto, tipo });
        avisoT.current = window.setTimeout(() => setAviso(null), 3500);
    }, []);

    const cargar = useCallback(async () => {
        setCarga({ estado: 'cargando' });
        const r = await getDepartamento(id);
        setCarga(r.ok ? { estado: 'listo', datos: r } : { estado: 'error', motivo: r.motivo });
    }, [id]);
    useEffect(() => { cargar(); }, [cargar]);

    const recargar = useCallback(async () => {
        const r = await getDepartamento(id);
        if (r.ok) setCarga({ estado: 'listo', datos: r });
        else avisar(`No se pudo actualizar: ${mensajeDeMotivo(r.motivo)}`, 'error');
    }, [id, avisar]);

    // Cada pestaña (y cada detalle) es una entrada del historial: atrás vuelve.
    const ir = useCallback((destino: Pestana, sub?: string | null) => {
        const p = new URLSearchParams(params);
        p.set('tab', destino);
        if (sub) p.set('sub', sub); else if (sub === null || destino !== 'subdepartamentos') p.delete('sub');
        setParams(p);
    }, [params, setParams]);

    // Al cambiar de pestaña o de detalle se arranca desde arriba.
    useEffect(() => { window.scrollTo({ top: 0 }); }, [pestana, subAbierto]);

    const contexto: ContextoDelPanel | null = useMemo(() => carga.estado !== 'listo' ? null : ({
        depId: id,
        datos: carga.datos,
        recargar,
        avisar,
        confirmar: setConfirmacion,
        confirmacionAbierta: !!confirmacion,
        ir,
        miId: user?.id ?? null,
        soySuperAdmin: acceso.superAdmin,
    }), [carga, id, recargar, avisar, confirmacion, ir, user?.id, acceso.superAdmin]);

    if (carga.estado === 'error' && (carga.motivo === 'sin_permiso' || carga.motivo === 'sin_sesion')) {
        return <SinAcceso volverA={{ etiqueta: 'Volver a Departamentos', ruta: '/departamentos' }} />;
    }

    const dep = carga.estado === 'listo' ? carga.datos.departamento : null;
    const subElegido = subAbierto && contexto ? contexto.datos.subdepartamentos.find(s => s.id === subAbierto) : null;

    return (
        <div id={ID_AGENDA} className="min-h-screen bg-[#f6f6f4]">
            <style>{ESTILOS}</style>

            {aviso && (
                <div role="status" className={`fixed left-1/2 top-20 z-[130] max-w-[calc(100%-32px)] -translate-x-1/2 rounded-full px-5 py-3 text-center text-[13.5px] font-semibold shadow-[0_10px_30px_rgba(0,0,0,.18)] ${aviso.tipo === 'ok' ? 'bg-[#0a0a0a] text-white' : 'bg-[#a32218] text-white'}`}>
                    {aviso.texto}
                </div>
            )}

            {/* Encabezado (no <header>: index.css esconde los <header> mientras hay una hoja abierta). */}
            <div className="border-b border-black/[.06] bg-white" style={dep ? { boxShadow: `inset 0 3px 0 ${dep.color}` } : undefined}>
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
                        {dep ? (
                            <>
                                <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full" style={{ background: tinte(dep.color), color: dep.color }}>
                                    <IconoDeDepartamento clave={dep.icono} tam={22} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className={ROTULO}>Departamento</p>
                                    <h1 className="m-0 mt-0.5 truncate text-[24px] font-bold tracking-[-0.02em] md:text-[28px]">{dep.nombre}</h1>
                                </div>
                            </>
                        ) : (
                            <div className="h-12 flex-1 rounded-2xl bg-[#f2f2f0] motion-safe:animate-[depBrillo_1.2s_infinite]" aria-hidden="true" />
                        )}
                    </div>

                    {/* Las pestañas: en el teléfono la fila se desliza sola, la página no. */}
                    <div role="tablist" aria-label="Secciones del departamento" className="ag-fila-pestanas -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
                        {PESTANAS.map(({ id: pid, etiqueta, Icono }) => {
                            const activa = pestana === pid;
                            return (
                                <button
                                    key={pid}
                                    type="button"
                                    role="tab"
                                    aria-selected={activa}
                                    aria-controls="panel-departamento"
                                    onClick={() => ir(pid, null)}
                                    disabled={!dep}
                                    className={`flex h-11 flex-none items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${activa ? 'bg-[#0a0a0a] text-white' : 'bg-[#f2f2f0] text-black/[.66] hover:text-[#0a0a0a]'}`}
                                >
                                    <Icono size={16} strokeWidth={1.9} aria-hidden="true" />
                                    {etiqueta}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div id="panel-departamento" role="tabpanel" className="mx-auto max-w-[1080px] px-4 pb-12 pt-5 md:px-8 md:pt-6">
                {carga.estado === 'cargando' && <Esqueleto />}

                {carga.estado === 'error' && carga.motivo === 'no_existe' && (
                    <Mensaje titulo="Ese departamento no existe o fue eliminado" texto="Puede que lo hayan borrado desde Sistemas, o que el link esté mal copiado.">
                        <button type="button" onClick={() => navigate('/departamentos')} className={`${BOTON_NEGRO} mt-5`}>Volver a Departamentos</button>
                    </Mensaje>
                )}

                {carga.estado === 'error' && carga.motivo !== 'no_existe' && (
                    <Mensaje titulo="No pudimos cargar el departamento" texto="Puede ser la conexión. Probá de nuevo en un momento.">
                        <button type="button" onClick={cargar} className={`${BOTON_NEGRO} mt-5`}>Reintentar</button>
                    </Mensaje>
                )}

                {contexto && (
                    <ProveedorDelPanel value={contexto}>
                        {pestana === 'tareas' && <PestanaTareas />}
                        {pestana === 'subdepartamentos' && !subAbierto && <PestanaSubdepartamentos />}
                        {pestana === 'subdepartamentos' && subAbierto && (subElegido
                            ? <DetalleSubdepartamento key={subElegido.id} sub={subElegido} />
                            : (
                                <Mensaje titulo="Ese sub-departamento no está" texto="Puede que lo hayan archivado o que el link sea viejo.">
                                    <button type="button" onClick={() => ir('subdepartamentos', null)} className={`${BOTON_NEGRO} mt-5`}>Ver los sub-departamentos</button>
                                </Mensaje>
                            ))}
                        {pestana === 'personal' && <PestanaPersonal />}
                        {pestana === 'config' && <PestanaConfiguracion />}
                    </ProveedorDelPanel>
                )}
            </div>

            <ModalConfirmacion pedido={confirmacion} onCerrar={() => setConfirmacion(null)} />
        </div>
    );
};

export default PanelDepartamento;
