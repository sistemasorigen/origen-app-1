-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de sql/notif_preferencias.sql
--
-- BEGIN … ROLLBACK con un RAISE EXCEPTION al final: se deshace todo, incluida
-- la cola de pg_net. NO SALE NINGÚN PUSH. NUNCA COMMIT. Todo con personas
-- "PRUEBA" y una programada "PRUEBA" que sólo les llega a ellas.
--
-- QUÉ PRUEBA
--   M · Lo que ve cada persona (notif_mis_preferencias).
--   S · Apagar, prender, repetidos, no_apagable, otra persona, RLS.
--   C · Un push silenciado en cada camino: trigger fila por fila, lote de una
--       programada (con la reserva SKIP LOCKED), diferidos del cron y no
--       molestar. La prueba a uno mismo no respeta lo apagado.
--   A · Lo de Sistemas: apagada_por, permite_apagar y los dos "guardar".
--   E · Los datos cargados y los permisos.
--
-- Personas: Eva (SUPER_ADMIN), Ana y Beto. Los tres con dispositivo.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE TEMP TABLE r (orden serial, n text, caso text, esperado text, obtenido text);
GRANT ALL ON r TO authenticated;
GRANT USAGE ON SEQUENCE r_orden_seq TO authenticated;

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

CREATE FUNCTION pg_temp.ar(p text) RETURNS timestamptz LANGUAGE sql AS $f$
    SELECT (p::timestamp) AT TIME ZONE 'America/Argentina/Buenos_Aires';
$f$;

CREATE FUNCTION pg_temp.id_de(p_clave text) RETURNS uuid LANGUAGE sql AS $f$
    SELECT id FROM public.notif_alertas WHERE clave = p_clave;
$f$;

CREATE FUNCTION pg_temp.decision(p uuid) RETURNS text LANGUAGE sql AS $f$
    SELECT public.notif_puede_enviar(p)->>'decision';
$f$;

-- Las preferencias de alguien, en una línea: "nombre (área)[apagada]".
CREATE FUNCTION pg_temp.prefs(p uuid) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE v jsonb;
BEGIN
    PERFORM pg_temp.sesion(p);
    v := public.notif_mis_preferencias();
    RETURN (SELECT string_agg((x->>'nombre') || ' (' || (x->>'area') || ')' || CASE WHEN (x->>'apagada')::boolean THEN '[apagada]' ELSE '' END,
                              ' | ' ORDER BY ord)
              FROM jsonb_array_elements(v->'alertas') WITH ORDINALITY t(x, ord));
END $f$;


DO $suite$
DECLARE
    ZONA constant text := 'America/Argentina/Buenos_Aires';
    eva  uuid := gen_random_uuid();
    ana  uuid := gen_random_uuid();
    beto uuid := gen_random_uuid();
    p_prog uuid := gen_random_uuid();
    p_nueva uuid := gen_random_uuid();
    v_ingreso uuid; v_app uuid; v_pareja uuid; v_tarea uuid; v_otra uuid; v_dif uuid;
    v_j jsonb; v_t text; v_n integer; v_m integer;
    v_envio uuid; v_ids jsonb;
    v_ana_lote uuid; v_eva_lote uuid;
    v_fallos integer; v_salida text;
BEGIN
-- ══════════════════════════════════════════════════════════════════════════
-- Fixture
-- ══════════════════════════════════════════════════════════════════════════
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
SELECT x, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'prueba.pref.' || left(x::text, 8) || '@test.local', '', now(), now()
  FROM unnest(ARRAY[eva, ana, beto]) x;
