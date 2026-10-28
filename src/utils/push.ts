import { supabase } from '../../services/supabaseClient';
import { registrar } from './diagnostico';
import { estaInstalada, plataforma } from './instalacion';

/**
 * Notificaciones push: que los avisos de la app lleguen aunque esté cerrada.
 *
 * Cómo encaja todo:
 *   · public/sw.js muestra el push y abre la app al tocarlo (no cachea nada).
 *   · Acá se suscribe el navegador con la clave VAPID pública y se guarda la
 *     suscripción en la base (push_guardar_suscripcion).
 *   · Cada aviso nuevo de app_notifications dispara send-push, que lo manda a
 *     todas las suscripciones de esa persona (sql/push_notificaciones.sql).
 *
 * El permiso se pide SÓLO con un toque de la persona (activar()): iOS lo
 * exige, y pedirlo al abrir la app es la forma más segura de que lo nieguen.
 *
 * El diagnóstico anota qué pasó, sin el endpoint: es una dirección única de
 * ese navegador.
 */

/**
 * La clave pública VAPID. Es pública por diseño (va en cada suscripción); la
 * privada vive sólo en los secretos de send-push. Va como constante y no como
 * variable de entorno para que el build no dependa de que el .env.local de
 * quien publica la tenga. Si se cambia el par de claves, cambiar también los
 * secretos VAPID_* de la función, y todas las suscripciones dejan de servir.
 */
export const CLAVE_PUBLICA_VAPID = 'BF7kJtrYQHlsWPrQBAi-ffYI5cgSCukwWyqkMU53zr5fLWuO2zwAgVuqyV9lEASlddecMMuOHpJbhd6UGp_cfvM';

/** ¿Este navegador puede recibir push? Necesita service worker, PushManager y HTTPS (o localhost). */
export const soportaPush = (): boolean => {
    try {
        return typeof window !== 'undefined'
            && window.isSecureContext
            && 'serviceWorker' in navigator
            && 'PushManager' in window
            && 'Notification' in window;
    } catch {
        return false;
    }
};

export const permisoActual = (): NotificationPermission => {
    try {
        return 'Notification' in window ? Notification.permission : 'denied';
    } catch {
        return 'denied';
    }
};

/** La clave en el formato que pide pushManager.subscribe. */
const claveEnBytes = (base64url: string): Uint8Array => {
    const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4);
    const crudo = atob(b64);
    return Uint8Array.from(crudo, c => c.charCodeAt(0));
};

const motivo = (e: unknown): string => (e instanceof Error ? `${e.name}: ${e.message}` : String(e)).slice(0, 120);

// ── El service worker ───────────────────────────────────────────────────

/**
 * Se llama una vez al arrancar (index.tsx). Registrar el worker no pide
 * ningún permiso ni muestra nada: sólo deja listo dónde van a llegar los push.
 * Si falla, la app sigue igual; queda anotado en el diagnóstico.
 */
export const registrarServiceWorker = async (): Promise<void> => {
    if (!soportaPush()) return;
    try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
        // Tocar un aviso con la app abierta en una pestaña que el worker
        // todavía no controla: el worker no puede navegarla y le pide a la
        // página que cambie de ruta.
        navigator.serviceWorker.addEventListener('message', (ev: MessageEvent) => {
            const d = ev.data as { tipo?: string; ruta?: string } | null;
            if (d?.tipo === 'origen-ir-a' && typeof d.ruta === 'string' && d.ruta.startsWith('/') && !d.ruta.startsWith('//')) {
                window.location.hash = d.ruta;
            }
        });
    } catch (e) {
        registrar('push', `no se pudo registrar el service worker: ${motivo(e)}`);
    }
};

const registroDelWorker = async (): Promise<ServiceWorkerRegistration> => {
    const actual = await navigator.serviceWorker.getRegistration('/');
    if (actual) return actual;
    await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
    return navigator.serviceWorker.ready;
};

export const suscripcionActual = async (): Promise<PushSubscription | null> => {
    if (!soportaPush()) return null;
    try {
        const reg = await navigator.serviceWorker.getRegistration('/');
        return reg ? await reg.pushManager.getSubscription() : null;
    } catch {
        return null;
    }
};

// ── La base ─────────────────────────────────────────────────────────────

const plataformaPush = (): 'ios' | 'android' | 'escritorio' | 'otro' => {
    const p = plataforma();
    if (p === 'iphone' || p === 'ipad') return 'ios';
    if (p === 'android') return 'android';
    return 'escritorio';
};

/** "Chrome", "Safari, app instalada"… lo justo para reconocer el dispositivo en la lista. */
export const nombreDelNavegador = (): string => {
    const ua = navigator.userAgent || '';
    const nav = /Edg\//.test(ua) ? 'Edge'
        : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
            : /CriOS|Chrome\//.test(ua) ? 'Chrome'
                : /FxiOS|Firefox\//.test(ua) ? 'Firefox'
                    : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
    return estaInstalada() ? `${nav}, app instalada` : nav;
};

const guardar = async (sub: PushSubscription): Promise<boolean> => {
    const j = sub.toJSON();
    const { data, error } = await supabase.rpc('push_guardar_suscripcion', {
        p_endpoint: sub.endpoint,
        p_p256dh: j.keys?.p256dh ?? '',
        p_auth: j.keys?.auth ?? '',
        p_plataforma: plataformaPush(),
        p_navegador: nombreDelNavegador(),
    });
    if (error || !(data as { ok?: boolean } | null)?.ok) {
        registrar('push', `no se pudo guardar la suscripción: ${error?.message ?? (data as { motivo?: string } | null)?.motivo ?? 'sin respuesta'}`);
        return false;
    }
    return true;
};

