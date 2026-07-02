-- Feature: coordinador multi-rol — un usuario COORDINATOR puede
-- tener varios departamentos asignados (array) en vez de uno solo.
-- coordinator_variant (singular) se mantiene como legacy/compatibilidad,
-- sincronizado con el primer elemento del array.

-- ==============================================================
-- PASO 1 (verificación previa, ejecutada con MCP antes de tocar nada)
-- ==============================================================
-- SELECT proname, pg_get_functiondef(oid)
-- FROM pg_proc
-- WHERE proname IN ('admin_assign_role', 'admin_remove_role')
-- AND pronamespace = 'public'::regnamespace;
--
-- Resultado real: admin_assign_role tenía DOS overloads en producción:
--   · (target_user_id uuid, new_role text) — legacy, sin variant,
--     permisos simples IN ('ADMIN','SUPERADMIN','ENCARGADO_GRUPOS').
--     No se tocó, no está relacionada a coordinator_variant.
--   · (target_user_id uuid, new_role text, new_variant text DEFAULT NULL)
--     — la que usa hoy updateUserRole. Permisos por alcance:
--     roles privilegiados solo asignables por SUPER_ADMIN,
--     ADMIN_GROUPS/ENCARGADO_GRUPOS limitados a roles de grupos.
--     Esta es la que se recreó en el PASO 3 (3→4 params).
--
-- admin_remove_role existe con ese nombre exacto y ya limpiaba
-- coordinator_variant al remover COORDINATOR (PASO 4 le agregó
-- limpieza de coordinator_variants).

-- ==============================================================
-- PASO 2 — columna array + migración + constraint
-- ==============================================================

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS coordinator_variants TEXT[]
NOT NULL DEFAULT '{}';

UPDATE public.users
SET coordinator_variants = ARRAY[coordinator_variant]
WHERE coordinator_variant IS NOT NULL
AND coordinator_variants = '{}';

ALTER TABLE public.users
ADD CONSTRAINT check_coordinator_variants_array
CHECK (coordinator_variants <@ ARRAY[
  'FINANZAS', 'PAREJAS', 'CENTRO_TRANSFORMACION',
  'TERCERA_EDAD', 'BIBLIA', 'INUSUAL',
  'PRE_ADOLESCENTES', 'ADOLESCENTES', 'FAMILIA',
  'RELACIONAL', 'VOLUNTARIOS', 'NINEZ',
  'JOVENES_26_35', 'MUJERES', 'ORIGEN_SOCIAL',
  'HOMBRES', 'JOVENES_18_25'
]::TEXT[]);

COMMENT ON COLUMN public.users.coordinator_variants IS
'Array de departamentos para usuarios con rol COORDINATOR. Reemplaza gradualmente a coordinator_variant (legacy, singular).';

-- ==============================================================
-- PASO 3 — admin_assign_role: 3 params → 4 params (agrega new_variants)
-- Preserva EXACTAMENTE la lógica de permisos real de producción.
-- ==============================================================

DROP FUNCTION IF EXISTS public.admin_assign_role(uuid, text, text);

CREATE FUNCTION public.admin_assign_role(
  target_user_id UUID,
  new_role TEXT,
  new_variant TEXT DEFAULT NULL,
  new_variants TEXT[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role TEXT;
  v_privileged_roles TEXT[] := ARRAY[
    'SUPER_ADMIN','PASTOR','ADMIN_PUNTO','ADMIN_GROUPS',
    'ADMIN_STORE','ADMIN_ALABANZA','ADMIN_CUIDADO_PASTORAL'
  ];
BEGIN
  SELECT role INTO v_caller_role FROM users WHERE id = auth.uid();

  IF new_role = ANY(v_privileged_roles) THEN
    IF v_caller_role != 'SUPER_ADMIN' THEN
      RAISE EXCEPTION 'Solo SUPER_ADMIN puede asignar roles privilegiados';
    END IF;
  ELSIF v_caller_role IN ('ADMIN_GROUPS','ENCARGADO_GRUPOS') THEN
    IF new_role NOT IN ('ANFITRION','CO_ANFITRION',
                        'VOLUNTARIO_GRUPOS','COORDINATOR') THEN
      RAISE EXCEPTION 'Rol fuera de tu alcance';
    END IF;
  ELSE
    RAISE EXCEPTION 'No tenés permisos para asignar roles';
  END IF;

  UPDATE users SET
    role = new_role::public.user_role,
    roles = array_append(array_remove(roles, new_role), new_role),
    coordinator_variants = CASE
        WHEN new_variants IS NOT NULL THEN new_variants
        ELSE coordinator_variants
    END,
    coordinator_variant = CASE
        WHEN new_variants IS NOT NULL THEN
            CASE WHEN array_length(new_variants, 1) > 0
                 THEN new_variants[1]
                 ELSE NULL
            END
        ELSE COALESCE(new_variant, coordinator_variant)
    END
  WHERE id = target_user_id;
END;
$$;

-- ==============================================================
-- PASO 4 — admin_remove_role: limpia coordinator_variants también
-- ==============================================================

CREATE OR REPLACE FUNCTION public.admin_remove_role(target_user_id uuid, role_to_remove text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role TEXT;
  v_new_roles TEXT[];
BEGIN
  SELECT role INTO v_caller_role FROM users WHERE id = auth.uid();

  IF v_caller_role IN ('ADMIN', 'SUPER_ADMIN', 'SUPERADMIN', 'ENCARGADO_GRUPOS', 'ADMIN_GROUPS') THEN

    UPDATE users
    SET
        roles = array_remove(roles, role_to_remove),
        coordinator_variant = CASE WHEN role_to_remove = 'COORDINATOR' THEN NULL ELSE coordinator_variant END,
        coordinator_variants = CASE WHEN role_to_remove = 'COORDINATOR' THEN '{}'::TEXT[] ELSE coordinator_variants END
    WHERE id = target_user_id
    RETURNING roles INTO v_new_roles;

    IF (SELECT role FROM users WHERE id = target_user_id) = role_to_remove::public.user_role THEN
        UPDATE users
        SET role = COALESCE(v_new_roles[1]::public.user_role, 'USUARIO'::public.user_role)
        WHERE id = target_user_id;
    END IF;

  ELSE
    RAISE EXCEPTION 'No tienes permisos';
  END IF;
END;
$$;

-- ==============================================================
-- Verificación
-- ==============================================================

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('coordinator_variant', 'coordinator_variants');

SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'admin_assign_role'
AND pronamespace = 'public'::regnamespace;
