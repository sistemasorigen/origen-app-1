-- ════════════════════════════════════════════════════════════════════════════
-- NOCTURNA — edición de una inscripción
-- 2026-10-02
--
-- Tres cosas:
--   1. Las referencias al staff pasan a ON DELETE SET NULL, para poder dar de
--      baja a alguien que cargó inscripciones.
--   2. La validación de `nocturna_alta` se factoriza y la reusa la edición.
--      Copiarla sería garantizar que dentro de un mes el alta y la edición
--      acepten cosas distintas.
--   3. El total se recalcula con el precio ORIGINAL de la inscripción.
-- ════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 1A — Que se pueda dar de baja a alguien del staff
-- ════════════════════════════════════════════════════════════════════════════
-- `cargado_por_admin` y `updated_by` son "quién hizo esto". Si esa persona se
-- va de la iglesia, la inscripción tiene que sobrevivir: lo único que se
-- pierde es el nombre. Con NO ACTION, borrar al usuario fallaba con un error
-- de clave foránea y había que ir a buscar a mano qué lo estaba reteniendo.
--
-- La app ya está preparada: `nombresDeUsuarios` no encuentra el id y la
-- planilla dice "un administrador".

ALTER TABLE public.nocturna_inscripciones
    DROP CONSTRAINT IF EXISTS nocturna_inscripciones_cargado_por_admin_fkey;
ALTER TABLE public.nocturna_inscripciones
    ADD  CONSTRAINT nocturna_inscripciones_cargado_por_admin_fkey
    FOREIGN KEY (cargado_por_admin) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.nocturna_config
    DROP CONSTRAINT IF EXISTS nocturna_config_updated_by_fkey;
ALTER TABLE public.nocturna_config
    ADD  CONSTRAINT nocturna_config_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 1B — La validación, en un solo lugar
