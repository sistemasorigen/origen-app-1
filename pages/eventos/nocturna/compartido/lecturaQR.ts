/**
 * Las decisiones del escáner que no dependen de la pantalla ni de la cámara.
 *
 * Están acá para poder probarlas: con la cámara de por medio, la única forma
 * de verificarlas sería tener un celular en la mano.
 */

/** El QR de Nocturna lleva el `inscripcion_id` y nada más. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const esUUID = (texto: string): boolean => UUID.test((texto || '').trim());

/**
 * El código de entrada: 6 caracteres de un alfabeto sin ambiguos.
 *
 * Es el mismo de `nocturna_generar_codigo` en la base —sin 0 ni O, sin 1, I ni
 * L— porque se lee en voz alta en la puerta. Vive acá además del QR porque
 * son dos formas de nombrar la misma entrada: el QR cuando la cámara anda, el
 * código cuando no.
 */
const CODIGO = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

/**
 * Lo que alguien tipea, listo para buscar.
 *
 * A las 6 de la mañana el código se dicta en voz alta o se copia de un email:
 * llega en minúscula, con espacios, a veces con un guión en el medio. Nada de
 * eso cambia de qué entrada se está hablando.
 */
export const normalizarCodigo = (texto: string): string =>
    (texto || '').toUpperCase().replace(/[^0-9A-Z]/g, '');

/** Si lo escrito tiene forma de código de entrada. */
export const esCodigoDeEntrada = (texto: string): boolean => CODIGO.test(normalizarCodigo(texto));

/**
 * Cuánto se ignora el mismo código después de cerrar su panel.
 *
 * Al cerrar, la familia todavía tiene el celular levantado frente a la
 * cámara: sin esta ventana, el panel se vuelve a abrir solo.
 */
export const MS_MISMO_CODIGO = 4000;

export interface UltimaLectura {
    texto: string;
    at: number;
}

/**
 * Si esta lectura de la cámara hay que ignorarla.
 *
 * `html5-qrcode` dispara el callback varias veces por segundo mientras el
 * código siga en el cuadro. Sin este freno, la misma entrada se procesa
 * decenas de veces y se encimarían paneles de la misma familia.
 *
 * Sólo aplica a la cámara. Cuando alguien escribe un código a mano y toca
 * "Buscar", está pidiendo esa lectura a propósito, aunque sea la misma de
 * hace un segundo: ahí no se ignora nada.
 */
export const esLecturaRepetida = (
    ultima: UltimaLectura | null,
    texto: string,
    ahora: number,
): boolean => {
    if (!ultima) return false;
    if (ultima.texto !== (texto || '').trim()) return false;
    return ahora - ultima.at < MS_MISMO_CODIGO;
};
