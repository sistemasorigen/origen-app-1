import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';

export function useVersionCheck() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const baselineVersionRef = useRef<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const init = async () => {
            const { data, error } = await supabase
                .from('app_version')
                .select('version')
                .eq('id', 1)
                .single();

            if (!cancelled && !error && data) {
                baselineVersionRef.current = data.version;
            }
        };
        init();

        const channel = supabase
            .channel('app-version-check')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'app_version' },
                (payload) => {
                    const newVersion = (payload.new as any)?.version;
                    if (
                        newVersion &&
                        baselineVersionRef.current &&
                        newVersion !== baselineVersionRef.current
                    ) {
                        setUpdateAvailable(true);
                    }
                }
            )
            .subscribe();

        return () => {
            cancelled = true;
            supabase.removeChannel(channel);
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
        // El param de cache-busting va en el query string real, ANTES
        // del hash — esta app usa HashRouter, y el navegador solo hace
        // una recarga de red de verdad cuando cambia algo antes del
        // "#". Ponerlo después del hash es un cambio de fragmento "en
        // el mismo documento": no dispara ninguna petición nueva, y el
        // modal se queda trabado en "Actualizando..." para siempre
        // (bug real, ya visto y confirmado con un test).
        const bustParam = '_r=' + Date.now();
        const search = window.location.search
            ? `${window.location.search}&${bustParam}`
            : `?${bustParam}`;
        window.location.href = window.location.pathname + search + window.location.hash;
    };

    return { updateAvailable, forceHardReset };
}
