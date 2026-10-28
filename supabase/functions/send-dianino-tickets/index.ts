// Supabase Edge Function: send-dianino-tickets
//
// Manda el email con el QR de entrada al Día del Niño:
//   · { sesion_id }      → lo manda notify_dianino_tickets al crearse la
//                           sesión. El email va a la dirección que guarda esa
//                           sesión, leída de la base.
//   · { modo: 'prueba' } → un email de muestra con datos inventados, SÓLO a
//                           sistemas@origeniglesia.org (fijo acá).
//
// La dispara el trigger de sql/send_dianino_seguro.sql con la clave de
// servicio, que es lo ÚNICO que acepta.
//
// Hasta el 2026-10-28 esta función no pedía ninguna clave (verify_jwt false y
// ningún chequeo) aunque el trigger sí la mandaba: cualquiera, sin sesión,
// podía hacerle mandar las entradas de cualquier familia de la base y quemar
// la cuota compartida de Resend (100 por día). Además el nombre entraba crudo
// al HTML y al atributo alt del <img> del QR.
//
// verify_jwt sigue en false a propósito: el control es el bearer contra la
// clave de servicio, como en send-nocturna-entrada (la clave anon también es
// un JWT válido, así que verify_jwt no alcanzaría).
//
//   · Idempotente: tabla dianino_hechos, una fila por sesión.
//   · Tope de 90 emails por día (hora argentina). Ver TOPE_EMAILS_DIA.
//
// El evento fue el 2026-08-15 y no hay sesiones nuevas desde entonces, pero el
// trigger sigue prendido para la próxima edición.
//
// Desplegar con: npx supabase functions deploy send-dianino-tickets
//   --project-ref oqtumgalnozppqnnjjdb --use-api --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import QRCode from "npm:qrcode";
import {
  ASUNTO, claveSesion, DATOS_DE_PRUEBA, DESTINO_PRUEBA, escaparHtml,
  inicioDelDiaArgentino, nombreCompleto, TOPE_EMAILS_DIA,
} from "./armado.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("ORIGEN_SERVICE_ROLE_KEY");

const FROM_EMAIL = "'Origen' <team@app.origeniglesia.org>";
const QR_PREFIX = "ORIGEN-DIANINO-";
const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Paleta "Día del Niño" (misma que pages/eventos/dianino/InscripcionDiaNino.tsx) ──
const INK = "#2A211B";
const BG_OUTER = "#F5F0E6";
const BG_CARD = "#FFFFFF";
const BG_HEADER = "#FDF6E9";
const BORDER_MUTED = "#EAD9BE";
const CRAYON_RED = "#E63B2E";
const CRAYON_BLUE = "#4A7FC9";
const CRAYON_GREEN = "#4CAF50";
const CRAYON_MUSTARD = "#F5B942";
const BRAND_ORANGE = "#F0703A";
const TEXT_BODY = "#5C4E3D";
const TEXT_MUTED = "#8A7857";

interface DianinoTicket {
  id: string;
  first_name: string;
  last_name: string;
  is_adult: boolean;
}

