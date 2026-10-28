-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de sql/send_gcx_welcome_seguro.sql.
--
-- BEGIN … ROLLBACK y UN bloque que termina con RAISE EXCEPTION a propósito:
-- se deshace entero, incluida la cola de pg_net (los pedidos nunca salen).
-- "RESULTADO ✅ …" con la tabla, o "FALLÓ G<n>: …". NUNCA COMMIT.
--
-- Personas: Hugo (anfitrión del grupo de prueba), Ana (sin nada que ver) y
-- Gis (gestora de grupos, ADMIN_GROUPS). Dos grupos, para probar que un
-- anfitrión no puede reenviar las inscripciones del grupo de otro.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE FUNCTION pg_temp.cola() RETURNS integer
LANGUAGE sql AS $f$ SELECT count(*)::integer FROM net.http_request_queue WHERE url LIKE '%/send-gcx-welcome' $f$;
CREATE FUNCTION pg_temp.ultimo() RETURNS net.http_request_queue
LANGUAGE sql AS $f$ SELECT * FROM net.http_request_queue WHERE url LIKE '%/send-gcx-welcome' ORDER BY id DESC LIMIT 1 $f$;
-- Se mete en la piel de alguien (o de nadie, con NULL).
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
    hugo uuid := gen_random_uuid();
    ana  uuid := gen_random_uuid();
    gis  uuid := gen_random_uuid();
    g1 text := gen_random_uuid()::text;
    g2 text := gen_random_uuid()::text;
    i1 text := gen_random_uuid()::text;   -- inscripción del grupo de Hugo
    i2 text := gen_random_uuid()::text;   -- inscripción del grupo de otro
    c0 integer; c1 integer;
    q net.http_request_queue;
    crudo text;
    cuerpo jsonb;
    r jsonb;
    v text;
    v_def text;
    o text := '';
    PERSONAL text := '(Hugo|Mara|PRUEBA|test\.local|1130000000|30111222)';
