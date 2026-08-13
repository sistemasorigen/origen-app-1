import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const BLACKLIST = ['/form', '/nuevo', '/editar', '/login', '/update-password', '/bienvenida'];
// Rutas que necesitan matcheo EXACTO en vez de substring — '/' con
// .includes() matchearía cualquier pathname del sitio (todos arrancan con
// '/'), así que va aparte. El Home queda afuera del reload por inactividad
// porque es la página pública que más gente deja abierta sin interactuar:
// el reload le hacía perder el banner/video ya cargado y volvía a mostrar
// el slide de respaldo hasta que la config real volvía a llegar.
const EXACT_BLACKLIST = ['/'];
const INACTIVITY_LIMIT = 300000; // 5 minutes
const CHECK_INTERVAL = 30000;    // 30 seconds

export const useAutoRefresh = () => {
    const location = useLocation();
    const lastActivityTime = useRef(Date.now());

    const isDangerousRoute =
        EXACT_BLACKLIST.includes(location.pathname) ||
        BLACKLIST.some(keyword => location.pathname.includes(keyword));

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
