-- ════════════════════════════════════════════════════════════════════════════
-- DESHACER sql/fase3_seguridad_crons.sql
--
-- Devuelve los dos crons a su comando textual exacto del 2026-10-28 (sacado de
-- cron.job) y borra la RPC del botón del Prode.
--
-- ⚠️ El cron de Bienvenida vuelve a llamar sin ninguna clave, y el del Prode
-- vuelve a mandar current_setting('app.service_role_key', true), que en este
-- proyecto no está seteada (el encabezado va en NULL). Para deshacer de verdad
-- hay que volver a desplegar las tres funciones viejas (commit "chore:
-- versiona 7 edge functions…") Y revertir pages/prode/AdminProde.tsx, que
-- ahora llama a la RPC:
--   npx supabase functions deploy welcome-reminder    --project-ref oqtumgalnozppqnnjjdb --use-api --no-verify-jwt
--   npx supabase functions deploy prode-sync-results  --project-ref oqtumgalnozppqnnjjdb --use-api --no-verify-jwt
--   npx supabase functions deploy generate-image      --project-ref oqtumgalnozppqnnjjdb --use-api
--
-- La tabla generate_image_usos se deja. Para borrarla, la última línea.
-- ════════════════════════════════════════════════════════════════════════════

SELECT cron.alter_job(
    job_id := 1,
    command := $cmd$
    SELECT net.http_post(
        url := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/welcome-reminder',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
    );
    $cmd$
);

SELECT cron.alter_job(
    job_id := 6,
    command := $cmd$
    SELECT net.http_post(
        url := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/prode-sync-results',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
    );
    $cmd$
);

DROP FUNCTION IF EXISTS public.prode_sincronizar();

-- DROP TABLE IF EXISTS public.generate_image_usos;
