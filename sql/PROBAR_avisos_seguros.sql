-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de sql/avisos_seguros.sql.
--
-- BEGIN … ROLLBACK y UN bloque que termina con RAISE EXCEPTION a propósito:
-- se deshace entero (usuarios, grupo, inscripciones, avisos, reporte y los
-- pedidos que hayan quedado en la cola de pg_net, que por eso nunca salen).
-- "RESULTADO ✅ …" con la tabla, o "FALLÓ A<n>: …" en el primer caso que no
-- da lo esperado. NUNCA COMMIT.
--
-- Personas (apellido "PRUEBA", emails @test.local; nadie real):
--   Hugo (anfitrión) · Carla (co-anfitriona) · Mara (inscripta) · Pablo (su
--   pareja) · Gina (ADMIN_GROUPS) · Sofía (SUPER_ADMIN) · Ximena (nada).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE FUNCTION pg_temp.avisos(p_user uuid) RETURNS integer
LANGUAGE sql AS $f$ SELECT count(*)::integer FROM public.app_notifications WHERE user_id = p_user $f$;

DO $suite$
DECLARE
    h uuid := gen_random_uuid();   -- anfitrión
    c uuid := gen_random_uuid();   -- co-anfitriona
    m uuid := gen_random_uuid();   -- inscripta
    p uuid := gen_random_uuid();   -- pareja de la inscripta
    g uuid := gen_random_uuid();   -- gestora (ADMIN_GROUPS)
    s uuid := gen_random_uuid();   -- SUPER_ADMIN
    x uuid := gen_random_uuid();   -- sin relación
    grupo text := gen_random_uuid()::text;
    reg   text := gen_random_uuid()::text;
    r jsonb;
    v text;
    n integer; n2 integer;
    ajeno uuid;
    o text := '';
