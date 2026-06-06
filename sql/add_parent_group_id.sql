-- Columna para rastrear linaje de temporadas
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS parent_group_id TEXT
    REFERENCES public.groups(id)
    ON DELETE SET NULL;

-- Índice para queries de linaje
CREATE INDEX IF NOT EXISTS idx_groups_parent_id
    ON public.groups(parent_group_id)
    WHERE parent_group_id IS NOT NULL;

-- Verificar
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'groups'
  AND column_name = 'parent_group_id';
