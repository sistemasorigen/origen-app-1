// Lo que arma notify-host, separado de index.ts para poder probarlo sin
// levantar el servidor (index.ts llama a serve() al importarse). Sin
// dependencias de Deno: se prueba con Node.
//
// Los textos de los avisos son LOS MISMOS que mandaba la versión anterior
// (versionada tal cual en el commit "chore: versiona notify-host…"): lo que
// ven los anfitriones no cambia. Lo que cambia es el email: todo lo que
// escribió quien se inscribe va escapado, se ve en el modo oscuro de Gmail y
// el botón lleva directo a las solicitudes del grupo.

/** Un aviso para la tabla app_notifications. */
export interface Aviso {
  title: string;
  message: string;
  type: string;
  action_url: string;
}

/** Emails por día (hora argentina). Ver TOPE_EMAILS_DIA en el reporte. */
export const TOPE_EMAILS_DIA = 30;

/** El único destinatario del modo de prueba. Fijo: el pedido no lo elige. */
export const DESTINO_PRUEBA = "sistemas@origeniglesia.org";

export const URL_APP = "https://app.origeniglesia.org";

/** Todo lo que entra al HTML pasa por acá: el nombre lo escribe cualquiera. */
export function escaparHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Para el asunto: una sola línea, sin saltos, y corto. */
export function enUnaLinea(v: unknown, largo = 120): string {
  const s = String(v ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  return s.length > largo ? `${s.slice(0, largo - 1)}…` : s;
}

/** "Nombre Apellido", con lo que haya. */
export function nombreCompleto(nombre: unknown, apellido: unknown): string {
  return [nombre, apellido].map(x => String(x ?? "").trim()).filter(Boolean).join(" ");
}

/**
 * Anfitrión y co-anfitrión, sin repetir y sin vacíos. Si el co-anfitrión es
 * la misma persona que el anfitrión (pasa: hay 3 grupos así), un solo aviso
 * y un solo email — antes le llegaban dos.
 */
export function destinatarios(hostId: string | null | undefined, coHostId: string | null | undefined): string[] {
  return [...new Set([hostId, coHostId].filter((x): x is string => !!x))];
}

/** El aviso de una inscripción nueva: idéntico al de antes. */
export function avisoInscripcion(nombre: string, grupo: string): Aviso {
  return {
    title: "Nueva solicitud de ingreso 👤",
    message: `${nombre} quiere unirse a "${grupo}". Revisá las solicitudes pendientes.`,
    type: "info",
    action_url: "/",
  };
}

/** El aviso de grupo aprobado: idéntico al de antes. */
export function avisoGrupoAprobado(grupo: string): Aviso {
  return {
    title: "¡Tu grupo fue aprobado! 🎉",
    message: `El grupo "${grupo}" fue aprobado y ya está visible en la app.`,
    type: "success",
    action_url: "/",
  };
}

/**
 * Las claves de lo ya hecho (tabla notify_host_hechos): una por aviso y una
 * por email, por inscripción y por destinatario. Si la función corre dos
 * veces para la misma inscripción, la segunda no repite nada.
 */
export const claveAviso = (registroId: string, userId: string) => `reg:${registroId}:aviso:${userId}`;
export const claveEmail = (registroId: string, userId: string) => `reg:${registroId}:email:${userId}`;

/** El inicio del día de hoy en Argentina, para el tope diario. */
export function inicioDelDiaArgentino(ahora = new Date()): string {
  const fecha = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(ahora);
  return new Date(`${fecha}T00:00:00-03:00`).toISOString();
}

/**
 * El email al anfitrión: el mismo contenido que antes (título azul, "Hola
 * Anfitrión", el grupo, quién se inscribió y el botón), pero:
 *   · con el nombre y el grupo escapados (antes iban crudos en el HTML);
 *   · maquetado con tablas y con bgcolor + style en cada celda, y las meta
 *     color-scheme, para el modo oscuro de Gmail (sección 35);
 *   · el botón lleva a /#/mis-grupos/<grupo>/solicitudes (antes, al inicio,
 *     sin /#/).
 */
export function emailInscripcion(p: { nombre: string; grupo: string; grupoId: string }): { asunto: string; html: string } {
  const nombre = escaparHtml(p.nombre);
  const grupo = escaparHtml(p.grupo);
  const link = `${URL_APP}/#/mis-grupos/${encodeURIComponent(p.grupoId)}/solicitudes`;
  const asunto = enUnaLinea(`Nueva solicitud de: ${p.nombre}`);
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escaparHtml(asunto)}</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;">
  <tr>
    <td align="left" bgcolor="#ffffff" style="background-color:#ffffff;padding:20px;font-family:Arial, Helvetica, sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width:600px;background-color:#ffffff;">
        <tr>
          <td bgcolor="#ffffff" style="background-color:#ffffff;font-family:Arial, Helvetica, sans-serif;color:#1a1a1a;font-size:16px;line-height:1.5;">
            <h2 style="margin:0 0 16px;color:#0056b3;font-size:22px;">Nueva solicitud de ingreso al grupo</h2>
            <p style="margin:0 0 12px;color:#1a1a1a;">Hola Anfitrión,</p>
            <p style="margin:0 0 12px;color:#1a1a1a;">Tenés una nueva solicitud de inscripción para tu Grupo de Conexión <strong>"${grupo}"</strong>.</p>
            <p style="margin:0 0 20px;color:#1a1a1a;"><strong>Usuario:</strong> ${nombre}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="#0056b3" style="background-color:#0056b3;border-radius:5px;">
                  <a href="${link}" style="display:inline-block;padding:10px 20px;color:#ffffff;text-decoration:none;font-family:Arial, Helvetica, sans-serif;font-size:16px;">Revisar Solicitud</a>
                </td>
              </tr>
            </table>
            <p style="margin:20px 0 0;color:#555555;font-size:13px;">Si el botón no funciona, entrá a ${URL_APP}/#/mis-grupos</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
  return { asunto, html };
}

/** Lo que manda el modo de prueba: datos inventados, sólo a Sistemas. */
export const DATOS_DE_PRUEBA = {
  nombre: "Persona <PRUEBA> & Cía",
  grupo: 'Grupo "PRUEBA"',
  grupoId: "00000000-0000-4000-8000-000000000000",
};
