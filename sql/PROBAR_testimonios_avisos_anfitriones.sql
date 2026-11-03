-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de sql/testimonios_avisos_anfitriones.sql
--
-- BEGIN … ROLLBACK y un RAISE EXCEPTION final a propósito: se deshace todo,
-- incluida la cola de pg_net. NO SALE NINGÚN AVISO NI NINGÚN PUSH, ni a las
-- personas de prueba ni a las reales. NUNCA COMMIT.
--
-- Personas: Hugo (anfitrión), Carla (co-anfitriona), Ana y Gus (participantes
-- adultos), Sofi (participante de 14), Beto (anfitrión solo), Dino (anfitrión
-- Y co-anfitrión del mismo GCX, la misma cuenta) y Eva (SUPER_ADMIN).
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

CREATE FUNCTION pg_temp.ar(p text) RETURNS timestamptz LANGUAGE sql AS $f$
    SELECT (p::timestamp) AT TIME ZONE 'America/Argentina/Buenos_Aires';
$f$;

/** Los avisos de "nuevo testimonio" que le llegaron a esa persona. */
CREATE FUNCTION pg_temp.nuevos(p uuid) RETURNS text LANGUAGE sql AS $f$
    SELECT COALESCE(string_agg(title || ' § ' || message || ' § ' || COALESCE(action_url, '-'), ' ‖ '
                               ORDER BY message, action_url), '(ninguno)')
      FROM public.app_notifications
     WHERE user_id = p AND alerta_clave = 'testimonios_nuevo_en_tu_gcx';
$f$;

/** Cuántos avisos de "nuevo testimonio" hay en total. */
CREATE FUNCTION pg_temp.cuantos() RETURNS integer LANGUAGE sql AS $f$
    SELECT count(*)::integer FROM public.app_notifications
     WHERE alerta_clave = 'testimonios_nuevo_en_tu_gcx';
$f$;

/** Los avisos de otra alerta de testimonios, para B y C. */
CREATE FUNCTION pg_temp.avisos(p uuid, p_clave text) RETURNS text LANGUAGE sql AS $f$
    SELECT COALESCE(string_agg(message || ' § ' || COALESCE(action_url, '-'), ' ‖ ' ORDER BY message),
                    '(ninguno)')
      FROM public.app_notifications
     WHERE user_id = p AND alerta_clave = p_clave;
$f$;

CREATE FUNCTION pg_temp.limpiar() RETURNS void LANGUAGE sql AS $f$
    DELETE FROM public.app_notifications WHERE alerta_clave LIKE 'testimonios_%';
$f$;


DO $suite$
DECLARE
    AHORA constant timestamptz := pg_temp.ar('2026-11-03 12:00');
    TEXTO constant text := 'PRUEBA: esto es lo que escribí y no tiene que viajar en ningún aviso.';
    hugo  uuid := gen_random_uuid();   -- anfitrión de casi todos
    carla uuid := gen_random_uuid();   -- co-anfitriona
    ana   uuid := gen_random_uuid();   -- participante adulta
    gus   uuid := gen_random_uuid();   -- participante adulto
    sofi  uuid := gen_random_uuid();   -- participante de 14
    beto  uuid := gen_random_uuid();   -- anfitrión sin co-anfitrión
    dino  uuid := gen_random_uuid();   -- anfitrión Y co-anfitrión del mismo GCX
    eva   uuid := gen_random_uuid();   -- SUPER_ADMIN
    -- groups.id es texto, pero log_audit_event() lo castea a uuid: tiene que
    -- tener forma de uuid de verdad, uno por grupo.
    g1 text := gen_random_uuid()::text;   -- anfitrión + co-anfitrión
    g2 text := gen_random_uuid()::text;   -- sin co-anfitrión
    g3 text := gen_random_uuid()::text;   -- anfitrión = co-anfitrión
    g4 text := gen_random_uuid()::text;   -- publica el anfitrión
    g5 text := gen_random_uuid()::text;   -- la falla inyectada
    g6 text := gen_random_uuid()::text;   -- el pedido que se elimina
    g7 text := gen_random_uuid()::text;   -- el pedido que se rechaza
    g8 text := gen_random_uuid()::text;   -- ocultar y mostrar
    g9 text := gen_random_uuid()::text;   -- el camino real (testimonios_publicar)
    gA text := gen_random_uuid()::text;   -- el anfitrión que apagó la alerta
    t6 uuid := gen_random_uuid();
    t7 uuid := gen_random_uuid();
    t8 uuid := gen_random_uuid();
    v_j jsonb; v_id uuid; v_n integer; v_av uuid;
    v_fallos integer; v_salida text;
