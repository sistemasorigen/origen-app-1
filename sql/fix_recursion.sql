-- ==============================================================================
-- FIX INFINITE RECURSION IN RLS
-- ==============================================================================
-- This script fixes the "infinite recursion detected in policy" error.
-- The error happens because the 'Admins view all users' policy queries the 'users' table,
-- which triggers the policy again in a loop.
-- Solution: Use a SECURITY DEFINER function to check the role safely.

-- 1. Create a secure function to check if user is Admin
--    SECURITY DEFINER means it runs with the privileges of the creator (postgres/admin),
--    bypassing RLS on the table itself for this specific check.
CREATE OR REPLACE FUNCTION public.check_is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'SUPER_ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop the recursive policy
DROP POLICY IF EXISTS "Admins view all users" ON public.users;

-- 3. Re-create the policy using the safe function
CREATE POLICY "Admins view all users" ON public.users 
FOR SELECT USING (
  public.check_is_super_admin()
);
