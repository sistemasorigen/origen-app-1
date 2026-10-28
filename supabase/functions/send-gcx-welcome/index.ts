// Supabase Edge Function: send-gcx-welcome
//
// Manda el email de bienvenida a un Grupo de Conexión:
//   · { inscripcion_id }       → lo manda trigger_gcx_welcome cuando una
//                                 inscripción pasa a APPROVED.
//   · { inscripciones: [ids] } → el reenvío a mano. Ya NO lo llama el
//                                 frontend: llega por la RPC
//                                 gcx_reenviar_bienvenida, que valida el rol
//                                 o la relación con el grupo.
//   · { modo: 'prueba' }       → un email de muestra con datos inventados,
//                                 SÓLO a sistemas@ (fijo acá).
//
// Acepta ÚNICAMENTE la clave de servicio. Hasta el 2026-10-28 no pedía
// ninguna (verify_jwt false y ningún chequeo) aunque el trigger sí la
// mandaba: cualquiera, sin sesión, podía pasarle una lista de ids y mandar en
// masa la bienvenida a los inscriptos aprobados, gastando la cuota de Resend
// (100 por día). El frontend la llamaba directo con la clave anon, que viaja
// en el bundle, así que no había forma de distinguir un anfitrión de un
// tercero.
//
// verify_jwt sigue en false a propósito: el control es el bearer contra la
// clave de servicio (la clave anon también es un JWT válido).
//
//   · Idempotente: tabla gcx_welcome_hechos. La aprobación, una vez por
//     inscripción; el reenvío a mano, una vez por inscripción y por día.
//   · Tope de 80 emails por día (hora argentina). Ver TOPE_EMAILS_DIA.
//
// Desplegar con: npx supabase functions deploy send-gcx-welcome
//   --project-ref oqtumgalnozppqnnjjdb --use-api --no-verify-jwt

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

import {
  asunto, claveAuto, claveReenvio, DATOS_DE_PRUEBA, DESTINO_PRUEBA, diaArgentino, escaparHtml,
  inicioDelDiaArgentino, nombreCompleto, TOPE_EMAILS_DIA, TOPE_POR_REENVIO,
} from "./armado.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("ORIGEN_SERVICE_ROLE_KEY");

// group_registrations.id es una columna text: se acepta cualquier id corto y
// sin rarezas, no solo los que tienen formato uuid.
const ES_ID = /^[A-Za-z0-9._:-]{1,64}$/;

const FROM_EMAIL = "'Origen' <team@app.origeniglesia.org>";

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
function buildEmailHtml(userNameCrudo: string, grupoCrudo: GroupDetails): string {
  // Todo lo que escribió una persona, escapado antes de entrar al HTML: el
  // nombre de quien se inscribió y los datos del grupo, que los escribe el
  // anfitrión. start_date no se escapa porque no se imprime: se parsea como
  // fecha, y una fecha inválida sale como "Invalid Date".
  const userName = escaparHtml(userNameCrudo);
  const group = {
    id: grupoCrudo.id,
    name: escaparHtml(grupoCrudo.name),
    meeting_day: escaparHtml(grupoCrudo.meeting_day),
    meeting_time: escaparHtml(grupoCrudo.meeting_time),
    location: escaparHtml(grupoCrudo.location),
    description: escaparHtml(grupoCrudo.description),
    leader_name: escaparHtml(grupoCrudo.leader_name),
    leader_surname: escaparHtml(grupoCrudo.leader_surname),
    start_date: grupoCrudo.start_date,
  };
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
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });

// deno-lint-ignore no-explicit-any
type Cliente = any;

/** Anota una clave; devuelve false si ya estaba (eso ya se mandó). */
async function tomar(supabase: Cliente, clave: string): Promise<boolean> {
  const { error } = await supabase.from("gcx_welcome_hechos").insert({ clave });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(`gcx_welcome_hechos: ${error.code}`);
}

async function soltar(supabase: Cliente, clave: string): Promise<void> {
  await supabase.from("gcx_welcome_hechos").delete().eq("clave", clave);
}

/** Cuántos emails ya salieron hoy (hora argentina). */
async function emailsDeHoy(supabase: Cliente): Promise<number> {
  const { count } = await supabase
    .from("gcx_welcome_hechos")
    .select("clave", { count: "exact", head: true })
    .gte("created_at", inicioDelDiaArgentino());
  return count ?? 0;
}

