-- ════════════════════════════════════════════════════════════════════════
-- VUELTA ATRÁS de sql/punto_reportes_stock.sql
-- ════════════════════════════════════════════════════════════════════════
--
-- ⚠️ BORRA LOS REPORTES. Las dos tablas se van con todo lo que tengan
-- adentro: qué se contó, cuánto había y quién lo contó. Eso no se
-- reconstruye.
--
-- Lo que NO se toca: los movimientos que generaron esos reportes. Siguen
-- siendo el historial del stock; lo único que pierden es la columna que
-- decía de qué reporte vinieron.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

DROP FUNCTION IF EXISTS public.registrar_reporte_stock(uuid, jsonb, text[]);

DROP INDEX IF EXISTS public.movements_reporte_idx;

ALTER TABLE public.movements
    DROP CONSTRAINT IF EXISTS "movements_reportId_fkey";

ALTER TABLE public.movements
    DROP COLUMN IF EXISTS "reportId";

DROP TABLE IF EXISTS public.stock_report_items;
DROP TABLE IF EXISTS public.stock_reports;

COMMIT;
