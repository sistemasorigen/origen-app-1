import React, {
    useState, useEffect, useRef, useCallback
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabaseService } from '../../services/supabaseService';
import { supabase } from '../../services/supabaseClient';
import {
    TriviaJuego, TriviaPreguntas, TriviaOpcion,
    TriviaJugador as TriviaJugadorType,
    TriviaEstadoJuego, TRIVIA_COLORES, TRIVIA_ICONOS
} from '../../types';
import { Loader2, Zap, Flame } from 'lucide-react';

type Pantalla =
    | 'cargando'
    | 'espera'
    | 'cuenta_regresiva'
    | 'doble'
    | 'pregunta'
    | 'respondida'
    | 'reaccion'
    | 'final';

interface ResultadoRespuesta {
    esCorrecta: boolean;
    puntosGanados: number;
    rachaActual: number;
    puntajeTotal: number;
    posicion?: number;
}

const TriviaJugador: React.FC = () => {
    const { pin }  = useParams<{ pin: string }>();
    const navigate = useNavigate();

    const [juego, setJuego]                         = useState<TriviaJuego | null>(null);
    const [jugador, setJugador]                     = useState<TriviaJugadorType | null>(null);
    const [pantalla, setPantalla]                   = useState<Pantalla>('cargando');
    const [preguntaActual, setPreguntaActual]       = useState<TriviaPreguntas | null>(null);
    const [opcionElegida, setOpcionElegida]         = useState<string | null>(null);
    const [tiempoInicioPregunta, setTiempoInicioPregunta] = useState<number>(0);
    const [resultadoRespuesta, setResultadoRespuesta]     = useState<ResultadoRespuesta | null>(null);
    const [totalRespondieron, setTotalRespondieron] = useState(0);
    const [jugadores, setJugadores]                 = useState<TriviaJugadorType[]>([]);
    const [tiempoRestante, setTiempoRestante]       = useState(0);
    const [tiempoTotal, setTiempoTotal]             = useState(0);
    const [mensajeBloqueado, setMensajeBloqueado]   = useState<string | null>(null);
    const [cuentaRegresiva, setCuentaRegresiva]     = useState(3);

    const inicializadoRef    = useRef(false);
    const juegoRef           = useRef<TriviaJuego | null>(null);
    const jugadorRef         = useRef<TriviaJugadorType | null>(null);
    const dobleTimeoutRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cuentaTimeoutRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
    const timerRef           = useRef<ReturnType<typeof setInterval> | null>(null);
    const tiempoRestanteRef  = useRef(0);
    const tiempoTotalRef     = useRef(0);

    const detenerTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    // ── Cargar pregunta por índice ────────────────────────
    const cargarPregunta = useCallback(async (
        juegoData: TriviaJuego,
        idx: number
    ) => {
        const preguntas = juegoData.preguntas || [];
        if (idx < 0 || idx >= preguntas.length) return;

        const p = preguntas[idx];
        setPreguntaActual(p);
        setOpcionElegida(null);
        setTotalRespondieron(0);

        const jug = jugadorRef.current;
        if (jug) {
            const resp = await supabaseService
                .getTriviaRespuestaJugador(jug.id, p.id);
            if (resp) {
                setOpcionElegida(resp.opcionId);
                setPantalla('respondida');
                return;
            }
        }

        const segundos = p.tiempoLimite;

        const startTimer = () => {
            if (timerRef.current) clearInterval(timerRef.current);
            setTiempoTotal(segundos);
            setTiempoRestante(segundos);
            tiempoTotalRef.current = segundos;
            tiempoRestanteRef.current = segundos;
            let count = segundos;
            timerRef.current = setInterval(() => {
                count--;
                tiempoRestanteRef.current = count;
                if (count <= 0) {
                    clearInterval(timerRef.current!);
                    timerRef.current = null;
                    setTiempoRestante(0);
                } else {
                    setTiempoRestante(count);
                }
            }, 1000);
        };

        if (p.esDoble) {
            setPantalla('doble');
            if (dobleTimeoutRef.current)
                clearTimeout(dobleTimeoutRef.current);
            dobleTimeoutRef.current = setTimeout(() => {
                setPantalla('pregunta');
                setTiempoInicioPregunta(Date.now());
                startTimer();
            }, 2500);
        } else {
            setPantalla('pregunta');
            setTiempoInicioPregunta(Date.now());
            startTimer();
        }
    }, []);

    // ── Cuenta regresiva sincronizada con started_at ──────
    const iniciarCuentaRegresivaSync = useCallback((
        startedAtIso: string | null,
        juegoData: TriviaJuego,
        idx: number
    ) => {
        const DURACION_MS = 3000;
        const elapsed = startedAtIso
            ? Math.max(0, Date.now() - new Date(startedAtIso).getTime())
            : 0;

        if (elapsed >= DURACION_MS) {
            cargarPregunta(juegoData, idx);
            return;
        }

        const remainingMs  = DURACION_MS - elapsed;
        const currentCount = Math.ceil(remainingMs / 1000);
        const msUntilNext  = remainingMs - (currentCount - 1) * 1000;

        setPantalla('cuenta_regresiva');
        setCuentaRegresiva(currentCount);
        if (cuentaTimeoutRef.current) clearTimeout(cuentaTimeoutRef.current);

        let count = currentCount;
        const tick = () => {
            count--;
            if (count <= 0) {
                cargarPregunta(juegoData, idx);
            } else {
                setCuentaRegresiva(count);
                cuentaTimeoutRef.current = setTimeout(tick, 1000);
            }
        };
        cuentaTimeoutRef.current = setTimeout(tick, msUntilNext);
    }, [cargarPregunta]);

    // ── Inicialización ────────────────────────────────────
    useEffect(() => {
        if (!pin) { navigate('/trivia'); return; }
        if (inicializadoRef.current) return;
        inicializadoRef.current = true;

        const jugadorId = sessionStorage.getItem(`trivia_jugador_${pin}`);
        if (!jugadorId) {
            navigate(`/trivia/unirse/${pin}`);
            return;
        }

        const init = async () => {
            const juegoBase = await supabaseService.getTriviaJuegoPorPin(pin);
            if (!juegoBase) { navigate('/trivia'); return; }

            const juegoCompleto = await supabaseService.getTriviaJuego(juegoBase.id);
            if (!juegoCompleto) { navigate('/trivia'); return; }

            const ranking = await supabaseService.getTriviaRanking(juegoBase.id, 200);
            const yo = ranking.find(r => r.id === jugadorId) || null;

            setJuego(juegoCompleto);
            juegoRef.current = juegoCompleto;
            setJugadores(ranking);

            if (yo) {
                setJugador(yo);
                jugadorRef.current = yo;
            }

            const estado = juegoCompleto.estado;
            const idx    = juegoCompleto.preguntaActualIdx;
            const pregs  = juegoCompleto.preguntas || [];

            if (estado === 'esperando') {
                setPantalla('espera');

            } else if (estado === 'en_curso' && idx >= 0) {
                await cargarPregunta(juegoCompleto, idx);

            } else if (estado === 'entre_preguntas') {
                if (idx >= 0 && idx < pregs.length && yo) {
                    const resp = await supabaseService
                        .getTriviaRespuestaJugador(yo.id, pregs[idx].id);
                    setPreguntaActual(pregs[idx]);
                    const rankSorted = [...ranking].sort(
                        (a, b) => b.puntajeTotal - a.puntajeTotal
                    );
                    const pos = rankSorted.findIndex(r => r.id === yo.id) + 1;
                    setResultadoRespuesta({
                        esCorrecta:    resp?.esCorrecta ?? false,
                        puntosGanados: resp?.puntosGanados ?? 0,
                        rachaActual:   yo.rachaActual,
                        puntajeTotal:  yo.puntajeTotal,
                        posicion:      pos,
                    });
                    if (resp) {
                        setOpcionElegida(resp.opcionId);
                        setPantalla('reaccion');
                    } else {
                        setPantalla('respondida');
                    }
                } else {
                    setPantalla('respondida');
                }

            } else if (
                estado === 'finalizando' ||
                estado === 'finalizado'
            ) {
                const rankSorted = [...ranking].sort(
                    (a, b) => b.puntajeTotal - a.puntajeTotal
                );
                const pos = yo
                    ? rankSorted.findIndex(r => r.id === yo.id) + 1
                    : 0;
                setResultadoRespuesta({
                    esCorrecta:    false,
                    puntosGanados: 0,
                    rachaActual:   yo?.rachaActual ?? 0,
                    puntajeTotal:  yo?.puntajeTotal ?? 0,
                    posicion:      pos || undefined,
                });
                setPantalla('final');
            }
        };

        init();

        return () => {
            if (dobleTimeoutRef.current)  clearTimeout(dobleTimeoutRef.current);
            if (cuentaTimeoutRef.current) clearTimeout(cuentaTimeoutRef.current);
            detenerTimer();
        };
    }, [pin]);

    // ── Realtime ──────────────────────────────────────────
    useEffect(() => {
        if (!juego) return;

        const channel = supabase
            .channel(`jugador-${juego.id}`)
            .on(
                'postgres_changes',
                {
                    event:  'UPDATE',
                    schema: 'public',
                    table:  'trivia_juegos',
                    filter: `id=eq.${juego.id}`
                },
                async payload => {
                    const nuevo  = payload.new as any;
                    const estado = nuevo.estado as TriviaEstadoJuego;
                    const idx    = nuevo.pregunta_actual_idx as number;
                    const timerPausado = (nuevo.timer_pausado as boolean) ?? false;
                    const startedAt    = (nuevo.started_at as string | null) ?? null;

                    const juegoActual = juegoRef.current;
                    if (!juegoActual) return;

                    const juegoUpdated = {
                        ...juegoActual,
                        estado,
                        preguntaActualIdx: idx,
                        timerPausado,
                        startedAt: startedAt ?? juegoActual.startedAt,
                    };
                    setJuego(juegoUpdated);
                    juegoRef.current = juegoUpdated;

                    const jug    = jugadorRef.current;
                    const pregs  = juegoActual.preguntas || [];

                    if (estado === 'en_curso') {
                        const esNuevaPregunta = idx !== juegoActual.preguntaActualIdx;
                        const prevPausado     = juegoActual.timerPausado ?? false;

                        // Pause / resume sin cambio de pregunta
                        if (!esNuevaPregunta && timerPausado !== prevPausado) {
                            if (timerPausado) {
                                detenerTimer();
                            } else {
                                // Reanudar con el tiempo que quedaba (usar refs para valor actual)
                                const remaining = tiempoRestanteRef.current;
                                if (remaining > 0) {
                                    if (timerRef.current) clearInterval(timerRef.current);
                                    const totalSeg = tiempoTotalRef.current;
                                    setTiempoInicioPregunta(Date.now() - ((totalSeg - remaining) * 1000));
                                    let count = remaining;
                                    timerRef.current = setInterval(() => {
                                        count--;
                                        tiempoRestanteRef.current = count;
                                        if (count <= 0) {
                                            clearInterval(timerRef.current!);
                                            timerRef.current = null;
                                            setTiempoRestante(0);
                                        } else {
                                            setTiempoRestante(count);
                                        }
                                    }, 1000);
                                }
                            }
                            return;
                        }

                        if (juegoActual.estado === 'esperando') {
                            iniciarCuentaRegresivaSync(startedAt, juegoUpdated, idx);
                        } else {
                            await cargarPregunta(juegoUpdated, idx);
                        }

                    } else if (estado === 'entre_preguntas') {
                        detenerTimer();
                        const p = pregs[idx];
                        if (!p || !jug) {
                            setPantalla('respondida');
                            return;
                        }

                        const resp = await supabaseService
                            .getTriviaRespuestaJugador(jug.id, p.id);

                        const ranking = await supabaseService
                            .getTriviaRanking(juegoActual.id, 200);
                        const yo = ranking.find(r => r.id === jug.id);
                        if (yo) {
                            setJugador(yo);
                            jugadorRef.current = yo;
                        }
                        const rankSorted = [...ranking].sort(
                            (a, b) => b.puntajeTotal - a.puntajeTotal
                        );
                        const pos = rankSorted.findIndex(r => r.id === jug.id) + 1;

                        setResultadoRespuesta({
                            esCorrecta:    resp?.esCorrecta ?? false,
                            puntosGanados: resp?.puntosGanados ?? 0,
                            rachaActual:   yo?.rachaActual ?? 0,
                            puntajeTotal:  yo?.puntajeTotal ?? 0,
                            posicion:      pos,
                        });
                        setPantalla('reaccion');

                    } else if (
                        estado === 'finalizando' ||
                        estado === 'finalizado'
                    ) {
                        detenerTimer();
                        const ranking = await supabaseService
                            .getTriviaRanking(juegoActual.id, 200);
                        const yo = ranking.find(r => r.id === jug?.id);
                        if (yo) {
                            setJugador(yo);
                            jugadorRef.current = yo;
                        }
                        const rankSorted = [...ranking].sort(
                            (a, b) => b.puntajeTotal - a.puntajeTotal
                        );
                        const pos = jug
                            ? rankSorted.findIndex(r => r.id === jug.id) + 1
                            : 0;
                        setResultadoRespuesta({
                            esCorrecta:    false,
                            puntosGanados: 0,
                            rachaActual:   yo?.rachaActual ?? 0,
                            puntajeTotal:  yo?.puntajeTotal ?? 0,
                            posicion:      pos || undefined,
                        });
                        setPantalla('final');
                    }
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
                        setTotalRespondieron(row.total_respuestas);
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
                () => {
                    supabaseService
                        .getTriviaRanking(juego.id, 100)
                        .then(setJugadores);
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [juego?.id]);

    // ── Responder ─────────────────────────────────────────
    const handleResponder = async (opcion: TriviaOpcion) => {
        if (opcionElegida) return;
        if (!jugador || !preguntaActual) return;

        detenerTimer();
        const tiempoMs = Date.now() - tiempoInicioPregunta;
        setOpcionElegida(opcion.id);
        setPantalla('respondida');

        const resultado = await supabaseService.responderTrivia(
            jugador.id,
            preguntaActual.id,
            opcion.id,
            tiempoMs
        );

        if (resultado.bloqueado) {
            setOpcionElegida(null);
            setPantalla('pregunta');
            setMensajeBloqueado('El admin pausó el juego. Esperá un momento.');
            setTimeout(() => setMensajeBloqueado(null), 3500);
        }
    };

    // ── Helpers para color del timer ──────────────────────
    const pct = tiempoTotal > 0 ? tiempoRestante / tiempoTotal : 0;
    const timerColor = pct > 0.5 ? '#22C55E' : pct > 0.25 ? '#F59E0B' : '#EF4444';

    // ── JSX ───────────────────────────────────────────────
    return (
        <div
            className="min-h-screen overflow-hidden"
            style={{ background: '#1A0A2E' }}
        >
            <AnimatePresence mode="wait">

                {/* ── CARGANDO ─────────────────────── */}
                {pantalla === 'cargando' && (
                    <motion.div
                        key="cargando"
                        className="min-h-screen flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <Loader2 className="w-8 h-8 animate-spin text-white/40" />
                    </motion.div>
                )}

                {/* ── ESPERA ───────────────────────── */}
                {pantalla === 'espera' && (
                    <motion.div
                        key="espera"
                        className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        {jugador && (
                            <div className="text-center mb-10">
                                <div className="text-7xl mb-4">{jugador.avatarEmoji}</div>
                                <p className="text-xl font-bold text-white mb-1">
                                    {jugador.nickname}
                                </p>
                                <p className="text-white/40 text-sm font-medium">
                                    Estás listo para jugar
                                </p>
                            </div>
                        )}

                        <div className="text-center mb-8">
                            <p className="text-white/40 text-[11px] font-semibold uppercase tracking-[0.4em] mb-2">
                                {juego?.titulo}
                            </p>
                            <p className="text-white/50 text-sm mb-1">
                                Esperando que el admin inicie el juego...
                            </p>
                            <p className="text-white/30 text-xs">
                                {jugadores.length} jugador{jugadores.length !== 1 ? 'es' : ''} en la sala
                            </p>
                        </div>

                        <div className="flex gap-2 mb-10">
                            {[0, 1, 2].map(i => (
                                <motion.div
                                    key={i}
                                    className="w-2 h-2 rounded-full bg-white/30"
                                    animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.3, 1] }}
                                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                                />
                            ))}
                        </div>

                        {jugadores.length > 0 && (
                            <div className="w-full max-w-xs">
                                <p className="text-white/30 text-[10px] font-semibold uppercase tracking-[0.3em] text-center mb-3">
                                    En la sala
                                </p>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {jugadores.map(j => (
                                        <motion.div
                                            key={j.id}
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                                                j.id === jugador?.id
                                                    ? 'bg-white text-[#1A0A2E] font-bold'
                                                    : 'bg-white/10 text-white/70'
                                            }`}
                                        >
                                            <span>{j.avatarEmoji}</span>
                                            <span>{j.nickname}</span>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* ── CUENTA REGRESIVA ─────────────── */}
                {pantalla === 'cuenta_regresiva' && (
                    <motion.div
                        key="cuenta"
                        className="min-h-screen flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={cuentaRegresiva}
                                initial={{ scale: 0.3, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 2, opacity: 0 }}
                                transition={{ duration: 0.35, ease: 'easeOut' }}
                                className="text-[10rem] font-black text-white leading-none select-none"
                            >
                                {cuentaRegresiva}
                            </motion.div>
                        </AnimatePresence>
                    </motion.div>
                )}

                {/* ── DOBLE PUNTOS ─────────────────── */}
                {pantalla === 'doble' && (
                    <motion.div
                        key="doble"
                        className="min-h-screen flex flex-col items-center justify-center px-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            animate={{
                                scale:   [1, 1.15, 1],
                                opacity: [0.9, 1, 0.9]
                            }}
                            transition={{ duration: 0.8, repeat: Infinity }}
                            className="text-center"
                        >
                            <div className="text-7xl mb-4">⚡</div>
                            <h2
                                className="text-4xl font-black mb-2"
                                style={{ color: '#FFD700' }}
                            >
                                ¡DOBLE PUNTOS!
                            </h2>
                            <p className="text-white/60 text-base font-medium">
                                Esta pregunta vale el doble
                            </p>
                        </motion.div>
                    </motion.div>
                )}

                {/* ── PREGUNTA ─────────────────────── */}
                {pantalla === 'pregunta' && preguntaActual && (
                    <motion.div
                        key={`pregunta-${preguntaActual.id}`}
                        className="h-screen flex flex-col overflow-hidden"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        transition={{ duration: 0.3 }}
                    >
                        {/* Barra de progreso del timer */}
                        <div className="w-full h-2 bg-white/10 shrink-0">
                            {tiempoTotal > 0 && (
                                <div
                                    className="h-full transition-all duration-1000 ease-linear"
                                    style={{
                                        width: `${pct * 100}%`,
                                        background: timerColor,
                                    }}
                                />
                            )}
                        </div>

                        {/* Toast: admin pausó el timer */}
                        {mensajeBloqueado && (
                            <div className="mx-4 mt-3 px-4 py-2.5 rounded-xl text-center text-sm font-semibold shrink-0"
                                style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.3)' }}
                            >
                                {mensajeBloqueado}
                            </div>
                        )}

                        {/* Top: logo + label + timer */}
                        <div className="px-4 pt-3 pb-0 text-center shrink-0">
                            <div className="flex justify-center mb-3">
                                <img
                                    src="/origen-logo.png"
                                    alt="Origen"
                                    className="h-9 opacity-85"
                                    style={{ filter: 'brightness(0) invert(1)' }}
                                />
                            </div>

                            {preguntaActual.esDoble && (
                                <div
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-2"
                                    style={{
                                        background: 'rgba(255,215,0,0.15)',
                                        border: '1px solid rgba(255,215,0,0.3)'
                                    }}
                                >
                                    <Zap className="w-3.5 h-3.5" style={{ color: '#FFD700' }} />
                                    <span
                                        className="text-[11px] font-bold uppercase tracking-widest"
                                        style={{ color: '#FFD700' }}
                                    >
                                        Doble puntos
                                    </span>
                                </div>
                            )}

                            <div className="flex items-center justify-between px-1">
                                <p className="text-white/50 text-xs font-semibold uppercase tracking-widest">
                                    Elegí tu respuesta
                                </p>
                                {tiempoTotal > 0 && (
                                    <span
                                        className="text-sm font-black tabular-nums transition-colors duration-500"
                                        style={{ color: timerColor }}
                                    >
                                        {tiempoRestante}s
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Pregunta */}
                        <div className="flex-1 flex items-center px-4">
                            <p className="w-full text-white text-2xl font-bold leading-tight text-center">
                                {preguntaActual.texto}
                            </p>
                        </div>

                        {/* Grid de opciones */}
                        <div className="shrink-0 px-3 pb-4">
                            <div className="grid grid-cols-2 gap-3 w-full" style={{ maxHeight: '62vh' }}>
                                {(preguntaActual.opciones || []).map(opcion => (
                                    <motion.button
                                        key={opcion.id}
                                        type="button"
                                        onClick={() => handleResponder(opcion)}
                                        whileTap={{ scale: 0.94 }}
                                        className="flex flex-col items-center justify-center rounded-3xl text-white font-bold active:brightness-90 transition-all"
                                        style={{ background: TRIVIA_COLORES[opcion.color], height: '29vh' }}
                                    >
                                        <span className="text-5xl drop-shadow">
                                            {TRIVIA_ICONOS[opcion.color]}
                                        </span>
                                    </motion.button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ── RESPONDIDA ───────────────────── */}
                {pantalla === 'respondida' && preguntaActual && (
                    <motion.div
                        key="respondida"
                        className="min-h-screen flex flex-col items-center justify-center px-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        {opcionElegida && (() => {
                            const op = (preguntaActual.opciones || [])
                                .find(o => o.id === opcionElegida);
                            if (!op) return null;
                            return (
                                <motion.div
                                    initial={{ scale: 0.8 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: 'spring', stiffness: 200 }}
                                    className="w-32 h-32 rounded-2xl flex items-center justify-center text-6xl mb-8"
                                    style={{ background: TRIVIA_COLORES[op.color] }}
                                >
                                    {TRIVIA_ICONOS[op.color]}
                                </motion.div>
                            );
                        })()}

                        <p className="text-white text-lg font-bold mb-2">
                            ¡Respuesta enviada!
                        </p>
                        <p className="text-white/40 text-sm text-center">
                            Esperando que el admin revele el resultado...
                        </p>

                        {totalRespondieron > 0 && (
                            <p className="text-white/25 text-xs mt-3">
                                {totalRespondieron} respondieron
                            </p>
                        )}

                        <div className="flex gap-2 mt-8">
                            {[0, 1, 2].map(i => (
                                <motion.div
                                    key={i}
                                    className="w-2 h-2 rounded-full bg-white/30"
                                    animate={{ opacity: [0.3, 1, 0.3] }}
                                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* ── REACCIÓN ─────────────────────── */}
                {pantalla === 'reaccion' && resultadoRespuesta && (
                    <motion.div
                        key="reaccion"
                        className="min-h-screen flex flex-col items-center justify-center px-4 gap-6"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        {/* ✅ / ❌ */}
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
                            className="text-8xl"
                        >
                            {resultadoRespuesta.esCorrecta ? '✅' : '❌'}
                        </motion.div>

                        {/* Mensaje + puntos */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-center"
                        >
                            <p className="text-2xl font-black text-white mb-1">
                                {resultadoRespuesta.esCorrecta ? '¡Correcto!' : 'Incorrecto'}
                            </p>
                            {resultadoRespuesta.esCorrecta && resultadoRespuesta.puntosGanados > 0 && (
                                <motion.p
                                    initial={{ scale: 0.5 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.5, type: 'spring' }}
                                    className="text-4xl font-black"
                                    style={{ color: '#46D483' }}
                                >
                                    +{resultadoRespuesta.puntosGanados} pts
                                </motion.p>
                            )}
                        </motion.div>

                        {/* Racha 🔥 */}
                        {resultadoRespuesta.rachaActual >= 3 && (
                            <motion.div
                                initial={{ y: 30, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.6, type: 'spring' }}
                                className="flex items-center gap-2 px-4 py-2 rounded-full"
                                style={{
                                    background: 'rgba(255,140,0,0.2)',
                                    border: '1px solid rgba(255,140,0,0.4)'
                                }}
                            >
                                <Flame className="w-5 h-5" style={{ color: '#FF8C00' }} />
                                <span className="font-black text-sm" style={{ color: '#FF8C00' }}>
                                    🔥 ¡En racha! ×{resultadoRespuesta.rachaActual}
                                </span>
                            </motion.div>
                        )}

                        {/* Posición actual */}
                        {resultadoRespuesta.posicion && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.8 }}
                                className="text-center"
                            >
                                <p className="text-white/40 text-sm font-medium">
                                    Estás en el puesto
                                </p>
                                <p className="text-5xl font-black text-white">
                                    {resultadoRespuesta.posicion}°
                                </p>
                                <p className="text-white/40 text-xs mt-1">
                                    {resultadoRespuesta.puntajeTotal} puntos totales
                                </p>
                            </motion.div>
                        )}

                        <p className="text-white/25 text-xs text-center mt-4">
                            Esperando la siguiente pregunta...
                        </p>
                    </motion.div>
                )}

                {/* ── FINAL ────────────────────────── */}
                {pantalla === 'final' && (
                    <motion.div
                        key="final"
                        className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        {jugador && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                                className="text-7xl mb-4"
                            >
                                {jugador.avatarEmoji}
                            </motion.div>
                        )}

                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-center mb-8"
                        >
                            <p className="text-white/40 text-[11px] font-semibold uppercase tracking-[0.4em] mb-2">
                                Juego terminado
                            </p>
                            <h2 className="text-3xl font-black text-white mb-1">
                                ¡Gracias por jugar!
                            </h2>
                            {jugador && (
                                <p className="text-white/60 text-base font-medium">
                                    {jugador.nickname}
                                </p>
                            )}
                        </motion.div>

                        {resultadoRespuesta && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.5 }}
                                className="text-center mb-6"
                            >
                                <p className="text-white/40 text-sm mb-1">Puntaje final</p>
                                <p className="text-6xl font-black text-white tabular-nums">
                                    {resultadoRespuesta.puntajeTotal}
                                </p>
                                <p className="text-white/40 text-sm mt-1">puntos</p>

                                {resultadoRespuesta.posicion && (
                                    <p className="text-white/60 text-base font-semibold mt-4">
                                        Terminaste{' '}
                                        <span className="text-white font-black">
                                            {resultadoRespuesta.posicion}°
                                        </span>
                                    </p>
                                )}

                                {jugador && jugador.maxRacha >= 3 && (
                                    <div className="flex items-center justify-center gap-1.5 mt-3">
                                        <span>🔥</span>
                                        <span
                                            className="text-sm font-medium"
                                            style={{ color: '#FF8C00' }}
                                        >
                                            Mejor racha: {jugador.maxRacha}
                                        </span>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1 }}
                            className="text-white/25 text-xs text-center"
                        >
                            Mirá el podio en la pantalla grande 🏆
                        </motion.p>
                    </motion.div>
                )}

            </AnimatePresence>
        </div>
    );
};

export default TriviaJugador;
