// Lo que arma send-gcx-welcome, separado de index.ts para poder probarlo sin
// levantar el servidor. Sin dependencias de Deno: se prueba con Node.
//
// El email no cambia de aspecto. Lo que cambió el 2026-10-28 es que el nombre
// de quien se inscribió y los datos del grupo (nombre, día, hora, lugar,
// descripción, anfitrión) ahora van escapados: los escribe el anfitrión al
// crear el grupo y antes entraban crudos al HTML.

/**
 * Emails por día (hora argentina).
 *
 * Con la clave de servicio ya pedida, nadie de afuera puede hacer salir uno:
 * el tope dejó de ser una defensa y pasó a ser un freno de mano contra un
 * bucle o un reenvío masivo mal apretado. Por eso queda ARRIBA del pico real
 * (71 inscripciones aprobadas en un día, con 6,6 de promedio en los 138 días
 * con actividad) y no abajo: un tope que corta emails de verdad esconde el
 * problema. Lo que de verdad limita son los 100 por día de Resend.
 */
export const TOPE_EMAILS_DIA = 80;

/** Cuántas inscripciones puede pedir un reenvío de una sola vez. */
export const TOPE_POR_REENVIO = 100;

/** El único destinatario del modo de prueba. Fijo: el pedido no lo elige. */
export const DESTINO_PRUEBA = 'sistemas@origeniglesia.org';

/** Todo lo que entra al HTML pasa por acá. */
export function escaparHtml(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Para el asunto: una sola línea, sin saltos, y corto. */
export function enUnaLinea(v: unknown, largo = 120): string {
  const s = String(v ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length > largo ? `${s.slice(0, largo - 1)}…` : s;
}

/** "Nombre Apellido", con lo que haya. */
export function nombreCompleto(nombre: unknown, apellido: unknown): string {
  return [nombre, apellido].map(x => String(x ?? '').trim()).filter(Boolean).join(' ');
}

export const asunto = (nombreDelGrupo: string) => enUnaLinea(`¡Bienvenido/a a GCX! - ${nombreDelGrupo}`);

/**
 * Las claves de lo ya hecho (tabla gcx_welcome_hechos).
 *
 * El automático lleva una sola clave por inscripción: una aprobación, un
 * email. El reenvío a mano NO puede ser idempotente para siempre —reenviar es
 * justo lo que el botón hace—, así que lleva la fecha: una vez por día y por
 * inscripción, que frena el doble clic sin romper la función del botón.
 */
export const claveAuto = (inscripcionId: string) => `gcx:auto:${inscripcionId}`;
export const claveReenvio = (inscripcionId: string, dia: string) => `gcx:reenvio:${inscripcionId}:${dia}`;

/** El inicio del día de hoy en Argentina, para el tope diario. */
export function inicioDelDiaArgentino(ahora = new Date()): string {
  const fecha = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(ahora);
  return new Date(`${fecha}T00:00:00-03:00`).toISOString();
}

/** El día de hoy en Argentina, AAAA-MM-DD, para la clave del reenvío. */
export function diaArgentino(ahora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(ahora);
}

/** Lo que manda el modo de prueba: datos inventados, sólo a Sistemas. */
export const DATOS_DE_PRUEBA = {
  nombre: 'Persona <PRUEBA>',
  apellido: '& Cía',
  grupo: {
    id: '00000000-0000-4000-8000-000000000000',
    name: 'Grupo "PRUEBA" <b>',
    meeting_day: 'martes',
    meeting_time: '20:00',
    location: 'Casa de PRUEBA & Cía',
    description: 'Un grupo de prueba, con <script>alert(1)</script> adentro.',
    leader_name: 'Hugo',
    leader_surname: 'PRUEBA',
    start_date: '2026-11-03',
  },
};
