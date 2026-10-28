-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de sql/fase3_seguridad_crons.sql.
--
-- BEGIN … ROLLBACK y UN bloque que termina con RAISE EXCEPTION a propósito:
-- se deshace entero, incluida la cola de pg_net (los pedidos nunca salen) y
-- cualquier cambio en cron.job. "RESULTADO ✅ …", o "FALLÓ F<n>: …".
-- NUNCA COMMIT. Ninguna clave se imprime: sólo se mira que esté y que sea larga.
--
-- Personas: Pedro (rol PRODE), Sandra (SUPER_ADMIN) y Ana (sin nada).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE FUNCTION pg_temp.cola(p text) RETURNS integer
LANGUAGE sql AS $f$ SELECT count(*)::integer FROM net.http_request_queue WHERE url LIKE '%/' || p $f$;
CREATE FUNCTION pg_temp.ultimo(p text) RETURNS net.http_request_queue
LANGUAGE sql AS $f$ SELECT * FROM net.http_request_queue WHERE url LIKE '%/' || p ORDER BY id DESC LIMIT 1 $f$;
CREATE FUNCTION pg_temp.como(p uuid) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
    IF p IS NULL THEN
        PERFORM set_config('request.jwt.claims', '', true);
    ELSE
        PERFORM set_config('request.jwt.claims', json_build_object('sub', p::text, 'role', 'authenticated')::text, true);
    END IF;
    PERFORM set_config('role', 'authenticated', true);
END $f$;
CREATE FUNCTION pg_temp.volver() RETURNS void LANGUAGE plpgsql AS $f$
BEGIN PERFORM set_config('role', 'postgres', true); END $f$;

DO $suite$
DECLARE
    pedro uuid := gen_random_uuid();
    sandra uuid := gen_random_uuid();
    ana uuid := gen_random_uuid();
    c0 integer;
    q net.http_request_queue;
    r jsonb;
    v text;
    o text := '';
