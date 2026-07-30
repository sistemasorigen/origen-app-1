-- ============================================================
-- Trigger: AFTER INSERT ON dianino_sessions -> send-dianino-tickets
-- ============================================================
--
-- ⚠️ BLOQUEADO — NO EJECUTADO TODAVÍA.
--
-- Al correr el chequeo de PASO 3 contra el proyecto real
-- (oqtumgalnozppqnnjjdb / "Origen Iglesia") el resultado fue:
--
--   supabase_url        -> NULL
--   has_service_role_key -> false
--
-- Confirmado también contra pg_db_role_setting (no es un
-- artefacto de rol/sesión — a nivel de base de datos, el único
-- setting `app.settings.*` configurado es `app.settings.jwt_exp`.
-- No existen `app.settings.supabase_url` ni
-- `app.settings.service_role_key`):
--
--   SELECT r.rolname, d.datname, s.setconfig
--   FROM pg_db_role_setting s
--   LEFT JOIN pg_roles r ON r.oid = s.setrole
--   LEFT JOIN pg_database d ON d.oid = s.setdatabase
--   WHERE EXISTS (SELECT 1 FROM unnest(s.setconfig) cfg WHERE cfg LIKE 'app.settings%');
--   -- => [{ rolname: null, datname: "postgres", setconfig: ["app.settings.jwt_exp=3600"] }]
--
-- Esto significa que CUALQUIER trigger existente que use este
-- mismo patrón (ej. `trigger_gcx_welcome` en
-- sql/migrate_edge_function_webhook.sql) está construyendo un
-- `url` NULL en su net.http_post (NULL || texto = NULL en
-- Postgres) y probablemente ya está fallando en silencio. Vale
-- la pena auditar esos triggers aparte de este prompt.
--
-- Además, probando la Edge Function `send-dianino-tickets` ya
-- desplegada con una sesión de prueba real, la query interna a
-- `dianino_tickets` devolvió el error de Postgres/PostgREST
-- "Invalid API key" — o sea que el secret `ORIGEN_SERVICE_ROLE_KEY`
-- configurado en Edge Functions (Dashboard > Edge Functions >
-- Secrets) TAMBIÉN está mal — probablemente la misma causa raíz
-- (una service_role key vieja/rotada) afecta ambos lugares.
--
-- Antes de correr el CREATE TRIGGER de abajo, resolver en el
-- Dashboard de Supabase:
--   1. Settings > API > copiar el `service_role` key vigente.
--   2. Edge Functions > Secrets > actualizar `ORIGEN_SERVICE_ROLE_KEY`
--      con ese valor.
--   3. Correr acá (con el valor real, no un placeholder):
--        ALTER DATABASE postgres SET app.settings.supabase_url = 'https://oqtumgalnozppqnnjjdb.supabase.co';
--        ALTER DATABASE postgres SET app.settings.service_role_key = '<service_role key real>';
--   4. Volver a correr el chequeo de abajo y confirmar que
--      ambas columnas ya no dan NULL/false.
--
-- ============================================================


-- Chequeo previo — repetir después de aplicar la config de arriba.
SELECT current_setting('app.settings.supabase_url', true) AS supabase_url,
       current_setting('app.settings.service_role_key', true) IS NOT NULL AS has_service_role_key;


-- ── Trigger (ejecutar recién cuando el chequeo de arriba dé bien) ──

CREATE OR REPLACE FUNCTION public.notify_dianino_tickets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payload jsonb;
BEGIN
  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'dianino_sessions',
    'schema', 'public',
    'record', row_to_json(NEW)
  );

  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-dianino-tickets',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := payload
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trigger_dianino_tickets" ON public.dianino_sessions;

CREATE TRIGGER "trigger_dianino_tickets"
  AFTER INSERT ON public.dianino_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_dianino_tickets();

-- Verificación:
SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_dianino_tickets';
