-- ════════════════════════════════════════════════════════════════════════
-- VUELTA ATRÁS de sql/movimientos_autor.sql
-- ════════════════════════════════════════════════════════════════════════
--
-- Saca el disparador, la función y las tres columnas. OJO: borrar las
-- columnas BORRA lo que se haya guardado en ellas desde que se aplicó (quién
-- cargó cada movimiento y cuánto había antes). Eso no se puede reconstruir.
--
-- Si sólo molesta el disparador, alcanza con el DROP TRIGGER: las columnas
-- quedan y el historial no se pierde.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

DROP TRIGGER IF EXISTS completar_movimiento ON public.movements;

DROP FUNCTION IF EXISTS public.completar_movimiento();

ALTER TABLE public.movements
    DROP COLUMN IF EXISTS "createdBy",
    DROP COLUMN IF EXISTS "createdByName",
    DROP COLUMN IF EXISTS "previousStock";

COMMIT;
