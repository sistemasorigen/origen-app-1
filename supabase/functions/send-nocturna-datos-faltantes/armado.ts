// Armado del email "te falta un dato" de Nocturna.
//
// Lo mismo que armado.ts del email de la entrada, con lo justo: acá no hay QR
// ni adjuntos, sólo tres variables de texto.

import { PLANTILLA_DATOS_FALTANTES } from "./plantilla.ts";

/** El inicio de /nocturna-entrada, donde cae el botón del email. */
export const BASE_COMPLETAR = "https://app.origeniglesia.org/#/nocturna-entrada";

export interface Destinataria {
  id: string;
  codigo_entrada: string;
  adulto_nombre: string;
  adulto_email: string;
}

/**
 * Escapa lo que va adentro del HTML.
 *
 * Un apóstrofo en un nombre —D'Angelo— o un ampersand rompen el HTML y dejan
 * el email ilegible. Se escapan también las comillas porque los valores caen
 * dentro de atributos: el código va en el `href` del botón.
 */
export function escaparHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Reemplaza TODAS las apariciones de {{clave}}, sin tocar el resto. */
export function reemplazar(html: string, valores: Record<string, string>): string {
  let salida = html;
  for (const [clave, valor] of Object.entries(valores)) {
    salida = salida.split(`{{${clave}}}`).join(valor);
  }
  return salida;
}

/**
 * El link que lleva a la pantalla con el código ya escrito.
 *
 * El código se limpia a su alfabeto antes de entrar en la URL: lo que llega
 * de la base es confiable, pero este string termina adentro de un `href` y de
 * un texto que la gente copia y pega. Si alguna vez un código trajera algo
 * raro, acá se queda.
 */
export function linkDe(codigo: string): string {
  const limpio = String(codigo ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  return `${BASE_COMPLETAR}?codigo=${encodeURIComponent(limpio)}`;
}

export function armarHtml(d: Destinataria): string {
  return reemplazar(PLANTILLA_DATOS_FALTANTES, {
    // Sólo el nombre de pila: el email le habla a la persona, no la identifica.
    nombreAdulto: escaparHtml(String(d.adulto_nombre ?? "").trim()),
    codigoEntrada: escaparHtml(d.codigo_entrada),
    linkCompletar: escaparHtml(linkDe(d.codigo_entrada)),
  });
}

/** El motivo de Resend, en castellano y sin el cuerpo del error. */
export function errorLegible(status: number, cuerpo: unknown): string {
  const c = cuerpo as { name?: string; message?: string } | null;
  if (status === 429) return "Resend está limitando los envíos. Hay que esperar un rato.";
  if (status === 401 || status === 403) return "La clave de Resend no es válida.";
  if (c?.name === "validation_error") return "Resend rechazó la dirección de email.";
  return c?.message ? String(c.message) : `Resend respondió ${status}.`;
}
