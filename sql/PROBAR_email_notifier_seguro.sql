-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de sql/email_notifier_seguro.sql.
--
-- BEGIN … ROLLBACK y UN bloque que termina con RAISE EXCEPTION a propósito:
-- se deshace entero, incluida la cola de pg_net (los pedidos nunca salen).
-- "RESULTADO ✅ …" con la tabla, o "FALLÓ E<n>: …". NUNCA COMMIT.
--
-- Lo que se prueba, caso por caso: que cada uno de los cinco avisos salga en
-- su transición y sólo en esa, que el cuerpo lleve nada más que { evento, id }
-- (nunca un nombre, un teléfono ni una dirección de email), que la operación
-- principal se guarde aunque pg_net falle, y los permisos.
--
-- Personas y filas de prueba: Hugo (anfitrión), Vera (ingresante), el grupo
-- "PRUEBA email-notifier" y una postulación. Todo con PRUEBA en el nombre.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE FUNCTION pg_temp.cola() RETURNS integer
LANGUAGE sql AS $f$ SELECT count(*)::integer FROM net.http_request_queue WHERE url LIKE '%/email-notifier' $f$;
CREATE FUNCTION pg_temp.ultimo() RETURNS net.http_request_queue
LANGUAGE sql AS $f$ SELECT * FROM net.http_request_queue WHERE url LIKE '%/email-notifier' ORDER BY id DESC LIMIT 1 $f$;
-- Las claves del cuerpo, ordenadas, y el cuerpo como texto.
CREATE FUNCTION pg_temp.claves(j jsonb) RETURNS text
LANGUAGE sql AS $f$ SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(j) k $f$;

DO $suite$
DECLARE
    h uuid := gen_random_uuid();
    vera uuid := gen_random_uuid();
    grupo text := gen_random_uuid()::text;
    post uuid := gen_random_uuid();
    ing uuid;
    c0 integer; c1 integer;
    q net.http_request_queue;
    cuerpo jsonb;
    crudo text;
    v text;
    v_def text;
    o text := '';
    -- Lo que NUNCA puede aparecer en el cuerpo de un pedido.
    PERSONAL text := '(Hugo|Vera|PRUEBA|test\.local|1130000000|1140000000)';
