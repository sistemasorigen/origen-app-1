import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
    checkDianinoDniAvailable,
    checkDianinoNameAvailable,
    checkDianinoEmailAvailable,
    registerDianinoSession
} from '../../../services/supabaseService';
import { safeUUID } from '../../../services/uuidUtils';
import { DiaNinoChildInput } from '../../../types';
import { ArrowLeft, ChevronLeft, Plus, Trash2, Check, Loader2, User, Baby, ShieldCheck, Ticket, Calendar, Clock } from 'lucide-react';

const LOGO_URL = '/origen-logo-full.png';

// ── Sistema de color "Día del Niño" ───────────────────────────────
// Paleta tomada del flyer real del evento. El naranja es EXCLUSIVO
// de acciones/CTA (nunca aparece en la tipografía crayón ni en la
// tira de datos) — así se mantiene como el único acento que de
// verdad llama la atención, en vez de saturar toda la pantalla.
const INK = '#2A211B';
const CREAM_CARD = '#FFFFFF';
const CRAYON_RED = '#E63B2E';
const CRAYON_BLUE = '#4A7FC9';
const CRAYON_GREEN = '#4CAF50';
const CRAYON_MUSTARD = '#F5B942';
const CRAYON_PINK = '#F2A9C4';
const BRAND_ORANGE = '#F0703A';

// Cada palabra del título en un color de crayón distinto + una
// leve rotación alternada — sin textura de trazo real (no es
// viable en una interfaz con formularios), esto alcanza para que
// se sienta parte del mismo mundo que el flyer.
const TITLE_WORDS: { text: string; color: string; rotate: number }[] = [
    { text: 'Día', color: CRAYON_RED, rotate: -4 },
    { text: 'del', color: CRAYON_BLUE, rotate: 3 },
    { text: 'Niño', color: CRAYON_GREEN, rotate: -3 },
];

const TICKET_TAB_COLORS: { bg: string; fg: string }[] = [
    { bg: CRAYON_BLUE, fg: '#FFFFFF' },
    { bg: CRAYON_RED, fg: '#FFFFFF' },
    { bg: CRAYON_GREEN, fg: '#FFFFFF' },
    { bg: CRAYON_MUSTARD, fg: INK },
    { bg: BRAND_ORANGE, fg: '#FFFFFF' },
    { bg: CRAYON_PINK, fg: INK },
];

interface AdultForm {
    firstName: string;
    lastName: string;
    email: string;
    dni: string;
}

interface ChildForm extends DiaNinoChildInput {
    localId: string;
    dniError?: string;
    dniChecking?: boolean;
    nameError?: string;
    nameChecking?: boolean;
}

const STEPS = [
    { label: 'Adulto', icon: User, color: CRAYON_BLUE, iconOn: '#FFFFFF' },
    { label: 'Niños', icon: Baby, color: CRAYON_GREEN, iconOn: '#FFFFFF' },
    { label: 'Conformidad', icon: ShieldCheck, color: CRAYON_MUSTARD, iconOn: INK },
    { label: 'Confirmar', icon: Ticket, color: BRAND_ORANGE, iconOn: '#FFFFFF' },
];

const StepIndicator: React.FC<{ current: number }> = ({ current }) => (
    <div className="flex items-start gap-0 mb-6" role="list" aria-label="Progreso de la inscripción">
        {STEPS.map((s, i) => {
            const n = i + 1;
            const done = n < current;
            const active = n === current;
            const filled = done || active;
            const Icon = s.icon;
            return (
                <React.Fragment key={s.label}>
                    <div className="flex flex-col items-center gap-1.5 min-w-0" role="listitem" aria-current={active ? 'step' : undefined}>
                        <div
                            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors shadow-sm"
                            style={filled ? { backgroundColor: s.color, color: s.iconOn } : { backgroundColor: '#FFFFFF', color: '#C9B79A', border: '2px solid #EAD9BE' }}
                        >
                            {done ? <Check className="w-4 h-4" strokeWidth={3} /> : <Icon className="w-4 h-4" />}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wide" style={{ color: active ? INK : '#C9B79A' }}>
                            {s.label}
                        </span>
                    </div>
                    {i < STEPS.length - 1 && (
                        <div
                            className="flex-1 h-1 mt-4 mx-1 rounded-full transition-colors"
                            style={{ backgroundColor: done ? BRAND_ORANGE : '#EAD9BE' }}
                        />
                    )}
                </React.Fragment>
            );
        })}
    </div>
);

