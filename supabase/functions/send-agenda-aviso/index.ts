// Supabase Edge Function: send-agenda-aviso
//
// Los emails de Agenda Origen: "Tarea asignada" (al equipo del
// sub-departamento) y "Tarea completada" (a los encargados).
// Diseños: design-claude/Email - Tarea asignada.dc.html y
// design-claude/Email - Tarea completada.dc.html (HTML en armado.ts).
//
// La dispara el trigger trg_agenda_tareas_avisar (sql/agenda_avisos.sql) con
// la clave de servicio, que es lo único que acepta. El pedido trae SÓLO
// {tarea_id, tipo}: a quién mandarle sale de agenda_avisos (los que quedaron
// 'pendiente') y todo lo demás se lee acá, de la base.
//
//   · Fecha: antes de agenda_emails_desde() (lunes 2/11/2026, 00:00 hora
//     argentina) no sale nada: lo pendiente pasa a 'pausado' (el trigger ya
//     lo hace; esto es el doble chequeo).
//   · Tope: 40 emails de la Agenda por día (hora argentina). Resend da 100
//     por día para toda la app. Pasado el tope, ese aviso queda en
//     'tope_diario' y la notificación en la app igual llegó.
//   · Idempotente: cada aviso se "toma" pasándolo de 'pendiente' a
//     'enviado' antes de mandarlo; un segundo llamado con lo mismo no
//     encuentra nada pendiente y no manda nada.
//   · Un email por persona (va saludada por su nombre). Si Resend falla, ese
//     aviso queda en 'error' con el motivo legible.
//
// Modo prueba: {modo: 'prueba', tipo} manda el email con datos inventados a
// Sistemas (fijo acá). También respeta el tope.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
  armarAsignada, armarCompletada, ejemploAsignada, ejemploCompletada, errorLegible,
  inicioDelDiaArgentino, type Email, type TareaParaEmail,
} from "./armado.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("ORIGEN_SERVICE_ROLE_KEY");

const FROM_EMAIL = "'Origen' <team@app.origeniglesia.org>";
// Fijo en el servidor: el modo prueba no puede elegir a quién se manda.
const DESTINO_PRUEBA = "sistemas@origeniglesia.org";
const TOPE_DIARIO = 40;
/** Resend acepta 2 pedidos por segundo: entre email y email, una pausa. */
const PAUSA_MS = 600;

type Tipo = "asignada" | "completada";
const esTipo = (t: unknown): t is Tipo => t === "asignada" || t === "completada";

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Cuántos emails de la Agenda salieron hoy (hora argentina). */
async function enviadosHoy(sb: SupabaseClient): Promise<number> {
  const { count, error } = await sb
    .from("agenda_avisos")
    .select("id", { count: "exact", head: true })
    .eq("canal", "email")
    .eq("estado", "enviado")
    .gte("enviado_at", inicioDelDiaArgentino());
  if (error) throw new Error(`no se pudo contar el tope: ${error.message}`);
  return count ?? 0;
}

// Sin strictNullChecks, `!r.ok` no angosta la unión: motivo va opcional en un solo tipo.
async function mandar(para: string, email: Email): Promise<{ ok: boolean; motivo?: string }> {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM_EMAIL, to: [para], subject: email.asunto, html: email.html, text: email.texto }),
  });
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, motivo: errorLegible(r.status, cuerpo) };
  return { ok: true };
}

const nombreDe = async (sb: SupabaseClient, id: string | null): Promise<string | null> => {
  if (!id) return null;
  const { data } = await sb.from("users").select("name").eq("id", id).maybeSingle();
  return (data?.name ?? "").trim() || null;
};

