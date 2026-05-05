import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { User, UserRole, Group } from '../../types';
import { hasRole } from '../../services/authUtils';
import { supabaseService } from '../../services/supabaseService';
import { Plus, Users, Calendar, MapPin, Edit2, Eye, Inbox, AlertCircle, ClipboardList, RotateCcw, Settings, UserMinus, Check, Link } from 'lucide-react';
import CreateGroupModal from '../../components/GCX/ModalCrearGrupo';
import ApplicantsModal from '../../components/GCX/ModalSolicitantes';
import AttendanceModal from '../../components/GCX/ModalAsistencia';
import DropoutRequestModal from '../../components/GCX/ModalSolicitudBaja';
import NeoModal from '../../components/ui/NeoModal';
import { useTutorial } from '../../src/hooks/useTutorial';
import { useIsMobile } from '../../src/hooks/useIsMobile';
import TutorialInvitation from '../../components/onboarding/InvitacionTutorial';
import TutorialController from '../../components/onboarding/ControladorTutorial';
import { tours } from '../../src/config/tours';

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
    const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
    const [isDropoutModalOpen, setIsDropoutModalOpen] = useState(false);
    const [selectedGroupForDropout, setSelectedGroupForDropout] = useState<Group | null>(null);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successModalMessage, setSuccessModalMessage] = useState('');
    const [copiedGroupId, setCopiedGroupId] = useState<string | null>(null);
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
        const url = `${origin}/#/groups?groupId=${groupId}`;

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

    // Fetch groups owned by this host (all statuses - pending, approved, rejected)
    const fetchMyGroups = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            // Use getGroupsByHost to fetch ALL groups owned by this host (regardless of status)
            const owned = await supabaseService.getGroupsByHost(currentUser.id);
            setMyGroups(owned);
        } catch (error) {
            console.error('Error fetching groups:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMyGroups();
    }, [currentUser]);

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
            await supabaseService.clearGroupParticipants(savedGroup.id);
            setSuccessModalMessage('Solicitud de re-apertura enviada. El grupo se ha reiniciado (cupos liberados) y estará pendiente de aprobación.');
            setIsSuccessModalOpen(true);
        } else if (isReopenRequest) {
            setSuccessModalMessage('Solicitud de re-apertura enviada. El administrador revisará tu grupo.');
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
                                        <div key={group.id} id={isMobile ? `host-group-card-${index}` : undefined} className={`p-4 ${group.status === 'pending' || !group.status ? 'bg-yellow-50/30 dark:bg-yellow-900/10' : ''}`}>
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
                                            {/* Action Toggle Button - Hidden for Pending */}
                                            {!(group.status === 'pending' || !group.status) && (
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
                                            <tr key={group.id} id={!isMobile ? `host-group-row-${index}` : undefined} className={`hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors ${group.status === 'pending' || !group.status ? 'bg-yellow-50/30 dark:bg-yellow-900/10' : ''}`}>
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
                                                    {!(group.status === 'pending' || !group.status) && (
                                                        <div id={!isMobile ? `btn-host-actions-${index}` : undefined} className="flex justify-end gap-2"> {/* Added ID to container */}
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
