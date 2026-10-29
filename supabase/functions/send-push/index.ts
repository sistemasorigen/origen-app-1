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
// LAS REGLAS DE LA GESTIÓN DE NOTIFICACIONES (desde el 2026-10-29).
// Antes de mandar le pregunta a la base (notif_puede_enviar):
//   · pausada → no sale push. El aviso igual está en la campanita.
//   · tope    → esa persona ya recibió hoy el máximo de esa alerta.
//   · diferir → cae en el horario de no molestar: se guarda en
//               notif_push_diferidos y lo manda el cron notif-push-diferidos
//               cuando el horario termina. NO se pierde.
//   · enviar  → como siempre.
// Cada decisión queda en notif_push_log, que es de donde sale el tope y las
// métricas de la pantalla. Si la base no contesta, se MANDA: un aviso que no
// llega es peor que uno a destiempo.
//
// Acepta también { modo: 'diferidos' } (lo llama el cron cada 5 minutos):
// toma los diferidos vencidos y los manda.
//
// Secretos: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
// ORIGEN_SERVICE_ROLE_KEY y SUPABASE_URL. La clave pública también está en
// el frontend (src/utils/push.ts): si se cambian las claves, cambiar las dos,
// y todas las suscripciones existentes dejan de servir.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import webpush from "npm:web-push@3.6.7";
import {
  accionDe, armarPayload, desenlace, FALLOS_PARA_BORRAR, resultadoDe, TIPOS_SIN_PUSH, type Modo,
} from "./armado.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("ORIGEN_SERVICE_ROLE_KEY");
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT");

/** Un día: si el teléfono está apagado más que eso, el aviso ya no sirve como push (sigue en la app). */
const TTL_SEGUNDOS = 86_400;

/** Cuántos diferidos se mandan por pasada del cron. */
const DIFERIDOS_POR_PASADA = 100;

const ES_UUID = /^[0-9a-f-]{36}$/i;

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });

// deno-lint-ignore no-explicit-any
type Cliente = any;

interface Resultado {
  enviados: number;
  borradas: number;
  fallidas: number;
  omitido?: string;
}

/** Deja constancia de la decisión. Si falla, no frena el envío. */
async function anotar(
  supabase: Cliente,
  n: { id: string; user_id: string | null; alerta_clave: string | null },
  resultado: string,
): Promise<void> {
  const { error } = await supabase.from("notif_push_log").insert({
    notificacion_id: n.id,
    alerta_clave: n.alerta_clave,
    user_id: n.user_id,
    resultado,
  });
  if (error) console.warn("[send-push] no se pudo anotar en notif_push_log:", error.code);
}

/** Manda el push de UN aviso. */
async function mandarUno(supabase: Cliente, id: string, modo: Modo): Promise<Resultado> {
  const vacio: Resultado = { enviados: 0, borradas: 0, fallidas: 0 };

  const { data: notif } = await supabase
    .from("app_notifications")
    .select("id, user_id, title, message, type, action_url, alerta_clave")
    .eq("id", id)
    .maybeSingle();
  if (!notif) return { ...vacio, omitido: "no_encontrado" };
  if (!notif.user_id) return { ...vacio, omitido: "sin_destinatario" };
  if (TIPOS_SIN_PUSH.includes(notif.type)) return { ...vacio, omitido: "tipo_sin_push" };

  // Las reglas de la alerta. Si esto falla, se manda igual (ver accionDe).
  const { data: reglas, error: errorReglas } = await supabase
    .rpc("notif_puede_enviar", { p_notificacion_id: id });
  if (errorReglas) {
    console.warn("[send-push] notif_puede_enviar falló, se manda igual:", errorReglas.code ?? errorReglas.message);
  }
  const decision = (reglas as { decision?: string } | null)?.decision;
  const accion = accionDe(decision, modo);

  if (accion === "no_mandar") {
    await anotar(supabase, notif, resultadoDe(accion, decision, 0));
    return { ...vacio, omitido: decision };
  }

  if (accion === "diferir") {
    const enviarEn = (reglas as { enviar_en?: string } | null)?.enviar_en;
    const { error } = await supabase
      .from("notif_push_diferidos")
      .upsert({ notificacion_id: id, enviar_en: enviarEn }, { onConflict: "notificacion_id" });
    if (error) {
      // No se pudo guardar para después: mejor mandarlo ahora que perderlo.
      console.warn("[send-push] no se pudo diferir, se manda igual:", error.code);
    } else {
      await anotar(supabase, notif, resultadoDe(accion, decision, 0));
      return { ...vacio, omitido: "diferido" };
    }
  }

  const { data: subs } = await supabase
    .from("push_suscripciones")
    .select("id, endpoint, p256dh, auth, fallos")
    .eq("user_id", notif.user_id);
  if (!subs || subs.length === 0) return { ...vacio, omitido: "sin_suscripciones" };

  const { count: sinLeer } = await supabase
    .from("app_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", notif.user_id)
    .eq("is_read", false);

  const payload = JSON.stringify(armarPayload(notif, sinLeer));

  let enviados = 0, borradas = 0, fallidas = 0;
  await Promise.all(subs.map(async (s: { id: string; endpoint: string; p256dh: string; auth: string; fallos: number | null }) => {
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

  await anotar(supabase, notif, resultadoDe("mandar", decision, enviados));
  return { enviados, borradas, fallidas };
}

/** La pasada del cron: los que cayeron en "no molestar" y ya vencieron. */
async function mandarDiferidos(supabase: Cliente) {
  const { data, error } = await supabase.rpc("notif_diferidos_tomar", { p_tope: DIFERIDOS_POR_PASADA });
  if (error) {
    console.error("[send-push] no se pudieron tomar los diferidos:", error.code ?? error.message);
    return json({ error: "No se pudieron tomar los diferidos" }, 500);
  }

  const ids: string[] = ((data as { ids?: unknown })?.ids as string[] ?? []).filter((x) => ES_UUID.test(String(x)));
  let enviados = 0, borradas = 0, fallidas = 0;
  for (const id of ids) {
    const r = await mandarUno(supabase, id, "diferidos");
    enviados += r.enviados;
    borradas += r.borradas;
    fallidas += r.fallidas;
  }
  return json({ ok: true, diferidos: ids.length, enviados, borradas, fallidas });
}

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
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  try {
    const body = await req.json().catch(() => ({}));

    if (body?.modo === "diferidos") return await mandarDiferidos(supabase);

    const id = String(body?.notificacion_id ?? "");
    if (!ES_UUID.test(id)) return json({ error: "Falta notificacion_id" }, 400);

    const r = await mandarUno(supabase, id, "aviso");
    if (r.omitido === "no_encontrado") return json({ error: "Aviso no encontrado" }, 404);
    return json({ ok: true, ...r });
  } catch (err) {
    console.error("[send-push] error interno:", String(err).slice(0, 200));
    return json({ error: "Error interno" }, 500);
  }
});
