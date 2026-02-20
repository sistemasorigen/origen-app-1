
import React, { useState, useEffect } from 'react';
import { User, UserRole, Group, LeaderApplication } from '../../types';
import { supabaseService, updateGroupDirect } from '../../services/supabaseService';
import { Search, Shield, UserPlus, Users, X, ChevronRight, Check, AlertCircle, Loader2, MoreVertical, UserCheck, Home, Filter, Trash2, Edit2, ArrowRight, Plus } from 'lucide-react';
import NeoModal from '../NeoModal';

interface HostsManagementPanelProps {
    groups: Group[]; // Pass available groups for assignment
    onUpdate: () => void; // Callback to refresh data (e.g. groups list)
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const HostsManagementPanel: React.FC<HostsManagementPanelProps> = ({ groups, onUpdate, showToast }) => {
    const [isLoading, setIsLoading] = useState(false);

    // --- DATA STATE ---
    const [allHosts, setAllHosts] = useState<{ user: User, role: 'HOST' | 'CO_HOST' }[]>([]);

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
    const [roleChangeModalOpen, setRoleChangeModalOpen] = useState(false);
    const [roleChangeTarget, setRoleChangeTarget] = useState<{ user: User, currentRole: 'HOST' | 'CO_HOST' } | null>(null);

    // --- FETCH DATA ---
    const fetchRoleUsers = async () => {
        setIsLoading(true);
        try {
            const [hosts, coHosts] = await Promise.all([
                supabaseService.getUsersByRole(UserRole.ANFITRION),
                supabaseService.getUsersByRole(UserRole.CO_ANFITRION)
            ]);

            // Combine into unified list
            const combined = [
                ...hosts.map(u => ({ user: u, role: 'HOST' as const })),
                ...coHosts.map(u => ({ user: u, role: 'CO_HOST' as const }))
            ];

            // Deduplicate
            const unique = Array.from(new Map(combined.map(item => [item.user.id, item])).values());
            setAllHosts(unique);

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

        // 1. Assign Role if applicantId exists
        if (app.applicantId) {
            const success = await supabaseService.toggleUserRole(app.applicantId, UserRole.ANFITRION, true);
            if (!success) {
                showToast('Error al asignar el rol de Anfitrión.', 'error');
                return;
            }
        } else {
            console.warn('No applicantId found for application:', app);
        }

        // 2. Update Application Status
        await supabaseService.updateLeaderApplicationStatus(app.id, 'APPROVED');

        // Refresh
        fetchRoleUsers();
        setViewingApp(null);
        showToast(`Postulación aprobada y rol de Anfitrión asignado.`);
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
        // Find if user is already assigned to a group to pre-fill
        const assignedGroup = groups.find(g =>
            (role === 'HOST' && g.host_id === user.id) ||
            (role === 'CO_HOST' && g.co_host_id === user.id)
        );
        setTargetGroupId(assignedGroup?.id || '');
        setIsAssignmentModalOpen(true);
    };

    const handleSaveAssignment = async () => {
        if (!selectedUser) return;
        const groupToUpdate = groups.find(g => g.id === targetGroupId);
        setIsLoading(true);

        try {
            // 1. Remove from old group
            const previousGroup = groups.find(g =>
                (assignmentRole === 'HOST' && g.host_id === selectedUser.id) ||
                (assignmentRole === 'CO_HOST' && g.co_host_id === selectedUser.id)
            );

            if (previousGroup && previousGroup.id !== targetGroupId) {
                const updatePayload = { ...previousGroup };
                if (assignmentRole === 'HOST') (updatePayload as any).host_id = null;
                else (updatePayload as any).co_host_id = null;
                await updateGroupDirect(updatePayload);
            }

            // 2. Add to new group
            if (targetGroupId && groupToUpdate) {
                const updatePayload = { ...groupToUpdate };
                if (assignmentRole === 'HOST') (updatePayload as any).host_id = selectedUser.id;
                else (updatePayload as any).co_host_id = selectedUser.id;
                await updateGroupDirect(updatePayload);
            }

            onUpdate();
            setIsAssignmentModalOpen(false);
            fetchRoleUsers();
        } catch (err) {
            console.error(err);
            alert('Error al asignar grupo');
        } finally {
            setIsLoading(false);
        }
    };

    const confirmRoleChange = async () => {
        if (!roleChangeTarget) return;
        const { user, currentRole } = roleChangeTarget;

        // Define roles
        const newRole = currentRole === 'HOST' ? UserRole.CO_ANFITRION : UserRole.ANFITRION;
        const oldRole = currentRole === 'HOST' ? UserRole.ANFITRION : UserRole.CO_ANFITRION;

        // Perform Update
        setIsLoading(true);
        try {
            // 1. Add New Role
            const addSuccess = await supabaseService.toggleUserRole(user.id, newRole, true);

            // 2. Remove Old Role (Only if add was successful to prevent data loss)
            if (addSuccess) {
                await supabaseService.toggleUserRole(user.id, oldRole, false);

                showToast(`Rol actualizado a ${newRole === UserRole.ANFITRION ? 'Anfitrión' : 'Co-Anfitrión'}`);
                onUpdate();
                fetchRoleUsers();
            } else {
                showToast('Error al asignar el nuevo rol', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Error inesperado', 'error');
        } finally {
            setIsLoading(false);
            setRoleChangeModalOpen(false);
            setRoleChangeTarget(null);
        }
    };

    // --- FILTERED DATA ---
    const filteredHosts = allHosts.filter(item => {
        const matchSearch = item.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.user.email?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchRole = roleFilter === 'ALL' || item.role === roleFilter;

        const assignedGroup = groups.find(g =>
            (item.role === 'HOST' && g.host_id === item.user.id) ||
            (item.role === 'CO_HOST' && g.co_host_id === item.user.id)
        );

        const matchStatus = statusFilter === 'ALL' ||
            (statusFilter === 'ASSIGNED' && !!assignedGroup) ||
            (statusFilter === 'UNASSIGNED' && !assignedGroup);

        return matchSearch && matchRole && matchStatus;
    });

    // --- RENDER ---
    return (
        <div className="flex flex-col xl:flex-row gap-6 items-start">

            {/* --- LEFT COLUMN: HOSTS PANEL --- */}
            <div className="flex-1 w-full min-w-0 bg-white rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">

                {/* TOOLBAR */}
                <div className="p-4 border-b-2 border-black bg-slate-50 flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Shield className="w-6 h-6" />
                        <h2 className="text-lg font-black uppercase tracking-tight">Gestión de Anfitriones</h2>
                        <span className="bg-black text-white px-2 py-0.5 text-xs rounded-full font-bold">{allHosts.length}</span>
                    </div>

                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        {/* SEARCH */}
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="BUSCAR..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-xs font-bold border-2 border-black rounded-lg focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] outline-none uppercase"
                            />
                        </div>

                        {/* ROLE FILTER */}
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value as any)}
                            className="px-3 py-2 text-xs font-bold border-2 border-black rounded-lg bg-white uppercase focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] outline-none"
                        >
                            <option value="ALL">Todos los Roles</option>
                            <option value="HOST">Solo Anfitriones</option>
                            <option value="CO_HOST">Solo Co-Anfitriones</option>
                        </select>

                        {/* STATUS FILTER */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="px-3 py-2 text-xs font-bold border-2 border-black rounded-lg bg-white uppercase focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] outline-none"
                        >
                            <option value="ALL">Todos los Estados</option>
                            <option value="ASSIGNED">Con Grupo</option>
                            <option value="UNASSIGNED">Sin Grupo</option>
                        </select>

                        {/* NEW BUTTON */}
                        <button
                            onClick={() => setIsNewHostModalOpen(true)}
                            className="bg-black text-white px-4 py-2 text-xs font-black uppercase rounded-lg hover:bg-zinc-800 transition-colors flex items-center gap-2"
                        >
                            <UserPlus className="w-4 h-4" />
                            <span className="hidden sm:inline">Nuevo</span>
                        </button>
                    </div>
                </div>

                {/* TABLE HEADER - HIDDEN ON MOBILE */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-slate-100 border-b-2 border-black text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <div className="col-span-3">Usuario</div>
                    <div className="col-span-2 text-center">Rol</div>
                    <div className="col-span-4">Grupo Asignado</div>
                    <div className="col-span-3 text-right">Acciones</div>
                </div>

                {/* TABLE BODY / MOBILE PRO CARDS */}
                <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                    {isLoading ? (
                        <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>
                    ) : filteredHosts.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 text-sm font-medium italic">
                            No se encontraron resultados
                        </div>
                    ) : (
                        filteredHosts.map(({ user, role }, index) => {
                            const assignedGroup = groups.find(g =>
                                (role === 'HOST' && g.host_id === user.id) ||
                                (role === 'CO_HOST' && g.co_host_id === user.id)
                            );

                            // Kebab Menu State
                            const isMenuOpen = activeMenuId === `${user.id}-${role}`;
                            const isLastItem = index >= filteredHosts.length - 2; // Open upwards for last 2 items

                            return (
                                <div key={`${user.id}-${role}`} className="group transition-colors hover:bg-slate-50 relative">

                                    {/* --- MOBILE LAYOUT (Stack) --- */}
                                    <div className="md:hidden p-4 flex flex-col gap-3">
                                        {/* TOP ROW: Avatar + Name + Kebab */}
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-12 h-12 rounded-full border border-black/10 flex items-center justify-center font-bold text-lg shrink-0 ${role === 'HOST' ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-600'}`}>
                                                    {user.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-sm text-slate-900 leading-tight">{user.name}</h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setRoleChangeTarget({ user, currentRole: role });
                                                                setRoleChangeModalOpen(true);
                                                            }}
                                                            className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 px-2 py-1 rounded-md transition-all ${role === 'HOST'
                                                                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 hover:text-yellow-900'
                                                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                                                                }`}
                                                        >
                                                            {role === 'HOST' ? 'Anfitrión' : 'Co-Anfitrión'}
                                                            <div className="bg-white/50 p-0.5 rounded-full">
                                                                <Edit2 className="w-2.5 h-2.5" />
                                                            </div>
                                                        </button>
                                                        <span className="text-[10px] text-slate-400">•</span>
                                                        <p className="text-[10px] text-slate-400 truncate max-w-[120px]">{user.email}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* KEBAB MENU TRIGGER */}
                                            <div className="relative">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveMenuId(isMenuOpen ? null : `${user.id}-${role}`);
                                                    }}
                                                    className="p-1 text-slate-400 hover:text-black transition-colors"
                                                >
                                                    <MoreVertical className="w-5 h-5" />
                                                </button>

                                                {/* DROPDOWN MENU */}
                                                {isMenuOpen && (
                                                    <>
                                                        <div
                                                            className="fixed inset-0 z-40"
                                                            onClick={() => setActiveMenuId(null)}
                                                        />
                                                        <div className={`absolute right-0 ${isLastItem ? 'bottom-full mb-1 origin-bottom-right' : 'top-full mt-1 origin-top-right'} w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
                                                            <button
                                                                onClick={() => {
                                                                    openAssignmentModal(user, role);
                                                                    setActiveMenuId(null);
                                                                }}
                                                                className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                                Editar Asignación
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    handleRemoveRole(user, role);
                                                                    setActiveMenuId(null);
                                                                }}
                                                                className="w-full text-left px-4 py-3 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-slate-100"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                Quitar Rol
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* BOTTOM ROW: Assignment Status */}
                                        <div className="pl-[60px]">
                                            {assignedGroup ? (
                                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                                    <div className={`w-2 h-2 rounded-full ${assignedGroup.status === 'approved' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                                    <span className="font-medium truncate">{assignedGroup.name}</span>
                                                    <span className="text-slate-300">|</span>
                                                    <span className="text-[10px] uppercase text-slate-400">{assignedGroup.meetingDay} {assignedGroup.meetingTime}</span>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => openAssignmentModal(user, role)}
                                                    className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                    Asignar a un Grupo
                                                </button>
                                            )}
                                        </div>
                                    </div>


                                    {/* --- DESKTOP LAYOUT (Table Row) --- */}
                                    <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 items-center">
                                        {/* USER INFO */}
                                        <div className="col-span-3 flex items-center gap-3 overflow-hidden">
                                            <div className={`w-10 h-10 rounded-full border-2 border-black flex items-center justify-center font-bold text-sm shrink-0 ${role === 'HOST' ? 'bg-black text-white' : 'bg-slate-200 text-black'}`}>
                                                {user.name.charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-sm uppercase truncate">{user.name}</p>
                                                <p className="text-[10px] text-slate-500 font-mono truncate">{user.email}</p>
                                            </div>
                                        </div>

                                        {/* ROLE BADGE */}
                                        <div className="col-span-2 flex justify-center">
                                            <button
                                                onClick={() => {
                                                    setRoleChangeTarget({ user, currentRole: role });
                                                    setRoleChangeModalOpen(true);
                                                }}
                                                className={`group relative px-4 py-1.5 rounded-full text-[10px] font-black uppercase border-2 transition-all duration-200 active:scale-95 flex items-center gap-2 ${role === 'HOST'
                                                    ? 'bg-yellow-300 border-black text-black hover:bg-yellow-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                                                    : 'bg-white border-slate-300 text-slate-500 hover:border-black hover:text-black hover:bg-slate-50'
                                                    }`}
                                                title="Clic para cambiar rol"
                                            >
                                                <span>{role === 'HOST' ? 'Anfitrión' : 'Co-Anfitrión'}</span>
                                                <div className={`p-0.5 rounded-full ${role === 'HOST' ? 'bg-black/10' : 'bg-slate-100 group-hover:bg-slate-200'}`}>
                                                    <Edit2 className="w-2.5 h-2.5" />
                                                </div>
                                            </button>
                                        </div>

                                        {/* GROUP ASSIGNMENT */}
                                        <div className="col-span-4 pl-0">
                                            {assignedGroup ? (
                                                <div
                                                    onClick={() => openAssignmentModal(user, role)}
                                                    className="group cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg border border-transparent hover:border-black/10 hover:bg-white transition-all w-full"
                                                >
                                                    <div className={`w-2 h-2 rounded-full shrink-0 ${assignedGroup.status === 'approved' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold uppercase truncate">{assignedGroup.name}</p>
                                                        <p className="text-[9px] text-slate-500 uppercase">{assignedGroup.meetingDay} {assignedGroup.meetingTime}</p>
                                                    </div>
                                                    <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 ml-auto" />
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => openAssignmentModal(user, role)}
                                                    className="px-3 py-1.5 bg-white border border-slate-300 text-slate-500 text-[10px] font-bold uppercase rounded-md hover:border-black hover:text-black hover:bg-white transition-all flex items-center gap-2"
                                                >
                                                    <div className="w-2 h-2 rounded-full bg-red-400" />
                                                    Sin Asignar
                                                </button>
                                            )}
                                        </div>

                                        {/* ACTIONS */}
                                        <div className="col-span-3 flex justify-end items-center gap-2">
                                            <button
                                                onClick={() => openAssignmentModal(user, role)}
                                                className="p-2 hover:bg-black/5 rounded-full text-slate-600 transition-colors"
                                                title="Editar Asignación"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleRemoveRole(user, role)}
                                                className="p-2 hover:bg-black/5 rounded-full text-red-500 transition-colors"
                                                title="Remover Rol"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* --- RIGHT COLUMN: APPLICATIONS SIDEBAR --- */}
            {/* Hidden if no applications? No, user wants it there. Maybe show empty state. */}
            <div className="w-full xl:w-96 shrink-0 space-y-4">
                <div className="bg-white rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="bg-yellow-100 p-4 border-b-2 border-black flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                            <h3 className="font-black uppercase text-sm tracking-wide">Solicitudes Pendientes</h3>
                        </div>
                        <span className="bg-black text-white px-2 py-0.5 text-xs rounded-full font-bold">{applications.length}</span>
                    </div>

                    <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-100">
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
                            <span>Al guardar, este usuario será asignado como {assignmentRole === 'HOST' ? 'Anfitrión' : 'Co-Anfitrión'} y removido de cualquier otro grupo donde tuviera ese rol.</span>
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

            {/* NEW HOST MODAL */}
            <NeoModal isOpen={roleChangeModalOpen} onClose={() => setRoleChangeModalOpen(false)} title="Cambiar Rol">
                <div className="space-y-6">
                    {roleChangeTarget && (
                        <>
                            <div className="bg-slate-50 border-2 border-black p-4 flex items-center gap-4">
                                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center font-black text-xl border-2 border-black text-black">
                                    {roleChangeTarget.user.name.charAt(0)}
                                </div>
                                <div>
                                    <div className="text-[10px] font-black uppercase text-slate-500 mb-0.5">Usuario</div>
                                    <div className="text-lg font-black uppercase leading-none">{roleChangeTarget.user.name}</div>
                                </div>
                            </div>

                            <div className="text-center space-y-4 py-2">
                                <p className="text-sm font-medium text-slate-600">
                                    El usuario actualmente es <span className="font-black text-black uppercase">{roleChangeTarget.currentRole === 'HOST' ? 'Anfitrión' : 'Co-Anfitrión'}</span>.
                                </p>
                                <ArrowRight className="w-6 h-6 mx-auto text-slate-400 rotate-90 md:rotate-0" />
                                <p className="text-sm font-medium text-slate-600">
                                    ¿Deseas cambiar su rol a <span className={`font-black uppercase px-2 py-0.5 rounded ${roleChangeTarget.currentRole === 'HOST' ? 'bg-slate-200 text-slate-700' : 'bg-yellow-300 text-black'}`}>{roleChangeTarget.currentRole === 'HOST' ? 'Co-Anfitrión' : 'Anfitrión'}</span>?
                                </p>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t-2 border-slate-100">
                                <button
                                    onClick={() => setRoleChangeModalOpen(false)}
                                    className="px-4 py-2 text-xs font-bold uppercase hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmRoleChange}
                                    disabled={isLoading}
                                    className="bg-black text-white px-6 py-2 border-2 border-black rounded-lg text-xs font-black uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all flex items-center gap-2"
                                >
                                    {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                                    Confirmar Cambio
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

                        <div className="flex gap-4 pt-4 border-t-2 border-black mt-2">
                            <button onClick={() => handleRejectApplication(viewingApp)} className="flex-1 py-3 border-2 border-black text-red-600 bg-red-50 font-black uppercase text-xs hover:bg-red-100 hover:shadow-[3px_3px_0px_0px_rgba(220,38,38,1)] transition-all">Rechazar</button>
                            <button onClick={() => handleApproveApplication(viewingApp)} className="flex-1 py-3 bg-black text-white font-black uppercase text-xs hover:bg-neutral-800 border-2 border-black shadow-[3px_3px_0px_0px_rgba(100,100,100,1)] hover:shadow-[5px_5px_0px_0px_rgba(100,100,100,1)] hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all">Aprobar</button>
                        </div>
                    </div>
                </NeoModal>
            )}

        </div>
    );
};

export default HostsManagementPanel;
