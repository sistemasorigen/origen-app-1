-- ROLLBACK: restaura admin_update_group_v2 tal como estaba antes de fix_host_edit_group_v2.sql
-- (versión de la migración fix_critical_privilege_escalation_admin_functions, 01/09/2026)

CREATE OR REPLACE FUNCTION public.admin_update_group_v2(p_group_id text, p_group_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_updated_group JSONB;
    v_caller_role public.user_role;
    v_caller_roles public.user_role[];
BEGIN
    SELECT role, roles INTO v_caller_role, v_caller_roles
    FROM public.users WHERE id = auth.uid();

    IF NOT (
        v_caller_role = ANY(ARRAY['SUPER_ADMIN','PASTOR','ADMIN_GROUPS','ENCARGADO_GRUPOS']::public.user_role[])
        OR COALESCE(v_caller_roles, ARRAY[]::public.user_role[]) && ARRAY['SUPER_ADMIN','PASTOR','ADMIN_GROUPS','ENCARGADO_GRUPOS']::public.user_role[]
    ) THEN
        RAISE EXCEPTION 'Unauthorized: admin role required';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM groups WHERE id = p_group_id) THEN
        RAISE EXCEPTION 'Group not found';
    END IF;

    UPDATE groups
    SET
        name = COALESCE((p_group_data->>'name'), name),
        status = COALESCE((p_group_data->>'status'), status),
        leader_name = COALESCE((p_group_data->>'leader_name'), leader_name),
        leader_surname = COALESCE((p_group_data->>'leader_surname'), leader_surname),
        leader_phone = COALESCE((p_group_data->>'leader_phone'), leader_phone),
        meeting_day = COALESCE((p_group_data->>'meeting_day'), meeting_day),
        meeting_time = COALESCE((p_group_data->>'meeting_time'), meeting_time),
        start_date = (p_group_data->>'start_date')::text,
        end_date = NULLIF(p_group_data->>'end_date', '')::date,
        location = COALESCE((p_group_data->>'location'), location),
        members_count = COALESCE((p_group_data->>'members_count')::int, members_count),
        max_capacity = COALESCE((p_group_data->>'max_capacity')::int, max_capacity),
        description = COALESCE((p_group_data->>'description'), description),
        image_url = COALESCE((p_group_data->>'image_url'), image_url),
        category_id = COALESCE((p_group_data->>'category_id'), category_id),
        tags = CASE
            WHEN (p_group_data->'tags') IS NULL THEN tags
            ELSE ARRAY(SELECT jsonb_array_elements_text(p_group_data->'tags'))
        END,
        host_id = CASE
            WHEN (p_group_data->>'host_id') IS NULL OR (p_group_data->>'host_id') = '' THEN NULL
            ELSE (p_group_data->>'host_id')::uuid
        END,
        co_host_id = CASE
            WHEN (p_group_data->>'co_host_id') IS NULL OR (p_group_data->>'co_host_id') = '' THEN NULL
            ELSE (p_group_data->>'co_host_id')::uuid
        END,
        co_host_first_name = COALESCE((p_group_data->>'co_host_first_name'), co_host_first_name),
        co_host_last_name = COALESCE((p_group_data->>'co_host_last_name'), co_host_last_name),
        min_age = COALESCE((p_group_data->>'min_age')::int, min_age),
        max_age = COALESCE((p_group_data->>'max_age')::int, max_age),
        target_gender = COALESCE((p_group_data->>'target_gender'), target_gender),
        admin_note = COALESCE((p_group_data->>'admin_note'), admin_note)
    WHERE id = p_group_id
    RETURNING to_jsonb(groups.*) INTO v_updated_group;

    RETURN v_updated_group;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_update_group_v2(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_group_v2(text, jsonb) TO authenticated;
