import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
    checkDianinoDniAvailable,
    registerDianinoSession
} from '../../../services/supabaseService';
import { safeUUID } from '../../../services/uuidUtils';
import { DiaNinoChildInput } from '../../../types';
import { ArrowLeft, ChevronLeft, Plus, Trash2, Check, X, Loader2, User, Baby, ShieldCheck, Ticket } from 'lucide-react';

const LOGO_URL = '/origen-logo-full.png';

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
}

const STEPS = [
    { label: 'Adulto', icon: User },
    { label: 'Niños', icon: Baby },
    { label: 'Conformidad', icon: ShieldCheck },
    { label: 'Confirmar', icon: Ticket },
];

const StepIndicator: React.FC<{ current: number }> = ({ current }) => (
    <div className="flex items-start gap-0 mb-8" role="list" aria-label="Progreso de la inscripción">
        {STEPS.map((s, i) => {
            const n = i + 1;
            const done = n < current;
            const active = n === current;
            const Icon = s.icon;
            return (
                <React.Fragment key={s.label}>
                    <div className="flex flex-col items-center gap-1.5 min-w-0" role="listitem" aria-current={active ? 'step' : undefined}>
                        <div className={`w-9 h-9 border-2 border-black flex items-center justify-center transition-colors ${done || active ? 'bg-black text-white' : 'bg-white text-neutral-300'}`}>
                            {done ? <Check className="w-4 h-4" strokeWidth={3} /> : <Icon className="w-4 h-4" />}
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-wide ${active ? 'text-black' : 'text-neutral-400'}`}>
                            {s.label}
                        </span>
                    </div>
                    {i < STEPS.length - 1 && (
                        <div className={`flex-1 h-0.5 mt-4 mx-1 transition-colors ${done ? 'bg-black' : 'bg-neutral-200'}`} />
                    )}
                </React.Fragment>
            );
        })}
    </div>
);

// El signature element de la página: cada persona inscripta es
// literalmente un ticket individual con su propio QR (dianino_tickets,
// 1 por fila) — el stub blanco/negro con línea de perforación no es
// decorativo, encodea esa estructura real del dato.
const TicketStub: React.FC<{
    name: string;
    dni: string;
    roleLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    index: number;
}> = ({ name, dni, roleLabel, icon: Icon, index }) => (
    <div className="flex items-stretch border-2 border-black">
        <div className="flex-1 min-w-0 p-3.5 bg-white">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{roleLabel}</p>
            <p className="font-black uppercase text-black truncate">{name || '—'}</p>
            <p className="text-xs font-bold text-neutral-500">DNI {dni || '—'}</p>
        </div>
        <div className="w-16 shrink-0 flex flex-col items-center justify-center gap-1 bg-black border-l-2 border-dashed border-white">
            <Icon className="w-4 h-4 text-white" />
            <span className="text-[10px] font-black text-white tabular-nums">#{index + 1}</span>
        </div>
    </div>
);

const primaryBtn = 'w-full py-3 bg-black text-white font-black uppercase tracking-widest border-2 border-black hover:bg-white hover:text-black hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:bg-black disabled:hover:text-white focus-visible:outline-none';
const secondaryBtn = 'flex items-center justify-center gap-2 py-3 border-2 border-black bg-white text-black font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all focus-visible:outline-none';
const inputClass = 'w-full p-3 border-2 border-black font-bold text-black bg-white outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow placeholder:text-neutral-300';
const labelClass = 'block text-[11px] font-black uppercase tracking-widest text-black mb-1.5';

const InscripcionDiaNino: React.FC = () => {
    const navigate = useNavigate();
    const shouldReduceMotion = useReducedMotion();
    const [step, setStep] = useState(1);

    const [adult, setAdult] = useState<AdultForm>({ firstName: '', lastName: '', email: '', dni: '' });
    const [adultDniError, setAdultDniError] = useState<string | null>(null);
    const [adultDniChecking, setAdultDniChecking] = useState(false);
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

    // ── Verificación de DNI en tiempo real (debounce 600 ms) ─────────────
    const adultDniTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const childDniTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    // Adulto: se dispara cada vez que cambia adult.dni
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

    // Niños: se dispara cuando cambia el DNI de cualquier niño
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
    // ────────────────────────────────────────────────────────────────────

    const resetForm = () => {
        setStep(1);
        setAdult({ firstName: '', lastName: '', email: '', dni: '' });
        setAdultDniError(null);
        setAdultDniChecking(false);
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
            ? { ...c, [field]: value, dniError: field === 'dni' ? undefined : c.dniError }
            : c
        ));
    };

    const canAdvanceStep1 = adult.firstName.trim() && adult.lastName.trim() && adult.email.trim() && adult.dni.trim() && !adultDniError && !adultDniChecking;
    const canAdvanceStep2 = children.length > 0 && children.every(c => c.firstName.trim() && c.lastName.trim() && c.dni.trim() && !c.dniError && !c.dniChecking);

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
                // ya se mandó — pero acá no mostramos la pantalla
                // festiva de "¡Listo!", volvemos directo al
                // inicio del formulario.
                navigate('/dia-del-nino', { replace: true });
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
            <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
                <motion.div
                    initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, type: 'spring', stiffness: 200, damping: 20 }}
                    className="max-w-md w-full bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 text-center"
                >
                    <img src={LOGO_URL} alt="Origen" className="h-8 mx-auto mb-6 object-contain" />
                    <div className="w-16 h-16 border-2 border-black bg-black flex items-center justify-center mx-auto mb-5">
                        <Ticket className="w-8 h-8 text-white" aria-hidden="true" />
                    </div>
                    <h1 className="text-2xl font-black uppercase tracking-tighter text-black mb-2">¡Listo, {adult.firstName}!</h1>
                    <p className="text-neutral-600 font-medium leading-relaxed mb-6">
                        Generamos <span className="font-black text-black">{totalTickets} {totalTickets === 1 ? 'entrada' : 'entradas'}</span> para
                        tu familia. En los próximos minutos te llega un email a <span className="font-black text-black">{adult.email}</span> con
                        el ticket de cada uno. Si no lo ves, revisá spam.
                    </p>
                    <button
                        onClick={() => navigate('/dia-del-nino/buscar')}
                        className="text-sm font-black uppercase tracking-widest text-black hover:underline focus-visible:outline-none"
                    >
                        ¿No te llegó? Buscá tu inscripción acá
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-100 py-8 px-4">
            <div className="max-w-lg mx-auto">
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-black hover:underline mb-6 focus-visible:outline-none"
                >
                    <ArrowLeft className="w-4 h-4" /> Inicio
                </button>

                <div className="text-center mb-8">
                    <img src={LOGO_URL} alt="Origen" className="h-8 md:h-9 mx-auto mb-5 object-contain" />
                    <h1 className="text-3xl font-black uppercase tracking-tighter text-black">Día del Niño</h1>
                    <div className="h-1 w-16 bg-black mx-auto my-3" />
                    <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">Inscribí a tu familia para el evento</p>
                </div>

                <StepIndicator current={step} />

                <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 md:p-8 overflow-hidden">
                    <AnimatePresence mode="wait">

                        {/* PASO 1 — Adulto */}
                        {step === 1 && (
                            <motion.div key="step1" {...stepTransition} className="space-y-4">
                                <h2 className="font-black uppercase text-black border-b-2 border-black pb-3">Tus datos (adulto responsable)</h2>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label htmlFor="dn-adult-firstName" className={labelClass}>Nombre</label>
                                        <input
                                            id="dn-adult-firstName" type="text" placeholder="Nombre" autoComplete="given-name"
                                            value={adult.firstName} onChange={e => setAdult({ ...adult, firstName: e.target.value })}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="dn-adult-lastName" className={labelClass}>Apellido</label>
                                        <input
                                            id="dn-adult-lastName" type="text" placeholder="Apellido" autoComplete="family-name"
                                            value={adult.lastName} onChange={e => setAdult({ ...adult, lastName: e.target.value })}
                                            className={inputClass}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="dn-adult-email" className={labelClass}>Email (ahí te llega la entrada)</label>
                                    <input
                                        id="dn-adult-email" type="email" placeholder="tu@email.com" autoComplete="email"
                                        value={adult.email} onChange={e => setAdult({ ...adult, email: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="dn-adult-dni" className={labelClass}>DNI</label>
                                    <input
                                        id="dn-adult-dni" type="text" placeholder="DNI" inputMode="numeric" value={adult.dni}
                                        onChange={e => { setAdult({ ...adult, dni: e.target.value }); setAdultDniError(null); }}
                                        className={`${inputClass} ${adultDniError ? 'border-red-600' : ''}`}
                                    />
                                    {adultDniChecking && <p className="text-xs font-bold text-neutral-400 mt-1.5">Verificando...</p>}
                                    {adultDniError && <p className="text-xs font-bold text-red-600 mt-1.5">{adultDniError}</p>}
                                </div>

                                <button disabled={!canAdvanceStep1} onClick={() => setStep(2)} className={`${primaryBtn} mt-2`}>
                                    Continuar
                                </button>
                            </motion.div>
                        )}

                        {/* PASO 2 — Niños */}
                        {step === 2 && (
                            <motion.div key="step2" {...stepTransition} className="space-y-4">
                                <h2 className="font-black uppercase text-black border-b-2 border-black pb-3">Datos de cada niño</h2>
                                <div className="space-y-3">
                                    <AnimatePresence initial={false}>
                                        {children.map((child, idx) => (
                                            <motion.div
                                                key={child.localId}
                                                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="p-4 bg-neutral-50 border-2 border-black space-y-3"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-black uppercase tracking-widest text-black">Niño {idx + 1}</span>
                                                    {children.length > 1 && (
                                                        <button
                                                            onClick={() => removeChild(child.localId)}
                                                            aria-label={`Eliminar niño ${idx + 1}`}
                                                            className="w-9 h-9 -my-2 -mr-2 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-black transition-colors focus-visible:outline-none"
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
                                                        />
                                                    </div>
                                                    <div>
                                                        <label htmlFor={`dn-child-ln-${child.localId}`} className={labelClass}>Apellido</label>
                                                        <input
                                                            id={`dn-child-ln-${child.localId}`} type="text" placeholder="Apellido" autoComplete="family-name"
                                                            value={child.lastName} onChange={e => updateChild(child.localId, 'lastName', e.target.value)}
                                                            className={inputClass}
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label htmlFor={`dn-child-dni-${child.localId}`} className={labelClass}>DNI</label>
                                                    <input
                                                        id={`dn-child-dni-${child.localId}`} type="text" placeholder="DNI" inputMode="numeric"
                                                        value={child.dni}
                                                        onChange={e => updateChild(child.localId, 'dni', e.target.value)}
                                                        className={`${inputClass} ${child.dniError ? 'border-red-600' : ''}`}
                                                    />
                                                    {child.dniChecking && <p className="text-xs font-bold text-neutral-400 mt-1.5">Verificando...</p>}
                                                    {child.dniError && <p className="text-xs font-bold text-red-600 mt-1.5">{child.dniError}</p>}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>

                                <button
                                    onClick={addChild}
                                    className="w-full py-2.5 flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest text-black bg-white border-2 border-dashed border-black hover:bg-black hover:text-white transition-colors focus-visible:outline-none"
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
                                <h2 className="font-black uppercase text-black border-b-2 border-black pb-3">Declaración de Conformidad</h2>
                                <div className="p-5 bg-neutral-50 border-2 border-black space-y-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <ShieldCheck className="w-5 h-5 text-black shrink-0" aria-hidden="true" />
                                        <span className="text-[11px] font-black uppercase tracking-widest text-black">Aviso sobre registro fotográfico y audiovisual</span>
                                    </div>
                                    <p className="text-sm font-medium text-neutral-700 leading-relaxed">
                                        Te informamos que durante el evento se tomarán fotografías y grabaciones de video de las distintas actividades. Este material será utilizado exclusivamente por <span className="font-black text-black">Origen Iglesia</span> con fines de difusión, comunicación y registro informativo en nuestros canales oficiales (redes sociales, sitio web y material impreso de la iglesia).
                                    </p>
                                </div>
                                <p className="text-sm text-neutral-500 text-center">
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
                                <h2 className="font-black uppercase text-black border-b-2 border-black pb-3">Confirmá los datos</h2>
                                <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">Así van a quedar tus {totalTickets} {totalTickets === 1 ? 'entrada' : 'entradas'}:</p>

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

                                <div className="border-t-2 border-black pt-4 space-y-3">
                                    <p className="text-sm font-bold text-neutral-600">
                                        Chequea bien los datos antes de confirmar
                                    </p>

                                    {submitError && (
                                        <p className="text-sm font-bold text-red-600 bg-red-50 border-2 border-red-600 px-4 py-3">{submitError}</p>
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
                                    <button onClick={() => setStep(3)} className="w-full text-xs font-black uppercase tracking-widest text-neutral-400 hover:text-black transition-colors focus-visible:outline-none">
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
