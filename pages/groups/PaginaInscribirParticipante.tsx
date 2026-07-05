import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { ArrowLeft, Search, UserCheck, UserPlus, ChevronLeft, Loader2, Check, Mail, Phone } from 'lucide-react';

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

const StepIndicator: React.FC<{ current: 1 | 2 | 3 }> = ({ current }) => {
    const steps = ['Tipo', 'Datos', 'Confirmar'];
    return (
        <div className="flex items-center gap-0 mb-6" role="list" aria-label="Progreso del formulario">
            {steps.map((label, i) => {
                const n = (i + 1) as 1 | 2 | 3;
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
                        {i < 2 && <div className={`flex-1 h-0.5 mb-4 transition-colors duration-300 ${done ? 'bg-black' : 'bg-neutral-200'}`} />}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

const PaginaInscribirParticipante: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();

    const [groupName, setGroupName] = useState('');
    const [loadingGroup, setLoadingGroup] = useState(true);

    const [step, setStep] = useState<1 | 2 | 3>(1);
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

    const fetchGroupName = useCallback(async () => {
        if (!currentUser || !groupId) return;
        setLoadingGroup(true);
        try {
            const owned = await supabaseService.getGroupsByHost(currentUser.id);
            const found = owned.find(g => g.id === groupId);
            if (!found) {
                navigate('/mis-grupos', { replace: true });
                return;
            }
            setGroupName(found.name);
        } finally {
            setLoadingGroup(false);
        }
    }, [currentUser, groupId, navigate]);

    useEffect(() => { fetchGroupName(); }, [fetchGroupName]);

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
        setStep(3);
    };

    const handleGuestContinue = () => {
        setError(null);
        if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim()) {
            setError('Completá todos los campos para continuar.');
            return;
        }
        setFoundUserId(null);
        setStep(3);
    };

    const handleConfirm = async () => {
        if (!groupId) return;
        setIsSubmitting(true);
        setError(null);
        const success = await supabaseService.adminAddMemberToGroup({
            groupId,
            userId: foundUserId,
            firstName,
            lastName,
            email,
            phone,
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
                    {groupName}
                </button>

                <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-black dark:text-white mb-6">
                    Inscribir Participante
                </h1>

                <StepIndicator current={step} />

                {/* ─── PASO 1: Tipo ─────────────────────────── */}
                {step === 1 && (
                    <div className="space-y-3">
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 border-l-2 border-purple-400 pl-3">
                            ¿La persona que querés inscribir ya tiene cuenta en la app, o es alguien sin cuenta?
                        </p>
                        <button
                            type="button"
                            onClick={() => handleSelectTipo('USUARIO')}
                            className="w-full flex items-center gap-4 p-5 border-2 border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all text-left"
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
                            className="w-full flex items-center gap-4 p-5 border-2 border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all text-left"
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
                                    className="w-full h-11 pl-9 pr-3 border-2 border-black font-bold text-sm text-black dark:text-white dark:bg-black bg-white focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow duration-150"
                                />
                                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 animate-spin" />}
                            </div>
                            <p className="text-[10px] text-neutral-400 mt-1">Mínimo 2 caracteres</p>
                        </div>

                        {searchResults.length > 0 && (
                            <div className="border-2 border-black overflow-hidden max-h-72 overflow-y-auto">
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
                                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full h-11 px-3 border-2 border-black font-bold" placeholder="Ej. Juan" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase block mb-1">Apellido</label>
                                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full h-11 px-3 border-2 border-black font-bold" placeholder="Ej. Pérez" />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase block mb-1">Teléfono</label>
                            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full h-11 px-3 border-2 border-black font-bold" placeholder="+54 9 11 ..." />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase block mb-1">Email</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full h-11 px-3 border-2 border-black font-bold" placeholder="ejemplo@email.com" />
                        </div>

                        {error && <p className="text-sm text-red-600 font-semibold">{error}</p>}

                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => setStep(1)} className="flex-1 flex items-center justify-center gap-2 min-h-[44px] border-2 border-black dark:border-white text-black dark:text-white font-black uppercase tracking-widest text-xs hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all duration-150">
                                <ChevronLeft className="w-4 h-4" /> Volver
                            </button>
                            <button type="button" onClick={handleGuestContinue} className="flex-[2] min-h-[44px] bg-black dark:bg-white text-white dark:text-black font-black uppercase tracking-widest text-xs hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white border-2 border-black dark:border-white hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-150">
                                Continuar →
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── PASO 3: Confirmar ─────────────────────── */}
                {step === 3 && (
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-neutral-400 mb-4">
                            Confirmá los datos del participante
                        </p>

                        <div className="border-2 border-black dark:border-white p-4 mb-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)] space-y-3">
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

                        {error && <p className="text-sm text-red-600 font-semibold mb-4">{error}</p>}

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setStep(2)}
                                disabled={isSubmitting}
                                className="flex-1 flex items-center justify-center gap-2 min-h-[44px] border-2 border-black dark:border-white text-black dark:text-white font-black uppercase tracking-widest text-xs hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all duration-150"
                            >
                                <ChevronLeft className="w-4 h-4" /> Volver
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={isSubmitting}
                                className="flex-[2] min-h-[44px] bg-black dark:bg-white text-white dark:text-black font-black uppercase tracking-widest text-xs hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white border-2 border-black dark:border-white hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50"
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
