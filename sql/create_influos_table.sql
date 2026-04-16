-- ==============================================================================
-- MIGRATION: Create influos_attendees table
-- ==============================================================================

-- Tabla principal del sistema Influos
CREATE TABLE IF NOT EXISTS public.influos_attendees (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    first_name  TEXT NOT NULL,
    last_name   TEXT NOT NULL,
    age         INTEGER NOT NULL CHECK (age < 18),
    phone       TEXT NOT NULL,
    is_first_time BOOLEAN NOT NULL DEFAULT true
);

-- Habilitar RLS
ALTER TABLE public.influos_attendees ENABLE ROW LEVEL SECURITY;

-- Policy: solo usuarios autenticados con rol INFLUOS
-- (el control granular se hace en el frontend con hasRole)
CREATE POLICY "influos_full_access" ON public.influos_attendees
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('INFLUOS', 'SUPER_ADMIN', 'PASTOR')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('INFLUOS', 'SUPER_ADMIN', 'PASTOR')
        )
    );

-- Índice por fecha de creación
CREATE INDEX IF NOT EXISTS idx_influos_created_at
    ON public.influos_attendees(created_at DESC);
