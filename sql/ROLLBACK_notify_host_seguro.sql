-- ════════════════════════════════════════════════════════════════════════════
-- Deshace sql/notify_host_seguro.sql: vuelve EXACTAMENTE a las definiciones
-- que había en producción el 2026-10-28 (copiadas con pg_get_functiondef y
-- pg_get_triggerdef antes de cambiarlas).
--
-- ¡OJO! Esto vuelve a mandar la fila entera y SIN clave. Sólo sirve junto
-- con la función notify-host VIEJA (la del commit "chore: versiona
-- notify-host tal como está en producción"), que no pide clave. Con la
-- función nueva desplegada, estos pedidos darían 401 y no saldría ningún
-- aviso.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE OR REPLACE FUNCTION public.trigger_notify_host_registration_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM net.http_post(
    url     := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/notify-host',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := jsonb_build_object(
                 'type',       TG_OP,
                 'table',      TG_TABLE_NAME,
                 'schema',     TG_TABLE_SCHEMA,
                 'record',     to_jsonb(NEW),
                 'old_record', NULL
               )
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_notify_host_group_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM net.http_post(
    url     := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/notify-host',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := jsonb_build_object(
                 'type',       TG_OP,
                 'table',      TG_TABLE_NAME,
                 'schema',     TG_TABLE_SCHEMA,
                 'record',     to_jsonb(NEW),
                 'old_record', to_jsonb(OLD)
               )
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS notify_host_new_registration ON public.group_registrations;
CREATE TRIGGER notify_host_new_registration AFTER INSERT ON public.group_registrations FOR EACH ROW EXECUTE FUNCTION trigger_notify_host_registration_insert();

DROP TRIGGER IF EXISTS notify_host_group_approved ON public.groups;
CREATE TRIGGER notify_host_group_approved AFTER UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION trigger_notify_host_group_update();

-- Los permisos de antes, tal cual (proacl del 2026-10-28):
-- {postgres, anon, authenticated, service_role} con EXECUTE; PUBLIC sin.
REVOKE ALL ON FUNCTION public.trigger_notify_host_registration_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trigger_notify_host_group_update() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trigger_notify_host_registration_insert() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.trigger_notify_host_group_update() TO anon, authenticated, service_role;

DROP TABLE IF EXISTS public.notify_host_hechos;

COMMIT;
