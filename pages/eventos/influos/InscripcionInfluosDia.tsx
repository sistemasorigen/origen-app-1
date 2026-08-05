import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { checkInfluosNameExists, registerInfluosDia, supabaseService } from '../../../services/supabaseService';
import { InfluosDiaTribu } from '../../../types';
import { ArrowLeft, Check, Loader2, AlertCircle, Pencil, CheckCircle } from 'lucide-react';

// --------------- ANIMATION STYLES ---------------
// Mismos keyframes que pages/influos/InfluosAcceso.tsx — las dos
// pantallas conviven en el mismo evento, así que comparten el
// vocabulario de movimiento.
const ANIMATION_STYLES = `
    @keyframes floatY {
        0%, 100% { transform: translateY(0px); }
        50%       { transform: translateY(-12px); }
    }
    .anim-floatY {
        animation: floatY 3s ease-in-out infinite;
    }
    .stagger-1 { animation-delay: 0.1s; }
    .stagger-2 { animation-delay: 0.22s; }
    .stagger-3 { animation-delay: 0.36s; }
    .stagger-4 { animation-delay: 0.5s; }

    @media (prefers-reduced-motion: reduce) {
        .anim-floatY { animation: none; }
    }

    /* index.html define overrides globales con !important que fuerzan
       TODOS los inputs a fondo blanco / texto negro. Sobre el fondo
       negro de esta pantalla eso rompe la composición.
       El selector global encadena 9 :not([type=...]) — especificidad
       (0,9,1) — así que para revertirlo hay que igualar esa cadena y
       sumarle scope. La clase va repetida a propósito: sube la
       especificidad a (0,11,1) y así gana también contra la variante
       ".dark input..." sin depender del orden de los tags style. */
    .influos-dia-form.influos-dia-form input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"]):not([type="color"]):not([type="image"]) {
        background-color: #171717 !important;
        color: #ffffff !important;
        border: 2px solid #404040 !important;
        border-radius: 0 !important;
    }
    .influos-dia-form.influos-dia-form input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"]):not([type="color"]):not([type="image"]):focus {
        border-color: #a78bfa !important;
        outline: 2px solid transparent !important;
        outline-offset: 2px;
        box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.3) !important;
    }
    .influos-dia-form.influos-dia-form input::placeholder {
        color: #737373 !important;
    }
`;

// --------------- TRIBU THEMES ---------------
// Garra y Trueno replican exactamente las entradas de TRIBU_THEMES
// en InfluosAcceso.tsx; "No tengo" usa el DEFAULT_THEME violeta de
// ese mismo archivo.
const TRIBU_THEMES: Record<InfluosDiaTribu, {
    bg: string; text: string; border: string;
    checkBg: string; glow: string;
}> = {
    'Garra':     { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-300', checkBg: 'bg-orange-600', glow: 'rgba(249,115,22,0.5)' },
    'Trueno':    { bg: 'bg-sky-400',    text: 'text-white', border: 'border-sky-200',    checkBg: 'bg-sky-500',    glow: 'rgba(14,165,233,0.5)' },
    'No tengo':  { bg: 'bg-violet-600', text: 'text-white', border: 'border-violet-300', checkBg: 'bg-violet-700', glow: 'rgba(139,92,246,0.5)' },
};

const TRIBUS: InfluosDiaTribu[] = ['Garra', 'Trueno', 'No tengo'];

const STEP_LABELS = ['Datos', 'Tribu', 'Comprobante', 'Confirmar'];

// Tres barras finas que se van llenando. Reemplaza los cuadrados
// con borde negro del sistema neo-brutalist — sobre fondo negro
// eso no se lee, y el progreso es un dato secundario que no debe
// competir con el color de la tribu.
const StepIndicator: React.FC<{ current: number }> = ({ current }) => (
    <div className="flex items-center gap-2 mb-8" role="list" aria-label="Progreso de la inscripción">
        {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const reached = n <= current;
            return (
                <div key={label} className="flex-1" role="listitem" aria-current={n === current ? 'step' : undefined}>
                    <div className={`h-[3px] w-full transition-colors duration-300 ${reached ? 'bg-white' : 'bg-neutral-800'}`} />
                    <span className={`mt-2 block text-[9px] font-black uppercase tracking-[0.2em] transition-colors duration-300 ${reached ? 'text-neutral-300' : 'text-neutral-700'}`}>
                        {label}
                    </span>
                </div>
            );
        })}
    </div>
);

