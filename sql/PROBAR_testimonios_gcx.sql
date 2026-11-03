-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de sql/testimonios_gcx.sql
--
-- BEGIN … ROLLBACK con un RAISE EXCEPTION al final: se deshace todo, incluida
-- la cola de pg_net. NO SALE NINGÚN PUSH NI EMAIL. NUNCA COMMIT. Personas,
-- grupos e inscripciones "PRUEBA", con los triggers que avisan apagados
-- dentro de la transacción.
--
-- Las fechas de temporada salen de la configuración de producción
-- (S3: 05/10 – 29/11). Si Sistemas la cambia, los casos T se tienen que
-- actualizar.
--
-- QUÉ PRUEBA
--   T · La temporada vigente: en curso, 10 y 40 días después, cambio de año,
--       los bordes del plazo, la configuración y la regla de la app.
--   P · Publicar: quién puede, qué texto, el consentimiento, el plazo y el tope.
--   L · Lectura pública: qué ve anon, la búsqueda y que no salga ningún dato
--       personal además del nombre y la foto.
--   C · Corazón: dar, quitar, repetir, sin sesión, sobre uno oculto y el tope.
--   E · El pedido de eliminación y el aviso a Sistemas.
--   A · Sistemas: listar y resolver, y que un usuario común no pueda.
--   M · Mis GCX y mis testimonios.
--   N · Menores: "Nombre I." en todo lo público, la búsqueda y la vista previa.
--   H · Anfitrión y co-anfitrión también publican; el grupo una sola vez.
--   U · La auditoría no guarda el texto; el resto de la app audita igual.
--   X · Permisos de tablas y funciones.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE TEMP TABLE r (orden serial, n text, caso text, esperado text, obtenido text);
GRANT ALL ON r TO anon, authenticated;
GRANT USAGE ON SEQUENCE r_orden_seq TO anon, authenticated;

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

-- La temporada vigente en una línea: "S3 2026 · en curso · abierta hasta 2026-12-29".
CREATE FUNCTION pg_temp.temp(p timestamptz) RETURNS text LANGUAGE sql AS $f$
    SELECT (t->>'temporada') || ' ' || (t->>'anio') || ' · '
        || CASE WHEN (t->>'en_curso')::boolean THEN 'en curso' ELSE 'terminada' END || ' · '
        || CASE WHEN (t->>'carga_abierta')::boolean THEN 'abierta' ELSE 'cerrada' END
        || ' hasta ' || (t->>'carga_hasta')
      FROM (SELECT public.testimonios_temporada_en(p) AS t) x;
$f$;

DO $suite$
DECLARE
    AHORA   constant timestamptz := pg_temp.ar('2026-11-02 12:00');
    eva  uuid := gen_random_uuid();   -- SUPER_ADMIN
    hugo uuid := gen_random_uuid();   -- anfitrión de G1
    ana  uuid := gen_random_uuid();   -- aprobada en G1; pareja aprobada en G2
    pablo uuid := gen_random_uuid();  -- titular de la inscripción de pareja de G2
    beto uuid := gen_random_uuid();   -- pendiente en G1
    caro uuid := gen_random_uuid();   -- rechazada en G1
    dani uuid := gen_random_uuid();   -- aprobada en un GCX de la Segunda
    gus  uuid := gen_random_uuid();   -- aprobado en G1, para el consentimiento y el plazo
    fede uuid := gen_random_uuid();   -- aprobado en seis GCX, para el tope diario
    ivo  uuid := gen_random_uuid();   -- para el tope de corazones
    nina uuid := gen_random_uuid();   -- aprobada en G1, sin nombre
    sofi uuid := gen_random_uuid();   -- menor (14), aprobada en G1
    tomi uuid := gen_random_uuid();   -- sin fecha de nacimiento, aprobado en G1
    carla uuid := gen_random_uuid();  -- co-anfitriona de G1 (con cuenta)
    t_sofi uuid;
    g1 text := gen_random_uuid()::text;
    g2 text := gen_random_uuid()::text;
    gv text := gen_random_uuid()::text;
    gt text[] := ARRAY[]::text[];
    gx text;
    v_j jsonb; v_k jsonb; v_t text; v_n integer; v_m integer; i integer;
    t_ana1 uuid; t_ana2 uuid; t_gus uuid;
    v_cfg jsonb;
    v_todo text;
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
-- Con sql/testimonios_habilitar.sql instalado, las dos páginas prendidas
-- dentro de la transacción: esta suite prueba lo de adentro, no los botones
-- (esos están en PROBAR_testimonios_habilitar.sql).
IF to_regclass('public.testimonios_habilitacion') IS NOT NULL THEN
    EXECUTE 'UPDATE public.testimonios_habilitacion SET habilitada = true';
END IF;

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
SELECT x, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'prueba.testim.' || left(x::text, 8) || '@test.local', '', now(), now()
  FROM unnest(ARRAY[eva, hugo, ana, pablo, beto, caro, dani, gus, fede, ivo, nina, sofi, tomi, carla]) x;
-- Los adultos con fecha de nacimiento: sin fecha se verían como menores.
INSERT INTO public.users (id, name, email, role, roles, is_active, gender, avatar_url, birth_date) VALUES
    (eva,   'Eva PRUEBA',        'prueba.testim.eva@test.local',   'SUPER_ADMIN', ARRAY['SUPER_ADMIN'], true, 'Femenino', NULL, '1985-04-10'),
    (hugo,  'Hugo PRUEBA',       'prueba.testim.hugo@test.local',  'VIEWER', ARRAY['VIEWER'], true, 'Masculino', 'https://ejemplo.prueba/hugo.jpg', '1980-01-15'),
    (ana,   'Ana Gómez PRUEBA',  'prueba.testim.ana@test.local',   'VIEWER', ARRAY['VIEWER'], true, 'Femenino', 'https://ejemplo.prueba/ana.jpg', '1990-05-10'),
    (pablo, 'Pablo PRUEBA',      'prueba.testim.pablo@test.local', 'VIEWER', ARRAY['VIEWER'], true, 'Masculino', NULL, '1989-02-02'),
    (beto,  'Beto PRUEBA',       'prueba.testim.beto@test.local',  'VIEWER', ARRAY['VIEWER'], true, 'Masculino', NULL, '1995-03-03'),
    (caro,  'Caro PRUEBA',       'prueba.testim.caro@test.local',  'VIEWER', ARRAY['VIEWER'], true, 'Femenino', NULL, '1995-03-03'),
    (dani,  'Dani PRUEBA',       'prueba.testim.dani@test.local',  'VIEWER', ARRAY['VIEWER'], true, NULL, NULL, '1995-03-03'),
    (gus,   'Gus PRUEBA',        'prueba.testim.gus@test.local',   'VIEWER', ARRAY['VIEWER'], true, 'Masculino', NULL, '1975-07-07'),
    (fede,  'Fede PRUEBA',       'prueba.testim.fede@test.local',  'VIEWER', ARRAY['VIEWER'], true, 'Masculino', NULL, '1995-03-03'),
    (ivo,   'Ivo PRUEBA',        'prueba.testim.ivo@test.local',   'VIEWER', ARRAY['VIEWER'], true, 'Masculino', NULL, '1995-03-03'),
    (nina,  '   ',               'prueba.testim.nina@test.local',  'VIEWER', ARRAY['VIEWER'], true, 'Femenino', NULL, '1995-03-03'),
    (sofi,  'Sofía Gómez PRUEBA','prueba.testim.sofi@test.local',  'VIEWER', ARRAY['VIEWER'], true, 'Femenino', NULL, '2012-03-01'),
    (tomi,  'Tomás Ríos PRUEBA', 'prueba.testim.tomi@test.local',  'VIEWER', ARRAY['VIEWER'], true, 'Masculino', NULL, NULL),
    (carla, 'Carla Co PRUEBA',   'prueba.testim.carla@test.local', 'VIEWER', ARRAY['VIEWER'], true, 'Femenino', NULL, '1988-08-08')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, roles = EXCLUDED.roles,
    is_active = true, gender = EXCLUDED.gender, avatar_url = EXCLUDED.avatar_url, birth_date = EXCLUDED.birth_date;

