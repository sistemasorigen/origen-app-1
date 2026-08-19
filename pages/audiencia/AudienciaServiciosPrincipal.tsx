import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import {
    Plus, Eye, GitCompareArrows, Pencil, Trash2, ArrowLeft,
    TrendingUp, TrendingDown, Minus, ChevronUp, ChevronDown, Check,
    X, AlertTriangle, ChevronRight, Calendar, Search, SlidersHorizontal, Clock, CalendarDays,
    BarChart3
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import NeoModal from '../../components/ui/NeoModal';

interface PastoralCareDashboardProps { currentUser: User | null; }

// ─── FilterChip ────────────────────────────────────────────────────────────

interface FilterChipOption { label: string; value: string; }

const FilterChip: React.FC<{
    label: string;
    value: string;
    options: FilterChipOption[];
    onChange: (v: string) => void;
    activeColor?: string; // tailwind bg+border classes when active
}> = ({ label, value, options, onChange, activeColor = 'bg-black border-black text-white' }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const active = value !== '';
    const selectedLabel = active ? options.find(o => o.value === value)?.label ?? label : label;

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={`w-full flex items-center justify-between gap-1.5 px-3 py-2.5 rounded-lg border text-xs font-bold transition-colors
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2
                    ${active
                        ? `${activeColor} border-transparent`
                        : 'border-slate-300 bg-white text-black hover:bg-slate-50'
                    }`}
            >
                <span className="truncate">{selectedLabel}</span>
                {active
                    ? <X className="w-3.5 h-3.5 shrink-0 opacity-70" onClick={(e) => { e.stopPropagation(); onChange(''); setOpen(false); }} />
                    : <ChevronDown className={`w-3.5 h-3.5 shrink-0 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`} />
                }
            </button>

            {open && (
                <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className={`w-full text-left px-3 py-2.5 text-xs font-bold transition-colors
                                ${value === opt.value
                                    ? 'bg-black text-white'
                                    : 'text-black hover:bg-slate-100'
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Calculation helpers ───────────────────────────────────────────────────

const getWeekOfMonth = (dateString: string | Date): number => {
    const date = new Date(dateString);
    return Math.ceil(date.getDate() / 7);
};

const generateYoYKey = (dateString: string | Date): string => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const weekIndex = getWeekOfMonth(date);
    return `${month}-${weekIndex}`;
};

const calcStats = (r: any) => {
    const volFields = [
        r.conecta, r.store, r.host_prevencion, r.punto_info, r.produccion,
        r.equipo_ministracion, r.atmosfera, r.visuales, r.redes,
        r.sala_bienvenida, r.sonido, r.ea, r.streaming, r.camaras,
        r.fotos, r.profes_ninez
    ].map(v => Number(v) || 0);

    const totalVol = volFields.reduce((a, b) => a + b, 0);
    const auditorio = Number(r.auditorio) || 0;
    const online = Number(r.online) || 0;
    const ninezSinProfes = [r.ninos_3_6, r.ninos_7_10, r.ninos_hd, r.borders]
        .map(v => Number(v) || 0).reduce((a, b) => a + b, 0);

    const auditorioSinVol = auditorio;
    const auditorioConVol = totalVol + auditorio;
    const audNinezSinProfes = auditorioSinVol + ninezSinProfes;
    const totalFinal = audNinezSinProfes + totalVol;
    const totalFinalConOnline = totalFinal + online;
    const pctVol = audNinezSinProfes > 0 ? (totalVol / audNinezSinProfes) * 100 : 0;

    return { totalVol, auditorioSinVol, auditorioConVol, ninezSinProfes, audNinezSinProfes, totalFinal, totalFinalConOnline, online, pctVol };
};



// ─── Shared UI atoms ──────────────────────────────────────────────────────

const StatRow: React.FC<{ label: string; value: string | number; highlight?: boolean }> = ({ label, value, highlight }) => (
    <div className={`flex items-center justify-between py-2.5 border-b border-slate-100 dark:border-neutral-800 ${highlight ? 'bg-violet-50 dark:bg-violet-950/30 -mx-3 px-3 rounded' : ''}`}>
        <span className={`text-sm ${highlight ? 'font-bold text-black dark:text-white' : 'text-black dark:text-white font-medium'}`}>{label}</span>
        <span className={`font-black tabular-nums ${highlight ? 'text-violet-700 dark:text-violet-300 text-lg' : 'text-black dark:text-white'}`}>{value}</span>
    </div>
);

const Delta: React.FC<{ curr: number; prev: number; label: string; icon?: string }> = ({ curr, prev, label, icon }) => {
    const diff = curr - prev;
    const pct = prev !== 0 ? ((diff / prev) * 100).toFixed(1) : null;
    const up = diff > 0;
    const same = diff === 0;
    const max = Math.max(curr, prev, 1);
    const currPct = (curr / max) * 100;
    const prevPct = (prev / max) * 100;

    return (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-100 dark:border-neutral-800 p-4 shadow-sm">
            {/* Label row */}
            <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider leading-tight">{label}</p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black
                    ${same
                        ? 'bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400'
                        : up
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400'
                    }`}>
                    {same ? <Minus className="w-3 h-3" /> : up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {pct ? `${up ? '+' : ''}${pct}%` : '—'}
                </span>
            </div>

            {/* Visual bar comparison */}
            <div className="space-y-2 mb-3">
                {/* Current bar */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actual</span>
                        <span className="text-base font-black tabular-nums text-black dark:text-white">{curr.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${same ? 'bg-slate-400' : up ? 'bg-emerald-500' : 'bg-red-500'
                                }`}
                            style={{ width: `${currPct}%` }}
                        />
                    </div>
                </div>
                {/* Previous bar */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Anterior</span>
                        <span className="text-sm font-bold tabular-nums text-slate-500 dark:text-neutral-400">{prev.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full bg-slate-300 dark:bg-neutral-600 transition-all duration-500"
                            style={{ width: `${prevPct}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Diff pill */}
            {!same && (
                <p className={`text-[11px] font-bold ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {up ? '▲' : '▼'} {Math.abs(diff).toLocaleString()} {up ? 'más' : 'menos'} que el año anterior
                </p>
            )}
        </div>
    );
};



// ─── Detail Modal ─────────────────────────────────────────────────────────

const DetailModal: React.FC<{ record: any; onClose: () => void }> = ({ record, onClose }) => {
    const s = calcStats(record);
    const fmt = (n: number) => n.toLocaleString('es-AR');

    return (
        <NeoModal isOpen={true} onClose={onClose} title="Detalle del Servicio" maxWidth="max-w-lg">
            <div className="mb-4">
                <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">
                    {record.name || '—'} · {new Date(record.service_date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}{record.service_time ? ` (${record.service_time})` : ''}
                </p>
            </div>
            <div className="space-y-0.5">
                <StatRow label="Total Voluntarios" value={fmt(s.totalVol)} />
                <StatRow label="Total Auditorio (sin voluntarios)" value={fmt(s.auditorioSinVol)} />
                <StatRow label="Total Auditorio (con voluntarios)" value={fmt(s.auditorioConVol)} />
                <StatRow label="Total Final" value={fmt(s.totalFinal)} highlight />
                <StatRow label="% Voluntarios" value={`${s.pctVol.toFixed(1)}%`} highlight />
            </div>

            {/* ── Total Asistencia + Online ── */}
            <div className="mt-5 rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-950/30 dark:to-indigo-950/30 p-4 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-sky-600 dark:text-sky-400 mb-2">📡 Total c/ Online</p>
                <div className="flex items-end justify-between">
                    <div>
                        <p className="text-3xl font-black tabular-nums text-black dark:text-white leading-none">{fmt(s.totalFinalConOnline)}</p>
                        <p className="text-[10px] text-slate-500 dark:text-neutral-400 font-medium mt-1">Total Asistencia + {fmt(s.online)} online</p>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-100 dark:bg-sky-900/40 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-xs font-black">
                        +{fmt(s.online)} online
                    </span>
                </div>
            </div>

            <div className="mt-6">
                <p className="text-xs font-bold uppercase tracking-tight text-slate-400 mb-3">Desglose Voluntarios</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm">
                    {[
                        ['Conecta', record.conecta], ['Store', record.store],
                        ['Host + Prevención', record.host_prevencion], ['Punto Info', record.punto_info],
                        ['Producción', record.produccion], ['Eq. Ministración', record.equipo_ministracion],
                        ['Atmosfera', record.atmosfera], ['Visuales', record.visuales],
                        ['Redes', record.redes], ['Sala Bienvenida', record.sala_bienvenida],
                        ['Sonido', record.sonido], ['EA', record.ea],
                        ['Streaming', record.streaming], ['Cámaras', record.camaras],
                        ['Fotos', record.fotos], ['Profes Niñez', record.profes_ninez],
                        ['Auditorio', record.auditorio],
                    ].map(([lbl, val]) => (
                        <div key={lbl as string} className="flex justify-between border-b border-slate-100 dark:border-neutral-800 py-1.5">
                            <span className="text-slate-500 text-xs">{lbl}</span>
                            <span className="font-bold text-xs tabular-nums">{Number(val) || 0}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="mt-6">
                <p className="text-xs font-bold uppercase tracking-tight text-slate-400 mb-3">Niñez</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm">
                    {[['Niños 3–6', record.ninos_3_6], ['Niños 7–10', record.ninos_7_10], ['Niños HD', record.ninos_hd], ['Borders', record.borders]]
                        .map(([lbl, val]) => (
                            <div key={lbl as string} className="flex justify-between border-b border-slate-100 dark:border-neutral-800 py-1.5">
                                <span className="text-slate-500 text-xs">{lbl}</span>
                                <span className="font-bold text-xs tabular-nums">{Number(val) || 0}</span>
                            </div>
                        ))}
                </div>
            </div>
            <div className="mt-6">
                <p className="text-xs font-bold uppercase tracking-tight text-slate-400 mb-3">Seguimiento</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm">
                    {[
                        ['Online', record.online], ['Vol. Repetidos', record.voluntarios_repetidos],
                        ['Aceptaron', record.aceptaron], ['1ra Vez', record.asistieron_primera_vez],
                        ['Reconciliaron', record.reconciliaron], ['Podcast', record.podcast],
                        ['Oración', record.oracion],
                    ].map(([lbl, val]) => (
                        <div key={lbl as string} className="flex justify-between border-b border-slate-100 dark:border-neutral-800 py-1.5">
                            <span className="text-slate-500 text-xs">{lbl}</span>
                            <span className="font-bold text-xs tabular-nums">{Number(val) || 0}</span>
                        </div>
                    ))}
                </div>
            </div>

            {record.conference_sessions && record.conference_sessions.length > 0 && (
                <div className="mt-6">
                    <p className="text-xs font-bold uppercase tracking-tight text-slate-400 mb-3">Sesiones Especiales</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm">
                        {record.conference_sessions.map((session: { name: string, attendees: number }, idx: number) => (
                            <div key={idx} className="flex justify-between border-b border-slate-100 dark:border-neutral-800 py-1.5">
                                <span className="text-slate-500 text-xs">{session.name}</span>
                                <span className="font-bold text-xs tabular-nums">{session.attendees}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {record.observations && (
                <div className="mt-6">
                    <p className="text-xs font-bold uppercase tracking-tight text-slate-400 mb-3">Observaciones</p>
                    <p className="text-sm text-slate-600 dark:text-neutral-300 leading-relaxed bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg px-4 py-3">
                        {record.observations}
                    </p>
                </div>
            )}

        </NeoModal>
    );
};

// ─── YoY Modal ────────────────────────────────────────────────────────────

const YoYModal: React.FC<{ record: any; allRecords: any[]; onClose: () => void }> = ({ record, allRecords, onClose }) => {
    const [yoyRecord, setYoyRecord] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const currentKey = generateYoYKey(record.service_date);
        const currentYear = new Date(record.service_date).getFullYear();
        
        // Find a record from a previous year that matches the same month and week index
        const match = allRecords.find(r => {
            if (r.id === record.id) return false;
            const rYear = new Date(r.service_date).getFullYear();
            if (rYear >= currentYear) return false; // Only previous years
            
            return generateYoYKey(r.service_date) === currentKey;
        });

        setYoyRecord(match || null);
        setLoading(false);
    }, [record, allRecords]);

    const curr = calcStats(record);
    const prev = yoyRecord ? calcStats(yoyRecord) : null;

    const formatDateLabel = (dateStr: string) =>
        new Date(dateStr + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

    return (
        <NeoModal isOpen={true} onClose={onClose} title="Comparativa Año a Año" maxWidth="max-w-xl">
            {loading && (
                <div className="flex flex-col items-center justify-center py-14 gap-3">
                    <div className="w-8 h-8 border-4 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-400 font-medium">Buscando registro anterior...</p>
                </div>
            )}

            {!loading && !yoyRecord && (
                <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="w-8 h-8 text-amber-500" />
                    </div>
                    <p className="font-bold text-slate-700 dark:text-neutral-200 text-base mb-1">Sin datos para comparar</p>
                    <p className="text-sm text-slate-400">No encontramos un registro del mismo mes en el año anterior.</p>
                </div>
            )}

            {!loading && yoyRecord && prev && (
                <>
                    {/* Timeline header */}
                    <div className="flex items-stretch gap-2 mb-6">
                        <div className="flex-1 bg-slate-50 dark:bg-neutral-800 rounded-2xl p-3 text-center border border-slate-100 dark:border-neutral-700">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Año anterior</p>
                            <p className="text-sm font-bold text-black dark:text-white leading-tight">{formatDateLabel(yoyRecord.service_date)}</p>
                            {yoyRecord.service_time && (
                                <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-slate-200 dark:bg-neutral-700 text-[10px] font-bold text-slate-500 dark:text-neutral-400">{yoyRecord.service_time}</span>
                            )}
                        </div>
                        <div className="flex items-center justify-center w-8 shrink-0">
                            <div className="flex flex-col items-center gap-0.5">
                                <div className="w-px h-3 bg-slate-200 dark:bg-neutral-700" />
                                <ChevronRight className="w-5 h-5 text-slate-400" />
                                <div className="w-px h-3 bg-slate-200 dark:bg-neutral-700" />
                            </div>
                        </div>
                        <div className="flex-1 bg-black dark:bg-white rounded-2xl p-3 text-center">
                            <p className="text-[10px] font-black text-white/60 dark:text-black/60 uppercase tracking-widest mb-1">Actual</p>
                            <p className="text-sm font-bold text-white dark:text-black leading-tight">{formatDateLabel(record.service_date)}</p>
                            {record.service_time && (
                                <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-white/20 dark:bg-black/20 text-[10px] font-bold text-white dark:text-black">{record.service_time}</span>
                            )}
                        </div>
                    </div>

                    {/* Metric cards */}
                    <div className="space-y-3">
                        <Delta label="Auditorio (con voluntarios)" curr={curr.auditorioConVol} prev={prev.auditorioConVol} />
                        <Delta label="Total Voluntarios" curr={curr.totalVol} prev={prev.totalVol} />
                        <Delta label="Auditorio (sin voluntarios)" curr={curr.auditorioSinVol} prev={prev.auditorioSinVol} />
                    </div>

                    <p className="text-[10px] text-slate-400 mt-5 text-center font-mono">
                        Comparado con: {yoyRecord.name || yoyRecord.service_date}{yoyRecord.service_time ? ` (${yoyRecord.service_time})` : ''}
                    </p>
                </>
            )}
        </NeoModal>
    );
};

// ─── Confirm Delete Modal ─────────────────────────────────────────────────

const ConfirmModal: React.FC<{ onConfirm: () => void; onClose: () => void; loading: boolean }> = ({ onConfirm, onClose, loading }) => (
    <NeoModal isOpen={true} onClose={onClose} title="Eliminar Registro" maxWidth="max-w-md">
        <p className="text-slate-600 dark:text-neutral-300 mb-6">¿Estás seguro que querés eliminar este registro? Esta acción no se puede deshacer.</p>
        <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 border border-slate-300 rounded-lg text-slate-700 font-bold text-sm uppercase hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors">Cancelar</button>
            <button onClick={onConfirm} disabled={loading} className="flex-1 py-3 bg-red-600 text-white rounded-lg font-bold text-sm uppercase hover:bg-red-700 transition-colors disabled:opacity-50">{loading ? 'Eliminando...' : 'Eliminar'}</button>
        </div>
    </NeoModal>
);

// ─── Summary Panel ────────────────────────────────────────────────────────

interface SummaryPanelProps {
    sorted: any[];
    allRecords: any[];
}

const SummaryPanel: React.FC<SummaryPanelProps> = ({ sorted, allRecords }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const stats = useMemo(() => {
        if (sorted.length === 0) return null;

        const last8 = [...sorted]
            .slice(0, 8)
            .reverse()
            .map(r => ({
                label: new Date(r.service_date + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
                total: calcStats(r).totalFinal,
                id: r.id,
            }));

        const last4 = sorted.slice(0, 4);
        const avgLast4 = last4.length > 0
            ? Math.round(last4.reduce((sum, r) => sum + calcStats(r).totalFinal, 0) / last4.length)
            : 0;

        const yoyMatches: number[] = [];
        last4.forEach(rec => {
            const key = generateYoYKey(rec.service_date);
            const recYear = new Date(rec.service_date).getFullYear();
            const match = allRecords.find(r => {
                if (r.id === rec.id) return false;
                const rYear = new Date(r.service_date).getFullYear();
                if (rYear >= recYear) return false;
                return generateYoYKey(r.service_date) === key;
            });
            if (match) yoyMatches.push(calcStats(match).totalFinal);
        });
        const avgYoY = yoyMatches.length > 0
            ? Math.round(yoyMatches.reduce((a, b) => a + b, 0) / yoyMatches.length)
            : null;

        const withTotals = sorted.map(r => ({ ...r, _total: calcStats(r).totalFinal }));
        const best = withTotals.reduce((a, b) => b._total > a._total ? b : a, withTotals[0]);
        const worst = withTotals.reduce((a, b) => b._total < a._total ? b : a, withTotals[0]);

        const sparkTrend = last8.length >= 2 ? last8[last8.length - 1].total - last8[0].total : 0;

        return {
            last8, avgLast4, avgYoY, best, worst, sparkTrend,
            hasYoY: avgYoY !== null,
            yoyDiff: avgYoY !== null ? avgLast4 - avgYoY : 0,
            yoyPct: avgYoY !== null && avgYoY > 0
                ? (((avgLast4 - avgYoY) / avgYoY) * 100).toFixed(1)
                : null,
        };
    }, [sorted, allRecords]);

    if (!stats) return null;

    const fmtDate = (d: string) =>
        new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const sparkColor = stats.sparkTrend > 0 ? '#10b981' : stats.sparkTrend < 0 ? '#ef4444' : '#8b5cf6';

    return (
        <div className="mb-6 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-2xl overflow-hidden shadow-sm">
            <button
                type="button"
                onClick={() => setIsCollapsed(c => !c)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-inset"
            >
                <div className="flex items-center gap-2.5">
                    <BarChart3 className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                    <span className="text-sm font-bold uppercase tracking-tight text-black dark:text-white">
                        Resumen del período
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 font-mono normal-case">
                        {sorted.length} servicio{sorted.length !== 1 ? 's' : ''}
                    </span>
                </div>
                {isCollapsed
                    ? <ChevronDown className="w-4 h-4 text-slate-400" />
                    : <ChevronUp className="w-4 h-4 text-slate-400" />
                }
            </button>

            {!isCollapsed && (
                <div className="border-t border-slate-200 dark:border-neutral-700 px-5 py-5">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                        {/* Promedio últimas 4 */}
                        <div className="bg-violet-50 dark:bg-violet-950/30 rounded-xl p-4 border border-violet-100 dark:border-violet-900/50">
                            <p className="text-[10px] font-black uppercase tracking-widest text-violet-500 dark:text-violet-400 mb-1">
                                Prom. últimas 4
                            </p>
                            <p className="text-3xl font-black tabular-nums text-black dark:text-white leading-none">
                                {stats.avgLast4.toLocaleString('es-AR')}
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-neutral-500 font-medium mt-1">
                                personas por servicio
                            </p>
                        </div>

                        {/* YoY */}
                        <div className={`rounded-xl p-4 border ${
                            !stats.hasYoY
                                ? 'bg-slate-50 dark:bg-neutral-800/50 border-slate-100 dark:border-neutral-700/50'
                                : stats.yoyDiff >= 0
                                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50'
                                    : 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/50'
                        }`}>
                            <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-slate-500 dark:text-neutral-400">
                                vs año anterior
                            </p>
                            {stats.hasYoY ? (
                                <>
                                    <p className={`text-3xl font-black tabular-nums leading-none ${
                                        stats.yoyDiff >= 0
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-red-600 dark:text-red-400'
                                    }`}>
                                        {stats.yoyDiff >= 0 ? '+' : ''}{stats.yoyDiff.toLocaleString('es-AR')}
                                    </p>
                                    <p className="text-[10px] font-bold mt-1 text-slate-400 dark:text-neutral-500 flex items-center gap-0.5">
                                        {stats.yoyDiff >= 0
                                            ? <TrendingUp className="inline w-3 h-3" />
                                            : <TrendingDown className="inline w-3 h-3" />
                                        }
                                        {stats.yoyPct}% vs prom. anterior
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="text-xl font-black text-slate-300 dark:text-neutral-600 leading-none">—</p>
                                    <p className="text-[10px] text-slate-400 dark:text-neutral-500 font-medium mt-1">
                                        sin datos comparables
                                    </p>
                                </>
                            )}
                        </div>

                        {/* Mejor servicio */}
                        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-4 border border-amber-100 dark:border-amber-900/40">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500 mb-1">
                                Mejor servicio
                            </p>
                            <p className="text-3xl font-black tabular-nums text-black dark:text-white leading-none">
                                {calcStats(stats.best).totalFinal.toLocaleString('es-AR')}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-neutral-400 font-medium mt-1 truncate">
                                {stats.best.name || fmtDate(stats.best.service_date)}
                            </p>
                        </div>

                        {/* Menor servicio */}
                        <div className="bg-slate-50 dark:bg-neutral-800/50 rounded-xl p-4 border border-slate-100 dark:border-neutral-700/50">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500 mb-1">
                                Menor servicio
                            </p>
                            <p className="text-3xl font-black tabular-nums text-black dark:text-white leading-none">
                                {calcStats(stats.worst).totalFinal.toLocaleString('es-AR')}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-neutral-400 font-medium mt-1 truncate">
                                {stats.worst.name || fmtDate(stats.worst.service_date)}
                            </p>
                        </div>
                    </div>

                    {/* Sparkline */}
                    {stats.last8.length >= 2 && (
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500 mb-3">
                                Últimos {stats.last8.length} servicios — Total final
                            </p>
                            <div className="h-28">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={stats.last8} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#000', border: '2px solid #000',
                                                color: '#fff', fontWeight: 'bold', fontSize: '11px', borderRadius: '8px'
                                            }}
                                            formatter={(value: number) => [value.toLocaleString('es-AR'), 'Total']}
                                            labelStyle={{ color: '#ccc', fontSize: '10px' }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="total"
                                            stroke={sparkColor}
                                            strokeWidth={2.5}
                                            dot={{ r: 4, fill: sparkColor, strokeWidth: 2, stroke: '#fff' }}
                                            activeDot={{ r: 6, strokeWidth: 2, stroke: '#000' }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex justify-between mt-1 px-2">
                                <span className="text-[9px] font-bold text-slate-400 dark:text-neutral-600 font-mono">
                                    {stats.last8[0]?.label}
                                </span>
                                <span className="text-[9px] font-bold text-slate-400 dark:text-neutral-600 font-mono">
                                    {stats.last8[stats.last8.length - 1]?.label}
                                </span>
                            </div>
                        </div>
                    )}

                    {stats.last8.length < 2 && (
                        <p className="text-xs text-slate-400 dark:text-neutral-500 font-medium text-center py-4 border border-dashed border-slate-200 dark:border-neutral-700 rounded-xl">
                            Se necesitan al menos 2 servicios para mostrar la tendencia gráfica.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────

type SortKey = 'service_date' | 'name';

const PastoralCareDashboard: React.FC<PastoralCareDashboardProps> = ({ currentUser }) => {
    const navigate = useNavigate();
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [detailRecord, setDetailRecord] = useState<any | null>(null);
    const [yoyRecord, setYoyRecord] = useState<any | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteSuccess, setDeleteSuccess] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>('service_date');
    const [sortAsc, setSortAsc] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterYear, setFilterYear] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [filterTime, setFilterTime] = useState('');
    const [filterCategory, setFilterCategory] = useState('');

    const availableYears = Array.from(new Set(records.map(r => r.service_date?.substring(0, 4)).filter(Boolean))).sort().reverse();

    const load = useCallback(async () => {
        setLoading(true);
        const data = await supabaseService.getServiceStatistics();
        setRecords(data);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortAsc(a => !a);
        else { setSortKey(key); setSortAsc(true); }
    };

    const sorted = [...records].filter(rec => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = (
            rec.name?.toLowerCase().includes(term) ||
            rec.service_date?.includes(term) ||
            rec.service_time?.toLowerCase().includes(term)
        );

        if (!matchesSearch) return false;

        if (filterYear && !rec.service_date?.startsWith(filterYear)) return false;

        if (filterMonth) {
            const monthPart = rec.service_date?.split('-')[1];
            if (monthPart !== filterMonth) return false;
        }

        if (filterTime && rec.service_time !== filterTime) return false;

        if (filterCategory && rec.category !== filterCategory) return false;

        return true;
    }).sort((a, b) => {
        const va = a[sortKey] ?? '';
        const vb = b[sortKey] ?? '';
        if (va < vb) return sortAsc ? -1 : 1;
        if (va > vb) return sortAsc ? 1 : -1;
        return 0;
    });

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleteLoading(true);
        const ok = await supabaseService.deleteServiceStatistic(deleteTarget.id);
        setDeleteLoading(false);
        if (ok) {
            setDeleteTarget(null);
            load();
            setDeleteSuccess(true);
            setTimeout(() => setDeleteSuccess(false), 3000);
        }
    };

    const SortIcon = ({ col }: { col: SortKey }) => {
        if (sortKey !== col) return <Minus className="w-3 h-3 text-slate-300" />;
        return sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
    };

    const fmtDate = (d: string) =>
        new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 pb-16">

            {/* Header */}
            <div className="bg-white dark:bg-black border-b border-slate-200 dark:border-white">
                <div className="w-full px-4 sm:px-6 lg:px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/')} className="w-10 h-10 flex items-center justify-center border border-slate-300 bg-white hover:bg-slate-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">
                            <ArrowLeft className="w-4 h-4 text-slate-700" />
                        </button>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tighter leading-none">Audiencia Servicios</h1>
                            <p className="text-[10px] text-slate-600 dark:text-neutral-400 font-mono uppercase tracking-wider">Estadísticas de Servicios</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => navigate('/audiencia-servicios/new')}
                            className="flex items-center gap-2 px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black font-bold text-xs uppercase rounded-lg hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                        >
                            <Plus className="w-4 h-4" />
                            Nuevo Registro
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="w-full px-4 sm:px-6 lg:px-4 pt-8">
                {loading && (
                    <>
                        {/* Skeleton filters */}
                        <div className="mb-5 space-y-3">
                            <div className="h-10 bg-slate-200 dark:bg-neutral-800 rounded-xl animate-pulse" />
                            <div className="grid grid-cols-3 gap-2">
                                <div className="h-10 bg-slate-200 dark:bg-neutral-800 rounded-xl animate-pulse" />
                                <div className="h-10 bg-slate-200 dark:bg-neutral-800 rounded-xl animate-pulse" />
                                <div className="h-10 bg-slate-200 dark:bg-neutral-800 rounded-xl animate-pulse" />
                            </div>
                        </div>
                        {/* Skeleton cards for mobile */}
                        <div className="md:hidden space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 animate-pulse">
                                    <div className="flex justify-between mb-3">
                                        <div className="h-6 w-16 bg-slate-200 dark:bg-neutral-800 rounded-lg" />
                                        <div className="flex gap-1.5">
                                            {[1, 2, 3, 4].map((j) => (
                                                <div key={j} className="w-11 h-11 bg-slate-200 dark:bg-neutral-800 rounded-lg" />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="h-6 w-3/4 bg-slate-200 dark:bg-neutral-800 rounded mb-3" />
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="h-4 bg-slate-200 dark:bg-neutral-800 rounded" />
                                        <div className="h-4 bg-slate-200 dark:bg-neutral-800 rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Skeleton table for desktop */}
                        <div className="hidden md:block bg-white dark:bg-black border border-slate-200 dark:border-white rounded-lg shadow-sm overflow-x-auto">
                            <div className="p-4 space-y-3">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className="flex gap-4">
                                        <div className="h-4 w-24 bg-slate-200 dark:bg-neutral-800 rounded animate-pulse" />
                                        <div className="h-4 w-48 bg-slate-200 dark:bg-neutral-800 rounded animate-pulse" />
                                        <div className="h-4 w-16 bg-slate-200 dark:bg-neutral-800 rounded animate-pulse" />
                                        <div className="h-4 w-20 bg-slate-200 dark:bg-neutral-800 rounded animate-pulse" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {!loading && records.length === 0 && (
                    <div className="text-center py-16 px-4">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Calendar className="w-10 h-10 text-slate-400 dark:text-neutral-500" />
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-tight mb-2">Sin registros aún</h3>
                        <p className="text-slate-600 dark:text-neutral-400 text-sm mb-6 max-w-sm mx-auto">
                            Comenzá a registrar las estadísticas de los servicios para visualizar métricas y comparativas.
                        </p>
                        <button onClick={() => navigate('/audiencia-servicios/new')}
                            className="inline-flex items-center gap-2 px-5 py-3 bg-black dark:bg-white text-white dark:text-black font-bold text-sm uppercase
                            rounded-lg hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">
                            <Plus className="w-4 h-4" />
                            Crear primer registro
                        </button>
                    </div>
                )}

                {/* ── RESUMEN DEL PERÍODO ── */}
                {!loading && records.length > 0 && (
                    <SummaryPanel sorted={sorted} allRecords={records} />
                )}

                {!loading && records.length > 0 && (
                    <div className="mb-5 space-y-3">
                        {/* Search bar */}
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Buscar por fecha, nombre o horario..."
                                className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 bg-white text-black font-medium placeholder:text-slate-400 focus:outline-none focus:border-black focus:ring-2 focus:ring-black/5 transition-all text-sm shadow-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>

                        {/* Filter chips — 2 cols mobile / 4 cols desktop */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <FilterChip
                                label="Año"
                                value={filterYear}
                                onChange={setFilterYear}
                                activeColor="bg-slate-900 border-slate-900 text-white"
                                options={[
                                    { label: 'Todos los años', value: '' },
                                    ...availableYears.map(y => ({ label: y, value: y }))
                                ]}
                            />
                            <FilterChip
                                label="Mes"
                                value={filterMonth}
                                onChange={setFilterMonth}
                                activeColor="bg-violet-600 border-violet-600 text-white"
                                options={[
                                    { label: 'Todos los meses', value: '' },
                                    { label: 'Enero', value: '01' },
                                    { label: 'Febrero', value: '02' },
                                    { label: 'Marzo', value: '03' },
                                    { label: 'Abril', value: '04' },
                                    { label: 'Mayo', value: '05' },
                                    { label: 'Junio', value: '06' },
                                    { label: 'Julio', value: '07' },
                                    { label: 'Agosto', value: '08' },
                                    { label: 'Septiembre', value: '09' },
                                    { label: 'Octubre', value: '10' },
                                    { label: 'Noviembre', value: '11' },
                                    { label: 'Diciembre', value: '12' },
                                ]}
                            />
                            <FilterChip
                                label="Horario"
                                value={filterTime}
                                onChange={setFilterTime}
                                activeColor="bg-amber-500 border-amber-500 text-white"
                                options={[
                                    { label: 'Todos', value: '' },
                                    { label: 'AM', value: 'AM' },
                                    { label: 'PM', value: 'PM' },
                                ]}
                            />
                            <FilterChip
                                label="Categoría"
                                value={filterCategory}
                                onChange={setFilterCategory}
                                activeColor="bg-emerald-600 border-emerald-600 text-white"
                                options={[
                                    { label: 'Todas', value: '' },
                                    { label: 'Servicio de Domingo', value: 'Servicio de Domingo' },
                                    { label: 'CXV', value: 'CXV' },
                                    { label: 'Evento', value: 'Evento' },
                                    { label: 'Conferencia', value: 'Conferencia' },
                                ]}
                            />
                        </div>

                        {/* Results count & clear all */}
                        <div className="flex items-center justify-between px-1">
                            <p className="text-xs text-slate-400 font-mono">
                                {sorted.length} de {records.length} registros
                            </p>
                            {(filterYear || filterMonth || filterTime || filterCategory || searchTerm) && (
                                <button
                                    onClick={() => { setFilterYear(''); setFilterMonth(''); setFilterTime(''); setFilterCategory(''); setSearchTerm(''); }}
                                    className="text-xs font-bold text-violet-600 hover:text-violet-800 underline underline-offset-2 transition-colors"
                                >
                                    Limpiar filtros
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Mobile: Card list (Groups.tsx style) ── */}
                {!loading && records.length > 0 && (
                    <div className="md:hidden space-y-3">
                        {sorted.map((rec) => {
                            const s = calcStats(rec);
                            return (
                                <div key={rec.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                    {/* Top row: badge + actions */}
                                    <div className="flex items-start justify-between mb-3">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide
                                            ${rec.service_time === 'PM' ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {rec.service_hour ? `${rec.service_hour} ${rec.service_time || ''}` : rec.service_time || '—'}
                                        </span>
                                        {/* Kebab-style inline action buttons - 44px minimum touch target */}
                                        <div className="flex items-center gap-1.5">
                                            <button onClick={() => setDetailRecord(rec)} className="w-11 h-11 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-black hover:text-white hover:border-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2" title="Ver detalles" aria-label="Ver detalles">
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setYoyRecord(rec)} className="w-11 h-11 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-violet-600 hover:text-white hover:border-violet-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2" title="Comparativa YoY" aria-label="Comparativa año a año">
                                                <GitCompareArrows className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => navigate('/audiencia-servicios/new', { state: { record: rec } })} className="w-11 h-11 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2" title="Editar" aria-label="Editar registro">
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setDeleteTarget(rec)} className="w-11 h-11 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2" title="Eliminar" aria-label="Eliminar registro">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Name */}
                                    <h3 className="text-base font-bold uppercase tracking-tight text-black leading-tight mb-3">
                                        {rec.name || <span className="text-slate-400 normal-case font-medium">Sin nombre</span>}
                                    </h3>

                                    {/* Meta grid */}
                                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 border-t border-slate-200 pt-3">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">Fecha</p>
                                            <p className="text-sm font-bold text-black tabular-nums">{fmtDate(rec.service_date)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">Total Voluntarios</p>
                                            <p className="text-sm font-black text-violet-600 tabular-nums">{s.totalVol.toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">📡 Online</p>
                                            <p className="text-sm font-black text-sky-600 tabular-nums">{s.online.toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">Total c/ Online</p>
                                            <p className="text-sm font-black text-indigo-600 tabular-nums">{s.totalFinalConOnline.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <p className="text-xs text-slate-500 font-mono px-1 pt-1">
                            {sorted.length} registro{sorted.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                )}

                {/* ── Desktop: Table ── */}
                {!loading && records.length > 0 && (
                    <div className="hidden md:block bg-white dark:bg-black border border-slate-200 dark:border-white rounded-lg shadow-sm overflow-hidden">
                        <table className="table-fixed w-full text-sm">
                            <colgroup>
                                <col style={{width:'8%'}} />
                                <col style={{width:'11%'}} />
                                <col style={{width:'6%'}} />
                                <col style={{width:'8%'}} />
                                <col style={{width:'6%'}} />
                                <col style={{width:'9%'}} />
                                <col style={{width:'9%'}} />
                                <col style={{width:'5%'}} />
                                <col style={{width:'20%'}} />
                                <col style={{width:'18%'}} />
                            </colgroup>
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-white bg-slate-50 dark:bg-neutral-900">
                                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors select-none whitespace-nowrap" onClick={() => handleSort('service_date')}>
                                        <span className="flex items-center gap-1">Fecha <SortIcon col="service_date" /></span>
                                    </th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors select-none whitespace-nowrap" onClick={() => handleSort('name')}>
                                        <span className="flex items-center gap-1">Nombre <SortIcon col="name" /></span>
                                    </th>
                                    <th className="text-center px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">Horario</th>
                                    <th className="text-center px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">Total Asist.</th>
                                    <th className="text-center px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap bg-sky-50 dark:bg-sky-950/30">📡 Online</th>
                                    <th className="text-center px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap bg-indigo-50 dark:bg-indigo-950/30">Total c/ Online</th>
                                    <th className="text-center px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">Total Vols.</th>
                                    <th className="text-center px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">% Vol</th>
                                    <th className="text-left px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">Observaciones</th>
                                    <th className="text-center px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((rec, idx) => {
                                    const s = calcStats(rec);
                                    return (
                                        <tr key={rec.id} className={`border-b border-slate-100 dark:border-neutral-900 hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-neutral-900/30'}`}>
                                            <td className="px-4 py-3 font-mono text-sm font-bold tabular-nums whitespace-nowrap">{fmtDate(rec.service_date)}</td>
                                            <td className="px-4 py-3 font-bold uppercase tracking-tight text-slate-700 dark:text-neutral-300 truncate">
                                                <span className="block truncate" title={rec.name || '—'}>{rec.name || <span className="text-slate-300 dark:text-neutral-600">—</span>}</span>
                                            </td>
                                            <td className="px-3 py-3 font-mono text-xs font-bold text-slate-500 text-center">
                                                {rec.service_hour ? (
                                                    <span className="flex flex-col items-center leading-tight">
                                                        <span className="text-black dark:text-white text-sm">{rec.service_hour}</span>
                                                        <span className="text-[10px] uppercase opacity-60">{rec.service_time}</span>
                                                    </span>
                                                ) : rec.service_time || "—"}
                                            </td>
                                            <td className="px-3 py-3 font-black tabular-nums text-black dark:text-white text-center text-sm">{s.totalFinal.toLocaleString('es-AR')}</td>
                                            <td className="px-3 py-3 text-center bg-sky-50/60 dark:bg-sky-950/20">
                                                {s.online > 0 ? (
                                                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/50 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-xs font-black tabular-nums">
                                                        {s.online.toLocaleString('es-AR')}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 dark:text-neutral-700 text-xs">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-center bg-indigo-50/60 dark:bg-indigo-950/20">
                                                <span className="font-black tabular-nums text-indigo-700 dark:text-indigo-300 text-sm">{s.totalFinalConOnline.toLocaleString('es-AR')}</span>
                                            </td>
                                            <td className="px-3 py-3 font-black tabular-nums text-violet-600 dark:text-violet-400 text-center text-sm">{s.totalVol.toLocaleString('es-AR')}</td>
                                            <td className="px-3 py-3 font-bold tabular-nums text-slate-500 text-center text-sm">{s.pctVol.toFixed(1)}%</td>
                                            <td className="px-3 py-3 text-xs text-slate-500 dark:text-neutral-400 truncate" title={rec.observations || ''}>
                                                {rec.observations || '—'}
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button onClick={() => setDetailRecord(rec)} title="Ver detalles" aria-label="Ver detalles" className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-700 hover:border-black dark:hover:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-1">
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => setYoyRecord(rec)} title="Comparativa YoY" aria-label="Comparativa año a año" className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-700 hover:border-violet-600 hover:bg-violet-600 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-1">
                                                        <GitCompareArrows className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => navigate('/audiencia-servicios/new', { state: { record: rec } })} title="Editar" aria-label="Editar registro" className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-700 hover:border-amber-500 hover:bg-amber-500 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1">
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => setDeleteTarget(rec)} title="Eliminar" aria-label="Eliminar registro" className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-700 hover:border-red-500 hover:bg-red-500 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div className="px-4 py-3 border-t border-slate-100 dark:border-neutral-900 text-xs text-slate-400 font-mono">
                            {records.length} registro{records.length !== 1 ? 's' : ''}
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {detailRecord && <DetailModal record={detailRecord} onClose={() => setDetailRecord(null)} />}
            {yoyRecord && <YoYModal record={yoyRecord} allRecords={records} onClose={() => setYoyRecord(null)} />}
            {deleteTarget && <ConfirmModal onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} loading={deleteLoading} />}

            {/* Toast notification */}
            {deleteSuccess && (
                <div className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 bg-black text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-fadeIn">
                    <Check className="w-4 h-4" />
                    <span className="font-bold text-sm uppercase">Registro eliminado</span>
                </div>
            )}
        </div>
    );
};

export default PastoralCareDashboard;
