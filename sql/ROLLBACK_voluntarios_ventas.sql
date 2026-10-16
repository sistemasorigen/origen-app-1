-- ════════════════════════════════════════════════════════════════════════════
-- VUELTA ATRÁS de sql/voluntarios_ventas.sql
-- ════════════════════════════════════════════════════════════════════════════
--
-- Deja la base como estaba antes de /voluntarios.
--
-- ⚠️ BORRA LAS COMPRAS. Si hay ventas registradas, esto se lleva las ventas y
-- sus renglones. Los movimientos NO se borran —son el historial que explica
-- el stock de hoy— pero quedan con "ventaId" en NULL.
--
-- El CHECK de "paymentMethod" vuelve a aceptar sólo Efectivo y Mercado Pago.
-- Si quedó algún movimiento con 'Transferencia', el ALTER falla: hay que
-- decidir primero qué se hace con esos movimientos. Por eso va al final y por
-- eso no se fuerza.
--
-- El bucket no se borra desde acá: si tiene archivos, hay que vaciarlo antes
-- (Storage → voluntarios-comprobantes) y eso es una decisión, no un paso
-- automático. Abajo queda el DELETE comentado.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Las policies del bucket ─────────────────────────────────────────────────
DROP POLICY IF EXISTS voluntarios_comprobantes_insert ON storage.objects;
DROP POLICY IF EXISTS voluntarios_comprobantes_select ON storage.objects;

-- ── La RPC y el generador de códigos ────────────────────────────────────────
DROP FUNCTION IF EXISTS public.registrar_venta_voluntario(UUID, JSONB, TEXT, NUMERIC, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.voluntarios_generar_codigo();

-- ── movements ───────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public."movements_ventaId_idx";
ALTER TABLE public.movements DROP CONSTRAINT IF EXISTS "movements_ventaId_fkey";
ALTER TABLE public.movements DROP COLUMN IF EXISTS "ventaId";

-- ── Las tablas ──────────────────────────────────────────────────────────────
-- Los ítems caen solos por el ON DELETE CASCADE, pero se nombran igual.
DROP TABLE IF EXISTS public.ventas_voluntarios_items;
DROP TABLE IF EXISTS public.ventas_voluntarios;

-- ── El CHECK de "paymentMethod", como estaba ────────────────────────────────
-- Falla a propósito si quedó algún movimiento con 'Transferencia'.
ALTER TABLE public.movements
    DROP CONSTRAINT IF EXISTS movements_payment_method_check;

ALTER TABLE public.movements
    ADD CONSTRAINT movements_payment_method_check
    CHECK ("paymentMethod" = ANY (ARRAY['Efectivo'::text, 'Mercado Pago'::text]));

COMMIT;

-- ── El bucket, a mano y sólo si está vacío ──────────────────────────────────
-- DELETE FROM storage.objects WHERE bucket_id = 'voluntarios-comprobantes';
-- DELETE FROM storage.buckets WHERE id = 'voluntarios-comprobantes';
