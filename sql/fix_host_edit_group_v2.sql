-- ============================================================================
-- Anfitriones: no podían editar sus grupos APROBADOS
--
-- La migración fix_critical_privilege_escalation_admin_functions (01/09/2026)
-- cerró un agujero real en admin_update_group_v2: la función no validaba
-- quién la llamaba, así que cualquier usuario con sesión podía modificar
-- cualquier grupo, incluido aprobarse el propio. El arreglo la dejó sólo para
-- admins, pero el anfitrión usa esta misma función desde dos pantallas:
--   · pages/groups/PaginaEditarGrupo.tsx      (formulario de edición)
--   · pages/groups/DetalleGrupoAnfitrion.tsx  (cambio de portada)
-- Desde ese día toda edición de un anfitrión sin rol de admin termina en
-- 'Unauthorized: admin role required'. En audit_logs la última edición de
-- contenido hecha por un anfitrión puro es del 07/08/2026.
--
-- Este arreglo NO reabre el agujero. Autoriza a admins, y al anfitrión o
-- co-anfitrión del grupo que se está editando (según la fila guardada, nunca
-- según lo que llega en el payload). Para quien no es admin, la función
-- ignora los campos que sólo un admin debe tocar:
--   · status      se conserva; la única transición permitida es
--                 rejected → pending (re-enviar un grupo rechazado), que es lo
--                 que ya hacía el frontend. Un anfitrión no puede aprobarse.
--   · host_id     no puede reasignar el grupo (las transferencias tienen su
--                 propio circuito en group_transfer_requests).
--   · co_host_id  lo cambia el anfitrión principal; el co-anfitrión no.
--   · members_count  lo mantiene el trigger de inscripciones.
--   · admin_note  es la nota del admin al anfitrión.
-- Para admins el comportamiento queda exactamente igual que antes.
--
-- De paso corrige dos defectos de la misma función:
--   · El chequeo de rol leía users.roles en una variable user_role[]. Hay
--     valores en roles[] que no existen en el enum (PRODE,
--     ADMIN_CUIDADO_PASTORAL): para cualquier admin que tuviera uno, la
--     conversión explotaba antes de llegar al chequeo. tiene_rol() compara
--     como texto y mira las dos columnas de rol.
--   · is_online no estaba en el UPDATE: el toggle "online" del formulario
--     nunca se guardó al editar (cero cambios de esa columna en audit_logs).
--
-- El nombre admin_update_group_v2 queda desactualizado, pero renombrarla
-- exige cambiar el frontend y desplegar; se mantiene para no mezclar eso con
-- este arreglo.
-- ============================================================================

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
        is_online = COALESCE((p_group_data->>'is_online')::boolean, is_online),
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

-- CREATE OR REPLACE conserva los privilegios, pero se reafirman para que el
-- archivo sea autosuficiente: nunca invocable sin sesión.
REVOKE EXECUTE ON FUNCTION public.admin_update_group_v2(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_group_v2(text, jsonb) TO authenticated;
