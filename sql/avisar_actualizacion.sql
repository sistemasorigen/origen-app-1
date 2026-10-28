-- ════════════════════════════════════════════════════════════════════════════
-- avisar_actualizacion() · el push de "hay una versión nueva"
-- 2026-10-28 · pedido de Ignacio: tiene que salir en cada `npm run deploy`
--
-- QUÉ HACE. Crea UN aviso en app_notifications para cada persona que tiene la
-- app instalada con las notificaciones activadas (una fila en
-- push_suscripciones y la cuenta activa). El trigger
-- trg_app_notifications_push hace el resto: le pide a send-push que lo mande
-- al teléfono, aunque la app esté cerrada. Devuelve a cuántas personas les
-- creó el aviso.
--
-- QUIÉN LA LLAMA. scripts/notify-deploy.js, el último paso de
-- `npm run deploy`, justo después de actualizar app_version. Si falla, el
-- deploy NO falla: a esa altura ya está todo publicado.
--
-- A QUIÉN LLEGA. Sólo a quien tiene al menos una suscripción. En iPhone eso
-- quiere decir: agregó la app a la pantalla de inicio y aceptó las
-- notificaciones. Safari no entrega push de ninguna otra forma.
--
-- EL FRENO DE p_horas. Si esa persona ya recibió este mismo aviso en las
-- últimas p_horas (6 por defecto), no se le crea otro. Sin esto, tres deploys
-- seguidos arreglando una coma serían tres pushes al teléfono de todos, y la
-- gente sólo necesita enterarse una vez: la última versión es la que queda.
-- Con AVISO_HORAS=0 en el entorno sale en todos los deploys, sin freno.
--
-- NO LA PUEDE LLAMAR UN USUARIO. Sólo service_role, que es con lo que corre
-- el script. Si cualquiera con sesión pudiera, tendría una forma de mandarle
-- una notificación al teléfono de todos los demás.
--
-- Pruebas: sql/PROBAR_avisar_actualizacion.sql
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.avisar_actualizacion(
    p_titulo  text    DEFAULT 'Hay una versión nueva',
    p_mensaje text    DEFAULT 'Tocá acá y fijate si ya la tenés.',
    p_horas   integer DEFAULT 6
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_n integer;
BEGIN
    INSERT INTO public.app_notifications (user_id, title, message, type, action_url)
    SELECT DISTINCT p.user_id,
           p_titulo,
           p_mensaje,
           'info',
           -- "Sobre la app": ahí está el botón para chequear la versión.
           '/perfil/app'
      FROM public.push_suscripciones p
      JOIN public.users u ON u.id = p.user_id
     WHERE u.is_active IS NOT FALSE
       AND NOT EXISTS (
            SELECT 1
              FROM public.app_notifications a
             WHERE a.user_id = p.user_id
               AND a.title = p_titulo
               AND a.created_at > now() - make_interval(hours => GREATEST(p_horas, 0))
       );

    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.avisar_actualizacion(text, text, integer) IS
    'Crea el aviso "hay una versión nueva" para quien tiene la app instalada con push activado, y el trigger lo manda al teléfono. La llama scripts/notify-deploy.js en cada deploy. No repite dentro de p_horas. Sólo service_role.';


-- ── Permisos ────────────────────────────────────────────────────────────────
-- CREATE OR REPLACE vuelve a darle EXECUTE a PUBLIC (sección 12, regla 3).
REVOKE EXECUTE ON FUNCTION public.avisar_actualizacion(text, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.avisar_actualizacion(text, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.avisar_actualizacion(text, text, integer) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.avisar_actualizacion(text, text, integer) TO service_role;
