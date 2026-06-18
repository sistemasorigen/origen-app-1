import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabaseService } from '../../services/supabaseService';
import { Loader2 } from 'lucide-react';

const TriviaLanding: React.FC = () => {
    const navigate = useNavigate();
    const [pin, setPin]         = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState<string | null>(null);
    const inputs = useRef<(HTMLInputElement | null)[]>([]);

    const handleDigit = (idx: number, value: string) => {
        const digit = value.replace(/\D/g, '').slice(-1);
        const arr = Array.from({ length: 6 }, (_, i) => pin[i] || '');
        arr[idx] = digit;
        const newPin = arr.join('');
        setPin(newPin);
        setError(null);
        if (digit && idx < 5) inputs.current[idx + 1]?.focus();
    };

    const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace') {
            const arr = Array.from({ length: 6 }, (_, i) => pin[i] || '');
            if (!arr[idx] && idx > 0) {
                inputs.current[idx - 1]?.focus();
            }
            arr[idx] = '';
            setPin(arr.join(''));
        }
    };

    const handleSubmit = async () => {
        const cleanPin = pin.replace(/\s/g, '');
        if (cleanPin.length < 6) {
            setError('Ingresá los 6 dígitos del PIN.');
            return;
        }
        setLoading(true);
        setError(null);

        const juego = await supabaseService.getTriviaJuegoPorPin(cleanPin);

        if (!juego) {
            setError('PIN incorrecto. Revisá la pantalla grande.');
            setLoading(false);
            return;
        }
        if (juego.estado === 'finalizado') {
            setError('Este juego ya terminó.');
            setLoading(false);
            return;
        }
        if (juego.estado !== 'esperando') {
            setError('El juego ya empezó. No podés unirte.');
            setLoading(false);
            return;
        }

        navigate(`/trivia/unirse/${cleanPin}`);
    };

    const digits = Array.from({ length: 6 }, (_, i) => pin[i] || '');
    const pinCompleto = digits.filter(Boolean).length === 6;

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center px-4"
            style={{ background: '#1A0A2E' }}
        >
            {/* Brand */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center mb-12"
            >
                <p className="text-white/40 text-[11px] font-semibold uppercase tracking-[0.4em] mb-3">
                    Origen · Comunidad
                </p>
                <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-2">
                    Trivia Origen
                </h1>
                <p className="text-white/50 text-base font-medium">
                    Ingresá el PIN del juego
                </p>
            </motion.div>

            {/* Card del PIN */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="w-full max-w-sm"
            >
                {/* 6 inputs separados */}
                <div className="flex gap-3 justify-center mb-6">
                    {digits.map((d, i) => (
                        <input
                            key={i}
                            ref={el => { inputs.current[i] = el; }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={d}
                            onChange={e => handleDigit(i, e.target.value)}
                            onKeyDown={e => handleKeyDown(i, e)}
                            onFocus={e => e.target.select()}
                            className="w-12 h-16 rounded-xl bg-white/10 backdrop-blur-sm border-2 text-white text-2xl font-bold text-center focus:outline-none transition-all"
                            style={{
                                borderColor: d
                                    ? 'rgba(255,255,255,0.6)'
                                    : 'rgba(255,255,255,0.15)'
                            }}
                        />
                    ))}
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
                    onClick={handleSubmit}
                    disabled={loading || !pinCompleto}
                    className="w-full h-14 rounded-2xl bg-white text-[#1A0A2E] font-bold text-base hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loading
                        ? <Loader2 className="w-5 h-5 animate-spin" />
                        : 'Entrar al juego'
                    }
                </button>
            </motion.div>

            {/* Hint */}
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-white/25 text-xs font-medium text-center mt-10"
            >
                El PIN está en la pantalla grande del salón
            </motion.p>
        </div>
    );
};

export default TriviaLanding;
