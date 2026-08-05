import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDianinoSessionDetail, checkinDianinoTicket, uncheckinDianinoTicket } from '../../../services/supabaseService';
import { supabase } from '../../../services/supabaseClient';
import { DiaNinoSession, DiaNinoTicket } from '../../../types';
import { ChevronLeft, User, Baby, CheckCircle2, Circle, Loader2, PartyPopper, Mail, X, Undo2 } from 'lucide-react';

const DetalleDiaNino: React.FC = () => {
    const { sessionId } = useParams<{ sessionId: string }>();
    const navigate = useNavigate();

    const [session, setSession] = useState<DiaNinoSession | null>(null);
    const [tickets, setTickets] = useState<DiaNinoTicket[]>([]);
    const [loading, setLoading] = useState(true);

    const [checkingInId, setCheckingInId] = useState<string | null>(null);
    const [confirmation, setConfirmation] = useState<{ name: string } | null>(null);
    const confirmationTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const [confirmUndoId, setConfirmUndoId] = useState<string | null>(null);
    const [undoingId, setUndoingId] = useState<string | null>(null);

    const fetchDetail = useCallback(async () => {
        if (!sessionId) return;
        const detail = await getDianinoSessionDetail(sessionId);
        if (!detail) {
            navigate('/eventos/admin/diadelnino', { replace: true });
            return;
        }
        setSession(detail.session);
        setTickets(detail.tickets);
        setLoading(false);
    }, [sessionId, navigate]);

    useEffect(() => { fetchDetail(); }, [fetchDetail]);

    useEffect(() => {
        if (!sessionId) return;
        const channel = supabase
            .channel(`dianino-session-${sessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'dianino_tickets',
                    filter: `session_id=eq.${sessionId}`
                },
                () => { fetchDetail(); }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [sessionId, fetchDetail]);

    const handleManualCheckIn = async (ticket: DiaNinoTicket) => {
        if (ticket.status === 'CHECKED_IN' || checkingInId) return;

        setCheckingInId(ticket.id);
        const res = await checkinDianinoTicket(ticket.id);
        setCheckingInId(null);

        if (res && (res.result === 'SUCCESS' || res.result === 'ALREADY_CHECKED_IN')) {
            if (confirmationTimeoutRef.current) clearTimeout(confirmationTimeoutRef.current);
            setConfirmation({ name: `${ticket.firstName} ${ticket.lastName}` });
            confirmationTimeoutRef.current = setTimeout(() => setConfirmation(null), 2500);
        }
    };

    const handleUndoCheckIn = async (ticket: DiaNinoTicket) => {
        setUndoingId(ticket.id);
        await uncheckinDianinoTicket(ticket.id);
        setUndoingId(null);
        setConfirmUndoId(null);
        // El cambio se refleja solo vía la suscripción
        // de Realtime — no hace falta actualizar el
        // estado local a mano acá.
    };

    useEffect(() => {
        return () => { if (confirmationTimeoutRef.current) clearTimeout(confirmationTimeoutRef.current); };
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
            </div>
        );
    }

    if (!session) return null;

    const childTickets = tickets.filter(t => !t.isAdult);
    // El adulto no necesita acreditarse — "todos
    // escaneados" se mide solo contra los niños.
    const allCheckedIn = childTickets.length > 0 && childTickets.every(t => t.status === 'CHECKED_IN');
    const adultTicket = tickets.find(t => t.isAdult);

    const formatTime = (iso?: string) => {
        if (!iso) return '';
        return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    };

    const renderPersonRow = (ticket: DiaNinoTicket, isAdultRow: boolean) => {
        const isChecked = ticket.status === 'CHECKED_IN';
        const isLoading = checkingInId === ticket.id;
        const clickable = !isChecked && !isLoading;

        // Es un <div role="button">, no un <button>, porque el badge
        // de CHECKED_IN aloja botones propios (Desacreditar/Confirmar)
        // — HTML no permite anidar <button> dentro de <button>.
        return (
            <div
                key={ticket.id}
                role="button"
                tabIndex={clickable ? 0 : -1}
                aria-disabled={!clickable}
                onClick={() => clickable && handleManualCheckIn(ticket)}
                onKeyDown={e => {
                    if (clickable && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        handleManualCheckIn(ticket);
                    }
                }}
                className={`w-full bg-white rounded-lg border border-slate-200 shadow-sm p-4 flex items-center justify-between gap-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black ${clickable ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'}`}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isAdultRow ? 'bg-orange-50 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isAdultRow ? <User className="w-4 h-4" /> : <Baby className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-900 truncate">{ticket.firstName} {ticket.lastName}</p>
                        <p className="text-xs text-slate-400">DNI {ticket.dni}{isAdultRow && ' · Adulto responsable'}</p>
                    </div>
                </div>
                {isChecked ? (
                    <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {formatTime(ticket.checkedInAt)}
                        </span>
                        {confirmUndoId === ticket.id ? (
                            <button
                                type="button"
                                onClick={() => handleUndoCheckIn(ticket)}
                                disabled={undoingId === ticket.id}
                                className="flex items-center gap-1 text-[10px] font-black uppercase text-white bg-red-600 hover:bg-red-700 px-2 py-1.5 rounded-lg transition-colors"
                            >
                                {undoingId === ticket.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirmar'}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setConfirmUndoId(ticket.id)}
                                title="Desacreditar"
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                <Undo2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full shrink-0">
                        <Circle className="w-3.5 h-3.5" /> Pendiente
                    </span>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
                <button
                    onClick={() => navigate('/eventos/admin/diadelnino')}
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400 hover:text-black transition-colors mb-4"
                >
                    <ChevronLeft className="w-4 h-4" /> Día del Niño
                </button>

                <h1 className="text-2xl font-black uppercase tracking-tight text-black flex items-center gap-2 mb-1">
                    <PartyPopper className="w-6 h-6 text-orange-500" />
                    {adultTicket?.firstName} {adultTicket?.lastName}
                </h1>
                <p className="text-sm text-slate-500 flex items-center gap-1.5 mb-6">
                    <Mail className="w-3.5 h-3.5" /> {session.email}
                </p>

                {/* Estado agregado, en tiempo real */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className={`rounded-lg border p-4 ${allCheckedIn ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Escaneo</p>
                        <p className={`font-bold text-sm flex items-center gap-1.5 ${allCheckedIn ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {allCheckedIn ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                            {allCheckedIn ? 'Todos escaneados' : `${childTickets.filter(t => t.status === 'CHECKED_IN').length} de ${childTickets.length}`}
                        </p>
                    </div>
                    <div className={`rounded-lg border p-4 ${session.declaracionJuradaAceptada ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Declaración de Conformidad</p>
                        <p className={`font-bold text-sm flex items-center gap-1.5 ${session.declaracionJuradaAceptada ? 'text-emerald-700' : 'text-red-700'}`}>
                            {session.declaracionJuradaAceptada ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                            {session.declaracionJuradaAceptada ? 'Aceptó' : 'No aceptó'}
                        </p>
                    </div>
                </div>

                <p className="text-xs text-slate-400 mb-3">
                    Tocá a una persona pendiente para acreditarla manualmente, sin necesidad de escanear su QR.
                </p>

                {/* Lista de personas */}
                <div className="space-y-3">
                    {adultTicket && renderPersonRow(adultTicket, true)}
                    {childTickets.map(child => renderPersonRow(child, false))}
                </div>
            </div>

            {/* Confirmación — modal en desktop, bottom-sheet en mobile (mismo patrón que el dropdown del escáner) */}
            {confirmation && (
                <div
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
                    onClick={() => setConfirmation(null)}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className="relative w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-6 text-center space-y-3"
                    >
                        <button
                            type="button"
                            onClick={() => setConfirmation(null)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-black sm:hidden"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                            <CheckCircle2 className="w-7 h-7" />
                        </div>
                        <p className="font-bold text-slate-900">
                            {confirmation.name} fue acreditado correctamente
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DetalleDiaNino;
