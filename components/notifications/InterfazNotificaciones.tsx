import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bell,
    X,
    CheckCircle,
    Info,
    AlertTriangle,
    BellOff,
    Pin,
    PinOff,
    CheckCheck,
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
            return <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />;
        case 'warning':
            return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />;
        case 'info':
        default:
            return <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />;
    }
};

// ─── NotificationItem (interno) ──────────────────────────────────────────────

interface NotificationItemProps {
    notification: AppNotification;
    onRead: (id: string) => Promise<void>;
    onTogglePin: (id: string, current: boolean) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onClose: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
    notification,
    onRead,
    onTogglePin,
    onDelete,
    onClose,
}) => {
    const { id, title, message, type, is_read, is_pinned, created_at } = notification;

    const handleClick = async () => {
        if (!is_read) await onRead(id);
        onClose();
    };

    return (
        <div
            onClick={handleClick}
            className={`relative flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors duration-150 hover:bg-slate-50 group ${!is_read ? 'bg-blue-50' : 'bg-white'
                }`}
        >
            {/* Indicador de no leída */}
            {!is_read && (
                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500" />
            )}

            <NotifIcon type={type} />

            <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug truncate ${is_read ? 'font-medium text-gray-700' : 'font-bold text-gray-900'}`}>
                    {title}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                    {message}
                </p>
                <p className="text-[10px] text-gray-400 mt-1 font-medium">
                    {timeAgo(created_at)}
                </p>
            </div>

            {/* Acciones (Pin y Delete) */}
            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onTogglePin(id, is_pinned);
                    }}
                    title={is_pinned ? 'Desanclar' : 'Anclar'}
                    className="p-1 rounded hover:bg-black/5"
                >
                    {is_pinned
                        ? <PinOff className="w-3.5 h-3.5 text-gray-400" />
                        : <Pin className="w-3.5 h-3.5 text-gray-400" />
                    }
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(id);
                    }}
                    title="Eliminar"
                    className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
};

// ─── NotificationDrawer (exportado) ─────────────────────────────────────────

interface NotificationDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const { notifications, markAsRead, markAllAsRead, togglePin, deleteNotification, clearAllNotifications } = useNotifications();
    const [visible, setVisible] = useState(false);

    // Montar/desmontar con animación
    useEffect(() => {
        if (isOpen) {
            setVisible(true);
        } else {
            const t = setTimeout(() => setVisible(false), 300);
            return () => clearTimeout(t);
        }
    }, [isOpen]);

    if (!visible && !isOpen) return null;

    const recent = notifications.slice(0, 5);
    const hasAny = notifications.length > 0;
    const hasUnread = notifications.some(n => !n.is_read);

    const handleViewAll = () => {
        navigate('/notificaciones');
        onClose();
    };

    const handleClearAll = async () => {
        if (window.confirm('¿Estás seguro de que deseas eliminar todas las notificaciones?')) {
            await clearAllNotifications();
        }
    };

    return (
        <>
            {/* Overlay */}
            <div
                className={`fixed inset-0 z-[40] bg-black/50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={onClose}
            />

            {/* Panel lateral */}
            <div
                className={`fixed right-0 inset-y-0 z-[50] h-full w-full max-w-sm bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <Bell className="w-5 h-5 text-gray-700" />
                        <h2 className="text-base font-black text-gray-900 tracking-tight">
                            Notificaciones
                        </h2>
                    </div>
                    <div className="flex items-center gap-1">
                        {hasAny && (
                            <>
                                {hasUnread && (
                                    <button
                                        onClick={markAllAsRead}
                                        title="Marcar todo como leído"
                                        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
                                    >
                                        <CheckCheck className="w-4 h-4" />
                                    </button>
                                )}
                                <button
                                    onClick={handleClearAll}
                                    title="Limpiar todo"
                                    className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </>
                        )}
                        <div className="w-px h-4 bg-gray-200 mx-1" />
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors group"
                        >
                            <X className="w-5 h-5 text-gray-500 group-hover:rotate-90 transition-transform duration-300" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto divide-y divide-gray-100/80">
                    {!hasAny ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8 py-12">
                            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                                <BellOff className="w-6 h-6 text-gray-400" />
                            </div>
                            <p className="text-sm font-bold text-gray-700">Sin notificaciones</p>
                            <p className="text-xs text-gray-400 leading-relaxed">
                                Cuando haya actividad relevante, aparecerá aquí.
                            </p>
                        </div>
                    ) : (
                        recent.map(notif => (
                            <NotificationItem
                                key={notif.id}
                                notification={notif}
                                onRead={markAsRead}
                                onTogglePin={togglePin}
                                onDelete={deleteNotification}
                                onClose={onClose}
                            />
                        ))
                    )}
                </div>

                {/* Footer */}
                {hasAny && (
                    <div className="shrink-0 border-t border-gray-100 px-5 py-3">
                        <button
                            onClick={handleViewAll}
                            className="w-full py-2.5 rounded-xl bg-black text-white text-xs font-black tracking-wide hover:bg-gray-800 transition-colors"
                        >
                            Ver todas las notificaciones
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};

// ─── NotificationBell (exportado) ────────────────────────────────────────────

interface NotificationBellProps {
    onToggleDrawer: () => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onToggleDrawer }) => {
    const { unreadCount } = useNotifications();

    return (
        <button
            onClick={onToggleDrawer}
            aria-label="Abrir notificaciones"
            className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-100 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all group"
        >
            <Bell className="w-5 h-5 transition-transform group-hover:scale-110" />

            {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-600 text-white text-xs font-black flex items-center justify-center rounded-full shadow-md leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}
        </button>
    );
};
