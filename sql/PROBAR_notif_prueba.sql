-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de sql/notif_prueba.sql (notif_probar_texto)
--
-- BEGIN … ROLLBACK con un RAISE EXCEPTION al final: se deshace todo, incluida
-- la cola de pg_net. NO SALE NINGÚN PUSH. NUNCA COMMIT.
--
-- Personas: Eva (SUPER_ADMIN, con dispositivo), Sol (SUPER_ADMIN, sin
-- dispositivo), Ana (VIEWER, con dispositivo).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE TEMP TABLE r (orden serial, n text, caso text, esperado text, obtenido text);

CREATE FUNCTION pg_temp.chk(p_n text, p_caso text, p_esperado text, p_obtenido text)
RETURNS void LANGUAGE sql AS $f$
    INSERT INTO r (n, caso, esperado, obtenido) VALUES (p_n, p_caso, p_esperado, p_obtenido);
$f$;

CREATE FUNCTION pg_temp.sesion(p uuid) RETURNS void LANGUAGE sql AS $f$
    SELECT set_config('request.jwt.claims',
                      CASE WHEN p IS NULL THEN ''
                           ELSE json_build_object('sub', p::text, 'role', 'authenticated')::text END,
                      true);
$f$;

DO $suite$
DECLARE
    eva uuid := gen_random_uuid();
    sol uuid := gen_random_uuid();
    ana uuid := gen_random_uuid();
    v_auto uuid;
    v_j jsonb;
    v_n integer;
    v_t text;
    v_fallos integer;
    v_salida text;
BEGIN
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
SELECT x, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'prueba.probar.' || left(x::text, 8) || '@test.local', '', now(), now()
  FROM unnest(ARRAY[eva, sol, ana]) x;
