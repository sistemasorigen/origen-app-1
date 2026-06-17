import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseService } from '../../services/supabaseService';
import { ProdeMatch, ProdeParticipant, ProdePrediction } from '../../types';
import { Check, Target, CircleCheck, XCircle, Lock, Loader2, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
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
    const [itemsPerPage, setItemsPerPage] = useState(4);
    const [currentPage, setCurrentPage] = useState(0);
    const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
    const [phaseDirection, setPhaseDirection] = useState(1);
    const [openGroupMenu, setOpenGroupMenu] = useState<string | null>(null);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) setItemsPerPage(1);
            else if (window.innerWidth < 1024) setItemsPerPage(2);
            else if (window.innerWidth < 1280) setItemsPerPage(3);
            else setItemsPerPage(4);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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

    const ROUND_ORDER = [
        'FASE DE GRUPOS',
        'OCTAVOS DE FINAL',
        'CUARTOS DE FINAL',
        'SEMIFINAL',
        'TERCER PUESTO',
        'FINAL'
    ];

    const availablePhases = ROUND_ORDER;

    const currentPhase = availablePhases[currentPhaseIndex] || 'Todos';

    useEffect(() => {
        if (currentPhaseIndex >= availablePhases.length && availablePhases.length > 0) {
            setCurrentPhaseIndex(0);
        }
    }, [availablePhases, currentPhaseIndex]);

    const nextPhase = () => {
        setPhaseDirection(1);
        setCurrentPhaseIndex(p => (p + 1) % availablePhases.length);
        setCurrentPage(0); // reiniciar paginación
    };
    
    const prevPhase = () => {
        setPhaseDirection(-1);
        setCurrentPhaseIndex(p => (p - 1 + availablePhases.length) % availablePhases.length);
        setCurrentPage(0); // reiniciar paginación
    };

    const phaseFilteredMatches = publishedMatches.filter(m => (m.round || 'Otros').toUpperCase() === currentPhase);

    // Todos los partidos (incluyendo no terminados) de la fase actual, para detectar grupos
    const allPhaseMatches = matches.filter(m => (m.round || 'Otros').toUpperCase() === currentPhase);

    const matchesByGroup = phaseFilteredMatches.reduce((acc, match) => {
        const group = match.groupName || match.round || 'Otros';
        if (!acc[group]) acc[group] = [];
        acc[group].push(match);
        return acc;
    }, {} as Record<string, typeof publishedMatches>);

    // Grupos que existen en todos los partidos de la fase, ordenados alfabéticamente
    const allGroupKeys = Array.from(
        new Set(allPhaseMatches.map(m => m.groupName || m.round || 'Otros'))
    ).sort((a, b) => a.localeCompare(b));

    // Si es fase de grupos usamos todos los grupos; de lo contrario solo los que tienen resultados
    const groupKeys = currentPhase === 'FASE DE GRUPOS' ? allGroupKeys : Object.keys(matchesByGroup).sort((a, b) => a.localeCompare(b));

    const totalPages = Math.ceil(groupKeys.length / itemsPerPage);

    useEffect(() => {
        if (currentPage >= totalPages && totalPages > 0) {
            setCurrentPage(totalPages - 1);
        }
    }, [totalPages, currentPage]);

    const nextPage = () => setCurrentPage(p => (p + 1) % totalPages);
    const prevPage = () => setCurrentPage(p => (p - 1 + totalPages) % totalPages);

    const currentGroups = groupKeys.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

    return (
        <>
            <style>{PRODE_STYLES}</style>
            <div className="bg-[#FAFAFA] min-h-screen py-10 px-5 md:px-12">
                <div className="max-w-[1400px] mx-auto space-y-12">

                    {/* ── FILTRO DE FASE ── */}
                    {availablePhases.length > 0 && (
                        <div className="flex flex-col items-center justify-center mb-6 fu s1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2">Filtro por Fase</span>
                            <div className="flex items-center justify-between w-full max-w-sm mx-auto">
                                {availablePhases.length > 1 ? (
                                    <motion.button 
                                        whileHover={{ scale: 1.1, x: -3 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={prevPhase}
                                        className="w-10 h-10 bg-white/90 backdrop-blur rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-slate-100 flex items-center justify-center text-slate-400 hover:text-emerald-500 hover:border-emerald-200 transition-colors shrink-0"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </motion.button>
                                ) : <div className="w-10" />}

                                <div className="flex-1 overflow-hidden relative h-10 flex items-center justify-center">
                                    <AnimatePresence mode="wait">
                                        <motion.h2
                                            key={currentPhase}
                                            initial={{ opacity: 0, x: phaseDirection * 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -phaseDirection * 20 }}
                                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                            className="text-2xl font-black uppercase tracking-tight text-slate-700 absolute text-center whitespace-nowrap"
                                        >
                                            {currentPhase}
                                        </motion.h2>
                                    </AnimatePresence>
                                </div>

                                {availablePhases.length > 1 ? (
                                    <motion.button 
                                        whileHover={{ scale: 1.1, x: 3 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={nextPhase}
                                        className="w-10 h-10 bg-white/90 backdrop-blur rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-slate-100 flex items-center justify-center text-slate-400 hover:text-emerald-500 hover:border-emerald-200 transition-colors shrink-0"
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </motion.button>
                                ) : <div className="w-10" />}
                            </div>
                        </div>
                    )}

                    {/* ── RESULTADOS PUBLICADOS ── */}
                    <div className="fu s2">

                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="h-40 bg-white rounded-[2rem] animate-pulse" />
                                ))}
                            </div>
                        ) : groupKeys.length > 0 ? (
                            <div className="relative w-full">
                                {totalPages > 1 && (
                                    <div className="absolute top-1/2 -translate-y-1/2 mt-6 -left-5 md:-left-10 z-30">
                                        <motion.button 
                                            whileHover={{ scale: 1.1, x: -3 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={prevPage}
                                            className="w-10 h-10 md:w-12 md:h-12 bg-white/90 backdrop-blur rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-slate-100 flex items-center justify-center text-slate-400 hover:text-emerald-500 hover:border-emerald-200 transition-colors"
                                        >
                                            <ChevronLeft className="w-6 h-6" />
                                        </motion.button>
                                    </div>
                                )}
                                
                                <div className="w-full overflow-hidden px-1 py-4">
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={currentPage}
                                            initial={{ opacity: 0, x: 40 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -40 }}
                                            transition={{ type: "spring", stiffness: 800, damping: 25 }}
                                            className="grid gap-6 items-start w-full"
                                            style={{ 
                                                gridTemplateColumns: `repeat(${itemsPerPage}, minmax(0, 1fr))` 
                                            }}
                                        >
                                            {currentGroups.map(group => (
                                                <div key={group} className="flex flex-col gap-4">
                                                    <div className="flex justify-center sticky top-4 z-40 -translate-y-6 pb-2 relative h-[44px] w-full">
                                                        <div className={`absolute top-0 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur border border-slate-100 flex flex-col overflow-hidden transition-all duration-300 ${openGroupMenu === group ? 'rounded-[1.5rem] shadow-xl' : 'rounded-full shadow-sm'}`}>
                                                            <button 
                                                                onClick={() => setOpenGroupMenu(openGroupMenu === group ? null : group)}
                                                                className="px-6 py-2.5 text-slate-600 text-[13px] font-black uppercase tracking-widest flex items-center justify-center gap-2 md:pointer-events-none"
                                                            >
                                                                {group}
                                                                <ChevronDown className={`w-4 h-4 md:hidden text-slate-400 transition-transform duration-300 ${openGroupMenu === group ? 'rotate-180' : ''}`} />
                                                            </button>
                                                            
                                                            <AnimatePresence>
                                                                {openGroupMenu === group && (
                                                                    <motion.div
                                                                        initial={{ height: 0, opacity: 0 }}
                                                                        animate={{ height: 'auto', opacity: 1 }}
                                                                        exit={{ height: 0, opacity: 0 }}
                                                                        transition={{ duration: 0.2 }}
                                                                        className="md:hidden w-full"
                                                                    >
                                                                        <div className="flex flex-col w-full border-t border-slate-100 max-h-48 overflow-y-auto">
                                                                            {groupKeys.map((g, idx) => {
                                                                                if (g === group) return null;
                                                                                return (
                                                                                    <button
                                                                                        key={g}
                                                                                        onClick={() => {
                                                                                            setCurrentPage(idx);
                                                                                            setOpenGroupMenu(null);
                                                                                        }}
                                                                                        className="w-full px-6 py-2.5 text-[13px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 hover:text-emerald-500 transition-colors text-center whitespace-nowrap"
                                                                                    >
                                                                                        {g}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-4">
                                                        {(matchesByGroup[group] && matchesByGroup[group].length > 0) ? (
                                                            matchesByGroup[group].map(match => {
                                                const pred = participant ? predictions.find(p => p.matchId === match.id) : null;
                                                const gainedPoints = (pred?.pointsEarned ?? 0) > 0;
                                                const matchTime = match.matchDate ? new Date(match.matchDate).getTime() : 0;
                                                const isRecent = matchTime > 0 && (now - matchTime) < 12 * 60 * 60 * 1000;
                                                return (
                                                    <div key={match.id} className={`bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] border ${gainedPoints ? 'border-emerald-200' : 'border-slate-100'} rounded-[2rem] px-5 py-4 relative overflow-hidden`}>
                                                        {gainedPoints && <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-bl-full pointer-events-none" />}
                                                        
                                                        {/* Nº y fase centrados */}
                                                        <div className="flex items-center justify-between gap-2 mb-4 relative z-10">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-[10px] font-black uppercase bg-slate-100 px-2 py-0.5 rounded-sm tabular-nums">Nº {match.matchNumber}</span>
                                                                <span className="text-[10px] font-bold uppercase text-slate-400 truncate">{match.round}</span>
                                                                {isRecent && (
                                                                    <span className="text-[9px] font-black uppercase tracking-widest bg-rose-50 text-rose-500 border border-rose-100 px-2 py-0.5 rounded-full shadow-sm animate-pulse">Reciente</span>
                                                                )}
                                                            </div>
                                                            {participant && (
                                                                pred ? (
                                                                    <div className={`px-2 py-1 rounded-lg flex items-center gap-1 border shrink-0 ${gainedPoints ? 'bg-emerald-50 border-emerald-100 text-emerald-600 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                                                        {gainedPoints ? <CircleCheck className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                                        <span className="text-[10px] font-black uppercase tracking-widest tabular-nums">{gainedPoints ? `+${pred.pointsEarned} pts` : '0 pts'}</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="px-2 py-1 rounded-lg border bg-slate-50 border-slate-100 text-slate-400 flex items-center gap-1 shrink-0">
                                                                        <XCircle className="w-3 h-3" />
                                                                        <span className="text-[10px] font-black uppercase tracking-widest">Sin predicción</span>
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                        {/* Equipos + marcador */}
                                                        <div className="flex items-center justify-between gap-3 relative z-10">
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
                                                        
                                                        {/* Predicción del usuario */}
                                                        {participant && (
                                                            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col items-center justify-center gap-1.5 relative z-10">
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tu Predicción</span>
                                                                {pred ? (
                                                                    <span className="text-lg font-black text-slate-500 tabular-nums">{pred.homeScorePred} - {pred.awayScorePred}</span>
                                                                ) : (
                                                                    <span className="text-lg font-black text-slate-300 tabular-nums">—</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                                        ) : (
                                                            <div className="bg-white border border-dashed border-slate-200 rounded-[2rem] px-5 py-8 flex flex-col items-center justify-center gap-2">
                                                                <Loader2 className="w-5 h-5 text-slate-300" />
                                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Aún sin resultados</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>

                                {totalPages > 1 && (
                                    <div className="absolute top-1/2 -translate-y-1/2 mt-6 -right-5 md:-right-10 z-30">
                                        <motion.button 
                                            whileHover={{ scale: 1.1, x: 3 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={nextPage}
                                            className="w-10 h-10 md:w-12 md:h-12 bg-white/90 backdrop-blur rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-slate-100 flex items-center justify-center text-slate-400 hover:text-emerald-500 hover:border-emerald-200 transition-colors"
                                        >
                                            <ChevronRight className="w-6 h-6" />
                                        </motion.button>
                                    </div>
                                )}
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


                </div>
            </div>
        </>
    );
};

export default ProdeResultados;
