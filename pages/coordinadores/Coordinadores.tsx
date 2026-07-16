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
    ArrowRight
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
            <div className="min-h-screen flex items-center justify-center bg-[#fdfdfd] p-4">
                <div className="bg-white border-2 border-black p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] max-w-md text-center">
                    <div className="w-16 h-16 bg-amber-100 border-2 border-black rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="w-8 h-8 text-amber-600" />
                    </div>
                    <h2 className="text-xl font-black uppercase mb-2">Sin Categoría Asignada</h2>
                    <p className="text-gray-600 font-medium">
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
                    <div className="w-12 h-12 border-4 border-black border-t-emerald-500 rounded-full animate-spin" />
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
        <div className="flex h-[calc(100vh-64px)] bg-[#fdfdfd] overflow-hidden font-sans">
            {/* Mobile Backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-72 bg-white border-r-2 border-black
                transform transition-transform duration-300 ease-in-out
                md:relative md:translate-x-0
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                flex flex-col shadow-[4px_0px_0px_0px_rgba(0,0,0,0.1)] md:shadow-none
            `}>
                {/* Logo Area */}
                <div className="p-6 border-b-2 border-black bg-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-500 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center">
                                <Users className="w-6 h-6 text-white text-stroke-black" strokeWidth={2.5} />
                            </div>
                            <div>
                                <span className="block font-black text-black text-xl uppercase tracking-tighter leading-none">Coordinadores</span>
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Panel de Control</span>
                            </div>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="md:hidden p-1 hover:bg-red-100 rounded border-2 border-transparent hover:border-black transition-all"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    {categoryName && (
                        <div className="mt-4 px-3 py-1.5 bg-black text-white text-xs font-black uppercase tracking-wider text-center border-2 border-black shadow-[3px_3px_0px_0px_#10b981]">
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
                            className={`w-full flex items-center gap-4 px-4 py-3 text-sm font-bold uppercase tracking-wide transition-all ${activeTab === item.id
                                ? 'bg-emerald-500 text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                                : 'text-gray-500 hover:text-black hover:bg-gray-50 border-2 border-transparent hover:border-black hover:shadow-[4px_4px_0px_0px_#e5e7eb]'
                                }`}
                        >
                            <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : 'text-gray-400 group-hover:text-black'}`} strokeWidth={2.5} />
                            {item.label}
                            {activeTab === item.id && <ChevronRight className="w-5 h-5 ml-auto" strokeWidth={3} />}
                        </button>
                    ))}

                    {/* Section divider */}
                    <div className="my-6 border-t-2 border-black relative">
                        <span className="absolute -top-3 left-4 bg-white px-2 text-[10px] font-black text-black uppercase tracking-widest border-2 border-black">Gestión</span>
                    </div>

                    {gestionItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => handleTabChange(item.id)}
                            className={`w-full flex items-center gap-4 px-4 py-3 text-sm font-bold uppercase tracking-wide transition-all ${activeTab === item.id
                                ? 'bg-emerald-500 text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                                : 'text-gray-500 hover:text-black hover:bg-gray-50 border-2 border-transparent hover:border-black hover:shadow-[4px_4px_0px_0px_#e5e7eb]'
                                }`}
                        >
                            <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : 'text-gray-400 group-hover:text-black'}`} strokeWidth={2.5} />
                            {item.label}
                            {activeTab === item.id && <ChevronRight className="w-5 h-5 ml-auto" strokeWidth={3} />}
                        </button>
                    ))}
                </nav>

            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#fdfdfd]">
                {/* Top bar (mobile) */}
                <div className="md:hidden flex items-center justify-between p-4 bg-white border-b-2 border-black sticky top-0 z-30 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center">
                            <Users className="w-6 h-6 text-white text-stroke-black" strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col">
                            <span className="block font-black text-black text-xl uppercase tracking-tighter leading-none">Coordinadores</span>
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Panel de Control</span>
                        </div>
                    </div>
                </div>

                {/* Content - Full width/height, let children handle scrolling */}
                <div className="flex-1 overflow-hidden relative pb-20 md:pb-0">
                    {renderContent()}
                </div>
            </main>

            {/* Mobile Bottom Navigation Bar - Premium App Feel */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-2 pb-safe flex justify-around items-center z-50 shadow-[0px_-4px_10px_rgba(0,0,0,0.05)]">
                {menuItems.concat(gestionItems).map(item => (
                    <button
                        key={item.id}
                        onClick={() => handleTabChange(item.id)}
                        className={`flex flex-col items-center justify-center py-2 px-1 min-h-[56px] rounded-xl transition-all flex-1 ${activeTab === item.id
                            ? 'text-emerald-700 bg-emerald-50 shadow-sm'
                            : 'text-gray-400 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                    >
                        <item.icon className={`w-5 h-5 mb-1 ${activeTab === item.id ? 'text-emerald-600' : 'text-gray-400'}`} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                        <span className={`text-[9px] font-bold uppercase tracking-wide ${activeTab === item.id ? 'text-emerald-700' : 'text-gray-400'}`}>
                            {item.label === 'Dashboard' ? 'Inicio' : item.label}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default Coordinators;