async function generateQrPublicUrl(
  supabase: ReturnType<typeof createClient>,
  ticketId: string
): Promise<string | null> {
  try {
    const qrText = `${QR_PREFIX}${ticketId}`;
    const buffer = await QRCode.toBuffer(qrText, { type: "png", width: 500, margin: 1 });

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

function buildTicketCardHtml(nombreCrudo: string, roleLabel: string, qrUrl: string | null): string {
  // Escapado acá adentro, no en quien llama: el nombre aparece dos veces, y
  // una de ellas es dentro del atributo alt, donde una comilla doble se sale.
  const name = escaparHtml(nombreCrudo);
  return `
    <tr>
      <td style="background-color: ${BG_CARD}; padding: 8px 40px 24px 40px;" bgcolor="${BG_CARD}">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BG_CARD}; border: 3px solid ${BRAND_ORANGE}; border-radius: 20px;" bgcolor="${BG_CARD}">
          <tr>
            <td align="center" style="padding: 24px;">
              <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 900; color: ${BRAND_ORANGE}; text-transform: uppercase; letter-spacing: 1.5px;">
                ${roleLabel}
              </p>
              <p style="margin: 0 0 16px 0; font-size: 20px; font-weight: 900; color: ${INK}; text-transform: uppercase;">
                ${name}
              </p>
              ${qrUrl
                ? `<img src="${qrUrl}" alt="QR de entrada de ${name}" width="320" height="320" style="display: block; width: 100%; max-width: 320px; height: auto; border: 3px solid ${BORDER_MUTED}; border-radius: 16px; margin: 0 auto;" />`
                : `<p style="color: ${CRAYON_RED}; font-size: 13px; font-weight: 700;">No pudimos generar este QR — contactanos.</p>`
              }
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function buildEmailHtml(adultNameCrudo: string, cards: string): string {
  const adultName = escaparHtml(adultNameCrudo);
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>¡Tus entradas para el Día del Niño!</title>
  <style>
    /* Fuerza modo claro en clientes que sí respetan
       @media (prefers-color-scheme) dentro del email
       (Apple Mail, algunos Outlook) — Gmail no lo
       respeta acá, por eso además reforzamos con
       bgcolor= en los CAMBIOS 2-4. */
    :root { color-scheme: light only; }
    @media (prefers-color-scheme: dark) {
      body, table, td { background-color: ${BG_OUTER} !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: ${BG_OUTER};" bgcolor="${BG_OUTER}">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BG_OUTER}; padding: 40px 20px;" bgcolor="${BG_OUTER}">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: ${BG_CARD}; border: 2px solid ${BORDER_MUTED}; border-radius: 24px;" bgcolor="${BG_CARD}">

          <tr>
            <td style="background-color: ${BG_HEADER}; padding: 32px 40px 28px 40px; text-align: center; border-radius: 24px 24px 0 0;" bgcolor="${BG_HEADER}">
              <img src="https://app.origeniglesia.org/origen-logo-full.png" alt="Origen" width="150" style="display: block; margin: 0 auto 18px auto; max-width: 150px; height: auto;" />
              <h1 style="margin: 0; font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.4;">
                <span style="color: ${CRAYON_RED};">¡Nos</span>
                <span style="color: ${CRAYON_BLUE};">vemos</span>
                <span style="color: ${CRAYON_GREEN};">el</span>
                <span style="color: ${BRAND_ORANGE};">sábado</span>
                <span style="color: ${CRAYON_RED};">15/08</span>
                <span style="color: ${CRAYON_BLUE};">a</span>
                <span style="color: ${CRAYON_GREEN};">las</span>
                <span style="color: ${BRAND_ORANGE};">4pm!!</span>
              </h1>
            </td>
          </tr>

          <tr>
            <td style="background-color: ${BG_CARD}; padding: 24px 40px 4px 40px;" bgcolor="${BG_CARD}">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="33%" align="center" style="background-color: ${CRAYON_MUSTARD}; color: ${INK}; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 4px; border-radius: 999px;" bgcolor="${CRAYON_MUSTARD}">SÁB 15/08</td>
                  <td width="10">&nbsp;</td>
                  <td width="33%" align="center" style="background-color: ${CRAYON_BLUE}; color: #FFFFFF; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 4px; border-radius: 999px;" bgcolor="${CRAYON_BLUE}">16 A 19HS</td>
                  <td width="10">&nbsp;</td>
                  <td width="34%" align="center" style="background-color: ${CRAYON_GREEN}; color: #FFFFFF; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 4px; border-radius: 999px;" bgcolor="${CRAYON_GREEN}">ENTRADA GRATIS</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color: ${BG_CARD}; padding: 20px 40px 8px 40px;" bgcolor="${BG_CARD}">
              <p style="margin: 0; font-size: 16px; color: ${TEXT_BODY}; line-height: 1.6;">
                Hola <strong style="color: ${INK};">${adultName}</strong>, ¡ya está todo listo!
                Acá abajo tenés tu entrada. Mostrala en la puerta el día del evento —
                con este único código se acredita a toda tu familia.
              </p>
              <p style="margin: 16px 0 0 0; font-size: 14px; color: ${TEXT_MUTED}; line-height: 1.6;">
                Si perdiste este email, podés volver a buscarla en cualquier momento:
              </p>
              <table cellpadding="0" cellspacing="0" style="margin: 14px auto 0 auto;">
                <tr>
                  <td align="center" style="background-color: ${BRAND_ORANGE}; border-radius: 999px;" bgcolor="${BRAND_ORANGE}">
                    <a href="https://app.origeniglesia.org/#/dia-del-nino/buscar" style="display: inline-block; padding: 12px 28px; font-size: 13px; font-weight: 900; color: #FFFFFF; text-transform: uppercase; letter-spacing: 1px; text-decoration: none; border-radius: 999px;">
                      Buscar mi entrada
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${cards}

          <tr>
            <td style="background-color: ${BG_CARD}; padding: 12px 40px 28px 40px; text-align: center;" bgcolor="${BG_CARD}">
              <p style="margin: 0; font-size: 13px; color: ${TEXT_MUTED};">
                ¡Te esperamos con muchas ganas de festejar! 🎊
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color: ${BG_HEADER}; padding: 20px 40px; text-align: center; border-radius: 0 0 24px 24px;" bgcolor="${BG_HEADER}">
              <p style="margin: 0; font-size: 12px; color: ${TEXT_MUTED};">
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

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });

// deno-lint-ignore no-explicit-any
type Cliente = any;

/** Anota la sesión; devuelve false si ya estaba (el email ya salió). */
async function tomar(supabase: Cliente, clave: string): Promise<boolean> {
  const { error } = await supabase.from("dianino_hechos").insert({ clave });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(`dianino_hechos: ${error.code}`);
}

async function soltar(supabase: Cliente, clave: string): Promise<void> {
  await supabase.from("dianino_hechos").delete().eq("clave", clave);
}

/** Cuántos emails ya salieron hoy (hora argentina). */
async function emailsDeHoy(supabase: Cliente): Promise<number> {
  const { count } = await supabase
    .from("dianino_hechos")
    .select("clave", { count: "exact", head: true })
    .gte("created_at", inicioDelDiaArgentino());
  return count ?? 0;
}

async function mandarEmail(to: string, asunto: string, html: string): Promise<{ ok: boolean; status?: number }> {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject: asunto, html }),
  });
  return { ok: r.ok, status: r.status };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200 });

  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[dianino] faltan variables de entorno");
    return json({ error: "Servicio no configurado" }, 500);
  }

  // Sólo la clave de servicio. Cualquier otra cosa —sin bearer, la clave
  // anon, un JWT de usuario— se rechaza antes de leer el cuerpo.
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (bearer !== SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[dianino] llamada rechazada: sin la clave de servicio");
    return json({ error: "No autorizado" }, 401);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));

    if (body?.modo === "prueba") {
      const nombre = nombreCompleto(DATOS_DE_PRUEBA.nombre, DATOS_DE_PRUEBA.apellido);
      const html = buildEmailHtml(nombre, buildTicketCardHtml(nombre, "Entrada familiar", null));
      const r = await mandarEmail(DESTINO_PRUEBA, `[PRUEBA] ${ASUNTO}`, html);
      return json({ ok: r.ok, status: r.status ?? null }, r.ok ? 200 : 502);
    }

    const sesionId = String(body?.sesion_id ?? "");
    if (!ES_UUID.test(sesionId)) return json({ error: "Falta sesion_id" }, 400);

    // La dirección sale de la base, nunca del pedido.
    const { data: session } = await supabase
      .from("dianino_sessions").select("id, email").eq("id", sesionId).maybeSingle();
    if (!session) return json({ error: "Sesión no encontrada" }, 404);
    if (!session.email) return json({ ok: true, omitido: "sin_email" });

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

    const adultName = nombreCompleto(adultTicket.first_name, adultTicket.last_name);
    const clave = claveSesion(sesionId);

    if (await emailsDeHoy(supabase) >= TOPE_EMAILS_DIA) {
      console.warn("[dianino] tope diario alcanzado");
      return json({ ok: true, omitido: "tope_diario" });
    }

    // La clave se toma ANTES de generar el QR y de llamar a Resend: si por
    // cualquier motivo llegan dos pedidos de la misma sesión, el segundo no
    // manda nada. Si después falla, se suelta y un reintento vuelve a andar.
    if (!(await tomar(supabase, clave))) return json({ ok: true, omitido: "ya_enviado" });

    try {
      const qrUrl = await generateQrPublicUrl(supabase, adultTicket.id);
      const emailHtml = buildEmailHtml(adultName, buildTicketCardHtml(adultName, "Entrada familiar", qrUrl));
      const r = await mandarEmail(session.email, ASUNTO, emailHtml);
      if (!r.ok) {
        console.error("[dianino] Resend falló:", r.status);
        await soltar(supabase, clave);
        return json({ error: "Error al enviar el email", status: r.status }, 502);
      }
      // Sin la dirección en la respuesta: pg_net guarda el cuerpo.
      return json({ ok: true, emails: 1, qr: qrUrl ? "sí" : "no" });
    } catch (e) {
      await soltar(supabase, clave);
      throw e;
    }
  } catch (error) {
    console.error("[dianino] error interno:", String(error).slice(0, 200));
    return json({ error: "Error interno" }, 500);
  }
});