INSERT INTO public.groups (id, name, leader_name, status, start_date, host_id, co_host_id, co_host_first_name, co_host_last_name,
                           description, image_url, is_hidden) VALUES
    (g1, 'PRUEBA Testimonios Uno',   'Hugo', 'approved', '2026-10-06', hugo, carla, 'Carla', 'Co PRUEBA',
     'Descripción PRUEBA del grupo uno, completa.', 'https://ejemplo.prueba/portada-uno.jpg', true),
    (g2, 'PRUEBA Testimonios Dos',   'Eva',  'approved', '2026-10-10', eva,  NULL, NULL, NULL, 'PRUEBA dos', '', true),
    (gv, 'PRUEBA Testimonios Viejo', 'Eva',  'approved', '2026-07-01', eva,  NULL, NULL, NULL, 'PRUEBA viejo', NULL, true);
FOR i IN 1..6 LOOP
    gx := gen_random_uuid()::text;
    gt := gt || gx;
    INSERT INTO public.groups (id, name, leader_name, status, start_date, host_id, is_hidden)
    VALUES (gx, 'PRUEBA Testimonios Tope ' || i, 'Eva', 'approved', '2026-10-0' || (5 + (i % 4)), eva, true);
END LOOP;

INSERT INTO public.group_registrations (id, first_name, last_name, email, group_id, user_id, partner_user_id, status, approved_at) VALUES
    (gen_random_uuid()::text, 'Ana',   'PRUEBA', 'prueba.testim.ana@test.local',   g1, ana,   NULL, 'APPROVED', now()),
    (gen_random_uuid()::text, 'Pablo', 'PRUEBA', 'prueba.testim.pablo@test.local', g2, pablo, ana,  'APPROVED', now()),
    (gen_random_uuid()::text, 'Beto',  'PRUEBA', 'prueba.testim.beto@test.local',  g1, beto,  NULL, 'PENDING', NULL),
    (gen_random_uuid()::text, 'Caro',  'PRUEBA', 'prueba.testim.caro@test.local',  g1, caro,  NULL, 'REJECTED', NULL),
    (gen_random_uuid()::text, 'Dani',  'PRUEBA', 'prueba.testim.dani@test.local',  gv, dani,  NULL, 'APPROVED', now()),
    (gen_random_uuid()::text, 'Gus',   'PRUEBA', 'prueba.testim.gus@test.local',   g1, gus,   NULL, 'APPROVED', now()),
    (gen_random_uuid()::text, 'Nina',  'PRUEBA', 'prueba.testim.nina@test.local',  g1, nina,  NULL, 'APPROVED', now()),
    (gen_random_uuid()::text, 'Sofía', 'PRUEBA', 'prueba.testim.sofi@test.local',  g1, sofi,  NULL, 'APPROVED', now()),
    (gen_random_uuid()::text, 'Tomás', 'PRUEBA', 'prueba.testim.tomi@test.local',  g1, tomi,  NULL, 'APPROVED', now()),
    -- Hugo es el anfitrión de G1 y además está inscripto en él.
    (gen_random_uuid()::text, 'Hugo',  'PRUEBA', 'prueba.testim.hugo@test.local',  g1, hugo,  NULL, 'APPROVED', now());
INSERT INTO public.group_registrations (id, first_name, last_name, email, group_id, user_id, status, approved_at)
SELECT gen_random_uuid()::text, 'Fede', 'PRUEBA', 'prueba.testim.fede@test.local', x, fede, 'APPROVED', now()
  FROM unnest(gt) x;

-- ══════════════════════════════════════════════════════════════════════════
-- T · La temporada vigente
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.chk('T1', 'temporada en curso (2/11/2026)', 'S3 2026 · en curso · abierta hasta 2026-12-29', pg_temp.temp(AHORA));
PERFORM pg_temp.chk('T2', 'terminó hace 10 días (9/12): la carga sigue abierta', 'S3 2026 · terminada · abierta hasta 2026-12-29',
    pg_temp.temp(pg_temp.ar('2026-12-09 12:00')));
PERFORM pg_temp.chk('T3', 'terminó hace 40 días (8/1/2027): carga cerrada, sigue vigente', 'S3 2026 · terminada · cerrada hasta 2026-12-29',
    pg_temp.temp(pg_temp.ar('2027-01-08 12:00')));
PERFORM pg_temp.chk('T4', 'cambio de año (2/1/2027): la Tercera del año anterior', 'S3 2026 · terminada · cerrada hasta 2026-12-29',
    pg_temp.temp(pg_temp.ar('2027-01-02 10:00')));
PERFORM pg_temp.chk('T5', 'último día del plazo, 23:30 hora argentina', 'abierta',
    CASE WHEN (public.testimonios_temporada_en(pg_temp.ar('2026-12-29 23:30'))->>'carga_abierta')::boolean THEN 'abierta' ELSE 'cerrada' END);
PERFORM pg_temp.chk('T6', 'el día siguiente, 00:30 hora argentina', 'cerrada',
    CASE WHEN (public.testimonios_temporada_en(pg_temp.ar('2026-12-30 00:30'))->>'carga_abierta')::boolean THEN 'abierta' ELSE 'cerrada' END);
PERFORM pg_temp.chk('T7', 'empieza la Primera 2027: reemplaza a la Tercera 2026', 'S1 2027 · en curso · abierta hasta 2027-06-17',
    pg_temp.temp(pg_temp.ar('2027-03-23 08:00')));
PERFORM pg_temp.chk('T8', 'entre la Segunda y la Tercera (25/9): Segunda, carga cerrada', 'S2 2026 · terminada · cerrada hasta 2026-09-23',
    pg_temp.temp(pg_temp.ar('2026-09-25 12:00')));
PERFORM pg_temp.chk('T9', 'nombre y año para la pantalla', 'Tercera temporada · 2026',
    (SELECT (t->>'nombre') || ' · ' || (t->>'anio') FROM (SELECT public.testimonios_temporada_en(AHORA) t) x));
-- La configuración manda (se cambia dentro de la transacción y se deshace).
SELECT config INTO v_cfg FROM public.app_config WHERE id = 'global';
UPDATE public.app_config
   SET config = jsonb_set(config, '{groupsConfig,seasonSettings,seasons,S3,endDate}', '"11-15"')
 WHERE id = 'global';
PERFORM pg_temp.chk('T10', 'si Sistemas cambia el fin de la Tercera al 15/11, el plazo es el 15/12', 'S3 2026 · terminada · abierta hasta 2026-12-15',
    pg_temp.temp(pg_temp.ar('2026-11-20 12:00')));
UPDATE public.app_config
   SET config = jsonb_set(config, '{groupsConfig,seasonSettings,seasons,S3,startDate}', '"xx"')
 WHERE id = 'global';
PERFORM pg_temp.chk('T11', 'una fecha mal escrita en la configuración: la de siempre (5/10)', '2026-10-05',
    public.testimonios_temporada_en(AHORA)->>'inicio');
