-- ==============================================================================
-- EMAIL CONFIRMATION FLOW - COMPLETE SETUP
-- ==============================================================================
-- Run this script in Supabase SQL Editor AFTER enabling email confirmation
-- in Dashboard > Authentication > Providers > Email > "Confirm email"
-- ==============================================================================

-- ============================================================================
-- STEP 1: Modify handle_new_user trigger to set is_active = FALSE by default
-- ============================================================================

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

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 2: Create trigger to activate user when email is confirmed
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when email_confirmed_at transitions from NULL to a value
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    UPDATE public.users
    SET is_active = TRUE
    WHERE id = NEW.id;
    
    RAISE LOG 'Email confirmed for user %: is_active set to TRUE', NEW.email;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists and recreate
DROP TRIGGER IF EXISTS on_email_confirmed ON auth.users;
CREATE TRIGGER on_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_email_confirmed();

-- ============================================================================
-- STEP 3: Grant necessary permissions
-- ============================================================================

-- Ensure the function can access auth schema
GRANT USAGE ON SCHEMA auth TO postgres;

-- ============================================================================
-- VERIFICATION QUERY - Run this to check your triggers are installed
-- ============================================================================
-- SELECT trigger_name, event_manipulation, action_statement 
-- FROM information_schema.triggers 
-- WHERE event_object_table = 'users' AND trigger_schema = 'auth';

-- ==============================================================================
-- IMPORTANT: SUPABASE DASHBOARD SETTINGS (MANUAL STEP)
-- ==============================================================================
-- 1. Go to: Dashboard > Authentication > Providers > Email
-- 2. Enable "Confirm email" toggle
-- 3. (Optional) Customize email templates at: Authentication > Email Templates
-- ==============================================================================
