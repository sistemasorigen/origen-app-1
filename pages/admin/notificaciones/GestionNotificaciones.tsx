import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import {
    cambiarEstado, eliminarProgramada, getAlertas, mensajeDeMotivo,
    type Alerta, type MotivoNotif,
} from '../../../services/notificaciones';
import { ModalConfirmacion, type PedidoConfirmacion } from '../piezasAdmin';
import { sinAcentos } from '../departamentos/piezas';
import EditorAlerta, { type ModoEditor } from './EditorAlerta';
import { Etiqueta, Perilla, textoProximo } from './piezas';

/**
 * /panel-admin?tab=notificaciones — design-claude/Sistemas - Gestion de
 * notificaciones.dc.html.
 *
 * Qué avisos manda la app, a quién y cuándo. Vive adentro del layout de
 * Administrador.tsx, como Departamentos: la cabecera y la navegación son las
 * de ese layout; esto es el cuerpo.
 *
 * Los textos de alcance, horario y vigencia de las programadas se muestran
 * TAL COMO los arma la base (notif_alertas_admin): acá no se rearman.
 * Después de cada cambio la lista se vuelve a pedir: nada optimista.
 */

/*
 * El buscador vive adentro de una pastilla que dibuja el recuadro. Los campos
 * de #admin-general llevan fondo y borde con !important (index.html); con el
 * id de la sección esta regla les gana, igual que en Departamentos.
 */
const ESTILOS = `
#admin-general #notificaciones-admin input[type="search"] {
  background: transparent !important; border: 0 !important; border-radius: 0 !important;
  box-shadow: none !important; outline: none !important; padding: 0 !important; color: #0a0a0a !important;
}
#notificaciones-admin .notif-pastilla:focus-within { outline: 2px solid #0a0a0a; outline-offset: 2px; }
@keyframes notifFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes notifBrillo { 0% { opacity: .55 } 50% { opacity: 1 } 100% { opacity: .55 } }
`;

type Filtro = 'todas' | 'automatica' | 'programada' | 'pausadas';

type Carga =
    | { estado: 'cargando' }
    | { estado: 'error'; motivo: MotivoNotif }
    | { estado: 'listo'; alertas: Alerta[] };

const COLUMNAS = 'md:grid md:grid-cols-[minmax(0,2.1fr)_minmax(0,1.7fr)_minmax(0,1.15fr)_minmax(0,1fr)_96px] md:gap-5';

const Esqueleto: React.FC = () => (
    <div aria-busy="true" aria-label="Cargando alertas" className="mt-4 overflow-hidden rounded-[26px] bg-white">
        {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className={`flex flex-col gap-2.5 px-5 py-4 ${i ? 'border-t border-black/[.06]' : ''}`}>
                <div className="h-3.5 w-1/2 rounded-lg bg-[#f2f2f0] motion-safe:animate-[notifBrillo_1.2s_infinite]" />
                <div className="h-3 w-1/3 rounded-lg bg-[#f2f2f0] motion-safe:animate-[notifBrillo_1.2s_infinite]" />
            </div>
        ))}
    </div>
);

const Aviso: React.FC<{ titulo: string; texto: string; children?: React.ReactNode }> = ({ titulo, texto, children }) => (
    <div className="mt-4 flex flex-col items-center rounded-[26px] bg-white px-6 py-12 text-center">
        <span className="mb-4 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[#f2f2f0] text-black/[.62]" aria-hidden="true">
            <BellRing size={26} strokeWidth={1.75} />
        </span>
        <p className="m-0 text-[19px] font-bold text-[#0a0a0a]">{titulo}</p>
        <p className="m-0 mt-2 max-w-[400px] text-[14px] font-medium leading-[1.6] text-black/[.62]">{texto}</p>
        {children}
    </div>
);

