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


// ── El envío en lote de las programadas ─────────────────────────────────────
// Una programada crea todos sus avisos de una vez (sql/notif_programadas.sql)
// y pide UN lote, en vez de un pedido por persona. Acá está la vuelta que lo
// recorre; index.ts sólo le pasa cómo hablar con la base.
//
// Los límites salen de los de las Edge Functions (los del plan gratuito, que
// son los más chicos: 150 s de reloj y 2 s de CPU por invocación):
//   · Reloj: se dejan de tomar avisos a los 30 s. Con la última tanda adentro
//     la función contesta muy por debajo de los 150 s y de los 120 s que
//     espera pg_net.
//   · CPU: cifrar un push son ~0,13 ms medidos en Node (ECDH + HKDF +
//     AES-GCM + la firma VAPID). Aunque en Deno fuera 10 veces más, 100 avisos
//     con hasta 3 dispositivos cada uno son ~0,4 s.
//   · Lo que no entra, sigue en otra invocación: la función le pide a la base
//     que la vuelva a llamar (notif_lote_encolar). El "cursor" es la cola del
//     lote en la base, no un número que viaja en el pedido: lo que se tomó
//     queda reservado y lo que se procesó se borra, así que la invocación
//     siguiente —o una que corra a la vez— no puede repetir a nadie.

/** Cuántos avisos se toman de la base por vez. */
export const LOTE_TOMA = 50;
/** Cuántos avisos se mandan a la vez. */
export const LOTE_CONCURRENCIA = 10;
/** Pasado este tiempo no se toman más avisos en esta invocación. */
export const LOTE_PRESUPUESTO_MS = 30_000;
/** Como mucho, tantos avisos por invocación (el límite de CPU). */
export const LOTE_MAX_POR_INVOCACION = 100;

/** Corre fn sobre cada elemento, con a lo sumo `limite` a la vez. */
export async function enParalelo<T>(items: readonly T[], limite: number, fn: (x: T) => Promise<void>): Promise<void> {
  let siguiente = 0;
  const trabajador = async () => {
    while (siguiente < items.length) {
      const x = items[siguiente++];
      await fn(x);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limite, items.length)) }, trabajador));
}

/** Cómo habla la vuelta del lote con el mundo (la base y el push). */
export interface DependenciasLote {
  /** notif_lote_tomar: reserva y devuelve hasta `tope` ids. */
  tomar: (tope: number) => Promise<{ ids: string[]; quedan: number }>;
  /** Manda el push de un aviso, con las reglas de siempre. */
  mandar: (id: string) => Promise<{ enviados: number; borradas: number; fallidas: number }>;
  /** notif_lote_hechos: los saca de la cola. */
  hechos: (ids: string[]) => Promise<{ quedan: number }>;
  /** notif_lote_encolar: que la base vuelva a llamar a send-push. */
  seguirDespues: () => Promise<void>;
  ahora: () => number;
}

export interface ResultadoLote {
  procesados: number;
  enviados: number;
  borradas: number;
  fallidas: number;
  /** true si quedaron avisos y se pidió otra invocación. */
  continua: boolean;
}

export async function procesarLote(
  d: DependenciasLote,
  limites = {
    toma: LOTE_TOMA,
    concurrencia: LOTE_CONCURRENCIA,
    presupuestoMs: LOTE_PRESUPUESTO_MS,
    maximo: LOTE_MAX_POR_INVOCACION,
  },
): Promise<ResultadoLote> {
  const inicio = d.ahora();
  const r: ResultadoLote = { procesados: 0, enviados: 0, borradas: 0, fallidas: 0, continua: false };
  let quedan = 0;

  while (r.procesados < limites.maximo && d.ahora() - inicio < limites.presupuestoMs) {
    const tanda = await d.tomar(Math.min(limites.toma, limites.maximo - r.procesados));
    quedan = tanda.quedan;
    // Nada para tomar: o terminó, o lo que falta lo tiene reservado otra
    // invocación (si ésa se muere, el reloj relanza el lote a los 10 min).
    if (tanda.ids.length === 0) return r;

    await enParalelo(tanda.ids, limites.concurrencia, async (id) => {
      try {
        const x = await d.mandar(id);
        r.enviados += x.enviados;
        r.borradas += x.borradas;
        r.fallidas += x.fallidas;
      } catch (_e) {
        // Un aviso que revienta no frena el lote. Se da por procesado igual:
        // reintentarlo para siempre sería peor que perder ese push (el aviso
        // está en la campanita).
        r.fallidas++;
      }
    });

    quedan = (await d.hechos(tanda.ids)).quedan;
    r.procesados += tanda.ids.length;
  }

  if (quedan > 0) {
    await d.seguirDespues();
    r.continua = true;
  }
  return r;
}
