-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de sql/send_dianino_seguro.sql.
--
-- BEGIN … ROLLBACK y UN bloque que termina con RAISE EXCEPTION a propósito:
-- se deshace entero, incluida la cola de pg_net (los pedidos nunca salen).
-- "RESULTADO ✅ …" con la tabla, o "FALLÓ D<n>: …". NUNCA COMMIT.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE FUNCTION pg_temp.cola() RETURNS integer
LANGUAGE sql AS $f$ SELECT count(*)::integer FROM net.http_request_queue WHERE url LIKE '%/send-dianino-tickets' $f$;
CREATE FUNCTION pg_temp.ultimo() RETURNS net.http_request_queue
LANGUAGE sql AS $f$ SELECT * FROM net.http_request_queue WHERE url LIKE '%/send-dianino-tickets' ORDER BY id DESC LIMIT 1 $f$;

DO $suite$
DECLARE
    s uuid := gen_random_uuid();
    c0 integer; c1 integer;
    q net.http_request_queue;
    crudo text;
    cuerpo jsonb;
    v text;
    v_def text;
    o text := '';
BEGIN
    -- ── D1 · Sesión nueva: un pedido, sólo el id, con la clave ──────────────
    c0 := pg_temp.cola();
    INSERT INTO public.dianino_sessions (id, email, declaracion_jurada_aceptada)
    VALUES (s, 'prueba.dn@test.local', true);
    c1 := pg_temp.cola();
    q := pg_temp.ultimo();
    crudo := convert_from(q.body, 'UTF8');
    cuerpo := crudo::jsonb;
    IF c1 <> c0 + 1
       OR (SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(cuerpo) k) IS DISTINCT FROM 'sesion_id'
       OR cuerpo->>'sesion_id' IS DISTINCT FROM s::text
       OR q.headers->>'Authorization' NOT LIKE 'Bearer %'
       OR length(q.headers->>'Authorization') < 40
       OR q.timeout_milliseconds <> 30000 THEN
        RAISE EXCEPTION 'FALLÓ D1: cola % → %, cuerpo %, timeout %', c0, c1, crudo, q.timeout_milliseconds;
    END IF;
    IF crudo ~* '(test\.local|prueba\.dn)' THEN RAISE EXCEPTION 'FALLÓ D1: el email está en el pedido: %', crudo; END IF;
    o := o || format(E'| D1 | Sesión nueva (INSERT en dianino_sessions) | 1 pedido {sesion_id} con la clave y timeout 30000, sin el email | cola +%s; {%s}; timeout %s | ✅ |\n',
                     c1 - c0, (SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(cuerpo) k), q.timeout_milliseconds);

    -- ── D2 · Editar la sesión: nada (el trigger es sólo AFTER INSERT) ───────
    c0 := pg_temp.cola();
    UPDATE public.dianino_sessions SET declaracion_jurada_aceptada = false WHERE id = s;
    c1 := pg_temp.cola();
    IF c1 <> c0 THEN RAISE EXCEPTION 'FALLÓ D2: cola % → %', c0, c1; END IF;
    o := o || format(E'| D2 | Editar la sesión | ningún pedido | cola %s → %s | ✅ |\n', c0, c1);

    -- ── D3 · Sin el secreto, o con pg_net roto: la sesión se guarda igual ──
    v_def := pg_get_functiondef('public.notify_dianino_tickets()'::regprocedure);
    c0 := pg_temp.cola();
    EXECUTE replace(v_def, '''webhook_service_role_key''', '''webhook_service_role_key_NO_EXISTE_PRUEBA''');
    BEGIN
        INSERT INTO public.dianino_sessions (email, declaracion_jurada_aceptada) VALUES ('prueba.dn2@test.local', true);
        v := 'se guardó';
    EXCEPTION WHEN OTHERS THEN v := 'NO SE GUARDÓ: ' || SQLERRM;
    END;
    EXECUTE replace(v_def, 'net.http_post(', 'net.http_post_NO_EXISTE_PRUEBA(');
    BEGIN
        INSERT INTO public.dianino_sessions (email, declaracion_jurada_aceptada) VALUES ('prueba.dn3@test.local', true);
        v := v || ', se guardó';
    EXCEPTION WHEN OTHERS THEN v := v || ', NO SE GUARDÓ: ' || SQLERRM;
    END;
    EXECUTE v_def;
    c1 := pg_temp.cola();
    IF v <> 'se guardó, se guardó' OR c1 <> c0 THEN RAISE EXCEPTION 'FALLÓ D3: %, cola % → %', v, c0, c1; END IF;
    o := o || format(E'| D3 | Falta el secreto / pg_net da error | la sesión se guarda igual, sin pedido | %s; cola %s → %s | ✅ |\n', v, c0, c1);

    -- ── D4 · Permisos y trigger ─────────────────────────────────────────────
    IF has_function_privilege('anon', 'public.notify_dianino_tickets()', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.notify_dianino_tickets()', 'EXECUTE')
       OR has_table_privilege('anon', 'public.dianino_hechos', 'SELECT')
       OR has_table_privilege('authenticated', 'public.dianino_hechos', 'INSERT')
       OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.dianino_hechos'::regclass) THEN
        RAISE EXCEPTION 'FALLÓ D4: permisos';
    END IF;
    SELECT t.tgname || '=' || t.tgenabled::text INTO v
      FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
     WHERE p.proname = 'notify_dianino_tickets' AND NOT t.tgisinternal;
    IF v IS DISTINCT FROM 'trigger_dianino_tickets=O' THEN RAISE EXCEPTION 'FALLÓ D4: trigger %', v; END IF;
    o := o || format(E'| D4 | Permisos y trigger | anon y authenticated sin EXECUTE; dianino_hechos con RLS y sin acceso; el trigger prendido | %s | ✅ |\n', v);

    RAISE EXCEPTION E'RESULTADO ✅ 4/4\n%', o;
END;
$suite$;

ROLLBACK;
