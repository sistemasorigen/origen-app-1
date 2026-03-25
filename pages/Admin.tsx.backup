


import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../services/dbService';
import { supabaseService } from '../services/supabaseService';
import { User, UserRole, Log, SystemModule, AppConfig, BannerSlide, ValuesSectionConfig, Group, FooterLinks, CoordinatorVariant } from '../types';
import { Users, Shield, Home, Database, CloudUpload, Save, Search, X, Check, Book, Palette, Globe, Plus, Edit2, Trash2, Info, UserCheck, ClipboardList, CheckCircle, XCircle, Share2, Instagram, Facebook, Youtube, Music, Eye } from 'lucide-react';
import { migrateToSupabase } from '../services/migrationService';
import ImageUpload from '../components/ImageUpload';
import AdminAuditLogs from '../components/AdminAuditLogs';
import NeoModal from '../components/NeoModal';


interface AdminProps {
    currentUser: User | null;
    onConfigUpdate?: () => void;
}

// UI specific role types - Updated: 6 Levels
type PrimaryRole = 'SUPER_ADMIN' | 'PASTOR' | 'AREA_ADMIN' | 'VOLUNTEER' | 'LEADER' | 'USER';
type SystemScope = 'GLOBAL' | 'PUNTO' | 'GROUPS' | 'STORE' | 'ALABANZA';

