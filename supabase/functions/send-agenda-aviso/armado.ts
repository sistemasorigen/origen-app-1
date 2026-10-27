// Arma los emails de Agenda Origen: "Tarea asignada" y "Tarea completada".
// Sin dependencias de Deno: se puede probar con Node.
//
// Es el HTML de design-claude/agenda-emails.js (lo que cargan
// "Email - Tarea asignada.dc.html" y "Email - Tarea completada.dc.html"),
// pasado a TypeScript con estos cambios:
//   · las filas sin dato no se muestran (sin prioridad, sin carpeta, sin
//     detalles, sin solicitud), en vez de las variables {{#carpeta}} del
//     diseño;
//   · los links llevan /#/ y abren la tarea: /#/agenda?tarea=<id>;
//   · la fuente es Manrope con las del sistema detrás;
//   · TODO lo que viene de la base pasa por escaparHtml, también los colores
//     (que se validan como #rrggbb);
//   · cada email lleva su texto plano de respaldo;
//   · arriba va el logo de Origen centrado y no la fila "Origen · Agenda
//     Origen" (pedido de Ignacio, como en el email de reportes).

export const LINK_TAREA = "https://app.origeniglesia.org/#/agenda?tarea=";

const F = "Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const ZONA = "America/Argentina/Buenos_Aires";

// ── Datos ─────────────────────────────────────────────────────────────────
export interface TareaParaEmail {
  id: string;
  nombre: string;
  detalles: string | null;
  /** 'YYYY-MM-DD'. */
  fecha: string;
  todoElDia: boolean;
  /** 'HH:MM' o 'HH:MM:SS'. */
  horaDesde: string | null;
  horaHasta: string | null;
  departamento: string;
  sub: string;
  color: string;
  prioridad: { nombre: string; color: string } | null;
  carpeta: string | null;
  creador: string | null;
  /** ISO. */
  creadaAt: string;
}

export interface DatosAsignada extends TareaParaEmail {
  /** A quién le llega (se saluda con el primer nombre). */
  destinatario: string | null;
}

export interface DatosCompletada extends TareaParaEmail {
  completoPor: string | null;
  completadaAt: string | null;
  /** "Valentina Ríos (dirige)", "Lucía Ferreyra"… */
  integrantes: string[];
  solicitud: { solicitante: string | null; creadaAt: string } | null;
}

export interface Email { asunto: string; html: string; texto: string }

// ── Helpers ───────────────────────────────────────────────────────────────
/** Todo lo que entra al HTML pasa por acá: nombres y detalles los escribe cualquiera. */
export function escaparHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Un color de la base sólo entra si es #rrggbb; si no, gris. */
export function colorSeguro(c: unknown, otro = "#8a8a86"): string {
  return typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c : otro;
}

/** Un renglón para el asunto: sin saltos de línea. */
const enUnaLinea = (s: string) => s.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
  "septiembre", "octubre", "noviembre", "diciembre"];

/** 'YYYY-MM-DD' → fecha sin hora (no pasa por ninguna zona horaria). */
function partes(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, dow };
}

/** '2026-10-26' → 'lun 26/10'. */
export function fechaCorta(iso: string): string {
  const p = partes(iso);
  return `${DIAS_CORTOS[p.dow]} ${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}`;
}

