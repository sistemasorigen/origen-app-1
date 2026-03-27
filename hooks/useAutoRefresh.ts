import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const BLACKLIST = ['/form', '/nuevo', '/editar', '/login', '/update-password', '/welcome'];
const INACTIVITY_LIMIT = 300000; // 5 minutes
const CHECK_INTERVAL = 30000;    // 30 seconds

export const useAutoRefresh = () => {
    const location = useLocation();
    const lastActivityTime = useRef(Date.now());

    const isDangerousRoute = BLACKLIST.some(keyword =>
        location.pathname.includes(keyword)
    );

    useEffect(() => {
        const updateActivity = () => {
            lastActivityTime.current = Date.now();
        };

        const events = ['mousemove', 'keydown', 'touchstart', 'scroll'];
        events.forEach(event => window.addEventListener(event, updateActivity, { passive: true }));

        const interval = setInterval(() => {
            if (!isDangerousRoute && Date.now() - lastActivityTime.current > INACTIVITY_LIMIT) {
                window.location.reload();
            }
        }, CHECK_INTERVAL);

        const handleVisibilityChange = () => {
            if (
                document.visibilityState === 'visible' &&
                !isDangerousRoute &&
                Date.now() - lastActivityTime.current > INACTIVITY_LIMIT
            ) {
                window.location.reload();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            events.forEach(event => window.removeEventListener(event, updateActivity));
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isDangerousRoute]);
};
