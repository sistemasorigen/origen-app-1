-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de sql/notif_programadas.sql
--
-- BEGIN … ROLLBACK, y el final es un RAISE EXCEPTION a propósito: se deshace
-- TODO, incluida la cola de pg_net (net.http_request_queue). NO SALE NI UN
-- PUSH. Las programadas de prueba van a personas de prueba, salvo la de
-- "todos", que crea avisos para todas las cuentas activas DENTRO de la
-- transacción y se van con el ROLLBACK. NUNCA COMMIT.
--
-- El reloj se prueba con p_ahora fijo en noviembre/diciembre de 2026, así que
-- no depende de la hora a la que se corra.
--
-- QUÉ PRUEBA
--   C · Alta, edición, pausa y baja (y audit_logs).
--   V · Validaciones de notif_guardar_programada (y el CHECK de la tabla).
--   P · Permisos: sólo SUPER_ADMIN; anon y authenticated sin EXECUTE de más.
--   A · Audiencia: todos, roles (role y roles[]), personas, inactivas, sin
--       repetidos, y que la estimación sea lo que de verdad se emite.
--   R · El reloj: cada 7 días, la hora justa, sin repetir, atrasados del día,
--       los de ayer no, hasta vencido, siempre activa, pausada, reloj_desde,
--       próximo envío y el alcance en texto.
--   L · El lote: un solo pedido, el trigger no pide por fila, la cola, tomar
--       con reserva, el tope de 5000, relanzar un lote trabado, las reglas de
--       envío sobre los avisos de una programada.
--   E · El estado: trigger, crons.
--
-- Personas: Eva (SUPER_ADMIN, con dispositivo), Ana (role ADMIN_STORE, con
-- dispositivo), Beto (role VIEWER + roles[] REPORTES), Caro (role ADMIN_STORE
-- + roles[] ADMIN_STORE y REPORTES), Dani (VIEWER), Ina (ADMIN_STORE,
-- INACTIVA). ADMIN_STORE y REPORTES están en el enum y hoy no los tiene
-- nadie: así los conteos por rol no dependen de las cuentas reales.
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

-- Cuántos pedidos HTTP hay en la cola de pg_net (transaccional: el ROLLBACK
-- se los lleva).
CREATE FUNCTION pg_temp.pedidos() RETURNS integer LANGUAGE sql AS $f$
    SELECT count(*)::int FROM net.http_request_queue;
$f$;

-- Un instante en hora argentina: '2026-11-01 10:05'.
CREATE FUNCTION pg_temp.ar(p text) RETURNS timestamptz LANGUAGE sql AS $f$
    SELECT (p::timestamp) AT TIME ZONE 'America/Argentina/Buenos_Aires';
$f$;

-- Una programada con lo mínimo; el resto, por parámetro.
CREATE FUNCTION pg_temp.prog(
    p_id uuid, p_desde date, p_hasta date, p_cada integer, p_horas time[],
    p_todos boolean, p_roles text[], p_users uuid[],
    p_activa boolean DEFAULT true, p_titulo text DEFAULT 'Nos vemos hoy',
    p_mensaje text DEFAULT 'Te esperamos a las 19 en el auditorio.', p_url text DEFAULT '/eventos',
    p_nombre text DEFAULT 'Programada PRUEBA'
) RETURNS jsonb LANGUAGE sql AS $f$
    SELECT public.notif_guardar_programada(
        p_id, p_nombre, p_titulo, p_mensaje, p_url,
        p_hasta IS NULL, p_desde, p_hasta, p_cada, p_horas,
        p_todos, p_roles, p_users, false, NULL, NULL, NULL, p_activa);
$f$;

-- Cuántos horarios salieron de una programada (opcionalmente, de un día).
CREATE FUNCTION pg_temp.hechas(p uuid, p_fecha date DEFAULT NULL) RETURNS integer LANGUAGE sql AS $f$
    SELECT count(*)::int FROM public.notif_programadas_hechas
     WHERE alerta_id = p AND (p_fecha IS NULL OR fecha = p_fecha) AND resultado = 'emitida';
$f$;

-- Los avisos que creó una programada.
CREATE FUNCTION pg_temp.avisos(p uuid) RETURNS integer LANGUAGE sql AS $f$
    SELECT count(*)::int FROM public.app_notifications n
      JOIN public.notif_alertas a ON a.clave = n.alerta_clave
     WHERE a.id = p;
$f$;


DO $suite$
DECLARE
    ZONA constant text := 'America/Argentina/Buenos_Aires';
    eva  uuid := gen_random_uuid();
    ana  uuid := gen_random_uuid();
    beto uuid := gen_random_uuid();
    caro uuid := gen_random_uuid();
    dani uuid := gen_random_uuid();
    ina  uuid := gen_random_uuid();
    -- Las programadas de prueba.
    p_crud   uuid := gen_random_uuid();
    p_sem    uuid := gen_random_uuid();   -- cada 7 días desde un domingo
    p_dos    uuid := gen_random_uuid();   -- todos los días, dos horarios, siempre
    p_ayer   uuid := gen_random_uuid();
    p_vence  uuid := gen_random_uuid();
    p_pausa  uuid := gen_random_uuid();
    p_reloj  uuid := gen_random_uuid();
    p_gracia uuid := gen_random_uuid();
    p_mix    uuid := gen_random_uuid();   -- rol + personas
    p_todos  uuid := gen_random_uuid();
    p_lote   uuid := gen_random_uuid();
    p_tope   uuid := gen_random_uuid();
    p_traba  uuid := gen_random_uuid();
    p_nadie  uuid := gen_random_uuid();
    p_reglas uuid := gen_random_uuid();
    v_auto   uuid;
    v_j      jsonb;
    v_t      text;
    v_n      integer;
    v_m      integer;
    v_envio  uuid;
    v_ids    jsonb;
    v_id1    uuid;
    v_id2    uuid;
    v_av     uuid;
    v_fallos integer;
    v_salida text;
BEGIN
-- ══════════════════════════════════════════════════════════════════════════
-- Fixture
-- ══════════════════════════════════════════════════════════════════════════
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
SELECT x, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'prueba.prog.' || left(x::text, 8) || '@test.local', '', now(), now()
  FROM unnest(ARRAY[eva, ana, beto, caro, dani, ina]) x;

