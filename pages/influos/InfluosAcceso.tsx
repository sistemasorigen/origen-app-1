import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../services/supabaseClient';
import { InfluosAttendee } from '../../types';
import {
    CheckCircle, XCircle, Loader2,
    Search, ArrowRight
} from 'lucide-react';

// --------------- ANIMATION STYLES ---------------
// Pattern from pages/infopoint/PublicHome.tsx — keyframes as inline <style>
const ANIMATION_STYLES = `
    @keyframes revealTitle {
        0%   { opacity: 0; transform: translateY(40px) scale(0.95); }
        60%  { opacity: 1; transform: translateY(-6px) scale(1.01); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes pulseGlow {
        0%, 100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0), 4px 4px 0px 0px rgba(0,0,0,1); }
        50% { box-shadow: 0 0 32px 8px rgba(139, 92, 246, 0.35), 4px 4px 0px 0px rgba(0,0,0,1); }
    }
    @keyframes floatY {
        0%, 100% { transform: translateY(0px); }
        50%       { transform: translateY(-12px); }
    }
    @keyframes shimmer {
        0%   { background-position: -200% center; }
        100% { background-position:  200% center; }
    }
    @keyframes bounceIn {
        0%   { opacity: 0; transform: scale(0.3); }
        50%  { opacity: 1; transform: scale(1.08); }
        70%  { transform: scale(0.96); }
        100% { transform: scale(1); }
    }

    @keyframes bounceDown {
        0%, 100% { transform: translateY(0px); opacity: 0.4; }
        50%       { transform: translateY(10px); opacity: 1; }
    }
    .anim-bounceDown-1 { animation: bounceDown 1.4s ease-in-out infinite; animation-delay: 0s; }
    .anim-bounceDown-2 { animation: bounceDown 1.4s ease-in-out infinite; animation-delay: 0.2s; }
    .anim-bounceDown-3 { animation: bounceDown 1.4s ease-in-out infinite; animation-delay: 0.4s; }
    @keyframes spinOnce {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
    }
    .anim-revealTitle {
        animation: revealTitle 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        opacity: 0;
    }
    .anim-floatY {
        animation: floatY 3s ease-in-out infinite;
    }
    .anim-pulseGlow {
        animation: pulseGlow 2.5s ease-in-out infinite;
    }
    .anim-bounceIn {
        animation: bounceIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    .anim-shimmer {
        background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255,255,255,0.4) 50%,
            transparent 100%
        );
        background-size: 200% auto;
        animation: shimmer 2.2s linear infinite;
    }
    .stagger-1 { animation-delay: 0.1s; }
    .stagger-2 { animation-delay: 0.22s; }
    .stagger-3 { animation-delay: 0.36s; }
    .stagger-4 { animation-delay: 0.5s; }
`;

// --------------- TRIBU THEMES ---------------
const TRIBU_THEMES: Record<string, {
    label: string; bg: string; accent: string;
    text: string; border: string; checkBg: string;
    glow: string;
}> = {
    'roja':     { label: 'Roja',     bg: 'bg-red-600',      accent: 'bg-red-700',      text: 'text-white', border: 'border-red-300',      checkBg: 'bg-red-700',      glow: 'rgba(239,68,68,0.5)' },
    'azul':     { label: 'Azul',     bg: 'bg-blue-600',     accent: 'bg-blue-700',     text: 'text-white', border: 'border-blue-300',     checkBg: 'bg-blue-700',     glow: 'rgba(59,130,246,0.5)' },
    'verde':    { label: 'Verde',    bg: 'bg-emerald-600',  accent: 'bg-emerald-700',  text: 'text-white', border: 'border-emerald-300',  checkBg: 'bg-emerald-700',  glow: 'rgba(16,185,129,0.5)' },
    'amarilla': { label: 'Amarilla', bg: 'bg-yellow-400',   accent: 'bg-yellow-500',   text: 'text-black', border: 'border-yellow-600',   checkBg: 'bg-yellow-500',   glow: 'rgba(234,179,8,0.5)' },
    'naranja':  { label: 'Naranja',  bg: 'bg-orange-500',   accent: 'bg-orange-600',   text: 'text-white', border: 'border-orange-300',   checkBg: 'bg-orange-600',   glow: 'rgba(249,115,22,0.5)' },
    'violeta':  { label: 'Violeta',  bg: 'bg-violet-600',   accent: 'bg-violet-700',   text: 'text-white', border: 'border-violet-300',   checkBg: 'bg-violet-700',   glow: 'rgba(139,92,246,0.5)' },
    'rosa':     { label: 'Rosa',     bg: 'bg-pink-500',     accent: 'bg-pink-600',     text: 'text-white', border: 'border-pink-300',     checkBg: 'bg-pink-600',     glow: 'rgba(236,72,153,0.5)' },
    'celeste':  { label: 'Celeste',  bg: 'bg-sky-400',      accent: 'bg-sky-500',      text: 'text-white', border: 'border-sky-200',      checkBg: 'bg-sky-500',      glow: 'rgba(14,165,233,0.5)' },
    'blanca':   { label: 'Blanca',   bg: 'bg-white',        accent: 'bg-neutral-100',  text: 'text-black', border: 'border-neutral-400',  checkBg: 'bg-neutral-200',  glow: 'rgba(200,200,200,0.5)' },
    'negra':    { label: 'Negra',    bg: 'bg-neutral-900',  accent: 'bg-black',        text: 'text-white', border: 'border-neutral-600',  checkBg: 'bg-black',        glow: 'rgba(30,30,30,0.7)' },
};

