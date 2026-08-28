import React, { useState, useEffect } from 'react';
import { supabaseService } from '../../services/supabaseService';
import { supabase } from '../../services/supabaseClient';
import { Group, User, SeasonSettings, DEFAULT_SEASON_SETTINGS } from '../../types';
import NeoModal from '../../components/ui/NeoModal';
import { ChevronLeft, ChevronRight, CalendarDays, Check, Loader2, MapPin, Clock, Users } from 'lucide-react';

interface CalendarioGCXProps {
    currentUser: User;
}

const DAY_MAP: Record<string, number> = {
    'Domingo': 0, 'Lunes': 1, 'Martes': 2,
    'Miércoles': 3, 'Jueves': 4, 'Viernes': 5, 'Sábado': 6
};

const DAY_LABELS_SHORT = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

// ── Tokens de Home.tsx ─────────────────────────────────
// Se declaran acá arriba porque se repiten en varios lugares y porque la
// intención es explícita: esta pantalla no tiene paleta propia, usa la del
// Home. Cualquier cambio de estilo global se hace en un solo lugar.
const CARD = 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm';
const EYEBROW = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold hover:bg-black dark:hover:bg-slate-200 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20 dark:focus-visible:ring-white/20';
const BTN_SOFT = 'inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 font-semibold hover:bg-slate-900 hover:text-white hover:border-slate-900 dark:hover:bg-white dark:hover:text-slate-900 transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20 dark:focus-visible:ring-white/20';

const getActiveSeasonRange = (
    settings: SeasonSettings
): { start: string; end: string; label: string } | null => {
    const year = settings.activeYear;
    for (const key of ['S1', 'S2', 'S3'] as const) {
        const s = settings.seasons[key];
        if (s.isOpen) {
            return { start: `${year}-${s.startDate}`, end: `${year}-${s.endDate}`, label: s.label };
        }
    }
    return null;
};

const filterBySeason = (
    groups: Group[],
    range: { start: string; end: string } | null
): Group[] => {
    if (!range) return groups;
    return groups.filter(g => {
        if (!g.startDate || !g.endDate) return false;
        return g.startDate <= range.end && g.endDate >= range.start;
    });
};

const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    d.setHours(0, 0, 0, 0);
    return d;
};

const getFirstOccurrence = (startDate: string, meetingDay: string): string => {
    const targetDow = DAY_MAP[meetingDay];
    if (targetDow === undefined || !startDate) return startDate;
    const d = new Date(startDate + 'T00:00:00');
    const diff = (targetDow - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
};

const buildGoogleCalUrl = (group: Group): string => {
    const start = getFirstOccurrence(group.startDate || '', group.meetingDay);
    const [h, m] = (group.meetingTime || '19:00').split(':');
    const hPad = h.padStart(2, '0');
    const mPad = m.padStart(2, '0');
    const dtStart = `${start.replace(/-/g, '')}T${hPad}${mPad}00`;
    const hEnd = String(parseInt(h) + 2).padStart(2, '0');
    const dtEnd = `${start.replace(/-/g, '')}T${hEnd}${mPad}00`;
    const until = group.endDate ? `${group.endDate.replace(/-/g, '')}T235959Z` : '';
    // recur se agrega manualmente sin URLSearchParams para que : y ; no queden
    // codificados como %3A/%3B — Google Calendar en mobile los interpreta en crudo.
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: `GCX - ${group.name}`,
        dates: `${dtStart}/${dtEnd}`,
        details: `Anfitrión: ${group.leaderName} ${group.leaderSurname}\nUbicación: ${group.location}\n${group.description || ''}`,
        location: group.location || '',
    });
    const recur = until ? `RRULE:FREQ=WEEKLY;UNTIL=${until}` : 'RRULE:FREQ=WEEKLY';
    return `https://calendar.google.com/calendar/render?${params}&recur=${recur}`;
};

