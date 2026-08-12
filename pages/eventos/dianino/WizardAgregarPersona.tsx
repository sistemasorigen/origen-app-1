import React, { useState, useEffect } from 'react';
import {
    getDianinoSessionDetail,
    checkDianinoDniAvailable,
    addDianinoChild,
    updateDianinoAdult
} from '../../../services/supabaseService';
import { DiaNinoSessionRow, DiaNinoSession, DiaNinoTicket } from '../../../types';
import NeoModal from '../../../components/ui/NeoModal';
import {
    Search, User, Baby, Plus, Pencil, ChevronLeft, ChevronRight,
    CheckCircle2, Circle, Loader2, UserCheck
} from 'lucide-react';

type WizardStep = 'search' | 'summary' | 'addChild' | 'editAdult' | 'confirm';

interface ChildDraft {
    firstName: string;
    lastName: string;
    dni: string;
    dniError?: string;
    dniChecking?: boolean;
}

interface AdultDraft {
    firstName: string;
    lastName: string;
    dni: string;
    email: string;
    dniError?: string;
    dniChecking?: boolean;
}

interface SessionDetail {
    session: DiaNinoSession;
    tickets: DiaNinoTicket[];
}

interface WizardAgregarPersonaProps {
    isOpen: boolean;
    sessions: DiaNinoSessionRow[];
    onClose: (didChange: boolean) => void;
}

const emptyChildDraft: ChildDraft = { firstName: '', lastName: '', dni: '' };
const emptyAdultDraft: AdultDraft = { firstName: '', lastName: '', dni: '', email: '' };

