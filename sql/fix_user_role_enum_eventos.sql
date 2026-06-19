-- Verificar los valores actuales del enum ANTES
-- de modificar nada
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'public.user_role'::regtype
ORDER BY enumsortorder;

-- Agregar los valores faltantes
-- (ALTER TYPE ... ADD VALUE no puede ejecutarse
-- dentro de una transacción explícita en
-- versiones viejas de Postgres, pero Supabase
-- corre cada statement individualmente, así que
-- ejecutar uno por uno está bien)

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'EVENTOS';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'ENCARGADO_EVENTOS';

-- Verificar que se agregaron correctamente
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'public.user_role'::regtype
ORDER BY enumsortorder;
