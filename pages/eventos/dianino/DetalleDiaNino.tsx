import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDianinoSessionDetail } from '../../../services/supabaseService';
import { supabase } from '../../../services/supabaseClient';
import { DiaNinoSession, DiaNinoTicket } from '../../../types';
import { ChevronLeft, User, Baby, CheckCircle2, Circle, Loader2, PartyPopper, Mail } from 'lucide-react';

const DetalleDiaNino: React.FC = () => {
    const { sessionId } = useParams<{ sessionId: string }>();
    const navigate = useNavigate();

    const [session, setSession] = useState<DiaNinoSession | null>(null);
    const [tickets, setTickets] = useState<DiaNinoTicket[]>([]);
    const [loading, setLoading] = useState(true);

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

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
            </div>
        );
    }

    if (!session) return null;

    const allCheckedIn = tickets.length > 0 && tickets.every(t => t.status === 'CHECKED_IN');
    const adultTicket = tickets.find(t => t.isAdult);
    const childTickets = tickets.filter(t => !t.isAdult);

    const formatTime = (iso?: string) => {
        if (!iso) return '';
        return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
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
                            {allCheckedIn ? 'Todos escaneados' : `${tickets.filter(t => t.status === 'CHECKED_IN').length} de ${tickets.length}`}
                        </p>
                    </div>
                    <div className={`rounded-lg border p-4 ${session.declaracionJuradaAceptada ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Declaración jurada</p>
                        <p className={`font-bold text-sm flex items-center gap-1.5 ${session.declaracionJuradaAceptada ? 'text-emerald-700' : 'text-red-700'}`}>
                            {session.declaracionJuradaAceptada ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                            {session.declaracionJuradaAceptada ? 'Aceptó' : 'No aceptó'}
                        </p>
                    </div>
                </div>

                {/* Lista de personas */}
                <div className="space-y-3">
                    {adultTicket && (
                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                                    <User className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-semibold text-sm text-slate-900 truncate">{adultTicket.firstName} {adultTicket.lastName}</p>
                                    <p className="text-xs text-slate-400">DNI {adultTicket.dni} · Adulto responsable</p>
                                </div>
                            </div>
                            {adultTicket.status === 'CHECKED_IN' ? (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full shrink-0">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> {formatTime(adultTicket.checkedInAt)}
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full shrink-0">
                                    <Circle className="w-3.5 h-3.5" /> Pendiente
                                </span>
                            )}
                        </div>
                    )}

                    {childTickets.map(child => (
                        <div key={child.id} className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                                    <Baby className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-semibold text-sm text-slate-900 truncate">{child.firstName} {child.lastName}</p>
                                    <p className="text-xs text-slate-400">DNI {child.dni}</p>
                                </div>
                            </div>
                            {child.status === 'CHECKED_IN' ? (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full shrink-0">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> {formatTime(child.checkedInAt)}
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full shrink-0">
                                    <Circle className="w-3.5 h-3.5" /> Pendiente
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DetalleDiaNino;