BEGIN
    FOREACH v IN ARRAY ARRAY[hugo::text, ana::text, gis::text] LOOP
        INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
        VALUES (v::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
                'prueba.gcx.' || left(v, 8) || '@test.local', '', now(), now());
    END LOOP;
    INSERT INTO public.users (id, name, email, role, roles, is_active) VALUES
        (hugo, 'Hugo PRUEBA', 'prueba.gcx.hugo@test.local', 'VIEWER', ARRAY['VIEWER'], true),
        (ana,  'Ana PRUEBA',  'prueba.gcx.ana@test.local',  'VIEWER', ARRAY['VIEWER'], true),
        (gis,  'Gis PRUEBA',  'prueba.gcx.gis@test.local',  'VIEWER', ARRAY['ADMIN_GROUPS'], true)
    ON CONFLICT (id) DO UPDATE SET roles = EXCLUDED.roles, is_active = true;

    INSERT INTO public.groups (id, name, leader_name, host_id, status) VALUES
        (g1, 'PRUEBA gcx uno', 'Hugo PRUEBA', hugo, 'approved'),
        (g2, 'PRUEBA gcx dos', 'Otra PRUEBA', ana,  'approved');
    INSERT INTO public.group_registrations (id, first_name, last_name, email, phone, dni, group_id, status) VALUES
        (i1, 'Mara', 'PRUEBA', 'prueba.gcx.mara@test.local', '1130000000', '30111222', g1, 'PENDING'),
        (i2, 'Otro', 'PRUEBA', 'prueba.gcx.otro@test.local', '1130000000', '30111223', g2, 'APPROVED');

    -- ── G1 · La inscripción pasa a APPROVED ─────────────────────────────────
    c0 := pg_temp.cola();
    UPDATE public.group_registrations SET status = 'APPROVED' WHERE id = i1;
    c1 := pg_temp.cola();
    q := pg_temp.ultimo();
    crudo := convert_from(q.body, 'UTF8');
    cuerpo := crudo::jsonb;
    IF c1 <> c0 + 1
       OR (SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(cuerpo) k) IS DISTINCT FROM 'inscripcion_id'
       OR cuerpo->>'inscripcion_id' IS DISTINCT FROM i1
       OR q.headers->>'Authorization' NOT LIKE 'Bearer %'
       OR length(q.headers->>'Authorization') < 40
       OR q.timeout_milliseconds <> 30000 THEN
        RAISE EXCEPTION 'FALLÓ G1: cola % → %, cuerpo %, timeout %', c0, c1, crudo, q.timeout_milliseconds;
    END IF;
    IF crudo ~* PERSONAL THEN RAISE EXCEPTION 'FALLÓ G1: datos personales en el pedido: %', crudo; END IF;
    o := o || format(E'| G1 | La inscripción pasa a APPROVED | 1 pedido {inscripcion_id} con la clave y timeout 30000, sin nombre, email, teléfono ni DNI | cola +%s; {%s}; timeout %s | ✅ |\n',
                     c1 - c0, (SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(cuerpo) k), q.timeout_milliseconds);

    -- ── G2 · Otras ediciones: nada ──────────────────────────────────────────
    c0 := pg_temp.cola();
    UPDATE public.group_registrations SET phone = '1140000000' WHERE id = i1;
    UPDATE public.group_registrations SET status = 'APPROVED' WHERE id = i1;   -- ya estaba
    UPDATE public.group_registrations SET status = 'REJECTED' WHERE id = i1;
    c1 := pg_temp.cola();
    IF c1 <> c0 THEN RAISE EXCEPTION 'FALLÓ G2: cola % → %', c0, c1; END IF;
    o := o || format(E'| G2 | Cambiar el teléfono, volver a poner APPROVED estando APPROVED, y pasar a REJECTED | ningún pedido | cola %s → %s | ✅ |\n', c0, c1);

    -- ── G3 · Volver a aprobarla sí avisa ────────────────────────────────────
    c0 := pg_temp.cola();
    UPDATE public.group_registrations SET status = 'APPROVED' WHERE id = i1;
    IF pg_temp.cola() <> c0 + 1 THEN RAISE EXCEPTION 'FALLÓ G3: no avisó al volver a aprobar'; END IF;
    o := o || E'| G3 | REJECTED → APPROVED | vuelve a avisar una vez | cola +1 | ✅ |\n';

    -- ── G4 · La RPC sin sesión ──────────────────────────────────────────────
    c0 := pg_temp.cola();
    PERFORM pg_temp.como(NULL);
    r := public.gcx_reenviar_bienvenida(ARRAY[i1]);
    PERFORM pg_temp.volver();
    IF r->>'motivo' IS DISTINCT FROM 'sin_sesion' OR pg_temp.cola() <> c0 THEN
        RAISE EXCEPTION 'FALLÓ G4: % , cola %', r, pg_temp.cola();
    END IF;
    o := o || format(E'| G4 | Reenviar sin sesión | sin_sesion y ningún pedido | %s; cola igual | ✅ |\n', r);

    -- ── G5 · La RPC con alguien que no tiene nada que ver ───────────────────
    c0 := pg_temp.cola();
    PERFORM pg_temp.como(ana);
    r := public.gcx_reenviar_bienvenida(ARRAY[i1]);
    PERFORM pg_temp.volver();
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' OR pg_temp.cola() <> c0 THEN
        RAISE EXCEPTION 'FALLÓ G5: %, cola %', r, pg_temp.cola();
    END IF;
    o := o || format(E'| G5 | Reenviar con una cuenta sin rol y ajena al grupo | sin_permiso y ningún pedido | %s; cola igual | ✅ |\n', r);

    -- ── G6 · La RPC con el anfitrión del grupo ──────────────────────────────
    c0 := pg_temp.cola();
    PERFORM pg_temp.como(hugo);
    r := public.gcx_reenviar_bienvenida(ARRAY[i1]);
    PERFORM pg_temp.volver();
    c1 := pg_temp.cola();
    q := pg_temp.ultimo();
    crudo := convert_from(q.body, 'UTF8');
    IF (r->>'ok')::boolean IS NOT TRUE OR (r->>'encoladas')::integer <> 1 OR c1 <> c0 + 1
       OR (crudo::jsonb->'inscripciones')->>0 IS DISTINCT FROM i1
       OR q.headers->>'Authorization' NOT LIKE 'Bearer %' THEN
        RAISE EXCEPTION 'FALLÓ G6: %, cola % → %, cuerpo %', r, c0, c1, crudo;
    END IF;
    IF crudo ~* PERSONAL THEN RAISE EXCEPTION 'FALLÓ G6: datos personales en el pedido: %', crudo; END IF;
    -- Una del grupo de otro en la misma lista y no se manda ninguna.
    c0 := pg_temp.cola();
    PERFORM pg_temp.como(hugo);
    r := public.gcx_reenviar_bienvenida(ARRAY[i1, i2]);
    PERFORM pg_temp.volver();
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' OR pg_temp.cola() <> c0 THEN
        RAISE EXCEPTION 'FALLÓ G6: el anfitrión reenvió una del grupo de otro: %', r;
    END IF;
    -- Un id que no existe se trata igual (no sirve para averiguar si existe).
    PERFORM pg_temp.como(hugo);
    r := public.gcx_reenviar_bienvenida(ARRAY['no-existe-esta-inscripcion']);
    PERFORM pg_temp.volver();
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ G6: id inexistente dio %', r; END IF;
    o := o || E'| G6 | Reenviar como anfitrión del grupo | la suya sí (1 pedido con {inscripciones}, con la clave y sin datos personales); una de otro grupo, o un id que no existe, dan sin_permiso y ningún pedido | igual | ✅ |\n';

    -- ── G7 · La RPC con un gestor de grupos ─────────────────────────────────
    c0 := pg_temp.cola();
    PERFORM pg_temp.como(gis);
    r := public.gcx_reenviar_bienvenida(ARRAY[i1, i2]);
    PERFORM pg_temp.volver();
    IF (r->>'ok')::boolean IS NOT TRUE OR (r->>'encoladas')::integer <> 2 OR pg_temp.cola() <> c0 + 1 THEN
        RAISE EXCEPTION 'FALLÓ G7: %, cola % → %', r, c0, pg_temp.cola();
    END IF;
    o := o || format(E'| G7 | Reenviar como gestora de grupos (ADMIN_GROUPS) | las dos, de cualquier grupo, en 1 pedido | %s | ✅ |\n', r);

    -- ── G8 · Cantidades fuera de rango ──────────────────────────────────────
    c0 := pg_temp.cola();
    PERFORM pg_temp.como(gis);
    r := public.gcx_reenviar_bienvenida(ARRAY[]::text[]);
    v := r->>'motivo';
    r := public.gcx_reenviar_bienvenida(ARRAY(SELECT 'x' || i FROM generate_series(1, 101) i));
    PERFORM pg_temp.volver();
    IF v IS DISTINCT FROM 'cantidad_invalida' OR r->>'motivo' IS DISTINCT FROM 'cantidad_invalida'
       OR pg_temp.cola() <> c0 THEN
        RAISE EXCEPTION 'FALLÓ G8: vacío %, 101 %, cola %', v, r, pg_temp.cola();
    END IF;
    o := o || E'| G8 | Reenviar con la lista vacía y con 101 ids | cantidad_invalida en los dos, ningún pedido | igual | ✅ |\n';

    -- ── G9 · Sin el secreto, o con pg_net roto ──────────────────────────────
    v_def := pg_get_functiondef('public.notify_gcx_welcome()'::regprocedure);
    c0 := pg_temp.cola();
    EXECUTE replace(v_def, '''webhook_service_role_key''', '''webhook_service_role_key_NO_EXISTE_PRUEBA''');
    BEGIN
        UPDATE public.group_registrations SET status = 'PENDING' WHERE id = i1;
        UPDATE public.group_registrations SET status = 'APPROVED' WHERE id = i1;
        v := 'se guardó';
    EXCEPTION WHEN OTHERS THEN v := 'NO SE GUARDÓ: ' || SQLERRM;
    END;
    EXECUTE replace(v_def, 'net.http_post(', 'net.http_post_NO_EXISTE_PRUEBA(');
    BEGIN
        UPDATE public.group_registrations SET status = 'PENDING' WHERE id = i1;
        UPDATE public.group_registrations SET status = 'APPROVED' WHERE id = i1;
        v := v || ', se guardó';
    EXCEPTION WHEN OTHERS THEN v := v || ', NO SE GUARDÓ: ' || SQLERRM;
    END;
    EXECUTE v_def;
    IF v <> 'se guardó, se guardó' OR pg_temp.cola() <> c0 THEN
        RAISE EXCEPTION 'FALLÓ G9: %, cola % → %', v, c0, pg_temp.cola();
    END IF;
    o := o || format(E'| G9 | Falta el secreto / pg_net da error | la aprobación se guarda igual, sin pedido | %s | ✅ |\n', v);

    -- ── G10 · Permisos y trigger ────────────────────────────────────────────
    IF has_function_privilege('anon', 'public.notify_gcx_welcome()', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.notify_gcx_welcome()', 'EXECUTE')
       OR has_function_privilege('anon', 'public.gcx_reenviar_bienvenida(text[])', 'EXECUTE')
       OR NOT has_function_privilege('authenticated', 'public.gcx_reenviar_bienvenida(text[])', 'EXECUTE')
       OR has_table_privilege('anon', 'public.gcx_welcome_hechos', 'SELECT')
       OR has_table_privilege('authenticated', 'public.gcx_welcome_hechos', 'INSERT')
       OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.gcx_welcome_hechos'::regclass) THEN
        RAISE EXCEPTION 'FALLÓ G10: permisos';
    END IF;
    SELECT t.tgname || '=' || t.tgenabled::text INTO v
      FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
     WHERE p.proname = 'notify_gcx_welcome' AND NOT t.tgisinternal;
    IF v IS DISTINCT FROM 'trigger_gcx_welcome=O' THEN RAISE EXCEPTION 'FALLÓ G10: trigger %', v; END IF;
    o := o || format(E'| G10 | Permisos y trigger | la RPC sólo para authenticated (anon no); notify_gcx_welcome sin EXECUTE para anon ni authenticated; gcx_welcome_hechos con RLS y sin acceso; el trigger prendido | %s | ✅ |\n', v);

    RAISE EXCEPTION E'RESULTADO ✅ 10/10\n%', o;
END;
$suite$;

ROLLBACK;
