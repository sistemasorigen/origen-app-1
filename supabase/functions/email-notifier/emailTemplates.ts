export const templates = {
    // 1. Nuevo Grupo (Admin Notify)
    groupCreated: (groupName: string, leaderName: string, leaderPhone: string) => `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #0056b3;">Nuevo Grupo Pendiente de Revisión</h2>
      <p>Hola Equipo,</p>
      <p>Se ha creado un nuevo grupo que requiere revisión y aprobación.</p>
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Nombre del Grupo:</strong> ${groupName}</p>
        <p><strong>Líder/Anfitrión:</strong> ${leaderName}</p>
        <p><strong>Teléfono:</strong> ${leaderPhone || 'No proporcionado'}</p>
      </div>
      <p>Por favor, revisa el panel de administración para más detalles.</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
      <p style="font-size: 12px; color: #777; text-align: center;">Notificación Automática del Sistema Origen</p>
    </div>
  `,

    // 2. Nuevo Postulante a Anfitrión (Admin Notify)
    hostApplicantCreated: (applicantName: string, applicantPhone: string, applicantEmail: string) => `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #0056b3;">Nueva Postulación para Anfitrión</h2>
      <p>Hola Equipo,</p>
      <p>Un usuario ha enviado una solicitud para convertirse en Anfitrión.</p>
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Nombre:</strong> ${applicantName}</p>
        <p><strong>Email:</strong> ${applicantEmail}</p>
        <p><strong>Teléfono:</strong> ${applicantPhone || 'No proporcionado'}</p>
      </div>
      <p>Revisa la postulación en la pestaña "Anfitriones" del panel de GCX.</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
      <p style="font-size: 12px; color: #777; text-align: center;">Notificación Automática del Sistema Origen</p>
    </div>
  `,

    // 3. Grupo Aprobado (User Notify)
    groupApproved: (groupName: string, leaderName: string) => `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #28a745;">¡Tu Grupo ha sido Aprobado!</h2>
      <p>Hola <strong>${leaderName}</strong>,</p>
      <p>Tenemos excelentes noticias: tu grupo <strong>"${groupName}"</strong> ha sido revisado y <strong>aprobado</strong> exitosamente.</p>
      <p>Ya puedes comenzar a ver las inscripciones y gestionar los detalles desde la aplicación Origen.</p>
      <p>¡Gracias por tu disposición para conectar a la iglesia!</p>
      <div style="text-align: center; margin-top: 30px;">
        <a href="https://app.iglesiaorigen.com/gcx" style="background-color: #0056b3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ir a Mis Grupos</a>
      </div>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
      <p style="font-size: 12px; color: #777; text-align: center;">El Equipo de Origen</p>
    </div>
  `,

    // 4. Anfitrión Aprobado (User Notify)
    hostApproved: (userName: string) => `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #28a745;">¡Bienvenido como Anfitrión de Origen!</h2>
      <p>Hola <strong>${userName}</strong>,</p>
      <p>Tu postulación ha sido <strong>aprobada</strong>. A partir de ahora formas parte oficial del equipo de Anfitriones de Grupos de Conexión (GCX).</p>
      <p>Puedes ingresar a la aplicación y comenzar a crear tus grupos.</p>
      <div style="text-align: center; margin-top: 30px;">
        <a href="https://app.iglesiaorigen.com/gcx/new" style="background-color: #0056b3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Crear mi Primer Grupo</a>
      </div>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
      <p style="font-size: 12px; color: #777; text-align: center;">El Equipo de Origen</p>
    </div>
  `,

    // 5. Nuevo Ingresante en Bienvenida (bienvenida@ Notify)
    newWelcomeVisitor: (
        firstName: string,
        lastName: string,
        phone: string,
        age: string,
        createdAt: string
    ) => {
        const fecha = new Date(createdAt).toLocaleDateString(
            'es-AR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }
        );

        return `
    <div style="font-family: Arial, sans-serif;
        color: #111; max-width: 600px; margin: 0 auto;
        padding: 0; border: 3px solid #000;
        border-radius: 0;">

        <!-- Header negro -->
        <div style="background-color: #000;
            padding: 24px 28px;">
            <h1 style="color: #fff; margin: 0;
                font-size: 22px; font-weight: 900;
                text-transform: uppercase;
                letter-spacing: 0.05em;">
                🙋 Nuevo Ingresante
            </h1>
            <p style="color: #999; margin: 6px 0 0;
                font-size: 12px; font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.1em;">
                Sistema Origen — Módulo Bienvenida
            </p>
        </div>

        <!-- Cuerpo -->
        <div style="padding: 28px;">
            <p style="margin: 0 0 20px; font-size: 14px;
                color: #444;">
                Se registró un nuevo ingresante.
                Se le enviará el link al formulario
                <strong>/form</strong> por WhatsApp.
                Aún <strong>no completó</strong> el
                formulario.
            </p>

            <!-- Tarjeta de datos -->
            <div style="background-color: #f5f5f5;
                border: 2px solid #000;
                padding: 20px;
                margin-bottom: 20px;
                box-shadow: 4px 4px 0 #000;">
                <table style="width: 100%;
                    border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0;
                            border-bottom: 1px solid #ddd;
                            font-size: 11px;
                            font-weight: 900;
                            text-transform: uppercase;
                            letter-spacing: 0.08em;
                            color: #777;
                            width: 35%;">
                            Nombre
                        </td>
                        <td style="padding: 8px 0;
                            border-bottom: 1px solid #ddd;
                            font-size: 14px;
                            font-weight: 700;
                            color: #111;">
                            ${firstName} ${lastName}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0;
                            border-bottom: 1px solid #ddd;
                            font-size: 11px;
                            font-weight: 900;
                            text-transform: uppercase;
                            letter-spacing: 0.08em;
                            color: #777;">
                            Teléfono
                        </td>
                        <td style="padding: 8px 0;
                            border-bottom: 1px solid #ddd;
                            font-size: 14px;
                            font-weight: 700;
                            color: #111;">
                            ${phone}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0;
                            border-bottom: 1px solid #ddd;
                            font-size: 11px;
                            font-weight: 900;
                            text-transform: uppercase;
                            letter-spacing: 0.08em;
                            color: #777;">
                            Edad
                        </td>
                        <td style="padding: 8px 0;
                            border-bottom: 1px solid #ddd;
                            font-size: 14px;
                            font-weight: 700;
                            color: #111;">
                            ${age}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0;
                            font-size: 11px;
                            font-weight: 900;
                            text-transform: uppercase;
                            letter-spacing: 0.08em;
                            color: #777;">
                            Registrado
                        </td>
                        <td style="padding: 8px 0;
                            font-size: 14px;
                            font-weight: 700;
                            color: #111;">
                            ${fecha}
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Estado -->
            <div style="background-color: #fff3cd;
                border: 2px solid #f59e0b;
                padding: 12px 16px;
                margin-bottom: 20px;">
                <p style="margin: 0; font-size: 13px;
                    font-weight: 700; color: #92400e;">
                    ⏳ Estado: Pendiente de completar /form
                </p>
                <p style="margin: 4px 0 0;
                    font-size: 12px; color: #b45309;">
                    Recibirás un recordatorio si no
                    responde en 7 días.
                </p>
            </div>

            <!-- Link al sistema -->
            <div style="text-align: center;
                margin-top: 24px;">
                <a href="https://app.origeniglesia.org/#/bienvenida"
                    style="background-color: #000;
                        color: #fff;
                        padding: 12px 24px;
                        text-decoration: none;
                        font-weight: 900;
                        font-size: 12px;
                        text-transform: uppercase;
                        letter-spacing: 0.1em;
                        display: inline-block;
                        border: 2px solid #000;
                        box-shadow: 3px 3px 0 #555;">
                    Ver en Sistema Bienvenida →
                </a>
            </div>
        </div>

        <!-- Footer -->
        <div style="border-top: 2px solid #eee;
            padding: 16px 28px;
            background-color: #fafafa;">
            <p style="margin: 0; font-size: 11px;
                color: #999; text-align: center;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                font-weight: 700;">
                Notificación Automática — Sistema Origen
            </p>
        </div>
    </div>
    `;
    },

    // 6. Recordatorio de /form sin responder (bienvenida@ Notify)
    welcomeFormReminder: (
        firstName: string,
        lastName: string,
        phone: string,
        age: string,
        createdAt: string,
        reminderNumber: number
    ) => {
        const fecha = new Date(createdAt).toLocaleDateString(
            'es-AR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }
        );

        const daysSince = Math.floor(
            (Date.now() - new Date(createdAt).getTime()) /
            (1000 * 60 * 60 * 24)
        );

        return `
    <div style="font-family: Arial, sans-serif;
        color: #111; max-width: 600px; margin: 0 auto;
        padding: 0; border: 3px solid #000;
        border-radius: 0;">

        <!-- Header con color de alerta -->
        <div style="background-color: #b45309;
            padding: 24px 28px;">
            <h1 style="color: #fff; margin: 0;
                font-size: 22px; font-weight: 900;
                text-transform: uppercase;
                letter-spacing: 0.05em;">
                🔔 Recordatorio #${reminderNumber}
            </h1>
            <p style="color: #fde68a; margin: 6px 0 0;
                font-size: 12px; font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.1em;">
                ${daysSince} días sin completar el formulario
            </p>
        </div>

        <!-- Cuerpo -->
        <div style="padding: 28px;">
            <p style="margin: 0 0 20px; font-size: 14px;
                color: #444;">
                El siguiente ingresante <strong>todavía
                no completó</strong> el formulario
                <strong>/form</strong>. Este es el
                recordatorio número
                <strong>${reminderNumber} de 3</strong>.
            </p>

            <!-- Tarjeta de datos -->
            <div style="background-color: #f5f5f5;
                border: 2px solid #000;
                padding: 20px;
                margin-bottom: 20px;
                box-shadow: 4px 4px 0 #000;">
                <table style="width: 100%;
                    border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0;
                            border-bottom: 1px solid #ddd;
                            font-size: 11px;
                            font-weight: 900;
                            text-transform: uppercase;
                            color: #777; width: 35%;">
                            Nombre
                        </td>
                        <td style="padding: 8px 0;
                            border-bottom: 1px solid #ddd;
                            font-size: 14px;
                            font-weight: 700;">
                            ${firstName} ${lastName}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0;
                            border-bottom: 1px solid #ddd;
                            font-size: 11px;
                            font-weight: 900;
                            text-transform: uppercase;
                            color: #777;">
                            Teléfono
                        </td>
                        <td style="padding: 8px 0;
                            border-bottom: 1px solid #ddd;
                            font-size: 14px;
                            font-weight: 700;">
                            ${phone}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0;
                            border-bottom: 1px solid #ddd;
                            font-size: 11px;
                            font-weight: 900;
                            text-transform: uppercase;
                            color: #777;">
                            Edad
                        </td>
                        <td style="padding: 8px 0;
                            border-bottom: 1px solid #ddd;
                            font-size: 14px;
                            font-weight: 700;">
                            ${age}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0;
                            font-size: 11px;
                            font-weight: 900;
                            text-transform: uppercase;
                            color: #777;">
                            Ingresó
                        </td>
                        <td style="padding: 8px 0;
                            font-size: 14px;
                            font-weight: 700;">
                            ${fecha} (hace ${daysSince} días)
                        </td>
                    </tr>
                </table>
            </div>

            <div style="text-align: center;
                margin-top: 24px;">
                <a href="https://app.origeniglesia.org/#/bienvenida"
                    style="background-color: #000;
                        color: #fff;
                        padding: 12px 24px;
                        text-decoration: none;
                        font-weight: 900;
                        font-size: 12px;
                        text-transform: uppercase;
                        letter-spacing: 0.1em;
                        display: inline-block;
                        border: 2px solid #000;
                        box-shadow: 3px 3px 0 #555;">
                    Ver en Sistema Bienvenida →
                </a>
            </div>
        </div>

        <div style="border-top: 2px solid #eee;
            padding: 16px 28px;
            background-color: #fafafa;">
            <p style="margin: 0; font-size: 11px;
                color: #999; text-align: center;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                font-weight: 700;">
                Recordatorio Automático — Sistema Origen
                ${reminderNumber === 3
                    ? '· Este es el último recordatorio'
                    : ''}
            </p>
        </div>
    </div>
    `;
    },
};