async function mandarEmail(to: string, asuntoDelMail: string, html: string): Promise<{ ok: boolean; status?: number }> {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject: asuntoDelMail, html }),
  });
  return { ok: r.ok, status: r.status };
}

type Resultado =
  | "enviado" | "repetido" | "tope" | "sin_email"
  | "no_aprobada" | "no_existe" | "sin_grupo" | "fallo";

/**
 * Manda la bienvenida de UNA inscripción. Todo se lee de la base por id: el
 * pedido no trae ni el nombre, ni la dirección, ni los datos del grupo.
 */
async function unaBienvenida(supabase: Cliente, id: string, reenvio: boolean): Promise<Resultado> {
  const { data: r } = await supabase
    .from("group_registrations")
    .select("id, group_id, first_name, last_name, email, status")
    .eq("id", id).maybeSingle();
  if (!r) return "no_existe";
  // La misma condición que miraba antes: sólo las aprobadas.
  if (r.status !== "APPROVED") return "no_aprobada";
  if (!r.email) return "sin_email";

  const { data: g } = await supabase
    .from("groups")
    .select("id, name, meeting_day, meeting_time, location, description, leader_name, leader_surname, start_date")
    .eq("id", r.group_id).maybeSingle();
  if (!g) return "sin_grupo";

  if (await emailsDeHoy(supabase) >= TOPE_EMAILS_DIA) return "tope";

  const clave = reenvio ? claveReenvio(id, diaArgentino()) : claveAuto(id);
  if (!(await tomar(supabase, clave))) return "repetido";

  const userName = nombreCompleto(r.first_name, r.last_name) || "Amigo/a";
  const resp = await mandarEmail(r.email, asunto(g.name), buildEmailHtml(userName, g as GroupDetails));
  if (resp.ok) return "enviado";

  // No salió: se suelta la clave, así un reintento vuelve a mandarlo.
  console.error("[gcx-welcome] Resend falló:", resp.status);
  await soltar(supabase, clave);
  return "fallo";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200 });

  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[gcx-welcome] faltan variables de entorno");
    return json({ error: "Servicio no configurado" }, 500);
  }

  // Sólo la clave de servicio. Cualquier otra cosa —sin bearer, la clave
  // anon, un JWT de usuario— se rechaza antes de leer el cuerpo.
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (bearer !== SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[gcx-welcome] llamada rechazada: sin la clave de servicio");
    return json({ error: "No autorizado" }, 401);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));

    if (body?.modo === "prueba") {
      const d = DATOS_DE_PRUEBA;
      const html = buildEmailHtml(nombreCompleto(d.nombre, d.apellido), d.grupo as GroupDetails);
      const resp = await mandarEmail(DESTINO_PRUEBA, `[PRUEBA] ${asunto(d.grupo.name)}`, html);
      return json({ ok: resp.ok, status: resp.status ?? null }, resp.ok ? 200 : 502);
    }

    // Una sola: la aprobación, que la manda el trigger.
    const una = String(body?.inscripcion_id ?? "");
    if (una !== "") {
      if (!ES_ID.test(una)) return json({ error: "Falta inscripcion_id" }, 400);
      const resultado = await unaBienvenida(supabase, una, false);
      if (resultado === "no_existe") return json({ error: "Inscripción no encontrada" }, 404);
      return json({ ok: true, resultado });
    }

    // Varias: el reenvío a mano, que ahora llega por la RPC
    // gcx_reenviar_bienvenida (el frontend ya no llama acá).
    const varias = Array.isArray(body?.inscripciones) ? body.inscripciones.map(String) : null;
    if (varias) {
      if (varias.length === 0 || varias.length > TOPE_POR_REENVIO) {
        return json({ error: "Cantidad de inscripciones fuera de rango" }, 400);
      }
      if (!varias.every((x: string) => ES_ID.test(x))) return json({ error: "Hay un id inválido" }, 400);

      const cuenta: Record<string, number> = {};
      for (const id of varias) {
        const res = await unaBienvenida(supabase, id, true);
        cuenta[res] = (cuenta[res] ?? 0) + 1;
      }
      // Sin direcciones ni nombres en la respuesta: pg_net guarda el cuerpo.
      return json({ ok: true, enviados: cuenta.enviado ?? 0, detalle: cuenta });
    }

    return json({ error: "Falta inscripcion_id o inscripciones" }, 400);
  } catch (error) {
    console.error("[gcx-welcome] error interno:", String(error).slice(0, 200));
    return json({ error: "Error interno" }, 500);
  }
});
