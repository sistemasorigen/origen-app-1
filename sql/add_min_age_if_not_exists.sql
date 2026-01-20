-- Add min_age column to groups table if it doesn't exist
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS min_age INTEGER DEFAULT 0;

-- Optional: Add comment
COMMENT ON COLUMN public.groups.min_age IS 'Minimum age requirement for the group. 0 means no minimum.';
