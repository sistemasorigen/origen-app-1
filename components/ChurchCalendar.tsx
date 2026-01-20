
import React, { useState, useEffect } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    X,
    Clock,
    MapPin,
    AlignLeft,
    MoreHorizontal,
    Trash2,
    Calendar as CalendarIcon,
    Bell,
    BookOpen,
    Heart,
    Hand,
    Snowflake,
    Star,
    TreePine,
    Link as LinkIcon,
    Copy,
    Check,
    ExternalLink,
    QrCode
} from 'lucide-react';
import NeoModal from './NeoModal';
import { AppEvent, EventType } from '../types';

// --- STYLES & CONFIG ---
const THEME = {
    colors: {
        gold: '#D4AF37',
        blue: '#1E3A8A',
        blueDark: '#172554',
        white: '#FFFFFF',
        textDark: '#1e293b',
        textLight: '#f1f5f9',
    },
    shadow: 'shadow-[0_10px_40px_-10px_rgba(30,58,138,0.2)]'
};

const EVENT_COLORS: Record<EventType, string> = {
    [EventType.CULTO]: '#DC2626', // Red
    [EventType.AYUNO]: '#7C3AED', // Purple
    [EventType.RETIRO]: '#0891B2', // Cyan
    [EventType.CONFERENCIA]: '#2563EB', // Blue
    [EventType.ORACION]: '#7C3AED', // Purple
    [EventType.ESTUDIO]: '#059669', // Green
    [EventType.SERVICIO]: '#F59E0B', // Amber
    [EventType.SOCIAL]: '#EC4899', // Pink
    [EventType.OTRO]: '#64748B' // Gray
};

const EVENT_ICONS: Record<EventType, React.ReactNode> = {
    [EventType.CULTO]: <Bell className="w-3 h-3" />,
    [EventType.AYUNO]: <Hand className="w-3 h-3" />,
    [EventType.RETIRO]: <MapPin className="w-3 h-3" />,
    [EventType.CONFERENCIA]: <CalendarIcon className="w-3 h-3" />,
    [EventType.ORACION]: <Hand className="w-3 h-3" />,
    [EventType.ESTUDIO]: <BookOpen className="w-3 h-3" />,
    [EventType.SERVICIO]: <Heart className="w-3 h-3" />,
    [EventType.SOCIAL]: <Heart className="w-3 h-3" />,
    [EventType.OTRO]: <CalendarIcon className="w-3 h-3" />
};

interface ChurchCalendarProps {
    events: AppEvent[];
    onAddEvent?: (event: Partial<AppEvent>) => void;
    onUpdateEvent?: (event: AppEvent) => void;
    onDeleteEvent?: (id: string) => void;
    readOnly?: boolean;
}

// --- UTILS ---
const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

// --- COMPONENTS ---

