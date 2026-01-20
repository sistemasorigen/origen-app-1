-- =====================================================
-- Lock-on-Approval RLS Policy for Groups
-- Prevents Hosts from editing approved groups
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. DROP existing overly permissive update policy
DROP POLICY IF EXISTS "Allow authenticated to update groups" ON groups;

-- 2. CREATE new restrictive UPDATE policy for Hosts
-- Logic: 
--   a) Admins (super_admin, admin_groups) can update any group
--   b) Hosts (anfitrion) can ONLY update their own groups IF status != 'approved'
CREATE POLICY "Restricted group updates - lock on approval" ON groups
    FOR UPDATE 
    TO authenticated 
    USING (
        -- Check if user is admin (can update anything)
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('SUPER_ADMIN', 'ADMIN_GROUPS')
        )
        OR
        -- Check if user is the host AND group is NOT approved
        (
            host_id = auth.uid() 
            AND (status IS NULL OR status != 'approved')
        )
    )
    WITH CHECK (
        -- Same logic for the new row state
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('SUPER_ADMIN', 'ADMIN_GROUPS')
        )
        OR
        (
            host_id = auth.uid() 
            AND (status IS NULL OR status != 'approved')
        )
    );

-- 3. Verify policy was created
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd
FROM pg_policies 
WHERE tablename = 'groups' AND cmd = 'UPDATE';

-- Success message
SELECT 'Lock-on-Approval policy created. Hosts cannot edit approved groups.' as status;
