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

    // Transform Data
    const formattedReports = useMemo(() => {
        return attendanceData.map(record => {
            const group = groups.find(g => g.id === record.groupId);
            // Fallback for leader name if group not found in active list (maybe archived or logic gap)
            const leaderName = group ? `${group.leaderName} ${group.leaderSurname}` : 'Líder no asignado';

            const total = record.allMembers.length || 1; // Prevent div by zero
            const present = record.presentMembers.length;
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

            return {
                id: record.groupId,
                groupName: record.groupName,
                leader: leaderName,
                date: dateStr,
                rawDate: record.latestDate,
                percentage,
                attendedCount: present,
                totalMembers: record.allMembers.length, // Use actual total
                status, // 'High', 'Low', 'Moderate', 'Perfect'
                attendees: record.presentMembers.map((m: any) => m.name),
                absent: record.absentMembers.map((m: any) => m.name)
            };
        });
    }, [attendanceData, groups]);

    // Filter logic
    const filteredReports = useMemo(() => {
        return formattedReports.filter(report => {
            const matchesSearch = report.groupName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                report.leader.toLowerCase().includes(searchTerm.toLowerCase());

            let matchesStatus = true;
            if (statusFilter === 'Alta Asistencia') {
                matchesStatus = report.percentage >= 80;
            } else if (statusFilter === 'Baja Asistencia') {
                matchesStatus = report.percentage < 50;
            }

            return matchesSearch && matchesStatus;
        });
    }, [formattedReports, searchTerm, statusFilter]);

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
        <div className="flex flex-col h-full bg-[#f6f8f7] dark:bg-[#112119] overflow-y-auto font-sans">
            <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
                {/* Page Title Section */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reportes de Asistencia Recibidos</h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Revisa y gestiona la asistencia de los grupos de tu comunidad.</p>
                </div>

                {/* Filters & Actions Toolbar */}
                <div className="bg-white dark:bg-[#1a2e24] rounded-xl shadow-sm p-4 mb-8 border border-slate-200 dark:border-slate-700/50 flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
                    <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                        {/* Date Picker (Visual only for now as API fetches all latest) */}
                        <div className="relative group w-full sm:w-auto">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <CalendarIcon className="text-slate-400 w-4 h-4" />
                            </div>
                            <input
                                className="block w-full pl-10 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg leading-5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#17cf73] focus:border-[#17cf73] sm:text-sm transition duration-150 ease-in-out cursor-not-allowed opacity-60"
                                placeholder="Última reunión"
                                disabled
                                type="text"
                            />
                        </div>
                        {/* Group Selector / Search */}
                        <div className="relative w-full sm:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="text-slate-400 w-4 h-4" />
                            </div>
                            <input
                                className="block w-full pl-10 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg leading-5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#17cf73] focus:border-[#17cf73] sm:text-sm transition duration-150 ease-in-out"
                                placeholder="Buscar grupo o líder..."
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {/* Status Filter */}
                        <div className="relative w-full sm:w-40">
                            <select
                                className="block w-full pl-3 pr-10 py-2 text-base border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-[#17cf73] focus:border-[#17cf73] sm:text-sm rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option>Todos los estados</option>
                                <option>Alta Asistencia</option>
                                <option>Baja Asistencia</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-3 w-full lg:w-auto">
                        <button
                            onClick={handleExport}
                            className="inline-flex items-center justify-center px-4 py-2 border border-slate-200 dark:border-slate-700 shadow-sm text-sm font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none transition-colors w-full lg:w-auto"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Exportar CSV
                        </button>
                    </div>
                </div>

                {/* Reports Grid */}
                {filteredReports.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#1a2e24] rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <Search className="text-slate-400 w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white">No se encontraron reportes</h3>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-sm text-center">
                            {searchTerm || statusFilter !== 'Todos los estados'
                                ? 'Intenta ajustar los filtros de búsqueda.'
                                : 'Aún no hay reportes de asistencia disponibles para tus grupos.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredReports.map(report => (
                            <div key={report.id} className="bg-white dark:bg-[#1a2e24] rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden flex flex-col relative">
                                {/* Decorative Star for Perfect Attendance */}
                                {report.status === 'Perfect' && (
                                    <div className="absolute top-0 right-0 -mt-1 -mr-1 w-16 h-16 overflow-hidden z-10">
                                        <div className="absolute top-0 right-0 w-8 h-8 bg-[#17cf73]/20 rounded-bl-xl backdrop-blur-sm flex items-center justify-center">
                                            <Star className="text-[#17cf73] w-3 h-3 fill-current" />
                                        </div>
                                    </div>
                                )}

                                <div className="p-5 flex-1">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white truncate max-w-[180px]" title={report.groupName}>{report.groupName}</h3>
                                            <div className="flex items-center text-sm text-slate-500 dark:text-slate-400 mt-1">
                                                <User className="w-3 h-3 mr-1 text-[#17cf73]" />
                                                <span className="truncate max-w-[150px]">{report.leader}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end pl-2">
                                            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Fecha</span>
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{report.date}</span>
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <div className="flex justify-between items-end mb-1">
                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Participación</span>
                                            <span className={`text-sm font-bold ${report.percentage >= 80 ? 'text-[#17cf73]' :
                                                report.percentage >= 50 ? 'text-yellow-600 dark:text-yellow-500' : 'text-rose-600 dark:text-rose-500'
                                                }`}>
                                                {report.percentage}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full ${report.percentage >= 80 ? 'bg-[#17cf73]' :
                                                    report.percentage >= 50 ? 'bg-yellow-400' : 'bg-rose-400'
                                                    }`}
                                                style={{ width: `${report.percentage}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between mt-2">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${report.percentage >= 80 ? 'bg-[#17cf73]/20 text-[#14b061] border-[#17cf73]/20' :
                                            report.percentage >= 50 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200'
                                            }`}>
                                            {report.attendedCount}/{report.totalMembers} Asistieron
                                        </span>
                                        <button
                                            className="text-sm text-slate-500 hover:text-[#17cf73] font-medium flex items-center transition-colors group"
                                            onClick={() => toggleDetails(report.id)}
                                        >
                                            Ver detalles
                                            <ChevronDown className={`w-4 h-4 ml-1 group-hover:translate-y-0.5 transition-transform ${expandedReportId === report.id ? 'rotate-180' : ''}`} />
                                        </button>
                                    </div>
                                </div>

                                {/* Expandable Details Section */}
                                {expandedReportId === report.id && (
                                    <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700/50 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <p className="text-xs font-semibold text-[#17cf73] uppercase mb-2">Asistieron ({report.attendees.length})</p>
                                                <ul className="space-y-1 text-slate-600 dark:text-slate-400 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                                                    {report.attendees.length > 0 ? (
                                                        report.attendees.map((name, i) => (
                                                            <li key={i} className="flex items-center">
                                                                <CheckCircle className="w-3 h-3 text-[#17cf73] mr-1.5" />
                                                                {name}
                                                            </li>
                                                        ))
                                                    ) : <li className="text-xs text-slate-400 italic">Sin datos</li>}
                                                </ul>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-rose-500 uppercase mb-2">Faltaron ({report.absent.length})</p>
                                                <ul className="space-y-1 text-slate-600 dark:text-slate-400 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                                                    {report.absent.length > 0 ? (
                                                        report.absent.map((name, i) => (
                                                            <li key={i} className="flex items-center">
                                                                <XCircle className="w-3 h-3 text-rose-400 mr-1.5" />
                                                                {name}
                                                            </li>
                                                        ))
                                                    ) : <li className="text-xs text-slate-400 italic">Ninguna falta</li>}
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
