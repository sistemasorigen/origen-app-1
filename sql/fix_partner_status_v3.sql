-- =====================================================
-- FIX V3: Broad Search RPC to fetch registrations by partner email
-- Casts JSON to text to avoid key/path issues
-- =====================================================

CREATE OR REPLACE FUNCTION get_registrations_by_partner_email(p_email text)
RETURNS SETOF group_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return registrations where the email string appears anywhere in partner_data
  -- This is robust against JSON structure variations (e.g. Email vs email)
  RETURN QUERY
  SELECT *
  FROM group_registrations
  WHERE partner_data::text ILIKE '%' || TRIM(BOTH FROM p_email) || '%';
END;
$$;

GRANT EXECUTE ON FUNCTION get_registrations_by_partner_email TO authenticated;
GRANT EXECUTE ON FUNCTION get_registrations_by_partner_email TO anon;

SELECT 'RPC get_registrations_by_partner_email updated (V3 - Broad Search) successfully' as status;
