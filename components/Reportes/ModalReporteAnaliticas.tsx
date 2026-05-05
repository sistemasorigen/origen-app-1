import React, { useState } from 'react';
import { supabaseService } from '../../services/supabaseService';
import { Download, X, Calendar, Filter } from 'lucide-react';

interface AnalyticsReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type ExportType = 'CATEGORIAS' | 'ETIQUETAS' | 'TODAS';
type GroupStatusFilter = 'ACTIVOS' | 'FINALIZADOS' | 'TODOS';

const AnalyticsReportModal: React.FC<AnalyticsReportModalProps> = ({ isOpen, onClose }) => {
    const [exportType, setExportType] = useState<ExportType>('TODAS');
    const [groupStatus, setGroupStatus] = useState<GroupStatusFilter>('ACTIVOS');
    const [loading, setLoading] = useState(false);

    // Date range (default: last 30 days)
    const today = new Date().toISOString().split('T')[0];
    const lastMonth = new Date();
    lastMonth.setDate(lastMonth.getDate() - 30);
    const defaultStart = lastMonth.toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(defaultStart);
    const [endDate, setEndDate] = useState(today);

    const handleDownload = async () => {
        if (!startDate || !endDate) {
            alert('Por favor selecciona un rango de fechas válido.');
            return;
        }

        setLoading(true);
        try {
            // Fetch detailed data for export
            const data = await supabaseService.getDetailedAnalyticsForExport(
                exportType,
                startDate,
                endDate,
                groupStatus
            );

            if (data.length === 0) {
                alert('No hay datos para exportar con los filtros seleccionados.');
                setLoading(false);
                return;
            }

            // Generate CSV
            const headers = ['Tipo', 'Nombre', 'Cantidad Inscritos', 'Estado Grupo', 'Fecha Inicio'];
            const rows = data.map(row => [
                row.tipo,
                row.nombre,
                row.cantidadInscritos.toString(),
                row.estadoGrupo,
                row.fechaInicio
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            // Create blob with BOM for proper Spanish character encoding
            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const filename = `analytics_${exportType.toLowerCase()}_${startDate}_${endDate}.csv`;

            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Close modal after successful download
            setTimeout(() => {
                onClose();
            }, 500);
        } catch (error) {
            console.error('Error generating report:', error);
            alert('Error al generar el reporte. Por favor intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-lg w-full animate-slideUp">
                {/* Header */}
                <div className="flex items-center justify-between p-4 md:p-6 border-b-4 border-black bg-black text-white">
                    <div>
                        <h2 className="text-lg md:text-xl font-black uppercase tracking-tight">Exportar Reporte</h2>
                        <p className="text-[10px] md:text-xs font-bold uppercase text-amber-500">Analytics de Interacciones</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 transition-colors rounded"
                        aria-label="Cerrar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 md:p-6 space-y-4">
                    {/* Export Type */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-black uppercase text-neutral-600 flex items-center gap-1">
                            <Filter className="w-3 h-3" /> Tipo de Reporte
                        </label>
                        <select
                            value={exportType}
                            onChange={(e) => setExportType(e.target.value as ExportType)}
                            className="w-full px-3 py-2 border-2 border-black text-xs font-bold uppercase bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-50 transition-all cursor-pointer"
                        >
                            <option value="CATEGORIAS">Solo Categorías</option>
                            <option value="ETIQUETAS">Solo Etiquetas</option>
                            <option value="TODAS">Todas (Categorías + Etiquetas)</option>
                        </select>
                    </div>

                    {/* Group Status */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-black uppercase text-neutral-600 flex items-center gap-1">
                            <Filter className="w-3 h-3" /> Estado del Grupo
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
                        <label className="text-xs font-black uppercase text-neutral-600 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Rango de Fechas *
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] font-bold text-neutral-500 uppercase mb-1 block">Desde</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full px-2 py-2 border-2 border-black text-xs font-bold bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-neutral-500 uppercase mb-1 block">Hasta</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full px-2 py-2 border-2 border-black text-xs font-bold bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Info Box */}
                    <div className="p-3 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50">
                        <p className="text-[10px] font-bold text-slate-600">
                            📊 El archivo CSV incluirá: <strong>Tipo</strong>, <strong>Nombre</strong>, <strong>Cantidad Inscritos</strong>, <strong>Estado Grupo</strong>, y <strong>Fecha Inicio</strong>.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 md:p-6 border-t-2 border-slate-200 bg-slate-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-black uppercase border-2 border-black bg-white hover:bg-slate-100 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleDownload}
                        disabled={loading || !startDate || !endDate}
                        className="px-4 py-2 text-xs font-black uppercase border-2 border-black bg-black text-white hover:bg-neutral-800 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        {loading ? 'Generando...' : 'Descargar Datos'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsReportModal;
