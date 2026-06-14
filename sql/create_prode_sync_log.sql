-- Tabla de log para auditar cada sync
CREATE TABLE IF NOT EXISTS public.prode_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ran_at TIMESTAMPTZ DEFAULT NOW(),
    matches_processed INTEGER DEFAULT 0,
    matches_updated INTEGER DEFAULT 0,
    errors TEXT,
    duration_ms INTEGER
);

ALTER TABLE public.prode_sync_log
    ENABLE ROW LEVEL SECURITY;

-- Solo admins ven el log
CREATE POLICY "prode_sync_log_admin"
    ON public.prode_sync_log
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (
                role::text IN ('SUPER_ADMIN','PASTOR','PRODE')
                OR roles && ARRAY['SUPER_ADMIN','PASTOR','PRODE']::text[]
            )
        )
    );

-- Verificar
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'prode_sync_log';
