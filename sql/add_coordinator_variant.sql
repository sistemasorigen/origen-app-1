-- ==============================================================================
-- ADD COORDINATOR VARIANT COLUMN
-- Subdivides the COORDINATOR role into 11 specific departments
-- ==============================================================================

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS coordinator_variant TEXT 
CHECK (coordinator_variant IN (
  'FAMILIA',
  'CENTRO_TRANSFORMACION',
  'NINEZ_INFLUOS',
  'INUSUAL',
  'LA_FEMME',
  'HOMBRIA',
  'FINANZAS',
  'BIBLIA',
  'TERCERA_EDAD',
  'SOCIAL',
  'AREAS_SERVICIO'
));

-- Add comment for documentation
COMMENT ON COLUMN public.users.coordinator_variant IS 
'Department variant for users with COORDINATOR role. 11 possible values representing church departments.';
