-- ════════════════════════════════════════════════════════════════════════════
-- DESHACER sql/notif_preferencias.sql
--
-- Vuelve notif_puede_enviar, notif_alertas_admin y los dos "guardar" a su
-- definición EXACTA de antes (copiada de pg_proc el 2026-10-29, antes de
-- aplicar) y borra lo apagado por la gente, la tabla y las columnas nuevas.
--
-- Lo que quedó en notif_push_log como 'silenciada' pasa a 'pausada' (el
-- CHECK de antes no conoce 'silenciada'): el historial no se pierde.
--
-- ORDEN: correr este archivo y DESPUÉS, si se quiere, volver a desplegar el
-- send-push anterior. Al revés no rompe nada: sin este SQL la base nunca
-- contesta 'silenciada'.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1 · Las funciones, como antes ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notif_puede_enviar(p_notificacion_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    ZONA constant text := 'America/Argentina/Buenos_Aires';
    v_n record;
    v_a record;
    v_hoy timestamptz;
    v_hasta timestamptz;
    v_usados integer;
BEGIN
    SELECT user_id, alerta_clave INTO v_n
      FROM public.app_notifications WHERE id = p_notificacion_id;

    IF NOT FOUND OR v_n.alerta_clave IS NULL THEN
        RETURN jsonb_build_object('decision', 'enviar');
    END IF;

    SELECT activa, no_molestar, no_molestar_desde, no_molestar_hasta, max_por_dia
      INTO v_a
      FROM public.notif_alertas WHERE clave = v_n.alerta_clave;

    -- Una clave que ya no está en el catálogo tampoco frena nada.
    IF NOT FOUND THEN
        RETURN jsonb_build_object('decision', 'enviar');
    END IF;

    IF NOT v_a.activa THEN
        RETURN jsonb_build_object('decision', 'pausada');
    END IF;

    -- El tope, contado sobre lo que REALMENTE salió hoy (hora argentina).
    IF v_a.max_por_dia IS NOT NULL THEN
        v_hoy := (date_trunc('day', now() AT TIME ZONE ZONA)) AT TIME ZONE ZONA;
        SELECT count(*) INTO v_usados
          FROM public.notif_push_log
         WHERE user_id = v_n.user_id
           AND alerta_clave = v_n.alerta_clave
           AND resultado = 'enviado'
           AND enviado_at >= v_hoy;
        IF v_usados >= v_a.max_por_dia THEN
            RETURN jsonb_build_object('decision', 'tope');
        END IF;
    END IF;

    -- No molestar: el push no se pierde, se manda cuando el horario termina.
    IF v_a.no_molestar THEN
        v_hasta := public.notif_no_molestar_hasta(now(), v_a.no_molestar_desde, v_a.no_molestar_hasta);
        IF v_hasta IS NOT NULL THEN
            RETURN jsonb_build_object('decision', 'diferir', 'enviar_en', v_hasta);
        END IF;
    END IF;

    RETURN jsonb_build_object('decision', 'enviar');
END;
$function$;

CREATE OR REPLACE FUNCTION public.notif_alertas_admin()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_personas integer;
BEGIN
    IF auth.uid() IS NULL OR NOT public.tiene_rol(ARRAY['SUPER_ADMIN']) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    SELECT count(DISTINCT p.user_id) INTO v_personas
      FROM public.push_suscripciones p
      JOIN public.users u ON u.id = p.user_id
     WHERE u.is_active IS NOT FALSE;

    RETURN jsonb_build_object(
        'ok', true,
        'personas_con_push', v_personas,
        'alertas', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', a.id,
                'clave', a.clave,
                'tipo', a.tipo,
                'nombre', a.nombre,
                'descripcion_evento', a.descripcion_evento,
                'destinatario_texto', a.destinatario_texto,
                'variables', COALESCE(a.variables, '{}'),
                'titulo_plantilla', a.titulo_plantilla,
                'mensaje_plantilla', a.mensaje_plantilla,
                'url_plantilla', a.url_plantilla,
                'type_legacy', a.type_legacy,
                'activa', a.activa,
                'no_molestar', a.no_molestar,
                'no_molestar_desde', a.no_molestar_desde,
                'no_molestar_hasta', a.no_molestar_hasta,
                'max_por_dia', a.max_por_dia,
                'siempre_activa', a.siempre_activa,
                'desde', a.desde,
                'hasta', a.hasta,
                'cada_n_dias', a.cada_n_dias,
                'horas', a.horas,
                'audiencia_todos', a.audiencia_todos,
                'audiencia_roles', a.audiencia_roles,
                'audiencia_usuarios', a.audiencia_usuarios,
                'updated_at', a.updated_at,
                'enviados_7d', COALESCE((
                    SELECT count(*) FROM public.notif_push_log l
                     WHERE l.alerta_clave = a.clave
                       AND l.resultado = 'enviado'
                       AND l.enviado_at > now() - interval '7 days'), 0),
                'personas_con_push', v_personas
            ) || CASE WHEN a.tipo = 'programada' THEN (
                SELECT jsonb_build_object(
                    'alcance', al->>'alcance',
                    'alcance_detalle', al - 'alcance',
                    'audiencia_personas', au.personas,
                    'audiencia_con_push', au.con_push,
                    'audiencia_detalle', COALESCE((
                        SELECT jsonb_agg(jsonb_build_object('id', u.id, 'nombre', u.name,
                                                            'activa', u.is_active IS NOT FALSE)
                                         ORDER BY lower(COALESCE(u.name, '')))
                          FROM public.users u WHERE u.id = ANY (COALESCE(a.audiencia_usuarios, '{}'))), '[]'::jsonb),
                    'proximo_envio', public.notif_proximo_envio(a.id))
                  FROM public.notif_alcance_programada(a.cada_n_dias, a.horas, a.siempre_activa, a.desde, a.hasta) al,
                       LATERAL (SELECT count(*) AS personas,
                                       count(*) FILTER (WHERE EXISTS (
                                           SELECT 1 FROM public.push_suscripciones p WHERE p.user_id = x.user_id)) AS con_push
                                  FROM public.notif_audiencia(a.audiencia_todos, a.audiencia_roles, a.audiencia_usuarios) x) au
            ) ELSE '{}'::jsonb END
            ORDER BY a.tipo, a.nombre)
            FROM public.notif_alertas a
           WHERE a.eliminada_at IS NULL
        ), '[]'::jsonb));
