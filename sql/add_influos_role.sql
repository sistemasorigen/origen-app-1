-- ==============================================================================
-- MIGRATION: Add INFLUOS role to user_role ENUM
-- ==============================================================================

-- Agregar rol INFLUOS al enum user_role
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'INFLUOS';

-- Verificar
SELECT enumlabel FROM pg_enum
WHERE enumtypid = 'public.user_role'::regtype
ORDER BY enumsortorder;
