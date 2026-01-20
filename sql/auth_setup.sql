-- ==============================================================================
-- SUPABASE AUTH INTEGRATION SQL
-- ==============================================================================
-- This script sets up the public.users table to sync with Supabase Auth.
-- IMPORTANT: Passwords are managed by Supabase (auth.users) and are NOT stored here.
-- ==============================================================================

-- 1. Create Users Table (Extends auth.users)
-- We map the internal Auth ID to this table to store "Application Data" (Profiles)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'VIEWER', -- 'SUPER_ADMIN', 'PASTOR', etc.
  is_active BOOLEAN DEFAULT true,
  
  -- Application specific fields
  linked_group_id UUID,          
  volunteer_roles TEXT[],        
  is_system_volunteer BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own profile
DROP POLICY IF EXISTS "Users view own data" ON public.users;
CREATE POLICY "Users view own data" ON public.users FOR SELECT USING (auth.uid() = id);

-- Policy: Users can update their own profile (name, etc.)
DROP POLICY IF EXISTS "Users update own data" ON public.users;
CREATE POLICY "Users update own data" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Policy: Users can insert their own profile (Self-Healing)
DROP POLICY IF EXISTS "Users insert own data" ON public.users;
CREATE POLICY "Users insert own data" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- 3. Automation Trigger (Sync New Users)
-- When a user Signs Up via Email (auth.users), this trigger creates their public profile.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    new.id, 
    new.email, 
    -- Try to get name from metadata, fallback to email part or null
    COALESCE(new.raw_user_meta_data->>'name', new.email), 
    'VIEWER'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- NOTE ON PASSWORD RESET:
-- Password reset logic is internal to Supabase. There is no SQL function for it.
-- When you call supabase.auth.resetPasswordForEmail(), Supabase sends the email.
-- When the user clicks the link, they are authenticated, and you verify them via the UI.
-- ==============================================================================
