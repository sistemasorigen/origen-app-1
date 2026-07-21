
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
        const url = `${window.location.origin}/#/punto-de-informacion?eventId=${eventId}`;
        const fallbackCopy = () => {
            const input = document.createElement('input');
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setCopiedEventId(eventId);
            setTimeout(() => setCopiedEventId(null), 2000);
        };
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(url).then(() => {
                setCopiedEventId(eventId);
                setTimeout(() => setCopiedEventId(null), 2000);
            }).catch(fallbackCopy);
        } else {
            fallbackCopy();
        }
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
                <div key={`prev-${i}`} className="min-h-[70px] md:min-h-[100px] p-2 border-b border-r border-slate-200 bg-slate-50/50">
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
                <button
                    key={`curr-${d}`}
                    type="button"
                    onClick={() => setSelectedDate(new Date(year, month, d))}
                    aria-current={isToday ? 'date' : undefined}
                    aria-label={`${d} de ${MONTHS_ES[month]}${dayItems.length > 0 ? `, ${dayItems.length} evento${dayItems.length > 1 ? 's' : ''}` : ''}`}
                    className={`min-h-[70px] md:min-h-[100px] w-full p-2 border-b border-r border-slate-200 transition-all cursor-pointer group relative hover:bg-slate-50 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400 ${isSelected ? 'bg-slate-50' : 'bg-white'}`}
                >
                    <div className="flex justify-between items-start">
                        <span className={`w-7 h-7 flex items-center justify-center font-bold text-sm rounded-full transition-all ${isToday ? 'bg-black text-white' :
                            isSelected ? 'bg-slate-200 text-black' :
                                'text-slate-700 group-hover:bg-slate-200'
                            }`}>
                            {d}
                        </span>
                    </div>

                    <div className="mt-1 flex flex-col gap-0.5">
                        {dayItems.slice(0, 2).map((item, idx) => (
                            <div
                                key={idx}
                                className="text-[8px] md:text-[10px] px-1.5 py-0.5 rounded font-medium truncate flex items-center gap-1"
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
                            <div className="text-[8px] font-bold pl-1 text-slate-500">
                                +{dayItems.length - 2} más
                            </div>
                        )}
                    </div>
                </button>
            );
        }

        return cells;
    };

    return (
        <div className="flex flex-col lg:flex-row border border-slate-200 rounded-2xl shadow-sm bg-white overflow-hidden">
            {/* Main Calendar */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Calendar Header */}
                <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-black text-white rounded-lg shadow-sm">
                            <CalendarIcon className="w-5 h-5" strokeWidth={2.5} />
                        </div>
                        <h2 className="text-2xl font-black text-black uppercase tracking-tighter">
                            {MONTHS_ES[month]} <span className="text-gray-400">{year}</span>
                        </h2>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrevMonth}
                            aria-label="Mes anterior"
                            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center border border-slate-200 rounded-lg bg-white hover:bg-slate-100 transition-all shadow-sm active:translate-y-0.5 text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                        >
                            <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
                        </button>
                        <button
                            onClick={handleToday}
                            className="px-3 min-h-[44px] flex items-center justify-center text-xs font-bold uppercase tracking-wider border border-slate-200 rounded-lg bg-white hover:bg-slate-100 transition-all shadow-sm text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                        >
                            Hoy
                        </button>
                        <button
                            onClick={handleNextMonth}
                            aria-label="Mes siguiente"
                            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center border border-slate-200 rounded-lg bg-white hover:bg-slate-100 transition-all shadow-sm active:translate-y-0.5 text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                        >
                            <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
                        </button>
                    </div>
                </header>

                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-slate-500">
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
            <aside className="w-full lg:w-80 bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-200 flex-shrink-0 flex flex-col">
                <div className="p-5 border-b border-slate-200 bg-white">
                    <h3 className="text-xl font-black text-black uppercase tracking-tighter flex items-center gap-2">
                        Agenda
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full tracking-widest relative -top-1 font-bold">HOY</span>
                    </h3>
                    <div className="flex items-center gap-2 mt-2 text-slate-700 font-bold bg-slate-100 rounded-lg p-2">
                        <Clock className="w-4 h-4 text-black flex-shrink-0" strokeWidth={2.5} />
                        <span className="text-xs uppercase tracking-wide truncate">
                            {selectedDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[320px] lg:max-h-none">
                    {selectedDateItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 border border-dashed border-slate-200 rounded-xl bg-white">
                            <CalendarIcon className="w-10 h-10 text-slate-200 mb-3" />
                            <p className="text-slate-400 font-bold uppercase text-center text-xs tracking-widest">
                                Sin eventos<br />este día
                            </p>
                        </div>
                    ) : (
                        selectedDateItems.map(item => (
                            <div
                                key={item.id}
                                className="border border-slate-200 rounded-xl shadow-sm overflow-hidden bg-white"
                            >
                                {/* Color header */}
                                <div
                                    className="px-4 py-3"
                                    style={{ backgroundColor: item.colorBg }}
                                >
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        {item.type && (
                                            <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${item.isAnnouncement ? 'bg-white/20 text-white' : 'bg-black/10 text-black'}`}>
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
                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-50 text-slate-500">
                                                <Clock className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="font-bold text-sm uppercase">
                                                {item.startTime}{item.endTime ? ` - ${item.endTime}` : ''} HS
                                            </span>
                                        </div>
                                    )}
                                    {item.description && (
                                        <div className="flex items-start gap-2">
                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-50 text-slate-500 flex-shrink-0 mt-0.5">
                                                <Tag className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-xs font-bold text-slate-600 leading-relaxed">{item.description}</span>
                                        </div>
                                    )}
                                    {!item.isAnnouncement && (
                                        <button
                                            onClick={(e) => handleCopyEventLink(item.id, e)}
                                            className={`w-full mt-2 py-2 flex items-center justify-center gap-2 border border-slate-200 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${copiedEventId === item.id
                                                ? 'bg-emerald-500 text-white border-emerald-500'
                                                : 'bg-white text-slate-600 hover:bg-slate-50 shadow-sm'
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
