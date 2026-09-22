-- ════════════════════════════════════════════════════════════════════════
-- URGENTE — "Completá tu perfil" fallaba para todo el mundo
-- 2026-09-22
--
-- Síntoma: al guardar el modal de completar perfil (teléfono, fecha de
-- nacimiento y sexo) salía "Error al guardar. Por favor intenta de nuevo."
-- una y otra vez. Sin ese paso no se puede usar la app ni inscribirse.
--
-- Causa: la policy users_update_self_no_role tiene en su WITH CHECK una
-- subconsulta a la propia tabla users:
--     role  = (SELECT role  FROM users WHERE id = auth.uid())
--     roles = (SELECT roles FROM users WHERE id = auth.uid())
-- Evaluar esa subconsulta obliga a aplicar de nuevo las policies de users,
-- y Postgres corta con 42P17 "infinite recursion detected in policy for
-- relation users". Reproducido como la usuaria del reporte: el SELECT de su
-- fila anda, y el UPDATE muere con ese error. Los admins no lo veían porque
-- entran por la policy "Admins pueden ver todo" (FOR ALL, is_admin()).
--
-- Por qué se puede borrar sin perder protección:
--   · La policy ya no protegía nada: las policies permisivas se combinan con
--     OR, y nuclear_update_own, "Usuarios pueden actualizar su propio perfil"
--     y users_update_self sólo piden id = auth.uid(). Está escrito en el
--     encabezado de sql/auditoria_2026-09_fase1_seguridad.sql.
--   · Lo que hoy protege role, roles, volunteer_roles, coordinator_*,
--     linked_group_id, assigned_category, is_active y email es el trigger
--     BEFORE proteger_columnas_de_rol, que pisa esas columnas con OLD para
--     cualquiera que no sea SUPER_ADMIN. Eso lo agregó la fase 1 de la
--     auditoría, después de que esta policy ya existiera.
--
-- Probado antes de aplicar, en un bloque deshecho con RAISE: con la policy
-- borrada, el UPDATE del modal afecta 1 fila y un UPDATE que intenta
-- role = 'SUPER_ADMIN' deja el rol en VIEWER (lo neutraliza el trigger).
-- ════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS users_update_self_no_role ON public.users;


-- ════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ════════════════════════════════════════════════════════════════════════

-- A) La policy ya no está y quedan las otras tres de UPDATE
SELECT cmd, policyname, qual, with_check
FROM pg_policies WHERE tablename = 'users' ORDER BY cmd, policyname;

-- B) El trigger que protege los roles sigue activo
SELECT tgname, tgenabled FROM pg_trigger
WHERE tgrelid = 'public.users'::regclass AND NOT tgisinternal;
-- Esperado: proteger_columnas_de_rol con tgenabled = 'O'

-- C) Ninguna otra policy de users se consulta a sí misma (esto es lo que
-- provoca el 42P17). Esperado: 0 filas.
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'users'
  AND (COALESCE(qual, '') LIKE '%FROM users%' OR COALESCE(with_check, '') LIKE '%FROM users%');


-- ════════════════════════════════════════════════════════════════════════
-- ROLLBACK (vuelve a romper el guardado de perfil; sólo por si hiciera falta)
-- ════════════════════════════════════════════════════════════════════════
-- CREATE POLICY users_update_self_no_role ON public.users
--   AS PERMISSIVE FOR UPDATE TO PUBLIC
--   USING (id = auth.uid())
--   WITH CHECK (role  = (SELECT users_1.role  FROM users users_1 WHERE users_1.id = auth.uid())
--           AND roles = (SELECT users_1.roles FROM users users_1 WHERE users_1.id = auth.uid()));
