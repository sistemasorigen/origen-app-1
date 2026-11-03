-- ════════════════════════════════════════════════════════════════════════════
-- DESHACER sql/testimonios_avisos_anfitriones.sql
-- 2026-11-03
--
-- Deja las TRES funciones exactamente como estaban antes del cambio: las
-- definiciones son copia literal de pg_get_functiondef en producción, tomadas
-- el 2026-11-03 ANTES de aplicarlo.
--   · testimonios_publicar_en          → sin el aviso a los anfitriones
--   · testimonios_solicitar_eliminacion → el aviso a Sistemas, sin &id=
--   · testimonios_admin_resolver        → {resultado} = 'fue eliminado'
--
-- Y saca la alerta `testimonios_nuevo_en_tu_gcx`. Si ya dejó avisos, NO se
-- borra la fila: se marca eliminada. Borrarla dejaría los avisos de
-- /notificaciones con una clave que no existe —y `notif_puede_enviar`
-- contestaría 'enviar' para algo que Sistemas quiso apagar.
--
-- El cambio de ícono en pages/user/Notificaciones.tsx se deshace con git; sin
-- la alerta, ese renglón del mapa simplemente no lo usa nadie.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1 · Las tres funciones, como estaban ────────────────────────────────────
-- Publicar, sin avisar a quien dirige el GCX.
CREATE OR REPLACE FUNCTION public.testimonios_publicar_en(p_group_id text, p_texto text, p_consiento boolean, p_ahora timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    TOPE_DIA constant integer := 5;
    yo      uuid  := auth.uid();
    t       jsonb := public.testimonios_temporada_en(p_ahora);
    g       record;
    v_texto text;
    v_prev  record;
    v_n     integer;
    v_id    uuid;
BEGIN
    IF yo IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF NOT (t->>'carga_abierta')::boolean THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'fuera_de_plazo', 'temporada', t);
    END IF;

    SELECT * INTO g FROM public.groups WHERE id = p_group_id;
    IF NOT FOUND OR lower(COALESCE(g.status, '')) <> 'approved' THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF NOT public.testimonios_grupo_es_de(g.status, g.start_date, t) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'fuera_de_temporada', 'temporada', t);
    END IF;
    -- Inscripción aprobada, o anfitrión / co-anfitrión del GCX.
    IF public.testimonios_rol_en_grupo(yo, g.id) IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_inscripto');
    END IF;

    v_texto := regexp_replace(COALESCE(p_texto, ''), '^\s+|\s+$', '', 'g');
    IF char_length(v_texto) NOT BETWEEN 1 AND 1000 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'texto_invalido', 'limite', 1000);
    END IF;
    IF p_consiento IS NOT TRUE THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_consentimiento');
    END IF;

    SELECT id, texto INTO v_prev FROM public.gcx_testimonios WHERE autor_id = yo AND group_id = g.id;
    IF FOUND THEN
        IF v_prev.texto = v_texto THEN
            RETURN jsonb_build_object('ok', true, 'id', v_prev.id, 'ya_existia', true, 'grupo', g.name);
        END IF;
        RETURN jsonb_build_object('ok', false, 'motivo', 'ya_publicado', 'id', v_prev.id);
    END IF;

    SELECT count(*) INTO v_n FROM public.gcx_testimonios
     WHERE autor_id = yo
       AND (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
         = (p_ahora AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
    IF v_n >= TOPE_DIA THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'tope', 'limite', TOPE_DIA);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = yo AND NULLIF(btrim(name), '') IS NOT NULL) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_nombre');
    END IF;

    BEGIN
        -- p_ahora es now() en la app; en las pruebas, la fecha que se prueba.
        INSERT INTO public.gcx_testimonios (group_id, autor_id, temporada, anio, texto, consentimiento_at, created_at)
        VALUES (g.id, yo, t->>'temporada', (t->>'anio')::integer, v_texto, p_ahora, p_ahora)
        RETURNING id INTO v_id;
    EXCEPTION WHEN unique_violation THEN
        -- Dos envíos a la vez: el otro ganó.
        SELECT id INTO v_id FROM public.gcx_testimonios WHERE autor_id = yo AND group_id = g.id;
        RETURN jsonb_build_object('ok', false, 'motivo', 'ya_publicado', 'id', v_id);
    END;

    RETURN jsonb_build_object('ok', true, 'id', v_id, 'ya_existia', false, 'grupo', g.name);
