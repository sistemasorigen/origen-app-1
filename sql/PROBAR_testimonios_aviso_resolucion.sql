-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de sql/testimonios_aviso_resolucion.sql
--
-- BEGIN … ROLLBACK y un RAISE EXCEPTION final a propósito: se deshace todo,
-- incluida la cola de pg_net. NO SALE NINGÚN AVISO NI NINGÚN PUSH, ni a las
-- personas de prueba ni a las reales. NUNCA COMMIT.
--
-- Personas: Dalia (escribe los testimonios), Sixto (SUPER_ADMIN, resuelve) y
-- Tere (otra persona cualquiera, que no tiene que recibir nada).
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

/** Los avisos de esa persona que salieron de esta alerta. */
CREATE FUNCTION pg_temp.avisos(p uuid) RETURNS text LANGUAGE sql AS $f$
    SELECT COALESCE(string_agg(title || ' § ' || message || ' § ' || COALESCE(action_url, '-'), ' ‖ '
                               ORDER BY message), '(ninguno)')
      FROM public.app_notifications
     WHERE user_id = p AND alerta_clave = 'testimonios_pedido_resuelto';
$f$;

CREATE FUNCTION pg_temp.cuantos() RETURNS integer LANGUAGE sql AS $f$
    SELECT count(*)::integer FROM public.app_notifications WHERE alerta_clave = 'testimonios_pedido_resuelto';
$f$;


DO $suite$
DECLARE
    dalia uuid := gen_random_uuid();
    sixto uuid := gen_random_uuid();
    tere  uuid := gen_random_uuid();
    -- groups.id es texto, pero log_audit_event() lo castea a uuid: tiene que
    -- tener forma de uuid de verdad, uno por grupo.
    g1 text := gen_random_uuid()::text;
    g2 text := gen_random_uuid()::text;
    g3 text := gen_random_uuid()::text;
    g4 text := gen_random_uuid()::text;
    t1 uuid := gen_random_uuid();
    t2 uuid := gen_random_uuid();
    t3 uuid := gen_random_uuid();
    t4 uuid := gen_random_uuid();
    TEXTO constant text := 'PRUEBA: esto es lo que escribí en mi testimonio y no tiene que viajar en ningún aviso.';
    v_j jsonb;
    v_n integer;
    v_fallos integer;
    v_salida text;
BEGIN
-- ── Fixture ───────────────────────────────────────────────────────────────
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
SELECT x, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'prueba.test.' || left(x::text, 8) || '@test.local', '', now(), now()
  FROM unnest(ARRAY[dalia, sixto, tere]) x;