INSERT INTO public.users (id, name, email, role, roles, is_active) VALUES
    (eva,  'Eva PRUEBA',  'prueba.prog.eva@test.local',  'SUPER_ADMIN', ARRAY['SUPER_ADMIN'], true),
    (ana,  'Ana PRUEBA',  'prueba.prog.ana@test.local',  'ADMIN_STORE', ARRAY['VIEWER'], true),
    (beto, 'Beto PRUEBA', 'prueba.prog.beto@test.local', 'VIEWER',      ARRAY['REPORTES'], true),
    (caro, 'Caro PRUEBA', 'prueba.prog.caro@test.local', 'ADMIN_STORE', ARRAY['ADMIN_STORE', 'REPORTES'], true),
    (dani, 'Dani PRUEBA', 'prueba.prog.dani@test.local', 'VIEWER',      ARRAY['VIEWER'], true),
    (ina,  'Ina PRUEBA',  'prueba.prog.ina@test.local',  'ADMIN_STORE', ARRAY['ADMIN_STORE'], false)
-- handle_new_user ya creó la fila y la deja inactiva: se pisa a mano.
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role,
                              roles = EXCLUDED.roles, is_active = EXCLUDED.is_active;

INSERT INTO public.push_suscripciones (user_id, endpoint, p256dh, auth, plataforma, navegador) VALUES
    (eva, 'https://ejemplo.prueba/prog/eva', 'p256dh-PRUEBA', 'auth-PRUEBA', 'ios', 'PRUEBA'),
    (ana, 'https://ejemplo.prueba/prog/ana', 'p256dh-PRUEBA', 'auth-PRUEBA', 'android', 'PRUEBA');

SELECT id INTO v_auto FROM public.notif_alertas WHERE clave = 'gcx_asistencia_guardada';

PERFORM pg_temp.sesion(eva);


-- ══════════════════════════════════════════════════════════════════════════
-- C · Alta, edición, pausa y baja
-- ══════════════════════════════════════════════════════════════════════════
v_j := pg_temp.prog(p_crud, '2026-11-01', NULL, 1, ARRAY['10:00']::time[], false, NULL, ARRAY[dani]);
PERFORM pg_temp.chk('C1', 'crear una programada', 'ok, creada', CASE WHEN (v_j->>'ok')::boolean AND (v_j->>'creada')::boolean THEN 'ok, creada' ELSE v_j::text END);

v_j := pg_temp.prog(p_crud, '2026-11-01', NULL, 1, ARRAY['10:00']::time[], false, NULL, ARRAY[dani]);
SELECT count(*) INTO v_n FROM public.notif_alertas WHERE id = p_crud;
PERFORM pg_temp.chk('C2', 'crear dos veces con el mismo id', 'ok · 1 fila', CASE WHEN (v_j->>'ok')::boolean THEN 'ok' ELSE v_j::text END || ' · ' || v_n || ' fila');

SELECT clave INTO v_t FROM public.notif_alertas WHERE id = p_crud;
PERFORM pg_temp.chk('C3', 'la clave se genera sola', 'prog_ + 12', CASE WHEN v_t ~ '^prog_[a-f0-9]{12}$' THEN 'prog_ + 12' ELSE v_t END);

v_j := pg_temp.prog(p_crud, '2026-11-01', NULL, 1, ARRAY['10:00']::time[], false, NULL, ARRAY[dani], true, 'Título editado');
PERFORM pg_temp.chk('C4', 'editar cambia el texto y no la clave', 'Título editado · misma clave',
    (SELECT titulo_plantilla || CASE WHEN clave = v_t THEN ' · misma clave' ELSE ' · OTRA clave' END FROM public.notif_alertas WHERE id = p_crud));

v_j := public.notif_cambiar_estado(p_crud, false);
PERFORM pg_temp.chk('C5', 'pausar', 'pausada', (SELECT CASE WHEN activa THEN 'activa' ELSE 'pausada' END FROM public.notif_alertas WHERE id = p_crud));

v_j := public.notif_cambiar_estado(p_crud, true);
PERFORM pg_temp.chk('C6', 'activar de nuevo', 'activa', (SELECT CASE WHEN activa THEN 'activa' ELSE 'pausada' END FROM public.notif_alertas WHERE id = p_crud));

v_j := public.notif_eliminar_programada(p_crud);
PERFORM pg_temp.chk('C7', 'eliminar: baja lógica y pausada', 'ok · fila queda · pausada',
    CASE WHEN (v_j->>'ok')::boolean THEN 'ok' ELSE v_j::text END
    || (SELECT ' · fila queda' || CASE WHEN activa THEN ' · ACTIVA' ELSE ' · pausada' END
          FROM public.notif_alertas WHERE id = p_crud AND eliminada_at IS NOT NULL AND eliminada_por = eva));

v_j := public.notif_alertas_admin();
PERFORM pg_temp.chk('C8', 'la eliminada no aparece en la lista del admin', 'no aparece',
    CASE WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(v_j->'alertas') x WHERE x->>'id' = p_crud::text)
         THEN 'APARECE' ELSE 'no aparece' END);

PERFORM pg_temp.chk('C9', 'eliminar dos veces', 'no_existe', public.notif_eliminar_programada(p_crud)->>'motivo');
PERFORM pg_temp.chk('C10', 'guardar sobre una eliminada', 'eliminada',
    pg_temp.prog(p_crud, '2026-11-01', NULL, 1, ARRAY['10:00']::time[], false, NULL, ARRAY[dani])->>'motivo');
PERFORM pg_temp.chk('C11', 'pausar una eliminada', 'no_existe', public.notif_cambiar_estado(p_crud, false)->>'motivo');
PERFORM pg_temp.chk('C12', 'eliminar una automática', 'no_eliminable', public.notif_eliminar_programada(v_auto)->>'motivo');

v_j := public.notif_cambiar_estado(v_auto, false);
v_t := (SELECT CASE WHEN activa THEN 'activa' ELSE 'pausada' END FROM public.notif_alertas WHERE id = v_auto);
v_j := public.notif_cambiar_estado(v_auto, true);
PERFORM pg_temp.chk('C13', 'notif_cambiar_estado sirve para una automática', 'pausada → activa',
    v_t || ' → ' || (SELECT CASE WHEN activa THEN 'activa' ELSE 'pausada' END FROM public.notif_alertas WHERE id = v_auto));

