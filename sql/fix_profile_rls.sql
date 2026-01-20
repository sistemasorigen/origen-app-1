-- ==============================================================================
-- FIX PROFILE RLS SCRIPT
-- ==============================================================================
-- Execute this script in the Supabase SQL Editor to allow the "Self-Healing" 
-- mechanism to work when a public.users profile is missing.

-- 1. Enable INSERT for authenticated users on public.users
--    First drop conflicting policy if it exists to avoid errors.
DROP POLICY IF EXISTS "Users insert own data" ON public.users;

CREATE POLICY "Users insert own data" ON public.users 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- 2. Verify/Ensure the Trigger exists (just in case)
--    This ensures that *future* sign-ups work correctly automatically.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'name', new.email), 
    'VIEWER' -- Default role
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
