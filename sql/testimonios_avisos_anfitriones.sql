-- ════════════════════════════════════════════════════════════════════════════
-- Avisarle al anfitrión y al co-anfitrión cuando alguien deja un testimonio
-- 2026-11-03 · testimonios de los GCX
--
-- TRES COSAS, pedidas por Ignacio el 2026-11-03.
--
-- A · LA ALERTA NUEVA `testimonios_nuevo_en_tu_gcx`. Hasta ahora quien dirige
--     un GCX no se enteraba de que alguien de su grupo había dejado un
--     testimonio: tenía que entrar a /testimonios a mirar. Ahora le llega, con
--     el link que abre ESE testimonio desplegado y resaltado.
--     La emite `testimonios_publicar_en` cuando se publica uno NUEVO:
--       · al anfitrión (`host_id`) y al co-anfitrión (`co_host_id`);
--       · UNA vez por persona (si fueran la misma cuenta, un aviso);
--       · NUNCA a quien lo escribió (el anfitrión que publica en su propio
--         grupo no se avisa a sí mismo; el co-anfitrión sí recibe);
--       · no al volver a mostrar uno oculto ni al rechazar un pedido: eso no
--         pasa por `publicar`.
--     **Si el aviso falla, el testimonio IGUAL queda publicado**: va en su
--     propio bloque BEGIN … EXCEPTION. Publicar es lo que la persona vino a
--     hacer; avisar es una cortesía y no puede voltearlo.
--     El aviso NO lleva el texto del testimonio: quién y de qué GCX, nada más.
--     El nombre es el que se muestra en la página pública, de
--     `testimonios_nombre_publico` (un menor es "Nombre I.").
--
-- B · EL AVISO A SISTEMAS ABRE EL TESTIMONIO RESALTADO.
--     `testimonios_eliminacion_solicitada` llevaba a /panel-admin?tab=testimonios
--     y había que buscar la tarjeta a mano. Ahora lleva
--     /panel-admin?tab=testimonios&id=<id>, que la pantalla ya sabe resaltar.
--     El id se pasa al emitir, como hace `sistemas_reporte_problema`: la
--     plantilla del catálogo no cambia.
--
-- C · "SE DIO DE BAJA CON ÉXITO". En `testimonios_admin_resolver`, cuando
--     Sistemas ELIMINA un testimonio que tenía pedido, el `{resultado}` del
--     aviso a la persona pasa de "fue eliminado" a "se dio de baja con éxito".
--     Rechazar sigue diciendo "sigue publicado". Cambia el VALOR de la
--     variable, no el mensaje del catálogo: si Sistemas editó el texto desde
--     Gestión de notificaciones, lo editado se respeta.
--
-- Las tres funciones se copian de su definición VIVA en producción
-- (pg_get_functiondef, 2026-11-03) con lo mínimo agregado.
--
-- Pruebas: sql/PROBAR_testimonios_avisos_anfitriones.sql
-- Deshacer: sql/ROLLBACK_testimonios_avisos_anfitriones.sql
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1 · La alerta nueva ─────────────────────────────────────────────────────
-- `type_legacy = 'TESTIMONIO_NUEVO'`: un tipo propio para que la campanita le
-- ponga el globo con la cita (`MessageSquareQuote`) en vez de la campana
-- genérica. El `type` sólo decide el ícono de /notificaciones; nadie filtra ni
-- manda push por él.
-- El destino se pasa al emitir, como en todas las automáticas que llevan a una
-- fila concreta; en el catálogo queda la página, que es el destino estable.
INSERT INTO public.notif_alertas
    (clave, tipo, area, nombre, nombre_publico, descripcion_evento, descripcion_publica,
     destinatario_texto, variables, titulo_plantilla, mensaje_plantilla, url_plantilla,
     type_legacy, permite_apagar)
