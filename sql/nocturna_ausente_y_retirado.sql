-- ════════════════════════════════════════════════════════════════════════════
-- NOCTURNA — dos estados nuevos: "ausente" y "retirado"
-- 2026-10-08
--
-- QUÉ SE AGREGA
--
--   · ausente_at   — el adolescente no vino. Se marca en la puerta, tocando
--                    dos veces su nombre. Sirve para que la familia pueda
--                    retirarse aunque alguien no haya llegado: sin esto, el
--                    escáner esperaría para siempre a alguien que no está.
--   · retirado_at  — se fue del establecimiento. Sólo puede retirarse quien
--                    entró. Es el dato del reporte del evento.
--
-- Son dos columnas nuevas y nulas, así que las 8 inscripciones que ya
-- existen quedan igual: nadie está ausente ni retirado hasta que alguien lo
-- marque. El QR no se toca —lleva el id de la inscripción, como siempre—, y
-- por eso las entradas ya emitidas siguen sirviendo para las tres cosas:
-- entrar, faltar y salir.
--
-- LOS TRES ESTADOS DE UN ADOLESCENTE, Y POR QUÉ SON EXCLUYENTES
--
--   pendiente  acreditado_at NULL, ausente_at NULL
--   acreditado acreditado_at puesto
--   ausente    ausente_at puesto          (no puede estar acreditado)
--   retirado   acreditado_at Y retirado_at puestos
--
-- Las dos restricciones de abajo son las que impiden los estados que no
-- existen en la realidad: alguien que está adentro y ausente a la vez, o
-- alguien que se retiró de un lugar al que nunca entró.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.nocturna_jovenes
    ADD COLUMN IF NOT EXISTS ausente_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS retirado_at TIMESTAMPTZ;

COMMENT ON COLUMN public.nocturna_jovenes.ausente_at IS
    'Cuándo se marcó que no vino. Excluyente con acreditado_at.';
COMMENT ON COLUMN public.nocturna_jovenes.retirado_at IS
    'Cuándo se fue del establecimiento. Sólo si entró (acreditado_at).';

ALTER TABLE public.nocturna_jovenes
    DROP CONSTRAINT IF EXISTS nocturna_jovenes_ausente_o_acreditado;
ALTER TABLE public.nocturna_jovenes
    ADD CONSTRAINT nocturna_jovenes_ausente_o_acreditado
    CHECK (ausente_at IS NULL OR acreditado_at IS NULL);

ALTER TABLE public.nocturna_jovenes
    DROP CONSTRAINT IF EXISTS nocturna_jovenes_retirado_entro;
ALTER TABLE public.nocturna_jovenes
    ADD CONSTRAINT nocturna_jovenes_retirado_entro
    CHECK (retirado_at IS NULL OR acreditado_at IS NOT NULL);


-- ── Lo que lee el escáner ───────────────────────────────────────────────────
-- Se agregan los dos estados nuevos a cada adolescente. Nada más cambia: un
-- cliente viejo que no los mire sigue funcionando igual.
CREATE OR REPLACE FUNCTION public.get_nocturna_para_acreditar(p_inscripcion_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_i public.nocturna_inscripciones%ROWTYPE;
    v_jovenes JSONB;
BEGIN
    IF NOT public.is_nocturna_staff() THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso',
            'error', 'No tenés permisos para acreditar.');
    END IF;

    SELECT * INTO v_i FROM public.nocturna_inscripciones WHERE id = p_inscripcion_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe',
            'error', 'Esta entrada no existe o fue eliminada.');
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', j.id,
        'nombre', j.nombre,
        'apellido', j.apellido,
        'dni', j.dni,
        'fecha_nacimiento', j.fecha_nacimiento,
        'edad', date_part('year', age(current_date, j.fecha_nacimiento))::INTEGER,
        'tribu', j.tribu,
        'retiro_tipo', j.retiro_tipo,
        'retiro_nombre', j.retiro_nombre,
        'retiro_apellido', j.retiro_apellido,
        'retiro_dni', j.retiro_dni,
        'retiro_telefono', j.retiro_telefono,
        'acreditado_at', j.acreditado_at,
        'ausente_at', j.ausente_at,
        'retirado_at', j.retirado_at
    ) ORDER BY j.nombre), '[]'::jsonb)
    INTO v_jovenes
    FROM public.nocturna_jovenes j
    WHERE j.inscripcion_id = v_i.id;

    RETURN jsonb_build_object(
        'ok', true,
        'inscripcion', jsonb_build_object(
            'id', v_i.id,
            'codigo_entrada', v_i.codigo_entrada,
            'edicion', v_i.edicion,
            'adulto_nombre', v_i.adulto_nombre,
            'adulto_apellido', v_i.adulto_apellido,
            'adulto_dni', v_i.adulto_dni,
            'adulto_email', v_i.adulto_email,
            'acepta_fotos', v_i.acepta_fotos,
            'adulto_acreditado_at', v_i.adulto_acreditado_at,
            'aprobado_at', v_i.aprobado_at,
            'total', v_i.total
        ),
        'jovenes', v_jovenes
    );
