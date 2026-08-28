-- ============================================================
-- BANNER PRINCIPAL — /punto-de-informacion (InicioPublico.tsx)
-- ============================================================
-- Tabla de slides para el banner principal de Punto de Información,
-- público con o sin sesión. Espeja la estructura de
-- home_musica_banner_slides (sql/create_home_musica_banner.sql):
-- media_url/media_type/video_url/focal_x/focal_y/zoom/display_order,
-- mismo criterio de RLS público en lectura. A diferencia de esa
-- tabla, no tiene target_url (este banner no es un link externo) y
-- suma `subtitle` en vez de `target_url`.
-- ============================================================


-- ── Tabla de slides ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.punto_info_banner_slides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_url TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
    video_url TEXT,
    focal_x NUMERIC,
    focal_y NUMERIC,
    zoom NUMERIC,
    title TEXT,
    subtitle TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_punto_info_banner_order ON public.punto_info_banner_slides(display_order);

COMMENT ON TABLE public.punto_info_banner_slides IS 'Slides del banner principal de /punto-de-informacion (InicioPublico.tsx). Público en lectura — se ve con o sin sesión.';


-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.punto_info_banner_slides ENABLE ROW LEVEL SECURITY;

-- Lectura pública total — se ve en /punto-de-informacion sin sesión.
CREATE POLICY "punto_info_banner_public_select" ON public.punto_info_banner_slides
FOR SELECT
TO anon, authenticated
USING (true);

-- Escritura: mismos roles que ya gatean la pestaña "Configuración"
-- de Punto de Información (pages/primarias/PuntoInformacion.tsx,
-- DESKTOP_NAV['ADMIN_PANEL']). Chequea `role` singular Y `roles[]`
-- array, mismo patrón defensivo que home_musica_banner_slides.
CREATE POLICY "punto_info_banner_staff_write" ON public.punto_info_banner_slides
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND (
                u.role::text = ANY (ARRAY['SUPER_ADMIN','ADMIN_PUNTO','ENCARGADO_PUNTO'])
             OR u.roles      && ARRAY['SUPER_ADMIN','ADMIN_PUNTO','ENCARGADO_PUNTO']
          )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND (
                u.role::text = ANY (ARRAY['SUPER_ADMIN','ADMIN_PUNTO','ENCARGADO_PUNTO'])
             OR u.roles      && ARRAY['SUPER_ADMIN','ADMIN_PUNTO','ENCARGADO_PUNTO']
          )
    )
);


-- ── Verificación estructural ─────────────────────────────────

SELECT table_name FROM information_schema.tables WHERE table_name = 'punto_info_banner_slides';
SELECT policyname, roles, cmd FROM pg_policies WHERE tablename = 'punto_info_banner_slides';


-- ── Verificación funcional (YA EJECUTADA contra el proyecto
-- real oqtumgalnozppqnnjjdb, simulando roles con SET LOCAL role +
-- request.jwt.claim.sub, dentro de BEGIN…ROLLBACK) ──
--
-- NOTA: public.users.id tiene FK a auth.users(id) (constraint
-- users_id_fkey) — no detectado por el join inicial de
-- information_schema.constraint_column_usage, pero confirmado al
-- fallar el primer intento de insertar una fila sintética. Por eso
-- los tests de rol usan un usuario REAL existente (VIEWER, sin
-- ningún rol de staff), pisando temporalmente sus columnas
-- role/roles dentro de la misma transacción con ROLLBACK — nunca
-- persiste el cambio.
--
-- 1. Como `anon` → SELECT sobre la tabla → funcionó, 0 filas, sin
--    error de permisos.
-- 2a. Usuario real (id 4f3f0b84-3234-477e-8c85-0483a6ff0c3a) con
--     ENCARGADO_PUNTO SOLO en `roles[]` (role singular quedó en
--     'VIEWER', el default) → INSERT → pasó el WITH CHECK, devolvió
--     el id insertado. Confirma la rama `u.roles && ARRAY[...]`.
-- 2b. Mismo usuario, ahora con ENCARGADO_PUNTO en el `role` SINGULAR
--     (roles[] vacío) → INSERT → pasó el WITH CHECK. Confirma la
--     rama `u.role::text = ANY(ARRAY[...])`.
-- 3. Mismo usuario en su estado real sin modificar (role='VIEWER',
--    roles=[], sin ninguno de los 3 roles de staff) → INSERT falló
--    con "new row violates row-level security policy for table
--    punto_info_banner_slides" (42501) — confirma que write está
--    bloqueado para no-staff.
-- 4. Post-pruebas: `SELECT role, roles FROM users WHERE id =
--    '4f3f0b84-...'` → sigue en VIEWER / [] (ningún UPDATE
--    persistió). `SELECT count(*) FROM punto_info_banner_slides` →
--    0 filas (ningún INSERT persistió).
