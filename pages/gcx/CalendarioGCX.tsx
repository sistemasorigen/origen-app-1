import React, { useState, useEffect } from 'react';
import { supabaseService } from '../../services/supabaseService';
import { supabase } from '../../services/supabaseClient';
import { Group, User, SeasonSettings, DEFAULT_SEASON_SETTINGS } from '../../types';
import NeoModal from '../../components/ui/NeoModal';
import { ChevronLeft, ChevronRight, CalendarDays, CalendarPlus, Check, Loader2, MapPin, Clock, Users } from 'lucide-react';

interface CalendarioGCXProps {
    currentUser: User;
}

const DAY_MAP: Record<string, number> = {
    'Domingo': 0, 'Lunes': 1, 'Martes': 2,
    'Miércoles': 3, 'Jueves': 4, 'Viernes': 5, 'Sábado': 6
};

const DAY_LABELS_SHORT = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

// ── Tokens de Home.tsx ─────────────────────────────────
// Esta pantalla no tiene paleta propia: usa la del Home. Los tokens se
// declaran acá para que la intención quede explícita y no queden dos versiones
// distintas de la misma tarjeta repartidas por el archivo.
//
// La estructura viene de un calendario de teléfono —tira de semana arriba,
// lista de reuniones abajo— pero el color, la tipografía y los radios salen
// del Home: slate para lo que se toca, emerald para lo que significa.
const CARD = 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm';
const EYEBROW = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400';
const H2 = 'text-lg sm:text-xl font-bold uppercase tracking-tight leading-[1.05] text-slate-900 dark:text-white';
const BODY = 'text-sm font-normal text-slate-500 dark:text-zinc-400';
const PILL = 'inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold hover:bg-black dark:hover:bg-slate-200 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20 dark:focus-visible:ring-white/20';
const BTN_SOFT = 'inline-flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 font-semibold hover:bg-slate-900 hover:text-white hover:border-slate-900 dark:hover:bg-white dark:hover:text-slate-900 transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20 dark:focus-visible:ring-white/20';
// Botón redondo de navegación — el mismo de las flechas del carrusel de
// grupos del Home.
const BTN_ICONO = 'w-9 h-9 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 dark:focus-visible:ring-white/30';

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

/**
 * Fecha de hoy en `YYYY-MM-DD`, en hora LOCAL.
 *
 * No usa `toISOString()` a propósito: eso devuelve UTC, y en Argentina
 * (UTC-3) a partir de las 21:00 ya informa el día siguiente. Un grupo que
 * termina hoy quedaría marcado como vencido tres horas antes de tiempo.
 * Mismo armado que usa supabaseService para su filtro FINALIZADOS.
 */
const hoyLocalISO = (): string => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

/**
 * ¿El grupo ya quedó fuera de temporada?
 *
 * Se pregunta antes de ofrecer el recordatorio. Agendar uno de estos crea en
 * Google/Apple un evento semanal con `UNTIL=` en el pasado: entra al
 * calendario y no suena nunca. Un recordatorio que no recuerda es peor que no
 * tenerlo, porque el anfitrión cree que lo tiene resuelto.
 *
 * Las dos primeras condiciones son las mismas que ya usa el resto de la app
 * (la insignia FINALIZADO del panel del anfitrión y el filtro FINALIZADOS del
 * servicio), y hacen falta LAS DOS, no una:
 *
 * - `finished` es lo que deja una re-apertura. Re-abrir no reescribe el grupo:
 *   crea uno nuevo con las fechas de la temporada nueva y marca al viejo. El
 *   nuevo pasa esta prueba sin problema y su recordatorio funciona, apenas el
 *   participante se inscriba y le aparezca en el calendario.
 * - La fecha cubre el caso en que ese marcado no llegó a grabarse
 *   (cloneGroupForNewSeason trata el fallo como no-fatal y sigue de largo) y
 *   también al grupo que simplemente terminó sin que nadie lo re-abriera.
 */
