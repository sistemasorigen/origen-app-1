import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Group, GroupCategory, GroupTag } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { ArrowLeft, Search, UserCheck, UserPlus, ChevronLeft, Loader2, Check, Mail, Phone, Heart } from 'lucide-react';

type TipoParticipante = 'USUARIO' | 'INVITADO';

// Muestra solo los últimos 3 dígitos, el resto censurado
const maskPhone = (phone?: string): string => {
    if (!phone) return '—';
    const clean = phone.trim();
    if (clean.length <= 3) return clean;
    const visible = clean.slice(-3);
    const masked = '•'.repeat(clean.length - 3);
    return masked + visible;
};

const StepIndicator: React.FC<{ current: number; steps: string[] }> = ({ current, steps }) => {
    return (
        <div className="flex items-center gap-0 mb-6" role="list" aria-label="Progreso del formulario">
            {steps.map((label, i) => {
                const n = i + 1;
                const done = n < current;
                const active = n === current;
                return (
                    <React.Fragment key={n}>
                        <div role="listitem" aria-current={active ? 'step' : undefined} className="flex flex-col items-center gap-1 min-w-0">
                            <div className={`w-7 h-7 flex items-center justify-center border-2 font-black text-xs transition-all duration-200 ${done || active ? 'bg-black border-black text-white' : 'bg-white border-neutral-300 text-neutral-400'}`}>
                                {done ? '✓' : n}
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-widest transition-colors duration-200 ${active ? 'text-black dark:text-white' : 'text-neutral-400'}`}>
                                {label}
                            </span>
                        </div>
                        {i < steps.length - 1 && <div className={`flex-1 h-0.5 mb-4 transition-colors duration-300 ${done ? 'bg-black' : 'bg-neutral-200'}`} />}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

const PaginaInscribirParticipante: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();

    const [group, setGroup] = useState<Group | null>(null);
    const [categories, setCategories] = useState<GroupCategory[]>([]);
    const [tags, setTags] = useState<GroupTag[]>([]);
    const [loadingGroup, setLoadingGroup] = useState(true);

    const [step, setStep] = useState<number>(1);
    const [tipo, setTipo] = useState<TipoParticipante | null>(null);

    // Búsqueda de usuario del sistema
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [searching, setSearching] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Datos finales del participante (usuario o invitado)
    const [foundUserId, setFoundUserId] = useState<string | null>(null);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── Estado de pareja — mismo patrón que ModalUnirseGrupo.tsx ──
    const [wantsPartner, setWantsPartner] = useState(false);
    const [partnerHasEmail, setPartnerHasEmail] = useState<boolean | null>(null);
    const [partnerFirstName, setPartnerFirstName] = useState('');
    const [partnerLastName, setPartnerLastName] = useState('');
    const [partnerEmail, setPartnerEmail] = useState('');
    const [partnerPhone, setPartnerPhone] = useState('');
    const [partnerAccount, setPartnerAccount] = useState<{ id: string; name: string; phone?: string } | null>(null);
    const [hasCheckedPartnerEmail, setHasCheckedPartnerEmail] = useState(false);
    const [partnerEmailError, setPartnerEmailError] = useState<string | null>(null);
    const [checkingPartner, setCheckingPartner] = useState(false);

    const resetPartnerData = () => {
        setPartnerFirstName(''); setPartnerLastName(''); setPartnerEmail(''); setPartnerPhone('');
        setPartnerAccount(null);
        setHasCheckedPartnerEmail(false);
        setPartnerEmailError(null);
    };

    const partnerFieldsFilled = !!(
        partnerFirstName.trim() &&
        partnerLastName.trim() &&
        partnerPhone.trim() &&
        (partnerHasEmail === false || partnerEmail.trim())
    );
    const hasPartnerData = wantsPartner && partnerHasEmail !== null && partnerFieldsFilled;
    const partnerDataPending = wantsPartner && (partnerHasEmail === null || !partnerFieldsFilled);

    const handlePartnerEmailBlur = async () => {
        if (!partnerEmail) return;
        if (partnerEmail.toLowerCase().trim() === email.toLowerCase().trim()) {
            setPartnerEmailError('No podés poner el mismo email dos veces. Corregilo para continuar.');
            setPartnerAccount(null);
            return;
        }
        setPartnerEmailError(null);
        setCheckingPartner(true);
        try {
            const foundUser = await supabaseService.findUserByEmail(partnerEmail);
            setPartnerAccount(foundUser);
            if (foundUser) {
                const nameParts = foundUser.name ? foundUser.name.split(' ') : [];
                setPartnerFirstName(nameParts[0] || partnerFirstName);
                setPartnerLastName(nameParts.slice(1).join(' ') || partnerLastName);
                setPartnerPhone((foundUser as any).phone || partnerPhone);
            }
        } catch (err) {
            console.error('Error checking partner email:', err);
        } finally {
            setCheckingPartner(false);
            setHasCheckedPartnerEmail(true);
        }
    };

    const fetchGroupName = useCallback(async () => {
        if (!currentUser || !groupId) return;
        setLoadingGroup(true);
        try {
            const [owned, cats, tgs] = await Promise.all([
                supabaseService.getGroupsByHost(currentUser.id),
                supabaseService.getGroupCategories(),
                supabaseService.getGroupTags(),
            ]);
            const found = owned.find(g => g.id === groupId);
            if (!found) {
                navigate('/mis-grupos', { replace: true });
                return;
            }
            setGroup(found);
            setCategories(cats);
            setTags(tgs);
        } finally {
            setLoadingGroup(false);
        }
    }, [currentUser, groupId, navigate]);

    useEffect(() => { fetchGroupName(); }, [fetchGroupName]);

    // Mismo cálculo que ModalUnirseGrupo.tsx
    const isCouplesGroup = (() => {
        if (!group) return false;
        const categoryName = (() => {
            if (!group.categoryId) return '';
            if (group.categoryId.toLowerCase() === 'parejas') return 'parejas';
            const cat = categories.find(c => c.id === group.categoryId);
            return cat?.name?.toLowerCase() || '';
        })();
        const hasParejasTag = group.tags?.some(tId => tags.find(t => t.id === tId)?.name?.toLowerCase() === 'parejas') || false;
        return (categoryName === 'parejas' || hasParejasTag) && group.targetGender === 'Mixto';
    })();

    // Búsqueda de usuarios del sistema (debounce 350ms)
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (searchTerm.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            const results = await supabaseService.searchUsersGlobal(searchTerm.trim());
            setSearchResults(results);
            setSearching(false);
        }, 350);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [searchTerm]);

    const handleSelectTipo = (t: TipoParticipante) => {
        setTipo(t);
        setFoundUserId(null);
        setFirstName(''); setLastName(''); setEmail(''); setPhone('');
        setSearchTerm(''); setSearchResults([]);
        setStep(2);
    };

    const handleSelectUser = (user: User) => {
        const nameParts = (user.name || '').trim().split(/\s+/);
        setFoundUserId(user.id);
        setFirstName(nameParts[0] || '');
        setLastName(nameParts.slice(1).join(' ') || '');
        setEmail(user.email || '');
        setPhone((user as any).phone || '');
        setStep(3); // Paso 3 = Pareja (si aplica) o Confirmar
    };

    const handleGuestContinue = () => {
        setError(null);
        if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim()) {
            setError('Completá todos los campos para continuar.');
            return;
        }
        setFoundUserId(null);
        setStep(3); // Paso 3 = Pareja (si aplica) o Confirmar
    };

    const handlePartnerContinue = () => {
        setError(null);
        if (partnerDataPending) {
            setError("Completá todos los datos de tu pareja, o elegí 'No' si inscribís solo a esta persona.");
            return;
        }
        setStep(4);
    };

    const handleConfirm = async () => {
        if (!groupId) return;
        setIsSubmitting(true);
        setError(null);

        const partnerDataToSend = hasPartnerData
            ? (partnerHasEmail
                ? { firstName: partnerFirstName, lastName: partnerLastName, email: partnerEmail, phone: partnerPhone }
                : { firstName: partnerFirstName, lastName: partnerLastName, phone: partnerPhone })
            : undefined;

        const success = await supabaseService.adminAddMemberToGroup({
            groupId,
            userId: foundUserId,
            firstName,
            lastName,
            email,
            phone,
            partnerData: partnerDataToSend,
            partnerUserId: hasPartnerData && partnerAccount ? partnerAccount.id : undefined,
        });
        setIsSubmitting(false);
        if (success) {
            navigate(`/mis-grupos/${groupId}`);
        } else {
            setError('Hubo un error al inscribir al participante. Intentá de nuevo.');
        }
    };

    if (loadingGroup) return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
            <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
        </div>
    );

    return (
        <div className="min-h-screen bg-white dark:bg-black">
            <div className="max-w-lg mx-auto px-4 md:px-8 py-8">

                <button
                    onClick={() => navigate(`/mis-grupos/${groupId}`)}
                    className="flex items-center gap-2 text-sm text-slate-400 hover:text-black dark:hover:text-white transition-colors mb-6 font-bold uppercase tracking-wide"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {group?.name}
                </button>

                <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-black dark:text-white mb-6">
                    Inscribir Participante
                </h1>

                <StepIndicator
                    current={step}
                    steps={isCouplesGroup ? ['Tipo', 'Datos', 'Pareja', 'Confirmar'] : ['Tipo', 'Datos', 'Confirmar']}
                />

                {/* ─── PASO 1: Tipo ─────────────────────────── */}
                {step === 1 && (
                    <div className="space-y-3">
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 border-l-2 border-purple-400 pl-3">
                            ¿La persona que querés inscribir ya tiene cuenta en la app, o es alguien sin cuenta?
                        </p>
                        <button
                            type="button"
                            onClick={() => handleSelectTipo('USUARIO')}
                            className="w-full flex items-center gap-4 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-slate-900 transition-all text-left"
                        >
                            <UserCheck className="w-8 h-8 shrink-0" />
                            <div>
                                <p className="font-black uppercase text-sm">Usuario del Sistema</p>
                                <p className="text-xs opacity-70">Ya tiene cuenta en la app</p>
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSelectTipo('INVITADO')}
                            className="w-full flex items-center gap-4 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-slate-900 transition-all text-left"
                        >
                            <UserPlus className="w-8 h-8 shrink-0" />
                            <div>
                                <p className="font-black uppercase text-sm">Invitado</p>
                                <p className="text-xs opacity-70">No tiene cuenta en la app</p>
                            </div>
                        </button>
                    </div>
                )}

                {/* ─── PASO 2A: Buscador de usuario ─────────── */}
                {step === 2 && tipo === 'USUARIO' && (
                    <div>
                        <div className="mb-3">
                            <label htmlFor="user-search" className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1.5">
                                Buscar usuario por nombre
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                                <input
                                    id="user-search"
                                    type="text"
                                    autoFocus
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Nombre del participante..."
                                    className="w-full h-11 pl-9 pr-3 border border-slate-300 dark:border-zinc-700 rounded-lg font-medium text-sm text-black dark:text-white dark:bg-zinc-900 bg-white focus:outline-none focus:ring-4 focus:ring-slate-900/10 dark:focus:ring-white/10 transition-shadow duration-150"
                                />
                                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 animate-spin" />}
                            </div>
                            <p className="text-[10px] text-neutral-400 mt-1">Mínimo 2 caracteres</p>
                        </div>

                        {searchResults.length > 0 && (
                            <div className="border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                                {searchResults.map((user, i) => (
                                    <button
                                        key={user.id}
                                        type="button"
                                        onClick={() => handleSelectUser(user)}
                                        className={`w-full flex items-center justify-between p-3 text-left hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors ${i < searchResults.length - 1 ? 'border-b border-neutral-100 dark:border-neutral-800' : ''}`}
                                    >
                                        <div className="min-w-0">
                                            <p className="font-bold text-sm text-black dark:text-white truncate">{user.name}</p>
                                            <p className="text-xs text-neutral-500 truncate">{user.email}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {searchTerm.trim().length >= 2 && !searching && searchResults.length === 0 && (
                            <div className="border-2 border-dashed border-neutral-200 dark:border-neutral-700 p-6 text-center">
                                <p className="text-sm font-bold text-neutral-400">Sin resultados para "{searchTerm}"</p>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="mt-4 flex items-center gap-2 text-xs font-bold uppercase text-neutral-400 hover:text-black dark:hover:text-white transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" /> Volver
                        </button>
                    </div>
                )}

                {/* ─── PASO 2B: Formulario de invitado ──────── */}
                {step === 2 && tipo === 'INVITADO' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold uppercase block mb-1">Nombre</label>
                                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full h-11 px-3 border border-slate-300 dark:border-zinc-700 rounded-lg font-medium bg-white dark:bg-zinc-900 text-black dark:text-white" placeholder="Ej. Juan" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase block mb-1">Apellido</label>
                                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full h-11 px-3 border border-slate-300 dark:border-zinc-700 rounded-lg font-medium bg-white dark:bg-zinc-900 text-black dark:text-white" placeholder="Ej. Pérez" />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase block mb-1">Teléfono</label>
                            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full h-11 px-3 border border-slate-300 dark:border-zinc-700 rounded-lg font-medium bg-white dark:bg-zinc-900 text-black dark:text-white" placeholder="+54 9 11 ..." />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase block mb-1">Email</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full h-11 px-3 border border-slate-300 dark:border-zinc-700 rounded-lg font-medium bg-white dark:bg-zinc-900 text-black dark:text-white" placeholder="ejemplo@email.com" />
                        </div>

                        {error && <p className="text-sm text-red-600 font-semibold">{error}</p>}

                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => setStep(1)} className="flex-1 flex items-center justify-center gap-2 min-h-[44px] border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-zinc-300 font-semibold uppercase tracking-wide text-xs hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all duration-150">
                                <ChevronLeft className="w-4 h-4" /> Volver
                            </button>
                            <button type="button" onClick={handleGuestContinue} className="flex-[2] min-h-[44px] bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold uppercase tracking-wide text-xs hover:opacity-90 rounded-lg transition-all duration-150">
                                Continuar →
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── PASO 3 (solo si isCouplesGroup): Pareja ─── */}
                {step === 3 && isCouplesGroup && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-2">
                            <Heart className="w-4 h-4 text-pink-600" />
                            <span className="text-xs font-black uppercase tracking-widest">¿Querés inscribir a la pareja?</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setWantsPartner(true)}
                                className={`py-3 rounded-lg font-semibold uppercase text-sm tracking-wide transition-all ${wantsPartner ? 'bg-pink-600 text-white' : 'bg-white dark:bg-zinc-900 text-black dark:text-white border border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                            >
                                Sí
                            </button>
                            <button
                                type="button"
                                onClick={() => { setWantsPartner(false); resetPartnerData(); setPartnerHasEmail(null); }}
                                className={`py-3 rounded-lg font-semibold uppercase text-sm tracking-wide transition-all ${!wantsPartner ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-white dark:bg-zinc-900 text-black dark:text-white border border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                            >
                                No
                            </button>
                        </div>

                        {wantsPartner && (
                            <div className="space-y-4 pt-1">
                                <div className="space-y-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-black">¿La pareja tiene email?</span>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => { setPartnerHasEmail(true); resetPartnerData(); }}
                                            className={`py-2.5 rounded-lg font-semibold uppercase text-sm tracking-wide transition-all ${partnerHasEmail === true ? 'bg-pink-600 text-white' : 'bg-white dark:bg-zinc-900 text-black dark:text-white border border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                                        >
                                            Sí
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setPartnerHasEmail(false); resetPartnerData(); }}
                                            className={`py-2.5 rounded-lg font-semibold uppercase text-sm tracking-wide transition-all ${partnerHasEmail === false ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-white dark:bg-zinc-900 text-black dark:text-white border border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                                        >
                                            No
                                        </button>
                                    </div>
                                </div>

                                {partnerHasEmail !== null && (
                                    <div className="space-y-4 pt-1">
                                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
                                            <span className="text-xs font-black uppercase tracking-widest">Datos de la pareja</span>
                                            {partnerAccount && (
                                                <span className="text-[10px] font-bold bg-green-200 px-2 py-0.5 border border-black">Cuenta encontrada</span>
                                            )}
                                        </div>

                                        {partnerHasEmail && (
                                            <div>
                                                <label className="text-[10px] font-bold uppercase block mb-1">Email de la pareja</label>
                                                <input
                                                    type="email"
                                                    value={partnerEmail}
                                                    onChange={e => {
                                                        if (e.target.value.trim() === '') resetPartnerData();
                                                        else setPartnerEmail(e.target.value);
                                                        setPartnerAccount(null);
                                                        setHasCheckedPartnerEmail(false);
                                                        setPartnerEmailError(null);
                                                    }}
                                                    onBlur={handlePartnerEmailBlur}
                                                    className={`w-full h-11 px-3 border-2 font-bold ${partnerEmailError ? 'border-red-600 bg-red-50' : partnerAccount ? 'border-green-600 bg-green-50' : 'border-black'}`}
                                                    placeholder="Email para vincular"
                                                />
                                                {partnerEmailError ? (
                                                    <p className="text-[10px] font-bold text-red-600 uppercase mt-1">{partnerEmailError}</p>
                                                ) : !hasCheckedPartnerEmail && (
                                                    <p className="text-[10px] font-bold text-neutral-400 uppercase mt-1">
                                                        {checkingPartner ? 'Buscando...' : 'Ingresá y confirmá el email para continuar'}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-bold uppercase block mb-1">Nombre</label>
                                                <input
                                                    type="text" value={partnerFirstName}
                                                    onChange={e => setPartnerFirstName(e.target.value)}
                                                    disabled={partnerHasEmail === true && (!hasCheckedPartnerEmail || checkingPartner)}
                                                    className="w-full h-11 px-3 border border-slate-300 dark:border-zinc-700 rounded-lg font-medium bg-white dark:bg-zinc-900 text-black dark:text-white disabled:bg-slate-100 dark:disabled:bg-zinc-800 disabled:text-slate-400"
                                                    placeholder="Nombre"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold uppercase block mb-1">Apellido</label>
                                                <input
                                                    type="text" value={partnerLastName}
                                                    onChange={e => setPartnerLastName(e.target.value)}
                                                    disabled={partnerHasEmail === true && (!hasCheckedPartnerEmail || checkingPartner)}
                                                    className="w-full h-11 px-3 border border-slate-300 dark:border-zinc-700 rounded-lg font-medium bg-white dark:bg-zinc-900 text-black dark:text-white disabled:bg-slate-100 dark:disabled:bg-zinc-800 disabled:text-slate-400"
                                                    placeholder="Apellido"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase block mb-1">Teléfono</label>
                                            <input
                                                type="tel" value={partnerPhone}
                                                onChange={e => setPartnerPhone(e.target.value)}
                                                disabled={partnerHasEmail === true && (!hasCheckedPartnerEmail || checkingPartner)}
                                                className="w-full h-11 px-3 border border-slate-300 dark:border-zinc-700 rounded-lg font-medium bg-white dark:bg-zinc-900 text-black dark:text-white disabled:bg-slate-100 dark:disabled:bg-zinc-800 disabled:text-slate-400"
                                                placeholder="+54 9 11 ..."
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {error && <p className="text-sm text-red-600 font-semibold">{error}</p>}

                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => setStep(2)} className="flex-1 flex items-center justify-center gap-2 min-h-[44px] border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-zinc-300 font-semibold uppercase tracking-wide text-xs hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all duration-150">
                                <ChevronLeft className="w-4 h-4" /> Volver
                            </button>
                            <button type="button" onClick={handlePartnerContinue} className="flex-[2] min-h-[44px] bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold uppercase tracking-wide text-xs hover:opacity-90 rounded-lg transition-all duration-150">
                                Continuar →
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── PASO 3: Confirmar (o 4 si hay pareja) ─── */}
                {step === (isCouplesGroup ? 4 : 3) && (
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-neutral-400 mb-4">
                            Confirmá los datos del participante
                        </p>

                        <div className="border border-slate-200 dark:border-zinc-800 rounded-xl p-4 mb-5 shadow-sm space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <p className="font-black text-base uppercase tracking-tight text-black dark:text-white">
                                    {firstName} {lastName}
                                </p>
                                <span className={`text-[9px] font-black uppercase px-2 py-1 shrink-0 ${foundUserId ? 'bg-purple-600 text-white' : 'bg-neutral-200 text-neutral-600'}`}>
                                    {foundUserId ? 'Usuario del sistema' : 'Invitado'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-black dark:text-white">
                                <Mail className="w-4 h-4 text-neutral-400 shrink-0" />
                                <span className="break-all">{email}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-black dark:text-white">
                                <Phone className="w-4 h-4 text-neutral-400 shrink-0" />
                                <span className="font-mono">{maskPhone(phone)}</span>
                            </div>
                        </div>

                        {hasPartnerData && (
                            <div className="border-2 border-pink-300 bg-pink-50 dark:bg-pink-950/20 p-4 mb-5 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Heart className="w-4 h-4 text-pink-600" />
                                    <p className="font-black text-sm uppercase text-black dark:text-white">
                                        {partnerFirstName} {partnerLastName}
                                    </p>
                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-pink-600 text-white shrink-0">Pareja</span>
                                </div>
                                {partnerHasEmail && (
                                    <div className="flex items-center gap-2 text-sm text-black dark:text-white">
                                        <Mail className="w-4 h-4 text-neutral-400 shrink-0" />
                                        <span className="break-all">{partnerEmail}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-sm text-black dark:text-white">
                                    <Phone className="w-4 h-4 text-neutral-400 shrink-0" />
                                    <span className="font-mono">{maskPhone(partnerPhone)}</span>
                                </div>
                            </div>
                        )}

                        {error && <p className="text-sm text-red-600 font-semibold mb-4">{error}</p>}

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setStep(isCouplesGroup ? 3 : 2)}
                                disabled={isSubmitting}
                                className="flex-1 flex items-center justify-center gap-2 min-h-[44px] border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-zinc-300 font-semibold uppercase tracking-wide text-xs hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all duration-150"
                            >
                                <ChevronLeft className="w-4 h-4" /> Volver
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={isSubmitting}
                                className="flex-[2] min-h-[44px] bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold uppercase tracking-wide text-xs hover:opacity-90 rounded-lg transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                {isSubmitting ? 'Agregando...' : 'Agregar al Grupo'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PaginaInscribirParticipante;
