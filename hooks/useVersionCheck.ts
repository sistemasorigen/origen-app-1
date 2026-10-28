import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { anotarRevision, fechaYHora, registrar } from '../src/utils/diagnostico';

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

/**
 * Cada cuánto se vuelve a preguntar mientras la app está a la vista.
 *
 * El aviso en tiempo real sólo le llega a quien tiene la conexión abierta
 * justo cuando se publica, y no se reenvía. Con el teléfono bloqueado o en
 * otra app —el banco, WhatsApp— la conexión está dormida y el aviso se
 * pierde. Al volver hay un chequeo, pero si fallaba —la red todavía
 * despertándose— no había otro: la persona quedaba en la versión vieja, sin
 * cartel, hasta cambiar de app otra vez.
 *
 * Con la pestaña oculta no corre (`revisar` lo descarta), así que no cuesta
 * nada en segundo plano. A la vista es una lectura de una fila cada minuto y
 * medio.
 */
const INTERVALO_A_LA_VISTA_MS = 90_000;

/**
 * Cuándo se reintenta una revisión que falló, sin esperar al intervalo.
 *
 * Al volver de otra app —sobre todo en el iPhone— la red tarda un par de
 * segundos en despertar y la primera consulta suele ser justo la que falla.
 * Esperar los 90 s del intervalo era dejar a la persona ese rato en la
 * versión vieja.
 */
const REINTENTOS_MS = [3_000, 10_000];

/**
 * Cuánto se le espera a la consulta antes de darla por fallida.
 *
 * Con la red a medio despertar, un fetch en iOS puede quedarse colgado un
 * minuto entero. Mientras tanto no hay error que dispare los reintentos.
 */
const TOPE_DE_CONSULTA_MS = 8_000;

/**
 * Después de tanto tiempo en segundo plano, al volver se revisa sí o sí,
 * sin el freno de los 20 s. Un teléfono que se dejó con la app abierta a la
 * noche casi seguro se perdió un deploy.
 */
const LARGA_AUSENCIA_MS = 12 * 60 * 60 * 1000;

/** Desde cuánto tiempo afuera vale la pena anotar la vuelta en el diagnóstico. */
const AUSENCIA_QUE_SE_ANOTA_MS = 5 * 60 * 1000;

// El reload destruye todo el estado de React, así que lo único que
// sobrevive de un intento a otro es lo que quedó en sessionStorage antes
// de que la página se fuera.
const RESET_STORAGE_KEY = 'origen_version_reset';
const MAX_RESET_ATTEMPTS = 3;

/**
 * La versión que esta persona dejó de lado.
 *
 * Con una versión nueva el cartel no deja seguir: se actualiza. La única
 * salida es cuando la actualización ya falló (ver FALLO_STORAGE_KEY), y
 * entonces esto evita que el cartel vuelva a tapar la app enseguida.
 *
 * En sessionStorage y no en localStorage a propósito: vale para esta
 * pestaña y hasta cerrarla, no para siempre.
 */
const POSPUESTA_STORAGE_KEY = 'origen_version_pospuesta';

/**
 * Qué build se intentó traer sin éxito.
 *
 * Cuando se agotan los reintentos, el servidor sigue entregando el bundle
 * viejo: puede ser una caché intermedia, un deploy a medio propagar o una
 * copia vieja en el hosting. Repetir "actualizá" en esa situación es mandar
 * a alguien a apretar un botón que ya se sabe que no arregla nada, así que
 * el cartel cambia de texto y deja seguir.
 */
const FALLO_STORAGE_KEY = 'origen_version_fallo';

// Mismo flag que setea el script inline de index.html cuando el
// <script type="module"> principal falla al cargar (MIME type de un
// index.html apuntando a un bundle que un deploy posterior ya borró). Si
// React llegó a montar es porque esta carga sí trajo un bundle que
// funciona — no queda nada pendiente de reintentar.
const MODULE_LOAD_RETRY_KEY = 'origen_module_load_retry';