END;
$function$;


-- ── La puerta: acreditar y marcar ausentes ──────────────────────────────────
-- Se agrega `p_ausentes`, con default NULL. En NULL no se toca ninguna
-- ausencia, que es exactamente lo que hace el frontend publicado hoy llamando
-- con seis argumentos: sigue andando igual.
--
-- Acreditar y marcar ausente son excluyentes, así que un id que llega en las
-- dos listas se rechaza en vez de resolverse a favor de una: el staff tiene
-- que ver qué marcó.
DROP FUNCTION IF EXISTS public.set_nocturna_acreditacion(UUID, BOOLEAN, UUID[], TEXT, BOOLEAN, UUID[]);

CREATE OR REPLACE FUNCTION public.set_nocturna_acreditacion(
    p_inscripcion_id UUID,
    p_adulto         BOOLEAN,
    p_jovenes        UUID[],
    p_modo           TEXT    DEFAULT 'exacto',
    p_visto_adulto   BOOLEAN DEFAULT NULL,
    p_visto_jovenes  UUID[]  DEFAULT NULL,
    p_ausentes       UUID[]  DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_i              public.nocturna_inscripciones%ROWTYPE;
    v_lista          UUID[] := COALESCE(p_jovenes, ARRAY[]::UUID[]);
    v_aus            UUID[] := COALESCE(p_ausentes, ARRAY[]::UUID[]);
    v_ajenos         INTEGER;
    v_choque         INTEGER;
    v_adulto_ahora   BOOLEAN;
    v_chicos_ahora   UUID[];
    v_chicos_vistos  UUID[];
    v_adulto_final   BOOLEAN;
    v_chicos_final   UUID[];
    v_aus_final      UUID[];
    v_marcados       INTEGER;
BEGIN
    IF NOT public.is_nocturna_staff() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No tenés permisos para acreditar.');
    END IF;

    IF COALESCE(p_modo, 'exacto') NOT IN ('exacto', 'sumar') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Modo de acreditación desconocido.');
    END IF;

    SELECT * INTO v_i FROM public.nocturna_inscripciones WHERE id = p_inscripcion_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Esta entrada no existe o fue eliminada.');
    END IF;

    -- Ningún id ajeno a esta inscripción, ni entre los que entran ni entre
    -- los ausentes.
    SELECT count(*) INTO v_ajenos
    FROM unnest(v_lista || v_aus) AS u
    WHERE NOT EXISTS (
        SELECT 1 FROM public.nocturna_jovenes j
        WHERE j.id = u AND j.inscripcion_id = p_inscripcion_id
    );
    IF v_ajenos > 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Alguno de los adolescentes no pertenece a esta entrada.');
    END IF;

    SELECT count(*) INTO v_choque
    FROM unnest(v_lista) AS u WHERE u = ANY (v_aus);
    IF v_choque > 0 THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'Un adolescente no puede estar adentro y ausente a la vez.');
    END IF;

    -- Nadie que ya se retiró vuelve a tocarse desde la puerta: deshacer una
    -- salida es otra cosa y va en la ficha.
    IF EXISTS (
        SELECT 1 FROM public.nocturna_jovenes j
        WHERE j.inscripcion_id = p_inscripcion_id
          AND j.retirado_at IS NOT NULL
          AND j.id = ANY (v_aus)
    ) THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'No se puede marcar como ausente a alguien que ya se retiró.');
    END IF;

    -- ── El estado que hay ahora ─────────────────────────────────────────────
    v_adulto_ahora := v_i.adulto_acreditado_at IS NOT NULL;
    v_chicos_ahora := ARRAY(
        SELECT j.id FROM public.nocturna_jovenes j
        WHERE j.inscripcion_id = p_inscripcion_id AND j.acreditado_at IS NOT NULL
        ORDER BY j.id
    );

    -- ── ¿Cambió desde que el cliente miró? ──────────────────────────────────
    IF p_modo = 'exacto' AND p_visto_adulto IS NOT NULL THEN
        v_chicos_vistos := ARRAY(
            SELECT DISTINCT u FROM unnest(COALESCE(p_visto_jovenes, ARRAY[]::UUID[])) AS u ORDER BY u
        );

        IF v_adulto_ahora <> p_visto_adulto OR v_chicos_ahora <> v_chicos_vistos THEN
            RETURN jsonb_build_object(
                'ok', false,
                'motivo', 'cambio',
                'error', 'Alguien registró el ingreso de esta familia mientras tenías la ficha abierta. Mirá cómo quedó antes de guardar.',
                'estado', public.get_nocturna_para_acreditar(p_inscripcion_id)
            );
        END IF;
    END IF;

    -- ── El estado que va a quedar ───────────────────────────────────────────
    IF p_modo = 'sumar' THEN
        v_adulto_final := (p_adulto IS TRUE) OR v_adulto_ahora;
        v_chicos_final := ARRAY(
            SELECT DISTINCT u FROM unnest(v_chicos_ahora || v_lista) AS u ORDER BY u
        );
    ELSE
        v_adulto_final := p_adulto IS TRUE;
        v_chicos_final := ARRAY(SELECT DISTINCT u FROM unnest(v_lista) AS u ORDER BY u);
    END IF;

    -- Quien entra deja de estar ausente, siempre: son excluyentes.
    v_aus_final := ARRAY(
        SELECT DISTINCT u FROM unnest(v_aus) AS u
        WHERE NOT (u = ANY (v_chicos_final)) ORDER BY u
    );

    -- Estados válidos: nadie adentro, o al menos un adolescente.
    IF cardinality(v_chicos_final) = 0 AND NOT v_adulto_final THEN
        NULL;
    ELSIF cardinality(v_chicos_final) >= 1 THEN
        NULL;
    ELSE
        RETURN jsonb_build_object('ok', false, 'error',
            'Marcá al menos un adolescente.');
    END IF;

    -- ── Escribir ────────────────────────────────────────────────────────────
    UPDATE public.nocturna_inscripciones
    SET adulto_acreditado_at = CASE
            WHEN v_adulto_final THEN COALESCE(adulto_acreditado_at, now())
            ELSE NULL
        END
    WHERE id = p_inscripcion_id;

    -- Las horas que ya estaban no se pisan.
    --
    -- `ausente_at` sólo se toca cuando el cliente mandó la lista (p_ausentes
    -- no nulo). Si no la mandó, las ausencias quedan como están: así un
    -- frontend viejo, que no sabe que existen, no las borra sin querer.
    UPDATE public.nocturna_jovenes j
    SET acreditado_at = CASE
            WHEN j.id = ANY (v_chicos_final) THEN COALESCE(j.acreditado_at, now())
            ELSE NULL
        END,
        ausente_at = CASE
            WHEN p_ausentes IS NULL THEN
                -- Nadie dijo nada de las ausencias, pero quien entra no puede
                -- quedar marcado ausente.
                CASE WHEN j.id = ANY (v_chicos_final) THEN NULL ELSE j.ausente_at END
            WHEN j.id = ANY (v_aus_final) THEN COALESCE(j.ausente_at, now())
            WHEN p_modo = 'sumar' AND NOT (j.id = ANY (v_chicos_final)) THEN j.ausente_at
            ELSE NULL
        END,
        -- Si alguien deja de estar acreditado, tampoco puede quedar retirado.
        retirado_at = CASE
            WHEN j.id = ANY (v_chicos_final) THEN j.retirado_at
            ELSE NULL
        END
    WHERE j.inscripcion_id = p_inscripcion_id;

    -- aprobado_at: se fija la primera vez que entra algún adolescente, y
    -- vuelve a NULL si se desmarca a todos. El adulto no cuenta.
    SELECT count(*) INTO v_marcados
    FROM public.nocturna_jovenes j
    WHERE j.inscripcion_id = p_inscripcion_id AND j.acreditado_at IS NOT NULL;

    UPDATE public.nocturna_inscripciones
    SET aprobado_at = CASE
            WHEN v_marcados >= 1 THEN COALESCE(aprobado_at, now())
            ELSE NULL
        END
    WHERE id = p_inscripcion_id;

    RETURN public.get_nocturna_para_acreditar(p_inscripcion_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_nocturna_acreditacion(UUID, BOOLEAN, UUID[], TEXT, BOOLEAN, UUID[], UUID[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_nocturna_acreditacion(UUID, BOOLEAN, UUID[], TEXT, BOOLEAN, UUID[], UUID[]) FROM anon;
GRANT  EXECUTE ON FUNCTION public.set_nocturna_acreditacion(UUID, BOOLEAN, UUID[], TEXT, BOOLEAN, UUID[], UUID[]) TO authenticated;


-- ── Las 6 AM: registrar la salida ───────────────────────────────────────────
-- Una función aparte y no un parámetro más de la de arriba: acreditar y
-- retirar son dos momentos distintos de la noche, con dos pantallas
-- distintas, y mezclarlos haría que un error de una pudiera deshacer la otra.
--
-- Sólo suma: en la puerta a las 6 AM nadie "des-retira". Deshacer una salida
-- va en la ficha, que usa la función de arriba.
CREATE OR REPLACE FUNCTION public.set_nocturna_retiro(
    p_inscripcion_id UUID,
    p_jovenes        UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lista   UUID[] := COALESCE(p_jovenes, ARRAY[]::UUID[]);
    v_ajenos  INTEGER;
    v_sinEntrar INTEGER;
BEGIN
    IF NOT public.is_nocturna_staff() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No tenés permisos para registrar la salida.');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.nocturna_inscripciones WHERE id = p_inscripcion_id) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Esta entrada no existe o fue eliminada.');
    END IF;

    IF cardinality(v_lista) = 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Marcá a quién se retira.');
    END IF;

    SELECT count(*) INTO v_ajenos
    FROM unnest(v_lista) AS u
    WHERE NOT EXISTS (
        SELECT 1 FROM public.nocturna_jovenes j
        WHERE j.id = u AND j.inscripcion_id = p_inscripcion_id
    );
    IF v_ajenos > 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Alguno de los adolescentes no pertenece a esta entrada.');
    END IF;

    -- Sólo se retira quien entró. La restricción de la tabla lo impide igual;
    -- esto es para que el mensaje diga qué pasó en vez de reventar.
    SELECT count(*) INTO v_sinEntrar
    FROM public.nocturna_jovenes j
    WHERE j.id = ANY (v_lista) AND j.acreditado_at IS NULL;
    IF v_sinEntrar > 0 THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'No se puede registrar la salida de alguien que no entró.');
    END IF;

    -- La hora de quien ya se había retirado no se pisa: si alguien escanea
    -- dos veces, la salida sigue siendo la primera.
    UPDATE public.nocturna_jovenes j
    SET retirado_at = COALESCE(j.retirado_at, now())
    WHERE j.inscripcion_id = p_inscripcion_id AND j.id = ANY (v_lista);

    RETURN public.get_nocturna_para_acreditar(p_inscripcion_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_nocturna_retiro(UUID, UUID[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_nocturna_retiro(UUID, UUID[]) FROM anon;
GRANT  EXECUTE ON FUNCTION public.set_nocturna_retiro(UUID, UUID[]) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════════════════════
-- Verificación
-- ════════════════════════════════════════════════════════════════════════════
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'nocturna_jovenes' AND column_name IN ('ausente_at','retirado_at');
--
-- SELECT p.oid::regprocedure AS firma FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public' AND p.proname IN
--        ('set_nocturna_acreditacion','set_nocturna_retiro','get_nocturna_para_acreditar');
--
-- set_nocturna_acreditacion tiene que tener UNA sola firma, la de siete.
