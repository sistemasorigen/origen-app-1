-- ════════════════════════════════════════════════════════════════════════
-- PRUEBAS de sql/punto_reportes_stock.sql
-- ════════════════════════════════════════════════════════════════════════
--
-- Arma un conteo completo con cuatro remeras conocidas y mira que la regla
-- se cumpla en los cuatro casos que existen —sube, baja, no se contó, igual—,
-- que los buzos omitidos no se muevan, que repetir el mismo id no cuente dos
-- veces, que nadie de afuera pueda ejecutarla y que un conteo mal formado no
-- deje nada escrito.
--
-- Toca filas reales (el stock de los productos), pero NADA de esto queda: el
-- script TERMINA SIEMPRE EN EXCEPCIÓN a propósito, que es como se tira atrás
-- solo y como vuelve el resumen. Si algo falla, el mensaje empieza con
-- "FALLÓ".
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

DO $prueba$
DECLARE
    id_punto   uuid;
    id_viewer  uuid;
    id_pastor  uuid;
    p1 text; p2 text; p3 text; p4 text;   -- cuatro remeras: sube, baja, sin contar, igual
    reporte_id uuid := gen_random_uuid();
    otro_id    uuid := gen_random_uuid();
    r          jsonb;
    fallas     text := '';
    n          int;
    n_movs     int;
    n_reportes int;
    stock_buzos_antes int;
    item       record;
    rep        record;
    ajuste     record;
    entrada    record;
    motivo     text;
    rechazos   int := 0;
    lee_pastor int;
    lee_viewer int;
    escribe_punto boolean;
