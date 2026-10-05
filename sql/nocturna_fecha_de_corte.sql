-- ════════════════════════════════════════════════════════════════════════════
-- NOCTURNA — quién entra: nacidos hasta el 1/6/2014, 18 años como máximo
-- 2026-10-05
--
-- Comunicado oficial: el filtro es la fecha de nacimiento hasta el 1 de junio
-- de 2014 inclusive, con un tope de 18 años. Reemplaza la regla de "13 a 18
-- años" de sql/nocturna_edad.sql. (El primer aviso decía 30 de junio; se
-- corrigió el mismo día.)
--
-- Abajo cambia: ya no es "13 años el día del evento" sino "nacido hasta el
-- 1/6/2014". Entran también los de 12 nacidos hasta esa fecha.
-- Arriba no cambia: 18 años como máximo, medidos el día del evento.
--
-- La regla nueva es más amplia que la anterior: ninguna inscripción que ya
-- existe queda fuera de regla, y editarlas sigue funcionando.
--
-- ⚠ Esta función la tocan varios trabajos (ver la nota de
--   sql/nocturna_sin_duplicados.sql). Lo que sigue es la definición VIVA al
--   2026-10-05, traída con pg_get_functiondef, con sólo dos cambios: las
--   constantes del DECLARE y el bloque de edad adentro del loop. Los chequeos
--   de duplicados y de restricción alimentaria quedan como estaban.
--
-- Después de aplicarla: sql/PROBAR_nocturna_duplicados.sql,
-- sql/PROBAR_nocturna_agregar.sql y sql/PROBAR_nocturna_restricciones.sql.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.nocturna_validar_payload(p_payload jsonb, p_edicion integer, p_exigir_comprobante boolean DEFAULT false, p_exigir_version boolean DEFAULT true, p_excluir_inscripcion uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    -- El día del evento. La edad de los chicos se mide contra esta fecha y no
    -- contra hoy (ver más abajo). Está también en src/utils/nocturna.ts, que
    -- es la que usa el formulario para avisar antes de enviar: si la fecha se
    -- mueve, se cambia en los dos lados.
    v_fecha_evento CONSTANT DATE := DATE '2026-10-30';

    -- Quién entra (comunicado oficial del 2026-10-05): nacidos hasta el 1 de
    -- junio de 2014 inclusive, y con 18 años como máximo el día del evento. La fecha
    -- está también en src/utils/nocturna.ts, igual que la del evento.
    v_nacidos_hasta CONSTANT DATE    := DATE '2014-06-01';
    v_edad_maxima   CONSTANT INTEGER := 18;

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
    v_dni_adulto TEXT;
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
        RETURN 'Agregá al menos un adolescente a la inscripción.';
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
            RETURN 'Completá nombre, apellido, DNI y fecha de nacimiento de cada adolescente.';
        END IF;

        BEGIN
            v_nac := (v_j->>'fechaNacimiento')::DATE;
        EXCEPTION WHEN others THEN
            RETURN format('La fecha de nacimiento de %s no es válida.', btrim(v_j->>'nombre'));
        END;

        -- Las dos puntas de la regla se miden distinto, y a propósito.
        --
        -- La de abajo es una FECHA DE NACIMIENTO, no una edad: entra quien
        -- nació hasta el 1 de junio de 2014 aunque esa noche tenga 12.
        IF v_nac > v_nacidos_hasta THEN
            RETURN format(
                'Nocturna es para adolescentes nacidos hasta el 1 de junio de 2014. %s nació el %s.',
                btrim(v_j->>'nombre'), to_char(v_nac, 'DD/MM/YYYY'));
        END IF;

        -- La de arriba es la EDAD EL DÍA DEL EVENTO, no la de hoy: quien
        -- cumple 19 antes del viernes queda afuera. Es la edad que va a tener
        -- esa noche, que es la que mira quien está en la puerta.
        v_edad := date_part('year', age(v_fecha_evento, v_nac))::INTEGER;
        IF v_edad > v_edad_maxima THEN
            RETURN format(
                'Nocturna es hasta los %s años. %s va a tener %s el día del evento.',
                v_edad_maxima, btrim(v_j->>'nombre'), v_edad);
        END IF;

        v_tribu := COALESCE(v_j->>'tribu', 'Sin tribu');
        IF v_tribu NOT IN ('Trueno','Garra','Sin tribu') THEN
            RETURN format('La tribu de %s no es válida.', btrim(v_j->>'nombre'));
        END IF;

        -- Lo que no puede comer. El formulario manda 'ninguna' cuando no hay
        -- nada que declarar; un payload viejo no manda nada y la columna
        -- pone 'ninguna' sola.
        IF COALESCE(NULLIF(btrim(v_j->>'restriccion'), ''), 'ninguna') NOT IN ('ninguna','diabetes','celiaco') THEN
            RETURN format('La restricción alimentaria de %s no es válida.', btrim(v_j->>'nombre'));
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

    -- ── Una persona, una vez ────────────────────────────────────────────────
    -- Arriba se controló que no se repita un JOVEN. Falta la otra mitad: el
    -- adulto responsable también entra al evento, y el DNI no distingue entre
    -- "adulto" y "adolescente" — es la misma persona en las dos listas.
    v_dni_adulto := btrim(v_adulto->>'dni');

    -- El adulto cargado también como adolescente, en este mismo formulario.
    IF v_dni_adulto = ANY (v_dnis) THEN
        RETURN format(
            'El DNI %s está cargado como adulto responsable y como adolescente en la misma inscripción.',
            v_dni_adulto);
    END IF;

    -- El adulto ya tiene una inscripción.
    PERFORM 1
       FROM public.nocturna_inscripciones i
      WHERE i.edicion = p_edicion
        AND btrim(i.adulto_dni) = v_dni_adulto
        AND (p_excluir_inscripcion IS NULL OR i.id IS DISTINCT FROM p_excluir_inscripcion);
    IF FOUND THEN
        RETURN format(
            'Ya hay una inscripción con el DNI %s como adulto responsable. Si falta agregar un adolescente, se agrega a esa inscripción.',
            v_dni_adulto);
    END IF;

    -- El adulto ya está anotado, pero como adolescente.
    PERFORM 1
       FROM public.nocturna_jovenes j
      WHERE j.edicion = p_edicion
        AND btrim(j.dni) = v_dni_adulto
        AND (p_excluir_inscripcion IS NULL OR j.inscripcion_id IS DISTINCT FROM p_excluir_inscripcion);
    IF FOUND THEN
        RETURN format('El DNI %s ya está inscripto como adolescente.', v_dni_adulto);
    END IF;

    -- Un adolescente que ya está anotado como adulto responsable.
    SELECT btrim(i.adulto_dni) INTO v_dup
      FROM public.nocturna_inscripciones i
     WHERE i.edicion = p_edicion
       AND btrim(i.adulto_dni) = ANY (v_dnis)
       AND (p_excluir_inscripcion IS NULL OR i.id IS DISTINCT FROM p_excluir_inscripcion)
     LIMIT 1;
    IF v_dup IS NOT NULL THEN
        RETURN format('El DNI %s ya está inscripto como adulto responsable.', v_dup);
    END IF;

    RETURN NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.nocturna_validar_payload(JSONB, INTEGER, BOOLEAN, BOOLEAN, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.nocturna_validar_payload(JSONB, INTEGER, BOOLEAN, BOOLEAN, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.nocturna_validar_payload(JSONB, INTEGER, BOOLEAN, BOOLEAN, UUID) FROM authenticated;

NOTIFY pgrst, 'reload schema';