BEGIN
    FOREACH v IN ARRAY ARRAY[pedro::text, sandra::text, ana::text] LOOP
        INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
        VALUES (v::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
                'prueba.f3.' || left(v, 8) || '@test.local', '', now(), now());
    END LOOP;
    INSERT INTO public.users (id, name, email, role, roles, is_active) VALUES
        (pedro,  'Pedro PRUEBA',  'prueba.f3.pedro@test.local',  'VIEWER', ARRAY['PRODE'], true),
        (sandra, 'Sandra PRUEBA', 'prueba.f3.sandra@test.local', 'VIEWER', ARRAY['SUPER_ADMIN'], true),
        (ana,    'Ana PRUEBA',    'prueba.f3.ana@test.local',    'VIEWER', ARRAY['VIEWER'], true)
    ON CONFLICT (id) DO UPDATE SET roles = EXCLUDED.roles, is_active = true;

    -- ── F1 · Los dos crons: mismo horario, activos, y la clave de Vault ─────
    SELECT string_agg(jobid || ':' || schedule || ':' || active::text, ' | ' ORDER BY jobid) INTO v
      FROM cron.job WHERE jobid IN (1, 6);
    IF v IS DISTINCT FROM '1:0 10 * * 1:true | 6:*/5 * * * *:true' THEN
        RAISE EXCEPTION 'FALLÓ F1: horarios/estado %', v;
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobid IN (1, 6) AND command LIKE '%current_setting(%') THEN
        RAISE EXCEPTION 'FALLÓ F1: todavía hay un cron con current_setting';
    END IF;
    IF (SELECT count(*) FROM cron.job WHERE jobid IN (1, 6)
         AND command LIKE '%webhook_service_role_key%' AND command LIKE '%Authorization%') <> 2 THEN
        RAISE EXCEPTION 'FALLÓ F1: algún cron no lee la clave de Vault';
    END IF;
    o := o || format(E'| F1 | Los dos crons | mismo horario y activos, los dos leen webhook_service_role_key de Vault y ninguno usa current_setting | %s | ✅ |\n', v);

    -- ── F2 · El comando de cada cron, corrido de verdad ─────────────────────
    -- Se ejecuta tal cual está guardado: encola el pedido con la clave puesta.
    FOREACH v IN ARRAY ARRAY['welcome-reminder', 'prode-sync-results'] LOOP
        c0 := pg_temp.cola(v);
        EXECUTE (SELECT command FROM cron.job WHERE jobid = CASE v WHEN 'welcome-reminder' THEN 1 ELSE 6 END);
        q := pg_temp.ultimo(v);
        IF pg_temp.cola(v) <> c0 + 1
           OR q.headers->>'Authorization' NOT LIKE 'Bearer %'
           OR length(q.headers->>'Authorization') < 40
           OR convert_from(q.body, 'UTF8') <> '{}' THEN
            RAISE EXCEPTION 'FALLÓ F2 (%): cola %, clave %, cuerpo %',
                v, pg_temp.cola(v) - c0, (q.headers->>'Authorization') IS NOT NULL, convert_from(q.body, 'UTF8');
        END IF;
    END LOOP;
    o := o || E'| F2 | Correr el comando de cada cron | 1 pedido cada uno, con un bearer largo de verdad y cuerpo {} | igual en los dos | ✅ |\n';

    -- ── F3 · El botón del Prode sin sesión ──────────────────────────────────
    c0 := pg_temp.cola('prode-sync-results');
    PERFORM pg_temp.como(NULL);
    r := public.prode_sincronizar();
    PERFORM pg_temp.volver();
    IF r->>'motivo' IS DISTINCT FROM 'sin_sesion' OR pg_temp.cola('prode-sync-results') <> c0 THEN
        RAISE EXCEPTION 'FALLÓ F3: %', r;
    END IF;
    o := o || format(E'| F3 | Sincronizar sin sesión | sin_sesion y ningún pedido | %s | ✅ |\n', r);

    -- ── F4 · Con una cuenta sin el rol ──────────────────────────────────────
    c0 := pg_temp.cola('prode-sync-results');
    PERFORM pg_temp.como(ana);
    r := public.prode_sincronizar();
    PERFORM pg_temp.volver();
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' OR pg_temp.cola('prode-sync-results') <> c0 THEN
        RAISE EXCEPTION 'FALLÓ F4: %', r;
    END IF;
    o := o || format(E'| F4 | Sincronizar con una cuenta sin el rol | sin_permiso y ningún pedido | %s | ✅ |\n', r);

    -- ── F5 · Con el rol PRODE ───────────────────────────────────────────────
    c0 := pg_temp.cola('prode-sync-results');
    PERFORM pg_temp.como(pedro);
    r := public.prode_sincronizar();
    PERFORM pg_temp.volver();
    q := pg_temp.ultimo('prode-sync-results');
    IF (r->>'ok')::boolean IS NOT TRUE OR pg_temp.cola('prode-sync-results') <> c0 + 1
       OR q.headers->>'Authorization' NOT LIKE 'Bearer %'
       OR length(q.headers->>'Authorization') < 40
       OR convert_from(q.body, 'UTF8') <> '{}' THEN
        RAISE EXCEPTION 'FALLÓ F5: %, cola %, cuerpo %', r, pg_temp.cola('prode-sync-results') - c0, convert_from(q.body, 'UTF8');
    END IF;
    o := o || format(E'| F5 | Sincronizar con el rol PRODE | 1 pedido con la clave de Vault y cuerpo {} | %s | ✅ |\n', r);

    -- ── F6 · Con SUPER_ADMIN ────────────────────────────────────────────────
    c0 := pg_temp.cola('prode-sync-results');
    PERFORM pg_temp.como(sandra);
    r := public.prode_sincronizar();
    PERFORM pg_temp.volver();
    IF (r->>'ok')::boolean IS NOT TRUE OR pg_temp.cola('prode-sync-results') <> c0 + 1 THEN
        RAISE EXCEPTION 'FALLÓ F6: %', r;
    END IF;
    o := o || E'| F6 | Sincronizar con SUPER_ADMIN | 1 pedido | ok | ✅ |\n';

    -- ── F7 · Permisos ───────────────────────────────────────────────────────
    IF has_function_privilege('anon', 'public.prode_sincronizar()', 'EXECUTE')
       OR NOT has_function_privilege('authenticated', 'public.prode_sincronizar()', 'EXECUTE')
       OR has_table_privilege('anon', 'public.generate_image_usos', 'SELECT')
       OR has_table_privilege('authenticated', 'public.generate_image_usos', 'INSERT')
       OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.generate_image_usos'::regclass) THEN
        RAISE EXCEPTION 'FALLÓ F7: permisos';
    END IF;
    o := o || E'| F7 | Permisos | prode_sincronizar sólo para authenticated (anon no); generate_image_usos con RLS y sin acceso para anon ni authenticated | igual | ✅ |\n';

    RAISE EXCEPTION E'RESULTADO ✅ 7/7\n%', o;
END;
$suite$;

ROLLBACK;
