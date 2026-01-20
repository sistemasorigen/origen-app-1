-- =====================================================
-- Couples Registration: Dual Visibility Status Check
-- Run this in Supabase SQL Editor
-- =====================================================

-- This RPC returns the registration status for a user in a group,
-- checking both as main applicant (user_id) OR as partner (partner_data->>'email')
-- Priority: APPROVED > PENDING > REJECTED

CREATE OR REPLACE FUNCTION get_couple_registration_status(
  p_group_id UUID,
  p_user_id UUID,
  p_email TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  -- Find registration where user is involved (main or partner)
  -- Order by priority (APPROVED first, then PENDING, then REJECTED)
  SELECT status INTO v_status
  FROM group_registrations
  WHERE group_id = p_group_id
    AND (
      user_id = p_user_id 
      OR partner_user_id = p_user_id
      OR LOWER(TRIM(partner_data->>'email')) = LOWER(TRIM(p_email))
      OR LOWER(TRIM(email)) = LOWER(TRIM(p_email))
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_couple_registration_status TO authenticated;
GRANT EXECUTE ON FUNCTION get_couple_registration_status TO anon;

-- =====================================================
-- Upsert Registration: Handle Re-Application (Rejected -> Pending)
-- =====================================================

CREATE OR REPLACE FUNCTION upsert_couple_registration(
  p_id UUID,
  p_group_id UUID,
  p_user_id UUID,
  p_user_email TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_phone TEXT,
  p_partner_data JSONB DEFAULT NULL,
  p_partner_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing RECORD;
  v_result JSONB;
BEGIN
  -- Check for existing registration (as main user or partner)
  SELECT * INTO v_existing
  FROM group_registrations
  WHERE group_id = p_group_id
    AND (
      user_id = p_user_id 
      OR partner_user_id = p_user_id
      OR LOWER(TRIM(partner_data->>'email')) = LOWER(TRIM(p_user_email))
      OR LOWER(TRIM(email)) = LOWER(TRIM(p_user_email))
    )
  ORDER BY 
    CASE UPPER(status) 
      WHEN 'APPROVED' THEN 1 
      WHEN 'PENDING' THEN 2 
      WHEN 'REJECTED' THEN 3 
    END
  LIMIT 1;
  
  -- If exists with APPROVED or PENDING, block
  IF v_existing IS NOT NULL THEN
    IF UPPER(v_existing.status) IN ('APPROVED', 'PENDING') THEN
      RETURN jsonb_build_object(
        'success', false,
        'reason', 'ALREADY_' || UPPER(v_existing.status),
        'registration_id', v_existing.id
      );
    END IF;
    
    -- If REJECTED, update to PENDING (re-application)
    IF UPPER(v_existing.status) = 'REJECTED' THEN
      UPDATE group_registrations
      SET 
        status = 'PENDING',
        first_name = p_first_name,
        last_name = p_last_name,
        phone = p_phone,
        partner_data = p_partner_data,
        partner_user_id = p_partner_user_id,
        timestamp = NOW()
      WHERE id = v_existing.id;
      
      RETURN jsonb_build_object(
        'success', true,
        'action', 'REACTIVATED',
        'registration_id', v_existing.id
      );
    END IF;
  END IF;
  
  -- No existing registration, insert new
  INSERT INTO group_registrations (
    id, group_id, user_id, email, first_name, last_name, phone, 
    status, partner_data, partner_user_id, timestamp
  ) VALUES (
    p_id, p_group_id, p_user_id, p_user_email, p_first_name, p_last_name, p_phone,
    'PENDING', p_partner_data, p_partner_user_id, NOW()
  );
  
  -- Increment member count
  UPDATE groups
  SET members_count = COALESCE(members_count, 0) + 1
  WHERE id = p_group_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'action', 'INSERTED',
    'registration_id', p_id
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION upsert_couple_registration TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_couple_registration TO anon;

SELECT 'Couples registration RPC functions created successfully' AS status;
