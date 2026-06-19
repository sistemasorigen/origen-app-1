import React, { useState, useEffect } from 'react';
import { supabaseService } from '../../services/supabaseService';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import { Download, Users } from 'lucide-react';

interface InteractionsDashboardProps {
    selectedYear: number;
    seasonFilter: 'S1' | 'S2' | 'S3' | null;
    groupsFilter: 'ACTIVOS' | 'FINALIZADOS' | 'TEMPORADAS';
}

const SEASON_RANGES = {
    S1: { start: '03-23', end: '05-17', label: '1ª Temp.' },
    S2: { start: '06-29', end: '08-23', label: '2ª Temp.' },
    S3: { start: '10-05', end: '11-29', label: '3ª Temp.' },
};

const getDateRange = (
    year: number,
    season: 'S1' | 'S2' | 'S3'
): { startDate: string; endDate: string; label: string } => {
    const r = SEASON_RANGES[season];
    return {
        startDate: `${year}-${r.start}`,
        endDate: `${year}-${r.end}`,
        label: `${r.label} ${year}`
    };
};

type GenderData = {
    totalMasculino: number;
    totalFemenino: number;
    totalSinDatos: number;
    byCategory: {
        categoryId: string;
        categoryName: string;
        categoryColor: string;
        total: number;
        masculino: number;
        femenino: number;
        sinDatos: number;
    }[];
};

const currentYear = new Date().getFullYear();
const yearRange = Array.from({ length: 6 }, (_, i) => currentYear - 1 + i);

