-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de sql/agenda_avisos.sql
--
-- Todo corre adentro de BEGIN … ROLLBACK y de UN bloque que termina con
-- RAISE EXCEPTION a propósito: se deshace entero —usuarios, departamentos,
-- tareas, avisos, notificaciones, el secreto borrado, los pedidos a pg_net y
-- la fecha de activación cambiada— y el resultado viaja en el mensaje:
-- "RESULTADO ✅ …" con la tabla, o "FALLÓ <caso>: …" en el primero que falla.
-- NUNCA COMMIT. Los pedidos a pg_net también se deshacen: no sale ningún email.
--
-- La fecha: agenda_emails_desde() se reemplaza DENTRO de la transacción para
-- simular "antes" y "después" del lunes 2/11/2026.
--
-- Para ensayar ANTES de aplicar: BEGIN; + sql/agenda_avisos.sql + el DO de
-- abajo + ROLLBACK; en un solo envío.
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
    t1 uuid := gen_random_uuid(); t2 uuid := gen_random_uuid(); t3 uuid := gen_random_uuid(); t4 uuid := gen_random_uuid();
    s1 uuid := gen_random_uuid(); s2 uuid := gen_random_uuid();
    r jsonb;
    n integer; n2 integer; n3 integer;
    v_txt text; v_txt2 text;
    v_ok boolean;
    v_cola bigint;
    o text := '';
