import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Group, SeasonSettings, DEFAULT_SEASON_SETTINGS } from '../../types';
import { supabaseService, toggleGroupCapacityLock } from '../../services/supabaseService';
import {
    ArrowLeft, Calendar, MapPin, Edit2, Inbox, ClipboardList,
    RotateCcw, UserMinus, UserPlus, Check, Link, ArrowLeftRight, Lock, Unlock,
    Loader2, ImageIcon
} from 'lucide-react';
import NeoModal from '../../components/ui/NeoModal';

// Cuenta personas reales, no filas de registro
// (una pareja = 2 personas)
function countApprovedPeople(registrations?: any[]): number {
    if (!registrations) return 0;
    return registrations
        .filter((r: any) => r.status === 'APPROVED')
        .reduce((total: number, r: any) => {
            const esPareja = !!(r.partnerData || r.partner_data);
            return total + (esPareja ? 2 : 1);
        }, 0);
}

interface Member {
    id: string;
    name: string;
    email: string;
    phone?: string;
    isPartner?: boolean;
}

// Expande cada registro aprobado a 1 o 2 personas
// (mismo criterio que ModalAsistencia.tsx)
function buildRoster(registrations?: any[]): Member[] {
    if (!registrations) return [];
    return registrations
        .filter((r: any) => r.status === 'APPROVED')
        .flatMap((r: any) => {
            const titular: Member = {
                id: r.id,
                name: `${r.first_name || r.firstName || ''} ${r.last_name || r.lastName || ''}`.trim() || 'Sin nombre',
                email: r.email || '',
                phone: r.phone || '',
            };
            const partner = r.partnerData || r.partner_data;
            if (!partner) return [titular];
            const parejaMember: Member = {
                id: `${r.id}-partner`,
                name: `${partner.firstName || partner.first_name || ''} ${partner.lastName || partner.last_name || ''}`.trim() || 'Sin nombre',
                email: partner.email || '',
                phone: partner.phone || '',
                isPartner: true,
            };
            return [titular, parejaMember];
        });
}

// Iniciales para el avatar del roster
function getInitials(name: string): string {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length === 0) return '?';
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