-- handle_new_user ya creó la fila en public.users y la deja inactiva.
INSERT INTO public.users (id, name, email, role, roles, is_active) VALUES
    (dalia, 'Dalia PRUEBA', 'prueba.test.dalia@test.local', 'VIEWER',      ARRAY['VIEWER'],      true),
    (sixto, 'Sixto PRUEBA', 'prueba.test.sixto@test.local', 'SUPER_ADMIN', ARRAY['SUPER_ADMIN'], true),
    (tere,  'Tere PRUEBA',  'prueba.test.tere@test.local',  'VIEWER',      ARRAY['VIEWER'],      true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role,
                               roles = EXCLUDED.roles, is_active = true;

-- Cuatro testimonios de la misma persona, uno por caso. Como la base sólo
-- deja uno por persona y grupo, cada uno va en su propio grupo.
INSERT INTO public.groups (id, name, leader_name, host_id, status) VALUES
    (g1, 'GCX PRUEBA de los testimonios', 'Dalia PRUEBA', dalia, 'approved'),
    (g2, 'GCX PRUEBA el del rechazo',     'Dalia PRUEBA', dalia, 'approved'),
    (g3, 'GCX PRUEBA el que se oculta',   'Dalia PRUEBA', dalia, 'approved'),
    (g4, 'GCX PRUEBA sin ningún pedido',  'Dalia PRUEBA', dalia, 'approved');

INSERT INTO public.gcx_testimonios (id, group_id, autor_id, temporada, anio, texto, estado,
                                    eliminacion_pedida_at, eliminacion_motivo, estado_antes_del_pedido, consentimiento_at)
VALUES
    (t1, g1, dalia, 'S3', 2026, TEXTO, 'eliminacion_solicitada', now(), 'PRUEBA me arrepentí', 'publicado', now()),
    (t2, g2, dalia, 'S3', 2026, TEXTO, 'eliminacion_solicitada', now(), NULL,                  'publicado', now()),
    (t3, g3, dalia, 'S3', 2026, TEXTO, 'publicado',              NULL,  NULL,                  NULL,        now()),
    (t4, g4, dalia, 'S3', 2026, TEXTO, 'publicado',              NULL,  NULL,                  NULL,        now());

PERFORM pg_temp.sesion(sixto);

-- ── A1 · Eliminar un pedido → un aviso, y sólo a quien escribió ───────────
v_j := public.testimonios_admin_resolver(t1, 'eliminar');
PERFORM pg_temp.chk('A1', 'eliminar un pedido de eliminación', 'true',
    (v_j->>'ok'));
PERFORM pg_temp.chk('A2', 'le llega UN aviso a quien escribió, con el GCX y en qué quedó',
    'Revisamos tu pedido § Tu testimonio de GCX PRUEBA de los testimonios se dio de baja con éxito. § /perfil/testimonios',
    pg_temp.avisos(dalia));
PERFORM pg_temp.chk('A3', 'no le llega a nadie más', '(ninguno) · (ninguno)',
    pg_temp.avisos(sixto) || ' · ' || pg_temp.avisos(tere));
PERFORM pg_temp.chk('A4', 'el aviso NO lleva el texto del testimonio', 'no',
    (SELECT CASE WHEN count(*) = 0 THEN 'no' ELSE 'SÍ LO LLEVA' END
       FROM public.app_notifications
      WHERE alerta_clave = 'testimonios_pedido_resuelto'
        AND (message ILIKE '%no tiene que viajar%' OR title ILIKE '%no tiene que viajar%')));
PERFORM pg_temp.chk('A5', 'y el testimonio ya no está', '0',
    (SELECT count(*)::text FROM public.gcx_testimonios WHERE id = t1));

-- ── B1 · Rechazar el pedido → un aviso ────────────────────────────────────
DELETE FROM public.app_notifications WHERE alerta_clave = 'testimonios_pedido_resuelto';
v_j := public.testimonios_admin_resolver(t2, 'rechazar');
PERFORM pg_temp.chk('B1', 'rechazar el pedido · vuelve a publicado', 'true · publicado',
    (v_j->>'ok') || ' · ' || (v_j->>'estado'));
PERFORM pg_temp.chk('B2', 'y le avisa que sigue publicado',
    'Revisamos tu pedido § Tu testimonio de GCX PRUEBA el del rechazo sigue publicado. § /perfil/testimonios',
    pg_temp.avisos(dalia));
PERFORM pg_temp.chk('B3', 'un aviso, no dos', '1', pg_temp.cuantos()::text);

-- ── C1 · Ocultar y mostrar NO avisan ──────────────────────────────────────
DELETE FROM public.app_notifications WHERE alerta_clave = 'testimonios_pedido_resuelto';
PERFORM public.testimonios_admin_resolver(t3, 'ocultar');
PERFORM pg_temp.chk('C1', 'ocultar por decisión de Sistemas no avisa', '(ninguno)', pg_temp.avisos(dalia));
PERFORM public.testimonios_admin_resolver(t3, 'mostrar');
PERFORM pg_temp.chk('C2', 'mostrar tampoco', '(ninguno)', pg_temp.avisos(dalia));

-- ── D1 · Eliminar uno que NADIE pidió sacar tampoco avisa ─────────────────
PERFORM public.testimonios_admin_resolver(t4, 'eliminar');
PERFORM pg_temp.chk('D1', 'eliminar uno sin pedido no avisa (no contesta nada)', '(ninguno)',
    pg_temp.avisos(dalia));

-- ── E1 · Permisos: sólo Sistemas resuelve ─────────────────────────────────
DELETE FROM public.app_notifications WHERE alerta_clave = 'testimonios_pedido_resuelto';
INSERT INTO public.gcx_testimonios (id, group_id, autor_id, temporada, anio, texto, estado,
                                    eliminacion_pedida_at, estado_antes_del_pedido, consentimiento_at)
VALUES (t1, g1, dalia, 'S3', 2026, TEXTO, 'eliminacion_solicitada', now(), 'publicado', now());

PERFORM pg_temp.sesion(tere);
PERFORM pg_temp.chk('E1', 'alguien con sesión que no es Sistemas', 'no_autorizado',
    public.testimonios_admin_resolver(t1, 'eliminar')->>'motivo');
PERFORM pg_temp.sesion(dalia);
PERFORM pg_temp.chk('E2', 'ni siquiera quien escribió el testimonio', 'no_autorizado',
    public.testimonios_admin_resolver(t1, 'eliminar')->>'motivo');
PERFORM pg_temp.sesion(NULL);
PERFORM pg_temp.chk('E3', 'sin sesión', 'sin_sesion',
    public.testimonios_admin_resolver(t1, 'eliminar')->>'motivo');
PERFORM pg_temp.chk('E4', 'y ninguno de esos intentos avisó nada', '0', pg_temp.cuantos()::text);
PERFORM pg_temp.chk('E5', 'el testimonio sigue como estaba', 'eliminacion_solicitada',
    (SELECT estado FROM public.gcx_testimonios WHERE id = t1));

-- ── F1 · La alerta, en el catálogo ────────────────────────────────────────
PERFORM pg_temp.chk('F1', 'la alerta está, es apagable y abre Mis testimonios',
    'automatica · GCX · sí · /perfil/testimonios',
    (SELECT tipo || ' · ' || area || ' · ' || CASE WHEN permite_apagar THEN 'sí' ELSE 'no' END
            || ' · ' || url_plantilla
       FROM public.notif_alertas WHERE clave = 'testimonios_pedido_resuelto'));
PERFORM pg_temp.chk('F2', 'usa sólo sus propias variables', 'sí',
    (SELECT CASE WHEN count(*) = 0 THEN 'sí' ELSE 'no: ' || string_agg(m[1], ', ') END
       FROM public.notif_alertas a,
            regexp_matches(a.titulo_plantilla || ' ' || a.mensaje_plantilla, '\{([a-z_]+)\}', 'g') m
      WHERE a.clave = 'testimonios_pedido_resuelto'
        AND NOT (m[1] = ANY (a.variables))));
PERFORM pg_temp.chk('F3', 'el catálogo quedó con 24 automáticas', '24',
    (SELECT count(*)::text FROM public.notif_alertas WHERE tipo = 'automatica'));


-- ── El reporte ────────────────────────────────────────────────────────────
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
