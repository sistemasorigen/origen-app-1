-- ============================================================================
-- Auditoría de roles y permisos — FASE 1: seguridad crítica y roles rotos
-- 13/09/2026
--
-- Aplicar ANTES de desplegar el frontend. Todo lo de este archivo es
-- compatible con el bundle que está hoy en producción, salvo lo que se indica.
-- El cierre de las políticas públicas de welcome_visitors va en un archivo
-- aparte (auditoria_2026-09_fase1_cierre_bienvenida.sql) que se corre DESPUÉS
-- del deploy, porque el formulario público viejo todavía las necesita.
--
-- Rollback exacto del estado anterior: ROLLBACK_auditoria_2026-09_fase1.sql
-- Prueba (se deshace sola):            PROBAR_auditoria_2026-09_fase1.sql
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- 1. users: cualquier usuario con sesión podía darse SUPER_ADMIN
--
-- users tiene cuatro políticas de UPDATE sobre la propia fila y las políticas
-- permisivas se combinan con OR. users_update_self_no_role impide tocar role
-- y roles, pero nuclear_update_own, "Usuarios pueden actualizar su propio
-- perfil" y users_update_self sólo piden id = auth.uid(), así que la
-- restricción quedaba anulada. authenticated tiene privilegio de UPDATE sobre
-- las dos columnas y no había ningún trigger BEFORE que las protegiera: un
-- PATCH a /rest/v1/users con {"roles":["SUPER_ADMIN"]} era aceptado. Encadenado
-- con eso, la edge function admin-manage-user decide si el llamador es
-- SUPER_ADMIN leyendo esa misma fila, así que también quedaba expuesta la
-- creación de cuentas y el cambio de contraseñas de terceros.
--
-- audit_logs no muestra ninguna auto-escalada desde el 12/01/2026 (inicio de
-- la auditoría); los 43 otorgamientos de roles privilegiados los hizo otra
-- persona.
--
-- No se rechaza el UPDATE: la página de perfil y la de cambio de contraseña
-- envían el objeto de usuario completo, role y roles incluidos. El trigger
-- conserva en silencio las columnas de privilegio cuando quien escribe
-- directo desde la app no es SUPER_ADMIN.
--
-- current_user distingue el origen: PostgREST ejecuta como anon/authenticated;
-- las funciones SECURITY DEFINER (admin_assign_role, handle_new_user,
-- assign_co_host_role, …) corren como su dueño y hacen sus propios chequeos.
-- Por eso la función del trigger NO es SECURITY DEFINER.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.proteger_columnas_de_rol()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    IF current_user NOT IN ('anon', 'authenticated') THEN
        RETURN NEW;
    END IF;

    IF public.tiene_rol(ARRAY['SUPER_ADMIN']) THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        -- Sólo pasa si handle_new_user no creó la fila (updateUserProfile
        -- hace un upsert de respaldo). Nadie nace con privilegios.
        NEW.role                 := 'VIEWER';
        NEW.roles                := ARRAY['VIEWER'];
        NEW.volunteer_roles      := NULL;
        NEW.is_system_volunteer  := false;
        NEW.coordinator_variant  := NULL;
        NEW.coordinator_variants := '{}';
        NEW.linked_group_id      := NULL;
        NEW.assigned_category    := NULL;
        NEW.email                := COALESCE(auth.email(), NEW.email);
    ELSE
        NEW.role                 := OLD.role;
        NEW.roles                := OLD.roles;
        NEW.volunteer_roles      := OLD.volunteer_roles;
        NEW.is_system_volunteer  := OLD.is_system_volunteer;
        NEW.coordinator_variant  := OLD.coordinator_variant;
        NEW.coordinator_variants := OLD.coordinator_variants;
        NEW.linked_group_id      := OLD.linked_group_id;
        NEW.assigned_category    := OLD.assigned_category;
        NEW.is_active            := OLD.is_active;
        -- get_registrations_by_partner_email autoriza comparando contra
        -- users.email: si cada uno pudiera cambiarlo, podría leer las
        -- inscripciones de otra persona.
        NEW.email                := OLD.email;
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.proteger_columnas_de_rol() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS proteger_columnas_de_rol ON public.users;
CREATE TRIGGER proteger_columnas_de_rol
    BEFORE INSERT OR UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.proteger_columnas_de_rol();

