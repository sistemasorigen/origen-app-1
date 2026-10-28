// supabase/functions/prode-sync-results/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const API_BASE     = 'https://worldcup26.ir';

const API_EMAIL    = Deno.env.get('WC2026_API_EMAIL')!;
const API_PASSWORD = Deno.env.get('WC2026_API_PASSWORD')!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Match por EQUIPOS (no por numero) porque worldcup26.ir y FIFA numeran distinto.
const ISO_BY_NAME: Record<string, string> = {
    'argentina': 'ar',
    'brasil': 'br', 'brazil': 'br',
    'colombia': 'co',
    'ecuador': 'ec',
    'paraguay': 'py',
    'uruguay': 'uy',
    'alemania': 'de', 'germany': 'de',
    'austria': 'at',
    'belgica': 'be', 'belgium': 'be',
    'bosnia y herzegovina': 'ba', 'bosnia and herzegovina': 'ba',
    'croacia': 'hr', 'croatia': 'hr',
    'escocia': 'gb-sct', 'scotland': 'gb-sct',
    'espana': 'es', 'spain': 'es',
    'francia': 'fr', 'france': 'fr',
    'inglaterra': 'gb-eng', 'england': 'gb-eng',
    'noruega': 'no', 'norway': 'no',
    'paises bajos': 'nl', 'netherlands': 'nl', 'holanda': 'nl',
    'portugal': 'pt',
    'republica checa': 'cz', 'chequia': 'cz', 'czech republic': 'cz', 'czechia': 'cz',
    'suecia': 'se', 'sweden': 'se',
    'suiza': 'ch', 'switzerland': 'ch',
    'turquia': 'tr', 'turkey': 'tr',
    'arabia saudita': 'sa', 'saudi arabia': 'sa',
    'australia': 'au',
    'corea del sur': 'kr', 'republica de corea': 'kr', 'south korea': 'kr', 'korea republic': 'kr',
    'irak': 'iq', 'iraq': 'iq',
    'iran': 'ir',
    'japon': 'jp', 'japan': 'jp',
    'jordania': 'jo', 'jordan': 'jo',
    'qatar': 'qa', 'catar': 'qa',
    'uzbekistan': 'uz',
    'argelia': 'dz', 'algeria': 'dz',
    'cabo verde': 'cv', 'cape verde': 'cv',
    'costa de marfil': 'ci', 'ivory coast': 'ci', "cote d'ivoire": 'ci',
    'egipto': 'eg', 'egypt': 'eg',
    'ghana': 'gh',
    'marruecos': 'ma', 'morocco': 'ma',
    'rd congo': 'cd', 'congo dr': 'cd', 'democratic republic of the congo': 'cd', 'dr congo': 'cd',
    'senegal': 'sn',
    'sudafrica': 'za', 'south africa': 'za',
    'tunez': 'tn', 'tunisia': 'tn',
    'canada': 'ca',
    'curazao': 'cw', 'curacao': 'cw',
    'estados unidos': 'us', 'united states': 'us', 'usa': 'us',
    'haiti': 'ht',
    'mexico': 'mx',
    'panama': 'pa',
    'nueva zelanda': 'nz', 'new zealand': 'nz',
};

