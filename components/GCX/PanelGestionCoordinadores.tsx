import React, { useState, useEffect } from 'react';
import { User, UserRole, CoordinatorVariant } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { Search, X, Loader2, Plus } from 'lucide-react';
import ModalPanelGCX, { BotonPrincipal, BotonSecundario } from './ModalPanelGCX';
import { usePanelGCXConteos } from '../layout/AdminGCXLayout';

/**
 * Sección Coordinadores del panel (design-claude/Admin GCX - Panel).
 *
 * Una tarjeta por persona con los departamentos que supervisa. Los
 * departamentos son la "zona" del diseño: es el dato que decide qué grupos
 * ve cada coordinador.
 */

interface CoordinatorsManagementPanelProps {
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const iniciales = (nombre: string) =>
    (nombre || '').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';

const nombreVariante = (v: string) => {
    const limpio = v.replace(/_/g, ' ').toLowerCase();
    return limpio.charAt(0).toUpperCase() + limpio.slice(1);
};

const CoordinatorsManagementPanel: React.FC<CoordinatorsManagementPanelProps> = ({ showToast }) => {
    const { registrarConteo } = usePanelGCXConteos();
    const [isLoading, setIsLoading] = useState(false);
    const [coordinators, setCoordinators] = useState<User[]>([]);

    const [searchTerm, setSearchTerm] = useState('');
    const [variantFilter, setVariantFilter] = useState<'ALL' | CoordinatorVariant>('ALL');

    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [newSearchTerm, setNewSearchTerm] = useState('');
    const [newResults, setNewResults] = useState<User[]>([]);
    const [isSearchingNew, setIsSearchingNew] = useState(false);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editingVariants, setEditingVariants] = useState<CoordinatorVariant[]>([]);

    const getUserVariants = (user: User): CoordinatorVariant[] =>
        user.coordinatorVariants && user.coordinatorVariants.length > 0
            ? user.coordinatorVariants
            : (user.coordinatorVariant ? [user.coordinatorVariant] : []);

    const toggleEditingVariant = (variant: CoordinatorVariant) => {
        setEditingVariants(prev =>
            prev.includes(variant) ? prev.filter(v => v !== variant) : [...prev, variant]
        );
    };

