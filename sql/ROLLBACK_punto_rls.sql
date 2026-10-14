-- ════════════════════════════════════════════════════════════════════════
-- VUELTA ATRÁS de sql/punto_rls.sql
-- ════════════════════════════════════════════════════════════════════════
--
-- Deja info_products y movements exactamente como estaban: las dos policies
-- originales, con el agujero incluido —cualquiera, incluso sin sesión, lee y
-- escribe—. Correr esto sólo si algo del Punto dejó de andar y hace falta
-- destrabarlo YA; después hay que volver a cerrar.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

DROP POLICY IF EXISTS info_products_lectura ON public.info_products;
DROP POLICY IF EXISTS info_products_alta ON public.info_products;
DROP POLICY IF EXISTS info_products_edicion ON public.info_products;
DROP POLICY IF EXISTS info_products_baja ON public.info_products;

CREATE POLICY "Public Access InfoProducts" ON public.info_products
    FOR ALL TO public
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow All Authenticated" ON public.info_products
    FOR ALL TO public
    USING (auth.role() = 'authenticated'::text);

DROP POLICY IF EXISTS movements_lectura ON public.movements;
DROP POLICY IF EXISTS movements_alta ON public.movements;
DROP POLICY IF EXISTS movements_edicion ON public.movements;
DROP POLICY IF EXISTS movements_baja ON public.movements;

CREATE POLICY "Public Access Movements" ON public.movements
    FOR ALL TO public
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow All Authenticated" ON public.movements
    FOR ALL TO public
    USING (auth.role() = 'authenticated'::text);

-- La función queda: no molesta a nadie y evita tener que recrearla.
-- Para borrarla también: DROP FUNCTION IF EXISTS public.atiende_el_punto();

COMMIT;
