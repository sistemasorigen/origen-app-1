-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de sql/notif_destino_externo.sql
-- BEGIN … ROLLBACK con un RAISE EXCEPTION al final: se deshace todo, incluida
-- la cola de pg_net. NO SALE NINGÚN PUSH. NUNCA COMMIT.
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

-- Una lista de direcciones → "sí/no" de cada una, en orden.
CREATE FUNCTION pg_temp.acepta(p text[]) RETURNS text LANGUAGE sql AS $f$
    SELECT string_agg(CASE WHEN public.notif_url_destino(u) THEN 'sí' ELSE 'no' END, ' ' ORDER BY o)
      FROM unnest(p) WITH ORDINALITY t(u, o);
$f$;

DO $suite$
DECLARE
    eva uuid := gen_random_uuid();
    ana uuid := gen_random_uuid();
    p_ext uuid := gen_random_uuid();
    p_int uuid := gen_random_uuid();
    v_j jsonb;
    v_fallos integer; v_salida text;
BEGIN
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
SELECT x, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'prueba.url.' || left(x::text, 8) || '@test.local', '', now(), now()
  FROM unnest(ARRAY[eva, ana]) x;
INSERT INTO public.users (id, name, email, role, roles, is_active) VALUES
    (eva, 'Eva PRUEBA', 'prueba.url.eva@test.local', 'SUPER_ADMIN', ARRAY['SUPER_ADMIN'], true),
    (ana, 'Ana PRUEBA', 'prueba.url.ana@test.local', 'VIEWER', ARRAY['VIEWER'], true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, roles = EXCLUDED.roles, is_active = true;
INSERT INTO public.push_suscripciones (user_id, endpoint, p256dh, auth, plataforma, navegador)
VALUES (eva, 'https://ejemplo.prueba/url/eva', 'p256dh-PRUEBA', 'auth-PRUEBA', 'ios', 'PRUEBA');

-- ── Qué se acepta ──
PERFORM pg_temp.chk('U1', 'rutas de la app: /gcx, /eventos/nocturna, /agenda?tarea=1', 'sí sí sí',
    pg_temp.acepta(ARRAY['/gcx', '/eventos/nocturna', '/agenda?tarea=1']));
PERFORM pg_temp.chk('U2', 'páginas https: dominio, con ruta, con query y con puerto', 'sí sí sí sí',
    pg_temp.acepta(ARRAY['https://origeniglesia.org', 'https://www.youtube.com/watch?v=abc', 'https://forms.gle/Xy12?x=1#a', 'https://ejemplo.com:8443/x']));
PERFORM pg_temp.chk('U3', 'no: http, javascript:, //dominio, sin dominio, con espacios, barra invertida, data:', 'no no no no no no no',
    pg_temp.acepta(ARRAY['http://ejemplo.com', 'javascript:alert(1)', '//ejemplo.com', 'https://localhost', 'https://ejemplo.com/a b', 'https://ejemplo.com\x', 'data:text/html,hola']));
PERFORM pg_temp.chk('U4', 'no: una de 501 letras', 'no', pg_temp.acepta(ARRAY['https://ejemplo.com/' || repeat('a', 482)]));

-- ── Guardar, emitir y probar (Sistemas) ──
PERFORM pg_temp.sesion(eva);
v_j := public.notif_guardar_programada(p_ext, 'PRUEBA externa', 'Hola', 'Mensaje', 'https://forms.gle/abc123',
    true, '2026-12-10', NULL, 1, ARRAY['10:00']::time[], false, NULL, ARRAY[ana], false, NULL, NULL, NULL, true);
PERFORM pg_temp.chk('G1', 'programada con https://: se guarda', 'ok · https://forms.gle/abc123',
    CASE WHEN (v_j->>'ok')::boolean THEN 'ok' ELSE v_j::text END || ' · ' || (SELECT url_plantilla FROM public.notif_alertas WHERE id = p_ext));
v_j := public.notif_guardar_programada(p_int, 'PRUEBA interna', 'Hola', 'Mensaje', '/gcx',
    true, '2026-12-10', NULL, 1, ARRAY['10:00']::time[], false, NULL, ARRAY[ana], false, NULL, NULL, NULL, true);
PERFORM pg_temp.chk('G2', 'programada con /gcx escrita a mano: se guarda', 'ok', CASE WHEN (v_j->>'ok')::boolean THEN 'ok' ELSE v_j::text END);
PERFORM pg_temp.chk('G3', 'programada con http:// o javascript:: no', 'url_invalida · url_invalida',
    (public.notif_guardar_programada(gen_random_uuid(), 'x', 'Hola', 'Mensaje', 'http://ejemplo.com',
        true, '2026-12-10', NULL, 1, ARRAY['10:00']::time[], false, NULL, ARRAY[ana])->>'motivo') || ' · ' ||
    (public.notif_guardar_programada(gen_random_uuid(), 'x', 'Hola', 'Mensaje', 'javascript:alert(1)',
        true, '2026-12-10', NULL, 1, ARRAY['10:00']::time[], false, NULL, ARRAY[ana])->>'motivo'));

PERFORM public.notif_programadas_tick(('2026-12-10 10:05'::timestamp) AT TIME ZONE 'America/Argentina/Buenos_Aires');
PERFORM pg_temp.chk('G4', 'al emitirse, los avisos llevan su dirección', 'https://forms.gle/abc123 · /gcx',
    (SELECT n.action_url FROM public.app_notifications n JOIN public.notif_alertas a ON a.clave = n.alerta_clave WHERE a.id = p_ext) || ' · ' ||
    (SELECT n.action_url FROM public.app_notifications n JOIN public.notif_alertas a ON a.clave = n.alerta_clave WHERE a.id = p_int));

v_j := public.notif_probar_texto('Prueba', 'Mensaje', 'https://forms.gle/abc123', NULL);
PERFORM pg_temp.chk('G5', 'Enviarme una prueba con https://: sale con el link', 'ok · https://forms.gle/abc123',
    CASE WHEN (v_j->>'ok')::boolean THEN 'ok' ELSE v_j::text END || ' · '
    || (SELECT action_url FROM public.app_notifications WHERE user_id = eva AND title = 'Prueba'));
PERFORM pg_temp.chk('G6', 'Enviarme una prueba con http://: no', 'url_invalida',
    public.notif_probar_texto('Prueba', 'Mensaje', 'http://ejemplo.com', NULL)->>'motivo');

-- ── Lo que sigue cerrado ──
PERFORM pg_temp.chk('C1', 'el emisor de las automáticas sigue sacando los links de afuera', 'sin link',
    COALESCE((SELECT action_url FROM public.app_notifications
               WHERE id = public.notif_emitir_texto('gcx_asistencia_guardada', ana, 'T', 'M', 'https://forms.gle/abc123')), 'sin link'));
PERFORM pg_temp.sesion(ana);
PERFORM pg_temp.chk('C2', 'crear_aviso (la app con sesión) sigue sin aceptar https://', 'url_invalida',
    public.crear_aviso(ana, 'ATTENDANCE', 'T', 'M', 'https://forms.gle/abc123')->>'motivo');
PERFORM pg_temp.chk('C3', 'nadie de afuera ejecuta las validaciones nuevas', 'no · no',
    CASE WHEN has_function_privilege('authenticated', 'public.notif_url_destino(text)', 'EXECUTE') THEN 'sí' ELSE 'no' END || ' · ' ||
    CASE WHEN has_function_privilege('anon', 'public.notif_url_externa(text)', 'EXECUTE') THEN 'sí' ELSE 'no' END);

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