BEGIN
-- ══════════════════════════════════════════════════════════════════════════
-- Fixture
-- ══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.groups DISABLE TRIGGER trigger_notify_admins_on_new_group;
ALTER TABLE public.groups DISABLE TRIGGER on_group_created;
ALTER TABLE public.groups DISABLE TRIGGER notify_host_group_approved;
ALTER TABLE public.groups DISABLE TRIGGER on_group_updated_notify;
ALTER TABLE public.groups DISABLE TRIGGER trigger_notify_host_on_status_change;
ALTER TABLE public.groups DISABLE TRIGGER trigger_assign_co_host_role;
ALTER TABLE public.groups DISABLE TRIGGER completar_nombre_de_anfitriones;
ALTER TABLE public.group_registrations DISABLE TRIGGER notify_host_new_registration;
ALTER TABLE public.group_registrations DISABLE TRIGGER trigger_gcx_welcome;
-- El camino real (`testimonios_publicar`) pasa por la llave de la página.
IF to_regclass('public.testimonios_habilitacion') IS NOT NULL THEN
    EXECUTE 'UPDATE public.testimonios_habilitacion SET habilitada = true';
END IF;

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
SELECT x, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'prueba.anfit.' || left(x::text, 8) || '@test.local', '', now(), now()
  FROM unnest(ARRAY[hugo, carla, ana, gus, sofi, beto, dino, eva]) x;

-- Los adultos CON fecha de nacimiento: sin fecha se verían como menores.
INSERT INTO public.users (id, name, email, role, roles, is_active, birth_date) VALUES
    (hugo,  'Hugo Pérez PRUEBA',   'prueba.anfit.hugo@test.local',  'VIEWER', ARRAY['VIEWER'], true, '1980-01-15'),
    (carla, 'Carla Co PRUEBA',     'prueba.anfit.carla@test.local', 'VIEWER', ARRAY['VIEWER'], true, '1988-08-08'),
    (ana,   'Ana Gómez PRUEBA',    'prueba.anfit.ana@test.local',   'VIEWER', ARRAY['VIEWER'], true, '1990-05-10'),
    (gus,   'Gus Díaz PRUEBA',     'prueba.anfit.gus@test.local',   'VIEWER', ARRAY['VIEWER'], true, '1975-07-07'),
    (sofi,  'Sofía Gómez PRUEBA',  'prueba.anfit.sofi@test.local',  'VIEWER', ARRAY['VIEWER'], true, '2012-03-01'),
    (beto,  'Beto Solo PRUEBA',    'prueba.anfit.beto@test.local',  'VIEWER', ARRAY['VIEWER'], true, '1982-02-02'),
    (dino,  'Dino Doble PRUEBA',   'prueba.anfit.dino@test.local',  'VIEWER', ARRAY['VIEWER'], true, '1983-03-03'),
    (eva,   'Eva PRUEBA',          'prueba.anfit.eva@test.local',   'SUPER_ADMIN', ARRAY['SUPER_ADMIN'], true, '1985-04-10')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role,
    roles = EXCLUDED.roles, is_active = true, birth_date = EXCLUDED.birth_date;

