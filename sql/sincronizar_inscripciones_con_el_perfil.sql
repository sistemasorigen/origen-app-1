-- ════════════════════════════════════════════════════════════════════════════
-- GCX — las inscripciones siguen al perfil
-- 2026-10-22 · ✅ APLICADO el 2026-10-22 (probado en una transacción que se deshizo)
--
-- EL PROBLEMA
--
-- Al inscribirse a un GCX se COPIAN el nombre, el email y el teléfono de la
-- cuenta a la fila de group_registrations (y, si es la pareja de otro, a
-- partner_data). Esa copia no se actualizaba nunca: quien corregía su
-- teléfono en /perfil seguía figurando con el viejo en la lista del
-- anfitrión.
--
-- Desde el 2026-10-22 la inscripción ya no deja editar esos datos: muestra
-- los de la cuenta y manda a /perfil para cambiarlos. Así la copia nace igual
-- al perfil, y esto la mantiene igual después.
--
-- POR QUÉ UN TRIGGER (Y NO LA RPC DE sincronizar_datos_del_perfil.sql)
--
-- Esa RPC nunca se aplicó y sólo corría al guardar /perfil. El teléfono
-- también se carga en "Completá tu perfil" y lo cambian los admins. Un
-- trigger en `users` cubre todos los caminos, igual que
-- sincronizar_nombre_anfitriones.sql hace con los anfitriones desde el
-- 2026-10-05. Este archivo reemplaza la parte de inscripciones de aquel; la
-- app sigue llamando a sincronizar_mis_datos al guardar el perfil, que falla
-- en silencio mientras no exista y no hace falta crearla.
--
-- SECURITY DEFINER porque la policy de UPDATE de group_registrations no deja
-- que alguien toque su propia inscripción una vez aprobada — justo los que
-- importan. El trigger toca sólo nombre, email y teléfono: `status` no se
-- nombra en ningún UPDATE.
--
-- QUÉ NO TOCA: baptisms, presentations, dianino_tickets, movements,
-- nocturna_inscripciones. Son actas o autorizaciones firmadas con un nombre
-- (ver sincronizar_datos_del_perfil.sql).
--
-- EL COSTO: a partir de acá el perfil manda. Si una inscripción vieja tenía
-- un apellido corregido a mano, se pisa la próxima vez que esa persona cambie
-- su perfil. Un perfil que queda sin nombre, email o teléfono no borra lo que
-- ya tenía la inscripción: un campo vacío no es una corrección.
--
-- ANTES DE CORRER: mirar el tipo de partner_data. Abajo se lo trata como
-- jsonb; si quedó como `json`, cambiar el `||` por el cast que se indica.
--
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'group_registrations' AND column_name = 'partner_data';
--
-- Deja una fila en audit_logs por cada inscripción que cambia. Es esperable.
-- Para deshacer: sql/ROLLBACK_sincronizar_inscripciones_con_el_perfil.sql
-- ════════════════════════════════════════════════════════════════════════════


-- ── Cortar "Nombre Apellido" igual que el formulario ────────────────────────
-- Idéntica a la de sincronizar_nombre_anfitriones.sql (ya aplicada): primera
-- palabra nombre, el resto apellido, como hace ModalUnirseGrupo.
CREATE OR REPLACE FUNCTION public.partir_nombre(p_completo TEXT)
RETURNS TABLE (nombre TEXT, apellido TEXT)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v TEXT := btrim(COALESCE(p_completo, ''));
    v_corte INTEGER;
BEGIN
    v_corte := position(' ' IN v);
    IF v_corte = 0 THEN
        RETURN QUERY SELECT v, ''::TEXT;
    ELSE
        RETURN QUERY SELECT substr(v, 1, v_corte - 1), btrim(substr(v, v_corte + 1));
    END IF;
END;
$$;


-- ── Cambia el perfil → cambian sus inscripciones ────────────────────────────
CREATE OR REPLACE FUNCTION public.llevar_perfil_a_las_inscripciones()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_nombre   TEXT;
    v_apellido TEXT;
    v_email    TEXT := btrim(COALESCE(NEW.email, ''));
    v_telefono TEXT := btrim(COALESCE(NEW.phone, ''));
