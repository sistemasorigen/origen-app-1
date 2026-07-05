import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Group, User } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { ArrowLeft, ArrowLeftRight, Search, AlertTriangle, ChevronLeft, Loader2, Lock, RotateCcw } from 'lucide-react';

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

const StepIndicator: React.FC<{ current: 1 | 2 | 3 }> = ({ current }) => {
    const steps = ['Buscar', 'Confirmar', 'Transferir'];
    return (
        <div className="flex items-center gap-0 mb-6" role="list" aria-label="Progreso del formulario">
            {steps.map((label, i) => {
                const n = (i + 1) as 1 | 2 | 3;
                const done = n < current;
                const active = n === current;
                return (
                    <React.Fragment key={n}>
                        <div role="listitem" aria-current={active ? 'step' : undefined} className="flex flex-col items-center gap-1 min-w-0">
                            <div className={`w-7 h-7 flex items-center justify-center border-2 font-black text-xs transition-all duration-200 ${done ? 'bg-black border-black text-white' : active ? 'bg-black border-black text-white' : 'bg-white border-neutral-300 text-neutral-400'}`}>
                                {done ? '✓' : n}
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-widest transition-colors duration-200 ${active ? 'text-black dark:text-white' : 'text-neutral-400'}`}>
                                {label}
                            </span>
                        </div>
                        {i < 2 && (
                            <div className={`flex-1 h-0.5 mb-4 transition-colors duration-300 ${done ? 'bg-black' : 'bg-neutral-200'}`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
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
    const [searchVersion, setSearchVersion] = useState(0);
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

    const handleConfirm = async () => {
        if (!selectedUser || !group || confirmText !== 'Transferir') return;
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

    const canConfirm = confirmText === 'Transferir' && !loading;

    if (loadingGroup) return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
            <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
        </div>
    );

    if (!group) return null;

    return (
        <div className="min-h-screen bg-white dark:bg-black">
            <div className="max-w-lg mx-auto px-4 md:px-8 py-8">

                <button
                    onClick={() => navigate(`/mis-grupos/${groupId}`)}
                    className="flex items-center gap-2 text-sm text-slate-400 hover:text-black dark:hover:text-white transition-colors mb-6 font-bold uppercase tracking-wide"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {group.name}
                </button>

                <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-black dark:text-white mb-6">
                    Transferir Grupo
                </h1>

                <StepIndicator current={step} />

                {/* ─── PASO 1: Buscador ─────────────────────────── */}
                {step === 1 && (
                    <div>
                        <div className="mb-5">
                            <p className="text-[11px] font-black uppercase tracking-widest text-neutral-400 mb-0.5">
                                Transferís el grupo
                            </p>
                            <p className="font-black text-base uppercase tracking-tight text-black dark:text-white">
                                {group.name}
                            </p>
                        </div>

                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 border-l-2 border-purple-400 pl-3">
                            Solo usuarios con rol <strong>Anfitrión</strong> pueden recibir la titularidad de un grupo.
                        </p>

                        <div className="mb-3">
                            <label htmlFor="transfer-search" className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1.5">
                                Buscar destinatario
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" aria-hidden="true" />
                                <input
                                    id="transfer-search"
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Nombre o email..."
                                    autoComplete="off"
                                    className="w-full h-11 pl-9 pr-10 border-2 border-black font-bold text-sm text-black dark:text-white dark:bg-black bg-white focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow duration-150"
                                    aria-describedby="search-hint"
                                />
                                {searching ? (
                                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 animate-spin" aria-hidden="true" />
                                ) : searchTerm.trim().length >= 2 && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchVersion(v => v + 1)}
                                        title="Actualizar resultados"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                                        aria-label="Forzar nueva búsqueda"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            <p id="search-hint" className="text-[10px] text-neutral-400 mt-1">
                                Mínimo 2 caracteres
                            </p>
                        </div>

                        <div role="listbox" aria-label="Resultados de búsqueda" aria-live="polite">
                            {searchResults.length > 0 && (
                                <div className="border-2 border-black overflow-hidden max-h-60 overflow-y-auto">
                                    {searchResults.map((user, i) => (
                                        <div
                                            key={user.id}
                                            role="option"
                                            aria-selected={false}
                                            aria-disabled={!user.isHost}
                                            onClick={() => handleSelectUser(user)}
                                            onKeyDown={e => e.key === 'Enter' && handleSelectUser(user)}
                                            tabIndex={user.isHost ? 0 : -1}
                                            className={`flex items-center justify-between p-3 min-h-[52px] transition-all duration-150 ${i < searchResults.length - 1 ? 'border-b border-neutral-100 dark:border-neutral-800' : ''} ${user.isHost ? 'hover:bg-purple-50 dark:hover:bg-purple-950/30 cursor-pointer focus:outline-none focus:bg-purple-50 dark:focus:bg-purple-950/30' : 'opacity-50 cursor-not-allowed bg-neutral-50 dark:bg-neutral-900/50 select-none'}`}
                                        >
                                            <div className="min-w-0 mr-3 flex-1">
                                                <p className="font-bold text-sm text-black dark:text-white truncate">{user.name}</p>
                                                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{user.email}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {!user.isHost && <Lock className="w-3 h-3 text-neutral-400" aria-hidden="true" />}
                                                <span className={`text-[9px] font-black uppercase px-2 py-1 ${user.isHost ? 'bg-purple-600 text-white' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400'}`}>
                                                    {user.isHost ? getRoleLabel(user.role) : 'Sin permiso'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {searchTerm.trim().length >= 2 && !searching && searchResults.length === 0 && (
                                <div className="border-2 border-dashed border-neutral-200 dark:border-neutral-700 p-6 text-center">
                                    <p className="text-sm font-bold text-neutral-400">Sin resultados para "{searchTerm}"</p>
                                    <p className="text-xs text-neutral-400 mt-1">Probá con nombre completo o email exacto</p>
                                </div>
                            )}

                            {searchTerm.trim().length < 2 && (
                                <div className="p-4 text-center">
                                    <Search className="w-8 h-8 text-neutral-200 dark:text-neutral-700 mx-auto mb-2" aria-hidden="true" />
                                    <p className="text-xs text-neutral-400">Escribí nombre o email del nuevo anfitrión</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ─── PASO 2: Datos del destinatario ───────────── */}
                {step === 2 && selectedUser && (
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-neutral-400 mb-4">
                            Confirmá el destinatario
                        </p>

                        <div className="border-2 border-black dark:border-white p-4 mb-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)]">
                            <div className="flex items-start justify-between gap-2 mb-3">
                                <p className="font-black text-base uppercase tracking-tight text-black dark:text-white">{selectedUser.name}</p>
                                <span className="text-[9px] font-black uppercase px-2 py-1 bg-purple-600 text-white shrink-0">{getRoleLabel(selectedUser.role)}</span>
                            </div>
                            <div className="space-y-2">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-0.5">Email</p>
                                    <p className="font-bold text-sm text-black dark:text-white break-all">{selectedUser.email}</p>
                                </div>
                                {selectedUser.phone && (
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-0.5">Teléfono</p>
                                        <p className="font-bold text-sm font-mono text-black dark:text-white">{maskPhone(selectedUser.phone)}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <p className="text-[10px] text-neutral-400 mb-5">
                            Recibirá una notificación para aceptar o rechazar la transferencia.
                        </p>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => { setSelectedUser(null); setStep(1); }}
                                className="flex-1 flex items-center justify-center gap-2 min-h-[44px] border-2 border-black dark:border-white text-black dark:text-white font-black uppercase tracking-widest text-xs hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all duration-150 cursor-pointer"
                                aria-label="Volver al paso anterior"
                            >
                                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                                Volver
                            </button>
                            <button
                                type="button"
                                onClick={() => setStep(3)}
                                className="flex-[2] min-h-[44px] bg-black dark:bg-white text-white dark:text-black font-black uppercase tracking-widest text-xs hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white border-2 border-black dark:border-white hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-150 cursor-pointer"
                            >
                                Continuar →
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── PASO 3: Confirmación final ───────────────── */}
                {step === 3 && selectedUser && (
                    <div>
                        <div className="flex items-center gap-3 p-3 bg-neutral-100 dark:bg-neutral-900 border-2 border-black dark:border-white mb-4">
                            <ArrowLeftRight className="w-5 h-5 shrink-0 text-purple-500" aria-hidden="true" />
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Transferís</p>
                                <p className="font-black text-sm uppercase truncate text-black dark:text-white">{group.name}</p>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                    a <span className="font-black text-purple-600 dark:text-purple-400">{selectedUser.name}</span>
                                </p>
                            </div>
                        </div>

                        <div className="border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-4 mb-5 flex gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-1">
                                    Acción irreversible
                                </p>
                                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 leading-relaxed">
                                    Al transferir, perderás la titularidad permanentemente.
                                    Solo un Encargado de Grupos o el Administrador puede revertir esta acción.
                                </p>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label htmlFor="confirm-transfer" className="block text-xs font-bold text-black dark:text-white mb-2">
                                Escribí <strong>"Transferir"</strong> para confirmar:
                            </label>
                            <input
                                id="confirm-transfer"
                                ref={confirmInputRef}
                                type="text"
                                value={confirmText}
                                onChange={e => setConfirmText(e.target.value)}
                                placeholder='Transferir'
                                autoComplete="off"
                                className="w-full h-11 px-3 border-2 border-black font-bold text-black dark:text-white dark:bg-black bg-white focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-150"
                                aria-describedby={error ? 'confirm-error' : undefined}
                            />
                        </div>

                        {error && (
                            <div id="confirm-error" role="alert" className="flex items-start gap-2 text-xs font-bold text-red-600 dark:text-red-400 mb-4 border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => { setConfirmText(''); setError(null); setStep(2); }}
                                className="flex-1 flex items-center justify-center gap-2 min-h-[44px] border-2 border-black dark:border-white text-black dark:text-white font-black uppercase tracking-widest text-xs hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all duration-150 cursor-pointer"
                                aria-label="Volver al paso anterior"
                            >
                                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                                Volver
                            </button>
                            <button
                                type="button"
                                disabled={!canConfirm}
                                onClick={handleConfirm}
                                className={`flex-[2] min-h-[44px] font-black uppercase tracking-widest text-xs border-2 transition-all duration-150 flex items-center justify-center gap-2 ${canConfirm ? 'bg-black dark:bg-white border-black dark:border-white text-white dark:text-black hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer' : 'bg-neutral-200 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-400 cursor-not-allowed'}`}
                                aria-disabled={!canConfirm}
                            >
                                {loading
                                    ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Transfiriendo...</>
                                    : <><ArrowLeftRight className="w-4 h-4" aria-hidden="true" /> Transferir grupo</>
                                }
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PaginaTransferirGrupo;
