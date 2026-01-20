import React, { useState, useEffect } from 'react';
import NeoModal from '../NeoModal';
import { UserPlus, Search, CheckCircle, AlertCircle, Loader2, Heart } from 'lucide-react';
import { Group, GroupCategory } from '../../types';
import { supabaseService } from '../../services/supabaseService';

interface AdminAddMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    groups: Group[];
    currentGroup?: Group;
    categories?: GroupCategory[];
}

const AdminAddMemberModal: React.FC<AdminAddMemberModalProps> = ({ isOpen, onClose, onSave, groups, currentGroup, categories = [] }) => {
    const [selectedGroupId, setSelectedGroupId] = useState(currentGroup?.id || '');
    const [email, setEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [foundUserId, setFoundUserId] = useState<string | null>(null);

    // Partner fields for couples
    const [partnerEmail, setPartnerEmail] = useState('');
    const [partnerFirstName, setPartnerFirstName] = useState('');
    const [partnerLastName, setPartnerLastName] = useState('');
    const [partnerPhone, setPartnerPhone] = useState('');
    const [partnerFoundUserId, setPartnerFoundUserId] = useState<string | null>(null);
    const [partnerUserFoundState, setPartnerUserFoundState] = useState<'idle' | 'found' | 'not-found'>('idle');
    const [isPartnerSearching, setIsPartnerSearching] = useState(false);

    const [isSearching, setIsSearching] = useState(false);
    const [userFoundState, setUserFoundState] = useState<'idle' | 'found' | 'not-found'>('idle');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isCouplesGroup = (): boolean => {
        const selectedGroup = groups.find(g => g.id === selectedGroupId);
        if (!selectedGroup) return false;
        const cat = categories.find(c => c.id === selectedGroup.categoryId);
        const categoryName = cat?.name?.toLowerCase() || '';
        return categoryName === 'parejas' && selectedGroup.targetGender === 'Mixto';
    };

    const couplesMode = isCouplesGroup();

    useEffect(() => {
        if (isOpen) {
            setSelectedGroupId(currentGroup?.id || '');
            setEmail('');
            setFirstName('');
            setLastName('');
            setPhone('');
            setFoundUserId(null);
            setUserFoundState('idle');
            setPartnerEmail('');
            setPartnerFirstName('');
            setPartnerLastName('');
            setPartnerPhone('');
            setPartnerFoundUserId(null);
            setPartnerUserFoundState('idle');
        }
    }, [isOpen, currentGroup]);

    const handleEmailBlur = async () => {
        if (!email || !email.includes('@')) return;

        setIsSearching(true);
        setUserFoundState('idle');

        const user = await supabaseService.getUserByEmail(email);

        setIsSearching(false);
        if (user) {
            setUserFoundState('found');
            setFoundUserId(user.id);
            const nameParts = user.name.split(' ');
            if (nameParts.length > 0) setFirstName(nameParts[0]);
            if (nameParts.length > 1) setLastName(nameParts.slice(1).join(' '));
            if (user.phone) setPhone(user.phone);
        } else {
            setUserFoundState('not-found');
            setFoundUserId(null);
        }
    };

    const handlePartnerEmailBlur = async () => {
        if (!partnerEmail || !partnerEmail.includes('@')) return;

        setIsPartnerSearching(true);
        setPartnerUserFoundState('idle');

        const user = await supabaseService.getUserByEmail(partnerEmail);

        setIsPartnerSearching(false);
        if (user) {
            setPartnerUserFoundState('found');
            setPartnerFoundUserId(user.id);
            const nameParts = user.name.split(' ');
            if (nameParts.length > 0) setPartnerFirstName(nameParts[0]);
            if (nameParts.length > 1) setPartnerLastName(nameParts.slice(1).join(' '));
            if (user.phone) setPartnerPhone(user.phone);
        } else {
            setPartnerUserFoundState('not-found');
            setPartnerFoundUserId(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGroupId) {
            alert('Por favor selecciona un grupo.');
            return;
        }

        if (couplesMode) {
            if (!partnerFirstName || !partnerLastName || !partnerEmail || !partnerPhone) {
                alert('Por favor completa todos los datos de la pareja.');
                return;
            }
            if (partnerEmail.toLowerCase().trim() === email.toLowerCase().trim()) {
                alert('El email de la pareja debe ser diferente al del participante principal.');
                return;
            }
        }

        setIsSubmitting(true);
        const success = await supabaseService.adminAddMemberToGroup({
            groupId: selectedGroupId,
            userId: foundUserId,
            firstName,
            lastName,
            email,
            phone,
            partnerData: couplesMode ? {
                firstName: partnerFirstName,
                lastName: partnerLastName,
                email: partnerEmail,
                phone: partnerPhone
            } : undefined,
            partnerUserId: couplesMode ? partnerFoundUserId : undefined
        });
        setIsSubmitting(false);

        if (success) {
            onSave();
            onClose();
        } else {
            alert('Hubo un error al agregar el participante. Revisa la consola o intenta nuevamente.');
        }
    };

    return (
        <NeoModal
            isOpen={isOpen}
            onClose={onClose}
            title={couplesMode ? 'Agregar Pareja' : 'Agregar Miembro'}
        >
            <form onSubmit={handleSubmit} className="space-y-6">

                {/* GROUP SELECTOR */}
                <div>
                    <label className="text-xs font-black uppercase tracking-widest block mb-1">Grupo de Conexión</label>
                    <select
                        value={selectedGroupId}
                        onChange={e => setSelectedGroupId(e.target.value)}
                        className="w-full p-4 border-2 border-black font-bold outline-none bg-white appearance-none"
                        required
                    >
                        <option value="">-- Seleccionar Grupo --</option>
                        {groups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>
                    {couplesMode && (
                        <p className="text-[10px] text-pink-600 font-bold mt-1 uppercase flex items-center gap-1 border border-pink-200 bg-pink-50 p-1 inline-block">
                            <Heart className="w-3 h-3" /> Grupo de Parejas
                        </p>
                    )}
                </div>

                {/* MAIN PARTICIPANT */}
                <div className="space-y-4">
                    {couplesMode && (
                        <div className="text-xs font-black uppercase border-b-2 border-black pb-1">
                            Participante 1 (Principal)
                        </div>
                    )}

                    <div className="relative">
                        <label className="text-xs font-black uppercase tracking-widest block mb-1">Email {couplesMode ? 'Participante 1' : ''}</label>
                        <div className="relative">
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                onBlur={handleEmailBlur}
                                placeholder="ejemplo@email.com"
                                className={`w-full p-4 border-2 font-bold outline-none pr-10 transition-colors ${userFoundState === 'found' ? 'border-green-600 bg-green-50' :
                                        userFoundState === 'not-found' ? 'border-yellow-600 bg-yellow-50' :
                                            'border-black bg-white'
                                    }`}
                                required
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                {isSearching ? <Loader2 className="w-5 h-5 animate-spin text-neutral-400" /> :
                                    userFoundState === 'found' ? <CheckCircle className="w-5 h-5 text-green-600" /> :
                                        userFoundState === 'not-found' ? <UserPlus className="w-5 h-5 text-yellow-600" /> :
                                            <Search className="w-5 h-5 text-neutral-300" />
                                }
                            </div>
                        </div>
                        {userFoundState === 'found' && <p className="text-[10px] text-green-700 font-bold uppercase mt-1">Usuario encontrado.</p>}
                        {userFoundState === 'not-found' && <p className="text-[10px] text-yellow-700 font-bold uppercase mt-1">Usuario nuevo.</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold uppercase block">Nombre</label>
                            <input
                                type="text"
                                value={firstName}
                                onChange={e => setFirstName(e.target.value)}
                                className="w-full p-2 border-2 border-black font-bold"
                                placeholder="Ej. Juan"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase block">Apellido</label>
                            <input
                                type="text"
                                value={lastName}
                                onChange={e => setLastName(e.target.value)}
                                className="w-full p-2 border-2 border-black font-bold"
                                placeholder="Ej. Pérez"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase block">Teléfono</label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            className="w-full p-2 border-2 border-black font-bold"
                            placeholder="+54 9 11 ..."
                            required
                        />
                    </div>
                </div>

                {/* PARTNER SECTION */}
                {couplesMode && (
                    <div className="space-y-4 pt-4 border-t-2 border-pink-200">
                        <div className="text-xs font-black uppercase text-pink-600 pb-1 flex items-center gap-1">
                            <Heart className="w-4 h-4" /> Participante 2 (Pareja)
                        </div>

                        <div className="relative">
                            <label className="text-[10px] font-bold uppercase text-pink-600 block mb-1">Email Pareja</label>
                            <div className="relative">
                                <input
                                    type="email"
                                    value={partnerEmail}
                                    onChange={e => setPartnerEmail(e.target.value)}
                                    onBlur={handlePartnerEmailBlur}
                                    placeholder="pareja@email.com"
                                    className={`w-full p-4 border-2 font-bold outline-none pr-10 transition-colors ${partnerUserFoundState === 'found' ? 'border-green-600 bg-green-50' :
                                            partnerUserFoundState === 'not-found' ? 'border-yellow-600 bg-yellow-50' :
                                                'border-pink-200 bg-pink-50'
                                        }`}
                                    required
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                    {isPartnerSearching ? <Loader2 className="w-5 h-5 animate-spin text-neutral-400" /> :
                                        partnerUserFoundState === 'found' ? <CheckCircle className="w-5 h-5 text-green-600" /> :
                                            partnerUserFoundState === 'not-found' ? <UserPlus className="w-5 h-5 text-yellow-600" /> :
                                                <Search className="w-5 h-5 text-pink-300" />
                                    }
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold uppercase text-pink-600 block">Nombre</label>
                                <input
                                    type="text"
                                    value={partnerFirstName}
                                    onChange={e => setPartnerFirstName(e.target.value)}
                                    className="w-full p-2 border-2 border-pink-200 bg-pink-50 font-bold outline-pink-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase text-pink-600 block">Apellido</label>
                                <input
                                    type="text"
                                    value={partnerLastName}
                                    onChange={e => setPartnerLastName(e.target.value)}
                                    className="w-full p-2 border-2 border-pink-200 bg-pink-50 font-bold outline-pink-500"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold uppercase text-pink-600 block">Teléfono</label>
                            <input
                                type="tel"
                                value={partnerPhone}
                                onChange={e => setPartnerPhone(e.target.value)}
                                className="w-full p-2 border-2 border-pink-200 bg-pink-50 font-bold outline-pink-500"
                                required
                            />
                        </div>
                    </div>
                )}

                {/* INFO BOX */}
                <div className={`p-4 border-2 border-black flex gap-3 items-start ${couplesMode ? 'bg-pink-100' : 'bg-neutral-100'}`}>
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-xs font-medium leading-tight">
                        {couplesMode
                            ? "Al agregar la pareja, ambos serán listados como MIEMBROS APROBADOS. Cuentan como 1 cupo (2 personas)."
                            : "La persona será listada como MIEMBRO APROBADO inmediatamente."
                        }
                    </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-4 font-bold uppercase text-neutral-500 hover:text-black hover:bg-neutral-100 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`flex-1 py-4 text-white font-black uppercase tracking-widest border-2 border-black hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2 ${couplesMode ? 'bg-pink-600' : 'bg-black'}`}
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                        {isSubmitting ? 'Guardando...' : couplesMode ? 'Agregar Pareja' : 'Agregar Miembro'}
                    </button>
                </div>
            </form>
        </NeoModal>
    );
};

export default AdminAddMemberModal;
