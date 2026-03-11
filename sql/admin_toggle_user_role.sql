-- =================================================================================
-- RPC: admin_toggle_user_role
-- Agrega o quita un rol de un usuario especificado, saltando RLS verificando
-- internamente los privilegios del ejecutante (caller).
-- =================================================================================

CREATE OR REPLACE FUNCTION public.admin_toggle_user_role(
    target_user_id UUID,
    role_to_assign TEXT,
    assign BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Ejecuta con privilegios del dueño (bypass RLS)
SET search_path = public
AS $$
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
$$;
