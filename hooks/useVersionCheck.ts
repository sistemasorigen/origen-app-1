import { useState, useEffect, useRef } from 'react';

const CHECK_INTERVAL_MS = 3 * 60 * 1000; // cada 3 minutos

export function useVersionCheck() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const baselineVersionRef = useRef<string | null>(null);

    const fetchVersion = async (): Promise<string | null> => {
        try {
            const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
            if (!res.ok) return null;
            const data = await res.json();
            return data.version as string;
        } catch {
            return null;
        }
    };

    useEffect(() => {
        let cancelled = false;

        const init = async () => {
            const v = await fetchVersion();
            if (!cancelled && v) baselineVersionRef.current = v;
        };
        init();

        const interval = setInterval(async () => {
            if (!baselineVersionRef.current) return;
            const v = await fetchVersion();
            if (v && v !== baselineVersionRef.current) {
                setUpdateAvailable(true);
            }
        }, CHECK_INTERVAL_MS);

        // También chequear cuando la pestaña vuelve a
        // primer plano — cubre el caso de alguien que
        // dejó la app minimizada varias horas.
        const handleVisibility = async () => {
            if (document.visibilityState !== 'visible' || !baselineVersionRef.current) return;
            const v = await fetchVersion();
            if (v && v !== baselineVersionRef.current) {
                setUpdateAvailable(true);
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            cancelled = true;
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, []);

    const forceHardReset = async () => {
        try {
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(key => caches.delete(key)));
            }
        } catch {
            // Si falla la limpieza de caché, igual seguimos con el reload.
        }
        // Cache-busting explícito además del reload — algunos
        // navegadores/hosts igual sirven HTML cacheado en un
        // reload simple.
        window.location.href = window.location.pathname + window.location.hash + (window.location.hash.includes('?') ? '&' : '?') + '_r=' + Date.now();
    };

    return { updateAvailable, forceHardReset };
}
