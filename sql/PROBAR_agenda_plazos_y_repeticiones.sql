-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de sql/agenda_plazos_y_repeticiones.sql
--
-- BEGIN … ROLLBACK y un RAISE EXCEPTION final a propósito: se deshace todo,
-- incluida la cola de pg_net. NO SALE NINGÚN AVISO NI NINGÚN PUSH, ni a las
-- personas de prueba ni a las reales. NUNCA COMMIT.
--
-- Personas: Elsa (encargada del departamento), Lalo (dirige el equipo), Mina
-- (miembro del equipo), Otto (de otro departamento: no tiene que ver ni tocar
-- nada) y Nora (sin nada que ver con la Agenda).
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

/** Las opciones disponibles de un plazo, en una línea: "cada_semana:6 por_mes:2". */
CREATE FUNCTION pg_temp.ops(p_desde date, p_hasta date) RETURNS text LANGUAGE sql AS $f$
    SELECT COALESCE((
        SELECT string_agg((o->>'frecuencia') || ':' || (o->>'veces'), ' ' ORDER BY ord)
          FROM jsonb_array_elements(public.agenda_repeticiones_posibles(p_desde, p_hasta)->'opciones')
               WITH ORDINALITY x(o, ord)
         WHERE (o->>'disponible')::boolean),
        public.agenda_repeticiones_posibles(p_desde, p_hasta)->>'motivo');
$f$;

/** Los avisos de una alerta que le llegaron a alguien. */
CREATE FUNCTION pg_temp.avisos(p uuid, p_clave text) RETURNS text LANGUAGE sql AS $f$
    SELECT COALESCE(string_agg(title || ' § ' || message, ' ‖ ' ORDER BY created_at, message), '(ninguno)')
      FROM public.app_notifications WHERE user_id = p AND alerta_clave = p_clave;
$f$;

CREATE FUNCTION pg_temp.cuantos(p_clave text) RETURNS integer LANGUAGE sql AS $f$
    SELECT count(*)::integer FROM public.app_notifications WHERE alerta_clave = p_clave;
$f$;

CREATE FUNCTION pg_temp.limpiar() RETURNS void LANGUAGE sql AS $f$
    DELETE FROM public.app_notifications WHERE alerta_clave LIKE 'agenda_%';
    DELETE FROM public.agenda_avisos;
$f$;

/** Las repeticiones de una serie: "01/11:en_proceso 08/11:completada". */
CREATE FUNCTION pg_temp.serie(p uuid) RETURNS text LANGUAGE sql AS $f$
    SELECT COALESCE(string_agg(to_char(fecha, 'DD/MM') || ':' || estado, ' ' ORDER BY fecha), '(ninguna)')
      FROM public.agenda_tareas WHERE serie_id = p;
$f$;

/** Los ids de las tareas que devuelve una RPC de rango. */
CREATE FUNCTION pg_temp.hay(p jsonb, p_id uuid) RETURNS text LANGUAGE sql AS $f$
    SELECT CASE WHEN EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(p->'tareas', '[]'::jsonb)) t
         WHERE (t->>'id')::uuid = p_id) THEN 'sí' ELSE 'no' END;
$f$;


DO $suite$
DECLARE
    elsa uuid := gen_random_uuid();   -- encargada del departamento
    lalo uuid := gen_random_uuid();   -- dirige el equipo
    mina uuid := gen_random_uuid();   -- miembro del equipo
    otto uuid := gen_random_uuid();   -- encargado de OTRO departamento
    nora uuid := gen_random_uuid();   -- nada que ver
    dep  uuid := gen_random_uuid();
    dep2 uuid := gen_random_uuid();
    sub  uuid := gen_random_uuid();
    sub2 uuid := gen_random_uuid();
    HOY  date := public.agenda_hoy();
    t_dia   uuid := gen_random_uuid();
    t_plazo uuid := gen_random_uuid();
    s_sem   uuid := gen_random_uuid();
    s_dia   uuid := gen_random_uuid();
    s_mes   uuid := gen_random_uuid();
    s_edit  uuid := gen_random_uuid();
    s_borr  uuid := gen_random_uuid();
    s_rea   uuid := gen_random_uuid();
    j jsonb; v_n integer; v_id uuid; v_txt text;
    v_fallos integer; v_salida text;
BEGIN
-- ══════════════════════════════════════════════════════════════════════════
-- Fixture
-- ══════════════════════════════════════════════════════════════════════════
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
SELECT x, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'prueba.plazo.' || left(x::text, 8) || '@test.local', '', now(), now()
  FROM unnest(ARRAY[elsa, lalo, mina, otto, nora]) x;

