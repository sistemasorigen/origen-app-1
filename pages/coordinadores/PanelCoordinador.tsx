import React, { useState, useMemo } from 'react';
import {
    Users,
    UserMinus,
    TrendingUp,
    TrendingDown,
    UserPlus,
    BarChart3,
    History,
    ArrowUpRight
} from 'lucide-react';
import { Group, GroupCategory, DropoutRequest } from '../../types';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';

interface CoordinatorDashboardProps {
    groups: Group[];
    dropouts: DropoutRequest[];
    attendanceData: any[]; // Kept for prop compatibility
    categories: GroupCategory[];
    categoryName: string;
    onRefresh: () => void;
}

const CoordinatorDashboard: React.FC<CoordinatorDashboardProps> = ({
    groups,
    dropouts,
    categoryName,
    onRefresh
}) => {
    const [chartMode, setChartMode] = useState<'inscriptos' | 'bajas'>('inscriptos');
    const [activeFilter, setActiveFilter] = useState<'active' | 'finished'>('active');
    const [activitySearch, setActivitySearch] = useState('');

    // --- Helpers ---
    const isGroupFinished = (g: Group) => {
        if ((g.status as string) === 'finished') return true;
        if (!g.endDate) return false;
        const today = new Date().toISOString().split('T')[0];
        return g.endDate < today;
    };

    // --- KPIs Calculation ---

    // Base filter for current view (KPIs and Chart)
    const analyzedGroups = useMemo(() => {
        let result = groups.filter(g => g.status === 'approved');
        if (activeFilter === 'finished') {
            return result.filter(g => isGroupFinished(g));
        }
        return result.filter(g => !isGroupFinished(g));
    }, [groups, activeFilter]);

    const totalGroups = analyzedGroups.length;

    const totalMembers = analyzedGroups.reduce((sum, g) => {
        const count = g.membersCount || (g.registrations || []).filter(r => r.status === 'APPROVED').length || 0;
        return sum + count;
    }, 0);

    const filteredDropouts = useMemo(() => {
        const analyzedGroupIds = new Set(analyzedGroups.map(g => g.id));
        return dropouts.filter(d => analyzedGroupIds.has(d.groupId));
    }, [dropouts, analyzedGroups]);

    const totalDropouts = filteredDropouts.length;

    // --- Chart Data ---
    const chartData = useMemo(() => {
        if (chartMode === 'inscriptos') {
            // Sort by member count descending for better visualization
            return [...analyzedGroups]
                .map(g => ({
                    name: (g.name || '').length > 15 ? (g.name || '').substring(0, 15) + '...' : (g.name || 'Sin nombre'),
                    fullName: g.name || 'Sin nombre',
                    value: g.membersCount || (g.registrations || []).filter(r => r.status === 'APPROVED').length || 0,
                }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 12); // Top 12 groups
        } else {
            // Group dropouts by group name
            const byGroup: Record<string, number> = {};
            dropouts.forEach(d => {
                const name = d.groupName || 'Desconocido';
                byGroup[name] = (byGroup[name] || 0) + 1;
            });
            return Object.entries(byGroup)
                .map(([name, value]) => ({
                    name: (name || '').length > 15 ? (name || '').substring(0, 15) + '...' : (name || 'Sin nombre'),
                    fullName: name || 'Sin nombre',
                    value
                }))
                .sort((a, b) => b.value - a.value);
        }
    }, [chartMode, analyzedGroups, filteredDropouts]);

    // --- Activity Log ---
    const activityLog = useMemo(() => {
        const items: { id: string; memberName: string; action: string; groupName: string; date: string; type: 'dropout' | 'registration'; initials: string }[] = [];

        // Add dropouts
        dropouts.forEach(d => {
            const name = d.targetUserName || 'Miembro';
            items.push({
                id: d.id,
                memberName: name,
                initials: name ? name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??',
                action: d.requestType === 'SELF_DROPOUT' ? 'Baja voluntaria' : 'Baja por anfitrión',
                groupName: d.groupName || 'Grupo desconocido',
                date: d.createdAt,
                type: 'dropout'
            });
        });

        // Add recent registrations
        analyzedGroups.forEach(g => {
            (g.registrations || []).forEach(r => {
                if (r.status === 'APPROVED') {
                    const name = `${r.firstName} ${r.lastName}`;
                    items.push({
                        id: r.id,
                        memberName: name,
                        initials: name ? name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??',
                        action: 'Nuevo registro',
                        groupName: g.name || 'Agrupación',
                        date: r.createdAt || '',
                        type: 'registration'
                    });
                }
            });
        });

        // Sort by date, newest first
        items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Filter by search
        if (activitySearch) {
            const term = activitySearch.toLowerCase();
            return items.filter(i =>
                i.memberName.toLowerCase().includes(term) ||
                i.groupName.toLowerCase().includes(term)
            );
        }

        return items;
    }, [dropouts, analyzedGroups, activitySearch]);

    // --- Pagination ---
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    const totalPages = Math.ceil(activityLog.length / ITEMS_PER_PAGE);
    const paginatedActivity = activityLog.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    // Format relative time (approximate)
    const formatRelTime = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));

        if (diffHrs < 24) return `Hace ${diffHrs || 1} horas`;
        const diffDays = Math.floor(diffHrs / 24);
        if (diffDays === 1) return 'Ayer';
        return `Hace ${diffDays} días`;
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900 text-white p-4 rounded-xl shadow-lg">
                    <p className="font-bold text-sm mb-1 uppercase tracking-wide">{payload[0]?.payload?.fullName || label}</p>
                    <p className="text-xs text-slate-300 uppercase font-semibold tracking-widest mb-2">
                        {chartMode === 'inscriptos' ? 'Miembros Activos' : 'Solicitudes de Baja'}
                    </p>
                    <p className="text-3xl font-black text-[#10b981]">
                        {payload[0]?.value}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-950 font-sans">

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 md:px-6 md:pt-8 md:pb-20">
                {/* KPI Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    {/* KPI Card 1: Grupos */}
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Users size={120} strokeWidth={1.5} className="text-black dark:text-white" />
                        </div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-3 bg-emerald-400 rounded-2xl text-black">
                                    <Users className="w-6 h-6" strokeWidth={2.5} />
                                </div>
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3 py-1 rounded-full">
                                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                                    <span>Activos</span>
                                </span>
                            </div>
                            <h3 className="text-slate-400 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Total Grupos</h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-black text-slate-900 dark:text-white tracking-tight">{totalGroups}</span>
                            </div>
                        </div>
                    </div>

                    {/* KPI Card 2: Inscriptos */}
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <UserPlus size={120} strokeWidth={1.5} className="text-emerald-500" />
                        </div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-3 bg-lime-300 rounded-2xl text-black">
                                    <UserPlus className="w-6 h-6" strokeWidth={2.5} />
                                </div>
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3 py-1 rounded-full">
                                    <TrendingUp className="w-3 h-3 text-lime-300" />
                                    <span>Promedio</span>
                                </span>
                            </div>
                            <h3 className="text-slate-400 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Total Inscriptos</h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-black text-slate-900 dark:text-white tracking-tight">{totalMembers}</span>
                                <span className="text-sm font-semibold text-slate-400 dark:text-zinc-500">~{Math.round(totalMembers / (totalGroups || 1))} / grupo</span>
                            </div>
                        </div>
                    </div>

                    {/* KPI Card 3: Bajas */}
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <UserMinus size={120} strokeWidth={1.5} className="text-red-500" />
                        </div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-3 bg-red-400 rounded-2xl text-black">
                                    <UserMinus className="w-6 h-6" strokeWidth={2.5} />
                                </div>
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3 py-1 rounded-full">
                                    <TrendingDown className="w-3 h-3 text-red-400" />
                                    <span>{((totalDropouts / totalMembers) * 100).toFixed(1)}% Tasa</span>
                                </span>
                            </div>
                            <h3 className="text-slate-400 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Solicitudes de Baja</h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-black text-slate-900 dark:text-white tracking-tight">{totalDropouts}</span>
                                <span className="text-sm font-semibold text-slate-400 dark:text-zinc-500">pendientes</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Analysis Section with Chart */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 md:p-8 min-h-[400px] md:min-h-[500px] flex flex-col relative overflow-hidden mb-24 md:mb-10">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 via-lime-300 to-slate-900 dark:to-white"></div>

                    {/* Chart Header & Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8 mt-2">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                                Análisis de Datos
                                <BarChart3 className="w-6 h-6 text-slate-900 dark:text-white" strokeWidth={2.5} />
                            </h2>
                            <p className="text-sm font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-1">
                                {chartMode === 'inscriptos' ? 'Top Grupos / Miembros' : 'Grupos / Solicitudes de Baja'}
                            </p>
                        </div>
                        {/* Filter Toggles */}
                        <div className="flex flex-wrap gap-4 items-center">
                            {/* Activos/Finalizados Filter */}
                            <div className="flex p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl">
                                <button
                                    onClick={() => setActiveFilter('active')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${activeFilter === 'active'
                                        ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm'
                                        : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                >
                                    Activos
                                </button>
                                <button
                                    onClick={() => setActiveFilter('finished')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${activeFilter === 'finished'
                                        ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm'
                                        : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                >
                                    Finalizados
                                </button>
                            </div>

                            {/* Inscriptos/Bajas Toggle */}
                            <div className="flex p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl">
                                <button
                                    onClick={() => setChartMode('inscriptos')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${chartMode === 'inscriptos'
                                        ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm'
                                        : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                >
                                    Inscriptos
                                </button>
                                <button
                                    onClick={() => setChartMode('bajas')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${chartMode === 'bajas'
                                        ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm'
                                        : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                >
                                    Bajas
                                </button>
                            </div>
                        </div>

                        {/* Chart Area */}
                        <div className="w-full h-[300px] bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 relative mt-2">
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }} barGap={0}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                                            tickLine={false}
                                            tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                                            tickFormatter={(val) => `${val}`.toUpperCase()}
                                            dy={10}
                                        />
                                        <YAxis
                                            axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                                            tickLine={false}
                                            tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                                        />
                                        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={<CustomTooltip />} />
                                        <Bar
                                            dataKey="value"
                                            radius={[4, 4, 0, 0]}
                                        >
                                            {chartData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={chartMode === 'inscriptos' ? '#10b981' : '#ef4444'}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-zinc-600">
                                    <BarChart3 className="w-16 h-16 mb-4 opacity-40" />
                                    <span className="font-bold uppercase tracking-wide text-base opacity-60">No hay datos suficientes</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Recent Activity Table */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                            <div className="p-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg">
                                <History className="w-4 h-4" strokeWidth={2.5} />
                            </div>
                            Feed de Actividad
                        </h3>
                        <button className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 transition-colors">
                            Ver historial completo
                            <ArrowUpRight className="w-3 h-3" />
                        </button>
                    </div>

                    {/* Mobile Activity Cards (Visible on Mobile) */}
                    <div className="md:hidden flex flex-col gap-4 p-4 bg-slate-50 dark:bg-zinc-950">
                        {paginatedActivity.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 dark:text-zinc-600 font-bold uppercase tracking-wide">
                                Sin actividad reciente
                            </div>
                        ) : (
                            paginatedActivity.map(item => (
                                <div key={item.id} className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-slate-100 dark:border-zinc-800 p-4 flex flex-col gap-3 relative overflow-hidden w-full">
                                    {/* Status Stripe */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.type === 'registration' ? 'bg-emerald-400' : 'bg-orange-400'}`} />

                                    <div className="flex items-center gap-3">
                                        <div className={`h-12 w-12 min-w-[3rem] rounded-full flex items-center justify-center text-lg font-bold shadow-sm ${item.type === 'registration' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20' : 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-100 dark:border-orange-500/20'
                                            }`}>
                                            {item.initials}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start w-full">
                                                <p className="text-lg font-bold text-slate-900 dark:text-white truncate pr-2">{item.memberName}</p>
                                                <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 whitespace-nowrap mt-1">{formatRelTime(item.date)}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <div className={`w-1.5 h-1.5 rounded-full ${item.type === 'registration' ? 'bg-emerald-500' : 'bg-orange-500'}`} />
                                                <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium truncate">{item.groupName}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-sm text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800 p-2 rounded-lg border border-slate-100 dark:border-zinc-700 font-medium text-center self-start px-4">
                                        {item.action}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Desktop Activity Table (Hidden on Mobile) */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase bg-slate-50 dark:bg-zinc-800/50 font-bold tracking-widest">
                                <tr>
                                    <th className="px-6 py-4">Miembro</th>
                                    <th className="px-6 py-4">Acción</th>
                                    <th className="px-6 py-4">Grupo</th>
                                    <th className="px-6 py-4">Fecha</th>
                                    <th className="px-6 py-4 text-right">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {paginatedActivity.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center text-slate-400 dark:text-zinc-600 font-bold uppercase tracking-wide">
                                            Sin actividad reciente
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedActivity.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors border-b border-slate-100 dark:border-zinc-800 last:border-0 group">
                                            <td className="px-6 py-4 font-bold text-slate-900 dark:text-white flex items-center gap-4">
                                                <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold ${item.type === 'registration'
                                                    ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'
                                                    : 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400'
                                                    }`}>
                                                    {item.initials}
                                                </div>
                                                <span className="group-hover:translate-x-1 transition-transform">{item.memberName}</span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 dark:text-zinc-400 font-semibold uppercase text-xs tracking-wide">{item.action}</td>
                                            <td className="px-6 py-4 text-slate-900 dark:text-white font-semibold">{item.groupName}</td>
                                            <td className="px-6 py-4 text-slate-400 dark:text-zinc-500 font-mono text-xs">{formatRelTime(item.date)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`inline-flex px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${item.type === 'registration'
                                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                                    : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                                    }`}>
                                                    {item.type === 'registration' ? 'Completado' : 'Pendiente'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between font-bold">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-slate-900 hover:border-slate-900 dark:hover:border-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                Anterior
                            </button>
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                                Página {currentPage} de {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-slate-900 hover:border-slate-900 dark:hover:border-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                Siguiente
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CoordinatorDashboard;
