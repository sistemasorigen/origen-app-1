// Service worker de Origen: SÓLO notificaciones push.
//
// NO CACHEA NADA, y tiene que seguir así. No hay listener de fetch, no se usa
// la Cache API, no hay precache ni workbox. Un service worker que cachea deja
// a la gente con una versión vieja de la app, que es justo el problema que se
// arregló en octubre de 2026 (sección 27 de instrucciones_ia.md). Sin listener
// de fetch, todas las páginas y archivos se piden a la red como si este
// archivo no existiera.
//
// Escucha tres cosas:
//   · push                  → muestra la notificación (siempre).
//   · notificationclick     → abre la app en la ruta del aviso.
//   · pushsubscriptionchange → vuelve a suscribir; la app guarda la nueva al
//                              abrirse (src/utils/push.ts → resincronizar).
//
// Lo que llega en el push lo arma supabase/functions/send-push/armado.ts:
//   { title, body, url, tag, badge }

const ICONO = '/iconos/icon-192.png';
const ICONO_CHICO = '/iconos/badge-96.png';

/** Sólo rutas internas de la app. Cualquier otra cosa lleva al inicio. */
const rutaInterna = (url) => {
    const u = typeof url === 'string' ? url.trim() : '';
    if (!u.startsWith('/') || u.startsWith('//') || u.includes('\\')) return '/';
    if (/[\u0000-\u001f]/.test(u)) return '/';
    return u;
};

self.addEventListener('push', (event) => {
    let datos = {};
    try {
        datos = event.data ? event.data.json() : {};
    } catch (e) {
        // Un push que no es JSON igual se muestra: si un push no muestra
        // nada, iOS da de baja la suscripción.
        datos = { body: event.data ? event.data.text() : '' };
    }

    const titulo = typeof datos.title === 'string' && datos.title ? datos.title : 'Origen';
    const tareas = [
        self.registration.showNotification(titulo, {
            body: typeof datos.body === 'string' ? datos.body : '',
            icon: ICONO,
            badge: ICONO_CHICO,
            // El mismo aviso no se apila dos veces.
            tag: typeof datos.tag === 'string' && datos.tag ? datos.tag : undefined,
            data: { url: rutaInterna(datos.url) },
        }),
    ];

    // El número en el ícono de la app (iPhone instalada, Android, compu).
    const n = Number(datos.badge);
    if (Number.isFinite(n) && n >= 0 && self.navigator && 'setAppBadge' in self.navigator) {
        tareas.push((n > 0 ? self.navigator.setAppBadge(n) : self.navigator.clearAppBadge()).catch(() => {}));
    }

    event.waitUntil(Promise.all(tareas));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const ruta = rutaInterna(event.notification.data && event.notification.data.url);
    // HashRouter: toda la ruta va después del #.
    const destino = new URL('/#' + ruta, self.location.origin).href;

    event.waitUntil((async () => {
        const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const propia = ventanas.find((v) => new URL(v.url).origin === self.location.origin);
        if (propia) {
            await propia.focus();
            // navigate() sólo anda en ventanas controladas por este worker;
            // si no, se le pide a la página que cambie el hash ella misma.
            try {
                await propia.navigate(destino);
            } catch (e) {
                propia.postMessage({ tipo: 'origen-ir-a', ruta });
            }
            return;
        }
        await self.clients.openWindow(destino);
    })());
});

self.addEventListener('pushsubscriptionchange', (event) => {
    // El navegador cambió la suscripción (venció o la renovó). Se vuelve a
    // suscribir con la misma clave pública. El worker no tiene la sesión de
    // la persona, así que no puede guardarla en la base: lo hace la app la
    // próxima vez que se abre (resincronizar() guarda la que encuentre). La
    // vieja, si el servicio de push la da por muerta, la borra send-push.
    const anterior = event.oldSubscription;
    const clave = anterior && anterior.options ? anterior.options.applicationServerKey : null;
    if (!clave) return;
    event.waitUntil(
        self.registration.pushManager
            .subscribe({ userVisibleOnly: true, applicationServerKey: clave })
            .catch(() => {})
    );
});
