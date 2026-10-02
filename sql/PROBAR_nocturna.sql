-- ════════════════════════════════════════════════════════════════════════════
-- NOCTURNA — verificación del esquema
-- 2026-09-30
--
-- Todo dentro de BEGIN … ROLLBACK: crea dos usuarios de prueba, inscribe
-- familias, acredita, y al final no queda nada. NUNCA hacer COMMIT de esto.
--
-- Simula los roles como lo hace Supabase: SET LOCAL ROLE + request.jwt.claims,
-- que es de donde auth.uid() saca el sub.
--
-- Cada prueba devuelve una fila con el número, qué se esperaba y si pasó.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TEMP TABLE _r (n TEXT, que TEXT, paso BOOLEAN, detalle TEXT) ON COMMIT DROP;

-- La suite ejerce la inscripción pública, así que necesita las inscripciones
-- abiertas. Fuera de la prueba están cerradas a propósito (los datos de pago
-- son de ejemplo), y antes de este cambio cinco casos fallaban por eso en vez
-- de por lo que prueban. Va adentro de la transacción: el ROLLBACK del final
-- lo deshace.
UPDATE public.nocturna_config SET inscripciones_abiertas = true WHERE id = 1;

-- ── Usuarios de prueba ──────────────────────────────────────────────────────
-- Uno con SOLO el rol ACREDITACION (el caso que pide el prompt) y otro sin
-- ningún rol. public.users.id tiene FK a auth.users, así que van los dos.
DO $$
DECLARE
    v_staff UUID := '11111111-1111-4111-8111-111111111111';
    v_pelado UUID := '22222222-2222-4222-8222-222222222222';
