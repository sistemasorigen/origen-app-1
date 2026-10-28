-- ════════════════════════════════════════════════════════════════════════════
-- Avisar que hay una versión nueva de la app
-- 2026-10-28 · pedido de Ignacio
--
-- QUÉ HACE. Crea UN aviso en app_notifications para cada persona que tiene la
-- app instalada con las notificaciones activadas (una fila en
-- push_suscripciones). El trigger trg_app_notifications_push hace el resto:
-- le pide a send-push que lo mande al teléfono, aunque la app esté cerrada.
--
-- A QUIÉN LLEGA. Sólo a quien tiene al menos una suscripción y la cuenta
-- activa. Al 2026-10-28 son 2 personas, las dos en iPhone con la app en la
-- pantalla de inicio. En iPhone no hay otra forma: Safari sólo entrega push a
-- las apps agregadas a inicio.
--
-- NO SE REPITE. La condición NOT EXISTS del final mira si esa persona ya
-- recibió este mismo aviso en las últimas 12 horas. Correrlo dos veces por
-- error no le manda dos pushes a nadie.
--
-- PARA LA PRÓXIMA VEZ: cambiar TITULO y MENSAJE acá arriba y correrlo. No
-- hace falta tocar nada más.
--
-- ⚠️ ESTO LE ESCRIBE A GENTE DE VERDAD. No tiene vuelta atrás: una vez que el
-- push salió, salió. Probarlo antes con BEGIN … ROLLBACK (ver el final).
-- ════════════════════════════════════════════════════════════════════════════

WITH texto AS (
    SELECT
        'Hay una versión nueva'::text          AS titulo,
        'Tocá acá y fijate si ya la tenés.'::text AS mensaje,
        'info'::text                            AS tipo,
        -- "Sobre la app": ahí está el botón para chequear la versión.
        '/perfil/app'::text                     AS url
),
destinatarios AS (
    SELECT DISTINCT p.user_id
      FROM public.push_suscripciones p
      JOIN public.users u ON u.id = p.user_id
     WHERE u.is_active IS NOT FALSE
)
INSERT INTO public.app_notifications (user_id, title, message, type, action_url)
SELECT d.user_id, t.titulo, t.mensaje, t.tipo, t.url
  FROM destinatarios d
 CROSS JOIN texto t
 WHERE NOT EXISTS (
    SELECT 1 FROM public.app_notifications a
     WHERE a.user_id = d.user_id
       AND a.title = t.titulo
       AND a.created_at > now() - interval '12 hours'
 )
RETURNING user_id, title, message, action_url;

-- Para ensayarlo sin mandar nada: envolver todo en
--   BEGIN;  …este archivo…  ROLLBACK;
-- El ROLLBACK también deshace la cola de pg_net, así que los pushes no salen.
