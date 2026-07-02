import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Group, GroupCategory, GroupTag, User } from '../../types';
import { supabaseService, deleteGroupDirect, updateGroupDirect, insertGroupDirect, toggleGroupCapacityLock } from '../../services/supabaseService';
import AdminGCXLayout, { useAdminGCXToast } from '../../components/layout/AdminGCXLayout';

import GroupsAdminToolbar from '../../components/GCX/BarraHerramientasGruposAdmin';
import GroupsAdminList from '../../components/GCX/ListaGruposAdmin';
import AdminGroupReviewModal from '../../components/admin/ModalRevisionGrupoAdmin';
import CreateGroupModal from '../../components/GCX/ModalCrearGrupo';
import AdminCreateGroupModal from '../../components/GCX/ModalCrearGrupoAdmin';
import AdminAddMemberModal from '../../components/GCX/ModalAgregarMiembroAdmin';
import ApplicantsModal from '../../components/GCX/ModalSolicitantes';
import AdminDropoutInbox from '../../components/GCX/BandejaBajasAdmin';
import NeoModal from '../../components/ui/NeoModal';
import ImageUpload from '../../components/media/SubidaImagen';

import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Search, Calendar, Users, X } from 'lucide-react';

// ── Helpers copiados de Grupos.tsx (sin cambios) ──
const formatDateForInput = (isoDateString?: string) => {
    if (!isoDateString) return '';
    if (isoDateString.includes('T')) {
        return isoDateString.split('T')[0];
    }
    return isoDateString;
};

const formatDateForDisplay = (isoDateString?: string) => {
    if (!isoDateString) return '';
    const dateStr = isoDateString.includes('T') ? isoDateString.split('T')[0] : isoDateString;
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
};

const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
};

const getSeasonFromDate = (dateStr?: string): 'S1' | 'S2' | 'S3' | null => {
    if (!dateStr) return null;
    const date = parseLocalDate(dateStr);
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const md = m * 100 + d;
    if (md >= 323 && md <= 531) return 'S1';
    if (md >= 629 && md <= 823) return 'S2';
    if (md >= 1005 && md <= 1129) return 'S3';
    return null;
};

