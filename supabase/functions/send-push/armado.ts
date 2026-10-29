// Lo que arma send-push, separado de index.ts para poder probarlo sin
// levantar el servidor (index.ts llama a serve() al importarse).

/** Lo que llega al service worker (public/sw.js). */
export interface PayloadPush {
  title: string;
  body: string;
  url: string;
  tag: string;
  badge: number;
}

export interface NotificacionParaPush {
  id: string;
  title: string | null;
  message: string | null;
  action_url: string | null;
}

export const LARGO_TITULO = 80;
export const LARGO_CUERPO = 180;

/**
 * Tipos de aviso que NO salen como push. Vacía a propósito: en el inventario
 * del 2026-10-28 ningún tipo pasaba de 20 por persona por día (el máximo fue
 * 10). Si alguno se vuelve masivo, se agrega acá y se despliega la función.
 */
export const TIPOS_SIN_PUSH: readonly string[] = [];

/** Corta en el largo pedido, con "…" si sobra. */
export const recortar = (texto: string | null | undefined, largo: number): string => {
  const limpio = String(texto ?? "").replace(/\s+/g, " ").trim();
  return limpio.length > largo ? `${limpio.slice(0, largo - 1).trimEnd()}…` : limpio;
};

/**
 * La ruta a la que lleva tocar el aviso. Sólo rutas internas de la app
 * ("/agenda?tarea=…"): cualquier otra cosa —un dominio, "//otro.com",
 * "javascript:"— se cambia por "/". El service worker lo vuelve a chequear.
 */
export const urlInterna = (url: string | null | undefined): string => {
  const u = String(url ?? "").trim();
  if (!u.startsWith("/") || u.startsWith("//") || u.includes("\\")) return "/";
  if (/[\u0000-\u001f]/.test(u)) return "/";
  return u.length > 500 ? "/" : u;
};

/** El número del ícono: cuántas sin leer, sin negativos ni decimales. */
export const badge = (sinLeer: number | null | undefined): number => {
  const n = Math.floor(Number(sinLeer ?? 0));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 999) : 0;
};

export const armarPayload = (n: NotificacionParaPush, sinLeer: number | null | undefined): PayloadPush => ({
  title: recortar(n.title, LARGO_TITULO) || "Origen",
  body: recortar(n.message, LARGO_CUERPO),
  url: urlInterna(n.action_url),
  // Mismo tag para el mismo aviso: si por un reintento llega dos veces, el
  // sistema reemplaza la primera en vez de apilarla.
  tag: `notif-${n.id}`,
  badge: badge(sinLeer),
});

/** Qué hacer con una suscripción después de un intento. */
export type Desenlace = "ok" | "borrar" | "fallo";

/**
 * 404 y 410: el servicio de push dice que esa suscripción ya no existe (se
 * desinstaló la app, se borraron los datos, se revocó el permiso). Se borra.
 * Cualquier otro error puede ser pasajero: suma un fallo.
 */
export const desenlace = (statusCode: number | null | undefined): Desenlace => {
  if (statusCode && statusCode >= 200 && statusCode < 300) return "ok";
  if (statusCode === 404 || statusCode === 410) return "borrar";
  return "fallo";
};

/** Con tantos fallos seguidos, la suscripción se borra. */
export const FALLOS_PARA_BORRAR = 5;


// ── Las reglas de la Gestión de notificaciones ──────────────────────────────
// La decisión la toma la base (notif_puede_enviar, sql/notif_catalogo.sql),
// que es la que conoce la alerta, su horario y lo que ya salió hoy. Acá sólo
// se traduce esa respuesta a lo que hace la función.

/** Lo que contesta notif_puede_enviar. */
export type Decision = "enviar" | "pausada" | "tope" | "diferir";

/** Cómo entró el pedido: un aviso nuevo, o la pasada del cron. */
export type Modo = "aviso" | "diferidos";

export type Accion = "mandar" | "no_mandar" | "diferir";

/**
 * Qué hacer con la respuesta de la base.
 *
 * Si la respuesta no se entiende —la función todavía no existe, el pedido
 * falló— se MANDA. Un aviso que no llega es peor que uno que llega en un
 * horario raro: esto tiene que fallar abriendo, no cerrando.
 *
 * En la pasada del cron, "diferir" se manda igual: ese push ya esperó su
 * turno una vez y volver a diferirlo lo dejaría colgado para siempre si
 * alguien cambió el horario mientras tanto.
 */
export const accionDe = (decision: string | null | undefined, modo: Modo = "aviso"): Accion => {
  switch (decision) {
    case "pausada":
    case "tope":
      return "no_mandar";
    case "diferir":
      return modo === "diferidos" ? "mandar" : "diferir";
    default:
      return "mandar";
  }
};

/** Con qué resultado se anota en notif_push_log. */
export const resultadoDe = (
  accion: Accion,
  decision: string | null | undefined,
  enviados: number,
): "enviado" | "pausada" | "tope" | "diferido" | "fallo" => {
  if (accion === "diferir") return "diferido";
  if (accion === "no_mandar") return decision === "tope" ? "tope" : "pausada";
  return enviados > 0 ? "enviado" : "fallo";
};