const InteractionsDashboard: React.FC<InteractionsDashboardProps> = ({
    selectedYear,
    seasonFilter,
}) => {
    const [localYear, setLocalYear] = useState(selectedYear);
    const [localSeason, setLocalSeason] = useState<'S1' | 'S2' | 'S3'>(seasonFilter ?? 'S1');
    const [loading, setLoading] = useState(false);
    const [genderData, setGenderData] = useState<GenderData | null>(null);

    // Sync when parent changes
    useEffect(() => { setLocalYear(selectedYear); }, [selectedYear]);
    useEffect(() => { if (seasonFilter) setLocalSeason(seasonFilter); }, [seasonFilter]);

    const fetchAll = async (year: number, season: 'S1' | 'S2' | 'S3') => {
        setLoading(true);
        try {
            const data = await supabaseService.getGenderAnalyticsByCategory(
                year,
                season
            );
            setGenderData(data);
        } catch (err) {
            console.error('[Interacciones] Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll(localYear, localSeason);
    }, [localYear, localSeason]);

    const { label } = getDateRange(localYear, localSeason);

    const totalInscritos =
        (genderData?.totalMasculino ?? 0) +
        (genderData?.totalFemenino ?? 0) +
        (genderData?.totalSinDatos ?? 0);

    const chartData = (genderData?.byCategory || []).map(cat => ({
        name: cat.categoryName.length > 18
            ? cat.categoryName.substring(0, 16) + '…'
            : cat.categoryName,
        fullName: cat.categoryName,
        Hombres: cat.masculino,
        Mujeres: cat.femenino,
        'No especificado': cat.sinDatos,
        color: cat.categoryColor,
    }));

    return (
        <>
            <style>{`
                @media print {
                    @page { margin: 10mm; }
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                    .no-print { display: none !important; }
                    .print-break { 
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    
                    /* Fix overlap between Navbar Logo and content */
                    #main-content > div {
                        margin-top: 0 !important;
                    }
                    header {
                        position: static !important;
                        background: transparent !important;
                        backdrop-filter: none !important;
                        border: none !important;
                    }
                    
                    #interacciones-print-area {
                        border: none !important;
                        box-shadow: none !important;
                        padding: 0 !important;
                        background: transparent !important;
                    }
                }
            `}</style>

            <div
                id="interacciones-print-area"
                className="bg-white p-4 md:p-8 border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            >

                {/* HEADER */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <h3 className="text-sm md:text-lg font-black text-black uppercase tracking-tight">
                            Interacciones
                        </h3>
                        <p className="text-[10px] md:text-xs font-bold uppercase text-neutral-500">
                            {label} · {totalInscritos} inscriptos
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap no-print">
                        {/* Año */}
                        <select
                            value={localYear}
                            onChange={e => setLocalYear(Number(e.target.value))}
                            className="px-3 py-2 border-2 border-black text-[10px] font-black uppercase bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        >
                            {yearRange.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>

                        {/* Temporada */}
                        <div className="flex gap-1 bg-slate-100 p-1">
                            {(['S1', 'S2', 'S3'] as const).map(s => (
                                <button
                                    key={s}
                                    onClick={() => setLocalSeason(s)}
                                    className={`px-3 py-1.5 text-[10px] font-black uppercase transition-all ${
                                        localSeason === s
                                            ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]'
                                            : 'text-black hover:bg-slate-200'
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>

                        {/* PDF */}
                        <button
                            onClick={() => window.print()}
                            className="flex items-center gap-2 px-4 py-2 bg-black text-white border-2 border-black text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-neutral-800 transition-all"
                        >
                            <Download className="w-3.5 h-3.5" />
                            PDF
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="h-64 flex items-center justify-center border-2 border-dashed border-slate-200">
                        <p className="text-slate-400 font-bold animate-pulse uppercase text-xs">
                            Cargando datos...
                        </p>
                    </div>
                ) : !genderData || totalInscritos === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-slate-200">
                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-bold uppercase text-xs">
                            Sin datos para el período seleccionado
                        </p>
                    </div>
                ) : (
                    <>
                        {/* SECCIÓN 1: KPIs DE GÉNERO */}
                        <div className="mb-8">
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">
                                Inscriptos por género
                            </p>
                            <div className="grid grid-cols-3 gap-3">

                                <div className="border-2 border-black p-4 bg-blue-50 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 mb-1">
                                        Hombres
                                    </p>
                                    <p className="text-4xl md:text-5xl font-black tabular-nums text-black leading-none">
                                        {genderData.totalMasculino}
                                    </p>
                                    <p className="text-[10px] font-bold text-neutral-400 mt-1">
                                        {totalInscritos > 0
                                            ? Math.round((genderData.totalMasculino / totalInscritos) * 100)
                                            : 0}% del total
                                    </p>
                                </div>

                                <div className="border-2 border-black p-4 bg-pink-50 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-pink-500 mb-1">
                                        Mujeres
                                    </p>
                                    <p className="text-4xl md:text-5xl font-black tabular-nums text-black leading-none">
                                        {genderData.totalFemenino}
                                    </p>
                                    <p className="text-[10px] font-bold text-neutral-400 mt-1">
                                        {totalInscritos > 0
                                            ? Math.round((genderData.totalFemenino / totalInscritos) * 100)
                                            : 0}% del total
                                    </p>
                                </div>

                                <div className="border-2 border-neutral-200 p-4 bg-neutral-50">
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-1">
                                        No especificado
                                    </p>
                                    <p className="text-4xl md:text-5xl font-black tabular-nums text-neutral-300 leading-none">
                                        {genderData.totalSinDatos}
                                    </p>
                                    <p className="text-[10px] font-bold text-neutral-300 mt-1">
                                        {totalInscritos > 0
                                            ? Math.round((genderData.totalSinDatos / totalInscritos) * 100)
                                            : 0}% del total
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* SECCIÓN 2: GRÁFICO GÉNERO POR CATEGORÍA */}
                        {chartData.length > 0 && (
                            <div className="mb-8 print-break">
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">
                                    Mujeres y varones por categoría
                                </p>
                                <div className="border-2 border-black p-4 bg-white">
                                    <div style={{ height: Math.max(200, chartData.length * 52) }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={chartData}
                                                layout="vertical"
                                                margin={{ top: 5, right: 60, left: 8, bottom: 5 }}
                                            >
                                                <CartesianGrid
                                                    strokeDasharray="3 3"
                                                    horizontal={false}
                                                    vertical={true}
                                                    stroke="#f0f0f0"
                                                />
                                                <XAxis
                                                    type="number"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: '700' }}
                                                    allowDecimals={false}
                                                />
                                                <YAxis
                                                    type="category"
                                                    dataKey="name"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#000', fontSize: 10, fontWeight: '700' }}
                                                    width={130}
                                                />
                                                <Tooltip
                                                    contentStyle={{
                                                        background: '#000',
                                                        border: '2px solid #000',
                                                        borderRadius: 0,
                                                        color: '#fff',
                                                        fontWeight: 700,
                                                        fontSize: 11
                                                    }}
                                                    formatter={(value: number, name: string) => [value, name]}
                                                />
                                                <Legend
                                                    wrapperStyle={{
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        textTransform: 'uppercase'
                                                    }}
                                                />
                                                <Bar dataKey="Hombres" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                                                <Bar dataKey="Mujeres" stackId="a" fill="#ec4899" radius={[0, 0, 0, 0]} />
                                                <Bar dataKey="No especificado" stackId="a" fill="#e5e7eb" radius={[0, 2, 2, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SECCIÓN 3: RANKING POR CATEGORÍA */}
                        <div className="print-break">
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">
                                Inscriptos por categoría — total
                            </p>
                            <div className="space-y-1.5">
                                {genderData.byCategory.map((cat, idx) => {
                                    const maxTotal = genderData.byCategory[0]?.total || 1;
                                    const pct = Math.round((cat.total / maxTotal) * 100);
                                    const pctOfGrand = totalInscritos > 0
                                        ? Math.round((cat.total / totalInscritos) * 100)
                                        : 0;

                                    return (
                                        <div
                                            key={cat.categoryId}
                                            className="flex items-center gap-3 px-3 py-2.5 border-2 border-black bg-white hover:bg-amber-50 transition-colors"
                                        >
                                            <span className="text-[10px] font-black text-neutral-300 w-6 shrink-0 tabular-nums">
                                                {String(idx + 1).padStart(2, '0')}
                                            </span>

                                            <div
                                                className="w-3 h-3 border border-black shrink-0"
                                                style={{ backgroundColor: cat.categoryColor }}
                                            />

                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-xs text-black truncate mb-1">
                                                    {cat.categoryName}
                                                </p>
                                                <div className="h-1 bg-neutral-100 w-full">
                                                    <div
                                                        className="h-full bg-amber-500 transition-all duration-500"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <span className="font-black text-xl text-amber-500 tabular-nums block">
                                                    {cat.total}
                                                </span>
                                                <span className="text-[9px] font-bold text-neutral-400 tabular-nums">
                                                    {pctOfGrand}% · {cat.masculino}H · {cat.femenino}M
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}

                {/* Pie de página — solo en print */}
                <div className="hidden print:block mt-8 pt-4 border-t-2 border-black">
                    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">
                        Reporte Interacciones · {label} · Total inscriptos: {totalInscritos}
                    </p>
                    <p className="text-[9px] text-neutral-300 mt-1">
                        Generado {new Date().toLocaleDateString('es-AR')} · Sistema Origen
                    </p>
                </div>

            </div>
        </>
    );
};

export default InteractionsDashboard;
