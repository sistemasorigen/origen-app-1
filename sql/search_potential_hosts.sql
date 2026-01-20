-- Function to search for potential hosts (users who are not top-level admins)
-- Uses RETURNS TABLE to avoid "type public.profiles does not exist" error

CREATE OR REPLACE FUNCTION public.search_potential_hosts(search_term text)
RETURNS TABLE (
    id uuid,
    name text,
    email text,
    role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        COALESCE(p.name, 'Usuario') as name,
        COALESCE(p.email, '') as email,
        p.role::text
    FROM public.profiles p
    WHERE (
        p.name ILIKE '%' || search_term || '%'
        OR p.email ILIKE '%' || search_term || '%'
    )
    AND (
        p.role IS NULL 
        OR p.role::text NOT IN ('SUPER_ADMIN', 'ADMIN_PUNTO', 'ADMIN_GROUPS', 'ADMIN_STORE', 'ADMIN_ALABANZA', 'PASTOR')
    )
    ORDER BY p.name ASC
    LIMIT 20;
END;

$$;