UPDATE public.app_config SET config = v_cfg WHERE id = 'global';
PERFORM pg_temp.chk('T12', 'la regla de la app (getSeasonFromDate) en los bordes',
    'S1 S1 S1 - S2 S3 S3 - - -',
    concat_ws(' ',
        COALESCE(public.testimonios_temporada_de_fecha('2026-03-23'), '-'),
        COALESCE(public.testimonios_temporada_de_fecha('2026-05-18'), '-'),
        COALESCE(public.testimonios_temporada_de_fecha('2026-05-31'), '-'),
        COALESCE(public.testimonios_temporada_de_fecha('2026-06-01'), '-'),
        COALESCE(public.testimonios_temporada_de_fecha('2026-08-23'), '-'),
        COALESCE(public.testimonios_temporada_de_fecha('2026-10-05'), '-'),
        COALESCE(public.testimonios_temporada_de_fecha('2026-11-29'), '-'),
        COALESCE(public.testimonios_temporada_de_fecha('2026-11-30'), '-'),
        COALESCE(public.testimonios_temporada_de_fecha('2026-10-05T12:00'), '-'),
        COALESCE(public.testimonios_temporada_de_fecha('basura'), '-')));
PERFORM pg_temp.sesion(NULL);
PERFORM pg_temp.chk('T13', 'testimonios_temporada() contesta sin sesión', 'true', (public.testimonios_temporada()->>'ok'));

-- ══════════════════════════════════════════════════════════════════════════
-- P · Publicar
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.sesion(ana);
v_j := public.testimonios_publicar_en(g1, '  Fue un lugar seguro. PRUEBA  ', true, AHORA);
t_ana1 := (v_j->>'id')::uuid;
PERFORM pg_temp.chk('P1', 'aprobada publica', 'true · PRUEBA Testimonios Uno', (v_j->>'ok') || ' · ' || (v_j->>'grupo'));
PERFORM pg_temp.chk('P2', 'se guarda sin los espacios, con su temporada y el consentimiento', 'Fue un lugar seguro. PRUEBA · S3 2026 · con fecha',
    (SELECT texto || ' · ' || temporada || ' ' || anio || ' · ' || CASE WHEN consentimiento_at IS NOT NULL THEN 'con fecha' ELSE 'SIN FECHA' END
       FROM public.gcx_testimonios WHERE id = t_ana1));
PERFORM pg_temp.sesion(beto);
PERFORM pg_temp.chk('P3', 'inscripción pendiente', 'no_inscripto', public.testimonios_publicar_en(g1, 'Hola', true, AHORA)->>'motivo');
PERFORM pg_temp.sesion(caro);
PERFORM pg_temp.chk('P4', 'inscripción rechazada', 'no_inscripto', public.testimonios_publicar_en(g1, 'Hola', true, AHORA)->>'motivo');
PERFORM pg_temp.sesion(dani);
PERFORM pg_temp.chk('P5', 'GCX de otra temporada (Segunda 2026)', 'fuera_de_temporada', public.testimonios_publicar_en(gv, 'Hola', true, AHORA)->>'motivo');
PERFORM pg_temp.sesion(ana);
PERFORM pg_temp.chk('P6', 'duplicado con otro texto', 'ya_publicado', public.testimonios_publicar_en(g1, 'Otro texto', true, AHORA)->>'motivo');
v_j := public.testimonios_publicar_en(g1, 'Fue un lugar seguro. PRUEBA', true, AHORA);
PERFORM pg_temp.chk('P7', 'reintento con el mismo texto: devuelve el mismo', 'true · true · mismo id',
    (v_j->>'ok') || ' · ' || (v_j->>'ya_existia') || ' · ' || CASE WHEN (v_j->>'id')::uuid = t_ana1 THEN 'mismo id' ELSE 'OTRO' END);
PERFORM pg_temp.chk('P8', '1001 caracteres', 'texto_invalido', public.testimonios_publicar_en(g2, repeat('a', 1001), true, AHORA)->>'motivo');
PERFORM pg_temp.chk('P9', 'sólo espacios y saltos de línea', 'texto_invalido', public.testimonios_publicar_en(g2, E'  \n\t ', true, AHORA)->>'motivo');
v_j := public.testimonios_publicar_en(g2, E'\n  ' || repeat('b', 1000) || E'  \n', true, AHORA);
t_ana2 := (v_j->>'id')::uuid;
PERFORM pg_temp.chk('P10', 'pareja inscripta (partner_user_id) con 1000 caracteres entre espacios', 'true · 1000',
    (v_j->>'ok') || ' · ' || (SELECT char_length(texto) FROM public.gcx_testimonios WHERE id = t_ana2));
PERFORM pg_temp.sesion(gus);
PERFORM pg_temp.chk('P11', 'sin consentimiento', 'sin_consentimiento · sin_consentimiento',
    (public.testimonios_publicar_en(g1, 'Hola', false, AHORA)->>'motivo') || ' · '
    || (public.testimonios_publicar_en(g1, 'Hola', NULL, AHORA)->>'motivo'));
PERFORM pg_temp.chk('P12', 'fuera de plazo (8/1/2027)', 'fuera_de_plazo',
    public.testimonios_publicar_en(g1, 'Hola', true, pg_temp.ar('2027-01-08 12:00'))->>'motivo');
v_j := public.testimonios_publicar_en(g1, 'Gracias PRUEBA', true, pg_temp.ar('2026-12-09 12:00'));
t_gus := (v_j->>'id')::uuid;
PERFORM pg_temp.chk('P13', '10 días después del fin: todavía se puede', 'true', v_j->>'ok');
PERFORM pg_temp.sesion(fede);
FOR i IN 1..5 LOOP
    v_t := public.testimonios_publicar_en(gt[i], 'PRUEBA tope ' || i, true, AHORA)->>'ok';
END LOOP;
PERFORM pg_temp.chk('P14', 'el sexto del día', 'tope · 5',
    (SELECT (j->>'motivo') || ' · ' || (j->>'limite') FROM (SELECT public.testimonios_publicar_en(gt[6], 'PRUEBA tope 6', true, AHORA) j) x));
PERFORM pg_temp.sesion(nina);
PERFORM pg_temp.chk('P15', 'cuenta sin nombre', 'sin_nombre', public.testimonios_publicar_en(g1, 'Hola', true, AHORA)->>'motivo');
PERFORM pg_temp.sesion(NULL);
PERFORM pg_temp.chk('P16', 'sin sesión', 'sin_sesion', public.testimonios_publicar_en(g1, 'Hola', true, AHORA)->>'motivo');
PERFORM pg_temp.sesion(ana);
PERFORM pg_temp.chk('P17', 'un GCX que no existe', 'no_existe', public.testimonios_publicar_en('no-existe-PRUEBA', 'Hola', true, AHORA)->>'motivo');
-- La base también lo frena aunque alguien escriba directo.
BEGIN
    INSERT INTO public.gcx_testimonios (group_id, autor_id, temporada, anio, texto, consentimiento_at)
    VALUES (gt[6], gus, 'S3', 2026, ' con espacio', now());
    v_t := 'entró';
EXCEPTION WHEN check_violation THEN v_t := 'frenado';
END;
PERFORM pg_temp.chk('P18', 'CHECK: texto con espacio al principio', 'frenado', v_t);

