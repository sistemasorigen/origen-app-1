// Supabase Edge Function: notify-host
//
// Avisa a los anfitriones de un Grupo de Conexión:
//   · { registration_id }   → alguien se inscribió (PENDING): aviso en la app
//                              (que también sale como push) y email al
//                              anfitrión y al co-anfitrión.
//   · { grupo_aprobado_id } → el grupo pasó a 'approved': aviso en la app al
//                              anfitrión y al co-anfitrión (sin email, como
//                              siempre).
//   · { modo: 'prueba' }    → un email de muestra con datos inventados, SÓLO
//                              a sistemas@origeniglesia.org (fijo acá).
//
// La disparan los triggers de sql/notify_host_seguro.sql con la clave de
// servicio, que es lo ÚNICO que acepta. El pedido trae sólo el id: los
// nombres, el grupo y los emails se leen acá, de la base.
//
// Hasta el 2026-10-28 esta función no pedía ninguna clave (verify_jwt
// false y ningún chequeo): cualquiera, sin sesión, le hacía crear avisos y
// mandar emails a cualquier persona (modo test_all) o a cualquier anfitrión
// con el texto que quisiera. Esa versión quedó versionada en el commit
// "chore: versiona notify-host tal como está en producción". Se sacaron el
// modo test_all y el modo attendance_reminder (ningún cron ni trigger lo
// llamaba: el recordatorio de asistencia lo hace check_attendance_reminders).
//
// verify_jwt sigue en false a propósito: el control es el bearer contra la
// clave de servicio, como en send-nocturna-entrada (la clave anon también es
// un JWT válido, así que verify_jwt no alcanzaría).
//
//   · Idempotente: tabla notify_host_hechos, una clave por aviso y por email.
//   · Tope de 30 emails por día (hora argentina). Pasado el tope, el aviso en
//     la app igual se crea.
//   · Nada de datos personales en los logs.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
  avisoGrupoAprobado, avisoInscripcion, claveAviso, claveEmail, DATOS_DE_PRUEBA, DESTINO_PRUEBA,
  destinatarios, emailInscripcion, inicioDelDiaArgentino, nombreCompleto, TOPE_EMAILS_DIA, type Aviso,
} from "./armado.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("ORIGEN_SERVICE_ROLE_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "Origen <team@app.origeniglesia.org>";
const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });

// deno-lint-ignore no-explicit-any
type Cliente = any;

/** Anota una clave; devuelve false si ya estaba (eso ya se hizo antes). */
async function tomar(supabase: Cliente, clave: string): Promise<boolean> {
  const { error } = await supabase.from("notify_host_hechos").insert({ clave });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(`notify_host_hechos: ${error.code}`);
}

async function soltar(supabase: Cliente, clave: string): Promise<void> {
  await supabase.from("notify_host_hechos").delete().eq("clave", clave);
}

async function mandarEmail(to: string, asunto: string, html: string): Promise<{ ok: boolean; status?: number }> {
  if (!RESEND_API_KEY) return { ok: false };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject: asunto, html }),
  });
  return { ok: r.ok, status: r.status };
}

async function crearAviso(supabase: Cliente, userId: string, a: Aviso): Promise<void> {
  const { error } = await supabase.from("app_notifications").insert({
    user_id: userId, title: a.title, message: a.message, type: a.type, action_url: a.action_url,
  });
  if (error) throw new Error(`app_notifications: ${error.code}`);
}

