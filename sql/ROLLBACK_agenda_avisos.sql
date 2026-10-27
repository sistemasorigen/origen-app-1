-- ════════════════════════════════════════════════════════════════════════════
-- Deshace sql/agenda_avisos.sql: sin triggers, sin funciones y sin la tabla de
-- avisos. Las notificaciones que ya se crearon en app_notifications quedan
-- (son de la gente); los emails que ya salieron, también.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

DROP TRIGGER IF EXISTS trg_agenda_tareas_avisar ON public.agenda_tareas;
DROP TRIGGER IF EXISTS trg_agenda_solicitudes_avisar ON public.agenda_solicitudes;

DROP FUNCTION IF EXISTS public.agenda_tareas_avisar();
DROP FUNCTION IF EXISTS public.agenda_solicitudes_avisar();
DROP FUNCTION IF EXISTS public.agenda_pedir_emails(uuid, text);
DROP FUNCTION IF EXISTS public.agenda_registrar_avisos(uuid, text, uuid[], text, text, text);
DROP FUNCTION IF EXISTS public.agenda_emails_desde();

DROP TABLE IF EXISTS public.agenda_avisos;

COMMIT;
