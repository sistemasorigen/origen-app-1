-- ==============================================================================-- UPDATE COORDINATOR VARIANT COLUMN CONSTRAINTS
-- Updates the allowed values for the coordinator_variant column to the new list
-- ==============================================================================

-- 1. Drop the existing constraints BEFORE updating data
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS check_coordinator_variant;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_coordinator_variant_check;

-- 2. Map existing old values to their new equivalents
UPDATE public.users SET coordinator_variant = 'FAMILIA' WHERE coordinator_variant = 'FAMILIA';
UPDATE public.users SET coordinator_variant = 'CENTRO_TRANSFORMACION' WHERE coordinator_variant = 'CENTRO_TRANSFORMACION';
UPDATE public.users SET coordinator_variant = 'NINEZ' WHERE coordinator_variant = 'NINEZ_INFLUOS';
UPDATE public.users SET coordinator_variant = 'INUSUAL' WHERE coordinator_variant = 'INUSUAL';
UPDATE public.users SET coordinator_variant = 'MUJERES' WHERE coordinator_variant = 'LA_FEMME';
UPDATE public.users SET coordinator_variant = 'HOMBRES' WHERE coordinator_variant = 'HOMBRIA';
UPDATE public.users SET coordinator_variant = 'FINANZAS' WHERE coordinator_variant = 'FINANZAS';
UPDATE public.users SET coordinator_variant = 'BIBLIA' WHERE coordinator_variant = 'BIBLIA';
UPDATE public.users SET coordinator_variant = 'TERCERA_EDAD' WHERE coordinator_variant = 'TERCERA_EDAD';
UPDATE public.users SET coordinator_variant = 'ORIGEN_SOCIAL' WHERE coordinator_variant = 'SOCIAL';
UPDATE public.users SET coordinator_variant = 'VOLUNTARIOS' WHERE coordinator_variant = 'AREAS_SERVICIO';

-- Add the new constraint with updated categories
ALTER TABLE public.users ADD CONSTRAINT check_coordinator_variant 
CHECK (coordinator_variant IN (
  'FINANZAS',
  'PAREJAS',
  'CENTRO_TRANSFORMACION',
  'TERCERA_EDAD',
  'BIBLIA',
  'INUSUAL',
  'PRE_ADOLESCENTES',
  'ADOLESCENTES',
  'FAMILIA',
  'RELACIONAL',
  'VOLUNTARIOS',
  'NINEZ',
  'JOVENES_26_35',
  'MUJERES',
  'ORIGEN_SOCIAL',
  'HOMBRES',
  'JOVENES_18_25'
));

-- Update the comment
COMMENT ON COLUMN public.users.coordinator_variant IS 
'Department variant for users with COORDINATOR role. Updated list of categories.';
