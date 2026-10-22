import React, { useState } from 'react';
import { dondeSeReune } from '../../src/utils/modalidad';
import { CalendarPlus } from 'lucide-react';
import { Group, GroupTag, GroupCategory, User as AppUser, UserRole } from '../../types';
import { hasRole } from '../../services/authUtils';
import { descargarICS } from '../../src/utils/calendario';
import ModalCompartirQR from '../modals/ModalCompartirQR';

/**
 * Tarjeta de un grupo — design-claude/GCX - Tarjetas y pagina.dc.html.
 *
 * La usan la cartelera /gcx y el carrusel "Grupos para vos" del Home y de
 * /novedades. Lo que decide el botón y el estado (fechas en hora argentina,
 * género, edad, cupo, bloqueo manual, inscripción) es el mismo de antes: el
 * rediseño cambió cómo se ve y los textos, no las condiciones.
 *
 * Los colores salen de las variables de .gcx-m (index.html), que se invierten
 * solas en oscuro.
 */

interface GroupCardProps {
    group: Group;
    tags: GroupTag[];
    categories?: GroupCategory[];
    onJoin: (g: Group) => void;
    onInquiry: (g: Group) => void;
    spanTwo?: boolean;
    userStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
    currentUser?: AppUser | null;
    id?: string;
    /** Posición en la grilla: escalona la entrada (60 ms por tarjeta, hasta 8). */
    orden?: number;
}

/**
 * La edad de un grupo dicha para una persona, después de "para":
 * "personas de 18 a 35 años", "mayores de 30 años", "personas de hasta 25 años".
 * 99 o más es "sin tope", como lo carga el formulario.
 */
export const paraQuienEsLaEdad = (min?: number, max?: number): string => {
    const desde = min && min > 0 ? min : 0;
    const sinTope = !max || max >= 99;
    if (desde && sinTope) return `mayores de ${desde} años`;
    if (!desde && !sinTope) return `personas de hasta ${max} años`;
    return `personas de ${desde} a ${max} años`;
};

/** La misma edad como etiqueta: "18 a 35 años", "Mayores de 30", "Hasta 25 años". */
const etiquetaDeEdad = (min?: number, max?: number): string => {
    const desde = min && min > 0 ? min : 0;
    const sinTope = !max || max >= 99;
    if (desde && sinTope) return `Mayores de ${desde}`;
    if (!desde && !sinTope) return `Hasta ${max} años`;
    return `${desde} a ${max} años`;
};

// Los fondos de la portada sin foto, del .dc. En oscuro van todos a #262624.
const TONOS = ['#e6ddd3', '#d9dde6', '#e4dccf', '#dfe3da', '#d6d9dc', '#e2ded8', '#ece4d6', '#e5dde3'];
const tonoDe = (id: string) => {
    let h = 0;
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return TONOS[h % TONOS.length];
};

const iniciales = (nombre: string) =>
    nombre.split(/\s+/).filter(w => w && w.toLowerCase() !== 'y').map(w => w[0]).join('').slice(0, 2).toUpperCase();

// ── Íconos del .dc (trazo 2, redondeado) ───────────────────────────────
const Svg: React.FC<{ tam?: number; grosor?: number; children: React.ReactNode }> = ({ tam = 16, grosor = 2, children }) => (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={grosor}
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>{children}</svg>
);
const Reloj = ({ tam = 16, grosor = 2 }) => <Svg tam={tam} grosor={grosor}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>;
const Candado = ({ tam = 16, grosor = 2.2 }) => <Svg tam={tam} grosor={grosor}><rect x="5" y="10.5" width="14" height="10" rx="3" /><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" /></Svg>;
const Tilde = ({ tam = 16 }) => <Svg tam={tam} grosor={2.6}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;

type Boton = {
    texto: string;
    fondo: string;
    tinta: string;
    icono?: 'candado' | 'reloj' | 'tilde';
    flecha?: boolean;
    disabled: boolean;
    /** La línea de abajo cuando está bloqueado: por qué. */
    porque?: string;
};