-- ══════════════════════════════════════════════════════════════════════════
-- L · Lectura pública
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.sesion(NULL);
v_j := public.testimonios_grupo_en(g1, AHORA);
PERFORM pg_temp.chk('L1', 'anon ve los publicados de G1, más nuevos primero', 'true · Gus PRUEBA, Ana Gómez PRUEBA',
    (v_j->>'ok') || ' · ' || (SELECT string_agg(x->>'autor', ', ' ORDER BY o) FROM jsonb_array_elements(v_j->'testimonios') WITH ORDINALITY e(x, o)));
PERFORM pg_temp.chk('L2', 'anon: ni yo_di ni es_mio', 'false · false',
    (v_j->'testimonios'->1->>'yo_di') || ' · ' || (v_j->'testimonios'->1->>'es_mio'));
PERFORM pg_temp.chk('L3', 'el grupo: descripción completa, portada y anfitriones con foto y rol',
    'Descripción PRUEBA del grupo uno, completa. · https://ejemplo.prueba/portada-uno.jpg · Hugo PRUEBA (Anfitrión, https://ejemplo.prueba/hugo.jpg) + Carla Co PRUEBA (Co-anfitriona, sin foto)',
    (v_j->'grupo'->>'descripcion') || ' · ' || (v_j->'grupo'->>'portada') || ' · '
    || (SELECT string_agg((h->>'nombre') || ' (' || (h->>'rol') || ', ' || COALESCE(h->>'foto', 'sin foto') || ')', ' + ' ORDER BY o)
          FROM jsonb_array_elements(v_j->'grupo'->'anfitriones') WITH ORDINALITY e(h, o)));
PERFORM pg_temp.chk('L4', 'el detalle de un GCX de otra temporada', 'fuera_de_temporada', public.testimonios_grupo_en(gv, AHORA)->>'motivo');
PERFORM pg_temp.chk('L5', 'el detalle de uno que no existe', 'no_existe', public.testimonios_grupo_en('no-existe-PRUEBA', AHORA)->>'motivo');
v_j := public.testimonios_grupos_en(NULL, AHORA);
PERFORM pg_temp.chk('L6', 'la galería trae TODOS los GCX de la temporada, tengan o no testimonios (y no el de la Segunda)',
    'Dos:1 · Tope 6:0 · Uno:2 · Viejo:no',
    (SELECT string_agg(replace(x->>'nombre', 'PRUEBA Testimonios ', '') || ':' || (x->>'testimonios'), ' · ' ORDER BY x->>'nombre')
       FROM jsonb_array_elements(v_j->'grupos') x WHERE x->>'id' IN (g1, g2, gt[6]))
    || ' · Viejo:' || CASE WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(v_j->'grupos') x WHERE x->>'id' = gv) THEN 'SÍ' ELSE 'no' END);
v_j := public.testimonios_grupos_en('  GOMEZ   prueba ', AHORA);
PERFORM pg_temp.chk('L7', 'buscar a quien escribió, sin acentos ni mayúsculas: dice por qué', 'Dos:testimonio:["Ana Gómez PRUEBA"]:1 | Uno:testimonio:["Ana Gómez PRUEBA"]:1',
    (SELECT string_agg(replace(x->>'nombre', 'PRUEBA Testimonios ', '') || ':' || (x->>'coincide') || ':' || (x->>'autores') || ':' || (x->>'autores_total'), ' | ' ORDER BY x->>'nombre')
       FROM jsonb_array_elements(v_j->'grupos') x WHERE x->>'id' IN (g1, g2)));
v_j := public.testimonios_grupos_en('hugo prueba', AHORA);
PERFORM pg_temp.chk('L8', 'buscar por anfitrión', 'Uno:anfitrion',
    (SELECT string_agg(replace(x->>'nombre', 'PRUEBA Testimonios ', '') || ':' || (x->>'coincide'), ' | ')
       FROM jsonb_array_elements(v_j->'grupos') x WHERE x->>'id' IN (g1, g2, gv)));
v_j := public.testimonios_grupos_en('carla co', AHORA);
PERFORM pg_temp.chk('L9', 'buscar por co-anfitrión (el nombre de las columnas del grupo)', 'Uno:anfitrion',
    (SELECT string_agg(replace(x->>'nombre', 'PRUEBA Testimonios ', '') || ':' || (x->>'coincide'), ' | ')
       FROM jsonb_array_elements(v_j->'grupos') x WHERE x->>'id' IN (g1, g2, gv)));
v_j := public.testimonios_grupos_en('testimonios dos', AHORA);
PERFORM pg_temp.chk('L10', 'buscar por nombre del GCX', 'Dos:grupo',
    (SELECT string_agg(replace(x->>'nombre', 'PRUEBA Testimonios ', '') || ':' || (x->>'coincide'), ' | ')
       FROM jsonb_array_elements(v_j->'grupos') x WHERE x->>'id' IN (g1, g2, gv)));
PERFORM pg_temp.chk('L11', 'buscar algo que no está', '0',
    jsonb_array_length(public.testimonios_grupos_en('zzz-no-hay-PRUEBA', AHORA)->'grupos')::text);
PERFORM pg_temp.sesion(ana);
v_j := public.testimonios_grupo_en(g1, AHORA);
PERFORM pg_temp.chk('L12', 'con sesión, el mío dice es_mio', 'Ana Gómez PRUEBA:true · Gus PRUEBA:false',
    (SELECT string_agg((x->>'autor') || ':' || (x->>'es_mio'), ' · ' ORDER BY x->>'autor') FROM jsonb_array_elements(v_j->'testimonios') x));
-- Ningún dato personal además del nombre y la foto, con y sin sesión.
PERFORM pg_temp.sesion(NULL);
v_todo := public.testimonios_grupos_en(NULL, AHORA)::text || public.testimonios_grupos_en('prueba', AHORA)::text
       || public.testimonios_grupo_en(g1, AHORA)::text || public.testimonios_grupo_en(g2, AHORA)::text
       || public.testimonios_temporada()::text;
PERFORM pg_temp.sesion(beto);
v_todo := v_todo || public.testimonios_grupo_en(g1, AHORA)::text || public.testimonios_grupos_en('gomez', AHORA)::text;
PERFORM pg_temp.chk('L13', 'las funciones públicas no devuelven ids de usuario, emails ni teléfonos', 'ninguno',
    CASE WHEN EXISTS (SELECT 1 FROM unnest(ARRAY[eva, hugo, ana, pablo, beto, caro, dani, gus, fede, ivo, nina]) u
                       WHERE position(u::text IN v_todo) > 0)
              OR position('@' IN v_todo) > 0
              OR position('test.local' IN v_todo) > 0
         THEN 'APARECE ALGO' ELSE 'ninguno' END);

-- ══════════════════════════════════════════════════════════════════════════
-- C · Corazón
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.sesion(beto);
PERFORM pg_temp.chk('C1', 'dar', 'true · 1', (SELECT (j->>'di') || ' · ' || (j->>'corazones') FROM (SELECT public.testimonios_corazon_en(t_ana1, true, AHORA) j) x));
PERFORM pg_temp.chk('C2', 'dar otra vez (idempotente)', 'true · 1', (SELECT (j->>'di') || ' · ' || (j->>'corazones') FROM (SELECT public.testimonios_corazon_en(t_ana1, true, AHORA) j) x));
PERFORM pg_temp.chk('C3', 'el detalle dice que yo di', 'true · 1',
    (SELECT (x->>'yo_di') || ' · ' || (x->>'corazones') FROM jsonb_array_elements(public.testimonios_grupo_en(g1, AHORA)->'testimonios') x WHERE (x->>'id')::uuid = t_ana1));
