-- Agregar imageUrl y location a app_events
ALTER TABLE public.app_events
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS location TEXT;

-- Verificar
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'app_events'
AND column_name IN ('image_url', 'location')
ORDER BY column_name;
