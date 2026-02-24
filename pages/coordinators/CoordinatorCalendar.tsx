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
    Video,
    ArrowRight
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

// Neo-Brutalism Palette
const PALETTE = [
    { bg: '#6ee7b7', text: '#000000', border: '#000000' }, // Emerald
    { bg: '#fcd34d', text: '#000000', border: '#000000' }, // Amber
    { bg: '#f9a8d4', text: '#000000', border: '#000000' }, // Pink
    { bg: '#93c5fd', text: '#000000', border: '#000000' }, // Blue
    { bg: '#c4b5fd', text: '#000000', border: '#000000' }, // Violet
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
        if (!dayName) return -1;
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
                    const colorIndex = ((group.name || '').length + index) % PALETTE.length;
                    monthEvents.push({
                        id: `${group.id}-${d}`,
                        date: date,
                        day: d,
                        title: group.name,
                        time: group.meetingTime,
                        location: group.location,
                        leader: `${group.leaderName || ''} ${group.leaderSurname || ''}`.trim() || 'Sin asignar',
                        category: group.categoryName || 'General',
                        colorBg: PALETTE[colorIndex].bg,
                        colorText: PALETTE[colorIndex].text,
                        colorBorder: PALETTE[colorIndex].border,
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
                <div key={`prev-${i}`} className="min-h-[80px] md:min-h-[120px] p-2 border-b-2 border-r-2 border-black bg-gray-100 opacity-50">
                    <span className="text-gray-400 font-bold text-lg">{dayNum}</span>
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
                    className={`min-h-[80px] md:min-h-[120px] p-2 border-b-2 border-r-2 border-black transition-all cursor-pointer group relative hover:bg-yellow-50 ${isSelected ? 'bg-black text-white' : 'bg-white'
                        }`}
                >
                    <div className="flex justify-between items-start">
                        <span className={`w-8 h-8 flex items-center justify-center font-black text-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${isToday
                            ? 'bg-emerald-400 text-black'
                            : isSelected
                                ? 'bg-white text-black'
                                : 'bg-white text-black group-hover:bg-black group-hover:text-white'
                            }`}>
                            {d}
                        </span>
                    </div>

                    <div className="mt-1 md:mt-2 flex flex-col gap-0.5 md:gap-1">
                        {dayEvents.slice(0, 3).map((ev: any, idx: number) => (
                            <div
                                key={idx}
                                className={`text-[8px] md:text-[10px] px-1 py-0.5 border border-black font-bold truncate ${isSelected ? 'bg-white text-black' : ''}`}
                                style={{
                                    backgroundColor: isSelected ? '#ffffff' : ev.colorBg,
                                    color: isSelected ? '#000000' : ev.colorText
                                }}
                            >
                                <span className="hidden lg:inline">{ev.time} - </span>
                                {ev.title}
                            </div>
                        ))}
                        {dayEvents.length > 3 && (
                            <div className={`hidden md:block text-[9px] font-bold pl-1 ${isSelected ? 'text-gray-400' : 'text-gray-500'}`}>
                                +{dayEvents.length - 3} más
                            </div>
                        )}
                        {dayEvents.length > 3 && (
                            <div className={`md:hidden text-[8px] font-bold pl-1 ${isSelected ? 'text-gray-400' : 'text-gray-500'}`}>
                                +{dayEvents.length - 3}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return cells;
    };

    return (
        <div className="flex flex-col lg:flex-row h-full lg:h-[calc(100vh-64px)] overflow-y-auto lg:overflow-hidden bg-[#fdfdfd] font-sans">
            {/* Main Calendar Section */}
            <div className="flex-1 flex flex-col min-w-0 lg:h-full lg:overflow-hidden bg-[#fdfdfd]">
                <header className="flex flex-col sm:flex-row items-center justify-between px-6 py-6 md:px-10 border-b-2 border-black bg-white shrink-0 gap-6">
                    <div className="flex items-center gap-6 w-full sm:w-auto justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
                                <CalendarIcon className="w-6 h-6" strokeWidth={2.5} />
                            </div>
                            <h1 className="text-3xl md:text-3xl font-black text-black uppercase tracking-tighter">
                                {MONTHS_ES[month]} <span className="text-gray-400">{year}</span>
                            </h1>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrevMonth}
                                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-white hover:bg-gray-50 border border-gray-200 transition-all text-gray-600"
                            >
                                <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
                            </button>
                            <button
                                onClick={handleToday}
                                className="px-4 py-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-xs font-bold uppercase tracking-wider rounded-lg bg-gray-100 hover:bg-gray-200 transition-all text-gray-800"
                            >
                                Hoy
                            </button>
                            <button
                                onClick={handleNextMonth}
                                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-white hover:bg-gray-50 border border-gray-200 transition-all text-gray-600"
                            >
                                <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-auto p-4 md:p-8 bg-[#fdfdfd] min-h-[400px] mb-20 md:mb-0">
                    <div className="bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col min-h-[400px] md:min-h-[600px]">
                        <div className="grid grid-cols-7 border-b-2 border-black bg-black text-white">
                            {DAYS_ES.map(day => (
                                <div key={day} className="py-3 text-center text-sm font-black uppercase tracking-widest">{day}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 flex-1 auto-rows-fr bg-white">
                            {renderCalendarGrid()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Sidebar - Upcoming Meetings */}
            <aside className="w-full lg:w-96 bg-white border-t-2 lg:border-t-0 lg:border-l-2 border-black flex-shrink-0 flex flex-col h-auto lg:h-full overflow-hidden z-10 order-last">
                <div className="p-6 border-b-2 border-black bg-emerald-400">
                    <h2 className="text-2xl font-black text-black uppercase tracking-tighter flex items-center gap-2">
                        Agenda
                        <span className="text-sm bg-black text-white px-2 py-0.5 rounded-none tracking-widest border-2 border-black relative -top-1">HOY</span>
                    </h2>
                    <div className="flex items-center gap-2 mt-2 text-black font-bold border-2 border-black bg-white p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <Clock className="w-5 h-5 text-black" strokeWidth={2.5} />
                        <span className="text-sm uppercase tracking-wide">
                            {selectedDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#fdfdfd]">
                    {selectedDateEvents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50">
                            <CalendarIcon className="w-12 h-12 text-gray-300 mb-3" />
                            <p className="text-gray-500 font-bold uppercase text-center text-sm">Sin actividades<br />programadas</p>
                        </div>
                    ) : (
                        selectedDateEvents.map((ev: any) => (
                            <div key={ev.id} className="relative bg-white border border-gray-100 p-0 shadow-sm rounded-xl overflow-hidden group w-full mb-4">
                                <div className="p-4 flex justify-between items-start" style={{ backgroundColor: ev.colorBg }}>
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-widest bg-black text-white px-2 py-0.5 mb-2 inline-block">
                                            {ev.category}
                                        </span>
                                        <h3 className="font-black text-lg text-black uppercase leading-tight">{ev.title}</h3>
                                    </div>
                                    <div className="p-1.5 bg-white border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                        <Video className="w-4 h-4 text-black" strokeWidth={2.5} />
                                    </div>
                                </div>
                                <div className="p-4 bg-white">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-none border-2 border-black flex items-center justify-center bg-gray-100 font-black text-xs">
                                                <Clock className="w-4 h-4" />
                                            </div>
                                            <span className="font-bold text-sm uppercase">{ev.time} HS</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-none border-2 border-black flex items-center justify-center bg-gray-100 font-black text-xs">
                                                <MapPin className="w-4 h-4" />
                                            </div>
                                            <span className="font-bold text-sm uppercase truncate">{ev.location || 'Virtual'}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-none border-2 border-black flex items-center justify-center bg-gray-100 font-black text-xs">
                                                <User className="w-4 h-4" />
                                            </div>
                                            <span className="font-bold text-sm uppercase truncate">{ev.leader}</span>
                                        </div>
                                    </div>
                                    <button className="w-full mt-5 py-3 px-4 min-h-[44px] bg-black text-white font-bold uppercase text-xs tracking-wider border border-black hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 rounded-lg shadow-sm">
                                        Ver Detalles
                                        <ArrowRight className="w-4 h-4 ml-1" />
                                    </button>
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
