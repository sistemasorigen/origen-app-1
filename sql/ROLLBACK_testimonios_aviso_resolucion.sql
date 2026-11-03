-- ════════════════════════════════════════════════════════════════════════════
-- DESHACER sql/testimonios_aviso_resolucion.sql
--
-- Vuelve `testimonios_admin_resolver` a su definición exacta de antes
-- (pg_get_functiondef, 2026-11-02) y saca la alerta del catálogo.
--
-- La alerta se borra sólo si NADIE la usó todavía: si ya hay avisos con esa
-- clave, se marca como eliminada en vez de borrarla, que es lo que hace la
-- pantalla de Sistemas, para no dejar avisos huérfanos.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.testimonios_admin_resolver(p_id uuid, p_accion text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    yo uuid := auth.uid();
    x  record;
BEGIN
    IF yo IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF NOT public.testimonios_es_sistemas(yo) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    END IF;
    IF p_accion IS NULL OR p_accion NOT IN ('eliminar', 'rechazar', 'ocultar', 'mostrar') THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'accion_invalida');
    END IF;

    SELECT * INTO x FROM public.gcx_testimonios WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;

    IF p_accion = 'eliminar' THEN
        DELETE FROM public.gcx_testimonios WHERE id = p_id;
        RETURN jsonb_build_object('ok', true, 'accion', 'eliminar', 'estado', NULL);
    END IF;

    IF p_accion = 'rechazar' THEN
        IF x.estado <> 'eliminacion_solicitada' THEN
            RETURN jsonb_build_object('ok', false, 'motivo', 'estado_invalido', 'estado', x.estado);
        END IF;
        UPDATE public.gcx_testimonios
           SET estado = COALESCE(x.estado_antes_del_pedido, 'publicado'),
               estado_antes_del_pedido = NULL,
               decision = 'pedido_rechazado', decidido_at = now(), decidido_por = yo
         WHERE id = p_id;
        RETURN jsonb_build_object('ok', true, 'accion', 'rechazar', 'estado', COALESCE(x.estado_antes_del_pedido, 'publicado'));
    END IF;

    -- ocultar / mostrar: con un pedido pendiente, primero se resuelve el pedido.
    IF x.estado = 'eliminacion_solicitada' THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'estado_invalido', 'estado', x.estado);
    END IF;
    IF (p_accion = 'ocultar' AND x.estado = 'oculto') OR (p_accion = 'mostrar' AND x.estado = 'publicado') THEN
        RETURN jsonb_build_object('ok', true, 'accion', p_accion, 'estado', x.estado, 'sin_cambios', true);
    END IF;
    UPDATE public.gcx_testimonios
       SET estado = CASE p_accion WHEN 'ocultar' THEN 'oculto' ELSE 'publicado' END,
           decision = CASE p_accion WHEN 'ocultar' THEN 'oculto' ELSE 'mostrado' END,
           decidido_at = now(), decidido_por = yo
     WHERE id = p_id;
    RETURN jsonb_build_object('ok', true, 'accion', p_accion,
                              'estado', CASE p_accion WHEN 'ocultar' THEN 'oculto' ELSE 'publicado' END);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.testimonios_admin_resolver(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.testimonios_admin_resolver(uuid, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.testimonios_admin_resolver(uuid, text) TO authenticated;

-- La alerta: se va si no dejó ningún aviso; si dejó, se marca eliminada.
UPDATE public.notif_alertas
   SET eliminada_at = now()
 WHERE clave = 'testimonios_pedido_resuelto'
   AND eliminada_at IS NULL
   AND EXISTS (SELECT 1 FROM public.app_notifications WHERE alerta_clave = 'testimonios_pedido_resuelto');

DELETE FROM public.notif_alertas
 WHERE clave = 'testimonios_pedido_resuelto'
   AND NOT EXISTS (SELECT 1 FROM public.app_notifications WHERE alerta_clave = 'testimonios_pedido_resuelto');
