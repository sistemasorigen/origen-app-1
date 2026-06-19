import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseService } from '../../../services/supabaseService';
import { db } from '../../../services/dbService';
import { DpadreFamilia, User, DEFAULT_DPADRE_CONFIG } from '../../../types';
import {
    Trophy, Users, ChevronLeft, Loader2,
    Trash2, Edit2, Plus, Check, X, Medal, Settings, CalendarDays
} from 'lucide-react';

interface AdminDPadreProps {
    currentUser: User;
}

type AdminSection = 'ranking' | 'familias' | 'configuracion';

const MEDAL_COLORS = ['#F59E0B', '#94A3B8', '#D97706'];

const AdminDPadre: React.FC<AdminDPadreProps> = ({ currentUser }) => {
    const navigate = useNavigate();
    const [section, setSection] = useState<AdminSection>('ranking');

    // ── Ranking ─────────────────────────────────
    const [ranking, setRanking] = useState<DpadreFamilia[]>([]);
    const [rankingLoading, setRankingLoading] = useState(false);
    const [adjustments, setAdjustments] = useState<Record<string, string>>({});
    const [applyingId, setApplyingId] = useState<string | null>(null);

    // ── Familias ─────────────────────────────────
    const [familias, setFamilias] = useState<DpadreFamilia[]>([]);
    const [familiasLoading, setFamiliasLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Edición inline de familia
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editNombre, setEditNombre] = useState('');
    const [editApellido, setEditApellido] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);

    // Nuevo hijo
    const [addingHijoId, setAddingHijoId] = useState<string | null>(null);
    const [newHijoNombre, setNewHijoNombre] = useState('');
    const [newHijoApellido, setNewHijoApellido] = useState('');
    const [savingHijo, setSavingHijo] = useState(false);

    // Eliminaciones
    const [deletingFamiliaId, setDeletingFamiliaId] = useState<string | null>(null);
    const [deletingHijoId, setDeletingHijoId] = useState<string | null>(null);

    // ── Configuración ────────────────────────────
    const [eventoActivo, setEventoActivo] = useState(true);
    const [configLoading, setConfigLoading] = useState(false);
    const [savingConfig, setSavingConfig] = useState(false);
    const [configSaved, setConfigSaved] = useState(false);

    useEffect(() => {
        if (section === 'ranking') loadRanking();
        if (section === 'familias') loadFamilias();
        if (section === 'configuracion') loadConfig();
    }, [section]);

    const loadConfig = async () => {
        setConfigLoading(true);
        const cfg = await supabaseService.getAppConfig();
        setEventoActivo(cfg?.dpadreConfig?.isActive ?? DEFAULT_DPADRE_CONFIG.isActive);
        setConfigLoading(false);
    };

    const handleSaveConfig = async () => {
        setSavingConfig(true);
        try {
            const current = await supabaseService.getAppConfig();
            const updated = {
                ...(current || db.getAppConfig()),
                dpadreConfig: { isActive: eventoActivo },
            };
            const ok = await supabaseService.saveAppConfig(updated as Parameters<typeof supabaseService.saveAppConfig>[0]);
            // Reflejar también en el config local (lo que lee el shell de la app)
            db.saveAppConfig(updated as Parameters<typeof db.saveAppConfig>[0]);
            if (ok) {
                setConfigSaved(true);
                setTimeout(() => setConfigSaved(false), 2500);
            }
        } finally {
            setSavingConfig(false);
        }
    };

    const loadRanking = async () => {
        setRankingLoading(true);
        const data = await supabaseService.getRankingDPadre();
        setRanking(data);
        setRankingLoading(false);
    };

    const loadFamilias = async () => {
        setFamiliasLoading(true);
        const data = await supabaseService.getRankingDPadre();
        // Mismo endpoint — ya trae hijos
        setFamilias(data);
        setFamiliasLoading(false);
    };

    // ── Handlers ranking ─────────────────────────
    const handleApplyAdjustment = async (familiaId: string) => {
        const delta = parseInt(adjustments[familiaId] || '0');
        if (!delta || isNaN(delta)) return;
        setApplyingId(familiaId);
        await supabaseService.ajustarPuntosFamilia(
            familiaId, delta, 'admin', currentUser.id
        );
        setAdjustments(prev => ({ ...prev, [familiaId]: '0' }));
        await loadRanking();
        setApplyingId(null);
    };

    // ── Handlers familias ────────────────────────
    const handleSaveEdit = async (familiaId: string) => {
        if (!editNombre.trim() || !editApellido.trim()) return;
        setSavingEdit(true);
        await supabaseService.updateFamiliaDPadre(familiaId, editNombre, editApellido);
        setEditingId(null);
        await loadFamilias();
        setSavingEdit(false);
    };

    const handleDeleteFamilia = async (familiaId: string) => {
        if (!window.confirm('¿Eliminar esta familia? Esta acción no se puede deshacer.')) return;
        setDeletingFamiliaId(familiaId);
        await supabaseService.deleteFamiliaDPadre(familiaId);
        await loadFamilias();
        setDeletingFamiliaId(null);
    };

    const handleAddHijo = async (familiaId: string) => {
        if (!newHijoNombre.trim() || !newHijoApellido.trim()) return;
        setSavingHijo(true);
        await supabaseService.addHijoDPadre(familiaId, newHijoNombre, newHijoApellido);
        setAddingHijoId(null);
        setNewHijoNombre('');
        setNewHijoApellido('');
        await loadFamilias();
        setSavingHijo(false);
    };

    const handleDeleteHijo = async (hijoId: string) => {
        setDeletingHijoId(hijoId);
        await supabaseService.deleteHijoDPadre(hijoId);
        await loadFamilias();
        setDeletingHijoId(null);
    };

    const familiasFiltradas = familias.filter(f => {
        if (!searchTerm.trim()) return true;
        const t = searchTerm.toLowerCase();
        return (
            f.padreNombre.toLowerCase().includes(t) ||
            f.padreApellido.toLowerCase().includes(t) ||
            (f.hijos || []).some(h =>
                h.nombre.toLowerCase().includes(t) ||
                h.apellido.toLowerCase().includes(t)
            )
        );
    });

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-4xl mx-auto px-4 md:px-8 py-10 md:py-14">

                {/* Header */}
                <div className="mb-8 pb-8 border-b border-gray-100">
                    <button
                        type="button"
                        onClick={() => navigate('/panel-eventos')}
                        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-4 font-medium cursor-pointer"
                    >
                        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                        Panel de eventos
                    </button>
                    <p className="text-[11px] font-medium tracking-wide text-gray-400 uppercase mb-2">
                        Administración · Día del Padre
                    </p>
                    <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 tracking-tight">
                        Panel del evento
                    </h1>
                </div>

                {/* Sub-navegación */}
                <div className="flex gap-1 mb-8 bg-gray-50 rounded-xl p-1 w-fit">
                    {([
                        { id: 'ranking', label: 'Ranking', icon: Trophy },
                        { id: 'familias', label: 'Familias', icon: Users },
                        { id: 'configuracion', label: 'Configuración', icon: Settings },
                    ] as { id: AdminSection; label: string; icon: any }[])
                        .map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setSection(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${section === tab.id
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                <tab.icon className="w-4 h-4" aria-hidden="true" />
                                {tab.label}
                            </button>
                        ))}
                </div>

                {/* ── SECCIÓN RANKING ─────────── */}
                {section === 'ranking' && (
                    <div className="space-y-4">
                        <div className="mb-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-1">
                                Ranking
                            </h2>
                            <p className="text-sm text-gray-400 font-normal">
                                Ajustá los puntos de cada familia manualmente.
                            </p>
                        </div>

                        {rankingLoading ? (
                            <div className="flex justify-center py-16">
                                <Loader2 className="w-6 h-6 animate-spin text-gray-300" aria-hidden="true" />
                            </div>
                        ) : ranking.length === 0 ? (
                            <div className="text-center py-16 text-gray-400 text-sm font-medium">
                                Sin familias inscriptas
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {ranking.map((f, idx) => {
                                    const pos = idx + 1;
                                    const top3 = pos <= 3;
                                    const adj = parseInt(adjustments[f.id] || '0') || 0;
                                    return (
                                        <div
                                            key={f.id}
                                            className={`flex flex-col md:flex-row md:items-center gap-4 px-6 py-5 rounded-[2rem] border transition-all duration-200 ${pos === 1
                                                ? 'bg-amber-50/50 border-amber-100/50 shadow-[0_4px_20px_-4px_rgba(245,158,11,0.1)]'
                                                : 'bg-white border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]'
                                                }`}
                                        >
                                            {/* Info */}
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <div className="w-10 shrink-0 flex justify-center">
                                                    {top3 ? (
                                                        <Medal
                                                            className="w-7 h-7"
                                                            style={{ color: MEDAL_COLORS[pos - 1] }}
                                                            aria-hidden="true"
                                                        />
                                                    ) : (
                                                        <span className="text-[13px] font-black text-gray-300 tabular-nums">
                                                            {String(pos).padStart(2, '0')}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${pos === 1
                                                    ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-gray-100 text-gray-400'
                                                    }`}>
                                                    {f.padreNombre.charAt(0).toUpperCase()}
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <p className={`font-semibold text-base truncate ${pos === 1 ? 'text-amber-900' : 'text-gray-700'
                                                        }`}>
                                                        {f.padreNombre} {f.padreApellido}
                                                    </p>
                                                    <p className="text-xs text-gray-400 font-normal">
                                                        {(f.hijos || []).length} hijo
                                                        {(f.hijos || []).length !== 1 ? 's' : ''}
                                                    </p>
                                                </div>

                                                <div className="flex items-baseline gap-1 shrink-0">
                                                    <span className={`text-2xl font-semibold tabular-nums ${pos === 1 ? 'text-amber-500' : 'text-gray-700'
                                                        }`}>
                                                        {f.totalPoints}
                                                    </span>
                                                    <span className="text-xs text-gray-400">pts</span>
                                                </div>
                                            </div>

                                            {/* Controles ajuste */}
                                            <div className="flex items-center gap-2 pt-4 border-t border-gray-100 md:border-none md:pt-0 shrink-0">
                                                {/* − delta + */}
                                                <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50 overflow-hidden h-10">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setAdjustments(prev => ({
                                                                ...prev,
                                                                [f.id]: String((parseInt(prev[f.id] || '0') || 0) - 1)
                                                            }))
                                                        }
                                                        disabled={applyingId === f.id}
                                                        aria-label="Restar un punto"
                                                        className="w-9 h-full flex items-center justify-center text-gray-500 hover:bg-gray-200 font-bold text-base transition-all border-r border-gray-200 disabled:opacity-40 cursor-pointer"
                                                    >
                                                        −
                                                    </button>
                                                    <span className={`w-10 text-center font-bold text-sm tabular-nums select-none ${adj > 0
                                                        ? 'text-green-600'
                                                        : adj < 0
                                                            ? 'text-red-500'
                                                            : 'text-gray-400'
                                                        }`}>
                                                        {adj > 0 ? `+${adj}` : adj}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setAdjustments(prev => ({
                                                                ...prev,
                                                                [f.id]: String((parseInt(prev[f.id] || '0') || 0) + 1)
                                                            }))
                                                        }
                                                        disabled={applyingId === f.id}
                                                        aria-label="Sumar un punto"
                                                        className="w-9 h-full flex items-center justify-center text-gray-500 hover:bg-gray-200 font-bold text-base transition-all border-l border-gray-200 disabled:opacity-40 cursor-pointer"
                                                    >
                                                        +
                                                    </button>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handleApplyAdjustment(f.id)}
                                                    disabled={applyingId === f.id || adj === 0}
                                                    className="h-10 px-4 rounded-xl bg-gray-900 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-amber-500 transition-all disabled:opacity-40 flex items-center justify-center min-w-[72px] cursor-pointer"
                                                >
                                                    {applyingId === f.id ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                                                    ) : 'Ajustar'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ── SECCIÓN FAMILIAS ──────────── */}
                {section === 'familias' && (
                    <div className="space-y-5">
                        <div className="flex items-center justify-between gap-4 mb-6">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                                    Familias inscriptas
                                </h2>
                                <p className="text-sm text-gray-400 font-normal">
                                    {familias.length} familia{familias.length !== 1 ? 's' : ''} registrada
                                    {familias.length !== 1 ? 's' : ''}
                                </p>
                            </div>

                            {/* Buscador */}
                            <input
                                type="text"
                                placeholder="Buscar..."
                                aria-label="Buscar familia"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="h-9 px-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-gray-400 transition-all w-48"
                            />
                        </div>

                        {familiasLoading ? (
                            <div className="flex justify-center py-16">
                                <Loader2 className="w-6 h-6 animate-spin text-gray-300" aria-hidden="true" />
                            </div>
                        ) : familiasFiltradas.length === 0 ? (
                            <div className="text-center py-16 text-gray-400 text-sm font-medium">
                                {searchTerm.trim()
                                    ? 'No se encontraron familias'
                                    : 'Sin familias inscriptas'}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {familiasFiltradas.map(f => (
                                    <div
                                        key={f.id}
                                        className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden"
                                    >
                                        {/* Padre */}
                                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">

                                            {editingId === f.id ? (
                                                /* Modo edición */
                                                <div className="flex items-center gap-2 flex-1">
                                                    <input
                                                        type="text"
                                                        value={editNombre}
                                                        onChange={e => setEditNombre(e.target.value)}
                                                        placeholder="Nombre"
                                                        aria-label="Nombre del padre"
                                                        className="h-8 px-2 rounded-lg border border-gray-200 text-sm font-medium focus:outline-none focus:border-gray-400 w-28"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={editApellido}
                                                        onChange={e => setEditApellido(e.target.value)}
                                                        placeholder="Apellido"
                                                        aria-label="Apellido del padre"
                                                        className="h-8 px-2 rounded-lg border border-gray-200 text-sm font-medium focus:outline-none focus:border-gray-400 w-28"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSaveEdit(f.id)}
                                                        disabled={savingEdit}
                                                        aria-label="Guardar cambios"
                                                        className="w-8 h-8 rounded-lg bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition-colors disabled:opacity-40 cursor-pointer"
                                                    >
                                                        {savingEdit ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                                                        ) : (
                                                            <Check className="w-3.5 h-3.5" aria-hidden="true" />
                                                        )}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingId(null)}
                                                        aria-label="Cancelar edición"
                                                        className="w-8 h-8 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer"
                                                    >
                                                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                                                    </button>
                                                </div>
                                            ) : (
                                                /* Modo lectura */
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                                                        <span className="text-xs font-bold text-gray-500">P</span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-gray-900 text-sm truncate">
                                                            {f.padreNombre} {f.padreApellido}
                                                        </p>
                                                        <p className="text-xs text-gray-400 font-normal">
                                                            {f.totalPoints} pts
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Acciones padre */}
                                            {editingId !== f.id && (
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingId(f.id);
                                                            setEditNombre(f.padreNombre);
                                                            setEditApellido(f.padreApellido);
                                                        }}
                                                        aria-label="Editar familia"
                                                        className="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 flex items-center justify-center transition-all cursor-pointer"
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteFamilia(f.id)}
                                                        disabled={deletingFamiliaId === f.id}
                                                        aria-label="Eliminar familia"
                                                        className="w-8 h-8 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-all disabled:opacity-40 cursor-pointer"
                                                        title="Eliminar familia"
                                                    >
                                                        {deletingFamiliaId === f.id ? (
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                                                        ) : (
                                                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Hijos */}
                                        <div className="px-5 py-3 space-y-2">
                                            {(f.hijos || []).map(hijo => (
                                                <div
                                                    key={hijo.id}
                                                    className="flex items-center justify-between py-1"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-6 h-6 rounded-lg bg-gray-50 flex items-center justify-center">
                                                            <span className="text-[9px] font-bold text-gray-400">H</span>
                                                        </div>
                                                        <p className="text-sm text-gray-600 font-medium">
                                                            {hijo.nombre} {hijo.apellido}
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteHijo(hijo.id)}
                                                        disabled={deletingHijoId === hijo.id}
                                                        aria-label={`Eliminar a ${hijo.nombre}`}
                                                        className="w-7 h-7 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 flex items-center justify-center transition-all disabled:opacity-40 cursor-pointer"
                                                        title="Eliminar hijo"
                                                    >
                                                        {deletingHijoId === hijo.id ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                                                        ) : (
                                                            <Trash2 className="w-3 h-3" aria-hidden="true" />
                                                        )}
                                                    </button>
                                                </div>
                                            ))}

                                            {/* Agregar hijo */}
                                            {addingHijoId === f.id ? (
                                                <div className="flex items-center gap-2 pt-1">
                                                    <input
                                                        type="text"
                                                        value={newHijoNombre}
                                                        onChange={e => setNewHijoNombre(e.target.value)}
                                                        placeholder="Nombre"
                                                        aria-label="Nombre del hijo"
                                                        className="h-8 px-2 rounded-lg border border-gray-200 text-sm font-medium focus:outline-none focus:border-gray-400 flex-1 min-w-0"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={newHijoApellido}
                                                        onChange={e => setNewHijoApellido(e.target.value)}
                                                        placeholder="Apellido"
                                                        aria-label="Apellido del hijo"
                                                        className="h-8 px-2 rounded-lg border border-gray-200 text-sm font-medium focus:outline-none focus:border-gray-400 flex-1 min-w-0"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAddHijo(f.id)}
                                                        disabled={savingHijo}
                                                        aria-label="Guardar hijo"
                                                        className="w-8 h-8 rounded-lg bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition-colors disabled:opacity-40 shrink-0 cursor-pointer"
                                                    >
                                                        {savingHijo ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                                                        ) : (
                                                            <Check className="w-3.5 h-3.5" aria-hidden="true" />
                                                        )}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setAddingHijoId(null);
                                                            setNewHijoNombre('');
                                                            setNewHijoApellido('');
                                                        }}
                                                        aria-label="Cancelar"
                                                        className="w-8 h-8 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0 cursor-pointer"
                                                    >
                                                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setAddingHijoId(f.id);
                                                        setNewHijoNombre('');
                                                        setNewHijoApellido('');
                                                    }}
                                                    className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors pt-1 cursor-pointer"
                                                >
                                                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                                                    Agregar hijo
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── SECCIÓN CONFIGURACIÓN ─────── */}
                {section === 'configuracion' && (
                    <div className="space-y-5">
                        <div className="mb-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-1">
                                Configuración
                            </h2>
                            <p className="text-sm text-gray-400 font-normal">
                                Controlá la visibilidad del evento en la aplicación.
                            </p>
                        </div>

                        {configLoading ? (
                            <div className="flex justify-center py-16">
                                <Loader2 className="w-6 h-6 animate-spin text-gray-300" aria-hidden="true" />
                            </div>
                        ) : (
                            <>
                                {/* Toggle evento activo */}
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-6">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${eventoActivo ? 'bg-amber-50' : 'bg-gray-100'
                                                }`}>
                                                <CalendarDays
                                                    className={`w-5 h-5 ${eventoActivo ? 'text-amber-500' : 'text-gray-400'}`}
                                                    aria-hidden="true"
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-gray-900">
                                                    Evento activo
                                                </p>
                                                <p className="text-xs text-gray-400 font-normal leading-relaxed">
                                                    {eventoActivo
                                                        ? 'El evento es visible en el menú para todos los usuarios.'
                                                        : 'El evento está oculto del menú. Solo los administradores pueden verlo.'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Switch */}
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={eventoActivo}
                                            aria-label="Activar o desactivar el evento"
                                            onClick={() => setEventoActivo(v => !v)}
                                            className={`relative w-12 h-7 rounded-full transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 ${eventoActivo ? 'bg-amber-500' : 'bg-gray-200'
                                                }`}
                                        >
                                            <span
                                                className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${eventoActivo ? 'translate-x-5' : 'translate-x-0'
                                                    }`}
                                            />
                                        </button>
                                    </div>
                                </div>

                                {/* Guardar */}
                                <button
                                    type="button"
                                    onClick={handleSaveConfig}
                                    disabled={savingConfig}
                                    className={`w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer ${configSaved
                                        ? 'bg-green-500 text-white'
                                        : 'bg-gray-900 text-white hover:bg-black'
                                        }`}
                                >
                                    {savingConfig ? (
                                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                    ) : configSaved ? (
                                        <><Check className="w-4 h-4" aria-hidden="true" /> Guardado</>
                                    ) : (
                                        'Guardar configuración'
                                    )}
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDPadre;
