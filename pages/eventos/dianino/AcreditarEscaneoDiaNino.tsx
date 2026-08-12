import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDianinoSessionForCheckin, checkinDianinoTicket, uncheckinDianinoTicket, DianinoSessionCheckinTicket } from '../../../services/supabaseService';
import { ChevronLeft, User, Baby, Check, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

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
        navigate('/eventos/admin/diadelnino/escaner', { replace: true });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-white/40" />
            </div>
        );
    }

    if (notFound || !adultTicket) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
                <AlertTriangle className="w-10 h-10 text-red-400 mb-3" />
                <p className="text-white font-semibold mb-6">No pudimos encontrar esta entrada.</p>
                <button
                    onClick={() => navigate('/eventos/admin/diadelnino/escaner', { replace: true })}
                    className="px-5 py-3 bg-white text-black font-bold rounded-full text-sm"
                >
                    Volver a escanear
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col">
            <div className="p-4">
                <button
                    onClick={() => navigate('/eventos/admin/diadelnino/escaner', { replace: true })}
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white/50 hover:text-white transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" /> Volver a escanear
                </button>
            </div>

            <div className="flex-1 px-4 pb-6 max-w-md w-full mx-auto space-y-5">

                {/* Estado de la Declaración — bien visible */}
                {declaracionAceptada ? (
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30">
                        <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                        <p className="text-emerald-300 font-bold text-sm">Aceptó la Declaración de Conformidad</p>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40">
                        <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
                        <div>
                            <p className="text-amber-300 font-bold text-sm">NO aceptó la Declaración de Conformidad</p>
                            <p className="text-amber-300/70 text-xs mt-0.5">Decidí si esta familia puede ingresar.</p>
                        </div>
                    </div>
                )}

                {/* Adulto responsable — informativo, sin nada para tildar */}
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-2">Adulto responsable</p>
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
                        <div className="w-11 h-11 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
                            <User className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-white font-semibold text-sm truncate">{adultTicket.firstName} {adultTicket.lastName}</p>
                            <p className="text-white/40 text-xs">Ya acreditado</p>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    </div>
                </div>

                {/* Niños — tildar quiénes vinieron */}
                {childTickets.length > 0 && (
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-2">
                            Niños — tocá para marcar quién vino
                        </p>
                        <div className="space-y-2.5">
                            {childTickets.map(child => {
                                const isSelected = selectedIds.has(child.id);
                                return (
                                    <button
                                        key={child.id}
                                        onClick={() => toggleChild(child.id)}
                                        className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all active:scale-[0.98] ${isSelected ? 'bg-emerald-500/15 border-emerald-500/40' : 'bg-white/5 border-white/10'}`}
                                    >
                                        <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/40'}`}>
                                            {isSelected ? <Check className="w-5 h-5" strokeWidth={3} /> : <Baby className="w-5 h-5" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className={`font-semibold text-sm truncate ${isSelected ? 'text-white' : 'text-white/70'}`}>{child.firstName} {child.lastName}</p>
                                            <p className="text-white/30 text-xs">{isSelected ? 'Vino' : 'Tocá si vino'}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

            </div>

            <div className="p-4 sticky bottom-0 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent pt-8">
                <button
                    onClick={handleAcreditar}
                    disabled={saving}
                    className="w-full max-w-md mx-auto flex items-center justify-center gap-2 py-4 bg-emerald-500 text-white font-black uppercase tracking-wide rounded-2xl text-sm disabled:opacity-50 active:scale-[0.98] transition-all"
                >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                    Acreditar
                </button>
            </div>
        </div>
    );
};

export default AcreditarEscaneoDiaNino;