PERFORM pg_temp.chk('C4', 'quitar y quitar otra vez', '0 · 0',
    (public.testimonios_corazon_en(t_ana1, false, AHORA)->>'corazones') || ' · ' || (public.testimonios_corazon_en(t_ana1, false, AHORA)->>'corazones'));
PERFORM pg_temp.sesion(NULL);
PERFORM pg_temp.chk('C5', 'sin sesión', 'sin_sesion', public.testimonios_corazon_en(t_ana1, true, AHORA)->>'motivo');
UPDATE public.gcx_testimonios SET estado = 'oculto' WHERE id = t_gus;
PERFORM pg_temp.sesion(beto);
PERFORM pg_temp.chk('C6', 'sobre uno oculto', 'no_existe', public.testimonios_corazon_en(t_gus, true, AHORA)->>'motivo');
UPDATE public.gcx_testimonios SET estado = 'publicado' WHERE id = t_gus;
PERFORM pg_temp.chk('C7', 'sobre uno que no existe', 'no_existe', public.testimonios_corazon_en(gen_random_uuid(), true, AHORA)->>'motivo');
PERFORM pg_temp.sesion(ivo);
v_n := 0;
FOR i IN 1..30 LOOP
    IF (public.testimonios_corazon_en(t_gus, (i % 2 = 1), AHORA)->>'ok')::boolean THEN v_n := v_n + 1; END IF;
END LOOP;
PERFORM pg_temp.chk('C8', '30 toques en un minuto pasan; el 31 no', '30 · tope',
    v_n || ' · ' || (public.testimonios_corazon_en(t_gus, true, AHORA)->>'motivo'));
PERFORM pg_temp.chk('C9', 'al minuto siguiente, sí', 'true',
    public.testimonios_corazon_en(t_gus, true, AHORA + interval '1 minute')->>'ok');

-- ══════════════════════════════════════════════════════════════════════════
-- E · Pedido de eliminación y aviso a Sistemas
-- ══════════════════════════════════════════════════════════════════════════
SELECT count(*) INTO v_m FROM public.app_notifications WHERE alerta_clave = 'testimonios_eliminacion_solicitada';
PERFORM pg_temp.sesion(beto);
PERFORM pg_temp.chk('E1', 'pedir eliminar uno ajeno', 'no_es_tuyo', public.testimonios_solicitar_eliminacion(t_ana1, NULL)->>'motivo');
PERFORM pg_temp.chk('E2', 'pedir eliminar uno que no existe', 'no_existe', public.testimonios_solicitar_eliminacion(gen_random_uuid(), NULL)->>'motivo');
PERFORM pg_temp.sesion(NULL);
PERFORM pg_temp.chk('E3', 'sin sesión', 'sin_sesion', public.testimonios_solicitar_eliminacion(t_ana1, NULL)->>'motivo');
PERFORM pg_temp.sesion(ana);
PERFORM pg_temp.chk('E4', 'un motivo de más de 500', 'motivo_largo', public.testimonios_solicitar_eliminacion(t_ana2, repeat('m', 501))->>'motivo');
-- Beto da corazón antes, para ver que se va con el testimonio.
PERFORM pg_temp.sesion(beto);
PERFORM public.testimonios_corazon_en(t_ana1, true, AHORA);
PERFORM pg_temp.sesion(ana);
v_j := public.testimonios_solicitar_eliminacion(t_ana1, '  Prefiero que no esté. PRUEBA  ');
PERFORM pg_temp.chk('E5', 'la autora lo pide', 'true · false · eliminacion_solicitada · Prefiero que no esté. PRUEBA',
    (v_j->>'ok') || ' · ' || (v_j->>'ya_solicitado') || ' · '
    || (SELECT estado || ' · ' || eliminacion_motivo FROM public.gcx_testimonios WHERE id = t_ana1));
PERFORM pg_temp.sesion(NULL);
PERFORM pg_temp.chk('E6', 'se oculta de /testimonios en el acto', 'Gus PRUEBA',
    (SELECT string_agg(x->>'autor', ', ') FROM jsonb_array_elements(public.testimonios_grupo_en(g1, AHORA)->'testimonios') x));
PERFORM pg_temp.chk('E7', 'y sale del conteo de la galería', '1',
    (SELECT x->>'testimonios' FROM jsonb_array_elements(public.testimonios_grupos_en(NULL, AHORA)->'grupos') x WHERE x->>'id' = g1));
PERFORM pg_temp.chk('E8', 'el aviso: uno a cada SUPER_ADMIN y a nadie más',
    (SELECT count(*)::text FROM public.users WHERE (role)::text = 'SUPER_ADMIN' OR COALESCE(roles, '{}') && ARRAY['SUPER_ADMIN']) || ' · 0 · Eva sí · Ana no',
    (SELECT count(*) FROM public.app_notifications WHERE alerta_clave = 'testimonios_eliminacion_solicitada') - v_m || ' · '
    || (SELECT count(*) FROM public.app_notifications n JOIN public.users u ON u.id = n.user_id
         WHERE n.alerta_clave = 'testimonios_eliminacion_solicitada'
           AND NOT ((u.role)::text = 'SUPER_ADMIN' OR COALESCE(u.roles, '{}') && ARRAY['SUPER_ADMIN'])) || ' · '
    || CASE WHEN EXISTS (SELECT 1 FROM public.app_notifications WHERE alerta_clave = 'testimonios_eliminacion_solicitada' AND user_id = eva) THEN 'Eva sí' ELSE 'Eva NO' END || ' · '
    || CASE WHEN EXISTS (SELECT 1 FROM public.app_notifications WHERE alerta_clave = 'testimonios_eliminacion_solicitada' AND user_id = ana) THEN 'Ana SÍ' ELSE 'Ana no' END);
PERFORM pg_temp.chk('E9', 'el texto del aviso y a dónde lleva',
    'Pedido para eliminar un testimonio · Ana Gómez PRUEBA pidió eliminar su testimonio de "PRUEBA Testimonios Uno". Ya no se ve mientras lo revisás. · /panel-admin?tab=testimonios',
    (SELECT title || ' · ' || message || ' · ' || action_url FROM public.app_notifications
      WHERE alerta_clave = 'testimonios_eliminacion_solicitada' AND user_id = eva ORDER BY created_at DESC LIMIT 1));
SELECT count(*) INTO v_n FROM public.app_notifications WHERE alerta_clave = 'testimonios_eliminacion_solicitada';
PERFORM pg_temp.sesion(ana);
v_j := public.testimonios_solicitar_eliminacion(t_ana1, NULL);
PERFORM pg_temp.chk('E10', 'pedirlo otra vez: no vuelve a avisar', 'true · true · 0 avisos nuevos',
    (v_j->>'ok') || ' · ' || (v_j->>'ya_solicitado') || ' · '
    || ((SELECT count(*) FROM public.app_notifications WHERE alerta_clave = 'testimonios_eliminacion_solicitada') - v_n) || ' avisos nuevos');

-- ══════════════════════════════════════════════════════════════════════════
-- A · Sistemas
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.sesion(beto);
PERFORM pg_temp.chk('A1', 'un usuario común no lista ni resuelve', 'no_autorizado · no_autorizado',
    (public.testimonios_admin_listar()->>'motivo') || ' · ' || (public.testimonios_admin_resolver(t_ana1, 'eliminar')->>'motivo'));
