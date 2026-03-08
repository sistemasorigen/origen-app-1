-- fix_users_search_rls.sql
-- Allows any authenticated user to SELECT from public.users (needed for co-host search, host assignment, etc.)

DO $$
BEGIN
    -- Drop existing policy if it already exists to avoid duplicate errors
    IF EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename  = 'users'
          AND policyname = 'Allow authenticated users to read users'
    ) THEN
        DROP POLICY "Allow authenticated users to read users" ON public.users;
    END IF;
END;
$$;

CREATE POLICY "Allow authenticated users to read users"
    ON public.users
    FOR SELECT
    TO authenticated
    USING (auth.role() = 'authenticated');
