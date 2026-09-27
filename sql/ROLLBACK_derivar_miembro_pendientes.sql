-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK de derivar_miembro_pendientes.sql
-- 2026-09-26
--
-- Estas son las definiciones que estaban vivas ANTES del cambio, tomadas con
-- pg_get_functiondef el mismo día. Correr este archivo deja las dos funciones
-- exactamente como estaban: sólo se transfiere gente aprobada, y la limpieza
-- del origen vuelve a mirar únicamente user_id y status APPROVED.
--
-- Ojo: si ya se transfirieron pendientes, volver atrás deja esos pedidos
-- fantasma sin limpiar cuando el destino apruebe. Revisar antes con:
--   SELECT r.id, r.group_id, r.transfer_from_group_id, r.status
--   FROM group_registrations r
--   WHERE r.transfer_from_group_id IS NOT NULL AND upper(r.status) = 'PENDING';
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.derivar_miembro(p_registration_id text, p_to_group_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;


CREATE OR REPLACE FUNCTION public.manage_group_registration_v3(p_registration_id text, p_status text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_group_id TEXT;
    v_host_id UUID;
    v_co_host_id UUID;
    v_current_status TEXT;
    v_is_authorized BOOLEAN;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Access Denied: session required.';
    END IF;

    IF p_status IS NULL OR p_status NOT IN ('APPROVED', 'REJECTED', 'PENDING') THEN
        RAISE EXCEPTION 'Invalid registration status: %', p_status;
    END IF;

    SELECT group_id, status INTO v_group_id, v_current_status
    FROM group_registrations
    WHERE id = p_registration_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registration not found';
    END IF;

    SELECT host_id, co_host_id INTO v_host_id, v_co_host_id
    FROM groups
    WHERE id = v_group_id;

    v_is_authorized := COALESCE(auth.uid() = v_host_id, false)
                    OR COALESCE(auth.uid() = v_co_host_id, false)
                    OR public.tiene_rol(ARRAY['SUPER_ADMIN', 'ADMIN_GROUPS', 'ENCARGADO_GRUPOS', 'PASTOR']);

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Access Denied: You do not have permissions to manage this registration.';
    END IF;

    UPDATE group_registrations
    SET status = p_status
    WHERE id = p_registration_id;

    IF p_status = 'APPROVED' AND v_current_status != 'APPROVED' THEN
        DECLARE
            v_transfer_from TEXT;
            v_user_id UUID;
        BEGIN
            SELECT transfer_from_group_id, user_id
            INTO v_transfer_from, v_user_id
            FROM group_registrations
            WHERE id = p_registration_id;

            IF v_transfer_from IS NOT NULL AND v_user_id IS NOT NULL THEN
                DELETE FROM group_registrations
                WHERE group_id = v_transfer_from
                  AND user_id = v_user_id
                  AND id <> p_registration_id
                  AND upper(status) = 'APPROVED';
            END IF;
        END;
    END IF;

    RETURN TRUE;
END;
$function$;
