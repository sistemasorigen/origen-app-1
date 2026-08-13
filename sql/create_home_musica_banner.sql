-- ============================================================
-- MINI-BANNER "ORIGEN MÚSICA" — Home (/)
-- ============================================================
-- Tabla de slides para el mini-banner "Origen Música" que se
-- muestra en el Home, público con o sin sesión. Espeja la
-- estructura de BannerSlide (types.ts, ~línea 807) sumando
-- `title` (mostrado) y `target_url` (destino del click, NUNCA
-- expuesto en la UI pública).
-- ============================================================


-- ── Tabla de slides ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.home_musica_banner_slides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_url TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
    video_url TEXT,
    focal_x NUMERIC,
    focal_y NUMERIC,
    zoom NUMERIC,
    title TEXT,
    target_url TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_home_musica_banner_order ON public.home_musica_banner_slides(display_order);

COMMENT ON TABLE public.home_musica_banner_slides IS 'Slides del mini-banner "Origen Música" en el Home (/). Público en lectura — se ve con o sin sesión. target_url nunca se expone en la UI pública, solo se usa como destino del click.';


-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.home_musica_banner_slides ENABLE ROW LEVEL SECURITY;

-- Lectura pública total — se ve en Home sin sesión.
CREATE POLICY "home_musica_banner_public_select" ON public.home_musica_banner_slides
FOR SELECT
TO anon, authenticated
USING (true);

-- Escritura exclusiva de SUPER_ADMIN (mismo guard que ya tiene
-- /panel-admin, donde vive el editor). Chequea `role` singular Y
-- `roles[]` array, mismo patrón defensivo que is_ninez_staff().
CREATE POLICY "home_musica_banner_super_admin_write" ON public.home_musica_banner_slides
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND (u.role::text = 'SUPER_ADMIN' OR u.roles && ARRAY['SUPER_ADMIN'])
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND (u.role::text = 'SUPER_ADMIN' OR u.roles && ARRAY['SUPER_ADMIN'])
    )
);


-- ── Verificación estructural ─────────────────────────────────

SELECT table_name FROM information_schema.tables WHERE table_name = 'home_musica_banner_slides';
SELECT policyname, roles, cmd FROM pg_policies WHERE tablename = 'home_musica_banner_slides';


-- ── Verificación funcional (YA EJECUTADA contra el proyecto
-- real oqtumgalnozppqnnjjdb, simulando roles con SET LOCAL role +
-- request.jwt.claims, dentro de BEGIN…ROLLBACK/COMMIT) ──
--
-- 1. Como `anon` → SELECT sobre la tabla → funcionó, 0 filas, sin
--    error de permisos (BEGIN; SET LOCAL role = anon; SELECT
--    count(*); COMMIT — read-only, no hay nada que revertir).
-- 2. Como usuario SUPER_ADMIN real (id 9cf71a9d-a4c0-43c0-85f2-
--    0da3789fa212, role='SUPER_ADMIN') → INSERT de 1 slide de
--    prueba ("TEST_SUPER_ADMIN_INSERT") → pasó el WITH CHECK,
--    devolvió el id insertado. Transacción cerrada con ROLLBACK
--    para no persistir el dato de prueba.
-- 3. Como usuario VIEWER real (id 4f3f0b84-3234-477e-8c85-
--    0483a6ff0c3a, role='VIEWER', roles=[], sin SUPER_ADMIN en
--    ningún lado) → INSERT falló con "new row violates row-level
--    security policy for table home_musica_banner_slides" (42501)
--    — confirma que write está bloqueado para no-SUPER_ADMIN.
-- 4. `SELECT count(*) FROM home_musica_banner_slides` post-pruebas
--    → 0 filas. No quedaron datos de prueba persistidos.
