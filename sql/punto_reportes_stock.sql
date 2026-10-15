-- ════════════════════════════════════════════════════════════════════════
-- PUNTO DE INFORMACIÓN · reportar el stock
-- ════════════════════════════════════════════════════════════════════════
--
-- Hoy, al llegar al stand, se cuenta lo que hay y se manda por WhatsApp.
-- Esto lo reemplaza: se anota cuántas unidades hay de cada talle y la base
-- se acomoda sola.
--
-- La regla, para cada producto:
--
--   contado    = lo que se anotó, o 0 si no se anotó.
--   antes      = el stock que hay en la base, leído ACÁ ADENTRO. Lo que
--                mande el cliente no se mira: entre que abrió la pantalla y
--                la envió pudo venderse algo.
--   diferencia = contado − antes.
--
--   · diferencia ≠ 0 → un movimiento 'Ajuste' con quantity = contado.
--   · diferencia > 0 → además un 'Entrada' con quantity = la diferencia:
--     aparecieron unidades que no estaban cargadas.
--   · diferencia < 0 → sólo el Ajuste. NO es una venta: es un faltante, y
--     llamarlo venta ensuciaría el reporte de lo que se vendió.
--
-- Los dos movimientos se insertan ANTES de tocar el stock, para que el
-- disparador completar_movimiento() guarde el "previousStock" de verdad.
--
-- Lo que no se contó vale 0, con una excepción: el cliente puede decir qué
-- tipos NO contó ("sólo conté remeras"). Esos productos no se tocan ni
-- aparecen en el reporte.
--
-- Nada de esto se escribe desde el cliente: la única puerta es la RPC
-- registrar_reporte_stock, que además es idempotente —el id lo manda el
-- cliente—, así un doble toque no cuenta dos veces.
--
-- Vuelta atrás: sql/ROLLBACK_punto_reportes_stock.sql
-- Pruebas:      sql/PROBAR_punto_reportes_stock.sql
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · El reporte ──────────────────────────────────────────────────────
--
-- Sin default en el id: lo manda el cliente. Es lo que hace que apretar dos
-- veces "Enviar" —o que se corte el wifi y se reintente— no cuente dos veces.
CREATE TABLE IF NOT EXISTS public.stock_reports (
    id              uuid PRIMARY KEY,
    created_at      timestamptz NOT NULL DEFAULT now(),
    "createdBy"     uuid,
    "createdByName" text,
    "tiposOmitidos" text[] NOT NULL DEFAULT '{}',
    unidades        int NOT NULL DEFAULT 0,
    ingresos        int NOT NULL DEFAULT 0,
    faltantes       int NOT NULL DEFAULT 0,
    cambios         int NOT NULL DEFAULT 0,
    "sinCambios"    int NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.stock_reports IS
    'Cada conteo del stock del Punto. Se escribe sólo desde registrar_reporte_stock().';
COMMENT ON COLUMN public.stock_reports."tiposOmitidos" IS
    'Los tipos que esa vez no se contaron: sus productos no se tocaron ni entraron al reporte.';
COMMENT ON COLUMN public.stock_reports.faltantes IS
    'Cuántas unidades faltaron contra lo que decía la base. No son ventas.';

-- ── 2 · Qué se contó de cada producto ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_report_items (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "reportId"    uuid NOT NULL REFERENCES public.stock_reports(id) ON DELETE CASCADE,
    "productCode" text REFERENCES public.info_products(code),
    "productName" text,
    type          text,
    size          text,
    antes         int,
    contado       int,
    diferencia    int
);

CREATE INDEX IF NOT EXISTS stock_report_items_reporte_idx
    ON public.stock_report_items ("reportId");

-- ── 3 · De qué reporte salió cada movimiento ────────────────────────────
--
-- NULL en todos los movimientos de a uno y de a varios, que siguen
-- existiendo igual. ON DELETE SET NULL: borrar un reporte no borra el
-- historial de stock.
ALTER TABLE public.movements
    ADD COLUMN IF NOT EXISTS "reportId" uuid;

DO $fk$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'movements_reportId_fkey' AND conrelid = 'public.movements'::regclass
    ) THEN
        ALTER TABLE public.movements
            ADD CONSTRAINT "movements_reportId_fkey"
            FOREIGN KEY ("reportId") REFERENCES public.stock_reports(id) ON DELETE SET NULL;
    END IF;
