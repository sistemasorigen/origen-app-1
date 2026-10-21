// Supabase Edge Function: send-nocturna-datos-faltantes
//
// Le manda a cada adulto responsable que no cargó su teléfono el email que le
// pide completarlo, con un link a /nocturna-entrada y su código ya escrito.
//
// No la dispara ningún trigger: la corre una persona, a mano, con la clave de
// servicio. Por eso el modo viene en el body y por eso hay un modo 'contar'
// que no manda nada.
//
// TRES COSAS QUE ESTÁN ACÁ A PROPÓSITO
//
//   · Los destinatarios los elige la función, SIEMPRE, con la misma consulta
//     en los tres modos. No hay forma de pasarle una lista: un body con
//     direcciones convierte a esta función en un formulario de envío masivo
//     para cualquiera que consiga la clave.
//   · Tope de 20. Hoy son 9. Si la consulta devuelve más, algo cambió en los
//     datos (un backfill que se fue, una edición nueva a medio cargar) y es
//     mejor frenar que mandarle un pedido raro a cuarenta familias.
//   · La marca se escribe DESPUÉS de cada envío exitoso, no antes y no al
//     final. Si la función se cae a la mitad, las que ya salieron quedan
//     marcadas y la próxima corrida sigue por donde iba.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { armarHtml, errorLegible, linkDe, type Destinataria } from "./armado.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("ORIGEN_SERVICE_ROLE_KEY");
/** La casilla a la que va el modo 'prueba'. Nunca una dirección del body. */
const EMAIL_DE_PRUEBA = Deno.env.get("NOCTURNA_EMAIL_PRUEBA");

const FROM_EMAIL = "'Origen' <team@app.origeniglesia.org>";
const ASUNTO = "Te falta un dato para tu entrada a Nocturna";

