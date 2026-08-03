// Supabase Edge Function: send-dianino-tickets
// Envía el email con los QR de entrada al crearse una sesión de Día del Niño

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import QRCode from "npm:qrcode";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://tu-dominio.com';
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("ORIGEN_SERVICE_ROLE_KEY");

const FROM_EMAIL = "'Origen' <team@app.origeniglesia.org>";
const QR_PREFIX = "ORIGEN-DIANINO-";

interface DianinoTicket {
  id: string;
  first_name: string;
  last_name: string;
  is_adult: boolean;
}

interface SessionRecord {
  id: string;
  email: string;
}

interface WebhookPayload {
  type: "INSERT";
  table: "dianino_sessions";
  schema: "public";
  record: SessionRecord;
}

async function generateQrPublicUrl(
  supabase: ReturnType<typeof createClient>,
  ticketId: string
): Promise<string | null> {
  try {
    const qrText = `${QR_PREFIX}${ticketId}`;
    const buffer = await QRCode.toBuffer(qrText, { type: "png", width: 300, margin: 1 });

    const path = `dianino-tickets/${ticketId}.png`;
    const { error: uploadError } = await supabase.storage
      .from("images")
      .upload(path, buffer, { contentType: "image/png", upsert: true });

    if (uploadError) {
      console.error(`[QR] Error subiendo ${ticketId}:`, uploadError);
      return null;
    }

    const { data } = supabase.storage.from("images").getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error(`[QR] Error generando ${ticketId}:`, err);
    return null;
  }
}

function buildTicketCardHtml(name: string, roleLabel: string, qrUrl: string | null): string {
  return `
    <tr>
      <td style="padding: 24px 40px; border-bottom: 3px dashed #000000;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center">
              <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 900; color: #888888; text-transform: uppercase; letter-spacing: 1.5px;">
                ${roleLabel}
              </p>
              <p style="margin: 0 0 16px 0; font-size: 20px; font-weight: 900; color: #000000; text-transform: uppercase;">
                ${name}
              </p>
              ${qrUrl
                ? `<img src="${qrUrl}" alt="QR de entrada de ${name}" width="220" height="220" style="display: block; border: 4px solid #000000; margin: 0 auto;" />`
                : `<p style="color: #dc2626; font-size: 13px; font-weight: 700;">No pudimos generar este QR — contactanos.</p>`
              }
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function buildEmailHtml(adultName: string, cards: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>¡Tus entradas para el Día del Niño!</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 4px solid #000000; box-shadow: 8px 8px 0px #000000;">

          <tr>
            <td style="background-color: #000000; padding: 36px 40px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 32px;">🎉🎈</p>
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px;">
                ¡Nos vemos el sábado 15/08 a las 4pm!!
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding: 32px 40px 8px 40px;">
              <p style="margin: 0; font-size: 16px; color: #333333; line-height: 1.6;">
                Hola <strong style="color: #000000;">${adultName}</strong>, ¡ya está todo listo!
                Acá abajo tenés tu entrada. Mostrala en la puerta el día del evento —
                con este único código se acredita a toda tu familia.
              </p>
              <p style="margin: 16px 0 0 0; font-size: 14px; color: #666666; line-height: 1.6;">
                Si perdiste este email, podés
                volver a buscarla en cualquier momento desde <strong>app.origeniglesia.org/#/dia-del-nino/buscar</strong>.
              </p>
            </td>
          </tr>

          ${cards}

          <tr>
            <td style="padding: 28px 40px; text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #666666;">
                ¡Te esperamos con muchas ganas de festejar! 🎊
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color: #000000; padding: 24px 40px; text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #888888;">
                © 2026 Origen App · Día del Niño
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey, x-supabase-api-key",
      },
    });
  }

  try {
    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Faltan variables de entorno");
      return new Response(JSON.stringify({ error: "Servicio no configurado" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const payload = (await req.json()) as WebhookPayload;

    if (payload.type !== "INSERT" || payload.table !== "dianino_sessions") {
      return new Response(JSON.stringify({ message: "Evento ignorado" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const session = payload.record;

    if (!session.email) {
      console.error("Sesión sin email:", session.id);
      return new Response(JSON.stringify({ error: "Sesión sin email" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: tickets, error: ticketsError } = await supabase
      .from("dianino_tickets")
      .select("id, first_name, last_name, is_adult")
      .eq("session_id", session.id)
      .order("is_adult", { ascending: false });

    if (ticketsError || !tickets || tickets.length === 0) {
      console.error("No se encontraron tickets para la sesión:", session.id, ticketsError);
      return new Response(JSON.stringify({ error: "Sin tickets para esta sesión", details: ticketsError, sessionId: session.id, ticketsFound: tickets?.length ?? null }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const adultTicket = (tickets as DianinoTicket[]).find((t) => t.is_adult);

    if (!adultTicket) {
      console.error("No se encontró ticket de adulto para la sesión:", session.id);
      return new Response(JSON.stringify({ error: "Sin ticket de adulto para esta sesión", sessionId: session.id }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const adultName = `${adultTicket.first_name} ${adultTicket.last_name}`;
    const qrUrl = await generateQrPublicUrl(supabase, adultTicket.id);
    const cardsHtml = buildTicketCardHtml(adultName, "Entrada familiar", qrUrl);

    const emailHtml = buildEmailHtml(adultName, cardsHtml);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [session.email],
        subject: "🎉 ¡Tus entradas para el Día del Niño!",
        html: emailHtml,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Error de Resend:", resendData);
      return new Response(JSON.stringify({ error: "Error al enviar el email", details: resendData }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: `Email enviado a ${session.email}`, emailId: resendData.id }),
      { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": ALLOWED_ORIGIN } }
    );
  } catch (error) {
    console.error("Error de la Edge Function:", error);
    return new Response(JSON.stringify({ error: "Error interno", details: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
