-- ════════════════════════════════════════════════════════════════════════════
-- NOCTURNA — que nadie se inscriba dos veces
-- 2026-10-02
--
-- Prueba de sql/nocturna_sin_duplicados.sql. Correr DESPUÉS de aplicarlo.
--
-- Todo dentro de BEGIN … ROLLBACK: inscribe familias de prueba, mira qué
-- acepta y qué rechaza, y al final no queda nada. NUNCA hacer COMMIT de esto.
--
-- Los DNI de prueba son de la serie 94....... y los apellidos dicen PRUEBA,
-- para que si algo quedara colgado se vea de lejos qué es.
--
-- Cada prueba devuelve una fila con el número, qué se esperaba y si pasó.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TEMP TABLE _r (n TEXT, que TEXT, paso BOOLEAN, detalle TEXT) ON COMMIT DROP;

-- Las pruebas ejercen la inscripción pública, que no corre con las
-- inscripciones cerradas. Va adentro de la transacción: el ROLLBACK lo
-- deshace, estuvieran como estuvieran.
UPDATE public.nocturna_config SET inscripciones_abiertas = true WHERE id = 1;

-- ── 0 · El candado de la base ───────────────────────────────────────────────
-- Si esto falla, lo que sigue también: falta aplicar nocturna_sin_duplicados.sql.
INSERT INTO _r
SELECT '0', 'El índice único del adulto existe',
       EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_nocturna_insc_adulto_dni_edicion'),
       'idx_nocturna_insc_adulto_dni_edicion';

DO $$
DECLARE
    v_ed     INTEGER;
    r        JSONB;
    v_insc   UUID;
    v_err    TEXT;
    v_dni_j  TEXT;
    v_dni_a  TEXT;

    -- Lo que toda inscripción lleva igual, para que cada caso diga sólo
    -- aquello que lo hace distinto.
    v_pago  CONSTANT JSONB := jsonb_build_object(
        'autorizaAsistencia', true,
        'aceptaFotos', true,
        'declaracionesVersion', 'PRUEBA-v1',
        'comprobantePath', 'PRUEBA/comprobante.png');
    v_chico CONSTANT JSONB := jsonb_build_object(
        'apellido', 'PRUEBA', 'fechaNacimiento', '2010-05-10',
        'tribu', 'Trueno', 'retiroTipo', 'adulto');
    v_adulto_a CONSTANT JSONB := jsonb_build_object(
        'nombre', 'Adulto', 'apellido', 'PRUEBA', 'dni', '94000001',
        'email', 'prueba-a@origen.test', 'fechaNacimiento', '1985-03-20');
    v_adulto_b CONSTANT JSONB := jsonb_build_object(
        'nombre', 'Otro', 'apellido', 'PRUEBA', 'dni', '94000002',
        'email', 'prueba-b@origen.test', 'fechaNacimiento', '1983-07-11');
