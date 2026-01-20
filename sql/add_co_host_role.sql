-- =============================================================================
-- CO-HOST ROLE MIGRATION
-- Adds CO_ANFITRION role and co_host_id column to groups table
-- =============================================================================

-- 1. Add CO_ANFITRION to user_role enum (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'CO_ANFITRION' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
    ) THEN
        ALTER TYPE user_role ADD VALUE 'CO_ANFITRION';
    END IF;
END$$;

-- 2. Add co_host_id column to groups table (nullable, FK to users)
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS co_host_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- 3. Create index for faster lookups on co_host_id
CREATE INDEX IF NOT EXISTS idx_groups_co_host_id ON public.groups(co_host_id);

-- 4. Update RLS policy to allow co-hosts to manage their groups
-- Drop existing policy if it exists and recreate with co-host support
DROP POLICY IF EXISTS "Hosts can update their own groups" ON public.groups;

CREATE POLICY "Hosts and Co-Hosts can update their groups"
ON public.groups
FOR UPDATE
USING (
    host_id = auth.uid() 
    OR co_host_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('SUPER_ADMIN', 'ADMIN_GROUPS', 'PASTOR')
    )
);

-- 5. Update SELECT policy to include co-hosts
DROP POLICY IF EXISTS "Hosts can view their own groups" ON public.groups;

CREATE POLICY "Hosts and Co-Hosts can view their groups"
ON public.groups
FOR SELECT
USING (
    host_id = auth.uid() 
    OR co_host_id = auth.uid()
    OR status = 'approved'
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('SUPER_ADMIN', 'ADMIN_GROUPS', 'PASTOR')
    )
);

-- Verify the migration
SELECT 'CO_ANFITRION role and co_host_id column added successfully' as status;
