-- ==============================================================================
-- MIGRATION: Upgrade Groups Table with Advanced Fields
-- ==============================================================================

-- 1. Add Co-Host Fields
ALTER TABLE groups ADD COLUMN IF NOT EXISTS co_host_first_name TEXT DEFAULT '';
ALTER TABLE groups ADD COLUMN IF NOT EXISTS co_host_last_name TEXT DEFAULT '';

-- 2. Add Demographic Restrictions
ALTER TABLE groups ADD COLUMN IF NOT EXISTS max_age INTEGER DEFAULT 100;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS target_gender TEXT DEFAULT 'Mixto/No especificar';

-- 3. Ensure Tags Column Exists (Array of Strings)
-- If it doesn't exist, create it. If it exists as generic json, we might leave it or alter.
-- Assuming standard text array for Supabase usually.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'groups' AND column_name = 'tags') THEN
        ALTER TABLE groups ADD COLUMN tags TEXT[] DEFAULT '{}';
    END IF;
END $$;

-- 4. Create Master Tags Table (for dropdown selection)
CREATE TABLE IF NOT EXISTS group_tags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT 'bg-gray-100'
);

-- Safe add column if it was missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'group_tags' AND column_name = 'color') THEN
        ALTER TABLE group_tags ADD COLUMN color TEXT DEFAULT 'bg-gray-100';
    END IF;
END $$;

-- 5. Insert Default Tags (Safe Insert with Explicit ID)
INSERT INTO group_tags (id, name, color)
SELECT gen_random_uuid(), v.name, v.color
FROM (VALUES
    ('Oración', 'bg-blue-100 text-blue-800'),
    ('Estudio Bíblico', 'bg-green-100 text-green-800'),
    ('Jóvenes', 'bg-purple-100 text-purple-800'),
    ('Matrimonios', 'bg-rose-100 text-rose-800'),
    ('Mujeres', 'bg-pink-100 text-pink-800'),
    ('Hombres', 'bg-slate-100 text-slate-800'),
    ('Aire Libre', 'bg-yellow-100 text-yellow-800'),
    ('Online', 'bg-indigo-100 text-indigo-800')
) as v(name, color)
WHERE NOT EXISTS (
    SELECT 1 FROM group_tags WHERE name = v.name
);

-- 6. Enable RLS on group_tags (Read accessible to all authenticated)
ALTER TABLE group_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access for group_tags" ON group_tags;
CREATE POLICY "Public read access for group_tags" ON group_tags
FOR SELECT TO authenticated
USING (true);

-- 7. Verify
SELECT 'Groups table upgraded successfully!' as status;
