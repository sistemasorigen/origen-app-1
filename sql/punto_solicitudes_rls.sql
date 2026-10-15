-- ════════════════════════════════════════════════════════════════════════
-- PUNTO DE INFORMACIÓN · quién puede ver a los que se anotan
-- ════════════════════════════════════════════════════════════════════════
--
-- Lo que estaba abierto (verificado en vivo con la clave pública de la app):
--
--   · presentations: "Public Access Presentations" | ALL | public |
--     USING true | WITH CHECK true. En criollo: cualquiera con la clave
--     pública —que viaja en el JavaScript de la app, o sea, cualquiera—
--     podía LEER, ESCRIBIR y BORRAR los nombres de los chicos, los de sus
--     padres, el teléfono y el email de contacto. Sin sesión. Son datos de
--     menores.
--   · baptisms y presentations: "Allow All Authenticated" | ALL | public |
--     USING (auth.role() = 'authenticated'). Cualquiera de los ~450
--     usuarios con cuenta podía leer, editar y borrar las dos listas.
--
-- Las policies se suman: con una que dice `true` ya está todo abierto.
--
-- Lo que queda:
--
--   · Leer: quien atiende el Punto (atiende_el_punto(), la misma regla con
--     la que la app deja entrar al panel) y, además, PASTOR y REPORTES, que
--     son los que miran los tableros.
--   · Escribir, editar y borrar: sólo quien atiende el Punto.
--   · anon: nada. Ni leer ni escribir, y sin GRANT: no hay ningún
--     formulario público que anote bautismos o presentaciones —las dos
--     altas viven adentro del panel, detrás de puedeEntrarAlPunto—, así que
--     no hay nada que romper.
--
-- Es la misma forma que sql/punto_rls.sql le dio al stock, con una
-- diferencia: ahí leer era "cualquiera con sesión", porque el inventario no
-- tiene datos de nadie. Acá sí los tiene.
--
-- Vuelta atrás: sql/ROLLBACK_punto_solicitudes_rls.sql
-- Pruebas:      sql/PROBAR_punto_solicitudes_rls.sql
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · Fuera lo abierto ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public Access Presentations" ON public.presentations;
DROP POLICY IF EXISTS "Allow All Authenticated"     ON public.presentations;
DROP POLICY IF EXISTS "Allow All Authenticated"     ON public.baptisms;

-- Por si se corre dos veces.
DROP POLICY IF EXISTS baptisms_lectura      ON public.baptisms;
DROP POLICY IF EXISTS baptisms_alta         ON public.baptisms;
DROP POLICY IF EXISTS baptisms_edicion      ON public.baptisms;
DROP POLICY IF EXISTS baptisms_baja         ON public.baptisms;
DROP POLICY IF EXISTS presentations_lectura ON public.presentations;
DROP POLICY IF EXISTS presentations_alta    ON public.presentations;
DROP POLICY IF EXISTS presentations_edicion ON public.presentations;
DROP POLICY IF EXISTS presentations_baja    ON public.presentations;

ALTER TABLE public.baptisms      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentations ENABLE ROW LEVEL SECURITY;

-- ── 2 · Bautismos ───────────────────────────────────────────────────────
CREATE POLICY baptisms_lectura ON public.baptisms
    FOR SELECT TO authenticated
    USING (public.atiende_el_punto() OR public.tiene_rol(ARRAY['PASTOR', 'REPORTES']));

CREATE POLICY baptisms_alta ON public.baptisms
    FOR INSERT TO authenticated
    WITH CHECK (public.atiende_el_punto());

CREATE POLICY baptisms_edicion ON public.baptisms
    FOR UPDATE TO authenticated
    USING (public.atiende_el_punto())
    WITH CHECK (public.atiende_el_punto());

CREATE POLICY baptisms_baja ON public.baptisms
    FOR DELETE TO authenticated
    USING (public.atiende_el_punto());

-- ── 3 · Presentaciones de niños ─────────────────────────────────────────
CREATE POLICY presentations_lectura ON public.presentations
    FOR SELECT TO authenticated
    USING (public.atiende_el_punto() OR public.tiene_rol(ARRAY['PASTOR', 'REPORTES']));

CREATE POLICY presentations_alta ON public.presentations
    FOR INSERT TO authenticated
    WITH CHECK (public.atiende_el_punto());

CREATE POLICY presentations_edicion ON public.presentations
    FOR UPDATE TO authenticated
    USING (public.atiende_el_punto())
    WITH CHECK (public.atiende_el_punto());

CREATE POLICY presentations_baja ON public.presentations
    FOR DELETE TO authenticated
    USING (public.atiende_el_punto());

-- ── 4 · anon no tiene nada que hacer acá ────────────────────────────────
--
-- Las dos tablas tenían GRANT de todo para anon (SELECT, INSERT, UPDATE,
-- DELETE, TRUNCATE…). Con las policies de arriba ya no entra, pero el GRANT
-- es la segunda puerta: si mañana alguien agrega una policy distraída, esto
-- lo sigue dejando afuera.
REVOKE ALL ON public.baptisms      FROM anon;
REVOKE ALL ON public.presentations FROM anon;

COMMIT;