INSERT INTO public.users (id, name, email, role, roles, is_active) VALUES
    (eva,  'Eva PRUEBA',  'prueba.pref.eva@test.local',  'SUPER_ADMIN', ARRAY['SUPER_ADMIN'], true),
    (ana,  'Ana PRUEBA',  'prueba.pref.ana@test.local',  'VIEWER', ARRAY['VIEWER'], true),
    (beto, 'Beto PRUEBA', 'prueba.pref.beto@test.local', 'VIEWER', ARRAY['VIEWER'], true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, roles = EXCLUDED.roles, is_active = true;
INSERT INTO public.push_suscripciones (user_id, endpoint, p256dh, auth, plataforma, navegador)
SELECT x, 'https://ejemplo.prueba/pref/' || left(x::text, 8), 'p256dh-PRUEBA', 'auth-PRUEBA', 'ios', 'PRUEBA'
  FROM unnest(ARRAY[eva, ana, beto]) x;

-- A Ana le llegaron: los tres de "solicitud de ingreso" (la pareja de
-- repetidos y el de pareja), una tarea, y la notificación de prueba.
v_ingreso := public.notif_emitir('gcx_solicitud_ingreso', ana, '{"nombre":"X","grupo":"G"}');
v_app     := public.notif_emitir('gcx_solicitud_ingreso_app', ana, '{"nombre":"X","grupo":"G"}');
v_pareja  := public.notif_emitir('gcx_solicitud_pareja_app', ana, '{"nombre":"X","pareja":"Y","grupo":"G"}');
v_tarea   := public.notif_emitir('agenda_tarea_asignada', ana, '{"tarea":"T","subdepartamento":"S","fecha":"F","horario":"H"}');
PERFORM public.notif_emitir('push_prueba', ana, '{}');
-- A Beto, la misma tarea.
v_otra    := public.notif_emitir('agenda_tarea_asignada', beto, '{"tarea":"T","subdepartamento":"S","fecha":"F","horario":"H"}');

-- ══════════════════════════════════════════════════════════════════════════
-- M · Lo que ve cada persona
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.chk('M1', 'Ana: una sola entrada por los repetidos, sin la de prueba (no apagable)',
    'Solicitudes para sumarse a tu grupo (GCX) | Tareas nuevas (Agenda)', pg_temp.prefs(ana));
PERFORM pg_temp.chk('M2', 'Eva: nada (no le llegó ninguna)', '(nada)', COALESCE(pg_temp.prefs(eva), '(nada)'));
PERFORM pg_temp.sesion(NULL);
PERFORM pg_temp.chk('M3', 'sin sesión', 'sin_sesion', public.notif_mis_preferencias()->>'motivo');

-- ══════════════════════════════════════════════════════════════════════════
-- S · Apagar y prender
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.sesion(ana);
v_j := public.notif_silenciar(pg_temp.id_de('gcx_solicitud_ingreso_app'), true);
PERFORM pg_temp.chk('S1', 'apagar el repetido se guarda en la principal', 'ok · 1 fila · en la principal',
    CASE WHEN (v_j->>'ok')::boolean THEN 'ok' ELSE v_j::text END || ' · '
    || (SELECT count(*) FROM public.notif_silenciadas WHERE user_id = ana) || ' fila · '
    || CASE WHEN EXISTS (SELECT 1 FROM public.notif_silenciadas WHERE user_id = ana AND alerta_id = pg_temp.id_de('gcx_solicitud_ingreso'))
            THEN 'en la principal' ELSE 'EN OTRA' END);
PERFORM pg_temp.chk('S2', 'los tres avisos del mismo hecho quedan silenciados; la tarea no', 'silenciada · silenciada · silenciada · enviar',
    pg_temp.decision(v_ingreso) || ' · ' || pg_temp.decision(v_app) || ' · ' || pg_temp.decision(v_pareja) || ' · ' || pg_temp.decision(v_tarea));
PERFORM pg_temp.chk('S3', 'Ana la ve apagada, una sola vez', 'Solicitudes para sumarse a tu grupo (GCX)[apagada] | Tareas nuevas (Agenda)', pg_temp.prefs(ana));
PERFORM pg_temp.sesion(ana);
v_j := public.notif_silenciar(pg_temp.id_de('gcx_solicitud_ingreso'), false);
PERFORM pg_temp.chk('S4', 'prender de nuevo: 0 filas y vuelve a sonar', 'ok · 0 · enviar · enviar',
    CASE WHEN (v_j->>'ok')::boolean THEN 'ok' ELSE v_j::text END || ' · '
    || (SELECT count(*) FROM public.notif_silenciadas WHERE user_id = ana) || ' · ' || pg_temp.decision(v_ingreso) || ' · ' || pg_temp.decision(v_app));
PERFORM pg_temp.chk('S5', 'la notificación de prueba no se puede apagar', 'no_apagable',
    public.notif_silenciar(pg_temp.id_de('push_prueba'), true)->>'motivo');
PERFORM pg_temp.chk('S6', 'una alerta que no existe', 'no_existe', public.notif_silenciar(gen_random_uuid(), true)->>'motivo');
PERFORM pg_temp.sesion(NULL);
PERFORM pg_temp.chk('S7', 'sin sesión', 'sin_sesion', public.notif_silenciar(pg_temp.id_de('agenda_tarea_asignada'), true)->>'motivo');

-- Otra persona: Beto apaga la tarea. A Ana le sigue sonando.
PERFORM pg_temp.sesion(beto);
PERFORM public.notif_silenciar(pg_temp.id_de('agenda_tarea_asignada'), true);
PERFORM pg_temp.chk('S8', 'lo que apaga Beto es sólo de Beto', 'Beto silenciada · Ana enviar · Ana 0 filas',
    'Beto ' || pg_temp.decision(v_otra) || ' · Ana ' || pg_temp.decision(v_tarea) || ' · Ana '
    || (SELECT count(*) FROM public.notif_silenciadas WHERE user_id = ana) || ' filas');

-- RLS de verdad: como el rol authenticated, con la sesión de Ana.
PERFORM pg_temp.sesion(ana);
PERFORM public.notif_silenciar(pg_temp.id_de('gcx_grupo_aprobado'), true);
-- El id antes de cambiar de rol: authenticated no ve las funciones temporales.
v_dif := pg_temp.id_de('gcx_grupo_aprobado');
SET LOCAL ROLE authenticated;
SELECT count(*), count(*) FILTER (WHERE user_id <> ana) INTO v_n, v_m FROM public.notif_silenciadas;
BEGIN
    INSERT INTO public.notif_silenciadas (user_id, alerta_id) VALUES (beto, v_dif);
    v_t := 'PUDO INSERTAR';
EXCEPTION WHEN insufficient_privilege THEN v_t := 'sin permiso';
END;
BEGIN
    DELETE FROM public.notif_silenciadas WHERE user_id = beto;
    v_t := v_t || ' · PUDO BORRAR';
EXCEPTION WHEN insufficient_privilege THEN v_t := v_t || ' · sin permiso';
END;
RESET ROLE;
PERFORM pg_temp.chk('S9', 'Ana (authenticated) sólo ve lo suyo', '1 suya · 0 ajenas', v_n || ' suya · ' || v_m || ' ajenas');
PERFORM pg_temp.chk('S10', 'y no puede escribir la tabla directo', 'sin permiso · sin permiso', v_t);
PERFORM pg_temp.chk('S11', 'lo de Beto sigue intacto', '1', (SELECT count(*) FROM public.notif_silenciadas WHERE user_id = beto)::text);

-- Una alerta que deja de ser apagable: lo elegido queda pero no se aplica.
UPDATE public.notif_alertas SET permite_apagar = false WHERE clave = 'agenda_tarea_asignada';
PERFORM pg_temp.chk('S12', 'no apagable: la fila de Beto queda, pero suena; y no aparece en sus preferencias', '1 fila · enviar · (nada)',
    (SELECT count(*) FROM public.notif_silenciadas WHERE user_id = beto) || ' fila · ' || pg_temp.decision(v_otra) || ' · ' || COALESCE(pg_temp.prefs(beto), '(nada)'));
PERFORM pg_temp.sesion(beto);
PERFORM pg_temp.chk('S13', 'mientras no es apagable, no se puede apagar ni prender', 'no_apagable',
    public.notif_silenciar(pg_temp.id_de('agenda_tarea_asignada'), true)->>'motivo');
UPDATE public.notif_alertas SET permite_apagar = true WHERE clave = 'agenda_tarea_asignada';
PERFORM pg_temp.chk('S14', 'vuelve a ser apagable: lo elegido vuelve a aplicarse', 'silenciada', pg_temp.decision(v_otra));
UPDATE public.notif_alertas SET activa = false WHERE clave = 'agenda_tarea_asignada';
PERFORM pg_temp.chk('S15', 'pausada por Sistemas gana sobre apagada', 'pausada', pg_temp.decision(v_otra));
UPDATE public.notif_alertas SET activa = true WHERE clave = 'agenda_tarea_asignada';

-- ══════════════════════════════════════════════════════════════════════════
-- C · Cada camino
-- ══════════════════════════════════════════════════════════════════════════
-- Ana apaga la solicitud de ingreso otra vez.
PERFORM pg_temp.sesion(ana);
PERFORM public.notif_silenciar(pg_temp.id_de('gcx_solicitud_ingreso'), true);

-- 1 · El trigger fila por fila: el aviso nuevo pide su push, y send-push
--     recibe 'silenciada' de notif_puede_enviar y lo anota.
v_n := (SELECT count(*) FROM net.http_request_queue);
v_ingreso := public.notif_emitir('gcx_solicitud_ingreso', ana, '{"nombre":"Z","grupo":"G"}');
INSERT INTO public.notif_push_log (notificacion_id, alerta_clave, user_id, resultado)
VALUES (v_ingreso, 'gcx_solicitud_ingreso', ana, pg_temp.decision(v_ingreso));
PERFORM pg_temp.chk('C1', 'trigger: el aviso queda, la decisión es silenciada y el log la acepta', 'aviso en la app · 1 pedido · silenciada · log silenciada',
    CASE WHEN EXISTS (SELECT 1 FROM public.app_notifications WHERE id = v_ingreso) THEN 'aviso en la app' ELSE 'SIN AVISO' END
    || ' · ' || ((SELECT count(*) FROM net.http_request_queue) - v_n) || ' pedido · ' || pg_temp.decision(v_ingreso)
    || ' · log ' || (SELECT resultado FROM public.notif_push_log WHERE notificacion_id = v_ingreso));

-- 2 · El lote de una programada (Ana y Eva), con la reserva SKIP LOCKED.
PERFORM pg_temp.sesion(eva);
v_j := public.notif_guardar_programada(p_prog, 'PRUEBA preferencias', 'Hola', 'Mensaje de PRUEBA', '/notificaciones',
    true, '2026-12-10', NULL, 1, ARRAY['10:00']::time[], false, NULL, ARRAY[ana, eva]);
PERFORM pg_temp.sesion(ana);
v_j := (SELECT x FROM jsonb_array_elements(public.notif_mis_preferencias()->'alertas') x WHERE x->>'id' = p_prog::text);
PERFORM pg_temp.chk('C2', 'la programada le aparece a Ana', 'Avisos de la iglesia · Todos los días a las 10:00',
    COALESCE((v_j->>'area') || ' · ' || (v_j->>'descripcion'), 'no aparece'));
PERFORM public.notif_silenciar(p_prog, true);
PERFORM public.notif_programadas_tick(pg_temp.ar('2026-12-10 10:05'));
SELECT envio_id INTO v_envio FROM public.notif_programadas_hechas WHERE alerta_id = p_prog;
v_ids := public.notif_lote_tomar(v_envio, 50)->'ids';
SELECT n.id INTO v_ana_lote FROM public.app_notifications n WHERE n.envio_id = v_envio AND n.user_id = ana;
SELECT n.id INTO v_eva_lote FROM public.app_notifications n WHERE n.envio_id = v_envio AND n.user_id = eva;
PERFORM pg_temp.chk('C3', 'lote: los dos avisos se crean y se reservan; Ana silenciada, Eva sale',
    '2 avisos · 2 reservados · Ana silenciada · Eva enviar',
    (SELECT count(*) FROM public.app_notifications WHERE envio_id = v_envio) || ' avisos · '
    || jsonb_array_length(v_ids) || ' reservados · Ana ' || pg_temp.decision(v_ana_lote) || ' · Eva ' || pg_temp.decision(v_eva_lote));

-- 3 · Los diferidos del cron: cayó en no molestar ANTES de que Ana la apague.
UPDATE public.notif_alertas
   SET no_molestar = true,
       no_molestar_desde = ((now() AT TIME ZONE ZONA) - interval '1 hour')::time,
       no_molestar_hasta = ((now() AT TIME ZONE ZONA) + interval '1 hour')::time
 WHERE clave = 'agenda_tarea_completada';
v_dif := public.notif_emitir('agenda_tarea_completada', ana, '{"tarea":"T","subdepartamento":"S","nombre":"N"}');
v_t := pg_temp.decision(v_dif);
INSERT INTO public.notif_push_diferidos (notificacion_id, enviar_en) VALUES (v_dif, now() - interval '1 minute');
PERFORM pg_temp.sesion(ana);
PERFORM public.notif_silenciar(pg_temp.id_de('agenda_tarea_completada'), true);
v_ids := public.notif_diferidos_tomar(100)->'ids';
PERFORM pg_temp.chk('C4', 'diferidos: antes diferir; el cron lo toma y ya está silenciada', 'diferir · tomado · silenciada',
    v_t || ' · ' || CASE WHEN v_ids @> jsonb_build_array(v_dif) THEN 'tomado' ELSE 'NO TOMADO' END || ' · ' || pg_temp.decision(v_dif));

-- 4 · No molestar + apagada: no se difiere, se descarta.
v_dif := public.notif_emitir('agenda_tarea_completada', ana, '{"tarea":"T2","subdepartamento":"S","nombre":"N"}');
PERFORM pg_temp.chk('C5', 'en horario de no molestar y apagada: silenciada (no diferir)', 'silenciada', pg_temp.decision(v_dif));

-- 5 · La prueba a uno mismo no respeta lo apagado.
PERFORM pg_temp.sesion(eva);
PERFORM public.notif_silenciar(pg_temp.id_de('agenda_tarea_asignada'), true);
v_j := public.notif_probar_texto('Prueba {tarea}', 'Mensaje', NULL, pg_temp.id_de('agenda_tarea_asignada'));
PERFORM pg_temp.chk('C6', 'notif_probar_texto con la alerta apagada: sale igual', 'ok · enviar',
    CASE WHEN (v_j->>'ok')::boolean THEN 'ok' ELSE v_j::text END || ' · '
    || pg_temp.decision((SELECT id FROM public.app_notifications WHERE user_id = eva AND title LIKE 'Prueba %' ORDER BY created_at DESC LIMIT 1)));

-- ══════════════════════════════════════════════════════════════════════════
-- A · Sistemas
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.sesion(eva);
v_j := public.notif_alertas_admin();
PERFORM pg_temp.chk('A1', 'apagada_por: la tarea la apagaron Beto y Eva', '2',
    (SELECT x->>'apagada_por' FROM jsonb_array_elements(v_j->'alertas') x WHERE x->>'clave' = 'agenda_tarea_asignada'));
PERFORM pg_temp.chk('A2', 'el repetido muestra lo de su principal y a quién apunta', '1 · Nueva solicitud de ingreso a un GCX',
    (SELECT (x->>'apagada_por') || ' · ' || (x->>'principal_nombre') FROM jsonb_array_elements(v_j->'alertas') x WHERE x->>'clave' = 'gcx_solicitud_ingreso_app'));
PERFORM pg_temp.chk('A3', 'permite_apagar en la lista (prueba: false; tarea: true)', 'false · true',
    (SELECT x->>'permite_apagar' FROM jsonb_array_elements(v_j->'alertas') x WHERE x->>'clave' = 'push_prueba') || ' · '
    || (SELECT x->>'permite_apagar' FROM jsonb_array_elements(v_j->'alertas') x WHERE x->>'clave' = 'agenda_tarea_asignada'));
v_j := public.notif_guardar_automatica(pg_temp.id_de('punto_pedido_listo'), 'Tu pedido {codigo} está listo', 'Retiralo en el Punto de Información.',
    true, false, NULL, NULL, NULL, false);
v_t := (SELECT permite_apagar::text FROM public.notif_alertas WHERE clave = 'punto_pedido_listo');
v_j := public.notif_guardar_automatica(pg_temp.id_de('punto_pedido_listo'), 'Tu pedido {codigo} está listo', 'Retiralo en el Punto de Información.',
    true, false, NULL, NULL, NULL);
PERFORM pg_temp.chk('A4', 'automática: p_permite_apagar=false se guarda; sin el parámetro no se toca', 'false · false',
    v_t || ' · ' || (SELECT permite_apagar::text FROM public.notif_alertas WHERE clave = 'punto_pedido_listo'));
v_j := public.notif_guardar_programada(p_nueva, 'PRUEBA no apagable', 'Hola', 'Mensaje', '/notificaciones',
    true, '2026-12-20', NULL, 1, ARRAY['10:00']::time[], false, NULL, ARRAY[eva], false, NULL, NULL, NULL, false, false);
v_t := (SELECT permite_apagar::text FROM public.notif_alertas WHERE id = p_nueva);
v_j := public.notif_guardar_programada(p_nueva, 'PRUEBA no apagable', 'Hola 2', 'Mensaje', '/notificaciones',
    true, '2026-12-20', NULL, 1, ARRAY['10:00']::time[], false, NULL, ARRAY[eva], false, NULL, NULL, NULL, false);
PERFORM pg_temp.chk('A5', 'programada: nace no apagable; editarla sin el parámetro no la cambia', 'false · false · Hola 2',
    v_t || ' · ' || (SELECT permite_apagar::text || ' · ' || titulo_plantilla FROM public.notif_alertas WHERE id = p_nueva));
PERFORM pg_temp.chk('A6', 'programada nueva sin decir nada: apagable', 'true',
    (SELECT permite_apagar::text FROM public.notif_alertas WHERE id = p_prog));

-- ══════════════════════════════════════════════════════════════════════════
-- E · Datos y permisos
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.chk('E1', 'las 20 automáticas con nombre público y área', '20 · 20',
    (SELECT count(*) FILTER (WHERE nombre_publico IS NOT NULL) || ' · ' || count(*) FILTER (WHERE area IS NOT NULL)
       FROM public.notif_alertas WHERE tipo = 'automatica'));
PERFORM pg_temp.chk('E2', 'los repetidos apuntan a su principal', 'gcx_grupo_aprobado_app→gcx_grupo_aprobado, gcx_solicitud_ingreso_app→gcx_solicitud_ingreso, gcx_solicitud_pareja_app→gcx_solicitud_ingreso',
    (SELECT string_agg(r.clave || '→' || p.clave, ', ' ORDER BY r.clave) FROM public.notif_alertas r JOIN public.notif_alertas p ON p.id = r.principal_id));
PERFORM pg_temp.chk('E3', 'no apagables en el catálogo de la app: sólo la de prueba', 'push_prueba',
    (SELECT string_agg(clave, ', ') FROM public.notif_alertas WHERE tipo = 'automatica' AND NOT permite_apagar AND clave <> 'punto_pedido_listo'));
PERFORM pg_temp.chk('E4', 'anon no ejecuta notif_silenciar ni notif_mis_preferencias', 'no · no',
    CASE WHEN has_function_privilege('anon', 'public.notif_silenciar(uuid, boolean)', 'EXECUTE') THEN 'sí' ELSE 'no' END || ' · '
    || CASE WHEN has_function_privilege('anon', 'public.notif_mis_preferencias()', 'EXECUTE') THEN 'sí' ELSE 'no' END);
PERFORM pg_temp.chk('E5', 'authenticated: lee la tabla, no la escribe, no decide pushes', 'lee · no escribe · no decide',
    CASE WHEN has_table_privilege('authenticated', 'public.notif_silenciadas', 'SELECT') THEN 'lee' ELSE 'no lee' END || ' · '
    || CASE WHEN has_table_privilege('authenticated', 'public.notif_silenciadas', 'INSERT')
             OR has_table_privilege('authenticated', 'public.notif_silenciadas', 'DELETE') THEN 'ESCRIBE' ELSE 'no escribe' END || ' · '
    || CASE WHEN has_function_privilege('authenticated', 'public.notif_puede_enviar(uuid)', 'EXECUTE') THEN 'DECIDE' ELSE 'no decide' END);
PERFORM pg_temp.chk('E6', 'una sola firma de cada "guardar"', '1 · 1',
    (SELECT count(*) FROM pg_proc WHERE proname = 'notif_guardar_automatica') || ' · '
    || (SELECT count(*) FROM pg_proc WHERE proname = 'notif_guardar_programada'));

-- ══════════════════════════════════════════════════════════════════════════
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
