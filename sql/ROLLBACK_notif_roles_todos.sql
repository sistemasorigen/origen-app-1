-- DESHACER sql/notif_roles_todos.sql (2026-10-30): la lista vuelve a dejar
-- afuera los roles sin nadie. Definición viva de antes del cambio.

CREATE OR REPLACE FUNCTION public.notif_roles_disponibles()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF auth.uid() IS NULL OR NOT public.tiene_rol(ARRAY['SUPER_ADMIN']) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    RETURN jsonb_build_object('ok', true, 'roles', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('rol', t.rol, 'personas', t.n) ORDER BY t.n DESC, t.rol)
          FROM (SELECT r AS rol,
                       (SELECT count(*) FROM public.users u
                         WHERE u.is_active IS NOT FALSE
                           AND ((u.role)::text = r OR COALESCE(u.roles, '{}') @> ARRAY[r])) AS n
                  FROM unnest(public.notif_roles_validos()) r) t
         WHERE t.n > 0), '[]'::jsonb));
END;
$function$
;
