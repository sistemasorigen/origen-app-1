-- ════════════════════════════════════════════════════════════════════════════
-- Notificaciones push web · que cada aviso de app_notifications llegue también
-- al teléfono o a la compu, aunque la app esté cerrada.
-- 2026-10-28 · ✅ APLICADO el 2026-10-28 (PROBAR_ 15/15 en el ensayo y después de aplicar)
--
-- CÓMO FUNCIONA
--   1 · La app (src/utils/push.ts) suscribe el navegador con la clave VAPID
--       pública y guarda la suscripción con push_guardar_suscripcion().
--   2 · Cada INSERT en app_notifications dispara trg_app_notifications_push,
--       que manda SÓLO el id del aviso a la Edge Function send-push (molde de
--       reportes_sistemas.sql: secreto de Vault, timeout 20000, su propio
--       bloque de excepción). Si esa persona no tiene ninguna suscripción, no
--       se llama a nada.
--   3 · send-push lee el aviso y las suscripciones con la clave de servicio y
--       manda el push (Web Push + VAPID). Borra las suscripciones muertas.
--
-- QUÉ AGREGA
--   · push_suscripciones: RLS prendido, SIN policies y sin privilegios para
--     anon ni authenticated. Sólo se toca por estas RPC y desde send-push.
--   · push_guardar_suscripcion · push_borrar_suscripcion ·
--     push_mis_dispositivos · push_enviar_prueba (authenticated).
--   · app_notifications_push() + trg_app_notifications_push.
--
-- Pruebas: sql/PROBAR_push_notificaciones.sql
-- Deshacer: sql/ROLLBACK_push_notificaciones.sql
-- ORDEN: desplegar la función send-push ANTES de correr esto.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1 · La tabla ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_suscripciones (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    -- La dirección del servicio de push (FCM, Mozilla, Apple, Windows). Única:
    -- un navegador tiene una sola, y si cambia de dueño se reasigna.
    endpoint    text NOT NULL UNIQUE,
    p256dh      text NOT NULL,
    auth        text NOT NULL,
    -- Nada de user-agent completo: sólo lo necesario para mostrar la lista.
    plataforma  text NOT NULL DEFAULT 'otro'
                CHECK (plataforma IN ('ios', 'android', 'escritorio', 'otro')),
    navegador   text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    last_ok_at  timestamptz,
    fallos      integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS push_suscripciones_user_idx ON public.push_suscripciones (user_id, created_at DESC);

ALTER TABLE public.push_suscripciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_suscripciones FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.push_suscripciones IS
    'Dispositivos con notificaciones push activas. Sin policies: sólo RPC push_* y la Edge Function send-push.';


-- ── 2 · Guardar la suscripción de este navegador ────────────────────────────
-- Sólo servicios de push conocidos: la función send-push hace un POST a esta
-- dirección, y sin el filtro cualquiera con sesión podría hacerla llamar a
-- cualquier URL.
CREATE OR REPLACE FUNCTION public.push_guardar_suscripcion(
    p_endpoint   text,
    p_p256dh     text,
    p_auth       text,
    p_plataforma text,
    p_navegador  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_plataforma text := CASE WHEN p_plataforma IN ('ios', 'android', 'escritorio') THEN p_plataforma ELSE 'otro' END;
    v_navegador text := NULLIF(left(btrim(COALESCE(p_navegador, '')), 40), '');
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;

    IF p_endpoint IS NULL OR length(p_endpoint) > 1000
       OR p_endpoint !~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com|web\.push\.apple\.com|[a-z0-9.-]+\.push\.apple\.com)/'
    THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'endpoint_invalido');
    END IF;

    IF COALESCE(length(p_p256dh), 0) NOT BETWEEN 20 AND 200
       OR COALESCE(length(p_auth), 0) NOT BETWEEN 8 AND 100 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'claves_invalidas');
    END IF;

    -- Si el navegador ya estaba guardado, se actualiza; si era de OTRA persona
    -- (un celular compartido), pasa a quien tiene la sesión ahora y vuelve a
    -- contar como nuevo. clock_timestamp() y no now(): el orden de "la más
    -- vieja" tiene que ser real aunque se guarden varias en una transacción.
    INSERT INTO public.push_suscripciones (user_id, endpoint, p256dh, auth, plataforma, navegador, created_at)
    VALUES (v_uid, p_endpoint, p_p256dh, p_auth, v_plataforma, v_navegador, clock_timestamp())
    ON CONFLICT (endpoint) DO UPDATE SET
        user_id    = EXCLUDED.user_id,
        p256dh     = EXCLUDED.p256dh,
        auth       = EXCLUDED.auth,
        plataforma = EXCLUDED.plataforma,
        navegador  = EXCLUDED.navegador,
        fallos     = 0,
        created_at = CASE WHEN push_suscripciones.user_id = EXCLUDED.user_id
                          THEN push_suscripciones.created_at ELSE EXCLUDED.created_at END;

    -- Diez por persona como mucho: la más vieja sale.
    DELETE FROM public.push_suscripciones
     WHERE id IN (
        SELECT id FROM public.push_suscripciones
         WHERE user_id = v_uid
         ORDER BY created_at DESC, id
        OFFSET 10
     );

    RETURN jsonb_build_object('ok', true);