BEGIN
    -- ── Quiénes ────────────────────────────────────────────────────────
    SELECT u.id INTO id_punto FROM public.users u
     WHERE (u.role)::text = ANY (ARRAY['SUPER_ADMIN','ADMIN_PUNTO','ENCARGADO_PUNTO','VOLUNTARIO_INFO'])
        OR u.roles && ARRAY['SUPER_ADMIN','ADMIN_PUNTO','ENCARGADO_PUNTO','VOLUNTARIO_INFO']
     LIMIT 1;

    SELECT u.id INTO id_pastor FROM public.users u
     WHERE (u.role)::text = 'PASTOR' OR u.roles && ARRAY['PASTOR'] LIMIT 1;

    SELECT u.id INTO id_viewer FROM public.users u
     WHERE (u.role)::text = 'VIEWER'
       AND NOT (COALESCE(u.roles, ARRAY[]::text[]) && ARRAY['SUPER_ADMIN','ADMIN_PUNTO','ENCARGADO_PUNTO','VOLUNTARIO_INFO','ANFITRION','PASTOR','REPORTES'])
     LIMIT 1;

    IF id_punto IS NULL OR id_pastor IS NULL OR id_viewer IS NULL THEN
        RAISE EXCEPTION 'Falta alguien para probar (Punto / PASTOR / VIEWER).';
    END IF;

    -- ── Un tablero conocido ────────────────────────────────────────────
    -- Las remeras quedan todas en 0 y cuatro de ellas con un valor a mano,
    -- así las cuentas del reporte son predecibles.
    UPDATE public.info_products SET stock = 0 WHERE type = 'Remeras';

    SELECT code INTO p1 FROM public.info_products WHERE type = 'Remeras' ORDER BY code OFFSET 0 LIMIT 1;
    SELECT code INTO p2 FROM public.info_products WHERE type = 'Remeras' ORDER BY code OFFSET 1 LIMIT 1;
    SELECT code INTO p3 FROM public.info_products WHERE type = 'Remeras' ORDER BY code OFFSET 2 LIMIT 1;
    SELECT code INTO p4 FROM public.info_products WHERE type = 'Remeras' ORDER BY code OFFSET 3 LIMIT 1;

    IF p4 IS NULL THEN
        RAISE EXCEPTION 'Hacen falta al menos 4 remeras cargadas para probar.';
    END IF;

    UPDATE public.info_products SET stock = 2 WHERE code = p1;   -- sube a 5
    UPDATE public.info_products SET stock = 8 WHERE code = p2;   -- baja a 6
    UPDATE public.info_products SET stock = 4 WHERE code = p3;   -- no se cuenta
    UPDATE public.info_products SET stock = 7 WHERE code = p4;   -- queda igual

    SELECT COALESCE(sum(stock), 0) INTO stock_buzos_antes FROM public.info_products WHERE type = 'Buzos';
    SELECT count(*) INTO n_movs FROM public.movements;

    -- ── 7 · Sin el rol del Punto no se ejecuta ─────────────────────────
    PERFORM set_config('request.jwt.claims', json_build_object('sub', id_viewer, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);
    BEGIN
        PERFORM public.registrar_reporte_stock(otro_id, '[]'::jsonb, '{}'::text[]);
        fallas := fallas || ' · un usuario sin rol del Punto PUDO reportar';
    EXCEPTION WHEN others THEN
        IF SQLERRM NOT LIKE '%sin_permiso%' THEN
            fallas := fallas || format(' · el usuario sin rol falló por otra cosa (%s)', left(SQLERRM, 40));
        END IF;
    END;

    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
    PERFORM set_config('role', 'anon', true);
    BEGIN
        PERFORM public.registrar_reporte_stock(otro_id, '[]'::jsonb, '{}'::text[]);
        fallas := fallas || ' · anon PUDO ejecutar la función';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;   -- lo esperado: ni siquiera tiene EXECUTE
    WHEN others THEN
        IF SQLERRM NOT LIKE '%sin_permiso%' THEN
            fallas := fallas || format(' · anon falló por otra cosa (%s)', left(SQLERRM, 40));
        END IF;
    END;

    -- ── 8 · Conteos mal formados ───────────────────────────────────────
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', id_punto, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);

    FOREACH motivo IN ARRAY ARRAY[
        format('[{"code":"%s","cantidad":0}]', p1),
        format('[{"code":"%s","cantidad":-3}]', p1),
        format('[{"code":"%s","cantidad":2.5}]', p1),
        '[{"code":"PRUEBA-NO-EXISTE","cantidad":3}]',
        format('[{"code":"%s","cantidad":1},{"code":"%s","cantidad":2}]', p1, p1)
    ] LOOP
        BEGIN
            PERFORM public.registrar_reporte_stock(gen_random_uuid(), motivo::jsonb, '{}'::text[]);
        EXCEPTION WHEN others THEN
            IF SQLERRM LIKE '%conteo_invalido%' THEN rechazos := rechazos + 1; END IF;
        END;
    END LOOP;

    PERFORM set_config('role', 'postgres', true);
    SELECT count(*) INTO n_reportes FROM public.stock_reports;
    IF rechazos <> 5 THEN
        fallas := fallas || format(' · de 5 conteos mal formados sólo se rechazaron %s', rechazos);
    END IF;
    IF n_reportes <> 0 THEN
        fallas := fallas || ' · un conteo mal formado dejó un reporte escrito';
    END IF;
    SELECT count(*) INTO n FROM public.movements;
    IF n <> n_movs THEN
        fallas := fallas || ' · un conteo mal formado dejó movimientos';
    END IF;

    -- ── 1 a 5 · El reporte de verdad ───────────────────────────────────
    PERFORM set_config('request.jwt.claims', json_build_object('sub', id_punto, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);

    r := public.registrar_reporte_stock(
        reporte_id,
        format('[{"code":"%s","cantidad":5},{"code":"%s","cantidad":6},{"code":"%s","cantidad":7}]', p1, p2, p4)::jsonb,
        ARRAY['Buzos']
    );

    PERFORM set_config('role', 'postgres', true);

    IF (r->>'ok') <> 'true' THEN fallas := fallas || ' · el reporte no devolvió ok'; END IF;

    -- 1 · El que sube: Ajuste a 5 + Entrada de 3, los dos con antes = 2.
    SELECT * INTO item FROM public.stock_report_items WHERE "reportId" = reporte_id AND "productCode" = p1;
    IF item.antes <> 2 OR item.contado <> 5 OR item.diferencia <> 3 THEN
        fallas := fallas || format(' · el item que sube quedó %s→%s (%s)', item.antes, item.contado, item.diferencia);
    END IF;
    SELECT * INTO ajuste FROM public.movements WHERE "reportId" = reporte_id AND "productCode" = p1 AND type = 'Ajuste';
    SELECT * INTO entrada FROM public.movements WHERE "reportId" = reporte_id AND "productCode" = p1 AND type = 'Entrada';
    IF ajuste.quantity <> 5 OR ajuste."previousStock" <> 2 THEN
        fallas := fallas || format(' · el Ajuste del que sube quedó quantity=%s previousStock=%s', ajuste.quantity, ajuste."previousStock");
    END IF;
    IF entrada.quantity <> 3 OR entrada."previousStock" <> 2 THEN
        fallas := fallas || format(' · la Entrada quedó quantity=%s previousStock=%s', entrada.quantity, entrada."previousStock");
    END IF;
    IF ajuste."createdBy" IS DISTINCT FROM id_punto THEN
        fallas := fallas || ' · el movimiento del reporte no guardó el autor';
    END IF;
    SELECT stock INTO n FROM public.info_products WHERE code = p1;
    IF n <> 5 THEN fallas := fallas || format(' · el stock del que sube quedó en %s', n); END IF;

    -- 2 · El que baja: sólo Ajuste, sin Entrada.
    SELECT count(*) INTO n FROM public.movements WHERE "reportId" = reporte_id AND "productCode" = p2;
    IF n <> 1 THEN fallas := fallas || format(' · el que baja generó %s movimientos', n); END IF;
    SELECT * INTO ajuste FROM public.movements WHERE "reportId" = reporte_id AND "productCode" = p2;
    IF ajuste.type <> 'Ajuste' OR ajuste.quantity <> 6 OR ajuste."previousStock" <> 8 THEN
        fallas := fallas || format(' · el que baja quedó %s quantity=%s antes=%s', ajuste.type, ajuste.quantity, ajuste."previousStock");
    END IF;
    SELECT stock INTO n FROM public.info_products WHERE code = p2;
    IF n <> 6 THEN fallas := fallas || format(' · el stock del que baja quedó en %s', n); END IF;

    -- 3 · El que no se contó: Ajuste a 0.
    SELECT * INTO item FROM public.stock_report_items WHERE "reportId" = reporte_id AND "productCode" = p3;
    IF item.contado <> 0 OR item.antes <> 4 OR item.diferencia <> -4 THEN
        fallas := fallas || format(' · el que no se contó quedó %s→%s', item.antes, item.contado);
    END IF;
    SELECT * INTO ajuste FROM public.movements WHERE "reportId" = reporte_id AND "productCode" = p3;
    IF ajuste.type <> 'Ajuste' OR ajuste.quantity <> 0 THEN
        fallas := fallas || ' · el que no se contó no generó un Ajuste a 0';
    END IF;
    SELECT stock INTO n FROM public.info_products WHERE code = p3;
    IF n <> 0 THEN fallas := fallas || format(' · el que no se contó quedó con stock %s', n); END IF;

    -- 4 · El que no cambió: ningún movimiento, item en 0.
    SELECT count(*) INTO n FROM public.movements WHERE "reportId" = reporte_id AND "productCode" = p4;
    IF n <> 0 THEN fallas := fallas || format(' · el que no cambió generó %s movimientos', n); END IF;
    SELECT * INTO item FROM public.stock_report_items WHERE "reportId" = reporte_id AND "productCode" = p4;
    IF item.diferencia <> 0 OR item.contado <> 7 THEN
        fallas := fallas || ' · el item del que no cambió no quedó en 0';
    END IF;

    -- 5 · Los buzos omitidos: ni se tocaron ni aparecen.
    SELECT COALESCE(sum(stock), 0) INTO n FROM public.info_products WHERE type = 'Buzos';
    IF n <> stock_buzos_antes THEN fallas := fallas || ' · los buzos omitidos cambiaron de stock'; END IF;
    SELECT count(*) INTO n FROM public.stock_report_items WHERE "reportId" = reporte_id AND type = 'Buzos';
    IF n <> 0 THEN fallas := fallas || ' · los buzos omitidos aparecieron en el reporte'; END IF;
    SELECT count(*) INTO n FROM public.movements m JOIN public.info_products p ON p.code = m."productCode"
     WHERE m."reportId" = reporte_id AND p.type = 'Buzos';
    IF n <> 0 THEN fallas := fallas || ' · los buzos omitidos generaron movimientos'; END IF;

    -- 10 · Los totales.
    SELECT * INTO rep FROM public.stock_reports WHERE id = reporte_id;
    IF rep.unidades <> 18 THEN fallas := fallas || format(' · unidades=%s (esperaba 18)', rep.unidades); END IF;
    IF rep.ingresos <> 3 THEN fallas := fallas || format(' · ingresos=%s (esperaba 3)', rep.ingresos); END IF;
    IF rep.faltantes <> 6 THEN fallas := fallas || format(' · faltantes=%s (esperaba 6)', rep.faltantes); END IF;
    IF rep.cambios <> 3 THEN fallas := fallas || format(' · cambios=%s (esperaba 3)', rep.cambios); END IF;
    IF rep."sinCambios" <> (SELECT count(*) FROM public.info_products WHERE type = 'Remeras') - 3 THEN
        fallas := fallas || format(' · sinCambios=%s', rep."sinCambios");
    END IF;
    IF rep."createdBy" IS DISTINCT FROM id_punto OR rep."createdByName" IS NULL THEN
        fallas := fallas || ' · el reporte no guardó quién lo hizo';
    END IF;
    IF rep."tiposOmitidos" <> ARRAY['Buzos'] THEN fallas := fallas || ' · no guardó los tipos omitidos'; END IF;

    -- ── 6 · El mismo id otra vez ───────────────────────────────────────
    SELECT count(*) INTO n_movs FROM public.movements;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', id_punto, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);
    r := public.registrar_reporte_stock(
        reporte_id,
        format('[{"code":"%s","cantidad":99}]', p1)::jsonb,
        '{}'::text[]
    );
    PERFORM set_config('role', 'postgres', true);

    IF (r->>'repetido') <> 'true' THEN fallas := fallas || ' · el mismo id no avisó que era repetido'; END IF;
    SELECT count(*) INTO n FROM public.movements;
    IF n <> n_movs THEN fallas := fallas || ' · el reporte repetido generó movimientos'; END IF;
    SELECT stock INTO n FROM public.info_products WHERE code = p1;
    IF n <> 5 THEN fallas := fallas || format(' · el reporte repetido cambió el stock a %s', n); END IF;
    SELECT count(*) INTO n FROM public.stock_reports;
    IF n <> 1 THEN fallas := fallas || ' · el reporte repetido creó otro reporte'; END IF;

    -- ── 9 · Quién lee y quién no ───────────────────────────────────────
    PERFORM set_config('request.jwt.claims', json_build_object('sub', id_pastor, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);
    BEGIN SELECT count(*) INTO lee_pastor FROM public.stock_reports; EXCEPTION WHEN insufficient_privilege THEN lee_pastor := -1; END;

    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', id_viewer, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);
    BEGIN SELECT count(*) INTO lee_viewer FROM public.stock_reports; EXCEPTION WHEN insufficient_privilege THEN lee_viewer := -1; END;

    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', id_punto, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);
    BEGIN
        INSERT INTO public.stock_reports (id, "createdByName") VALUES (gen_random_uuid(), 'PRUEBA a mano');
        escribe_punto := true;
    EXCEPTION WHEN others THEN escribe_punto := false;
    END;
    PERFORM set_config('role', 'postgres', true);

    IF lee_pastor < 1 THEN fallas := fallas || ' · PASTOR no lee los reportes'; END IF;
    IF lee_viewer > 0 THEN fallas := fallas || ' · un usuario común LEE los reportes'; END IF;
    IF escribe_punto THEN fallas := fallas || ' · se pudo INSERTAR un reporte a mano'; END IF;

    -- ── Resumen ────────────────────────────────────────────────────────
    IF fallas <> '' THEN
        RAISE EXCEPTION 'FALLÓ:%', fallas;
    END IF;

    RAISE EXCEPTION 'TODO BIEN. sube 2→5 (Ajuste 5 + Entrada 3) · baja 8→6 (sólo Ajuste) · sin contar 4→0 · igual 7→7 sin movimientos · buzos omitidos intactos · repetido avisado · % conteos malos rechazados · PASTOR lee %, común lee % · escritura directa %',
        rechazos, lee_pastor, lee_viewer, CASE WHEN escribe_punto THEN 'SÍ' ELSE 'no' END;
END
$prueba$;

ROLLBACK;
