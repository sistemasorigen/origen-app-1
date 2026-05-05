import React, { useState } from 'react';
import { Group, GroupRegistration } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import NeoModal from '../ui/NeoModal';
import { UserMinus, Users, Send, ChevronDown } from 'lucide-react';

interface DropoutRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    group: Group;
    currentUserId: string;
    onSuccess?: () => void;
}

const DropoutRequestModal: React.FC<DropoutRequestModalProps> = ({
    isOpen,
    onClose,
    group,
    currentUserId,
    onSuccess
}) => {
    const [requestType, setRequestType] = useState<'USER' | 'GROUP'>('USER');
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [reason, setReason] = useState('');
    const [details, setDetails] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSelectOpen, setIsSelectOpen] = useState(false);

    // Filter only approved members
    const approvedMembers = (group.registrations || []).filter(
        (r: GroupRegistration) => r.status === 'APPROVED'
    );

    const selectedMember = approvedMembers.find(m => m.id === selectedUserId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!reason.trim()) {
            alert('Por favor ingresa una razón para la solicitud.');
            return;
        }

        if (requestType === 'USER' && !selectedUserId) {
            alert('Por favor selecciona un miembro del grupo.');
            return;
        }

        setIsSubmitting(true);

        const success = await supabaseService.createDropoutRequest({
            groupId: group.id,
            hostId: currentUserId,
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
            alert('Solicitud enviada correctamente. Un administrador la revisará pronto.');
            onSuccess?.();
            onClose();
        } else {
            alert('Error al enviar la solicitud. Intenta nuevamente.');
        }
    };

    const resetForm = () => {
        setRequestType('USER');
        setSelectedUserId('');
        setReason('');
        setDetails('');
    };

    return (
        <NeoModal isOpen={isOpen} onClose={() => { resetForm(); onClose(); }} title="Nueva Solicitud de Baja">
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Group Info Header */}
                <div className="bg-slate-100 rounded-lg p-4 border-2 border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Grupo</p>
                    <p className="font-black text-black uppercase">{group.name}</p>
                </div>

                {/* Request Type Selector */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                        Tipo de Solicitud
                    </label>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => setRequestType('USER')}
                            className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-lg border-2 font-bold uppercase text-sm transition-all ${requestType === 'USER'
                                ? 'bg-black text-white border-black'
                                : 'bg-white text-black border-slate-300 hover:border-black'
                                }`}
                        >
                            <UserMinus className="w-5 h-5" />
                            Usuario
                        </button>
                        <button
                            type="button"
                            onClick={() => setRequestType('GROUP')}
                            className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-lg border-2 font-bold uppercase text-sm transition-all ${requestType === 'GROUP'
                                ? 'bg-red-600 text-white border-red-600'
                                : 'bg-white text-black border-slate-300 hover:border-red-600'
                                }`}
                        >
                            <Users className="w-5 h-5" />
                            Grupo
                        </button>
                    </div>
                </div>

                {/* Member Selector (only for USER type) */}
                {requestType === 'USER' && (
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Seleccionar Miembro
                        </label>
                        {approvedMembers.length === 0 ? (
                            <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg text-center">
                                <p className="text-sm text-yellow-700">Este grupo no tiene miembros aprobados.</p>
                            </div>
                        ) : (
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsSelectOpen(!isSelectOpen)}
                                    className="w-full flex items-center justify-between p-3 bg-white border-2 border-black rounded-lg text-left hover:bg-slate-50 transition-colors"
                                >
                                    <span className={`font-bold uppercase ${selectedMember ? 'text-black' : 'text-slate-400'}`}>
                                        {selectedMember
                                            ? `${selectedMember.firstName} ${selectedMember.lastName}`
                                            : 'Seleccionar miembro...'}
                                    </span>
                                    <ChevronDown className={`w-5 h-5 transition-transform ${isSelectOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isSelectOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-10"
                                            onClick={() => setIsSelectOpen(false)}
                                        />
                                        <div className="absolute z-20 w-full mt-1 bg-white border-2 border-black rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                            {approvedMembers.map((member) => (
                                                <button
                                                    key={member.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedUserId(member.id);
                                                        setIsSelectOpen(false);
                                                    }}
                                                    className={`w-full p-3 text-left hover:bg-slate-100 transition-colors border-b border-slate-100 last:border-b-0 ${selectedUserId === member.id ? 'bg-slate-100' : ''
                                                        }`}
                                                >
                                                    <p className="font-bold text-black uppercase text-sm">
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

                {/* Group Warning (only for GROUP type) */}
                {requestType === 'GROUP' && (
                    <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                        <p className="text-sm text-red-700 font-medium">
                            ⚠️ Esta solicitud pedirá la <strong>eliminación completa del grupo</strong>,
                            incluyendo todos los miembros y registros de asistencia.
                        </p>
                    </div>
                )}

                {/* Reason Field */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Razón (Asunto)
                    </label>
                    <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Ej. Inasistencia reiterada"
                        className="w-full p-3 bg-white border-2 border-black rounded-lg text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
                        maxLength={100}
                        required
                    />
                </div>

                {/* Details Field */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Detalles (Opcional)
                    </label>
                    <textarea
                        value={details}
                        onChange={(e) => setDetails(e.target.value)}
                        placeholder="Detalle la situación con más contexto..."
                        rows={4}
                        className="w-full p-3 bg-white border-2 border-black rounded-lg text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black resize-none"
                        maxLength={500}
                    />
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={isSubmitting || (requestType === 'USER' && !selectedUserId)}
                    className="w-full flex items-center justify-center gap-2 p-4 bg-black text-white font-black uppercase tracking-wider rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
        </NeoModal>
    );
};

export default DropoutRequestModal;
