import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabaseService } from '../../services/supabaseService';
import { User, TriviaJuego, TriviaJugador } from '../../types';
import {
    Medal, Loader2, ArrowLeft,
    Settings, Check, X, Trash2, Save, RotateCcw
} from 'lucide-react';

const formatFechaHoraAR = (iso: string) =>
    new Date(iso).toLocaleString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

const formatHoraAR = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        hour: '2-digit',
        minute: '2-digit',
    });

const PODIO_COLORS = ['#F59E0B', '#94A3B8', '#D97706'];

const TriviaPlanilla: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const { id }   = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [juego, setJuego]         = useState<TriviaJuego | null>(null);
    const [jugadores, setJugadores] = useState<TriviaJugador[]>([]);
    const [loading, setLoading]     = useState(true);

    const [editando, setEditando]             = useState(false);
    const [tituloEdit, setTituloEdit]         = useState('');
    const [guardandoTitulo, setGuardandoTitulo] = useState(false);

    const [editandoJugadorId, setEditandoJugadorId] = useState<string | null>(null);
    const [nicknameEdit, setNicknameEdit]           = useState('');
    const [puntajeEdit, setPuntajeEdit]             = useState('');
    const [guardandoJugador, setGuardandoJugador]   = useState(false);
    const [eliminandoJugadorId, setEliminandoJugadorId] = useState<string | null>(null);

    const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
    const [eliminandoPlanilla, setEliminandoPlanilla]   = useState(false);
    const [cloningJuego, setCloningJuego]               = useState(false);

    const cargar = async () => {
        if (!id) return;
        const j = await supabaseService.getTriviaJuego(id);
        if (!j) { navigate('/trivia/historial'); return; }
        setJuego(j);
        setTituloEdit(j.titulo);
        const rank = await supabaseService.getTriviaRanking(id, 200);
        setJugadores(rank);
        setLoading(false);
    };

    useEffect(() => { cargar(); }, [id]);

    const handleGuardarTitulo = async () => {
        if (!juego || !tituloEdit.trim()) return;
        setGuardandoTitulo(true);
        const ok = await supabaseService.renombrarTriviaJuego(juego.id, tituloEdit);
        if (ok) {
            setJuego(j => j ? { ...j, titulo: tituloEdit.trim() } : j);
        }
        setGuardandoTitulo(false);
    };

    const iniciarEdicionJugador = (j: TriviaJugador) => {
        setEditandoJugadorId(j.id);
        setNicknameEdit(j.nickname);
        setPuntajeEdit(String(j.puntajeTotal));
    };

    const handleGuardarJugador = async (jugadorId: string) => {
        setGuardandoJugador(true);
        const ok = await supabaseService.editarTriviaJugador(jugadorId, {
            nickname: nicknameEdit,
            puntajeTotal: parseInt(puntajeEdit) || 0,
        });
        if (ok) {
            setJugadores(prev =>
                prev
                    .map(j => j.id === jugadorId
                        ? { ...j, nickname: nicknameEdit.trim(), puntajeTotal: parseInt(puntajeEdit) || 0 }
                        : j
                    )
                    .sort((a, b) => b.puntajeTotal - a.puntajeTotal)
            );
            setEditandoJugadorId(null);
        }
        setGuardandoJugador(false);
    };

    const handleEliminarJugador = async (jugadorId: string) => {
        if (!window.confirm('¿Eliminar a este jugador de la planilla?')) return;
        setEliminandoJugadorId(jugadorId);
        const ok = await supabaseService.eliminarTriviaJugador(jugadorId);
        if (ok) {
            setJugadores(prev => prev.filter(j => j.id !== jugadorId));
        }
        setEliminandoJugadorId(null);
    };

    const handleEliminarPlanilla = async () => {
        if (!juego) return;
        setEliminandoPlanilla(true);
        await supabaseService.eliminarTriviaJuego(juego.id);
        navigate('/trivia/historial');
    };

    if (loading) return (
        <div className="min-h-screen bg-white flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
    );

    if (!juego) return null;

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-3xl mx-auto px-4 md:px-8 py-10 md:py-14">

                {/* Header */}
                <div className="mb-8 pb-8 border-b border-gray-100">
                    <button
                        onClick={() => navigate('/trivia/historial')}
                        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-4 font-medium"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Historial
                    </button>

                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            {editando ? (
                                <div className="flex items-center gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={tituloEdit}
                                        onChange={e => setTituloEdit(e.target.value)}
                                        className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight border-b-2 border-gray-200 focus:border-gray-900 outline-none flex-1 min-w-0"
                                    />
                                    <button
                                        onClick={handleGuardarTitulo}
                                        disabled={guardandoTitulo}
                                        className="w-9 h-9 rounded-xl bg-gray-900 text-white flex items-center justify-center hover:bg-black transition-all disabled:opacity-50 shrink-0"
                                    >
                                        {guardandoTitulo
                                            ? <Loader2 className="w-4 h-4 animate-spin" />
                                            : <Check className="w-4 h-4" />
                                        }
                                    </button>
                                </div>
                            ) : (
                                <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight mb-2">
                                    {juego.titulo}
                                </h1>
                            )}
                            <p className="text-sm text-gray-400 font-normal">
                                {juego.startedAt
                                    ? `${formatFechaHoraAR(juego.startedAt)}${juego.finishedAt ? ` → ${formatHoraAR(juego.finishedAt)}` : ''} hs`
                                    : `${formatFechaHoraAR(juego.createdAt)} hs`
                                }
                            </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={async () => {
                                    if (!juego) return;
                                    setCloningJuego(true);
                                    const nuevoId = await supabaseService.reiniciarTriviaJuego(juego.id);
                                    setCloningJuego(false);
                                    if (nuevoId) navigate(`/trivia/admin/${nuevoId}`);
                                }}
                                disabled={cloningJuego}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-900 text-xs font-semibold transition-all disabled:opacity-40"
                            >
                                {cloningJuego
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <RotateCcw className="w-3.5 h-3.5" />
                                }
                                Volver a jugar
                            </button>
                            <button
                                onClick={() => setEditando(e => !e)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                                    editando
                                        ? 'bg-gray-900 text-white'
                                        : 'border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-900'
                                }`}
                            >
                                <Settings className="w-3.5 h-3.5" />
                                {editando ? 'Listo' : 'Editar'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Podio top 3 */}
                {jugadores.length > 0 && (
                    <div className="grid grid-cols-3 gap-3 mb-8">
                        {[1, 0, 2].map(pos => {
                            const j = jugadores[pos];
                            if (!j) return <div key={pos} />;
                            const heights = ['h-28', 'h-36', 'h-24'];
                            return (
                                <div
                                    key={j.id}
                                    className={`${heights[pos]} rounded-2xl flex flex-col items-center justify-end pb-3 gap-1 border ${
                                        pos === 0
                                            ? 'bg-amber-50/50 border-amber-100'
                                            : 'bg-gray-50 border-gray-100'
                                    }`}
                                >
                                    <Medal className="w-5 h-5" style={{ color: PODIO_COLORS[pos === 0 ? 0 : pos === 1 ? 2 : 1] }} />
                                    <span className="text-2xl">{j.avatarEmoji}</span>
                                    <p className="text-xs font-semibold text-gray-900 truncate px-2 max-w-full">
                                        {j.nickname}
                                    </p>
                                    <p className="text-sm font-bold text-gray-600 tabular-nums">
                                        {j.puntajeTotal}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Lista completa */}
                <div className="space-y-2 mb-8">
                    {jugadores.map((j, idx) => {
                        const enEdicion = editandoJugadorId === j.id;
                        return (
                            <div
                                key={j.id}
                                className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-gray-100 bg-white"
                            >
                                <span className="text-sm font-bold text-gray-300 tabular-nums w-6 text-center shrink-0">
                                    {idx + 1}
                                </span>
                                <span className="text-xl shrink-0">{j.avatarEmoji}</span>

                                {enEdicion ? (
                                    <>
                                        <input
                                            type="text"
                                            value={nicknameEdit}
                                            onChange={e => setNicknameEdit(e.target.value)}
                                            className="flex-1 h-9 px-2 rounded-lg border border-gray-200 text-sm font-medium focus:outline-none focus:border-gray-400"
                                        />
                                        <input
                                            type="number"
                                            value={puntajeEdit}
                                            onChange={e => setPuntajeEdit(e.target.value)}
                                            className="w-20 h-9 px-2 rounded-lg border border-gray-200 text-sm font-medium text-center focus:outline-none focus:border-gray-400"
                                        />
                                        <button
                                            onClick={() => handleGuardarJugador(j.id)}
                                            disabled={guardandoJugador}
                                            className="w-8 h-8 rounded-lg bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition-colors disabled:opacity-50 shrink-0"
                                        >
                                            {guardandoJugador
                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                : <Save className="w-3.5 h-3.5" />
                                            }
                                        </button>
                                        <button
                                            onClick={() => setEditandoJugadorId(null)}
                                            className="w-8 h-8 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <span className="flex-1 text-sm font-semibold text-gray-900 truncate">
                                            {j.nickname}
                                        </span>
                                        <span className="text-sm font-bold text-gray-700 tabular-nums">
                                            {j.puntajeTotal} pts
                                        </span>

                                        {editando && (
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    onClick={() => iniciarEdicionJugador(j)}
                                                    className="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 flex items-center justify-center transition-all"
                                                >
                                                    <Settings className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleEliminarJugador(j.id)}
                                                    disabled={eliminandoJugadorId === j.id}
                                                    className="w-8 h-8 rounded-lg text-red-400 hover:bg-red-50 flex items-center justify-center transition-all disabled:opacity-40"
                                                >
                                                    {eliminandoJugadorId === j.id
                                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        : <Trash2 className="w-3.5 h-3.5" />
                                                    }
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}

                    {jugadores.length === 0 && (
                        <p className="text-center text-sm text-gray-400 py-8">
                            Sin jugadores registrados en esta partida
                        </p>
                    )}
                </div>

                {/* Eliminar planilla completa — solo en modo edición */}
                {editando && (
                    <div className="pt-6 border-t border-gray-100">
                        {!confirmandoEliminar ? (
                            <button
                                onClick={() => setConfirmandoEliminar(true)}
                                className="w-full h-12 rounded-xl border border-red-200 text-red-500 font-semibold text-sm hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                Eliminar planilla completa
                            </button>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-sm text-red-500 text-center font-medium">
                                    Esto borra el juego, sus jugadores y respuestas. ¿Seguro?
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setConfirmandoEliminar(false)}
                                        className="flex-1 h-11 rounded-xl bg-gray-100 text-gray-600 font-semibold text-sm hover:bg-gray-200 transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleEliminarPlanilla}
                                        disabled={eliminandoPlanilla}
                                        className="flex-1 h-11 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                                    >
                                        {eliminandoPlanilla
                                            ? <Loader2 className="w-4 h-4 animate-spin" />
                                            : 'Sí, eliminar'
                                        }
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TriviaPlanilla;
