-- ════════════════════════════════════════════════════════════════════════════
-- NOCTURNA — agregar chicos a una inscripción que ya existe
-- 2026-10-02
--
-- Prueba de sql/nocturna_agregar_jovenes.sql. Correr DESPUÉS de aplicarlo.
--
-- Todo dentro de BEGIN … ROLLBACK: no queda nada. NUNCA hacer COMMIT.
--
-- Lo que se prueba es un trato: a cambio de poder sumar un hermano sin pasar
-- por la mesa de ayuda, el que lo pide tiene que demostrar que es el mismo
-- adulto —DNI y fecha de nacimiento—, y no puede tocar nada de lo que ya
-- está cargado. Las dos mitades se prueban acá.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TEMP TABLE _r (n TEXT, que TEXT, paso BOOLEAN, detalle TEXT) ON COMMIT DROP;

UPDATE public.nocturna_config SET inscripciones_abiertas = true WHERE id = 1;

DO $$
DECLARE
    v_ed      INTEGER;
    v_precio  NUMERIC(12,2);
    r         JSONB;
    v_insc    UUID;
    v_total   NUMERIC(12,2);
    v_aprob   TIMESTAMPTZ;
    v_comp    INTEGER;
    v_chicos  INTEGER;
    v_dnis    TEXT;

    v_pago  CONSTANT JSONB := jsonb_build_object(
        'autorizaAsistencia', true, 'aceptaFotos', true,
        'declaracionesVersion', 'PRUEBA-v1', 'comprobantePath', 'PRUEBA/comprobante.png');
    v_chico CONSTANT JSONB := jsonb_build_object(
        'apellido', 'PRUEBA', 'fechaNacimiento', '2010-05-10',
        'tribu', 'Trueno', 'retiroTipo', 'adulto');
    v_adulto CONSTANT JSONB := jsonb_build_object(
        'nombre', 'Madre', 'apellido', 'PRUEBA', 'dni', '95000001',
        'email', 'prueba@origen.test', 'fechaNacimiento', '1985-03-20');
