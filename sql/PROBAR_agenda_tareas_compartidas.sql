-- ═══════════════════════════════════════════════════════════════════════════
-- Pruebas de sql/agenda_tareas_compartidas.sql
--
-- BEGIN … ROLLBACK y un RAISE EXCEPTION final a propósito: se deshace todo,
-- incluida la cola de pg_net. NO SALE NINGÚN AVISO NI NINGÚN PUSH, ni a las
-- personas de prueba ni a las reales. NUNCA COMMIT.
--
-- Las RPC corren con `SET LOCAL ROLE authenticated`: como postgres no se ven
-- los permisos, y así salió roto "¿Se repite?" en producción.
--
-- Personas: Elsa (encargada), Lalo y Mina (equipo A), Ben y Bea (equipo B),
-- Ana (en A y en B), Cora (equipo C), Otto (encargado de OTRO departamento).
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE TEMP TABLE r (orden serial, n text, caso text, esperado text, obtenido text);
GRANT ALL ON r TO authenticated;
GRANT ALL ON SEQUENCE r_orden_seq TO authenticated;

CREATE FUNCTION pg_temp.chk(p_n text, p_caso text, p_esperado text, p_obtenido text)
RETURNS void LANGUAGE sql AS $f$
    INSERT INTO r (n, caso, esperado, obtenido) VALUES (p_n, p_caso, p_esperado, p_obtenido);
$f$;