PERFORM pg_temp.chk('C14', 'audit_logs: alta, edición ×2, pausa, activa, baja', 'INSERT ×1 · UPDATE ×5 · por Eva',
    (SELECT 'INSERT ×' || count(*) FILTER (WHERE action = 'INSERT') || ' · UPDATE ×' || count(*) FILTER (WHERE action = 'UPDATE')
            || CASE WHEN bool_and(changed_by = eva) THEN ' · por Eva' ELSE ' · OTRO autor' END
       FROM public.audit_logs WHERE table_name = 'notif_alertas' AND record_id = p_crud));

PERFORM pg_temp.chk('C15', 'guardar con el id de una automática', 'no_es_programada',
    pg_temp.prog(v_auto, '2026-11-01', NULL, 1, ARRAY['10:00']::time[], false, NULL, ARRAY[dani])->>'motivo');


-- ══════════════════════════════════════════════════════════════════════════
-- V · Validaciones
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.chk('V1', '6 horarios', 'horas_invalidas',
    pg_temp.prog(gen_random_uuid(), '2026-11-01', NULL, 1, ARRAY['08:00','09:00','10:00','11:00','12:00','13:00']::time[], true, NULL, NULL)->>'motivo');
PERFORM pg_temp.chk('V2', 'horarios repetidos (10:00 y 10:00:30)', 'horas_repetidas',
    pg_temp.prog(gen_random_uuid(), '2026-11-01', NULL, 1, ARRAY['10:00','10:00:30']::time[], true, NULL, NULL)->>'motivo');
PERFORM pg_temp.chk('V3', 'sin horarios', 'horas_invalidas',
    pg_temp.prog(gen_random_uuid(), '2026-11-01', NULL, 1, ARRAY[]::time[], true, NULL, NULL)->>'motivo');
PERFORM pg_temp.chk('V4', 'hasta antes que desde', 'fechas_invalidas',
    pg_temp.prog(gen_random_uuid(), '2026-11-10', '2026-11-09', 1, ARRAY['10:00']::time[], true, NULL, NULL)->>'motivo');
PERFORM pg_temp.chk('V5', 'audiencia vacía', 'audiencia_vacia',
    pg_temp.prog(gen_random_uuid(), '2026-11-01', NULL, 1, ARRAY['10:00']::time[], false, ARRAY[]::text[], ARRAY[]::uuid[])->>'motivo');
-- Desde sql/notif_destino_externo.sql, https:// se acepta; http:// sigue sin.
PERFORM pg_temp.chk('V6', 'url http:// (sin cifrar)', 'url_invalida',
    pg_temp.prog(gen_random_uuid(), '2026-11-01', NULL, 1, ARRAY['10:00']::time[], true, NULL, NULL, true, 'Hola', 'Mensaje', 'http://otro.com')->>'motivo');
PERFORM pg_temp.chk('V7', 'url //dominio', 'url_invalida',
    pg_temp.prog(gen_random_uuid(), '2026-11-01', NULL, 1, ARRAY['10:00']::time[], true, NULL, NULL, true, 'Hola', 'Mensaje', '//otro.com')->>'motivo');
PERFORM pg_temp.chk('V8', 'una variable en el texto', 'variable_invalida',
    pg_temp.prog(gen_random_uuid(), '2026-11-01', NULL, 1, ARRAY['10:00']::time[], true, NULL, NULL, true, 'Hola {nombre}', 'Mensaje')->>'motivo');
PERFORM pg_temp.chk('V9', 'título de 61', 'texto_invalido · titulo',
    (SELECT (j->>'motivo') || ' · ' || (j->>'campo') FROM (SELECT pg_temp.prog(gen_random_uuid(), '2026-11-01', NULL, 1, ARRAY['10:00']::time[], true, NULL, NULL, true, repeat('a', 61), 'Mensaje') j) x));
PERFORM pg_temp.chk('V10', 'título de 60 entra', 'ok',
    CASE WHEN (pg_temp.prog(gen_random_uuid(), '2026-11-01', NULL, 1, ARRAY['10:00']::time[], false, NULL, ARRAY[dani], false, repeat('a', 60), 'Mensaje')->>'ok')::boolean THEN 'ok' ELSE 'rechazado' END);
PERFORM pg_temp.chk('V11', 'mensaje de 161', 'texto_invalido · mensaje',
    (SELECT (j->>'motivo') || ' · ' || (j->>'campo') FROM (SELECT pg_temp.prog(gen_random_uuid(), '2026-11-01', NULL, 1, ARRAY['10:00']::time[], true, NULL, NULL, true, 'Hola', repeat('m', 161)) j) x));
PERFORM pg_temp.chk('V12', 'rol que no existe', 'rol_invalido',
    pg_temp.prog(gen_random_uuid(), '2026-11-01', NULL, 1, ARRAY['10:00']::time[], false, ARRAY['NO_EXISTE'], NULL)->>'motivo');
PERFORM pg_temp.chk('V13', 'persona que no existe', 'usuario_invalido',
    pg_temp.prog(gen_random_uuid(), '2026-11-01', NULL, 1, ARRAY['10:00']::time[], false, NULL, ARRAY[gen_random_uuid()])->>'motivo');
PERFORM pg_temp.chk('V14', 'cada 0 días / cada 366', 'frecuencia_invalida / frecuencia_invalida',
    (pg_temp.prog(gen_random_uuid(), '2026-11-01', NULL, 0, ARRAY['10:00']::time[], true, NULL, NULL)->>'motivo') || ' / ' ||
    (pg_temp.prog(gen_random_uuid(), '2026-11-01', NULL, 366, ARRAY['10:00']::time[], true, NULL, NULL)->>'motivo'));
PERFORM pg_temp.chk('V15', 'un rol de roles[] fuera del enum es válido', 'ok',
    CASE WHEN (pg_temp.prog(gen_random_uuid(), '2026-11-01', NULL, 1, ARRAY['10:00']::time[], false,
               (SELECT ARRAY[x] FROM public.users u, unnest(u.roles) x
                 WHERE NOT EXISTS (SELECT 1 FROM pg_enum e WHERE e.enumtypid = 'public.user_role'::regtype AND e.enumlabel = x) LIMIT 1),
               NULL, false)->>'ok')::boolean THEN 'ok' ELSE 'rechazado' END);

BEGIN
    INSERT INTO public.notif_alertas (clave, tipo, nombre, titulo_plantilla, mensaje_plantilla, type_legacy,
                                      siempre_activa, desde, cada_n_dias, horas, audiencia_todos)
    VALUES ('prog_aaaaaaaaaaaa', 'programada', 'x', 'x', 'x', 'PROGRAMADA', true, '2026-11-01', 1,
            ARRAY['08:00','09:00','10:00','11:00','12:00','13:00']::time[], true);
    v_t := 'entró';
