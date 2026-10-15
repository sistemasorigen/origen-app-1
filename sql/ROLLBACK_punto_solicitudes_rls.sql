-- ════════════════════════════════════════════════════════════════════════
-- VUELTA ATRÁS de sql/punto_solicitudes_rls.sql
-- ════════════════════════════════════════════════════════════════════════
--
-- ⚠️ ESTO VUELVE A ABRIR LAS DOS TABLAS. Deja de nuevo a presentations con
-- lectura y escritura para cualquiera SIN SESIÓN —nombres de chicos, de sus
-- padres, teléfonos y emails— y a baptisms para cualquiera con cuenta.
--
-- Correrlo sólo si cerrar las tablas rompió algo que no se puede esperar a
-- arreglar, y volver a cerrarlas apenas se pueda.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

DROP POLICY IF EXISTS baptisms_lectura      ON public.baptisms;
DROP POLICY IF EXISTS baptisms_alta         ON public.baptisms;
DROP POLICY IF EXISTS baptisms_edicion      ON public.baptisms;
DROP POLICY IF EXISTS baptisms_baja         ON public.baptisms;
DROP POLICY IF EXISTS presentations_lectura ON public.presentations;
DROP POLICY IF EXISTS presentations_alta    ON public.presentations;
DROP POLICY IF EXISTS presentations_edicion ON public.presentations;
DROP POLICY IF EXISTS presentations_baja    ON public.presentations;

-- Las policies tal como estaban antes.
CREATE POLICY "Allow All Authenticated" ON public.baptisms
    FOR ALL TO public
    USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Allow All Authenticated" ON public.presentations
    FOR ALL TO public
    USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Public Access Presentations" ON public.presentations
    FOR ALL TO public
    USING (true)
    WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.baptisms      TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.presentations TO anon;

COMMIT;
