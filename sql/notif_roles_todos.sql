-- ════════════════════════════════════════════════════════════════════════════
-- NOTIFICACIONES — la lista de roles trae TODOS los roles
-- 2026-10-30 · ✅ APLICADO el 2026-10-30 (PROBAR_notif_programadas 93/93 contra producción)
--
-- "4 · A quién le llega → O por roles" pasó de chips a una lista desplegable
-- con todas las opciones. notif_roles_disponibles dejaba afuera los roles sin
-- nadie (WHERE t.n > 0); ahora devuelve todos los de notif_roles_validos(),
-- cada uno con su cantidad (también 0). Sólo lectura, sólo SUPER_ADMIN.
--
-- Parte de la definición viva del 2026-10-30 (igual a sql/notif_programadas.sql);
-- lo único que cambia es que se fue el WHERE.
--
-- Pruebas: sql/PROBAR_notif_programadas.sql (A8, A9)
-- Deshacer: sql/ROLLBACK_notif_roles_todos.sql
-- ════════════════════════════════════════════════════════════════════════════

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
                  FROM unnest(public.notif_roles_validos()) r) t), '[]'::jsonb));
END;
$function$;