EXCEPTION WHEN check_violation THEN
    v_t := 'la frena el CHECK';
END;
PERFORM pg_temp.chk('V16', 'insertar directo con 6 horarios', 'la frena el CHECK', v_t);


-- ══════════════════════════════════════════════════════════════════════════
-- P · Permisos
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.sesion(ana);
PERFORM pg_temp.chk('P1', 'Ana (no SUPER_ADMIN): guardar · estado · eliminar · estimar · roles · lista',
    'sin_permiso ×6',
    CASE WHEN (pg_temp.prog(gen_random_uuid(), '2026-11-01', NULL, 1, ARRAY['10:00']::time[], true, NULL, NULL)->>'motivo') = 'sin_permiso'
          AND (public.notif_cambiar_estado(v_auto, false)->>'motivo') = 'sin_permiso'
          AND (public.notif_eliminar_programada(p_crud)->>'motivo') = 'sin_permiso'
          AND (public.notif_estimar_audiencia(true, NULL, NULL)->>'motivo') = 'sin_permiso'
          AND (public.notif_roles_disponibles()->>'motivo') = 'sin_permiso'
          AND (public.notif_alertas_admin()->>'motivo') = 'sin_permiso'
         THEN 'sin_permiso ×6' ELSE 'ALGUNA PASÓ' END);

PERFORM pg_temp.sesion(NULL);
PERFORM pg_temp.chk('P2', 'sin sesión: guardar', 'sin_permiso',
    pg_temp.prog(gen_random_uuid(), '2026-11-01', NULL, 1, ARRAY['10:00']::time[], true, NULL, NULL)->>'motivo');
PERFORM pg_temp.sesion(eva);

PERFORM pg_temp.chk('P3', 'anon no puede ejecutar ninguna función nueva', 'ninguna',
    COALESCE((SELECT string_agg(p.proname, ', ' ORDER BY p.proname) FROM pg_proc p
               WHERE p.pronamespace = 'public'::regnamespace
                 AND p.proname IN ('notif_guardar_programada', 'notif_cambiar_estado', 'notif_eliminar_programada',
                                   'notif_estimar_audiencia', 'notif_roles_disponibles', 'notif_alertas_admin',
                                   'notif_programadas_tick', 'notif_programada_emitir', 'notif_lote_encolar',
                                   'notif_lote_tomar', 'notif_lote_hechos', 'notif_audiencia', 'notif_proximo_envio',
                                   'notif_roles_validos', 'notif_tope_por_emision', 'notif_horas_ok',
                                   'notif_alcance_programada', 'notif_programada_sale_el')
                 AND has_function_privilege('anon', p.oid, 'EXECUTE')), 'ninguna'));

PERFORM pg_temp.chk('P4', 'authenticated no puede ejecutar el reloj, la emisión ni el lote', 'ninguna',
    COALESCE((SELECT string_agg(p.proname, ', ' ORDER BY p.proname) FROM pg_proc p
               WHERE p.pronamespace = 'public'::regnamespace
                 AND p.proname IN ('notif_programadas_tick', 'notif_programada_emitir', 'notif_lote_encolar',
                                   'notif_lote_tomar', 'notif_lote_hechos', 'notif_audiencia', 'notif_proximo_envio',
                                   'notif_roles_validos', 'notif_tope_por_emision')
                 AND has_function_privilege('authenticated', p.oid, 'EXECUTE')), 'ninguna'));

PERFORM pg_temp.chk('P5', 'service_role sí ejecuta el lote', 'las 3',
    CASE WHEN has_function_privilege('service_role', 'public.notif_lote_tomar(uuid, integer)', 'EXECUTE')
          AND has_function_privilege('service_role', 'public.notif_lote_hechos(uuid, uuid[])', 'EXECUTE')
          AND has_function_privilege('service_role', 'public.notif_lote_encolar(uuid)', 'EXECUTE')
         THEN 'las 3' ELSE 'falta alguna' END);

PERFORM pg_temp.chk('P6', 'las tablas nuevas, cerradas para anon y authenticated', 'cerradas',
    CASE WHEN NOT has_table_privilege('anon', 'public.notif_programadas_hechas', 'SELECT')
          AND NOT has_table_privilege('authenticated', 'public.notif_programadas_hechas', 'SELECT')
          AND NOT has_table_privilege('authenticated', 'public.notif_lote_cola', 'SELECT')
          AND NOT has_table_privilege('authenticated', 'public.notif_lotes', 'SELECT')
         THEN 'cerradas' ELSE 'ABIERTAS' END);


-- ══════════════════════════════════════════════════════════════════════════
-- A · Audiencia
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.chk('A1', 'todos = las cuentas activas', 'igual',
    CASE WHEN (public.notif_estimar_audiencia(true, NULL, NULL)->>'personas')::int
              = (SELECT count(*) FROM public.users WHERE is_active IS NOT FALSE)
         THEN 'igual' ELSE 'distinto' END);
PERFORM pg_temp.chk('A2', 'rol ADMIN_STORE (por role): Ana y Caro, sin la inactiva', '2 · 1 con push',
    (SELECT (j->>'personas') || ' · ' || (j->>'con_push') || ' con push' FROM (SELECT public.notif_estimar_audiencia(false, ARRAY['ADMIN_STORE'], NULL) j) x));
PERFORM pg_temp.chk('A3', 'rol REPORTES (por roles[]): Beto y Caro', '2',
    public.notif_estimar_audiencia(false, ARRAY['REPORTES'], NULL)->>'personas');
PERFORM pg_temp.chk('A4', 'dos roles, Caro está en los dos', '3',
    public.notif_estimar_audiencia(false, ARRAY['ADMIN_STORE', 'REPORTES'], NULL)->>'personas');
PERFORM pg_temp.chk('A5', 'personas sueltas (Dani y Ana)', '2 · 1 con push',
    (SELECT (j->>'personas') || ' · ' || (j->>'con_push') || ' con push' FROM (SELECT public.notif_estimar_audiencia(false, NULL, ARRAY[dani, ana]) j) x));
PERFORM pg_temp.chk('A6', 'rol REPORTES + Dani + Beto (Beto una vez)', '3',
    public.notif_estimar_audiencia(false, ARRAY['REPORTES'], ARRAY[dani, beto])->>'personas');
PERFORM pg_temp.chk('A7', 'una persona inactiva elegida a mano', '0',
    public.notif_estimar_audiencia(false, NULL, ARRAY[ina])->>'personas');