-- is_admin() sostiene la política "Admins pueden ver todo" de users y miraba
-- sólo la columna singular: un SUPER_ADMIN que lo es por roles[] no podía
-- editar a otros usuarios desde el panel.
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.tiene_rol(ARRAY['SUPER_ADMIN']);
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.tiene_rol(ARRAY['SUPER_ADMIN']);
$function$;


-- ════════════════════════════════════════════════════════════════════════════
-- 2. Asignación de roles
--
-- · admin_toggle_user_role no limitaba QUÉ rol se asigna: un ADMIN_GROUPS,
--   PASTOR o ENCARGADO_GRUPOS podía darle SUPER_ADMIN a cualquiera, incluido
--   a sí mismo. Además pisaba la columna singular con roles[1] y leía roles en
--   user_role[], que explota con PRODE / ADMIN_CUIDADO_PASTORAL.
-- · admin_assign_role (4 args) leía sólo la columna singular del llamador: un
--   SUPER_ADMIN no podía asignar COORDINATOR ("No tenés permisos"), y al
--   asignar un rol pisaba el singular. Así quedó johanasute con
--   role = COORDINATOR el 13/07/2026 — la causa raíz del bug de pendientes GCX.
-- · admin_assign_role (2 args) no se usa: la app siempre manda 4. Autorizaba
--   por roles inexistentes ('ADMIN', 'SUPERADMIN') más ENCARGADO_GRUPOS, sin
--   limitar el rol asignado. Se elimina.
-- · admin_remove_role dejaba a ADMIN_GROUPS / ENCARGADO_GRUPOS quitar
--   cualquier rol, SUPER_ADMIN incluido.
--
-- Regla única para las tres: SUPER_ADMIN asigna y quita cualquier rol; los
-- admins de GCX sólo los roles de GCX. La columna singular nunca se degrada:
-- se completa sólo si estaba vacía o en VIEWER/USUARIO, y si se quita el rol
-- que tenía, pasa al primer rol válido que le quede.
-- ════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.admin_assign_role(uuid, text);