BEGIN
    SELECT edicion INTO v_ed FROM public.nocturna_config LIMIT 1;

    -- ── 1 · Control: una inscripción normal tiene que entrar ────────────────
    -- Sin esto, un "rechaza todo" pasaría las cinco pruebas siguientes.
    r := public.register_nocturna(v_pago || jsonb_build_object(
        'adulto',  v_adulto_a,
        'jovenes', jsonb_build_array(v_chico || jsonb_build_object('nombre','Hijo Uno','dni','94000101'))));
    INSERT INTO _r VALUES ('1', 'Una inscripción normal entra',
        (r->>'ok')::BOOLEAN IS TRUE, COALESCE(r->>'error', 'entró: ' || (r->>'codigo_entrada')));

    -- ── 2 · El mismo adulto, de nuevo, con otro chico ───────────────────────
    r := public.register_nocturna(v_pago || jsonb_build_object(
        'adulto',  v_adulto_a,
        'jovenes', jsonb_build_array(v_chico || jsonb_build_object('nombre','Hijo Dos','dni','94000102'))));
    INSERT INTO _r VALUES ('2', 'El MISMO adulto no se inscribe dos veces',
        (r->>'ok')::BOOLEAN IS NOT TRUE, COALESCE(r->>'error', '*** ENTRÓ ***'));

    -- ── 3 · Otro adulto, el mismo chico ─────────────────────────────────────
    r := public.register_nocturna(v_pago || jsonb_build_object(
        'adulto',  v_adulto_b,
        'jovenes', jsonb_build_array(v_chico || jsonb_build_object('nombre','Hijo Uno','dni','94000101'))));
    INSERT INTO _r VALUES ('3', 'El MISMO chico no se inscribe dos veces',
        (r->>'ok')::BOOLEAN IS NOT TRUE, COALESCE(r->>'error', '*** ENTRÓ ***'));

    -- ── 4 · Un adulto con el DNI de un chico ya inscripto ───────────────────
    -- La misma persona en las dos listas: para el DNI no hay "adulto" ni "chico".
    r := public.register_nocturna(v_pago || jsonb_build_object(
        'adulto',  v_adulto_b || jsonb_build_object('dni','94000101'),
        'jovenes', jsonb_build_array(v_chico || jsonb_build_object('nombre','Hijo Tres','dni','94000103'))));
    INSERT INTO _r VALUES ('4', 'Un adulto con el DNI de un chico ya inscripto',
        (r->>'ok')::BOOLEAN IS NOT TRUE, COALESCE(r->>'error', '*** ENTRÓ ***'));

    -- ── 5 · Un chico con el DNI de un adulto ya inscripto ───────────────────
    r := public.register_nocturna(v_pago || jsonb_build_object(
        'adulto',  v_adulto_b,
        'jovenes', jsonb_build_array(v_chico || jsonb_build_object('nombre','Hijo Cuatro','dni','94000001'))));
    INSERT INTO _r VALUES ('5', 'Un chico con el DNI de un adulto ya inscripto',
        (r->>'ok')::BOOLEAN IS NOT TRUE, COALESCE(r->>'error', '*** ENTRÓ ***'));

    -- ── 6 · El adulto se carga a sí mismo como chico ────────────────────────
    r := public.register_nocturna(v_pago || jsonb_build_object(
        'adulto',  v_adulto_b || jsonb_build_object('dni','94000777'),
        'jovenes', jsonb_build_array(v_chico || jsonb_build_object('nombre','El mismo','dni','94000777'))));
    INSERT INTO _r VALUES ('6', 'El adulto cargado también como chico',
        (r->>'ok')::BOOLEAN IS NOT TRUE, COALESCE(r->>'error', '*** ENTRÓ ***'));

    -- ── 7 y 8 · Editar una inscripción sin tocar los DNI ────────────────────
    -- El riesgo de todo esto: que una inscripción choque CONSIGO MISMA y el
    -- panel no pueda guardar ninguna edición. Se prueba la validación
    -- directamente, que es lo que usa admin_editar_nocturna, con y sin la
    -- exclusión de la propia inscripción.
    SELECT i.id INTO v_insc
      FROM public.nocturna_inscripciones i
     WHERE i.edicion = v_ed AND btrim(i.adulto_dni) = '94000001'
     LIMIT 1;

    IF v_insc IS NULL THEN
        INSERT INTO _r VALUES ('7', 'Editar la propia inscripción sigue siendo posible',
            false, 'no se pudo crear la inscripción de la prueba 1');
    ELSE
        SELECT btrim(j.dni) INTO v_dni_j FROM public.nocturna_jovenes j
         WHERE j.inscripcion_id = v_insc LIMIT 1;
        SELECT btrim(i.adulto_dni) INTO v_dni_a FROM public.nocturna_inscripciones i
         WHERE i.id = v_insc;

        v_err := public.nocturna_validar_payload(
            v_pago || jsonb_build_object(
                'adulto',  v_adulto_a,
                'jovenes', jsonb_build_array(v_chico || jsonb_build_object('nombre','Hijo Uno','dni', v_dni_j))),
            v_ed, false, true, v_insc);
        INSERT INTO _r VALUES ('7', 'Editar la propia inscripción sigue siendo posible',
            v_err IS NULL, COALESCE(v_err, 'sin error, como corresponde'));

        -- La misma llamada sin excluirla: tiene que chocar. Si esta pasara,
        -- la 7 estaría pasando porque los chequeos no miran nada.
        v_err := public.nocturna_validar_payload(
            v_pago || jsonb_build_object(
                'adulto',  v_adulto_a,
                'jovenes', jsonb_build_array(v_chico || jsonb_build_object('nombre','Hijo Uno','dni', v_dni_j))),
            v_ed, false, true, NULL);
        INSERT INTO _r VALUES ('8', 'Sin excluirla, esa misma inscripción choca',
            v_err IS NOT NULL, COALESCE(v_err, '*** no chocó ***'));
    END IF;

    -- ── 9 · El candado de la base, probado de verdad ────────────────────────
    -- Saltea la validación y escribe directo, que es lo que haría una carrera
    -- entre dos envíos simultáneos. Tiene que rebotar el índice único.
    BEGIN
        INSERT INTO public.nocturna_inscripciones (
            edicion, codigo_entrada, adulto_nombre, adulto_apellido, adulto_dni,
            adulto_email, adulto_fecha_nacimiento, autoriza_asistencia, acepta_fotos,
            declaraciones_version, declaraciones_aceptadas_at, precio_unitario, total)
        VALUES (
            v_ed, 'ZZPRU2', 'Adulto', 'PRUEBA', '94000001',
            'prueba-a@origen.test', DATE '1985-03-20', true, true,
            'PRUEBA-v1', now(), 0, 0);
        INSERT INTO _r VALUES ('9', 'El índice único rebota al adulto repetido',
            false, '*** entró escribiendo directo en la tabla ***');
    EXCEPTION WHEN unique_violation THEN
        INSERT INTO _r VALUES ('9', 'El índice único rebota al adulto repetido',
            true, 'unique_violation, como corresponde');
    END;
END $$;

-- ── Resultado ───────────────────────────────────────────────────────────────
SELECT n,
       que,
       CASE WHEN paso THEN 'PASA' ELSE 'FALLA' END AS estado,
       detalle
  FROM _r
 ORDER BY n;

ROLLBACK;
