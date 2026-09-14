-- ============================================================================
-- Auditoría de permisos — FASE 2a, paso 3: cerrar perfiles e Influos
--
-- Correr DESPUÉS de desplegar el frontend que usa buscar_personas,
-- buscar_usuario_por_email, nombres_de_usuarios y buscar_tribu_influos. Si se
-- corre antes, el bundle viejo pierde la búsqueda de co-anfitrión, la de
-- pareja al anotarse, las transferencias y la búsqueda de tribu con sesión.
-- ============================================================================

-- users: cualquier usuario con sesión leía los 396 perfiles completos. Quedan:
-- · "Usuarios pueden ver su propio perfil" (cada uno su fila)
-- · "Admins pueden ver todo" (SUPER_ADMIN)
-- · y esta, para las pantallas que listan usuarios: panel de admin, gestión
--   de anfitriones y coordinadores, revisión de grupos y Reportes.
-- Las políticas de otras tablas que consultan users lo hacen sobre la fila
-- propia (users.id = auth.uid()), así que no se ven afectadas.
DROP POLICY IF EXISTS "Allow authenticated users to read users" ON public.users;
DROP POLICY IF EXISTS nuclear_select_all ON public.users;
DROP POLICY IF EXISTS users_lectura_staff ON public.users;
CREATE POLICY users_lectura_staff ON public.users
  FOR SELECT TO authenticated
  USING ((SELECT public.tiene_rol(ARRAY['SUPER_ADMIN', 'ADMIN_GROUPS', 'ENCARGADO_GRUPOS', 'PASTOR', 'REPORTES', 'ADMIN_PUNTO', 'ENCARGADO_PUNTO'])));

-- influos_attendees: cualquier usuario con sesión leía los 34 inscriptos
-- (menores, con teléfono). La gestión sigue en influos_full_access
-- (INFLUOS, PASTOR, SUPER_ADMIN); la búsqueda pública usa buscar_tribu_influos.
DROP POLICY IF EXISTS influos_authenticated_read ON public.influos_attendees;
