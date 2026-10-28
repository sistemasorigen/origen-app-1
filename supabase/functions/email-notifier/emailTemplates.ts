// Las plantillas de email de email-notifier (y la del recordatorio semanal,
// que usa welcome-reminder).
//
// Los TEXTOS son exactamente los de antes. Lo que cambió el 2026-10-28:
//   · todo lo que escribió una persona (nombres, teléfonos, el nombre de un
//     grupo) pasa por escaparHtml: antes entraba crudo al HTML y servía para
//     armar un email con la marca de Origen y el contenido que quisiera
//     quien llamara a la función;
//   · maquetado con tablas, con bgcolor Y style en cada <table> y <td>, y las
//     meta color-scheme, para que el modo oscuro de Gmail no lo invierta
//     (sección 35 de instrucciones_ia.md);
//   · los links llevan /#/ y el dominio real: antes dos iban a
//     app.iglesiaorigen.com (un dominio que no es de la app) y dos a
//     /#/welcome (una ruta que no existe; la ruta es /#/bienvenida).
//
// Las firmas no cambian: welcome-reminder importa templates.welcomeFormReminder
// de acá.

import { escaparHtml, URL_APP } from './armado.ts';

const FUENTE = 'Arial, Helvetica, sans-serif';

/** El sobre de todos los emails: documento completo, fondo fijo, 600 px. */
function documento(titulo: string, cuerpo: string, fondo = '#ffffff'): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escaparHtml(titulo)}</title>
</head>
<body style="margin:0;padding:0;background-color:${fondo};" bgcolor="${fondo}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${fondo}" style="background-color:${fondo};">
  <tr>
    <td align="center" bgcolor="${fondo}" style="background-color:${fondo};padding:20px;font-family:${FUENTE};">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background-color:#ffffff;">
