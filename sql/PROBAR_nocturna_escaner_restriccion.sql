-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de sql/nocturna_escaner_restriccion.sql
--
-- BEGIN … ROLLBACK y un RAISE EXCEPTION final a propósito: se deshace todo.
-- La inscripción de prueba dispara `trigger_nocturna_entrada`, que encola el
-- email de la entrada en pg_net; el ROLLBACK también se lleva esa cola, así
-- que NO SALE NINGÚN EMAIL. NUNCA COMMIT.
--
-- Personas: Vero (ACREDITACION, la que escanea) y Caro (sin rol).
-- Familia de prueba: dos adolescentes, uno celíaco y uno sin restricción.
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


DO $suite$
DECLARE
    vero uuid := gen_random_uuid();
    caro uuid := gen_random_uuid();
    v_insc uuid := gen_random_uuid();
    v_ficha jsonb;
    v_joven jsonb;
    v_fallos integer;
    v_salida text;
BEGIN
-- ── Fixture ───────────────────────────────────────────────────────────────
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
SELECT x, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'prueba.noct.' || left(x::text, 8) || '@test.local', '', now(), now()
  FROM unnest(ARRAY[vero, caro]) x;

INSERT INTO public.users (id, name, email, role, roles, is_active) VALUES
    (vero, 'Vero PRUEBA', 'prueba.noct.vero@test.local', 'ACREDITACION', ARRAY['ACREDITACION'], true),
    (caro, 'Caro PRUEBA', 'prueba.noct.caro@test.local', 'VIEWER',       ARRAY['VIEWER'],       true)
-- handle_new_user ya creó la fila al insertar en auth.users.
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role,
                               roles = EXCLUDED.roles, is_active = true;

INSERT INTO public.nocturna_inscripciones (
    id, edicion, codigo_entrada, adulto_nombre, adulto_apellido, adulto_dni, adulto_email,
    adulto_telefono, adulto_fecha_nacimiento, autoriza_asistencia, acepta_fotos,
    declaraciones_version, declaraciones_aceptadas_at, precio_unitario, total)
VALUES (v_insc, 99, 'PRUEBA', 'Ana', 'PRUEBA', '30111222', 'prueba.noct.ana@test.local',
        '1122334455', DATE '1980-05-04', true, false, 'prueba', now(), 0, 0);

INSERT INTO public.nocturna_jovenes (inscripcion_id, edicion, nombre, apellido, dni,
                                     fecha_nacimiento, tribu, retiro_tipo, restriccion)
VALUES (v_insc, 99, 'Ana', 'PRUEBA', '55111222', DATE '2010-03-02', 'Garra', 'adulto', 'celiaco'),
       (v_insc, 99, 'Bruno', 'PRUEBA', '55111333', DATE '2009-07-20', 'Trueno', 'solo', 'ninguna');


-- ── R1 · La ficha trae la restricción de cada uno ─────────────────────────
PERFORM pg_temp.sesion(vero);
v_ficha := public.get_nocturna_para_acreditar(v_insc);

PERFORM pg_temp.chk('R1', 'la ficha del escáner trae la restricción de cada adolescente',
    'Ana celiaco, Bruno ninguna',
    (SELECT string_agg((j->>'nombre') || ' ' || COALESCE(j->>'restriccion', '(falta)'), ', ' ORDER BY j->>'nombre')
       FROM jsonb_array_elements(v_ficha->'jovenes') j));

-- ── R2 · No se perdió ni un campo de los que ya venían ────────────────────
v_joven := (v_ficha->'jovenes')->0;
PERFORM pg_temp.chk('R2', 'el adolescente sigue trayendo todos los campos de antes, más restriccion',
    'acreditado_at, apellido, ausente_at, dni, edad, fecha_nacimiento, id, nombre, restriccion, retirado_at, retiro_apellido, retiro_dni, retiro_nombre, retiro_telefono, retiro_tipo, sin_celular, telefono, tribu, tribu_en_puerta',
    (SELECT string_agg(k, ', ' ORDER BY k) FROM jsonb_object_keys(v_joven) k));

PERFORM pg_temp.chk('R3', 'la inscripción sigue trayendo los mismos campos',
    'acepta_fotos, adulto_acreditado_at, adulto_apellido, adulto_dni, adulto_email, adulto_nombre, adulto_telefono, aprobado_at, codigo_entrada, edicion, id, total',
    (SELECT string_agg(k, ', ' ORDER BY k) FROM jsonb_object_keys(v_ficha->'inscripcion') k));

-- ── R4 · Los datos del adulto que muestra la puerta ───────────────────────
PERFORM pg_temp.chk('R4', 'el adulto viene con nombre, DNI, celular y email',
    'Ana PRUEBA · 30111222 · 1122334455 · prueba.noct.ana@test.local',
    (v_ficha->'inscripcion'->>'adulto_nombre') || ' ' || (v_ficha->'inscripcion'->>'adulto_apellido')
    || ' · ' || (v_ficha->'inscripcion'->>'adulto_dni')
    || ' · ' || (v_ficha->'inscripcion'->>'adulto_telefono')
    || ' · ' || (v_ficha->'inscripcion'->>'adulto_email'));

PERFORM pg_temp.chk('R5', 'y el permiso de fotos, que acá es "no"', 'false',
    v_ficha->'inscripcion'->>'acepta_fotos');

-- ── R6 · La edad se sigue calculando sola ─────────────────────────────────
PERFORM pg_temp.chk('R6', 'la edad la calcula la base, no la pantalla', 'true',
    ((v_joven->>'edad')::integer BETWEEN 10 AND 20)::text);

-- ── R7 · Permisos ─────────────────────────────────────────────────────────
PERFORM pg_temp.sesion(caro);
PERFORM pg_temp.chk('R7', 'alguien con sesión pero sin rol de acreditación', 'sin_permiso',
    public.get_nocturna_para_acreditar(v_insc)->>'motivo');

PERFORM pg_temp.sesion(NULL);
PERFORM pg_temp.chk('R8', 'sin sesión', 'sin_permiso',
    public.get_nocturna_para_acreditar(v_insc)->>'motivo');

PERFORM pg_temp.sesion(vero);
PERFORM pg_temp.chk('R9', 'una entrada que no existe', 'no_existe',
    public.get_nocturna_para_acreditar('00000000-0000-4000-8000-000000000000')->>'motivo');

PERFORM pg_temp.chk('R10', 'la función no es ejecutable por anon, sí por authenticated', 'no, sí',
    CASE WHEN has_function_privilege('anon', 'public.get_nocturna_para_acreditar(uuid)', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ', ' ||
    CASE WHEN has_function_privilege('authenticated', 'public.get_nocturna_para_acreditar(uuid)', 'EXECUTE') THEN 'sí' ELSE 'no' END);


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
