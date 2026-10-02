-- ════════════════════════════════════════════════════════════════════════════
-- NOCTURNA — una persona, una sola vez
-- 2026-10-02
--
-- Hasta hoy la base impedía que un CHICO se inscribiera dos veces en la misma
-- edición, y nada más. El adulto responsable podía repetirse —estaba escrito
-- como decisión, "un padre que se olvidó de un hijo hace una segunda
-- inscripción"— y, como el DNI no sabe de edades, la misma persona podía
-- figurar como adulto en una inscripción y como chico en otra.
--
-- Eso deja entrar a la misma persona dos veces y rompe la cuenta de cuánta
-- gente hay adentro, que es el número que mira la puerta.
--
-- Acá se cierra con los dos candados que ya usa el módulo:
--   · la función de validación, que devuelve un mensaje en español, y
--   · un índice único, que es el que aguanta dos envíos simultáneos.
--
-- CONSECUENCIA A TENER EN CUENTA: si una familia se olvidó de anotar a un
-- hijo, ya no puede hacer una segunda inscripción. Hay que agregar al chico
-- desde el panel, editando la inscripción que ya tiene (admin_editar_nocturna
-- excluye a la propia inscripción de estos chequeos). Es además el dato
-- correcto: una familia, una entrada, un QR.
-- ════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 1 — Aviso antes de romper
-- ════════════════════════════════════════════════════════════════════════════
-- Si ya hubiera un adulto repetido, el índice de abajo falla con un error que
-- no dice a quién hay que mirar. Esto lo dice.

DO $$
DECLARE
    v_lista TEXT;
BEGIN
    SELECT string_agg(format('%s (edición %s, %s veces)', dni, edicion, n), '; ')
      INTO v_lista
      FROM (
        SELECT btrim(adulto_dni) AS dni, edicion, count(*) AS n
          FROM public.nocturna_inscripciones
         GROUP BY 1, 2
        HAVING count(*) > 1
      ) d;

    IF v_lista IS NOT NULL THEN
        RAISE EXCEPTION
            'Hay adultos responsables repetidos y el índice único no se puede crear: %. Unificá esas inscripciones primero.',
            v_lista;
    END IF;
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 2 — El índice único del adulto
-- ════════════════════════════════════════════════════════════════════════════
-- El gemelo del que ya existe para los chicos. La validación de abajo alcanza
-- para el 100% de los casos normales; esto es para el que no lo es: dos
-- envíos a la vez con el mismo DNI, que pasan los dos la validación porque
-- todavía ninguno insertó. nocturna_alta ya atrapa unique_violation y
-- responde "Alguno de los DNI ya quedó inscripto recién".
--
-- btrim() porque el DNI entra como texto de un formulario: " 30111222" y
-- "30111222" son la misma persona, y la validación compara con btrim.

CREATE UNIQUE INDEX IF NOT EXISTS idx_nocturna_insc_adulto_dni_edicion
    ON public.nocturna_inscripciones(edicion, btrim(adulto_dni));

COMMENT ON INDEX public.idx_nocturna_insc_adulto_dni_edicion IS
    'Un adulto responsable, una inscripción por edición. Para agregarle un chico a una familia ya anotada, se edita su inscripción.';


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 3 — La validación, con las cuatro puertas cerradas
-- ════════════════════════════════════════════════════════════════════════════
-- Reemplaza la de sql/nocturna_edicion.sql. Es la misma, con un bloque nuevo
-- al final: lo anterior no se tocó.
--
-- Las cuatro formas de entrar dos veces, y todas se prueban en
-- sql/PROBAR_nocturna_duplicados.sql:
--   1. el mismo adulto se anota de nuevo,
--   2. un adulto usa el DNI de un chico ya inscripto,
--   3. un chico usa el DNI de un adulto ya inscripto,
--   4. el adulto se carga a sí mismo como chico, en el mismo formulario.
--
-- La quinta —el mismo chico dos veces— ya estaba cerrada.

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
    v_adulto      JSONB;
    v_jovenes     JSONB;
    v_j           JSONB;
    v_nac         DATE;
    v_edad        INTEGER;
    v_n           INTEGER;
    v_dnis        TEXT[] := ARRAY[]::TEXT[];
    v_dup         TEXT;
    v_tribu       TEXT;
    v_retiro      TEXT;
    v_dni_adulto  TEXT;
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
        RETURN 'Agregá al menos un chico a la inscripción.';
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

    -- ── Chicos: validar TODO antes de insertar nada ─────────────────────────
    FOR v_j IN SELECT * FROM jsonb_array_elements(v_jovenes)
    LOOP
        IF btrim(COALESCE(v_j->>'nombre',''))   = ''
        OR btrim(COALESCE(v_j->>'apellido','')) = ''
        OR btrim(COALESCE(v_j->>'dni',''))      = ''
        OR COALESCE(v_j->>'fechaNacimiento','') = '' THEN
            RETURN 'Completá nombre, apellido, DNI y fecha de nacimiento de cada chico.';
        END IF;

        BEGIN
            PERFORM (v_j->>'fechaNacimiento')::DATE;
        EXCEPTION WHEN others THEN
            RETURN format('La fecha de nacimiento de %s no es válida.', btrim(v_j->>'nombre'));
        END;

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

    -- ── Una persona, una vez ────────────────────────────────────────────────
    -- Arriba se controló que no se repita un CHICO. Falta la otra mitad: el
    -- adulto responsable también entra al evento, y el DNI no distingue entre
    -- "adulto" y "chico" — es la misma persona en las dos listas.
    v_dni_adulto := btrim(v_adulto->>'dni');

    -- 4 · El adulto cargado también como chico, en este mismo formulario.
    IF v_dni_adulto = ANY (v_dnis) THEN
        RETURN format(
            'El DNI %s está cargado como adulto responsable y como chico en la misma inscripción.',
            v_dni_adulto);
    END IF;

    -- 1 · El adulto ya tiene una inscripción.
    PERFORM 1
       FROM public.nocturna_inscripciones i
      WHERE i.edicion = p_edicion
        AND btrim(i.adulto_dni) = v_dni_adulto
        AND (p_excluir_inscripcion IS NULL OR i.id IS DISTINCT FROM p_excluir_inscripcion);
    IF FOUND THEN
        RETURN format(
            'Ya hay una inscripción con el DNI %s como adulto responsable. Si falta agregar un chico, se agrega a esa inscripción.',
            v_dni_adulto);
    END IF;

    -- 2 · El adulto ya está anotado, pero como chico.
    PERFORM 1
       FROM public.nocturna_jovenes j
      WHERE j.edicion = p_edicion
        AND btrim(j.dni) = v_dni_adulto
        AND (p_excluir_inscripcion IS NULL OR j.inscripcion_id IS DISTINCT FROM p_excluir_inscripcion);
    IF FOUND THEN
        RETURN format('El DNI %s ya está inscripto como chico.', v_dni_adulto);
    END IF;

    -- 3 · Un chico que ya está anotado como adulto responsable.
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
$$;

REVOKE EXECUTE ON FUNCTION public.nocturna_validar_payload(JSONB, INTEGER, BOOLEAN, BOOLEAN, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.nocturna_validar_payload(JSONB, INTEGER, BOOLEAN, BOOLEAN, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.nocturna_validar_payload(JSONB, INTEGER, BOOLEAN, BOOLEAN, UUID) FROM authenticated;
