-- ════════════════════════════════════════════════════════════════════════════
-- Dar el rol CO_ANFITRION al vincular un co-anfitrión
--
-- Estar en `groups.co_host_id` no alcanza para entrar al panel: las once
-- rutas /mis-grupos/* chequean hasRole(..., CO_ANFITRION), así que alguien
-- vinculado pero sin el rol ve el grupo en la base y la app lo manda a "/".
-- Hasta ahora el rol se daba a mano; por eso en septiembre 2026 hubo que
-- correr un backfill para dos personas que llevaban un grupo sin poder
-- abrirlo.
--
-- Esta función la llama el formulario después de guardar. Toma SÓLO el id del
-- grupo y saca de ahí a quién darle el rol: así quien la llama no puede
-- usarla para darle CO_ANFITRION a cualquiera, que es lo que pasaría si
-- recibiera el id de la persona.
--
-- Escribe en `roles[]` y no toca `role` (singular): pisarlo degradaría a un
-- co-anfitrión que además es ANFITRION de su propio grupo.
--
-- Nota sobre por qué agrega a roles[] aunque `role` ya sea CO_ANFITRION:
-- tiene_rol() mira las dos columnas, pero getUserRoles() del front ignora
-- `role` cuando `roles[]` tiene algo. Alguien con role='CO_ANFITRION' y
-- roles=['VIEWER'] pasa RLS y lo rebota el front. Dejarlo en roles[] es lo
-- que efectivamente le abre la puerta.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.asegurar_rol_co_anfitrion(p_group_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_co   uuid;
    v_host uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sin sesión';
    END IF;

    SELECT g.co_host_id, g.host_id INTO v_co, v_host
    FROM public.groups g
    WHERE g.id = p_group_id;

    -- Grupo inexistente o sin co-anfitrión: no hay nada que hacer, y no es
    -- un error —el formulario llama siempre, tenga o no co-anfitrión—.
    IF v_co IS NULL THEN
        RETURN false;
    END IF;

    -- Sólo quien lleva ese grupo, o staff de grupos.
    IF NOT (auth.uid() = v_host
            OR auth.uid() = v_co
            OR public.tiene_rol(ARRAY['SUPER_ADMIN', 'ADMIN_GROUPS', 'ENCARGADO_GRUPOS', 'PASTOR'])) THEN
        RAISE EXCEPTION 'No tenés permisos sobre este grupo';
    END IF;

    -- Nadie es su propio co-anfitrión: no repartir el rol por un dato malo.
    IF v_co = v_host THEN
        RETURN false;
    END IF;

    UPDATE public.users u
    SET roles = array_append(COALESCE(u.roles, ARRAY[]::text[]), 'CO_ANFITRION')
    WHERE u.id = v_co
      AND NOT ('CO_ANFITRION' = ANY (COALESCE(u.roles, ARRAY[]::text[])));

    RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.asegurar_rol_co_anfitrion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.asegurar_rol_co_anfitrion(uuid) TO authenticated;

-- ── Probar ─────────────────────────────────────────────────────────────────
-- Tiene que dar 0 filas: ningún co-anfitrión real sin el rol.
SELECT DISTINCT u.id, u.name, u.role, u.roles
FROM public.groups g
JOIN public.users u ON u.id = g.co_host_id
WHERE g.co_host_id IS NOT NULL
  AND g.co_host_id <> g.host_id
  AND NOT ('CO_ANFITRION' = ANY (COALESCE(u.roles, ARRAY[]::text[])));
