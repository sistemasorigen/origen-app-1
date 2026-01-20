import React, { useState } from 'react';
import { Calendar, MapPin, Users, HeartHandshake, User, ArrowRight, CheckCircle2, Lock, ChevronDown, ChevronUp } from 'lucide-react';
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
    // State for description expansion
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

    // NOTE: RPC call removed temporarily due to Supabase API cache issue (404)
    // The status is now calculated in Groups.tsx using existing working RPCs
    // --- 1. UTILS & HELPERS ---

    // Gender Compatibility Check (Robust version)
    const isGenderCompatible = (): boolean => {
        const targetGender = group.targetGender?.toLowerCase() || '';
        const userGender = currentUser?.gender?.toLowerCase() || '';

        // Scenario C: If group is Mixto or not specified, everyone can join
        const isMixto = !targetGender ||
            targetGender.includes('mixto') ||
            targetGender.includes('no especificar') ||
            targetGender === '';
        if (isMixto) return true;

        // If user gender is unknown, allow as fallback (they can fill it in profile later)
        if (!userGender) return true;

        // Check if group is for men or women using includes() to handle plural/singular
        const isMaleGroup = targetGender.includes('hombre');
        const isFemaleGroup = targetGender.includes('mujer');

        // Normalize user gender: "masculino" = "hombre", "femenino" = "mujer"
        const isUserMale = userGender.includes('hombre') || userGender.includes('masculino');
        const isUserFemale = userGender.includes('mujer') || userGender.includes('femenino');

        // Scenario A & B: Match user gender to group target
        if (isMaleGroup && isUserMale) return true;
        if (isFemaleGroup && isUserFemale) return true;

        // Mismatch - blocked
        return false;
    };

    const genderCompatible = isGenderCompatible();

    // Helper to parse local date (YYYY-MM-DD)
    const parseLocalDate = (dateStr: string) => {
        if (!dateStr) return new Date();
        const parts = dateStr.split('-');
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    };

    const getArgentinaDate = () => {
        const now = new Date();
        const argentinaOffset = -3 * 60; // UTC-3
        const localOffset = now.getTimezoneOffset();
        const diff = argentinaOffset - localOffset;
        return new Date(now.getTime() + diff * 60 * 1000);
    };

    // Calculate Status
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

    // Format Start Date (DD/MM)
    const formattedStartDate = startDate
        ? `${startDate.getDate().toString().padStart(2, '0')}/${(startDate.getMonth() + 1).toString().padStart(2, '0')}`
        : 'Próx.';

    // Format End Date (DD/MM)
    const formattedEndDate = endDate
        ? `${endDate.getDate().toString().padStart(2, '0')}/${(endDate.getMonth() + 1).toString().padStart(2, '0')}`
        : null;

    // Action Handler
    const handleAction = () => {
        // Prevent action if finished
        if (status === 'FINISHED') return;
        // Prevent action if gender incompatible
        if (!genderCompatible) return;
        // Prevent action if pending or approved
        if (userStatus === 'PENDING' || userStatus === 'APPROVED') return;

        if (status === 'AVAILABLE') onJoin(group);
        else onInquiry(group);
    };

    // Co-host text
    const hasCoHost = group.coHostFirstName && group.coHostFirstName.trim().length > 0;

    // Helper to get gender display text for lock button
    const getGenderLockText = () => {
        const tg = group.targetGender;
        if (tg === 'Hombre') return 'SOLO HOMBRES';
        if (tg === 'Mujer') return 'SOLO MUJERES';
        return 'NO DISPONIBLE';
    };

    // Button State Logic
    const getButtonState = () => {
        if (status === 'FINISHED') {
            return {
                text: 'FINALIZADO',
                baseClass: 'bg-neutral-300 text-neutral-500 cursor-not-allowed border-none',
                icon: null,
                disabled: true
            };
        }

        // HIGHEST PRIORITY: Gender Compatibility Check
        if (!genderCompatible) {
            return {
                text: getGenderLockText(),
                baseClass: 'bg-gray-200 text-gray-500 cursor-not-allowed',
                icon: <Lock className="w-3 h-3" />,
                disabled: true
            };
        }

        if (userStatus === 'PENDING') {
            return {
                text: 'EN PROCESO',
                baseClass: 'bg-gray-400 text-white cursor-not-allowed',
                icon: null,
                disabled: true
            };
        }
        if (userStatus === 'APPROVED') {
            return {
                text: 'MIEMBRO',
                baseClass: 'bg-green-600 text-white cursor-default',
                icon: <CheckCircle2 className="w-3 h-3" />,
                disabled: true
            };
        }

        // Default available state
        if (status === 'AVAILABLE') {
            return {
                text: 'UNIRME',
                baseClass: 'bg-[#118f46] text-white border-2 border-[#118f46] hover:bg-black hover:border-black transition-all',
                icon: <ArrowRight className="w-3 h-3" />,
                disabled: false
            };
        }

        // Full or In Progress
        return {
            text: 'VER INFO',
            baseClass: 'bg-white text-black border-2 border-black hover:bg-black hover:text-white',
            icon: <ArrowRight className="w-3 h-3" />,
            disabled: false
        };
    };

    const btnState = getButtonState();

    // Description truncation - check if longer than ~100 chars
    const shouldTruncate = group.description && group.description.length > 100;
    const truncatedDescription = shouldTruncate && !isDescriptionExpanded
        ? group.description.slice(0, 100) + '...'
        : group.description;

    const handleDescriptionToggle = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click
        setIsDescriptionExpanded(!isDescriptionExpanded);
    };

    return (
        <div
            className="group relative bg-white border-2 border-black rounded-xl overflow-hidden flex flex-col md:flex-row hover:shadow-lg transition-all duration-300 cursor-pointer"
            onClick={handleAction}
        >
            {/* Image - Reduced 30% */}
            <div className="relative w-full h-44 md:w-52 md:h-[252px] shrink-0 overflow-hidden">
                {group.imageUrl ? (
                    <img
                        src={group.imageUrl}
                        alt={group.name}
                        className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-200">
                        <Users className="w-12 h-12 text-slate-400" />
                    </div>
                )}

                {/* Status Badge */}
                <span className={`
                    absolute bottom-2 left-2 px-2 py-1 text-[10px] font-bold uppercase tracking-wide rounded-lg
                    ${status === 'AVAILABLE' ? 'bg-[#118f46] text-white' :
                        status === 'FULL' ? 'bg-black text-white' :
                            status === 'FINISHED' ? 'bg-neutral-600 text-white' :
                                'bg-white text-black border-2 border-black'}
                `}>
                    {status === 'AVAILABLE' ? 'ABIERTO' :
                        status === 'FULL' ? 'LLENO' :
                            status === 'FINISHED' ? 'FINALIZADO' :
                                'EN CURSO'}
                </span>

                {/* Start/End Date Badges - Mobile top right */}
                <div className="md:hidden absolute top-2 right-2 flex flex-row items-center gap-1">
                    <span className="px-2 py-1.5 text-[10px] font-bold bg-white text-black border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        Inicia {formattedStartDate}
                    </span>
                    {formattedEndDate && (
                        <span className="px-2 py-1.5 text-[10px] font-bold bg-white text-black border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                            Fin: {formattedEndDate}
                        </span>
                    )}
                </div>
            </div>

            {/* Content - Reduced padding */}
            <div className="flex-1 p-4 md:p-5 flex flex-col justify-between min-w-0">
                {/* Top: Title + Start/End Date */}
                <div>
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 md:gap-3 mb-2">
                        <h3 className="font-bold text-lg md:text-xl leading-tight text-black uppercase tracking-tight">
                            {group.name}
                        </h3>
                        <div className="hidden md:flex flex-row items-center gap-2 shrink-0">
                            <span className="px-3 py-1.5 text-[10px] font-bold bg-white text-black border-2 border-black rounded-lg">
                                Inicia {formattedStartDate}
                            </span>
                            {formattedEndDate && (
                                <span className="px-3 py-1.5 text-[10px] font-bold bg-white text-black border-2 border-black rounded-lg">
                                    Fin: {formattedEndDate}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Age Requirements (if applicable) */}
                    {/* Age Requirements & Tags Combo Line */}
                    <div className="flex flex-wrap gap-2 mb-3">
                        {/* Age Badge */}
                        {((group.minAge && group.minAge > 0) || (group.maxAge && group.maxAge < 100)) && (
                            <span className="px-2 py-1 rounded-lg bg-white text-black border-2 border-black text-[10px] font-bold uppercase">
                                {group.minAge || 0} a {group.maxAge || 99} años
                            </span>
                        )}

                        {/* Tags */}
                        {tags && group.tags && group.tags.length > 0 && tags
                            .filter(tag => group.tags?.includes(tag.id))
                            .map((tag) => (
                                <span
                                    key={tag.id}
                                    style={{ backgroundColor: tag.color }}
                                    className="inline-flex items-center justify-center border-2 border-black rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-default"
                                >
                                    #{tag.name}
                                </span>
                            ))}
                    </div>
                </div>

                {/* Details: Day/Time + Location */}
                <div className="flex flex-wrap items-center gap-3 text-xs mb-3">
                    <div className="flex items-center gap-1.5 bg-white border-2 border-black px-2 py-1.5 rounded-lg">
                        <Calendar className="w-3 h-3 text-black" />
                        <span className="font-bold text-black">{group.meetingDay} {group.meetingTime}hs</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-black" />
                        <span className="font-medium text-black truncate max-w-[150px]">{group.location}</span>
                    </div>
                </div>

                {/* Description with "Ver más" */}
                {group.description && (
                    <div className="mb-3">
                        <p className="text-xs text-black/70 font-medium leading-relaxed">
                            {truncatedDescription}
                        </p>
                        {shouldTruncate && (
                            <button
                                onClick={handleDescriptionToggle}
                                className="mt-1 text-xs font-bold text-black/60 hover:text-black flex items-center gap-1 transition-colors"
                            >
                                {isDescriptionExpanded ? (
                                    <>Ver menos <ChevronUp className="w-3 h-3" /></>
                                ) : (
                                    <>Ver más <ChevronDown className="w-3 h-3" /></>
                                )}
                            </button>
                        )}
                    </div>
                )}



                {/* Bottom: Host + Button */}
                <div className="flex items-center justify-between gap-3 pt-3 border-t-2 border-black">
                    {/* Host */}
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center text-xs font-bold shrink-0 border-2 border-black">
                            {group.leaderName.charAt(0)}{group.leaderSurname.charAt(0)}
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-black truncate uppercase">
                                {group.leaderName} {group.leaderSurname}
                            </p>
                            {hasCoHost && (
                                <p className="text-[10px] text-black/60 font-medium truncate">
                                    + {group.coHostFirstName} {group.coHostLastName}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Action Button - Smaller */}
                    <button
                        disabled={btnState.disabled}
                        className={`
                            shrink-0 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 transition-all
                            ${btnState.baseClass}
                        `}
                    >
                        {btnState.icon}
                        {btnState.text}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GroupCard;

