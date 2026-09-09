-- ════════════════════════════════════════════════════════════════════════
-- derivar_miembro — el anfitrión manda a un miembro de su grupo a otro grupo
-- 2026-09-08
--
-- Crea una inscripción PENDING en el grupo destino con
-- transfer_from_group_id apuntando al de origen. El anfitrión del destino la
-- aprueba como cualquier otra.
--
-- POR QUÉ VA EN LA BASE Y NO EN EL NAVEGADOR: desde que se cerró el RLS de
-- group_registrations, un anfitrión solo ve las inscripciones de SU grupo.
-- Un chequeo de duplicados hecho desde el cliente contra el grupo destino
-- devolvería vacío SIEMPRE y dejaría pasar duplicados en silencio. Acá, con
-- SECURITY DEFINER, el chequeo ve la realidad.
--
-- LO QUE NO HACE: dar de baja la inscripción de origen. Eso lo ejecuta
-- manage_group_registration_v3 cuando el destino aprueba, en la misma
-- transacción. Si se diera de baja acá, un rechazo dejaría a la persona sin
-- ningún grupo.
--
-- Columnas verificadas contra information_schema antes de escribir el INSERT:
--   id, first_name, last_name, email, phone, dni, timestamp, group_id,
--   user_id, status, partner_data, partner_user_id, transfer_from_group_id
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.derivar_miembro(
    p_registration_id TEXT,
    p_to_group_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reg RECORD;
    v_from_group_id TEXT;
    v_caller UUID;
    v_authorized BOOLEAN;
    v_existing_status TEXT;
    v_new_id TEXT;
BEGIN
    v_caller := auth.uid();

    -- Sin sesión no se deriva nada. Explícito para no repetir
    -- el bug de NULL que se corrigió en la auditoría.
    IF v_caller IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Sesión requerida.');
    END IF;

    SELECT * INTO v_reg FROM group_registrations WHERE id = p_registration_id;
    IF NOT FOUND THEN
        -- Mismo mensaje que el de permiso denegado, a propósito:
        -- si fueran distintos, alguien podría sondear ids para
        -- averiguar qué inscripciones existen.
        RETURN jsonb_build_object('ok', false, 'error', 'No tenés permiso para derivar miembros de este grupo.');
    END IF;

    v_from_group_id := v_reg.group_id;

    -- Autorización: anfitrión o co-anfitrión del grupo de ORIGEN, o staff.
    -- Corre ANTES de cualquier chequeo sobre el contenido de la inscripción,
    -- para que quien no tiene permiso no pueda deducir nada de su estado.
    SELECT (
        EXISTS (
            SELECT 1 FROM groups g
            WHERE g.id = v_from_group_id
              AND (g.host_id = v_caller OR g.co_host_id = v_caller)
        )
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = v_caller
              AND (
                u.role::text = ANY (ARRAY['SUPER_ADMIN','PASTOR','ADMIN_GROUPS','ENCARGADO_GRUPOS'])
                -- users.roles es text[], NO user_role[].
                OR u.roles && ARRAY['SUPER_ADMIN','PASTOR','ADMIN_GROUPS','ENCARGADO_GRUPOS']::text[]
              )
        )
    ) INTO v_authorized;

    IF NOT v_authorized THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No tenés permiso para derivar miembros de este grupo.');
    END IF;

    -- Solo se puede derivar a alguien que efectivamente es miembro.
    IF upper(v_reg.status) <> 'APPROVED' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Solo se puede derivar a un miembro aprobado.');
    END IF;

    IF v_from_group_id = p_to_group_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'El grupo destino es el mismo que el de origen.');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM groups WHERE id = p_to_group_id) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'El grupo destino no existe.');
    END IF;

    -- Duplicados en el destino. Se matchea por user_id y también
    -- por email, porque hay inscripciones sin user_id.
    -- SELECT ... INTO deja v_existing_status en NULL si no hay filas, y el
    -- IF de abajo lo contempla — no se repite el error de la auditoría.
    SELECT upper(status) INTO v_existing_status
    FROM group_registrations
    WHERE group_id = p_to_group_id
      AND (
            (v_reg.user_id IS NOT NULL AND user_id = v_reg.user_id)
         OR (v_reg.email IS NOT NULL AND lower(trim(email)) = lower(trim(v_reg.email)))
      )
      AND upper(status) IN ('PENDING', 'APPROVED')
    LIMIT 1;

    IF v_existing_status IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'error',
            CASE WHEN v_existing_status = 'APPROVED'
                 THEN 'Esta persona ya es miembro del grupo destino.'
                 ELSE 'Esta persona ya tiene una solicitud pendiente en el grupo destino.'
            END);
    END IF;

    v_new_id := gen_random_uuid()::text;

    -- Se copian partner_data y partner_user_id: si la persona se
    -- había inscripto en pareja, la derivación se lleva a los dos.
    INSERT INTO group_registrations (
        id, group_id, user_id, first_name, last_name, email, phone, dni,
        status, transfer_from_group_id, partner_data, partner_user_id, timestamp
    ) VALUES (
        v_new_id, p_to_group_id, v_reg.user_id, v_reg.first_name, v_reg.last_name,
        v_reg.email, v_reg.phone, v_reg.dni,
        'PENDING', v_from_group_id, v_reg.partner_data, v_reg.partner_user_id, NOW()
    );

    RETURN jsonb_build_object('ok', true, 'registration_id', v_new_id);
END;
$$;


-- ── Permisos ────────────────────────────────────────────────────────────
-- CREATE OR REPLACE restablece el GRANT a PUBLIC, y Supabase otorga EXECUTE
-- a anon por separado. Hay que revocar de los dos.
REVOKE EXECUTE ON FUNCTION public.derivar_miembro(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.derivar_miembro(text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.derivar_miembro(text, text) TO authenticated;


-- ── Verificación ────────────────────────────────────────────────────────
SELECT
  has_function_privilege('anon','public.derivar_miembro(text, text)','EXECUTE')          AS anon_debe_ser_false,
  has_function_privilege('authenticated','public.derivar_miembro(text, text)','EXECUTE') AS auth_debe_ser_true;