INSERT INTO public.users (id, name, email, role, roles, is_active) VALUES
    (elsa, 'Elsa PRUEBA', 'prueba.plazo.elsa@test.local', 'VIEWER', ARRAY['VIEWER'], true),
    (lalo, 'Lalo PRUEBA', 'prueba.plazo.lalo@test.local', 'VIEWER', ARRAY['VIEWER'], true),
    (mina, 'Mina PRUEBA', 'prueba.plazo.mina@test.local', 'VIEWER', ARRAY['VIEWER'], true),
    (otto, 'Otto PRUEBA', 'prueba.plazo.otto@test.local', 'VIEWER', ARRAY['VIEWER'], true),
    (nora, 'Nora PRUEBA', 'prueba.plazo.nora@test.local', 'VIEWER', ARRAY['VIEWER'], true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role,
                               roles = EXCLUDED.roles, is_active = true;

INSERT INTO public.agenda_departamentos (id, nombre, color, icono, created_by) VALUES
    (dep,  'PRUEBA Plazos',     '#336699', 'calendar', elsa),
    (dep2, 'PRUEBA Plazos Dos', '#996633', 'calendar', otto);
INSERT INTO public.agenda_departamento_encargados (departamento_id, user_id) VALUES
    (dep, elsa), (dep2, otto);
INSERT INTO public.agenda_subdepartamentos (id, departamento_id, nombre, color, lider_id) VALUES
    (sub,  dep, 'PRUEBA Equipo Uno', '#112233', lalo),
    (sub2, dep, 'PRUEBA Equipo Dos', '#445566', lalo);
INSERT INTO public.agenda_subdepartamento_miembros (subdepartamento_id, user_id) VALUES
    (sub, mina), (sub2, mina);

PERFORM pg_temp.sesion(elsa);


-- ══════════════════════════════════════════════════════════════════════════
-- A · Las tareas de un día siguen igual
-- ══════════════════════════════════════════════════════════════════════════
j := public.agenda_crear_tarea(t_dia, dep, sub, NULL, NULL, 'PRUEBA de un día', NULL,
                               HOY, false, '09:00', '11:00');
PERFORM pg_temp.chk('A1', 'crear una tarea de un día con horario, como siempre',
    'true · en_proceso · 09:00 · 11:00',
    (j->>'ok') || ' · ' || (j->'tarea'->>'estado') || ' · '
    || (j->'tarea'->>'hora_desde') || ' · ' || (j->'tarea'->>'hora_hasta'));
PERFORM pg_temp.chk('A2', 'no tiene plazo ni serie, y NUNCA se marca vencida',
    'null · null · false',
    COALESCE(j->'tarea'->>'fecha_hasta', 'null') || ' · '
    || COALESCE(j->'tarea'->>'serie', 'null') || ' · ' || (j->'tarea'->>'vencida'));
-- Una de un día que ya pasó tampoco es vencida.
UPDATE public.agenda_tareas SET fecha = HOY - 30 WHERE id = t_dia;
PERFORM pg_temp.chk('A3', 'una de un día de hace un mes, sin completar, sigue sin ser vencida',
    'false', (public.agenda_tarea(t_dia)->'tarea'->>'vencida'));
UPDATE public.agenda_tareas SET fecha = HOY WHERE id = t_dia;
PERFORM pg_temp.chk('A4', 'el mismo id dos veces devuelve la que ya había', 'true · true',
    (SELECT (x->>'ok') || ' · ' || (x->>'ya_existia') FROM (SELECT public.agenda_crear_tarea(
        t_dia, dep, sub, NULL, NULL, 'PRUEBA de un día', NULL, HOY, false, '09:00', '11:00') x) q));


-- ══════════════════════════════════════════════════════════════════════════
-- B · Tareas con plazo
-- ══════════════════════════════════════════════════════════════════════════
j := public.agenda_crear_tarea(t_plazo, dep, sub, NULL, NULL, 'PRUEBA con plazo', NULL,
                               HOY, true, NULL, NULL, NULL, HOY + 41);
PERFORM pg_temp.chk('B1', 'crear una tarea con plazo de 42 días', 'true · ' || (HOY + 41)::text,
    (j->>'ok') || ' · ' || (j->'tarea'->>'fecha_hasta'));
PERFORM pg_temp.chk('B2', 'es todo el día y le quedan 41 días', 'true · 41',
    (j->'tarea'->>'todo_el_dia') || ' · ' || (j->'tarea'->>'dias_restantes'));
PERFORM pg_temp.chk('B3', 'hasta antes de desde', 'plazo_invalido',
    public.agenda_crear_tarea(gen_random_uuid(), dep, sub, NULL, NULL, 'PRUEBA al revés', NULL,
                              HOY, true, NULL, NULL, NULL, HOY - 1)->>'motivo');
PERFORM pg_temp.chk('B4', 'hasta igual que desde', 'plazo_invalido',
    public.agenda_crear_tarea(gen_random_uuid(), dep, sub, NULL, NULL, 'PRUEBA mismo día', NULL,
                              HOY, true, NULL, NULL, NULL, HOY)->>'motivo');
PERFORM pg_temp.chk('B5', 'un plazo de más de un año', 'plazo_invalido',
    public.agenda_crear_tarea(gen_random_uuid(), dep, sub, NULL, NULL, 'PRUEBA larguísima', NULL,
                              HOY, true, NULL, NULL, NULL, HOY + 400)->>'motivo');
PERFORM pg_temp.chk('B6', 'con plazo y horario: el horario se ignora, es todo el día',
    'true · true · null',
    (SELECT (x->>'ok') || ' · ' || (x->'tarea'->>'todo_el_dia') || ' · '
            || COALESCE(x->'tarea'->>'hora_desde', 'null')
       FROM (SELECT public.agenda_crear_tarea(gen_random_uuid(), dep, sub, NULL, NULL,
                        'PRUEBA plazo con hora', NULL, HOY, false, '09:00', '11:00', NULL, HOY + 10) x) q));


-- ══════════════════════════════════════════════════════════════════════════
-- C · agenda_repeticiones_posibles
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.chk('C1', 'plazo de 1 día (desde = hasta): no es un plazo', 'plazo_invalido',
    pg_temp.ops(HOY, HOY));
PERFORM pg_temp.chk('C2', 'plazo de 2 días: sólo todos los días', 'todos_los_dias:2',
    pg_temp.ops(HOY, HOY + 1));
PERFORM pg_temp.chk('C3', 'plazo de 3 días: se suma día por medio',
    'todos_los_dias:3 dia_por_medio:2', pg_temp.ops(HOY, HOY + 2));
PERFORM pg_temp.chk('C4', 'plazo de 8 días: se suma cada semana',
    'todos_los_dias:8 dia_por_medio:4 cada_semana:2', pg_temp.ops(HOY, HOY + 7));
PERFORM pg_temp.chk('C5', 'plazo de 7 días: cada semana TODAVÍA no entra dos veces',
    'todos_los_dias:7 dia_por_medio:4', pg_temp.ops(HOY, HOY + 6));
PERFORM pg_temp.chk('C6', 'plazo de 15 días: se suma semana por medio',
    'todos_los_dias:15 dia_por_medio:8 cada_semana:3 semana_por_medio:2',
    pg_temp.ops(HOY, HOY + 14));
PERFORM pg_temp.chk('C7', 'plazo de 14 días: semana por medio todavía no',
    'todos_los_dias:14 dia_por_medio:7 cada_semana:2', pg_temp.ops(HOY, HOY + 13));
-- Del 1/3 al 31/3 la segunda vez de "por mes" caería el 1/4, un día tarde:
-- por eso no se ofrece. Con un día más de plazo sí entra.
PERFORM pg_temp.chk('C8', 'plazo de 31 días desde el 1/3: por mes NO entra por un día',
    'todos_los_dias:31 dia_por_medio:16 cada_semana:5 semana_por_medio:3',
    pg_temp.ops(DATE '2027-03-01', DATE '2027-03-31'));
PERFORM pg_temp.chk('C8b', 'con 32 días, por mes entra dos veces (1/3 y 1/4)',
    'todos_los_dias:32 dia_por_medio:16 cada_semana:5 semana_por_medio:3 por_mes:2',
    pg_temp.ops(DATE '2027-03-01', DATE '2027-04-01'));
PERFORM pg_temp.chk('C9', 'plazo de 62 días desde el 1/3',
    'todos_los_dias:62 dia_por_medio:31 cada_semana:9 semana_por_medio:5 por_mes:3',
    pg_temp.ops(DATE '2027-03-01', DATE '2027-05-01'));
-- El caso del 31: febrero no tiene 31, y en marzo se vuelve al día original.
PERFORM pg_temp.chk('C10', 'del 31/1 al 31/5: por mes, cinco veces', 'por_mes:5',
    (SELECT (o->>'frecuencia') || ':' || (o->>'veces')
       FROM jsonb_array_elements(public.agenda_repeticiones_posibles(DATE '2027-01-31', DATE '2027-05-31')->'opciones') o
      WHERE o->>'frecuencia' = 'por_mes'));
PERFORM pg_temp.chk('C11', 'y esos días son 31/1, 28/2, 31/3, 30/4 y 31/5',
    '2027-01-31 2027-02-28 2027-03-31 2027-04-30 2027-05-31',
    (SELECT string_agg(f::text, ' ' ORDER BY f)
       FROM public.agenda_serie_fechas('por_mes', DATE '2027-01-31', DATE '2027-05-31') f));
PERFORM pg_temp.chk('C12', 'un año entero todos los días: 367 veces, y supera el tope',
    '367 · false · true',
    (SELECT (o->>'veces') || ' · ' || (o->>'disponible') || ' · ' || (o->>'supera_tope')
       FROM jsonb_array_elements(public.agenda_repeticiones_posibles(HOY, HOY + 366)->'opciones') o
      WHERE o->>'frecuencia' = 'todos_los_dias'));


-- ══════════════════════════════════════════════════════════════════════════
-- D · Crear cada frecuencia
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.limpiar();
j := public.agenda_crear_tarea(s_sem, dep, sub, NULL, NULL, 'PRUEBA cada semana', NULL,
                               HOY, true, NULL, NULL, NULL, HOY + 41, 'cada_semana');
PERFORM pg_temp.chk('D1', 'cada semana en 42 días: 6 repeticiones', 'true · 6 · 6',
    (j->>'ok') || ' · ' || (j->>'veces') || ' · '
    || (SELECT count(*) FROM public.agenda_tareas WHERE serie_id = s_sem));
PERFORM pg_temp.chk('D2', 'cada una es de un día, sin plazo, y numerada 1..6',
    '0 con plazo · 1,2,3,4,5,6',
    (SELECT count(*) FILTER (WHERE fecha_hasta IS NOT NULL) || ' con plazo · '
            || string_agg(numero_en_serie::text, ',' ORDER BY numero_en_serie)
       FROM public.agenda_tareas WHERE serie_id = s_sem));
PERFORM pg_temp.chk('D3', 'caen cada 7 días desde hoy', 'true',
    (SELECT (count(*) = 6 AND min(fecha) = HOY AND max(fecha) = HOY + 35)::text
       FROM public.agenda_tareas WHERE serie_id = s_sem));

j := public.agenda_crear_tarea(s_dia, dep, sub, NULL, NULL, 'PRUEBA día por medio', NULL,
                               HOY, false, '08:00', '09:30', NULL, HOY + 10, 'dia_por_medio');
PERFORM pg_temp.chk('D4', 'día por medio en 11 días: 6 repeticiones, todas con el mismo horario',
    'true · 6 · 6 con 08:00',
    (j->>'ok') || ' · ' || (j->>'veces') || ' · '
    || (SELECT count(*) FILTER (WHERE hora_desde = TIME '08:00') || ' con 08:00'
          FROM public.agenda_tareas WHERE serie_id = s_dia));

j := public.agenda_crear_tarea(s_mes, dep, sub, NULL, NULL, 'PRUEBA por mes', NULL,
                               DATE '2027-01-31', true, NULL, NULL, NULL, DATE '2027-05-31', 'por_mes');
PERFORM pg_temp.chk('D5', 'por mes del 31/1 al 31/5: 5 repeticiones en los días justos',
    'true · 31/01 28/02 31/03 30/04 31/05',
    (j->>'ok') || ' · ' || (SELECT string_agg(to_char(fecha, 'DD/MM'), ' ' ORDER BY fecha)
                              FROM public.agenda_tareas WHERE serie_id = s_mes));
PERFORM pg_temp.chk('D6', 'la serie guarda su plazo, su frecuencia y su horario',
    'cada_semana · ' || HOY::text || ' · ' || (HOY + 41)::text || ' · true',
    (SELECT frecuencia || ' · ' || desde || ' · ' || hasta || ' · ' || todo_el_dia
       FROM public.agenda_series WHERE id = s_sem));
PERFORM pg_temp.chk('D7', 'el detalle de una repetición dice cuál es de cuántas',
    'cada_semana · 1 · 6',
    (SELECT (x->'tarea'->'serie'->>'frecuencia') || ' · ' || (x->'tarea'->'serie'->>'numero')
            || ' · ' || (x->'tarea'->'serie'->>'total')
       FROM (SELECT public.agenda_tarea((SELECT id FROM public.agenda_tareas
                                          WHERE serie_id = s_sem ORDER BY fecha LIMIT 1)) x) q));

-- Opciones que no entran, y el tope.
PERFORM pg_temp.chk('D8', 'cada semana en un plazo de 7 días', 'repeticion_no_disponible',
    public.agenda_crear_tarea(gen_random_uuid(), dep, sub, NULL, NULL, 'PRUEBA no entra', NULL,
                              HOY, true, NULL, NULL, NULL, HOY + 6, 'cada_semana')->>'motivo');
PERFORM pg_temp.chk('D9', 'una frecuencia inventada', 'repeticion_no_disponible',
    public.agenda_crear_tarea(gen_random_uuid(), dep, sub, NULL, NULL, 'PRUEBA inventada', NULL,
                              HOY, true, NULL, NULL, NULL, HOY + 30, 'cada_jueves')->>'motivo');
PERFORM pg_temp.chk('D10', 'todos los días durante un año: más de 200', 'demasiadas_repeticiones',
    public.agenda_crear_tarea(gen_random_uuid(), dep, sub, NULL, NULL, 'PRUEBA 367', NULL,
                              HOY, true, NULL, NULL, NULL, HOY + 366, 'todos_los_dias')->>'motivo');
PERFORM pg_temp.chk('D11', 'una repetición sin plazo', 'plazo_invalido',
    public.agenda_crear_tarea(gen_random_uuid(), dep, sub, NULL, NULL, 'PRUEBA sin plazo', NULL,
                              HOY, true, NULL, NULL, NULL, NULL, 'cada_semana')->>'motivo');


-- ══════════════════════════════════════════════════════════════════════════
-- E · Un solo aviso por serie
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.limpiar();
j := public.agenda_crear_tarea(s_rea, dep, sub, NULL, NULL, 'PRUEBA avisos', NULL,
                               HOY, true, NULL, NULL, NULL, HOY + 41, 'cada_semana');
PERFORM pg_temp.chk('E1', 'una serie de 6 avisa UNA vez a cada persona del equipo, no 6',
    '2', pg_temp.cuantos('agenda_tarea_asignada')::text);
PERFORM pg_temp.chk('E2', 'y el aviso dice la frecuencia, el plazo y cuántas veces',
    'Nueva tarea: PRUEBA avisos § PRUEBA Equipo Uno · cada semana, del '
    || public.agenda_fecha_dm(HOY) || ' al ' || public.agenda_fecha_dm(HOY + 41)
    || ' · 6 veces · Todo el día',
    pg_temp.avisos(lalo, 'agenda_tarea_asignada'));
PERFORM pg_temp.chk('E3', 'le llega a quien dirige y al miembro; a la encargada no', 'sí · sí · no',
    CASE WHEN pg_temp.avisos(lalo, 'agenda_tarea_asignada') <> '(ninguno)' THEN 'sí' ELSE 'no' END
    || ' · ' || CASE WHEN pg_temp.avisos(mina, 'agenda_tarea_asignada') <> '(ninguno)' THEN 'sí' ELSE 'no' END
    || ' · ' || CASE WHEN pg_temp.avisos(elsa, 'agenda_tarea_asignada') <> '(ninguno)' THEN 'sí' ELSE 'no' END);

-- Una con plazo: el aviso de siempre, con el plazo adentro.
PERFORM pg_temp.limpiar();
PERFORM public.agenda_crear_tarea(gen_random_uuid(), dep, sub, NULL, NULL, 'PRUEBA el plazo', NULL,
                                  HOY, true, NULL, NULL, NULL, HOY + 41);
PERFORM pg_temp.chk('E4', 'una tarea con plazo avisa una vez, diciendo el plazo',
    'Nueva tarea: PRUEBA el plazo § PRUEBA Equipo Uno · del '
    || public.agenda_fecha_dm(HOY) || ' al ' || public.agenda_fecha_dm(HOY + 41) || ' · Todo el día',
    pg_temp.avisos(lalo, 'agenda_tarea_asignada'));

-- Completar una repetición: el push de siempre a la encargada. Email no hay
-- ninguno en Agenda desde el 28/10 (sql/agenda_avisos_sin_email.sql).
PERFORM pg_temp.limpiar();
SELECT id INTO v_id FROM public.agenda_tareas WHERE serie_id = s_rea ORDER BY fecha LIMIT 1;
PERFORM pg_temp.sesion(mina);
PERFORM public.agenda_cambiar_estado_tarea(v_id, 'completada');
PERFORM pg_temp.chk('E5', 'completar una repetición avisa a la encargada', 'sí',
    CASE WHEN pg_temp.avisos(elsa, 'agenda_tarea_completada') <> '(ninguno)' THEN 'sí' ELSE 'no' END);
PERFORM pg_temp.chk('E6', 'y ese aviso NO tiene canal email: en Agenda ya no existen',
    '0 email · 1 app',
    (SELECT count(*) FILTER (WHERE canal = 'email') || ' email · '
            || count(*) FILTER (WHERE canal = 'app') || ' app'
       FROM public.agenda_avisos WHERE tarea_id = v_id AND tipo = 'completada'));
PERFORM pg_temp.sesion(elsa);


-- ══════════════════════════════════════════════════════════════════════════
-- F · Editar una serie
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.limpiar();
PERFORM public.agenda_crear_tarea(s_edit, dep, sub, NULL, NULL, 'PRUEBA editar', NULL,
                                  HOY, true, NULL, NULL, NULL, HOY + 41, 'cada_semana');
-- La primera se completa: a partir de acá no se toca nunca más.
SELECT id INTO v_id FROM public.agenda_tareas WHERE serie_id = s_edit ORDER BY fecha LIMIT 1;
PERFORM public.agenda_cambiar_estado_tarea(v_id, 'completada');

-- "Solo esta" sobre la segunda.
SELECT id INTO v_id FROM public.agenda_tareas WHERE serie_id = s_edit ORDER BY fecha OFFSET 1 LIMIT 1;
j := public.agenda_editar_tarea(v_id, sub, NULL, NULL, 'PRUEBA editar SOLO ESTA', NULL,
                                HOY + 7, true, NULL, NULL);
PERFORM pg_temp.chk('F1', 'editar "solo esta" cambia una sola repetición', 'true · 1 · 5',
    (j->>'ok') || ' · '
    || (SELECT count(*) FROM public.agenda_tareas WHERE serie_id = s_edit AND nombre = 'PRUEBA editar SOLO ESTA')
    || ' · ' || (SELECT count(*) FROM public.agenda_tareas WHERE serie_id = s_edit AND nombre = 'PRUEBA editar'));

-- "Todas las que faltan".
SELECT id INTO v_id FROM public.agenda_tareas WHERE serie_id = s_edit ORDER BY fecha OFFSET 2 LIMIT 1;
j := public.agenda_editar_tarea(v_id, sub2, NULL, NULL, 'PRUEBA editar TODAS', NULL,
                                HOY + 14, true, NULL, NULL, NULL, NULL, 'las_que_faltan');
PERFORM pg_temp.chk('F2', 'editar "todas las que faltan" cambia las 5 pendientes', 'true · 5',
    (j->>'ok') || ' · '
    || (SELECT count(*) FROM public.agenda_tareas WHERE serie_id = s_edit AND nombre = 'PRUEBA editar TODAS'));
PERFORM pg_temp.chk('F3', 'y NO toca la completada: su nombre y su equipo quedan',
    'PRUEBA editar · completada · ' || sub::text,
    (SELECT nombre || ' · ' || estado || ' · ' || subdepartamento_id
       FROM public.agenda_tareas WHERE serie_id = s_edit AND estado = 'completada'));
PERFORM pg_temp.chk('F4', 'las pendientes quedaron con el equipo nuevo', '5',
    (SELECT count(*)::text FROM public.agenda_tareas
      WHERE serie_id = s_edit AND subdepartamento_id = sub2)::text);

-- Cambiar el plazo y la frecuencia: se recalculan las que faltan.
SELECT id INTO v_id FROM public.agenda_tareas
 WHERE serie_id = s_edit AND estado <> 'completada' ORDER BY fecha LIMIT 1;
j := public.agenda_editar_tarea(v_id, sub2, NULL, NULL, 'PRUEBA editar TODAS', NULL,
                                HOY, true, NULL, NULL, HOY + 20, 'semana_por_medio', 'las_que_faltan');
PERFORM pg_temp.chk('F5', 'cambiar a semana por medio en 21 días recalcula las que faltan',
    'true · semana_por_medio · ' || (HOY + 20)::text,
    (j->>'ok') || ' · ' || (j->'serie'->>'frecuencia') || ' · ' || (j->'serie'->>'hasta'));
PERFORM pg_temp.chk('F6', 'la completada de hoy sigue, y las nuevas caen a los 14 y 21 días',
    to_char(HOY, 'DD/MM') || ':completada ' || to_char(HOY + 14, 'DD/MM') || ':en_proceso',
    pg_temp.serie(s_edit));
PERFORM pg_temp.chk('F7', 'y los números vuelven a ir 1..N', '1,2',
    (SELECT string_agg(numero_en_serie::text, ',' ORDER BY numero_en_serie)
       FROM public.agenda_tareas WHERE serie_id = s_edit));
PERFORM pg_temp.chk('F8', '"todas las que faltan" sobre algo que no es una serie', 'alcance_invalido',
    public.agenda_editar_tarea(t_plazo, sub, NULL, NULL, 'PRUEBA con plazo', NULL,
                               HOY, true, NULL, NULL, NULL, NULL, 'las_que_faltan')->>'motivo');
PERFORM pg_temp.chk('F9', 'una tarea suelta no se convierte en serie editándola', 'serie_invalida',
    public.agenda_editar_tarea(t_plazo, sub, NULL, NULL, 'PRUEBA con plazo', NULL,
                               HOY, true, NULL, NULL, HOY + 30, 'cada_semana')->>'motivo');
PERFORM pg_temp.chk('F10', 'editar una tarea con plazo le cambia el plazo', 'true · ' || (HOY + 60)::text,
    (SELECT (x->>'ok') || ' · ' || (x->'tarea'->>'fecha_hasta')
       FROM (SELECT public.agenda_editar_tarea(t_plazo, sub, NULL, NULL, 'PRUEBA con plazo', NULL,
                                               HOY, true, NULL, NULL, HOY + 60) x) q));


-- ══════════════════════════════════════════════════════════════════════════
-- G · Eliminar y reasignar una serie
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.limpiar();
PERFORM public.agenda_crear_tarea(s_borr, dep, sub, NULL, NULL, 'PRUEBA borrar', NULL,
                                  HOY, true, NULL, NULL, NULL, HOY + 41, 'cada_semana');
SELECT id INTO v_id FROM public.agenda_tareas WHERE serie_id = s_borr ORDER BY fecha LIMIT 1;
PERFORM public.agenda_cambiar_estado_tarea(v_id, 'completada');

SELECT id INTO v_id FROM public.agenda_tareas WHERE serie_id = s_borr ORDER BY fecha OFFSET 1 LIMIT 1;
j := public.agenda_eliminar_tarea(v_id);
PERFORM pg_temp.chk('G1', 'eliminar "solo esta" borra una sola', 'true · 1 · 5',
    (j->>'ok') || ' · ' || (j->>'eliminadas') || ' · '
    || (SELECT count(*) FROM public.agenda_tareas WHERE serie_id = s_borr));

SELECT id INTO v_id FROM public.agenda_tareas
 WHERE serie_id = s_borr AND estado <> 'completada' ORDER BY fecha LIMIT 1;
j := public.agenda_eliminar_tarea(v_id, 'las_que_faltan');
PERFORM pg_temp.chk('G2', 'eliminar "todas las que faltan" borra las 4 pendientes', 'true · 4',
    (j->>'ok') || ' · ' || (j->>'eliminadas'));
PERFORM pg_temp.chk('G3', 'y deja sólo la completada', to_char(HOY, 'DD/MM') || ':completada',
    pg_temp.serie(s_borr));
PERFORM pg_temp.chk('G4', 'la serie sigue existiendo porque todavía tiene una', '1',
    (SELECT count(*)::text FROM public.agenda_series WHERE id = s_borr));
PERFORM pg_temp.chk('G5', 'y ya no quedan pendientes que borrar', 'serie_completada',
    public.agenda_eliminar_tarea((SELECT id FROM public.agenda_tareas WHERE serie_id = s_borr LIMIT 1),
                                 'las_que_faltan')->>'motivo');

-- Reasignar toda la serie.
PERFORM pg_temp.limpiar();
SELECT id INTO v_id FROM public.agenda_tareas
 WHERE serie_id = s_rea AND estado <> 'completada' ORDER BY fecha LIMIT 1;
j := public.agenda_reasignar_tarea(v_id, sub2, 'las_que_faltan');
PERFORM pg_temp.chk('G6', 'reasignar "todas las que faltan" mueve las 5 pendientes', 'true · 5',
    (j->>'ok') || ' · ' || (j->>'reasignadas'));
PERFORM pg_temp.chk('G7', 'la completada se queda con el equipo que la hizo', '1',
    (SELECT count(*)::text FROM public.agenda_tareas
      WHERE serie_id = s_rea AND estado = 'completada' AND subdepartamento_id = sub));
PERFORM pg_temp.chk('G8', 'y avisa UNA vez, no cinco', '2',
    pg_temp.cuantos('agenda_tarea_asignada')::text);


-- ══════════════════════════════════════════════════════════════════════════
-- H · Superposición con el rango, y vencidas
-- ══════════════════════════════════════════════════════════════════════════
-- t_plazo va de hoy a hoy+60. Se pide una semana de adentro del plazo, que no
-- incluye el día en que empieza.
PERFORM pg_temp.chk('H1', 'la ve agenda_tareas_departamento aunque empiece antes del rango', 'sí',
    pg_temp.hay(public.agenda_tareas_departamento(dep, HOY + 20, HOY + 26), t_plazo));
PERFORM pg_temp.chk('H2', 'la ve agenda_tareas_subdepartamento', 'sí',
    pg_temp.hay(public.agenda_tareas_subdepartamento(sub, HOY + 20, HOY + 26), t_plazo));
PERFORM pg_temp.sesion(mina);
PERFORM pg_temp.chk('H3', 'y la ve agenda_mis_tareas', 'sí',
    pg_temp.hay(public.agenda_mis_tareas(HOY + 20, HOY + 26), t_plazo));
PERFORM pg_temp.sesion(elsa);
PERFORM pg_temp.chk('H4', 'fuera del plazo no aparece', 'no',
    pg_temp.hay(public.agenda_tareas_departamento(dep, HOY + 90, HOY + 95), t_plazo));
PERFORM pg_temp.chk('H5', 'el tope de 100 días de mis tareas es del rango, no del plazo',
    'rango_grande', public.agenda_mis_tareas(HOY, HOY + 101)->>'motivo');

-- Vencidas.
UPDATE public.agenda_tareas SET fecha = HOY - 50, fecha_hasta = HOY - 1 WHERE id = t_plazo;
PERFORM pg_temp.chk('H6', 'una tarea con plazo sin completar, con el plazo vencido ayer',
    'true · -1', (SELECT (x->'tarea'->>'vencida') || ' · ' || (x->'tarea'->>'dias_restantes')
                    FROM (SELECT public.agenda_tarea(t_plazo) x) q));
UPDATE public.agenda_tareas SET fecha_hasta = HOY WHERE id = t_plazo;
PERFORM pg_temp.chk('H7', 'el último día del plazo todavía no está vencida', 'false',
    public.agenda_tarea(t_plazo)->'tarea'->>'vencida');
UPDATE public.agenda_tareas SET fecha_hasta = HOY - 1 WHERE id = t_plazo;
-- Una repetición de ayer sin completar también está vencida.
SELECT id INTO v_id FROM public.agenda_tareas WHERE serie_id = s_sem ORDER BY fecha LIMIT 1;
UPDATE public.agenda_tareas SET fecha = HOY - 1 WHERE id = v_id;
PERFORM pg_temp.chk('H8', 'una repetición de ayer sin completar está vencida', 'true',
    public.agenda_tarea(v_id)->'tarea'->>'vencida');
PERFORM public.agenda_cambiar_estado_tarea(v_id, 'completada');
PERFORM pg_temp.chk('H9', 'completada deja de estar vencida', 'false',
    public.agenda_tarea(v_id)->'tarea'->>'vencida');


-- ══════════════════════════════════════════════════════════════════════════
-- I · El aviso de plazo vencido y su cron
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.limpiar();
DELETE FROM public.agenda_plazos_avisados;
v_n := public.agenda_plazos_vencidos_tick();
PERFORM pg_temp.chk('I1', 'el tick avisa de la tarea con plazo vencida', '1', v_n::text);
PERFORM pg_temp.chk('I2', 'y el aviso dice qué venció y cuándo',
    'Venció un plazo § «PRUEBA con plazo» de PRUEBA Equipo Uno venció el '
    || public.agenda_fecha_dm(HOY - 1) || ' sin completarse.',
    pg_temp.avisos(elsa, 'agenda_plazo_vencido'));
PERFORM pg_temp.chk('I3', 'le llega sólo a la encargada: ni al equipo ni a nadie de afuera',
    '1 · (ninguno) · (ninguno) · (ninguno)',
    pg_temp.cuantos('agenda_plazo_vencido')::text
    || ' · ' || pg_temp.avisos(lalo, 'agenda_plazo_vencido')
    || ' · ' || pg_temp.avisos(mina, 'agenda_plazo_vencido')
    || ' · ' || pg_temp.avisos(otto, 'agenda_plazo_vencido'));
PERFORM pg_temp.chk('I4', 'correrlo de nuevo no vuelve a avisar', '0 · 1',
    public.agenda_plazos_vencidos_tick()::text || ' · ' || pg_temp.cuantos('agenda_plazo_vencido')::text);
PERFORM pg_temp.chk('I5', 'las repeticiones vencidas NO avisan', '0',
    (SELECT count(*)::text FROM public.agenda_plazos_avisados a
       JOIN public.agenda_tareas t ON t.id = a.tarea_id WHERE t.serie_id IS NOT NULL));

-- Cambiar el plazo y volver a vencer: avisa de nuevo.
UPDATE public.agenda_tareas SET fecha_hasta = HOY - 2 WHERE id = t_plazo;
PERFORM pg_temp.chk('I6', 'se le cambia el plazo y vuelve a vencer: avisa otra vez', '1 · 2',
    public.agenda_plazos_vencidos_tick()::text || ' · ' || pg_temp.cuantos('agenda_plazo_vencido')::text);

-- Completarla no manda nada nuevo del plazo.
PERFORM pg_temp.limpiar();
DELETE FROM public.agenda_plazos_avisados;
-- La completa Mina, del equipo: el aviso de completada va a los encargados
-- MENOS quien la completó, así que si la cerrara Elsa no le llegaría a nadie.
PERFORM pg_temp.sesion(mina);
PERFORM public.agenda_cambiar_estado_tarea(t_plazo, 'completada');
PERFORM pg_temp.sesion(elsa);
PERFORM pg_temp.chk('I7', 'completarla después de vencida no manda ningún aviso de plazo', '0',
    public.agenda_plazos_vencidos_tick()::text);
PERFORM pg_temp.chk('I8', 'pero sí el de completada, el de siempre', 'sí',
    CASE WHEN pg_temp.avisos(elsa, 'agenda_tarea_completada') <> '(ninguno)' THEN 'sí' ELSE 'no' END);

PERFORM pg_temp.chk('I9', 'el cron está creado, activo y a las 9:00 de Argentina',
    '0 12 * * * · true',
    (SELECT schedule || ' · ' || active FROM cron.job WHERE jobname = 'agenda-plazos-vencidos'));
PERFORM pg_temp.chk('I10', 'la alerta está en el catálogo, es de Agenda y se puede apagar',
    'automatica · Agenda · sí · warning',
    (SELECT tipo || ' · ' || area || ' · ' || CASE WHEN permite_apagar THEN 'sí' ELSE 'no' END
            || ' · ' || type_legacy FROM public.notif_alertas WHERE clave = 'agenda_plazo_vencido'));


-- ══════════════════════════════════════════════════════════════════════════
-- J · Permisos: nada nuevo abierto
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.sesion(otto);
PERFORM pg_temp.chk('J1', 'el encargado de otro departamento no crea acá', 'sin_permiso',
    public.agenda_crear_tarea(gen_random_uuid(), dep, sub, NULL, NULL, 'PRUEBA intrusa', NULL,
                              HOY, true, NULL, NULL, NULL, HOY + 30, 'cada_semana')->>'motivo');
PERFORM pg_temp.chk('J2', 'ni edita una serie ajena', 'sin_permiso',
    public.agenda_editar_tarea((SELECT id FROM public.agenda_tareas WHERE serie_id = s_sem LIMIT 1),
                               sub, NULL, NULL, 'PRUEBA intrusa', NULL, HOY, true, NULL, NULL,
                               NULL, NULL, 'las_que_faltan')->>'motivo');
PERFORM pg_temp.chk('J3', 'ni la elimina', 'sin_permiso',
    public.agenda_eliminar_tarea((SELECT id FROM public.agenda_tareas WHERE serie_id = s_sem LIMIT 1),
                                 'las_que_faltan')->>'motivo');
PERFORM pg_temp.chk('J4', 'ni la reasigna', 'sin_permiso',
    public.agenda_reasignar_tarea((SELECT id FROM public.agenda_tareas WHERE serie_id = s_sem LIMIT 1),
                                  sub, 'las_que_faltan')->>'motivo');
PERFORM pg_temp.sesion(nora);
PERFORM pg_temp.chk('J5', 'alguien sin nada que ver no ve ninguna tarea del departamento', '0',
    (SELECT jsonb_array_length(public.agenda_mis_tareas(HOY - 60, HOY + 40)->'tareas')::text));
PERFORM pg_temp.chk('J6', 'ni abre el detalle', 'sin_permiso',
    public.agenda_tarea((SELECT id FROM public.agenda_tareas WHERE serie_id = s_sem LIMIT 1))->>'motivo');
PERFORM pg_temp.sesion(NULL);
PERFORM pg_temp.chk('J7', 'sin sesión, nada', 'sin_sesion · sin_sesion · sin_sesion',
    COALESCE(public.agenda_crear_tarea(gen_random_uuid(), dep, sub, NULL, NULL, 'X', NULL,
                                       HOY, true, NULL, NULL, NULL, HOY + 30)->>'motivo', '?')
    || ' · ' || COALESCE(public.agenda_eliminar_tarea(t_dia, 'las_que_faltan')->>'motivo', '?')
    || ' · ' || COALESCE(public.agenda_mis_tareas(HOY, HOY + 7)->>'motivo', '?'));

-- Las tablas nuevas, cerradas como las demás.
PERFORM pg_temp.chk('J8', 'agenda_series y agenda_plazos_avisados: sin acceso de afuera', 'no',
    CASE WHEN has_table_privilege('anon', 'public.agenda_series', 'SELECT')
           OR has_table_privilege('authenticated', 'public.agenda_series', 'SELECT')
           OR has_table_privilege('authenticated', 'public.agenda_series', 'UPDATE')
           OR has_table_privilege('anon', 'public.agenda_plazos_avisados', 'SELECT')
           OR has_table_privilege('authenticated', 'public.agenda_plazos_avisados', 'SELECT')
         THEN 'sí' ELSE 'no' END);
PERFORM pg_temp.chk('J9', 'las dos tienen RLS', 'true · true',
    (SELECT relrowsecurity::text FROM pg_class WHERE oid = 'public.agenda_series'::regclass)
    || ' · ' || (SELECT relrowsecurity::text FROM pg_class WHERE oid = 'public.agenda_plazos_avisados'::regclass));
PERFORM pg_temp.chk('J10', 'las piezas internas no las ejecuta nadie de afuera', 'no · no · no',
    CASE WHEN has_function_privilege('authenticated', 'public.agenda_serie_fechas(text,date,date)', 'EXECUTE') THEN 'SÍ' ELSE 'no' END
    || ' · ' || CASE WHEN has_function_privilege('authenticated', 'public.agenda_plazos_vencidos_tick(timestamptz)', 'EXECUTE') THEN 'SÍ' ELSE 'no' END
    || ' · ' || CASE WHEN has_function_privilege('authenticated', 'public.agenda_avisar_serie(uuid)', 'EXECUTE') THEN 'SÍ' ELSE 'no' END);
PERFORM pg_temp.chk('J11', 'pero el formulario sí puede preguntar qué repeticiones entran', 'sí · no',
    CASE WHEN has_function_privilege('authenticated', 'public.agenda_repeticiones_posibles(date,date)', 'EXECUTE') THEN 'sí' ELSE 'NO' END
    || ' · ' || CASE WHEN has_function_privilege('anon', 'public.agenda_repeticiones_posibles(date,date)', 'EXECUTE') THEN 'SÍ' ELSE 'no' END);
PERFORM pg_temp.chk('J12', 'las cuatro RPC de tareas siguen abiertas sólo a authenticated',
    'sí sí sí sí · no no no no',
    (SELECT string_agg(CASE WHEN has_function_privilege('authenticated', f, 'EXECUTE') THEN 'sí' ELSE 'NO' END, ' ')
       FROM unnest(ARRAY[
           'public.agenda_crear_tarea(uuid,uuid,uuid,uuid,uuid,text,text,date,boolean,time,time,uuid,date,text)',
           'public.agenda_editar_tarea(uuid,uuid,uuid,uuid,text,text,date,boolean,time,time,date,text,text)',
           'public.agenda_eliminar_tarea(uuid,text)',
           'public.agenda_reasignar_tarea(uuid,uuid,text)']) f)
    || ' · ' ||
    (SELECT string_agg(CASE WHEN has_function_privilege('anon', f, 'EXECUTE') THEN 'SÍ' ELSE 'no' END, ' ')
       FROM unnest(ARRAY[
           'public.agenda_crear_tarea(uuid,uuid,uuid,uuid,uuid,text,text,date,boolean,time,time,uuid,date,text)',
           'public.agenda_editar_tarea(uuid,uuid,uuid,uuid,text,text,date,boolean,time,time,date,text,text)',
           'public.agenda_eliminar_tarea(uuid,text)',
           'public.agenda_reasignar_tarea(uuid,uuid,text)']) f));


-- ══════════════════════════════════════════════════════════════════════════
-- El reporte
-- ══════════════════════════════════════════════════════════════════════════
SELECT count(*) INTO v_fallos FROM r WHERE esperado IS DISTINCT FROM obtenido;
SELECT string_agg(format('| %s | %s | %s | %s | %s |',
            n, caso, esperado,
            CASE WHEN esperado IS NOT DISTINCT FROM obtenido THEN 'igual' ELSE COALESCE(obtenido, '(nada)') END,
            CASE WHEN esperado IS NOT DISTINCT FROM obtenido THEN '✅' ELSE '❌' END),
       E'\n' ORDER BY orden)
  INTO v_salida FROM r;

RAISE EXCEPTION E'RESULTADO % %/%\n%',
    CASE WHEN v_fallos = 0 THEN '✅' ELSE '❌' END,
    (SELECT count(*) FROM r) - v_fallos, (SELECT count(*) FROM r), v_salida;
END;
$suite$;

ROLLBACK;
