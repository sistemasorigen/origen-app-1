import React, { useState } from 'react';
import { Clock, MapPin, Users, ArrowRight, CheckCircle2, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { Group, GroupTag, User as AppUser, UserRole } from '../../types';
import { hasRole } from '../../services/authUtils';

interface GroupCardProps {
    group: Group;
    tags: GroupTag[];
    onJoin: (g: Group) => void;
    onInquiry: (g: Group) => void;
    spanTwo?: boolean;
    userStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
    currentUser?: AppUser | null;
}

const GroupCard: React.FC<GroupCardProps> = ({ group, tags, onJoin, onInquiry, userStatus, currentUser }) => {
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

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

    let status: 'AVAILABLE' | 'FULL' | 'IN_PROGRESS' | 'FINISHED' = 'AVAILABLE';
    if (isFinished) status = 'FINISHED';
    else if (isStarted) status = 'IN_PROGRESS';
    else if (isFull) status = 'FULL';

    const handleAction = () => {
        if (status === 'FINISHED') return;
        if (!genderCompatible) return;
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
        if (!genderCompatible) {
            return { text: getGenderLockText(), baseClass: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed', icon: <Lock className="w-3.5 h-3.5" />, disabled: true };
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
        return { text: 'VER INFO', baseClass: 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 hover:border-[#28a946] hover:text-[#28a946]', icon: <ArrowRight className="w-3.5 h-3.5" />, disabled: false };
    };

    const btnState = getButtonState();

    const shouldTruncate = group.description && group.description.length > 100;
    const truncatedDescription = shouldTruncate && !isDescriptionExpanded
        ? group.description.slice(0, 100) + '...'
        : group.description;

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

    return (
        <div
            className="group/card relative bg-white dark:bg-neutral-900 rounded-lg shadow-xl shadow-black/5 dark:shadow-black/30 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl cursor-pointer flex flex-col"
            onClick={handleAction}
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
                <div className="absolute top-3 left-3">
                    <span className={`${statusBadge.className} text-[11px] font-bold px-3 py-1.5 rounded-full tracking-wider flex items-center gap-1.5 shadow-lg`}>
                        {statusBadge.pulse && (
                            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        )}
                        {statusBadge.label}
                    </span>
                </div>

                {/* Date Badge — top right */}
                {badgeMonth && badgeDay && (
                    <div className="absolute top-3 right-3 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md px-3 py-2 rounded-lg shadow-lg flex flex-col items-center min-w-[54px]">
                        <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 leading-none">{badgeMonth}</span>
                        <span className="text-xl font-extrabold text-neutral-800 dark:text-white leading-tight">{badgeDay}</span>
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
                </div>

                {/* Tags / Chips */}
                {(resolvedTags.length > 0 || ((group.minAge && group.minAge > 0) || (group.maxAge && group.maxAge < 100))) && (
                    <div className="flex flex-wrap gap-2">
                        {resolvedTags.map((tag) => (
                            <span
                                key={tag.id}
                                className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-3 py-1.5 rounded-md text-xs font-semibold"
                            >
                                {tag.name}
                            </span>
                        ))}
                        {((group.minAge && group.minAge > 0) || (group.maxAge && group.maxAge < 100)) && (
                            <span className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-3 py-1.5 rounded-md text-xs font-semibold">
                                {group.minAge || 0}–{group.maxAge || 99} años
                            </span>
                        )}
                    </div>
                )}

                {/* Description */}
                {group.description && (
                    <div className="space-y-1.5 flex-1">
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                            {truncatedDescription}
                        </p>
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
                    </div>
                )}
            </div>

            {/* ── FOOTER ── */}
            <div className="px-5 py-4 bg-neutral-50/80 dark:bg-neutral-800/50 border-t border-neutral-100 dark:border-neutral-700/60 flex items-center justify-between gap-3">
                {/* Organizer */}
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-[#28a946]/10 dark:bg-[#28a946]/20 flex items-center justify-center rounded-lg border border-[#28a946]/20 shrink-0">
                        <span className="text-[#28a946] font-bold text-sm">
                            {group.leaderName.charAt(0)}{group.leaderSurname.charAt(0)}
                        </span>
                    </div>
                    <div className="min-w-0">
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-widest leading-none block">
                            Organiza
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

                {/* CTA Button */}
                <button
                    disabled={btnState.disabled}
                    className={`shrink-0 px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${btnState.baseClass}`}
                >
                    {btnState.text}
                    {btnState.icon}
                </button>
            </div>
        </div>
    );
};

export default GroupCard;

