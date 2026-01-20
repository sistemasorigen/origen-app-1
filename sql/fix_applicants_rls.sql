-- 1. Ensure user_id column exists
ALTER TABLE group_registrations 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. Enable RLS
ALTER TABLE group_registrations ENABLE ROW LEVEL SECURITY;

-- 3. Drop potential conflicting policies (cleaning up previous attempts)
DROP POLICY IF EXISTS "Hosts can update registrations" ON group_registrations;
DROP POLICY IF EXISTS "Admins can update registrations" ON group_registrations;
DROP POLICY IF EXISTS "Hosts and Admins can update registrations" ON group_registrations;
DROP POLICY IF EXISTS "Read registrations" ON group_registrations;
DROP POLICY IF EXISTS "Hosts view registrations" ON group_registrations;

-- 4. Create comprehensive Update Policy
CREATE POLICY "Hosts and Admins can update registrations" 
ON group_registrations 
FOR UPDATE 
TO authenticated 
USING (
  -- User is the Host of the group
  (SELECT host_id FROM groups WHERE id = group_registrations.group_id) = auth.uid()
  OR 
  -- User is an Admin
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('SUPER_ADMIN', 'ADMIN_GROUPS')
);

-- 5. Create comprehensive Select Policy
CREATE POLICY "Read registrations"
ON group_registrations
FOR SELECT
TO authenticated
USING (
    -- Own registration (linked by ID)
    (user_id = auth.uid())
    OR
    -- Email match (legacy/guest fallback)
    (email = (select email from auth.users where id = auth.uid()))
    OR
    -- Host of the group
    (SELECT host_id FROM groups WHERE id = group_registrations.group_id) = auth.uid()
    OR
    -- Admin
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('SUPER_ADMIN', 'ADMIN_GROUPS')
);
