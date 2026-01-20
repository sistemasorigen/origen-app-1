-- 1. Create the Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    record_id UUID NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_by UUID DEFAULT auth.uid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Security & RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only Admins can view logs (Adjust policy based on your specific admin role logic if needed, 
-- effectively this usually requires a service_role key or checking a public.users role column)
-- For now, we'll allow authenticated users with 'SUPER_ADMIN' role to view, or service role.
-- Note: 'auth.uid()' in a trigger is the user performing the action.
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
    FOR SELECT
    USING (
        exists (
            select 1 from public.users 
            where id = auth.uid() 
            and (
                roles @> ARRAY['SUPER_ADMIN']::text[] 
                OR 
                role = 'SUPER_ADMIN'
            )
        )
    );

-- No one can insert/update/delete directly (handled by triggers)
CREATE POLICY "Triggers can insert logs" ON public.audit_logs
    FOR INSERT
    WITH CHECK (true); -- Triggers execute with security definer usually, or owner permissions

-- 3. Create the Trigger Function
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    record_id UUID;
    old_data JSONB;
    new_data JSONB;
BEGIN
    -- Determine Record ID based on operation
    IF (TG_OP = 'DELETE') THEN
        record_id := OLD.id;
        old_data := to_jsonb(OLD);
        new_data := null;
    ELSIF (TG_OP = 'UPDATE') THEN
        record_id := NEW.id;
        old_data := to_jsonb(OLD);
        new_data := to_jsonb(NEW);
    ELSIF (TG_OP = 'INSERT') THEN
        record_id := NEW.id;
        old_data := null;
        new_data := to_jsonb(NEW);
    END IF;

    -- Insert the log record
    INSERT INTO public.audit_logs (
        table_name,
        action,
        record_id,
        old_data,
        new_data,
        changed_by
    ) VALUES (
        TG_TABLE_NAME::TEXT,
        TG_OP::TEXT,
        record_id,
        old_data,
        new_data,
        auth.uid()
    );

    RETURN NULL; -- Result is ignored for AFTER triggers
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 
-- SECURITY DEFINER ensures the function runs with privileges of the creator, 
-- allowing it to write to audit_logs even if the specific user doesn't have direct write access.

-- 4. Apply Triggers to Target Tables

-- Users Table
DROP TRIGGER IF EXISTS audit_users_changes ON public.users;
CREATE TRIGGER audit_users_changes
AFTER INSERT OR UPDATE OR DELETE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Groups Table
DROP TRIGGER IF EXISTS audit_groups_changes ON public.groups;
CREATE TRIGGER audit_groups_changes
AFTER INSERT OR UPDATE OR DELETE ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Group Registrations Table
DROP TRIGGER IF EXISTS audit_group_registrations_changes ON public.group_registrations;
CREATE TRIGGER audit_group_registrations_changes
AFTER INSERT OR UPDATE OR DELETE ON public.group_registrations
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
