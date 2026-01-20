-- ==============================================================================
-- ADD PHONE AND BIRTH_DATE COLUMNS TO USERS TABLE
-- ==============================================================================
-- Run this script in Supabase SQL Editor
-- 
-- Problem: The Profile Completion Modal tries to update phone, age, gender, birthDate
-- in public.users, but the 'phone' and 'birth_date' columns don't exist in the table.
-- Error: "Could not find the 'phone' column of 'users' in the schema cache"
-- 
-- Solution: Add the phone and birth_date columns to the users table.
-- ==============================================================================

-- STEP 1: Add the phone column to public.users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';

-- STEP 2: Add the birth_date column to public.users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS birth_date DATE;

-- STEP 3: Update the handle_new_user() trigger to also save phone and birth_date for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, is_active, phone, age, gender, birth_date)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'VIEWER',
    -- OAuth users (Google, etc.) have email_confirmed_at already set at INSERT time
    -- Email/password users have it NULL and need to confirm via email link
    CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN TRUE ELSE FALSE END,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    (NEW.raw_user_meta_data->>'age')::INTEGER,
    NEW.raw_user_meta_data->>'gender',
    (NEW.raw_user_meta_data->>'birthDate')::DATE
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.users.name),
    -- Also update is_active for OAuth users on conflict (e.g., if they re-auth)
    is_active = CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN TRUE ELSE public.users.is_active END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 4: Verify the columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'users' 
AND column_name IN ('phone', 'birth_date');

