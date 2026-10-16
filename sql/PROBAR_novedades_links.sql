-- ════════════════════════════════════════════════════════════════════════
-- PRUEBAS de sql/novedades_links.sql
-- ════════════════════════════════════════════════════════════════════════
--
-- Dos preguntas:
--
--   A · ¿La base acepta cualquier destino?  Se le tiran seis destinos
--       peligrosos ('javascript:', 'http://', '//dominio', 'https://'
--       pelado) y los seis tienen que rebotar.
--
--   B · ¿Quién ve y quién escribe?  Se mete en la piel de tres:
--       1 · Sin sesión (anon)        → lee sólo los visibles y sin vencer,
--                                      y no escribe nada.
--       2 · Con cuenta, sin roles    → exactamente lo mismo.
--       3 · SUPER_ADMIN              → ve también los ocultos y los
--                                      vencidos, y escribe.
--
-- El detalle que importa: un link que vence HOY se tiene que ver, y uno que
-- venció AYER no. En hora argentina, no en UTC.
--
-- Los cuatro links de prueba se llaman "PRUEBA ..." y no llegan a existir:
-- el script TERMINA SIEMPRE EN EXCEPCIÓN a propósito, que es como se
-- deshace solo y como vuelve el resumen. Si algo falla, el mensaje empieza
-- con "FALLÓ".
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

DO $prueba$
DECLARE
    id_admin uuid;
    id_comun uuid;
    hoy_ar   date := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
    mal      record;

    -- A · los destinos que tienen que rebotar.
    rebotaron int := 0;
    colados   text := '';

    -- B · qué pudo hacer cada uno.
    anon_lee  int;  anon_escribe boolean := false;  anon_edita int := -1;  anon_borra int := -1;
    comun_lee int;  comun_escribe boolean := false;
    admin_lee int;  admin_escribe boolean := false; admin_edita int := -1; admin_borra int := -1;
    autor_ok  boolean := false;

    fallas  text := '';
    reporte text := '';
