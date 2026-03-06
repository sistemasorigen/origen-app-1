-- =========================================================================================
-- MIGRATION: Auto-assign CO_ANFITRION role when a group is approved
-- =========================================================================================

-- 1. Agregar columna co_host_id a groups si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'groups' AND column_name = 'co_host_id') THEN
        ALTER TABLE public.groups ADD COLUMN co_host_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Función para asignar automáticamente el rol de CO_ANFITRION
CREATE OR REPLACE FUNCTION public.assign_co_host_role()
RETURNS TRIGGER AS $$
BEGIN
    -- Si el estado del grupo cambia a 'approved' y tiene un co_host_id asignado
    IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' AND NEW.co_host_id IS NOT NULL THEN
        -- Actualizar el usuario dueño del co_host_id para otorgarle el rol de CO_ANFITRION
        UPDATE public.users 
        SET 
            -- Aseguramos que no haya duplicados removiéndolo primero y luego agregándolo
            roles = array_append(array_remove(roles, 'CO_ANFITRION'), 'CO_ANFITRION'),
            -- Vinculamos el ID del grupo (casteando el text a uuid)
            linked_group_id = NEW.id::uuid
        WHERE id = NEW.co_host_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear el trigger en la tabla groups que escucha el UPDATE de status
DROP TRIGGER IF EXISTS trigger_assign_co_host_role ON public.groups;

CREATE TRIGGER trigger_assign_co_host_role
AFTER UPDATE OF status ON public.groups
FOR EACH ROW
EXECUTE FUNCTION public.assign_co_host_role();
