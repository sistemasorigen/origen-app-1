-- ════════════════════════════════════════════════════════════════════════
-- PUNTO DE INFORMACIÓN · quién puede tocar el stock
-- ════════════════════════════════════════════════════════════════════════
--
-- El problema: info_products y movements tienen cada una una policy
-- "Public Access …" con USING true y WITH CHECK true para public —que incluye
-- a anon—. En criollo: cualquiera con la clave pública de la app podía leer y
-- escribir el stock y el historial de ventas, con sesión o sin ella. La otra
-- policy ("Allow All Authenticated") no cambiaba nada: las policies se suman,
-- y una que dice `true` ya abre todo.
--
-- Lo que queda después de esto:
--
--   · Leer: cualquiera con sesión. Es lo mismo que permitía "Allow All
--     Authenticated", y es lo que necesitan los reportes de Pastores
--     (getInventoryStockData). Anon queda afuera: el historial de movimientos
--     dice cuánto se vendió y cómo pagó cada uno.
--   · Escribir: sólo quien atiende el Punto. La misma regla con la que la app
--     deja entrar al panel (puedeEntrarAlPunto, en services/authUtils.ts): los
--     cuatro roles del Punto, y los anfitriones sólo si además sirven ahí.
--
-- La portada pública del Punto no lee ninguna de las dos tablas —sólo eventos
-- y anuncios—, así que para el visitante no cambia nada.
--
-- Vuelta atrás: sql/ROLLBACK_punto_rls.sql
-- Pruebas:     sql/PROBAR_punto_rls.sql
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · Quién atiende el Punto ──────────────────────────────────────────
--
-- SECURITY DEFINER, igual que tiene_rol: la policy la evalúa quien escribe, y
-- users tiene su propia RLS. Sin definer, la consulta de adentro no vería la
-- fila del que pregunta y quedarían todos afuera.
--
-- Mira `role` Y `roles[]` porque en esta base conviven las dos columnas: hay
-- gente del Punto cuyo role dice 'VOLUNTEER' y lleva 'ADMIN_PUNTO' en roles[].
-- Esa es también la razón de usar tiene_rol() para la primera mitad en vez de
-- escribir la comparación de nuevo.
CREATE OR REPLACE FUNCTION public.atiende_el_punto()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
    SELECT public.tiene_rol(ARRAY['SUPER_ADMIN', 'ADMIN_PUNTO', 'ENCARGADO_PUNTO', 'VOLUNTARIO_INFO'])
        OR EXISTS (
            SELECT 1
              FROM public.users u
             WHERE u.id = auth.uid()
               AND ((u.role)::text = 'ANFITRION' OR u.roles && ARRAY['ANFITRION'])
               AND (u.volunteer_roles && ARRAY['PUNTO'] OR u.linked_group_id::text = 'PUNTO')
        );
$fn$;

COMMENT ON FUNCTION public.atiende_el_punto() IS
    'Quién puede mover el stock del Punto de Información. Es el espejo de '
    'puedeEntrarAlPunto() en services/authUtils.ts: si cambia una, cambia la otra.';

REVOKE EXECUTE ON FUNCTION public.atiende_el_punto() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atiende_el_punto() TO authenticated;

-- ── 2 · El inventario ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public Access InfoProducts" ON public.info_products;
DROP POLICY IF EXISTS "Allow All Authenticated" ON public.info_products;

CREATE POLICY info_products_lectura ON public.info_products
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY info_products_alta ON public.info_products
    FOR INSERT TO authenticated
    WITH CHECK (public.atiende_el_punto());

CREATE POLICY info_products_edicion ON public.info_products
    FOR UPDATE TO authenticated
    USING (public.atiende_el_punto())
    WITH CHECK (public.atiende_el_punto());

CREATE POLICY info_products_baja ON public.info_products
    FOR DELETE TO authenticated
    USING (public.atiende_el_punto());

-- ── 3 · Los movimientos ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public Access Movements" ON public.movements;
DROP POLICY IF EXISTS "Allow All Authenticated" ON public.movements;

CREATE POLICY movements_lectura ON public.movements
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY movements_alta ON public.movements
    FOR INSERT TO authenticated
    WITH CHECK (public.atiende_el_punto());

CREATE POLICY movements_edicion ON public.movements
    FOR UPDATE TO authenticated
    USING (public.atiende_el_punto())
    WITH CHECK (public.atiende_el_punto());

CREATE POLICY movements_baja ON public.movements
    FOR DELETE TO authenticated
    USING (public.atiende_el_punto());

COMMIT;
