-- ============================================================================
-- GCX: el encargado no veía los grupos PENDIENTES
--
-- La tabla users guarda el rol en dos lugares: la columna heredada `role`
-- (enum, un solo valor) y el array `roles`, que es el que usa el sistema
-- multi-rol. El frontend lee el array y cae a la columna sólo si está vacío
-- (services/authUtils.ts → getUserRoles), pero estas políticas miraban
-- únicamente la columna singular.
--
-- Efecto: un encargado con roles = {ADMIN_GROUPS, COORDINATOR} y role =
-- 'COORDINATOR' entraba al panel de GCX porque la UI lo aprobaba, pero RLS
-- lo rechazaba y caía en groups_public_select, que sólo deja pasar
-- status='approved'. Veía 71 de 91 grupos y 0 de 17 pendientes, sin ningún
-- error: la consulta devolvía menos filas, no un fallo.
--
-- El arreglo no agrega roles nuevos a ninguna política; sólo hace que cada
-- una mire las dos columnas, siguiendo el mismo criterio que ya usaban las
-- políticas nuevas (group_registrations, audit_logs, prode_*, trivia_*).
-- ============================================================================

-- Un único lugar donde se decide "este usuario tiene alguno de estos roles",
-- para que la próxima política que se escriba no repita el olvido.
-- SECURITY DEFINER: sólo lee la fila del propio llamador vía auth.uid() y
-- devuelve un booleano, sin exponer nada de users.
CREATE OR REPLACE FUNCTION public.tiene_rol(roles_requeridos text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND ( (u.role)::text = ANY (roles_requeridos)
         OR u.roles && roles_requeridos )
  );
$$;

REVOKE ALL ON FUNCTION public.tiene_rol(text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.tiene_rol(text[]) TO authenticated, anon;

-- ── groups ──────────────────────────────────────────────────────────────────
ALTER POLICY groups_select_admin ON public.groups
  USING ( public.tiene_rol(ARRAY['SUPER_ADMIN','ADMIN_GROUPS','ENCARGADO_GRUPOS','PASTOR']) );

ALTER POLICY groups_update_admin ON public.groups
  USING ( public.tiene_rol(ARRAY['SUPER_ADMIN','ADMIN_GROUPS','ENCARGADO_GRUPOS','PASTOR']) );

ALTER POLICY groups_delete_admin ON public.groups
  USING ( public.tiene_rol(ARRAY['SUPER_ADMIN','ADMIN_GROUPS','ENCARGADO_GRUPOS','PASTOR']) );

ALTER POLICY groups_public_select ON public.groups
  USING (
    status = 'approved'
    AND ( is_hidden IS NOT TRUE
       OR public.tiene_rol(ARRAY['SUPER_ADMIN','ADMIN_GROUPS','ENCARGADO_GRUPOS']) )
  );

ALTER POLICY "Hosts and Co-Hosts can view their groups" ON public.groups
  USING (
       host_id = auth.uid()
    OR co_host_id = auth.uid()
    OR ( status = 'approved'
         AND ( is_hidden IS NOT TRUE
            OR public.tiene_rol(ARRAY['SUPER_ADMIN','ADMIN_GROUPS','ENCARGADO_GRUPOS']) ) )
    OR public.tiene_rol(ARRAY['SUPER_ADMIN','ADMIN_GROUPS','PASTOR'])
  );

ALTER POLICY "Hosts and Co-Hosts can update their groups" ON public.groups
  USING (
       host_id = auth.uid()
    OR co_host_id = auth.uid()
    OR public.tiene_rol(ARRAY['SUPER_ADMIN','ADMIN_GROUPS','PASTOR'])
  );

-- ── group_dropout_requests (bajas) ──────────────────────────────────────────
ALTER POLICY admins_manage_requests ON public.group_dropout_requests
  USING ( public.tiene_rol(ARRAY['SUPER_ADMIN','ADMIN_GROUPS']) );

-- ── group_transfer_requests (transferencias) ────────────────────────────────
ALTER POLICY transfers_select ON public.group_transfer_requests
  USING (
       from_user_id = auth.uid()
    OR to_user_id = auth.uid()
    OR public.tiene_rol(ARRAY['SUPER_ADMIN','PASTOR','ENCARGADO_GRUPOS','ADMIN_GROUPS'])
  );

ALTER POLICY transfers_update ON public.group_transfer_requests
  USING (
       to_user_id = auth.uid()
    OR from_user_id = auth.uid()
    OR public.tiene_rol(ARRAY['SUPER_ADMIN','ENCARGADO_GRUPOS','ADMIN_GROUPS'])
  )
  WITH CHECK (
       to_user_id = auth.uid()
    OR from_user_id = auth.uid()
    OR public.tiene_rol(ARRAY['SUPER_ADMIN','ENCARGADO_GRUPOS','ADMIN_GROUPS'])
  );
