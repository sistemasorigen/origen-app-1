-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de sql/agenda_avisos_sin_email.sql
--
-- Todo corre adentro de BEGIN … ROLLBACK y de UN bloque que termina con
-- RAISE EXCEPTION a propósito: se deshace entero —usuarios, departamentos,
-- tareas, avisos, notificaciones— y el resultado viaja en el mensaje:
-- "RESULTADO ✅ …" con la tabla, o "FALLÓ <caso>: …" en el primero que falla.
-- NUNCA COMMIT.
--
-- Lo que cuida: que las tareas avisen SÓLO por la app, que no quede ni una
-- fila de canal 'email' ni un pedido en la cola de pg_net, que no se repitan
-- los avisos, y que las solicitudes y los permisos sigan como estaban.
--
-- Para ensayar ANTES de aplicar: BEGIN; + sql/agenda_avisos_sin_email.sql +
-- el DO de abajo + ROLLBACK; en un solo envío.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

DO $prueba$
DECLARE
    v_super  uuid := gen_random_uuid();
    v_encA   uuid := gen_random_uuid();   -- encargada de A
    v_encA2  uuid := gen_random_uuid();   -- encargado de A y además miembro de Diseño
    v_lider1 uuid := gen_random_uuid();
    v_m1     uuid := gen_random_uuid();
    v_lider2 uuid := gen_random_uuid();
    v_sinm   uuid := gen_random_uuid();   -- sin email
    v_solic  uuid := gen_random_uuid();
    v_depA  uuid := gen_random_uuid();
    v_sub1  uuid := gen_random_uuid();
    v_sub2  uuid := gen_random_uuid();
    v_sub3  uuid := gen_random_uuid();
    t1 uuid := gen_random_uuid(); t2 uuid := gen_random_uuid(); t3 uuid := gen_random_uuid();
    s1 uuid := gen_random_uuid(); s2 uuid := gen_random_uuid();
    r jsonb;
    n integer; n2 integer; n3 integer;
    v_txt text; v_txt2 text;
    v_cola bigint; v_cola0 bigint;
    v_ok boolean;
    o text := '';
