import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseService } from '../../services/supabaseService';
import { User, TriviaJuego } from '../../types';
import {
    Trophy, Users, ChevronRight, Trash2,
    Loader2, Calendar, ArrowLeft, RotateCcw, Zap, Radio
} from 'lucide-react';

const ESTADO_EN_PROCESO_LABEL: Partial<Record<string, string>> = {
    esperando:       'Esperando jugadores',
    en_curso:        'En curso',
    entre_preguntas: 'Entre preguntas',
    finalizando:     'Mostrando podio',
};

const formatFechaAR = (iso: string) =>
    new Date(iso).toLocaleDateString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

const formatHoraAR = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        hour: '2-digit',
        minute: '2-digit',
    });

// Usa startedAt para agrupar; cae en createdAt si aún no tiene
const fechaRef = (j: TriviaJuego) => j.startedAt ?? j.createdAt;

const agruparPorFecha = (juegos: TriviaJuego[]) => {
    const grupos: Record<string, TriviaJuego[]> = {};
    for (const j of juegos) {
        const key = new Date(fechaRef(j))
            .toLocaleDateString('en-CA', {
                timeZone: 'America/Argentina/Buenos_Aires',
            });
        if (!grupos[key]) grupos[key] = [];
        grupos[key].push(j);
    }
    return Object.entries(grupos)
        .sort((a, b) => b[0].localeCompare(a[0]));
};

