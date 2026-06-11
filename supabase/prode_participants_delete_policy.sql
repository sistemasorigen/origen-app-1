DROP POLICY IF EXISTS "prode_participants_delete" ON public.prode_participants;
CREATE POLICY "prode_participants_delete"
    ON public.prode_participants
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('SUPER_ADMIN', 'PASTOR')
        )
    );
