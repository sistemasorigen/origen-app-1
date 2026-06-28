-- Fix: el CHECK constraint sobre prode_matches.round no incluía
-- 'Dieciseisavo de final', lo que rompía al crear partidos de 16vos.

-- PASO 1: Verificar el nombre exacto del constraint actual sobre round
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.prode_matches'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) ILIKE '%round%';
-- Resultado confirmado: conname = 'prode_matches_round_check'

-- PASO 2: Eliminar el constraint viejo
ALTER TABLE public.prode_matches
DROP CONSTRAINT IF EXISTS prode_matches_round_check;

-- PASO 3: Recrear el constraint incluyendo 'Dieciseisavo de final'
ALTER TABLE public.prode_matches
ADD CONSTRAINT prode_matches_round_check
CHECK (round IN (
    'Fase de grupos',
    'Dieciseisavo de final',
    'Octavos de final',
    'Cuartos de final',
    'Semifinal',
    'Tercer puesto',
    'Final'
));

-- PASO 4: Verificar el nuevo constraint
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.prode_matches'::regclass
  AND conname = 'prode_matches_round_check';

-- VERIFICACIÓN EXTRA: confirmar que no haya otro constraint con la lista de fases
SELECT conrelid::regclass AS tabla, conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE contype = 'c'
  AND pg_get_constraintdef(oid) ILIKE '%Octavos de final%';
-- Resultado: única tabla = prode_matches
