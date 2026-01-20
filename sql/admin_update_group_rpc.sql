-- Create RPC to update group bypassing RLS (for Admin use)
-- This avoids issues where RLS policies for 'update' are stricter than needed for admins

-- DROP old function to avoid signature conflicts if types change
DROP FUNCTION IF EXISTS admin_update_group_v2(uuid, jsonb);

CREATE OR REPLACE FUNCTION admin_update_group_v2(
    p_group_id TEXT, -- Changed from UUID to TEXT matching groups.id type
    p_group_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (postgres/service_role)
SET search_path = public -- Best practice for SECURITY DEFINER functions
AS $$
DECLARE
    v_updated_group JSONB;
BEGIN
    -- Check if group exists
    IF NOT EXISTS (SELECT 1 FROM groups WHERE id = p_group_id) THEN
        RAISE EXCEPTION 'Group not found';
    END IF;

    -- Update row
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
        location = COALESCE((p_group_data->>'location'), location),
        members_count = COALESCE((p_group_data->>'members_count')::int, members_count),
        max_capacity = COALESCE((p_group_data->>'max_capacity')::int, max_capacity),
        description = COALESCE((p_group_data->>'description'), description),
        image_url = COALESCE((p_group_data->>'image_url'), image_url),
        category_id = COALESCE((p_group_data->>'category_id'), category_id),
        
        -- Handle Array: Tags
        tags = CASE 
            WHEN (p_group_data->'tags') IS NULL THEN tags 
            ELSE ARRAY(SELECT jsonb_array_elements_text(p_group_data->'tags')) 
        END,

        -- Handle UUIDs
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
$$;