BEGIN
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
    VALUES
      (v_staff,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staff.nocturna@test.local',  '', now(), now()),
      (v_pelado, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pelado.nocturna@test.local', '', now(), now())
    ON CONFLICT (id) DO NOTHING;

    -- DO UPDATE y no DO NOTHING: el trigger handle_new_user sobre auth.users
    -- ya creó la fila en public.users con roles {VIEWER}, así que un
    -- DO NOTHING dejaba al "staff" sin su rol y las pruebas 9 a 11 fallaban
    -- por permisos en vez de por lo que querían medir.
    INSERT INTO public.users (id, name, email, role, roles, is_active)
    VALUES
      (v_staff,  'Staff Acreditación', 'staff.nocturna@test.local',  'VIEWER', ARRAY['ACREDITACION']::text[], true),
      (v_pelado, 'Sin Rol',            'pelado.nocturna@test.local', 'VIEWER', ARRAY['VIEWER']::text[],       true)
    ON CONFLICT (id) DO UPDATE
      SET role = EXCLUDED.role, roles = EXCLUDED.roles, is_active = true;
END $$;

-- Payload base reutilizable
CREATE TEMP TABLE _p (k TEXT PRIMARY KEY, payload JSONB) ON COMMIT DROP;
-- Los bloques de abajo cambian de rol, y un temp table no es legible por anon
-- salvo que se lo permita explicitamente. Muere con el ROLLBACK igual.
GRANT SELECT ON _p TO anon, authenticated;

INSERT INTO _p VALUES ('ok', jsonb_build_object(
    'adulto', jsonb_build_object('nombre','Ana','apellido','Pérez','dni','30111222',
                                 'email','ana@test.local','fechaNacimiento','1988-04-10'),
    'jovenes', jsonb_build_array(
        jsonb_build_object('nombre','Sofía','apellido','Pérez','dni','48392015',
                           'fechaNacimiento','2011-05-14','tribu','Trueno','retiroTipo','adulto'),
        jsonb_build_object('nombre','Tomás','apellido','Pérez','dni','49500111',
                           'fechaNacimiento','2013-08-02','tribu','Garra','retiroTipo','solo')
    ),
    'autorizaAsistencia', true,
    'aceptaFotos', true,
    'declaracionesVersion','2026-09-30',
    'comprobantePath','nocturna-comprobantes/test.jpg'
));


-- ════════════════════════════════════════════════════════════════════════════
-- 1 · anon NO lee inscripciones ni chicos
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_i INT; v_j INT; v_err TEXT := '';
BEGIN
    SET LOCAL ROLE anon;
    BEGIN SELECT count(*) INTO v_i FROM public.nocturna_inscripciones;
    EXCEPTION WHEN insufficient_privilege THEN v_i := -1; v_err := 'denegado'; END;
    BEGIN SELECT count(*) INTO v_j FROM public.nocturna_jovenes;
    EXCEPTION WHEN insufficient_privilege THEN v_j := -1; END;
    RESET ROLE;
    INSERT INTO _r VALUES ('1', 'anon no ve inscripciones ni chicos',
        (v_i <= 0 AND v_j <= 0), format('insc=%s jovenes=%s %s', v_i, v_j, v_err));
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- 2 · anon SÍ puede inscribirse con datos válidos
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v JSONB;
BEGIN
    SET LOCAL ROLE anon;
    v := public.register_nocturna((SELECT payload FROM _p WHERE k='ok'));
    RESET ROLE;
    INSERT INTO _r VALUES ('2', 'anon se inscribe con datos válidos',
        (v->>'ok')::boolean IS TRUE, v::text);
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- 3 · Adulto de 16 años → rechazado
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v JSONB; p JSONB;
BEGIN
    p := jsonb_set((SELECT payload FROM _p WHERE k='ok'), '{adulto,fechaNacimiento}',
                   to_jsonb(to_char(current_date - INTERVAL '16 years', 'YYYY-MM-DD')));
    p := jsonb_set(p, '{jovenes,0,dni}', '"77000001"');
    p := jsonb_set(p, '{jovenes,1,dni}', '"77000002"');
    SET LOCAL ROLE anon;
    v := public.register_nocturna(p);
    RESET ROLE;
    INSERT INTO _r VALUES ('3', 'adulto de 16 años rechazado',
        (v->>'ok')::boolean IS FALSE AND v->>'error' ILIKE '%18%', v->>'error');
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- 4 · autoriza_asistencia = false → rechazado
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v JSONB; p JSONB;
BEGIN
    p := jsonb_set((SELECT payload FROM _p WHERE k='ok'), '{autorizaAsistencia}', 'false');
    p := jsonb_set(p, '{jovenes,0,dni}', '"77000003"');
    p := jsonb_set(p, '{jovenes,1,dni}', '"77000004"');
    SET LOCAL ROLE anon;
    v := public.register_nocturna(p);
    RESET ROLE;
    INSERT INTO _r VALUES ('4', 'sin autorización rechazado',
        (v->>'ok')::boolean IS FALSE, v->>'error');
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- 5 · Sin comprobante → rechazado (en la pública)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v JSONB; p JSONB;
BEGIN
    p := (SELECT payload FROM _p WHERE k='ok') - 'comprobantePath';
    p := jsonb_set(p, '{jovenes,0,dni}', '"77000005"');
    p := jsonb_set(p, '{jovenes,1,dni}', '"77000006"');
    SET LOCAL ROLE anon;
    v := public.register_nocturna(p);
    RESET ROLE;
    INSERT INTO _r VALUES ('5', 'sin comprobante rechazado',
        (v->>'ok')::boolean IS FALSE AND v->>'error' ILIKE '%comprobante%', v->>'error');
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- 6 · DNI de chico repetido → rechazado
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v JSONB; p JSONB;
BEGIN
    -- 48392015 ya quedó inscripto en la prueba 2
    p := jsonb_set((SELECT payload FROM _p WHERE k='ok'), '{jovenes,1,dni}', '"77000007"');
    p := jsonb_set(p, '{adulto,dni}', '"30999888"');
    SET LOCAL ROLE anon;
    v := public.register_nocturna(p);
    RESET ROLE;
    INSERT INTO _r VALUES ('6', 'DNI de chico ya inscripto rechazado',
        (v->>'ok')::boolean IS FALSE AND v->>'error' ILIKE '%48392015%', v->>'error');
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- 7 · Total manipulado → se ignora, manda el calculado
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v JSONB; p JSONB; v_total NUMERIC; v_precio NUMERIC;
BEGIN
    SELECT precio_entrada INTO v_precio FROM public.nocturna_config WHERE id=1;
    p := (SELECT payload FROM _p WHERE k='ok') || jsonb_build_object('total', 1, 'precioUnitario', 1);
    p := jsonb_set(p, '{adulto,dni}', '"30777666"');
    p := jsonb_set(p, '{jovenes,0,dni}', '"77000010"');
    p := jsonb_set(p, '{jovenes,1,dni}', '"77000011"');
    SET LOCAL ROLE anon;
    v := public.register_nocturna(p);
    RESET ROLE;
    SELECT total INTO v_total FROM public.nocturna_inscripciones WHERE id = (v->>'inscripcion_id')::uuid;
    INSERT INTO _r VALUES ('7', 'total del cliente ignorado',
        v_total = v_precio * 2, format('guardado=%s esperado=%s', v_total, v_precio*2));
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- 8 · Autenticado sin rol: no ve nada ajeno, no ejecuta 5B/5C/5D/5E
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_c INT; vb JSONB; vc JSONB; vd JSONB; ve JSONB; v_id UUID;
BEGIN
    SELECT id INTO v_id FROM public.nocturna_inscripciones LIMIT 1;
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
    SELECT count(*) INTO v_c FROM public.nocturna_inscripciones;
    vb := public.admin_crear_nocturna((SELECT payload FROM _p WHERE k='ok'));
    vc := public.get_nocturna_para_acreditar(v_id);
    vd := public.set_nocturna_acreditacion(v_id, true, ARRAY[]::uuid[]);
    ve := public.update_nocturna_precio(1);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    INSERT INTO _r VALUES ('8', 'autenticado sin rol: 0 filas y 5B/5C/5D/5E denegados',
        v_c = 0
          AND (vb->>'ok')::boolean IS FALSE
          AND (vc->>'ok')::boolean IS FALSE
          AND (vd->>'ok')::boolean IS FALSE
          AND (ve->>'ok')::boolean IS FALSE,
        format('filas=%s', v_c));
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- 9 · Staff (SOLO rol ACREDITACION): ve todo, crea y acredita
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_c INT; vb JSONB;
BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
    SELECT count(*) INTO v_c FROM public.nocturna_inscripciones;
    vb := public.admin_crear_nocturna(
        jsonb_set(jsonb_set((SELECT payload FROM _p WHERE k='ok') - 'comprobantePath',
                            '{adulto,dni}', '"30555444"'),
                  '{jovenes,0,dni}', '"77000020"') #- '{jovenes,1}');
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    INSERT INTO _r VALUES ('9', 'staff con solo ACREDITACION ve y crea (sin comprobante)',
        v_c > 0 AND (vb->>'ok')::boolean IS TRUE, format('veia=%s alta=%s', v_c, vb->>'ok'));
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- 10 · set_nocturna_acreditacion: reglas de estado
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
    v_id UUID; v_j UUID[]; v1 JSONB; v2 JSONB; v3 JSONB; v4 JSONB;
    v_ap1 TIMESTAMPTZ; v_hora_primero TIMESTAMPTZ; v_hora_despues TIMESTAMPTZ; v_ap_final TIMESTAMPTZ;
BEGIN
    SELECT i.id INTO v_id FROM public.nocturna_inscripciones i
    JOIN public.nocturna_jovenes j ON j.inscripcion_id = i.id
    GROUP BY i.id HAVING count(j.id) >= 2 LIMIT 1;
    SELECT array_agg(j.id ORDER BY j.nombre) INTO v_j FROM public.nocturna_jovenes j WHERE j.inscripcion_id = v_id;

    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

    -- a) sólo el adulto → error
    v1 := public.set_nocturna_acreditacion(v_id, true, ARRAY[]::uuid[]);
    -- b) un chico sin adulto → error
    v2 := public.set_nocturna_acreditacion(v_id, false, ARRAY[v_j[1]]);
    -- c) adulto + 1 → aprobado
    v3 := public.set_nocturna_acreditacion(v_id, true, ARRAY[v_j[1]]);
    RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);

    SELECT aprobado_at INTO v_ap1 FROM public.nocturna_inscripciones WHERE id = v_id;
    SELECT acreditado_at INTO v_hora_primero FROM public.nocturna_jovenes WHERE id = v_j[1];

    PERFORM pg_sleep(0.05);

    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
    -- d) sumar el segundo chico: no debe pisar la hora del primero
    PERFORM public.set_nocturna_acreditacion(v_id, true, ARRAY[v_j[1], v_j[2]]);
    RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);

    SELECT acreditado_at INTO v_hora_despues FROM public.nocturna_jovenes WHERE id = v_j[1];

    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
    -- e) desmarcar todo → aprobado_at vuelve a NULL
    v4 := public.set_nocturna_acreditacion(v_id, false, ARRAY[]::uuid[]);
    RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);

    SELECT aprobado_at INTO v_ap_final FROM public.nocturna_inscripciones WHERE id = v_id;

    INSERT INTO _r VALUES ('10a','sólo el adulto → error',        (v1->>'ok')::boolean IS FALSE, v1->>'error');
    INSERT INTO _r VALUES ('10b','chico sin adulto → error',      (v2->>'ok')::boolean IS FALSE, v2->>'error');
    INSERT INTO _r VALUES ('10c','adulto + 1 → aprobado_at',      (v3->>'ok')::boolean IS TRUE AND v_ap1 IS NOT NULL, v_ap1::text);
    INSERT INTO _r VALUES ('10d','re-escanear no pisa la hora',   v_hora_primero = v_hora_despues, format('%s vs %s', v_hora_primero, v_hora_despues));
    INSERT INTO _r VALUES ('10e','desmarcar todo → aprobado NULL',(v4->>'ok')::boolean IS TRUE AND v_ap_final IS NULL, COALESCE(v_ap_final::text,'NULL'));
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- 11 · Cambiar el precio no toca las inscripciones previas
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_antes NUMERIC; v_despues NUMERIC; v JSONB; v_id UUID;
BEGIN
    SELECT id, precio_unitario INTO v_id, v_antes FROM public.nocturna_inscripciones ORDER BY created_at LIMIT 1;
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
    v := public.update_nocturna_precio(99999);
    RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
    SELECT precio_unitario INTO v_despues FROM public.nocturna_inscripciones WHERE id = v_id;
    INSERT INTO _r VALUES ('11','el precio viejo no se mueve',
        (v->>'ok')::boolean IS TRUE AND v_antes = v_despues,
        format('antes=%s despues=%s', v_antes, v_despues));
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- 12 · Permisos de ejecución: anon sólo register_nocturna
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO _r
SELECT '12', 'permisos de ejecución por función', bool_and(ok), string_agg(detalle, ' · ')
FROM (
    SELECT
        f.nombre,
        has_function_privilege('anon', f.sig, 'EXECUTE') = f.anon_esperado
        AND has_function_privilege('authenticated', f.sig, 'EXECUTE') = f.auth_esperado AS ok,
        format('%s anon=%s(esp %s) auth=%s(esp %s)', f.nombre,
               has_function_privilege('anon', f.sig, 'EXECUTE'), f.anon_esperado,
               has_function_privilege('authenticated', f.sig, 'EXECUTE'), f.auth_esperado) AS detalle
    FROM (VALUES
        ('register_nocturna',           'public.register_nocturna(jsonb)',                     true,  true),
        ('admin_crear_nocturna',        'public.admin_crear_nocturna(jsonb)',                  false, true),
        ('get_nocturna_para_acreditar', 'public.get_nocturna_para_acreditar(uuid)',            false, true),
        ('set_nocturna_acreditacion',   'public.set_nocturna_acreditacion(uuid,boolean,uuid[])', false, true),
        ('update_nocturna_precio',      'public.update_nocturna_precio(numeric)',              false, true),
        ('is_nocturna_staff',           'public.is_nocturna_staff()',                          false, true),
        ('nocturna_alta',               'public.nocturna_alta(jsonb,boolean,uuid)',            false, false),
        ('nocturna_generar_codigo',     'public.nocturna_generar_codigo()',                    false, false)
    ) AS f(nombre, sig, anon_esperado, auth_esperado)
) x;


