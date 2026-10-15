-- ════════════════════════════════════════════════════════════════════════
-- MOVIMIENTOS · quién lo cargó y cuánto había antes
-- ════════════════════════════════════════════════════════════════════════
--
-- El historial del Punto dice QUÉ pasó y no dice QUIÉN lo hizo. Y en los
-- ajustes dice en cuánto quedó el stock, pero no en cuánto estaba: "quedó en
-- 9" no se puede leer sin saber si venía de 12 o de 2.
--
-- Esto agrega tres columnas y un disparador que las completa solo:
--
--   · "createdBy"      quién lo cargó (auth.uid()).
--   · "createdByName"  su nombre EN ESE MOMENTO. Guardado acá a propósito:
--                      los reportes no tienen que leer users —que tiene su
--                      propia RLS— y el nombre no se pierde si la persona se
--                      va o se renombra.
--   · "previousStock"  el stock que había justo antes. Funciona porque
--                      addInfoMovement y guardarMovimientosEnLote
--                      (services/supabaseService.ts) insertan el movimiento
--                      ANTES de tocar info_products: cuando el disparador
--                      corre, info_products todavía tiene el valor viejo.
--
-- El cliente no decide nada: el disparador pisa lo que venga en esas tres
-- columnas. No se toca addInfoMovement ni la cuenta del stock.
--
-- Los movimientos viejos quedan en NULL. Los reportes los muestran sin autor
-- y sin el "antes": no se inventa lo que no se guardó.
--
-- camelCase entre comillas porque así está el resto de la tabla
-- ("productCode", "productName", "paymentMethod"): el cliente inserta el
-- objeto de JavaScript tal cual.
--
-- Vuelta atrás: sql/ROLLBACK_movimientos_autor.sql
-- Pruebas:      sql/PROBAR_movimientos_autor.sql
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · Las columnas ────────────────────────────────────────────────────
--
-- Todas nullable: los 26 movimientos que ya existen no tienen cómo saber
-- quién los cargó. Sin FK a users: el nombre ya queda guardado, y una FK
-- haría que borrar a alguien arrastre o bloquee su historial.
ALTER TABLE public.movements
    ADD COLUMN IF NOT EXISTS "createdBy"     uuid,
    ADD COLUMN IF NOT EXISTS "createdByName" text,
    ADD COLUMN IF NOT EXISTS "previousStock" integer;

COMMENT ON COLUMN public.movements."createdBy" IS
    'Quién cargó el movimiento (auth.uid()). Lo pone el disparador: lo que mande el cliente se ignora.';
COMMENT ON COLUMN public.movements."createdByName" IS
    'El nombre de quien lo cargó, en el momento de cargarlo. Copiado para que los reportes no dependan de users.';
COMMENT ON COLUMN public.movements."previousStock" IS
    'El stock que tenía el producto justo antes de este movimiento. NULL en los movimientos viejos y si el producto no existe.';

-- ── 2 · Quién y cuánto había ────────────────────────────────────────────
--
-- SECURITY DEFINER por users: tiene RLS y el disparador corre con la sesión
-- de quien escribe, que no necesariamente puede ver su propia fila ahí.
-- (users no tiene FORCE ROW LEVEL SECURITY, así que el dueño la lee entera.)
CREATE OR REPLACE FUNCTION public.completar_movimiento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    quien uuid := auth.uid();
BEGIN
    NEW."createdBy"     := quien;
    NEW."createdByName" := (SELECT u.name FROM public.users u WHERE u.id = quien);
    NEW."previousStock" := (SELECT p.stock FROM public.info_products p WHERE p.code = NEW."productCode");
    RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.completar_movimiento() IS
    'Completa "createdBy", "createdByName" y "previousStock" en cada alta de movements. '
    'Depende de que el stock se actualice DESPUÉS del insert (services/supabaseService.ts).';

-- Nadie la llama a mano: los disparadores no piden permiso de EXECUTE.
REVOKE EXECUTE ON FUNCTION public.completar_movimiento() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.completar_movimiento() FROM anon;
REVOKE EXECUTE ON FUNCTION public.completar_movimiento() FROM authenticated;

-- ── 3 · El disparador ───────────────────────────────────────────────────
DROP TRIGGER IF EXISTS completar_movimiento ON public.movements;

CREATE TRIGGER completar_movimiento
    BEFORE INSERT ON public.movements
    FOR EACH ROW
    EXECUTE FUNCTION public.completar_movimiento();

COMMIT;
