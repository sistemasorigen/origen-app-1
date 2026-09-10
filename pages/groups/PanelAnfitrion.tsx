import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { User, UserRole, Group, SeasonSettings, DEFAULT_SEASON_SETTINGS } from '../../types';
import { hasRole } from '../../services/authUtils';
import { supabaseService } from '../../services/supabaseService';
import { Plus, Check, X, AlertTriangle, Loader2, ArrowLeftRight, Calendar, Eye } from 'lucide-react';
import CreateGroupModal from '../../components/GCX/ModalCrearGrupo';
import NeoModal from '../../components/ui/NeoModal';
import { T, btnPrimarioBase, rotulo, Vacio } from '../../components/GCX/patron';
import { useTutorial } from '../../src/hooks/useTutorial';
import { useIsMobile } from '../../src/hooks/useIsMobile';
import TutorialInvitation from '../../components/onboarding/InvitacionTutorial';
import TutorialController from '../../components/onboarding/ControladorTutorial';
import { tours } from '../../src/config/tours';

interface IncomingTransfer {
    transferId: string;
    groupId: string;
    groupName: string;
    groupImageUrl: string;
    groupDescription: string;
    groupMeetingDay: string;
    groupMeetingTime: string;
    groupLocation: string;
    fromUserId: string;
    fromUserName: string;
    createdAt: string;
}

interface HostDashboardProps {
    currentUser: User | null;
}

// Cuenta personas reales, no filas de registro.
// Una fila con partnerData representa 2 personas
// (inscripción de pareja), no 1.
function countApprovedPeople(registrations?: any[]): number {
    if (!registrations) return 0;
    return registrations
        .filter((r: any) => r.status === 'APPROVED')
        .reduce((total: number, r: any) => {
            const esPareja = !!(r.partnerData || r.partner_data);
            return total + (esPareja ? 2 : 1);
        }, 0);
}

const iniciales = (nombre?: string): string => {
    const partes = (nombre || '').trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return '?';
    return (partes[0][0] + (partes[1]?.[0] || '')).toUpperCase();
};

// ── Estado visible de una tarjeta ───────────────────────────────────────
// El estado es lo único que cambia el peso de la tarjeta; la forma es
// siempre la misma. "finalizado" no vive en la base: se deriva del endDate,
// igual que en el detalle del grupo.
type EstadoTarjeta = 'activo' | 'pendiente' | 'rechazado' | 'finalizado';

const estadoDeGrupo = (group: Group): EstadoTarjeta => {
    if (group.endDate && group.endDate < new Date().toISOString().split('T')[0]) return 'finalizado';
    if (group.status === 'rejected') return 'rechazado';
    if (group.status === 'approved') return 'activo';
    return 'pendiente';
};

const ETIQUETA_ESTADO: Record<EstadoTarjeta, string> = {
    activo: 'Activo',
    pendiente: 'Pendiente',
    rechazado: 'Rechazado',
    finalizado: 'Finalizado',
};

// Badge sobre la foto, no al lado del nombre: es lo primero que se ve y
// no compite con el título.
const BadgeEstado: React.FC<{ estado: EstadoTarjeta }> = ({ estado }) => {
    const punto = estado === 'activo'
        ? 'oklch(0.62 0.15 150)'
        : estado === 'pendiente'
            ? 'rgba(0,0,0,.35)'
            : null;

    const fondo = estado === 'rechazado'
        ? 'bg-[#0a0a0a] text-white'
        : estado === 'finalizado'
            ? 'bg-white/[.94] text-black/55'
            : 'bg-white/[.94] text-[#0a0a0a]';

    return (
        <div className={`absolute top-3 left-3 lg:top-3.5 lg:left-3.5 h-[30px] lg:h-8 px-3 lg:px-[13px] rounded-full flex items-center gap-1.5 text-[12px] lg:text-[12.5px] font-semibold ${fondo}`}>
            {punto && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: punto }} aria-hidden="true" />}
            {ETIQUETA_ESTADO[estado]}
        </div>
    );
};

