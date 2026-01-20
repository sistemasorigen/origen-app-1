-- ================================================
-- FIX SIMPLE: Groups RLS Policies (Sin recursión)
-- Ejecutar en Supabase SQL Editor
-- ================================================

-- PASO 1: Deshabilitar RLS temporalmente para limpiar
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;

-- PASO 2: Eliminar TODAS las políticas existentes de groups
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'groups' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.groups', pol.policyname);
    END LOOP;
END $$;

-- PASO 3: Crear políticas SIMPLES (sin subconsultas complejas)

-- SELECT: Todos pueden leer grupos aprobados
CREATE POLICY "groups_select_approved" ON public.groups
FOR SELECT USING (status = 'approved');

-- SELECT: Usuarios autenticados ven sus propios grupos
CREATE POLICY "groups_select_own" ON public.groups
FOR SELECT USING (host_id = auth.uid());

-- SELECT: Admins ven todo (usando función RPC para evitar recursión)
CREATE POLICY "groups_select_admin" ON public.groups
FOR SELECT USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('SUPER_ADMIN', 'ADMIN_GROUPS')
);

-- INSERT: Usuarios autenticados pueden crear
CREATE POLICY "groups_insert" ON public.groups
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: Propietario puede actualizar
CREATE POLICY "groups_update_own" ON public.groups
FOR UPDATE USING (host_id = auth.uid());

-- UPDATE: Admins pueden actualizar todo
CREATE POLICY "groups_update_admin" ON public.groups
FOR UPDATE USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('SUPER_ADMIN', 'ADMIN_GROUPS')
);

-- DELETE: Solo admins
CREATE POLICY "groups_delete_admin" ON public.groups
FOR DELETE USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('SUPER_ADMIN', 'ADMIN_GROUPS')
);

-- PASO 4: Re-habilitar RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- PASO 5: Verificar
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'groups';
