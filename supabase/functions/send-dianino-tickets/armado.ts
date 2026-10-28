// Lo que arma send-dianino-tickets, separado de index.ts para poder probarlo
// sin levantar el servidor. Sin dependencias de Deno: se prueba con Node.
//
// El email no cambia de aspecto: ya estaba maquetado con tablas, con bgcolor y
// con las meta color-scheme (sección 35). Lo que cambió el 2026-10-28 es que
// el nombre de quien se inscribió ahora va escapado. Antes entraba crudo al
// HTML y, peor, al atributo alt del <img> del QR: un nombre con una comilla
// doble se salía del atributo.

/**
 * Emails por día (hora argentina).
 *
 * Con la clave de servicio ya pedida, nadie de afuera puede hacer salir uno:
 * el tope dejó de ser una defensa y pasó a ser un freno de mano contra un
 * bucle o un trigger mal puesto. Por eso queda ARRIBA del pico real (83
 * sesiones en un día, el 2026-08-09, con 15,5 de promedio en los 14 días de
 * inscripción) y no abajo: un tope que corta emails de verdad esconde el
 * problema en vez de mostrarlo. Lo que de verdad limita son los 100 por día
 * de Resend, que sí devuelve error y queda anotado.
 */
export const TOPE_EMAILS_DIA = 90;

/** El único destinatario del modo de prueba. Fijo: el pedido no lo elige. */
export const DESTINO_PRUEBA = 'sistemas@origeniglesia.org';

/** Todo lo que entra al HTML pasa por acá: el nombre lo escribe cualquiera. */
export function escaparHtml(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** "Nombre Apellido", con lo que haya. */
export function nombreCompleto(nombre: unknown, apellido: unknown): string {
  return [nombre, apellido].map(x => String(x ?? '').trim()).filter(Boolean).join(' ');
}

/** Una fila por sesión: si el email ya salió, no sale de nuevo. */
export const claveSesion = (sesionId: string) => `dianino:${sesionId}`;

/** El inicio del día de hoy en Argentina, para el tope diario. */
export function inicioDelDiaArgentino(ahora = new Date()): string {
  const fecha = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(ahora);
  return new Date(`${fecha}T00:00:00-03:00`).toISOString();
}

export const ASUNTO = '🎉 ¡Tus entradas para el Día del Niño!';

/** Lo que manda el modo de prueba: datos inventados, sólo a Sistemas. */
export const DATOS_DE_PRUEBA = {
  nombre: 'Familia <PRUEBA>',
  apellido: '& Cía',
};
