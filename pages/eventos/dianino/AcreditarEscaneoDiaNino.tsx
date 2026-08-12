import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDianinoSessionForCheckin, checkinDianinoTicket, uncheckinDianinoTicket, DianinoSessionCheckinTicket } from '../../../services/supabaseService';
import { ChevronLeft, User, Baby, Check, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

// Tiempo que queda a la vista el aviso de éxito antes de volver solo
// al escáner. Fijo, sin botón para saltarlo — el flujo entero está
// pensado para no requerir un toque de más en la puerta.
const SUCCESS_DISPLAY_MS = 1400;

const AcreditarEscaneoDiaNino: React.FC = () => {
    const { ticketId } = useParams<{ ticketId: string }>();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [declaracionAceptada, setDeclaracionAceptada] = useState(true);
    const [adultTicket, setAdultTicket] = useState<DianinoSessionCheckinTicket | null>(null);
    const [childTickets, setChildTickets] = useState<DianinoSessionCheckinTicket[]>([]);

    // Estado local de selección — arranca precargado con quien
    // ya estaba acreditado de antes (por si se re-escanea el
    // mismo QR más tarde).
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [initialCheckedIds, setInitialCheckedIds] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        if (!ticketId) return;
        getDianinoSessionForCheckin(ticketId).then(info => {
            if (!info || !info.tickets) {
                setNotFound(true);
                setLoading(false);
                return;
            }
            setDeclaracionAceptada(!!info.declaracionJuradaAceptada);
            setAdultTicket(info.tickets.find(t => t.isAdult) || null);
            const children = info.tickets.filter(t => !t.isAdult);
            setChildTickets(children);

            const checkedNow = new Set(children.filter(c => c.status === 'CHECKED_IN').map(c => c.id));
            setSelectedIds(checkedNow);
            setInitialCheckedIds(checkedNow);
            setLoading(false);
        });
    }, [ticketId]);

    const toggleChild = (childId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(childId)) next.delete(childId);
            else next.add(childId);
            return next;
        });
    };

    const handleAcreditar = async () => {
        setSaving(true);

        const toCheckIn = childTickets.filter(c => selectedIds.has(c.id) && !initialCheckedIds.has(c.id));
        const toUncheck = childTickets.filter(c => !selectedIds.has(c.id) && initialCheckedIds.has(c.id));

        await Promise.all([
            ...toCheckIn.map(c => checkinDianinoTicket(c.id)),
            ...toUncheck.map(c => uncheckinDianinoTicket(c.id)),
        ]);

        setSaving(false);
        // El aviso se muestra ANTES de navegar, no en la pantalla del
        // escáner de destino — así queda claro que lo que se confirmó
        // fue justo lo que se acaba de tildar acá, no un resultado del
        // próximo escaneo.
        setShowSuccess(true);
        setTimeout(() => {
            navigate('/eventos/admin/diadelnino/escaner', { replace: true });
        }, SUCCESS_DISPLAY_MS);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
            </div>
        );
    }

    if (notFound || !adultTicket) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                <AlertTriangle className="w-10 h-10 text-red-500 mb-3" />
                <p className="text-slate-900 font-semibold mb-6">No pudimos encontrar esta entrada.</p>
                <button
                    onClick={() => navigate('/eventos/admin/diadelnino/escaner', { replace: true })}
                    className="px-5 py-3 bg-black text-white font-bold rounded-full text-sm"
                >
                    Volver a escanear
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Aviso de éxito — a pantalla completa, mismo lenguaje que el
                overlay de resultado del escáner (EscanerDiaNino.tsx): bloque
                sólido, ícono grande, título en mayúsculas. Se queda un
                momento fijo y navega solo — es la confirmación de que "lo
                que tildaste ya se guardó", no un paso que requiera otro toque. */}
            {showSuccess && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center text-white p-6 text-center bg-emerald-500">
                    <CheckCircle2 className="w-24 h-24" />
                    <h1 className="text-4xl font-black uppercase tracking-tight mt-6">Acreditación exitosa</h1>
                </div>
            )}

            <div className="p-4">
                <button
                    onClick={() => navigate('/eventos/admin/diadelnino/escaner', { replace: true })}
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400 hover:text-black transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" /> Volver a escanear
                </button>
            </div>

            <div className="flex-1 px-4 pb-6 max-w-md w-full mx-auto space-y-5">

                {/* Estado de la Declaración — es el dato más consecuente de
                    la página (define si esta familia puede ser fotografiada/
                    filmada), así que lleva más peso visual que un badge
                    común: borde grueso de color en vez del border-slate-200
                    de 1px que usan el resto de las tarjetas. Mismos colores
                    que ya usa el resto del módulo (DetalleDiaNino.tsx,
                    AdminDiaNino.tsx) — verde/rojo, no verde/amarillo. */}
                {declaracionAceptada ? (
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-400">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                        <p className="text-emerald-800 font-bold text-sm">Aceptó la Declaración de Conformidad</p>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border-2 border-red-400">
                        <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
                        <p className="text-red-800 font-bold text-sm">NO aceptó la Declaración de Conformidad</p>
                    </div>
                )}

                {/* Adulto responsable — informativo, sin nada para tildar. */}
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Adulto responsable</p>
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <div className="w-11 h-11 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                            <User className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-slate-900 font-semibold text-sm truncate">{adultTicket.firstName} {adultTicket.lastName}</p>
                            <p className="text-slate-400 text-xs">Ya acreditado</p>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    </div>
                </div>

                {/* Niños — tildar quiénes vinieron. Blanco con borde = todavía
                    no; verde sólido con texto negro = confirmado. El texto
                    negro (no blanco) es el que de verdad contrasta contra un
                    verde brillante — blanco encima de emerald-500 no pasa
                    contraste, se ve pastel y cuesta leerlo. */}
                {childTickets.length > 0 && (
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                            Niños — tocá para marcar quién vino
                        </p>
                        <div className="space-y-2.5">
                            {childTickets.map(child => {
                                const isSelected = selectedIds.has(child.id);
                                return (
                                    <button
                                        key={child.id}
                                        onClick={() => toggleChild(child.id)}
                                        className={`w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all active:scale-[0.98] ${isSelected ? 'bg-emerald-500' : 'bg-white border border-slate-200 shadow-sm'}`}
                                    >
                                        <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-white text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                            {isSelected ? <Check className="w-5 h-5" strokeWidth={3} /> : <Baby className="w-5 h-5" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className={`font-semibold text-sm truncate ${isSelected ? 'text-black' : 'text-slate-700'}`}>{child.firstName} {child.lastName}</p>
                                            <p className={`text-xs ${isSelected ? 'text-black/60' : 'text-slate-400'}`}>{isSelected ? 'Vino' : 'Tocá si vino'}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

            </div>

            <div className="p-4 sticky bottom-0 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent pt-8">
                <button
                    onClick={handleAcreditar}
                    disabled={saving}
                    className="w-full max-w-md mx-auto flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white font-black uppercase tracking-wide rounded-2xl text-sm disabled:opacity-50 active:scale-[0.98] transition-all"
                >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                    Acreditar
                </button>
            </div>
        </div>
    );
};

export default AcreditarEscaneoDiaNino;
