import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bell,
    CheckCircle,
    Info,
    AlertTriangle,
    Star,
    CheckCheck,
    Inbox,
    Trash2,
} from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import type { AppNotification } from '../../hooks/useNotifications';

// ─── Utilidad: Fecha relativa ────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'Ahora mismo';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    if (diffHr < 24) return `Hace ${diffHr} h`;
    if (diffDay === 1) return 'Ayer';
    return `Hace ${diffDay} días`;
}

// ─── Icono dinámico por tipo ─────────────────────────────────────────────────

const NotifIcon: React.FC<{ type: string }> = ({ type }) => {
    switch (type) {
        case 'success':
            return <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />;
        case 'warning':
            return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
        case 'info':
        default:
            return <Info className="w-5 h-5 text-blue-500 shrink-0" />;
    }
};

// ─── Fila de notificación ────────────────────────────────────────────────────

interface NotifRowProps {
    notification: AppNotification;
    onRead: (id: string) => Promise<void>;
    onTogglePin: (id: string, current: boolean) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}

const NotifRow: React.FC<NotifRowProps> = ({ notification, onRead, onTogglePin, onDelete }) => {
    const navigate = useNavigate();
    const { id, title, message, type, is_read, is_pinned, created_at, action_url } = notification;

    const handleRowClick = async () => {
        if (!is_read) await onRead(id);
        if (action_url) navigate(action_url);
    };

    return (
        <div
            onClick={handleRowClick}
            className={`flex items-center gap-4 px-4 sm:px-6 py-3.5 cursor-pointer transition-colors duration-150 hover:bg-slate-50 dark:hover:bg-zinc-900 group border-b border-slate-100 dark:border-zinc-800 ${!is_read ? 'bg-blue-50/60 dark:bg-blue-950/20' : 'bg-white dark:bg-zinc-950'
                }`}
        >
            {/* Dot no leída */}
            <span className={`w-2 h-2 rounded-full shrink-0 ${!is_read ? 'bg-blue-500' : 'bg-transparent'}`} />

            {/* Icono tipo */}
            <NotifIcon type={type} />

            {/* Contenido */}
            <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${!is_read ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-600 dark:text-zinc-400'}`}>
                    {title}
                </p>
                <p className="text-xs text-gray-500 dark:text-zinc-500 truncate mt-0.5">
                    {message}
                </p>
            </div>

            {/* Fecha */}
            <span className="text-[11px] text-gray-400 dark:text-zinc-600 whitespace-nowrap shrink-0 hidden sm:block">
                {timeAgo(created_at)}
            </span>

            <div className="flex items-center gap-1 shrink-0">
                {/* Botón Pin/Estrella */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onTogglePin(id, is_pinned);
                    }}
                    title={is_pinned ? 'Desanclar' : 'Anclar'}
                    className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                    <Star
                        className={`w-4 h-4 transition-colors ${is_pinned
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300 dark:text-zinc-600 group-hover:text-gray-400'
                            }`}
                    />
                </button>

                {/* Botón Eliminar */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('¿Eliminar esta notificación?')) {
                            onDelete(id);
                        }
                    }}
                    title="Eliminar"
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

// ─── Página principal ────────────────────────────────────────────────────────

type TabId = 'todas' | 'no_leidas';

const Notifications: React.FC = () => {
    const { notifications, markAsRead, markAllAsRead, togglePin, deleteNotification, clearAllNotifications } = useNotifications();
    const [activeTab, setActiveTab] = useState<TabId>('todas');

    // Filtrar por tab
    const filtered = activeTab === 'no_leidas'
        ? notifications.filter(n => !n.is_read)
        : notifications;

    // Ordenar: fijadas primero
    const sorted = [...filtered].sort((a, b) => {
        if (a.is_pinned === b.is_pinned) return 0;
        return a.is_pinned ? -1 : 1;
    });

    const hasUnread = notifications.some(n => !n.is_read);

    const tabs: { id: TabId; label: string }[] = [
        { id: 'todas', label: 'Todas' },
        { id: 'no_leidas', label: 'No leídas' },
    ];

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-black dark:bg-white flex items-center justify-center">
                        <Bell className="w-5 h-5 text-white dark:text-black" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                            Bandeja de Notificaciones
                        </h1>
                        <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">
                            {notifications.length} total · {notifications.filter(n => !n.is_read).length} sin leer
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {hasUnread && (
                        <button
                            onClick={markAllAsRead}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-xs font-bold text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                        >
                            <CheckCheck className="w-3.5 h-3.5" />
                            Marcar todo como leído
                        </button>
                    )}
                    
                    {notifications.length > 0 && (
                        <button
                            onClick={() => {
                                if (window.confirm('¿Estás seguro de que deseas eliminar todas las notificaciones?')) {
                                    clearAllNotifications();
                                }
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 dark:border-red-900/30 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            Limpiar todo
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-0 border-b border-slate-200 dark:border-zinc-800">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-5 py-2.5 text-sm font-bold rounded-t-lg transition-colors relative ${activeTab === tab.id
                            ? 'text-gray-900 dark:text-white'
                            : 'text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'
                            }`}
                    >
                        {tab.label}
                        {activeTab === tab.id && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-black dark:bg-white rounded-full" />
                        )}
                    </button>
                ))}
            </div>

            {/* Lista */}
            <div className="bg-white dark:bg-zinc-950 rounded-b-2xl border border-t-0 border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                {sorted.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-8">
                        <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
                            <Inbox className="w-6 h-6 text-gray-400 dark:text-zinc-500" />
                        </div>
                        <p className="text-sm font-bold text-gray-700 dark:text-zinc-300">
                            {activeTab === 'no_leidas' ? 'Sin notificaciones sin leer' : 'Sin notificaciones'}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-zinc-600 leading-relaxed max-w-xs">
                            {activeTab === 'no_leidas'
                                ? 'Todo al día. Cambia a "Todas" para ver el historial.'
                                : 'Cuando haya actividad relevante, aparecerá aquí.'
                            }
                        </p>
                    </div>
                ) : (
                    sorted.map(n => (
                        <NotifRow
                            key={n.id}
                            notification={n}
                            onRead={markAsRead}
                            onTogglePin={togglePin}
                            onDelete={deleteNotification}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default Notifications;
