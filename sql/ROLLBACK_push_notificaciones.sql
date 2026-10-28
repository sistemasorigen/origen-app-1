-- ════════════════════════════════════════════════════════════════════════════
-- Deshace sql/push_notificaciones.sql.
--
-- Primero el trigger: sin él, los avisos se siguen creando como siempre y
-- nadie llama a send-push. La tabla se borra al final, con las suscripciones
-- (la gente tendría que volver a activar las notificaciones si se reaplica).
-- La Edge Function send-push y los secretos VAPID_* quedan: no hacen nada sin
-- el trigger.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

DROP TRIGGER IF EXISTS trg_app_notifications_push ON public.app_notifications;
DROP FUNCTION IF EXISTS public.app_notifications_push();
DROP FUNCTION IF EXISTS public.push_enviar_prueba();
DROP FUNCTION IF EXISTS public.push_mis_dispositivos();
DROP FUNCTION IF EXISTS public.push_borrar_suscripcion(text);
DROP FUNCTION IF EXISTS public.push_guardar_suscripcion(text, text, text, text, text);
DROP TABLE IF EXISTS public.push_suscripciones;

COMMIT;
