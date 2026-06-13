import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabaseService } from '../../services/supabaseService';
import { useAuth } from '../../contexts/AuthContext';
import {
    ProdeMatch, ProdeParticipant, ProdeConfig,
    DEFAULT_PRODE_CONFIG, ProdeRound, UserRole
} from '../../types';
import {
    Trophy, Check, Loader2, Plus, Edit2, Trash2,
    ChevronLeft, X, CheckCircle, Medal, Search
} from 'lucide-react';
import { hasRole } from '../../services/authUtils';

// ── 48 equipos del FIFA World Cup 2026 ─────────────────────────────────────────
const WORLD_CUP_2026_TEAMS: { name: string; flag: string; confederation: string }[] = [
    // CONMEBOL
    { name: 'Argentina',      flag: '🇦🇷', confederation: 'CONMEBOL' },
    { name: 'Brasil',         flag: '🇧🇷', confederation: 'CONMEBOL' },
    { name: 'Colombia',       flag: '🇨🇴', confederation: 'CONMEBOL' },
    { name: 'Ecuador',        flag: '🇪🇨', confederation: 'CONMEBOL' },
    { name: 'Paraguay',       flag: '🇵🇾', confederation: 'CONMEBOL' },
    { name: 'Uruguay',        flag: '🇺🇾', confederation: 'CONMEBOL' },
    // UEFA
    { name: 'Alemania',       flag: '🇩🇪', confederation: 'UEFA' },
    { name: 'Austria',        flag: '🇦🇹', confederation: 'UEFA' },
    { name: 'Bélgica',        flag: '🇧🇪', confederation: 'UEFA' },
    { name: 'Bosnia',         flag: '🇧🇦', confederation: 'UEFA' },
    { name: 'Croacia',        flag: '🇭🇷', confederation: 'UEFA' },
    { name: 'Chequia',        flag: '🇨🇿', confederation: 'UEFA' },
    { name: 'Dinamarca',      flag: '🇩🇰', confederation: 'UEFA' },
    { name: 'Escocia',        flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', confederation: 'UEFA' },
    { name: 'España',         flag: '🇪🇸', confederation: 'UEFA' },
    { name: 'Francia',        flag: '🇫🇷', confederation: 'UEFA' },
    { name: 'Holanda',        flag: '🇳🇱', confederation: 'UEFA' },
    { name: 'Inglaterra',     flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', confederation: 'UEFA' },
    { name: 'Noruega',        flag: '🇳🇴', confederation: 'UEFA' },
    { name: 'Polonia',        flag: '🇵🇱', confederation: 'UEFA' },
    { name: 'Portugal',       flag: '🇵🇹', confederation: 'UEFA' },
    { name: 'Suecia',         flag: '🇸🇪', confederation: 'UEFA' },
    { name: 'Suiza',          flag: '🇨🇭', confederation: 'UEFA' },
    { name: 'Turquía',        flag: '🇹🇷', confederation: 'UEFA' },
    // AFC
    { name: 'Arabia Saudita', flag: '🇸🇦', confederation: 'AFC' },
    { name: 'Australia',      flag: '🇦🇺', confederation: 'AFC' },
    { name: 'Corea del Sur',  flag: '🇰🇷', confederation: 'AFC' },
    { name: 'Corea del Norte',flag: '🇰🇵', confederation: 'AFC' },
    { name: 'Irán',           flag: '🇮🇷', confederation: 'AFC' },
    { name: 'Iraq',           flag: '🇮🇶', confederation: 'AFC' },
    { name: 'Japón',          flag: '🇯🇵', confederation: 'AFC' },
    { name: 'Jordania',       flag: '🇯🇴', confederation: 'AFC' },
    { name: 'Qatar',          flag: '🇶🇦', confederation: 'AFC' },
    { name: 'Uzbekistán',     flag: '🇺🇿', confederation: 'AFC' },
    // CAF
    { name: 'Algeria',        flag: '🇩🇿', confederation: 'CAF' },
    { name: 'Congo DR',       flag: '🇨🇩', confederation: 'CAF' },
    { name: 'Egipto',         flag: '🇪🇬', confederation: 'CAF' },
    { name: 'Ghana',          flag: '🇬🇭', confederation: 'CAF' },
    { name: 'Marruecos',      flag: '🇲🇦', confederation: 'CAF' },
    { name: 'Nigeria',        flag: '🇳🇬', confederation: 'CAF' },
    { name: 'Senegal',        flag: '🇸🇳', confederation: 'CAF' },
    { name: 'Sudáfrica',      flag: '🇿🇦', confederation: 'CAF' },
    { name: 'Túnez',          flag: '🇹🇳', confederation: 'CAF' },
    // CONCACAF
    { name: 'Canadá',         flag: '🇨🇦', confederation: 'CONCACAF' },
    { name: 'Costa Rica',     flag: '🇨🇷', confederation: 'CONCACAF' },
    { name: 'Estados Unidos', flag: '🇺🇸', confederation: 'CONCACAF' },
    { name: 'Honduras',       flag: '🇭🇳', confederation: 'CONCACAF' },
    { name: 'México',         flag: '🇲🇽', confederation: 'CONCACAF' },
    { name: 'Panamá',         flag: '🇵🇦', confederation: 'CONCACAF' },
    // OFC
    { name: 'Nueva Zelanda',  flag: '🇳🇿', confederation: 'OFC' },
];

const CONF_ORDER = ['CONMEBOL', 'UEFA', 'AFC', 'CAF', 'CONCACAF', 'OFC'];
const TEAMS_SORTED = [...WORLD_CUP_2026_TEAMS].sort((a, b) => {
    const ci = CONF_ORDER.indexOf(a.confederation) - CONF_ORDER.indexOf(b.confederation);
    if (ci !== 0) return ci;
    return a.name.localeCompare(b.name, 'es');
});

// ── Flag helpers ────────────────────────────────────────────────────────────────
const TEAM_TO_CODE: Record<string, string> = {
    'argentina': 'ar', 'brasil': 'br', 'brazil': 'br', 'uruguay': 'uy',
    'colombia': 'co', 'chile': 'cl', 'ecuador': 'ec', 'paraguay': 'py',
    'venezuela': 've', 'bolivia': 'bo', 'peru': 'pe', 'perú': 'pe',
    'francia': 'fr', 'france': 'fr',
    'inglaterra': 'gb-eng', 'england': 'gb-eng',
    'españa': 'es', 'espana': 'es', 'spain': 'es',
    'alemania': 'de', 'germany': 'de',
    'portugal': 'pt', 'italia': 'it', 'italy': 'it',
    'paises bajos': 'nl', 'países bajos': 'nl', 'holanda': 'nl', 'netherlands': 'nl',
    'croacia': 'hr', 'croatia': 'hr',
    'belgica': 'be', 'bélgica': 'be', 'belgium': 'be',
    'dinamarca': 'dk', 'denmark': 'dk',
    'suiza': 'ch', 'switzerland': 'ch',
    'serbia': 'rs', 'polonia': 'pl', 'poland': 'pl',
    'escocia': 'gb-sct', 'scotland': 'gb-sct',
    'gales': 'gb-wls', 'wales': 'gb-wls',
    'suecia': 'se', 'sweden': 'se',
    'ucrania': 'ua', 'ukraine': 'ua',
    'bosnia y herzegovina': 'ba', 'bosnia': 'ba',
    'austria': 'at', 'noruega': 'no', 'norway': 'no',
    'turquia': 'tr', 'turquía': 'tr', 'turkey': 'tr',
    'japon': 'jp', 'japón': 'jp', 'japan': 'jp',
    'corea del sur': 'kr', 'republica de corea': 'kr', 'south korea': 'kr', 'korea': 'kr',
    'corea del norte': 'kp', 'north korea': 'kp',
    'chequia': 'cz', 'republica checa': 'cz', 'czech republic': 'cz', 'czechia': 'cz',
    'arabia saudita': 'sa', 'saudi arabia': 'sa',
    'iran': 'ir', 'irán': 'ir',
    'australia': 'au', 'qatar': 'qa', 'katar': 'qa',
    'iraq': 'iq', 'jordania': 'jo', 'uzbekistan': 'uz', 'uzbekistán': 'uz',
    'senegal': 'sn', 'marruecos': 'ma', 'morocco': 'ma',
    'tunez': 'tn', 'túnez': 'tn', 'tunisia': 'tn',
    'ghana': 'gh', 'nigeria': 'ng', 'egipto': 'eg', 'egypt': 'eg',
    'sudafrica': 'za', 'sudáfrica': 'za', 'south africa': 'za',
    'algeria': 'dz', 'argelia': 'dz',
    'congo dr': 'cd', 'congo': 'cd',
    'mexico': 'mx', 'méxico': 'mx',
    'estados unidos': 'us', 'usa': 'us', 'united states': 'us',
    'costa rica': 'cr', 'canada': 'ca', 'canadá': 'ca',
    'honduras': 'hn', 'panama': 'pa', 'panamá': 'pa',
    'nueva zelanda': 'nz', 'new zealand': 'nz',
};

const normalizeName = (name: string): string =>
    name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

interface FlagImageProps { teamName: string; size?: 'sm' | 'md' | 'lg'; emoji?: string; className?: string; }
const FlagImage: React.FC<FlagImageProps> = ({ teamName, size = 'md', emoji, className = '' }) => {
    const code = TEAM_TO_CODE[normalizeName(teamName)];
    if (!code) {
        if (emoji) return <span className={`leading-none ${className}`} style={{ fontSize: size === 'lg' ? '2rem' : size === 'md' ? '1.5rem' : '1rem' }}>{emoji}</span>;
        return <span className={`text-slate-300 font-bold uppercase text-xs ${className}`}>{teamName.substring(0, 2)}</span>;
    }
    const px = size === 'lg' ? 48 : size === 'md' ? 32 : 20;
    const h  = size === 'lg' ? 32 : size === 'md' ? 22 : 14;
    return (
        <img src={`https://flagcdn.com/${code}.svg`} alt={teamName} width={px}
            className={`rounded-[3px] shadow-sm object-cover shrink-0 ${className}`}
            style={{ height: `${h}px` }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
    );
};

const toDatetimeLocal = (iso: string): string => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fmtDate = (iso: string): string =>
    new Date(iso).toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit',
    });

// ── Componente selector de equipo ───────────────────────────────────────────────
interface TeamSelectorProps {
    value: string;
    flagValue: string;
    label: string;
    onSelect: (name: string, flag: string) => void;
}

const TeamSelector: React.FC<TeamSelectorProps> = ({ value, flagValue, label, onSelect }) => {
    const [customName, setCustomName] = useState(value);
    useEffect(() => { setCustomName(value); }, [value]);

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const teamName = e.target.value;
        if (!teamName) return;
        const team = WORLD_CUP_2026_TEAMS.find(t => t.name === teamName);
        if (team) {
            setCustomName(team.name);
            onSelect(team.name, team.flag);
        }
    };

    return (
        <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block">
                {label}
            </label>
            <select
                value={value}
                onChange={handleSelectChange}
                className="w-full h-9 px-2 border-2 border-black font-bold text-sm bg-white focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
                <option value="">— Elegir equipo —</option>
                {CONF_ORDER.map(conf => {
                    const teams = TEAMS_SORTED.filter(t => t.confederation === conf);
                    if (!teams.length) return null;
                    return (
                        <optgroup key={conf} label={conf}>
                            {teams.map(t => (
                                <option key={t.name} value={t.name}>{t.flag} {t.name}</option>
                            ))}
                        </optgroup>
                    );
                })}
            </select>
            <div className="flex items-center gap-2">
                {flagValue && (
                    <span className="text-3xl leading-none select-none" aria-hidden="true">{flagValue}</span>
                )}
                <input
                    type="text"
                    placeholder="Nombre del equipo"
                    value={customName}
                    onChange={e => {
                        setCustomName(e.target.value);
                        onSelect(e.target.value, flagValue);
                    }}
                    className="flex-1 h-8 px-2 border-2 border-neutral-300 font-bold text-sm focus:outline-none focus:border-black"
                />
            </div>
        </div>
    );
};

