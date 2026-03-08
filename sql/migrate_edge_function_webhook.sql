-- migrate_edge_function_webhook.sql
-- Migrates the database webhook from 'send-group-confirmation' to 'send-gcx-welcome'

-- 1. Delete the old webhook trigger for 'send-group-confirmation'
--    (Run this in the Supabase SQL Editor)
--    NOTE: The webhook/trigger name depends on how it was originally set up.
--    Check Dashboard > Database > Webhooks to find the exact trigger name.

-- If it was set up via the Dashboard "Database Webhooks" UI, it might look like:
DROP TRIGGER IF EXISTS "send-group-confirmation" ON public.group_registrations;

-- If it was set up with a different naming convention:
DROP TRIGGER IF EXISTS "send_group_confirmation" ON public.group_registrations;
DROP TRIGGER IF EXISTS "on_registration_approved" ON public.group_registrations;

-- 2. Create a new webhook trigger for 'send-gcx-welcome'
--    This uses Supabase's pg_net extension to call the new edge function
--    whenever a row in group_registrations is UPDATED.

-- IMPORTANT: After deploying the new edge function, set up the webhook via:
--   Dashboard > Database > Webhooks > Create a new Webhook
--   - Name: send-gcx-welcome
--   - Table: group_registrations
--   - Events: UPDATE
--   - Type: Supabase Edge Function
--   - Edge Function: send-gcx-welcome
--   - HTTP Headers: Add Authorization with your service role key

-- Alternatively, if you want to create it via SQL (using supabase_functions.http_request):
-- This requires the supabase_functions schema and http_request function to exist.

CREATE OR REPLACE FUNCTION public.notify_gcx_welcome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payload jsonb;
BEGIN
  -- Only fire when status changes to APPROVED
  IF NEW.status = 'APPROVED' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    payload := jsonb_build_object(
      'type', 'UPDATE',
      'table', 'group_registrations',
      'schema', 'public',
      'record', row_to_json(NEW),
      'old_record', row_to_json(OLD)
    );

    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-gcx-welcome',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := payload
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Drop old trigger function if it existed
DROP FUNCTION IF EXISTS public.notify_group_confirmation() CASCADE;

-- Create the trigger
DROP TRIGGER IF EXISTS "trigger_gcx_welcome" ON public.group_registrations;

CREATE TRIGGER "trigger_gcx_welcome"
  AFTER UPDATE ON public.group_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_gcx_welcome();
