-- Deshace sql/reportes_limite_diario.sql: vuelve crear_reporte_problema a la
-- versión de sql/mi_cuenta.sql, sin tope diario.
CREATE OR REPLACE FUNCTION public.crear_reporte_problema(
    p_descripcion text,
    p_pantalla text DEFAULT NULL,
    p_captura_path text DEFAULT NULL,
    p_version_app text DEFAULT NULL,
    p_dispositivo text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_id uuid;
    v_numero integer;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF COALESCE(btrim(p_descripcion), '') = '' THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_descripcion');
    END IF;
    IF char_length(btrim(p_descripcion)) > 2000 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'descripcion_larga');
    END IF;
    IF p_captura_path IS NOT NULL
       AND split_part(p_captura_path, '/', 1) <> v_uid::text THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'captura_ajena');
    END IF;

    INSERT INTO public.reportes_problemas
        (user_id, descripcion, pantalla, captura_path, version_app, dispositivo)
    VALUES (v_uid, btrim(p_descripcion), NULLIF(btrim(p_pantalla), ''),
            NULLIF(btrim(p_captura_path), ''), NULLIF(btrim(p_version_app), ''),
            NULLIF(btrim(p_dispositivo), ''))
    RETURNING id, numero INTO v_id, v_numero;

    RETURN jsonb_build_object('ok', true, 'id', v_id,
                              'numero', lpad(v_numero::text, 4, '0'));
END;
$$;
