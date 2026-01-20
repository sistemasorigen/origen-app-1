-- ==============================================================================
-- MIGRATION: Rename LEADER role to ANFITRION
-- ==============================================================================
-- IMPORTANT: Execute these steps SEPARATELY (not in same transaction)
-- ==============================================================================

-- ==============================================================================
-- STEP 1: Add ANFITRION value to the user_role enum
-- (Run this FIRST, by itself)
-- ==============================================================================
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ANFITRION';

-- ==============================================================================
-- STEP 2: Update existing users (Run AFTER Step 1 completes)
-- ==============================================================================
-- UPDATE public.users SET role = 'ANFITRION' WHERE role = 'LEADER';

-- ==============================================================================
-- STEP 3: RLS Policies (Run AFTER Step 2)
-- ==============================================================================
-- DROP POLICY IF EXISTS "Anfitriones can create groups" ON public.groups;
-- CREATE POLICY "Anfitriones can create groups" ON public.groups
-- FOR INSERT WITH CHECK (
--   EXISTS (
--     SELECT 1 FROM public.users 
--     WHERE id = auth.uid() 
--     AND role IN ('ANFITRION', 'ADMIN_GROUPS', 'SUPER_ADMIN')
--   )
-- );
