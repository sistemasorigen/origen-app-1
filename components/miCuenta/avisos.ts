/**
 * En qué estado están las notificaciones de este dispositivo.
 *
 * Los cinco casos, decididos en un solo lugar para que la fila de Mi cuenta,
 * su pantalla y la tarjeta de Notificaciones nunca digan cosas distintas.
 *
 * Desde octubre de 2026 son notificaciones push de verdad (service worker +
 * suscripción guardada en la base, src/utils/push.ts): llegan con la app
 * cerrada, y el interruptor se puede apagar desde acá, porque apagar es
 * borrar la suscripción. Lo único que la página no puede tocar es el permiso
 * del navegador: si lo bloquearon, se destraba en los ajustes.
 */

import { estaInstalada as instalada, plataforma } from '../../src/utils/instalacion';

export type EstadoDeAvisos =
    /** Se puede prender. */
    | 'apagado'
    /** Este dispositivo está suscripto. */
    | 'prendido'
    /** Lo bloqueó en el navegador: hay que ir a los ajustes. */
    | 'bloqueado'
    /** iPhone sin la app agregada al inicio: ahí los push no existen. */
    | 'iphone'
    /** El navegador no los soporta. */
    | 'no_soportado';

/** ¿Es un iPhone o iPad? Safari y también Chrome en iOS, que es Safari. */
export const esIOS = (): boolean => {
    const p = plataforma();
    return p === 'iphone' || p === 'ipad';
};

/** ¿Se abrió desde el ícono de la pantalla de inicio y no desde el navegador? */
export const estaInstalada = instalada;

export const estadoDeAvisos = (
    soportado: boolean,
    permiso: NotificationPermission,
    suscripto: boolean,
): EstadoDeAvisos => {
    // El iPhone va PRIMERO. Sin la app en el inicio, Safari ni siquiera
    // tiene push, así que caería en "no soportado" —que es verdad, pero no
    // sirve: lo que esta persona necesita saber es que se arregla instalando
    // Origen en su pantalla de inicio.
    if (esIOS() && !estaInstalada()) return 'iphone';
    if (!soportado) return 'no_soportado';
    if (permiso === 'denied') return 'bloqueado';
    if (permiso === 'granted' && suscripto) return 'prendido';
    return 'apagado';
};

/** La línea que va debajo del nombre de la fila. */
export const detalleDeAvisos = (estado: EstadoDeAvisos): string => ({
    apagado: 'Para enterarte aunque tengas la app cerrada.',
    prendido: 'Te llegan aunque tengas la app cerrada.',
    bloqueado: 'Las bloqueaste en este dispositivo.',
    iphone: 'En iPhone, primero instalá la app en tu inicio.',
    no_soportado: 'Este navegador no permite notificaciones. Probá con Chrome, o instalá Origen en tu pantalla de inicio.',
}[estado]);

/** El texto del enlace de ayuda, o '' si ese estado no tiene ayuda. */
export const ayudaDeAvisos = (estado: EstadoDeAvisos): string => ({
    apagado: '',
    prendido: 'Mis dispositivos y prueba',
    bloqueado: 'Cómo activarlas',
    iphone: 'Cómo instalarla',
    no_soportado: '',
}[estado]);

/** Los pasos para destrabar el permiso, por sistema. */
export const PASOS_ANDROID = [
    'Si usás Origen instalada: mantené apretado su ícono, tocá «Información de la app» y entrá a «Notificaciones».',
    'Si la usás en Chrome: tocá el candado que está a la izquierda de la dirección y entrá a «Permisos» → «Notificaciones».',
    'Elegí «Permitir» y volvé a Origen. El interruptor se va a poder prender.',
];

export const PASOS_IPHONE_AJUSTES = [
    'Abrí la app Ajustes del iPhone y entrá a «Notificaciones».',
    'Buscá «Origen» en la lista de apps.',
    'Prendé «Permitir notificaciones» y volvé a Origen.',
];
