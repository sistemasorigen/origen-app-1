import React, { useState, useMemo } from 'react';
import {
    Users,
    Search,
    Calendar as CalendarIcon,
    MapPin,
    Clock,
    Trash2,
    ArrowRight,
    Filter,
    Grid,
    LayoutList,
    CheckCircle,
    ChevronRight,
    MoreHorizontal,
    Phone,
    Mail,
    TrendingUp,
    UserMinus,
    Plus
} from 'lucide-react';
import { Group, GroupCategory, GroupTag, User, GroupRegistration } from '../../types';
import { supabaseService } from '../../services/supabaseService';

interface CoordinatorGroupsProps {
    groups: Group[];
    tags: GroupTag[];
    categories: GroupCategory[];
    currentUser: User;
    categoryName: string;
    onRefresh: () => void;
}

const CoordinatorGroups: React.FC<CoordinatorGroupsProps> = ({
    groups,
    tags,
    categories,
    categoryName
}) => {
    const [search, setSearch] = useState('');
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
    const [memberSearch, setMemberSearch] = useState('');
    const [deletingMember, setDeletingMember] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<string>('todos');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

    // --- Helpers ---
    const isGroupFinished = (g: Group) => {
        if ((g.status as string) === 'finished') return true;
        if (!g.endDate) return false;
        const today = new Date().toISOString().split('T')[0];
        return g.endDate < today;
    };

    const getCategoryName = (g: Group) => {
        if (!g.categoryId) return '';
        return categories.find(c => c.id === g.categoryId)?.name || '';
    };

    const getTagNames = (g: Group) => {
        if (!g.tags || g.tags.length === 0) return [];
        return g.tags.map(tId => tags.find(t => t.id === tId)?.name || tId);
    };

    // --- Filtering Logic ---
    const filteredGroups = useMemo(() => {
        let result = groups.filter(g => g.status === 'approved'); // Base: Approved groups

        // Category Filter
        if (activeCategory === 'finalizados') {
            result = groups.filter(g => (g.status === 'approved' && isGroupFinished(g)) || (g.status as string) === 'finished');
        } else if (activeCategory !== 'todos') {
            result = result.filter(g => !isGroupFinished(g) && g.categoryId === activeCategory);
        } else {
            // 'todos' = all active approved groups
            result = result.filter(g => !isGroupFinished(g));
        }

        // Search Filter
        if (search) {
            const term = search.toLowerCase();
            result = result.filter(g =>
                g.name.toLowerCase().includes(term) ||
                g.leaderName?.toLowerCase().includes(term) ||
                g.hostName?.toLowerCase().includes(term) ||
                g.location?.toLowerCase().includes(term) ||
                g.meetingDay?.toLowerCase().includes(term)
            );
        }

        return result;
    }, [groups, activeCategory, search]);

    // --- KPIs ---
    // Calculate stats based on "Active" groups (not finished) unless filtering for finished
    const activeGroups = groups.filter(g => g.status === 'approved' && !isGroupFinished(g));

    const totalActiveGroups = activeGroups.length;
    const totalConfirmedMembers = activeGroups.reduce((sum, g) => {
        return sum + (g.registrations || []).filter(r => r.status === 'APPROVED').length;
    }, 0);

    // Next Event Logic
    const dayOrder: Record<string, number> = {
        'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Jueves': 4,
        'Viernes': 5, 'Sábado': 6, 'Domingo': 0
    };
    const todayNum = new Date().getDay();
    const nextGroup = activeGroups
        .filter(g => g.meetingDay)
        .sort((a, b) => {
            const da = ((dayOrder[a.meetingDay!] ?? 7) - todayNum + 7) % 7;
            const db = ((dayOrder[b.meetingDay!] ?? 7) - todayNum + 7) % 7;
            return (da || 7) - (db || 7);
        })[0];

    // Calculate days until next event (approx)
    const getDaysUntil = (group: Group | undefined) => {
        if (!group?.meetingDay) return '';
        const groupDay = dayOrder[group.meetingDay] ?? 7;
        const diff = (groupDay - todayNum + 7) % 7;
        if (diff === 0) return 'Hoy';
        if (diff === 1) return 'Mañana';
        return `Faltan ${diff} días`;
    };

    // --- Member Management ---
    const handleDeleteMember = async (registration: GroupRegistration) => {
        if (!selectedGroup) return;
        setDeletingMember(registration.id);
        try {
            const success = await supabaseService.deleteGroupRegistration(registration.id, selectedGroup.id);
            if (success) {
                setSelectedGroup(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        registrations: (prev.registrations || []).filter(r => r.id !== registration.id)
                    };
                });
            }
        } catch (error) {
            console.error('Error deleting member:', error);
        } finally {
            setDeletingMember(null);
        }
    };


    // --- Detail View (New Design Implementation) ---
    if (selectedGroup) {
        const approvedMembers = (selectedGroup.registrations || []).filter(r => r.status === 'APPROVED');
        // Filter members for the search table
        const filteredMembers = (selectedGroup.registrations || []).filter(m =>
            `${m.firstName} ${m.lastName}`.toLowerCase().includes(memberSearch.toLowerCase()) ||
            m.email.toLowerCase().includes(memberSearch.toLowerCase())
        );

        return (
            <div className="flex flex-col h-full bg-[#f6f8f7] dark:bg-[#112118] overflow-y-auto font-sans">
                {/* Header & Breadcrumbs */}
                <header className="px-6 py-6 sm:px-8 border-b border-transparent">
                    <nav aria-label="Breadcrumb" className="flex mb-4">
                        <ol className="inline-flex items-center space-x-1 md:space-x-3 text-sm">
                            <li className="inline-flex items-center">
                                <button
                                    onClick={() => setSelectedGroup(null)}
                                    className="text-slate-400 hover:text-[#19e66f] dark:text-slate-500 dark:hover:text-[#19e66f] transition-colors"
                                >
                                    Mis Grupos
                                </button>
                            </li>
                            <li>
                                <div className="flex items-center">
                                    <ChevronRight className="text-slate-300 text-sm mx-1 w-4 h-4" />
                                    <span aria-current="page" className="text-slate-800 dark:text-white font-medium">{selectedGroup.name}</span>
                                </div>
                            </li>
                        </ol>
                    </nav>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{selectedGroup.name}</h1>
                            <p className="mt-1 text-slate-500 dark:text-slate-400">Gestiona los miembros y la actividad de este grupo.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-[#1a2e22] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium text-sm shadow-sm">
                                <Users className="w-5 h-5" />
                                Editar Grupo
                            </button>
                            <button className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#19e66f] hover:bg-[#14b859] text-white rounded-lg transition-colors font-medium text-sm shadow-sm shadow-[#19e66f]/30">
                                <Mail className="w-5 h-5" />
                                Enviar Mensaje
                            </button>
                        </div>
                    </div>
                </header>

                {/* Content Body */}
                <div className="flex-1 px-6 sm:px-8 pb-12">
                    {/* KPI Cards */}
                    <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {/* Card 1: Total Inscritos */}
                        <div className="bg-white dark:bg-[#1a2e22] p-6 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Users className="w-16 h-16 text-[#19e66f] transform rotate-12" />
                            </div>
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm uppercase tracking-wider">Total Inscriptos</p>
                                    <h3 className="text-4xl font-bold text-slate-900 dark:text-white mt-1">{approvedMembers.length}</h3>
                                </div>
                                <div className="p-2 bg-[#19e66f]/10 rounded-lg">
                                    <Users className="text-[#19e66f] w-6 h-6" />
                                </div>
                            </div>
                            <div className="flex items-center text-sm">
                                <span className="flex items-center text-[#19e66f] font-medium bg-[#19e66f]/10 px-1.5 py-0.5 rounded mr-2">
                                    <TrendingUp className="w-4 h-4 mr-0.5" />
                                    +5
                                </span>
                                <span className="text-slate-400">desde el mes pasado</span>
                            </div>
                        </div>

                        {/* Card 2: Proxima Reunion */}
                        <div className="bg-white dark:bg-[#1a2e22] p-6 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <CalendarIcon className="w-16 h-16 text-[#19e66f] transform -rotate-12" />
                            </div>
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm uppercase tracking-wider">Próxima Reunión</p>
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-2 leading-tight">
                                        {selectedGroup.meetingDay}, {selectedGroup.meetingTime}
                                    </h3>
                                </div>
                                <div className="p-2 bg-[#19e66f]/10 rounded-lg">
                                    <CalendarIcon className="text-[#19e66f] w-6 h-6" />
                                </div>
                            </div>
                            <div className="flex items-center text-sm mt-auto">
                                <span className="flex items-center text-slate-600 dark:text-slate-300">
                                    <MapPin className="w-4 h-4 mr-1.5 text-slate-400" />
                                    {selectedGroup.location || 'Sin ubicación'}
                                </span>
                            </div>
                        </div>

                        {/* Card 3: Bajas (Mocked for now as we don't track history of left members easily yet) */}
                        <div className="bg-white dark:bg-[#1a2e22] p-6 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <UserMinus className="w-16 h-16 text-rose-500 transform rotate-6" />
                            </div>
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm uppercase tracking-wider">Cantidad de Bajas</p>
                                    <h3 className="text-4xl font-bold text-slate-900 dark:text-white mt-1">
                                        {(selectedGroup.registrations || []).filter(r => r.status === 'REJECTED').length}
                                    </h3>
                                </div>
                                <div className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg">
                                    <UserMinus className="text-rose-500 w-6 h-6" />
                                </div>
                            </div>
                            <div className="flex items-center text-sm">
                                <span className="flex items-center text-rose-500 font-medium bg-rose-50 dark:bg-rose-900/20 px-1.5 py-0.5 rounded mr-2">
                                    <TrendingUp className="w-4 h-4 mr-0.5" />
                                    1
                                </span>
                                <span className="text-slate-400">esta semana</span>
                            </div>
                        </div>
                    </section>

                    {/* Members Section */}
                    <div className="bg-white dark:bg-[#1a2e22] rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm">
                        {/* Toolbar */}
                        <div className="p-5 border-b border-slate-100 dark:border-slate-700/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                Miembros del Grupo
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-400 font-medium">
                                    {(selectedGroup.registrations || []).length}
                                </span>
                            </h2>
                            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                <div className="relative w-full sm:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                    <input
                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#19e66f]/50 focus:border-[#19e66f] transition-shadow placeholder-slate-400 dark:text-slate-200"
                                        placeholder="Buscar miembro..."
                                        type="text"
                                        value={memberSearch}
                                        onChange={e => setMemberSearch(e.target.value)}
                                    />
                                </div>
                                <button className="flex items-center justify-center gap-2 px-4 py-2 bg-[#19e66f]/10 text-[#19e66f] hover:bg-[#19e66f]/20 rounded-lg transition-colors font-medium text-sm whitespace-nowrap">
                                    <Plus className="w-5 h-5" />
                                    Nuevo Miembro
                                </button>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
                                        <th className="px-6 py-4 rounded-tl-lg">Miembro</th>
                                        <th className="px-6 py-4">Contacto</th>
                                        <th className="px-6 py-4">Rol</th>
                                        <th className="px-6 py-4">Estado</th>
                                        <th className="px-6 py-4 text-right rounded-tr-lg">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30 text-sm">
                                    {filteredMembers.map(m => (
                                        <tr key={m.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-[#19e66f]/20 text-[#19e66f] flex items-center justify-center font-bold text-sm">
                                                        {m.firstName.substring(0, 1)}{m.lastName.substring(0, 1)}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-slate-900 dark:text-slate-100">{m.firstName} {m.lastName}</div>
                                                        <div className="text-xs text-slate-500">Unido: {new Date(m.timestamp).toLocaleDateString()}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col text-slate-600 dark:text-slate-300">
                                                    {m.email && (
                                                        <span className="flex items-center gap-1.5 align-middle">
                                                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                                                            {m.email}
                                                        </span>
                                                    )}
                                                    {m.phone && (
                                                        <span className="flex items-center gap-1.5 mt-1 align-middle">
                                                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                                                            {m.phone}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-slate-600 dark:text-slate-300">
                                                    Participante
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {m.status === 'APPROVED' ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                                        Activo
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                                        Pendiente
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleDeleteMember(m)}
                                                    disabled={deletingMember === m.id}
                                                    className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-red-50"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredMembers.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                                No se encontraron resultados
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination (Visual only for now) */}
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700/30 flex items-center justify-between">
                            <span className="text-sm text-slate-500 dark:text-slate-400">Mostrando <span className="font-medium text-slate-900 dark:text-white">1-{filteredMembers.length}</span> de <span className="font-medium text-slate-900 dark:text-white">{(selectedGroup.registrations || []).length}</span> miembros</span>
                            <div className="flex items-center gap-2">
                                <button className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-[#19e66f] hover:border-[#19e66f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors" disabled>
                                    <ChevronRight className="w-5 h-5 rotate-180" />
                                </button>
                                <button className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-[#19e66f] hover:border-[#19e66f] transition-colors">
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- Main Grid View ---
    return (
        <div className="flex flex-col h-full bg-white relative">
            {/* Header Section */}
            <div className="px-6 py-6 md:px-10 border-b border-gray-100">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-[#EAF4F4] text-[#6B9080] text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">
                                {categoryName || 'Coordinación'}
                            </span>
                            <span className="text-gray-300 text-xs">•</span>
                            <span className="text-gray-500 text-xs font-medium">Temporada 2025</span>
                        </div>
                        <h1 className="text-3xl font-bold text-[#333333] tracking-tight">Mis Grupos Activos</h1>
                        <p className="text-gray-500 mt-2 font-light text-sm">Gestiona tus eventos, revisa métricas y organiza tu comunidad.</p>
                    </div>
                    <div className="flex items-center bg-gray-50 p-1 rounded-lg border border-gray-100">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`px-4 py-2 text-sm font-medium rounded-md shadow-sm flex items-center gap-2 border transition-all ${viewMode === 'grid'
                                ? 'bg-white text-gray-900 border-gray-100'
                                : 'bg-transparent text-gray-500 border-transparent hover:text-gray-700'
                                }`}
                        >
                            <Grid className="w-4 h-4" />
                            Tarjetas
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 transition-all ${viewMode === 'table'
                                ? 'bg-white text-gray-900 shadow-sm border border-gray-100'
                                : 'bg-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <LayoutList className="w-4 h-4" />
                            Tabla
                        </button>
                    </div>
                </div>

                {/* KPIs Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* KPI 1 */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] transition-shadow duration-300">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Grupos Activos</p>
                                <h3 className="text-3xl font-bold text-gray-800 mt-2">{totalActiveGroups}</h3>
                            </div>
                            <div className="p-2 bg-blue-50 rounded-lg text-blue-400">
                                <Users className="w-6 h-6" />
                            </div>
                        </div>
                    </div>
                    {/* KPI 2 */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] transition-shadow duration-300">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Asistentes Confirmados</p>
                                <h3 className="text-3xl font-bold text-gray-800 mt-2">{totalConfirmedMembers}</h3>
                            </div>
                            <div className="p-2 bg-[#EAF4F4] rounded-lg text-[#6B9080]">
                                <CheckCircle className="w-6 h-6" />
                            </div>
                        </div>
                    </div>
                    {/* KPI 3 */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] transition-shadow duration-300">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Próximo Evento</p>
                                <h3 className="text-lg font-bold text-gray-800 mt-2">{nextGroup ? `${nextGroup.meetingDay}` : '—'}</h3>
                                <p className="text-xs text-gray-400 mt-1">{getDaysUntil(nextGroup)}</p>
                            </div>
                            <div className="p-2 bg-purple-50 rounded-lg text-purple-400">
                                <CalendarIcon className="w-6 h-6" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex overflow-x-auto pb-2 gap-3 w-full md:w-auto hide-scrollbar">
                        <button
                            onClick={() => setActiveCategory('todos')}
                            className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all shadow-sm ${activeCategory === 'todos'
                                ? 'bg-[#333333] text-white shadow-md shadow-gray-200'
                                : 'bg-white border border-gray-100 text-gray-500 hover:border-[#6B9080] hover:text-[#6B9080]'
                                }`}
                        >
                            Todos
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all shadow-sm ${activeCategory === cat.id
                                    ? 'bg-[#333333] text-white shadow-md shadow-gray-200'
                                    : 'bg-white border border-gray-100 text-gray-500 hover:border-[#6B9080] hover:text-[#6B9080]'
                                    }`}
                            >
                                {cat.name}
                            </button>
                        ))}
                        <button
                            onClick={() => setActiveCategory('finalizados')}
                            className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all shadow-sm ${activeCategory === 'finalizados'
                                ? 'bg-gray-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                        >
                            Finalizados
                        </button>
                    </div>

                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:border-[#6B9080] focus:ring-1 focus:ring-[#6B9080]"
                        />
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-6 py-8 md:px-10 bg-[#FAFAFA]">
                {filteredGroups.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                            <Search className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">No se encontraron grupos</h3>
                        <p className="text-gray-500">Intenta ajustar tu búsqueda o filtros.</p>
                    </div>
                ) : (
                    <div className={`grid gap-8 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
                        {filteredGroups.map(group => {
                            const approvedCount = (group.registrations || []).filter(r => r.status === 'APPROVED').length;
                            const isFull = group.maxMembers && approvedCount >= group.maxMembers;
                            const category = categories.find(c => c.id === group.categoryId)?.name || 'General';
                            const tagsList = getTagNames(group);

                            if (viewMode === 'table') {
                                // Simple Table Row Card for now
                                return (
                                    <div key={group.id} onClick={() => setSelectedGroup(group)} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden">
                                                {group.imageUrl ? <img src={group.imageUrl} className="w-full h-full object-cover" /> : <Users className="w-full h-full p-2 text-gray-400" />}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900">{group.name}</h3>
                                                <p className="text-sm text-gray-500">{group.leaderName}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-8 text-sm text-gray-600">
                                            <span className="flex items-center gap-1"><CalendarIcon className="w-4 h-4" /> {group.meetingDay}</span>
                                            <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {approvedCount}/{group.maxMembers || '∞'}</span>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-400" />
                                    </div>
                                );
                            }

                            // Card View
                            return (
                                <article key={group.id} className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-gray-50 flex flex-col hover:shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] transition-all duration-300 group">
                                    {/* Image Area */}
                                    <div className="relative h-60 overflow-hidden bg-gray-100">
                                        {group.imageUrl ? (
                                            <img
                                                src={group.imageUrl}
                                                alt={group.name}
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-90 group-hover:opacity-100"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                                <Users className="w-16 h-16 text-gray-300" />
                                            </div>
                                        )}

                                        <div className="absolute top-4 left-4">
                                            {isGroupFinished(group) ? (
                                                <span className="bg-gray-900/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm">
                                                    FINALIZADO
                                                </span>
                                            ) : isFull ? (
                                                <span className="bg-white/90 backdrop-blur-sm text-red-500 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm border border-white/50">
                                                    LLENO
                                                </span>
                                            ) : (
                                                <span className="bg-white/90 backdrop-blur-sm text-[#6B9080] text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm border border-white/50">
                                                    <span className="w-1.5 h-1.5 bg-[#6B9080] rounded-full animate-pulse"></span>
                                                    ABIERTO
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Content Area */}
                                    <div className="p-6 flex-1 flex flex-col">
                                        <h2 className="text-xl font-bold text-[#333333] mb-3 leading-tight">{group.name}</h2>

                                        <div className="flex items-center gap-4 text-xs font-medium text-gray-500 mb-5">
                                            <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md">
                                                <Clock className="w-3.5 h-3.5 text-[#6B9080]" />
                                                <span>{group.meetingDay} {group.meetingTime}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md">
                                                <MapPin className="w-3.5 h-3.5 text-[#6B9080]" />
                                                <span className="truncate max-w-[100px]">{group.location || 'Sin ubicación'}</span>
                                            </div>
                                        </div>

                                        {/* Tags Row */}
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            <span className="px-2.5 py-1 bg-[#EAF4F4] text-[#6B9080] text-[10px] font-semibold rounded-md uppercase tracking-wide">
                                                {category}
                                            </span>
                                            {tagsList.slice(0, 2).map((tag, i) => (
                                                <span key={i} className="px-2.5 py-1 bg-gray-50 text-gray-500 text-[10px] font-semibold rounded-md uppercase tracking-wide">
                                                    {tag}
                                                </span>
                                            ))}
                                            {tagsList.length > 2 && (
                                                <span className="px-2.5 py-1 bg-gray-50 text-gray-400 text-[10px] font-semibold rounded-md">
                                                    +{tagsList.length - 2}
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-gray-500 text-sm mb-6 line-clamp-2 font-light leading-relaxed">
                                            {group.description || 'Sin descripción disponible para este grupo.'}
                                        </p>

                                        {/* Footer */}
                                        <div className="mt-auto pt-5 border-t border-gray-50 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center font-bold text-xs text-gray-600 border border-white shadow-sm">
                                                    {(group.hostName || group.leaderName || '?').substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] uppercase text-gray-400 font-bold tracking-wider">Líder</span>
                                                    <span className="text-xs font-bold text-gray-800 max-w-[100px] truncate">{group.leaderName}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setSelectedGroup(group)}
                                                className="bg-[#6B9080] hover:bg-[#557568] text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-[#6B9080]/20 hover:shadow-[#6B9080]/30 uppercase tracking-wide"
                                            >
                                                Gestionar
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}

                {/* Footer Credits */}
                <div className="mt-16 text-center text-xs text-gray-400 border-t border-gray-100 pt-8 pb-4">
                    <p>Sistema de Gestión Integral 2026 © Origen. Todos los derechos reservados.</p>
                </div>
            </div>
        </div>
    );
};

export default CoordinatorGroups;
