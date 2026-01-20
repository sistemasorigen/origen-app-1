import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    X, Bell, Check, CheckCheck,
    Users, Calendar, Shield, MessageSquare, AlertCircle, ExternalLink
} from 'lucide-react';
import {
    SystemNotification,
    NotificationPreferences,
    NotificationType,
    DEFAULT_NOTIFICATION_PREFERENCES,
    UserRole
} from '../types';

interface NotificationCenterProps {
    notifications: SystemNotification[];
    isOpen: boolean;
    onClose: () => void;
    onMarkAsRead: (id: string) => void;
    onMarkAllAsRead: () => void;
    preferences: NotificationPreferences;
    onPreferencesChange: (prefs: NotificationPreferences) => void;
    userRole?: UserRole | null; // User role for smart navigation
}

type FilterType = 'unread' | 'read';

// Category config with colors and icons
const CATEGORY_CONFIG: Record<NotificationType, { label: string; color: string; darkColor: string; icon: React.ReactNode }> = {
    SYSTEM: { label: 'Sistema', color: 'bg-slate-700', darkColor: 'dark:bg-slate-600', icon: <AlertCircle className="w-3 h-3" /> },
    REGISTRATION: { label: 'Registros', color: 'bg-slate-700', darkColor: 'dark:bg-slate-600', icon: <Users className="w-3 h-3" /> },
    INQUIRY: { label: 'Consultas', color: 'bg-slate-700', darkColor: 'dark:bg-slate-600', icon: <MessageSquare className="w-3 h-3" /> },
    GROUPS: { label: 'Grupos', color: 'bg-slate-700', darkColor: 'dark:bg-slate-600', icon: <Users className="w-3 h-3" /> },
    EVENTS: { label: 'Eventos', color: 'bg-slate-700', darkColor: 'dark:bg-slate-600', icon: <Calendar className="w-3 h-3" /> },
    ADMIN: { label: 'Admin', color: 'bg-slate-700', darkColor: 'dark:bg-slate-600', icon: <Shield className="w-3 h-3" /> },
};

