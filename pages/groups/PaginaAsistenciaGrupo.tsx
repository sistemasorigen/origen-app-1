import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Calendar, History, Save, Check, Loader2, Users } from 'lucide-react';

interface Member {
    id: string;
    name: string;
    email: string;
}

interface AttendanceRecord {
    id: string;
    date: string;
    count: number;
    presentMembers: string[];
}

const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

const PaginaAsistenciaGrupo: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [group, setGroup] = useState<{ id: string; name: string; registrations?: any[] } | null>(null);
    const [loadingGroup, setLoadingGroup] = useState(true);

    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
    const [selectedDate, setSelectedDate] = useState(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });

    const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
    const [history, setHistory] = useState<AttendanceRecord[]>([]);
    const [saving, setSaving] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const fetchGroup = useCallback(async () => {
        if (!currentUser || !groupId) return;
        setLoadingGroup(true);
        try {
            const owned = await supabaseService.getGroupsByHost(currentUser.id);
            const found = owned.find(g => g.id === groupId);
            if (!found) {
                navigate('/mis-grupos', { replace: true });
                return;
            }
            setGroup(found);
        } finally {
            setLoadingGroup(false);
        }
    }, [currentUser, groupId, navigate]);

    useEffect(() => { fetchGroup(); }, [fetchGroup]);

    // Extract members — una fila de registro puede
    // representar 2 personas (pareja). Se expande
    // cada fila a 1 o 2 entradas de Member.
    const members: Member[] = (group?.registrations || [])
        .filter((r: any) => r.status === 'APPROVED')
        .flatMap((r: any) => {
            const titular: Member = {
                id: r.id,
                name: `${r.first_name || r.firstName || ''} ${r.last_name || r.lastName || ''}`.trim() || 'Sin nombre',
                email: r.email || ''
            };
            const partner = r.partnerData || r.partner_data;
            if (!partner) return [titular];
            const parejaMember: Member = {
                id: `${r.id}-partner`,
                name: `${partner.firstName || partner.first_name || ''} ${partner.lastName || partner.last_name || ''}`.trim() || 'Sin nombre',
                email: partner.email || ''
            };
            return [titular, parejaMember];
        });

    const presentCount = selectedMembers.size;
    const absentCount = members.length - presentCount;
    const presentPct = members.length > 0 ? Math.round((presentCount / members.length) * 100) : 0;

    const loadHistory = useCallback(async () => {
        if (!groupId) return [];
        setLoadingHistory(true);
        const data = await supabaseService.getAttendanceHistory(groupId);
        setHistory(data);
        setLoadingHistory(false);
        return data;
    }, [groupId]);

    useEffect(() => {
        if (activeTab === 'history') {
            loadHistory();
        }
    }, [activeTab, loadHistory]);

    useEffect(() => {
        const fetchDateAttendance = async () => {
            let record = history.find(r => r.date === selectedDate);
            if (!record && activeTab === 'new') {
                if (history.length === 0) {
                    const latestHistory = await loadHistory();
                    record = latestHistory.find(r => r.date === selectedDate);
                }
            }
            if (record) {
                setSelectedMembers(new Set(record.presentMembers));
            } else {
                setSelectedMembers(new Set());
            }
        };
        if (group && activeTab === 'new') {
            fetchDateAttendance();
        }
    }, [selectedDate, group, activeTab, loadHistory]);

    const toggleMember = (memberId: string) => {
        const newSet = new Set(selectedMembers);
        if (newSet.has(memberId)) newSet.delete(memberId);
        else newSet.add(memberId);
        setSelectedMembers(newSet);
    };

    const selectAll = () => setSelectedMembers(new Set(members.map(m => m.id)));
    const deselectAll = () => setSelectedMembers(new Set());

    const handleSave = async () => {
        if (!group) return;
        setSaving(true);
        setSaveSuccess(false);
        const success = await supabaseService.saveAttendance(
            group.id,
            selectedDate,
            Array.from(selectedMembers)
        );
        setSaving(false);
        if (success) {
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
            loadHistory();
            if (user?.id) {
                const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long' });
                await supabaseService.createAppNotification(
                    user.id,
                    '✅ Asistencia registrada',
                    `Registraste ${selectedMembers.size} presente(s) en ${group.name} el ${formattedDate}. ¡Seguí así!`,
                    'ATTENDANCE',
                    '/mis-grupos'
                );
            }
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };

    if (loadingGroup) return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
            <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
        </div>
    );

    if (!group) return null;

    return (
        <div className="min-h-screen bg-white dark:bg-black">
            <div className="max-w-2xl mx-auto px-4 md:px-8 py-8">

                {/* Volver */}
                <button
                    onClick={() => navigate(`/mis-grupos/${groupId}`)}
                    className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-black dark:hover:text-white transition-colors mb-6 font-black uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {group.name}
                </button>

                <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-black dark:text-white mb-6">
                    Control de Asistencia
                </h1>

                {/* TABS */}
                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl mb-6">
                    <button
                        onClick={() => setActiveTab('new')}
                        className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${activeTab === 'new' ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm' : 'text-slate-500 hover:text-black dark:hover:text-white'}`}
                    >
                        <Calendar className="w-3 h-3" /> Nueva
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${activeTab === 'history' ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm' : 'text-slate-500 hover:text-black dark:hover:text-white'}`}
                    >
                        <History className="w-3 h-3" /> Historial
                    </button>
                </div>

                {/* CONTENT */}
                <div>
                    {activeTab === 'new' ? (
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Fecha de Reunión</label>
                                <div
                                    className="relative"
                                    onClick={() => {
                                        const input = document.getElementById(`attendance-date-${group.id}`) as HTMLInputElement;
                                        if (input) {
                                            if ('showPicker' in HTMLInputElement.prototype) {
                                                try { input.showPicker(); } catch (e) { input.click(); }
                                            } else {
                                                input.focus();
                                                input.click();
                                            }
                                        }
                                    }}
                                >
                                    <div className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-bold flex items-center justify-between bg-slate-50 dark:bg-slate-900 hover:border-slate-900 dark:hover:border-white cursor-pointer transition-colors">
                                        <span className="text-sm text-black dark:text-white">{formatDate(selectedDate)}</span>
                                        <Calendar className="w-4 h-4 text-slate-400" />
                                    </div>
                                    <input
                                        id={`attendance-date-${group.id}`}
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Miembros ({members.length})
                                </label>
                                <div className="flex gap-1">
                                    <button
                                        onClick={selectAll}
                                        className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                                    >
                                        Todos
                                    </button>
                                    <button
                                        onClick={deselectAll}
                                        className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                                    >
                                        Ninguno
                                    </button>
                                </div>
                            </div>

                            {members.length === 0 ? (
                                <div className="text-center py-10 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Todavía no hay miembros aprobados en este grupo.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {members.map((member) => {
                                        const isPresent = selectedMembers.has(member.id);
                                        return (
                                            <div
                                                key={member.id}
                                                onClick={() => toggleMember(member.id)}
                                                role="checkbox"
                                                aria-checked={isPresent}
                                                tabIndex={0}
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMember(member.id); } }}
                                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${isPresent ? 'border-[#118f46] bg-[#118f46]/5' : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-500 bg-white dark:bg-black'}`}
                                            >
                                                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-black flex items-center justify-center shrink-0">
                                                    {getInitials(member.name)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm truncate text-black dark:text-white">{member.name}</p>
                                                </div>
                                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${isPresent ? 'bg-[#118f46] border-[#118f46] text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                                                    {isPresent && <Check className="w-3 h-3" />}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {loadingHistory ? (
                                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
                            ) : history.length === 0 ? (
                                <div className="text-center py-10 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                                    <History className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Todavía no registraste ninguna reunión.</p>
                                </div>
                            ) : (
                                history.map((record) => (
                                    <div key={record.id} className="flex justify-between items-center p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-black">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-slate-400" />
                                                <span className="font-bold text-black dark:text-white">{formatDate(record.date)}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wide mt-1">
                                                {record.count} presentes
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => { setSelectedDate(record.date); setActiveTab('new'); }}
                                            className="px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-lg text-[10px] font-black uppercase tracking-wide hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                                        >
                                            Editar
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* FOOTER — barra de asistencia + guardar */}
                {activeTab === 'new' && members.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-4">
                        <div>
                            <div className="flex h-2 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                                <div className="bg-[#118f46] transition-all duration-500" style={{ width: `${presentPct}%` }} />
                                <div className="bg-red-400 dark:bg-red-500 transition-all duration-500" style={{ width: `${100 - presentPct}%` }} />
                            </div>
                            <div className="flex justify-between mt-3">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-[#118f46]" />
                                    <span className="text-lg font-black text-black dark:text-white tabular-nums">{presentCount}</span>
                                    <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">Presentes</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">Ausentes</span>
                                    <span className="text-lg font-black text-black dark:text-white tabular-nums">{absentCount}</span>
                                    <span className="w-2 h-2 rounded-full bg-red-400 dark:bg-red-500" />
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className={`w-full py-4 text-sm font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400 ${saveSuccess ? 'bg-[#118f46] text-white' : 'bg-black dark:bg-white text-white dark:text-black hover:opacity-90'}`}
                        >
                            {saving ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                            ) : saveSuccess ? (
                                <><Check className="w-4 h-4" /> ¡Guardado!</>
                            ) : (
                                <><Save className="w-4 h-4" /> Guardar Asistencia</>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PaginaAsistenciaGrupo;
