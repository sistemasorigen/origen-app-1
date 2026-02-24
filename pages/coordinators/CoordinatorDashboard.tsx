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
                <div className="bg-black text-white p-4 rounded-none border-2 border-black shadow-[4px_4px_0px_0px_#10b981]">
                    <p className="font-black text-sm mb-1 uppercase tracking-wider">{payload[0]?.payload?.fullName || label}</p>
                    <p className="text-xs text-gray-300 uppercase font-bold tracking-widest mb-2">
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
        <div className="flex flex-col h-full bg-[#f8fafc] font-sans">

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 md:px-6 md:pt-8 md:pb-20">
                {/* KPI Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    {/* KPI Card 1: Grupos */}
                    <div className="bg-white border-2 border-black rounded-xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Users size={120} strokeWidth={1.5} className="text-black" />
                        </div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-3 bg-emerald-400 border-2 border-black rounded-lg text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                    <Users className="w-6 h-6" strokeWidth={2.5} />
                                </div>
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-black text-white px-3 py-1 rounded-full border-2 border-transparent">
                                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                                    <span>Activos</span>
                                </span>
                            </div>
                            <h3 className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Total Grupos</h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-black text-black tracking-tighter">{totalGroups}</span>
                            </div>
                        </div>
                    </div>

                    {/* KPI Card 2: Inscriptos */}
                    <div className="bg-white border-2 border-black rounded-xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <UserPlus size={120} strokeWidth={1.5} className="text-emerald-500" />
                        </div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-3 bg-lime-300 border-2 border-black rounded-lg text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                    <UserPlus className="w-6 h-6" strokeWidth={2.5} />
                                </div>
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-black text-white px-3 py-1 rounded-full border-2 border-transparent">
                                    <TrendingUp className="w-3 h-3 text-lime-300" />
                                    <span>Promedio</span>
                                </span>
                            </div>
                            <h3 className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Total Inscriptos</h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-black text-black tracking-tighter">{totalMembers}</span>
                                <span className="text-sm font-bold text-gray-400">~{Math.round(totalMembers / (totalGroups || 1))} / grupo</span>
                            </div>
                        </div>
                    </div>

                    {/* KPI Card 3: Bajas */}
                    <div className="bg-white border-2 border-black rounded-xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <UserMinus size={120} strokeWidth={1.5} className="text-red-500" />
                        </div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-3 bg-red-400 border-2 border-black rounded-lg text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                    <UserMinus className="w-6 h-6" strokeWidth={2.5} />
                                </div>
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-black text-white px-3 py-1 rounded-full border-2 border-transparent">
                                    <TrendingDown className="w-3 h-3 text-red-400" />
                                    <span>{((totalDropouts / totalMembers) * 100).toFixed(1)}% Tasa</span>
                                </span>
                            </div>
                            <h3 className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Solicitudes de Baja</h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-black text-black tracking-tighter">{totalDropouts}</span>
                                <span className="text-sm font-bold text-gray-400">pendientes</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Analysis Section with Chart */}
                <div className="bg-white border-2 border-black rounded-xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6 md:p-8 min-h-[400px] md:min-h-[500px] flex flex-col relative overflow-hidden mb-24 md:mb-10">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 via-lime-300 to-black"></div>

                    {/* Chart Header & Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8 mt-2">
                        <div>
                            <h2 className="text-2xl font-black text-black uppercase tracking-tighter flex items-center gap-2">
                                Análisis de Datos
                                <BarChart3 className="w-6 h-6 text-black" strokeWidth={3} />
                            </h2>
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mt-1">
                                {chartMode === 'inscriptos' ? 'Top Grupos / Miembros' : 'Grupos / Solicitudes de Baja'}
                            </p>
                        </div>
                        {/* Filter Toggles */}
                        <div className="flex flex-wrap gap-4 items-center">
                            {/* Activos/Finalizados Filter */}
                            <div className="flex p-1 bg-gray-100 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <button
                                    onClick={() => setActiveFilter('active')}
                                    className={`px-4 py-1.5 text-xs font-black uppercase tracking-wider transition-all rounded-md ${activeFilter === 'active'
                                        ? 'bg-black text-white'
                                        : 'text-gray-500 hover:text-black'
                                        }`}
                                >
                                    Activos
                                </button>
                                <button
                                    onClick={() => setActiveFilter('finished')}
                                    className={`px-4 py-1.5 text-xs font-black uppercase tracking-wider transition-all rounded-md ${activeFilter === 'finished'
                                        ? 'bg-black text-white'
                                        : 'text-gray-500 hover:text-black'
                                        }`}
                                >
                                    Finalizados
                                </button>
                            </div>

                            {/* Inscriptos/Bajas Toggle */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setChartMode('inscriptos')}
                                    className={`px-6 py-2.5 rounded-lg text-sm font-black uppercase tracking-wide border-2 border-black transition-all ${chartMode === 'inscriptos'
                                        ? 'bg-emerald-400 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-2px] translate-y-[-2px]'
                                        : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                                        }`}
                                >
                                    Inscriptos
                                </button>
                                <button
                                    onClick={() => setChartMode('bajas')}
                                    className={`px-6 py-2.5 rounded-lg text-sm font-black uppercase tracking-wide border-2 border-black transition-all ${chartMode === 'bajas'
                                        ? 'bg-red-400 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-2px] translate-y-[-2px]'
                                        : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                                        }`}
                                >
                                    Bajas
                                </button>
                            </div>
                        </div>

                        {/* Chart Area */}
                        <div className="w-full h-[300px] bg-gray-50 border-2 border-black rounded-lg p-4 relative mt-2">
                            {/* Retro Grid Lines Effect */}
                            <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }} barGap={0}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={{ stroke: '#000', strokeWidth: 2 }}
                                            tickLine={false}
                                            tick={{ fill: '#000', fontSize: 10, fontWeight: 800 }}
                                            tickFormatter={(val) => `${val}`.toUpperCase()}
                                            dy={10}
                                        />
                                        <YAxis
                                            axisLine={{ stroke: '#000', strokeWidth: 2 }}
                                            tickLine={false}
                                            tick={{ fill: '#000', fontSize: 10, fontWeight: 800 }}
                                        />
                                        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} content={<CustomTooltip />} />
                                        <Bar
                                            dataKey="value"
                                            radius={[4, 4, 0, 0]}
                                            stroke="#000"
                                            strokeWidth={2}
                                        >
                                            {chartData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={chartMode === 'inscriptos' ? '#10b981' : '#ef4444'}
                                                    className="filter drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]"
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                    <BarChart3 className="w-16 h-16 mb-4 opacity-20 text-black" />
                                    <span className="font-black text-black uppercase tracking-widest text-lg opacity-50">No hay datos suficientes</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Recent Activity Table */}
                <div className="bg-white border-2 border-black rounded-xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="px-6 py-5 border-b-2 border-black flex justify-between items-center bg-white">
                        <h3 className="text-lg font-black text-black uppercase tracking-tighter flex items-center gap-3">
                            <div className="p-1.5 bg-black text-white rounded shadow-[2px_2px_0px_0px_#10b981]">
                                <History className="w-4 h-4" strokeWidth={3} />
                            </div>
                            Feed de Actividad
                        </h3>
                        <button className="text-xs font-black uppercase tracking-wider text-black hover:text-emerald-600 flex items-center gap-1 transition-colors border-b-2 border-black hover:border-emerald-600 pb-0.5">
                            Ver historial completo
                            <ArrowUpRight className="w-3 h-3" />
                        </button>
                    </div>

                    {/* Mobile Activity Cards (Visible on Mobile) */}
                    <div className="md:hidden flex flex-col gap-4 p-4 bg-[#fdfdfd]">
                        {paginatedActivity.length === 0 ? (
                            <div className="py-12 text-center text-gray-400 font-bold uppercase tracking-wide">
                                Sin actividad reciente
                            </div>
                        ) : (
                            paginatedActivity.map(item => (
                                <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-3 relative overflow-hidden w-full">
                                    {/* Status Stripe */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.type === 'registration' ? 'bg-emerald-400' : 'bg-orange-400'}`} />

                                    <div className="flex items-center gap-3">
                                        <div className={`h-12 w-12 min-w-[3rem] rounded-full flex items-center justify-center text-lg font-bold shadow-sm ${item.type === 'registration' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-orange-50 text-orange-700 border border-orange-100'
                                            }`}>
                                            {item.initials}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start w-full">
                                                <p className="text-lg font-bold text-gray-900 truncate pr-2">{item.memberName}</p>
                                                <span className="text-[10px] font-mono text-gray-400 whitespace-nowrap mt-1">{formatRelTime(item.date)}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <div className={`w-1.5 h-1.5 rounded-full ${item.type === 'registration' ? 'bg-emerald-500' : 'bg-orange-500'}`} />
                                                <p className="text-sm text-gray-500 font-medium truncate">{item.groupName}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-sm text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100 font-medium text-center self-start px-4">
                                        {item.action}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Desktop Activity Table (Hidden on Mobile) */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-white uppercase bg-black font-black tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Miembro</th>
                                    <th className="px-6 py-4">Acción</th>
                                    <th className="px-6 py-4">Grupo</th>
                                    <th className="px-6 py-4">Fecha</th>
                                    <th className="px-6 py-4 text-right">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y-2 divide-gray-100 dark:divide-gray-800">
                                {paginatedActivity.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center text-gray-400 font-bold uppercase tracking-wide">
                                            Sin actividad reciente
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedActivity.map(item => (
                                        <tr key={item.id} className="hover:bg-emerald-50 transition-colors border-b border-gray-100 last:border-0 group">
                                            <td className="px-6 py-4 font-bold text-black flex items-center gap-4">
                                                <div className={`h-10 w-10 border-2 border-black flex items-center justify-center text-xs font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${item.type === 'registration'
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : 'bg-orange-100 text-orange-800'
                                                    }`}>
                                                    {item.initials}
                                                </div>
                                                <span className="group-hover:translate-x-1 transition-transform">{item.memberName}</span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 font-bold uppercase text-xs tracking-wide">{item.action}</td>
                                            <td className="px-6 py-4 text-black font-bold">{item.groupName}</td>
                                            <td className="px-6 py-4 text-gray-400 font-mono text-xs">{formatRelTime(item.date)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`inline-flex px-3 py-1 text-[10px] font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] ${item.type === 'registration'
                                                    ? 'bg-emerald-300 text-black'
                                                    : 'bg-yellow-300 text-black'
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
                        <div className="px-6 py-4 border-t-2 border-black bg-white flex items-center justify-between font-bold">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 text-xs font-black uppercase tracking-wider border-2 border-black bg-white hover:bg-black hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[2px]"
                            >
                                Anterior
                            </button>
                            <span className="text-xs font-black uppercase tracking-widest text-gray-500">
                                Página {currentPage} de {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 text-xs font-black uppercase tracking-wider border-2 border-black bg-white hover:bg-black hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[2px]"
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