BEGIN
    -- ── Preparación ─────────────────────────────────────────────────────────
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at) VALUES
        (v_super,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.se.super@test.local',  '', now(), now()),
        (v_encA,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.se.enca@test.local',   '', now(), now()),
        (v_encA2,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.se.enca2@test.local',  '', now(), now()),
        (v_lider1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.se.lider1@test.local', '', now(), now()),
        (v_m1,     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.se.m1@test.local',     '', now(), now()),
        (v_lider2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.se.lider2@test.local', '', now(), now()),
        (v_sinm,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.se.sinm@test.local',   '', now(), now()),
        (v_solic,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.se.solic@test.local',  '', now(), now());
    INSERT INTO public.users (id, name, email, role, roles, is_active) VALUES
        (v_super,  'Sistemas PRUEBA',    'prueba.se.super@test.local',  'SUPER_ADMIN', ARRAY['SUPER_ADMIN'], true),
        (v_encA,   'Encargada PRUEBA',   'prueba.se.enca@test.local',   'VIEWER', ARRAY['VIEWER'], true),
        (v_encA2,  'Encargado PRUEBA',   'prueba.se.enca2@test.local',  'VIEWER', ARRAY['VIEWER'], true),
        (v_lider1, 'Líder Uno PRUEBA',   'prueba.se.lider1@test.local', 'VIEWER', ARRAY['VIEWER'], true),
        (v_m1,     'Miembro PRUEBA',     'prueba.se.m1@test.local',     'VIEWER', ARRAY['VIEWER'], true),
        (v_lider2, 'Líder Dos PRUEBA',   'prueba.se.lider2@test.local', 'VIEWER', ARRAY['VIEWER'], true),
        (v_sinm,   'Sin Email PRUEBA',   'prueba.se.sinm@test.local',   'VIEWER', ARRAY['VIEWER'], true),
        (v_solic,  'Solicitante PRUEBA', 'prueba.se.solic@test.local',  'VIEWER', ARRAY['VIEWER'], true)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role,
                                   roles = EXCLUDED.roles, is_active = true;
    -- users.email es NOT NULL: "sin email" es vacío.
    UPDATE public.users SET email = '' WHERE id = v_sinm;

    SELECT count(*) INTO v_cola0 FROM net.http_request_queue;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_guardar_departamento(v_depA, 'Creativos SE PRUEBA', '#7c3aed', 'palette', ARRAY[v_encA, v_encA2]);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ prep dep %', r; END IF;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    r := public.agenda_guardar_subdepartamento(v_sub1, v_depA, 'Diseño SE PRUEBA', '#db2777', v_lider1, ARRAY[v_m1, v_encA2]);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ prep sub1 %', r; END IF;
    r := public.agenda_guardar_subdepartamento(v_sub2, v_depA, 'Video SE PRUEBA', '#2563eb', v_lider2, '{}');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ prep sub2 %', r; END IF;
    r := public.agenda_guardar_subdepartamento(v_sub3, v_depA, 'Sonido SE PRUEBA', '#16a34a', v_sinm, '{}');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ prep sub3 %', r; END IF;
    RESET ROLE;

    -- ════════════════════════════════════════════════════════════════════════
    -- 1 · Asignar a Diseño: notificación a los dos, y NADA de email
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_crear_tarea(t1, v_depA, v_sub1, NULL, NULL, 'Flyer SE PRUEBA', NULL, '2026-11-03', false, '19:00', '20:30');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 1: crear %', r; END IF;
    RESET ROLE;

    SELECT count(*) FILTER (WHERE canal = 'app'), count(*) FILTER (WHERE canal = 'email'),
           count(*) FILTER (WHERE user_id = v_encA2)
      INTO n, n2, n3 FROM public.agenda_avisos WHERE tarea_id = t1 AND tipo = 'asignada';
    SELECT count(*) INTO v_cola FROM net.http_request_queue;
    SELECT string_agg(DISTINCT title || ' | ' || message || ' | ' || type || ' | ' || action_url, ' / ') INTO v_txt
      FROM public.app_notifications WHERE user_id IN (v_lider1, v_m1) AND action_url = '/agenda?tarea=' || t1;

    IF n <> 2 OR n2 <> 0 OR n3 <> 0 OR v_cola <> v_cola0
       OR (SELECT count(*) FROM public.app_notifications WHERE action_url = '/agenda?tarea=' || t1) <> 2 THEN
        RAISE EXCEPTION 'FALLÓ 1: app=% email=% encargado=% cola=%/%', n, n2, n3, v_cola, v_cola0;
    END IF;
    IF v_txt IS DISTINCT FROM 'Nueva tarea: Flyer SE PRUEBA | Diseño SE PRUEBA · mar 03/11 · 19:00 – 20:30 | AGENDA_TAREA_ASIGNADA | /agenda?tarea=' || t1 THEN
        RAISE EXCEPTION 'FALLÓ 1: texto %', v_txt;
    END IF;
    o := o || format(E'| 1 | Asignar a un sub con líder + 2 integrantes (uno es encargado) | 2 avisos de app, 0 de email, nada en la cola de pg_net, sin el encargado | app=%s email=%s encargado=%s cola=%s | ✅ |\n',
                     n, n2, n3, v_cola - v_cola0);

    -- ════════════════════════════════════════════════════════════════════════
    -- 2 · Reasignar a Video y volver a Diseño: nada repetido
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_reasignar_tarea(t1, v_sub2);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 2: a Video %', r; END IF;
    r := public.agenda_reasignar_tarea(t1, v_sub1);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 2: de vuelta %', r; END IF;
    RESET ROLE;

    SELECT count(*) INTO n  FROM public.app_notifications WHERE user_id IN (v_lider1, v_m1) AND action_url = '/agenda?tarea=' || t1;
    SELECT count(*) INTO n2 FROM public.app_notifications WHERE user_id = v_lider2 AND action_url = '/agenda?tarea=' || t1;
    SELECT count(*) INTO n3 FROM public.agenda_avisos WHERE tarea_id = t1;
    SELECT count(*) INTO v_cola FROM net.http_request_queue;
    IF n <> 2 OR n2 <> 1 OR n3 <> 3 OR v_cola <> v_cola0 THEN
        RAISE EXCEPTION 'FALLÓ 2: primeros=% video=% avisos=% cola=%', n, n2, n3, v_cola - v_cola0;
    END IF;
    o := o || format(E'| 2 | Reasignar a otro sub y volver al primero | a los primeros nada nuevo; al de Video, uno | primeros=%s · Video=%s · avisos=%s | ✅ |\n', n, n2, n3);

    -- ════════════════════════════════════════════════════════════════════════
    -- 3 · Completar, reabrir y completar de nuevo
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_cambiar_estado_tarea(t1, 'completada');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 3: completar %', r; END IF;
    r := public.agenda_cambiar_estado_tarea(t1, 'en_proceso');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 3: reabrir %', r; END IF;
    -- Ahora la completa un integrante: le toca al encargado que faltaba.
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m1, 'role', 'authenticated')::text, true);
    r := public.agenda_cambiar_estado_tarea(t1, 'completada');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 3: completar 2 %', r; END IF;
    RESET ROLE;

    SELECT count(*) INTO n  FROM public.agenda_avisos WHERE tarea_id = t1 AND tipo = 'completada' AND user_id = v_encA;
    SELECT count(*) INTO n2 FROM public.agenda_avisos WHERE tarea_id = t1 AND tipo = 'completada' AND user_id = v_encA2;
    SELECT count(*) INTO n3 FROM public.agenda_avisos WHERE tarea_id = t1 AND canal <> 'app';
    SELECT count(*) INTO v_cola FROM net.http_request_queue;
    SELECT string_agg(DISTINCT title, ' / ') INTO v_txt
      FROM public.app_notifications WHERE type = 'AGENDA_TAREA_COMPLETADA' AND action_url = '/agenda?tarea=' || t1;
    IF n <> 1 OR n2 <> 1 OR n3 <> 0 OR v_cola <> v_cola0 THEN
        RAISE EXCEPTION 'FALLÓ 3: encA=% encA2=% no-app=% cola=%', n, n2, n3, v_cola - v_cola0;
    END IF;
    o := o || format(E'| 3 | Completar (la encargada), reabrir y completar de nuevo (un integrante) | 1ª vez sólo al otro encargado; 2ª vez al que faltaba, sin repetir | encA=%s · encA2=%s · "%s" | ✅ |\n', n, n2, v_txt);

    -- ════════════════════════════════════════════════════════════════════════
    -- 4 · Alguien sin email recibe la notificación igual
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_crear_tarea(t2, v_depA, v_sub3, NULL, NULL, 'Sonido SE PRUEBA', NULL, '2026-11-04', true, NULL, NULL);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 4: crear %', r; END IF;
    RESET ROLE;
    SELECT count(*) INTO n FROM public.app_notifications WHERE user_id = v_sinm AND action_url = '/agenda?tarea=' || t2;
    SELECT count(*) INTO n2 FROM public.agenda_avisos WHERE tarea_id = t2 AND canal <> 'app';
    IF n <> 1 OR n2 <> 0 THEN RAISE EXCEPTION 'FALLÓ 4: notificaciones=% no-app=%', n, n2; END IF;
    o := o || format(E'| 4 | Quien no tiene email cargado | la notificación le llega igual | notificaciones=%s | ✅ |\n', n);

    -- ════════════════════════════════════════════════════════════════════════
    -- 5 · Lo de los emails ya no existe, y el canal no se puede escribir
    -- ════════════════════════════════════════════════════════════════════════
    IF to_regprocedure('public.agenda_pedir_emails(uuid,text)') IS NOT NULL
       OR to_regprocedure('public.agenda_emails_desde()') IS NOT NULL THEN
        RAISE EXCEPTION 'FALLÓ 5: las funciones de email siguen ahí';
    END IF;
    v_ok := false;
    BEGIN
        INSERT INTO public.agenda_avisos (tarea_id, user_id, tipo, canal, estado)
        VALUES (t2, v_encA, 'asignada', 'email', 'pendiente');
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'FALLÓ 5: se pudo escribir un aviso de canal email'; END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'agenda_avisos_emails_enviados') THEN
        RAISE EXCEPTION 'FALLÓ 5: el índice de emails sigue ahí';
    END IF;
    o := o || E'| 5 | agenda_pedir_emails, agenda_emails_desde, el índice y el canal email | no existen, y el CHECK rechaza escribir email | igual | ✅ |\n';

    -- ═════════════════════════════════════════════════════════════════════════
    -- 6 · Las solicitudes avisan como siempre (caso traído de la prueba vieja)
    -- ═════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_solic, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_crear_solicitud(s1, v_depA, NULL, 'Necesitamos   cuatro placas'||E'
'||'para noviembre, una por domingo. ' || repeat('Más texto. ', 20));
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 6: s1 %', r; END IF;
    r := public.agenda_crear_solicitud(s2, v_depA, NULL, 'Un video corto PRUEBA');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 6: s2 %', r; END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    r := public.agenda_revisar_solicitud(s1, 'aceptar');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 6: aceptar %', r; END IF;
    r := public.agenda_revisar_solicitud(s2, 'rechazar');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 6: rechazar %', r; END IF;
    r := public.agenda_revisar_solicitud(s1, 'rechazar');   -- ya revisada: no cambia nada
    RESET ROLE;
    SELECT count(*) INTO n FROM public.app_notifications WHERE type = 'AGENDA_SOLICITUD_NUEVA' AND user_id IN (v_encA, v_encA2);
    SELECT count(*) INTO n2 FROM public.app_notifications WHERE type = 'AGENDA_SOLICITUD_REVISADA' AND user_id = v_solic;
    SELECT count(*) INTO n3 FROM public.app_notifications WHERE type LIKE 'AGENDA_SOLICITUD%'
       AND user_id IN (v_super, v_lider1, v_m1, v_lider2, v_sinm);
    SELECT message, action_url INTO v_txt, v_txt2 FROM public.app_notifications
     WHERE type = 'AGENDA_SOLICITUD_NUEVA' AND user_id = v_encA AND message LIKE 'Solicitante PRUEBA · Necesitamos%';
    SELECT count(*) INTO v_cola FROM net.http_request_queue;
    IF n <> 4 OR n2 <> 2 OR n3 <> 0 OR v_cola <> v_cola0 OR v_txt IS NULL
       OR length(v_txt) <> length('Solicitante PRUEBA · ') + 90 OR v_txt LIKE '%  %'
       OR v_txt2 IS DISTINCT FROM '/departamentos/' || v_depA || '?tab=solicitudes' THEN
        RAISE EXCEPTION 'FALLÓ 6: nuevas=% revisadas=% otros=% cola=% "%" %', n, n2, n3, v_cola - v_cola0, v_txt, v_txt2;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.app_notifications
                    WHERE type = 'AGENDA_SOLICITUD_REVISADA' AND user_id = v_solic
                      AND action_url = '/perfil/solicitudes') THEN
        RAISE EXCEPTION 'FALLÓ 6: la revisada no lleva a /perfil/solicitudes';
    END IF;
    SELECT string_agg(title, ' / ' ORDER BY title) INTO v_txt FROM public.app_notifications
     WHERE type = 'AGENDA_SOLICITUD_REVISADA' AND user_id = v_solic;
    o := o || format(E'| 6 | 2 solicitudes nuevas, aceptar una, rechazar la otra, re-revisar | 2×2 a los encargados, 2 a quien pidió (a /perfil/solicitudes), nada a nadie más ni a pg_net | nuevas=%s · revisadas=%s (%s) · otros=%s · detalles a 90 caracteres en una línea | ✅ |
', n, n2, v_txt, n3);

    -- ════════════════════════════════════════════════════════════════════════
    -- 7 · Los permisos siguen cerrados
    -- ════════════════════════════════════════════════════════════════════════
    v_txt := '';
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    BEGIN
        PERFORM 1 FROM public.agenda_avisos LIMIT 1;
        v_txt := v_txt || 'SELECT authenticated PASÓ · ';
    EXCEPTION WHEN insufficient_privilege THEN v_txt := v_txt || 'SELECT no · ';
    END;
    BEGIN
        PERFORM public.agenda_registrar_avisos(t2, 'asignada', ARRAY[v_encA], 'x', 'y', 'z');
        v_txt := v_txt || 'EXECUTE PASÓ';
    EXCEPTION WHEN insufficient_privilege THEN v_txt := v_txt || 'EXECUTE no';
    END;
    RESET ROLE;
    IF v_txt <> 'SELECT no · EXECUTE no' THEN RAISE EXCEPTION 'FALLÓ 7: %', v_txt; END IF;
    o := o || format(E'| 7 | authenticated: leer agenda_avisos y ejecutar agenda_registrar_avisos | error de permiso en las dos | %s | ✅ |\n', v_txt);

    RAISE EXCEPTION E'RESULTADO ✅ todos los casos en verde\n%\nPedidos a pg_net sumados por la prueba: %', o, v_cola - v_cola0;
END;
$prueba$;

ROLLBACK;