INSERT INTO public.groups (id, name, leader_name, status, start_date, host_id, co_host_id, is_hidden) VALUES
    (g1, 'GCX PRUEBA Uno',         'Hugo', 'approved', '2026-10-06', hugo, carla, true),
    (g2, 'GCX PRUEBA Sin Co',      'Beto', 'approved', '2026-10-06', beto, NULL,  true),
    (g3, 'GCX PRUEBA Doble',       'Dino', 'approved', '2026-10-06', dino, dino,  true),
    (g4, 'GCX PRUEBA Del Anfi',    'Hugo', 'approved', '2026-10-06', hugo, carla, true),
    (g5, 'GCX PRUEBA La Falla',    'Hugo', 'approved', '2026-10-06', hugo, carla, true),
    (g6, 'GCX PRUEBA La Baja',     'Hugo', 'approved', '2026-10-06', hugo, carla, true),
    (g7, 'GCX PRUEBA El Rechazo',  'Hugo', 'approved', '2026-10-06', hugo, carla, true),
    (g8, 'GCX PRUEBA Ocultar',     'Hugo', 'approved', '2026-10-06', hugo, carla, true),
    (g9, 'GCX PRUEBA Real',        'Hugo', 'approved', '2026-10-06', hugo, carla, true),
    (gA, 'GCX PRUEBA Apagada',     'Hugo', 'approved', '2026-10-06', hugo, NULL,  true);

INSERT INTO public.group_registrations (id, first_name, last_name, email, group_id, user_id, status, approved_at)
SELECT gen_random_uuid()::text, 'Ana', 'PRUEBA', 'prueba.anfit.ana@test.local', x, ana, 'APPROVED', now()
  FROM unnest(ARRAY[g1, g2, g3, g9]) x
UNION ALL
SELECT gen_random_uuid()::text, 'Gus', 'PRUEBA', 'prueba.anfit.gus@test.local', x, gus, 'APPROVED', now()
  FROM unnest(ARRAY[g5, gA]) x
UNION ALL
SELECT gen_random_uuid()::text, 'Sofía', 'PRUEBA', 'prueba.anfit.sofi@test.local', g1, sofi, 'APPROVED', now();


-- ══════════════════════════════════════════════════════════════════════════
-- A · Quién recibe el aviso de un testimonio nuevo
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.sesion(ana);
v_j := public.testimonios_publicar_en(g1, TEXTO, true, AHORA);
v_id := (v_j->>'id')::uuid;
PERFORM pg_temp.chk('A1', 'una participante publica en un GCX con anfitrión y co-anfitrión', 'true',
    v_j->>'ok');
PERFORM pg_temp.chk('A2', 'le llega al anfitrión, con el link que abre ESE testimonio',
    'Nuevo testimonio en tu GCX § Ana Gómez PRUEBA dejó un testimonio en GCX PRUEBA Uno. § /testimonios/' || g1 || '?testimonio=' || v_id::text,
    pg_temp.nuevos(hugo));
PERFORM pg_temp.chk('A3', 'y también a la co-anfitriona, igual',
    'Nuevo testimonio en tu GCX § Ana Gómez PRUEBA dejó un testimonio en GCX PRUEBA Uno. § /testimonios/' || g1 || '?testimonio=' || v_id::text,
    pg_temp.nuevos(carla));
PERFORM pg_temp.chk('A4', 'a quien lo escribió, nunca', '(ninguno)', pg_temp.nuevos(ana));
PERFORM pg_temp.chk('A5', 'a Sistemas, tampoco: no es asunto suyo', '(ninguno)', pg_temp.nuevos(eva));
PERFORM pg_temp.chk('A6', 'dos avisos en total, uno por persona', '2', pg_temp.cuantos()::text);
PERFORM pg_temp.chk('A7', 'el aviso NO lleva el texto del testimonio', 'no',
    (SELECT CASE WHEN count(*) = 0 THEN 'no' ELSE 'SÍ LO LLEVA' END
       FROM public.app_notifications
      WHERE alerta_clave = 'testimonios_nuevo_en_tu_gcx'
        AND (message ILIKE '%no tiene que viajar%' OR title ILIKE '%no tiene que viajar%')));

