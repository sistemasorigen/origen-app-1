import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabaseService } from '../../services/supabaseService';
import { TriviaJuego } from '../../types';
import { Loader2 } from 'lucide-react';

const AVATARES = [
    '😀','😎','🤩','🦁','🐯','🐻','🦊','🐼',
    '🐸','🦄','🐲','🤖','👻','🎃','⚡','🔥',
    '🌟','🎯','🏆','💎','🎸','⚽','🏀','🎮',
];

const TriviaUnirse: React.FC = () => {
    const { pin }  = useParams<{ pin: string }>();
    const navigate = useNavigate();

    const [juego, setJuego]       = useState<TriviaJuego | null>(null);
    const [loading, setLoading]   = useState(true);
    const [nickname, setNickname] = useState('');
    const [avatar, setAvatar]     = useState('😀');
    const [joining, setJoining]   = useState(false);
    const [error, setError]       = useState<string | null>(null);

    useEffect(() => {
        if (!pin) { navigate('/trivia'); return; }

        supabaseService.getTriviaJuegoPorPin(pin)
            .then(j => {
                // Solo redirigir si el juego ya terminó por completo
                if (!j || j.estado === 'finalizado' || j.estado === 'finalizando') {
                    navigate('/trivia');
                    return;
                }
                setJuego(j);
            })
            .finally(() => setLoading(false));
    }, [pin]);

    const handleEntrar = async () => {
        if (!nickname.trim()) {
            setError('Elegí un nickname para jugar.');
            return;
        }
        if (nickname.trim().length < 2) {
            setError('El nickname debe tener al menos 2 caracteres.');
            return;
        }
        if (!juego) return;

        setJoining(true);
        setError(null);

        const result = await supabaseService.unirseTrivia(
            juego.id,
            nickname.trim(),
            avatar
        );

        if (!result.success || !result.jugador) {
            setError(result.error || 'No se pudo unir al juego.');
            setJoining(false);
            return;
        }

        sessionStorage.setItem(`trivia_jugador_${pin}`, result.jugador.id);
        navigate(`/trivia/jugar/${pin}`);
    };

    if (loading) return (
        <div
            className="min-h-screen flex items-center justify-center"
            style={{ background: '#1A0A2E' }}
        >
            <Loader2 className="w-8 h-8 animate-spin text-white/40" />
        </div>
    );

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
            style={{ background: '#1A0A2E' }}
        >
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-sm"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <p className="text-white/40 text-[11px] font-semibold uppercase tracking-[0.4em] mb-2">
                        PIN {pin}
                    </p>
                    <h2 className="text-2xl font-bold text-white tracking-tight mb-1">
                        {juego?.titulo}
                    </h2>
                    <p className="text-white/50 text-sm font-medium">
                        Elegí tu nickname y avatar
                    </p>
                </div>

                {/* Aviso si el juego ya empezó */}
                {juego && juego.estado !== 'esperando' && (
                    <div
                        className="mb-6 px-4 py-3 rounded-2xl text-center"
                        style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}
                    >
                        <p className="text-amber-300 text-sm font-semibold">
                            ⚡ El juego ya empezó
                        </p>
                        <p className="text-amber-300/70 text-xs mt-0.5">
                            Las preguntas anteriores cuentan como incorrectas
                        </p>
                    </div>
                )}

                {/* Avatar grande */}
                <div className="flex justify-center mb-4">
                    <motion.div
                        key={avatar}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center text-5xl"
                    >
                        {avatar}
                    </motion.div>
                </div>

                {/* Grid de emojis */}
                <div className="grid grid-cols-8 gap-2 mb-6">
                    {AVATARES.map(emoji => (
                        <button
                            key={emoji}
                            type="button"
                            onClick={() => setAvatar(emoji)}
                            className={`w-full aspect-square rounded-xl text-xl flex items-center justify-center transition-all active:scale-95 ${
                                avatar === emoji
                                    ? 'bg-white/25 ring-2 ring-white/60 scale-110'
                                    : 'bg-white/10 hover:bg-white/20'
                            }`}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>

                {/* Input nickname */}
                <div className="mb-4">
                    <input
                        type="text"
                        placeholder="Tu nickname..."
                        value={nickname}
                        maxLength={20}
                        onChange={e => { setNickname(e.target.value); setError(null); }}
                        onKeyDown={e => { if (e.key === 'Enter') handleEntrar(); }}
                        className="w-full h-14 px-5 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 text-white text-lg font-semibold placeholder:text-white/30 focus:outline-none focus:border-white/60 focus:bg-white/15 transition-all text-center"
                    />
                </div>

                {/* Error */}
                {error && (
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-red-400 text-sm font-medium text-center mb-4"
                    >
                        {error}
                    </motion.p>
                )}

                {/* Botón */}
                <button
                    type="button"
                    onClick={handleEntrar}
                    disabled={joining || !nickname.trim()}
                    className="w-full h-14 rounded-2xl bg-white text-[#1A0A2E] font-bold text-base hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {joining
                        ? <Loader2 className="w-5 h-5 animate-spin" />
                        : <>{avatar} ¡Entrar!</>
                    }
                </button>
            </motion.div>
        </div>
    );
};

export default TriviaUnirse;
