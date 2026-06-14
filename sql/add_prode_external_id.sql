-- Agregar external_match_id a prode_matches
ALTER TABLE public.prode_matches
ADD COLUMN IF NOT EXISTS external_match_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_prode_external_id
    ON public.prode_matches(external_match_id)
    WHERE external_match_id IS NOT NULL;

-- Verificar
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'prode_matches'
AND column_name = 'external_match_id';
