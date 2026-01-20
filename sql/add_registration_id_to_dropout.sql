-- Migration: Add target_registration_id column for dropout requests
-- Purpose: Store the registration ID for user dropouts (since users may not have accounts)

-- Add new column for registration ID (TEXT to match group_registrations.id type)
ALTER TABLE public.group_dropout_requests 
ADD COLUMN target_registration_id TEXT REFERENCES public.group_registrations(id) ON DELETE SET NULL;

-- Add target_user_name for display purposes (when user doesn't have account)
ALTER TABLE public.group_dropout_requests 
ADD COLUMN target_user_name TEXT;
