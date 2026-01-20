-- =====================================================
-- FIX: Secure RPC to fetch user registrations
-- Run this in Supabase SQL Editor
-- =====================================================

CREATE OR REPLACE FUNCTION get_my_group_registrations()
RETURNS SETOF group_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return all registrations where the current user is 
  -- either the main user OR the partner
  RETURN QUERY
  SELECT *
  FROM group_registrations
  WHERE user_id = auth.uid()
     OR partner_user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_group_registrations TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_group_registrations TO anon;

SELECT 'RPC function created successfully' as status;