BEGIN
    -- ── Preparación ─────────────────────────────────────────────────────────
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at) VALUES
        (v_super,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.p8.super@test.local',  '', now(), now()),
        (v_encA,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.p8.enca@test.local',   '', now(), now()),
        (v_encA2,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.p8.enca2@test.local',  '', now(), now()),
        (v_lider1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.p8.lider1@test.local', '', now(), now()),
        (v_m1,     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.p8.m1@test.local',     '', now(), now()),
        (v_lider2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.p8.lider2@test.local', '', now(), now()),
        (v_sinm,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.p8.sinm@test.local',   '', now(), now()),
        (v_solic,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.p8.solic@test.local',  '', now(), now());
    INSERT INTO public.users (id, name, email, role, roles, is_active) VALUES
        (v_super,  'Sistemas PRUEBA',     'prueba.p8.super@test.local',  'SUPER_ADMIN', ARRAY['SUPER_ADMIN'], true),
        (v_encA,   'Encargada PRUEBA',    'prueba.p8.enca@test.local',   'VIEWER', ARRAY['VIEWER'], true),
        (v_encA2,  'Encargado PRUEBA',    'prueba.p8.enca2@test.local',  'VIEWER', ARRAY['VIEWER'], true),
        (v_lider1, 'Líder Uno PRUEBA',    'prueba.p8.lider1@test.local', 'VIEWER', ARRAY['VIEWER'], true),
        (v_m1,     'Miembro PRUEBA',      'prueba.p8.m1@test.local',     'VIEWER', ARRAY['VIEWER'], true),
        (v_lider2, 'Líder Dos PRUEBA',    'prueba.p8.lider2@test.local', 'VIEWER', ARRAY['VIEWER'], true),
        (v_sinm,   'Sin Email PRUEBA',    'prueba.p8.sinm@test.local',   'VIEWER', ARRAY['VIEWER'], true),
        (v_solic,  'Solicitante PRUEBA',  'prueba.p8.solic@test.local',  'VIEWER', ARRAY['VIEWER'], true)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role,
                                   roles = EXCLUDED.roles, is_active = true;
    -- users.email es NOT NULL: "sin email" es vacío.
    UPDATE public.users SET email = '' WHERE id = v_sinm;

    -- Antes del lunes, salvo que una prueba diga otra cosa.
    EXECUTE $f$CREATE OR REPLACE FUNCTION public.agenda_emails_desde() RETURNS timestamptz
               LANGUAGE sql IMMUTABLE AS $q$ SELECT now() + interval '30 days' $q$ $f$;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_guardar_departamento(v_depA, 'Creativos P8 PRUEBA', '#7c3aed', 'palette', ARRAY[v_encA, v_encA2]);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ prep dep %', r; END IF;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    r := public.agenda_guardar_subdepartamento(v_sub1, v_depA, 'Diseño P8 PRUEBA', '#db2777', v_lider1, ARRAY[v_m1, v_encA2]);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ prep sub1 %', r; END IF;
    r := public.agenda_guardar_subdepartamento(v_sub2, v_depA, 'Video P8 PRUEBA', '#2563eb', v_lider2, '{}');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ prep sub2 %', r; END IF;
    r := public.agenda_guardar_subdepartamento(v_sub3, v_depA, 'Sonido P8 PRUEBA', '#16a34a', v_sinm, '{}');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ prep sub3 %', r; END IF;
    RESET ROLE;

    -- ════════════════════════════════════════════════════════════════════════
    -- 1 · Asignar a Diseño (líder + 2 miembros, uno de ellos encargado)
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_crear_tarea(t1, v_depA, v_sub1, NULL, NULL, 'Flyer P8 PRUEBA', NULL, '2026-11-03', false, '19:00', '20:30');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 1: crear %', r; END IF;
    RESET ROLE;
    SELECT count(*) FILTER (WHERE canal = 'app'), count(*) FILTER (WHERE canal = 'email'),
           count(*) FILTER (WHERE user_id = v_encA2)
      INTO n, n2, n3 FROM public.agenda_avisos WHERE tarea_id = t1 AND tipo = 'asignada';
    SELECT string_agg(DISTINCT title || ' | ' || message || ' | ' || type || ' | ' || action_url, ' / ') INTO v_txt
      FROM public.app_notifications WHERE user_id IN (v_lider1, v_m1) AND action_url = '/agenda?tarea=' || t1;
    IF n <> 2 OR n2 <> 2 OR n3 <> 0
       OR (SELECT count(*) FROM public.app_notifications WHERE action_url = '/agenda?tarea=' || t1) <> 2 THEN
        RAISE EXCEPTION 'FALLÓ 1: app=% email=% encargado=%', n, n2, n3;
    END IF;
    IF v_txt IS DISTINCT FROM 'Nueva tarea: Flyer P8 PRUEBA | Diseño P8 PRUEBA · mar 03/11 · 19:00 – 20:30 | AGENDA_TAREA_ASIGNADA | /agenda?tarea=' || t1 THEN
        RAISE EXCEPTION 'FALLÓ 1: texto %', v_txt;
    END IF;
    o := o || format(E'| 1 | Asignar a un sub con líder + 2 miembros (uno es encargado) | 2 app y 2 email, sin el encargado | app=%s email=%s encargado=%s · "%s" | ✅ |\n',
                     n, n2, n3, split_part(v_txt, ' | /agenda', 1));

    -- ════════════════════════════════════════════════════════════════════════
    -- 2 · Reasignar a Video y volver a Diseño: a los primeros no se repite
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_reasignar_tarea(t1, v_sub2);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 2: a Video %', r; END IF;
    r := public.agenda_reasignar_tarea(t1, v_sub1);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 2: vuelta %', r; END IF;
    RESET ROLE;
    SELECT count(*) INTO n FROM public.app_notifications WHERE user_id IN (v_lider1, v_m1) AND action_url = '/agenda?tarea=' || t1;
    SELECT count(*) INTO n2 FROM public.app_notifications WHERE user_id = v_lider2 AND action_url = '/agenda?tarea=' || t1;
    SELECT count(*) INTO n3 FROM public.agenda_avisos WHERE tarea_id = t1 AND tipo = 'asignada';
    IF n <> 2 OR n2 <> 1 OR n3 <> 6 THEN RAISE EXCEPTION 'FALLÓ 2: primeros=% video=% avisos=%', n, n2, n3; END IF;
    o := o || format(E'| 2 | Reasignar a otro sub y volver al primero | a los primeros nada nuevo; el de Video, uno | primeros=%s (siguen 2) · Video=%s · avisos=%s | ✅ |\n', n, n2, n3);

    -- ════════════════════════════════════════════════════════════════════════
    -- 3 · Completar (lo hace un encargado), reabrir y completar de nuevo
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA2, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_cambiar_estado_tarea(t1, 'completada');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 3: completar %', r; END IF;
    r := public.agenda_cambiar_estado_tarea(t1, 'en_proceso');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 3: reabrir %', r; END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m1, 'role', 'authenticated')::text, true);
    r := public.agenda_cambiar_estado_tarea(t1, 'completada');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 3: completar otra vez %', r; END IF;
    RESET ROLE;
    SELECT count(*) INTO n FROM public.app_notifications WHERE user_id = v_encA AND action_url = '/agenda?tarea=' || t1;
    SELECT count(*) INTO n2 FROM public.app_notifications WHERE user_id = v_encA2 AND action_url = '/agenda?tarea=' || t1;
    SELECT message INTO v_txt FROM public.app_notifications WHERE user_id = v_encA AND type = 'AGENDA_TAREA_COMPLETADA' AND action_url = '/agenda?tarea=' || t1;
    -- Encargado PRUEBA completó la primera vez: a él no; la segunda vez la
    -- completó un miembro, pero a Encargada PRUEBA ya le había llegado y a él
    -- sí le llega (era la primera para él).
    SELECT count(*) INTO n3 FROM public.agenda_avisos WHERE tarea_id = t1 AND tipo = 'completada';
    IF n <> 1 OR n2 <> 1 OR n3 <> 4 OR v_txt IS DISTINCT FROM 'Diseño P8 PRUEBA · por Encargado PRUEBA' THEN
        RAISE EXCEPTION 'FALLÓ 3: encA=% encA2=% avisos=% "%"', n, n2, n3, v_txt;
    END IF;
    o := o || format(E'| 3 | Completar (un encargado), reabrir y completar de nuevo (un miembro) | 1ª vez sólo al otro encargado; 2ª vez nada repetido, sólo al que faltaba | Encargada=%s · Encargado=%s · avisos=%s · "%s" | ✅ |\n', n, n2, n3, v_txt);

    -- ════════════════════════════════════════════════════════════════════════
    -- 4 · Antes del lunes → email 'pausado' (y ningún pedido a pg_net)
    -- ════════════════════════════════════════════════════════════════════════
    SELECT string_agg(DISTINCT estado, ',') INTO v_txt FROM public.agenda_avisos WHERE tarea_id = t1 AND canal = 'email';
    SELECT count(*) INTO v_cola FROM net.http_request_queue WHERE url LIKE '%send-agenda-aviso%';
    IF v_txt IS DISTINCT FROM 'pausado' OR v_cola <> 0 THEN RAISE EXCEPTION 'FALLÓ 4: estados % cola %', v_txt, v_cola; END IF;
    o := o || format(E'| 4 | Antes de la fecha de activación | email "pausado", sin pedido a la función | %s · pedidos=%s | ✅ |\n', v_txt, v_cola);

    -- ════════════════════════════════════════════════════════════════════════
    -- 5 · Después del lunes → 'pendiente' y UN pedido con sólo {tarea_id, tipo}
    -- 6 · Quien no tiene email → 'sin_email'
    -- ════════════════════════════════════════════════════════════════════════
    EXECUTE $f$CREATE OR REPLACE FUNCTION public.agenda_emails_desde() RETURNS timestamptz
               LANGUAGE sql IMMUTABLE AS $q$ SELECT now() - interval '1 day' $q$ $f$;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_crear_tarea(t2, v_depA, v_sub1, NULL, NULL, 'Placas P8 PRUEBA', 'Con <b>detalles</b>', '2026-11-04', true, NULL, NULL);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 5: crear %', r; END IF;
    r := public.agenda_crear_tarea(t3, v_depA, v_sub3, NULL, NULL, 'Sonido P8 PRUEBA', NULL, '2026-11-05', true, NULL, NULL);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 6: crear %', r; END IF;
    RESET ROLE;
    SELECT string_agg(DISTINCT estado, ','), count(*) INTO v_txt, n FROM public.agenda_avisos WHERE tarea_id = t2 AND canal = 'email';
    SELECT count(*) INTO v_cola FROM net.http_request_queue WHERE url LIKE '%send-agenda-aviso%';
    SELECT string_agg(k, ',' ORDER BY k) INTO v_txt2
      FROM net.http_request_queue q, jsonb_object_keys(convert_from(q.body, 'UTF8')::jsonb) k
     WHERE q.url LIKE '%send-agenda-aviso%' AND convert_from(q.body, 'UTF8')::jsonb->>'tarea_id' = t2::text;
    IF v_txt IS DISTINCT FROM 'pendiente' OR n <> 2 OR v_cola <> 1 OR v_txt2 IS DISTINCT FROM 'tarea_id,tipo' THEN
        RAISE EXCEPTION 'FALLÓ 5: estados % (%) cola % claves %', v_txt, n, v_cola, v_txt2;
    END IF;
    o := o || format(E'| 5 | Después de la fecha | 2 emails "pendiente" y UN pedido con sólo tarea_id y tipo | %s ×%s · pedidos=%s · cuerpo={%s} | ✅ |\n', v_txt, n, v_cola, v_txt2);

    SELECT estado INTO v_txt FROM public.agenda_avisos WHERE tarea_id = t3 AND canal = 'email' AND user_id = v_sinm;
    SELECT count(*) INTO n FROM public.app_notifications WHERE user_id = v_sinm AND action_url = '/agenda?tarea=' || t3;
    SELECT count(*) INTO v_cola FROM net.http_request_queue WHERE url LIKE '%send-agenda-aviso%';
    IF v_txt IS DISTINCT FROM 'sin_email' OR n <> 1 OR v_cola <> 1 THEN RAISE EXCEPTION 'FALLÓ 6: % app=% cola=%', v_txt, n, v_cola; END IF;
    o := o || format(E'| 6 | Usuario sin email | email "sin_email", la notificación igual, sin pedido | %s · app=%s · pedidos siguen en %s | ✅ |\n', v_txt, n, v_cola);

    -- ════════════════════════════════════════════════════════════════════════
    -- 7 · Solicitudes: nueva → encargados; aceptar / rechazar → quien la pidió
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_solic, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_crear_solicitud(s1, v_depA, NULL, 'Necesitamos   cuatro placas'||E'\n'||'para noviembre, una por domingo. ' || repeat('Más texto. ', 20));
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 7: s1 %', r; END IF;
    r := public.agenda_crear_solicitud(s2, v_depA, NULL, 'Un video corto PRUEBA');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 7: s2 %', r; END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    r := public.agenda_revisar_solicitud(s1, 'aceptar');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 7: aceptar %', r; END IF;
    r := public.agenda_revisar_solicitud(s2, 'rechazar');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 7: rechazar %', r; END IF;
    r := public.agenda_revisar_solicitud(s1, 'rechazar');   -- ya revisada: no cambia nada
    RESET ROLE;
    SELECT count(*) INTO n FROM public.app_notifications WHERE type = 'AGENDA_SOLICITUD_NUEVA' AND user_id IN (v_encA, v_encA2);
    SELECT count(*) INTO n2 FROM public.app_notifications WHERE type = 'AGENDA_SOLICITUD_REVISADA' AND user_id = v_solic;
    SELECT count(*) INTO n3 FROM public.app_notifications WHERE type LIKE 'AGENDA_SOLICITUD%'
       AND user_id IN (v_super, v_lider1, v_m1, v_lider2, v_sinm);
    SELECT message, action_url INTO v_txt, v_txt2 FROM public.app_notifications
     WHERE type = 'AGENDA_SOLICITUD_NUEVA' AND user_id = v_encA AND message LIKE 'Solicitante PRUEBA · Necesitamos%';
    IF n <> 4 OR n2 <> 2 OR n3 <> 0 OR v_txt IS NULL OR length(v_txt) <> length('Solicitante PRUEBA · ') + 90
       OR v_txt LIKE '%  %' OR v_txt2 IS DISTINCT FROM '/departamentos/' || v_depA || '?tab=solicitudes' THEN
        RAISE EXCEPTION 'FALLÓ 7: nuevas=% revisadas=% otros=% "%" %', n, n2, n3, v_txt, v_txt2;
    END IF;
    SELECT string_agg(title, ' / ' ORDER BY title) INTO v_txt FROM public.app_notifications
     WHERE type = 'AGENDA_SOLICITUD_REVISADA' AND user_id = v_solic;
    o := o || format(E'| 7 | 2 solicitudes nuevas, aceptar una, rechazar la otra, re-revisar | 2×2 a los encargados, 2 a quien pidió, nada a nadie más | nuevas=%s · revisadas=%s (%s) · otros=%s · detalles a 90 caracteres en una línea | ✅ |\n', n, n2, v_txt, n3);

    -- ════════════════════════════════════════════════════════════════════════
    -- 8 · authenticated y anon no tocan agenda_avisos ni ejecutan nada
    -- ════════════════════════════════════════════════════════════════════════
    v_txt := '';
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_lider1, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    BEGIN PERFORM 1 FROM public.agenda_avisos LIMIT 1; v_txt := v_txt || 'auth-select-PASÓ ';
    EXCEPTION WHEN insufficient_privilege THEN v_txt := v_txt || 'auth-select-42501 '; END;
    BEGIN INSERT INTO public.agenda_avisos (tarea_id, user_id, tipo, canal, estado) VALUES (t1, v_lider1, 'asignada', 'app', 'enviado');
          v_txt := v_txt || 'auth-insert-PASÓ ';
    EXCEPTION WHEN insufficient_privilege THEN v_txt := v_txt || 'auth-insert-42501 '; END;
    RESET ROLE;
    SET LOCAL ROLE anon;
    BEGIN PERFORM 1 FROM public.agenda_avisos LIMIT 1; v_txt := v_txt || 'anon-select-PASÓ ';
    EXCEPTION WHEN insufficient_privilege THEN v_txt := v_txt || 'anon-select-42501 '; END;
    BEGIN INSERT INTO public.agenda_avisos (tarea_id, user_id, tipo, canal, estado) VALUES (t1, v_lider1, 'asignada', 'app', 'enviado');
          v_txt := v_txt || 'anon-insert-PASÓ ';
    EXCEPTION WHEN insufficient_privilege THEN v_txt := v_txt || 'anon-insert-42501 '; END;
    RESET ROLE;
    IF v_txt LIKE '%PASÓ%' THEN RAISE EXCEPTION 'FALLÓ 8: %', v_txt; END IF;
    SELECT bool_or(has_function_privilege(rol, f, 'EXECUTE')) INTO v_ok
      FROM unnest(ARRAY['anon', 'authenticated']) rol,
           unnest(ARRAY['public.agenda_emails_desde()',
                        'public.agenda_registrar_avisos(uuid, text, uuid[], text, text, text)',
                        'public.agenda_pedir_emails(uuid, text)',
                        'public.agenda_tareas_avisar()',
                        'public.agenda_solicitudes_avisar()']) f;
    IF v_ok THEN RAISE EXCEPTION 'FALLÓ 8: alguien tiene EXECUTE'; END IF;
    o := o || format(E'| 8 | authenticated y anon: SELECT/INSERT en agenda_avisos; EXECUTE en las 5 funciones | error de permiso ×4; sin EXECUTE | %s· EXECUTE=no | ✅ |\n', v_txt);

    -- ════════════════════════════════════════════════════════════════════════
    -- 9 · Sin el secreto de Vault, la tarea se guarda igual
    -- ════════════════════════════════════════════════════════════════════════
    DELETE FROM vault.secrets WHERE name = 'webhook_service_role_key';
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_crear_tarea(t4, v_depA, v_sub2, NULL, NULL, 'Sin secreto P8 PRUEBA', NULL, '2026-11-06', true, NULL, NULL);
    RESET ROLE;
    SELECT estado, error INTO v_txt, v_txt2 FROM public.agenda_avisos WHERE tarea_id = t4 AND canal = 'email';
    SELECT count(*) INTO v_cola FROM net.http_request_queue WHERE url LIKE '%send-agenda-aviso%';
    IF (r->>'ok')::boolean IS NOT TRUE OR NOT EXISTS (SELECT 1 FROM public.agenda_tareas WHERE id = t4)
       OR v_txt IS DISTINCT FROM 'pendiente' OR v_txt2 NOT LIKE 'Falta el secreto%' OR v_cola <> 1 THEN
        RAISE EXCEPTION 'FALLÓ 9: % % "%" cola %', r, v_txt, v_txt2, v_cola;
    END IF;
    o := o || format(E'| 9 | Falta el secreto de Vault | la tarea se guarda; el email queda pendiente con el error | ok · %s · "%s" | ✅ |\n', v_txt, v_txt2);

    RAISE EXCEPTION E'RESULTADO ✅\n%', o;
END;
$prueba$;

ROLLBACK;
