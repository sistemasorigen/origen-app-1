import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';

// Embebido en el bundle vía `define` en vite.config.ts, a partir de
// scripts/generate-build-version.js. Ver el comentario de reloadWithCacheBust
// y el efecto de auto-verificación más abajo para cómo se usa.
declare const __BUILD_VERSION__: string;

// El reload destruye todo el estado de React, así que lo único que
// sobrevive de un intento a otro es lo que quedó en sessionStorage antes
// de que la página se fuera.
const RESET_STORAGE_KEY = 'origen_version_reset';
const MAX_RESET_ATTEMPTS = 3;

interface PendingReset {
    expectedVersion: string;
    attempts: number;
}

/**
 * Recarga agregando un cache-buster a la URL, sin tocar el fragmento hash.
 *
 * La app usa HashRouter (`.../#/eventos`), así que TODA la ruta vive
 * después del `#`. Concatenar `'?_cb=' + Date.now()` a mano sobre
 * `location.href` lo pegaría DENTRO del fragmento — invisible para el
 * servidor y para cualquier caché HTTP, que nunca llega a ver el hash — y
 * no serviría para nada. El objeto URL arma el query string real, antes
 * del `#`, sin importar qué router esté activo.
 */
const reloadWithCacheBust = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('_cb', Date.now().toString());
    window.location.href = url.toString();
};

export function useVersionCheck() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const baselineVersionRef = useRef<string | null>(null);
    const pendingVersionRef = useRef<string | null>(null);

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
                        // Se guarda para que forceHardReset sepa, sin volver a
                        // preguntarle a la base, qué build está esperando.
                        pendingVersionRef.current = newVersion;
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

    // Auto-verificación al montar: si un forceHardReset anterior dejó algo
    // pendiente en sessionStorage, es porque la página se está recargando
    // por segunda (o tercera) vez tras pedir una actualización. Confirma si
    // ESTA carga trajo el build que se esperaba — comparando contra el
    // identificador embebido en el bundle que efectivamente terminó
    // corriendo — y si no, reintenta sola. Efecto aparte del de arriba
    // para no mezclar la suscripción de Realtime con esta verificación
    // puntual de una sola vez.
    useEffect(() => {
        const raw = sessionStorage.getItem(RESET_STORAGE_KEY);
        if (!raw) return;

        let pending: PendingReset;
        try {
            pending = JSON.parse(raw);
        } catch {
            sessionStorage.removeItem(RESET_STORAGE_KEY);
            return;
        }

        if (__BUILD_VERSION__ === pending.expectedVersion) {
            // Llegó el build correcto: listo, no queda nada pendiente.
            sessionStorage.removeItem(RESET_STORAGE_KEY);
            return;
        }

        if (pending.attempts < MAX_RESET_ATTEMPTS) {
            sessionStorage.setItem(RESET_STORAGE_KEY, JSON.stringify({
                expectedVersion: pending.expectedVersion,
                attempts: pending.attempts + 1
            }));
            reloadWithCacheBust();
        } else {
            // Se agotaron los intentos: o el hosting todavía no terminó de
            // propagar los archivos, o hay algo genuinamente roto. Mejor
            // quedarse con una versión vieja pero usable que insistir en un
            // loop de reloads que la persona ni puede frenar a mano.
            sessionStorage.removeItem(RESET_STORAGE_KEY);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

        // Deja registrado qué build se espera para que, al volver a montar
        // después del reload, el efecto de arriba pueda confirmar si lo
        // consiguió — sin esto no habría forma de distinguir un reload
        // exitoso de uno que sirvió el mismo HTML viejo de nuevo.
        if (pendingVersionRef.current) {
            sessionStorage.setItem(RESET_STORAGE_KEY, JSON.stringify({
                expectedVersion: pendingVersionRef.current,
                attempts: 1
            }));
        }

        reloadWithCacheBust();
    };

    return { updateAvailable, forceHardReset };
}