const DetalleGrupoAnfitrion: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();

    const [group, setGroup] = useState<Group | null>(null);
    const [loading, setLoading] = useState(true);
    const [seasonSettings, setSeasonSettings] = useState<SeasonSettings>(DEFAULT_SEASON_SETTINGS);

    // Modales — mismos estados que PanelAnfitrion.tsx
    const [copiedLink, setCopiedLink] = useState(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successModalMessage, setSuccessModalMessage] = useState('');
    const [descripcionExpandida, setDescripcionExpandida] = useState(false);

    const fetchGroup = useCallback(async () => {
        if (!currentUser || !groupId) return;
        setLoading(true);
        try {
            const owned = await supabaseService.getGroupsByHost(currentUser.id);
            const found = owned.find(g => g.id === groupId);
            if (!found) {
                navigate('/mis-grupos', { replace: true });
                return;
            }
            setGroup(found);
        } finally {
            setLoading(false);
        }
    }, [currentUser, groupId, navigate]);

    useEffect(() => { fetchGroup(); }, [fetchGroup]);

    useEffect(() => {
        supabaseService.getAppConfig().then(cfg => {
            if (cfg?.groupsConfig?.seasonSettings) {
                setSeasonSettings(cfg.groupsConfig.seasonSettings);
            }
        });
    }, []);

    // ── Handlers — copiados de PanelAnfitrion.tsx ──
    const handleCopyGroupLink = () => {
        if (!group) return;
        const origin = window.location.hostname.includes('localhost') || window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)
            ? 'https://app.origeniglesia.org'
            : window.location.origin;
        const url = `${origin}/#/gcx?groupId=${group.id}`;

        const fallbackCopy = () => {
            const textArea = document.createElement("textarea");
            textArea.value = url;
            textArea.style.position = "fixed";
            textArea.style.top = "0";
            textArea.style.left = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                if (document.execCommand('copy')) {
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                }
            } catch (err) {
                console.error('Fallback copy failed', err);
            }
            document.body.removeChild(textArea);
        };

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(url).then(() => {
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
            }).catch(() => fallbackCopy());
        } else {
            fallbackCopy();
        }
    };

    const handleToggleCapacityLock = async () => {
        if (!group) return;
        const nuevoEstado = !group.capacityLocked;
        const ok = await toggleGroupCapacityLock(group.id, nuevoEstado);
        if (ok) {
            await fetchGroup();
        } else {
            alert('No se pudo cambiar el bloqueo de cupos. Probá de nuevo.');
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
            <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
        </div>
    );

    if (!group) return null;

    // ── Datos derivados ──
    const isFinished = !!(group.endDate && group.endDate < new Date().toISOString().split('T')[0]);
    const isMainHost = (group as any).co_host_id !== currentUser?.id;
    const isCoHost = (group as any).co_host_id === currentUser?.id;
    const isApproved = group.status === 'approved';
    const isRejected = group.status === 'rejected';
    const roster = buildRoster(group.registrations);
    const approved = countApprovedPeople(group.registrations);
    const maxCap = group.maxCapacity || 12;
    const capacityPct = maxCap > 0 ? Math.min(100, Math.round((approved / maxCap) * 100)) : 0;
    const pendingCount = (group.registrations || []).filter((r: any) => r.status === 'PENDING').length;
    const showActionBar = isApproved || isRejected || isFinished;

    // ── Vocabulario de botones (una sola escala, no un arcoíris) ──
    const primaryBtn = "group/attn relative flex items-center justify-center gap-2.5 w-full sm:w-auto px-6 min-h-[52px] rounded-xl bg-[#118f46] text-white text-sm font-black uppercase tracking-wide border-2 border-[#0d7036] shadow-[4px_4px_0px_0px_#0a3d20] hover:bg-[#0d7036] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#118f46]/30";
    const secondaryBtn = "flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-wide hover:border-slate-900 dark:hover:border-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-white";
    const utilBtn = "flex shrink-0 items-center gap-1.5 px-2.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400";

    return (
        <div className="min-h-screen bg-white dark:bg-black">
            <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-10">

                {/* Volver */}
                <button
                    onClick={() => navigate('/mis-grupos')}
                    className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-black dark:hover:text-white transition-colors mb-6 font-black uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Mis grupos
                </button>

                {/* ── Header: la "ficha" del grupo ── */}
                <header className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden mb-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
                    <div className="flex gap-4 p-4 sm:p-5">
                        {group.imageUrl ? (
                            <img
                                src={group.imageUrl}
                                alt={group.name}
                                className="w-20 h-20 sm:w-28 sm:h-28 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                            />
                        ) : (
                            <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                <ImageIcon className="w-7 h-7 text-slate-300" />
                            </div>
                        )}

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                {isCoHost && (
                                    <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full">
                                        Co-líder
                                    </span>
                                )}
                                {isFinished ? (
                                    <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-full">
                                        Finalizado
                                    </span>
                                ) : isApproved ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                                        <Check className="w-2.5 h-2.5" /> Activo
                                    </span>
                                ) : isRejected ? (
                                    <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">
                                        Rechazado
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full motion-safe:animate-pulse">
                                        En revisión
                                    </span>
                                )}
                            </div>

                            <h1 className="text-xl sm:text-3xl font-black uppercase tracking-tight text-black dark:text-white leading-none mb-2 break-words">
                                {group.name}
                            </h1>

                            <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-slate-500 dark:text-slate-400">
                                <span className="inline-flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 shrink-0" />{group.meetingDay} {group.meetingTime}
                                </span>
                                <span className="inline-flex items-center gap-1.5 min-w-0">
                                    <MapPin className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{group.location || 'Sin ubicación'}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Medidor de cupos — información real que el anfitrión usa para decidir bloquear */}
                    {isApproved && (
                        <div className="px-4 sm:px-5 pb-4 pt-1">
                            <div className="flex items-baseline justify-between mb-1.5">
                                <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    {group.capacityLocked
                                        ? <><Lock className="w-3 h-3" /> Cupos cerrados</>
                                        : <>Cupos abiertos</>}
                                </span>
                                <span className="text-[11px] font-black tabular-nums text-slate-600 dark:text-slate-300">
                                    {approved}<span className="text-slate-400">/{maxCap}</span>
                                </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${group.capacityLocked ? 'bg-neutral-800 dark:bg-neutral-400' : 'bg-[#118f46]'}`}
                                    style={{ width: `${capacityPct}%` }}
                                />
                            </div>
                        </div>
                    )}
                </header>

                {/* Descripción */}
                {group.description && (
                    <div className="mb-6 max-w-2xl">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                            Descripción
                        </p>
                        <p
                            className={`text-sm text-slate-600 dark:text-slate-300 leading-relaxed break-words ${
                                descripcionExpandida ? '' : 'line-clamp-3'
                            }`}
                        >
                            {group.description}
                        </p>
                        {group.description.length > 140 && (
                            <button
                                type="button"
                                onClick={() => setDescripcionExpandida(prev => !prev)}
                                className="mt-1.5 text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                            >
                                {descripcionExpandida ? 'Ver menos' : 'Ver más'}
                            </button>
                        )}
                    </div>
                )}

                {/* Motivo de rechazo — dirección, no adorno */}
                {group.adminNote && isRejected && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                        <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-1">Qué revisar antes de reenviar</p>
                        <p className="text-sm text-red-700 dark:text-red-400 leading-relaxed">{group.adminNote}</p>
                    </div>
                )}

                {/* ── Barra de acciones: jerarquía por frecuencia ── */}
                {showActionBar && (
                    <section className="mb-10">
                        {/* Primaria + secundarias */}
                        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-stretch gap-2.5">
                            {/* PRIMARIA — el ritual semanal */}
                            {isFinished ? (
                                <button onClick={() => navigate(`/mis-grupos/${group.id}/reabrir-grupo`)} className={primaryBtn}>
                                    <RotateCcw className="w-4 h-4" />
                                    Re-abrir grupo
                                </button>
                            ) : isApproved ? (
                                <button onClick={() => navigate(`/mis-grupos/${group.id}/asistencia`)} className={primaryBtn}>
                                    <ClipboardList className="w-4 h-4" />
                                    Tomar asistencia
                                </button>
                            ) : (isRejected && isMainHost) ? (
                                <button onClick={() => navigate(`/mis-grupos/${group.id}/editar-grupo`)} className={primaryBtn}>
                                    <Edit2 className="w-4 h-4" />
                                    Editar y reenviar
                                </button>
                            ) : null}

                            {/* SECUNDARIAS — sumar gente (solo grupos activos) */}
                            {isApproved && (
                                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2.5">
                                    <button
                                        onClick={() => navigate(`/mis-grupos/${group.id}/solicitudes`)}
                                        className={`${secondaryBtn} relative`}
                                    >
                                        <Inbox className="w-4 h-4" />
                                        Solicitudes
                                        {pendingCount > 0 && (
                                            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-400 text-black text-[10px] font-black tabular-nums">
                                                {pendingCount}
                                            </span>
                                        )}
                                    </button>
                                    <button onClick={handleCopyGroupLink} className={secondaryBtn}>
                                        {copiedLink
                                            ? <><Check className="w-4 h-4 text-[#28a946]" /> <span className="text-[#28a946]">¡Copiado!</span></>
                                            : <><Link className="w-4 h-4" /> Compartir</>}
                                    </button>
                                    <button onClick={() => navigate(`/mis-grupos/${group.id}/inscribir`)} className={secondaryBtn}>
                                        <UserPlus className="w-4 h-4" />
                                        Inscribir
                                    </button>
                                    <button
                                        onClick={handleToggleCapacityLock}
                                        className={group.capacityLocked
                                            ? "flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-black text-xs font-black uppercase tracking-wide border-2 border-neutral-900 dark:border-neutral-100 hover:opacity-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
                                            : secondaryBtn}
                                    >
                                        {group.capacityLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                        {group.capacityLocked ? 'Abrir grupo' : 'Cerrar cupos'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* UTILITARIAS — ajustes poco frecuentes, centradas */}
                        {isApproved && (
                            <div className="flex flex-nowrap items-center justify-center gap-1 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                <button onClick={() => navigate(`/mis-grupos/${group.id}/bajas`)} className={utilBtn}>
                                    <UserMinus className="w-3.5 h-3.5" /> Bajas
                                </button>
                                {isMainHost && (
                                    <button onClick={() => navigate(`/mis-grupos/${group.id}/transferir`)} className={utilBtn}>
                                        <ArrowLeftRight className="w-3.5 h-3.5" /> Transferir
                                    </button>
                                )}
                                {!isFinished && isMainHost && (
                                    <button onClick={() => navigate(`/mis-grupos/${group.id}/editar-grupo`)} className={utilBtn}>
                                        <Edit2 className="w-3.5 h-3.5" /> Editar
                                    </button>
                                )}
                                {isFinished && (
                                    <button onClick={() => navigate(`/mis-grupos/${group.id}/asistencia`)} className={utilBtn}>
                                        <ClipboardList className="w-3.5 h-3.5" /> Ver asistencia
                                    </button>
                                )}
                            </div>
                        )}
                    </section>
                )}

                {/* ── Integrantes: la gente es el punto del grupo ── */}
                <section>
                    <div className="flex items-baseline gap-2 mb-3">
                        <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-white">
                            Integrantes
                        </h2>
                        <span className="text-[11px] font-black tabular-nums text-slate-400">{roster.length}</span>
                    </div>

                    {roster.length === 0 ? (
                        <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Todavía no hay nadie en el grupo.</p>
                            {isApproved && (
                                <button
                                    onClick={handleCopyGroupLink}
                                    className="text-xs font-black uppercase tracking-wide text-[#118f46] hover:text-[#0d7036] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#118f46]/40 rounded"
                                >
                                    Compartí el enlace para que empiecen a sumarse →
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Mobile — tarjetas */}
                            <div className="md:hidden space-y-2">
                                {roster.map(m => (
                                    <div key={m.id} className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                                        <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-black flex items-center justify-center shrink-0">
                                            {getInitials(m.name)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{m.name}</p>
                                                {m.isPartner && (
                                                    <span className="text-[8px] font-black uppercase tracking-wider text-purple-500 shrink-0">pareja</span>
                                                )}
                                            </div>
                                            {m.email && <p className="text-xs text-slate-400 truncate">{m.email}</p>}
                                            {m.phone && <p className="text-xs text-slate-400">{m.phone}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop — tabla */}
                            <div className="hidden md:block rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-800">
                                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Nombre</th>
                                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Email</th>
                                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Teléfono</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {roster.map(m => (
                                            <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-black flex items-center justify-center shrink-0">
                                                            {getInitials(m.name)}
                                                        </div>
                                                        <span className="text-sm font-bold text-slate-900 dark:text-white">{m.name}</span>
                                                        {m.isPartner && (
                                                            <span className="text-[8px] font-black uppercase tracking-wider text-purple-500">pareja</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-500">{m.email || '—'}</td>
                                                <td className="px-4 py-3 text-sm text-slate-500">{m.phone || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </section>
            </div>

            {/* ── Modales ── */}
            <NeoModal
                isOpen={isSuccessModalOpen}
                onClose={() => setIsSuccessModalOpen(false)}
                maxWidth="max-w-md"
            >
                <div className="flex flex-col items-center justify-center p-6 text-center space-y-6">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center shadow-inner">
                        <Check className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-tight text-black dark:text-white">
                        {successModalMessage.includes('creado') ? '¡Grupo Creado!' : '¡Solicitud Enviada!'}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                        {successModalMessage}
                    </p>
                    <button
                        onClick={() => setIsSuccessModalOpen(false)}
                        className="mt-4 w-full py-4 bg-[#118f46] text-white font-black uppercase tracking-widest rounded-xl hover:bg-[#0d7036] transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] active:shadow-none active:translate-y-1"
                    >
                        Entendido
                    </button>
                </div>
            </NeoModal>
        </div>
    );
};

export default DetalleGrupoAnfitrion;