END;
$$;


-- ── 3 · Borrar la de este navegador (al apagar o al cerrar sesión) ──────────
CREATE OR REPLACE FUNCTION public.push_borrar_suscripcion(p_endpoint text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    n integer;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    -- Sólo la propia: la ajena no se toca aunque se sepa su dirección.
    DELETE FROM public.push_suscripciones WHERE endpoint = p_endpoint AND user_id = v_uid;
    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN jsonb_build_object('ok', true, 'borradas', n);
END;
$$;


-- ── 4 · Mis dispositivos (sin las claves) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.push_mis_dispositivos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    RETURN jsonb_build_object('ok', true, 'dispositivos', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                   'plataforma', plataforma,
                   'navegador',  navegador,
                   'created_at', created_at,
                   'last_ok_at', last_ok_at
               ) ORDER BY created_at DESC)
          FROM public.push_suscripciones
         WHERE user_id = v_uid
    ), '[]'::jsonb));
END;
$$;


-- ── 5 · Notificación de prueba, sólo para quien la pide ─────────────────────
-- Crea un aviso común (type PUSH_PRUEBA) para la propia persona: el trigger de
-- abajo lo manda como push, igual que cualquier otro. Cinco por día (hora
-- argentina), contadas sobre los avisos de prueba.
CREATE OR REPLACE FUNCTION public.push_enviar_prueba()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_hoy timestamptz := date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires';
    n integer;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.push_suscripciones WHERE user_id = v_uid) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_dispositivos');
    END IF;

    SELECT count(*) INTO n FROM public.app_notifications
     WHERE user_id = v_uid AND type = 'PUSH_PRUEBA' AND created_at >= v_hoy;
    IF n >= 5 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'tope', 'quedan', 0);
    END IF;

    INSERT INTO public.app_notifications (user_id, title, message, type, action_url)
    VALUES (v_uid, 'Notificación de prueba',
            'Si ves esto, las notificaciones de Origen llegan a este dispositivo.',
            'PUSH_PRUEBA', '/notificaciones');

    RETURN jsonb_build_object('ok', true, 'quedan', 4 - n);
END;
$$;


-- ── 6 · El trigger: cada aviso nuevo, al push ───────────────────────────────
-- Mismo molde que reportes_problemas_email: sólo el id viaja (en la cola de
-- pg_net no queda ni el texto ni a quién va) y el envío va en su propio
-- bloque: si pg_net falla, el aviso se crea igual.
CREATE OR REPLACE FUNCTION public.app_notifications_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key text;
BEGIN
    -- Sin ningún dispositivo suscripto no hay a quién mandarle: no se gasta
    -- una llamada. Es el caso de casi todos los avisos hoy.
    IF NOT EXISTS (SELECT 1 FROM public.push_suscripciones WHERE user_id = NEW.user_id) THEN
        RETURN NULL;
    END IF;

    BEGIN
        SELECT decrypted_secret INTO v_key
          FROM vault.decrypted_secrets
         WHERE name = 'webhook_service_role_key';

        IF v_key IS NULL THEN
            RAISE WARNING '[push] falta el secreto webhook_service_role_key: sin push para %', NEW.id;
            RETURN NULL;
        END IF;

        PERFORM net.http_post(
            url := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/send-push',
            body := jsonb_build_object('notificacion_id', NEW.id),
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || v_key
            ),
            timeout_milliseconds := 20000
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[push] no se pudo encolar el push de %: %', NEW.id, SQLERRM;
    END;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_app_notifications_push ON public.app_notifications;
CREATE TRIGGER trg_app_notifications_push
    AFTER INSERT ON public.app_notifications
    FOR EACH ROW
    WHEN (NEW.user_id IS NOT NULL)
    EXECUTE FUNCTION public.app_notifications_push();


-- ── Permisos ────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.push_guardar_suscripcion(text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.push_borrar_suscripcion(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.push_mis_dispositivos() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.push_enviar_prueba() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_notifications_push() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_guardar_suscripcion(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.push_borrar_suscripcion(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.push_mis_dispositivos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.push_enviar_prueba() TO authenticated;

COMMENT ON FUNCTION public.push_guardar_suscripcion(text, text, text, text, text) IS
    'Guarda la suscripción push de este navegador para quien tiene la sesión (si era de otra persona, pasa a ésta). Máximo 10 por persona.';
COMMENT ON FUNCTION public.push_borrar_suscripcion(text) IS
    'Borra la suscripción push de este navegador, sólo si es propia.';
COMMENT ON FUNCTION public.push_mis_dispositivos() IS
    'Los dispositivos con push de quien tiene la sesión, sin las claves.';
COMMENT ON FUNCTION public.push_enviar_prueba() IS
    'Crea un aviso PUSH_PRUEBA para quien lo pide (máx. 5 por día) y el trigger lo manda como push.';
