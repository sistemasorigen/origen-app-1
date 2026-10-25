-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK de sql/punto_remeras_servolucion.sql
-- 2026-10-25
--
-- Saca los dos disparadores del precio y deja registrar_reporte_stock como
-- estaba (la lista fija Remeras/Buzos, copiada de la base).
--
-- Los productos y movimientos de "Remeras Servolución" que ya se cargaron
-- QUEDAN: son inventario real. Si existen, Reportar va a rechazar el reporte
-- que diga "no conté las Servolución" hasta volver a aplicar.
-- ════════════════════════════════════════════════════════════════════════════

drop trigger if exists trg_servolucion_precio_al_crear on public.info_products;
drop trigger if exists trg_servolucion_sigue_a_remeras on public.info_products;
drop function if exists public.info_servolucion_precio_al_crear();
drop function if exists public.info_servolucion_sigue_a_remeras();
drop function if exists public.info_precio_de_remeras();

CREATE OR REPLACE FUNCTION public.registrar_reporte_stock(p_id uuid, p_conteo jsonb, p_tipos_omitidos text[] DEFAULT '{}'::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;
