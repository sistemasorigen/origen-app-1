import { useState } from 'react';

const DISMISSED_KEY = 'origen_push_banner_dismissed';

interface UsePushNotificationsReturn {
    permission: NotificationPermission;
    isSupported: boolean;
    requestPermission: () => Promise<NotificationPermission>;
    sendPush: (title: string, message: string, url?: string | null) => void;
    dismissBanner: () => void;
    shouldShowBanner: boolean;
}

export function usePushNotifications(): UsePushNotificationsReturn {
    const isSupported = typeof window !== 'undefined' && 'Notification' in window;

    const [permission, setPermission] = useState<NotificationPermission>(
        isSupported ? Notification.permission : 'denied'
    );

    const [dismissed, setDismissed] = useState(
        () => localStorage.getItem(DISMISSED_KEY) === 'true'
    );

    const shouldShowBanner = isSupported && permission === 'default' && !dismissed;

    const requestPermission = async (): Promise<NotificationPermission> => {
        if (!isSupported) return 'denied';
        try {
            const result = await Notification.requestPermission();
            setPermission(result);
            return result;
        } catch {
            return 'denied';
        }
    };

    const sendPush = (title: string, message: string, url?: string | null) => {
        if (!isSupported || permission !== 'granted') return;
        if (!document.hidden) return;

        const notif = new Notification(title, {
            body: message,
            icon: '/favicon.png',
            badge: '/favicon.png',
            tag: 'origen-notification',
        });

        if (url) {
            notif.onclick = () => {
                window.focus();
                window.location.hash = url;
                notif.close();
            };
        }
    };

    const dismissBanner = () => {
        localStorage.setItem(DISMISSED_KEY, 'true');
        setDismissed(true);
    };

    return { permission, isSupported, requestPermission, sendPush, dismissBanner, shouldShowBanner };
}
