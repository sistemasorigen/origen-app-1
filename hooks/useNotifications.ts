import { useNotificationContext } from '../contexts/NotificationContext';
export type { AppNotification } from '../contexts/NotificationContext';

export const useNotifications = () => {
    const context = useNotificationContext();
    
    return {
        notifications: context.notifications,
        unreadCount: context.unreadCount,
        isLoading: context.isLoading,
        fetchNotifications: context.fetchNotifications,
        markAsRead: context.markAsRead,
        markAllAsRead: context.markAllAsRead,
        togglePin: context.togglePin,
        deleteNotification: context.deleteNotification,
        clearAllNotifications: context.clearAllNotifications,
    };
};

export default useNotifications;
