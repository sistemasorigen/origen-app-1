-- FORCE CLEANUP (Drop existing objects to fix schema mismatch)
DROP TRIGGER IF EXISTS audit_users_changes ON public.users;
DROP TRIGGER IF EXISTS audit_groups_changes ON public.groups;
DROP TRIGGER IF EXISTS audit_group_registrations_changes ON public.group_registrations;

DROP FUNCTION IF EXISTS public.log_audit_event();

-- WARNING: This deletes existing logs. Essential to fix the structure.
DROP TABLE IF EXISTS public.audit_logs;

-- RE-CREATE TABLE (Correct Schema WITH FOREIGN KEY)
CREATE TABLE public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    record_id UUID NOT NULL,
    old_data JSONB,
    new_data JSONB,
    -- CRITICAL FIX: Explicitly referencing public.users to allow joins
    changed_by UUID DEFAULT auth.uid() REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- SECURITY & RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Triggers can insert logs" ON public.audit_logs
    FOR INSERT
    WITH CHECK (true);

-- TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    record_id UUID;
    old_data JSONB;
    new_data JSONB;
BEGIN
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

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- APPLY TRIGGERS
CREATE TRIGGER audit_users_changes
AFTER INSERT OR UPDATE OR DELETE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_groups_changes
AFTER INSERT OR UPDATE OR DELETE ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_group_registrations_changes
AFTER INSERT OR UPDATE OR DELETE ON public.group_registrations
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
