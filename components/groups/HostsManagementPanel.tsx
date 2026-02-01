
import React, { useState, useEffect } from 'react';
import { User, UserRole, Group } from '../../types';
import { supabaseService, updateGroupDirect } from '../../services/supabaseService';
import { Search, Shield, UserPlus, Users, X, ChevronRight, Check, AlertCircle, Loader2, MoreVertical, UserCheck, Home } from 'lucide-react';
import NeoModal from '../NeoModal';

interface HostsManagementPanelProps {
    groups: Group[]; // Pass available groups for assignment
    onUpdate: () => void; // Callback to refresh data (e.g. groups list)
}

type Tab = 'ANFITRIONES' | 'CO_ANFITRIONES' | 'ASIGNACIONES';

const HostsManagementPanel: React.FC<HostsManagementPanelProps> = ({ groups, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<Tab>('ANFITRIONES');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // --- SEARCH STATE ---
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // --- LIST STATE ---
    const [currentHosts, setCurrentHosts] = useState<User[]>([]);
    const [currentCoHosts, setCurrentCoHosts] = useState<User[]>([]);

    // --- ASSIGNMENT MODAL STATE ---
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
    const [targetGroupId, setTargetGroupId] = useState<string>('');
    const [assignmentRole, setAssignmentRole] = useState<'HOST' | 'CO_HOST'>('HOST');

    // --- FETCH DATA ---
    const fetchRoleUsers = async () => {
        setIsLoading(true);
        const [hosts, coHosts] = await Promise.all([
            supabaseService.getUsersByRole(UserRole.ANFITRION),
            supabaseService.getUsersByRole(UserRole.CO_ANFITRION)
        ]);
        setCurrentHosts(hosts);
        setCurrentCoHosts(coHosts);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchRoleUsers();
    }, []);

    // --- SEARCH HANDLER ---
    useEffect(() => {
        if (!searchTerm.trim()) {
            setSearchResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearching(true);
            const results = await supabaseService.searchUsersGlobal(searchTerm);
            setSearchResults(results);
            setIsSearching(false);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // --- ROLE TOGGLE HANDLER ---
    const handleToggleRole = async (user: User, role: UserRole, shouldHave: boolean) => {
        const success = await supabaseService.toggleUserRole(user.id, role, shouldHave);
        if (success) {
            // Refresh lists
            await fetchRoleUsers();
            // Update local search result state to reflect change immediately
            setSearchResults(prev => prev.map(u =>
                u.id === user.id ? { ...u, role: shouldHave ? role : UserRole.USUARIO } : u
            ));
        } else {
            alert('Error al actualizar el rol');
        }
    };

    // --- ASSIGNMENT HANDLERS ---
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

        // Find the target group object
        const groupToUpdate = groups.find(g => g.id === targetGroupId);

        // Need to construct the update payload.
        // If we selected a group, we update that group.
        // If we selected "Ninguno" (empty string), we need to find their old group and remove them?
        // Simpler approach: 
        // 1. If checking "Ninguno", we search all groups where this user is host/co-host and remove them.
        // 2. If checking a specific group, we update that group.
        //    AND we must ensure we don't duplicate them (remove from old group if different).

        setIsLoading(true);

        try {
            // 1. Remove user from ANY other group as this role
            // We iterate groups to find where they currently are
            const previousGroup = groups.find(g =>
                (assignmentRole === 'HOST' && g.host_id === selectedUser.id) ||
                (assignmentRole === 'CO_HOST' && g.co_host_id === selectedUser.id)
            );

            if (previousGroup && previousGroup.id !== targetGroupId) {
                // Remove from old group
                const updatePayload = { ...previousGroup };
                if (assignmentRole === 'HOST') (updatePayload as any).host_id = null;
                else (updatePayload as any).co_host_id = null;

                await updateGroupDirect(updatePayload);
            }

            // 2. Add to new group (if selected)
            if (targetGroupId) {
                if (!groupToUpdate) return; // Should not happen

                const updatePayload = { ...groupToUpdate };
                if (assignmentRole === 'HOST') (updatePayload as any).host_id = selectedUser.id;
                else (updatePayload as any).co_host_id = selectedUser.id;

                await updateGroupDirect(updatePayload);
            }

            // 3. Force Refresh
            onUpdate();
            setIsAssignmentModalOpen(false);
            fetchRoleUsers(); // Refresh role lists just in case
        } catch (err) {
            console.error(err);
            alert('Error al asignar grupo');
        } finally {
            setIsLoading(false);
        }
    };

    // --- RENDERERS ---

    const renderUserCard = (user: User, targetRole: UserRole) => {
        const hasRole = user.role === targetRole;
        const assignedGroup = groups.find(g =>
            (targetRole === UserRole.ANFITRION && g.host_id === user.id) ||
            (targetRole === UserRole.CO_ANFITRION && g.co_host_id === user.id)
        );

        return (
            <div key={user.id} className="flex items-center justify-between p-4 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 border-black font-bold text-lg ${hasRole ? 'bg-yellow-300' : 'bg-slate-200'}`}>
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="font-bold uppercase text-sm">{user.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{user.email}</div>
                        {hasRole && (
                            <div className="text-[10px] bg-slate-100 px-2 py-0.5 mt-1 inline-block border border-slate-300 rounded-sm">
                                {assignedGroup ? `Grupo: ${assignedGroup.name}` : 'Sin grupo asignado'}
                            </div>
                        )}
                    </div>
                </div>

                <button
                    onClick={() => handleToggleRole(user, targetRole, !hasRole)}
                    className={`px-3 py-1.5 md:px-4 md:py-2 text-[10px] md:text-xs font-black uppercase tracking-wider border-2 border-black transition-all ${hasRole
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-green-400 text-black hover:bg-green-500'
                        }`}
                >
                    {hasRole ? 'REMOVER ROL' : 'ASIGNAR ROL'}
                </button>
            </div>
        );
    };

    const renderRoleTab = (role: UserRole, usersList: User[]) => (
        <div className="space-y-6">
            {/* Search Section */}
            <div className="bg-slate-50 border-2 border-black p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar persona por nombre..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border-2 border-black focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all uppercase placeholder-slate-400 font-bold text-sm"
                    />
                    {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-black" />}
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                        {searchResults.map(u => renderUserCard(u, role))}
                    </div>
                )}
            </div>

            {/* Current List Section */}
            <div>
                <h3 className="text-lg font-black uppercase mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    {role === UserRole.ANFITRION ? 'Anfitriones Actuales' : 'Co-Anfitriones Actuales'}
                    <span className="bg-black text-white px-2 py-0.5 text-xs rounded-full">{usersList.length}</span>
                </h3>

                {usersList.length === 0 ? (
                    <div className="p-8 text-center border-2 border-dashed border-slate-300 text-slate-400">
                        No hay usuarios con el rol {role}.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {usersList.map(u => renderUserCard(u, role))}
                    </div>
                )}
            </div>
        </div>
    );

    const renderAssignmentsTab = () => (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Anfitriones Column */}
            <div className="space-y-4">
                <h3 className="text-lg font-black uppercase border-b-4 border-black pb-2">Asignar Anfitriones</h3>
                <div className="space-y-2">
                    {currentHosts.map(host => {
                        const group = groups.find(g => g.host_id === host.id);
                        return (
                            <div
                                key={host.id}
                                onClick={() => openAssignmentModal(host, 'HOST')}
                                className="group cursor-pointer bg-white border-2 border-black p-3 hover:bg-yellow-50 transition-colors flex items-center justify-between"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-black text-white flex items-center justify-center font-bold">
                                        {host.name.charAt(0)}
                                    </div>
                                    <div className="leading-tight">
                                        <div className="font-bold text-sm">{host.name}</div>
                                        <div className="text-[10px] text-slate-500">{group ? 'ASIGNADO' : 'SIN GRUPO'}</div>
                                    </div>
                                </div>
                                <div className={`text-xs font-bold px-2 py-1 border border-black ${group ? 'bg-green-100' : 'bg-red-100'}`}>
                                    {group ? group.name : 'Asignar'}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Co-Anfitriones Column */}
            <div className="space-y-4">
                <h3 className="text-lg font-black uppercase border-b-4 border-black pb-2">Asignar Co-Anfitriones</h3>
                <div className="space-y-2">
                    {currentCoHosts.map(coHost => {
                        const group = groups.find(g => g.co_host_id === coHost.id);
                        return (
                            <div
                                key={coHost.id}
                                onClick={() => openAssignmentModal(coHost, 'CO_HOST')}
                                className="group cursor-pointer bg-white border-2 border-black p-3 hover:bg-yellow-50 transition-colors flex items-center justify-between"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-slate-200 text-black border border-black flex items-center justify-center font-bold">
                                        {coHost.name.charAt(0)}
                                    </div>
                                    <div className="leading-tight">
                                        <div className="font-bold text-sm">{coHost.name}</div>
                                        <div className="text-[10px] text-slate-500">{group ? 'ASIGNADO' : 'SIN GRUPO'}</div>
                                    </div>
                                </div>
                                <div className={`text-xs font-bold px-2 py-1 border border-black ${group ? 'bg-green-100' : 'bg-red-100'}`}>
                                    {group ? group.name : 'Asignar'}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Tab Navigation */}
            {/* Header with Kebab Menu */}
            <div className="flex justify-between items-center border-b-2 border-slate-100 pb-4">
                <div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter">
                        Gestión de Anfitriones
                    </h3>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-10">
                        {activeTab === 'ANFITRIONES' && 'Listado de Anfitriones'}
                        {activeTab === 'CO_ANFITRIONES' && 'Listado de Co-Anfitriones'}
                        {activeTab === 'ASIGNACIONES' && 'Asignación de Grupos'}
                    </p>
                </div>

                <div className="relative z-20">
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="p-2 text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border-2 border-transparent hover:border-slate-200"
                    >
                        <MoreVertical className="w-6 h-6" />
                    </button>

                    {isMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-30" onClick={() => setIsMenuOpen(false)} />
                            <div className="absolute top-full right-0 mt-2 z-40 w-64 bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-2 flex flex-col gap-1">
                                <button
                                    onClick={() => { setActiveTab('ANFITRIONES'); setIsMenuOpen(false); }}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all text-left ${activeTab === 'ANFITRIONES' ? 'bg-black text-white' : 'hover:bg-slate-100'}`}
                                >
                                    <UserCheck className="w-4 h-4" />
                                    Anfitriones
                                </button>
                                <button
                                    onClick={() => { setActiveTab('CO_ANFITRIONES'); setIsMenuOpen(false); }}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all text-left ${activeTab === 'CO_ANFITRIONES' ? 'bg-black text-white' : 'hover:bg-slate-100'}`}
                                >
                                    <Users className="w-4 h-4" />
                                    Co-Anfitriones
                                </button>
                                <button
                                    onClick={() => { setActiveTab('ASIGNACIONES'); setIsMenuOpen(false); }}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all text-left ${activeTab === 'ASIGNACIONES' ? 'bg-black text-white' : 'hover:bg-slate-100'}`}
                                >
                                    <Home className="w-4 h-4" />
                                    Asignar a Grupos
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[400px]">
                {isLoading && (
                    <div className="flex justify-center items-center py-20">
                        <Loader2 className="w-10 h-10 animate-spin text-black" />
                    </div>
                )}

                {!isLoading && activeTab === 'ANFITRIONES' && renderRoleTab(UserRole.ANFITRION, currentHosts)}
                {!isLoading && activeTab === 'CO_ANFITRIONES' && renderRoleTab(UserRole.CO_ANFITRION, currentCoHosts)}
                {!isLoading && activeTab === 'ASIGNACIONES' && renderAssignmentsTab()}
            </div>

            {/* Assignment Modal */}
            <NeoModal isOpen={isAssignmentModalOpen} onClose={() => setIsAssignmentModalOpen(false)} title="Vincular a Grupo de Conexión">
                <div className="space-y-6">
                    {/* User Info */}
                    <div className="bg-slate-50 border-2 border-black p-4 flex items-center gap-4">
                        <div className="w-12 h-12 bg-black text-white flex items-center justify-center font-black text-xl border-2 border-white shadow-lg">
                            {selectedUser?.name.charAt(0)}
                        </div>
                        <div>
                            <div className="text-xs uppercase font-bold text-slate-500">Editando {assignmentRole === 'HOST' ? 'Anfitrión' : 'Co-Anfitrión'}</div>
                            <div className="text-lg font-black uppercase">{selectedUser?.name}</div>
                            <div className="text-xs font-mono">{selectedUser?.email}</div>
                        </div>
                    </div>

                    {/* Group Selector */}
                    <div>
                        <label className="block text-xs font-black uppercase mb-2">Seleccionar Grupo</label>
                        <select
                            value={targetGroupId}
                            onChange={(e) => setTargetGroupId(e.target.value)}
                            className="w-full bg-white border-2 border-black p-3 font-bold focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none"
                        >
                            <option value="">-- Sin asignar (Ninguno) --</option>
                            {groups.filter(g => g.status === 'approved' && (!g.endDate || g.endDate >= new Date().toISOString().split('T')[0])).map(g => (
                                <option key={g.id} value={g.id}>
                                    {g.name}  ({g.meetingDay} {g.meetingTime})
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-500 mt-2">
                            <AlertCircle className="w-3 h-3 inline mr-1" />
                            Al seleccionar un grupo, este usuario será asignado como {assignmentRole === 'HOST' ? 'Líder Principal' : 'Co-Líder'}.
                            Si ya lideraba otro grupo, será removido de aquel.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t-2 border-slate-100">
                        <button
                            onClick={() => setIsAssignmentModalOpen(false)}
                            className="px-4 py-2 font-bold uppercase hover:bg-slate-100 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSaveAssignment}
                            disabled={isLoading}
                            className="bg-black text-white px-6 py-2 border-2 border-black font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-2"
                        >
                            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                            Guardar Cambios
                        </button>
                    </div>
                </div>
            </NeoModal>
        </div>
    );
};

export default HostsManagementPanel;
