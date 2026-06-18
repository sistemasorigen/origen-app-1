import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseService } from '../../services/supabaseService';
import { User, TriviaJuego, TriviaEstadoJuego } from '../../types';
import {
    Plus, Trash2, Edit2, Play,
    Loader2, Trophy, Users, Clock,
    CheckCircle, Circle, Zap
} from 'lucide-react';

const ESTADO_CONFIG: Record<TriviaEstadoJuego, {
    label: string;
    color: string;
    bg: string;
    icon: React.ReactNode;
}> = {
    esperando:       { label: 'Esperando',   color: 'text-blue-600',   bg: 'bg-blue-50',   icon: <Clock className="w-3 h-3" /> },
    en_curso:        { label: 'En curso',    color: 'text-green-600',  bg: 'bg-green-50',  icon: <Zap className="w-3 h-3" /> },
    entre_preguntas: { label: 'En pausa',    color: 'text-amber-600',  bg: 'bg-amber-50',  icon: <Circle className="w-3 h-3" /> },
    finalizando:     { label: 'Finalizando', color: 'text-purple-600', bg: 'bg-purple-50', icon: <Trophy className="w-3 h-3" /> },
    finalizado:      { label: 'Finalizado',  color: 'text-gray-400',   bg: 'bg-gray-50',   icon: <CheckCircle className="w-3 h-3" /> },
};

const AdminTrivia: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const navigate = useNavigate();
    const [juegos, setJuegos]         = useState<TriviaJuego[]>([]);
    const [loading, setLoading]       = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        supabaseService.getTriviaJuegos()
            .then(setJuegos)
            .finally(() => setLoading(false));
    }, []);

    const handleEliminar = async (id: string) => {
        if (!window.confirm(
            '¿Eliminar este juego? Se eliminarán todas las preguntas y respuestas.'
        )) return;
        setDeletingId(id);
        await supabaseService.eliminarTriviaJuego(id);
        setJuegos(j => j.filter(x => x.id !== id));
        setDeletingId(null);
    };

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-4xl mx-auto px-4 md:px-8 py-10 md:py-14">

                {/* Header */}
                <div className="mb-8 pb-8 border-b border-gray-100">
                    <p className="text-[11px] font-medium tracking-wide text-gray-400 uppercase mb-2">
                        Trivia Origen · Admin
                    </p>
                    <div className="flex items-center justify-between gap-4">
                        <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 tracking-tight">
                            Mis juegos
                        </h1>
                        <button
                            onClick={() => navigate('/trivia/admin/nuevo')}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-black active:scale-[0.98] transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            Nuevo juego
                        </button>
                    </div>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="flex justify-center py-16">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                    </div>
                )}

                {/* Vacío */}
                {!loading && juegos.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
                            <Trophy className="w-6 h-6 text-gray-300" />
                        </div>
                        <p className="text-sm font-medium text-gray-400 mb-4">
                            Todavía no creaste ningún juego
                        </p>
                        <button
                            onClick={() => navigate('/trivia/admin/nuevo')}
                            className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-black transition-all"
                        >
                            Crear mi primer juego
                        </button>
                    </div>
                )}

                {/* Lista */}
                {!loading && juegos.length > 0 && (
                    <div className="space-y-3">
                        {juegos.map(juego => {
                            const cfg = ESTADO_CONFIG[juego.estado];
                            return (
                                <div
                                    key={juego.id}
                                    className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-5 flex flex-col md:flex-row md:items-center gap-4"
                                >
                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                                            <h3 className="font-semibold text-gray-900 text-base truncate">
                                                {juego.titulo}
                                            </h3>
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.color}`}>
                                                {cfg.icon}
                                                {cfg.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-gray-400 font-medium">
                                            <span className="font-mono font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-lg">
                                                {juego.pin}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Users className="w-3.5 h-3.5" />
                                                {juego.totalJugadores ?? 0}
                                            </span>
                                            <span>
                                                {new Date(juego.createdAt).toLocaleDateString('es-AR', {
                                                    day: 'numeric',
                                                    month: 'short'
                                                })}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Acciones */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => navigate(`/trivia/admin/${juego.id}`)}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-black transition-all"
                                        >
                                            <Play className="w-3.5 h-3.5" />
                                            Controlar
                                        </button>
                                        <button
                                            onClick={() => navigate(`/trivia/admin/nuevo?edit=${juego.id}`)}
                                            className="w-9 h-9 rounded-xl border border-gray-200 text-gray-400 flex items-center justify-center hover:border-gray-400 hover:text-gray-700 transition-all"
                                            title="Editar preguntas"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleEliminar(juego.id)}
                                            disabled={deletingId === juego.id}
                                            className="w-9 h-9 rounded-xl border border-gray-200 text-red-400 flex items-center justify-center hover:border-red-300 hover:bg-red-50 transition-all disabled:opacity-40"
                                            title="Eliminar"
                                        >
                                            {deletingId === juego.id
                                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                                : <Trash2 className="w-4 h-4" />
                                            }
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminTrivia;
