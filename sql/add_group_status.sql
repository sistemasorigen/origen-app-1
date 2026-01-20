-- ============================================
-- GROUP APPROVAL WORKFLOW - Status Column & RLS
-- ============================================
-- Run this script in Supabase SQL Editor

-- 1. Add status column to groups table
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' 
CHECK (status IN ('pending', 'approved', 'rejected'));

-- 1b. Add admin_note column for review feedback
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS admin_note TEXT;

-- 2. Update existing groups to 'approved' (so they remain visible)
-- OPTIONAL: Comment this out if you want existing groups to require approval
UPDATE groups SET status = 'approved' WHERE status IS NULL OR status = 'pending';

-- 3. Drop existing RLS policies on groups (we'll recreate them)
DROP POLICY IF EXISTS "Public can read approved groups" ON groups;
DROP POLICY IF EXISTS "Anyone can read groups" ON groups;
DROP POLICY IF EXISTS "Authenticated users can read groups" ON groups;
DROP POLICY IF EXISTS "Enable read access for all users" ON groups;
DROP POLICY IF EXISTS "Admins can manage groups" ON groups;
DROP POLICY IF EXISTS "Hosts can manage own groups" ON groups;
DROP POLICY IF EXISTS "Users can insert groups" ON groups;
DROP POLICY IF EXISTS "Users can update groups" ON groups;
DROP POLICY IF EXISTS "Users can delete groups" ON groups;

-- 4. Enable RLS (if not already)
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- 5. Create new RLS policies

-- 5a. Public read: Only approved groups (for anonymous/public users)
CREATE POLICY "Public can read approved groups"
ON groups FOR SELECT
USING (status = 'approved');

-- 5b. Admins can read ALL groups (for moderation)
CREATE POLICY "Admins can read all groups"
ON groups FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('SUPER_ADMIN', 'ADMIN_GROUPS', 'PASTOR')
  )
);

-- 5c. Hosts can read their own groups (regardless of status)
CREATE POLICY "Hosts can read own groups"
ON groups FOR SELECT
TO authenticated
USING (
  host_id = auth.uid()
);

-- 5d. Authenticated users can insert groups (will default to 'pending')
CREATE POLICY "Authenticated users can insert groups"
ON groups FOR INSERT
TO authenticated
WITH CHECK (true);

-- 5e. Admins can update any group (for approval/rejection)
CREATE POLICY "Admins can update groups"
ON groups FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('SUPER_ADMIN', 'ADMIN_GROUPS', 'PASTOR')
  )
);

-- 5f. Hosts can update their own groups
CREATE POLICY "Hosts can update own groups"
ON groups FOR UPDATE
TO authenticated
USING (host_id = auth.uid());

-- 5g. Admins can delete groups
CREATE POLICY "Admins can delete groups"
ON groups FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('SUPER_ADMIN', 'ADMIN_GROUPS', 'PASTOR')
  )
);

-- 5h. Hosts can delete their own groups
CREATE POLICY "Hosts can delete own groups"
ON groups FOR DELETE
TO authenticated
USING (host_id = auth.uid());

-- 6. Create an index for faster status filtering
CREATE INDEX IF NOT EXISTS idx_groups_status ON groups(status);

-- Done! Groups now have a status column and proper RLS policies.