BEGIN
    -- Hugo: el anfitrión. Nace VIEWER (handle_new_user) y recién en E6 se le
    -- suma ANFITRION, que es justo la transición que hay que probar.
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
    VALUES (h, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.en.hugo@test.local', '', now(), now());
    INSERT INTO public.users (id, name, email, role, roles, is_active)
    VALUES (h, 'Hugo PRUEBA', 'prueba.en.hugo@test.local', 'VIEWER', ARRAY['VIEWER'], true)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email,
                                   role = 'VIEWER', roles = ARRAY['VIEWER'], is_active = true;

    -- ── E1 · Grupo nuevo (INSERT en groups) ─────────────────────────────────
    c0 := pg_temp.cola();
    INSERT INTO public.groups (id, name, leader_name, leader_surname, leader_phone, host_id, status)
    VALUES (grupo, 'PRUEBA email-notifier', 'Hugo', 'PRUEBA', '1130000000', h, 'pending');
    c1 := pg_temp.cola();
    q := pg_temp.ultimo();
    crudo := convert_from(q.body, 'UTF8');
    cuerpo := crudo::jsonb;
    IF c1 <> c0 + 1
       OR pg_temp.claves(cuerpo) IS DISTINCT FROM 'evento,id'
       OR cuerpo->>'evento' IS DISTINCT FROM 'grupo_nuevo'
       OR cuerpo->>'id' IS DISTINCT FROM grupo
       OR q.headers->>'Authorization' NOT LIKE 'Bearer %'
       OR length(q.headers->>'Authorization') < 40
       OR q.timeout_milliseconds <> 20000 THEN
        RAISE EXCEPTION 'FALLÓ E1: cola % → %, cuerpo %, timeout %', c0, c1, crudo, q.timeout_milliseconds;
    END IF;
    IF crudo ~* PERSONAL THEN RAISE EXCEPTION 'FALLÓ E1: datos personales en el pedido: %', crudo; END IF;
    o := o || format(E'| E1 | Grupo nuevo (INSERT en groups) | 1 pedido {evento,id} con evento grupo_nuevo, la clave y timeout 20000 | cola +%s; {%s}; evento %s; timeout %s; sin nombre ni teléfono | ✅ |\n',
                     c1 - c0, pg_temp.claves(cuerpo), cuerpo->>'evento', q.timeout_milliseconds);

    -- ── E2 · Editar el grupo sin tocar el status: nada ──────────────────────
    c0 := pg_temp.cola();
    UPDATE public.groups SET members_count = COALESCE(members_count, 0) + 1 WHERE id = grupo;
    UPDATE public.groups SET description = 'otra cosa' WHERE id = grupo;
    c1 := pg_temp.cola();
    IF c1 <> c0 THEN RAISE EXCEPTION 'FALLÓ E2: cola % → %', c0, c1; END IF;
    o := o || format(E'| E2 | Dos ediciones del grupo sin cambiar el status | ningún pedido | cola %s → %s | ✅ |\n', c0, c1);

    -- ── E3 · El grupo pasa a approved, y después se edita estando approved ──
    c0 := pg_temp.cola();
    UPDATE public.groups SET status = 'approved' WHERE id = grupo;
    c1 := pg_temp.cola();
    q := pg_temp.ultimo();
    crudo := convert_from(q.body, 'UTF8');
    cuerpo := crudo::jsonb;
    IF c1 <> c0 + 1
       OR cuerpo->>'evento' IS DISTINCT FROM 'grupo_aprobado'
       OR cuerpo->>'id' IS DISTINCT FROM grupo
       OR pg_temp.claves(cuerpo) IS DISTINCT FROM 'evento,id' THEN
        RAISE EXCEPTION 'FALLÓ E3: cola % → %, cuerpo %', c0, c1, crudo;
    END IF;
    c0 := pg_temp.cola();
    UPDATE public.groups SET description = 'ya aprobado' WHERE id = grupo;
    IF pg_temp.cola() <> c0 THEN RAISE EXCEPTION 'FALLÓ E3: avisó de nuevo estando aprobado'; END IF;
    IF crudo ~* PERSONAL THEN RAISE EXCEPTION 'FALLÓ E3: datos personales en el pedido'; END IF;
    o := o || E'| E3 | El grupo pasa a approved; después se edita estando approved | 1 pedido con evento grupo_aprobado, y el segundo cambio no avisa | 1 y 0 pedidos | ✅ |\n';

    -- ── E4 · approved → rejected → approved: vuelve a avisar ────────────────
    c0 := pg_temp.cola();
    UPDATE public.groups SET status = 'rejected' WHERE id = grupo;
    UPDATE public.groups SET status = 'approved' WHERE id = grupo;
    c1 := pg_temp.cola();
    q := pg_temp.ultimo();
    cuerpo := convert_from(q.body, 'UTF8')::jsonb;
    IF c1 <> c0 + 1 OR cuerpo->>'evento' IS DISTINCT FROM 'grupo_aprobado' THEN
        RAISE EXCEPTION 'FALLÓ E4: cola % → %, evento %', c0, c1, cuerpo->>'evento';
    END IF;
    o := o || format(E'| E4 | approved → rejected → approved | vuelve a avisar una vez (como antes) | cola +%s | ✅ |\n', c1 - c0);

    -- ── E5 · Postulación a anfitrión (INSERT en leader_applications) ────────
    c0 := pg_temp.cola();
    INSERT INTO public.leader_applications (id, first_name, last_name, email, phone, status)
    VALUES (post, 'Hugo', 'PRUEBA', 'prueba.en.hugo@test.local', '1130000000', 'PENDING');
    c1 := pg_temp.cola();
    q := pg_temp.ultimo();
    crudo := convert_from(q.body, 'UTF8');
    cuerpo := crudo::jsonb;
    IF c1 <> c0 + 1
       OR cuerpo->>'evento' IS DISTINCT FROM 'postulacion'
       OR cuerpo->>'id' IS DISTINCT FROM post::text
       OR pg_temp.claves(cuerpo) IS DISTINCT FROM 'evento,id' THEN
        RAISE EXCEPTION 'FALLÓ E5: cola % → %, cuerpo %', c0, c1, crudo;
    END IF;
    IF crudo ~* PERSONAL THEN RAISE EXCEPTION 'FALLÓ E5: datos personales en el pedido: %', crudo; END IF;
    o := o || E'| E5 | Postulación nueva (INSERT en leader_applications) | 1 pedido con evento postulacion, sin email ni teléfono | igual | ✅ |\n';

    -- ── E6 · A alguien se le suma ANFITRION (UPDATE en users) ───────────────
    -- Es el caso del agujero: antes el cuerpo llevaba la fila entera de la
    -- persona, y la función le escribía a `record.email`.
    c0 := pg_temp.cola();
    UPDATE public.users SET roles = ARRAY['VIEWER', 'ANFITRION'] WHERE id = h;
    c1 := pg_temp.cola();
    q := pg_temp.ultimo();
    crudo := convert_from(q.body, 'UTF8');
    cuerpo := crudo::jsonb;
    IF c1 <> c0 + 1
       OR cuerpo->>'evento' IS DISTINCT FROM 'nuevo_anfitrion'
       OR cuerpo->>'id' IS DISTINCT FROM h::text
       OR pg_temp.claves(cuerpo) IS DISTINCT FROM 'evento,id' THEN
        RAISE EXCEPTION 'FALLÓ E6: cola % → %, cuerpo %', c0, c1, crudo;
    END IF;
    IF crudo ~* PERSONAL OR crudo LIKE '%@%' THEN
        RAISE EXCEPTION 'FALLÓ E6: datos personales en el pedido: %', crudo;
    END IF;
    -- Un cambio que no toca los roles no avisa; sacar y volver a poner, sí.
    c0 := pg_temp.cola();
    UPDATE public.users SET name = 'Hugo PRUEBA (editado)' WHERE id = h;
    IF pg_temp.cola() <> c0 THEN RAISE EXCEPTION 'FALLÓ E6: avisó por un cambio de nombre'; END IF;
    UPDATE public.users SET roles = ARRAY['VIEWER'] WHERE id = h;
    IF pg_temp.cola() <> c0 THEN RAISE EXCEPTION 'FALLÓ E6: avisó al SACAR el rol'; END IF;
    UPDATE public.users SET roles = ARRAY['VIEWER', 'ANFITRION'] WHERE id = h;
    IF pg_temp.cola() <> c0 + 1 THEN RAISE EXCEPTION 'FALLÓ E6: no avisó al volver a poner el rol'; END IF;
    o := o || E'| E6 | Se le suma ANFITRION a alguien | 1 pedido con evento nuevo_anfitrion y SIN la fila de la persona; un cambio de nombre no avisa; sacar el rol no avisa; volver a ponerlo sí | igual (el cuerpo no tiene ni una @) | ✅ |\n';

    -- ── E7 · Ingresante nuevo (INSERT en welcome_visitors) ──────────────────
    c0 := pg_temp.cola();
    INSERT INTO public.welcome_visitors (first_name, last_name, phone, age)
    VALUES ('Vera', 'PRUEBA', '1140000000', 33) RETURNING id INTO ing;
    c1 := pg_temp.cola();
    q := pg_temp.ultimo();
    crudo := convert_from(q.body, 'UTF8');
    cuerpo := crudo::jsonb;
    IF c1 <> c0 + 1
       OR cuerpo->>'evento' IS DISTINCT FROM 'ingresante'
       OR cuerpo->>'id' IS DISTINCT FROM ing::text
       OR pg_temp.claves(cuerpo) IS DISTINCT FROM 'evento,id' THEN
        RAISE EXCEPTION 'FALLÓ E7: cola % → %, cuerpo %', c0, c1, crudo;
    END IF;
    IF crudo ~* PERSONAL THEN RAISE EXCEPTION 'FALLÓ E7: datos personales en el pedido: %', crudo; END IF;
    o := o || E'| E7 | Ingresante nuevo (INSERT en welcome_visitors) | 1 pedido con evento ingresante, sin nombre ni teléfono | igual | ✅ |\n';

    -- ── E8 · Sin el secreto, o con pg_net roto: la fila se guarda igual ─────
    -- Se reescribe la función con un nombre de secreto que no existe, y
    -- después con un net.http_post que no existe. vault.secrets no se puede
    -- tocar desde acá. Al final vuelve a la original; además, todo se deshace.
    v_def := pg_get_functiondef('public.email_notifier_avisar()'::regprocedure);
    c0 := pg_temp.cola();
    EXECUTE replace(v_def, '''webhook_service_role_key''', '''webhook_service_role_key_NO_EXISTE_PRUEBA''');
    BEGIN
        INSERT INTO public.welcome_visitors (first_name, last_name) VALUES ('Sin', 'PRUEBA');
        v := 'se guardó';
    EXCEPTION WHEN OTHERS THEN v := 'NO SE GUARDÓ: ' || SQLERRM;
    END;
    EXECUTE replace(v_def, 'net.http_post(', 'net.http_post_NO_EXISTE_PRUEBA(');
    BEGIN
        INSERT INTO public.welcome_visitors (first_name, last_name) VALUES ('Roto', 'PRUEBA');
        v := v || ', se guardó';
    EXCEPTION WHEN OTHERS THEN v := v || ', NO SE GUARDÓ: ' || SQLERRM;
    END;
    EXECUTE v_def;
    c1 := pg_temp.cola();
    IF v <> 'se guardó, se guardó' OR c1 <> c0 THEN RAISE EXCEPTION 'FALLÓ E8: %, cola % → %', v, c0, c1; END IF;
    o := o || format(E'| E8 | Falta el secreto / pg_net da error | el ingresante se guarda igual, sin pedido | %s; cola %s → %s | ✅ |\n', v, c0, c1);

    -- ── E9 · Permisos ───────────────────────────────────────────────────────
    IF has_function_privilege('anon', 'public.email_notifier_avisar()', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.email_notifier_avisar()', 'EXECUTE')
       OR has_table_privilege('anon', 'public.email_notifier_hechos', 'SELECT')
       OR has_table_privilege('authenticated', 'public.email_notifier_hechos', 'INSERT')
       OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.email_notifier_hechos'::regclass) THEN
        RAISE EXCEPTION 'FALLÓ E9: permisos';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'send_webhook_event') THEN
        RAISE EXCEPTION 'FALLÓ E9: send_webhook_event todavía existe';
    END IF;
    o := o || E'| E9 | Permisos | anon y authenticated sin EXECUTE; email_notifier_hechos con RLS y sin acceso; send_webhook_event ya no existe | igual | ✅ |\n';

    -- ── E10 · Los cinco triggers, prendidos y apuntando a la función nueva ──
    SELECT string_agg(t.tgname || '=' || t.tgenabled::text, ', ' ORDER BY t.tgname) INTO v
      FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
     WHERE p.proname = 'email_notifier_avisar' AND NOT t.tgisinternal;
    IF v IS DISTINCT FROM 'on_group_created=O, on_group_updated_notify=O, on_host_applicant_created=O, on_user_role_updated_notify=O, on_welcome_visitor_created=O' THEN
        RAISE EXCEPTION 'FALLÓ E10: %', v;
    END IF;
    o := o || format(E'| E10 | Los cinco triggers | prendidos (O) y apuntando a email_notifier_avisar | %s | ✅ |\n', v);

    RAISE EXCEPTION E'RESULTADO ✅ 10/10\n%', o;
END;
$suite$;

ROLLBACK;
