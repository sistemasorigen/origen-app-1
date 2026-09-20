import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Group, GroupCategory, GroupTag } from '../../types';
import { supabaseService, deleteGroupDirect, toggleGroupCapacityLock, toggleGroupVisibility } from '../../services/supabaseService';
import AdminGCXLayout, { useAdminGCXToast, usePanelGCXConteos } from '../../components/layout/AdminGCXLayout';

import GroupsAdminToolbar, { EstadoGrupo, TemporadaFiltro } from '../../components/GCX/BarraHerramientasGruposAdmin';
import GroupsAdminList from '../../components/GCX/ListaGruposAdmin';
import ModalModeracionGrupos from '../../components/GCX/ModalModeracionGrupos';
import CreateGroupModal from '../../components/GCX/ModalCrearGrupo';

import { useAuth } from '../../contexts/AuthContext';

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

const NOMBRE_TEMPORADA: Record<Exclude<TemporadaFiltro, 'ALL'>, string> = {
    S1: 'temporada 1',
    S2: 'temporada 2',
    S3: 'temporada 3',
};

const GestionDeGruposContent: React.FC = () => {
    const { showToast } = useAdminGCXToast();
    const { registrarConteo } = usePanelGCXConteos();
    const { user: currentUser } = useAuth();
    const navigate = useNavigate();

    const [adminGroups, setAdminGroups] = useState<Group[]>([]);
    const [categories, setCategories] = useState<GroupCategory[]>([]);
    const [tags, setTags] = useState<GroupTag[]>([]);
    const [pendingDropoutCount, setPendingDropoutCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    // Filtros. A diferencia de antes, el estado y la temporada se aplican
    // juntos: el diseño los muestra en la misma barra y "Todas" deja la
    // lista completa, que es como entraba el panel hasta ahora.
    const [adminStatusFilter, setAdminStatusFilter] = useState<EstadoGrupo>('ALL');
    const [adminSeasonFilter, setAdminSeasonFilter] = useState<TemporadaFiltro>('ALL');
    const [adminSearchTerm, setAdminSearchTerm] = useState('');

    // Selección para las acciones de Moderación
    const [seleccionados, setSeleccionados] = useState<string[]>([]);
    const [moderacionAbierta, setModeracionAbierta] = useState(false);

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

    useEffect(() => {
        if (!isLoading) registrarConteo('grupos', adminGroups.length);
    }, [adminGroups.length, isLoading, registrarConteo]);

    const gruposDeTemporada = useMemo(() => {
        if (adminSeasonFilter === 'ALL') return adminGroups;
        return adminGroups.filter(g => g.startDate && getSeasonFromDate(g.startDate) === adminSeasonFilter);
    }, [adminGroups, adminSeasonFilter]);

    const filteredAdminGroups = useMemo(() => {
        let filtered = gruposDeTemporada;

        if (adminStatusFilter !== 'ALL') {
            filtered = filtered.filter(g => {
                const isFinished = isGroupFinished(g);
                if (adminStatusFilter === 'APPROVED') return g.status === 'approved' && !isFinished;
                if (adminStatusFilter === 'FINALIZED') return g.status === 'approved' && isFinished;
                if (adminStatusFilter === 'PENDING') return g.status === 'pending' || !g.status;
                return true;
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
    }, [gruposDeTemporada, adminStatusFilter, adminSearchTerm, categories]);

    // Al cambiar los filtros, lo tildado que ya no está a la vista se suelta:
    // si no, se podría borrar un grupo que la persona dejó de ver.
    useEffect(() => {
        setSeleccionados(prev => prev.filter(id => filteredAdminGroups.some(g => g.id === id)));
    }, [filteredAdminGroups]);

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

    const handleToggleVisibility = async (group: Group) => {
        const nuevoEstado = !group.isHidden;
        const ok = await toggleGroupVisibility(group.id, nuevoEstado);
        if (ok) {
            fetchAdminGroups();
            showToast(nuevoEstado ? 'Grupo oculto de /gcx' : 'Grupo visible nuevamente');
        } else {
            showToast('Error al cambiar la visibilidad del grupo', 'error');
        }
    };

    // ── Moderación ────────────────────────────
    const gruposSeleccionados = adminGroups.filter(g => seleccionados.includes(g.id));

    const handleAprobarSeleccionados = async () => {
        const pendientes = gruposSeleccionados.filter(g => g.status === 'pending' || !g.status);
        if (pendientes.length === 0) return;
        if (!window.confirm(`¿Aprobar ${pendientes.length === 1 ? 'el grupo pendiente tildado' : `los ${pendientes.length} grupos pendientes tildados`}? Quedan visibles en el catálogo.`)) return;

        const resultados = await Promise.all(
            pendientes.map(g => supabaseService.updateGroupStatus(g.id, 'approved'))
        );
        const ok = resultados.filter(Boolean).length;
        setModeracionAbierta(false);
        setSeleccionados([]);
        fetchAdminGroups();
        if (ok === pendientes.length) {
            showToast(ok === 1 ? 'Grupo aprobado' : `${ok} grupos aprobados`);
        } else {
            showToast(`Se aprobaron ${ok} de ${pendientes.length}. Probá de nuevo con los que quedaron.`, 'error');
        }
    };

    const handleEliminarSeleccionados = async () => {
        if (gruposSeleccionados.length === 0) return;
        if (!window.confirm(`¿Eliminar ${gruposSeleccionados.length === 1 ? 'el grupo tildado' : `los ${gruposSeleccionados.length} grupos tildados`}? Esta acción no se puede deshacer.`)) return;

        const resultados = await Promise.all(gruposSeleccionados.map(g => deleteGroupDirect(g.id)));
        const ok = resultados.filter(Boolean).length;
        setModeracionAbierta(false);
        setSeleccionados([]);
        fetchAdminGroups();
        if (ok === gruposSeleccionados.length) {
            showToast(ok === 1 ? 'Grupo eliminado' : `${ok} grupos eliminados`);
        } else {
            showToast(`Se eliminaron ${ok} de ${gruposSeleccionados.length}.`, 'error');
        }
    };

    // El archivo se arma con los datos que la lista ya tiene en pantalla:
    // no se pide nada nuevo ni sale nada del dispositivo.
    const handleExportarAnfitriones = () => {
        if (gruposSeleccionados.length === 0) return;
        const columnas = ['Grupo', 'Anfitrión', 'Teléfono', 'Co-anfitrión', 'Día', 'Horario', 'Lugar', 'Estado', 'Inscriptos', 'Cupo'];
        const celda = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const filas = gruposSeleccionados.map(g => [
            g.name,
            `${g.leaderName || ''} ${g.leaderSurname || ''}`.trim(),
            g.leaderPhone || '',
            [g.coHostFirstName, g.coHostLastName].filter(Boolean).join(' '),
            g.meetingDay,
            g.meetingTime,
            g.isOnline ? 'Online' : g.location,
            isGroupFinished(g) ? 'Finalizado' : (g.status || 'pending'),
            g.registrations?.length || 0,
            g.maxCapacity,
        ].map(celda).join(','));

        // El BOM es lo que hace que Excel abra el archivo como UTF-8 y no
        // rompa los acentos; el salto CRLF es el que espera el mismo Excel.
        const BOM = String.fromCharCode(0xFEFF);
        const csv = BOM + [columnas.map(celda).join(','), ...filas].join('\r\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `anfitriones-gcx-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        setModeracionAbierta(false);
        showToast(`Archivo con ${gruposSeleccionados.length} ${gruposSeleccionados.length === 1 ? 'grupo' : 'grupos'} descargado`);
    };

    const limpiarFiltros = () => {
        setAdminStatusFilter('ALL');
        setAdminSeasonFilter('ALL');
        setAdminSearchTerm('');
    };

    const hayFiltros = adminStatusFilter !== 'ALL' || adminSeasonFilter !== 'ALL' || adminSearchTerm.trim() !== '';
    const dondeMira = adminSeasonFilter === 'ALL' ? 'el panel' : `la ${NOMBRE_TEMPORADA[adminSeasonFilter]}`;

    return (
        <>
            <GroupsAdminToolbar
                searchTerm={adminSearchTerm}
                setSearchTerm={setAdminSearchTerm}
                statusFilter={adminStatusFilter}
                setStatusFilter={setAdminStatusFilter}
                seasonFilter={adminSeasonFilter}
                setSeasonFilter={setAdminSeasonFilter}
                gruposDeTemporada={gruposDeTemporada}
                resultados={filteredAdminGroups.length}
                pendingDropoutCount={pendingDropoutCount}
                onCreateGroup={() => navigate('/admingcx/gestion-de-grupos/crear-grupo')}
                onOpenModeracion={() => setModeracionAbierta(true)}
                onResetFiltros={limpiarFiltros}
            />

            <GroupsAdminList
                groups={filteredAdminGroups}
                categories={categories}
                tags={tags}
                onReview={(group) => navigate(`/admingcx/gestion-de-grupos/detalles/${group.id}`)}
                onReopen={handleReopenGroup}
                onViewRegistrations={(group) => navigate(`/admingcx/gestion-de-grupos/inscriptos/${group.id}`)}
                onAddMember={(group) => navigate(`/admingcx/gestion-de-grupos/agregar-grupo?grupo=${encodeURIComponent(group.id)}`)}
                onEdit={(group) => navigate(`/admingcx/gestion-de-grupos/editar-grupo/${group.id}`)}
                onDelete={handleDeleteGroup}
                onToggleCapacityLock={handleToggleCapacityLock}
                onToggleVisibility={handleToggleVisibility}
                openMenuGroupId={openMenuGroupId}
                setOpenMenuGroupId={setOpenMenuGroupId}
                isLoading={isLoading && adminGroups.length === 0}
                seleccionados={seleccionados}
                onToggleSeleccion={(id) => setSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                onToggleTodos={() => setSeleccionados(prev =>
                    filteredAdminGroups.every(g => prev.includes(g.id)) ? [] : filteredAdminGroups.map(g => g.id)
                )}
                resumen={`Mostrando ${filteredAdminGroups.length} de ${gruposDeTemporada.length} grupos${adminSeasonFilter === 'ALL' ? '' : ` de la ${NOMBRE_TEMPORADA[adminSeasonFilter]}`}.`}
                vacioTitulo={hayFiltros ? 'Ningún grupo coincide' : `Todavía no hay grupos en ${dondeMira}`}
                vacioTexto={hayFiltros
                    ? 'Probá con otro estado, otra temporada, o buscá por el nombre del anfitrión en vez del grupo.'
                    : 'Los grupos se crean unas semanas antes de que arranque la temporada. Podés crear el primero desde acá.'}
                vacioAccion={hayFiltros ? 'Limpiar los filtros' : 'Crear grupo'}
                onVacioAccion={hayFiltros ? limpiarFiltros : () => navigate('/admingcx/gestion-de-grupos/crear-grupo')}
            />

            {/* Crear grupo — mobile */}
            <button
                onClick={() => navigate('/admingcx/gestion-de-grupos/crear-grupo')}
                className="mt-4 flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-[#0a0a0a] text-[16px] font-semibold text-white md:hidden"
            >
                <span className="text-[20px] leading-none">+</span>
                Crear grupo
            </button>

            <ModalModeracionGrupos
                isOpen={moderacionAbierta}
                onClose={() => setModeracionAbierta(false)}
                seleccionados={gruposSeleccionados}
                pendingDropoutCount={pendingDropoutCount}
                onSolicitudesDeBaja={() => navigate('/admingcx/gestion-de-grupos/bajas')}
                onAgregarMiembro={() => navigate('/admingcx/gestion-de-grupos/agregar-grupo')}
                onAprobarSeleccionados={handleAprobarSeleccionados}
                onExportarAnfitriones={handleExportarAnfitriones}
                onEliminarSeleccionados={handleEliminarSeleccionados}
            />

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
    <AdminGCXLayout title="Grupos">
        <GestionDeGruposContent />
    </AdminGCXLayout>
);

export default GestionDeGrupos;