-- Cambia de persona y de rol: lo que sigue corre como esa persona de verdad.
CREATE FUNCTION pg_temp.como(p uuid) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
    PERFORM set_config('request.jwt.claims',
                       json_build_object('sub', p::text, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
END;
$f$;

CREATE FUNCTION pg_temp.admin() RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claims', '', true);
END;
$f$;

/** Una tarea tal como la ve la persona de turno, en pocas palabras. */
CREATE FUNCTION pg_temp.vista(p_tarea uuid) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE
    j jsonb := public.agenda_tarea(p_tarea);
BEGIN
    IF NOT (j->>'ok')::boolean THEN RETURN j->>'motivo'; END IF;
    RETURN COALESCE(j->'tarea'->'subdepartamento'->>'nombre', 'sin-sub')
        || ' · ' || (j->'tarea'->>'estado')
        || ' · equipos:' || COALESCE(jsonb_array_length(NULLIF(j->'tarea'->'equipos', 'null'::jsonb))::text, 'no');
END;
$f$;

/** Avance en la base: "A:si B:no" y estado. Corre sin rol. */
CREATE FUNCTION pg_temp.avance(p_tarea uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $f$
    SELECT t.estado || ' ' || COALESCE((
        SELECT string_agg(right(s.nombre, 1) || ':' || CASE WHEN e.finalizado_at IS NULL THEN 'no' ELSE 'si' END,
                          ' ' ORDER BY s.nombre)
          FROM public.agenda_tarea_equipos e
          JOIN public.agenda_subdepartamentos s ON s.id = e.subdepartamento_id
         WHERE e.tarea_id = p_tarea), '-')
      FROM public.agenda_tareas t WHERE t.id = p_tarea;
$f$;

CREATE FUNCTION pg_temp.hay(p jsonb, p_id uuid) RETURNS text LANGUAGE sql AS $f$
    SELECT (SELECT count(*) FROM jsonb_array_elements(COALESCE(p->'tareas', '[]'::jsonb)) t
             WHERE (t->>'id')::uuid = p_id)::text;
$f$;

/** Avisos de una alerta que recibió alguien, sin importar el rol. */
CREATE FUNCTION pg_temp.avisos(p uuid, p_clave text) RETURNS integer LANGUAGE sql SECURITY DEFINER AS $f$
    SELECT count(*)::integer FROM public.app_notifications WHERE user_id = p AND alerta_clave = p_clave;
$f$;

CREATE FUNCTION pg_temp.ultimo(p uuid, p_clave text) RETURNS text LANGUAGE sql SECURITY DEFINER AS $f$
    SELECT COALESCE((SELECT title || ' § ' || message FROM public.app_notifications
                      WHERE user_id = p AND alerta_clave = p_clave ORDER BY created_at DESC, id DESC LIMIT 1), '(ninguno)');
$f$;

CREATE FUNCTION pg_temp.limpiar() RETURNS void LANGUAGE sql SECURITY DEFINER AS $f$
    DELETE FROM public.app_notifications WHERE alerta_clave LIKE 'agenda_%';
    DELETE FROM public.agenda_avisos;
$f$;

-- `pg_temp` es un alias: el GRANT va sobre el esquema temporal de verdad.
DO $g$
BEGIN
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO authenticated', pg_my_temp_schema()::regnamespace);
    EXECUTE format('GRANT EXECUTE ON ALL ROUTINES IN SCHEMA %I TO authenticated', pg_my_temp_schema()::regnamespace);
END;
$g$;


DO $suite$
DECLARE
    elsa uuid := gen_random_uuid();
    lalo uuid := gen_random_uuid();
    mina uuid := gen_random_uuid();
    ben  uuid := gen_random_uuid();
    bea  uuid := gen_random_uuid();
    ana  uuid := gen_random_uuid();
    cora uuid := gen_random_uuid();
    otto uuid := gen_random_uuid();
    dep  uuid := gen_random_uuid();
    dep2 uuid := gen_random_uuid();
    a    uuid := gen_random_uuid();
    b    uuid := gen_random_uuid();
    c    uuid := gen_random_uuid();
    x    uuid := gen_random_uuid();   -- archivado
    y    uuid := gen_random_uuid();   -- de otro departamento
    HOY  date := public.agenda_hoy();
    t1 uuid := gen_random_uuid();
    t_comun uuid := gen_random_uuid();
    s1 uuid := gen_random_uuid();
    v_antes integer;
    t16 uuid := gen_random_uuid();
    t15 uuid := gen_random_uuid();
    t14 uuid := gen_random_uuid();
    t13 uuid := gen_random_uuid();
    t12 uuid := gen_random_uuid();
    t11 uuid := gen_random_uuid();
    t10 uuid := gen_random_uuid();
    sw uuid := gen_random_uuid();
    su uuid := gen_random_uuid();
    sq uuid := gen_random_uuid();
    sp uuid := gen_random_uuid();
    so uuid := gen_random_uuid();
    sn uuid := gen_random_uuid();
    sl uuid := gen_random_uuid();
    sk uuid := gen_random_uuid();
    si uuid := gen_random_uuid();
    sh uuid := gen_random_uuid();
    sg uuid := gen_random_uuid();
    sf uuid := gen_random_uuid();
    t_comun2 uuid := gen_random_uuid();
    s3 uuid := gen_random_uuid();
    t9 uuid := gen_random_uuid();
    t8 uuid := gen_random_uuid();
    t7 uuid := gen_random_uuid();
    v_ids uuid[];
    s2 uuid := gen_random_uuid();
    t6 uuid := gen_random_uuid();
    t5 uuid := gen_random_uuid();
    t4 uuid := gen_random_uuid();
    t3 uuid := gen_random_uuid();
    t2 uuid := gen_random_uuid();
    j jsonb; v_n integer; v_txt text; v_id uuid;
    v_fallos integer; v_salida text;
BEGIN
-- ═══════════════════════════════════════════════════════════════════════════
-- Fixture
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
SELECT q, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'prueba.comp.' || left(q::text, 8) || '@test.local', '', now(), now()
  FROM unnest(ARRAY[elsa, lalo, mina, ben, bea, ana, cora, otto]) q;

INSERT INTO public.users (id, name, email, role, roles, is_active)
SELECT q.id, q.n, 'prueba.comp.' || lower(q.n) || '@test.local', 'VIEWER', ARRAY['VIEWER'], true
  FROM (VALUES (elsa, 'Elsa'), (lalo, 'Lalo'), (mina, 'Mina'), (ben, 'Ben'), (bea, 'Bea'),
               (ana, 'Ana'), (cora, 'Cora'), (otto, 'Otto')) q(id, n)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role,
                               roles = EXCLUDED.roles, is_active = true;

INSERT INTO public.agenda_departamentos (id, nombre, color, icono, created_by) VALUES
    (dep,  'PRUEBA Comp',  '#336699', 'calendar', elsa),
    (dep2, 'PRUEBA Otro',  '#996633', 'calendar', otto);
INSERT INTO public.agenda_departamento_encargados (departamento_id, user_id) VALUES (dep, elsa), (dep2, otto);
INSERT INTO public.agenda_subdepartamentos (id, departamento_id, nombre, color, lider_id, archivado_at) VALUES
    (a, dep,  'Equipo A', '#112233', lalo, NULL),
    (b, dep,  'Equipo B', '#445566', ben,  NULL),
    (c, dep,  'Equipo C', '#778899', cora, NULL),
    (x, dep,  'Equipo X', '#aabbcc', NULL, now()),
    (y, dep2, 'Equipo Y', '#ddeeff', otto, NULL);
INSERT INTO public.agenda_subdepartamento_miembros (subdepartamento_id, user_id) VALUES
    (a, mina), (a, ana), (b, bea), (b, ana);


-- ═══════════════════════════════════════════════════════════════════════════
-- A · Crear una compartida
-- ═══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.como(elsa);
j := public.agenda_crear_tarea(t1, dep, NULL, NULL, NULL, 'PRUEBA compartida', NULL, HOY, true, NULL, NULL,
                               p_subs => ARRAY[a, b]);
PERFORM pg_temp.chk('A1', 'crear para dos equipos: una tarea, en proceso, compartida',
    'true · en_proceso · true', (j->>'ok') || ' · ' || (j->'tarea'->>'estado') || ' · ' || (j->'tarea'->>'compartida'));
PERFORM pg_temp.chk('A2', 'queda sin sub-departamento en la fila y con dos equipos sin terminar',
    'en_proceso A:no B:no', pg_temp.avance(t1));

j := public.agenda_crear_tarea(gen_random_uuid(), dep, NULL, NULL, NULL, 'PRUEBA', NULL, HOY, true, NULL, NULL, p_subs => ARRAY[a]);
PERFORM pg_temp.chk('A3', 'con un solo equipo no es compartida', 'compartida_minimo', j->>'motivo');
j := public.agenda_crear_tarea(gen_random_uuid(), dep, NULL, NULL, NULL, 'PRUEBA', NULL, HOY, true, NULL, NULL, p_subs => ARRAY[a, a]);
PERFORM pg_temp.chk('A4', 'el mismo equipo dos veces cuenta como uno', 'compartida_minimo', j->>'motivo');
j := public.agenda_crear_tarea(gen_random_uuid(), dep, NULL, NULL, NULL, 'PRUEBA', NULL, HOY, true, NULL, NULL, p_subs => ARRAY[a, y]);
PERFORM pg_temp.chk('A5', 'un equipo de otro departamento', 'sub_ajeno', j->>'motivo');
j := public.agenda_crear_tarea(gen_random_uuid(), dep, NULL, NULL, NULL, 'PRUEBA', NULL, HOY, true, NULL, NULL, p_subs => ARRAY[a, x]);
PERFORM pg_temp.chk('A6', 'un equipo archivado', 'archivado', j->>'motivo');

j := public.agenda_crear_tarea(t1, dep, NULL, NULL, NULL, 'PRUEBA compartida', NULL, HOY, true, NULL, NULL, p_subs => ARRAY[a, b]);
PERFORM pg_temp.chk('A7', 'el mismo id dos veces: devuelve la que ya había, sin duplicar equipos',
    'true · en_proceso A:no B:no', (j->>'ya_existia') || ' · ' || pg_temp.avance(t1));

j := public.agenda_crear_tarea(s1, dep, NULL, NULL, NULL, 'PRUEBA serie comp', NULL, HOY, true, NULL, NULL,
                               NULL, HOY + 35, 'cada_semana', ARRAY[a, b]);
PERFORM pg_temp.admin();
PERFORM pg_temp.chk('A8', 'con repetición: 6 tareas compartidas', '6',
    (SELECT count(*)::text FROM public.agenda_tareas WHERE serie_id = s1 AND compartida));
PERFORM pg_temp.chk('A9', 'con repetición: 12 filas de equipos', '12',
    (SELECT count(*)::text FROM public.agenda_tarea_equipos e JOIN public.agenda_tareas t ON t.id = e.tarea_id WHERE t.serie_id = s1));

PERFORM pg_temp.como(lalo);
j := public.agenda_crear_tarea(gen_random_uuid(), dep, NULL, NULL, NULL, 'PRUEBA', NULL, HOY, true, NULL, NULL, p_subs => ARRAY[a, b]);
PERFORM pg_temp.chk('A10', 'un integrante no crea', 'sin_permiso', j->>'motivo');


-- ═══════════════════════════════════════════════════════════════════════════
-- B · Lo que ve cada uno
-- ═══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.como(elsa);
PERFORM pg_temp.chk('B1', 'la encargada: sin sub, y con los equipos', 'sin-sub · en_proceso · equipos:2', pg_temp.vista(t1));
PERFORM pg_temp.chk('B2', 'la encargada ve a la gente de los dos equipos, cada persona una vez', '5',
    jsonb_array_length(public.agenda_tarea(t1)->'tarea'->'la_tienen')::text);
PERFORM pg_temp.como(lalo);
PERFORM pg_temp.chk('B3', 'un integrante: su equipo, sin la lista de equipos', 'Equipo A · en_proceso · equipos:no', pg_temp.vista(t1));
PERFORM pg_temp.chk('B4', 'un integrante ve sólo a su equipo en "la tienen"', '3',
    jsonb_array_length(public.agenda_tarea(t1)->'tarea'->'la_tienen')::text);
PERFORM pg_temp.chk('B5', 'pero sabe que es compartida', 'true', public.agenda_tarea(t1)->'tarea'->>'compartida');
PERFORM pg_temp.como(bea);
PERFORM pg_temp.chk('B6', 'integrante del otro equipo', 'Equipo B · en_proceso · equipos:no', pg_temp.vista(t1));
PERFORM pg_temp.como(otto);
PERFORM pg_temp.chk('B7', 'encargado de otro departamento', 'sin_permiso', pg_temp.vista(t1));
PERFORM pg_temp.como(cora);
PERFORM pg_temp.chk('B8', 'integrante de un equipo que no está en la tarea', 'sin_permiso', pg_temp.vista(t1));

PERFORM pg_temp.como(mina);
j := public.agenda_mis_tareas(HOY, HOY);
PERFORM pg_temp.chk('B9', 'en "mis tareas" de un integrante, una vez', '1', pg_temp.hay(j, t1));
PERFORM pg_temp.como(ana);
j := public.agenda_mis_tareas(HOY, HOY);
PERFORM pg_temp.chk('B10', 'quien está en los dos equipos la ve una sola vez', '1', pg_temp.hay(j, t1));
PERFORM pg_temp.como(lalo);
j := public.agenda_tareas_subdepartamento(a, HOY, HOY);
PERFORM pg_temp.chk('B11', 'en el panel del equipo', '1', pg_temp.hay(j, t1));
PERFORM pg_temp.como(cora);
j := public.agenda_tareas_subdepartamento(c, HOY, HOY);
PERFORM pg_temp.chk('B12', 'no aparece en el panel de otro equipo', '0', pg_temp.hay(j, t1));
PERFORM pg_temp.como(elsa);
j := public.agenda_tareas_departamento(dep, HOY, HOY);
PERFORM pg_temp.chk('B13', 'en el departamento, una vez', '1', pg_temp.hay(j, t1));
j := public.agenda_tareas_subdepartamento(b, HOY, HOY);
PERFORM pg_temp.chk('B14', 'la encargada en el panel de un equipo la ve como de ese equipo', 'Equipo B',
    (SELECT e->'subdepartamento'->>'nombre' FROM jsonb_array_elements(j->'tareas') e WHERE (e->>'id')::uuid = t1));

j := public.agenda_crear_tarea(t_comun, dep, a, NULL, NULL, 'PRUEBA común', NULL, HOY, true, NULL, NULL);
PERFORM pg_temp.chk('B15', 'una tarea común sigue con su equipo y no es compartida', 'Equipo A · en_proceso · false · null',
    (j->'tarea'->'subdepartamento'->>'nombre') || ' · ' || (j->'tarea'->>'estado') || ' · '
    || (j->'tarea'->>'compartida') || ' · ' || COALESCE(j->'tarea'->>'equipos', 'null'));


-- ═══════════════════════════════════════════════════════════════════════════
-- C · Finalizar y deshacer
-- ═══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.como(elsa);
j := public.agenda_crear_tarea(t2, dep, NULL, NULL, NULL, 'PRUEBA dos', NULL, HOY + 1, true, NULL, NULL, p_subs => ARRAY[a, b]);
j := public.agenda_crear_tarea(t3, dep, NULL, NULL, NULL, 'PRUEBA tres', NULL, HOY + 1, true, NULL, NULL, p_subs => ARRAY[a, b]);

PERFORM pg_temp.como(lalo);
j := public.agenda_cambiar_estado_tarea(t2, 'completada');
PERFORM pg_temp.chk('C1', 'Lalo da el finalizado: vale por su equipo, la tarea sigue', 'true · en_proceso A:si B:no',
    (j->>'ok') || ' · ' || pg_temp.avance(t2));
PERFORM pg_temp.chk('C2', 'para su equipo ya está completada', 'Equipo A · completada · equipos:no', pg_temp.vista(t2));
PERFORM pg_temp.como(mina);
PERFORM pg_temp.chk('C3', 'también para Mina, de su mismo equipo', 'Equipo A · completada · equipos:no', pg_temp.vista(t2));
PERFORM pg_temp.chk('C4', 'y le sale de la Agenda', '0', pg_temp.hay(public.agenda_mis_tareas(HOY + 1, HOY + 1), t2));
PERFORM pg_temp.chk('C5', 'ya no tiene nada para cambiar', 'false', public.agenda_tarea(t2)->'tarea'->>'puede_cambiar_estado');
j := public.agenda_cambiar_estado_tarea(t2, 'completada');
PERFORM pg_temp.chk('C6', 'el mismo equipo otra vez: sin cambios', 'true', j->>'sin_cambios');
PERFORM pg_temp.admin();
PERFORM pg_temp.chk('C7', 'queda registrado quien lo dio primero', 'Lalo',
    (SELECT u.name FROM public.agenda_tarea_equipos e JOIN public.users u ON u.id = e.finalizado_por
      WHERE e.tarea_id = t2 AND e.subdepartamento_id = a));
PERFORM pg_temp.como(bea);
PERFORM pg_temp.chk('C8', 'el otro equipo la sigue viendo en proceso', 'Equipo B · en_proceso · equipos:no', pg_temp.vista(t2));
PERFORM pg_temp.chk('C9', 'y en su Agenda', '1', pg_temp.hay(public.agenda_mis_tareas(HOY + 1, HOY + 1), t2));
PERFORM pg_temp.chk('C10', 'y la puede cambiar', 'true', public.agenda_tarea(t2)->'tarea'->>'puede_cambiar_estado');
PERFORM pg_temp.como(elsa);
PERFORM pg_temp.chk('C11', 'la encargada ve el avance', 'sin-sub · en_proceso · equipos:2', pg_temp.vista(t2));
PERFORM pg_temp.chk('C12', 'con quién terminó', 'Equipo A:Lalo',
    (SELECT string_agg((e->>'nombre') || ':' || (e->'finalizado_por'->>'nombre'), ',')
       FROM jsonb_array_elements(public.agenda_tarea(t2)->'tarea'->'equipos') e WHERE e->>'finalizado_at' IS NOT NULL));
PERFORM pg_temp.como(bea);
j := public.agenda_cambiar_estado_tarea(t2, 'completada');
PERFORM pg_temp.chk('C13', 'termina el último: la tarea queda completada', 'completada A:si B:si', pg_temp.avance(t2));
PERFORM pg_temp.admin();
PERFORM pg_temp.chk('C14', 'la completó el último', 'Bea',
    (SELECT u.name FROM public.agenda_tareas t JOIN public.users u ON u.id = t.completada_por WHERE t.id = t2));

PERFORM pg_temp.como(bea);
j := public.agenda_cambiar_estado_tarea(t3, 'completada');
PERFORM pg_temp.como(mina);
j := public.agenda_cambiar_estado_tarea(t3, 'completada');
PERFORM pg_temp.chk('C15', 'en el orden inverso, igual', 'completada A:si B:si', pg_temp.avance(t3));

PERFORM pg_temp.como(lalo);
j := public.agenda_cambiar_estado_tarea(t2, 'en_proceso');
PERFORM pg_temp.chk('C16', 'un integrante no puede deshacer', 'solo_el_departamento', j->>'motivo');
PERFORM pg_temp.como(elsa);
j := public.agenda_cambiar_estado_tarea(t2, 'en_proceso');
PERFORM pg_temp.chk('C17', 'la encargada, sin decir de qué equipo', 'sin_equipos', j->>'motivo');
j := public.agenda_cambiar_estado_tarea(t2, 'en_proceso', a);
PERFORM pg_temp.chk('C18', 'la encargada deshace el de A: vuelve a en proceso', 'true · en_proceso A:no B:si', (j->>'ok') || ' · ' || pg_temp.avance(t2));
PERFORM pg_temp.admin();
PERFORM pg_temp.chk('C19', 'sin fecha de completada', 'null · null',
    COALESCE((SELECT completada_at::text FROM public.agenda_tareas WHERE id = t2), 'null') || ' · '
    || COALESCE((SELECT completada_por::text FROM public.agenda_tareas WHERE id = t2), 'null'));
PERFORM pg_temp.como(mina);
PERFORM pg_temp.chk('C20', 'vuelve a las pendientes de A', '1', pg_temp.hay(public.agenda_mis_tareas(HOY + 1, HOY + 1), t2));
PERFORM pg_temp.como(elsa);
j := public.agenda_cambiar_estado_tarea(t2, 'completada', a);
PERFORM pg_temp.chk('C21', 'la encargada termina por A', 'completada A:si B:si', pg_temp.avance(t2));
j := public.agenda_cambiar_estado_tarea(t2, 'completada');
PERFORM pg_temp.chk('C22', 'la encargada sin equipo', 'sin_equipos', j->>'motivo');
j := public.agenda_cambiar_estado_tarea(t2, 'completada', c);
PERFORM pg_temp.chk('C23', 'un equipo que no está en la tarea', 'sub_ajeno', j->>'motivo');
PERFORM pg_temp.como(lalo);
j := public.agenda_cambiar_estado_tarea(t3, 'completada', b);
PERFORM pg_temp.chk('C24', 'Lalo no puede terminar por otro equipo', 'sin_permiso', j->>'motivo');
PERFORM pg_temp.como(cora);
j := public.agenda_cambiar_estado_tarea(t3, 'completada');
PERFORM pg_temp.chk('C25', 'quien no está en la tarea', 'sin_permiso', j->>'motivo');

-- Dos equipos a la vez (Review Focus 1). La fila se toma con FOR UPDATE antes de
-- contar, y cerrar otra vez no vuelve a escribir la fecha.
PERFORM pg_temp.admin();
PERFORM pg_temp.chk('C26', 'finalizar toma la fila antes de contar', 'true',
    (pg_get_functiondef('public.agenda_cambiar_estado_tarea(uuid,text,uuid)'::regprocedure) LIKE '%FOR UPDATE%'
     AND pg_get_functiondef('public.agenda_recalcular_compartida(uuid)'::regprocedure) LIKE '%FOR UPDATE%')::text);
UPDATE public.agenda_tareas SET completada_at = now() - interval '2 days' WHERE id = t3;
PERFORM pg_temp.como(lalo);
j := public.agenda_cambiar_estado_tarea(t3, 'completada');
PERFORM pg_temp.admin();
PERFORM pg_temp.chk('C27', 'cerrar de nuevo no pisa la fecha de completada', 'true',
    ((SELECT completada_at FROM public.agenda_tareas WHERE id = t3) < now() - interval '1 day')::text);

-- Persona en dos equipos.
PERFORM pg_temp.como(elsa);
j := public.agenda_crear_tarea(t4, dep, NULL, NULL, NULL, 'PRUEBA cuatro', NULL, HOY + 1, true, NULL, NULL, p_subs => ARRAY[a, b]);
j := public.agenda_crear_tarea(t5, dep, NULL, NULL, NULL, 'PRUEBA cinco', NULL, HOY + 1, true, NULL, NULL, p_subs => ARRAY[a, b]);
PERFORM pg_temp.como(ana);
j := public.agenda_cambiar_estado_tarea(t4, 'completada');
PERFORM pg_temp.chk('C28', 'Ana, en dos equipos, sin decir cuál: termina los dos', 'completada A:si B:si', pg_temp.avance(t4));
j := public.agenda_cambiar_estado_tarea(t5, 'completada', a);
PERFORM pg_temp.chk('C29', 'desde el panel de un equipo: sólo ese', 'en_proceso A:si B:no', pg_temp.avance(t5));
PERFORM pg_temp.chk('C30', 'y la sigue viendo por el otro', 'Equipo B · en_proceso · equipos:no', pg_temp.vista(t5));

-- Alguien sale del equipo con la tarea a medias (Review Focus 3).
PERFORM pg_temp.como(bea);
j := public.agenda_cambiar_estado_tarea(t5, 'completada', b);
PERFORM pg_temp.chk('C31', 'Bea termina por su equipo', 'completada A:si B:si', pg_temp.avance(t5));
PERFORM pg_temp.como(elsa);
j := public.agenda_cambiar_estado_tarea(t5, 'en_proceso', a);
PERFORM pg_temp.admin();
DELETE FROM public.agenda_subdepartamento_miembros WHERE subdepartamento_id = b AND user_id = bea;
PERFORM pg_temp.como(bea);
PERFORM pg_temp.chk('C32', 'Bea sale del equipo: deja de verla', 'sin_permiso', pg_temp.vista(t5));
PERFORM pg_temp.chk('C33', 'lo que su equipo terminó se conserva', 'en_proceso A:no B:si', pg_temp.avance(t5));
PERFORM pg_temp.admin();
INSERT INTO public.agenda_subdepartamento_miembros (subdepartamento_id, user_id) VALUES (b, bea);


-- ═══════════════════════════════════════════════════════════════════════════
-- D · Editar y reasignar
-- ═══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.como(elsa);
j := public.agenda_crear_tarea(t6, dep, NULL, NULL, NULL, 'PRUEBA seis', NULL, HOY + 2, true, NULL, NULL, p_subs => ARRAY[a, b]);
j := public.agenda_editar_tarea(t6, NULL, NULL, NULL, 'PRUEBA seis bis', NULL, HOY + 2, true, NULL, NULL);
PERFORM pg_temp.chk('D1', 'editar sin tocar equipos los deja igual', 'true · en_proceso A:no B:no · PRUEBA seis bis',
    (j->>'ok') || ' · ' || pg_temp.avance(t6) || ' · ' || (j->'tarea'->>'nombre'));
j := public.agenda_editar_tarea(t6, NULL, NULL, NULL, 'PRUEBA seis', NULL, HOY + 2, true, NULL, NULL, p_subs => ARRAY[a, b, c]);
PERFORM pg_temp.chk('D2', 'sumar un equipo: arranca pendiente', 'true · en_proceso A:no B:no C:no', (j->>'ok') || ' · ' || pg_temp.avance(t6));
PERFORM pg_temp.como(lalo);
j := public.agenda_cambiar_estado_tarea(t6, 'completada');
j := public.agenda_editar_tarea(t6, NULL, NULL, NULL, 'PRUEBA', NULL, HOY + 2, true, NULL, NULL, p_subs => ARRAY[a]);
PERFORM pg_temp.chk('D3', 'un integrante no edita', 'sin_permiso', j->>'motivo');
PERFORM pg_temp.como(elsa);
j := public.agenda_editar_tarea(t6, NULL, NULL, NULL, 'PRUEBA seis', NULL, HOY + 2, true, NULL, NULL, p_subs => ARRAY[]::uuid[]);
PERFORM pg_temp.chk('D4', 'sin ningún equipo no se puede', 'sin_equipos', j->>'motivo');
j := public.agenda_editar_tarea(t6, NULL, NULL, NULL, 'PRUEBA seis', NULL, HOY + 2, true, NULL, NULL, p_subs => ARRAY[a, y]);
PERFORM pg_temp.chk('D5', 'un equipo de otro departamento', 'sub_ajeno', j->>'motivo');
j := public.agenda_editar_tarea(t6, NULL, NULL, NULL, 'PRUEBA seis', NULL, HOY + 2, true, NULL, NULL, p_subs => ARRAY[a, b]);
PERFORM pg_temp.chk('D6', 'sacar uno pendiente: el resto sigue', 'en_proceso A:si B:no', pg_temp.avance(t6));
j := public.agenda_editar_tarea(t6, NULL, NULL, NULL, 'PRUEBA seis', NULL, HOY + 2, true, NULL, NULL, p_subs => ARRAY[a]);
PERFORM pg_temp.chk('D7', 'sacar al único que faltaba: se completa', 'completada A:si', pg_temp.avance(t6));
j := public.agenda_editar_tarea(t6, NULL, NULL, NULL, 'PRUEBA seis', NULL, HOY + 2, true, NULL, NULL, p_subs => ARRAY[a, b]);
PERFORM pg_temp.chk('D8', 'una completada no cambia de equipos', 'completada', j->>'motivo');
j := public.agenda_editar_tarea(t_comun, a, NULL, NULL, 'PRUEBA común', NULL, HOY, true, NULL, NULL, p_subs => ARRAY[a, b]);
PERFORM pg_temp.chk('D9', 'una común no se vuelve compartida', 'es_compartida', j->>'motivo');
j := public.agenda_editar_tarea(t5, a, NULL, NULL, 'PRUEBA cinco', NULL, HOY + 1, true, NULL, NULL);
PERFORM pg_temp.chk('D10', 'una compartida no se vuelve común', 'es_compartida', j->>'motivo');
j := public.agenda_reasignar_tarea(t5, c);
PERFORM pg_temp.chk('D11', 'una compartida no se reasigna', 'es_compartida', j->>'motivo');

-- Repeticiones.
j := public.agenda_crear_tarea(s2, dep, NULL, NULL, NULL, 'PRUEBA serie dos', NULL, HOY, true, NULL, NULL,
                               NULL, HOY + 35, 'cada_semana', ARRAY[a, b]);
PERFORM pg_temp.admin();
SELECT array_agg(id ORDER BY fecha) INTO v_ids FROM public.agenda_tareas WHERE serie_id = s2;
PERFORM pg_temp.como(lalo);
j := public.agenda_cambiar_estado_tarea(v_ids[1], 'completada');
PERFORM pg_temp.chk('D12', 'cada repetición se finaliza por separado', 'en_proceso A:si B:no | en_proceso A:no B:no',
    pg_temp.avance(v_ids[1]) || ' | ' || pg_temp.avance(v_ids[2]));
PERFORM pg_temp.como(ben);
j := public.agenda_cambiar_estado_tarea(v_ids[1], 'completada');
PERFORM pg_temp.como(elsa);
j := public.agenda_editar_tarea(v_ids[3], NULL, NULL, NULL, 'PRUEBA serie dos', NULL, HOY + 14, true, NULL, NULL, p_subs => ARRAY[a, b, c]);
PERFORM pg_temp.chk('D13', 'con "solo esta" cambia sólo esa repetición', 'en_proceso A:no B:no C:no | en_proceso A:no B:no',
    pg_temp.avance(v_ids[3]) || ' | ' || pg_temp.avance(v_ids[4]));
j := public.agenda_editar_tarea(v_ids[2], NULL, NULL, NULL, 'PRUEBA serie dos', NULL, HOY + 7, true, NULL, NULL,
                                p_alcance => 'las_que_faltan', p_subs => ARRAY[a, c]);
PERFORM pg_temp.chk('D14', 'con "las que faltan" cambia las pendientes y no la completada', 'completada A:si B:si | en_proceso A:no C:no | en_proceso A:no C:no',
    pg_temp.avance(v_ids[1]) || ' | ' || pg_temp.avance(v_ids[2]) || ' | ' || pg_temp.avance(v_ids[5]));
j := public.agenda_editar_tarea(v_ids[2], NULL, NULL, NULL, 'PRUEBA serie dos', NULL, HOY + 7, true, NULL, NULL,
                                HOY + 21, 'cada_semana', 'las_que_faltan');
PERFORM pg_temp.admin();
PERFORM pg_temp.chk('D15', 'rearmar la serie conserva la completada y copia los equipos', '4 · 4 · 8 · 2',
    (SELECT count(*)::text FROM public.agenda_tareas WHERE serie_id = s2) || ' · '
    || (SELECT count(*)::text FROM public.agenda_tareas WHERE serie_id = s2 AND compartida) || ' · '
    || (SELECT count(*)::text FROM public.agenda_tarea_equipos e JOIN public.agenda_tareas t ON t.id = e.tarea_id WHERE t.serie_id = s2) || ' · '
    || (SELECT count(*)::text FROM public.agenda_tarea_equipos e JOIN public.agenda_tareas t ON t.id = e.tarea_id WHERE t.serie_id = s2 AND e.finalizado_at IS NOT NULL));
PERFORM pg_temp.chk('D16', 'la que ya estaba completada sigue igual', 'completada A:si B:si', pg_temp.avance(v_ids[1]));

-- Lo común sigue igual.
PERFORM pg_temp.como(lalo);
j := public.agenda_cambiar_estado_tarea(t_comun, 'completada');
PERFORM pg_temp.chk('D17', 'una común se completa como siempre', 'completada', j->'tarea'->>'estado');
j := public.agenda_cambiar_estado_tarea(t_comun, 'en_proceso');
PERFORM pg_temp.chk('D18', 'y su integrante la reabre como siempre', 'en_proceso', j->'tarea'->>'estado');


-- ═══════════════════════════════════════════════════════════════════════════
-- E · Avisos
-- ═══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.admin();
PERFORM pg_temp.limpiar();
PERFORM pg_temp.como(elsa);
j := public.agenda_crear_tarea(t7, dep, NULL, NULL, NULL, 'PRUEBA avisos', NULL, HOY + 3, true, NULL, NULL, p_subs => ARRAY[a, b]);
PERFORM pg_temp.chk('E1', 'a la gente de los dos equipos le llega un "asignada"', '1 1 1 1',
    pg_temp.avisos(lalo, 'agenda_tarea_asignada') || ' ' || pg_temp.avisos(mina, 'agenda_tarea_asignada') || ' '
    || pg_temp.avisos(ben, 'agenda_tarea_asignada') || ' ' || pg_temp.avisos(bea, 'agenda_tarea_asignada'));
PERFORM pg_temp.chk('E2', 'quien está en los dos recibe uno solo', '1', pg_temp.avisos(ana, 'agenda_tarea_asignada')::text);
PERFORM pg_temp.chk('E3', 'la encargada no', '0', pg_temp.avisos(elsa, 'agenda_tarea_asignada')::text);
PERFORM pg_temp.chk('E4', 'el aviso nombra a su equipo y a nadie más', 'true · false',
    (pg_temp.ultimo(bea, 'agenda_tarea_asignada') LIKE '%Equipo B%')::text || ' · '
    || (pg_temp.ultimo(bea, 'agenda_tarea_asignada') LIKE '%Equipo A%')::text);

PERFORM pg_temp.admin();
PERFORM pg_temp.limpiar();
PERFORM pg_temp.como(elsa);
j := public.agenda_crear_tarea(s3, dep, NULL, NULL, NULL, 'PRUEBA serie avisos', NULL, HOY, true, NULL, NULL,
                               NULL, HOY + 14, 'cada_semana', ARRAY[a, b]);
PERFORM pg_temp.chk('E5', 'una serie compartida avisa una sola vez a cada persona', '1 1 1',
    pg_temp.avisos(mina, 'agenda_tarea_asignada') || ' ' || pg_temp.avisos(bea, 'agenda_tarea_asignada') || ' ' || pg_temp.avisos(ana, 'agenda_tarea_asignada'));

PERFORM pg_temp.admin();
PERFORM pg_temp.limpiar();
PERFORM pg_temp.como(lalo);
j := public.agenda_cambiar_estado_tarea(t7, 'completada');
PERFORM pg_temp.chk('E6', 'termina un equipo: a la encargada le llega un aviso', '1', pg_temp.avisos(elsa, 'agenda_tarea_equipo_termino')::text);
PERFORM pg_temp.chk('E7', 'dice quién terminó y quién falta', 'true · true',
    (pg_temp.ultimo(elsa, 'agenda_tarea_equipo_termino') LIKE '%Equipo A%')::text || ' · '
    || (pg_temp.ultimo(elsa, 'agenda_tarea_equipo_termino') LIKE '%Falta: Equipo B%')::text);
PERFORM pg_temp.chk('E8', 'a los equipos no les llega', '0 0',
    pg_temp.avisos(lalo, 'agenda_tarea_equipo_termino') || ' ' || pg_temp.avisos(bea, 'agenda_tarea_equipo_termino'));
PERFORM pg_temp.chk('E9', 'todavía no llega el de completada', '0', pg_temp.avisos(elsa, 'agenda_tarea_completada')::text);
PERFORM pg_temp.como(elsa);
j := public.agenda_cambiar_estado_tarea(t7, 'en_proceso', a);
PERFORM pg_temp.como(mina);
j := public.agenda_cambiar_estado_tarea(t7, 'completada');
PERFORM pg_temp.chk('E10', 'deshacer y volver a terminar no repite el aviso', '1', pg_temp.avisos(elsa, 'agenda_tarea_equipo_termino')::text);
PERFORM pg_temp.como(ben);
j := public.agenda_cambiar_estado_tarea(t7, 'completada');
PERFORM pg_temp.chk('E11', 'el último: un solo aviso, el de completada', '1 · 1',
    pg_temp.avisos(elsa, 'agenda_tarea_equipo_termino') || ' · ' || pg_temp.avisos(elsa, 'agenda_tarea_completada'));
PERFORM pg_temp.chk('E12', 'nombra a los equipos y a quien la cerró', 'true · true',
    (pg_temp.ultimo(elsa, 'agenda_tarea_completada') LIKE '%Equipo A y Equipo B%')::text || ' · '
    || (pg_temp.ultimo(elsa, 'agenda_tarea_completada') LIKE '%Ben%')::text);

PERFORM pg_temp.como(elsa);
j := public.agenda_crear_tarea(t8, dep, NULL, NULL, NULL, 'PRUEBA sumar', NULL, HOY + 3, true, NULL, NULL, p_subs => ARRAY[a, b]);
PERFORM pg_temp.admin();
PERFORM pg_temp.limpiar();
PERFORM pg_temp.como(elsa);
j := public.agenda_editar_tarea(t8, NULL, NULL, NULL, 'PRUEBA sumar', NULL, HOY + 3, true, NULL, NULL, p_subs => ARRAY[a, b, c]);
PERFORM pg_temp.chk('E13', 'sumar un equipo: el aviso le llega sólo a ese', '1 · 0', pg_temp.avisos(cora, 'agenda_tarea_asignada') || ' · ' || pg_temp.avisos(mina, 'agenda_tarea_asignada'));

j := public.agenda_crear_tarea(t9, dep, NULL, NULL, NULL, 'PRUEBA vencida', NULL, HOY + 1, true, NULL, NULL, NULL, HOY + 5, NULL, ARRAY[a, b]);
PERFORM pg_temp.como(lalo);
j := public.agenda_cambiar_estado_tarea(t9, 'completada');
PERFORM pg_temp.admin();
UPDATE public.agenda_tareas SET fecha = HOY - 5, fecha_hasta = HOY - 1 WHERE id = t9;
PERFORM pg_temp.limpiar();
PERFORM public.agenda_plazos_vencidos_tick(now());
PERFORM pg_temp.chk('E14', 'plazo vencido: a la encargada, nombrando sólo a los que faltan', '1 · true · false',
    pg_temp.avisos(elsa, 'agenda_plazo_vencido') || ' · '
    || (pg_temp.ultimo(elsa, 'agenda_plazo_vencido') LIKE '%Equipo B%')::text || ' · '
    || (pg_temp.ultimo(elsa, 'agenda_plazo_vencido') LIKE '%Equipo A%')::text);
PERFORM pg_temp.como(lalo);
PERFORM pg_temp.chk('E15', 'quien ya terminó no la ve vencida', 'false', public.agenda_tarea(t9)->'tarea'->>'vencida');
PERFORM pg_temp.como(ben);
PERFORM pg_temp.chk('E16', 'quien falta, sí', 'true', public.agenda_tarea(t9)->'tarea'->>'vencida');
PERFORM pg_temp.como(elsa);
PERFORM pg_temp.chk('E17', 'la encargada también', 'true', public.agenda_tarea(t9)->'tarea'->>'vencida');

-- Lo común, igual.
PERFORM pg_temp.admin();
PERFORM pg_temp.limpiar();
PERFORM pg_temp.como(elsa);
j := public.agenda_crear_tarea(t_comun2, dep, a, NULL, NULL, 'PRUEBA común dos', NULL, HOY, true, NULL, NULL);
PERFORM pg_temp.como(lalo);
j := public.agenda_cambiar_estado_tarea(t_comun2, 'completada');
PERFORM pg_temp.chk('E18', 'una común avisa igual que antes', '1 · 1 · 0 · true',
    pg_temp.avisos(mina, 'agenda_tarea_asignada') || ' · ' || pg_temp.avisos(elsa, 'agenda_tarea_completada') || ' · '
    || pg_temp.avisos(elsa, 'agenda_tarea_equipo_termino') || ' · '
    || (pg_temp.ultimo(elsa, 'agenda_tarea_completada') LIKE '%Equipo A%')::text);


-- ═══════════════════════════════════════════════════════════════════════════
-- F · Contadores
-- ═══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.admin();
INSERT INTO public.agenda_subdepartamentos (id, departamento_id, nombre, color, lider_id) VALUES
    (sf, dep, 'Equipo F', '#101010', lalo), (sg, dep, 'Equipo G', '#202020', ben),
    (sh, dep, 'Equipo H', '#303030', NULL), (si, dep, 'Equipo I', '#404040', ben),
    (sk, dep, 'Equipo K', '#505050', NULL), (sl, dep, 'Equipo L', '#606060', NULL),
    (sn, dep, 'Equipo N', '#707070', NULL), (so, dep, 'Equipo O', '#808080', NULL),
    (sp, dep, 'Equipo P', '#909090', NULL), (sq, dep, 'Equipo Q', '#a0a0a0', ben),
    (su, dep, 'Equipo U', '#b0b0b0', NULL), (sw, dep, 'Equipo W', '#c0c0c0', NULL);

PERFORM pg_temp.como(elsa);
v_antes := (SELECT (d->>'en_proceso')::integer FROM jsonb_array_elements(public.agenda_mi_acceso()->'encargado') d WHERE (d->>'id')::uuid = dep);
j := public.agenda_crear_tarea(t10, dep, NULL, NULL, NULL, 'PRUEBA contar', NULL, HOY, true, NULL, NULL, p_subs => ARRAY[sf, sg]);
PERFORM pg_temp.chk('F1', 'en el departamento, una compartida cuenta una vez', (v_antes + 1)::text,
    (SELECT d->>'en_proceso' FROM jsonb_array_elements(public.agenda_mi_acceso()->'encargado') d WHERE (d->>'id')::uuid = dep));
j := public.agenda_subdepartamento(sf);
PERFORM pg_temp.chk('F2', 'en cada equipo, su parte pendiente', '1 · 1 · 0',
    (j->'contadores'->>'en_proceso') || ' · ' || (j->'contadores'->>'para_hoy') || ' · ' || (j->'contadores'->>'completadas_mes'));
PERFORM pg_temp.chk('F3', 'en la lista de equipos del departamento', '1',
    (SELECT s->>'en_proceso' FROM jsonb_array_elements(public.agenda_departamento(dep)->'subdepartamentos') s WHERE (s->>'id')::uuid = sf));
PERFORM pg_temp.como(lalo);
PERFORM pg_temp.chk('F4', 'en lo que dirige Lalo', '1',
    (SELECT s->>'en_proceso' FROM jsonb_array_elements(public.agenda_mi_acceso()->'dirijo') s WHERE (s->>'id')::uuid = sf));
j := public.agenda_cambiar_estado_tarea(t10, 'completada', sf);
PERFORM pg_temp.como(elsa);
j := public.agenda_subdepartamento(sf);
PERFORM pg_temp.chk('F5', 'el equipo que terminó: 0 pendientes, 1 completada este mes', '0 · 0 · 1',
    (j->'contadores'->>'en_proceso') || ' · ' || (j->'contadores'->>'para_hoy') || ' · ' || (j->'contadores'->>'completadas_mes'));
j := public.agenda_subdepartamento(sg);
PERFORM pg_temp.chk('F6', 'el que falta sigue igual', '1 · 1 · 0',
    (j->'contadores'->>'en_proceso') || ' · ' || (j->'contadores'->>'para_hoy') || ' · ' || (j->'contadores'->>'completadas_mes'));
j := public.agenda_crear_tarea(t11, dep, sf, NULL, NULL, 'PRUEBA común de F', NULL, HOY, true, NULL, NULL);
PERFORM pg_temp.chk('F7', 'las comunes se siguen sumando', '1',
    public.agenda_subdepartamento(sf)->'contadores'->>'en_proceso');


-- ═══════════════════════════════════════════════════════════════════════════
-- G · Archivar so eliminar un equipo
-- ═══════════════════════════════════════════════════════════════════════════
j := public.agenda_crear_tarea(t12, dep, NULL, NULL, NULL, 'PRUEBA archivar', NULL, HOY, true, NULL, NULL, p_subs => ARRAY[sh, si]);
PERFORM pg_temp.como(ben);
j := public.agenda_cambiar_estado_tarea(t12, 'completada');
PERFORM pg_temp.como(elsa);
j := public.agenda_archivar_subdepartamento(sh);
PERFORM pg_temp.chk('G1', 'archivar al único que faltaba: se completa', 'true · completada H:no I:si', (j->>'ok') || ' · ' || pg_temp.avance(t12));

j := public.agenda_crear_tarea(t13, dep, NULL, NULL, NULL, 'PRUEBA archivar dos', NULL, HOY, true, NULL, NULL, p_subs => ARRAY[sk, sl]);
j := public.agenda_archivar_subdepartamento(sk);
PERFORM pg_temp.chk('G2', 'archivar a uno con otro pendiente: sigue en proceso', 'en_proceso K:no L:no', pg_temp.avance(t13));
PERFORM pg_temp.chk('G3', 'la tarea no pasa a esperando ni toma otro equipo', 'false',
    (public.agenda_tarea(t13)->'tarea'->>'estado' = 'esperando')::text);
j := public.agenda_archivar_subdepartamento(sl);
PERFORM pg_temp.chk('G4', 'archivarlos a todos sin que nadie terminara: espera que le asignen otros', 'esperando K:no L:no', pg_temp.avance(t13));
j := public.agenda_editar_tarea(t13, NULL, NULL, NULL, 'PRUEBA archivar dos', NULL, HOY, true, NULL, NULL, p_subs => ARRAY[sn]);
PERFORM pg_temp.chk('G5', 'asignarle otro equipo la vuelve a poner en proceso', 'en_proceso N:no', pg_temp.avance(t13));

j := public.agenda_crear_tarea(t14, dep, NULL, NULL, NULL, 'PRUEBA archivar tres', NULL, HOY, true, NULL, NULL, p_subs => ARRAY[so, sp]);
j := public.agenda_cambiar_estado_tarea(t14, 'completada', sp);
j := public.agenda_archivar_subdepartamento(sp);
PERFORM pg_temp.chk('G6', 'archivar a uno que ya terminó, con otro pendiente: sigue', 'en_proceso O:no P:si', pg_temp.avance(t14));
j := public.agenda_archivar_subdepartamento(so);
PERFORM pg_temp.chk('G7', 'sin equipos que cuenten, pero alguno terminó: se completa', 'completada O:no P:si', pg_temp.avance(t14));

j := public.agenda_crear_tarea(t15, dep, NULL, NULL, NULL, 'PRUEBA eliminar', NULL, HOY, true, NULL, NULL, p_subs => ARRAY[sq, su]);
j := public.agenda_cambiar_estado_tarea(t15, 'completada', sq);
j := public.agenda_crear_tarea(t16, dep, NULL, NULL, NULL, 'PRUEBA eliminar dos', NULL, HOY, true, NULL, NULL, p_subs => ARRAY[su, sw]);
-- agenda_eliminar_subdepartamento está cerrada: la llama el sistema con la sesión del encargado.
PERFORM pg_temp.admin();
PERFORM set_config('request.jwt.claims', json_build_object('sub', elsa::text, 'role', 'authenticated')::text, true);
j := public.agenda_eliminar_subdepartamento(su);
PERFORM pg_temp.chk('G8', 'eliminar al único que faltaba: se completa y su fila se va', 'true · completada Q:si', (j->>'ok') || ' · ' || pg_temp.avance(t15));
PERFORM pg_temp.chk('G9', 'eliminar a uno con otro pendiente: sigue', 'en_proceso W:no', pg_temp.avance(t16));
j := public.agenda_eliminar_subdepartamento(sw);
PERFORM pg_temp.chk('G10', 'eliminarlos a todos: espera que le asignen otros', 'esperando -', pg_temp.avance(t16));

PERFORM pg_temp.como(elsa);
j := public.agenda_eliminar_tarea(t15);
PERFORM pg_temp.admin();
PERFORM pg_temp.chk('G11', 'borrar la tarea se lleva sus equipos', 'true · 0',
    (j->>'ok') || ' · ' || (SELECT count(*)::text FROM public.agenda_tarea_equipos WHERE tarea_id = t15));



-- ═══════════════════════════════════════════════════════════════════════════
-- El reporte
-- ═══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.admin();
SELECT count(*) INTO v_fallos FROM r WHERE esperado IS DISTINCT FROM obtenido;
SELECT string_agg(format('| %s | %s | %s | %s | %s |',
            n, caso, esperado,
            CASE WHEN esperado IS NOT DISTINCT FROM obtenido THEN 'igual' ELSE COALESCE(obtenido, '(nada)') END,
            CASE WHEN esperado IS NOT DISTINCT FROM obtenido THEN '✅' ELSE '❌' END),
       E'\n' ORDER BY orden)
  INTO v_salida FROM r;

RAISE EXCEPTION E'RESULTADO % %/%\n%',
    CASE WHEN v_fallos = 0 THEN 'OK' ELSE 'FALLAN' END,
    (SELECT count(*) FROM r) - v_fallos, (SELECT count(*) FROM r), v_salida;
END;
$suite$;

ROLLBACK;