-- Volver a mandar el MISMO texto no es un testimonio nuevo.
v_j := public.testimonios_publicar_en(g1, TEXTO, true, AHORA);
PERFORM pg_temp.chk('A8', 'reintentar con el mismo texto no vuelve a avisar', 'true · true · 2',
    (v_j->>'ok') || ' · ' || (v_j->>'ya_existia') || ' · ' || pg_temp.cuantos()::text);

-- Sin co-anfitrión.
PERFORM pg_temp.limpiar();
v_j := public.testimonios_publicar_en(g2, TEXTO, true, AHORA);
PERFORM pg_temp.chk('A9', 'GCX sin co-anfitrión: sólo el anfitrión', '1 · sí',
    pg_temp.cuantos()::text || ' · ' ||
    CASE WHEN pg_temp.nuevos(beto) <> '(ninguno)' THEN 'sí' ELSE 'no' END);

-- Anfitrión y co-anfitrión en la misma cuenta.
PERFORM pg_temp.limpiar();
PERFORM public.testimonios_publicar_en(g3, TEXTO, true, AHORA);
PERFORM pg_temp.chk('A10', 'anfitrión y co-anfitrión en la misma cuenta: un aviso, no dos', '1',
    pg_temp.cuantos()::text);

-- El anfitrión publica en su propio GCX.
PERFORM pg_temp.limpiar();
PERFORM pg_temp.sesion(hugo);
PERFORM public.testimonios_publicar_en(g4, TEXTO, true, AHORA);
PERFORM pg_temp.chk('A11', 'publica el anfitrión: no se avisa a sí mismo', '(ninguno)',
    pg_temp.nuevos(hugo));
PERFORM pg_temp.chk('A12', 'pero la co-anfitriona sí recibe', '1 · sí',
    pg_temp.cuantos()::text || ' · ' ||
    CASE WHEN pg_temp.nuevos(carla) <> '(ninguno)' THEN 'sí' ELSE 'no' END);

-- Una menor publica: el nombre que se muestra, no el completo.
PERFORM pg_temp.limpiar();
PERFORM pg_temp.sesion(sofi);
PERFORM public.testimonios_publicar_en(g1, 'PRUEBA el testimonio de Sofi.', true, AHORA);
PERFORM pg_temp.chk('A13', 'la autora es menor: el aviso dice "Sofía G."', 'sí · no',
    CASE WHEN pg_temp.nuevos(hugo) LIKE '%Sofía G. dejó un testimonio%' THEN 'sí' ELSE 'no: ' || pg_temp.nuevos(hugo) END
    || ' · ' || CASE WHEN pg_temp.nuevos(hugo) LIKE '%Gómez%' THEN 'SÍ LLEVA EL APELLIDO' ELSE 'no' END);

-- El camino real: testimonios_publicar (con now() y la llave de la página).
PERFORM pg_temp.limpiar();
PERFORM pg_temp.sesion(ana);
v_j := public.testimonios_publicar(g9, 'PRUEBA por el camino real.', true);
PERFORM pg_temp.chk('A14', 'por el camino real de la app (testimonios_publicar) también avisa', 'true · 2',
    (v_j->>'ok') || ' · ' || pg_temp.cuantos()::text);


-- ══════════════════════════════════════════════════════════════════════════
-- B · Si el aviso falla, el testimonio IGUAL queda publicado
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.limpiar();
-- Se rompe a propósito la escritura del aviso. NOT VALID: no recorre la tabla.
ALTER TABLE public.app_notifications
    ADD CONSTRAINT prueba_que_falle_el_aviso
    CHECK (alerta_clave IS DISTINCT FROM 'testimonios_nuevo_en_tu_gcx') NOT VALID;

