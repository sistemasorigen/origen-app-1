-- ============================================================
-- SISTEMA "GESTIÓN DE EVENTOS" (eventos_general)
-- ============================================================
-- Sistema NUEVO y separado del de Punto de Información
-- (`app_events`) — decisión explícita de Ignacio, no compartir
-- tabla. Acceso de administración EXCLUSIVO de
-- `ENCARGADO_EVENTOS` (ni SUPER_ADMIN ni PASTOR tienen acceso a
-- este panel puntual — confirmado, no es un descuido).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.eventos_general (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    image_url TEXT,
    start_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    description TEXT,
    registration_link TEXT,
    is_visible BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eventos_general_start_date ON public.eventos_general(start_date);

COMMENT ON TABLE public.eventos_general IS 'Sistema de gestión de eventos administrado exclusivamente por ENCARGADO_EVENTOS, mostrado en /eventos. Separado de app_events (usado por Punto de Información) — no compartir datos entre ambos.';


-- ── Helper de rol — SOLO ENCARGADO_EVENTOS ──────────────────
-- Mismo patrón defensivo que is_dianino_staff(): chequea `role`
-- singular Y `roles[]` array. Es imprescindible — en este mismo
-- proyecto, los 3 usuarios reales con ENCARGADO_EVENTOS tienen
-- ese rol SOLO en `roles[]` (su `role` singular es ANFITRION o
-- INFLUOS), así que un chequeo que solo mirara `role` los habría
-- dejado afuera a los 3.

CREATE OR REPLACE FUNCTION public.is_eventos_general_staff()
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
                u.role::text = 'ENCARGADO_EVENTOS'
             OR u.roles      && ARRAY['ENCARGADO_EVENTOS']
          )
    );
$$;


-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.eventos_general ENABLE ROW LEVEL SECURITY;

-- Público: solo ve eventos con is_visible = true. Es información
-- pública (nombre, fecha, imagen, descripción, link) — no hay
-- datos sensibles acá, una policy directa está bien, no hace
-- falta RPC.
CREATE POLICY "eventos_general_public_select" ON public.eventos_general
FOR SELECT
TO anon, authenticated
USING (is_visible = true);

-- Staff (ENCARGADO_EVENTOS): acceso total, incluidos los eventos
-- ocultos (para poder editarlos/volver a hacerlos visibles).
CREATE POLICY "eventos_general_staff_all" ON public.eventos_general
FOR ALL
TO authenticated
USING (public.is_eventos_general_staff())
WITH CHECK (public.is_eventos_general_staff());


-- ── Verificación estructural ─────────────────────────────────

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'eventos_general';

SELECT proname FROM pg_proc WHERE proname = 'is_eventos_general_staff';

SELECT policyname, roles, cmd FROM pg_policies
WHERE tablename = 'eventos_general';


-- ── Verificación funcional (YA EJECUTADA contra el proyecto
-- real oqtumgalnozppqnnjjdb, simulando cada rol con
-- SET LOCAL role + request.jwt.claims) ──
--
-- 1. Usuario ENCARGADO_EVENTOS (rol solo en roles[], NO en
--    `role` singular — caso real del proyecto) insertó 1 evento
--    visible + 1 oculto. Ambos INSERT pasaron el WITH CHECK.
-- 2. Como anon: SELECT devolvió únicamente el evento visible.
-- 3. El mismo usuario ENCARGADO_EVENTOS: SELECT devolvió AMBOS
--    (visible + oculto).
-- 4. Usuario PASTOR (sin ENCARGADO_EVENTOS en ningún lado):
--      - SELECT devolvió únicamente el visible (igual que anon).
--      - INSERT falló: "new row violates row-level security
--        policy for table eventos_general" (42501).
-- 5. Datos de prueba borrados — tabla en 0 filas.