-- ════════════════════════════════════════════════════════════════════════════
-- Storage · anon sube y NO lee; el bucket es privado
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO _r
SELECT 'S1', 'bucket privado con límites',
       b.public = false AND b.file_size_limit = 5242880 AND b.allowed_mime_types IS NOT NULL,
       format('public=%s limite=%s tipos=%s', b.public, b.file_size_limit, b.allowed_mime_types)
FROM storage.buckets b WHERE b.id = 'nocturna-comprobantes';

INSERT INTO _r
SELECT 'S2', 'policies del bucket: anon inserta, sólo staff lee',
       bool_and(ok), string_agg(detalle, ' · ')
FROM (
    SELECT
        (p.cmd = 'INSERT' AND 'anon' = ANY(p.roles)) OR (p.cmd IN ('SELECT','DELETE') AND NOT ('anon' = ANY(p.roles))) AS ok,
        format('%s[%s:%s]', p.policyname, p.cmd, array_to_string(p.roles, ',')) AS detalle
    FROM pg_policies p
    WHERE p.schemaname = 'storage' AND p.tablename = 'objects'
      AND p.policyname LIKE 'nocturna_comprobantes%'
) y;

INSERT INTO _r
SELECT 'S3', 'ninguna policy de SELECT para anon en las tablas con menores',
       NOT EXISTS (
           SELECT 1 FROM pg_policies p
           WHERE p.schemaname='public'
             AND p.tablename IN ('nocturna_inscripciones','nocturna_jovenes')
             AND 'anon' = ANY(p.roles)
       ),
       COALESCE((SELECT string_agg(p.policyname||':'||array_to_string(p.roles,','), ' · ')
                 FROM pg_policies p
                 WHERE p.schemaname='public'
                   AND p.tablename IN ('nocturna_inscripciones','nocturna_jovenes')), 'sin policies');


-- ── Resultado ───────────────────────────────────────────────────────────────
SELECT n AS "#",
       CASE WHEN paso THEN 'PASA' ELSE 'FALLA' END AS estado,
       que,
       detalle
FROM _r ORDER BY n;

ROLLBACK;