const estaFueraDeTemporada = (
    group: Group,
    range: { start: string; end: string } | null,
    hoy: string
): boolean => {
    if (group.status === 'finished') return true;
    if (group.endDate && group.endDate < hoy) return true;
    // Con una temporada abierta, además tiene que solaparla. Sin temporada
    // abierta no hay contra qué comparar y alcanza con que no haya terminado.
    if (range && group.startDate && group.endDate) {
        return !(group.startDate <= range.end && group.endDate >= range.start);
    }
    return false;
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
    <svg width="16" height="16" viewBox="0 0 533.5 544.3" className="shrink-0" aria-hidden="true">
        <path fill="currentColor" d="M533.5 278.4c0-18.5-1.5-37.1-4.7-55.3H272.1v104.8h147c-6.1 33.8-25.7 63.7-54.4 82.7v68h87.7c51.5-47.4 81.1-117.4 81.1-200.2z" />
        <path fill="currentColor" d="M272.1 544.3c73.4 0 135.3-24.1 180.4-65.7l-87.7-68c-24.4 16.6-55.9 26-92.6 26-71 0-131.2-47.9-152.8-112.3H28.9v70.1c46.2 91.9 140.3 149.9 243.2 149.9z" />
        <path fill="currentColor" d="M119.3 324.3c-11.4-33.8-11.4-70.4 0-104.2V150H28.9c-38.6 76.9-38.6 167.5 0 244.4l90.4-70.1z" />
        <path fill="currentColor" d="M272.1 107.7c38.8-.6 76.3 14 104.4 40.8l77.7-77.7C405 24.6 339.7-.8 272.1 0 169.2 0 75.1 58 28.9 150l90.4 70.1c21.5-64.5 81.8-112.4 152.8-112.4z" />
    </svg>
);

// ── Detalle de un grupo (modal) ────────────────────────
const GroupCard: React.FC<{ group: Group; asHost: boolean }> = ({ group, asHost }) => (
    <div className="space-y-4">
        <span className={`${PILL} ${asHost
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
            : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400'
            }`}>
            <Users className="w-3 h-3 shrink-0" aria-hidden="true" />
            {asHost ? 'Anfitrión' : 'Participante'}
        </span>

        <p className="text-lg font-bold tracking-[-0.01em] leading-tight text-slate-900 dark:text-white">
            {group.name}
        </p>

        <div className="space-y-1.5">
            <div className={`flex items-center gap-2 ${BODY}`}>
                <Users className="w-4 h-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <span className="font-semibold text-slate-700 dark:text-zinc-200">
                    {group.leaderName} {group.leaderSurname}
                </span>
            </div>
            {group.meetingTime && (
                <div className={`flex items-center gap-2 ${BODY}`}>
                    <Clock className="w-4 h-4 shrink-0 text-emerald-600" aria-hidden="true" />
                    <span>{group.meetingDay} · {group.meetingTime}</span>
                </div>
            )}
            {group.location && (
                <div className={`flex items-center gap-2 ${BODY}`}>
                    <MapPin className="w-4 h-4 shrink-0 text-emerald-600" aria-hidden="true" />
                    <span>{group.location}</span>
                </div>
            )}
        </div>

        {group.description && (
            <p className={`${BODY} leading-relaxed pt-4 border-t border-slate-100 dark:border-zinc-800`}>
                {group.description}
            </p>
        )}
    </div>
);

