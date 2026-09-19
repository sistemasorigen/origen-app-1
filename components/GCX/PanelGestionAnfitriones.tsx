import React, { useState, useEffect } from 'react';
import { User, UserRole, Group, LeaderApplication } from '../../types';
import { supabaseService, updateGroupDirect } from '../../services/supabaseService';
import { Search, X, Loader2, Plus } from 'lucide-react';
import ModalPanelGCX, { BotonPrincipal, BotonSecundario } from './ModalPanelGCX';
import { usePanelGCXConteos } from '../layout/AdminGCXLayout';

/**
 * Sección Anfitriones del panel (design-claude/Admin GCX - Panel).
 *
 * Una fila por persona: quién es, qué grupos lidera y las dos acciones que
 * el diseño pone a la derecha. Arriba, cuando hay, las postulaciones
 * pendientes —antes vivían en una columna aparte que en mobile obligaba a
 * cambiar de pestaña; ahora se ven siempre, porque son pocas y urgentes.
 */

interface HostsManagementPanelProps {
    groups: Group[];
    onUpdate: () => void;
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const iniciales = (nombre: string) =>
    (nombre || '').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';

const HostsManagementPanel: React.FC<HostsManagementPanelProps> = ({ groups, onUpdate, showToast }) => {
    const { registrarConteo } = usePanelGCXConteos();
    const [isLoading, setIsLoading] = useState(false);

    const [allHosts, setAllHosts] = useState<{ user: User, isHost: boolean, isCoHost: boolean }[]>([]);

    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<'ALL' | 'HOST' | 'CO_HOST'>('ALL');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED'>('ALL');

    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
    const [targetGroupId, setTargetGroupId] = useState<string>('');
    const [assignmentRole, setAssignmentRole] = useState<'HOST' | 'CO_HOST'>('HOST');

    const [isNewHostModalOpen, setIsNewHostModalOpen] = useState(false);
    const [newHostSearchTerm, setNewHostSearchTerm] = useState('');
    const [newHostResults, setNewHostResults] = useState<User[]>([]);
    const [isSearchingNewHost, setIsSearchingNewHost] = useState(false);

    const [applications, setApplications] = useState<LeaderApplication[]>([]);
    const [viewingApp, setViewingApp] = useState<LeaderApplication | null>(null);

    const [manageRolesModalOpen, setManageRolesModalOpen] = useState(false);
    const [manageRolesTarget, setManageRolesTarget] = useState<{ user: User, isHost: boolean, isCoHost: boolean } | null>(null);

    // --- FETCH DATA ---
    const fetchRoleUsers = async () => {
        setIsLoading(true);
        try {
            const [hosts, coHosts] = await Promise.all([
                supabaseService.getUsersByRole(UserRole.ANFITRION),
                supabaseService.getUsersByRole(UserRole.CO_ANFITRION)
            ]);

            const hostsMap = new Map<string, User>(hosts.map(u => [u.id, u]));
            const coHostsMap = new Map<string, User>(coHosts.map(u => [u.id, u]));

            const allUniqueIds = new Set([...hostsMap.keys(), ...coHostsMap.keys()]);
            const combined = Array.from(allUniqueIds).map(id => {
                const isHost = hostsMap.has(id);
                const isCoHost = coHostsMap.has(id);
                const user = (hostsMap.get(id) || coHostsMap.get(id))!;
                return { user, isHost, isCoHost };
            });
            setAllHosts(combined);

            const apps = await supabaseService.getLeaderApplications();
            setApplications(apps.filter(a => a.status === 'PENDING'));

        } catch (error) {
            console.error("Error fetching hosts/apps:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApproveApplication = async (app: LeaderApplication) => {
        if (!confirm(`¿Aprobar postulación de ${app.firstName}?`)) return;

        let targetUserId = app.applicantId;

        if (!targetUserId) {
            console.warn('[Approval] No applicantId found, searching by email:', app.email);
            const userByEmail = await supabaseService.getUserByEmail(app.email);
            targetUserId = userByEmail?.id;
        }

        if (targetUserId) {
            const success = await supabaseService.toggleUserRole(targetUserId, UserRole.ANFITRION, true);
            if (!success) {
                showToast('Error al asignar el rol de Anfitrión.', 'error');
                return;
            }
        } else {
            showToast(`⚠️ Usuario no encontrado en el sistema. El rol no fue asignado automáticamente. Aprueba manualmente cuando el usuario cree su cuenta.`, 'error');
        }

        await supabaseService.updateLeaderApplicationStatus(app.id, 'APPROVED');

        fetchRoleUsers();
        setViewingApp(null);
        if (targetUserId) {
            showToast(`✅ Postulación aprobada y rol de Anfitrión asignado a ${app.firstName}.`);
        }
    };

    const handleRejectApplication = async (app: LeaderApplication) => {
        if (!confirm(`¿Rechazar postulación de ${app.firstName}?`)) return;
        await supabaseService.updateLeaderApplicationStatus(app.id, 'REJECTED');
        fetchRoleUsers();
        setViewingApp(null);
    };

    useEffect(() => {
        fetchRoleUsers();
    }, []);

    // El número que muestra la pestaña Anfitriones del panel.
    useEffect(() => {
        if (allHosts.length > 0) registrarConteo('anfitriones', allHosts.length);
    }, [allHosts.length, registrarConteo]);

    // --- NEW HOST SEARCH ---
    useEffect(() => {
        if (!isNewHostModalOpen || !newHostSearchTerm.trim()) {
            setNewHostResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearchingNewHost(true);
            const results = await supabaseService.searchUsersGlobal(newHostSearchTerm);
            const existingIds = new Set(allHosts.map(h => h.user.id));
            setNewHostResults(results.filter(u => !existingIds.has(u.id)));
            setIsSearchingNewHost(false);
        }, 400);
        return () => clearTimeout(timer);
    }, [newHostSearchTerm, isNewHostModalOpen, allHosts]);

    // --- ACTIONS ---
    const handleAddRole = async (user: User, role: UserRole) => {
        const success = await supabaseService.toggleUserRole(user.id, role, true);
        if (success) {
            await fetchRoleUsers();
            setIsNewHostModalOpen(false);
            setNewHostSearchTerm('');
        } else {
            showToast('Error al asignar rol', 'error');
        }
    };

    const handleRemoveRole = async (user: User, role: 'HOST' | 'CO_HOST') => {
        if (!window.confirm(`¿Estás seguro de quitar el rol de ${role === 'HOST' ? 'Anfitrión' : 'Co-Anfitrión'} a ${user.name}?`)) return;

        const targetRole = role === 'HOST' ? UserRole.ANFITRION : UserRole.CO_ANFITRION;
        const success = await supabaseService.toggleUserRole(user.id, targetRole, false);

        if (success) {
            const group = groups.find(g =>
                (role === 'HOST' && g.host_id === user.id) ||
                (role === 'CO_HOST' && g.co_host_id === user.id)
            );

            if (group) {
                const updatePayload = { ...group };
                if (role === 'HOST') (updatePayload as any).host_id = null;
                else (updatePayload as any).co_host_id = null;
                await updateGroupDirect(updatePayload);
                onUpdate();
            }

            await fetchRoleUsers();
            showToast(`Rol de ${role === 'HOST' ? 'Anfitrión' : 'Co-Anfitrión'} quitado`);
        } else {
            showToast('Error al remover rol', 'error');
        }
    };

    const openAssignmentModal = (user: User, role: 'HOST' | 'CO_HOST') => {
        setSelectedUser(user);
        setAssignmentRole(role);
        setTargetGroupId('');
        setIsAssignmentModalOpen(true);
    };

    const unassignGroup = async (userId: string, groupId: string, roleType: 'HOST' | 'CO_HOST') => {
        if (!window.confirm(`¿Estás seguro de quitar a este usuario del grupo?`)) return;
        setIsLoading(true);
        try {
            const group = groups.find(g => g.id === groupId);
            if (group) {
                const updatePayload = { ...group };
                if (roleType === 'HOST') {
                    (updatePayload as any).host_id = null;
                    updatePayload.leaderName = '';
                    updatePayload.leaderSurname = '';
                } else {
                    (updatePayload as any).co_host_id = null;
                    updatePayload.coHostFirstName = '';
                    updatePayload.coHostLastName = '';
                }
                await updateGroupDirect(updatePayload);
                onUpdate();
            }
        } catch (err) {
            console.error(err);
            showToast('Error al quitar asignación', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveAssignment = async () => {
        if (!selectedUser) return;
        const groupToUpdate = groups.find(g => g.id === targetGroupId);
        setIsLoading(true);

        try {
            if (targetGroupId && groupToUpdate) {
                const updatePayload = { ...groupToUpdate };
                if (assignmentRole === 'HOST') {
                    (updatePayload as any).host_id = selectedUser.id;
                    const nameParts = selectedUser.name.split(' ');
                    updatePayload.leaderName = nameParts[0] || '';
                    updatePayload.leaderSurname = nameParts.slice(1).join(' ') || '';
                } else {
                    (updatePayload as any).co_host_id = selectedUser.id;
                    const nameParts = selectedUser.name.split(' ');
                    updatePayload.coHostFirstName = nameParts[0] || '';
                    updatePayload.coHostLastName = nameParts.slice(1).join(' ') || '';
                }
                await updateGroupDirect(updatePayload);
            }

            onUpdate();
            setIsAssignmentModalOpen(false);
            setTargetGroupId('');
        } catch (err) {
            console.error(err);
            showToast('Error al asignar grupo', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleRoleFromModal = async (roleType: 'HOST' | 'CO_HOST', assign: boolean) => {
        if (!manageRolesTarget) return;
        setIsLoading(true);
        try {
            const targetRole = roleType === 'HOST' ? UserRole.ANFITRION : UserRole.CO_ANFITRION;
            const success = await supabaseService.toggleUserRole(manageRolesTarget.user.id, targetRole, assign);
            if (success) {
                setManageRolesTarget(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        isHost: roleType === 'HOST' ? assign : prev.isHost,
                        isCoHost: roleType === 'CO_HOST' ? assign : prev.isCoHost
                    };
                });

                if (!assign) {
                    const group = groups.find(g =>
                        (roleType === 'HOST' && g.host_id === manageRolesTarget.user.id) ||
                        (roleType === 'CO_HOST' && g.co_host_id === manageRolesTarget.user.id)
                    );
                    if (group) {
                        const updatePayload = { ...group };
                        if (roleType === 'HOST') updatePayload.host_id = null;
                        else updatePayload.co_host_id = null;
                        await updateGroupDirect(updatePayload);
                    }
                }

                showToast(`Rol actualizado correctamente`);
                await fetchRoleUsers();
                onUpdate();
            } else {
                showToast('Error al modificar rol', 'error');
            }
        } finally {
            setIsLoading(false);
        }
    };

    // --- FILTERED DATA ---
    const filteredHosts = allHosts.filter(item => {
        const matchSearch = item.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.user.email?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchRole = roleFilter === 'ALL' ||
            (roleFilter === 'HOST' && item.isHost) ||
            (roleFilter === 'CO_HOST' && item.isCoHost);

        const assignedGroup = groups.find(g =>
            g.host_id === item.user.id || g.co_host_id === item.user.id
        );

        const matchStatus = statusFilter === 'ALL' ||
            (statusFilter === 'ASSIGNED' && !!assignedGroup) ||
            (statusFilter === 'UNASSIGNED' && !assignedGroup);

        return matchSearch && matchRole && matchStatus;
    });

    // --- ESTILOS ---
    const chip = (activo: boolean) =>
        `h-9 px-3.5 rounded-full flex items-center gap-2 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${activo ? 'bg-[#0a0a0a] text-white' : 'bg-white text-black/[.64] hover:text-[#0a0a0a]'}`;

    const botonFila = 'h-8 rounded-full px-[13px] text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-1';

    const estadoDe = (g: Group) => {
        const finalizado = g.status === 'finished' || (!!g.endDate && g.endDate < new Date().toISOString().split('T')[0]);
        if (finalizado) return { fg: 'rgba(0,0,0,.62)', dot: '#8f8f8a' };
        if (g.status === 'approved') return { fg: '#15803d', dot: '#16a34a' };
        if (g.status === 'rejected') return { fg: '#a32218', dot: '#a32218' };
        return { fg: '#7a4f10', dot: '#b45309' };
    };

    const FILTROS_ROL: { id: 'ALL' | 'HOST' | 'CO_HOST'; label: string }[] = [
        { id: 'ALL', label: 'Todos' },
        { id: 'HOST', label: 'Anfitriones' },
        { id: 'CO_HOST', label: 'Co-anfitriones' },
    ];

    const FILTROS_ESTADO: { id: 'ALL' | 'ASSIGNED' | 'UNASSIGNED'; label: string }[] = [
        { id: 'ALL', label: 'Con y sin grupo' },
        { id: 'ASSIGNED', label: 'Con grupo' },
        { id: 'UNASSIGNED', label: 'Sin grupo' },
    ];

    return (
        <>
            {/* Buscador */}
            <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex h-[42px] min-w-[180px] flex-1 items-center gap-2.5 rounded-full bg-white pl-[17px] pr-2">
                    <Search className="h-4 w-4 flex-none text-black/[.58]" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar un anfitrión"
                        aria-label="Buscar un anfitrión"
                        className="campo-desnudo min-w-0 flex-1 bg-transparent text-[13.5px] font-medium text-[#0a0a0a]"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            aria-label="Limpiar la búsqueda"
                            className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-[#f2f2f0] text-[#0a0a0a]"
                        >
                            <X className="h-[13px] w-[13px]" />
                        </button>
                    )}
                </div>
                <button
                    onClick={() => setIsNewHostModalOpen(true)}
                    className="flex h-[42px] flex-none items-center gap-2 rounded-full bg-[#0a0a0a] px-5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                >
                    <Plus className="h-[15px] w-[15px]" />
                    Sumar anfitrión
                </button>
            </div>

            {/* Filtros */}
            <div className="mt-3.5 flex flex-wrap gap-2">
                {FILTROS_ROL.map(f => (
                    <button key={f.id} onClick={() => setRoleFilter(f.id)} className={chip(roleFilter === f.id)}>
                        {f.label}
                    </button>
                ))}
                <span className="mx-1 hidden w-px bg-[#e2e2de] md:block" />
                {FILTROS_ESTADO.map(f => (
                    <button key={f.id} onClick={() => setStatusFilter(f.id)} className={chip(statusFilter === f.id)}>
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Postulaciones pendientes */}
            {applications.length > 0 && (
                <div className="mt-3.5 overflow-hidden rounded-[18px] bg-white">
                    <div className="flex items-center gap-2.5 border-b border-[#f0efec] bg-[#fafaf9] px-[18px] py-[11px]">
                        <span className="h-[7px] w-[7px] rounded-full bg-[#b45309]" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-black/[.6]">
                            Se postularon para ser anfitriones
                        </span>
                        <span className="flex h-[21px] items-center rounded-full bg-[#fdf0dc] px-2 text-[11.5px] font-semibold text-[#7a4f10]">
                            {applications.length}
                        </span>
                    </div>
                    {applications.map(app => (
                        <div key={app.id} className="flex flex-wrap items-center gap-3.5 border-b border-[#f4f3f1] px-[18px] py-[13px] last:border-b-0">
                            <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-[#f2f2f0] text-[12.5px] font-semibold text-black/[.62]">
                                {iniciales(`${app.firstName} ${app.lastName}`)}
                            </div>
                            <div className="min-w-[130px] flex-1">
                                <p className="text-[13.5px] font-semibold text-[#0a0a0a]">{app.firstName} {app.lastName}</p>
                                <p className="mt-0.5 text-[11.5px] font-medium text-black/[.62]">{app.email} · {app.phone}</p>
                            </div>
                            <div className="flex flex-none gap-[7px]">
                                <button onClick={() => setViewingApp(app)} className={`${botonFila} bg-[#f2f2f0] text-black/[.66]`}>
                                    Ver la postulación
                                </button>
                                <button onClick={() => handleApproveApplication(app)} className={`${botonFila} bg-[#e9f6ed] text-[#15803d]`}>
                                    Aprobar
                                </button>
                                <button onClick={() => handleRejectApplication(app)} className={`${botonFila} bg-[#fdecea] text-[#a32218]`}>
                                    Rechazar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Anfitriones */}
            {isLoading && allHosts.length === 0 ? (
                <div className="mt-3.5 flex justify-center rounded-[20px] bg-white py-20">
                    <Loader2 className="h-7 w-7 animate-spin text-black/20" />
                </div>
            ) : filteredHosts.length === 0 ? (
                <div className="mt-3.5 flex flex-col items-center rounded-[20px] bg-white px-8 py-14 text-center">
                    <div className="h-[88px] w-[88px] rounded-full" style={{ background: 'repeating-linear-gradient(135deg,#eceae6 0 8px,#e3e1dc 8px 16px)' }} />
                    <p className="mt-[22px] text-[17px] font-semibold text-[#0a0a0a]">Ningún anfitrión coincide</p>
                    <p className="mt-[9px] max-w-[340px] text-[13.5px] font-medium leading-[1.6] text-black/[.62]">
                        Probá con otro filtro, o sumá a alguien nuevo con el botón de arriba.
                    </p>
                </div>
            ) : (
                <div className="mt-3.5 overflow-hidden rounded-[18px] bg-white">
                    {filteredHosts.map(item => {
                        const { user, isHost, isCoHost } = item;
                        const asignados = groups.filter(g => g.host_id === user.id || g.co_host_id === user.id);
                        return (
                            <div key={user.id} className="flex flex-wrap items-center gap-3.5 border-b border-[#f4f3f1] px-[18px] py-[13px] last:border-b-0">
                                <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-[#f2f2f0] text-[12.5px] font-semibold text-black/[.62]">
                                    {iniciales(user.name)}
                                </div>

                                <div className="min-w-[130px] flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-[13.5px] font-semibold text-[#0a0a0a]">{user.name}</p>
                                        <button
                                            onClick={() => { setManageRolesTarget({ user, isHost, isCoHost }); setManageRolesModalOpen(true); }}
                                            title="Administrar los roles de esta persona"
                                            className="flex h-[22px] items-center rounded-full bg-[#f2f2f0] px-2.5 text-[11px] font-semibold text-black/[.62] transition-colors hover:text-[#0a0a0a]"
                                        >
                                            {isHost && isCoHost ? 'Anfitrión y co-anfitrión' : isHost ? 'Anfitrión' : isCoHost ? 'Co-anfitrión' : 'Sin rol'}
                                        </button>
                                    </div>
                                    <p className="mt-0.5 text-[11.5px] font-medium text-black/[.62]">{user.email}{user.phone ? ` · ${user.phone}` : ''}</p>
                                </div>

                                <div className="min-w-[150px] flex-1">
                                    {asignados.length === 0 ? (
                                        <span className="text-[12.5px] font-medium text-black/[.5]">Todavía no lidera ningún grupo</span>
                                    ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                            {asignados.map(g => {
                                                const e = estadoDe(g);
                                                return (
                                                    <span key={g.id} className="flex h-[26px] items-center gap-1.5 rounded-full bg-[#f7f7f5] pl-2.5 pr-1 text-[12px] font-semibold" style={{ color: e.fg }}>
                                                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: e.dot }} />
                                                        {g.name}
                                                        <button
                                                            onClick={() => unassignGroup(user.id, g.id, g.host_id === user.id ? 'HOST' : 'CO_HOST')}
                                                            aria-label={`Sacar a ${user.name} de ${g.name}`}
                                                            className="flex h-5 w-5 items-center justify-center rounded-full text-black/[.45] transition-colors hover:bg-[#fdecea] hover:text-[#a32218]"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-none gap-[7px]">
                                    <button
                                        onClick={() => openAssignmentModal(user, isHost ? 'HOST' : 'CO_HOST')}
                                        className={`${botonFila} bg-[#f2f2f0] text-black/[.66]`}
                                    >
                                        Asignar grupo
                                    </button>
                                    <button
                                        onClick={() => handleRemoveRole(user, isHost ? 'HOST' : 'CO_HOST')}
                                        className={`${botonFila} bg-[#fdecea] text-[#a32218]`}
                                    >
                                        Quitar
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    <div className="bg-[#fcfcfb] px-[18px] py-[13px] text-[12.5px] font-medium text-black/[.62]">
                        {filteredHosts.length} de {allHosts.length} personas con rol de anfitrión o co-anfitrión.
                    </div>
                </div>
            )}

            {/* Asignar a un grupo */}
            <ModalPanelGCX
                isOpen={isAssignmentModalOpen}
                onClose={() => setIsAssignmentModalOpen(false)}
                titulo="Asignar a un grupo"
                subtitulo={selectedUser ? `${selectedUser.name} queda como ${assignmentRole === 'HOST' ? 'anfitrión' : 'co-anfitrión'} y conserva sus otros grupos.` : undefined}
                pie={
                    <>
                        <BotonSecundario onClick={() => setIsAssignmentModalOpen(false)}>Cancelar</BotonSecundario>
                        <BotonPrincipal onClick={handleSaveAssignment} disabled={isLoading || !targetGroupId}>
                            {isLoading ? 'Guardando…' : 'Asignar el grupo'}
                        </BotonPrincipal>
                    </>
                }
            >
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.06em] text-black/[.58]">Grupo</label>
                <select
                    value={targetGroupId}
                    onChange={(e) => setTargetGroupId(e.target.value)}
                    className="h-[58px] w-full px-[17px]"
                >
                    <option value="">Elegí un grupo</option>
                    {groups.filter(g => g.status === 'approved' && (!g.endDate || g.endDate >= new Date().toISOString().split('T')[0])).map(g => (
                        <option key={g.id} value={g.id}>{g.name} — {g.meetingDay} {g.meetingTime}</option>
                    ))}
                </select>
                <p className="mt-3 text-[12.5px] font-medium leading-[1.55] text-black/[.62]">
                    Solo aparecen los grupos aprobados que siguen activos.
                </p>
            </ModalPanelGCX>

            {/* Roles */}
            <ModalPanelGCX
                isOpen={manageRolesModalOpen}
                onClose={() => setManageRolesModalOpen(false)}
                titulo="Roles de la persona"
                subtitulo={manageRolesTarget ? `${manageRolesTarget.user.name} puede tener los dos roles a la vez.` : undefined}
                pie={<BotonPrincipal onClick={() => setManageRolesModalOpen(false)}>Listo</BotonPrincipal>}
            >
                {manageRolesTarget && (
                    <div className="flex flex-col gap-2">
                        {([['HOST', 'Anfitrión', manageRolesTarget.isHost], ['CO_HOST', 'Co-anfitrión', manageRolesTarget.isCoHost]] as const).map(([tipo, label, activo]) => (
                            <button
                                key={tipo}
                                onClick={() => handleToggleRoleFromModal(tipo, !activo)}
                                disabled={isLoading}
                                className="flex h-[58px] items-center gap-3 rounded-[18px] bg-[#f7f7f5] px-[17px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                            >
                                <span className="flex-1 text-[14.5px] font-semibold text-[#0a0a0a]">{label}</span>
                                <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${activo ? 'bg-[#0a0a0a]' : 'bg-[#dcdcd8]'}`}>
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${activo ? 'translate-x-6' : 'translate-x-1'}`} />
                                </span>
                            </button>
                        ))}
                        <p className="mt-1 text-[12.5px] font-medium leading-[1.55] text-black/[.62]">
                            Al quitar un rol, la persona también sale del grupo que lideraba con ese rol.
                        </p>
                    </div>
                )}
            </ModalPanelGCX>

            {/* Sumar anfitrión */}
            <ModalPanelGCX
                isOpen={isNewHostModalOpen}
                onClose={() => setIsNewHostModalOpen(false)}
                titulo="Sumar un anfitrión"
                subtitulo="Buscá a la persona y elegí con qué rol entra."
            >
                <div className="flex h-[52px] items-center gap-2.5 rounded-[18px] bg-[#f7f7f5] px-[17px]">
                    <Search className="h-4 w-4 flex-none text-black/[.58]" />
                    <input
                        type="text"
                        value={newHostSearchTerm}
                        onChange={(e) => setNewHostSearchTerm(e.target.value)}
                        placeholder="Buscar por nombre o email"
                        autoFocus
                        className="campo-desnudo min-w-0 flex-1 bg-transparent text-[14.5px] font-medium text-[#0a0a0a]"
                    />
                    {isSearchingNewHost && <Loader2 className="h-4 w-4 flex-none animate-spin text-black/30" />}
                </div>

                <div className="mt-3 min-h-[180px] pb-4">
                    {newHostResults.length === 0 && newHostSearchTerm && !isSearchingNewHost && (
                        <p className="py-6 text-center text-[13px] font-medium text-black/[.55]">
                            Nadie coincide con esa búsqueda.
                        </p>
                    )}
                    {newHostResults.map(u => (
                        <div key={u.id} className="flex flex-wrap items-center gap-3 border-b border-[#f4f3f1] py-3 last:border-b-0">
                            <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-[#f2f2f0] text-[12.5px] font-semibold text-black/[.62]">
                                {iniciales(u.name)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[13.5px] font-semibold text-[#0a0a0a]">{u.name}</p>
                                <p className="truncate text-[11.5px] font-medium text-black/[.62]">{u.email}</p>
                            </div>
                            <div className="flex flex-none gap-[7px]">
                                <button onClick={() => handleAddRole(u, UserRole.ANFITRION)} className={`${botonFila} bg-[#0a0a0a] text-white`}>
                                    Anfitrión
                                </button>
                                <button onClick={() => handleAddRole(u, UserRole.CO_ANFITRION)} className={`${botonFila} bg-[#f2f2f0] text-black/[.66]`}>
                                    Co-anfitrión
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </ModalPanelGCX>

            {/* Detalle de una postulación */}
            <ModalPanelGCX
                isOpen={!!viewingApp}
                onClose={() => setViewingApp(null)}
                titulo={viewingApp ? `${viewingApp.firstName} ${viewingApp.lastName}` : ''}
                subtitulo={viewingApp ? `${viewingApp.email} · ${viewingApp.phone}` : undefined}
                pie={
                    viewingApp ? (
                        <>
                            <BotonSecundario
                                onClick={() => handleRejectApplication(viewingApp)}
                                className="bg-[#fdecea] text-[#a32218]"
                            >
                                Rechazar
                            </BotonSecundario>
                            <BotonPrincipal onClick={() => handleApproveApplication(viewingApp)}>
                                Aprobar y darle el rol
                            </BotonPrincipal>
                        </>
                    ) : undefined
                }
            >
                {viewingApp && (
                    <div className="flex flex-col gap-2 pb-1">
                        {([
                            ['Asiste a Origen', viewingApp.attendsOrigen],
                            ['Hizo Crecer', viewingApp.completedHicisteCrecer],
                            ['Hizo el entrenamiento de voluntarios', viewingApp.completedVolunteerTraining],
                            ['Hizo el curso de líder', viewingApp.completedLeaderCourse],
                        ] as const).map(([label, ok]) => (
                            <div key={label} className="flex h-[52px] items-center gap-3 rounded-[18px] bg-[#f7f7f5] px-[17px]">
                                <span className="flex-1 text-[14px] font-semibold text-[#0a0a0a]">{label}</span>
                                <span
                                    className="flex h-[26px] items-center rounded-full px-[11px] text-[11.5px] font-semibold"
                                    style={ok ? { background: '#e9f6ed', color: '#15803d' } : { background: '#f0efec', color: 'rgba(0,0,0,.62)' }}
                                >
                                    {ok ? 'Sí' : 'No'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </ModalPanelGCX>
        </>
    );
};

export default HostsManagementPanel;
