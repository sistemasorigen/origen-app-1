-- ════════════════════════════════════════════════════════════════════════════
-- El escáner de la puerta también trae la restricción de cada adolescente
-- 2026-10-30 · pedido de Ignacio
--
-- QUÉ CAMBIA. `get_nocturna_para_acreditar` devolvía todo menos una cosa:
-- `restriccion` (celiaquía o diabetes). En la puerta no se veía, así que la
-- única forma de enterarse era abrir la planilla. Se agrega ese campo a cada
-- joven. **Nada más**: ni un campo menos, ni una condición distinta.
--
-- El dato del adulto (DNI, email y celular) ya venía: lo que faltaba era
-- mostrarlo, y eso se arregló en pages/eventos/nocturna/AcreditarNocturna.tsx.
--
-- ORDEN. Esto primero, el deploy después: el frontend viejo ignora un campo
-- que no conoce, así que aplicarlo solo no rompe nada.
--
-- Pruebas: sql/PROBAR_nocturna_escaner_restriccion.sql
-- Deshacer: sql/ROLLBACK_nocturna_escaner_restriccion.sql
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
        -- Si la tribu la eligió el staff en la puerta.
        'tribu_en_puerta', (j.tribu_asignada_at IS NOT NULL),
        -- Celiaquía o diabetes. En la puerta se avisa a la cocina.
        'restriccion', j.restriccion,
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


-- ── Permisos ────────────────────────────────────────────────────────────────
-- CREATE OR REPLACE vuelve a darle EXECUTE a PUBLIC (sección 12, regla 3).
-- Esto deja los permisos como ya estaban: sólo `authenticated` (y adentro la
-- función igual chequea que quien llama sea staff de Nocturna).
REVOKE EXECUTE ON FUNCTION public.get_nocturna_para_acreditar(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_nocturna_para_acreditar(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_nocturna_para_acreditar(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_nocturna_para_acreditar(uuid) IS
    'La ficha que lee el escáner de la puerta: la inscripción, el adulto a cargo y los adolescentes con su tribu, su restricción y su estado. Sólo staff de Nocturna.';
