-- ============================================================
-- FIX: credenciales de webhooks vía Supabase Vault
-- ============================================================
--
-- YA EJECUTADO contra el proyecto real (oqtumgalnozppqnnjjdb).
--
-- Diagnóstico:
-- `app.settings.supabase_url` y `app.settings.service_role_key`
-- (usados por `trigger_gcx_welcome`, creado en
-- sql/migrate_edge_function_webhook.sql) nunca estuvieron
-- configurados a nivel de base de datos. Confirmado con
-- pg_db_role_setting: el único setting `app.settings.*` presente
-- era `app.settings.jwt_exp`. Además, el rol `postgres` de este
-- proyecto tiene `rolsuper = false`, así que `ALTER DATABASE
-- postgres SET app.settings.xxx` falla con "permission denied to
-- set parameter" — no es algo que se pueda arreglar subiendo el
-- valor correcto, el mecanismo en sí no está disponible en
-- Supabase hosted para el rol que tenemos.
--
-- Impacto real: `trigger_gcx_welcome` existe y está habilitado
-- (tgenabled = 'O') desde que se migró a este patrón, pero cada
-- disparo construye un `url` NULL (`NULL || texto = NULL` en
-- Postgres) y el net.http_post nunca llega a destino — sin
-- mostrarle ningún error a quien aprueba la inscripción. Al
-- momento de este fix había 560 registros con status='APPROVED'
-- en group_registrations (rango de `timestamp`: 2026-01-11 a
-- 2026-07-20) — no todos necesariamente afectados (la migración
-- a este trigger pudo ser posterior), pero es la cota superior
-- para que Ignacio dimensione si hace falta un reenvío manual
-- aparte.
--
-- Fix: Supabase Vault (extensión `supabase_vault`, ya instalada).
-- El service_role key se guardó como secreto encriptado
-- (`vault.create_secret`, corrido por Ignacio directo en el SQL
-- editor de Supabase — el valor real nunca pasó por este chat ni
-- por ningún archivo del repo). Nombre del secreto:
-- `webhook_service_role_key`.
--
-- Ambas funciones de trigger se reescribieron para leer
-- `vault.decrypted_secrets` en vez de `current_setting()`. La URL
-- del proyecto no es sensible, va hardcodeada.
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_gcx_welcome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payload jsonb;
  v_key text;
BEGIN
  IF NEW.status = 'APPROVED' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'webhook_service_role_key';

    payload := jsonb_build_object(
      'type', 'UPDATE',
      'table', 'group_registrations',
      'schema', 'public',
      'record', row_to_json(NEW),
      'old_record', row_to_json(OLD)
    );

    PERFORM net.http_post(
      url := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/send-gcx-welcome',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := payload
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Verificación (no expone el valor del secreto, solo si existe y
-- tiene pinta de válido):
SELECT name, (decrypted_secret IS NOT NULL AND length(decrypted_secret) > 20) AS looks_valid
FROM vault.decrypted_secrets WHERE name = 'webhook_service_role_key';

SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'trigger_gcx_welcome';
