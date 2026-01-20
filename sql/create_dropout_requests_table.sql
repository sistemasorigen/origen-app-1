-- Migration: Create group_dropout_requests table
-- Purpose: Store dropout requests from hosts for user removal or group closure

CREATE TABLE public.group_dropout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id TEXT NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    host_id UUID NOT NULL REFERENCES public.users(id),
    request_type TEXT NOT NULL CHECK (request_type IN ('USER', 'GROUP')),
    target_user_id UUID REFERENCES public.users(id),
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.group_dropout_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Hosts can create requests for their own groups
CREATE POLICY "hosts_insert_own_requests" ON public.group_dropout_requests
    FOR INSERT WITH CHECK (
        host_id = auth.uid() AND
        EXISTS (SELECT 1 FROM public.groups WHERE id = group_id AND host_id = auth.uid())
    );

-- Policy: Admins can view/update all requests
CREATE POLICY "admins_manage_requests" ON public.group_dropout_requests
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN_GROUPS'))
    );

-- Policy: Hosts can view their own requests
CREATE POLICY "hosts_view_own_requests" ON public.group_dropout_requests
    FOR SELECT USING (host_id = auth.uid());

