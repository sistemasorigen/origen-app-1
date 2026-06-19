import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { supabaseService } from '../../services/supabaseService';
import { supabase } from '../../services/supabaseClient';
import {
    TriviaJuego, TriviaPreguntas, TriviaJugador,
    TriviaEstadoJuego, TRIVIA_COLORES, TRIVIA_ICONOS
} from '../../types';
import { Users, Loader2 } from 'lucide-react';
import { LeaderboardPodium } from '../../components/ui/leaderboard-podium';
import { LeaderboardRankings } from '../../components/ui/leaderboard-rankings';

type PantallaProyector =
    | 'cargando'
    | 'esperando'
    | 'cuenta_regresiva'
    | 'doble'
    | 'pregunta'
    | 'entre_preguntas'
    | 'finalizando'
    | 'finalizado';


const TriviaProyector: React.FC = () => {
    const { pin }  = useParams<{ pin: string }>();
    const navigate = useNavigate();

    const [juego, setJuego]                         = useState<TriviaJuego | null>(null);
    const [pantalla, setPantalla]                   = useState<PantallaProyector>('cargando');
    const [preguntaActual, setPreguntaActual]       = useState<TriviaPreguntas | null>(null);
    const [jugadores, setJugadores]                 = useState<TriviaJugador[]>([]);
    const [ranking, setRanking]                     = useState<TriviaJugador[]>([]);
    const [cuentaRegresiva, setCuentaRegresiva]     = useState(3);
    const [respuestasCount, setRespuestasCount]     = useState(0);
    const [, setRevelarRespuestas] = useState(false);
    const [tiempoRestante, setTiempoRestante]       = useState(0);
    const [tiempoTotal, setTiempoTotal]             = useState(0);

    const juegoRef          = useRef<TriviaJuego | null>(null);
    const iniciadoRef       = useRef(false);
    const cuentaIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
    const entreTimeoutRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
    const autoRevelarCtxRef = useRef<{ juegoId: string; pregId: string } | null>(null);
    const contadorRef       = useRef<number>(0);

    const urlUnirse = `${window.location.origin}/#/trivia`;

    // ── Auto-reveal cuando se acaba el timer ─────
    const autoRevelar = async (juegoId: string, pregId: string) => {
        const j = juegoRef.current;
        if (!j || j.estado !== 'en_curso' || j.timerPausado) return;
        await supabaseService.setTriviaPreguntaEstado(juegoId, pregId, 'revelada');
        await supabaseService.avanzarTriviaJuego(juegoId, 'revelar');
    };

    // ── Timer ────────────────────────────────────
    const crearIntervalTimer = (fromCount: number) => {
        let count = fromCount;
        timerRef.current = setInterval(() => {
            count--;
            contadorRef.current = count;
            if (count <= 0) {
                clearInterval(timerRef.current!);
                timerRef.current = null;
                setTiempoRestante(0);
                const ctx = autoRevelarCtxRef.current;
                if (ctx) autoRevelar(ctx.juegoId, ctx.pregId);
            } else {
                setTiempoRestante(count);
            }
        }, 1000);
    };

    const iniciarTimer = (segundos: number, juegoId: string, pregId: string) => {
        if (timerRef.current) clearInterval(timerRef.current);
        autoRevelarCtxRef.current = { juegoId, pregId };
        contadorRef.current = segundos;
        setTiempoTotal(segundos);
        setTiempoRestante(segundos);
        crearIntervalTimer(segundos);
    };

    // ── Mostrar pregunta ──────────────────────────
    const mostrarPregunta = (
        juegoData: TriviaJuego,
        idx: number,
        conDoble: boolean = false
    ) => {
        const pregs = juegoData.preguntas || [];
        if (idx < 0 || idx >= pregs.length) return;
        const p = pregs[idx];
        setPreguntaActual(p);
        setRespuestasCount(0);
        setRevelarRespuestas(false);

        if (conDoble && p.esDoble) {
            setPantalla('doble');
            setTimeout(() => {
                setPantalla('pregunta');
                iniciarTimer(p.tiempoLimite, juegoData.id, p.id);
            }, 2500);
        } else {
            setPantalla('pregunta');
            iniciarTimer(p.tiempoLimite, juegoData.id, p.id);
        }
    };

    // ── Cuenta regresiva sincronizada con started_at ─
    const iniciarCuentaRegresivaSync = (startedAtIso: string | null, juegoData: TriviaJuego) => {
        const DURACION_MS = 3000;
        const elapsed = startedAtIso
            ? Math.max(0, Date.now() - new Date(startedAtIso).getTime())
            : 0;

        if (elapsed >= DURACION_MS) {
            mostrarPregunta(juegoData, juegoData.preguntaActualIdx, true);
            return;
        }

        const remainingMs   = DURACION_MS - elapsed;
        const currentCount  = Math.ceil(remainingMs / 1000); // 3, 2 o 1
        const msUntilNext   = remainingMs - (currentCount - 1) * 1000;

        setPantalla('cuenta_regresiva');
        setCuentaRegresiva(currentCount);
        if (cuentaIntervalRef.current) clearTimeout(cuentaIntervalRef.current as any);

        let count = currentCount;
        const tick = () => {
            count--;
            if (count <= 0) {
                mostrarPregunta(juegoData, juegoData.preguntaActualIdx, true);
            } else {
                setCuentaRegresiva(count);
                cuentaIntervalRef.current = setTimeout(tick, 1000) as any;
            }
        };
        cuentaIntervalRef.current = setTimeout(tick, msUntilNext) as any;
    };

    // ── Auto-avance desde entre_preguntas (5 s) ──
    useEffect(() => {
        if (pantalla !== 'entre_preguntas') return;
        entreTimeoutRef.current = setTimeout(async () => {
            const j = juegoRef.current;
            if (!j || j.estado !== 'entre_preguntas') return;
            const pregs   = j.preguntas || [];
            const nextIdx = j.preguntaActualIdx + 1;
            await supabaseService.avanzarTriviaJuego(j.id, 'siguiente', pregs.length);
            if (nextIdx < pregs.length && pregs[nextIdx]) {
                await supabaseService.setTriviaPreguntaEstado(j.id, pregs[nextIdx].id, 'abierta');
            }
        }, 5000);
        return () => {
            if (entreTimeoutRef.current) clearTimeout(entreTimeoutRef.current);
        };
    }, [pantalla]);

    // ── Inicialización ────────────────────────────
    useEffect(() => {
        if (!pin) return;
        if (iniciadoRef.current) return;
        iniciadoRef.current = true;

        const init = async () => {
            const base = await supabaseService.getTriviaJuegoPorPin(pin);
            if (!base) { navigate('/trivia'); return; }

            const completo = await supabaseService.getTriviaJuego(base.id);
            if (!completo) { navigate('/trivia'); return; }

            setJuego(completo);
            juegoRef.current = completo;

            const jug = await supabaseService.getTriviaRanking(base.id, 200);
            setJugadores(jug);

            const estado = completo.estado;
            const idx    = completo.preguntaActualIdx;

            if (estado === 'esperando') {
                setPantalla('esperando');

            } else if (estado === 'en_curso') {
                mostrarPregunta(completo, idx, false);

            } else if (estado === 'entre_preguntas') {
                const pregs = completo.preguntas || [];
                if (pregs[idx]) {
                    setPreguntaActual(pregs[idx]);
                    setRevelarRespuestas(true);
                    const rank = await supabaseService.getTriviaRanking(base.id, 5);
                    setRanking(rank);
                    setPantalla('entre_preguntas');
                }

            } else if (estado === 'finalizando') {
                const rank = await supabaseService.getTriviaRanking(base.id, 10);
                setRanking(rank);
                setPantalla('finalizando');

            } else if (estado === 'finalizado') {
                setPantalla('finalizado');
            }
        };

        init();

        return () => {
            if (cuentaIntervalRef.current) clearTimeout(cuentaIntervalRef.current as any);
            if (timerRef.current)          clearInterval(timerRef.current);
            if (entreTimeoutRef.current)   clearTimeout(entreTimeoutRef.current);
        };
    }, [pin]);

    // ── Realtime ──────────────────────────────────
    useEffect(() => {
        if (!juego) return;

        const channel = supabase
            .channel(`proyector-${juego.id}`)
            .on(
                'postgres_changes',
                {
                    event:  'UPDATE',
                    schema: 'public',
                    table:  'trivia_juegos',
                    filter: `id=eq.${juego.id}`
                },
                async payload => {
                    const nuevo        = payload.new as any;
                    const estado       = nuevo.estado as TriviaEstadoJuego;
                    const idx          = nuevo.pregunta_actual_idx as number;
                    const timerPausado = (nuevo.timer_pausado as boolean) ?? false;
                    const startedAt    = (nuevo.started_at as string | null) ?? null;

                    const prev = juegoRef.current;
                    if (!prev) return;

                    const updated = { ...prev, estado, preguntaActualIdx: idx, timerPausado, startedAt: startedAt ?? prev.startedAt };
                    setJuego(updated);
                    juegoRef.current = updated;

                    if (estado === 'en_curso') {
                        const esNuevaPregunta = idx !== prev.preguntaActualIdx;
                        const prevPausado     = prev.timerPausado ?? false;

                        // Pause / resume sin cambio de pregunta
                        if (!esNuevaPregunta && timerPausado !== prevPausado) {
                            if (timerPausado) {
                                if (timerRef.current) {
                                    clearInterval(timerRef.current);
                                    timerRef.current = null;
                                }
                            } else {
                                const remaining = contadorRef.current;
                                if (remaining > 0) crearIntervalTimer(remaining);
                            }
                            return;
                        }

                        if (prev.estado === 'esperando') {
                            iniciarCuentaRegresivaSync(startedAt, updated);
                        } else if (esNuevaPregunta) {
                            mostrarPregunta(updated, idx, true);
                        }

                    } else if (estado === 'entre_preguntas') {
                        if (timerRef.current) clearInterval(timerRef.current);
                        const pregs = prev.preguntas || [];
                        if (pregs[idx]) {
                            setPreguntaActual(pregs[idx]);
                            setRevelarRespuestas(true);
                        }
                        const rank = await supabaseService.getTriviaRanking(prev.id, 5);
                        setRanking(rank);
                        setPantalla('entre_preguntas');

                    } else if (estado === 'finalizando') {
                        const rank = await supabaseService.getTriviaRanking(prev.id, 10);
                        setRanking(rank);
                        setPantalla('finalizando');

                    } else if (estado === 'finalizado') {
                        setPantalla('finalizado');
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event:  'INSERT',
                    schema: 'public',
                    table:  'trivia_jugadores',
                    filter: `juego_id=eq.${juego.id}`
                },
                async () => {
                    const jug = await supabaseService.getTriviaRanking(juego.id, 200);
                    setJugadores(jug);
                }
            )
            .on(
                'postgres_changes',
                {
                    event:  '*',
                    schema: 'public',
                    table:  'trivia_estado_pregunta',
                    filter: `juego_id=eq.${juego.id}`
                },
                payload => {
                    const row = payload.new as any;
                    if (row?.total_respuestas !== undefined) {
                        setRespuestasCount(row.total_respuestas);
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [juego?.id]);

    // ── JSX ───────────────────────────────────────
    return (
        <div
            className="min-h-screen overflow-hidden relative"
            style={{ background: '#1A0A2E' }}
        >
            {/* Timer bar — arriba del todo, visible solo durante pregunta */}
            <div className="absolute top-0 left-0 right-0 z-[60] h-2 bg-white/10">
                {pantalla === 'pregunta' && tiempoTotal > 0 && (
                    <div
                        className={`h-full rounded-r-sm ${juego?.timerPausado ? '' : 'transition-all duration-1000 ease-linear'}`}
                        style={{
                            width: `${(tiempoRestante / tiempoTotal) * 100}%`,
                            background: juego?.timerPausado
                                ? '#F59E0B'
                                : tiempoRestante / tiempoTotal > 0.5
                                    ? '#22C55E'
                                    : tiempoRestante / tiempoTotal > 0.25
                                        ? '#F59E0B'
                                        : '#EF4444',
                            opacity: juego?.timerPausado ? 0.6 : 1,
                        }}
                    />
                )}
            </div>

            {/* Logo — se mueve al centro al iniciar el juego */}
            <motion.div
                className="absolute top-6 z-50"
                animate={
                    pantalla === 'esperando' || pantalla === 'cargando'
                        ? { left: '2rem', x: '0%' }
                        : { left: '50%',  x: '-50%' }
                }
                transition={{ duration: 0.6, ease: 'easeInOut' }}
            >
                <img
                    src="/origen-logo.png"
                    alt="Origen"
                    className="h-14 opacity-90"
                    style={{ filter: 'brightness(0) invert(1)' }}
                />
            </motion.div>

            <AnimatePresence mode="wait">

                {/* ── CARGANDO ──────────────────── */}
                {pantalla === 'cargando' && (
                    <motion.div
                        key="cargando"
                        className="min-h-screen flex items-center justify-center"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    >
                        <Loader2 className="w-10 h-10 animate-spin text-white/30" />
                    </motion.div>
                )}

                {/* ── ESPERANDO ─────────────────── */}
                {pantalla === 'esperando' && (
                    <motion.div
                        key="esperando"
                        className="min-h-screen flex flex-col items-center justify-center px-8 gap-10"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    >
                        {/* Título */}
                        <div className="text-center">
                            <p className="text-white/40 text-sm font-semibold uppercase tracking-[0.4em] mb-3">
                                Origen · Kahoot
                            </p>
                            <h1 className="text-6xl md:text-8xl font-black text-white tracking-tight mb-4">
                                {juego?.titulo || 'Kahoot Origen'}
                            </h1>
                        </div>

                        {/* Instrucción de acceso */}
                        <p className="text-white/60 text-xl md:text-2xl font-medium text-center">
                            Ingresá a{' '}
                            <span className="text-white font-bold">
                                {window.location.host}/#/trivia
                            </span>
                            {' '}e ingresá el PIN:
                        </p>

                        {/* PIN + QR */}
                        <div className="flex flex-col md:flex-row items-center gap-10">
                            {/* PIN */}
                            <div className="text-center">
                                <p className="text-white/40 text-sm font-semibold uppercase tracking-[0.3em] mb-3">
                                    PIN del juego
                                </p>
                                <div className="flex gap-3">
                                    {(pin || '').split('').map((d, i) => (
                                        <div
                                            key={i}
                                            className="w-16 h-20 rounded-2xl flex items-center justify-center text-4xl font-black text-white"
                                            style={{ background: 'rgba(255,255,255,0.1)' }}
                                        >
                                            {d}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="text-white/20 text-2xl font-light hidden md:block">ó</div>

                            {/* QR */}
                            <div className="text-center">
                                <p className="text-white/40 text-sm font-semibold uppercase tracking-[0.3em] mb-3">
                                    Escaneá el QR
                                </p>
                                <div className="p-4 bg-white rounded-2xl inline-block">
                                    <QRCodeSVG
                                        value={urlUnirse}
                                        size={220}
                                        fgColor="#1A0A2E"
                                        bgColor="#FFFFFF"
                                        level="M"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Contador jugadores */}
                        <div
                            className="flex items-center gap-3 px-6 py-3 rounded-full"
                            style={{ background: 'rgba(255,255,255,0.08)' }}
                        >
                            <Users className="w-5 h-5 text-white/60" />
                            <span className="text-white font-bold text-lg tabular-nums">
                                {jugadores.length}
                            </span>
                            <span className="text-white/50 text-base">
                                {jugadores.length === 1 ? 'jugador listo' : 'jugadores listos'}
                            </span>
                        </div>

                        {/* Avatares */}
                        {jugadores.length > 0 && (
                            <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
                                {jugadores.map(j => (
                                    <motion.div
                                        key={j.id}
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-white/70"
                                        style={{ background: 'rgba(255,255,255,0.08)' }}
                                    >
                                        <span>{j.avatarEmoji}</span>
                                        <span>{j.nickname}</span>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}

                {/* ── CUENTA REGRESIVA ──────────── */}
                {pantalla === 'cuenta_regresiva' && (
                    <motion.div
                        key="cuenta"
                        className="min-h-screen flex items-center justify-center"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    >
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={cuentaRegresiva}
                                initial={{ scale: 0.3, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 2, opacity: 0 }}
                                transition={{ duration: 0.4, ease: 'easeOut' }}
                                className="text-[20rem] font-black text-white leading-none select-none"
                            >
                                {cuentaRegresiva}
                            </motion.div>
                        </AnimatePresence>
                    </motion.div>
                )}

                {/* ── DOBLE PUNTOS ──────────────── */}
                {pantalla === 'doble' && (
                    <motion.div
                        key="doble"
                        className="min-h-screen flex flex-col items-center justify-center gap-6"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    >
                        <motion.div
                            animate={{ scale: [1, 1.1, 1], rotate: [-2, 2, -2] }}
                            transition={{ duration: 0.6, repeat: Infinity }}
                            className="text-9xl"
                        >
                            ⚡
                        </motion.div>
                        <h2 className="text-7xl font-black text-center" style={{ color: '#FFD700' }}>
                            ¡DOBLE PUNTOS!
                        </h2>
                        <p className="text-white/60 text-2xl font-medium">
                            Esta pregunta vale el doble
                        </p>
                    </motion.div>
                )}

                {/* ── PREGUNTA ──────────────────── */}
                {pantalla === 'pregunta' && preguntaActual && (
                    <motion.div
                        key={`preg-${preguntaActual.id}`}
                        className="min-h-screen flex flex-col"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.02 }}
                        transition={{ duration: 0.35 }}
                    >
                        {/* Barra superior */}
                        <div className="flex items-center justify-between px-8 pt-8 pb-4">
                            <div className="flex items-center gap-3">
                                {preguntaActual.esDoble && (
                                    <span
                                        className="px-3 py-1 rounded-full text-sm font-black uppercase tracking-widest"
                                        style={{
                                            background: 'rgba(255,215,0,0.2)',
                                            color: '#FFD700',
                                            border: '1px solid rgba(255,215,0,0.4)'
                                        }}
                                    >
                                        ⚡ DOBLE
                                    </span>
                                )}
                                <span className="text-white/30 text-sm font-semibold uppercase tracking-widest">
                                    Pregunta {(juego?.preguntaActualIdx ?? 0) + 1} / {(juego?.preguntas || []).length}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-white/50 text-sm">
                                <Users className="w-4 h-4" />
                                <span className="font-bold text-white/70 tabular-nums">{respuestasCount}</span>
                                <span>respondieron</span>
                            </div>
                        </div>

                        {/* Imagen + texto — zona central unificada */}
                        <div className="flex-1 flex flex-col items-center justify-center px-10 gap-5">
                            {preguntaActual.imagenUrl && (
                                <img
                                    src={preguntaActual.imagenUrl}
                                    alt="pregunta"
                                    className="max-h-72 w-auto rounded-2xl object-contain"
                                />
                            )}
                            <h2 className={`font-black text-white text-center leading-tight max-w-4xl ${preguntaActual.imagenUrl ? 'text-4xl md:text-5xl' : 'text-5xl md:text-6xl'}`}>
                                {preguntaActual.texto}
                            </h2>
                        </div>

                        {/* Grid opciones */}
                        <div className={`grid gap-4 px-8 pb-8 ${(preguntaActual.opciones || []).length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                            {(preguntaActual.opciones || []).map(op => (
                                <div
                                    key={op.id}
                                    className="flex items-center gap-5 px-8 py-7 rounded-2xl"
                                    style={{ background: TRIVIA_COLORES[op.color] }}
                                >
                                    <span className="text-5xl shrink-0">{TRIVIA_ICONOS[op.color]}</span>
                                    <span className="text-white font-bold text-3xl leading-tight">{op.texto}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* ── ENTRE PREGUNTAS ───────────── */}
                {pantalla === 'entre_preguntas' && preguntaActual && (
                    <motion.div
                        key="entre"
                        className="min-h-screen flex flex-col px-6 pt-20 pb-6 gap-5"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    >
                        {/* Opciones reveladas */}
                        <div className={`grid gap-3 ${(preguntaActual.opciones || []).length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                            {(preguntaActual.opciones || []).map((op, i) => (
                                <motion.div
                                    key={op.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.08 }}
                                    className="flex items-center gap-4 px-5 py-4 rounded-2xl transition-all"
                                    style={{
                                        background: op.esCorrecta ? TRIVIA_COLORES[op.color] : 'rgba(255,255,255,0.06)',
                                        opacity:    op.esCorrecta ? 1 : 0.35,
                                    }}
                                >
                                    <span className="text-3xl shrink-0">
                                        {op.esCorrecta ? '✓' : TRIVIA_ICONOS[op.color]}
                                    </span>
                                    <span className="text-white font-bold text-lg">{op.texto}</span>
                                </motion.div>
                            ))}
                        </div>

                        {/* Ranking */}
                        {ranking.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="flex-1 flex flex-col gap-4 overflow-hidden"
                            >
                                <LeaderboardPodium
                                    theme="dark"
                                    size="sm"
                                    showAvatar
                                    valueLabel="pts"
                                    rankings={ranking.slice(0, 3).map((j, idx) => ({
                                        userId: j.id,
                                        userName: j.nickname,
                                        rank: idx + 1,
                                        value: j.puntajeTotal,
                                        avatarEmoji: j.avatarEmoji,
                                    }))}
                                />
                                <LeaderboardRankings
                                    theme="dark"
                                    rankings={ranking.slice(0, 5).map((j, idx) => ({
                                        userId: j.id,
                                        userName: j.nickname,
                                        rank: idx + 1,
                                        value: j.puntajeTotal,
                                        avatarEmoji: j.avatarEmoji,
                                        displayed: true,
                                    }))}
                                />
                            </motion.div>
                        )}
                    </motion.div>
                )}

                {/* ── FINALIZANDO (podio) ───────── */}
                {pantalla === 'finalizando' && (
                    <motion.div
                        key="finalizando"
                        className="min-h-screen flex flex-col items-center justify-center px-8 py-16 gap-6"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    >
                        <p className="text-white/40 text-sm font-semibold uppercase tracking-[0.4em]">
                            Resultados finales
                        </p>

                        {ranking.length > 0 && (
                            <>
                                <motion.div
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.15, type: 'spring', stiffness: 120 }}
                                >
                                    <LeaderboardPodium
                                        theme="dark"
                                        size="lg"
                                        showAvatar
                                        valueLabel="pts"
                                        rankings={ranking.slice(0, 3).map((j, idx) => ({
                                            userId: j.id,
                                            userName: j.nickname,
                                            rank: idx + 1,
                                            value: j.puntajeTotal,
                                            avatarEmoji: j.avatarEmoji,
                                        }))}
                                    />
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 }}
                                    className="w-full max-w-2xl"
                                >
                                    <LeaderboardRankings
                                        theme="dark"
                                        rankings={ranking.slice(0, 10).map((j, idx) => ({
                                            userId: j.id,
                                            userName: j.nickname,
                                            rank: idx + 1,
                                            value: j.puntajeTotal,
                                            avatarEmoji: j.avatarEmoji,
                                            displayed: true,
                                        }))}
                                    />
                                </motion.div>
                            </>
                        )}
                    </motion.div>
                )}

                {/* ── FINALIZADO ────────────────── */}
                {pantalla === 'finalizado' && (
                    <motion.div
                        key="finalizado"
                        className="min-h-screen flex flex-col items-center justify-center gap-4"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    >
                        <div className="text-8xl mb-2">🏆</div>
                        <h2 className="text-5xl font-black text-white text-center">
                            ¡Juego terminado!
                        </h2>
                        <p className="text-white/40 text-lg font-medium">
                            Gracias por jugar Kahoot Origen
                        </p>
                    </motion.div>
                )}

            </AnimatePresence>
        </div>
    );
};

export default TriviaProyector;
