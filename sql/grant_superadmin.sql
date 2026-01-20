-- ==============================================================================
-- GRANT SUPER ADMIN ROLE
-- ==============================================================================
-- This script updates the role of a specific user to 'SUPER_ADMIN'.

UPDATE public.users
SET role = 'SUPER_ADMIN'
WHERE email = 'nachoqueipo27@gmail.com';

-- Verify the change (Output should show the user with the new role)
SELECT id, email, role FROM public.users WHERE email = 'nachoqueipo27@gmail.com';
