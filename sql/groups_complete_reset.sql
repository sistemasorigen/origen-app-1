-- =====================================================
-- COMPLETE GROUPS SYSTEM RESET
-- This script will recreate all groups tables from scratch
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. DROP EXISTING TABLES (cascade to remove dependencies)
DROP TABLE IF EXISTS group_registrations CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS group_categories CASCADE;
DROP TABLE IF EXISTS group_tags CASCADE;

-- 2. CREATE GROUP_CATEGORIES TABLE
CREATE TABLE group_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#000000'
);

-- 3. CREATE GROUP_TAGS TABLE
CREATE TABLE group_tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

-- 4. CREATE GROUPS TABLE
CREATE TABLE groups (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    name TEXT NOT NULL,
    leader_name TEXT NOT NULL,
    leader_surname TEXT DEFAULT '',
    leader_phone TEXT DEFAULT '',
    meeting_day TEXT DEFAULT 'Lunes',
    meeting_time TEXT DEFAULT '20:00',
    start_date TEXT,
    location TEXT DEFAULT '',
    members_count INTEGER DEFAULT 0,
    max_capacity INTEGER DEFAULT 12,
    description TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    category_id TEXT REFERENCES group_categories(id) ON DELETE SET NULL,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CREATE GROUP_REGISTRATIONS TABLE
CREATE TABLE group_registrations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    dni TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    group_id TEXT REFERENCES groups(id) ON DELETE CASCADE
);

-- 6. ENABLE RLS ON ALL TABLES
ALTER TABLE group_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_registrations ENABLE ROW LEVEL SECURITY;

-- 7. CREATE PERMISSIVE POLICIES FOR ALL OPERATIONS

-- group_categories policies
CREATE POLICY "Allow public read categories" ON group_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow auth insert categories" ON group_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow auth update categories" ON group_categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow auth delete categories" ON group_categories FOR DELETE TO authenticated USING (true);

-- group_tags policies
CREATE POLICY "Allow public read tags" ON group_tags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow auth insert tags" ON group_tags FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow auth update tags" ON group_tags FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow auth delete tags" ON group_tags FOR DELETE TO authenticated USING (true);

-- groups policies
CREATE POLICY "Allow public read groups" ON groups FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow auth insert groups" ON groups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow auth update groups" ON groups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow auth delete groups" ON groups FOR DELETE TO authenticated USING (true);

-- group_registrations policies
CREATE POLICY "Allow public read registrations" ON group_registrations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public insert registrations" ON group_registrations FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow auth update registrations" ON group_registrations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow auth delete registrations" ON group_registrations FOR DELETE TO authenticated USING (true);

-- 8. GRANT PERMISSIONS
GRANT ALL ON group_categories TO authenticated;
GRANT SELECT ON group_categories TO anon;
GRANT ALL ON group_tags TO authenticated;
GRANT SELECT ON group_tags TO anon;
GRANT ALL ON groups TO authenticated;
GRANT SELECT ON groups TO anon;
GRANT ALL ON group_registrations TO authenticated, anon;

-- 9. INSERT SAMPLE DATA (Optional)
INSERT INTO group_categories (id, name, color) VALUES 
    ('general', 'General', '#6366f1'),
    ('jovenes', 'Jóvenes', '#10b981'),
    ('adultos', 'Adultos', '#f59e0b'),
    ('familias', 'Familias', '#ec4899'),
    ('ninez', 'Niñez', '#8b5cf6')
ON CONFLICT (id) DO NOTHING;

INSERT INTO group_tags (id, name) VALUES 
    ('mixto', 'Mixto'),
    ('hombres', 'Hombres'),
    ('mujeres', 'Mujeres'),
    ('matrimonios', 'Matrimonios'),
    ('familia', 'Familia')
ON CONFLICT (id) DO NOTHING;

-- 10. VERIFY
SELECT 'Groups system tables created successfully!' as status;
SELECT count(*) as categories_count FROM group_categories;
SELECT count(*) as tags_count FROM group_tags;
