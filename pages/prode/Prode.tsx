import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabaseService } from '../../services/supabaseService';
import { useAuth } from '../../contexts/AuthContext';
import {
    ProdeMatch, ProdeParticipant,
    ProdePrediction, ProdeConfig,
    DEFAULT_PRODE_CONFIG
} from '../../types';
import {
    Trophy, ChevronUp, ChevronDown,
    Check, Loader2, Medal,
    Swords, ArrowLeft,
    Target, CircleCheck, XCircle, Lock
} from 'lucide-react';
import HeroCarousel from '../../components/ui/CarruselHero';

// ─── Keyframes ────────────────────────────────────────────────────────────────
const STYLES = `
    @keyframes fadeUp {
        from { opacity: 0; transform: translateY(16px); }
        to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes shimmerGold {
        0%   { background-position: -200% center; }
        100% { background-position:  200% center; }
    }
    @keyframes successEntry {
        0%   { transform: scale(0) opacity: 0; }
        60%  { transform: scale(1.1) opacity: 1; }
        80%  { transform: scale(0.95); }
        100% { transform: scale(1); }
    }
    @keyframes numPop {
        0%   { transform: scale(1); }
        40%  { transform: scale(1.15); }
        70%  { transform: scale(0.95); }
        100% { transform: scale(1); }
    }

    .fu  { animation: fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; opacity: 0; }
    .s1  { animation-delay: 0.05s; }
    .s2  { animation-delay: 0.10s; }
    .s3  { animation-delay: 0.15s; }
    .s4  { animation-delay: 0.20s; }
    .s5  { animation-delay: 0.25s; }
    .s6  { animation-delay: 0.30s; }

    .gold-text {
        background: linear-gradient(90deg, #d97706 0%, #fbbf24 40%, #d97706 60%, #fbbf24 90%);
        background-size: 200% auto;
        animation: shimmerGold 3s linear infinite;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }
    .entry-success { animation: successEntry 0.8s cubic-bezier(0.34,1.56,0.64,1) both; }
    .num-pop       { animation: numPop 0.25s cubic-bezier(0.34,1.56,0.64,1); }

    /* Score digit - Premium Soft UI */
    .score-digit {
        background: #ffffff;
        border: 1px solid #f1f5f9;
        border-radius: 16px;
        width: 3.5rem;
        height: 4rem;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 10px -2px rgba(0,0,0,0.03), inset 0 -2px 6px 0 rgba(0,0,0,0.01);
    }
`;


const TEAM_TO_CODE: Record<string, string> = {
    // CONMEBOL
    'argentina': 'ar', 'brasil': 'br', 'brazil': 'br', 'uruguay': 'uy',
    'colombia': 'co', 'chile': 'cl', 'peru': 'pe', 'perú': 'pe',
    'ecuador': 'ec', 'paraguay': 'py', 'venezuela': 've', 'bolivia': 'bo',
    // UEFA
    'francia': 'fr', 'france': 'fr',
    'inglaterra': 'gb-eng', 'england': 'gb-eng',
    'españa': 'es', 'espana': 'es', 'spain': 'es',
    'alemania': 'de', 'germany': 'de',
    'portugal': 'pt',
    'italia': 'it', 'italy': 'it',
    'paises bajos': 'nl', 'países bajos': 'nl', 'holanda': 'nl', 'netherlands': 'nl',
    'croacia': 'hr', 'croatia': 'hr',
    'belgica': 'be', 'bélgica': 'be', 'belgium': 'be',
    'dinamarca': 'dk', 'denmark': 'dk',
    'suiza': 'ch', 'switzerland': 'ch',
    'serbia': 'rs',
    'polonia': 'pl', 'poland': 'pl',
    'gales': 'gb-wls', 'wales': 'gb-wls',
    'escocia': 'gb-sct', 'scotland': 'gb-sct',
    'suecia': 'se', 'sweden': 'se',
    'ucrania': 'ua', 'ukraine': 'ua',
    'bosnia y herzegovina': 'ba', 'bosnia': 'ba',
    'eslovenia': 'si', 'slovenia': 'si',
    // Otros
    'turquia': 'tr', 'turquía': 'tr', 'turkey': 'tr',
    'curazao': 'cw', 'curacao': 'cw',
    'haiti': 'ht', 'haití': 'ht',
    'costa de marfil': 'ci', 'ivory coast': 'ci',
    // AFC
    'japon': 'jp', 'japón': 'jp', 'japan': 'jp',
    'corea del sur': 'kr', 'republica de corea': 'kr', 'south korea': 'kr', 'korea': 'kr',
    'chequia': 'cz', 'republica checa': 'cz', 'czech republic': 'cz', 'czechia': 'cz',
    'arabia saudita': 'sa', 'saudi arabia': 'sa',
    'iran': 'ir', 'irán': 'ir',
    'australia': 'au',
    'qatar': 'qa', 'katar': 'qa', 'cátar': 'qa', 'catar': 'qa',
    // CAF
    'senegal': 'sn',
    'marruecos': 'ma', 'morocco': 'ma',
    'tunez': 'tn', 'túnez': 'tn', 'tunisia': 'tn',
    'ghana': 'gh',
    'camerun': 'cm', 'camerún': 'cm', 'cameroon': 'cm',
    'egipto': 'eg', 'egypt': 'eg',
    'nigeria': 'ng',
    'sudafrica': 'za', 'south africa': 'za',
    'angola': 'ao', 'mali': 'ml', 'zambia': 'zm',
    // CONCACAF
    'mexico': 'mx', 'méxico': 'mx',
    'estados unidos': 'us', 'usa': 'us', 'united states': 'us',
    'costa rica': 'cr',
    'canada': 'ca', 'canadá': 'ca',
    // OFC
    'nueva zelanda': 'nz', 'new zealand': 'nz'
};

