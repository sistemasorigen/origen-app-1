-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de sql/agenda_origen.sql y sql/agenda_archivar_subdepartamentos.sql
--
-- Todo corre adentro de BEGIN … ROLLBACK y de UN bloque que termina con
-- RAISE EXCEPTION a propósito: así se deshace entero —usuarios, departamentos,
-- tareas, solicitudes— y el resultado viaja en el mensaje del error:
--   "RESULTADO ✅ …" con la tabla de casos, o "FALLÓ <caso>: …" en el primero
--   que no da lo esperado.
-- NUNCA COMMIT.
--
-- Usuarios: se crean en auth.users con apellido "PRUEBA" y emails
-- @test.local (handle_new_user les arma la fila en public.users con {VIEWER};
-- el ON CONFLICT DO UPDATE les pone el rol de la prueba). No se elige a nadie
-- real: los datos de la iglesia no aparecen en el resultado.
-- Ojo: la secuencia de agenda_solicitudes.numero no se deshace; cada corrida
-- gasta números (no hace daño: sólo deja huecos).
--
-- Para ensayar ANTES de aplicar: BEGIN; + los .sql que falten (en orden:
-- agenda_origen, agenda_archivar_subdepartamentos) + el DO de abajo +
-- ROLLBACK; en un solo envío.
--
-- Cómo se cambia de persona: set_config('request.jwt.claims', …) con el id y
-- SET LOCAL ROLE authenticated (o anon). RESET ROLE vuelve al dueño, que es
-- quien puede mirar las tablas para verificar.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

DO $$
DECLARE
    -- Personas
    v_super    uuid := gen_random_uuid();
    v_encA     uuid := gen_random_uuid();
    v_encB     uuid := gen_random_uuid();
    v_lider    uuid := gen_random_uuid();
    v_miembro  uuid := gen_random_uuid();
    v_miembro2 uuid := gen_random_uuid();
    v_comun    uuid := gen_random_uuid();
    v_solic    uuid := gen_random_uuid();
    -- Estructura
    v_depA  uuid := gen_random_uuid();
    v_depB  uuid := gen_random_uuid();
    v_subA1 uuid := gen_random_uuid();
    v_subA2 uuid := gen_random_uuid();
    v_subA3 uuid := gen_random_uuid();
    v_subB1 uuid := gen_random_uuid();
    v_carpA uuid := gen_random_uuid();
    v_carpB uuid := gen_random_uuid();
    v_prioA_baja uuid; v_prioA_normal uuid; v_prioA_alta uuid; v_prioA_urg uuid; v_prioB uuid;
    -- Tareas y solicitudes
    v_t1 uuid := gen_random_uuid(); v_t2 uuid := gen_random_uuid(); v_t3 uuid := gen_random_uuid();
    v_t4 uuid := gen_random_uuid(); v_t5 uuid := gen_random_uuid(); v_t6 uuid := gen_random_uuid();
    v_t7 uuid := gen_random_uuid(); v_t8 uuid := gen_random_uuid();
    v_tB uuid := gen_random_uuid(); v_tB2 uuid := gen_random_uuid();
    v_sol1 uuid := gen_random_uuid(); v_sol2 uuid := gen_random_uuid(); v_solB uuid := gen_random_uuid();
    -- Trabajo
    v_hoy date := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
    r jsonb;
    r2 jsonb;
    r3 jsonb;
    v_n integer;
    v_m integer;
    v_txt text;
    v_txt2 text;
    v_tabla text;
    v_bloq integer;
    v_tablas text[] := ARRAY['agenda_departamentos', 'agenda_departamento_encargados',
                             'agenda_subdepartamentos', 'agenda_subdepartamento_miembros',
                             'agenda_carpetas', 'agenda_prioridades',
                             'agenda_solicitudes', 'agenda_tareas'];
    o text := '';
    -- Las RPC que authenticated puede ejecutar (caso 23).
    v_rpc text[] := ARRAY[
        'agenda_agregar_miembros', 'agenda_archivar_subdepartamento', 'agenda_buscar_usuarios',
        'agenda_cambiar_encargados', 'agenda_cambiar_estado_tarea', 'agenda_cambiar_lider',
        'agenda_crear_solicitud', 'agenda_crear_tarea', 'agenda_departamento',
        'agenda_departamentos_admin', 'agenda_departamentos_para_solicitar', 'agenda_editar_tarea',
        'agenda_eliminar_carpeta', 'agenda_eliminar_departamento', 'agenda_eliminar_prioridad',
        'agenda_eliminar_tarea', 'agenda_guardar_carpeta', 'agenda_guardar_departamento',
        'agenda_guardar_prioridad', 'agenda_guardar_subdepartamento', 'agenda_mi_acceso',
        'agenda_mis_solicitudes', 'agenda_mis_tareas', 'agenda_mover_miembro',
        'agenda_ordenar_prioridades', 'agenda_prioridades_sugeridas', 'agenda_quitar_miembro',
        'agenda_reasignar_tarea', 'agenda_revisar_solicitud', 'agenda_solicitudes_departamento',
        'agenda_subdepartamento', 'agenda_tarea', 'agenda_tareas_departamento',
        'agenda_tareas_subdepartamento'];
