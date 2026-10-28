-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de sql/push_notificaciones.sql.
--
-- BEGIN … ROLLBACK y UN bloque que termina con RAISE EXCEPTION a propósito,
-- así se deshace entero: usuarios, suscripciones, avisos y los pedidos que
-- hayan quedado en la cola de pg_net (que por eso nunca salen). El resultado
-- viaja en el mensaje: "RESULTADO ✅ …" con la tabla, o "FALLÓ P<n>: …" en el
-- primer caso que no da lo esperado. NUNCA COMMIT.
--
-- Las suscripciones usan direcciones inventadas de FCM: aunque un pedido
-- saliera, no hay ningún teléfono detrás. Nadie real recibe nada.
--
-- Personas (apellido "PRUEBA", emails @test.local): Ana, Beto (comparte el
-- celular de Ana) y Ceci (sin dispositivos).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- Contadores para verificar como dueño (después de RESET ROLE).
CREATE FUNCTION pg_temp.subs(p_user uuid) RETURNS integer
LANGUAGE sql AS $f$ SELECT count(*)::integer FROM public.push_suscripciones WHERE user_id = p_user $f$;
CREATE FUNCTION pg_temp.cola() RETURNS integer
LANGUAGE sql AS $f$ SELECT count(*)::integer FROM net.http_request_queue WHERE url LIKE '%/send-push' $f$;

DO $suite$
DECLARE
    v_ana  uuid := gen_random_uuid();
    v_beto uuid := gen_random_uuid();
    v_ceci uuid := gen_random_uuid();
    E text := 'https://fcm.googleapis.com/fcm/send/PRUEBA-';
    K1 text := 'BPRUEBA' || repeat('a', 80);
    K2 text := 'BPRUEBA' || repeat('b', 80);
    A1 text := 'auth-PRUEBA-1';
    A2 text := 'auth-PRUEBA-2';
    r jsonb;
    n integer; n2 integer; n3 integer;
    c0 integer; c1 integer;
    v_txt text;
    v_err text;
    v_def text;
    o text := '';