const normalizeName = (name: string): string =>
    name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .trim();

interface FlagImageProps {
    teamName: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    emoji?: string; // emoji de bandera guardado en BD (fallback si el nombre no está mapeado)
}

const FLAG_FONT_SIZE: Record<string, string> = { sm: '1rem', md: '1.5rem', lg: '2rem', xl: '2.75rem' };

const FlagImage: React.FC<FlagImageProps> = ({ teamName, size = 'lg', className = '', emoji }) => {
    const code = TEAM_TO_CODE[normalizeName(teamName)];
    if (!code) {
        if (emoji) return <span className={`leading-none drop-shadow-sm ${className}`} style={{ fontSize: FLAG_FONT_SIZE[size] }}>{emoji}</span>;
        return <span className={`text-slate-300 font-bold uppercase ${className}`}>{teamName.substring(0, 2)}</span>;
    }
    
    // Size mapping
    const sizeMap = { sm: 24, md: 32, lg: 48, xl: 64 };
    const px = sizeMap[size];
    
    return (
        <img 
            src={`https://flagcdn.com/${code}.svg`}
            alt={`Bandera de ${teamName}`}
            width={px}
            className={`rounded-[4px] shadow-sm object-cover ${className}`}
            style={{ height: size === 'xl' ? '42px' : size === 'lg' ? '32px' : size === 'md' ? '22px' : '16px' }}
            onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
            }}
        />
    );
};


type ProdeScreen = 'landing' | 'predict' | 'success';

