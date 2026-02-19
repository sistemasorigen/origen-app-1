-- Add tutorial_progress column to public.users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'tutorial_progress'
    ) THEN
        ALTER TABLE public.users ADD COLUMN tutorial_progress JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Optional: Add a comment to the column
COMMENT ON COLUMN public.users.tutorial_progress IS 'Stores the user progress for onboarding tours. Structure: { "dashboard": true, "groups": false, "declined_all": false }';