// ── Main ───────────────────────────────────────────────
const CalendarioGCXContent: React.FC<CalendarioGCXProps> = ({ currentUser }) => {
    const [weekStart, setWeekStart]                   = useState<Date>(getWeekStart(new Date()));
    const [hostGroups, setHostGroups]                 = useState<Group[]>([]);
    const [participantGroups, setParticipantGroups]   = useState<Group[]>([]);
    const [loading, setLoading]                       = useState(true);
    const [seasonLabel, setSeasonLabel]               = useState<string | null>(null);
    // El rango se guarda además del rótulo porque hace falta para decidir si un
    // grupo puede agendarse, no solo para el badge de la cabecera.
    const [seasonRange, setSeasonRange]               = useState<{ start: string; end: string } | null>(null);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // Día elegido en la tira. `null` = la lista muestra la semana entera, que
    // es como abre: lo que uno quiere saber al entrar es qué se viene, no qué
    // pasa en un día puntual.
    const [diaFiltrado, setDiaFiltrado]               = useState<Date | null>(null);
    // Guarda la fecha además del grupo: el modal se abre desde una reunión
    // concreta de la semana, y titularlo "Martes" —el día de la semana suelto—
    // no ubica en ninguna parte.
    const [grupoDetalle, setGrupoDetalle]             = useState<{ group: Group; asHost: boolean; date: Date } | null>(null);

    const [showCalendarModal, setShowCalendarModal]   = useState(false);
    const [selectedGroupIds, setSelectedGroupIds]     = useState<Set<string>>(new Set());

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const cfg = await supabaseService.getAppConfig();
                const settings: SeasonSettings = cfg?.groupsConfig?.seasonSettings ?? DEFAULT_SEASON_SETTINGS;
                const range = getActiveSeasonRange(settings);
                setSeasonLabel(range?.label ?? null);
                setSeasonRange(range ? { start: range.start, end: range.end } : null);

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

    // El mes de la semana se toma del JUEVES, no del lunes.
    //
    // Una semana casi siempre pisa dos meses, y el lunes es el peor juez: la
    // del 31-ago al 6-sep es septiembre para cualquiera que la mire, pero su
    // lunes es de agosto. Con el lunes como referencia el título decía
    // "Agosto" y los seis días de septiembre salían agrisados como si fueran
    // de otro mes. El jueves es el día del medio —el mismo criterio que usa
    // ISO 8601 para decidir a qué mes pertenece una semana— y siempre cae en
    // el mes que tiene la mayoría de los días.
    const mesDeLaSemana = weekDays[3];
    // "Septiembre 2026" y no el "septiembre de 2026" que devuelve el locale:
    // el "de" es la sílaba que hace que el mes más largo del año parta en dos
    // líneas a 375px y empuje toda la tira hacia abajo.
    const mesLabel = `${mesDeLaSemana.toLocaleDateString('es-AR', { month: 'long' })} ${mesDeLaSemana.getFullYear()}`;

    // Un solo listado de reuniones, ordenado por día y hora. Antes había dos
    // calendarios idénticos apilados —anfitrión y participante— en los que lo
    // único distinto era el color del punto; el rol se lee mejor escrito al
    // lado de cada reunión que adivinado en un círculo de 6px.
    const reunionesDeLaSemana = weekDays
        .flatMap(d => [
            ...getGroupsForDay(d, hostGroups).map(g => ({ group: g, asHost: true, date: d })),
            ...getGroupsForDay(d, participantGroups).map(g => ({ group: g, asHost: false, date: d })),
        ])
        .sort((a, b) => {
            const porFecha = a.date.getTime() - b.date.getTime();
            if (porFecha !== 0) return porFecha;
            return (a.group.meetingTime || '').localeCompare(b.group.meetingTime || '');
        });

    const reunionesVisibles = diaFiltrado
        ? reunionesDeLaSemana.filter(r => r.date.toDateString() === diaFiltrado.toDateString())
        : reunionesDeLaSemana;

    const cuentaPorDia = (d: Date) =>
        getGroupsForDay(d, hostGroups).length + getGroupsForDay(d, participantGroups).length;

    const prevWeek = () => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() - 7);
        setWeekStart(d);
        setDiaFiltrado(null);
    };
    const nextWeek = () => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + 7);
        setWeekStart(d);
        setDiaFiltrado(null);
    };

    // Los grupos siguen viéndose en la tira de la semana aunque hayan
    // terminado —navegar a una semana pasada y encontrar la reunión que hubo
    // es parte de para qué sirve un calendario—, pero agendarlos no se ofrece.
    const fueraDeTemporada = (g: Group) => estaFueraDeTemporada(g, seasonRange, hoyLocalISO());

    // Un solo listado para agendar. Antes eran dos modales con el mismo texto
    // y los mismos botones, separados solo por el rol; ahora el rol es una
    // píldora dentro de la fila. Si alguien es anfitrión y además está
    // inscripto, el grupo entra una vez y manda el rol de anfitrión.
    const todosLosGrupos: { group: Group; asHost: boolean }[] = [
        ...hostGroups.map(g => ({ group: g, asHost: true })),
        ...participantGroups
            .filter(g => !hostGroups.some(h => h.id === g.id))
            .map(g => ({ group: g, asHost: false })),
    ];
    const agendables = todosLosGrupos.filter(({ group }) => !fueraDeTemporada(group));

    const openCalModal = () => {
        // Preselección solo de los que se pueden agendar: los vencidos entran a
        // la lista apagados, para que se entienda por qué no están, no para que
        // viajen seleccionados sin que nadie los mire.
        setSelectedGroupIds(new Set(agendables.map(({ group }) => group.id)));
        setShowCalendarModal(true);
    };

    const toggleGroup = (id: string) => {
        setSelectedGroupIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const noGroups = hostGroups.length === 0 && participantGroups.length === 0;

    // es-AR abrevia con largo variable —"ago" pero "sept"— y además mete punto
    // en algunos meses. Se recorta a tres letras parejas: el chip de fecha
    // tiene 48px de lado y "SEPT" no entra al mismo tamaño que "AGO".
    const mesCorto = (d: Date) =>
        d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '').slice(0, 3);
    const diaCorto = (d: Date) => `${d.getDate()} ${mesCorto(d)}`;
    const esHoy = (d: Date) => d.toDateString() === today.toDateString();

    const rotuloLista = diaFiltrado
        ? diaFiltrado.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
        : `${diaCorto(weekDays[0])} – ${diaCorto(weekDays[6])}`;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white font-sans">
            <div className="max-w-xl mx-auto px-4 py-6 sm:py-8">

                {/* ── TÍTULO ──────────────────────────────── */}
                <div className="flex items-center justify-between gap-3 mb-4">
                    <h1 className={H2}>Mi calendario</h1>
                    {seasonLabel && (
                        <span className={`${PILL} shrink-0 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400`}>
                            {seasonLabel}
                        </span>
                    )}
                </div>

                {/* ── PANEL DE LA SEMANA ──────────────────── */}
                <div className={`${CARD} px-4 pt-5 pb-4`}>
                    {/* Mes + navegación */}
                    <div className="flex items-center justify-between gap-2 mb-5">
                        <p className="text-xl sm:text-2xl font-bold tracking-tight leading-none whitespace-nowrap first-letter:uppercase text-slate-900 dark:text-white">
                            {mesLabel}
                        </p>

                        <div className="flex items-center gap-1.5 shrink-0">
                            <button type="button" onClick={prevWeek} aria-label="Semana anterior" className={BTN_ICONO}>
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={nextWeek} aria-label="Semana siguiente" className={BTN_ICONO}>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Rótulos de día */}
                    <div className="grid grid-cols-7 mb-1">
                        {DAY_LABELS_SHORT.map((etiqueta, i) => (
                            <span
                                key={etiqueta}
                                className={`text-center text-[10px] font-semibold uppercase tracking-[0.12em] leading-none ${
                                    // Domingo en rojo: es el día no laborable, no un adorno.
                                    i === 6 ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-zinc-500'
                                    }`}
                            >
                                {etiqueta}
                            </span>
                        ))}
                    </div>

                    {/* Números + punto de reunión */}
                    <div className="grid grid-cols-7">
                        {weekDays.map((day, idx) => {
                            const cuenta = cuentaPorDia(day);
                            const hoy = esHoy(day);
                            const elegido = !!diaFiltrado && day.toDateString() === diaFiltrado.toDateString();
                            const otroMes = day.getMonth() !== mesDeLaSemana.getMonth();

                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setDiaFiltrado(elegido ? null : day)}
                                    aria-pressed={elegido}
                                    aria-label={`${day.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}${cuenta > 0 ? `, ${cuenta} reunión${cuenta > 1 ? 'es' : ''}` : ', sin reuniones'}`}
                                    className="flex flex-col items-center gap-1.5 pt-2 pb-1 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 dark:focus-visible:ring-white/30"
                                >
                                    {/* Relleno slate-900 = el día elegido; es el mismo
                                        tratamiento que el Home reserva para su botón
                                        primario y el punto activo del carrusel.
                                        Anillo verde = hoy, cuando estás mirando otro
                                        día. Nunca los dos a la vez. */}
                                    <span className={[
                                        'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold tabular-nums transition-colors',
                                        elegido
                                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                                            : hoy
                                                ? 'text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-600/40'
                                                : otroMes
                                                    ? 'text-slate-300 dark:text-zinc-600 font-semibold'
                                                    : idx === 6
                                                        ? 'text-red-600 dark:text-red-400 hover:bg-slate-50 dark:hover:bg-zinc-800'
                                                        : 'text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-zinc-800',
                                    ].join(' ')}>
                                        {day.getDate()}
                                    </span>
                                    <span
                                        aria-hidden="true"
                                        className={`w-1.5 h-1.5 rounded-full transition-colors ${cuenta > 0
                                            ? elegido ? 'bg-slate-900 dark:bg-white' : 'bg-emerald-600'
                                            : 'bg-transparent'
                                            }`}
                                    />
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── LISTA ───────────────────────────────── */}
                <div className="mt-6">
                    <div className="flex items-baseline justify-between gap-3 mb-3">
                        <p className={`${EYEBROW} first-letter:uppercase`}>{rotuloLista}</p>
                        {diaFiltrado && (
                            <button
                                type="button"
                                onClick={() => setDiaFiltrado(null)}
                                className="shrink-0 inline-flex items-center gap-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30"
                            >
                                Toda la semana
                            </button>
                        )}
                    </div>

                    {loading ? (
                        <div className={`${CARD} flex flex-col items-center justify-center py-16 gap-3`}>
                            <Loader2 className="w-6 h-6 animate-spin text-slate-300 dark:text-zinc-600" aria-hidden="true" />
                            <p className={EYEBROW}>Cargando tus grupos…</p>
                        </div>
                    ) : noGroups ? (
                        /* Pantalla vacía: no describe el vacío, propone el paso
                           siguiente. */
                        <div className={`${CARD} text-center py-14 px-6`}>
                            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                                <CalendarDays className="w-7 h-7 text-emerald-600" aria-hidden="true" />
                            </div>
                            <h3 className="text-base font-bold uppercase tracking-tight text-slate-900 dark:text-white mb-1.5">
                                Tu semana está libre
                            </h3>
                            <p className={`${BODY} leading-relaxed mb-6 max-w-xs mx-auto`}>
                                Sumate a un grupo de conexión y sus reuniones aparecen acá.
                            </p>
                            <a href="#/gcx" className={`${BTN_PRIMARY} px-5 py-3 text-sm`}>
                                Buscar un grupo
                                <ChevronRight className="w-4 h-4" />
                            </a>
                        </div>
                    ) : reunionesVisibles.length === 0 ? (
                        <div className={`${CARD} text-center py-12 px-6`}>
                            <p className={BODY}>
                                {diaFiltrado ? 'No hay reuniones este día.' : 'No hay reuniones esta semana.'}
                            </p>
                        </div>
                    ) : (
                        <div className={`${CARD} overflow-hidden`}>
                            {reunionesVisibles.map(({ group, asHost, date }, i) => {
                                const hoy = esHoy(date);
                                return (
                                    <button
                                        key={`${group.id}-${date.toISOString()}`}
                                        type="button"
                                        onClick={() => setGrupoDetalle({ group, asHost, date })}
                                        className={`w-full flex items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900/30 dark:focus-visible:ring-white/30 ${i > 0 ? 'border-t border-slate-100 dark:border-zinc-800' : ''
                                            }`}
                                    >
                                        {/* Chip de fecha — el objeto que da carácter a
                                            la lista. En verde cuando es hoy, y ahí dice
                                            "Hoy" en vez del mes: es el dato que uno
                                            busca primero al abrir. */}
                                        <span className={`w-12 h-12 shrink-0 rounded-xl border flex flex-col items-center justify-center ${hoy
                                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400'
                                            : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400'
                                            }`}>
                                            <span className="text-[9px] font-semibold uppercase tracking-[0.1em] leading-none">
                                                {hoy ? 'Hoy' : mesCorto(date)}
                                            </span>
                                            <span className="text-[15px] font-black tabular-nums tracking-[-0.02em] leading-none mt-1">
                                                {String(date.getDate()).padStart(2, '0')}
                                            </span>
                                        </span>

                                        <span className="min-w-0 flex-1">
                                            <span className="block text-base font-bold tracking-[-0.01em] leading-tight truncate text-slate-900 dark:text-white">
                                                {group.name}
                                            </span>
                                            <span className={`block ${BODY} leading-snug truncate mt-1`}>
                                                {group.meetingTime || 'Sin horario'}
                                                {' · '}
                                                <span className={asHost
                                                    ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                                                    : 'font-semibold text-indigo-600 dark:text-indigo-400'
                                                }>
                                                    {asHost ? 'Anfitrión' : 'Participante'}
                                                </span>
                                            </span>
                                        </span>

                                        {/* Círculo hueco: no es un botón aparte —el
                                            objetivo táctil es la fila entera— así que
                                            va como span y no anida un button dentro
                                            de otro. */}
                                        <span
                                            aria-hidden="true"
                                            className="w-9 h-9 shrink-0 rounded-full border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-400 dark:text-zinc-500"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* ── AGENDAR ──────────────────────────
                        A lo ancho y con su nombre escrito. Estuvo como un ícono
                        suelto en la esquina del panel y no se leía como lo que
                        es; peor todavía, se escondía solo cuando ningún grupo
                        era agendable, que es justo cuando alguien lo busca y
                        concluye que la función desapareció. Ahora está siempre
                        que haya grupos, y si ninguno se puede agendar el modal
                        lo explica en lugar de dejar un hueco. */}
                    {!loading && !noGroups && (
                        <button
                            type="button"
                            onClick={openCalModal}
                            className={`${BTN_SOFT} w-full mt-3 px-4 py-3.5 min-h-[52px] text-sm`}
                        >
                            <CalendarPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
                            Agendar mis grupos
                        </button>
                    )}
                </div>

                {/* ── MODAL: DETALLE DEL GRUPO ────────────── */}
                <NeoModal
                    isOpen={!!grupoDetalle}
                    onClose={() => setGrupoDetalle(null)}
                    title={grupoDetalle
                        ? grupoDetalle.date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
                        : ''}
                    maxWidth="max-w-md"
                >
                    {grupoDetalle && (
                        <GroupCard group={grupoDetalle.group} asHost={grupoDetalle.asHost} />
                    )}
                </NeoModal>

                {/* ── MODAL: AGENDAR ──────────────────────── */}
                <NeoModal
                    isOpen={showCalendarModal}
                    onClose={() => setShowCalendarModal(false)}
                    title="Agendar en el calendario"
                    maxWidth="max-w-md"
                >
                    <div className="space-y-5">
                        <p className={`${BODY} leading-relaxed`}>
                            {agendables.length > 0
                                ? 'Elegí los grupos que querés agregar como reuniones semanales.'
                                : 'Ninguno de tus grupos se puede agendar por ahora.'}
                        </p>

                        <div className="space-y-2 max-h-64 overflow-y-auto -mx-1 px-1">
                            {todosLosGrupos.map(({ group, asHost }) => {
                                const fuera = fueraDeTemporada(group);
                                const selected = !fuera && selectedGroupIds.has(group.id);
                                return (
                                    <button
                                        key={group.id}
                                        type="button"
                                        disabled={fuera}
                                        onClick={() => toggleGroup(group.id)}
                                        aria-pressed={fuera ? undefined : selected}
                                        className={[
                                            'w-full flex items-center gap-3 px-3.5 py-3 min-h-[52px] rounded-xl border text-left transition-all duration-150',
                                            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20 dark:focus-visible:ring-white/20',
                                            fuera
                                                ? 'bg-slate-50 dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 cursor-not-allowed'
                                                : selected
                                                    ? 'bg-slate-900 dark:bg-white border-slate-900 dark:border-white cursor-pointer'
                                                    : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 cursor-pointer',
                                        ].join(' ')}
                                    >
                                        {/* Casilla — el hueco se mantiene en los
                                            vencidos para que los nombres queden en
                                            la misma vertical. */}
                                        <span className={`w-4 h-4 rounded shrink-0 flex items-center justify-center transition-colors ${selected
                                            ? 'bg-white dark:bg-slate-900'
                                            : fuera
                                                ? 'border border-slate-200 dark:border-zinc-700'
                                                : 'border border-slate-300 dark:border-zinc-600'
                                            }`}>
                                            {selected && <Check className="w-3 h-3 text-slate-900 dark:text-white" aria-hidden="true" />}
                                        </span>

                                        <span className="min-w-0 flex-1">
                                            <span className={`block text-sm font-semibold truncate leading-snug ${selected
                                                ? 'text-white dark:text-slate-900'
                                                : fuera
                                                    ? 'text-slate-400 dark:text-zinc-500'
                                                    : 'text-slate-900 dark:text-white'
                                                }`}>
                                                {group.name}
                                            </span>
                                            <span className={`block text-xs font-normal truncate leading-snug mt-0.5 ${selected
                                                ? 'text-white/60 dark:text-slate-900/60'
                                                : fuera
                                                    ? 'text-slate-300 dark:text-zinc-600'
                                                    : 'text-slate-500 dark:text-zinc-400'
                                                }`}>
                                                {group.meetingDay}{group.meetingTime ? ` · ${group.meetingTime}` : ''}
                                                {' · '}{asHost ? 'Anfitrión' : 'Participante'}
                                            </span>
                                            {/* La píldora va en su propia línea y no a
                                                la derecha del nombre: entre temporadas
                                                la lista entera está vencida, y una
                                                píldora por fila robándole ancho al
                                                nombre dejaba "Salud Financier…" en
                                                todas. El nombre es lo que se busca. */}
                                            {fuera && (
                                                <span className="inline-flex mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
                                                    Fuera de temporada
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Se explica una vez, abajo de la lista, en lugar de
                            repetirlo por fila: la píldora ya marca cuáles son. */}
                        {todosLosGrupos.some(({ group }) => fueraDeTemporada(group)) && (
                            <p className="text-xs font-normal text-slate-500 dark:text-zinc-400 leading-relaxed">
                                Los grupos fuera de temporada no se pueden agendar: el recordatorio
                                quedaría con fecha de fin vencida y no avisaría nunca. Si el grupo
                                vuelve a abrir, aparece acá de nuevo cuando te inscribas.
                            </p>
                        )}

                        <div className="space-y-2.5 pt-4 border-t border-slate-200 dark:border-zinc-800">
                            <p className={EYEBROW}>Agregar con</p>

                            <button
                                type="button"
                                disabled={selectedGroupIds.size === 0}
                                onClick={() => {
                                    // El `!fueraDeTemporada` no es redundante con la
                                    // fila deshabilitada: la selección es estado, y
                                    // basta que un grupo termine con el modal abierto
                                    // para que un id ya elegido siga adentro.
                                    todosLosGrupos
                                        .filter(({ group }) => selectedGroupIds.has(group.id) && !fueraDeTemporada(group))
                                        .forEach(({ group }) => window.open(buildGoogleCalUrl(group), '_blank'));
                                }}
                                className={`${BTN_PRIMARY} w-full px-4 py-3.5 min-h-[52px] text-sm disabled:opacity-40 disabled:pointer-events-none`}
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

                            <button
                                type="button"
                                disabled={selectedGroupIds.size === 0}
                                onClick={() => {
                                    todosLosGrupos
                                        .filter(({ group }) => selectedGroupIds.has(group.id) && !fueraDeTemporada(group))
                                        .forEach(({ group }) => downloadIcs(group));
                                }}
                                className={`${BTN_SOFT} w-full px-4 py-3.5 min-h-[52px] text-sm disabled:opacity-40 disabled:pointer-events-none`}
                            >
                                <CalendarDays className="w-4 h-4 shrink-0" aria-hidden="true" />
                                Apple Calendar / Outlook
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
