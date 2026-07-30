-- ============================================================
-- Trigger: AFTER INSERT ON dianino_sessions -> send-dianino-tickets
-- ============================================================
--
-- YA EJECUTADO contra el proyecto real (oqtumgalnozppqnnjjdb).
--
-- Nota de arquitectura: el patrón original de este archivo usaba
-- `current_setting('app.settings.supabase_url', true)` /
-- `current_setting('app.settings.service_role_key', true)`,
-- poblados vía `ALTER DATABASE postgres SET ...`. Eso NO funciona
-- en Supabase hosted: el rol `postgres` que se nos da no es
-- superusuario (`rolsuper = false`), y `ALTER DATABASE ... SET`
-- para un parámetro custom requiere serlo — da
-- "permission denied to set parameter". Confirmado también que
-- el mismo problema afecta a `trigger_gcx_welcome` (ver
-- sql/fix_webhook_triggers_vault.sql).
--
-- Solución real usada: Supabase Vault (extensión `supabase_vault`,
-- ya instalada en este proyecto). El service_role key vive como
-- secreto encriptado en `vault.secrets` bajo el nombre
-- `webhook_service_role_key`, y la función del trigger lo lee de
-- `vault.decrypted_secrets` en vez de `current_setting()`. La URL
-- del proyecto no es sensible, así que va hardcodeada directo.
--
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_dianino_tickets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payload jsonb;
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'webhook_service_role_key';

  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'dianino_sessions',
    'schema', 'public',
    'record', row_to_json(NEW)
  );

  PERFORM net.http_post(
    url := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/send-dianino-tickets',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
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
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'trigger_dianino_tickets';

-- Probado de punta a punta con una sesión sintética (adulto + 1
-- niño, DNIs de test, email @example.com para que Resend la
-- rechace de forma segura sin mandar nada real): el trigger
-- disparó, la Edge Function autenticó bien contra la DB (ya no
-- "Invalid API key"), generó y subió los 2 QR a
-- images/dianino-tickets/, y llegó hasta el llamado a Resend
-- (que rechazó el dominio de test, como se esperaba). Sesión de
-- prueba y los 2 PNG se borraron después de confirmar.