// El signature element de la página: cada persona inscripta es
// literalmente un ticket individual con su propio QR (dianino_tickets,
// 1 por fila) — el stub con línea de perforación no es decorativo,
// encodea esa estructura real del dato, ahora en el lenguaje de
// "boletos de feria" del flyer.
const TicketStub: React.FC<{
    name: string;
    dni: string;
    roleLabel: string;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    index: number;
}> = ({ name, dni, roleLabel, icon: Icon, index }) => {
    const tab = TICKET_TAB_COLORS[index % TICKET_TAB_COLORS.length];
    return (
        <div className="flex items-stretch rounded-2xl overflow-hidden shadow-sm" style={{ border: '2px solid #EAD9BE' }}>
            <div className="flex-1 min-w-0 p-3.5" style={{ backgroundColor: CREAM_CARD }}>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#B9A88C' }}>{roleLabel}</p>
                <p className="font-black uppercase truncate" style={{ color: INK }}>{name || '—'}</p>
                <p className="text-xs font-bold" style={{ color: '#8A7857' }}>DNI {dni || '—'}</p>
            </div>
            <div
                className="w-16 shrink-0 flex flex-col items-center justify-center gap-1"
                style={{ backgroundColor: tab.bg, borderLeft: `2px dashed ${CREAM_CARD}` }}
            >
                <Icon className="w-4 h-4" style={{ color: tab.fg }} />
                <span className="text-[10px] font-black tabular-nums" style={{ color: tab.fg }}>#{index + 1}</span>
            </div>
        </div>
    );
};

// Tira de datos del evento en bloques de color sólido — el
// elemento más reconocible y reutilizable del flyer real. No hay
// un paso de "info del evento" propio acá, así que vive en el
// header y queda visible en TODOS los pasos, a modo de
// recordatorio persistente.
const EventFactsStrip: React.FC = () => (
    <div className="flex flex-wrap justify-center gap-2 mb-7" aria-label="Datos del evento">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-black uppercase tracking-wide" style={{ backgroundColor: CRAYON_MUSTARD, color: INK }}>
            <Calendar className="w-3.5 h-3.5" /> Sáb 15/08
        </span>
        <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-black uppercase tracking-wide" style={{ backgroundColor: CRAYON_BLUE, color: '#FFFFFF' }}>
            <Clock className="w-3.5 h-3.5" /> 16 a 19 hs
        </span>
        <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-black uppercase tracking-wide" style={{ backgroundColor: CRAYON_GREEN, color: '#FFFFFF' }}>
            <Ticket className="w-3.5 h-3.5" /> Entrada gratis
        </span>
    </div>
);

// Título estilo "marcador sobre cartulina": cada palabra en un
// color de crayón + leve rotación alternada.
const CrayonHeading: React.FC<{ words: { text: string; color: string; rotate: number }[]; className?: string }> = ({ words, className }) => (
    <h1 className={`flex flex-wrap justify-center gap-x-2.5 gap-y-1 ${className || ''}`}>
        {words.map((w, i) => (
            <span
                key={i}
                className="inline-block font-black uppercase tracking-tight"
                style={{ color: w.color, transform: `rotate(${w.rotate}deg)` }}
            >
                {w.text}
            </span>
        ))}
    </h1>
);

const primaryBtn = 'w-full py-3.5 rounded-full bg-[#F0703A] text-white font-black uppercase tracking-wide shadow-[0_8px_20px_-6px_rgba(240,112,58,0.55)] hover:bg-[#E4652F] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#F0703A]/25';
const secondaryBtn = 'flex items-center justify-center gap-2 py-3.5 rounded-full border-2 border-[#2A211B]/15 bg-white text-[#2A211B] font-black uppercase tracking-wide hover:bg-[#2A211B]/[0.04] active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2A211B]/10';
const inputClass = 'w-full px-4 py-3 rounded-xl border-2 border-[#EAD9BE] bg-white font-semibold text-[#2A211B] placeholder:text-[#C9B79A] outline-none focus:border-[#F0703A] focus:ring-4 focus:ring-[#F0703A]/15 transition-all';
const labelClass = 'block text-[11px] font-black uppercase tracking-widest text-[#8A7857] mb-1.5';

