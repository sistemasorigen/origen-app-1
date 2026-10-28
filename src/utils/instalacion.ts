import { useEffect, useState } from 'react';

/**
 * La app agregada a la pantalla de inicio, y cómo invitar a agregarla.
 *
 * Tres preguntas que se hacen en varios lados —la tarjeta del inicio, el menú,
 * Mi cuenta y el diagnóstico— y que tienen que dar la misma respuesta:
 *
 *   · ¿está instalada? (abierta desde el ícono, sin barra del navegador)
 *   · ¿en qué aparato? (iPhone, Android o compu: cambian los pasos)
 *   · ¿el navegador ofrece instalarla él mismo? (sólo Chrome de Android)
 *
 * Nada de esto usa un service worker: la app se instala igual, con el
 * manifiesto y las etiquetas de index.html. Sin él no hay caché propia que
 * pueda quedarse con una versión vieja.
 */

export type Plataforma = 'iphone' | 'ipad' | 'android' | 'compu';

/**
 * Abierta desde el ícono del inicio.
 *
 * Android y la compu lo dicen con display-mode; el iPhone, además, con
 * navigator.standalone, que es lo único que entiende Safari de versiones
 * viejas. Cualquiera de los dos alcanza.
 */
export const estaInstalada = (): boolean => {
    try {
        if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
        return window.matchMedia?.('(display-mode: standalone)').matches
            || window.matchMedia?.('(display-mode: fullscreen)').matches
            || false;
    } catch {
        return false;
    }
};

export const plataforma = (): Plataforma => {
    try {
        const ua = navigator.userAgent || '';
        if (/iPhone|iPod/.test(ua)) return 'iphone';
        if (/iPad/.test(ua)) return 'ipad';
        // El iPad con iPadOS 13+ se presenta como una Mac; lo delata la
        // pantalla táctil, que ninguna Mac tiene.
        if (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1) return 'ipad';
        if (/Android/.test(ua)) return 'android';
    } catch { /* sin navigator: se trata como compu */ }
    return 'compu';
};

/**
 * El navegador que traen adentro WhatsApp, Instagram, Facebook o TikTok, o
 * null si es un navegador común.
 *
 * Desde ahí no se puede instalar nada: no tienen "Agregar a inicio" ni el
 * aviso de instalación de Chrome. Hay que abrir el link afuera.
 *
 * Límite conocido: en iPhone, WhatsApp abre los links en una vista de Safari
 * que se presenta igual que Safari, así que ese caso no se distingue (y ahí
 * sí aparece el botón de compartir, así que los pasos comunes sirven).
 */
export const navegadorInterno = (): 'WhatsApp' | 'Instagram' | 'Facebook' | 'TikTok' | null => {
    try {
        const ua = navigator.userAgent || '';
        if (/Instagram/i.test(ua)) return 'Instagram';
        if (/FBAN|FBAV|FB_IAB|FBIOS/.test(ua)) return 'Facebook';
        if (/musical_ly|BytedanceWebview|TikTok/i.test(ua)) return 'TikTok';
        if (/WhatsApp/i.test(ua)) return 'WhatsApp';
    } catch { /* sin navigator */ }
    return null;
};

export const NOMBRE_PLATAFORMA: Record<Plataforma, string> = {
    iphone: 'iPhone',
    ipad: 'iPad',
    android: 'Android',
    compu: 'Compu',
};

// ── El aviso de instalación de Chrome ───────────────────────────────────

/** Lo que dispara Chrome cuando la web cumple los requisitos para instalarse. */
interface EventoDeInstalacion extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let eventoGuardado: EventoDeInstalacion | null = null;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach(f => f());

/**
 * Se llama UNA vez, al arrancar (index.tsx).
 *
 * Chrome dispara beforeinstallprompt una sola vez y temprano, muchas veces
 * antes de que se monte la pantalla que lo quiere usar. Si nadie lo escucha en
 * ese momento, se pierde hasta la próxima carga. Por eso se guarda acá, fuera
 * de React, y la tarjeta lo levanta cuando aparece.
 */
export const escucharInstalacion = (): void => {
    try {
        window.addEventListener('beforeinstallprompt', (e) => {
            // Sin esto Chrome muestra su propia barrita, aparte de la tarjeta.
            e.preventDefault();
            eventoGuardado = e as EventoDeInstalacion;
            avisar();
        });
        window.addEventListener('appinstalled', () => {
            eventoGuardado = null;
            avisar();
        });
    } catch { /* navegador sin eventos de instalación */ }
};

/**
 * Muestra el cuadro de instalación de Chrome. Devuelve si la persona aceptó.
 * El evento sirve una sola vez: después de usarlo, se descarta.
 */
export const pedirInstalacion = async (): Promise<boolean> => {
    const ev = eventoGuardado;
    if (!ev) return false;
    eventoGuardado = null;
    avisar();
    try {
        await ev.prompt();
        const { outcome } = await ev.userChoice;
        return outcome === 'accepted';
    } catch {
        return false;
    }
};

export interface EstadoDeInstalacion {
    plataforma: Plataforma;
    instalada: boolean;
    /** Chrome ofrece instalarla con un botón (sólo Android y compu). */
    puedeInstalar: boolean;
}

export const useInstalacion = (): EstadoDeInstalacion => {
    const [, refrescar] = useState(0);
    useEffect(() => {
        const f = () => refrescar(n => n + 1);
        oyentes.add(f);
        // Abrirla desde el ícono no cambia en el medio, pero instalarla desde
        // el menú de Chrome sí cambia display-mode con la página abierta.
        let mq: MediaQueryList | null = null;
        try {
            mq = window.matchMedia('(display-mode: standalone)');
            mq.addEventListener?.('change', f);
        } catch { /* sin matchMedia */ }
        return () => {
            oyentes.delete(f);
            mq?.removeEventListener?.('change', f);
        };
    }, []);
    return { plataforma: plataforma(), instalada: estaInstalada(), puedeInstalar: !!eventoGuardado };
};

// ── "Ahora no" ──────────────────────────────────────────────────────────

const CLAVE_POSPUESTA = 'origen_instalar_pospuesta';
const TREINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;

export const tarjetaPospuesta = (): boolean => {
    try {
        const t = Number(localStorage.getItem(CLAVE_POSPUESTA) || 0);
        return t > 0 && Date.now() - t < TREINTA_DIAS_MS;
    } catch {
        return false;
    }
};

export const posponerTarjeta = (): void => {
    try { localStorage.setItem(CLAVE_POSPUESTA, String(Date.now())); } catch { /* sin storage: se oculta hasta recargar */ }
};