const GroupCard: React.FC<GroupCardProps> = ({ group, tags, categories, onJoin, onInquiry, userStatus, currentUser, id, orden = 0 }) => {
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [isTagsExpanded, setIsTagsExpanded] = useState(false);
    const [compartiendo, setCompartiendo] = useState(false);

    // Link para compartir el grupo.
    //
    // Va con `#` porque la app monta un HashRouter: toda la ruta vive en el
    // fragmento. Y apunta a /gcx?groupId=... porque esa pantalla ya sabe
    // recibir ese parametro — busca la tarjeta, la centra y la resalta—, asi
    // que quien abra el link cae directo en este grupo y no en la grilla.
    const enlaceDelGrupo = typeof window !== 'undefined'
        ? `${window.location.origin}/#/gcx?groupId=${group.id}`
        : '';

    // --- BUSINESS LOGIC (unchanged) ---

    const isGenderCompatible = (): boolean => {
        const targetGender = group.targetGender?.toLowerCase() || '';
        const userGender = currentUser?.gender?.toLowerCase() || '';
        const isMixto = !targetGender ||
            targetGender.includes('mixto') ||
            targetGender.includes('no especificar') ||
            targetGender === '';
        if (isMixto) return true;
        if (!userGender) return true;
        const isMaleGroup = targetGender.includes('hombre');
        const isFemaleGroup = targetGender.includes('mujer');
        const isUserMale = userGender.includes('hombre') || userGender.includes('masculino');
        const isUserFemale = userGender.includes('mujer') || userGender.includes('femenino');
        if (isMaleGroup && isUserMale) return true;
        if (isFemaleGroup && isUserFemale) return true;
        return false;
    };

    const genderCompatible = isGenderCompatible();

    // Age compatibility check
    const isAgeCompatible = (): boolean => {
        if (!currentUser?.age) return true;
        const minAge = group.minAge || 0;
        const maxAge = group.maxAge || 100;
        if (currentUser.age < minAge) return false;
        if (currentUser.age > maxAge) return false;
        return true;
    };
    const ageCompatible = isAgeCompatible();

    const parseLocalDate = (dateStr: string) => {
        if (!dateStr) return new Date();
        const parts = dateStr.split('-');
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    };

    const getArgentinaDate = () => {
        const now = new Date();
        const argentinaOffset = -3 * 60;
        const localOffset = now.getTimezoneOffset();
        const diff = argentinaOffset - localOffset;
        return new Date(now.getTime() + diff * 60 * 1000);
    };

    const now = getArgentinaDate();
    now.setHours(0, 0, 0, 0);

    const startDate = group.startDate ? parseLocalDate(group.startDate) : null;
    const endDate = group.endDate ? parseLocalDate(group.endDate) : null;

    const isStarted = startDate ? now >= startDate : false;
    const isFinished = endDate ? now > endDate : false;
    const isFull = group.membersCount >= group.maxCapacity;
    const isCapacityLocked = !!group.capacityLocked;
    const isHiddenGroup = !!group.isHidden;
    const canSeeHidden = hasRole(currentUser || null, [
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN_GROUPS,
        UserRole.ENCARGADO_GRUPOS,
    ]);

    let status: 'AVAILABLE' | 'FULL' | 'IN_PROGRESS' | 'FINISHED' = 'AVAILABLE';
    if (isFinished) status = 'FINISHED';
    else if (isStarted) status = 'IN_PROGRESS';
    else if (isCapacityLocked) status = 'FULL';
    else if (isFull) status = 'FULL';

    const handleAction = () => {
        if (status === 'FINISHED') return;
        if (isCapacityLocked) return; // Bloqueo manual: no lleva a ningún modal
        if (!genderCompatible) return;
        if (!ageCompatible) return;
        if (userStatus === 'PENDING' || userStatus === 'APPROVED') return;
        if (status === 'AVAILABLE') onJoin(group);
        else onInquiry(group);
    };

    const hasCoHost = group.coHostFirstName && group.coHostFirstName.trim().length > 0;

    const getGenderLockText = () => {
        const tg = group.targetGender;
        if (tg === 'Hombre') return 'Solo para hombres';
        if (tg === 'Mujer') return 'Solo para mujeres';
        return 'No disponible';
    };

    const getGenderLockReason = () => {
        const tg = group.targetGender;
        if (tg === 'Hombre') return 'Este grupo es solo para hombres';
        if (tg === 'Mujer') return 'Este grupo es solo para mujeres';
        return undefined;
    };

    // Las ramas y su orden son las de siempre; cambian los textos y colores
    // (los del diseño) y se suma la línea del "por qué" en los bloqueados.
    const getButtonState = (): Boton => {
        const apagado = { fondo: 'var(--g-chip)', tinta: 'var(--g-m38)' };
        const bloqueado = { fondo: 'var(--g-chip)', tinta: 'var(--g-m50)' };
        const unirme: Boton = { texto: 'Unirme', fondo: 'var(--g-ink)', tinta: 'var(--g-inv)', flecha: true, disabled: false };
        const lleno: Boton = { texto: 'Lleno', ...apagado, icono: 'candado', disabled: true, porque: 'No quedan lugares en este grupo' };

        if (status === 'FINISHED') {
            return { texto: 'Finalizado', ...apagado, disabled: true, porque: 'Este grupo terminó su temporada' };
        }
        if (isCapacityLocked) return lleno;

        // Sin sesión: el mismo "Unirme" de siempre, que lleva al login.
        if (!currentUser) {
            if (isFull) return lleno;
            return unirme;
        }
        if (!genderCompatible) {
            return { texto: getGenderLockText(), ...bloqueado, icono: 'candado', disabled: true, porque: getGenderLockReason() };
        }
        if (!ageCompatible) {
            return {
                texto: 'Fuera de tu rango de edad', ...bloqueado, icono: 'candado', disabled: true,
                porque: `Este grupo es para ${paraQuienEsLaEdad(group.minAge, group.maxAge)}`,
            };
        }
        if (userStatus === 'PENDING') {
            return { texto: 'Solicitud enviada', fondo: 'var(--g-chip)', tinta: 'var(--g-m62)', icono: 'reloj', disabled: true };
        }
        if (userStatus === 'APPROVED') {
            return { texto: 'Sos miembro', fondo: 'var(--g-grnBg)', tinta: 'var(--g-grn)', icono: 'tilde', disabled: true };
        }
        if (status === 'AVAILABLE') return unirme;
        // Mismo look que "Unirme" (cosmético): esta rama sigue
        // ejecutando onInquiry en handleAction, no onJoin — no se
        // tocó la lógica de negocio, solo texto/color del botón.
        return unirme;
    };

    const btnState = getButtonState();

    const shouldTruncate = !!(group.description && group.description.length > 100);

    const handleDescriptionToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDescriptionExpanded(!isDescriptionExpanded);
    };

    // --- FECHA DE INICIO ---
    const monthNames = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const badgeMonth = startDate ? monthNames[startDate.getMonth()] : null;
    const badgeDay = startDate ? String(startDate.getDate()).padStart(2, '0') : null;
    const fechaLarga = startDate
        ? startDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';
    const yaEmpezo = status === 'IN_PROGRESS' || status === 'FINISHED';

    // --- ESTADO ---
    const ESTADOS = {
        AVAILABLE: { label: 'Abierto', color: 'var(--g-grn)', latido: true },
        FULL: { label: 'Lleno', color: 'var(--g-m62)', latido: false },
        IN_PROGRESS: { label: 'En curso', color: 'var(--g-ink)', latido: false },
        FINISHED: { label: 'Finalizado', color: 'var(--g-m62)', latido: false },
    } as const;
    const statusBadge = ESTADOS[status];

    // Resolve tags for this group
    const resolvedTags = tags && group.tags && group.tags.length > 0
        ? tags.filter(tag => group.tags?.includes(tag.id))
        : [];
    const hasAgeRange = !!((group.minAge && group.minAge > 0) || (group.maxAge && group.maxAge < 100));
    // La edad va primera, como en el diseño.
    const etiquetas = [
        ...(hasAgeRange ? [{ id: '__edad', name: etiquetaDeEdad(group.minAge, group.maxAge) }] : []),
        ...resolvedTags.map(t => ({ id: t.id, name: t.name })),
    ];
    const etiquetasAVista = isTagsExpanded ? etiquetas : etiquetas.slice(0, 3);
    const etiquetasDeMas = etiquetas.length - 3;

    // Resolve category name
    const categoryName = categories && group.categoryId
        ? categories.find(cat => cat.id === group.categoryId)?.name || group.categoryId
        : group.categoryId;

    // --- ANFITRIONES ---
    const titular = `${group.leaderName || ''} ${group.leaderSurname || ''}`.trim();
    const coAnfitrion = hasCoHost ? `${group.coHostFirstName || ''} ${group.coHostLastName || ''}`.trim() : '';
    const anfitriones = [titular, coAnfitrion].filter(Boolean);
    const nombreAnfitriones = anfitriones.length > 1
        ? anfitriones.map(n => n.split(/\s+/)[0]).join(' y ')
        : anfitriones[0] || '';
    const COLORES_AVATAR = ['var(--g-av1)', 'var(--g-av2)', 'var(--g-av3)'];

    const donde = dondeSeReune(group);
    const cuando = [group.meetingDay, group.meetingTime ? `${group.meetingTime} hs` : ''].filter(Boolean).join(' · ');
    const descId = `gcx-desc-${group.id}`;
    const porqueId = `gcx-porque-${group.id}`;

    const pastilla = 'h-[30px] px-3 rounded-full inline-flex items-center gap-[7px] text-[13px] font-semibold whitespace-nowrap';
    const vidrio: React.CSSProperties = { background: 'var(--g-glass)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' };

    return (
        <article
            id={id}
            className={`gcx-m gcx-tarjeta rounded-[28px] p-2 flex flex-col ${isHiddenGroup && canSeeHidden ? 'grayscale opacity-60' : ''}`}
            style={{ animationDelay: `${Math.min(orden, 8) * 60}ms` }}
        >
            {/* ── PORTADA ── */}
            <div
                className="relative aspect-[4/3] rounded-[20px] overflow-hidden bg-[var(--tono)] dark:bg-[#262624]"
                style={{ ['--tono' as string]: tonoDe(group.id) }}
            >
                {group.imageUrl ? (
                    <img
                        src={group.imageUrl}
                        alt={`Foto del grupo ${group.name}`}
                        loading="lazy"
                        className="gcx-foto absolute inset-0 w-full h-full object-cover"
                    />
                ) : (
                    <div
                        aria-hidden="true"
                        className="gcx-foto absolute inset-0 flex items-center justify-center"
                        style={{ backgroundImage: 'radial-gradient(var(--g-dots) 1.2px, transparent 1.4px)', backgroundSize: '16px 16px' }}
                    >
                        <span className="text-[64px] font-bold tracking-[-.04em]" style={{ color: 'var(--g-m38)' }}>
                            {(group.name || '').split(/\s+/).filter(w => w.length > 2).slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                        </span>
                    </div>
                )}

                <div className="absolute top-3 left-3 right-3 flex justify-between gap-2 items-start">
                    <div className="flex flex-wrap gap-1.5 min-w-0">
                        <span className={pastilla} style={{ ...vidrio, color: statusBadge.color }}>
                            {statusBadge.latido && (
                                <span className="gcx-latido w-[7px] h-[7px] rounded-full flex-none" style={{ background: 'var(--g-grn)' }} />
                            )}
                            <span>{statusBadge.label}</span>
                        </span>
                        {isCapacityLocked && status !== 'FULL' && status !== 'FINISHED' && (
                            <span className={pastilla} style={{ ...vidrio, color: 'var(--g-m62)' }}>
                                <Candado tam={13} />
                                <span>Lleno</span>
                            </span>
                        )}
                        {isHiddenGroup && canSeeHidden && (
                            <span className={pastilla} style={{ ...vidrio, color: 'var(--g-m62)' }}>
                                <Svg tam={13}><path d="M3 3l18 18M10.6 6a9.7 9.7 0 011.4-.1c6 0 9.5 6.1 9.5 6.1a17 17 0 01-2.7 3.4M6.4 6.9C3.9 8.6 2.5 12 2.5 12s3.5 6.5 9.5 6.5a9 9 0 004.3-1.1M9.9 9.9a3 3 0 004.2 4.2" /></Svg>
                                <span>Oculto</span>
                            </span>
                        )}
                    </div>
                    {categoryName && (
                        <span className={`${pastilla} flex-none`} style={{ ...vidrio, color: 'var(--g-ink)' }}>
                            {categoryName}
                        </span>
                    )}
                </div>
            </div>

            {/* ── CUERPO ── */}
            <div className="px-3 pb-3 flex flex-col flex-1">
                {startDate && (
                    <div className="relative -mt-[26px] flex items-end gap-3">
                        <div
                            aria-label={`${yaEmpezo ? 'Empezó' : 'Empieza'} el ${fechaLarga}`}
                            role="img"
                            className="w-14 h-[60px] flex-none rounded-2xl flex flex-col items-center justify-center"
                            style={{ background: 'var(--g-card)', boxShadow: '0 2px 10px rgba(0,0,0,.12)' }}
                        >
                            <span className="text-[22px] leading-none font-bold tracking-[-.03em]">{badgeDay}</span>
                            <span className="mt-[3px] text-[11px] font-bold tracking-[.07em]" style={{ color: 'var(--g-m50)' }}>{badgeMonth}</span>
                        </div>
                        <span aria-hidden="true" className="pb-1 text-[12px] font-semibold tracking-[.07em]" style={{ color: 'var(--g-m38)' }}>
                            {yaEmpezo ? 'EMPEZÓ' : 'EMPIEZA'}
                        </span>
                    </div>
                )}

                <h3 className={`${startDate ? 'mt-3.5' : 'mt-[18px]'} mb-0 text-[19px] leading-[1.25] font-semibold tracking-[-.02em] line-clamp-2 [text-wrap:pretty]`}>
                    {group.name}
                </h3>

                <div className="mt-3 flex flex-col gap-[7px] text-[14.5px] font-medium" style={{ color: 'var(--g-m62)' }}>
                    {cuando && (
                        <div className="flex items-center gap-[9px]"><Reloj /><span>{cuando}</span></div>
                    )}
                    {donde && (
                        <div className="flex items-center gap-[9px] min-w-0">
                            {group.isHybrid ? (
                                <Svg><path d="M4 11l8-6.5 8 6.5M6.5 9.5V19h11V9.5" /><path d="M10 14.5h4" /></Svg>
                            ) : group.isOnline ? (
                                <Svg><rect x="3" y="6.5" width="12.5" height="11" rx="3" /><path d="M15.5 10.5l5-3v9l-5-3" /></Svg>
                            ) : (
                                <Svg><path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></Svg>
                            )}
                            <span className="truncate">{donde}</span>
                        </div>
                    )}
                </div>

                {/* Descripción: tres renglones y "Ver más". max-height y no
                    grid-template-rows: en iOS/Safari animar las filas de la
                    grilla recalcula todo el layout por cuadro y se nota. */}
                {group.description && (
                    <div className="mt-3.5">
                        <p
                            id={descId}
                            className="m-0 text-[15px] leading-[1.5] overflow-hidden [text-wrap:pretty] [contain:layout]"
                            style={{
                                color: 'var(--g-m62)',
                                maxHeight: !shouldTruncate || isDescriptionExpanded ? '40em' : '4.5em',
                                transition: 'max-height .4s cubic-bezier(.3,.7,.3,1)',
                            }}
                        >
                            {group.description}
                        </p>
                        {shouldTruncate && (
                            <button
                                type="button"
                                onClick={handleDescriptionToggle}
                                aria-expanded={isDescriptionExpanded}
                                aria-controls={descId}
                                className="-ml-2.5 -mt-1 -mb-2.5 h-11 px-2.5 border-0 bg-transparent text-[14.5px] font-semibold cursor-pointer underline underline-offset-[3px] decoration-[var(--g-line)]"
                                style={{ color: 'var(--g-ink)' }}
                            >
                                {isDescriptionExpanded ? 'Ver menos' : 'Ver más'}
                            </button>
                        )}
                    </div>
                )}

                {etiquetas.length > 0 && (
                    <div className="mt-3.5 flex flex-wrap gap-1.5 items-center">
                        {etiquetasAVista.map((t, i) => (
                            <span
                                key={t.id}
                                className="h-8 px-3 rounded-full inline-flex items-center text-[13px] font-semibold whitespace-nowrap"
                                style={{
                                    background: 'var(--g-chip)', color: 'var(--g-m62)',
                                    animation: i >= 3 ? 'gcxIn .3s ease both' : undefined,
                                }}
                            >
                                {t.name}
                            </span>
                        ))}
                        {etiquetasDeMas > 0 && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setIsTagsExpanded(!isTagsExpanded); }}
                                aria-expanded={isTagsExpanded}
                                aria-label={isTagsExpanded ? 'Ver menos etiquetas' : `Ver ${etiquetasDeMas} etiquetas más`}
                                className="h-11 min-w-[44px] -my-1.5 p-0 border-0 bg-transparent cursor-pointer inline-flex items-center justify-center"
                            >
                                <span
                                    className="h-8 px-3 rounded-full inline-flex items-center text-[13px] font-bold"
                                    style={{ border: '1.5px solid var(--g-line)', color: 'var(--g-ink)' }}
                                >
                                    {isTagsExpanded ? 'Menos' : `+${etiquetasDeMas}`}
                                </span>
                            </button>
                        )}
                    </div>
                )}

                {/* mt-auto: en el carrusel las tarjetas se estiran al alto de
                    la más larga y esto deja el anfitrión y el botón abajo. En
                    la grilla no hay espacio sobrante y no mueve nada. */}
                <div className="mt-auto">
                    {anfitriones.length > 0 && (
                        <div className="mt-[18px] flex items-center gap-2.5">
                            <div className="flex flex-none" aria-hidden="true">
                                {anfitriones.map((n, j) => (
                                    <span
                                        key={j}
                                        className="w-9 h-9 rounded-full flex items-center justify-center text-[12.5px] font-bold"
                                        style={{
                                            background: COLORES_AVATAR[(orden + j) % 3],
                                            color: 'var(--g-ink)',
                                            border: '2px solid var(--g-card)',
                                            marginLeft: j ? -10 : 0,
                                        }}
                                    >
                                        {iniciales(n)}
                                    </span>
                                ))}
                            </div>
                            <div className="min-w-0 flex flex-col">
                                <span className="text-[12.5px] font-medium" style={{ color: 'var(--g-m50)' }}>
                                    {anfitriones.length > 1 ? 'Anfitriones' : 'Anfitrión'}
                                </span>
                                <span className="text-[14.5px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
                                    {nombreAnfitriones}
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="mt-[18px] flex gap-2">
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setCompartiendo(true); }}
                            aria-label={`Compartir ${group.name}`}
                            title="Compartir este grupo"
                            className="gcx-hover-chip w-[52px] h-[52px] flex-none rounded-full border-0 flex items-center justify-center cursor-pointer active:scale-[.96]"
                            style={{ background: 'var(--g-chip)', color: 'var(--g-ink)' }}
                        >
                            <Svg tam={19}><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" /><path d="M5 13v4.5A2.5 2.5 0 007.5 20h9a2.5 2.5 0 002.5-2.5V13" /></Svg>
                        </button>
                        <button
                            type="button"
                            onClick={handleAction}
                            disabled={btnState.disabled}
                            aria-describedby={btnState.porque ? porqueId : undefined}
                            className={`flex-1 min-w-0 h-[52px] px-[18px] rounded-full border-0 flex items-center justify-center gap-2 text-[15px] font-semibold whitespace-nowrap overflow-hidden ${btnState.disabled ? 'cursor-default' : 'gcx-hover-tinta cursor-pointer active:scale-[.98]'}`}
                            style={{ background: btnState.fondo, color: btnState.tinta }}
                        >
                            {btnState.icono === 'candado' && <Candado />}
                            {btnState.icono === 'reloj' && <Reloj grosor={2.2} />}
                            {btnState.icono === 'tilde' && <Tilde />}
                            <span className="overflow-hidden text-ellipsis">{btnState.texto}</span>
                            {btnState.flecha && <Svg tam={17} grosor={2.2}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>}
                        </button>
                    </div>
                    {btnState.porque && (
                        <p id={porqueId} className="mt-2.5 mb-0 text-center text-[13px] font-medium" style={{ color: 'var(--g-m50)' }}>
                            {btnState.porque}
                        </p>
                    )}

                    {/* No está en el diseño pero es una función que ya existía:
                        quien es miembro baja el grupo a su calendario. */}
                    {userStatus === 'APPROVED' && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                const ok = descargarICS({
                                    nombre: group.name,
                                    meetingDay: group.meetingDay,
                                    meetingTime: group.meetingTime,
                                    startDate: group.startDate,
                                    endDate: group.endDate,
                                    location: group.location,
                                    isOnline: group.isOnline,
                                    isHybrid: group.isHybrid,
                                    descripcion: group.description,
                                });
                                if (!ok) alert('No pudimos generar el archivo — falta el día o el horario del grupo.');
                            }}
                            className="gcx-hover-chip mt-2 w-full h-11 rounded-full border-0 text-[14px] font-semibold flex items-center justify-center gap-2 cursor-pointer"
                            style={{ background: 'var(--g-chip)', color: 'var(--g-ink)' }}
                        >
                            <CalendarPlus className="w-4 h-4" />
                            Agregar al calendario
                        </button>
                    )}
                </div>
            </div>

            <ModalCompartirQR
                isOpen={compartiendo}
                onClose={() => setCompartiendo(false)}
                title={group.name}
                subtitle={[cuando, donde].filter(Boolean).join(' · ') || undefined}
                link={enlaceDelGrupo}
            />
        </article>
    );
};

export default GroupCard;
