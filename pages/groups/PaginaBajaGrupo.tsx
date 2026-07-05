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
            setSubmitError('Por favor ingresá una razón para la solicitud.');
            return;
        }
        if (requestType === 'USER' && !selectedUserId) {
            setSubmitError('Por favor seleccioná un miembro del grupo.');
            return;
        }

        setIsSubmitting(true);
        const success = await supabaseService.createDropoutRequest({
            groupId: group.id,
            hostId: currentUser.id,
            requestType,
            targetRegistrationId: requestType === 'USER' ? selectedUserId : undefined,
            targetUserName: requestType === 'USER' && selectedMember
                ? `${selectedMember.firstName} ${selectedMember.lastName}`
                : undefined,
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

                <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-black dark:text-white mb-6">
                    Nueva Solicitud de Baja
                </h1>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-4 border-2 border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Grupo</p>
                        <p className="font-black text-black dark:text-white uppercase">{group.name}</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                            Tipo de Solicitud
                        </label>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setRequestType('USER')}
                                className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-lg border-2 font-bold uppercase text-sm transition-all ${requestType === 'USER' ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' : 'bg-white dark:bg-black text-black dark:text-white border-slate-300 dark:border-slate-600 hover:border-black dark:hover:border-white'}`}
                            >
                                <UserMinus className="w-5 h-5" />
                                Usuario
                            </button>
                            <button
                                type="button"
                                onClick={() => setRequestType('GROUP')}
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
                                        className="w-full flex items-center justify-between p-3 bg-white dark:bg-black border-2 border-black dark:border-white rounded-lg text-left hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                                    >
                                        <span className={`font-bold uppercase ${selectedMember ? 'text-black dark:text-white' : 'text-slate-400'}`}>
                                            {selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : 'Seleccionar miembro...'}
                                        </span>
                                        <ChevronDown className={`w-5 h-5 transition-transform text-black dark:text-white ${isSelectOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isSelectOpen && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setIsSelectOpen(false)} />
                                            <div className="absolute z-20 w-full mt-1 bg-white dark:bg-black border-2 border-black dark:border-white rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                {approvedMembers.map((member) => (
                                                    <button
                                                        key={member.id}
                                                        type="button"
                                                        onClick={() => { setSelectedUserId(member.id); setIsSelectOpen(false); }}
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
                            Razón (Asunto)
                        </label>
                        <input
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Ej. Inasistencia reiterada"
                            className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-lg text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
                            maxLength={100}
                            required
                        />
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
                            className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-lg text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black resize-none"
                            maxLength={500}
                        />
                    </div>

                    {submitError && (
                        <p className="text-sm text-red-600 font-semibold text-center">{submitError}</p>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting || (requestType === 'USER' && !selectedUserId)}
                        className="w-full flex items-center justify-center gap-2 p-4 bg-black dark:bg-white text-white dark:text-black font-black uppercase tracking-wider rounded-lg hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Enviando...
                            </>
                        ) : (
                            <>
                                <Send className="w-5 h-5" />
                                Enviar Solicitud
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PaginaBajaGrupo;
