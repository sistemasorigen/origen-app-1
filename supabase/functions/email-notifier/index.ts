// Supabase Edge Function: email-notifier
//
// La central de emails de Origen. Cinco avisos, uno por evento:
//   · { evento: 'grupo_nuevo',     id: <groups.id> }               → a los admins
//   · { evento: 'postulacion',     id: <leader_applications.id> }  → a los admins
//   · { evento: 'grupo_aprobado',  id: <groups.id> }               → al anfitrión
//   · { evento: 'nuevo_anfitrion', id: <users.id> }                → a esa persona
//   · { evento: 'ingresante',      id: <welcome_visitors.id> }     → a bienvenida@
//   · { modo: 'prueba', evento }  → un email de muestra con datos inventados,
//                                   SÓLO a sistemas@origeniglesia.org (fijo acá).
//
// La disparan los triggers de sql/email_notifier_seguro.sql con la clave de
// servicio, que es lo ÚNICO que acepta. El pedido trae sólo el evento y el id:
// los nombres, los teléfonos y las direcciones se leen acá, de la base.
//
// Hasta el 2026-10-28 esta función no pedía ninguna clave (verify_jwt false y
// ningún chequeo) y recibía la fila entera en el cuerpo. Con un pedido armado
// a mano —{"table":"users","type":"UPDATE","record":{"email":"…"}}— cualquiera,
// sin sesión, hacía salir "🎉 ¡Bienvenido como Anfitrión de Origen!" desde el
// dominio de Origen a la dirección que quisiera, con el nombre que quisiera y
// sin escapar: un phishing con la marca de la iglesia, gastando la cuota
// compartida de Resend. Esa versión quedó versionada en el commit "chore:
// versiona 7 edge functions tal como están en producción".
//
// verify_jwt sigue en false a propósito: el control es el bearer contra la
// clave de servicio, como en send-nocturna-entrada y notify-host (la clave
// anon también es un JWT válido, así que verify_jwt no alcanzaría).
//
//   · Idempotente: tabla email_notifier_hechos, una clave por evento, fila y
//     destinatario. Sin direcciones adentro: para los admins va su posición en
//     la lista; para una persona, su id.
//   · Tope de 40 emails por día (hora argentina). Ver TOPE_EMAILS_DIA.
//   · Nada de datos personales en los logs.
//
// Desplegar con: npx supabase functions deploy email-notifier
//   --project-ref oqtumgalnozppqnnjjdb --use-api --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { templates } from './emailTemplates.ts';
import {
  ASUNTO_GRUPO_APROBADO, ASUNTO_GRUPO_NUEVO, ASUNTO_NUEVO_ANFITRION, ASUNTO_POSTULACION,
  asuntoIngresante, clave, DATOS_DE_PRUEBA, DESTINO_BIENVENIDA, DESTINO_PRUEBA, esEvento,
  inicioDelDiaArgentino, listaDeAdmins, nombreCompleto, oNoProporcionado, TOPE_EMAILS_DIA,
  type Evento,
} from './armado.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('ORIGEN_SERVICE_ROLE_KEY');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const ADMINS = listaDeAdmins(Deno.env.get('ADMIN_NOTIFICATION_EMAILS'));
const FROM_EMAIL = 'Origen <team@app.origeniglesia.org>';

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// groups.id es una columna text (no uuid). Hoy las 117 filas tienen formato
// uuid, pero no hay nada que lo obligue: se acepta cualquier id corto y sin
// rarezas, así que un grupo con otro formato no se queda sin aviso.
const ES_ID_TEXTO = /^[A-Za-z0-9._:-]{1,64}$/;

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

// deno-lint-ignore no-explicit-any
type Cliente = any;

/** Un email a punto de salir, con la clave que lo marca como hecho. */
interface Destino {
  clave: string;
  email: string;
}
interface Plan {
  asunto: string;
  html: string;
  destinos: Destino[];
}

/** Anota una clave; devuelve false si ya estaba (eso ya se hizo antes). */
async function tomar(supabase: Cliente, c: string): Promise<boolean> {
  const { error } = await supabase.from('email_notifier_hechos').insert({ clave: c });
  if (!error) return true;
  if (error.code === '23505') return false;
  throw new Error(`email_notifier_hechos: ${error.code}`);
}

async function soltar(supabase: Cliente, c: string): Promise<void> {
  await supabase.from('email_notifier_hechos').delete().eq('clave', c);
}

