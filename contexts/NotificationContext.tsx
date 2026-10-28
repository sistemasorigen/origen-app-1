import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabaseClient';
import { ponerNumeroEnElIcono, resincronizar } from '../src/utils/push';

export interface AppNotification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: string;
    action_url: string | null;
    is_read: boolean;
    is_pinned: boolean;
    created_at: string;
}

interface NotificationContextType {
    notifications: AppNotification[];
    unreadCount: number;
    isLoading: boolean;
    fetchNotifications: () => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    togglePin: (id: string, currentPinStatus: boolean) => Promise<void>;
    deleteNotification: (id: string) => Promise<void>;
    clearAllNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(false);

    const fetchNotifications = useCallback(async () => {
        if (!user?.id) return;

        setIsLoading(true);
        const { data, error } = await supabase
            .from('app_notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50);

        setIsLoading(false);

        if (error) {
            console.error('[NotificationContext] Error fetching notifications:', error);
            return;
        }

        const list = (data as AppNotification[]) ?? [];
        setNotifications(list);
        setUnreadCount(list.filter(n => !n.is_read).length);
    }, [user?.id]);

    useEffect(() => {
        if (!user?.id) {
            setNotifications([]);
            setUnreadCount(0);
            return;
        }

        fetchNotifications();

        // Unique channel name for the user
        const channelName = `notifications-${user.id}`;
        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'app_notifications',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    console.log('[NotificationContext] Realtime update:', payload);
                    // Antes acá salía también una notificación local
                    // (new Notification) con la pestaña oculta. Ahora cada
                    // aviso llega como push del sistema (send-push, con la
                    // app abierta o cerrada) y la local lo duplicaba.
                    fetchNotifications();
                }
            )
            .subscribe();

        // Si este dispositivo tiene notificaciones push, se vuelve a guardar
        // la suscripción con la sesión de ahora: cubre que el navegador la
        // haya renovado solo y que en este celular haya otra persona.
        resincronizar().catch(() => { /* queda en el diagnóstico */ });

        return () => {
            console.log(`[NotificationContext] Cleaning up channel ${channelName}`);
            supabase.removeChannel(channel);
        };
    }, [user?.id, fetchNotifications]);

    // El número en el ícono de la app (iPhone instalada, Android, compu): el
    // mismo que la marca roja del menú. Sin sesión, se limpia.
    useEffect(() => {
        ponerNumeroEnElIcono(user?.id ? unreadCount : 0);
    }, [unreadCount, user?.id]);

    const markAsRead = async (id: string) => {
        const { error } = await supabase
            .from('app_notifications')
            .update({ is_read: true })
            .eq('id', id)
            .eq('user_id', user?.id);

        if (error) {
            console.error('[NotificationContext] Error marking as read:', error);
            return;
        }
        // fetchNotifications() will also be triggered by real-time event, but calling it here for immediate feedback if needed.
        // Actually, let's just let real-time handle it or update locally for speed.
        // Update local state for immediate feedback
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const markAllAsRead = async () => {
        if (!user?.id) return;

        const { error } = await supabase
            .from('app_notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false);

        if (error) {
            console.error('[NotificationContext] Error marking all as read:', error);
            return;
        }
        
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
    };

    const togglePin = async (id: string, currentPinStatus: boolean) => {
        const { error } = await supabase
            .from('app_notifications')
            .update({ is_pinned: !currentPinStatus })
            .eq('id', id)
            .eq('user_id', user?.id);

        if (error) {
            console.error('[NotificationContext] Error toggling pin:', error);
            return;
        }
        
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_pinned: !currentPinStatus } : n));
    };

    const deleteNotification = async (id: string) => {
        if (!user?.id) return;

        const { error } = await supabase
            .from('app_notifications')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) {
            console.error('[NotificationContext] Error deleting notification:', error);
            return;
        }

        const deletedNotif = notifications.find(n => n.id === id);
        if (deletedNotif && !deletedNotif.is_read) {
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const clearAllNotifications = async () => {
        if (!user?.id) return;

        const { error } = await supabase
            .from('app_notifications')
            .delete()
            .eq('user_id', user.id);

        if (error) {
            console.error('[NotificationContext] Error clearing notifications:', error);
            return;
        }

        setNotifications([]);
        setUnreadCount(0);
    };

    const value = {
        notifications,
        unreadCount,
        isLoading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        togglePin,
        deleteNotification,
        clearAllNotifications,
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};

/**
 * Cuántas hay sin leer, para quien sólo quiere pintar la marca roja.
 *
 * No pasa por useNotificationContext porque ése tira si no encuentra el
 * provider, y la hamburguesa de la navbar se dibuja en pantallas sin sesión:
 * una marca que no se puede contar no puede romper el botón que abre el
 * menú. Sin provider —o sin sesión, que es cuando el contador se limpia
 * solo— devuelve 0.
 */
export const useSinLeer = (): number => {
    const context = useContext(NotificationContext);
    return context?.unreadCount ?? 0;
};

export const useNotificationContext = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotificationContext must be used within a NotificationProvider');
    }
    return context;
};