const InscripcionDiaNino: React.FC = () => {
    const navigate = useNavigate();
    const shouldReduceMotion = useReducedMotion();
    const [step, setStep] = useState(1);

    const [adult, setAdult] = useState<AdultForm>({ firstName: '', lastName: '', email: '', dni: '' });
    const [adultDniError, setAdultDniError] = useState<string | null>(null);
    const [adultDniChecking, setAdultDniChecking] = useState(false);
    const [adultNameError, setAdultNameError] = useState<string | null>(null);
    const [adultNameChecking, setAdultNameChecking] = useState(false);
    const [adultEmailError, setAdultEmailError] = useState<string | null>(null);
    const [adultEmailChecking, setAdultEmailChecking] = useState(false);
    // Guarda el último valor de DNI que ya fue verificado para no re-disparar el
    // check en onBlur si el valor no cambió (evita el bug de "doble click" en Continuar).
    const [adultDniLastChecked, setAdultDniLastChecked] = useState('');

    const [children, setChildren] = useState<ChildForm[]>([
        { localId: safeUUID(), firstName: '', lastName: '', dni: '' }
    ]);

    const [declaracionAceptada, setDeclaracionAceptada] = useState<boolean | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const [registeredNoReveal, setRegisteredNoReveal] = useState(false);

    // ── Verificación de datos en tiempo real (debounce 600 ms) ─────────────
    const adultDniTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const adultNameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const adultEmailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const childDniTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const childNameTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    // Adulto DNI
    useEffect(() => {
        const val = adult.dni.trim();
        if (adultDniTimerRef.current) clearTimeout(adultDniTimerRef.current);
        if (!val) { setAdultDniError(null); setAdultDniChecking(false); return; }
        adultDniTimerRef.current = setTimeout(async () => {
            setAdultDniChecking(true);
            const available = await checkDianinoDniAvailable(val);
            setAdultDniChecking(false);
            setAdultDniError(available ? null : 'Este DNI ya está inscripto.');
        }, 600);
        return () => { if (adultDniTimerRef.current) clearTimeout(adultDniTimerRef.current); };
    }, [adult.dni]);

    // Adulto Nombre/Apellido
    useEffect(() => {
        const fn = adult.firstName.trim();
        const ln = adult.lastName.trim();
        if (adultNameTimerRef.current) clearTimeout(adultNameTimerRef.current);
        if (!fn || !ln) { setAdultNameError(null); setAdultNameChecking(false); return; }
        adultNameTimerRef.current = setTimeout(async () => {
            setAdultNameChecking(true);
            const available = await checkDianinoNameAvailable(fn, ln);
            setAdultNameChecking(false);
            setAdultNameError(available ? null : 'Esta persona ya está inscripta.');
        }, 600);
        return () => { if (adultNameTimerRef.current) clearTimeout(adultNameTimerRef.current); };
    }, [adult.firstName, adult.lastName]);

    // Adulto Email
    useEffect(() => {
        const val = adult.email.trim();
        if (adultEmailTimerRef.current) clearTimeout(adultEmailTimerRef.current);
        if (!val || !val.includes('@')) { setAdultEmailError(null); setAdultEmailChecking(false); return; }
        adultEmailTimerRef.current = setTimeout(async () => {
            setAdultEmailChecking(true);
            const available = await checkDianinoEmailAvailable(val);
            setAdultEmailChecking(false);
            setAdultEmailError(available ? null : 'Este email ya está inscripto.');
        }, 600);
        return () => { if (adultEmailTimerRef.current) clearTimeout(adultEmailTimerRef.current); };
    }, [adult.email]);

    // Niños DNI
    const childDniKey = children.map(c => `${c.localId}:${c.dni}`).join('|');
    useEffect(() => {
        children.forEach(child => {
            const val = child.dni.trim();
            const prev = childDniTimersRef.current.get(child.localId);
            if (prev) clearTimeout(prev);
            if (!val) {
                setChildren(p => p.map(c => c.localId === child.localId ? { ...c, dniError: undefined, dniChecking: false } : c));
                return;
            }
            const timer = setTimeout(async () => {
                setChildren(p => p.map(c => c.localId === child.localId ? { ...c, dniChecking: true } : c));
                const available = await checkDianinoDniAvailable(val);
                setChildren(p => p.map(c => c.localId === child.localId
                    ? { ...c, dniChecking: false, dniError: available ? undefined : 'Este DNI ya está inscripto.' }
                    : c
                ));
            }, 600);
            childDniTimersRef.current.set(child.localId, timer);
        });
        return () => { childDniTimersRef.current.forEach(t => clearTimeout(t)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [childDniKey]);

    // Niños Nombre/Apellido
    const childNameKey = children.map(c => `${c.localId}:${c.firstName}:${c.lastName}`).join('|');
    useEffect(() => {
        children.forEach(child => {
            const fn = child.firstName.trim();
            const ln = child.lastName.trim();
            const prev = childNameTimersRef.current.get(child.localId);
            if (prev) clearTimeout(prev);
            if (!fn || !ln) {
                setChildren(p => p.map(c => c.localId === child.localId ? { ...c, nameError: undefined, nameChecking: false } : c));
                return;
            }
            const timer = setTimeout(async () => {
                setChildren(p => p.map(c => c.localId === child.localId ? { ...c, nameChecking: true } : c));
                const available = await checkDianinoNameAvailable(fn, ln);
                setChildren(p => p.map(c => c.localId === child.localId
                    ? { ...c, nameChecking: false, nameError: available ? undefined : 'Esta persona ya está inscripta.' }
                    : c
                ));
            }, 600);
            childNameTimersRef.current.set(child.localId, timer);
        });
        return () => { childNameTimersRef.current.forEach(t => clearTimeout(t)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [childNameKey]);
    // ────────────────────────────────────────────────────────────────────

    const resetForm = () => {
        setStep(1);
        setAdult({ firstName: '', lastName: '', email: '', dni: '' });
        setAdultDniError(null);
        setAdultDniChecking(false);
        setAdultNameError(null);
        setAdultNameChecking(false);
        setAdultEmailError(null);
        setAdultEmailChecking(false);
        setChildren([{ localId: safeUUID(), firstName: '', lastName: '', dni: '' }]);
        setDeclaracionAceptada(null);
        setSubmitError(null);
    };


    const addChild = () => {
        setChildren(prev => [...prev, { localId: safeUUID(), firstName: '', lastName: '', dni: '' }]);
    };

    const removeChild = (localId: string) => {
        setChildren(prev => prev.filter(c => c.localId !== localId));
    };

    const updateChild = (localId: string, field: keyof DiaNinoChildInput, value: string) => {
        setChildren(prev => prev.map(c => c.localId === localId
            ? { 
                ...c, 
                [field]: value, 
                dniError: field === 'dni' ? undefined : c.dniError,
                nameError: (field === 'firstName' || field === 'lastName') ? undefined : c.nameError
              }
            : c
        ));
    };

    const canAdvanceStep1 = adult.firstName.trim() && adult.lastName.trim() && adult.email.trim() && adult.dni.trim() && !adultDniError && !adultDniChecking && !adultNameError && !adultNameChecking && !adultEmailError && !adultEmailChecking;
    const canAdvanceStep2 = children.length > 0 && children.every(c => c.firstName.trim() && c.lastName.trim() && c.dni.trim() && !c.dniError && !c.dniChecking && !c.nameError && !c.nameChecking);

    const handleFinalSubmit = async () => {
        const accepted = declaracionAceptada ?? false;
        setIsSubmitting(true);
        setSubmitError(null);

        const result = await registerDianinoSession(
            adult.email.trim(),
            accepted,
            { firstName: adult.firstName.trim(), lastName: adult.lastName.trim(), dni: adult.dni.trim() },
            children.map(c => ({ firstName: c.firstName.trim(), lastName: c.lastName.trim(), dni: c.dni.trim() }))
        );

        setIsSubmitting(false);

        if (result.sessionId) {
            if (!accepted) {
                // La inscripción quedó guardada igual (con
                // declaracionJuradaAceptada: false) y el email
                // ya se mandó — se muestra una confirmación breve
                // y NEUTRA (no la pantalla festiva) antes de
                // volver al inicio, para que quede claro que sí
                // se registró y no parezca que no pasó nada.
                setRegisteredNoReveal(true);
                return;
            }
            setDone(true);
            return;
        }

        if (result.errorDni) {
            setSubmitError(`El DNI ${result.errorDni} ya fue inscripto por otra persona justo ahora. Revisá los datos y probá de nuevo.`);
            setStep(1);
            return;
        }

        setSubmitError('Hubo un error al enviar la inscripción. Probá de nuevo en un momento.');
    };

    const totalTickets = 1 + children.length;
    const stepTransition = shouldReduceMotion
        ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }
        : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 }, transition: { duration: 0.25 } };

    if (done) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#FDF6E9' }}>
                <motion.div
                    initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, type: 'spring', stiffness: 200, damping: 20 }}
                    className="max-w-md w-full bg-white rounded-3xl shadow-[0_10px_40px_-12px_rgba(42,33,27,0.18)] p-8 text-center"
                >
                    <img src={LOGO_URL} alt="Origen" className="h-8 mx-auto mb-6 object-contain" />
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: BRAND_ORANGE }}>
                        <Ticket className="w-8 h-8 text-white" aria-hidden="true" />
                    </div>
                    <h1 className="text-2xl font-black uppercase tracking-tight mb-2" style={{ color: INK }}>
                        <span className="inline-block" style={{ color: CRAYON_RED, transform: 'rotate(-2deg)' }}>¡Listo</span>, {adult.firstName}!
                    </h1>
                    <p className="font-medium leading-relaxed mb-6" style={{ color: '#5C4E3D' }}>
                        Generamos <span className="font-black" style={{ color: INK }}>{totalTickets} {totalTickets === 1 ? 'entrada' : 'entradas'}</span> para
                        tu familia. En los próximos minutos te llega un email a <span className="font-black" style={{ color: INK }}>{adult.email}</span> con
                        el ticket de cada uno. Si no lo ves, revisá spam.
                    </p>
                    <button
                        onClick={() => navigate('/dia-del-nino/buscar')}
                        className="text-sm font-black uppercase tracking-widest hover:underline focus-visible:outline-none"
                        style={{ color: BRAND_ORANGE }}
                    >
                        ¿No te llegó? Buscá tu inscripción acá
                    </button>
                </motion.div>
            </div>
        );
    }

    if (registeredNoReveal) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#FDF6E9' }}>
                <div className="max-w-md w-full bg-white rounded-3xl shadow-lg p-8 text-center space-y-4">
                    <img src={LOGO_URL} alt="Origen" className="h-8 mx-auto object-contain" />
                    <p className="text-lg font-bold text-neutral-800">
                        Tu inscripción quedó registrada.
                    </p>
                    <p className="text-sm text-neutral-500">
                        Te avisamos por email cualquier novedad.
                    </p>
                    <button
                        onClick={() => navigate('/')}
                        className={`w-full ${secondaryBtn}`}
                    >
                        Volver al Inicio
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen py-8 px-4" style={{ backgroundColor: '#FDF6E9' }}>
            <div className="max-w-lg mx-auto">
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 text-xs font-black uppercase tracking-widest mb-6 hover:opacity-70 transition-opacity focus-visible:outline-none"
                    style={{ color: INK }}
                >
                    <ArrowLeft className="w-4 h-4" /> Inicio
                </button>

                <div className="text-center mb-6">
                    <img src={LOGO_URL} alt="Origen" className="h-8 md:h-9 mx-auto mb-5 object-contain" />
                    <CrayonHeading words={TITLE_WORDS} className="text-4xl sm:text-5xl mb-2" />
                    <p className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: '#B9A88C' }}>Inscribí a tu familia para el evento</p>
                    <EventFactsStrip />
                </div>

                <StepIndicator current={step} />

                <div className="bg-white rounded-3xl shadow-[0_10px_40px_-12px_rgba(42,33,27,0.18)] p-6 md:p-8 overflow-hidden">
                    <AnimatePresence mode="wait">

                        {/* PASO 1 — Adulto */}
                        {step === 1 && (
                            <motion.div key="step1" {...stepTransition} className="space-y-4">
                                <h2 className="font-black uppercase border-b-2 pb-3" style={{ color: INK, borderColor: '#EAD9BE' }}>Tus datos (adulto responsable)</h2>
                                <p className="text-xs font-bold -mt-1" style={{ color: '#8A7857' }}>
                                    Se inscribe un solo adulto responsable por grupo. Si vienen más adultos con vos, no necesitan anotarse.
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label htmlFor="dn-adult-firstName" className={labelClass}>Nombre</label>
                                        <input
                                            id="dn-adult-firstName" type="text" placeholder="Nombre" autoComplete="given-name"
                                            value={adult.firstName} onChange={e => { setAdult({ ...adult, firstName: e.target.value }); setAdultNameError(null); }}
                                            className={inputClass}
                                            style={adultNameError ? { borderColor: CRAYON_RED } : undefined}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="dn-adult-lastName" className={labelClass}>Apellido</label>
                                        <input
                                            id="dn-adult-lastName" type="text" placeholder="Apellido" autoComplete="family-name"
                                            value={adult.lastName} onChange={e => { setAdult({ ...adult, lastName: e.target.value }); setAdultNameError(null); }}
                                            className={inputClass}
                                            style={adultNameError ? { borderColor: CRAYON_RED } : undefined}
                                        />
                                    </div>
                                    <div className="col-span-2 -mt-1">
                                        {adultNameChecking && <p className="text-xs font-bold" style={{ color: '#B9A88C' }}>Verificando nombre...</p>}
                                        {adultNameError && <p className="text-xs font-bold" style={{ color: CRAYON_RED }}>{adultNameError}</p>}
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="dn-adult-email" className={labelClass}>Email (ahí te llega la entrada)</label>
                                    <input
                                        id="dn-adult-email" type="email" placeholder="tu@email.com" autoComplete="email"
                                        value={adult.email} onChange={e => { setAdult({ ...adult, email: e.target.value }); setAdultEmailError(null); }}
                                        className={inputClass}
                                        style={adultEmailError ? { borderColor: CRAYON_RED } : undefined}
                                    />
                                    {adultEmailChecking && <p className="text-xs font-bold mt-1.5" style={{ color: '#B9A88C' }}>Verificando email...</p>}
                                    {adultEmailError && <p className="text-xs font-bold mt-1.5" style={{ color: CRAYON_RED }}>{adultEmailError}</p>}
                                </div>
                                <div>
                                    <label htmlFor="dn-adult-dni" className={labelClass}>DNI</label>
                                    <input
                                        id="dn-adult-dni" type="text" placeholder="DNI" inputMode="numeric" value={adult.dni}
                                        onChange={e => { setAdult({ ...adult, dni: e.target.value.replace(/\D/g, '') }); setAdultDniError(null); }}
                                        className={inputClass}
                                        style={adultDniError ? { borderColor: CRAYON_RED } : undefined}
                                    />
                                    {adultDniChecking && <p className="text-xs font-bold mt-1.5" style={{ color: '#B9A88C' }}>Verificando...</p>}
                                    {adultDniError && <p className="text-xs font-bold mt-1.5" style={{ color: CRAYON_RED }}>{adultDniError}</p>}
                                </div>

                                <button disabled={!canAdvanceStep1} onClick={() => setStep(2)} className={`${primaryBtn} mt-2`}>
                                    Continuar
                                </button>
                            </motion.div>
                        )}

                        {/* PASO 2 — Niños */}
                        {step === 2 && (
                            <motion.div key="step2" {...stepTransition} className="space-y-4">
                                <h2 className="font-black uppercase border-b-2 pb-3" style={{ color: INK, borderColor: '#EAD9BE' }}>Datos de cada niño</h2>
                                <div className="space-y-3">
                                    <AnimatePresence initial={false}>
                                        {children.map((child, idx) => (
                                            <motion.div
                                                key={child.localId}
                                                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="p-4 rounded-2xl space-y-3"
                                                style={{ backgroundColor: '#FBF6EC', border: '2px solid #EAD9BE' }}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: INK }}>Niño {idx + 1}</span>
                                                    {children.length > 1 && (
                                                        <button
                                                            onClick={() => removeChild(child.localId)}
                                                            aria-label={`Eliminar niño ${idx + 1}`}
                                                            className="w-9 h-9 -my-2 -mr-2 flex items-center justify-center rounded-full transition-colors focus-visible:outline-none"
                                                            style={{ color: '#C9B79A' }}
                                                            onMouseEnter={e => { e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.backgroundColor = CRAYON_RED; }}
                                                            onMouseLeave={e => { e.currentTarget.style.color = '#C9B79A'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label htmlFor={`dn-child-fn-${child.localId}`} className={labelClass}>Nombre</label>
                                                        <input
                                                            id={`dn-child-fn-${child.localId}`} type="text" placeholder="Nombre" autoComplete="given-name"
                                                            value={child.firstName} onChange={e => updateChild(child.localId, 'firstName', e.target.value)}
                                                            className={inputClass}
                                                            style={child.nameError ? { borderColor: CRAYON_RED } : undefined}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label htmlFor={`dn-child-ln-${child.localId}`} className={labelClass}>Apellido</label>
                                                        <input
                                                            id={`dn-child-ln-${child.localId}`} type="text" placeholder="Apellido" autoComplete="family-name"
                                                            value={child.lastName} onChange={e => updateChild(child.localId, 'lastName', e.target.value)}
                                                            className={inputClass}
                                                            style={child.nameError ? { borderColor: CRAYON_RED } : undefined}
                                                        />
                                                    </div>
                                                    {(child.nameChecking || child.nameError) && (
                                                        <div className="col-span-2 -mt-1">
                                                            {child.nameChecking && <p className="text-xs font-bold" style={{ color: '#B9A88C' }}>Verificando nombre...</p>}
                                                            {child.nameError && <p className="text-xs font-bold" style={{ color: CRAYON_RED }}>{child.nameError}</p>}
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <label htmlFor={`dn-child-dni-${child.localId}`} className={labelClass}>DNI</label>
                                                    <input
                                                        id={`dn-child-dni-${child.localId}`} type="text" placeholder="DNI" inputMode="numeric"
                                                        value={child.dni}
                                                        onChange={e => updateChild(child.localId, 'dni', e.target.value.replace(/\D/g, ''))}
                                                        className={inputClass}
                                                        style={child.dniError ? { borderColor: CRAYON_RED } : undefined}
                                                    />
                                                    {child.dniChecking && <p className="text-xs font-bold mt-1.5" style={{ color: '#B9A88C' }}>Verificando...</p>}
                                                    {child.dniError && <p className="text-xs font-bold mt-1.5" style={{ color: CRAYON_RED }}>{child.dniError}</p>}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>

                                <button
                                    onClick={addChild}
                                    className="w-full py-2.5 flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest rounded-xl border-2 border-dashed transition-colors focus-visible:outline-none"
                                    style={{ color: INK, borderColor: '#EAD9BE' }}
                                    onMouseEnter={e => { e.currentTarget.style.color = CRAYON_GREEN; e.currentTarget.style.borderColor = CRAYON_GREEN; }}
                                    onMouseLeave={e => { e.currentTarget.style.color = INK; e.currentTarget.style.borderColor = '#EAD9BE'; }}
                                >
                                    <Plus className="w-4 h-4" /> Agregar otro niño
                                </button>

                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setStep(1)} className={`flex-1 ${secondaryBtn}`}>
                                        <ChevronLeft className="w-4 h-4" /> Volver
                                    </button>
                                    <button disabled={!canAdvanceStep2} onClick={() => setStep(3)} className={`flex-[2] ${primaryBtn}`}>
                                        Continuar
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* PASO 3 — Declaración de Conformidad */}
                        {step === 3 && (
                            <motion.div key="step3" {...stepTransition} className="space-y-4">
                                <h2 className="font-black uppercase border-b-2 pb-3" style={{ color: INK, borderColor: '#EAD9BE' }}>Declaración de Conformidad</h2>
                                <div className="p-5 rounded-2xl space-y-3" style={{ backgroundColor: '#FBF0D9', border: '2px solid rgba(245,185,66,0.5)' }}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <ShieldCheck className="w-5 h-5 shrink-0" style={{ color: INK }} aria-hidden="true" />
                                        <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: INK }}>Aviso sobre registro fotográfico y audiovisual</span>
                                    </div>
                                    <p className="text-sm font-medium leading-relaxed" style={{ color: '#5C4E3D' }}>
                                        Te informamos que durante el evento se tomarán fotografías y grabaciones de video de las distintas actividades. Este material será utilizado exclusivamente por <span className="font-black" style={{ color: INK }}>Origen Iglesia</span> con fines de difusión, comunicación y registro informativo en nuestros canales oficiales (redes sociales, sitio web y material impreso de la iglesia).
                                    </p>
                                </div>
                                <p className="text-sm text-center" style={{ color: '#8A7857' }}>
                                    ¿Autorizas la Declaración de Conformidad?
                                </p>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() => { setDeclaracionAceptada(false); setStep(4); }}
                                        className={`flex-1 ${secondaryBtn}`}
                                    >
                                        NO AUTORIZO
                                    </button>
                                    <button
                                        onClick={() => { setDeclaracionAceptada(true); setStep(4); }}
                                        className={`flex-[2] ${primaryBtn}`}
                                    >
                                        AUTORIZO
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* PASO 4 — Confirmar */}
                        {step === 4 && (
                            <motion.div key="step4" {...stepTransition} className="space-y-4">
                                <h2 className="font-black uppercase border-b-2 pb-3" style={{ color: INK, borderColor: '#EAD9BE' }}>Confirmá los datos</h2>
                                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#B9A88C' }}>Así van a quedar tus {totalTickets} {totalTickets === 1 ? 'entrada' : 'entradas'}:</p>

                                <div className="space-y-2.5">
                                    <TicketStub
                                        name={`${adult.firstName} ${adult.lastName}`.trim()}
                                        dni={adult.dni}
                                        roleLabel="Adulto responsable"
                                        icon={User}
                                        index={0}
                                    />
                                    {children.map((child, idx) => (
                                        <TicketStub
                                            key={child.localId}
                                            name={`${child.firstName} ${child.lastName}`.trim()}
                                            dni={child.dni}
                                            roleLabel="Niño"
                                            icon={Baby}
                                            index={idx + 1}
                                        />
                                    ))}
                                </div>

                                <div className="pt-4 space-y-3" style={{ borderTop: '2px solid #EAD9BE' }}>
                                    <p className="text-sm font-bold" style={{ color: '#5C4E3D' }}>
                                        Chequea bien los datos antes de confirmar
                                    </p>

                                    {submitError && (
                                        <p className="text-sm font-bold rounded-xl px-4 py-3" style={{ color: CRAYON_RED, backgroundColor: '#FDEDEB', border: `2px solid ${CRAYON_RED}` }}>{submitError}</p>
                                    )}

                                    <div className="flex gap-3">
                                        <button
                                            disabled={isSubmitting}
                                            onClick={() => { setStep(1); setSubmitError(null); }}
                                            className={`flex-1 ${secondaryBtn} disabled:opacity-50`}
                                        >
                                            Editar datos
                                        </button>
                                        <button
                                            disabled={isSubmitting}
                                            onClick={() => handleFinalSubmit()}
                                            className={`flex-[2] ${primaryBtn}`}
                                        >
                                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar datos'}
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setStep(3)}
                                        className="w-full text-xs font-black uppercase tracking-widest hover:opacity-70 transition-opacity focus-visible:outline-none"
                                        style={{ color: '#C9B79A' }}
                                    >
                                        ← Volver a la declaración
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default InscripcionDiaNino;