const DEFAULT_THEME = {
    label: '', bg: 'bg-violet-600',
    accent: 'bg-violet-700', text: 'text-white',
    border: 'border-violet-300', checkBg: 'bg-violet-700',
    glow: 'rgba(139,92,246,0.5)'
};

const getTribaTheme = (tribu?: string) => {
    if (!tribu) return DEFAULT_THEME;
    return TRIBU_THEMES[tribu.toLowerCase().trim()] ?? DEFAULT_THEME;
};

// --------------- COMPONENT ---------------
// NOTE: Anonymous access depends on SQL policy "influos_public_read".
// If the policy is not yet applied, the query will return empty and the user
// will see the 'notfound' screen. Run sql/influos_public_select_policy.sql first.

type Screen = 'landing' | 'search' | 'found' | 'notfound';

const InfluosAcceso: React.FC = () => {
    const navigate = useNavigate();

    const [screen, setScreen] = useState<Screen>('landing');
    const [searchFirstName, setSearchFirstName] = useState('');
    const [searchLastName, setSearchLastName] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [foundAttendee, setFoundAttendee] = useState<InfluosAttendee | null>(null);



    const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const firstName = searchFirstName.trim();
        const lastName = searchLastName.trim();
        if (!firstName || !lastName) return;

        setIsSearching(true);
        setSearchError(null);

        try {
            const { data, error } = await supabase
                .from('influos_attendees')
                .select('id, first_name, last_name, tribe, is_first_time')
                .ilike('first_name', `%${firstName}%`)
                .ilike('last_name', `%${lastName}%`)
                .limit(1);

            if (error) throw error;

            if (data && data.length > 0) {
                setFoundAttendee(data[0] as InfluosAttendee);
                setScreen('found');
            } else {
                setScreen('notfound');
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error al buscar.';
            setSearchError(msg);
        } finally {
            setIsSearching(false);
        }
    };

    const theme = getTribaTheme(foundAttendee?.tribe);

    return (
        <>
            <style>{ANIMATION_STYLES}</style>

            <AnimatePresence mode="wait">

                {/* ========== PANTALLA 1: LANDING ========== */}
                {screen === 'landing' && (
                    <motion.div
                        key="landing"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.35 }}
                        className="min-h-screen bg-black flex flex-col items-center justify-center p-6 overflow-hidden relative"
                    >
                        {/* Partículas decorativas de fondo */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full opacity-[0.07] bg-violet-500 blur-3xl anim-floatY stagger-1" />
                            <div className="absolute bottom-1/4 right-1/4 w-56 h-56 rounded-full opacity-[0.07] bg-pink-500 blur-3xl anim-floatY stagger-3" />
                            <div className="absolute top-3/4 left-1/3 w-40 h-40 rounded-full opacity-[0.05] bg-blue-500 blur-3xl anim-floatY stagger-2" />
                        </div>

                        {/* Logo */}
                        <motion.img
                            src="/origen-logo.png"
                            alt="Origen"
                            className="h-9 w-auto object-contain invert opacity-50 mb-12"
                            initial={{ opacity: 0, y: -16 }}
                            animate={{ opacity: 0.5, y: 0 }}
                            transition={{ delay: 0.15, duration: 0.5 }}
                        />

                        {/* BOTÓN GIGANTE CENTRAL */}
                        <motion.button
                            onClick={() => setScreen('search')}
                            initial={{ opacity: 0, scale: 0.85, y: 24 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{
                                delay: 0.3,
                                type: 'spring',
                                stiffness: 220,
                                damping: 20
                            }}
                            whileHover={{ scale: 1.03, y: -3 }}
                            whileTap={{ scale: 0.97 }}
                            className="relative w-full max-w-xs md:max-w-sm anim-pulseGlow border-[3px] border-white bg-black px-8 py-10 md:py-14 cursor-pointer group text-center"
                        >
                            {/* Shimmer sutil — solo en el borde superior */}
                            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

                            {/* Label superior */}
                            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-neutral-500 mb-3">
                                Influos 2026
                            </p>

                            {/* Texto principal */}
                            <h1 className="text-[2rem] md:text-[2.4rem] font-black uppercase tracking-tight text-white leading-[1.1] mb-6">
                                ¡Descubramos<br />
                                de qué Tribu<br />
                                sos!
                            </h1>

                            {/* Separador */}
                            <div className="w-12 h-[2px] bg-white/20 mx-auto mb-4" />

                            {/* CTA */}
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-[11px] font-black uppercase tracking-[0.25em] text-neutral-400 group-hover:text-white transition-colors duration-200">
                                    Tocá para descubrir
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-white group-hover:translate-x-1 transition-all duration-200" />
                            </div>
                        </motion.button>

                        <motion.p
                            className="mt-10 text-[9px] font-bold uppercase tracking-[0.35em] text-neutral-700"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8, duration: 0.4 }}
                        >
                            Powered by Sistema Origen
                        </motion.p>
                    </motion.div>
                )}

                {/* ========== PANTALLA 2: SEARCH ========== */}
                {screen === 'search' && (
                    <motion.div
                        key="search"
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -30 }}
                        transition={{
                            duration: 0.45,
                            type: 'spring',
                            stiffness: 260,
                            damping: 22
                        }}
                        className="min-h-screen bg-black flex flex-col items-center justify-center p-6"
                    >
                        {/* Partículas de fondo */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full opacity-[0.08] bg-violet-500 blur-3xl anim-floatY stagger-2" />
                            <div className="absolute bottom-1/3 right-1/4 w-40 h-40 rounded-full opacity-[0.08] bg-pink-500 blur-3xl anim-floatY stagger-4" />
                        </div>

                        <div className="relative z-10 w-full max-w-sm md:max-w-md flex flex-col gap-6">
                            {/* Logo */}
                            <motion.img
                                src="/origen-logo.png"
                                alt="Origen"
                                className="h-9 w-auto object-contain invert opacity-60 mx-auto"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 0.6, y: 0 }}
                                transition={{ delay: 0.1 }}
                            />

                            {/* Header */}
                            <motion.div
                                className="text-center"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 24 }}
                            >
                                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-neutral-500 mb-2">
                                    Influos 2026
                                </p>
                                <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-white leading-tight">
                                    ¡Ingresa tus<br />datos!
                                </h2>
                            </motion.div>

                            {/* Formulario */}
                            <motion.form
                                onSubmit={handleSearch}
                                className="flex flex-col gap-4"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.25, type: 'spring', stiffness: 280, damping: 22 }}
                            >
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Nombre..."
                                    value={searchFirstName}
                                    onChange={e => setSearchFirstName(e.target.value)}
                                    className="w-full px-5 py-4 text-lg font-bold bg-neutral-900 border-2 border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/30 transition-all duration-200"
                                />
                                <input
                                    type="text"
                                    placeholder="Apellido..."
                                    value={searchLastName}
                                    onChange={e => setSearchLastName(e.target.value)}
                                    className="w-full px-5 py-4 text-lg font-bold bg-neutral-900 border-2 border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/30 transition-all duration-200"
                                />

                                <motion.button
                                    type="submit"
                                    disabled={isSearching || !searchFirstName.trim() || !searchLastName.trim()}
                                    whileHover={{ scale: 1.02, y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="w-full py-5 font-black uppercase tracking-widest text-sm border-4 border-white bg-white text-black hover:bg-neutral-100 transition-all duration-200 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {isSearching ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Search className="w-5 h-5" />
                                    )}
                                    {isSearching ? 'Buscando...' : 'Descubrir mi tribu'}
                                </motion.button>
                            </motion.form>

                            {/* Error inline */}
                            {searchError && (
                                <motion.p
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-sm font-bold text-red-400 text-center border border-red-800/50 bg-red-950/40 px-4 py-3"
                                >
                                    {searchError}
                                </motion.p>
                            )}

                            {/* Volver */}
                            <motion.button
                                type="button"
                                onClick={() => setScreen('landing')}
                                className="text-xs font-bold uppercase tracking-widest text-neutral-600 hover:text-neutral-400 transition-colors mx-auto"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                            >
                                ← Volver
                            </motion.button>
                        </div>
                    </motion.div>
                )}

                {/* ========== PANTALLA 3: FOUND ========== */}
                {screen === 'found' && (
                    <motion.div
                        key="found"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`min-h-screen flex flex-col items-center justify-center p-6 text-center relative overflow-hidden ${theme.bg}`}
                    >
                        {/* Fondo con gradiente sutil */}
                        <div className="absolute inset-0 bg-black/10 pointer-events-none" />
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
                            <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-black/10 blur-3xl" />
                        </div>

                        <div className="relative z-10 flex flex-col items-center gap-3 w-full max-w-sm md:max-w-md">

                            {/* Nombre confirmado — pequeño, arriba */}
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className={`flex items-center gap-2 ${theme.text} opacity-70`}
                            >
                                <CheckCircle className="w-4 h-4" strokeWidth={2.5} />
                                <span className="text-xs font-black uppercase tracking-widest">
                                    {foundAttendee?.first_name} {foundAttendee?.last_name}
                                </span>
                            </motion.div>

                            {/* ¡Felicidades! */}
                            <motion.h1
                                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{ delay: 0.25, type: 'spring', stiffness: 260, damping: 18 }}
                                className={`text-5xl md:text-6xl font-black uppercase tracking-tight ${theme.text} leading-none`}
                            >
                                ¡Felicidades!
                            </motion.h1>

                            {/* ¡Tu tribu es: + COLOR DE TRIBU — solo si hay tribu asignada */}
                            {foundAttendee?.tribe ? (
                                <>
                                    <motion.p
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.42 }}
                                        className={`text-lg md:text-xl font-black uppercase tracking-widest ${theme.text} opacity-80`}
                                    >
                                        ¡Tu tribu es:
                                    </motion.p>

                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.6, y: 30 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        transition={{ delay: 0.58, type: 'spring', stiffness: 180, damping: 13 }}
                                        className={`w-full px-6 py-8 border-4 ${theme.border} ${theme.checkBg} shadow-[8px_8px_0px_0px_rgba(0,0,0,0.25)] text-center`}
                                    >
                                        <p className={`text-6xl md:text-8xl font-black uppercase tracking-tighter ${theme.text} leading-none`}>
                                            {TRIBU_THEMES[foundAttendee.tribe.toLowerCase().trim()]?.label ?? foundAttendee.tribe}
                                        </p>
                                    </motion.div>
                                </>
                            ) : (
                                <motion.p
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.42 }}
                                    className={`text-sm font-bold uppercase tracking-widest ${theme.text} opacity-60 text-center`}
                                >
                                    Tu tribu será revelada en breve.
                                </motion.p>
                            )}



                            {/* Botón ir al sistema */}
                            <motion.button
                                onClick={() => navigate('/auth')}
                                whileHover={{ scale: 1.03, y: -2 }}
                                whileTap={{ scale: 0.97 }}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.95 }}
                                className={`mt-4 w-full py-4 border-4 ${theme.border} font-black uppercase tracking-widest text-sm ${theme.text} hover:opacity-80 transition-opacity shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] flex items-center justify-center gap-3`}
                            >
                                Ingresar al sistema
                                <ArrowRight className="w-4 h-4 transition-transform" />
                            </motion.button>
                        </div>


                    </motion.div>
                )}

                {/* ========== PANTALLA 4: NOT FOUND ========== */}
                {screen === 'notfound' && (
                    <motion.div
                        key="notfound"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.35 }}
                        className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center"
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
                        >
                            <XCircle className="w-20 h-20 text-red-500 mx-auto mb-6" />
                        </motion.div>

                        <motion.h2
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-3xl font-black text-white uppercase tracking-tight mb-3"
                        >
                            No te encontramos
                        </motion.h2>

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="text-neutral-400 text-sm font-bold max-w-xs leading-relaxed mb-8"
                        >
                            Acercate a la mesa de registro para que te anotemos en la planilla.
                        </motion.p>

                        <motion.div
                            className="flex flex-col gap-3 w-full max-w-xs"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                        >
                            <button
                                onClick={() => setScreen('search')}
                                className="w-full px-6 py-4 border-2 border-white text-white font-black uppercase tracking-widest text-sm hover:bg-white hover:text-black transition-all duration-200"
                            >
                                Intentar de nuevo
                            </button>


                        </motion.div>
                    </motion.div>
                )}

            </AnimatePresence>
        </>
    );
};

export default InfluosAcceso;
