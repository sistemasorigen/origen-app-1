-- ════════════════════════════════════════════════════════════════════════
-- Modalidad híbrida para los grupos de conexión
-- 2026-09-21
--
-- ✅ APLICADO Y VERIFICADO en producción (Origen Iglesia, oqtumgalnozppqnnjjdb)
--    el 2026-09-21, en una sola transacción.
--    · Antes de aplicar: admin_update_group_v2 en vivo era idéntica a
--      sql/fix_host_edit_group_v2.sql (83 líneas, cero diferencias).
--    · Después: las dos columnas y las dos restricciones existen; 92 grupos
--      presenciales, 10 online, 0 híbridos; ninguna policy enumera columnas.
--    · Probado en un bloque deshecho con RAISE: presencial → híbrido,
--      híbrido → online (is_hybrid pasa a false aunque el payload diga true),
--      online → presencial sin mandar is_hybrid; el CHECK frena online +
--      híbrido y meeting_mode rechaza valores fuera de presencial/online.
--
-- Hasta hoy un grupo era presencial u online (groups.is_online). Se suma
-- "híbrido": se reúne en persona —tiene dirección— y a veces online. Al
-- tomar asistencia de un híbrido, el anfitrión elige cómo fue ESA reunión,
-- y eso alimenta la sección Híbrido de /reportes/gcx.
--
-- Qué hace:
--   1. groups.is_hybrid (boolean, default false). No se reemplaza is_online
--      por una columna de texto porque is_online la leen la app, el clon de
--      re-apertura y admin_update_group_v2; sumar una columna no rompe nada.
--   2. Un CHECK para que un grupo nunca sea online e híbrido a la vez.
--   3. group_attendance.meeting_mode ('presencial' | 'online' | NULL). NULL
--      en las reuniones de grupos que no son híbridos, que no eligen nada.
--   4. admin_update_group_v2 guarda is_hybrid. Sin esto, editar un grupo
--      desde el panel de anfitrión no guardaría la modalidad híbrida — el
--      mismo defecto que tuvo is_online hasta fix_host_edit_group_v2.sql.
--
-- El frontend ya está preparado para correr ANTES de este SQL sin romperse:
-- no nombra is_hybrid ni meeting_mode salvo cuando el valor es híbrido. Lo
-- único que no anda hasta correrlo es, justamente, crear o marcar un grupo
-- como híbrido.
--
-- Deshacer: sql/ROLLBACK_add_modalidad_hibrida.sql
-- ════════════════════════════════════════════════════════════════════════


-- 1. groups.is_hybrid
-- El DEFAULT false hace el backfill solo: todos los grupos que ya existen
-- quedan como estaban (presenciales u online).
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS is_hybrid BOOLEAN
NOT NULL DEFAULT false;

COMMENT ON COLUMN public.groups.is_hybrid IS
'true = grupo híbrido: se reúne en persona (location tiene la dirección) y a veces online. Nunca junto con is_online (CHECK groups_modalidad_unica). Al tomar asistencia se elige cómo fue cada reunión (group_attendance.meeting_mode).';


-- 2. Un grupo no puede ser online e híbrido a la vez
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'groups_modalidad_unica'
          AND conrelid = 'public.groups'::regclass
    ) THEN
        ALTER TABLE public.groups
        ADD CONSTRAINT groups_modalidad_unica CHECK (NOT (is_online AND is_hybrid));
    END IF;
END $$;


-- 3. group_attendance.meeting_mode
ALTER TABLE public.group_attendance
ADD COLUMN IF NOT EXISTS meeting_mode TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'group_attendance_meeting_mode_valido'
          AND conrelid = 'public.group_attendance'::regclass
    ) THEN
        ALTER TABLE public.group_attendance
        ADD CONSTRAINT group_attendance_meeting_mode_valido
        CHECK (meeting_mode IS NULL OR meeting_mode IN ('presencial', 'online'));
    END IF;
END $$;

COMMENT ON COLUMN public.group_attendance.meeting_mode IS
'Cómo fue la reunión en un grupo híbrido: presencial u online. NULL en los grupos que no son híbridos, y en las reuniones cargadas antes de que el grupo lo fuera.';


