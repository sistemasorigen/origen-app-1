-- ════════════════════════════════════════════════════════════════════════
-- PRUEBAS de sql/punto_solicitudes_rls.sql
-- ════════════════════════════════════════════════════════════════════════
--
-- Se mete en la piel de cinco personas y mira qué puede hacer con las dos
-- listas de gente que se anota:
--
--   1 · Sin sesión (anon)               → nada: ni leer ni escribir.
--   2 · Con cuenta, sin roles (VIEWER)  → no ve nada ni puede escribir.
--   3 · Alguien del Punto               → lee, anota, edita y borra.
--   4 · PASTOR y REPORTES               → leen, pero no escriben.
--   5 · Anfitrión que sirve en el Punto → como el 3.
--
-- En el padrón real no hay nadie con REPORTES ni ningún anfitrión asignado
-- al Punto, así que esas dos identidades se crean acá adentro con nombre
-- PRUEBA. Como todo lo demás, se tiran atrás: el script TERMINA SIEMPRE EN
-- EXCEPCIÓN a propósito, que es como se deshace solo y como vuelve el
-- resumen. Si algo falla, el mensaje empieza con "FALLÓ".
--
-- Nada de esto llega a existir: ni los dos usuarios, ni el bautismo, ni la
-- presentación de prueba.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

DO $prueba$
DECLARE
    id_punto  uuid;
    id_pastor uuid;
    id_viewer uuid;
    id_rep    uuid := gen_random_uuid();
    id_anf    uuid := gen_random_uuid();
    id_baut   uuid;
    n         int;
    fallas    text := '';
    reporte   text := '';

    -- Qué pudo hacer cada uno.
    anon_lee int; anon_escribe boolean; anon_edita int; anon_borra int;
    viewer_lee int; viewer_escribe boolean;
    punto_lee int; punto_escribe boolean; punto_edita int; punto_borra int;
    pastor_lee int; pastor_escribe boolean;
    rep_lee int; rep_escribe boolean;
    anf_lee int; anf_escribe boolean;

    -- Lo mismo para presentaciones, que es la tabla que estaba abierta a anon.
    anon_lee_p int; punto_lee_p int; pastor_lee_p int; viewer_lee_p int;
