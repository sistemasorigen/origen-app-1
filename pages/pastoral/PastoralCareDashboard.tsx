import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import {
    Plus, Eye, GitCompareArrows, Pencil, Trash2, ArrowLeft,
    TrendingUp, TrendingDown, Minus, ChevronUp, ChevronDown,
    X, AlertTriangle, ChevronRight, Calendar
} from 'lucide-react';

interface PastoralCareDashboardProps { currentUser: User | null; }

// ─── Calculation helpers ───────────────────────────────────────────────────

const calcStats = (r: any) => {
    const volFields = [
        r.conecta, r.store, r.host_prevencion, r.punto_info, r.produccion,
        r.equipo_ministracion, r.atmosfera, r.visuales, r.redes,
        r.sala_bienvenida, r.sonido, r.ea, r.streaming, r.camaras,
        r.fotos, r.profes_ninez
    ].map(v => Number(v) || 0);

    const totalVol = volFields.reduce((a, b) => a + b, 0);
    const auditorio = Number(r.auditorio) || 0;
    const ninezSinProfes = [r.ninos_3_6, r.ninos_7_10, r.ninos_hd, r.borders]
        .map(v => Number(v) || 0).reduce((a, b) => a + b, 0);

    const auditorioSinVol = auditorio;
    const auditorioConVol = totalVol + auditorio;
    const audNinezSinProfes = auditorioSinVol + ninezSinProfes;
    const totalFinal = audNinezSinProfes + totalVol;
    const pctVol = audNinezSinProfes > 0 ? (totalVol / audNinezSinProfes) * 100 : 0;

    return { totalVol, auditorioSinVol, auditorioConVol, ninezSinProfes, audNinezSinProfes, totalFinal, pctVol };
};



// ─── Shared UI atoms ──────────────────────────────────────────────────────