PERFORM pg_temp.sesion(NULL);
PERFORM pg_temp.chk('A2', 'sin sesión', 'sin_sesion · sin_sesion',
    (public.testimonios_admin_listar()->>'motivo') || ' · ' || (public.testimonios_admin_resolver(t_ana1, 'eliminar')->>'motivo'));
PERFORM pg_temp.chk('A3', 'después de eso sigue igual', 'eliminacion_solicitada', (SELECT estado FROM public.gcx_testimonios WHERE id = t_ana1));
PERFORM pg_temp.sesion(eva);
v_j := public.testimonios_admin_listar(NULL, 'prueba');
-- El email lo pone el trigger de auth.users (prueba.testim.<id>@test.local).
PERFORM pg_temp.chk('A4', 'Sistemas lista: el pedido primero, con autor y email', 'eliminacion_solicitada · Ana Gómez PRUEBA · con email',
    (v_j->'testimonios'->0->>'estado') || ' · ' || (v_j->'testimonios'->0->'autor'->>'nombre') || ' · '
    || CASE WHEN v_j->'testimonios'->0->'autor'->>'email' LIKE 'prueba.testim.%@test.local' THEN 'con email' ELSE 'SIN EMAIL' END);
PERFORM pg_temp.chk('A5', 'filtrar por estado', '1',
    jsonb_array_length(public.testimonios_admin_listar('eliminacion_solicitada', 'prueba')->'testimonios')::text);
PERFORM pg_temp.chk('A6', 'acciones y estados inválidos', 'accion_invalida · estado_invalido · estado_invalido · no_existe',
    (public.testimonios_admin_resolver(t_ana1, 'borrar')->>'motivo') || ' · '
    || (public.testimonios_admin_resolver(t_ana1, 'ocultar')->>'motivo') || ' · '
    || (public.testimonios_admin_resolver(t_gus, 'rechazar')->>'motivo') || ' · '
    || (public.testimonios_admin_resolver(gen_random_uuid(), 'eliminar')->>'motivo'));
v_j := public.testimonios_admin_resolver(t_ana1, 'rechazar');
PERFORM pg_temp.chk('A7', 'rechazar el pedido: vuelve a publicarse', 'true · publicado · pedido_rechazado · se ve',
    (v_j->>'ok') || ' · ' || (SELECT estado || ' · ' || decision FROM public.gcx_testimonios WHERE id = t_ana1) || ' · '
    || CASE WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(public.testimonios_grupo_en(g1, AHORA)->'testimonios') x WHERE (x->>'id')::uuid = t_ana1)
            THEN 'se ve' ELSE 'NO SE VE' END);
-- Cada paso en su sentencia: dentro de una misma sentencia, una función STABLE
-- no ve lo que cambió otra.
v_t := public.testimonios_admin_resolver(t_gus, 'ocultar')->>'estado';
v_t := v_t || ' · ' || CASE WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(public.testimonios_grupo_en(g1, AHORA)->'testimonios') x WHERE (x->>'id')::uuid = t_gus)
            THEN 'SE VE' ELSE 'no se ve' END;
v_t := v_t || ' · ' || (public.testimonios_admin_resolver(t_gus, 'mostrar')->>'estado');
v_t := v_t || ' · ' || CASE WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(public.testimonios_grupo_en(g1, AHORA)->'testimonios') x WHERE (x->>'id')::uuid = t_gus)
            THEN 'se ve' ELSE 'NO SE VE' END;
PERFORM pg_temp.chk('A8', 'ocultar y mostrar por su cuenta', 'oculto · no se ve · publicado · se ve', v_t);
-- Uno que Sistemas ocultó: si la autora pide eliminarlo y se rechaza, sigue oculto.
PERFORM public.testimonios_admin_resolver(t_ana2, 'ocultar');
PERFORM pg_temp.sesion(ana);
PERFORM public.testimonios_solicitar_eliminacion(t_ana2, NULL);
PERFORM pg_temp.sesion(eva);
PERFORM public.testimonios_admin_resolver(t_ana2, 'rechazar');
PERFORM pg_temp.chk('A9', 'pedido sobre uno oculto, rechazado: sigue oculto', 'oculto', (SELECT estado FROM public.gcx_testimonios WHERE id = t_ana2));
-- Eliminar de verdad, con sus corazones.
PERFORM pg_temp.sesion(ana);
PERFORM public.testimonios_solicitar_eliminacion(t_ana1, NULL);
PERFORM pg_temp.sesion(eva);
PERFORM pg_temp.chk('A10', 'antes de eliminar: tiene un corazón', '1', (SELECT count(*)::text FROM public.gcx_testimonios_corazones WHERE testimonio_id = t_ana1));
v_j := public.testimonios_admin_resolver(t_ana1, 'eliminar');
PERFORM pg_temp.chk('A11', 'Sistemas elimina: desaparece con sus corazones', 'true · 0 · 0',
    (v_j->>'ok') || ' · ' || (SELECT count(*) FROM public.gcx_testimonios WHERE id = t_ana1) || ' · '
    || (SELECT count(*) FROM public.gcx_testimonios_corazones WHERE testimonio_id = t_ana1));
PERFORM pg_temp.chk('A12', 'todo quedó en audit_logs', 'DELETE, INSERT, UPDATE',
    (SELECT string_agg(DISTINCT action, ', ' ORDER BY action) FROM public.audit_logs WHERE table_name = 'gcx_testimonios' AND record_id = t_ana1));
PERFORM pg_temp.sesion(ana);
PERFORM pg_temp.chk('A13', 'eliminado, puede volver a escribir uno', 'true',
    public.testimonios_publicar_en(g1, 'De nuevo PRUEBA', true, AHORA)->>'ok');

-- ══════════════════════════════════════════════════════════════════════════
-- M · Mis GCX y mis testimonios
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.sesion(ana);
v_j := public.testimonios_mis_grupos_en(AHORA);
PERFORM pg_temp.chk('M1', 'Ana: sus dos GCX (uno por pareja), si ya escribió y su nombre', 'Dos:true:oculto · Uno:true:publicado · Ana Gómez PRUEBA',
    (SELECT string_agg(replace(x->>'nombre', 'PRUEBA Testimonios ', '') || ':' || (x->>'ya_publicado') || ':' || COALESCE(x->>'estado', '-'), ' · ' ORDER BY x->>'nombre')
       FROM jsonb_array_elements(v_j->'grupos') x) || ' · ' || (v_j->>'mi_nombre'));
PERFORM pg_temp.chk('M2', 'cada GCX trae su anfitrión', 'Eva PRUEBA (Anfitriona)',
    (SELECT (x->'anfitriones'->0->>'nombre') || ' (' || (x->'anfitriones'->0->>'rol') || ')' FROM jsonb_array_elements(v_j->'grupos') x WHERE x->>'id' = g2));
PERFORM pg_temp.sesion(beto);
PERFORM pg_temp.chk('M3', 'Beto (pendiente): ninguno', '0', jsonb_array_length(public.testimonios_mis_grupos_en(AHORA)->'grupos')::text);
PERFORM pg_temp.sesion(dani);
PERFORM pg_temp.chk('M4', 'Dani (sólo en la Segunda): ninguno', '0', jsonb_array_length(public.testimonios_mis_grupos_en(AHORA)->'grupos')::text);
PERFORM pg_temp.sesion(NULL);
PERFORM pg_temp.chk('M5', 'sin sesión', 'sin_sesion · sin_sesion',
    (public.testimonios_mis_grupos_en(AHORA)->>'motivo') || ' · ' || (public.testimonios_mios()->>'motivo'));
