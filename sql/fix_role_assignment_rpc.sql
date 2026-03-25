CREATE OR REPLACE FUNCTION admin_assign_role(target_user_id UUID, new_role TEXT, new_variant TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  -- Verificar si el usuario que ejecuta tiene permisos
  SELECT role INTO v_caller_role FROM users WHERE id = auth.uid();

  IF v_caller_role IN ('ADMIN', 'SUPER_ADMIN', 'SUPERADMIN', 'ENCARGADO_GRUPOS', 'ADMIN_GROUPS') THEN
    -- Realizar el UPDATE en la tabla users
    UPDATE users 
    SET 
        role = new_role::public.user_role,
        -- Asegurar que el array roles también lo contenga
        roles = array_append(array_remove(roles, new_role), new_role),
        coordinator_variant = COALESCE(new_variant, coordinator_variant)
    WHERE id = target_user_id;
  ELSE
    RAISE EXCEPTION 'No tienes permisos';
  END IF;
END;
$$;