BEGIN
    -- ════════════════════════════════════════════════════════════════════════
    -- Preparación: usuarios de prueba
    -- ════════════════════════════════════════════════════════════════════════
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
    VALUES
        (v_super,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.agenda.super@test.local',    '', now(), now()),
        (v_encA,     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.agenda.enca@test.local',     '', now(), now()),
        (v_encB,     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.agenda.encb@test.local',     '', now(), now()),
        (v_lider,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.agenda.lider@test.local',    '', now(), now()),
        (v_miembro,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.agenda.miembro@test.local',  '', now(), now()),
        (v_miembro2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.agenda.miembro2@test.local', '', now(), now()),
        (v_comun,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.agenda.comun@test.local',    '', now(), now()),
        (v_solic,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.agenda.solic@test.local',    '', now(), now());

    INSERT INTO public.users (id, name, email, role, roles, is_active) VALUES
        (v_super,    'Sistemas PRUEBA',    'prueba.agenda.super@test.local',    'SUPER_ADMIN', ARRAY['SUPER_ADMIN'], true),
        (v_encA,     'Encargada PRUEBA',   'prueba.agenda.enca@test.local',     'VIEWER', ARRAY['VIEWER'], true),
        (v_encB,     'Encargado PRUEBA',   'prueba.agenda.encb@test.local',     'VIEWER', ARRAY['VIEWER'], true),
        (v_lider,    'Líder PRUEBA',       'prueba.agenda.lider@test.local',    'VIEWER', ARRAY['VIEWER'], true),
        (v_miembro,  'Miembro PRUEBA',     'prueba.agenda.miembro@test.local',  'VIEWER', ARRAY['VIEWER'], true),
        (v_miembro2, 'Miembra PRUEBA',     'prueba.agenda.miembro2@test.local', 'VIEWER', ARRAY['VIEWER'], true),
        (v_comun,    'Común PRUEBA',       'prueba.agenda.comun@test.local',    'VIEWER', ARRAY['VIEWER'], true),
        (v_solic,    'Solicitante PRUEBA', 'prueba.agenda.solic@test.local',    'VIEWER', ARRAY['VIEWER'], true)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role,
                                   roles = EXCLUDED.roles, is_active = true;

    -- ════════════════════════════════════════════════════════════════════════
    -- 3 · Un autenticado común no crea departamentos
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_comun, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_guardar_departamento(v_depA, 'Creativos PRUEBA', '#7c3aed', 'palette', ARRAY[v_comun]);
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 3: un común creó un departamento %', r; END IF;
    r2 := public.agenda_departamentos_admin();
    IF r2->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 3: un común vio la lista de Sistemas %', r2; END IF;
    r3 := public.agenda_eliminar_departamento(v_depA);
    IF r3->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 3: un común borró %', r3; END IF;
    o := o || format(E'| 3 | Común: guardar, listar y eliminar departamentos | sin_permiso ×3 | %s · %s · %s | ✅ |\n',
                     r->>'motivo', r2->>'motivo', r3->>'motivo');

    -- ════════════════════════════════════════════════════════════════════════
    -- S1 · Sistemas arma dos departamentos (y las validaciones)
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated')::text, true);
    r := public.agenda_guardar_departamento(v_depA, '  Creativos PRUEBA ', '#7c3aed', 'palette', ARRAY[v_encA, v_encA, NULL]);
    IF (r->>'ok')::boolean IS NOT TRUE OR (r->>'creado')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ S1: crear A %', r; END IF;
    r := public.agenda_guardar_departamento(v_depB, 'Producción PRUEBA', '#c2410c', 'mic', ARRAY[v_encB]);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ S1: crear B %', r; END IF;
    r := public.agenda_guardar_departamento(gen_random_uuid(), 'creativos prueba', '#7c3aed', 'palette', ARRAY[v_encA]);
    IF r->>'motivo' IS DISTINCT FROM 'nombre_duplicado' THEN RAISE EXCEPTION 'FALLÓ S1: duplicado %', r; END IF;
    r := public.agenda_guardar_departamento(gen_random_uuid(), 'Otro PRUEBA', '#7c3aed', 'palette', '{}');
    IF r->>'motivo' IS DISTINCT FROM 'sin_encargados' THEN RAISE EXCEPTION 'FALLÓ S1: sin encargados %', r; END IF;
    r := public.agenda_guardar_departamento(gen_random_uuid(), 'Otro PRUEBA', '#7c3aed', 'palette', ARRAY[gen_random_uuid()]);
    IF r->>'motivo' IS DISTINCT FROM 'usuario_inexistente' THEN RAISE EXCEPTION 'FALLÓ S1: usuario inexistente %', r; END IF;
    r := public.agenda_guardar_departamento(gen_random_uuid(), 'Otro PRUEBA', '#7c3aed', 'Paleta!', ARRAY[v_encA]);
    IF r->>'motivo' IS DISTINCT FROM 'icono_invalido' THEN RAISE EXCEPTION 'FALLÓ S1: ícono %', r; END IF;
    r := public.agenda_guardar_departamento(gen_random_uuid(), 'Otro PRUEBA', 'violeta', 'palette', ARRAY[v_encA]);
    IF r->>'motivo' IS DISTINCT FROM 'color_invalido' THEN RAISE EXCEPTION 'FALLÓ S1: color %', r; END IF;
    -- Editar: mismo id, nombre nuevo, encargados reemplazados.
    r := public.agenda_guardar_departamento(v_depB, 'Producción PRUEBA', '#c2410c', 'mic', ARRAY[v_encB, v_super]);
    IF (r->>'creado')::boolean IS NOT FALSE THEN RAISE EXCEPTION 'FALLÓ S1: editar B %', r; END IF;
    r := public.agenda_guardar_departamento(v_depB, 'Producción PRUEBA', '#c2410c', 'mic', ARRAY[v_encB]);
    RESET ROLE;
    SELECT count(*) INTO v_n FROM public.agenda_departamento_encargados WHERE departamento_id = v_depA;
    SELECT count(*) INTO v_m FROM public.agenda_departamento_encargados WHERE departamento_id = v_depB;
    SELECT nombre INTO v_txt FROM public.agenda_departamentos WHERE id = v_depA;
    IF v_n <> 1 OR v_m <> 1 OR v_txt <> 'Creativos PRUEBA' THEN
        RAISE EXCEPTION 'FALLÓ S1: encargados A=% B=% o nombre sin recortar "%"', v_n, v_m, v_txt;
    END IF;
    o := o || format(E'| S1 | SUPER_ADMIN crea y edita departamentos; duplicado, sin encargados, usuario inexistente, ícono y color inválidos | ok + 5 motivos; encargados reemplazados; nombre recortado | ok · nombre_duplicado · sin_encargados · usuario_inexistente · icono_invalido · color_invalido · A=%s B=%s · "%s" | ✅ |\n', v_n, v_m, v_txt);

    -- ════════════════════════════════════════════════════════════════════════
    -- S2 · Los encargados arman sus equipos
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_prioridades_sugeridas(v_depA);
    IF jsonb_array_length(r->'prioridades') <> 4 THEN RAISE EXCEPTION 'FALLÓ S2: sugeridas %', r; END IF;
    r2 := public.agenda_prioridades_sugeridas(v_depA);
    IF r2->>'motivo' IS DISTINCT FROM 'ya_tiene' THEN RAISE EXCEPTION 'FALLÓ S2: sugeridas dos veces %', r2; END IF;
    -- Las prioridades se leen directo: es una de las dos tablas con policy de lectura.
    SELECT id INTO v_prioA_baja   FROM public.agenda_prioridades WHERE departamento_id = v_depA AND nombre = 'Baja';
    SELECT id INTO v_prioA_normal FROM public.agenda_prioridades WHERE departamento_id = v_depA AND nombre = 'Normal';
    SELECT id INTO v_prioA_alta   FROM public.agenda_prioridades WHERE departamento_id = v_depA AND nombre = 'Alta';
    SELECT id INTO v_prioA_urg    FROM public.agenda_prioridades WHERE departamento_id = v_depA AND nombre = 'Urgente';
    IF v_prioA_normal IS NULL OR v_prioA_urg IS NULL THEN RAISE EXCEPTION 'FALLÓ S2: el encargado no lee prioridades'; END IF;
    r := public.agenda_guardar_carpeta(v_carpA, v_depA, 'Serie PRUEBA', '#4f46e5');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ S2: carpeta %', r; END IF;
    r := public.agenda_guardar_subdepartamento(v_subA1, v_depA, 'Diseño PRUEBA', '#db2777', v_lider, ARRAY[v_miembro, v_lider]);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ S2: sub A1 %', r; END IF;
    r := public.agenda_guardar_subdepartamento(v_subA2, v_depA, 'Video PRUEBA', '#2563eb', v_encA, ARRAY[v_miembro2]);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ S2: sub A2 %', r; END IF;
    r := public.agenda_guardar_subdepartamento(v_subA3, v_depA, 'Redes PRUEBA', '#15803d', v_encA, '{}');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ S2: sub A3 %', r; END IF;
    r := public.agenda_guardar_subdepartamento(gen_random_uuid(), v_depA, 'diseño prueba', '#db2777', v_lider, '{}');
    IF r->>'motivo' IS DISTINCT FROM 'nombre_duplicado' THEN RAISE EXCEPTION 'FALLÓ S2: sub duplicado %', r; END IF;
    r := public.agenda_guardar_subdepartamento(gen_random_uuid(), v_depA, 'Sin líder PRUEBA', '#db2777', NULL, '{}');
    IF r->>'motivo' IS DISTINCT FROM 'lider_requerido' THEN RAISE EXCEPTION 'FALLÓ S2: sin líder %', r; END IF;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encB, 'role', 'authenticated')::text, true);
    r := public.agenda_prioridades_sugeridas(v_depB);
    SELECT id INTO v_prioB FROM public.agenda_prioridades WHERE departamento_id = v_depB AND nombre = 'Normal';
    r := public.agenda_guardar_carpeta(v_carpB, v_depB, 'Nocturna PRUEBA', '#c026d3');
    r := public.agenda_guardar_subdepartamento(v_subB1, v_depB, 'Sonido PRUEBA', '#0e7490', v_encB, '{}');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ S2: sub B1 %', r; END IF;
    r := public.agenda_crear_tarea(v_tB, v_depB, v_subB1, v_carpB, v_prioB, 'Prueba de sonido PRUEBA', NULL, v_hoy, true, NULL, NULL);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ S2: tarea B %', r; END IF;
    -- Una completada en B, para borrar el departamento con ella adentro (caso 22).
    r := public.agenda_crear_tarea(v_tB2, v_depB, v_subB1, NULL, NULL, 'Micrófonos PRUEBA', NULL, v_hoy, true, NULL, NULL);
    r := public.agenda_cambiar_estado_tarea(v_tB2, 'completada');
    IF r->'tarea'->>'estado' IS DISTINCT FROM 'completada' THEN RAISE EXCEPTION 'FALLÓ S2: completar en B %', r; END IF;
    RESET ROLE;
    SELECT count(*) INTO v_n FROM public.agenda_subdepartamento_miembros WHERE subdepartamento_id = v_subA1;
    IF v_n <> 1 OR EXISTS (SELECT 1 FROM public.agenda_subdepartamento_miembros WHERE subdepartamento_id = v_subA1 AND user_id = v_lider) THEN
        RAISE EXCEPTION 'FALLÓ S2: quien dirige quedó también como miembro (% filas)', v_n;
    END IF;
    o := o || format(E'| S2 | Encargados: sugeridas dos veces, carpeta, subs (duplicado, sin líder); quien dirige no queda como miembro | 4 · ya_tiene · nombre_duplicado · lider_requerido · 1 miembro | 4 · %s · nombre_duplicado · lider_requerido · %s miembro | ✅ |\n', r2->>'motivo', v_n);

    -- ════════════════════════════════════════════════════════════════════════
    -- 4 · El encargado de A no toca nada de B
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_txt := '';
    r := public.agenda_departamento(v_depB);
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 4: vio el panel de B %', r; END IF;
    v_txt := v_txt || 'panel ' || (r->>'motivo');
    r := public.agenda_tareas_departamento(v_depB, v_hoy - 10, v_hoy + 10);
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 4: vio tareas de B %', r; END IF;
    r := public.agenda_tarea(v_tB);
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 4: vio una tarea de B %', r; END IF;
    r := public.agenda_crear_tarea(gen_random_uuid(), v_depB, NULL, NULL, NULL, 'Intrusa PRUEBA', NULL, v_hoy, true, NULL, NULL);
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 4: creó en B %', r; END IF;
    v_txt := v_txt || ' · crear ' || (r->>'motivo');
    r := public.agenda_editar_tarea(v_tB, v_subB1, NULL, NULL, 'Editada PRUEBA', NULL, v_hoy, true, NULL, NULL);
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 4: editó en B %', r; END IF;
    v_txt := v_txt || ' · editar ' || (r->>'motivo');
    r := public.agenda_solicitudes_departamento(v_depB);
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 4: vio solicitudes de B %', r; END IF;
    r := public.agenda_guardar_carpeta(gen_random_uuid(), v_depB, 'Intrusa PRUEBA', '#4f46e5');
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 4: carpeta en B %', r; END IF;
    -- Ni colgar de B una tarea de A.
    r := public.agenda_crear_tarea(gen_random_uuid(), v_depA, v_subB1, NULL, NULL, 'Mezcla PRUEBA', NULL, v_hoy, true, NULL, NULL);
    IF r->>'motivo' IS DISTINCT FROM 'sub_ajeno' THEN RAISE EXCEPTION 'FALLÓ 4: sub de B en tarea de A %', r; END IF;
    v_txt := v_txt || ' · sub ' || (r->>'motivo');
    r := public.agenda_crear_tarea(gen_random_uuid(), v_depA, NULL, v_carpB, NULL, 'Mezcla PRUEBA', NULL, v_hoy, true, NULL, NULL);
    IF r->>'motivo' IS DISTINCT FROM 'carpeta_ajena' THEN RAISE EXCEPTION 'FALLÓ 4: carpeta de B %', r; END IF;
    v_txt := v_txt || ' · carpeta ' || (r->>'motivo');
    r := public.agenda_crear_tarea(gen_random_uuid(), v_depA, NULL, NULL, v_prioB, 'Mezcla PRUEBA', NULL, v_hoy, true, NULL, NULL);
    IF r->>'motivo' IS DISTINCT FROM 'prioridad_ajena' THEN RAISE EXCEPTION 'FALLÓ 4: prioridad de B %', r; END IF;
    v_txt := v_txt || ' · prioridad ' || (r->>'motivo');
    o := o || format(E'| 4 | Encargado de A contra B: panel, tareas, detalle, crear, editar, solicitudes, carpeta; tarea de A con sub/carpeta/prioridad de B | sin_permiso; sub_ajeno · carpeta_ajena · prioridad_ajena | %s | ✅ |\n', v_txt);

    -- ════════════════════════════════════════════════════════════════════════
    -- 17 · Horario inválido
    -- ════════════════════════════════════════════════════════════════════════
    r := public.agenda_crear_tarea(gen_random_uuid(), v_depA, v_subA1, NULL, NULL, 'Horario PRUEBA', NULL, v_hoy, false, '10:00', '09:00');
    IF r->>'motivo' IS DISTINCT FROM 'horario_invalido' THEN RAISE EXCEPTION 'FALLÓ 17: hasta < desde %', r; END IF;
    r2 := public.agenda_crear_tarea(gen_random_uuid(), v_depA, v_subA1, NULL, NULL, 'Horario PRUEBA', NULL, v_hoy, false, '10:00', '10:00');
    IF r2->>'motivo' IS DISTINCT FROM 'horario_invalido' THEN RAISE EXCEPTION 'FALLÓ 17: hasta = desde %', r2; END IF;
    r3 := public.agenda_crear_tarea(gen_random_uuid(), v_depA, v_subA1, NULL, NULL, 'Horario PRUEBA', NULL, v_hoy, false, '10:00', NULL);
    IF r3->>'motivo' IS DISTINCT FROM 'horario_invalido' THEN RAISE EXCEPTION 'FALLÓ 17: sin hasta %', r3; END IF;
    RESET ROLE;
    -- Y la base lo frena aunque alguien se saltee la RPC.
    BEGIN
        INSERT INTO public.agenda_tareas (departamento_id, nombre, fecha, todo_el_dia, hora_desde, hora_hasta, estado)
        VALUES (v_depA, 'Directa PRUEBA', v_hoy, false, '10:00', '09:00', 'esperando');
        RAISE EXCEPTION 'FALLÓ 17: el CHECK dejó pasar hasta < desde';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    o := o || format(E'| 17 | Horario: hasta < desde, hasta = desde, sin hasta; e INSERT directo | horario_invalido ×3; check_violation | %s · %s · %s · check_violation | ✅ |\n',
                     r->>'motivo', r2->>'motivo', r3->>'motivo');

    -- ════════════════════════════════════════════════════════════════════════
    -- 9 · El ciclo de estados
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_txt := '';
    r := public.agenda_crear_tarea(v_t1, v_depA, NULL, v_carpA, v_prioA_normal, '  Placas PRUEBA ', 'Cuatro placas.', v_hoy, true, NULL, NULL);
    IF r->'tarea'->>'estado' IS DISTINCT FROM 'esperando' OR r->'tarea'->>'asignada_at' IS NOT NULL
       OR r->'tarea'->>'nombre' IS DISTINCT FROM 'Placas PRUEBA' THEN
        RAISE EXCEPTION 'FALLÓ 9: crear sin sub %', r;
    END IF;
    v_txt := v_txt || 'crear sin sub → ' || (r->'tarea'->>'estado');
    r := public.agenda_reasignar_tarea(v_t1, v_subA1);
    IF r->'tarea'->>'estado' IS DISTINCT FROM 'en_proceso' OR r->'tarea'->>'asignada_at' IS NULL THEN RAISE EXCEPTION 'FALLÓ 9: asignar %', r; END IF;
    v_txt := v_txt || ' · asignar → ' || (r->'tarea'->>'estado') || ' + asignada_at';
    -- Lo completa un miembro del equipo (también es parte del caso 5).
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_miembro, 'role', 'authenticated')::text, true);
    r := public.agenda_cambiar_estado_tarea(v_t1, 'completada');
    IF r->'tarea'->>'estado' IS DISTINCT FROM 'completada' OR r->'tarea'->>'completada_at' IS NULL THEN RAISE EXCEPTION 'FALLÓ 9: completar %', r; END IF;
    v_txt := v_txt || ' · completar → ' || (r->'tarea'->>'estado');
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    r := public.agenda_reasignar_tarea(v_t1, v_subA2);
    IF r->>'motivo' IS DISTINCT FROM 'completada' THEN RAISE EXCEPTION 'FALLÓ 9: reasignó una completada %', r; END IF;
    v_txt := v_txt || ' · reasignar completada → ' || (r->>'motivo');
    r := public.agenda_editar_tarea(v_t1, v_subA2, v_carpA, v_prioA_normal, 'Placas PRUEBA', NULL, v_hoy, true, NULL, NULL);
    IF r->>'motivo' IS DISTINCT FROM 'completada' THEN RAISE EXCEPTION 'FALLÓ 9: editar cambiando sub a una completada %', r; END IF;
    r := public.agenda_editar_tarea(v_t1, v_subA1, NULL, v_prioA_alta, 'Placas nuevas PRUEBA', 'Cinco placas.', v_hoy + 1, false, '19:00', '20:30');
    IF r->'tarea'->>'estado' IS DISTINCT FROM 'completada' OR r->'tarea'->>'hora_desde' IS DISTINCT FROM '19:00' THEN
        RAISE EXCEPTION 'FALLÓ 9: editar una completada sin cambiar sub %', r;
    END IF;
    v_txt := v_txt || ' · editar sin cambiar sub → ' || (r->'tarea'->>'estado');
    RESET ROLE;
    SELECT completada_por::text INTO v_txt2 FROM public.agenda_tareas WHERE id = v_t1;
    IF v_txt2 IS DISTINCT FROM v_miembro::text THEN RAISE EXCEPTION 'FALLÓ 9: completada_por no es el miembro'; END IF;
    -- Volver a 'en proceso' limpia quién y cuándo.
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_miembro, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_cambiar_estado_tarea(v_t1, 'en_proceso');
    IF r->'tarea'->>'estado' IS DISTINCT FROM 'en_proceso' OR r->'tarea'->>'completada_at' IS NOT NULL THEN RAISE EXCEPTION 'FALLÓ 9: volver a en proceso %', r; END IF;
    r := public.agenda_cambiar_estado_tarea(v_t1, 'esperando');
    IF r->>'motivo' IS DISTINCT FROM 'estado_invalido' THEN RAISE EXCEPTION 'FALLÓ 9: estado a mano %', r; END IF;
    v_txt := v_txt || ' · volver → en_proceso (limpia) · "esperando" a mano → ' || (r->>'motivo');
    -- Editar sacándole el sub a una en proceso → esperando.
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    r := public.agenda_crear_tarea(v_t8, v_depA, v_subA1, NULL, NULL, 'Sin equipo PRUEBA', NULL, v_hoy, true, NULL, NULL);
    r := public.agenda_editar_tarea(v_t8, NULL, NULL, NULL, 'Sin equipo PRUEBA', NULL, v_hoy, true, NULL, NULL);
    IF r->'tarea'->>'estado' IS DISTINCT FROM 'esperando' OR r->'tarea'->>'asignada_at' IS NOT NULL THEN RAISE EXCEPTION 'FALLÓ 9: editar con sub NULL %', r; END IF;
    v_txt := v_txt || ' · editar con sub NULL → ' || (r->'tarea'->>'estado');
    -- Una 'esperando' no se completa: no la tiene nadie.
    r := public.agenda_cambiar_estado_tarea(v_t8, 'completada');
    IF r->>'motivo' IS DISTINCT FROM 'sin_sub' THEN RAISE EXCEPTION 'FALLÓ 9: completó una esperando %', r; END IF;
    v_txt := v_txt || ' · completar esperando → ' || (r->>'motivo');
    RESET ROLE;
    o := o || format(E'| 9 | Estados: crear sin sub, asignar, completar, reasignar/editar completada, editar sin cambiar sub, volver, sub NULL | esperando → en_proceso → completada; completada; sigue completada; esperando; sin_sub | %s | ✅ |\n', v_txt);

    -- ════════════════════════════════════════════════════════════════════════
    -- 5 · Un miembro: completa lo suyo y nada más
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_crear_tarea(v_t2, v_depA, v_subA2, NULL, v_prioA_normal, 'Edición de video PRUEBA', NULL, v_hoy, true, NULL, NULL);
    IF r->'tarea'->>'estado' IS DISTINCT FROM 'en_proceso' THEN RAISE EXCEPTION 'FALLÓ 5: crear con sub %', r; END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_miembro, 'role', 'authenticated')::text, true);
    v_txt := 'completar la suya → ok (caso 9)';
    r := public.agenda_cambiar_estado_tarea(v_t2, 'completada');
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 5: completó una de otro sub %', r; END IF;
    v_txt := v_txt || ' · otra de otro sub → ' || (r->>'motivo');
    r := public.agenda_editar_tarea(v_t1, v_subA1, NULL, NULL, 'Hackeada PRUEBA', NULL, v_hoy, true, NULL, NULL);
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 5: un miembro editó %', r; END IF;
    v_txt := v_txt || ' · editar → ' || (r->>'motivo');
    r := public.agenda_reasignar_tarea(v_t1, v_subA2);
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 5: un miembro reasignó %', r; END IF;
    v_txt := v_txt || ' · reasignar → ' || (r->>'motivo');
    r := public.agenda_eliminar_tarea(v_t1);
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 5: un miembro borró %', r; END IF;
    r := public.agenda_tarea(v_t2);
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 5: vio una tarea de otro sub %', r; END IF;
    r := public.agenda_tarea(v_t1);
    IF (r->>'ok')::boolean IS NOT TRUE OR (r->'tarea'->>'puede_editar')::boolean IS NOT FALSE
       OR (r->'tarea'->>'puede_cambiar_estado')::boolean IS NOT TRUE
       OR jsonb_array_length(r->'tarea'->'la_tienen') <> 2
       OR (r->'tarea'->'la_tienen'->0->>'dirige')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'FALLÓ 5: detalle de la suya %', r;
    END IF;
    v_txt := v_txt || ' · ver la suya → ok, la tienen 2 (quien dirige primero)';
    r := public.agenda_mis_tareas(v_hoy - 7, v_hoy + 7);
    SELECT count(*) INTO v_n FROM jsonb_array_elements(r->'tareas') x WHERE x->>'id' = v_t1::text;
    SELECT count(*) INTO v_m FROM jsonb_array_elements(r->'tareas') x WHERE x->>'id' IN (v_t2::text, v_t8::text, v_tB::text);
    IF v_n <> 1 OR v_m <> 0 THEN RAISE EXCEPTION 'FALLÓ 5: mis_tareas (la suya % / ajenas %)', v_n, v_m; END IF;
    -- El interruptor no le da nada a quien no es encargado.
    r := public.agenda_mis_tareas(v_hoy - 7, v_hoy + 7, true);
    SELECT count(*) INTO v_m FROM jsonb_array_elements(r->'tareas') x WHERE x->>'id' IN (v_t2::text, v_t8::text, v_tB::text);
    IF v_m <> 0 THEN RAISE EXCEPTION 'FALLÓ 5: el interruptor le mostró tareas ajenas a un miembro'; END IF;
    v_txt := v_txt || ' · mis_tareas → sólo la suya (también con el interruptor)';
    RESET ROLE;
    o := o || format(E'| 5 | Miembro: completar la suya, otra de otro sub, editar, reasignar, borrar, ver, mis_tareas | ok; sin_permiso ×5; sólo lo suyo | %s | ✅ |\n', v_txt);

    -- ════════════════════════════════════════════════════════════════════════
    -- 6 · Quien dirige: ve su panel, no administra
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_lider, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_subdepartamento(v_subA1);
    IF (r->>'ok')::boolean IS NOT TRUE OR jsonb_array_length(r->'miembros') <> 1
       OR r->'lider'->>'id' IS DISTINCT FROM v_lider::text
       OR jsonb_array_length(r->'encargados') <> 1
       OR r->'encargados'->0 ? 'email'
       OR (r->'contadores'->>'en_proceso')::int <> 1
       OR r->>'hoy' IS DISTINCT FROM v_hoy::text THEN
        RAISE EXCEPTION 'FALLÓ 6: su panel %', r;
    END IF;
    v_txt := format('panel → ok (1 miembro, encargados sin email, en_proceso %s, hoy %s)', r->'contadores'->>'en_proceso', r->>'hoy');
    r := public.agenda_tareas_subdepartamento(v_subA1, v_hoy - 7, v_hoy + 7);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 6: sus tareas %', r; END IF;
    r := public.agenda_subdepartamento(v_subA2);
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 6: vio el panel de otro sub %', r; END IF;
    v_txt := v_txt || ' · panel ajeno → ' || (r->>'motivo');
    r := public.agenda_crear_tarea(gen_random_uuid(), v_depA, v_subA1, NULL, NULL, 'Del líder PRUEBA', NULL, v_hoy, true, NULL, NULL);
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 6: quien dirige creó una tarea %', r; END IF;
    v_txt := v_txt || ' · crear → ' || (r->>'motivo');
    r := public.agenda_quitar_miembro(v_subA1, v_miembro);
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 6: quien dirige quitó un miembro %', r; END IF;
    v_txt := v_txt || ' · quitar miembro → ' || (r->>'motivo');
    r := public.agenda_agregar_miembros(v_subA1, ARRAY[v_comun]);
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 6: quien dirige agregó %', r; END IF;
    r := public.agenda_departamento(v_depA);
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 6: quien dirige vio el panel del departamento %', r; END IF;
    r := public.agenda_cambiar_estado_tarea(v_t1, 'completada');
    IF r->'tarea'->>'estado' IS DISTINCT FROM 'completada' THEN RAISE EXCEPTION 'FALLÓ 6: quien dirige no pudo completar %', r; END IF;
    v_txt := v_txt || ' · completar la del equipo → ok';
    RESET ROLE;
    o := o || format(E'| 6 | Quien dirige: su panel y sus tareas, panel ajeno, crear, quitar/agregar miembros, panel del depto, completar | ok; sin_permiso ×5; ok | %s | ✅ |\n', v_txt);

    -- ════════════════════════════════════════════════════════════════════════
    -- 2 · Un autenticado sin nada no ve nada
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_comun, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM public.agenda_tareas;
    SELECT v_n + count(*) INTO v_n FROM public.agenda_solicitudes;
    SELECT v_n + count(*) INTO v_n FROM public.agenda_subdepartamento_miembros;
    SELECT v_n + count(*) INTO v_n FROM public.agenda_departamento_encargados;
    SELECT v_n + count(*) INTO v_n FROM public.agenda_subdepartamentos;
    SELECT v_n + count(*) INTO v_n FROM public.agenda_carpetas;
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALLÓ 2: un común leyó % filas directo', v_n; END IF;
    -- Lo que sí puede leer: nombre/color/ícono de departamentos y prioridades.
    SELECT count(*) INTO v_m FROM public.agenda_departamentos WHERE id IN (v_depA, v_depB);
    IF v_m <> 2 THEN RAISE EXCEPTION 'FALLÓ 2: un común no lee los departamentos (%)', v_m; END IF;
    r := public.agenda_departamento(v_depA);
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 2: panel ajeno %', r; END IF;
    r2 := public.agenda_tarea(v_t1);
    IF r2->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 2: tarea ajena %', r2; END IF;
    r3 := public.agenda_buscar_usuarios('prueba.agenda');
    IF r3->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 2: buscó usuarios %', r3; END IF;
    v_txt := format('directo: %s filas (y %s departamentos visibles) · departamento %s · tarea %s · buscar %s',
                    v_n, v_m, r->>'motivo', r2->>'motivo', r3->>'motivo');
    r := public.agenda_mis_tareas(v_hoy - 7, v_hoy + 7, true);
    IF jsonb_array_length(r->'tareas') <> 0 THEN RAISE EXCEPTION 'FALLÓ 2: mis_tareas de un común %', r; END IF;
    r := public.agenda_mi_acceso();
    IF (r->>'super_admin')::boolean OR jsonb_array_length(r->'encargado') + jsonb_array_length(r->'dirijo') + jsonb_array_length(r->'miembro') <> 0 THEN
        RAISE EXCEPTION 'FALLÓ 2: mi_acceso de un común %', r;
    END IF;
    r := public.agenda_subdepartamento(v_subA1);
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 2: panel de sub %', r; END IF;
    r := public.agenda_cambiar_estado_tarea(v_t1, 'en_proceso');
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 2: cambió el estado de una ajena %', r; END IF;
    v_txt := v_txt || ' · mis_tareas 0 · mi_acceso vacío · panel de sub y cambiar estado sin_permiso';
    RESET ROLE;
    o := o || format(E'| 2 | Autenticado sin nada: SELECT directo a tareas/solicitudes/miembros/encargados/subs/carpetas; RPC ajenas | 0 filas; sin_permiso | %s | ✅ |\n', v_txt);

    -- ════════════════════════════════════════════════════════════════════════
    -- 8 · Buscar personas: encargado ve el email enmascarado, SUPER_ADMIN no
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_buscar_usuarios('lider prueba');   -- sin tilde: el nombre es "Líder PRUEBA"
    SELECT x->>'email' INTO v_txt FROM jsonb_array_elements(r->'usuarios') x WHERE x->>'id' = v_lider::text;
    IF v_txt IS DISTINCT FROM 'pr•••@test.local' THEN RAISE EXCEPTION 'FALLÓ 8: encargado ve "%" (%)', v_txt, r; END IF;
    r2 := public.agenda_buscar_usuarios('prueba.agenda');
    SELECT count(*) INTO v_n FROM jsonb_array_elements(r2->'usuarios') x WHERE x->>'email' NOT LIKE '%•••@%';
    IF v_n <> 0 OR jsonb_array_length(r2->'usuarios') < 8 THEN RAISE EXCEPTION 'FALLÓ 8: % emails sin enmascarar %', v_n, r2; END IF;
    r3 := public.agenda_buscar_usuarios(' a ');
    IF r3->>'motivo' IS DISTINCT FROM 'texto_corto' THEN RAISE EXCEPTION 'FALLÓ 8: texto corto %', r3; END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated')::text, true);
    r := public.agenda_buscar_usuarios('LIDER prueba');
    SELECT x->>'email' INTO v_txt2 FROM jsonb_array_elements(r->'usuarios') x WHERE x->>'id' = v_lider::text;
    IF v_txt2 IS DISTINCT FROM 'prueba.agenda.lider@test.local' THEN RAISE EXCEPTION 'FALLÓ 8: SUPER_ADMIN ve "%"', v_txt2; END IF;
    RESET ROLE;
    o := o || format(E'| 8 | buscar_usuarios("lider prueba", sin tilde): encargado / SUPER_ADMIN; texto de 1 letra | enmascarado / completo; texto_corto | "%s" / "%s" · %s | ✅ |\n', v_txt, v_txt2, r3->>'motivo');

    -- ════════════════════════════════════════════════════════════════════════
    -- 11 · Idempotencia
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_crear_tarea(v_t3, v_depA, v_subA1, NULL, NULL, 'Dos veces PRUEBA', NULL, v_hoy, true, NULL, NULL);
    r2 := public.agenda_crear_tarea(v_t3, v_depA, v_subA1, NULL, NULL, 'Dos veces PRUEBA', NULL, v_hoy, true, NULL, NULL);
    IF (r2->>'ok')::boolean IS NOT TRUE OR (r2->>'ya_existia')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 11: reintento de tarea %', r2; END IF;
    -- El mismo id desde otra persona no devuelve la tarea ajena.
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated')::text, true);
    r3 := public.agenda_crear_tarea(v_t3, v_depA, NULL, NULL, NULL, 'Robo PRUEBA', NULL, v_hoy, true, NULL, NULL);
    IF r3->>'motivo' IS DISTINCT FROM 'id_en_uso' THEN RAISE EXCEPTION 'FALLÓ 11: id ajeno %', r3; END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_solic, 'role', 'authenticated')::text, true);
    r := public.agenda_crear_solicitud(v_sol1, v_depA, v_prioA_alta, 'PRUEBA: una placa para el almuerzo del domingo.');
    r2 := public.agenda_crear_solicitud(v_sol1, v_depA, v_prioA_alta, 'PRUEBA: una placa para el almuerzo del domingo.');
    IF (r2->>'ya_existia')::boolean IS NOT TRUE OR r2->>'numero' IS DISTINCT FROM r->>'numero' THEN RAISE EXCEPTION 'FALLÓ 11: reintento de solicitud %', r2; END IF;
    RESET ROLE;
    SELECT count(*) INTO v_n FROM public.agenda_tareas WHERE id = v_t3;
    SELECT count(*) INTO v_m FROM public.agenda_solicitudes WHERE id = v_sol1;
    IF v_n <> 1 OR v_m <> 1 THEN RAISE EXCEPTION 'FALLÓ 11: filas tarea % solicitud %', v_n, v_m; END IF;
    o := o || format(E'| 11 | Idempotencia: crear_tarea y crear_solicitud dos veces con el mismo id; el id de otra persona | 1 fila cada una, ya_existia; id_en_uso | tarea %s fila · solicitud %s fila · ya_existia · %s | ✅ |\n', v_n, v_m, r3->>'motivo');

    -- ════════════════════════════════════════════════════════════════════════
    -- 12 · Solicitud → aceptar → tarea
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_txt := '';
    r := public.agenda_crear_tarea(gen_random_uuid(), v_depA, NULL, NULL, NULL, 'Desde nueva PRUEBA', NULL, v_hoy, true, NULL, NULL, v_sol1);
    IF r->>'motivo' IS DISTINCT FROM 'solicitud_no_aceptada' THEN RAISE EXCEPTION 'FALLÓ 12: asignó una nueva %', r; END IF;
    v_txt := v_txt || 'asignar nueva → ' || (r->>'motivo');
    r := public.agenda_solicitudes_departamento(v_depA);
    SELECT x INTO r2 FROM jsonb_array_elements(r->'solicitudes') x WHERE x->>'id' = v_sol1::text;
    IF r2->'solicitante'->>'nombre' IS DISTINCT FROM 'Solicitante PRUEBA' OR r2->'prioridad'->>'nombre' IS DISTINCT FROM 'Alta'
       OR r2->'solicitante' ? 'email' THEN
        RAISE EXCEPTION 'FALLÓ 12: la lista no trae quién/prioridad %', r2;
    END IF;
    r := public.agenda_revisar_solicitud(v_sol1, 'aceptar');
    IF r->>'estado' IS DISTINCT FROM 'aceptada' THEN RAISE EXCEPTION 'FALLÓ 12: aceptar %', r; END IF;
    v_txt := v_txt || ' · aceptar → ' || (r->>'estado');
    r := public.agenda_revisar_solicitud(v_sol1, 'aceptar');
    IF r->>'motivo' IS DISTINCT FROM 'ya_revisada' THEN RAISE EXCEPTION 'FALLÓ 12: aceptó dos veces %', r; END IF;
    v_txt := v_txt || ' · aceptar otra vez → ' || (r->>'motivo');
    r := public.agenda_crear_tarea(v_t6, v_depA, v_subA1, NULL, v_prioA_alta, 'Placa almuerzo PRUEBA', NULL, v_hoy + 2, true, NULL, NULL, v_sol1);
    IF (r->>'ok')::boolean IS NOT TRUE OR r->'tarea'->'solicitud'->>'id' IS DISTINCT FROM v_sol1::text
       OR r->'tarea'->'solicitud'->'solicitante'->>'nombre' IS DISTINCT FROM 'Solicitante PRUEBA' THEN
        RAISE EXCEPTION 'FALLÓ 12: tarea desde aceptada %', r;
    END IF;
    r := public.agenda_crear_tarea(gen_random_uuid(), v_depA, NULL, NULL, NULL, 'Otra vez PRUEBA', NULL, v_hoy, true, NULL, NULL, v_sol1);
    IF r->>'motivo' IS DISTINCT FROM 'solicitud_no_aceptada' THEN RAISE EXCEPTION 'FALLÓ 12: asignó dos veces %', r; END IF;
    RESET ROLE;
    SELECT estado INTO v_txt2 FROM public.agenda_solicitudes WHERE id = v_sol1 AND tarea_id = v_t6;
    IF v_txt2 IS DISTINCT FROM 'asignada' THEN RAISE EXCEPTION 'FALLÓ 12: la solicitud quedó %', v_txt2; END IF;
    v_txt := v_txt || ' · crear tarea → solicitud ' || v_txt2 || ' con tarea_id · asignar de nuevo → solicitud_no_aceptada';
    -- Rechazar, y una solicitud de B no sirve para una tarea de A.
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_solic, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_crear_solicitud(v_sol2, v_depA, v_prioA_normal, 'PRUEBA: un video corto para el grupo nuevo.');
    r := public.agenda_crear_solicitud(v_solB, v_depB, v_prioB, 'PRUEBA: un micrófono extra para el coro.');
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    r := public.agenda_revisar_solicitud(v_sol2, 'rechazar');
    IF r->>'estado' IS DISTINCT FROM 'rechazada' THEN RAISE EXCEPTION 'FALLÓ 12: rechazar %', r; END IF;
    r := public.agenda_revisar_solicitud(v_solB, 'aceptar');
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 12: aceptó una de B %', r; END IF;
    r := public.agenda_crear_tarea(gen_random_uuid(), v_depA, NULL, NULL, NULL, 'Cruzada PRUEBA', NULL, v_hoy, true, NULL, NULL, v_solB);
    IF r->>'motivo' IS DISTINCT FROM 'solicitud_ajena' THEN RAISE EXCEPTION 'FALLÓ 12: solicitud de B en A %', r; END IF;
    -- Borrar la tarea devuelve la solicitud a 'aceptada'.
    r := public.agenda_eliminar_tarea(v_t6);
    RESET ROLE;
    SELECT estado INTO v_txt2 FROM public.agenda_solicitudes WHERE id = v_sol1 AND tarea_id IS NULL;
    IF v_txt2 IS DISTINCT FROM 'aceptada' THEN RAISE EXCEPTION 'FALLÓ 12: borrar la tarea dejó la solicitud %', v_txt2; END IF;
    v_txt := v_txt || ' · rechazar → rechazada · aceptar una de B → sin_permiso · solicitud de B en A → solicitud_ajena · borrar la tarea → solicitud ' || v_txt2;
    o := o || format(E'| 12 | Solicitud: asignar nueva, aceptar, aceptar dos veces, crear tarea, asignar dos veces, rechazar, cruzar departamentos, borrar la tarea | solicitud_no_aceptada · aceptada · ya_revisada · asignada · solicitud_no_aceptada · rechazada · sin_permiso · solicitud_ajena · aceptada | %s | ✅ |\n', v_txt);

    -- ════════════════════════════════════════════════════════════════════════
    -- 13 · Tope de 10 solicitudes por persona por día
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_solic, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_crear_solicitud(gen_random_uuid(), v_depA, NULL, 'PRUEBA: sin prioridad en un depto que tiene.');
    IF r->>'motivo' IS DISTINCT FROM 'prioridad_requerida' THEN RAISE EXCEPTION 'FALLÓ 13: prioridad requerida %', r; END IF;
    r := public.agenda_crear_solicitud(gen_random_uuid(), v_depA, v_prioB, 'PRUEBA: prioridad de otro departamento.');
    IF r->>'motivo' IS DISTINCT FROM 'prioridad_ajena' THEN RAISE EXCEPTION 'FALLÓ 13: prioridad ajena %', r; END IF;
    r := public.agenda_crear_solicitud(gen_random_uuid(), v_depA, v_prioA_normal, '   corto   ');
    IF r->>'motivo' IS DISTINCT FROM 'detalles_cortos' THEN RAISE EXCEPTION 'FALLÓ 13: detalles cortos %', r; END IF;
    -- Ya mandó 3 (sol1, sol2, solB). Siete más llegan a 10.
    FOR v_n IN 4..10 LOOP
        r := public.agenda_crear_solicitud(gen_random_uuid(), v_depA, v_prioA_normal, 'PRUEBA: solicitud número ' || v_n || ' del día.');
        IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 13: la %ª falló %', v_n, r; END IF;
    END LOOP;
    IF (r->>'restantes')::int <> 0 THEN RAISE EXCEPTION 'FALLÓ 13: la décima dice restantes %', r->>'restantes'; END IF;
    r := public.agenda_crear_solicitud(gen_random_uuid(), v_depA, v_prioA_normal, 'PRUEBA: la undécima del día.');
    IF r->>'motivo' IS DISTINCT FROM 'limite_diario' OR (r->>'limite')::int <> 10 THEN RAISE EXCEPTION 'FALLÓ 13: la 11ª %', r; END IF;
    -- Reenviar la primera no cuenta como nueva.
    r2 := public.agenda_crear_solicitud(v_sol1, v_depA, v_prioA_alta, 'PRUEBA: una placa para el almuerzo del domingo.');
    IF (r2->>'ya_existia')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 13: el reintento chocó con el tope %', r2; END IF;
    RESET ROLE;
    SELECT count(*) INTO v_n FROM public.agenda_solicitudes WHERE solicitante_id = v_solic;
    IF v_n <> 10 THEN RAISE EXCEPTION 'FALLÓ 13: quedaron % solicitudes', v_n; END IF;
    o := o || format(E'| 13 | Tope diario: sin prioridad, prioridad ajena, detalles cortos; la 11ª; reintentar una ya mandada | prioridad_requerida · prioridad_ajena · detalles_cortos · limite_diario (10) · ya_existia | prioridad_requerida · prioridad_ajena · detalles_cortos · %s (%s) · ya_existia · %s guardadas | ✅ |\n', r->>'motivo', r->>'limite', v_n);

    -- ════════════════════════════════════════════════════════════════════════
    -- 16 · Borrar una prioridad en uso
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_crear_tarea(v_t7, v_depA, v_subA1, NULL, v_prioA_baja, 'Prioridad baja PRUEBA', NULL, v_hoy, true, NULL, NULL);
    r := public.agenda_eliminar_prioridad(v_prioA_baja);
    IF r->>'motivo' IS DISTINCT FROM 'en_uso' OR (r->>'cantidad')::int <> 1 THEN RAISE EXCEPTION 'FALLÓ 16: en uso %', r; END IF;
    r2 := public.agenda_eliminar_prioridad(v_prioA_baja, v_prioB);
    IF r2->>'motivo' IS DISTINCT FROM 'prioridad_ajena' THEN RAISE EXCEPTION 'FALLÓ 16: reemplazo de otro depto %', r2; END IF;
    r3 := public.agenda_eliminar_prioridad(v_prioA_baja, v_prioA_normal);
    IF (r3->>'ok')::boolean IS NOT TRUE OR (r3->>'tareas_movidas')::int <> 1 THEN RAISE EXCEPTION 'FALLÓ 16: con reemplazo %', r3; END IF;
    RESET ROLE;
    SELECT prioridad_id::text INTO v_txt FROM public.agenda_tareas WHERE id = v_t7;
    IF v_txt IS DISTINCT FROM v_prioA_normal::text OR EXISTS (SELECT 1 FROM public.agenda_prioridades WHERE id = v_prioA_baja) THEN
        RAISE EXCEPTION 'FALLÓ 16: la tarea no se movió o la prioridad sigue';
    END IF;
    -- La solicitud que pidió "Alta" sigue diciéndolo aunque se borre "Alta".
    o := o || format(E'| 16 | Borrar prioridad en uso: sin reemplazo, con reemplazo de otro depto, con reemplazo propio | en_uso (1) · prioridad_ajena · ok, tarea movida | %s (%s) · %s · ok, %s movida | ✅ |\n',
                     r->>'motivo', r->>'cantidad', r2->>'motivo', r3->>'tareas_movidas');

    -- ════════════════════════════════════════════════════════════════════════
    -- 18 · Ordenar prioridades
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_ordenar_prioridades(v_depA, ARRAY[v_prioA_urg, v_prioA_alta]);
    IF r->>'motivo' IS DISTINCT FROM 'lista_incompleta' THEN RAISE EXCEPTION 'FALLÓ 18: faltante %', r; END IF;
    r2 := public.agenda_ordenar_prioridades(v_depA, ARRAY[v_prioA_urg, v_prioA_alta, v_prioB]);
    IF r2->>'motivo' IS DISTINCT FROM 'lista_incompleta' THEN RAISE EXCEPTION 'FALLÓ 18: ajena %', r2; END IF;
    r3 := public.agenda_ordenar_prioridades(v_depA, ARRAY[v_prioA_urg, v_prioA_alta, v_prioA_normal]);
    IF (r3->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 18: completa %', r3; END IF;
    r := public.agenda_departamento(v_depA);
    IF r->'prioridades'->0->>'nombre' IS DISTINCT FROM 'Urgente' OR r->'prioridades'->2->>'nombre' IS DISTINCT FROM 'Normal'
       OR (r->'prioridades'->2->>'cant_tareas')::int < 1 THEN
        RAISE EXCEPTION 'FALLÓ 18: el orden no quedó %', r->'prioridades';
    END IF;
    -- Una nueva va al final.
    r2 := public.agenda_guardar_prioridad(gen_random_uuid(), v_depA, 'Para el domingo', '#b45309');
    IF (r2->'prioridad'->>'orden')::int <> 3 THEN RAISE EXCEPTION 'FALLÓ 18: la nueva no va al final %', r2; END IF;
    RESET ROLE;
    o := o || format(E'| 18 | Ordenar prioridades: con una de menos, con una ajena, completa; una nueva | lista_incompleta ×2 · ok (Urgente primero) · orden 3 | lista_incompleta · lista_incompleta · ok, primera %s · orden %s | ✅ |\n',
                     r->'prioridades'->0->>'nombre', r2->'prioridad'->>'orden');

    -- ════════════════════════════════════════════════════════════════════════
    -- 14 · Cambiar quién dirige
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_cambiar_lider(v_subA1, v_miembro);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 14: %', r; END IF;
    RESET ROLE;
    SELECT lider_id::text INTO v_txt FROM public.agenda_subdepartamentos WHERE id = v_subA1;
    SELECT count(*) INTO v_n FROM public.agenda_subdepartamento_miembros WHERE subdepartamento_id = v_subA1 AND user_id = v_lider;
    SELECT count(*) INTO v_m FROM public.agenda_subdepartamento_miembros WHERE subdepartamento_id = v_subA1 AND user_id = v_miembro;
    IF v_txt IS DISTINCT FROM v_miembro::text OR v_n <> 1 OR v_m <> 0 THEN
        RAISE EXCEPTION 'FALLÓ 14: líder %, anterior como miembro %, nuevo duplicado %', v_txt, v_n, v_m;
    END IF;
    -- El anterior sigue viendo la tarea del equipo.
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_lider, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_tarea(v_t1);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 14: el anterior perdió sus tareas %', r; END IF;
    RESET ROLE;
    o := o || format(E'| 14 | cambiar_lider: el anterior queda como miembro y sigue viendo las tareas; el nuevo no queda duplicado | anterior 1 fila · nuevo 0 filas en miembros | anterior %s fila · nuevo %s filas · ve la tarea | ✅ |\n', v_n, v_m);

    -- ════════════════════════════════════════════════════════════════════════
    -- 19 · Agregar, quitar y mover miembros
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_agregar_miembros(v_subA3, ARRAY[v_miembro2, v_miembro2, v_encA]);   -- v_encA dirige A3
    IF (r->>'agregados')::int <> 1 THEN RAISE EXCEPTION 'FALLÓ 19: agregar %', r; END IF;
    r2 := public.agenda_quitar_miembro(v_subA3, v_encA);
    IF r2->>'motivo' IS DISTINCT FROM 'es_quien_dirige' THEN RAISE EXCEPTION 'FALLÓ 19: quitar a quien dirige %', r2; END IF;
    r3 := public.agenda_mover_miembro(v_subA1, v_subB1, v_lider);
    IF r3->>'motivo' IS DISTINCT FROM 'sub_ajeno' THEN RAISE EXCEPTION 'FALLÓ 19: mover a otro depto %', r3; END IF;
    r := public.agenda_mover_miembro(v_subA1, v_subA3, v_lider);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 19: mover %', r; END IF;
    r := public.agenda_quitar_miembro(v_subA1, v_lider);
    IF r->>'motivo' IS DISTINCT FROM 'no_es_miembro' THEN RAISE EXCEPTION 'FALLÓ 19: quitar a quien ya no está %', r; END IF;
    RESET ROLE;
    SELECT count(*) INTO v_n FROM public.agenda_subdepartamento_miembros WHERE subdepartamento_id = v_subA3 AND user_id = v_lider;
    IF v_n <> 1 THEN RAISE EXCEPTION 'FALLÓ 19: no llegó al destino'; END IF;
    o := o || format(E'| 19 | Miembros: agregar (repetido + quien dirige), quitar a quien dirige, mover a otro depto, mover, quitar al que se fue | 1 agregado · es_quien_dirige · sub_ajeno · ok · no_es_miembro | %s agregado · %s · %s · ok · no_es_miembro | ✅ |\n',
                     '1', r2->>'motivo', r3->>'motivo');

    -- ════════════════════════════════════════════════════════════════════════
    -- 10 · Archivar un sub-departamento (sql/agenda_archivar_subdepartamentos.sql)
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_crear_tarea(v_t4, v_depA, v_subA2, NULL, NULL, 'Queda esperando PRUEBA', NULL, v_hoy, true, NULL, NULL);
    r := public.agenda_crear_tarea(v_t5, v_depA, v_subA2, NULL, NULL, 'Ya hecha PRUEBA', NULL, v_hoy, true, NULL, NULL);
    r := public.agenda_cambiar_estado_tarea(v_t5, 'completada');
    r := public.agenda_archivar_subdepartamento(v_subA2);
    IF (r->>'ok')::boolean IS NOT TRUE OR (r->>'tareas_a_esperando')::int <> 2 OR (r->>'completadas_conservadas')::int <> 1 THEN
        RAISE EXCEPTION 'FALLÓ 10: %', r;
    END IF;
    RESET ROLE;
    SELECT count(*) INTO v_n FROM public.agenda_tareas
     WHERE id IN (v_t2, v_t4) AND estado = 'esperando' AND subdepartamento_id IS NULL AND asignada_at IS NULL;
    IF v_n <> 2
       OR NOT EXISTS (SELECT 1 FROM public.agenda_tareas WHERE id = v_t5 AND estado = 'completada' AND subdepartamento_id = v_subA2)
       OR NOT EXISTS (SELECT 1 FROM public.agenda_subdepartamento_miembros WHERE subdepartamento_id = v_subA2 AND user_id = v_miembro2)
       OR NOT EXISTS (SELECT 1 FROM public.agenda_subdepartamentos WHERE id = v_subA2 AND archivado_at IS NOT NULL AND archivado_por = v_encA) THEN
        RAISE EXCEPTION 'FALLÓ 10: % en esperando, o la completada / los miembros / la marca no quedaron', v_n;
    END IF;
    -- La completada sigue en la Agenda de quien estaba en el equipo, marcada.
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_miembro2, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r2 := public.agenda_mis_tareas(v_hoy - 7, v_hoy + 7);
    SELECT x INTO r3 FROM jsonb_array_elements(r2->'tareas') x WHERE x->>'id' = v_t5::text;
    IF r3 IS NULL OR (r3->'subdepartamento'->>'archivado')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'FALLÓ 10: la completada no se ve en mis_tareas, o sin la marca: %', r3;
    END IF;
    r3 := public.agenda_tarea(v_t5);
    IF (r3->>'ok')::boolean IS NOT TRUE OR (r3->'tarea'->>'puede_cambiar_estado')::boolean IS NOT FALSE THEN
        RAISE EXCEPTION 'FALLÓ 10: detalle de la completada archivada %', r3;
    END IF;
    RESET ROLE;
    o := o || format(E'| 10 | Archivar un sub con 2 tareas en proceso y 1 completada | 2 → esperando sin sub; la completada queda con su sub y se ve en mis_tareas con archivado=true; los miembros quedan | %s → esperando · %s conservada · en mis_tareas con archivado=true · detalle sin "cambiar estado" | ✅ |\n',
                     r->>'tareas_a_esperando', r->>'completadas_conservadas');

    -- ════════════════════════════════════════════════════════════════════════
    -- 10b · El nombre de un archivado se puede volver a usar
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_guardar_subdepartamento(gen_random_uuid(), v_depA, 'video prueba', '#2563eb', v_encA, '{}');
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 10b: nombre de un archivado %', r; END IF;
    r2 := public.agenda_guardar_subdepartamento(gen_random_uuid(), v_depA, 'VIDEO PRUEBA', '#2563eb', v_encA, '{}');
    IF r2->>'motivo' IS DISTINCT FROM 'nombre_duplicado' THEN RAISE EXCEPTION 'FALLÓ 10b: dos activos con el mismo nombre %', r2; END IF;
    RESET ROLE;
    o := o || format(E'| 10b | Crear "video prueba" con "Video PRUEBA" archivado; y otro igual con el nuevo activo | ok · nombre_duplicado | %s · %s | ✅ |\n',
                     CASE WHEN (r->>'ok')::boolean THEN 'ok' END, r2->>'motivo');

    -- ════════════════════════════════════════════════════════════════════════
    -- 10c · Con un sub archivado, todo lo que lo usa → 'archivado'
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_bloq := 0;
    v_txt := '';
    FOR r IN SELECT x FROM (VALUES
        (public.agenda_agregar_miembros(v_subA2, ARRAY[v_comun])),
        (public.agenda_quitar_miembro(v_subA2, v_miembro2)),
        (public.agenda_cambiar_lider(v_subA2, v_miembro2)),
        (public.agenda_guardar_subdepartamento(v_subA2, v_depA, 'Video renombrado PRUEBA', '#2563eb', NULL, '{}')),
        (public.agenda_mover_miembro(v_subA2, v_subA3, v_miembro2)),
        (public.agenda_mover_miembro(v_subA3, v_subA2, v_lider)),
        (public.agenda_crear_tarea(gen_random_uuid(), v_depA, v_subA2, NULL, NULL, 'A un archivado PRUEBA', NULL, v_hoy, true, NULL, NULL)),
        (public.agenda_editar_tarea(v_t8, v_subA2, NULL, NULL, 'Sin equipo PRUEBA', NULL, v_hoy, true, NULL, NULL)),
        (public.agenda_reasignar_tarea(v_t2, v_subA2)),
        (public.agenda_subdepartamento(v_subA2)),
        (public.agenda_tareas_subdepartamento(v_subA2, v_hoy - 7, v_hoy + 7)),
        (public.agenda_cambiar_estado_tarea(v_t5, 'en_proceso')),
        (public.agenda_archivar_subdepartamento(v_subA2))
    ) AS t(x) LOOP
        v_bloq := v_bloq + 1;
        IF r->>'motivo' IS DISTINCT FROM 'archivado' THEN
            RAISE EXCEPTION 'FALLÓ 10c: la llamada % no dijo archivado: %', v_bloq, r;
        END IF;
    END LOOP;
    -- Editar una completada de un sub archivado SIN cambiarle el sub sí se puede.
    r := public.agenda_editar_tarea(v_t5, v_subA2, NULL, NULL, 'Ya hecha (corregida) PRUEBA', NULL, v_hoy, true, NULL, NULL);
    IF r->'tarea'->>'estado' IS DISTINCT FROM 'completada' THEN RAISE EXCEPTION 'FALLÓ 10c: editar la completada del archivado %', r; END IF;
    -- No aparece en el panel del departamento.
    r2 := public.agenda_departamento(v_depA);
    SELECT count(*) INTO v_n FROM jsonb_array_elements(r2->'subdepartamentos') x WHERE x->>'id' = v_subA2::text;
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALLÓ 10c: el archivado aparece en agenda_departamento'; END IF;
    -- Ni en el acceso de quien era miembro.
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_miembro2, 'role', 'authenticated')::text, true);
    r3 := public.agenda_mi_acceso();
    SELECT count(*) INTO v_m FROM jsonb_array_elements(r3->'miembro') x WHERE x->>'id' = v_subA2::text;
    IF v_m <> 0 THEN RAISE EXCEPTION 'FALLÓ 10c: el archivado aparece en mi_acceso %', r3; END IF;
    -- Ni en los conteos de Sistemas.
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated')::text, true);
    r3 := public.agenda_departamentos_admin();
    SELECT x INTO r FROM jsonb_array_elements(r3->'departamentos') x WHERE x->>'id' = v_depA::text;
    RESET ROLE;
    SELECT count(*) INTO v_n FROM public.agenda_subdepartamentos WHERE departamento_id = v_depA AND archivado_at IS NULL;
    IF (r->>'cant_subdepartamentos')::int <> v_n THEN
        RAISE EXCEPTION 'FALLÓ 10c: Sistemas cuenta % subs, activos hay %', r->>'cant_subdepartamentos', v_n;
    END IF;
    o := o || format(E'| 10c | Sub archivado en agregar/quitar miembros, cambiar líder, guardar, mover (origen y destino), crear/editar/reasignar tarea, su panel y sus tareas, reabrir su completada, archivar de nuevo | archivado ×13; editar la completada sin cambiar sub → ok; fuera de agenda_departamento, mi_acceso y los conteos de Sistemas | archivado ×%s · editar ok · fuera de los tres (Sistemas cuenta %s activos) | ✅ |\n',
                     v_bloq, v_n);

    -- ════════════════════════════════════════════════════════════════════════
    -- 10d · Archivar: sólo encargados
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_miembro, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_archivar_subdepartamento(v_subA1);      -- v_miembro dirige A1 desde el caso 14
    IF r->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 10d: quien dirige archivó %', r; END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_lider, 'role', 'authenticated')::text, true);
    r2 := public.agenda_archivar_subdepartamento(v_subA3);     -- v_lider es miembro de A3 desde el caso 19
    IF r2->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 10d: un miembro archivó %', r2; END IF;
    BEGIN
        r3 := public.agenda_eliminar_subdepartamento(v_subA3);
        RAISE EXCEPTION 'FALLÓ 10d: authenticated todavía puede llamar a eliminar_subdepartamento';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    RESET ROLE;
    o := o || format(E'| 10d | Archivar como quien dirige y como miembro; eliminar_subdepartamento como authenticated | sin_permiso ×2; error de permiso | %s · %s · error de permiso | ✅ |\n',
                     r->>'motivo', r2->>'motivo');

    -- ════════════════════════════════════════════════════════════════════════
    -- 10e · anon no ejecuta la RPC nueva
    -- ════════════════════════════════════════════════════════════════════════
    IF has_function_privilege('anon', 'public.agenda_archivar_subdepartamento(uuid)', 'EXECUTE')
       OR NOT has_function_privilege('authenticated', 'public.agenda_archivar_subdepartamento(uuid)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.agenda_eliminar_subdepartamento(uuid)', 'EXECUTE') THEN
        RAISE EXCEPTION 'FALLÓ 10e: permisos de archivar / eliminar';
    END IF;
    BEGIN
        SET LOCAL ROLE anon;
        PERFORM public.agenda_archivar_subdepartamento(v_subA3);
        RESET ROLE;
        RAISE EXCEPTION 'FALLÓ 10e: anon llamó a archivar';
    EXCEPTION WHEN insufficient_privilege THEN
        RESET ROLE;
    END;
    o := o || E'| 10e | has_function_privilege de archivar (anon / authenticated) y de eliminar (authenticated); anon la llama | no / sí / no; error de permiso | no / sí / no · error de permiso | ✅ |\n';

    -- ════════════════════════════════════════════════════════════════════════
    -- 15 · Encargados: nunca cero
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_cambiar_encargados(v_depA, '{}');
    IF r->>'motivo' IS DISTINCT FROM 'sin_encargados' THEN RAISE EXCEPTION 'FALLÓ 15: vacío %', r; END IF;
    v_txt := r->>'motivo';
    r2 := public.agenda_cambiar_encargados(v_depA, ARRAY[NULL]::uuid[]);
    IF r2->>'motivo' IS DISTINCT FROM 'sin_encargados' THEN RAISE EXCEPTION 'FALLÓ 15: sólo NULL %', r2; END IF;
    r3 := public.agenda_cambiar_encargados(v_depB, ARRAY[v_encA]);
    IF r3->>'motivo' IS DISTINCT FROM 'sin_permiso' THEN RAISE EXCEPTION 'FALLÓ 15: se metió en B %', r3; END IF;
    r := public.agenda_cambiar_encargados(v_depA, ARRAY[v_encA, v_encB]);
    IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLÓ 15: cambiar %', r; END IF;
    RESET ROLE;
    SELECT count(*) INTO v_n FROM public.agenda_departamento_encargados WHERE departamento_id = v_depA;
    IF v_n <> 2 THEN RAISE EXCEPTION 'FALLÓ 15: quedaron % encargados', v_n; END IF;
    o := o || format(E'| 15 | cambiar_encargados: [], [NULL], en otro depto, dos personas | sin_encargados ×2 · sin_permiso · 2 encargados | %s · %s · %s · %s encargados | ✅ |\n',
                     v_txt, r2->>'motivo', r3->>'motivo', v_n);

    -- ════════════════════════════════════════════════════════════════════════
    -- 20 · mi_acceso de cada uno
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_miembro, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_mi_acceso();   -- ahora dirige A1
    IF jsonb_array_length(r->'dirijo') <> 1 OR jsonb_array_length(r->'miembro') <> 1
       OR (r->'miembro'->0->>'dirige')::boolean IS NOT TRUE OR jsonb_array_length(r->'encargado') <> 0 THEN
        RAISE EXCEPTION 'FALLÓ 20: miembro que pasó a dirigir %', r;
    END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    r2 := public.agenda_mi_acceso();
    SELECT x INTO r3 FROM jsonb_array_elements(r2->'encargado') x WHERE x->>'id' = v_depA::text;
    IF r3 IS NULL OR (r3->>'esperando')::int < 2 OR (r3->>'solicitudes_nuevas')::int < 1 THEN
        RAISE EXCEPTION 'FALLÓ 20: encargada %', r2;
    END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated')::text, true);
    r := public.agenda_mi_acceso();
    SELECT count(*) INTO v_n FROM jsonb_array_elements(r->'encargado') x WHERE x->>'id' IN (v_depA::text, v_depB::text);
    IF (r->>'super_admin')::boolean IS NOT TRUE OR v_n <> 2 THEN RAISE EXCEPTION 'FALLÓ 20: super %', r; END IF;
    -- SUPER_ADMIN, con el interruptor, ve también lo de B.
    r := public.agenda_mis_tareas(v_hoy - 7, v_hoy + 7, true);
    SELECT count(*) INTO v_m FROM jsonb_array_elements(r->'tareas') x WHERE x->>'id' = v_tB::text;
    r2 := public.agenda_mis_tareas(v_hoy - 7, v_hoy + 7, false);
    SELECT count(*) INTO v_bloq FROM jsonb_array_elements(r2->'tareas') x WHERE x->>'id' = v_tB::text;
    IF v_m <> 1 OR v_bloq <> 0 THEN RAISE EXCEPTION 'FALLÓ 20: interruptor de SUPER_ADMIN (con %, sin %)', v_m, v_bloq; END IF;
    RESET ROLE;
    o := o || format(E'| 20 | mi_acceso y el interruptor de la Agenda | miembro que dirige: dirijo 1, miembro 1; encargada: esperando y solicitudes; super: los 2 deptos; super con/sin interruptor | ok · esperando %s, solicitudes nuevas %s · %s deptos · tarea de B con %s / sin %s | ✅ |\n',
                     r3->>'esperando', r3->>'solicitudes_nuevas', v_n, v_m, v_bloq);

    -- ════════════════════════════════════════════════════════════════════════
    -- 21 · Rangos de fechas
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_encA, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_mis_tareas(v_hoy, v_hoy + 101);
    IF r->>'motivo' IS DISTINCT FROM 'rango_grande' THEN RAISE EXCEPTION 'FALLÓ 21: 101 días %', r; END IF;
    r2 := public.agenda_tareas_departamento(v_depA, v_hoy, v_hoy + 401);
    IF r2->>'motivo' IS DISTINCT FROM 'rango_grande' THEN RAISE EXCEPTION 'FALLÓ 21: 401 días %', r2; END IF;
    r3 := public.agenda_tareas_departamento(v_depA, v_hoy, v_hoy - 1);
    IF r3->>'motivo' IS DISTINCT FROM 'rango_invalido' THEN RAISE EXCEPTION 'FALLÓ 21: al revés %', r3; END IF;
    r := public.agenda_tareas_departamento(v_depA, v_hoy - 30, v_hoy + 30);
    IF (r->>'ok')::boolean IS NOT TRUE OR jsonb_array_length(r->'tareas') < 5 THEN RAISE EXCEPTION 'FALLÓ 21: rango válido %', r; END IF;
    RESET ROLE;
    o := o || format(E'| 21 | Rangos: Agenda 101 días, departamento 401 días, al revés, uno válido | rango_grande ×2 · rango_invalido · ok | rango_grande · %s · %s · ok (%s tareas) | ✅ |\n',
                     r2->>'motivo', r3->>'motivo', jsonb_array_length(r->'tareas'));

    -- ════════════════════════════════════════════════════════════════════════
    -- 22 · Borrar un departamento con una completada adentro
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.agenda_eliminar_departamento(v_depB);
    IF (r->>'ok')::boolean IS NOT TRUE OR (r->'borrados'->>'tareas')::int <> 2 OR (r->'borrados'->>'solicitudes')::int <> 1 THEN
        RAISE EXCEPTION 'FALLÓ 22: %', r;
    END IF;
    RESET ROLE;
    SELECT (SELECT count(*) FROM public.agenda_tareas WHERE departamento_id = v_depB)
         + (SELECT count(*) FROM public.agenda_subdepartamentos WHERE departamento_id = v_depB)
         + (SELECT count(*) FROM public.agenda_prioridades WHERE departamento_id = v_depB)
         + (SELECT count(*) FROM public.agenda_solicitudes WHERE departamento_id = v_depB)
         + (SELECT count(*) FROM public.agenda_departamento_encargados WHERE departamento_id = v_depB)
      INTO v_n;
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALLÓ 22: quedaron % filas de B', v_n; END IF;
    o := o || format(E'| 22 | Eliminar un departamento con una tarea completada | ok, conteos, 0 filas colgadas | ok · %s · %s filas de B | ✅ |\n', r->'borrados', v_n);

    -- ════════════════════════════════════════════════════════════════════════
    -- 7 · Ninguna escritura directa, ni siquiera de SUPER_ADMIN
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_bloq := 0;
    FOREACH v_tabla IN ARRAY v_tablas LOOP
        BEGIN
            EXECUTE format('INSERT INTO public.%I DEFAULT VALUES', v_tabla);
            RAISE EXCEPTION 'FALLÓ 7: INSERT directo en %', v_tabla;
        EXCEPTION WHEN insufficient_privilege THEN v_bloq := v_bloq + 1;
        END;
        BEGIN
            EXECUTE format('UPDATE public.%I SET created_at = created_at', v_tabla);
            RAISE EXCEPTION 'FALLÓ 7: UPDATE directo en %', v_tabla;
        EXCEPTION WHEN insufficient_privilege THEN v_bloq := v_bloq + 1;
        END;
        BEGIN
            EXECUTE format('DELETE FROM public.%I', v_tabla);
            RAISE EXCEPTION 'FALLÓ 7: DELETE directo en %', v_tabla;
        EXCEPTION WHEN insufficient_privilege THEN v_bloq := v_bloq + 1;
        END;
        BEGIN
            EXECUTE format('TRUNCATE public.%I CASCADE', v_tabla);
            RAISE EXCEPTION 'FALLÓ 7: TRUNCATE directo en %', v_tabla;
        EXCEPTION WHEN insufficient_privilege THEN v_bloq := v_bloq + 1;
        END;
    END LOOP;
    RESET ROLE;
    IF v_bloq <> 32 THEN RAISE EXCEPTION 'FALLÓ 7: % de 32 bloqueadas', v_bloq; END IF;
    o := o || format(E'| 7 | INSERT/UPDATE/DELETE/TRUNCATE directo como authenticated (SUPER_ADMIN) en las 8 tablas | 32 errores de permiso | %s de 32 | ✅ |\n', v_bloq);

    -- ════════════════════════════════════════════════════════════════════════
    -- 1 · anon: nada
    -- ════════════════════════════════════════════════════════════════════════
    PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    SET LOCAL ROLE anon;
    v_bloq := 0;
    FOREACH v_tabla IN ARRAY v_tablas LOOP
        BEGIN
            EXECUTE format('SELECT count(*) FROM public.%I', v_tabla) INTO v_n;
            RAISE EXCEPTION 'FALLÓ 1: anon leyó % (% filas)', v_tabla, v_n;
        EXCEPTION WHEN insufficient_privilege THEN v_bloq := v_bloq + 1;
        END;
    END LOOP;
    BEGIN
        PERFORM public.agenda_mi_acceso();
        RAISE EXCEPTION 'FALLÓ 1: anon llamó a agenda_mi_acceso';
    EXCEPTION WHEN insufficient_privilege THEN v_bloq := v_bloq + 1;
    END;
    BEGIN
        PERFORM public.agenda_departamentos_para_solicitar();
        RAISE EXCEPTION 'FALLÓ 1: anon llamó a agenda_departamentos_para_solicitar';
    EXCEPTION WHEN insufficient_privilege THEN v_bloq := v_bloq + 1;
    END;
    RESET ROLE;
    SELECT count(*) INTO v_n FROM pg_proc
     WHERE pronamespace = 'public'::regnamespace AND proname LIKE 'agenda\_%'
       AND has_function_privilege('anon', oid, 'EXECUTE');
    SELECT count(*) INTO v_m FROM pg_proc
     WHERE pronamespace = 'public'::regnamespace AND proname LIKE 'agenda\_%';
    IF v_bloq <> 10 OR v_n <> 0 THEN RAISE EXCEPTION 'FALLÓ 1: anon bloqueado % de 10, funciones ejecutables por anon %', v_bloq, v_n; END IF;
    o := o || format(E'| 1 | anon: SELECT a las 8 tablas, 2 RPC, y has_function_privilege de todas las agenda_* | error de permiso; 0 funciones ejecutables | %s de 10 bloqueados · %s de %s funciones ejecutables | ✅ |\n', v_bloq, v_n, v_m);

    -- ════════════════════════════════════════════════════════════════════════
    -- 23 · Los helpers no se llaman desde afuera; el CHECK de completada
    -- ════════════════════════════════════════════════════════════════════════
    -- La lista explícita de RPC (no un conteo): si se agrega una, el error dice
    -- cuál sobra o cuál falta. agenda_mis_solicitudes es de
    -- sql/agenda_mis_solicitudes.sql.
    SELECT string_agg(proname, ', ' ORDER BY proname) FILTER (WHERE NOT proname = ANY (v_rpc)),
           count(*)
      INTO v_txt, v_n
      FROM pg_proc
     WHERE pronamespace = 'public'::regnamespace AND proname LIKE 'agenda\_%'
       AND has_function_privilege('authenticated', oid, 'EXECUTE');
    SELECT string_agg(x, ', ') INTO v_txt2
      FROM unnest(v_rpc) x
     WHERE NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = x
                          AND has_function_privilege('authenticated', oid, 'EXECUTE'));
    IF v_txt IS NOT NULL OR v_txt2 IS NOT NULL OR v_n <> cardinality(v_rpc) THEN
        RAISE EXCEPTION 'FALLÓ 23: authenticated ejecuta % funciones (esperaba las % RPC). De más: %. Faltan: %',
                        v_n, cardinality(v_rpc), COALESCE(v_txt, 'ninguna'), COALESCE(v_txt2, 'ninguna');
    END IF;
    IF has_function_privilege('authenticated', 'public.agenda_es_encargado(uuid)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.agenda_persona(uuid)', 'EXECUTE') THEN
        RAISE EXCEPTION 'FALLÓ 23: un helper es ejecutable por authenticated';
    END IF;
    BEGIN
        UPDATE public.agenda_tareas SET subdepartamento_id = NULL WHERE id = v_t1;   -- v_t1 está completada
        RAISE EXCEPTION 'FALLÓ 23: una completada quedó sin sub';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    o := o || format(E'| 23 | Permisos de funciones para authenticated; una completada sin sub (UPDATE directo como dueño) | %s RPC, 0 helpers; check_violation | %s RPC · helpers no · check_violation | ✅ |\n', cardinality(v_rpc), v_n);

    RAISE EXCEPTION E'RESULTADO ✅ todos los casos en verde\n%', o;
END;
$$;

ROLLBACK;
