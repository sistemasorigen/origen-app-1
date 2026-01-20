-- ==============================================================================
-- MIGRATION: Add host_id to groups table for Anfitrión ownership
-- ==============================================================================
-- Purpose: Allow Anfitrión users to own and manage their own groups
-- ==============================================================================

-- 1. Add host_id column to groups table (references auth.users)
ALTER TABLE groups ADD COLUMN IF NOT EXISTS host_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Update RLS: Only Anfitrión (or higher) can INSERT groups
DROP POLICY IF EXISTS "Allow auth insert groups" ON groups;
DROP POLICY IF EXISTS "Anfitriones can create groups" ON groups;

CREATE POLICY "Anfitriones can create groups" ON groups
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('ANFITRION', 'ADMIN_GROUPS', 'SUPER_ADMIN')
  )
);

-- 3. Anfitriones can UPDATE only their own groups
DROP POLICY IF EXISTS "Allow auth update groups" ON groups;
DROP POLICY IF EXISTS "Anfitriones manage own groups" ON groups;

CREATE POLICY "Anfitriones manage own groups" ON groups
FOR UPDATE TO authenticated
USING (
  host_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('ADMIN_GROUPS', 'SUPER_ADMIN')
  )
);

-- 4. Anfitriones can DELETE only their own groups
DROP POLICY IF EXISTS "Allow auth delete groups" ON groups;
DROP POLICY IF EXISTS "Anfitriones delete own groups" ON groups;

CREATE POLICY "Anfitriones delete own groups" ON groups
FOR DELETE TO authenticated
USING (
  host_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('ADMIN_GROUPS', 'SUPER_ADMIN')
  )
);

-- 5. Keep SELECT public (all can view)
-- (Already exists: "Allow public read groups")

-- ==============================================================================
-- VERIFY
-- ==============================================================================
SELECT 'Host ownership system added to groups!' as status;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'groups' AND column_name = 'host_id';
