import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard,
    Users,
    ClipboardCheck,
    Calendar,
    Menu,
    X,
    LogOut,
    AlertTriangle,
    ChevronRight
} from 'lucide-react';
import { User, UserRole, Group, GroupCategory, GroupTag, GroupRegistration, DropoutRequest } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { hasRole } from '../../services/authUtils';

// Sub-views
import CoordinatorDashboard from './CoordinatorDashboard';
import CoordinatorGroups from './CoordinatorGroups';
import CoordinatorAttendance from './CoordinatorAttendance';
import CoordinatorCalendar from './CoordinatorCalendar';

type CoordinatorTab = 'dashboard' | 'groups' | 'attendance' | 'calendar';

interface CoordinatorsProps {
    currentUser: User;
}

const Coordinators: React.FC<CoordinatorsProps> = ({ currentUser }) => {
    const [activeTab, setActiveTab] = useState<CoordinatorTab>('dashboard');
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Data state
    const [groups, setGroups] = useState<Group[]>([]);
    const [allGroups, setAllGroups] = useState<Group[]>([]);
    const [categories, setCategories] = useState<GroupCategory[]>([]);
    const [tags, setTags] = useState<GroupTag[]>([]);
    const [dropouts, setDropouts] = useState<DropoutRequest[]>([]);
    const [attendanceData, setAttendanceData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Coordinator's assigned category
    const assignedCategory = currentUser.assignedCategory;

    // Find category name for display
    const categoryName = categories.find(c => c.id === assignedCategory)?.name || assignedCategory || '';

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

            // Filter by coordinator's assigned category
            if (assignedCategory) {
                const filtered = groupsData.filter(g => g.categoryId === assignedCategory);
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

    // No category assigned alert
    if (!assignedCategory && !hasRole(currentUser, [UserRole.SUPER_ADMIN])) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white border-3 border-black p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] max-w-md text-center">
                    <div className="w-16 h-16 bg-amber-100 border-2 border-black rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="w-8 h-8 text-amber-600" />
                    </div>
                    <h2 className="text-xl font-black mb-2">Sin Categoría Asignada</h2>
                    <p className="text-gray-600">
                        No tienes una categoría de coordinación asignada. Contacta al Administrador para que te asigne una categoría.
                    </p>
                </div>
            </div>
        );
    }

    const handleTabChange = (tab: CoordinatorTab) => {
        setActiveTab(tab);
        setSidebarOpen(false);
    };

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-64">
                    <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin" />
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
                        attendanceData={attendanceData}
                        categoryName={categoryName}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* Mobile Backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r-3 border-black
        transform transition-transform duration-300
        md:relative md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col
      `}>
                {/* Logo */}
                <div className="p-5 border-b-3 border-black">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-emerald-500 border-2 border-black rounded-lg flex items-center justify-center">
                                <Users className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-black text-emerald-600 text-lg">Coordinadores</span>
                        </div>
                        <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    {categoryName && (
                        <div className="mt-2 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded text-xs font-bold text-emerald-700 text-center">
                            {categoryName}
                        </div>
                    )}
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto p-3">
                    {menuItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => handleTabChange(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl mb-1 transition-all ${activeTab === item.id
                                ? 'bg-emerald-500 text-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                                : 'text-gray-600 hover:bg-gray-100 border-2 border-transparent'
                                }`}
                        >
                            <item.icon className="w-5 h-5" />
                            {item.label}
                        </button>
                    ))}

                    {/* Section divider */}
                    <div className="px-4 py-2 mt-3 mb-1">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Gestión</span>
                    </div>

                    {gestionItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => handleTabChange(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl mb-1 transition-all ${activeTab === item.id
                                ? 'bg-emerald-500 text-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                                : 'text-gray-600 hover:bg-gray-100 border-2 border-transparent'
                                }`}
                        >
                            <item.icon className="w-5 h-5" />
                            {item.label}
                        </button>
                    ))}
                </nav>

                {/* User info footer */}
                <div className="p-4 border-t-3 border-black">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 border-2 border-black rounded-full flex items-center justify-center font-black text-emerald-700 text-sm">
                            {currentUser.name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{currentUser.name}</p>
                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Coordinador</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Top bar (mobile) */}
                <div className="md:hidden flex items-center justify-between p-4 bg-white border-b-3 border-black sticky top-0 z-30 shrink-0">
                    <button onClick={() => setSidebarOpen(true)} className="p-2 border-2 border-black rounded-lg bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]">
                        <Menu className="w-5 h-5" />
                    </button>
                    <span className="font-black text-emerald-600">Coordinadores</span>
                    <div className="w-10 h-10 bg-emerald-100 border-2 border-black rounded-full flex items-center justify-center font-black text-emerald-700 text-xs">
                        {currentUser.name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
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
