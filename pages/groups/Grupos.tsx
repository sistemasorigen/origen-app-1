// ... imports
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../../services/dbService';
import { supabaseService, insertGroupDirect, updateGroupDirect, deleteGroupDirect, toggleGroupCapacityLock, toggleGroupVisibility } from '../../services/supabaseService';
import { hasRole } from '../../services/authUtils';
import { User, Group, GroupCategory, GroupTag, AppConfig, UserRole, BannerSlide, SystemNotification, GroupRegistration, SeasonSettings, DEFAULT_SEASON_SETTINGS } from '../../types';
import { Search, Calendar, MapPin, Users, X, ArrowRight, ArrowUp, Bell, Edit2, Trash2, Save, Image as ImageIcon, Phone, Mail, Plus, Info, Loader2, Tag, Layers, Check, Filter, SlidersHorizontal, HeartHandshake, Heart, CheckCircle, Eye, ClipboardCheck, UserPlus, RotateCcw, MailMinus, BarChart3, MoreVertical, Menu, Shield, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import HeroCarousel, { HeroSlideData } from '../../components/ui/CarruselHero';
import ImageUpload from '../../components/media/SubidaImagen';
import GroupCard from '../../components/GCX/TarjetaGrupo';
import JoinGroupModal from '../../components/GCX/ModalUnirseGrupo';
import AdminGroupReviewModal from '../../components/admin/ModalRevisionGrupoAdmin';
import CreateGroupModal from '../../components/GCX/ModalCrearGrupo';
import AdminCreateGroupModal from '../../components/GCX/ModalCrearGrupoAdmin';
import AdminAddMemberModal from '../../components/GCX/ModalAgregarMiembroAdmin';
import ApplicantsModal from '../../components/GCX/ModalSolicitantes';
import NeoModal from '../../components/ui/NeoModal';
import AdminDropoutInbox from '../../components/GCX/BandejaBajasAdmin';
import HostsManagementPanel from '../../components/GCX/PanelGestionAnfitriones';
import CoordinatorsManagementPanel from '../../components/GCX/PanelGestionCoordinadores';
import { useTutorial } from '../../src/hooks/useTutorial';
import TutorialInvitation from '../../components/onboarding/InvitacionTutorial';
import TutorialController from '../../components/onboarding/ControladorTutorial';
import { tours } from '../../src/config/tours';
import GroupsAdminToolbar from '../../components/GCX/BarraHerramientasGruposAdmin';
import GroupsAdminList from '../../components/GCX/ListaGruposAdmin';




interface GroupsProps {
    currentUser: User | null;
    onLoginRequest?: () => void;
}

// --- UTILITIES ---
const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
};

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

// Helper to generate UUID with fallback for browsers that don't support crypto.randomUUID
const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older browsers or non-secure contexts (HTTP localhost)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// Helper to get season from date
const getSeasonFromDate = (dateStr?: string): 'S1' | 'S2' | 'S3' | null => {
    if (!dateStr) return null;
    // parseLocalDate evita el bug de timezone: new Date("YYYY-MM-DD") parsea UTC
    // medianoche, que en zonas UTC-N retrocede al día anterior y rompe el rango.
    const date = parseLocalDate(dateStr);
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const md = m * 100 + d;

    if (md >= 323 && md <= 531) return 'S1';
    if (md >= 629 && md <= 823) return 'S2';
    if (md >= 1005 && md <= 1129) return 'S3';

    return null;
};

// --- COMPONENTS ---

// --- NAVBAR PROPS INTERFACE ---
// --- NAVBAR PROPS INTERFACE ---
interface GroupsNavbarProps {
    view: 'public' | 'admin';
    setView: (v: 'public' | 'admin') => void;
    canAccessAdmin: boolean;
    isGroupLeader: boolean;
    isSuperAdmin: boolean;
    // Admin Navigation Props
    activeSubTab: 'GROUPS' | 'CATEGORIES' | 'TAGS' | 'CONFIG' | 'HOSTS' | 'COORDINATORS' | 'SEASONS';
    setSubTab: (tab: 'GROUPS' | 'CATEGORIES' | 'TAGS' | 'CONFIG' | 'HOSTS' | 'COORDINATORS' | 'SEASONS') => void;
    canSeeConfig: boolean;
}