PERFORM pg_temp.chk('A8', 'roles para los chips: ADMIN_STORE con 2', '2',
    (SELECT x->>'personas' FROM jsonb_array_elements(public.notif_roles_disponibles()->'roles') x WHERE x->>'rol' = 'ADMIN_STORE'));
-- Desde sql/notif_roles_todos.sql la lista trae TODOS los roles válidos,
-- también los que no tienen a nadie (van con 0).
PERFORM pg_temp.chk('A9', 'la lista trae todos los roles válidos', 'todos',
    CASE WHEN jsonb_array_length(public.notif_roles_disponibles()->'roles') = cardinality(public.notif_roles_validos())
         THEN 'todos' ELSE jsonb_array_length(public.notif_roles_disponibles()->'roles')::text END);

-- Emitir de verdad (en la transacción) y comparar con la estimación.
v_j := pg_temp.prog(p_mix, '2026-11-15', '2026-11-15', 1, ARRAY['10:00']::time[], false, ARRAY['REPORTES'], ARRAY[dani, beto]);
PERFORM public.notif_programadas_tick(pg_temp.ar('2026-11-15 10:05'));
PERFORM pg_temp.chk('A10', 'rol + personas: lo emitido = lo estimado, uno por persona', '3 avisos · 3 personas',
    (SELECT count(*) || ' avisos · ' || count(DISTINCT n.user_id) || ' personas'
       FROM public.app_notifications n JOIN public.notif_alertas a ON a.clave = n.alerta_clave WHERE a.id = p_mix));
PERFORM pg_temp.chk('A11', 'a quiénes: Beto, Caro y Dani', 'Beto, Caro, Dani',
    (SELECT string_agg(split_part(u.name, ' ', 1), ', ' ORDER BY u.name)
       FROM public.app_notifications n JOIN public.notif_alertas a ON a.clave = n.alerta_clave
       JOIN public.users u ON u.id = n.user_id WHERE a.id = p_mix));

v_j := pg_temp.prog(p_todos, '2026-11-20', '2026-11-20', 1, ARRAY['10:00']::time[], true, NULL, NULL, true, 'Para todos');
PERFORM public.notif_programadas_tick(pg_temp.ar('2026-11-20 10:05'));
PERFORM pg_temp.chk('A12', 'todos: lo emitido = lo estimado, sin repetidos', 'igual · sin repetidos',
    CASE WHEN pg_temp.avisos(p_todos) = (public.notif_estimar_audiencia(true, NULL, NULL)->>'personas')::int
         THEN 'igual' ELSE 'distinto (' || pg_temp.avisos(p_todos) || ')' END
    || CASE WHEN (SELECT count(*) = count(DISTINCT n.user_id) FROM public.app_notifications n
                    JOIN public.notif_alertas a ON a.clave = n.alerta_clave WHERE a.id = p_todos)
            THEN ' · sin repetidos' ELSE ' · REPETIDOS' END);
PERFORM pg_temp.chk('A13', 'el aviso: type PROGRAMADA, texto, ruta y envio_id', 'PROGRAMADA · Para todos · /eventos · con envio',
    (SELECT n.type || ' · ' || n.title || ' · ' || COALESCE(n.action_url, '(sin ruta)') || CASE WHEN n.envio_id IS NOT NULL THEN ' · con envio' ELSE ' · SIN envio' END
       FROM public.app_notifications n JOIN public.notif_alertas a ON a.clave = n.alerta_clave
      WHERE a.id = p_todos AND n.user_id = dani));


-- ══════════════════════════════════════════════════════════════════════════
-- R · El reloj
-- ══════════════════════════════════════════════════════════════════════════
-- Cada 7 días desde el domingo 1/11, a las 10:00, a Dani.
v_j := pg_temp.prog(p_sem, '2026-11-01', NULL, 7, ARRAY['10:00']::time[], false, NULL, ARRAY[dani]);

PERFORM pg_temp.chk('R1', 'el 1/11 era domingo', 'domingo', CASE WHEN extract(dow FROM date '2026-11-01') = 0 THEN 'domingo' ELSE 'no' END);
PERFORM pg_temp.chk('R2', 'próximo envío antes de empezar', '2026-11-01 10:00',
    to_char(public.notif_proximo_envio(p_sem, pg_temp.ar('2026-10-30 08:00')) AT TIME ZONE ZONA, 'YYYY-MM-DD HH24:MI'));

PERFORM public.notif_programadas_tick(pg_temp.ar('2026-11-01 09:55'));
PERFORM pg_temp.chk('R3', 'domingo 09:55: el de las 10:00 todavía no', '0', pg_temp.hechas(p_sem)::text);
PERFORM public.notif_programadas_tick(pg_temp.ar('2026-11-01 10:05'));
PERFORM pg_temp.chk('R4', 'domingo 10:05: sale, una vez', '1 horario · 1 aviso', pg_temp.hechas(p_sem) || ' horario · ' || pg_temp.avisos(p_sem) || ' aviso');
PERFORM public.notif_programadas_tick(pg_temp.ar('2026-11-01 10:10'));
PERFORM pg_temp.chk('R5', 'domingo 10:10, segunda corrida: no se repite', '1 horario · 1 aviso', pg_temp.hechas(p_sem) || ' horario · ' || pg_temp.avisos(p_sem) || ' aviso');
PERFORM pg_temp.chk('R6', 'próximo envío después de salir', '2026-11-08 10:00',
    to_char(public.notif_proximo_envio(p_sem, pg_temp.ar('2026-11-01 10:10')) AT TIME ZONE ZONA, 'YYYY-MM-DD HH24:MI'));
PERFORM public.notif_programadas_tick(pg_temp.ar('2026-11-02 10:05'));
PERFORM pg_temp.chk('R7', 'lunes 10:05: no sale', '1', pg_temp.hechas(p_sem)::text);
PERFORM public.notif_programadas_tick(pg_temp.ar('2026-11-08 10:05'));
PERFORM pg_temp.chk('R8', 'domingo siguiente: sale', '2', pg_temp.hechas(p_sem)::text);