const Modal: React.FC<{ title: string; onClose?: () => void; children: React.ReactNode; wide?: boolean; noClose?: boolean }> =
    ({ title, onClose, children, wide, noClose }) => (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className={`bg-white dark:bg-neutral-900 border-2 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.15)] w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] flex flex-col`}>
                <div className="flex items-center justify-between p-4 border-b-2 border-black dark:border-white flex-shrink-0">
                    <h2 className="font-black uppercase tracking-tighter text-lg">{title}</h2>
                    {!noClose && onClose && (
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center border-2 border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <div className="overflow-y-auto flex-1 p-5">{children}</div>
            </div>
        </div>
    );

const StatRow: React.FC<{ label: string; value: string | number; highlight?: boolean }> = ({ label, value, highlight }) => (
    <div className={`flex items-center justify-between py-2.5 border-b border-neutral-100 dark:border-neutral-800 ${highlight ? 'bg-violet-50 dark:bg-violet-950/30 -mx-3 px-3 rounded' : ''}`}>
        <span className={`text-sm ${highlight ? 'font-bold text-black dark:text-white' : 'text-black dark:text-white font-medium'}`}>{label}</span>
        <span className={`font-black tabular-nums ${highlight ? 'text-violet-700 dark:text-violet-300 text-lg' : 'text-black dark:text-white'}`}>{value}</span>
    </div>
);

const Delta: React.FC<{ curr: number; prev: number; label: string }> = ({ curr, prev, label }) => {
    const diff = curr - prev;
    const pct = prev !== 0 ? ((diff / prev) * 100).toFixed(1) : null;
    const up = diff > 0;
    const same = diff === 0;
    return (
        <div className="border-2 border-black dark:border-neutral-700 p-4 flex flex-col gap-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 dark:text-neutral-400">{label}</p>
            <div className="flex items-end justify-between gap-2 mt-1">
                <div>
                    <p className="text-2xl font-black tabular-nums">{curr.toLocaleString()}</p>
                    <p className="text-xs text-neutral-400">vs {prev.toLocaleString()}</p>
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 text-sm font-black border-2 ${same ? 'border-neutral-300 text-neutral-400' : up ? 'border-green-500 text-green-600 bg-green-50 dark:bg-green-950/30' : 'border-red-500 text-red-600 bg-red-50 dark:bg-red-950/30'}`}>
                    {same ? <Minus className="w-3.5 h-3.5" /> : up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {pct ? `${up ? '+' : ''}${pct}%` : '—'}
                </div>
            </div>
        </div>
    );
};



// ─── Detail Modal ─────────────────────────────────────────────────────────

const DetailModal: React.FC<{ record: any; onClose: () => void }> = ({ record, onClose }) => {
    const s = calcStats(record);
    const fmt = (n: number) => n.toLocaleString('es-AR');

    return (
        <Modal title="Detalle del Servicio" onClose={onClose}>
            <div className="mb-4">
                <p className="text-xs font-mono text-neutral-400 uppercase tracking-widest">
                    {record.name || '—'} · {new Date(record.service_date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}{record.service_time ? ` (${record.service_time})` : ''}
                </p>
            </div>
            <div className="space-y-0.5">
                <StatRow label="Total Voluntarios" value={fmt(s.totalVol)} />
                <StatRow label="Total Auditorio (sin voluntarios)" value={fmt(s.auditorioSinVol)} />
                <StatRow label="Total Auditorio (con voluntarios)" value={fmt(s.auditorioConVol)} />
                <StatRow label="Niños (sin profes)" value={fmt(s.ninezSinProfes)} />
                <StatRow label="Auditorio (sin vol) + Niños (sin profes)" value={fmt(s.audNinezSinProfes)} />
                <StatRow label="Total Final" value={fmt(s.totalFinal)} highlight />
                <StatRow label="% Voluntarios" value={`${s.pctVol.toFixed(1)}%`} highlight />
            </div>

            <div className="mt-6">
                <p className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-3">Desglose Voluntarios</p>
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
                        <div key={lbl as string} className="flex justify-between border-b border-neutral-100 dark:border-neutral-800 py-1.5">
                            <span className="text-neutral-500 text-xs">{lbl}</span>
                            <span className="font-bold text-xs tabular-nums">{Number(val) || 0}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="mt-6">
                <p className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-3">Niñez</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm">
                    {[['Niños 3–6', record.ninos_3_6], ['Niños 7–10', record.ninos_7_10], ['Niños HD', record.ninos_hd], ['Borders', record.borders]]
                        .map(([lbl, val]) => (
                            <div key={lbl as string} className="flex justify-between border-b border-neutral-100 dark:border-neutral-800 py-1.5">
                                <span className="text-neutral-500 text-xs">{lbl}</span>
                                <span className="font-bold text-xs tabular-nums">{Number(val) || 0}</span>
                            </div>
                        ))}
                </div>
            </div>
            <div className="mt-6">
                <p className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-3">Seguimiento</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm">
                    {[
                        ['Online', record.online], ['Vol. Repetidos', record.voluntarios_repetidos],
                        ['Aceptaron', record.aceptaron], ['1ra Vez', record.asistieron_primera_vez],
                        ['Reconciliaron', record.reconciliaron], ['Podcast', record.podcast],
                        ['Oración', record.oracion],
                    ].map(([lbl, val]) => (
                        <div key={lbl as string} className="flex justify-between border-b border-neutral-100 dark:border-neutral-800 py-1.5">
                            <span className="text-neutral-500 text-xs">{lbl}</span>
                            <span className="font-bold text-xs tabular-nums">{Number(val) || 0}</span>
                        </div>
                    ))}
                </div>
            </div>
        </Modal>
    );
};

// ─── YoY Modal ────────────────────────────────────────────────────────────

const YoYModal: React.FC<{ record: any; onClose: () => void }> = ({ record, onClose }) => {
    const [yoyRecord, setYoyRecord] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const prev = await supabaseService.getYoYRecord(record.service_date, record.id);
            setYoyRecord(prev);
            setLoading(false);
        })();
    }, [record]);

    const curr = calcStats(record);
    const prev = yoyRecord ? calcStats(yoyRecord) : null;
    const prevDateLabel = yoyRecord
        ? new Date(yoyRecord.service_date + 'T12:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
        : null;
    const currDateLabel = new Date(record.service_date + 'T12:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

    return (
        <Modal title="Comparativa Año a Año (YoY)" onClose={onClose} wide>
            {loading && <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-black dark:border-white border-t-transparent rounded-full animate-spin" /></div>}
            {!loading && !yoyRecord && (
                <div className="text-center py-10">
                    <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-amber-500" />
                    <p className="font-bold text-neutral-600 dark:text-neutral-300">No se encontró un registro comparable del año anterior.</p>
                    <p className="text-sm text-neutral-400 mt-1">Buscamos en el mismo mes del año pasado y el anterior.</p>
                </div>
            )}
            {!loading && yoyRecord && prev && (
                <>
                    <div className="flex items-center justify-between mb-5 text-xs font-mono uppercase tracking-widest text-neutral-500">
                        <span>{prevDateLabel} (anterior)</span>
                        <ChevronRight className="w-4 h-4" />
                        <span>{currDateLabel} (actual)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Delta label="Auditorio (con voluntarios)" curr={curr.auditorioConVol} prev={prev.auditorioConVol} />
                        <Delta label="Total Voluntarios" curr={curr.totalVol} prev={prev.totalVol} />
                        <Delta label="Auditorio (sin voluntarios)" curr={curr.auditorioSinVol} prev={prev.auditorioSinVol} />
                        <Delta label="Auditorio + Niños (sin profes)" curr={curr.audNinezSinProfes} prev={prev.audNinezSinProfes} />
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-5 text-center font-mono">Comparado con: {yoyRecord.name || yoyRecord.service_date}{yoyRecord.service_time ? ` (${yoyRecord.service_time})` : ''}</p>
                </>
            )}
        </Modal>
    );
};

// ─── Confirm Delete Modal ─────────────────────────────────────────────────

const ConfirmModal: React.FC<{ onConfirm: () => void; onClose: () => void; loading: boolean }> = ({ onConfirm, onClose, loading }) => (
    <Modal title="Eliminar Registro" onClose={onClose}>
        <p className="text-neutral-600 dark:text-neutral-300 mb-6">¿Estás seguro que querés eliminar este registro? Esta acción no se puede deshacer.</p>
        <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 border-2 border-black dark:border-white font-bold text-sm uppercase hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">Cancelar</button>
            <button onClick={onConfirm} disabled={loading} className="flex-1 py-3 bg-red-600 text-white font-bold text-sm uppercase hover:bg-red-700 transition-colors disabled:opacity-50">{loading ? 'Eliminando...' : 'Eliminar'}</button>
        </div>
    </Modal>
);

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
    const [sortKey, setSortKey] = useState<SortKey>('service_date');
    const [sortAsc, setSortAsc] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

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
        return (
            rec.name?.toLowerCase().includes(term) ||
            rec.service_date?.includes(term) ||
            rec.service_time?.toLowerCase().includes(term)
        );
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
        if (ok) { setDeleteTarget(null); load(); }
    };

    const SortIcon = ({ col }: { col: SortKey }) => {
        if (sortKey !== col) return <Minus className="w-3 h-3 text-neutral-300" />;
        return sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
    };

    const fmtDate = (d: string) =>
        new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 pb-16">

            {/* Header */}
            <div className="bg-white dark:bg-black border-b-4 border-black dark:border-white">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/')} className="w-9 h-9 flex items-center justify-center border-2 border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors">
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tighter leading-none">Cuidado Pastoral</h1>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono uppercase tracking-widest">Estadísticas de Servicios</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => navigate('/pastoral-care/new')}
                            className="flex items-center gap-2 px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black font-bold text-xs uppercase hover:opacity-80 transition-opacity border-2 border-black dark:border-white shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)]"
                        >
                            <Plus className="w-4 h-4" />
                            Nuevo Registro
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8">
                {loading && (
                    <div className="flex justify-center py-24">
                        <div className="w-10 h-10 border-4 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {!loading && records.length === 0 && (
                    <div className="text-center py-24 border-2 border-dashed border-neutral-300 dark:border-neutral-700">
                        <Calendar className="w-12 h-12 mx-auto mb-4 text-neutral-300 dark:text-neutral-700" />
                        <p className="font-bold text-neutral-500 dark:text-neutral-400 mb-4">Todavía no hay registros.</p>
                        <div className="flex gap-3 justify-center">
                            <button onClick={() => navigate('/pastoral-care/new')} className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black font-bold text-sm uppercase">
                                Crear el primero
                            </button>
                        </div>
                    </div>
                )}

                {!loading && records.length > 0 && (
                    <div className="mb-4">
                        <input
                            type="text"
                            placeholder="Buscar por fecha, nombre o horario (AM/PM)..."
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-black font-medium placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
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
                                            {rec.service_time || '—'}
                                        </span>
                                        {/* Kebab-style inline action buttons */}
                                        <div className="flex items-center gap-1.5">
                                            <button onClick={() => setDetailRecord(rec)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-slate-400 hover:text-black transition-all" title="Ver detalles">
                                                <Eye className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => setYoyRecord(rec)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-violet-400 hover:text-violet-600 transition-all" title="Comparativa YoY">
                                                <GitCompareArrows className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => navigate('/pastoral-care/new', { state: { record: rec } })} className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-amber-400 hover:text-amber-600 transition-all" title="Editar">
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => setDeleteTarget(rec)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-red-400 hover:text-red-600 transition-all" title="Eliminar">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Name */}
                                    <h3 className="text-base font-black uppercase tracking-tight text-black leading-tight mb-3">
                                        {rec.name || <span className="text-slate-400 normal-case font-medium">Sin nombre</span>}
                                    </h3>

                                    {/* Meta grid */}
                                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 border-t border-slate-100 pt-3">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Fecha</p>
                                            <p className="text-sm font-bold text-black tabular-nums">{fmtDate(rec.service_date)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Total Voluntarios</p>
                                            <p className="text-sm font-black text-violet-600 tabular-nums">{s.totalVol.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <p className="text-xs text-slate-400 font-mono px-1 pt-1">
                            {sorted.length} registro{sorted.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                )}

                {/* ── Desktop: Table ── */}
                {!loading && records.length > 0 && (
                    <div className="hidden md:block bg-white dark:bg-black border-2 border-black dark:border-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.1)] overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b-2 border-black dark:border-white bg-neutral-50 dark:bg-neutral-900">
                                    <th className="text-left px-4 py-3 font-black uppercase text-xs tracking-widest cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors select-none" onClick={() => handleSort('service_date')}>
                                        <span className="flex items-center gap-1.5">Fecha <SortIcon col="service_date" /></span>
                                    </th>
                                    <th className="text-left px-4 py-3 font-black uppercase text-xs tracking-widest cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors select-none" onClick={() => handleSort('name')}>
                                        <span className="flex items-center gap-1.5">Nombre de servicio <SortIcon col="name" /></span>
                                    </th>
                                    <th className="text-left px-4 py-3 font-black uppercase text-xs tracking-widest">Horario</th>
                                    <th className="text-left px-4 py-3 font-black uppercase text-xs tracking-widest">Total Voluntarios</th>
                                    <th className="text-right px-4 py-3 font-black uppercase text-xs tracking-widest">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((rec, idx) => {
                                    const s = calcStats(rec);
                                    return (
                                        <tr key={rec.id} className={`border-b border-neutral-100 dark:border-neutral-900 hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-colors ${idx % 2 === 0 ? '' : 'bg-neutral-50/50 dark:bg-neutral-900/30'}`}>
                                            <td className="px-4 py-3 font-mono text-sm font-bold tabular-nums whitespace-nowrap">{fmtDate(rec.service_date)}</td>
                                            <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300 font-bold uppercase tracking-tight">{rec.name || <span className="text-neutral-300 dark:text-neutral-600">—</span>}</td>
                                            <td className="px-4 py-3 font-mono text-xs font-bold text-neutral-500">{rec.service_time || "—"}</td>
                                            <td className="px-4 py-3 font-black tabular-nums text-violet-600 dark:text-violet-400">{s.totalVol.toLocaleString()}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button onClick={() => setDetailRecord(rec)} title="Ver detalles" className="w-8 h-8 flex items-center justify-center border-2 border-neutral-200 dark:border-neutral-700 hover:border-black dark:hover:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all">
                                                        <Eye className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => setYoyRecord(rec)} title="Comparativa YoY" className="w-8 h-8 flex items-center justify-center border-2 border-neutral-200 dark:border-neutral-700 hover:border-violet-600 hover:bg-violet-600 hover:text-white transition-all">
                                                        <GitCompareArrows className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => navigate('/pastoral-care/new', { state: { record: rec } })} title="Editar" className="w-8 h-8 flex items-center justify-center border-2 border-neutral-200 dark:border-neutral-700 hover:border-amber-500 hover:bg-amber-500 hover:text-white transition-all">
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => setDeleteTarget(rec)} title="Eliminar" className="w-8 h-8 flex items-center justify-center border-2 border-neutral-200 dark:border-neutral-700 hover:border-red-500 hover:bg-red-500 hover:text-white transition-all">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div className="px-4 py-3 border-t border-neutral-100 dark:border-neutral-900 text-xs text-neutral-400 font-mono">
                            {records.length} registro{records.length !== 1 ? 's' : ''}
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {detailRecord && <DetailModal record={detailRecord} onClose={() => setDetailRecord(null)} />}
            {yoyRecord && <YoYModal record={yoyRecord} onClose={() => setYoyRecord(null)} />}
            {deleteTarget && <ConfirmModal onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} loading={deleteLoading} />}
        </div>
    );
};

export default PastoralCareDashboard;