PERFORM pg_temp.sesion(gus);
v_j := public.testimonios_publicar_en(g5, 'PRUEBA con el aviso roto.', true, AHORA);
PERFORM pg_temp.chk('B1', 'el aviso falla y el testimonio IGUAL queda publicado', 'true · false',
    (v_j->>'ok') || ' · ' || (v_j->>'ya_existia'));
PERFORM pg_temp.chk('B2', 'está en la tabla, publicado', '1 · publicado',
    (SELECT count(*)::text || ' · ' || max(estado) FROM public.gcx_testimonios
      WHERE id = (v_j->>'id')::uuid));
PERFORM pg_temp.chk('B3', 'y no quedó ningún aviso a medias', '0', pg_temp.cuantos()::text);

ALTER TABLE public.app_notifications DROP CONSTRAINT prueba_que_falle_el_aviso;


-- ══════════════════════════════════════════════════════════════════════════
-- C · Las acciones de Sistemas no avisan a los anfitriones
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.limpiar();
INSERT INTO public.gcx_testimonios (id, group_id, autor_id, temporada, anio, texto, estado,
                                    eliminacion_pedida_at, eliminacion_motivo, estado_antes_del_pedido, consentimiento_at)
VALUES
    (t6, g6, ana, 'S3', 2026, TEXTO, 'eliminacion_solicitada', now(), 'PRUEBA me arrepentí', 'publicado', now()),
    (t7, g7, ana, 'S3', 2026, TEXTO, 'eliminacion_solicitada', now(), NULL,                  'publicado', now()),
    (t8, g8, ana, 'S3', 2026, TEXTO, 'publicado',              NULL,  NULL,                  NULL,        now());

PERFORM pg_temp.sesion(eva);
PERFORM public.testimonios_admin_resolver(t8, 'ocultar');
PERFORM pg_temp.chk('C1', 'Sistemas oculta: ningún aviso a los anfitriones', '0', pg_temp.cuantos()::text);
PERFORM public.testimonios_admin_resolver(t8, 'mostrar');
PERFORM pg_temp.chk('C2', 'y vuelve a mostrarlo: tampoco', '0', pg_temp.cuantos()::text);
PERFORM public.testimonios_admin_resolver(t7, 'rechazar');
PERFORM pg_temp.chk('C3', 'rechazar un pedido: tampoco (no es un testimonio nuevo)', '0',
    pg_temp.cuantos()::text);


-- ══════════════════════════════════════════════════════════════════════════
-- D · El aviso a Sistemas lleva el id (ajuste B del prompt)
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.limpiar();
PERFORM pg_temp.sesion(ana);
PERFORM pg_temp.chk('D1', 'pedir la eliminación', 'true · false',
    (SELECT (j->>'ok') || ' · ' || (j->>'ya_solicitado')
       FROM (SELECT public.testimonios_solicitar_eliminacion(t8, 'PRUEBA el motivo') j) x));
PERFORM pg_temp.chk('D2', 'el aviso a Sistemas abre la tarjeta resaltada',
    'Ana Gómez PRUEBA pidió eliminar su testimonio de "GCX PRUEBA Ocultar". Ya no se ve mientras lo revisás. § /panel-admin?tab=testimonios&id=' || t8::text,
    pg_temp.avisos(eva, 'testimonios_eliminacion_solicitada'));
PERFORM pg_temp.chk('D3', 'y no le llega a quien lo pidió', '(ninguno)',
    pg_temp.avisos(ana, 'testimonios_eliminacion_solicitada'));


-- ══════════════════════════════════════════════════════════════════════════
-- E · "Se dio de baja con éxito" (ajuste C del prompt)
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.limpiar();
PERFORM pg_temp.sesion(eva);
PERFORM public.testimonios_admin_resolver(t6, 'eliminar');
PERFORM pg_temp.chk('E1', 'eliminar un pedido: "se dio de baja con éxito"',
    'Tu testimonio de GCX PRUEBA La Baja se dio de baja con éxito. § /perfil/testimonios',
    pg_temp.avisos(ana, 'testimonios_pedido_resuelto'));
