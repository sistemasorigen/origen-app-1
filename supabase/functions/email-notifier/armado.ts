// Lo que arma email-notifier, separado de index.ts para poder probarlo sin
// levantar el servidor (index.ts llama a serve() al importarse). Sin
// dependencias de Deno: se prueba con Node.
//
// Los asuntos y los textos son LOS MISMOS que mandaba la versión anterior
// (versionada tal cual en el commit "chore: versiona 7 edge functions tal
// como están en producción"). Lo que cambia es de dónde salen los datos (de
// la base, por id, en vez del cuerpo del pedido) y el HTML, que ahora escapa
// todo lo que escribió una persona y se ve en el modo oscuro de Gmail.

/** Los cinco avisos que manda esta función. El trigger manda uno de estos. */
export type Evento =
  | 'grupo_nuevo'
  | 'postulacion'
  | 'grupo_aprobado'
  | 'nuevo_anfitrion'
  | 'ingresante';

export const EVENTOS: Evento[] = [
  'grupo_nuevo', 'postulacion', 'grupo_aprobado', 'nuevo_anfitrion', 'ingresante',
];

export const esEvento = (v: unknown): v is Evento => EVENTOS.includes(v as Evento);

/**
 * Emails por día (hora argentina) para toda la función.
 *
 * El pico histórico de un día es de 33 ingresantes de Bienvenida (un domingo),
 * 10 grupos nuevos y 8 postulaciones. Los ingresantes son uno por email a una
 * sola casilla interna, así que 40 cubre el peor día visto con margen. Pasado
 * el tope el email no sale y queda anotado: la fila sigue en la base y el
 * recordatorio semanal de Bienvenida vuelve a avisar.
 */
export const TOPE_EMAILS_DIA = 40;

/** El único destinatario del modo de prueba. Fijo: el pedido no lo elige. */
export const DESTINO_PRUEBA = 'sistemas@origeniglesia.org';

/** Bienvenida recibe los avisos de ingresantes. Fijo, nunca viene del pedido. */
export const DESTINO_BIENVENIDA = 'bienvenida@origeniglesia.org';

export const URL_APP = 'https://app.origeniglesia.org';

/** Todo lo que entra al HTML pasa por acá: estos datos los escribe cualquiera. */
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

/** Lo que mostraba la versión anterior cuando el dato venía vacío. */
export function oNoProporcionado(v: unknown): string {
  const s = String(v ?? '').trim();
  return s === '' ? 'No proporcionado' : s;
}

/** El inicio del día de hoy en Argentina, para el tope diario. */
export function inicioDelDiaArgentino(ahora = new Date()): string {
  const fecha = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(ahora);
  return new Date(`${fecha}T00:00:00-03:00`).toISOString();
}

/**
 * La clave de lo ya hecho (tabla email_notifier_hechos): evento, fila y
 * destinatario. Sin direcciones de email adentro: para los admins va su
 * posición en la lista, y para una persona, su id.
 */
export const clave = (evento: Evento, id: string, destino: string) => `${evento}:${id}:${destino}`;

/** ADMIN_NOTIFICATION_EMAILS viene como "uno@x, dos@y". */
export function listaDeAdmins(raw: string | null | undefined): string[] {
  return String(raw ?? '').split(',').map(e => e.trim()).filter(Boolean);
}

/** Fecha larga en español, como la armaba la plantilla anterior. */
export function fechaLarga(iso: string, conHora: boolean): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-AR', conHora
    ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

/** Días enteros desde una fecha. Igual que antes: Math.floor. */
export function diasDesde(iso: string, ahora = new Date()): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.floor((ahora.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

/** Los asuntos: palabra por palabra los de antes. */
export const ASUNTO_GRUPO_NUEVO = '🚩 Nuevo Grupo para Revisión - Origen';
export const ASUNTO_POSTULACION = '📋 Nueva Postulación para Anfitrión - Origen';
export const ASUNTO_GRUPO_APROBADO = '✅ ¡Tu Grupo ha sido Aprobado! - Origen';
export const ASUNTO_NUEVO_ANFITRION = '🎉 ¡Bienvenido como Anfitrión de Origen!';
export const asuntoIngresante = (nombre: string, apellido: string) =>
  enUnaLinea(`🙋 Nuevo Ingresante: ${nombreCompleto(nombre, apellido)} — Origen`);

/** Lo que manda el modo de prueba: datos inventados, sólo a Sistemas. */
export const DATOS_DE_PRUEBA = {
  grupo: 'Grupo <PRUEBA> & Cía',
  persona: { nombre: 'Persona <PRUEBA>', apellido: '& Cía' },
  telefono: '+54 9 11 0000-0000',
  email: 'prueba@ejemplo.org',
  edad: '33',
  grupoId: '00000000-0000-4000-8000-000000000000',
  creado: '2026-10-28T13:00:00-03:00',
};
