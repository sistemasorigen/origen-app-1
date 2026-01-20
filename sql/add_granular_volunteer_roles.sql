-- ==============================================================================
-- MIGRATION: Add Granular Volunteer Roles to user_role ENUM
-- ==============================================================================
-- This migration adds ONLY the missing granular roles.
-- VOLUNTARIO and VOLUNTEER already exist in the enum.
-- ==============================================================================

-- Add specific volunteer area roles (these are the missing ones)
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'VOLUNTARIO_INFO';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'VOLUNTARIO_GRUPOS';

-- Add manager-level roles for each area
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'ENCARGADO_PUNTO';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'ENCARGADO_GRUPOS';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'ENCARGADO_STORE';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'ENCARGADO_ALABANZA';

-- Add reports role
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'REPORTES';

-- Verify the enum now contains the new values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'public.user_role'::regtype 
ORDER BY enumsortorder;

-- ==============================================================================
-- ROLES EXPLANATION:
-- - VOLUNTARIO_INFO: Volunteer access to "Punto de Información"
-- - VOLUNTARIO_GRUPOS: Volunteer access to "Grupos de Conexión"
-- - ENCARGADO_*: Manager-level access to each area
-- - REPORTES: Access to reports/analytics
-- ==============================================================================
