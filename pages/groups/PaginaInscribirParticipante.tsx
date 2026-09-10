import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Group, GroupCategory, GroupTag } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { Search, Loader2, Check } from 'lucide-react';
import { T, btnSecundario, rotulo, Encabezado, Pasos, PasosBotones, Campo } from '../../components/GCX/patron';

// Muestra solo los últimos 3 dígitos, el resto censurado. Se mantiene en el
// listado de búsqueda: para elegir a alguien no hace falta ver su teléfono
// entero, y ese listado recorre usuarios de toda la app.
const maskPhone = (phone?: string): string => {
    if (!phone) return '—';
    const clean = phone.trim();
    if (clean.length <= 3) return clean;
    return '•'.repeat(clean.length - 3) + clean.slice(-3);
};

const iniciales = (nombre: string) => {
    const p = (nombre || '').split(' ').filter(Boolean);
    return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?';
};

const PaginaInscribirParticipante: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();

    const [group, setGroup] = useState<Group | null>(null);
    const [categories, setCategories] = useState<GroupCategory[]>([]);
    const [tags, setTags] = useState<GroupTag[]>([]);
    const [loadingGroup, setLoadingGroup] = useState(true);

    // El diseño baja el flujo a 3 pasos: la elección entre "ya tiene cuenta" y
    // "invitado nuevo" deja de ser un paso propio y vive dentro del buscador,
    // con la carga manual como salida al pie.
    const [step, setStep] = useState<1 | 2 | 3>(1);

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [searching, setSearching] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [foundUserId, setFoundUserId] = useState<string | null>(null);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── Estado de pareja — mismo patrón que ModalUnirseGrupo.tsx ──
    const [wantsPartner, setWantsPartner] = useState<boolean | null>(null);
    const [partnerFirstName, setPartnerFirstName] = useState('');
    const [partnerLastName, setPartnerLastName] = useState('');
    const [partnerEmail, setPartnerEmail] = useState('');
    const [partnerPhone, setPartnerPhone] = useState('');
    const [partnerAccount, setPartnerAccount] = useState<{ id: string; name: string; phone?: string } | null>(null);
    const [partnerEmailError, setPartnerEmailError] = useState<string | null>(null);
    const [checkingPartner, setCheckingPartner] = useState(false);

    const resetPartnerData = () => {
        setPartnerFirstName(''); setPartnerLastName(''); setPartnerEmail(''); setPartnerPhone('');
        setPartnerAccount(null);
        setPartnerEmailError(null);
    };

    // El email del acompañante pasó a ser OPCIONAL (así lo marca el artboard
    // 3b), así que la validez ya no depende de él: nombre, apellido y teléfono.
    const partnerFieldsFilled = !!(partnerFirstName.trim() && partnerLastName.trim() && partnerPhone.trim());
    const hasPartnerData = wantsPartner === true && partnerFieldsFilled;

    // Se conserva la búsqueda por email para VINCULAR la cuenta del
    // acompañante cuando existe — es lo que llena partner_user_id.
    const handlePartnerEmailBlur = async () => {
        if (!partnerEmail) { setPartnerEmailError(null); setPartnerAccount(null); return; }
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

    const totalPasos = isCouplesGroup ? 3 : 2;

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

    const handleSelectUser = (user: User) => {
        const nameParts = (user.name || '').trim().split(/\s+/);
        setFoundUserId(user.id);
        setFirstName(nameParts[0] || '');
        setLastName(nameParts.slice(1).join(' ') || '');
        setEmail(user.email || '');
        setPhone((user as any).phone || '');
        setError(null);
        setStep(2);
    };

    const handleInvitadoNuevo = () => {
        setFoundUserId(null);
        setFirstName(''); setLastName(''); setEmail(''); setPhone('');
        setError(null);
        setStep(2);
    };

    const datosCompletos = !!(firstName.trim() && lastName.trim() && phone.trim());

    const handleConfirm = async () => {
        if (!groupId) return;
        setIsSubmitting(true);
        setError(null);

        // Si el acompañante no dejó email, la clave se OMITE en vez de mandar
        // string vacío: dos inscripciones sin email harían falso match entre sí
        // (sección 23 de instrucciones_ia.md).
        const partnerDataToSend = hasPartnerData
            ? (partnerEmail.trim()
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

    const volver = () => {
        if (step === 3) { setStep(2); setError(null); return; }
        if (step === 2) { setStep(1); setError(null); return; }
        navigate(`/mis-grupos/${groupId}`);
    };

    if (loadingGroup) return (
        <div className={`min-h-screen flex items-center justify-center ${T.fondo}`}>
            <Loader2 className="w-8 h-8 animate-spin text-black/20 dark:text-white/20" />
        </div>
    );
    if (!group) return null;

    const libres = Math.max(0, (group.maxCapacity || 0) - (group.membersCount || 0));
    const ocupa = wantsPartner === true ? 2 : 1;

    const nombrePaso = step === 1 ? '¿Quién es?' : step === 2 ? 'Datos de la persona' : '¿Viene con pareja?';
    const subtitulo = step === 1
        ? group.name
        : foundUserId
            ? `${firstName} ${lastName}`.trim() || group.name
            : 'Invitado nuevo';

    return (
        <div id="gcx-accion" className={`min-h-screen ${T.fondo} ${T.fuente} ${T.tinta}`}>

            <div className="bg-white dark:bg-[#1b1b1a] rounded-b-[28px] px-5 pt-4 pb-5 lg:px-8">
                <div className="max-w-[430px] mx-auto">
                    <Encabezado accion="Inscribir a alguien" grupo={subtitulo} onVolver={volver} />
                    <div className="mt-5">
                        <Pasos actual={step} total={totalPasos} nombre={nombrePaso} />
                    </div>
                </div>
            </div>

            <div className="max-w-[430px] mx-auto px-4 pt-5 pb-8">

                {/* ── PASO 1: primero el buscador. El caso frecuente es alguien
                     que ya tiene cuenta; la carga manual es la salida al pie. ── */}
                {step === 1 && (
                    <>
                        <div className="h-[56px] rounded-full bg-white dark:bg-[#1b1b1a] flex items-center gap-3 px-5">
                            <Search className="w-[18px] h-[18px] shrink-0 text-black/40 dark:text-white/40" strokeWidth={2.2} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Buscar por nombre o email"
                                className="flex-1 min-w-0 outline-none text-[15.5px] font-medium placeholder:text-black/35 dark:placeholder:text-white/35"
                                style={{ background: 'transparent', border: 0, borderRadius: 0 }}
                            />
                            {searching && <Loader2 className="w-4 h-4 animate-spin text-black/30 dark:text-white/30" />}
                        </div>

                        {searchResults.length > 0 && (
                            <>
                                <p className={`${rotulo} px-1.5 mt-[22px] mb-2.5`}>Personas con cuenta</p>
                                <div className="bg-white dark:bg-[#1b1b1a] rounded-[26px] overflow-hidden">
                                    {searchResults.map((u, i) => (
                                        <React.Fragment key={u.id}>
                                            {i > 0 && <div className="h-px bg-black/[.06] dark:bg-white/[.08] mx-4" />}
                                            <button
                                                type="button"
                                                onClick={() => handleSelectUser(u)}
                                                className="w-full flex items-center gap-3.5 h-[70px] px-4 text-left transition-colors hover:bg-black/[.02] dark:hover:bg-white/[.03]"
                                            >
                                                <div className={`w-11 h-11 shrink-0 rounded-full ${T.chip} flex items-center justify-center text-[14px] font-semibold text-black/60 dark:text-white/60`}>
                                                    {iniciales(u.name || '')}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[15.5px] font-semibold truncate">{u.name}</p>
                                                    <p className="mt-0.5 text-[12.5px] font-medium text-black/45 dark:text-white/45 truncate">
                                                        {maskPhone((u as any).phone)}
                                                    </p>
                                                </div>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                                                    strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-black/30 dark:text-white/30" aria-hidden="true">
                                                    <path d="M9 6l6 6-6 6" />
                                                </svg>
                                            </button>
                                        </React.Fragment>
                                    ))}
                                </div>
                            </>
                        )}

                        {searchTerm.trim().length >= 2 && !searching && searchResults.length === 0 && (
                            <p className="mt-7 text-[14.5px] font-medium text-black/50 dark:text-white/50 text-center">
                                No encontramos a nadie con ese nombre o email.
                            </p>
                        )}

                        <div className="bg-white dark:bg-[#1b1b1a] rounded-[26px] p-5 mt-3.5">
                            <p className="text-[15.5px] font-semibold">No tiene cuenta en la app</p>
                            <p className="mt-2 mb-4 text-[13.5px] leading-[1.55] font-medium text-black/50 dark:text-white/50">
                                Cargá los datos a mano y queda inscripto como invitado.
                            </p>
                            <button type="button" onClick={handleInvitadoNuevo} className={`${btnSecundario} w-full`}>
                                Cargar un invitado nuevo
                            </button>
                        </div>
                    </>
                )}

                {/* ── PASO 2: los datos ── */}
                {step === 2 && (
                    <>
                        <div className="bg-white dark:bg-[#1b1b1a] rounded-[26px] p-[18px] flex flex-col gap-2.5">
                            <Campo id="ins-nombre" etiqueta="Nombre" valor={firstName} onChange={setFirstName} />
                            <Campo id="ins-apellido" etiqueta="Apellido" valor={lastName} onChange={setLastName} />
                            <Campo id="ins-tel" etiqueta="Teléfono" valor={phone} onChange={setPhone} tipo="tel" />
                            <Campo id="ins-email" etiqueta="Email" valor={email} onChange={setEmail} tipo="email" opcional />
                        </div>

                        {error && (
                            <p className="mt-3.5 text-[14px] font-semibold text-center text-[oklch(0.52_0.19_25)]">{error}</p>
                        )}

                        <div className="mt-[18px]">
                            <PasosBotones
                                onVolver={volver}
                                onSiguiente={() => {
                                    if (!datosCompletos) { setError('Completá nombre, apellido y teléfono.'); return; }
                                    setError(null);
                                    if (isCouplesGroup) setStep(3); else handleConfirm();
                                }}
                                textoSiguiente={isCouplesGroup ? 'Continuar' : 'Inscribir'}
                                puedeSeguir={datosCompletos}
                                cargando={isSubmitting}
                            />
                        </div>
                    </>
                )}

                {/* ── PASO 3: pareja. Par de píldoras, no un toggle chico. ── */}
                {step === 3 && (
                    <>
                        <div className="flex gap-2.5">
                            <button
                                type="button"
                                onClick={() => { setWantsPartner(true); setError(null); }}
                                aria-pressed={wantsPartner === true}
                                className={`flex-1 h-[58px] rounded-full flex items-center justify-center gap-2.5 text-[16px] font-semibold transition-colors ${wantsPartner === true
                                    ? 'bg-[#0a0a0a] dark:bg-white text-white dark:text-black'
                                    : 'bg-white dark:bg-[#1b1b1a] text-black/55 dark:text-white/55'}`}
                            >
                                {wantsPartner === true && <Check className="w-[17px] h-[17px]" strokeWidth={2.6} />}
                                Sí, con pareja
                            </button>
                            <button
                                type="button"
                                onClick={() => { setWantsPartner(false); resetPartnerData(); setError(null); }}
                                aria-pressed={wantsPartner === false}
                                className={`flex-1 h-[58px] rounded-full flex items-center justify-center text-[16px] font-semibold transition-colors ${wantsPartner === false
                                    ? 'bg-[#0a0a0a] dark:bg-white text-white dark:text-black'
                                    : 'bg-white dark:bg-[#1b1b1a] text-black/55 dark:text-white/55'}`}
                            >
                                Viene sola
                            </button>
                        </div>

                        {/* Los datos del acompañante aparecen recién al elegir "Sí". */}
                        {wantsPartner === true && (
                            <div className="bg-white dark:bg-[#1b1b1a] rounded-[26px] p-[18px] mt-3.5 flex flex-col gap-2.5">
                                <p className={`${rotulo} px-1 mb-1`}>Datos del acompañante</p>
                                <Campo id="par-nombre" etiqueta="Nombre" valor={partnerFirstName} onChange={setPartnerFirstName} />
                                <Campo id="par-apellido" etiqueta="Apellido" valor={partnerLastName} onChange={setPartnerLastName} />
                                <Campo id="par-tel" etiqueta="Teléfono" valor={partnerPhone} onChange={setPartnerPhone} tipo="tel" />
                                <div onBlur={handlePartnerEmailBlur}>
                                    <Campo id="par-email" etiqueta="Email" valor={partnerEmail} onChange={setPartnerEmail} tipo="email" opcional />
                                </div>
                                {checkingPartner && (
                                    <p className="px-1 text-[12.5px] font-medium text-black/45 dark:text-white/45">Buscando la cuenta…</p>
                                )}
                                {partnerAccount && (
                                    <p className="px-1 text-[12.5px] font-semibold text-emerald-700 dark:text-emerald-400">
                                        Cuenta encontrada: queda vinculada a {partnerAccount.name}.
                                    </p>
                                )}
                                {partnerEmailError && (
                                    <p className="px-1 text-[12.5px] font-semibold text-[oklch(0.52_0.19_25)]">{partnerEmailError}</p>
                                )}
                            </div>
                        )}

                        {wantsPartner !== null && (
                            <div className="bg-white dark:bg-[#1b1b1a] rounded-[26px] px-[18px] py-4 mt-3.5">
                                <p className="text-[13.5px] leading-[1.5] font-medium text-black/55 dark:text-white/55">
                                    {libres === 0
                                        ? <>El grupo <span className="font-semibold text-[#0a0a0a] dark:text-white">ya no tiene lugares libres</span>. Podés inscribir igual: el cupo queda excedido.</>
                                        : <>Se {ocupa === 1 ? 'va a ocupar' : 'van a ocupar'} <span className="font-semibold text-[#0a0a0a] dark:text-white">{ocupa} de los {libres} lugares</span> que quedan en el grupo.</>}
                                </p>
                            </div>
                        )}

                        {error && (
                            <p className="mt-3.5 text-[14px] font-semibold text-center text-[oklch(0.52_0.19_25)]">{error}</p>
                        )}

                        <div className="mt-[18px]">
                            <PasosBotones
                                onVolver={volver}
                                onSiguiente={() => {
                                    if (wantsPartner === null) { setError('Elegí si viene con pareja o sola.'); return; }
                                    if (wantsPartner && !partnerFieldsFilled) {
                                        setError('Completá nombre, apellido y teléfono del acompañante.');
                                        return;
                                    }
                                    if (partnerEmailError) { setError(partnerEmailError); return; }
                                    handleConfirm();
                                }}
                                textoSiguiente="Inscribir"
                                puedeSeguir={wantsPartner !== null && (wantsPartner === false || partnerFieldsFilled) && !partnerEmailError}
                                cargando={isSubmitting}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default PaginaInscribirParticipante;
