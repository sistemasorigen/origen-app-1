-- ════════════════════════════════════════════════════════════════════════════
-- DESHACER sql/send_dianino_seguro.sql
--
-- Deja notify_dianino_tickets() con su cuerpo textual de producción del
-- 2026-10-28 (sacado de pg_get_functiondef), sus permisos tal cual estaban
-- ({postgres,anon,authenticated,service_role} con EXECUTE, PUBLIC sin él) y el
-- trigger con su definición exacta.
--
-- ⚠️ Vuelve a mandar la fila entera —el email de la familia incluido— en el
-- cuerpo del pedido. Para deshacer de verdad hay que volver a desplegar la
-- función vieja (commit "chore: versiona 7 edge functions…"):
--   npx supabase functions deploy send-dianino-tickets \
--     --project-ref oqtumgalnozppqnnjjdb --use-api --no-verify-jwt
--
-- La tabla dianino_hechos se deja. Para borrarla, la última línea (comentada).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_dianino_tickets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    body := payload,
    timeout_milliseconds := 30000
  );

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.notify_dianino_tickets() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.notify_dianino_tickets() TO anon;
GRANT  EXECUTE ON FUNCTION public.notify_dianino_tickets() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.notify_dianino_tickets() TO service_role;

DROP TRIGGER IF EXISTS trigger_dianino_tickets ON public.dianino_sessions;
CREATE TRIGGER trigger_dianino_tickets AFTER INSERT ON public.dianino_sessions
    FOR EACH ROW EXECUTE FUNCTION notify_dianino_tickets();

-- DROP TABLE IF EXISTS public.dianino_hechos;
