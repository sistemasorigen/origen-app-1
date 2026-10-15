-- ════════════════════════════════════════════════════════════════════════
-- PRUEBAS de sql/movimientos_autor.sql
-- ════════════════════════════════════════════════════════════════════════
--
-- Cinco casos, en la piel de alguien del Punto y de un visitante sin sesión:
--
--   1 · Entrada  → queda el autor, su nombre y el stock que había.
--   2 · Ajuste   → "previousStock" es el stock ANTERIOR, no el que manda el
--                  cliente en quantity.
--   3 · El cliente miente ("createdBy" de otra persona) → se ignora.
--   4 · Movimiento sin producto → "previousStock" NULL y el alta no falla.
--       (Un producto INEXISTENTE no se puede probar: movements."productCode"
--        tiene FK a info_products(code), así que la base lo rechaza antes de
--        que el disparador exista. Lo que sí se puede es dejarlo en NULL, que
--        la FK permite, y es el mismo camino del disparador: la consulta no
--        encuentra fila y la columna queda en NULL.)
--   5 · Sin sesión → la policy lo sigue rechazando.
--
-- TERMINA SIEMPRE EN EXCEPCIÓN, A PROPÓSITO: es la forma de que la prueba se
-- tire atrás sola y de que el resumen vuelva como mensaje. Si alguna
-- comprobación falla, el mensaje empieza con "FALLÓ".
--
-- No usa ids escritos a mano: busca a la persona por su rol y al producto por
-- el primero que haya. Nada de esto llega a existir.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

DO $prueba$
DECLARE
    id_punto      uuid;
    nombre_punto  text;
    id_otro       uuid;
    cod           text;
    stock_previo  int;
    m             public.movements%ROWTYPE;
    reporte       text := '';
    fallas        text := '';
    escribe_anon  boolean;
    alta_sin_producto boolean;
