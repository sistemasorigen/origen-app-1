
import React, { useState, useEffect } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    Clock,
    Calendar as CalendarIcon,
    Tag,
    Megaphone,
    Link,
    Check,
} from 'lucide-react';
import { useStore } from '../../store';
import { AppEvent, Announcement } from '../../types';

const DAYS_ES = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const MONTHS_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Neo-Brutalism Palette
const PALETTE = [
    { bg: '#fcd34d', text: '#000000' }, // Amber
    { bg: '#6ee7b7', text: '#000000' }, // Emerald
    { bg: '#f9a8d4', text: '#000000' }, // Pink
    { bg: '#93c5fd', text: '#000000' }, // Blue
    { bg: '#c4b5fd', text: '#000000' }, // Violet
    { bg: '#fdba74', text: '#000000' }, // Orange
];

const parseLocalDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const clean = dateStr.split('T')[0];
    const [y, m, d] = clean.split('-').map(Number);
    return new Date(y, m - 1, d);
};

// Helper to check if a date is within an announcement range
const isWithinRange = (date: Date, startStr: string, endStr: string) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const start = parseLocalDate(startStr)?.getTime() || 0;
    const end = parseLocalDate(endStr)?.getTime() || 0;
    return d >= start && d <= end;
};

const InfoPointCalendar: React.FC = () => {
    const { events, announcements } = useStore();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [copiedEventId, setCopiedEventId] = useState<string | null>(null);

    const handleCopyEventLink = (eventId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const url = `${window.location.origin}/#/info-point?eventId=${eventId}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopiedEventId(eventId);
            setTimeout(() => setCopiedEventId(null), 2000);
        }).catch(() => {
            const input = document.createElement('input');
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setCopiedEventId(eventId);
            setTimeout(() => setCopiedEventId(null), 2000);
        });
    };

    const searchParams = new URLSearchParams(
        window.location.hash.includes('?')
            ? window.location.hash.split('?')[1]
            : ''
    );
    const targetEventId = searchParams.get('eventId');

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const todayStr = new Date().toISOString().slice(0, 10);

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    // Map events AND announcements to calendar days for this month
    const calendarEvents = React.useMemo(() => {
        const items: any[] = [];

        // 1. Process regular events
        events.forEach((ev, idx) => {
            const date = parseLocalDate(ev.date);
            if (!date) return;
            if (date.getFullYear() !== year || date.getMonth() !== month) return;

            const colorIndex = (ev.name.length + idx) % PALETTE.length;
            items.push({
                ...ev,
                id: ev.id,
                name: ev.name,
                parsedDate: date,
                day: date.getDate(),
                colorBg: PALETTE[colorIndex].bg,
                colorText: PALETTE[colorIndex].text,
                isAnnouncement: false
            });
        });

        // 2. Process active announcements
        const activeAnnouncements = announcements.filter(a =>
            !a.isPermanent && (a.isActive !== undefined ? a.isActive : (a.startDate <= todayStr && a.endDate >= todayStr))
        );

        activeAnnouncements.forEach((ann, idx) => {
            // Check each day of current month
            for (let d = 1; d <= daysInMonth; d++) {
                const checkDate = new Date(year, month, d);
                if (isWithinRange(checkDate, ann.startDate, ann.endDate)) {
                    items.push({
                        id: `ann-${ann.id}-${d}`,
                        name: ann.title,
                        description: ann.description,
                        parsedDate: checkDate,
                        day: d,
                        colorBg: '#000000', // Black background for announcements
                        colorText: '#ffffff', // White text
                        isAnnouncement: true,
                        type: 'ANUNCIO'
                    });
                }
            }
        });

        return items;
    }, [events, announcements, year, month, daysInMonth, todayStr]);

    // Events for selected day (sidebar)
    const selectedDateItems = React.useMemo(() => {
        return calendarEvents.filter(e =>
            e.day === selectedDate.getDate() &&
            e.parsedDate.getMonth() === selectedDate.getMonth() &&
            e.parsedDate.getFullYear() === selectedDate.getFullYear()
        );
    }, [calendarEvents, selectedDate]);

    useEffect(() => {
        if (!targetEventId || calendarEvents.length === 0) return;
        const target = calendarEvents.find(e => e.id === targetEventId);
        if (!target) return;
        setCurrentDate(new Date(
            target.parsedDate.getFullYear(),
            target.parsedDate.getMonth(),
            1
        ));
        setSelectedDate(target.parsedDate);
    }, [targetEventId, calendarEvents.length]);

    const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const handleToday = () => {
        const now = new Date();
        setCurrentDate(now);
        setSelectedDate(now);
    };

    const renderGrid = () => {
        const cells = [];

        // Prev month filler cells
        for (let i = 0; i < firstDayOfMonth; i++) {
            const dayNum = prevMonthDays - firstDayOfMonth + 1 + i;
            cells.push(
                <div key={`prev-${i}`} className="min-h-[70px] md:min-h-[100px] p-2 border-b-2 border-r-2 border-black bg-gray-100 opacity-40">
                    <span className="text-gray-400 font-bold text-sm">{dayNum}</span>
                </div>
            );
        }

        // Current month cells
        for (let d = 1; d <= daysInMonth; d++) {
            const dayItems = calendarEvents.filter(e => e.day === d);
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
                    className={`min-h-[70px] md:min-h-[100px] p-2 border-b-2 border-r-2 border-black transition-all cursor-pointer group relative hover:bg-yellow-50 ${isSelected ? 'bg-black text-white' : 'bg-white'}`}
                >
                    <div className="flex justify-between items-start">
                        <span className={`w-7 h-7 flex items-center justify-center font-black text-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${isToday ? 'bg-emerald-400 text-black' :
                            isSelected ? 'bg-white text-black' :
                                'bg-white text-black group-hover:bg-black group-hover:text-white'
                            }`}>
                            {d}
                        </span>
                    </div>

                    <div className="mt-1 flex flex-col gap-0.5">
                        {dayItems.slice(0, 2).map((item, idx) => (
                            <div
                                key={idx}
                                className="text-[8px] md:text-[10px] px-1 py-0.5 border border-black font-bold truncate flex items-center gap-1"
                                style={{
                                    backgroundColor: isSelected ? '#ffffff' : item.colorBg,
                                    color: isSelected ? '#000000' : item.colorText
                                }}
                            >
                                {item.isAnnouncement && <Megaphone className="w-2 h-2" />}
                                {item.name}
                            </div>
                        ))}
                        {dayItems.length > 2 && (
                            <div className={`text-[8px] font-bold pl-1 ${isSelected ? 'text-gray-400' : 'text-gray-500'}`}>
                                +{dayItems.length - 2} más
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return cells;
    };

    return (
        <div className="flex flex-col lg:flex-row border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
            {/* Main Calendar */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Calendar Header */}
                <header className="flex items-center justify-between px-6 py-4 border-b-4 border-black bg-white gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-black text-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)]">
                            <CalendarIcon className="w-5 h-5" strokeWidth={2.5} />
                        </div>
                        <h2 className="text-2xl font-black text-black uppercase tracking-tighter">
                            {MONTHS_ES[month]} <span className="text-gray-400">{year}</span>
                        </h2>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrevMonth}
                            className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center border-2 border-black bg-white hover:bg-black hover:text-white transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none active:translate-y-0.5"
                        >
                            <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
                        </button>
                        <button
                            onClick={handleToday}
                            className="px-3 py-2 min-h-[40px] flex items-center justify-center text-xs font-black uppercase tracking-wider border-2 border-black bg-white hover:bg-black hover:text-white transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none"
                        >
                            Hoy
                        </button>
                        <button
                            onClick={handleNextMonth}
                            className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center border-2 border-black bg-white hover:bg-black hover:text-white transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none active:translate-y-0.5"
                        >
                            <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
                        </button>
                    </div>
                </header>

                {/* Day headers */}
                <div className="grid grid-cols-7 border-b-2 border-black bg-black text-white">
                    {DAYS_ES.map(day => (
                        <div key={day} className="py-2 text-center text-xs font-black uppercase tracking-widest">{day}</div>
                    ))}
                </div>

                {/* Grid */}
                <div className="grid grid-cols-7 flex-1 auto-rows-fr bg-white">
                    {renderGrid()}
                </div>
            </div>

            {/* Right Sidebar */}
            <aside className="w-full lg:w-80 bg-white border-t-4 lg:border-t-0 lg:border-l-4 border-black flex-shrink-0 flex flex-col">
                <div className="p-5 border-b-4 border-black bg-yellow-400">
                    <h3 className="text-xl font-black text-black uppercase tracking-tighter flex items-center gap-2">
                        Agenda
                        <span className="text-xs bg-black text-white px-2 py-0.5 border-2 border-black tracking-widest relative -top-1">HOY</span>
                    </h3>
                    <div className="flex items-center gap-2 mt-2 text-black font-bold border-2 border-black bg-white p-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                        <Clock className="w-4 h-4 text-black flex-shrink-0" strokeWidth={2.5} />
                        <span className="text-xs uppercase tracking-wide truncate">
                            {selectedDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[320px] lg:max-h-none">
                    {selectedDateItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 border-4 border-dashed border-slate-200">
                            <CalendarIcon className="w-10 h-10 text-slate-200 mb-3" />
                            <p className="text-slate-400 font-bold uppercase text-center text-xs tracking-widest">
                                Sin eventos<br />este día
                            </p>
                        </div>
                    ) : (
                        selectedDateItems.map(item => (
                            <div
                                key={item.id}
                                className="border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
                            >
                                {/* Color header */}
                                <div
                                    className="px-4 py-3"
                                    style={{ backgroundColor: item.colorBg }}
                                >
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        {item.type && (
                                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border border-black ${item.isAnnouncement ? 'bg-white text-black' : 'bg-black text-white'}`}>
                                                {item.type}
                                            </span>
                                        )}
                                        {item.isAnnouncement && <Megaphone className="w-3.5 h-3.5 text-white" />}
                                    </div>
                                    <h4 className={`font-black text-base uppercase leading-tight ${item.isAnnouncement ? 'text-white' : 'text-black'}`}>
                                        {item.name}
                                    </h4>
                                </div>
                                {/* Details */}
                                <div className="p-4 bg-white space-y-2">
                                    {item.startTime && (
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 border-2 border-black flex items-center justify-center bg-slate-100">
                                                <Clock className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="font-bold text-sm uppercase">
                                                {item.startTime}{item.endTime ? ` - ${item.endTime}` : ''} HS
                                            </span>
                                        </div>
                                    )}
                                    {item.description && (
                                        <div className="flex items-start gap-2">
                                            <div className="w-7 h-7 border-2 border-black flex items-center justify-center bg-slate-100 flex-shrink-0 mt-0.5">
                                                <Tag className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-xs font-bold text-slate-600 leading-relaxed">{item.description}</span>
                                        </div>
                                    )}
                                    {!item.isAnnouncement && (
                                        <button
                                            onClick={(e) => handleCopyEventLink(item.id, e)}
                                            className={`w-full mt-2 py-2 flex items-center justify-center gap-2 border-2 border-black text-xs font-black uppercase tracking-widest transition-all ${copiedEventId === item.id
                                                ? 'bg-black text-white'
                                                : 'bg-white text-black hover:bg-black hover:text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none'
                                            }`}
                                        >
                                            {copiedEventId === item.id
                                                ? <><Check className="w-3.5 h-3.5" /> ¡Link copiado!</>
                                                : <><Link className="w-3.5 h-3.5" /> Compartir evento</>
                                            }
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </aside>
        </div>
    );
};

export default InfoPointCalendar;
