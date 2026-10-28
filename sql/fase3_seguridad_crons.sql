-- ════════════════════════════════════════════════════════════════════════════
-- Los dos crons mandan la clave, el botón del Prode pasa por una RPC, y
-- generate-image lleva cuenta por persona
-- 2026-10-28
--
-- ANTES
--   · cron welcome-form-reminders (jobid 1, lunes 10:00 UTC) llamaba a
--     welcome-reminder SIN ningún encabezado de autorización, y la función no
--     pedía nada: cualquiera, sin sesión, podía dispararla, subirle el
--     contador form_reminder_count a la gente y llenar la casilla de
--     Bienvenida gastando la cuota de Resend.
--   · cron prode-sync-results (jobid 6, cada 5 minutos) mandaba
--     current_setting('app.service_role_key', true) — una variable que NO
--     está seteada en este proyecto, así que el encabezado iba en NULL. La
--     función tampoco pedía nada: cualquiera podía forzar la sincronización
--     con worldcup26.ir y el recálculo de puntos.
--   · El botón "sincronizar" de AdminProde.tsx llamaba a la función directo
--     con el token de la persona, que la función no miraba.
--
-- AHORA
--   · Los dos crons leen webhook_service_role_key de Vault y la mandan como
--     bearer. Las dos funciones comparan contra ORIGEN_SERVICE_ROLE_KEY.
--   · El botón pasa por prode_sincronizar(), que exige sesión y el rol PRODE o
--     SUPER_ADMIN, y encola el pedido con la clave de Vault.
--   · generate_image_usos: una fila por imagen pedida, para el tope de 20 por
--     persona y por día que aplica la función.
--
-- EL CRON DEL PRODE NO SE APAGA (no lo pidió Ignacio). Sigue corriendo cada 5
-- minutos y sigue fallando: 288 llamadas por día, todas con 500 ("API login
-- failed: 404"); en las últimas 6 horas, 72 de 72. Recomendación en el reporte.
--
-- ORDEN: desplegar welcome-reminder, prode-sync-results y generate-image
-- NUEVAS y, en el mismo minuto, esto.
-- Pruebas: sql/PROBAR_fase3_seguridad_crons.sql
-- Deshacer: sql/ROLLBACK_fase3_seguridad_crons.sql
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1 · Las imágenes que pidió cada persona ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.generate_image_usos (
    id         bigserial PRIMARY KEY,
    user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS generate_image_usos_persona_idx
    ON public.generate_image_usos (user_id, created_at);

ALTER TABLE public.generate_image_usos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.generate_image_usos FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.generate_image_usos_id_seq FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.generate_image_usos IS
    'Una fila por imagen pedida a generate-image. Es la cuenta del tope de 20 por persona y por día. Sólo la usa la función, con la clave de servicio.';


-- ── 2 · El cron de los recordatorios de Bienvenida ──────────────────────────
SELECT cron.alter_job(
    job_id := 1,
    command := $cmd$
    SELECT net.http_post(
        url := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/welcome-reminder',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'webhook_service_role_key')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
    );
    $cmd$
);


-- ── 3 · El cron del Prode ───────────────────────────────────────────────────
-- Mismo horario (cada 5 minutos) y mismo timeout. Lo único que cambia es de
-- dónde sale la clave: Vault en vez de una variable que no existe.
SELECT cron.alter_job(
    job_id := 6,
    command := $cmd$
    SELECT net.http_post(
        url := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/prode-sync-results',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'webhook_service_role_key')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
    );
    $cmd$
);


-- ── 4 · El botón de sincronizar del Prode ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.prode_sincronizar()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_key text;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;

    IF NOT public.tiene_rol(ARRAY['PRODE', 'SUPER_ADMIN']) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    SELECT decrypted_secret INTO v_key
      FROM vault.decrypted_secrets
     WHERE name = 'webhook_service_role_key';

    IF v_key IS NULL THEN
        RAISE WARNING '[prode-sync] falta el secreto webhook_service_role_key';
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_secreto');
    END IF;

    PERFORM net.http_post(
        url := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/prode-sync-results',
        body := '{}'::jsonb,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_key
        ),
        timeout_milliseconds := 60000
    );

    -- El envío es asincrónico: acá sólo se sabe que quedó pedido.
    RETURN jsonb_build_object('ok', true, 'pedido', true);
END;
$$;

COMMENT ON FUNCTION public.prode_sincronizar() IS
    'Pide una sincronización del Prode con worldcup26.ir. Exige sesión y el rol PRODE o SUPER_ADMIN, y encola el pedido a prode-sync-results con la clave de Vault. Reemplaza al fetch directo que hacía AdminProde.tsx con el token de la persona (2026-10-28).';


-- ── Permisos ────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.prode_sincronizar() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prode_sincronizar() FROM anon;
GRANT  EXECUTE ON FUNCTION public.prode_sincronizar() TO authenticated;
