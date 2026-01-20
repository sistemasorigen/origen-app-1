-- =====================================================
-- FIX: Change category_id from UUID to TEXT
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Drop the foreign key constraint if it exists
ALTER TABLE groups 
DROP CONSTRAINT IF EXISTS groups_category_id_fkey;

-- 2. Change the column type from UUID to TEXT
ALTER TABLE groups 
ALTER COLUMN category_id TYPE TEXT USING category_id::TEXT;

-- 3. Also ensure group_categories.id is TEXT (if not already)
-- First, check if there are any foreign key constraints
ALTER TABLE group_categories 
ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- 4. Recreate the foreign key if needed (optional, but recommended)
-- ALTER TABLE groups
-- ADD CONSTRAINT groups_category_id_fkey 
-- FOREIGN KEY (category_id) REFERENCES group_categories(id);

-- 5. Verify the change
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'groups' AND column_name = 'category_id';

SELECT 'Column type changed to TEXT successfully!' as status;
