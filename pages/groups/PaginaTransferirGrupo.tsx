import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Group, User } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { ArrowLeft, Search, Loader2 } from 'lucide-react';
import { T, Pasos } from '../../components/GCX/patron';

interface SearchUser {
    id: string;
    name: string;
    email: string;
    phone: string;
    isHost: boolean;
    role: string;
}

const ROLE_LABELS: Record<string, string> = {
    ANFITRION: 'Anfitrión',
    SUPER_ADMIN: 'Super Admin',
    PASTOR: 'Pastor',
    ADMIN_GROUPS: 'Admin Grupos',
    CO_ANFITRION: 'Co-Anfitrión',
    USUARIO: 'Usuario',
    VOLUNTARIO: 'Voluntario',
    ENCARGADO_GRUPOS: 'Enc. Grupos',
};

const getRoleLabel = (role: string) => ROLE_LABELS[role] || role;

// Muestra solo los últimos 3 dígitos, el resto censurado
const maskPhone = (phone?: string): string => {
    if (!phone) return '—';
    const clean = phone.trim();
    if (clean.length <= 3) return clean;
    const visible = clean.slice(-3);
    const masked = '•'.repeat(clean.length - 3);
    return masked + visible;
};

const iniciales = (nombre: string) => {
    const p = (nombre || '').split(' ').filter(Boolean);
    return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?';
};

