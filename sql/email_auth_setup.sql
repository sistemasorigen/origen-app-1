-- =====================================================
-- EMAIL AUTHENTICATION CONFIGURATION
-- =====================================================
-- This file contains the SQL and configuration instructions
-- for setting up email verification and password recovery
-- in your Supabase project.
-- =====================================================

-- =====================================================
-- STEP 1: VERIFY EMAIL CONFIRMATION IS ENABLED
-- =====================================================
-- Go to Supabase Dashboard:
-- Authentication → Providers → Email
-- Make sure "Confirm email" is ENABLED

-- =====================================================
-- STEP 2: ADD REDIRECT URLs TO ALLOWLIST
-- =====================================================
-- Go to Supabase Dashboard:
-- Authentication → URL Configuration → Redirect URLs
-- Add the following URLs:

-- For localhost development:
-- http://localhost:5173/#/verify-email
-- http://localhost:5173/#/update-password

-- For production (replace with your actual domain):
-- https://test-origen.online/#/verify-email
-- https://test-origen.online/#/update-password

-- =====================================================
-- STEP 3: CUSTOMIZE EMAIL TEMPLATES (Optional)
-- =====================================================
-- Go to Supabase Dashboard:
-- Authentication → Email Templates

-- Template: "Confirm signup"
-- Subject: "Confirma tu cuenta en Origen"
-- Body (HTML):
/*
<h2>¡Bienvenido a Origen!</h2>
<p>Gracias por registrarte. Haz clic en el siguiente enlace para verificar tu cuenta:</p>
<p><a href="{{ .ConfirmationURL }}">Verificar mi email</a></p>
<p>Si no solicitaste esta cuenta, puedes ignorar este mensaje.</p>
<p>Saludos,<br>El equipo de Origen</p>
*/

-- Template: "Reset password"  
-- Subject: "Restablecer contraseña - Origen"
-- Body (HTML):
/*
<h2>Restablecer Contraseña</h2>
<p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
<p><a href="{{ .ConfirmationURL }}">Restablecer mi contraseña</a></p>
<p>Si no solicitaste este cambio, puedes ignorar este mensaje. Tu contraseña no será modificada.</p>
<p>Este enlace expira en 24 horas.</p>
<p>Saludos,<br>El equipo de Origen</p>
*/

-- =====================================================
-- STEP 4: VERIFY SMTP IS CONFIGURED (Already done)
-- =====================================================
-- You mentioned SMTP with Resend is already configured.
-- If emails are not arriving, check:
-- 1. Resend Dashboard → Logs to see if emails are being sent
-- 2. Supabase Dashboard → Authentication → Logs for any errors
-- 3. Make sure the sender email domain is verified in Resend

-- =====================================================
-- NO DATABASE CHANGES REQUIRED
-- =====================================================
-- Email verification is handled entirely by Supabase Auth.
-- The trigger 'on_auth_user_created' that creates users in
-- public.users already exists and will continue to work.
-- 
-- When a user verifies their email:
-- 1. Supabase sets email_confirmed_at in auth.users
-- 2. User can then log in normally
-- 3. The existing trigger syncs to public.users

-- =====================================================
-- OPTIONAL: Check if email is confirmed (for custom logic)
-- =====================================================
-- If you want to check email confirmation status in your app,
-- you can query auth.users (requires service role):

-- SELECT 
--     id,
--     email,
--     email_confirmed_at,
--     CASE 
--         WHEN email_confirmed_at IS NOT NULL THEN 'verified'
--         ELSE 'pending'
--     END as email_status
-- FROM auth.users
-- WHERE email = 'user@example.com';

-- =====================================================
-- RESEND SMTP SETTINGS REFERENCE
-- =====================================================
-- If you need to reconfigure SMTP in Supabase:
-- 
-- Host: smtp.resend.com
-- Port: 465
-- Username: resend
-- Password: re_xxxxxxxxxx (your Resend API key)
-- Sender email: Must be from a verified domain in Resend
--               OR use onboarding@resend.dev for testing