PERFORM pg_temp.chk('E2', 'ya no dice "fue eliminado"', 'no',
    (SELECT CASE WHEN count(*) = 0 THEN 'no' ELSE 'TODAVÍA LO DICE' END
       FROM public.app_notifications
      WHERE alerta_clave = 'testimonios_pedido_resuelto' AND message ILIKE '%fue eliminado%'));

PERFORM pg_temp.limpiar();
-- Un pedido nuevo sobre el que quedó publicado, para rechazarlo.
PERFORM pg_temp.sesion(ana);
PERFORM public.testimonios_solicitar_eliminacion(t7, NULL);
PERFORM pg_temp.sesion(eva);
PERFORM public.testimonios_admin_resolver(t7, 'rechazar');
PERFORM pg_temp.chk('E3', 'rechazar: sigue diciendo "sigue publicado"',
    'Tu testimonio de GCX PRUEBA El Rechazo sigue publicado. § /perfil/testimonios',
    pg_temp.avisos(ana, 'testimonios_pedido_resuelto'));


-- ══════════════════════════════════════════════════════════════════════════
-- F · Quien apagó la alerta no recibe push, pero el aviso le queda en la app
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.limpiar();
PERFORM pg_temp.sesion(hugo);
PERFORM public.notif_silenciar(
    (SELECT id FROM public.notif_alertas WHERE clave = 'testimonios_nuevo_en_tu_gcx'), true);
PERFORM pg_temp.sesion(gus);
PERFORM public.testimonios_publicar_en(gA, 'PRUEBA con la alerta apagada.', true, AHORA);
SELECT id INTO v_av FROM public.app_notifications
 WHERE user_id = hugo AND alerta_clave = 'testimonios_nuevo_en_tu_gcx';
PERFORM pg_temp.chk('F1', 'el aviso IGUAL le queda en /notificaciones', '1', pg_temp.cuantos()::text);
PERFORM pg_temp.chk('F2', 'pero no suena: notif_puede_enviar dice silenciada', 'silenciada',
    public.notif_puede_enviar(v_av)->>'decision');


-- ══════════════════════════════════════════════════════════════════════════
-- G · La alerta en el catálogo, y los permisos sin tocar
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.chk('G1', 'la alerta está, es de GCX, apagable y automática',
    'automatica · GCX · sí · TESTIMONIO_NUEVO',
    (SELECT tipo || ' · ' || area || ' · ' || CASE WHEN permite_apagar THEN 'sí' ELSE 'no' END
            || ' · ' || type_legacy
       FROM public.notif_alertas WHERE clave = 'testimonios_nuevo_en_tu_gcx'));
PERFORM pg_temp.chk('G2', 'el título y el mensaje pedidos',
    'Nuevo testimonio en tu GCX § {nombre} dejó un testimonio en {grupo}.',
    (SELECT titulo_plantilla || ' § ' || mensaje_plantilla
       FROM public.notif_alertas WHERE clave = 'testimonios_nuevo_en_tu_gcx'));
PERFORM pg_temp.chk('G3', 'usa sólo sus propias variables', 'sí',
    (SELECT CASE WHEN count(*) = 0 THEN 'sí' ELSE 'no: ' || string_agg(m[1], ', ') END
       FROM public.notif_alertas a,
            regexp_matches(a.titulo_plantilla || ' ' || a.mensaje_plantilla, '\{([a-z_]+)\}', 'g') m
      WHERE a.clave = 'testimonios_nuevo_en_tu_gcx'
        AND NOT (m[1] = ANY (a.variables))));
PERFORM pg_temp.chk('G4', 'el catálogo quedó con 24 automáticas', '24',
    (SELECT count(*)::text FROM public.notif_alertas WHERE tipo = 'automatica'));
PERFORM pg_temp.chk('G5', 'las tres alertas de testimonios, activas y sin eliminar', '3',
    (SELECT count(*)::text FROM public.notif_alertas
      WHERE clave LIKE 'testimonios_%' AND activa AND eliminada_at IS NULL));