/** La tarea con todo lo que muestran los emails, leída con la clave de servicio. */
async function leerTarea(sb: SupabaseClient, id: string) {
  const { data: t } = await sb
    .from("agenda_tareas")
    .select("id, nombre, detalles, fecha, todo_el_dia, hora_desde, hora_hasta, created_at, created_by, completada_at, completada_por, departamento_id, subdepartamento_id, carpeta_id, prioridad_id, solicitud_id")
    .eq("id", id)
    .maybeSingle();
  if (!t) return null;

  const [dep, sub, prio, carpeta] = await Promise.all([
    sb.from("agenda_departamentos").select("nombre").eq("id", t.departamento_id).maybeSingle(),
    t.subdepartamento_id
      ? sb.from("agenda_subdepartamentos").select("nombre, color, lider_id").eq("id", t.subdepartamento_id).maybeSingle()
      : Promise.resolve({ data: null }),
    t.prioridad_id
      ? sb.from("agenda_prioridades").select("nombre, color").eq("id", t.prioridad_id).maybeSingle()
      : Promise.resolve({ data: null }),
    t.carpeta_id
      ? sb.from("agenda_carpetas").select("nombre").eq("id", t.carpeta_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const base: TareaParaEmail = {
    id: t.id,
    nombre: t.nombre,
    detalles: t.detalles,
    fecha: t.fecha,
    todoElDia: t.todo_el_dia,
    horaDesde: t.hora_desde,
    horaHasta: t.hora_hasta,
    departamento: dep.data?.nombre ?? "Tu departamento",
    sub: sub.data?.nombre ?? "Sin equipo",
    color: sub.data?.color ?? "#8a8a86",
    prioridad: prio.data ? { nombre: prio.data.nombre, color: prio.data.color } : null,
    carpeta: carpeta.data?.nombre ?? null,
    creador: await nombreDe(sb, t.created_by),
    creadaAt: t.created_at,
  };
  return { t, base, liderId: (sub.data?.lider_id as string | null) ?? null };
}

/** Quien dirige primero y después los miembros, para "La tenían". */
async function integrantes(sb: SupabaseClient, subId: string | null, liderId: string | null): Promise<string[]> {
  if (!subId) return [];
  const { data: miembros } = await sb
    .from("agenda_subdepartamento_miembros")
    .select("user_id, created_at")
    .eq("subdepartamento_id", subId)
    .order("created_at");
  const ids = [liderId, ...(miembros ?? []).map((m) => m.user_id as string)].filter((x, i, a): x is string => !!x && a.indexOf(x) === i);
  if (!ids.length) return [];
  const { data: gente } = await sb.from("users").select("id, name").in("id", ids);
  const nombre = (id: string) => (gente ?? []).find((g) => g.id === id)?.name?.trim() || "Sin nombre";
  return ids.map((id) => (id === liderId ? `${nombre(id)} (dirige)` : nombre(id)));
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200 });

  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[agenda-aviso] faltan variables de entorno");
    return json({ error: "Servicio no configurado" }, 500);
  }

  // Sólo la clave de servicio: la anon también es un JWT válido y viaja en el
  // bundle del frontend, así que verify_jwt no alcanza.
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (bearer !== SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[agenda-aviso] llamada rechazada: sin la clave de servicio");
    return json({ error: "No autorizado" }, 401);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const body = await req.json().catch(() => ({}));
  const tipo = body?.tipo;
  if (!esTipo(tipo)) return json({ error: "tipo inválido" }, 400);

  // ── Modo prueba: datos inventados, sólo a Sistemas ──────────────────────
  if (body?.modo === "prueba") {
    try {
      if ((await enviadosHoy(sb)) >= TOPE_DIARIO) return json({ ok: true, omitido: "tope_diario" });
      const email = tipo === "asignada" ? armarAsignada(ejemploAsignada()) : armarCompletada(ejemploCompletada());
      const r = await mandar(DESTINO_PRUEBA, email);
      return r.ok ? json({ ok: true, prueba: tipo }) : json({ error: r.motivo }, 502);
    } catch (err) {
      console.error("[agenda-aviso] prueba:", String(err).slice(0, 200));
      return json({ error: "Error interno" }, 500);
    }
  }

  const tareaId = String(body?.tarea_id ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tareaId)) {
    return json({ error: "tarea_id inválido" }, 400);
  }

  try {
    const { data: pendientes, error: errPend } = await sb
      .from("agenda_avisos")
      .select("id, user_id")
      .eq("tarea_id", tareaId)
      .eq("tipo", tipo)
      .eq("canal", "email")
      .eq("estado", "pendiente");
    if (errPend) throw new Error(errPend.message);
    if (!pendientes?.length) return json({ ok: true, enviados: 0, omitido: "sin_pendientes" });

    // Doble chequeo de la fecha, con la misma función que usa el trigger.
    const { data: desde, error: errDesde } = await sb.rpc("agenda_emails_desde");
    if (errDesde || !desde) throw new Error(`sin fecha de activación: ${errDesde?.message ?? "vacía"}`);
    if (Date.now() < new Date(desde as string).getTime()) {
      await sb.from("agenda_avisos").update({ estado: "pausado" })
        .in("id", pendientes.map((p) => p.id)).eq("estado", "pendiente");
      return json({ ok: true, enviados: 0, omitido: "pausado" });
    }

    const tarea = await leerTarea(sb, tareaId);
    if (!tarea) return json({ ok: true, enviados: 0, omitido: "sin_tarea" });   // la borraron: los avisos se fueron con ella

    const extra = tipo === "completada"
      ? {
        completoPor: await nombreDe(sb, tarea.t.completada_por),
        completadaAt: tarea.t.completada_at as string | null,
        integrantes: await integrantes(sb, tarea.t.subdepartamento_id, tarea.liderId),
        solicitud: await (async () => {
          if (!tarea.t.solicitud_id) return null;
          const { data: s } = await sb.from("agenda_solicitudes").select("solicitante_id, created_at")
            .eq("id", tarea.t.solicitud_id).maybeSingle();
          return s ? { solicitante: await nombreDe(sb, s.solicitante_id), creadaAt: s.created_at as string } : null;
        })(),
      }
      : null;

    const { data: gente } = await sb.from("users").select("id, name, email").in("id", pendientes.map((p) => p.user_id));

    let enviados = 0;
    const errores: string[] = [];
    for (const aviso of pendientes) {
      const persona = (gente ?? []).find((g) => g.id === aviso.user_id);
      const para = (persona?.email ?? "").trim();
      if (!para) {
        await sb.from("agenda_avisos").update({ estado: "sin_email" }).eq("id", aviso.id).eq("estado", "pendiente");
        continue;
      }

      if ((await enviadosHoy(sb)) >= TOPE_DIARIO) {
        await sb.from("agenda_avisos")
          .update({ estado: "tope_diario", error: `Tope diario de ${TOPE_DIARIO} emails de la Agenda alcanzado: le llegó la notificación en la app.` })
          .eq("id", aviso.id).eq("estado", "pendiente");
        continue;
      }

      // Tomarlo: si otro llamado ya lo tomó, no se manda dos veces.
      const { data: tomado } = await sb.from("agenda_avisos")
        .update({ estado: "enviado", enviado_at: new Date().toISOString(), error: null })
        .eq("id", aviso.id).eq("estado", "pendiente")
        .select("id");
      if (!tomado?.length) continue;

      const email = tipo === "asignada"
        ? armarAsignada({ ...tarea.base, destinatario: persona?.name ?? null })
        : armarCompletada({ ...tarea.base, ...extra! });

      if (enviados + errores.length > 0) await dormir(PAUSA_MS);
      const r = await mandar(para, email);
      if (r.ok) {
        enviados += 1;
      } else {
        errores.push(r.motivo);
        await sb.from("agenda_avisos").update({ estado: "error", enviado_at: null, error: r.motivo }).eq("id", aviso.id);
      }
    }

    // El resumen en la tarea (las columnas del prompt 1).
    const cambios: Record<string, unknown> = {};
    if (enviados > 0) cambios[tipo === "asignada" ? "email_asignada_at" : "email_completada_at"] = new Date().toISOString();
    if (errores.length) cambios.email_error = `${errores.length} email(s) con error: ${errores[0]}`.slice(0, 300);
    else if (enviados > 0) cambios.email_error = null;
    if (Object.keys(cambios).length) await sb.from("agenda_tareas").update(cambios).eq("id", tareaId);

    return json({ ok: true, enviados, errores: errores.length });
  } catch (err) {
    // Sin nombres ni emails en el log: sólo qué falló.
    console.error("[agenda-aviso] error interno:", String(err).slice(0, 200));
    await sb.from("agenda_avisos")
      .update({ error: `Error al armar o mandar: ${String(err).slice(0, 200)}` })
      .eq("tarea_id", tareaId).eq("tipo", tipo).eq("canal", "email").eq("estado", "pendiente");
    return json({ error: "Error interno" }, 500);
  }
});
