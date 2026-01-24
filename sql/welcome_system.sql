-- Welcome System Module Migration

-- 1. Create ENUM for visitor stage if it doesn't exist
DO $$ BEGIN
    CREATE TYPE visitor_stage AS ENUM (
        'NEW',
        'FILLED_FORM',
        'SECOND_CONTACT',
        'THIRD_CONTACT',
        'INTERESTED_GROWTH',
        'DOING_GROWTH',
        'DOING_TRAINING',
        'VOLUNTEERS',
        'NO_RESPONSE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create table welcome_visitors
CREATE TABLE IF NOT EXISTS welcome_visitors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Basic Fields
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    age INT,
    phone TEXT,
    
    -- State Field
    stage visitor_stage DEFAULT 'NEW',
    
    -- Detailed Form Fields
    is_first_time BOOLEAN,
    accepted_jesus TEXT CHECK (accepted_jesus IN ('Si', 'No, antes')),
    referral_source TEXT,
    experience_rating TEXT,
    wants_growth TEXT, -- 'Si', 'No', 'Tal vez'
    interest_areas TEXT[], -- Array of strings
    prayer_request TEXT
);

-- 3. Enable RLS
ALTER TABLE welcome_visitors ENABLE ROW LEVEL SECURITY;

-- 4. Create Policy for Authenticated Users
-- The user requested "Visible solo para roles autenticados".
-- Since roles are managed in the app via UserRole, we'll allow generic 'authenticated' access here
-- and handle role-based UI restriction in the frontend, OR we can refine this policy if 'user_roles' table exists.
-- For now, consistent with other tables like 'groups' simplified RLS:

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON welcome_visitors;

CREATE POLICY "Enable all access for authenticated users" ON welcome_visitors
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Grant permissions to authenticated role (if needed, usually default in Supabase)
GRANT ALL ON welcome_visitors TO authenticated;
