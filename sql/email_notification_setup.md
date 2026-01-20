# Email Notification System - Setup Guide

This guide explains how to deploy and configure the automated email notification system for approved group registrations.

## Prerequisites

- Supabase CLI installed (`npm install -g supabase`)
- Resend account with API key
- Verified sender domain in Resend (or use `onboarding@resend.dev` for testing)

## 1. Deploy the Edge Function

### Step 1.1: Link your project (if not already linked)

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### Step 1.2: Set the Resend API Key secret

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxx
```

### Step 1.3: Deploy the function

```bash
supabase functions deploy send-group-confirmation --no-verify-jwt
```

> **Note:** We use `--no-verify-jwt` because the function is called by the database webhook, not by authenticated users directly.

## 2. Update the Edge Function Configuration

Edit `supabase/functions/send-group-confirmation/index.ts`:

1. Update `FROM_EMAIL` constant with your verified sender email:
   ```typescript
   const FROM_EMAIL = "Origen App <noreply@your-domain.com>";
   ```

## 3. Set Up the Database Trigger

### Option A: Using pg_net (Recommended)

1. Open Supabase Dashboard → SQL Editor
2. Open `sql/email_notification_webhook.sql`
3. Replace `YOUR_PROJECT_REF` with your actual project reference
4. Execute the SQL

### Option B: Manual Webhook via Dashboard

1. Go to **Database → Webhooks**
2. Click **"Create a new hook"**
3. Configure:
   - **Name:** `send_group_confirmation_on_approval`
   - **Table:** `group_registrations`
   - **Events:** `UPDATE`
   - **Type:** HTTP Request
   - **Method:** POST
   - **URL:** `https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-group-confirmation`
   - **Headers:**
     - `Content-Type: application/json`
     - `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`

## 4. Testing

1. Create a test registration with status `PENDING`
2. Update the status to `APPROVED` via Admin Panel or directly in Supabase
3. Check:
   - Edge Function logs in Dashboard → Edge Functions → send-group-confirmation → Logs
   - Resend dashboard for email delivery status
   - User's inbox for the confirmation email

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Email service not configured" | Verify `RESEND_API_KEY` secret is set |
| "Database service not configured" | Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are available |
| Email not delivered | Check Resend dashboard logs; verify sender domain |
| Function not triggered | Verify trigger exists with the SQL verification query |

## File Structure

```
supabase/
└── functions/
    └── send-group-confirmation/
        ├── index.ts      # Main function code
        └── deno.json     # Deno configuration

sql/
├── email_notification_webhook.sql   # Trigger setup
└── email_notification_setup.md      # This file
```