    const fetchCoordinators = async () => {
        setIsLoading(true);
        try {
            const users = await supabaseService.getUsersByRole(UserRole.COORDINATOR);
            setCoordinators(users);
        } catch (error) {
            console.error('Error fetching coordinators:', error);
            showToast('Error al cargar coordinadores', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCoordinators();
    }, []);

    // El número que muestra la pestaña Coordinadores del panel.
    useEffect(() => {
        if (coordinators.length > 0) registrarConteo('coordinadores', coordinators.length);
    }, [coordinators.length, registrarConteo]);

    useEffect(() => {
        if (!isNewModalOpen || !newSearchTerm.trim()) {
            setNewResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearchingNew(true);
            try {
                const results = await supabaseService.searchUsersGlobal(newSearchTerm);
                const existingIds = new Set(coordinators.map(c => c.id));
                setNewResults(results.filter(u => !existingIds.has(u.id)));
            } catch (err) {
                console.error(err);
            } finally {
                setIsSearchingNew(false);
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [newSearchTerm, isNewModalOpen, coordinators]);

    const handleSelectNewCoordinator = (user: User) => {
        setIsNewModalOpen(false);
        setNewSearchTerm('');
        setEditingUser(user);
        setEditingVariants([]);
        setIsEditModalOpen(true);
    };

    const handleEditClick = (user: User) => {
        setEditingUser(user);
        setEditingVariants(getUserVariants(user));
        setIsEditModalOpen(true);
    };

    const handleSaveCoordinator = async () => {
        if (!editingUser) return;
        if (editingVariants.length === 0) {
            showToast('Elegí al menos un departamento', 'error');
            return;
        }

        setIsLoading(true);
        try {
            const result = await supabaseService.updateUserRole(editingUser.id, UserRole.COORDINATOR, editingVariants[0], editingVariants);

            if (result.success) {
                showToast('Coordinador guardado');
                setIsEditModalOpen(false);
                setEditingUser(null);
                setEditingVariants([]);
                fetchCoordinators();
            } else {
                showToast(result.error || 'Error al actualizar el usuario', 'error');
            }
        } catch (error) {
            console.error('Save coordinator error:', error);
            showToast('Error de sistema', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveRole = async (user: User) => {
        if (!window.confirm(`¿Estás seguro de quitar el rol de Coordinador a ${user.name}?`)) return;

        setIsLoading(true);
        try {
            const result = await supabaseService.removeUserRole(user.id, UserRole.COORDINATOR);
            if (result.success) {
                showToast('Rol de coordinador quitado');
                fetchCoordinators();
            } else {
                showToast(result.error || 'Error al remover el rol', 'error');
            }
        } catch (error) {
            console.error('Remove role error:', error);
            showToast('Error de sistema', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredCoordinators = coordinators.filter(c => {
        const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchVariant = variantFilter === 'ALL' || getUserVariants(c).includes(variantFilter);
        return matchSearch && matchVariant;
    });

    const chip = (activo: boolean) =>
        `h-9 px-3.5 rounded-full flex items-center gap-2 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${activo ? 'bg-[#0a0a0a] text-white' : 'bg-white text-black/[.64] hover:text-[#0a0a0a]'}`;

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
                        placeholder="Buscar un coordinador"
                        aria-label="Buscar un coordinador"
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
                    onClick={() => setIsNewModalOpen(true)}
                    className="flex h-[42px] flex-none items-center gap-2 rounded-full bg-[#0a0a0a] px-5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                >
                    <Plus className="h-[15px] w-[15px]" />
                    Sumar coordinador
                </button>
            </div>

            {/* Filtro por departamento */}
            <div className="mt-3.5 flex flex-wrap gap-2">
                <button onClick={() => setVariantFilter('ALL')} className={chip(variantFilter === 'ALL')}>
                    Todos los departamentos
                </button>
                {Object.values(CoordinatorVariant).map(v => (
                    <button key={v} onClick={() => setVariantFilter(v)} className={chip(variantFilter === v)}>
                        {nombreVariante(v)}
                    </button>
                ))}
            </div>

            {/* Tarjetas */}
            {isLoading && coordinators.length === 0 ? (
                <div className="mt-3.5 flex justify-center rounded-[20px] bg-white py-20">
                    <Loader2 className="h-7 w-7 animate-spin text-black/20" />
                </div>
            ) : filteredCoordinators.length === 0 ? (
                <div className="mt-3.5 flex flex-col items-center rounded-[20px] bg-white px-8 py-14 text-center">
                    <div className="h-[88px] w-[88px] rounded-full" style={{ background: 'repeating-linear-gradient(135deg,#eceae6 0 8px,#e3e1dc 8px 16px)' }} />
                    <p className="mt-[22px] text-[17px] font-semibold text-[#0a0a0a]">Ningún coordinador coincide</p>
                    <p className="mt-[9px] max-w-[340px] text-[13.5px] font-medium leading-[1.6] text-black/[.62]">
                        Probá con otro departamento, o sumá a alguien con el botón de arriba.
                    </p>
                </div>
            ) : (
                <div className="mt-3.5 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))]">
                    {filteredCoordinators.map(user => {
                        const variantes = getUserVariants(user);
                        return (
                            <div key={user.id} className="rounded-[20px] bg-white p-[18px]">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full bg-[#f2f2f0] text-[13px] font-semibold text-black/[.62]">
                                        {iniciales(user.name)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-[15px] font-semibold text-[#0a0a0a]">{user.name}</p>
                                        <p className="mt-[3px] truncate text-[12.5px] font-medium text-black/[.62]">{user.email}</p>
                                    </div>
                                </div>

                                <div className="mt-3.5 flex flex-wrap gap-1.5">
                                    {variantes.length > 0 ? variantes.map(v => (
                                        <span key={v} className="flex h-[26px] items-center rounded-full bg-[#f7f7f5] px-[11px] text-[12px] font-semibold text-black/[.66]">
                                            {nombreVariante(v)}
                                        </span>
                                    )) : (
                                        <span className="flex h-[26px] items-center rounded-full bg-[#fdf0dc] px-[11px] text-[12px] font-semibold text-[#7a4f10]">
                                            Sin departamento asignado
                                        </span>
                                    )}
                                </div>

                                <div className="mt-3.5 flex gap-2">
                                    <button
                                        onClick={() => handleEditClick(user)}
                                        className="h-10 flex-1 rounded-full bg-[#f2f2f0] text-[13px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                    >
                                        Cambiar departamentos
                                    </button>
                                    <button
                                        onClick={() => handleRemoveRole(user)}
                                        className="h-10 rounded-full bg-[#fdecea] px-[15px] text-[13px] font-semibold text-[#a32218] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                    >
                                        Quitar
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Sumar coordinador */}
            <ModalPanelGCX
                isOpen={isNewModalOpen}
                onClose={() => setIsNewModalOpen(false)}
                titulo="Sumar un coordinador"
                subtitulo="Buscá a la persona; después elegís qué departamentos supervisa."
            >
                <div className="flex h-[52px] items-center gap-2.5 rounded-[18px] bg-[#f7f7f5] px-[17px]">
                    <Search className="h-4 w-4 flex-none text-black/[.58]" />
                    <input
                        type="text"
                        value={newSearchTerm}
                        onChange={(e) => setNewSearchTerm(e.target.value)}
                        placeholder="Buscar por nombre o email"
                        autoFocus
                        className="campo-desnudo min-w-0 flex-1 bg-transparent text-[14.5px] font-medium text-[#0a0a0a]"
                    />
                    {isSearchingNew && <Loader2 className="h-4 w-4 flex-none animate-spin text-black/30" />}
                </div>

                <div className="mt-3 min-h-[180px] pb-4">
                    {newResults.length === 0 && newSearchTerm && !isSearchingNew && (
                        <p className="py-6 text-center text-[13px] font-medium text-black/[.55]">
                            Nadie coincide con esa búsqueda.
                        </p>
                    )}
                    {newResults.map(u => (
                        <div key={u.id} className="flex items-center gap-3 border-b border-[#f4f3f1] py-3 last:border-b-0">
                            <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-[#f2f2f0] text-[12.5px] font-semibold text-black/[.62]">
                                {iniciales(u.name)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[13.5px] font-semibold text-[#0a0a0a]">{u.name}</p>
                                <p className="truncate text-[11.5px] font-medium text-black/[.62]">{u.email}</p>
                            </div>
                            <button
                                onClick={() => handleSelectNewCoordinator(u)}
                                className="h-8 flex-none rounded-full bg-[#0a0a0a] px-[13px] text-[12px] font-semibold text-white"
                            >
                                Elegir
                            </button>
                        </div>
                    ))}
                </div>
            </ModalPanelGCX>

            {/* Departamentos */}
            <ModalPanelGCX
                isOpen={isEditModalOpen && !!editingUser}
                onClose={() => setIsEditModalOpen(false)}
                titulo="Departamentos que supervisa"
                subtitulo={editingUser ? `${editingUser.name} ve los grupos de los departamentos que elijas.` : undefined}
                pie={
                    <>
                        <BotonSecundario onClick={() => setIsEditModalOpen(false)}>Cancelar</BotonSecundario>
                        <BotonPrincipal onClick={handleSaveCoordinator} disabled={isLoading || editingVariants.length === 0}>
                            {isLoading ? 'Guardando…' : 'Guardar'}
                        </BotonPrincipal>
                    </>
                }
            >
                <div className="grid gap-2 pb-1 [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))]">
                    {Object.values(CoordinatorVariant).map(v => {
                        const activo = editingVariants.includes(v);
                        return (
                            <button
                                key={v}
                                onClick={() => toggleEditingVariant(v)}
                                aria-pressed={activo}
                                className={`flex h-[52px] items-center rounded-[18px] px-[17px] text-left text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${activo ? 'bg-[#0a0a0a] text-white' : 'bg-[#f7f7f5] text-[#0a0a0a]'}`}
                            >
                                {nombreVariante(v)}
                            </button>
                        );
                    })}
                </div>
                <p className="mt-3 text-[12.5px] font-medium leading-[1.55] text-black/[.62]">
                    {editingVariants.length === 0
                        ? 'Elegí al menos uno: sin departamento, el coordinador no ve ningún grupo.'
                        : `${editingVariants.length} ${editingVariants.length === 1 ? 'departamento elegido' : 'departamentos elegidos'}.`}
                </p>
            </ModalPanelGCX>
        </>
    );
};

export default CoordinatorsManagementPanel;
