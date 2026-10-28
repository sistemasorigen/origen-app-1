import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('ORIGEN_SERVICE_ROLE_KEY') as string;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE' | 'test_all';
  table: string;
  schema: string;
  record: Record<string, unknown>;
  old_record: Record<string, unknown> | null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  }

  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);

    if (body.type === 'attendance_reminder') {
      const count = await handleAttendanceReminder();
      return new Response(JSON.stringify({ success: true, action: 'attendance_reminder', notified: count }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (body.type === 'test_all') {
      await handleTestAll(body.user_id);
      return new Response(JSON.stringify({ success: true, action: 'test_all' }), { headers: { 'Content-Type': 'application/json' } });
    }

    const payload = body as WebhookPayload;

    if (payload.table === 'groups' && payload.type === 'UPDATE') {
      if (payload.old_record?.status !== 'approved' && payload.record?.status === 'approved') {
        await handleGroupApproved(payload.record);
      }
    } else if (payload.table === 'group_registrations' && payload.type === 'INSERT') {
      await handleNewRegistration(payload.record);
    }

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[notify-host] Unhandled error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});

// --- EMAIL SENDER ---
async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!RESEND_API_KEY) {
    console.error('[notify-host] RESEND_API_KEY not set');
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'Origen <team@app.origeniglesia.org>',
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error('[notify-host] Resend error:', await res.text());
    } else {
      console.log(`[notify-host] Email sent to ${to}: ${subject}`);
    }
  } catch (err) {
    console.error('[notify-host] Email fetch error:', err);
  }
}

async function getUserEmail(userId: string): Promise<string | null> {
  const { data } = await supabase.from('users').select('email').eq('id', userId).single();
  return data?.email || null;
}

// --- NOTIFICATION HANDLERS ---
async function insertNotification(userId: string, title: string, message: string, type: string, actionUrl: string | null = null): Promise<void> {
  await supabase.from('app_notifications').insert({ user_id: userId, title, message, type, action_url: actionUrl });
}

async function handleGroupApproved(record: Record<string, unknown>): Promise<void> {
  const hostId = record.host_id as string | null;
  const coHostId = record.co_host_id as string | null;
  const groupName = record.name as string;

  if (!hostId) return;

  const title = '¡Tu grupo fue aprobado! 🎉';
  const message = `El grupo "${groupName}" fue aprobado y ya está visible en la app.`;
  
  await insertNotification(hostId, title, message, 'success', '/');
  if (coHostId) await insertNotification(coHostId, title, message, 'success', '/');
}

async function handleNewRegistration(record: Record<string, unknown>): Promise<void> {
  if (record.status !== 'PENDING') return;

  const groupId = record.group_id as string;
  const firstName = record.first_name as string;
  const lastName = record.last_name as string;

  const { data: group } = await supabase.from('groups').select('id, name, host_id, co_host_id').eq('id', groupId).single();
  if (!group || !group.host_id) return;

  const title = 'Nueva solicitud de ingreso 👤';
  const message = `${firstName} ${lastName} quiere unirse a "${group.name}". Revisá las solicitudes pendientes.`;
  await insertNotification(group.host_id, title, message, 'info', '/');
  if (group.co_host_id) await insertNotification(group.co_host_id, title, message, 'info', '/');

  // Email Notification
  const htmlTemplate = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #0056b3;">Nueva solicitud de ingreso al grupo</h2>
      <p>Hola Anfitrión,</p>
      <p>Tenés una nueva solicitud de inscripción para tu Grupo de Conexión <strong>"${group.name}"</strong>.</p>
      <p><strong>Usuario:</strong> ${firstName} ${lastName}</p>
      <div style="margin-top: 20px;">
        <a href="https://app.origeniglesia.org" style="background-color: #0056b3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Revisar Solicitud</a>
      </div>
    </div>
  `;
  const subject = `Nueva solicitud de: ${firstName} ${lastName}`;

  const hostEmail = await getUserEmail(group.host_id);
  if (hostEmail) await sendEmail({ to: hostEmail, subject, html: htmlTemplate });

  if (group.co_host_id) {
    const coHostEmail = await getUserEmail(group.co_host_id);
    if (coHostEmail) await sendEmail({ to: coHostEmail, subject, html: htmlTemplate });
  }
}

async function handleAttendanceReminder(): Promise<number> {
  const now = new Date();
  const argOffset = -3 * 60;
  const argNow = new Date(now.getTime() + (argOffset - now.getTimezoneOffset()) * 60_000);
  const todayStr = argNow.toISOString().split('T')[0];
  const currentTotalMinutes = argNow.getHours() * 60 + argNow.getMinutes();
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const todayDayName = dayNames[argNow.getDay()];

  const { data: groups } = await supabase.from('groups').select('id, name, host_id, co_host_id, meeting_time').eq('meeting_day', todayDayName).eq('status', 'approved').not('host_id', 'is', null);
  if (!groups) return 0;

  let count = 0;
  for (const group of groups) {
    const parts = (group.meeting_time as string).split(':').map(Number);
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) continue;
    const elapsed = currentTotalMinutes - (parts[0] * 60 + parts[1]);
    if (elapsed < 180 || elapsed >= 240) continue;

    const { data: att } = await supabase.from('group_attendance').select('id').eq('group_id', group.id).eq('date', todayStr).maybeSingle();
    if (att) continue;

    const { data: dup } = await supabase.from('app_notifications').select('id').eq('user_id', group.host_id).eq('type', 'attendance_reminder').gte('created_at', `${todayStr}T00:00:00Z`).eq('action_url', `/`).maybeSingle();
    if (dup) continue;

    const title = 'Recordatorio: Pasá asistencia 📋';
    const msg = `La reunión de "${group.name}" terminó hace más de 3 horas. Registrá la asistencia.`;
    await insertNotification(group.host_id, title, msg, 'attendance_reminder', `/`);
    if (group.co_host_id) await insertNotification(group.co_host_id, title, msg, 'attendance_reminder', `/`);

    // Email Notification
    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #0056b3;">Recordatorio de Asistencia</h2>
        <p>Hola Anfitrión,</p>
        <p>Notamos que tu Grupo de Conexión <strong>"${group.name}"</strong> terminó hace más de 3 horas y aún no registraste la asistencia.</p>
        <p>Por favor, tómate un minuto para hacerlo.</p>
        <div style="margin-top: 20px;">
          <a href="https://app.origeniglesia.org" style="background-color: #0056b3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Pasar Asistencia</a>
        </div>
      </div>
    `;
    const subject = `Recordatorio: Pasar Asistencia de ${group.name}`;

    const hostEmail = await getUserEmail(group.host_id);
    if (hostEmail) await sendEmail({ to: hostEmail, subject, html: htmlTemplate });

    if (group.co_host_id) {
      const coHostEmail = await getUserEmail(group.co_host_id);
      if (coHostEmail) await sendEmail({ to: coHostEmail, subject, html: htmlTemplate });
    }

    count++;
  }
  return count;
}