BEGIN
    -- ── Gente de verdad ─────────────────────────────────────────────────
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

    -- ── Dos identidades que el padrón no tiene ──────────────────────────
    -- proteger_columnas_de_rol sólo pisa los roles cuando quien inserta es
    -- anon o authenticated; acá todavía corre postgres, así que pasan.
    INSERT INTO auth.users (id, email) VALUES (id_rep, 'prueba.reportes@prueba.local');
    INSERT INTO public.users (id, email, name, role, roles)
    VALUES (id_rep, 'prueba.reportes@prueba.local', 'PRUEBA Reportes', 'REPORTES', ARRAY['REPORTES'])
    ON CONFLICT (id) DO UPDATE SET role = 'REPORTES', roles = ARRAY['REPORTES'], name = 'PRUEBA Reportes';

    INSERT INTO auth.users (id, email) VALUES (id_anf, 'prueba.anfitrion@prueba.local');
    INSERT INTO public.users (id, email, name, role, roles, volunteer_roles)
    VALUES (id_anf, 'prueba.anfitrion@prueba.local', 'PRUEBA Anfitrion', 'ANFITRION', ARRAY['ANFITRION'], ARRAY['PUNTO'])
    ON CONFLICT (id) DO UPDATE SET role = 'ANFITRION', roles = ARRAY['ANFITRION'],
                                   volunteer_roles = ARRAY['PUNTO'], name = 'PRUEBA Anfitrion';

    -- ── Una fila de cada tabla, para mirar ──────────────────────────────
    INSERT INTO public.baptisms (first_name, last_name, phone, email)
    VALUES ('PRUEBA', 'RLS', '11 0000 0000', 'prueba.rls@prueba.local')
    RETURNING id INTO id_baut;

    INSERT INTO public.presentations (id, "childName", "childSurname")
    VALUES ('PRUEBA-pres-rls', 'PRUEBA', 'RLS');

    -- ── 1 · Sin sesión ──────────────────────────────────────────────────
    PERFORM set_config('request.jwt.claims', '', true);
    PERFORM set_config('role', 'anon', true);

    BEGIN SELECT count(*) INTO anon_lee   FROM public.baptisms;      EXCEPTION WHEN insufficient_privilege THEN anon_lee   := -1; END;
    BEGIN SELECT count(*) INTO anon_lee_p FROM public.presentations; EXCEPTION WHEN insufficient_privilege THEN anon_lee_p := -1; END;

    BEGIN
        INSERT INTO public.presentations (id, "childName", "childSurname")
        VALUES ('PRUEBA-pres-anon', 'PRUEBA', 'ANON');
        anon_escribe := true;
    EXCEPTION WHEN insufficient_privilege THEN anon_escribe := false;
    END;

    BEGIN
        UPDATE public.presentations SET "childName" = 'PRUEBA-cambiado' WHERE id = 'PRUEBA-pres-rls';
        GET DIAGNOSTICS anon_edita = ROW_COUNT;
    EXCEPTION WHEN insufficient_privilege THEN anon_edita := 0;
    END;

    BEGIN
        DELETE FROM public.presentations WHERE id = 'PRUEBA-pres-rls';
        GET DIAGNOSTICS anon_borra = ROW_COUNT;
    EXCEPTION WHEN insufficient_privilege THEN anon_borra := 0;
    END;

    -- ── 2 · Con cuenta, sin roles ───────────────────────────────────────
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', id_viewer, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);

    BEGIN SELECT count(*) INTO viewer_lee   FROM public.baptisms;      EXCEPTION WHEN insufficient_privilege THEN viewer_lee   := -1; END;
    BEGIN SELECT count(*) INTO viewer_lee_p FROM public.presentations; EXCEPTION WHEN insufficient_privilege THEN viewer_lee_p := -1; END;
    BEGIN
        INSERT INTO public.baptisms (first_name, last_name) VALUES ('PRUEBA', 'VIEWER');
        viewer_escribe := true;
    EXCEPTION WHEN insufficient_privilege THEN viewer_escribe := false;
    END;

    -- ── 3 · Alguien del Punto ───────────────────────────────────────────
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', id_punto, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);

    BEGIN SELECT count(*) INTO punto_lee   FROM public.baptisms;      EXCEPTION WHEN insufficient_privilege THEN punto_lee   := -1; END;
    BEGIN SELECT count(*) INTO punto_lee_p FROM public.presentations; EXCEPTION WHEN insufficient_privilege THEN punto_lee_p := -1; END;

    BEGIN
        INSERT INTO public.baptisms (first_name, last_name) VALUES ('PRUEBA', 'PUNTO');
        punto_escribe := true;
    EXCEPTION WHEN insufficient_privilege THEN punto_escribe := false;
    END;

    BEGIN
        UPDATE public.baptisms SET phone = '11 1111 1111' WHERE id = id_baut;
        GET DIAGNOSTICS punto_edita = ROW_COUNT;
    EXCEPTION WHEN insufficient_privilege THEN punto_edita := 0;
    END;

    BEGIN
        DELETE FROM public.baptisms WHERE first_name = 'PRUEBA' AND last_name = 'PUNTO';
        GET DIAGNOSTICS punto_borra = ROW_COUNT;
    EXCEPTION WHEN insufficient_privilege THEN punto_borra := 0;
    END;

    -- ── 4 · PASTOR y REPORTES ───────────────────────────────────────────
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', id_pastor, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);

    BEGIN SELECT count(*) INTO pastor_lee   FROM public.baptisms;      EXCEPTION WHEN insufficient_privilege THEN pastor_lee   := -1; END;
    BEGIN SELECT count(*) INTO pastor_lee_p FROM public.presentations; EXCEPTION WHEN insufficient_privilege THEN pastor_lee_p := -1; END;
    BEGIN
        INSERT INTO public.baptisms (first_name, last_name) VALUES ('PRUEBA', 'PASTOR');
        pastor_escribe := true;
    EXCEPTION WHEN insufficient_privilege THEN pastor_escribe := false;
    END;

    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', id_rep, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);

    BEGIN SELECT count(*) INTO rep_lee FROM public.presentations; EXCEPTION WHEN insufficient_privilege THEN rep_lee := -1; END;
    BEGIN
        INSERT INTO public.presentations (id, "childName", "childSurname")
        VALUES ('PRUEBA-pres-rep', 'PRUEBA', 'REPORTES');
        rep_escribe := true;
    EXCEPTION WHEN insufficient_privilege THEN rep_escribe := false;
    END;

    -- ── 5 · Anfitrión que sirve en el Punto ─────────────────────────────
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', id_anf, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);

    BEGIN SELECT count(*) INTO anf_lee FROM public.presentations; EXCEPTION WHEN insufficient_privilege THEN anf_lee := -1; END;
    BEGIN
        INSERT INTO public.presentations (id, "childName", "childSurname")
        VALUES ('PRUEBA-pres-anf', 'PRUEBA', 'ANFITRION');
        anf_escribe := true;
    EXCEPTION WHEN insufficient_privilege THEN anf_escribe := false;
    END;

    PERFORM set_config('role', 'postgres', true);

    -- ── Lo que tiene que dar ────────────────────────────────────────────
    IF anon_lee > 0            THEN fallas := fallas || ' · anon LEE bautismos'; END IF;
    IF anon_lee_p > 0          THEN fallas := fallas || ' · anon LEE presentaciones'; END IF;
    IF anon_escribe            THEN fallas := fallas || ' · anon ESCRIBE'; END IF;
    IF anon_edita > 0          THEN fallas := fallas || ' · anon EDITA'; END IF;
    IF anon_borra > 0          THEN fallas := fallas || ' · anon BORRA'; END IF;
    IF viewer_lee > 0          THEN fallas := fallas || ' · una cuenta sin roles LEE bautismos'; END IF;
    IF viewer_lee_p > 0        THEN fallas := fallas || ' · una cuenta sin roles LEE presentaciones'; END IF;
    IF viewer_escribe          THEN fallas := fallas || ' · una cuenta sin roles ESCRIBE'; END IF;
    IF punto_lee <= 0          THEN fallas := fallas || ' · el Punto NO lee bautismos'; END IF;
    IF punto_lee_p <= 0        THEN fallas := fallas || ' · el Punto NO lee presentaciones'; END IF;
    IF NOT punto_escribe       THEN fallas := fallas || ' · el Punto NO puede anotar'; END IF;
    IF punto_edita = 0         THEN fallas := fallas || ' · el Punto NO puede editar'; END IF;
    IF punto_borra = 0         THEN fallas := fallas || ' · el Punto NO puede borrar'; END IF;
    IF pastor_lee <= 0         THEN fallas := fallas || ' · PASTOR no lee bautismos'; END IF;
    IF pastor_lee_p <= 0       THEN fallas := fallas || ' · PASTOR no lee presentaciones'; END IF;
    IF pastor_escribe          THEN fallas := fallas || ' · PASTOR ESCRIBE'; END IF;
    IF rep_lee <= 0            THEN fallas := fallas || ' · REPORTES no lee'; END IF;
    IF rep_escribe             THEN fallas := fallas || ' · REPORTES ESCRIBE'; END IF;
    IF anf_lee <= 0            THEN fallas := fallas || ' · el anfitrión del Punto no lee'; END IF;
    IF NOT anf_escribe         THEN fallas := fallas || ' · el anfitrión del Punto no puede anotar'; END IF;

    reporte := format(
        'anon: lee %s/%s, escribe %s, edita %s, borra %s | sin roles: lee %s/%s, escribe %s | Punto: lee %s/%s, anota %s, edita %s, borra %s | PASTOR: lee %s/%s, escribe %s | REPORTES: lee %s, escribe %s | anfitrión del Punto: lee %s, anota %s',
        anon_lee, anon_lee_p, CASE WHEN anon_escribe THEN 'SÍ' ELSE 'no' END, anon_edita, anon_borra,
        viewer_lee, viewer_lee_p, CASE WHEN viewer_escribe THEN 'SÍ' ELSE 'no' END,
        punto_lee, punto_lee_p, CASE WHEN punto_escribe THEN 'sí' ELSE 'NO' END, punto_edita, punto_borra,
        pastor_lee, pastor_lee_p, CASE WHEN pastor_escribe THEN 'SÍ' ELSE 'no' END,
        rep_lee, CASE WHEN rep_escribe THEN 'SÍ' ELSE 'no' END,
        anf_lee, CASE WHEN anf_escribe THEN 'sí' ELSE 'NO' END);

    IF fallas <> '' THEN
        RAISE EXCEPTION 'FALLÓ:%  —  %', fallas, reporte;
    END IF;

    RAISE EXCEPTION 'TODO BIEN. %', reporte;
END
$prueba$;

ROLLBACK;
