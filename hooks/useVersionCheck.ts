import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';

// Embebido en el bundle vía `define` en vite.config.ts, a partir de
// scripts/generate-build-version.js. Ver el comentario de reloadWithCacheBust
// y el efecto de auto-verificación más abajo para cómo se usa.
declare const __BUILD_VERSION__: string;
// Cuándo se compiló este bundle (ISO). Misma vía que el identificador.
declare const __BUILD_TIME__: string;

/** Momento de compilación de este bundle, en milisegundos. */
const MOMENTO_DEL_BUILD = Date.parse(__BUILD_TIME__) || 0;

/**
 * Cada cuánto, como mucho, se le vuelve a preguntar a la base.
 *
 * Volver a la app es un gesto que se repite mucho —se mira algo, se sale, se
 * vuelve— y cada vuelta dispara hasta tres eventos del navegador. Sin este
 * freno, pasear entre apps sería una consulta por segundo.
 */
const ESPERA_ENTRE_CONSULTAS_MS = 20_000;

// El reload destruye todo el estado de React, así que lo único que
// sobrevive de un intento a otro es lo que quedó en sessionStorage antes
// de que la página se fuera.
const RESET_STORAGE_KEY = 'origen_version_reset';
const MAX_RESET_ATTEMPTS = 3;

// Mismo flag que setea el script inline de index.html cuando el
// <script type="module"> principal falla al cargar (MIME type de un
// index.html apuntando a un bundle que un deploy posterior ya borró). Si
// React llegó a montar es porque esta carga sí trajo un bundle que
// funciona — no queda nada pendiente de reintentar.
const MODULE_LOAD_RETRY_KEY = 'origen_module_load_retry';

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
    const pendingVersionRef = useRef<string | null>(null);
    const ultimaConsultaRef = useRef(0);
    const avisadoRef = useRef(false);

    useEffect(() => {
        let cancelado = false;

        /**
         * ¿Lo que está publicado es más nuevo que lo que estoy corriendo?
         *
         * Dos condiciones, y las dos hacen falta:
         *
         * - Que el identificador sea OTRO. Si es el mismo, ya estoy en esa
         *   versión por más que la base la haya anunciado recién.
         * - Que se haya publicado DESPUÉS de que me compilaron a mí. Es el
         *   resguardo de la ventana de propagación: el deploy sube los
         *   archivos y recién veinte segundos más tarde toca la base, así
         *   que quien entra en ese hueco ya tiene el bundle nuevo mientras
         *   la base todavía anuncia el anterior. Sin esta segunda condición
         *   se le ofrecería "actualizar" hacia atrás, y el reload le traería
         *   una y otra vez el mismo bundle que ya tiene.
         */
        const esOtraVersion = (version?: string | null): boolean => {
            // 'dev' es lo que embebe vite cuando no hubo un build de verdad
            // (servidor de desarrollo). Contra eso todo lo publicado parece
            // nuevo, y saldría el cartel de actualizar cada vez que alguien
            // despliega mientras se está programando.
            if (__BUILD_VERSION__ === 'dev') return false;
            return !!version && version !== __BUILD_VERSION__;
        };

        const esMasNueva = (fila: { version?: string | null; updated_at?: string | null }): boolean => {
            if (!esOtraVersion(fila?.version)) return false;
            const publicada = fila.updated_at ? Date.parse(fila.updated_at) : NaN;
            // Sin fecha no hay forma de saber cuál es más nueva: mejor no
            // avisar que mandar a alguien a una versión anterior.
            if (!publicada) return false;
            return publicada > MOMENTO_DEL_BUILD;
        };

        const avisar = (version: string) => {
            if (avisadoRef.current) return;
            avisadoRef.current = true;
            // Se guarda para que forceHardReset sepa, sin volver a
            // preguntarle a la base, qué build está esperando.
            pendingVersionRef.current = version;
            setUpdateAvailable(true);
        };

        /**
         * Le pregunta a la base qué versión hay publicada.
         *
         * Se llama al abrir y CADA VEZ QUE LA APP VUELVE AL FRENTE. Esto
         * último es el punto: en el teléfono la app casi nunca queda
         * abierta, se la minimiza. Ahí el navegador congela los
         * temporizadores y el canal de Realtime se cae, así que el aviso del
         * deploy que ocurrió mientras tanto no llega nunca, y al volver la
         * app seguía sin enterarse de que había una versión nueva.
         */
        const revisar = async () => {
            if (cancelado || avisadoRef.current) return;
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

            const ahora = Date.now();
            if (ahora - ultimaConsultaRef.current < ESPERA_ENTRE_CONSULTAS_MS) return;
            ultimaConsultaRef.current = ahora;

            const { data, error } = await supabase
                .from('app_version')
                .select('version, updated_at')
                .eq('id', 1)
                .single();

            if (cancelado || error || !data) return;
            if (esMasNueva(data)) avisar(data.version);
        };

        revisar();

        // Los tres eventos de "volví": en iOS el que manda suele ser
        // pageshow (la página vuelve de la caché de atrás/adelante, y ahí no
        // hay visibilitychange), en Android visibilitychange, y focus cubre
        // el escritorio cuando se cambia de ventana sin ocultar la pestaña.
        // Disparan juntos muchas veces; para eso está el freno de arriba.
        const alVolver = () => { revisar(); };
        document.addEventListener('visibilitychange', alVolver);
        window.addEventListener('pageshow', alVolver);
        window.addEventListener('focus', alVolver);

        // Realtime sigue siendo el camino rápido para quien SÍ tiene la app
        // abierta en ese momento: el aviso le llega en el acto, sin esperar
        // a que vuelva del fondo.
        const channel = supabase
            .channel('app-version-check')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'app_version' },
                (payload) => {
                    // Acá no hace falta mirar la fecha: si el aviso llega
                    // mientras la app está corriendo, esa publicación pasó
                    // después de que este bundle se cargó. Alcanza con que
                    // sea otra versión que la que estoy sirviendo.
                    const fila = payload.new as { version?: string };
                    if (esOtraVersion(fila?.version)) avisar(fila.version as string);
                }
            )
            .subscribe();

        return () => {
            cancelado = true;
            document.removeEventListener('visibilitychange', alVolver);
            window.removeEventListener('pageshow', alVolver);
            window.removeEventListener('focus', alVolver);
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
        // Si este efecto corrió es porque React montó, y si React montó es
        // porque el módulo principal cargó bien esta vez — lo que haya
        // quedado marcado por el listener de index.html ya cumplió su
        // función.
        sessionStorage.removeItem(MODULE_LOAD_RETRY_KEY);

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
