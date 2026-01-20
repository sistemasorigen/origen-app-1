-- ==============================================================================
-- MIGRATION: Upgrade Group Registrations (V3)
-- ==============================================================================

-- 1. Create Status Enum if it doesn't exist (using checks for portability or proper ENUM)
-- We'll use a text check constraint for simplicity in this migration, compatible with existing enum types if we reuse them.
-- But let's check if we want a specific enum. Let's use TEXT with CHECK Constraint for 'registration_status'.

ALTER TABLE group_registrations 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING' 
CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'));

-- 2. Add User ID Link (for linking to auth.users / public.users)
ALTER TABLE group_registrations 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 3. Update existing records
-- Set default status to PENDING for any nulls (though default handles new ones)
UPDATE group_registrations SET status = 'PENDING' WHERE status IS NULL;

-- 4. Verify
SELECT 'Group Registrations table upgraded successfully!' as status;
