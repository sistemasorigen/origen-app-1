-- ════════════════════════════════════════════════════════════════════════
-- VUELTA ATRÁS de sql/asistencia_padron.sql
-- ════════════════════════════════════════════════════════════════════════
--
-- Deja la base como estaba: sin los dos triggers, sin las tres funciones y
-- sin las dos columnas.
--
-- ⚠ Borrar las columnas borra los datos: approved_at y, sobre todo, la foto
-- del padrón de cada reunión, que no se puede reconstruir —después de una
-- baja ya no hay fila de dónde sacarla—. Correr esto sólo si hace falta
-- deshacer de verdad.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

DROP TRIGGER IF EXISTS trg_fijar_padron_reunion ON public.group_attendance;
DROP TRIGGER IF EXISTS trg_fijar_fecha_aprobacion ON public.group_registrations;

DROP FUNCTION IF EXISTS public.fijar_padron_reunion();
DROP FUNCTION IF EXISTS public.fijar_fecha_aprobacion();
DROP FUNCTION IF EXISTS public.padron_de_reunion(text, date);

ALTER TABLE public.group_attendance    DROP COLUMN IF EXISTS expected_members;
ALTER TABLE public.group_registrations DROP COLUMN IF EXISTS approved_at;

COMMIT;