BEGIN
    SELECT edicion, precio_entrada INTO v_ed, v_precio FROM public.nocturna_config LIMIT 1;

    -- La inscripción original: un chico.
    r := public.register_nocturna(v_pago || jsonb_build_object(
        'adulto',  v_adulto,
        'declaracionesVersion', 'PRUEBA-v1',
        'jovenes', jsonb_build_array(v_chico || jsonb_build_object('nombre','Lucas','dni','95000101'))));
    v_insc := (r->>'inscripcion_id')::UUID;
    INSERT INTO _r VALUES ('0', 'Se creó la inscripción de la que parte todo',
        (r->>'ok')::BOOLEAN IS TRUE, COALESCE(r->>'error', 'ok'));

    -- Aprobada, para después ver que vuelve a quedar pendiente.
    UPDATE public.nocturna_inscripciones SET aprobado_at = now() WHERE id = v_insc;

    -- ── Buscar el grupo familiar ────────────────────────────────────────────
    r := public.nocturna_buscar_grupo('95999999', DATE '1985-03-20');
    INSERT INTO _r VALUES ('1', 'Un DNI que no está inscripto no encuentra nada',
        (r->>'existe')::BOOLEAN IS FALSE, r::TEXT);

    -- El caso que justifica todo el diseño: alguien tipea un DNI ajeno.
    r := public.nocturna_buscar_grupo('95000001', DATE '1990-01-01');
    INSERT INTO _r VALUES ('2', 'Con la fecha equivocada NO muestra a los chicos',
        (r->>'existe')::BOOLEAN IS TRUE
        AND (r->>'verificado')::BOOLEAN IS FALSE
        AND r->'chicos' IS NULL
        AND r->>'inscripcionId' IS NULL,
        r::TEXT);

    r := public.nocturna_buscar_grupo('95000001', DATE '1985-03-20');
    INSERT INTO _r VALUES ('3', 'Con DNI y fecha correctos muestra al grupo',
        (r->>'verificado')::BOOLEAN IS TRUE
        AND jsonb_array_length(r->'chicos') = 1
        AND (r->'chicos'->0->>'nombre') = 'Lucas',
        r::TEXT);

    INSERT INTO _r VALUES ('4', 'El DNI de los chicos va enmascarado',
        (r->'chicos'->0->>'dni') = '••••101',
        'devolvió: ' || COALESCE(r->'chicos'->0->>'dni', '(nada)'));

    -- ── Agregar ─────────────────────────────────────────────────────────────
    -- Con la fecha equivocada: es el mismo portón que la búsqueda.
    r := public.nocturna_agregar_jovenes(jsonb_build_object(
        'adulto', jsonb_build_object('dni','95000001','fechaNacimiento','1990-01-01'),
        'declaracionesVersion', 'PRUEBA-v1',
        'jovenes', jsonb_build_array(v_chico || jsonb_build_object('nombre','Colado','dni','95000199')),
        'comprobantePath', 'PRUEBA/segundo.png'));
    INSERT INTO _r VALUES ('5', 'Con la fecha equivocada no puede agregar',
        (r->>'ok')::BOOLEAN IS NOT TRUE, COALESCE(r->>'error', '*** AGREGÓ ***'));

    -- Un chico que YA está en esta misma inscripción. Es el error honesto:
    -- "no me acuerdo si lo anoté".
    r := public.nocturna_agregar_jovenes(jsonb_build_object(
        'adulto', jsonb_build_object('dni','95000001','fechaNacimiento','1985-03-20'),
        'declaracionesVersion', 'PRUEBA-v1',
        'jovenes', jsonb_build_array(v_chico || jsonb_build_object('nombre','Lucas','dni','95000101')),
        'comprobantePath', 'PRUEBA/segundo.png'));
    INSERT INTO _r VALUES ('6', 'Un chico que ya está en la propia inscripción',
        (r->>'ok')::BOOLEAN IS NOT TRUE, COALESCE(r->>'error', '*** AGREGÓ ***'));

    -- Un chico con el DNI del adulto.
    r := public.nocturna_agregar_jovenes(jsonb_build_object(
        'adulto', jsonb_build_object('dni','95000001','fechaNacimiento','1985-03-20'),
        'declaracionesVersion', 'PRUEBA-v1',
        'jovenes', jsonb_build_array(v_chico || jsonb_build_object('nombre','Ella misma','dni','95000001')),
        'comprobantePath', 'PRUEBA/segundo.png'));
    INSERT INTO _r VALUES ('7', 'Un chico con el DNI de un adulto ya inscripto',
        (r->>'ok')::BOOLEAN IS NOT TRUE, COALESCE(r->>'error', '*** AGREGÓ ***'));

    -- Sin comprobante.
    r := public.nocturna_agregar_jovenes(jsonb_build_object(
        'adulto', jsonb_build_object('dni','95000001','fechaNacimiento','1985-03-20'),
        'declaracionesVersion', 'PRUEBA-v1',
        'jovenes', jsonb_build_array(v_chico || jsonb_build_object('nombre','Sofi','dni','95000102'))));
    INSERT INTO _r VALUES ('8', 'Sin comprobante no agrega',
        (r->>'ok')::BOOLEAN IS NOT TRUE, COALESCE(r->>'error', '*** AGREGÓ ***'));

    -- Sin la constancia de la autorización tampoco: los chicos nuevos no
    -- estaban en lo que firmó al inscribirse.
    r := public.nocturna_agregar_jovenes(jsonb_build_object(
        'adulto', jsonb_build_object('dni','95000001','fechaNacimiento','1985-03-20'),
        'jovenes', jsonb_build_array(v_chico || jsonb_build_object('nombre','Sofi','dni','95000102')),
        'comprobantePath', 'PRUEBA/segundo.png'));
    INSERT INTO _r VALUES ('8b', 'Sin la autorización firmada no agrega',
        (r->>'ok')::BOOLEAN IS NOT TRUE, COALESCE(r->>'error', '*** AGREGÓ ***'));

    -- El caso bueno: dos hermanos.
    r := public.nocturna_agregar_jovenes(jsonb_build_object(
        'adulto', jsonb_build_object('dni','95000001','fechaNacimiento','1985-03-20'),
        'declaracionesVersion', 'PRUEBA-v1',
        'jovenes', jsonb_build_array(
            v_chico || jsonb_build_object('nombre','Sofi','dni','95000102'),
            v_chico || jsonb_build_object('nombre','Benja','dni','95000103')),
        'comprobantePath', 'PRUEBA/segundo.png'));
    INSERT INTO _r VALUES ('9', 'Agrega dos hermanos a la inscripción que ya existe',
        (r->>'ok')::BOOLEAN IS TRUE AND (r->>'agregados')::INTEGER = 2,
        COALESCE(r->>'error', r::TEXT));

    SELECT count(*) INTO v_chicos FROM public.nocturna_jovenes WHERE inscripcion_id = v_insc;
    INSERT INTO _r VALUES ('10', 'La familia quedó con tres chicos en UNA inscripción',
        v_chicos = 3, 'chicos: ' || v_chicos);

    SELECT total, aprobado_at INTO v_total, v_aprob
      FROM public.nocturna_inscripciones WHERE id = v_insc;
    INSERT INTO _r VALUES ('11', 'El total se rehizo con el precio que pagó esta familia',
        v_total = v_precio * 3, format('total %s, esperado %s', v_total, v_precio * 3));

    INSERT INTO _r VALUES ('12', 'La inscripción volvió a quedar pendiente de aprobación',
        v_aprob IS NULL, COALESCE(v_aprob::TEXT, 'NULL'));

    SELECT count(*) INTO v_comp FROM public.nocturna_comprobantes WHERE inscripcion_id = v_insc;
    INSERT INTO _r VALUES ('13', 'El segundo comprobante se guardó aparte del primero',
        v_comp = 1
        AND (SELECT monto FROM public.nocturna_comprobantes WHERE inscripcion_id = v_insc) = v_precio * 2
        AND (SELECT comprobante_path FROM public.nocturna_inscripciones WHERE id = v_insc) = 'PRUEBA/comprobante.png',
        'comprobantes nuevos: ' || v_comp);

    INSERT INTO _r VALUES ('13b', 'Queda la constancia de lo que autorizó al agregar',
        (SELECT declaraciones_version FROM public.nocturna_comprobantes
          WHERE inscripcion_id = v_insc) = 'PRUEBA-v1',
        COALESCE((SELECT declaraciones_version FROM public.nocturna_comprobantes
                   WHERE inscripcion_id = v_insc), '(nada)'));

    -- ── Lo que NO se puede hacer por acá ────────────────────────────────
    -- Agregar NO es editar: los chicos que ya estaban quedan como estaban
    -- aunque el payload mande otros datos con su mismo DNI... y de hecho ni
    -- siquiera se los puede nombrar (prueba 6). Se verifica que nada cambió.
    SELECT string_agg(nombre || ':' || tribu, ', ' ORDER BY nombre) INTO v_dnis
      FROM public.nocturna_jovenes WHERE inscripcion_id = v_insc AND dni = '95000101';
    INSERT INTO _r VALUES ('14', 'El chico original quedó intacto',
        v_dnis = 'Lucas:Trueno', COALESCE(v_dnis, '(no está)'));

    -- Y el adulto sigue sin poder hacer una SEGUNDA inscripción.
    r := public.register_nocturna(v_pago || jsonb_build_object(
        'adulto',  v_adulto,
        'declaracionesVersion', 'PRUEBA-v1',
        'jovenes', jsonb_build_array(v_chico || jsonb_build_object('nombre','Otro','dni','95000104'))));
    INSERT INTO _r VALUES ('15', 'El camino viejo sigue cerrado: no hay segunda inscripción',
        (r->>'ok')::BOOLEAN IS NOT TRUE, COALESCE(r->>'error', '*** ENTRÓ ***'));

    -- ── Con las inscripciones cerradas no se agrega nada ────────────────────
    UPDATE public.nocturna_config SET inscripciones_abiertas = false WHERE id = 1;
    r := public.nocturna_agregar_jovenes(jsonb_build_object(
        'adulto', jsonb_build_object('dni','95000001','fechaNacimiento','1985-03-20'),
        'declaracionesVersion', 'PRUEBA-v1',
        'jovenes', jsonb_build_array(v_chico || jsonb_build_object('nombre','Tarde','dni','95000105')),
        'comprobantePath', 'PRUEBA/tercero.png'));
    INSERT INTO _r VALUES ('16', 'Con las inscripciones cerradas no se puede agregar',
        (r->>'ok')::BOOLEAN IS NOT TRUE, COALESCE(r->>'error', '*** AGREGÓ ***'));
    UPDATE public.nocturna_config SET inscripciones_abiertas = true WHERE id = 1;
END $$;

SELECT n,
       que,
       CASE WHEN paso THEN 'PASA' ELSE 'FALLA' END AS estado,
       detalle
  FROM _r
 ORDER BY length(n), n;

ROLLBACK;
