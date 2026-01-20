-- ================================================
-- Enhanced Couples Registration: Partner User Linking
-- Run in Supabase SQL Editor
-- ================================================

-- 1. Add partner_user_id column to link partner's account
ALTER TABLE public.group_registrations 
ADD COLUMN IF NOT EXISTS partner_user_id UUID REFERENCES public.users(id);

-- 2. Add comment for documentation
COMMENT ON COLUMN public.group_registrations.partner_user_id IS 
'Links to partner user account if they have one in the system';

-- 3. Verify columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'group_registrations' 
AND column_name IN ('partner_data', 'partner_user_id');
