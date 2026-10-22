-- ════════════════════════════════════════════════════════════════════════════
-- Reportes de problemas · máximo 3 por persona por día
-- 2026-10-22 · ✅ APLICADO el 2026-10-22 (pruebas de PROBAR_ en verde)
--
-- POR QUÉ
--   · Seguridad: sin tope, una cuenta puede llenar la tabla y la bandeja de
--     Sistemas.
--   · Emails: cada reporte manda uno a sistemas@ por Resend, que da 100 por
--     día para toda la app (las entradas de Nocturna incluidas). La función
--     ya corta en 30 por día en total; esto corta antes, por persona.
--
-- QUÉ CAMBIA
--   crear_reporte_problema() es la de sql/mi_cuenta.sql con dos cosas más:
--   1 · Cuenta los reportes de auth.uid() en el día argentino y, si ya hay 3,
--       devuelve {ok:false, motivo:'limite_diario', limite:3} sin insertar.
--   2 · Un lock por persona (pg_advisory_xact_lock) antes de contar: dos
--       envíos simultáneos no pueden colarse los dos como "el tercero".
--   Devuelve además 'restantes' en el ok, para que la pantalla lo diga.
--
-- Pruebas: sql/PROBAR_reportes_limite_diario.sql
-- Deshacer: sql/ROLLBACK_reportes_limite_diario.sql
-- ════════════════════════════════════════════════════════════════════════════

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
    c_limite CONSTANT integer := 3;
    v_uid uuid := auth.uid();
    v_id uuid;
    v_numero integer;
    v_hoy integer;
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
    -- La captura tiene que estar en la carpeta propia, igual que en el bucket.
    IF p_captura_path IS NOT NULL
       AND split_part(p_captura_path, '/', 1) <> v_uid::text THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'captura_ajena');
    END IF;

    -- El tope: 3 por día argentino. El lock serializa los envíos de la misma
    -- persona hasta el final de la transacción.
    PERFORM pg_advisory_xact_lock(hashtext('reportes_problemas:' || v_uid::text));
    SELECT count(*) INTO v_hoy
      FROM public.reportes_problemas r
     WHERE r.user_id = v_uid
       AND r.created_at >= (date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires')
                            AT TIME ZONE 'America/Argentina/Buenos_Aires');
    IF v_hoy >= c_limite THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'limite_diario', 'limite', c_limite);
    END IF;

    INSERT INTO public.reportes_problemas
        (user_id, descripcion, pantalla, captura_path, version_app, dispositivo)
    VALUES (v_uid, btrim(p_descripcion), NULLIF(btrim(p_pantalla), ''),
            NULLIF(btrim(p_captura_path), ''), NULLIF(btrim(p_version_app), ''),
            NULLIF(btrim(p_dispositivo), ''))
    RETURNING id, numero INTO v_id, v_numero;

    RETURN jsonb_build_object('ok', true, 'id', v_id,
                              'numero', lpad(v_numero::text, 4, '0'),
                              'restantes', c_limite - v_hoy - 1);
END;
$$;

COMMENT ON FUNCTION public.crear_reporte_problema(text, text, text, text, text) IS
    'Alta de un reporte de problema. Máximo 3 por persona por día argentino. Devuelve el numero ya formateado.';
