/**
 * Qué medios tiene que esperar la pantalla de entrada antes de destapar la app.
 *
 * El velo de entrada (App.tsx + PantallaCargaApp) ya esperaba a que llegaran
 * la sesión y los roles, porque sin ellos el menú se armaba a la vista. Pero
 * el Home tiene además dos piezas pesadas que llegan después: el video del
 * hero y el banner de Origen Música. Con los roles listos el velo se iba, y
 * arriba de todo quedaba un rectángulo negro que recién un segundo más tarde
 * se llenaba con el video.
 *
 * Esto es el canal entre los dos: la pantalla que tiene medios pesados avisa
 * "esperame", y avisa de nuevo cuando ya los tiene. App.tsx escucha. Es un
 * registro suelto a propósito, sin contexto de React: Home se monta DETRÁS
 * del velo, dentro de <Routes>, y pasarle un prop desde arriba obligaría a
 * enhebrarlo por el Layout y todas las rutas.
 *
 * Dos cosas que no son negociables:
 *
 * 1 · Nadie se queda esperando para siempre. Quien reserva libera sí o sí
 *     —con el medio cargado, roto o tardón— y App.tsx tiene además su propio
 *     tope. Un velo que no se va es peor que un video que entra tarde.
 *
 * 2 · Si nadie reservó, no se espera nada. Entrar a /gcx o a /reportes no
 *     tiene por qué pagar el video del Home.
 */

type Oyente = () => void;

const pendientes = new Set<string>();
const oyentes = new Set<Oyente>();

const avisar = () => { oyentes.forEach(f => f()); };

/** "Esperame esto antes de destapar". */
export const reservarMedia = (clave: string): void => {
    if (pendientes.has(clave)) return;
    pendientes.add(clave);
    avisar();
};

/** "Ya está" — tanto si cargó como si falló. */
export const liberarMedia = (clave: string): void => {
    if (pendientes.delete(clave)) avisar();
};

export const hayMediaPendiente = (): boolean => pendientes.size > 0;

export const suscribirMedia = (f: Oyente): (() => void) => {
    oyentes.add(f);
    return () => { oyentes.delete(f); };
};

/** El tope de App.tsx: se deja de esperar a todos de una. */
export const olvidarMedia = (): void => {
    if (pendientes.size === 0) return;
    pendientes.clear();
    avisar();
};

/**
 * Baja un medio al caché del navegador y avisa cuando se puede ver.
 *
 * Para el video espera `loadeddata` —el primer cuadro, no el archivo entero—:
 * es el momento en el que el `<video>` real deja de ser un rectángulo negro.
 * Esperar `canplaythrough` sería esperar varios megabytes que nadie necesita
 * todavía, y hay navegadores donde con la pestaña en segundo plano no llega
 * nunca.
 *
 * NUNCA rechaza y nunca tarda más que `tope`: un medio roto o un servidor
 * lento resuelven igual. Lo que se gana con esto es que el elemento de
 * verdad, cuando se monte, encuentre los bytes en el caché.
 */
export const precargarMedia = (
    url: string | undefined,
    tipo: 'image' | 'video',
    tope = 5000,
): Promise<void> => new Promise<void>(resolve => {
    if (!url) { resolve(); return; }

    let terminado = false;
    let reloj = 0;

    const terminar = () => {
        if (terminado) return;
        terminado = true;
        window.clearTimeout(reloj);
        resolve();
    };

    reloj = window.setTimeout(terminar, tope);

    if (tipo === 'video') {
        const v = document.createElement('video');
        v.preload = 'auto';
        v.muted = true;
        v.playsInline = true;
        v.addEventListener('loadeddata', terminar, { once: true });
        v.addEventListener('error', terminar, { once: true });
        v.src = url;
        // Safari no arranca la descarga sin esto cuando el elemento no está
        // en el documento.
        v.load();
        return;
    }

    const img = new Image();
    img.onload = terminar;
    img.onerror = terminar;
    img.src = url;
    // Si ya estaba en caché, `onload` puede no volver a dispararse.
    if (img.complete) terminar();
});