BEGIN
    SELECT u.id, u.name INTO id_punto, nombre_punto
      FROM public.users u
     WHERE ((u.role)::text = ANY (ARRAY['SUPER_ADMIN','ADMIN_PUNTO','ENCARGADO_PUNTO','VOLUNTARIO_INFO'])
            OR u.roles && ARRAY['SUPER_ADMIN','ADMIN_PUNTO','ENCARGADO_PUNTO','VOLUNTARIO_INFO'])
       AND u.name IS NOT NULL
     LIMIT 1;

    IF id_punto IS NULL THEN
        RAISE EXCEPTION 'No hay ningún usuario del Punto: sin eso no se puede probar el alta.';
    END IF;

    SELECT u.id INTO id_otro FROM public.users u WHERE u.id <> id_punto LIMIT 1;

    SELECT p.code, p.stock INTO cod, stock_previo FROM public.info_products p ORDER BY p.code LIMIT 1;
    IF cod IS NULL THEN
        RAISE EXCEPTION 'No hay productos cargados: sin eso no se puede probar "previousStock".';
    END IF;

    -- ── 1 · Una entrada, cargada por alguien del Punto ──────────────────
    PERFORM set_config('request.jwt.claims', json_build_object('sub', id_punto, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);

    INSERT INTO public.movements (id, "productCode", "productName", type, quantity, date)
    VALUES ('PRUEBA-autor-entrada', cod, 'PRUEBA autor', 'Entrada', 3, now());

    PERFORM set_config('role', 'postgres', true);
    SELECT * INTO m FROM public.movements WHERE id = 'PRUEBA-autor-entrada';

    IF m."createdBy" IS DISTINCT FROM id_punto THEN
        fallas := fallas || ' · la entrada no guardó el autor';
    END IF;
    IF m."createdByName" IS DISTINCT FROM nombre_punto THEN
        fallas := fallas || ' · la entrada no guardó el nombre del autor';
    END IF;
    IF m."previousStock" IS DISTINCT FROM stock_previo THEN
        fallas := fallas || format(' · la entrada guardó previousStock=%s y el stock era %s', m."previousStock", stock_previo);
    END IF;

    -- ── 2 · Un ajuste: el "antes" no es el quantity que manda el cliente ─
    UPDATE public.info_products SET stock = 777 WHERE code = cod;

    PERFORM set_config('role', 'authenticated', true);
    INSERT INTO public.movements (id, "productCode", "productName", type, quantity, date)
    VALUES ('PRUEBA-autor-ajuste', cod, 'PRUEBA autor', 'Ajuste', 9, now());

    PERFORM set_config('role', 'postgres', true);
    SELECT * INTO m FROM public.movements WHERE id = 'PRUEBA-autor-ajuste';

    IF m."previousStock" IS DISTINCT FROM 777 THEN
        fallas := fallas || format(' · el ajuste guardó previousStock=%s en vez de 777', m."previousStock");
    END IF;
    IF m.quantity <> 9 THEN
        fallas := fallas || ' · el ajuste cambió el quantity';
    END IF;

    -- ── 3 · El cliente manda el autor de otra persona ───────────────────
    PERFORM set_config('role', 'authenticated', true);
    INSERT INTO public.movements (id, "productCode", "productName", type, quantity, date, "createdBy", "createdByName", "previousStock")
    VALUES ('PRUEBA-autor-mentira', cod, 'PRUEBA autor', 'Salida', 1, now(), id_otro, 'PRUEBA nombre falso', -5);

    PERFORM set_config('role', 'postgres', true);
    SELECT * INTO m FROM public.movements WHERE id = 'PRUEBA-autor-mentira';

    IF m."createdBy" IS DISTINCT FROM id_punto THEN
        fallas := fallas || ' · se guardó el autor que mandó el cliente';
    END IF;
    IF m."createdByName" IS DISTINCT FROM nombre_punto THEN
        fallas := fallas || ' · se guardó el nombre que mandó el cliente';
    END IF;
    IF m."previousStock" IS DISTINCT FROM 777 THEN
        fallas := fallas || ' · se guardó el previousStock que mandó el cliente';
    END IF;

    -- ── 4 · Un movimiento sin producto ──────────────────────────────────
    PERFORM set_config('role', 'authenticated', true);
    BEGIN
        INSERT INTO public.movements (id, "productCode", "productName", type, quantity, date)
        VALUES ('PRUEBA-autor-fantasma', NULL, 'PRUEBA fantasma', 'Entrada', 1, now());
        alta_sin_producto := true;
    EXCEPTION WHEN others THEN
        alta_sin_producto := false;
    END;

    PERFORM set_config('role', 'postgres', true);

    IF NOT alta_sin_producto THEN
        fallas := fallas || ' · el alta falla cuando el movimiento no tiene producto';
    ELSE
        SELECT * INTO m FROM public.movements WHERE id = 'PRUEBA-autor-fantasma';
        IF m."previousStock" IS NOT NULL THEN
            fallas := fallas || ' · sin producto, previousStock quedó con algo';
        END IF;
        IF m."createdBy" IS DISTINCT FROM id_punto THEN
            fallas := fallas || ' · sin producto, se perdió el autor';
        END IF;
    END IF;

    -- ── 5 · Sin sesión ──────────────────────────────────────────────────
    PERFORM set_config('request.jwt.claims', '', true);
    PERFORM set_config('role', 'anon', true);

    BEGIN
        INSERT INTO public.movements (id, "productCode", "productName", type, quantity, date)
        VALUES ('PRUEBA-autor-anon', cod, 'PRUEBA autor', 'Entrada', 1, now());
        escribe_anon := true;
    EXCEPTION WHEN insufficient_privilege THEN
        escribe_anon := false;
    END;

    PERFORM set_config('role', 'postgres', true);

    IF escribe_anon THEN
        fallas := fallas || ' · anon ESCRIBE movimientos';
    END IF;

    -- ── Lo que tiene que dar ────────────────────────────────────────────
    reporte := format(
        'entrada: autor %s, nombre %s, antes %s | ajuste: antes %s | cliente mentiroso: ignorado %s | sin producto: alta %s | anon: escribe %s',
        CASE WHEN fallas LIKE '%no guardó el autor%' THEN 'NO' ELSE 'sí' END,
        CASE WHEN fallas LIKE '%nombre del autor%' THEN 'NO' ELSE 'sí' END,
        CASE WHEN fallas LIKE '%la entrada guardó previousStock%' THEN 'NO' ELSE 'sí' END,
        CASE WHEN fallas LIKE '%el ajuste guardó previousStock%' THEN 'NO' ELSE 'sí' END,
        CASE WHEN fallas LIKE '%mandó el cliente%' THEN 'NO' ELSE 'sí' END,
        CASE WHEN alta_sin_producto THEN 'sí' ELSE 'NO' END,
        CASE WHEN escribe_anon THEN 'SÍ' ELSE 'no' END);

    IF fallas <> '' THEN
        RAISE EXCEPTION 'FALLÓ:%  —  %', fallas, reporte;
    END IF;

    RAISE EXCEPTION 'TODO BIEN. %', reporte;
END
$prueba$;

ROLLBACK;