const safeUUID = () => {
    // Fallback for non-secure contexts (http://IP) where crypto.randomUUID is not available
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        try {
            return crypto.randomUUID();
        } catch (e) {
            // Context not secure, fall through
        }
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const Admin: React.FC<AdminProps> = ({ currentUser, onConfigUpdate }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [groups, setGroups] = useState<Group[]>([]); // Groups State for dropdown
    const [isEditing, setIsEditing] = useState(false);
    const [currentUserData, setCurrentUserData] = useState<Partial<User>>({});
    const [newUserPassword, setNewUserPassword] = useState(''); // State for password

    // Name split state
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');



    // UI Role State
    const [selectedRoles, setSelectedRoles] = useState<Set<UserRole>>(new Set([UserRole.VIEWER]));
    const [systemScope, setSystemScope] = useState<SystemScope>('GROUPS'); // Kept for legacy system ID assignment logic if needed, but mainly we use roles now
    // Additional Volunteer Access
    const [additionalVolunteerRoles, setAdditionalVolunteerRoles] = useState<string[]>([]);

    // Coordinator Variant State
    const [coordinatorVariant, setCoordinatorVariant] = useState<CoordinatorVariant | undefined>(undefined);

    // Module States
    const [modules, setModules] = useState<SystemModule[]>([]);

    // Config State
    const [config, setConfig] = useState<AppConfig>(db.getAppConfig());

    // Slide Management State
    const [editingSlide, setEditingSlide] = useState<Partial<BannerSlide> | null>(null);
    const [isSlideModalOpen, setIsSlideModalOpen] = useState(false);

    // Verse Management State
    const [newVerse, setNewVerse] = useState({ text: '', ref: '' });

    // Values Section Management State
    const [valuesConfig, setValuesConfig] = useState<ValuesSectionConfig>(config.valuesSection || {
        image: '', title: '', description: '', values: [], buttonText: '', buttonLink: ''
    });

    // Footer Config State
    const [footerConfig, setFooterConfig] = useState<FooterLinks>({ instagram: '', facebook: '', youtube: '', spotify: '' });





    const [activeTab, setActiveTab] = useState<'users' | 'leaders' | 'postulations' | 'config' | 'logs' | 'database'>('users');
    const [searchParams] = useSearchParams();

    // Deep linking
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['users', 'leaders', 'config', 'logs', 'database'].includes(tab)) {
            setActiveTab(tab as any);
        }
    }, [searchParams]);
    const [configSubTab, setConfigSubTab] = useState<'IDENTITY' | 'BANNERS' | 'VALUES' | 'VERSES' | 'INFO_POINT' | 'FOOTER'>('IDENTITY');

    // User Sub-Tabs State - Updated to include 'all' tab
    const [userSubTab, setUserSubTab] = useState<'all' | 'admins' | 'area_admins' | 'volunteers' | 'all_volunteers' | 'viewers'>('all');

    // User Details Modal State
    const [viewingUser, setViewingUser] = useState<User | null>(null);

    // Toast State
    const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

    // Migration State
    const [migrationStatus, setMigrationStatus] = useState<string>('');
    const [isMigrating, setIsMigrating] = useState(false);

    // Search State
    const [searchTerm, setSearchTerm] = useState('');

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    // Refresh logs when tab changes or periodically
    useEffect(() => {
        const init = async () => {
            // Fetch Users from Supabase
            const dbUsers = await supabaseService.getAllUsers();
            setUsers(dbUsers);

            // Fetch Groups for assignment dropdown
            const dbGroups = await supabaseService.getGroups();
            setGroups(dbGroups);

            setModules(db.getModules());

            // Fetch Config from Supabase
            const remoteConfig = await supabaseService.getAppConfig();
            if (remoteConfig) {
                setConfig(remoteConfig);
                setValuesConfig(remoteConfig.valuesSection || { image: '', title: '', description: '', values: [], buttonText: '', buttonLink: '' });
                setFooterConfig(remoteConfig.footerLinks || { instagram: '', facebook: '', youtube: '', spotify: '' });
                // Sync local just in case
                db.saveAppConfig(remoteConfig);
            } else {
                // Fallback
                const localConfig = db.getAppConfig();
                setConfig(localConfig);
                if (localConfig.valuesSection) setValuesConfig(localConfig.valuesSection);
                setFooterConfig(localConfig.footerLinks || { instagram: '', facebook: '', youtube: '', spotify: '' });
            }


        };
        init();
    }, [activeTab]);

    // Sync UI state when editing a user
    useEffect(() => {
        if (currentUserData.id) {
            setAdditionalVolunteerRoles(currentUserData.volunteerRoles || []);
            setCoordinatorVariant(currentUserData.coordinatorVariant);

            const rolesToLoad = new Set<UserRole>();
            if (currentUserData.roles && currentUserData.roles.length > 0) {
                currentUserData.roles.forEach(r => rolesToLoad.add(r));
            } else if (currentUserData.role) {
                rolesToLoad.add(currentUserData.role);
            } else {
                rolesToLoad.add(UserRole.VIEWER);
            }
            setSelectedRoles(rolesToLoad);
        } else {
            // New user defaults
            setCoordinatorVariant(undefined);
        }
    }, [currentUserData]);

    const handleNewUserClick = () => {
        setIsEditing(true);
        setCurrentUserData({ isActive: true, linkedGroupId: undefined });
        setFirstName('');
        setLastName('');
        setNewUserPassword('');
        setAdditionalVolunteerRoles([]);
        setCoordinatorVariant(undefined);
        setSelectedRoles(new Set([UserRole.VIEWER]));
        setSystemScope('GROUPS');
    };

    const toggleRole = (role: UserRole) => {
        const newRoles = new Set(selectedRoles);

        if (newRoles.has(role)) {
            newRoles.delete(role);
        } else {
            newRoles.add(role);
        }

        // Ensure at least one role is selected (default to VIEWER if empty)
        if (newRoles.size === 0) {
            newRoles.add(UserRole.VIEWER);
        } else if (newRoles.size > 1 && newRoles.has(UserRole.VIEWER) && role !== UserRole.VIEWER) {
            // If adding a specific role, remove generic VIEWER if it's there
            newRoles.delete(UserRole.VIEWER);
        }

        setSelectedRoles(newRoles);
    };

    const handleSaveUser = async () => {
        if (!currentUserData.email || !firstName || !lastName) {
            showToast("Por favor completa el nombre, apellido y correo electrónico.", 'error');
            return;
        }

        // Require password for new users
        if (!currentUserData.id && !newUserPassword) {
            showToast("Por favor, asigna una contraseña para el nuevo usuario.", 'error');
            return;
        }

        const fullName = `${firstName.trim()} ${lastName.trim()}`;

        // Determine Roles from UI selection Set
        const finalRolesArray = Array.from(selectedRoles) as UserRole[];

        // If VOLUNTEER is selected and a specific area is chosen, add the corresponding specific role
        if (selectedRoles.has(UserRole.VOLUNTEER) && systemScope && systemScope !== 'GROUPS') {
            // Map systemScope to specific volunteer roles
            const scopeToRoleMap: Record<string, UserRole> = {
                'PUNTO': UserRole.VOLUNTARIO_INFO,
                'STORE': UserRole.VOLUNTEER, // Keep generic for now, or add VOLUNTARIO_STORE if needed
                'GROUPS_VOL': UserRole.VOLUNTARIO_GRUPOS,
                'ALABANZA': UserRole.VOLUNTEER, // Keep generic for now
                'WELCOME': UserRole.VOLUNTARIO_BIENVENIDA,
            };

            const specificRole = scopeToRoleMap[systemScope];
            if (specificRole && !finalRolesArray.includes(specificRole)) {
                finalRolesArray.push(specificRole);
            }
            // NOTE: We no longer set linkedGroupId to system scope strings
            // Access control is now handled entirely by the roles array
        }

        // Determine Safe Legacy Role (ensure we don't save new roles like VOLUNTEER to the strict enum column if it hasn't been updated)
        // Look for a safe role that exists in the database enum
        const safeRoles = [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.ADMIN_PUNTO, UserRole.ADMIN_GROUPS,
        UserRole.ADMIN_STORE, UserRole.ADMIN_ALABANZA, UserRole.ANFITRION, UserRole.CO_ANFITRION, UserRole.VIEWER,
        UserRole.VOLUNTARIO_INFO, UserRole.VOLUNTARIO_GRUPOS, UserRole.ENCARGADO_PUNTO, UserRole.ENCARGADO_GRUPOS,
        UserRole.VOLUNTEER, UserRole.VOLUNTARIO, UserRole.ADMIN_CUIDADO_PASTORAL];
        const primaryLegacyRole = finalRolesArray.find(r => safeRoles.includes(r)) || UserRole.VIEWER;

        // Determine Legacy Linked Group ID (for backward compat if needed)
        // This logic is less critical now that we have specific roles, but kept for system consistency
        let linkedGroupId: string | undefined = currentUserData.linkedGroupId;

        // If specific admin roles are selected, ensure they have access to that system if logic requires
        // For now, we trust the roles array provides access.

        const newUser: User = {
            id: currentUserData.id || safeUUID(),
            name: fullName,
            email: currentUserData.email!,
            role: primaryLegacyRole,
            roles: finalRolesArray,
            isActive: currentUserData.isActive ?? true,
            linkedGroupId: linkedGroupId,
            volunteerRoles: additionalVolunteerRoles,
            coordinatorVariant: finalRolesArray.includes(UserRole.COORDINATOR) ? coordinatorVariant : undefined
        };


        let success = false;
        if (currentUserData.id) {
            success = await supabaseService.updateUser(newUser, newUserPassword || undefined);
        } else {
            const created = await supabaseService.adminCreateUser(newUser, newUserPassword);
            success = !!created;
        }

        if (success) {
            setUsers(await supabaseService.getAllUsers());
            setIsEditing(false);
            setCurrentUserData({});
            setNewUserPassword('');
            showToast("Usuario guardado exitosamente.");
        } else {
            showToast("Error al guardar usuario en base de datos.", 'error');
        }
    };

    const handleDeleteUser = async (id: string) => {
        const success = await supabaseService.deleteUser(id);
        if (success) {
            setUsers(await supabaseService.getAllUsers());
            showToast("Usuario eliminado.");
        } else {
            showToast("Error al eliminar usuario.", 'error');
        }
    };



    // --- CONFIG MANAGEMENT ---
    const saveConfig = async (newConfig: AppConfig) => {
        setConfig(newConfig);
        db.saveAppConfig(newConfig); // Local Sync
        const success = await supabaseService.saveAppConfig(newConfig); // Remote Sync
        if (success) {
            showToast('Configuración guardada en Supabase.');
            if (onConfigUpdate) onConfigUpdate();
        } else {
            showToast('Error guardando en Supabase', 'error');
        }
    };

    // Identity
    const handleSaveIdentity = async () => {
        await saveConfig(config);
    };

    // Footer Links
    const handleSaveFooterLinks = async () => {
        const updatedConfig = db.saveFooterLinks(footerConfig); // Updates local config and returns it
        // Now sync to Supabase
        const success = await supabaseService.saveAppConfig(updatedConfig);
        if (success) {
            showToast('Enlaces de pie de página actualizados.');
            setConfig(updatedConfig); // Update local state to ensure consistency
        } else {
            showToast('Error al guardar en la nube', 'error');
        }
    };

    // Slides (Global or Info Point)
    const handleSaveSlide = async () => {
        if (!editingSlide) return;

        // Determine which slides array we are modifying
        const isInfoPoint = configSubTab === 'INFO_POINT';
        const currentSlides = isInfoPoint
            ? (config.infoPointConfig?.banners || [])
            : (config.banner.slides || []);

        let updatedSlides;

        const slideToSave: BannerSlide = {
            id: editingSlide.id || safeUUID(),
            imageUrl: editingSlide.imageUrl || '',
            titlePrefix: editingSlide.titlePrefix,
            titleHighlight: editingSlide.titleHighlight,
            description: editingSlide.description,
            buttonText: editingSlide.buttonText,
            // Brutalist style for Info Point if not present
            overlayColor: editingSlide.overlayColor || (isInfoPoint ? 'bg-white/30 mix-blend-overlay' : undefined)
        };

        if (editingSlide.id) {
            updatedSlides = currentSlides.map(s => s.id === editingSlide.id ? slideToSave : s);
        } else {
            updatedSlides = [...currentSlides, slideToSave];
        }

        if (isInfoPoint) {
            await saveConfig({
                ...config,
                infoPointConfig: { ...config.infoPointConfig, banners: updatedSlides }
            });
        } else {
            await saveConfig({
                ...config,
                banner: { ...config.banner, slides: updatedSlides }
            });
        }

        setIsSlideModalOpen(false);
        setEditingSlide(null);
    };

    const handleDeleteSlide = async (id: string) => {
        const isInfoPoint = configSubTab === 'INFO_POINT';
        const currentSlides = isInfoPoint
            ? (config.infoPointConfig?.banners || [])
            : (config.banner.slides || []);

        const updatedSlides = currentSlides.filter(s => s.id !== id);

        if (isInfoPoint) {
            await saveConfig({
                ...config,
                infoPointConfig: { ...config.infoPointConfig, banners: updatedSlides }
            });
        } else {
            await saveConfig({
                ...config,
                banner: { ...config.banner, slides: updatedSlides }
            });
        }
    };

    // Values Section
    const handleSaveValuesConfig = async () => {
        await saveConfig({
            ...config,
            valuesSection: valuesConfig
        });
    };

    // Verses
    const handleAddVerse = async () => {
        if (!newVerse.text || !newVerse.ref) {
            showToast('Completa el texto y la referencia', 'error');
            return;
        }
        const currentVerses = config.verses || [];
        await saveConfig({
            ...config,
            verses: [...currentVerses, newVerse]
        });
        setNewVerse({ text: '', ref: '' });
    };

    const handleDeleteVerse = async (idx: number) => {
        const currentVerses = config.verses || [];
        const updatedVerses = currentVerses.filter((_, i) => i !== idx);
        await saveConfig({
            ...config,
            verses: updatedVerses
        });
    };

    // --- MIGRATION HANDLER ---
    const handleMigration = async () => {
        if (!window.confirm("¿Estás seguro? Esto sobrescribirá los datos en Supabase con los datos locales actuales.")) return;

        setIsMigrating(true);
        setMigrationStatus("Iniciando...");

        const success = await migrateToSupabase((msg) => {
            setMigrationStatus(prev => prev + '\n' + msg);
        });

        setIsMigrating(false);
        if (success) {
            showToast("Migración completada con éxito.", 'success');
        } else {
            showToast("Hubo errores durante la migración.", 'error');
        }
    };

    const handleEditUser = (user: User) => {
        setIsEditing(true);
        setCurrentUserData(user);
        const parts = user.name.split(' ');
        setFirstName(parts[0] || '');
        setLastName(parts.slice(1).join(' ') || '');
        setNewUserPassword('');
    };

    // --- RENDER HELPERS - BRUTALIST STYLE ---
    const renderUserTable = (filteredUsers: User[]) => (
        <>
            {/* MOBILE: Card View */}
            <div className="block md:hidden space-y-3">
                {filteredUsers.map(user => {
                    let displayLink = user.linkedGroupId;
                    if (user.linkedGroupId) {
                        const systemNames: Record<string, string> = { 'PUNTO': 'Punto', 'STORE': 'Tienda', 'GROUPS': 'Grupos', 'ALABANZA': 'Alabanza' };
                        if (systemNames[user.linkedGroupId]) {
                            displayLink = systemNames[user.linkedGroupId];
                        } else {
                            const group = groups.find(g => g.id === user.linkedGroupId);
                            if (group) displayLink = group.name;
                        }
                    }
                    return (
                        <div key={user.id} className="bg-white border-2 border-black p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                            <div className="flex justify-between items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-sm text-black uppercase truncate">{user.name}</p>
                                    <p className="text-[11px] text-neutral-500 truncate">{user.email}</p>
                                </div>
                                <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 border-2 text-[9px] font-black uppercase ${user.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-400' : 'bg-red-50 text-red-700 border-red-400'}`}>
                                    <span className={`w-1.5 h-1.5 ${user.isActive ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                    {user.isActive ? 'Activo' : 'Inact.'}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-2">
                                {(user.roles && user.roles.length > 0 ? user.roles : [user.role]).map(r => (
                                    <span key={r} className="inline-block px-2 py-0.5 bg-black text-white text-[9px] font-black uppercase">
                                        {r.replace('ADMIN_', '')}
                                    </span>
                                ))}
                                {displayLink && (
                                    <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-300 text-[9px] font-black uppercase">
                                        {displayLink}
                                    </span>
                                )}
                            </div>
                            <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-black/10">
                                <button onClick={() => setViewingUser(user)} className="p-2.5 min-h-[44px] min-w-[44px] border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center" title="Ver detalles"><Eye className="w-4 h-4" /></button>
                                <button onClick={() => handleEditUser(user)} className="p-2.5 min-h-[44px] min-w-[44px] border-2 border-black text-black hover:bg-black hover:text-white transition-all flex items-center justify-center" title="Editar"><Edit2 className="w-4 h-4" /></button>
                                {user.role !== UserRole.SUPER_ADMIN && (
                                    <button onClick={() => handleDeleteUser(user.id)} className="p-2.5 min-h-[44px] min-w-[44px] border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                                )}
                            </div>
                        </div>
                    );
                })}
                {filteredUsers.length === 0 && (
                    <div className="p-8 text-center text-neutral-400 text-sm font-bold uppercase border-2 border-dashed border-neutral-300">No hay usuarios.</div>
                )}
            </div>

            {/* DESKTOP: Table View */}
            <div className="hidden md:block bg-white border-2 border-black rounded-xl overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <table className="w-full text-left">
                    <thead className="bg-black text-white text-xs font-black uppercase tracking-widest">
                        <tr>
                            <th className="p-4">Usuario</th>
                            <th className="p-4">Rol</th>
                            <th className="p-4">Estado</th>
                            <th className="p-4 text-right">Acc.</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-black/10">
                        {filteredUsers.map(user => {
                            let displayLink = user.linkedGroupId;
                            if (user.linkedGroupId) {
                                const systemNames: Record<string, string> = { 'PUNTO': 'Punto', 'STORE': 'Tienda', 'GROUPS': 'Grupos', 'ALABANZA': 'Alabanza' };
                                if (systemNames[user.linkedGroupId]) {
                                    displayLink = systemNames[user.linkedGroupId];
                                } else {
                                    const group = groups.find(g => g.id === user.linkedGroupId);
                                    if (group) displayLink = group.name;
                                }
                            }
                            return (
                                <tr key={user.id} className="hover:bg-neutral-50 transition-colors">
                                    <td className="p-4">
                                        <p className="font-black text-sm text-black uppercase">{user.name}</p>
                                        <p className="text-xs text-neutral-500">{user.email}</p>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-wrap gap-1">
                                            {(user.roles && user.roles.length > 0 ? user.roles : [user.role]).map(r => (
                                                <span key={r} className="inline-block px-2 py-1 bg-white text-black border-2 border-black text-[10px] font-black uppercase">{r}</span>
                                            ))}
                                        </div>
                                        {user.linkedGroupId && (
                                            <span className="ml-2 inline-block px-2 py-1 bg-blue-50 text-blue-800 border-2 border-blue-300 text-[10px] font-black uppercase">{displayLink}</span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 border-2 text-[10px] font-black uppercase ${user.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-400' : 'bg-red-50 text-red-700 border-red-400'}`}>
                                            <span className={`w-2 h-2 ${user.isActive ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                            {user.isActive ? 'Activo' : 'Inact.'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setViewingUser(user)} className="p-2 border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition-all" title="Ver detalles"><Eye className="w-4 h-4" /></button>
                                            <button onClick={() => handleEditUser(user)} className="p-2 border-2 border-black text-black hover:bg-black hover:text-white transition-all" title="Editar"><Edit2 className="w-4 h-4" /></button>
                                            {user.role !== UserRole.SUPER_ADMIN && (
                                                <button onClick={() => handleDeleteUser(user.id)} className="p-2 border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-all" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredUsers.length === 0 && (
                            <tr><td colSpan={4} className="p-8 text-center text-neutral-400 text-sm font-bold uppercase">No hay usuarios.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );

    // Filter Logic for Users Tab
    const filteredUsersBase = users.filter(u => {
        if (!searchTerm) return true;
        const lowerTerm = searchTerm.toLowerCase();
        return (
            u.name.toLowerCase().includes(lowerTerm) ||
            (u.email && u.email.toLowerCase().includes(lowerTerm))
        );
    });

    return (
        <div className="min-h-screen bg-white pb-20">
            {/* Toast - Brutalist */}
            {toast.show && (
                <div className={`fixed top-24 right-8 z-[100] px-6 py-4 border-3 flex items-center gap-3 animate-slideIn ${toast.type === 'success' ? 'bg-black text-white border-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)]' : 'bg-red-600 text-white border-red-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]'}`} style={{ borderWidth: '3px' }}>
                    <span className="font-black text-sm uppercase tracking-widest">{toast.message}</span>
                </div>
            )}

            {/* Header - Brutalist */}
            <div className="bg-white border-b-4 border-black sticky top-16 z-30">
                <div className="max-w-[1920px] mx-auto px-4 md:px-6 py-4 md:py-0 md:h-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-0">
                    <h1 className="text-xl md:text-3xl font-black text-black uppercase tracking-tighter">Panel Administración</h1>
                    <div className="flex gap-2 overflow-x-auto w-full md:w-auto scrollbar-hide">
                        {[
                            { id: 'users', icon: Users, label: 'Usuarios' },

                            { id: 'config', icon: Home, label: 'Config' },
                            { id: 'logs', icon: Shield, label: 'Logs' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 border-2 border-black text-[10px] md:text-xs font-black uppercase transition-all whitespace-nowrap ${activeTab === tab.id
                                    ? 'bg-black text-white shadow-none translate-y-[2px]'
                                    : 'bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                                    }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                <span className="hidden sm:inline">{tab.label}</span>

                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-[1920px] mx-auto px-4 md:px-6 py-6 md:py-8">

                {/* USER EDIT MODAL - BRUTALIST - Mobile Optimized */}
                {isEditing && (
                    <NeoModal
                        isOpen={isEditing}
                        onClose={() => setIsEditing(false)}
                        title={currentUserData.id ? 'Editar Usuario' : 'Nuevo Usuario'}
                        maxWidth="max-w-5xl"
                    >
                        <div className="flex flex-col gap-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-12">
                                {/* Left: Personal Data */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-black text-neutral-500 uppercase tracking-widest border-b-2 border-neutral-200 pb-2">Datos Personales</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                                        <div><label className="text-xs font-black uppercase text-neutral-500">Nombre</label><input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full p-3 border-2 border-black text-sm font-black uppercase focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:ring-0 outline-none" /></div>
                                        <div><label className="text-xs font-black uppercase text-neutral-500">Apellido</label><input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full p-3 border-2 border-black text-sm font-black uppercase focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:ring-0 outline-none" /></div>
                                    </div>
                                    <div><label className="text-xs font-black uppercase text-neutral-500">Email</label><input type="email" value={currentUserData.email || ''} onChange={e => setCurrentUserData({ ...currentUserData, email: e.target.value })} className="w-full p-3 border-2 border-black text-sm font-medium focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:ring-0 outline-none" /></div>
                                    <div>
                                        <label className="text-xs font-black uppercase text-neutral-500">Contraseña {currentUserData.id && '(Dejar vacío para no cambiar)'}</label>
                                        <input type="password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} className="w-full p-3 border-2 border-black text-sm font-medium focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:ring-0 outline-none" placeholder="••••••" />
                                    </div>
                                    <div className="flex items-center gap-3 pt-2">
                                        <div onClick={() => setCurrentUserData({ ...currentUserData, isActive: !currentUserData.isActive })} className={`w-12 h-6 cursor-pointer transition-colors relative border-2 border-black ${currentUserData.isActive ? 'bg-emerald-500' : 'bg-neutral-300'}`}>
                                            <div className={`w-4 h-4 bg-white border border-black absolute top-0.5 transition-all ${currentUserData.isActive ? 'left-6' : 'left-0.5'}`}></div>
                                        </div>
                                        <span className="text-sm font-black uppercase text-neutral-600">Usuario Activo</span>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <h4 className="text-xs font-black text-neutral-500 uppercase tracking-widest border-b-2 border-neutral-200 pb-2">Nivel de Acceso (Selección Múltiple)</h4>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-4">
                                        {/* Level 1 */}
                                        <div onClick={() => toggleRole(UserRole.VIEWER)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center ${selectedRoles.has(UserRole.VIEWER) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-black uppercase">USUARIO</span>
                                            <span className="hidden md:block text-[10px] opacity-70">Acceso básico</span>
                                        </div>
                                        {/* Level 2 - Anfitrión: Can create their own group */}
                                        <div onClick={() => toggleRole(UserRole.ANFITRION)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center ${selectedRoles.has(UserRole.ANFITRION) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-black uppercase">ANFITRIÓN</span>
                                            <span className="hidden md:block text-[10px] opacity-70">Crear grupos</span>
                                        </div>
                                        {/* Level 2b - Co-Anfitrión: Can manage assigned groups */}
                                        <div onClick={() => toggleRole(UserRole.CO_ANFITRION)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center ${selectedRoles.has(UserRole.CO_ANFITRION) ? 'border-purple-600 bg-purple-600 text-white shadow-none' : 'border-purple-300 bg-purple-50 text-purple-700 hover:shadow-[3px_3px_0px_0px_rgba(147,51,234,0.5)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-black uppercase">CO-ANFITRIÓN</span>
                                            <span className="hidden md:block text-[10px] opacity-70">Co-líder grupos</span>
                                        </div>
                                        {/* Level 3 - Voluntario */}
                                        <div onClick={() => toggleRole(UserRole.VOLUNTEER)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center ${selectedRoles.has(UserRole.VOLUNTEER) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-black uppercase">VOLUNTARIO</span>
                                            <span className="hidden md:block text-[10px] opacity-70">Colaborador</span>
                                        </div>

                                        {/* Level 4 - Admins */}
                                        <div onClick={() => toggleRole(UserRole.ADMIN_PUNTO)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center ${selectedRoles.has(UserRole.ADMIN_PUNTO) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-black uppercase">ENCARGADO PUNTO</span>
                                            <span className="hidden md:block text-[10px] opacity-70">Gestión Punto</span>
                                        </div>
                                        <div onClick={() => toggleRole(UserRole.ADMIN_GROUPS)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center ${selectedRoles.has(UserRole.ADMIN_GROUPS) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-black uppercase">ENCARGADO GRUPOS</span>
                                            <span className="hidden md:block text-[10px] opacity-70">Gestión Grupos</span>
                                        </div>
                                        <div onClick={() => toggleRole(UserRole.ADMIN_STORE)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center ${selectedRoles.has(UserRole.ADMIN_STORE) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-black uppercase">ENCARGADO STORE</span>
                                            <span className="hidden md:block text-[10px] opacity-70">Gestión Tienda</span>
                                        </div>
                                        <div onClick={() => toggleRole(UserRole.ADMIN_ALABANZA)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center ${selectedRoles.has(UserRole.ADMIN_ALABANZA) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-black uppercase">ENCARGADO ALABANZA</span>
                                            <span className="hidden md:block text-[10px] opacity-70">Gestión Alabanza</span>
                                        </div>
                                        <div onClick={() => toggleRole(UserRole.ENCARGADO_BIENVENIDA)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center ${selectedRoles.has(UserRole.ENCARGADO_BIENVENIDA) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-black uppercase">ENCARGADO BIENVENIDA</span>
                                            <span className="hidden md:block text-[10px] opacity-70">Gestión Bienvenida</span>
                                        </div>
                                        <div onClick={() => toggleRole(UserRole.ADMIN_CUIDADO_PASTORAL)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center ${selectedRoles.has(UserRole.ADMIN_CUIDADO_PASTORAL) ? 'border-amber-600 bg-amber-600 text-white shadow-none' : 'border-amber-300 bg-amber-50 text-amber-700 hover:shadow-[3px_3px_0px_0px_rgba(217,119,6,0.5)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-black uppercase">CUIDADO PASTORAL</span>
                                            <span className="hidden md:block text-[10px] opacity-70">Gestión Pastoral</span>
                                        </div>

                                        {/* Level 5 */}
                                        <div onClick={() => toggleRole(UserRole.PASTOR)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center ${selectedRoles.has(UserRole.PASTOR) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-black uppercase">REPORTES</span>
                                            <span className="hidden md:block text-[10px] opacity-70">Pastor</span>
                                        </div>
                                        {/* Level 6 */}
                                        <div onClick={() => toggleRole(UserRole.SUPER_ADMIN)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center ${selectedRoles.has(UserRole.SUPER_ADMIN) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-black uppercase">S. ADMIN</span>
                                            <span className="hidden md:block text-[10px] opacity-70">Control total</span>
                                        </div>

                                        {/* Coordinator Role */}
                                        <div onClick={() => toggleRole(UserRole.COORDINATOR)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center ${selectedRoles.has(UserRole.COORDINATOR) ? 'border-emerald-600 bg-emerald-600 text-white shadow-none' : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:shadow-[3px_3px_0px_0px_rgba(5,150,105,0.5)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-black uppercase">COORDINADOR</span>
                                            <span className="hidden md:block text-[10px] opacity-70">Departamento</span>
                                        </div>
                                    </div>

                                    {/* Coordinator Variant Selector */}
                                    {selectedRoles.has(UserRole.COORDINATOR) && (
                                        <div className="space-y-3 bg-emerald-50 p-4 border-2 border-emerald-300 animate-fadeIn">
                                            <label className="text-xs font-black uppercase text-emerald-700">Departamento de Coordinación</label>
                                            <select
                                                value={coordinatorVariant || ''}
                                                onChange={e => setCoordinatorVariant(e.target.value as CoordinatorVariant || undefined)}
                                                className="w-full p-3 border-2 border-black bg-white text-sm font-black uppercase focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:ring-0 outline-none"
                                            >
                                                <option value="">Seleccionar departamento...</option>
                                                {Object.values(CoordinatorVariant).map(v => (
                                                    <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                                                ))}
                                            </select>
                                            <p className="text-[10px] text-emerald-600 leading-tight">
                                                Selecciona el departamento específico que coordina este usuario.
                                            </p>
                                        </div>
                                    )}

                                    {(selectedRoles.has(UserRole.VOLUNTEER)) && (
                                        <div className="space-y-3 bg-neutral-50 p-4 border-2 border-black animate-fadeIn">
                                            <label className="text-xs font-black uppercase text-neutral-500">Área de Sistema (Voluntariado)</label>
                                            <select
                                                value={systemScope}
                                                onChange={e => setSystemScope(e.target.value as SystemScope)}
                                                className="w-full p-3 border-2 border-black bg-white text-sm font-black uppercase focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:ring-0 outline-none"
                                            >
                                                <option value="GROUPS">Ninguno (Líder Grupo)</option>
                                                <option value="GROUPS_VOL">Voluntario: Grupos de Conexión</option>
                                                <option value="PUNTO">Voluntario: Punto de Info</option>
                                                <option value="STORE">Voluntario: Tienda</option>
                                                <option value="ALABANZA">Voluntario: Alabanza</option>
                                                <option value="WELCOME">Voluntario: Bienvenida</option>
                                            </select>
                                            <p className="text-[10px] text-neutral-400 leading-tight">
                                                Si seleccionas un área, el usuario será marcado como Voluntario de ese sistema.
                                                Si seleccionas "Ninguno", será un Anfitrión de Grupo de Conexión regular.
                                            </p>
                                        </div>
                                    )}

                                    {/* Current Roles Display - Removable Chips */}
                                    {selectedRoles.size > 0 && (
                                        <div className="space-y-3 bg-blue-50 p-4 border-2 border-blue-300 animate-fadeIn">
                                            <label className="text-xs font-black uppercase text-blue-700">Roles Actuales ({selectedRoles.size})</label>
                                            <div className="flex flex-wrap gap-2">
                                                {Array.from(selectedRoles).map(role => (
                                                    <div
                                                        key={role}
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-white border-2 border-black text-[10px] font-black uppercase group hover:bg-red-50 hover:border-red-500 transition-colors"
                                                    >
                                                        <span>{(role as string).replace('ADMIN_', '').replace('_', ' ')}</span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const newRoles = new Set(selectedRoles);
                                                                newRoles.delete(role);
                                                                // Ensure at least one role remains
                                                                if (newRoles.size === 0) {
                                                                    newRoles.add(UserRole.VIEWER);
                                                                }
                                                                setSelectedRoles(newRoles);
                                                            }}
                                                            className="ml-1 w-4 h-4 flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-100 transition-colors"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="text-[10px] text-blue-500 leading-tight">
                                                Haz clic en la X para eliminar un rol específico.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="mt-6 md:mt-8 pt-4 md:pt-6 border-t-2 border-black flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
                                <button onClick={() => setIsEditing(false)} className="px-6 py-3 text-xs font-black uppercase border-2 border-black hover:bg-neutral-100">Cancelar</button>
                                <button onClick={handleSaveUser} className="px-6 md:px-8 py-3 bg-black text-white text-xs font-black uppercase tracking-widest border-2 border-black shadow-[3px_3px_0px_0px_rgba(100,100,100,1)] hover:shadow-[5px_5px_0px_0px_rgba(100,100,100,1)] hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all">Guardar</button>
                            </div>
                        </div>
                    </NeoModal>
                )}

                {/* USER DETAIL MODAL - BRUTALIST */}
                {viewingUser && (
                    <NeoModal
                        isOpen={!!viewingUser}
                        onClose={() => setViewingUser(null)}
                        title="Detalle de Usuario"
                    >
                        <div className="flex flex-col gap-6">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-black text-white flex items-center justify-center text-2xl font-black uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
                                    {viewingUser.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight leading-none">{viewingUser.name}</h3>
                                    <p className="text-sm font-bold text-neutral-500 uppercase mt-1">ID: <span className="font-mono text-xs">{viewingUser.id.slice(0, 8)}...</span></p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Email */}
                                <div className="bg-neutral-50 p-4 border-2 border-black">
                                    <label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Email</label>
                                    <p className="text-sm font-medium text-black mt-1 break-all">{viewingUser.email || '-'}</p>
                                </div>

                                {/* Two columns for Phone and Age */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-neutral-50 p-4 border-2 border-black">
                                        <label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Teléfono</label>
                                        <p className="text-sm font-bold text-black mt-1">{viewingUser.phone || 'No registrado'}</p>
                                    </div>
                                    <div className="bg-neutral-50 p-4 border-2 border-black">
                                        <label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Edad</label>
                                        <p className="text-sm font-bold text-black mt-1">{viewingUser.age ? `${viewingUser.age} años` : 'No registrada'}</p>
                                    </div>
                                </div>

                                {/* Birth Date */}
                                <div className="bg-neutral-50 p-4 border-2 border-black">
                                    <label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Fecha de Cumpleaños</label>
                                    <p className="text-sm font-bold text-black mt-1">
                                        {viewingUser.birthDate
                                            ? new Date(viewingUser.birthDate + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
                                            : 'No registrada'}
                                    </p>
                                </div>

                                {/* Gender */}
                                <div className="bg-neutral-50 p-4 border-2 border-black">
                                    <label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Sexo</label>
                                    <p className="text-sm font-bold text-black mt-1 uppercase">{viewingUser.gender || 'No registrado'}</p>
                                </div>

                                {/* Role & Status */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-neutral-50 p-4 border-2 border-black">
                                        <label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Rol(es)</label>
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {(viewingUser.roles && viewingUser.roles.length > 0 ? viewingUser.roles : [viewingUser.role]).map(r => (
                                                <span key={r} className="inline-block px-2 py-1 bg-black text-white text-[9px] font-black uppercase">{r}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-neutral-50 p-4 border-2 border-black">
                                        <label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Estado</label>
                                        <p className={`text-sm font-black mt-1 uppercase ${viewingUser.isActive ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {viewingUser.isActive ? '● Activo' : '○ Inactivo'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="mt-2 pt-4 border-t-2 border-black flex justify-end">
                                <button onClick={() => setViewingUser(null)} className="px-6 py-3 bg-black text-white text-xs font-black uppercase tracking-widest border-2 border-black shadow-[3px_3px_0px_0px_rgba(100,100,100,1)] hover:shadow-[5px_5px_0px_0px_rgba(100,100,100,1)] hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all">Cerrar</button>
                            </div>
                        </div>
                    </NeoModal>
                )}

                {/* --- USERS TAB - BRUTALIST --- */}
                {activeTab === 'users' && (
                    <div className="space-y-4 md:space-y-6">
                        {/* Search Bar */}
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <input
                                type="text"
                                placeholder="Buscar usuario por nombre o email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border-2 border-black text-sm font-bold uppercase placeholder:text-neutral-400 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none transition-all rounded-none"
                            />
                        </div>

                        {/* User Sub Tabs */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="flex gap-2 md:gap-4 overflow-x-auto w-full sm:w-auto scrollbar-hide pb-1">
                                {[
                                    { id: 'all', label: 'Todos', count: users.length },
                                    { id: 'admins', label: 'S.Admins', count: users.filter(u => (u.roles || [u.role]).includes(UserRole.SUPER_ADMIN)).length },
                                    { id: 'area_admins', label: 'Admins', count: users.filter(u => (u.roles || [u.role]).some(r => [UserRole.ADMIN_PUNTO, UserRole.ADMIN_GROUPS, UserRole.ADMIN_STORE, UserRole.ADMIN_ALABANZA, UserRole.PASTOR].includes(r))).length },
                                    { id: 'volunteers', label: 'Anfitriones', count: users.filter(u => (u.roles || [u.role]).some(r => [UserRole.ANFITRION, UserRole.CO_ANFITRION].includes(r))).length },
                                    { id: 'all_volunteers', label: 'Voluntarios', count: users.filter(u => (u.roles || [u.role]).includes(UserRole.VOLUNTEER)).length },
                                    { id: 'viewers', label: 'Usuarios', count: users.filter(u => (u.roles || [u.role]).includes(UserRole.VIEWER)).length },
                                ].map(sub => (
                                    <button
                                        key={sub.id}
                                        onClick={() => setUserSubTab(sub.id as any)}
                                        className={`px-3 py-2 text-[10px] md:text-xs font-black uppercase tracking-wider transition-all border-2 border-black whitespace-nowrap ${userSubTab === sub.id ? 'bg-black text-white' : 'bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}
                                    >
                                        {sub.label} <span className="ml-1">{sub.count}</span>
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => handleNewUserClick()} className="flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-black text-white text-[10px] md:text-xs font-black uppercase tracking-widest border-2 border-black shadow-[3px_3px_0px_0px_rgba(100,100,100,1)] hover:shadow-[5px_5px_0px_0px_rgba(100,100,100,1)] hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all whitespace-nowrap">
                                <Plus className="w-3 md:w-4 h-3 md:h-4" /> Nuevo
                            </button>
                        </div>

                        {/* Render Table based on sub-tab */}
                        {userSubTab === 'all' && renderUserTable(filteredUsersBase)}
                        {userSubTab === 'admins' && renderUserTable(filteredUsersBase.filter(u => (u.roles || [u.role]).includes(UserRole.SUPER_ADMIN)))}
                        {userSubTab === 'area_admins' && renderUserTable(filteredUsersBase.filter(u => (u.roles || [u.role]).some(r => [UserRole.ADMIN_PUNTO, UserRole.ADMIN_GROUPS, UserRole.ADMIN_STORE, UserRole.ADMIN_ALABANZA, UserRole.PASTOR].includes(r))))}
                        {userSubTab === 'volunteers' && renderUserTable(filteredUsersBase.filter(u => (u.roles || [u.role]).some(r => [UserRole.ANFITRION, UserRole.CO_ANFITRION].includes(r))))}
                        {userSubTab === 'all_volunteers' && renderUserTable(filteredUsersBase.filter(u => (u.roles || [u.role]).includes(UserRole.VOLUNTEER)))}
                        {userSubTab === 'viewers' && renderUserTable(filteredUsersBase.filter(u => (u.roles || [u.role]).includes(UserRole.VIEWER)))}
                    </div>
                )}

                {/* --- LEADERS / DIRECTORY TAB (UPDATED to show ALL) --- */}
                {activeTab === 'leaders' && (
                    <div className="space-y-4 md:space-y-6 animate-fadeIn">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-6">
                            <h2 className="text-lg md:text-xl font-black uppercase tracking-tight">Directorio</h2>
                            <button
                                onClick={() => handleNewUserClick()}
                                className="flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-black text-white text-[10px] md:text-xs font-bold uppercase tracking-widest hover:bg-slate-800 rounded-lg shadow-lg whitespace-nowrap"
                            >
                                <Plus className="w-3 md:w-4 h-3 md:h-4" /> Nuevo Líder
                            </button>
                        </div>

                        {/* Mobile: Cards, Desktop: Table */}
                        <div className="md:hidden space-y-3">
                            {users.map(user => {
                                let areaLabel = '-';
                                const userRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role];

                                // Determine primary badge based on highest privilege for single-view or show all
                                // For simplicity in mobile card, we show the "highest" role or multiple badges

                                const roleBadges: { label: string, colorClass: string }[] = [];

                                if (userRoles.includes(UserRole.SUPER_ADMIN)) {
                                    roleBadges.push({ label: 'S.Admin', colorClass: 'bg-black text-white' });
                                }
                                if (userRoles.includes(UserRole.PASTOR)) {
                                    roleBadges.push({ label: 'Pastor', colorClass: 'bg-indigo-100 text-indigo-700' });
                                }

                                // Admins
                                if (userRoles.includes(UserRole.ADMIN_GROUPS)) roleBadges.push({ label: 'Adm. Grupos', colorClass: 'bg-purple-100 text-purple-700' });
                                if (userRoles.includes(UserRole.ADMIN_PUNTO)) roleBadges.push({ label: 'Adm. Punto', colorClass: 'bg-purple-100 text-purple-700' });
                                if (userRoles.includes(UserRole.ADMIN_STORE)) roleBadges.push({ label: 'Adm. Store', colorClass: 'bg-purple-100 text-purple-700' });
                                if (userRoles.includes(UserRole.ADMIN_ALABANZA)) roleBadges.push({ label: 'Adm. Alabanza', colorClass: 'bg-purple-100 text-purple-700' });

                                // Volunteers/Anfitriones
                                if (userRoles.includes(UserRole.ANFITRION)) {
                                    const systemIds = ['PUNTO', 'STORE', 'GROUPS', 'ALABANZA'];
                                    const isSystemVolunteer = systemIds.includes(user.linkedGroupId || '');

                                    if (isSystemVolunteer) {
                                        roleBadges.push({ label: `Vol. ${user.linkedGroupId}`, colorClass: 'bg-blue-50 text-blue-600' });
                                    } else if (user.linkedGroupId) {
                                        const g = groups.find(grp => grp.id === user.linkedGroupId);
                                        const groupName = g ? g.name.slice(0, 10) : 'Grupo';
                                        roleBadges.push({ label: `Líder: ${groupName}`, colorClass: 'bg-amber-50 text-amber-600' });
                                    } else {
                                        roleBadges.push({ label: 'Anfitrión', colorClass: 'bg-amber-50 text-amber-600' });
                                    }
                                }

                                if (roleBadges.length === 0) {
                                    roleBadges.push({ label: 'Usuario', colorClass: 'bg-slate-100 text-slate-500' });
                                }

                                return (
                                    <div key={user.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-xs text-slate-900 truncate">{user.name}</p>
                                            <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                {roleBadges.map((badge, idx) => (
                                                    <span key={idx} className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${badge.colorClass}`}>
                                                        {badge.label}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <button onClick={() => handleEditUser(user)} className="p-2 text-slate-400 hover:text-black hover:bg-slate-100 rounded-lg ml-2">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                );
                            })}
                            {users.length === 0 && (
                                <p className="p-6 text-center text-slate-400 text-xs">No hay usuarios.</p>
                            )}
                        </div>

                        {/* Desktop: Table */}
                        <div className="hidden md:block bg-off-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                                    <tr>
                                        <th className="p-4">Usuario</th>
                                        <th className="p-4">Tipo</th>
                                        <th className="p-4">Área de Influencia</th>
                                        <th className="p-4 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {users.map(user => {
                                        let areaLabel = '-';
                                        const userRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role];
                                        const roleBadges: { label: string, colorClass: string }[] = [];

                                        if (userRoles.includes(UserRole.SUPER_ADMIN)) {
                                            roleBadges.push({ label: 'S.Admin', colorClass: 'bg-black text-white border-black' });
                                        }
                                        if (userRoles.includes(UserRole.PASTOR)) {
                                            roleBadges.push({ label: 'Pastor', colorClass: 'bg-indigo-100 text-indigo-700 border-indigo-200' });
                                        }

                                        // Admins
                                        if (userRoles.includes(UserRole.ADMIN_GROUPS)) roleBadges.push({ label: 'Adm. Grupos', colorClass: 'bg-purple-100 text-purple-700 border-purple-200' });
                                        if (userRoles.includes(UserRole.ADMIN_PUNTO)) roleBadges.push({ label: 'Adm. Punto', colorClass: 'bg-purple-100 text-purple-700 border-purple-200' });
                                        if (userRoles.includes(UserRole.ADMIN_STORE)) roleBadges.push({ label: 'Adm. Store', colorClass: 'bg-purple-100 text-purple-700 border-purple-200' });
                                        if (userRoles.includes(UserRole.ADMIN_ALABANZA)) roleBadges.push({ label: 'Adm. Alabanza', colorClass: 'bg-purple-100 text-purple-700 border-purple-200' });

                                        // Volunteers/Anfitriones
                                        if (userRoles.includes(UserRole.ANFITRION)) {
                                            const systemIds = ['PUNTO', 'STORE', 'GROUPS', 'ALABANZA'];
                                            const isSystemVolunteer = systemIds.includes(user.linkedGroupId || '');

                                            if (isSystemVolunteer) {
                                                const sysMap: Record<string, string> = { 'GROUPS': 'Grupos', 'PUNTO': 'Punto', 'STORE': 'Store', 'ALABANZA': 'Alabanza' };
                                                const sysName = sysMap[user.linkedGroupId || ''] || user.linkedGroupId;
                                                roleBadges.push({ label: `Vol. ${sysName}`, colorClass: 'bg-blue-50 text-blue-600 border-blue-100' });
                                            } else if (user.linkedGroupId) {
                                                const g = groups.find(grp => grp.id === user.linkedGroupId);
                                                const groupName = g ? g.name : `Grupo ID: ...`;
                                                roleBadges.push({ label: `Líder`, colorClass: 'bg-amber-50 text-amber-600 border-amber-100' });
                                                areaLabel = groupName; // Set area label for context
                                            } else {
                                                roleBadges.push({ label: 'Anfitrión', colorClass: 'bg-amber-50 text-amber-600 border-amber-100' });
                                                areaLabel = 'Sin Asignar';
                                            }
                                        }

                                        if (roleBadges.length === 0) {
                                            roleBadges.push({ label: 'Usuario', colorClass: 'bg-slate-100 text-slate-500 border-slate-200' });
                                            areaLabel = 'Comunidad';
                                        }

                                        return (
                                            <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-4">
                                                    <p className="font-bold text-sm text-slate-900">{user.name}</p>
                                                    <p className="text-xs text-slate-500">{user.email}</p>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {roleBadges.map((badge, idx) => (
                                                            <span key={idx} className={`inline-block px-2 py-1 border rounded text-[10px] font-bold uppercase ${badge.colorClass}`}>
                                                                {badge.label}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <span className="text-xs font-bold text-slate-700 uppercase">
                                                        {areaLabel}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <button onClick={() => handleEditUser(user)} className="p-2 text-slate-400 hover:text-black hover:bg-slate-100 rounded-lg" title="Editar"><Edit2 className="w-4 h-4" /></button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {users.length === 0 && (
                                        <tr><td colSpan={4} className="p-8 text-center text-slate-400 text-sm">No hay usuarios registrados.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}



                {/* --- CONTENT MANAGEMENT TAB (CONFIG) --- */}
                {activeTab === 'config' && (
                    <div className="space-y-6 md:space-y-8 animate-fadeIn">
                        <div className="flex gap-2 md:gap-4 border-b border-slate-200 overflow-x-auto scrollbar-hide pb-1">
                            {[
                                { id: 'IDENTITY', icon: Palette, label: 'ID' },
                                { id: 'BANNERS', icon: Home, label: 'Banners' },
                                { id: 'INFO_POINT', icon: Info, label: 'Punto' },
                                { id: 'VALUES', icon: Home, label: 'Valores' },
                                { id: 'VERSES', icon: Book, label: 'Versos' },
                                { id: 'FOOTER', icon: Share2, label: 'Pies' },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setConfigSubTab(tab.id as any)}
                                    className={`pb-2 md:pb-4 px-1 md:px-2 flex items-center gap-1 md:gap-2 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${configSubTab === tab.id ? 'border-black text-black' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                >
                                    <tab.icon className="w-3 md:w-4 h-3 md:h-4" /> {tab.label}
                                </button>
                            ))}
                        </div>

                        {configSubTab === 'IDENTITY' && (
                            <div className="bg-off-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-lg border border-slate-200 max-w-4xl">
                                <h3 className="text-base md:text-xl font-black uppercase mb-4 md:mb-6 flex items-center gap-2"><Globe className="w-4 md:w-5 h-4 md:h-5" /> Config General</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                                    <div className="space-y-3 md:space-y-4">
                                        <div>
                                            <label className="text-[10px] md:text-xs font-bold uppercase text-slate-500 mb-1 block">Nombre App</label>
                                            <input type="text" value={config.appName} onChange={e => setConfig({ ...config, appName: e.target.value })} className="w-full p-2.5 md:p-3 border border-slate-200 rounded-lg text-xs md:text-sm font-bold uppercase outline-none focus:border-black" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] md:text-xs font-bold uppercase text-slate-500 mb-1 block">Slogan</label>
                                            <input type="text" value={config.appSlogan} onChange={e => setConfig({ ...config, appSlogan: e.target.value })} className="w-full p-2.5 md:p-3 border border-slate-200 rounded-lg text-xs md:text-sm font-bold uppercase outline-none focus:border-black" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] md:text-xs font-bold uppercase text-slate-500 mb-1 block">Color Marca</label>
                                            <div className="flex gap-2 items-center">
                                                <input type="color" value={config.brandColor} onChange={e => setConfig({ ...config, brandColor: e.target.value })} className="h-8 md:h-10 w-16 md:w-20 rounded cursor-pointer border border-slate-200" />
                                                <span className="text-[10px] md:text-xs font-mono text-slate-500">{config.brandColor}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] md:text-xs font-bold uppercase text-slate-500 mb-2 block">Logo de la App</label>
                                        <ImageUpload
                                            currentImage={config.logoUrl || ''}
                                            folder="branding"
                                            onImageUpload={(url) => setConfig({ ...config, logoUrl: url })}
                                            aspectRatio="square"
                                        />
                                    </div>
                                </div>
                                <div className="mt-6 md:mt-8 flex justify-end">
                                    <button onClick={handleSaveIdentity} className="px-4 md:px-8 py-2.5 md:py-3 bg-black text-white font-bold uppercase text-[10px] md:text-xs tracking-widest rounded-lg hover:bg-slate-800 flex items-center gap-2">
                                        <Save className="w-3.5 md:w-4 h-3.5 md:h-4" /> Guardar
                                    </button>
                                </div>
                            </div>
                        )}

                        {(configSubTab === 'BANNERS' || configSubTab === 'INFO_POINT') && (
                            <div className="space-y-4 md:space-y-6">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                    <h3 className="text-base md:text-xl font-black uppercase">
                                        {configSubTab === 'BANNERS' ? 'Slides Principal' : 'Banners Punto'}
                                    </h3>
                                    <button
                                        onClick={() => { setEditingSlide({ titlePrefix: '', titleHighlight: '', description: '', imageUrl: '' }); setIsSlideModalOpen(true); }}
                                        className="px-4 md:px-6 py-2 bg-black text-white text-[10px] md:text-xs font-bold uppercase rounded-lg hover:bg-slate-800 flex items-center gap-2 whitespace-nowrap"
                                    >
                                        <Plus className="w-3 md:w-4 h-3 md:h-4" /> Agregar
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                                    {(configSubTab === 'BANNERS' ? (config.banner.slides || []) : (config.infoPointConfig?.banners || [])).map(slide => (
                                        <div key={slide.id} className="bg-off-white rounded-xl shadow-sm border border-slate-200 overflow-hidden group">
                                            <div className="aspect-video bg-slate-100 relative">
                                                <img src={slide.imageUrl} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <button onClick={() => { setEditingSlide(slide); setIsSlideModalOpen(true); }} className="p-2 bg-white text-black rounded hover:bg-slate-200"><Edit2 className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDeleteSlide(slide.id)} className="p-2 bg-red-600 text-white rounded hover:bg-red-700"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                            <div className="p-4">
                                                <h4 className="font-bold text-sm uppercase">{slide.titlePrefix} <span className="text-slate-400">{slide.titleHighlight}</span></h4>
                                                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{slide.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {(configSubTab === 'INFO_POINT' && (!config.infoPointConfig?.banners || config.infoPointConfig.banners.length === 0)) && (
                                        <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                            No hay banners configurados.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {configSubTab === 'VALUES' && (
                            <div className="bg-off-white p-8 rounded-2xl shadow-lg border border-slate-200 max-w-4xl">
                                <h3 className="text-xl font-black uppercase mb-6">Sección "Nuestros Valores"</h3>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div><label className="text-xs font-bold uppercase text-slate-500">Título Sección</label><input type="text" value={valuesConfig.title} onChange={e => setValuesConfig({ ...valuesConfig, title: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg outline-none text-sm font-bold uppercase focus:border-black" /></div>
                                        <div><label className="text-xs font-bold uppercase text-slate-500">Descripción</label><textarea value={valuesConfig.description} onChange={e => setValuesConfig({ ...valuesConfig, description: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg outline-none text-sm h-32 resize-none focus:border-black" /></div>
                                        <div>
                                            <label className="text-xs font-bold uppercase text-slate-500 mb-2 block">Imagen Lateral</label>
                                            <ImageUpload
                                                currentImage={valuesConfig.image}
                                                folder="values"
                                                onImageUpload={(url) => setValuesConfig({ ...valuesConfig, image: url })}
                                                aspectRatio="square"
                                            />
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                                        <h4 className="text-xs font-bold uppercase text-slate-500 mb-4">Vista Previa Valores</h4>
                                        <div className="space-y-3">
                                            {valuesConfig.values.map(val => (
                                                <div key={val.id} className="flex gap-3 items-center">
                                                    <span className="text-xl">{val.icon}</span>
                                                    <div>
                                                        <p className="font-bold text-xs uppercase">{val.title}</p>
                                                        <p className="text-[10px] text-slate-500 truncate w-40">{val.description}</p>
                                                    </div>
                                                </div>
                                            ))}
                                            <p className="text-xs text-slate-400 italic mt-4 text-center">Edición de items individuales próximamente.</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-8 flex justify-end">
                                    <button onClick={handleSaveValuesConfig} className="px-8 py-3 bg-black text-white font-bold uppercase text-xs tracking-widest rounded-lg hover:bg-slate-800 flex items-center gap-2">
                                        <Save className="w-4 h-4" /> Guardar Cambios
                                    </button>
                                </div>
                            </div>
                        )}

                        {configSubTab === 'VERSES' && (
                            <div className="max-w-4xl space-y-8">
                                <div className="bg-off-white p-8 rounded-2xl shadow-lg border border-slate-200">
                                    <h3 className="text-xl font-black uppercase mb-6 flex items-center gap-2"><Book className="w-5 h-5" /> Versículos del Día</h3>

                                    <div className="flex gap-4 mb-8 items-end bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <div className="flex-1">
                                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Texto Bíblico</label>
                                            <input type="text" value={newVerse.text} onChange={e => setNewVerse({ ...newVerse, text: e.target.value })} placeholder="Porque de tal manera..." className="w-full p-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-black" />
                                        </div>
                                        <div className="w-48">
                                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Referencia</label>
                                            <input type="text" value={newVerse.ref} onChange={e => setNewVerse({ ...newVerse, ref: e.target.value })} placeholder="Juan 3:16" className="w-full p-3 border border-slate-200 rounded-lg text-sm font-bold uppercase outline-none focus:border-black" />
                                        </div>
                                        <button onClick={handleAddVerse} className="px-6 py-3 bg-black text-white font-bold uppercase text-xs rounded-lg hover:bg-slate-800 h-full">Agregar</button>
                                    </div>

                                    <div className="space-y-3">
                                        {(config.verses || []).map((verse, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-4 border border-slate-200 rounded-xl hover:border-black transition-colors group bg-white">
                                                <div>
                                                    <p className="text-sm font-medium italic text-slate-700">"{verse.text}"</p>
                                                    <p className="text-xs font-bold uppercase text-slate-500 mt-1">— {verse.ref}</p>
                                                </div>
                                                <button onClick={() => handleDeleteVerse(idx)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                        {(!config.verses || config.verses.length === 0) && (
                                            <p className="text-center text-slate-400 py-8 text-sm italic">No hay versículos configurados. Se usará uno por defecto.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {configSubTab === 'FOOTER' && (
                            <div className="max-w-4xl space-y-8 animate-fadeIn">
                                <div className="bg-off-white p-8 rounded-2xl shadow-lg border border-slate-200">
                                    <h3 className="text-xl font-black uppercase mb-6 flex items-center gap-2"><Share2 className="w-5 h-5" /> Redes Sociales & Pie de Página</h3>
                                    <p className="text-sm text-slate-500 mb-8">Configura los enlaces que aparecerán en el Hero Banner final de la página principal.</p>

                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-pink-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                                                <Instagram className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Instagram URL</label>
                                                <input
                                                    type="url"
                                                    value={footerConfig.instagram}
                                                    onChange={e => setFooterConfig({ ...footerConfig, instagram: e.target.value })}
                                                    className="w-full p-3 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-pink-600"
                                                    placeholder="https://instagram.com/..."
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                                                <Facebook className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Facebook URL</label>
                                                <input
                                                    type="url"
                                                    value={footerConfig.facebook}
                                                    onChange={e => setFooterConfig({ ...footerConfig, facebook: e.target.value })}
                                                    className="w-full p-3 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-blue-600"
                                                    placeholder="https://facebook.com/..."
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                                                <Youtube className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">YouTube URL</label>
                                                <input
                                                    type="url"
                                                    value={footerConfig.youtube}
                                                    onChange={e => setFooterConfig({ ...footerConfig, youtube: e.target.value })}
                                                    className="w-full p-3 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-red-600"
                                                    placeholder="https://youtube.com/..."
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                                                <Music className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Spotify URL</label>
                                                <input
                                                    type="url"
                                                    value={footerConfig.spotify}
                                                    onChange={e => setFooterConfig({ ...footerConfig, spotify: e.target.value })}
                                                    className="w-full p-3 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-green-500"
                                                    placeholder="https://open.spotify.com/..."
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-8 flex justify-end">
                                        <button onClick={handleSaveFooterLinks} className="px-8 py-3 bg-black text-white font-bold uppercase text-xs tracking-widest rounded-lg hover:bg-slate-800 flex items-center gap-2">
                                            <Save className="w-4 h-4" /> Guardar Enlaces
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* --- DATABASE MIGRATION TAB --- */}
                {activeTab === 'database' && (
                    <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 animate-fadeIn">
                        <div className="bg-off-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl border border-slate-200">
                            <div className="flex items-start md:items-center gap-3 md:gap-4 mb-4 md:mb-6">
                                <div className="p-2 md:p-3 bg-indigo-50 text-indigo-600 rounded-lg md:rounded-xl">
                                    <CloudUpload className="w-5 md:w-8 h-5 md:h-8" />
                                </div>
                                <div>
                                    <h3 className="text-lg md:text-2xl font-black text-slate-900 uppercase tracking-tight">Migración DB</h3>
                                    <p className="text-slate-500 text-[10px] md:text-sm">Transfiere datos locales a Supabase Cloud.</p>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 md:p-6 rounded-lg md:rounded-xl border border-slate-200 mb-6 md:mb-8">
                                <h4 className="font-bold text-[10px] md:text-sm text-slate-700 uppercase mb-2 md:mb-3 flex items-center gap-2">
                                    <Check className="w-3 md:w-4 h-3 md:h-4 text-emerald-500" /> Qué se migrará:
                                </h4>
                                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 md:gap-2 text-[10px] md:text-xs font-medium text-slate-600">
                                    <li className="flex items-center gap-2">✔ Usuarios y Credenciales</li>
                                    <li className="flex items-center gap-2">✔ Configuración Global</li>
                                    <li className="flex items-center gap-2">✔ Grupos y Categorías</li>
                                    <li className="flex items-center gap-2">✔ Miembros de Grupos</li>
                                    <li className="flex items-center gap-2">✔ Canciones (Alabanza)</li>
                                    <li className="flex items-center gap-2">✔ Productos Tienda</li>
                                </ul>
                            </div>

                            <div className="space-y-4">
                                <button
                                    onClick={handleMigration}
                                    disabled={isMigrating}
                                    className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest text-sm shadow-lg transition-all flex items-center justify-center gap-3 ${isMigrating ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-[1.01]'}`}
                                >
                                    {isMigrating ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-transparent"></div>
                                            Migrando...
                                        </>
                                    ) : (
                                        <>
                                            <CloudUpload className="w-5 h-5" /> Iniciar Migración a Supabase
                                        </>
                                    )}
                                </button>

                                {/* Log Console */}
                                <div className="bg-black rounded-xl p-4 font-mono text-xs text-green-400 h-64 overflow-y-auto shadow-inner border border-slate-700">
                                    <div className="opacity-50 mb-2 border-b border-white/10 pb-2">--- LOG DE MIGRACIÓN ---</div>
                                    <pre className="whitespace-pre-wrap">{migrationStatus || 'Esperando inicio...'}</pre>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- LOGS TAB --- */}
                {activeTab === 'logs' && (
                    <AdminAuditLogs />
                )}

                {/* Edit Slide Modal - BRUTALIST */}
                {isSlideModalOpen && editingSlide && (
                    <NeoModal
                        isOpen={isSlideModalOpen}
                        onClose={() => { setIsSlideModalOpen(false); setEditingSlide(null); }}
                        title="Editor Slide"
                    >
                        <div className="flex flex-col gap-6">
                            <div>
                                <label className="text-xs font-black uppercase text-neutral-500 mb-2 block">Imagen del Slide</label>
                                <ImageUpload
                                    currentImage={editingSlide.imageUrl || ''}
                                    folder="banners"
                                    onImageUpload={(url) => setEditingSlide({ ...editingSlide, imageUrl: url })}
                                    aspectRatio="wide"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="text-xs font-black uppercase text-neutral-500 mb-1 block">Texto Principal</label><input type="text" value={editingSlide.titlePrefix || ''} onChange={e => setEditingSlide({ ...editingSlide, titlePrefix: e.target.value })} className="w-full p-3 border-2 border-black text-sm font-bold uppercase focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none" placeholder="Ej: PLATAFORMA" /></div>
                                <div><label className="text-xs font-black uppercase text-neutral-500 mb-1 block">Texto del Medio (Destacado)</label><input type="text" value={editingSlide.titleHighlight || ''} onChange={e => setEditingSlide({ ...editingSlide, titleHighlight: e.target.value })} className="w-full p-3 border-2 border-black text-sm font-bold uppercase focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none" placeholder="Ej: ORIGEN" /></div>
                            </div>
                            <div><label className="text-xs font-black uppercase text-neutral-500 mb-1 block">Descripción (Subtítulo)</label><textarea value={editingSlide.description || ''} onChange={e => setEditingSlide({ ...editingSlide, description: e.target.value })} className="w-full p-3 border-2 border-black text-sm font-medium h-24 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none resize-none" placeholder="Breve descripción..." /></div>
                            <div><label className="text-xs font-black uppercase text-neutral-500 mb-1 block">Texto Botón (CTA)</label><input type="text" value={editingSlide.buttonText || ''} onChange={e => setEditingSlide({ ...editingSlide, buttonText: e.target.value })} className="w-full p-3 border-2 border-black text-sm font-bold uppercase focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none" placeholder="Ej: VER MÓDULOS" /></div>

                            <div className="pt-4 border-t-2 border-black flex justify-end gap-3 bg-white">
                                <button onClick={() => { setIsSlideModalOpen(false); setEditingSlide(null); }} className="px-6 py-3 text-xs font-black uppercase border-2 border-black hover:bg-neutral-100">Cancelar</button>
                                <button onClick={handleSaveSlide} className="px-6 py-3 bg-black text-white text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_rgba(100,100,100,1)] hover:shadow-[5px_5px_0px_0px_rgba(100,100,100,1)] hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all">Guardar Slide</button>
                            </div>
                        </div>
                    </NeoModal>
                )}



            </div>
        </div>
    );
};

export default Admin;