END
$fk$;

CREATE INDEX IF NOT EXISTS movements_reporte_idx ON public.movements ("reportId");

COMMENT ON COLUMN public.movements."reportId" IS
    'El reporte de stock que generó este movimiento. NULL si se cargó a mano.';

-- ── 4 · La única puerta de entrada ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_reporte_stock(
    p_id              uuid,
    p_conteo          jsonb,
    p_tipos_omitidos  text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    quien       uuid := auth.uid();
    nombre      text;
    omitidos    text[] := COALESCE(p_tipos_omitidos, '{}');
    producto    record;
    contado     int;
    antes       int;
    diferencia  int;
    -- Con prefijo porque los cuatro primeros son también columnas de
    -- stock_reports: sin eso, el UPDATE final no sabe de cuál hablás.
    tot_unidades  int := 0;
    tot_ingresos  int := 0;
    tot_faltantes int := 0;
    tot_cambios   int := 0;
    tot_sin_cambios int := 0;
BEGIN
    -- Quién.
    IF NOT public.atiende_el_punto() THEN
        RAISE EXCEPTION 'sin_permiso';
    END IF;

    IF p_id IS NULL THEN
        RAISE EXCEPTION 'conteo_invalido: falta el id del reporte';
    END IF;

    -- Idempotencia: si ese reporte ya existe, no se cuenta de nuevo.
    IF EXISTS (SELECT 1 FROM public.stock_reports r WHERE r.id = p_id) THEN
        RETURN jsonb_build_object('ok', true, 'repetido', true);
    END IF;

    -- ── Lo que llegó tiene que ser una lista de {code, cantidad} ────────
    IF p_conteo IS NULL OR jsonb_typeof(p_conteo) <> 'array' THEN
        RAISE EXCEPTION 'conteo_invalido: se esperaba una lista de productos';
    END IF;

    IF EXISTS (SELECT 1 FROM unnest(omitidos) t(x) WHERE t.x NOT IN ('Remeras', 'Buzos')) THEN
        RAISE EXCEPTION 'conteo_invalido: tipo omitido desconocido';
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_conteo) e
         WHERE jsonb_typeof(e) <> 'object'
            OR e->>'code' IS NULL
            OR btrim(e->>'code') = ''
            OR jsonb_typeof(e->'cantidad') <> 'number'
            -- Entero, sin coma ni signo: "2.5" y "-1" caen acá.
            OR (e->>'cantidad') !~ '^[0-9]+$'
            OR (e->>'cantidad')::numeric < 1
            OR (e->>'cantidad')::numeric > 9999
    ) THEN
        RAISE EXCEPTION 'conteo_invalido: cada producto necesita una cantidad entera entre 1 y 9999';
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_conteo) e
         GROUP BY e->>'code' HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'conteo_invalido: hay un producto repetido';
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_conteo) e
          LEFT JOIN public.info_products p ON p.code = e->>'code'
         WHERE p.code IS NULL
    ) THEN
        RAISE EXCEPTION 'conteo_invalido: hay un producto que no existe';
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_conteo) e
          JOIN public.info_products p ON p.code = e->>'code'
         WHERE p.type = ANY (omitidos)
    ) THEN
        RAISE EXCEPTION 'conteo_invalido: se contó un producto de un tipo que dice no haberse contado';
    END IF;

    -- El nombre, copiado: el reporte no tiene que depender de users.
    SELECT u.name INTO nombre FROM public.users u WHERE u.id = quien;

    INSERT INTO public.stock_reports (id, "createdBy", "createdByName", "tiposOmitidos")
    VALUES (p_id, quien, nombre, omitidos);

    -- ── Producto por producto ───────────────────────────────────────────
    --
    -- FOR UPDATE: mientras dura el reporte, nadie más mueve estas filas. Si
    -- alguien está vendiendo en el otro teléfono, espera; si no, el conteo
    -- se guardaría pisando una venta que pasó en el medio.
    FOR producto IN
        SELECT p.code, p.name, p.type, p.size, COALESCE(p.stock, 0) AS stock
          FROM public.info_products p
         WHERE NOT (p.type = ANY (omitidos))
         ORDER BY p.code
           FOR UPDATE
    LOOP
        antes := producto.stock;

        SELECT COALESCE((e->>'cantidad')::int, 0) INTO contado
          FROM jsonb_array_elements(p_conteo) e
         WHERE e->>'code' = producto.code;

        contado := COALESCE(contado, 0);   -- lo que no se anotó, es cero
        diferencia := contado - antes;

        INSERT INTO public.stock_report_items
            ("reportId", "productCode", "productName", type, size, antes, contado, diferencia)
        VALUES (p_id, producto.code, producto.name, producto.type, producto.size, antes, contado, diferencia);

        tot_unidades := tot_unidades + contado;

        IF diferencia = 0 THEN
            tot_sin_cambios := tot_sin_cambios + 1;
        ELSE
            tot_cambios := tot_cambios + 1;

            -- Primero los movimientos, después el stock: el disparador lee
            -- info_products para guardar el "previousStock".
            INSERT INTO public.movements (id, "productCode", "productName", type, quantity, date, "reportId")
            VALUES (gen_random_uuid()::text, producto.code, producto.name, 'Ajuste', contado, now(), p_id);

            IF diferencia > 0 THEN
                INSERT INTO public.movements (id, "productCode", "productName", type, quantity, date, "reportId")
                VALUES (gen_random_uuid()::text, producto.code, producto.name, 'Entrada', diferencia, now(), p_id);
                tot_ingresos := tot_ingresos + diferencia;
            ELSE
                tot_faltantes := tot_faltantes + (-diferencia);
            END IF;

            UPDATE public.info_products SET stock = contado WHERE code = producto.code;
        END IF;
    END LOOP;

    UPDATE public.stock_reports
       SET unidades = tot_unidades, ingresos = tot_ingresos, faltantes = tot_faltantes,
           cambios = tot_cambios, "sinCambios" = tot_sin_cambios
     WHERE id = p_id;

    RETURN jsonb_build_object(
        'ok', true,
        'id', p_id,
        'ingresos', tot_ingresos,
        'faltantes', tot_faltantes,
        'cambios', tot_cambios
    );
