-- =====================================================
-- FIX: RPC to fetch registrations by partner email (Case Insensitive)
-- Run this in Supabase SQL Editor
-- =====================================================

CREATE OR REPLACE FUNCTION get_registrations_by_partner_email(p_email text)
RETURNS SETOF group_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return registrations where partner_data email matches (case insensitive)
  RETURN QUERY
  SELECT *
  FROM group_registrations
  WHERE (partner_data->>'email') ILIKE p_email;
END;
$$;

GRANT EXECUTE ON FUNCTION get_registrations_by_partner_email TO authenticated;
GRANT EXECUTE ON FUNCTION get_registrations_by_partner_email TO anon;

SELECT 'RPC get_registrations_by_partner_email created successfully' as status;
