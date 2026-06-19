import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseService } from '../../services/supabaseService';
import { ProdeParticipant } from '../../types';
import { Trophy, Medal, Lock } from 'lucide-react';

const PRODE_STYLES = `
    @keyframes fadeUp {
        from { opacity: 0; transform: translateY(16px); }
        to   { opacity: 1; transform: translateY(0); }
    }
    .fu  { animation: fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; opacity: 0; }
    .s1  { animation-delay: 0.05s; }
    .s2  { animation-delay: 0.10s; }
    .s3  { animation-delay: 0.15s; }
    .s4  { animation-delay: 0.20s; }
    .s5  { animation-delay: 0.25s; }
    .s6  { animation-delay: 0.30s; }
`;

const MEDAL_COLORS = ['#F59E0B', '#94A3B8', '#D97706'];

const ProdeRanking: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isMale = user?.gender === 'Masculino';

    const [ranking, setRanking] = useState<ProdeParticipant[]>([]);
    const [participant, setParticipant] = useState<ProdeParticipant | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const rankData = await supabaseService.getProdeRanking();
            setRanking(rankData);
            if (user?.id) {
                const nameParts = (user.name || '').split(' ');
                const p = await supabaseService.getOrCreateProdeParticipant(
                    nameParts[0] || '',
                    nameParts.slice(1).join(' ') || nameParts[0] || '',
                    user.id
                );
                setParticipant(p);
            }
            setLoading(false);
        };
        load();
    }, [user?.id, user?.name]);

    if (!isMale) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 text-center">
                <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    className="w-20 h-20 bg-white rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex items-center justify-center mb-8"
                >
                    <Lock className="w-9 h-9 text-slate-300" />
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-rose-500 mb-3">Acceso restringido</p>
                    <h1 className="text-4xl font-black text-slate-700 tracking-tight leading-tight mb-4">
                        Solo para<br />hombres
                    </h1>
                    <p className="text-sm font-medium text-slate-500 max-w-[260px] mx-auto leading-relaxed mb-8">
                        El Prode del Mundial es exclusivo para los hombres de la comunidad Origen.
                    </p>
                    <motion.button
                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={() => navigate('/')}
                        className="px-8 py-3.5 bg-white text-slate-600 text-[11px] font-bold uppercase tracking-widest rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 hover:text-slate-900 transition-all"
                    >
                        ← Volver al inicio
                    </motion.button>
                </motion.div>
            </div>
        );
    }

    return (
        <>
            <style>{PRODE_STYLES}</style>
            <div className="bg-[#FAFAFA] min-h-screen py-10 px-5 md:px-12">
                <div className="max-w-lg mx-auto">

                    <div className="fu s1 flex items-center justify-center mb-8">
                        <div className="flex flex-col items-center gap-2">
                            <Trophy className="w-6 h-6 text-amber-400 drop-shadow-sm" />
                            <h1 className="text-xl font-black uppercase tracking-tight text-slate-700">Ranking Global</h1>
                        </div>
                    </div>

                    {loading ? (
                        <div className="space-y-4">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="h-20 bg-white rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] animate-pulse" />
                            ))}
                        </div>
                    ) : ranking.length === 0 ? (
                        <div className="py-20 text-center bg-white rounded-[3rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
                            <Trophy className="w-10 h-10 mx-auto mb-4 text-slate-200" strokeWidth={1.5} />
                            <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">
                                Todavía no hay predicciones
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {ranking.map((entry, idx) => {
                                const pos = idx + 1;
                                const isFirst = pos === 1;
                                const isTop3 = pos <= 3;
                                const isMine = participant?.id === entry.id;
                                return (
                                    <div
                                        key={entry.id}
                                        className={`fu s${Math.min(idx + 2, 6)} flex items-center gap-4 px-6 py-5 rounded-[2rem] transition-all duration-300 ${
                                            isMine
                                                ? 'bg-gradient-to-r from-emerald-50/50 to-teal-50/50 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.1)] border border-emerald-100/50'
                                                : isFirst
                                                    ? 'bg-gradient-to-r from-amber-50/50 to-orange-50/50 shadow-[0_4px_20px_-4px_rgba(245,158,11,0.1)] border border-amber-100/50'
                                                    : 'bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_25px_-4px_rgba(0,0,0,0.04)] border border-white'
                                        }`}
                                    >
                                        <div className="w-10 shrink-0 flex justify-center">
                                            {isTop3 ? (
                                                <Medal className="w-7 h-7 drop-shadow-sm" style={{ color: MEDAL_COLORS[pos - 1] }} />
                                            ) : (
                                                <span className="text-[13px] font-black text-slate-300 tabular-nums">
                                                    {String(pos).padStart(2, '0')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1 flex items-center gap-4 min-w-0">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-black shrink-0 shadow-inner ${
                                                isFirst ? 'bg-amber-100 text-amber-700' : isMine ? 'bg-emerald-100 text-teal-700' : 'bg-slate-50 text-slate-400'
                                            }`}>
                                                {entry.firstName.charAt(0)}
                                            </div>
                                            <p className={`font-bold text-base truncate ${isMine ? 'text-teal-900' : 'text-slate-600'}`}>
                                                {entry.firstName} {entry.lastName}
                                                {isMine && (
                                                    <span className="ml-3 text-[9px] font-black text-teal-600 bg-teal-50 border border-teal-100 px-2.5 py-1 rounded-full uppercase tracking-widest">
                                                        Tú
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="flex items-baseline gap-1.5 shrink-0 text-right">
                                            <span className={`text-2xl font-black tabular-nums tracking-tight ${isFirst ? 'text-amber-500' : isMine ? 'text-teal-600' : 'text-slate-600'}`}>
                                                {entry.totalPoints}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">pts</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default ProdeRanking;
