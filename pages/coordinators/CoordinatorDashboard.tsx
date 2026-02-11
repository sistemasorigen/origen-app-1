import React, { useState, useMemo } from 'react';
import {
    Users,
    UserMinus,
    TrendingUp,
    TrendingDown,
    Search,
    Bell,
    UserPlus,
    BarChart3,
    History
} from 'lucide-react';
import { Group, GroupCategory, DropoutRequest } from '../../types';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
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
    const [activitySearch, setActivitySearch] = useState('');

    // --- KPIs Calculation ---

    const totalGroups = groups.length;
    // Use all groups for analysis to avoid hiding data (even if pending)
    const analyzedGroups = groups;

    const totalMembers = analyzedGroups.reduce((sum, g) => {
        // Use membersCount if available (more robust), otherwise count registrations
        const count = g.membersCount || (g.registrations || []).filter(r => r.status === 'APPROVED').length || 0;
        return sum + count;
    }, 0);
    const totalDropouts = dropouts.length;

    // --- Chart Data ---
    const chartData = useMemo(() => {
        if (chartMode === 'inscriptos') {
            // Sort by member count descending for better visualization
            return [...analyzedGroups]
                .map(g => ({
                    name: g.name.length > 15 ? g.name.substring(0, 15) + '...' : g.name,
                    fullName: g.name,
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
                    name: name.length > 15 ? name.substring(0, 15) + '...' : name,
                    fullName: name,
                    value
                }))
                .sort((a, b) => b.value - a.value);
        }
    }, [chartMode, analyzedGroups, dropouts]);

    // --- Activity Log ---
    const activityLog = useMemo(() => {
        const items: { id: string; memberName: string; action: string; groupName: string; date: string; type: 'dropout' | 'registration'; initials: string }[] = [];

        // Add dropouts
        dropouts.forEach(d => {
            const name = d.targetUserName || 'Miembro';
            items.push({
                id: d.id,
                memberName: name,
                initials: name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
                action: d.requestType === 'SELF_DROPOUT' ? 'Baja voluntaria' : 'Baja por anfitrión',
                groupName: d.groupName,
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
                        initials: name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
                        action: 'Nuevo registro',
                        groupName: g.name,
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

        return items.slice(0, 50);
    }, [dropouts, analyzedGroups, activitySearch]);

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
                <div className="bg-gray-900 text-white p-3 rounded-lg shadow-xl border border-gray-700">
                    <p className="font-bold text-sm mb-1">{payload[0]?.payload?.fullName || label}</p>
                    <p className="text-xs text-gray-300">
                        {chartMode === 'inscriptos' ? 'Miembros activos' : 'Solicitudes de baja'}
                    </p>
                    <p className="text-xl font-bold text-[#13ec92]">
                        {payload[0]?.value}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex flex-col h-full bg-[#f6f8f7] dark:bg-[#10221a] min-h-screen">
            {/* Top Header */}
            <header className="flex items-center justify-between px-6 py-5 bg-white dark:bg-[#10221a] border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-display">Dashboard General</h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Resumen de actividad y métricas clave • {categoryName}</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative hidden md:block">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                            <Search className="w-5 h-5" />
                        </span>
                        <input
                            className="w-64 pl-10 pr-4 py-2 rounded-full border-none bg-gray-50 dark:bg-gray-900 shadow-sm text-sm focus:ring-2 focus:ring-[#13ec92]/50 text-gray-700 dark:text-gray-200 placeholder-gray-400"
                            placeholder="Buscar en actividad..."
                            type="text"
                            value={activitySearch}
                            onChange={(e) => setActivitySearch(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={onRefresh}
                        className="relative p-2 rounded-full bg-white dark:bg-gray-900 shadow-sm text-gray-500 hover:text-[#13ec92] transition-colors border border-gray-100 dark:border-gray-800"
                    >
                        <Bell className="w-5 h-5" />
                        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-900"></span>
                    </button>
                </div>
            </header>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-8">
                {/* KPI Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* KPI Card 1: Grupos */}
                    <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 relative overflow-hidden group hover:shadow-md transition-all duration-300">
                        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-[#13ec92]/10 to-transparent"></div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-[#13ec92]/10 rounded-lg text-[#0fb972] dark:text-[#13ec92]">
                                    <Users className="w-6 h-6" />
                                </div>
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-1 rounded-full">
                                    <TrendingUp className="w-3 h-3" />
                                    <span>Activos</span>
                                </span>
                            </div>
                            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-wide">Total Grupos</h3>
                            <div className="mt-1 flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-gray-900 dark:text-white">{totalGroups}</span>
                                <span className="text-sm text-gray-400">registrados</span>
                            </div>
                        </div>
                    </div>

                    {/* KPI Card 2: Inscriptos */}
                    <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 relative overflow-hidden group hover:shadow-md transition-all duration-300">
                        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-[#13ec92]/20 to-transparent"></div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-[#13ec92]/20 rounded-lg text-[#0fb972] dark:text-[#13ec92]">
                                    <UserPlus className="w-6 h-6" />
                                </div>
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-1 rounded-full">
                                    <TrendingUp className="w-3 h-3" />
                                    <span>~{Math.round(totalMembers / (totalGroups || 1))} prom.</span>
                                </span>
                            </div>
                            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-wide">Total Inscriptos</h3>
                            <div className="mt-1 flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-gray-900 dark:text-white">{totalMembers}</span>
                                <span className="text-sm text-gray-400">personas</span>
                            </div>
                        </div>
                    </div>

                    {/* KPI Card 3: Bajas */}
                    <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 relative overflow-hidden group hover:shadow-md transition-all duration-300">
                        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-red-50 to-transparent dark:from-red-900/10"></div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400">
                                    <UserMinus className="w-6 h-6" />
                                </div>
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded-full">
                                    <TrendingDown className="w-3 h-3" />
                                    <span>{((totalDropouts / totalMembers) * 100).toFixed(1)}% tasa</span>
                                </span>
                            </div>
                            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-wide">Solicitudes de Baja</h3>
                            <div className="mt-1 flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-gray-900 dark:text-white">{totalDropouts}</span>
                                <span className="text-sm text-gray-400">pendientes</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Analysis Section with Gradient Chart */}
                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-8 min-h-[500px] flex flex-col relative overflow-hidden mb-8">
                    {/* Chart Header & Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Análisis de Datos</h2>
                            <p className="text-sm text-gray-500">
                                {chartMode === 'inscriptos' ? 'Top grupos con más inscriptos' : 'Grupos con solicitudes de baja'}
                            </p>
                        </div>
                        {/* Switch / Toggle Group */}
                        <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg inline-flex items-center relative">
                            {/* Animated Background Pill */}
                            <div
                                className={`absolute inset-y-1 w-[calc(50%-4px)] bg-white dark:bg-gray-700 rounded-md shadow-sm transition-transform duration-300 transform ${chartMode === 'inscriptos' ? 'left-1 translate-x-0' : 'left-1 translate-x-[100%]'}`}
                            ></div>

                            <button
                                onClick={() => setChartMode('inscriptos')}
                                className={`relative z-10 px-6 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${chartMode === 'inscriptos' ? 'text-[#0fb972] dark:text-[#13ec92]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                            >
                                Inscriptos
                            </button>
                            <button
                                onClick={() => setChartMode('bajas')}
                                className={`relative z-10 px-6 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${chartMode === 'bajas' ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                            >
                                Bajas
                            </button>
                        </div>
                    </div>

                    {/* Chart Area */}
                    <div className="flex-1 w-full min-h-[350px]">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={chartMode === 'inscriptos' ? '#13ec92' : '#ef4444'} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={chartMode === 'inscriptos' ? '#13ec92' : '#ef4444'} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                                    />
                                    <Tooltip cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }} content={<CustomTooltip />} />
                                    <Area
                                        type="monotone"
                                        dataKey="value"
                                        stroke={chartMode === 'inscriptos' ? '#13ec92' : '#ef4444'}
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorValue)"
                                        activeDot={{ r: 6, strokeWidth: 0, fill: '#fff' }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <BarChart3 className="w-12 h-12 mb-3 opacity-20" />
                                <span className="font-medium">No hay datos suficientes para visualizar</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Activity Table */}
                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
                            <History className="w-4 h-4 text-gray-400" />
                            Actividad Reciente
                        </h3>
                        <button className="text-xs text-[#13ec92] font-medium hover:text-[#0fb972] transition-colors">
                            Ver historial completo
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/50">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Miembro</th>
                                    <th className="px-6 py-3 font-medium">Acción</th>
                                    <th className="px-6 py-3 font-medium">Grupo</th>
                                    <th className="px-6 py-3 font-medium">Fecha</th>
                                    <th className="px-6 py-3 font-medium text-right">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {activityLog.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center text-gray-400">
                                            Sin actividad reciente
                                        </td>
                                    </tr>
                                ) : (
                                    activityLog.map(item => (
                                        <tr key={item.id} className="hover:bg-[#f6f8f7] dark:hover:bg-gray-800/30 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900 dark:text-white flex items-center gap-3">
                                                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${item.type === 'registration'
                                                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                                    : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                                                    }`}>
                                                    {item.initials}
                                                </div>
                                                {item.memberName}
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{item.action}</td>
                                            <td className="px-6 py-4 text-gray-900 dark:text-gray-300 font-medium">{item.groupName}</td>
                                            <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{formatRelTime(item.date)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${item.type === 'registration'
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
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
                </div>
            </div>
        </div>
    );
};

export default CoordinatorDashboard;
