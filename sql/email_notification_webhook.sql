-- ==============================================================================
-- DATABASE WEBHOOK: Email Notification on Group Registration Approval
-- ==============================================================================
-- This script sets up a webhook to trigger the send-group-confirmation
-- Edge Function when a group_registrations row status changes to 'APPROVED'.
--
-- NOTE: Supabase Database Webhooks are managed via the Supabase Dashboard.
-- This file provides the SQL for reference and the manual setup instructions.
-- ==============================================================================

-- ============================================================================
-- OPTION 1: Using pg_net Extension (Recommended for Supabase)
-- ============================================================================
-- This approach uses Supabase's pg_net extension to make HTTP requests
-- directly from a database trigger.

-- Step 1: Enable the pg_net extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Create the trigger function
CREATE OR REPLACE FUNCTION notify_group_approval()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT;
  payload JSONB;
  request_id BIGINT;
BEGIN
  -- Only proceed if status changed to APPROVED
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'APPROVED' THEN
    
    -- Build the Edge Function URL
    edge_function_url := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/send-group-confirmation';
    
    -- Build the webhook payload matching expected format
    payload := jsonb_build_object(
      'type', 'UPDATE',
      'table', 'group_registrations',
      'schema', 'public',
      'record', to_jsonb(NEW),
      'old_record', to_jsonb(OLD)
    );
    
    -- Make async HTTP POST request to Edge Function
    SELECT net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := payload
    ) INTO request_id;
    
    RAISE LOG 'Email notification request sent with ID: %', request_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create the trigger
DROP TRIGGER IF EXISTS on_group_registration_approved ON group_registrations;

CREATE TRIGGER on_group_registration_approved
  AFTER UPDATE ON group_registrations
  FOR EACH ROW
  EXECUTE FUNCTION notify_group_approval();

-- Step 4: Grant necessary permissions
GRANT USAGE ON SCHEMA net TO postgres, authenticated, service_role;
GRANT EXECUTE ON FUNCTION notify_group_approval() TO postgres, service_role;

-- ============================================================================
-- OPTION 2: Manual Webhook Setup via Supabase Dashboard
-- ============================================================================
-- If you prefer to set up the webhook through the UI:
--
-- 1. Go to Supabase Dashboard → Database → Webhooks
-- 2. Click "Create a new hook"
-- 3. Configure:
--    - Name: send_group_confirmation_on_approval
--    - Table: group_registrations
--    - Events: UPDATE
--    - Type: HTTP Request
--    - Method: POST
--    - URL: https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-group-confirmation
--    - Headers:
--      - Content-Type: application/json
--      - Authorization: Bearer YOUR_SERVICE_ROLE_KEY
--
-- Note: Dashboard webhooks send all UPDATE events. The Edge Function
-- will filter based on status change to APPROVED.

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 'Trigger created successfully!' as status;

-- Check trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_group_registration_approved';
