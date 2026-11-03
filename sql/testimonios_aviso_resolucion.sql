-- ════════════════════════════════════════════════════════════════════════════
-- Avisarle a la persona cuando Sistemas resuelve su pedido de eliminación
-- 2026-11-02 · testimonios de los GCX, prompt 4
--
-- QUÉ FALTABA. Cuando alguien pide eliminar su testimonio, Sistemas se entera
-- (alerta `testimonios_eliminacion_solicitada`). Lo que no pasaba era lo de
-- vuelta: se resolvía el pedido —se eliminaba o se rechazaba— y la persona no
-- se enteraba nunca. Tenía que acordarse de volver a mirar.
--
-- LO QUE AGREGA
--   1 · La alerta `testimonios_pedido_resuelto` en el catálogo, apagable como
--       las demás, que abre /perfil/testimonios.
--   2 · `testimonios_admin_resolver` la emite a QUIEN ESCRIBIÓ el testimonio
--       —a nadie más— y SÓLO cuando lo que se resuelve es un pedido de
--       eliminación. Ocultar y mostrar por decisión de Sistemas no avisan:
--       no son respuesta a nada que la persona haya pedido.
--
-- EL AVISO NO LLEVA EL TEXTO del testimonio: el GCX y en qué quedó, nada más.
-- Va por `notif_emitir`, así que respeta la pausa, el horario de no molestar
-- y las preferencias de esa persona, como cualquier otra alerta.
--
-- Pruebas: sql/PROBAR_testimonios_aviso_resolucion.sql
-- Deshacer: sql/ROLLBACK_testimonios_aviso_resolucion.sql
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1 · La alerta ───────────────────────────────────────────────────────────
-- Un solo renglón para los dos finales: lo que cambia es `resultado` ("fue
-- eliminado" / "sigue publicado"). Dos alertas distintas para el mismo hecho
-- —"revisamos tu pedido"— serían dos interruptores para apagar lo mismo.
INSERT INTO public.notif_alertas
    (clave, tipo, area, nombre, nombre_publico, descripcion_evento, descripcion_publica,
     destinatario_texto, variables, titulo_plantilla, mensaje_plantilla, url_plantilla,
     type_legacy, permite_apagar)
VALUES (
    'testimonios_pedido_resuelto', 'automatica', 'GCX',
    'Resolvimos tu pedido de eliminación',
    'Respuesta a tu pedido de eliminación',
    'Sistemas elimina o rechaza un pedido para eliminar un testimonio',
    'Cuando Sistemas resuelve tu pedido de eliminar un testimonio.',
    'Quien escribió el testimonio',
    ARRAY['grupo', 'resultado'],
    'Revisamos tu pedido',
    'Tu testimonio de {grupo} {resultado}.',
    '/perfil/testimonios',
    'info', true)
ON CONFLICT (clave) DO NOTHING;


-- ── 2 · El resolver, con el aviso ───────────────────────────────────────────
-- Copia de la definición viva (pg_get_functiondef, 2026-11-02) con lo mínimo
-- agregado: las tres variables de arriba, el aviso en 'eliminar' —sólo si
-- había un pedido— y el aviso en 'rechazar'.
CREATE OR REPLACE FUNCTION public.testimonios_admin_resolver(p_id uuid, p_accion text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    yo uuid := auth.uid();
    x  record;
    -- Lo que hace falta para avisarle a la persona. Se lee ANTES de borrar:
    -- después de un DELETE ya no hay a quién avisarle ni de qué.
    v_habia_pedido boolean;
    v_autor uuid;
    v_grupo text;
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

    v_habia_pedido := (x.estado = 'eliminacion_solicitada');
    v_autor := x.autor_id;
    v_grupo := COALESCE((SELECT name FROM public.groups WHERE id = x.group_id), 'un GCX');

    IF p_accion = 'eliminar' THEN
        DELETE FROM public.gcx_testimonios WHERE id = p_id;
        -- Sólo si se estaba resolviendo un pedido de la persona. Sistemas
        -- también puede eliminar uno que nadie pidió sacar, y en ese caso no
        -- hay ningún pedido que contestar.
        IF v_habia_pedido THEN
            PERFORM public.notif_emitir('testimonios_pedido_resuelto', v_autor,
                jsonb_build_object('grupo', v_grupo, 'resultado', 'fue eliminado'));
        END IF;
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
        PERFORM public.notif_emitir('testimonios_pedido_resuelto', v_autor,
            jsonb_build_object('grupo', v_grupo, 'resultado', 'sigue publicado'));
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
    -- Ocultar o mostrar por decisión de Sistemas NO avisa: no contesta ningún
    -- pedido. La persona lo ve igual en "Mis testimonios".
    RETURN jsonb_build_object('ok', true, 'accion', p_accion,
                              'estado', CASE p_accion WHEN 'ocultar' THEN 'oculto' ELSE 'publicado' END);
END;
$function$;


-- ── Permisos ────────────────────────────────────────────────────────────────
-- CREATE OR REPLACE vuelve a darle EXECUTE a PUBLIC (sección 12, regla 3).
-- Quedan como estaban: sólo `authenticated`, y adentro la función chequea que
-- quien llama sea SUPER_ADMIN.
REVOKE EXECUTE ON FUNCTION public.testimonios_admin_resolver(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.testimonios_admin_resolver(uuid, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.testimonios_admin_resolver(uuid, text) TO authenticated;
