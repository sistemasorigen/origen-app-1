import React, { useState, useEffect, useRef } from 'react';
import NeoModal from '../NeoModal';
import { User, Calendar, History, Save, Check, Loader2, Users } from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';

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

interface AttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    group: {
        id: string;
        name: string;
        registrations?: any[];
    };
}

const AttendanceModal: React.FC<AttendanceModalProps> = ({ isOpen, onClose, group }) => {
    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
    const [selectedDate, setSelectedDate] = useState(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });

    // Derived state from props
    const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
    const [history, setHistory] = useState<AttendanceRecord[]>([]);
    const [saving, setSaving] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Extract members
    const members: Member[] = (group.registrations || [])
        .map((r: any) => ({
            id: r.user_id || r.userId || r.id,
            name: `${r.first_name || r.firstName || ''} ${r.last_name || r.lastName || ''}`.trim() || 'Sin nombre',
            email: r.email || ''
        }));

    const presentCount = selectedMembers.size;
    const absentCount = members.length - presentCount;

    useEffect(() => {
        if (activeTab === 'history') {
            loadHistory();
        }
    }, [activeTab]);

    const loadHistory = async () => {
        setLoadingHistory(true);
        const data = await supabaseService.getAttendanceHistory(group.id);
        setHistory(data);
        setLoadingHistory(false);
    };

    const toggleMember = (memberId: string) => {
        const newSet = new Set(selectedMembers);
        if (newSet.has(memberId)) {
            newSet.delete(memberId);
        } else {
            newSet.add(memberId);
        }
        setSelectedMembers(newSet);
    };

    const selectAll = () => setSelectedMembers(new Set(members.map(m => m.id)));
    const deselectAll = () => setSelectedMembers(new Set());

    const handleSave = async () => {
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
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };

    return (
        <NeoModal
            isOpen={isOpen}
            onClose={onClose}
            title="Control de Asistencia"
        >
            <div className="flex flex-col h-full max-h-[80vh]">

                <p className="text-xs font-bold uppercase text-neutral-500 mb-4 -mt-2 truncate">
                    {group.name}
                </p>

                {/* TABS */}
                <div className="flex bg-neutral-100 p-1 rounded-lg mb-4 shrink-0">
                    <button
                        onClick={() => setActiveTab('new')}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'new' ? 'bg-black text-white shadow-sm' : 'text-neutral-500 hover:text-black'
                            }`}
                    >
                        <Calendar className="w-3 h-3" /> Nueva
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-black text-white shadow-sm' : 'text-neutral-500 hover:text-black'
                            }`}
                    >
                        <History className="w-3 h-3" /> Historial
                    </button>
                </div>

                {/* CONTENT */}
                <div className="flex-1 overflow-y-auto min-h-[200px] pr-1">
                    {activeTab === 'new' ? (
                        <div className="space-y-4">
                            {/* DATE */}
                            <div>
                                <label className="text-[10px] font-black uppercase text-neutral-500 block mb-1">Fecha de Reunión</label>
                                <div className="relative">
                                    <div className="w-full px-3 py-2 border-2 border-black font-bold flex items-center justify-between pointer-events-none bg-white">
                                        <span>{formatDate(selectedDate)}</span>
                                        <Calendar className="w-4 h-4 text-neutral-400" />
                                    </div>
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* MEMBERS HEADER */}
                            <div className="flex items-center justify-between border-b pb-2">
                                <label className="text-[10px] font-black uppercase text-neutral-500">
                                    Miembros ({members.length})
                                </label>
                                <div className="flex gap-2">
                                    <button onClick={selectAll} className="text-[10px] font-bold hover:underline">TODOS</button>
                                    <span className="text-neutral-300">|</span>
                                    <button onClick={deselectAll} className="text-[10px] font-bold hover:underline">NINGUNO</button>
                                </div>
                            </div>

                            {/* MEMBERS LIST */}
                            {members.length === 0 ? (
                                <div className="text-center py-8 opacity-50">
                                    <Users className="w-8 h-8 mx-auto mb-2 text-neutral-400" />
                                    <p className="text-xs font-bold uppercase text-neutral-500">Sin miembros</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {members.map((member) => (
                                        <div
                                            key={member.id}
                                            onClick={() => toggleMember(member.id)}
                                            className={`flex items-center gap-3 p-3 border-2 transition-all cursor-pointer ${selectedMembers.has(member.id)
                                                    ? 'border-black bg-green-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                                                    : 'border-neutral-200 hover:border-black bg-white'
                                                }`}
                                        >
                                            <div className={`w-5 h-5 border-2 border-black flex items-center justify-center transition-colors ${selectedMembers.has(member.id) ? 'bg-black text-white' : 'bg-white'
                                                }`}>
                                                {selectedMembers.has(member.id) && <Check className="w-3 h-3" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm truncate">{member.name}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {loadingHistory ? (
                                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
                            ) : history.length === 0 ? (
                                <div className="text-center py-10 opacity-50">
                                    <History className="w-8 h-8 mx-auto mb-2 text-neutral-400" />
                                    <p className="text-xs font-bold uppercase text-neutral-500">Sin historial</p>
                                </div>
                            ) : (
                                history.map((record) => (
                                    <div key={record.id} className="flex justify-between items-center p-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-white">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-neutral-500" />
                                            <span className="font-bold">{formatDate(record.date)}</span>
                                        </div>
                                        <div className="flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-sm border border-green-200">
                                            <Users className="w-3 h-3" />
                                            <span className="text-xs font-black uppercase">{record.count} Presentes</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                {activeTab === 'new' && members.length > 0 && (
                    <div className="mt-4 pt-4 border-t-2 border-black flex flex-col gap-4">
                        <div className="flex justify-around">
                            <div className="text-center">
                                <p className="text-2xl font-black text-green-600 leading-none">{presentCount}</p>
                                <p className="text-[10px] font-black uppercase text-neutral-400">Presentes</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-black text-red-500 leading-none">{absentCount}</p>
                                <p className="text-[10px] font-black uppercase text-neutral-400">Ausentes</p>
                            </div>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className={`w-full py-4 text-sm font-black uppercase tracking-widest border-2 border-black flex items-center justify-center gap-2 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${saveSuccess
                                    ? 'bg-green-500 text-white border-green-700'
                                    : 'bg-black text-white hover:bg-neutral-800 active:translate-x-1 active:translate-y-1 active:shadow-none'
                                }`}
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
        </NeoModal>
    );
};

export default AttendanceModal;