-- 4. admin_update_group_v2 — igual a sql/fix_host_edit_group_v2.sql más
-- is_hybrid. Todo lo demás (quién puede editar, qué campos toca cada uno)
-- queda exactamente como estaba.
CREATE OR REPLACE FUNCTION public.admin_update_group_v2(p_group_id text, p_group_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_updated_group JSONB;
    v_actual        public.groups%ROWTYPE;
    v_es_admin      boolean;
    v_es_anfitrion  boolean;
    v_es_coanfitrion boolean;
    v_status        text;
    v_online        boolean;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: session required';
    END IF;

    SELECT * INTO v_actual FROM public.groups WHERE id = p_group_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Group not found';
    END IF;

    v_es_admin       := public.tiene_rol(ARRAY['SUPER_ADMIN','PASTOR','ADMIN_GROUPS','ENCARGADO_GRUPOS']);
    -- COALESCE: con host_id o co_host_id en NULL la comparación da NULL, y un
    -- NULL dentro del IF de abajo dejaría pasar a cualquiera.
    v_es_anfitrion   := COALESCE(auth.uid() = v_actual.host_id, false);
    v_es_coanfitrion := COALESCE(auth.uid() = v_actual.co_host_id, false);

    IF NOT (v_es_admin OR v_es_anfitrion OR v_es_coanfitrion) THEN
        RAISE EXCEPTION 'Unauthorized: only the group host, co-host or an admin can edit this group';
    END IF;

    IF v_es_admin THEN
        v_status := COALESCE(p_group_data->>'status', v_actual.status);
    ELSIF v_actual.status = 'rejected' AND p_group_data->>'status' = 'pending' THEN
        v_status := 'pending';
    ELSE
        v_status := v_actual.status;
    END IF;

    -- Si el grupo queda online, deja de ser híbrido aunque el payload no diga
    -- nada de is_hybrid (una pestaña con la versión anterior de la app no lo
    -- manda): así el CHECK groups_modalidad_unica nunca hace fallar la edición.
    v_online := COALESCE((p_group_data->>'is_online')::boolean, v_actual.is_online);

    UPDATE groups
    SET
        name = COALESCE((p_group_data->>'name'), name),
        status = v_status,
        leader_name = COALESCE((p_group_data->>'leader_name'), leader_name),
        leader_surname = COALESCE((p_group_data->>'leader_surname'), leader_surname),
        leader_phone = COALESCE((p_group_data->>'leader_phone'), leader_phone),
        meeting_day = COALESCE((p_group_data->>'meeting_day'), meeting_day),
        meeting_time = COALESCE((p_group_data->>'meeting_time'), meeting_time),
        start_date = (p_group_data->>'start_date')::text,
        end_date = NULLIF(p_group_data->>'end_date', '')::date,
        location = COALESCE((p_group_data->>'location'), location),
        is_online = v_online,
        is_hybrid = CASE WHEN v_online THEN false
                         ELSE COALESCE((p_group_data->>'is_hybrid')::boolean, is_hybrid) END,
        members_count = CASE WHEN v_es_admin
                             THEN COALESCE((p_group_data->>'members_count')::int, members_count)
                             ELSE members_count END,
        max_capacity = COALESCE((p_group_data->>'max_capacity')::int, max_capacity),
        description = COALESCE((p_group_data->>'description'), description),
        image_url = COALESCE((p_group_data->>'image_url'), image_url),
        category_id = COALESCE((p_group_data->>'category_id'), category_id),
        tags = CASE
            WHEN (p_group_data->'tags') IS NULL THEN tags
            ELSE ARRAY(SELECT jsonb_array_elements_text(p_group_data->'tags'))
        END,
        host_id = CASE
            WHEN NOT v_es_admin THEN host_id
            WHEN (p_group_data->>'host_id') IS NULL OR (p_group_data->>'host_id') = '' THEN NULL
            ELSE (p_group_data->>'host_id')::uuid
        END,
        co_host_id = CASE
            WHEN NOT (v_es_admin OR v_es_anfitrion) THEN co_host_id
            WHEN (p_group_data->>'co_host_id') IS NULL OR (p_group_data->>'co_host_id') = '' THEN NULL
            ELSE (p_group_data->>'co_host_id')::uuid
        END,
        co_host_first_name = COALESCE((p_group_data->>'co_host_first_name'), co_host_first_name),
        co_host_last_name = COALESCE((p_group_data->>'co_host_last_name'), co_host_last_name),
        min_age = COALESCE((p_group_data->>'min_age')::int, min_age),
        max_age = COALESCE((p_group_data->>'max_age')::int, max_age),
        target_gender = COALESCE((p_group_data->>'target_gender'), target_gender),
        admin_note = CASE WHEN v_es_admin
                          THEN COALESCE((p_group_data->>'admin_note'), admin_note)
                          ELSE admin_note END
    WHERE id = p_group_id
    RETURNING to_jsonb(groups.*) INTO v_updated_group;

    RETURN v_updated_group;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_update_group_v2(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_group_v2(text, jsonb) TO authenticated;


-- 5. Refrescar el cache de esquema de PostgREST
-- Sin esto las columnas existen en Postgres pero la API no las expone hasta
-- que el cache se renueve solo. Mismo paso que en add_groups_is_online.sql.
NOTIFY pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN — correr después de lo de arriba
-- ════════════════════════════════════════════════════════════════════════

-- A) Las dos columnas existen
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'groups' AND column_name = 'is_hybrid')
    OR (table_name = 'group_attendance' AND column_name = 'meeting_mode'));
-- Esperado: groups.is_hybrid | boolean | NO | false
--           group_attendance.meeting_mode | text | YES | NULL

-- B) Nada quedó híbrido por accidente, y ningún grupo es online e híbrido
SELECT is_online, is_hybrid, count(*) FROM public.groups GROUP BY 1, 2 ORDER BY 1, 2;
-- Esperado: sólo filas con is_hybrid = false hasta que se cree el primero.

-- C) Ninguna policy enumera columnas (si alguna lo hiciera, habría que
-- actualizarla). Igual que al agregar is_online, no debería hacer falta.
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('groups', 'group_attendance')
ORDER BY tablename, policyname;

-- D) La función quedó con is_hybrid
SELECT position('is_hybrid' IN pg_get_functiondef('public.admin_update_group_v2(text, jsonb)'::regprocedure)) > 0
       AS guarda_is_hybrid;
-- Esperado: true
