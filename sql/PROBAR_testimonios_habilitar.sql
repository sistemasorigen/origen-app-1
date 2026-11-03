-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de sql/testimonios_habilitar.sql (los botones de las dos páginas)
--
-- BEGIN … ROLLBACK con un RAISE EXCEPTION al final: se deshace todo. NUNCA
-- COMMIT. Dos personas "PRUEBA" (Sistemas y una común), sin grupos: lo que se
-- prueba es la llave, no lo de adentro (eso es PROBAR_testimonios_gcx.sql).
--
-- Antes de aplicarlo se corre con el SQL adelante, en la misma transacción:
--   begin.sql + testimonios_habilitar.sql + este archivo.
--
-- QUÉ PRUEBA
--   B · Apagadas: cada función pública contesta no_habilitado, con y sin sesión.
--   S · Sistemas prende y apaga; nadie más puede; repetir no cambia nada.
--   I · Cada botón es independiente: prender una página no abre la otra.
--   X · Permisos y que lo de adentro (_en) no cambió.
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

-- "motivo" o "ok" de una respuesta, en una palabra.
CREATE FUNCTION pg_temp.res(j jsonb) RETURNS text LANGUAGE sql AS $f$
    SELECT CASE WHEN (j->>'ok')::boolean THEN 'ok' ELSE COALESCE(j->>'motivo', '?') END;
$f$;

DO $suite$
DECLARE
    eva uuid := gen_random_uuid();   -- SUPER_ADMIN
    ana uuid := gen_random_uuid();   -- común
    v_j jsonb; v_t text; v_c timestamptz;
    v_fallos integer; v_salida text;
BEGIN
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
SELECT x, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'prueba.habil.' || left(x::text, 8) || '@test.local', '', now(), now()
  FROM unnest(ARRAY[eva, ana]) x;
