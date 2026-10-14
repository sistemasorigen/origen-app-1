-- ════════════════════════════════════════════════════════════════════════
-- PRUEBAS de sql/punto_rls.sql
-- ════════════════════════════════════════════════════════════════════════
--
-- Se mete en la piel de cuatro personas distintas —un visitante sin sesión,
-- un VIEWER, alguien del Punto y un anfitrión que no sirve ahí— y prueba qué
-- puede leer y qué puede escribir en el stock.
--
-- TERMINA SIEMPRE EN EXCEPCIÓN, A PROPÓSITO: es la forma de que la prueba se
-- tire atrás sola y de que el resumen vuelva como mensaje. Si alguna
-- comprobación falla, el mensaje empieza con "FALLÓ".
--
-- No usa ids escritos a mano: busca a cada persona por su rol, así sirve
-- aunque cambie el padrón. El movimiento de prueba nunca llega a existir.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

DO $prueba$
DECLARE
    id_punto     uuid;
    id_viewer    uuid;
    id_anfitrion uuid;
    cod_producto text;
    reporte      text := '';
    fallas       text := '';
    n_anon       int;
    n_viewer     int;
    escribe_anon      boolean;
    escribe_viewer    boolean;
    escribe_punto     boolean;
    escribe_anfitrion boolean;
BEGIN
    SELECT code INTO cod_producto FROM public.info_products LIMIT 1;
    IF cod_producto IS NULL THEN
        RAISE EXCEPTION 'No hay productos cargados: sin eso no se puede probar el alta de movimientos.';
    END IF;

    SELECT u.id INTO id_punto
      FROM public.users u
     WHERE (u.role)::text = ANY (ARRAY['SUPER_ADMIN','ADMIN_PUNTO','ENCARGADO_PUNTO','VOLUNTARIO_INFO'])
        OR u.roles && ARRAY['SUPER_ADMIN','ADMIN_PUNTO','ENCARGADO_PUNTO','VOLUNTARIO_INFO']
     LIMIT 1;

    SELECT u.id INTO id_viewer
      FROM public.users u
     WHERE (u.role)::text = 'VIEWER'
       AND NOT (COALESCE(u.roles, ARRAY[]::text[]) && ARRAY['SUPER_ADMIN','ADMIN_PUNTO','ENCARGADO_PUNTO','VOLUNTARIO_INFO','ANFITRION'])
     LIMIT 1;

    SELECT u.id INTO id_anfitrion
      FROM public.users u
     WHERE ((u.role)::text = 'ANFITRION' OR u.roles && ARRAY['ANFITRION'])
       AND NOT (COALESCE(u.roles, ARRAY[]::text[]) && ARRAY['SUPER_ADMIN','ADMIN_PUNTO','ENCARGADO_PUNTO','VOLUNTARIO_INFO'])
       AND (u.role)::text <> 'SUPER_ADMIN'
       AND NOT (COALESCE(u.volunteer_roles, ARRAY[]::text[]) && ARRAY['PUNTO'])
     LIMIT 1;

    -- ── 1 · Un visitante sin sesión ─────────────────────────────────────
    PERFORM set_config('request.jwt.claims', '', true);
    PERFORM set_config('role', 'anon', true);

    SELECT count(*) INTO n_anon FROM public.info_products;
    BEGIN
        INSERT INTO public.movements (id, "productCode", "productName", type, quantity, date)
        VALUES ('prueba-rls-anon', cod_producto, 'PRUEBA RLS', 'Entrada', 1, now());
        escribe_anon := true;
    EXCEPTION WHEN insufficient_privilege THEN escribe_anon := false;
    END;

    -- ── 2 · Alguien con sesión, sin nada que ver con el Punto ───────────
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', id_viewer, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);

    SELECT count(*) INTO n_viewer FROM public.info_products;
    BEGIN
        INSERT INTO public.movements (id, "productCode", "productName", type, quantity, date)
        VALUES ('prueba-rls-viewer', cod_producto, 'PRUEBA RLS', 'Entrada', 1, now());
        escribe_viewer := true;
    EXCEPTION WHEN insufficient_privilege THEN escribe_viewer := false;
    END;

    -- ── 3 · Alguien del Punto ───────────────────────────────────────────
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', id_punto, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);

    BEGIN
        INSERT INTO public.movements (id, "productCode", "productName", type, quantity, date)
        VALUES ('prueba-rls-punto', cod_producto, 'PRUEBA RLS', 'Entrada', 1, now());
        escribe_punto := true;
    EXCEPTION WHEN insufficient_privilege THEN escribe_punto := false;
    END;

    -- ── 4 · Un anfitrión que no sirve en el Punto ───────────────────────
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', id_anfitrion, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);

    BEGIN
        INSERT INTO public.movements (id, "productCode", "productName", type, quantity, date)
        VALUES ('prueba-rls-anfitrion', cod_producto, 'PRUEBA RLS', 'Entrada', 1, now());
        escribe_anfitrion := true;
    EXCEPTION WHEN insufficient_privilege THEN escribe_anfitrion := false;
    END;

    PERFORM set_config('role', 'postgres', true);

    -- ── Lo que tiene que dar ────────────────────────────────────────────
    IF n_anon <> 0        THEN fallas := fallas || ' · anon LEE el inventario'; END IF;
    IF escribe_anon       THEN fallas := fallas || ' · anon ESCRIBE movimientos'; END IF;
    IF n_viewer = 0       THEN fallas := fallas || ' · un usuario con sesión no puede leer'; END IF;
    IF escribe_viewer     THEN fallas := fallas || ' · un VIEWER ESCRIBE movimientos'; END IF;
    IF NOT escribe_punto  THEN fallas := fallas || ' · el Punto NO puede escribir'; END IF;
    IF escribe_anfitrion  THEN fallas := fallas || ' · un anfitrión ajeno ESCRIBE movimientos'; END IF;

    reporte := format(
        'anon: lee %s, escribe %s | sesión sin rol: lee %s, escribe %s | Punto: escribe %s | anfitrión ajeno: escribe %s',
        n_anon, CASE WHEN escribe_anon THEN 'SÍ' ELSE 'no' END,
        n_viewer, CASE WHEN escribe_viewer THEN 'SÍ' ELSE 'no' END,
        CASE WHEN escribe_punto THEN 'sí' ELSE 'NO' END,
        CASE WHEN escribe_anfitrion THEN 'SÍ' ELSE 'no' END);

    IF fallas <> '' THEN
        RAISE EXCEPTION 'FALLÓ:%  —  %', fallas, reporte;
    END IF;

    RAISE EXCEPTION 'TODO BIEN. %', reporte;
END
$prueba$;

ROLLBACK;
