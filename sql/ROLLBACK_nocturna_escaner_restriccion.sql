-- ════════════════════════════════════════════════════════════════════════════
-- DESHACER sql/nocturna_escaner_restriccion.sql
--
-- Vuelve `get_nocturna_para_acreditar` a su definición exacta de antes
-- (copiada de pg_proc el 2026-10-30): la misma, sin el campo `restriccion`.
-- Los permisos quedan como estaban: sólo `authenticated`.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_nocturna_para_acreditar(p_inscripcion_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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
        -- Lo único que se agregó: si la tribu la eligió el staff en la puerta.
        'tribu_en_puerta', (j.tribu_asignada_at IS NOT NULL),
        'telefono', j.telefono,
        'sin_celular', (j.sin_celular_at IS NOT NULL),
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
            'adulto_telefono', v_i.adulto_telefono,
            'acepta_fotos', v_i.acepta_fotos,
            'adulto_acreditado_at', v_i.adulto_acreditado_at,
            'aprobado_at', v_i.aprobado_at,
            'total', v_i.total
        ),
        'jovenes', v_jovenes
    );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.get_nocturna_para_acreditar(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_nocturna_para_acreditar(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_nocturna_para_acreditar(uuid) TO authenticated;
