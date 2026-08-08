-- ============================================================
-- MÓDULO "NIÑEZ" — Rol + tabla de slides del banner
-- ============================================================
-- Base para /ninez. Este primer script agrega el rol de staff
-- (ENCARGADO_NINEZ) y la tabla del hero banner administrable
-- desde /admin-ninez/configuracion.
-- ============================================================


-- ── Enum de Postgres — agregar ENCARGADO_NINEZ ──────────────
-- Mismo patrón que sql/fix_user_role_enum_eventos.sql: verificar
-- antes, agregar con IF NOT EXISTS, verificar después.

SELECT enumlabel FROM pg_enum
WHERE enumtypid = 'public.user_role'::regtype
ORDER BY enumsortorder;

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'ENCARGADO_NINEZ';

SELECT enumlabel FROM pg_enum
WHERE enumtypid = 'public.user_role'::regtype
ORDER BY enumsortorder;


-- ── Tabla de slides del banner ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.ninez_banner_slides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url TEXT NOT NULL,
    title TEXT,
    subtitle TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ninez_banner_order ON public.ninez_banner_slides(display_order);

COMMENT ON TABLE public.ninez_banner_slides IS 'Slides del hero banner de /ninez. Administrado desde /admin-ninez/configuracion.';


-- ── Helper de rol — SUPER_ADMIN, PASTOR, ENCARGADO_NINEZ ─────
-- Mismo patrón defensivo que is_eventos_general_staff(): chequea
-- `role` singular Y `roles[]` array, porque en este proyecto un
-- usuario puede tener el rol de staff solo en el array.

CREATE OR REPLACE FUNCTION public.is_ninez_staff()
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
                u.role::text = ANY (ARRAY['SUPER_ADMIN','PASTOR','ENCARGADO_NINEZ'])
             OR u.roles      && ARRAY['SUPER_ADMIN','PASTOR','ENCARGADO_NINEZ']
          )
    );
$$;


-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.ninez_banner_slides ENABLE ROW LEVEL SECURITY;

-- Cualquier autenticado puede ver el banner (/ninez requiere
-- login, igual que /eventos, pero no un rol específico para
-- solo mirarlo).
CREATE POLICY "ninez_banner_select" ON public.ninez_banner_slides
FOR SELECT
TO authenticated
USING (true);

-- Solo el staff de Niñez puede crear/editar/borrar slides.
-- Las policies permisivas se combinan con OR, así que esta no
-- necesita excluir el SELECT de no-staff: ya está cubierto por
-- la policy anterior.
CREATE POLICY "ninez_banner_staff_write" ON public.ninez_banner_slides
FOR ALL
TO authenticated
USING (public.is_ninez_staff())
WITH CHECK (public.is_ninez_staff());


-- ── Verificación estructural ─────────────────────────────────

SELECT enumlabel FROM pg_enum WHERE enumtypid = 'public.user_role'::regtype AND enumlabel = 'ENCARGADO_NINEZ';
SELECT table_name FROM information_schema.tables WHERE table_name = 'ninez_banner_slides';
SELECT proname FROM pg_proc WHERE proname = 'is_ninez_staff';
SELECT policyname, roles, cmd FROM pg_policies WHERE tablename = 'ninez_banner_slides';


-- ── Verificación funcional (YA EJECUTADA contra el proyecto
-- real oqtumgalnozppqnnjjdb, simulando cada rol con
-- SET LOCAL role + request.jwt.claims) ──
--
-- 1. Usuario de prueba con ENCARGADO_NINEZ agregado temporalmente
--    a roles[] (no había ningún usuario real con este rol nuevo
--    todavía) insertó 1 slide de prueba. El INSERT pasó el
--    WITH CHECK.
-- 2. Usuario ANFITRION (sin rol Niñez, autenticado): SELECT
--    devolvió el slide de prueba (lectura pública autenticada
--    funciona). El mismo usuario intentó INSERT y falló con
--    "new row violates row-level security policy for table
--    ninez_banner_slides" (42501) — confirma que write está
--    bloqueado para no-staff.
-- 3. Usuario PASTOR real (rol PASTOR singular, sin ENCARGADO_NINEZ
--    en ningún lado) insertó 1 slide de prueba sin problema —
--    confirma que PASTOR, ya incluido en la lista de staff, tiene
--    acceso de escritura como corresponde.
-- 4. Datos de prueba borrados (tabla en 0 filas) y el usuario de
--    prueba revertido a su estado original (roles = '{}').