BEGIN
    -- ── Gente de verdad ─────────────────────────────────────────────────
    SELECT u.id INTO id_admin FROM public.users u
     WHERE (u.role)::text = 'SUPER_ADMIN' OR u.roles && ARRAY['SUPER_ADMIN']
     LIMIT 1;

    SELECT u.id INTO id_comun FROM public.users u
     WHERE (u.role)::text = 'VIEWER'
       AND NOT (COALESCE(u.roles, ARRAY[]::text[]) && ARRAY['SUPER_ADMIN'])
     LIMIT 1;

    IF id_admin IS NULL OR id_comun IS NULL THEN
        RAISE EXCEPTION 'Falta alguien para probar (SUPER_ADMIN / usuario común).';
    END IF;

    -- ── A · Destinos que no pueden entrar ───────────────────────────────
    FOR mal IN
        SELECT * FROM (VALUES
            ('interno', 'javascript:alert(1)'),
            ('externo', 'javascript:alert(1)'),
            ('externo', 'http://x.com'),
            ('interno', '//evil.com'),
            ('externo', '//evil.com'),
            ('externo', 'https://')
        ) AS v(tipo, destino)
    LOOP
        BEGIN
            INSERT INTO public.novedades_links (titulo, tipo_destino, destino)
            VALUES ('PRUEBA destino malo', mal.tipo, mal.destino);
            colados := colados || ' · ' || mal.tipo || ' ' || mal.destino;
        EXCEPTION WHEN check_violation THEN
            rebotaron := rebotaron + 1;
        END;
    END LOOP;

    -- ── Los cuatro links de prueba ──────────────────────────────────────
    INSERT INTO public.novedades_links (titulo, tipo_destino, destino, vence, visible, orden) VALUES
        ('PRUEBA sin vencimiento', 'interno', '/eventos',                 NULL,         true,  1),
        ('PRUEBA vence hoy',       'externo', 'https://forms.gle/prueba', hoy_ar,       true,  2),
        ('PRUEBA venció ayer',     'externo', 'https://forms.gle/prueba', hoy_ar - 1,   true,  3),
        ('PRUEBA oculta',          'interno', '/gcx',                     NULL,         false, 4);

    -- ── B1 · Sin sesión ─────────────────────────────────────────────────
    PERFORM set_config('request.jwt.claims', '', true);
    PERFORM set_config('role', 'anon', true);

    SELECT count(*) INTO anon_lee FROM public.novedades_links WHERE titulo LIKE 'PRUEBA%';

    BEGIN
        INSERT INTO public.novedades_links (titulo, tipo_destino, destino)
        VALUES ('PRUEBA de anon', 'interno', '/eventos');
        anon_escribe := true;
    EXCEPTION WHEN OTHERS THEN
        anon_escribe := false;
    END;

    BEGIN
        UPDATE public.novedades_links SET titulo = 'PRUEBA pisada' WHERE titulo LIKE 'PRUEBA%';
        GET DIAGNOSTICS anon_edita = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
        anon_edita := 0;
    END;

    BEGIN
        DELETE FROM public.novedades_links WHERE titulo LIKE 'PRUEBA%';
        GET DIAGNOSTICS anon_borra = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
        anon_borra := 0;
    END;

    -- ── B2 · Con cuenta, sin roles ──────────────────────────────────────
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', id_comun, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);

    SELECT count(*) INTO comun_lee FROM public.novedades_links WHERE titulo LIKE 'PRUEBA%';

    BEGIN
        INSERT INTO public.novedades_links (titulo, tipo_destino, destino)
        VALUES ('PRUEBA de un usuario común', 'interno', '/eventos');
        comun_escribe := true;
    EXCEPTION WHEN OTHERS THEN
        comun_escribe := false;
    END;

    -- ── B3 · SUPER_ADMIN ────────────────────────────────────────────────
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', id_admin, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);

    SELECT count(*) INTO admin_lee FROM public.novedades_links WHERE titulo LIKE 'PRUEBA%';

    BEGIN
        INSERT INTO public.novedades_links (titulo, tipo_destino, destino, orden)
        VALUES ('PRUEBA del admin', 'externo', 'https://origeniglesia.org/prueba', 9);
        admin_escribe := true;
    EXCEPTION WHEN OTHERS THEN
        admin_escribe := false;
    END;

    -- El autor queda anotado solo.
    SELECT count(*) = 1 INTO autor_ok
      FROM public.novedades_links
     WHERE titulo = 'PRUEBA del admin' AND created_by = id_admin;

    BEGIN
        UPDATE public.novedades_links SET visible = false WHERE titulo = 'PRUEBA del admin';
        GET DIAGNOSTICS admin_edita = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
        admin_edita := 0;
    END;

    BEGIN
        DELETE FROM public.novedades_links WHERE titulo = 'PRUEBA del admin';
        GET DIAGNOSTICS admin_borra = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
        admin_borra := 0;
    END;

    PERFORM set_config('role', 'postgres', true);

    -- ── El veredicto ────────────────────────────────────────────────────
    IF rebotaron <> 6      THEN fallas := fallas || ' · ENTRARON destinos prohibidos:' || colados; END IF;
    IF anon_lee  <> 2      THEN fallas := fallas || ' · anon no lee 2 (lee ' || anon_lee || ')'; END IF;
    IF anon_escribe        THEN fallas := fallas || ' · anon ESCRIBE'; END IF;
    IF anon_edita  <> 0    THEN fallas := fallas || ' · anon EDITA'; END IF;
    IF anon_borra  <> 0    THEN fallas := fallas || ' · anon BORRA'; END IF;
    IF comun_lee <> 2      THEN fallas := fallas || ' · el usuario común no lee 2 (lee ' || comun_lee || ')'; END IF;
    IF comun_escribe       THEN fallas := fallas || ' · un usuario común ESCRIBE'; END IF;
    IF admin_lee <> 4      THEN fallas := fallas || ' · el admin no ve los 4 (ve ' || admin_lee || ')'; END IF;
    IF NOT admin_escribe   THEN fallas := fallas || ' · el admin no puede cargar'; END IF;
    IF NOT autor_ok        THEN fallas := fallas || ' · no quedó anotado el autor'; END IF;
    IF admin_edita <> 1    THEN fallas := fallas || ' · el admin no puede editar'; END IF;
    IF admin_borra <> 1    THEN fallas := fallas || ' · el admin no puede borrar'; END IF;

    reporte := format(
        'destinos prohibidos rebotados: %s/6 | anon: lee %s de 4 (el de hoy sí, el de ayer no), escribe %s, edita %s, borra %s | usuario común: lee %s, escribe %s | SUPER_ADMIN: ve %s de 4, carga %s (autor %s), edita %s, borra %s',
        rebotaron,
        anon_lee,  CASE WHEN anon_escribe  THEN 'SÍ' ELSE 'no' END, anon_edita, anon_borra,
        comun_lee, CASE WHEN comun_escribe THEN 'SÍ' ELSE 'no' END,
        admin_lee, CASE WHEN admin_escribe THEN 'sí' ELSE 'NO' END,
        CASE WHEN autor_ok THEN 'sí' ELSE 'NO' END, admin_edita, admin_borra);

    IF fallas <> '' THEN
        RAISE EXCEPTION 'FALLÓ:%  —  %', fallas, reporte;
    END IF;

    RAISE EXCEPTION 'TODO BIEN. %', reporte;
END
$prueba$;

ROLLBACK;
