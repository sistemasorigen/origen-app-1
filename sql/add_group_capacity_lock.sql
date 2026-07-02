-- 1. Columna nueva
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS capacity_locked BOOLEAN
NOT NULL DEFAULT false;

COMMENT ON COLUMN public.groups.capacity_locked IS
'Si es true, el grupo se muestra como LLENO sin importar members_count/max_capacity. Lo activa el anfitrión o un admin para bloquear nuevas inscripciones manualmente.';

-- 2. RPC dedicado para togglear el bloqueo
-- (host, co-host, o admin)
CREATE OR REPLACE FUNCTION public.toggle_group_capacity_lock(
    p_group_id UUID,
    p_locked BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_role TEXT;
    v_host_id UUID;
    v_co_host_id UUID;
BEGIN
    SELECT role INTO v_caller_role FROM public.users WHERE id = auth.uid();
    SELECT host_id, co_host_id INTO v_host_id, v_co_host_id
    FROM public.groups WHERE id = p_group_id;

    IF v_caller_role IN ('ADMIN', 'SUPER_ADMIN', 'SUPERADMIN', 'ENCARGADO_GRUPOS', 'ADMIN_GROUPS')
       OR auth.uid() = v_host_id
       OR auth.uid() = v_co_host_id
    THEN
        UPDATE public.groups
        SET capacity_locked = p_locked
        WHERE id = p_group_id;
    ELSE
        RAISE EXCEPTION 'No tenés permisos para modificar este grupo';
    END IF;
END;
$$;

-- 3. Verificar
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'groups' AND column_name = 'capacity_locked';