CREATE OR REPLACE FUNCTION public.admin_assign_role(target_user_id uuid, new_role text, new_variant text DEFAULT NULL::text, new_variants text[] DEFAULT NULL::text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_roles_gcx CONSTANT text[] := ARRAY['ANFITRION','CO_ANFITRION','VOLUNTARIO_GRUPOS','COORDINATOR'];
  v_valido_en_enum boolean;
BEGIN
  IF auth.uid() IS NULL OR new_role IS NULL THEN
    RAISE EXCEPTION 'No tenés permisos para asignar roles';
  END IF;

  IF public.tiene_rol(ARRAY['SUPER_ADMIN']) THEN
    NULL;
  ELSIF public.tiene_rol(ARRAY['ADMIN_GROUPS','ENCARGADO_GRUPOS']) THEN
    IF new_role <> ALL (v_roles_gcx) THEN
      RAISE EXCEPTION 'Rol fuera de tu alcance';
    END IF;
  ELSE
    RAISE EXCEPTION 'No tenés permisos para asignar roles';
  END IF;

  v_valido_en_enum := new_role = ANY (enum_range(NULL::public.user_role)::text[]);

  UPDATE users SET
    roles = array_append(array_remove(COALESCE(roles, '{}'::text[]), new_role), new_role),
    role = CASE
        WHEN v_valido_en_enum AND (role IS NULL OR role::text IN ('VIEWER','USUARIO'))
        THEN new_role::public.user_role
        ELSE role
    END,
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_remove_role(target_user_id uuid, role_to_remove text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_roles_gcx CONSTANT text[] := ARRAY['ANFITRION','CO_ANFITRION','VOLUNTARIO_GRUPOS','COORDINATOR'];
  v_new_roles text[];
  v_reemplazo text;
BEGIN
  IF auth.uid() IS NULL OR role_to_remove IS NULL THEN
    RAISE EXCEPTION 'No tienes permisos';
  END IF;

  IF public.tiene_rol(ARRAY['SUPER_ADMIN']) THEN
    NULL;
  ELSIF public.tiene_rol(ARRAY['ADMIN_GROUPS','ENCARGADO_GRUPOS']) THEN
    IF role_to_remove <> ALL (v_roles_gcx) THEN
      RAISE EXCEPTION 'Rol fuera de tu alcance';
    END IF;
  ELSE
    RAISE EXCEPTION 'No tienes permisos';
  END IF;

  UPDATE users
  SET
      roles = array_remove(roles, role_to_remove),
      coordinator_variant = CASE WHEN role_to_remove = 'COORDINATOR' THEN NULL ELSE coordinator_variant END,
      coordinator_variants = CASE WHEN role_to_remove = 'COORDINATOR' THEN '{}'::TEXT[] ELSE coordinator_variants END
  WHERE id = target_user_id
  RETURNING roles INTO v_new_roles;

  -- Comparación como texto: role_to_remove puede no existir en el enum.
  IF (SELECT role::text FROM users WHERE id = target_user_id) = role_to_remove THEN
      SELECT r INTO v_reemplazo
      FROM unnest(COALESCE(v_new_roles, '{}'::text[])) AS r
      WHERE r = ANY (enum_range(NULL::public.user_role)::text[])
      LIMIT 1;

      UPDATE users
      SET role = COALESCE(v_reemplazo, 'USUARIO')::public.user_role
      WHERE id = target_user_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_toggle_user_role(target_user_id uuid, role_to_assign text, assign boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_roles_gcx CONSTANT text[] := ARRAY['ANFITRION','CO_ANFITRION','VOLUNTARIO_GRUPOS','COORDINATOR'];
    v_role      public.user_role;
    v_roles     text[];
    v_new_roles text[];
    v_new_role  public.user_role;
BEGIN
    IF auth.uid() IS NULL OR role_to_assign IS NULL OR assign IS NULL
       OR NOT public.tiene_rol(ARRAY['SUPER_ADMIN','ADMIN_GROUPS','PASTOR','ENCARGADO_GRUPOS']) THEN
        RAISE EXCEPTION 'Not authorized to change user roles. Caller lacks required roles.';
    END IF;

    IF role_to_assign <> ALL (v_roles_gcx) AND NOT public.tiene_rol(ARRAY['SUPER_ADMIN']) THEN
        RAISE EXCEPTION 'Only SUPER_ADMIN can assign or remove the role %.', role_to_assign;
    END IF;

    SELECT role, roles INTO v_role, v_roles
    FROM public.users
    WHERE id = target_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target user not found for ID %.', target_user_id;
    END IF;

    IF v_roles IS NULL OR array_length(v_roles, 1) IS NULL THEN
        v_roles := ARRAY[COALESCE(v_role::text, 'VIEWER')];
    END IF;

    IF assign THEN
        v_new_roles := CASE WHEN role_to_assign = ANY (v_roles)
                            THEN v_roles
                            ELSE array_append(v_roles, role_to_assign) END;
    ELSE
        v_new_roles := array_remove(v_roles, role_to_assign);
    END IF;

    IF array_length(v_new_roles, 1) IS NULL THEN
        v_new_roles := ARRAY['VIEWER'];
    END IF;

    v_new_role := v_role;
    IF assign THEN
        IF (v_role IS NULL OR v_role::text IN ('VIEWER','USUARIO'))
           AND role_to_assign = ANY (enum_range(NULL::public.user_role)::text[]) THEN
            v_new_role := role_to_assign::public.user_role;
        END IF;
    ELSIF v_role IS NULL OR v_role::text = role_to_assign THEN
        SELECT r::public.user_role INTO v_new_role
        FROM unnest(v_new_roles) AS r
        WHERE r = ANY (enum_range(NULL::public.user_role)::text[])
        LIMIT 1;
        v_new_role := COALESCE(v_new_role, 'VIEWER');
    END IF;

    UPDATE public.users
    SET role = v_new_role,
        roles = v_new_roles
    WHERE id = target_user_id;

    RETURN TRUE;
END;
$function$;


-- ════════════════════════════════════════════════════════════════════════════
-- 3. GCX: RPC que autorizaban de más, de menos, o explotaban
--
-- · manage_group_registration_v3 dejaba aprobar/rechazar inscripciones de
--   CUALQUIER grupo a quien tuviera rol singular ANFITRION, CO_ANFITRION o
--   VOLUNTARIO_GRUPOS, y a la vez un co-anfitrión real no podía gestionar las
--   de su propio grupo si su rol singular era otro. Tampoco validaba p_status
--   (la app sólo manda APPROVED y REJECTED).
-- · bulk_remove_group_members dejaba a cualquier CO_ANFITRION borrar
--   inscriptos de cualquier grupo, y a un anfitrión le validaba sólo el grupo
--   del PRIMER id: podía borrar de otros grupos agregando ids después.
-- · toggle_group_capacity_lock, toggle_group_visibility y admin_delete_group
--   leían roles en user_role[]: explotan con PRODE / ADMIN_CUIDADO_PASTORAL.
-- · admin_delete_group exigía SUPER_ADMIN, pero la app ofrece "Eliminar" a
--   SUPER_ADMIN, ADMIN_GROUPS y ENCARGADO_GRUPOS (rutas de /admingcx) y la
--   política groups_delete_admin de la tabla también se lo permite. Se alinea
--   con lo que muestra la app.  ← DECISIÓN: revisar antes de aplicar.
-- ════════════════════════════════════════════════════════════════════════════

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

CREATE OR REPLACE FUNCTION public.bulk_remove_group_members(p_registration_ids text[])
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_ajenas INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Access Denied: You do not have permission to remove these members.';
    END IF;

    IF p_registration_ids IS NULL OR array_length(p_registration_ids, 1) IS NULL THEN
        RETURN TRUE;
    END IF;

    -- Se valida CADA inscripción contra su propio grupo, no sólo la primera.
    IF NOT public.tiene_rol(ARRAY['SUPER_ADMIN', 'ADMIN_GROUPS', 'ENCARGADO_GRUPOS', 'PASTOR']) THEN
        SELECT count(*) INTO v_ajenas
        FROM group_registrations r
        LEFT JOIN groups g ON g.id = r.group_id
        WHERE r.id = ANY (p_registration_ids)
          AND NOT (COALESCE(g.host_id = auth.uid(), false)
                OR COALESCE(g.co_host_id = auth.uid(), false));

        IF v_ajenas > 0 THEN
            RAISE EXCEPTION 'Access Denied: You do not have permission to remove these members.';
        END IF;
    END IF;

    WITH deleted_rows AS (
        DELETE FROM group_registrations
        WHERE id = ANY (p_registration_ids)
        RETURNING group_id, status
    ),
    group_counts AS (
        SELECT group_id, count(*) AS removed_count
        FROM deleted_rows
        WHERE status = 'APPROVED'
        GROUP BY group_id
    )
    UPDATE groups g
    SET members_count = GREATEST(0, COALESCE(g.members_count, 0) - gc.removed_count)
    FROM group_counts gc
    WHERE g.id = gc.group_id;

    RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_group_capacity_lock(p_group_id text, p_locked boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_host_id UUID;
    v_co_host_id UUID;
BEGIN
    SELECT host_id, co_host_id INTO v_host_id, v_co_host_id
    FROM public.groups WHERE id = p_group_id;

    IF auth.uid() IS NULL OR NOT (
           public.tiene_rol(ARRAY['SUPER_ADMIN', 'ADMIN_GROUPS', 'ENCARGADO_GRUPOS'])
        OR COALESCE(auth.uid() = v_host_id, false)
        OR COALESCE(auth.uid() = v_co_host_id, false)
    ) THEN
        RAISE EXCEPTION 'No tenés permisos para modificar este grupo';
    END IF;

    UPDATE public.groups
    SET capacity_locked = p_locked
    WHERE id = p_group_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_group_visibility(p_group_id text, p_hidden boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF auth.uid() IS NULL OR NOT public.tiene_rol(ARRAY['SUPER_ADMIN', 'ADMIN_GROUPS', 'ENCARGADO_GRUPOS']) THEN
        RAISE EXCEPTION 'No tenés permisos para ocultar este grupo';
    END IF;

    UPDATE public.groups
    SET is_hidden = p_hidden
    WHERE id = p_group_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_group(p_group_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.tiene_rol(ARRAY['SUPER_ADMIN', 'ADMIN_GROUPS', 'ENCARGADO_GRUPOS']) THEN
    RAISE EXCEPTION 'Unauthorized: GCX admin role required';
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
$function$;


-- ════════════════════════════════════════════════════════════════════════════
-- 4. Notificaciones de GCX a los admins
--
-- notify_admins_on_new_group y notify_host_on_status_change elegían a quién
-- avisar con WHERE role IN (...), sólo la columna singular: los admins que lo
-- son por roles[] no recibían "Nueva solicitud de grupo" ni "Grupo
-- re-enviado". Tampoco incluían a ENCARGADO_GRUPOS, que revisa grupos.
-- Sólo cambia esa consulta; el resto de cada función queda idéntico.
-- ════════════════════════════════════════════════════════════════════════════

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
            WHERE role::text IN ('SUPER_ADMIN', 'ADMIN_GROUPS', 'ENCARGADO_GRUPOS', 'PASTOR')
               OR COALESCE(roles, '{}') && ARRAY['SUPER_ADMIN', 'ADMIN_GROUPS', 'ENCARGADO_GRUPOS', 'PASTOR']
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
                ARRAY['SUPER_ADMIN', 'ADMIN_GROUPS', 'ENCARGADO_GRUPOS', 'PASTOR']::TEXT[],
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
$function$;

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
                WHERE role::text IN ('SUPER_ADMIN', 'ADMIN_GROUPS', 'ENCARGADO_GRUPOS', 'PASTOR')
               OR COALESCE(roles, '{}') && ARRAY['SUPER_ADMIN', 'ADMIN_GROUPS', 'ENCARGADO_GRUPOS', 'PASTOR']
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
                    ARRAY['SUPER_ADMIN', 'ADMIN_GROUPS', 'ENCARGADO_GRUPOS', 'PASTOR']::TEXT[],
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
$function$;


-- ════════════════════════════════════════════════════════════════════════════
-- 5. group_dropout_requests: quienes la app manda a ver bajas no las veían
--
-- Sólo SUPER_ADMIN y ADMIN_GROUPS pasaban. Pero:
-- · /admingcx/gestion-de-grupos/bajas deja entrar a ENCARGADO_GRUPOS;
-- · el panel de coordinadores muestra las bajas de su categoría (COORDINATOR);
-- · /reportes las usa para PASTOR, REPORTES, ENCARGADO_PUNTO y ADMIN_PUNTO.
-- A todos ellos la sección les aparecía vacía, sin error.
-- Gestionar queda para los admins de GCX; el resto, sólo lectura.
-- ════════════════════════════════════════════════════════════════════════════

ALTER POLICY admins_manage_requests ON public.group_dropout_requests
  USING (public.tiene_rol(ARRAY['SUPER_ADMIN', 'ADMIN_GROUPS', 'ENCARGADO_GRUPOS']));

DROP POLICY IF EXISTS dropout_requests_lectura_supervision ON public.group_dropout_requests;
CREATE POLICY dropout_requests_lectura_supervision ON public.group_dropout_requests
  FOR SELECT TO authenticated
  USING (public.tiene_rol(ARRAY['PASTOR', 'COORDINATOR', 'REPORTES', 'ENCARGADO_PUNTO', 'ADMIN_PUNTO']));


-- ════════════════════════════════════════════════════════════════════════════
-- 6. app_config: cualquiera podía reescribir la configuración de la app
--
-- "Public Access Config" era FOR ALL a PUBLIC con USING (true): sin iniciar
-- sesión, con la clave pública del bundle, se podía modificar o borrar la
-- configuración global (banners de inicio, temporadas de GCX, Prode, Día del
-- Padre…). Las otras dos políticas dejaban lo mismo a cualquier usuario con
-- sesión.
--
-- La lectura pública ("Public read access") se mantiene: la home la necesita.
-- Escriben en Supabase (saveAppConfig) sólo estas pantallas:
--   Administrador ............ SUPER_ADMIN
--   Configuración, Temporadas  SUPER_ADMIN, ADMIN_GROUPS
--   Grupos (vista admin) ..... SUPER_ADMIN, ADMIN_GROUPS, ENCARGADO_GRUPOS
--   Día del Padre ............ SUPER_ADMIN, PASTOR, ENCARGADO_EVENTOS
--   Prode .................... SUPER_ADMIN, PASTOR, PRODE
--   Tienda ................... ADMIN_STORE
-- (Home y Alabanza llaman db.saveAppConfig, que es localStorage.)
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Public Access Config" ON public.app_config;
DROP POLICY IF EXISTS "Allow All Authenticated" ON public.app_config;
DROP POLICY IF EXISTS "Authenticated update access" ON public.app_config;

DROP POLICY IF EXISTS app_config_escritura_admins ON public.app_config;
CREATE POLICY app_config_escritura_admins ON public.app_config
  FOR ALL TO authenticated
  USING (public.tiene_rol(ARRAY['SUPER_ADMIN', 'ADMIN_GROUPS', 'ENCARGADO_GRUPOS', 'PASTOR', 'ENCARGADO_EVENTOS', 'PRODE', 'ADMIN_STORE']))
  WITH CHECK (public.tiene_rol(ARRAY['SUPER_ADMIN', 'ADMIN_GROUPS', 'ENCARGADO_GRUPOS', 'PASTOR', 'ENCARGADO_EVENTOS', 'PRODE', 'ADMIN_STORE']));


-- ════════════════════════════════════════════════════════════════════════════
-- 7. welcome_visitors: datos de las personas que llegan, legibles por cualquiera
--
-- welcome_visitors_public_search (SELECT a anon, USING true) exponía los 77
-- registros completos a quien tuviera la clave pública: nombre, teléfono,
-- email, edad, localidad, pedido de oración, si aceptó a Jesús. Verificado
-- con una consulta de conteo como anon el 13/09/2026. Además, "Enable all
-- access for authenticated users" dejaba leer, editar y borrar todo a
-- cualquier usuario con sesión.
--
-- La política pública existía para el formulario /form: busca a la persona
-- con search_welcome_visitor (SECURITY INVOKER, así que corre con los
-- permisos de anon), recibe los TELÉFONOS de todos los homónimos y compara en
-- el navegador. Esta función hace búsqueda y guardado en el servidor, con la
-- misma regla de coincidencia (nombre y apellido sin espacios ni mayúsculas,
-- y los últimos N ≥ 8 dígitos del teléfono), y el teléfono nunca sale.
--
-- Devuelve:
--   OK             encontrado y guardado
--   YA_PROCESADO   encontrado, pero el equipo ya avanzó su etapa; no se toca.
--                  Antes el UPDATE afectaba 0 filas y la app mostraba éxito:
--                  se conserva esa experiencia sin escribir nada.
--   NO_ENCONTRADO  no hay coincidencia
--
-- Las políticas públicas se eliminan en ..._cierre_bienvenida.sql, después
-- de desplegar el frontend que usa esta función.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.completar_formulario_bienvenida(
    p_first_name     text,
    p_last_name      text,
    p_phone          text,
    p_email          text,
    p_experience     text,
    p_is_first_time  boolean,
    p_interest_areas text[],
    p_prayer_request text
)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_tel   text := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
    v_id    uuid;
    v_stage public.visitor_stage;
BEGIN
    IF length(v_tel) < 8
       OR btrim(COALESCE(p_first_name, '')) = ''
       OR btrim(COALESCE(p_last_name, '')) = '' THEN
        RETURN 'NO_ENCONTRADO';
    END IF;

    SELECT c.id, c.stage INTO v_id, v_stage
    FROM (
        SELECT wv.id, wv.stage, wv.created_at,
               regexp_replace(COALESCE(wv.phone, ''), '\D', '', 'g') AS tel
        FROM public.welcome_visitors wv
        WHERE lower(btrim(wv.first_name)) = lower(btrim(p_first_name))
          AND lower(btrim(wv.last_name))  = lower(btrim(p_last_name))
    ) c
    WHERE least(length(c.tel), length(v_tel)) >= 8
      AND right(c.tel, least(length(c.tel), length(v_tel)))
        = right(v_tel, least(length(c.tel), length(v_tel)))
    ORDER BY c.created_at DESC
    LIMIT 1;

    IF v_id IS NULL THEN
        RETURN 'NO_ENCONTRADO';
    END IF;

    IF v_stage NOT IN ('NEW', 'FILLED_FORM') THEN
        RETURN 'YA_PROCESADO';
    END IF;

    UPDATE public.welcome_visitors
    SET email                  = p_email,
        experience_description = p_experience,
        stage                  = 'FILLED_FORM',
        is_first_time          = COALESCE(p_is_first_time, false),
        interest_areas         = p_interest_areas,
        prayer_request         = p_prayer_request
    WHERE id = v_id;

    RETURN 'OK';
END;
$function$;

REVOKE ALL ON FUNCTION public.completar_formulario_bienvenida(text, text, text, text, text, boolean, text[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.completar_formulario_bienvenida(text, text, text, text, text, boolean, text[], text) TO anon, authenticated;

-- Staff: sólo el equipo de Bienvenida (rutas /bienvenida). La pantalla de
-- bienvenida dentro de punto-informacion no se importa en ningún lado.
ALTER POLICY "Enable all access for authenticated users" ON public.welcome_visitors
  RENAME TO welcome_visitors_equipo_bienvenida;
ALTER POLICY welcome_visitors_equipo_bienvenida ON public.welcome_visitors
  USING (public.tiene_rol(ARRAY['SUPER_ADMIN', 'ENCARGADO_BIENVENIDA', 'VOLUNTARIO_BIENVENIDA']))
  WITH CHECK (public.tiene_rol(ARRAY['SUPER_ADMIN', 'ENCARGADO_BIENVENIDA', 'VOLUNTARIO_BIENVENIDA']));


-- ════════════════════════════════════════════════════════════════════════════
-- 8. Permisos de ejecución
-- ════════════════════════════════════════════════════════════════════════════

-- get_couple_registration_status no se usa en la app y, sin chequeo alguno,
-- devolvía a cualquiera (incluso sin sesión) el estado de inscripción de un
-- usuario o email en un grupo.
REVOKE EXECUTE ON FUNCTION public.get_couple_registration_status(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

-- Estas tres eran ejecutables por anon. Nunca deben serlo.
REVOKE EXECUTE ON FUNCTION public.bulk_remove_group_members(text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.toggle_group_capacity_lock(text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.toggle_group_visibility(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_remove_group_members(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_group_capacity_lock(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_group_visibility(text, boolean) TO authenticated;

-- Se reafirman las de las funciones reescritas (CREATE OR REPLACE ya las
-- conserva; así el archivo es autosuficiente).
REVOKE EXECUTE ON FUNCTION public.admin_assign_role(uuid, text, text, text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_remove_role(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_toggle_user_role(uuid, text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.manage_group_registration_v3(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_group(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_role(uuid, text, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_user_role(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manage_group_registration_v3(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_group(text) TO authenticated;

-- is_admin() y check_is_super_admin() quedan ejecutables por anon a
-- propósito: la política "Admins pueden ver todo" de users aplica a PUBLIC y
-- se evalúa también en requests sin sesión (devuelve false).
