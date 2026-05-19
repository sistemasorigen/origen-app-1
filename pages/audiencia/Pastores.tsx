import React, { useState, useEffect } from 'react';
import { User, UserRole, Baptism, ChildPresentation, DropoutRequest } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { hasRole } from '../../services/authUtils';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
    LineChart, Line
} from 'recharts';
import {
    AlertTriangle, ArrowLeft, Download, Church, Layers, Info, Eye, Users, UserMinus,
    CheckCircle, XCircle, Search, ChevronDown, ChevronUp
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import NeoModal from '../../components/ui/NeoModal';
import InteractionsDashboard from '../../components/Reportes/PanelInteracciones';

interface PastoresProps {
    currentUser: User | null;
}

type Tab = 'INFO' | 'GROUPS';
type GroupsSubTab = 'METRICS' | 'ASISTENCIAS' | 'BAJAS' | 'INTERACCIONES';
type BajasType = 'INSCRIPCIONES' | 'GRUPOS';

const Pastores: React.FC<PastoresProps> = ({ currentUser }) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    // Determine default tab based on user role
    // GCX (ADMIN_GROUPS, ENCARGADO_GRUPOS) users should default to GROUPS
    // Punto (ADMIN_PUNTO, ENCARGADO_PUNTO) users should default to INFO
    const getDefaultTab = (): Tab => {
        if (!currentUser) return 'INFO';
        const isGCXOnly = hasRole(currentUser, [UserRole.ADMIN_GROUPS, UserRole.ENCARGADO_GRUPOS]) &&
            !hasRole(currentUser, [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.ADMIN_PUNTO, UserRole.ENCARGADO_PUNTO]);
        return isGCXOnly ? 'GROUPS' : 'INFO';
    };

    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<Tab>(getDefaultTab());

    // Deep linking
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['INFO', 'GROUPS'].includes(tab)) {
            setActiveTab(tab as Tab);
        }
    }, [searchParams]);

    // Date Filters (Default: Last 30 Days)
    const today = new Date().toISOString().split('T')[0];
    const lastMonth = new Date();
    lastMonth.setDate(lastMonth.getDate() - 30);
    const defaultStart = lastMonth.toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(defaultStart);
    const [endDate, setEndDate] = useState(today);

    // Data States
    const [inventoryData, setInventoryData] = useState<any[]>([]);
    const [baptismData, setBaptismData] = useState<{ registered: any[]; completed: any[] }>({ registered: [], completed: [] });
    const [presentationData, setPresentationData] = useState<{ registered: any[]; completed: any[] }>({ registered: [], completed: [] });
    const [groupsData, setGroupsData] = useState<any[]>([]);

    // Sub-navigation for GROUPS tab
    const [groupsSubTab, setGroupsSubTab] = useState<GroupsSubTab>('METRICS');
    const [bajasType, setBajasType] = useState<BajasType>('INSCRIPCIONES');
    type GroupsFilterType = 'ACTIVOS' | 'FINALIZADOS' | 'TEMPORADAS';
    type SeasonType = 'S1' | 'S2' | 'S3';

    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const yearRange = Array.from({ length: 6 }, (_, i) => currentYear - 1 + i);

    const SEASON_LABELS: Record<SeasonType, string> = {
        S1: '1ª Temporada',
        S2: '2ª Temporada',
        S3: '3ª Temporada',
    };

    // Helper de temporadas (idéntico al de Grupos.tsx)
    const getSeasonFromDate = (dateStr?: string | null): SeasonType | null => {
        if (!dateStr) return null;
        const date = new Date(dateStr + 'T12:00:00');
        const m = date.getMonth() + 1;
        const d = date.getDate();
        const md = m * 100 + d;
        if (md >= 323 && md <= 531) return 'S1';
        if (md >= 629 && md <= 823) return 'S2';
        if (md >= 1005 && md <= 1129) return 'S3';
        return null;
    };

    const [groupsFilter, setGroupsFilter] =
        useState<GroupsFilterType>('ACTIVOS');
    const [seasonFilter, setSeasonFilter] =
        useState<SeasonType>('S1');

    type AttendanceViewMode = 'ACTIVOS' | 'FINALIZADOS' | 'TEMPORADAS';

    const DAY_TO_JS: Record<string, number> = {
        'Domingo': 0, 'Lunes': 1, 'Martes': 2,
        'Miércoles': 3, 'Jueves': 4,
        'Viernes': 5, 'Sábado': 6,
    };

    const getExpectedMeetingDates = (
        meetingDay: string,
        startDate: string | null,
        endDate: string | null
    ): string[] => {
        if (!startDate) return [];
        const dayIndex = DAY_TO_JS[meetingDay];
        if (dayIndex === undefined) return [];

        const start = new Date(startDate + 'T12:00:00');
        const end = endDate ? new Date(endDate + 'T12:00:00') : new Date();
        const cutoff = new Date();
        const effectiveEnd = end < cutoff ? end : cutoff;

        const dates: string[] = [];
        const current = new Date(start);

        while (current.getDay() !== dayIndex) {
            current.setDate(current.getDate() + 1);
        }

        while (current <= effectiveEnd) {
            dates.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 7);
        }

        return dates.reverse();
    };

    // Attendance Report State
    const [attendanceSearchQuery, setAttendanceSearchQuery] = useState('');
    const [attendanceFilter, setAttendanceFilter] = useState<AttendanceViewMode>('ACTIVOS');
    const [fullAttendanceReport, setFullAttendanceReport] = useState<{
        groupId: string;
        groupName: string;
        leaderName: string;
        meetingDay: string;
        meetingTime: string;
        startDate: string | null;
        endDate: string | null;
        status: string;
        allMembers: { id: string; name: string }[];
        attendanceRecords: {
            date: string;
            presentMembers: { id: string; name: string }[];
            absentMembers: { id: string; name: string }[];
            totalPresent: number;
            totalAbsent: number;
        }[];
    }[]>([]);
    const [attendanceSeasonFilter, setAttendanceSeasonFilter] = useState<SeasonType>('S1');
    const [expandedAttendanceGroupId, setExpandedAttendanceGroupId] = useState<string | null>(null);
    const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
    const [attendanceModalData, setAttendanceModalData] = useState<{
        groupName: string;
        date: string;
        type: 'present' | 'absent';
        members: { id: string; name: string }[];
    } | null>(null);

    // Dropout Report State
    const [dropoutRequests, setDropoutRequests] = useState<DropoutRequest[]>([]);

    // Analytics state
    const [registrationAnalytics, setRegistrationAnalytics] = useState<{
        totalGroups: number;
        totalHosts: number;
        totalCoHosts: number;
        totalRegistrations: number;
        uniquePeople: number;
        distribution: Record<string, number>;
    } | null>(null);

    // Security Check
    // Security Check
    // Security Check
    const canAccess = currentUser && hasRole(currentUser, [
        UserRole.SUPER_ADMIN,
        UserRole.PASTOR,
        UserRole.ENCARGADO_PUNTO,
        UserRole.ADMIN_PUNTO,
        UserRole.ENCARGADO_GRUPOS,
        UserRole.REPORTES,
        UserRole.ADMIN_GROUPS
    ]);

    useEffect(() => {
        if (!canAccess) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                if (activeTab === 'INFO') {
                    const [stock, baptisms, presentations] = await Promise.all([
                        supabaseService.getInventoryStockData(),
                        supabaseService.getBaptismTimeSeries(startDate, endDate),
                        supabaseService.getPresentationTimeSeries(startDate, endDate)
                    ]);
                    setInventoryData(stock);
                    setBaptismData(baptisms);
                    setPresentationData(presentations);
                }
                if (activeTab === 'GROUPS') {
                    const groups = await supabaseService.getGroupRegistrationChartData('2000-01-01', '2100-01-01');
                    setGroupsData(groups);

                    // Also fetch attendance and dropout data
                    const [fullAttendance, dropouts, analytics] = await Promise.all([
                        supabaseService.getFullAttendanceReport(),
                        supabaseService.getAllDropoutRequests(),
                        supabaseService.getGroupRegistrationAnalytics(groupsFilter)
                    ]);
                    setFullAttendanceReport(fullAttendance);
                    setDropoutRequests(dropouts);
                    setRegistrationAnalytics(analytics);
                }
            } catch (e) {
                console.error("Error loading dashboard", e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        // Ignoring groupsFilter in dependencies to avoid full refetch on toggle, since the second useEffect handles toggle
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canAccess, activeTab, startDate, endDate]);

    // Re-fetch analytics when filter changes
    useEffect(() => {
        if (!canAccess || activeTab !== 'GROUPS') return;
        const fetchAnalytics = async () => {
            try {
                // Si el modo es TEMPORADAS, pasar la
                // temporada seleccionada a la función
                const analyticsFilter = groupsFilter === 'TEMPORADAS'
                    ? seasonFilter
                    : groupsFilter;
                const analytics = await supabaseService
                    .getGroupRegistrationAnalytics(analyticsFilter);
                setRegistrationAnalytics(analytics);
            } catch (error) {
                console.error("Error fetching filtered analytics", error);
            }
        };
        fetchAnalytics();
    }, [groupsFilter, seasonFilter, selectedYear, canAccess, activeTab]);

    if (!canAccess) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-white text-center p-6">
                <div className="p-4 border-4 border-red-600 mb-6">
                    <AlertTriangle className="w-16 h-16 text-red-600" />
                </div>
                <h1 className="text-3xl font-black text-black uppercase mb-2 tracking-tighter">Acceso Restringido</h1>
                <p className="text-neutral-500 mb-8 font-bold">Esta sección es exclusiva para el equipo pastoral.</p>
                <button
                    onClick={() => navigate('/')}
                    className="px-6 py-3 bg-black text-white font-black uppercase text-xs tracking-widest border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all"
                >
                    Volver al Inicio
                </button>
            </div>
        );
    }

    const handleExportToCSV = (data: any[], filename: string) => {
        if (!data || data.length === 0) {
            alert("No hay datos para exportar.");
            return;
        }

        const headers = Object.keys(data[0]);
        const rows = data.map(obj => headers.map(header => JSON.stringify(obj[header])).join(','));
        const csvContent = [headers.join(','), ...rows].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${filename}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportGroupsCSV = () => {
        if (!groupsData || groupsData.length === 0) {
            alert("No hay datos para exportar.");
            return;
        }

        // Create CSV with Spanish headers
        const headers = ['Grupo', 'Inscriptos'];
        const rows = groupsData.map(item => `"${item.name}",${item.value}`);
        const csvContent = [headers.join(','), ...rows].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `grupos_inscripciones_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportBaptisms = async () => {
        const baptisms = await supabaseService.getBaptisms();
        if (!baptisms || baptisms.length === 0) {
            alert("No hay datos de bautismos para exportar.");
            return;
        }

        const formatted = baptisms.map(b => ({
            'Fecha Registrado': b.registrationDate ? new Date(b.registrationDate).toLocaleDateString('es-AR') : '',
            'Nombre': b.firstName,
            'Apellido': b.lastName,
            'Realizado': b.status === 'Realizado' ? 'Sí' : 'No',
            'Fecha Realizado': b.completionDate ? new Date(b.completionDate).toLocaleDateString('es-AR') : '-'
        }));

        handleExportToCSV(formatted, 'bautismos_detalle');
    };

    const handleExportPresentations = async () => {
        const presentations = await supabaseService.getPresentations();
        if (!presentations || presentations.length === 0) {
            alert("No hay datos de presentaciones para exportar.");
            return;
        }

        const formatted = presentations.map(p => ({
            'Fecha Registrado': p.scheduledDate ? new Date(p.scheduledDate).toLocaleDateString('es-AR') : '',
            'Nombre': p.childName,
            'Apellido': p.childSurname,
            'Realizado': p.status === 'Realizado' ? 'Sí' : 'No',
            'Fecha Realizado': p.completionDate ? new Date(p.completionDate).toLocaleDateString('es-AR') : '-'
        }));

        handleExportToCSV(formatted, 'presentaciones_detalle');
    };

    const prepareTimeData = (reg: any[], comp: any[]) => {
        const allDates = new Set([...reg.map(d => d.date), ...comp.map(d => d.date)]);
        const sortedDates = Array.from(allDates).sort();

        return sortedDates.map(date => {
            const r = reg.find(d => d.date === date);
            const c = comp.find(d => d.date === date);
            return {
                date,
                Anotados: r ? r.count : 0,
                Realizados: c ? c.count : 0
            };
        });
    };

    const baptismChartData = prepareTimeData(baptismData.registered, baptismData.completed);
    const presentationChartData = prepareTimeData(presentationData.registered, presentationData.completed);

    return (
        <div className="min-h-screen bg-white pb-20 animate-fadeIn">
            {/* Header - BRUTALIST - Mobile Optimized */}
            <div className="bg-black text-white pt-6 md:pt-10 pb-24 md:pb-32 px-4 md:px-12 relative overflow-hidden border-b-4 border-amber-500">
                <div className="max-w-[1920px] mx-auto relative z-10">
                    {/* Top Row: Title + Exit Button */}
                    <div className="flex justify-between items-start mb-4 md:mb-6">
                        <div className="flex items-center gap-3 md:gap-4">
                            {/* Icon Box - Brutalist */}
                            <div className="p-2 md:p-3 bg-amber-500 border-2 border-white text-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)]">
                                <AlertTriangle className="w-6 h-6 md:w-8 md:h-8" />
                            </div>
                            <div>
                                <h1 className="text-xl md:text-4xl font-black uppercase tracking-tighter">Reportes</h1>
                                <p className="text-amber-500 font-black uppercase text-[10px] md:text-xs tracking-widest">Análisis & Métricas</p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/')}
                            className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 bg-transparent border-2 border-white text-white text-[10px] md:text-xs font-black uppercase hover:bg-white hover:text-black transition-all shrink-0"
                        >
                            <ArrowLeft className="w-4 h-4" /> <span className="hidden md:inline">Salir</span>
                        </button>
                    </div>

                    {/* Date Filters - Mobile: Full Width Stack */}
                    {activeTab === 'INFO' && (
                        <div className="flex flex-col md:flex-row gap-2 md:gap-4 mb-4 md:mb-6 animate-fadeIn">
                            <div className="flex items-center gap-2 flex-1">
                                <label className="text-[10px] font-black uppercase text-amber-500 w-12 shrink-0">Desde</label>
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        readOnly
                                        value={startDate ? startDate.split('-').reverse().join('/') : ''}
                                        className="w-full bg-white border-2 border-white text-black px-3 py-2 text-xs font-black shadow-[2px_2px_0px_0px_rgba(255,255,255,0.3)] outline-none min-w-0 pointer-events-none"
                                    />
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-1">
                                <label className="text-[10px] font-black uppercase text-amber-500 w-12 shrink-0">Hasta</label>
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        readOnly
                                        value={endDate ? endDate.split('-').reverse().join('/') : ''}
                                        className="w-full bg-white border-2 border-white text-black px-3 py-2 text-xs font-black shadow-[2px_2px_0px_0px_rgba(255,255,255,0.3)] outline-none min-w-0 pointer-events-none"
                                    />
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Navigation Tabs - Mobile: Smaller, Scrollable */}
                    <div className="flex gap-2 md:gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
                        {/* Punto de Información tab */}
                        {currentUser && hasRole(currentUser, [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.ENCARGADO_PUNTO, UserRole.ADMIN_PUNTO]) && (
                            <button
                                onClick={() => setActiveTab('INFO')}
                                className={`px-3 md:px-4 py-2 md:py-3 flex items-center gap-1.5 md:gap-2 text-[10px] md:text-sm font-black uppercase tracking-wider transition-all border-2 whitespace-nowrap shrink-0 ${activeTab === 'INFO'
                                    ? 'bg-amber-500 text-black border-amber-500 shadow-none'
                                    : 'bg-transparent text-white border-white shadow-[2px_2px_0px_0px_rgba(255,255,255,0.3)]'}`}
                            >
                                <Info className="w-3.5 h-3.5 md:w-4 md:h-4" /> <span className="hidden sm:inline">Punto de </span>Info
                            </button>
                        )}
                        {/* Grupos de Conexión tab */}
                        {currentUser && hasRole(currentUser, [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.ENCARGADO_GRUPOS, UserRole.ADMIN_GROUPS]) && (
                            <button
                                onClick={() => setActiveTab('GROUPS')}
                                className={`px-3 md:px-4 py-2 md:py-3 flex items-center gap-1.5 md:gap-2 text-[10px] md:text-sm font-black uppercase tracking-wider transition-all border-2 whitespace-nowrap shrink-0 ${activeTab === 'GROUPS'
                                    ? 'bg-amber-500 text-black border-amber-500 shadow-none'
                                    : 'bg-transparent text-white border-white shadow-[2px_2px_0px_0px_rgba(255,255,255,0.3)]'}`}
                            >
                                <Layers className="w-3.5 h-3.5 md:w-4 md:h-4" /> Grupos<span className="hidden sm:inline"> de Conexión</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Dashboard Content - Mobile Optimized */}
            <div className="max-w-[1920px] mx-auto px-4 md:px-12 -mt-16 md:-mt-20 relative z-20 space-y-4 md:space-y-8">

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                        {[1, 2].map(i => <div key={i} className="h-64 md:h-96 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] animate-pulse rounded-xl"></div>)}
                    </div>
                ) : (
                    <>
                        {activeTab === 'INFO' && (
                            <div className="space-y-4 md:space-y-8 animate-fadeIn">
                                {/* Row 1: Inventory - BRUTALIST CARD */}
                                <div className="bg-white p-4 md:p-8 border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-8">
                                        <div>
                                            <h3 className="text-sm md:text-lg font-black text-black uppercase tracking-tight">Stock de Inventario</h3>
                                            <p className="text-[10px] md:text-xs text-neutral-500 font-bold uppercase">Distribución por Talle</p>
                                        </div>
                                        <button
                                            onClick={() => handleExportToCSV(inventoryData, 'inventario_stock')}
                                            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-white text-black border-2 border-black text-[10px] md:text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-black hover:text-white transition-all"
                                        >
                                            <Download className="w-3.5 h-3.5 md:w-4 md:h-4" /> CSV
                                        </button>
                                    </div>
                                    <div className="h-56 md:h-80 -mx-2 md:mx-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={inventoryData}
                                                margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                                                barGap={4}
                                                barCategoryGap="20%"
                                            >
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#000', fontSize: 10, fontWeight: 'bold' }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#000', fontSize: 10, fontWeight: 'bold' }} width={30} />
                                                <Tooltip contentStyle={{ backgroundColor: '#000', border: '2px solid #000', color: '#fff', fontWeight: 'bold', fontSize: '12px' }} cursor={{ fill: '#f5f5f5' }} />
                                                <Legend wrapperStyle={{ fontSize: '10px' }} />
                                                <Bar dataKey="Remeras" fill="#000000" radius={[0, 0, 0, 0]} barSize={16} />
                                                <Bar dataKey="Buzos" fill="#f59e0b" radius={[0, 0, 0, 0]} barSize={16} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Row 2: Baptisms & Presentations */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
                                    {/* Baptisms - BRUTALIST CARD */}
                                    <div className="bg-white p-4 md:p-8 border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                                        <div className="flex justify-between items-start gap-3 mb-4 md:mb-8">
                                            <div>
                                                <h3 className="text-sm md:text-lg font-black text-black uppercase tracking-tight">Bautismos</h3>
                                                <p className="text-[10px] md:text-xs text-neutral-500 font-bold uppercase">Tendencia Temporal</p>
                                            </div>
                                            <button
                                                onClick={handleExportBaptisms}
                                                className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center bg-white text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-black hover:text-white transition-all shrink-0"
                                                title="Descargar CSV"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="h-48 md:h-72 -mx-2 md:mx-0">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={baptismChartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#000', fontSize: 8, fontWeight: 'bold' }} interval="preserveStartEnd" />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#000', fontSize: 10, fontWeight: 'bold' }} allowDecimals={false} width={25} />
                                                    <Tooltip contentStyle={{ backgroundColor: '#000', border: '2px solid #000', color: '#fff', fontWeight: 'bold', fontSize: '11px' }} />
                                                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                                                    <Line type="linear" dataKey="Anotados" stroke="#000000" strokeWidth={2} dot={{ r: 3, fill: '#000' }} activeDot={{ r: 5 }} />
                                                    <Line type="linear" dataKey="Realizados" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} activeDot={{ r: 5 }} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Presentations - BRUTALIST CARD */}
                                    <div className="bg-white p-4 md:p-8 border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                                        <div className="flex justify-between items-start gap-3 mb-4 md:mb-8">
                                            <div>
                                                <h3 className="text-sm md:text-lg font-black text-black uppercase tracking-tight">Presentación de Niños</h3>
                                                <p className="text-[10px] md:text-xs text-neutral-500 font-bold uppercase">Tendencia Temporal</p>
                                            </div>
                                            <button
                                                onClick={handleExportPresentations}
                                                className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center bg-white text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-black hover:text-white transition-all shrink-0"
                                                title="Descargar CSV"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="h-48 md:h-72 -mx-2 md:mx-0">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={presentationChartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#000', fontSize: 8, fontWeight: 'bold' }} interval="preserveStartEnd" />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#000', fontSize: 10, fontWeight: 'bold' }} allowDecimals={false} width={25} />
                                                    <Tooltip contentStyle={{ backgroundColor: '#000', border: '2px solid #000', color: '#fff', fontWeight: 'bold', fontSize: '11px' }} />
                                                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                                                    <Line type="linear" dataKey="Anotados" stroke="#000000" strokeWidth={2} dot={{ r: 3, fill: '#000' }} activeDot={{ r: 5 }} />
                                                    <Line type="linear" dataKey="Realizados" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} activeDot={{ r: 5 }} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'GROUPS' && (
                            <div className="space-y-4 md:space-y-6 animate-fadeIn">
                                {/* Sub-Navigation Pills */}
                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                    {(['METRICS', 'ASISTENCIAS', 'BAJAS', 'INTERACCIONES'] as GroupsSubTab[]).map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => setGroupsSubTab(tab)}
                                            className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-2 rounded-full whitespace-nowrap transition-all ${groupsSubTab === tab
                                                ? 'bg-black text-white border-black'
                                                : 'bg-white text-black border-black hover:bg-slate-100'
                                                }`}
                                        >
                                            {tab === 'METRICS' && 'Métricas'}
                                            {tab === 'ASISTENCIAS' && 'Asistencias'}
                                            {tab === 'BAJAS' && 'Bajas'}
                                            {tab === 'INTERACCIONES' && 'Interacciones'}
                                        </button>
                                    ))}
                                </div>

                                {/* METRICS Sub-Tab - Original Chart */}
                                {groupsSubTab === 'METRICS' && (
                                    <>
                                        {/* Participation Metrics */}
                                        {registrationAnalytics && (
                                            <div className="bg-white p-4 md:p-8 border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-4 md:mb-6">
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                                                    <div>
                                                        <h3 className="text-sm md:text-lg font-black text-black uppercase tracking-tight">Datos de Participación</h3>
                                                        <p className="text-[10px] md:text-xs text-neutral-500 font-bold uppercase">Métricas Generales</p>
                                                    </div>
                                                    {/* Filter Toggle — 3 opciones */}
                                                    <div className="flex flex-col items-end gap-2">
                                                        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                                                            <button
                                                                onClick={() => setGroupsFilter('ACTIVOS')}
                                                                className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded transition-all ${groupsFilter === 'ACTIVOS' ? 'bg-black text-white' : 'text-black hover:bg-slate-200'}`}
                                                            >
                                                                Activos
                                                            </button>
                                                            <button
                                                                onClick={() => setGroupsFilter('TEMPORADAS')}
                                                                className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded transition-all ${groupsFilter === 'TEMPORADAS' ? 'bg-amber-500 text-black' : 'text-black hover:bg-slate-200'}`}
                                                            >
                                                                Temporadas
                                                            </button>
                                                            <button
                                                                onClick={() => setGroupsFilter('FINALIZADOS')}
                                                                className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded transition-all ${groupsFilter === 'FINALIZADOS' ? 'bg-black text-white' : 'text-black hover:bg-slate-200'}`}
                                                            >
                                                                Finalizados
                                                            </button>
                                                        </div>

                                                        {/* Sub-filtro de temporada — visible solo en modo TEMPORADAS */}
                                                        {groupsFilter === 'TEMPORADAS' && (
                                                            <div className="flex flex-col gap-1 animate-fadeIn">
                                                                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg flex-wrap">
                                                                    {yearRange.map((year) => (
                                                                        <button
                                                                            key={year}
                                                                            onClick={() => setSelectedYear(year)}
                                                                            className={`px-3 py-1.5 text-[10px] font-black uppercase rounded transition-all ${selectedYear === year
                                                                                ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]'
                                                                                : 'text-black hover:bg-slate-200'}`}
                                                                        >
                                                                            {year}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                                <div className="flex gap-1 bg-amber-50 border-2 border-amber-400 p-1 rounded-lg">
                                                                    {(['S1', 'S2', 'S3'] as SeasonType[]).map((s) => (
                                                                        <button
                                                                            key={s}
                                                                            onClick={() => setSeasonFilter(s)}
                                                                            className={`px-3 py-1.5 text-[10px] font-black uppercase rounded transition-all ${seasonFilter === s
                                                                                ? 'bg-amber-500 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]'
                                                                                : 'text-amber-700 hover:bg-amber-100'}`}
                                                                        >
                                                                            {SEASON_LABELS[s]}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                                    {/* Card 1: Grupos */}
                                                    <div className="border-2 border-black p-4 rounded-lg bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                                        <p className="text-[10px] md:text-xs font-black uppercase text-slate-600 mb-1">
                                                            Grupos {
                                                                groupsFilter === 'ACTIVOS'
                                                                    ? 'Activos'
                                                                    : groupsFilter === 'FINALIZADOS'
                                                                        ? 'Finalizados'
                                                                        : SEASON_LABELS[seasonFilter]
                                                            }
                                                        </p>
                                                        <p className="text-3xl md:text-4xl font-black text-black">{registrationAnalytics.totalGroups}</p>
                                                        <p className="text-[10px] text-neutral-500 mt-2 font-bold select-none">Total de grupos</p>
                                                    </div>

                                                    {/* Card 2: Anfitriones */}
                                                    <div className="border-2 border-black p-4 rounded-lg bg-orange-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                                        <p className="text-[10px] md:text-xs font-black uppercase text-orange-600 mb-1">Anfitriones</p>
                                                        <p className="text-3xl md:text-4xl font-black text-black">{registrationAnalytics.totalHosts}</p>
                                                        <p className="text-[10px] text-neutral-500 mt-2 font-bold select-none">Líderes principales únicos</p>
                                                    </div>

                                                    {/* Card 2.5: Co-Anfitriones */}
                                                    <div className="border-2 border-black p-4 rounded-lg bg-yellow-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                                        <p className="text-[10px] md:text-xs font-black uppercase text-yellow-600 mb-1">Co-Anfitriones</p>
                                                        <p className="text-3xl md:text-4xl font-black text-black">{registrationAnalytics.totalCoHosts}</p>
                                                        <p className="text-[10px] text-neutral-500 mt-2 font-bold select-none">Líderes de apoyo únicos</p>
                                                    </div>

                                                    {/* Card 3: Personas Únicas */}
                                                    <div className="border-2 border-black p-4 rounded-lg bg-amber-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                                        <p className="text-[10px] md:text-xs font-black uppercase text-amber-600 mb-1">Personas Únicas</p>
                                                        <p className="text-3xl md:text-4xl font-black text-black">{registrationAnalytics.uniquePeople}</p>
                                                        <p className="text-[10px] text-neutral-500 mt-2 font-bold select-none">Usuarios distintos inscriptos</p>
                                                    </div>

                                                    {/* Card 4: Inscripciones. merged with distribution. */}
                                                    <div className="border-2 border-black p-4 rounded-lg bg-emerald-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
                                                        <div>
                                                            <p className="text-[10px] md:text-xs font-black uppercase text-emerald-600 mb-1">Inscripciones Totales</p>
                                                            <p className="text-3xl md:text-4xl font-black text-black">{registrationAnalytics.totalRegistrations}</p>
                                                        </div>
                                                        <div className="space-y-1 mt-3">
                                                            <div className="flex justify-between items-center bg-white px-2 py-0.5 rounded text-[10px] font-bold text-black border-2 border-emerald-900 border-opacity-20 shadow-[1px_1px_0px_0px_rgba(6,78,59,0.3)]"><span>1 grupo:</span> <span>{registrationAnalytics.distribution['1'] || 0}</span></div>
                                                            <div className="flex justify-between items-center bg-white px-2 py-0.5 rounded text-[10px] font-bold text-black border-2 border-emerald-900 border-opacity-20 shadow-[1px_1px_0px_0px_rgba(6,78,59,0.3)]"><span>2 grupos:</span> <span>{registrationAnalytics.distribution['2'] || 0}</span></div>
                                                            <div className="flex justify-between items-center bg-white px-2 py-0.5 rounded text-[10px] font-bold text-black border-2 border-emerald-900 border-opacity-20 shadow-[1px_1px_0px_0px_rgba(6,78,59,0.3)]"><span>3+ grupos:</span> <span>{registrationAnalytics.distribution['3+'] || 0}</span></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div className="bg-white p-4 md:p-8 border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-8">
                                                <div>
                                                    <h3 className="text-sm md:text-lg font-black text-black uppercase tracking-tight">Inscripciones por Grupo</h3>
                                                    <p className="text-[10px] md:text-xs text-neutral-500 font-bold uppercase">Total Histórico</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={handleExportGroupsCSV}
                                                        className="flex items-center gap-2 px-3 md:px-4 py-2 bg-white text-black border-2 border-black text-[10px] md:text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-black hover:text-white transition-all"
                                                    >
                                                        <Download className="w-3.5 h-3.5 md:w-4 md:h-4" /> CSV
                                                    </button>
                                                </div>
                                            </div>

                                            {(() => {
                                                // Filter groups based on active/finalized status
                                                const now = new Date();
                                                const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                                                const filteredGroups = groupsData.filter(item => {
                                                    const isFinished = item.status === 'finished' ||
                                                        (item.endDate && item.endDate < todayStr);

                                                    if (groupsFilter === 'ACTIVOS') {
                                                        return item.status === 'approved' && !isFinished;
                                                    } else if (groupsFilter === 'FINALIZADOS') {
                                                        return isFinished;
                                                    } else {
                                                        // TEMPORADAS: filtrar por startDate y año
                                                        const season = getSeasonFromDate(item.startDate);
                                                        const itemYear = item.startDate ? new Date(item.startDate + 'T12:00:00').getFullYear() : null;
                                                        return item.status === 'approved' &&
                                                               season === seasonFilter &&
                                                               itemYear === selectedYear;
                                                    }
                                                });

                                                if (filteredGroups.length === 0) {
                                                    return (
                                                        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
                                                            <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                                            <p className="text-slate-500 font-bold">No hay grupos {groupsFilter.toLowerCase()}</p>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4 mb-4 md:mb-8">
                                                            {filteredGroups.map((item, idx) => (
                                                                <div key={idx} className="flex items-center justify-between p-3 md:p-4 border-2 border-black bg-white hover:bg-amber-50 transition-colors">
                                                                    <span className="font-bold text-xs md:text-sm text-black truncate mr-2 md:mr-4">{item.name}</span>
                                                                    <span className="font-black text-lg md:text-xl text-amber-600 shrink-0">{item.value}</span>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        <div className="block h-[500px] md:h-[600px] mt-4">
                                                            <ResponsiveContainer width="100%" height="100%">
                                                                <BarChart data={filteredGroups} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                                                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e5e5" />
                                                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#000', fontSize: 10, fontWeight: 'bold' }} allowDecimals={false} />
                                                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#000', fontSize: 10, fontWeight: 'bold' }} width={100} />
                                                                    <Tooltip
                                                                        contentStyle={{ backgroundColor: '#000', border: '2px solid #000', color: '#fff', fontWeight: 'bold' }}
                                                                        cursor={{ fill: '#fef3c7' }}
                                                                        formatter={(value: number) => [`${value} inscriptos`, 'Total']}
                                                                    />
                                                                    <Bar dataKey="value" name="Inscriptos" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} label={{ position: 'right', fill: '#000', fontWeight: 'bold', fontSize: 10 }} />
                                                                </BarChart>
                                                            </ResponsiveContainer>
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </>
                                )}

                                {/* ASISTENCIAS Sub-Tab */}
                                {groupsSubTab === 'ASISTENCIAS' && (
                                    <div className="bg-white p-4 md:p-8 border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                                            <div>
                                                <h3 className="text-sm md:text-lg font-black text-black uppercase tracking-tight">Reporte Global de Asistencias</h3>
                                                <p className="text-[10px] md:text-xs text-neutral-500 font-bold uppercase">Historial completo por grupo</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                                            <div className="relative w-full sm:max-w-xs">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Buscar grupo o anfitrión..."
                                                    value={attendanceSearchQuery}
                                                    onChange={(e) => setAttendanceSearchQuery(e.target.value)}
                                                    className="w-full pl-9 pr-4 py-2 border-2 border-black rounded-lg text-xs font-bold focus:outline-none uppercase placeholder:normal-case"
                                                />
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-full sm:w-auto">
                                                    {(['ACTIVOS', 'TEMPORADAS', 'FINALIZADOS'] as AttendanceViewMode[]).map(mode => (
                                                        <button
                                                            key={mode}
                                                            onClick={() => setAttendanceFilter(mode)}
                                                            className={`flex-1 sm:flex-none px-3 py-1.5 text-[10px] font-bold uppercase rounded transition-all ${attendanceFilter === mode
                                                                ? mode === 'TEMPORADAS' ? 'bg-amber-500 text-black' : 'bg-black text-white'
                                                                : 'text-black hover:bg-slate-200'}`}
                                                        >
                                                            {mode === 'ACTIVOS' && 'Activos'}
                                                            {mode === 'TEMPORADAS' && 'Temporadas'}
                                                            {mode === 'FINALIZADOS' && 'Finalizados'}
                                                        </button>
                                                    ))}
                                                </div>
                                                {attendanceFilter === 'TEMPORADAS' && (
                                                    <div className="flex flex-col gap-1 animate-fadeIn">
                                                        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg flex-wrap">
                                                            {yearRange.map((year) => (
                                                                <button
                                                                    key={year}
                                                                    onClick={() => setSelectedYear(year)}
                                                                    className={`px-3 py-1.5 text-[10px] font-black uppercase rounded transition-all ${selectedYear === year
                                                                        ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]'
                                                                        : 'text-black hover:bg-slate-200'}`}
                                                                >
                                                                    {year}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <div className="flex gap-1 bg-amber-50 border-2 border-amber-400 p-1 rounded-lg">
                                                            {(['S1', 'S2', 'S3'] as SeasonType[]).map(s => (
                                                                <button
                                                                    key={s}
                                                                    onClick={() => setAttendanceSeasonFilter(s)}
                                                                    className={`px-3 py-1.5 text-[10px] font-black uppercase rounded transition-all ${attendanceSeasonFilter === s
                                                                        ? 'bg-amber-500 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]'
                                                                        : 'text-amber-700 hover:bg-amber-100'}`}
                                                                >
                                                                    {SEASON_LABELS[s]}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {(() => {
                                            const now = new Date();
                                            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                                            const filtered = fullAttendanceReport.filter(row => {
                                                const matchesSearch =
                                                    row.groupName.toLowerCase().includes(attendanceSearchQuery.toLowerCase()) ||
                                                    row.leaderName.toLowerCase().includes(attendanceSearchQuery.toLowerCase());
                                                const isFinished = row.status === 'finished' ||
                                                    (row.endDate && row.endDate < todayStr);

                                                if (attendanceFilter === 'ACTIVOS') return matchesSearch && !isFinished;
                                                if (attendanceFilter === 'FINALIZADOS') return matchesSearch && !!isFinished;
                                                const season = getSeasonFromDate(row.startDate);
                                                const rowYear = row.startDate ? new Date(row.startDate + 'T12:00:00').getFullYear() : null;
                                                return matchesSearch && season === attendanceSeasonFilter && rowYear === selectedYear;
                                            });

                                            if (filtered.length === 0) {
                                                return (
                                                    <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
                                                        <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                                        <p className="text-slate-500 font-bold">No hay grupos que coincidan</p>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="space-y-3">
                                                    {filtered.map(row => {
                                                        const isExpanded = expandedAttendanceGroupId === row.groupId;
                                                        const expectedDates = getExpectedMeetingDates(
                                                            row.meetingDay,
                                                            row.startDate,
                                                            row.endDate
                                                        );
                                                        const recordsByDate = new Map(
                                                            row.attendanceRecords.map(r => [r.date, r])
                                                        );
                                                        const isFinished = row.status === 'finished' ||
                                                            (row.endDate && row.endDate < todayStr);

                                                        return (
                                                            <div key={row.groupId} className="border-2 border-black rounded-xl overflow-hidden shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setExpandedAttendanceGroupId(isExpanded ? null : row.groupId)}
                                                                    className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-neutral-50 transition-colors text-left"
                                                                >
                                                                    <div className="flex items-center gap-3 min-w-0">
                                                                        <div className="min-w-0">
                                                                            <p className="font-black text-sm text-black uppercase tracking-tight truncate">{row.groupName}</p>
                                                                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">
                                                                                {row.meetingDay}{row.meetingTime ? ` · ${row.meetingTime}` : ''} · {row.allMembers.length} miembros · {row.attendanceRecords.length} registros
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 shrink-0 ml-3">
                                                                        {isFinished && (
                                                                            <span className="px-2 py-1 text-[9px] font-black uppercase bg-neutral-100 text-neutral-500 rounded">Finalizado</span>
                                                                        )}
                                                                        {isExpanded
                                                                            ? <ChevronUp className="w-4 h-4 text-neutral-400" />
                                                                            : <ChevronDown className="w-4 h-4 text-neutral-400" />
                                                                        }
                                                                    </div>
                                                                </button>

                                                                {isExpanded && (
                                                                    <div className="border-t-2 border-black bg-neutral-50 divide-y divide-neutral-200">
                                                                        {expectedDates.length === 0 && (
                                                                            <div className="px-4 py-6 text-center">
                                                                                <p className="text-xs font-bold text-neutral-400 uppercase">Sin fechas de reunión calculadas</p>
                                                                            </div>
                                                                        )}
                                                                        {expectedDates.map(date => {
                                                                            const record = recordsByDate.get(date);
                                                                            const hasRecord = !!record;
                                                                            const fmtDate = new Date(date + 'T12:00:00').toLocaleDateString('es-AR', {
                                                                                weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric'
                                                                            });

                                                                            return (
                                                                                <div key={date} className="flex items-center px-4 py-3 gap-3">
                                                                                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${hasRecord ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
                                                                                    <span className="text-xs font-black text-black uppercase tracking-wide w-44 shrink-0">{fmtDate}</span>
                                                                                    {hasRecord && record ? (
                                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    setAttendanceModalData({ groupName: row.groupName, date, type: 'present', members: record.presentMembers });
                                                                                                    setAttendanceModalOpen(true);
                                                                                                }}
                                                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 border border-emerald-300 rounded text-[10px] font-bold uppercase hover:bg-emerald-200 transition-colors"
                                                                                            >
                                                                                                <CheckCircle className="w-3 h-3" /> {record.totalPresent} presentes
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    setAttendanceModalData({ groupName: row.groupName, date, type: 'absent', members: record.absentMembers });
                                                                                                    setAttendanceModalOpen(true);
                                                                                                }}
                                                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 border border-red-300 rounded text-[10px] font-bold uppercase hover:bg-red-200 transition-colors"
                                                                                            >
                                                                                                <XCircle className="w-3 h-3" /> {record.totalAbsent} ausentes
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    const csvData = row.allMembers.map(m => ({
                                                                                                        Nombre: m.name,
                                                                                                        Estado: record.presentMembers.some(p => p.id === m.id) ? 'Presente' : 'Ausente'
                                                                                                    }));
                                                                                                    handleExportToCSV(csvData, `asistencia_${row.groupName.replace(/\s+/g, '_')}_${date}`);
                                                                                                }}
                                                                                                className="p-1.5 border border-black rounded hover:bg-black hover:text-white transition-all"
                                                                                                title="Descargar CSV"
                                                                                            >
                                                                                                <Download className="w-3.5 h-3.5" />
                                                                                            </button>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">Sin reporte</span>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* BAJAS Sub-Tab */}
                                {groupsSubTab === 'BAJAS' && (
                                    <div className="bg-white p-4 md:p-8 border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                                            <div>
                                                <h3 className="text-sm md:text-lg font-black text-black uppercase tracking-tight">Reporte de Bajas</h3>
                                                <p className="text-[10px] md:text-xs text-neutral-500 font-bold uppercase">Historial de solicitudes</p>
                                            </div>
                                            {/* Type Toggle */}
                                            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                                                <button
                                                    onClick={() => setBajasType('INSCRIPCIONES')}
                                                    className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded transition-all ${bajasType === 'INSCRIPCIONES' ? 'bg-black text-white' : 'text-black hover:bg-slate-200'
                                                        }`}
                                                >
                                                    Inscripciones
                                                </button>
                                                <button
                                                    onClick={() => setBajasType('GRUPOS')}
                                                    className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded transition-all ${bajasType === 'GRUPOS' ? 'bg-black text-white' : 'text-black hover:bg-slate-200'
                                                        }`}
                                                >
                                                    Grupos
                                                </button>
                                            </div>
                                        </div>

                                        {/* Filter and display dropout requests */}
                                        {(() => {
                                            const filtered = dropoutRequests.filter(r =>
                                                bajasType === 'INSCRIPCIONES' ? r.requestType === 'USER' : r.requestType === 'GROUP'
                                            );

                                            if (filtered.length === 0) {
                                                return (
                                                    <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
                                                        <UserMinus className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                                        <p className="text-slate-500 font-bold">No hay solicitudes de baja</p>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <>
                                                    {/* Mobile Cards */}
                                                    <div className="md:hidden space-y-3">
                                                        {filtered.map((req) => (
                                                            <div key={req.id} className="border-2 border-black rounded-lg p-4 bg-white">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded ${req.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                                                                        req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                                                        }`}>
                                                                        {req.status === 'PENDING' ? 'Pendiente' : req.status === 'APPROVED' ? 'Resuelto' : 'Rechazado'}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-500">{new Date(req.createdAt).toLocaleDateString('es-AR')}</span>
                                                                </div>
                                                                {bajasType === 'INSCRIPCIONES' && (
                                                                    <p className="font-bold text-sm">{req.targetUserName || 'Usuario desconocido'}</p>
                                                                )}
                                                                <p className="text-xs text-slate-600">{req.groupName}</p>
                                                                <p className="text-xs text-slate-500 mt-2">{req.reason}</p>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Desktop Table */}
                                                    <div className="hidden md:block overflow-x-auto">
                                                        <table className="w-full border-2 border-black">
                                                            <thead className="bg-black text-white">
                                                                <tr>
                                                                    <th className="px-4 py-3 text-left text-xs font-black uppercase">Estado</th>
                                                                    {bajasType === 'INSCRIPCIONES' && <th className="px-4 py-3 text-left text-xs font-black uppercase">Usuario</th>}
                                                                    <th className="px-4 py-3 text-left text-xs font-black uppercase">Grupo</th>
                                                                    <th className="px-4 py-3 text-left text-xs font-black uppercase">Motivo</th>
                                                                    <th className="px-4 py-3 text-center text-xs font-black uppercase">Descargar</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {filtered.map((req) => (
                                                                    <tr key={req.id} className="border-b border-slate-200 hover:bg-slate-50">
                                                                        <td className="px-4 py-3">
                                                                            <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded ${req.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                                                                                req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                                                                }`}>
                                                                                {req.status === 'PENDING' ? 'Pendiente' : req.status === 'APPROVED' ? 'Resuelto' : 'Rechazado'}
                                                                            </span>
                                                                        </td>
                                                                        {bajasType === 'INSCRIPCIONES' && (
                                                                            <td className="px-4 py-3 font-bold text-sm">{req.targetUserName || 'Usuario desconocido'}</td>
                                                                        )}
                                                                        <td className="px-4 py-3 text-sm">{req.groupName}</td>
                                                                        <td className="px-4 py-3">
                                                                            <p className="text-sm font-medium">{req.reason}</p>
                                                                            <p className="text-[10px] text-slate-400">{new Date(req.createdAt).toLocaleDateString('es-AR')}</p>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center">
                                                                            <button
                                                                                onClick={() => {
                                                                                    const csvData = [{
                                                                                        Estado: req.status,
                                                                                        Usuario: req.targetUserName || '-',
                                                                                        Grupo: req.groupName,
                                                                                        Motivo: req.reason,
                                                                                        Fecha: new Date(req.createdAt).toLocaleDateString('es-AR')
                                                                                    }];
                                                                                    handleExportToCSV(csvData, `baja_${req.id}`);
                                                                                }}
                                                                                className="p-2 border-2 border-black rounded hover:bg-black hover:text-white transition-all"
                                                                            >
                                                                                <Download className="w-4 h-4" />
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>

                                                    {/* CSV Export All Button */}
                                                    <div className="mt-4 flex justify-end">
                                                        <button
                                                            onClick={() => {
                                                                const csvData = filtered.map(r => ({
                                                                    Estado: r.status === 'PENDING' ? 'Pendiente' : r.status === 'APPROVED' ? 'Resuelto' : 'Rechazado',
                                                                    Usuario: r.targetUserName || '-',
                                                                    Grupo: r.groupName,
                                                                    Motivo: r.reason,
                                                                    Fecha: new Date(r.createdAt).toLocaleDateString('es-AR')
                                                                }));
                                                                handleExportToCSV(csvData, `bajas_${bajasType.toLowerCase()}`);
                                                            }}
                                                            className="flex items-center gap-2 px-4 py-2 bg-black text-white text-xs font-bold uppercase rounded hover:bg-slate-800 transition-all"
                                                        >
                                                            <Download className="w-4 h-4" /> Exportar Todo
                                                        </button>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* INTERACCIONES Sub-Tab */}
                                {groupsSubTab === 'INTERACCIONES' && (
                                    <InteractionsDashboard />
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Attendance Modal */}
            <NeoModal
                isOpen={attendanceModalOpen}
                onClose={() => { setAttendanceModalOpen(false); setAttendanceModalData(null); }}
                title={attendanceModalData?.type === 'present' ? 'Miembros Presentes' : 'Miembros Ausentes'}
            >
                {attendanceModalData && (
                    <div className="p-4 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                            <div>
                                <p className="font-black text-sm uppercase tracking-tight">{attendanceModalData.groupName}</p>
                                <p className="text-xs font-bold text-neutral-400 mt-0.5">
                                    {new Date(attendanceModalData.date + 'T12:00:00').toLocaleDateString('es-AR', {
                                        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
                                    })}
                                </p>
                            </div>
                            <span className={`px-2 py-1 text-[10px] font-black uppercase rounded ${attendanceModalData.type === 'present' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {attendanceModalData.members.length} {attendanceModalData.type === 'present' ? 'presentes' : 'ausentes'}
                            </span>
                        </div>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {attendanceModalData.members.length === 0 ? (
                                <p className="text-center py-6 text-slate-400 font-medium">No hay miembros en esta categoría</p>
                            ) : (
                                attendanceModalData.members.map(member => (
                                    <div
                                        key={member.id}
                                        className={`flex items-center gap-3 p-3 rounded-lg border-2 ${attendanceModalData.type === 'present' ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}
                                    >
                                        {attendanceModalData.type === 'present'
                                            ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                            : <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                                        }
                                        <span className="font-medium text-sm">{member.name}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </NeoModal>
        </div>
    );
};

export default Pastores;
