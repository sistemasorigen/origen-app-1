import React, { useState, useMemo } from 'react';
import {
    ChevronRight,
    Calendar as CalendarIcon,
    Search,
    Download,
    User,
    ChevronDown,
    CheckCircle,
    XCircle,
    Star,
    BarChart,
    ChevronLeft,
    Send,
    Loader2
} from 'lucide-react';
import { Group, User as UserType } from '../../types';

interface CoordinatorAttendanceProps {
    groups: Group[];
    attendanceData: any[]; // Data from getGlobalAttendanceReport
    categoryName: string;
    currentUser?: UserType;
    onRefresh?: () => void;
}

const CoordinatorAttendance: React.FC<CoordinatorAttendanceProps> = ({
    groups,
    attendanceData = [],
    categoryName,
    currentUser
}) => {
    const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos los estados');
    const [groupStatusFilter, setGroupStatusFilter] = useState<'active' | 'finished'>('active');

    // Transform Data
    const formattedReports = useMemo(() => {
        return attendanceData.map(record => {
            const group = groups.find(g => g.id === record.groupId);
            // Fallback for leader name if group not found in active list (maybe archived or logic gap)
            const leaderName = group ? `${group.leaderName} ${group.leaderSurname}` : 'Líder no asignado';

            const total = (record.allMembers || []).length || 1; // Prevent div by zero
            const present = (record.presentMembers || []).length;
            const percentage = Math.round((present / total) * 100);

            let status = 'Moderate';
            if (percentage >= 80) status = 'High';
            if (percentage < 50) status = 'Low';
            if (percentage === 100 && total > 0) status = 'Perfect';

            // Format date
            let dateStr = 'Sin fecha';
            if (record.latestDate) {
                const d = new Date(record.latestDate + 'T00:00:00'); // Valid ISO date assumed
                dateStr = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
            }

            // Determine if group is finished
            let isFinished = false;
            if (group) {
                if ((group.status as string) === 'finished') {
                    isFinished = true;
                } else if (group.endDate) {
                    const today = new Date().toISOString().split('T')[0];
                    if (group.endDate < today) isFinished = true;
                }
            }

            return {
                id: record.groupId,
                groupName: record.groupName,
                leader: leaderName,
                date: dateStr,
                rawDate: record.latestDate,
                percentage,
                attendedCount: present,
                totalMembers: (record.allMembers || []).length, // Use actual total
                status, // 'High', 'Low', 'Moderate', 'Perfect'
                attendees: (record.presentMembers || []).map((m: any) => m.name),
                absent: (record.absentMembers || []).map((m: any) => m.name),
                isFinished
            };
        });
    }, [attendanceData, groups]);

    // Filter logic
    const filteredReports = useMemo(() => {
        return formattedReports.filter(report => {
            // Group status filter
            if (groupStatusFilter === 'active' && report.isFinished) return false;
            if (groupStatusFilter === 'finished' && !report.isFinished) return false;

            const matchesSearch = (report.groupName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (report.leader || '').toLowerCase().includes(searchTerm.toLowerCase());

            let matchesStatus = true;
            if (statusFilter === 'Alta Asistencia') {
                matchesStatus = report.percentage >= 80;
            } else if (statusFilter === 'Baja Asistencia') {
                matchesStatus = report.percentage < 50;
            }

            return matchesSearch && matchesStatus;
        });
    }, [formattedReports, searchTerm, statusFilter, groupStatusFilter]);

    const toggleDetails = (id: string) => {
        setExpandedReportId(expandedReportId === id ? null : id);
    };

    // CSV Export
    const handleExport = () => {
        const headers = ['Grupo', 'Líder', 'Fecha', 'Asistencia %', 'Presentes', 'Total', 'Ausentes'];
        const csvContent = [
            headers.join(','),
            ...filteredReports.map(r => [
                `"${r.groupName}"`,
                `"${r.leader}"`,
                `"${r.date}"`,
                `${r.percentage}%`,
                r.attendedCount,
                r.totalMembers,
                `"${r.absent.join(', ')}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `reporte_asistencia_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-950 overflow-y-auto font-sans">
            <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 w-full">
                {/* Page Title Section */}
                <div className="mb-10">
                    <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white uppercase tracking-tight leading-none mb-2">Reportes de Asistencia</h1>
                    <p className="text-sm md:text-base font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wide">Gestiona y analiza el compromiso de tu comunidad.</p>
                </div>

                {/* Group Status Filter */}
                <div className="flex p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl self-start mb-6 inline-flex">
                    <button
                        onClick={() => setGroupStatusFilter('active')}
                        className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${groupStatusFilter === 'active'
                            ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                    >
                        Activos
                    </button>
                    <button
                        onClick={() => setGroupStatusFilter('finished')}
                        className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${groupStatusFilter === 'finished'
                            ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                    >
                        Finalizados
                    </button>
                </div>

                {/* Filters & Actions Toolbar */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 mb-10 shadow-sm flex flex-col lg:flex-row gap-5 justify-between items-start lg:items-center">
                    <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                        {/* Group Selector / Search */}
                        <div className="relative w-full sm:w-72">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="text-slate-400 dark:text-zinc-500 w-4 h-4" strokeWidth={2.5} />
                            </div>
                            <input
                                className="block w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-4 focus:ring-slate-900/10 dark:focus:ring-white/10 text-sm font-semibold transition-all"
                                placeholder="Buscar grupo o líder..."
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {/* Status Filter */}
                        <div className="relative w-full sm:w-48">
                            <select
                                className="block w-full pl-3 pr-10 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-4 focus:ring-slate-900/10 dark:focus:ring-white/10 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white appearance-none transition-all"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option>Todos los estados</option>
                                <option>Alta Asistencia</option>
                                <option>Baja Asistencia</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 dark:text-zinc-500">
                                <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
                            </div>
                        </div>
                        {/* Date Picker (Visual only) */}
                        <div className="relative group w-full sm:w-auto hidden xl:block">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <CalendarIcon className="text-slate-400 dark:text-zinc-500 w-4 h-4" />
                            </div>
                            <input
                                className="block w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 placeholder-slate-300 dark:placeholder-zinc-600 focus:outline-none text-sm font-semibold cursor-not-allowed"
                                placeholder="Fecha reciente"
                                disabled
                                type="text"
                            />
                        </div>
                    </div>
                    <div className="flex gap-3 w-full lg:w-auto">
                        <button
                            onClick={handleExport}
                            className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 active:scale-[0.98] shadow-sm transition-all w-full lg:w-auto gap-2"
                        >
                            <Download className="w-4 h-4" strokeWidth={2.5} />
                            Exportar CSV
                        </button>
                    </div>
                </div>

                {/* Reports Grid */}
                {filteredReports.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-900 border border-dashed border-slate-300 dark:border-zinc-700 rounded-2xl">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-full flex items-center justify-center mb-6">
                            <Search className="text-slate-400 dark:text-zinc-500 w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">No se encontraron reportes</h3>
                        <p className="text-slate-500 dark:text-zinc-400 font-medium mt-2 max-w-sm text-center">
                            {searchTerm || statusFilter !== 'Todos los estados'
                                ? 'Intenta ajustar los filtros de búsqueda.'
                                : 'Aún no hay reportes de asistencia disponibles.'}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 p-4 md:p-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6 bg-slate-50 dark:bg-zinc-950">
                        {filteredReports.map(report => (
                            <div key={report.id} className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-100 dark:border-zinc-800 p-0 flex flex-col relative w-full overflow-hidden">
                                {/* Decorative Star for Perfect Attendance */}
                                {report.status === 'Perfect' && (
                                    <div className="absolute top-0 right-0 p-3 z-10">
                                        <div className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full p-2 shadow-sm border border-emerald-200 dark:border-emerald-500/20">
                                            <Star className="w-4 h-4 fill-emerald-600 dark:fill-emerald-400" strokeWidth={2.5} />
                                        </div>
                                    </div>
                                )}

                                <div className="p-6 flex-1">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight truncate max-w-[200px] leading-none mb-1" title={report.groupName}>{report.groupName}</h3>
                                            <div className="flex items-center text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wide">
                                                <User className="w-3.5 h-3.5 mr-1.5 text-slate-400 dark:text-zinc-500" strokeWidth={2.5} />
                                                <span className="truncate max-w-[150px]">{report.leader}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mb-6 p-4 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-800 rounded-xl relative">
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Participación</span>
                                            <span className={`text-2xl font-black ${report.percentage >= 80 ? 'text-emerald-600' :
                                                report.percentage >= 50 ? 'text-amber-600' : 'text-rose-600'
                                                }`}>
                                                {report.percentage}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-full h-3 overflow-hidden">
                                            <div
                                                className={`h-full ${report.percentage >= 80 ? 'bg-emerald-400' :
                                                    report.percentage >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                                                    }`}
                                                style={{ width: `${report.percentage}%` }}
                                            ></div>
                                        </div>
                                        <div className="absolute top-0 right-0 -mt-3 -mr-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold px-2 py-1 rounded-full shadow-sm rotate-3">
                                            {report.date}
                                        </div>
                                    </div>

                                    <div className="flex flex-col md:flex-row md:items-center justify-between mt-auto gap-4">
                                        <span className={`inline-flex items-center justify-center px-4 py-2 min-h-[44px] text-xs font-bold uppercase tracking-wider rounded-lg w-full md:w-auto ${report.percentage >= 80 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' :
                                            report.percentage >= 50 ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400'
                                            }`}>
                                            {report.attendedCount}/{report.totalMembers} Asistieron
                                        </span>
                                        <button
                                            className="w-full md:w-auto py-2 px-4 min-h-[44px] text-sm font-semibold bg-white dark:bg-zinc-800 text-slate-900 dark:text-white border border-slate-200 dark:border-zinc-700 rounded-lg flex items-center justify-center transition-colors hover:bg-slate-50 dark:hover:bg-zinc-700 shadow-sm"
                                            onClick={() => toggleDetails(report.id)}
                                        >
                                            Ver detalles
                                            <ChevronDown className={`w-4 h-4 ml-2 transition-transform text-slate-400 dark:text-zinc-500 ${expandedReportId === report.id ? 'rotate-180' : ''}`} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                </div>

                                {/* Expandable Details Section */}
                                {expandedReportId === report.id && (
                                    <div className="bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-100 dark:border-zinc-800 p-5 mt-auto animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="flex flex-col sm:flex-row gap-6 text-sm">
                                            <div className="w-full">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-2 h-2 bg-emerald-500 rounded-sm transform rotate-45"></div>
                                                    <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest">Asistieron ({report.attendees.length})</p>
                                                </div>
                                                <ul className="space-y-1 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                                                    {report.attendees.length > 0 ? (
                                                        report.attendees.map((name, i) => (
                                                            <li key={i} className="flex items-center text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white">
                                                                <CheckCircle className="w-3 h-3 text-emerald-500 mr-2 shrink-0" strokeWidth={2.5} />
                                                                {name}
                                                            </li>
                                                        ))
                                                    ) : <li className="text-xs text-slate-400 dark:text-zinc-600 italic font-medium">Sin datos</li>}
                                                </ul>
                                            </div>
                                            <div className="w-full">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-2 h-2 bg-rose-500 rounded-sm transform rotate-45"></div>
                                                    <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest">Faltaron ({report.absent.length})</p>
                                                </div>
                                                <ul className="space-y-1 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                                                    {report.absent.length > 0 ? (
                                                        report.absent.map((name, i) => (
                                                            <li key={i} className="flex items-center text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white">
                                                                <XCircle className="w-3 h-3 text-rose-500 mr-2 shrink-0" strokeWidth={2.5} />
                                                                {name}
                                                            </li>
                                                        ))
                                                    ) : <li className="text-xs text-slate-400 dark:text-zinc-600 italic font-medium">Ninguna falta</li>}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default CoordinatorAttendance;