const PaginaTransferirGrupo: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();

    const [group, setGroup] = useState<Group | null>(null);
    const [loadingGroup, setLoadingGroup] = useState(true);

    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchVersion] = useState(0);
    const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
    const [confirmText, setConfirmText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const confirmInputRef = useRef<HTMLInputElement>(null);

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

    useEffect(() => {
        setTimeout(() => searchInputRef.current?.focus(), 100);
    }, []);

    useEffect(() => {
        if (step === 3) {
            setTimeout(() => confirmInputRef.current?.focus(), 100);
        }
    }, [step]);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (searchTerm.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            const results = await supabaseService.searchUsersForTransfer(searchTerm.trim());
            setSearchResults(results.filter(u => u.id !== currentUser.id));
            setSearching(false);
        }, 350);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [searchTerm, currentUser.id, searchVersion]);

    const handleSelectUser = (user: SearchUser) => {
        if (!user.isHost) return;
        setSelectedUser(user);
        setStep(2);
    };

    // El diseño pide escribir el NOMBRE DEL GRUPO, no la palabra "Transferir":
    // obliga a mirar qué se está entregando, no a copiar un verbo.
    const canConfirm = !!group && confirmText.trim() === group.name.trim() && !loading;

    const handleConfirm = async () => {
        if (!selectedUser || !group || !canConfirm) return;
        setLoading(true);
        setError(null);
        const result = await supabaseService.initiateGroupTransfer(
            group.id,
            selectedUser.id,
            currentUser.name || 'Anfitrión',
            group.name
        );
        if (result.success) {
            navigate('/mis-grupos');
        } else {
            setError(result.error || 'Error al iniciar la transferencia.');
        }
        setLoading(false);
    };

    const volver = () => {
        if (step === 3) { setStep(2); setConfirmText(''); setError(null); return; }
        if (step === 2) { setStep(1); setSelectedUser(null); return; }
        navigate(`/mis-grupos/${groupId}`);
    };

    if (loadingGroup) return (
        <div className={`min-h-screen flex items-center justify-center ${T.fondo}`}>
            <Loader2 className="w-8 h-8 animate-spin text-black/20 dark:text-white/20" />
        </div>
    );
    if (!group) return null;

    const oscuro = step > 1;
    const nombrePaso = step === 1 ? '¿Quién recibe el grupo?' : step === 2 ? 'Confirmá quién es' : 'Transferir';
    const subtitulo = step === 3 && selectedUser ? `A ${selectedUser.name}` : group.name;

    // ── Paso 1: claro, como cualquier buscador ──
    const Paso1 = (
        <div className="px-4 pt-5 pb-8 lg:px-0">
            <div className="h-[56px] rounded-full bg-white dark:bg-[#1b1b1a] flex items-center gap-3 px-5">
                <Search className="w-[18px] h-[18px] shrink-0 text-black/40 dark:text-white/40" strokeWidth={2.2} />
                <input
                    ref={searchInputRef}
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
                    <p className="mt-[22px] mb-2.5 px-1.5 text-[12px] font-semibold uppercase tracking-[.07em] text-black/38 dark:text-white/38">
                        Resultados
                    </p>
                    <div className="bg-white dark:bg-[#1b1b1a] rounded-[26px] overflow-hidden">
                        {searchResults.map((u, i) => (
                            <React.Fragment key={u.id}>
                                {i > 0 && <div className="h-px bg-black/[.06] dark:bg-white/[.08] mx-4" />}
                                <button
                                    type="button"
                                    onClick={() => handleSelectUser(u)}
                                    disabled={!u.isHost}
                                    className="w-full flex items-center gap-3.5 h-[70px] px-4 text-left transition-colors hover:bg-black/[.02] dark:hover:bg-white/[.03] disabled:opacity-45 disabled:cursor-not-allowed"
                                >
                                    <div className={`w-11 h-11 shrink-0 rounded-full ${T.chip} flex items-center justify-center text-[14px] font-semibold text-black/60 dark:text-white/60`}>
                                        {iniciales(u.name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[15.5px] font-semibold truncate">{u.name}</p>
                                        <p className="mt-0.5 text-[12.5px] font-medium text-black/45 dark:text-white/45 truncate">
                                            {u.isHost ? getRoleLabel(u.role) : 'No puede recibir grupos'} · {maskPhone(u.phone)}
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
                <p className="mt-8 text-[14.5px] font-medium text-black/50 dark:text-white/50 text-center">
                    No encontramos a nadie con ese nombre o email.
                </p>
            )}

            <p className="mt-5 mx-5 text-[12.5px] leading-[1.55] font-medium text-black/45 dark:text-white/45 text-center">
                Podés transferir a cualquier persona con cuenta en la app, no hace falta que sea miembro.
            </p>
        </div>
    );

    // ── Paso 2: en negro. Mismo layout, mismos radios — solo se invierte el color ──
    const Paso2 = selectedUser && (
        <div className="px-4 pt-3 pb-8 lg:px-0">
            <div className="bg-[#161615] rounded-[28px] px-5 py-6 text-center">
                <div className="w-[76px] h-[76px] mx-auto rounded-full bg-white/10 flex items-center justify-center text-[24px] font-semibold text-white">
                    {iniciales(selectedUser.name)}
                </div>
                <p className="mt-4 text-[22px] font-semibold tracking-[-.015em] text-white">{selectedUser.name}</p>
                <p className="mt-1.5 text-[13.5px] font-medium text-white/50">
                    {getRoleLabel(selectedUser.role)} · {maskPhone(selectedUser.phone)}
                </p>
            </div>

            <p className="mt-6 mb-2.5 px-1.5 text-[12px] font-semibold uppercase tracking-[.07em] text-white/45">Qué cambia</p>
            <div className="bg-[#161615] rounded-[24px] px-[18px] py-1.5">
                {[
                    ['Anfitrión del grupo', selectedUser.name],
                    ['Tu rol', 'Miembro'],
                    ['Asistencia y solicitudes', `Pasan a ${selectedUser.name.split(' ')[0]}`],
                ].map(([k, v], i) => (
                    <React.Fragment key={k}>
                        {i > 0 && <div className="h-px bg-white/[.07]" />}
                        <div className="flex items-center gap-3 h-[52px]">
                            <span className="flex-1 text-[14px] font-medium text-white/60">{k}</span>
                            <span className="text-[14px] font-semibold text-white truncate">{v}</span>
                        </div>
                    </React.Fragment>
                ))}
            </div>

            <p className="mt-[18px] mx-2 text-[13px] leading-[1.6] font-medium text-white/55">
                Dejás de administrar el grupo. Para volver a ser anfitrión, {selectedUser.name.split(' ')[0]} tendría que transferírtelo de nuevo.
            </p>

            <div className="flex gap-2.5 mt-[22px]">
                <button type="button" onClick={volver}
                    className="h-[58px] px-[26px] rounded-full bg-white/10 text-white text-[15.5px] font-semibold transition-colors hover:bg-white/[.16]">
                    Volver
                </button>
                <button type="button" onClick={() => setStep(3)}
                    className="flex-1 h-[58px] rounded-full bg-white text-[#0a0a0a] text-[16.5px] font-semibold transition-opacity hover:opacity-90">
                    Continuar
                </button>
            </div>
        </div>
    );

    // ── Paso 3: la confirmación explícita ──
    const Paso3 = selectedUser && (
        <div className="px-5 pt-6 pb-8 lg:px-0">
            <p className="text-[26px] leading-[1.25] font-semibold tracking-[-.02em] text-white">
                Esto no se puede deshacer desde tu cuenta
            </p>
            <p className="mt-3.5 text-[14.5px] leading-[1.65] font-medium text-white/60">
                Para confirmar, escribí el nombre del grupo tal como aparece arriba.
            </p>

            <input
                ref={confirmInputRef}
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder={group.name}
                aria-label={`Escribí ${group.name} para confirmar`}
                className="w-full h-[60px] mt-5 px-5 text-[16px] font-medium text-white outline-none placeholder:text-white/35"
                style={{ background: 'rgba(255,255,255,.08)', border: '1px solid transparent', borderRadius: 20 }}
            />

            {error && (
                <p className="mt-3.5 text-[14px] font-semibold text-center text-[oklch(0.7_0.17_25)]">{error}</p>
            )}

            <button
                type="button"
                onClick={handleConfirm}
                disabled={!canConfirm}
                className={`w-full h-[60px] mt-5 rounded-full text-[16.5px] font-semibold transition-colors ${canConfirm
                    ? 'bg-white text-[#0a0a0a] hover:opacity-90'
                    : 'bg-white/[.15] text-white/45 cursor-not-allowed'}`}
            >
                {loading ? 'Transfiriendo…' : 'Transferir el grupo'}
            </button>
            <button type="button" onClick={volver} disabled={loading}
                className="w-full h-[56px] mt-2.5 rounded-full bg-transparent text-white/60 text-[16px] font-semibold transition-colors hover:text-white">
                Cancelar
            </button>

            <p className="mt-5 mx-2 text-[12.5px] leading-[1.6] font-medium text-white/40 text-center">
                El botón se activa cuando el nombre coincide. {selectedUser.name.split(' ')[0]} recibe un aviso en la app.
            </p>
        </div>
    );

    return (
        <div
            id="gcx-accion"
            className={`min-h-screen ${T.fuente} ${oscuro ? 'bg-[#0a0a0a] text-white' : `${T.fondo} ${T.tinta}`}`}
        >
            {/* En desktop no se estira: columna angosta centrada sobre el fondo
                a todo el ancho. El ancho extra no se usa para agregar cosas. */}
            <div className="max-w-[430px] mx-auto">

                <div className={`px-5 pt-4 pb-5 ${oscuro ? '' : 'bg-white dark:bg-[#1b1b1a] rounded-b-[28px]'}`}>
                    <div className="flex items-center gap-3.5">
                        <button
                            type="button"
                            onClick={volver}
                            aria-label="Volver"
                            className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-colors ${oscuro ? 'bg-white/[.09] hover:bg-white/[.15]' : 'bg-[#f2f2f0] dark:bg-[#2a2a28] hover:bg-[#e9e9e6]'}`}
                        >
                            <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={2.2} />
                        </button>
                        <div className="min-w-0">
                            <p className="text-[18px] font-semibold tracking-[-.01em] truncate">Transferir el grupo</p>
                            <p className={`text-[13px] font-medium truncate ${oscuro ? 'text-white/50' : 'text-black/45 dark:text-white/45'}`}>
                                {subtitulo}
                            </p>
                        </div>
                    </div>

                    <div className="mt-5">
                        {oscuro ? (
                            // Mismo indicador, invertido: el patrón no cambia de forma.
                            <div>
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-[12px] font-semibold uppercase tracking-[.07em] text-white/45">Paso {step} de 3</p>
                                    <p className="text-[13px] font-semibold text-white/50 truncate">{nombrePaso}</p>
                                </div>
                                <div className="flex gap-1.5 mt-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className={`flex-1 h-[5px] rounded-full ${i <= step ? 'bg-white' : 'bg-white/20'}`} />
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <Pasos actual={step} total={3} nombre={nombrePaso} />
                        )}
                    </div>
                </div>

                {step === 1 && Paso1}
                {step === 2 && Paso2}
                {step === 3 && Paso3}
            </div>
        </div>
    );
};

export default PaginaTransferirGrupo;