INSERT INTO public.users (id, name, email, role, roles, is_active) VALUES
    (eva, 'Eva PRUEBA', 'prueba.probar.eva@test.local', 'SUPER_ADMIN', ARRAY['SUPER_ADMIN'], true),
    (sol, 'Sol PRUEBA', 'prueba.probar.sol@test.local', 'SUPER_ADMIN', ARRAY['SUPER_ADMIN'], true),
    (ana, 'Ana PRUEBA', 'prueba.probar.ana@test.local', 'VIEWER', ARRAY['VIEWER'], true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, roles = EXCLUDED.roles, is_active = true;
INSERT INTO public.push_suscripciones (user_id, endpoint, p256dh, auth, plataforma, navegador) VALUES
    (eva, 'https://ejemplo.prueba/probar/eva', 'p256dh-PRUEBA', 'auth-PRUEBA', 'ios', 'PRUEBA'),
    (ana, 'https://ejemplo.prueba/probar/ana', 'p256dh-PRUEBA', 'auth-PRUEBA', 'ios', 'PRUEBA');
SELECT id INTO v_auto FROM public.notif_alertas WHERE clave = 'gcx_asistencia_guardada';

-- ── Permisos ──
PERFORM pg_temp.sesion(ana);
PERFORM pg_temp.chk('1', 'alguien sin SUPER_ADMIN', 'sin_permiso', public.notif_probar_texto('Hola', 'Mensaje')->>'motivo');
PERFORM pg_temp.sesion(NULL);
PERFORM pg_temp.chk('2', 'sin sesión', 'sin_permiso', public.notif_probar_texto('Hola', 'Mensaje')->>'motivo');
PERFORM pg_temp.chk('3', 'anon no tiene EXECUTE', 'no',
    CASE WHEN has_function_privilege('anon', 'public.notif_probar_texto(text, text, text, uuid)', 'EXECUTE') THEN 'sí' ELSE 'no' END);
PERFORM pg_temp.chk('4', 'notif_ejemplos cerrada para authenticated', 'no',
    CASE WHEN has_function_privilege('authenticated', 'public.notif_ejemplos()', 'EXECUTE') THEN 'sí' ELSE 'no' END);

-- ── Sólo a quien la pide ──
PERFORM pg_temp.sesion(eva);
v_n := (SELECT count(*) FROM net.http_request_queue);
v_j := public.notif_probar_texto('Nueva solicitud en {grupo}', '{nombre} quiere unirse a {grupo}.', '/notificaciones', v_auto);
PERFORM pg_temp.chk('5', 'Eva la pide: ok, quedan 9', 'ok · quedan 9',
    CASE WHEN (v_j->>'ok')::boolean THEN 'ok' ELSE v_j::text END || ' · quedan ' || (v_j->>'quedan'));
PERFORM pg_temp.chk('6', 'el aviso es de Eva y de nadie más', '1 de Eva · 0 de otros',
    (SELECT count(*) FILTER (WHERE user_id = eva) || ' de Eva · ' || count(*) FILTER (WHERE user_id <> eva) || ' de otros'
       FROM public.app_notifications WHERE created_at = now() AND title LIKE 'Nueva solicitud en %' AND user_id IN (eva, sol, ana)));
PERFORM pg_temp.chk('7', 'las variables con los ejemplos', 'Nueva solicitud en GCX Palermo Martes § Sofía Ejemplo quiere unirse a GCX Palermo Martes.',
    (SELECT title || ' § ' || message FROM public.app_notifications WHERE user_id = eva ORDER BY created_at DESC LIMIT 1));
PERFORM pg_temp.chk('8', 'sin alerta_clave, con el type de la alerta y la ruta', 'sin clave · ATTENDANCE · /notificaciones',
    (SELECT CASE WHEN alerta_clave IS NULL THEN 'sin clave' ELSE 'CON clave' END || ' · ' || type || ' · ' || COALESCE(action_url, '(sin)')
       FROM public.app_notifications WHERE user_id = eva ORDER BY created_at DESC LIMIT 1));
PERFORM pg_temp.chk('9', 'pide su push por el trigger (un pedido)', '1', ((SELECT count(*) FROM net.http_request_queue) - v_n)::text);
PERFORM pg_temp.chk('10', 'queda anotada como prueba', 'prueba · gcx_asistencia_guardada',
    (SELECT resultado || ' · ' || COALESCE(alerta_clave, '(sin)') FROM public.notif_push_log WHERE user_id = eva ORDER BY enviado_at DESC LIMIT 1));
-- La llamada en su propia sentencia: una subconsulta de la misma sentencia no
-- vería el aviso que la función acaba de crear.
v_j := public.notif_probar_texto('Nos vemos hoy', 'Te esperamos.');
PERFORM pg_temp.chk('11', 'sin alerta (programada nueva): type PROGRAMADA', 'PROGRAMADA',
    COALESCE((SELECT type FROM public.app_notifications WHERE user_id = eva AND title = 'Nos vemos hoy'), v_j::text));

-- ── Validaciones ──
PERFORM pg_temp.chk('12', 'título vacío', 'texto_invalido', public.notif_probar_texto('  ', 'Mensaje')->>'motivo');
PERFORM pg_temp.chk('13', 'mensaje de 501', 'texto_invalido', public.notif_probar_texto('Hola', repeat('m', 501))->>'motivo');
PERFORM pg_temp.chk('14', 'url externa', 'url_invalida', public.notif_probar_texto('Hola', 'Mensaje', 'https://otro.com')->>'motivo');
PERFORM pg_temp.sesion(sol);
PERFORM pg_temp.chk('15', 'sin dispositivos: no crea nada', 'sin_dispositivos · 0 avisos',
    (public.notif_probar_texto('Hola', 'Mensaje')->>'motivo') || ' · ' || (SELECT count(*) FROM public.app_notifications WHERE user_id = sol) || ' avisos');

-- ── Tope de 10 por día ──
PERFORM pg_temp.sesion(eva);
FOR i IN 1..8 LOOP PERFORM public.notif_probar_texto('Prueba ' || i, 'Mensaje'); END LOOP;
PERFORM pg_temp.chk('16', 'la décima todavía sale', '10 pruebas hoy',
    (SELECT count(*) || ' pruebas hoy' FROM public.notif_push_log WHERE user_id = eva AND resultado = 'prueba'));
v_j := public.notif_probar_texto('Una más', 'Mensaje');
PERFORM pg_temp.chk('17', 'la undécima no', 'tope · quedan 0', (v_j->>'motivo') || ' · quedan ' || (v_j->>'quedan'));
PERFORM pg_temp.chk('18', 'y no creó el aviso', '0', (SELECT count(*) FROM public.app_notifications WHERE user_id = eva AND title = 'Una más')::text);

SELECT count(*) INTO v_fallos FROM r WHERE esperado IS DISTINCT FROM obtenido;
SELECT string_agg(format('| %s | %s | %s | %s | %s |', n, caso, esperado,
            CASE WHEN esperado IS NOT DISTINCT FROM obtenido THEN 'igual' ELSE COALESCE(obtenido, '(nada)') END,
            CASE WHEN esperado IS NOT DISTINCT FROM obtenido THEN '✅' ELSE '❌' END), E'\n' ORDER BY orden)
  INTO v_salida FROM r;
RAISE EXCEPTION E'RESULTADO % %/%\n%', CASE WHEN v_fallos = 0 THEN '✅' ELSE '❌' END,
    (SELECT count(*) FROM r) - v_fallos, (SELECT count(*) FROM r), v_salida;
END;
$suite$;

ROLLBACK;