async function inscripcion(supabase: Cliente, id: string) {
  const { data: reg } = await supabase
    .from("group_registrations")
    .select("id, group_id, first_name, last_name")
    .eq("id", id)
    .maybeSingle();
  if (!reg) return json({ error: "Inscripción no encontrada" }, 404);

  const { data: grupo } = await supabase
    .from("groups")
    .select("id, name, host_id, co_host_id")
    .eq("id", reg.group_id)
    .maybeSingle();
  if (!grupo || !grupo.host_id) return json({ ok: true, omitido: "sin_anfitrion" });

  const nombre = nombreCompleto(reg.first_name, reg.last_name);
  const aviso = avisoInscripcion(nombre, grupo.name);
  const { asunto, html } = emailInscripcion({ nombre, grupo: grupo.name, grupoId: grupo.id });

  let avisos = 0, emails = 0, omitidos = 0;
  for (const userId of destinatarios(grupo.host_id, grupo.co_host_id)) {
    if (await tomar(supabase, claveAviso(id, userId))) {
      try {
        await crearAviso(supabase, userId, aviso);
        avisos++;
      } catch (e) {
        await soltar(supabase, claveAviso(id, userId));
        throw e;
      }
    }

    // El email, con su propio tope. El aviso ya está: el tope no lo frena.
    const { count } = await supabase
      .from("notify_host_hechos")
      .select("clave", { count: "exact", head: true })
      .like("clave", "reg:%:email:%")
      .gte("created_at", inicioDelDiaArgentino());
    if ((count ?? 0) >= TOPE_EMAILS_DIA) { omitidos++; continue; }
    if (!(await tomar(supabase, claveEmail(id, userId)))) continue;

    const { data: u } = await supabase.from("users").select("email").eq("id", userId).maybeSingle();
    if (!u?.email) { await soltar(supabase, claveEmail(id, userId)); continue; }
    const r = await mandarEmail(u.email, asunto, html);
    if (r.ok) emails++;
    else {
      // No salió: se suelta la clave, así no cuenta para el tope.
      console.error("[notify-host] Resend falló:", r.status ?? "sin clave de Resend");
      await soltar(supabase, claveEmail(id, userId));
    }
  }
  return json({ ok: true, avisos, emails, omitidos_por_tope: omitidos });
}

async function grupoAprobado(supabase: Cliente, id: string) {
  const { data: grupo } = await supabase
    .from("groups")
    .select("id, name, host_id, co_host_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!grupo) return json({ error: "Grupo no encontrado" }, 404);
  // El trigger sólo llama en el paso a 'approved'; si para cuando llega el
  // pedido ya no está aprobado, no se avisa nada.
  if (grupo.status !== "approved" || !grupo.host_id) return json({ ok: true, omitido: "no_aprobado" });

  const aviso = avisoGrupoAprobado(grupo.name);
  let avisos = 0;
  for (const userId of destinatarios(grupo.host_id, grupo.co_host_id)) {
    await crearAviso(supabase, userId, aviso);
    avisos++;
  }
  return json({ ok: true, avisos });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200 });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[notify-host] faltan variables de entorno");
    return json({ error: "Servicio no configurado" }, 500);
  }

  // Sólo la clave de servicio. Cualquier otra cosa —sin bearer, la clave
  // anon, un JWT de usuario— se rechaza antes de leer el cuerpo.
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (bearer !== SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[notify-host] llamada rechazada: sin la clave de servicio");
    return json({ error: "No autorizado" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  try {
    const body = await req.json().catch(() => ({}));

    if (body?.modo === "prueba") {
      const { asunto, html } = emailInscripcion(DATOS_DE_PRUEBA);
      const r = await mandarEmail(DESTINO_PRUEBA, `[PRUEBA] ${asunto}`, html);
      return json({ ok: r.ok, status: r.status ?? null }, r.ok ? 200 : 502);
    }

    const reg = String(body?.registration_id ?? "");
    if (ES_UUID.test(reg)) return await inscripcion(supabase, reg);

    const grupo = String(body?.grupo_aprobado_id ?? "");
    if (ES_UUID.test(grupo)) return await grupoAprobado(supabase, grupo);

    return json({ error: "Falta registration_id o grupo_aprobado_id" }, 400);
  } catch (err) {
    console.error("[notify-host] error interno:", String(err).slice(0, 200));
    return json({ error: "Error interno" }, 500);
  }
});
