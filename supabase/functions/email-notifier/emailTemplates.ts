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
        <a href="https://app.iglesiaorigen.com/groups" style="background-color: #0056b3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ir a Mis Grupos</a>
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
        <a href="https://app.iglesiaorigen.com/groups/new" style="background-color: #0056b3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Crear mi Primer Grupo</a>
      </div>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
      <p style="font-size: 12px; color: #777; text-align: center;">El Equipo de Origen</p>
    </div>
  `
};