BEGIN
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at) VALUES
        (v_ana,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.push.ana@test.local',  '', now(), now()),
        (v_beto, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.push.beto@test.local', '', now(), now()),
        (v_ceci, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.push.ceci@test.local', '', now(), now());
    INSERT INTO public.users (id, name, email, role, roles, is_active) VALUES
        (v_ana,  'Ana PRUEBA',  'prueba.push.ana@test.local',  'VIEWER', ARRAY['VIEWER'], true),
        (v_beto, 'Beto PRUEBA', 'prueba.push.beto@test.local', 'VIEWER', ARRAY['VIEWER'], true),
        (v_ceci, 'Ceci PRUEBA', 'prueba.push.ceci@test.local', 'VIEWER', ARRAY['VIEWER'], true)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role,
                                   roles = EXCLUDED.roles, is_active = true;

    -- ── P1 · Guardar ─────────────────────────────────────────────────────────
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ana, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.push_guardar_suscripcion(E || '1', K1, A1, 'ios', 'Safari');
    RESET ROLE;
    n := pg_temp.subs(v_ana);
    IF (r->>'ok')::boolean IS NOT TRUE OR n <> 1 THEN RAISE EXCEPTION 'FALLÓ P1: %, subs %', r, n; END IF;
    o := o || format(E'| P1 | Ana guarda la suscripción de su iPhone | ok, 1 dispositivo | %s, %s | ✅ |\n', r->>'ok', n);

    -- ── P2 · Re-guardar el mismo endpoint ────────────────────────────────────
    SET LOCAL ROLE authenticated;
    r := public.push_guardar_suscripcion(E || '1', K2, A2, 'ios', 'Safari');
    RESET ROLE;
    n := pg_temp.subs(v_ana);
    SELECT p256dh || '|' || auth INTO v_txt FROM public.push_suscripciones WHERE endpoint = E || '1';
    IF n <> 1 OR v_txt IS DISTINCT FROM K2 || '|' || A2 THEN RAISE EXCEPTION 'FALLÓ P2: subs %, claves %', n, v_txt; END IF;
    o := o || format(E'| P2 | Ana vuelve a guardar el mismo navegador con claves nuevas | sigue 1, con las claves nuevas | %s, claves nuevas | ✅ |\n', n);

    -- ── P3 · Celular compartido: pasa de Ana a Beto ──────────────────────────
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_beto, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.push_guardar_suscripcion(E || '1', K1, A1, 'ios', 'Safari');
    RESET ROLE;
    n := pg_temp.subs(v_ana); n2 := pg_temp.subs(v_beto);
    IF (r->>'ok')::boolean IS NOT TRUE OR n <> 0 OR n2 <> 1 THEN RAISE EXCEPTION 'FALLÓ P3: %, ana %, beto %', r, n, n2; END IF;
    o := o || format(E'| P3 | Beto inicia sesión en el celular de Ana y activa | el dispositivo pasa a Beto | Ana %s, Beto %s | ✅ |\n', n, n2);

    -- ── P4 · Tope de 10: la más vieja sale ───────────────────────────────────
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ana, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    FOR i IN 2..12 LOOP
        r := public.push_guardar_suscripcion(E || i, K1, A1, 'android', 'Chrome');
    END LOOP;
    RESET ROLE;
    n := pg_temp.subs(v_ana);
    SELECT count(*) INTO n2 FROM public.push_suscripciones WHERE endpoint = E || '2';
    SELECT count(*) INTO n3 FROM public.push_suscripciones WHERE endpoint = E || '12';
    IF n <> 10 OR n2 <> 0 OR n3 <> 1 THEN RAISE EXCEPTION 'FALLÓ P4: ana %, la más vieja %, la última %', n, n2, n3; END IF;
    o := o || format(E'| P4 | Ana guarda 11 dispositivos | quedan 10; sale el más viejo | %s; el 1° %s, el último %s | ✅ |\n',
                     n, CASE n2 WHEN 0 THEN 'borrado' ELSE 'sigue' END, CASE n3 WHEN 1 THEN 'está' ELSE 'no' END);

    -- ── P5 · Borrar la ajena no; la propia sí ───────────────────────────────
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_beto, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.push_borrar_suscripcion(E || '12');
    RESET ROLE;
    n := pg_temp.subs(v_ana);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ana, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_txt := public.push_borrar_suscripcion(E || '12')->>'borradas';
    RESET ROLE;
    n2 := pg_temp.subs(v_ana);
    IF (r->>'borradas')::int <> 0 OR n <> 10 OR v_txt <> '1' OR n2 <> 9 THEN
        RAISE EXCEPTION 'FALLÓ P5: beto borra %, ana queda %, ana borra %, ana queda %', r, n, v_txt, n2;
    END IF;
    o := o || format(E'| P5 | Beto intenta borrar un dispositivo de Ana; después Ana lo borra | Beto: 0 borradas; Ana: 1 | Beto %s (Ana sigue con %s); Ana %s (le quedan %s) | ✅ |\n',
                     r->>'borradas', n, v_txt, n2);

    -- ── P6 · Lo que no se guarda ─────────────────────────────────────────────
    SET LOCAL ROLE authenticated;
    v_txt := public.push_guardar_suscripcion('https://malo.com/push/1', K1, A1, 'android', 'Chrome')->>'motivo';
    v_txt := v_txt || ',' || (public.push_guardar_suscripcion('http://fcm.googleapis.com/fcm/send/x', K1, A1, 'android', 'Chrome')->>'motivo');
    v_txt := v_txt || ',' || (public.push_guardar_suscripcion('https://fcm.googleapis.com.malo.com/x', K1, A1, 'android', 'Chrome')->>'motivo');
    v_txt := v_txt || ',' || (public.push_guardar_suscripcion(E || 'corta', 'x', 'y', 'android', 'Chrome')->>'motivo');
    r := public.push_guardar_suscripcion('https://web.push.apple.com/PRUEBA-apple', K1, A1, 'raro', repeat('n', 90));
    RESET ROLE;
    SELECT plataforma || '|' || length(navegador) INTO v_err FROM public.push_suscripciones WHERE endpoint = 'https://web.push.apple.com/PRUEBA-apple';
    IF v_txt <> 'endpoint_invalido,endpoint_invalido,endpoint_invalido,claves_invalidas' OR v_err <> 'otro|40' THEN
        RAISE EXCEPTION 'FALLÓ P6: % / %', v_txt, v_err;
    END IF;
    o := o || format(E'| P6 | Dominio ajeno, http, dominio que se disfraza, claves cortas; plataforma rara | rechazados; la rara queda "otro" y el navegador en 40 | %s; %s | ✅ |\n', v_txt, v_err);

    -- ── P7 · Sin sesión ──────────────────────────────────────────────────────
    PERFORM set_config('request.jwt.claims', '', true);
    SET LOCAL ROLE authenticated;
    v_txt := public.push_guardar_suscripcion(E || 'x', K1, A1, 'ios', 'Safari')->>'motivo';
    v_txt := v_txt || ',' || (public.push_mis_dispositivos()->>'motivo') || ',' || (public.push_enviar_prueba()->>'motivo');
    RESET ROLE;
    IF v_txt <> 'sin_sesion,sin_sesion,sin_sesion' THEN RAISE EXCEPTION 'FALLÓ P7: %', v_txt; END IF;
    o := o || format(E'| P7 | Sin sesión: guardar, listar, probar | sin_sesion en las tres | %s | ✅ |\n', v_txt);

    -- ── P8 · Nadie toca la tabla directo ─────────────────────────────────────
    v_txt := '';
    BEGIN
        SET LOCAL ROLE anon;
        PERFORM 1 FROM public.push_suscripciones LIMIT 1;
        v_txt := 'anon LEE';
    EXCEPTION WHEN insufficient_privilege THEN v_txt := 'anon no';
    END;
    RESET ROLE;
    BEGIN
        PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ana, 'role', 'authenticated')::text, true);
        SET LOCAL ROLE authenticated;
        PERFORM 1 FROM public.push_suscripciones LIMIT 1;
        v_txt := v_txt || ', authenticated LEE';
    EXCEPTION WHEN insufficient_privilege THEN v_txt := v_txt || ', authenticated no';
    END;
    RESET ROLE;
    BEGIN
        SET LOCAL ROLE authenticated;
        INSERT INTO public.push_suscripciones (user_id, endpoint, p256dh, auth) VALUES (v_ana, E || 'directo', K1, A1);
        v_txt := v_txt || ', authenticated ESCRIBE';
    EXCEPTION WHEN insufficient_privilege THEN v_txt := v_txt || ', ni escribe';
    END;
    RESET ROLE;
    IF has_function_privilege('anon', 'public.push_guardar_suscripcion(text,text,text,text,text)', 'EXECUTE')
       OR has_function_privilege('anon', 'public.push_enviar_prueba()', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.app_notifications_push()', 'EXECUTE') THEN
        v_txt := v_txt || ', PERMISO DE FUNCIÓN DE MÁS';
    END IF;
    IF v_txt <> 'anon no, authenticated no, ni escribe' THEN RAISE EXCEPTION 'FALLÓ P8: %', v_txt; END IF;
    o := o || format(E'| P8 | anon y authenticated contra la tabla; anon contra las RPC | sin acceso | %s; anon sin EXECUTE | ✅ |\n', v_txt);

    -- ── P9 · Mis dispositivos: sólo los míos, sin claves ─────────────────────
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ana, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.push_mis_dispositivos();
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_beto, 'role', 'authenticated')::text, true);
    n2 := jsonb_array_length(public.push_mis_dispositivos()->'dispositivos');
    RESET ROLE;
    n := jsonb_array_length(r->'dispositivos');
    IF n <> 10 OR n2 <> 1 OR r::text ~ '(endpoint|p256dh|"auth")' THEN RAISE EXCEPTION 'FALLÓ P9: ana %, beto %, %', n, n2, left(r::text, 200); END IF;
    o := o || format(E'| P9 | Cada uno lista sus dispositivos | Ana 10 (9 + el de Apple), Beto 1; sin endpoint ni claves | Ana %s, Beto %s; campos: %s | ✅ |\n',
                     n, n2, (SELECT string_agg(k, ', ' ORDER BY k) FROM jsonb_object_keys(r->'dispositivos'->0) k));

    -- ── P10 · Sin suscripciones, ninguna llamada ─────────────────────────────
    c0 := pg_temp.cola();
    INSERT INTO public.app_notifications (user_id, title, message, type, action_url)
    VALUES (v_ceci, 'Aviso PRUEBA', 'Para Ceci, que no activó nada', 'info', '/');
    c1 := pg_temp.cola();
    IF c1 <> c0 THEN RAISE EXCEPTION 'FALLÓ P10: la cola pasó de % a %', c0, c1; END IF;
    o := o || format(E'| P10 | Aviso para Ceci, sin dispositivos | se crea, sin llamada a send-push | cola %s → %s | ✅ |\n', c0, c1);

    -- ── P11 · Con suscripción, una llamada con SÓLO el id ────────────────────
    INSERT INTO public.app_notifications (user_id, title, message, type, action_url)
    VALUES (v_ana, 'Aviso PRUEBA', 'Para Ana', 'info', '/agenda');
    c1 := pg_temp.cola();
    SELECT string_agg(k, ',') INTO v_txt
      FROM net.http_request_queue q, jsonb_object_keys(convert_from(q.body, 'UTF8')::jsonb) k
     WHERE q.id = (SELECT max(id) FROM net.http_request_queue WHERE url LIKE '%/send-push');
    IF c1 <> c0 + 1 OR v_txt IS DISTINCT FROM 'notificacion_id' THEN RAISE EXCEPTION 'FALLÓ P11: cola % → %, cuerpo %', c0, c1, v_txt; END IF;
    o := o || format(E'| P11 | Aviso para Ana, con dispositivos | una llamada a send-push con sólo el id | cola %s → %s, cuerpo {%s} | ✅ |\n', c0, c1, v_txt);

    -- ── P12 · Sin el secreto, o con pg_net roto, el aviso se crea igual ─────
    -- vault.secrets no se puede tocar desde acá (permiso denegado, y está
    -- bien). En su lugar se reescribe la función del trigger A PARTIR DE SU
    -- PROPIA DEFINICIÓN, cambiando una sola cosa: el nombre del secreto (caso
    -- "falta") o el de la función de pg_net (caso "explota"). Al final se
    -- vuelve a la definición original, y además todo se deshace.
    v_def := pg_get_functiondef('public.app_notifications_push()'::regprocedure);
    EXECUTE replace(v_def, '''webhook_service_role_key''', '''webhook_service_role_key_NO_EXISTE_PRUEBA''');
    c0 := pg_temp.cola();
    BEGIN
        INSERT INTO public.app_notifications (user_id, title, message, type, action_url)
        VALUES (v_ana, 'Aviso PRUEBA sin secreto', 'Para Ana', 'info', '/');
        v_err := 'se creó';
    EXCEPTION WHEN OTHERS THEN v_err := 'NO SE CREÓ: ' || SQLERRM;
    END;
    EXECUTE replace(v_def, 'net.http_post(', 'net.http_post_NO_EXISTE_PRUEBA(');
    BEGIN
        INSERT INTO public.app_notifications (user_id, title, message, type, action_url)
        VALUES (v_ana, 'Aviso PRUEBA con pg_net roto', 'Para Ana', 'info', '/');
        v_err := v_err || ', se creó';
    EXCEPTION WHEN OTHERS THEN v_err := v_err || ', NO SE CREÓ: ' || SQLERRM;
    END;
    EXECUTE v_def;
    c1 := pg_temp.cola();
    IF v_err <> 'se creó, se creó' OR c1 <> c0 THEN RAISE EXCEPTION 'FALLÓ P12: %, cola % → %', v_err, c0, c1; END IF;
    o := o || format(E'| P12 | Falta el secreto de Vault / pg_net da error | el aviso se crea igual, sin llamada | %s; cola %s → %s | ✅ |\n', v_err, c0, c1);

    -- ── P13 · Notificación de prueba: sólo para quien la pide, 5 por día ─────
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ana, 'role', 'authenticated')::text, true);
    c0 := pg_temp.cola();
    SET LOCAL ROLE authenticated;
    v_txt := '';
    FOR i IN 1..6 LOOP
        r := public.push_enviar_prueba();
        v_txt := v_txt || CASE WHEN (r->>'ok')::boolean THEN r->>'quedan' ELSE r->>'motivo' END || CASE WHEN i < 6 THEN ',' ELSE '' END;
    END LOOP;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ceci, 'role', 'authenticated')::text, true);
    v_err := public.push_enviar_prueba()->>'motivo';
    RESET ROLE;
    c1 := pg_temp.cola();
    SELECT count(*) INTO n FROM public.app_notifications WHERE user_id = v_ana AND type = 'PUSH_PRUEBA';
    SELECT count(*) INTO n2 FROM public.app_notifications WHERE type = 'PUSH_PRUEBA' AND user_id <> v_ana;
    IF v_txt <> '4,3,2,1,0,tope' OR v_err <> 'sin_dispositivos' OR n <> 5 OR n2 <> 0 OR c1 <> c0 + 5 THEN
        RAISE EXCEPTION 'FALLÓ P13: ana %, ceci %, avisos ana %, de otros %, cola % → %', v_txt, v_err, n, n2, c0, c1;
    END IF;
    o := o || format(E'| P13 | Ana pide 6 pruebas; Ceci (sin dispositivos) pide 1 | 5 salen (quedan 4…0) y la 6ª dice tope; Ceci: sin_dispositivos | %s; Ceci %s; %s avisos de Ana, %s de otros, cola +%s | ✅ |\n',
                     v_txt, v_err, n, n2, c1 - c0);

    -- ── P14 · Borrar al usuario se lleva sus dispositivos ────────────────────
    DELETE FROM public.users WHERE id = v_beto;
    n := (SELECT count(*) FROM public.push_suscripciones WHERE endpoint = E || '1');
    IF n <> 0 THEN RAISE EXCEPTION 'FALLÓ P14: quedaron %', n; END IF;
    o := o || format(E'| P14 | Se borra la cuenta de Beto | su dispositivo se va con ella | quedan %s | ✅ |\n', n);

    -- ── P15 · El trigger está prendido ───────────────────────────────────────
    SELECT tgenabled INTO v_txt FROM pg_trigger WHERE tgname = 'trg_app_notifications_push';
    IF v_txt IS DISTINCT FROM 'O' THEN RAISE EXCEPTION 'FALLÓ P15: tgenabled %', v_txt; END IF;
    o := o || format(E'| P15 | trg_app_notifications_push | prendido (O) | %s | ✅ |\n', v_txt);

    RAISE EXCEPTION E'RESULTADO ✅ 15/15\n%', o;
END;
$suite$;

ROLLBACK;
