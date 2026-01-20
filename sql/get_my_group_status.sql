-- =====================================================
-- FIX: Partner Status Visibility v4 (CAST TO UUID)
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Drop ALL old function signatures
DROP FUNCTION IF EXISTS get_my_group_status(uuid, uuid, text);
DROP FUNCTION IF EXISTS get_my_group_status(text, text, text);

-- 2. Create function with TEXT params but CAST to UUID for comparison
CREATE OR REPLACE FUNCTION get_my_group_status(
  query_group_id TEXT,
  query_user_id TEXT,
  query_user_email TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_email_normalized TEXT;
  v_group_uuid UUID;
  v_user_uuid UUID;
BEGIN
  -- Normalize email input
  v_email_normalized := LOWER(TRIM(COALESCE(query_user_email, '')));
  
  -- Cast TEXT inputs to UUID for comparison
  BEGIN
    v_group_uuid := query_group_id::UUID;
    v_user_uuid := query_user_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    -- If casting fails, return null (invalid IDs)
    RETURN NULL;
  END;
  
  -- Find registration where user is main applicant OR partner
  SELECT status INTO v_status
  FROM group_registrations
  WHERE group_id = v_group_uuid
    AND (
      -- Match by user_id (UUID comparison)
      user_id = v_user_uuid
      -- Match by partner_user_id (UUID comparison)
      OR partner_user_id = v_user_uuid
      -- Match by main email
      OR LOWER(TRIM(COALESCE(email, ''))) = v_email_normalized
      -- Match by partner email in JSONB
      OR LOWER(TRIM(COALESCE(partner_data->>'email', ''))) = v_email_normalized
    )
  ORDER BY 
    CASE UPPER(status) 
      WHEN 'APPROVED' THEN 1 
      WHEN 'PENDING' THEN 2 
      WHEN 'REJECTED' THEN 3 
      ELSE 4
    END
  LIMIT 1;
  
  RETURN v_status;
END;
$$;

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION get_my_group_status(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_group_status(TEXT, TEXT, TEXT) TO anon;

SELECT 'get_my_group_status v4 (CAST TO UUID) created!' AS status;
