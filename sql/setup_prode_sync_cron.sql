-- Extensiones (ya deben estar activas)
CREATE EXTENSION IF NOT EXISTS pg_cron
    WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net
    WITH SCHEMA extensions;

-- Guardar credenciales de la API externa en app_config
-- El admin las configura una vez desde el panel
-- (se guardan encriptadas en app_config, no en código)

-- Cron: cada 5 minutos durante el Mundial
-- (11 Jun – 19 Jul 2026)
SELECT cron.schedule(
    'prode-sync-results',
    '*/5 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/prode-sync-results',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' ||
                current_setting('app.service_role_key', true)
        ),
        body := '{}'::jsonb
    );
    $$
);

-- Verificar
SELECT jobname, schedule
FROM cron.job
WHERE jobname = 'prode-sync-results';