END;
$fn$;

COMMENT ON FUNCTION public.registrar_reporte_stock(uuid, jsonb, text[]) IS
    'Guarda un conteo del stock del Punto: items, movimientos y el stock nuevo. '
    'Idempotente por el id que manda el cliente.';

REVOKE EXECUTE ON FUNCTION public.registrar_reporte_stock(uuid, jsonb, text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.registrar_reporte_stock(uuid, jsonb, text[]) FROM anon;
GRANT  EXECUTE ON FUNCTION public.registrar_reporte_stock(uuid, jsonb, text[]) TO authenticated;

-- ── 5 · Quién puede mirar los reportes ──────────────────────────────────
--
-- Leer: los mismos que ven el tablero. Escribir: nadie, ni siquiera el
-- Punto. No hay policy de INSERT, UPDATE ni DELETE a propósito: la única
-- forma de escribir es la RPC, que valida y hace la cuenta completa.
ALTER TABLE public.stock_reports      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_report_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_reports_lectura      ON public.stock_reports;
DROP POLICY IF EXISTS stock_report_items_lectura ON public.stock_report_items;

CREATE POLICY stock_reports_lectura ON public.stock_reports
    FOR SELECT TO authenticated
    USING (public.atiende_el_punto() OR public.tiene_rol(ARRAY['PASTOR', 'REPORTES']));

CREATE POLICY stock_report_items_lectura ON public.stock_report_items
    FOR SELECT TO authenticated
    USING (public.atiende_el_punto() OR public.tiene_rol(ARRAY['PASTOR', 'REPORTES']));

GRANT SELECT ON public.stock_reports      TO authenticated;
GRANT SELECT ON public.stock_report_items TO authenticated;

REVOKE ALL ON public.stock_reports      FROM anon;
REVOKE ALL ON public.stock_report_items FROM anon;

COMMIT;