// ─── Component ────────────────────────────────────────────────────────────────
const Prode: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [screen, setScreen] = useState<ProdeScreen>('landing');
    const [prodeConfig, setProdeConfig] = useState<ProdeConfig>(DEFAULT_PRODE_CONFIG);
    const [matches, setMatches] = useState<ProdeMatch[]>([]);
    const [ranking, setRanking] = useState<ProdeParticipant[]>([]);
    const [loading, setLoading] = useState(true);
    const [participant, setParticipant] = useState<ProdeParticipant | null>(null);
    const [initializingParticipant, setInitializingParticipant] = useState(false);
    const [scores, setScores] = useState<Record<string, { home: number; away: number }>>({});
    const [savingMatch, setSavingMatch] = useState<string | null>(null);
    const [savedMatches, setSavedMatches] = useState<Set<string>>(new Set());
    const [poppedCell, setPoppedCell] = useState<string | null>(null);
    const [predictions, setPredictions] = useState<ProdePrediction[]>([]);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [cfg, matchData, rankData] = await Promise.all([
                    supabaseService.getAppConfig(),
                    supabaseService.getProdeMatches(),
                    supabaseService.getProdeRanking(),
                ]);
                if (cfg?.prodeConfig) setProdeConfig(cfg.prodeConfig);
                setMatches(matchData);
                setRanking(rankData);

                if (user?.id) {
                    const nameParts = (user.name || '').split(' ');
                    const fn = nameParts[0] || '';
                    const ln = nameParts.slice(1).join(' ') || fn;
                    const p = await supabaseService.getOrCreateProdeParticipant(fn, ln, user.id);
                    if (p) {
                        setParticipant(p);
                        const preds = await supabaseService.getProdePredictions(p.id);
                        setPredictions(preds);
                        
                        const initScores: Record<string, { home: number; away: number }> = {};
                        const savedSet = new Set<string>();
                        preds.forEach(pred => {
                            initScores[pred.matchId] = { home: pred.homeScorePred, away: pred.awayScorePred };
                            savedSet.add(pred.matchId);
                        });
                        // init empty ones
                        matchData.filter(m => m.isOpen && !m.isFinished).forEach(m => {
                            if (!initScores[m.id]) initScores[m.id] = { home: 0, away: 0 };
                        });
                        setScores(initScores);
                        setSavedMatches(savedSet);
                    }
                }
            } catch (err) {
                console.error('[Prode] load error:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user?.id, user?.name]);

    const handleStartPredicting = async () => {
        if (!user) return;
        // Si ya tenemos los datos precargados, vamos directo
        if (participant && Object.keys(scores).length > 0) {
            setScreen('predict');
            return;
        }

        setInitializingParticipant(true);
        try {
            const nameParts = (user.name || '').split(' ');
            const fn = nameParts[0] || '';
            const ln = nameParts.slice(1).join(' ') || fn;
            const p = await supabaseService.getOrCreateProdeParticipant(fn, ln, user.id);
            if (!p) return;
            setParticipant(p);
            const preds: ProdePrediction[] = await supabaseService.getProdePredictions(p.id);
            const initScores: Record<string, { home: number; away: number }> = {};
            const savedSet = new Set<string>();
            preds.forEach(pred => {
                initScores[pred.matchId] = { home: pred.homeScorePred, away: pred.awayScorePred };
                savedSet.add(pred.matchId);
            });
            matches.filter(m => m.isOpen && !m.isFinished).forEach(m => {
                if (!initScores[m.id]) initScores[m.id] = { home: 0, away: 0 };
            });
            setScores(initScores);
            setSavedMatches(savedSet);
            setScreen('predict');
        } finally {
            setInitializingParticipant(false);
        }
    };

    const handleSavePrediction = async (matchId: string) => {
        if (!participant) return;
        setSavingMatch(matchId);
        try {
            const score = scores[matchId] || { home: 0, away: 0 };
            const ok = await supabaseService.saveProdePrediction(
                participant.id, matchId, score.home, score.away
            );
            if (ok) setSavedMatches(prev => new Set([...prev, matchId]));
        } finally {
            setSavingMatch(null);
        }
    };

    const adjustScore = useCallback((matchId: string, side: 'home' | 'away', delta: number) => {
        const cellKey = `${matchId}-${side}`;
        setPoppedCell(cellKey);
        setTimeout(() => setPoppedCell(null), 220);
        setScores(prev => {
            const current = prev[matchId] || { home: 0, away: 0 };
            const newVal = Math.max(0, Math.min(20, current[side] + delta));
            setSavedMatches(prev2 => {
                const next = new Set(prev2); next.delete(matchId); return next;
            });
            return { ...prev, [matchId]: { ...current, [side]: newVal } };
        });
    }, []);

    // Countdown helpers — usan el estado reactivo `now` (actualizado cada segundo)
    const CUTOFF_MS = 15 * 60 * 1000;
    const getTimeLeftMs = (match: ProdeMatch): number =>
        new Date(match.matchDate || 0).getTime() - CUTOFF_MS - now;
    const isMatchLocked = (match: ProdeMatch): boolean =>
        !match.matchDate || getTimeLeftMs(match) <= 0;
    const formatCountdown = (ms: number): string => {
        const s = Math.floor(ms / 1000);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
        return `${String(sec)}s`;
    };

    const isMale = user?.gender === 'Masculino';
    const openMatches = matches.filter(m => m.isOpen && !m.isFinished);
    const liveMatches = openMatches.filter(m => m.matchDate && now >= new Date(m.matchDate).getTime()).sort((a, b) => new Date(a.matchDate || 0).getTime() - new Date(b.matchDate || 0).getTime());
    const upcomingMatches = openMatches.filter(m => !m.matchDate || now < new Date(m.matchDate).getTime()).sort((a, b) => new Date(a.matchDate || 0).getTime() - new Date(b.matchDate || 0).getTime());
    const unlockedOpenMatches = openMatches.filter(m => !isMatchLocked(m));
    const allSaved = openMatches.length > 0 && unlockedOpenMatches.every(m => savedMatches.has(m.id));

    const currentMatch = [...openMatches].sort((a, b) => new Date(a.matchDate || 0).getTime() - new Date(b.matchDate || 0).getTime())[0];
    const publishedMatches = matches.filter(m => m.isFinished && m.homeScoreReal !== undefined && m.awayScoreReal !== undefined).sort((a, b) => new Date(b.matchDate || 0).getTime() - new Date(a.matchDate || 0).getTime());

    const formatMatchDate = (iso: string) =>
        new Date(iso).toLocaleDateString('es-AR', {
            weekday: 'short', day: '2-digit', month: '2-digit',
            hour: '2-digit', minute: '2-digit',
        });

    const MEDAL_COLORS = ['#F59E0B', '#94A3B8', '#D97706']; // Brighter Gold, Silver, Bronze

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <>
            <style>{STYLES}</style>

            {/* ═══ ACCESO RESTRINGIDO ═══════════════════════════════════════════ */}
            {!isMale && (
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
            )}

            {/* ═══ CONTENIDO PRINCIPAL ══════════════════════════════════════════ */}
            {isMale && (
                <AnimatePresence mode="wait">

                    {/* ─── LANDING ──────────────────────────────────────────────── */}
                    {screen === 'landing' && (
                        <motion.div
                            key="landing"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="bg-[#FAFAFA] min-h-screen"
                        >
                            {/* HERO SECTION */}
                            <div className="relative">
                                <HeroCarousel
                                    slides={[
                                        {
                                            id: 'prode-hero',
                                            imageUrl: '/prode-banner-2.jpg',
                                            title: prodeConfig.bannerTitle || "PRODE MUNDIAL 2026",
                                            subtitle: prodeConfig.bannerSubtitle
                                        }
                                    ]}
                                    heightClass="h-[50vh] md:h-[60vh] lg:h-[70vh]"
                                    theme="prode"
                                />

                                {/* Glassmorphism CTA Row superpuesto */}
                                <div className="relative z-10 px-5 md:px-12 -mt-8 pb-10 flex justify-center">
                                    <div className="fu s2 w-full max-w-4xl bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2.5rem] p-3 md:p-4 flex flex-wrap items-center justify-between gap-4">
                                        
                                        {!loading && (
                                            <div className="flex items-center gap-5 flex-wrap px-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                                                        {openMatches.length} partido{openMatches.length !== 1 ? 's' : ''}
                                                    </span>
                                                </div>
                                                {ranking.length > 0 && (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2.5 h-2.5 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                                                            {ranking.length} participante{ranking.length !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="flex-1 flex justify-end min-w-[200px]">
                                            {loading ? (
                                                <div className="flex items-center gap-2 px-6 py-3">
                                                    <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                                                </div>
                                            ) : openMatches.length > 0 ? (
                                                <motion.button
                                                    onClick={handleStartPredicting}
                                                    disabled={initializingParticipant || (participant && savedMatches.size === openMatches.length)}
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.96 }}
                                                    className={`w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 text-[12px] font-black uppercase tracking-widest rounded-full disabled:opacity-40 transition-all ${participant && savedMatches.size === openMatches.length ? 'bg-emerald-50 border border-emerald-100 text-emerald-600 shadow-sm cursor-not-allowed' : 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-[0_8px_20px_-4px_rgba(16,185,129,0.3)] hover:shadow-[0_12px_25px_-4px_rgba(16,185,129,0.4)]'}`}
                                                >
                                                    {initializingParticipant
                                                        ? <Loader2 className="w-5 h-5 animate-spin" />
                                                        : participant && savedMatches.size === openMatches.length ? <Lock className="w-5 h-5" /> : <Swords className="w-5 h-5" />
                                                    }
                                                    {initializingParticipant ? 'Preparando...' : participant && savedMatches.size === openMatches.length ? 'Predicciones Completadas' : 'Predecir Resultados'}
                                                </motion.button>
                                            ) : (
                                                <div className="px-6 py-4 text-slate-400 text-[11px] font-bold uppercase tracking-widest rounded-full bg-slate-50 border border-slate-100">
                                                    Sin partidos abiertos
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* BODY SECTIONS */}
                            <div className="px-5 md:px-12 py-6 space-y-12 max-w-5xl mx-auto">

                                                            {/* ─── PARTIDOS EN VIVO ─── */}
                                <div className="fu s3 mb-12">
                                    <div className="flex items-center justify-center mb-6 px-1">
                                        <div className="flex flex-col items-center gap-1.5">
                                            <span className="px-3 py-1 bg-red-100 text-red-600 text-[9px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5 shadow-sm">
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                                En Vivo
                                            </span>
                                            <h2 className="text-lg font-black uppercase tracking-tight text-slate-700">
                                                Partidos en Vivo
                                            </h2>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        {liveMatches.length > 0 ? liveMatches.map(match => {
                                            const pred = predictions.find(p => p.matchId === match.id);
                                            return (
                                            <div key={match.id} className="bg-white rounded-[2rem] p-6 shadow-[0_4px_20px_-4px_rgba(239,68,68,0.1)] border-2 border-red-100 transition-all overflow-hidden relative">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-bl-full pointer-events-none" />
                                                <div className="flex items-center justify-between mb-4 relative z-10">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400">{match.round}</span>
                                                        {match.groupName && (
                                                            <span className="text-[10px] font-bold text-slate-300">· {match.groupName}</span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-50 text-red-500">
                                                        Jugándose
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 relative z-10">
                                                    <div className="flex-1 flex flex-col items-end text-right">
                                                        <FlagImage teamName={match.homeTeam} emoji={match.homeFlag} size="xl" className="mb-2" />
                                                        <p className="font-black text-[13px] uppercase tracking-wide text-slate-600">{match.homeTeam}</p>
                                                    </div>
                                                    <div className="shrink-0 flex flex-col items-center px-4">
                                                        <span className="text-red-400 font-black text-xl animate-pulse">VS</span>
                                                    </div>
                                                    <div className="flex-1 flex flex-col items-start text-left">
                                                        <FlagImage teamName={match.awayTeam} emoji={match.awayFlag} size="xl" className="mb-2" />
                                                        <p className="font-black text-[13px] uppercase tracking-wide text-slate-600">{match.awayTeam}</p>
                                                    </div>
                                                </div>
                                                {pred && (
                                                    <div className="mt-6 pt-4 border-t border-slate-100 relative z-10">
                                                        <div className="bg-slate-50 rounded-xl p-3 flex flex-col items-center justify-center gap-1 border border-slate-100">
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tu Predicción</span>
                                                            <span className="text-xl font-black text-slate-700 tabular-nums">{pred.homeScorePred} - {pred.awayScorePred}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {!pred && (
                                                    <div className="mt-6 pt-4 border-t border-slate-100 relative z-10">
                                                        <div className="bg-slate-50 rounded-xl p-3 flex flex-col items-center justify-center gap-1 border border-slate-100">
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No predijiste este partido</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}) : (
                                            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-[2rem] p-8 text-center flex flex-col items-center justify-center gap-3">
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                                    No hay partidos en vivo en este momento
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

{/* ── PARTIDOS ACTUALES ── */}
                                {upcomingMatches.length > 0 && (
                                    <div className="fu s3">
                                        <div className="flex items-center justify-center mb-6 px-1">
                                            <div className="flex flex-col items-center gap-1.5">
                                                
                                                <h2 className="text-lg font-black uppercase tracking-tight text-slate-700">
                                                    {upcomingMatches.length === 1 ? 'Próximo Partido' : 'Próximos Partidos'}
                                                </h2>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            {[...upcomingMatches].sort((a, b) => new Date(a.matchDate || 0).getTime() - new Date(b.matchDate || 0).getTime()).map(match => (
                                                <div key={match.id} className="bg-white rounded-[2rem] p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.06)] border border-slate-100/50 transition-all">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse" />
                                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{match.round}</span>
                                                            {match.groupName && (
                                                                <span className="text-[10px] font-bold text-slate-300">· {match.groupName}</span>
                                                            )}
                                                        </div>
                                                        {match.matchDate && (
                                                            <div className="flex flex-col items-end gap-1">
                                                                <span className="text-[11px] font-bold text-slate-400 tabular-nums bg-slate-50 px-2.5 py-1 rounded-lg">{formatMatchDate(match.matchDate)}</span>
                                                                {(() => {
                                                                    const ms = getTimeLeftMs(match);
                                                                    if (ms <= 0) return <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg bg-slate-100 text-slate-400">Cerrado</span>;
                                                                    const urg = ms < 5 * 60 * 1000;
                                                                    const warn = ms < 30 * 60 * 1000;
                                                                    return (
                                                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg tabular-nums ${urg ? 'bg-rose-50 text-rose-500' : warn ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-600'}`}>
                                                                            {formatCountdown(ms)}
                                                                        </span>
                                                                    );
                                                                })()}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex-1 flex flex-col items-end text-right">
                                                            <FlagImage teamName={match.homeTeam} emoji={match.homeFlag} size="xl" className="mb-2" />
                                                            <p className="font-black text-[13px] uppercase tracking-wide text-slate-600">{match.homeTeam}</p>
                                                        </div>
                                                        <div className="shrink-0 flex flex-col items-center px-4">
                                                            <span className="text-slate-300 font-black text-xl">VS</span>
                                                        </div>
                                                        <div className="flex-1 flex flex-col items-start text-left">
                                                            <FlagImage teamName={match.awayTeam} emoji={match.awayFlag} size="xl" className="mb-2" />
                                                            <p className="font-black text-[13px] uppercase tracking-wide text-slate-600">{match.awayTeam}</p>
                                                        </div>
                                                    </div>
                                                    {match.venue && (
                                                        <p className="text-center text-[10px] text-slate-400 font-bold mt-4 uppercase tracking-wider">{match.venue}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ── TUS PREDICCIONES GUARDADAS ── */}
                                {participant && openMatches.length > 0 && (
                                    <div className="fu s4">
                                        <div className="bg-gradient-to-br from-teal-500 to-emerald-500 rounded-[2rem] p-6 md:p-8 text-white shadow-[0_8px_30px_-4px_rgba(16,185,129,0.3)] relative overflow-hidden">
                                            {/* Decorative element */}
                                            <div className="absolute -right-10 -top-10 w-60 h-60 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                                            
                                            <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                                                <div className="text-center md:text-left">
                                                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-100 mb-1">Tus Predicciones</p>
                                                    <h3 className="text-2xl md:text-3xl font-black">{savedMatches.size} de {openMatches.length} <span className="text-emerald-100/80 text-lg md:text-xl">listas</span></h3>
                                                </div>
                                                <div className="w-full md:w-1/3 flex flex-col gap-2">
                                                    <div className="w-full bg-black/10 h-2.5 rounded-full overflow-hidden shadow-inner">
                                                        <div 
                                                            className="bg-white h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(255,255,255,0.5)]" 
                                                            style={{ width: `${openMatches.length ? (savedMatches.size / openMatches.length) * 100 : 0}%` }}
                                                        />
                                                    </div>
                                                    {savedMatches.size === openMatches.length ? (
                                                        <p className="text-[10px] text-emerald-100 font-bold text-right uppercase tracking-widest">¡Completaste todo!</p>
                                                    ) : (
                                                        <p className="text-[10px] text-emerald-100/70 font-bold text-right uppercase tracking-widest">Faltan {openMatches.length - savedMatches.size}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Exact prediction values */}
                                            {savedMatches.size > 0 && (
                                                <div className="relative z-10 w-full mt-8 pt-8 border-t border-white/20 grid grid-cols-1 lg:grid-cols-2 gap-3">
                                                    {openMatches.filter(m => savedMatches.has(m.id)).map(match => {
                                                        const score = scores[match.id];
                                                        return (
                                                            <div key={match.id} className="bg-white/10 border border-white/20 rounded-[1.25rem] p-3.5 flex items-center justify-between backdrop-blur-md shadow-inner transition-all hover:bg-white/20">
                                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                                    <FlagImage teamName={match.homeTeam} emoji={match.homeFlag} size="sm" />
                                                                    <span className="text-xs font-black uppercase tracking-wider truncate">{match.homeTeam}</span>
                                                                </div>
                                                                <div className="px-4 py-1.5 bg-black/20 rounded-xl text-sm font-black mx-3 shrink-0 tabular-nums shadow-inner text-emerald-50 border border-black/10">
                                                                    {score?.home ?? 0} - {score?.away ?? 0}
                                                                </div>
                                                                <div className="flex items-center gap-3 flex-1 min-w-0 justify-end text-right">
                                                                    <span className="text-xs font-black uppercase tracking-wider truncate">{match.awayTeam}</span>
                                                                    <FlagImage teamName={match.awayTeam} emoji={match.awayFlag} size="sm" />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* ── RANKING ── */}
                                <div className="fu s5 pb-12">
                                    <div className="flex items-center justify-center mb-8 px-1">
                                        <div className="flex flex-col items-center gap-2">
                                            <Trophy className="w-6 h-6 text-amber-400 drop-shadow-sm" />
                                            <h2 className="text-xl font-black uppercase tracking-tight text-slate-700">Ranking Global</h2>
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
                                                        className={`flex items-center gap-4 px-6 py-5 rounded-[2rem] transition-all duration-300 ${
                                                            isMine
                                                                ? 'bg-gradient-to-r from-emerald-50/50 to-teal-50/50 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.1)] border border-emerald-100/50'
                                                                : isFirst
                                                                    ? 'bg-gradient-to-r from-amber-50/50 to-orange-50/50 shadow-[0_4px_20px_-4px_rgba(245,158,11,0.1)] border border-amber-100/50'
                                                                    : 'bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_25px_-4px_rgba(0,0,0,0.04)] border border-white'
                                                        }`}
                                                    >
                                                        {/* Position */}
                                                        <div className="w-10 shrink-0 flex justify-center">
                                                            {isTop3 ? (
                                                                <Medal className="w-7 h-7 drop-shadow-sm" style={{ color: MEDAL_COLORS[pos - 1] }} />
                                                            ) : (
                                                                <span className="text-[13px] font-black text-slate-300 tabular-nums">
                                                                    {String(pos).padStart(2, '0')}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Avatar & Name */}
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

                                                        {/* Points */}
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

                                {/* ── RESULTADOS PUBLICADOS ── */}
                                <div className="fu s6 pb-20 mt-12 pt-8 border-t border-slate-100">
                                    <div className="flex items-center justify-center mb-8 px-1">
                                        <div className="flex flex-col items-center gap-2">
                                            <Check className="w-6 h-6 text-emerald-400 drop-shadow-sm" />
                                            <h2 className="text-xl font-black uppercase tracking-tight text-slate-700">Resultados Publicados</h2>
                                        </div>
                                    </div>
                                    
                                    {publishedMatches.length > 0 ? (
                                        <div className="space-y-3">
                                            {publishedMatches.map(match => (
                                                <div key={match.id} className="bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] border border-slate-100 rounded-[2rem] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                    <div className="flex items-center gap-2 text-slate-400 md:w-1/4">
                                                        <span className="text-[10px] font-black uppercase bg-slate-100 px-2 py-0.5 rounded-sm">Nº {match.matchNumber}</span>
                                                        <span className="text-[10px] font-bold uppercase truncate">{match.round}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between md:justify-center gap-4 flex-1">
                                                        <div className="flex items-center gap-3 flex-1 justify-end min-w-0">
                                                            <span className="text-xs sm:text-sm font-black uppercase text-slate-700 truncate">{match.homeTeam}</span>
                                                            <FlagImage teamName={match.homeTeam} emoji={match.homeFlag} size="lg" />
                                                        </div>
                                                        <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-lg font-black text-slate-700 tabular-nums shadow-inner shrink-0">
                                                            {match.homeScoreReal} - {match.awayScoreReal}
                                                        </div>
                                                        <div className="flex items-center gap-3 flex-1 justify-start min-w-0">
                                                            <FlagImage teamName={match.awayTeam} emoji={match.awayFlag} size="lg" />
                                                            <span className="text-xs sm:text-sm font-black uppercase text-slate-700 truncate">{match.awayTeam}</span>
                                                        </div>
                                                    </div>
                                                    <div className="hidden md:block md:w-1/4"></div>
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
                                {predictions.filter(p => publishedMatches.some(m => m.id === p.matchId)).length > 0 && (
                                    <div className="fu s6 pb-20 mt-12 pt-8 border-t border-slate-100">
                                        <div className="flex items-center justify-center mb-8 px-1">
                                            <div className="flex flex-col items-center gap-2">
                                                <Target className="w-6 h-6 text-teal-400 drop-shadow-sm" />
                                                <h2 className="text-xl font-black uppercase tracking-tight text-slate-700">Tus Predicciones</h2>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-3">
                                            {publishedMatches.filter(m => predictions.some(p => p.matchId === m.id)).map(match => {
                                                const pred = predictions.find(p => p.matchId === match.id)!;
                                                const gainedPoints = (pred.pointsEarned ?? 0) > 0;

                                                return (
                                                    <div key={`hist-${match.id}`} className={`bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] border ${gainedPoints ? 'border-emerald-200' : 'border-slate-100'} rounded-[2rem] p-5 flex flex-col gap-4 relative overflow-hidden`}>
                                                        {gainedPoints && (
                                                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-bl-full pointer-events-none" />
                                                        )}
                                                        
                                                        {/* Header: Match Info & Points */}
                                                        <div className="flex items-center justify-between w-full">
                                                            <div className="flex items-center gap-2 text-slate-400">
                                                                <span className="text-[10px] font-black uppercase bg-slate-100 px-2 py-0.5 rounded-sm">Nº {match.matchNumber}</span>
                                                                <span className="text-[10px] font-bold uppercase truncate">{match.round}</span>
                                                            </div>
                                                            <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 z-10 ${
                                                                gainedPoints 
                                                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm' 
                                                                    : 'bg-slate-50 border-slate-200 text-slate-400'
                                                            }`}>
                                                                {gainedPoints ? <CircleCheck className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                                                <span className="text-xs font-black uppercase tracking-widest tabular-nums">
                                                                    {gainedPoints ? `+${pred.pointsEarned} pts` : '0 pts'}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Teams */}
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

                                                        {/* Scores Comparison */}
                                                        <div className="grid grid-cols-2 gap-3 mt-1 bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50">
                                                            <div className="flex flex-col items-center justify-center gap-1.5 p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tu Predicción</span>
                                                                <span className="text-xl font-black text-slate-700 tabular-nums">{pred.homeScorePred} - {pred.awayScorePred}</span>
                                                            </div>
                                                            <div className="flex flex-col items-center justify-center gap-1.5 p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                                                                <span className="text-[9px] font-black text-emerald-600/70 uppercase tracking-widest">Resultado Real</span>
                                                                <span className="text-xl font-black text-emerald-700 tabular-nums">{match.homeScoreReal} - {match.awayScoreReal}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* ─── PREDICT ──────────────────────────────────────────────── */}
                    {screen === 'predict' && (
                        <motion.div
                            key="predict"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -16 }}
                            transition={{ duration: 0.28, type: 'spring', stiffness: 320, damping: 30 }}
                            className="bg-[#FAFAFA] min-h-screen pb-10"
                        >
                            {/* Sticky header - Soft UI */}
                            <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-white/40 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)]">
                                <div className="px-5 md:px-12 py-4 flex items-center gap-4 max-w-4xl mx-auto">
                                    <button
                                        onClick={() => setScreen('landing')}
                                        className="w-11 h-11 rounded-full flex items-center justify-center bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] text-slate-400 hover:text-slate-700 hover:shadow-[0_4px_15px_rgba(0,0,0,0.06)] transition-all shrink-0"
                                        aria-label="Volver"
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-base font-black text-slate-700 truncate">Tus Predicciones</p>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest truncate mt-0.5">
                                            {participant?.firstName} · {openMatches.length} partido{openMatches.length !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0 bg-emerald-50/80 px-4 py-2 rounded-[1rem] border border-emerald-100/50 shadow-inner">
                                        <p className="text-[14px] font-black text-emerald-600 leading-none mb-0.5">
                                            {savedMatches.size}/{openMatches.length}
                                        </p>
                                        <p className="text-[9px] font-bold text-emerald-700/70 uppercase tracking-widest leading-none">listos</p>
                                    </div>
                                </div>
                                {/* Progress bar */}
                                <div className="h-1.5 bg-slate-100/50">
                                    <div
                                        className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 transition-all duration-500 rounded-r-full shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                                        style={{ width: `${openMatches.length ? (savedMatches.size / openMatches.length) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>

                            {/* Match cards */}
                            <div className="px-5 md:px-12 py-8 space-y-5 max-w-4xl mx-auto">
                                {openMatches.length === 0 ? (
                                    <div className="shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-[3rem] py-20 text-center mt-6 bg-white">
                                        <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">No hay partidos abiertos</p>
                                    </div>
                                ) : (
                                    openMatches.map((match, idx) => {
                                        const score = scores[match.id] || { home: 0, away: 0 };
                                        const isSaved = savedMatches.has(match.id);
                                        const isSaving = savingMatch === match.id;
                                        const locked = isMatchLocked(match);
                                        const msLeft = locked ? 0 : getTimeLeftMs(match);
                                        const urgent = !locked && msLeft < 5 * 60 * 1000;
                                        const warning = !locked && msLeft < 30 * 60 * 1000;

                                        return (
                                            <div
                                                key={match.id}
                                                className={`fu s${Math.min(idx + 1, 6)} overflow-hidden transition-all duration-300 rounded-[2rem] ${
                                                    locked
                                                        ? 'bg-slate-50 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-100'
                                                        : isSaved
                                                            ? 'bg-gradient-to-b from-white to-emerald-50/10 shadow-[0_8px_30px_-4px_rgba(16,185,129,0.15)] ring-1 ring-emerald-200/50'
                                                            : 'bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-white'
                                                }`}
                                            >
                                                {/* Header */}
                                                <div className="flex items-center justify-between px-6 py-4 bg-white/50">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`w-2 h-2 rounded-full ${locked ? 'bg-slate-300' : isSaved ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-slate-200'} transition-all`} />
                                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{match.round}</span>
                                                        {match.groupName && (
                                                            <span className="text-[10px] font-bold text-slate-300">· {match.groupName}</span>
                                                        )}
                                                    </div>
                                                    {match.matchDate && (
                                                        <span className="text-[11px] font-bold text-slate-400 tabular-nums bg-slate-50 px-2.5 py-1 rounded-lg">{formatMatchDate(match.matchDate)}</span>
                                                    )}
                                                </div>

                                                {/* Countdown */}
                                                <div className={`mx-4 mb-1 px-4 py-1.5 rounded-xl flex items-center gap-2 ${
                                                    locked ? 'bg-slate-100' : urgent ? 'bg-rose-50' : warning ? 'bg-amber-50' : 'bg-emerald-50/60'
                                                }`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                                        locked ? 'bg-slate-300' : urgent ? 'bg-rose-400 animate-pulse' : warning ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                                                    }`} />
                                                    <span className={`text-[10px] font-black uppercase tracking-widest tabular-nums ${
                                                        locked ? 'text-slate-400' : urgent ? 'text-rose-500' : warning ? 'text-amber-500' : 'text-emerald-600'
                                                    }`}>
                                                        {locked ? 'Predicciones cerradas' : `Cierra en ${formatCountdown(msLeft)}`}
                                                    </span>
                                                </div>

                                                {/* Teams + controls */}
                                                <div className="px-6 pb-6 pt-2 flex items-center gap-4">
                                                    {/* Home team */}
                                                    <div className="flex-1 min-w-0 flex flex-col items-end text-right">
                                                        <FlagImage teamName={match.homeTeam} emoji={match.homeFlag} size="xl" className="mb-2" />
                                                        <p className="font-black text-[13px] uppercase tracking-wide text-slate-600 truncate w-full">{match.homeTeam}</p>
                                                    </div>

                                                    {/* Score controls */}
                                                    <div className="flex items-center gap-2 shrink-0 bg-slate-50/50 p-2 rounded-[1.5rem] border border-slate-100/50">
                                                        {/* Home */}
                                                        <div className="flex flex-col items-center gap-2">
                                                            <button
                                                                onClick={() => adjustScore(match.id, 'home', 1)}
                                                                disabled={isSaved || locked}
                                                                className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 bg-white shadow-sm hover:shadow-md hover:text-emerald-500 active:scale-95 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:text-slate-400 transition-all"
                                                                aria-label="Más goles local"
                                                            >
                                                                <ChevronUp className="w-5 h-5" />
                                                            </button>
                                                            <div className={`score-digit ${poppedCell === `${match.id}-home` ? 'num-pop' : ''}`}>
                                                                <span className="text-3xl font-black text-teal-900 leading-none tabular-nums tracking-tighter">{score.home}</span>
                                                            </div>
                                                            <button
                                                                onClick={() => adjustScore(match.id, 'home', -1)}
                                                                disabled={score.home === 0 || isSaved || locked}
                                                                className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 bg-white shadow-sm hover:shadow-md hover:text-emerald-500 active:scale-95 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:text-slate-400 transition-all"
                                                                aria-label="Menos goles local"
                                                            >
                                                                <ChevronDown className="w-5 h-5" />
                                                            </button>
                                                        </div>

                                                        {/* Colon */}
                                                        <div className="flex flex-col items-center gap-2.5 pb-1 px-1">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                                        </div>

                                                        {/* Away */}
                                                        <div className="flex flex-col items-center gap-2">
                                                            <button
                                                                onClick={() => adjustScore(match.id, 'away', 1)}
                                                                disabled={isSaved || locked}
                                                                className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 bg-white shadow-sm hover:shadow-md hover:text-emerald-500 active:scale-95 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:text-slate-400 transition-all"
                                                                aria-label="Más goles visitante"
                                                            >
                                                                <ChevronUp className="w-5 h-5" />
                                                            </button>
                                                            <div className={`score-digit ${poppedCell === `${match.id}-away` ? 'num-pop' : ''}`}>
                                                                <span className="text-3xl font-black text-teal-900 leading-none tabular-nums tracking-tighter">{score.away}</span>
                                                            </div>
                                                            <button
                                                                onClick={() => adjustScore(match.id, 'away', -1)}
                                                                disabled={score.away === 0 || isSaved || locked}
                                                                className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 bg-white shadow-sm hover:shadow-md hover:text-emerald-500 active:scale-95 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:text-slate-400 transition-all"
                                                                aria-label="Menos goles visitante"
                                                            >
                                                                <ChevronDown className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Away team */}
                                                    <div className="flex-1 min-w-0 flex flex-col items-start text-left">
                                                        <FlagImage teamName={match.awayTeam} emoji={match.awayFlag} size="xl" className="mb-2" />
                                                        <p className="font-black text-[13px] uppercase tracking-wide text-slate-600 truncate w-full">{match.awayTeam}</p>
                                                    </div>
                                                </div>

                                                {match.venue && (
                                                    <p className="text-center text-[10px] text-slate-400 font-bold pb-5 px-4 -mt-2 uppercase tracking-wider">{match.venue}</p>
                                                )}

                                                {/* Save button */}
                                                <button
                                                    type="button"
                                                    onClick={() => !isSaved && !locked && handleSavePrediction(match.id)}
                                                    disabled={isSaving || isSaved || locked}
                                                    className={`w-full flex items-center justify-center gap-2.5 py-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-300 disabled:opacity-60 ${
                                                        locked
                                                            ? 'text-slate-400 bg-slate-100 cursor-not-allowed'
                                                            : isSaved
                                                                ? 'text-emerald-700 bg-emerald-50 cursor-not-allowed border-t border-emerald-100'
                                                                : 'text-white bg-gradient-to-r from-teal-500 to-emerald-500 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.3)] hover:shadow-[0_8px_25px_-4px_rgba(16,185,129,0.4)]'
                                                    }`}
                                                >
                                                    {locked
                                                        ? <Lock className="w-4 h-4" strokeWidth={2.5} />
                                                        : isSaving ? <Loader2 className="w-5 h-5 animate-spin" />
                                                        : isSaved ? <Lock className="w-4 h-4 text-emerald-600" strokeWidth={2.5} />
                                                        : null}
                                                    {locked ? 'Cerrado — quedan menos de 15 min' : isSaving ? 'Guardando...' : isSaved ? 'Predicción Guardada' : 'Guardar Predicción'}
                                                </button>
                                            </div>
                                        );
                                    })
                                )}

                                {/* Footer actions */}
                                {openMatches.length > 0 && (
                                    <div className="flex gap-4 pt-8 pb-12">
                                        <button
                                            onClick={() => setScreen('landing')}
                                            className="flex-1 py-4 rounded-full bg-white text-slate-500 text-[11px] font-black uppercase tracking-widest hover:text-slate-700 transition-all shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_25px_-4px_rgba(0,0,0,0.06)]"
                                        >
                                            Volver al Ranking
                                        </button>
                                        <AnimatePresence>
                                            {allSaved && (
                                                <motion.button
                                                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.9 }}
                                                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                                                    onClick={() => setScreen('success')}
                                                    className="flex-1 py-4 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-[0_8px_20px_-4px_rgba(16,185,129,0.3)] hover:shadow-[0_12px_25px_-4px_rgba(16,185,129,0.4)]"
                                                >
                                                    ¡Finalizar! →
                                                </motion.button>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* ─── SUCCESS ──────────────────────────────────────────────── */}
                    {screen === 'success' && (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.4 }}
                            className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-gradient-to-b from-[#FAFAFA] to-emerald-50/30"
                        >
                            {/* Check icon */}
                            <div className="entry-success mb-10 relative">
                                <div className="absolute inset-0 bg-emerald-300 rounded-full blur-2xl opacity-40 animate-pulse" />
                                <div className="relative w-28 h-28 bg-gradient-to-tr from-teal-500 to-emerald-400 rounded-[2.5rem] rotate-3 flex items-center justify-center shadow-[0_10px_40px_-10px_rgba(16,185,129,0.5)]">
                                    <Check className="w-14 h-14 text-white -rotate-3" strokeWidth={3.5} />
                                </div>
                            </div>

                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                                <p className="text-[12px] font-black uppercase tracking-[0.3em] text-emerald-500 mb-4 drop-shadow-sm">¡Predicciones hechas!</p>
                                <h1
                                    className="font-black text-slate-700 leading-[1.05] mb-6"
                                    style={{ fontSize: 'clamp(3rem, 9vw, 5rem)', letterSpacing: '-0.04em' }}
                                >
                                    ¡Genial,<br />{participant?.firstName}!
                                </h1>
                            </motion.div>

                            <motion.p
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                                className="text-base font-medium text-slate-500 leading-relaxed max-w-[320px] mx-auto mb-14"
                            >
                                Has guardado <span className="text-teal-700 font-black">{savedMatches.size} predicción{savedMatches.size !== 1 ? 'es' : ''}</span> exitosamente.
                            </motion.p>

                            <motion.div
                                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
                                className="w-full max-w-sm flex flex-col gap-4"
                            >
                                <button
                                    onClick={() => setScreen('landing')}
                                    className="w-full py-6 rounded-full bg-gradient-to-r from-slate-700 to-slate-600 text-white text-[14px] font-black uppercase tracking-widest hover:from-slate-600 hover:to-slate-500 transition-all shadow-[0_8px_25px_-4px_rgba(51,65,85,0.4)] hover:shadow-[0_12px_30px_-4px_rgba(51,65,85,0.5)]"
                                >
                                    Ver Ranking Global
                                </button>
                            </motion.div>
                        </motion.div>
                    )}

                </AnimatePresence>
            )}
        </>
    );
};

export default Prode;