PERFORM pg_temp.sesion(ana);
v_j := public.testimonios_mios();
PERFORM pg_temp.chk('M6', 'mis testimonios, con estado', '2 · oculto, publicado',
    jsonb_array_length(v_j->'testimonios') || ' · '
    || (SELECT string_agg(x->>'estado', ', ' ORDER BY x->>'estado') FROM jsonb_array_elements(v_j->'testimonios') x));

-- ══════════════════════════════════════════════════════════════════════════
-- N · Menores
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.sesion(sofi);
v_j := public.testimonios_mis_grupos_en(AHORA);
PERFORM pg_temp.chk('N1', 'la vista previa del modal de una menor: Nombre I.', 'Sofía G.', v_j->>'mi_nombre');
t_sofi := (public.testimonios_publicar_en(g1, 'Me encantó PRUEBA', true, AHORA)->>'id')::uuid;
PERFORM pg_temp.sesion(tomi);
PERFORM public.testimonios_publicar_en(g1, 'Muy bueno PRUEBA', true, AHORA);
PERFORM pg_temp.sesion(NULL);
v_j := public.testimonios_grupo_en(g1, AHORA);
PERFORM pg_temp.chk('N2', 'en el detalle: la menor "Sofía G.", el que no tiene fecha "Tomás R.", el adulto completo',
    'Ana Gómez PRUEBA · Sofía G. · Tomás R.',
    (SELECT string_agg(x->>'autor', ' · ' ORDER BY x->>'autor') FROM jsonb_array_elements(v_j->'testimonios') x
      WHERE x->>'autor' IN ('Ana Gómez PRUEBA', 'Sofía G.', 'Tomás R.', 'Sofía Gómez PRUEBA', 'Tomás Ríos PRUEBA')));
PERFORM pg_temp.chk('N3', 'el apellido completo de la menor no aparece en lo público', 'no',
    CASE WHEN position('Sofía Gómez' IN public.testimonios_grupo_en(g1, AHORA)::text) > 0
           OR position('Sofía Gómez' IN COALESCE((SELECT string_agg(x::text, '') FROM jsonb_array_elements(public.testimonios_grupos_en('sofia', AHORA)->'grupos') x WHERE x->>'id' = g1), '')) > 0
           OR position('Tomás Ríos' IN public.testimonios_grupo_en(g1, AHORA)::text) > 0 THEN 'SÍ' ELSE 'no' END);
PERFORM pg_temp.chk('N4', 'buscar el apellido completo de la menor no la encuentra', '0 · 0',
    (SELECT count(*) FROM jsonb_array_elements(public.testimonios_grupos_en('sofia gomez', AHORA)->'grupos') x WHERE x->>'id' = g1) || ' · '
    || (SELECT count(*) FROM jsonb_array_elements(public.testimonios_grupos_en('tomas rios', AHORA)->'grupos') x WHERE x->>'id' = g1));
PERFORM pg_temp.chk('N5', 'buscar lo que se muestra sí la encuentra, con la etiqueta "Sofía G."', 'testimonio · ["Sofía G."]',
    (SELECT (x->>'coincide') || ' · ' || (x->>'autores') FROM jsonb_array_elements(public.testimonios_grupos_en('sofia g', AHORA)->'grupos') x WHERE x->>'id' = g1));
PERFORM pg_temp.chk('N6', 'buscar a un adulto por su apellido completo sí lo encuentra', 'testimonio',
    (SELECT x->>'coincide' FROM jsonb_array_elements(public.testimonios_grupos_en('ana gomez', AHORA)->'grupos') x WHERE x->>'id' = g1));
PERFORM pg_temp.sesion(eva);
PERFORM pg_temp.chk('N7', 'Sistemas ve el nombre completo de la menor y del que no tiene fecha', 'Sofía Gómez PRUEBA · Tomás Ríos PRUEBA',
    (SELECT string_agg(x->'autor'->>'nombre', ' · ' ORDER BY x->'autor'->>'nombre')
       FROM jsonb_array_elements(public.testimonios_admin_listar(NULL, 'prueba')->'testimonios') x
      WHERE x->'autor'->>'nombre' IN ('Sofía Gómez PRUEBA', 'Tomás Ríos PRUEBA', 'Sofía G.', 'Tomás R.')));
PERFORM pg_temp.chk('N8', 'cumple 18 hoy: completo; mañana: inicial; una sola palabra: esa', 'Ana Gómez · Ana G. · Ana',
    public.testimonios_nombre_publico('Ana  Gómez', '2008-11-02', AHORA) || ' · '
    || public.testimonios_nombre_publico('Ana Gómez', '2008-11-03', AHORA) || ' · '
    || public.testimonios_nombre_publico('Ana', NULL, AHORA));

-- ══════════════════════════════════════════════════════════════════════════
-- H · Anfitrión y co-anfitrión
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.sesion(hugo);
v_j := public.testimonios_mis_grupos_en(AHORA);
PERFORM pg_temp.chk('H1', 'anfitrión e inscripto en G1: lo ve una sola vez, como Anfitrión', '1 · Anfitrión',
    (SELECT count(*) || ' · ' || max(x->>'mi_rol') FROM jsonb_array_elements(v_j->'grupos') x WHERE x->>'id' = g1));
PERFORM pg_temp.chk('H2', 'el anfitrión publica', 'true', public.testimonios_publicar_en(g1, 'Gracias a todos PRUEBA', true, AHORA)->>'ok');
PERFORM pg_temp.sesion(carla);
PERFORM pg_temp.chk('H3', 'la co-anfitriona ve su GCX como Co-anfitrión', 'Uno · Co-anfitrión',
    (SELECT string_agg(replace(x->>'nombre', 'PRUEBA Testimonios ', '') || ' · ' || (x->>'mi_rol'), ', ')
       FROM jsonb_array_elements(public.testimonios_mis_grupos_en(AHORA)->'grupos') x));
PERFORM pg_temp.chk('H4', 'la co-anfitriona publica (sin estar inscripta)', 'true', public.testimonios_publicar_en(g1, 'Qué temporada PRUEBA', true, AHORA)->>'ok');
PERFORM pg_temp.chk('H5', 'con las mismas reglas: un solo testimonio por GCX', 'ya_publicado', public.testimonios_publicar_en(g1, 'Otra vez PRUEBA', true, AHORA)->>'motivo');
PERFORM pg_temp.chk('H6', 'y el mismo plazo', 'fuera_de_plazo', public.testimonios_publicar_en(g2, 'PRUEBA', true, pg_temp.ar('2027-01-08 12:00'))->>'motivo');
PERFORM pg_temp.sesion(sofi);
PERFORM pg_temp.chk('H7', 'una inscripta común es Participante', 'Participante',
    (SELECT x->>'mi_rol' FROM jsonb_array_elements(public.testimonios_mis_grupos_en(AHORA)->'grupos') x WHERE x->>'id' = g1));

-- ══════════════════════════════════════════════════════════════════════════
-- U · Auditoría sin texto
-- ══════════════════════════════════════════════════════════════════════════
-- Al de Sofía: crear (ya), ocultar y eliminar.
PERFORM pg_temp.sesion(eva);
PERFORM public.testimonios_admin_resolver(t_sofi, 'ocultar');
PERFORM public.testimonios_admin_resolver(t_sofi, 'eliminar');
PERFORM pg_temp.chk('U1', 'crear, ocultar y eliminar quedan en audit_logs, con quién y el estado', 'DELETE:oculto · INSERT:publicado · UPDATE:oculto · Eva en el ocultar y el eliminar',
    (SELECT string_agg(action || ':' || COALESCE(new_data->>'estado', old_data->>'estado'), ' · ' ORDER BY action)
       FROM public.audit_logs WHERE table_name = 'gcx_testimonios' AND record_id = t_sofi)
    || CASE WHEN (SELECT bool_and(changed_by = eva) FROM public.audit_logs
                   WHERE table_name = 'gcx_testimonios' AND record_id = t_sofi AND action <> 'INSERT')
            THEN ' · Eva en el ocultar y el eliminar' ELSE ' · OTRO autor' END);