async function mandarEmail(to: string, asunto: string, html: string): Promise<{ ok: boolean; status?: number }> {
  if (!RESEND_API_KEY) return { ok: false };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject: asunto, html }),
  });
  return { ok: r.ok, status: r.status };
}

/** Cuántos emails ya salieron hoy (hora argentina). */
async function emailsDeHoy(supabase: Cliente): Promise<number> {
  const { count } = await supabase
    .from('email_notifier_hechos')
    .select('clave', { count: 'exact', head: true })
    .gte('created_at', inicioDelDiaArgentino());
  return count ?? 0;
}

/** Manda el plan: idempotente, con el tope del día y sin repetir. */
async function enviar(supabase: Cliente, plan: Plan) {
  let emails = 0, repetidos = 0, omitidos = 0, fallados = 0;

  for (const d of plan.destinos) {
    if (await emailsDeHoy(supabase) >= TOPE_EMAILS_DIA) { omitidos++; continue; }
    if (!(await tomar(supabase, d.clave))) { repetidos++; continue; }

    const r = await mandarEmail(d.email, plan.asunto, plan.html);
    if (r.ok) emails++;
    else {
      // No salió: se suelta la clave, así no cuenta para el tope y un
      // reintento lo vuelve a mandar.
      console.error('[email-notifier] Resend falló:', r.status ?? 'sin clave de Resend');
      await soltar(supabase, d.clave);
      fallados++;
    }
  }
  return json({ ok: true, emails, repetidos, omitidos_por_tope: omitidos, fallados });
}

const aLosAdmins = (evento: Evento, id: string): Destino[] =>
  ADMINS.map((email, i) => ({ clave: clave(evento, id, `admin#${i}`), email }));

// ── Un armador por evento ───────────────────────────────────────────────────

async function grupoNuevo(supabase: Cliente, id: string) {
  const { data: g } = await supabase
    .from('groups').select('id, name, leader_name, leader_surname, leader_phone')
    .eq('id', id).maybeSingle();
  if (!g) return json({ error: 'Grupo no encontrado' }, 404);
  if (ADMINS.length === 0) return json({ ok: true, omitido: 'sin_admins' });

  return await enviar(supabase, {
    asunto: ASUNTO_GRUPO_NUEVO,
    html: templates.groupCreated(
      g.name || 'Sin Nombre',
      nombreCompleto(g.leader_name, g.leader_surname),
      g.leader_phone || '',
    ),
    destinos: aLosAdmins('grupo_nuevo', id),
  });
}

async function postulacion(supabase: Cliente, id: string) {
  const { data: p } = await supabase
    .from('leader_applications').select('id, first_name, last_name, phone, email')
    .eq('id', id).maybeSingle();
  if (!p) return json({ error: 'Postulación no encontrada' }, 404);
  if (ADMINS.length === 0) return json({ ok: true, omitido: 'sin_admins' });

  return await enviar(supabase, {
    asunto: ASUNTO_POSTULACION,
    html: templates.hostApplicantCreated(
      nombreCompleto(p.first_name, p.last_name),
      p.phone || '',
      p.email || '',
    ),
    destinos: aLosAdmins('postulacion', id),
  });
}

async function grupoAprobado(supabase: Cliente, id: string) {
  const { data: g } = await supabase
    .from('groups').select('id, name, leader_name, leader_surname, host_id, status')
    .eq('id', id).maybeSingle();
  if (!g) return json({ error: 'Grupo no encontrado' }, 404);
  // El trigger sólo llama en el paso a 'approved'; si para cuando llega el
  // pedido ya no está aprobado, no se avisa nada.
  if (g.status !== 'approved' || !g.host_id) return json({ ok: true, omitido: 'no_aprobado' });

  const { data: u } = await supabase.from('users').select('email').eq('id', g.host_id).maybeSingle();
  if (!u?.email) return json({ ok: true, omitido: 'sin_email' });

  return await enviar(supabase, {
    asunto: ASUNTO_GRUPO_APROBADO,
    html: templates.groupApproved(g.name || '', nombreCompleto(g.leader_name, g.leader_surname)),
    destinos: [{ clave: clave('grupo_aprobado', id, g.host_id), email: u.email }],
  });
}

