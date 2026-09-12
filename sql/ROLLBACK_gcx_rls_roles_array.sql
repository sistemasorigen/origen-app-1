-- Restaura las políticas GCX al estado previo al arreglo
ALTER POLICY admins_manage_requests ON public.group_dropout_requests USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['SUPER_ADMIN'::user_role, 'ADMIN_GROUPS'::user_role]))))));
ALTER POLICY transfers_select ON public.group_transfer_requests USING (((from_user_id = auth.uid()) OR (to_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['SUPER_ADMIN'::user_role, 'PASTOR'::user_role, 'ENCARGADO_GRUPOS'::user_role, 'ADMIN_GROUPS'::user_role])))))));
ALTER POLICY transfers_update ON public.group_transfer_requests USING (((to_user_id = auth.uid()) OR (from_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['SUPER_ADMIN'::user_role, 'ENCARGADO_GRUPOS'::user_role, 'ADMIN_GROUPS'::user_role]))))))) WITH CHECK (((to_user_id = auth.uid()) OR (from_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['SUPER_ADMIN'::user_role, 'ENCARGADO_GRUPOS'::user_role, 'ADMIN_GROUPS'::user_role])))))));
ALTER POLICY "Hosts and Co-Hosts can update their groups" ON public.groups USING (((host_id = auth.uid()) OR (co_host_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['SUPER_ADMIN'::user_role, 'ADMIN_GROUPS'::user_role, 'PASTOR'::user_role])))))));
ALTER POLICY "Hosts and Co-Hosts can view their groups" ON public.groups USING (((host_id = auth.uid()) OR (co_host_id = auth.uid()) OR ((status = 'approved'::text) AND ((is_hidden IS NOT TRUE) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['SUPER_ADMIN'::user_role, 'ADMIN_GROUPS'::user_role, 'ENCARGADO_GRUPOS'::user_role]))))))) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['SUPER_ADMIN'::user_role, 'ADMIN_GROUPS'::user_role, 'PASTOR'::user_role])))))));
ALTER POLICY groups_delete_admin ON public.groups USING ((( SELECT users.role
   FROM users
  WHERE (users.id = auth.uid())) = ANY (ARRAY['SUPER_ADMIN'::user_role, 'ADMIN_GROUPS'::user_role, 'ENCARGADO_GRUPOS'::user_role, 'PASTOR'::user_role])));
ALTER POLICY groups_public_select ON public.groups USING (((status = 'approved'::text) AND ((is_hidden IS NOT TRUE) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['SUPER_ADMIN'::user_role, 'ADMIN_GROUPS'::user_role, 'ENCARGADO_GRUPOS'::user_role]))))))));
ALTER POLICY groups_select_admin ON public.groups USING ((( SELECT users.role
   FROM users
  WHERE (users.id = auth.uid())) = ANY (ARRAY['SUPER_ADMIN'::user_role, 'ADMIN_GROUPS'::user_role, 'ENCARGADO_GRUPOS'::user_role, 'PASTOR'::user_role])));
ALTER POLICY groups_update_admin ON public.groups USING ((( SELECT users.role
   FROM users
  WHERE (users.id = auth.uid())) = ANY (ARRAY['SUPER_ADMIN'::user_role, 'ADMIN_GROUPS'::user_role, 'ENCARGADO_GRUPOS'::user_role, 'PASTOR'::user_role])));
