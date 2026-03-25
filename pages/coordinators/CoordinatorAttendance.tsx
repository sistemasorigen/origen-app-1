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
        <div className="flex flex-col h-full bg-[#fdfdfd] overflow-y-auto font-sans">
            <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 w-full">
                {/* Page Title Section */}
                <div className="mb-10">
                    <h1 className="text-4xl md:text-5xl font-black text-black uppercase tracking-tighter leading-none mb-2">Reportes de Asistencia</h1>
                    <p className="text-sm md:text-base font-bold text-gray-500 uppercase tracking-wide">Gestiona y analiza el compromiso de tu comunidad.</p>
                </div>

                {/* Group Status Filter */}
                <div className="flex p-1 bg-gray-100 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] self-start mb-6 inline-flex">
                    <button
                        onClick={() => setGroupStatusFilter('active')}
                        className={`px-6 py-2 text-sm font-black uppercase tracking-wider transition-all rounded-md ${groupStatusFilter === 'active'
                            ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)]'
                            : 'text-gray-500 hover:text-black'
                            }`}
                    >
                        Activos
                    </button>
                    <button
                        onClick={() => setGroupStatusFilter('finished')}
                        className={`px-6 py-2 text-sm font-black uppercase tracking-wider transition-all rounded-md ${groupStatusFilter === 'finished'
                            ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)]'
                            : 'text-gray-500 hover:text-black'
                            }`}
                    >
                        Finalizados
                    </button>
                </div>

                {/* Filters & Actions Toolbar */}
                <div className="bg-white border-2 border-black p-5 mb-10 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col lg:flex-row gap-5 justify-between items-start lg:items-center">
                    <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                        {/* Group Selector / Search */}
                        <div className="relative w-full sm:w-72">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="text-black w-4 h-4" strokeWidth={2.5} />
                            </div>
                            <input
                                className="block w-full pl-10 pr-3 py-2.5 border-2 border-black bg-white text-black placeholder-gray-400 focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-sm font-bold transition-all"
                                placeholder="BUSCAR GRUPO O LÍDER..."
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {/* Status Filter */}
                        <div className="relative w-full sm:w-48">
                            <select
                                className="block w-full pl-3 pr-10 py-2.5 text-sm font-bold border-2 border-black focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white text-black appearance-none transition-all uppercase tracking-wide"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option>Todos los estados</option>
                                <option>Alta Asistencia</option>
                                <option>Baja Asistencia</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-black">
                                <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
                            </div>
                        </div>
                        {/* Date Picker (Visual only) */}
                        <div className="relative group w-full sm:w-auto hidden xl:block">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <CalendarIcon className="text-gray-400 w-4 h-4" />
                            </div>
                            <input
                                className="block w-full pl-10 pr-3 py-2.5 border-2 border-gray-200 bg-gray-50 text-gray-400 placeholder-gray-300 focus:outline-none text-sm font-bold cursor-not-allowed uppercase tracking-wide"
                                placeholder="FECHA RECIENTE"
                                disabled
                                type="text"
                            />
                        </div>
                    </div>
                    <div className="flex gap-3 w-full lg:w-auto">
                        <button
                            onClick={handleExport}
                            className="inline-flex items-center justify-center px-6 py-2.5 border-2 border-black text-xs font-black uppercase tracking-widest text-black bg-white hover:bg-gray-50 active:translate-y-[2px] active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all w-full lg:w-auto gap-2"
                        >
                            <Download className="w-4 h-4" strokeWidth={2.5} />
                            Exportar CSV
                        </button>
                    </div>
                </div>

                {/* Reports Grid */}
                {filteredReports.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white border-2 border-dashed border-gray-300 rounded-xl">
                        <div className="w-20 h-20 bg-gray-100 border-2 border-black rounded-full flex items-center justify-center mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <Search className="text-gray-400 w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-black uppercase tracking-tight">No se encontraron reportes</h3>
                        <p className="text-gray-500 font-bold mt-2 max-w-sm text-center">
                            {searchTerm || statusFilter !== 'Todos los estados'
                                ? 'Intenta ajustar los filtros de búsqueda.'
                                : 'Aún no hay reportes de asistencia disponibles.'}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 p-4 md:p-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6 bg-[#fdfdfd]">
                        {filteredReports.map(report => (
                            <div key={report.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-0 flex flex-col relative w-full overflow-hidden">
                                {/* Decorative Star for Perfect Attendance */}
                                {report.status === 'Perfect' && (
                                    <div className="absolute top-0 right-0 p-3 z-10">
                                        <div className="bg-emerald-100 text-emerald-600 rounded-full p-2 shadow-sm border border-emerald-200">
                                            <Star className="w-4 h-4 fill-emerald-600" strokeWidth={2.5} />
                                        </div>
                                    </div>
                                )}

                                <div className="p-6 flex-1">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className="text-xl font-black text-black uppercase tracking-tight truncate max-w-[200px] leading-none mb-1" title={report.groupName}>{report.groupName}</h3>
                                            <div className="flex items-center text-xs font-bold text-gray-500 uppercase tracking-wide">
                                                <User className="w-3.5 h-3.5 mr-1.5 text-black" strokeWidth={2.5} />
                                                <span className="truncate max-w-[150px]">{report.leader}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mb-6 p-4 bg-gray-50 border-2 border-black relative">
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Participación</span>
                                            <span className={`text-2xl font-black ${report.percentage >= 80 ? 'text-emerald-600' :
                                                report.percentage >= 50 ? 'text-amber-600' : 'text-rose-600'
                                                }`}>
                                                {report.percentage}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-white border-2 border-black h-3 p-0.5">
                                            <div
                                                className={`h-full ${report.percentage >= 80 ? 'bg-emerald-400' :
                                                    report.percentage >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                                                    }`}
                                                style={{ width: `${report.percentage}%` }}
                                            ></div>
                                        </div>
                                        <div className="absolute top-0 right-0 -mt-3 -mr-2 bg-black text-white text-[10px] font-bold px-2 py-0.5 border-2 border-white shadow-sm rotate-3">
                                            {report.date}
                                        </div>
                                    </div>

                                    <div className="flex flex-col md:flex-row md:items-center justify-between mt-auto gap-4">
                                        <span className={`inline-flex items-center justify-center px-4 py-2 min-h-[44px] text-xs font-bold uppercase tracking-wider rounded-lg border border-gray-100 shadow-sm w-full md:w-auto ${report.percentage >= 80 ? 'bg-emerald-100 text-emerald-800' :
                                            report.percentage >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                            }`}>
                                            {report.attendedCount}/{report.totalMembers} Asistieron
                                        </span>
                                        <button
                                            className="w-full md:w-auto py-2 px-4 min-h-[44px] text-sm font-bold bg-white text-gray-900 border border-gray-200 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-50 shadow-sm"
                                            onClick={() => toggleDetails(report.id)}
                                        >
                                            Ver detalles
                                            <ChevronDown className={`w-4 h-4 ml-2 transition-transform text-gray-500 ${expandedReportId === report.id ? 'rotate-180' : ''}`} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                </div>

                                {/* Expandable Details Section */}
                                {expandedReportId === report.id && (
                                    <div className="bg-gray-50 border-t border-gray-100 p-5 mt-auto animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="flex flex-col sm:flex-row gap-6 text-sm">
                                            <div className="w-full">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-2 h-2 bg-emerald-500 border border-black transform rotate-45"></div>
                                                    <p className="text-xs font-black text-black uppercase tracking-widest">Asistieron ({report.attendees.length})</p>
                                                </div>
                                                <ul className="space-y-1 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                                                    {report.attendees.length > 0 ? (
                                                        report.attendees.map((name, i) => (
                                                            <li key={i} className="flex items-center text-xs font-bold text-gray-600 hover:text-black">
                                                                <CheckCircle className="w-3 h-3 text-emerald-500 mr-2 shrink-0" strokeWidth={2.5} />
                                                                {name}
                                                            </li>
                                                        ))
                                                    ) : <li className="text-xs text-gray-400 italic font-medium">Sin datos</li>}
                                                </ul>
                                            </div>
                                            <div className="w-full">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-2 h-2 bg-rose-500 border border-black transform rotate-45"></div>
                                                    <p className="text-xs font-black text-black uppercase tracking-widest">Faltaron ({report.absent.length})</p>
                                                </div>
                                                <ul className="space-y-1 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                                                    {report.absent.length > 0 ? (
                                                        report.absent.map((name, i) => (
                                                            <li key={i} className="flex items-center text-xs font-bold text-gray-600 hover:text-black">
                                                                <XCircle className="w-3 h-3 text-rose-500 mr-2 shrink-0" strokeWidth={2.5} />
                                                                {name}
                                                            </li>
                                                        ))
                                                    ) : <li className="text-xs text-gray-400 italic font-medium">Ninguna falta</li>}
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
