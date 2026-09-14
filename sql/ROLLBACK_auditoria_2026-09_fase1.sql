-- ============================================================================
-- ROLLBACK de auditoria_2026-09_fase1_seguridad.sql y ..._cierre_bienvenida.sql
-- Estado capturado de producción el 13/09/2026, antes de aplicar ningún cambio.
-- Restaura las 14 funciones (con sus permisos de ejecución) y las políticas de
-- app_config, group_dropout_requests y welcome_visitors, y elimina los
-- objetos nuevos que agrega la fase 1.
-- ============================================================================

-- objetos nuevos de la fase 1
DROP TRIGGER IF EXISTS proteger_columnas_de_rol ON public.users;
DROP FUNCTION IF EXISTS public.proteger_columnas_de_rol();
DROP FUNCTION IF EXISTS public.completar_formulario_bienvenida(text, text, text, text, text, boolean, text[], text);

-- funciones
CREATE OR REPLACE FUNCTION public.admin_assign_role(target_user_id uuid, new_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_role TEXT;
BEGIN
  -- Verificar si el usuario que ejecuta tiene permisos
  SELECT role INTO v_caller_role FROM users WHERE id = auth.uid();

  IF v_caller_role IN ('ADMIN', 'SUPERADMIN', 'ENCARGADO_GRUPOS') THEN
    -- Realizar el UPDATE en la tabla users
    UPDATE users 
    SET 
        role = new_role,
        -- Asegurar que el array roles también lo contenga
        roles = array_append(array_remove(roles, new_role), new_role)
    WHERE id = target_user_id;
  ELSE
    RAISE EXCEPTION 'No tienes permisos';
  END IF;
END;
$function$
;
REVOKE ALL ON FUNCTION public.admin_assign_role(target_user_id uuid, new_role text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_role(target_user_id uuid, new_role text) TO authenticated, postgres, service_role;

CREATE OR REPLACE FUNCTION public.admin_assign_role(target_user_id uuid, new_role text, new_variant text DEFAULT NULL::text, new_variants text[] DEFAULT NULL::text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_role TEXT;
  v_privileged_roles TEXT[] := ARRAY[
    'SUPER_ADMIN','PASTOR','ADMIN_PUNTO','ADMIN_GROUPS',
    'ADMIN_STORE','ADMIN_ALABANZA','ADMIN_CUIDADO_PASTORAL'
  ];
BEGIN
  SELECT role INTO v_caller_role FROM users WHERE id = auth.uid();

  IF new_role = ANY(v_privileged_roles) THEN
    IF v_caller_role IS DISTINCT FROM 'SUPER_ADMIN' THEN
      RAISE EXCEPTION 'Solo SUPER_ADMIN puede asignar roles privilegiados';
    END IF;
  ELSIF v_caller_role IN ('ADMIN_GROUPS','ENCARGADO_GRUPOS') THEN
    IF new_role NOT IN ('ANFITRION','CO_ANFITRION',
                        'VOLUNTARIO_GRUPOS','COORDINATOR') THEN
      RAISE EXCEPTION 'Rol fuera de tu alcance';
    END IF;
  ELSE
    RAISE EXCEPTION 'No tenés permisos para asignar roles';
  END IF;

  UPDATE users SET
    role = new_role::public.user_role,
    roles = array_append(array_remove(roles, new_role), new_role),
    coordinator_variants = CASE
        WHEN new_variants IS NOT NULL THEN new_variants
        ELSE coordinator_variants
    END,
    coordinator_variant = CASE
        WHEN new_variants IS NOT NULL THEN
            CASE WHEN array_length(new_variants, 1) > 0
                 THEN new_variants[1]
                 ELSE NULL
            END
        ELSE COALESCE(new_variant, coordinator_variant)
    END
  WHERE id = target_user_id;
END;
$function$
;
REVOKE ALL ON FUNCTION public.admin_assign_role(target_user_id uuid, new_role text, new_variant text, new_variants text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_role(target_user_id uuid, new_role text, new_variant text, new_variants text[]) TO authenticated, postgres, service_role;

CREATE OR REPLACE FUNCTION public.admin_delete_group(p_group_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_role public.user_role;
  v_caller_roles public.user_role[];
BEGIN
  SELECT role, roles INTO v_caller_role, v_caller_roles
  FROM public.users WHERE id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'SUPER_ADMIN'
     AND NOT (COALESCE(v_caller_roles, ARRAY[]::public.user_role[]) @> ARRAY['SUPER_ADMIN'::public.user_role]) THEN
    RAISE EXCEPTION 'Unauthorized: SUPER_ADMIN role required';
  END IF;

  UPDATE users SET linked_group_id = NULL WHERE linked_group_id = p_group_id::uuid;
  DELETE FROM group_attendance WHERE group_id = p_group_id;
  DELETE FROM group_registrations WHERE group_id = p_group_id;
  DELETE FROM groups WHERE id = p_group_id;

  IF NOT FOUND THEN
    RAISE WARNING 'Group with ID % not found', p_group_id;
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$function$
;
REVOKE ALL ON FUNCTION public.admin_delete_group(p_group_id text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_group(p_group_id text) TO authenticated, postgres, service_role;

CREATE OR REPLACE FUNCTION public.admin_remove_role(target_user_id uuid, role_to_remove text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_role TEXT;
  v_new_roles TEXT[];
BEGIN
  -- Verificar permisos
  SELECT role INTO v_caller_role FROM users WHERE id = auth.uid();

  IF v_caller_role IN ('ADMIN', 'SUPER_ADMIN', 'SUPERADMIN', 'ENCARGADO_GRUPOS', 'ADMIN_GROUPS') THEN

    -- Actualizar el array de roles y remover la variante si es coordinador
    UPDATE users
    SET
        roles = array_remove(roles, role_to_remove),
        coordinator_variant = CASE WHEN role_to_remove = 'COORDINATOR' THEN NULL ELSE coordinator_variant END,
        coordinator_variants = CASE WHEN role_to_remove = 'COORDINATOR' THEN '{}'::TEXT[] ELSE coordinator_variants END
    WHERE id = target_user_id
    RETURNING roles INTO v_new_roles;

    -- Si el rol principal era el que acabamos de remover, asignar el primero del array o 'USUARIO'
    IF (SELECT role FROM users WHERE id = target_user_id) = role_to_remove::public.user_role THEN
        UPDATE users
        SET role = COALESCE(v_new_roles[1]::public.user_role, 'USUARIO'::public.user_role)
        WHERE id = target_user_id;
    END IF;

  ELSE
    RAISE EXCEPTION 'No tienes permisos';
  END IF;
END;
$function$
;
REVOKE ALL ON FUNCTION public.admin_remove_role(target_user_id uuid, role_to_remove text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_role(target_user_id uuid, role_to_remove text) TO authenticated, postgres, service_role;

CREATE OR REPLACE FUNCTION public.admin_toggle_user_role(target_user_id uuid, role_to_assign text, assign boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    caller_id UUID := auth.uid();
    caller_role_current public.user_role;
    caller_roles public.user_role[];
    target_role_current public.user_role;
    target_roles_current public.user_role[];
    new_roles public.user_role[];
    new_legacy_role public.user_role;
    is_authorized BOOLEAN := FALSE;
    role_to_assign_enum public.user_role;
BEGIN
    -- Castear el texto pasado por argumento al Enum
    role_to_assign_enum := role_to_assign::public.user_role;

    -- 1. Obtener los roles del usuario que ejecuta la función
    SELECT role, roles INTO caller_role_current, caller_roles FROM public.users WHERE id = caller_id;
    IF caller_roles IS NULL OR array_length(caller_roles, 1) = 0 THEN
        caller_roles := ARRAY[COALESCE(caller_role_current, 'VIEWER'::public.user_role)];
    END IF;
    
    -- 2. Verificar autorización (Debe ser al menos ENCARGADO_GRUPOS u otro admin)
    IF 'SUPER_ADMIN'::public.user_role = ANY(caller_roles) 
       OR 'ADMIN_GROUPS'::public.user_role = ANY(caller_roles) 
       OR 'PASTOR'::public.user_role = ANY(caller_roles) 
       OR 'ENCARGADO_GRUPOS'::public.user_role = ANY(caller_roles) THEN
        is_authorized := TRUE;
    END IF;

    IF NOT is_authorized THEN
        RAISE EXCEPTION 'Not authorized to change user roles. Caller lacks required roles.';
    END IF;

    -- 3. Obtener el estado actual del usuario objetivo
    SELECT role, roles INTO target_role_current, target_roles_current 
    FROM public.users 
    WHERE id = target_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target user not found for ID %.', target_user_id;
    END IF;

    -- Si target_roles_current es nulo, creamos un array con su old role o VIEWER
    IF target_roles_current IS NULL THEN
        target_roles_current := ARRAY[COALESCE(target_role_current, 'VIEWER'::public.user_role)];
    END IF;

    -- 4. Calcular nuevos roles
    IF assign THEN
        -- Agregar el rol si no existe
        IF NOT role_to_assign_enum = ANY(target_roles_current) THEN
            new_roles := array_append(target_roles_current, role_to_assign_enum);
        ELSE
            new_roles := target_roles_current;
        END IF;
    ELSE
        -- Quitar el rol
        new_roles := array_remove(target_roles_current, role_to_assign_enum);
    END IF;

    -- Asegurar al menos un rol fallback
    IF array_length(new_roles, 1) IS NULL OR array_length(new_roles, 1) = 0 THEN
        new_roles := ARRAY['VIEWER'::public.user_role];
    END IF;

    -- 5. Calcular nuevo rol legacy (el campo 'role' simple)
    -- Siempre tomar el primer elemento del array resultante para evitar roles zombie
    new_legacy_role := new_roles[1];

    -- 6. Actualizar al usuario
    UPDATE public.users 
    SET 
        role = new_legacy_role,
        roles = new_roles
    WHERE id = target_user_id;

    RETURN TRUE;
    
    -- He removido el bloque EXCEPTION WHEN OTHERS para que, si hay un error, 
    -- explote y Supabase lo capture mandando el error real al frontend, 
    -- en lugar de atraparlo en silencio y devolver FALSE.
END;
$function$
;
REVOKE ALL ON FUNCTION public.admin_toggle_user_role(target_user_id uuid, role_to_assign text, assign boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_user_role(target_user_id uuid, role_to_assign text, assign boolean) TO authenticated, postgres, service_role;

CREATE OR REPLACE FUNCTION public.bulk_remove_group_members(p_registration_ids text[])
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_registration RECORD;
    v_group_id TEXT;
    v_host_id UUID;
    v_current_role TEXT;
    v_is_authorized BOOLEAN;
BEGIN
    -- Check permissions once for the user
    SELECT role::text INTO v_current_role
    FROM public.users
    WHERE id = auth.uid();

    -- Iterate through each registration to verify and delete
    -- This is safer than a bulk delete for now to ensure per-group permission checks if needed,
    -- though for bulk operations usually we check if the user is generally an admin or the host of the groups.
    -- To keep it efficient but safe, we'll verify the user has access to at least one of the groups or is an admin.
    
    -- Actually, simpler logic:
    -- 1. Identify all unique groups these registrations belong to.
    -- 2. Verify user is host/admin for those groups.
    
    -- But since we want to be robust, let's strictly check:
    -- A user can perform this if they are SUPER_ADMIN, ADMIN_GROUPS, PASTOR, CO_ANFITRION, ANFITRION
    -- For hosts (ANFITRION), they should only be able to delete from THEIR groups.
    
    IF v_current_role IN ('SUPER_ADMIN', 'ADMIN_GROUPS', 'PASTOR', 'CO_ANFITRION') THEN
         v_is_authorized := TRUE;
    ELSE
         -- Check if user is host of ALL relevant groups is complicated in a single query if multiple groups involved.
         -- Assuming UI only allows selecting from ONE group at a time (which is true for ApplicantsModal), 
         -- we can check the first registration.
         
         SELECT group_id INTO v_group_id FROM group_registrations WHERE id = p_registration_ids[1];
         SELECT host_id INTO v_host_id FROM groups WHERE id = v_group_id;
         
         IF v_host_id = auth.uid() THEN
             v_is_authorized := TRUE;
         ELSE
             v_is_authorized := FALSE;
         END IF;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Access Denied: You do not have permission to remove these members.';
    END IF;

    -- Proceed with deletion
    -- We need to capture the group_ids to update counts
    -- Create a temp table or CTE to hold deleted groups to update counts
    
    WITH deleted_rows AS (
        DELETE FROM group_registrations
        WHERE id = ANY(p_registration_ids)
        RETURNING group_id, status
    ),
    group_counts AS (
        SELECT group_id, count(*) as removed_count
        FROM deleted_rows
        WHERE status = 'APPROVED' -- Only decrement if they were actually members
        GROUP BY group_id
    )
    UPDATE groups g
    SET members_count = GREATEST(0, COALESCE(g.members_count, 0) - gc.removed_count)
    FROM group_counts gc
    WHERE g.id = gc.group_id;

    RETURN TRUE;
END;
$function$
;
REVOKE ALL ON FUNCTION public.bulk_remove_group_members(p_registration_ids text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_remove_group_members(p_registration_ids text[]) TO PUBLIC, anon, authenticated, postgres, service_role;

CREATE OR REPLACE FUNCTION public.check_is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'SUPER_ADMIN'
  );
$function$
;
REVOKE ALL ON FUNCTION public.check_is_super_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_super_admin() TO PUBLIC, anon, authenticated, postgres, service_role;

CREATE OR REPLACE FUNCTION public.get_couple_registration_status(p_group_id uuid, p_user_id uuid, p_email text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status
  FROM group_registrations
  WHERE group_id = p_group_id
    AND (
      user_id = p_user_id
      OR partner_user_id = p_user_id
      OR NULLIF(LOWER(TRIM(partner_data->>'email')), '') = NULLIF(LOWER(TRIM(p_email)), '')
      OR NULLIF(LOWER(TRIM(email)), '') = NULLIF(LOWER(TRIM(p_email)), '')
    )
  ORDER BY
    CASE UPPER(status)
      WHEN 'APPROVED' THEN 1
      WHEN 'PENDING' THEN 2
      WHEN 'REJECTED' THEN 3
      ELSE 4
    END
  LIMIT 1;

  RETURN v_status;
END;
$function$
;
REVOKE ALL ON FUNCTION public.get_couple_registration_status(p_group_id uuid, p_user_id uuid, p_email text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_couple_registration_status(p_group_id uuid, p_user_id uuid, p_email text) TO PUBLIC, anon, authenticated, postgres, service_role;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
    AND role = 'SUPER_ADMIN'::user_role
  );
END;
$function$
;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO PUBLIC, anon, authenticated, postgres, service_role;

CREATE OR REPLACE FUNCTION public.manage_group_registration_v3(p_registration_id text, p_status text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_group_id TEXT;
    v_host_id UUID;
    v_current_role TEXT;
    v_current_status TEXT;
    v_members_count INTEGER;
    v_is_authorized BOOLEAN;
BEGIN
    SELECT group_id, status INTO v_group_id, v_current_status
    FROM group_registrations
    WHERE id = p_registration_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registration not found';
    END IF;

    SELECT host_id, members_count INTO v_host_id, v_members_count
    FROM groups
    WHERE id = v_group_id;

    SELECT role::text INTO v_current_role
    FROM public.users
    WHERE id = auth.uid();

    v_is_authorized := (v_host_id IS NOT DISTINCT FROM auth.uid() AND auth.uid() IS NOT NULL)
        OR COALESCE(v_current_role, '') = ANY(ARRAY['SUPER_ADMIN', 'ADMIN_GROUPS', 'ENCARGADO_GRUPOS', 'PASTOR', 'ANFITRION', 'CO_ANFITRION', 'VOLUNTARIO_GRUPOS']);

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Access Denied: You do not have permissions to manage this registration. Role: %', v_current_role;
    END IF;

    UPDATE group_registrations
    SET status = p_status
    WHERE id = p_registration_id;

    -- El contador NO se toca acá: el trigger
    -- trg_update_members_count ya recalcula members_count
    -- como COUNT(*) WHERE status='APPROVED' después de
    -- cada cambio. Sumar o restar acá contaba doble —
    -- causa de que 52 de 82 grupos tuvieran el número mal.

    -- ── DERIVACIÓN ──
    -- Si esta inscripción vino marcada como derivación y se
    -- acaba de aprobar, se borra la del grupo de origen.
    -- Va acá adentro a propósito: aprobar el ingreso al
    -- grupo nuevo y salir del viejo tienen que ser una sola
    -- operación.
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
                -- Si el grupo de origen ya no existe, esto afecta 0 filas y
                -- no pasa nada: la derivación se completa igual.
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
$function$
;
REVOKE ALL ON FUNCTION public.manage_group_registration_v3(p_registration_id text, p_status text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manage_group_registration_v3(p_registration_id text, p_status text) TO authenticated, postgres, service_role;

CREATE OR REPLACE FUNCTION public.notify_admins_on_new_group()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    admin_user RECORD;
    host_name TEXT;
BEGIN
    -- Only trigger for pending groups (new submissions)
    IF NEW.status = 'pending' OR NEW.status IS NULL THEN
        
        -- Get host name for the notification
        SELECT name INTO host_name FROM users WHERE id = NEW.host_id;
        IF host_name IS NULL THEN
            host_name := 'Un anfitrión';
        END IF;
        
        -- Loop through all admin users and create notifications
        FOR admin_user IN 
            SELECT id FROM users 
            WHERE role IN ('SUPER_ADMIN', 'ADMIN_GROUPS', 'PASTOR')
        LOOP
            INSERT INTO notifications (
                user_id,
                title,
                message,
                details,
                type,
                target_roles,
                metadata
            ) VALUES (
                admin_user.id,
                '📋 Nueva Solicitud de Grupo',
                host_name || ' ha creado el grupo "' || NEW.name || '". Pendiente de revisión.',
                'Ubicación: ' || COALESCE(NEW.location, 'No especificada') || ' | Horario: ' || COALESCE(NEW.meeting_day, 'No especificado') || ' ' || COALESCE(NEW.meeting_time, ''),
                'ADMIN',
                ARRAY['SUPER_ADMIN', 'ADMIN_GROUPS', 'PASTOR']::TEXT[],
                jsonb_build_object(
                    'group_id', NEW.id,
                    'group_name', NEW.name,
                    'host_id', NEW.host_id,
                    'host_name', host_name,
                    'action_required', 'review'
                )
            );
        END LOOP;
        
    END IF;
    
    RETURN NEW;
END;
$function$
;
REVOKE ALL ON FUNCTION public.notify_admins_on_new_group() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_admins_on_new_group() TO anon, authenticated, postgres, service_role;

CREATE OR REPLACE FUNCTION public.notify_host_on_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    notification_type TEXT;
    status_label TEXT;
    note_text TEXT;
    admin_user RECORD;
    host_name TEXT;
BEGIN
    -- Only trigger if status actually changed
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        
        -- Determine notification type based on new status
        CASE NEW.status
            WHEN 'approved' THEN
                notification_type := 'GROUPS';
                status_label := 'APROBADO ✓';
            WHEN 'rejected' THEN
                notification_type := 'GROUPS';
                status_label := 'RECHAZADO ✗';
            WHEN 'pending' THEN
                notification_type := 'GROUPS';
                status_label := 'PENDIENTE (Re-enviado)';
            ELSE
                notification_type := 'SYSTEM';
                status_label := NEW.status;
        END CASE;
        
        -- Include admin note if present
        IF NEW.admin_note IS NOT NULL AND NEW.admin_note != '' THEN
            note_text := ' Nota del Admin: ' || NEW.admin_note;
        ELSE
            note_text := '';
        END IF;
        
        -- Insert notification for the Host
        INSERT INTO notifications (
            user_id,
            title,
            message,
            details,
            type,
            target_roles,
            metadata
        ) VALUES (
            NEW.host_id,
            'Estado de tu Grupo Actualizado',
            'Tu grupo "' || NEW.name || '" ha cambiado de estado a: ' || status_label || '.' || note_text,
            'ID del grupo: ' || NEW.id,
            notification_type,
            ARRAY['ANFITRION']::TEXT[],
            jsonb_build_object(
                'group_id', NEW.id,
                'group_name', NEW.name,
                'old_status', OLD.status,
                'new_status', NEW.status
            )
        );
        
        -- ============================================
        -- NOTIFY ADMINS when group is RE-SUBMITTED (edited by host, back to pending)
        -- ============================================
        IF NEW.status = 'pending' AND OLD.status = 'rejected' THEN
            -- Get host name for the admin notification
            SELECT name INTO host_name FROM users WHERE id = NEW.host_id;
            IF host_name IS NULL THEN
                host_name := 'Un anfitrión';
            END IF;
            
            -- Notify all admins about the re-submission
            FOR admin_user IN 
                SELECT id FROM users 
                WHERE role IN ('SUPER_ADMIN', 'ADMIN_GROUPS', 'PASTOR')
            LOOP
                INSERT INTO notifications (
                    user_id,
                    title,
                    message,
                    details,
                    type,
                    target_roles,
                    metadata
                ) VALUES (
                    admin_user.id,
                    '🔄 Grupo Re-enviado para Revisión',
                    host_name || ' ha editado y re-enviado el grupo "' || NEW.name || '". Requiere nueva revisión.',
                    'Este grupo fue previamente rechazado y ha sido modificado.',
                    'ADMIN',
                    ARRAY['SUPER_ADMIN', 'ADMIN_GROUPS', 'PASTOR']::TEXT[],
                    jsonb_build_object(
                        'group_id', NEW.id,
                        'group_name', NEW.name,
                        'host_id', NEW.host_id,
                        'host_name', host_name,
                        'action_required', 'review',
                        'is_resubmission', true
                    )
                );
            END LOOP;
        END IF;
        
    END IF;
    
    RETURN NEW;
END;
$function$
;
REVOKE ALL ON FUNCTION public.notify_host_on_status_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_host_on_status_change() TO anon, authenticated, postgres, service_role;

CREATE OR REPLACE FUNCTION public.search_welcome_visitor(p_first_name text, p_last_name text)
 RETURNS TABLE(id uuid, first_name text, last_name text, phone text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
    SELECT wv.id, wv.first_name, wv.last_name, wv.phone
    FROM public.welcome_visitors wv
    WHERE lower(btrim(wv.first_name)) = lower(btrim(p_first_name))
      AND lower(btrim(wv.last_name))  = lower(btrim(p_last_name))
    -- Mismo orden/límite que tenía la query original: ante homónimos, el
    -- match por teléfono del cliente recorre primero los registros recientes.
    ORDER BY wv.created_at DESC
    LIMIT 10;
$function$
;
REVOKE ALL ON FUNCTION public.search_welcome_visitor(p_first_name text, p_last_name text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_welcome_visitor(p_first_name text, p_last_name text) TO PUBLIC, anon, authenticated, postgres, service_role;

CREATE OR REPLACE FUNCTION public.toggle_group_capacity_lock(p_group_id text, p_locked boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_caller_role public.user_role;
    v_caller_roles public.user_role[];
    v_host_id UUID;
    v_co_host_id UUID;
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    SELECT role, roles INTO v_caller_role, v_caller_roles FROM public.users WHERE id = auth.uid();
    IF v_caller_roles IS NULL OR array_length(v_caller_roles, 1) = 0 THEN
        v_caller_roles := ARRAY[COALESCE(v_caller_role, 'VIEWER'::public.user_role)];
    END IF;

    SELECT host_id, co_host_id INTO v_host_id, v_co_host_id
    FROM public.groups WHERE id = p_group_id;

    IF 'SUPER_ADMIN'::public.user_role = ANY(v_caller_roles)
       OR 'ADMIN_GROUPS'::public.user_role = ANY(v_caller_roles)
       OR 'ENCARGADO_GRUPOS'::public.user_role = ANY(v_caller_roles)
       OR auth.uid() = v_host_id
       OR auth.uid() = v_co_host_id
    THEN
        v_is_authorized := TRUE;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'No tenés permisos para modificar este grupo';
    END IF;

    UPDATE public.groups
    SET capacity_locked = p_locked
    WHERE id = p_group_id;
END;
$function$
;
REVOKE ALL ON FUNCTION public.toggle_group_capacity_lock(p_group_id text, p_locked boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_group_capacity_lock(p_group_id text, p_locked boolean) TO PUBLIC, anon, authenticated, postgres, service_role;

CREATE OR REPLACE FUNCTION public.toggle_group_visibility(p_group_id text, p_hidden boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_caller_role public.user_role;
    v_caller_roles public.user_role[];
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    SELECT role, roles INTO v_caller_role, v_caller_roles FROM public.users WHERE id = auth.uid();
    IF v_caller_roles IS NULL OR array_length(v_caller_roles, 1) = 0 THEN
        v_caller_roles := ARRAY[COALESCE(v_caller_role, 'VIEWER'::public.user_role)];
    END IF;

    IF 'SUPER_ADMIN'::public.user_role = ANY(v_caller_roles)
       OR 'ADMIN_GROUPS'::public.user_role = ANY(v_caller_roles)
       OR 'ENCARGADO_GRUPOS'::public.user_role = ANY(v_caller_roles)
    THEN
        v_is_authorized := TRUE;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'No tenés permisos para ocultar este grupo';
    END IF;

    UPDATE public.groups
    SET is_hidden = p_hidden
    WHERE id = p_group_id;
END;
$function$
;
REVOKE ALL ON FUNCTION public.toggle_group_visibility(p_group_id text, p_hidden boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_group_visibility(p_group_id text, p_hidden boolean) TO PUBLIC, anon, authenticated, postgres, service_role;

-- políticas: se eliminan las actuales de las tres tablas y se recrean las originales
DO $$ DECLARE r record; BEGIN FOR r IN SELECT polname FROM pg_policy WHERE polrelid = 'public.app_config'::regclass LOOP EXECUTE format('DROP POLICY %I ON public.app_config', r.polname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT polname FROM pg_policy WHERE polrelid = 'public.group_dropout_requests'::regclass LOOP EXECUTE format('DROP POLICY %I ON public.group_dropout_requests', r.polname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT polname FROM pg_policy WHERE polrelid = 'public.welcome_visitors'::regclass LOOP EXECUTE format('DROP POLICY %I ON public.welcome_visitors', r.polname); END LOOP; END $$;
CREATE POLICY "Allow All Authenticated" ON public.app_config AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Authenticated update access" ON public.app_config AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Public Access Config" ON public.app_config AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "Public read access" ON public.app_config AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY admins_manage_requests ON public.group_dropout_requests AS PERMISSIVE FOR ALL TO PUBLIC USING (tiene_rol(ARRAY['SUPER_ADMIN'::text, 'ADMIN_GROUPS'::text]));
CREATE POLICY hosts_insert_own_requests ON public.group_dropout_requests AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((host_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM groups
  WHERE ((groups.id = group_dropout_requests.group_id) AND (groups.host_id = auth.uid()))))));
CREATE POLICY hosts_view_own_requests ON public.group_dropout_requests AS PERMISSIVE FOR SELECT TO PUBLIC USING ((host_id = auth.uid()));
CREATE POLICY "Enable all access for authenticated users" ON public.welcome_visitors AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY welcome_visitors_public_fill_form ON public.welcome_visitors AS PERMISSIVE FOR UPDATE TO anon USING ((stage = ANY (ARRAY['NEW'::visitor_stage, 'FILLED_FORM'::visitor_stage]))) WITH CHECK ((stage = 'FILLED_FORM'::visitor_stage));
CREATE POLICY welcome_visitors_public_search ON public.welcome_visitors AS PERMISSIVE FOR SELECT TO anon USING (true);