END;
$function$;


DROP FUNCTION IF EXISTS public.notif_guardar_automatica(uuid, text, text, boolean, boolean, time, time, integer, boolean);
DROP FUNCTION IF EXISTS public.notif_guardar_programada(uuid, text, text, text, text, boolean, date, date, integer, time[], boolean, text[], uuid[], boolean, time, time, integer, boolean, boolean);

CREATE OR REPLACE FUNCTION public.notif_guardar_automatica(p_id uuid, p_titulo text, p_mensaje text, p_activa boolean, p_no_molestar boolean, p_desde time without time zone DEFAULT NULL::time without time zone, p_hasta time without time zone DEFAULT NULL::time without time zone, p_max_por_dia integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_uid uuid := auth.uid();
    v_a record;
    v_titulo  text := btrim(COALESCE(p_titulo, ''));
    v_mensaje text := btrim(COALESCE(p_mensaje, ''));
    v_sueltas text[];
BEGIN
    IF v_uid IS NULL OR NOT public.tiene_rol(ARRAY['SUPER_ADMIN']) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    SELECT * INTO v_a FROM public.notif_alertas WHERE id = p_id AND tipo = 'automatica';
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;

    IF v_titulo = '' OR length(v_titulo) > 120 OR v_mensaje = '' OR length(v_mensaje) > 500 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'texto_invalido');
    END IF;

    -- Sólo las variables de esta alerta: una {que_no_existe} llegaría al
    -- teléfono como un hueco.
    SELECT array_agg(DISTINCT m[1]) INTO v_sueltas
      FROM regexp_matches(v_titulo || ' ' || v_mensaje, '\{([a-z][a-z0-9_]{0,29})\}', 'g') m
     WHERE NOT (m[1] = ANY (COALESCE(v_a.variables, '{}')));
    IF v_sueltas IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'variable_invalida', 'variables', v_sueltas);
    END IF;

    IF p_max_por_dia IS NOT NULL AND p_max_por_dia NOT BETWEEN 1 AND 20 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'tope_invalido');
    END IF;

    IF COALESCE(p_no_molestar, false) AND (p_desde IS NULL OR p_hasta IS NULL OR p_desde = p_hasta) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'horario_invalido');
    END IF;

    UPDATE public.notif_alertas
       SET titulo_plantilla  = v_titulo,
           mensaje_plantilla = v_mensaje,
           activa            = COALESCE(p_activa, true),
           no_molestar       = COALESCE(p_no_molestar, false),
           no_molestar_desde = CASE WHEN COALESCE(p_no_molestar, false) THEN p_desde END,
           no_molestar_hasta = CASE WHEN COALESCE(p_no_molestar, false) THEN p_hasta END,
           max_por_dia       = p_max_por_dia,
           updated_at        = now(),
           updated_by        = v_uid
     WHERE id = p_id;

    RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.notif_guardar_programada(p_id uuid, p_nombre text, p_titulo text, p_mensaje text, p_url text, p_siempre_activa boolean, p_desde date, p_hasta date, p_cada_n_dias integer, p_horas time without time zone[], p_audiencia_todos boolean, p_audiencia_roles text[], p_audiencia_usuarios uuid[], p_no_molestar boolean DEFAULT false, p_nm_desde time without time zone DEFAULT NULL::time without time zone, p_nm_hasta time without time zone DEFAULT NULL::time without time zone, p_max_por_dia integer DEFAULT NULL::integer, p_activa boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    ZONA constant text := 'America/Argentina/Buenos_Aires';
    v_uid     uuid := auth.uid();
    v_id      uuid := COALESCE(p_id, gen_random_uuid());
    v_nombre  text := btrim(COALESCE(p_nombre, ''));
    v_titulo  text := btrim(COALESCE(p_titulo, ''));
    v_mensaje text := btrim(COALESCE(p_mensaje, ''));
    v_url     text := NULLIF(btrim(COALESCE(p_url, '')), '');
    v_siempre boolean := COALESCE(p_siempre_activa, true);
    v_desde   date := COALESCE(p_desde, (now() AT TIME ZONE ZONA)::date);
    v_hasta   date := CASE WHEN COALESCE(p_siempre_activa, true) THEN NULL ELSE p_hasta END;
    v_todos   boolean := COALESCE(p_audiencia_todos, false);
    v_roles   text[];
    v_users   uuid[];
    v_horas   time[];
    v_malos   text[];
    v_malos_u uuid[];
    v_nm      boolean := COALESCE(p_no_molestar, false);
    v_activa  boolean := COALESCE(p_activa, true);
    v_actual  record;
    v_clave   text;
BEGIN
    IF v_uid IS NULL OR NOT public.tiene_rol(ARRAY['SUPER_ADMIN']) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    -- ── El texto ──
    IF length(v_nombre) NOT BETWEEN 1 AND 120 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'texto_invalido', 'campo', 'nombre');
    END IF;
    IF length(v_titulo) NOT BETWEEN 1 AND 60 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'texto_invalido', 'campo', 'titulo');
    END IF;
    IF length(v_mensaje) NOT BETWEEN 1 AND 160 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'texto_invalido', 'campo', 'mensaje');
    END IF;
    -- Texto fijo: una programada no tiene de dónde sacar un {nombre}.
    IF (v_titulo || ' ' || v_mensaje) ~ '\{[^{}]*\}' THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'variable_invalida');
    END IF;
    IF v_url IS NOT NULL AND NOT public.notif_url_interna(v_url) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'url_invalida');
    END IF;

    -- ── La programación ──
    IF NOT v_siempre AND (v_hasta IS NULL OR v_hasta < v_desde) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'fechas_invalidas');
    END IF;
    IF p_cada_n_dias IS NULL OR p_cada_n_dias NOT BETWEEN 1 AND 365 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'frecuencia_invalida');
    END IF;
    -- Al minuto: "10:00:30" es "10:00". Así dos horarios del mismo minuto
    -- cuentan como repetidos.
    SELECT array_agg(make_time(extract(hour FROM h)::int, extract(minute FROM h)::int, 0) ORDER BY h)
      INTO v_horas FROM unnest(p_horas) h;
    IF v_horas IS NULL OR cardinality(v_horas) NOT BETWEEN 1 AND 5 OR array_position(v_horas, NULL) IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'horas_invalidas');
    END IF;
    IF NOT public.notif_horas_ok(v_horas) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'horas_repetidas');
    END IF;

    -- ── La audiencia ──
    IF NOT v_todos THEN
        SELECT array_agg(DISTINCT btrim(r)) INTO v_roles
          FROM unnest(COALESCE(p_audiencia_roles, '{}')) r WHERE btrim(COALESCE(r, '')) <> '';
        SELECT array_agg(DISTINCT u) INTO v_users
          FROM unnest(COALESCE(p_audiencia_usuarios, '{}')) u WHERE u IS NOT NULL;
    END IF;
    IF NOT v_todos AND v_roles IS NULL AND v_users IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'audiencia_vacia');
    END IF;
    SELECT array_agg(r) INTO v_malos FROM unnest(COALESCE(v_roles, '{}')) r
     WHERE NOT (r = ANY (public.notif_roles_validos()));
    IF v_malos IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'rol_invalido', 'roles', v_malos);
    END IF;
    SELECT array_agg(u) INTO v_malos_u FROM unnest(COALESCE(v_users, '{}')) u
     WHERE NOT EXISTS (SELECT 1 FROM public.users x WHERE x.id = u);
    IF v_malos_u IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'usuario_invalido', 'usuarios', v_malos_u);
    END IF;

    -- ── No molestar y tope (las mismas reglas que las automáticas) ──
    IF p_max_por_dia IS NOT NULL AND p_max_por_dia NOT BETWEEN 1 AND 20 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'tope_invalido');
    END IF;
    IF v_nm AND (p_nm_desde IS NULL OR p_nm_hasta IS NULL OR p_nm_desde = p_nm_hasta) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'horario_invalido');
    END IF;

    -- ── Crear o editar ──
    SELECT * INTO v_actual FROM public.notif_alertas WHERE id = v_id FOR UPDATE;

    IF FOUND AND v_actual.tipo <> 'programada' THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_es_programada');
    END IF;
    IF FOUND AND v_actual.eliminada_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'eliminada');
    END IF;

    IF NOT FOUND THEN
        v_clave := 'prog_' || left(replace(v_id::text, '-', ''), 12);
        IF EXISTS (SELECT 1 FROM public.notif_alertas WHERE clave = v_clave) THEN
            v_clave := 'prog_' || replace(v_id::text, '-', '');
        END IF;

        BEGIN
            INSERT INTO public.notif_alertas (
                id, clave, tipo, nombre, variables, titulo_plantilla, mensaje_plantilla,
                url_plantilla, type_legacy, activa, no_molestar, no_molestar_desde,
                no_molestar_hasta, max_por_dia, siempre_activa, desde, hasta, cada_n_dias,
                horas, audiencia_todos, audiencia_roles, audiencia_usuarios, reloj_desde,
                created_by)
            VALUES (
                v_id, v_clave, 'programada', v_nombre, '{}', v_titulo, v_mensaje,
                v_url, 'PROGRAMADA', v_activa, v_nm,
                CASE WHEN v_nm THEN p_nm_desde END, CASE WHEN v_nm THEN p_nm_hasta END,
                p_max_por_dia, v_siempre, v_desde, v_hasta, p_cada_n_dias,
                v_horas, v_todos, COALESCE(v_roles, '{}'), COALESCE(v_users, '{}'), now(),
                v_uid);
        EXCEPTION WHEN unique_violation THEN
            -- Otro pedido con el mismo id ganó la carrera: ya está creada.
            RETURN jsonb_build_object('ok', true, 'id', v_id, 'creada', false);
        END;

        RETURN jsonb_build_object('ok', true, 'id', v_id, 'clave', v_clave, 'creada', true);
    END IF;

    UPDATE public.notif_alertas
       SET nombre             = v_nombre,
           titulo_plantilla   = v_titulo,
           mensaje_plantilla  = v_mensaje,
           url_plantilla      = v_url,
           activa             = v_activa,
           no_molestar        = v_nm,
           no_molestar_desde  = CASE WHEN v_nm THEN p_nm_desde END,
           no_molestar_hasta  = CASE WHEN v_nm THEN p_nm_hasta END,
           max_por_dia        = p_max_por_dia,
           siempre_activa     = v_siempre,
           desde              = v_desde,
           hasta              = v_hasta,
           cada_n_dias        = p_cada_n_dias,
           horas              = v_horas,
           audiencia_todos    = v_todos,
           audiencia_roles    = COALESCE(v_roles, '{}'),
           audiencia_usuarios = COALESCE(v_users, '{}'),
           -- El reloj vuelve a contar si se activó o si cambió cuándo sale.
           reloj_desde = CASE
               WHEN (v_activa AND NOT v_actual.activa)
                 OR v_siempre IS DISTINCT FROM v_actual.siempre_activa
                 OR v_desde IS DISTINCT FROM v_actual.desde
                 OR v_hasta IS DISTINCT FROM v_actual.hasta
                 OR p_cada_n_dias IS DISTINCT FROM v_actual.cada_n_dias
                 OR v_horas IS DISTINCT FROM v_actual.horas
               THEN now() ELSE v_actual.reloj_desde END,
           updated_at = now(),
           updated_by = v_uid
     WHERE id = v_id;

    RETURN jsonb_build_object('ok', true, 'id', v_id, 'clave', v_actual.clave, 'creada', false);
