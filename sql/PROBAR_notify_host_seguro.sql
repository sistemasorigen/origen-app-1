-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de sql/notify_host_seguro.sql.
--
-- BEGIN … ROLLBACK y UN bloque que termina con RAISE EXCEPTION a propósito:
-- se deshace entero, incluida la cola de pg_net (los pedidos nunca salen).
-- "RESULTADO ✅ …" con la tabla, o "FALLÓ N<n>: …". NUNCA COMMIT.
--
-- Personas: Hugo (anfitrión, PRUEBA) y el grupo "PRUEBA notify-host".
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE FUNCTION pg_temp.cola() RETURNS integer
LANGUAGE sql AS $f$ SELECT count(*)::integer FROM net.http_request_queue WHERE url LIKE '%/notify-host' $f$;
CREATE FUNCTION pg_temp.ultimo() RETURNS net.http_request_queue
LANGUAGE sql AS $f$ SELECT * FROM net.http_request_queue WHERE url LIKE '%/notify-host' ORDER BY id DESC LIMIT 1 $f$;

DO $suite$
DECLARE
    h uuid := gen_random_uuid();
    grupo text := gen_random_uuid()::text;
    r1 text := gen_random_uuid()::text;
    r2 text := gen_random_uuid()::text;
    c0 integer; c1 integer;
    q net.http_request_queue;
    cuerpo text;
    v text;
    v_def text;
    o text := '';
