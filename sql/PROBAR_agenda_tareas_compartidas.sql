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