-- Todos los días, 10:00 y 14:00, siempre activa, a Beto.
v_j := pg_temp.prog(p_dos, '2026-11-01', NULL, 1, ARRAY['14:00', '10:00']::time[], false, NULL, ARRAY[beto]);
PERFORM public.notif_programadas_tick(pg_temp.ar('2026-11-03 15:00'));
PERFORM pg_temp.chk('R9', 'el cron corre recién a las 15:00: salen los dos de hoy', '2', pg_temp.hechas(p_dos, '2026-11-03')::text);
PERFORM public.notif_programadas_tick(pg_temp.ar('2026-11-03 15:05'));
PERFORM pg_temp.chk('R10', 'y una sola vez', '2 horarios · 2 avisos del día',
    pg_temp.hechas(p_dos, '2026-11-03') || ' horarios · ' ||
    (SELECT count(*) FROM public.app_notifications n WHERE n.envio_id IN
        (SELECT envio_id FROM public.notif_programadas_hechas WHERE alerta_id = p_dos AND fecha = '2026-11-03')) || ' avisos del día');
PERFORM public.notif_programadas_tick(pg_temp.ar('2027-03-15 10:05'));
PERFORM pg_temp.chk('R11', 'siempre activa: meses después sale (sólo el de las 10)', '1', pg_temp.hechas(p_dos, '2027-03-15')::text);

-- Un horario de ayer no se manda hoy.
v_j := pg_temp.prog(p_ayer, '2026-11-10', NULL, 1, ARRAY['10:00']::time[], false, NULL, ARRAY[dani]);
PERFORM public.notif_programadas_tick(pg_temp.ar('2026-11-10 09:00'));
PERFORM public.notif_programadas_tick(pg_temp.ar('2026-11-11 09:00'));
PERFORM pg_temp.chk('R12', 'el cron no corrió el 10 a las 10: el 11 no lo manda', '0 del 10 · 0 del 11',
    pg_temp.hechas(p_ayer, '2026-11-10') || ' del 10 · ' || pg_temp.hechas(p_ayer, '2026-11-11') || ' del 11');

-- Hasta vencido.
v_j := pg_temp.prog(p_vence, '2026-11-01', '2026-11-03', 1, ARRAY['10:00']::time[], false, NULL, ARRAY[dani]);
PERFORM public.notif_programadas_tick(pg_temp.ar('2026-11-04 10:05'));
PERFORM pg_temp.chk('R13', 'con el hasta vencido no sale', '0', pg_temp.hechas(p_vence)::text);
PERFORM pg_temp.chk('R14', 'y no tiene próximo envío', '(ninguno)',
    COALESCE(to_char(public.notif_proximo_envio(p_vence, pg_temp.ar('2026-11-04 10:05')), 'YYYY-MM-DD'), '(ninguno)'));

-- Pausada: no emite nada.
v_j := pg_temp.prog(p_pausa, '2026-11-01', NULL, 1, ARRAY['10:00']::time[], false, NULL, ARRAY[ana], false);
PERFORM public.notif_programadas_tick(pg_temp.ar('2026-11-05 10:05'));
PERFORM pg_temp.chk('R15', 'pausada: ni horario ni aviso', '0 · 0', pg_temp.hechas(p_pausa) || ' · ' || pg_temp.avisos(p_pausa));
PERFORM pg_temp.chk('R16', 'pausada: sin próximo envío', '(ninguno)',
    COALESCE(to_char(public.notif_proximo_envio(p_pausa, pg_temp.ar('2026-11-05 10:05')), 'YYYY-MM-DD'), '(ninguno)'));

-- reloj_desde: activada a las 12:00, el de las 10:00 de ese día no sale.
v_j := pg_temp.prog(p_reloj, '2026-11-01', NULL, 1, ARRAY['10:00']::time[], false, NULL, ARRAY[dani]);
UPDATE public.notif_alertas SET reloj_desde = pg_temp.ar('2026-11-06 12:00') WHERE id = p_reloj;
PERFORM public.notif_programadas_tick(pg_temp.ar('2026-11-06 12:30'));
PERFORM public.notif_programadas_tick(pg_temp.ar('2026-11-07 10:05'));
PERFORM pg_temp.chk('R17', 'activada a las 12: el de las 10 de ese día no; el del otro día sí', '0 · 1',
    pg_temp.hechas(p_reloj, '2026-11-06') || ' · ' || pg_temp.hechas(p_reloj, '2026-11-07'));

v_j := pg_temp.prog(p_gracia, '2026-11-01', NULL, 1, ARRAY['10:00']::time[], false, NULL, ARRAY[dani]);
UPDATE public.notif_alertas SET reloj_desde = pg_temp.ar('2026-11-06 10:05') WHERE id = p_gracia;
PERFORM public.notif_programadas_tick(pg_temp.ar('2026-11-06 10:08'));
PERFORM pg_temp.chk('R18', 'editada a las 10:05 antes de que pase el cron: el de las 10:00 sale igual', '1',
    pg_temp.hechas(p_gracia, '2026-11-06')::text);

-- Cómo se lee.
v_j := public.notif_alertas_admin();
PERFORM pg_temp.chk('R19', 'alcance de la semanal', 'Cada 7 días · 1 vez por día · 10:00 · Siempre activa',
    (SELECT (x->>'alcance') || ' · ' || (x->'alcance_detalle'->>'horario') || ' · ' || (x->'alcance_detalle'->>'vigencia')
       FROM jsonb_array_elements(v_j->'alertas') x WHERE x->>'id' = p_sem::text));
PERFORM pg_temp.chk('R20', 'alcance de la diaria con dos horarios', 'Todos los días · 2 veces por día · 10:00 y 14:00',
    (SELECT (x->>'alcance') || ' · ' || (x->'alcance_detalle'->>'horario')
       FROM jsonb_array_elements(v_j->'alertas') x WHERE x->>'id' = p_dos::text));
PERFORM pg_temp.chk('R21', 'vigencia con fin', 'Del 1/11 al 3/11',
    (SELECT x->'alcance_detalle'->>'vigencia' FROM jsonb_array_elements(v_j->'alertas') x WHERE x->>'id' = p_vence::text));
PERFORM pg_temp.chk('R22', 'la lista trae personas y nombres de las elegidas', '3 personas · Beto PRUEBA, Dani PRUEBA',
    (SELECT (x->>'audiencia_personas') || ' personas · ' ||
            (SELECT string_agg(e->>'nombre', ', ' ORDER BY e->>'nombre') FROM jsonb_array_elements(x->'audiencia_detalle') e)
       FROM jsonb_array_elements(v_j->'alertas') x WHERE x->>'id' = p_mix::text));
