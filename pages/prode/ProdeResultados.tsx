import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseService } from '../../services/supabaseService';
import { ProdeMatch, ProdeParticipant, ProdePrediction } from '../../types';
import { Check, Target, CircleCheck, XCircle, Lock, Loader2 } from 'lucide-react';
import FlagImage from './FlagImage';

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

const ProdeResultados: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isMale = user?.gender === 'Masculino';

    const [matches, setMatches] = useState<ProdeMatch[]>([]);
    const [participant, setParticipant] = useState<ProdeParticipant | null>(null);
    const [predictions, setPredictions] = useState<ProdePrediction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const matchData = await supabaseService.getProdeMatches();
            setMatches(matchData);
            if (user?.id) {
                const nameParts = (user.name || '').split(' ');
                const p = await supabaseService.getOrCreateProdeParticipant(
                    nameParts[0] || '',
                    nameParts.slice(1).join(' ') || nameParts[0] || '',
                    user.id
                );
                if (p) {
                    setParticipant(p);
                    const preds = await supabaseService.getProdePredictions(p.id);
                    setPredictions(preds);
                }
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

    const publishedMatches = matches
        .filter(m => m.isFinished && m.homeScoreReal !== undefined && m.awayScoreReal !== undefined)
        .sort((a, b) => new Date(b.matchDate || 0).getTime() - new Date(a.matchDate || 0).getTime());

    const now = Date.now();

    // Construir lista unificada: publicados + pendientes
    type HistItem = { match: ProdeMatch; pred: ProdePrediction | null; isPublished: boolean };
    const histItems: HistItem[] = participant ? [
        ...publishedMatches.map(match => ({
            match,
            pred: predictions.find(p => p.matchId === match.id) ?? null,
            isPublished: true,
        })),
        ...predictions
            .filter(pred => !publishedMatches.some(m => m.id === pred.matchId))
            .map(pred => ({ match: matches.find(m => m.id === pred.matchId)!, pred, isPublished: false }))
            .filter(item => item.match),
    ] : [];

    histItems.sort((a, b) => {
        const aT = new Date(a.match.matchDate || 0).getTime();
        const bT = new Date(b.match.matchDate || 0).getTime();
        const aFut = aT >= now;
        const bFut = bT >= now;
        if (aFut && bFut) return aT - bT;
        if (!aFut && !bFut) return bT - aT;
        return aFut ? -1 : 1;
    });

    return (
        <>
            <style>{PRODE_STYLES}</style>
            <div className="bg-[#FAFAFA] min-h-screen py-10 px-5 md:px-12">
                <div className="max-w-lg mx-auto space-y-12">

                    {/* ── RESULTADOS PUBLICADOS ── */}
                    <div className="fu s1">
                        <div className="flex items-center justify-center mb-8 px-1">
                            <div className="flex flex-col items-center gap-2">
                                <Check className="w-6 h-6 text-emerald-400 drop-shadow-sm" />
                                <h2 className="text-xl font-black uppercase tracking-tight text-slate-700">Resultados Publicados</h2>
                            </div>
                        </div>

                        {loading ? (
                            <div className="space-y-3">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="h-20 bg-white rounded-[2rem] animate-pulse" />
                                ))}
                            </div>
                        ) : publishedMatches.length > 0 ? (
                            <div className="space-y-3">
                                {publishedMatches.map(match => (
                                    <div key={match.id} className="bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] border border-slate-100 rounded-[2rem] px-5 py-4">
                                        {/* Nº y fase centrados */}
                                        <div className="flex items-center justify-center gap-2 mb-4">
                                            <span className="text-[10px] font-black uppercase bg-slate-100 px-2 py-0.5 rounded-sm tabular-nums">Nº {match.matchNumber}</span>
                                            <span className="text-[10px] font-bold uppercase text-slate-400">{match.round}{match.groupName ? ` · ${match.groupName}` : ''}</span>
                                        </div>
                                        {/* Equipos + marcador */}
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                                                <FlagImage teamName={match.homeTeam} emoji={match.homeFlag} size="lg" />
                                                <span className="text-[11px] font-black uppercase text-slate-700 text-center leading-tight">{match.homeTeam}</span>
                                            </div>
                                            <div className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xl font-black text-slate-700 tabular-nums shadow-inner shrink-0">
                                                {match.homeScoreReal} – {match.awayScoreReal}
                                            </div>
                                            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                                                <FlagImage teamName={match.awayTeam} emoji={match.awayFlag} size="lg" />
                                                <span className="text-[11px] font-black uppercase text-slate-700 text-center leading-tight">{match.awayTeam}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-[2rem] p-8 text-center flex flex-col items-center justify-center gap-3">
                                <Target className="w-8 h-8 text-slate-300" />
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    Aún no hay resultados publicados
                                </p>
                            </div>
                        )}
                    </div>

                    {/* ── TUS PREDICCIONES (HISTORIAL) ── */}
                    {participant && histItems.length > 0 && (
                        <div className="fu s2 pb-20 pt-8 border-t border-slate-100">
                            <div className="flex items-center justify-center mb-8 px-1">
                                <div className="flex flex-col items-center gap-2">
                                    <Target className="w-6 h-6 text-teal-400 drop-shadow-sm" />
                                    <h2 className="text-xl font-black uppercase tracking-tight text-slate-700">Tus Predicciones</h2>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {histItems.map(({ match, pred, isPublished }) => {
                                    const gainedPoints = (pred?.pointsEarned ?? 0) > 0;
                                    return isPublished ? (
                                        <div key={`hist-pub-${match.id}`} className={`bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] border ${gainedPoints ? 'border-emerald-200' : 'border-slate-100'} rounded-[2rem] p-5 flex flex-col gap-4 relative overflow-hidden`}>
                                            {gainedPoints && <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-bl-full pointer-events-none" />}
                                            <div className="flex items-center justify-between w-full">
                                                <div className="flex items-center gap-2 text-slate-400">
                                                    <span className="text-[10px] font-black uppercase bg-slate-100 px-2 py-0.5 rounded-sm">Nº {match.matchNumber}</span>
                                                    <span className="text-[10px] font-bold uppercase truncate">{match.round}</span>
                                                </div>
                                                {pred ? (
                                                    <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 z-10 ${gainedPoints ? 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                                                        {gainedPoints ? <CircleCheck className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                                        <span className="text-xs font-black uppercase tracking-widest tabular-nums">{gainedPoints ? `+${pred.pointsEarned} pts` : '0 pts'}</span>
                                                    </div>
                                                ) : (
                                                    <div className="px-3 py-1.5 rounded-xl border bg-slate-50 border-slate-200 text-slate-400 flex items-center gap-1.5 z-10">
                                                        <XCircle className="w-4 h-4" />
                                                        <span className="text-xs font-black uppercase tracking-widest">Sin predicción</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between w-full py-2">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <FlagImage teamName={match.homeTeam} emoji={match.homeFlag} size="lg" />
                                                    <span className="text-sm sm:text-base font-black uppercase text-slate-700 truncate">{match.homeTeam}</span>
                                                </div>
                                                <span className="text-slate-300 font-black text-sm px-4">VS</span>
                                                <div className="flex items-center gap-3 flex-1 justify-end min-w-0">
                                                    <span className="text-sm sm:text-base font-black uppercase text-slate-700 truncate">{match.awayTeam}</span>
                                                    <FlagImage teamName={match.awayTeam} emoji={match.awayFlag} size="lg" />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 mt-1 bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50">
                                                <div className="flex flex-col items-center justify-center gap-1.5 p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tu Predicción</span>
                                                    {pred ? (
                                                        <span className="text-xl font-black text-slate-700 tabular-nums">{pred.homeScorePred} - {pred.awayScorePred}</span>
                                                    ) : (
                                                        <span className="text-sm font-black text-slate-300">—</span>
                                                    )}
                                                </div>
                                                <div className="flex flex-col items-center justify-center gap-1.5 p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                                                    <span className="text-[9px] font-black text-emerald-600/70 uppercase tracking-widest">Resultado Real</span>
                                                    <span className="text-xl font-black text-emerald-700 tabular-nums">{match.homeScoreReal} - {match.awayScoreReal}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div key={`hist-pend-${match.id}`} className="bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] border border-slate-100 rounded-[2rem] p-5 flex flex-col gap-4">
                                            <div className="flex items-center justify-between w-full">
                                                <div className="flex items-center gap-2 text-slate-400">
                                                    <span className="text-[10px] font-black uppercase bg-slate-100 px-2 py-0.5 rounded-sm">Nº {match.matchNumber}</span>
                                                    <span className="text-[10px] font-bold uppercase truncate">{match.round}</span>
                                                </div>
                                                <div className="px-3 py-1.5 rounded-xl border bg-amber-50 border-amber-200 text-amber-500 flex items-center gap-1.5">
                                                    <Loader2 className="w-3.5 h-3.5" />
                                                    <span className="text-xs font-black uppercase tracking-widest">Pendiente</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between w-full py-2">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <FlagImage teamName={match.homeTeam} emoji={match.homeFlag} size="lg" />
                                                    <span className="text-sm sm:text-base font-black uppercase text-slate-700 truncate">{match.homeTeam}</span>
                                                </div>
                                                <span className="text-slate-300 font-black text-sm px-4">VS</span>
                                                <div className="flex items-center gap-3 flex-1 justify-end min-w-0">
                                                    <span className="text-sm sm:text-base font-black uppercase text-slate-700 truncate">{match.awayTeam}</span>
                                                    <FlagImage teamName={match.awayTeam} emoji={match.awayFlag} size="lg" />
                                                </div>
                                            </div>
                                            <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50">
                                                <div className="flex flex-col items-center justify-center gap-1.5 p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tu Predicción</span>
                                                    <span className="text-xl font-black text-slate-700 tabular-nums">{pred!.homeScorePred} - {pred!.awayScorePred}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </>
    );
};

export default ProdeResultados;
