-- ==============================================================================
-- FIX: Robust Access for Approving/Rejecting Registrations
-- Use a SECURITY DEFINER function to bypass RLS complexity for this critical action
-- ==============================================================================

CREATE OR REPLACE FUNCTION manage_group_registration(
    p_registration_id UUID,
    p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (postgres/admin), bypassing RLS
SET search_path = public -- Secure search path
AS $$
DECLARE
    v_group_id UUID;
    v_host_id UUID;
    v_current_role TEXT;
    v_current_status TEXT;
    v_members_count INTEGER;
BEGIN
    -- 1. Get Registration Info necessary for checks
    SELECT group_id, status INTO v_group_id, v_current_status
    FROM group_registrations
    WHERE id = p_registration_id;

    IF NOT FOUND THEN
        RAISE NOTICE 'Registration not found';
        RETURN FALSE;
    END IF;

    -- 2. Get Group Host Info
    SELECT host_id, members_count INTO v_host_id, v_members_count
    FROM groups
    WHERE id = v_group_id;

    -- 3. Get Current User Role (Admin Check)
    SELECT role INTO v_current_role
    FROM public.users
    WHERE id = auth.uid();

    -- 4. PERMISSION CHECK
    -- Allow if: User is the Host OR User is Admin/SuperAdmin OR Pastor OR Co-Host
    IF v_host_id != auth.uid() AND v_current_role NOT IN ('SUPER_ADMIN', 'ADMIN_GROUPS', 'ANFITRION', 'PASTOR', 'CO_ANFITRION') THEN
        RAISE EXCEPTION 'Access Denied: You are not the host, admin, or pastor.';
    END IF;

    -- 5. UPDATE Status
    UPDATE group_registrations
    SET status = p_status
    WHERE id = p_registration_id;

    -- 6. Handle Member Count Logic (only if approving new member)
    IF p_status = 'APPROVED' AND v_current_status != 'APPROVED' THEN
        UPDATE groups
        SET members_count = COALESCE(members_count, 0) + 1
        WHERE id = v_group_id;
    END IF;

    -- Optional: If rejecting an already approved member, decrement?
    -- Depending on business logic. Safest is not to decrement automatically unless explicitly "removed".
    -- But for "Rejecting" a pending one, no change.
    
    RETURN TRUE;
END;
$$;