const WizardAgregarPersona: React.FC<WizardAgregarPersonaProps> = ({ isOpen, sessions, onClose }) => {
    const [step, setStep] = useState<WizardStep>('search');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [detail, setDetail] = useState<SessionDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const [pendingAction, setPendingAction] = useState<'addChild' | 'editAdult' | null>(null);
    const [childDraft, setChildDraft] = useState<ChildDraft>(emptyChildDraft);
    const [adultDraft, setAdultDraft] = useState<AdultDraft>(emptyAdultDraft);
    const [originalAdultDni, setOriginalAdultDni] = useState('');

    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [didChange, setDidChange] = useState(false);

    // Reset completo cada vez que se abre — sin esto, cerrar a mitad de
    // camino y volver a abrir dejaría el wizard en el paso viejo con
    // datos de la sesión anterior.
    useEffect(() => {
        if (!isOpen) return;
        setStep('search');
        setSearchTerm('');
        setSelectedSessionId(null);
        setDetail(null);
        setPendingAction(null);
        setChildDraft(emptyChildDraft);
        setAdultDraft(emptyAdultDraft);
        setSaveError(null);
        setDidChange(false);
    }, [isOpen]);

    const fetchDetail = async (sessionId: string) => {
        setLoadingDetail(true);
        const result = await getDianinoSessionDetail(sessionId);
        setDetail(result);
        setLoadingDetail(false);
    };

    const handleSelectSession = (sessionId: string) => {
        setSelectedSessionId(sessionId);
        setStep('summary');
        fetchDetail(sessionId);
    };

    const adultTicket = detail?.tickets.find(t => t.isAdult) || null;
    const childTickets = detail?.tickets.filter(t => !t.isAdult) || [];

    // ── Búsqueda ──────────────────────────────────────
    const searchResults = (() => {
        const term = searchTerm.toLowerCase().trim();
        if (term.length < 2) return [];
        return sessions
            .filter(s =>
                s.adultFirstName.toLowerCase().includes(term) ||
                s.adultLastName.toLowerCase().includes(term) ||
                s.adultDni.includes(term)
            )
            .slice(0, 8);
    })();

    // ── Formulario: agregar niño ──────────────────────
    const openAddChild = () => {
        setChildDraft(emptyChildDraft);
        setStep('addChild');
    };

    const handleChildDniBlur = async () => {
        if (!childDraft.dni.trim()) return;
        setChildDraft(prev => ({ ...prev, dniChecking: true }));
        const available = await checkDianinoDniAvailable(childDraft.dni.trim());
        setChildDraft(prev => ({
            ...prev,
            dniChecking: false,
            dniError: available ? undefined : 'Este DNI ya está inscripto.'
        }));
    };

    const canContinueChild =
        childDraft.firstName.trim() && childDraft.lastName.trim() && childDraft.dni.trim() &&
        !childDraft.dniError && !childDraft.dniChecking;

    // ── Formulario: editar adulto ──────────────────────
    const openEditAdult = () => {
        if (!adultTicket || !detail) return;
        setAdultDraft({
            firstName: adultTicket.firstName,
            lastName: adultTicket.lastName,
            dni: adultTicket.dni,
            email: detail.session.email
        });
        setOriginalAdultDni(adultTicket.dni);
        setStep('editAdult');
    };

    const handleAdultDniBlur = async () => {
        const dni = adultDraft.dni.trim();
        if (!dni || dni === originalAdultDni) return; // sin cambio real, nada que validar
        setAdultDraft(prev => ({ ...prev, dniChecking: true }));
        const available = await checkDianinoDniAvailable(dni);
        setAdultDraft(prev => ({
            ...prev,
            dniChecking: false,
            dniError: available ? undefined : 'Este DNI ya está inscripto.'
        }));
    };

    const canContinueAdult =
        adultDraft.firstName.trim() && adultDraft.lastName.trim() && adultDraft.dni.trim() && adultDraft.email.trim() &&
        !adultDraft.dniError && !adultDraft.dniChecking;

    // ── Confirmar ──────────────────────────────────────
    const goToConfirm = (action: 'addChild' | 'editAdult') => {
        setPendingAction(action);
        setSaveError(null);
        setStep('confirm');
    };

    const handleConfirm = async () => {
        if (!selectedSessionId || !pendingAction) return;
        setSaving(true);
        setSaveError(null);

        if (pendingAction === 'addChild') {
            const newId = await addDianinoChild(
                selectedSessionId,
                childDraft.firstName.trim(),
                childDraft.lastName.trim(),
                childDraft.dni.trim()
            );
            setSaving(false);
            if (!newId) {
                setSaveError('No se pudo agregar al niño. Probá de nuevo.');
                return;
            }
        } else if (pendingAction === 'editAdult' && adultTicket) {
            const success = await updateDianinoAdult(selectedSessionId, adultTicket.id, {
                firstName: adultDraft.firstName.trim(),
                lastName: adultDraft.lastName.trim(),
                dni: adultDraft.dni.trim(),
                email: adultDraft.email.trim()
            });
            setSaving(false);
            if (!success) {
                setSaveError('No se pudieron guardar los cambios. Probá de nuevo.');
                return;
            }
        }

        setDidChange(true);
        setPendingAction(null);
        await fetchDetail(selectedSessionId);
        setStep('summary');
    };

    const handleModalClose = () => onClose(didChange);

    // ── Título dinámico por paso ───────────────────────
    const title = (() => {
        if (step === 'search') return 'Buscar adulto responsable';
        if (step === 'summary') return 'Resumen de la inscripción';
        if (step === 'addChild') return 'Agregar niño';
        if (step === 'editAdult') return 'Editar adulto responsable';
        return 'Confirmar cambios';
    })();

    // Progreso — sólo tiene sentido mostrar los pasos que realmente se
    // van a atravesar en ESTE recorrido (search → summary → [la rama
    // elegida] → confirm), no los 5 posibles siempre: si el staff vino
    // a "Agregar niño", ver "Editar adulto" listado como paso 3 sería
    // confuso, insinuaría un paso que no va a pasar.
    const activeBranch: WizardStep | null =
        step === 'addChild' || step === 'editAdult' ? step : pendingAction;
    const stepSequence: WizardStep[] = activeBranch
        ? ['search', 'summary', activeBranch, 'confirm']
        : ['search', 'summary'];
    const currentIndex = stepSequence.indexOf(step);

    return (
        <NeoModal isOpen={isOpen} onClose={handleModalClose} title={title} maxWidth="max-w-lg">
            {/* Progreso */}
            <div className="flex items-center gap-1.5 mb-5" aria-hidden="true">
                {stepSequence.map((s, idx) => (
                    <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${idx <= currentIndex ? 'bg-black' : 'bg-slate-200'}`} />
                ))}
            </div>

            {/* ── PASO 1 — Buscar ── */}
            {step === 'search' && (
                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            autoFocus
                            type="text"
                            placeholder="Nombre, apellido o DNI del adulto..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-full outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 text-sm bg-white transition-all"
                        />
                    </div>

                    {searchTerm.trim().length > 0 && searchTerm.trim().length < 2 ? (
                        <p className="text-xs text-slate-400 text-center py-6">Escribí al menos 2 caracteres.</p>
                    ) : searchTerm.trim().length >= 2 && searchResults.length === 0 ? (
                        <div className="text-center py-6">
                            <p className="text-sm text-slate-500 mb-1">No encontramos a nadie con ese dato.</p>
                            <p className="text-xs text-slate-400">Si es una familia nueva, usá "Inscripción manual" en vez de este wizard.</p>
                        </div>
                    ) : searchTerm.trim().length < 2 ? (
                        <p className="text-xs text-slate-400 text-center py-6">Buscá al adulto responsable ya inscripto para agregarle un niño o corregir sus datos.</p>
                    ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                            {searchResults.map(s => (
                                <button
                                    key={s.sessionId}
                                    onClick={() => handleSelectSession(s.sessionId)}
                                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors text-left"
                                >
                                    <div className="w-9 h-9 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-sm text-slate-900 truncate">{s.adultFirstName} {s.adultLastName}</p>
                                        <p className="text-xs text-slate-400">DNI {s.adultDni} · {s.childrenCount} {s.childrenCount === 1 ? 'niño' : 'niños'}</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── PASO 2 — Resumen ── */}
            {step === 'summary' && (
                loadingDetail ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                    </div>
                ) : !detail || !adultTicket ? (
                    <div className="text-center py-10">
                        <p className="text-sm text-slate-500 mb-4">No pudimos cargar esta inscripción. Puede que se haya borrado.</p>
                        <button
                            onClick={() => setStep('search')}
                            className="px-5 py-2.5 bg-black text-white font-semibold text-sm rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            Volver a buscar
                        </button>
                    </div>
                ) : (
                    <div className="space-y-5">
                        <button
                            onClick={() => setStep('search')}
                            className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-400 hover:text-black transition-colors"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" /> Buscar otro
                        </button>

                        {/* Adulto + declaración */}
                        <div className="flex items-center gap-3 p-4 rounded-lg bg-white border border-slate-200">
                            <div className="w-11 h-11 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                                <User className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold text-sm text-slate-900 truncate">{adultTicket.firstName} {adultTicket.lastName}</p>
                                <p className="text-xs text-slate-400 truncate">DNI {adultTicket.dni} · {detail.session.email}</p>
                            </div>
                            {detail.session.declaracionJuradaAceptada ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full shrink-0">
                                    <CheckCircle2 className="w-3 h-3" /> Aceptó
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-red-600 bg-red-50 px-2 py-1 rounded-full shrink-0">
                                    <Circle className="w-3 h-3" /> No aceptó
                                </span>
                            )}
                        </div>

                        {/* Niños a cargo */}
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                                Niños a cargo {childTickets.length > 0 && `(${childTickets.length})`}
                            </p>
                            {childTickets.length === 0 ? (
                                <p className="text-sm text-slate-400 py-2">Todavía no tiene niños cargados.</p>
                            ) : (
                                <div className="space-y-1.5">
                                    {childTickets.map(child => (
                                        <div key={child.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-50">
                                            <Baby className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <p className="text-sm text-slate-700 truncate">{child.firstName} {child.lastName}</p>
                                            <span className="text-xs text-slate-400 ml-auto shrink-0">DNI {child.dni}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Acciones */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                                onClick={openAddChild}
                                className="flex items-center justify-center gap-2 py-3 bg-black text-white font-semibold text-sm rounded-lg hover:bg-slate-800 transition-colors"
                            >
                                <Plus className="w-4 h-4" /> Agregar niño
                            </button>
                            <button
                                onClick={openEditAdult}
                                className="flex items-center justify-center gap-2 py-3 border border-slate-300 bg-white text-slate-700 font-semibold text-sm rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                <Pencil className="w-4 h-4" /> Editar adulto
                            </button>
                        </div>

                        <button
                            onClick={handleModalClose}
                            className="w-full py-2.5 text-sm font-semibold text-slate-500 hover:text-black transition-colors"
                        >
                            Listo, cerrar
                        </button>
                    </div>
                )
            )}

            {/* ── PASO 3a — Agregar niño ── */}
            {step === 'addChild' && (
                <div className="space-y-4">
                    <p className="text-xs text-slate-500">
                        Se va a vincular a <span className="font-semibold text-slate-700">{adultTicket?.firstName} {adultTicket?.lastName}</span> como su adulto responsable.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <input
                            type="text" placeholder="Nombre" value={childDraft.firstName}
                            onChange={e => setChildDraft(prev => ({ ...prev, firstName: e.target.value }))}
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-black text-sm"
                        />
                        <input
                            type="text" placeholder="Apellido" value={childDraft.lastName}
                            onChange={e => setChildDraft(prev => ({ ...prev, lastName: e.target.value }))}
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-black text-sm"
                        />
                    </div>
                    <div>
                        <input
                            type="text" placeholder="DNI" value={childDraft.dni}
                            onChange={e => setChildDraft(prev => ({ ...prev, dni: e.target.value.replace(/\D/g, ''), dniError: undefined }))}
                            onBlur={handleChildDniBlur}
                            className={`w-full px-3 py-2.5 border rounded-lg outline-none text-sm ${childDraft.dniError ? 'border-red-400 bg-red-50' : 'border-slate-300 focus:border-black'}`}
                        />
                        {childDraft.dniChecking && <p className="text-xs text-slate-400 mt-1">Verificando...</p>}
                        {childDraft.dniError && <p className="text-xs text-red-600 font-medium mt-1">{childDraft.dniError}</p>}
                    </div>

                    <div className="flex gap-2 pt-1">
                        <button
                            onClick={() => setStep('summary')}
                            className="px-5 py-3 text-sm font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            Atrás
                        </button>
                        <button
                            disabled={!canContinueChild}
                            onClick={() => goToConfirm('addChild')}
                            className="flex-1 py-3 bg-black text-white font-semibold text-sm rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Continuar
                        </button>
                    </div>
                </div>
            )}

            {/* ── PASO 3b — Editar adulto ── */}
            {step === 'editAdult' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <input
                            type="text" placeholder="Nombre" value={adultDraft.firstName}
                            onChange={e => setAdultDraft(prev => ({ ...prev, firstName: e.target.value }))}
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-black text-sm"
                        />
                        <input
                            type="text" placeholder="Apellido" value={adultDraft.lastName}
                            onChange={e => setAdultDraft(prev => ({ ...prev, lastName: e.target.value }))}
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-black text-sm"
                        />
                    </div>
                    <input
                        type="email" placeholder="Email" value={adultDraft.email}
                        onChange={e => setAdultDraft(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-black text-sm"
                    />
                    <div>
                        <input
                            type="text" placeholder="DNI" value={adultDraft.dni}
                            onChange={e => setAdultDraft(prev => ({ ...prev, dni: e.target.value.replace(/\D/g, ''), dniError: undefined }))}
                            onBlur={handleAdultDniBlur}
                            className={`w-full px-3 py-2.5 border rounded-lg outline-none text-sm ${adultDraft.dniError ? 'border-red-400 bg-red-50' : 'border-slate-300 focus:border-black'}`}
                        />
                        {adultDraft.dniChecking && <p className="text-xs text-slate-400 mt-1">Verificando...</p>}
                        {adultDraft.dniError && <p className="text-xs text-red-600 font-medium mt-1">{adultDraft.dniError}</p>}
                    </div>

                    <div className="flex gap-2 pt-1">
                        <button
                            onClick={() => setStep('summary')}
                            className="px-5 py-3 text-sm font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            Atrás
                        </button>
                        <button
                            disabled={!canContinueAdult}
                            onClick={() => goToConfirm('editAdult')}
                            className="flex-1 py-3 bg-black text-white font-semibold text-sm rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Continuar
                        </button>
                    </div>
                </div>
            )}

            {/* ── PASO 4 — Confirmar ── */}
            {step === 'confirm' && (
                <div className="space-y-4">
                    {pendingAction === 'addChild' ? (
                        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                <Baby className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900">{childDraft.firstName} {childDraft.lastName}</p>
                                <p className="text-xs text-slate-500 mt-0.5">DNI {childDraft.dni}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                    Se agrega como niño a cargo de <span className="font-semibold">{adultTicket?.firstName} {adultTicket?.lastName}</span>.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                <UserCheck className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 text-sm text-slate-700 space-y-1">
                                <p><span className="text-slate-400">Nombre:</span> {adultDraft.firstName} {adultDraft.lastName}</p>
                                <p><span className="text-slate-400">DNI:</span> {adultDraft.dni}</p>
                                <p><span className="text-slate-400">Email:</span> {adultDraft.email}</p>
                            </div>
                        </div>
                    )}

                    {saveError && <p className="text-sm text-red-600 font-medium">{saveError}</p>}

                    <div className="flex gap-2 pt-1">
                        <button
                            onClick={() => setStep(pendingAction === 'addChild' ? 'addChild' : 'editAdult')}
                            disabled={saving}
                            className="px-5 py-3 text-sm font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40"
                        >
                            Atrás
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={saving}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white font-semibold text-sm rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Confirmar
                        </button>
                    </div>
                </div>
            )}
        </NeoModal>
    );
};

export default WizardAgregarPersona;
