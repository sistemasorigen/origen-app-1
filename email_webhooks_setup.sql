-- ==============================================================================
-- SQL WEBHOOKS FOR EMAIL NOTIFICATION SYSTEM
-- Run this script in your Supabase SQL Editor
-- ==============================================================================

-- 1. Enable pg_net extension (Required for Database Webhooks)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ==========================================
-- 2. CREATE WRAPPER FUNCTION FOR WEBHOOKS
-- This handles constructing the JSON payload and calling pg_net directly
-- ==========================================
CREATE OR REPLACE FUNCTION public.send_webhook_event()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
BEGIN
  -- Construct a payload identical to the Supabase native Webhook payload
  payload := json_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', row_to_json(NEW),
    'old_record', row_to_json(OLD)
  );

  -- Perform the async HTTP POST request using pg_net
  PERFORM net.http_post(
    url := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/email-notifier',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := payload
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- EVENT 1: Nuevo Grupo (Admin Notify)
-- ==========================================
DROP TRIGGER IF EXISTS on_group_created ON public.groups;
CREATE TRIGGER on_group_created
AFTER INSERT ON public.groups
FOR EACH ROW
EXECUTE FUNCTION public.send_webhook_event();

-- ==========================================
-- EVENT 2: Nuevo Postulante a Anfitrión (Admin Notify)
-- ==========================================
DROP TRIGGER IF EXISTS on_host_applicant_created ON public.leader_applications;
CREATE TRIGGER on_host_applicant_created
AFTER INSERT ON public.leader_applications
FOR EACH ROW
EXECUTE FUNCTION public.send_webhook_event();

-- ==========================================
-- EVENT 3: Grupo Aprobado (User Notify)
-- ==========================================
DROP TRIGGER IF EXISTS on_group_updated_notify ON public.groups;
CREATE TRIGGER on_group_updated_notify
AFTER UPDATE ON public.groups
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'approved')
EXECUTE FUNCTION public.send_webhook_event();

-- ==========================================
-- EVENT 4: Anfitrión Aprobado (User Notify)
-- ==========================================
DROP TRIGGER IF EXISTS on_user_role_updated_notify ON public.users;
CREATE TRIGGER on_user_role_updated_notify
AFTER UPDATE ON public.users
FOR EACH ROW
WHEN (
  NOT (OLD.roles @> ARRAY['ANFITRION']::text[]) 
  AND (NEW.roles @> ARRAY['ANFITRION']::text[])
)
EXECUTE FUNCTION public.send_webhook_event();

-- ==============================================================================
-- DEPLOYMENT SUCCESSFUL
-- The Edge Function receives the webhook payloads and uses Resend.
-- ==============================================================================
