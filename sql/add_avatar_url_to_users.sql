-- Agregar columna avatar_url a la tabla public.users
-- Ejecutar en Supabase SQL Editor

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Verificar
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name = 'avatar_url';