const norm = (s: string): string =>
    (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const teamIso = (name: string, flag?: string): string | null => {
    if (flag && /^[a-z]{2}(-[a-z]{3})?$/.test(flag)) return flag;
    return ISO_BY_NAME[norm(name)] || null;
};

// fetch con reintentos: la API worldcup26.ir es intermitente (falla con
// "connection closed" o HTTP 500). Reintenta ante errores de red Y 5xx/429,
// para que un solo disparo del cron se recupere solo sin esperar 5 minutos.
const fetchWithRetry = async (
    url: string,
    init: RequestInit = {},
    attempts = 4,
    perAttemptMs = 15000
): Promise<Response> => {
    let lastErr: unknown;
    let lastRes: Response | undefined;
    for (let i = 1; i <= attempts; i++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), perAttemptMs);
        try {
            const res = await fetch(url, { ...init, signal: ctrl.signal });
            clearTimeout(timer);
            if (res.ok || (res.status < 500 && res.status !== 429)) return res;
            lastRes = res;
            console.warn(`[ProdeSync] fetch intento ${i}/${attempts} HTTP ${res.status} para ${url}`);
        } catch (err) {
            clearTimeout(timer);
            lastErr = err;
            console.warn(`[ProdeSync] fetch intento ${i}/${attempts} fallo para ${url}: ${err instanceof Error ? err.message : err}`);
        }
        if (i < attempts) await new Promise(r => setTimeout(r, 1000 * i));
    }
    if (lastRes) return lastRes;
    throw lastErr;
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    // Sólo la clave de servicio. La manda el cron prode-sync-results (jobid 6)
    // desde Vault, y la RPC prode_sincronizar() cuando alguien aprieta el
    // botón en AdminProde.
    //
    // Hasta el 2026-10-28 no pedía ninguna (verify_jwt false y ningún
    // chequeo): cualquiera, sin sesión, podía forzar la sincronización con
    // worldcup26.ir y el recálculo de puntos del Prode. El cron mandaba
    // current_setting('app.service_role_key', true), una variable que no
    // estaba seteada, así que el encabezado iba en NULL.
    const CLAVE = Deno.env.get('ORIGEN_SERVICE_ROLE_KEY');
    const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!CLAVE || bearer !== CLAVE) {
        console.warn('[prode-sync] llamada rechazada: sin la clave de servicio');
        return new Response(JSON.stringify({ error: 'No autorizado' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const startTime = Date.now();
    let matchesProcessed = 0;
    let matchesUpdated   = 0;
    let errorMsg: string | null = null;

    try {
        // 1. Login (con reintentos)
        const loginRes = await fetchWithRetry(`${API_BASE}/auth/authenticate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: API_EMAIL, password: API_PASSWORD })
        });
        if (!loginRes.ok) throw new Error(`API login failed: ${loginRes.status}`);

        const { token } = await loginRes.json();
        if (!token) throw new Error('No JWT token from API');

        // 2. Traer partidos (con reintentos)
        const gamesRes = await fetchWithRetry(`${API_BASE}/get/games`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!gamesRes.ok) throw new Error(`API games failed: ${gamesRes.status}`);

        const apiResponse: any = await gamesRes.json();
        const apiGames: any[] = Array.isArray(apiResponse)
            ? apiResponse
            : (apiResponse.games || []);

        if (!apiGames.length) {
            console.warn('[ProdeSync] No games returned from API');
        } else {
            console.log(`[ProdeSync] Received ${apiGames.length} games from API`);
        }

        const finishedGames = apiGames.filter((g: any) => {
            const isFinished =
                g.finished === 'TRUE' || g.finished === true || g.time_elapsed === 'finished';
            const hasScore =
                g.home_score !== null && g.home_score !== undefined &&
                g.away_score !== null && g.away_score !== undefined;
            const notStarted = g.time_elapsed === 'notstarted';
            return isFinished && hasScore && !notStarted;
        });

        matchesProcessed = finishedGames.length;
        console.log(`[ProdeSync] ${matchesProcessed} finished games to process`);

        const { data: openMatches, error: openErr } = await supabase
            .from('prode_matches')
            .select('id, home_team, away_team, home_flag, away_flag, match_date')
            .eq('is_finished', false);
        if (openErr) throw openErr;

        const matchByPair = new Map<string, any>();
        for (const m of (openMatches || [])) {
            const hIso = teamIso(m.home_team, m.home_flag);
            const aIso = teamIso(m.away_team, m.away_flag);
            if (hIso && aIso) matchByPair.set(`${hIso}|${aIso}`, m);
        }

        for (const game of finishedGames) {
            const hIso = teamIso(game.home_team_name_en);
            const aIso = teamIso(game.away_team_name_en);

            if (!hIso || !aIso) {
                console.warn(`[ProdeSync] No pude mapear equipos: "${game.home_team_name_en}" vs "${game.away_team_name_en}"`);
                continue;
            }

            const match = matchByPair.get(`${hIso}|${aIso}`);
            if (!match) continue;

            const KICKOFF_TO_FINISH_MS = 2 * 60 * 60 * 1000;
            if (match.match_date) {
                const kickoffMs = new Date(match.match_date).getTime();
                if (Date.now() < kickoffMs + KICKOFF_TO_FINISH_MS) {
                    console.log(`[ProdeSync] ${match.home_team} vs ${match.away_team} aun en juego (kickoff ${match.match_date}), skipping`);
                    continue;
                }
            }

            const homeScore = game.home_score !== null && game.home_score !== undefined
                ? parseInt(String(game.home_score), 10) : 0;
            const awayScore = game.away_score !== null && game.away_score !== undefined
                ? parseInt(String(game.away_score), 10) : 0;

            if (isNaN(homeScore) || isNaN(awayScore)) {
                console.warn(`[ProdeSync] Scores invalidos para ${match.home_team} vs ${match.away_team}, skipping`);
                continue;
            }

            const { data: cfg } = await supabase
                .from('app_config').select('config').eq('id', 'main').maybeSingle();

            const prodeConfig = cfg?.config?.prodeConfig || {};
            const ptsExact   = prodeConfig.pointsExactScore    ?? 6;
            const ptsResult  = prodeConfig.pointsCorrectResult ?? 3;
            const ptsPartial = prodeConfig.pointsPartialGoal   ?? 1;
            const ptsWrong   = prodeConfig.pointsWrong         ?? 0;

            const { error: updateMatchErr } = await supabase
                .from('prode_matches')
                .update({ home_score_real: homeScore, away_score_real: awayScore, is_finished: true, is_open: false })
                .eq('id', match.id);
            if (updateMatchErr) throw updateMatchErr;

            const { data: preds, error: predsErr } = await supabase
                .from('prode_predictions')
                .select('id, participant_id, home_score_pred, away_score_pred, points_earned')
                .eq('match_id', match.id);
            if (predsErr) throw predsErr;

            const participantDeltas: Record<string, number> = {};
            const updatePredPromises = [];

            for (const pred of (preds || [])) {
                const pH = pred.home_score_pred;
                const pA = pred.away_score_pred;
                const rH = homeScore;
                const rA = awayScore;

                const pW = pH > pA ? 'home' : pA > pH ? 'away' : 'draw';
                const rW = rH > rA ? 'home' : rA > rH ? 'away' : 'draw';

                let pts = ptsWrong;
                if (pH === rH && pA === rA)       pts = ptsExact;
                else if (pW === rW)                pts = ptsResult;
                else if (pH === rH || pA === rA)  pts = ptsPartial;

                const oldPts  = pred.points_earned ?? 0;
                const delta   = pts - oldPts;

                updatePredPromises.push(
                    supabase.from('prode_predictions')
                        .update({ points_earned: pts, updated_at: new Date().toISOString() })
                        .eq('id', pred.id)
                );

                if (delta !== 0) {
                    participantDeltas[pred.participant_id] = (participantDeltas[pred.participant_id] || 0) + delta;
                }
            }

            await Promise.all(updatePredPromises);

            const updatePartPromises = Object.entries(participantDeltas).map(async ([partId, delta]) => {
                const { data: participant } = await supabase
                    .from('prode_participants').select('total_points').eq('id', partId).maybeSingle();
                if (participant) {
                    await supabase.from('prode_participants')
                        .update({ total_points: Math.max(0, (participant.total_points || 0) + delta) })
                        .eq('id', partId);
                }
            });
            await Promise.all(updatePartPromises);

            matchesUpdated++;
            console.log(`[ProdeSync] ${match.home_team} vs ${match.away_team} -> ${homeScore}-${awayScore} (${(preds || []).length} predicciones)`);
        }

    } catch (err: unknown) {
        errorMsg = err instanceof Error ? err.message : String(err);
        console.error('[ProdeSync] Error:', errorMsg);
    }

    await supabase.from('prode_sync_log').insert({
        matches_processed: matchesProcessed,
        matches_updated:   matchesUpdated,
        errors:            errorMsg,
        duration_ms:       Date.now() - startTime
    });

    return new Response(
        JSON.stringify({
            success: !errorMsg,
            matchesProcessed,
            matchesUpdated,
            durationMs: Date.now() - startTime,
            error: errorMsg
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: errorMsg ? 500 : 200 }
    );
});