// Esferas borrosas de fondo — la atmósfera de /influos-acceso.
const Ambience: React.FC = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full opacity-[0.07] bg-violet-500 blur-3xl anim-floatY stagger-1" />
        <div className="absolute bottom-1/4 right-1/4 w-56 h-56 rounded-full opacity-[0.07] bg-orange-500 blur-3xl anim-floatY stagger-3" />
        <div className="absolute top-3/4 left-1/3 w-40 h-40 rounded-full opacity-[0.05] bg-sky-500 blur-3xl anim-floatY stagger-2" />
    </div>
);

const inputClass = 'w-full px-5 py-4 text-lg font-bold bg-neutral-900 border-2 border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/30 transition-all duration-200';
const labelClass = 'block text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500 mb-2';
const primaryBtn = 'w-full py-5 font-black uppercase tracking-widest text-sm border-4 border-white bg-white text-black hover:bg-neutral-100 transition-all duration-200 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black';
const secondaryBtn = 'py-5 px-6 font-black uppercase tracking-widest text-sm border-2 border-white/30 bg-black text-white hover:bg-white hover:text-black hover:border-white transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black';

const InscripcionInfluosDia: React.FC = () => {
    const navigate = useNavigate();
    const shouldReduceMotion = useReducedMotion();
    const [step, setStep] = useState(1);

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [age, setAge] = useState('');
    const [duplicateWarning, setDuplicateWarning] = useState(false);
    const [checkingDuplicate, setCheckingDuplicate] = useState(false);

    const [tribu, setTribu] = useState<InfluosDiaTribu | null>(null);

    const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null);
    const [uploadingComprobante, setUploadingComprobante] = useState(false);
    const [comprobanteError, setComprobanteError] = useState<string | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    // Cada paso entra deslizándose desde la derecha y, al salir, sigue
    // desplazándose hacia la izquierda — la sensación es de avanzar
    // en una cinta continua, no de pantallas que aparecen/desaparecen.
    // Tipado explícito: las dos ramas del ternario deben tener la
    // MISMA forma (mismas keys), si no TS infiere una unión que
    // choca con los tipos estrictos de HTMLMotionProps.
    type StepMotionProps = {
        initial: { opacity: number; x: number };
        animate: { opacity: number; x: number };
        exit: { opacity: number; x: number };
        transition: { duration: number; ease: [number, number, number, number] };
    };
    const EASE_OUT: [number, number, number, number] = [0.4, 0, 0.2, 1];
    const stepTransition: StepMotionProps = shouldReduceMotion
        ? { initial: { opacity: 0, x: 0 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 0 }, transition: { duration: 0.15, ease: EASE_OUT } }
        : { initial: { opacity: 0, x: 48 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -48 }, transition: { duration: 0.3, ease: EASE_OUT } };

    const handleLastNameBlur = async () => {
        if (!firstName.trim() || !lastName.trim()) return;
        setCheckingDuplicate(true);
        const exists = await checkInfluosNameExists(firstName.trim(), lastName.trim());
        setCheckingDuplicate(false);
        setDuplicateWarning(exists);
    };

    const canAdvanceStep1 = firstName.trim() && lastName.trim() && age.trim() && Number(age) > 0 && Number(age) < 100;

    const handleComprobanteChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setComprobanteError(null);
        setUploadingComprobante(true);

        try {
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const url = await supabaseService.uploadBase64Image(base64, 'influos-comprobantes');
            setComprobanteUrl(url);
        } catch (err) {
            console.error('[Comprobante] Error al subir:', err);
            setComprobanteError('No pudimos subir el comprobante. Probá de nuevo.');
        } finally {
            setUploadingComprobante(false);
        }
    };

    const canAdvanceStep3 = !!comprobanteUrl && !uploadingComprobante;

    const handleSubmit = async () => {
        if (!tribu) return;
        setIsSubmitting(true);
        setSubmitError(null);

        const id = await registerInfluosDia(firstName.trim(), lastName.trim(), Number(age), tribu, comprobanteUrl || undefined);

        setIsSubmitting(false);

        if (id) {
            setDone(true);
            return;
        }

        setSubmitError('Hubo un error al enviar la inscripción. Probá de nuevo en un momento.');
    };

    // ========== PANTALLA FINAL: REVELACIÓN DE TRIBU ==========
    // Full-bleed con el color de la tribu elegida — el mismo remate
    // que la pantalla "found" de /influos-acceso, para que quien ya
    // pasó por ahí reconozca de inmediato que es el mismo evento.
    if (done && tribu) {
        const theme = TRIBU_THEMES[tribu];
        const sinTribu = tribu === 'No tengo';

        return (
            <>
                <style>{ANIMATION_STYLES}</style>
                <div className={`w-full min-h-screen flex flex-col items-center justify-center p-6 text-center relative overflow-hidden ${theme.bg}`}>
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
                                {firstName} {lastName}
                            </span>
                        </motion.div>

                        <motion.h1
                            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ delay: 0.25, type: 'spring', stiffness: 260, damping: 18 }}
                            className={`text-5xl md:text-6xl font-black uppercase tracking-tight ${theme.text} leading-none`}
                        >
                            ¡Anotado!
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.42 }}
                            className={`text-lg md:text-xl font-black uppercase tracking-widest ${theme.text} opacity-80`}
                        >
                            {sinTribu ? 'Todavía sin tribu' : 'Tu tribu es:'}
                        </motion.p>

                        <motion.div
                            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ delay: 0.58, type: 'spring', stiffness: 180, damping: 13 }}
                            className={`w-full px-6 py-8 border-4 ${theme.border} ${theme.checkBg} shadow-[8px_8px_0px_0px_rgba(0,0,0,0.25)] text-center`}
                        >
                            <p className={`${sinTribu ? 'text-4xl md:text-5xl' : 'text-6xl md:text-8xl'} font-black uppercase tracking-tighter ${theme.text} leading-none`}>
                                {sinTribu ? 'Sin tribu' : tribu}
                            </p>
                        </motion.div>

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.75 }}
                            className={`text-sm font-bold ${theme.text} opacity-70 mt-2 leading-relaxed`}
                        >
                            {sinTribu
                                ? 'Te sumamos a una cuando llegues al evento.'
                                : '¡Te esperamos en Tribal Wars!'}
                        </motion.p>

                        <motion.button
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.9 }}
                            onClick={() => navigate('/tribal-wars/buscar')}
                            className={`mt-2 min-h-[44px] px-3 -mx-3 flex items-center justify-center text-xs font-black uppercase tracking-widest ${theme.text} opacity-70 hover:opacity-100 underline underline-offset-4 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white`}
                        >
                            Buscar mi inscripción
                        </motion.button>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <style>{ANIMATION_STYLES}</style>
            <div className="influos-dia-form w-full min-h-screen bg-black py-8 px-4 relative overflow-hidden">
                <Ambience />

                <div className="relative z-10 max-w-md mx-auto">
                    <button
                        onClick={() => navigate('/')}
                        className="min-h-[44px] px-3 -mx-3 -my-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600 hover:text-white transition-colors mb-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" /> Inicio
                    </button>

                    <div className="text-center mb-8">
                        <img src="/origen-logo.png" alt="Origen" className="h-8 w-auto object-contain invert opacity-50 mx-auto mb-6" />
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-neutral-500 mb-2">
                            Influos 2026
                        </p>
                        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-white leading-none">
                            Tribal Wars
                        </h1>
                    </div>

                    <StepIndicator current={step} />

                    <AnimatePresence mode="wait">

                        {/* PASO 1 — Datos */}
                        {step === 1 && (
                            <motion.form
                                key="step1" {...stepTransition} className="space-y-5"
                                onSubmit={e => { e.preventDefault(); if (canAdvanceStep1) setStep(2); }}
                            >
                                <h2 className="text-2xl font-black uppercase tracking-tight text-white leading-tight">
                                    ¡Ingresá tus datos!
                                </h2>

                                <div>
                                    <label htmlFor="inf-firstName" className={labelClass}>Nombre</label>
                                    <input
                                        id="inf-firstName" type="text" placeholder="Nombre..." autoComplete="given-name" required
                                        value={firstName}
                                        onChange={e => { setFirstName(e.target.value); setDuplicateWarning(false); }}
                                        className={inputClass}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="inf-lastName" className={labelClass}>Apellido</label>
                                    <input
                                        id="inf-lastName" type="text" placeholder="Apellido..." autoComplete="family-name" required
                                        value={lastName}
                                        onChange={e => { setLastName(e.target.value); setDuplicateWarning(false); }}
                                        onBlur={handleLastNameBlur}
                                        className={inputClass}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="inf-age" className={labelClass}>Edad</label>
                                    <input
                                        id="inf-age" type="number" placeholder="Edad..." inputMode="numeric" min="1" max="99" required
                                        value={age} onChange={e => setAge(e.target.value)}
                                        className={inputClass}
                                    />
                                </div>

                                {checkingDuplicate && (
                                    <p role="status" className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600">
                                        Verificando...
                                    </p>
                                )}
                                {duplicateWarning && (
                                    <motion.div
                                        role="status"
                                        initial={{ opacity: 0, y: -8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex items-start gap-3 border border-amber-500/40 bg-amber-950/40 px-4 py-3"
                                    >
                                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                        <p className="text-xs font-bold text-amber-200 leading-relaxed">
                                            Ya hay una inscripción con este nombre. Si sos vos, no hace falta anotarte de nuevo —
                                            si es otra persona con el mismo nombre, seguí adelante.
                                        </p>
                                    </motion.div>
                                )}

                                <motion.button
                                    type="submit"
                                    disabled={!canAdvanceStep1}
                                    whileHover={canAdvanceStep1 && !shouldReduceMotion ? { scale: 1.02, y: -2 } : undefined}
                                    whileTap={canAdvanceStep1 ? { scale: 0.98 } : undefined}
                                    className={primaryBtn}
                                >
                                    Continuar
                                </motion.button>
                            </motion.form>
                        )}

                        {/* PASO 2 — Tribu */}
                        {/* Cada botón lleva SU color real: la persona ve la
                            tribu antes de elegirla, no después de confirmar. */}
                        {step === 2 && (
                            <motion.div key="step2" {...stepTransition} className="space-y-5">
                                <h2 className="text-2xl font-black uppercase tracking-tight text-white leading-tight">
                                    ¿De qué tribu sos?
                                </h2>

                                <div className="space-y-3" role="radiogroup" aria-label="Tribu">
                                    {TRIBUS.map(t => {
                                        const theme = TRIBU_THEMES[t];
                                        const selected = tribu === t;
                                        return (
                                            <motion.button
                                                key={t}
                                                role="radio"
                                                aria-checked={selected}
                                                onClick={() => setTribu(t)}
                                                whileHover={shouldReduceMotion ? undefined : { scale: 1.02, y: -2 }}
                                                whileTap={{ scale: 0.98 }}
                                                style={selected ? { boxShadow: `0 0 32px 4px ${theme.glow}` } : undefined}
                                                className={`w-full px-6 py-6 border-4 ${theme.bg} ${theme.text} font-black uppercase tracking-tight text-2xl flex items-center justify-between transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black ${selected ? `${theme.border} shadow-[6px_6px_0px_0px_rgba(0,0,0,0.4)]` : 'border-transparent opacity-70 hover:opacity-100'}`}
                                            >
                                                {t}
                                                {selected && <Check className="w-7 h-7 shrink-0" strokeWidth={3.5} />}
                                            </motion.button>
                                        );
                                    })}
                                </div>

                                <div className="flex gap-3">
                                    <button onClick={() => setStep(1)} className={`flex-1 ${secondaryBtn}`}>
                                        Volver
                                    </button>
                                    <motion.button
                                        disabled={!tribu}
                                        onClick={() => setStep(3)}
                                        whileHover={tribu && !shouldReduceMotion ? { scale: 1.02, y: -2 } : undefined}
                                        whileTap={tribu ? { scale: 0.98 } : undefined}
                                        className={`flex-[2] ${primaryBtn}`}
                                    >
                                        Continuar
                                    </motion.button>
                                </div>
                            </motion.div>
                        )}

                        {/* PASO 3 — Comprobante */}
                        {step === 3 && (
                            <motion.div key="step3-comprobante" {...stepTransition} className="space-y-5">
                                <h2 className="text-2xl font-black uppercase tracking-tight text-white leading-tight">
                                    Tribal Wars
                                </h2>

                                <div className="border-2 border-neutral-800 bg-neutral-900/80 p-6 space-y-3">
                                    <p className="text-base font-black uppercase tracking-tight text-white">
                                        Sábado 15/08 de 8.30-11pm
                                    </p>
                                    <p className="text-sm font-bold text-neutral-300 leading-relaxed">
                                        Juegos inflables + guerra de tribus + comida y postre
                                    </p>
                                    <div className="pt-2 border-t border-neutral-800 space-y-1">
                                        <p className="text-lg font-black text-white">
                                            Entrada: $15.000
                                        </p>
                                        <p className="text-sm font-bold text-neutral-400">
                                            Alias de transferencia: <span className="text-violet-300">tribal.wars</span>
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <label className={labelClass}>Comprobante de transferencia</label>
                                    <label
                                        htmlFor="inf-comprobante"
                                        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed px-6 py-8 cursor-pointer transition-colors ${comprobanteUrl ? 'border-emerald-500 bg-emerald-950/20' : 'border-neutral-700 bg-neutral-900/60 hover:border-violet-400'}`}
                                    >
                                        {uploadingComprobante ? (
                                            <>
                                                <Loader2 className="w-6 h-6 text-neutral-400 animate-spin" />
                                                <span className="text-xs font-black uppercase tracking-widest text-neutral-400">Subiendo...</span>
                                            </>
                                        ) : comprobanteUrl ? (
                                            <>
                                                <img src={comprobanteUrl} alt="Comprobante" className="max-h-40 object-contain mb-2" />
                                                <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-emerald-400">
                                                    <Check className="w-3.5 h-3.5" /> Comprobante subido
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-xs font-black uppercase tracking-widest text-neutral-400">Tocá para subir tu comprobante</span>
                                                <span className="text-[10px] text-neutral-600">JPG o PNG</span>
                                            </>
                                        )}
                                        <input
                                            id="inf-comprobante" type="file" accept="image/*" className="hidden"
                                            onChange={handleComprobanteChange}
                                        />
                                    </label>
                                    {comprobanteError && (
                                        <p className="text-xs font-bold text-red-400 mt-2">{comprobanteError}</p>
                                    )}
                                    {!comprobanteUrl && !uploadingComprobante && (
                                        <p className="text-[10px] text-neutral-600 mt-2">
                                            No podés continuar sin adjuntar el comprobante.
                                        </p>
                                    )}
                                </div>

                                <div className="flex gap-3">
                                    <button onClick={() => setStep(2)} className={`flex-1 ${secondaryBtn}`}>
                                        Volver
                                    </button>
                                    <motion.button
                                        disabled={!canAdvanceStep3}
                                        onClick={() => setStep(4)}
                                        whileHover={canAdvanceStep3 && !shouldReduceMotion ? { scale: 1.02, y: -2 } : undefined}
                                        whileTap={canAdvanceStep3 ? { scale: 0.98 } : undefined}
                                        className={`flex-[2] ${primaryBtn}`}
                                    >
                                        Continuar
                                    </motion.button>
                                </div>
                            </motion.div>
                        )}

                        {/* PASO 4 — Confirmar */}
                        {step === 4 && tribu && (
                            <motion.div key="step4" {...stepTransition} className="space-y-5">
                                <h2 className="text-2xl font-black uppercase tracking-tight text-white leading-tight">
                                    Revisá tus datos
                                </h2>

                                <div className="border-2 border-neutral-800 bg-neutral-900/80 p-6 space-y-5">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500 mb-1">Nombre</p>
                                        <p className="text-2xl font-black uppercase tracking-tight text-white leading-none">
                                            {firstName} {lastName}
                                        </p>
                                    </div>

                                    <div className="flex items-end justify-between gap-4 pt-1">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500 mb-1">Edad</p>
                                            <p className="text-lg font-black text-white">{age}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500 mb-1">Tribu</p>
                                            <span className={`inline-block px-4 py-1.5 ${TRIBU_THEMES[tribu].bg} ${TRIBU_THEMES[tribu].text} text-sm font-black uppercase tracking-tight`}>
                                                {tribu}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {submitError && (
                                    <motion.p
                                        role="alert"
                                        initial={{ opacity: 0, y: -8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-sm font-bold text-red-400 text-center border border-red-800/50 bg-red-950/40 px-4 py-3"
                                    >
                                        {submitError}
                                    </motion.p>
                                )}

                                <div className="flex gap-3">
                                    <button
                                        disabled={isSubmitting}
                                        onClick={() => setStep(3)}
                                        className={`flex-1 ${secondaryBtn}`}
                                    >
                                        <Pencil className="w-4 h-4" /> Editar
                                    </button>
                                    <motion.button
                                        disabled={isSubmitting}
                                        onClick={handleSubmit}
                                        whileHover={!isSubmitting && !shouldReduceMotion ? { scale: 1.02, y: -2 } : undefined}
                                        whileTap={!isSubmitting ? { scale: 0.98 } : undefined}
                                        className={`flex-[2] ${primaryBtn}`}
                                    >
                                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" strokeWidth={3} />}
                                        {isSubmitting ? 'Guardando...' : 'Confirmar'}
                                    </motion.button>
                                </div>
                            </motion.div>
                        )}

                    </AnimatePresence>
                </div>
            </div>
        </>
    );
};

export default InscripcionInfluosDia;
