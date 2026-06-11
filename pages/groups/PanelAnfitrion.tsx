import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { User, UserRole, Group, SeasonSettings, DEFAULT_SEASON_SETTINGS } from '../../types';
import { hasRole } from '../../services/authUtils';
import { supabaseService } from '../../services/supabaseService';
import { Plus, Users, Calendar, MapPin, Edit2, Eye, Inbox, AlertCircle, ClipboardList, RotateCcw, Settings, UserMinus, Check, Link, ArrowLeftRight, X, AlertTriangle, Loader2 } from 'lucide-react';
import CreateGroupModal from '../../components/GCX/ModalCrearGrupo';
import ApplicantsModal from '../../components/GCX/ModalSolicitantes';
import AttendanceModal from '../../components/GCX/ModalAsistencia';
import DropoutRequestModal from '../../components/GCX/ModalSolicitudBaja';
import ModalTransferirGrupo from '../../components/GCX/ModalTransferirGrupo';
import NeoModal from '../../components/ui/NeoModal';
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

const HostDashboard: React.FC<HostDashboardProps> = ({ currentUser }) => {
    const location = useLocation();
    const [myGroups, setMyGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);
    const [isApplicantsModalOpen, setIsApplicantsModalOpen] = useState(false);
    const [selectedGroupForApplicants, setSelectedGroupForApplicants] = useState<Group | null>(null);
    const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
    const [selectedGroupForAttendance, setSelectedGroupForAttendance] = useState<Group | null>(null);
    const [isReopenRequest, setIsReopenRequest] = useState(false);
    const [seasonSettings, setSeasonSettings] = useState<SeasonSettings>(DEFAULT_SEASON_SETTINGS);
    const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
    const [isDropoutModalOpen, setIsDropoutModalOpen] = useState(false);
    const [selectedGroupForDropout, setSelectedGroupForDropout] = useState<Group | null>(null);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successModalMessage, setSuccessModalMessage] = useState('');
    const [copiedGroupId, setCopiedGroupId] = useState<string | null>(null);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [groupToTransfer, setGroupToTransfer] = useState<Group | null>(null);
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

    const handleCopyGroupLink = (e: React.MouseEvent, groupId: string) => {
        e.stopPropagation();
        e.preventDefault();

        const origin = window.location.hostname.includes('localhost') || window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)
            ? 'https://app.origeniglesia.org'
            : window.location.origin;
        const url = `${origin}/#/gcx?groupId=${groupId}`;

        const fallbackCopy = () => {
            const textArea = document.createElement("textarea");
            textArea.value = url;
            textArea.style.position = "fixed";
            textArea.style.top = "0";
            textArea.style.left = "0";
            textArea.style.width = "2em";
            textArea.style.height = "2em";
            textArea.style.padding = "0";
            textArea.style.border = "none";
            textArea.style.outline = "none";
            textArea.style.boxShadow = "none";
            textArea.style.background = "transparent";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                if (document.execCommand('copy')) {
                    setCopiedGroupId(groupId);
                    setTimeout(() => setCopiedGroupId(null), 2000);
                }
            } catch (err) {
                console.error('Fallback copy failed', err);
            }
            document.body.removeChild(textArea);
        };

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(url).then(() => {
                setCopiedGroupId(groupId);
                setTimeout(() => setCopiedGroupId(null), 2000);
            }).catch(() => fallbackCopy());
        } else {
            fallbackCopy();
        }
    };

    const handleOpenApplicants = (group: Group) => {
        setSelectedGroupForApplicants(group);
        setIsApplicantsModalOpen(true);
    };

    const handleOpenAttendance = (group: Group) => {
        setSelectedGroupForAttendance(group);
        setIsAttendanceModalOpen(true);
    };

    const handleOpenDropout = (group: Group) => {
        setSelectedGroupForDropout(group);
        setIsDropoutModalOpen(true);
    };

    const handleTransferGroup = (group: Group) => {
        setGroupToTransfer(group);
        setIsTransferModalOpen(true);
    };

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
        setEditingGroup(null);
        setIsCreateModalOpen(true);
    };

    const handleEditGroup = (group: Group) => {
        setEditingGroup(group);
        setIsCreateModalOpen(true);
    };

    const handleDeleteGroup = async (groupId: string) => {
        if (!window.confirm('¿Estás seguro que deseas eliminar este grupo?')) return;

        const success = await supabaseService.deleteGroup(groupId);
        if (success) {
            fetchMyGroups();
        }
    };

    // Handle Re-opening a finished or rejected group - Opens modal in reopen mode
    const handleReopenGroup = (group: Group) => {
        setEditingGroup(group);
        setIsReopenRequest(true);
        setIsCreateModalOpen(true);
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
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-center">
                    <p className="text-lg font-bold text-slate-400 uppercase tracking-wider">
                        Acceso Denegado
                    </p>
                    <p className="text-sm text-slate-500 mt-2">
                        Solo los Anfitriones pueden acceder a este panel.
                    </p>
                </div>
            </div>
        );
    }

    // Excluir transferencias de grupos que el usuario ya posee (datos inconsistentes / pruebas)
    const displayIncomingTransfers = incomingTransfers.filter(
        t => !myGroups.some(g => g.id === t.groupId)
    );

    return (
        <div className="min-h-screen bg-white dark:bg-black py-8 px-4 md:px-8">
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

            {/* Header */}
            <div id="host-dashboard-header" className="w-full px-4 md:px-8 lg:px-12">
                <div className="text-center mb-12">
                    <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-black dark:text-white">
                        Mis Grupos de Conexión
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 uppercase tracking-widest">
                        Panel del Anfitrión
                    </p>
                </div>

                {/* Create Button */}
                {canCreateGroup && (
                    <div className="flex justify-center mb-10">
                        <button
                            id="btn-create-group"
                            onClick={handleCreateGroup}
                            className="flex items-center gap-3 px-8 py-4 bg-black dark:bg-white text-white dark:text-black font-black uppercase tracking-wider text-sm rounded-full shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
                        >
                            <Plus className="w-5 h-5" />
                            Crear Nuevo Grupo
                        </button>
                    </div>
                )}

                {/* Content */}
                <div id="host-content-area">

                    {/* ── TRANSFERENCIAS PENDIENTES ENTRANTES ── */}
                    {displayIncomingTransfers.length > 0 && (
                        <section aria-label="Grupos que te ofrecieron" className="mb-8">
                            {/* Header */}
                            <div className="flex items-center gap-2.5 mb-4">
                                <ArrowLeftRight className="w-4 h-4 text-purple-500 shrink-0" aria-hidden="true" />
                                <h2 className="text-sm font-black uppercase tracking-widest text-black dark:text-white">
                                    Grupos que te ofrecieron
                                </h2>
                                <span className="text-[9px] font-black bg-purple-600 text-white px-2 py-0.5 shrink-0">
                                    {displayIncomingTransfers.length}
                                </span>
                            </div>

                            {/* Mismo contenedor que la lista de grupos */}
                            <div className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-white rounded-xl overflow-hidden shadow-lg">

                                {/* MOBILE */}
                                <div className="md:hidden divide-y-2 divide-black/10 dark:divide-white/10">
                                    {displayIncomingTransfers.map(transfer => (
                                        <div key={transfer.transferId} className="p-4">
                                            {/* Header row */}
                                            <div className="flex items-start gap-3 mb-3">
                                                {transfer.groupImageUrl ? (
                                                    <img
                                                        src={transfer.groupImageUrl}
                                                        alt={transfer.groupName}
                                                        className="w-14 h-14 rounded-lg object-cover grayscale border border-slate-200 dark:border-slate-700 shrink-0"
                                                        loading="lazy"
                                                        width={56}
                                                        height={56}
                                                    />
                                                ) : (
                                                    <div className="w-14 h-14 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0">
                                                        <Users className="w-6 h-6 text-neutral-400" aria-hidden="true" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-black dark:text-white uppercase flex items-center gap-2 flex-wrap">
                                                        <span className="truncate">{transfer.groupName}</span>
                                                        <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full shrink-0">
                                                            Pendiente
                                                        </span>
                                                    </p>
                                                    <p className="text-xs text-purple-600 dark:text-purple-400 font-bold mt-0.5 truncate">
                                                        De: {transfer.fromUserName}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Info row */}
                                            {(transfer.groupMeetingDay || transfer.groupLocation) && (
                                                <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400 mb-3">
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                                        <span>{transfer.groupMeetingDay}{transfer.groupMeetingTime ? ` ${transfer.groupMeetingTime}` : ''}</span>
                                                    </div>
                                                    {transfer.groupLocation && (
                                                        <div className="flex items-center gap-1 min-w-0">
                                                            <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                                            <span className="truncate">{transfer.groupLocation}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Acciones */}
                                            <div className="flex flex-col gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => { setSelectedIncomingTransfer(transfer); setIsTransferDetailOpen(true); }}
                                                    className="flex items-center justify-center gap-2 p-3 min-h-[44px] border-2 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all rounded-lg text-xs font-bold uppercase w-full"
                                                    aria-label={`Ver detalle de la transferencia del grupo ${transfer.groupName}`}
                                                >
                                                    <Eye className="w-4 h-4" aria-hidden="true" />
                                                    Ver detalle
                                                </button>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRejectTransfer(transfer)}
                                                        disabled={isProcessingTransfer}
                                                        className="flex-1 flex items-center justify-center gap-2 p-3 min-h-[44px] border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-all rounded-lg text-xs font-bold uppercase disabled:opacity-40 disabled:cursor-not-allowed"
                                                        aria-label={`Rechazar transferencia del grupo ${transfer.groupName}`}
                                                    >
                                                        <X className="w-4 h-4" aria-hidden="true" />
                                                        Rechazar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAcceptTransfer(transfer)}
                                                        disabled={isProcessingTransfer}
                                                        className="flex-1 flex items-center justify-center gap-2 p-3 min-h-[44px] border-2 border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all rounded-lg text-xs font-bold uppercase disabled:opacity-40 disabled:cursor-not-allowed"
                                                        aria-label={`Aceptar transferencia del grupo ${transfer.groupName}`}
                                                    >
                                                        {isProcessingTransfer
                                                            ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                                            : <Check className="w-4 h-4" aria-hidden="true" />
                                                        }
                                                        Aceptar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* DESKTOP TABLE */}
                                <table className="w-full hidden md:table">
                                    <thead className="bg-black dark:bg-white text-white dark:text-black">
                                        <tr className="text-xs font-black uppercase tracking-widest">
                                            <th className="p-4 text-left">Grupo</th>
                                            <th className="p-4 text-center">Ofrecido por</th>
                                            <th className="p-4 text-left">Horario</th>
                                            <th className="p-4 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {displayIncomingTransfers.map(transfer => (
                                            <tr key={transfer.transferId} className="hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        {transfer.groupImageUrl ? (
                                                            <img
                                                                src={transfer.groupImageUrl}
                                                                alt={transfer.groupName}
                                                                className="w-12 h-12 rounded-lg object-cover grayscale border border-slate-200 dark:border-slate-700"
                                                                loading="lazy"
                                                                width={48}
                                                                height={48}
                                                            />
                                                        ) : (
                                                            <div className="w-12 h-12 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0">
                                                                <Users className="w-5 h-5 text-neutral-400" aria-hidden="true" />
                                                            </div>
                                                        )}
                                                        <div>
                                                            <p className="font-bold text-black dark:text-white uppercase">{transfer.groupName}</p>
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-black uppercase bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full mt-0.5">
                                                                <ArrowLeftRight className="w-2.5 h-2.5" aria-hidden="true" />
                                                                Transferencia pendiente
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <p className="text-sm font-bold text-purple-600 dark:text-purple-400">{transfer.fromUserName}</p>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                                        <Calendar className="w-4 h-4 shrink-0" aria-hidden="true" />
                                                        <span>{transfer.groupMeetingDay}{transfer.groupMeetingTime ? ` - ${transfer.groupMeetingTime}` : ''}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => { setSelectedIncomingTransfer(transfer); setIsTransferDetailOpen(true); }}
                                                            className="p-2 border-2 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all rounded-lg"
                                                            title="Ver detalle"
                                                            aria-label={`Ver detalle del grupo ${transfer.groupName}`}
                                                        >
                                                            <Eye className="w-4 h-4" aria-hidden="true" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRejectTransfer(transfer)}
                                                            disabled={isProcessingTransfer}
                                                            className="p-2 border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-all rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                                                            title="Rechazar"
                                                            aria-label={`Rechazar transferencia del grupo ${transfer.groupName}`}
                                                        >
                                                            <X className="w-4 h-4" aria-hidden="true" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAcceptTransfer(transfer)}
                                                            disabled={isProcessingTransfer}
                                                            className="flex items-center gap-2 px-3 py-2 border-2 border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all rounded-lg text-xs font-bold uppercase disabled:opacity-40 disabled:cursor-not-allowed"
                                                            aria-label={`Aceptar transferencia del grupo ${transfer.groupName}`}
                                                        >
                                                            {isProcessingTransfer
                                                                ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                                                : <Check className="w-4 h-4" aria-hidden="true" />
                                                            }
                                                            Aceptar
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}

                    {(() => {
                        // SAMPLE DATA FOR TUTORIAL
                        const SAMPLE_GROUP: Group = {
                            id: 'demo-group',
                            name: 'Grupo Demo (Tutorial)',
                            leaderName: currentUser?.name || 'Usuario',
                            leaderSurname: '',
                            meetingDay: 'Martes',
                            meetingTime: '20:00',
                            location: 'Palermo, CABA',
                            description: 'Este es un grupo de ejemplo para mostrarte cómo funciona el sistema.',
                            maxCapacity: 12,
                            membersCount: 5,
                            status: 'approved',
                            tags: ['Jóvenes', 'Mixto'],
                            targetGender: 'Mixto',
                            registrations: [
                                { id: '1', status: 'APPROVED' }, { id: '2', status: 'APPROVED' },
                                { id: '3', status: 'APPROVED' }, { id: '4', status: 'APPROVED' },
                                { id: '5', status: 'APPROVED' }
                            ] as any[],
                            imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60',
                            coHostFirstName: '',
                            coHostLastName: '',
                            minAge: 18,
                            maxAge: 35,
                            startDate: new Date().toISOString(),
                            endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
                        };

                        const displayGroups = (isActive && myGroups.length === 0) ? [SAMPLE_GROUP] : myGroups;
                        const isDemoMode = (isActive && myGroups.length === 0);

                        if (loading) {
                            return (
                                <div className="flex justify-center py-20">
                                    <div className="w-8 h-8 border-4 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
                                </div>
                            );
                        }

                        if (displayGroups.length === 0) {
                            return (
                                /* Empty State */
                                <div className="text-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                                    <Users className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                                    <h3 className="text-xl font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                                        Aún no tienes grupos activos
                                    </h3>
                                    <p className="text-sm text-slate-400 dark:text-slate-600 mt-2 max-w-md mx-auto">
                                        Crea tu primer grupo de conexión y comienza a impactar vidas.
                                    </p>
                                </div>
                            );
                        }

                        return (
                            /* Groups - Mobile Cards + Desktop Table */
                            <div id="host-groups-list" className={`bg-white dark:bg-zinc-900 border-2 border-black dark:border-white rounded-xl overflow-hidden shadow-lg ${isDemoMode ? 'ring-4 ring-indigo-500 ring-offset-4 ring-offset-white dark:ring-offset-black' : ''}`}>
                                {isDemoMode && (
                                    <div className="bg-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-widest p-2 text-center border-b border-indigo-200">
                                        Modo Demostración (Tutorial)
                                    </div>
                                )}

                                {/* MOBILE CARD VIEW */}
                                <div className="md:hidden divide-y-2 divide-black/10 dark:divide-white/10">
                                    {displayGroups.map((group, index) => (
                                        <div key={group.id} id={isMobile ? `host-group-card-${index}` : undefined} className={`p-4 ${group.status === 'pending' || !group.status ? 'bg-yellow-50/30 dark:bg-yellow-900/10' : ''} ${pendingOutgoingGroupIds.has(group.id) ? 'grayscale opacity-60' : ''}`}>
                                            {/* Header Row */}
                                            <div className="flex items-start gap-3 mb-3">
                                                {group.imageUrl && (
                                                    <img
                                                        src={group.imageUrl}
                                                        alt={group.name}
                                                        className="w-14 h-14 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                                                    />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-black dark:text-white uppercase flex items-center gap-2 flex-wrap">
                                                        <span className="truncate">{group.name}</span>
                                                        {(group as any).co_host_id === currentUser?.id && (
                                                            <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full shrink-0">
                                                                Co-Líder
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                        <MapPin className="w-3 h-3 shrink-0" />
                                                        <span className="truncate">{group.location || 'Sin ubicación'}</span>
                                                    </p>
                                                </div>
                                                {/* Status Badge */}
                                                <div className="shrink-0">
                                                    {/* Status Badge - Priority: Finished > Status */}
                                                    {group.endDate && group.endDate < new Date().toISOString().split('T')[0] ? (
                                                        <span className="inline-flex items-center px-2 py-1 text-[10px] font-bold uppercase bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-400 rounded-full">
                                                            FINALIZADO
                                                        </span>
                                                    ) : (
                                                        <>
                                                            {group.status === 'approved' ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                                                                    ✓ Aprobado
                                                                </span>
                                                            ) : group.status === 'rejected' ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">
                                                                    ✗ Rechazado
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full animate-pulse">
                                                                    ⏳ Pendiente
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Info Row */}
                                            <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400 mb-3">
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    <span>{group.meetingDay} {group.meetingTime}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Users className="w-3.5 h-3.5" />
                                                    <span>{(group.registrations?.filter((r: any) => r.status === 'APPROVED').length) || 0}/{group.maxCapacity || 12}</span>
                                                </div>
                                            </div>

                                            {/* Admin Note for Rejected */}
                                            {group.adminNote && group.status === 'rejected' && (
                                                <div className="mb-3 flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                                    <p className="text-xs text-red-700 dark:text-red-400">{group.adminNote}</p>
                                                </div>
                                            )}

                                            {/* Action Toggle Button */}
                                            {pendingOutgoingGroupIds.has(group.id) ? (
                                                <div className="flex items-center gap-2 mt-2 px-3 py-2.5 border-2 border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/30">
                                                    <ArrowLeftRight className="w-3.5 h-3.5 text-purple-500 shrink-0" aria-hidden="true" />
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400">
                                                        Transferencia pendiente
                                                    </p>
                                                </div>
                                            ) : !(group.status === 'pending' || !group.status) && (
                                                <div className="flex flex-col gap-2">
                                                    <button
                                                        id={isMobile ? `btn-host-actions-${index}` : undefined}
                                                        onClick={() => setExpandedGroupId(expandedGroupId === group.id ? null : group.id)}
                                                        className="flex items-center justify-center gap-2 p-3 min-h-[44px] border-2 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all rounded-lg text-xs font-bold uppercase w-full"
                                                    >
                                                        <Settings className={`w-4 h-4 transition-transform ${expandedGroupId === group.id ? 'rotate-90' : ''}`} />
                                                        {expandedGroupId === group.id ? 'Cerrar Acciones' : 'Acciones'}
                                                    </button>
                                                    {/* Expandable Actions */}
                                                    {(expandedGroupId === group.id || isDemoMode) && ( // Always expand in Demo Mode? Or simulate click? Better to force expand for tutorial step? Actually, let's keep it collapsed but make the button targetable. Wait, if it's collapsed, inner buttons are hidden.
                                                        // CRITICAL: For the tutorial to point to inner buttons (Attendance), the actions MUST be expanded.
                                                        // We can force expand if isDemoMode is true.
                                                        <div className="flex flex-col gap-2 animate-in slide-in-from-top-2 duration-200">
                                                            {group.status === 'approved' && (
                                                                <>
                                                                    <button
                                                                        onClick={(e) => handleCopyGroupLink(e, group.id)}
                                                                        className={`flex items-center justify-center gap-2 p-3 min-h-[44px] border-2 transition-all rounded-lg text-xs font-bold uppercase ${copiedGroupId === group.id
                                                                                ? 'border-[#28a946] bg-[#28a946]/10 text-[#28a946]'
                                                                                : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                                            }`}
                                                                    >
                                                                        {copiedGroupId === group.id ? <Check className="w-4 h-4" /> : <Link className="w-4 h-4" />}
                                                                        {copiedGroupId === group.id ? '¡Copiado!' : 'Copiar Enlace'}
                                                                    </button>
                                                                    <button
                                                                        id={isMobile ? `btn-host-applicants-${index}` : undefined}
                                                                        onClick={() => handleOpenApplicants(group)}
                                                                        className="flex items-center justify-center gap-2 p-3 min-h-[44px] border-2 border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white transition-all rounded-lg text-xs font-bold uppercase"
                                                                    >
                                                                        <Inbox className="w-4 h-4" />
                                                                        Solicitudes
                                                                    </button>
                                                                    <button
                                                                        id={isMobile ? `btn-host-attendance-${index}` : undefined}
                                                                        onClick={() => handleOpenAttendance(group)}
                                                                        className="flex items-center justify-center gap-2 p-3 min-h-[44px] border-2 border-black dark:border-white text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all rounded-lg text-xs font-bold uppercase"
                                                                    >
                                                                        <ClipboardList className="w-4 h-4" />
                                                                        Asistencia
                                                                    </button>
                                                                    <button
                                                                        id={isMobile ? `btn-host-dropout-${index}` : undefined}
                                                                        onClick={() => handleOpenDropout(group)}
                                                                        className="flex items-center justify-center gap-2 p-3 min-h-[44px] border-2 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white transition-all rounded-lg text-xs font-bold uppercase"
                                                                    >
                                                                        <UserMinus className="w-4 h-4" />
                                                                        Bajas
                                                                    </button>
                                                                    {/* Transferir — solo approved, solo host principal */}
                                                                    {(group as any).co_host_id !== currentUser?.id && (
                                                                        <button
                                                                            onClick={() => handleTransferGroup(group)}
                                                                            className="flex items-center justify-center gap-2 p-3 min-h-[44px] border-2 border-purple-500 text-purple-500 hover:bg-purple-500 hover:text-white transition-all rounded-lg text-xs font-bold uppercase"
                                                                        >
                                                                            <ArrowLeftRight className="w-4 h-4" />
                                                                            Transferir
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}

                                                            {/* Edit - Visible for Approved (if not finished), Rejected, and ONLY for the main Host */}
                                                            {!((group.endDate && group.endDate < new Date().toISOString().split('T')[0])) && (group.status === 'approved' || group.status === 'rejected') && (group as any).co_host_id !== currentUser?.id && (
                                                                <button
                                                                    id={isMobile ? `btn-host-edit-${index}` : undefined}
                                                                    onClick={() => handleEditGroup(group)}
                                                                    className="flex items-center justify-center gap-2 p-3 min-h-[44px] border-2 border-black dark:border-white text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all rounded-lg text-xs font-bold uppercase"
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                    Editar
                                                                </button>
                                                            )}

                                                            {/* Re-open - Only for Finished groups (Removed for Rejected) */}
                                                            {(group.endDate && group.endDate < new Date().toISOString().split('T')[0]) && (
                                                                <button
                                                                    id={isMobile ? `btn-host-reopen-${index}` : undefined}
                                                                    onClick={() => handleReopenGroup(group)}
                                                                    className="flex items-center justify-center gap-2 p-3 min-h-[44px] border-2 border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white transition-all rounded-lg text-xs font-bold uppercase"
                                                                >
                                                                    <RotateCcw className="w-4 h-4" />
                                                                    Re-abrir
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* DESKTOP TABLE VIEW */}
                                <table className="w-full hidden md:table">
                                    <thead className="bg-black dark:bg-white text-white dark:text-black">
                                        <tr className="text-xs font-black uppercase tracking-widest">
                                            <th className="p-4 text-left">Grupo</th>
                                            <th className="p-4 text-center">Estado</th>
                                            <th className="p-4 text-left">Horario</th>
                                            <th className="p-4 text-center">Miembros</th>
                                            <th className="p-4 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {displayGroups.map((group, index) => (
                                            <tr key={group.id} id={!isMobile ? `host-group-row-${index}` : undefined} className={`transition-colors ${pendingOutgoingGroupIds.has(group.id) ? 'grayscale opacity-60' : 'hover:bg-slate-50 dark:hover:bg-zinc-800'} ${group.status === 'pending' || !group.status ? 'bg-yellow-50/30 dark:bg-yellow-900/10' : ''}`}>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        {group.imageUrl && (
                                                            <img
                                                                src={group.imageUrl}
                                                                alt={group.name}
                                                                className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                                                            />
                                                        )}
                                                        <div>
                                                            <p className="font-bold text-black dark:text-white uppercase flex items-center gap-2">
                                                                {group.name}
                                                                {(group as any).co_host_id === currentUser?.id && (
                                                                    <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full">
                                                                        Co-Líder
                                                                    </span>
                                                                )}
                                                            </p>
                                                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                                <MapPin className="w-3 h-3" />
                                                                {group.location || 'Sin ubicación'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    {/* Status Badge - Priority: Finished > Status */}
                                                    {group.endDate && group.endDate < new Date().toISOString().split('T')[0] ? (
                                                        <span className="inline-flex items-center px-2 py-1 text-[10px] font-bold uppercase bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-400 rounded-full">
                                                            FINALIZADO
                                                        </span>
                                                    ) : (
                                                        <>
                                                            {group.status === 'approved' ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                                                                    ✓ Aprobado
                                                                </span>
                                                            ) : group.status === 'rejected' ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">
                                                                    ✗ Rechazado
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full animate-pulse">
                                                                    ⏳ Pendiente
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                    {group.adminNote && group.status === 'rejected' && (
                                                        <div className="mt-2 flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 text-left">
                                                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                                            <p className="text-xs text-red-700 dark:text-red-400">{group.adminNote}</p>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                                        <Calendar className="w-4 h-4" />
                                                        {group.meetingDay} - {group.meetingTime}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-sm font-bold">
                                                        <Users className="w-4 h-4" />
                                                        {(group.registrations?.filter((r: any) => r.status === 'APPROVED').length) || 0} / {group.maxCapacity || 12}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    {pendingOutgoingGroupIds.has(group.id) ? (
                                                        <div className="flex justify-end">
                                                            <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 px-2 py-1.5 bg-purple-50 dark:bg-purple-950/20 border border-purple-300 dark:border-purple-700">
                                                                <ArrowLeftRight className="w-3 h-3" aria-hidden="true" />
                                                                Transferencia pendiente
                                                            </span>
                                                        </div>
                                                    ) : !(group.status === 'pending' || !group.status) && (
                                                        <div id={!isMobile ? `btn-host-actions-${index}` : undefined} className="flex justify-end gap-2">
                                                            {group.status === 'approved' && (
                                                                <>
                                                                    <button
                                                                        onClick={(e) => handleCopyGroupLink(e, group.id)}
                                                                        className={`p-2 border-2 transition-all rounded-lg ${copiedGroupId === group.id
                                                                                ? 'border-[#28a946] bg-[#28a946]/10 text-[#28a946]'
                                                                                : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                                            }`}
                                                                        title="Copiar enlace"
                                                                    >
                                                                        {copiedGroupId === group.id ? <Check className="w-4 h-4" /> : <Link className="w-4 h-4" />}
                                                                    </button>
                                                                    <button
                                                                        id={!isMobile ? `btn-host-applicants-${index}` : undefined}
                                                                        onClick={() => handleOpenApplicants(group)}
                                                                        className="p-2 border-2 border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white transition-all rounded-lg"
                                                                        title="Solicitudes"
                                                                    >
                                                                        <Inbox className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        id={!isMobile ? `btn-host-attendance-${index}` : undefined}
                                                                        onClick={() => handleOpenAttendance(group)}
                                                                        className="p-2 border-2 border-black dark:border-white text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all rounded-lg"
                                                                        title="Control de Asistencia"
                                                                    >
                                                                        <ClipboardList className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        id={!isMobile ? `btn-host-dropout-${index}` : undefined}
                                                                        onClick={() => handleOpenDropout(group)}
                                                                        className="p-2 border-2 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white transition-all rounded-lg"
                                                                        title="Bajas"
                                                                    >
                                                                        <UserMinus className="w-4 h-4" />
                                                                    </button>
                                                                    {/* Transferir — solo host principal */}
                                                                    {(group as any).co_host_id !== currentUser?.id && (
                                                                        <button
                                                                            onClick={() => handleTransferGroup(group)}
                                                                            className="p-2 border-2 border-purple-500 text-purple-500 hover:bg-purple-500 hover:text-white transition-all rounded-lg"
                                                                            title="Transferir grupo"
                                                                        >
                                                                            <ArrowLeftRight className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}

                                                            {/* Edit - Visible for Approved (if not finished), Rejected, and ONLY for the main Host */}
                                                            {!((group.endDate && group.endDate < new Date().toISOString().split('T')[0])) && (group.status === 'approved' || group.status === 'rejected') && (group as any).co_host_id !== currentUser?.id && (
                                                                <button
                                                                    id={!isMobile ? `btn-host-edit-${index}` : undefined}
                                                                    onClick={() => handleEditGroup(group)}
                                                                    className="p-2 border-2 border-black dark:border-white text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all rounded-lg"
                                                                    title="Editar"
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                </button>
                                                            )}

                                                            {/* Re-open - Only for Finished groups (Removed for Rejected) */}
                                                            {(group.endDate && group.endDate < new Date().toISOString().split('T')[0]) && (
                                                                <button
                                                                    id={!isMobile ? `btn-host-reopen-${index}` : undefined}
                                                                    onClick={() => handleReopenGroup(group)}
                                                                    className="flex items-center gap-2 px-3 py-2 border-2 border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white transition-all rounded-lg text-xs font-bold uppercase"
                                                                    title="Re-abrir grupo"
                                                                >
                                                                    <RotateCcw className="w-4 h-4" />
                                                                    Re-abrir
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Create/Edit Modal */}
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

            {/* Applicants Modal */}
            {isApplicantsModalOpen && selectedGroupForApplicants && (
                <ApplicantsModal
                    isOpen={isApplicantsModalOpen}
                    onClose={() => setIsApplicantsModalOpen(false)}
                    groupId={selectedGroupForApplicants.id}
                    groupName={selectedGroupForApplicants.name}
                    hideEmailSelection={true}
                />
            )}

            {/* Attendance Modal */}
            {isAttendanceModalOpen && selectedGroupForAttendance && (
                <AttendanceModal
                    isOpen={isAttendanceModalOpen}
                    onClose={() => setIsAttendanceModalOpen(false)}
                    group={selectedGroupForAttendance}
                />
            )}

            {/* Dropout Request Modal */}
            {isDropoutModalOpen && selectedGroupForDropout && currentUser && (
                <DropoutRequestModal
                    isOpen={isDropoutModalOpen}
                    onClose={() => setIsDropoutModalOpen(false)}
                    group={selectedGroupForDropout}
                    currentUserId={currentUser.id}
                    onSuccess={() => fetchMyGroups()}
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
                                className="w-full h-44 object-cover border-2 border-black dark:border-neutral-600"
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
                                className="flex-[2] min-h-[44px] bg-black dark:bg-white text-white dark:text-black border-2 border-black dark:border-white text-xs font-black uppercase tracking-widest hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
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

            {/* Transfer Modal */}
            {isTransferModalOpen && groupToTransfer && currentUser && (
                <ModalTransferirGrupo
                    isOpen={isTransferModalOpen}
                    onClose={() => {
                        setIsTransferModalOpen(false);
                        setGroupToTransfer(null);
                    }}
                    group={groupToTransfer}
                    currentUser={currentUser}
                    onTransferInitiated={() => {
                        setIsTransferModalOpen(false);
                        setGroupToTransfer(null);
                        fetchMyGroups();
                    }}
                />
            )}

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
                        className="mt-4 w-full py-4 bg-[#118f46] text-white font-black uppercase tracking-widest rounded-xl hover:bg-[#0d7036] transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] active:shadow-none active:translate-y-1"
                    >
                        Entendido
                    </button>
                </div>
            </NeoModal>
        </div>
    );
};

export default HostDashboard;
