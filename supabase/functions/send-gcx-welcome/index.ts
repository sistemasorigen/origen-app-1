// Supabase Edge Function: send-gcx-welcome
// Sends welcome email when a group registration is approved
// Replaces the old 'send-group-confirmation' function

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const FROM_EMAIL = "'Origen' <team@app.origeniglesia.org>";

interface GroupRegistrationRecord {
  id: string;
  group_id: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  status: string;
  timestamp: string;
}

interface WebhookPayload {
  type: "UPDATE";
  table: "group_registrations";
  schema: "public";
  record: GroupRegistrationRecord;
  old_record: GroupRegistrationRecord;
}

interface GroupDetails {
  id: string;
  name: string;
  meeting_day: string;
  meeting_time: string;
  location: string;
  description: string;
  leader_name: string;
  leader_surname: string;
  start_date: string;
}

// ─── Neo-Brutalist HTML Email Template ───────────────────────────────────
function buildEmailHtml(userName: string, group: GroupDetails): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>¡Bienvenido/a a GCX!</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 4px solid #000000; box-shadow: 8px 8px 0px #000000;">

          <!-- Header -->
          <tr>
            <td style="background-color: #000000; padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px;">
                ¡Bienvenido/a a GCX!
              </h1>
            </td>
          </tr>

          <!-- Greeting + Description -->
          <tr>
            <td style="padding: 40px 40px 20px 40px;">
              <p style="margin: 0; font-size: 18px; color: #333333; line-height: 1.6;">
                Hola <strong style="color: #000000;">${userName}</strong>,
              </p>
              <p style="margin: 16px 0 0 0; font-size: 16px; color: #555555; line-height: 1.6;">
                Estamos muy felices de que podamos hacer comunidad juntos. Estamos convencidos de que será un tiempo de mayor libertad, crecimiento y conexión con otros.<br><br>
                Dentro de las 48 hs antes de que comience tu GCX, un anfitrión te sumará a un grupo de WhatsApp donde podrás tener más información y conexión durante estas 8 semanas.<br><br>
                Tu participación y compromiso son clave para que en esta temporada podamos ser iglesia juntos.
              </p>
            </td>
          </tr>

          <!-- Group Name -->
          <tr>
            <td style="padding: 20px 40px;">
              <div style="background-color: #fef08a; border: 3px solid #000000; padding: 20px; box-shadow: 4px 4px 0px #000000;">
                <h2 style="margin: 0; font-size: 24px; font-weight: 900; color: #000000; text-transform: uppercase;">
                  ${group.name}
                </h2>
              </div>
            </td>
          </tr>

          <!-- Details Grid -->
          <tr>
            <td style="padding: 20px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">

                <!-- Start Date -->
                <tr>
                  <td style="padding: 12px 0; border-bottom: 2px dashed #e5e5e5;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="80" style="font-size: 12px; font-weight: 700; color: #888888; text-transform: uppercase; letter-spacing: 1px;">
                          ARRANCA
                        </td>
                        <td style="font-size: 16px; font-weight: 600; color: #000000;">
                          ${group.start_date ? new Date(group.start_date).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Por confirmar'}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- When -->
                <tr>
                  <td style="padding: 12px 0; border-bottom: 2px dashed #e5e5e5;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="80" style="font-size: 12px; font-weight: 700; color: #888888; text-transform: uppercase; letter-spacing: 1px;">
                          CUÁNDO
                        </td>
                        <td style="font-size: 16px; font-weight: 600; color: #000000;">
                          ${group.meeting_day} a las ${group.meeting_time}hs
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Where -->
                <tr>
                  <td style="padding: 12px 0; border-bottom: 2px dashed #e5e5e5;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="80" style="font-size: 12px; font-weight: 700; color: #888888; text-transform: uppercase; letter-spacing: 1px;">
                          DÓNDE
                        </td>
                        <td style="font-size: 16px; font-weight: 600; color: #000000;">
                          ${group.location || "Por confirmar"}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Host -->
                <tr>
                  <td style="padding: 12px 0; border-bottom: 2px dashed #e5e5e5;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="80" style="font-size: 12px; font-weight: 700; color: #888888; text-transform: uppercase; letter-spacing: 1px;">
                          ANFITRIÓN
                        </td>
                        <td style="font-size: 16px; font-weight: 600; color: #000000;">
                          ${group.leader_name} ${group.leader_surname}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Description -->
          ${group.description ? `
          <tr>
            <td style="padding: 20px 40px;">
              <div style="background-color: #f3f4f6; border-left: 4px solid #000000; padding: 16px 20px;">
                <p style="margin: 0; font-size: 12px; font-weight: 700; color: #888888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
                  SOBRE EL GRUPO
                </p>
                <p style="margin: 0; font-size: 15px; color: #333333; line-height: 1.6;">
                  ${group.description}
                </p>
              </div>
            </td>
          </tr>
          ` : ""}

          <!-- Footer CTA -->
          <tr>
            <td style="padding: 30px 40px; text-align: center;">
              <p style="margin: 0; font-size: 18px; font-weight: 900; color: #000000; text-transform: uppercase; letter-spacing: 1px;">
                ¡Te esperamos!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #000000; padding: 24px 40px; text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #888888;">
                © 2026 Origen App · Grupos de Conexión
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// ─── Main Handler ────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey, x-supabase-api-key",
      },
    });
  }

  try {
    // Validate environment variables
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not set");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Supabase credentials not configured");
      return new Response(
        JSON.stringify({ error: "Database service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    console.log("Received request body:", JSON.stringify(body, null, 2));

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ════════════════════════════════════════════
    // DIRECT INVOCATION MODE (Bulk Email Resend)
    // ════════════════════════════════════════════
    if (body.registration_ids && Array.isArray(body.registration_ids)) {
      console.log(`Processing bulk resend for ${body.registration_ids.length} registrations`);

      const results: { success: string[]; failed: string[] } = {
        success: [],
        failed: []
      };

      for (const registrationId of body.registration_ids) {
        try {
          const { data: registration, error: regError } = await supabase
            .from("group_registrations")
            .select("id, group_id, first_name, last_name, email, status")
            .eq("id", registrationId)
            .single();

          if (regError || !registration) {
            console.error(`Registration ${registrationId} not found:`, regError);
            results.failed.push(registrationId);
            continue;
          }

          if (registration.status !== "APPROVED") {
            console.log(`Skipping ${registrationId}: status is ${registration.status}`);
            results.failed.push(registrationId);
            continue;
          }

          if (!registration.email) {
            console.log(`Skipping ${registrationId}: no email`);
            results.failed.push(registrationId);
            continue;
          }

          const { data: group, error: groupError } = await supabase
            .from("groups")
            .select("id, name, meeting_day, meeting_time, location, description, leader_name, leader_surname, start_date")
            .eq("id", registration.group_id)
            .single();

          if (groupError || !group) {
            console.error(`Group for ${registrationId} not found:`, groupError);
            results.failed.push(registrationId);
            continue;
          }

          const userName = `${registration.first_name} ${registration.last_name}`.trim() || "Amigo/a";
          const emailHtml = buildEmailHtml(userName, group as GroupDetails);
          const emailSubject = `¡Bienvenido/a a GCX! - ${group.name}`;

          const resendResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: FROM_EMAIL,
              to: [registration.email],
              subject: emailSubject,
              html: emailHtml,
            }),
          });

          if (resendResponse.ok) {
            console.log(`Email sent to ${registration.email}`);
            results.success.push(registrationId);
          } else {
            const errorData = await resendResponse.json();
            console.error(`Failed to send to ${registration.email}:`, errorData);
            results.failed.push(registrationId);
          }
        } catch (err) {
          console.error(`Error processing ${registrationId}:`, err);
          results.failed.push(registrationId);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `${results.success.length} correos enviados, ${results.failed.length} fallidos`,
          sent: results.success.length,
          failed: results.failed.length,
          details: results
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // ════════════════════════════════════════════
    // WEBHOOK MODE (Database trigger)
    // ════════════════════════════════════════════
    const payload = body as WebhookPayload;

    if (
      payload.type !== "UPDATE" ||
      payload.old_record?.status === payload.record?.status ||
      payload.record?.status !== "APPROVED"
    ) {
      console.log("Skipping: Not an approval status change");
      return new Response(
        JSON.stringify({ message: "Skipped: Not an approval event" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const registration = payload.record;

    if (!registration.email) {
      console.error("No email in registration record");
      return new Response(
        JSON.stringify({ error: "No email address in registration" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!registration.group_id) {
      console.error("No group_id in registration record");
      return new Response(
        JSON.stringify({ error: "No group ID in registration" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { data: group, error: groupError } = await supabase
      .from("groups")
      .select("id, name, meeting_day, meeting_time, location, description, leader_name, leader_surname, start_date")
      .eq("id", registration.group_id)
      .single();

    if (groupError || !group) {
      console.error("Failed to fetch group:", groupError);
      return new Response(
        JSON.stringify({ error: "Group not found", details: groupError }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("Fetched group:", group.name);

    const userName = `${registration.first_name} ${registration.last_name}`.trim() || "Amigo/a";
    const emailHtml = buildEmailHtml(userName, group as GroupDetails);
    const emailSubject = `¡Bienvenido/a a GCX! - ${group.name}`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [registration.email],
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend API error:", resendData);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: resendData }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("Email sent successfully:", resendData);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Confirmation email sent to ${registration.email}`,
        emailId: resendData.id,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