BEGIN
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
    VALUES (h, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.nh.hugo@test.local', '', now(), now());
    INSERT INTO public.users (id, name, email, role, roles, is_active)
    VALUES (h, 'Hugo PRUEBA', 'prueba.nh.hugo@test.local', 'ANFITRION', ARRAY['ANFITRION'], true)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, is_active = true;
    INSERT INTO public.groups (id, name, leader_name, host_id, status)
    VALUES (grupo, 'PRUEBA notify-host', 'Hugo PRUEBA', h, 'pending');

    -- ── N1 · Inscripción PENDING: un pedido, sólo el id, con la clave ───────
    c0 := pg_temp.cola();
    INSERT INTO public.group_registrations (id, first_name, last_name, email, phone, group_id, status)
    VALUES (r1, 'Mara', 'PRUEBA', 'prueba.nh.mara@test.local', '1130000000', grupo, 'PENDING');
    c1 := pg_temp.cola();
    q := pg_temp.ultimo();
    cuerpo := convert_from(q.body, 'UTF8');
    IF c1 <> c0 + 1
       OR (SELECT string_agg(k, ',') FROM jsonb_object_keys(cuerpo::jsonb) k) IS DISTINCT FROM 'registration_id'
       OR cuerpo::jsonb->>'registration_id' IS DISTINCT FROM r1
       OR q.headers->>'Authorization' NOT LIKE 'Bearer %'
       OR length(q.headers->>'Authorization') < 40
       OR q.timeout_milliseconds <> 20000 THEN
        RAISE EXCEPTION 'FALLÓ N1: cola % → %, cuerpo %, timeout %', c0, c1, cuerpo, q.timeout_milliseconds;
    END IF;
    IF cuerpo ~* '(Mara|PRUEBA|test\.local|1130000000)' THEN RAISE EXCEPTION 'FALLÓ N1: datos personales en el pedido'; END IF;
    o := o || format(E'| N1 | Inscripción PENDING | 1 pedido a notify-host, sólo con el id, con la clave y timeout 20000 | cola +%s; cuerpo {%s}; clave sí; timeout %s; sin nombre, email ni teléfono | ✅ |\n',
                     c1 - c0, (SELECT string_agg(k, ',') FROM jsonb_object_keys(cuerpo::jsonb) k), q.timeout_milliseconds);

    -- ── N2 · Inscripción que no es PENDING: nada (como antes) ───────────────
    c0 := pg_temp.cola();
    INSERT INTO public.group_registrations (id, first_name, last_name, group_id, status)
    VALUES (r2, 'Ya', 'PRUEBA', grupo, 'APPROVED');
    UPDATE public.group_registrations SET status = 'APPROVED' WHERE id = r1;
    c1 := pg_temp.cola();
    IF c1 <> c0 THEN RAISE EXCEPTION 'FALLÓ N2: cola % → %', c0, c1; END IF;
    o := o || format(E'| N2 | Inscripción ya APPROVED; aprobar la PENDING (UPDATE) | ningún pedido (antes la función las descartaba) | cola %s → %s | ✅ |\n', c0, c1);

    -- ── N3 · Grupo: sólo en el paso a 'approved' ────────────────────────────
    c0 := pg_temp.cola();
    UPDATE public.groups SET name = 'PRUEBA notify-host (editado)' WHERE id = grupo;   -- pending, sigue pending
    c1 := pg_temp.cola();
    UPDATE public.groups SET status = 'approved' WHERE id = grupo;                      -- pending → approved
    q := pg_temp.ultimo();
    cuerpo := convert_from(q.body, 'UTF8');
    v := format('%s,%s', c1 - c0, pg_temp.cola() - c1);
    c0 := pg_temp.cola();
    UPDATE public.groups SET name = 'PRUEBA notify-host (otra vez)' WHERE id = grupo;  -- approved → approved
    c1 := pg_temp.cola();
    IF v <> '0,1' OR c1 <> c0
       OR (SELECT string_agg(k, ',') FROM jsonb_object_keys(cuerpo::jsonb) k) IS DISTINCT FROM 'grupo_aprobado_id'
       OR cuerpo::jsonb->>'grupo_aprobado_id' IS DISTINCT FROM grupo THEN
        RAISE EXCEPTION 'FALLÓ N3: % / % → % / %', v, c0, c1, cuerpo;
    END IF;
    o := o || format(E'| N3 | Grupo: editar estando pending, pasar a approved, editar estando approved | sólo el paso a approved llama, con {grupo_aprobado_id} | 0 / 1 / 0 pedidos; cuerpo {%s} | ✅ |\n',
                     (SELECT string_agg(k, ',') FROM jsonb_object_keys(cuerpo::jsonb) k));

    -- ── N4 · Reaprobar después de un rechazo vuelve a avisar (como antes) ───
    c0 := pg_temp.cola();
    UPDATE public.groups SET status = 'rejected' WHERE id = grupo;
    UPDATE public.groups SET status = 'approved' WHERE id = grupo;
    c1 := pg_temp.cola();
    IF c1 <> c0 + 1 THEN RAISE EXCEPTION 'FALLÓ N4: cola % → %', c0, c1; END IF;
    o := o || format(E'| N4 | approved → rejected → approved | 1 pedido (el segundo paso a approved) | +%s | ✅ |\n', c1 - c0);

    -- ── N5 · Sin el secreto, o con pg_net roto: la inscripción se guarda ────
    -- Se reescribe la función del trigger A PARTIR DE SU DEFINICIÓN, cambiando
    -- sólo el nombre del secreto o el de pg_net (vault.secrets no se puede
    -- tocar desde acá). Al final vuelve a la original; además, todo se deshace.
    v_def := pg_get_functiondef('public.trigger_notify_host_registration_insert()'::regprocedure);
    c0 := pg_temp.cola();
    EXECUTE replace(v_def, '''webhook_service_role_key''', '''webhook_service_role_key_NO_EXISTE_PRUEBA''');
    BEGIN
        INSERT INTO public.group_registrations (id, first_name, last_name, group_id, status)
        VALUES (gen_random_uuid()::text, 'Sin', 'PRUEBA', grupo, 'PENDING');
        v := 'se guardó';
    EXCEPTION WHEN OTHERS THEN v := 'NO SE GUARDÓ: ' || SQLERRM;
    END;
    EXECUTE replace(v_def, 'net.http_post(', 'net.http_post_NO_EXISTE_PRUEBA(');
    BEGIN
        INSERT INTO public.group_registrations (id, first_name, last_name, group_id, status)
        VALUES (gen_random_uuid()::text, 'Roto', 'PRUEBA', grupo, 'PENDING');
        v := v || ', se guardó';
    EXCEPTION WHEN OTHERS THEN v := v || ', NO SE GUARDÓ: ' || SQLERRM;
    END;
    EXECUTE v_def;
    c1 := pg_temp.cola();
    IF v <> 'se guardó, se guardó' OR c1 <> c0 THEN RAISE EXCEPTION 'FALLÓ N5: %, cola % → %', v, c0, c1; END IF;
    o := o || format(E'| N5 | Falta el secreto / pg_net da error | la inscripción se guarda igual, sin pedido | %s; cola %s → %s | ✅ |\n', v, c0, c1);

    -- ── N6 · Permisos ────────────────────────────────────────────────────────
    IF has_function_privilege('anon', 'public.trigger_notify_host_registration_insert()', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.trigger_notify_host_registration_insert()', 'EXECUTE')
       OR has_function_privilege('anon', 'public.trigger_notify_host_group_update()', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.trigger_notify_host_group_update()', 'EXECUTE')
       OR has_table_privilege('anon', 'public.notify_host_hechos', 'SELECT')
       OR has_table_privilege('authenticated', 'public.notify_host_hechos', 'INSERT')
       OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.notify_host_hechos'::regclass) THEN
        RAISE EXCEPTION 'FALLÓ N6: permisos';
    END IF;
    o := o || E'| N6 | Permisos | anon y authenticated sin EXECUTE en las dos funciones; notify_host_hechos con RLS y sin acceso | igual | ✅ |\n';

    -- ── N7 · Los dos triggers prendidos ─────────────────────────────────────
    SELECT string_agg(tgname || '=' || tgenabled::text, ', ' ORDER BY tgname) INTO v
      FROM pg_trigger WHERE tgname IN ('notify_host_new_registration', 'notify_host_group_approved');
    IF v IS DISTINCT FROM 'notify_host_group_approved=O, notify_host_new_registration=O' THEN RAISE EXCEPTION 'FALLÓ N7: %', v; END IF;
    o := o || format(E'| N7 | Triggers | los dos prendidos (O) | %s | ✅ |\n', v);

    RAISE EXCEPTION E'RESULTADO ✅ 7/7\n%', o;
END;
$suite$;

ROLLBACK;
