-- ============================================================================
-- ROLLBACK de auditoria_2026-09_fase2a_menores_y_perfiles.sql
-- Estado capturado de producción el 14/09/2026, antes de aplicar la fase 2a.
-- Restaura search_potential_hosts (con sus permisos) y todas las políticas de
-- users, influos_attendees y dpadre_hijos, y elimina las funciones nuevas.
-- Si ya se desplegó el frontend de la fase 2a, las búsquedas de personas y la
-- página /influos-acceso dependen de esas funciones: revertir también el deploy.
-- ============================================================================

-- funciones nuevas de la fase 2a
DROP FUNCTION IF EXISTS public.buscar_tribu_influos(text, text);
DROP FUNCTION IF EXISTS public.buscar_personas(text, boolean, boolean, integer);
DROP FUNCTION IF EXISTS public.buscar_usuario_por_email(text);
DROP FUNCTION IF EXISTS public.nombres_de_usuarios(uuid[]);
DROP FUNCTION IF EXISTS public.normalizar_nombre(text);

-- funciones
CREATE OR REPLACE FUNCTION public.search_potential_hosts(search_term text)
 RETURNS TABLE(id uuid, name text, email text, role user_role)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
begin
  return query
  select
    u.id,
    u.name,
    u.email,
    u.role
  from public.users u
  where
    -- 1. Exact case-insensitive match on name (single column)
    u.name ilike '%' || search_term || '%'
    or u.email ilike '%' || search_term || '%'
    -- 2. Fuzzy match using trigrams on name
    or (char_length(search_term) > 2 and u.name % search_term)
  order by
    -- Rank exact matches higher
    case when u.name ilike '%' || search_term || '%' then 0 else 1 end,
    u.name asc
  limit 10;
end;
$function$
;
REVOKE ALL ON FUNCTION public.search_potential_hosts(search_term text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_potential_hosts(search_term text) TO authenticated, postgres, service_role;

-- políticas: se eliminan las actuales de las tres tablas y se recrean las originales
DO $$ DECLARE r record; BEGIN FOR r IN SELECT polname FROM pg_policy WHERE polrelid = 'public.dpadre_hijos'::regclass LOOP EXECUTE format('DROP POLICY %I ON public.dpadre_hijos', r.polname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT polname FROM pg_policy WHERE polrelid = 'public.influos_attendees'::regclass LOOP EXECUTE format('DROP POLICY %I ON public.influos_attendees', r.polname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT polname FROM pg_policy WHERE polrelid = 'public.users'::regclass LOOP EXECUTE format('DROP POLICY %I ON public.users', r.polname); END LOOP; END $$;
CREATE POLICY dpadre_hijos_delete ON public.dpadre_hijos AS PERMISSIVE FOR DELETE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (((users.role)::text = ANY (ARRAY['SUPER_ADMIN'::text, 'PASTOR'::text, 'EVENTOS'::text, 'ENCARGADO_EVENTOS'::text])) OR (users.roles && ARRAY['SUPER_ADMIN'::text, 'PASTOR'::text, 'EVENTOS'::text, 'ENCARGADO_EVENTOS'::text]))))));
CREATE POLICY dpadre_hijos_insert ON public.dpadre_hijos AS PERMISSIVE FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY dpadre_hijos_select ON public.dpadre_hijos AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY influos_authenticated_read ON public.influos_attendees AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY influos_full_access ON public.influos_attendees AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (((users.role)::text = ANY (ARRAY['INFLUOS'::text, 'SUPER_ADMIN'::text, 'PASTOR'::text])) OR ('INFLUOS'::text = ANY (users.roles)) OR ('SUPER_ADMIN'::text = ANY (users.roles)) OR ('PASTOR'::text = ANY (users.roles))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (((users.role)::text = ANY (ARRAY['INFLUOS'::text, 'SUPER_ADMIN'::text, 'PASTOR'::text])) OR ('INFLUOS'::text = ANY (users.roles)) OR ('SUPER_ADMIN'::text = ANY (users.roles)) OR ('PASTOR'::text = ANY (users.roles)))))));
CREATE POLICY "Admins pueden ver todo" ON public.users AS PERMISSIVE FOR ALL TO PUBLIC USING (is_admin());
CREATE POLICY "Allow authenticated users to read users" ON public.users AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Usuarios pueden actualizar su propio perfil" ON public.users AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = id));
CREATE POLICY "Usuarios pueden ver su propio perfil" ON public.users AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = id));
CREATE POLICY nuclear_insert_own ON public.users AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = id));
CREATE POLICY nuclear_select_all ON public.users AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.role() = 'authenticated'::text));
CREATE POLICY nuclear_update_own ON public.users AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = id));
CREATE POLICY users_delete_self ON public.users AS PERMISSIVE FOR DELETE TO PUBLIC USING ((id = auth.uid()));
CREATE POLICY users_update_self ON public.users AS PERMISSIVE FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));
CREATE POLICY users_update_self_no_role ON public.users AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((id = auth.uid())) WITH CHECK (((role = ( SELECT users_1.role
   FROM users users_1
  WHERE (users_1.id = auth.uid()))) AND (roles = ( SELECT users_1.roles
   FROM users users_1
  WHERE (users_1.id = auth.uid())))));
