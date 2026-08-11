-- ============================================================
-- SEPARAR EL HELPER DE RLS DE TRIBAL WARS (INFLUOS) DEL DE
-- DÍA DEL NIÑO
-- ============================================================
-- `influos_dia_staff_all` reusaba public.is_dianino_staff() —
-- válido mientras los dos sistemas admitían los mismos roles.
-- Dejó de serlo cuando Día del Niño sumó ENCARGADO_NINEZ (ver
-- sql/create_dianino_tables.sql): ese rol no debe tener acceso
-- a los datos de Tribal Wars. Se crea una función propia para
-- Tribal Wars en vez de parametrizar la existente, para que
-- cada sistema pueda evolucionar sus roles sin acoplarse.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_influos_dia_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND (
                u.role::text = ANY (ARRAY['SUPER_ADMIN','PASTOR','ENCARGADO_EVENTOS','INFLUOS'])
             OR u.roles      && ARRAY['SUPER_ADMIN','PASTOR','ENCARGADO_EVENTOS','INFLUOS']
          )
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_influos_dia_staff() TO authenticated;

DROP POLICY IF EXISTS "influos_dia_staff_all" ON public.influos_dia_registrations;

CREATE POLICY "influos_dia_staff_all" ON public.influos_dia_registrations
FOR ALL
TO authenticated
USING (public.is_influos_dia_staff())
WITH CHECK (public.is_influos_dia_staff());


-- ── Verificación ─────────────────────────────────────────────

SELECT policyname, roles, cmd, qual FROM pg_policies
WHERE tablename = 'influos_dia_registrations';

SELECT pg_get_functiondef('public.is_influos_dia_staff()'::regprocedure);

-- Probado de punta a punta contra el proyecto real
-- (oqtumgalnozppqnnjjdb), simulando roles con SET LOCAL ROLE +
-- request.jwt.claims dentro de una transacción con ROLLBACK:
--   Usuario SOLO INFLUOS:
--     - is_influos_dia_staff() → true
--     - INSERT/SELECT/DELETE directo en influos_dia_registrations → OK
--     - SELECT en dianino_sessions (con fila canario real) → 0 filas visibles
--     - INSERT en dianino_sessions → bloqueado por RLS (insufficient_privilege)
--   Usuario SOLO ENCARGADO_NINEZ:
--     - SELECT en influos_dia_registrations → 0 filas visibles
--     - INSERT en influos_dia_registrations → bloqueado por RLS
-- Aislamiento cruzado confirmado en las dos direcciones. Rol del
-- usuario de prueba y datos de prueba revertidos por el ROLLBACK.