async function handleTestAll(userId: string) {
  const hostEmail = await getUserEmail(userId);
  if (!hostEmail) {
    console.error('[notify-host] User email not found for testing:', userId);
    return;
  }

  console.log('[notify-host] Running test suite for user:', userId, hostEmail);

  // 1. Email & In-app: Group Approved (We mock this email in test so user sees all 3)
  await insertNotification(userId, '¡Tu grupo fue aprobado! 🎉 [TEST]', 'El grupo "Grupo Test" fue aprobado y ya está visible en la app.', 'success', '/');

  const approvedHtml = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #0056b3;">¡Grupo Aprobado! (TEST)</h2>
      <p>Hola Anfitrión,</p>
      <p>Te avisamos que tu grupo <strong>"Grupo Test"</strong> ya fue aprobado y publicado.</p>
      <div style="margin-top: 20px;">
        <a href="https://app.origeniglesia.org" style="background-color: #0056b3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ir a la App</a>
      </div>
    </div>
  `;
  await sendEmail({ to: hostEmail, subject: '¡Tu grupo fue aprobado! [TEST]', html: approvedHtml });

  // 2. Email & In-App: New Registration
  await insertNotification(userId, 'Nueva solicitud de ingreso 👤 [TEST]', 'Pedro Test quiere unirse a "Grupo Test". Revisá las solicitudes pendientes.', 'info', '/');
  
  const registrationHtml = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #0056b3;">Nueva solicitud de ingreso al grupo (TEST)</h2>
      <p>Hola Anfitrión,</p>
      <p>Tenés una nueva solicitud de inscripción para tu Grupo de Conexión <strong>"Grupo Test"</strong>.</p>
      <p><strong>Usuario:</strong> Pedro Test</p>
      <div style="margin-top: 20px;">
        <a href="https://app.origeniglesia.org" style="background-color: #0056b3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Revisar Solicitud</a>
      </div>
    </div>
  `;
  await sendEmail({ to: hostEmail, subject: 'Nueva solicitud de: Pedro Test [TEST]', html: registrationHtml });

  // 3. Email & In-App: Attendance
  await insertNotification(userId, 'Recordatorio: Pasá asistencia 📋 [TEST]', 'La reunión de "Grupo Test" terminó hace más de 3 horas. Registrá la asistencia.', 'attendance_reminder', '/');
  
  const attendanceHtml = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #0056b3;">Recordatorio de Asistencia (TEST)</h2>
      <p>Hola Anfitrión,</p>
      <p>Notamos que tu Grupo de Conexión <strong>"Grupo Test"</strong> terminó hace más de 3 horas y aún no registraste la asistencia.</p>
      <p>Por favor, tómate un minuto para hacerlo.</p>
      <div style="margin-top: 20px;">
        <a href="https://app.origeniglesia.org" style="background-color: #0056b3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Pasar Asistencia</a>
      </div>
    </div>
  `;
  await sendEmail({ to: hostEmail, subject: 'Recordatorio: Pasar Asistencia de Grupo Test [TEST]', html: attendanceHtml });
}