/**
 * Qué versión corría cuando se tocó "Recargar app". Al volver a montar se
 * compara con la que llegó, para que el diagnóstico diga si la recarga
 * cambió algo.
 */
const RECARGA_MANUAL_KEY = 'origen_recarga_manual';

interface PendingReset {
    expectedVersion: string;
    attempts: number;
}

/** sessionStorage puede tirar (ventana privada estricta): nada de esto puede voltear la app. */
const leerSesion = (clave: string): string | null => {
    try { return sessionStorage.getItem(clave); } catch { return null; }
};
const escribirSesion = (clave: string, valor: string | null): void => {
    try {
        if (valor === null) sessionStorage.removeItem(clave);
        else sessionStorage.setItem(clave, valor);
    } catch { /* sin storage */ }
};

const corta = (v?: string | null) => (v ? v.slice(0, 7) : '—');

/**
 * Recarga agregando un cache-buster a la URL, sin tocar el fragmento hash.
 *
 * La app usa HashRouter (`.../#/eventos`), así que TODA la ruta vive
 * después del `#`. Concatenar `'?_cb=' + Date.now()` a mano sobre
 * `location.href` lo pegaría DENTRO del fragmento — invisible para el
 * servidor y para cualquier caché HTTP, que nunca llega a ver el hash — y
 * no serviría para nada. El objeto URL arma el query string real, antes
 * del `#`, sin importar qué router esté activo.
 *
 * Con `replace` y no asignando `href`: asignar deja la página vieja en el
 * historial. En el iPhone con la app en el inicio, el gesto de deslizar
 * desde el borde vuelve atrás, y volvía a ESA página —restaurada de la caché
 * de atrás/adelante, con el cartel congelado en "Actualizando…" y el botón
 * apagado—. Desde ahí no había salida más que cerrar la app. Además, cada
 * reintento sumaba otra entrada.
 */
export const reloadWithCacheBust = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('_cb', Date.now().toString());
    window.location.replace(url.toString());
};

/**
 * "Recargar app" del menú y de Mi cuenta: la misma recarga que el cartel,
 * anotada en el diagnóstico con desde dónde se pidió.
 */
export const recargarApp = (desde: string) => {
    registrar('recarga', `"Recargar app" desde ${desde}, en ${corta(__BUILD_VERSION__)}`);
    escribirSesion(RECARGA_MANUAL_KEY, __BUILD_VERSION__);
    reloadWithCacheBust();
};

