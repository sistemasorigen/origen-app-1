// Supabase Edge Function: send-nocturna-entrada
//
// Manda el email con la entrada de Nocturna: un QR para toda la familia, con
// su código corto en texto como respaldo.
//
// La dispara el trigger `trigger_nocturna_entrada` al crearse una inscripción,
// y la RPC `reenviar_nocturna_email` cuando el staff reintenta desde el panel.
// En los dos casos el pedido viene de la base con la clave de servicio, que es
// lo único que esta función acepta.
//
// Diferencias a propósito con send-dianino-tickets:
//   · El QR NO se sube a ningún bucket. Aquel lo sube a `images`, que es
//     PÚBLICO: la entrada de una familia queda a la vista de cualquiera que
//     adivine la ruta, y además Outlook bloquea las imágenes remotas por
//     defecto. Acá el PNG viaja incrustado como adjunto con `content_id` y el
//     HTML lo referencia con `cid:` — se ve aunque el cliente bloquee imágenes.
//   · El QR se genera con `margin: 4`, el mínimo que pide el estándar. Aquel
//     usa `margin: 1` y un margen escaso hace fallar al escáner con poca luz.
//   · Verifica la clave de servicio antes de hacer nada.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
  armarHtml,
  CID_QR,
  errorLegible,
  type Inscripcion,
  qrEnBase64,
} from "./armado.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("ORIGEN_SERVICE_ROLE_KEY");

const FROM_EMAIL = "'Origen' <team@app.origeniglesia.org>";
const ASUNTO = "Tu entrada para Nocturna · viernes 30/10, 11 PM";

// ── Función ───────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    // Nadie tiene que llamarla desde un navegador, así que no se abre CORS.
    return new Response("ok", { status: 200 });
  }

  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[nocturna-email] faltan variables de entorno");
    return new Response(JSON.stringify({ error: "Servicio no configurado" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Puerta de entrada ───────────────────────────────────────────────────
  // Sólo la clave de servicio. La clave anon también es un JWT válido y viaja
  // en el bundle del frontend, así que `verify_jwt` de la plataforma no
  // alcanza: sin esta comparación, cualquiera podría disparar emails con los
  // datos de familias reales y quemar la cuota del día.
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (bearer !== SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[nocturna-email] llamada rechazada: sin la clave de servicio");
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let inscripcionId = "";

  try {
    const body = await req.json().catch(() => ({}));
    inscripcionId = String(body?.inscripcion_id ?? "");

    if (!inscripcionId) {
      return new Response(JSON.stringify({ error: "Falta inscripcion_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase
      .from("nocturna_inscripciones")
      .select(
        "id, codigo_entrada, adulto_nombre, adulto_apellido, adulto_email, total, email_intentos, " +
          "jovenes:nocturna_jovenes(nombre, apellido, tribu, retiro_tipo, retiro_nombre, retiro_apellido)"
      )
      .eq("id", inscripcionId)
      .single();

    if (error || !data) {
      console.error("[nocturna-email] no se encontró la inscripción", inscripcionId, error);
      return new Response(JSON.stringify({ error: "Inscripción no encontrada" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const insc = data as unknown as Inscripcion;
    insc.jovenes = insc.jovenes ?? [];

    // Si llegara a dispararse antes de que existan los chicos, el email
    // saldría sin la lista — justo lo que la familia necesita leer. Mejor no
    // mandarlo y dejar el motivo anotado para reenviarlo desde el panel.
    if (insc.jovenes.length === 0) {
      await supabase
        .from("nocturna_inscripciones")
        .update({
          email_error: "La inscripción no tenía chicos cargados al momento de mandar el email.",
          email_intentos: (insc.email_intentos ?? 0) + 1,
        })
        .eq("id", inscripcionId);

      return new Response(JSON.stringify({ error: "La inscripción no tiene chicos" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }

    const html = armarHtml(insc);
    const qr = await qrEnBase64(insc.id);

    const respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [insc.adulto_email],
        subject: ASUNTO,
        html,
        attachments: [
          {
            content: qr,
            filename: "entrada-nocturna.png",
            content_id: CID_QR,
            content_type: "image/png",
          },
        ],
      }),
    });

    const cuerpo = await respuesta.json().catch(() => ({}));
    const intentos = (insc.email_intentos ?? 0) + 1;

    if (!respuesta.ok) {
      const motivo = errorLegible(respuesta.status, cuerpo);
      console.error("[nocturna-email] Resend falló:", respuesta.status, cuerpo);

      await supabase
        .from("nocturna_inscripciones")
        .update({ email_error: motivo, email_intentos: intentos })
        .eq("id", inscripcionId);

      return new Response(JSON.stringify({ error: motivo, details: cuerpo }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("nocturna_inscripciones")
      .update({
        email_enviado_at: new Date().toISOString(),
        email_error: null,
        email_intentos: intentos,
      })
      .eq("id", inscripcionId);

    return new Response(
      JSON.stringify({ success: true, emailId: cuerpo?.id, chicos: insc.jovenes.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[nocturna-email] error interno:", err);

    // Que falle el envío no puede dejar la inscripción sin rastro de por qué.
    if (inscripcionId) {
      const { data: actual } = await supabase
        .from("nocturna_inscripciones")
        .select("email_intentos")
        .eq("id", inscripcionId)
        .single();

      await supabase
        .from("nocturna_inscripciones")
        .update({
          email_error: `Error al armar o mandar el email: ${String(err)}`,
          email_intentos: (actual?.email_intentos ?? 0) + 1,
        })
        .eq("id", inscripcionId);
    }

    return new Response(JSON.stringify({ error: "Error interno", details: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