const HostDashboard: React.FC<HostDashboardProps> = ({ currentUser }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [myGroups, setMyGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);
    const [isReopenRequest, setIsReopenRequest] = useState(false);
    const [seasonSettings, setSeasonSettings] = useState<SeasonSettings>(DEFAULT_SEASON_SETTINGS);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successModalMessage, setSuccessModalMessage] = useState('');
    // Transferencias entrantes (soy el destinatario)
    const [incomingTransfers, setIncomingTransfers] = useState<IncomingTransfer[]>([]);
    // Grupos míos con transferencia saliente pendiente
    const [pendingOutgoingGroupIds, setPendingOutgoingGroupIds] = useState<Set<string>>(new Set());
    const [isTransferDetailOpen, setIsTransferDetailOpen] = useState(false);
    const [selectedIncomingTransfer, setSelectedIncomingTransfer] = useState<IncomingTransfer | null>(null);
    const [isProcessingTransfer, setIsProcessingTransfer] = useState(false);
    const isMobile = useIsMobile();

    // Tutorial Hook
    const {
        isActive,
        showInvitation,
        startTutorial,
        completeTutorial,
        dismissTutorial,
        declineTemporary
    } = useTutorial('host');

    const handleAcceptTransfer = async (transfer: IncomingTransfer) => {
        if (!currentUser) return;
        setIsProcessingTransfer(true);
        try {
            const ok = await supabaseService.acceptGroupTransfer(
                transfer.transferId,
                transfer.groupId,
                currentUser.id,
                currentUser.name || ''
            );
            if (ok) {
                setIsTransferDetailOpen(false);
                setSelectedIncomingTransfer(null);
                await fetchMyGroups();
            } else {
                alert('Error al aceptar la transferencia. Intentá de nuevo.');
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error desconocido';
            alert(msg);
        } finally {
            setIsProcessingTransfer(false);
        }
    };

    const handleRejectTransfer = async (transfer: IncomingTransfer) => {
        setIsProcessingTransfer(true);
        try {
            const ok = await supabaseService.rejectGroupTransfer(
                transfer.transferId,
                transfer.fromUserId,
                transfer.groupName
            );
            if (ok) {
                setIsTransferDetailOpen(false);
                setSelectedIncomingTransfer(null);
                await fetchMyGroups();
            } else {
                alert('Error al rechazar la transferencia. Intentá de nuevo.');
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error desconocido';
            alert(msg);
        } finally {
            setIsProcessingTransfer(false);
        }
    };

    // Fetch groups owned by this host (all statuses - pending, approved, rejected)
    const fetchMyGroups = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            // Grupos propios
            const owned = await supabaseService.getGroupsByHost(currentUser.id);
            setMyGroups(owned);

            // Transferencias pendientes entrantes y salientes
            const [incoming, outgoingIds] = await Promise.all([
                supabaseService.getPendingIncomingTransfers(currentUser.id),
                supabaseService.getPendingOutgoingTransferGroupIds(currentUser.id),
            ]);
            setIncomingTransfers(incoming);
            setPendingOutgoingGroupIds(new Set(outgoingIds));
        } catch (error) {
            console.error('Error fetching groups:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMyGroups();
    }, [currentUser]);

    useEffect(() => {
        supabaseService.getAppConfig().then(cfg => {
            if (cfg?.groupsConfig?.seasonSettings) {
                setSeasonSettings(cfg.groupsConfig.seasonSettings);
            }
        });
    }, []);

    // Check for modal query param (e.g. from Tutorials page)
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        if (searchParams.get('modal') === 'createGroup') {
            setIsCreateModalOpen(true);
        }
    }, [location]);

    const handleCreateGroup = () => {
        navigate('/mis-grupos/crear-grupo');
    };

    const handleModalClose = () => {
        setIsCreateModalOpen(false);
        setEditingGroup(null);
        setIsReopenRequest(false);
    };

    const handleGroupSaved = async (savedGroup?: Group) => {
        if (isReopenRequest && savedGroup?.id) {
            // Con el nuevo flujo, el grupo nuevo ya nace vacío — no hace falta borrar participantes.
            // El grupo original quedó marcado como 'finished' con su historial intacto.
            setSuccessModalMessage(
                'Solicitud de re-apertura enviada. ' +
                'Se creó un nuevo grupo para la temporada seleccionada. El administrador lo revisará.'
            );
            setIsSuccessModalOpen(true);
        } else if (isReopenRequest) {
            setSuccessModalMessage(
                'Solicitud de re-apertura enviada. El administrador revisará tu grupo.'
            );
            setIsSuccessModalOpen(true);
        } else if (!editingGroup) {
            setSuccessModalMessage('Recibirás un aviso por email cuando tu Grupo de Conexión esté aprobado o rechazado junto a la razón.');
            setIsSuccessModalOpen(true);
        }

        await fetchMyGroups();
        handleModalClose();
    };

    const isAnfitrion = currentUser && hasRole(currentUser, [
        UserRole.ANFITRION,
        UserRole.CO_ANFITRION,
        UserRole.ADMIN_GROUPS,
        UserRole.SUPER_ADMIN
    ]);

    const canCreateGroup = currentUser && hasRole(currentUser, [
        UserRole.ANFITRION,
        UserRole.ADMIN_GROUPS,
        UserRole.SUPER_ADMIN
    ]);

    if (!isAnfitrion) {
        return (
            <div className={`min-h-screen ${T.fondo} ${T.fuente} ${T.tinta} flex items-center justify-center px-6`}>
                <div className="text-center">
                    <p className="text-[19px] font-semibold tracking-[-.01em]">Acceso denegado</p>
                    <p className="mt-2.5 text-[14.5px] font-medium text-black/50 dark:text-white/50">
                        Solo los anfitriones pueden entrar a este panel.
                    </p>
                </div>
            </div>
        );
    }

    // Excluir transferencias de grupos que el usuario ya posee (datos inconsistentes / pruebas)
    const displayIncomingTransfers = incomingTransfers.filter(
        t => !myGroups.some(g => g.id === t.groupId)
    );

    // Antes acá vivía un SAMPLE_GROUP: cuando el recorrido guiado estaba
    // activo y el anfitrión no tenía grupos, se mostraba un "Grupo de
    // ejemplo" de mentira para recorrer. Se fue con los tutoriales, que
    // están apagados desde src/hooks/useTutorial.ts.
    const displayGroups = myGroups;

    // ── Una tarjeta ─────────────────────────────────────────────────────
    // Es la portada del detalle, no un renglón de tabla: entrar al grupo se
    // siente como agrandar la misma tarjeta.
    const Tarjeta = (group: Group, index: number) => {
        const estado = estadoDeGrupo(group);
        const transferenciaSaliente = pendingOutgoingGroupIds.has(group.id);
        const aprobados = countApprovedPeople(group.registrations);
        const pendientes = (group.registrations || []).filter((r: any) => r.status === 'PENDING').length;
        const apagado = estado === 'finalizado';

        // Un grupo en revisión todavía no tiene detalle que mirar, y uno con
        // transferencia saliente está en manos de otro: ninguno se abre.
        const abrible = estado !== 'pendiente' && !transferenciaSaliente;

        const cuando = [
            `${group.meetingDay || ''} ${group.meetingTime || ''}`.trim(),
            group.isOnline ? 'Online' : group.location,
        ].filter(Boolean).join(' · ');

        const cuerpo = (
            <>
                <div className={`relative rounded-[20px] lg:rounded-[22px] overflow-hidden ${group.imageUrl ? 'h-[168px] lg:h-[200px]' : 'h-[120px] lg:h-[150px]'} ${apagado ? 'grayscale' : ''}`}>
                    {group.imageUrl ? (
                        <img src={group.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                        <div className={`w-full h-full flex items-center justify-center ${T.chip}`}>
                            <span className="text-[10.5px] font-medium tracking-[.06em] text-black/35 dark:text-white/35 font-mono">
                                sin foto cargada
                            </span>
                        </div>
                    )}
                    <BadgeEstado estado={estado} />
                    {pendientes > 0 && estado === 'activo' && (
                        <div
                            className="absolute top-3 right-3 lg:top-3.5 lg:right-3.5 h-[30px] lg:h-8 px-[11px] lg:px-3 rounded-full flex items-center text-[13px] font-semibold text-white"
                            style={{ background: 'oklch(0.58 0.2 25)' }}
                        >
                            {pendientes} {pendientes === 1 ? 'solicitud' : 'solicitudes'}
                        </div>
                    )}
                </div>

                <div className="px-2.5 lg:px-3 pt-4 lg:pt-[18px] pb-2 lg:pb-2.5 text-left">
                    <div className="flex items-baseline justify-between gap-3">
                        <p className={`text-[20px] lg:text-[22px] font-semibold tracking-[-.015em] truncate ${apagado ? 'text-black/60 dark:text-white/60' : ''}`}>
                            {group.name}
                        </p>
                        <span className={`text-[13.5px] lg:text-[14px] font-semibold whitespace-nowrap ${apagado ? 'text-black/40 dark:text-white/40' : 'text-black/50 dark:text-white/50'}`}>
                            {apagado
                                ? `${aprobados} ${aprobados === 1 ? 'miembro' : 'miembros'}`
                                : `${aprobados} de ${group.maxCapacity || 12}`}
                        </span>
                    </div>
                    <p className={`mt-2 text-[14px] lg:text-[14.5px] leading-[1.6] font-medium ${apagado ? 'text-black/45 dark:text-white/45' : 'text-black/55 dark:text-white/55'}`}>
                        {cuando || 'Sin horario cargado'}
                    </p>
                </div>
            </>
        );

        return (
            <div
                key={group.id}
                id={`host-group-card-${index}`}
                className={`rounded-[28px] lg:rounded-[30px] p-3 lg:p-3.5 ${apagado
                    ? 'bg-[#f0f0ed] dark:bg-[#1b1b1a]'
                    : 'bg-white dark:bg-[#1b1b1a]'} ${transferenciaSaliente ? 'opacity-60' : ''}`}
            >
                {abrible ? (
                    <button
                        type="button"
                        id={`btn-host-actions-${index}`}
                        onClick={() => navigate(`/mis-grupos/${group.id}`)}
                        className="block w-full text-left rounded-[20px] lg:rounded-[22px] transition-opacity hover:opacity-[.92] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black/10"
                    >
                        {cuerpo}
                    </button>
                ) : (
                    <div>{cuerpo}</div>
                )}

                <div className="px-2.5 lg:px-3 pb-1.5">
                    {transferenciaSaliente && (
                        <div className={`${T.interna} rounded-[18px] lg:rounded-[20px] px-4 py-3.5 flex items-center gap-2.5`}>
                            <ArrowLeftRight className="w-4 h-4 shrink-0 text-black/45 dark:text-white/45" aria-hidden="true" />
                            <p className="text-[13px] leading-[1.55] font-medium text-black/55 dark:text-white/55">
                                Transferencia pendiente: alguien más tiene que aceptarla.
                            </p>
                        </div>
                    )}

                    {!transferenciaSaliente && estado === 'pendiente' && (
                        <div className={`${T.interna} rounded-[18px] lg:rounded-[20px] px-4 py-3.5`}>
                            <p className="text-[13px] leading-[1.55] font-medium text-black/55 dark:text-white/55">
                                Esperando la revisión de un administrador. Te avisamos cuando lo aprueben.
                            </p>
                        </div>
                    )}

                    {!transferenciaSaliente && estado === 'rechazado' && (
                        <>
                            {group.adminNote && (
                                <div className={`${T.interna} rounded-[18px] lg:rounded-[20px] px-4 py-3.5`}>
                                    <p className={rotulo}>Motivo del rechazo</p>
                                    <p className="mt-[7px] text-[13px] leading-[1.55] font-medium text-black/60 dark:text-white/60">
                                        {group.adminNote}
                                    </p>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => navigate(`/mis-grupos/${group.id}/editar-grupo`)}
                                className={`${btnPrimarioBase} w-full h-[52px] text-[15.5px] mt-3.5`}
                            >
                                Editar y reenviar
                            </button>
                        </>
                    )}

                    {!transferenciaSaliente && estado === 'finalizado' && (
                        <button
                            type="button"
                            onClick={() => navigate(`/mis-grupos/${group.id}/reabrir-grupo`)}
                            className={`${btnPrimarioBase} w-full h-[52px] text-[15.5px] mt-4`}
                        >
                            Reabrir para la próxima
                        </button>
                    )}

                </div>
            </div>
        );
    };

    const botonCrear = (id?: string, extra = '') => (
        <button
            type="button"
            id={id}
            onClick={handleCreateGroup}
            className={`${btnPrimarioBase} w-full h-[60px] text-[16.5px] ${extra}`}
        >
            <Plus className="w-[18px] h-[18px]" strokeWidth={2.4} />
            Crear un grupo
        </button>
    );

    return (
        <div className={`min-h-screen ${T.fondo} ${T.fuente} ${T.tinta}`}>
            <TutorialInvitation
                isOpen={showInvitation}
                onStart={startTutorial}
                onClose={declineTemporary}
                onDismiss={dismissTutorial}
                title="Bienvenido a tu Panel de Anfitrión"
            />
            <TutorialController
                steps={tours.host}
                run={isActive}
                onComplete={completeTutorial}
                onSkip={dismissTutorial}
            />

            {/* Encabezado */}
            <div className="bg-white dark:bg-[#1b1b1a] rounded-b-[28px] px-5 pt-4 pb-[22px] lg:px-8 lg:py-[22px]">
                <div id="host-dashboard-header" className="max-w-[430px] lg:max-w-[1160px] mx-auto flex items-center gap-3.5 lg:gap-5">
                    <div className="min-w-0 flex-1">
                        <p className="text-[26px] lg:text-[28px] font-semibold tracking-[-.02em]">Mis grupos</p>
                        <p className="mt-1 text-[13.5px] lg:text-[14px] font-medium text-black/45 dark:text-white/45 truncate">
                            {currentUser?.name || 'Anfitrión'}
                            <span className="hidden lg:inline">
                                {` · ${displayGroups.length} ${displayGroups.length === 1 ? 'grupo' : 'grupos'}`}
                            </span>
                        </p>
                    </div>

                    {/* En desktop el botón sube al encabezado: abajo de tres
                        tarjetas no lo vería nadie. */}
                    {canCreateGroup && (
                        <button
                            type="button"
                            id={!isMobile ? 'btn-create-group' : undefined}
                            onClick={handleCreateGroup}
                            className={`${btnPrimarioBase} hidden lg:flex shrink-0 h-[52px] px-6 text-[15.5px]`}
                        >
                            <Plus className="w-[17px] h-[17px]" strokeWidth={2.4} />
                            Crear un grupo
                        </button>
                    )}

                    {currentUser?.avatarUrl ? (
                        <img
                            src={currentUser.avatarUrl}
                            alt=""
                            className="w-11 h-11 lg:w-12 lg:h-12 rounded-full object-cover shrink-0"
                            loading="lazy"
                        />
                    ) : (
                        <div className={`w-11 h-11 lg:w-12 lg:h-12 shrink-0 rounded-full ${T.chip} flex items-center justify-center text-[14px] lg:text-[15px] font-semibold text-black/60 dark:text-white/60`}>
                            {iniciales(currentUser?.name)}
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-[430px] lg:max-w-[1160px] mx-auto px-4 lg:px-8 pt-4 lg:pt-7 pb-8 lg:pb-10">

                {/* ── SOLICITUDES DE TITULARIDAD ──
                    Interrumpe por posición y por inversión de color, arriba de
                    todo y antes del rótulo. Sin banda de alerta. */}
                {displayIncomingTransfers.map(transfer => (
                    <div
                        key={transfer.transferId}
                        className="bg-[#0a0a0a] dark:bg-white rounded-[26px] lg:rounded-[28px] p-5 lg:px-7 lg:py-6 mb-3.5 lg:flex lg:items-center lg:gap-7"
                    >
                        <button
                            type="button"
                            onClick={() => { setSelectedIncomingTransfer(transfer); setIsTransferDetailOpen(true); }}
                            className="block w-full text-left lg:flex-1 min-w-0"
                            aria-label={`Ver el detalle del grupo ${transfer.groupName}`}
                        >
                            <p className="text-[11.5px] font-semibold uppercase tracking-[.07em] text-white/50 dark:text-black/45">
                                Te quieren transferir un grupo
                            </p>
                            <p className="mt-2.5 text-[19px] lg:text-[21px] leading-[1.35] font-semibold tracking-[-.01em] text-white dark:text-black">
                                {transfer.fromUserName} te ofrece el grupo {transfer.groupName}
                            </p>
                            <p className="mt-2.5 text-[13.5px] lg:text-[14px] leading-[1.6] font-medium text-white/60 dark:text-black/55">
                                {[
                                    `${transfer.groupMeetingDay || ''} ${transfer.groupMeetingTime || ''}`.trim(),
                                    transfer.groupLocation,
                                ].filter(Boolean).join(' · ')}
                                {'. Si aceptás, pasás a ser el anfitrión.'}
                            </p>
                        </button>

                        <div className="flex gap-2.5 mt-[18px] lg:mt-0 lg:shrink-0">
                            <button
                                type="button"
                                onClick={() => handleRejectTransfer(transfer)}
                                disabled={isProcessingTransfer}
                                className="h-[54px] px-[22px] lg:px-6 rounded-full bg-white/[.12] dark:bg-black/[.08] text-white dark:text-black font-semibold text-[15.5px] transition-opacity hover:opacity-80 disabled:opacity-40"
                            >
                                Rechazar
                            </button>
                            <button
                                type="button"
                                onClick={() => handleAcceptTransfer(transfer)}
                                disabled={isProcessingTransfer}
                                className="flex-1 lg:flex-none h-[54px] lg:px-8 rounded-full bg-white dark:bg-[#0a0a0a] text-[#0a0a0a] dark:text-white font-semibold text-[16px] flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-40"
                            >
                                {isProcessingTransfer
                                    ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                    : <Check className="w-[18px] h-[18px]" aria-hidden="true" />}
                                Aceptar
                            </button>
                        </div>
                    </div>
                ))}

                <div id="host-content-area">
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="w-7 h-7 animate-spin text-black/20 dark:text-white/20" />
                        </div>
                    ) : displayGroups.length === 0 ? (
                        // El diseño traía acá un "Recorrer un grupo de ejemplo".
                        // Se sacó junto con los tutoriales: con el recorrido
                        // apagado sería un botón que no hace nada.
                        <div className="bg-white dark:bg-[#1b1b1a] rounded-[28px]">
                            <Vacio
                                titulo="Todavía no liderás ningún grupo"
                                detalle="Creá el primero: cargás el día, el horario y el lugar, y un administrador lo aprueba."
                                accion={canCreateGroup ? { texto: 'Crear mi primer grupo', onClick: handleCreateGroup } : undefined}
                            />
                        </div>
                    ) : (
                        <>
                            <p className={`${rotulo} px-1.5 lg:px-1 mb-3 lg:mb-3.5`}>
                                Mis grupos · {displayGroups.length}
                            </p>
                            {/* Con uno a tres grupos, dos columnas alcanzan y las
                                tarjetas no se comprimen: son las mismas, más anchas. */}
                            <div id="host-groups-list" className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 lg:gap-5">
                                {/* La key va acá y no adentro de Tarjeta: React
                                    valida las listas en el punto donde se arma
                                    el array, y una key puesta dentro de una
                                    función auxiliar no la ve. */}
                                {displayGroups.map((group, index) => (
                                    <React.Fragment key={group.id}>
                                        {Tarjeta(group, index)}
                                    </React.Fragment>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {canCreateGroup && !loading && displayGroups.length > 0 && (
                    <div className="lg:hidden mt-5">
                        {botonCrear(isMobile ? 'btn-create-group' : undefined)}
                    </div>
                )}
            </div>

            {/* Create/Edit Modal — alcanzable desde /mis-grupos?modal=createGroup */}
            {isCreateModalOpen && (
                <CreateGroupModal
                    isOpen={isCreateModalOpen}
                    onClose={handleModalClose}
                    onSave={handleGroupSaved}
                    editingGroup={editingGroup}
                    currentUser={currentUser}
                    isReopenRequest={isReopenRequest}
                    seasonSettings={seasonSettings}
                />
            )}

            {/* Modal de detalle — transferencia entrante */}
            <NeoModal
                isOpen={isTransferDetailOpen}
                onClose={() => {
                    if (isProcessingTransfer) return;
                    setIsTransferDetailOpen(false);
                    setSelectedIncomingTransfer(null);
                }}
                title="Solicitud de Titularidad"
                maxWidth="max-w-lg"
                persistent={isProcessingTransfer}
            >
                {selectedIncomingTransfer && (
                    <div className="space-y-5 px-1 pb-1">
                        {/* Quién transfiere — highlighted pill */}
                        <div className="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-950/30 border-2 border-purple-300 dark:border-purple-700">
                            <ArrowLeftRight className="w-5 h-5 text-purple-500 shrink-0" aria-hidden="true" />
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-purple-500 mb-0.5">
                                    Te transfiere este grupo
                                </p>
                                <p className="font-black text-sm text-black dark:text-white">
                                    {selectedIncomingTransfer.fromUserName}
                                </p>
                            </div>
                        </div>

                        {/* Imagen */}
                        {selectedIncomingTransfer.groupImageUrl && (
                            <img
                                src={selectedIncomingTransfer.groupImageUrl}
                                alt={selectedIncomingTransfer.groupName}
                                className="w-full h-44 object-cover border border-slate-200 dark:border-zinc-700 rounded-lg"
                                loading="lazy"
                                width={600}
                                height={176}
                            />
                        )}

                        {/* Datos del grupo */}
                        <div className="space-y-3">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-0.5">Grupo</p>
                                <p className="font-black text-base uppercase tracking-tight text-black dark:text-white">
                                    {selectedIncomingTransfer.groupName}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-0.5">Día</p>
                                    <p className="font-bold text-sm text-black dark:text-white">
                                        {selectedIncomingTransfer.groupMeetingDay || '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-0.5">Horario</p>
                                    <p className="font-bold text-sm text-black dark:text-white">
                                        {selectedIncomingTransfer.groupMeetingTime || 'Sin especificar'}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-0.5">Ubicación</p>
                                <p className="font-bold text-sm text-black dark:text-white">
                                    {selectedIncomingTransfer.groupLocation || 'Sin especificar'}
                                </p>
                            </div>

                            {selectedIncomingTransfer.groupDescription && (
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-0.5">Descripción</p>
                                    <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 leading-relaxed">
                                        {selectedIncomingTransfer.groupDescription}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Advertencia */}
                        <div className="border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-4 flex gap-3" role="note">
                            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                            <p className="text-xs font-medium text-amber-700 dark:text-amber-400 leading-relaxed">
                                Al aceptar, pasarás a ser el Anfitrión oficial de este grupo.
                                Solo un Encargado de Grupos o el Administrador puede revertir esta acción.
                            </p>
                        </div>

                        {/* Botones — min-h 44px para touch */}
                        <div className="flex gap-3 pt-1">
                            <button
                                type="button"
                                onClick={() => handleRejectTransfer(selectedIncomingTransfer)}
                                disabled={isProcessingTransfer}
                                className="flex-1 min-h-[44px] border-2 border-red-500 text-red-500 text-xs font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                                aria-label="Rechazar la transferencia de este grupo"
                            >
                                <X className="w-4 h-4" aria-hidden="true" />
                                Rechazar
                            </button>
                            <button
                                type="button"
                                onClick={() => handleAcceptTransfer(selectedIncomingTransfer)}
                                disabled={isProcessingTransfer}
                                className="flex-[2] min-h-[44px] bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold uppercase tracking-wide hover:opacity-90 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 rounded-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20 dark:focus-visible:ring-white/20"
                                aria-label="Aceptar la titularidad de este grupo"
                            >
                                {isProcessingTransfer ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Procesando...</>
                                ) : (
                                    <><Check className="w-4 h-4" aria-hidden="true" /> Aceptar titularidad</>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </NeoModal>

            {/* Success Modal */}
            <NeoModal
                isOpen={isSuccessModalOpen}
                onClose={() => setIsSuccessModalOpen(false)}
                maxWidth="max-w-md"
            >
                <div className="flex flex-col items-center justify-center p-6 text-center space-y-6">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center shadow-inner">
                        <Check className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-tight text-black dark:text-white">
                        {successModalMessage.includes('creado') ? '¡Grupo Creado!' : '¡Solicitud Enviada!'}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                        {successModalMessage}
                    </p>
                    <button
                        onClick={() => setIsSuccessModalOpen(false)}
                        className="mt-4 w-full py-4 bg-[#118f46] text-white font-semibold uppercase tracking-wide rounded-xl hover:bg-[#0d7036] transition-all shadow-sm active:scale-[0.98]"
                    >
                        Entendido
                    </button>
                </div>
            </NeoModal>
        </div>
    );
};

export default HostDashboard;