END;
$function$;

-- El aviso a Sistemas, sin el id en el link.
CREATE OR REPLACE FUNCTION public.testimonios_solicitar_eliminacion(p_id uuid, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    yo       uuid := auth.uid();
    x        record;
    v_motivo text := NULLIF(regexp_replace(COALESCE(p_motivo, ''), '^\s+|\s+$', '', 'g'), '');
    v_vars   jsonb;
    v_admin  record;
BEGIN
    IF yo IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;

    SELECT * INTO x FROM public.gcx_testimonios WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF x.autor_id <> yo THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_es_tuyo');
    END IF;
    IF x.estado = 'eliminacion_solicitada' THEN
        RETURN jsonb_build_object('ok', true, 'ya_solicitado', true);
    END IF;
    IF char_length(v_motivo) > 500 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'motivo_largo', 'limite', 500);
    END IF;

    UPDATE public.gcx_testimonios
       SET estado = 'eliminacion_solicitada',
           estado_antes_del_pedido = x.estado,
           eliminacion_pedida_at = now(),
           eliminacion_motivo = v_motivo,
           decision = NULL, decidido_at = NULL, decidido_por = NULL
     WHERE id = p_id;

    v_vars := jsonb_build_object(
        'nombre', COALESCE((SELECT NULLIF(btrim(name), '') FROM public.users WHERE id = yo), 'Alguien'),
        'grupo',  COALESCE((SELECT name FROM public.groups WHERE id = x.group_id), 'un GCX'));
    FOR v_admin IN
        SELECT id FROM public.users
         WHERE (role)::text = 'SUPER_ADMIN' OR COALESCE(roles, '{}') && ARRAY['SUPER_ADMIN']
    LOOP
        PERFORM public.notif_emitir('testimonios_eliminacion_solicitada', v_admin.id, v_vars);
    END LOOP;

    RETURN jsonb_build_object('ok', true, 'ya_solicitado', false);
END;
$function$;

-- El aviso a la persona, con "fue eliminado".
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


-- ── 2 · Los permisos, como estaban ──────────────────────────────────────────
REVOKE ALL ON FUNCTION public.testimonios_publicar_en(text, text, boolean, timestamptz)
    FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.testimonios_solicitar_eliminacion(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.testimonios_solicitar_eliminacion(uuid, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.testimonios_solicitar_eliminacion(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.testimonios_admin_resolver(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.testimonios_admin_resolver(uuid, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.testimonios_admin_resolver(uuid, text) TO authenticated;


-- ── 3 · La alerta nueva ─────────────────────────────────────────────────────
DO $rb$
DECLARE
    v_avisos integer;
BEGIN
    SELECT count(*) INTO v_avisos FROM public.app_notifications
     WHERE alerta_clave = 'testimonios_nuevo_en_tu_gcx';

    IF v_avisos = 0 THEN
        DELETE FROM public.notif_alertas WHERE clave = 'testimonios_nuevo_en_tu_gcx';
        RAISE NOTICE 'La alerta testimonios_nuevo_en_tu_gcx se borró: nunca avisó nada.';
    ELSE
        UPDATE public.notif_alertas
           SET activa = false, eliminada_at = now()
         WHERE clave = 'testimonios_nuevo_en_tu_gcx';
        RAISE NOTICE 'La alerta testimonios_nuevo_en_tu_gcx quedó marcada eliminada: ya había mandado % avisos.', v_avisos;
    END IF;
END;
$rb$;


-- ── 4 · Cómo quedó ──────────────────────────────────────────────────────────
SELECT (SELECT count(*) FROM public.notif_alertas
         WHERE tipo = 'automatica' AND eliminada_at IS NULL)        AS automaticas_activas,
       (SELECT count(*) FROM public.notif_alertas
         WHERE clave = 'testimonios_nuevo_en_tu_gcx')               AS la_alerta_nueva,
       (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'testimonios_publicar_en'
           AND pg_get_functiondef(p.oid) ILIKE '%nuevo_en_tu_gcx%') AS publicar_todavia_avisa,
       (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'testimonios_admin_resolver'
           AND pg_get_functiondef(p.oid) ILIKE '%se dio de baja%')  AS resolver_todavia_dice_baja;
