
import React, { useState, useEffect } from 'react';
import { User, UserRole, Group, LeaderApplication } from '../../types';
import { supabaseService, updateGroupDirect } from '../../services/supabaseService';
import { Search, Shield, UserPlus, Users, X, ChevronRight, Check, AlertCircle, Loader2, MoreVertical, UserCheck, Home, Filter, Trash2, Edit2, ArrowRight, Plus } from 'lucide-react';
import NeoModal from '../ui/NeoModal';

interface HostsManagementPanelProps {
    groups: Group[]; // Pass available groups for assignment
    onUpdate: () => void; // Callback to refresh data (e.g. groups list)
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const HostsManagementPanel: React.FC<HostsManagementPanelProps> = ({ groups, onUpdate, showToast }) => {
    const [isLoading, setIsLoading] = useState(false);

    // --- DATA STATE ---
    const [allHosts, setAllHosts] = useState<{ user: User, isHost: boolean, isCoHost: boolean }[]>([]);

    // --- FILTERS STATE ---
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<'ALL' | 'HOST' | 'CO_HOST'>('ALL');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED'>('ALL');

    // UI State for popover menus
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

    // Modal State
    const [isAddHostModalOpen, setIsAddHostModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
    const [targetGroupId, setTargetGroupId] = useState<string>('');
    const [assignmentRole, setAssignmentRole] = useState<'HOST' | 'CO_HOST'>('HOST');

    // --- NEW HOST MODAL STATE ---
    const [isNewHostModalOpen, setIsNewHostModalOpen] = useState(false);
    const [newHostSearchTerm, setNewHostSearchTerm] = useState('');
    const [newHostResults, setNewHostResults] = useState<User[]>([]);
    const [isSearchingNewHost, setIsSearchingNewHost] = useState(false);


    // --- APPLICATIONS STATE ---
    const [applications, setApplications] = useState<LeaderApplication[]>([]);
    const [viewingApp, setViewingApp] = useState<LeaderApplication | null>(null);

    // --- ROLE CHANGE MODAL STATE ---
    const [manageRolesModalOpen, setManageRolesModalOpen] = useState(false);
    const [manageRolesTarget, setManageRolesTarget] = useState<{ user: User, isHost: boolean, isCoHost: boolean } | null>(null);

    // --- MOBILE TAB STATE ---
    const [mobileTab, setMobileTab] = useState<'hosts' | 'applications'>('hosts');

    // --- FETCH DATA ---
    const fetchRoleUsers = async () => {
        setIsLoading(true);
        try {
            const [hosts, coHosts] = await Promise.all([
                supabaseService.getUsersByRole(UserRole.ANFITRION),
                supabaseService.getUsersByRole(UserRole.CO_ANFITRION)
            ]);

            // Combine into unified list tracking both roles
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

            // Fetch Applications
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

        // 1. Resolve the userId to assign the role to
        let targetUserId = app.applicantId;

        if (!targetUserId) {
            // Fallback: try to find the user by email
            console.warn('[Approval] No applicantId found, searching by email:', app.email);
            const userByEmail = await supabaseService.getUserByEmail(app.email);
            targetUserId = userByEmail?.id;
        }

        if (targetUserId) {
            // 2. Assign Role
            const success = await supabaseService.toggleUserRole(targetUserId, UserRole.ANFITRION, true);
            if (!success) {
                showToast('Error al asignar el rol de Anfitrión.', 'error');
                return;
            }
        } else {
            // No user account found — inform admin but still approve the application
            showToast(`⚠️ Usuario no encontrado en el sistema. El rol no fue asignado automáticamente. Aprueba manualmente cuando el usuario cree su cuenta.`, 'error');
        }

        // 3. Update Application Status
        await supabaseService.updateLeaderApplicationStatus(app.id, 'APPROVED');

        // Refresh
        fetchRoleUsers();
        setViewingApp(null);
        if (targetUserId) {
            showToast(`✅ Postulación aprobada y rol de Anfitrión asignado a ${app.firstName}.`);
        }
    };

    const handleRejectApplication = async (app: LeaderApplication) => {
        if (!confirm(`¿Rechazar postulación de ${app.firstName}?`)) return;
        await supabaseService.updateLeaderApplicationStatus(app.id, 'REJECTED');
        // Refresh
        fetchRoleUsers();
        setViewingApp(null);
    };


    useEffect(() => {
        fetchRoleUsers();
    }, []);

    // --- NEW HOST SEARCH ---
    useEffect(() => {
        if (!isNewHostModalOpen || !newHostSearchTerm.trim()) {
            setNewHostResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearchingNewHost(true);
            const results = await supabaseService.searchUsersGlobal(newHostSearchTerm);
            // Filter out users who are already hosts/co-hosts
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
            alert('Error al asignar rol');
        }
    };

    const handleRemoveRole = async (user: User, role: 'HOST' | 'CO_HOST') => {
        if (!window.confirm(`¿Estás seguro de quitar el rol de ${role === 'HOST' ? 'Anfitrión' : 'Co-Anfitrión'} a ${user.name}?`)) return;

        const targetRole = role === 'HOST' ? UserRole.ANFITRION : UserRole.CO_ANFITRION;
        const success = await supabaseService.toggleUserRole(user.id, targetRole, false);

        if (success) {
            // Also need to unassign from group if they have one?
            // Ideally backend handles this trigger, but we can do it manually here for safety
            const group = groups.find(g =>
                (role === 'HOST' && g.host_id === user.id) ||
                (role === 'CO_HOST' && g.co_host_id === user.id)
            );

            if (group) {
                const updatePayload = { ...group };
                if (role === 'HOST') (updatePayload as any).host_id = null;
                else (updatePayload as any).co_host_id = null;
                await updateGroupDirect(updatePayload);
                onUpdate(); // refresh groups
            }

            await fetchRoleUsers();
        } else {
            alert('Error al remover rol');
        }
    };

    const openAssignmentModal = (user: User, role: 'HOST' | 'CO_HOST') => {
        setSelectedUser(user);
        setAssignmentRole(role);
        setTargetGroupId(''); // Reset since we are just adding a new group
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
                onUpdate(); // refresh groups
            }
        } catch (err) {
            console.error(err);
            alert('Error al quitar asignación');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveAssignment = async () => {
        if (!selectedUser) return;
        const groupToUpdate = groups.find(g => g.id === targetGroupId);
        setIsLoading(true);

        try {
            // We now support multiple groups, so we simply add the new assignment
            // without removing them from previous groups.
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
            setTargetGroupId(''); // reset
        } catch (err) {
            console.error(err);
            alert('Error al asignar grupo');
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

                // Cleanup groups if removed
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

    // --- RENDER ---
    return (
        <div className="flex flex-col gap-6 items-start">

            {/* --- MOBILE TAB BAR --- */}
            <div className="lg:hidden w-full flex bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden">
                <button
                    onClick={() => setMobileTab('hosts')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black uppercase tracking-wider transition-all ${mobileTab === 'hosts'
                        ? 'bg-black text-white'
                        : 'bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                >
                    <Shield className="w-4 h-4" />
                    Anfitriones
                    <span className={`px-1.5 py-0.5 text-[9px] font-black rounded-full ${mobileTab === 'hosts' ? 'bg-white text-black' : 'bg-slate-200 text-slate-600'
                        }`}>{allHosts.length}</span>
                </button>
                <div className="w-0.5 bg-black" />
                <button
                    onClick={() => setMobileTab('applications')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black uppercase tracking-wider transition-all ${mobileTab === 'applications'
                        ? 'bg-black text-white'
                        : 'bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                >
                    {applications.length > 0 && <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>}
                    Solicitudes
                    {applications.length > 0 && (
                        <span className={`px-1.5 py-0.5 text-[9px] font-black rounded-full ${mobileTab === 'applications' ? 'bg-white text-black' : 'bg-red-100 text-red-700'
                            }`}>{applications.length}</span>
                    )}
                </button>
            </div>

            {/* --- COLUMNS WRAPPER --- */}
            <div className="flex flex-col lg:flex-row gap-6 w-full items-start">

                {/* --- LEFT COLUMN: HOSTS PANEL --- */}
                <div className={`flex-1 w-full min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${mobileTab === 'hosts' ? 'block' : 'hidden lg:block'
                    }`}>

                    {/* TOOLBAR */}
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row gap-4 justify-between items-center rounded-t-xl">
                        <div className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-slate-700" />
                            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Gestión de Anfitriones</h2>
                            <span className="bg-slate-900 text-white px-2 py-0.5 text-xs rounded-full font-bold">{allHosts.length}</span>
                        </div>

                        <div className="flex flex-wrap gap-2 w-full md:w-auto">
                            {/* SEARCH */}
                            <div className="relative flex-1 md:w-52 lg:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-50 transition-all"
                                />
                            </div>

                            {/* ROLE FILTER */}
                            <select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value as any)}
                                className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg bg-white outline-none focus:border-slate-400 transition-all"
                            >
                                <option value="ALL">Todos los Roles</option>
                                <option value="HOST">Solo Anfitriones</option>
                                <option value="CO_HOST">Solo Co-Anfitriones</option>
                            </select>

                            {/* STATUS FILTER */}
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg bg-white outline-none focus:border-slate-400 transition-all"
                            >
                                <option value="ALL">Todos los Estados</option>
                                <option value="ASSIGNED">Con Grupo</option>
                                <option value="UNASSIGNED">Sin Grupo</option>
                            </select>

                            {/* NEW BUTTON */}
                            <button
                                onClick={() => setIsNewHostModalOpen(true)}
                                className="bg-slate-900 text-white px-4 py-2 text-xs font-semibold rounded-lg hover:bg-black transition-colors flex items-center gap-2"
                            >
                                <UserPlus className="w-4 h-4" />
                                <span className="hidden sm:inline">Nuevo</span>
                            </button>
                        </div>
                    </div>

                    {/* Loading / Empty */}
                    {isLoading ? (
                        <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
                    ) : filteredHosts.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 text-sm font-medium italic">
                            No se encontraron resultados
                        </div>
                    ) : (
                        <>
                            {/* Mobile Card View */}
                            <div className="md:hidden space-y-3 p-4">
                                {filteredHosts.map(item => {
                                    const { user, isHost, isCoHost } = item;
                                    const assignedGroups = groups.filter(g => g.host_id === user.id || g.co_host_id === user.id);
                                    const isMenuOpen = activeMenuId === user.id;

                                    return (
                                        <div key={user.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(isHost || (!isHost && !isCoHost)) && (
                                                        <button
                                                            onClick={() => { setManageRolesTarget({ user, isHost, isCoHost }); setManageRolesModalOpen(true); }}
                                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide border ${isHost ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}
                                                        >
                                                            Anfitrión
                                                        </button>
                                                    )}
                                                    {isCoHost && (
                                                        <button
                                                            onClick={() => { setManageRolesTarget({ user, isHost, isCoHost }); setManageRolesModalOpen(true); }}
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide bg-slate-100 text-slate-500 border border-slate-200"
                                                        >
                                                            Co-Anfitrión
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="relative">
                                                    <button
                                                        onClick={() => setActiveMenuId(isMenuOpen ? null : user.id)}
                                                        className={`p-1.5 rounded-lg transition-colors ${isMenuOpen ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-black hover:bg-slate-100'}`}
                                                    >
                                                        <MoreVertical className="w-4 h-4" />
                                                    </button>
                                                    {isMenuOpen && (
                                                        <>
                                                            <div className="fixed inset-0 z-40" onClick={() => setActiveMenuId(null)} />
                                                            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                                                                <button onClick={() => { openAssignmentModal(user, isHost ? 'HOST' : 'CO_HOST'); setActiveMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100">
                                                                    <Edit2 className="w-3.5 h-3.5" /> Editar asignación
                                                                </button>
                                                                <button onClick={() => { setManageRolesTarget({ user, isHost, isCoHost }); setManageRolesModalOpen(true); setActiveMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                                                    <Shield className="w-3.5 h-3.5" /> Administrar roles
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <h4 className="font-semibold text-slate-900 text-sm truncate">{user.name}</h4>
                                            <p className="text-[11px] text-slate-400 truncate">{user.email}</p>

                                            <div className="mt-3 pt-3 border-t border-slate-100">
                                                <p className="text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1.5">Grupo asignado</p>
                                                {assignedGroups.length === 0 ? (
                                                    <p className="text-xs text-slate-400 italic">Sin grupo asignado</p>
                                                ) : (
                                                    <div className="space-y-1.5">
                                                        {assignedGroups.map(assignedGroup => {
                                                            let statusBadge = 'bg-amber-50 text-amber-700 border-amber-200';
                                                            let statusText = 'Pendiente';
                                                            const isFinished = assignedGroup.status === 'finished' || (assignedGroup.endDate && assignedGroup.endDate < new Date().toISOString().split('T')[0]);
                                                            if (isFinished) { statusBadge = 'bg-slate-100 text-slate-500 border-slate-200'; statusText = 'Finalizado'; }
                                                            else if (assignedGroup.status === 'approved') { statusBadge = 'bg-emerald-50 text-emerald-700 border-emerald-200'; statusText = 'Activo'; }
                                                            else if (assignedGroup.status === 'rejected') { statusBadge = 'bg-red-50 text-red-600 border-red-200'; statusText = 'Rechazado'; }

                                                            return (
                                                                <div key={assignedGroup.id} className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg px-2.5 py-1.5">
                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="text-xs font-semibold text-slate-800 truncate">{assignedGroup.name}</span>
                                                                            <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${statusBadge}`}>{statusText}</span>
                                                                        </div>
                                                                        <p className="text-[10px] text-slate-400">
                                                                            {assignedGroup.host_id === user.id ? 'Anfitrión' : 'Co-Anfitrión'} · {assignedGroup.meetingDay} {assignedGroup.meetingTime}
                                                                        </p>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => unassignGroup(user.id, assignedGroup.id, assignedGroup.host_id === user.id ? 'HOST' : 'CO_HOST')}
                                                                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors shrink-0"
                                                                    >
                                                                        <X className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                <button
                                                    onClick={() => openAssignmentModal(user, isHost ? 'HOST' : 'CO_HOST')}
                                                    className="mt-2 text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                    {assignedGroups.length > 0 ? 'Asignar a otro grupo' : 'Asignar a un grupo'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block p-4">
                                <div className="rounded-xl border border-slate-200 overflow-hidden">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 w-64">Usuario</th>
                                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 w-40 text-center">Rol</th>
                                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Grupo Asignado</th>
                                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right w-28">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredHosts.map(item => {
                                                const { user, isHost, isCoHost } = item;
                                                const assignedGroups = groups.filter(g => g.host_id === user.id || g.co_host_id === user.id);

                                                return (
                                                    <tr key={user.id} className="hover:bg-slate-50/80 transition-colors align-top">
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${isHost ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                                                                    {user.name.charAt(0)}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="font-semibold text-sm text-slate-900 truncate">{user.name}</p>
                                                                    <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-wrap justify-center gap-1.5">
                                                                {(isHost || (!isHost && !isCoHost)) && (
                                                                    <button
                                                                        onClick={() => { setManageRolesTarget({ user, isHost, isCoHost }); setManageRolesModalOpen(true); }}
                                                                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide border transition-colors ${isHost ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`}
                                                                    >
                                                                        Anfitrión
                                                                    </button>
                                                                )}
                                                                {isCoHost && (
                                                                    <button
                                                                        onClick={() => { setManageRolesTarget({ user, isHost, isCoHost }); setManageRolesModalOpen(true); }}
                                                                        className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200 transition-colors"
                                                                    >
                                                                        Co-Anfitrión
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>

                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-col gap-1.5">
                                                                {assignedGroups.length === 0 && (
                                                                    <span className="text-xs text-slate-400 italic">Sin grupo asignado</span>
                                                                )}
                                                                {assignedGroups.map(assignedGroup => {
                                                                    let statusBadge = 'bg-amber-50 text-amber-700 border-amber-200';
                                                                    let statusText = 'Pendiente';
                                                                    const isFinished = assignedGroup.status === 'finished' || (assignedGroup.endDate && assignedGroup.endDate < new Date().toISOString().split('T')[0]);
                                                                    if (isFinished) { statusBadge = 'bg-slate-100 text-slate-500 border-slate-200'; statusText = 'Finalizado'; }
                                                                    else if (assignedGroup.status === 'approved') { statusBadge = 'bg-emerald-50 text-emerald-700 border-emerald-200'; statusText = 'Activo'; }
                                                                    else if (assignedGroup.status === 'rejected') { statusBadge = 'bg-red-50 text-red-600 border-red-200'; statusText = 'Rechazado'; }

                                                                    return (
                                                                        <div key={assignedGroup.id} className="group/item flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-all w-full">
                                                                            <div className="min-w-0 flex-1">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <p className="text-xs font-semibold text-slate-800 truncate">{assignedGroup.name}</p>
                                                                                    <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${statusBadge}`}>{statusText}</span>
                                                                                </div>
                                                                                <p className="text-[10px] text-slate-400">
                                                                                    {assignedGroup.host_id === user.id ? 'Anfitrión' : 'Co-Anfitrión'} · {assignedGroup.meetingDay} {assignedGroup.meetingTime}
                                                                                </p>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => unassignGroup(user.id, assignedGroup.id, assignedGroup.host_id === user.id ? 'HOST' : 'CO_HOST')}
                                                                                className="opacity-0 group-hover/item:opacity-100 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all shrink-0"
                                                                            >
                                                                                <X className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    );
                                                                })}
                                                                <button
                                                                    onClick={() => openAssignmentModal(user, isHost ? 'HOST' : 'CO_HOST')}
                                                                    className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1 w-max"
                                                                >
                                                                    <Plus className="w-3 h-3" />
                                                                    {assignedGroups.length > 0 ? 'Asignar otro' : 'Asignar a un grupo'}
                                                                </button>
                                                            </div>
                                                        </td>

                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex justify-end items-center gap-1">
                                                                <button
                                                                    onClick={() => openAssignmentModal(user, isHost ? 'HOST' : 'CO_HOST')}
                                                                    className="p-1.5 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                                                                    title="Editar asignación"
                                                                >
                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => { setManageRolesTarget({ user, isHost, isCoHost }); setManageRolesModalOpen(true); }}
                                                                    className="p-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
                                                                    title="Administrar roles"
                                                                >
                                                                    <Shield className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* --- RIGHT COLUMN: APPLICATIONS SIDEBAR --- */}
                <div className={`w-full lg:w-80 xl:w-96 shrink-0 space-y-4 ${mobileTab === 'applications' ? 'block' : 'hidden lg:block'
                    }`}>
                    <div className="bg-white rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                        <div className="bg-yellow-100 p-4 border-b-2 border-black flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                                <h3 className="font-black uppercase text-sm tracking-wide">Solicitudes Pendientes</h3>
                            </div>
                            <span className="bg-black text-white px-2 py-0.5 text-xs rounded-full font-bold">{applications.length}</span>
                        </div>

                        <div className="max-h-[600px] lg:max-h-[700px] xl:max-h-[800px] overflow-y-auto divide-y divide-slate-100">
                            {applications.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-xs font-medium italic">
                                    No hay nuevas solicitudes.
                                </div>
                            ) : (
                                applications.map(app => (
                                    <div key={app.id} className="p-4 hover:bg-slate-50 transition-colors group relative">
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <h4 className="font-bold text-xs uppercase text-slate-900">{app.firstName} {app.lastName}</h4>
                                                <p className="text-[10px] text-slate-500 mt-0.5">{app.email}</p>
                                                <p className="text-[10px] text-slate-500">{app.phone}</p>
                                            </div>
                                            <button
                                                onClick={() => setViewingApp(app)}
                                                className="px-2 py-1 bg-white border border-slate-200 text-[9px] font-bold uppercase rounded hover:bg-black hover:text-white transition-colors"
                                            >
                                                Ver
                                            </button>
                                        </div>

                                        <div className="flex gap-2 mt-3">
                                            <button
                                                onClick={() => handleRejectApplication(app)}
                                                className="flex-1 py-1.5 border border-slate-200 text-red-600 text-[10px] font-black uppercase rounded hover:bg-red-50 transition-colors"
                                            >
                                                Rechazar
                                            </button>
                                            <button
                                                onClick={() => handleApproveApplication(app)}
                                                className="flex-1 py-1.5 bg-black text-white border border-black text-[10px] font-black uppercase rounded hover:bg-zinc-800 transition-colors shadow-sm"
                                            >
                                                Aprobar
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>


                {/* --- MODALS --- */}

                {/* ASSIGNMENT MODAL (Reused logic) */}
                <NeoModal isOpen={isAssignmentModalOpen} onClose={() => setIsAssignmentModalOpen(false)} title="Asignar Grupo">
                    <div className="space-y-6">
                        <div className="bg-slate-50 border-2 border-black p-4 flex items-center gap-4">
                            <div className="w-12 h-12 bg-black text-white flex items-center justify-center font-black text-xl border-2 border-white shadow-lg">
                                {selectedUser?.name.charAt(0)}
                            </div>
                            <div>
                                <div className="text-xs uppercase font-bold text-slate-500">Editando {assignmentRole === 'HOST' ? 'Anfitrión' : 'Co-Anfitrión'}</div>
                                <div className="text-lg font-black uppercase">{selectedUser?.name}</div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase mb-2">Seleccionar Grupo</label>
                            <select
                                value={targetGroupId}
                                onChange={(e) => setTargetGroupId(e.target.value)}
                                className="w-full bg-white border-2 border-black p-3 font-bold outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase text-xs"
                            >
                                <option value="">-- Sin asignar (Ninguno) --</option>
                                {groups.filter(g => g.status === 'approved' && (!g.endDate || g.endDate >= new Date().toISOString().split('T')[0])).map(g => (
                                    <option key={g.id} value={g.id}>
                                        {g.name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-[10px] text-slate-500 mt-2 flex items-start gap-1">
                                <AlertCircle className="w-3 h-3 shrink-0" />
                                <span>Al guardar, este usuario será asignado como {assignmentRole === 'HOST' ? 'Anfitrión' : 'Co-Anfitrión'} a este nuevo grupo, conservando sus otras asignaciones si las tuviera.</span>
                            </p>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t-2 border-slate-100">
                            <button onClick={() => setIsAssignmentModalOpen(false)} className="px-4 py-2 text-xs font-bold uppercase hover:bg-slate-100">Cancelar</button>
                            <button onClick={handleSaveAssignment} disabled={isLoading} className="bg-black text-white px-6 py-2 border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all">
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </NeoModal>

                {/* MANAGE ROLES MODAL */}
                <NeoModal isOpen={manageRolesModalOpen} onClose={() => setManageRolesModalOpen(false)} title="Administrar Roles">
                    <div className="space-y-6">
                        {manageRolesTarget && (
                            <>
                                <div className="bg-slate-50 border-2 border-black p-4 flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center font-black text-xl border-2 border-black text-black">
                                        {manageRolesTarget.user.name.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black uppercase text-slate-500 mb-0.5">Usuario</div>
                                        <div className="text-lg font-black uppercase leading-none">{manageRolesTarget.user.name}</div>
                                    </div>
                                </div>

                                <div className="space-y-4 py-2">
                                    <p className="text-sm font-medium text-slate-600 text-center">
                                        Puedes asignar múltiples roles al mismo usuario. Activa o desactiva los roles según corresponda.
                                    </p>

                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between p-4 border-2 border-black rounded-xl cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleToggleRoleFromModal('HOST', !manageRolesTarget.isHost)}>
                                            <div className="flex items-center gap-3">
                                                <Shield className="w-5 h-5 text-yellow-600" />
                                                <span className="font-black uppercase text-sm">Anfitrión</span>
                                            </div>
                                            <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${manageRolesTarget.isHost ? 'bg-black' : 'bg-slate-300'}`}>
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${manageRolesTarget.isHost ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between p-4 border-2 border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleToggleRoleFromModal('CO_HOST', !manageRolesTarget.isCoHost)}>
                                            <div className="flex items-center gap-3">
                                                <Shield className="w-5 h-5 text-slate-500" />
                                                <span className="font-black uppercase text-sm text-slate-700">Co-Anfitrión</span>
                                            </div>
                                            <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${manageRolesTarget.isCoHost ? 'bg-black' : 'bg-slate-300'}`}>
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${manageRolesTarget.isCoHost ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t-2 border-slate-100">
                                    <button
                                        onClick={() => setManageRolesModalOpen(false)}
                                        className="px-6 py-2 bg-black text-white text-xs font-black uppercase rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </NeoModal>

                {/* NEW HOST MODAL (Original) */}
                <NeoModal isOpen={isNewHostModalOpen} onClose={() => setIsNewHostModalOpen(false)} title="Nuevo Anfitrión">
                    <div className="space-y-6">
                        <p className="text-sm text-slate-600">Busca a una persona para darle privilegios de Anfitrión o Co-Anfitrión.</p>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar persona por nombre..."
                                value={newHostSearchTerm}
                                onChange={(e) => setNewHostSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-3 border-2 border-black font-bold outline-none uppercase text-sm"
                                autoFocus
                            />
                            {isSearchingNewHost && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin" />}
                        </div>

                        <div className="min-h-[200px] max-h-[300px] overflow-y-auto space-y-2">
                            {newHostResults.length === 0 && newHostSearchTerm && !isSearchingNewHost && (
                                <p className="text-center text-xs text-slate-400 py-4">No se encontraron usuarios.</p>
                            )}
                            {newHostResults.map(u => (
                                <div key={u.id} className="flex items-center justify-between p-3 border border-slate-200 hover:bg-slate-50 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs">{u.name.charAt(0)}</div>
                                        <div>
                                            <p className="font-bold text-xs uppercase">{u.name}</p>
                                            <p className="text-[10px] text-slate-500">{u.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleAddRole(u, UserRole.ANFITRION)}
                                            className="px-2 py-1 bg-black text-white text-[10px] font-bold uppercase rounded border-2 border-transparent hover:border-black hover:bg-white hover:text-black transition-all"
                                        >
                                            Anfitrión
                                        </button>
                                        <button
                                            onClick={() => handleAddRole(u, UserRole.CO_ANFITRION)}
                                            className="px-2 py-1 bg-white border-2 border-black text-black text-[10px] font-bold uppercase rounded hover:bg-slate-100 transition-all"
                                        >
                                            Co-Anfitrión
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </NeoModal>

                {/* VIEW POSTULATION MODAL (Moved to Top Level) */}
                {viewingApp && (
                    <NeoModal
                        isOpen={!!viewingApp}
                        onClose={() => setViewingApp(null)}
                        title="Detalle Postulación"
                    >
                        <div className="flex flex-col gap-6">
                            <div className="flex items-center gap-4 border-b-2 border-dashed border-neutral-300 pb-4">
                                <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center font-black text-neutral-500 text-xl border-2 border-black">
                                    {viewingApp.firstName.charAt(0)}
                                </div>
                                <div>
                                    <h4 className="font-black text-xl uppercase">{viewingApp.firstName} {viewingApp.lastName}</h4>
                                    <p className="text-sm font-bold text-neutral-500">{viewingApp.email} • {viewingApp.phone}</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center p-3 bg-neutral-50 border-2 border-black">
                                    <span className="text-xs font-black uppercase text-neutral-700">¿Asiste a Origen?</span>
                                    {viewingApp.attendsOrigen
                                        ? <span className="bg-emerald-100 text-emerald-700 border-2 border-emerald-600 px-2 py-1 text-[10px] font-black uppercase">SÍ</span>
                                        : <span className="bg-neutral-200 text-neutral-500 border-2 border-neutral-400 px-2 py-1 text-[10px] font-black uppercase">NO</span>}
                                </div>
                                <div className="flex justify-between items-center p-3 bg-neutral-50 border-2 border-black">
                                    <span className="text-xs font-black uppercase text-neutral-700">¿Hizo Crecer?</span>
                                    {viewingApp.completedHicisteCrecer
                                        ? <span className="bg-emerald-100 text-emerald-700 border-2 border-emerald-600 px-2 py-1 text-[10px] font-black uppercase">SÍ</span>
                                        : <span className="bg-neutral-200 text-neutral-500 border-2 border-neutral-400 px-2 py-1 text-[10px] font-black uppercase">NO</span>}
                                </div>
                                <div className="flex justify-between items-center p-3 bg-neutral-50 border-2 border-black">
                                    <span className="text-xs font-black uppercase text-neutral-700">¿Entrenamiento Voluntarios?</span>
                                    {viewingApp.completedVolunteerTraining
                                        ? <span className="bg-emerald-100 text-emerald-700 border-2 border-emerald-600 px-2 py-1 text-[10px] font-black uppercase">SÍ</span>
                                        : <span className="bg-neutral-200 text-neutral-500 border-2 border-neutral-400 px-2 py-1 text-[10px] font-black uppercase">NO</span>}
                                </div>
                                <div className="flex justify-between items-center p-3 bg-neutral-50 border-2 border-black">
                                    <span className="text-xs font-black uppercase text-neutral-700">¿Curso de Líder?</span>
                                    {viewingApp.completedLeaderCourse
                                        ? <span className="bg-emerald-100 text-emerald-700 border-2 border-emerald-600 px-2 py-1 text-[10px] font-black uppercase">SÍ</span>
                                        : <span className="bg-neutral-200 text-neutral-500 border-2 border-neutral-400 px-2 py-1 text-[10px] font-black uppercase">NO</span>}
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t-2 border-black mt-2">
                                <button onClick={() => handleRejectApplication(viewingApp)} className="flex-1 py-3 border-2 border-black text-red-600 bg-red-50 font-black uppercase text-xs hover:bg-red-100 hover:shadow-[3px_3px_0px_0px_rgba(220,38,38,1)] transition-all">Rechazar</button>
                                <button onClick={() => handleApproveApplication(viewingApp)} className="flex-1 py-3 bg-black text-white font-black uppercase text-xs hover:bg-neutral-800 border-2 border-black shadow-[3px_3px_0px_0px_rgba(100,100,100,1)] hover:shadow-[5px_5px_0px_0px_rgba(100,100,100,1)] hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all">Aprobar</button>
                            </div>
                        </div>
                    </NeoModal>
                )}

            </div>{/* end columns wrapper */}
        </div>
    );
};

export default HostsManagementPanel;


