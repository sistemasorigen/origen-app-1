-- 1. Columna nueva
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN
NOT NULL DEFAULT false;

COMMENT ON COLUMN public.groups.is_hidden IS
'Si es true, el grupo se oculta de /gcx para todos excepto SUPER_ADMIN, ADMIN_GROUPS y ENCARGADO_GRUPOS, que lo ven grisado.';

-- 2. RPC dedicado — SOLO los roles de administración de grupos
-- NOTA: groups.id es TEXT (no UUID) en la base real, y el chequeo
-- de rol usa el enum public.user_role + la columna roles[] (array),
-- con fallback a la columna role singular si roles está vacía.
-- Esto replica el patrón real de toggle_group_capacity_lock
-- (verificado contra pg_get_functiondef en la base viva, no contra
-- el archivo sql/add_group_capacity_lock.sql que estaba desactualizado).
CREATE OR REPLACE FUNCTION public.toggle_group_visibility(
    p_group_id text,
    p_hidden boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_role public.user_role;
    v_caller_roles public.user_role[];
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    SELECT role, roles INTO v_caller_role, v_caller_roles FROM public.users WHERE id = auth.uid();
    IF v_caller_roles IS NULL OR array_length(v_caller_roles, 1) = 0 THEN
        v_caller_roles := ARRAY[COALESCE(v_caller_role, 'VIEWER'::public.user_role)];
    END IF;

    IF 'SUPER_ADMIN'::public.user_role = ANY(v_caller_roles)
       OR 'ADMIN_GROUPS'::public.user_role = ANY(v_caller_roles)
       OR 'ENCARGADO_GRUPOS'::public.user_role = ANY(v_caller_roles)
    THEN
        v_is_authorized := TRUE;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'No tenés permisos para ocultar este grupo';
    END IF;

    UPDATE public.groups
    SET is_hidden = p_hidden
    WHERE id = p_group_id;
END;
$$;

NOTIFY pgrst, 'reload schema';

-- 3. Verificar
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'groups' AND column_name = 'is_hidden';
