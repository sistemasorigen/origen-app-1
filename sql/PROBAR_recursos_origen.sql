-- ════════════════════════════════════════════════════════════════════════
-- PRUEBAS de sql/recursos_origen.sql
-- ════════════════════════════════════════════════════════════════════════
--
--   A · Cada tipo con datos válidos e inválidos, y la categoría derivada.
--   B · Quién ve y quién escribe: anon, un usuario común y un SUPER_ADMIN.
--   C · La migración: lo migrado es exactamente lo que hay en youversBanner,
--       y youversBanner sigue ahí.
--   D · El bucket: tope, tipos, y quién sube, lista y borra.
--
-- Todo con datos "PRUEBA" que no llegan a existir: el script TERMINA SIEMPRE EN
-- EXCEPCIÓN a propósito, que es como se deshace solo y como vuelve el resumen.
-- Si algo falla, el mensaje empieza con "FALLÓ". Se puede correr las veces que
-- haga falta.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

DO $prueba$
DECLARE
    id_admin uuid;
    id_comun uuid;
    caso     record;
    ok_val   int := 0;
    ok_inv   int := 0;
    fallas   text := '';
    reporte  text := '';
    n        int;
    m        int;
    r_id     uuid;
    pudo     boolean;
    B        constant text := 'https://oqtumgalnozppqnnjjdb.supabase.co/storage/v1/object/public/recursos/prueba.pdf';
    SP       constant text := 'https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk';
