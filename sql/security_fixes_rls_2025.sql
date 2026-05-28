-- ================================================================
-- SECURITY FIXES — RLS Hardening Migration
-- Ejecutar en Supabase SQL Editor (en orden)
-- ================================================================

-- ----------------------------------------------------------------
-- FIX 1 (CRÍTICO): Prevenir escalada VIEWER → SUPER_ADMIN
--
-- El policy "users_update_self" actual NO tiene WITH CHECK, lo que
-- permite a cualquier usuario autenticado hacer PATCH de su propio
-- campo `role` a 'SUPER_ADMIN' vía la API REST de Supabase.
--
-- Solución A: Column-level REVOKE sobre las columnas sensibles.
-- Solución B: Recrear el policy con WITH CHECK (id = auth.uid())
-- Aplicamos ambas como defensa en profundidad.
-- ----------------------------------------------------------------

-- A: Revocar UPDATE sobre columnas de rol a nivel de columna
--    (tiene efecto incluso si RLS lo permitiría, excepto service_role)
REVOKE UPDATE(role, roles) ON public.users FROM authenticated;

-- B: Recrear el policy con WITH CHECK explícito
DROP POLICY IF EXISTS "users_update_self" ON public.users;

CREATE POLICY "users_update_self" ON public.users
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Verificar que el policy existe con WITH CHECK
SELECT policyname, qual, with_check
FROM pg_policies
WHERE tablename = 'users' AND cmd = 'UPDATE';

-- ----------------------------------------------------------------
-- FIX 2 (ALTO): Eliminar SELECT anónimo en influos_attendees
--
-- El policy "influos_public_read" permite a cualquier visitante
-- sin autenticación leer todos los asistentes de Influos.
-- Este es un registro interno que no debe ser público.
-- ----------------------------------------------------------------

DROP POLICY IF EXISTS "influos_public_read" ON public.influos_attendees;

-- Solo usuarios autenticados pueden ver asistentes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'influos_attendees'
          AND policyname = 'influos_authenticated_read'
    ) THEN
        CREATE POLICY "influos_authenticated_read" ON public.influos_attendees
            FOR SELECT
            TO authenticated
            USING (true);
    END IF;
END $$;

-- ----------------------------------------------------------------
-- FIX 3 (MEDIO): Restringir INSERT anónimo en group_registrations
--
-- El policy "Allow anon to insert registrations" con WITH CHECK (true)
-- permite insertar cualquier dato sin validación.
-- Agregamos control mínimo: el group_id debe existir.
-- ----------------------------------------------------------------

DROP POLICY IF EXISTS "Allow anon to insert registrations" ON public.group_registrations;

CREATE POLICY "Allow anon to insert registrations" ON public.group_registrations
    FOR INSERT
    TO anon
    WITH CHECK (
        group_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.groups WHERE id = group_registrations.group_id
        )
    );

-- ----------------------------------------------------------------
-- FIX 4 (MEDIO): Verificar que grupos no tienen policies duplicadas
--
-- Múltiples policies permisivas para la misma operación en PostgreSQL
-- actúan como OR — si CUALQUIERA permite, pasa. Eliminar duplicados.
-- ----------------------------------------------------------------

-- Listar policies existentes en groups para revisión manual
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'groups'
ORDER BY cmd, policyname;

-- ================================================================
-- VERIFICACIÓN FINAL
-- ================================================================
SELECT
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE tablename IN ('users', 'influos_attendees', 'group_registrations', 'groups')
ORDER BY tablename, cmd;
