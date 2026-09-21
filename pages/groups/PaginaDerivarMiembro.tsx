import React, { useState, useEffect, useCallback } from 'react';
import { dondeSeReune } from '../../src/utils/modalidad';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Group, GroupRegistration } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { Loader2, Search } from 'lucide-react';
import { T, btnPrimario, rotulo, Encabezado, Pasos, HojaConfirmacion, Vacio } from '../../components/GCX/patron';

const iniciales = (n?: string, a?: string) =>
    (((n || '').trim()[0] || '') + ((a || '').trim()[0] || '')).toUpperCase() || '?';

const PaginaDerivarMiembro: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();

    const [group, setGroup] = useState<Group | null>(null);
    const [destinos, setDestinos] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);

    const [paso, setPaso] = useState<1 | 2>(1);
    const [selectedRegistrationId, setSelectedRegistrationId] = useState('');
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [busqueda, setBusqueda] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [confirmando, setConfirmando] = useState(false);

    // getGroupsByHost trae los grupos donde el usuario es host O co-host.
    // Si el grupo de la URL no está en esa lista, no es suyo: se va.
    const fetchDatos = useCallback(async () => {
        if (!currentUser || !groupId) return;
        setLoading(true);
        try {
            const [propios, todos] = await Promise.all([
                supabaseService.getGroupsByHost(currentUser.id),
                supabaseService.getGroups()
            ]);
            const found = propios.find(g => g.id === groupId);
            if (!found) {
                navigate('/mis-grupos', { replace: true });
                return;
            }
            setGroup(found);
            setDestinos(todos.filter(g => g.id !== groupId));
        } finally {
            setLoading(false);
        }
    }, [currentUser, groupId, navigate]);

    useEffect(() => { fetchDatos(); }, [fetchDatos]);

    const hoy = new Date().toISOString().split('T')[0];
    const isFinished = !!group && !!(group.endDate && group.endDate < hoy);

    const approvedMembers = (group?.registrations || []).filter(
        (r: GroupRegistration) => r.status === 'APPROVED'
    );
    const elegido = approvedMembers.find(m => m.id === selectedRegistrationId);
    const destino = destinos.find(g => g.id === selectedGroupId);

    // La inscripción de pareja se trata como una sola unidad: la RPC copia
    // partner_data, así que los dos se mudan juntos. Se muestra como una
    // fila con dos avatares, no como dos personas separadas.
    const pareja = elegido?.partnerData;
    const nombreElegido = elegido
        ? (pareja
            ? `${elegido.firstName} y ${pareja.firstName || 'su pareja'}`
            : `${elegido.firstName} ${elegido.lastName}`)
        : '';
    const personasElegidas = pareja ? 2 : 1;

    const destinosFiltrados = destinos.filter(g => {
        if (!busqueda.trim()) return true;
        const t = busqueda.toLowerCase();
        return g.name.toLowerCase().includes(t)
            || `${g.leaderName || ''} ${g.leaderSurname || ''}`.toLowerCase().includes(t)
            || (g.location || '').toLowerCase().includes(t);
    });

    const volver = () => {
        if (paso === 2) { setPaso(1); setSubmitError(null); return; }
        navigate(`/mis-grupos/${groupId}`);
    };

    const enviar = async () => {
        if (!group) return;
        setIsSubmitting(true);
        // Toda la validación vive en la RPC: con el RLS actual el anfitrión de
        // origen no ve las inscripciones del destino, así que un chequeo desde
        // acá daría un falso negativo. El error que devuelve ya está redactado
        // para el usuario, así que se muestra tal cual.
        const res = await supabaseService.derivarMiembro(selectedRegistrationId, selectedGroupId);
        setIsSubmitting(false);
        if (res.ok) { navigate(`/mis-grupos/${groupId}`); return; }
        setConfirmando(false);
        setSubmitError(res.error || 'No pudimos completar la derivación.');
    };

    if (loading) return (
        <div className={`min-h-screen flex items-center justify-center ${T.fondo}`}>
            <Loader2 className="w-8 h-8 animate-spin text-black/20 dark:text-white/20" />
        </div>
    );
    if (!group) return null;

    // ── Piezas compartidas entre mobile y desktop ──

    const ListaPersonas = (
        <div className="bg-white dark:bg-[#1b1b1a] rounded-[26px] overflow-hidden">
            {approvedMembers.map((m, i) => {
                const esteElegido = selectedRegistrationId === m.id;
                const p = m.partnerData;
                return (
                    <React.Fragment key={m.id}>
                        {i > 0 && <div className="h-px bg-black/[.06] dark:bg-white/[.08] mx-4" />}
                        <div className={esteElegido && p ? 'pb-3.5' : ''}>
                            <button
                                type="button"
                                onClick={() => { setSelectedRegistrationId(m.id); setSubmitError(null); }}
                                aria-pressed={esteElegido}
                                className="w-full flex items-center gap-3.5 h-[70px] px-4 transition-colors hover:bg-black/[.02] dark:hover:bg-white/[.03]"
                            >
                                {p ? (
                                    <div className="flex shrink-0 w-[72px]">
                                        <div className={`w-[42px] h-[42px] rounded-full ${T.chip} flex items-center justify-center text-[13px] font-semibold text-black/60 dark:text-white/60`}>
                                            {iniciales(m.firstName, m.lastName)}
                                        </div>
                                        <div className="w-[42px] h-[42px] -ml-3 rounded-full bg-[#e8e8e5] dark:bg-[#333331] ring-[3px] ring-white dark:ring-[#1b1b1a] flex items-center justify-center text-[13px] font-semibold text-black/60 dark:text-white/60">
                                            {iniciales(p.firstName, p.lastName)}
                                        </div>
                                    </div>
                                ) : (
                                    <div className={`w-11 h-11 shrink-0 rounded-full ${T.chip} flex items-center justify-center text-[14px] font-semibold text-black/60 dark:text-white/60`}>
                                        {iniciales(m.firstName, m.lastName)}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0 text-left">
                                    <p className="text-[15.5px] font-semibold truncate">
                                        {p ? `${m.firstName} y ${p.firstName || 'su pareja'}` : `${m.firstName} ${m.lastName}`}
                                    </p>
                                    {p && <p className="mt-0.5 text-[12.5px] font-medium text-black/45 dark:text-white/45">Pareja · 1 inscripción</p>}
                                </div>
                                <span className={`w-[26px] h-[26px] shrink-0 rounded-full flex items-center justify-center transition-colors ${esteElegido ? 'bg-[#0a0a0a] dark:bg-white' : 'bg-[#eeeeeb] dark:bg-[#2a2a28]'}`}>
                                    {esteElegido && (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white dark:text-black" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 6.5" /></svg>
                                    )}
                                </span>
                            </button>

                            {/* El aviso va pegado a SU fila, no al final: se decide
                                sabiendo que se van los dos. */}
                            {esteElegido && p && (
                                <div className="mx-4 bg-[#0a0a0a] dark:bg-white rounded-[18px] px-4 py-3.5">
                                    <p className="text-[13px] leading-[1.55] font-medium text-white dark:text-black">
                                        Están inscriptos juntos: <span className="font-semibold">los dos se derivan al mismo grupo</span>. No se puede mandar a uno solo.
                                    </p>
                                </div>
                            )}
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
    );

    const AvisoEspera = (
        <div className="bg-[#0a0a0a] dark:bg-white rounded-[20px] px-[18px] py-[15px]">
            <p className="text-[13px] leading-[1.55] font-medium text-white dark:text-black">
                Hasta que el otro anfitrión acepte, <span className="font-semibold">la persona sigue en tu grupo</span>.
            </p>
        </div>
    );

    const Buscador = (
        <div className="h-[56px] rounded-full bg-white dark:bg-[#1b1b1a] flex items-center gap-3 px-5">
            <Search className="w-[18px] h-[18px] shrink-0 text-black/40 dark:text-white/40" strokeWidth={2.2} />
            <input
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar un grupo"
                className="flex-1 min-w-0 bg-transparent outline-none text-[15.5px] font-medium placeholder:text-black/35 dark:placeholder:text-white/35"
                style={{ background: 'transparent', border: 0, borderRadius: 0 }}
            />
        </div>
    );

    const ListaGrupos = (
        <div className="flex flex-col gap-2.5">
            {destinosFiltrados.length === 0 && (
                <p className="text-[14.5px] font-medium text-black/50 dark:text-white/50 text-center py-8">
                    No encontramos grupos con esa búsqueda.
                </p>
            )}
            {destinosFiltrados.map(g => {
                const libres = (g.maxCapacity || 0) - (g.membersCount || 0);
                const lleno = libres <= 0;
                const puesto = selectedGroupId === g.id;
                return (
                    <button
                        key={g.id}
                        type="button"
                        onClick={() => { setSelectedGroupId(g.id); setSubmitError(null); setConfirmando(true); }}
                        className={`w-full text-left rounded-[24px] p-[18px] transition-transform hover:-translate-y-0.5 ${lleno
                            ? 'bg-[#f0f0ed] dark:bg-[#232322]'
                            : 'bg-white dark:bg-[#1b1b1a]'} ${puesto ? 'ring-2 ring-[#0a0a0a] dark:ring-white' : ''}`}
                    >
                        <div className="flex items-baseline justify-between gap-3">
                            <p className={`text-[16.5px] font-semibold truncate ${lleno ? 'text-black/55 dark:text-white/55' : ''}`}>{g.name}</p>
                            {lleno ? (
                                <span className="h-[26px] shrink-0 px-[11px] rounded-full bg-[#0a0a0a] dark:bg-white text-white dark:text-black text-[12px] font-semibold flex items-center whitespace-nowrap">Lleno</span>
                            ) : (
                                <span className="shrink-0 text-[13px] font-semibold text-black/50 dark:text-white/50 whitespace-nowrap">
                                    {libres} {libres === 1 ? 'lugar' : 'lugares'}
                                </span>
                            )}
                        </div>
                        <p className={`mt-2 text-[13.5px] leading-[1.6] font-medium ${lleno ? 'text-black/45 dark:text-white/45' : 'text-black/55 dark:text-white/55'}`}>
                            {g.leaderName} {g.leaderSurname} · {g.meetingDay} {g.meetingTime}
                            <br />
                            {dondeSeReune(g, 'Sin ubicación')}
                        </p>
                        {lleno && (
                            <p className="mt-2.5 text-[12.5px] font-medium text-black/45 dark:text-white/45">
                                Podés derivar igual: queda en lista de espera.
                            </p>
                        )}
                    </button>
                );
            })}
        </div>
    );

    const subtitulo = paso === 2 && elegido
        ? `${nombreElegido} · ${personasElegidas} ${personasElegidas === 1 ? 'persona' : 'personas'}`
        : group.name;

    return (
        <div id="gcx-accion" className={`min-h-screen ${T.fondo} ${T.fuente} ${T.tinta}`}>

            {/* Encabezado + indicador de pasos, sobre blanco y curvado abajo */}
            <div className="bg-white dark:bg-[#1b1b1a] rounded-b-[28px] px-5 pt-4 pb-5 lg:rounded-none lg:px-8 lg:py-[18px]">
                <div className="max-w-[1000px] mx-auto">
                    <Encabezado accion="Derivar a otro grupo" grupo={subtitulo} onVolver={volver} />
                    {!isFinished && approvedMembers.length > 0 && (
                        <div className="mt-5 lg:hidden">
                            <Pasos actual={paso} total={2} nombre={paso === 1 ? '¿A quién derivás?' : '¿A qué grupo?'} />
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-[1000px] mx-auto px-4 pt-5 pb-8 lg:px-8 lg:pt-7 lg:pb-9">

                {isFinished ? (
                    <div className="bg-white dark:bg-[#1b1b1a] rounded-[26px]">
                        <Vacio
                            titulo="El grupo ya terminó su temporada"
                            detalle="No se pueden derivar miembros de un grupo finalizado."
                            accion={{ texto: 'Volver al grupo', onClick: () => navigate(`/mis-grupos/${groupId}`) }}
                        />
                    </div>
                ) : approvedMembers.length === 0 ? (
                    <div className="bg-white dark:bg-[#1b1b1a] rounded-[26px]">
                        <Vacio
                            titulo="No hay miembros para derivar"
                            detalle="Cuando alguien se sume al grupo vas a poder derivarlo desde acá."
                            accion={{ texto: 'Volver al grupo', onClick: () => navigate(`/mis-grupos/${groupId}`) }}
                        />
                    </div>
                ) : (
                    <>
                        {/* ── MOBILE: un paso por vez ── */}
                        <div className="lg:hidden">
                            {paso === 1 ? (
                                <>
                                    {ListaPersonas}
                                    <button
                                        type="button"
                                        onClick={() => setPaso(2)}
                                        disabled={!selectedRegistrationId}
                                        className={`${btnPrimario} h-[60px] mt-5`}
                                    >
                                        Elegir el grupo destino
                                    </button>
                                </>
                            ) : (
                                <>
                                    {Buscador}
                                    <div className="mt-3.5">{AvisoEspera}</div>
                                    <p className={`${rotulo} px-1.5 mt-[22px] mb-2.5`}>Grupos disponibles</p>
                                    {ListaGrupos}
                                </>
                            )}
                        </div>

                        {/* ── DESKTOP: los dos pasos conviven, la persona elegida
                             no se pierde de vista al buscar grupo ── */}
                        <div className="hidden lg:grid gap-6 items-start [grid-template-columns:minmax(0,330px)_minmax(0,1fr)]">
                            <div className="bg-white dark:bg-[#1b1b1a] rounded-[28px] p-5 sticky top-7">
                                <p className={`${rotulo} px-1 mb-3`}>¿A quién derivás?</p>
                                <div className="-mx-1">{ListaPersonas}</div>
                            </div>
                            <div>
                                {Buscador}
                                <div className="mt-3.5">{AvisoEspera}</div>
                                <p className={`${rotulo} px-1.5 mt-[22px] mb-2.5`}>Grupos disponibles</p>
                                {ListaGrupos}
                            </div>
                        </div>

                        {submitError && (
                            <p className="mt-5 text-[14px] font-semibold text-center text-[oklch(0.52_0.19_25)]">{submitError}</p>
                        )}
                    </>
                )}
            </div>

            {/* La confirmación resume las tres cosas que importan: quiénes se
                van, a dónde, y qué pasa mientras se espera. Tono neutro: es un
                pedido que el otro anfitrión tiene que aceptar, no algo irreversible. */}
            <HojaConfirmacion
                abierta={confirmando && !!elegido && !!destino}
                tono="neutro"
                titulo={`¿Derivar a ${nombreElegido}?`}
                antes={`Se envía el pedido a ${destino?.leaderName || 'su anfitrión'}. Hasta que lo acepte, `}
                consecuencia={personasElegidas > 1 ? 'los dos siguen en tu grupo' : 'sigue en tu grupo'}
                despues="."
                textoConfirmar="Enviar la derivación"
                onConfirmar={enviar}
                onCancelar={() => { setConfirmando(false); setSelectedGroupId(''); }}
                cargando={isSubmitting}
            >
                <div className={`${T.interna} rounded-[20px] p-4`}>
                    {[
                        ['Se derivan', `${personasElegidas} ${personasElegidas === 1 ? 'persona' : 'personas'}`],
                        ['Grupo destino', destino?.name || ''],
                        ['Anfitrión', `${destino?.leaderName || ''} ${destino?.leaderSurname || ''}`.trim()],
                    ].map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between gap-4 h-[30px]">
                            <span className="text-[13.5px] font-medium text-black/50 dark:text-white/50 shrink-0">{k}</span>
                            <span className="text-[13.5px] font-semibold truncate">{v}</span>
                        </div>
                    ))}
                </div>
            </HojaConfirmacion>
        </div>
    );
};

export default PaginaDerivarMiembro;
