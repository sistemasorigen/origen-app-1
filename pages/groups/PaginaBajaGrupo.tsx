import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Group, GroupRegistration } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { ArrowLeft, UserMinus, Users, Send, ChevronDown, Loader2 } from 'lucide-react';

const PaginaBajaGrupo: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();

    const [group, setGroup] = useState<Group | null>(null);
    const [loadingGroup, setLoadingGroup] = useState(true);

    const [requestType, setRequestType] = useState<'USER' | 'GROUP'>('USER');
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [reason, setReason] = useState('');
    const [details, setDetails] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSelectOpen, setIsSelectOpen] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    // Confirmación en 2 pasos, solo para la baja de un miembro.
    const [confirmandoBaja, setConfirmandoBaja] = useState(false);

    const fetchGroup = useCallback(async () => {
        if (!currentUser || !groupId) return;
        setLoadingGroup(true);
        try {
            const owned = await supabaseService.getGroupsByHost(currentUser.id);
            const found = owned.find(g => g.id === groupId);
            if (!found) {
                navigate('/mis-grupos', { replace: true });
                return;
            }
            setGroup(found);
        } finally {
            setLoadingGroup(false);
        }
    }, [currentUser, groupId, navigate]);

    useEffect(() => { fetchGroup(); }, [fetchGroup]);

    const approvedMembers = (group?.registrations || []).filter(
        (r: GroupRegistration) => r.status === 'APPROVED'
    );

    const selectedMember = approvedMembers.find(m => m.id === selectedUserId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError(null);

        if (!group) return;

        if (!reason.trim()) {
            setSubmitError(requestType === 'USER'
                ? 'Escribí el motivo de la baja.'
                : 'Escribí el motivo de la solicitud.');
            return;
        }
        if (requestType === 'USER' && !selectedUserId) {
            setSubmitError('Elegí un miembro del grupo.');
            return;
        }

        // La baja de un miembro es inmediata y no se puede deshacer, así que
        // se pide confirmación antes de ejecutarla. El cierre del grupo no la
        // necesita: todavía pasa por la aprobación de un administrador.
        if (requestType === 'USER' && !confirmandoBaja) {
            setConfirmandoBaja(true);
            return;
        }

        setIsSubmitting(true);

        // ── Baja de UN MIEMBRO: directa, sin aprobación ──
        // Misma secuencia que usa BandejaBajasAdmin al aprobar:
        // primero se borra la inscripción, y solo si eso salió
        // bien se deja el registro histórico. Al revés quedaría
        // un historial de una baja que nunca ocurrió.
        if (requestType === 'USER') {
            const deleted = await supabaseService.deleteGroupRegistration(selectedUserId, group.id);

            if (!deleted) {
                setIsSubmitting(false);
                setConfirmandoBaja(false);
                setSubmitError('No pudimos dar de baja al miembro. Intentá de nuevo.');
                return;
            }

            // Historial: queda el motivo y quién la hizo, ya resuelta.
            // Si esto falla no se revierte nada ni se muestra error — la baja,
            // que es lo que le importa al anfitrión, ya se ejecutó bien.
            await supabaseService.createDropoutRequest({
                groupId: group.id,
                hostId: currentUser.id,
                requestType,
                targetRegistrationId: selectedUserId,
                targetUserName: selectedMember
                    ? `${selectedMember.firstName} ${selectedMember.lastName}`
                    : undefined,
                reason: reason.trim(),
                details: details.trim() || undefined,
                status: 'APPROVED'
            });

            setIsSubmitting(false);
            navigate(`/mis-grupos/${groupId}`);
            return;
        }

        // ── Cierre del GRUPO ENTERO: sigue requiriendo aprobación ──
        const success = await supabaseService.createDropoutRequest({
            groupId: group.id,
            hostId: currentUser.id,
            requestType,
            targetRegistrationId: undefined,
            targetUserName: undefined,
            reason: reason.trim(),
            details: details.trim() || undefined,
            status: 'PENDING'
        });
        setIsSubmitting(false);

        if (success) {
            navigate(`/mis-grupos/${groupId}`);
        } else {
            setSubmitError('Error al enviar la solicitud. Intentá de nuevo.');
        }
    };

    if (loadingGroup) return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
            <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
        </div>
    );

    if (!group) return null;

    return (
        <div className="min-h-screen bg-white dark:bg-black">
            <div className="max-w-2xl mx-auto px-4 md:px-8 py-8">

                <button
                    onClick={() => navigate(`/mis-grupos/${groupId}`)}
                    className="flex items-center gap-2 text-sm text-slate-400 hover:text-black dark:hover:text-white transition-colors mb-6 font-bold uppercase tracking-wide"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {group.name}
                </button>

                <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-black dark:text-white mb-2">
                    {requestType === 'USER' ? 'Dar de baja a un miembro' : 'Solicitud de cierre del grupo'}
                </h1>
                <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
                    {requestType === 'USER'
                        ? 'La baja se aplica en el momento. No pasa por revisión y no se puede deshacer.'
                        : 'La solicitud queda pendiente hasta que un administrador la revise.'}
                </p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-4 border-2 border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Grupo</p>
                        <p className="font-black text-black dark:text-white uppercase">{group.name}</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                            Qué querés hacer
                        </label>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => { setRequestType('USER'); setConfirmandoBaja(false); setSubmitError(null); }}
                                className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-lg border-2 font-bold uppercase text-sm transition-all ${requestType === 'USER' ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' : 'bg-white dark:bg-black text-black dark:text-white border-slate-300 dark:border-slate-600 hover:border-black dark:hover:border-white'}`}
                            >
                                <UserMinus className="w-5 h-5" />
                                Usuario
                            </button>
                            <button
                                type="button"
                                onClick={() => { setRequestType('GROUP'); setConfirmandoBaja(false); setSubmitError(null); }}
                                className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-lg border-2 font-bold uppercase text-sm transition-all ${requestType === 'GROUP' ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-black text-black dark:text-white border-slate-300 dark:border-slate-600 hover:border-red-600'}`}
                            >
                                <Users className="w-5 h-5" />
                                Grupo
                            </button>
                        </div>
                    </div>

                    {requestType === 'USER' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                Seleccionar Miembro
                            </label>
                            {approvedMembers.length === 0 ? (
                                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-lg text-center">
                                    <p className="text-sm text-yellow-700 dark:text-yellow-400">Este grupo no tiene miembros aprobados.</p>
                                </div>
                            ) : (
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsSelectOpen(!isSelectOpen)}
                                        className="w-full flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-left hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                                    >
                                        <span className={`font-bold uppercase ${selectedMember ? 'text-black dark:text-white' : 'text-slate-400'}`}>
                                            {selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : 'Seleccionar miembro...'}
                                        </span>
                                        <ChevronDown className={`w-5 h-5 transition-transform text-black dark:text-white ${isSelectOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isSelectOpen && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setIsSelectOpen(false)} />
                                            <div className="absolute z-20 w-full mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                {approvedMembers.map((member) => (
                                                    <button
                                                        key={member.id}
                                                        type="button"
                                                        onClick={() => { setSelectedUserId(member.id); setIsSelectOpen(false); setConfirmandoBaja(false); }}
                                                        className={`w-full p-3 text-left hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-b-0 ${selectedUserId === member.id ? 'bg-slate-100 dark:bg-slate-900' : ''}`}
                                                    >
                                                        <p className="font-bold text-black dark:text-white uppercase text-sm">
                                                            {member.firstName} {member.lastName}
                                                        </p>
                                                        <p className="text-xs text-slate-500">{member.email}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {requestType === 'GROUP' && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                                ⚠️ Esta solicitud pedirá la <strong>eliminación completa del grupo</strong>,
                                incluyendo todos los miembros y registros de asistencia.
                            </p>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Motivo
                        </label>
                        <input
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Ej. Inasistencia reiterada"
                            className="w-full px-4 py-3.5 bg-white dark:bg-zinc-900 text-black dark:text-white border border-slate-300 dark:border-zinc-700 rounded-xl text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-900/10 dark:focus:ring-white/10"
                            maxLength={100}
                            required
                        />
                        <p className="text-xs text-slate-400 mt-1.5">
                            {requestType === 'USER'
                                ? 'Queda guardado en el historial de bajas del grupo.'
                                : 'Es lo que va a leer el administrador que revise la solicitud.'}
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Detalles (Opcional)
                        </label>
                        <textarea
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            placeholder="Detallá la situación con más contexto..."
                            rows={4}
                            className="w-full px-4 py-3.5 bg-white dark:bg-zinc-900 text-black dark:text-white border border-slate-300 dark:border-zinc-700 rounded-xl text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-900/10 dark:focus:ring-white/10 resize-none"
                            maxLength={500}
                        />
                    </div>

                    {submitError && (
                        <p className="text-sm text-red-600 font-semibold text-center">{submitError}</p>
                    )}

                    {/* Confirmación en 2 pasos: el mismo patrón de BandejaBajasAdmin,
                        no un confirm() nativo. Solo para la baja de un miembro, que
                        es la que se ejecuta al instante. */}
                    {confirmandoBaja && requestType === 'USER' && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl">
                            <p className="text-sm text-red-700 dark:text-red-400 font-semibold">
                                ¿Dar de baja a {selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : 'este miembro'}?
                            </p>
                            <p className="text-sm text-red-700/80 dark:text-red-400/80 mt-1">
                                Sale del grupo ahora mismo. Para volver a entrar tiene que inscribirse de nuevo.
                            </p>
                        </div>
                    )}

                    <div className="flex gap-3">
                        {confirmandoBaja && requestType === 'USER' && (
                            <button
                                type="button"
                                onClick={() => setConfirmandoBaja(false)}
                                disabled={isSubmitting}
                                className="px-6 py-4 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold transition-colors hover:bg-slate-200 dark:hover:bg-zinc-700 disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={isSubmitting || (requestType === 'USER' && !selectedUserId)}
                            className={`flex-1 flex items-center justify-center gap-2 py-4 font-semibold rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${confirmandoBaja && requestType === 'USER'
                                ? 'bg-red-600 text-white hover:bg-red-700'
                                : 'bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-slate-200'
                                }`}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    {requestType === 'USER' ? 'Dando de baja...' : 'Enviando...'}
                                </>
                            ) : requestType === 'USER' ? (
                                <>
                                    <UserMinus className="w-5 h-5" />
                                    {confirmandoBaja ? 'Sí, dar de baja' : 'Dar de baja'}
                                </>
                            ) : (
                                <>
                                    <Send className="w-5 h-5" />
                                    Enviar solicitud
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PaginaBajaGrupo;