BEGIN
    SELECT u.id INTO id_admin FROM public.users u
     WHERE (u.role)::text = 'SUPER_ADMIN' OR u.roles && ARRAY['SUPER_ADMIN'] LIMIT 1;
    SELECT u.id INTO id_comun FROM public.users u
     WHERE (u.role)::text = 'VIEWER'
       AND NOT (COALESCE(u.roles, ARRAY[]::text[]) && ARRAY['SUPER_ADMIN']) LIMIT 1;
    IF id_admin IS NULL OR id_comun IS NULL THEN
        RAISE EXCEPTION 'Falta alguien para probar (SUPER_ADMIN / usuario común).';
    END IF;

    -- ── A · Los que tienen que entrar ───────────────────────────────────
    FOR caso IN SELECT * FROM (VALUES
        ('link externo',   'link',    'material', 'https://forms.gle/abc',                    NULL, NULL, NULL, NULL),
        ('link interno',   'link',    'material', '/eventos',                                 NULL, NULL, NULL, NULL),
        ('archivo pdf',    'archivo', 'material', B,                                          'prueba.pdf', 'pdf', NULL, NULL),
        ('archivo imagen', 'archivo', 'material', B,                                          'prueba.png', 'imagen', NULL, NULL),
        ('video watch',    'video',   'material', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', NULL, NULL, NULL, NULL),
        ('video watch 2',  'video',   'material', 'https://www.youtube.com/watch?list=PL1&v=dQw4w9WgXcQ&t=30', NULL, NULL, NULL, NULL),
        ('video corto',    'video',   'material', 'https://youtu.be/dQw4w9WgXcQ?si=abc',      NULL, NULL, NULL, NULL),
        ('video shorts',   'video',   'material', 'https://m.youtube.com/shorts/dQw4w9WgXcQ', NULL, NULL, NULL, NULL),
        ('video live',     'video',   'material', 'https://www.youtube.com/live/dQw4w9WgXcQ', NULL, NULL, NULL, NULL),
        ('podcast',        'podcast', 'podcast',  SP,                                         NULL, NULL, 'Pastor PRUEBA', '32 min'),
        ('podcast si',     'podcast', 'podcast',  SP || '?si=abc',                            NULL, NULL, 'Pastor PRUEBA', NULL)
    ) AS t (nombre, tipo, categoria, destino, a_path, a_tipo, pastor, duracion) LOOP
        BEGIN
            INSERT INTO public.recursos_origen (titulo, tipo, categoria, destino, archivo_path, archivo_tipo, pastor, duracion)
            VALUES ('PRUEBA ' || caso.nombre, caso.tipo, caso.categoria, caso.destino, caso.a_path, caso.a_tipo, caso.pastor, caso.duracion);
            ok_val := ok_val + 1;
        EXCEPTION WHEN check_violation THEN
            fallas := fallas || ' · rebotó y debía entrar: ' || caso.nombre;
        END;
    END LOOP;

    -- ── A · Los que tienen que rebotar ──────────────────────────────────
    FOR caso IN SELECT * FROM (VALUES
        ('link javascript',  'link',    'material', 'javascript:alert(1)',                    NULL, NULL, NULL, NULL),
        ('link http',        'link',    'material', 'http://inseguro.com',                    NULL, NULL, NULL, NULL),
        ('link // ',         'link',    'material', '//otro.com/x',                           NULL, NULL, NULL, NULL),
        ('link data',        'link',    'material', 'data:text/html,hola',                    NULL, NULL, NULL, NULL),
        ('link con archivo', 'link',    'material', 'https://a.com',                          'x.pdf', 'pdf', NULL, NULL),
        ('link con pastor',  'link',    'material', 'https://a.com',                          NULL, NULL, 'Pastor', NULL),
        ('archivo de afuera','archivo', 'material', 'https://otro.com/x.pdf',                 'x.pdf', 'pdf', NULL, NULL),
        ('archivo otro bucket','archivo','material','https://oqtumgalnozppqnnjjdb.supabase.co/storage/v1/object/public/images/x.pdf', 'x.pdf', 'pdf', NULL, NULL),
        ('archivo sin path', 'archivo', 'material', B,                                        NULL, 'pdf', NULL, NULL),
        ('archivo sin tipo', 'archivo', 'material', B,                                        'x.pdf', NULL, NULL, NULL),
        ('archivo tipo zip', 'archivo', 'material', B,                                        'x.zip', 'zip', NULL, NULL),
        ('video de vimeo',   'video',   'material', 'https://vimeo.com/123456',               NULL, NULL, NULL, NULL),
        ('video id corto',   'video',   'material', 'https://www.youtube.com/watch?v=abc',    NULL, NULL, NULL, NULL),
        ('video falso',      'video',   'material', 'https://youtube.com.malo.com/watch?v=dQw4w9WgXcQ', NULL, NULL, NULL, NULL),
        ('video http',       'video',   'material', 'http://www.youtube.com/watch?v=dQw4w9WgXcQ', NULL, NULL, NULL, NULL),
        ('video sin video',  'video',   'material', 'https://www.youtube.com/',               NULL, NULL, NULL, NULL),
        ('podcast show',     'podcast', 'podcast',  'https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk', NULL, NULL, 'Pastor', NULL),
        ('podcast track',    'podcast', 'podcast',  'https://open.spotify.com/track/4rOoJ6Egrf8K2IrywzwOMk', NULL, NULL, 'Pastor', NULL),
        ('podcast id corto', 'podcast', 'podcast',  'https://open.spotify.com/episode/abc',   NULL, NULL, 'Pastor', NULL),
        ('podcast falso',    'podcast', 'podcast',  'https://open.spotify.com.malo.com/episode/4rOoJ6Egrf8K2IrywzwOMk', NULL, NULL, 'Pastor', NULL),
        ('podcast sin pastor','podcast','podcast',  SP,                                       NULL, NULL, NULL, NULL),
        ('podcast pastor vacío','podcast','podcast',SP,                                       NULL, NULL, '   ', NULL),
        ('duración larga',   'podcast', 'podcast',  SP,                                       NULL, NULL, 'Pastor', 'una duración de más de veinte letras'),
        ('video con duración','video',  'material', 'https://youtu.be/dQw4w9WgXcQ',           NULL, NULL, NULL, '32 min'),
        ('tipo inventado',   'audio',   'material', 'https://a.com',                          NULL, NULL, NULL, NULL),
        -- La categoría derivada del tipo.
        ('podcast material', 'podcast', 'material', SP,                                       NULL, NULL, 'Pastor', NULL),
        ('link podcast',     'link',    'podcast',  'https://a.com',                          NULL, NULL, NULL, NULL),
        ('video podcast',    'video',   'podcast',  'https://youtu.be/dQw4w9WgXcQ',           NULL, NULL, NULL, NULL),
        ('archivo podcast',  'archivo', 'podcast',  B,                                        'x.pdf', 'pdf', NULL, NULL)
    ) AS t (nombre, tipo, categoria, destino, a_path, a_tipo, pastor, duracion) LOOP
        BEGIN
            INSERT INTO public.recursos_origen (titulo, tipo, categoria, destino, archivo_path, archivo_tipo, pastor, duracion)
            VALUES ('PRUEBA ' || caso.nombre, caso.tipo, caso.categoria, caso.destino, caso.a_path, caso.a_tipo, caso.pastor, caso.duracion);
            fallas := fallas || ' · entró y debía rebotar: ' || caso.nombre;
        EXCEPTION WHEN check_violation THEN
            ok_inv := ok_inv + 1;
        END;
    END LOOP;

    -- Título, descripción, imagen y encuadre.
    FOR caso IN SELECT * FROM (VALUES
        ('título vacío',  '',                 NULL::text,        NULL::text,          50, 1.0),
        ('título largo',  repeat('x', 61),    NULL,              NULL,                50, 1.0),
        ('desc. larga',   'PRUEBA',           repeat('x', 141),  NULL,                50, 1.0),
        ('imagen http',   'PRUEBA',           NULL,              'http://a.com/x.png',50, 1.0),
        ('focal 101',     'PRUEBA',           NULL,              NULL,               101, 1.0),
        ('zoom 4',        'PRUEBA',           NULL,              NULL,                50, 4.0)
    ) AS t (nombre, titulo, descripcion, imagen, focal, zoom) LOOP
        BEGIN
            INSERT INTO public.recursos_origen (titulo, descripcion, imagen_url, focal_x, zoom, tipo, categoria, destino)
            VALUES (caso.titulo, caso.descripcion, caso.imagen, caso.focal, caso.zoom, 'link', 'material', 'https://a.com');
            fallas := fallas || ' · entró y debía rebotar: ' || caso.nombre;
        EXCEPTION WHEN check_violation THEN
            ok_inv := ok_inv + 1;
        END;
    END LOOP;

    reporte := reporte || format('A: %s válidos entraron (de 11), %s inválidos rebotaron (de 35). ', ok_val, ok_inv);
    IF ok_val <> 11 THEN fallas := fallas || ' · válidos ' || ok_val; END IF;
    IF ok_inv <> 35 THEN fallas := fallas || ' · inválidos ' || ok_inv; END IF;

    -- ── C · La migración (antes de mezclar datos de prueba) ─────────────
    SELECT count(*) INTO n
      FROM public.app_config c
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c.config -> 'youversBanner' -> 'slides', '[]'::jsonb)) WITH ORDINALITY AS s (slide, pos)
      JOIN public.recursos_origen r ON r.id = (s.slide ->> 'id')::uuid
       AND r.tipo = 'link' AND r.categoria = 'material'
       AND r.titulo = s.slide ->> 'title'
       AND r.destino = s.slide ->> 'targetUrl'
       AND r.imagen_url IS NOT DISTINCT FROM NULLIF(s.slide ->> 'imageUrl', '')
       AND r.focal_x = COALESCE(round((s.slide ->> 'focalX')::numeric), 50)
       AND r.focal_y = COALESCE(round((s.slide ->> 'focalY')::numeric), 50)
       AND r.zoom = COALESCE((s.slide ->> 'zoom')::numeric, 1)
       AND r.orden = s.pos - 1
     WHERE c.id = 'global';
    SELECT COALESCE(jsonb_array_length(config -> 'youversBanner' -> 'slides'), -1) INTO m
      FROM public.app_config WHERE id = 'global';
    reporte := reporte || format('C: %s slides en youversBanner, %s migrados idénticos. ', m, n);
    IF m < 0 THEN fallas := fallas || ' · se borró youversBanner'; END IF;
    IF n <> m THEN fallas := fallas || format(' · migró %s de %s', n, m); END IF;

    -- Se limpian los válidos de A, y quedan dos para ver quién ve qué.
    DELETE FROM public.recursos_origen WHERE titulo LIKE 'PRUEBA %';
    INSERT INTO public.recursos_origen (titulo, tipo, categoria, destino, visible)
    VALUES ('PRUEBA visible', 'link', 'material', 'https://a.com', true);
    INSERT INTO public.recursos_origen (titulo, tipo, categoria, destino, visible)
    VALUES ('PRUEBA oculto', 'link', 'material', 'https://a.com', false)
    RETURNING id INTO r_id;

    -- ── B · anon ────────────────────────────────────────────────────────
    PERFORM set_config('request.jwt.claims', '', true);
    SET LOCAL ROLE anon;
    SELECT count(*) INTO n FROM public.recursos_origen WHERE titulo = 'PRUEBA visible';
    SELECT count(*) INTO m FROM public.recursos_origen WHERE titulo = 'PRUEBA oculto';
    IF n <> 1 OR m <> 0 THEN fallas := fallas || format(' · anon ve visible=%s oculto=%s', n, m); END IF;
    pudo := false;
    BEGIN
        INSERT INTO public.recursos_origen (titulo, tipo, categoria, destino) VALUES ('PRUEBA anon', 'link', 'material', 'https://a.com');
        pudo := true;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    IF pudo THEN fallas := fallas || ' · anon escribió'; END IF;
    reporte := reporte || format('B anon: ve %s visible y %s oculto, no escribe. ', n, m);
    RESET ROLE;

    -- ── B · usuario común ───────────────────────────────────────────────
    PERFORM set_config('request.jwt.claims', json_build_object('sub', id_comun, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO n FROM public.recursos_origen WHERE titulo = 'PRUEBA visible';
    SELECT count(*) INTO m FROM public.recursos_origen WHERE titulo = 'PRUEBA oculto';
    IF n <> 1 OR m <> 0 THEN fallas := fallas || format(' · común ve visible=%s oculto=%s', n, m); END IF;
    pudo := false;
    BEGIN
        INSERT INTO public.recursos_origen (titulo, tipo, categoria, destino) VALUES ('PRUEBA común', 'link', 'material', 'https://a.com');
        pudo := true;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    IF pudo THEN fallas := fallas || ' · común insertó'; END IF;
    UPDATE public.recursos_origen SET titulo = 'PRUEBA hackeado' WHERE titulo = 'PRUEBA visible';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN fallas := fallas || ' · común editó'; END IF;
    DELETE FROM public.recursos_origen WHERE titulo = 'PRUEBA visible';
    GET DIAGNOSTICS m = ROW_COUNT;
    IF m <> 0 THEN fallas := fallas || ' · común borró'; END IF;
    reporte := reporte || 'B común: ve lo mismo que anon, no inserta, edita 0, borra 0. ';

    -- D · el común no sube, no lista, no borra.
    pudo := false;
    BEGIN
        INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('recursos', 'PRUEBA-comun.pdf', id_comun);
        pudo := true;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    IF pudo THEN fallas := fallas || ' · común subió al bucket'; END IF;
    RESET ROLE;

    -- Un objeto de prueba, puesto como postgres, para ver quién lo ve y lo toca.
    INSERT INTO storage.objects (bucket_id, name) VALUES ('recursos', 'PRUEBA-objeto.pdf');
    PERFORM set_config('storage.allow_delete_query', 'true', true);

    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'recursos' AND name = 'PRUEBA-objeto.pdf';
    IF n <> 0 THEN fallas := fallas || ' · común lista el bucket'; END IF;
    UPDATE storage.objects SET name = 'PRUEBA-movido.pdf' WHERE bucket_id = 'recursos' AND name = 'PRUEBA-objeto.pdf';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN fallas := fallas || ' · común cambió un objeto'; END IF;
    DELETE FROM storage.objects WHERE bucket_id = 'recursos' AND name = 'PRUEBA-objeto.pdf';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN fallas := fallas || ' · común borró un objeto'; END IF;
    RESET ROLE;

    PERFORM set_config('request.jwt.claims', '', true);
    SET LOCAL ROLE anon;
    SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'recursos';
    IF n <> 0 THEN fallas := fallas || ' · anon lista el bucket'; END IF;
    pudo := false;
    BEGIN
        INSERT INTO storage.objects (bucket_id, name) VALUES ('recursos', 'PRUEBA-anon.pdf');
        pudo := true;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    IF pudo THEN fallas := fallas || ' · anon subió al bucket'; END IF;
    RESET ROLE;
    reporte := reporte || 'D común/anon: no suben, no listan, no cambian, no borran. ';

    -- ── B y D · SUPER_ADMIN ─────────────────────────────────────────────
    PERFORM set_config('request.jwt.claims', json_build_object('sub', id_admin, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO n FROM public.recursos_origen WHERE titulo = 'PRUEBA oculto';
    IF n <> 1 THEN fallas := fallas || ' · el admin no ve los ocultos'; END IF;
    pudo := false;
    BEGIN
        INSERT INTO public.recursos_origen (titulo, tipo, categoria, destino) VALUES ('PRUEBA admin', 'link', 'material', 'https://a.com');
        pudo := true;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    IF NOT pudo THEN fallas := fallas || ' · el admin no pudo insertar'; END IF;
    UPDATE public.recursos_origen SET titulo = 'PRUEBA admin editado' WHERE titulo = 'PRUEBA admin';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN fallas := fallas || ' · el admin no pudo editar'; END IF;
    DELETE FROM public.recursos_origen WHERE titulo = 'PRUEBA admin editado';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN fallas := fallas || ' · el admin no pudo borrar'; END IF;
    reporte := reporte || 'B admin: ve ocultos, inserta, edita, borra. ';

    pudo := false;
    BEGIN
        INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('recursos', 'PRUEBA-admin.pdf', id_admin);
        pudo := true;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    IF NOT pudo THEN fallas := fallas || ' · el admin no pudo subir'; END IF;
    SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'recursos' AND name = 'PRUEBA-objeto.pdf';
    IF n <> 1 THEN fallas := fallas || ' · el admin no lista el bucket'; END IF;
    UPDATE storage.objects SET name = 'PRUEBA-admin2.pdf' WHERE bucket_id = 'recursos' AND name = 'PRUEBA-admin.pdf';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN fallas := fallas || ' · el admin no pudo cambiar'; END IF;
    DELETE FROM storage.objects WHERE bucket_id = 'recursos' AND name = 'PRUEBA-admin2.pdf';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN fallas := fallas || ' · el admin no pudo borrar del bucket'; END IF;
    RESET ROLE;
    reporte := reporte || 'D admin: sube, lista, cambia, borra. ';

    -- ── D · La definición del bucket ────────────────────────────────────
    SELECT count(*) INTO n FROM storage.buckets
     WHERE id = 'recursos' AND public AND file_size_limit = 20971520
       AND allowed_mime_types @> ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
       AND array_length(allowed_mime_types, 1) = 4;
    IF n <> 1 THEN fallas := fallas || ' · el bucket no quedó como debe'; END IF;
    reporte := reporte || 'D bucket: público, 20 MB, 4 tipos. ';

    IF fallas <> '' THEN
        RAISE EXCEPTION 'FALLÓ:%  ||  %', fallas, reporte;
    END IF;
    RAISE EXCEPTION 'TODO BIEN (se deshace solo)  ||  %', reporte;
END;
$prueba$;

ROLLBACK;