const GroupsNavbar: React.FC<GroupsNavbarProps> = ({
    view,
    setView,
    canAccessAdmin,
    isGroupLeader,
    isSuperAdmin,
    activeSubTab,
    setSubTab,
    canSeeConfig
}) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const navigate = useNavigate();

    // Tab labels for display
    const tabLabels: Record<string, string> = {
        'GROUPS': 'Gestión de Grupos',
        'CATEGORIES': 'Categorías',
        'TAGS': 'Etiquetas',
        'CONFIG': 'Config',
        'HOSTS': 'Anfitriones',
        'COORDINATORS': 'Coordinadores',
        'SEASONS': 'Temporadas'
    };

    const handleTabClick = (tab: 'GROUPS' | 'CATEGORIES' | 'TAGS' | 'CONFIG' | 'HOSTS' | 'COORDINATORS' | 'SEASONS') => {
        setSubTab(tab);
        setIsMenuOpen(false);
    };

    return (
        <nav className="bg-white border-b-4 border-black h-16 md:h-20">
            <div className="w-full px-4 md:px-6 lg:px-12 h-full flex items-center justify-between relative max-w-[1920px] mx-auto">

                {/* LEFT SECTION: Hamburger Menu (Admin Only) */}
                <div className="flex-1 flex justify-start items-center relative">
                    {view === 'admin' && canAccessAdmin && (
                        <div className="relative">
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="p-3 text-black hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2"
                                aria-label="Menú de navegación"
                            >
                                <Menu className="w-6 h-6" />
                                <span className="hidden sm:inline text-xs font-bold uppercase tracking-wide">
                                    {tabLabels[activeSubTab]}
                                </span>
                            </button>

                            {/* Admin Navigation Dropdown - Antigravity Style */}
                            {isMenuOpen && (
                                <>
                                    {/* Backdrop */}
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setIsMenuOpen(false)}
                                    />
                                    {/* Menu Panel */}
                                    <div className="absolute top-full left-0 mt-2 z-50 w-64 bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-2 flex flex-col gap-1">
                                        {/* GRUPOS - Always visible */}
                                        <button
                                            onClick={() => handleTabClick('GROUPS')}
                                            className={`flex items-center gap-3 p-4 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeSubTab === 'GROUPS'
                                                ? 'bg-black text-white'
                                                : 'bg-slate-50 text-black hover:bg-slate-100 border border-slate-200'
                                                }`}
                                        >
                                            <Users className="w-5 h-5 shrink-0" />
                                            GESTIÓN DE GRUPOS
                                        </button>

                                        <button
                                            onClick={() => navigate('/reportes')}
                                            className="flex items-center gap-3 p-4 rounded-lg text-xs font-black uppercase tracking-wider transition-all bg-slate-50 text-black hover:bg-slate-100 border border-slate-200"
                                        >
                                            <BarChart3 className="w-5 h-5 shrink-0" />
                                            REPORTES
                                        </button>

                                        {/* Config-only tabs */}
                                        {canSeeConfig && (
                                            <>
                                                <button
                                                    onClick={() => handleTabClick('HOSTS')}
                                                    className={`flex items-center gap-3 p-4 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeSubTab === 'HOSTS'
                                                        ? 'bg-black text-white'
                                                        : 'bg-slate-50 text-black hover:bg-slate-100 border border-slate-200'
                                                        }`}
                                                >
                                                    <Shield className="w-5 h-5 shrink-0" />
                                                    ANFITRIONES
                                                </button>
                                                <button
                                                    onClick={() => handleTabClick('CATEGORIES')}
                                                    className={`flex items-center gap-3 p-4 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeSubTab === 'CATEGORIES'
                                                        ? 'bg-black text-white'
                                                        : 'bg-slate-50 text-black hover:bg-slate-100 border border-slate-200'
                                                        }`}
                                                >
                                                    <Layers className="w-5 h-5 shrink-0" />
                                                    CATEGORÍAS
                                                </button>
                                                <button
                                                    onClick={() => handleTabClick('COORDINATORS')}
                                                    className={`flex items-center gap-3 p-4 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeSubTab === 'COORDINATORS'
                                                        ? 'bg-black text-white'
                                                        : 'bg-slate-50 text-black hover:bg-slate-100 border border-slate-200'
                                                        }`}
                                                >
                                                    <Users className="w-5 h-5 shrink-0" />
                                                    COORDINADORES
                                                </button>
                                                <button
                                                    onClick={() => handleTabClick('TAGS')}
                                                    className={`flex items-center gap-3 p-4 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeSubTab === 'TAGS'
                                                        ? 'bg-black text-white'
                                                        : 'bg-slate-50 text-black hover:bg-slate-100 border border-slate-200'
                                                        }`}
                                                >
                                                    <Tag className="w-5 h-5 shrink-0" />
                                                    ETIQUETAS
                                                </button>
                                                <button
                                                    onClick={() => handleTabClick('CONFIG')}
                                                    className={`flex items-center gap-3 p-4 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeSubTab === 'CONFIG'
                                                        ? 'bg-black text-white'
                                                        : 'bg-slate-50 text-black hover:bg-slate-100 border border-slate-200'
                                                        }`}
                                                >
                                                    <ImageIcon className="w-5 h-5 shrink-0" />
                                                    CONFIG
                                                </button>
                                                <button
                                                    onClick={() => handleTabClick('SEASONS')}
                                                    className={`flex items-center gap-3 p-4 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeSubTab === 'SEASONS'
                                                        ? 'bg-black text-white'
                                                        : 'bg-slate-50 text-black hover:bg-slate-100 border border-slate-200'
                                                        }`}
                                                >
                                                    <Calendar className="w-5 h-5 shrink-0" />
                                                    TEMPORADAS
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>


                {/* RIGHT SECTION: Actions (Admin/Exit) */}
                <div className="flex-1 flex justify-end items-center gap-2 md:gap-4 pointer-events-auto">
                    {view === 'admin' && canAccessAdmin && (
                        <button
                            onClick={() => setView('public')}
                            className="flex items-center gap-2 px-4 md:px-5 py-2 text-xs font-bold uppercase tracking-wide transition-all whitespace-nowrap border-2 border-black rounded-lg bg-black text-white hover:bg-white hover:text-black"
                        >
                            SALIR
                        </button>
                    )}
                </div>
            </div>
        </nav>
    );
};

// --- imported GroupCard will be used ---

const Groups: React.FC<GroupsProps> = ({ currentUser, onLoginRequest }) => {
    // --- NAVIGATION ---
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // --- TUTORIAL INTEGRATION ---
    const {
        isActive,
        showInvitation,
        startTutorial,
        completeTutorial,
        declineTemporary,
        dismissTutorial
    } = useTutorial('groups');

    // --- HOST TOUR INTEGRATION ---


    // --- MAIN STATE ---
    const [view, setView] = useState<'public' | 'admin'>('public');
    const [adminSubTab, setAdminSubTab] = useState<'GROUPS' | 'CATEGORIES' | 'TAGS' | 'CONFIG' | 'HOSTS' | 'COORDINATORS' | 'SEASONS'>('GROUPS');

    // Redirect de links viejos: /gcx?tab=X ahora
    // vive en /admingcx/*. Cualquier link guardado
    // (favoritos, WhatsApp) redirige automáticamente
    // a la ruta nueva correspondiente.
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (!tab) return;

        const TAB_TO_ADMINGCX_ROUTE: Record<string, string> = {
            GROUPS: '/admingcx/gestion-de-grupos',
            HOSTS: '/admingcx/gestion-de-anfitriones',
            COORDINATORS: '/admingcx/gestion-de-coordinadores',
            CATEGORIES: '/admingcx/categorias',
            TAGS: '/admingcx/etiquetas',
            CONFIG: '/admingcx/configuracion',
            SEASONS: '/admingcx/temporadas',
        };

        const nuevaRuta = TAB_TO_ADMINGCX_ROUTE[tab];
        if (nuevaRuta) {
            navigate(nuevaRuta, { replace: true });
        }
    }, [searchParams, navigate]);


    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [groups, setGroups] = useState<Group[]>([]);
    const [categories, setCategories] = useState<GroupCategory[]>([]);
    const [tags, setTags] = useState<GroupTag[]>([]);
    const [config, setConfig] = useState<AppConfig>(db.getAppConfig());
    const [editingSeasons, setEditingSeasons] = useState<SeasonSettings | null>(null);
    const [isSavingSeasons, setIsSavingSeasons] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [selectedTag, setSelectedTag] = useState<string>('ALL');
    const [isTagFilterOpen, setIsTagFilterOpen] = useState(false); // Tag filter dropdown
    const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false); // Category filter dropdown

    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
    const [isInquiryModalOpen, setInquiryModalOpen] = useState(false);
    const [restrictionModal, setRestrictionModal] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ''});
    // inquiryForm moved to JoinGroupModal
    const [notification, setNotification] = useState<{ show: boolean, message: string, type: 'success' | 'error' | 'info' }>({ show: false, message: '', type: 'success' });

    // --- LEADER POSTULATION STATE ---
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successModalMessage, setSuccessModalMessage] = useState('');
    const [userApplicationStatus, setUserApplicationStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | null>(null);
    const [isPostulationModalOpen, setIsPostulationModalOpen] = useState(false);
    const [postulationForm, setPostulationForm] = useState({
        firstName: '', lastName: '', email: '', phone: '',
        completedLeaderCourse: false,
        completedHicisteCrecer: false,
        completedVolunteerTraining: false,
        attendsOrigen: false
    });

    // --- ADMIN STATES ---
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<Partial<Group>>({});
    const [editingSlide, setEditingSlide] = useState<BannerSlide | null>(null);
    const [isSlideModalOpen, setIsSlideModalOpen] = useState(false);

    // --- CRUD STATES FOR CATEGORIES & TAGS ---
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryColor, setNewCategoryColor] = useState('#000000');
    const [editingCategoryName, setEditingCategoryName] = useState('');
    const [editingCategoryColor, setEditingCategoryColor] = useState('');

    const [editingTagId, setEditingTagId] = useState<string | null>(null);
    const [newTagName, setNewTagName] = useState('');

    // State for viewing group registrations
    const [viewingGroupRegistrations, setViewingGroupRegistrations] = useState<Group | null>(null);
    const [editingTagName, setEditingTagName] = useState('');

    // State for mobile kebab menu
    const [openMenuGroupId, setOpenMenuGroupId] = useState<string | null>(null);
    const [userRegistrations, setUserRegistrations] = useState<GroupRegistration[]>([]); // New State

    // State for reviewing groups (approval workflow)
    const [reviewingGroup, setReviewingGroup] = useState<Group | null>(null);
    const [isReviewLoading, setIsReviewLoading] = useState(false);
    const [adminGroups, setAdminGroups] = useState<Group[]>([]); // All groups for admin view
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false); // Admin Create Group Modal
    // Estado para el modal de re-apertura del admin
    const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
    const [groupToReopen, setGroupToReopen] = useState<Group | null>(null);
    const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false); // Admin Add Member Modal
    const [isDropoutInboxOpen, setIsDropoutInboxOpen] = useState(false); // Admin Dropout Inbox
    const [pendingDropoutCount, setPendingDropoutCount] = useState(0); // Badge count for dropout requests

    // --- HOST SEARCH STATE FOR EDIT MODAL ---
    const [editPotentialHosts, setEditPotentialHosts] = useState<User[]>([]);
    const [editHostSearchTerm, setEditHostSearchTerm] = useState('');
    const [isEditHostSelectOpen, setIsEditHostSelectOpen] = useState(false);

    // --- CO-HOST SEARCH STATE FOR EDIT MODAL ---
    const [editPotentialCoHosts, setEditPotentialCoHosts] = useState<User[]>([]);
    const [editCoHostSearchTerm, setEditCoHostSearchTerm] = useState('');
    const [isEditCoHostSelectOpen, setIsEditCoHostSelectOpen] = useState(false);

    // Search Hosts Effect for Edit Modal
    useEffect(() => {
        if (!isEditModalOpen) return;
        const timer = setTimeout(async () => {
            const results = await supabaseService.searchPotentialHosts(editHostSearchTerm);
            setEditPotentialHosts(results);
        }, 300);
        return () => clearTimeout(timer);
    }, [editHostSearchTerm, isEditModalOpen]);

    // Search Co-Hosts Effect for Edit Modal
    useEffect(() => {
        if (!isEditModalOpen) return;
        const timer = setTimeout(async () => {
            const results = await supabaseService.searchPotentialHosts(editCoHostSearchTerm);
            // Filter out the main host from co-host options
            setEditPotentialCoHosts(results.filter(u => u.id !== (editingGroup as any).host_id));
        }, 300);
        return () => clearTimeout(timer);
    }, [editCoHostSearchTerm, isEditModalOpen, editingGroup]);

    // Pre-fill Search Term when Edit Modal opens
    useEffect(() => {
        if (isEditModalOpen && editingGroup.leaderName && !editHostSearchTerm) {
            setEditHostSearchTerm(`${editingGroup.leaderName} ${editingGroup.leaderSurname || ''}`.trim());
        }
        // Pre-fill Co-Host search term
        if (isEditModalOpen && editingGroup.coHostFirstName && !editCoHostSearchTerm) {
            setEditCoHostSearchTerm(`${editingGroup.coHostFirstName} ${editingGroup.coHostLastName || ''}`.trim());
        }
    }, [isEditModalOpen]);

    // State for existing leader applications (for duplicate checking)
    const [existingApplications, setExistingApplications] = useState<{ email: string, phone: string, firstName: string, lastName: string }[]>([]);

    // Deep link: abrir grupo específico por ?groupId=
    useEffect(() => {
        const targetId = searchParams.get('groupId');
        if (!targetId || groups.length === 0) return;

        const target = groups.find(g => g.id === targetId);
        if (!target) return;

        // Si no hay sesión: redirigir al login
        // conservando el groupId para volver acá
        // después de autenticarse.
        if (!currentUser) {
            if (onLoginRequest) {
                onLoginRequest();
            }
            return;
        }

        // --- VALIDATIONS ---
        let restriction = null;

        // 1. Gender Validation
        const targetGender = target.targetGender?.toLowerCase() || '';
        const userGender = currentUser?.gender?.toLowerCase() || '';
        const isMixto = !targetGender || targetGender.includes('mixto') || targetGender.includes('no especificar') || targetGender === '';
        
        let genderCompatible = true;
        if (!isMixto && userGender) {
            const isMaleGroup = targetGender.includes('hombre');
            const isFemaleGroup = targetGender.includes('mujer');
            const isUserMale = userGender.includes('hombre') || userGender.includes('masculino');
            const isUserFemale = userGender.includes('mujer') || userGender.includes('femenino');
            
            if (isMaleGroup && !isUserMale) genderCompatible = false;
            if (isFemaleGroup && !isUserFemale) genderCompatible = false;
        }

        if (!genderCompatible) {
            const groupType = target.targetGender?.includes('Hombre') ? 'sólo para hombres' : 'sólo para mujeres';
            restriction = `No puedes inscribirte porque este grupo es ${groupType}.`;
        }

        // 2. Age Validation
        if (!restriction && currentUser.age) {
            const minAge = target.minAge || 0;
            const maxAge = target.maxAge || 100;
            if (currentUser.age < minAge) {
                restriction = `No puedes inscribirte porque debes tener al menos ${minAge} años.`;
            } else if (currentUser.age > maxAge) {
                restriction = `No puedes inscribirte porque la edad máxima es ${maxAge} años.`;
            }
        }

        setTimeout(() => {
            const el = document.getElementById(`group-card-${targetId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('ring-4', 'ring-black', 'ring-offset-2');
                setTimeout(() => {
                    el.classList.remove('ring-4', 'ring-black', 'ring-offset-2');
                }, 2000);
            }
            setSelectedGroup(target);
            
            // Clean up the URL correctly using react-router-dom to prevent re-triggering
            setSearchParams(prev => {
                prev.delete('groupId');
                return prev;
            }, { replace: true });

            if (restriction) {
                setRestrictionModal({ isOpen: true, message: restriction });
            } else {
                setInquiryModalOpen(true);
            }
        }, 300);
    }, [searchParams, groups, currentUser]);

    // Helper to check if a group is finished
    const isGroupFinished = (group: Group) => {
        if (!group.endDate) return false;
        const today = new Date().toISOString().split('T')[0];
        return group.endDate < today;
    };


    // Admin Status Filter
    const [adminStatusFilter, setAdminStatusFilter] = useState<'ALL' | 'APPROVED' | 'FINALIZED' | 'PENDING'>('ALL');
    const [adminFilterMode, setAdminFilterMode] = useState<'MANUAL' | 'SEASONS'>('MANUAL');
    const [adminSeasonFilter, setAdminSeasonFilter] = useState<'S1' | 'S2' | 'S3'>('S1');
    const [adminSearchTerm, setAdminSearchTerm] = useState('');

    const filteredAdminGroups = useMemo(() => {
        let filtered = adminGroups;

        // 1. Filter by Status or Season
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
            // SEASONS MODE — filtrar por startDate dentro del rango de la temporada.
            // Grupos sin startDate no tienen temporada asignable y se excluyen.
            filtered = filtered.filter(g => {
                if (!g.startDate) return false;
                const season = getSeasonFromDate(g.startDate);
                return season === adminSeasonFilter;
            });
        }

        // 2. Filter by Search Term
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


    // Fetch existing applications when postulation modal opens AND auto-fill form with user data
    useEffect(() => {
        const fetchApplications = async () => {
            if (isPostulationModalOpen) {
                const apps = await supabaseService.getLeaderApplications();
                setExistingApplications(apps.filter(a => a.status === 'PENDING').map(a => ({
                    email: a.email.toLowerCase().trim(),
                    phone: a.phone.trim(),
                    firstName: a.firstName.toLowerCase().trim(),
                    lastName: a.lastName.toLowerCase().trim()
                })));

                // Auto-fill form with current user's data
                if (currentUser) {
                    const nameParts = currentUser.name?.split(' ') || [];
                    const firstName = nameParts[0] || '';
                    const lastName = nameParts.slice(1).join(' ') || '';

                    setPostulationForm(prev => ({
                        ...prev,
                        firstName: firstName,
                        lastName: lastName,
                        email: currentUser.email || '',
                        phone: currentUser.phone || ''
                    }));
                }
            }
        };
        fetchApplications();
    }, [isPostulationModalOpen, currentUser]);

    // Check for existing application on load
    useEffect(() => {
        if (currentUser) {
            supabaseService.getUserLeaderApplication(currentUser.id, currentUser.email).then(app => {
                if (app) setUserApplicationStatus(app.status);
            });
        }
    }, [currentUser]);

    // Check for existing application on load
    useEffect(() => {
        if (currentUser) {
            supabaseService.getUserLeaderApplication(currentUser.id, currentUser.email).then(app => {
                if (app) setUserApplicationStatus(app.status);
            });
        }
    }, [currentUser]);

    // Fetch User Registrations for Join Logic
    const fetchUserRegistrations = async () => {
        if (currentUser) {
            try {
                // 1. Fetch by User ID (Main + Linked Partner)
                const regsById = await supabaseService.getUserRegistrations(currentUser.id, currentUser.email);

                // 2. Fetch by Email (Fallback for Unlinked Partner)
                // This covers cases where partner_user_id wasn't set but email matches
                let regsByEmail: GroupRegistration[] = [];
                if (currentUser.email) {
                    regsByEmail = await supabaseService.getPartnerRegistrationsByEmail(currentUser.email);
                }

                // 3. Merge results (avoid duplicates)
                const allRegs = [...regsById];
                regsByEmail.forEach(r => {
                    if (!allRegs.find(existing => existing.id === r.id)) {
                        allRegs.push(r);
                    }
                });

                setUserRegistrations(allRegs);
            } catch (err) {
                console.error("Error fetching my registrations:", err);
            }
        } else {
            setUserRegistrations([]);
        }
    };

    useEffect(() => {
        fetchUserRegistrations();
    }, [currentUser]);


    const isSuperAdmin = currentUser ? hasRole(currentUser, UserRole.SUPER_ADMIN) : false;
    const isGroupsAdmin = currentUser ? hasRole(currentUser, UserRole.ADMIN_GROUPS) : false;
    const isEncargadoGroups = currentUser ? hasRole(currentUser, UserRole.ENCARGADO_GRUPOS) : false;
    const canSeeHiddenGroups = isSuperAdmin || isGroupsAdmin || isEncargadoGroups;
    const hasGroupsPrivilege = currentUser?.linkedGroupId === 'GROUPS' || (currentUser?.volunteerRoles && currentUser.volunteerRoles.includes('GROUPS'));
    const isAnfitrion = currentUser ? (hasRole(currentUser, UserRole.ANFITRION)) : false;
    const canAccessAdmin = isSuperAdmin || isGroupsAdmin || hasGroupsPrivilege || isEncargadoGroups;
    const canSeeConfig = isSuperAdmin || isGroupsAdmin;

    // Fetch groups for public view (only approved)
    const fetchGroups = async () => {
        setIsLoading(true);
        try {
            const fetchedGroups = await supabaseService.getGroups();
            setGroups(fetchedGroups);
        } catch (error) {
            console.error("Error fetching groups:", error);
            showToast("Error cargando grupos", 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch ALL groups for admin view (pending, approved, rejected)
    const fetchAdminGroups = async () => {
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
    };

    const fetchCategoriesAndTags = async () => {
        const cats = await supabaseService.getGroupCategories();
        const tgs = await supabaseService.getGroupTags();
        setCategories(cats);
        setTags(tgs);
    };

    const getUserGroupStatus = (groupId: string): 'PENDING' | 'APPROVED' | 'REJECTED' | null => {
        // Filter registrations for this group where user is main or partner
        const groupRegs = userRegistrations.filter(r => {
            if (r.groupId !== groupId) return false;

            const isMainUser = r.userId === currentUser?.id;

            // Link by ID or Email - DUAL VISIBILITY for couples
            const isPartner = (r.partnerUserId === currentUser?.id) ||
                (currentUser?.email && r.partnerData?.email &&
                    r.partnerData.email.toLowerCase().trim() === currentUser.email.toLowerCase().trim());

            return isMainUser || isPartner;
        });

        // Priority: APPROVED > PENDING > REJECTED > null
        // DUAL VISIBILITY: Both main user AND partner see the same status
        const approved = groupRegs.find(r => r.status === 'APPROVED');
        if (approved) return 'APPROVED';

        const pending = groupRegs.find(r => r.status === 'PENDING');
        if (pending) return 'PENDING';

        // FIXED: Both main user AND partner can see REJECTED and re-apply
        // This enables couples to re-apply together after rejection
        const rejected = groupRegs.find(r => r.status === 'REJECTED');
        if (rejected) return 'REJECTED';

        return null;
    };

    useEffect(() => {
        // Fetch based on current view
        if (view === 'admin' && (isSuperAdmin || isGroupsAdmin || isEncargadoGroups)) {
            fetchAdminGroups(); // Fetch ALL groups for admin
            // Fetch pending dropout count for badge
            supabaseService.countPendingDropoutRequests().then(count => {
                setPendingDropoutCount(count);
            });
        } else {
            fetchGroups(); // Fetch only approved for public
        }
        fetchCategoriesAndTags();
        // Fetch config from Supabase (source of truth), with localStorage fallback
        supabaseService.getAppConfig().then(remoteConfig => {
            if (remoteConfig) {
                db.saveAppConfig(remoteConfig); // Sync to localStorage for offline use
                setConfig(remoteConfig);
            } else {
                setConfig(db.getAppConfig()); // Fallback to localStorage
            }
        });
    }, [view, currentUser, adminSubTab]);

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setNotification({ show: true, message, type });
        setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 3000);
    };

    // --- APPROVAL WORKFLOW HANDLERS ---
    const handleApproveGroup = async (groupId: string, note?: string) => {
        setIsReviewLoading(true);
        try {
            const success = await supabaseService.updateGroupStatus(groupId, 'approved', note);
            if (success) {
                showToast('Grupo aprobado exitosamente', 'success');
                setReviewingGroup(null);
                fetchAdminGroups(); // Refresh admin list
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
                fetchAdminGroups(); // Refresh admin list
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

    // Handle Re-opening a finished or rejected group
    const handleReopenGroup = (groupId: string) => {
        const group = adminGroups.find(g => g.id === groupId);
        if (!group) return;
        // El admin pasa por el mismo modal que el anfitrión.
        // isAdminView=true → nuevo grupo en status='approved'.
        // isReopenRequest=true → usa cloneGroupForNewSeason.
        setGroupToReopen(group);
        setIsReopenModalOpen(true);
    };



    // --- Status Badge Helper ---
    const getStatusBadge = (status?: string) => {
        switch (status) {
            case 'approved':
                return <span className="px-2 py-1 text-[10px] font-bold uppercase bg-green-100 text-green-700 rounded-full">Aprobado</span>;
            case 'rejected':
                return <span className="px-2 py-1 text-[10px] font-bold uppercase bg-red-100 text-red-700 rounded-full">Rechazado</span>;
            default:
                return <span className="px-2 py-1 text-[10px] font-bold uppercase bg-yellow-100 text-yellow-700 rounded-full animate-pulse">Pendiente</span>;
        }
    };


    // --- CATEGORY CRUD OPERATIONS ---
    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return showToast('El nombre de la categoría es obligatorio', 'error');
        const newCat: GroupCategory = {
            id: newCategoryName.trim(),
            name: newCategoryName.trim(),
            color: newCategoryColor
        };

        const success = await supabaseService.saveGroupCategory(newCat);
        if (success) {
            await fetchCategoriesAndTags();
            setNewCategoryName('');
            setNewCategoryColor('#000000');
            showToast('Categoría creada');
        } else {
            showToast('Error al crear categoría', 'error');
        }
    };

    const startEditCategory = (cat: GroupCategory) => {
        setEditingCategoryId(cat.id);
        setEditingCategoryName(cat.name);
        setEditingCategoryColor(cat.color);
    };

    const handleUpdateCategory = async (id: string) => {
        if (!editingCategoryName.trim()) return showToast('Nombre inválido', 'error');
        const cat: GroupCategory = { id, name: editingCategoryName, color: editingCategoryColor };

        const success = await supabaseService.saveGroupCategory(cat);
        if (success) {
            await fetchCategoriesAndTags();
            setEditingCategoryId(null);
            showToast('Categoría actualizada');
        } else {
            showToast('Error al actualizar categoría', 'error');
        }
    };

    const handleDeleteCategory = async (id: string) => {
        const success = await supabaseService.deleteGroupCategory(id);
        if (success) {
            await fetchCategoriesAndTags();
            showToast('Categoría eliminada');
        } else {
            showToast('Error al eliminar categoría', 'error');
        }
    };

    // --- TAG CRUD OPERATIONS ---
    const handleAddTag = async () => {
        if (!newTagName.trim()) return showToast('El nombre de la etiqueta es obligatorio', 'error');
        const newTag: GroupTag = {
            id: newTagName.toLowerCase().replace(/\s+/g, '-'),
            name: newTagName.trim()
        };

        const success = await supabaseService.saveGroupTag(newTag);
        if (success) {
            await fetchCategoriesAndTags();
            setNewTagName('');
            showToast('Etiqueta creada');
        } else {
            showToast('Error al crear etiqueta', 'error');
        }
    };

    const startEditTag = (tag: GroupTag) => {
        setEditingTagId(tag.id);
        setEditingTagName(tag.name);
    };

    const handleUpdateTag = async (id: string) => {
        if (!editingTagName.trim()) return showToast('Nombre inválido', 'error');
        const tag: GroupTag = { id, name: editingTagName };

        const success = await supabaseService.saveGroupTag(tag);
        if (success) {
            await fetchCategoriesAndTags();
            setEditingTagId(null);
            showToast('Etiqueta actualizada');
        } else {
            showToast('Error al actualizar etiqueta', 'error');
        }
    };

    const handleDeleteTag = async (id: string) => {
        const success = await supabaseService.deleteGroupTag(id);
        if (success) {
            await fetchCategoriesAndTags();
            showToast('Etiqueta eliminada');
        } else {
            showToast('Error al eliminar etiqueta', 'error');
        }
    };

    // --- DUAL FILTER LOGIC ---
    const filteredGroups = groups.filter(g => {
        const today = new Date().toISOString().split('T')[0];
        const isExpired = g.endDate && g.endDate < today; // Check if expired

        // 1. Public View: Hide expired groups
        if (view === 'public' && isExpired) return false;

        // 2. Hide groups marked as hidden, unless the user is an admin who can see them
        if (g.isHidden && !canSeeHiddenGroups) return false;

        const matchesSearch = g.name.toLowerCase().includes(searchTerm.toLowerCase()) || g.location.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'ALL' || g.categoryId === selectedCategory;
        const matchesTag = selectedTag === 'ALL' || (g.tags && g.tags.includes(selectedTag));
        return matchesSearch && matchesCategory && matchesTag;
    });

    // handleInquirySubmit removed - logic moved to JoinGroupModal

    // Mismo mecanismo de doble capa que handleLogin
    // en App.tsx: sessionStorage sobrevive el
    // redirect completo de Google (donde
    // location.state se pierde), y el state de
    // React Router sigue cubriendo el caso de
    // email/contraseña sin recarga de página.
    const redirectToLoginForGroup = (groupId: string) => {
        sessionStorage.setItem(
            'post_login_redirect',
            `/gcx?groupId=${groupId}`
        );
        navigate('/auth', {
            state: { from: { pathname: '/gcx', search: `?groupId=${groupId}` } }
        });
    };

    const handleJoinClick = (g: Group) => {
        // GUARD: Si no hay sesión, redirigir a /auth con retorno a /gcx y el groupId
        if (!currentUser) {
            redirectToLoginForGroup(g.id);
            return;
        }

        // AGE VALIDATION
        if (currentUser.age) {
            const minAge = g.minAge || 0;
            const maxAge = g.maxAge || 100;

            if (currentUser.age < minAge) {
                showToast(
                    `No puedes unirte. Debes tener al menos ${minAge} años.`,
                    'error'
                );
                return;
            }

            if (currentUser.age > maxAge) {
                showToast(
                    `No puedes unirte. La edad máxima es ${maxAge} años.`,
                    'error'
                );
                return;
            }
        }

        setSelectedGroup(g);
        setInquiryModalOpen(true);
    };

    // --- LEADER POSTULATION ---
    const handlePostulationSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!postulationForm.firstName || !postulationForm.lastName || !postulationForm.email || !postulationForm.phone) {
            showToast('Por favor completa todos los campos de contacto', 'error');
            return;
        }

        const success = await supabaseService.saveLeaderApplication({
            id: generateUUID(),
            ...postulationForm,
            applicantId: currentUser?.id, // Link if logged in
            status: 'PENDING',
            createdAt: new Date().toISOString()
        });

        if (success) {
            setIsPostulationModalOpen(false);
            setPostulationForm({
                firstName: '', lastName: '', email: '', phone: '',
                completedLeaderCourse: false,
                completedHicisteCrecer: false,
                completedVolunteerTraining: false,
                attendsOrigen: false
            });
            setSuccessModalMessage('Recibirás un aviso por email cuando seas aprobado como anfitrión.');
            setIsSuccessModalOpen(true);
        } else {
            showToast('Hubo un error al enviar tu postulación. Intenta nuevamente.', 'error');
        }
    };

    // --- GROUPS CRUD ---
    const openEditModal = (group?: Group) => {
        // Admins can edit any group, regular hosts can only edit their own
        if (isAnfitrion && !isSuperAdmin && !isGroupsAdmin && !isEncargadoGroups) {
            if (!group) return;
            if (group.id !== currentUser?.linkedGroupId) {
                showToast('Acceso denegado: Solo puedes editar tu grupo.', 'error');
                return;
            }
        }

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

            console.log('[handleSaveGroup] Saving group:', groupToSave.id, 'isEditing:', isEditing);
            console.log('[handleSaveGroup] Full editingGroup:', editingGroup);
            console.log('[handleSaveGroup] Host ID to save:', (editingGroup as any).host_id);

            let saved;
            if (isEditing) {
                // Use update for existing groups
                saved = await updateGroupDirect(groupToSave);
            } else {
                // Use insert for new groups
                saved = await insertGroupDirect(groupToSave);
            }

            if (saved && (editingGroup as any).host_id) {
                console.log('[handleSaveGroup] Linking host', (editingGroup as any).host_id, 'to group', saved.id);
                await supabaseService.linkUserToGroup((editingGroup as any).host_id, saved.id);
            }

            if (saved) {
                fetchGroups();
                fetchAdminGroups(); // Also refresh admin view
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

    const handleDeleteGroup = async (id: string) => {
        // Confirm before deleting
        if (!window.confirm('¿Estás seguro que deseas eliminar este grupo? Esta acción no se puede deshacer.')) {
            return;
        }

        const success = await deleteGroupDirect(id);
        if (success) {
            fetchGroups();
            fetchAdminGroups(); // Also refresh admin view
            showToast('Grupo eliminado');
        } else {
            showToast('Error al eliminar grupo', 'error');
        }
    };

    const handleToggleCapacityLock = async (group: Group) => {
        const nuevoEstado = !group.capacityLocked;
        const ok = await toggleGroupCapacityLock(group.id, nuevoEstado);
        if (ok) {
            fetchGroups();
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
            fetchGroups();
            fetchAdminGroups();
            showToast(nuevoEstado ? 'Grupo oculto de /gcx' : 'Grupo visible nuevamente');
        } else {
            showToast('Error al cambiar la visibilidad del grupo', 'error');
        }
    };

    const handleDeleteRegistration = async (registrationId: string, groupId: string) => {
        const success = await supabaseService.deleteGroupRegistration(registrationId, groupId);
        if (success) {
            // Update local state immediately
            if (viewingGroupRegistrations) {
                const updatedRegistrations = viewingGroupRegistrations.registrations.filter(r => r.id !== registrationId);
                setViewingGroupRegistrations({
                    ...viewingGroupRegistrations,
                    registrations: updatedRegistrations,
                    membersCount: Math.max(0, viewingGroupRegistrations.membersCount - 1)
                });
            }
            fetchGroups(); // Refresh list in background
            showToast('Inscripto eliminado');
        } else {
            showToast('Error al eliminar inscripto', 'error');
        }
    };

    const handleSaveSlide = () => {
        if (!editingSlide) return;
        const currentConfig = db.getAppConfig();
        const currentSlides = currentConfig.groupsConfig?.banners || [];
        let updatedSlides;

        if (editingSlide.id) {
            updatedSlides = currentSlides.map(s => s.id === editingSlide.id ? editingSlide : s);
        } else {
            updatedSlides = [...currentSlides, { ...editingSlide, id: generateUUID() } as BannerSlide];
        }

        const newConfig: AppConfig = {
            ...currentConfig,
            groupsConfig: {
                ...currentConfig.groupsConfig,
                banners: updatedSlides,
                activeBlurLevel: currentConfig.groupsConfig?.activeBlurLevel || 'md'
            }
        };

        db.saveAppConfig(newConfig);
        supabaseService.saveAppConfig(newConfig);

        setConfig(newConfig);
        setIsSlideModalOpen(false);
        setEditingSlide(null);
        showToast('Slide guardado');
    };

    const handleDeleteSlide = (id: string) => {
        const currentConfig = db.getAppConfig();
        const updatedSlides = (currentConfig.groupsConfig?.banners || []).filter(s => s.id !== id);
        const newConfig = { ...currentConfig, groupsConfig: { ...currentConfig.groupsConfig, banners: updatedSlides, activeBlurLevel: currentConfig.groupsConfig?.activeBlurLevel || 'md' } };
        db.saveAppConfig(newConfig);
        supabaseService.saveAppConfig(newConfig);
        setConfig(newConfig);
    };

    const handleSaveSeasonSettings = async () => {
        if (!editingSeasons) return;
        setIsSavingSeasons(true);
        try {
            const updatedConfig: AppConfig = {
                ...config,
                groupsConfig: {
                    ...config?.groupsConfig,
                    activeBlurLevel: config?.groupsConfig?.activeBlurLevel || 'md',
                    seasonSettings: editingSeasons
                }
            };
            db.saveAppConfig(updatedConfig);
            const ok = await supabaseService.saveAppConfig(updatedConfig);
            if (ok) {
                setConfig(updatedConfig);
                setEditingSeasons(null);
                showToast('Configuración de temporadas guardada', 'success');
            } else {
                showToast('Error al guardar', 'error');
            }
        } catch {
            showToast('Error al guardar', 'error');
        } finally {
            setIsSavingSeasons(false);
        }
    };

    const renderLeaderDashboard = () => {
        // Handle unassigned hosts gracefully
        if (!currentUser?.linkedGroupId) {
            return (
                <div className="max-w-4xl mx-auto p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-black uppercase text-slate-900 mb-2">¡Felicitaciones!</h3>
                    <p className="text-lg font-bold text-slate-700 mb-4">Tu postulación ha sido aprobada.</p>
                    <p className="text-slate-500 max-w-lg mx-auto">
                        Ya eres oficialmente un Anfitrión de Origen. En breve, el equipo de coordinación te asignará tu Grupo de Conexión para que puedas comenzar a gestionarlo desde este panel.
                    </p>
                </div>
            );
        }

        const myGroup = groups.find(g => g.id === currentUser.linkedGroupId);
        if (!myGroup) {
            return (
                <div className="p-8 text-center border-2 border-dashed border-red-200 rounded-xl bg-red-50 text-red-700">
                    <Info className="w-8 h-8 mx-auto mb-2" />
                    <p className="font-bold">No se encontró tu grupo asignado.</p>
                    <p className="text-sm">Por favor contacta a tu coordinador.</p>
                </div>
            );
        }

        const status = myGroup.membersCount >= myGroup.maxCapacity ? 'LLENO' : 'DISPONIBLE';

        return (
            <div className="max-w-5xl mx-auto space-y-8">
                <div className="bg-off-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                    <div className="h-48 bg-slate-100 relative">
                        <img src={myGroup.imageUrl} className="w-full h-full object-cover" alt="Group Cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-8">
                            <div>
                                <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-1">{myGroup.name}</h2>
                                <p className="text-white/80 font-medium flex items-center gap-2"><MapPin className="w-4 h-4" /> {myGroup.location}</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="flex gap-8">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Día & Hora</p>
                                <p className="font-bold text-slate-800">{myGroup.meetingDay} {myGroup.meetingTime}hs</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Capacidad</p>
                                <p className="font-bold text-slate-800">{myGroup.membersCount} / {myGroup.maxCapacity}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Estado</p>
                                <div className="flex gap-2">
                                    <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${status === 'LLENO' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>{status}</span>
                                    {myGroup.endDate && myGroup.endDate < new Date().toISOString().split('T')[0] && (
                                        <span className="bg-neutral-200 text-neutral-600 border border-neutral-400 font-bold uppercase text-[10px] px-2 py-1 rounded-full">FINALIZADO</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        {/* Edit Button - Locked if approved */}
                        {myGroup.status === 'approved' ? (
                            <div
                                className="relative group/tooltip"
                                title="El grupo está aprobado y no se puede editar. Contacta a un administrador para cambios."
                            >
                                <button
                                    disabled
                                    className="px-6 py-3 bg-slate-200 text-slate-400 text-xs font-bold uppercase tracking-widest cursor-not-allowed flex items-center gap-2 rounded"
                                >
                                    <Eye className="w-4 h-4" /> Solo Ver
                                </button>
                                {/* Tooltip */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-[10px] rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                    Grupo aprobado - No editable
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black" />
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => openEditModal(myGroup)}
                                className="px-6 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2"
                            >
                                <Edit2 className="w-4 h-4" /> Editar Info
                            </button>
                        )}
                    </div>
                </div>

                <div className="bg-off-white rounded-2xl shadow-lg border border-slate-200 p-8">
                    <h3 className="text-xl font-black uppercase mb-6 flex items-center gap-3">
                        <Users className="w-6 h-6 text-indigo-600" />
                        Integrantes del Grupo
                    </h3>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-500">
                                <tr>
                                    <th className="p-4 rounded-tl-lg">Nombre</th>
                                    <th className="p-4">Contacto</th>
                                    <th className="p-4">Fecha Ingreso</th>
                                    <th className="p-4 rounded-tr-lg">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {myGroup.registrations && myGroup.registrations.length > 0 ? (
                                    myGroup.registrations.map(member => (
                                        <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4">
                                                <p className="font-bold text-sm text-slate-900 uppercase">{member.firstName} {member.lastName}</p>
                                                {member.dni && <p className="text-xs text-slate-400">DNI: {member.dni}</p>}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col gap-1 text-sm text-slate-600">
                                                    <span className="flex items-center gap-2"><Phone className="w-3 h-3" /> {member.phone}</span>
                                                    <span className="flex items-center gap-2"><Mail className="w-3 h-3" /> {member.email}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-slate-500">
                                                {new Date(member.timestamp).toLocaleDateString()}
                                            </td>
                                            <td className="p-4">
                                                <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-bold uppercase">Activo</span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-slate-400 italic">
                                            Aún no hay integrantes registrados en tu grupo.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const defaultSlides: HeroSlideData[] = [
        {
            id: 'd1',
            imageUrl: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?ixlib=rb-4.0.3&auto=format&fit=crop&w=1932&q=80",
            title: "GRUPOS DE CONEXIÓN",
            subtitle: "Un lugar para conocer a otros y que otros te conozcan."
        }
    ];

    const heroSlides: HeroSlideData[] = (config.groupsConfig?.banners && config.groupsConfig.banners.length > 0)
        ? config.groupsConfig.banners.map(s => ({
            id: s.id,
            imageUrl: s.imageUrl,
            title: s.title,
            subtitle: s.subtitle
        }))
        : defaultSlides;

    // Alterna el FAB entre "bajar a postularme" y "volver arriba"
    // cada vez que se lo toca.
    const [isHostCtaAtBottom, setIsHostCtaAtBottom] = useState(false);

    // Scroll animado y controlado (no el "smooth" nativo del navegador,
    // que en distancias largas puede sentirse instantáneo) — así se ve
    // pasar por las tarjetas de grupos en el camino hacia la postulación
    // (o de vuelta hacia arriba).
    //
    // CRÍTICO: se desactiva el "scroll anchoring" del navegador mientras
    // dura la animación. Sin esto, a medida que las imágenes de las
    // tarjetas terminan de cargar (cambiando su altura) por encima del
    // viewport, el navegador "corrige" la posición de scroll para
    // compensar — y esa corrección pelea contra nuestros scrollTo(),
    // dando exactamente el efecto de teletransporte/salto que se ve acá.
    const animateScrollTo = (targetY: number, duration = 900) => {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) {
            window.scrollTo({ top: targetY, behavior: 'auto' });
            return;
        }

        const htmlEl = document.documentElement;
        const previousOverflowAnchor = htmlEl.style.overflowAnchor;
        htmlEl.style.overflowAnchor = 'none';

        const startY = window.scrollY;
        const distance = targetY - startY;
        const startTime = performance.now();

        const easeInOutQuad = (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        const step = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            window.scrollTo(0, Math.round(startY + distance * easeInOutQuad(progress)));
            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                htmlEl.style.overflowAnchor = previousOverflowAnchor;
            }
        };
        requestAnimationFrame(step);
    };

    const scrollToWithFlythrough = (elementId: string, duration = 900) => {
        const target = document.getElementById(elementId);
        if (!target) return;
        const targetY = target.getBoundingClientRect().top + window.scrollY;
        animateScrollTo(targetY, duration);
    };

    const scrollToTopWithFlythrough = (duration = 900) => animateScrollTo(0, duration);

    return (
        <div className="min-h-screen bg-white font-sans pb-20 groups-original-fonts">
            {/* STICKY WRAPPER for navbar only — visible in admin mode */}
            {view === 'admin' && (
                <div className={`relative z-40 bg-white shadow-sm transition-transform duration-300`}>
                    <GroupsNavbar
                        view={view}
                        setView={setView}
                        canAccessAdmin={canAccessAdmin}
                        isGroupLeader={!!isAnfitrion}
                        isSuperAdmin={isSuperAdmin}
                        activeSubTab={adminSubTab}
                        setSubTab={setAdminSubTab}
                        canSeeConfig={canSeeConfig}
                    />
                </div>
            )}

            {/* Tutorial Components */}
            <TutorialInvitation
                isOpen={showInvitation}
                onStart={startTutorial}
                onClose={declineTemporary}
                onDismiss={dismissTutorial}
                title="Descubre el Explorador de Grupos"
            />
            <TutorialController
                steps={tours.groups}
                run={isActive}
                onComplete={completeTutorial}
                onSkip={dismissTutorial}
            />



            {view === 'public' ? (
                <>
                    {/* FAB — alterna entre bajar a la postulación de anfitrión y volver arriba */}
                    <button
                        type="button"
                        onClick={() => {
                            if (isHostCtaAtBottom) {
                                scrollToTopWithFlythrough();
                            } else {
                                scrollToWithFlythrough('leader-postulation-card');
                            }
                            setIsHostCtaAtBottom(prev => !prev);
                        }}
                        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 bg-[#28a946] text-white border-2 border-black rounded-full font-black text-xs uppercase tracking-wide shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#1f8a39] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                    >
                        {isHostCtaAtBottom ? <ArrowUp className="w-4 h-4 shrink-0" /> : <UserPlus className="w-4 h-4 shrink-0" />}
                        {isHostCtaAtBottom ? 'Volver arriba del todo' : '¿Querés ser anfitrión?'}
                    </button>

                    {/* HERO CAROUSEL - Grupos de Conexión */}
                    <section className="relative border-b-4 border-black">
                        <HeroCarousel
                            slides={heroSlides}
                            theme="groups"
                            heightClass="h-[42vh] md:h-[53vh]"
                            autoPlayInterval={6000}
                        />
                    </section>

                    {/* BENTO GRID */}
                    <div className="max-w-[1920px] mx-auto px-4 md:px-6 lg:px-12 xl:px-20 py-12 md:py-16 lg:py-20 font-['Helvetica_Neue',sans-serif]">
                        {/* Section Header */}
                        <div className="mb-8 md:mb-12 pb-4 border-b-4 border-black">
                            <p className="text-sm lg:text-base font-medium italic text-[#118f46] mb-2">// grupos de conexión //</p>
                            <h2 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold uppercase tracking-tight text-black">
                                ENCONTRÁ TU GRUPO
                            </h2>
                            <p className="text-sm lg:text-base font-medium uppercase tracking-wide mt-2 text-black/50">
                                {filteredGroups.length} grupos disponibles
                            </p>
                        </div>

                        {/* Search + Filter — one bordered capsule, one visual line */}
                        <div className="mb-8 md:mb-10 lg:mb-12">
                            {/* Wrapper is the positioning context for the dropdown —
                                kept separate from the capsule below because the capsule's
                                own overflow-hidden (used to clip the rounded corners around
                                the active black segment) would otherwise clip the dropdown too. */}
                            <div className="relative w-full md:max-w-xl">
                                <div className="flex items-stretch border-2 border-black rounded-lg overflow-hidden bg-white">
                                    {/* Search */}
                                    <div id="groups-search-bar" className="relative flex-1 min-w-0">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black pointer-events-none" />
                                        <input
                                            type="text"
                                            placeholder="BUSCAR GRUPO..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            className="w-full h-full pl-12 pr-3 py-2.5 bg-transparent text-sm font-bold uppercase tracking-wide text-black placeholder:text-black/40 focus:outline-none"
                                        />
                                    </div>

                                    <div className="w-[2px] bg-black shrink-0" aria-hidden="true" />

                                    {/* Tag Filter Trigger */}
                                    <div id="groups-filter-bar" className="shrink-0">
                                        <button
                                            onClick={() => {
                                                setIsTagFilterOpen(!isTagFilterOpen);
                                                setIsCategoryFilterOpen(false);
                                            }}
                                            aria-label={selectedTag !== 'ALL'
                                                ? `Filtro activo: ${tags.find(t => t.id === selectedTag)?.name || 'etiqueta'}`
                                                : 'Filtrar por etiqueta'
                                            }
                                            title={selectedTag !== 'ALL'
                                                ? tags.find(t => t.id === selectedTag)?.name || 'Filtro'
                                                : 'Filtrar por etiqueta'
                                            }
                                            aria-expanded={isTagFilterOpen}
                                            className={`h-full px-3.5 md:px-5 flex items-center justify-center transition-colors ${selectedTag !== 'ALL'
                                                ? 'bg-black text-white'
                                                : 'bg-white text-black hover:bg-black hover:text-white'
                                                }`}
                                        >
                                            <Filter className="w-4 h-4 shrink-0" />
                                        </button>
                                    </div>

                                    {/* Clear Filters — only when active, same capsule */}
                                    {(selectedCategory !== 'ALL' || selectedTag !== 'ALL' || searchTerm) && (
                                        <>
                                            <div className="w-[2px] bg-black shrink-0" aria-hidden="true" />
                                            <button
                                                onClick={() => {
                                                    setSelectedCategory('ALL');
                                                    setSelectedTag('ALL');
                                                    setSearchTerm('');
                                                }}
                                                aria-label="Limpiar filtros"
                                                title="Limpiar filtros"
                                                className="shrink-0 px-3.5 md:px-4 flex items-center justify-center bg-white text-black hover:bg-black hover:text-white transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>

                                {/* Tag Filter Dropdown Panel — slides down from the bar */}
                                <AnimatePresence>
                                    {isTagFilterOpen && (
                                        <>
                                            {/* Backdrop */}
                                            <div
                                                className="fixed inset-0 z-40"
                                                onClick={() => setIsTagFilterOpen(false)}
                                            />
                                            {/* Panel */}
                                            <motion.div
                                                initial={{ opacity: 0, y: -8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -8 }}
                                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                                className="absolute top-full right-0 mt-2 z-50 min-w-[220px] bg-white border-2 border-black rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] origin-top"
                                            >
                                                <div className="p-3 border-b-2 border-black bg-black">
                                                    <span className="text-xs font-bold uppercase tracking-wide text-white">
                                                        FILTRAR POR ETIQUETA
                                                    </span>
                                                </div>
                                                <div className="p-3 flex flex-wrap gap-2 max-h-[300px] overflow-y-auto">
                                                    {/* All Tags Option */}
                                                    <button
                                                        onClick={() => {
                                                            setSelectedTag('ALL');
                                                            setIsTagFilterOpen(false);
                                                        }}
                                                        className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all border-2 ${selectedTag === 'ALL'
                                                            ? 'bg-black text-white border-black'
                                                            : 'bg-white text-black border-black hover:bg-black hover:text-white'
                                                            }`}
                                                    >
                                                        TODAS
                                                    </button>

                                                    {/* Tag Badges */}
                                                    {tags.map(tag => (
                                                        <button
                                                            key={tag.id}
                                                            onClick={() => {
                                                                setSelectedTag(selectedTag === tag.id ? 'ALL' : tag.id);
                                                                setIsTagFilterOpen(false);
                                                            }}
                                                            className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all border-2 ${selectedTag === tag.id
                                                                ? 'bg-black text-white border-black'
                                                                : 'bg-white text-black border-black hover:bg-black hover:text-white'
                                                                }`}
                                                        >
                                                            #{tag.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        </>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center items-center py-32 border-4 border-dashed border-black/10">
                                <Loader2 className="w-12 h-12 animate-spin text-black/20" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {filteredGroups.map((group, index) => (
                                    <GroupCard
                                        key={group.id}
                                        id={`group-card-${group.id}`}
                                        group={group}
                                        tags={tags}
                                        categories={categories}
                                        onJoin={handleJoinClick}
                                        onInquiry={(g) => {
                                            if (!currentUser) {
                                                redirectToLoginForGroup(g.id);
                                                return;
                                            }
                                            setSelectedGroup(g); setInquiryModalOpen(true);
                                        }}
                                        userStatus={getUserGroupStatus(group.id)}
                                        currentUser={currentUser}
                                    />
                                ))}
                            </div>
                        )}

                        {!isLoading && filteredGroups.length === 0 && (
                            <div className="text-center py-32 border-4 border-dashed" style={{ borderColor: '#000000' }}>
                                <Users className="w-16 h-16 mx-auto mb-4" strokeWidth={1} style={{ color: 'rgba(0,0,0,0.2)' }} />
                                <p className="text-2xl md:text-3xl font-black uppercase tracking-tighter mb-2" style={{ color: 'rgba(0,0,0,0.4)' }}>
                                    NO SE ENCONTRARON GRUPOS
                                </p>
                                <p className="text-sm font-bold uppercase tracking-widest mb-6" style={{ color: 'rgba(0,0,0,0.2)' }}>
                                    Probá ajustando los filtros de búsqueda
                                </p>
                                {(selectedCategory !== 'ALL' || selectedTag !== 'ALL' || searchTerm) && (
                                    <button
                                        onClick={() => {
                                            setSelectedCategory('ALL');
                                            setSelectedTag('ALL');
                                            setSearchTerm('');
                                        }}
                                        className="px-6 py-3 text-xs font-black uppercase tracking-widest transition-all border-2 border-black hover:bg-black hover:text-white"
                                        style={{ backgroundColor: '#ffffff', color: '#000000' }}
                                    >
                                        LIMPIAR FILTROS
                                    </button>
                                )}
                            </div>
                        )}

                        {/* CTA: Leader Postulation */}
                        <div id="leader-postulation-card" className="mt-16 md:mt-24 border-4 border-black rounded-xl p-8 md:p-12 lg:p-16 xl:p-20 bg-black text-white">
                            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                                <div className="flex-1">
                                    <p className="text-xs font-bold italic text-[#118f46] mb-3">// postulaciones abiertas //</p>
                                    <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold uppercase tracking-tight leading-[1.1] mb-4">
                                        ¿QUERÉS SER ANFITRIÓN?
                                    </h3>
                                    <p className="text-base font-medium text-white/70 max-w-lg">
                                        Si sentís el llamado a servir y guiar a otros en comunidad, nos encantaría conocerte.
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        if (isAnfitrion) {
                                            showToast("Ya eres anfitrión", 'info');
                                            return;
                                        }
                                        if (userApplicationStatus === 'PENDING') {
                                            showToast("Ya tienes una postulación en revisión", 'info');
                                            return;
                                        }
                                        if (userApplicationStatus === 'APPROVED') {
                                            showToast("Tu postulación ya fue aprobada", 'success');
                                            return;
                                        }
                                        setIsPostulationModalOpen(true);
                                    }}
                                    className="px-8 py-4 bg-[#118f46] text-white font-bold uppercase tracking-wide text-sm border-2 border-[#118f46] rounded-lg hover:bg-white hover:text-black hover:border-white transition-all flex items-center gap-3 group"
                                >
                                    POSTULARME
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </div>

                    </div>
                </>
            ) : (
                <div className="w-full py-8 lg:py-10 animate-fadeIn">

                    {/* Only show Leader Dashboard for Anfitriones who are NOT also Admins */}
                    {(isAnfitrion && !isSuperAdmin && !isGroupsAdmin && !isEncargadoGroups) ? (
                        renderLeaderDashboard()
                    ) : (
                        <>

                            {adminSubTab === 'GROUPS' && (
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
                                        onToggleVisibility={handleToggleVisibility}
                                        openMenuGroupId={openMenuGroupId}
                                        setOpenMenuGroupId={setOpenMenuGroupId}
                                        isLoading={isLoading}
                                    />
                                </div>
                            )}

                            {/* CATEGORIES MANAGEMENT TAB */}
                            {adminSubTab === 'CATEGORIES' && (
                                <div className="max-w-5xl">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-xl md:text-2xl lg:text-3xl font-black uppercase tracking-tight">Categorías de Grupo</h3>
                                    </div>

                                    {/* Create Form */}
                                    <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 mb-8 flex flex-col md:flex-row gap-4 md:items-end">
                                        <div className="flex-1">
                                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Nombre Categoría</label>
                                            <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="w-full p-3 border border-slate-300 rounded text-sm focus:border-black outline-none bg-white" placeholder="Ej. Jóvenes" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Color</label>
                                            <input type="color" value={newCategoryColor} onChange={e => setNewCategoryColor(e.target.value)} className="w-full md:w-16 h-11 border border-slate-300 rounded cursor-pointer bg-white p-1" />
                                        </div>
                                        <button onClick={handleAddCategory} className="px-6 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-slate-800 rounded">
                                            Crear
                                        </button>
                                    </div>

                                    {/* Mobile List View */}
                                    <div className="md:hidden space-y-3">
                                        {categories.map(cat => (
                                            <div key={cat.id} className="bg-white p-4 border border-slate-200 rounded-lg shadow-sm flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }}></div>
                                                    {editingCategoryId === cat.id ? (
                                                        <input type="text" value={editingCategoryName} onChange={e => setEditingCategoryName(e.target.value)} className="border p-1 rounded text-sm w-32" />
                                                    ) : (
                                                        <span className="font-bold text-sm">{cat.name}</span>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    {editingCategoryId === cat.id ? (
                                                        <button onClick={() => handleUpdateCategory(cat.id)} className="p-2 bg-green-50 text-green-600 rounded"><Check className="w-4 h-4" /></button>
                                                    ) : (
                                                        <button onClick={() => startEditCategory(cat)} className="p-2 bg-slate-50 text-slate-600 rounded"><Edit2 className="w-4 h-4" /></button>
                                                    )}
                                                    <button onClick={() => handleDeleteCategory(cat.id)} className="p-2 bg-red-50 text-red-600 rounded"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Desktop Table View */}
                                    <div className="hidden md:block bg-off-white border border-slate-200 rounded-lg overflow-hidden">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-500">
                                                <tr>
                                                    <th className="p-4">Nombre</th>
                                                    <th className="p-4">Color</th>
                                                    <th className="p-4 text-right">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {categories.map(cat => (
                                                    <tr key={cat.id} className="hover:bg-slate-50">
                                                        <td className="p-4">
                                                            {editingCategoryId === cat.id ? (
                                                                <input type="text" value={editingCategoryName} onChange={e => setEditingCategoryName(e.target.value)} className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-black" />
                                                            ) : (
                                                                <span className="font-bold text-sm text-slate-900">{cat.name}</span>
                                                            )}
                                                        </td>
                                                        <td className="p-4">
                                                            {editingCategoryId === cat.id ? (
                                                                <input type="color" value={editingCategoryColor} onChange={e => setEditingCategoryColor(e.target.value)} className="w-10 h-8 border border-slate-300 rounded cursor-pointer" />
                                                            ) : (
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-6 h-6 rounded-full border border-slate-200" style={{ backgroundColor: cat.color }}></div>
                                                                    <span className="text-xs text-slate-400 font-mono">{cat.color}</span>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="p-4 text-right">
                                                            <div className="flex justify-end gap-2">
                                                                {editingCategoryId === cat.id ? (
                                                                    <button onClick={() => handleUpdateCategory(cat.id)} className="p-2 bg-green-50 text-green-600 rounded hover:bg-green-100"><Check className="w-4 h-4" /></button>
                                                                ) : (
                                                                    <button onClick={() => startEditCategory(cat)} className="p-2 text-slate-400 hover:text-black hover:bg-slate-100 rounded"><Edit2 className="w-4 h-4" /></button>
                                                                )}
                                                                <button onClick={() => handleDeleteCategory(cat.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* TAGS MANAGEMENT TAB */}
                            {adminSubTab === 'TAGS' && (
                                <div className="max-w-5xl">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-xl md:text-2xl lg:text-3xl font-black uppercase tracking-tight">Etiquetas (Tags)</h3>
                                    </div>

                                    {/* Create Form */}
                                    <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 mb-8 flex flex-col md:flex-row gap-4 md:items-end">
                                        <div className="flex-1">
                                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Nombre Etiqueta</label>
                                            <input type="text" value={newTagName} onChange={e => setNewTagName(e.target.value)} className="w-full p-3 border border-slate-300 rounded text-sm focus:border-black outline-none bg-white" placeholder="Ej. Presencial" />
                                        </div>
                                        <button onClick={handleAddTag} className="px-6 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-slate-800 rounded">
                                            Crear
                                        </button>
                                    </div>

                                    {/* Mobile List View */}
                                    <div className="md:hidden space-y-3">
                                        {tags.map(tag => (
                                            <div key={tag.id} className="bg-white p-4 border border-slate-200 rounded-lg shadow-sm flex items-center justify-between">
                                                <div>
                                                    {editingTagId === tag.id ? (
                                                        <input type="text" value={editingTagName} onChange={e => setEditingTagName(e.target.value)} className="border p-1 rounded text-sm w-32" />
                                                    ) : (
                                                        <span className="font-bold text-sm bg-slate-100 px-3 py-1 rounded-full">{tag.name}</span>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    {editingTagId === tag.id ? (
                                                        <button onClick={() => handleUpdateTag(tag.id)} className="p-2 bg-green-50 text-green-600 rounded"><Check className="w-4 h-4" /></button>
                                                    ) : (
                                                        <button onClick={() => startEditTag(tag)} className="p-2 bg-slate-50 text-slate-600 rounded"><Edit2 className="w-4 h-4" /></button>
                                                    )}
                                                    <button onClick={() => handleDeleteTag(tag.id)} className="p-2 bg-red-50 text-red-600 rounded"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Desktop Table List */}
                                    <div className="hidden md:block bg-off-white border border-slate-200 rounded-lg overflow-hidden">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-500">
                                                <tr>
                                                    <th className="p-4">Nombre</th>
                                                    <th className="p-4 text-right">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {tags.map(tag => (
                                                    <tr key={tag.id} className="hover:bg-slate-50">
                                                        <td className="p-4">
                                                            {editingTagId === tag.id ? (
                                                                <input type="text" value={editingTagName} onChange={e => setEditingTagName(e.target.value)} className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-black" />
                                                            ) : (
                                                                <span className="font-bold text-sm text-slate-900 bg-slate-100 px-3 py-1 rounded-full">{tag.name}</span>
                                                            )}
                                                        </td>
                                                        <td className="p-4 text-right">
                                                            <div className="flex justify-end gap-2">
                                                                {editingTagId === tag.id ? (
                                                                    <button onClick={() => handleUpdateTag(tag.id)} className="p-2 bg-green-50 text-green-600 rounded hover:bg-green-100"><Check className="w-4 h-4" /></button>
                                                                ) : (
                                                                    <button onClick={() => startEditTag(tag)} className="p-2 text-slate-400 hover:text-black hover:bg-slate-100 rounded"><Edit2 className="w-4 h-4" /></button>
                                                                )}
                                                                <button onClick={() => handleDeleteTag(tag.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {adminSubTab === 'CONFIG' && (
                                <div className="max-w-6xl">
                                    <h3 className="text-2xl md:text-3xl lg:text-4xl font-black uppercase tracking-tighter mb-6">Configuración Global</h3>

                                    <div className="bg-white p-8 border border-slate-200 shadow-lg mb-8 rounded-lg">
                                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                                            <h4 className="font-bold text-lg uppercase">Hero Banner (Carrusel)</h4>
                                            <button
                                                onClick={() => { setEditingSlide({ id: '', imageUrl: '', title: '', subtitle: '' }); setIsSlideModalOpen(true); }}
                                                className="px-4 py-2 bg-black text-white text-xs font-bold uppercase hover:bg-slate-800 rounded-lg"
                                            >
                                                + Agregar Banner
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {(config.groupsConfig?.banners || []).map(slide => (
                                                <div key={slide.id} className="border-2 border-slate-200 rounded-lg group relative overflow-hidden">
                                                    <div className="aspect-video bg-slate-100 relative overflow-hidden">
                                                        <img src={slide.imageUrl} className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                            <button onClick={() => { setEditingSlide(slide); setIsSlideModalOpen(true); }} className="p-2 bg-white text-black hover:bg-slate-200 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                                                            <button onClick={() => handleDeleteSlide(slide.id)} className="p-2 bg-red-600 text-white hover:bg-red-700 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                                        </div>
                                                    </div>
                                                    <div className="p-4">
                                                        <h5 className="font-bold text-sm uppercase text-black">{slide.title || 'Sin título'}</h5>
                                                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{slide.subtitle || 'Sin subtítulo'}</p>
                                                    </div>
                                                </div>
                                            ))}
                                            {(config.groupsConfig?.banners || []).length === 0 && (
                                                <div className="p-8 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 col-span-full rounded-lg">
                                                    No hay banners configurados. Se mostrarán los predeterminados.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                </div>
                            )}

                            {/* SEASONS MANAGEMENT TAB */}
                            {adminSubTab === 'SEASONS' && (() => {
                                const seasonSettings: SeasonSettings = config?.groupsConfig?.seasonSettings ?? DEFAULT_SEASON_SETTINGS;
                                return (
                                    <div className="max-w-4xl">
                                        <h3 className="text-2xl md:text-3xl lg:text-4xl font-black uppercase tracking-tighter mb-6">Temporadas</h3>

                                        <div className="bg-white p-8 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                            <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-black">
                                                <div>
                                                    <h4 className="font-black text-base uppercase tracking-tight">Configuración de Temporadas</h4>
                                                    <p className="text-xs font-medium text-neutral-500 mt-1">
                                                        Habilitá o deshabilitá en qué temporadas se puede crear o re-abrir un grupo. También podés ajustar el año activo y las fechas exactas.
                                                    </p>
                                                </div>
                                                {!editingSeasons ? (
                                                    <button
                                                        onClick={() => setEditingSeasons(JSON.parse(JSON.stringify(seasonSettings)))}
                                                        className="px-4 py-2 bg-black text-white text-xs font-black uppercase tracking-widest border-2 border-black hover:bg-white hover:text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all shrink-0"
                                                    >
                                                        Editar
                                                    </button>
                                                ) : (
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => setEditingSeasons(null)}
                                                            className="px-4 py-2 text-xs font-black uppercase tracking-widest border-2 border-black hover:bg-neutral-100 transition-all"
                                                        >
                                                            Cancelar
                                                        </button>
                                                        <button
                                                            onClick={handleSaveSeasonSettings}
                                                            disabled={isSavingSeasons}
                                                            className="px-4 py-2 bg-black text-white text-xs font-black uppercase tracking-widest border-2 border-black hover:opacity-80 transition-all disabled:opacity-50 shrink-0"
                                                        >
                                                            {isSavingSeasons ? 'Guardando...' : 'Guardar'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Año activo */}
                                            <div className="mb-6 p-4 border-2 border-neutral-200 bg-neutral-50 flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs font-black uppercase tracking-widest text-neutral-600">Año activo de temporadas</p>
                                                    <p className="text-[10px] font-medium text-neutral-400 mt-0.5">Las fechas de cada temporada se aplicarán a este año.</p>
                                                </div>
                                                {editingSeasons ? (
                                                    <input
                                                        type="number"
                                                        min={2024}
                                                        max={2030}
                                                        value={editingSeasons.activeYear}
                                                        onChange={e => setEditingSeasons({ ...editingSeasons, activeYear: parseInt(e.target.value) || new Date().getFullYear() })}
                                                        className="w-24 h-10 px-3 border-2 border-black font-black text-center text-base focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                                    />
                                                ) : (
                                                    <span className="text-3xl font-black tabular-nums">{seasonSettings.activeYear}</span>
                                                )}
                                            </div>

                                            {/* Las 3 temporadas */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {(['S1', 'S2', 'S3'] as const).map(key => {
                                                    const s = editingSeasons ? editingSeasons.seasons[key] : seasonSettings.seasons[key];
                                                    const year = editingSeasons ? editingSeasons.activeYear : seasonSettings.activeYear;
                                                    return (
                                                        <div
                                                            key={key}
                                                            className={`border-2 p-5 transition-all ${s.isOpen ? 'border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]' : 'border-neutral-200 bg-neutral-50'}`}
                                                        >
                                                            <div className="flex items-center justify-between mb-4">
                                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{key}</p>
                                                                {editingSeasons ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const updated = JSON.parse(JSON.stringify(editingSeasons));
                                                                            updated.seasons[key].isOpen = !updated.seasons[key].isOpen;
                                                                            setEditingSeasons(updated);
                                                                        }}
                                                                        className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider border-2 transition-all ${editingSeasons.seasons[key].isOpen ? 'bg-black border-black text-white' : 'bg-white border-neutral-300 text-neutral-400 hover:border-black'}`}
                                                                    >
                                                                        {editingSeasons.seasons[key].isOpen ? 'Abierta' : 'Cerrada'}
                                                                    </button>
                                                                ) : (
                                                                    <span className={`px-2 py-1 text-[9px] font-black uppercase tracking-wider ${s.isOpen ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-400'}`}>
                                                                        {s.isOpen ? 'Abierta' : 'Cerrada'}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {editingSeasons ? (
                                                                <input
                                                                    type="text"
                                                                    value={editingSeasons.seasons[key].label}
                                                                    onChange={e => {
                                                                        const updated = JSON.parse(JSON.stringify(editingSeasons));
                                                                        updated.seasons[key].label = e.target.value;
                                                                        setEditingSeasons(updated);
                                                                    }}
                                                                    className="w-full h-8 px-2 border-2 border-black font-black text-sm uppercase tracking-tight mb-3 focus:outline-none"
                                                                />
                                                            ) : (
                                                                <p className="font-black text-base uppercase tracking-tight mb-3">{s.label}</p>
                                                            )}

                                                            <div className="space-y-2">
                                                                <div>
                                                                    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1">Inicio (DD-MM)</p>
                                                                    {editingSeasons ? (
                                                                        <input
                                                                            type="text"
                                                                            placeholder="23-03"
                                                                            maxLength={5}
                                                                            value={editingSeasons.seasons[key].startDate.split('-').reverse().join('-')}
                                                                            onChange={e => {
                                                                                const updated = JSON.parse(JSON.stringify(editingSeasons));
                                                                                updated.seasons[key].startDate = e.target.value.split('-').reverse().join('-');
                                                                                setEditingSeasons(updated);
                                                                            }}
                                                                            className="w-full h-8 px-2 border-2 border-black font-bold text-sm text-center tabular-nums focus:outline-none"
                                                                        />
                                                                    ) : (
                                                                        <p className="text-sm font-bold tabular-nums text-neutral-600">{(s.startDate || '').split('-').reverse().join('-')} · {year}</p>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1">Fin (DD-MM)</p>
                                                                    {editingSeasons ? (
                                                                        <input
                                                                            type="text"
                                                                            placeholder="17-05"
                                                                            maxLength={5}
                                                                            value={editingSeasons.seasons[key].endDate.split('-').reverse().join('-')}
                                                                            onChange={e => {
                                                                                const updated = JSON.parse(JSON.stringify(editingSeasons));
                                                                                updated.seasons[key].endDate = e.target.value.split('-').reverse().join('-');
                                                                                setEditingSeasons(updated);
                                                                            }}
                                                                            className="w-full h-8 px-2 border-2 border-black font-bold text-sm text-center tabular-nums focus:outline-none"
                                                                        />
                                                                    ) : (
                                                                        <p className="text-sm font-bold tabular-nums text-neutral-600">{(s.endDate || '').split('-').reverse().join('-')} · {year}</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* HOSTS MANAGEMENT TAB */}
                            {adminSubTab === 'HOSTS' && (
                                <div className="max-w-7xl">
                                    <HostsManagementPanel groups={adminGroups} onUpdate={fetchAdminGroups} showToast={showToast} />
                                </div>
                            )}

                            {/* COORDINATORS MANAGEMENT TAB */}
                            {adminSubTab === 'COORDINATORS' && (
                                <div className="max-w-7xl">
                                    <CoordinatorsManagementPanel showToast={showToast} />
                                </div>
                            )}
                        </>
                    )}

                </div>
            )}

            {/* Join Group Modal - Extracted Component */}
            {selectedGroup && (
                <JoinGroupModal
                    isOpen={isInquiryModalOpen}
                    onClose={() => {
                        setInquiryModalOpen(false);
                        setSelectedGroup(null);
                    }}
                    group={selectedGroup}
                    currentUser={currentUser}
                    userStatus={getUserGroupStatus(selectedGroup.id)}
                    onSuccess={fetchUserRegistrations}
                    categories={categories}
                    tags={tags}
                />
            )}

            {isPostulationModalOpen && (
                <NeoModal
                    isOpen={isPostulationModalOpen}
                    onClose={() => setIsPostulationModalOpen(false)}
                    title="Postulación a Anfitrión"
                >
                    <form onSubmit={handlePostulationSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold uppercase text-slate-500">Nombre</label><input type="text" required value={postulationForm.firstName} onChange={e => setPostulationForm({ ...postulationForm, firstName: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm" /></div>
                                <div><label className="text-xs font-bold uppercase text-slate-500">Apellido</label><input type="text" required value={postulationForm.lastName} onChange={e => setPostulationForm({ ...postulationForm, lastName: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm" /></div>
                            </div>
                            <div><label className="text-xs font-bold uppercase text-slate-500">Email</label><input type="email" required value={postulationForm.email} onChange={e => setPostulationForm({ ...postulationForm, email: e.target.value })} className={`w-full p-3 border rounded-lg outline-none text-sm ${existingApplications.some(a => postulationForm.email?.toLowerCase().trim() && a.email === postulationForm.email?.toLowerCase().trim()) ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-black'}`} /></div>
                            <div><label className="text-xs font-bold uppercase text-slate-500">Teléfono</label><input type="tel" required value={postulationForm.phone} onChange={e => setPostulationForm({ ...postulationForm, phone: e.target.value })} className={`w-full p-3 border rounded-lg outline-none text-sm ${existingApplications.some(a => postulationForm.phone?.trim() && a.phone === postulationForm.phone?.trim()) ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-black'}`} /></div>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-slate-100">
                            <div className="flex items-center gap-3">
                                <input type="checkbox" checked={postulationForm.attendsOrigen} onChange={e => setPostulationForm({ ...postulationForm, attendsOrigen: e.target.checked })} className="w-5 h-5 accent-black" />
                                <label className="text-sm font-bold text-slate-700">¿Asistes regularmente a Origen?</label>
                            </div>
                            <div className="flex items-center gap-3">
                                <input type="checkbox" checked={postulationForm.completedHicisteCrecer} onChange={e => setPostulationForm({ ...postulationForm, completedHicisteCrecer: e.target.checked })} className="w-5 h-5 accent-black" />
                                <label className="text-sm font-bold text-slate-700">¿Hiciste crecer?</label>
                            </div>
                            <div className="flex items-center gap-3">
                                <input type="checkbox" checked={postulationForm.completedVolunteerTraining} onChange={e => setPostulationForm({ ...postulationForm, completedVolunteerTraining: e.target.checked })} className="w-5 h-5 accent-black" />
                                <label className="text-sm font-bold text-slate-700">¿Hiciste Entrenamiento de Voluntarios?</label>
                            </div>
                            <div className="flex items-center gap-3">
                                <input type="checkbox" checked={postulationForm.completedLeaderCourse} onChange={e => setPostulationForm({ ...postulationForm, completedLeaderCourse: e.target.checked })} className="w-5 h-5 accent-black" />
                                <label className="text-sm font-bold text-slate-700">¿Realizaste el Curso de Anfitrión?</label>
                            </div>
                        </div>

                        {/* Duplicate Warning */}
                        {(() => {
                            const emailMatch = postulationForm.email?.toLowerCase().trim() && existingApplications.some(a => a.email === postulationForm.email?.toLowerCase().trim());
                            const phoneMatch = postulationForm.phone?.trim() && existingApplications.some(a => a.phone === postulationForm.phone?.trim());
                            const nameMatch = postulationForm.firstName?.trim() && postulationForm.lastName?.trim() && existingApplications.some(a =>
                                a.firstName === postulationForm.firstName?.toLowerCase().trim() &&
                                a.lastName === postulationForm.lastName?.toLowerCase().trim()
                            );
                            const isDuplicate = emailMatch || phoneMatch || nameMatch;

                            if (isDuplicate) {
                                return (
                                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                                        <Info className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-bold text-red-700">Ya existe una postulación con estos datos</p>
                                            <p className="text-xs text-red-600 mt-1">
                                                {nameMatch ? 'Este nombre y apellido ya tienen una postulación.' :
                                                    emailMatch && phoneMatch ? 'El email y teléfono ya están registrados.' :
                                                        emailMatch ? 'Este email ya tiene una postulación.' :
                                                            'Este teléfono ya tiene una postulación.'}
                                            </p>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}

                        <div className="flex md:justify-end">
                            <button
                                type="submit"
                                disabled={(() => {
                                    const emailMatch = postulationForm.email?.toLowerCase().trim() && existingApplications.some(a => a.email === postulationForm.email?.toLowerCase().trim());
                                    const phoneMatch = postulationForm.phone?.trim() && existingApplications.some(a => a.phone === postulationForm.phone?.trim());
                                    const nameMatch = postulationForm.firstName?.trim() && postulationForm.lastName?.trim() && existingApplications.some(a =>
                                        a.firstName === postulationForm.firstName?.toLowerCase().trim() &&
                                        a.lastName === postulationForm.lastName?.toLowerCase().trim()
                                    );
                                    return emailMatch || phoneMatch || nameMatch;
                                })()}
                                className={`w-full md:w-auto md:px-10 py-4 font-bold uppercase tracking-widest rounded-lg transition-all shadow-lg ${(() => {
                                    const emailMatch = postulationForm.email?.toLowerCase().trim() && existingApplications.some(a => a.email === postulationForm.email?.toLowerCase().trim());
                                    const phoneMatch = postulationForm.phone?.trim() && existingApplications.some(a => a.phone === postulationForm.phone?.trim());
                                    const nameMatch = postulationForm.firstName?.trim() && postulationForm.lastName?.trim() && existingApplications.some(a =>
                                        a.firstName === postulationForm.firstName?.toLowerCase().trim() &&
                                        a.lastName === postulationForm.lastName?.toLowerCase().trim()
                                    );
                                    return (emailMatch || phoneMatch || nameMatch) ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-black text-white hover:bg-slate-800';
                                })()}`}
                            >
                                Enviar Postulación
                            </button>
                        </div>
                    </form>
                </NeoModal>
            )}



            {/* Edit Group Modal */}
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
                                                        // Logic: If only one name, put it in First Name. If multiple, First is First Name, rest is Surname.
                                                        const fName = parts.length > 0 ? parts[0] : '';
                                                        const lName = parts.length > 1 ? parts.slice(1).join(' ') : '';

                                                        console.log(`[EditModal] Selected Host: ${u.name} -> First: ${fName}, Last: ${lName}`);

                                                        setEditingGroup({
                                                            ...editingGroup,
                                                            host_id: u.id,
                                                            leaderName: fName,
                                                            leaderSurname: lName,
                                                            leaderPhone: u.phone || editingGroup.leaderPhone
                                                        });
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
                            {/* Hidden/Read-only fields to verify selection or manual override if needed */}
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
                                    {/* Visual Input (formatted) */}
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

                                    {/* Native Input (Invisible Trigger) */}
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
                                    {/* Visual Display (ReadOnly) */}
                                    <input
                                        type="text"
                                        readOnly
                                        value={formatDateForDisplay(editingGroup.endDate)}
                                        placeholder="Indefinido"
                                        className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm bg-white text-black font-bold pointer-events-none"
                                    />

                                    {/* Icon Decorator */}
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                        <Calendar className="w-5 h-5" />
                                    </div>

                                    {/* The Invisible Trigger (Active Area) */}
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

                        {/* Género Objetivo */}
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

                        {/* Edad Mínima y Máxima */}
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

                        {/* CO-HOST SELECTOR */}
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

            {/* Slide Editor Modal */}
            {isSlideModalOpen && editingSlide && (
                <NeoModal
                    isOpen={isSlideModalOpen}
                    onClose={() => { setIsSlideModalOpen(false); setEditingSlide(null); }}
                    title="Editor de Banner"
                >
                    <div className="space-y-5">
                        {/* Image */}
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-2 block">Imagen</label>
                            <ImageUpload
                                currentImage={editingSlide.imageUrl || ''}
                                folder="groups-banners"
                                onImageUpload={(url) => setEditingSlide({ ...editingSlide, imageUrl: url })}
                                aspectRatio="wide"
                            />
                        </div>
                        {/* Title */}
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Título</label>
                            <input
                                type="text"
                                placeholder="GRUPOS DE CONEXIÓN"
                                value={editingSlide.title || ''}
                                onChange={e => setEditingSlide({ ...editingSlide, title: e.target.value })}
                                className="w-full p-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-black font-bold uppercase"
                            />
                        </div>
                        {/* Subtitle */}
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Sub-título</label>
                            <input
                                type="text"
                                placeholder="Un lugar para conocer a otros..."
                                value={editingSlide.subtitle || ''}
                                onChange={e => setEditingSlide({ ...editingSlide, subtitle: e.target.value })}
                                className="w-full p-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-black"
                            />
                        </div>
                    </div>
                    <div className="pt-6 border-t border-slate-100 flex justify-end gap-3 mt-6">
                        <button onClick={() => { setIsSlideModalOpen(false); setEditingSlide(null); }} className="px-6 py-3 text-xs font-bold uppercase text-slate-500 hover:text-black">Cancelar</button>
                        <button onClick={handleSaveSlide} className="px-6 py-3 bg-black text-white text-xs font-bold uppercase rounded-lg shadow-lg hover:bg-slate-800">Guardar</button>
                    </div>
                </NeoModal>
            )}

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
                    // Refresh groups
                    fetchAdminGroups();
                }}
                currentUser={currentUser}
            />

            {/* Admin Add Member Modal */}
            <AdminAddMemberModal
                isOpen={isAddMemberModalOpen}
                onClose={() => setIsAddMemberModalOpen(false)}
                onSave={() => {
                    fetchAdminGroups(); // Update counts
                    fetchGroups();
                }}
                groups={adminGroups}
                categories={categories}
            />

            {/* Group Registrations Modal (Bulk Email Resend) */}
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
                    // Refresh pending count and groups
                    supabaseService.countPendingDropoutRequests().then(count => {
                        setPendingDropoutCount(count);
                    });
                    fetchAdminGroups();
                }}
            />

            {/* Success Modal */}
            <NeoModal
                isOpen={isSuccessModalOpen}
                onClose={() => setIsSuccessModalOpen(false)}
                maxWidth="max-w-md"
            >
                <div className="flex flex-col items-center justify-center p-6 text-center space-y-6">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center shadow-inner">
                        <Check className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-tight text-black dark:text-white">
                        ¡Postulación Enviada!
                    </h3>
                    <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                        {successModalMessage}
                    </p>
                    <button
                        onClick={() => setIsSuccessModalOpen(false)}
                        className="mt-4 w-full py-4 bg-[#118f46] text-white font-black uppercase tracking-widest rounded-xl hover:bg-[#0d7036] transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] active:shadow-none active:translate-y-1"
                    >
                        Entendido
                    </button>
                </div>
            </NeoModal>

            {/* Restriction Modal */}
            <NeoModal
                isOpen={restrictionModal.isOpen}
                onClose={() => setRestrictionModal({ isOpen: false, message: '' })}
                maxWidth="max-w-md"
            >
                <div className="flex flex-col items-center justify-center p-8 md:p-10 text-center space-y-6">
                    <div className="relative">
                        <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-10"></div>
                        <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center shadow-inner border-4 border-red-100 dark:border-red-900/30 relative z-10">
                            <Lock className="w-10 h-10" strokeWidth={2.5} />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-black dark:text-white">
                            Acceso Restringido
                        </h3>
                        <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed text-lg max-w-sm mx-auto">
                            {restrictionModal.message}
                        </p>
                    </div>
                    <button
                        onClick={() => setRestrictionModal({ isOpen: false, message: '' })}
                        className="mt-6 w-full py-4 bg-black text-white font-black uppercase tracking-widest rounded-2xl hover:bg-neutral-800 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] active:shadow-none active:translate-y-1 text-sm"
                    >
                        Entendido
                    </button>
                </div>
            </NeoModal>

            {/* Toast Notification */}
            {notification.show && (
                <div className={`fixed bottom-4 right-4 z-50 px-6 py-3 rounded-lg shadow-xl text-white font-bold uppercase tracking-wide animate-fade-in-up ${notification.type === 'error' ? 'bg-red-600' :
                    notification.type === 'info' ? 'bg-blue-600' : 'bg-[#118f46]'
                    }`}>
                    {notification.message}
                </div>
            )}
        </div>
    );
};

export default Groups;
