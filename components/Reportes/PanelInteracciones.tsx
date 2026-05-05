import React, { useState, useEffect } from 'react';
import { supabaseService } from '../../services/supabaseService';
import { Download, Calendar, Filter } from 'lucide-react';
import AnalyticsReportModal from './ModalReporteAnaliticas';

type ViewType = 'CATEGORIAS' | 'ETIQUETAS';
type GroupStatusFilter = 'ACTIVOS' | 'FINALIZADOS' | 'TODOS';

interface CategoryData {
    categoryId: string;
    categoryName: string;
    categoryColor: string;
    count: number;
    percentage: number;
}

interface TagData {
    tagName: string;
    count: number;
    percentage: number;
}

const InteractionsDashboard: React.FC = () => {
    const [viewType, setViewType] = useState<ViewType>('CATEGORIAS');
    const [groupStatus, setGroupStatus] = useState<GroupStatusFilter>('ACTIVOS');
    const [loading, setLoading] = useState(false);
    const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
    const [tagData, setTagData] = useState<TagData[]>([]);
    const [reportModalOpen, setReportModalOpen] = useState(false);

    // Date range (default: last 30 days)
    const today = new Date().toISOString().split('T')[0];
    const lastMonth = new Date();
    lastMonth.setDate(lastMonth.getDate() - 30);
    const defaultStart = lastMonth.toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(defaultStart);
    const [endDate, setEndDate] = useState(today);

    // Fetch data when filters change
    useEffect(() => {
        fetchData();
    }, [viewType, groupStatus, startDate, endDate]);

    const fetchData = async () => {
        if (!startDate || !endDate) return;

        setLoading(true);
        try {
            if (viewType === 'CATEGORIAS') {
                const data = await supabaseService.getGroupAnalyticsByCategory(startDate, endDate, groupStatus);
                setCategoryData(data);
            } else {
                const data = await supabaseService.getGroupAnalyticsByTags(startDate, endDate, groupStatus);
                setTagData(data);
            }
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const currentData = viewType === 'CATEGORIAS' ? categoryData : tagData;
    const maxCount = currentData.length > 0 ? Math.max(...currentData.map(d => 'count' in d ? d.count : 0)) : 0;

    return (
        <div className="bg-white p-4 md:p-8 border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                <div>
                    <h3 className="text-sm md:text-lg font-black text-black uppercase tracking-tight">Interacciones</h3>
                    <p className="text-[10px] md:text-xs text-neutral-500 font-bold uppercase">Análisis de Preferencias</p>
                </div>
                <button
                    onClick={() => setReportModalOpen(true)}
                    className="flex items-center gap-2 px-3 md:px-4 py-2 bg-black text-white border-2 border-black text-[10px] md:text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-neutral-800 transition-all"
                >
                    <Download className="w-3.5 h-3.5 md:w-4 md:h-4" /> REPORTAR
                </button>
            </div>

            {/* Controls Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                {/* View Type Toggle */}
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase text-neutral-600 flex items-center gap-1">
                        <Filter className="w-3 h-3" /> Vista
                    </label>
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setViewType('CATEGORIAS')}
                            className={`flex-1 px-3 py-2 text-[10px] font-bold uppercase rounded transition-all ${viewType === 'CATEGORIAS' ? 'bg-black text-white' : 'text-black hover:bg-slate-200'
                                }`}
                        >
                            Categorías
                        </button>
                        <button
                            onClick={() => setViewType('ETIQUETAS')}
                            className={`flex-1 px-3 py-2 text-[10px] font-bold uppercase rounded transition-all ${viewType === 'ETIQUETAS' ? 'bg-black text-white' : 'text-black hover:bg-slate-200'
                                }`}
                        >
                            Etiquetas
                        </button>
                    </div>
                </div>

                {/* Group Status Filter */}
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase text-neutral-600 flex items-center gap-1">
                        <Filter className="w-3 h-3" /> Estado
                    </label>
                    <select
                        value={groupStatus}
                        onChange={(e) => setGroupStatus(e.target.value as GroupStatusFilter)}
                        className="w-full px-3 py-2 border-2 border-black text-xs font-bold uppercase bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-50 transition-all cursor-pointer"
                    >
                        <option value="ACTIVOS">Activos</option>
                        <option value="FINALIZADOS">Finalizados</option>
                        <option value="TODOS">Todos</option>
                    </select>
                </div>

                {/* Date Range */}
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase text-neutral-600 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Rango de Fechas
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="flex-1 px-2 py-2 border-2 border-black text-[10px] font-bold bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        />
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="flex-1 px-2 py-2 border-2 border-black text-[10px] font-bold bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        />
                    </div>
                </div>
            </div>

            {/* Data Visualization */}
            {loading ? (
                <div className="h-64 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-lg">
                    <p className="text-slate-400 font-bold animate-pulse">Cargando datos...</p>
                </div>
            ) : currentData.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
                    <Filter className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-bold">No hay datos para los filtros seleccionados</p>
                    <p className="text-slate-400 text-xs mt-2">Intenta ajustar el rango de fechas o el estado del grupo</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {viewType === 'CATEGORIAS' ? (
                        // Category Cards
                        categoryData.map((cat, idx) => (
                            <div
                                key={idx}
                                className="p-4 border-2 border-black rounded-lg bg-white hover:bg-amber-50 transition-colors"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-4 h-4 rounded border-2 border-black"
                                            style={{ backgroundColor: cat.categoryColor }}
                                        />
                                        <span className="font-black text-sm uppercase">{cat.categoryName}</span>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-2xl text-amber-600">{cat.count}</p>
                                        <p className="text-[10px] font-bold text-neutral-500">{cat.percentage}%</p>
                                    </div>
                                </div>
                                {/* Progress Bar */}
                                <div className="w-full h-3 bg-slate-100 border-2 border-black rounded overflow-hidden">
                                    <div
                                        className="h-full bg-amber-500 transition-all duration-500"
                                        style={{ width: `${(cat.count / maxCount) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))
                    ) : (
                        // Tag Cards
                        tagData.map((tag, idx) => (
                            <div
                                key={idx}
                                className="p-4 border-2 border-black rounded-lg bg-white hover:bg-blue-50 transition-colors"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-black text-sm uppercase">{tag.tagName}</span>
                                    <div className="text-right">
                                        <p className="font-black text-2xl text-blue-600">{tag.count}</p>
                                        <p className="text-[10px] font-bold text-neutral-500">{tag.percentage}%</p>
                                    </div>
                                </div>
                                {/* Progress Bar */}
                                <div className="w-full h-3 bg-slate-100 border-2 border-black rounded overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 transition-all duration-500"
                                        style={{ width: `${(tag.count / maxCount) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Report Modal */}
            <AnalyticsReportModal
                isOpen={reportModalOpen}
                onClose={() => setReportModalOpen(false)}
            />
        </div>
    );
};

export default InteractionsDashboard;
