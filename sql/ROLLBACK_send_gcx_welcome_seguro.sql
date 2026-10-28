-- ════════════════════════════════════════════════════════════════════════════
-- DESHACER sql/send_gcx_welcome_seguro.sql
--
-- Deja notify_gcx_welcome() con su cuerpo textual de producción del
-- 2026-10-28 (sacado de pg_get_functiondef), sus permisos tal cual estaban
-- ({postgres,anon,authenticated,service_role} con EXECUTE, PUBLIC sin él) y el
-- trigger con su definición exacta (AFTER UPDATE sin WHEN).
--
-- ⚠️ Vuelve a mandar la inscripción entera —nombre, email, teléfono y DNI— en
-- el cuerpo del pedido. Para deshacer de verdad hay que volver a desplegar la
-- función vieja (commit "chore: versiona 7 edge functions…") Y revertir el
-- cambio de services/supabaseService.ts, que ahora llama a la RPC:
--   npx supabase functions deploy send-gcx-welcome \
--     --project-ref oqtumgalnozppqnnjjdb --use-api --no-verify-jwt
--
-- La tabla gcx_welcome_hechos se deja. Para borrarla, la última línea.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_gcx_welcome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  payload jsonb;
  v_key text;
BEGIN
  IF NEW.status = 'APPROVED' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'webhook_service_role_key';

    payload := jsonb_build_object(
      'type', 'UPDATE',
      'table', 'group_registrations',
      'schema', 'public',
      'record', row_to_json(NEW),
      'old_record', row_to_json(OLD)
    );

    PERFORM net.http_post(
      url := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/send-gcx-welcome',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := payload,
      timeout_milliseconds := 30000
    );
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.notify_gcx_welcome() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.notify_gcx_welcome() TO anon;
GRANT  EXECUTE ON FUNCTION public.notify_gcx_welcome() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.notify_gcx_welcome() TO service_role;

DROP TRIGGER IF EXISTS trigger_gcx_welcome ON public.group_registrations;
CREATE TRIGGER trigger_gcx_welcome AFTER UPDATE ON public.group_registrations
    FOR EACH ROW EXECUTE FUNCTION notify_gcx_welcome();

DROP FUNCTION IF EXISTS public.gcx_reenviar_bienvenida(text[]);

-- DROP TABLE IF EXISTS public.gcx_welcome_hechos;
