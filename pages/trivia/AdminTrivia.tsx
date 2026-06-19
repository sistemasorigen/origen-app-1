import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseService } from '../../services/supabaseService';
import { User, TriviaJuego } from '../../types';
import {
    Plus, Trash2, Edit2, Play,
    Loader2, Trophy, Users, History
} from 'lucide-react';

const AdminTrivia: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const navigate = useNavigate();
    const [juegos, setJuegos]         = useState<TriviaJuego[]>([]);
    const [loading, setLoading]       = useState(true);
    const [deletingId,   setDeletingId]   = useState<string | null>(null);
    const [creandoSalaId, setCreandoSalaId] = useState<string | null>(null);

    useEffect(() => {
        supabaseService.getTriviaJuegos()
            .then(todos => setJuegos(todos.filter(j => j.isTemplate)))
            .finally(() => setLoading(false));
    }, []);

    const handleCrearSala = async (id: string) => {
        setCreandoSalaId(id);
        const nuevoId = await supabaseService.clonarTriviaJuego(id);
        setCreandoSalaId(null);
        if (nuevoId) navigate(`/trivia/admin/${nuevoId}`);
    };

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
                        Kahoot Origen · Admin
                    </p>
                    <div className="flex items-center justify-between gap-4">
                        <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 tracking-tight">
                            Mis juegos
                        </h1>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => navigate('/trivia/historial')}
                                className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:border-gray-400 hover:text-gray-900 transition-all"
                            >
                                <History className="w-4 h-4" />
                                Historial
                            </button>
                            <button
                                onClick={() => navigate('/trivia/admin/nuevo')}
                                className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-black active:scale-[0.98] transition-all"
                            >
                                <Plus className="w-4 h-4" />
                                Nuevo juego
                            </button>
                        </div>
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
                        {juegos.map(juego => (
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
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-gray-400 font-medium">
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
                                            onClick={() => handleCrearSala(juego.id)}
                                            disabled={creandoSalaId === juego.id}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-black transition-all disabled:opacity-50"
                                        >
                                            {creandoSalaId === juego.id
                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                : <Play className="w-3.5 h-3.5" />
                                            }
                                            Crear sala
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
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminTrivia;