BEGIN
    SELECT p.nombre, p.apellido INTO v_nombre, v_apellido
      FROM public.partir_nombre(regexp_replace(COALESCE(NEW.name, ''), '\s+', ' ', 'g')) p;

    -- 1 · Donde es el titular. Lo vacío del perfil no pisa lo que había.
    UPDATE public.group_registrations r
       SET first_name = CASE WHEN v_nombre <> '' THEN v_nombre   ELSE r.first_name END,
           last_name  = CASE WHEN v_nombre <> '' THEN v_apellido ELSE r.last_name  END,
           email      = COALESCE(NULLIF(v_email, ''),    r.email),
           phone      = COALESCE(NULLIF(v_telefono, ''), r.phone)
     WHERE r.user_id = NEW.id
       AND ((v_nombre <> '' AND (r.first_name IS DISTINCT FROM v_nombre OR r.last_name IS DISTINCT FROM v_apellido))
         OR (v_email    <> '' AND r.email IS DISTINCT FROM v_email)
         OR (v_telefono <> '' AND r.phone IS DISTINCT FROM v_telefono));

    -- 2 · Donde es la pareja de otro. Se mezcla sobre lo que ya está (||)
    --     para no borrar claves que esto no conoce.
    --     Si partner_data es `json` y no `jsonb`: envolver la expresión en
    --     ( ... )::json.
    UPDATE public.group_registrations r
       SET partner_data = COALESCE(r.partner_data::jsonb, '{}'::jsonb) || jsonb_build_object(
               'firstName', CASE WHEN v_nombre <> '' THEN v_nombre   ELSE r.partner_data->>'firstName' END,
               'lastName',  CASE WHEN v_nombre <> '' THEN v_apellido ELSE r.partner_data->>'lastName'  END,
               'email',     COALESCE(NULLIF(v_email, ''),    r.partner_data->>'email'),
               'phone',     COALESCE(NULLIF(v_telefono, ''), r.partner_data->>'phone')
           )
     WHERE r.partner_user_id = NEW.id
       AND ((v_nombre <> '' AND ((r.partner_data->>'firstName') IS DISTINCT FROM v_nombre
                              OR (r.partner_data->>'lastName')  IS DISTINCT FROM v_apellido))
         OR (v_email    <> '' AND (r.partner_data->>'email') IS DISTINCT FROM v_email)
         OR (v_telefono <> '' AND (r.partner_data->>'phone') IS DISTINCT FROM v_telefono));

    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.llevar_perfil_a_las_inscripciones() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS llevar_perfil_a_las_inscripciones ON public.users;
CREATE TRIGGER llevar_perfil_a_las_inscripciones
    AFTER UPDATE OF name, email, phone ON public.users
    FOR EACH ROW
    WHEN (OLD.name  IS DISTINCT FROM NEW.name
       OR OLD.email IS DISTINCT FROM NEW.email
       OR OLD.phone IS DISTINCT FROM NEW.phone)
    EXECUTE FUNCTION public.llevar_perfil_a_las_inscripciones();


-- ════════════════════════════════════════════════════════════════════════════
-- OPCIONAL — emparejar de una vez lo que hoy ya está desfasado
-- ════════════════════════════════════════════════════════════════════════════
-- El trigger corrige a cada persona recién cuando cambie su perfil. Esto
-- empareja a todos ahora. Pisa datos escritos a mano que no coincidan con el
-- perfil y no se deshace sin backup: primero mirar CUÁNTAS filas cambian.
/*

SELECT count(*) AS inscripciones_desfasadas
  FROM public.group_registrations r
  JOIN public.users u ON u.id = r.user_id
  JOIN LATERAL public.partir_nombre(regexp_replace(COALESCE(u.name,''), '\s+', ' ', 'g')) p ON true
 WHERE (p.nombre <> '' AND (r.first_name IS DISTINCT FROM p.nombre OR r.last_name IS DISTINCT FROM p.apellido))
    OR (btrim(COALESCE(u.email,'')) <> '' AND r.email IS DISTINCT FROM btrim(u.email))
    OR (btrim(COALESCE(u.phone,'')) <> '' AND r.phone IS DISTINCT FROM btrim(u.phone));

-- Una muestra para mirar con ojos:
SELECT r.id, r.first_name || ' ' || r.last_name AS inscripcion, u.name AS perfil,
       r.phone AS tel_inscripcion, u.phone AS tel_perfil
  FROM public.group_registrations r
  JOIN public.users u ON u.id = r.user_id
 WHERE r.phone IS DISTINCT FROM u.phone OR (r.first_name || ' ' || r.last_name) IS DISTINCT FROM u.name
 LIMIT 30;

-- El emparejado (misma regla que el trigger, para los titulares):
UPDATE public.group_registrations r
   SET first_name = p.nombre,
       last_name  = p.apellido,
       email      = COALESCE(NULLIF(btrim(u.email), ''), r.email),
       phone      = COALESCE(NULLIF(btrim(u.phone), ''), r.phone)
  FROM public.users u,
       LATERAL public.partir_nombre(regexp_replace(COALESCE(u.name,''), '\s+', ' ', 'g')) p
 WHERE u.id = r.user_id
   AND p.nombre <> '';

*/