const buildIcsContent = (group: Group): string => {
    const start = getFirstOccurrence(group.startDate || '', group.meetingDay).replace(/-/g, '');
    const time = (group.meetingTime || '19:00').replace(':', '');
    const hEnd = String(parseInt(time.slice(0, 2)) + 2).padStart(2, '0');
    return [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
        `DTSTART:${start}T${time}00`,
        `DTEND:${start}T${hEnd}${time.slice(2)}00`,
        group.endDate ? `RRULE:FREQ=WEEKLY;UNTIL=${group.endDate.replace(/-/g, '')}T235959Z` : 'RRULE:FREQ=WEEKLY',
        `SUMMARY:GCX - ${group.name}`,
        `DESCRIPTION:Anfitrión: ${group.leaderName} ${group.leaderSurname}`,
        `LOCATION:${group.location || ''}`,
        'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
};

const downloadIcs = (group: Group) => {
    const blob = new Blob([buildIcsContent(group)], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gcx-${group.name.toLowerCase().replace(/\s+/g, '-')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
};

const GoogleGSvg: React.FC = () => (
    <svg width="14" height="14" viewBox="0 0 533.5 544.3" className="shrink-0" aria-hidden="true">
        <path fill="currentColor" d="M533.5 278.4c0-18.5-1.5-37.1-4.7-55.3H272.1v104.8h147c-6.1 33.8-25.7 63.7-54.4 82.7v68h87.7c51.5-47.4 81.1-117.4 81.1-200.2z" />
        <path fill="currentColor" d="M272.1 544.3c73.4 0 135.3-24.1 180.4-65.7l-87.7-68c-24.4 16.6-55.9 26-92.6 26-71 0-131.2-47.9-152.8-112.3H28.9v70.1c46.2 91.9 140.3 149.9 243.2 149.9z" />
        <path fill="currentColor" d="M119.3 324.3c-11.4-33.8-11.4-70.4 0-104.2V150H28.9c-38.6 76.9-38.6 167.5 0 244.4l90.4-70.1z" />
        <path fill="currentColor" d="M272.1 107.7c38.8-.6 76.3 14 104.4 40.8l77.7-77.7C405 24.6 339.7-.8 272.1 0 169.2 0 75.1 58 28.9 150l90.4 70.1c21.5-64.5 81.8-112.4 152.8-112.4z" />
    </svg>
);

// ── WeekCalendar ───────────────────────────────────────
interface WeekCalendarProps {
    weekDays: Date[];
    mesLabel: string;
    groups: Group[];
    today: Date;
    onPrev: () => void;
    onNext: () => void;
    onDayClick: (date: Date, groups: Group[]) => void;
    getGroupsForDay: (date: Date, groups: Group[]) => Group[];
    accentColor: string;
}

// La tira de la semana es el objeto que da identidad a la pantalla, así que
// es el único lugar donde se gasta tinta: HOY va en relleno sólido
// slate-900/white — el mismo tratamiento que Home reserva para su botón
// primario y el punto activo del carrusel. El resto de las celdas quedan
// calladas y la lectura salta directo al día de hoy.
const WeekCalendar: React.FC<WeekCalendarProps> = ({
    weekDays, mesLabel, groups, today,
    onPrev, onNext, onDayClick, getGroupsForDay, accentColor,
}) => (
    <div className={`${CARD} overflow-hidden`}>
        {/* Cabecera con navegación */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800">
            <button
                type="button"
                onClick={onPrev}
                aria-label="Semana anterior"
                className="flex items-center justify-center w-11 h-11 shrink-0 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900 dark:focus-visible:ring-white"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>
            <p className={`${EYEBROW} first-letter:uppercase select-none`}>{mesLabel}</p>
            <button
                type="button"
                onClick={onNext}
                aria-label="Semana siguiente"
                className="flex items-center justify-center w-11 h-11 shrink-0 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900 dark:focus-visible:ring-white"
            >
                <ChevronRight className="w-5 h-5" />
            </button>
        </div>

        {/* Grilla de 7 días */}
        <div className="grid grid-cols-7 divide-x divide-slate-100 dark:divide-zinc-800">
            {weekDays.map((day, idx) => {
                const dayGroups = getGroupsForDay(day, groups);
                const isToday   = day.toDateString() === today.toDateString();
                const hasGroups = dayGroups.length > 0;
                const firstName = dayGroups[0]?.name ?? '';

                return (
                    <button
                        key={idx}
                        type="button"
                        onClick={() => onDayClick(day, dayGroups)}
                        aria-label={`${day.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}${hasGroups ? `, ${dayGroups.length} grupo${dayGroups.length > 1 ? 's' : ''}` : ''}`}
                        className={[
                            'relative flex flex-col items-center justify-start pt-2.5 pb-3 gap-1 min-h-[68px]',
                            'cursor-pointer transition-colors duration-150',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900 dark:focus-visible:ring-white',
                            isToday
                                ? 'bg-slate-900 dark:bg-white'
                                : hasGroups
                                    ? 'bg-slate-50 dark:bg-zinc-800/60 hover:bg-slate-100 dark:hover:bg-zinc-800'
                                    : 'hover:bg-slate-50 dark:hover:bg-zinc-800/60',
                        ].join(' ')}
                    >
                        {/* Etiqueta del día */}
                        <span className={`text-[10px] font-semibold uppercase tracking-[0.12em] leading-none ${isToday ? 'text-white/60 dark:text-slate-900/60' : 'text-slate-400 dark:text-zinc-500'}`}>
                            {DAY_LABELS_SHORT[idx]}
                        </span>

                        {/* Número del día */}
                        <span className={`text-sm font-bold tabular-nums leading-none ${isToday ? 'text-white dark:text-slate-900' : 'text-slate-900 dark:text-white'}`}>
                            {day.getDate()}
                        </span>

                        {/* Indicador de grupos — el color distingue anfitrión de
                            participante, así que dice algo verdadero y se queda. */}
                        {hasGroups ? (
                            <div className="flex flex-col items-center gap-0.5 w-full px-1">
                                {dayGroups.slice(0, 2).map((_, gi) => (
                                    <div
                                        key={gi}
                                        className="w-1.5 h-1.5 rounded-full"
                                        style={{ backgroundColor: isToday ? 'currentColor' : accentColor }}
                                    />
                                ))}
                                {dayGroups.length > 2 && (
                                    <span className={`text-[9px] font-semibold leading-none ${isToday ? 'text-white/60 dark:text-slate-900/60' : 'text-slate-400 dark:text-zinc-500'}`}>
                                        +{dayGroups.length - 2}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className="h-4" />
                        )}

                        {/* Nombre del primer grupo (solo desktop) */}
                        {hasGroups && firstName && (
                            <span className={`hidden md:block absolute bottom-0 left-0 right-0 text-center text-[9px] font-normal truncate px-0.5 pb-1 leading-none ${isToday ? 'text-white/50 dark:text-slate-900/50' : 'text-slate-400 dark:text-zinc-500'}`}>
                                {firstName.length > 8 ? firstName.slice(0, 7) + '…' : firstName}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    </div>
);

// ── Tarjeta de grupo en modal ──────────────────────────
const GroupCard: React.FC<{ group: Group; asHost: boolean }> = ({ group, asHost }) => (
    <div className={`${CARD} overflow-hidden`}>
        {/* Badge de rol — píldora al tono de Home, no una barra sólida */}
        <div className="px-4 pt-4">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full ${asHost
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400'
                }`}>
                <Users className="w-3 h-3 shrink-0" aria-hidden="true" />
                {asHost ? 'Anfitrión' : 'Participante'}
            </span>
        </div>

        {/* Contenido */}
        <div className="p-4 space-y-2.5">
            <p className="font-bold tracking-[-0.01em] text-slate-900 dark:text-white text-base leading-tight">{group.name}</p>

            <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-normal text-slate-500 dark:text-zinc-400">
                    <Users className="w-4 h-4 shrink-0 text-emerald-600" aria-hidden="true" />
                    <span className="font-semibold text-slate-700 dark:text-zinc-200">{group.leaderName} {group.leaderSurname}</span>
                </div>
                {group.meetingTime && (
                    <div className="flex items-center gap-2 text-sm font-normal text-slate-500 dark:text-zinc-400">
                        <Clock className="w-4 h-4 shrink-0 text-emerald-600" aria-hidden="true" />
                        <span>{group.meetingDay} · {group.meetingTime}</span>
                    </div>
                )}
                {group.location && (
                    <div className="flex items-center gap-2 text-sm font-normal text-slate-500 dark:text-zinc-400">
                        <MapPin className="w-4 h-4 shrink-0 text-emerald-600" aria-hidden="true" />
                        <span className="line-clamp-1">{group.location}</span>
                    </div>
                )}
                {group.description && (
                    <p className="text-sm font-normal text-slate-500 dark:text-zinc-400 leading-relaxed pt-2 border-t border-slate-100 dark:border-zinc-800">
                        {group.description}
                    </p>
                )}
            </div>
        </div>
    </div>
);

// ── Main ───────────────────────────────────────────────
const CalendarioGCXContent: React.FC<CalendarioGCXProps> = ({ currentUser }) => {
    const [weekStart, setWeekStart]                   = useState<Date>(getWeekStart(new Date()));
    const [hostGroups, setHostGroups]                 = useState<Group[]>([]);
    const [participantGroups, setParticipantGroups]   = useState<Group[]>([]);
    const [loading, setLoading]                       = useState(true);
    const [seasonLabel, setSeasonLabel]               = useState<string | null>(null);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    const [selectedDay, setSelectedDay]               = useState<Date | null>(null);
    const [selectedDayGroups, setSelectedDayGroups]   = useState<{ group: Group; asHost: boolean }[]>([]);

    const [showCalendarModal, setShowCalendarModal]   = useState(false);
    const [calendarModalType, setCalendarModalType]   = useState<'host' | 'participant'>('host');
    const [selectedGroupIds, setSelectedGroupIds]     = useState<Set<string>>(new Set());

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const cfg = await supabaseService.getAppConfig();
                const settings: SeasonSettings = cfg?.groupsConfig?.seasonSettings ?? DEFAULT_SEASON_SETTINGS;
                const range = getActiveSeasonRange(settings);
                setSeasonLabel(range?.label ?? null);

                const hosted = await supabaseService.getGroupsByHost(currentUser.id);
                setHostGroups(filterBySeason(hosted.filter(g => g.status === 'approved'), range));

                const regs = await supabaseService.getUserRegistrations(currentUser.id, currentUser.email);
                const approvedIds = regs
                    .filter(r => r.status === 'APPROVED')
                    .map(r => r.groupId)
                    .filter((id): id is string => !!id);

                if (approvedIds.length > 0) {
                    const { data } = await supabase
                        .from('groups')
                        .select('*, registrations:group_registrations(*)')
                        .in('id', approvedIds)
                        .eq('status', 'approved');
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const all = (data || []).map((row: any) => supabaseService._dbRowToGroup(row));
                    setParticipantGroups(filterBySeason(all, range));
                }
            } catch (err: unknown) {
                console.error('[CalendarioGCX]', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [currentUser.id, currentUser.email]);

    const getGroupsForDay = (date: Date, groups: Group[]): Group[] => {
        const dow = date.getDay();
        return groups.filter(g => {
            if (DAY_MAP[g.meetingDay] !== dow) return false;
            const start = g.startDate ? new Date(g.startDate + 'T00:00:00') : null;
            const end   = g.endDate   ? new Date(g.endDate   + 'T23:59:59') : null;
            if (start && date < start) return false;
            if (end   && date > end)   return false;
            return true;
        });
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
    });

    const mesLabel = weekStart.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

    const todayHostCount        = getGroupsForDay(today, hostGroups).length;
    const todayParticipantCount = getGroupsForDay(today, participantGroups).length;
    const todayCount            = todayHostCount + todayParticipantCount;

    const prevWeek = () => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() - 7);
        setWeekStart(d);
    };
    const nextWeek = () => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + 7);
        setWeekStart(d);
    };

    const openCalModal = (type: 'host' | 'participant') => {
        const groups = type === 'host' ? hostGroups : participantGroups;
        setCalendarModalType(type);
        setSelectedGroupIds(new Set(groups.map(g => g.id)));
        setShowCalendarModal(true);
    };

    const toggleGroup = (id: string) => {
        setSelectedGroupIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const activeGroups = calendarModalType === 'host' ? hostGroups : participantGroups;
    const noGroups = hostGroups.length === 0 && participantGroups.length === 0;

    const todayStr = today.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
            <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-8">

                {/* ── HEADER ──────────────────────────────── */}
                <div className="space-y-4">
                    {/* Título + fecha */}
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-tight leading-[1.05] text-slate-900 dark:text-white">
                                Mi calendario
                            </h1>
                            <p className="text-sm font-normal text-slate-500 dark:text-zinc-400 mt-1 first-letter:uppercase">{todayStr}</p>
                        </div>

                        {/* Badge de temporada */}
                        {seasonLabel && (
                            <span className="shrink-0 inline-flex items-center text-[11px] font-semibold px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                                {seasonLabel}
                            </span>
                        )}
                    </div>

                    {/* Cuántas reuniones hay hoy + exportar.
                        El número va en Black tabular — es el único 900 de la
                        pantalla, igual que el contador del Home. */}
                    <div className={`${CARD} flex items-center justify-between gap-3 p-4`}>
                        <div className="flex items-center gap-4">
                            <div className="text-center">
                                <p className="text-2xl font-black tabular-nums tracking-[-0.03em] leading-none text-slate-900 dark:text-white">{todayCount}</p>
                                <p className={`${EYEBROW} leading-none mt-1.5`}>hoy</p>
                            </div>
                            {todayCount > 0 && (
                                <div className="text-sm font-normal text-slate-500 dark:text-zinc-400 leading-snug">
                                    {todayHostCount > 0 && (
                                        <p>{todayHostCount} como anfitrión</p>
                                    )}
                                    {todayParticipantCount > 0 && (
                                        <p>{todayParticipantCount} como participante</p>
                                    )}
                                </div>
                            )}
                            {todayCount === 0 && (
                                <p className="text-sm font-normal text-slate-500 dark:text-zinc-400">Sin reuniones hoy</p>
                            )}
                        </div>

                        {/* Botones exportar */}
                        {!noGroups && (
                            <div className="flex items-center gap-2 shrink-0">
                                {hostGroups.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => openCalModal('host')}
                                        aria-label="Agregar grupos de anfitrión al calendario"
                                        className={`${BTN_SOFT} px-3 min-h-[44px] text-xs cursor-pointer`}
                                    >
                                        <GoogleGSvg />
                                        <span className="hidden sm:inline">Anfitrión</span>
                                    </button>
                                )}
                                {participantGroups.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => openCalModal('participant')}
                                        aria-label="Agregar grupos de participante al calendario"
                                        className={`${BTN_SOFT} px-3 min-h-[44px] text-xs cursor-pointer`}
                                    >
                                        <GoogleGSvg />
                                        <span className="hidden sm:inline">Participante</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── CALENDARIOS ─────────────────────────── */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="w-7 h-7 animate-spin text-slate-300 dark:text-zinc-600" aria-hidden="true" />
                        <p className={EYEBROW}>Cargando grupos…</p>
                    </div>
                ) : noGroups ? (
                    /* ── ESTADO VACÍO ── */
                    <div className="text-center py-16 px-4">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CalendarDays className="w-10 h-10 text-slate-400 dark:text-zinc-500" aria-hidden="true" />
                        </div>
                        <h2 className="text-lg font-bold uppercase tracking-tight text-slate-900 dark:text-white mb-2">
                            Todavía no hay nada acá
                        </h2>
                        <p className="text-sm font-normal text-slate-500 dark:text-zinc-400 mb-6 max-w-sm mx-auto">
                            Cuando te sumes a un grupo de conexión, sus reuniones aparecen en esta semana.
                        </p>
                        <a href="#/gcx" className={`${BTN_PRIMARY} px-5 py-3 text-sm cursor-pointer`}>
                            Buscar un grupo
                            <ChevronRight className="w-4 h-4" />
                        </a>
                    </div>
                ) : (
                    <div className="space-y-10">
                        {/* Anfitrión */}
                        {hostGroups.length > 0 && (
                            <section aria-label="Calendario de anfitrión">
                                <div className="flex items-center gap-3 mb-4">
                                    <h2 className="text-lg sm:text-xl font-bold uppercase tracking-tight leading-[1.05] text-slate-900 dark:text-white">
                                        Como anfitrión
                                    </h2>
                                    <span className="flex-1 border-t border-slate-200 dark:border-zinc-800" />
                                    <span className={EYEBROW}>{hostGroups.length} grupo{hostGroups.length !== 1 ? 's' : ''}</span>
                                </div>
                                <WeekCalendar
                                    weekDays={weekDays}
                                    mesLabel={mesLabel}
                                    groups={hostGroups}
                                    today={today}
                                    onPrev={prevWeek}
                                    onNext={nextWeek}
                                    onDayClick={(date, groups) => {
                                        setSelectedDay(date);
                                        setSelectedDayGroups(groups.map(g => ({ group: g, asHost: true })));
                                    }}
                                    getGroupsForDay={getGroupsForDay}
                                    accentColor="#059669"
                                />
                            </section>
                        )}

                        {/* Participante */}
                        {participantGroups.length > 0 && (
                            <section aria-label="Calendario de participante">
                                <div className="flex items-center gap-3 mb-4">
                                    <h2 className="text-lg sm:text-xl font-bold uppercase tracking-tight leading-[1.05] text-slate-900 dark:text-white">
                                        Como participante
                                    </h2>
                                    <span className="flex-1 border-t border-slate-200 dark:border-zinc-800" />
                                    <span className={EYEBROW}>{participantGroups.length} grupo{participantGroups.length !== 1 ? 's' : ''}</span>
                                </div>
                                <WeekCalendar
                                    weekDays={weekDays}
                                    mesLabel={mesLabel}
                                    groups={participantGroups}
                                    today={today}
                                    onPrev={prevWeek}
                                    onNext={nextWeek}
                                    onDayClick={(date, groups) => {
                                        setSelectedDay(date);
                                        setSelectedDayGroups(groups.map(g => ({ group: g, asHost: false })));
                                    }}
                                    getGroupsForDay={getGroupsForDay}
                                    accentColor="#6366f1"
                                />
                            </section>
                        )}
                    </div>
                )}

                {/* ── MODAL: DETALLE DEL DÍA ──────────────── */}
                <NeoModal
                    isOpen={!!selectedDay}
                    onClose={() => { setSelectedDay(null); setSelectedDayGroups([]); }}
                    title={selectedDay
                        ? selectedDay.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
                        : ''
                    }
                    maxWidth="max-w-lg"
                >
                    {selectedDayGroups.length === 0 ? (
                        <div className="py-10 text-center">
                            <CalendarDays className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto mb-2" aria-hidden="true" />
                            <p className="text-sm font-normal text-slate-500 dark:text-zinc-400">No hay reuniones este día.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {selectedDayGroups.map(({ group, asHost }) => (
                                <GroupCard key={group.id} group={group} asHost={asHost} />
                            ))}
                        </div>
                    )}
                </NeoModal>

                {/* ── MODAL: AGENDAR AL CALENDARIO ────────── */}
                <NeoModal
                    isOpen={showCalendarModal}
                    onClose={() => setShowCalendarModal(false)}
                    title={`Agendar al Calendario`}
                    maxWidth="max-w-lg"
                >
                    <div className="space-y-5">
                        {/* Subtítulo de tipo */}
                        <p className={EYEBROW}>
                            {calendarModalType === 'host' ? 'Grupos como anfitrión' : 'Grupos como participante'}
                        </p>

                        <p className="text-sm font-normal text-slate-500 dark:text-zinc-400 leading-relaxed">
                            Elegí los grupos que querés agregar como eventos semanales recurrentes.
                        </p>

                        {/* Lista de grupos */}
                        <div className="space-y-2 max-h-56 overflow-y-auto -mx-1 px-1">
                            {activeGroups.map(group => {
                                const selected = selectedGroupIds.has(group.id);
                                return (
                                    <button
                                        key={group.id}
                                        type="button"
                                        onClick={() => toggleGroup(group.id)}
                                        aria-pressed={selected}
                                        className={[
                                            'w-full flex items-center gap-3 px-4 py-3 min-h-[52px] rounded-xl border text-left transition-all duration-150 cursor-pointer',
                                            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20 dark:focus-visible:ring-white/20',
                                            selected
                                                ? 'bg-slate-900 dark:bg-white border-slate-900 dark:border-white'
                                                : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700',
                                        ].join(' ')}
                                    >
                                        {/* Checkbox visual */}
                                        <div className={`w-4 h-4 rounded shrink-0 flex items-center justify-center transition-colors ${selected ? 'bg-white dark:bg-slate-900' : 'border border-slate-300 dark:border-zinc-600'}`}>
                                            {selected && <Check className="w-3 h-3 text-slate-900 dark:text-white" aria-hidden="true" />}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <p className={`font-semibold text-sm truncate leading-snug ${selected ? 'text-white dark:text-slate-900' : 'text-slate-900 dark:text-white'}`}>{group.name}</p>
                                            <p className={`text-xs font-normal truncate leading-snug ${selected ? 'text-white/60 dark:text-slate-900/60' : 'text-slate-500 dark:text-zinc-400'}`}>
                                                {group.meetingDay}{group.meetingTime ? ` · ${group.meetingTime}` : ''}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Contador de seleccionados */}
                        {selectedGroupIds.size > 0 && (
                            <p className="text-xs font-normal text-slate-500 dark:text-zinc-400 text-center">
                                {selectedGroupIds.size} grupo{selectedGroupIds.size > 1 ? 's' : ''} seleccionado{selectedGroupIds.size > 1 ? 's' : ''}
                            </p>
                        )}

                        {/* Acciones */}
                        <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-zinc-800">
                            <p className={EYEBROW}>Agregar con</p>

                            {/* Google Calendar — conserva el azul de marca, que es
                                identidad del servicio, no decoración. */}
                            <div className="space-y-1.5">
                                <button
                                    type="button"
                                    disabled={selectedGroupIds.size === 0}
                                    onClick={() => {
                                        activeGroups
                                            .filter(g => selectedGroupIds.has(g.id))
                                            .forEach(g => window.open(buildGoogleCalUrl(g), '_blank'));
                                    }}
                                    className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-3 min-h-[52px] rounded-xl bg-[#4285F4] text-white text-sm font-semibold hover:bg-[#3367d6] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#4285F4]/30"
                                >
                                    <GoogleGSvg />
                                    Google Calendar
                                    {selectedGroupIds.size > 0 && <span className="opacity-70">({selectedGroupIds.size})</span>}
                                </button>
                                {isMobile && (
                                    <p className="text-xs font-normal text-slate-500 dark:text-zinc-400 text-center leading-snug px-2">
                                        En el teléfono activá <span className="font-semibold text-slate-700 dark:text-zinc-200">“Repetir → Semanal”</span> dentro del evento
                                    </p>
                                )}
                            </div>

                            {/* Apple Calendar / Outlook */}
                            <button
                                type="button"
                                disabled={selectedGroupIds.size === 0}
                                onClick={() => {
                                    activeGroups
                                        .filter(g => selectedGroupIds.has(g.id))
                                        .forEach(g => downloadIcs(g));
                                }}
                                className={`${BTN_SOFT} w-full px-4 py-3 min-h-[52px] text-sm cursor-pointer disabled:opacity-40 disabled:pointer-events-none`}
                            >
                                <CalendarDays className="w-4 h-4 shrink-0" aria-hidden="true" />
                                Apple Calendar / Outlook (.ics)
                                {selectedGroupIds.size > 0 && <span className="opacity-60">({selectedGroupIds.size})</span>}
                            </button>
                        </div>
                    </div>
                </NeoModal>
            </div>
        </div>
    );
};

export default CalendarioGCXContent;
