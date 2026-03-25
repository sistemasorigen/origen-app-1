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
            <div className="flex flex-col h-full bg-[#fdfdfd] overflow-y-auto font-sans">
                {/* Header & Breadcrumbs */}
                <header className="px-6 py-6 md:px-10 border-b-2 border-black bg-white">
                    <button
                        onClick={() => setSelectedGroup(null)}
                        className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-black transition-colors group"
                    >
                        <span className="w-8 h-8 rounded-full border-2 border-gray-200 group-hover:border-black flex items-center justify-center transition-colors">
                            <ArrowRight className="w-4 h-4 rotate-180" strokeWidth={3} />
                        </span>
                        Volver a Mis Grupos
                    </button>

                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="bg-black text-white text-[10px] font-black px-2 py-0.5 uppercase tracking-widest">
                                    {getCategoryName(selectedGroup)}
                                </span>
                                <span className={`text-[10px] font-black px-2 py-0.5 uppercase tracking-widest border-2 border-black ${isGroupFinished(selectedGroup) ? 'bg-gray-200 text-gray-600' : 'bg-emerald-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                                    }`}>
                                    {isGroupFinished(selectedGroup) ? 'Finalizado' : 'Activo'}
                                </span>
                            </div>
                            <h1 className="text-3xl md:text-5xl font-black text-black uppercase tracking-tighter leading-none">{selectedGroup.name}</h1>
                            <div className="flex items-center gap-4 mt-3 text-sm font-bold text-gray-500">
                                <span className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 border-2 border-transparent">
                                    <Clock className="w-4 h-4 text-black" strokeWidth={2.5} />
                                    {selectedGroup.meetingDay} {selectedGroup.meetingTime}
                                </span>
                                <span className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 border-2 border-transparent">
                                    <MapPin className="w-4 h-4 text-black" strokeWidth={2.5} />
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
                        <div className="bg-white p-6 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-emerald-400 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                    <Users className="w-6 h-6 text-black" strokeWidth={2.5} />
                                </div>
                                <div className="text-right">
                                    <h3 className="text-4xl font-black text-black">{approvedMembers.length}</h3>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Inscriptos</p>
                                </div>
                            </div>
                            <div className="w-full bg-gray-100 h-2 border border-black mt-2">
                                <div
                                    className="bg-emerald-400 h-full border-r border-black"
                                    style={{ width: `${Math.min(((approvedMembers.length) / (selectedGroup.maxCapacity || selectedGroup.maxMembers || 20)) * 100, 100)}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Card 2: Capacidad */}
                        <div className="bg-white p-6 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-lime-300 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                    <CheckCircle className="w-6 h-6 text-black" strokeWidth={2.5} />
                                </div>
                                <div className="text-right">
                                    <h3 className="text-4xl font-black text-black">{selectedGroup.maxCapacity || selectedGroup.maxMembers || '∞'}</h3>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Capacidad Máx</p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-1 mt-2">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className={`w-2 h-2 border border-black ${i < 3 ? 'bg-lime-300' : 'bg-white'}`}></div>
                                ))}
                            </div>
                        </div>

                        {/* Card 3: Bajas */}
                        <div className="bg-white p-6 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-rose-400 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                    <UserMinus className="w-6 h-6 text-black" strokeWidth={2.5} />
                                </div>
                                <div className="text-right">
                                    <h3 className="text-4xl font-black text-black">
                                        {(selectedGroup.registrations || []).filter(r => r.status === 'REJECTED').length}
                                    </h3>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Bajas Totales</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Members Section */}
                    <div className="border-2 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                        {/* Toolbar */}
                        <div className="p-5 border-b-2 border-black flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white">
                            <h2 className="text-xl font-black text-black uppercase tracking-tighter flex items-center gap-3">
                                <Users className="w-6 h-6" strokeWidth={2.5} />
                                Miembros del Grupo
                            </h2>
                            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                <div className="relative w-full sm:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black w-4 h-4" strokeWidth={2.5} />
                                    <input
                                        className="w-full pl-10 pr-4 py-2 bg-white border-2 border-black text-sm font-bold text-black placeholder-gray-400 focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                                        placeholder="BUSCAR MIEMBRO..."
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
                                    <thead className="bg-black text-white">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-black uppercase tracking-wider">Miembro</th>
                                            <th className="px-6 py-4 text-xs font-black uppercase tracking-wider">Contacto</th>
                                            <th className="px-6 py-4 text-xs font-black uppercase tracking-wider">Rol</th>
                                            <th className="px-6 py-4 text-xs font-black uppercase tracking-wider">Estado</th>
                                            <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y-2 divide-gray-100">
                                        {filteredMembers.map(m => (
                                            <tr key={m.id} className="hover:bg-emerald-50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 border-2 border-black flex items-center justify-center font-black text-sm bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                                            {(m.firstName || '?').substring(0, 1)}{(m.lastName || '?').substring(0, 1)}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-black uppercase">{m.firstName} {m.lastName}</div>
                                                            <div className="text-xs text-gray-500 font-bold">Unido: {new Date(m.timestamp).toLocaleDateString()}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm font-medium text-gray-600">
                                                    <div className="flex flex-col gap-1">
                                                        {m.email && <span className="flex items-center gap-2"><Mail className="w-3 h-3" /> {m.email}</span>}
                                                        {m.phone && <span className="flex items-center gap-2"><Phone className="w-3 h-3" /> {m.phone}</span>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-xs font-bold uppercase tracking-wider bg-gray-100 px-2 py-1 border border-gray-200 text-gray-600">
                                                        Participante
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {m.status === 'APPROVED' ? (
                                                        <span className="inline-flex items-center px-3 py-1 text-[10px] font-black uppercase tracking-wider bg-emerald-300 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]">
                                                            Activo
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-3 py-1 text-[10px] font-black uppercase tracking-wider bg-amber-300 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]">
                                                            Pendiente
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => handleDeleteMember(m)}
                                                        disabled={deletingMember === m.id}
                                                        className="p-2 min-h-[44px] border-2 border-transparent hover:border-black hover:bg-red-50 hover:shadow-[2px_2px_0px_0px_#ef4444] transition-all text-gray-400 hover:text-red-500"
                                                    >
                                                        <Trash2 className="w-5 h-5" strokeWidth={2.5} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredMembers.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-bold uppercase">
                                                    No se encontraron resultados
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Cards Alternative */}
                            <div className="md:hidden flex flex-col gap-4 p-4 bg-[#fdfdfd]">
                                {filteredMembers.map(m => (
                                    <div key={m.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col relative w-full">
                                        <div className="flex items-start justify-between mb-3 w-full">
                                            <div className="flex items-center gap-3 w-full">
                                                <div className="w-12 h-12 bg-white border-2 border-gray-100 rounded-lg flex items-center justify-center font-bold text-gray-700 text-lg shadow-sm">
                                                    {(m.firstName || '?').substring(0, 1)}{(m.lastName || '?').substring(0, 1)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-lg font-bold text-gray-900 uppercase truncate">{m.firstName} {m.lastName}</div>
                                                    <div className="text-xs text-gray-400">Unido: {new Date(m.timestamp).toLocaleDateString()}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2 text-sm text-gray-500 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                            {m.email && <span className="flex items-center gap-2"><Mail className="w-4 h-4 text-gray-400" /> <span className="truncate">{m.email}</span></span>}
                                            {m.phone && <span className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" /> <span className="truncate">{m.phone}</span></span>}
                                        </div>

                                        <div className="flex items-center justify-between mb-4 mt-auto w-full">
                                            <span className="text-xs font-bold uppercase tracking-wider bg-gray-100 px-2 py-1 rounded text-gray-600">
                                                Participante
                                            </span>
                                            {m.status === 'APPROVED' ? (
                                                <span className="inline-flex items-center px-3 py-1 text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 rounded-full">
                                                    Activo
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-3 py-1 text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 rounded-full">
                                                    Pendiente
                                                </span>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => handleDeleteMember(m)}
                                            disabled={deletingMember === m.id}
                                            className="w-full py-2 px-4 min-h-[44px] bg-white text-red-600 font-bold rounded-lg border border-red-200 hover:bg-red-50 flex items-center justify-center gap-2 transition-colors mt-2"
                                        >
                                            <Trash2 className="w-4 h-4" /> Eliminar
                                        </button>
                                    </div>
                                ))}
                                {filteredMembers.length === 0 && (
                                    <div className="py-12 text-center text-gray-400 font-bold uppercase">
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
        <div className="flex flex-col h-full bg-[#fdfdfd] relative overflow-y-auto font-sans">
            {/* Header Section */}
            <div className="p-4 md:px-10 md:py-8 border-b-2 border-black bg-white">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-black text-white text-[10px] font-black px-2 py-0.5 uppercase tracking-widest">
                                {categoryName || 'General'}
                            </span>
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest border-l-2 border-gray-300 pl-2">Temporada 2026</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-black uppercase tracking-tighter leading-none">Mis Grupos</h1>
                        <p className="text-gray-500 mt-2 font-bold text-sm max-w-lg">Gestiona tus células, revisa métricas y organiza tu comunidad con eficiencia total.</p>
                    </div>

                </div>

                {/* Filters Row */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex p-1 bg-gray-100 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <button
                            onClick={() => setActiveFilter('active')}
                            className={`px-6 py-2 text-sm font-black uppercase tracking-wider transition-all rounded-md ${activeFilter === 'active'
                                ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)]'
                                : 'text-gray-500 hover:text-black'
                                }`}
                        >
                            Activos
                        </button>
                        <button
                            onClick={() => setActiveFilter('finished')}
                            className={`px-6 py-2 text-sm font-black uppercase tracking-wider transition-all rounded-md ${activeFilter === 'finished'
                                ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)]'
                                : 'text-gray-500 hover:text-black'
                                }`}
                        >
                            Finalizados
                        </button>
                    </div>

                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black" strokeWidth={2.5} />
                        <input
                            type="text"
                            placeholder="BUSCAR GRUPO..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-black text-sm font-bold placeholder-gray-400 focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-4 md:px-10 md:py-10 bg-[#fdfdfd]">
                {filteredGroups.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed border-gray-300 rounded-xl">
                        <div className="w-20 h-20 bg-gray-100 border-2 border-black rounded-full flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <Search className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-2xl font-black text-black uppercase tracking-tight mb-2">No se encontraron grupos</h3>
                        <p className="text-gray-500 font-bold">Ajusta tus filtros o búsqueda para encontrar resultados.</p>
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
                                    <div key={group.id} onClick={() => setSelectedGroup(group)} className="bg-white p-4 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row items-start md:items-center justify-between cursor-pointer hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all group gap-4 md:gap-0">
                                        <div className="flex items-center gap-4 w-full md:w-auto">
                                            <div className="w-16 h-16 bg-gray-100 border-2 border-black flex-shrink-0 flex items-center justify-center overflow-hidden">
                                                {group.imageUrl ? <img src={group.imageUrl} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" /> : <Users className="w-8 h-8 text-black" />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="text-xl font-black text-black uppercase tracking-tight truncate">{group.name}</h3>
                                                <p className="text-sm font-bold text-gray-500 truncate">{group.leaderName}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-row md:gap-8 gap-4 text-sm font-bold text-black uppercase tracking-wide w-full md:w-auto justify-between md:justify-start">
                                            <span className="flex items-center gap-2"><CalendarIcon className="w-4 h-4" /> {group.meetingDay}</span>
                                            <span className="flex items-center gap-2"><Users className="w-4 h-4" /> {approvedCount}/{group.maxCapacity || group.maxMembers || '∞'}</span>
                                        </div>
                                        <div className="hidden md:block p-2 border-2 border-black bg-black text-white group-hover:bg-emerald-500 group-hover:text-black transition-colors">
                                            <ArrowRight className="w-5 h-5" strokeWidth={3} />
                                        </div>
                                    </div>
                                );
                            }

                            // Card View
                            return (
                                <article key={group.id} className="bg-white border-2 border-black flex flex-col shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-2 hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 group">
                                    {/* Image Area */}
                                    <div className="relative h-56 border-b-2 border-black overflow-hidden bg-gray-200">
                                        {group.imageUrl ? (
                                            <img
                                                src={group.imageUrl}
                                                alt={group.name}
                                                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-100 pattern-grid-lg">
                                                <Users className="w-16 h-16 text-gray-300" />
                                            </div>
                                        )}

                                        <div className="absolute top-4 left-4">
                                            {isGroupFinished(group) ? (
                                                <span className="bg-gray-900 text-white text-[10px] font-black px-3 py-1 uppercase tracking-widest border-2 border-white shadow-sm">
                                                    FINALIZADO
                                                </span>
                                            ) : isFull ? (
                                                <span className="bg-red-500 text-white text-[10px] font-black px-3 py-1 uppercase tracking-widest border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                                    LLENO
                                                </span>
                                            ) : (
                                                <span className="bg-emerald-400 text-black text-[10px] font-black px-3 py-1 uppercase tracking-widest border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                                    ABIERTO
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Content Area */}
                                    <div className="p-6 flex-1 flex flex-col">
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            <span className="px-2 py-0.5 bg-black text-white text-[10px] font-black uppercase tracking-widest">
                                                {category}
                                            </span>
                                            {tagsList.slice(0, 2).map((tag, i) => (
                                                <span key={i} className="px-2 py-0.5 border-2 border-black bg-white text-black text-[10px] font-black uppercase tracking-widest">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>

                                        <h2 className="text-2xl font-black text-black mb-4 leading-none uppercase tracking-tighter">{group.name}</h2>

                                        <div className="space-y-2 mb-6">
                                            <div className="flex items-center gap-3 text-xs font-bold text-gray-600">
                                                <Clock className="w-4 h-4 text-black" strokeWidth={2.5} />
                                                <span className="uppercase tracking-wide">{group.meetingDay} {group.meetingTime}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs font-bold text-gray-600">
                                                <MapPin className="w-4 h-4 text-black" strokeWidth={2.5} />
                                                <span className="uppercase tracking-wide truncate max-w-[200px]">{group.location || 'Sin ubicación'}</span>
                                            </div>
                                        </div>

                                        {/* Footer */}
                                        <div className="mt-auto pt-6 border-t-2 border-black flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white border-2 border-black flex items-center justify-center font-black text-sm text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                                    {(group.hostName || group.leaderName || '?').substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] uppercase text-gray-500 font-black tracking-widest">Anfitrión</span>
                                                    <span className="text-xs font-bold text-black uppercase truncate max-w-[100px]">{group.leaderName}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setSelectedGroup(group)}
                                                className="bg-emerald-400 text-black border-2 border-black px-5 py-2.5 text-xs font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all flex items-center gap-2 group-hover:bg-emerald-300"
                                            >
                                                Gestionar
                                                <ArrowRight className="w-3.5 h-3.5" strokeWidth={3} />
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
