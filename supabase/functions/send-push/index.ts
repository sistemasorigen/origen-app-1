// Supabase Edge Function: send-push
//
// Manda como notificación push del sistema cada aviso nuevo de
// app_notifications, a todos los dispositivos donde esa persona activó las
// notificaciones (tabla push_suscripciones, sql/push_notificaciones.sql).
//
// La dispara el trigger `trg_app_notifications_push` con la clave de
// servicio, que es lo único que acepta. El pedido trae SÓLO el id del aviso:
// el texto y a quién va se leen acá, de la base.
//
//   · Web Push con claves VAPID (npm:web-push, probado en Supabase Edge el
//     2026-10-28 contra un Chrome de verdad). Sin Firebase ni cuentas.
//   · 404/410 del servicio de push → la suscripción ya no existe: se borra.
//     Otro error → fallos+1; con 5 seguidos, se borra. Éxito → last_ok_at.
//   · Nada del contenido en los logs: sólo cuántos salieron y qué falló.
//
// Secretos: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
// ORIGEN_SERVICE_ROLE_KEY y SUPABASE_URL. La clave pública también está en
// el frontend (src/utils/push.ts): si se cambian las claves, cambiar las dos,
// y todas las suscripciones existentes dejan de servir.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import webpush from "npm:web-push@3.6.7";
import { armarPayload, desenlace, FALLOS_PARA_BORRAR, TIPOS_SIN_PUSH } from "./armado.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("ORIGEN_SERVICE_ROLE_KEY");
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT");

/** Un día: si el teléfono está apagado más que eso, el aviso ya no sirve como push (sigue en la app). */
const TTL_SEGUNDOS = 86_400;

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200 });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    console.error("[send-push] faltan variables de entorno");
    return json({ error: "Servicio no configurado" }, 500);
  }

  // Sólo la clave de servicio: la anon también es un JWT válido y viaja en el
  // bundle del frontend, así que verify_jwt no alcanza.
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (bearer !== SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[send-push] llamada rechazada: sin la clave de servicio");
    return json({ error: "No autorizado" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body?.notificacion_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Falta notificacion_id" }, 400);

    const { data: notif } = await supabase
      .from("app_notifications")
      .select("id, user_id, title, message, type, action_url")
      .eq("id", id)
      .maybeSingle();
    if (!notif) return json({ error: "Aviso no encontrado" }, 404);
    if (!notif.user_id) return json({ ok: true, enviados: 0, omitido: "sin_destinatario" });
    if (TIPOS_SIN_PUSH.includes(notif.type)) return json({ ok: true, enviados: 0, omitido: "tipo_sin_push" });

    const { data: subs } = await supabase
      .from("push_suscripciones")
      .select("id, endpoint, p256dh, auth, fallos")
      .eq("user_id", notif.user_id);
    if (!subs || subs.length === 0) return json({ ok: true, enviados: 0, omitido: "sin_suscripciones" });

    const { count: sinLeer } = await supabase
      .from("app_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", notif.user_id)
      .eq("is_read", false);

    const payload = JSON.stringify(armarPayload(notif, sinLeer));
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    let enviados = 0, borradas = 0, fallidas = 0;
    await Promise.all(subs.map(async (s) => {
      let status: number | null = null;
      try {
        const r = await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          // 'normal' para todos: ningún aviso de la app es de acción
          // inmediata (no hay alarmas ni llamadas), y 'high' despierta el
          // teléfono y gasta batería.
          { TTL: TTL_SEGUNDOS, urgency: "normal" },
        );
        status = r.statusCode;
      } catch (e) {
        status = (e as { statusCode?: number }).statusCode ?? null;
      }

      const d = desenlace(status);
      if (d === "ok") {
        enviados++;
        await supabase.from("push_suscripciones")
          .update({ last_ok_at: new Date().toISOString(), fallos: 0 }).eq("id", s.id);
      } else if (d === "borrar" || (s.fallos ?? 0) + 1 >= FALLOS_PARA_BORRAR) {
        borradas++;
        await supabase.from("push_suscripciones").delete().eq("id", s.id);
      } else {
        fallidas++;
        console.warn("[send-push] envío fallido, status:", status);
        await supabase.from("push_suscripciones")
          .update({ fallos: (s.fallos ?? 0) + 1 }).eq("id", s.id);
      }
    }));

    return json({ ok: true, enviados, borradas, fallidas });
  } catch (err) {
    console.error("[send-push] error interno:", String(err).slice(0, 200));
    return json({ error: "Error interno" }, 500);
  }
});