PERFORM pg_temp.chk('U2', 'ningún registro de gcx_testimonios guarda el texto ni el motivo del pedido', 'ninguno',
    (SELECT CASE WHEN count(*) = 0 THEN 'ninguno' ELSE count(*) || ' CON TEXTO' END
       FROM public.audit_logs
      WHERE table_name = 'gcx_testimonios'
        AND (old_data ? 'texto' OR new_data ? 'texto' OR old_data ? 'eliminacion_motivo' OR new_data ? 'eliminacion_motivo'
             OR COALESCE(old_data::text, '') || COALESCE(new_data::text, '') ~ 'Me encantó|Fue un lugar seguro|Prefiero que no esté')));
-- Otra tabla auditada: groups sigue guardando la fila entera.
UPDATE public.groups SET description = 'PRUEBA auditoría' WHERE id = g2;
PERFORM pg_temp.chk('U3', 'groups sigue guardando la fila entera (con la descripción)', 'PRUEBA dos → PRUEBA auditoría · fila entera',
    (SELECT (old_data->>'description') || ' → ' || (new_data->>'description')
            || CASE WHEN new_data = (SELECT to_jsonb(g) FROM public.groups g WHERE g.id = g2) THEN ' · fila entera' ELSE ' · RECORTADA' END
       FROM public.audit_logs WHERE table_name = 'groups' AND record_id = g2::uuid AND action = 'UPDATE'
        AND new_data->>'description' IS DISTINCT FROM old_data->>'description'));
PERFORM pg_temp.chk('U4', 'el trigger genérico (log_audit_event) no cambió', '3b40b426e833be22f182f9b1ccfe2689',
    md5(pg_get_functiondef('public.log_audit_event'::regproc)));
PERFORM pg_temp.chk('U5', 'users, groups, group_registrations y notif_alertas siguen con el genérico; testimonios con el suyo',
    'audit_gcx_testimonios_changes:testimonios_auditar · audit_group_registrations_changes:log_audit_event · audit_groups_changes:log_audit_event · audit_notif_alertas_changes:log_audit_event · audit_users_changes:log_audit_event',
    (SELECT string_agg(tgname || ':' || tgfoid::regproc::text, ' · ' ORDER BY tgname)
       FROM pg_trigger WHERE tgname IN ('audit_gcx_testimonios_changes', 'audit_group_registrations_changes',
                                        'audit_groups_changes', 'audit_notif_alertas_changes', 'audit_users_changes')));

-- ══════════════════════════════════════════════════════════════════════════
-- X · Permisos
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.chk('X1', 'anon y authenticated no leen ni escriben las tablas', 'no',
    CASE WHEN EXISTS (SELECT 1 FROM unnest(ARRAY['anon', 'authenticated']) rol,
                                    unnest(ARRAY['public.gcx_testimonios', 'public.gcx_testimonios_corazones', 'public.gcx_testimonios_ritmo']) tb,
                                    unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) pr
                       WHERE has_table_privilege(rol, tb, pr)) THEN 'SÍ' ELSE 'no' END);
PERFORM pg_temp.sesion(NULL);
BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    EXECUTE 'SELECT count(*) FROM public.gcx_testimonios' INTO v_n;
    v_t := 'leyó';
    EXECUTE 'RESET ROLE';
EXCEPTION WHEN insufficient_privilege THEN v_t := 'sin permiso';
END;
EXECUTE 'RESET ROLE';
PERFORM pg_temp.chk('X2', 'anon intenta leer la tabla directo', 'sin permiso', v_t);
BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    EXECUTE 'SELECT public.testimonios_grupos(NULL)->>''ok''' INTO v_t;
    EXECUTE 'RESET ROLE';
EXCEPTION WHEN insufficient_privilege THEN v_t := 'sin permiso';
END;
EXECUTE 'RESET ROLE';
PERFORM pg_temp.chk('X3', 'anon sí puede usar la galería', 'true', v_t);
PERFORM pg_temp.chk('X4', 'anon: públicas sí, las de sesión no', 'temporada:sí grupos:sí grupo:sí | mis_grupos:no publicar:no corazon:no mios:no solicitar:no listar:no resolver:no',
    'temporada:' || CASE WHEN has_function_privilege('anon', 'public.testimonios_temporada()', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ' grupos:' || CASE WHEN has_function_privilege('anon', 'public.testimonios_grupos(text)', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ' grupo:' || CASE WHEN has_function_privilege('anon', 'public.testimonios_grupo(text)', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ' | mis_grupos:' || CASE WHEN has_function_privilege('anon', 'public.testimonios_mis_grupos()', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ' publicar:' || CASE WHEN has_function_privilege('anon', 'public.testimonios_publicar(text, text, boolean)', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ' corazon:' || CASE WHEN has_function_privilege('anon', 'public.testimonios_corazon(uuid, boolean)', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ' mios:' || CASE WHEN has_function_privilege('anon', 'public.testimonios_mios()', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ' solicitar:' || CASE WHEN has_function_privilege('anon', 'public.testimonios_solicitar_eliminacion(uuid, text)', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ' listar:' || CASE WHEN has_function_privilege('anon', 'public.testimonios_admin_listar(text, text, text, integer, integer)', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ' resolver:' || CASE WHEN has_function_privilege('anon', 'public.testimonios_admin_resolver(uuid, text)', 'EXECUTE') THEN 'sí' ELSE 'no' END);
PERFORM pg_temp.chk('X5', 'authenticated usa las de sesión', 'sí',
    CASE WHEN has_function_privilege('authenticated', 'public.testimonios_publicar(text, text, boolean)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.testimonios_corazon(uuid, boolean)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.testimonios_solicitar_eliminacion(uuid, text)', 'EXECUTE')
         THEN 'sí' ELSE 'no' END);
PERFORM pg_temp.chk('X6', 'nadie de afuera llama a las piezas ni a las que reciben la fecha', '0',
    (SELECT count(*)::text FROM pg_proc p, unnest(ARRAY['anon', 'authenticated']) rol
      WHERE p.pronamespace = 'public'::regnamespace
        AND p.proname IN ('testimonios_norm', 'testimonios_temporada_de_fecha', 'testimonios_fecha_md', 'testimonios_temporada_en',
                          'testimonios_grupo_es_de', 'testimonios_anfitriones', 'testimonios_inscripto', 'testimonios_es_sistemas',
                          'testimonios_grupos_en', 'testimonios_grupo_en', 'testimonios_mis_grupos_en', 'testimonios_publicar_en',
                          'testimonios_corazon_en', 'testimonios_nombre_publico', 'testimonios_rol_en_grupo',
                          'testimonios_auditar')
        AND has_function_privilege(rol, p.oid, 'EXECUTE')));
PERFORM pg_temp.chk('X7', 'la alerta está en el catálogo, apagable, en el área Sistemas', 'automatica · true · Sistemas',
    (SELECT tipo || ' · ' || permite_apagar || ' · ' || area FROM public.notif_alertas WHERE clave = 'testimonios_eliminacion_solicitada'));

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
