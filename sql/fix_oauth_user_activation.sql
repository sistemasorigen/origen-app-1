-- ==============================================================================
-- FIX: OAuth User Activation (Google, etc.)
-- ==============================================================================
-- Run this script in Supabase SQL Editor
-- 
-- Problem: Users registering via Google OAuth were created with is_active=FALSE
-- and never activated because the email confirmation trigger is an UPDATE trigger,
-- not an INSERT trigger. OAuth users have email_confirmed_at already set at INSERT.
-- 
-- Solution: Modify handle_new_user() to detect OAuth users (email_confirmed_at 
-- is NOT NULL at INSERT time) and set is_active=TRUE for them immediately.
-- ==============================================================================

-- STEP 1: Update the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, is_active, age, gender)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'VIEWER',
    -- OAuth users (Google, etc.) have email_confirmed_at already set at INSERT time
    -- Email/password users have it NULL and need to confirm via email link
    CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN TRUE ELSE FALSE END,
    (NEW.raw_user_meta_data->>'age')::INTEGER,
    NEW.raw_user_meta_data->>'gender'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.users.name),
    -- Also update is_active for OAuth users on conflict (e.g., if they re-auth)
    is_active = CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN TRUE ELSE public.users.is_active END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 2: Ensure trigger exists (recreate for safety)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- STEP 3: Activate existing OAuth user "Tadeo" who was stuck with is_active=FALSE
UPDATE public.users 
SET is_active = TRUE 
WHERE email = 'tadeogomezcoll@origeniglesia.org';

-- STEP 4: Activate ALL existing OAuth users who may have the same issue
-- (Users who exist in auth.users with email_confirmed_at set but have is_active=FALSE in public.users)
UPDATE public.users u
SET is_active = TRUE
FROM auth.users au
WHERE u.id = au.id
  AND au.email_confirmed_at IS NOT NULL
  AND u.is_active = FALSE;

-- Verify: Check Tadeo's status
SELECT id, email, name, is_active 
FROM public.users 
WHERE email = 'tadeogomezcoll@origeniglesia.org';