BEGIN
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
    SELECT id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', mail, '', now(), now()
      FROM (VALUES (h, 'prueba.av.hugo@test.local'), (c, 'prueba.av.carla@test.local'), (m, 'prueba.av.mara@test.local'),
                   (p, 'prueba.av.pablo@test.local'), (g, 'prueba.av.gina@test.local'), (s, 'prueba.av.sofia@test.local'),
                   (x, 'prueba.av.ximena@test.local')) t(id, mail);
    INSERT INTO public.users (id, name, email, role, roles, is_active) VALUES
        (h, 'Hugo PRUEBA',   'prueba.av.hugo@test.local',   'ANFITRION',   ARRAY['ANFITRION'], true),
        (c, 'Carla PRUEBA',  'prueba.av.carla@test.local',  'VIEWER',      ARRAY['CO_ANFITRION'], true),
        (m, 'Mara PRUEBA',   'prueba.av.mara@test.local',   'VIEWER',      ARRAY['VIEWER'], true),
        (p, 'Pablo PRUEBA',  'prueba.av.pablo@test.local',  'VIEWER',      ARRAY['VIEWER'], true),
        (g, 'Gina PRUEBA',   'prueba.av.gina@test.local',   'ADMIN_GROUPS', ARRAY['ADMIN_GROUPS'], true),
        (s, 'Sofía PRUEBA',  'prueba.av.sofia@test.local',  'SUPER_ADMIN', ARRAY['SUPER_ADMIN'], true),
        (x, 'Ximena PRUEBA', 'prueba.av.ximena@test.local', 'VIEWER',      ARRAY['VIEWER'], true)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role,
                                   roles = EXCLUDED.roles, is_active = true;

    INSERT INTO public.groups (id, name, leader_name, host_id, co_host_id, status)
    VALUES (grupo, 'PRUEBA Avisos', 'Hugo PRUEBA', h, c, 'approved');
    INSERT INTO public.group_registrations (id, first_name, last_name, group_id, status, user_id, partner_user_id)
    VALUES (reg, 'Mara', 'PRUEBA', grupo, 'PENDING', m, p);

    -- ── A1 · INSERT directo como authenticated: no ───────────────────────────
    PERFORM set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
    BEGIN
        SET LOCAL ROLE authenticated;
        INSERT INTO public.app_notifications (user_id, title, message, type) VALUES (h, 'Hackeo PRUEBA', 'x', 'info');
        v := 'SE PUDO';
    EXCEPTION WHEN insufficient_privilege THEN v := 'permiso denegado';
    END;
    RESET ROLE;
    BEGIN
        SET LOCAL ROLE authenticated;
        INSERT INTO public.app_notifications (user_id, title, message, type) VALUES (x, 'Propio PRUEBA', 'x', 'info');
        v := v || ', propio SE PUDO';
    EXCEPTION WHEN insufficient_privilege THEN v := v || ', propio también denegado';
    END;
    RESET ROLE;
    IF v <> 'permiso denegado, propio también denegado' THEN RAISE EXCEPTION 'FALLÓ A1: %', v; END IF;
    o := o || format(E'| A1 | INSERT directo a la tabla como authenticated (a otro y a sí mismo) | denegado | %s | ✅ |\n', v);

    -- ── A2 · Permisos de la RPC y de la tabla ───────────────────────────────
    IF has_function_privilege('anon', 'public.crear_aviso(uuid,text,text,text,text)', 'EXECUTE')
       OR NOT has_function_privilege('authenticated', 'public.crear_aviso(uuid,text,text,text,text)', 'EXECUTE')
       OR has_table_privilege('anon', 'public.app_notifications', 'INSERT')
       OR has_table_privilege('authenticated', 'public.app_notifications', 'INSERT')
       OR has_column_privilege('authenticated', 'public.app_notifications', 'title', 'UPDATE')
       OR NOT has_column_privilege('authenticated', 'public.app_notifications', 'is_read', 'UPDATE')
       OR EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_notifications' AND cmd = 'INSERT') THEN
        RAISE EXCEPTION 'FALLÓ A2: permisos de más o de menos';
    END IF;
    o := o || E'| A2 | Permisos | anon sin EXECUTE; authenticated con EXECUTE; nadie con INSERT; UPDATE sólo is_read/is_pinned; sin policy de INSERT | igual | ✅ |\n';

    -- ── A3 · Cada caso legítimo del inventario ──────────────────────────────
    v := '';
    SET LOCAL ROLE authenticated;
    -- Asistencia: el anfitrión, a sí mismo.
    PERFORM set_config('request.jwt.claims', json_build_object('sub', h, 'role', 'authenticated')::text, true);
    v := v || (public.crear_aviso(h, 'ATTENDANCE', '✅ Asistencia registrada', 'Registraste 3 presente(s) en PRUEBA Avisos.', '/mis-grupos/' || grupo || '/asistencia?vista=historial')->>'ok') || ' ';
    -- Inscripción: la inscripta y su pareja, al anfitrión y a la co-anfitriona.
    PERFORM set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
    v := v || (public.crear_aviso(h, 'REGISTRATION', 'Nueva solicitud de miembro', 'Mara PRUEBA se unió a PRUEBA Avisos.', '/panel-admin/groups?groupId=' || grupo)->>'ok') || ' ';
    v := v || (public.crear_aviso(c, 'REGISTRATION', 'Nueva solicitud de miembro', 'Mara PRUEBA se unió a PRUEBA Avisos.', '/panel-admin/groups?groupId=' || grupo)->>'ok') || ' ';
    PERFORM set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
    v := v || (public.crear_aviso(h, 'REGISTRATION', 'Nueva solicitud de pareja', 'Mara y Pablo PRUEBA se inscribieron.', '/panel-admin/groups?groupId=' || grupo)->>'ok') || ' ';
    -- Aprobar/rechazar: anfitrión y co-anfitriona a la inscripta y su pareja; la gestora también.
    PERFORM set_config('request.jwt.claims', json_build_object('sub', h, 'role', 'authenticated')::text, true);
    v := v || (public.crear_aviso(m, 'REGISTRATION_APPROVED', 'Solicitud Aprobada', 'Tu solicitud para unirte a PRUEBA Avisos ha sido aprobada.', '/')->>'ok') || ' ';
    v := v || (public.crear_aviso(p, 'REGISTRATION_APPROVED', 'Solicitud Aprobada', 'Tu solicitud para unirte a PRUEBA Avisos ha sido aprobada.', '/')->>'ok') || ' ';
    PERFORM set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
    v := v || (public.crear_aviso(m, 'REGISTRATION_REJECTED', 'Solicitud Rechazada', 'Tu solicitud no ha podido ser aceptada.', '/')->>'ok') || ' ';
    PERFORM set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated')::text, true);
    v := v || (public.crear_aviso(m, 'REGISTRATION_APPROVED', 'Solicitud Aprobada', 'Aprobada por la gestora.', '/')->>'ok') || ' ';
    -- Aprobar/rechazar un grupo: la gestora, al anfitrión y a la co-anfitriona.
    v := v || (public.crear_aviso(h, 'GROUP_APPROVED', '¡Tu grupo fue aprobado! 🎉', 'Tu grupo "PRUEBA Avisos" ha sido aprobado.', '/mis-grupos')->>'ok') || ' ';
    v := v || (public.crear_aviso(c, 'GROUP_REJECTED', 'Actualización sobre tu grupo', 'No ha podido ser aprobado. Motivo: PRUEBA', '/mis-grupos')->>'ok');
    RESET ROLE;
    SELECT count(*) INTO n FROM public.app_notifications WHERE user_id IN (h, c, m, p) AND creado_por IS NOT NULL;
    IF v <> 'true true true true true true true true true true' OR n <> 10 THEN RAISE EXCEPTION 'FALLÓ A3: % (%)', v, n; END IF;
    o := o || format(E'| A3 | Los 10 casos del inventario (asistencia; inscribirse al anfitrión y co-anfitriona, también la pareja; aprobar/rechazar desde anfitrión, co-anfitriona y gestora; aprobar/rechazar grupo desde la gestora) | ok, con creado_por | %s avisos, todos ok | ✅ |\n', n);

    -- ── A4 · Sin relación → sin_permiso ─────────────────────────────────────
    v := '';
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
    v := v || (public.crear_aviso(h, 'ATTENDANCE', 'T', 'M')->>'motivo') || ',';                         -- a otro, como asistencia
    v := v || (public.crear_aviso(h, 'REGISTRATION', 'T', 'M')->>'motivo') || ',';                       -- sin inscripción en su grupo
    v := v || (public.crear_aviso(m, 'REGISTRATION_APPROVED', 'T', 'M')->>'motivo') || ',';              -- no es anfitriona
    v := v || (public.crear_aviso(gen_random_uuid(), 'ATTENDANCE', 'T', 'M')->>'motivo') || ',';         -- no existe
    PERFORM set_config('request.jwt.claims', json_build_object('sub', h, 'role', 'authenticated')::text, true);
    v := v || (public.crear_aviso(c, 'GROUP_APPROVED', 'T', 'M')->>'motivo') || ',';                     -- el anfitrión no es gestor
    v := v || (public.crear_aviso(x, 'REGISTRATION_APPROVED', 'T', 'M')->>'motivo') || ',';              -- no está inscripta
    PERFORM set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated')::text, true);
    v := v || (public.crear_aviso(x, 'GROUP_APPROVED', 'T', 'M')->>'motivo') || ',';                     -- gestora a quien no tiene grupo
    v := v || (public.crear_aviso(gen_random_uuid(), 'REGISTRATION_APPROVED', 'T', 'M')->>'motivo');    -- gestora a quien no existe
    RESET ROLE;
    IF v <> 'sin_permiso,sin_permiso,sin_permiso,sin_permiso,sin_permiso,sin_permiso,sin_permiso,sin_permiso' THEN RAISE EXCEPTION 'FALLÓ A4: %', v; END IF;
    o := o || E'| A4 | 8 casos sin relación (a otro como asistencia, sin inscripción, no anfitriona, destinatario inexistente, anfitrión que no es gestor, a quien no está inscripto, gestora a quien no tiene grupo ni existe) | sin_permiso, igual exista o no | 8 × sin_permiso | ✅ |\n';

    -- ── A5 · Tipos fuera de la lista ─────────────────────────────────────────
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', h, 'role', 'authenticated')::text, true);
    v := (public.crear_aviso(h, 'info', 'T', 'M')->>'motivo') || ',' || (public.crear_aviso(h, 'PUSH_PRUEBA', 'T', 'M')->>'motivo')
         || ',' || (public.crear_aviso(h, 'AGENDA_TAREA_ASIGNADA', 'T', 'M')->>'motivo') || ',' || (public.crear_aviso(h, NULL, 'T', 'M')->>'motivo');
    RESET ROLE;
    IF v <> 'tipo_invalido,tipo_invalido,tipo_invalido,tipo_invalido' THEN RAISE EXCEPTION 'FALLÓ A5: %', v; END IF;
    o := o || format(E'| A5 | Tipos info, PUSH_PRUEBA, AGENDA_TAREA_ASIGNADA, NULL | tipo_invalido | %s | ✅ |\n', v);

    -- ── A6 · Rutas ───────────────────────────────────────────────────────────
    SET LOCAL ROLE authenticated;
    v := '';
    v := v || (public.crear_aviso(h, 'ATTENDANCE', 'T', 'M', 'https://malo.com/x')->>'motivo') || ',';
    v := v || (public.crear_aviso(h, 'ATTENDANCE', 'T', 'M', '//malo.com')->>'motivo') || ',';
    v := v || (public.crear_aviso(h, 'ATTENDANCE', 'T', 'M', 'javascript:alert(1)')->>'motivo') || ',';
    v := v || (public.crear_aviso(h, 'ATTENDANCE', 'T', 'M', '/a?ir=http://malo.com')->>'motivo') || ',';
    v := v || (public.crear_aviso(h, 'ATTENDANCE', 'T', 'M', '/con espacio')->>'motivo') || ',';
    v := v || (public.crear_aviso(h, 'ATTENDANCE', 'T', 'M', E'/con\nsalto')->>'motivo') || ',';
    v := v || (public.crear_aviso(h, 'ATTENDANCE', 'T', 'M', '/\malo.com')->>'motivo') || ',';
    v := v || (public.crear_aviso(h, 'ATTENDANCE', 'Ruta buena PRUEBA', 'M', '/mis-grupos')->>'ok') || ',';
    v := v || (public.crear_aviso(h, 'ATTENDANCE', 'Sin ruta PRUEBA', 'M', NULL)->>'ok');
    RESET ROLE;
    IF v <> 'url_invalida,url_invalida,url_invalida,url_invalida,url_invalida,url_invalida,url_invalida,true,true' THEN RAISE EXCEPTION 'FALLÓ A6: %', v; END IF;
    o := o || E'| A6 | https://…, //malo, javascript:, http dentro de la query, espacio, salto, barra invertida; /mis-grupos y sin ruta | las 7 primeras url_invalida; las 2 últimas ok | igual | ✅ |\n';

    -- ── A7 · Textos ──────────────────────────────────────────────────────────
    SET LOCAL ROLE authenticated;
    v := '';
    v := v || (public.crear_aviso(h, 'ATTENDANCE', '   ', 'M')->>'motivo') || ',';
    v := v || (public.crear_aviso(h, 'ATTENDANCE', 'T', '')->>'motivo') || ',';
    v := v || (public.crear_aviso(h, 'ATTENDANCE', repeat('t', 121), 'M')->>'motivo') || ',';
    v := v || (public.crear_aviso(h, 'ATTENDANCE', 'T', repeat('m', 501))->>'motivo') || ',';
    v := v || (public.crear_aviso(h, 'ATTENDANCE', repeat('t', 120), repeat('m', 500))->>'ok');
    RESET ROLE;
    SELECT count(*) INTO n FROM public.app_notifications WHERE user_id = h AND title = repeat('t', 120);
    IF v <> 'texto_invalido,texto_invalido,texto_invalido,texto_invalido,true' OR n <> 1 THEN RAISE EXCEPTION 'FALLÓ A7: %', v; END IF;
    o := o || E'| A7 | Título en blanco, mensaje vacío, título de 121, mensaje de 501; y 120/500 justos | 4 × texto_invalido; el justo ok | igual | ✅ |\n';

    -- ── A8 · Tope de 60 por hora (SUPER_ADMIN sin tope) ─────────────────────
    SELECT count(*) INTO n FROM public.app_notifications WHERE creado_por = m AND created_at > now() - interval '1 hour';
    PERFORM set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    FOR i IN (n + 1)..60 LOOP
        r := public.crear_aviso(m, 'ATTENDANCE', 'Tope PRUEBA', 'M');
        IF (r->>'ok')::boolean IS NOT TRUE THEN RESET ROLE; RAISE EXCEPTION 'FALLÓ A8: el aviso % de 60 dio %', i, r; END IF;
    END LOOP;
    v := public.crear_aviso(m, 'ATTENDANCE', 'Tope PRUEBA', 'M')->>'motivo';
    PERFORM set_config('request.jwt.claims', json_build_object('sub', s, 'role', 'authenticated')::text, true);
    n2 := 0;
    FOR i IN 1..70 LOOP
        IF (public.crear_aviso(s, 'ATTENDANCE', 'Super PRUEBA', 'M')->>'ok')::boolean THEN n2 := n2 + 1; END IF;
    END LOOP;
    RESET ROLE;
    IF v IS DISTINCT FROM 'limite' OR n2 <> 70 THEN RAISE EXCEPTION 'FALLÓ A8: el 61 dio %, super %/70', v, n2; END IF;
    o := o || format(E'| A8 | Mara crea 60 en una hora y pide el 61; Sofía (SUPER_ADMIN) crea 70 | el 61 → limite; Sofía sin tope | 61 → %s; Sofía %s/70 | ✅ |\n', v, n2);

    -- ── A9 · Lo que crea la base sigue andando ──────────────────────────────
    -- push_enviar_prueba (función) y el aviso de reporte (trigger), los dos
    -- con la sesión de un usuario común, con la policy de INSERT ya cerrada.
    INSERT INTO public.push_suscripciones (user_id, endpoint, p256dh, auth)
    VALUES (x, 'https://fcm.googleapis.com/fcm/send/PRUEBA-avisos', 'BPRUEBA' || repeat('a', 80), 'auth-PRUEBA');
    n := pg_temp.avisos(x);
    SELECT count(*) INTO n2 FROM public.app_notifications WHERE type = 'REPORTE_PROBLEMA';
    PERFORM set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v := (public.push_enviar_prueba()->>'ok') || ',' || (public.crear_reporte_problema('Reporte PRUEBA de avisos seguros', 'Otra')->>'ok');
    RESET ROLE;
    IF v <> 'true,true' OR pg_temp.avisos(x) <> n + 1
       OR (SELECT count(*) FROM public.app_notifications WHERE type = 'REPORTE_PROBLEMA') <= n2 THEN
        RAISE EXCEPTION 'FALLÓ A9: %, avisos de Ximena % → %, de reporte % → %', v, n, pg_temp.avisos(x), n2,
            (SELECT count(*) FROM public.app_notifications WHERE type = 'REPORTE_PROBLEMA');
    END IF;
    o := o || format(E'| A9 | push_enviar_prueba y el aviso del trigger de reportes, con la sesión de un usuario común | siguen creando su aviso | %s; prueba +1, reportes +%s | ✅ |\n',
                     v, (SELECT count(*) FROM public.app_notifications WHERE type = 'REPORTE_PROBLEMA') - n2);

    -- ── A10 · UPDATE / DELETE / SELECT de lo ajeno; lo propio, sólo leído y fijado ─
    SELECT id INTO ajeno FROM public.app_notifications WHERE user_id = h LIMIT 1;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.app_notifications SET is_read = true WHERE id = ajeno;
    GET DIAGNOSTICS n = ROW_COUNT;
    DELETE FROM public.app_notifications WHERE id = ajeno;
    GET DIAGNOSTICS n2 = ROW_COUNT;
    v := format('update ajeno %s, delete ajeno %s, select ajeno %s', n, n2, (SELECT count(*) FROM public.app_notifications WHERE id = ajeno));
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', h, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.app_notifications SET is_read = true, is_pinned = true WHERE id = ajeno;
    GET DIAGNOSTICS n = ROW_COUNT;
    v := v || format(', leído/fijado propio %s', n);
    RESET ROLE;
    BEGIN
        SET LOCAL ROLE authenticated;
        UPDATE public.app_notifications SET title = 'Cambiado PRUEBA' WHERE id = ajeno;
        v := v || ', título propio SE PUDO';
    EXCEPTION WHEN insufficient_privilege THEN v := v || ', título propio no';
    END;
    RESET ROLE;
    BEGIN
        SET LOCAL ROLE authenticated;
        UPDATE public.app_notifications SET user_id = x WHERE id = ajeno;
        v := v || ', pasárselo a otro SE PUDO';
    EXCEPTION WHEN insufficient_privilege THEN v := v || ', pasárselo a otro no';
    END;
    RESET ROLE;
    IF v <> 'update ajeno 0, delete ajeno 0, select ajeno 0, leído/fijado propio 1, título propio no, pasárselo a otro no' THEN
        RAISE EXCEPTION 'FALLÓ A10: %', v;
    END IF;
    o := o || format(E'| A10 | Ximena con un aviso de Hugo; Hugo con el suyo | ajeno: 0 filas; propio: leído y fijado sí, título y dueño no | %s | ✅ |\n', v);

    -- ── A11 · El trigger de push sigue prendido ──────────────────────────────
    SELECT tgenabled::text INTO v FROM pg_trigger WHERE tgname = 'trg_app_notifications_push';
    IF v IS DISTINCT FROM 'O' THEN RAISE EXCEPTION 'FALLÓ A11: %', v; END IF;
    o := o || format(E'| A11 | trg_app_notifications_push | prendido (O) | %s | ✅ |\n', v);

    RAISE EXCEPTION E'RESULTADO ✅ 11/11\n%', o;
END;
$suite$;

ROLLBACK;
