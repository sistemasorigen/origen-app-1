import React, { useState } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    Search,
    Plus,
    MoreHorizontal,
    Clock,
    MapPin,
    User,
    Calendar as CalendarIcon,
    Video
} from 'lucide-react';
import { Group } from '../../types';

interface CoordinatorCalendarProps {
    groups: Group[];
    categoryName: string;
}

const DAYS_ES = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const MONTHS_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Custom Color Constants (from User's Script)
// Custom Color Constants (from User's Script)
const COLORS = {
    primary: '#86efac',
    primaryHover: '#4ade80',
    backgroundLight: '#fdfdfd',
    borderSilver: '#f1f5f9',
    softMint: '#d1fae5',
    softMintText: '#065f46',
    softLavender: '#ede9fe',
    softLavenderText: '#5b21b6',
    softSky: '#e0f2fe',
    softSkyText: '#075985',
    softRose: '#ffe4e6',
    softRoseText: '#9f1239',
    softOrange: '#ffedd5',
    softOrangeText: '#9a3412',
};

const PALETTE = [
    { bg: COLORS.softSky, text: COLORS.softSkyText },
    { bg: COLORS.softLavender, text: COLORS.softLavenderText },
    { bg: COLORS.softOrange, text: COLORS.softOrangeText },
    { bg: COLORS.softMint, text: COLORS.softMintText },
    { bg: COLORS.softRose, text: COLORS.softRoseText },
];

const CoordinatorCalendar: React.FC<CoordinatorCalendarProps> = ({ groups }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 (Sun) - 6 (Sat)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Days from previous month to fill grid
    const prevMonthDays = new Date(year, month, 0).getDate();

    // Helper to map string day to index (0=Sun, 1=Mon, etc.)
    const getDayIndex = (dayName: string) => {
        const lower = dayName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents
        if (lower.includes('dom')) return 0;
        if (lower.includes('lun')) return 1;
        if (lower.includes('mar')) return 2;
        if (lower.includes('mier') || lower.includes('mié')) return 3;
        if (lower.includes('jue')) return 4;
        if (lower.includes('vie')) return 5;
        if (lower.includes('sab')) return 6;
        return -1;
    };



    // Helper to parse ISO date string to local Date object (ignoring time/timezone)
    const parseLocalISO = (dateStr: string) => {
        if (!dateStr) return null;
        const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
        return new Date(y, m - 1, d); // Month is 0-indexed
    };

    // Generate events for the current month based on groups' meeting days
    const events = React.useMemo(() => {
        const monthEvents: any[] = [];

        // Iterate through all days in the month
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const dayOfWeek = date.getDay();

            // Find groups that meet on this day of the week
            groups.forEach((group, index) => {
                if (group.status === 'finished') return;

                const currentDayTime = date.getTime();

                // 1. Check Start Date (Event must be on or after start date)
                if (group.startDate) {
                    const startDate = parseLocalISO(group.startDate);
                    if (startDate && currentDayTime < startDate.getTime()) return;
                }

                // 2. Check End Date (Event must be on or before end date)
                if (group.endDate) {
                    const endDate = parseLocalISO(group.endDate);
                    if (endDate && currentDayTime > endDate.getTime()) return;
                }

                const groupDayIndex = getDayIndex(group.meetingDay);
                if (groupDayIndex === dayOfWeek) {
                    const colorIndex = (group.name.length + index) % PALETTE.length;
                    monthEvents.push({
                        id: `${group.id}-${d}`,
                        date: date,
                        day: d,
                        title: group.name,
                        time: group.meetingTime,
                        location: group.location,
                        leader: `${group.leaderName} ${group.leaderSurname}`,
                        category: group.categoryName || 'General',
                        colorBg: PALETTE[colorIndex].bg,
                        colorText: PALETTE[colorIndex].text,
                        groupData: group
                    });
                }
            });
        }
        return monthEvents.sort((a, b) => a.time.localeCompare(b.time));
    }, [groups, year, month, daysInMonth]);

    // Filter events for the selected date (Sidebar)
    const selectedDateEvents = React.useMemo(() => {
        return events.filter(e =>
            e.date.getDate() === selectedDate.getDate() &&
            e.date.getMonth() === selectedDate.getMonth() &&
            e.date.getFullYear() === selectedDate.getFullYear()
        );
    }, [events, selectedDate]);

    // Get upcoming events (next 5 from selected date onwards)
    const upcomingEvents = React.useMemo(() => {
        const now = selectedDate.getTime();
        return events
            .filter(e => e.date.getTime() >= now)
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .slice(0, 10); // Show next 10
    }, [events, selectedDate]);


    const handlePrevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
    };

    const handleToday = () => {
        const now = new Date();
        setCurrentDate(now);
        setSelectedDate(now);
    };

    const renderCalendarGrid = () => {
        const cells = [];
        // Empty/Prev month cells
        for (let i = 0; i < firstDayOfMonth; i++) {
            const dayNum = prevMonthDays - firstDayOfMonth + 1 + i;
            cells.push(
                <div key={`prev-${i}`} className="min-h-[100px] md:min-h-[120px] p-2 border-b border-r border-[#f1f5f9] bg-slate-50/30">
                    <span className="text-slate-300 font-medium">{dayNum}</span>
                </div>
            );
        }

        // Current month cells
        for (let d = 1; d <= daysInMonth; d++) {
            const dayEvents = events.filter(e => e.day === d);
            const isSelected =
                selectedDate.getDate() === d &&
                selectedDate.getMonth() === month &&
                selectedDate.getFullYear() === year;

            const isToday =
                new Date().getDate() === d &&
                new Date().getMonth() === month &&
                new Date().getFullYear() === year;

            cells.push(
                <div
                    key={`curr-${d}`}
                    onClick={() => setSelectedDate(new Date(year, month, d))}
                    className={`min-h-[100px] md:min-h-[120px] p-2 border-b border-r border-[#f1f5f9] transition-colors cursor-pointer group hover:bg-slate-50 relative ${isSelected ? 'bg-green-50/50' : ''}`}
                >
                    <div className="flex justify-between items-start">
                        <span className={`w-7 h-7 flex items-center justify-center rounded-full font-medium text-sm transition-all ${isToday
                            ? 'bg-[#86efac] text-white font-bold shadow-sm'
                            : isSelected
                                ? 'text-[#065f46] font-bold bg-green-100'
                                : 'text-slate-600 group-hover:text-[#4ade80]'
                            }`}>
                            {d}
                        </span>
                    </div>

                    <div className="mt-1 flex flex-col gap-1">
                        {dayEvents.slice(0, 3).map((ev: any, idx: number) => (
                            <div
                                key={idx}
                                className="text-[10px] px-1.5 py-1 rounded truncate font-medium"
                                style={{ backgroundColor: ev.colorBg, color: ev.colorText }}
                            >
                                {ev.time} - {ev.title}
                            </div>
                        ))}
                        {dayEvents.length > 3 && (
                            <div className="text-[10px] text-slate-400 pl-1">
                                +{dayEvents.length - 3} más
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return cells;
    };

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] overflow-hidden bg-[#fdfdfd] font-sans">
            {/* Main Calendar Section */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <header className="flex items-center justify-between px-8 py-5 border-b border-[#f1f5f9] bg-white shrink-0">
                    <div className="flex items-center gap-6">
                        <h1 className="text-2xl font-bold text-slate-800 capitalize">
                            {MONTHS_ES[month]} {year}
                        </h1>
                        <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-100">
                            <button
                                onClick={handlePrevMonth}
                                className="p-1 hover:bg-white rounded-md transition-colors text-slate-500 hover:text-slate-900 shadow-sm hover:shadow"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleToday}
                                className="px-3 py-1 text-sm font-medium text-slate-700 hover:text-slate-900"
                            >
                                Hoy
                            </button>
                            <button
                                onClick={handleNextMonth}
                                className="p-1 hover:bg-white rounded-md transition-colors text-slate-500 hover:text-slate-900 shadow-sm hover:shadow"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    {/* Simplified Search/Add for now */}
                    <div className="flex items-center gap-4">

                    </div>
                </header>

                <div className="flex-1 overflow-auto p-6 bg-[#fdfdfd]">
                    <div className="bg-white rounded-xl border border-[#f1f5f9] shadow-sm flex flex-col min-h-[600px]">
                        <div className="grid grid-cols-7 border-b border-[#e2e8f0]">
                            {DAYS_ES.map(day => (
                                <div key={day} className="py-3 text-center text-sm font-semibold text-slate-400">{day}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 flex-1 auto-rows-fr">
                            {renderCalendarGrid()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Sidebar - Upcoming Meetings */}
            <aside className="w-80 bg-white border-l border-[#f1f5f9] flex-shrink-0 flex flex-col h-full overflow-hidden shadow-sm z-10 hidden lg:flex">
                <div className="p-6 border-b border-[#f1f5f9] bg-slate-50/50">
                    <h2 className="text-lg font-bold text-slate-800">Agenda</h2>
                    <div className="flex items-center gap-2 mt-2 text-slate-500">
                        <CalendarIcon className="w-4 h-4 text-[#4ade80]" />
                        <span className="text-sm font-medium capitalize">
                            {selectedDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {upcomingEvents.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            <p>No hay reuniones programadas para este día o los siguientes.</p>
                        </div>
                    ) : (
                        upcomingEvents.map((ev: any) => (
                            <div key={ev.id} className="relative bg-white rounded-xl border border-[#f1f5f9] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-md transition-all group">
                                <div
                                    className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full opacity-60"
                                    style={{ backgroundColor: ev.colorText }}
                                ></div>
                                <div className="pl-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <span
                                            className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
                                            style={{ backgroundColor: ev.colorBg, color: ev.colorText }}
                                        >
                                            {ev.date.getDate()}/{ev.date.getMonth() + 1}
                                        </span>
                                    </div>
                                    <h3 className="text-base font-semibold text-slate-800 mb-1">{ev.title}</h3>
                                    <div className="space-y-2 mt-3">
                                        <div className="flex items-center text-sm text-slate-500">
                                            <Clock className="w-4 h-4 mr-2 text-slate-400" />
                                            {ev.time}
                                        </div>
                                        <div className="flex items-center text-sm text-slate-500">
                                            <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                                            {ev.location || 'Sin ubicación'}
                                        </div>
                                        <div className="flex items-center text-sm text-slate-500">
                                            <User className="w-4 h-4 mr-2 text-slate-400" />
                                            {ev.leader}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </aside>
        </div>
    );
};

export default CoordinatorCalendar;
