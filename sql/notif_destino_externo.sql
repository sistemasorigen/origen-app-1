-- ════════════════════════════════════════════════════════════════════════════
-- GESTIÓN DE NOTIFICACIONES · las programadas pueden abrir una dirección
-- 2026-10-29 · pedido de Ignacio después del prompt 4
-- ✅ APLICADO el 2026-10-29 (23:01 UTC). PROBAR_ 13/13 contra producción;
--    programadas 93/93, prueba 18/18, preferencias 36/36 y catálogo 77/77.
--
-- QUÉ CAMBIA
--   Hasta ahora una programada sólo podía abrir una pantalla de la app ("un
--   push de Origen nunca abre un link de afuera", prompt 3). Ignacio pidió que
--   también pueda abrir una dirección escrita a mano: una ruta de la app
--   ("/gcx") o una página de afuera ("https://…").
--
--   · notif_url_externa(): sólo https://, con dominio, sin espacios, sin
--     barras invertidas ni caracteres de control, hasta 500.
--   · notif_url_destino() = interna (notif_url_interna, sin cambios) o externa.
--   · La usan SÓLO las tres funciones de Sistemas: notif_guardar_programada,
--     notif_programada_emitir y notif_probar_texto. Son las únicas que escribe
--     un SUPER_ADMIN.
--
-- LO QUE NO CAMBIA
--   crear_aviso (lo que llama la app con sesión) y notif_emitir_texto (el
--   emisor de las automáticas) siguen aceptando SÓLO rutas internas: nadie
--   que no sea Sistemas puede hacer que un aviso abra un link de afuera.
--
-- ORDEN: este archivo, después send-push (armado.ts deja pasar https://) y el
-- frontend con el service worker (npm run deploy). En cualquier otro orden no
-- se rompe nada: lo que todavía no conoce https:// lleva al inicio.
--
-- Pruebas: sql/PROBAR_notif_destino_externo.sql · Deshacer: sql/ROLLBACK_notif_destino_externo.sql
-- ════════════════════════════════════════════════════════════════════════════


-- ── ¿Es una página de afuera aceptable? ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notif_url_externa(p_url text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
    SELECT p_url IS NOT NULL
       AND p_url ~* '^https://[a-z0-9]([a-z0-9-]*[a-z0-9])?([.][a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:[0-9]{1,5})?([/?#][^[:space:][:cntrl:]]*)?$'
       AND strpos(p_url, chr(92)) = 0   -- sin barra invertida
       AND length(p_url) <= 500;
$fn$;

-- ── Lo que puede abrir una programada: una ruta de la app o una página https ─
CREATE OR REPLACE FUNCTION public.notif_url_destino(p_url text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
    SELECT public.notif_url_interna(p_url) OR public.notif_url_externa(p_url);
$fn$;


-- ── Las tres funciones de Sistemas (copiadas de producción el 2026-10-29) ───
-- El único cambio en cada una: notif_url_interna → notif_url_destino.

CREATE OR REPLACE FUNCTION public.notif_guardar_programada(p_id uuid, p_nombre text, p_titulo text, p_mensaje text, p_url text, p_siempre_activa boolean, p_desde date, p_hasta date, p_cada_n_dias integer, p_horas time without time zone[], p_audiencia_todos boolean, p_audiencia_roles text[], p_audiencia_usuarios uuid[], p_no_molestar boolean DEFAULT false, p_nm_desde time without time zone DEFAULT NULL::time without time zone, p_nm_hasta time without time zone DEFAULT NULL::time without time zone, p_max_por_dia integer DEFAULT NULL::integer, p_activa boolean DEFAULT true, p_permite_apagar boolean DEFAULT NULL::boolean)
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

    IF v_url IS NOT NULL AND NOT public.notif_url_destino(v_url) THEN

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

                created_by, permite_apagar)

            VALUES (

                v_id, v_clave, 'programada', v_nombre, '{}', v_titulo, v_mensaje,

                v_url, 'PROGRAMADA', v_activa, v_nm,

                CASE WHEN v_nm THEN p_nm_desde END, CASE WHEN v_nm THEN p_nm_hasta END,

                p_max_por_dia, v_siempre, v_desde, v_hasta, p_cada_n_dias,

                v_horas, v_todos, COALESCE(v_roles, '{}'), COALESCE(v_users, '{}'), now(),

                v_uid, COALESCE(p_permite_apagar, true));

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

           permite_apagar     = COALESCE(p_permite_apagar, v_actual.permite_apagar),

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


CREATE OR REPLACE FUNCTION public.notif_programada_emitir(p_hecha uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_h record;
    v_a record;
    v_ids uuid[];
    v_n integer;
    v_envio uuid;
    v_push integer;
    v_url text;
BEGIN
    SELECT * INTO v_h FROM public.notif_programadas_hechas WHERE id = p_hecha;
    SELECT * INTO v_a FROM public.notif_alertas WHERE id = v_h.alerta_id;

    SELECT array_agg(x.user_id) INTO v_ids
      FROM public.notif_audiencia(v_a.audiencia_todos, v_a.audiencia_roles, v_a.audiencia_usuarios) x;
    v_n := COALESCE(cardinality(v_ids), 0);

    IF v_n = 0 THEN
        UPDATE public.notif_programadas_hechas SET resultado = 'sin_audiencia', personas = 0, con_push = 0
         WHERE id = p_hecha;
        RETURN jsonb_build_object('resultado', 'sin_audiencia', 'personas', 0);
    END IF;

    IF v_n > public.notif_tope_por_emision() THEN
        RAISE WARNING '[notif] % iba a % personas (tope %): no se emitió', v_a.clave, v_n, public.notif_tope_por_emision();
        UPDATE public.notif_programadas_hechas SET resultado = 'excedida', personas = v_n
         WHERE id = p_hecha;
        RETURN jsonb_build_object('resultado', 'excedida', 'personas', v_n);
    END IF;

    v_envio := gen_random_uuid();
    v_url := CASE WHEN public.notif_url_destino(v_a.url_plantilla) THEN v_a.url_plantilla END;

    INSERT INTO public.notif_lotes (envio_id, alerta_clave, personas) VALUES (v_envio, v_a.clave, v_n);

    WITH nuevos AS (
        INSERT INTO public.app_notifications (user_id, title, message, type, action_url, alerta_clave, envio_id)
        SELECT x, v_a.titulo_plantilla, v_a.mensaje_plantilla, 'PROGRAMADA', v_url, v_a.clave, v_envio
          FROM unnest(v_ids) x
        RETURNING id, user_id
    ), encolados AS (
        INSERT INTO public.notif_lote_cola (notificacion_id, envio_id)
        SELECT n.id, v_envio FROM nuevos n
         WHERE EXISTS (SELECT 1 FROM public.push_suscripciones p WHERE p.user_id = n.user_id)
        RETURNING 1
    )
    SELECT count(*) INTO v_push FROM encolados;

    UPDATE public.notif_lotes SET con_push = v_push,
                                  terminado_at = CASE WHEN v_push = 0 THEN now() END
     WHERE envio_id = v_envio;
    UPDATE public.notif_programadas_hechas
       SET resultado = 'emitida', envio_id = v_envio, personas = v_n, con_push = v_push
     WHERE id = p_hecha;

    -- Un solo pedido a send-push por emisión, y ninguno si nadie tiene
    -- dispositivo (no habría a quién mandarle).
    IF v_push > 0 THEN
        PERFORM public.notif_lote_encolar(v_envio);
    END IF;

    RETURN jsonb_build_object('resultado', 'emitida', 'envio_id', v_envio, 'personas', v_n, 'con_push', v_push);
END;
$function$;


CREATE OR REPLACE FUNCTION public.notif_probar_texto(p_titulo text, p_mensaje text, p_url text DEFAULT NULL::text, p_alerta_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    ZONA constant text := 'America/Argentina/Buenos_Aires';
    TOPE constant integer := 10;
    v_uid uuid := auth.uid();
    v_hoy timestamptz := date_trunc('day', now() AT TIME ZONE ZONA) AT TIME ZONE ZONA;
    v_titulo text := btrim(COALESCE(p_titulo, ''));
    v_mensaje text := btrim(COALESCE(p_mensaje, ''));
    v_url text := NULLIF(btrim(COALESCE(p_url, '')), '');
    v_tipo text;
    v_clave text;
    v_id uuid;
    n integer;
BEGIN
    IF v_uid IS NULL OR NOT public.tiene_rol(ARRAY['SUPER_ADMIN']) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    IF v_titulo = '' OR length(v_titulo) > 120 OR v_mensaje = '' OR length(v_mensaje) > 500 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'texto_invalido');
    END IF;
    IF v_url IS NOT NULL AND NOT public.notif_url_destino(v_url) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'url_invalida');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.push_suscripciones WHERE user_id = v_uid) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_dispositivos');
    END IF;

    SELECT count(*) INTO n FROM public.notif_push_log
     WHERE user_id = v_uid AND resultado = 'prueba' AND enviado_at >= v_hoy;
    IF n >= TOPE THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'tope', 'quedan', 0);
    END IF;

    SELECT type_legacy, clave INTO v_tipo, v_clave
      FROM public.notif_alertas WHERE id = p_alerta_id AND eliminada_at IS NULL;

    v_titulo  := public.notif_render(v_titulo,  public.notif_ejemplos(), 120);
    v_mensaje := public.notif_render(v_mensaje, public.notif_ejemplos(), 500);
    IF v_titulo = '' OR v_mensaje = '' THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'texto_invalido');
    END IF;

    -- A quien la pide y a nadie más. Sin alerta_clave ni envio_id: el trigger
    -- de push la manda como un aviso suelto.
    INSERT INTO public.app_notifications (user_id, title, message, type, action_url, creado_por)
    VALUES (v_uid, v_titulo, v_mensaje, COALESCE(v_tipo, 'PROGRAMADA'), v_url, v_uid)
    RETURNING id INTO v_id;

    INSERT INTO public.notif_push_log (notificacion_id, alerta_clave, user_id, resultado)
    VALUES (v_id, v_clave, v_uid, 'prueba');

    RETURN jsonb_build_object('ok', true, 'quedan', TOPE - 1 - n, 'titulo', v_titulo, 'mensaje', v_mensaje);
END;
$function$;



-- ── Permisos ────────────────────────────────────────────────────────────────
-- CREATE OR REPLACE vuelve a darle EXECUTE a PUBLIC (sección 12, regla 3).
REVOKE ALL ON FUNCTION public.notif_url_externa(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_url_destino(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_programada_emitir(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_guardar_programada(uuid, text, text, text, text, boolean, date, date, integer, time[], boolean, text[], uuid[], boolean, time, time, integer, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notif_guardar_programada(uuid, text, text, text, text, boolean, date, date, integer, time[], boolean, text[], uuid[], boolean, time, time, integer, boolean, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.notif_probar_texto(text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notif_probar_texto(text, text, text, uuid) TO authenticated;