PERFORM pg_temp.chk('R23', 'las automáticas siguen en la lista, sin campos de programada', '20 · sin alcance',
    (SELECT count(*) || CASE WHEN bool_and(NOT (x ? 'alcance')) THEN ' · sin alcance' ELSE ' · CON alcance' END
       FROM jsonb_array_elements(v_j->'alertas') x WHERE x->>'tipo' = 'automatica'));


-- ══════════════════════════════════════════════════════════════════════════
-- L · El lote
-- ══════════════════════════════════════════════════════════════════════════
-- Un día sólo para esta: Ana y Eva tienen dispositivo, Dani no.
v_j := pg_temp.prog(p_lote, '2026-12-01', '2026-12-01', 1, ARRAY['10:00']::time[], false, NULL, ARRAY[ana, eva, dani]);
v_n := pg_temp.pedidos();
PERFORM public.notif_programadas_tick(pg_temp.ar('2026-12-01 10:05'));
v_m := pg_temp.pedidos();
SELECT envio_id INTO v_envio FROM public.notif_programadas_hechas WHERE alerta_id = p_lote;

PERFORM pg_temp.chk('L1', '3 avisos, 2 con dispositivo: UN solo pedido HTTP', '3 avisos · 1 pedido',
    pg_temp.avisos(p_lote) || ' avisos · ' || (v_m - v_n) || ' pedido');
PERFORM pg_temp.chk('L2', 'el pedido es a send-push, modo lote, con el envio_id', 'send-push · lote · mismo envío',
    (SELECT CASE WHEN q.url LIKE '%/functions/v1/send-push' THEN 'send-push' ELSE q.url END
            || ' · ' || (convert_from(q.body, 'UTF8')::jsonb->>'modo')
            || CASE WHEN convert_from(q.body, 'UTF8')::jsonb->>'envio_id' = v_envio::text THEN ' · mismo envío' ELSE ' · OTRO envío' END
       FROM net.http_request_queue q ORDER BY q.id DESC LIMIT 1));
PERFORM pg_temp.chk('L3', 'la cola: sólo los que tienen dispositivo', '2 · Ana, Eva',
    (SELECT count(*) || ' · ' || string_agg(split_part(u.name, ' ', 1), ', ' ORDER BY u.name)
       FROM public.notif_lote_cola c JOIN public.app_notifications n ON n.id = c.notificacion_id
       JOIN public.users u ON u.id = n.user_id WHERE c.envio_id = v_envio));
PERFORM pg_temp.chk('L4', 'el lote anota personas, con push y un pedido', '3 · 2 · 1 pedido',
    (SELECT personas || ' · ' || con_push || ' · ' || pedidos || ' pedido' FROM public.notif_lotes WHERE envio_id = v_envio));

-- Control: un aviso automático (sin envio_id) a Eva sigue pidiendo su push.
v_n := pg_temp.pedidos();
PERFORM public.notif_emitir('gcx_asistencia_guardada', eva, '{"presentes":"3","grupo":"G","fecha":"1/12"}'::jsonb);
PERFORM pg_temp.chk('L5', 'una automática sigue pidiendo su push por fila', '1', (pg_temp.pedidos() - v_n)::text);

-- Tomar con reserva.
v_j := public.notif_lote_tomar(v_envio, 1);
v_id1 := (v_j->'ids'->>0)::uuid;
PERFORM pg_temp.chk('L6', 'tomar 1: devuelve 1 y queda 1', '1 · quedan 1', jsonb_array_length(v_j->'ids') || ' · quedan ' || (v_j->>'quedan'));
v_j := public.notif_lote_tomar(v_envio, 5);
v_id2 := (v_j->'ids'->>0)::uuid;
PERFORM pg_temp.chk('L7', 'tomar de nuevo: el otro, no el mismo', '1 · otro · quedan 0',
    jsonb_array_length(v_j->'ids') || CASE WHEN v_id2 <> v_id1 THEN ' · otro' ELSE ' · EL MISMO' END || ' · quedan ' || (v_j->>'quedan'));
v_j := public.notif_lote_tomar(v_envio, 5);
PERFORM pg_temp.chk('L8', 'tomar otra vez: nada (los dos están reservados)', '0', jsonb_array_length(v_j->'ids')::text);

UPDATE public.notif_lote_cola SET tomado_at = now() - interval '11 minutes' WHERE notificacion_id IN (v_id1, v_id2);
INSERT INTO public.notif_push_log (notificacion_id, alerta_clave, user_id, resultado)
SELECT v_id2, alerta_clave, user_id, 'enviado' FROM public.app_notifications WHERE id = v_id2;
v_j := public.notif_lote_tomar(v_envio, 5);
PERFORM pg_temp.chk('L9', 'reserva vencida: se retoma; si ya está en el log, se descarta', 'retoma el 1 · descarta el 2',
    CASE WHEN v_j->'ids' = jsonb_build_array(v_id1) THEN 'retoma el 1' ELSE v_j->>'ids' END
    || CASE WHEN NOT EXISTS (SELECT 1 FROM public.notif_lote_cola WHERE notificacion_id = v_id2) THEN ' · descarta el 2' ELSE ' · el 2 SIGUE' END);

v_j := public.notif_lote_hechos(v_envio, ARRAY[v_id1]);
PERFORM pg_temp.chk('L10', 'hechos: cola vacía y el lote terminado', 'vacía · terminado',
    CASE WHEN NOT EXISTS (SELECT 1 FROM public.notif_lote_cola WHERE envio_id = v_envio) THEN 'vacía' ELSE 'con filas' END
    || (SELECT CASE WHEN terminado_at IS NOT NULL THEN ' · terminado' ELSE ' · abierto' END FROM public.notif_lotes WHERE envio_id = v_envio));

-- El tope (bajado a 2 sólo en esta transacción: no hay 5000 cuentas).
CREATE OR REPLACE FUNCTION public.notif_tope_por_emision() RETURNS integer LANGUAGE sql STABLE AS $t$ SELECT 2 $t$;
v_j := pg_temp.prog(p_tope, '2026-12-02', '2026-12-02', 1, ARRAY['10:00']::time[], false, NULL, ARRAY[ana, eva, dani]);
v_n := pg_temp.pedidos();
PERFORM public.notif_programadas_tick(pg_temp.ar('2026-12-02 10:05'));
PERFORM pg_temp.chk('L11', 'más personas que el tope: no se emite y queda anotado', 'excedida · 3 personas · 0 avisos · 0 pedidos',
    (SELECT resultado || ' · ' || personas || ' personas' FROM public.notif_programadas_hechas WHERE alerta_id = p_tope)
    || ' · ' || pg_temp.avisos(p_tope) || ' avisos · ' || (pg_temp.pedidos() - v_n) || ' pedidos');