const TriviaHistorial: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const navigate = useNavigate();
    const [juegos, setJuegos]         = useState<TriviaJuego[]>([]);
    const [loading, setLoading]       = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [cloningId, setCloningId]   = useState<string | null>(null);

    useEffect(() => {
        supabaseService.getTriviaJuegos()
            .then(todos => setJuegos(todos.filter(j => !j.isTemplate)))
            .finally(() => setLoading(false));
    }, []);

    const handleEliminar = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!window.confirm(
            '¿Eliminar esta planilla? Esta acción no se puede deshacer.'
        )) return;
        setDeletingId(id);
        await supabaseService.eliminarTriviaJuego(id);
        setJuegos(j => j.filter(x => x.id !== id));
        setDeletingId(null);
    };

    const handleVolverAJugar = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setCloningId(id);
        const nuevoId = await supabaseService.reiniciarTriviaJuego(id);
        setCloningId(null);
        if (nuevoId) navigate(`/trivia/admin/${nuevoId}`);
    };

    const [terminandoId, setTerminandoId] = useState<string | null>(null);

    const handleTerminarJuego = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!window.confirm(
            'Esto termina el juego para todos los jugadores ' +
            'conectados ahora mismo y muestra el podio final. ' +
            '¿Continuar?'
        )) return;
        setTerminandoId(id);
        await supabaseService.avanzarTriviaJuego(id, 'finalizar');
        setJuegos(prev => prev.map(j =>
            j.id === id
                ? { ...j, estado: 'finalizado', finishedAt: new Date().toISOString() }
                : j
        ));
        setTerminandoId(null);
    };

    const handleEliminarEnProceso = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!window.confirm(
            'Este juego está EN CURSO. Eliminarlo desconecta ' +
            'a todos los jugadores ahora mismo y borra todo. ' +
            'Esta acción no se puede deshacer. ¿Seguro?'
        )) return;
        setDeletingId(id);
        await supabaseService.eliminarTriviaJuego(id);
        setJuegos(j => j.filter(x => x.id !== id));
        setDeletingId(null);
    };

    const juegoEnProceso = juegos.filter(j => j.estado !== 'finalizado');
    const juegoFinalizados = juegos.filter(j => j.estado === 'finalizado');
    const grupos = agruparPorFecha(juegoFinalizados);

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-4xl mx-auto px-4 md:px-8 py-10 md:py-14">

                {/* Header */}
                <div className="mb-8 pb-8 border-b border-gray-100">
                    <button
                        onClick={() => navigate('/trivia/admin')}
                        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-4 font-medium"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Mis juegos
                    </button>
                    <p className="text-[11px] font-medium tracking-wide text-gray-400 uppercase mb-2">
                        Trivia Origen
                    </p>
                    <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 tracking-tight">
                        Historial de partidas
                    </h1>
                </div>

                {loading && (
                    <div className="flex justify-center py-16">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                    </div>
                )}

                {!loading && juegos.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
                            <Trophy className="w-6 h-6 text-gray-300" />
                        </div>
                        <p className="text-sm font-medium text-gray-400">
                            Todavía no hay partidas registradas
                        </p>
                    </div>
                )}

                {/* En proceso */}
                {!loading && juegoEnProceso.length > 0 && (
                    <div className="mb-10">
                        <div className="flex items-center gap-2 mb-4">
                            <Radio className="w-3.5 h-3.5 text-green-500" />
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-green-600">
                                En proceso
                            </p>
                        </div>
                        <div className="space-y-2">
                            {juegoEnProceso.map(juego => (
                                <div
                                    key={juego.id}
                                    className="bg-green-50/50 rounded-2xl border border-green-100 p-5 flex flex-col md:flex-row md:items-center gap-4"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                                            <h3 className="font-semibold text-gray-900 text-base truncate">
                                                {juego.titulo}
                                            </h3>
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">
                                                <Zap className="w-3 h-3" />
                                                {ESTADO_EN_PROCESO_LABEL[juego.estado] ?? juego.estado}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-gray-500 font-medium">
                                            <span className="font-mono font-bold text-gray-700 bg-white border border-gray-200 px-2 py-0.5 rounded-lg">
                                                {juego.pin}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Users className="w-3.5 h-3.5" />
                                                {juego.totalJugadores ?? 0} jugadores
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => navigate(`/trivia/admin/${juego.id}`)}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-all"
                                        >
                                            <Zap className="w-3.5 h-3.5" />
                                            Volver a sala
                                        </button>
                                        <button
                                            onClick={e => handleTerminarJuego(e, juego.id)}
                                            disabled={terminandoId === juego.id}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-orange-200 bg-white text-orange-600 text-xs font-semibold hover:border-orange-300 hover:bg-orange-50 transition-all disabled:opacity-40"
                                        >
                                            {terminandoId === juego.id
                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                : <Trophy className="w-3.5 h-3.5" />
                                            }
                                            Frenar
                                        </button>
                                        <button
                                            onClick={e => handleEliminarEnProceso(e, juego.id)}
                                            disabled={deletingId === juego.id}
                                            className="w-9 h-9 rounded-xl border border-gray-200 text-red-400 flex items-center justify-center hover:border-red-300 hover:bg-red-50 transition-all disabled:opacity-40 shrink-0"
                                            title="Eliminar juego en curso"
                                        >
                                            {deletingId === juego.id
                                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                                : <Trash2 className="w-4 h-4" />
                                            }
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Finalizadas agrupadas por fecha */}
                {!loading && grupos.length > 0 && (
                    <div className="space-y-10">
                        {grupos.map(([fecha, items]) => (
                            <div key={fecha}>
                                <div className="flex items-center gap-2 mb-4">
                                    <Calendar className="w-3.5 h-3.5 text-gray-300" />
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                        {formatFechaAR(items[0].startedAt ?? items[0].createdAt)}
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    {items.map(juego => (
                                        <div
                                            key={juego.id}
                                            onClick={() => navigate(`/trivia/historial/${juego.id}`)}
                                            className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-5 flex flex-col md:flex-row md:items-center gap-4 cursor-pointer hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-[2px] transition-all duration-200"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-gray-900 text-base truncate mb-1">
                                                    {juego.titulo}
                                                </h3>
                                                <div className="flex items-center gap-4 text-xs text-gray-400 font-medium">
                                                    <span>
                                                        {juego.startedAt
                                                            ? `${formatHoraAR(juego.startedAt)}${juego.finishedAt ? ` → ${formatHoraAR(juego.finishedAt)}` : ''} hs`
                                                            : `${formatHoraAR(juego.createdAt)} hs`
                                                        }
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Users className="w-3.5 h-3.5" />
                                                        {juego.totalJugadores ?? 0} jugadores
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    onClick={e => handleVolverAJugar(e, juego.id)}
                                                    disabled={cloningId === juego.id}
                                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:border-gray-400 hover:text-gray-900 transition-all disabled:opacity-40"
                                                >
                                                    {cloningId === juego.id
                                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        : <RotateCcw className="w-3.5 h-3.5" />
                                                    }
                                                    Volver a jugar
                                                </button>
                                                <button
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        navigate(`/trivia/historial/${juego.id}`);
                                                    }}
                                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-black transition-all"
                                                >
                                                    Ver planilla
                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={e => handleEliminar(e, juego.id)}
                                                    disabled={deletingId === juego.id}
                                                    className="w-9 h-9 rounded-xl border border-gray-200 text-red-400 flex items-center justify-center hover:border-red-300 hover:bg-red-50 transition-all disabled:opacity-40"
                                                    title="Eliminar planilla"
                                                >
                                                    {deletingId === juego.id
                                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                                        : <Trash2 className="w-4 h-4" />
                                                    }
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TriviaHistorial;