/** Las tres líneas de "Alcance". Programadas: lo que dice la base. */
const Alcance: React.FC<{ a: Alerta }> = ({ a }) => a.tipo === 'programada' ? (
    <>
        <span className="block text-[13.5px] font-bold leading-[1.4]">{a.alcance}</span>
        {a.horario && <span className="block text-[12.5px] font-semibold leading-[1.4] text-black/[.62]">{a.horario}</span>}
        {a.vigencia && <span className="block text-[12.5px] font-semibold leading-[1.4] text-black/[.55]">{a.vigencia}</span>}
    </>
) : (
    <>
        <span className="block text-[13.5px] font-bold leading-[1.4]">Cuando {a.descripcionEvento || 'pasa el evento'}</span>
        <span className="block text-[12.5px] font-semibold leading-[1.4] text-black/[.62]">
            {a.maxPorDia ? `Hasta ${a.maxPorDia} por día por persona` : 'Sin tope por día'}
        </span>
        {a.noMolestar && a.nmDesde && a.nmHasta && (
            <span className="block text-[12.5px] font-semibold leading-[1.4] text-black/[.55]">No molestar de {a.nmDesde} a {a.nmHasta}</span>
        )}
    </>
);

/** "N la apagaron": sólo si alguien la apagó en sus preferencias. */
const Apagaron: React.FC<{ a: Alerta }> = ({ a }) => (a.apagadaPor > 0 ? (
    <span className="mt-0.5 block text-[12px] font-semibold text-black/[.55]">
        {a.apagadaPor} la {a.apagadaPor === 1 ? 'apagó' : 'apagaron'}
    </span>
) : null);

/** "Personas": cuántas (programadas) o a quién le llega (automáticas). */
const Personas: React.FC<{ a: Alerta }> = ({ a }) => a.tipo === 'programada' ? (
    <>
        <span className="block text-[15px] font-bold tabular-nums leading-[1.3]">
            {a.audienciaPersonas ?? '—'} <span className="text-[12.5px] font-semibold text-black/[.55]">{a.audienciaPersonas === 1 ? 'persona' : 'personas'}</span>
        </span>
        <span className="block text-[12px] font-semibold text-black/[.55]">{a.audienciaConPush ?? 0} con el push activado</span>
        <Apagaron a={a} />
    </>
) : (
    <>
        <span className="block text-[13px] font-semibold leading-[1.45] text-black/[.72]">{a.destinatarioTexto}</span>
        <Apagaron a={a} />
    </>
);

