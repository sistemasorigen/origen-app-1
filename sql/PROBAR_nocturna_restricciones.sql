-- ════════════════════════════════════════════════════════════════════════════
-- NOCTURNA — restricciones alimentarias
-- 2026-10-04
--
-- Prueba de sql/nocturna_restricciones.sql. Correr DESPUÉS de aplicarlo.
-- Todo dentro de BEGIN … ROLLBACK: no queda nada. NUNCA hacer COMMIT.
--
-- Lo que importa acá no es que el dato se guarde: es que no se PIERDA en
-- ninguno de los tres caminos por los que entra un adolescente (el alta pública, el
-- agregado de un hermano y la edición del panel). Si uno solo lo olvida, la
-- cocina se entera la noche del evento.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TEMP TABLE _r (n TEXT, que TEXT, paso BOOLEAN, detalle TEXT) ON COMMIT DROP;

UPDATE public.nocturna_config SET inscripciones_abiertas = true WHERE id = 1;

DO $$
DECLARE
    v_ed    INTEGER;
    r       JSONB;
    v_insc  UUID;
    v_j     TEXT;

    v_pago  CONSTANT JSONB := jsonb_build_object(
        'autorizaAsistencia', true, 'aceptaFotos', true,
        'declaracionesVersion', 'PRUEBA-v1', 'comprobantePath', 'PRUEBA/comp.png');
    v_chico CONSTANT JSONB := jsonb_build_object(
        'apellido', 'PRUEBA', 'fechaNacimiento', '2012-05-10',
        'tribu', 'Trueno', 'retiroTipo', 'adulto');
    v_adulto CONSTANT JSONB := jsonb_build_object(
        'nombre', 'Dieta', 'apellido', 'PRUEBA', 'dni', '98000001',
        'email', 'dieta@origen.test', 'fechaNacimiento', '1984-02-02');
BEGIN
    SELECT edicion INTO v_ed FROM public.nocturna_config LIMIT 1;

    -- ── 1 · El alta pública guarda lo de cada uno ───────────────────────────
    r := public.register_nocturna(v_pago || jsonb_build_object(
        'adulto',  v_adulto,
        'jovenes', jsonb_build_array(
            v_chico || jsonb_build_object('nombre','Celia','dni','98000101','restriccion','celiaco'),
            v_chico || jsonb_build_object('nombre','Normal','dni','98000102','restriccion','ninguna'))));
    v_insc := (r->>'inscripcion_id')::UUID;
    INSERT INTO _r VALUES ('1', 'El alta entra con las restricciones cargadas',
        (r->>'ok')::BOOLEAN IS TRUE, COALESCE(r->>'error','ok'));

    SELECT string_agg(nombre || '=' || restriccion, ', ' ORDER BY nombre) INTO v_j
      FROM public.nocturna_jovenes WHERE inscripcion_id = v_insc;
    INSERT INTO _r VALUES ('2', 'Quedó guardada por adolescente, no por familia',
        v_j = 'Celia=celiaco, Normal=ninguna', COALESCE(v_j, '(nada)'));

    -- ── 3 · Un payload viejo, sin el campo ──────────────────────────────────
    -- La app desplegada hoy no manda `restriccion`. Mientras no se despliegue
    -- la nueva, esas inscripciones tienen que seguir entrando.
    r := public.nocturna_agregar_jovenes(jsonb_build_object(
        'adulto', jsonb_build_object('dni','98000001','fechaNacimiento','1984-02-02'),
        'declaracionesVersion', 'PRUEBA-v1',
        'comprobantePath', 'PRUEBA/segundo.png',
        'jovenes', jsonb_build_array(v_chico || jsonb_build_object('nombre','SinCampo','dni','98000103'))));
    INSERT INTO _r VALUES ('3', 'Un payload sin el campo sigue entrando',
        (r->>'ok')::BOOLEAN IS TRUE, COALESCE(r->>'error','ok'));

    SELECT restriccion INTO v_j FROM public.nocturna_jovenes WHERE dni = '98000103';
    INSERT INTO _r VALUES ('4', 'Y queda en "ninguna", no en NULL',
        v_j = 'ninguna', COALESCE(v_j, '(NULL)'));

    -- ── 5 · Agregar un hermano con diabetes ─────────────────────────────────
    r := public.nocturna_agregar_jovenes(jsonb_build_object(
        'adulto', jsonb_build_object('dni','98000001','fechaNacimiento','1984-02-02'),
        'declaracionesVersion', 'PRUEBA-v1',
        'comprobantePath', 'PRUEBA/tercero.png',
        'jovenes', jsonb_build_array(
            v_chico || jsonb_build_object('nombre','Diabo','dni','98000104','restriccion','diabetes'))));
    SELECT restriccion INTO v_j FROM public.nocturna_jovenes WHERE dni = '98000104';
    INSERT INTO _r VALUES ('5', 'El hermano que se suma después también la trae',
        (r->>'ok')::BOOLEAN IS TRUE AND v_j = 'diabetes', COALESCE(r->>'error', 'restricción: ' || COALESCE(v_j,'(nada)')));

    -- ── 6 · Un valor que no existe ──────────────────────────────────────────
    r := public.register_nocturna(v_pago || jsonb_build_object(
        'adulto',  v_adulto || jsonb_build_object('dni','98000002'),
        'jovenes', jsonb_build_array(
            v_chico || jsonb_build_object('nombre','Raro','dni','98000105','restriccion','vegano'))));
    INSERT INTO _r VALUES ('6', 'Un valor inventado se rechaza con nombre y apellido',
        (r->>'ok')::BOOLEAN IS NOT TRUE AND r->>'error' LIKE '%Raro%',
        COALESCE(r->>'error', '*** ENTRÓ ***'));

    -- ── 7 · La edición del panel no la pierde ───────────────────────────────
    -- Se prueba la validación, que es lo que usa admin_editar_nocturna.
    INSERT INTO _r
    SELECT '7', 'La validación acepta una restricción al editar',
           public.nocturna_validar_payload(
               v_pago || jsonb_build_object(
                   'adulto',  v_adulto,
                   'jovenes', jsonb_build_array(
                       v_chico || jsonb_build_object('nombre','Celia','dni','98000101','restriccion','celiaco'))),
               v_ed, false, true, v_insc) IS NULL,
           'sin error, como corresponde';

    -- ── 8 · El candado de la base ───────────────────────────────────────────
    BEGIN
        UPDATE public.nocturna_jovenes SET restriccion = 'sin_gluten' WHERE dni = '98000101';
        INSERT INTO _r VALUES ('8', 'La base no acepta un valor fuera de los tres',
            false, '*** lo aceptó ***');
    EXCEPTION WHEN check_violation THEN
        INSERT INTO _r VALUES ('8', 'La base no acepta un valor fuera de los tres',
            true, 'check_violation, como corresponde');
    END;
END $$;

SELECT n,
       que,
       CASE WHEN paso THEN 'PASA' ELSE 'FALLA' END AS estado,
       detalle
  FROM _r
 ORDER BY n;

ROLLBACK;
