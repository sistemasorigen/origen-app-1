


import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../../services/dbService';
import { supabaseService } from '../../services/supabaseService';
import {
    getMusicaBannerSlides,
    createMusicaBannerSlide,
    updateMusicaBannerSlide,
    deleteMusicaBannerSlide,
    MusicaBannerSlideInput
} from '../../services/supabaseService';
import { User, UserRole, Log, SystemModule, AppConfig, BannerSlide, MusicaBannerSlide, ValuesSectionConfig, Group, FooterLinks, CoordinatorVariant } from '../../types';
import { Users, Shield, Home, Database, CloudUpload, Save, Search, X, Check, Book, Palette, Globe, Plus, Edit2, Trash2, Info, UserCheck, ClipboardList, CheckCircle, XCircle, Share2, Instagram, Facebook, Youtube, Music, Eye, Loader2, Medal, Film } from 'lucide-react';
import ImageUpload from '../../components/media/SubidaImagen';
import VideoUpload from '../../components/media/SubidaVideo';
import EncuadreMedia from '../../components/media/EncuadreMedia';
import AdminAuditLogs from '../../components/admin/RegistroAuditoriaAdmin';
import NeoModal from '../../components/ui/NeoModal';
import AdminDropdown from '../../components/admin/MenuDesplegableAdmin';


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

    // Coordinator Variant State — soporta múltiples departamentos por coordinador
    const [coordinatorVariants, setCoordinatorVariants] = useState<CoordinatorVariant[]>([]);

    // Module States
    const [modules, setModules] = useState<SystemModule[]>([]);

    // Config State
    const [config, setConfig] = useState<AppConfig>(db.getAppConfig());

    // Slide Management State
    const [editingSlide, setEditingSlide] = useState<Partial<BannerSlide> | null>(null);
    const [isSlideModalOpen, setIsSlideModalOpen] = useState(false);

    // "Origen Música" Mini-Banner State — tabla dedicada, NO usa
    // editingSlide/isSlideModalOpen (esos gobiernan config.banner, un
    // sistema de persistencia distinto — JSON en AppConfig).
    const [musicaSlides, setMusicaSlides] = useState<MusicaBannerSlide[]>([]);
    const [editingMusicaSlide, setEditingMusicaSlide] = useState<Partial<MusicaBannerSlideInput> & { id?: string } | null>(null);
    const [isMusicaModalOpen, setIsMusicaModalOpen] = useState(false);
    const [savingMusica, setSavingMusica] = useState(false);

    // Verse Management State
    const [newVerse, setNewVerse] = useState({ text: '', ref: '' });

    // Values Section Management State
    const [valuesConfig, setValuesConfig] = useState<ValuesSectionConfig>(config.valuesSection || {
        image: '', title: '', description: '', values: [], buttonText: '', buttonLink: ''
    });

    // Footer Config State
    const [footerConfig, setFooterConfig] = useState<FooterLinks>({ instagram: '', facebook: '', youtube: '', spotify: '' });





    const [activeTab, setActiveTab] = useState<'users' | 'leaders' | 'postulations' | 'config' | 'logs'>('users');
    const [searchParams] = useSearchParams();

    // Deep linking
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['users', 'leaders', 'config', 'logs'].includes(tab)) {
            setActiveTab(tab as any);
        }
    }, [searchParams]);
    const [configSubTab, setConfigSubTab] = useState<'IDENTITY' | 'BANNERS' | 'MUSICA' | 'VALUES' | 'VERSES' | 'INFO_POINT' | 'FOOTER'>('IDENTITY');

    // User Sub-Tabs State - Updated to include 'all' tab
    const [userSubTab, setUserSubTab] = useState<'all' | 'admins' | 'area_admins' | 'volunteers' | 'all_volunteers' | 'viewers'>('all');

    // User Details Modal State
    const [viewingUser, setViewingUser] = useState<User | null>(null);

    // Toast State
    const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

    // Migration State

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

            // Fetch "Origen Música" mini-banner slides
            setMusicaSlides(await getMusicaBannerSlides());

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
            setCoordinatorVariants(
                currentUserData.coordinatorVariants && currentUserData.coordinatorVariants.length > 0
                    ? currentUserData.coordinatorVariants
                    : (currentUserData.coordinatorVariant ? [currentUserData.coordinatorVariant] : [])
            );

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
            setCoordinatorVariants([]);
        }
    }, [currentUserData]);

    const handleNewUserClick = () => {
        setIsEditing(true);
        setCurrentUserData({ isActive: true, linkedGroupId: undefined });
        setFirstName('');
        setLastName('');
        setNewUserPassword('');
        setAdditionalVolunteerRoles([]);
        setCoordinatorVariants([]);
        setSelectedRoles(new Set([UserRole.VIEWER]));
        setSystemScope('GROUPS');
    };

    const toggleCoordinatorVariant = (variant: CoordinatorVariant) => {
        setCoordinatorVariants(prev =>
            prev.includes(variant) ? prev.filter(v => v !== variant) : [...prev, variant]
        );
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
        UserRole.VOLUNTEER, UserRole.VOLUNTARIO, UserRole.ADMIN_CUIDADO_PASTORAL, UserRole.INFLUOS, UserRole.PRODE, UserRole.EVENTOS, UserRole.ENCARGADO_EVENTOS, UserRole.ENCARGADO_NINEZ, UserRole.ACREDITACION];
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
            coordinatorVariants: finalRolesArray.includes(UserRole.COORDINATOR) ? coordinatorVariants : [],
            coordinatorVariant: finalRolesArray.includes(UserRole.COORDINATOR) && coordinatorVariants.length > 0
                ? coordinatorVariants[0]
                : undefined
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

        // Si eligió video pero no cargó ninguno, el slide vuelve a imagen: un
        // slide marcado como video sin videoUrl se vería en negro.
        const mediaType: 'image' | 'video' =
            editingSlide.mediaType === 'video' && editingSlide.videoUrl ? 'video' : 'image';

        const slideToSave: BannerSlide = {
            id: editingSlide.id || safeUUID(),
            imageUrl: editingSlide.imageUrl || '',
            mediaType,
            videoUrl: mediaType === 'video' ? editingSlide.videoUrl : undefined,
            focalX: editingSlide.focalX ?? 50,
            focalY: editingSlide.focalY ?? 50,
            zoom: editingSlide.zoom ?? 1,
            eyebrow: editingSlide.eyebrow,
            titlePrefix: editingSlide.titlePrefix,
            titleHighlight: editingSlide.titleHighlight,
            description: editingSlide.description,
            buttonText: editingSlide.buttonText,
            buttonLink: editingSlide.buttonLink,
            // Se preservan aunque el editor no los toque: son los campos
            // nuevos del tipo y otros temas del carrusel ya los leen.
            title: editingSlide.title,
            subtitle: editingSlide.subtitle,
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

    // "Origen Música" Mini-Banner — tabla dedicada home_musica_banner_slides.
    // La imagen solo es obligatoria en modo 'image' (ahí ES el contenido).
    // En modo 'video' es apenas una portada opcional: sin ella, el fallback
    // público es directamente pantalla negra (MusicaCarousel en Home.tsx).
    const handleSaveMusicaSlide = async () => {
        if (!editingMusicaSlide?.targetUrl) return;
        const mediaType = editingMusicaSlide.mediaType || 'image';
        if (mediaType !== 'video' && !editingMusicaSlide.mediaUrl) return;
        setSavingMusica(true);

        const input: MusicaBannerSlideInput = {
            mediaUrl: editingMusicaSlide.mediaUrl,
            mediaType: editingMusicaSlide.mediaType || 'image',
            videoUrl: editingMusicaSlide.videoUrl,
            focalX: editingMusicaSlide.focalX,
            focalY: editingMusicaSlide.focalY,
            zoom: editingMusicaSlide.zoom,
            title: editingMusicaSlide.title,
            targetUrl: editingMusicaSlide.targetUrl,
            displayOrder: editingMusicaSlide.displayOrder ?? musicaSlides.length
        };

        if (editingMusicaSlide.id) {
            await updateMusicaBannerSlide(editingMusicaSlide.id, input);
        } else {
            await createMusicaBannerSlide(input);
        }

        setMusicaSlides(await getMusicaBannerSlides());
        setSavingMusica(false);
        setIsMusicaModalOpen(false);
        setEditingMusicaSlide(null);
    };

    const handleDeleteMusicaSlide = async (id: string) => {
        await deleteMusicaBannerSlide(id);
        setMusicaSlides(prev => prev.filter(s => s.id !== id));
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
                        <div key={user.id} className="bg-white border border-slate-200 p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                            <div className="flex justify-between items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-black uppercase truncate">{user.name}</p>
                                    <p className="text-[11px] text-neutral-500 truncate">{user.email}</p>
                                </div>
                                <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 border-2 text-[9px] font-bold uppercase ${user.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-400' : 'bg-red-50 text-red-700 border-red-400'}`}>
                                    <span className={`w-1.5 h-1.5 ${user.isActive ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                    {user.isActive ? 'Activo' : 'Inact.'}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-2">
                                {(user.roles && user.roles.length > 0 ? user.roles : [user.role]).map(r => (
                                    <span key={r} className="inline-block px-2 py-0.5 bg-black text-white text-[9px] font-bold uppercase">
                                        {r.replace('ADMIN_', '')}
                                    </span>
                                ))}
                                {displayLink && (
                                    <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-300 text-[9px] font-bold uppercase">
                                        {displayLink}
                                    </span>
                                )}
                            </div>
                            <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-black/10">
                                <button onClick={() => setViewingUser(user)} className="p-2.5 min-h-[44px] min-w-[44px] border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center" title="Ver detalles"><Eye className="w-4 h-4" /></button>
                                <button onClick={() => handleEditUser(user)} className="p-2.5 min-h-[44px] min-w-[44px] border border-slate-200 text-black hover:bg-black hover:text-white transition-all flex items-center justify-center" title="Editar"><Edit2 className="w-4 h-4" /></button>
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
            <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-md">
                <table className="w-full text-left">
                    <thead className="bg-black text-white text-xs font-bold text-slate-700">
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
                                        <p className="font-bold text-sm text-black uppercase">{user.name}</p>
                                        <p className="text-xs text-neutral-500">{user.email}</p>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-wrap gap-1">
                                            {(user.roles && user.roles.length > 0 ? user.roles : [user.role]).map(r => (
                                                <span key={r} className="inline-block px-2 py-1 bg-white text-black border border-slate-200 text-[10px] font-bold uppercase">{r}</span>
                                            ))}
                                        </div>
                                        {user.linkedGroupId && (
                                            <span className="ml-2 inline-block px-2 py-1 bg-blue-50 text-blue-800 border-2 border-blue-300 text-[10px] font-bold uppercase">{displayLink}</span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 border-2 text-[10px] font-bold uppercase ${user.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-400' : 'bg-red-50 text-red-700 border-red-400'}`}>
                                            <span className={`w-2 h-2 ${user.isActive ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                            {user.isActive ? 'Activo' : 'Inact.'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setViewingUser(user)} className="p-2 border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition-all" title="Ver detalles"><Eye className="w-4 h-4" /></button>
                                            <button onClick={() => handleEditUser(user)} className="p-2 border border-slate-200 text-black hover:bg-black hover:text-white transition-all" title="Editar"><Edit2 className="w-4 h-4" /></button>
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
                    <span className="font-bold text-sm text-slate-700">{toast.message}</span>
                </div>
            )}

            {/* Header - Brutalist */}
            <div className="bg-white border-b-4 border-black sticky top-16 z-30">
                <div className="max-w-[1920px] mx-auto px-4 md:px-6 py-4 md:py-0 md:h-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-0">
                    <h1 className="text-xl md:text-3xl font-bold text-black tracking-tighter">Panel Administración</h1>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        {/* Mobile: Dropdown */}
                        <div className="block md:hidden w-full">
                            <AdminDropdown
                                tabs={[
                                    { id: 'users', icon: Users, label: 'Usuarios' },
                                    { id: 'config', icon: Home, label: 'Config' },
                                    { id: 'logs', icon: Shield, label: 'Logs' },
                                ]}
                                activeTab={activeTab}
                                onTabChange={(tabId) => setActiveTab(tabId as any)}
                            />
                        </div>

                        {/* Desktop: Inline tabs */}
                        <div className="hidden md:flex gap-2">
                            {[
                                { id: 'users', icon: Users, label: 'Usuarios' },
                                { id: 'config', icon: Home, label: 'Config' },
                                { id: 'logs', icon: Shield, label: 'Logs' },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 border border-slate-200 text-[10px] md:text-xs font-bold uppercase transition-all whitespace-nowrap ${activeTab === tab.id
                                        ? 'bg-black text-white shadow-none translate-y-[2px]'
                                        : 'bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-md'
                                        }`}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                </button>
                            ))}
                        </div>
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
                                    <h4 className="text-xs font-bold text-neutral-500 text-slate-700 border-b-2 border-neutral-200 pb-2">Datos Personales</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                                        <div><label className="text-xs font-bold uppercase text-neutral-500">Nombre</label><input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full p-3 border border-slate-200 text-sm font-bold uppercase focus:shadow-md focus:ring-0 outline-none" /></div>
                                        <div><label className="text-xs font-bold uppercase text-neutral-500">Apellido</label><input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full p-3 border border-slate-200 text-sm font-bold uppercase focus:shadow-md focus:ring-0 outline-none" /></div>
                                    </div>
                                    <div><label className="text-xs font-bold uppercase text-neutral-500">Email</label><input type="email" value={currentUserData.email || ''} onChange={e => setCurrentUserData({ ...currentUserData, email: e.target.value })} className="w-full p-3 border border-slate-200 text-sm font-medium focus:shadow-md focus:ring-0 outline-none" /></div>
                                    <div>
                                        <label className="text-xs font-bold uppercase text-neutral-500">Contraseña {currentUserData.id && '(Dejar vacío para no cambiar)'}</label>
                                        <input type="password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} className="w-full p-3 border border-slate-200 text-sm font-medium focus:shadow-md focus:ring-0 outline-none" placeholder="••••••" />
                                    </div>
                                    <div className="flex items-center gap-3 pt-2">
                                        <div onClick={() => setCurrentUserData({ ...currentUserData, isActive: !currentUserData.isActive })} className={`w-12 h-6 cursor-pointer transition-colors relative border border-slate-200 ${currentUserData.isActive ? 'bg-emerald-500' : 'bg-neutral-300'}`}>
                                            <div className={`w-4 h-4 bg-white border border-black absolute top-0.5 transition-all ${currentUserData.isActive ? 'left-6' : 'left-0.5'}`}></div>
                                        </div>
                                        <span className="text-sm font-bold uppercase text-neutral-600">Usuario Activo</span>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <h4 className="text-xs font-bold text-neutral-500 text-slate-700 border-b-2 border-neutral-200 pb-2">Nivel de Acceso (Selección Múltiple)</h4>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-4">
                                        {/* Level 1 */}
                                        <div onClick={() => toggleRole(UserRole.VIEWER)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center flex items-center justify-center min-h-[64px] md:min-h-[88px] ${selectedRoles.has(UserRole.VIEWER) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-bold uppercase">USUARIO</span>
                                        </div>
                                        {/* Level 2 - Anfitrión: Can create their own group */}
                                        <div onClick={() => toggleRole(UserRole.ANFITRION)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center flex items-center justify-center min-h-[64px] md:min-h-[88px] ${selectedRoles.has(UserRole.ANFITRION) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-bold uppercase">ANFITRIÓN</span>
                                        </div>
                                        {/* Level 2b - Co-Anfitrión: Can manage assigned groups */}
                                        <div onClick={() => toggleRole(UserRole.CO_ANFITRION)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center flex items-center justify-center min-h-[64px] md:min-h-[88px] ${selectedRoles.has(UserRole.CO_ANFITRION) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-bold uppercase">CO-ANFITRIÓN</span>
                                        </div>
                                        {/* Level 3 - Voluntario */}
                                        <div onClick={() => toggleRole(UserRole.VOLUNTEER)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center flex items-center justify-center min-h-[64px] md:min-h-[88px] ${selectedRoles.has(UserRole.VOLUNTEER) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-bold uppercase">VOLUNTARIO</span>
                                        </div>

                                        {/* Level 4 - Admins */}
                                        <div onClick={() => toggleRole(UserRole.ADMIN_PUNTO)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center flex items-center justify-center min-h-[64px] md:min-h-[88px] ${selectedRoles.has(UserRole.ADMIN_PUNTO) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-bold uppercase">ENCARGADO PUNTO</span>
                                        </div>
                                        <div onClick={() => toggleRole(UserRole.ADMIN_GROUPS)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center flex items-center justify-center min-h-[64px] md:min-h-[88px] ${selectedRoles.has(UserRole.ADMIN_GROUPS) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-bold uppercase">ENCARGADO GRUPOS</span>
                                        </div>
                                        <div onClick={() => toggleRole(UserRole.ADMIN_STORE)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center flex items-center justify-center min-h-[64px] md:min-h-[88px] ${selectedRoles.has(UserRole.ADMIN_STORE) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-bold uppercase">ENCARGADO STORE</span>
                                        </div>
                                        <div onClick={() => toggleRole(UserRole.ADMIN_ALABANZA)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center flex items-center justify-center min-h-[64px] md:min-h-[88px] ${selectedRoles.has(UserRole.ADMIN_ALABANZA) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-bold uppercase">ENCARGADO ALABANZA</span>
                                        </div>
                                        <div onClick={() => toggleRole(UserRole.ENCARGADO_BIENVENIDA)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center flex items-center justify-center min-h-[64px] md:min-h-[88px] ${selectedRoles.has(UserRole.ENCARGADO_BIENVENIDA) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-bold uppercase">ENCARGADO BIENVENIDA</span>
                                        </div>
                                        <div onClick={() => toggleRole(UserRole.ADMIN_CUIDADO_PASTORAL)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center flex items-center justify-center min-h-[64px] md:min-h-[88px] ${selectedRoles.has(UserRole.ADMIN_CUIDADO_PASTORAL) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-bold uppercase">AUDIENCIA SERVICIO</span>
                                        </div>
                                        <div onClick={() => toggleRole(UserRole.INFLUOS)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center flex items-center justify-center min-h-[64px] md:min-h-[88px] ${selectedRoles.has(UserRole.INFLUOS) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-bold uppercase">INFLUOS</span>
                                        </div>
                                        <div onClick={() => toggleRole(UserRole.PRODE)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center flex items-center justify-center min-h-[64px] md:min-h-[88px] ${selectedRoles.has(UserRole.PRODE) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-bold uppercase">PRODE</span>
                                        </div>

                                        <div onClick={() => toggleRole(UserRole.EVENTOS)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center flex items-center justify-center min-h-[64px] md:min-h-[88px] ${selectedRoles.has(UserRole.EVENTOS) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-bold uppercase">Eventos</span>
                                        </div>

                                        <div onClick={() => toggleRole(UserRole.ENCARGADO_EVENTOS)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center flex items-center justify-center min-h-[64px] md:min-h-[88px] ${selectedRoles.has(UserRole.ENCARGADO_EVENTOS) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-bold uppercase">Enc. Eventos</span>
                                        </div>

                                        <div onClick={() => toggleRole(UserRole.ENCARGADO_NINEZ)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center flex items-center justify-center min-h-[64px] md:min-h-[88px] ${selectedRoles.has(UserRole.ENCARGADO_NINEZ) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-bold uppercase">Enc. Niñez</span>
                                        </div>

                                        <div onClick={() => toggleRole(UserRole.ACREDITACION)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center flex items-center justify-center min-h-[64px] md:min-h-[88px] ${selectedRoles.has(UserRole.ACREDITACION) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-bold uppercase">Acreditación</span>
                                        </div>

                                        {/* Level 5 */}
                                        <div onClick={() => toggleRole(UserRole.PASTOR)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center flex items-center justify-center min-h-[64px] md:min-h-[88px] ${selectedRoles.has(UserRole.PASTOR) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-bold uppercase">REPORTES</span>
                                        </div>
                                        {/* Level 6 */}
                                        <div onClick={() => toggleRole(UserRole.SUPER_ADMIN)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center flex items-center justify-center min-h-[64px] md:min-h-[88px] ${selectedRoles.has(UserRole.SUPER_ADMIN) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-bold uppercase">S. ADMIN</span>
                                        </div>

                                        {/* Coordinator Role */}
                                        <div onClick={() => toggleRole(UserRole.COORDINATOR)} className={`p-2 md:p-4 border-2 cursor-pointer transition-all text-center flex items-center justify-center min-h-[64px] md:min-h-[88px] ${selectedRoles.has(UserRole.COORDINATOR) ? 'border-black bg-black text-white shadow-none' : 'border-black bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                                            <span className="block text-[10px] md:text-xs font-bold uppercase">COORDINADOR</span>
                                        </div>
                                    </div>

                                    {/* Coordinator Variant Selector — multi-select de departamentos */}
                                    {selectedRoles.has(UserRole.COORDINATOR) && (
                                        <div className="space-y-3 bg-emerald-50 p-4 border-2 border-emerald-300 animate-fadeIn">
                                            <label className="text-xs font-bold uppercase text-emerald-700">
                                                Departamentos de Coordinación ({coordinatorVariants.length})
                                            </label>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                {Object.values(CoordinatorVariant).map(v => (
                                                    <div
                                                        key={v}
                                                        onClick={() => toggleCoordinatorVariant(v)}
                                                        className={`p-2 border-2 cursor-pointer transition-all text-center flex items-center justify-center min-h-[48px] ${coordinatorVariants.includes(v) ? 'border-black bg-black text-white' : 'border-emerald-300 bg-white text-black hover:border-black'}`}
                                                    >
                                                        <span className="block text-[10px] font-bold uppercase leading-tight">{v.replace(/_/g, ' ')}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="text-[10px] text-emerald-600 leading-tight">
                                                Selecciona uno o más departamentos que coordina este usuario.
                                            </p>
                                        </div>
                                    )}

                                    {(selectedRoles.has(UserRole.VOLUNTEER)) && (
                                        <div className="space-y-3 bg-neutral-50 p-4 border border-slate-200 animate-fadeIn">
                                            <label className="text-xs font-bold uppercase text-neutral-500">Área de Sistema (Voluntariado)</label>
                                            <select
                                                value={systemScope}
                                                onChange={e => setSystemScope(e.target.value as SystemScope)}
                                                className="w-full p-3 border border-slate-200 bg-white text-sm font-bold uppercase focus:shadow-md focus:ring-0 outline-none"
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
                                            <label className="text-xs font-bold uppercase text-blue-700">Roles Actuales ({selectedRoles.size})</label>
                                            <div className="flex flex-wrap gap-2">
                                                {Array.from(selectedRoles).map(role => (
                                                    <div
                                                        key={role}
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 text-[10px] font-bold uppercase group hover:bg-red-50 hover:border-red-500 transition-colors"
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
                                <button onClick={() => setIsEditing(false)} className="px-6 py-3 text-xs font-bold uppercase border border-slate-200 hover:bg-neutral-100">Cancelar</button>
                                <button onClick={handleSaveUser} className="px-6 md:px-8 py-3 bg-black text-white text-xs font-bold text-slate-700 border border-slate-200 shadow-[3px_3px_0px_0px_rgba(100,100,100,1)] hover:shadow-[5px_5px_0px_0px_rgba(100,100,100,1)] hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all">Guardar</button>
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
                                <div className="w-16 h-16 bg-black text-white flex items-center justify-center text-2xl font-bold uppercase border border-slate-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
                                    {viewingUser.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-xl md:text-2xl font-bold tracking-tight leading-none">{viewingUser.name}</h3>
                                    <p className="text-sm font-bold text-neutral-500 uppercase mt-1">ID: <span className="font-mono text-xs">{viewingUser.id.slice(0, 8)}...</span></p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Email */}
                                <div className="bg-neutral-50 p-4 border border-slate-200">
                                    <label className="text-[10px] font-bold uppercase text-neutral-500 tracking-widest">Email</label>
                                    <p className="text-sm font-medium text-black mt-1 break-all">{viewingUser.email || '-'}</p>
                                </div>

                                {/* Two columns for Phone and Age */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-neutral-50 p-4 border border-slate-200">
                                        <label className="text-[10px] font-bold uppercase text-neutral-500 tracking-widest">Teléfono</label>
                                        <p className="text-sm font-bold text-black mt-1">{viewingUser.phone || 'No registrado'}</p>
                                    </div>
                                    <div className="bg-neutral-50 p-4 border border-slate-200">
                                        <label className="text-[10px] font-bold uppercase text-neutral-500 tracking-widest">Edad</label>
                                        <p className="text-sm font-bold text-black mt-1">{viewingUser.age ? `${viewingUser.age} años` : 'No registrada'}</p>
                                    </div>
                                </div>

                                {/* Birth Date */}
                                <div className="bg-neutral-50 p-4 border border-slate-200">
                                    <label className="text-[10px] font-bold uppercase text-neutral-500 tracking-widest">Fecha de Cumpleaños</label>
                                    <p className="text-sm font-bold text-black mt-1">
                                        {viewingUser.birthDate
                                            ? new Date(viewingUser.birthDate + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
                                            : 'No registrada'}
                                    </p>
                                </div>

                                {/* Gender */}
                                <div className="bg-neutral-50 p-4 border border-slate-200">
                                    <label className="text-[10px] font-bold uppercase text-neutral-500 tracking-widest">Sexo</label>
                                    <p className="text-sm font-bold text-black mt-1 uppercase">{viewingUser.gender || 'No registrado'}</p>
                                </div>

                                {/* Role & Status */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-neutral-50 p-4 border border-slate-200">
                                        <label className="text-[10px] font-bold uppercase text-neutral-500 tracking-widest">Rol(es)</label>
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {(viewingUser.roles && viewingUser.roles.length > 0 ? viewingUser.roles : [viewingUser.role]).map(r => (
                                                <span key={r} className="inline-block px-2 py-1 bg-black text-white text-[9px] font-bold uppercase">{r}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-neutral-50 p-4 border border-slate-200">
                                        <label className="text-[10px] font-bold uppercase text-neutral-500 tracking-widest">Estado</label>
                                        <p className={`text-sm font-bold mt-1 uppercase ${viewingUser.isActive ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {viewingUser.isActive ? '● Activo' : '○ Inactivo'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="mt-2 pt-4 border-t-2 border-black flex justify-end">
                                <button onClick={() => setViewingUser(null)} className="px-6 py-3 bg-black text-white text-xs font-bold text-slate-700 border border-slate-200 shadow-[3px_3px_0px_0px_rgba(100,100,100,1)] hover:shadow-[5px_5px_0px_0px_rgba(100,100,100,1)] hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all">Cerrar</button>
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
                                className="w-full pl-10 pr-4 py-3 border border-slate-200 text-sm font-bold uppercase placeholder:text-neutral-400 focus:shadow-md outline-none transition-all rounded-none"
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
                                        className={`px-3 py-2 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all border border-slate-200 whitespace-nowrap ${userSubTab === sub.id ? 'bg-black text-white' : 'bg-white text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}
                                    >
                                        {sub.label} <span className="ml-1">{sub.count}</span>
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => handleNewUserClick()} className="flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-black text-white text-[10px] md:text-xs font-bold text-slate-700 border border-slate-200 shadow-[3px_3px_0px_0px_rgba(100,100,100,1)] hover:shadow-[5px_5px_0px_0px_rgba(100,100,100,1)] hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all whitespace-nowrap">
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
                            <h2 className="text-lg md:text-xl font-bold tracking-tight">Directorio</h2>
                            <button
                                onClick={() => handleNewUserClick()}
                                className="flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-black text-white text-[10px] md:text-xs font-semibold text-slate-600 hover:bg-slate-800 rounded-lg shadow-lg whitespace-nowrap"
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
                                { id: 'MUSICA', icon: Music, label: 'Música' },
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
                                <h3 className="text-base md:text-xl font-bold uppercase mb-4 md:mb-6 flex items-center gap-2"><Globe className="w-4 md:w-5 h-4 md:h-5" /> Config General</h3>
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
                                    <button onClick={handleSaveIdentity} className="px-4 md:px-8 py-2.5 md:py-3 bg-slate-900 text-white font-medium uppercase text-[10px] md:text-xs tracking-widest rounded-lg hover:bg-slate-800 flex items-center gap-2">
                                        <Save className="w-3.5 md:w-4 h-3.5 md:h-4" /> Guardar
                                    </button>
                                </div>
                            </div>
                        )}

                        {configSubTab === 'BANNERS' && (
                            <div className="space-y-4 md:space-y-6">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                    <h3 className="text-base md:text-xl font-bold uppercase">
                                        {configSubTab === 'BANNERS' ? 'Slides Principal' : 'Banners Punto'}
                                    </h3>
                                    <button
                                        onClick={() => { setEditingSlide({ mediaType: 'image', titlePrefix: '', titleHighlight: '', description: '', imageUrl: '' }); setIsSlideModalOpen(true); }}
                                        className="px-4 md:px-6 py-2 bg-black text-white text-[10px] md:text-xs font-bold uppercase rounded-lg hover:bg-slate-800 flex items-center gap-2 whitespace-nowrap"
                                    >
                                        <Plus className="w-3 md:w-4 h-3 md:h-4" /> Agregar
                                    </button>
                                </div>
                                {/* MEDIDAS DEL MARCO — globales, no por slide: todos los
                                    slides comparten el mismo carrusel, y alturas distintas
                                    harían saltar la página en cada transición. Definen la
                                    proporción, no el tamaño real: el banner es fluido. */}
                                <div className="bg-off-white p-4 md:p-6 rounded-xl border border-slate-200">
                                    <h4 className="text-xs font-bold uppercase text-neutral-500 mb-1">Encuadre del Banner</h4>
                                    <p className="text-[11px] text-neutral-500 mb-4">
                                        Proporción del hero. El banner se adapta al ancho de la pantalla; estas medidas fijan la forma, no el tamaño.
                                    </p>
                                    <div className="flex flex-wrap items-end gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold uppercase text-neutral-500 mb-1 block">Ancho (px)</label>
                                            <input
                                                type="number"
                                                min={320}
                                                value={config.banner?.frameWidth || 1920}
                                                onChange={e => setConfig({ ...config, banner: { ...config.banner, frameWidth: Number(e.target.value) } })}
                                                className="w-28 p-2.5 border border-slate-200 text-sm font-bold tabular-nums outline-none focus:shadow-md"
                                            />
                                        </div>
                                        <span className="pb-3 text-neutral-400 font-bold">×</span>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase text-neutral-500 mb-1 block">Alto (px)</label>
                                            <input
                                                type="number"
                                                min={120}
                                                value={config.banner?.frameHeight || 720}
                                                onChange={e => setConfig({ ...config, banner: { ...config.banner, frameHeight: Number(e.target.value) } })}
                                                className="w-28 p-2.5 border border-slate-200 text-sm font-bold tabular-nums outline-none focus:shadow-md"
                                            />
                                        </div>
                                        <div className="flex flex-wrap gap-2 pb-0.5">
                                            {([[1920, 1080, '16:9'], [1920, 720, '8:3'], [1920, 640, '3:1']] as const).map(([w, h, label]) => (
                                                <button
                                                    key={label}
                                                    type="button"
                                                    onClick={() => setConfig({ ...config, banner: { ...config.banner, frameWidth: w, frameHeight: h } })}
                                                    className="px-3 py-2.5 border-2 border-slate-200 text-[10px] font-bold uppercase text-neutral-600 hover:border-black hover:text-black transition-colors"
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => saveConfig(config)}
                                            className="px-5 py-2.5 bg-black text-white text-[10px] font-bold uppercase hover:bg-slate-800 flex items-center gap-2"
                                        >
                                            <Save className="w-3 h-3" /> Guardar
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-amber-700 font-semibold mt-3">
                                        Cuanto más panorámico, más se recorta en el teléfono. Revisá el encuadre de cada slide después de cambiarlo.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                                    {(configSubTab === 'BANNERS' ? (config.banner.slides || []) : (config.infoPointConfig?.banners || [])).map(slide => (
                                        <div key={slide.id} className="bg-off-white rounded-xl shadow-sm border border-slate-200 overflow-hidden group">
                                            <div className="aspect-video bg-slate-100 relative">
                                                {slide.mediaType === 'video' && slide.videoUrl ? (
                                                    <video src={slide.videoUrl} poster={slide.imageUrl || undefined} className="w-full h-full object-cover" muted loop playsInline />
                                                ) : (
                                                    <img src={slide.imageUrl} className="w-full h-full object-cover" />
                                                )}
                                                {slide.mediaType === 'video' && (
                                                    <span className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-black/70 text-white text-[10px] font-bold uppercase tracking-wider rounded">
                                                        <Film className="w-3 h-3" /> Video
                                                    </span>
                                                )}
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <button onClick={() => { setEditingSlide(slide); setIsSlideModalOpen(true); }} className="p-2 bg-white text-black rounded hover:bg-slate-200"><Edit2 className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDeleteSlide(slide.id)} className="p-2 bg-red-600 text-white rounded hover:bg-red-700"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                            <div className="p-4">
                                                <h4 className="font-bold text-sm uppercase">{slide.title || slide.titlePrefix} <span className="text-slate-400">{slide.titleHighlight}</span></h4>
                                                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{slide.subtitle || slide.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {(!config.banner?.slides || config.banner.slides.length === 0) && (
                                        <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                            No hay slides configurados.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {configSubTab === 'MUSICA' && (
                            <div className="space-y-4 md:space-y-6">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                    <div>
                                        <h3 className="text-base md:text-xl font-bold uppercase">Origen Música</h3>
                                        <p className="text-[11px] text-neutral-500 mt-1">
                                            Mini-banner debajo de "Próximos eventos" en el Home. 1920×600. El link de cada slide nunca se muestra — solo se usa al clickear.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => { setEditingMusicaSlide({ mediaType: 'image', mediaUrl: '', targetUrl: '' }); setIsMusicaModalOpen(true); }}
                                        className="px-4 md:px-6 py-2 bg-black text-white text-[10px] md:text-xs font-bold uppercase rounded-lg hover:bg-slate-800 flex items-center gap-2 whitespace-nowrap"
                                    >
                                        <Plus className="w-3 md:w-4 h-3 md:h-4" /> Agregar
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                                    {musicaSlides.map(slide => (
                                        <div key={slide.id} className="bg-off-white rounded-xl shadow-sm border border-slate-200 overflow-hidden group">
                                            <div className="aspect-[1920/600] bg-slate-100 relative">
                                                {slide.mediaType === 'video' && slide.videoUrl ? (
                                                    <video src={slide.videoUrl} poster={slide.mediaUrl || undefined} className="w-full h-full object-cover" muted loop playsInline />
                                                ) : (
                                                    <img src={slide.mediaUrl} className="w-full h-full object-cover" />
                                                )}
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <button onClick={() => { setEditingMusicaSlide(slide); setIsMusicaModalOpen(true); }} className="p-2 bg-white text-black rounded hover:bg-slate-200"><Edit2 className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDeleteMusicaSlide(slide.id)} className="p-2 bg-red-600 text-white rounded hover:bg-red-700"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                            <div className="p-4">
                                                <h4 className="font-bold text-sm uppercase truncate">{slide.title || '(Sin título)'}</h4>
                                                <p className="text-[11px] text-slate-400 mt-1 truncate">{slide.targetUrl}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {musicaSlides.length === 0 && (
                                        <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                            No hay slides configurados.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {configSubTab === 'FOOTER' && (
                            <div className="max-w-4xl space-y-8 animate-fadeIn">
                                <div className="bg-off-white p-8 rounded-2xl shadow-lg border border-slate-200">
                                    <h3 className="text-xl font-bold uppercase mb-6 flex items-center gap-2"><Share2 className="w-5 h-5" /> Redes Sociales & Pie de Página</h3>
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
                                        <button onClick={handleSaveFooterLinks} className="px-8 py-3 bg-slate-900 text-white font-medium uppercase text-xs tracking-widest rounded-lg hover:bg-slate-800 flex items-center gap-2">
                                            <Save className="w-4 h-4" /> Guardar Enlaces
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
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

                            {/* Selector de medio. El video no reemplaza a la imagen:
                                la imagen sigue haciendo de poster mientras el video
                                carga, si el navegador bloquea el autoplay o si el
                                usuario tiene activado "reducir movimiento". */}
                            <div>
                                <label className="text-xs font-bold uppercase text-neutral-500 mb-2 block">Tipo de Medio</label>
                                <div className="flex gap-2">
                                    {([['image', 'Imagen'], ['video', 'Video']] as const).map(([value, label]) => {
                                        const isSelected = (editingSlide.mediaType || 'image') === value;
                                        return (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => setEditingSlide({ ...editingSlide, mediaType: value })}
                                                className={`px-5 py-2.5 text-xs font-bold uppercase border-2 transition-all ${isSelected
                                                    ? 'bg-black text-white border-black'
                                                    : 'bg-white text-neutral-500 border-slate-200 hover:border-black hover:text-black'
                                                    }`}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase text-neutral-500 mb-2 block">
                                    {editingSlide.mediaType === 'video' ? 'Imagen de Respaldo (Poster) — opcional' : 'Imagen del Slide'}
                                </label>
                                {editingSlide.mediaType === 'video' && (
                                    <p className="text-[11px] text-neutral-500 mb-2">
                                        Se ve mientras carga el video y en dispositivos que no lo reproducen. Si no subís nada, el fallback es pantalla negra.
                                    </p>
                                )}
                                <ImageUpload
                                    currentImage={editingSlide.imageUrl || ''}
                                    folder="banners"
                                    onImageUpload={(url) => setEditingSlide({ ...editingSlide, imageUrl: url })}
                                    aspectRatio="wide"
                                />
                            </div>

                            {editingSlide.mediaType === 'video' && (
                                <div>
                                    <label className="text-xs font-bold uppercase text-neutral-500 mb-2 block">Video del Slide</label>
                                    <VideoUpload
                                        currentVideo={editingSlide.videoUrl || ''}
                                        folder="banners"
                                        onVideoUpload={(url) => setEditingSlide({ ...editingSlide, videoUrl: url })}
                                    />
                                    <p className="text-[11px] text-neutral-500 mt-2">
                                        Se reproduce solo, sin sonido y en bucle. El visitante no puede pausarlo ni controlarlo.
                                    </p>
                                </div>
                            )}

                            {/* ENCUADRE — el archivo casi nunca tiene la proporción del
                                banner, así que sobra imagen y el navegador recortaría por
                                el centro. Acá se elige qué parte sobrevive. */}
                            <div>
                                <label className="text-xs font-bold uppercase text-neutral-500 mb-2 block">Encuadre</label>
                                <EncuadreMedia
                                    mediaType={editingSlide.mediaType}
                                    imageUrl={editingSlide.imageUrl}
                                    videoUrl={editingSlide.videoUrl}
                                    frameWidth={config.banner?.frameWidth || 1920}
                                    frameHeight={config.banner?.frameHeight || 720}
                                    value={{
                                        focalX: editingSlide.focalX ?? 50,
                                        focalY: editingSlide.focalY ?? 50,
                                        zoom: editingSlide.zoom ?? 1
                                    }}
                                    onChange={(frame) => setEditingSlide({ ...editingSlide, ...frame })}
                                />
                            </div>

                            <div><label className="text-xs font-bold uppercase text-neutral-500 mb-1 block">Etiqueta Superior</label><input type="text" value={editingSlide.eyebrow || ''} onChange={e => setEditingSlide({ ...editingSlide, eyebrow: e.target.value })} className="w-full p-3 border border-slate-200 text-sm font-bold uppercase focus:shadow-md outline-none" placeholder="¡Qué bueno que estés en casa!" /></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold uppercase text-neutral-500 mb-1 block">Texto Principal</label><input type="text" value={editingSlide.titlePrefix || ''} onChange={e => setEditingSlide({ ...editingSlide, titlePrefix: e.target.value })} className="w-full p-3 border border-slate-200 text-sm font-bold uppercase focus:shadow-md outline-none" placeholder="Ej: PLATAFORMA" /></div>
                                <div><label className="text-xs font-bold uppercase text-neutral-500 mb-1 block">Texto del Medio (Destacado)</label><input type="text" value={editingSlide.titleHighlight || ''} onChange={e => setEditingSlide({ ...editingSlide, titleHighlight: e.target.value })} className="w-full p-3 border border-slate-200 text-sm font-bold uppercase focus:shadow-md outline-none" placeholder="Ej: ORIGEN" /></div>
                            </div>
                            <div><label className="text-xs font-bold uppercase text-neutral-500 mb-1 block">Descripción (Subtítulo)</label><textarea value={editingSlide.description || ''} onChange={e => setEditingSlide({ ...editingSlide, description: e.target.value })} className="w-full p-3 border border-slate-200 text-sm font-medium h-24 focus:shadow-md outline-none resize-none" placeholder="Breve descripción..." /></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold uppercase text-neutral-500 mb-1 block">Texto Botón (CTA)</label><input type="text" value={editingSlide.buttonText || ''} onChange={e => setEditingSlide({ ...editingSlide, buttonText: e.target.value })} className="w-full p-3 border border-slate-200 text-sm font-bold uppercase focus:shadow-md outline-none" placeholder="Ej: VER MÓDULOS" /></div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-neutral-500 mb-1 block">Destino del Botón</label>
                                    <input type="text" value={editingSlide.buttonLink || ''} onChange={e => setEditingSlide({ ...editingSlide, buttonLink: e.target.value })} className="w-full p-3 border border-slate-200 text-sm font-medium focus:shadow-md outline-none" placeholder="/eventos o https://..." />
                                    {editingSlide.buttonText && !editingSlide.buttonLink && (
                                        <p className="text-[11px] text-amber-700 mt-1.5 font-semibold">
                                            Sin destino el botón no se muestra.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="pt-4 border-t-2 border-black flex justify-end gap-3 bg-white">
                                <button onClick={() => { setIsSlideModalOpen(false); setEditingSlide(null); }} className="px-6 py-3 text-xs font-bold uppercase border border-slate-200 hover:bg-neutral-100">Cancelar</button>
                                <button onClick={handleSaveSlide} className="px-6 py-3 bg-black text-white text-xs font-bold uppercase border border-slate-200 shadow-[3px_3px_0px_0px_rgba(100,100,100,1)] hover:shadow-[5px_5px_0px_0px_rgba(100,100,100,1)] hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all">Guardar Slide</button>
                            </div>
                        </div>
                    </NeoModal>
                )}

                {/* Edit "Origen Música" Slide Modal — tabla dedicada,
                    independiente del modal de BANNERS de arriba */}
                {isMusicaModalOpen && editingMusicaSlide && (
                    <NeoModal
                        isOpen={isMusicaModalOpen}
                        onClose={() => { setIsMusicaModalOpen(false); setEditingMusicaSlide(null); }}
                        title={editingMusicaSlide.id ? 'Editar Slide Música' : 'Nuevo Slide Música'}
                    >
                        <div className="flex flex-col gap-6">
                            <div>
                                <label className="text-xs font-bold uppercase text-neutral-500 mb-2 block">Tipo de Medio</label>
                                <div className="flex gap-2">
                                    {([['image', 'Imagen'], ['video', 'Video']] as const).map(([value, label]) => {
                                        const isSelected = (editingMusicaSlide.mediaType || 'image') === value;
                                        return (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => setEditingMusicaSlide({ ...editingMusicaSlide, mediaType: value })}
                                                className={`px-5 py-2.5 text-xs font-bold uppercase border-2 transition-all ${isSelected
                                                    ? 'bg-black text-white border-black'
                                                    : 'bg-white text-neutral-500 border-slate-200 hover:border-black hover:text-black'
                                                    }`}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase text-neutral-500 mb-2 block">
                                    {editingMusicaSlide.mediaType === 'video' ? 'Portada (opcional)' : 'Imagen'}
                                </label>
                                {editingMusicaSlide.mediaType === 'video' && (
                                    <p className="text-[11px] text-neutral-500 mb-2">
                                        Se ve mientras carga el video. Si no subís nada, el fallback es pantalla negra.
                                    </p>
                                )}
                                <ImageUpload
                                    currentImage={editingMusicaSlide.mediaUrl || ''}
                                    folder="musica-banner"
                                    onImageUpload={(url) => setEditingMusicaSlide({ ...editingMusicaSlide, mediaUrl: url })}
                                    aspectRatio="wide"
                                />
                            </div>

                            {editingMusicaSlide.mediaType === 'video' && (
                                <div>
                                    <label className="text-xs font-bold uppercase text-neutral-500 mb-2 block">Video</label>
                                    <VideoUpload
                                        currentVideo={editingMusicaSlide.videoUrl || ''}
                                        folder="musica-banner"
                                        onVideoUpload={(url) => setEditingMusicaSlide({ ...editingMusicaSlide, videoUrl: url })}
                                    />
                                </div>
                            )}

                            {/* 1920×600 fijo — medida pedida por Ignacio para este
                                banner puntual, a diferencia del banner principal
                                (config.banner.frameWidth/frameHeight, configurable). */}
                            <div>
                                <label className="text-xs font-bold uppercase text-neutral-500 mb-2 block">Encuadre</label>
                                <EncuadreMedia
                                    mediaType={editingMusicaSlide.mediaType || 'image'}
                                    imageUrl={editingMusicaSlide.mediaUrl}
                                    videoUrl={editingMusicaSlide.videoUrl}
                                    frameWidth={1920}
                                    frameHeight={600}
                                    value={{
                                        focalX: editingMusicaSlide.focalX ?? 50,
                                        focalY: editingMusicaSlide.focalY ?? 50,
                                        zoom: editingMusicaSlide.zoom ?? 1
                                    }}
                                    onChange={(frame) => setEditingMusicaSlide({ ...editingMusicaSlide, ...frame })}
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase text-neutral-500 mb-1 block">Título</label>
                                <input
                                    type="text"
                                    value={editingMusicaSlide.title || ''}
                                    onChange={e => setEditingMusicaSlide({ ...editingMusicaSlide, title: e.target.value })}
                                    className="w-full p-3 border border-slate-200 text-sm font-bold focus:shadow-md outline-none"
                                    placeholder="Ej: Nueva canción — Título"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase text-neutral-500 mb-1 block">Link de destino</label>
                                <input
                                    type="text"
                                    value={editingMusicaSlide.targetUrl || ''}
                                    onChange={e => setEditingMusicaSlide({ ...editingMusicaSlide, targetUrl: e.target.value })}
                                    className="w-full p-3 border border-slate-200 text-sm font-medium focus:shadow-md outline-none"
                                    placeholder="https://youtube.com/... o https://open.spotify.com/..."
                                />
                                <p className="text-[11px] text-neutral-500 mt-1.5">
                                    Nunca se muestra públicamente — se abre en una pestaña nueva al clickear el slide.
                                </p>
                            </div>

                            <div className="pt-4 border-t-2 border-black flex justify-end gap-3 bg-white">
                                <button onClick={() => { setIsMusicaModalOpen(false); setEditingMusicaSlide(null); }} className="px-6 py-3 text-xs font-bold uppercase border border-slate-200 hover:bg-neutral-100">Cancelar</button>
                                <button
                                    onClick={handleSaveMusicaSlide}
                                    disabled={savingMusica || !editingMusicaSlide.targetUrl || ((editingMusicaSlide.mediaType || 'image') !== 'video' && !editingMusicaSlide.mediaUrl)}
                                    className="px-6 py-3 bg-black text-white text-xs font-bold uppercase border border-slate-200 shadow-[3px_3px_0px_0px_rgba(100,100,100,1)] hover:shadow-[5px_5px_0px_0px_rgba(100,100,100,1)] hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-[3px_3px_0px_0px_rgba(100,100,100,1)] flex items-center gap-2"
                                >
                                    {savingMusica ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Guardar Slide
                                </button>
                            </div>
                        </div>
                    </NeoModal>
                )}

            </div>
        </div>
    );
};

export default Admin;