// ── Lo que hace la persona ──────────────────────────────────────────────

export type ResultadoActivar = 'ok' | 'denegado' | 'no_soportado' | 'error';

/**
 * Activa las notificaciones en este dispositivo. LLAMAR SÓLO DESDE UN TOQUE:
 * lo primero que hace es pedir el permiso, antes de esperar cualquier otra
 * cosa, porque Safari sólo lo muestra si el pedido sale directo del gesto.
 */
export const activar = async (): Promise<ResultadoActivar> => {
    if (!soportaPush()) return 'no_soportado';
    let permiso: NotificationPermission;
    try {
        permiso = await Notification.requestPermission();
    } catch (e) {
        registrar('push', `el pedido de permiso falló: ${motivo(e)}`);
        return 'error';
    }
    if (permiso !== 'granted') {
        registrar('push', `permiso: ${permiso}`);
        return 'denegado';
    }
    try {
        const reg = await registroDelWorker();
        const sub = (await reg.pushManager.getSubscription())
            ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveEnBytes(CLAVE_PUBLICA_VAPID) });
        if (!(await guardar(sub))) return 'error';
        registrar('push', 'suscripción ok');
        return 'ok';
    } catch (e) {
        registrar('push', `no se pudo suscribir: ${motivo(e)}`);
        return 'error';
    }
};

/** Apaga las notificaciones en este dispositivo: la borra de la base y del navegador. */
export const desactivar = async (): Promise<boolean> => {
    const sub = await suscripcionActual();
    if (!sub) return true;
    let ok = true;
    try {
        const { error } = await supabase.rpc('push_borrar_suscripcion', { p_endpoint: sub.endpoint });
        if (error) { ok = false; registrar('push', `no se pudo borrar la suscripción: ${error.message}`); }
    } catch (e) {
        ok = false;
        registrar('push', `no se pudo borrar la suscripción: ${motivo(e)}`);
    }
    // Aunque la base no responda, el navegador se da de baja igual: el
    // próximo push a esa dirección vuelve 410 y send-push la borra sola.
    try { await sub.unsubscribe(); } catch { /* ya no estaba */ }
    registrar('push', ok ? 'suscripción borrada' : 'desuscripto del navegador (la base no respondió)');
    return ok;
};

/**
 * Antes de cerrar sesión: que en un celular compartido no le sigan llegando
 * los avisos de quien se fue. Con tope de tiempo: cerrar sesión no puede
 * quedar colgado por esto.
 */
export const olvidarEsteDispositivo = async (): Promise<void> => {
    if (!soportaPush()) return;
    await Promise.race([
        desactivar().catch(() => false),
        new Promise(r => setTimeout(r, 3000)),
    ]);
};

/**
 * Al abrir la app con sesión: si este navegador tiene una suscripción, se
 * vuelve a guardar. Cubre tres casos con lo mismo: que el worker la haya
 * renovado sola (pushsubscriptionchange), que en la base se haya borrado por
 * fallos, y que en este dispositivo ahora haya otra persona. El guardado es
 * un upsert por endpoint: repetirlo no duplica nada.
 */
export const resincronizar = async (): Promise<void> => {
    if (!soportaPush() || permisoActual() !== 'granted') return;
    const sub = await suscripcionActual();
    if (!sub) return;
    await guardar(sub);
};

// ── El número en el ícono ───────────────────────────────────────────────

/** iPhone instalada (iOS 16.4+), Android y compu. Donde no existe, no hace nada. */
export const ponerNumeroEnElIcono = (n: number): void => {
    try {
        const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
        if (n > 0) nav.setAppBadge?.(n)?.catch(() => {});
        else nav.clearAppBadge?.()?.catch(() => {});
    } catch { /* sin badge */ }
};

// ── Mis dispositivos y la prueba ────────────────────────────────────────

export interface Dispositivo {
    plataforma: 'ios' | 'android' | 'escritorio' | 'otro';
    navegador: string | null;
    created_at: string;
    last_ok_at: string | null;
}

export const misDispositivos = async (): Promise<Dispositivo[]> => {
    const { data, error } = await supabase.rpc('push_mis_dispositivos');
    if (error) throw error;
    const r = data as { ok?: boolean; dispositivos?: Dispositivo[] } | null;
    if (!r?.ok) throw new Error('sin_sesion');
    return r.dispositivos ?? [];
};

export type ResultadoPrueba = { ok: true; quedan: number } | { ok: false; motivo: 'tope' | 'sin_dispositivos' | 'sin_sesion' | 'error' };

export const enviarPrueba = async (): Promise<ResultadoPrueba> => {
    const { data, error } = await supabase.rpc('push_enviar_prueba');
    if (error) { registrar('push', `la prueba falló: ${error.message}`); return { ok: false, motivo: 'error' }; }
    const r = data as { ok?: boolean; quedan?: number; motivo?: string } | null;
    if (r?.ok) { registrar('push', 'notificación de prueba pedida'); return { ok: true, quedan: r.quedan ?? 0 }; }
    const m = r?.motivo === 'tope' || r?.motivo === 'sin_dispositivos' || r?.motivo === 'sin_sesion' ? r.motivo : 'error';
    return { ok: false, motivo: m };
};
