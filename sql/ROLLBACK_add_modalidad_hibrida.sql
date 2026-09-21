-- ════════════════════════════════════════════════════════════════════════
-- ROLLBACK de sql/add_modalidad_hibrida.sql
--
-- ⚠️ Borra datos: los grupos marcados como híbridos vuelven a ser
-- presenciales (conservan su dirección) y se pierde cómo fue cada reunión
-- de esos grupos. La asistencia en sí (present_members) no se toca.
--
-- Orden: primero la función, para que ninguna edición intente escribir una
-- columna que ya no existe.
-- ════════════════════════════════════════════════════════════════════════

-- 1. admin_update_group_v2 vuelve a la versión anterior: correr completo
--    sql/fix_host_edit_group_v2.sql (CREATE OR REPLACE, idempotente).

-- 2. Columnas y restricciones
ALTER TABLE public.group_attendance DROP CONSTRAINT IF EXISTS group_attendance_meeting_mode_valido;
ALTER TABLE public.group_attendance DROP COLUMN IF EXISTS meeting_mode;

ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_modalidad_unica;
ALTER TABLE public.groups DROP COLUMN IF EXISTS is_hybrid;

NOTIFY pgrst, 'reload schema';
