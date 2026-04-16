ALTER TABLE public.influos_attendees
ADD COLUMN IF NOT EXISTS tribu TEXT;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'influos_attendees'
  AND column_name = 'tribu';