const AdminProdeContent: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    type ProdeAdminSection = 'config' | 'matches' | 'results' | 'ranking' | 'predictions';
    const [prodeSection, setProdeSection] = useState<ProdeAdminSection>('config');

    useEffect(() => {
        const TAB_MAP: Record<string, ProdeAdminSection> = {
            configuracion: 'config',
            partidos:      'matches',
            resultados:    'results',
            ranking:       'ranking',
            predicciones:  'predictions',
        };
        const tab = new URLSearchParams(location.search).get('tab');
        if (tab && TAB_MAP[tab]) setProdeSection(TAB_MAP[tab]);
    }, [location.search]);

    // Config del prode
    const [prodeConfig, setProdeConfig] = useState<ProdeConfig>(DEFAULT_PRODE_CONFIG);
    const [prodeSavingConfig, setProdeSavingConfig] = useState(false);
    const [prodeConfigSaved, setProdeConfigSaved] = useState(false);

    // Partidos
    const [prodeMatches, setProdeMatches] = useState<ProdeMatch[]>([]);
    const [prodeMatchesLoading, setProdeMatchesLoading] = useState(false);
    const [editingMatch, setEditingMatch] = useState<Partial<ProdeMatch> | null>(null);
    const [savingMatch, setSavingMatch] = useState(false);

    // Resultados
    const [resultScores, setResultScores] = useState<Record<string, { home: number; away: number }>>({});
    const [submittingResult, setSubmittingResult] = useState<string | null>(null);

    // Ranking admin
    const [prodeRanking, setProdeRanking] = useState<ProdeParticipant[]>([]);
    const [rankingLoading, setRankingLoading] = useState(false);
    const [adjustments, setAdjustments] = useState<Record<string, string>>({});
    const [applyingAdjustment, setApplyingAdjustment] = useState<string | null>(null);
    const [recalculating, setRecalculating] = useState(false);

    // Seccion Predicciones
    type PredRow = {
        predictionId: string;
        participantId: string;
        participantName: string;
        userId: string | null;
        matchId: string;
        matchNumber: number;
        homeTeam: string;
        awayTeam: string;
        homeFlag: string;
        awayFlag: string;
        homeScorePred: number;
        awayScorePred: number;
        pointsEarned: number | null;
        isMatchFinished: boolean;
        createdAt: string;
    };

    const [allPredictions, setAllPredictions] = useState<PredRow[]>([]);
    const [predsLoading, setPredsLoading] = useState(false);
    const [predSearchTerm, setPredSearchTerm] = useState('');

    // Formulario nueva prediccion
    const [showNewPredForm, setShowNewPredForm] = useState(false);
    const [newPredParticipantSearch, setNewPredParticipantSearch] = useState('');
    const [newPredParticipants, setNewPredParticipants] = useState<ProdeParticipant[]>([]);
    const [newPredSelectedParticipant, setNewPredSelectedParticipant] = useState<ProdeParticipant | null>(null);
    const [newPredMatchId, setNewPredMatchId] = useState('');
    const [newPredHome, setNewPredHome] = useState(0);
    const [newPredAway, setNewPredAway] = useState(0);
    const [savingNewPred, setSavingNewPred] = useState(false);

    // Edicion inline
    const [editingPredId, setEditingPredId] = useState<string | null>(null);
    const [editPredHome, setEditPredHome] = useState(0);
    const [editPredAway, setEditPredAway] = useState(0);
    const [savingEditPred, setSavingEditPred] = useState(false);
    const [deletingPredId, setDeletingPredId] = useState<string | null>(null);

    // Carga inicial al montar el componente
    useEffect(() => {
        const load = async () => {
            setProdeMatchesLoading(true);
            setRankingLoading(true);
            try {
                const [cfg, matches, ranking, allPreds] = await Promise.all([
                    supabaseService.getAppConfig(),
                    supabaseService.getProdeMatches(),
                    supabaseService.getProdeRanking(),
                    supabaseService.getAllProdePredictions(),
                ]);
                setAllPredictions(allPreds);
                if (cfg?.prodeConfig) {
                    setProdeConfig(cfg.prodeConfig);
                }
                // Auto-cerrar partidos que pasaron el corte de 15 min antes del inicio
                const CUTOFF = 15 * 60 * 1000;
                const toClose = matches.filter(m =>
                    m.isOpen && !m.isFinished && m.matchDate &&
                    new Date(m.matchDate).getTime() - CUTOFF <= Date.now()
                );
                let finalMatches = matches;
                if (toClose.length > 0) {
                    await Promise.all(toClose.map(m =>
                        supabaseService.saveProdeMatch({ ...m, isOpen: false } as Parameters<typeof supabaseService.saveProdeMatch>[0])
                    ));
                    finalMatches = await supabaseService.getProdeMatches();
                }

                setProdeMatches(finalMatches);
                setProdeRanking(ranking);

                const scores: Record<string, { home: number; away: number }> = {};
                finalMatches
                    .filter(m => !m.isOpen && !m.isFinished)
                    .forEach(m => { scores[m.id] = { home: 0, away: 0 }; });
                setResultScores(scores);
            } catch (err) {
                console.error('[AdminProde] load:', err);
            } finally {
                setProdeMatchesLoading(false);
                setRankingLoading(false);
            }
        };
        load();
    }, []);

    // ── Guardar config del prode ─────────────────
    const handleSaveProdeConfig = async () => {
        setProdeSavingConfig(true);
        try {
            const currentConfig = await supabaseService.getAppConfig();
            const updatedConfig = { ...currentConfig, prodeConfig };
            const ok = await supabaseService.saveAppConfig(updatedConfig as Parameters<typeof supabaseService.saveAppConfig>[0]);
            if (ok) {
                setProdeConfigSaved(true);
                setTimeout(() => setProdeConfigSaved(false), 2500);
            }
        } finally {
            setProdeSavingConfig(false);
        }
    };

    // ── Guardar partido ──────────────────────────
    const handleSaveProdeMatch = async () => {
        if (!editingMatch || !editingMatch.homeTeam || !editingMatch.awayTeam || !editingMatch.matchNumber) return;
        setSavingMatch(true);
        try {
            const saved = await supabaseService.saveProdeMatch(
                editingMatch as Partial<ProdeMatch> & { matchNumber: number }
            );
            if (saved) {
                const updated = await supabaseService.getProdeMatches();
                setProdeMatches(updated);
                setEditingMatch(null);
            }
        } finally {
            setSavingMatch(false);
        }
    };

    const handleToggleMatchStatus = async (match: ProdeMatch) => {
        setSavingMatch(true);
        try {
            const saved = await supabaseService.saveProdeMatch({
                ...match,
                isOpen: !match.isOpen
            } as Parameters<typeof supabaseService.saveProdeMatch>[0]);
            if (saved) {
                const updated = await supabaseService.getProdeMatches();
                setProdeMatches(updated);
            }
        } finally {
            setSavingMatch(false);
        }
    };

    // ── Publicar resultado ───────────────────────
    const handlePublishResult = async (matchId: string) => {
        const score = resultScores[matchId];
        if (!score) return;
        setSubmittingResult(matchId);
        try {
            await supabaseService.setProdeMatchResult(
                matchId,
                score.home,
                score.away,
                prodeConfig.pointsExactScore,
                prodeConfig.pointsCorrectResult,
                prodeConfig.pointsPartialGoal ?? 1,
                prodeConfig.pointsWrong
            );
            // Actualizar estado local sin refetch
            setProdeMatches(prev => prev.map(m =>
                m.id === matchId
                    ? { ...m, homeScoreReal: score.home, awayScoreReal: score.away, isFinished: true, isOpen: false }
                    : m
            ));
            setResultScores(prev => { const c = { ...prev }; delete c[matchId]; return c; });
        } finally {
            setSubmittingResult(null);
        }
    };

    // ── Editar Resultado ─────────────────────────
    const handleEditResult = async (matchId: string, oldHome: number, oldAway: number) => {
        if (!window.confirm('Vas a editar este resultado. El partido pasará a "pendientes" temporalmente hasta que lo vuelvas a publicar.')) return;
        setSubmittingResult(matchId);
        try {
            await supabaseService.resetProdeMatchResult(matchId);
            await handleRecalculate(true);
            setProdeMatches(prev => prev.map(m =>
                m.id === matchId
                    ? { ...m, homeScoreReal: undefined, awayScoreReal: undefined, isFinished: false, isOpen: false }
                    : m
            ));
            setResultScores(prev => ({ ...prev, [matchId]: { home: oldHome, away: oldAway } }));
        } finally {
            setSubmittingResult(null);
        }
    };

    // ── Deshacer Resultado ───────────────────────
    const handleResetResult = async (matchId: string) => {
        if (!window.confirm('¿Estás seguro de deshacer este resultado? Se restarán los puntos a todos los participantes.')) return;
        setSubmittingResult(matchId);
        try {
            await supabaseService.resetProdeMatchResult(matchId);
            await handleRecalculate(true);
            setProdeMatches(prev => prev.map(m =>
                m.id === matchId
                    ? { ...m, homeScoreReal: undefined, awayScoreReal: undefined, isFinished: false, isOpen: false }
                    : m
            ));
            setResultScores(prev => { const c = { ...prev }; delete c[matchId]; return c; });
        } finally {
            setSubmittingResult(null);
        }
    };

    // ── Eliminar Participante ────────────────────
    const handleDeleteParticipant = async (participantId: string) => {
        if (!window.confirm('¿Estás seguro de eliminar este participante y todas sus predicciones? Esta acción no se puede deshacer.')) return;
        setApplyingAdjustment(participantId);
        try {
            await supabaseService.deleteProdeParticipant(participantId);
            const updated = await supabaseService.getProdeRanking();
            setProdeRanking(updated);
        } finally {
            setApplyingAdjustment(null);
        }
    };

    // ── Aplicar ajuste de puntos ─────────────────
    const handleApplyAdjustment = async (participantId: string) => {
        const delta = parseInt(adjustments[participantId] || '0');
        if (isNaN(delta) || delta === 0) return;
        setApplyingAdjustment(participantId);
        try {
            await supabaseService.adjustProdePoints(participantId, delta);
            const updated = await supabaseService.getProdeRanking();
            setProdeRanking(updated);
            setAdjustments(prev => ({ ...prev, [participantId]: '' }));
        } finally {
            setApplyingAdjustment(null);
        }
    };

    // Recargar predicciones
    const reloadPredictions = async () => {
        setPredsLoading(true);
        const preds = await supabaseService.getAllProdePredictions();
        setAllPredictions(preds);
        setPredsLoading(false);
    };

    // Buscar participantes para nueva prediccion
    const handleSearchParticipants = async (term: string) => {
        setNewPredParticipantSearch(term);
        if (!term.trim()) { setNewPredParticipants([]); return; }
        const all = await supabaseService.getAllProdeParticipants();
        setNewPredParticipants(
            all.filter(p =>
                `${p.firstName} ${p.lastName}`.toLowerCase().includes(term.toLowerCase())
            )
        );
    };

    // Guardar nueva prediccion (admin)
    const handleSaveNewPred = async () => {
        if (!newPredSelectedParticipant || !newPredMatchId) return;
        setSavingNewPred(true);
        try {
            const ok = await supabaseService.saveProdePredictionAdmin(
                newPredSelectedParticipant.id,
                newPredMatchId,
                newPredHome,
                newPredAway
            );
            if (ok) {
                setShowNewPredForm(false);
                setNewPredSelectedParticipant(null);
                setNewPredParticipantSearch('');
                setNewPredMatchId('');
                setNewPredHome(0);
                setNewPredAway(0);
                await reloadPredictions();
            }
        } finally { setSavingNewPred(false); }
    };

    // Guardar edicion de prediccion
    const handleSaveEditPred = async (
        _predictionId: string,
        participantId: string,
        matchId: string
    ) => {
        setSavingEditPred(true);
        try {
            const ok = await supabaseService.saveProdePredictionAdmin(
                participantId, matchId, editPredHome, editPredAway
            );
            if (ok) { setEditingPredId(null); await reloadPredictions(); }
        } finally { setSavingEditPred(false); }
    };

    // Eliminar prediccion
    const handleDeletePred = async (predictionId: string) => {
        if (!window.confirm('Eliminar esta prediccion. El usuario podra volver a predecir si el partido esta abierto.')) return;
        setDeletingPredId(predictionId);
        try {
            await supabaseService.deleteProdePrediction(predictionId);
            await reloadPredictions();
        } finally { setDeletingPredId(null); }
    };

    // Recalcular todos los puntos
    const handleRecalculate = async (skipConfirm = false) => {
        if (!skipConfirm && !window.confirm(
            'Esto recalculará los puntos de TODOS los participantes desde cero. ¿Continuar?'
        )) return;
        setRecalculating(true);
        try {
            await supabaseService.recalculateAllProdePoints(
                prodeConfig.pointsExactScore,
                prodeConfig.pointsCorrectResult,
                prodeConfig.pointsPartialGoal ?? 1,
                prodeConfig.pointsWrong
            );
            const updated = await supabaseService.getProdeRanking();
            setProdeRanking(updated);
        } finally {
            setRecalculating(false);
        }
    };

    return (
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-10">

            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 border-2 border-black hover:bg-black hover:text-white transition-all"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3">
                    <Trophy className="w-6 h-6 text-amber-500" />
                    <div>
                        <h1 className="text-lg font-black uppercase tracking-tight">Administración Prode</h1>
                        <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Mundial 2026</p>
                    </div>
                </div>
            </div>

            <div className="space-y-6 animate-fadeIn">

                {/* Sub-navegación */}
                <div className="flex gap-4 border-b border-slate-200 overflow-x-auto scrollbar-hide pb-1">
                    {([
                        { id: 'config',      label: 'Configuracion' },
                        { id: 'matches',     label: 'Partidos' },
                        { id: 'results',     label: 'Resultados' },
                        { id: 'ranking',     label: 'Ranking' },
                        { id: 'predictions', label: 'Predicciones' },
                    ] as { id: ProdeAdminSection; label: string }[]).map(s => (
                        <button
                            key={s.id}
                            onClick={() => setProdeSection(s.id)}
                            className={`pb-3 px-1 text-xs font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
                                prodeSection === s.id
                                    ? 'border-black text-black'
                                    : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>

                {/* ── CONFIGURACIÓN ──────────────────── */}
                {prodeSection === 'config' && (
                    <div className="max-w-2xl space-y-6">
                        <h3 className="text-sm font-black uppercase tracking-tight">Configuración del Prode</h3>

                        {/* Toggle activo */}
                        <div className="flex items-center justify-between p-4 border-2 border-black">
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest">Prode activo</p>
                                <p className="text-[10px] font-medium text-neutral-500 mt-0.5">
                                    Los usuarios pueden acceder a la página /prode
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setProdeConfig(p => ({ ...p, isActive: !p.isActive }))}
                                className={`px-4 py-2 border-2 text-xs font-black uppercase tracking-widest transition-all ${
                                    prodeConfig.isActive
                                        ? 'bg-black border-black text-white'
                                        : 'bg-white border-black text-black hover:bg-neutral-100'
                                }`}
                            >
                                {prodeConfig.isActive ? 'Activo' : 'Inactivo'}
                            </button>
                        </div>

                        {/* Banner */}
                        <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Banner</p>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1 block">Título</label>
                                <input
                                    type="text"
                                    value={prodeConfig.bannerTitle}
                                    onChange={e => setProdeConfig(p => ({ ...p, bannerTitle: e.target.value }))}
                                    className="w-full h-10 px-3 border-2 border-black font-bold text-sm focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1 block">Subtítulo</label>
                                <input
                                    type="text"
                                    value={prodeConfig.bannerSubtitle}
                                    onChange={e => setProdeConfig(p => ({ ...p, bannerSubtitle: e.target.value }))}
                                    className="w-full h-10 px-3 border-2 border-black font-bold text-sm focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                />
                            </div>
                        </div>

                        {/* Sistema de puntuación */}
                        <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Sistema de puntuación</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { key: 'pointsExactScore',    label: 'Exacto'   },
                                    { key: 'pointsCorrectResult', label: 'Ganador'  },
                                    { key: 'pointsPartialGoal',   label: 'Parcial'  },
                                    { key: 'pointsWrong',         label: 'Fallo'    },
                                ].map(field => (
                                    <div key={field.key}>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1 block">{field.label}</label>
                                        <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={prodeConfig[field.key as keyof ProdeConfig] as number}
                                            onChange={e => setProdeConfig(p => ({ ...p, [field.key]: parseInt(e.target.value) || 0 }))}
                                            className="w-full h-12 px-3 border-2 border-black font-black text-lg text-center focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Botones de guardado */}
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleSaveProdeConfig}
                                disabled={prodeSavingConfig}
                                className={`flex-1 py-3 border-2 text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                                    prodeConfigSaved
                                        ? 'border-[#006633] text-[#006633]'
                                        : 'border-black bg-black text-white hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                                } disabled:opacity-50`}
                            >
                                {prodeSavingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : prodeConfigSaved ? <><Check className="w-4 h-4" /> Guardado</> : 'Guardar configuración'}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleRecalculate()}
                                disabled={recalculating}
                                className="px-4 py-3 border-2 border-amber-500 text-amber-600 text-xs font-black uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {recalculating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Recalcular puntos'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── PARTIDOS ───────────────────────── */}
                {prodeSection === 'matches' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black uppercase tracking-tight">Partidos ({prodeMatches.length})</h3>
                            <button
                                type="button"
                                onClick={() => setEditingMatch({ matchNumber: prodeMatches.length + 1, round: 'Fase de grupos', isOpen: false, isFinished: false })}
                                className="flex items-center gap-2 px-4 py-2 bg-black text-white border-2 border-black text-xs font-black uppercase tracking-widest hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                            >
                                <Plus className="w-4 h-4" /> Nuevo partido
                            </button>
                        </div>

                        {/* Formulario inline de edición */}
                        {editingMatch && (
                            <div className="border-2 border-black p-5 bg-neutral-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4 mb-8">
                                <div className="flex justify-between items-center mb-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest">{editingMatch.id ? 'Editar partido' : 'Nuevo partido'}</p>
                                    <button onClick={() => setEditingMatch(null)} className="text-neutral-500 hover:text-black"><X className="w-4 h-4" /></button>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1 block">Nº</label>
                                        <input type="number" min={1} value={editingMatch.matchNumber || ''} onChange={e => setEditingMatch(m => ({ ...m!, matchNumber: parseInt(e.target.value) || 1 }))} className="w-full h-9 px-2 border-2 border-black font-bold text-sm focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1 block">Fase</label>
                                        <select value={editingMatch.round || 'Fase de grupos'} onChange={e => setEditingMatch(m => ({ ...m!, round: e.target.value as ProdeRound }))} className="w-full h-9 px-2 border-2 border-black font-bold text-xs bg-white focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                            {['Fase de grupos', 'Octavos de final', 'Cuartos de final', 'Semifinal', 'Tercer puesto', 'Final'].map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1 block">Grupo</label>
                                        <input type="text" placeholder="Grupo A" value={editingMatch.groupName || ''} onChange={e => setEditingMatch(m => ({ ...m!, groupName: e.target.value }))} className="w-full h-9 px-2 border-2 border-black font-bold text-sm focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1 block">Sede</label>
                                        <input type="text" placeholder="Ciudad" value={editingMatch.venue || ''} onChange={e => setEditingMatch(m => ({ ...m!, venue: e.target.value }))} className="w-full h-9 px-2 border-2 border-black font-bold text-sm focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <TeamSelector
                                        label="Local"
                                        value={editingMatch.homeTeam || ''}
                                        flagValue={editingMatch.homeFlag || ''}
                                        onSelect={(name, flag) => setEditingMatch(m => ({ ...m!, homeTeam: name, homeFlag: flag }))}
                                    />
                                    <TeamSelector
                                        label="Visitante"
                                        value={editingMatch.awayTeam || ''}
                                        flagValue={editingMatch.awayFlag || ''}
                                        onSelect={(name, flag) => setEditingMatch(m => ({ ...m!, awayTeam: name, awayFlag: flag }))}
                                    />
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                                    <div className="col-span-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1 block">Fecha y Hora</label>
                                        <input type="datetime-local" value={editingMatch.matchDate ? toDatetimeLocal(editingMatch.matchDate) : ''} onChange={e => setEditingMatch(m => ({ ...m!, matchDate: e.target.value ? new Date(e.target.value).toISOString() : new Date().toISOString() }))} className="w-full h-9 px-2 border-2 border-black font-bold text-xs focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" />
                                    </div>
                                    <div className="col-span-2 flex items-center justify-end gap-3 mt-4 md:mt-0">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={editingMatch.isOpen || false} onChange={e => setEditingMatch(m => ({ ...m!, isOpen: e.target.checked }))} className="w-4 h-4 border-2 border-black rounded-none" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Aceptar Predicciones</span>
                                        </label>
                                        <button onClick={handleSaveProdeMatch} disabled={savingMatch} className="px-6 h-9 bg-black text-white border-2 border-black text-xs font-black uppercase tracking-widest hover:bg-white hover:text-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50">
                                            {savingMatch ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Lista de Partidos */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {prodeMatches.length === 0 && !prodeMatchesLoading && (
                                <div className="col-span-full py-10 border-2 border-dashed border-neutral-300 text-center">
                                    <p className="text-xs font-black text-neutral-400 uppercase tracking-widest">No hay partidos cargados</p>
                                </div>
                            )}
                            {prodeMatchesLoading && <div className="col-span-full text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-neutral-400" /></div>}

                            {prodeMatches.map(match => (
                                <div key={match.id} className={`border-2 ${match.isFinished ? 'border-neutral-200 bg-neutral-50' : 'border-black bg-white'} p-4 flex flex-col gap-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black uppercase text-black bg-neutral-200 px-1 py-0.5">Nº {match.matchNumber}</span>
                                                <span className="text-[10px] font-bold text-neutral-500 uppercase">{match.round} {match.groupName && `- ${match.groupName}`}</span>
                                            </div>
                                            <p className="text-[10px] font-medium text-neutral-500 mt-1">{fmtDate(match.matchDate)}</p>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => setEditingMatch(match)} className="p-1 border border-transparent hover:border-black transition-all" title="Editar"><Edit2 className="w-4 h-4 text-black" /></button>
                                            <button onClick={async () => { if (window.confirm('¿Eliminar partido?')) { await supabaseService.deleteProdeMatch(match.id); setProdeMatches(await supabaseService.getProdeMatches()); } }} className="p-1 border border-transparent hover:border-red-500 text-red-500 transition-all" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between mt-2">
                                        <div className="flex items-center gap-2 w-2/5">
                                            <FlagImage teamName={match.homeTeam} emoji={match.homeFlag} size="md" />
                                            <span className="text-xs font-black uppercase truncate">{match.homeTeam}</span>
                                        </div>
                                        <div className="flex-1 flex flex-col items-center justify-center">
                                            <div className="flex items-center gap-2 px-3 py-1 border-2 border-black bg-neutral-100">
                                                <span className="font-black text-sm">{match.homeScoreReal ?? '-'}</span>
                                                <span className="text-neutral-400 font-bold">:</span>
                                                <span className="font-black text-sm">{match.awayScoreReal ?? '-'}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-end gap-2 w-2/5">
                                            <span className="text-xs font-black uppercase truncate text-right">{match.awayTeam}</span>
                                            <FlagImage teamName={match.awayTeam} emoji={match.awayFlag} size="md" />
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center pt-2 mt-2 border-t-2 border-dashed border-neutral-200">
                                        <button
                                            onClick={() => handleToggleMatchStatus(match)}
                                            disabled={savingMatch}
                                            title={match.isOpen ? 'Hacer clic para cerrar' : 'Hacer clic para abrir'}
                                            className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 transition-all disabled:opacity-50 shadow-[1px_1px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] ${match.isOpen ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300' : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300 border border-neutral-300'}`}
                                        >
                                            {match.isOpen ? 'Cerrar predicciones' : 'Abrir predicciones'}
                                        </button>
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 ${match.isFinished ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-400'}`}>
                                            {match.isFinished ? 'Finalizado' : 'Pendiente'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── RESULTADOS ─────────────────────── */}
                {prodeSection === 'results' && (
                    <div className="space-y-4">
                        <h3 className="text-sm font-black uppercase tracking-tight">Cargar Resultados Reales</h3>
                        <p className="text-[10px] font-medium text-neutral-500 mb-4 max-w-xl">
                            Aquí aparecen los partidos que ya están cerrados (no aceptan más predicciones) pero aún no tienen un resultado final publicado. Al publicar el resultado, se calcularán automáticamente los puntos de todos los usuarios que hayan participado.
                        </p>

                        <div className="space-y-4">
                            {prodeMatches.filter(m => !m.isOpen && !m.isFinished).length === 0 && (
                                <div className="py-10 border-2 border-dashed border-neutral-300 text-center">
                                    <CheckCircle className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                                    <p className="text-xs font-black text-neutral-400 uppercase tracking-widest">No hay partidos pendientes de resultado</p>
                                </div>
                            )}

                            {prodeMatches.filter(m => !m.isOpen && !m.isFinished).map(match => (
                                <div key={match.id} className="border-2 border-black p-4 md:p-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row items-center justify-between gap-6">
                                    <div className="flex flex-col items-center md:items-start w-full md:w-auto">
                                        <span className="text-[10px] font-black uppercase text-neutral-500 mb-1">Partido Nº {match.matchNumber}</span>
                                        <div className="flex items-center gap-4 text-sm font-black uppercase">
                                            <div className="flex items-center gap-2"><FlagImage teamName={match.homeTeam} emoji={match.homeFlag} size="md" /> {match.homeTeam}</div>
                                            <span className="text-neutral-300">VS</span>
                                            <div className="flex items-center gap-2">{match.awayTeam} <FlagImage teamName={match.awayTeam} emoji={match.awayFlag} size="md" /></div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto justify-center">
                                        {/* Marcador con controles +/- horizontales */}
                                        <div className="flex items-center gap-2">
                                            {/* Local */}
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-11 text-center font-black text-2xl tabular-nums select-none text-slate-800">
                                                    {resultScores[match.id]?.home ?? 0}
                                                </span>
                                                <div className="flex flex-col gap-1">
                                                    <button
                                                        onClick={() => setResultScores(p => ({ ...p, [match.id]: { ...p[match.id], home: (p[match.id]?.home ?? 0) + 1 } }))}
                                                        disabled={submittingResult === match.id}
                                                        className="w-9 h-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-base flex items-center justify-center shadow-sm transition-all disabled:opacity-40"
                                                    >+</button>
                                                    <button
                                                        onClick={() => setResultScores(p => ({ ...p, [match.id]: { ...p[match.id], home: Math.max(0, (p[match.id]?.home ?? 0) - 1) } }))}
                                                        disabled={submittingResult === match.id}
                                                        className="w-9 h-9 rounded-lg bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-black text-base flex items-center justify-center shadow-sm transition-all disabled:opacity-40"
                                                    >−</button>
                                                </div>
                                            </div>

                                            <span className="font-black text-slate-300 text-2xl px-1">—</span>

                                            {/* Visitante */}
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-11 text-center font-black text-2xl tabular-nums select-none text-slate-800">
                                                    {resultScores[match.id]?.away ?? 0}
                                                </span>
                                                <div className="flex flex-col gap-1">
                                                    <button
                                                        onClick={() => setResultScores(p => ({ ...p, [match.id]: { ...p[match.id], away: (p[match.id]?.away ?? 0) + 1 } }))}
                                                        disabled={submittingResult === match.id}
                                                        className="w-9 h-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-base flex items-center justify-center shadow-sm transition-all disabled:opacity-40"
                                                    >+</button>
                                                    <button
                                                        onClick={() => setResultScores(p => ({ ...p, [match.id]: { ...p[match.id], away: Math.max(0, (p[match.id]?.away ?? 0) - 1) } }))}
                                                        disabled={submittingResult === match.id}
                                                        className="w-9 h-9 rounded-lg bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-black text-base flex items-center justify-center shadow-sm transition-all disabled:opacity-40"
                                                    >−</button>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handlePublishResult(match.id)}
                                            disabled={submittingResult === match.id}
                                            className="h-12 px-8 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 w-full sm:w-auto justify-center"
                                        >
                                            {submittingResult === match.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Publicar</>}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ── RESULTADOS PUBLICADOS ── */}
                        <div className="mt-12 space-y-4">
                            <h3 className="text-sm font-black uppercase tracking-tight">Resultados Publicados</h3>
                            <div className="space-y-3">
                                {prodeMatches.filter(m => m.isFinished && m.homeScoreReal !== undefined && m.awayScoreReal !== undefined).sort((a, b) => new Date(b.matchDate || 0).getTime() - new Date(a.matchDate || 0).getTime()).map(match => (
                                    <div key={match.id} className="bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] border border-slate-100 rounded-[2rem] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden group">
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
                                        <div className="hidden md:flex md:w-1/4 items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleEditResult(match.id, match.homeScoreReal!, match.awayScoreReal!)}
                                                className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2"
                                            >
                                                <Edit2 className="w-3 h-3" /> Editar
                                            </button>
                                            <button
                                                onClick={() => handleResetResult(match.id)}
                                                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2"
                                            >
                                                <Trash2 className="w-3 h-3" /> Deshacer
                                            </button>
                                        </div>
                                        <div className="md:hidden mt-4 w-full flex flex-col gap-2">
                                            <button
                                                onClick={() => handleEditResult(match.id, match.homeScoreReal!, match.awayScoreReal!)}
                                                className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex justify-center items-center gap-2"
                                            >
                                                <Edit2 className="w-3 h-3" /> Editar Resultado
                                            </button>
                                            <button
                                                onClick={() => handleResetResult(match.id)}
                                                className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex justify-center items-center gap-2"
                                            >
                                                <Trash2 className="w-3 h-3" /> Deshacer / Eliminar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {prodeMatches.filter(m => m.isFinished).length === 0 && (
                                    <p className="text-center text-xs font-bold text-neutral-400 py-8">Aún no hay resultados publicados.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── RANKING ────────────────────────── */}
                {prodeSection === 'ranking' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-tight">Ranking General</h3>
                                <p className="text-[10px] font-medium text-neutral-500 max-w-md mt-1">
                                    Vista administrativa del ranking de todos los participantes. Permite realizar ajustes manuales de puntos o eliminar participantes en caso de error.
                                </p>
                            </div>
                            <button
                                onClick={() => handleRecalculate()}
                                disabled={recalculating}
                                className="hidden md:flex items-center gap-2 px-4 py-2 border-2 border-black text-xs font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all disabled:opacity-50"
                            >
                                {recalculating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Recalcular todo'}
                            </button>
                        </div>

                        <div className="space-y-3 mt-6">
                            {prodeRanking.map((p, idx) => {
                                const pos = idx + 1;
                                const isFirst = pos === 1;
                                const isTop3 = pos <= 3;
                                const MEDAL_COLORS = ['#F59E0B', '#94A3B8', '#D97706'];

                                return (
                                    <div
                                        key={p.id}
                                        className={`flex flex-col md:flex-row md:items-center gap-4 px-6 py-5 rounded-[2rem] transition-all duration-300 ${
                                            isFirst
                                                ? 'bg-gradient-to-r from-amber-50/50 to-orange-50/50 shadow-[0_4px_20px_-4px_rgba(245,158,11,0.1)] border border-amber-100/50'
                                                : 'bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_25px_-4px_rgba(0,0,0,0.04)] border border-white'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4 flex-1">
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
                                                    isFirst ? 'bg-amber-100 text-amber-700' : 'bg-slate-50 text-slate-400'
                                                }`}>
                                                    {p.firstName.charAt(0)}
                                                </div>
                                                <p className={`font-bold text-base truncate ${isFirst ? 'text-amber-900' : 'text-slate-600'}`}>
                                                    {p.firstName} {p.lastName}
                                                </p>
                                            </div>

                                            <div className="flex items-baseline gap-1.5 shrink-0">
                                                <span className={`text-2xl font-black tabular-nums tracking-tight ${isFirst ? 'text-amber-500' : 'text-slate-600'}`}>
                                                    {p.totalPoints}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">pts</span>
                                            </div>
                                        </div>

                                        {/* Controles de ajuste: − / delta / + → Ajustar → Borrar */}
                                        <div className="flex items-center gap-2 pt-4 border-t border-slate-100 md:border-none md:pt-0 shrink-0">
                                            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 overflow-hidden h-10">
                                                <button
                                                    onClick={() => setAdjustments(prev => ({
                                                        ...prev,
                                                        [p.id]: String((parseInt(prev[p.id] || '0') || 0) - 1)
                                                    }))}
                                                    disabled={applyingAdjustment === p.id}
                                                    className="w-9 h-full flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800 font-black text-base transition-all disabled:opacity-40 border-r border-slate-200"
                                                >
                                                    −
                                                </button>
                                                <span className={`w-10 text-center font-black text-sm tabular-nums select-none ${
                                                    parseInt(adjustments[p.id] || '0') > 0 ? 'text-emerald-600' :
                                                    parseInt(adjustments[p.id] || '0') < 0 ? 'text-rose-500' : 'text-slate-400'
                                                }`}>
                                                    {parseInt(adjustments[p.id] || '0') > 0 ? `+${adjustments[p.id]}` : (adjustments[p.id] || '0')}
                                                </span>
                                                <button
                                                    onClick={() => setAdjustments(prev => ({
                                                        ...prev,
                                                        [p.id]: String((parseInt(prev[p.id] || '0') || 0) + 1)
                                                    }))}
                                                    disabled={applyingAdjustment === p.id}
                                                    className="w-9 h-full flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800 font-black text-base transition-all disabled:opacity-40 border-l border-slate-200"
                                                >
                                                    +
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => handleApplyAdjustment(p.id)}
                                                disabled={applyingAdjustment === p.id || !adjustments[p.id] || isNaN(parseInt(adjustments[p.id])) || parseInt(adjustments[p.id]) === 0}
                                                className="h-10 px-4 rounded-xl bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 shadow-sm transition-all disabled:opacity-50 flex justify-center items-center min-w-[72px]"
                                            >
                                                {applyingAdjustment === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Ajustar'}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteParticipant(p.id)}
                                                className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-100 transition-colors shrink-0"
                                                title="Eliminar Participante"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                            {prodeRanking.length === 0 && !rankingLoading && (
                                <div className="py-20 text-center bg-white rounded-[3rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
                                    <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">
                                        No hay participantes en el ranking
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* PREDICCIONES */}
                {prodeSection === 'predictions' && (
                    <div className="space-y-6">

                        {/* Header */}
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-base font-black uppercase tracking-tight leading-none">
                                    Predicciones
                                </h3>
                                <p className="text-[11px] font-semibold text-neutral-400 mt-1.5 tracking-wide">
                                    {predsLoading ? '...' : (
                                        <>
                                            <span className="font-black text-black">{allPredictions.length}</span>
                                            {' '}prediccion{allPredictions.length !== 1 ? 'es' : ''} registradas
                                        </>
                                    )}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowNewPredForm(s => !s);
                                    setNewPredSelectedParticipant(null);
                                    setNewPredParticipantSearch('');
                                    setNewPredMatchId('');
                                    setNewPredHome(0);
                                    setNewPredAway(0);
                                }}
                                className={`shrink-0 flex items-center gap-2 px-4 py-2.5 border-2 text-xs font-black uppercase tracking-widest transition-all ${
                                    showNewPredForm
                                        ? 'bg-white text-black border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                                        : 'bg-black text-white border-black hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                                }`}
                            >
                                <Plus className={`w-4 h-4 transition-transform duration-200 ${showNewPredForm ? 'rotate-45' : ''}`} />
                                <span className="hidden sm:inline">{showNewPredForm ? 'Cerrar' : 'Nueva prediccion'}</span>
                                <span className="sm:hidden">{showNewPredForm ? 'Cerrar' : 'Nueva'}</span>
                            </button>
                        </div>

                        {/* Formulario nueva prediccion */}
                        {showNewPredForm && (
                            <div className="border-2 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                <div className="bg-black px-5 py-3 flex items-center justify-between">
                                    <p className="text-white text-[10px] font-black uppercase tracking-[0.2em]">
                                        Nueva prediccion manual
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPredForm(false)}
                                        className="text-neutral-400 hover:text-white transition-colors"
                                        aria-label="Cerrar formulario"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="p-5 space-y-5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                        {/* Buscar participante */}
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black uppercase tracking-[0.18em] text-neutral-400 block">
                                                Participante
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder="Buscar por nombre..."
                                                    value={newPredParticipantSearch}
                                                    onChange={e => handleSearchParticipants(e.target.value)}
                                                    className="w-full h-11 pl-10 pr-4 border-2 border-neutral-300 font-bold text-sm focus:outline-none focus:border-black transition-colors"
                                                />
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                                            </div>

                                            {newPredParticipants.length > 0 && !newPredSelectedParticipant && (
                                                <div className="border-2 border-black border-t-0 bg-white max-h-44 overflow-y-auto shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                                    {newPredParticipants.map(p => (
                                                        <button
                                                            key={p.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setNewPredSelectedParticipant(p);
                                                                setNewPredParticipantSearch(`${p.firstName} ${p.lastName}`);
                                                                setNewPredParticipants([]);
                                                            }}
                                                            className="w-full text-left px-4 py-3 hover:bg-neutral-50 flex items-center gap-3 border-b border-neutral-100 last:border-0 transition-colors"
                                                        >
                                                            <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-black text-neutral-600 shrink-0 select-none">
                                                                {p.firstName.charAt(0)}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="font-bold text-sm truncate">{p.firstName} {p.lastName}</p>
                                                                <p className="text-[10px] text-neutral-400 font-medium">{p.totalPoints} pts</p>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {newPredSelectedParticipant && (
                                                <div className="flex items-center gap-2.5 px-3 py-2 bg-neutral-900 text-white">
                                                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-black shrink-0 select-none">
                                                        {newPredSelectedParticipant.firstName.charAt(0)}
                                                    </div>
                                                    <span className="text-xs font-bold truncate flex-1">
                                                        {newPredSelectedParticipant.firstName} {newPredSelectedParticipant.lastName}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setNewPredSelectedParticipant(null);
                                                            setNewPredParticipantSearch('');
                                                        }}
                                                        className="text-neutral-400 hover:text-white transition-colors shrink-0"
                                                        aria-label="Quitar seleccion"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Elegir partido */}
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black uppercase tracking-[0.18em] text-neutral-400 block">
                                                Partido
                                            </label>
                                            <select
                                                value={newPredMatchId}
                                                onChange={e => setNewPredMatchId(e.target.value)}
                                                className="w-full h-11 px-3 border-2 border-neutral-300 font-bold text-sm bg-white focus:outline-none focus:border-black transition-colors cursor-pointer"
                                            >
                                                <option value="">-- Elegir partido --</option>
                                                {prodeMatches.map(m => (
                                                    <option key={m.id} value={m.id}>
                                                        #{m.matchNumber} - {m.homeTeam} vs {m.awayTeam}
                                                        {m.isFinished ? ' (finalizado)' : m.isOpen ? ' (abierto)' : ' (cerrado)'}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Marcador */}
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-[0.18em] text-neutral-400 block">
                                            Prediccion del marcador
                                        </label>
                                        <div className="inline-flex items-center gap-3 bg-neutral-50 border-2 border-neutral-200 px-5 py-3">
                                            <input
                                                type="number" min={0} max={30}
                                                value={newPredHome}
                                                onChange={e => setNewPredHome(parseInt(e.target.value) || 0)}
                                                className="w-14 h-12 text-center border-2 border-black font-black text-2xl focus:outline-none bg-white"
                                            />
                                            <span className="text-2xl font-black text-neutral-300 select-none">-</span>
                                            <input
                                                type="number" min={0} max={30}
                                                value={newPredAway}
                                                onChange={e => setNewPredAway(parseInt(e.target.value) || 0)}
                                                className="w-14 h-12 text-center border-2 border-black font-black text-2xl focus:outline-none bg-white"
                                            />
                                        </div>
                                    </div>

                                    {/* Botones */}
                                    <div className="flex gap-3 pt-1 border-t border-neutral-100">
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPredForm(false)}
                                            className="px-5 py-2.5 border-2 border-neutral-300 text-xs font-black uppercase tracking-widest text-neutral-500 hover:border-black hover:text-black transition-all"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSaveNewPred}
                                            disabled={!newPredSelectedParticipant || !newPredMatchId || savingNewPred}
                                            className="flex-1 py-2.5 bg-black text-white border-2 border-black text-xs font-black uppercase tracking-widest hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                                        >
                                            {savingNewPred ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <>
                                                    <Check className="w-4 h-4" />
                                                    Guardar prediccion
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Buscador */}
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Buscar por participante, equipo..."
                                value={predSearchTerm}
                                onChange={e => setPredSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-10 h-11 border-2 border-neutral-300 font-semibold text-sm focus:outline-none focus:border-black transition-colors placeholder:text-neutral-400"
                            />
                            {predSearchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setPredSearchTerm('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black transition-colors"
                                    aria-label="Limpiar busqueda"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Lista */}
                        {predsLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-neutral-300" />
                                <p className="text-[11px] font-black uppercase tracking-widest text-neutral-400">
                                    Cargando predicciones...
                                </p>
                            </div>
                        ) : (() => {
                            const filtered = allPredictions.filter(p => {
                                if (!predSearchTerm.trim()) return true;
                                const term = predSearchTerm.toLowerCase();
                                return (
                                    p.participantName.toLowerCase().includes(term) ||
                                    p.homeTeam.toLowerCase().includes(term) ||
                                    p.awayTeam.toLowerCase().includes(term)
                                );
                            });

                            if (filtered.length === 0) {
                                return (
                                    <div className="py-20 border-2 border-dashed border-neutral-200 flex flex-col items-center gap-2">
                                        <Search className="w-8 h-8 text-neutral-200" />
                                        <p className="text-xs font-black text-neutral-400 uppercase tracking-widest">
                                            {predSearchTerm ? 'Sin resultados para esa busqueda' : 'No hay predicciones cargadas'}
                                        </p>
                                        {predSearchTerm && (
                                            <button
                                                type="button"
                                                onClick={() => setPredSearchTerm('')}
                                                className="mt-1 text-[10px] font-black uppercase tracking-widest underline text-neutral-400 hover:text-black transition-colors"
                                            >
                                                Limpiar busqueda
                                            </button>
                                        )}
                                    </div>
                                );
                            }

                            return (
                                <div className="space-y-2">
                                    {filtered.map(pred => {
                                        const isEditing = editingPredId === pred.predictionId;
                                        const isDeleting = deletingPredId === pred.predictionId;
                                        const initial = pred.participantName.charAt(0).toUpperCase();

                                        return (
                                            <div
                                                key={pred.predictionId}
                                                className={`bg-white border-2 transition-all duration-200 ${
                                                    isEditing
                                                        ? 'border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                                                        : 'border-neutral-200 hover:border-neutral-400'
                                                }`}
                                            >
                                                {/* Fila principal */}
                                                <div className="flex items-center gap-3 px-4 py-3">

                                                    {/* Avatar */}
                                                    <div className="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center text-[13px] font-black text-neutral-600 shrink-0 select-none">
                                                        {initial}
                                                    </div>

                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-black text-sm leading-tight truncate">
                                                            {pred.participantName}
                                                        </p>
                                                        <p className="text-[10px] font-semibold text-neutral-400 mt-0.5 truncate">
                                                            #{pred.matchNumber} · {pred.homeTeam} vs {pred.awayTeam}
                                                        </p>
                                                    </div>

                                                    {/* Vista normal */}
                                                    {!isEditing && (
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <div className="flex items-center gap-1 bg-neutral-50 border border-neutral-200 px-2.5 py-1.5">
                                                                <span className="font-black text-sm tabular-nums text-black leading-none">{pred.homeScorePred}</span>
                                                                <span className="text-neutral-300 font-bold text-xs leading-none mx-0.5">-</span>
                                                                <span className="font-black text-sm tabular-nums text-black leading-none">{pred.awayScorePred}</span>
                                                            </div>

                                                            {pred.pointsEarned !== null ? (
                                                                <span className={`hidden sm:inline-flex text-[9px] font-black uppercase tracking-wider px-2 py-1.5 leading-none ${
                                                                    pred.pointsEarned > 0
                                                                        ? 'bg-emerald-600 text-white'
                                                                        : 'bg-neutral-100 text-neutral-500'
                                                                }`}>
                                                                    {pred.pointsEarned > 0 ? `+${pred.pointsEarned}pts` : '0pts'}
                                                                </span>
                                                            ) : (
                                                                <span className="hidden sm:inline-flex text-[9px] font-black uppercase tracking-wider px-2 py-1.5 leading-none bg-amber-50 text-amber-500 border border-amber-200">
                                                                    Pendiente
                                                                </span>
                                                            )}

                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setEditingPredId(pred.predictionId);
                                                                    setEditPredHome(pred.homeScorePred);
                                                                    setEditPredAway(pred.awayScorePred);
                                                                }}
                                                                className="w-9 h-9 flex items-center justify-center border border-neutral-200 text-neutral-400 hover:border-black hover:bg-black hover:text-white transition-all shrink-0"
                                                                title="Editar prediccion"
                                                                aria-label="Editar prediccion"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeletePred(pred.predictionId)}
                                                                disabled={isDeleting}
                                                                className="w-9 h-9 flex items-center justify-center border border-neutral-200 text-red-400 hover:border-red-500 hover:bg-red-500 hover:text-white transition-all shrink-0 disabled:opacity-40"
                                                                title="Eliminar prediccion"
                                                                aria-label="Eliminar prediccion"
                                                            >
                                                                {isDeleting
                                                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    : <Trash2 className="w-3.5 h-3.5" />
                                                                }
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Modo edicion: botones en fila */}
                                                    {isEditing && (
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingPredId(null)}
                                                                className="h-9 px-3 border-2 border-neutral-200 text-xs font-black uppercase text-neutral-500 hover:border-black hover:text-black transition-all"
                                                                aria-label="Cancelar edicion"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSaveEditPred(pred.predictionId, pred.participantId, pred.matchId)}
                                                                disabled={savingEditPred}
                                                                className="h-9 px-3 bg-black text-white border-2 border-black text-xs font-black uppercase hover:bg-white hover:text-black transition-all disabled:opacity-40 flex items-center gap-1"
                                                                aria-label="Guardar edicion"
                                                            >
                                                                {savingEditPred
                                                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    : <Check className="w-3.5 h-3.5" />
                                                                }
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Panel edicion inline */}
                                                {isEditing && (
                                                    <div className="border-t-2 border-black bg-neutral-50 px-4 py-4">
                                                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">
                                                            Nuevo marcador
                                                        </p>
                                                        <div className="flex items-center gap-3">
                                                            <input
                                                                type="number" min={0} max={30}
                                                                value={editPredHome}
                                                                onChange={e => setEditPredHome(parseInt(e.target.value) || 0)}
                                                                className="w-16 h-12 text-center border-2 border-black font-black text-2xl focus:outline-none bg-white"
                                                                autoFocus
                                                                aria-label="Goles local"
                                                            />
                                                            <span className="text-xl font-black text-neutral-300 select-none">-</span>
                                                            <input
                                                                type="number" min={0} max={30}
                                                                value={editPredAway}
                                                                onChange={e => setEditPredAway(parseInt(e.target.value) || 0)}
                                                                className="w-16 h-12 text-center border-2 border-black font-black text-2xl focus:outline-none bg-white"
                                                                aria-label="Goles visitante"
                                                            />
                                                            <p className="ml-2 text-[10px] text-neutral-400 font-semibold leading-snug hidden sm:block">
                                                                Tocá el check<br />para guardar
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Badge puntos en mobile */}
                                                {!isEditing && (
                                                    <div className="sm:hidden px-4 pb-3 -mt-1">
                                                        {pred.pointsEarned !== null ? (
                                                            <span className={`inline-flex text-[9px] font-black uppercase tracking-wider px-2 py-1 leading-none ${
                                                                pred.pointsEarned > 0
                                                                    ? 'bg-emerald-600 text-white'
                                                                    : 'bg-neutral-100 text-neutral-500'
                                                            }`}>
                                                                {pred.pointsEarned > 0 ? `+${pred.pointsEarned} pts` : '0 pts'}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex text-[9px] font-black uppercase tracking-wider px-2 py-1 leading-none bg-amber-50 text-amber-500 border border-amber-200">
                                                                Pendiente
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
};

const AdminProde: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    if (user && !hasRole(user, [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.PRODE])) {
        navigate('/');
        return null;
    }

    return <AdminProdeContent />;
};

export default AdminProde;
