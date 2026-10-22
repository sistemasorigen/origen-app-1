// Supabase Edge Function: send-reporte-problema
//
// Avisa a Sistemas por email que alguien reportó un problema desde
// Mi cuenta · Reportar un problema (design-claude/Email - Nuevo Reporte.dc.html).
//
// La dispara el trigger `trg_reportes_problemas_email` (sql/reportes_sistemas.sql)
// con la clave de servicio, que es lo único que acepta. El pedido trae SÓLO el
// id del reporte: el texto, quién lo mandó y su contacto se leen acá, de la
// base, y nunca del cuerpo del pedido.
//
//   · Idempotente: si el reporte ya tiene email_enviado_at, no manda nada.
//   · Tope diario: 30 emails de reportes por día (hora argentina). Resend da
//     100 por día para toda la app; los reportes no se pueden comer la cuota
//     de las entradas. Pasado el tope queda anotado en email_error y el
//     reporte igual está en /panel-admin/reportes.
//   · La captura NO se adjunta: está en un bucket privado y se mira en el panel.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { armarEmail, errorLegible, inicioDelDiaArgentino, type ReporteParaEmail } from "./armado.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("ORIGEN_SERVICE_ROLE_KEY");

const FROM_EMAIL = "'Origen' <team@app.origeniglesia.org>";
// Fijo en el servidor: el pedido no puede elegir a quién se manda.
const DESTINO = "sistemas@origeniglesia.org";
const TOPE_DIARIO = 30;

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200 });

  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[reporte-email] faltan variables de entorno");
    return json({ error: "Servicio no configurado" }, 500);
  }

  // Sólo la clave de servicio: la anon también es un JWT válido y viaja en el
  // bundle del frontend, así que verify_jwt no alcanza.
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (bearer !== SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[reporte-email] llamada rechazada: sin la clave de servicio");
    return json({ error: "No autorizado" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let reporteId = "";

  try {
    const body = await req.json().catch(() => ({}));
    reporteId = String(body?.reporte_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(reporteId)) return json({ error: "Falta reporte_id" }, 400);

    const { data: rep, error } = await supabase
      .from("reportes_problemas")
      .select("id, numero, user_id, descripcion, pantalla, captura_path, version_app, dispositivo, created_at, email_enviado_at")
      .eq("id", reporteId)
      .single();
    if (error || !rep) {
      console.error("[reporte-email] no se encontró el reporte");
      return json({ error: "Reporte no encontrado" }, 404);
    }

    if (rep.email_enviado_at) return json({ ok: true, omitido: "ya_enviado" });

    const { count } = await supabase
      .from("reportes_problemas")
      .select("id", { count: "exact", head: true })
      .gte("email_enviado_at", inicioDelDiaArgentino());
    if ((count ?? 0) >= TOPE_DIARIO) {
      await supabase.from("reportes_problemas")
        .update({ email_error: `Tope diario de ${TOPE_DIARIO} emails alcanzado: está en el panel.` })
        .eq("id", reporteId);
      return json({ ok: true, omitido: "tope_diario" });
    }

    const { data: quien } = await supabase
      .from("users")
      .select("name, email, phone")
      .eq("id", rep.user_id)
      .maybeSingle();

    const { asunto, html } = armarEmail({
      ...(rep as unknown as ReporteParaEmail),
      nombre: quien?.name ?? null,
      email: quien?.email ?? null,
      telefono: quien?.phone ?? null,
    });

    const respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: FROM_EMAIL, to: [DESTINO], subject: asunto, html }),
    });
    const cuerpo = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      const motivo = errorLegible(respuesta.status, cuerpo);
      console.error("[reporte-email] Resend falló:", respuesta.status);
      await supabase.from("reportes_problemas").update({ email_error: motivo }).eq("id", reporteId);
      return json({ error: motivo }, 502);
    }

    await supabase.from("reportes_problemas")
      .update({ email_enviado_at: new Date().toISOString(), email_error: null })
      .eq("id", reporteId);

    return json({ ok: true, emailId: cuerpo?.id });
  } catch (err) {
    // Sin el texto ni datos de nadie en el log: sólo qué falló.
    console.error("[reporte-email] error interno:", String(err).slice(0, 200));
    if (reporteId) {
      await supabase.from("reportes_problemas")
        .update({ email_error: `Error al armar o mandar el email: ${String(err).slice(0, 200)}` })
        .eq("id", reporteId);
    }
    return json({ error: "Error interno" }, 500);
  }
});
