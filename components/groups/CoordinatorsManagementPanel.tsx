import React, { useState, useEffect } from 'react';
import { User, UserRole, CoordinatorVariant } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { Search, Shield, UserPlus, X, Loader2, Edit2, Trash2 } from 'lucide-react';
import NeoModal from '../NeoModal';

interface CoordinatorsManagementPanelProps {
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const CoordinatorsManagementPanel: React.FC<CoordinatorsManagementPanelProps> = ({ showToast }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [coordinators, setCoordinators] = useState<User[]>([]);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [variantFilter, setVariantFilter] = useState<'ALL' | CoordinatorVariant>('ALL');

    // New Coordinator Modal State
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [newSearchTerm, setNewSearchTerm] = useState('');
    const [newResults, setNewResults] = useState<User[]>([]);
    const [isSearchingNew, setIsSearchingNew] = useState(false);

    // Edit Coordinator Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editingVariant, setEditingVariant] = useState<CoordinatorVariant | undefined>(undefined);

    // Fetch Coordinators
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

    // New Coordinator Search Hook
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

    // Handle initial Add Coordinator selection
    const handleSelectNewCoordinator = (user: User) => {
        setIsNewModalOpen(false);
        setNewSearchTerm('');
        setEditingUser(user);
        setEditingVariant(undefined);
        setIsEditModalOpen(true);
    };

    // Open Edit for existing
    const handleEditClick = (user: User) => {
        setEditingUser(user);
        setEditingVariant(user.coordinatorVariant);
        setIsEditModalOpen(true);
    };

    // Save (Add or Update)
    const handleSaveCoordinator = async () => {
        if (!editingUser) return;
        if (!editingVariant) {
            showToast('Debes seleccionar un departamento', 'error');
            return;
        }

        setIsLoading(true);
        try {
            // Apply new roles block logic similar to Admin.tsx
            const currentRoles = editingUser.roles || [editingUser.role];
            const finalRolesArray = Array.from(new Set([...currentRoles, UserRole.COORDINATOR]));

            const newUser: User = {
                ...editingUser,
                roles: finalRolesArray,
                coordinatorVariant: editingVariant
            };

            const success = await supabaseService.updateUser(newUser);
            if (success) {
                showToast('Coordinador guardado exitosamente', 'success');
                setIsEditModalOpen(false);
                setEditingUser(null);
                setEditingVariant(undefined);
                fetchCoordinators();
            } else {
                showToast('Error al actualizar el usuario', 'error');
            }
        } catch (error) {
            console.error('Save coordinator error:', error);
            showToast('Error de sistema', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // Remove Role
    const handleRemoveRole = async (user: User) => {
        if (!window.confirm(`¿Estás seguro de quitar el rol de Coordinador a ${user.name}?`)) return;

        setIsLoading(true);
        try {
            const currentRoles = user.roles || [user.role];
            const finalRolesArray = currentRoles.filter(r => r !== UserRole.COORDINATOR);
            // Default back to VIEWER if somehow they have zero roles
            if (finalRolesArray.length === 0) finalRolesArray.push(UserRole.VIEWER);

            const newUser: User = {
                ...user,
                roles: finalRolesArray,
                coordinatorVariant: undefined
            };

            const success = await supabaseService.updateUser(newUser);
            if (success) {
                showToast('Rol removido exitosamente', 'success');
                fetchCoordinators();
            } else {
                showToast('Error al remover el rol', 'error');
            }
        } catch (error) {
            console.error('Remove role error:', error);
            showToast('Error de sistema', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // Filter Logic
    const filteredCoordinators = coordinators.filter(c => {
        const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchVariant = variantFilter === 'ALL' || c.coordinatorVariant === variantFilter;
        return matchSearch && matchVariant;
    });

    return (
        <div className="flex flex-col gap-6 w-full min-w-0 bg-white rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
            {/* TOOLBAR */}
            <div className="p-4 border-b-2 border-black bg-emerald-50 flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex items-center gap-2">
                    <Shield className="w-6 h-6 text-emerald-700" />
                    <h2 className="text-lg font-black uppercase tracking-tight text-emerald-900">Gestión de Coordinadores</h2>
                    <span className="bg-emerald-700 text-white px-2 py-0.5 text-xs rounded-full font-bold">{coordinators.length}</span>
                </div>

                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                    {/* SEARCH */}
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
                        <input
                            type="text"
                            placeholder="BUSCAR..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-xs font-bold border-2 border-black rounded-lg focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] outline-none uppercase bg-white"
                        />
                    </div>

                    {/* VARIANT FILTER */}
                    <select
                        value={variantFilter}
                        onChange={(e) => setVariantFilter(e.target.value as any)}
                        className="w-full md:w-auto px-3 py-2 text-xs font-bold border-2 border-black rounded-lg bg-white uppercase focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] outline-none"
                    >
                        <option value="ALL">Todas las Categorías</option>
                        {Object.values(CoordinatorVariant).map(v => (
                            <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                        ))}
                    </select>

                    {/* NEW BUTTON */}
                    <button
                        onClick={() => setIsNewModalOpen(true)}
                        className="w-full md:w-auto bg-emerald-700 text-white px-4 py-2 border-2 border-transparent text-xs font-black uppercase rounded-lg hover:bg-emerald-800 transition-colors flex items-center justify-center gap-2"
                    >
                        <UserPlus className="w-4 h-4" />
                        <span>Nuevo</span>
                    </button>
                </div>
            </div>

            {/* TABLE HEADER - HIDDEN ON MOBILE */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b-2 border-black text-[10px] font-black uppercase tracking-wider text-slate-500">
                <div className="col-span-4">Usuario</div>
                <div className="col-span-5">Categoría Asignada</div>
                <div className="col-span-3 text-right">Acciones</div>
            </div>

            {/* LIST */}
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto bg-white">
                {isLoading && coordinators.length === 0 ? (
                    <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
                ) : filteredCoordinators.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-sm font-medium italic">
                        No se encontraron coordinadores
                    </div>
                ) : (
                    filteredCoordinators.map(user => (
                        <div key={user.id} className="group transition-colors hover:bg-slate-50">

                            {/* --- MOBILE LAYOUT (Stack) --- */}
                            <div className="md:hidden p-4 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full border-2 border-emerald-200 bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg shrink-0">
                                            {user.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-sm text-slate-900 leading-tight uppercase">{user.name}</h3>
                                            <p className="text-[10px] text-slate-500 truncate max-w-[200px]">{user.email}</p>
                                        </div>
                                    </div>
                                    {/* Mobile Actions */}
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => handleEditClick(user)}
                                            className="p-2 border border-slate-200 text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleRemoveRole(user)}
                                            className="p-2 border border-red-200 text-red-500 rounded-md hover:bg-red-50 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-1 pt-3 border-t border-slate-100">
                                    <div className="inline-flex items-center px-2.5 py-1 rounded bg-emerald-50 border border-emerald-200 text-[10px] font-black uppercase text-emerald-700">
                                        CATEGORÍA: {user.coordinatorVariant ? user.coordinatorVariant.replace(/_/g, ' ') : 'SIN ASIGNAR'}
                                    </div>
                                </div>
                            </div>

                            {/* --- DESKTOP LAYOUT (Table Row) --- */}
                            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 items-center">
                                {/* USER INFO */}
                                <div className="col-span-4 flex items-center gap-3 overflow-hidden">
                                    <div className="w-10 h-10 rounded-full border-2 border-emerald-300 bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm shrink-0">
                                        {user.name.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm uppercase truncate">{user.name}</p>
                                        <p className="text-[10px] text-slate-500 font-mono truncate">{user.email}</p>
                                    </div>
                                </div>

                                {/* VARIANT BADGE */}
                                <div className="col-span-5">
                                    <span className="inline-block px-3 py-1.5 bg-emerald-50 text-emerald-800 border-2 border-emerald-200 text-[10px] font-black uppercase rounded-lg">
                                        {user.coordinatorVariant ? user.coordinatorVariant.replace(/_/g, ' ') : 'SIN ASIGNAR'}
                                    </span>
                                </div>

                                {/* ACTIONS */}
                                <div className="col-span-3 flex justify-end items-center gap-2">
                                    <button
                                        onClick={() => handleEditClick(user)}
                                        className="p-2 hover:bg-black/5 border-2 border-transparent hover:border-slate-300 rounded-full text-slate-600 hover:text-black transition-all"
                                        title="Editar Asignación"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleRemoveRole(user)}
                                        className="p-2 hover:bg-red-50 border-2 border-transparent hover:border-red-200 rounded-full text-red-400 hover:text-red-600 transition-all"
                                        title="Remover Rol"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                        </div>
                    ))
                )}
            </div>

            {/* NEW PERSON SEARCH MODAL */}
            <NeoModal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} title="Nuevo Coordinador">
                <div className="space-y-6">
                    <p className="text-sm text-slate-600">Busca a una persona para asignarle una categoría de Coordinación.</p>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
                        <input
                            type="text"
                            placeholder="Buscar persona por nombre..."
                            value={newSearchTerm}
                            onChange={(e) => setNewSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-3 border-2 border-black font-bold outline-none uppercase text-sm focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow"
                            autoFocus
                        />
                        {isSearchingNew && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-emerald-600" />}
                    </div>

                    <div className="min-h-[200px] max-h-[300px] overflow-y-auto space-y-2 pr-1">
                        {newResults.length === 0 && newSearchTerm && !isSearchingNew && (
                            <p className="text-center text-xs text-slate-400 py-4">No se encontraron usuarios.</p>
                        )}
                        {newResults.map(u => (
                            <div key={u.id} className="flex items-center justify-between p-3 border-2 border-slate-200 hover:border-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all bg-white rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs border border-slate-300">
                                        {u.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-xs uppercase">{u.name}</p>
                                        <p className="text-[10px] text-slate-500">{u.email}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleSelectNewCoordinator(u)}
                                    className="px-3 py-1.5 bg-black text-white text-[10px] font-black uppercase rounded hover:bg-slate-800 transition-colors"
                                >
                                    Seleccionar
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </NeoModal>

            {/* EDIT/ASSIGN VARIANT MODAL */}
            {isEditModalOpen && editingUser && (
                <NeoModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Asignar Categoría">
                    <div className="space-y-6">
                        <div className="bg-emerald-50 border-2 border-emerald-200 p-4 rounded-xl flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center font-black text-xl border-2 border-emerald-300 text-emerald-700">
                                {editingUser.name.charAt(0)}
                            </div>
                            <div>
                                <div className="text-[10px] font-black uppercase text-emerald-600 mb-0.5">Usuario Seleccionado</div>
                                <div className="text-lg font-black uppercase leading-none text-emerald-950">{editingUser.name}</div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-600 block">Categoría</label>
                            <select
                                value={editingVariant || ''}
                                onChange={e => setEditingVariant(e.target.value as CoordinatorVariant)}
                                className="w-full p-4 border-2 border-black bg-white font-black uppercase text-sm focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none rounded-lg focus:ring-0"
                            >
                                <option value="">Selecciona una categoría...</option>
                                {Object.values(CoordinatorVariant).map(v => (
                                    <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                                ))}
                            </select>
                            <p className="text-[10px] text-slate-500 leading-tight pt-1">
                                Selecciona el área sobre la cual este Coordinador tendrá autoridad.
                            </p>
                        </div>

                        <div className="flex justify-end gap-3 pt-6 mt-4 border-t-2 border-slate-100">
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="px-5 py-2 text-xs font-bold uppercase hover:bg-slate-100 rounded-lg transition-colors border-2 border-transparent hover:border-slate-300"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveCoordinator}
                                disabled={isLoading}
                                className="bg-emerald-600 text-white px-6 py-2 border-2 border-emerald-800 rounded-lg text-xs font-black uppercase shadow-[3px_3px_0px_0px_rgba(6,78,59,1)] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_rgba(6,78,59,1)] active:translate-y-[1px] active:shadow-none transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                                Guardar
                            </button>
                        </div>
                    </div>
                </NeoModal>
            )}

        </div>
    );
};

export default CoordinatorsManagementPanel;
