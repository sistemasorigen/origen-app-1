-- =====================================================
-- FIX: Enable INSERT/UPDATE operations for Groups module
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. GROUPS TABLE: Allow authenticated users to manage groups
DROP POLICY IF EXISTS "Allow authenticated to insert groups" ON groups;
DROP POLICY IF EXISTS "Allow authenticated to update groups" ON groups;
DROP POLICY IF EXISTS "Allow authenticated to delete groups" ON groups;

CREATE POLICY "Allow authenticated to insert groups" ON groups
    FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated to update groups" ON groups
    FOR UPDATE 
    TO authenticated 
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete groups" ON groups
    FOR DELETE 
    TO authenticated 
    USING (true);

-- 2. GROUP_CATEGORIES TABLE: Allow authenticated users to manage categories
DROP POLICY IF EXISTS "Allow authenticated to insert categories" ON group_categories;
DROP POLICY IF EXISTS "Allow authenticated to update categories" ON group_categories;
DROP POLICY IF EXISTS "Allow authenticated to delete categories" ON group_categories;

CREATE POLICY "Allow authenticated to insert categories" ON group_categories
    FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated to update categories" ON group_categories
    FOR UPDATE 
    TO authenticated 
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete categories" ON group_categories
    FOR DELETE 
    TO authenticated 
    USING (true);

-- 3. GROUP_TAGS TABLE: Allow authenticated users to manage tags
DROP POLICY IF EXISTS "Allow authenticated to insert tags" ON group_tags;
DROP POLICY IF EXISTS "Allow authenticated to update tags" ON group_tags;
DROP POLICY IF EXISTS "Allow authenticated to delete tags" ON group_tags;

CREATE POLICY "Allow authenticated to insert tags" ON group_tags
    FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated to update tags" ON group_tags
    FOR UPDATE 
    TO authenticated 
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete tags" ON group_tags
    FOR DELETE 
    TO authenticated 
    USING (true);

-- 4. GROUP_REGISTRATIONS TABLE: Allow authenticated users to register
DROP POLICY IF EXISTS "Allow authenticated to insert registrations" ON group_registrations;
DROP POLICY IF EXISTS "Allow authenticated to update registrations" ON group_registrations;

CREATE POLICY "Allow authenticated to insert registrations" ON group_registrations
    FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated to update registrations" ON group_registrations
    FOR UPDATE 
    TO authenticated 
    USING (true)
    WITH CHECK (true);

-- Also allow anonymous users to register (public signup)
DROP POLICY IF EXISTS "Allow anon to insert registrations" ON group_registrations;

CREATE POLICY "Allow anon to insert registrations" ON group_registrations
    FOR INSERT 
    TO anon 
    WITH CHECK (true);

-- 5. Ensure RLS is enabled on all tables
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_registrations ENABLE ROW LEVEL SECURITY;

-- 6. Grant necessary permissions
GRANT ALL ON groups TO authenticated;
GRANT ALL ON group_categories TO authenticated;
GRANT ALL ON group_tags TO authenticated;
GRANT ALL ON group_registrations TO authenticated;
GRANT ALL ON group_registrations TO anon;

-- 7. Verify with SELECT (check these exist)
SELECT 'Policies created successfully. Tables ready for CRUD operations.' as status;