const NotificationCenter: React.FC<NotificationCenterProps> = ({
    notifications,
    isOpen,
    onClose,
    onMarkAsRead,
    onMarkAllAsRead,
    preferences,
    onPreferencesChange,
    userRole,
}) => {
    const navigate = useNavigate();
    const [activeFilter, setActiveFilter] = useState<FilterType>('unread');

    // Handle notification click with smart navigation based on role
    const handleNotificationClick = (notif: SystemNotification) => {
        // 1. Mark as read
        if (!notif.read) {
            onMarkAsRead(notif.id);
        }

        // 2. Smart navigation based on role and notification type
        let targetRoute: string | null = null;

        if (notif.type === 'GROUPS' || notif.type === 'ADMIN') {
            // Host: Navigate to Host Dashboard to see group status
            if (userRole === UserRole.ANFITRION) {
                targetRoute = '/host-dashboard';
            }
            // Admin: Navigate to Groups admin panel to review
            else if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN_GROUPS || userRole === UserRole.PASTOR) {
                targetRoute = '/groups'; // Groups page has admin panel
            }
        }

        // 3. Navigate if route determined
        if (targetRoute) {
            navigate(targetRoute);
            onClose(); // Close the notification panel
        }
    };

    // Filter notifications based on read/unread status
    const filteredNotifications = useMemo(() => {
        let result = notifications;

        // Filter by enabled categories in preferences
        result = result.filter(n => preferences.categories[n.type]);

        // Filter by read/unread status
        if (activeFilter === 'unread') {
            result = result.filter(n => !n.read);
        } else {
            result = result.filter(n => n.read);
        }

        // Sort by timestamp (newest first)
        result = [...result].sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        return result;
    }, [notifications, preferences, activeFilter]);

    const unreadCount = notifications.filter(n => !n.read && preferences.categories[n.type]).length;
    const readCount = notifications.filter(n => n.read && preferences.categories[n.type]).length;

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Ahora';
        if (minutes < 60) return `Hace ${minutes}m`;
        if (hours < 24) return `Hace ${hours}h`;
        if (days < 7) return `Hace ${days}d`;
        return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Panel - Origen Style - Mobile: Full width drawer from top, Desktop: Dropdown */}
            <div className="fixed md:absolute inset-x-0 md:inset-x-auto top-0 md:top-12 md:right-0 w-full md:w-96 md:max-w-[calc(100vw-2rem)] bg-slate-100 dark:bg-zinc-900 md:rounded-3xl shadow-2xl border-b md:border border-slate-300 dark:border-zinc-700 z-50 overflow-hidden animate-fadeIn">

                {/* Header */}
                <div className="p-4 md:p-5 border-b border-slate-300 dark:border-zinc-700">
                    <div className="flex items-center justify-between mb-3 md:mb-4">
                        <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-8 md:w-10 h-8 md:h-10 bg-black dark:bg-white rounded-lg md:rounded-xl flex items-center justify-center">
                                <Bell className="w-4 md:w-5 h-4 md:h-5 text-white dark:text-black" />
                            </div>
                            <div>
                                <h3 className="font-black text-black dark:text-white uppercase tracking-tight text-base md:text-lg">Notificaciones</h3>
                                {unreadCount > 0 && (
                                    <span className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                                        {unreadCount} sin leer
                                    </span>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg md:rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors border border-slate-300 dark:border-zinc-700"
                        >
                            <X className="w-4 h-4 text-slate-600 dark:text-zinc-400" />
                        </button>
                    </div>

                    {/* Filter Tabs - Unread / Read */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveFilter('unread')}
                            className={`flex-1 flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 md:py-2.5 text-[10px] md:text-xs font-bold uppercase tracking-wider rounded-lg md:rounded-xl transition-all border ${activeFilter === 'unread'
                                ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                                : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-300 dark:border-zinc-700 hover:bg-slate-300 dark:hover:bg-zinc-700'
                                }`}
                        >
                            No Leídos
                            {unreadCount > 0 && (
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] md:text-[10px] ${activeFilter === 'unread'
                                    ? 'bg-white dark:bg-black text-black dark:text-white'
                                    : 'bg-slate-400 dark:bg-zinc-600 text-white'
                                    }`}>
                                    {unreadCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveFilter('read')}
                            className={`flex-1 flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 md:py-2.5 text-[10px] md:text-xs font-bold uppercase tracking-wider rounded-lg md:rounded-xl transition-all border ${activeFilter === 'read'
                                ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                                : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-300 dark:border-zinc-700 hover:bg-slate-300 dark:hover:bg-zinc-700'
                                }`}
                        >
                            Leídos
                        </button>
                    </div>
                </div>

                {/* Mark All as Read - Only show when viewing unread */}
                {activeFilter === 'unread' && unreadCount > 0 && (
                    <button
                        onClick={onMarkAllAsRead}
                        className="w-full px-4 md:px-5 py-2.5 md:py-3 text-[10px] md:text-xs font-bold text-black dark:text-white uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-zinc-800 flex items-center justify-center gap-2 border-b border-slate-300 dark:border-zinc-700 transition-colors"
                    >
                        <CheckCheck className="w-3.5 md:w-4 h-3.5 md:h-4" />
                        Marcar todas como leídas
                    </button>
                )}

                {/* Notifications List */}
                <div className="max-h-[60vh] md:max-h-80 overflow-y-auto">
                    {filteredNotifications.length === 0 ? (
                        <div className="p-8 md:p-10 text-center">
                            <div className="w-14 md:w-16 h-14 md:h-16 bg-slate-200 dark:bg-zinc-800 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto mb-3 md:mb-4">
                                <Bell className="w-6 md:w-8 h-6 md:h-8 text-slate-400 dark:text-zinc-600" />
                            </div>
                            <p className="text-xs md:text-sm font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">
                                {activeFilter === 'unread' ? 'No hay notificaciones sin leer' : 'No hay notificaciones leídas'}
                            </p>
                        </div>
                    ) : (
                        filteredNotifications.map(notif => (
                            <div
                                key={notif.id}
                                onClick={() => handleNotificationClick(notif)}
                                className={`p-3 md:p-4 border-b border-slate-200 dark:border-zinc-800 last:border-0 hover:bg-slate-200/80 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer group ${!notif.read ? 'bg-white dark:bg-zinc-800/50' : ''
                                    }`}
                            >
                                <div className="flex items-start gap-2.5 md:gap-3">
                                    {/* Category Badge */}
                                    <div className={`w-8 md:w-10 h-8 md:h-10 rounded-lg md:rounded-xl bg-slate-700 dark:bg-zinc-700 flex items-center justify-center text-white flex-shrink-0`}>
                                        {CATEGORY_CONFIG[notif.type].icon}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-0.5 md:mb-1">
                                            <p className="font-bold text-xs md:text-sm text-black dark:text-white truncate uppercase tracking-tight">
                                                {notif.title}
                                            </p>
                                            <div className="flex items-center gap-1 md:gap-1.5 flex-shrink-0">
                                                <span className="text-[9px] md:text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase">
                                                    {formatTimestamp(notif.timestamp)}
                                                </span>
                                                {notif.read && <Check className="w-3 h-3 text-emerald-500" />}
                                            </div>
                                        </div>
                                        <p className="text-[10px] md:text-xs text-slate-600 dark:text-zinc-400 line-clamp-2">
                                            {notif.message}
                                        </p>
                                        <div className="flex items-center justify-between mt-1.5 md:mt-2">
                                            <span className="text-[9px] md:text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                                                {CATEGORY_CONFIG[notif.type].label}
                                            </span>
                                            {/* Navigation hint */}
                                            {(notif.type === 'GROUPS' || notif.type === 'ADMIN') && (
                                                <span className="flex items-center gap-1 text-[9px] font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity uppercase">
                                                    <ExternalLink className="w-3 h-3" />
                                                    Ver
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
};

export default NotificationCenter;
