// Armado del email de Nocturna: todo lo que se puede probar sin red.
//
// Vive aparte de index.ts porque index.ts llama a serve() al importarse, y
// entonces no hay forma de ejercer el escapado, el formato de pesos ni la
// repetición del bloque de chicos sin levantar un servidor y mandar un email.

import QRCode from "npm:qrcode";
import { PLANTILLA_ENTRADA } from "./plantilla.ts";

export const CID_QR = "qr-entrada";

export interface Joven {
  nombre: string;
  apellido: string;
  tribu: string;
  retiro_tipo: "solo" | "adulto" | "otra_persona";
  retiro_nombre: string | null;
  retiro_apellido: string | null;
}

export interface Inscripcion {
  id: string;
  codigo_entrada: string;
  adulto_nombre: string;
  adulto_apellido: string;
  adulto_email: string;
  total: string | number;
  email_intentos: number;
  jovenes: Joven[];
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Escapa lo que escribió una persona antes de meterlo en el HTML.
 *
 * No es higiene teórica: este email sale firmado por la iglesia. Un nombre
 * con `<a href="...">` adentro inyectaría un link en un mensaje que el
 * destinatario tiene motivos para creer. Y uno con `&` o `<` a secas rompe
 * el HTML y deja el email ilegible.
 *
 * Se escapan también las comillas porque varios valores caen dentro de
 * atributos (el `alt` del QR lleva el código de entrada).
 */
export function escaparHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Pesos argentinos: punto para los miles, coma para los centavos.
 *
 * A mano y no con toLocaleString: el formato de la moneda no puede depender
 * de qué datos de ICU traiga el runtime de turno.
 */
export function enPesos(valor: string | number): string {
  const n = Math.abs(Number(valor) || 0);
  const entero = Math.floor(n);
  const centavos = Math.round((n - entero) * 100);
  const conPuntos = entero.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return centavos === 0 ? `$${conPuntos}` : `$${conPuntos},${String(centavos).padStart(2, "0")}`;
}

/** Cómo se retira un chico, en una frase que lee el adulto responsable. */
export function fraseDeRetiro(j: Joven): string {
  if (j.retiro_tipo === "solo") return "Se retira solo";
  if (j.retiro_tipo === "adulto") return "Lo retirás vos";
  const quien = `${j.retiro_nombre ?? ""} ${j.retiro_apellido ?? ""}`.trim();
  return quien ? `Lo retira ${quien}` : "Lo retira otra persona";
}

/** Reemplaza TODAS las apariciones de {{clave}}, sin tocar el resto. */
export function reemplazar(html: string, valores: Record<string, string>): string {
  let salida = html;
  for (const [clave, valor] of Object.entries(valores)) {
    salida = salida.split(`{{${clave}}}`).join(valor);
  }
  return salida;
}

export function armarHtml(insc: Inscripcion): string {
  const INICIO = "<!-- INICIO CHICO -->";
  const FIN = "<!-- FIN CHICO -->";

  const desde = PLANTILLA_ENTRADA.indexOf(INICIO);
  const hasta = PLANTILLA_ENTRADA.indexOf(FIN);
  if (desde === -1 || hasta === -1 || hasta < desde) {
    throw new Error("La plantilla perdió las marcas INICIO CHICO / FIN CHICO");
  }

  const bloque = PLANTILLA_ENTRADA.slice(desde, hasta + FIN.length);
  const bloques = insc.jovenes
    .map((j) =>
      reemplazar(bloque, {
        nombreChico: escaparHtml(`${j.nombre} ${j.apellido}`.trim()),
        // "Sin tribu" ya se explica solo: anteponerle el rótulo daba
        // "Tribu Sin tribu".
        tribuChico: escaparHtml(j.tribu === "Sin tribu" ? "Sin tribu" : `Tribu ${j.tribu}`),
        retiroChico: escaparHtml(fraseDeRetiro(j)),
      })
    )
    .join("");

  const conChicos = PLANTILLA_ENTRADA.slice(0, desde) + bloques +
    PLANTILLA_ENTRADA.slice(hasta + FIN.length);

  const cantidad = insc.jovenes.length;

  return reemplazar(conChicos, {
    nombreAdulto: escaparHtml(`${insc.adulto_nombre} ${insc.adulto_apellido}`.trim()),
    codigoEntrada: escaparHtml(insc.codigo_entrada),
    cantidadChicos: String(cantidad),
    palabraEntradas: cantidad === 1 ? "entrada" : "entradas",
    totalPagado: escaparHtml(enPesos(insc.total)),
    // El adjunto incrustado, no una URL.
    qrUrl: `cid:${CID_QR}`,
  });
}

/** El PNG del QR en base64, listo para el adjunto de Resend. */
export async function qrEnBase64(inscripcionId: string): Promise<string> {
  // Codifica SOLO el id: es exactamente lo que lee el escáner de acreditación.
  const buffer: Uint8Array = await QRCode.toBuffer(inscripcionId, {
    type: "png",
    width: 600,
    // El estándar pide 4 módulos de zona tranquila. Con menos, un escáner con
    // poca luz —un patio a las 11 de la noche— no encuentra el código.
    margin: 4,
    errorCorrectionLevel: "M",
  });

  // De a pedazos: con un PNG de 600px, pasarle el array entero a
  // String.fromCharCode revienta la pila de argumentos.
  const bytes = new Uint8Array(buffer);
  let binario = "";
  const PASO = 8192;
  for (let i = 0; i < bytes.length; i += PASO) {
    binario += String.fromCharCode(...bytes.subarray(i, i + PASO));
  }
  return btoa(binario);
}

/**
 * Traduce lo que respondió Resend a algo que el staff pueda leer en el panel.
 *
 * El límite diario importa más que los otros: con 100 emails por día, un
 * viernes de muchas inscripciones lo vamos a ver, y quien mira el panel tiene
 * que entender que no es un error de la familia ni del sistema.
 */
export function errorLegible(status: number, cuerpo: Record<string, unknown>): string {
  const nombre = String(cuerpo?.name ?? "");
  const mensaje = String(cuerpo?.message ?? "");

  if (nombre === "daily_quota_exceeded") {
    return "Se alcanzó el límite diario de envíos. Reenviar mañana o desde otra cuenta.";
  }
  if (nombre === "monthly_quota_exceeded") {
    return "Se alcanzó el límite mensual de envíos del plan.";
  }
  if (nombre === "rate_limit_exceeded") {
    return "Se mandaron demasiados emails por segundo. Reintentar en un momento.";
  }
  if (status === 422 || nombre === "validation_error") {
    return `Resend rechazó la dirección: ${mensaje || "email inválido"}`;
  }
  if (status === 401 || status === 403) {
    return "La clave de Resend no es válida o no tiene permiso para enviar.";
  }
  return `Resend respondió ${status}${mensaje ? `: ${mensaje}` : ""}`;
}