-- Los permisos: la gemela `_en` no la puede llamar nadie de afuera, y las dos
-- RPC siguen abiertas sólo a authenticated (adentro chequean el rol).
PERFORM pg_temp.chk('G6', 'testimonios_publicar_en: anon y authenticated, no', 'no · no',
    CASE WHEN has_function_privilege('anon', 'public.testimonios_publicar_en(text,text,boolean,timestamptz)', 'EXECUTE')
         THEN 'SÍ' ELSE 'no' END || ' · ' ||
    CASE WHEN has_function_privilege('authenticated', 'public.testimonios_publicar_en(text,text,boolean,timestamptz)', 'EXECUTE')
         THEN 'SÍ' ELSE 'no' END);
PERFORM pg_temp.chk('G7', 'testimonios_publicar: authenticated sí, anon no', 'sí · no',
    CASE WHEN has_function_privilege('authenticated', 'public.testimonios_publicar(text,text,boolean)', 'EXECUTE')
         THEN 'sí' ELSE 'NO' END || ' · ' ||
    CASE WHEN has_function_privilege('anon', 'public.testimonios_publicar(text,text,boolean)', 'EXECUTE')
         THEN 'SÍ' ELSE 'no' END);
PERFORM pg_temp.chk('G8', 'solicitar_eliminacion y admin_resolver: authenticated sí, anon no',
    'sí · no · sí · no',
    CASE WHEN has_function_privilege('authenticated', 'public.testimonios_solicitar_eliminacion(uuid,text)', 'EXECUTE') THEN 'sí' ELSE 'NO' END || ' · ' ||
    CASE WHEN has_function_privilege('anon',          'public.testimonios_solicitar_eliminacion(uuid,text)', 'EXECUTE') THEN 'SÍ' ELSE 'no' END || ' · ' ||
    CASE WHEN has_function_privilege('authenticated', 'public.testimonios_admin_resolver(uuid,text)', 'EXECUTE') THEN 'sí' ELSE 'NO' END || ' · ' ||
    CASE WHEN has_function_privilege('anon',          'public.testimonios_admin_resolver(uuid,text)', 'EXECUTE') THEN 'SÍ' ELSE 'no' END);
PERFORM pg_temp.chk('G9', 'notif_emitir sigue cerrada a anon y authenticated', 'no · no',
    CASE WHEN has_function_privilege('anon', 'public.notif_emitir(text,uuid,jsonb,text,uuid)', 'EXECUTE') THEN 'SÍ' ELSE 'no' END || ' · ' ||
    CASE WHEN has_function_privilege('authenticated', 'public.notif_emitir(text,uuid,jsonb,text,uuid)', 'EXECUTE') THEN 'SÍ' ELSE 'no' END);

-- Nadie que no sea Sistemas puede resolver, ni la autora.
PERFORM pg_temp.sesion(ana);
PERFORM pg_temp.chk('G10', 'ni la autora resuelve su propio pedido', 'no_autorizado',
    public.testimonios_admin_resolver(t7, 'eliminar')->>'motivo');
PERFORM pg_temp.sesion(hugo);
PERFORM pg_temp.chk('G11', 'ni el anfitrión del GCX', 'no_autorizado',
    public.testimonios_admin_resolver(t7, 'eliminar')->>'motivo');
PERFORM pg_temp.sesion(NULL);
PERFORM pg_temp.chk('G12', 'ni nadie sin sesión', 'sin_sesion',
    public.testimonios_admin_resolver(t7, 'eliminar')->>'motivo');
-- Y pedir la eliminación de algo ajeno, nunca.
PERFORM pg_temp.sesion(gus);
PERFORM pg_temp.chk('G13', 'nadie pide eliminar el testimonio de otro', 'no_es_tuyo',
    public.testimonios_solicitar_eliminacion(t7, NULL)->>'motivo');


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