async function nuevoAnfitrion(supabase: Cliente, id: string) {
  const { data: u } = await supabase
    .from('users').select('id, name, email, roles').eq('id', id).maybeSingle();
  if (!u) return json({ error: 'Usuario no encontrado' }, 404);
  // Mismo recaudo que arriba: si el rol se fue entre el trigger y esto, no se
  // le da la bienvenida.
  if (!Array.isArray(u.roles) || !u.roles.includes('ANFITRION')) {
    return json({ ok: true, omitido: 'sin_rol' });
  }
  if (!u.email) return json({ ok: true, omitido: 'sin_email' });

  return await enviar(supabase, {
    asunto: ASUNTO_NUEVO_ANFITRION,
    html: templates.hostApproved(u.name || 'Usuario'),
    destinos: [{ clave: clave('nuevo_anfitrion', id, 'propio'), email: u.email }],
  });
}

async function ingresante(supabase: Cliente, id: string) {
  const { data: v } = await supabase
    .from('welcome_visitors').select('id, first_name, last_name, phone, age, created_at')
    .eq('id', id).maybeSingle();
  if (!v) return json({ error: 'Ingresante no encontrado' }, 404);

  return await enviar(supabase, {
    asunto: asuntoIngresante(v.first_name || '', v.last_name || ''),
    html: templates.newWelcomeVisitor(
      v.first_name || '',
      v.last_name || '',
      oNoProporcionado(v.phone),
      v.age === null || v.age === undefined ? 'No proporcionado' : String(v.age),
      v.created_at || new Date().toISOString(),
    ),
    destinos: [{ clave: clave('ingresante', id, 'bienvenida'), email: DESTINO_BIENVENIDA }],
  });
}

/** El email de muestra de cada evento, con datos inventados. */
function muestra(evento: Evento): { asunto: string; html: string } {
  const d = DATOS_DE_PRUEBA;
  const nombre = nombreCompleto(d.persona.nombre, d.persona.apellido);
  switch (evento) {
    case 'grupo_nuevo':
      return { asunto: ASUNTO_GRUPO_NUEVO, html: templates.groupCreated(d.grupo, nombre, d.telefono) };
    case 'postulacion':
      return { asunto: ASUNTO_POSTULACION, html: templates.hostApplicantCreated(nombre, d.telefono, d.email) };
    case 'grupo_aprobado':
      return { asunto: ASUNTO_GRUPO_APROBADO, html: templates.groupApproved(d.grupo, nombre) };
    case 'nuevo_anfitrion':
      return { asunto: ASUNTO_NUEVO_ANFITRION, html: templates.hostApproved(nombre) };
    case 'ingresante':
      return {
        asunto: asuntoIngresante(d.persona.nombre, d.persona.apellido),
        html: templates.newWelcomeVisitor(d.persona.nombre, d.persona.apellido, d.telefono, d.edad, d.creado),
      };
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200 });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[email-notifier] faltan variables de entorno');
    return json({ error: 'Servicio no configurado' }, 500);
  }

  // Sólo la clave de servicio. Cualquier otra cosa —sin bearer, la clave
  // anon, un JWT de usuario— se rechaza antes de leer el cuerpo.
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (bearer !== SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[email-notifier] llamada rechazada: sin la clave de servicio');
    return json({ error: 'No autorizado' }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  try {
    const body = await req.json().catch(() => ({}));
    const evento = body?.evento;
    if (!esEvento(evento)) return json({ error: 'Evento desconocido' }, 400);

    if (body?.modo === 'prueba') {
      const { asunto, html } = muestra(evento);
      const r = await mandarEmail(DESTINO_PRUEBA, `[PRUEBA] ${asunto}`, html);
      return json({ ok: r.ok, status: r.status ?? null }, r.ok ? 200 : 502);
    }

    const id = String(body?.id ?? '');
    const valido = evento === 'grupo_nuevo' || evento === 'grupo_aprobado'
      ? ES_ID_TEXTO.test(id)
      : ES_UUID.test(id);
    if (!valido) return json({ error: 'Falta el id' }, 400);

    switch (evento) {
      case 'grupo_nuevo': return await grupoNuevo(supabase, id);
      case 'postulacion': return await postulacion(supabase, id);
      case 'grupo_aprobado': return await grupoAprobado(supabase, id);
      case 'nuevo_anfitrion': return await nuevoAnfitrion(supabase, id);
      case 'ingresante': return await ingresante(supabase, id);
    }
  } catch (err) {
    console.error('[email-notifier] error interno:', String(err).slice(0, 200));
    return json({ error: 'Error interno' }, 500);
  }
});
