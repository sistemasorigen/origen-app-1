-- ══════════════════════════════════════════════════════════════════════════════
-- NOCTURNA — el evento es para 13 a 18 años, inclusive
-- 2026-10-02
--
-- Comunicado oficial: Nocturna es EXCLUSIVAMENTE para jóvenes de 13 a 18.
--
-- El límite se mide contra el DÍA DEL EVENTO y no contra el día en que la
-- familia se inscribe. Entre que abren las inscripciones y el 30 de octubre
-- hay casi un mes, y en ese mes hay chicos que cumplen años: el que cumple 13
-- el 29 entra, y el que cumple 19 el 15 no. Medido contra hoy, los dos casos
-- saldrían al revés de lo que va a pasar en la puerta.
--
-- Va en `nocturna_validar_payload`, que es el único validador que comparten el
-- alta pública, el alta del panel y la edición: las tres quedan cubiertas de
-- una, incluso cuando alguien agrega un chico a una inscripción que ya existía.
--
-- Lo único que cambia respecto de sql/nocturna_edicion.sql son las tres
-- constantes del DECLARE y el bloque de edad adentro del loop de chicos.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.nocturna_validar_payload(
    p_payload              JSONB,
    p_edicion              INTEGER,
    p_exigir_comprobante   BOOLEAN DEFAULT false,
    p_exigir_version       BOOLEAN DEFAULT true,
    p_excluir_inscripcion  UUID    DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    -- El día del evento. La edad de los chicos se mide contra esta fecha y no
    -- contra hoy (ver más abajo). Está también en src/utils/nocturna.ts, que
    -- es la que usa el formulario para avisar antes de enviar: si la fecha se
    -- mueve, se cambia en los dos lados.
    v_fecha_evento CONSTANT DATE := DATE '2026-10-30';
    v_edad_minima  CONSTANT INTEGER := 13;
    v_edad_maxima  CONSTANT INTEGER := 18;

    v_adulto  JSONB;
    v_jovenes JSONB;
    v_j       JSONB;
    v_nac     DATE;
    v_edad    INTEGER;
    v_n       INTEGER;
    v_dnis    TEXT[] := ARRAY[]::TEXT[];
    v_dup     TEXT;
    v_tribu   TEXT;
    v_retiro  TEXT;
BEGIN
    v_adulto  := p_payload -> 'adulto';
    v_jovenes := COALESCE(p_payload -> 'jovenes', '[]'::jsonb);

    IF v_adulto IS NULL THEN
        RETURN 'Faltan los datos del adulto responsable.';
    END IF;

    IF btrim(COALESCE(v_adulto->>'nombre',''))   = ''
    OR btrim(COALESCE(v_adulto->>'apellido','')) = ''
    OR btrim(COALESCE(v_adulto->>'dni',''))      = ''
    OR btrim(COALESCE(v_adulto->>'email',''))    = ''
    OR COALESCE(v_adulto->>'fechaNacimiento','') = '' THEN
        RETURN 'Completá todos los datos del adulto responsable.';
    END IF;

    BEGIN
        v_nac := (v_adulto->>'fechaNacimiento')::DATE;
    EXCEPTION WHEN others THEN
        RETURN 'La fecha de nacimiento del adulto no es válida.';
    END;

    -- Es EL chequeo que no puede vivir sólo en el navegador: quien firma la
    -- autorización de un menor tiene que ser mayor.
    v_edad := date_part('year', age(current_date, v_nac))::INTEGER;
    IF v_edad < 18 THEN
        RETURN 'El adulto responsable tiene que ser mayor de 18 años.';
    END IF;

    v_n := jsonb_array_length(v_jovenes);
    IF v_n IS NULL OR v_n < 1 THEN
        RETURN 'Agregá al menos un joven a la inscripción.';
    END IF;

    IF COALESCE((p_payload->>'autorizaAsistencia')::BOOLEAN, false) IS NOT TRUE THEN
        RETURN 'Sin la autorización de asistencia no se puede completar la inscripción.';
    END IF;

    -- Se distingue "false" de "no vino" a propósito.
    IF p_payload->'aceptaFotos' IS NULL OR jsonb_typeof(p_payload->'aceptaFotos') <> 'boolean' THEN
        RETURN 'Falta responder sobre el uso de imágenes.';
    END IF;

    IF p_exigir_version AND btrim(COALESCE(p_payload->>'declaracionesVersion','')) = '' THEN
        RETURN 'Falta la versión de las declaraciones.';
    END IF;

    IF p_exigir_comprobante AND NULLIF(btrim(COALESCE(p_payload->>'comprobantePath','')), '') IS NULL THEN
        RETURN 'Subí el comprobante de pago para terminar.';
    END IF;

    FOR v_j IN SELECT * FROM jsonb_array_elements(v_jovenes)
    LOOP
        IF btrim(COALESCE(v_j->>'nombre',''))   = ''
        OR btrim(COALESCE(v_j->>'apellido','')) = ''
        OR btrim(COALESCE(v_j->>'dni',''))      = ''
        OR COALESCE(v_j->>'fechaNacimiento','') = '' THEN
            RETURN 'Completá nombre, apellido, DNI y fecha de nacimiento de cada joven.';
        END IF;

        BEGIN
            v_nac := (v_j->>'fechaNacimiento')::DATE;
        EXCEPTION WHEN others THEN
            RETURN format('La fecha de nacimiento de %s no es válida.', btrim(v_j->>'nombre'));
        END;

        -- Nocturna es para jóvenes de 13 a 18 años, inclusive y sin excepciones.
        --
        -- Se mide contra el DÍA DEL EVENTO, no contra hoy: quien cumple 13 la
        -- semana anterior entra, y quien cumple 19 antes del viernes queda
        -- afuera. Es exactamente la edad que va a tener esa noche, que es la
        -- que mira quien está en la puerta.
        v_edad := date_part('year', age(v_fecha_evento, v_nac))::INTEGER;
        IF v_edad < v_edad_minima OR v_edad > v_edad_maxima THEN
            RETURN format(
                'Nocturna es para jóvenes de %s a %s años. %s va a tener %s el día del evento.',
                v_edad_minima, v_edad_maxima, btrim(v_j->>'nombre'), v_edad);
        END IF;

        v_tribu := COALESCE(v_j->>'tribu', 'Sin tribu');
        IF v_tribu NOT IN ('Trueno','Garra','Sin tribu') THEN
            RETURN format('La tribu de %s no es válida.', btrim(v_j->>'nombre'));
        END IF;

        v_retiro := COALESCE(v_j->>'retiroTipo', '');
        IF v_retiro NOT IN ('solo','adulto','otra_persona') THEN
            RETURN format('Falta indicar cómo se retira %s.', btrim(v_j->>'nombre'));
        END IF;

        IF v_retiro = 'otra_persona' AND (
               btrim(COALESCE(v_j->>'retiroNombre',''))   = ''
            OR btrim(COALESCE(v_j->>'retiroApellido','')) = ''
            OR btrim(COALESCE(v_j->>'retiroDni',''))      = ''
            OR btrim(COALESCE(v_j->>'retiroTelefono','')) = ''
        ) THEN
            RETURN format('Faltan los datos de quien retira a %s.', btrim(v_j->>'nombre'));
        END IF;

        v_dnis := v_dnis || btrim(v_j->>'dni');
    END LOOP;

    SELECT d INTO v_dup FROM unnest(v_dnis) AS d GROUP BY d HAVING count(*) > 1 LIMIT 1;
    IF v_dup IS NOT NULL THEN
        RETURN format('El DNI %s está cargado dos veces en esta inscripción.', v_dup);
    END IF;

    SELECT btrim(j.dni) INTO v_dup
    FROM public.nocturna_jovenes j
    WHERE j.edicion = p_edicion
      AND btrim(j.dni) = ANY (v_dnis)
      AND (p_excluir_inscripcion IS NULL OR j.inscripcion_id IS DISTINCT FROM p_excluir_inscripcion)
    LIMIT 1;
    IF v_dup IS NOT NULL THEN
        RETURN format('Ya hay una inscripción con el DNI %s.', v_dup);
    END IF;

    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.nocturna_validar_payload(JSONB, INTEGER, BOOLEAN, BOOLEAN, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.nocturna_validar_payload(JSONB, INTEGER, BOOLEAN, BOOLEAN, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.nocturna_validar_payload(JSONB, INTEGER, BOOLEAN, BOOLEAN, UUID) FROM authenticated;

NOTIFY pgrst, 'reload schema';


-- ══════════════════════════════════════════════════════════════════════════════
-- Verificación
-- ══════════════════════════════════════════════════════════════════════════════
-- Un chico de 12 y uno de 19 al 30/10 tienen que volver con el mensaje nuevo,
-- y uno de 13 tiene que pasar:
--
-- SELECT public.nocturna_validar_payload(
--   jsonb_build_object(
--     'adulto', jsonb_build_object('nombre','A','apellido','B','dni','1','email','a@b.c','fechaNacimiento','1985-01-01'),
--     'jovenes', jsonb_build_array(jsonb_build_object(
--        'nombre','Test','apellido','T','dni','99999999','fechaNacimiento','2014-11-01',
--        'tribu','Garra','retiroTipo','adulto')),
--     'autorizaAsistencia', true, 'aceptaFotos', true, 'declaracionesVersion','x'),
--   2026);