PERFORM public.notif_programadas_tick(pg_temp.ar('2026-12-02 10:10'));
PERFORM pg_temp.chk('L12', 'y no se reintenta', '1 renglón', (SELECT count(*) || ' renglón' FROM public.notif_programadas_hechas WHERE alerta_id = p_tope));
CREATE OR REPLACE FUNCTION public.notif_tope_por_emision() RETURNS integer LANGUAGE sql STABLE AS $t$ SELECT 5000 $t$;

-- Nadie con dispositivo: ningún pedido, el lote nace terminado.
v_j := pg_temp.prog(p_nadie, '2026-12-04', '2026-12-04', 1, ARRAY['10:00']::time[], false, NULL, ARRAY[dani, beto]);
v_n := pg_temp.pedidos();
PERFORM public.notif_programadas_tick(pg_temp.ar('2026-12-04 10:05'));
PERFORM pg_temp.chk('L13', 'sin dispositivos: avisos sí, pedido no', '2 avisos · 0 pedidos · terminado',
    pg_temp.avisos(p_nadie) || ' avisos · ' || (pg_temp.pedidos() - v_n) || ' pedidos'
    || (SELECT CASE WHEN l.terminado_at IS NOT NULL THEN ' · terminado' ELSE ' · abierto' END
          FROM public.notif_lotes l JOIN public.notif_programadas_hechas h ON h.envio_id = l.envio_id WHERE h.alerta_id = p_nadie));

-- Un lote trabado (la invocación se murió): el reloj lo vuelve a pedir.
v_j := pg_temp.prog(p_traba, '2026-12-03', '2026-12-03', 1, ARRAY['10:00']::time[], false, NULL, ARRAY[ana]);
PERFORM public.notif_programadas_tick(pg_temp.ar('2026-12-03 10:05'));
SELECT envio_id INTO v_envio FROM public.notif_programadas_hechas WHERE alerta_id = p_traba;
UPDATE public.notif_lotes SET ultimo_pedido_at = now() - interval '11 minutes' WHERE envio_id = v_envio;
v_n := pg_temp.pedidos();
v_j := public.notif_programadas_tick(pg_temp.ar('2026-12-03 10:20'));
PERFORM pg_temp.chk('L14', 'lote trabado hace 11 minutos: el reloj lo relanza', '1 relanzado · 1 pedido · 2 pedidos en total',
    (v_j->>'relanzados') || ' relanzado · ' || (pg_temp.pedidos() - v_n) || ' pedido · '
    || (SELECT pedidos FROM public.notif_lotes WHERE envio_id = v_envio) || ' pedidos en total');
v_n := pg_temp.pedidos();
v_j := public.notif_programadas_tick(pg_temp.ar('2026-12-03 10:25'));
PERFORM pg_temp.chk('L15', 'recién relanzado: no se vuelve a pedir', '0', (v_j->>'relanzados'));

-- Las reglas de envío valen para los avisos de una programada.
v_j := pg_temp.prog(p_reglas, '2026-12-05', '2026-12-05', 1, ARRAY['10:00']::time[], false, NULL, ARRAY[eva]);
PERFORM public.notif_programadas_tick(pg_temp.ar('2026-12-05 10:05'));
SELECT n.id INTO v_av FROM public.app_notifications n JOIN public.notif_alertas a ON a.clave = n.alerta_clave WHERE a.id = p_reglas;
v_t := public.notif_puede_enviar(v_av)->>'decision';
UPDATE public.notif_alertas SET activa = false WHERE id = p_reglas;
v_t := v_t || ' · ' || (public.notif_puede_enviar(v_av)->>'decision');
UPDATE public.notif_alertas SET activa = true, max_por_dia = 1 WHERE id = p_reglas;
INSERT INTO public.notif_push_log (notificacion_id, alerta_clave, user_id, resultado)
SELECT gen_random_uuid(), clave, eva, 'enviado' FROM public.notif_alertas WHERE id = p_reglas;
v_t := v_t || ' · ' || (public.notif_puede_enviar(v_av)->>'decision');
UPDATE public.notif_alertas SET max_por_dia = NULL, no_molestar = true,
       no_molestar_desde = ((now() AT TIME ZONE ZONA) - interval '1 hour')::time,
       no_molestar_hasta = ((now() AT TIME ZONE ZONA) + interval '1 hour')::time
 WHERE id = p_reglas;
v_t := v_t || ' · ' || (public.notif_puede_enviar(v_av)->>'decision');
PERFORM pg_temp.chk('L16', 'reglas sobre el aviso de una programada: normal · pausada · tope · no molestar', 'enviar · pausada · tope · diferir', v_t);


-- ══════════════════════════════════════════════════════════════════════════
-- E · El estado
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.chk('E1', 'el trigger de push prendido y con la condición nueva', 'prendido · ignora envio_id',
    (SELECT CASE WHEN tgenabled = 'O' THEN 'prendido' ELSE 'APAGADO' END
            || CASE WHEN pg_get_triggerdef(oid) LIKE '%envio_id IS NULL%' THEN ' · ignora envio_id' ELSE ' · SIN condición' END
       FROM pg_trigger WHERE tgname = 'trg_app_notifications_push' AND NOT tgisinternal));
PERFORM pg_temp.chk('E2', 'cron notif-programadas: activo, cada 5 min, sin clave escrita', 'activo · */5 * * * * · sin clave',
    COALESCE((SELECT CASE WHEN active THEN 'activo' ELSE 'apagado' END || ' · ' || schedule
                     || CASE WHEN command NOT LIKE '%eyJ%' AND command NOT LIKE '%Bearer%' THEN ' · sin clave' ELSE ' · CON CLAVE' END
                FROM cron.job WHERE jobname = 'notif-programadas'), 'no está'));
PERFORM pg_temp.chk('E3', 'el cron de los diferidos sigue activo', 'activo',
    COALESCE((SELECT CASE WHEN active THEN 'activo' ELSE 'apagado' END FROM cron.job WHERE jobname = 'notif-push-diferidos'), 'no está'));
PERFORM pg_temp.chk('E4', 'audit_logs en notif_alertas', 'trigger puesto',
    CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_notif_alertas_changes' AND tgenabled = 'O') THEN 'trigger puesto' ELSE 'no está' END);


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
