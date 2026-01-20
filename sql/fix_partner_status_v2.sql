-- =====================================================
-- FIX V2: Robust RPC to fetch registrations by partner email
-- Handles whitespace and case insensitivity
-- =====================================================

CREATE OR REPLACE FUNCTION get_registrations_by_partner_email(p_email text)
RETURNS SETOF group_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return registrations where partner_data email matches (robust comparison)
  -- 1. TRIM(both) removes leading/trailing spaces
  -- 2. ILIKE handles case insensitivity
  RETURN QUERY
  SELECT *
  FROM group_registrations
  WHERE TRIM(BOTH FROM (partner_data->>'email')) ILIKE TRIM(BOTH FROM p_email);
END;
$$;

GRANT EXECUTE ON FUNCTION get_registrations_by_partner_email TO authenticated;
GRANT EXECUTE ON FUNCTION get_registrations_by_partner_email TO anon;

SELECT 'RPC get_registrations_by_partner_email updated (V2) successfully' as status;
