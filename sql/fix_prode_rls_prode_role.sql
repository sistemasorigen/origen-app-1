-- ════════════════════════════════════════════════
-- Migración: agregar rol PRODE a políticas RLS
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════

-- NOTA: usamos role::text para evitar restricciones del enum.
-- Esto permite comparar sin necesidad de ALTER TYPE primero.

-- ── prode_matches: write ─────────────────────────
DROP POLICY IF EXISTS "prode_matches_admin_write" ON public.prode_matches;
CREATE POLICY "prode_matches_admin_write"
    ON public.prode_matches
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (
                role::text IN ('SUPER_ADMIN', 'PASTOR', 'PRODE')
                OR roles && ARRAY['SUPER_ADMIN', 'PASTOR', 'PRODE']::text[]
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (
                role::text IN ('SUPER_ADMIN', 'PASTOR', 'PRODE')
                OR roles && ARRAY['SUPER_ADMIN', 'PASTOR', 'PRODE']::text[]
            )
        )
    );

-- ── prode_participants: update ───────────────────
DROP POLICY IF EXISTS "prode_participants_update" ON public.prode_participants;
CREATE POLICY "prode_participants_update"
    ON public.prode_participants
    FOR UPDATE TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (
                role::text IN ('SUPER_ADMIN', 'PASTOR', 'PRODE')
                OR roles && ARRAY['SUPER_ADMIN', 'PASTOR', 'PRODE']::text[]
            )
        )
    );

-- ── prode_participants: delete (faltaba) ─────────
DROP POLICY IF EXISTS "prode_participants_delete" ON public.prode_participants;
CREATE POLICY "prode_participants_delete"
    ON public.prode_participants
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (
                role::text IN ('SUPER_ADMIN', 'PASTOR', 'PRODE')
                OR roles && ARRAY['SUPER_ADMIN', 'PASTOR', 'PRODE']::text[]
            )
        )
    );

-- ── Verificación ─────────────────────────────────
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('prode_matches', 'prode_participants', 'prode_predictions')
ORDER BY tablename, cmd;