END;
$function$;


REVOKE ALL ON FUNCTION public.notif_puede_enviar(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notif_puede_enviar(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.notif_alertas_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notif_alertas_admin() TO authenticated;
REVOKE ALL ON FUNCTION public.notif_guardar_automatica(uuid, text, text, boolean, boolean, time, time, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notif_guardar_automatica(uuid, text, text, boolean, boolean, time, time, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.notif_guardar_programada(uuid, text, text, text, text, boolean, date, date, integer, time[], boolean, text[], uuid[], boolean, time, time, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notif_guardar_programada(uuid, text, text, text, text, boolean, date, date, integer, time[], boolean, text[], uuid[], boolean, time, time, integer, boolean) TO authenticated;


-- ── 2 · Lo de la persona ────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.notif_mis_preferencias();
DROP FUNCTION IF EXISTS public.notif_silenciar(uuid, boolean);
DROP TABLE IF EXISTS public.notif_silenciadas;


-- ── 3 · El log y las columnas ───────────────────────────────────────────────
UPDATE public.notif_push_log SET resultado = 'pausada' WHERE resultado = 'silenciada';
ALTER TABLE public.notif_push_log DROP CONSTRAINT IF EXISTS notif_push_log_resultado_check;
ALTER TABLE public.notif_push_log ADD CONSTRAINT notif_push_log_resultado_check
    CHECK (resultado IN ('enviado', 'pausada', 'tope', 'diferido', 'fallo', 'prueba'));

ALTER TABLE public.notif_alertas DROP CONSTRAINT IF EXISTS notif_alertas_principal_ok;
ALTER TABLE public.notif_alertas
    DROP COLUMN IF EXISTS principal_id,
    DROP COLUMN IF EXISTS area,
    DROP COLUMN IF EXISTS descripcion_publica,
    DROP COLUMN IF EXISTS nombre_publico,
    DROP COLUMN IF EXISTS permite_apagar;
