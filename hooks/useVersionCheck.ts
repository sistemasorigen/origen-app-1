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
        // Usamos location.reload() nativo para recargar la página.
        // Ya hemos limpiado el cache local arriba (si estaba disponible).
        // Como la app está en Netlify/Vite, el index.html nunca se cachea 
        // fuertemente y cargará los assets nuevos con hash de archivo.
        window.location.reload();
    };

    return { updateAvailable, forceHardReset };
}
