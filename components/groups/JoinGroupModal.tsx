import React, { useState, useEffect } from 'react';
import NeoModal from '../NeoModal';
import { ArrowRight, Info, CheckCircle2, Heart, Users, Check } from 'lucide-react';
import { Group, User, GroupRegistration, SystemNotification, UserRole, GroupCategory, GroupTag } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { db } from '../../services/dbService';

interface JoinGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    group: Group;
    currentUser: User | null;
    userStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
    onSuccess?: () => void;
    categories?: GroupCategory[];
    tags?: GroupTag[];
}

const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const JoinGroupModal: React.FC<JoinGroupModalProps> = ({ isOpen, onClose, group, currentUser, userStatus, onSuccess, categories = [], tags = [] }) => {

    const getCategoryName = (): string => {
        if (!group.categoryId) return '';
        if (typeof group.categoryId === 'string' && group.categoryId.toLowerCase() === 'parejas') {
            return 'parejas';
        }
        if (categories.length) {
            const cat = categories.find(c => c.id === group.categoryId);
            if (cat?.name) return cat.name.toLowerCase();
        }
        return '';
    };

    const categoryName = getCategoryName();
    const hasParejasTag = group.tags?.some(tId => tags.find(t => t.id === tId)?.name?.toLowerCase() === 'parejas') || false;
    const isCouplesGroup = (categoryName === 'parejas' || hasParejasTag) && group.targetGender === 'Mixto';

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: ''
    });

    const [partnerData, setPartnerData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: ''
    });

    const [partnerAccount, setPartnerAccount] = useState<{ id: string; name: string } | null>(null);
    const [checkingPartner, setCheckingPartner] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successView, setSuccessView] = useState(false);

    useEffect(() => {
        if (isOpen && currentUser) {
            const nameParts = currentUser.name ? currentUser.name.split(' ') : [''];
            const firstName = nameParts[0] || '';
            const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

            setFormData({
                firstName: firstName,
                lastName: lastName,
                email: currentUser.email || '',
                phone: currentUser.phone || ''
            });
        } else if (isOpen) {
            setFormData({ firstName: '', lastName: '', email: '', phone: '' });
        }
        setPartnerData({ firstName: '', lastName: '', email: '', phone: '' });
        setPartnerAccount(null);
        setError(null);
        setSuccessView(false);
    }, [isOpen, currentUser]);

    const handlePartnerEmailBlur = async () => {
        if (!isCouplesGroup || !partnerData.email) return;

        setCheckingPartner(true);
        try {
            const foundUser = await supabaseService.findUserByEmail(partnerData.email);
            setPartnerAccount(foundUser);

            if (foundUser && foundUser.name) {
                const nameParts = foundUser.name.split(' ');
                setPartnerData(prev => ({
                    ...prev,
                    firstName: nameParts[0] || prev.firstName,
                    lastName: nameParts.slice(1).join(' ') || prev.lastName
                }));
            }
        } catch (err) {
            console.error('Error checking partner email:', err);
        } finally {
            setCheckingPartner(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        if (!formData.firstName || !formData.lastName || !formData.phone || !formData.email) {
            setError("Todos los campos son obligatorios.");
            setIsSubmitting(false);
            return;
        }

        if (isCouplesGroup) {
            if (!partnerData.firstName || !partnerData.lastName || !partnerData.phone || !partnerData.email) {
                setError("Los datos de tu pareja son obligatorios para este grupo.");
                setIsSubmitting(false);
                return;
            }

            if (partnerData.email.toLowerCase().trim() === formData.email.toLowerCase().trim()) {
                setError("El email de tu pareja debe ser diferente al tuyo.");
                setIsSubmitting(false);
                return;
            }
        }

        if (userStatus === 'PENDING') {
            setError("Ya tienes una solicitud pendiente para este grupo.");
            setIsSubmitting(false);
            return;
        }
        if (userStatus === 'APPROVED') {
            setError("Ya eres miembro de este grupo.");
            setIsSubmitting(false);
            return;
        }

        if (isCouplesGroup) {
            const partnerExists = await supabaseService.checkPartnerEmailExists(group.id, partnerData.email);
            if (partnerExists) {
                setError("El email de tu pareja ya está registrado en este grupo.");
                setIsSubmitting(false);
                return;
            }
        }

        const reg: GroupRegistration = {
            id: generateUUID(),
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            timestamp: new Date().toISOString(),
            groupId: group.id,
            status: 'PENDING',
            userId: currentUser?.id,
            partnerData: isCouplesGroup ? partnerData : undefined,
            partnerUserId: isCouplesGroup && partnerAccount ? partnerAccount.id : undefined
        };

        try {
            const success = await supabaseService.registerMemberToGroup(reg);

            if (success) {
                const notifMessage = isCouplesGroup
                    ? `${formData.firstName} ${formData.lastName} y ${partnerData.firstName} ${partnerData.lastName} se inscribieron como pareja en ${group.name}.`
                    : `${formData.firstName} ${formData.lastName} se unió a ${group.name}.`;

                const notif: SystemNotification = {
                    id: generateUUID(),
                    title: isCouplesGroup ? 'Nueva Pareja Inscrita' : 'Nuevo Miembro Inscrito',
                    message: notifMessage,
                    details: `Tel: ${formData.phone}. Email: ${formData.email}${isCouplesGroup ? ` | Pareja: ${partnerData.firstName} (${partnerData.email})` : ''}`,
                    timestamp: new Date().toISOString(),
                    read: false,
                    targetRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS, UserRole.ANFITRION],
                    type: 'REGISTRATION',
                    metadata: { groupId: group.id, ...formData }
                };

                const list = db.getNotifications();
                list.unshift(notif);
                localStorage.setItem('notifications', JSON.stringify(list));

                if (onSuccess) onSuccess();
                setSuccessView(true);

            } else {
                setError("Hubo un error al enviar la solicitud. Intenta nuevamente.");
            }
        } catch (err: any) {
            console.error("Join Error:", err);
            setError("Error de conexión.");
        } finally {
            setIsSubmitting(false);
        }
    };


    // Success View via NeoModal content replacement
    if (successView) {
        return (
            <NeoModal isOpen={isOpen} onClose={onClose} title="¡Solicitud Enviada!" maxWidth="md:max-w-md lg:max-w-lg">
                <div className="flex flex-col items-center text-center pb-4">
                    <div className="w-20 h-20 bg-green-400 border-4 border-black flex items-center justify-center mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <CheckCircle2 className="w-10 h-10 text-black" />
                    </div>
                    <p className="font-bold text-lg mb-6 leading-tight">
                        {isCouplesGroup
                            ? 'La solicitud de pareja ha sido enviada al anfitrión.'
                            : 'Tu solicitud ha sido enviada al anfitrión.'}
                    </p>
                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-black text-white font-black uppercase tracking-widest border-2 border-black hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                    >
                        Entendido
                    </button>
                </div>
            </NeoModal>
        );
    }

    return (
        <NeoModal isOpen={isOpen} onClose={onClose} title={isCouplesGroup ? 'Inscripción de Pareja' : 'Unirse al Grupo'}>
            <div className="space-y-6 pb-2">
                {/* Header Info */}
                <div className="bg-neutral-100 border-l-4 border-black p-4">
                    <p className="text-xs font-bold uppercase text-neutral-500">Conectando con</p>
                    <p className="font-black text-lg md:text-xl lg:text-2xl uppercase">{group.name}</p>
                </div>

                {isCouplesGroup && (
                    <div className="bg-pink-100 p-4 border-2 border-black flex gap-3 items-start shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <Heart className="w-5 h-5 text-black shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-black uppercase mb-1">Grupo para Parejas</p>
                            <p className="text-xs font-medium">Completa los datos de ambos integrantes.</p>
                        </div>
                    </div>
                )}

                <div className="space-y-6">
                    {/* Main User Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b-2 border-black pb-2">
                            <Users className="w-4 h-4" />
                            <span className="text-xs font-black uppercase tracking-widest">
                                {isCouplesGroup ? 'Tus Datos' : 'Tu Información'}
                            </span>
                        </div>

                        {!isCouplesGroup && currentUser && (
                            <div className="text-xs font-bold text-blue-600 bg-blue-50 p-2 border border-blue-200">
                                Datos autocompletados. Verifica antes de enviar.
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <FormInput label="Nombre" value={formData.firstName} onChange={(v) => setFormData({ ...formData, firstName: v })} placeholder="Tu nombre" />
                            <FormInput label="Apellido" value={formData.lastName} onChange={(v) => setFormData({ ...formData, lastName: v })} placeholder="Tu apellido" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormInput label="Email" value={formData.email} onChange={(v) => setFormData({ ...formData, email: v })} type="email" placeholder="Tu email" />
                            <FormInput label="Teléfono" value={formData.phone} onChange={(v) => setFormData({ ...formData, phone: v })} type="tel" placeholder="Tu teléfono" />
                        </div>
                    </div>

                    {/* Partner Section */}
                    {isCouplesGroup && (
                        <div className="space-y-4 pt-2">
                            <div className="flex items-center justify-between border-b-2 border-black pb-2">
                                <div className="flex items-center gap-2">
                                    <Heart className="w-4 h-4 text-pink-600" />
                                    <span className="text-xs font-black uppercase tracking-widest">Datos de tu Pareja</span>
                                </div>
                                {partnerAccount && (
                                    <span className="text-[10px] font-bold bg-green-200 px-2 py-0.5 border border-black">
                                        Cuenta encontrada
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormInput label="Email de tu Pareja" value={partnerData.email} onChange={(v) => setPartnerData({ ...partnerData, email: v })} type="email" placeholder="Email para vincular" onBlur={handlePartnerEmailBlur} isValid={!!partnerAccount} />
                                <FormInput label="Teléfono" value={partnerData.phone} onChange={(v) => setPartnerData({ ...partnerData, phone: v })} type="tel" placeholder="Teléfono" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <FormInput label="Nombre" value={partnerData.firstName} onChange={(v) => setPartnerData({ ...partnerData, firstName: v })} placeholder="Nombre" />
                                <FormInput label="Apellido" value={partnerData.lastName} onChange={(v) => setPartnerData({ ...partnerData, lastName: v })} placeholder="Apellido" />
                            </div>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="p-3 bg-red-100 border-2 border-black text-red-600 font-bold text-xs uppercase text-center">
                        {error}
                    </div>
                )}

                <div className="flex md:justify-end mt-4">
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="w-full md:w-auto md:px-10 py-4 bg-black text-white font-black uppercase tracking-widest border-2 border-black hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? 'Enviando...' : (
                            <>
                                {isCouplesGroup ? 'INSCRIBIR PAREJA' : 'ENVIAR SOLICITUD'}
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </NeoModal>
    );
};

const FormInput = ({ label, value, onChange, type = "text", placeholder, onBlur, isValid }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
    placeholder?: string;
    onBlur?: () => void;
    isValid?: boolean;
}) => (
    <div className="space-y-1">
        <label className="text-[10px] font-black uppercase tracking-widest ml-1">{label}</label>
        <div className="relative">
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                className={`w-full p-3 border-2 border-black font-bold outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all placeholder:text-neutral-400 rounded-none ${isValid ? 'border-green-600 bg-green-50' : 'bg-white'}`}
                placeholder={placeholder}
            />
            {isValid && <Check className="absolute right-3 top-3.5 w-4 h-4 text-green-600" />}
        </div>
    </div>
);

export default JoinGroupModal;
