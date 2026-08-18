import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard,
    Users,
    ClipboardCheck,
    Calendar,
    X,
    LogOut,
    AlertTriangle,
    ChevronRight,
    ArrowRight,
    Menu
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { User, UserRole, Group, GroupCategory, GroupTag, GroupRegistration, DropoutRequest, coordinatorVariantToCategory } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { hasRole } from '../../services/authUtils';

// Sub-views
import CoordinatorDashboard from './PanelCoordinador';
import CoordinatorGroups from './GruposCoordinador';
import CoordinatorAttendance from './AsistenciaCoordinador';
import CoordinatorCalendar from './CalendarioCoordinador';

type CoordinatorTab = 'dashboard' | 'groups' | 'attendance' | 'calendar';

interface CoordinatorsProps {
    currentUser: User;
}

const Coordinators: React.FC<CoordinatorsProps> = ({ currentUser }) => {
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<CoordinatorTab>('dashboard');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [preselectedGroupId, setPreselectedGroupId] = useState<string | null>(null);

    // Deep linking for tabs
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['dashboard', 'groups', 'attendance', 'calendar'].includes(tab)) {
            setActiveTab(tab as CoordinatorTab);
        }
    }, [searchParams]);

    // Data state
    const [groups, setGroups] = useState<Group[]>([]);
    const [allGroups, setAllGroups] = useState<Group[]>([]);
    const [categories, setCategories] = useState<GroupCategory[]>([]);
    const [tags, setTags] = useState<GroupTag[]>([]);
    const [dropouts, setDropouts] = useState<DropoutRequest[]>([]);
    const [attendanceData, setAttendanceData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Coordinator's variants -> categories mapping.
    // Fallback al campo legacy singular si coordinatorVariants
    // todavía no está poblado en memoria (usuario no migrado).
    const coordinatorVariants = (currentUser.coordinatorVariants && currentUser.coordinatorVariants.length > 0)
        ? currentUser.coordinatorVariants
        : (currentUser.coordinatorVariant ? [currentUser.coordinatorVariant] : []);

    const categoryFilters = Array.from(new Set(
        coordinatorVariants
            .map(v => coordinatorVariantToCategory(v))
            .filter((c): c is string => !!c)
    ));

    // Find category name(s) for display
    const categoryName = categoryFilters.length > 0
        ? categoryFilters.join(' + ')
        : (hasRole(currentUser, [UserRole.SUPER_ADMIN]) ? 'Todas las Categorías (Global)' : '');

    // Load all data
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [groupsData, categoriesData, tagsData, dropoutsData, attendanceReport] = await Promise.all([
                supabaseService.getGroupsForAdmin(),
                supabaseService.getGroupCategories(),
                supabaseService.getGroupTags(),
                supabaseService.getAllDropoutRequests(),
                supabaseService.getGlobalAttendanceReport()
            ]);

            setAllGroups(groupsData);
            setCategories(categoriesData);
            setTags(tagsData);

            // Filter by coordinator's variants -> categories (combinadas)
            if (categoryFilters.length > 0) {
                // 1. Encontrar los UUIDs reales de cada categoría según su nombre
                const targetCategoryIds = categoryFilters.map(catName => {
                    const matchedCategory = categoriesData.find(
                        c => c.name.toLowerCase().trim() === catName.toLowerCase().trim()
                    );
                    // Usar el ID encontrado, o el string original como respaldo de seguridad
                    return matchedCategory ? matchedCategory.id : catName;
                });
                const targetCategoryIdsLower = categoryFilters.map(c => c.toLowerCase().trim());

                // 2. Filtrar usando CUALQUIERA de los UUIDs/nombres
                const filtered = groupsData.filter(g =>
                    targetCategoryIds.includes(g.categoryId) ||
                    (g.categoryName && targetCategoryIdsLower.includes(g.categoryName.toLowerCase().trim()))
                );

                setGroups(filtered);
                const filteredGroupIds = new Set(filtered.map(g => g.id));
                setDropouts(dropoutsData.filter(d => filteredGroupIds.has(d.groupId)));
                setAttendanceData(attendanceReport.filter(a => filteredGroupIds.has(a.groupId)));
            } else {
                setGroups(groupsData);
                setDropouts(dropoutsData);
                setAttendanceData(attendanceReport);
            }
        } catch (error) {
            console.error('[Coordinators] Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Menu items
    const menuItems: { id: CoordinatorTab; label: string; icon: React.ElementType }[] = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ];

    const gestionItems: { id: CoordinatorTab; label: string; icon: React.ElementType }[] = [
        { id: 'groups', label: 'Grupos', icon: Users },
        { id: 'attendance', label: 'Asistencia', icon: ClipboardCheck },
        { id: 'calendar', label: 'Calendario', icon: Calendar },
    ];

    // No variant assigned alert
    if (categoryFilters.length === 0 && !hasRole(currentUser, [UserRole.SUPER_ADMIN])) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 p-4">
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm max-w-md text-center">
                    <div className="w-16 h-16 bg-amber-50 dark:bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h2 className="text-xl font-bold uppercase tracking-tight text-slate-900 dark:text-white mb-2">Sin Categoría Asignada</h2>
                    <p className="text-sm text-slate-500 dark:text-zinc-400">
                        No tienes una categoría de coordinación asignada. Contacta al Administrador.
                    </p>
                </div>
            </div>
        );
    }

    const handleTabChange = (tab: CoordinatorTab) => {
        setActiveTab(tab);
        setSidebarOpen(false);
    };

    const handleGroupSelectFromCalendar = (groupId: string) => {
        setPreselectedGroupId(groupId);
        setActiveTab('groups');
        setSidebarOpen(false);
    };

    const handleClearPreselection = () => {
        setPreselectedGroupId(null);
    };

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-64">
                    <div className="w-12 h-12 border-4 border-slate-200 dark:border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
                </div>
            );
        }

        switch (activeTab) {
            case 'dashboard':
                return (
                    <CoordinatorDashboard
                        groups={groups}
                        dropouts={dropouts}
                        attendanceData={attendanceData}
                        categories={categories}
                        categoryName={categoryName}
                        onRefresh={loadData}
                    />
                );
            case 'groups':
                return (
                    <CoordinatorGroups
                        groups={groups}
                        tags={tags}
                        categories={categories}
                        currentUser={currentUser}
                        categoryName={categoryName}
                        onRefresh={loadData}
                        preselectedGroupId={preselectedGroupId}
                        onClearPreselection={handleClearPreselection}
                    />
                );
            case 'attendance':
                return (
                    <CoordinatorAttendance
                        groups={groups}
                        attendanceData={attendanceData}
                        categoryName={categoryName}
                        onRefresh={loadData}
                    />
                );
            case 'calendar':
                return (
                    <CoordinatorCalendar
                        groups={groups}
                        categoryName={categoryName}
                        onGroupSelect={handleGroupSelectFromCalendar}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="flex h-[calc(100vh-64px)] bg-slate-50 dark:bg-zinc-950 overflow-hidden font-sans">
            {/* Mobile Backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800
                transform transition-transform duration-300 ease-in-out
                md:relative md:translate-x-0
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                flex flex-col shadow-xl md:shadow-none
            `}>
                {/* Logo Area */}
                <div className="p-6 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center">
                                <Users className="w-5 h-5 text-white" strokeWidth={2.5} />
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-white text-xl uppercase tracking-tight leading-none">Coordinadores</span>
                                <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Panel de Control</span>
                            </div>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="md:hidden p-2 rounded-xl text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    {categoryName && (
                        <div className="mt-4 px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold uppercase tracking-wider text-center rounded-lg shadow-sm">
                            {categoryName}
                        </div>
                    )}
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto p-4 space-y-2">
                    {menuItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => handleTabChange(item.id)}
                            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all ${activeTab === item.id
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800'
                                }`}
                        >
                            <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : 'text-slate-400 dark:text-zinc-500'}`} strokeWidth={2.5} />
                            {item.label}
                            {activeTab === item.id && <ChevronRight className="w-5 h-5 ml-auto" strokeWidth={3} />}
                        </button>
                    ))}

                    {/* Section divider */}
                    <div className="my-6 border-t border-slate-200 dark:border-zinc-800 relative">
                        <span className="absolute -top-2.5 left-4 bg-white dark:bg-zinc-900 px-2 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Gestión</span>
                    </div>

                    {gestionItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => handleTabChange(item.id)}
                            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all ${activeTab === item.id
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800'
                                }`}
                        >
                            <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : 'text-slate-400 dark:text-zinc-500'}`} strokeWidth={2.5} />
                            {item.label}
                            {activeTab === item.id && <ChevronRight className="w-5 h-5 ml-auto" strokeWidth={3} />}
                        </button>
                    ))}
                </nav>

            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-50 dark:bg-zinc-950">
                {/* Top bar (mobile) */}
                <div className="md:hidden flex items-center justify-between gap-3 p-4 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 sticky top-0 z-30 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center shrink-0">
                            <Users className="w-5 h-5 text-white" strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="block font-bold text-slate-900 dark:text-white text-lg uppercase tracking-tight leading-none truncate">Coordinadores</span>
                            <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mt-0.5">Panel de Control</span>
                        </div>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center shrink-0"
                        aria-label="Abrir menú"
                    >
                        <Menu className="w-5 h-5 text-slate-700 dark:text-zinc-300" />
                    </button>
                </div>

                {/* Content - Full width/height, let children handle scrolling */}
                <div className="flex-1 overflow-hidden relative">
                    {renderContent()}
                </div>
            </main>
        </div>
    );
};

export default Coordinators;
