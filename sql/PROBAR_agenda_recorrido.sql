-- ════════════════════════════════════════════════════════════════════════════
-- Recorrido completo de Agenda Origen: departamento → sub-departamentos →
-- tareas → Agenda → solicitudes → reasignar → cambiar quién dirige →
-- archivar → borrar, con las mismas personas de punta a punta.
--
-- Las suites PROBAR_agenda_origen.sql y PROBAR_agenda_avisos.sql prueban cada
-- pieza por separado. Ésta encadena todo y, después de cada paso, mira lo que
-- ve cada persona desde su lado: su Agenda (agenda_mis_tareas), el detalle
-- (agenda_tarea), su panel (agenda_subdepartamento / agenda_departamento),
-- su acceso (agenda_mi_acceso), lo que pidió (agenda_mis_solicitudes) y sus
-- notificaciones y emails (app_notifications, agenda_avisos).
--
-- Igual que las otras: BEGIN … ROLLBACK y UN bloque que termina con
-- RAISE EXCEPTION a propósito, así se deshace entero (usuarios, departamento,
-- tareas, solicitudes, notificaciones, avisos). El resultado viaja en el
-- mensaje: "RESULTADO ✅ …" con la tabla, o "FALLÓ R<n>: …" en el primer paso
-- que no da lo esperado. NUNCA COMMIT.
--
-- Emails: no se toca agenda_emails_desde(). Antes del 2/11/2026 los emails
-- quedan 'pausado' y no hay ningún pedido a pg_net; después quedan
-- 'pendiente' con su pedido en la cola, que tampoco sale porque la
-- transacción se deshace. La suite espera lo que corresponda al día en que
-- corre.
--
-- Personas (apellido "PRUEBA", emails @test.local; nadie real):
--   Sistemas (SUPER_ADMIN) · Encargada y Encargado del departamento ·
--   Diseño: Dirige, Miembro Uno, Miembro Dos · Video: Dirige Video ·
--   Solicitante (sin equipo) · Ajeno (sin nada, de control).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- Contadores para verificar como dueño (después de RESET ROLE).
CREATE FUNCTION pg_temp.notifs(p_user uuid, p_tipo text) RETURNS integer
LANGUAGE sql AS $f$
    SELECT count(*)::integer FROM public.app_notifications WHERE user_id = p_user AND type = p_tipo
$f$;
CREATE FUNCTION pg_temp.emails(p_user uuid) RETURNS integer
LANGUAGE sql AS $f$
    SELECT count(*)::integer FROM public.agenda_avisos WHERE user_id = p_user AND canal = 'email'
$f$;

DO $recorrido$
DECLARE
    -- Personas
    v_super  uuid := gen_random_uuid();
    v_encA   uuid := gen_random_uuid();
    v_encB   uuid := gen_random_uuid();
    v_dirD   uuid := gen_random_uuid();   -- dirige Diseño (después pasa a miembro)
    v_m1     uuid := gen_random_uuid();
    v_m2     uuid := gen_random_uuid();   -- miembro de Diseño (después lo dirige)
    v_dirV   uuid := gen_random_uuid();   -- dirige Video
    v_solic  uuid := gen_random_uuid();
    v_ajeno  uuid := gen_random_uuid();
    -- Estructura
    v_dep    uuid := gen_random_uuid();
    v_dis    uuid := gen_random_uuid();
    v_vid    uuid := gen_random_uuid();
    v_carp   uuid := gen_random_uuid();
    v_alta   uuid;
    v_normal uuid;
    -- Tareas y solicitudes
    t1 uuid := gen_random_uuid();   -- sin equipo → Diseño → completada
    t2 uuid := gen_random_uuid();   -- directo a Video, con horario → (archivar) → Diseño
    t3 uuid := gen_random_uuid();   -- sale de la solicitud s1
    t4 uuid := gen_random_uuid();   -- sale de s3 y se borra
    s1 uuid := gen_random_uuid();
    s2 uuid := gen_random_uuid();
    s3 uuid := gen_random_uuid();
    -- Trabajo
    v_hoy   date := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
    v_email text := CASE WHEN now() >= public.agenda_emails_desde() THEN 'pendiente' ELSE 'pausado' END;
    v_cola0 bigint;
    v_cola  bigint;
    r  jsonb;
    r2 jsonb;
    x  jsonb;
    n  integer;
    n2 integer;
    n3 integer;
    n4 integer;
    v_txt  text;
    v_txt2 text;
    o text := '';
