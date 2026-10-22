// Arma el email de un reporte nuevo. Sin dependencias de Deno: se puede
// probar con Node.
import { PLANTILLA } from "./plantilla.ts";

export interface ReporteParaEmail {
  id: string;
  numero: number;
  descripcion: string;
  pantalla: string | null;
  captura_path: string | null;
  version_app: string | null;
  dispositivo: string | null;
  created_at: string;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
}

export const LINK_PANEL = "https://app.origeniglesia.org/#/panel-admin/reportes?id=";

/** 'REP-0042'. Igual que codigo_reporte() en SQL y codigoReporte() en TS. */
export function codigoReporte(numero: number | string): string {
  const s = String(numero);
  return "REP-" + (s.length >= 4 ? s : s.padStart(4, "0"));
}

/** Todo lo que entra al HTML pasa por acá: la descripción la escribe cualquiera. */
export function escaparHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "22 oct 2026 · 11:05", en hora argentina sin importar dónde corra. */
export function fechaArgentina(iso: string): string {
  const d = new Date(iso);
  const partes = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? "";
  const mes = p("month").replace(".", "").slice(0, 3).toLowerCase();
  return `${p("day")} ${mes} ${p("year")} · ${p("hour")}:${p("minute")}`;
}

/** El inicio del día de hoy en Argentina, para el tope diario. */
export function inicioDelDiaArgentino(ahora = new Date()): string {
  const fecha = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(ahora);
  return new Date(`${fecha}T00:00:00-03:00`).toISOString();
}

/** Las primeras palabras, en una línea: lo que se ve antes de abrir el email. */
export function preencabezado(descripcion: string): string {
  const plano = descripcion.replace(/\s+/g, " ").trim();
  return plano.length > 110 ? plano.slice(0, 110).trimEnd() + "…" : plano;
}

/** Reemplaza en UNA pasada: lo que escribió la persona no se vuelve a leer como variable. */
function reemplazar(html: string, valores: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (todo, clave) => (clave in valores ? valores[clave] : todo));
}

export function armarEmail(r: ReporteParaEmail): { asunto: string; html: string } {
  const codigo = codigoReporte(r.numero);
  const pantalla = (r.pantalla ?? "").trim() || "Sin pantalla";
  const descripcion = r.descripcion ?? "";

  const html = reemplazar(PLANTILLA, {
    codigo: escaparHtml(codigo),
    nombre: escaparHtml((r.nombre ?? "").trim() || "Sin nombre"),
    email: escaparHtml((r.email ?? "").trim() || "Sin email"),
    telefono: escaparHtml((r.telefono ?? "").trim() || "Sin teléfono"),
    pantalla: escaparHtml(pantalla),
    fecha: escaparHtml(fechaArgentina(r.created_at)),
    version: escaparHtml((r.version_app ?? "").trim() || "—"),
    dispositivo: escaparHtml((r.dispositivo ?? "").trim() || "—"),
    descripcion: escaparHtml(descripcion).replace(/\r?\n/g, "<br>"),
    tieneCaptura: r.captura_path ? "Captura: sí, adjunta en el panel" : "Sin captura",
    linkPanel: escaparHtml(LINK_PANEL + r.id),
    preheader: escaparHtml(preencabezado(descripcion)),
  });

  // El asunto no es HTML, pero tampoco puede llevar saltos de línea.
  const asunto = `Nuevo reporte ${codigo} · ${pantalla}`.replace(/[\r\n]+/g, " ");
  return { asunto, html };
}

/** Lo que devolvió Resend, en una línea que se pueda leer en el panel. */
export function errorLegible(status: number, cuerpo: Record<string, unknown>): string {
  const msg = typeof cuerpo?.message === "string" ? cuerpo.message : "";
  if (status === 429) return "Resend: se alcanzó el límite de envíos.";
  return `Resend respondió ${status}${msg ? `: ${msg}` : ""}`.slice(0, 300);
}
