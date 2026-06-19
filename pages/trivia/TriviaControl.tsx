import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabaseService } from '../../services/supabaseService';
import { supabase } from '../../services/supabaseClient';
import {
    TriviaJuego, TriviaJugador, TriviaEstadoJuego, User
} from '../../types';
import {
    ArrowLeft, Play, Eye, SkipForward, Award,
    XCircle, Loader2, Users, Monitor,
    PauseCircle, FastForward, RotateCcw
} from 'lucide-react';

interface Props {
    currentUser: User | null;
}

const ESTADO_LABEL: Record<TriviaEstadoJuego, { label: string; color: string; bg: string }> = {
    esperando:       { label: 'Esperando',       color: 'text-slate-600', bg: 'bg-slate-100'  },
    en_curso:        { label: 'En curso',         color: 'text-green-700', bg: 'bg-green-100'  },
    entre_preguntas: { label: 'Entre preguntas',  color: 'text-amber-700', bg: 'bg-amber-100'  },
    finalizando:     { label: 'Finalizando',      color: 'text-blue-700',  bg: 'bg-blue-100'   },
    finalizado:      { label: 'Finalizado',       color: 'text-slate-400', bg: 'bg-slate-100'  },
};

const TriviaControl: React.FC<Props> = ({ currentUser }) => {
    const { id }    = useParams<{ id: string }>();
    const navigate  = useNavigate();

    const [juego,      setJuego]      = useState<TriviaJuego | null>(null);
    const [jugadores,  setJugadores]  = useState<TriviaJugador[]>([]);
    const [loading,    setLoading]    = useState(true);
    const [accionando, setAccionando] = useState(false);
    const [error,      setError]      = useState<string | null>(null);

    // Contador en vivo
    const [respuestasCount, setRespuestasCount] = useState(0);
    const [segundosPregunta, setSegundosPregunta] = useState(0);
    const [confirmandoReset, setConfirmandoReset]       = useState(false);
    const [confirmandoTerminar, setConfirmandoTerminar] = useState(false);

    const juegoRef      = useRef<TriviaJuego | null>(null);
    const iniciadoRef   = useRef(false);
    const cronometroRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Carga inicial ────────────────────────────────
    const cargarJuego = async () => {
        if (!id) return;
        const data = await supabaseService.getTriviaJuego(id);
        if (!data) { setError('Juego no encontrado'); setLoading(false); return; }
        setJuego(data);
        juegoRef.current = data;
        const jug = await supabaseService.getTriviaRanking(id, 200);
        setJugadores(jug);
        setLoading(false);
    };

    useEffect(() => {
        if (!id || iniciadoRef.current) return;
        iniciadoRef.current = true;
        cargarJuego();
    }, [id]);

    // ── Realtime ─────────────────────────────────────
    useEffect(() => {
        if (!juego) return;

        const channel = supabase
            .channel(`control-${juego.id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'trivia_juegos', filter: `id=eq.${juego.id}` },
                payload => {
                    const nuevo = payload.new as any;
                    const updated: TriviaJuego = {
                        ...juegoRef.current!,
                        estado:            nuevo.estado,
                        preguntaActualIdx: nuevo.pregunta_actual_idx,
                        timerPausado:      nuevo.timer_pausado ?? false,
                    };
                    setJuego(updated);
                    juegoRef.current = updated;
                    setRespuestasCount(0);
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'trivia_jugadores', filter: `juego_id=eq.${juego.id}` },
                async () => {
                    const jug = await supabaseService.getTriviaRanking(juego.id, 200);
                    setJugadores(jug);
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'trivia_estado_pregunta', filter: `juego_id=eq.${juego.id}` },
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

    // ── Cronómetro pregunta actual ────────────────────
    useEffect(() => {
        if (cronometroRef.current) {
            clearInterval(cronometroRef.current);
            cronometroRef.current = null;
        }
        setSegundosPregunta(0);

        if (juego?.estado === 'en_curso') {
            cronometroRef.current = setInterval(() => {
                setSegundosPregunta(s => s + 1);
            }, 1000);
        }

        return () => {
            if (cronometroRef.current) {
                clearInterval(cronometroRef.current);
            }
        };
    }, [juego?.estado, juego?.preguntaActualIdx]);

    // ── Acciones ─────────────────────────────────────
    // Mapeo: accion local → avanzarTriviaJuego(accion: 'iniciar'|'siguiente'|'revelar'|'finalizar')
    // 'finalizar' (podio) = llamar 'siguiente' en última pregunta → auto-transición a 'finalizando'
    // 'cerrar' (cerrar juego) = llamar 'finalizar' → 'finalizado'
    const handleAccion = async (
        accion: 'iniciar' | 'revelar' | 'siguiente' | 'finalizar' | 'cerrar' | 'terminar'
    ) => {
        const j = juegoRef.current;
        if (!j || accionando) return;
        setAccionando(true);
        try {
            const pregs = j.preguntas || [];

            if (accion === 'iniciar') {
                await supabaseService.avanzarTriviaJuego(j.id, 'iniciar');
                if (pregs[0]) {
                    await supabaseService.setTriviaPreguntaEstado(j.id, pregs[0].id, 'abierta');
                }

            } else if (accion === 'revelar') {
                const pregActual = pregs[j.preguntaActualIdx];
                if (pregActual) {
                    await supabaseService.setTriviaPreguntaEstado(j.id, pregActual.id, 'revelada');
                }
                await supabaseService.avanzarTriviaJuego(j.id, 'revelar');

            } else if (accion === 'siguiente' || accion === 'finalizar') {
                // 'siguiente' avanza al índice siguiente; si es el último → 'finalizando'
                const nextIdx = j.preguntaActualIdx + 1;
                await supabaseService.avanzarTriviaJuego(j.id, 'siguiente', pregs.length);
                if (nextIdx < pregs.length && pregs[nextIdx]) {
                    await supabaseService.setTriviaPreguntaEstado(j.id, pregs[nextIdx].id, 'abierta');
                }

            } else if (accion === 'cerrar') {
                await supabaseService.avanzarTriviaJuego(j.id, 'finalizar');

            } else if (accion === 'terminar') {
                await supabaseService.avanzarTriviaJuego(j.id, 'terminar');
            }
        } finally {
            setAccionando(false);
        }
    };

    const handlePausarTimer = async () => {
        if (!juego || accionando) return;
        setAccionando(true);
        const nuevoEstado = !juego.timerPausado;
        const ok = await supabaseService
            .setTriviaTimerPausado(juego.id, nuevoEstado);
        if (ok) {
            setJuego(j => j
                ? { ...j, timerPausado: nuevoEstado }
                : j
            );
            juegoRef.current = juegoRef.current
                ? { ...juegoRef.current, timerPausado: nuevoEstado }
                : juegoRef.current;
        }
        setAccionando(false);
    };

    const handleSaltarPregunta = async () => {
        const j = juegoRef.current;
        if (!j || accionando) return;
        setAccionando(true);
        const pregs = j.preguntas || [];
        await supabaseService.saltarSiguientePregunta(
            j.id, pregs.length
        );
        setAccionando(false);
    };

    const handleReiniciar = async () => {
        const j = juegoRef.current;
        if (!j || accionando) return;
        setAccionando(true);
        const nuevoId = await supabaseService.reiniciarTriviaJuego(j.id);
        setConfirmandoReset(false);
        setAccionando(false);
        if (nuevoId) navigate(`/trivia/admin/${nuevoId}`);
    };

    // ── Derivados ─────────────────────────────────────
    const estadoInfo      = juego ? ESTADO_LABEL[juego.estado] : null;
    const pregs           = juego?.preguntas || [];
    const idx             = juego?.preguntaActualIdx ?? 0;
    const esUltima        = idx >= pregs.length - 1;
    const hayPregs        = pregs.length > 0;

    const mostrarIniciar   = juego?.estado === 'esperando';
    const mostrarRevelar   = juego?.estado === 'en_curso';
    const mostrarSiguiente = juego?.estado === 'entre_preguntas' && !esUltima;
    const mostrarFinalizar = juego?.estado === 'entre_preguntas' && esUltima;
    const mostrarCerrar    = juego?.estado === 'finalizando';

    // ── Render ────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
            </div>
        );
    }

    if (error || !juego) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="text-center">
                    <p className="text-slate-500 mb-4">{error || 'Juego no encontrado'}</p>
                    <button
                        onClick={() => navigate('/trivia/admin')}
                        className="text-slate-700 underline text-sm"
                    >
                        Volver a Trivia Admin
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">

            {/* ── Header ── */}
            <div className="bg-white border-b border-gray-100 px-6 py-4">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/trivia/admin')}
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-gray-100 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900">{juego.titulo}</h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs font-mono text-slate-400 bg-gray-100 px-2 py-0.5 rounded-md tracking-widest">
                                    PIN: {juego.pin}
                                </span>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${estadoInfo?.bg} ${estadoInfo?.color}`}>
                                    {estadoInfo?.label}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Contador en vivo */}
                        {juego.estado === 'en_curso' && (
                            <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100">
                                <span className="text-xs font-mono text-slate-500 tabular-nums">
                                    ⏱ {segundosPregunta}s
                                </span>
                                <span className="text-xs text-slate-300">|</span>
                                <span className="text-xs font-semibold text-slate-600 tabular-nums">
                                    {respuestasCount}/{jugadores.length} respondieron
                                </span>
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                            <Users className="w-4 h-4" />
                            <span className="font-semibold text-slate-700">{jugadores.length}</span>
                            <span>jugadores</span>
                        </div>
                        <a
                            href={`${window.location.origin}/#/trivia/pantalla/${juego.pin}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-50 text-violet-700 text-sm font-semibold hover:bg-violet-100 transition-colors"
                        >
                            <Monitor className="w-4 h-4" />
                            Proyector
                        </a>
                    </div>
                </div>
            </div>

            {/* ── Body ── */}
            <div className="max-w-5xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Columna izquierda: controles + jugadores */}
                    <div className="md:col-span-1 space-y-4">

                        {/* Controles */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
                            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                                Controles
                            </h2>

                            {mostrarIniciar && (
                                <button
                                    onClick={() => handleAccion('iniciar')}
                                    disabled={accionando || !hayPregs}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {accionando
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <Play className="w-4 h-4" />}
                                    Iniciar juego
                                </button>
                            )}

                            {mostrarRevelar && (
                                <button
                                    onClick={() => handleAccion('revelar')}
                                    disabled={accionando}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {accionando
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <Eye className="w-4 h-4" />}
                                    Revelar respuesta
                                </button>
                            )}

                            {/* Pausar/Reanudar timer — solo durante 'en_curso' */}
                            {juego.estado === 'en_curso' && (
                                <button
                                    onClick={handlePausarTimer}
                                    disabled={accionando}
                                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                        juego.timerPausado
                                            ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {accionando
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : juego.timerPausado
                                            ? <Play className="w-4 h-4" />
                                            : <PauseCircle className="w-4 h-4" />}
                                    {juego.timerPausado ? 'Reanudar' : 'Pausar timer'}
                                </button>
                            )}

                            {/* Saltar pregunta — durante 'en_curso' */}
                            {juego.estado === 'en_curso' && (
                                <button
                                    onClick={handleSaltarPregunta}
                                    disabled={accionando}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {accionando
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <FastForward className="w-4 h-4" />}
                                    Saltar pregunta
                                </button>
                            )}

                            {mostrarSiguiente && (
                                <button
                                    onClick={() => handleAccion('siguiente')}
                                    disabled={accionando}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {accionando
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <SkipForward className="w-4 h-4" />}
                                    Siguiente pregunta
                                </button>
                            )}

                            {mostrarFinalizar && (
                                <button
                                    onClick={() => handleAccion('finalizar')}
                                    disabled={accionando}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {accionando
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <Award className="w-4 h-4" />}
                                    Ver podio
                                </button>
                            )}

                            {mostrarCerrar && (
                                <button
                                    onClick={() => handleAccion('cerrar')}
                                    disabled={accionando}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-700 text-white font-bold text-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {accionando
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <XCircle className="w-4 h-4" />}
                                    Cerrar juego
                                </button>
                            )}

                            {juego.estado === 'finalizado' && (
                                <p className="text-center py-3 text-slate-400 text-sm">
                                    Juego finalizado
                                </p>
                            )}

                            {/* Terminar anticipado → podio */}
                            {(juego.estado === 'en_curso' || juego.estado === 'entre_preguntas') && (
                                <div className="pt-3 border-t border-gray-100">
                                    {!confirmandoTerminar ? (
                                        <button
                                            onClick={() => setConfirmandoTerminar(true)}
                                            disabled={accionando}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-violet-200 text-violet-600 font-bold text-sm hover:bg-violet-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <Award className="w-4 h-4" />
                                            Terminar y ver podio
                                        </button>
                                    ) : (
                                        <div className="space-y-2">
                                            <p className="text-xs text-violet-600 text-center font-medium">
                                                ¿Terminar el juego ahora y mostrar el podio?
                                            </p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setConfirmandoTerminar(false)}
                                                    className="flex-1 px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-colors"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        setConfirmandoTerminar(false);
                                                        await handleAccion('terminar');
                                                    }}
                                                    disabled={accionando}
                                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors"
                                                >
                                                    {accionando
                                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                                        : 'Sí, al podio'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Hard reset — visible cuando el juego ya empezó */}
                            {juego.estado !== 'esperando' && (
                                <div className="pt-3 border-t border-gray-100">
                                    {!confirmandoReset ? (
                                        <button
                                            onClick={() => setConfirmandoReset(true)}
                                            disabled={accionando}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-red-200 text-red-500 font-bold text-sm hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                            Reiniciar juego
                                        </button>
                                    ) : (
                                        <div className="space-y-2">
                                            <p className="text-xs text-red-500 text-center font-medium">
                                                Se creará un nuevo juego. El historial de esta partida se conserva. ¿Seguro?
                                            </p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setConfirmandoReset(false)}
                                                    className="flex-1 px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-colors"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    onClick={handleReiniciar}
                                                    disabled={accionando}
                                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                                                >
                                                    {accionando
                                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                                        : 'Sí, reiniciar'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {!hayPregs && juego.estado === 'esperando' && (
                                <p className="text-xs text-slate-400 text-center pt-2">
                                    No hay preguntas.{' '}
                                    <Link
                                        to={`/trivia/admin/nuevo?edit=${juego.id}`}
                                        className="text-violet-600 underline"
                                    >
                                        Editar juego
                                    </Link>
                                </p>
                            )}
                        </div>

                        {/* Jugadores */}
                        {jugadores.length > 0 && (
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                                    Jugadores ({jugadores.length})
                                </h2>
                                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                                    {jugadores.map((j, i) => (
                                        <div key={j.id} className="flex items-center gap-2 py-0.5">
                                            <span className="text-slate-300 text-xs tabular-nums w-5 text-right shrink-0">
                                                {i + 1}
                                            </span>
                                            <span className="text-base">{j.avatarEmoji}</span>
                                            <span className="text-slate-700 text-sm font-medium flex-1 truncate">
                                                {j.nickname}
                                            </span>
                                            {juego.estado !== 'esperando' && (
                                                <span className="text-slate-400 text-xs font-mono tabular-nums shrink-0">
                                                    {j.puntajeTotal}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Columna derecha: lista de preguntas */}
                    <div className="md:col-span-2">
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                                Preguntas ({pregs.length})
                            </h2>

                            {pregs.length === 0 ? (
                                <p className="text-slate-400 text-sm text-center py-10">
                                    No hay preguntas en este juego.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {pregs.map((p, i) => {
                                        const esCurrent  = i === idx && juego.estado !== 'esperando' && juego.estado !== 'finalizado';
                                        const esResuelta = i < idx && juego.estado !== 'esperando';
                                        return (
                                            <motion.div
                                                key={p.id}
                                                animate={{ scale: esCurrent ? 1.01 : 1 }}
                                                transition={{ duration: 0.2 }}
                                                className={`flex items-start gap-3 px-4 py-3 rounded-xl transition-colors ${
                                                    esCurrent
                                                        ? 'bg-violet-50 border border-violet-200'
                                                        : esResuelta
                                                        ? 'bg-slate-50 opacity-40'
                                                        : 'bg-gray-50'
                                                }`}
                                            >
                                                <span className={`text-sm font-black tabular-nums shrink-0 mt-0.5 w-5 text-right ${esCurrent ? 'text-violet-600' : 'text-slate-300'}`}>
                                                    {i + 1}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium leading-snug truncate ${esCurrent ? 'text-violet-900' : 'text-slate-700'}`}>
                                                        {p.texto}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs text-slate-400">{p.tiempoLimite}s</span>
                                                        {p.esDoble && (
                                                            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                                                                ⚡ doble
                                                            </span>
                                                        )}
                                                        {esCurrent && (
                                                            <span className="text-xs font-semibold text-violet-600">
                                                                ▶ actual
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default TriviaControl;
