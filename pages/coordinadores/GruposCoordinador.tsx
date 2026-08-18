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
    CheckCircle,
    ChevronRight,
    MoreHorizontal,
    Phone,
    Mail,
    TrendingUp,
    UserMinus,
    X
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
    preselectedGroupId?: string | null;
    onClearPreselection?: () => void;
}

const CoordinatorGroups: React.FC<CoordinatorGroupsProps> = ({
    groups,
    tags,
    categories,
    categoryName,
    preselectedGroupId,
    onClearPreselection
}) => {
    const [search, setSearch] = useState('');
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
    const [memberSearch, setMemberSearch] = useState('');
    const [deletingMember, setDeletingMember] = useState<string | null>(null);
    const [activeFilter, setActiveFilter] = useState<'active' | 'finished'>('active');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

    // Handle preselected group from calendar navigation
    React.useEffect(() => {
        if (preselectedGroupId) {
            const group = groups.find(g => g.id === preselectedGroupId);
            if (group) {
                setSelectedGroup(group);
                if (onClearPreselection) onClearPreselection();
            }
        }
    }, [preselectedGroupId, groups, onClearPreselection]);

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

        // Filter by Active/Finished
        if (activeFilter === 'finished') {
            result = result.filter(g => isGroupFinished(g));
        } else {
            // 'active'
            result = result.filter(g => !isGroupFinished(g));
        }

        // Search Filter
        if (search) {
            const term = search.toLowerCase();
            result = result.filter(g =>
                (g.name || '').toLowerCase().includes(term) ||
                (g.leaderName || '').toLowerCase().includes(term) ||
                (g.hostName || '').toLowerCase().includes(term) ||
                (g.location || '').toLowerCase().includes(term) ||
                (g.meetingDay || '').toLowerCase().includes(term)
            );
        }

        return result;
    }, [groups, activeFilter, search]);

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
            <div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-950 overflow-y-auto font-sans">
                {/* Header & Breadcrumbs */}
                <header className="px-6 py-6 md:px-10 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <button
                        onClick={() => setSelectedGroup(null)}
                        className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-colors group"
                    >
                        <span className="w-8 h-8 rounded-full border border-slate-200 dark:border-zinc-700 group-hover:border-slate-900 dark:group-hover:border-white flex items-center justify-center transition-colors">
                            <ArrowRight className="w-4 h-4 rotate-180" strokeWidth={2.5} />
                        </span>
                        Volver a Mis Grupos
                    </button>

                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest">
                                    {getCategoryName(selectedGroup)}
                                </span>
                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest ${isGroupFinished(selectedGroup) ? 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400' : 'bg-emerald-400 text-black'
                                    }`}>
                                    {isGroupFinished(selectedGroup) ? 'Finalizado' : 'Activo'}
                                </span>
                            </div>
                            <h1 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white uppercase tracking-tight leading-none">{selectedGroup.name}</h1>
                            <div className="flex items-center gap-4 mt-3 text-sm font-semibold text-slate-500 dark:text-zinc-400">
                                <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg">
                                    <Clock className="w-4 h-4 text-slate-700 dark:text-zinc-300" strokeWidth={2.5} />
                                    {selectedGroup.meetingDay} {selectedGroup.meetingTime}
                                </span>
                                <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg">
                                    <MapPin className="w-4 h-4 text-slate-700 dark:text-zinc-300" strokeWidth={2.5} />
                                    {selectedGroup.location || 'Sin ubicación'}
                                </span>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Content Body */}
                <div className="flex-1 px-6 md:px-10 py-8">
                    {/* KPI Cards */}
                    <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-10">
                        {/* Card 1: Total Inscritos */}
                        <div className="bg-white dark:bg-zinc-900 p-6 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm relative overflow-hidden group hover:shadow-lg transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-emerald-400 rounded-2xl">
                                    <Users className="w-6 h-6 text-black" strokeWidth={2.5} />
                                </div>
                                <div className="text-right">
                                    <h3 className="text-4xl font-black text-slate-900 dark:text-white">{approvedMembers.length}</h3>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Inscriptos</p>
                                </div>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-2">
                                <div
                                    className="bg-emerald-400 h-full rounded-full"
                                    style={{ width: `${Math.min(((approvedMembers.length) / (selectedGroup.maxCapacity || selectedGroup.maxMembers || 20)) * 100, 100)}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Card 2: Capacidad */}
                        <div className="bg-white dark:bg-zinc-900 p-6 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm relative overflow-hidden group hover:shadow-lg transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-lime-300 rounded-2xl">
                                    <CheckCircle className="w-6 h-6 text-black" strokeWidth={2.5} />
                                </div>
                                <div className="text-right">
                                    <h3 className="text-4xl font-black text-slate-900 dark:text-white">{selectedGroup.maxCapacity || selectedGroup.maxMembers || '∞'}</h3>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Capacidad Máx</p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-1 mt-2">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className={`w-2 h-2 rounded-full ${i < 3 ? 'bg-lime-300' : 'bg-slate-100 dark:bg-zinc-800'}`}></div>
                                ))}
                            </div>
                        </div>

                        {/* Card 3: Bajas */}
                        <div className="bg-white dark:bg-zinc-900 p-6 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm relative overflow-hidden group hover:shadow-lg transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-rose-400 rounded-2xl">
                                    <UserMinus className="w-6 h-6 text-black" strokeWidth={2.5} />
                                </div>
                                <div className="text-right">
                                    <h3 className="text-4xl font-black text-slate-900 dark:text-white">
                                        {(selectedGroup.registrations || []).filter(r => r.status === 'REJECTED').length}
                                    </h3>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Bajas Totales</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Members Section */}
                    <div className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm overflow-hidden">
                        {/* Toolbar */}
                        <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <Users className="w-6 h-6" strokeWidth={2.5} />
                                Miembros del Grupo
                            </h2>
                            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                <div className="relative w-full sm:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 w-4 h-4" strokeWidth={2.5} />
                                    <input
                                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-4 focus:ring-slate-900/10 dark:focus:ring-white/10 transition-all"
                                        placeholder="Buscar miembro..."
                                        type="text"
                                        value={memberSearch}
                                        onChange={e => setMemberSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Member Grid/List */}
                        <div className="w-full">
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-400 dark:text-zinc-500">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest">Miembro</th>
                                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest">Contacto</th>
                                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest">Rol</th>
                                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest">Estado</th>
                                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                        {filteredMembers.map(m => (
                                            <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                                                            {(m.firstName || '?').substring(0, 1)}{(m.lastName || '?').substring(0, 1)}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-900 dark:text-white">{m.firstName} {m.lastName}</div>
                                                            <div className="text-xs text-slate-400 dark:text-zinc-500 font-medium">Unido: {new Date(m.timestamp).toLocaleDateString()}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm font-medium text-slate-500 dark:text-zinc-400">
                                                    <div className="flex flex-col gap-1">
                                                        {m.email && <span className="flex items-center gap-2"><Mail className="w-3 h-3" /> {m.email}</span>}
                                                        {m.phone && <span className="flex items-center gap-2"><Phone className="w-3 h-3" /> {m.phone}</span>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-xs font-semibold uppercase tracking-wide bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full text-slate-500 dark:text-zinc-400">
                                                        Participante
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {m.status === 'APPROVED' ? (
                                                        <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-full">
                                                            Activo
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-full">
                                                            Pendiente
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => handleDeleteMember(m)}
                                                        disabled={deletingMember === m.id}
                                                        className="p-2 min-h-[44px] rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-slate-400 dark:text-zinc-500 hover:text-red-500"
                                                    >
                                                        <Trash2 className="w-5 h-5" strokeWidth={2.5} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredMembers.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 dark:text-zinc-600 font-semibold">
                                                    No se encontraron resultados
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Cards Alternative */}
                            <div className="md:hidden flex flex-col gap-4 p-4 bg-slate-50 dark:bg-zinc-950">
                                {filteredMembers.map(m => (
                                    <div key={m.id} className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-slate-100 dark:border-zinc-800 p-4 flex flex-col relative w-full">
                                        <div className="flex items-start justify-between mb-3 w-full">
                                            <div className="flex items-center gap-3 w-full">
                                                <div className="w-12 h-12 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center font-bold text-slate-700 dark:text-zinc-300 text-lg">
                                                    {(m.firstName || '?').substring(0, 1)}{(m.lastName || '?').substring(0, 1)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-lg font-bold text-slate-900 dark:text-white truncate">{m.firstName} {m.lastName}</div>
                                                    <div className="text-xs text-slate-400 dark:text-zinc-500">Unido: {new Date(m.timestamp).toLocaleDateString()}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2 text-sm text-slate-500 dark:text-zinc-400 mb-4 bg-slate-50 dark:bg-zinc-800 p-3 rounded-lg border border-slate-100 dark:border-zinc-700">
                                            {m.email && <span className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400 dark:text-zinc-500" /> <span className="truncate">{m.email}</span></span>}
                                            {m.phone && <span className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400 dark:text-zinc-500" /> <span className="truncate">{m.phone}</span></span>}
                                        </div>

                                        <div className="flex items-center justify-between mb-4 mt-auto w-full">
                                            <span className="text-xs font-semibold uppercase tracking-wide bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full text-slate-500 dark:text-zinc-400">
                                                Participante
                                            </span>
                                            {m.status === 'APPROVED' ? (
                                                <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-full">
                                                    Activo
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-full">
                                                    Pendiente
                                                </span>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => handleDeleteMember(m)}
                                            disabled={deletingMember === m.id}
                                            className="w-full py-2 px-4 min-h-[44px] bg-white dark:bg-zinc-900 text-red-600 dark:text-red-400 font-semibold rounded-lg border border-red-200 dark:border-red-500/20 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center justify-center gap-2 transition-colors mt-2"
                                        >
                                            <Trash2 className="w-4 h-4" /> Eliminar
                                        </button>
                                    </div>
                                ))}
                                {filteredMembers.length === 0 && (
                                    <div className="py-12 text-center text-slate-400 dark:text-zinc-600 font-semibold">
                                        No se encontraron resultados
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- Main Grid View ---
    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-950 relative overflow-y-auto font-sans">
            {/* Header Section */}
            <div className="p-4 md:px-10 md:py-8 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest">
                                {categoryName || 'General'}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-widest border-l border-slate-200 dark:border-zinc-700 pl-2">Temporada 2026</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white uppercase tracking-tight leading-none">Mis Grupos</h1>
                        <p className="text-slate-500 dark:text-zinc-400 mt-2 font-medium text-sm max-w-lg">Gestiona tus células, revisa métricas y organiza tu comunidad con eficiencia total.</p>
                    </div>

                </div>

                {/* Filters Row */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl">
                        <button
                            onClick={() => setActiveFilter('active')}
                            className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${activeFilter === 'active'
                                ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                        >
                            Activos
                        </button>
                        <button
                            onClick={() => setActiveFilter('finished')}
                            className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${activeFilter === 'finished'
                                ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                        >
                            Finalizados
                        </button>
                    </div>

                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" strokeWidth={2.5} />
                        <input
                            type="text"
                            placeholder="Buscar grupo..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-4 focus:ring-slate-900/10 dark:focus:ring-white/10 transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-4 md:px-10 md:py-10 bg-slate-50 dark:bg-zinc-950">
                {filteredGroups.length === 0 ? (
                    <div className="text-center py-20 border border-dashed border-slate-300 dark:border-zinc-700 rounded-2xl">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Search className="w-8 h-8 text-slate-400 dark:text-zinc-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-tight mb-2">No se encontraron grupos</h3>
                        <p className="text-slate-500 dark:text-zinc-400 font-medium">Ajusta tus filtros o búsqueda para encontrar resultados.</p>
                    </div>
                ) : (
                    <div className={`grid gap-8 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
                        {filteredGroups.map(group => {
                            const approvedCount = (group.registrations || []).filter(r => r.status === 'APPROVED').length;
                            const isFull = (group.maxCapacity || group.maxMembers) ? approvedCount >= (group.maxCapacity || group.maxMembers!) : false;
                            const category = categories.find(c => c.id === group.categoryId)?.name || 'General';
                            const tagsList = getTagNames(group);

                            if (viewMode === 'table') {
                                // Simple Table Row Card
                                return (
                                    <div key={group.id} onClick={() => setSelectedGroup(group)} className="bg-white dark:bg-zinc-900 p-4 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between cursor-pointer hover:shadow-lg transition-all group gap-4 md:gap-0">
                                        <div className="flex items-center gap-4 w-full md:w-auto">
                                            <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden">
                                                {group.imageUrl ? <img src={group.imageUrl} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" /> : <Users className="w-8 h-8 text-slate-400 dark:text-zinc-500" />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight truncate">{group.name}</h3>
                                                <p className="text-sm font-medium text-slate-500 dark:text-zinc-400 truncate">{group.leaderName}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-row md:gap-8 gap-4 text-sm font-semibold text-slate-600 dark:text-zinc-300 uppercase tracking-wide w-full md:w-auto justify-between md:justify-start">
                                            <span className="flex items-center gap-2"><CalendarIcon className="w-4 h-4" /> {group.meetingDay}</span>
                                            <span className="flex items-center gap-2"><Users className="w-4 h-4" /> {approvedCount}/{group.maxCapacity || group.maxMembers || '∞'}</span>
                                        </div>
                                        <div className="hidden md:block p-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 group-hover:bg-emerald-500 group-hover:text-black transition-colors">
                                            <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
                                        </div>
                                    </div>
                                );
                            }

                            // Card View
                            return (
                                <article key={group.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl flex flex-col shadow-sm hover:shadow-lg transition-all duration-300 group overflow-hidden">
                                    {/* Image Area */}
                                    <div className="relative h-56 border-b border-slate-200 dark:border-zinc-800 overflow-hidden bg-slate-100 dark:bg-zinc-800">
                                        {group.imageUrl ? (
                                            <img
                                                src={group.imageUrl}
                                                alt={group.name}
                                                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-zinc-800">
                                                <Users className="w-16 h-16 text-slate-300 dark:text-zinc-700" />
                                            </div>
                                        )}

                                        <div className="absolute top-4 left-4">
                                            {isGroupFinished(group) ? (
                                                <span className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                                                    Finalizado
                                                </span>
                                            ) : isFull ? (
                                                <span className="bg-red-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                                                    Lleno
                                                </span>
                                            ) : (
                                                <span className="bg-emerald-400 text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                                                    Abierto
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Content Area */}
                                    <div className="p-6 flex-1 flex flex-col">
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            <span className="px-2.5 py-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold rounded-full uppercase tracking-widest">
                                                {category}
                                            </span>
                                            {tagsList.slice(0, 2).map((tag, i) => (
                                                <span key={i} className="px-2.5 py-1 border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-[10px] font-bold rounded-full uppercase tracking-widest">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>

                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 leading-none uppercase tracking-tight">{group.name}</h2>

                                        <div className="space-y-2 mb-6">
                                            <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 dark:text-zinc-400">
                                                <Clock className="w-4 h-4 text-slate-400 dark:text-zinc-500" strokeWidth={2.5} />
                                                <span className="uppercase tracking-wide">{group.meetingDay} {group.meetingTime}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 dark:text-zinc-400">
                                                <MapPin className="w-4 h-4 text-slate-400 dark:text-zinc-500" strokeWidth={2.5} />
                                                <span className="uppercase tracking-wide truncate max-w-[200px]">{group.location || 'Sin ubicación'}</span>
                                            </div>
                                        </div>

                                        {/* Footer */}
                                        <div className="mt-auto pt-6 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-sm text-slate-700 dark:text-zinc-300">
                                                    {(group.hostName || group.leaderName || '?').substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] uppercase text-slate-400 dark:text-zinc-500 font-bold tracking-widest">Anfitrión</span>
                                                    <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 truncate max-w-[100px]">{group.leaderName}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setSelectedGroup(group)}
                                                className="bg-emerald-400 text-black rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wide active:scale-[0.98] transition-all flex items-center gap-2 shadow-sm group-hover:bg-emerald-300"
                                            >
                                                Gestionar
                                                <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CoordinatorGroups;