export function useVersionCheck() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    // Un reload anterior no consiguió la versión nueva: cambia el texto del
    // cartel y el peso de los botones.
    const [actualizacionFallida, setActualizacionFallida] = useState(false);
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

        const avisar = (version: string, por: string) => {
            if (avisadoRef.current) return;
            // Ya dijo "ahora no" para esta misma versión: no se vuelve a
            // preguntar hasta que cierre la pestaña.
            if (leerSesion(POSPUESTA_STORAGE_KEY) === version) return;
            avisadoRef.current = true;
            registrar('cartel', `versión ${corta(version)} (aviso por ${por}), corriendo ${corta(__BUILD_VERSION__)}`);
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
        /** Cuál de REINTENTOS_MS toca, y el temporizador del que está esperando. */
        let reintento = 0;
        let temporizadorReintento = 0;

        const revisar = async (motivo: string, forzar = false) => {
            if (cancelado || avisadoRef.current) return;
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

            const ahora = Date.now();
            if (!forzar && ahora - ultimaConsultaRef.current < ESPERA_ENTRE_CONSULTAS_MS) return;
            ultimaConsultaRef.current = ahora;

            const tope = new AbortController();
            const corte = window.setTimeout(() => tope.abort(), TOPE_DE_CONSULTA_MS);
            let data: { version?: string | null; updated_at?: string | null } | null = null;
            let falla = '';
            try {
                const r = await supabase
                    .from('app_version')
                    .select('version, updated_at')
                    .eq('id', 1)
                    .abortSignal(tope.signal)
                    .single();
                data = r.data;
                if (r.error || !r.data) falla = r.error?.message || 'sin datos';
            } catch (e) {
                falla = e instanceof Error ? e.message : String(e);
            } finally {
                window.clearTimeout(corte);
            }
            if (tope.signal.aborted) falla = `sin respuesta en ${TOPE_DE_CONSULTA_MS / 1000} s`;

            if (cancelado) return;
            if (falla || !data) {
                // Un fallo no cuenta como consulta hecha: si no, el freno de
                // arriba bloqueaba el reintento durante 20 segundos, y al
                // volver de otra app el primer intento suele ser justo el
                // que falla.
                ultimaConsultaRef.current = 0;
                anotarRevision(`falló (${motivo}): ${falla}`);
                // Y no se espera al próximo evento ni al intervalo: se vuelve
                // a probar a los 3 s y a los 10 s.
                if (reintento < REINTENTOS_MS.length && !temporizadorReintento) {
                    const espera = REINTENTOS_MS[reintento++];
                    temporizadorReintento = window.setTimeout(() => {
                        temporizadorReintento = 0;
                        revisar('reintento', true);
                    }, espera);
                }
                return;
            }
            reintento = 0;
            if (esMasNueva(data)) {
                anotarRevision(`hay otra: ${corta(data.version)}, publicada ${data.updated_at ? fechaYHora(Date.parse(data.updated_at), false) : '—'}`);
                avisar(data.version as string, motivo);
            } else {
                anotarRevision(`al día (${corta(data.version)})`);
            }
        };

        revisar('inicio');

        // Cuándo se fue la app al fondo, para saber al volver cuánto estuvo
        // afuera. El momento sale de acá y no del intervalo porque en el
        // fondo los temporizadores están congelados.
        let ocultaDesde = 0;

        // Los tres eventos de "volví": en iOS el que manda suele ser
        // pageshow (la página vuelve de la caché de atrás/adelante, y ahí no
        // hay visibilitychange), en Android visibilitychange, y focus cubre
        // el escritorio cuando se cambia de ventana sin ocultar la pestaña.
        // Disparan juntos muchas veces; para eso está el freno de arriba.
        const alVolver = () => {
            if (document.visibilityState === 'hidden') {
                if (!ocultaDesde) ocultaDesde = Date.now();
                return;
            }
            const afuera = ocultaDesde ? Date.now() - ocultaDesde : 0;
            ocultaDesde = 0;
            if (afuera >= AUSENCIA_QUE_SE_ANOTA_MS) {
                registrar('volvio', `después de ${Math.round(afuera / 60_000)} min`);
            }
            // Cada vuelta es una oportunidad nueva: los reintentos arrancan
            // de cero.
            reintento = 0;
            revisar('volver', afuera >= LARGA_AUSENCIA_MS);
        };
        const alIrse = () => { if (!ocultaDesde) ocultaDesde = Date.now(); };
        const periodico = window.setInterval(() => { revisar('intervalo'); }, INTERVALO_A_LA_VISTA_MS);
        document.addEventListener('visibilitychange', alVolver);
        window.addEventListener('pageshow', alVolver);
        window.addEventListener('focus', alVolver);
        window.addEventListener('pagehide', alIrse);

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
                    if (esOtraVersion(fila?.version)) avisar(fila.version as string, 'realtime');
                }
            )
            .subscribe();

        return () => {
            cancelado = true;
            document.removeEventListener('visibilitychange', alVolver);
            window.removeEventListener('pageshow', alVolver);
            window.removeEventListener('focus', alVolver);
            window.removeEventListener('pagehide', alIrse);
            window.clearInterval(periodico);
            window.clearTimeout(temporizadorReintento);
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
        //
        // Todo el acceso a sessionStorage va por leerSesion/escribirSesion:
        // App monta este hook AFUERA del ErrorBoundary, así que un throw acá
        // dejaba la pantalla en blanco sin nada que lo atajara.
        escribirSesion(MODULE_LOAD_RETRY_KEY, null);

        const manual = leerSesion(RECARGA_MANUAL_KEY);
        if (manual) {
            escribirSesion(RECARGA_MANUAL_KEY, null);
            registrar('resultado', manual === __BUILD_VERSION__
                ? `"Recargar app": sigue en ${corta(__BUILD_VERSION__)}`
                : `"Recargar app": de ${corta(manual)} a ${corta(__BUILD_VERSION__)}`);
        }

        const raw = leerSesion(RESET_STORAGE_KEY);
        if (!raw) return;

        let pending: PendingReset;
        try {
            pending = JSON.parse(raw);
        } catch {
            escribirSesion(RESET_STORAGE_KEY, null);
            return;
        }

        if (__BUILD_VERSION__ === pending.expectedVersion) {
            // Llegó el build correcto: listo, no queda nada pendiente.
            escribirSesion(RESET_STORAGE_KEY, null);
            registrar('resultado', `esperaba ${corta(pending.expectedVersion)}, llegó ${corta(__BUILD_VERSION__)} (intento ${pending.attempts}) ✓`);
            return;
        }

        registrar('resultado', `esperaba ${corta(pending.expectedVersion)}, llegó ${corta(__BUILD_VERSION__)} (intento ${pending.attempts})`);
        if (pending.attempts < MAX_RESET_ATTEMPTS) {
            escribirSesion(RESET_STORAGE_KEY, JSON.stringify({
                expectedVersion: pending.expectedVersion,
                attempts: pending.attempts + 1
            }));
            reloadWithCacheBust();
        } else {
            // Se agotaron los intentos: o el hosting todavía no terminó de
            // propagar los archivos, o hay algo genuinamente roto. Mejor
            // quedarse con una versión vieja pero usable que insistir en un
            // loop de reloads que la persona ni puede frenar a mano.
            escribirSesion(RESET_STORAGE_KEY, null);
            // Queda anotado para que el cartel diga la verdad —que el reload
            // ya se probó y no alcanzó— en vez de volver a pedir lo mismo.
            escribirSesion(FALLO_STORAGE_KEY, pending.expectedVersion);
            setActualizacionFallida(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Al montar: si el intento anterior quedó marcado como fallido, el cartel
    // arranca con el texto que corresponde.
    useEffect(() => {
        try {
            if (sessionStorage.getItem(FALLO_STORAGE_KEY)) setActualizacionFallida(true);
        } catch { /* sin storage */ }
    }, []);

    /**
     * Sigue con esta versión y no vuelve a preguntar en esta pestaña. El
     * cartel lo ofrece sólo cuando la actualización ya falló.
     */
    const posponer = () => {
        try {
            if (pendingVersionRef.current) {
                sessionStorage.setItem(POSPUESTA_STORAGE_KEY, pendingVersionRef.current);
            }
            sessionStorage.removeItem(FALLO_STORAGE_KEY);
        } catch { /* sin storage: al menos se cierra el cartel */ }
        setUpdateAvailable(false);
    };

    const forceHardReset = async () => {
        try {
            if ('caches' in window) {
                // Con tope: la app no usa service worker y no tiene nada en
                // CacheStorage, así que esto es sólo por las dudas — y no
                // puede ser lo que deje el botón girando para siempre si la
                // promesa no vuelve.
                const limpiar = (async () => {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(key => caches.delete(key)));
                })();
                await Promise.race([limpiar, new Promise(r => setTimeout(r, 1500))]);
            }
        } catch {
            // Si falla la limpieza de caché, igual seguimos con el reload.
        }

        // Deja registrado qué build se espera para que, al volver a montar
        // después del reload, el efecto de arriba pueda confirmar si lo
        // consiguió — sin esto no habría forma de distinguir un reload
        // exitoso de uno que sirvió el mismo HTML viejo de nuevo.
        if (pendingVersionRef.current) {
            escribirSesion(RESET_STORAGE_KEY, JSON.stringify({
                expectedVersion: pendingVersionRef.current,
                attempts: 1
            }));
        }

        registrar('recarga', `desde el cartel: ${corta(__BUILD_VERSION__)} → ${corta(pendingVersionRef.current)}`);
        reloadWithCacheBust();
    };

    return { updateAvailable, actualizacionFallida, forceHardReset, posponer };
}