/** '2026-10-26' → 'Lunes 26 de octubre'. */
export function diaLargo(iso: string): string {
  const p = partes(iso);
  const t = `${DIAS[p.dow]} ${p.d} de ${MESES[p.m - 1]}`;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** '19:00 a 20:30' o 'Todo el día'. */
export function horario(t: Pick<TareaParaEmail, "todoElDia" | "horaDesde" | "horaHasta">): string {
  if (t.todoElDia || !t.horaDesde) return "Todo el día";
  const desde = t.horaDesde.slice(0, 5);
  return t.horaHasta ? `${desde} a ${t.horaHasta.slice(0, 5)}` : desde;
}

/** Un instante → '20/10/2026 a las 18:40', en hora argentina sin importar dónde corra. */
export function fechaYHora(iso: string): string {
  const p = new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA, day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${v("day")}/${v("month")}/${v("year")} a las ${v("hour")}:${v("minute")}`;
}

/** El inicio del día de hoy en Argentina, para el tope diario. */
export function inicioDelDiaArgentino(ahora = new Date()): string {
  const fecha = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(ahora);
  return new Date(`${fecha}T00:00:00-03:00`).toISOString();
}

export const primerNombre = (n: string | null) => (n ?? "").trim().split(/\s+/)[0] || "";

/** Detalles escapados, con los saltos de línea como <br>. */
const conSaltos = (s: string) => escaparHtml(s).replace(/\r?\n/g, "<br>");

// ── Las piezas del diseño (agenda-emails.js) ──────────────────────────────
/**
 * El logo de Origen centrado arriba, en lugar de la fila "Origen · Agenda
 * Origen" del diseño (pedido de Ignacio, igual que el email de reportes):
 * negro en claro y blanco en oscuro. Viven en el bucket público `images`.
 */
const LOGO = "https://oqtumgalnozppqnnjjdb.supabase.co/storage/v1/object/public/images/email/origen/origen-logo-";

const DARK = ".canvas,td.canvas{background-color:#141413 !important}td.card,.card{background-color:#1c1c1a !important}td.soft,.soft{background-color:#262624 !important}.ink{color:#f4f3f0 !important}.muted{color:#b3b1ac !important}td.btn,.btn{background-color:#f4f3f0 !important}.btn a{color:#0a0a0a !important}.rule{border-top-color:#2f2f2c !important}td.ok,.ok{background-color:#163222 !important}.okink{color:#7ee2a8 !important}td.pill,.pill{background-color:#2a2a28 !important}";

function shell(asunto: string, pre: string, body: string, pie: string): string {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${escaparHtml(asunto)}</title>
<!--[if mso]><style>body,table,td,a,p{font-family:Arial,Helvetica,sans-serif !important}</style><![endif]-->
<style>
:root{color-scheme:light dark;supported-color-schemes:light dark}
@media (max-width:620px){.px{padding-left:20px !important;padding-right:20px !important}.h1{font-size:23px !important;line-height:29px !important}.lbl{width:96px !important}}
@media (prefers-color-scheme:dark){.logo-claro{display:none !important}.logo-oscuro{display:block !important;max-height:none !important;overflow:visible !important}${DARK}}
</style></head>
<body class="canvas" bgcolor="#f6f6f4" style="margin:0;padding:0;background-color:#f6f6f4;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%">
<span style="display:none !important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;max-height:0;overflow:hidden;mso-hide:all">${escaparHtml(pre)}</span>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="canvas" bgcolor="#f6f6f4" style="background-color:#f6f6f4;width:100%"><tr><td class="canvas" bgcolor="#f6f6f4" align="center" style="padding:24px 12px 40px;background-color:#f6f6f4">
<!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"><tr><td><![endif]-->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:600px">
<tr><td class="px" align="center" style="padding:6px 8px 20px"><img src="${LOGO}negro.png" width="116" height="36" alt="Origen" class="logo-claro" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;width:116px;height:36px"><!--[if !mso]><!--><div class="logo-oscuro" style="display:none;max-height:0;overflow:hidden;mso-hide:all"><img src="${LOGO}blanco.png" width="116" height="36" alt="Origen" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;width:116px;height:36px"></div><!--<![endif]--></td></tr>
<tr><td class="card" bgcolor="#ffffff" style="background-color:#ffffff;border-radius:26px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="card" bgcolor="#ffffff" style="background-color:#ffffff;border-radius:26px">
${body}
</table></td></tr>
<tr><td class="px muted" align="center" style="padding:20px 24px 0;font-family:${F};font-size:12.5px;line-height:19px;font-weight:500;color:#5f5d58">${pie}<br>Iglesia Origen · Buenos Aires</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>`;
}

const kicker = (txt: string, bg: string, ink: string, cls: string) =>
  `<tr><td class="px" style="padding:28px 32px 0"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td class="${cls}" bgcolor="${bg}" style="padding:6px 12px;background-color:${bg};border-radius:999px;font-family:${F};font-size:11px;line-height:14px;letter-spacing:0.08em;font-weight:700;color:${ink}">${txt}</td></tr></table></td></tr>`;

const h1 = (t: string) =>
  `<tr><td class="px h1 ink" style="padding:14px 32px 0;font-family:${F};font-size:26px;line-height:32px;mso-line-height-rule:exactly;font-weight:700;letter-spacing:-0.02em;color:#0a0a0a">${t}</td></tr>`;

const intro = (t: string) =>
  `<tr><td class="px muted" style="padding:8px 32px 0;font-family:${F};font-size:15px;line-height:23px;font-weight:500;color:#4a4844">${t}</td></tr>`;

const fila = (k: string, v: string, primera: boolean) =>
  `<tr><td class="lbl muted" width="120" valign="top" style="padding:${primera ? "0" : "12px"} 12px 0 0;width:120px;font-family:${F};font-size:11px;line-height:20px;letter-spacing:0.07em;font-weight:700;color:#5f5d58;text-transform:uppercase">${k}</td><td class="ink" valign="top" style="padding:${primera ? "0" : "12px"} 0 0;font-family:${F};font-size:15px;line-height:20px;font-weight:600;color:#0a0a0a;word-break:break-word">${v}</td></tr>`;

/** Varias filas: la primera sin el espacio de arriba. */
const filas = (pares: [string, string][]) => pares.map(([k, v], i) => fila(k, v, i === 0)).join("");

const punto = (c: string) =>
  `<span style="display:inline-block;width:9px;height:9px;border-radius:9px;background-color:${colorSeguro(c)};vertical-align:middle;margin-right:7px"></span>`;

const rotulo = (t: string) =>
  `<p class="muted" style="margin:0;font-family:${F};font-size:11px;line-height:14px;letter-spacing:0.08em;font-weight:700;color:#5f5d58">${t}</p>`;

const linea = () =>
  `<tr><td class="px" style="padding:22px 32px 0"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td class="rule" style="border-top:1px solid #ecebe8;font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>`;

const boton = (txt: string, href: string) => `<tr><td class="px" style="padding:26px 32px 32px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td class="btn" bgcolor="#0a0a0a" style="background-color:#0a0a0a;border-radius:999px">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${escaparHtml(href)}" style="height:52px;v-text-anchor:middle;width:230px" arcsize="50%" fillcolor="#0a0a0a" stroke="f"><center style="color:#ffffff;font-family:Arial;font-size:15px;font-weight:bold">${txt}</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a href="${escaparHtml(href)}" style="display:inline-block;padding:16px 30px;font-family:${F};font-size:15px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px">${txt} &rarr;</a><!--<![endif]-->
</td></tr></table></td></tr>`;

/** La tarjeta de la tarea: barra del color del sub y el contenido. */
const tarjeta = (color: string, adentro: string) => {
  const c = colorSeguro(color);
  return `<tr><td class="px" style="padding:22px 32px 0">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="soft" bgcolor="#f2f2f0" style="background-color:#f2f2f0;border-radius:20px"><tr>
<td width="6" bgcolor="${c}" style="width:6px;background-color:${c};border-radius:20px 0 0 20px;font-size:0;line-height:0">&nbsp;</td>
<td class="soft" bgcolor="#f2f2f0" style="padding:20px 20px 20px 18px;background-color:#f2f2f0;border-radius:0 20px 20px 0">${adentro}</td>
</tr></table></td></tr>`;
};

const nombreDeTarea = (n: string) =>
  `<p class="ink" style="margin:0 0 16px;font-family:${F};font-size:19px;line-height:25px;font-weight:700;color:#0a0a0a">${escaparHtml(n)}</p>`;

const equipo = (t: TareaParaEmail) => `${escaparHtml(t.departamento)} &rsaquo; ${punto(t.color)}${escaparHtml(t.sub)}`;

/** Prioridad y carpeta, sólo si hay. */
function opcionales(t: TareaParaEmail): [string, string][] {
  const p: [string, string][] = [];
  if (t.prioridad) p.push(["Prioridad", `${punto(t.prioridad.color)}${escaparHtml(t.prioridad.nombre)}`]);
  if (t.carpeta) p.push(["Carpeta", escaparHtml(t.carpeta)]);
  return p;
}

const bloqueDetalles = (detalles: string | null, arriba: number) => {
  const d = (detalles ?? "").trim();
  if (!d) return "";
  return `<tr><td class="px" style="padding:${arriba}px 32px 0">${rotulo("DETALLES")}</td></tr>`
    + `<tr><td class="px ink" style="padding:8px 32px 0;font-family:${F};font-size:15.5px;line-height:25px;font-weight:500;color:#0a0a0a;word-break:break-word">${conSaltos(d)}</td></tr>`;
};

const pieDeTarjeta = (t: string) =>
  `<tr><td class="px muted" style="padding:14px 32px 0;font-family:${F};font-size:13px;line-height:20px;font-weight:600;color:#5f5d58">${t}</td></tr>`;

// ── Tarea asignada ────────────────────────────────────────────────────────
export function armarAsignada(d: DatosAsignada): Email {
  const nombre = primerNombre(d.destinatario);
  const link = LINK_TAREA + d.id;
  const creador = (d.creador ?? "").trim() || "Alguien de tu departamento";
  const asunto = enUnaLinea(`Nueva tarea: ${d.nombre} · ${fechaCorta(d.fecha)}`);
  const pre = enUnaLinea(`${d.departamento} te asignó una tarea en Agenda Origen`);

  const adentro = nombreDeTarea(d.nombre)
    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${filas([
      ["Día", escaparHtml(diaLargo(d.fecha))],
      ["Horario", escaparHtml(horario(d))],
      ["Equipo", equipo(d)],
      ...opcionales(d),
    ])}</table>`;

  const body = kicker("NUEVA TAREA", "#ebebe8", "#0a0a0a", "pill ink")
    + h1(nombre ? `Hola ${escaparHtml(nombre)}, tenés una tarea nueva` : "Tenés una tarea nueva")
    + intro(`${escaparHtml(d.departamento)} te la asignó en Agenda Origen. Ya la tenés en tu agenda.`)
    + tarjeta(d.color, adentro)
    + bloqueDetalles(d.detalles, 24)
    + linea()
    + pieDeTarjeta(`Asignada por ${escaparHtml(creador)} el ${escaparHtml(fechaYHora(d.creadaAt))}`)
    + boton("Ver en mi Agenda", link);

  const html = shell(asunto, pre, body,
    `Te llega porque sos parte de ${escaparHtml(d.sub)} en ${escaparHtml(d.departamento)}.`);

  const texto = [
    nombre ? `Hola ${nombre}, tenés una tarea nueva.` : "Tenés una tarea nueva.",
    `${d.departamento} te la asignó en Agenda Origen.`,
    "",
    d.nombre,
    `Día: ${diaLargo(d.fecha)}`,
    `Horario: ${horario(d)}`,
    `Equipo: ${d.departamento} › ${d.sub}`,
    ...(d.prioridad ? [`Prioridad: ${d.prioridad.nombre}`] : []),
    ...(d.carpeta ? [`Carpeta: ${d.carpeta}`] : []),
    ...((d.detalles ?? "").trim() ? ["", "Detalles:", (d.detalles ?? "").trim()] : []),
    "",
    `Asignada por ${creador} el ${fechaYHora(d.creadaAt)}`,
    "",
    `Ver en mi Agenda: ${link}`,
    "",
    `Te llega porque sos parte de ${d.sub} en ${d.departamento}.`,
  ].join("\n");

  return { asunto, html, texto };
}

// ── Tarea completada ──────────────────────────────────────────────────────
export function armarCompletada(d: DatosCompletada): Email {
  const link = LINK_TAREA + d.id;
  const quien = (d.completoPor ?? "").trim() || "Alguien del equipo";
  const cuando = d.completadaAt ? fechaYHora(d.completadaAt) : "";
  const creador = (d.creador ?? "").trim() || "Alguien del departamento";
  const asunto = enUnaLinea(`✓ Completada: ${d.nombre} · ${d.sub}`);
  const pre = enUnaLinea(`${quien} marcó la tarea como completada`);

  const adentro = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px"><tr><td class="ok okink" bgcolor="#dcf2e3" style="padding:5px 11px;background-color:#dcf2e3;border-radius:999px;font-family:${F};font-size:12px;line-height:15px;font-weight:700;color:#11612f">&#10003; Completada</td></tr></table>`
    + nombreDeTarea(d.nombre)
    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${filas([
      ["Marcó", `${escaparHtml(quien)}${cuando ? `<br><span class="muted" style="font-weight:500;color:#5f5d58">${escaparHtml(cuando)}</span>` : ""}`],
      ["Día", `${escaparHtml(diaLargo(d.fecha))} · ${escaparHtml(horario(d))}`],
      ["Equipo", equipo(d)],
      ...opcionales(d),
    ])}</table>`;

  const gente = d.integrantes.length
    ? d.integrantes.map(escaparHtml).join("<br>")
    : "Nadie del equipo";
  const solicitud = d.solicitud
    ? `<br>Solicitada por ${escaparHtml((d.solicitud.solicitante ?? "").trim() || "alguien de la iglesia")} el ${escaparHtml(fechaYHora(d.solicitud.creadaAt))}`
    : "";

  const body = kicker("&#10003; TAREA COMPLETADA", "#dcf2e3", "#11612f", "ok okink")
    + h1(`Se completó una tarea de ${escaparHtml(d.sub)}`)
    + intro(`Te avisamos porque sos encargado/a de ${escaparHtml(d.departamento)}.`)
    + tarjeta(d.color, adentro)
    + `<tr><td class="px" style="padding:24px 32px 0">${rotulo("LA TENÍAN")}</td></tr>`
    + `<tr><td class="px ink" style="padding:8px 32px 0;font-family:${F};font-size:15px;line-height:24px;font-weight:600;color:#0a0a0a">${gente}</td></tr>`
    + bloqueDetalles(d.detalles, 22)
    + linea()
    + pieDeTarjeta(`Creada por ${escaparHtml(creador)} el ${escaparHtml(fechaYHora(d.creadaAt))}${solicitud}`)
    + boton("Ver en el panel", link);

  const html = shell(asunto, pre, body, `Te llega porque sos encargado/a de ${escaparHtml(d.departamento)}.`);

  const texto = [
    `Se completó una tarea de ${d.sub}.`,
    "",
    d.nombre,
    `Marcó: ${quien}${cuando ? ` (${cuando})` : ""}`,
    `Día: ${diaLargo(d.fecha)} · ${horario(d)}`,
    `Equipo: ${d.departamento} › ${d.sub}`,
    ...(d.prioridad ? [`Prioridad: ${d.prioridad.nombre}`] : []),
    ...(d.carpeta ? [`Carpeta: ${d.carpeta}`] : []),
    "",
    "La tenían:",
    ...(d.integrantes.length ? d.integrantes : ["Nadie del equipo"]),
    ...((d.detalles ?? "").trim() ? ["", "Detalles:", (d.detalles ?? "").trim()] : []),
    "",
    `Creada por ${creador} el ${fechaYHora(d.creadaAt)}`,
    ...(d.solicitud ? [`Solicitada por ${(d.solicitud.solicitante ?? "").trim() || "alguien de la iglesia"} el ${fechaYHora(d.solicitud.creadaAt)}`] : []),
    "",
    `Ver en el panel: ${link}`,
    "",
    `Te llega porque sos encargado/a de ${d.departamento}.`,
  ].join("\n");

  return { asunto, html, texto };
}

// ── Los de prueba (modo "prueba"): datos inventados, como en el diseño ────
const BASE_DE_EJEMPLO: TareaParaEmail = {
  id: "00000000-0000-4000-8000-000000000000",
  nombre: "Placas para la Serie Noviembre (PRUEBA)",
  detalles: "Cuatro placas, una por domingo:\n· Portada de la serie\n· Versión historia (1080×1920)\n· Versión pantalla del auditorio (16:9)\n\nLos títulos de cada mensaje están en la carpeta compartida.",
  fecha: "2026-11-09",
  todoElDia: false,
  horaDesde: "19:00",
  horaHasta: "20:30",
  departamento: "Creativos",
  sub: "Diseño",
  color: "#db2777",
  prioridad: { nombre: "Alta", color: "#c2410c" },
  carpeta: "Serie Noviembre",
  creador: "Tomás Aguirre",
  creadaAt: "2026-10-20T21:40:00Z",
};

export const ejemploAsignada = (): DatosAsignada => ({ ...BASE_DE_EJEMPLO, destinatario: "Sofía Benítez" });

export const ejemploCompletada = (): DatosCompletada => ({
  ...BASE_DE_EJEMPLO,
  nombre: "Flyer Nocturna para escuelas (PRUEBA)",
  detalles: "Versión A5 para imprimir y versión digital para WhatsApp.\nUsar la paleta de Nocturna y dejar lugar para el logo de cada escuela.",
  fecha: "2026-10-28",
  todoElDia: true,
  horaDesde: null,
  horaHasta: null,
  carpeta: "Nocturna 2026",
  completoPor: "Camila Ledesma",
  completadaAt: "2026-10-26T17:32:00Z",
  integrantes: ["Valentina Ríos (dirige)", "Lucía Ferreyra", "Sofía Benítez", "Camila Ledesma"],
  solicitud: { solicitante: "Carolina Méndez", creadaAt: "2026-10-22T22:02:00Z" },
});

/** Lo que devolvió Resend, en una línea que se pueda leer. */
export function errorLegible(status: number, cuerpo: Record<string, unknown>): string {
  const msg = typeof cuerpo?.message === "string" ? cuerpo.message : "";
  if (status === 429) return "Resend: se alcanzó el límite de envíos.";
  return `Resend respondió ${status}${msg ? `: ${msg}` : ""}`.slice(0, 300);
}