${cuerpo}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Un botón: tabla con bgcolor, como pide la sección 35. */
function boton(link: string, texto: string, color = '#0056b3'): string {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td align="center" bgcolor="${color}" style="background-color:${color};border-radius:5px;">
                    <a href="${link}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-family:${FUENTE};font-size:15px;font-weight:bold;">${texto}</a>
                  </td>
                </tr>
              </table>`;
}

/** Una fila "ROTULO / valor" de la tarjeta de datos. */
function filaDato(rotulo: string, valor: string, ultima = false): string {
    const borde = ultima ? '' : 'border-bottom:1px solid #dddddd;';
    return `<tr>
                      <td bgcolor="#f5f5f5" width="35%" style="background-color:#f5f5f5;${borde}padding:8px 0;font-family:${FUENTE};font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:#777777;">${rotulo}</td>
                      <td bgcolor="#f5f5f5" style="background-color:#f5f5f5;${borde}padding:8px 0;font-family:${FUENTE};font-size:14px;font-weight:bold;color:#111111;">${valor}</td>
                    </tr>`;
}

/** El pie gris de los emails clásicos. */
function pie(texto: string): string {
    return `        <tr>
          <td bgcolor="#ffffff" style="background-color:#ffffff;padding:0 24px 24px;font-family:${FUENTE};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td bgcolor="#eeeeee" height="1" style="background-color:#eeeeee;font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>
            <p style="margin:16px 0 0;font-family:${FUENTE};font-size:12px;color:#777777;text-align:center;">${texto}</p>
          </td>
        </tr>`;
}

/** La cabecera negra en mayúsculas de los emails de Bienvenida. */
function cabeceraOscura(fondo: string, titulo: string, bajada: string, colorBajada: string): string {
    return `        <tr>
          <td bgcolor="${fondo}" style="background-color:${fondo};padding:24px 28px;font-family:${FUENTE};">
            <h1 style="margin:0;font-family:${FUENTE};color:#ffffff;font-size:22px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;">${titulo}</h1>
            <p style="margin:6px 0 0;font-family:${FUENTE};color:${colorBajada};font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;">${bajada}</p>
          </td>
        </tr>`;
}

export const templates = {
    // 1. Nuevo Grupo (Admin Notify)
    groupCreated: (groupName: string, leaderName: string, leaderPhone: string) => documento(
        'Nuevo Grupo Pendiente de Revisión',
        `        <tr>
          <td bgcolor="#ffffff" style="background-color:#ffffff;padding:24px 24px 0;font-family:${FUENTE};font-size:15px;line-height:1.5;color:#333333;">
            <h2 style="margin:0 0 16px;font-family:${FUENTE};color:#0056b3;font-size:22px;">Nuevo Grupo Pendiente de Revisión</h2>
            <p style="margin:0 0 12px;color:#333333;">Hola Equipo,</p>
            <p style="margin:0 0 20px;color:#333333;">Se ha creado un nuevo grupo que requiere revisión y aprobación.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f9f9f9" style="background-color:#f9f9f9;">
              <tr>
                <td bgcolor="#f9f9f9" style="background-color:#f9f9f9;padding:15px;font-family:${FUENTE};font-size:15px;color:#333333;">
                  <p style="margin:0 0 8px;color:#333333;"><strong>Nombre del Grupo:</strong> ${escaparHtml(groupName)}</p>
                  <p style="margin:0 0 8px;color:#333333;"><strong>Líder/Anfitrión:</strong> ${escaparHtml(leaderName)}</p>
                  <p style="margin:0;color:#333333;"><strong>Teléfono:</strong> ${escaparHtml(leaderPhone || 'No proporcionado')}</p>
                </td>
              </tr>
            </table>
            <p style="margin:20px 0 4px;color:#333333;">Por favor, revisa el panel de administración para más detalles.</p>
          </td>
        </tr>
${pie('Notificación Automática del Sistema Origen')}`),

    // 2. Nuevo Postulante a Anfitrión (Admin Notify)
    hostApplicantCreated: (applicantName: string, applicantPhone: string, applicantEmail: string) => documento(
        'Nueva Postulación para Anfitrión',
        `        <tr>
          <td bgcolor="#ffffff" style="background-color:#ffffff;padding:24px 24px 0;font-family:${FUENTE};font-size:15px;line-height:1.5;color:#333333;">
            <h2 style="margin:0 0 16px;font-family:${FUENTE};color:#0056b3;font-size:22px;">Nueva Postulación para Anfitrión</h2>
            <p style="margin:0 0 12px;color:#333333;">Hola Equipo,</p>
            <p style="margin:0 0 20px;color:#333333;">Un usuario ha enviado una solicitud para convertirse en Anfitrión.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f9f9f9" style="background-color:#f9f9f9;">
              <tr>
                <td bgcolor="#f9f9f9" style="background-color:#f9f9f9;padding:15px;font-family:${FUENTE};font-size:15px;color:#333333;">
                  <p style="margin:0 0 8px;color:#333333;"><strong>Nombre:</strong> ${escaparHtml(applicantName)}</p>
                  <p style="margin:0 0 8px;color:#333333;"><strong>Email:</strong> ${escaparHtml(applicantEmail)}</p>
                  <p style="margin:0;color:#333333;"><strong>Teléfono:</strong> ${escaparHtml(applicantPhone || 'No proporcionado')}</p>
                </td>
              </tr>
            </table>
            <p style="margin:20px 0 4px;color:#333333;">Revisa la postulación en la pestaña "Anfitriones" del panel de GCX.</p>
          </td>
        </tr>
${pie('Notificación Automática del Sistema Origen')}`),

    // 3. Grupo Aprobado (User Notify)
    groupApproved: (groupName: string, leaderName: string) => documento(
        '¡Tu Grupo ha sido Aprobado!',
        `        <tr>
          <td bgcolor="#ffffff" style="background-color:#ffffff;padding:24px 24px 0;font-family:${FUENTE};font-size:15px;line-height:1.5;color:#333333;">
            <h2 style="margin:0 0 16px;font-family:${FUENTE};color:#28a745;font-size:22px;">¡Tu Grupo ha sido Aprobado!</h2>
            <p style="margin:0 0 12px;color:#333333;">Hola <strong>${escaparHtml(leaderName)}</strong>,</p>
            <p style="margin:0 0 12px;color:#333333;">Tenemos excelentes noticias: tu grupo <strong>"${escaparHtml(groupName)}"</strong> ha sido revisado y <strong>aprobado</strong> exitosamente.</p>
            <p style="margin:0 0 12px;color:#333333;">Ya puedes comenzar a ver las inscripciones y gestionar los detalles desde la aplicación Origen.</p>
            <p style="margin:0 0 24px;color:#333333;">¡Gracias por tu disposición para conectar a la iglesia!</p>
            ${boton(`${URL_APP}/#/mis-grupos`, 'Ir a Mis Grupos')}
          </td>
        </tr>
${pie('El Equipo de Origen')}`),

    // 4. Anfitrión Aprobado (User Notify)
    hostApproved: (userName: string) => documento(
        '¡Bienvenido como Anfitrión de Origen!',
        `        <tr>
          <td bgcolor="#ffffff" style="background-color:#ffffff;padding:24px 24px 0;font-family:${FUENTE};font-size:15px;line-height:1.5;color:#333333;">
            <h2 style="margin:0 0 16px;font-family:${FUENTE};color:#28a745;font-size:22px;">¡Bienvenido como Anfitrión de Origen!</h2>
            <p style="margin:0 0 12px;color:#333333;">Hola <strong>${escaparHtml(userName)}</strong>,</p>
            <p style="margin:0 0 12px;color:#333333;">Tu postulación ha sido <strong>aprobada</strong>. A partir de ahora formas parte oficial del equipo de Anfitriones de Grupos de Conexión (GCX).</p>
            <p style="margin:0 0 24px;color:#333333;">Puedes ingresar a la aplicación y comenzar a crear tus grupos.</p>
            ${boton(`${URL_APP}/#/mis-grupos/crear-grupo`, 'Crear mi Primer Grupo')}
          </td>
        </tr>
${pie('El Equipo de Origen')}`),

    // 5. Nuevo Ingresante en Bienvenida (bienvenida@ Notify)
    newWelcomeVisitor: (
        firstName: string,
        lastName: string,
        phone: string,
        age: string,
        createdAt: string,
    ) => {
        const fecha = new Date(createdAt).toLocaleDateString('es-AR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });

        return documento('Nuevo Ingresante — Sistema Origen',
            `${cabeceraOscura('#000000', '🙋 Nuevo Ingresante', 'Sistema Origen — Módulo Bienvenida', '#999999')}
        <tr>
          <td bgcolor="#ffffff" style="background-color:#ffffff;padding:28px;font-family:${FUENTE};">
            <p style="margin:0 0 20px;font-family:${FUENTE};font-size:14px;color:#444444;">Se registró un nuevo ingresante. Se le enviará el link al formulario <strong>/form</strong> por WhatsApp. Aún <strong>no completó</strong> el formulario.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f5f5" style="background-color:#f5f5f5;">
              <tr>
                <td bgcolor="#f5f5f5" style="background-color:#f5f5f5;padding:20px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${filaDato('Nombre', escaparHtml(`${firstName} ${lastName}`))}
${filaDato('Teléfono', escaparHtml(phone))}
${filaDato('Edad', escaparHtml(age))}
${filaDato('Registrado', escaparHtml(fecha), true)}
                  </table>
                </td>
              </tr>
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fff3cd" style="background-color:#fff3cd;margin-top:20px;">
              <tr>
                <td bgcolor="#fff3cd" style="background-color:#fff3cd;padding:12px 16px;font-family:${FUENTE};">
                  <p style="margin:0;font-family:${FUENTE};font-size:13px;font-weight:bold;color:#92400e;">⏳ Estado: Pendiente de completar /form</p>
                  <p style="margin:4px 0 0;font-family:${FUENTE};font-size:12px;color:#b45309;">Recibirás un recordatorio si no responde en 7 días.</p>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;text-align:center;">${boton(`${URL_APP}/#/bienvenida`, 'Ver en Sistema Bienvenida →', '#000000')}</p>
          </td>
        </tr>
        <tr>
          <td bgcolor="#fafafa" style="background-color:#fafafa;padding:16px 28px;font-family:${FUENTE};">
            <p style="margin:0;font-family:${FUENTE};font-size:11px;color:#999999;text-align:center;text-transform:uppercase;letter-spacing:0.08em;font-weight:bold;">Notificación Automática — Sistema Origen</p>
          </td>
        </tr>`);
    },

    // 6. Recordatorio de /form sin responder (bienvenida@ Notify)
    welcomeFormReminder: (
        firstName: string,
        lastName: string,
        phone: string,
        age: string,
        createdAt: string,
        reminderNumber: number,
    ) => {
        const fecha = new Date(createdAt).toLocaleDateString('es-AR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });
        const daysSince = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
        const n = Number(reminderNumber);

        return documento(`Recordatorio ${n} — Sistema Origen`,
            `${cabeceraOscura('#b45309', `🔔 Recordatorio #${escaparHtml(n)}`, `${escaparHtml(daysSince)} días sin completar el formulario`, '#fde68a')}
        <tr>
          <td bgcolor="#ffffff" style="background-color:#ffffff;padding:28px;font-family:${FUENTE};">
            <p style="margin:0 0 20px;font-family:${FUENTE};font-size:14px;color:#444444;">El siguiente ingresante <strong>todavía no completó</strong> el formulario <strong>/form</strong>. Este es el recordatorio número <strong>${escaparHtml(n)} de 3</strong>.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f5f5" style="background-color:#f5f5f5;">
              <tr>
                <td bgcolor="#f5f5f5" style="background-color:#f5f5f5;padding:20px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${filaDato('Nombre', escaparHtml(`${firstName} ${lastName}`))}
${filaDato('Teléfono', escaparHtml(phone))}
${filaDato('Edad', escaparHtml(age))}
${filaDato('Ingresó', `${escaparHtml(fecha)} (hace ${escaparHtml(daysSince)} días)`, true)}
                  </table>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;text-align:center;">${boton(`${URL_APP}/#/bienvenida`, 'Ver en Sistema Bienvenida →', '#000000')}</p>
          </td>
        </tr>
        <tr>
          <td bgcolor="#fafafa" style="background-color:#fafafa;padding:16px 28px;font-family:${FUENTE};">
            <p style="margin:0;font-family:${FUENTE};font-size:11px;color:#999999;text-align:center;text-transform:uppercase;letter-spacing:0.08em;font-weight:bold;">Recordatorio Automático — Sistema Origen${n === 3 ? ' · Este es el último recordatorio' : ''}</p>
          </td>
        </tr>`);
    },
};