const GestionDeGruposContent: React.FC = () => {
    const { showToast } = useAdminGCXToast();
    const { user: currentUser } = useAuth();

    const [adminGroups, setAdminGroups] = useState<Group[]>([]);
    const [categories, setCategories] = useState<GroupCategory[]>([]);
    const [tags, setTags] = useState<GroupTag[]>([]);
    const [pendingDropoutCount, setPendingDropoutCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    // Filtros
    const [adminStatusFilter, setAdminStatusFilter] = useState<'ALL' | 'APPROVED' | 'FINALIZED' | 'PENDING'>('ALL');
    const [adminFilterMode, setAdminFilterMode] = useState<'MANUAL' | 'SEASONS'>('MANUAL');
    const [adminSeasonFilter, setAdminSeasonFilter] = useState<'S1' | 'S2' | 'S3'>('S1');
    const [adminSearchTerm, setAdminSearchTerm] = useState('');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Modales
    const [reviewingGroup, setReviewingGroup] = useState<Group | null>(null);
    const [isReviewLoading, setIsReviewLoading] = useState(false);
    const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
    const [groupToReopen, setGroupToReopen] = useState<Group | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
    const [viewingGroupRegistrations, setViewingGroupRegistrations] = useState<Group | null>(null);
    const [isDropoutInboxOpen, setIsDropoutInboxOpen] = useState(false);
    const [openMenuGroupId, setOpenMenuGroupId] = useState<string | null>(null);

    // Edición de grupo
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<Partial<Group>>({});
    const [editPotentialHosts, setEditPotentialHosts] = useState<User[]>([]);
    const [editHostSearchTerm, setEditHostSearchTerm] = useState('');
    const [isEditHostSelectOpen, setIsEditHostSelectOpen] = useState(false);
    const [editPotentialCoHosts, setEditPotentialCoHosts] = useState<User[]>([]);
    const [editCoHostSearchTerm, setEditCoHostSearchTerm] = useState('');
    const [isEditCoHostSelectOpen, setIsEditCoHostSelectOpen] = useState(false);

    const isGroupFinished = (group: Group) => {
        if (!group.endDate) return false;
        const today = new Date().toISOString().split('T')[0];
        return group.endDate < today;
    };

    const fetchAdminGroups = useCallback(async () => {
        setIsLoading(true);
        try {
            const fetchedGroups = await supabaseService.getGroupsForAdmin();
            setAdminGroups(fetchedGroups);
        } catch (error) {
            console.error("Error fetching admin groups:", error);
            showToast("Error cargando grupos para administración", 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchAdminGroups();
        supabaseService.getGroupCategories().then(setCategories);
        supabaseService.getGroupTags().then(setTags);
        supabaseService.countPendingDropoutRequests().then(setPendingDropoutCount);
    }, [fetchAdminGroups]);

    // Búsqueda de anfitrión para el modal de edición
    useEffect(() => {
        if (!isEditModalOpen) return;
        const timer = setTimeout(async () => {
            const results = await supabaseService.searchPotentialHosts(editHostSearchTerm);
            setEditPotentialHosts(results);
        }, 300);
        return () => clearTimeout(timer);
    }, [editHostSearchTerm, isEditModalOpen]);

    // Búsqueda de co-anfitrión para el modal de edición
    useEffect(() => {
        if (!isEditModalOpen) return;
        const timer = setTimeout(async () => {
            const results = await supabaseService.searchPotentialHosts(editCoHostSearchTerm);
            setEditPotentialCoHosts(results.filter(u => u.id !== (editingGroup as any).host_id));
        }, 300);
        return () => clearTimeout(timer);
    }, [editCoHostSearchTerm, isEditModalOpen, editingGroup]);

    // Precarga de términos de búsqueda al abrir el modal
    useEffect(() => {
        if (isEditModalOpen && editingGroup.leaderName && !editHostSearchTerm) {
            setEditHostSearchTerm(`${editingGroup.leaderName} ${editingGroup.leaderSurname || ''}`.trim());
        }
        if (isEditModalOpen && editingGroup.coHostFirstName && !editCoHostSearchTerm) {
            setEditCoHostSearchTerm(`${editingGroup.coHostFirstName} ${editingGroup.coHostLastName || ''}`.trim());
        }
    }, [isEditModalOpen]);

    const filteredAdminGroups = useMemo(() => {
        let filtered = adminGroups;

        if (adminFilterMode === 'MANUAL') {
            if (adminStatusFilter !== 'ALL') {
                filtered = filtered.filter(g => {
                    const isFinished = isGroupFinished(g);
                    if (adminStatusFilter === 'APPROVED') return g.status === 'approved' && !isFinished;
                    if (adminStatusFilter === 'FINALIZED') return g.status === 'approved' && isFinished;
                    if (adminStatusFilter === 'PENDING') return g.status === 'pending' || !g.status;
                    return true;
                });
            }
        } else {
            filtered = filtered.filter(g => {
                if (!g.startDate) return false;
                const season = getSeasonFromDate(g.startDate);
                return season === adminSeasonFilter;
            });
        }

        if (adminSearchTerm.trim()) {
            const term = adminSearchTerm.toLowerCase().trim();
            filtered = filtered.filter(g => {
                const groupName = g.name?.toLowerCase() || '';
                const leaderName = `${g.leaderName || ''} ${g.leaderSurname || ''}`.toLowerCase();
                const categoryName = categories.find(c => c.id === g.categoryId)?.name?.toLowerCase() || '';
                const location = g.location?.toLowerCase() || '';
                return groupName.includes(term) ||
                    leaderName.includes(term) ||
                    categoryName.includes(term) ||
                    location.includes(term);
            });
        }

        return filtered;
    }, [adminGroups, adminStatusFilter, adminSearchTerm, categories, adminFilterMode, adminSeasonFilter]);

    // ── Acciones ──────────────────────────────
    const handleApproveGroup = async (groupId: string, note?: string) => {
        setIsReviewLoading(true);
        try {
            const success = await supabaseService.updateGroupStatus(groupId, 'approved', note);
            if (success) {
                showToast('Grupo aprobado exitosamente', 'success');
                setReviewingGroup(null);
                fetchAdminGroups();
            } else {
                showToast('Error al aprobar el grupo', 'error');
            }
        } catch (error) {
            console.error('Error approving group:', error);
            showToast('Error al aprobar el grupo', 'error');
        } finally {
            setIsReviewLoading(false);
        }
    };

    const handleRejectGroup = async (groupId: string, note?: string) => {
        setIsReviewLoading(true);
        try {
            const success = await supabaseService.updateGroupStatus(groupId, 'rejected', note);
            if (success) {
                showToast('Grupo rechazado', 'success');
                setReviewingGroup(null);
                fetchAdminGroups();
            } else {
                showToast('Error al rechazar el grupo', 'error');
            }
        } catch (error) {
            console.error('Error rejecting group:', error);
            showToast('Error al rechazar el grupo', 'error');
        } finally {
            setIsReviewLoading(false);
        }
    };

    const handleReopenGroup = (groupId: string) => {
        const group = adminGroups.find(g => g.id === groupId);
        if (!group) return;
        setGroupToReopen(group);
        setIsReopenModalOpen(true);
    };

    const handleDeleteGroup = async (id: string) => {
        if (!window.confirm('¿Estás seguro que deseas eliminar este grupo? Esta acción no se puede deshacer.')) {
            return;
        }
        const success = await deleteGroupDirect(id);
        if (success) {
            fetchAdminGroups();
            showToast('Grupo eliminado');
        } else {
            showToast('Error al eliminar grupo', 'error');
        }
    };

    const handleToggleCapacityLock = async (group: Group) => {
        const nuevoEstado = !group.capacityLocked;
        const ok = await toggleGroupCapacityLock(group.id, nuevoEstado);
        if (ok) {
            fetchAdminGroups();
            showToast(nuevoEstado ? 'Cupos bloqueados — el grupo se muestra como LLENO' : 'Cupos desbloqueados');
        } else {
            showToast('Error al cambiar el bloqueo de cupos', 'error');
        }
    };

    const openEditModal = (group?: Group) => {
        if (group) {
            setEditingGroup({ ...group });
        } else {
            setEditingGroup({
                name: '', leaderName: '', leaderSurname: '', leaderPhone: '',
                meetingDay: 'Lunes', meetingTime: '20:00', startDate: new Date().toISOString().split('T')[0], endDate: '',
                location: '', membersCount: 0, maxCapacity: 12, description: '', imageUrl: '', categoryId: '', tags: []
            });
        }
        setIsEditModalOpen(true);
    };

    const handleSaveGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (!editingGroup.name || !editingGroup.leaderName) {
                showToast('Nombre del grupo y anfitrión son obligatorios', 'error');
                return;
            }

            const isEditing = !!editingGroup.id;
            const groupToSave: Group = {
                ...editingGroup as Group,
                id: editingGroup.id || generateUUID(),
                leaderSurname: editingGroup.leaderSurname || '',
                leaderPhone: editingGroup.leaderPhone || '',
                description: editingGroup.description || '',
                imageUrl: editingGroup.imageUrl || '',
                tags: editingGroup.tags || [],
                registrations: editingGroup.registrations || []
            };

            let saved;
            if (isEditing) {
                saved = await updateGroupDirect(groupToSave);
            } else {
                saved = await insertGroupDirect(groupToSave);
            }

            if (saved && (editingGroup as any).host_id) {
                await supabaseService.linkUserToGroup((editingGroup as any).host_id, saved.id);
            }

            if (saved) {
                fetchAdminGroups();
                setIsEditModalOpen(false);
                showToast(isEditing ? 'Grupo actualizado exitosamente' : 'Grupo creado exitosamente');
            } else {
                showToast('Error al guardar en Supabase', 'error');
            }
        } catch (error: any) {
            console.error('[handleSaveGroup] Unexpected error:', error);
            showToast('Error inesperado: ' + (error.message || error), 'error');
        }
    };

    return (
        <>
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <GroupsAdminToolbar
                    searchTerm={adminSearchTerm}
                    setSearchTerm={setAdminSearchTerm}
                    filterMode={adminFilterMode}
                    setFilterMode={setAdminFilterMode}
                    statusFilter={adminStatusFilter}
                    setStatusFilter={setAdminStatusFilter}
                    seasonFilter={adminSeasonFilter}
                    setSeasonFilter={setAdminSeasonFilter}
                    pendingDropoutCount={pendingDropoutCount}
                    adminGroups={adminGroups}
                    onCreateGroup={() => setIsCreateModalOpen(true)}
                    onAddMember={() => setIsAddMemberModalOpen(true)}
                    onDropoutInbox={() => setIsDropoutInboxOpen(true)}
                    isMobileMenuOpen={isMobileMenuOpen}
                    setIsMobileMenuOpen={setIsMobileMenuOpen}
                />

                {isLoading && adminGroups.length === 0 ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                    </div>
                ) : (
                    <GroupsAdminList
                        groups={filteredAdminGroups}
                        categories={categories}
                        tags={tags}
                        onReview={setReviewingGroup}
                        onReopen={handleReopenGroup}
                        onViewRegistrations={setViewingGroupRegistrations}
                        onEdit={openEditModal}
                        onDelete={handleDeleteGroup}
                        onToggleCapacityLock={handleToggleCapacityLock}
                        openMenuGroupId={openMenuGroupId}
                        setOpenMenuGroupId={setOpenMenuGroupId}
                        isLoading={isLoading}
                    />
                )}
            </div>

            {/* Admin Group Review Modal (Approval Workflow) */}
            {reviewingGroup && (
                <AdminGroupReviewModal
                    group={reviewingGroup}
                    categories={categories}
                    tags={tags}
                    onClose={() => setReviewingGroup(null)}
                    onApprove={handleApproveGroup}
                    onReject={handleRejectGroup}
                    isLoading={isReviewLoading}
                />
            )}

            {/* Modal de re-apertura — Admin */}
            {isReopenModalOpen && groupToReopen && (
                <CreateGroupModal
                    isOpen={isReopenModalOpen}
                    onClose={() => {
                        setIsReopenModalOpen(false);
                        setGroupToReopen(null);
                    }}
                    onSave={() => {
                        setIsReopenModalOpen(false);
                        setGroupToReopen(null);
                        fetchAdminGroups();
                        showToast(
                            'Grupo re-abierto. El nuevo grupo está activo para esta temporada.',
                            'success'
                        );
                    }}
                    editingGroup={groupToReopen}
                    currentUser={currentUser}
                    isAdminView={true}
                    isReopenRequest={true}
                />
            )}

            {/* Admin Create Group Modal */}
            <AdminCreateGroupModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSave={() => {
                    setIsCreateModalOpen(false);
                    fetchAdminGroups();
                }}
                currentUser={currentUser}
            />

            {/* Admin Add Member Modal */}
            <AdminAddMemberModal
                isOpen={isAddMemberModalOpen}
                onClose={() => setIsAddMemberModalOpen(false)}
                onSave={() => {
                    fetchAdminGroups();
                }}
                groups={adminGroups}
                categories={categories}
            />

            {/* Group Registrations Modal */}
            {viewingGroupRegistrations && (
                <ApplicantsModal
                    isOpen={!!viewingGroupRegistrations}
                    onClose={() => setViewingGroupRegistrations(null)}
                    groupId={viewingGroupRegistrations.id}
                    groupName={viewingGroupRegistrations.name}
                />
            )}

            {/* Admin Dropout Inbox Modal */}
            <AdminDropoutInbox
                isOpen={isDropoutInboxOpen}
                onClose={() => setIsDropoutInboxOpen(false)}
                onActionComplete={() => {
                    supabaseService.countPendingDropoutRequests().then(setPendingDropoutCount);
                    fetchAdminGroups();
                }}
            />

            {/* Modal de edición de grupo */}
            {isEditModalOpen && (
                <NeoModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    title={editingGroup.id ? 'Editar Grupo' : 'Nuevo Grupo'}
                >
                    <form onSubmit={handleSaveGroup} className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                            <div><label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Nombre del Grupo</label><input type="text" value={editingGroup.name || ''} onChange={e => setEditingGroup({ ...editingGroup, name: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm font-bold" /></div>
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Categoría</label>
                                <select value={editingGroup.categoryId || ''} onChange={e => setEditingGroup({ ...editingGroup, categoryId: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm bg-white">
                                    <option value="">Seleccionar...</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-4">
                            <label className="text-xs font-bold uppercase text-slate-500 mb-2 block flex items-center gap-2">
                                <Users className="w-3 h-3" /> Asignar Anfitrión
                            </label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <Search className="w-4 h-4 text-slate-400" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Buscar anfitrión..."
                                    value={editHostSearchTerm}
                                    onFocus={() => setIsEditHostSelectOpen(true)}
                                    onChange={e => {
                                        setEditHostSearchTerm(e.target.value);
                                        setIsEditHostSelectOpen(true);
                                    }}
                                    className="w-full pl-10 pr-10 p-3 border border-slate-300 rounded-lg outline-none focus:border-black text-sm bg-white"
                                />
                                {isEditHostSelectOpen && (
                                    <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto z-50">
                                        {editPotentialHosts.length > 0 ? (
                                            editPotentialHosts.map(u => (
                                                <div
                                                    key={u.id}
                                                    onClick={() => {
                                                        const parts = u.name.trim().split(/\s+/);
                                                        const fName = parts.length > 0 ? parts[0] : '';
                                                        const lName = parts.length > 1 ? parts.slice(1).join(' ') : '';
                                                        setEditingGroup({
                                                            ...editingGroup,
                                                            host_id: u.id,
                                                            leaderName: fName,
                                                            leaderSurname: lName,
                                                            leaderPhone: u.phone || editingGroup.leaderPhone
                                                        } as any);
                                                        setEditHostSearchTerm(u.name);
                                                        setIsEditHostSelectOpen(false);
                                                    }}
                                                    className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                                                >
                                                    <p className="font-bold text-sm text-slate-900">{u.name}</p>
                                                    <p className="text-xs text-slate-500">{u.email}</p>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-3 text-center text-xs text-slate-400">No se encontraron usuarios.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2 mb-2">O ingresá los datos del anfitrión manualmente:</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Nombre *</label>
                                    <input type="text" value={editingGroup.leaderName || ''} onChange={e => setEditingGroup({ ...editingGroup, leaderName: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-black" placeholder="Ej. Juan" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Apellido *</label>
                                    <input type="text" value={editingGroup.leaderSurname || ''} onChange={e => setEditingGroup({ ...editingGroup, leaderSurname: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-black" placeholder="Ej. Pérez" />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <div><label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Día</label><select value={editingGroup.meetingDay || 'Lunes'} onChange={e => setEditingGroup({ ...editingGroup, meetingDay: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm bg-white"><option>Lunes</option><option>Martes</option><option>Miércoles</option><option>Jueves</option><option>Viernes</option><option>Sábado</option><option>Domingo</option></select></div>
                            <div><label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Hora</label><input type="time" value={editingGroup.meetingTime || ''} onChange={e => setEditingGroup({ ...editingGroup, meetingTime: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm" /></div>
                            <div><label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Capacidad Max</label><input type="number" value={editingGroup.maxCapacity || 12} onChange={e => setEditingGroup({ ...editingGroup, maxCapacity: parseInt(e.target.value) })} className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm" /></div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 mb-1 h-8 flex items-end">Fecha de Arranque</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        readOnly
                                        value={formatDateForDisplay(editingGroup.startDate)}
                                        placeholder="DD/MM/AAAA"
                                        className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm pointer-events-none bg-white text-black"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <Calendar className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="date"
                                        value={formatDateForInput(editingGroup.startDate)}
                                        onChange={e => setEditingGroup({ ...editingGroup, startDate: e.target.value })}
                                        onClick={(e) => {
                                            try {
                                                if (typeof (e.currentTarget as any).showPicker === 'function') {
                                                    (e.currentTarget as any).showPicker();
                                                }
                                            } catch (error) { }
                                        }}
                                        className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Inicio oficial del grupo.</p>
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 mb-1 h-8 flex items-end">Fin del Grupo</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        readOnly
                                        value={formatDateForDisplay(editingGroup.endDate)}
                                        placeholder="Indefinido"
                                        className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm bg-white text-black font-bold pointer-events-none"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                        <Calendar className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="date"
                                        value={formatDateForInput(editingGroup.endDate)}
                                        onChange={e => setEditingGroup({ ...editingGroup, endDate: e.target.value })}
                                        onClick={(e) => {
                                            try {
                                                if (typeof (e.currentTarget as any).showPicker === 'function') {
                                                    (e.currentTarget as any).showPicker();
                                                }
                                            } catch (error) { }
                                        }}
                                        className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Fecha de cierre administrativo del grupo.</p>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Ubicación / Dirección</label>
                            <input type="text" value={editingGroup.location || ''} onChange={e => setEditingGroup({ ...editingGroup, location: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm" placeholder="Ej. Calle Falsa 123" />
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Género Objetivo</label>
                            <select
                                value={editingGroup.targetGender || 'Mixto'}
                                onChange={e => setEditingGroup({ ...editingGroup, targetGender: e.target.value as 'Hombre' | 'Mujer' | 'Mixto' })}
                                className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm bg-white"
                            >
                                <option value="Mixto">Mixto (Todos)</option>
                                <option value="Hombre">Solo Hombres</option>
                                <option value="Mujer">Solo Mujeres</option>
                            </select>
                            <p className="text-[10px] text-slate-400 mt-1">Define quién puede inscribirse a este grupo.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Edad Mínima</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={editingGroup.minAge || 0}
                                    onChange={e => setEditingGroup({ ...editingGroup, minAge: parseInt(e.target.value) || 0 })}
                                    className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm"
                                    placeholder="Ej. 18"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Edad Máxima</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={editingGroup.maxAge || 99}
                                    onChange={e => setEditingGroup({ ...editingGroup, maxAge: parseInt(e.target.value) || 99 })}
                                    className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm"
                                    placeholder="Ej. 35"
                                />
                            </div>
                        </div>

                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                            <label className="text-xs font-bold uppercase text-purple-600 mb-2 block flex items-center gap-2">
                                <Users className="w-3 h-3" /> Co-Anfitrión (Opcional)
                            </label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <Search className="w-4 h-4 text-slate-400" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Buscar co-anfitrión..."
                                    value={editCoHostSearchTerm}
                                    onFocus={() => setIsEditCoHostSelectOpen(true)}
                                    onChange={e => {
                                        setEditCoHostSearchTerm(e.target.value);
                                        setIsEditCoHostSelectOpen(true);
                                    }}
                                    className="w-full pl-10 pr-10 p-3 border border-slate-300 rounded-lg outline-none focus:border-purple-500 text-sm bg-white"
                                />
                                {(editingGroup as any).co_host_id && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditingGroup({ ...editingGroup, co_host_id: undefined, coHostFirstName: '', coHostLastName: '' } as any);
                                            setEditCoHostSearchTerm('');
                                        }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-red-100 text-red-500 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                                {isEditCoHostSelectOpen && (
                                    <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto z-50">
                                        {editPotentialCoHosts.length > 0 ? (
                                            editPotentialCoHosts.map(u => (
                                                <div
                                                    key={u.id}
                                                    onClick={() => {
                                                        const parts = u.name.trim().split(/\s+/);
                                                        setEditingGroup({
                                                            ...editingGroup,
                                                            co_host_id: u.id,
                                                            coHostFirstName: parts[0] || u.name,
                                                            coHostLastName: parts.slice(1).join(' ') || ''
                                                        } as any);
                                                        setEditCoHostSearchTerm(u.name);
                                                        setIsEditCoHostSelectOpen(false);
                                                    }}
                                                    className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                                                >
                                                    <p className="font-bold text-sm text-slate-900">{u.name}</p>
                                                    <p className="text-xs text-slate-500">{u.email}</p>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-3 text-center text-xs text-slate-400">No se encontraron usuarios.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <p className="text-[10px] text-purple-500 mt-2">El co-anfitrión también verá este grupo en su panel.</p>
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-2 block">Imagen Portada</label>
                            <ImageUpload
                                currentImage={editingGroup.imageUrl || ''}
                                folder="groups"
                                onImageUpload={(url) => setEditingGroup({ ...editingGroup, imageUrl: url })}
                                aspectRatio="wide"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Descripción</label>
                            <textarea value={editingGroup.description || ''} onChange={e => setEditingGroup({ ...editingGroup, description: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm h-24 resize-none" placeholder="Breve descripción del grupo..."></textarea>
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-2 block">Etiquetas</label>
                            <div className="flex flex-wrap gap-2">
                                {tags.map(tag => {
                                    const isSelected = (editingGroup.tags || []).includes(tag.id);
                                    return (
                                        <button
                                            type="button"
                                            key={tag.id}
                                            onClick={() => {
                                                const current = editingGroup.tags || [];
                                                const next = isSelected ? current.filter(t => t !== tag.id) : [...current, tag.id];
                                                setEditingGroup({ ...editingGroup, tags: next });
                                            }}
                                            className={`px-3 py-1 text-xs border rounded-full font-bold uppercase transition-colors ${isSelected ? 'bg-black text-white border-black' : 'bg-white text-slate-500 border-slate-200'}`}
                                        >
                                            {tag.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                            <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-6 py-3 text-xs font-bold uppercase text-slate-500 hover:text-black">Cancelar</button>
                            <button type="submit" className="px-8 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-slate-800 rounded-lg shadow-lg">Guardar Grupo</button>
                        </div>
                    </form>
                </NeoModal>
            )}
        </>
    );
};

const GestionDeGrupos: React.FC = () => (
    <AdminGCXLayout title="Gestión de Grupos">
        <GestionDeGruposContent />
    </AdminGCXLayout>
);

export default GestionDeGrupos;
