-- ════════════════════════════════════════════════════════════════════════════
-- DESHACER sql/email_notifier_seguro.sql
--
-- Deja la base exactamente como estaba el 2026-10-28 antes del cambio: la
-- función send_webhook_event() con su cuerpo textual de producción (sacado de
-- pg_get_functiondef), sus permisos tal cual estaban
-- ({postgres,anon,authenticated,service_role} con EXECUTE y PUBLIC sin él), y
-- los cinco triggers con su definición exacta (la de pg_get_triggerdef).
--
-- ⚠️ Esto vuelve a abrir el agujero: send_webhook_event manda la fila entera
-- y sin clave, y la versión vieja de email-notifier acepta cualquier pedido.
-- Para que el rollback sirva de verdad hay que volver a desplegar también la
-- función vieja (el commit "chore: versiona 7 edge functions tal como están en
-- producción"):
--   npx supabase functions deploy email-notifier \
--     --project-ref oqtumgalnozppqnnjjdb --use-api --no-verify-jwt
--
-- La tabla email_notifier_hechos se deja: no molesta a nadie y guarda qué se
-- mandó. Para borrarla, la última línea (comentada).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.send_webhook_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  payload JSONB;
BEGIN
  -- Construct a payload identical to the Supabase native Webhook payload
  payload := json_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', row_to_json(NEW),
    'old_record', row_to_json(OLD)
  );

  -- Perform the async HTTP POST request using pg_net
  PERFORM net.http_post(
    url := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/email-notifier',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := payload
  );

  RETURN NEW;
END;
$function$;

-- Los permisos que tenía (CREATE OR REPLACE vuelve a dar EXECUTE a PUBLIC).
REVOKE EXECUTE ON FUNCTION public.send_webhook_event() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.send_webhook_event() TO anon;
GRANT  EXECUTE ON FUNCTION public.send_webhook_event() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.send_webhook_event() TO service_role;

DROP TRIGGER IF EXISTS on_group_created ON public.groups;
CREATE TRIGGER on_group_created AFTER INSERT ON public.groups
    FOR EACH ROW EXECUTE FUNCTION send_webhook_event();

DROP TRIGGER IF EXISTS on_group_updated_notify ON public.groups;
CREATE TRIGGER on_group_updated_notify AFTER UPDATE ON public.groups
    FOR EACH ROW WHEN (((old.status IS DISTINCT FROM new.status) AND (new.status = 'approved'::text)))
    EXECUTE FUNCTION send_webhook_event();

DROP TRIGGER IF EXISTS on_host_applicant_created ON public.leader_applications;
CREATE TRIGGER on_host_applicant_created AFTER INSERT ON public.leader_applications
    FOR EACH ROW EXECUTE FUNCTION send_webhook_event();

DROP TRIGGER IF EXISTS on_user_role_updated_notify ON public.users;
CREATE TRIGGER on_user_role_updated_notify AFTER UPDATE ON public.users
    FOR EACH ROW WHEN (((NOT (old.roles @> ARRAY['ANFITRION'::text])) AND (new.roles @> ARRAY['ANFITRION'::text])))
    EXECUTE FUNCTION send_webhook_event();

DROP TRIGGER IF EXISTS on_welcome_visitor_created ON public.welcome_visitors;
CREATE TRIGGER on_welcome_visitor_created AFTER INSERT ON public.welcome_visitors
    FOR EACH ROW EXECUTE FUNCTION send_webhook_event();

-- Lo nuevo, que deja de tener sentido.
DROP FUNCTION IF EXISTS public.email_notifier_avisar();

-- DROP TABLE IF EXISTS public.email_notifier_hechos;