VALUES (
    'testimonios_nuevo_en_tu_gcx', 'automatica', 'GCX',
    'Nuevo testimonio en tu GCX',
    'Testimonios nuevos en tu GCX',
    'alguien deja un testimonio en un GCX que dirige quien recibe el aviso',
    'Cuando alguien deja un testimonio en un GCX que dirigís.',
    'El anfitrión y el co-anfitrión del GCX',
    ARRAY['nombre', 'grupo'],
    'Nuevo testimonio en tu GCX',
    '{nombre} dejó un testimonio en {grupo}.',
    '/testimonios',
    'TESTIMONIO_NUEVO', true)
ON CONFLICT (clave) DO NOTHING;


-- ── 2 · A · Publicar avisa a quien dirige el GCX ────────────────────────────
CREATE OR REPLACE FUNCTION public.testimonios_publicar_en(
    p_group_id text,
    p_texto text,
    p_consiento boolean,
    p_ahora timestamp with time zone
)
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
    -- Para avisarle a quien dirige el GCX.
    v_nombre text;
    v_quien  uuid;
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
            -- El mismo texto de nuevo (reintento, doble toque): no es un
            -- testimonio nuevo, así que no se vuelve a avisar.
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

    -- El aviso a quien dirige el GCX, en su propio bloque: si falla, el
    -- testimonio ya está publicado y así se queda. La persona vino a publicar.
    BEGIN
        -- El nombre que se muestra en la página pública: un menor, "Nombre I.".
        SELECT public.testimonios_nombre_publico(u.name, u.birth_date, p_ahora)
          INTO v_nombre
          FROM public.users u WHERE u.id = yo;

        -- DISTINCT: anfitrión y co-anfitrión en la misma cuenta es un aviso.
        -- `<> yo`: a quien lo escribió, nunca.
        FOR v_quien IN
            SELECT DISTINCT q FROM unnest(ARRAY[g.host_id, g.co_host_id]) AS q
             WHERE q IS NOT NULL AND q <> yo
        LOOP
            PERFORM public.notif_emitir(
                'testimonios_nuevo_en_tu_gcx', v_quien,
                jsonb_build_object('nombre', COALESCE(v_nombre, 'Alguien'), 'grupo', g.name),
                '/testimonios/' || g.id || '?testimonio=' || v_id::text);
        END LOOP;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[testimonios] el testimonio % quedó publicado, pero no se pudo avisar a los anfitriones de %: %',
            v_id, g.id, SQLERRM;
    END;

    RETURN jsonb_build_object('ok', true, 'id', v_id, 'ya_existia', false, 'grupo', g.name);
END;
$function$;


-- ── 3 · B · El aviso a Sistemas lleva el id ─────────────────────────────────
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
        -- Con el id, la pantalla de moderación resalta la tarjeta y hace
        -- scroll hasta ella: no hay que buscarla entre todas.
        PERFORM public.notif_emitir('testimonios_eliminacion_solicitada', v_admin.id, v_vars,
                                    '/panel-admin?tab=testimonios&id=' || p_id::text);
    END LOOP;

    RETURN jsonb_build_object('ok', true, 'ya_solicitado', false);
END;
$function$;


-- ── 4 · C · "Se dio de baja con éxito" ──────────────────────────────────────
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
                jsonb_build_object('grupo', v_grupo, 'resultado', 'se dio de baja con éxito'));
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


-- ── 5 · Permisos ────────────────────────────────────────────────────────────
-- CREATE OR REPLACE vuelve a darle EXECUTE a PUBLIC (sección 12, regla 3).
-- Las tres quedan como estaban.
--
-- `testimonios_publicar_en` es una gemela `_en`: no la llama nadie de afuera,
-- sólo `testimonios_publicar` (SECURITY DEFINER, con la llave de la página).
REVOKE ALL ON FUNCTION public.testimonios_publicar_en(text, text, boolean, timestamptz)
    FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.testimonios_solicitar_eliminacion(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.testimonios_solicitar_eliminacion(uuid, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.testimonios_solicitar_eliminacion(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.testimonios_admin_resolver(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.testimonios_admin_resolver(uuid, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.testimonios_admin_resolver(uuid, text) TO authenticated;
