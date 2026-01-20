-- =====================================================
-- FIX: Allow partners to see their group registrations
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Ensure SELECT policy allows both main user AND partner user
DROP POLICY IF EXISTS "Allow authenticated to view own registrations" ON group_registrations;

CREATE POLICY "Allow authenticated to view own registrations" ON group_registrations
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id OR 
        auth.uid() = partner_user_id
    );

-- 2. Grant permissions just in case
GRANT SELECT ON group_registrations TO authenticated;

-- 3. Verification output
SELECT 'Partner visibility policy applied successfully' as status;
