import React, { useState } from 'react';
import { Clock, MapPin, Users, ArrowRight, CheckCircle2, Lock, ChevronDown, ChevronUp, Link, Check, EyeOff } from 'lucide-react';
import { Group, GroupTag, GroupCategory, User as AppUser, UserRole } from '../../types';
import { hasRole } from '../../services/authUtils';


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
}

const GroupCard: React.FC<GroupCardProps> = ({ group, tags, categories, onJoin, onInquiry, userStatus, currentUser, id }) => {
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [isTagsExpanded, setIsTagsExpanded] = useState(false);

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
        if (tg === 'Hombre') return 'SOLO HOMBRES';
        if (tg === 'Mujer') return 'SOLO MUJERES';
        return 'NO DISPONIBLE';
    };

    const getButtonState = () => {
        if (status === 'FINISHED') {
            return { text: 'FINALIZADO', baseClass: 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed', icon: null, disabled: true };
        }
        if (isCapacityLocked) {
            return { text: 'LLENO', baseClass: 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 cursor-not-allowed', icon: <Lock className="w-3.5 h-3.5" />, disabled: true };
        }

        // Sin sesión: mostrar botón invitación igual de verde para atraer al click
        if (!currentUser) {
            if (isFull) {
                return { text: 'LLENO', baseClass: 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 cursor-not-allowed', icon: <Lock className="w-3.5 h-3.5" />, disabled: true };
            }
            return {
                text: 'UNIRME',
                baseClass: 'bg-[#28a946] hover:bg-[#1f8a39] text-white shadow-lg shadow-[#28a946]/20 active:scale-95',
                icon: <ArrowRight className="w-3.5 h-3.5" />,
                disabled: false
            };
        }
        if (!genderCompatible) {
            return { text: getGenderLockText(), baseClass: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed', icon: <Lock className="w-3.5 h-3.5" />, disabled: true };
        }
        if (!ageCompatible) {
            return { text: 'UNIRME', baseClass: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed', icon: <Lock className="w-3.5 h-3.5" />, disabled: true };
        }
        if (userStatus === 'PENDING') {
            return { text: 'EN PROCESO', baseClass: 'bg-neutral-300 dark:bg-neutral-600 text-white cursor-not-allowed', icon: null, disabled: true };
        }
        if (userStatus === 'APPROVED') {
            return { text: 'MIEMBRO', baseClass: 'bg-[#28a946] text-white cursor-default', icon: <CheckCircle2 className="w-3.5 h-3.5" />, disabled: true };
        }
        if (status === 'AVAILABLE') {
            return { text: 'UNIRME', baseClass: 'bg-[#28a946] hover:bg-[#1f8a39] text-white shadow-lg shadow-[#28a946]/20 active:scale-95', icon: <ArrowRight className="w-3.5 h-3.5" />, disabled: false };
        }
        // Mismo look que "UNIRME" (cosmético): esta rama sigue
        // ejecutando onInquiry en handleAction, no onJoin — no se
        // tocó la lógica de negocio, solo texto/color del botón.
        return { text: 'UNIRME', baseClass: 'bg-[#28a946] hover:bg-[#1f8a39] text-white shadow-lg shadow-[#28a946]/20 active:scale-95', icon: <ArrowRight className="w-3.5 h-3.5" />, disabled: false };
    };

    const btnState = getButtonState();

    const shouldTruncate = !!(group.description && group.description.length > 100);

    const handleDescriptionToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDescriptionExpanded(!isDescriptionExpanded);
    };

    // --- DATE FORMATTING FOR BADGE ---
    const monthNames = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const badgeMonth = startDate ? monthNames[startDate.getMonth()] : null;
    const badgeDay = startDate ? startDate.getDate() : null;

    // --- STATUS BADGE ---
    const getStatusBadge = () => {
        switch (status) {
            case 'AVAILABLE':
                return { label: 'ABIERTO', className: 'bg-[#28a946] text-white', pulse: true };
            case 'FULL':
                return { label: 'LLENO', className: 'bg-neutral-800 text-white', pulse: false };
            case 'IN_PROGRESS':
                return { label: 'EN CURSO', className: 'bg-amber-500 text-white', pulse: true };
            case 'FINISHED':
                return { label: 'FINALIZADO', className: 'bg-neutral-500 text-white', pulse: false };
        }
    };
    const statusBadge = getStatusBadge();

    // Resolve tags for this group
    const resolvedTags = tags && group.tags && group.tags.length > 0
        ? tags.filter(tag => group.tags?.includes(tag.id))
        : [];
    const hasAgeRange = !!((group.minAge && group.minAge > 0) || (group.maxAge && group.maxAge < 100));
    const hasTagsSection = resolvedTags.length > 0 || hasAgeRange;

    // Resolve category name
    const categoryName = categories && group.categoryId
        ? categories.find(cat => cat.id === group.categoryId)?.name || group.categoryId
        : group.categoryId;


    return (
        <div
            id={id}
            className={`group/card relative bg-white dark:bg-neutral-900 rounded-lg shadow-xl shadow-black/5 dark:shadow-black/30 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl flex flex-col ${isHiddenGroup && canSeeHidden ? 'grayscale opacity-60' : ''}`}
        >
            {/* ── HERO IMAGE ── */}
            <div className="relative h-56 overflow-hidden">
                {group.imageUrl ? (
                    <img
                        src={group.imageUrl}
                        alt={group.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-105"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-800">
                        <Users className="w-14 h-14 text-neutral-300 dark:text-neutral-600" />
                    </div>
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />

                {/* Status Badge — top left */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className={`${statusBadge.className} text-[11px] font-bold px-3 py-1.5 rounded-full tracking-wider flex items-center gap-1.5 shadow-lg`}>
                        {statusBadge.pulse && (
                            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        )}
                        {statusBadge.label}
                    </span>
                    {isCapacityLocked && status !== 'FULL' && status !== 'FINISHED' && (
                        <span className="bg-neutral-800 text-white text-[11px] font-bold px-3 py-1.5 rounded-full tracking-wider shadow-lg flex items-center gap-1.5">
                            <Lock className="w-3 h-3" />
                            LLENO
                        </span>
                    )}
                    {isHiddenGroup && canSeeHidden && (
                        <span className="bg-neutral-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-full tracking-wider shadow-lg flex items-center gap-1.5">
                            <EyeOff className="w-3 h-3" />
                            OCULTO
                        </span>
                    )}
                </div>

                {/* Category Badge — top right */}
                {categoryName && (
                    <div className="absolute top-3 right-3">
                        <span className="bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md text-neutral-800 dark:text-white text-[11px] font-bold px-3 py-1.5 rounded-full tracking-wider shadow-lg inline-block">
                            {categoryName}
                        </span>
                    </div>
                )}
            </div>

            {/* ── CONTENT ── */}
            <div className="p-5 space-y-4 flex-1 flex flex-col">
                {/* Title */}
                <div className="space-y-2.5">
                    <h3 className="text-xl font-extrabold text-neutral-800 dark:text-white leading-tight uppercase tracking-tight">
                        {group.name}
                    </h3>

                    {/* Logistics: time + location */}
                    <div className="flex items-center gap-5">
                        <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
                            <Clock className="w-4 h-4 text-[#28a946]" />
                            <span className="text-sm font-medium">{group.meetingDay} {group.meetingTime} HS</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
                            <MapPin className="w-4 h-4 text-[#28a946]" />
                            <span className="text-sm font-medium truncate max-w-[160px]">{group.location}</span>
                        </div>
                    </div>

                    {/* Start Date - Below Day/Time */}
                    {group.startDate && (
                        <div className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">
                            Inicio: {new Date(group.startDate + 'T00:00:00').toLocaleDateString('es-AR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                            })}
                        </div>
                    )}
                </div>

                {/* Description */}
                {group.description && (
                    <div
                        className={`space-y-1.5 flex-1 ${shouldTruncate ? 'cursor-pointer select-none touch-manipulation' : ''}`}
                        onClick={shouldTruncate ? handleDescriptionToggle : undefined}
                        role={shouldTruncate ? 'button' : undefined}
                        tabIndex={shouldTruncate ? 0 : undefined}
                        aria-expanded={shouldTruncate ? isDescriptionExpanded : undefined}
                        onKeyDown={shouldTruncate ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsDescriptionExpanded(prev => !prev); } } : undefined}
                    >
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                            {shouldTruncate ? group.description.slice(0, 100) : group.description}
                            {shouldTruncate && !isDescriptionExpanded && '...'}
                        </p>

                        {/* Resto de la descripción — mismo efecto de desplazamiento que el panel de etiquetas.
                            NOTA: se usa max-height (no grid-template-rows) porque en iOS/Safari animar
                            grid-template-rows fuerza un recálculo de layout completo por frame y se
                            siente con lag; max-height es una ruta mucho mejor optimizada en WebKit.
                            [contain:layout] evita que ese recálculo se propague a las tarjetas vecinas
                            del grid. */}
                        {shouldTruncate && (
                            <div
                                className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out [contain:layout] ${isDescriptionExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}
                            >
                                <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                                    {group.description.slice(100)}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* "Ver más detalles" + toggle de etiquetas — misma línea, chevron pegado al borde derecho */}
                {(shouldTruncate || hasTagsSection) && (
                    <div>
                        <div className="flex items-center gap-3">
                            {shouldTruncate && (
                                <button
                                    onClick={handleDescriptionToggle}
                                    className="inline-flex items-center text-[#28a946] font-bold text-sm hover:underline"
                                >
                                    {isDescriptionExpanded ? (
                                        <>Ver menos <ChevronUp className="w-4 h-4 ml-0.5" /></>
                                    ) : (
                                        <>Ver más detalles <ArrowRight className="w-4 h-4 ml-0.5 transition-transform group-hover/card:translate-x-0.5" /></>
                                    )}
                                </button>
                            )}
                            {hasTagsSection && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsTagsExpanded(!isTagsExpanded);
                                    }}
                                    className="ml-auto shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-neutral-500 dark:text-neutral-400 hover:text-[#28a946] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                                    aria-label={isTagsExpanded ? 'Ocultar etiquetas' : 'Mostrar etiquetas'}
                                    aria-expanded={isTagsExpanded}
                                >
                                    <ChevronDown
                                        className={`w-4 h-4 transition-transform duration-200 ${isTagsExpanded ? 'rotate-180' : ''}`}
                                    />
                                </button>
                            )}
                        </div>

                        {/* Panel de etiquetas — sin espacio reservado; se desliza hacia abajo solo al expandir.
                            Mismo motivo que la descripción: max-height en vez de grid-template-rows
                            para que no haya lag en iOS/Safari, con [contain:layout] para no afectar
                            al resto de las tarjetas del grid mientras anima. */}
                        {hasTagsSection && (
                            <div
                                className={`overflow-hidden transition-[max-height,opacity,margin-top] duration-300 ease-out [contain:layout] ${isTagsExpanded ? 'max-h-[600px] opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'}`}
                            >
                                <div className="flex flex-wrap gap-2 pb-0.5">
                                    {resolvedTags.map((tag) => (
                                        <span
                                            key={tag.id}
                                            className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-3 py-1.5 rounded-md text-xs font-semibold"
                                        >
                                            {tag.name}
                                        </span>
                                    ))}
                                    {hasAgeRange && (
                                        <span className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-3 py-1.5 rounded-md text-xs font-semibold">
                                            {group.minAge || 0}–{group.maxAge || 99} años
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── FOOTER ── */}
            <div className="px-5 py-4 bg-neutral-50/80 dark:bg-neutral-800/50 border-t border-neutral-100 dark:border-neutral-700/60 flex items-center justify-between gap-3">
                {/* Organizer */}
                <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-widest leading-none block">
                            Anfitrionado por
                        </span>
                        <span className="text-sm font-bold text-neutral-800 dark:text-white truncate block uppercase">
                            {group.leaderName} {group.leaderSurname}
                        </span>
                        {hasCoHost && (
                            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium truncate block">
                                + {group.coHostFirstName} {group.coHostLastName}
                            </span>
                        )}
                    </div>
                </div>

                {/* Acciones: botón CTA */}
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={handleAction}
                        disabled={btnState.disabled}
                        className={`shrink-0 px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed ${btnState.baseClass}`}
                    >
                        {btnState.text}
                        {btnState.icon}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GroupCard;