export const ChurchCalendar: React.FC<ChurchCalendarProps> = ({
    events,
    onAddEvent,
    onUpdateEvent,
    onDeleteEvent,
    readOnly = false
}) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedDayEvents, setSelectedDayEvents] = useState<AppEvent[]>([]);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);

    // Form State
    const [editingEvent, setEditingEvent] = useState<Partial<AppEvent>>({});

    // Decoration Logic
    const isDecember = currentDate.getMonth() === 11;

    // --- NAVIGATION ---
    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    const goToToday = () => setCurrentDate(new Date());

    // --- HELPER: ROBUST DATE COMPARISON ---
    // Compares YYYY-MM-DD string against current calendar view without timezone shifts
    const isEventOnDay = (eventDateStr: string, day: number, currentMonthIndex: number, currentYear: number) => {
        if (!eventDateStr) return false;
        const [y, m, d] = eventDateStr.split('-').map(Number);
        return d === day && m === (currentMonthIndex + 1) && y === currentYear;
    };

    // --- ACTIONS ---
    const handleDayClick = (day: number) => {
        const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);

        // Find events for this day using robust string comparison
        const dayEvents = events.filter(e =>
            isEventOnDay(e.date, day, currentDate.getMonth(), currentDate.getFullYear())
        );

        if (readOnly) {
            if (dayEvents.length > 0) {
                setSelectedDate(clickedDate);
                setSelectedDayEvents(dayEvents);
                setDetailsOpen(true);
            }
            return;
        }

        // Admin Mode logic
        setSelectedDate(clickedDate);
        if (dayEvents.length > 0) {
            // Show list first if events exist
            setSelectedDayEvents(dayEvents);
            setDetailsOpen(true);
        } else {
            // Open create modal immediately if empty
            openCreateModal(clickedDate);
        }
    };

    const openCreateModal = (date?: Date) => {
        const targetDate = date || selectedDate || new Date();
        // Correct timezone offset for input type="date" to ensure the form shows the clicked date
        const localDate = new Date(targetDate.getTime() - (targetDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

        setEditingEvent({
            date: localDate,
            startTime: '10:00',
            endTime: '12:00',
            type: EventType.CULTO,
            color: EVENT_COLORS[EventType.CULTO]
        });
        setModalOpen(true);
        setDetailsOpen(false);
    };

    const handleEditEvent = (event: AppEvent) => {
        // Use the raw date string from the event to avoid timezone shifts
        setEditingEvent({ ...event });
        setModalOpen(true);
        setDetailsOpen(false);
    };

    const saveEvent = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingEvent.name || !editingEvent.date) return;

        // Auto-Generate QR if not present (Feature Request)
        let qrCodeUrl = editingEvent.qrCodeUrl;
        if (!qrCodeUrl) {
            const qrData = editingEvent.link ? editingEvent.link : `${editingEvent.name} - ${editingEvent.date} ${editingEvent.startTime || ''}`;
            const encodedData = encodeURIComponent(qrData);
            qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedData}`;
        }

        const eventData = {
            ...editingEvent,
            qrCodeUrl, // Ensure generated QR is saved
            color: editingEvent.type ? EVENT_COLORS[editingEvent.type as EventType] : '#000'
        };

        if (editingEvent.id && onUpdateEvent) {
            onUpdateEvent(eventData as AppEvent);
        } else if (onAddEvent) {
            onAddEvent(eventData);
        }
        setModalOpen(false);
    };

    const handleDelete = (id: string) => {
        if (confirm('¿Eliminar este evento?') && onDeleteEvent) {
            onDeleteEvent(id);
            // Update details list locally or close if empty
            const updated = selectedDayEvents.filter(e => e.id !== id);
            setSelectedDayEvents(updated);
            if (updated.length === 0) setDetailsOpen(false);
        }
    };

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // --- RENDER HELPERS ---
    const renderDays = () => {
        const totalDays = getDaysInMonth(currentDate);
        const startDay = getFirstDayOfMonth(currentDate);
        const days = [];

        // Empty cells for previous month
        for (let i = 0; i < startDay; i++) {
            days.push(
                <div
                    key={`empty-${i}`}
                    className="h-24 md:h-32 bg-slate-100 dark:bg-slate-900/30 opacity-70"
                />
            );
        }

        // Days of current month
        for (let d = 1; d <= totalDays; d++) {
            const isToday =
                d === new Date().getDate() &&
                currentDate.getMonth() === new Date().getMonth() &&
                currentDate.getFullYear() === new Date().getFullYear();

            // Find events using string comparison
            const dayEvents = events.filter(e =>
                isEventOnDay(e.date, d, currentDate.getMonth(), currentDate.getFullYear())
            );

            days.push(
                <div
                    key={d}
                    onClick={() => handleDayClick(d)}
                    className={`h-24 md:h-32 p-2 relative group transition-all duration-200 cursor-pointer 
                ${isToday
                            ? (isDecember ? 'bg-red-50 dark:bg-red-900/10' : 'bg-amber-50 dark:bg-[#1E3A8A]/20')
                            : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'}
            `}
                >
                    {/* Christmas Background Decorations */}
                    {isDecember && (
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            <div className={`absolute bottom-2 right-2 opacity-20 transform ${d % 2 === 0 ? 'scale-110' : 'scale-90'}`}>
                                {d % 2 === 0 ? (
                                    <TreePine className="w-8 h-8 text-green-700 dark:text-green-500" />
                                ) : (
                                    <Star className="w-6 h-6 text-yellow-500 dark:text-yellow-400 fill-current" />
                                )}
                            </div>
                            {d % 5 === 0 && (
                                <div className="absolute top-2 right-8 opacity-10">
                                    <Star className="w-3 h-3 text-red-400" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Top Bar (Day Number) */}
                    <div className="flex justify-between items-start mb-1 relative z-10">
                        <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full transition-colors 
                    ${isToday
                                ? (isDecember ? 'bg-red-600 text-white shadow-lg scale-110' : 'bg-[#D4AF37] text-white shadow-lg scale-110')
                                : 'text-slate-900 dark:text-slate-200 group-hover:bg-slate-200 dark:group-hover:bg-white/10'
                            }
                `}>
                            {d}
                        </span>
                        {!readOnly && (
                            <button
                                onClick={(e) => { e.stopPropagation(); openCreateModal(new Date(currentDate.getFullYear(), currentDate.getMonth(), d)); }}
                                className="opacity-0 group-hover:opacity-100 text-slate-600 dark:text-slate-400 hover:text-[#D4AF37] transition-opacity"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Events Pills (Desktop) */}
                    <div className="hidden md:flex flex-col gap-1 overflow-hidden max-h-[calc(100%-2rem)] relative z-10">
                        {dayEvents.slice(0, 3).map((ev, idx) => (
                            <div key={idx} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md text-white font-medium shadow-sm truncate" style={{ backgroundColor: ev.color || EVENT_COLORS.Otro }}>
                                {ev.type && EVENT_ICONS[ev.type] && <span className="opacity-80">{EVENT_ICONS[ev.type]}</span>}
                                <span className="truncate">{ev.name}</span>
                            </div>
                        ))}
                        {dayEvents.length > 3 && (
                            <div className="text-[10px] text-slate-600 dark:text-slate-500 font-bold pl-1">
                                +{dayEvents.length - 3} más...
                            </div>
                        )}
                    </div>

                    {/* Events Dots (Mobile) */}
                    <div className="md:hidden flex flex-wrap gap-1 content-end justify-center absolute bottom-2 left-1 right-1 z-10">
                        {dayEvents.slice(0, 5).map((ev, idx) => (
                            <div key={idx} className="w-1.5 h-1.5 rounded-full shadow-sm" style={{ backgroundColor: ev.color || EVENT_COLORS.Otro }} />
                        ))}
                        {dayEvents.length > 5 && (
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        )}
                    </div>

                    {/* Today highlight border */}
                    {isToday && <div className={`absolute inset-0 border-2 ${isDecember ? 'border-red-500' : 'border-[#D4AF37]'} pointer-events-none rounded-none`} />}
                </div>
            );
        }

        return days;
    };

    return (
        <div className={`w-full mx-auto bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border transition-colors duration-500 ${isDecember ? 'border-green-800 dark:border-green-900' : 'border-slate-300 dark:border-slate-800'} ${THEME.shadow}`}>

            {/* HEADER */}
            <div className={`relative p-6 border-b-4 transition-all duration-700 ease-in-out overflow-hidden ${isDecember
                ? 'bg-gradient-to-r from-red-900 via-red-800 to-green-900 border-green-600'
                : 'bg-[#1E3A8A] border-[#D4AF37]'
                }`}>

                {/* BACKGROUND DECORATIONS (Only December) */}
                {isDecember ? (
                    <div className="absolute inset-0 pointer-events-none">
                        {/* Snow Texture */}
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/snow.png')] opacity-20"></div>
                        {/* Floating Snowflakes */}
                        <div className="absolute top-[-10px] right-[10%] text-white/10 animate-pulse duration-[3000ms]"><Snowflake className="w-24 h-24 rotate-12" /></div>
                        <div className="absolute bottom-[-10px] left-[5%] text-white/10 animate-bounce duration-[5000ms]"><Snowflake className="w-16 h-16 -rotate-12" /></div>
                        <div className="absolute top-4 left-1/4 text-white/20 animate-pulse"><Snowflake className="w-4 h-4" /></div>
                        <div className="absolute top-10 right-1/4 text-white/20 animate-pulse delay-500"><Snowflake className="w-6 h-6" /></div>
                        <div className="absolute top-2 right-10 text-white/10"><Snowflake className="w-8 h-8" /></div>
                    </div>
                ) : (
                    // Standard Pattern
                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                )}

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-4 text-white">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-colors duration-500 ${isDecember ? 'bg-white text-red-700' : 'bg-[#D4AF37] text-[#1E3A8A]'}`}>
                            {isDecember ? <Snowflake className="w-6 h-6" /> : <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L15 8H9L12 2ZM12 22V8M8 12H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </div>
                        <div>
                            <h2 className="text-2xl font-serif font-bold tracking-wide uppercase drop-shadow-md">Calendario</h2>
                            <p className={`text-xs font-medium tracking-widest uppercase ${isDecember ? 'text-red-100' : 'text-blue-200'}`}>Comunidad Origen</p>
                        </div>
                    </div>

                    <div className={`flex items-center gap-4 p-1.5 rounded-xl border shadow-inner transition-colors duration-500 ${isDecember ? 'bg-black/30 border-white/10' : 'bg-[#172554] border-blue-700/50'}`}>
                        <button onClick={prevMonth} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                        <span className="w-40 text-center font-bold text-lg select-none">
                            {months[currentDate.getMonth()]} {currentDate.getFullYear()}
                        </span>
                        <button onClick={nextMonth} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><ChevronRight className="w-5 h-5" /></button>
                    </div>

                    <button
                        onClick={goToToday}
                        className={`px-4 py-2 font-bold rounded-lg text-sm transition-colors shadow-lg ${isDecember
                            ? 'bg-white text-green-800 hover:bg-green-100'
                            : 'bg-[#D4AF37] text-[#1E3A8A] hover:bg-[#b8952b]'
                            }`}
                    >
                        Hoy
                    </button>
                </div>
            </div>

            {/* DAYS HEADER */}
            <div className={`grid grid-cols-7 border-b transition-colors duration-500 ${isDecember ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20' : 'bg-slate-100 dark:bg-black/20 border-slate-300 dark:border-white/5'}`}>
                {daysOfWeek.map(day => (
                    <div key={day} className={`py-3 text-center text-xs font-bold uppercase tracking-wider ${isDecember ? 'text-red-800 dark:text-red-300' : 'text-slate-900 dark:text-slate-400'}`}>
                        {day}
                    </div>
                ))}
            </div>

            {/* GRID */}
            {/* Uses gap-px to create grid lines. Container background color dictates line color */}
            <div className={`grid grid-cols-7 gap-px border-b ${isDecember ? 'bg-red-200 dark:bg-red-900/30 border-red-200' : 'bg-slate-300 dark:bg-slate-700 border-slate-300'}`}>
                {renderDays()}
            </div>

            {/* MODAL: CREATE / EDIT */}
            <NeoModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editingEvent.id ? 'Editar Evento' : 'Nuevo Evento'}
            >
                <form onSubmit={saveEvent} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Título</label>
                        <input
                            type="text" required
                            value={editingEvent.name || ''}
                            onChange={e => setEditingEvent({ ...editingEvent, name: e.target.value })}
                            className={`w-full p-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ${isDecember ? 'focus:ring-red-500' : 'focus:ring-[#D4AF37]'}`}
                            placeholder="Ej. Culto Dominical"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Fecha</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    readOnly
                                    value={editingEvent.date ? editingEvent.date.split('-').reverse().join('/') : ''}
                                    placeholder="DD/MM/AAAA"
                                    className="w-full p-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl outline-none pointer-events-none"
                                />
                                <input
                                    type="date" required
                                    value={editingEvent.date || ''}
                                    onChange={e => setEditingEvent({ ...editingEvent, date: e.target.value })}
                                    className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Tipo</label>
                            <select
                                value={editingEvent.type || EventType.CULTO}
                                onChange={e => setEditingEvent({ ...editingEvent, type: e.target.value as EventType })}
                                className="w-full p-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                            >
                                {Object.values(EventType).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Inicio</label>
                            <input
                                type="time" required
                                value={editingEvent.startTime || ''}
                                onChange={e => setEditingEvent({ ...editingEvent, startTime: e.target.value })}
                                className="w-full p-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Fin</label>
                            <input
                                type="time" required
                                value={editingEvent.endTime || ''}
                                onChange={e => setEditingEvent({ ...editingEvent, endTime: e.target.value })}
                                className="w-full p-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Link / Enlace (Opcional)</label>
                        <div className="relative">
                            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={editingEvent.link || ''}
                                onChange={e => setEditingEvent({ ...editingEvent, link: e.target.value })}
                                className="w-full pl-10 p-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                placeholder="https://..."
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Descripción</label>
                        <textarea
                            value={editingEvent.description || ''}
                            onChange={e => setEditingEvent({ ...editingEvent, description: e.target.value })}
                            className="w-full p-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl outline-none h-24 resize-none"
                            placeholder="Detalles del evento..."
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-white/5">
                        <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg">Cancelar</button>
                        <button type="submit" className={`px-6 py-2 text-white font-bold rounded-lg shadow-lg ${isDecember ? 'bg-red-700 hover:bg-red-800' : 'bg-[#1E3A8A] hover:bg-[#172554]'}`}>Guardar</button>
                    </div>
                </form>
            </NeoModal>

            {/* MODAL: DETAILS LIST (UPDATED FOR DETAILS VIEW) */}
            <NeoModal
                isOpen={detailsOpen}
                onClose={() => setDetailsOpen(false)}
                title="Eventos del Día"
            >
                <div className="flex flex-col h-full -mx-1 px-1">
                    {/* Header Info & Actions (Moved inside) */}
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-slate-500 font-bold uppercase text-xs">{selectedDate?.toLocaleDateString()}</p>
                        {!readOnly && (
                            <button
                                onClick={() => openCreateModal(selectedDate || undefined)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase text-white shadow-lg transform active:scale-95 transition-all ${isDecember ? 'bg-green-700 hover:bg-green-800' : 'bg-[#D4AF37] hover:bg-[#b8952b]'}`}
                            >
                                <Plus className="w-3 h-3" />
                                Agregar Evento
                            </button>
                        )}
                    </div>

                    <div className="space-y-3 overflow-y-auto pb-2">
                        {selectedDayEvents.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">No hay eventos este día.</div>
                        ) : (
                            selectedDayEvents.map(ev => (
                                <div key={ev.id} className="bg-slate-50 dark:bg-black/20 p-4 rounded-xl border-l-4 shadow-sm group hover:bg-white dark:hover:bg-white/5 transition-colors relative mb-2" style={{ borderLeftColor: ev.color || EVENT_COLORS.Otro }}>

                                    {/* Header & Title */}
                                    <div className="flex justify-between items-start">
                                        <div className="w-full">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase text-white`} style={{ backgroundColor: ev.color || EVENT_COLORS.Otro }}>
                                                    {ev.type}
                                                </span>
                                                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1 bg-white dark:bg-white/10 px-2 py-0.5 rounded border border-slate-200 dark:border-white/5">
                                                    <Clock className="w-3 h-3" /> {ev.startTime || '--:--'} - {ev.endTime || '--:--'}
                                                </span>
                                            </div>
                                            <h4 className="font-bold text-slate-800 dark:text-white text-xl mb-1">{ev.name}</h4>
                                            {ev.description && <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{ev.description}</p>}

                                            {/* Link / QR Action Section */}
                                            {(ev.link || ev.qrCodeUrl) && (
                                                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/5 flex items-center justify-between">
                                                    <div className="flex items-center gap-2 text-xs text-slate-500 overflow-hidden">
                                                        {ev.link ? <LinkIcon className="w-3 h-3 flex-shrink-0" /> : <Copy className="w-3 h-3 flex-shrink-0" />}
                                                        <span className="truncate max-w-[180px]">{ev.link || 'Copiar info del evento'}</span>
                                                    </div>

                                                    <div className="flex gap-2">
                                                        {ev.qrCodeUrl && (
                                                            <button
                                                                onClick={() => setQrPreviewUrl(ev.qrCodeUrl)}
                                                                className="p-1.5 bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
                                                                title="Ver QR"
                                                            >
                                                                <QrCode className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {ev.link && (
                                                            <a
                                                                href={ev.link}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                                                                title="Abrir enlace"
                                                            >
                                                                <ExternalLink className="w-4 h-4" />
                                                            </a>
                                                        )}
                                                        <button
                                                            onClick={() => handleCopy(ev.link || `${ev.name} - ${ev.date}`, ev.id)}
                                                            className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 font-bold text-xs ${copiedId === ev.id ? 'bg-green-100 text-green-700' : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-300'}`}
                                                            title="Copiar al portapapeles"
                                                        >
                                                            {copiedId === ev.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                            {copiedId === ev.id ? 'Copiado' : 'Copiar'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {!readOnly && (
                                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                            <button onClick={() => handleEditEvent(ev)} className="p-2 bg-white dark:bg-slate-700 text-slate-500 hover:text-blue-600 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600"><MoreHorizontal className="w-4 h-4" /></button>
                                            <button onClick={() => handleDelete(ev.id)} className="p-2 bg-white dark:bg-slate-700 text-slate-500 hover:text-red-600 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </NeoModal>

            {/* MODAL: QR PREVIEW */}
            <NeoModal
                isOpen={!!qrPreviewUrl}
                onClose={() => setQrPreviewUrl(null)}
                title="Código QR"
            >
                <div className="flex flex-col items-center gap-4 py-4">
                    <div className="bg-white p-2 rounded-xl shadow-inner border border-slate-100">
                        {qrPreviewUrl && <img src={qrPreviewUrl} alt="QR Code" className="w-64 h-64 object-contain" />}
                    </div>
                    <button
                        onClick={() => setQrPreviewUrl(null)}
                        className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 uppercase text-sm"
                    >
                        Cerrar
                    </button>
                </div>
            </NeoModal>

        </div>
    );
};
