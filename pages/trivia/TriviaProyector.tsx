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

type PantallaProyector =
    | 'cargando'
    | 'esperando'
    | 'cuenta_regresiva'
    | 'doble'
    | 'pregunta'
    | 'entre_preguntas'
    | 'finalizando'
    | 'finalizado';

const PODIO_COLORS = ['#F59E0B', '#94A3B8', '#D97706'];
const PODIO_EMOJIS = ['🥇', '🥈', '🥉'];

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
    const [revelarRespuestas, setRevelarRespuestas] = useState(false);

    const juegoRef    = useRef<TriviaJuego | null>(null);
    const iniciadoRef = useRef(false);
    const cuentaIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const baseUrl    = window.location.origin + (window.location.pathname.includes('index.html') ? window.location.pathname : '');
    const urlUnirse  = `${window.location.origin}/#/trivia`;

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
            setTimeout(() => setPantalla('pregunta'), 2500);
        } else {
            setPantalla('pregunta');
        }
    };

    // ── Cuenta regresiva ──────────────────────────
    const iniciarCuentaRegresiva = (juegoData: TriviaJuego) => {
        setPantalla('cuenta_regresiva');
        setCuentaRegresiva(3);
        let count = 3;
        if (cuentaIntervalRef.current)
            clearInterval(cuentaIntervalRef.current);
        cuentaIntervalRef.current = setInterval(() => {
            count--;
            if (count <= 0) {
                clearInterval(cuentaIntervalRef.current!);
                mostrarPregunta(juegoData, juegoData.preguntaActualIdx, true);
            } else {
                setCuentaRegresiva(count);
            }
        }, 1000);
    };

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
            if (cuentaIntervalRef.current)
                clearInterval(cuentaIntervalRef.current);
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
                    const nuevo  = payload.new as any;
                    const estado = nuevo.estado as TriviaEstadoJuego;
                    const idx    = nuevo.pregunta_actual_idx as number;

                    const prev = juegoRef.current;
                    if (!prev) return;

                    const updated = { ...prev, estado, preguntaActualIdx: idx };
                    setJuego(updated);
                    juegoRef.current = updated;

                    if (estado === 'en_curso') {
                        const esNuevaPregunta = idx !== prev.preguntaActualIdx;
                        if (prev.estado === 'esperando') {
                            iniciarCuentaRegresiva(updated);
                        } else if (esNuevaPregunta) {
                            mostrarPregunta(updated, idx, true);
                        }

                    } else if (estado === 'entre_preguntas') {
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
                                Origen · Trivia
                            </p>
                            <h1 className="text-6xl md:text-8xl font-black text-white tracking-tight mb-4">
                                {juego?.titulo || 'Trivia Origen'}
                            </h1>
                        </div>

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
                                        size={140}
                                        fgColor="#1A0A2E"
                                        bgColor="#FFFFFF"
                                        level="M"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* URL */}
                        <p className="text-white/40 text-lg font-medium">
                            {window.location.host} → Trivia
                        </p>

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
                                exit={{ scale: 1.5, opacity: 0 }}
                                transition={{ duration: 0.4, type: 'spring', stiffness: 200 }}
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

                        {/* Imagen */}
                        {preguntaActual.imagenUrl && (
                            <div className="flex justify-center px-8 mb-4">
                                <img
                                    src={preguntaActual.imagenUrl}
                                    alt="pregunta"
                                    className="max-h-48 rounded-2xl object-contain"
                                />
                            </div>
                        )}

                        {/* Texto pregunta */}
                        <div className="flex-1 flex items-center justify-center px-8 pb-4">
                            <h2 className="text-4xl md:text-5xl font-black text-white text-center leading-tight max-w-4xl">
                                {preguntaActual.texto}
                            </h2>
                        </div>

                        {/* Grid opciones */}
                        <div className={`grid gap-4 px-8 pb-8 ${(preguntaActual.opciones || []).length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                            {(preguntaActual.opciones || []).map(op => (
                                <div
                                    key={op.id}
                                    className="flex items-center gap-4 px-6 py-5 rounded-2xl"
                                    style={{ background: TRIVIA_COLORES[op.color] }}
                                >
                                    <span className="text-4xl shrink-0">{TRIVIA_ICONOS[op.color]}</span>
                                    <span className="text-white font-bold text-xl leading-tight">{op.texto}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* ── ENTRE PREGUNTAS ───────────── */}
                {pantalla === 'entre_preguntas' && preguntaActual && (
                    <motion.div
                        key="entre"
                        className="min-h-screen flex flex-col px-8 py-8"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    >
                        {/* Opciones reveladas */}
                        <div className={`grid gap-3 mb-8 ${(preguntaActual.opciones || []).length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                            {(preguntaActual.opciones || []).map((op, i) => (
                                <motion.div
                                    key={op.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.08 }}
                                    className="flex items-center gap-4 px-6 py-5 rounded-2xl transition-all"
                                    style={{
                                        background:   op.esCorrecta ? TRIVIA_COLORES[op.color] : 'rgba(255,255,255,0.06)',
                                        opacity:      op.esCorrecta ? 1 : 0.4,
                                    }}
                                >
                                    <span className="text-3xl shrink-0">
                                        {op.esCorrecta ? '✓' : TRIVIA_ICONOS[op.color]}
                                    </span>
                                    <span className="text-white font-bold text-lg">{op.texto}</span>
                                </motion.div>
                            ))}
                        </div>

                        {/* Ranking top 5 */}
                        <div className="flex-1">
                            <p className="text-white/30 text-xs font-semibold uppercase tracking-[0.3em] mb-4">
                                Ranking
                            </p>
                            <div className="space-y-2">
                                {ranking.slice(0, 5).map((j, idx) => (
                                    <motion.div
                                        key={j.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.2 + idx * 0.1 }}
                                        className="flex items-center gap-4 px-5 py-3 rounded-2xl"
                                        style={{ background: 'rgba(255,255,255,0.06)' }}
                                    >
                                        <span className="text-2xl font-black text-white/30 tabular-nums w-8 text-center">
                                            {idx + 1}
                                        </span>
                                        <span className="text-2xl">{j.avatarEmoji}</span>
                                        <span className="flex-1 text-white font-bold text-lg truncate">{j.nickname}</span>
                                        <span className="text-white font-black text-2xl tabular-nums">{j.puntajeTotal}</span>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ── FINALIZANDO (podio) ───────── */}
                {pantalla === 'finalizando' && (
                    <motion.div
                        key="finalizando"
                        className="min-h-screen flex flex-col items-center justify-center px-8 py-12"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    >
                        <p className="text-white/40 text-sm font-semibold uppercase tracking-[0.4em] mb-6">
                            Resultados finales
                        </p>

                        {/* Podio top 3 — orden: 2°, 1°, 3° */}
                        <div className="flex items-end gap-4 mb-12">
                            {[1, 0, 2].map((rankPos, visualPos) => {
                                const j = ranking[rankPos];
                                if (!j) return null;
                                const heights  = ['h-40', 'h-52', 'h-32'];
                                const delays   = [0.3, 0.1, 0.5];
                                const medalIdx = rankPos; // 0=oro,1=plata,2=bronce
                                return (
                                    <motion.div
                                        key={j.id}
                                        initial={{ opacity: 0, y: 60 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: delays[visualPos], type: 'spring', stiffness: 120 }}
                                        className={`${heights[visualPos]} w-36 rounded-t-2xl flex flex-col items-center justify-end pb-4 gap-1`}
                                        style={{
                                            background: rankPos === 0
                                                ? `${PODIO_COLORS[0]}30`
                                                : 'rgba(255,255,255,0.06)',
                                            border: rankPos === 0
                                                ? `2px solid ${PODIO_COLORS[0]}60`
                                                : '1px solid rgba(255,255,255,0.1)'
                                        }}
                                    >
                                        <span className="text-4xl">{j.avatarEmoji}</span>
                                        <span className="text-white font-bold text-sm text-center px-1 truncate w-full text-center">
                                            {j.nickname}
                                        </span>
                                        <span className="font-black text-lg" style={{ color: PODIO_COLORS[medalIdx] }}>
                                            {PODIO_EMOJIS[medalIdx]}
                                        </span>
                                        <span className="text-white/60 font-bold text-sm tabular-nums">
                                            {j.puntajeTotal}
                                        </span>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Top 4–10 */}
                        <div className="w-full max-w-2xl space-y-1.5">
                            {ranking.slice(3, 10).map((j, idx) => (
                                <motion.div
                                    key={j.id}
                                    initial={{ opacity: 0, x: -15 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.8 + idx * 0.06 }}
                                    className="flex items-center gap-4 px-4 py-2.5 rounded-xl"
                                    style={{ background: 'rgba(255,255,255,0.04)' }}
                                >
                                    <span className="text-white/30 font-black tabular-nums w-6 text-center">
                                        {idx + 4}
                                    </span>
                                    <span className="text-lg">{j.avatarEmoji}</span>
                                    <span className="flex-1 text-white/80 font-bold truncate">{j.nickname}</span>
                                    <span className="text-white/60 font-bold tabular-nums">{j.puntajeTotal}</span>
                                </motion.div>
                            ))}
                        </div>
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
                            Gracias por jugar Trivia Origen
                        </p>
                    </motion.div>
                )}

            </AnimatePresence>
        </div>
    );
};

export default TriviaProyector;