BEGIN
    SELECT count(*) INTO v_cola0 FROM net.http_request_queue WHERE url LIKE '%send-agenda-aviso%';

    -- ════════════════════════════════════════════════════════════════════════
    -- Preparación: las personas
    -- ════════════════════════════════════════════════════════════════════════
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at) VALUES
        (v_super, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.rec.super@test.local', '', now(), now()),
        (v_encA,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.rec.enca@test.local',  '', now(), now()),
        (v_encB,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.rec.encb@test.local',  '', now(), now()),
        (v_dirD,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.rec.dird@test.local',  '', now(), now()),
        (v_m1,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.rec.m1@test.local',    '', now(), now()),
        (v_m2,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.rec.m2@test.local',    '', now(), now()),
        (v_dirV,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.rec.dirv@test.local',  '', now(), now()),
        (v_solic, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.rec.solic@test.local', '', now(), now()),
        (v_ajeno, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.rec.ajeno@test.local', '', now(), now());
    INSERT INTO public.users (id, name, email, role, roles, is_active) VALUES
        (v_super, 'Sistemas PRUEBA',     'prueba.rec.super@test.local', 'SUPER_ADMIN', ARRAY['SUPER_ADMIN'], true),
        (v_encA,  'Encargada PRUEBA',    'prueba.rec.enca@test.local',  'VIEWER', ARRAY['VIEWER'], true),
        (v_encB,  'Encargado PRUEBA',    'prueba.rec.encb@test.local',  'VIEWER', ARRAY['VIEWER'], true),
        (v_dirD,  'Dirige PRUEBA',       'prueba.rec.dird@test.local',  'VIEWER', ARRAY['VIEWER'], true),
        (v_m1,    'Miembro Uno PRUEBA',  'prueba.rec.m1@test.local',    'VIEWER', ARRAY['VIEWER'], true),
        (v_m2,    'Miembro Dos PRUEBA',  'prueba.rec.m2@test.local',    'VIEWER', ARRAY['VIEWER'], true),
        (v_dirV,  'Dirige Video PRUEBA', 'prueba.rec.dirv@test.local',  'VIEWER', ARRAY['VIEWER'], true),
        (v_solic, 'Solicitante PRUEBA',  'prueba.rec.solic@test.local', 'VIEWER', ARRAY['VIEWER'], true),
        (v_ajeno, 'Ajeno PRUEBA',        'prueba.rec.ajeno@test.local', 'VIEWER', ARRAY['VIEWER'], true)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role,
                                   roles = EXCLUDED.roles, is_active = true;

    -- ════════════════════════════════════════════════════════════════════════
    -- R1 · Sistemas crea el departamento con dos encargados
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_guardar_departamento(v_dep, 'Comunicación PRUEBA', '#7c3aed', 'palette', ARRAY[v_encA, v_encB]);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ R1: crear el departamento %', r; END IF;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    r := public.agenda_mi_acceso();
    SELECT count(*) INTO n FROM jsonb_array_elements(r->'encargado') e WHERE e->>'id' = v_dep::text;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_solic, 'role', 'authenticated')::text, true);
    r := public.agenda_mi_acceso();
    n2 := jsonb_array_length(r->'encargado') + jsonb_array_length(r->'dirijo') + jsonb_array_length(r->'miembro');
    r := public.agenda_departamentos_para_solicitar();
    SELECT count(*) INTO n3 FROM jsonb_array_elements(r->'departamentos') e WHERE e->>'id' = v_dep::text;
    r := public.agenda_departamento(v_dep);
    RESET ROLE;
    IF n <> 1 OR n2 <> 0 OR n3 <> 1 OR r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN
        RAISE EXCEPTION 'FALLÓ R1: encargada lo ve %, solicitante accesos %, para solicitar %, panel %', n, n2, n3, r;
    END IF;
    o := o || format(E'| R1 | Sistemas crea "Comunicación" con 2 encargados | la encargada lo tiene en su acceso; quien no es nada no, pero puede pedirle | encargada: %s · solicitante: accesos %s, en "para solicitar" %s, panel %s | ✅ |\n',
                     n, n2, n3, r->>'motivo');

    -- ════════════════════════════════════════════════════════════════════════
    -- R2 · La encargada arma el departamento: prioridades, carpeta, 2 equipos
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_prioridades_sugeridas(v_dep);
    IF jsonb_array_length(r->'prioridades') <> 4 THEN RAISE EXCEPTION 'FALLÓ R2: sugeridas %', r; END IF;
    SELECT id INTO v_alta   FROM public.agenda_prioridades WHERE departamento_id = v_dep AND nombre = 'Alta';
    SELECT id INTO v_normal FROM public.agenda_prioridades WHERE departamento_id = v_dep AND nombre = 'Normal';
    r := public.agenda_guardar_carpeta(v_carp, v_dep, 'Serie de noviembre PRUEBA', '#4f46e5');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ R2: carpeta %', r; END IF;
    r := public.agenda_guardar_subdepartamento(v_dis, v_dep, 'Diseño PRUEBA', '#db2777', v_dirD, ARRAY[v_m1, v_m2]);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ R2: Diseño %', r; END IF;
    r := public.agenda_guardar_subdepartamento(v_vid, v_dep, 'Video PRUEBA', '#2563eb', v_dirV, '{}');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ R2: Video %', r; END IF;
    r := public.agenda_departamento(v_dep);
    SELECT (s->>'cant_miembros')::int INTO n FROM jsonb_array_elements(r->'subdepartamentos') s WHERE s->>'id' = v_dis::text;
    n2 := jsonb_array_length(r->'subdepartamentos');
    n3 := jsonb_array_length(r->'encargados');
    -- Cada uno ve, en su acceso, lo que le toca.
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_dirD, 'role', 'authenticated')::text, true);
    r := public.agenda_mi_acceso();
    v_txt := format('dirige: dirijo %s', jsonb_array_length(r->'dirijo'));
    IF jsonb_array_length(r->'dirijo') <> 1 OR jsonb_array_length(r->'encargado') <> 0 THEN RAISE EXCEPTION 'FALLÓ R2: acceso de quien dirige %', r; END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m1, 'role', 'authenticated')::text, true);
    r := public.agenda_mi_acceso();
    v_txt := v_txt || format(' · miembro: miembro %s, dirijo %s', jsonb_array_length(r->'miembro'), jsonb_array_length(r->'dirijo'));
    IF jsonb_array_length(r->'miembro') <> 1 OR jsonb_array_length(r->'dirijo') <> 0 THEN RAISE EXCEPTION 'FALLÓ R2: acceso del miembro %', r; END IF;
    r := public.agenda_departamento(v_dep);
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ R2: un miembro entró al panel del departamento %', r; END IF;
    RESET ROLE;
    IF n <> 3 OR n2 <> 2 OR n3 <> 2 THEN RAISE EXCEPTION 'FALLÓ R2: Diseño cuenta % personas, % equipos, % encargados', n, n2, n3; END IF;
    o := o || format(E'| R2 | La encargada arma: 4 prioridades, 1 carpeta, Diseño (dirige + 2) y Video (dirige) | el panel muestra 2 equipos, Diseño con 3 personas, 2 encargados; cada uno ve su parte; un miembro no entra al panel | %s equipos · Diseño %s · %s encargados · %s · panel para el miembro: sin_permiso | ✅ |\n',
                     n2, n, n3, v_txt);

    -- ════════════════════════════════════════════════════════════════════════
    -- R3 · Una tarea sin equipo queda "esperando": sólo la ven los encargados
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_crear_tarea(t1, v_dep, NULL, v_carp, v_normal, 'Placa del domingo PRUEBA', 'Formato historia y feed.', v_hoy, true, NULL, NULL);
    IF r->'tarea'->>'estado' IS DISTINCT FROM 'esperando' THEN RAISE EXCEPTION 'FALLÓ R3: crear sin equipo %', r; END IF;
    r := public.agenda_mi_acceso();
    SELECT (e->>'esperando')::int INTO n FROM jsonb_array_elements(r->'encargado') e WHERE e->>'id' = v_dep::text;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m1, 'role', 'authenticated')::text, true);
    r := public.agenda_tarea(t1);
    r2 := public.agenda_mis_tareas(v_hoy - 7, v_hoy + 30);
    RESET ROLE;
    SELECT count(*) INTO n2 FROM public.agenda_avisos WHERE tarea_id = t1;
    SELECT count(*) INTO n3 FROM public.app_notifications WHERE action_url = '/agenda?tarea=' || t1;
    IF n <> 1 OR r->>'motivo' IS DISTINCT FROM 'sin_permiso' OR jsonb_array_length(r2->'tareas') <> 0 OR n2 <> 0 OR n3 <> 0 THEN
        RAISE EXCEPTION 'FALLÓ R3: esperando %, detalle para el miembro %, su agenda %, avisos %, notificaciones %', n, r, r2, n2, n3;
    END IF;
    o := o || format(E'| R3 | Tarea sin equipo | "esperando", 1 en el contador de la encargada; el miembro no la ve; nadie recibe aviso | estado esperando · contador %s · miembro: detalle %s, agenda %s · avisos %s · notificaciones %s | ✅ |\n',
                     n, r->>'motivo', jsonb_array_length(r2->'tareas'), n2, n3);

    -- ════════════════════════════════════════════════════════════════════════
    -- R4 · Se la asigna a Diseño: le llega a los 3 y aparece en su Agenda
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_reasignar_tarea(t1, v_dis);
    IF r->'tarea'->>'estado' IS DISTINCT FROM 'en_proceso' OR r->'tarea'->>'asignada_at' IS NULL THEN
        RAISE EXCEPTION 'FALLÓ R4: asignar %', r;
    END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m1, 'role', 'authenticated')::text, true);
    r := public.agenda_mis_tareas(v_hoy - 7, v_hoy + 30);
    SELECT count(*) INTO n FROM jsonb_array_elements(r->'tareas') e WHERE e->>'id' = t1::text;
    r := public.agenda_tarea(t1);
    IF (r->>'ok')::boolean IS NOT TRUE OR (r->'tarea'->>'puede_cambiar_estado')::boolean IS NOT TRUE
       OR (r->'tarea'->>'puede_editar')::boolean IS NOT FALSE OR jsonb_array_length(r->'tarea'->'la_tienen') <> 3 THEN
        RAISE EXCEPTION 'FALLÓ R4: detalle para el miembro %', r;
    END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_dirD, 'role', 'authenticated')::text, true);
    r2 := public.agenda_subdepartamento(v_dis);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_dirV, 'role', 'authenticated')::text, true);
    r := public.agenda_mis_tareas(v_hoy - 7, v_hoy + 30);
    SELECT count(*) INTO n2 FROM jsonb_array_elements(r->'tareas') e WHERE e->>'id' = t1::text;
    RESET ROLE;
    IF n <> 1 OR n2 <> 0 OR (r2->'contadores'->>'en_proceso')::int <> 1 OR (r2->'contadores'->>'para_hoy')::int <> 1 THEN
        RAISE EXCEPTION 'FALLÓ R4: agenda del miembro %, de Video %, panel de quien dirige %', n, n2, r2->'contadores';
    END IF;
    SELECT count(*) INTO n3 FROM public.app_notifications
     WHERE type = 'AGENDA_TAREA_ASIGNADA' AND action_url = '/agenda?tarea=' || t1
       AND user_id IN (v_dirD, v_m1, v_m2) AND title = 'Nueva tarea: Placa del domingo PRUEBA'
       AND message LIKE 'Diseño PRUEBA · % · Todo el día';
    IF n3 <> 3 OR pg_temp.notifs(v_encA, 'AGENDA_TAREA_ASIGNADA') + pg_temp.notifs(v_encB, 'AGENDA_TAREA_ASIGNADA')
                + pg_temp.notifs(v_dirV, 'AGENDA_TAREA_ASIGNADA') <> 0 THEN
        RAISE EXCEPTION 'FALLÓ R4: % notificaciones bien armadas a Diseño, o le llegó a un encargado o a Video', n3;
    END IF;
    SELECT string_agg(DISTINCT estado, ','), count(*) INTO v_txt, n FROM public.agenda_avisos WHERE tarea_id = t1 AND canal = 'email';
    IF v_txt IS DISTINCT FROM v_email OR n <> 3 THEN RAISE EXCEPTION 'FALLÓ R4: emails % (%), esperaba 3 %', v_txt, n, v_email; END IF;
    o := o || format(E'| R4 | Asignar a Diseño | en proceso; los 3 de Diseño la ven y reciben el aviso; Video y los encargados no; emails "%s" | en su agenda 1 · Video 0 · panel: en proceso %s, para hoy %s · notificaciones %s (texto y link bien) · emails %s × %s | ✅ |\n',
                     v_email, r2->'contadores'->>'en_proceso', r2->'contadores'->>'para_hoy', n3, n, v_txt);

    -- ════════════════════════════════════════════════════════════════════════
    -- R5 · Otra directo a Video, con horario: sólo le llega a Video
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encB, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_crear_tarea(t2, v_dep, v_vid, NULL, v_alta, 'Grabar el testimonio PRUEBA', NULL, v_hoy + 3, false, '10:00', '12:00');
    IF r->'tarea'->>'estado' IS DISTINCT FROM 'en_proceso' THEN RAISE EXCEPTION 'FALLÓ R5: crear en Video %', r; END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m1, 'role', 'authenticated')::text, true);
    r := public.agenda_tarea(t2);
    RESET ROLE;
    SELECT message INTO v_txt FROM public.app_notifications WHERE user_id = v_dirV AND action_url = '/agenda?tarea=' || t2;
    SELECT count(*) INTO n FROM public.app_notifications WHERE action_url = '/agenda?tarea=' || t2;
    IF n <> 1 OR v_txt NOT LIKE 'Video PRUEBA · % · 10:00 – 12:00' OR r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN
        RAISE EXCEPTION 'FALLÓ R5: % notificaciones, texto "%", el de Diseño la ve %', n, v_txt, r;
    END IF;
    o := o || format(E'| R5 | El encargado crea una directo en Video, 10 a 12 | 1 aviso, a quien dirige Video, con el horario; Diseño no la ve | %s aviso: "%s" · Diseño: %s | ✅ |\n',
                     n, v_txt, r->>'motivo');

    -- ════════════════════════════════════════════════════════════════════════
    -- R6 · Un miembro la completa: les avisa a los 2 encargados, no a él
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m1, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_editar_tarea(t1, v_dis, NULL, NULL, 'Cambiada PRUEBA', NULL, v_hoy, true, NULL, NULL);
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ R6: un miembro editó %', r; END IF;
    r := public.agenda_cambiar_estado_tarea(t1, 'completada');
    IF r->'tarea'->>'estado' IS DISTINCT FROM 'completada' THEN RAISE EXCEPTION 'FALLÓ R6: completar %', r; END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_dirD, 'role', 'authenticated')::text, true);
    r2 := public.agenda_subdepartamento(v_dis);
    RESET ROLE;
    SELECT count(*) INTO n FROM public.app_notifications
     WHERE type = 'AGENDA_TAREA_COMPLETADA' AND action_url = '/agenda?tarea=' || t1
       AND user_id IN (v_encA, v_encB) AND message = 'Diseño PRUEBA · por Miembro Uno PRUEBA';
    n2 := pg_temp.notifs(v_m1, 'AGENDA_TAREA_COMPLETADA') + pg_temp.notifs(v_dirD, 'AGENDA_TAREA_COMPLETADA')
        + pg_temp.notifs(v_m2, 'AGENDA_TAREA_COMPLETADA');
    IF n <> 2 OR n2 <> 0 OR (r2->'contadores'->>'en_proceso')::int <> 0 OR (r2->'contadores'->>'completadas_mes')::int <> 1 THEN
        RAISE EXCEPTION 'FALLÓ R6: % a encargados, % al equipo, panel %', n, n2, r2->'contadores';
    END IF;
    SELECT completada_por::text INTO v_txt FROM public.agenda_tareas WHERE id = t1;
    IF v_txt IS DISTINCT FROM v_m1::text THEN RAISE EXCEPTION 'FALLÓ R6: completada_por %', v_txt; END IF;
    o := o || format(E'| R6 | Miembro Uno: editar, y completar | editar sin_permiso; completada por él; aviso a los 2 encargados ("· por Miembro Uno"), a nadie del equipo; el panel la pasa a completadas | sin_permiso · completada · encargados %s · equipo %s · panel: en proceso %s, completadas del mes %s | ✅ |\n',
                     n, n2, r2->'contadores'->>'en_proceso', r2->'contadores'->>'completadas_mes');

    -- ════════════════════════════════════════════════════════════════════════
    -- R7 · Reabrir y volver a completar: no se repite ningún aviso
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_dirD, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_cambiar_estado_tarea(t1, 'en_proceso');
    IF r->'tarea'->>'estado' IS DISTINCT FROM 'en_proceso' OR r->'tarea'->>'completada_at' IS NOT NULL THEN
        RAISE EXCEPTION 'FALLÓ R7: reabrir %', r;
    END IF;
    r := public.agenda_cambiar_estado_tarea(t1, 'completada');
    RESET ROLE;
    SELECT count(*) INTO n FROM public.app_notifications WHERE action_url = '/agenda?tarea=' || t1;
    SELECT count(*) INTO n2 FROM public.agenda_avisos WHERE tarea_id = t1;
    IF r->'tarea'->>'estado' IS DISTINCT FROM 'completada' OR n <> 5 OR n2 <> 10 THEN
        RAISE EXCEPTION 'FALLÓ R7: estado %, % notificaciones (esperaba 5), % avisos (esperaba 10)', r->'tarea'->>'estado', n, n2;
    END IF;
    o := o || format(E'| R7 | Quien dirige la reabre y la vuelve a completar | en proceso sin fecha de completada → completada; ningún aviso nuevo | %s notificaciones (3 asignada + 2 completada) · %s filas en agenda_avisos | ✅ |\n', n, n2);

    -- ════════════════════════════════════════════════════════════════════════
    -- R8 · Alguien sin equipo manda una solicitud
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_solic, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_crear_solicitud(s1, v_dep, v_normal, E'PRUEBA: necesitamos un video\n  para el bautismo   del 15.');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ R8: crear %', r; END IF;
    r := public.agenda_mis_solicitudes();
    SELECT e->>'estado' INTO v_txt FROM jsonb_array_elements(r->'solicitudes') e WHERE e->>'id' = s1::text;
    r2 := public.agenda_solicitudes_departamento(v_dep);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    r := public.agenda_mi_acceso();
    SELECT (e->>'solicitudes_nuevas')::int INTO n FROM jsonb_array_elements(r->'encargado') e WHERE e->>'id' = v_dep::text;
    r := public.agenda_solicitudes_departamento(v_dep);
    SELECT e INTO x FROM jsonb_array_elements(r->'solicitudes') e WHERE e->>'id' = s1::text;
    RESET ROLE;
    SELECT count(*) INTO n2 FROM public.app_notifications
     WHERE type = 'AGENDA_SOLICITUD_NUEVA' AND user_id IN (v_encA, v_encB)
       AND title = 'Solicitud nueva para Comunicación PRUEBA'
       AND action_url = '/departamentos/' || v_dep || '?tab=solicitudes'
       AND message = 'Solicitante PRUEBA · PRUEBA: necesitamos un video para el bautismo del 15.';
    IF v_txt IS DISTINCT FROM 'nueva' OR r2->>'motivo' IS DISTINCT FROM 'sin_permiso' OR n <> 1 OR n2 <> 2
       OR x->'solicitante'->>'nombre' IS DISTINCT FROM 'Solicitante PRUEBA' OR x->'solicitante' ? 'email' THEN
        RAISE EXCEPTION 'FALLÓ R8: la ve como %, lista del depto %, contador %, avisos %, en la lista %', v_txt, r2, n, n2, x;
    END IF;
    o := o || format(E'| R8 | El solicitante pide un video | la ve "nueva" en sus solicitudes; no ve las del depto; los 2 encargados reciben el aviso (detalles en una línea) y el contador sube | suyas: %s · del depto: %s · contador %s · avisos %s · en la lista: nombre sí, email no | ✅ |\n',
                     v_txt, r2->>'motivo', n, n2);

    -- ════════════════════════════════════════════════════════════════════════
    -- R9 · El encargado la acepta: el solicitante se entera, sin email
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encB, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_revisar_solicitud(s1, 'aceptar');
    IF r->>'estado' IS DISTINCT FROM 'aceptada' THEN RAISE EXCEPTION 'FALLÓ R9: aceptar %', r; END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    r := public.agenda_mi_acceso();
    SELECT (e->>'solicitudes_nuevas')::int INTO n FROM jsonb_array_elements(r->'encargado') e WHERE e->>'id' = v_dep::text;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_solic, 'role', 'authenticated')::text, true);
    r := public.agenda_mis_solicitudes();
    SELECT e INTO x FROM jsonb_array_elements(r->'solicitudes') e WHERE e->>'id' = s1::text;
    RESET ROLE;
    SELECT count(*) INTO n2 FROM public.app_notifications
     WHERE user_id = v_solic AND type = 'AGENDA_SOLICITUD_REVISADA'
       AND title = 'Tu solicitud a Comunicación PRUEBA fue aceptada'
       AND action_url = '/perfil/solicitudes';
    IF n <> 0 OR x->>'estado' IS DISTINCT FROM 'aceptada' OR x->'tarea' <> 'null'::jsonb OR n2 <> 1 OR pg_temp.emails(v_solic) <> 0 THEN
        RAISE EXCEPTION 'FALLÓ R9: contador %, la ve %, aviso %, emails %', n, x, n2, pg_temp.emails(v_solic);
    END IF;
    o := o || format(E'| R9 | El encargado la acepta | el contador de nuevas vuelve a 0; el solicitante la ve aceptada (sin tarea todavía) y recibe 1 aviso que lleva a /perfil/solicitudes, ningún email | contador %s · suyas: %s · aviso %s (a /perfil/solicitudes) · emails 0 | ✅ |\n',
                     n, x->>'estado', n2);

    -- ════════════════════════════════════════════════════════════════════════
    -- R10 · La tarea sale de la solicitud, para Video
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encB, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_crear_tarea(t3, v_dep, v_vid, v_carp, v_normal, 'Video del bautismo PRUEBA', NULL, v_hoy + 5, true, NULL, NULL, s1);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ R10: crear desde la solicitud %', r; END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_dirV, 'role', 'authenticated')::text, true);
    r := public.agenda_tarea(t3);
    v_txt := r->'tarea'->'solicitud'->'solicitante'->>'nombre';
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_solic, 'role', 'authenticated')::text, true);
    r := public.agenda_mis_solicitudes();
    SELECT e INTO x FROM jsonb_array_elements(r->'solicitudes') e WHERE e->>'id' = s1::text;
    r2 := public.agenda_tarea(t3);
    RESET ROLE;
    n := pg_temp.notifs(v_dirV, 'AGENDA_TAREA_ASIGNADA');
    IF v_txt IS DISTINCT FROM 'Solicitante PRUEBA' OR x->>'estado' IS DISTINCT FROM 'asignada'
       OR x->'tarea'->>'estado' IS DISTINCT FROM 'en_proceso' OR r2->>'motivo' IS DISTINCT FROM 'sin_permiso' OR n <> 2 THEN
        RAISE EXCEPTION 'FALLÓ R10: quién pidió %, la ve %, detalle para el solicitante %, avisos a Video %', v_txt, x, r2, n;
    END IF;
    o := o || format(E'| R10 | El encargado crea la tarea desde la solicitud, para Video | Video la ve con "solicitada por"; el solicitante ve su pedido "asignada" con la tarea en proceso (no entra a la tarea) | solicitada por %s · suyas: %s, tarea %s · detalle para él: %s · avisos a Video: %s | ✅ |\n',
                     v_txt, x->>'estado', x->'tarea'->>'estado', r2->>'motivo', n);

    -- ════════════════════════════════════════════════════════════════════════
    -- R11 · Otra solicitud, rechazada
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_solic, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    -- Sin prioridad no se puede: el departamento tiene (la base acepta NULL sólo si no tiene ninguna).
    r := public.agenda_crear_solicitud(s2, v_dep, NULL, 'PRUEBA: ¿pueden filmar la cena del sábado?');
    IF r->>'motivo' IS DISTINCT FROM 'prioridad_requerida' AND (r->>'ok')::boolean IS NOT FALSE THEN
        RAISE EXCEPTION 'FALLÓ R11: aceptó una solicitud sin prioridad %', r;
    END IF;
    v_txt2 := r->>'motivo';
    r := public.agenda_crear_solicitud(s2, v_dep, v_normal, 'PRUEBA: ¿pueden filmar la cena del sábado?');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ R11: crear %', r; END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    r := public.agenda_revisar_solicitud(s2, 'rechazar');
    IF r->>'estado' IS DISTINCT FROM 'rechazada' THEN RAISE EXCEPTION 'FALLÓ R11: rechazar %', r; END IF;
    r := public.agenda_crear_tarea(gen_random_uuid(), v_dep, NULL, NULL, NULL, 'Desde rechazada PRUEBA', NULL, v_hoy, true, NULL, NULL, s2);
    IF r->>'motivo' IS DISTINCT FROM 'solicitud_no_aceptada' THEN RAISE EXCEPTION 'FALLÓ R11: tarea desde una rechazada %', r; END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_solic, 'role', 'authenticated')::text, true);
    r := public.agenda_mis_solicitudes();
    SELECT e->>'estado' INTO v_txt FROM jsonb_array_elements(r->'solicitudes') e WHERE e->>'id' = s2::text;
    RESET ROLE;
    SELECT count(*) INTO n FROM public.app_notifications
     WHERE user_id = v_solic AND title = 'Tu solicitud a Comunicación PRUEBA no fue aceptada';
    IF v_txt IS DISTINCT FROM 'rechazada' OR n <> 1 OR pg_temp.notifs(v_solic, 'AGENDA_SOLICITUD_REVISADA') <> 2 THEN
        RAISE EXCEPTION 'FALLÓ R11: la ve %, avisos "no fue aceptada" %', v_txt, n;
    END IF;
    o := o || format(E'| R11 | Pide otra cosa (primero sin prioridad) y la encargada la rechaza | sin prioridad no se puede; la ve rechazada; aviso "no fue aceptada"; no se puede hacer tarea con ella | sin prioridad: %s · suyas: %s · aviso %s · tarea: solicitud_no_aceptada | ✅ |\n',
                     COALESCE(v_txt2, 'rechazada'), v_txt, n);

    -- ════════════════════════════════════════════════════════════════════════
    -- R12 · Reasignar Video → Diseño → Video, y completarla
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_reasignar_tarea(t3, v_dis);
    IF r->'tarea'->'subdepartamento'->>'id' IS DISTINCT FROM v_dis::text THEN RAISE EXCEPTION 'FALLÓ R12: a Diseño %', r; END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_dirV, 'role', 'authenticated')::text, true);
    r := public.agenda_tarea(t3);
    v_txt := r->>'motivo';
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    r := public.agenda_reasignar_tarea(t3, v_vid);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_dirV, 'role', 'authenticated')::text, true);
    r := public.agenda_cambiar_estado_tarea(t3, 'completada');
    IF r->'tarea'->>'estado' IS DISTINCT FROM 'completada' THEN RAISE EXCEPTION 'FALLÓ R12: completar en Video %', r; END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    r := public.agenda_reasignar_tarea(t3, v_dis);
    v_txt2 := r->>'motivo';
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_solic, 'role', 'authenticated')::text, true);
    r := public.agenda_mis_solicitudes();
    SELECT e INTO x FROM jsonb_array_elements(r->'solicitudes') e WHERE e->>'id' = s1::text;
    RESET ROLE;
    SELECT count(*) INTO n FROM public.app_notifications WHERE action_url = '/agenda?tarea=' || t3 AND type = 'AGENDA_TAREA_ASIGNADA';
    SELECT count(*) INTO n2 FROM public.app_notifications WHERE action_url = '/agenda?tarea=' || t3 AND type = 'AGENDA_TAREA_COMPLETADA'
                                                       AND user_id IN (v_encA, v_encB);
    IF v_txt IS DISTINCT FROM 'sin_permiso' OR n <> 4 OR n2 <> 2 OR v_txt2 IS DISTINCT FROM 'completada'
       OR x->'tarea'->>'estado' IS DISTINCT FROM 'completada' THEN
        RAISE EXCEPTION 'FALLÓ R12: Video ve la de Diseño %, asignadas % (esperaba 4), completadas %, reasignar completada %, solicitante %',
                        v_txt, n, n2, v_txt2, x;
    END IF;
    o := o || format(E'| R12 | Reasignar a Diseño, volver a Video, completar, y querer moverla completada | Video deja de verla mientras está en Diseño; nadie recibe dos veces "asignada"; completar avisa a los 2 encargados; una completada no se reasigna; el solicitante la ve lista | Video: %s · asignadas %s (1 Video + 3 Diseño) · completadas %s · reasignar: %s · solicitante: tarea %s | ✅ |\n',
                     v_txt, n, n2, v_txt2, x->'tarea'->>'estado');

    -- ════════════════════════════════════════════════════════════════════════
    -- R13 · Borrar una tarea que salió de una solicitud la devuelve a "aceptada"
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_solic, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_crear_solicitud(s3, v_dep, v_alta, 'PRUEBA: fotos del retiro.');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ R13: crear s3 %', r; END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    r := public.agenda_revisar_solicitud(s3, 'aceptar');
    IF r->>'estado' IS DISTINCT FROM 'aceptada' THEN RAISE EXCEPTION 'FALLÓ R13: aceptar s3 %', r; END IF;
    r := public.agenda_crear_tarea(t4, v_dep, NULL, NULL, v_alta, 'Fotos del retiro PRUEBA', NULL, v_hoy + 9, true, NULL, NULL, s3);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ R13: crear desde s3 %', r; END IF;
    r := public.agenda_eliminar_tarea(t4);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ R13: borrar %', r; END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_solic, 'role', 'authenticated')::text, true);
    r := public.agenda_mis_solicitudes();
    SELECT e INTO x FROM jsonb_array_elements(r->'solicitudes') e WHERE e->>'id' = s3::text;
    RESET ROLE;
    IF x->>'estado' IS DISTINCT FROM 'aceptada' OR x->'tarea' <> 'null'::jsonb THEN RAISE EXCEPTION 'FALLÓ R13: la solicitud quedó %', x; END IF;
    o := o || format(E'| R13 | Una tercera, aceptada, tarea creada sin equipo y borrada | la solicitud vuelve a "aceptada", sin tarea | suyas: %s, tarea %s | ✅ |\n',
                     x->>'estado', COALESCE(x->>'tarea', 'ninguna'));

    -- ════════════════════════════════════════════════════════════════════════
    -- R14 · Cambiar quién dirige Diseño: el anterior queda como miembro
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_cambiar_lider(v_dis, v_m2);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ R14: cambiar %', r; END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_dirD, 'role', 'authenticated')::text, true);
    r := public.agenda_mi_acceso();
    n := jsonb_array_length(r->'dirijo');
    n2 := jsonb_array_length(r->'miembro');
    r2 := public.agenda_subdepartamento(v_dis);
    r := public.agenda_mis_tareas(v_hoy - 7, v_hoy + 30);
    SELECT count(*) INTO n3 FROM jsonb_array_elements(r->'tareas') e WHERE e->>'id' = t1::text;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m2, 'role', 'authenticated')::text, true);
    r := public.agenda_subdepartamento(v_dis);
    RESET ROLE;
    IF n <> 0 OR n2 <> 1 OR r2->>'motivo' IS DISTINCT FROM 'sin_permiso' OR n3 <> 1
       OR (r->>'ok')::boolean IS NOT TRUE OR r->'lider'->>'id' IS DISTINCT FROM v_m2::text THEN
        RAISE EXCEPTION 'FALLÓ R14: el anterior dirijo % miembro % panel % tareas %; el nuevo %', n, n2, r2->>'motivo', n3, r;
    END IF;
    o := o || format(E'| R14 | Miembro Dos pasa a dirigir Diseño | el anterior queda miembro, sin panel, con sus tareas; el nuevo entra al panel | anterior: dirijo %s, miembro %s, panel %s, sigue viendo la suya %s · nuevo: panel ok | ✅ |\n',
                     n, n2, r2->>'motivo', n3);

    -- ════════════════════════════════════════════════════════════════════════
    -- R15 · Archivar Video: lo pendiente vuelve a "esperando", lo hecho queda
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_archivar_subdepartamento(v_vid);
    IF (r->>'ok')::boolean IS NOT TRUE OR (r->>'tareas_a_esperando')::int <> 1 OR (r->>'completadas_conservadas')::int <> 1 THEN
        RAISE EXCEPTION 'FALLÓ R15: archivar %', r;
    END IF;
    r := public.agenda_tarea(t2);
    v_txt := r->'tarea'->>'estado';
    r := public.agenda_departamento(v_dep);
    n := jsonb_array_length(r->'subdepartamentos');
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_dirV, 'role', 'authenticated')::text, true);
    r := public.agenda_mi_acceso();
    n2 := jsonb_array_length(r->'dirijo');
    r := public.agenda_mis_tareas(v_hoy - 7, v_hoy + 30);
    SELECT e INTO x FROM jsonb_array_elements(r->'tareas') e WHERE e->>'id' = t3::text;
    SELECT count(*) INTO n3 FROM jsonb_array_elements(r->'tareas') e WHERE e->>'id' = t2::text;
    r2 := public.agenda_cambiar_estado_tarea(t3, 'en_proceso');
    RESET ROLE;
    IF v_txt IS DISTINCT FROM 'esperando' OR n <> 1 OR n2 <> 0 OR x IS NULL
       OR (x->'subdepartamento'->>'archivado')::boolean IS NOT TRUE OR n3 <> 0 OR (r2->>'ok')::boolean IS TRUE THEN
        RAISE EXCEPTION 'FALLÓ R15: t2 %, equipos %, Video dirijo %, su completada %, ve t2 %, reabrir %', v_txt, n, n2, x, n3, r2;
    END IF;
    o := o || format(E'| R15 | Archivar Video (1 en proceso, 1 completada) | la pendiente vuelve a esperando; el panel muestra 1 equipo; quien dirigía Video pierde el panel, conserva la completada (marcada archivada) y no la puede reabrir | t2 %s · equipos %s · Video: dirijo %s, completada a la vista con archivado=true, t2 %s · reabrir: %s | ✅ |\n',
                     v_txt, n, n2, n3, r2->>'motivo');

    -- ════════════════════════════════════════════════════════════════════════
    -- R16 · La que volvió a esperar se le da a Diseño (con quien dirige nuevo)
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_reasignar_tarea(t2, v_vid);
    v_txt := r->>'motivo';
    r := public.agenda_reasignar_tarea(t2, v_dis);
    IF r->'tarea'->>'estado' IS DISTINCT FROM 'en_proceso' THEN RAISE EXCEPTION 'FALLÓ R16: a Diseño %', r; END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m2, 'role', 'authenticated')::text, true);
    r := public.agenda_subdepartamento(v_dis);
    RESET ROLE;
    SELECT count(*) INTO n FROM public.app_notifications
     WHERE action_url = '/agenda?tarea=' || t2 AND type = 'AGENDA_TAREA_ASIGNADA' AND user_id IN (v_dirD, v_m1, v_m2);
    IF v_txt IS DISTINCT FROM 'archivado' OR n <> 3 OR (r->'contadores'->>'en_proceso')::int <> 1 THEN
        RAISE EXCEPTION 'FALLÓ R16: al archivado %, avisos a Diseño %, panel %', v_txt, n, r->'contadores';
    END IF;
    o := o || format(E'| R16 | Darle la que esperaba a Video (archivado) y después a Diseño | Video: archivado; Diseño la recibe (los 3, también el que ya no dirige) | Video: %s · avisos a Diseño %s · panel del nuevo: en proceso %s | ✅ |\n',
                     v_txt, n, r->'contadores'->>'en_proceso');

    -- ════════════════════════════════════════════════════════════════════════
    -- R17 · El interruptor "Todo el departamento" de la Agenda
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_mis_tareas(v_hoy - 7, v_hoy + 30, false);
    SELECT count(*) INTO n FROM jsonb_array_elements(r->'tareas') e WHERE e->>'id' IN (t1::text, t2::text, t3::text);
    r := public.agenda_mis_tareas(v_hoy - 7, v_hoy + 30, true);
    SELECT count(*) INTO n2 FROM jsonb_array_elements(r->'tareas') e WHERE e->>'id' IN (t1::text, t2::text, t3::text);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m1, 'role', 'authenticated')::text, true);
    r := public.agenda_mis_tareas(v_hoy - 7, v_hoy + 30, true);
    SELECT count(*) INTO n3 FROM jsonb_array_elements(r->'tareas') e WHERE e->>'id' IN (t1::text, t2::text, t3::text);
    RESET ROLE;
    IF n <> 0 OR n2 <> 3 OR n3 <> 2 THEN RAISE EXCEPTION 'FALLÓ R17: encargada sin % / con % ; miembro con interruptor %', n, n2, n3; END IF;
    o := o || format(E'| R17 | Agenda con y sin "Todo el departamento" | la encargada (que no está en ningún equipo) ve 0 sin el interruptor y las 3 con él; a un miembro el interruptor no le suma nada | encargada: sin %s, con %s · Miembro Uno con el interruptor: %s (t1 y t2, no la de Video) | ✅ |\n',
                     n, n2, n3);

    -- ════════════════════════════════════════════════════════════════════════
    -- R18 · Cuentas de cada persona al final del recorrido
    -- ════════════════════════════════════════════════════════════════════════
    v_txt := format('Dirige %s/%s · Uno %s/%s · Dos %s/%s · Video %s/%s · EncA %s+%s/%s · EncB %s+%s/%s · Solicitante %s/%s · Ajeno %s',
        pg_temp.notifs(v_dirD, 'AGENDA_TAREA_ASIGNADA'), pg_temp.emails(v_dirD),
        pg_temp.notifs(v_m1, 'AGENDA_TAREA_ASIGNADA'), pg_temp.emails(v_m1),
        pg_temp.notifs(v_m2, 'AGENDA_TAREA_ASIGNADA'), pg_temp.emails(v_m2),
        pg_temp.notifs(v_dirV, 'AGENDA_TAREA_ASIGNADA'), pg_temp.emails(v_dirV),
        pg_temp.notifs(v_encA, 'AGENDA_TAREA_COMPLETADA'), pg_temp.notifs(v_encA, 'AGENDA_SOLICITUD_NUEVA'), pg_temp.emails(v_encA),
        pg_temp.notifs(v_encB, 'AGENDA_TAREA_COMPLETADA'), pg_temp.notifs(v_encB, 'AGENDA_SOLICITUD_NUEVA'), pg_temp.emails(v_encB),
        pg_temp.notifs(v_solic, 'AGENDA_SOLICITUD_REVISADA'), pg_temp.emails(v_solic),
        (SELECT count(*) FROM public.app_notifications WHERE user_id = v_ajeno));
    IF v_txt IS DISTINCT FROM 'Dirige 3/3 · Uno 3/3 · Dos 3/3 · Video 2/2 · EncA 2+3/2 · EncB 2+3/2 · Solicitante 3/0 · Ajeno 0' THEN
        RAISE EXCEPTION 'FALLÓ R18: %', v_txt;
    END IF;
    -- Ninguna notificación de más: todo lo de Agenda que hay es de estas personas.
    SELECT count(*) INTO n FROM public.app_notifications
     WHERE type LIKE 'AGENDA\_%' AND user_id IN (v_super, v_encA, v_encB, v_dirD, v_m1, v_m2, v_dirV, v_solic, v_ajeno);
    SELECT string_agg(DISTINCT estado, ',') INTO v_txt2 FROM public.agenda_avisos WHERE canal = 'email'
       AND user_id IN (v_super, v_encA, v_encB, v_dirD, v_m1, v_m2, v_dirV, v_solic, v_ajeno);
    SELECT count(*) INTO v_cola FROM net.http_request_queue WHERE url LIKE '%send-agenda-aviso%';
    IF n <> 24 OR v_txt2 IS DISTINCT FROM v_email
       OR (v_email = 'pausado' AND v_cola <> v_cola0) OR (v_email = 'pendiente' AND v_cola = v_cola0) THEN
        RAISE EXCEPTION 'FALLÓ R18: % notificaciones (esperaba 24), emails %, cola % → %', n, v_txt2, v_cola0, v_cola;
    END IF;
    o := o || format(E'| R18 | Lo que recibió cada uno (notificaciones/emails) | asignadas al equipo, completadas y solicitudes a los encargados, revisadas al solicitante sin email, nada al ajeno; emails "%s" | %s · total %s · emails %s · pedidos a pg_net: %s | ✅ |\n',
                     v_email, v_txt, n, v_txt2, v_cola - v_cola0);

    -- ════════════════════════════════════════════════════════════════════════
    -- R19 · El ajeno no vio ni pudo nada, en todo el recorrido
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ajeno, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_txt := concat_ws(' · ',
        'tarea ' || (public.agenda_tarea(t1)->>'motivo'),
        'estado ' || (public.agenda_cambiar_estado_tarea(t2, 'completada')->>'motivo'),
        'depto ' || (public.agenda_departamento(v_dep)->>'motivo'),
        'sub ' || (public.agenda_subdepartamento(v_dis)->>'motivo'),
        'solicitudes del depto ' || (public.agenda_solicitudes_departamento(v_dep)->>'motivo'),
        'aceptar ' || (public.agenda_revisar_solicitud(s2, 'aceptar')->>'motivo'));
    n := jsonb_array_length(public.agenda_mis_tareas(v_hoy - 7, v_hoy + 30, true)->'tareas');
    n2 := jsonb_array_length(public.agenda_mis_solicitudes()->'solicitudes');
    SELECT count(*) INTO n3 FROM public.agenda_tareas;
    BEGIN
        INSERT INTO public.agenda_tareas (id, departamento_id, nombre, fecha) VALUES (gen_random_uuid(), v_dep, 'Directo PRUEBA', v_hoy);
        RAISE EXCEPTION 'FALLÓ R19: el ajeno insertó una tarea directo';
    EXCEPTION WHEN insufficient_privilege THEN v_txt2 := 'insert directo: 42501';
    END;
    RESET ROLE;
    IF v_txt <> 'tarea sin_permiso · estado sin_permiso · depto sin_permiso · sub sin_permiso · solicitudes del depto sin_permiso · aceptar sin_permiso'
       OR n <> 0 OR n2 <> 0 OR n3 <> 0 THEN
        RAISE EXCEPTION 'FALLÓ R19: % · agenda % · solicitudes % · SELECT directo %', v_txt, n, n2, n3;
    END IF;
    o := o || format(E'| R19 | El ajeno, al final | sin_permiso en todo; agenda y solicitudes vacías; ni lee ni escribe directo | %s · agenda %s · suyas %s · SELECT directo %s filas · %s | ✅ |\n',
                     v_txt, n, n2, n3, v_txt2);

    -- ════════════════════════════════════════════════════════════════════════
    -- R20 · Sistemas borra el departamento: se va todo, menos las notificaciones
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_eliminar_departamento(v_dep);
    v_txt := r->>'motivo';
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated')::text, true);
    r := public.agenda_eliminar_departamento(v_dep);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ R20: borrar %', r; END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m2, 'role', 'authenticated')::text, true);
    r := public.agenda_mi_acceso();
    n := jsonb_array_length(r->'dirijo') + jsonb_array_length(r->'miembro');
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_solic, 'role', 'authenticated')::text, true);
    n2 := jsonb_array_length(public.agenda_mis_solicitudes()->'solicitudes');
    RESET ROLE;
    SELECT count(*) INTO n3 FROM public.agenda_tareas WHERE id IN (t1, t2, t3);
    SELECT n3 + count(*) INTO n3 FROM public.agenda_avisos WHERE tarea_id IN (t1, t2, t3);
    SELECT n3 + count(*) INTO n3 FROM public.agenda_subdepartamentos WHERE departamento_id = v_dep;
    SELECT count(*) INTO n4 FROM public.app_notifications WHERE type LIKE 'AGENDA\_%' AND user_id IN (v_encA, v_m1, v_solic);
    IF v_txt IS DISTINCT FROM 'sin_permiso' OR n <> 0 OR n2 <> 0 OR n3 <> 0 THEN
        RAISE EXCEPTION 'FALLÓ R20: encargada borra %, accesos %, solicitudes %, filas que quedaron %', v_txt, n, n2, n3;
    END IF;
    o := o || format(E'| R20 | La encargada intenta borrar el departamento; después Sistemas | la encargada no; Sistemas sí, y se van equipos, tareas, solicitudes y avisos; las notificaciones quedan (son de la gente) | encargada: %s · accesos de Miembro Dos %s · solicitudes del solicitante %s · filas que quedaron %s · notificaciones que siguen %s | ✅ |\n',
                     v_txt, n, n2, n3, n4);

    RAISE EXCEPTION E'RESULTADO ✅ recorrido completo en verde (emails: %)\n%', v_email, o;
END
$recorrido$;

ROLLBACK;
