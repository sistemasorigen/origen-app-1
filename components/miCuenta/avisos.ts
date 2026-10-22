/**
 * En qué estado están los avisos de este celular.
 *
 * Los cinco casos del .dc, decididos en un solo lugar para que la fila del
 * índice y el panel de ayuda nunca digan cosas distintas.
 *
 * LO QUE HAY HOY, Y LO QUE NO. usePushNotifications es la API Notification
 * del navegador y nada más: no hay service worker, no hay suscripción y no
 * hay nada guardado en el servidor. Eso tiene una consecuencia que la
 * pantalla no puede esconder: una vez que la persona dio permiso, la página
 * NO puede quitárselo. Sólo el navegador puede. Por eso 'prendido' no es un
 * interruptor que se pueda apagar desde acá, y se dice en vez de fingirlo.
 */

export type EstadoDeAvisos =
    /** Se puede prender: todavía no se pidió permiso. */
    | 'apagado'
    /** Ya está prendido. Apagarlo se hace en el navegador. */
    | 'prendido'
    /** Lo bloqueó en el navegador: hay que ir a los ajustes del sitio. */
    | 'bloqueado'
    /** iPhone sin la app agregada al inicio: ahí los avisos no existen. */
    | 'iphone'
    /** El navegador no los soporta. */
    | 'no_soportado';

/** ¿Es un iPhone o iPad? Safari y también Chrome en iOS, que es Safari. */
export const esIOS = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    // iPadOS 13+ se presenta como Mac; lo delata que tenga pantalla táctil.
    return /Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document;
};

/** ¿Se abrió desde el ícono de la pantalla de inicio y no desde el navegador? */
export const estaInstalada = (): boolean => {
    if (typeof window === 'undefined') return false;
    if ((navigator as any).standalone === true) return true;
    try {
        return window.matchMedia('(display-mode: standalone)').matches;
    } catch {
        return false;
    }
};

export const estadoDeAvisos = (
    soportado: boolean,
    permiso: NotificationPermission,
): EstadoDeAvisos => {
    // El iPhone va PRIMERO. Sin la app en el inicio, Safari ni siquiera
    // define Notification, así que caería en "no soportado" —que es verdad,
    // pero no sirve: lo que esta persona necesita saber es que se arregla
    // agregando Origen a su pantalla de inicio.
    if (esIOS() && !estaInstalada()) return 'iphone';
    if (!soportado) return 'no_soportado';
    if (permiso === 'denied') return 'bloqueado';
    if (permiso === 'granted') return 'prendido';
    return 'apagado';
};

/** La línea que va debajo del nombre de la fila. */
export const detalleDeAvisos = (estado: EstadoDeAvisos): string => ({
    apagado: '',
    prendido: 'Para apagarlos, hacelo desde los ajustes del navegador.',
    bloqueado: 'Los bloqueaste en el navegador.',
    iphone: 'En iPhone, primero agregá Origen a tu pantalla de inicio.',
    no_soportado: 'Este navegador no permite avisos. Probá con Chrome, o instalá Origen en tu pantalla de inicio.',
}[estado]);

/** El texto del enlace de ayuda, o '' si ese estado no tiene ayuda. */
export const ayudaDeAvisos = (estado: EstadoDeAvisos): string => ({
    apagado: '',
    prendido: 'Cómo apagarlos',
    bloqueado: 'Cómo activarlos',
    iphone: 'Cómo hacerlo',
    no_soportado: '',
}[estado]);

/** Los pasos del panel, por sistema. */
export const PASOS_ANDROID = [
    'Tocá el candado que está a la izquierda de la dirección, arriba.',
    'Entrá a «Permisos» y después a «Notificaciones».',
    'Elegí «Permitir» y volvé a Origen. El interruptor se va a poder prender.',
];

export const PASOS_IPHONE_AJUSTES = [
    'Abrí la app Ajustes del iPhone y entrá a «Notificaciones».',
    'Buscá «Origen» en la lista de apps.',
    'Prendé «Permitir notificaciones» y volvé a Origen.',
];

export const PASOS_INSTALAR = [
    'Abrí app.origeniglesia.org en Safari.',
    'Tocá el botón Compartir, el cuadrado con la flecha hacia arriba.',
    'Bajá y elegí «Agregar a inicio».',
    'Abrí Origen desde el ícono nuevo y prendé los avisos desde Mi cuenta.',
];

export const PASOS_APAGAR = [
    'Tocá el candado que está a la izquierda de la dirección, arriba.',
    'Entrá a «Permisos» y después a «Notificaciones».',
    'Elegí «Bloquear». Vas a seguir viendo los avisos adentro de la app.',
];