-- ════════════════════════════════════════════════════════════════════════════
-- Devuelve NULL si el payload está bien, o el mensaje de error en español
-- listo para mostrar. Es la misma que ya corría adentro de nocturna_alta:
-- ahora la comparten el alta pública, el alta del panel y la edición.
--
-- `p_excluir_inscripcion` es para la edición: al chequear que un DNI no esté
-- repetido en la edición, los chicos de la propia inscripción no cuentan como
-- conflicto consigo mismos.

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

    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.nocturna_validar_payload(JSONB, INTEGER, BOOLEAN, BOOLEAN, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.nocturna_validar_payload(JSONB, INTEGER, BOOLEAN, BOOLEAN, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.nocturna_validar_payload(JSONB, INTEGER, BOOLEAN, BOOLEAN, UUID) FROM authenticated;


-- ── nocturna_alta, ahora usando la validación compartida ────────────────────
-- Mismo comportamiento que antes: lo único que cambia es de dónde salen los
-- mensajes. Se reemplaza entera para que no queden dos copias de las reglas.

CREATE OR REPLACE FUNCTION public.nocturna_alta(
    p_payload            JSONB,
    p_exigir_comprobante BOOLEAN,
    p_admin              UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cfg         public.nocturna_config%ROWTYPE;
    v_adulto      JSONB;
    v_jovenes     JSONB;
    v_j           JSONB;
    v_nac         DATE;
    v_n           INTEGER;
    v_codigo      TEXT;
    v_insc_id     UUID;
    v_comprobante TEXT;
    v_error       TEXT;
BEGIN
    SELECT * INTO v_cfg FROM public.nocturna_config WHERE id = 1;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'La configuración del evento no está cargada.');
    END IF;

    IF NOT v_cfg.inscripciones_abiertas AND p_admin IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Las inscripciones están cerradas.');
    END IF;

    v_error := public.nocturna_validar_payload(
        p_payload, v_cfg.edicion, p_exigir_comprobante, true, NULL);
    IF v_error IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', v_error);
    END IF;

    v_adulto      := p_payload -> 'adulto';
    v_jovenes     := p_payload -> 'jovenes';
    v_nac         := (v_adulto->>'fechaNacimiento')::DATE;
    v_n           := jsonb_array_length(v_jovenes);
    v_comprobante := NULLIF(btrim(COALESCE(p_payload->>'comprobantePath','')), '');
    v_codigo      := public.nocturna_generar_codigo();

    BEGIN
        INSERT INTO public.nocturna_inscripciones (
            edicion, codigo_entrada, user_id,
            adulto_nombre, adulto_apellido, adulto_dni, adulto_email, adulto_fecha_nacimiento,
            autoriza_asistencia, acepta_fotos,
            declaraciones_version, declaraciones_aceptadas_at,
            precio_unitario, total,
            comprobante_path, cargado_por_admin
        ) VALUES (
            -- user_id es la cuenta de quien se inscribe, no la del admin que
            -- carga: en el alta del panel queda NULL aunque haya sesión.
            v_cfg.edicion, v_codigo, CASE WHEN p_admin IS NULL THEN auth.uid() ELSE NULL END,
            btrim(v_adulto->>'nombre'), btrim(v_adulto->>'apellido'),
            btrim(v_adulto->>'dni'), btrim(v_adulto->>'email'), v_nac,
            true, (p_payload->'aceptaFotos')::BOOLEAN,
            btrim(p_payload->>'declaracionesVersion'), now(),
            v_cfg.precio_entrada, v_cfg.precio_entrada * v_n,
            v_comprobante, p_admin
        )
        RETURNING id INTO v_insc_id;

        FOR v_j IN SELECT * FROM jsonb_array_elements(v_jovenes)
        LOOP
            INSERT INTO public.nocturna_jovenes (
                inscripcion_id, edicion, nombre, apellido, dni, fecha_nacimiento, tribu,
                retiro_tipo, retiro_nombre, retiro_apellido, retiro_dni, retiro_telefono
            ) VALUES (
                v_insc_id, v_cfg.edicion,
                btrim(v_j->>'nombre'), btrim(v_j->>'apellido'), btrim(v_j->>'dni'),
                (v_j->>'fechaNacimiento')::DATE,
                COALESCE(v_j->>'tribu','Sin tribu'),
                v_j->>'retiroTipo',
                NULLIF(btrim(COALESCE(v_j->>'retiroNombre','')),''),
                NULLIF(btrim(COALESCE(v_j->>'retiroApellido','')),''),
                NULLIF(btrim(COALESCE(v_j->>'retiroDni','')),''),
                NULLIF(btrim(COALESCE(v_j->>'retiroTelefono','')),'')
            );
        END LOOP;
    EXCEPTION
        WHEN unique_violation THEN
            -- Carrera: dos envíos simultáneos con el mismo DNI que pasaron la
            -- validación de arriba. Postgres revierte los dos INSERT.
            RETURN jsonb_build_object('ok', false, 'error',
                'Alguno de los DNI ya quedó inscripto recién. Revisá los datos.');
    END;

    RETURN jsonb_build_object(
        'ok', true,
        'inscripcion_id', v_insc_id,
        'codigo_entrada', v_codigo,
        'total', v_cfg.precio_entrada * v_n
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.nocturna_alta(JSONB, BOOLEAN, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.nocturna_alta(JSONB, BOOLEAN, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.nocturna_alta(JSONB, BOOLEAN, UUID) FROM authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- admin_editar_nocturna — sólo staff
-- ════════════════════════════════════════════════════════════════════════════
-- El payload es el mismo del alta, con un `id` opcional por chico: con id es
-- uno que ya existe y se actualiza en el lugar; sin id, uno nuevo.
--
-- Lo que NO se puede editar:
--   · La autorización de asistencia. Es una declaración legal: o está, o la
--     inscripción no debería existir. Darle al staff un interruptor para
--     ponerla en false sería dejar en la base menores sin autorización.
--   · `declaraciones_version` y su fecha. Son la constancia de QUÉ texto se
--     firmó y cuándo; reescribirlas al corregir un apellido borraría eso.
--   · El precio unitario. El total se recalcula con el que pagó esta familia,
--     no con el precio de hoy.

CREATE OR REPLACE FUNCTION public.admin_editar_nocturna(
    p_inscripcion_id UUID,
    p_payload        JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_i          public.nocturna_inscripciones%ROWTYPE;
    v_adulto     JSONB;
    v_jovenes    JSONB;
    v_j          JSONB;
    v_error      TEXT;
    v_n          INTEGER;
    v_ids        UUID[] := ARRAY[]::UUID[];
    v_ajenos     INTEGER;
    v_acreditado TEXT;
    v_total_viejo NUMERIC(12,2);
    v_total_nuevo NUMERIC(12,2);
    v_id         UUID;
BEGIN
    IF NOT public.is_nocturna_staff() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No tenés permisos para editar inscripciones.');
    END IF;

    SELECT * INTO v_i FROM public.nocturna_inscripciones WHERE id = p_inscripcion_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Esta inscripción no existe o fue eliminada.');
    END IF;

    v_adulto  := p_payload -> 'adulto';
    v_jovenes := COALESCE(p_payload -> 'jovenes', '[]'::jsonb);

    -- La autorización no se edita: se fuerza en true para que la validación
    -- compartida no la rechace por venir ausente desde el formulario.
    v_error := public.nocturna_validar_payload(
        jsonb_set(p_payload, '{autorizaAsistencia}', 'true'::jsonb),
        v_i.edicion,
        false,                 -- el comprobante no se edita desde acá
        false,                 -- la versión de las declaraciones no cambia
        p_inscripcion_id       -- los chicos propios no chocan consigo mismos
    );
    IF v_error IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', v_error);
    END IF;

    -- ── Los ids que vienen en el payload ────────────────────────────────────
    FOR v_j IN SELECT * FROM jsonb_array_elements(v_jovenes)
    LOOP
        IF NULLIF(btrim(COALESCE(v_j->>'id','')), '') IS NOT NULL THEN
            BEGIN
                v_ids := v_ids || (v_j->>'id')::UUID;
            EXCEPTION WHEN others THEN
                RETURN jsonb_build_object('ok', false, 'error', 'Uno de los adolescentes tiene un identificador inválido.');
            END;
        END IF;
    END LOOP;

    -- Ningún id de otra inscripción: si no, se podrían robar chicos de otra
    -- familia pasando su id a mano.
    SELECT count(*) INTO v_ajenos
    FROM unnest(v_ids) AS u
    WHERE NOT EXISTS (
        SELECT 1 FROM public.nocturna_jovenes j
        WHERE j.id = u AND j.inscripcion_id = p_inscripcion_id
    );
    IF v_ajenos > 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Alguno de los adolescentes no pertenece a esta inscripción.');
    END IF;

    -- ── No se puede quitar a alguien que ya entró ───────────────────────────
    -- Si se fue del sistema, su acreditación desaparece y los números de la
    -- noche dejan de cerrar.
    SELECT string_agg(j.nombre, ', ' ORDER BY j.nombre) INTO v_acreditado
    FROM public.nocturna_jovenes j
    WHERE j.inscripcion_id = p_inscripcion_id
      AND j.acreditado_at IS NOT NULL
      AND NOT (j.id = ANY (v_ids));
    IF v_acreditado IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'error',
            format('No se puede quitar a %s: ya está acreditado. Primero desmarcá su ingreso.', v_acreditado));
    END IF;

    v_n := jsonb_array_length(v_jovenes);
    v_total_viejo := v_i.total;
    -- Con el precio que pagó ESTA familia, no con el de hoy.
    v_total_nuevo := v_i.precio_unitario * v_n;

    BEGIN
        UPDATE public.nocturna_inscripciones SET
            adulto_nombre           = btrim(v_adulto->>'nombre'),
            adulto_apellido         = btrim(v_adulto->>'apellido'),
            adulto_dni              = btrim(v_adulto->>'dni'),
            adulto_email            = btrim(v_adulto->>'email'),
            adulto_fecha_nacimiento = (v_adulto->>'fechaNacimiento')::DATE,
            acepta_fotos            = (p_payload->'aceptaFotos')::BOOLEAN,
            total                   = v_total_nuevo
        WHERE id = p_inscripcion_id;

        -- Primero se van los que ya no están: así un DNI que se mueve de un
        -- chico a otro no choca con el índice único mientras tanto.
        DELETE FROM public.nocturna_jovenes
        WHERE inscripcion_id = p_inscripcion_id
          AND NOT (id = ANY (v_ids));

        FOR v_j IN SELECT * FROM jsonb_array_elements(v_jovenes)
        LOOP
            v_id := NULLIF(btrim(COALESCE(v_j->>'id','')), '')::UUID;

            IF v_id IS NOT NULL THEN
                -- En el lugar: conserva su id y su acreditado_at. Borrar y
                -- volver a crear le cambiaría el id, y el id es lo que el
                -- escáner ya registró como presente.
                UPDATE public.nocturna_jovenes SET
                    nombre           = btrim(v_j->>'nombre'),
                    apellido         = btrim(v_j->>'apellido'),
                    dni              = btrim(v_j->>'dni'),
                    fecha_nacimiento = (v_j->>'fechaNacimiento')::DATE,
                    tribu            = COALESCE(v_j->>'tribu','Sin tribu'),
                    retiro_tipo      = v_j->>'retiroTipo',
                    retiro_nombre    = NULLIF(btrim(COALESCE(v_j->>'retiroNombre','')),''),
                    retiro_apellido  = NULLIF(btrim(COALESCE(v_j->>'retiroApellido','')),''),
                    retiro_dni       = NULLIF(btrim(COALESCE(v_j->>'retiroDni','')),''),
                    retiro_telefono  = NULLIF(btrim(COALESCE(v_j->>'retiroTelefono','')),'')
                WHERE id = v_id AND inscripcion_id = p_inscripcion_id;
            ELSE
                INSERT INTO public.nocturna_jovenes (
                    inscripcion_id, edicion, nombre, apellido, dni, fecha_nacimiento, tribu,
                    retiro_tipo, retiro_nombre, retiro_apellido, retiro_dni, retiro_telefono
                ) VALUES (
                    p_inscripcion_id, v_i.edicion,
                    btrim(v_j->>'nombre'), btrim(v_j->>'apellido'), btrim(v_j->>'dni'),
                    (v_j->>'fechaNacimiento')::DATE,
                    COALESCE(v_j->>'tribu','Sin tribu'),
                    v_j->>'retiroTipo',
                    NULLIF(btrim(COALESCE(v_j->>'retiroNombre','')),''),
                    NULLIF(btrim(COALESCE(v_j->>'retiroApellido','')),''),
                    NULLIF(btrim(COALESCE(v_j->>'retiroDni','')),''),
                    NULLIF(btrim(COALESCE(v_j->>'retiroTelefono','')),'')
                );
            END IF;
        END LOOP;
    EXCEPTION
        WHEN unique_violation THEN
            RETURN jsonb_build_object('ok', false, 'error',
                'Alguno de los DNI ya está usado en otra inscripción de esta edición.');
    END;

    -- aprobado_at se recalcula: si se agregó un chico la familia sigue
    -- aprobada, pero si el único acreditado era el que se fue, ya no.
    UPDATE public.nocturna_inscripciones i
    SET aprobado_at = CASE
            WHEN i.adulto_acreditado_at IS NOT NULL
             AND EXISTS (SELECT 1 FROM public.nocturna_jovenes j
                         WHERE j.inscripcion_id = i.id AND j.acreditado_at IS NOT NULL)
            THEN COALESCE(i.aprobado_at, now())
            ELSE NULL
        END
    WHERE i.id = p_inscripcion_id;

    RETURN jsonb_build_object(
        'ok', true,
        'total', v_total_nuevo,
        'total_anterior', v_total_viejo,
        -- Positiva: hay que cobrar. Negativa: hay que devolver.
        'diferencia', v_total_nuevo - v_total_viejo,
        'precio_unitario', v_i.precio_unitario,
        'chicos', v_n
    );
END;
$$;

-- CREATE OR REPLACE vuelve a otorgarle permiso a PUBLIC: hay que revocarlo de
-- nuevo cada vez, y de anon aparte.
REVOKE EXECUTE ON FUNCTION public.admin_editar_nocturna(UUID, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_editar_nocturna(UUID, JSONB) FROM anon;
GRANT  EXECUTE ON FUNCTION public.admin_editar_nocturna(UUID, JSONB) TO authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 1C — Cerrar las inscripciones
-- ════════════════════════════════════════════════════════════════════════════
-- Se dejan CERRADAS. Los datos de pago de la pantalla pública todavía son de
-- ejemplo: con la ruta abierta, una familia podría transferir a una cuenta que
-- no existe. Abrirlas tiene que ser un acto deliberado desde el panel.
UPDATE public.nocturna_config SET inscripciones_abiertas = false, updated_at = now() WHERE id = 1;

NOTIFY pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════════════════════
-- Verificación
-- ════════════════════════════════════════════════════════════════════════════
-- SELECT conname, confdeltype FROM pg_constraint
--  WHERE conname IN ('nocturna_inscripciones_cargado_por_admin_fkey',
--                    'nocturna_config_updated_by_fkey');   -- esperado: n
--
-- SELECT proname, prosecdef, proconfig, proacl FROM pg_proc
--  WHERE proname IN ('nocturna_validar_payload','admin_editar_nocturna','nocturna_alta');
--
-- SELECT inscripciones_abiertas FROM public.nocturna_config WHERE id = 1;  -- false
