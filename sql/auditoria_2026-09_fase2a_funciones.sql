-- ============================================================================
-- Auditoría de permisos — FASE 2a, paso 1: menores y perfiles
-- 14/09/2026
--
-- Todo lo de este archivo es compatible con el bundle que está hoy en
-- producción. Agrega las funciones que va a usar el frontend nuevo y cierra
-- lo que no depende de él. El cierre de users e influos_attendees va en
-- auditoria_2026-09_fase2a_cierre.sql, DESPUÉS del deploy.
--
-- Decisiones confirmadas el 14/09/2026:
-- · Influos: búsqueda pública por nombre y apellido exactos.
-- · Día del Padre: se cierran solo los hijos; inscripción y ranking siguen.
-- · Perfiles completos: SUPER_ADMIN, ADMIN_GROUPS, ENCARGADO_GRUPOS, PASTOR,
--   REPORTES, ADMIN_PUNTO y ENCARGADO_PUNTO.
-- · Buscar personas: teléfono solo para anfitriones y staff.
--
-- Rollback: ROLLBACK_auditoria_2026-09_fase2a.sql
-- Prueba:   PROBAR_auditoria_2026-09_fase2a.sql
-- ============================================================================


-- Comparación de nombres tolerante a lo que tipea una persona: sin espacios
-- sobrantes, sin mayúsculas y sin tildes ("José  Pérez" = "jose perez").
-- La base no tiene la extensión unaccent; translate cubre el español. Incluye
-- las mayúsculas acentuadas por si lower() no las convierte (collation C).
CREATE OR REPLACE FUNCTION public.normalizar_nombre(p_texto text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT translate(
           regexp_replace(lower(btrim(COALESCE(p_texto, ''))), '\s+', ' ', 'g'),
           'áéíóúüñàèìòùÁÉÍÓÚÜÑÀÈÌÒÙ', 'aeiouunaeiouaeiouunaeiou'
         );
$function$;


-- ════════════════════════════════════════════════════════════════════════════
-- 1. Influos: la tribu de un chico, sin exponer a los demás
--
-- /influos-acceso consulta influos_attendees directo con coincidencia parcial
-- (ilike '%nombre%'). Sin sesión nunca funcionó —dependía de una política
-- influos_public_read que no existe— y con cualquier sesión se leían los 34
-- inscriptos completos, teléfono incluido. La coincidencia parcial además
-- permitía descubrir nombres y tribus probando letras.
--
-- Esta función busca por nombre y apellido exactos (normalizados) y devuelve
-- solo lo que muestra la pantalla: nombre, apellido, tribu y si es su primera
-- vez. Funciona con y sin sesión.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.buscar_tribu_influos(p_first_name text, p_last_name text)
 RETURNS TABLE(first_name text, last_name text, tribe text, is_first_time boolean)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT a.first_name, a.last_name, a.tribe, a.is_first_time
  FROM public.influos_attendees a
  WHERE public.normalizar_nombre(p_first_name) <> ''
    AND public.normalizar_nombre(p_last_name) <> ''
    AND public.normalizar_nombre(a.first_name) = public.normalizar_nombre(p_first_name)
    AND public.normalizar_nombre(a.last_name)  = public.normalizar_nombre(p_last_name)
  ORDER BY a.created_at DESC
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.buscar_tribu_influos(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buscar_tribu_influos(text, text) TO anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 2. Día del Padre: los nombres de los hijos dejan de ser públicos
--
-- dpadre_hijos_select dejaba leer los 25 nombres y apellidos a cualquiera,
-- sin sesión. El ranking público (getRankingDPadre) los trae embebidos pero
-- no los muestra: sin permiso recibe la lista vacía y sigue funcionando.
-- La inscripción pública inserta hijos sin pedir la fila de vuelta, así que no
-- necesita leer. Los ven los roles de las pantallas de staff: AdminDPadre,
-- Puntuación y DetalleFamilia.
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS dpadre_hijos_select ON public.dpadre_hijos;
DROP POLICY IF EXISTS dpadre_hijos_select_staff ON public.dpadre_hijos;
CREATE POLICY dpadre_hijos_select_staff ON public.dpadre_hijos
  FOR SELECT TO authenticated
  USING ((SELECT public.tiene_rol(ARRAY['SUPER_ADMIN', 'PASTOR', 'EVENTOS', 'ENCARGADO_EVENTOS'])));


-- ════════════════════════════════════════════════════════════════════════════
-- 3. Buscar personas sin abrir la tabla users
--
-- Hoy cualquier usuario con sesión lee los 396 perfiles (email, teléfono,
-- fecha de nacimiento). La app lee a otras personas en cuatro situaciones que
-- no son de admin; cada una pasa a una función que devuelve solo lo necesario:
--
--   buscar_personas ............ co-anfitrión al crear/editar/reabrir un
--                                grupo, inscribir un participante,
--                                transferir un grupo. Solo anfitriones y
--                                staff; devuelve teléfono (lo necesitan para
--                                inscribir). Mínimo 2 letras, máximo 20.
--   buscar_usuario_por_email ... completar los datos de la pareja al
--                                anotarse. Cualquier usuario con sesión,
--                                email exacto; el teléfono solo vuelve si
--                                quien busca es anfitrión o staff.
--   nombres_de_usuarios ........ nombre de quien te ofrece una transferencia.
--
-- search_potential_hosts la podía llamar cualquier usuario con sesión y
-- devolvía emails por coincidencia parcial: queda para anfitriones y staff,
-- que son quienes la usan.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.buscar_personas(
    p_termino      text,
    p_por_email    boolean DEFAULT true,
    p_solo_activos boolean DEFAULT false,
    p_limite       integer DEFAULT 20
)
 RETURNS TABLE(id uuid, name text, email text, phone text, role text, roles text[],
               is_active boolean, linked_group_id uuid, volunteer_roles text[])
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
    v_patron text;
BEGIN
    IF auth.uid() IS NULL
       OR NOT public.tiene_rol(ARRAY['ANFITRION', 'CO_ANFITRION', 'SUPER_ADMIN', 'ADMIN_GROUPS', 'ENCARGADO_GRUPOS', 'PASTOR']) THEN
        RAISE EXCEPTION 'No tenés permisos para buscar personas';
    END IF;

    IF length(btrim(COALESCE(p_termino, ''))) < 2 THEN
        RETURN;
    END IF;

    -- Los comodines que tipee la persona se buscan literales.
    v_patron := '%' || replace(replace(replace(btrim(p_termino), '\', '\\'), '%', '\%'), '_', '\_') || '%';

    RETURN QUERY
    SELECT u.id, u.name, u.email, u.phone, u.role::text, u.roles,
           u.is_active, u.linked_group_id, u.volunteer_roles
    FROM public.users u
    WHERE (u.name ILIKE v_patron OR (p_por_email AND u.email ILIKE v_patron))
      AND (NOT p_solo_activos OR COALESCE(u.is_active, false))
    ORDER BY u.name
    LIMIT least(greatest(COALESCE(p_limite, 20), 1), 20);
END;
$function$;

REVOKE ALL ON FUNCTION public.buscar_personas(text, boolean, boolean, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buscar_personas(text, boolean, boolean, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.buscar_usuario_por_email(p_email text)
 RETURNS TABLE(id uuid, name text, phone text)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
    v_ve_telefono boolean;
BEGIN
    IF auth.uid() IS NULL OR btrim(COALESCE(p_email, '')) = '' THEN
        RETURN;
    END IF;

    v_ve_telefono := public.tiene_rol(ARRAY['ANFITRION', 'CO_ANFITRION', 'SUPER_ADMIN', 'ADMIN_GROUPS', 'ENCARGADO_GRUPOS', 'PASTOR']);

    RETURN QUERY
    SELECT u.id, u.name, CASE WHEN v_ve_telefono THEN u.phone ELSE NULL END
    FROM public.users u
    WHERE lower(btrim(u.email)) = lower(btrim(p_email))
    LIMIT 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.buscar_usuario_por_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buscar_usuario_por_email(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.nombres_de_usuarios(p_ids uuid[])
 RETURNS TABLE(id uuid, name text)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT u.id, u.name
  FROM public.users u
  WHERE auth.uid() IS NOT NULL
    AND u.id = ANY (p_ids[1:50]);
$function$;

REVOKE ALL ON FUNCTION public.nombres_de_usuarios(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nombres_de_usuarios(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.search_potential_hosts(search_term text)
 RETURNS TABLE(id uuid, name text, email text, role user_role)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
begin
  if auth.uid() is null
     or not public.tiene_rol(ARRAY['ANFITRION', 'CO_ANFITRION', 'SUPER_ADMIN', 'ADMIN_GROUPS', 'ENCARGADO_GRUPOS', 'PASTOR']) then
    raise exception 'No tenés permisos para buscar personas';
  end if;

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
$function$;

REVOKE EXECUTE ON FUNCTION public.search_potential_hosts(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_potential_hosts(text) TO authenticated;