/** Más que esto y no se manda nada: algo cambió en los datos. */
const TOPE = 20;
/** Entre envío y envío, para no chocar con el límite por segundo de Resend. */
const PAUSA_MS = 600;

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    // Nadie la llama desde un navegador: no se abre CORS.
    return new Response("ok", { status: 200 });
  }

  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[datos-faltantes] faltan variables de entorno");
    return json({ error: "Servicio no configurado" }, 500);
  }

  // ── Puerta de entrada ───────────────────────────────────────────────────
  // Sólo la clave de servicio. La clave anon también es un JWT válido y viaja
  // en el bundle del frontend, así que `verify_jwt` de la plataforma no
  // alcanza: sin esta comparación, cualquiera podría dispararle emails a las
  // familias y quemar la cuota del día.
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (bearer !== SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[datos-faltantes] llamada rechazada: sin la clave de servicio");
    return json({ error: "No autorizado" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const modo = String(body?.modo ?? "");

    if (modo !== "contar" && modo !== "prueba" && modo !== "enviar") {
      return json({ error: "modo tiene que ser 'contar', 'prueba' o 'enviar'" }, 400);
    }

    // ── Quiénes ─────────────────────────────────────────────────────────────
    // La misma consulta para los tres modos. La edición sale de la config, no
    // del body.
    const { data: config, error: errorConfig } = await supabase
      .from("nocturna_config")
      .select("edicion")
      .eq("id", 1)
      .single();

    if (errorConfig || !config) {
      console.error("[datos-faltantes] no se pudo leer la edición", errorConfig);
      return json({ error: "No se pudo leer la edición actual" }, 500);
    }

    const { data: filas, error: errorFilas } = await supabase
      .from("nocturna_inscripciones")
      .select("id, codigo_entrada, adulto_nombre, adulto_email")
      .eq("edicion", config.edicion)
      .is("datos_faltantes_email_at", null)
      .or("adulto_telefono.is.null,adulto_telefono.eq.")
      .order("created_at", { ascending: true });

    if (errorFilas) {
      console.error("[datos-faltantes] no se pudo leer la lista", errorFilas);
      return json({ error: "No se pudo leer la lista" }, 500);
    }

    // Sin email no hay a dónde mandarlo. No debería pasar (la columna es NOT
    // NULL) pero una fila sin dirección no puede frenar a las demás.
    const destinatarias = ((filas ?? []) as Destinataria[]).filter(
      (d) => typeof d.adulto_email === "string" && d.adulto_email.includes("@"),
    );

    const cuantas = destinatarias.length;

    // ── contar ──────────────────────────────────────────────────────────────
    if (modo === "contar") {
      return json({ ok: true, edicion: config.edicion, familias: cuantas, tope: TOPE });
    }

    // ── prueba ──────────────────────────────────────────────────────────────
    // Datos de ejemplo y una sola dirección, la del secreto. Nada de la base
    // real entra en este email.
    if (modo === "prueba") {
      if (!EMAIL_DE_PRUEBA) {
        return json({ error: "Falta el secreto NOCTURNA_EMAIL_PRUEBA" }, 500);
      }

      const ejemplo: Destinataria = {
        id: "ejemplo",
        codigo_entrada: "K7M4QX",
        adulto_nombre: "María",
        adulto_email: EMAIL_DE_PRUEBA,
      };

      const respuesta = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [EMAIL_DE_PRUEBA],
          subject: ASUNTO,
          html: armarHtml(ejemplo),
        }),
      });

      const cuerpo = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) {
        const motivo = errorLegible(respuesta.status, cuerpo);
        console.error("[datos-faltantes] la prueba falló:", respuesta.status);
        return json({ error: motivo }, 502);
      }

      return json({
        ok: true,
        modo: "prueba",
        emailId: cuerpo?.id,
        link: linkDe(ejemplo.codigo_entrada),
        // Para que quien la corre sepa cuántas saldrían de verdad.
        familias: cuantas,
      });
    }

    // ── enviar ──────────────────────────────────────────────────────────────
    if (cuantas === 0) {
      return json({ ok: true, modo: "enviar", enviados: 0, fallidos: 0, familias: 0 });
    }

    if (cuantas > TOPE) {
      console.warn(`[datos-faltantes] frenado: ${cuantas} supera el tope de ${TOPE}`);
      return json(
        {
          error: `La lista dio ${cuantas} familias y el tope es ${TOPE}. No se mandó nada: revisá los datos antes de seguir.`,
          familias: cuantas,
        },
        409,
      );
    }

    let enviados = 0;
    const fallidos: Array<{ id: string; motivo: string }> = [];

    for (const d of destinatarias) {
      try {
        const respuesta = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [d.adulto_email],
            subject: ASUNTO,
            html: armarHtml(d),
          }),
        });

        const cuerpo = await respuesta.json().catch(() => ({}));

        if (!respuesta.ok) {
          // Que uno falle no frena a los demás: el motivo se junta y la
          // marca no se escribe, así que la próxima corrida lo reintenta.
          const motivo = errorLegible(respuesta.status, cuerpo);
          console.error(`[datos-faltantes] falló ${d.id}: ${respuesta.status}`);
          fallidos.push({ id: d.id, motivo });
        } else {
          // La marca, recién ahora. Si la función se cae en la próxima
          // vuelta, ésta ya no se repite.
          const { error: errorMarca } = await supabase
            .from("nocturna_inscripciones")
            .update({ datos_faltantes_email_at: new Date().toISOString() })
            .eq("id", d.id);

          if (errorMarca) {
            // El email salió igual. Se avisa para que no se reintente a ciegas.
            console.error(`[datos-faltantes] el email de ${d.id} salió pero no se pudo marcar`);
            fallidos.push({ id: d.id, motivo: "El email salió pero no se pudo marcar como enviado." });
          } else {
            enviados++;
          }
        }
      } catch (err) {
        console.error(`[datos-faltantes] error con ${d.id}:`, String(err));
        fallidos.push({ id: d.id, motivo: String(err) });
      }

      await dormir(PAUSA_MS);
    }

    return json({
      ok: true,
      modo: "enviar",
      familias: cuantas,
      enviados,
      fallidos: fallidos.length,
      detalle: fallidos,
    });
  } catch (err) {
    console.error("[datos-faltantes] error interno:", String(err));
    return json({ error: "Error interno", details: String(err) }, 500);
  }
});