INSERT INTO public.users (id, name, email, role, roles, is_active) VALUES
    (eva, 'Eva PRUEBA', 'prueba.habil.eva@test.local', 'SUPER_ADMIN', ARRAY['SUPER_ADMIN'], true),
    (ana, 'Ana PRUEBA', 'prueba.habil.ana@test.local', 'VIEWER', ARRAY['VIEWER'], true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, roles = EXCLUDED.roles;

-- ══════════════════════════════════════════════════════════════════════════
-- B · Apagadas
-- ══════════════════════════════════════════════════════════════════════════
-- Corrida con el SQL adelante (antes de aplicarlo), las dos tienen que estar
-- apagadas y sin tocar; ya aplicado, Sistemas pudo haberlas tocado.
PERFORM pg_temp.chk('B1', 'las dos filas existen y el valor de fábrica es apagada', 'carga galeria · false',
    (SELECT string_agg(pagina, ' ' ORDER BY pagina) FROM public.testimonios_habilitacion)
    || ' · ' || (SELECT column_default FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'testimonios_habilitacion' AND column_name = 'habilitada'));
v_t := (SELECT string_agg(pagina || ':' || habilitada || ':' || COALESCE(cambiado_por::text, '-'), ' ' ORDER BY pagina)
          FROM public.testimonios_habilitacion);
RAISE NOTICE 'Cómo estaban antes de la prueba: %', v_t;
-- Desde acá, las dos apagadas pase lo que pase con producción.
UPDATE public.testimonios_habilitacion SET habilitada = false;

PERFORM pg_temp.sesion(NULL);
v_j := public.testimonios_temporada();
PERFORM pg_temp.chk('B2', 'temporada() contesta ok y dice que las dos están apagadas', 'ok · false · false · S',
    pg_temp.res(v_j) || ' · ' || (v_j->'habilitado'->>'galeria') || ' · ' || (v_j->'habilitado'->>'carga')
    || ' · ' || left(v_j->'temporada'->>'temporada', 1));
v_j := public.testimonios_grupos(NULL);
PERFORM pg_temp.chk('B3', 'grupos() sin sesión: no_habilitado, con la temporada', 'no_habilitado · con temporada',
    pg_temp.res(v_j) || ' · ' || CASE WHEN v_j->'temporada'->>'temporada' IS NOT NULL THEN 'con temporada' ELSE 'sin' END);
PERFORM pg_temp.chk('B4', 'grupos() no manda ningún grupo', 'nada', COALESCE(v_j->>'grupos', 'nada'));
PERFORM pg_temp.chk('B5', 'grupo() sin sesión, aunque el grupo no exista', 'no_habilitado',
    pg_temp.res(public.testimonios_grupo('no-existe')));

PERFORM pg_temp.sesion(ana);
PERFORM pg_temp.chk('B6', 'grupos() con sesión', 'no_habilitado', pg_temp.res(public.testimonios_grupos('prueba')));
PERFORM pg_temp.chk('B7', 'corazón con sesión', 'no_habilitado', pg_temp.res(public.testimonios_corazon(gen_random_uuid(), true)));
PERFORM pg_temp.chk('B8', 'mis_grupos() con sesión', 'no_habilitado', pg_temp.res(public.testimonios_mis_grupos()));
PERFORM pg_temp.chk('B9', 'publicar con sesión: ni mira el grupo', 'no_habilitado',
    pg_temp.res(public.testimonios_publicar('no-existe', 'hola', true)));
PERFORM pg_temp.chk('B10', 'Mis testimonios no tiene llave', 'ok', pg_temp.res(public.testimonios_mios()));

-- Como anon de verdad (el rol con el que llega la página sin sesión).
PERFORM pg_temp.sesion(NULL);
BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    EXECUTE 'SELECT (public.testimonios_grupos(NULL)->>''motivo'') || '' · '' || (public.testimonios_temporada()->''habilitado''->>''galeria'')' INTO v_t;
    EXECUTE 'RESET ROLE';
EXCEPTION WHEN insufficient_privilege THEN v_t := 'sin permiso';
END;
EXECUTE 'RESET ROLE';
PERFORM pg_temp.chk('B11', 'anon: grupos() no_habilitado y temporada() lo dice', 'no_habilitado · false', v_t);

-- ══════════════════════════════════════════════════════════════════════════
-- S · Quién toca los botones
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.sesion(NULL);
PERFORM pg_temp.chk('S1', 'sin sesión no puede', 'sin_sesion', pg_temp.res(public.testimonios_admin_habilitar('galeria', true)));
PERFORM pg_temp.chk('S2', 'sin sesión no ve el estado', 'sin_sesion', pg_temp.res(public.testimonios_admin_habilitacion()));
PERFORM pg_temp.sesion(ana);
PERFORM pg_temp.chk('S3', 'una persona común no puede prender', 'no_autorizado', pg_temp.res(public.testimonios_admin_habilitar('galeria', true)));
PERFORM pg_temp.chk('S4', 'ni ver el estado', 'no_autorizado', pg_temp.res(public.testimonios_admin_habilitacion()));
PERFORM pg_temp.chk('S5', 'y la página sigue apagada', 'false', (SELECT habilitada::text FROM public.testimonios_habilitacion WHERE pagina = 'galeria'));

PERFORM pg_temp.sesion(eva);
PERFORM pg_temp.chk('S6', 'una página que no existe', 'pagina_invalida', pg_temp.res(public.testimonios_admin_habilitar('otra', true)));
PERFORM pg_temp.chk('S7', 'sin decir prender o apagar', 'pagina_invalida', pg_temp.res(public.testimonios_admin_habilitar('galeria', NULL)));
v_j := public.testimonios_admin_habilitar('galeria', true);
PERFORM pg_temp.chk('S8', 'Sistemas prende la galería', 'ok · galeria · true · false',
    pg_temp.res(v_j) || ' · ' || (v_j->>'pagina') || ' · ' || (v_j->>'habilitada') || ' · ' || (v_j->>'sin_cambios'));
PERFORM pg_temp.chk('S9', 'queda guardado quién y cuándo', 'Eva PRUEBA · sí',
    (SELECT u.name || ' · ' || CASE WHEN h.cambiado_at IS NOT NULL THEN 'sí' ELSE 'no' END
       FROM public.testimonios_habilitacion h JOIN public.users u ON u.id = h.cambiado_por WHERE h.pagina = 'galeria'));
SELECT cambiado_at INTO v_c FROM public.testimonios_habilitacion WHERE pagina = 'galeria';
v_j := public.testimonios_admin_habilitar('galeria', true);
PERFORM pg_temp.chk('S10', 'prenderla otra vez: sin_cambios y no pisa cuándo', 'true · igual',
    (v_j->>'sin_cambios') || ' · '
    || CASE WHEN (SELECT cambiado_at FROM public.testimonios_habilitacion WHERE pagina = 'galeria') = v_c THEN 'igual' ELSE 'cambió' END);
v_j := public.testimonios_admin_habilitacion();
PERFORM pg_temp.chk('S11', 'el estado de las dos, en orden, con quién la tocó', 'galeria:true:Eva PRUEBA carga:false:',
    (SELECT string_agg((p->>'pagina') || ':' || (p->>'habilitada') || ':' || COALESCE(p->>'cambiado_por', ''), ' ' ORDER BY o)
       FROM jsonb_array_elements(v_j->'paginas') WITH ORDINALITY x(p, o)));
PERFORM pg_temp.chk('S12', 'el estado no manda ids ni emails', 'ninguno',
    CASE WHEN v_j::text ~ (eva::text || '|@') THEN 'manda' ELSE 'ninguno' END);

-- ══════════════════════════════════════════════════════════════════════════
-- I · Cada botón por su lado
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.sesion(ana);
PERFORM pg_temp.chk('I1', 'galería prendida: grupos() contesta ok', 'ok', pg_temp.res(public.testimonios_grupos(NULL)));
PERFORM pg_temp.chk('I2', 'y grupo() pasa la llave (el grupo no existe)', 'no_existe', pg_temp.res(public.testimonios_grupo('no-existe')));
PERFORM pg_temp.chk('I3', 'y el corazón pasa la llave', 'no_existe', pg_temp.res(public.testimonios_corazon(gen_random_uuid(), true)));
PERFORM pg_temp.chk('I4', 'la carga sigue apagada: mis_grupos()', 'no_habilitado', pg_temp.res(public.testimonios_mis_grupos()));
PERFORM pg_temp.chk('I5', 'la carga sigue apagada: publicar', 'no_habilitado', pg_temp.res(public.testimonios_publicar('no-existe', 'hola', true)));
v_j := public.testimonios_temporada();
PERFORM pg_temp.chk('I6', 'temporada() lo dice', 'true · false', (v_j->'habilitado'->>'galeria') || ' · ' || (v_j->'habilitado'->>'carga'));

PERFORM pg_temp.sesion(eva);
PERFORM public.testimonios_admin_habilitar('carga', true);
PERFORM public.testimonios_admin_habilitar('galeria', false);
PERFORM pg_temp.sesion(ana);
PERFORM pg_temp.chk('I7', 'carga prendida: mis_grupos() contesta ok', 'ok', pg_temp.res(public.testimonios_mis_grupos()));
v_t := pg_temp.res(public.testimonios_publicar('no-existe', 'hola', true));
PERFORM pg_temp.chk('I8', 'y publicar pasa la llave: la reglas de siempre siguen mandando', 'pasa',
    CASE WHEN v_t = 'no_habilitado' THEN 'no pasa' ELSE 'pasa' END);
PERFORM pg_temp.chk('I9', 'galería apagada otra vez: grupos()', 'no_habilitado', pg_temp.res(public.testimonios_grupos(NULL)));
PERFORM pg_temp.sesion(eva);
v_j := public.testimonios_admin_habilitar('carga', false);
PERFORM pg_temp.sesion(ana);
PERFORM pg_temp.chk('I10', 'apagar la carga: publicar vuelve a no_habilitado', 'ok · no_habilitado',
    pg_temp.res(v_j) || ' · ' || pg_temp.res(public.testimonios_publicar('no-existe', 'hola', true)));

-- ══════════════════════════════════════════════════════════════════════════
-- X · Permisos y lo que no se tocó
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.chk('X1', 'anon: públicas sí, las de sesión, las piezas y las de Sistemas no',
    'temporada:sí grupos:sí grupo:sí | mis_grupos:no publicar:no corazon:no habilitada:no no_habilitada:no admin_ver:no admin_tocar:no',
    'temporada:' || CASE WHEN has_function_privilege('anon', 'public.testimonios_temporada()', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ' grupos:' || CASE WHEN has_function_privilege('anon', 'public.testimonios_grupos(text)', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ' grupo:' || CASE WHEN has_function_privilege('anon', 'public.testimonios_grupo(text)', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ' | mis_grupos:' || CASE WHEN has_function_privilege('anon', 'public.testimonios_mis_grupos()', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ' publicar:' || CASE WHEN has_function_privilege('anon', 'public.testimonios_publicar(text, text, boolean)', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ' corazon:' || CASE WHEN has_function_privilege('anon', 'public.testimonios_corazon(uuid, boolean)', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ' habilitada:' || CASE WHEN has_function_privilege('anon', 'public.testimonios_habilitada(text)', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ' no_habilitada:' || CASE WHEN has_function_privilege('anon', 'public.testimonios_no_habilitada()', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ' admin_ver:' || CASE WHEN has_function_privilege('anon', 'public.testimonios_admin_habilitacion()', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ' admin_tocar:' || CASE WHEN has_function_privilege('anon', 'public.testimonios_admin_habilitar(text, boolean)', 'EXECUTE') THEN 'sí' ELSE 'no' END);
PERFORM pg_temp.chk('X2', 'authenticated: las de sesión y las de Sistemas sí, las piezas no',
    'mis_grupos:sí publicar:sí corazon:sí admin_ver:sí admin_tocar:sí habilitada:no no_habilitada:no',
    'mis_grupos:' || CASE WHEN has_function_privilege('authenticated', 'public.testimonios_mis_grupos()', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ' publicar:' || CASE WHEN has_function_privilege('authenticated', 'public.testimonios_publicar(text, text, boolean)', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ' corazon:' || CASE WHEN has_function_privilege('authenticated', 'public.testimonios_corazon(uuid, boolean)', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ' admin_ver:' || CASE WHEN has_function_privilege('authenticated', 'public.testimonios_admin_habilitacion()', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ' admin_tocar:' || CASE WHEN has_function_privilege('authenticated', 'public.testimonios_admin_habilitar(text, boolean)', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ' habilitada:' || CASE WHEN has_function_privilege('authenticated', 'public.testimonios_habilitada(text)', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ' no_habilitada:' || CASE WHEN has_function_privilege('authenticated', 'public.testimonios_no_habilitada()', 'EXECUTE') THEN 'sí' ELSE 'no' END);
PERFORM pg_temp.chk('X3', 'nadie de afuera lee ni escribe la tabla', 'no',
    CASE WHEN has_table_privilege('anon', 'public.testimonios_habilitacion', 'SELECT')
           OR has_table_privilege('authenticated', 'public.testimonios_habilitacion', 'SELECT')
           OR has_table_privilege('authenticated', 'public.testimonios_habilitacion', 'UPDATE')
         THEN 'sí' ELSE 'no' END);
PERFORM pg_temp.chk('X4', 'la tabla tiene RLS', 'true',
    (SELECT relrowsecurity::text FROM pg_class WHERE oid = 'public.testimonios_habilitacion'::regclass));
PERFORM pg_temp.chk('X5', 'las públicas siguen siendo SECURITY DEFINER', '6',
    (SELECT count(*)::text FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND prosecdef
        AND proname IN ('testimonios_temporada', 'testimonios_grupos', 'testimonios_grupo',
                        'testimonios_corazon', 'testimonios_mis_grupos', 'testimonios_publicar')));
-- Las huellas de las _en antes de este archivo (producción, 2026-11-03).
PERFORM pg_temp.chk('X6', 'lo de adentro (_en) no cambió', 'corazon:5ce11 grupo:c8dac grupos:0b725 mis_grupos:466c5 publicar:542de temporada:b714c',
    (SELECT string_agg(replace(replace(proname, 'testimonios_', ''), '_en', '') || ':' || left(md5(pg_get_functiondef(oid)), 5), ' ' ORDER BY proname)
       FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname LIKE 'testimonios\_%\_en'));

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
