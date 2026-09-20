import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Group, GroupCategory, SeasonSettings, DEFAULT_SEASON_SETTINGS, esGrupoFinalizado } from '../../types';
import { supabaseService, toggleGroupCapacityLock, updateGroupDirect } from '../../services/supabaseService';
import { ArrowLeft, ArrowRight, Camera, Check, Link, Loader2, Plus } from 'lucide-react';
import NeoModal from '../../components/ui/NeoModal';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { T, btnPrimario, btnSecundario, rotulo, FilaAccion, Separador } from '../../components/GCX/patron';

// Lucide no incluye logos de marca — se embebe el
// glifo real de WhatsApp como SVG inline (currentColor).
const WhatsAppLogo: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.993c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.05 0 5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.423-8.452" />
    </svg>
);

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
    desde?: string;
}

// Expande cada registro aprobado a 1 o 2 personas
// (mismo criterio que ModalAsistencia.tsx)
function buildRoster(registrations?: any[]): Member[] {
    if (!registrations) return [];
    return registrations
        .filter((r: any) => r.status === 'APPROVED')
        .flatMap((r: any) => {
            const desde = r.timestamp || r.created_at || undefined;
            const titular: Member = {
                id: r.id,
                name: `${r.first_name || r.firstName || ''} ${r.last_name || r.lastName || ''}`.trim() || 'Sin nombre',
                email: r.email || '',
                phone: r.phone || '',
                desde,
            };
            const partner = r.partnerData || r.partner_data;
            if (!partner) return [titular];
            const parejaMember: Member = {
                id: `${r.id}-partner`,
                name: `${partner.firstName || partner.first_name || ''} ${partner.lastName || partner.last_name || ''}`.trim() || 'Sin nombre',
                email: partner.email || '',
                phone: partner.phone || '',
                isPartner: true,
                desde,
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

// "Miembro desde marzo". Parseo manual: new Date('YYYY-MM-DD') interpreta en
// UTC y en Argentina retrocede un día, corriendo el mes cuando cae el día 1.
function miembroDesde(iso?: string): string {
    if (!iso) return 'Miembro del grupo';
    const soloFecha = iso.slice(0, 10);
    const [y, m, d] = soloFecha.split('-').map(Number);
    if (!y || !m || !d) return 'Miembro del grupo';
    const mes = new Date(y, m - 1, d).toLocaleDateString('es-AR', { month: 'long' });
    return `Miembro desde ${mes}`;
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Próxima fecha en la que cae `meetingDay`, para la línea bajo "Tomar asistencia".
function proximaReunion(meetingDay?: string): string | null {
    const objetivo = DIAS.indexOf(meetingDay || '');
    if (objetivo < 0) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const f = new Date(hoy);
    f.setDate(f.getDate() + ((objetivo - hoy.getDay() + 7) % 7));
    const esHoy = f.getTime() === hoy.getTime();
    const texto = f.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    return esHoy ? `La reunión es hoy, ${texto}` : `Próxima reunión: ${texto}`;
}

const DetalleGrupoAnfitrion: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();

    const [group, setGroup] = useState<Group | null>(null);
    const [loading, setLoading] = useState(true);
    const [seasonSettings, setSeasonSettings] = useState<SeasonSettings>(DEFAULT_SEASON_SETTINGS);

    const [copiedLink, setCopiedLink] = useState(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successModalMessage, setSuccessModalMessage] = useState('');
    const [descripcionExpandida, setDescripcionExpandida] = useState(false);
    const [verTodos, setVerTodos] = useState(false);

    // Categorías — usadas para tintar el QR con el color de la categoría del grupo
    const [categories, setCategories] = useState<GroupCategory[]>([]);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);

    // Portada: se cambia tocando la foto, sin pasar por el formulario.
    const inputPortadaRef = useRef<HTMLInputElement>(null);
    const [subiendoPortada, setSubiendoPortada] = useState(false);
    const [errorPortada, setErrorPortada] = useState<string | null>(null);

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

    useEffect(() => {
        supabaseService.getGroupCategories().then(setCategories);
    }, []);

    // URL compartida — usada tanto por "Compartir" como
    // por el QR. Una sola fuente de verdad.
    const buildGroupShareUrl = (groupId: string): string => {
        const origin = window.location.hostname.includes('localhost') || window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)
            ? 'https://app.origeniglesia.org'
            : window.location.origin;
        return `${origin}/#/gcx?groupId=${groupId}`;
    };

    const handleCopyGroupLink = () => {
        if (!group) return;
        const url = buildGroupShareUrl(group.id);

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

    const handleShareWhatsapp = () => {
        if (!group) return;
        const url = buildGroupShareUrl(group.id);
        const message = `¡Te invito a sumarte a nuestro grupo de conexión "${group.name}"! Anotate acá: ${url}`;
        // Sin número de teléfono: abre el selector de
        // contactos de WhatsApp para elegir a quién enviarlo.
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
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

    // ── Cambiar la portada tocando la foto ──────────────────────────────
    // Mismos límites que el formulario de edición (SubidaImagen): imagen
    // y hasta 5MB. No recorta: la banda es de alto fijo con object-cover,
    // así que cualquier proporción entra sin deformarse. Para encuadrar a
    // mano sigue estando el formulario de editar el grupo.
    const handlePortadaElegida = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        // Se limpia el input antes de cualquier salida: si no, volver a
        // elegir la misma foto no dispara el change y parece que se colgó.
        e.target.value = '';
        if (!file || !group) return;

        setErrorPortada(null);

        if (!file.type.startsWith('image/')) {
            setErrorPortada('Ese archivo no es una imagen.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setErrorPortada('La imagen no puede pesar más de 5 MB.');
            return;
        }

        setSubiendoPortada(true);
        try {
            const url = await supabaseService.uploadImage(file, 'groups');
            if (!url) throw new Error('No se pudo subir la imagen.');

            const guardado = await updateGroupDirect({ ...group, imageUrl: url } as Group);
            if (!guardado) throw new Error('No se pudo guardar la portada.');

            await fetchGroup();
        } catch (err: any) {
            console.error('[Portada] Error:', err);
            setErrorPortada(err?.message || 'No se pudo cambiar la portada.');
        } finally {
            setSubiendoPortada(false);
        }
    };

    if (loading) return (
        <div className={`min-h-screen flex items-center justify-center ${T.fondo}`}>
            <Loader2 className="w-8 h-8 animate-spin text-black/20 dark:text-white/20" />
        </div>
    );

    if (!group) return null;

    // ── Datos derivados ──
    // Antes miraba sólo la fecha de fin. Un grupo reabierto deja al original
    // en `status: 'finished'` sin tocarle la fecha, así que ése se colaba como
    // activo y seguía ofreciendo editar y tomar asistencia.
    const isFinished = esGrupoFinalizado(group);
    const isMainHost = (group as any).co_host_id !== currentUser?.id;
    const isApproved = group.status === 'approved';
    const isRejected = group.status === 'rejected';
    const roster = buildRoster(group.registrations);
    const approved = countApprovedPeople(group.registrations);
    const maxCap = group.maxCapacity || 12;
    const libres = Math.max(0, maxCap - approved);
    const pendingCount = (group.registrations || []).filter((r: any) => r.status === 'PENDING').length;
    const categoryColor = categories.find(c => c.id === group.categoryId)?.color || '#64748b';
    const ir = (sub: string) => () => navigate(`/mis-grupos/${group.id}/${sub}`);

    const estado = isFinished
        ? { texto: 'Finalizado', color: 'oklch(0.55 0 0)' }
        : isRejected
            ? { texto: 'Rechazado', color: 'oklch(0.58 0.2 25)' }
            : isApproved
                ? { texto: 'Activo', color: 'oklch(0.62 0.15 150)' }
                : { texto: 'En revisión', color: 'oklch(0.75 0.15 85)' };

    const anfitriones = [
        `Anfitrión: ${group.leaderName || ''} ${group.leaderSurname || ''}`.trim(),
        (group.coHostFirstName || group.coHostLastName)
            ? `Co-anfitrión: ${group.coHostFirstName || ''} ${group.coHostLastName || ''}`.trim()
            : null,
    ].filter(Boolean).join(' · ');

    // Un grupo terminado no tiene próxima reunión: anunciar una sería avisar
    // de algo que no va a pasar.
    const proxima = isFinished ? null : proximaReunion(group.meetingDay);
    const visibles = verTodos ? roster : roster.slice(0, 8);

    // ── Piezas compartidas entre mobile y desktop ──

    const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <span className={`h-[38px] px-4 rounded-full ${T.chip} flex items-center gap-2.5 text-[14px] font-semibold text-black/65 dark:text-white/65`}>
            {children}
        </span>
    );

    // Terminada la temporada no se resuelven solicitudes: quedan para el
    // grupo nuevo, si se reabre.
    const FilaSolicitudes = pendingCount > 0 && !isFinished ? (
        <button
            type="button"
            onClick={ir('solicitudes')}
            className="w-full flex items-center gap-3.5 h-[66px] px-[18px] rounded-[22px] bg-[#0a0a0a] dark:bg-white transition-opacity hover:opacity-90"
        >
            <span
                className="min-w-[26px] h-[26px] px-2 rounded-full text-white text-[13.5px] font-semibold flex items-center justify-center"
                style={{ background: 'oklch(0.58 0.2 25)' }}
            >
                {pendingCount}
            </span>
            <span className="flex-1 text-left text-[15.5px] font-semibold text-white dark:text-black">
                {pendingCount === 1 ? 'Solicitud por revisar' : 'Solicitudes por revisar'}
            </span>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round" className="text-white/60 dark:text-black/40" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
            </svg>
        </button>
    ) : null;

    // MIEMBROS — las cuatro acciones ocasionales, agrupadas en una superficie.
    // Ninguna aplica con la temporada cerrada: no se anota, no se da de baja,
    // no se deriva, y compartir el enlace llevaría a un grupo al que ya no se
    // puede entrar.
    const ListaMiembros = isFinished ? null : (
        <>
            <p className={`${rotulo} px-1`}>Miembros</p>
            <div className={`mt-3 ${T.interna} rounded-[24px] overflow-hidden`}>
                <FilaAccion texto="Inscribir a alguien" onClick={ir('inscribir')} />
                <Separador />
                <FilaAccion texto="Dar de baja un miembro" onClick={ir('bajas')} />
                <Separador />
                <FilaAccion texto="Derivar a otro grupo" onClick={ir('derivar')} />
                <Separador />
                <FilaAccion texto="Compartir por WhatsApp" onClick={handleShareWhatsapp} />
            </div>
        </>
    );

    // ADMINISTRACIÓN — sin fondo ni ícono, deliberadamente apagado.
    // Además de las dos del diseño van acá las que ya existían y no tenían
    // otro lugar: QR/link, bloqueo de cupo y reapertura.
    const ListaAdmin = (
        <div className="px-1">
            <p className={`${rotulo} mt-6`}>Administración</p>
            <div className="flex flex-col mt-1">
                {/* Con la temporada cerrada queda una sola salida: reabrir. El
                    resto edita un grupo que ya terminó, y el historial no se
                    toca. Vuelven todas solas en el grupo nuevo. */}
                {isFinished ? (
                    <FilaAccion texto="Reabrir para otra temporada" onClick={ir('reabrir-grupo')} />
                ) : (
                    <>
                        <FilaAccion tenue texto="Editar los datos del grupo" onClick={ir('editar-grupo')} />
                        {isMainHost && <FilaAccion tenue texto="Transferir el grupo" onClick={ir('transferir')} />}
                        <FilaAccion tenue texto="Código QR y enlace" onClick={() => setIsQrModalOpen(true)} />
                        {isApproved && (
                            <FilaAccion
                                tenue
                                texto={group.capacityLocked ? 'Reabrir el cupo' : 'Cerrar el cupo'}
                                onClick={handleToggleCapacityLock}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );

    // Terminada la temporada, el mismo lugar deja de ser una acción y pasa a
    // ser la puerta al historial: la asistencia ya no se carga, se consulta.
    const BotonAsistencia = isFinished ? (
        <button
            type="button"
            onClick={() => navigate(`/mis-grupos/${group.id}/asistencia?vista=historial`)}
            className={`${btnSecundario} h-[60px] text-[17px]`}
        >
            Ver el historial de asistencia
        </button>
    ) : (
        <button type="button" onClick={ir('asistencia')} className={`${btnPrimario} h-[60px] text-[17px]`}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 12.5l5 5 10-11" /></svg>
            Tomar asistencia
        </button>
    );

    // La foto entera es el control: tocarla abre la galería. El botón va
    // por debajo de las píldoras que se superponen (volver, estado), que
    // están más arriba en el z, así que esos toques siguen siendo suyos.
    const Foto: React.FC<{ alto: string; radio: string }> = ({ alto, radio }) => (
        <button
            type="button"
            /* Cambiar la portada también es editar el grupo: con la
                temporada cerrada la foto queda como quedó. */
            onClick={() => !subiendoPortada && !isFinished && inputPortadaRef.current?.click()}
            disabled={subiendoPortada || isFinished}
            aria-label={isFinished
                ? 'Foto de portada del grupo'
                : group.imageUrl ? 'Cambiar la foto de portada' : 'Poner una foto de portada'}
            className={`group/foto relative block w-full ${alto} ${radio} overflow-hidden text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black/15`}
            style={group.imageUrl ? undefined : { background: 'repeating-linear-gradient(135deg,#e6e4e0 0 10px,#dedbd6 10px 20px)' }}
        >
            {group.imageUrl && <img src={group.imageUrl} alt="" className="w-full h-full object-cover" />}

            {/* Sin foto, la invitación ocupa el centro y no hay que adivinar
                que el rectángulo rayado se toca. */}
            {!group.imageUrl && !subiendoPortada && !isFinished && (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-black/45">
                    <Camera className="w-6 h-6" strokeWidth={1.8} aria-hidden="true" />
                    <span className="text-[13.5px] font-semibold">Poner una foto</span>
                </span>
            )}

            {/* Con foto, una píldora discreta abajo a la derecha. */}
            {group.imageUrl && !subiendoPortada && !errorPortada && !isFinished && (
                <span className="absolute bottom-3.5 right-3.5 h-9 px-3.5 rounded-full bg-white/[.94] flex items-center gap-2 text-[13px] font-semibold text-black transition-opacity opacity-90 group-hover/foto:opacity-100">
                    <Camera className="w-[15px] h-[15px]" strokeWidth={2} aria-hidden="true" />
                    Cambiar
                </span>
            )}

            {/* El error ocupa el mismo lugar que la píldora, así no hace falta
                duplicarlo en los dos armados (móvil y escritorio). */}
            {errorPortada && !subiendoPortada && (
                <span
                    role="status"
                    className="absolute bottom-3.5 left-3.5 right-3.5 rounded-[18px] bg-white/[.96] px-4 py-2.5 text-[13px] leading-[1.45] font-semibold text-[oklch(0.52_0.19_25)]"
                >
                    {errorPortada} Tocá para probar de nuevo.
                </span>
            )}

            {subiendoPortada && (
                <span className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center gap-2.5 text-white">
                    <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
                    <span className="text-[13.5px] font-semibold">Subiendo la portada…</span>
                </span>
            )}
        </button>
    );

    const PildoraEstado = (
        <div className="h-[34px] px-3.5 rounded-full bg-white/[.94] dark:bg-black/70 flex items-center gap-[7px] text-[12.5px] font-semibold text-black dark:text-white">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: estado.color }} />
            {estado.texto}
        </div>
    );

    const Miembros = (
        <>
            <div className="flex items-center justify-between gap-4 mb-[18px]">
                <div className="flex items-baseline gap-2.5">
                    <h2 className="text-[19px] font-semibold tracking-[-.01em]">Miembros</h2>
                    <span className="text-[15px] font-semibold text-black/40 dark:text-white/40">{approved}</span>
                </div>
                {!isFinished && (
                    <button
                        type="button"
                        onClick={ir('inscribir')}
                        className={`h-[42px] px-[18px] rounded-full ${T.chip} flex items-center gap-2 text-[14px] font-semibold transition-colors hover:opacity-80`}
                    >
                        <Plus className="w-4 h-4" strokeWidth={2.2} />
                        <span className="hidden sm:inline">Inscribir a alguien</span>
                        <span className="sm:hidden">Inscribir</span>
                    </button>
                )}
            </div>

            {roster.length === 0 ? (
                <p className="text-[14.5px] font-medium text-black/50 dark:text-white/50 py-6 text-center">
                    Todavía no hay miembros aprobados en el grupo.
                </p>
            ) : (
                <>
                    <div className="grid gap-x-5 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
                        {visibles.map((m, i) => (
                            <div key={m.id} className="flex items-center gap-3.5 py-[11px] px-1">
                                <div className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-[14.5px] font-semibold ${i === 0
                                    ? 'bg-[#0a0a0a] dark:bg-white text-white dark:text-black'
                                    : `${T.chip} text-black/60 dark:text-white/60`}`}>
                                    {getInitials(m.name)}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[15px] font-semibold truncate">{m.name}</p>
                                    <p className="text-[13px] font-medium text-black/45 dark:text-white/45 truncate">
                                        {m.isPartner ? 'Inscripción compartida' : miembroDesde(m.desde)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                    {roster.length > 8 && (
                        <button
                            type="button"
                            onClick={() => setVerTodos(v => !v)}
                            className="w-full h-[52px] mt-2 text-[14.5px] font-semibold text-black/45 dark:text-white/45 transition-colors hover:text-black dark:hover:text-white"
                        >
                            {verTodos ? 'Ver menos' : `Ver los ${roster.length} miembros`}
                        </button>
                    )}
                </>
            )}
        </>
    );

    const Descripcion = group.description ? (
        <div className="mt-5 px-1">
            <p className={`text-[14.5px] leading-[1.6] font-medium text-black/55 dark:text-white/55 ${descripcionExpandida ? '' : 'line-clamp-3'}`}>
                {group.description}
            </p>
            {group.description.length > 160 && (
                <button
                    type="button"
                    onClick={() => setDescripcionExpandida(v => !v)}
                    className="mt-1.5 text-[13.5px] font-semibold text-black/45 dark:text-white/45 hover:text-black dark:hover:text-white transition-colors"
                >
                    {descripcionExpandida ? 'Ver menos' : 'Ver más'}
                </button>
            )}
        </div>
    ) : null;

    const AvisoRechazo = isRejected && (group as any).adminNote ? (
        <div className={`${T.tarjeta} rounded-[26px] p-5`}>
            <p className={rotulo}>Motivo del rechazo</p>
            <p className="mt-2 text-[14.5px] leading-[1.6] font-medium text-black/70 dark:text-white/70">
                {(group as any).adminNote}
            </p>
        </div>
    ) : null;

    return (
        <div className={`min-h-screen ${T.fondo} ${T.fuente} ${T.tinta}`}>

            {/* Uno solo para los dos armados: móvil y escritorio dibujan cada
                uno su <Foto>, pero las dos apuntan a este mismo input. */}
            <input
                ref={inputPortadaRef}
                type="file"
                accept="image/*"
                onChange={handlePortadaElegida}
                className="hidden"
                tabIndex={-1}
                aria-hidden="true"
            />

            {/* ═══ MOBILE ═══ Barra fija abajo + lista en dos grupos */}
            <div className="lg:hidden pb-[120px]">
                <div className="relative mx-3.5 mt-3.5">
                    <Foto alto="h-[196px]" radio="rounded-[26px]" />
                    <button
                        type="button"
                        onClick={() => navigate('/mis-grupos')}
                        aria-label="Volver a Mis Grupos"
                        className="absolute top-3.5 left-3.5 w-10 h-10 rounded-full bg-white/[.92] flex items-center justify-center"
                    >
                        <ArrowLeft className="w-[18px] h-[18px] text-black" strokeWidth={2.2} />
                    </button>
                    <div className="absolute top-3.5 right-3.5">{PildoraEstado}</div>
                </div>

                <div className="px-5 pt-5">
                    <h1 className="text-[25px] leading-[1.2] font-semibold tracking-[-.02em]">{group.name}</h1>
                    <p className="mt-1.5 text-[13.5px] font-medium text-black/50 dark:text-white/50">{anfitriones}</p>

                    <div className="flex flex-wrap gap-2 mt-3.5">
                        <Chip>{group.meetingDay} {group.meetingTime}</Chip>
                        <Chip>{group.isOnline ? 'Online' : (group.location || 'Sin ubicación')}</Chip>
                        <Chip>{approved} de {maxCap}{libres === 0 ? ' · Completo' : ''}</Chip>
                    </div>

                    {Descripcion}

                    {AvisoRechazo && <div className="mt-5">{AvisoRechazo}</div>}

                    {FilaSolicitudes && <div className="mt-6">{FilaSolicitudes}</div>}

                    {ListaMiembros && <div className="mt-6">{ListaMiembros}</div>}
                    {ListaAdmin}

                    <div className={`${T.tarjeta} rounded-[26px] p-5 mt-6`}>{Miembros}</div>
                </div>

                {/* La asistencia se saca del flujo: siempre alcanzable con el
                    pulgar, incluso parado en la reunión y con la lista scrolleada. */}
                <div className="fixed left-0 right-0 bottom-0 px-4 pt-3.5 pb-5 bg-gradient-to-t from-[#f6f6f4] from-[62%] to-transparent dark:from-[#111110]">
                    <div className="shadow-[0_6px_22px_rgba(0,0,0,.18)] rounded-full">{BotonAsistencia}</div>
                </div>
            </div>

            {/* ═══ DESKTOP ═══ Dos columnas, acciones en barra lateral fija */}
            <div className="hidden lg:block px-8 pt-7 pb-[72px]">
                <div className="max-w-[1160px] mx-auto">

                    <div className="flex items-center gap-3.5 mb-[22px]">
                        <button
                            type="button"
                            onClick={() => navigate('/mis-grupos')}
                            aria-label="Volver a Mis Grupos"
                            className="w-11 h-11 rounded-full bg-white dark:bg-[#1b1b1a] shadow-[0_1px_3px_rgba(0,0,0,.06)] flex items-center justify-center transition-transform hover:-translate-x-0.5"
                        >
                            <ArrowLeft className="w-[19px] h-[19px]" strokeWidth={2.2} />
                        </button>
                        <span className="text-[14.5px] font-medium text-black/50 dark:text-white/50">Grupos</span>
                        <span className="text-[14.5px] font-medium text-black/28 dark:text-white/28">/</span>
                        <span className="text-[14.5px] font-semibold truncate">{group.name}</span>
                    </div>

                    <div className="grid gap-7 items-start [grid-template-columns:minmax(0,1.55fr)_minmax(0,1fr)]">

                        <div className="flex flex-col gap-5 min-w-0">
                            <div className={`${T.tarjeta} rounded-[30px] p-4`}>
                                <div className="relative">
                                    <Foto alto="h-[280px]" radio="rounded-[22px]" />
                                    <div className="absolute top-4 left-4">{PildoraEstado}</div>
                                </div>
                                <div className="px-3.5 pt-[22px] pb-2">
                                    <div className="flex items-start justify-between gap-5 flex-wrap">
                                        <div className="min-w-0">
                                            <h1 className="text-[34px] leading-[1.15] font-semibold tracking-[-.025em]">{group.name}</h1>
                                            <p className="mt-2.5 text-[15px] font-medium text-black/50 dark:text-white/50">{anfitriones}</p>
                                        </div>
                                        <div className={`h-9 px-[15px] rounded-full ${T.chip} flex items-center text-[13px] font-semibold text-black/60 dark:text-white/60 whitespace-nowrap`}>
                                            {approved} de {maxCap} · {libres === 0 ? 'Cupo completo' : `${libres} ${libres === 1 ? 'lugar' : 'lugares'}`}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2.5 mt-5">
                                        <Chip>
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                                <rect x="3.5" y="5" width="17" height="16" rx="3" /><path d="M8 3v3M16 3v3M3.5 10h17" />
                                            </svg>
                                            {group.meetingDay} · {group.meetingTime} hs
                                        </Chip>
                                        <Chip>
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z" /><circle cx="12" cy="10" r="2.4" />
                                            </svg>
                                            {group.isOnline ? 'Online' : (group.location || 'Sin ubicación')}
                                        </Chip>
                                        <Chip>{group.isOnline ? 'Virtual' : 'Presencial'}</Chip>
                                    </div>
                                    {Descripcion}
                                </div>
                            </div>

                            {AvisoRechazo}

                            <div className={`${T.tarjeta} rounded-[30px] px-7 pt-[26px] pb-5`}>{Miembros}</div>
                        </div>

                        <div className="sticky top-7 flex flex-col gap-4 min-w-0">
                            <div className={`${T.tarjeta} rounded-[30px] p-[22px]`}>
                                {BotonAsistencia}
                                {proxima && (
                                    <p className="mt-3 mx-1 text-[13.5px] leading-[1.5] font-medium text-black/45 dark:text-white/45 first-letter:uppercase">
                                        {proxima}
                                    </p>
                                )}
                                {FilaSolicitudes && <div className="mt-[18px]">{FilaSolicitudes}</div>}
                            </div>

                            <div className={`${T.tarjeta} rounded-[30px] p-[22px]`}>
                                {ListaMiembros}
                                {ListaAdmin}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Modales ── */}
            <NeoModal
                isOpen={isSuccessModalOpen}
                onClose={() => setIsSuccessModalOpen(false)}
                maxWidth="max-w-md"
                variant="soft"
            >
                <div className={`${T.fuente} flex flex-col items-center text-center pb-2`}>
                    <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mb-5">
                        <Check className="w-7 h-7" />
                    </div>
                    <p className="text-[21px] font-semibold tracking-[-.01em]">
                        {successModalMessage.includes('creado') ? 'Grupo creado' : 'Solicitud enviada'}
                    </p>
                    <p className="mt-2.5 text-[14.5px] leading-[1.6] font-medium text-black/55 dark:text-white/55">
                        {successModalMessage}
                    </p>
                    <button onClick={() => setIsSuccessModalOpen(false)} className={`${btnPrimario} mt-6`}>
                        Entendido
                    </button>
                </div>
            </NeoModal>

            {/* QR y enlace — color según categoría del grupo */}
            <NeoModal
                isOpen={isQrModalOpen}
                onClose={() => setIsQrModalOpen(false)}
                maxWidth="max-w-sm"
                variant="soft"
            >
                <div className={`${T.fuente} flex flex-col items-center text-center pb-2`}>
                    <p className="text-[19px] font-semibold tracking-[-.01em] px-2">{group.name}</p>
                    <p className="mt-1.5 text-[13.5px] font-medium text-black/45 dark:text-white/45">
                        Escaneando este código se anotan al grupo.
                    </p>

                    <AnimatePresence>
                        {isQrModalOpen && (
                            <motion.div
                                initial={{ scale: 0.85, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                                className="p-4 rounded-[24px] my-5"
                                style={{ backgroundColor: `${categoryColor}14` }}
                            >
                                <div className="p-4 bg-white rounded-[18px]">
                                    <QRCodeSVG
                                        value={buildGroupShareUrl(group.id)}
                                        size={200}
                                        fgColor="#0a0a0a"
                                        bgColor="#FFFFFF"
                                        level="M"
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button onClick={handleCopyGroupLink} className={btnPrimario}>
                        {copiedLink
                            ? <><Check className="w-[18px] h-[18px]" /> Copiado</>
                            : <><Link className="w-[18px] h-[18px]" /> Copiar enlace</>}
                    </button>

                    <button onClick={handleShareWhatsapp} className={`${btnSecundario} w-full mt-2.5`}>
                        <span className="relative inline-flex items-center justify-center w-[18px] h-[18px] shrink-0">
                            <WhatsAppLogo className="w-[18px] h-[18px]" />
                            <ArrowRight className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 text-white bg-[#25D366] rounded-full" strokeWidth={3} />
                        </span>
                        Compartir por WhatsApp
                    </button>
                </div>
            </NeoModal>
        </div>
    );
};

export default DetalleGrupoAnfitrion;
