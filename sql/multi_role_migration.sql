-- ==============================================================================
-- MIGRATION: Multi-Role Authorization System
-- ==============================================================================
-- This migration adds support for users having multiple roles simultaneously.
-- The new `roles` column (text[]) will store an array of role strings.
-- The existing `role` column is kept for backward compatibility.
-- ==============================================================================

-- Step 1: Add the new roles column (text array)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS roles text[] DEFAULT ARRAY[]::text[];

-- Step 2: Migrate existing role data to the new roles array
-- Each user's current single role becomes the first element of their roles array
UPDATE public.users 
SET roles = ARRAY[role::text]
WHERE roles = '{}' OR roles IS NULL;

-- Step 3: Create a helper function to check if user has a role
CREATE OR REPLACE FUNCTION public.user_has_role(user_id UUID, required_role TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_roles TEXT[];
BEGIN
  SELECT roles INTO user_roles FROM public.users WHERE id = user_id;
  
  -- SUPER_ADMIN always has access
  IF 'SUPER_ADMIN' = ANY(user_roles) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if required role is in the array
  RETURN required_role = ANY(user_roles);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create a function to check multiple roles (any match)
CREATE OR REPLACE FUNCTION public.user_has_any_role(user_id UUID, required_roles TEXT[])
RETURNS BOOLEAN AS $$
DECLARE
  user_roles TEXT[];
BEGIN
  SELECT roles INTO user_roles FROM public.users WHERE id = user_id;
  
  -- SUPER_ADMIN always has access
  IF 'SUPER_ADMIN' = ANY(user_roles) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if any required role is in the array
  RETURN user_roles && required_roles;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.user_has_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_any_role TO authenticated;

-- Step 6: Verify migration
SELECT 'Migration complete!' as status;
SELECT id, name, role, roles FROM public.users LIMIT 5;
