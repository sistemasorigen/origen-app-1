-- ════════════════════════════════════════════════
-- Policy DELETE para prode_predictions
-- Solo admins pueden eliminar predicciones
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════

DROP POLICY IF EXISTS "prode_predictions_delete"
    ON public.prode_predictions;

CREATE POLICY "prode_predictions_delete"
    ON public.prode_predictions
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

-- Policy INSERT para prode_predictions (admin puede crear para cualquier participante)
-- Si ya existe una policy INSERT, hacer DROP primero
DROP POLICY IF EXISTS "prode_predictions_insert"
    ON public.prode_predictions;

CREATE POLICY "prode_predictions_insert"
    ON public.prode_predictions
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Verificación
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'prode_predictions'
ORDER BY cmd;
