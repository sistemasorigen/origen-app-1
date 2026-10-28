-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de sql/avisar_actualizacion.sql.
--
-- BEGIN … ROLLBACK y UN bloque que termina con RAISE EXCEPTION a propósito:
-- se deshace entero, incluida la cola de pg_net. NO SALE NI UN PUSH, ni a las
-- personas de prueba ni a las reales. NUNCA COMMIT.
--
-- Personas: Pablo (suscripto y activo), Sol (suscripta pero dada de baja) y
-- Tere (activa pero sin la app instalada).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE FUNCTION pg_temp.cola() RETURNS integer
LANGUAGE sql AS $f$ SELECT count(*)::integer FROM net.http_request_queue WHERE url LIKE '%/send-push' $f$;
CREATE FUNCTION pg_temp.avisos(p uuid) RETURNS integer
LANGUAGE sql AS $f$ SELECT count(*)::integer FROM public.app_notifications
                     WHERE user_id = p AND title = 'PRUEBA versión nueva' $f$;

DO $suite$
DECLARE
    pablo uuid := gen_random_uuid();
    sol   uuid := gen_random_uuid();
    tere  uuid := gen_random_uuid();
    n integer; c0 integer; c1 integer;
    q net.http_request_queue;
    v text;
    o text := '';
BEGIN
    FOREACH v IN ARRAY ARRAY[pablo::text, sol::text, tere::text] LOOP
        INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
        VALUES (v::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
                'prueba.av.' || left(v, 8) || '@test.local', '', now(), now());
    END LOOP;
    INSERT INTO public.users (id, name, email, role, roles, is_active) VALUES
        (pablo, 'Pablo PRUEBA', 'prueba.av.pablo@test.local', 'VIEWER', ARRAY['VIEWER'], true),
        (sol,   'Sol PRUEBA',   'prueba.av.sol@test.local',   'VIEWER', ARRAY['VIEWER'], false),
        (tere,  'Tere PRUEBA',  'prueba.av.tere@test.local',  'VIEWER', ARRAY['VIEWER'], true)
    ON CONFLICT (id) DO UPDATE SET is_active = EXCLUDED.is_active;

    -- Pablo y Sol tienen la app instalada; Tere no.
    INSERT INTO public.push_suscripciones (user_id, endpoint, p256dh, auth, plataforma, navegador) VALUES
        (pablo, 'https://ejemplo.prueba/endpoint/pablo', 'p256dh-PRUEBA', 'auth-PRUEBA', 'ios', 'PRUEBA'),
        (sol,   'https://ejemplo.prueba/endpoint/sol',   'p256dh-PRUEBA', 'auth-PRUEBA', 'ios', 'PRUEBA');

    -- ── A1 · Un aviso por persona suscripta y activa ────────────────────────
    c0 := pg_temp.cola();
    n := public.avisar_actualizacion('PRUEBA versión nueva', 'PRUEBA mensaje', 6);
    c1 := pg_temp.cola();
    IF pg_temp.avisos(pablo) <> 1 THEN RAISE EXCEPTION 'FALLÓ A1: Pablo tiene % avisos', pg_temp.avisos(pablo); END IF;
    IF pg_temp.avisos(sol)  <> 0 THEN RAISE EXCEPTION 'FALLÓ A1: Sol está dada de baja y recibió'; END IF;
    IF pg_temp.avisos(tere) <> 0 THEN RAISE EXCEPTION 'FALLÓ A1: Tere no tiene la app y recibió'; END IF;
    -- Devuelve cuántos creó: Pablo + las personas reales que ya estaban.
    IF n < 1 THEN RAISE EXCEPTION 'FALLÓ A1: devolvió %', n; END IF;
    IF c1 <> c0 + n THEN RAISE EXCEPTION 'FALLÓ A1: creó % avisos pero encoló % pushes', n, c1 - c0; END IF;
    o := o || format(E'| A1 | Avisar una vez | un aviso por persona con la app instalada y activa, y un push por aviso | %s avisos, %s pushes; Sol (de baja) y Tere (sin la app) no recibieron | ✅ |\n', n, c1 - c0);

    -- ── A2 · El cuerpo del push no lleva datos personales ───────────────────
    q := (SELECT x FROM net.http_request_queue x WHERE x.url LIKE '%/send-push' ORDER BY x.id DESC LIMIT 1);
    v := convert_from(q.body, 'UTF8');
    IF (SELECT string_agg(k, ',') FROM jsonb_object_keys(v::jsonb) k) IS DISTINCT FROM 'notificacion_id'
       OR q.headers->>'Authorization' NOT LIKE 'Bearer %'
       OR length(q.headers->>'Authorization') < 40 THEN
        RAISE EXCEPTION 'FALLÓ A2: cuerpo %, clave %', v, (q.headers->>'Authorization') IS NOT NULL;
    END IF;
    IF v ~* '(PRUEBA|test\.local|Pablo)' THEN RAISE EXCEPTION 'FALLÓ A2: datos personales en el pedido: %', v; END IF;
    o := o || E'| A2 | El pedido a send-push | sólo { notificacion_id }, con la clave de Vault | igual, sin nombres ni direcciones | ✅ |\n';

    -- ── A3 · Correrla de nuevo enseguida no repite ──────────────────────────
    c0 := pg_temp.cola();
    n := public.avisar_actualizacion('PRUEBA versión nueva', 'PRUEBA mensaje', 6);
    IF n <> 0 OR pg_temp.avisos(pablo) <> 1 OR pg_temp.cola() <> c0 THEN
        RAISE EXCEPTION 'FALLÓ A3: devolvió %, Pablo tiene %, cola +%', n, pg_temp.avisos(pablo), pg_temp.cola() - c0;
    END IF;
    o := o || E'| A3 | Dos deploys seguidos | el segundo no manda nada (freno de 6 horas) | 0 avisos, 0 pushes | ✅ |\n';

    -- ── A4 · Con el freno en 0 sí vuelve a salir ────────────────────────────
    c0 := pg_temp.cola();
    n := public.avisar_actualizacion('PRUEBA versión nueva', 'PRUEBA mensaje', 0);
    IF n < 1 OR pg_temp.avisos(pablo) <> 2 OR pg_temp.cola() <> c0 + n THEN
        RAISE EXCEPTION 'FALLÓ A4: devolvió %, Pablo tiene %', n, pg_temp.avisos(pablo);
    END IF;
    o := o || format(E'| A4 | AVISO_HORAS=0 | sale igual, sin freno | %s avisos y %s pushes | ✅ |\n', n, pg_temp.cola() - c0);

    -- ── A5 · Un título distinto es otro aviso ───────────────────────────────
    c0 := pg_temp.cola();
    n := public.avisar_actualizacion('PRUEBA otro título', 'PRUEBA mensaje', 6);
    IF n < 1 OR pg_temp.cola() <> c0 + n THEN RAISE EXCEPTION 'FALLÓ A5: devolvió %', n; END IF;
    o := o || E'| A5 | Cambiar el título | el freno es por título, así que un anuncio distinto sale igual | sale | ✅ |\n';

    -- ── A6 · Permisos ───────────────────────────────────────────────────────
    IF has_function_privilege('anon', 'public.avisar_actualizacion(text, text, integer)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.avisar_actualizacion(text, text, integer)', 'EXECUTE')
       OR NOT has_function_privilege('service_role', 'public.avisar_actualizacion(text, text, integer)', 'EXECUTE') THEN
        RAISE EXCEPTION 'FALLÓ A6: permisos';
    END IF;
    o := o || E'| A6 | Permisos | ni anon ni authenticated la pueden ejecutar; service_role sí | igual | ✅ |\n';

    RAISE EXCEPTION E'RESULTADO ✅ 6/6\n%', o;
END;
$suite$;

ROLLBACK;
