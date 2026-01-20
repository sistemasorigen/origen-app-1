-- ================================================
-- FIX CRITICAL: Users Table RLS (Sin Recursión)
-- Ejecutar en Supabase SQL Editor
-- ================================================

-- PASO 1: Deshabilitar RLS temporalmente
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- PASO 2: Eliminar TODAS las políticas existentes de users
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'users' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
    END LOOP;
END $$;

-- PASO 3: Crear políticas SIMPLES (SIN subconsultas a la misma tabla)

-- SELECT: Cada usuario puede ver su propio perfil
CREATE POLICY "users_select_self" ON public.users
FOR SELECT USING (id = auth.uid());

-- SELECT: Todos los usuarios autenticados pueden ver a otros usuarios
-- (Necesario para que los admins vean la lista de usuarios)
CREATE POLICY "users_select_authenticated" ON public.users
FOR SELECT USING (auth.uid() IS NOT NULL);

-- INSERT: Usuarios pueden crear su propio perfil
CREATE POLICY "users_insert_self" ON public.users
FOR INSERT WITH CHECK (id = auth.uid());

-- UPDATE: Usuarios pueden actualizar su propio perfil
CREATE POLICY "users_update_self" ON public.users
FOR UPDATE USING (id = auth.uid());

-- DELETE: Solo usuarios pueden eliminar su propio perfil (raro pero posible)
CREATE POLICY "users_delete_self" ON public.users
FOR DELETE USING (id = auth.uid());

-- PASO 4: Re-habilitar RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- PASO 5: Verificar
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'users';

-- ================================================
-- NOTA: Estas políticas NO usan subconsultas a la misma tabla,
-- lo cual elimina el problema de recursión infinita.
-- Los permisos de admin se manejan a nivel de aplicación.
-- ================================================
