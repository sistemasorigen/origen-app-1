import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Group, GroupCategory, GroupTag } from '../../types';
import { supabaseService, deleteGroupDirect, toggleGroupCapacityLock } from '../../services/supabaseService';
import AdminGCXLayout, { useAdminGCXToast } from '../../components/layout/AdminGCXLayout';

import GroupsAdminToolbar from '../../components/GCX/BarraHerramientasGruposAdmin';
import GroupsAdminList from '../../components/GCX/ListaGruposAdmin';
import CreateGroupModal from '../../components/GCX/ModalCrearGrupo';

import { useAuth } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

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
    const navigate = useNavigate();

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
    const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
    const [groupToReopen, setGroupToReopen] = useState<Group | null>(null);
    const [openMenuGroupId, setOpenMenuGroupId] = useState<string | null>(null);

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
                    onCreateGroup={() => navigate('/admingcx/gestion-de-grupos/crear-grupo')}
                    onAddMember={() => navigate('/admingcx/gestion-de-grupos/agregar-grupo')}
                    onDropoutInbox={() => navigate('/admingcx/gestion-de-grupos/bajas')}
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
                        onReview={(group) => navigate(`/admingcx/gestion-de-grupos/detalles/${group.id}`)}
                        onReopen={handleReopenGroup}
                        onViewRegistrations={(group) => navigate(`/admingcx/gestion-de-grupos/inscriptos/${group.id}`)}
                        onEdit={(group) => navigate(`/admingcx/gestion-de-grupos/editar-grupo/${group.id}`)}
                        onDelete={handleDeleteGroup}
                        onToggleCapacityLock={handleToggleCapacityLock}
                        openMenuGroupId={openMenuGroupId}
                        setOpenMenuGroupId={setOpenMenuGroupId}
                        isLoading={isLoading}
                    />
                )}
            </div>

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

        </>
    );
};

const GestionDeGrupos: React.FC = () => (
    <AdminGCXLayout title="Gestión de Grupos">
        <GestionDeGruposContent />
    </AdminGCXLayout>
);

export default GestionDeGrupos;
