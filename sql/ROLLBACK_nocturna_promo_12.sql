-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK de sql/nocturna_promo_12.sql
-- 2026-10-25
--
-- Vuelven las funciones como estaban (copiadas de la base) y se apagan la
-- promo y el aumento programado. La columna nocturna_jovenes.precio y las de
-- la config QUEDAN: dicen lo que pagó cada chico. Los totales no se tocan.
-- ════════════════════════════════════════════════════════════════════════════

update public.nocturna_config
   set precio_promo = null, promo_edad = null, promo_hasta = null,
       precio_siguiente = null, precio_siguiente_desde = null
 where id = 1;

drop function if exists public.nocturna_precios();

CREATE OR REPLACE FUNCTION public.update_nocturna_precio(p_precio numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NOT public.is_nocturna_staff() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No tenés permisos para cambiar el precio.');
    END IF;

    IF p_precio IS NULL OR p_precio < 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'El precio no puede ser negativo.');
    END IF;

    UPDATE public.nocturna_config
    SET precio_entrada = p_precio, updated_at = now(), updated_by = auth.uid()
    WHERE id = 1;

    RETURN jsonb_build_object('ok', true, 'precio_entrada', p_precio);
END;
$function$;

CREATE OR REPLACE FUNCTION public.nocturna_alta(p_payload jsonb, p_exigir_comprobante boolean, p_admin uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    -- El celular del adulto responsable es obligatorio desde el 2026-10-19.
    -- Se exige acá y no en nocturna_validar_payload porque esa función valida
    -- tambien el alta de adolescentes sobre una inscripcion que ya existe, y
    -- las anteriores a esa fecha no tienen telefono: exigirlo ahi dejaria a
    -- esas familias sin poder sumar a nadie.
    IF NULLIF(btrim(COALESCE(p_payload->'adulto'->>'telefono','')), '') IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'Falta el celular del adulto responsable.');
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
            adulto_nombre, adulto_apellido, adulto_dni, adulto_email, adulto_telefono,
            adulto_fecha_nacimiento,
            autoriza_asistencia, acepta_fotos,
            declaraciones_version, declaraciones_aceptadas_at,
            precio_unitario, total,
            comprobante_path, cargado_por_admin
        ) VALUES (
            -- user_id es la cuenta de quien se inscribe, no la del admin que
            -- carga: en el alta del panel queda NULL aunque haya sesión.
            v_cfg.edicion, v_codigo, CASE WHEN p_admin IS NULL THEN auth.uid() ELSE NULL END,
            btrim(v_adulto->>'nombre'), btrim(v_adulto->>'apellido'),
            btrim(v_adulto->>'dni'), btrim(v_adulto->>'email'),
            btrim(v_adulto->>'telefono'), v_nac,
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
                telefono, sin_celular_at,
                retiro_tipo, retiro_nombre, retiro_apellido, retiro_dni, retiro_telefono,
                restriccion
            ) VALUES (
                v_insc_id, v_cfg.edicion,
                btrim(v_j->>'nombre'), btrim(v_j->>'apellido'), btrim(v_j->>'dni'),
                (v_j->>'fechaNacimiento')::DATE,
                COALESCE(v_j->>'tribu','Sin tribu'),
                NULLIF(btrim(COALESCE(v_j->>'telefono','')),''),
                -- Contestó que no tiene: queda dicho, nadie se lo vuelve a pedir.
                CASE WHEN v_j->>'sinCelular' = 'true' AND NULLIF(btrim(COALESCE(v_j->>'telefono','')),'') IS NULL THEN now() END,
                v_j->>'retiroTipo',
                NULLIF(btrim(COALESCE(v_j->>'retiroNombre','')),''),
                NULLIF(btrim(COALESCE(v_j->>'retiroApellido','')),''),
                NULLIF(btrim(COALESCE(v_j->>'retiroDni','')),''),
                NULLIF(btrim(COALESCE(v_j->>'retiroTelefono','')),''),
                COALESCE(NULLIF(btrim(v_j->>'restriccion'), ''), 'ninguna')
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
$function$;

CREATE OR REPLACE FUNCTION public.nocturna_agregar_jovenes(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_cfg          public.nocturna_config%ROWTYPE;
    v_i            public.nocturna_inscripciones%ROWTYPE;
    v_jovenes      JSONB;
    v_j            JSONB;
    v_dni          TEXT;
    v_nac          DATE;
    v_comprobante  TEXT;
    v_version      TEXT;
    v_error        TEXT;
    v_n            INTEGER;
    v_dnis         TEXT[];
    v_repetido     TEXT;
    v_total_chicos INTEGER;
BEGIN
    SELECT * INTO v_cfg FROM public.nocturna_config LIMIT 1;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'La configuración de Nocturna no está cargada.');
    END IF;

    IF NOT v_cfg.inscripciones_abiertas THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Las inscripciones están cerradas.');
    END IF;

    -- ── Quién dice ser ──────────────────────────────────────────────────────
    v_dni := btrim(COALESCE(p_payload->'adulto'->>'dni', ''));
    BEGIN
        v_nac := (p_payload->'adulto'->>'fechaNacimiento')::DATE;
    EXCEPTION WHEN others THEN
        v_nac := NULL;
    END;

    SELECT * INTO v_i
      FROM public.nocturna_inscripciones i
     WHERE i.edicion = v_cfg.edicion
       AND btrim(i.adulto_dni) = v_dni
     LIMIT 1;

    -- Un solo mensaje para "no existe" y para "la fecha no coincide": decir
    -- cuál de las dos falló es decirle a quien prueba números si acertó.
    IF NOT FOUND OR v_nac IS NULL OR v_i.adulto_fecha_nacimiento <> v_nac THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'No encontramos una inscripción con ese DNI y esa fecha de nacimiento.');
    END IF;

    -- ── Lo que se agrega ────────────────────────────────────────────────────
    v_comprobante := NULLIF(btrim(COALESCE(p_payload->>'comprobantePath', '')), '');
    IF v_comprobante IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Subí el comprobante de pago para terminar.');
    END IF;

    v_version := NULLIF(btrim(COALESCE(p_payload->>'declaracionesVersion', '')), '');
    IF v_version IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Falta la versión de las declaraciones.');
    END IF;

    v_jovenes := COALESCE(p_payload->'jovenes', '[]'::jsonb);
    v_n := jsonb_array_length(v_jovenes);
    IF v_n IS NULL OR v_n < 1 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Agregá al menos un adolescente.');
    END IF;

    -- La misma validación que el alta, con el adulto REAL de la inscripción
    -- —no el que vino en el payload— y excluyendo a esta inscripción, que si
    -- no chocaría contra sí misma.
    v_error := public.nocturna_validar_payload(
        jsonb_build_object(
            'adulto', jsonb_build_object(
                'nombre',          v_i.adulto_nombre,
                'apellido',        v_i.adulto_apellido,
                'dni',             v_i.adulto_dni,
                'email',           v_i.adulto_email,
                'fechaNacimiento', v_i.adulto_fecha_nacimiento),
            'jovenes',            v_jovenes,
            'autorizaAsistencia', true,
            'aceptaFotos',        v_i.acepta_fotos),
        v_cfg.edicion, false, false, v_i.id);

    IF v_error IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', v_error);
    END IF;

    -- Excluir la inscripción apagó, para estos DNI, el chequeo contra sus
    -- propios chicos. Es justo el error más probable de este formulario: "no
    -- me acuerdo si ya lo anoté".
    SELECT array_agg(btrim(x->>'dni')) INTO v_dnis
      FROM jsonb_array_elements(v_jovenes) AS x;

    SELECT j.nombre INTO v_repetido
      FROM public.nocturna_jovenes j
     WHERE j.inscripcion_id = v_i.id
       AND btrim(j.dni) = ANY (v_dnis)
     LIMIT 1;
    IF v_repetido IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'error',
            format('%s ya está anotado en esta inscripción.', v_repetido));
    END IF;

    -- ── Agregar ─────────────────────────────────────────────────────────────
    BEGIN
        FOR v_j IN SELECT * FROM jsonb_array_elements(v_jovenes)
        LOOP
            INSERT INTO public.nocturna_jovenes (
                inscripcion_id, edicion, nombre, apellido, dni, fecha_nacimiento, tribu,
                telefono, sin_celular_at,
                retiro_tipo, retiro_nombre, retiro_apellido, retiro_dni, retiro_telefono,
                restriccion
            ) VALUES (
                v_i.id, v_cfg.edicion,
                btrim(v_j->>'nombre'), btrim(v_j->>'apellido'), btrim(v_j->>'dni'),
                (v_j->>'fechaNacimiento')::DATE,
                COALESCE(v_j->>'tribu','Sin tribu'),
                NULLIF(btrim(COALESCE(v_j->>'telefono','')),''),
                -- Contestó que no tiene: queda dicho, nadie se lo vuelve a pedir.
                CASE WHEN v_j->>'sinCelular' = 'true' AND NULLIF(btrim(COALESCE(v_j->>'telefono','')),'') IS NULL THEN now() END,
                v_j->>'retiroTipo',
                NULLIF(btrim(COALESCE(v_j->>'retiroNombre','')),''),
                NULLIF(btrim(COALESCE(v_j->>'retiroApellido','')),''),
                NULLIF(btrim(COALESCE(v_j->>'retiroDni','')),''),
                NULLIF(btrim(COALESCE(v_j->>'retiroTelefono','')),''),
                COALESCE(NULLIF(btrim(v_j->>'restriccion'), ''), 'ninguna')
            );
        END LOOP;

        SELECT count(*) INTO v_total_chicos
          FROM public.nocturna_jovenes WHERE inscripcion_id = v_i.id;

        -- El total, con el precio que pagó esta familia. `aprobado_at` vuelve
        -- a NULL: hay un pago nuevo que nadie verificó.
        UPDATE public.nocturna_inscripciones
           SET total       = v_i.precio_unitario * v_total_chicos,
               aprobado_at = NULL
         WHERE id = v_i.id;

        INSERT INTO public.nocturna_comprobantes (
            inscripcion_id, path, monto, chicos,
            declaraciones_version, declaraciones_aceptadas_at)
        VALUES (
            v_i.id, v_comprobante, v_i.precio_unitario * v_n, v_n,
            v_version, now());
    EXCEPTION
        WHEN unique_violation THEN
            RETURN jsonb_build_object('ok', false, 'error',
                'Alguno de los DNI ya quedó inscripto recién. Revisá los datos.');
    END;

    RETURN jsonb_build_object(
        'ok',             true,
        'inscripcionId',  v_i.id,
        'codigoEntrada',  v_i.codigo_entrada,
        'agregados',      v_n,
        'aPagar',         v_i.precio_unitario * v_n,
        'total',          v_i.precio_unitario * v_total_chicos
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_editar_nocturna(p_inscripcion_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
            adulto_telefono         = COALESCE(
                NULLIF(btrim(COALESCE(v_adulto->>'telefono','')),''), adulto_telefono),
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
                    telefono         = NULLIF(btrim(COALESCE(v_j->>'telefono','')),''),
                    -- Al editar no se marca "sin celular": la ficha abre en "No tiene"
                    -- a todos los que no tienen número, también a los que nunca
                    -- contestaron. Sólo se borra la marca si ahora hay un número.
                    sin_celular_at   = CASE WHEN NULLIF(btrim(COALESCE(v_j->>'telefono','')),'') IS NOT NULL THEN NULL ELSE sin_celular_at END,
                    sin_celular_por  = CASE WHEN NULLIF(btrim(COALESCE(v_j->>'telefono','')),'') IS NOT NULL THEN NULL ELSE sin_celular_por END,
                    retiro_tipo      = v_j->>'retiroTipo',
                    retiro_nombre    = NULLIF(btrim(COALESCE(v_j->>'retiroNombre','')),''),
                    retiro_apellido  = NULLIF(btrim(COALESCE(v_j->>'retiroApellido','')),''),
                    retiro_dni       = NULLIF(btrim(COALESCE(v_j->>'retiroDni','')),''),
                    retiro_telefono  = NULLIF(btrim(COALESCE(v_j->>'retiroTelefono','')),''),
                    restriccion      = COALESCE(NULLIF(btrim(v_j->>'restriccion'), ''), 'ninguna')
                WHERE id = v_id AND inscripcion_id = p_inscripcion_id;
            ELSE
                INSERT INTO public.nocturna_jovenes (
                    inscripcion_id, edicion, nombre, apellido, dni, fecha_nacimiento, tribu,
                    telefono, sin_celular_at,
                    retiro_tipo, retiro_nombre, retiro_apellido, retiro_dni, retiro_telefono,
                    restriccion
                ) VALUES (
                    p_inscripcion_id, v_i.edicion,
                    btrim(v_j->>'nombre'), btrim(v_j->>'apellido'), btrim(v_j->>'dni'),
                    (v_j->>'fechaNacimiento')::DATE,
                    COALESCE(v_j->>'tribu','Sin tribu'),
                    NULLIF(btrim(COALESCE(v_j->>'telefono','')),''),
                    -- Contestó que no tiene: queda dicho, nadie se lo vuelve a pedir.
                    CASE WHEN v_j->>'sinCelular' = 'true' AND NULLIF(btrim(COALESCE(v_j->>'telefono','')),'') IS NULL THEN now() END,
                    v_j->>'retiroTipo',
                    NULLIF(btrim(COALESCE(v_j->>'retiroNombre','')),''),
                    NULLIF(btrim(COALESCE(v_j->>'retiroApellido','')),''),
                    NULLIF(btrim(COALESCE(v_j->>'retiroDni','')),''),
                    NULLIF(btrim(COALESCE(v_j->>'retiroTelefono','')),''),
                    COALESCE(NULLIF(btrim(v_j->>'restriccion'), ''), 'ninguna')
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
$function$;

-- Después de las funciones de arriba, que ya no las usan:
drop function if exists public.nocturna_precio_sumado(date, numeric, timestamptz);
drop function if exists public.nocturna_precio_para(date, timestamptz);
drop function if exists public.nocturna_precio_promo(date, timestamptz);
drop function if exists public.nocturna_precio_general(timestamptz);