const GestionNotificaciones: React.FC<{
    avisar: (texto: string, tipo?: 'ok' | 'error') => void;
}> = ({ avisar }) => {
    const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
    const [q, setQ] = useState('');
    const [filtro, setFiltro] = useState<Filtro>('todas');
    const [editor, setEditor] = useState<ModoEditor | null>(null);
    const [confirmacion, setConfirmacion] = useState<PedidoConfirmacion | null>(null);
    const [cambiando, setCambiando] = useState<string | null>(null);

    const cargar = useCallback(async (silencioso = false) => {
        if (!silencioso) setCarga({ estado: 'cargando' });
        const r = await getAlertas();
        setCarga(r.ok ? { estado: 'listo', alertas: r.alertas } : { estado: 'error', motivo: r.motivo });
    }, []);
    useEffect(() => { cargar(); }, [cargar]);

    // Las programadas primero: son las que crea Sistemas.
    const todas = useMemo(() => {
        const l = carga.estado === 'listo' ? carga.alertas : [];
        return [...l].sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'programada' ? -1 : 1));
    }, [carga]);

    const n = {
        activas: todas.filter(a => a.activa).length,
        pausadas: todas.filter(a => !a.activa).length,
        programadas: todas.filter(a => a.tipo === 'programada').length,
        automaticas: todas.filter(a => a.tipo === 'automatica').length,
    };

    const filtradas = useMemo(() => {
        const k = sinAcentos(q);
        return todas.filter(a =>
            (filtro === 'todas' || (filtro === 'pausadas' ? !a.activa : a.tipo === filtro))
            && (!k || sinAcentos(a.nombre).includes(k)));
    }, [todas, filtro, q]);

    // ── Pausar / activar ────────────────────────────────────────────────
    const alternar = async (a: Alerta) => {
        if (cambiando) return;
        setCambiando(a.id);
        const r = await cambiarEstado(a.id, !a.activa);
        if (r.ok) avisar(a.activa ? 'Alerta pausada' : 'Alerta activada');
        else avisar(mensajeDeMotivo(r), 'error');
        await cargar(true);
        setCambiando(null);
    };

    // ── Eliminar (sólo programadas) ─────────────────────────────────────
    const pedirBorrado = (a: Alerta) => {
        const p = a.audienciaPersonas ?? 0;
        setConfirmacion({
            tipo: 'destructivo',
            titulo: `¿Eliminar «${a.nombre}»?`,
            texto: `Deja de enviarse a ${p === 1 ? 'la persona que la recibe' : `las ${p} personas que la reciben`}. Las notificaciones que ya llegaron no se borran de sus teléfonos. Esto no se puede deshacer.`,
            etiquetaBoton: 'Eliminar',
            secundaria: a.activa ? { etiqueta: 'Pausar en vez de eliminar', onClick: () => alternar(a) } : undefined,
            onConfirmar: async () => {
                const r = await eliminarProgramada(a.id);
                if (r.ok) avisar(`Se eliminó «${a.nombre}».`);
                else avisar(mensajeDeMotivo(r), 'error');
                cargar(true);
            },
        });
    };

    const pedirDescarte = () => setConfirmacion({
        tipo: 'destructivo',
        rotulo: 'Cambios sin guardar',
        titulo: '¿Descartar los cambios?',
        texto: 'Lo que cambiaste en esta notificación se pierde.',
        etiquetaBoton: 'Descartar',
        onConfirmar: () => setEditor(null),
    });

    const alGuardar = (creada: boolean) => {
        setEditor(null);
        avisar(creada ? 'Notificación creada' : 'Cambios guardados');
        cargar(true);
    };

    // ── Piezas de cada fila ─────────────────────────────────────────────
    const interruptor = (a: Alerta) => (
        <button
            type="button"
            role="switch"
            aria-checked={a.activa}
            aria-label={`${a.activa ? 'Pausar' : 'Activar'} «${a.nombre}»`}
            onClick={() => alternar(a)}
            disabled={cambiando === a.id}
            className="flex h-8 items-center gap-2 rounded-full pr-1 text-[12.5px] font-bold text-black/[.66] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 disabled:opacity-50"
        >
            <Perilla on={a.activa} chico />
            {a.activa ? 'Activa' : 'Pausada'}
        </button>
    );

    const acciones = (a: Alerta) => (
        <div className="flex items-center justify-end gap-1.5">
            <button
                type="button"
                onClick={() => setEditor({ tipo: 'editar', alerta: a })}
                aria-label={`Editar «${a.nombre}»`}
                title="Editar"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f2f2f0] text-black/70 hover:text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
            >
                <Pencil size={16} strokeWidth={2} aria-hidden="true" />
            </button>
            {a.tipo === 'programada' && (
                <button
                    type="button"
                    onClick={() => pedirBorrado(a)}
                    aria-label={`Eliminar «${a.nombre}»`}
                    title="Eliminar"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f2f2f0] text-[#b42318] hover:bg-[#fdecea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b42318] focus-visible:ring-offset-2"
                >
                    <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
                </button>
            )}
        </div>
    );

    const proximo = (a: Alerta) => {
        const t = textoProximo(a);
        const conFecha = a.tipo === 'programada' && a.activa && !!a.proximoEnvio;
        return <span className={`block text-[13.5px] leading-[1.4] ${conFecha ? 'font-bold text-[#0a0a0a]' : 'font-semibold text-black/[.55]'}`}>{t}</span>;
    };

    const sinPermiso = carga.estado === 'error' && carga.motivo === 'sin_permiso';

    return (
        <section id="notificaciones-admin" aria-label="Gestión de notificaciones" className="font-[Manrope,system-ui,sans-serif] text-[#0a0a0a]">
            <style>{ESTILOS}</style>

            {sinPermiso ? (
                <Aviso titulo="No tenés permiso" texto="Las notificaciones de la app las administra Sistemas." />
            ) : (
                <>
                    {/* Contadores */}
                    <div className="grid grid-cols-3 gap-2.5">
                        {([['Activas', n.activas], ['Pausadas', n.pausadas], ['Programadas', n.programadas]] as const).map(([t, c]) => (
                            <div key={t} className="flex flex-col gap-1 rounded-[22px] bg-white px-4 py-3.5 md:px-5 md:py-4">
                                <span className="text-[12.5px] font-bold text-black/[.58]">{t}</span>
                                <span className="text-[26px] font-bold leading-none tabular-nums tracking-[-0.02em] md:text-[30px]">
                                    {carga.estado === 'listo' ? c : '–'}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Buscar, filtrar y crear */}
                    <div className="mt-3 flex flex-wrap items-center gap-2.5">
                        <label className="notif-pastilla flex h-12 min-w-[200px] flex-1 items-center gap-2.5 rounded-full bg-white px-4 shadow-[0_1px_2px_rgba(0,0,0,.04)]">
                            <Search size={17} strokeWidth={2} className="flex-none text-black/50" aria-hidden="true" />
                            <input
                                type="search"
                                value={q}
                                onChange={e => setQ(e.target.value)}
                                placeholder="Buscar alerta por nombre"
                                aria-label="Buscar alerta por nombre"
                                className="campo-desnudo min-w-0 flex-1 text-[14.5px] font-semibold"
                            />
                        </label>
                        <button
                            type="button"
                            onClick={() => setEditor({ tipo: 'crear' })}
                            disabled={carga.estado !== 'listo'}
                            className="flex h-12 flex-none items-center gap-2 rounded-full bg-[#0a0a0a] pl-4 pr-5 text-[14.5px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 disabled:opacity-40"
                        >
                            <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
                            Nueva notificación
                        </button>
                    </div>
                    <div role="radiogroup" aria-label="Qué alertas ver" className="mt-2.5 flex max-w-full gap-0.5 overflow-x-auto rounded-full bg-black/[.06] p-1 md:inline-flex">
                        {([
                            ['todas', 'Todas', todas.length], ['automatica', 'Automáticas', n.automaticas],
                            ['programada', 'Programadas', n.programadas], ['pausadas', 'Pausadas', n.pausadas],
                        ] as const).map(([k, t, c]) => (
                            <button
                                key={k}
                                type="button"
                                role="radio"
                                aria-checked={filtro === k}
                                onClick={() => setFiltro(k)}
                                className={`flex h-10 flex-none items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] ${filtro === k ? 'bg-white text-[#0a0a0a] shadow-[0_1px_2px_rgba(0,0,0,.08)]' : 'text-black/[.6] hover:text-[#0a0a0a]'}`}
                            >
                                {t}
                                {carga.estado === 'listo' && <span className="text-[11.5px] font-bold text-black/45">{c}</span>}
                            </button>
                        ))}
                    </div>

                    {carga.estado === 'cargando' && <Esqueleto />}

                    {carga.estado === 'error' && (
                        <Aviso titulo="No pudimos cargar las alertas" texto={mensajeDeMotivo({ motivo: carga.motivo })}>
                            <button
                                type="button"
                                onClick={() => cargar()}
                                className="mt-[18px] h-12 rounded-full bg-[#0a0a0a] px-[22px] text-[14.5px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                            >
                                Reintentar
                            </button>
                        </Aviso>
                    )}

                    {carga.estado === 'listo' && filtradas.length === 0 && (
                        q.trim() || filtro === 'pausadas' || filtro === 'automatica'
                            ? (
                                <Aviso titulo="No hay alertas con ese filtro" texto="Probá con otra palabra o sacá los filtros.">
                                    <button
                                        type="button"
                                        onClick={() => { setQ(''); setFiltro('todas'); }}
                                        className="mt-[18px] h-12 rounded-full bg-[#f2f2f0] px-[22px] text-[14.5px] font-bold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                    >
                                        Limpiar filtros
                                    </button>
                                </Aviso>
                            )
                            : <Aviso titulo="Todavía no hay alertas programadas" texto="Creá una para recordarle algo a toda la iglesia o a un equipo, cada los días que elijas." />
                    )}

                    {carga.estado === 'listo' && filtradas.length > 0 && (
                        <>
                            {/* Compu: tabla */}
                            <div role="table" aria-label="Alertas" className="mt-4 hidden overflow-hidden rounded-[26px] bg-white md:block">
                                <div role="row" className={`${COLUMNAS} border-b border-black/[.06] px-5 py-3`}>
                                    {['Nombre', 'Alcance', 'Personas', 'Próximo envío'].map(t => (
                                        <span key={t} role="columnheader" className="text-[12px] font-bold text-black/[.55]">{t}</span>
                                    ))}
                                    <span role="columnheader" className="text-right text-[12px] font-bold text-black/[.55]">Acciones</span>
                                </div>
                                {filtradas.map((a, i) => (
                                    <div key={a.id} role="row" className={`${COLUMNAS} items-start px-5 py-4 ${i ? 'border-t border-black/[.06]' : ''} ${a.activa ? '' : 'bg-[#fbfbfa]'}`}>
                                        <div role="cell" className="min-w-0">
                                            <span className={`block text-[14.5px] font-bold leading-[1.35] ${a.activa ? '' : 'text-black/[.6]'}`}>{a.nombre}</span>
                                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                                <Etiqueta>{a.tipo === 'programada' ? 'Programada' : 'Automática'}</Etiqueta>
                                                {interruptor(a)}
                                            </div>
                                        </div>
                                        <div role="cell" className="min-w-0"><Alcance a={a} /></div>
                                        <div role="cell" className="min-w-0"><Personas a={a} /></div>
                                        <div role="cell" className="min-w-0">{proximo(a)}</div>
                                        <div role="cell">{acciones(a)}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Teléfono: tarjetas */}
                            <div className="mt-4 flex flex-col gap-2.5 md:hidden">
                                {filtradas.map(a => (
                                    <article key={a.id} className={`flex flex-col gap-3 rounded-[24px] bg-white p-[18px] ${a.activa ? '' : 'opacity-[.92]'}`}>
                                        <div className="flex items-start gap-2">
                                            <div className="min-w-0 flex-1">
                                                <span className={`block text-[15.5px] font-bold leading-[1.35] ${a.activa ? '' : 'text-black/[.6]'}`}>{a.nombre}</span>
                                                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                                    <Etiqueta>{a.tipo === 'programada' ? 'Programada' : 'Automática'}</Etiqueta>
                                                    {interruptor(a)}
                                                </div>
                                            </div>
                                            {acciones(a)}
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-3 gap-y-3 border-t border-black/[.06] pt-3">
                                            <div className="col-span-2 min-w-0">
                                                <span className="mb-1 block text-[12px] font-bold text-black/[.5]">Alcance</span>
                                                <Alcance a={a} />
                                            </div>
                                            <div className="min-w-0">
                                                <span className="mb-1 block text-[12px] font-bold text-black/[.5]">Personas</span>
                                                <Personas a={a} />
                                            </div>
                                            <div className="min-w-0">
                                                <span className="mb-1 block text-[12px] font-bold text-black/[.5]">Próximo envío</span>
                                                {proximo(a)}
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}

            {editor && (
                <EditorAlerta
                    key={editor.tipo === 'editar' ? editor.alerta.id : 'nueva'}
                    modo={editor}
                    onCerrar={() => setEditor(null)}
                    onGuardado={alGuardar}
                    onDescartar={pedirDescarte}
                    confirmacionAbierta={!!confirmacion}
                />
            )}

            <ModalConfirmacion pedido={confirmacion} onCerrar={() => setConfirmacion(null)} />
        </section>
    );
};

export default GestionNotificaciones;
