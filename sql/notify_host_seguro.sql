-- ════════════════════════════════════════════════════════════════════════════
-- notify-host seguro · los triggers mandan sólo el id, con la clave de servicio
-- 2026-10-28 · ✅ APLICADO el 2026-10-28 a las 18:43:30 UTC, un segundo después de desplegar notify-host v13 (PROBAR_ 7/7 en el ensayo y después)
--
-- ANTES
--   · trigger_notify_host_registration_insert (AFTER INSERT en
--     group_registrations, TODAS las filas) le mandaba a notify-host la fila
--     entera de la inscripción (to_jsonb(NEW): nombre, email, teléfono…) y
--     sin ninguna clave. notify-host sólo actuaba si status = 'PENDING'.
--   · trigger_notify_host_group_update (AFTER UPDATE en groups, CADA update,
--     incluido el del contador de miembros) le mandaba el grupo entero antes
--     y después. notify-host sólo actuaba en el paso a 'approved'.
--   · notify-host aceptaba cualquier pedido, sin clave.
--
-- AHORA (mismas condiciones de disparo, ahora en el WHEN del trigger)
--   · Inscripción con status = 'PENDING' → { registration_id }.
--   · Grupo que pasa a 'approved'        → { grupo_aprobado_id }.
--   · Con la clave de Vault (webhook_service_role_key), timeout 20000 y su
--     propio bloque de excepción: si pg_net falla, la inscripción o el grupo
--     se guardan igual (molde: sql/reportes_sistemas.sql).
--   · notify_host_hechos: lo que notify-host ya hizo (para no duplicar avisos
--     ni emails) y la cuenta del tope diario de emails.
--
-- ORDEN: desplegar la función notify-host NUEVA y, en el mismo minuto, esto.
-- Pruebas: sql/PROBAR_notify_host_seguro.sql
-- Deshacer: sql/ROLLBACK_notify_host_seguro.sql (y volver a desplegar la
-- versión vieja de la función, la del commit "chore: versiona notify-host…").
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1 · Lo ya hecho ─────────────────────────────────────────────────────────
-- Una fila por aviso y por email ('reg:<inscripción>:aviso:<usuario>',
-- 'reg:<inscripción>:email:<usuario>'). Sin datos personales: sólo ids.
CREATE TABLE IF NOT EXISTS public.notify_host_hechos (
    clave      text PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notify_host_hechos_fecha_idx ON public.notify_host_hechos (created_at);

ALTER TABLE public.notify_host_hechos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notify_host_hechos FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.notify_host_hechos IS
    'Avisos y emails que ya mandó notify-host (idempotencia y tope diario). Sólo la usa la función, con la clave de servicio.';


-- ── 2 · Inscripción nueva ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_notify_host_registration_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key text;
BEGIN
    BEGIN
        SELECT decrypted_secret INTO v_key
          FROM vault.decrypted_secrets
         WHERE name = 'webhook_service_role_key';

        IF v_key IS NULL THEN
            RAISE WARNING '[notify-host] falta el secreto webhook_service_role_key: sin aviso para %', NEW.id;
            RETURN NULL;
        END IF;

        PERFORM net.http_post(
            url := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/notify-host',
            body := jsonb_build_object('registration_id', NEW.id),
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || v_key
            ),
            timeout_milliseconds := 20000
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[notify-host] no se pudo encolar el aviso de %: %', NEW.id, SQLERRM;
    END;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS notify_host_new_registration ON public.group_registrations;
CREATE TRIGGER notify_host_new_registration
    AFTER INSERT ON public.group_registrations
    FOR EACH ROW
    -- La misma condición que aplicaba notify-host (status === 'PENDING'),
    -- ahora antes de llamar: las demás inscripciones no gastan un pedido.
    WHEN (NEW.status = 'PENDING')
    EXECUTE FUNCTION public.trigger_notify_host_registration_insert();


-- ── 3 · Grupo aprobado ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_notify_host_group_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key text;
BEGIN
    BEGIN
        SELECT decrypted_secret INTO v_key
          FROM vault.decrypted_secrets
         WHERE name = 'webhook_service_role_key';

        IF v_key IS NULL THEN
            RAISE WARNING '[notify-host] falta el secreto webhook_service_role_key: sin aviso para el grupo %', NEW.id;
            RETURN NULL;
        END IF;

        PERFORM net.http_post(
            url := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/notify-host',
            body := jsonb_build_object('grupo_aprobado_id', NEW.id),
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || v_key
            ),
            timeout_milliseconds := 20000
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[notify-host] no se pudo encolar el aviso del grupo %: %', NEW.id, SQLERRM;
    END;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS notify_host_group_approved ON public.groups;
CREATE TRIGGER notify_host_group_approved
    AFTER UPDATE ON public.groups
    FOR EACH ROW
    -- La misma condición que aplicaba notify-host (old.status !== 'approved'
    -- && new.status === 'approved'). Antes se llamaba en CADA update del
    -- grupo, con el grupo entero, también cuando sólo cambiaba el contador.
    WHEN (OLD.status IS DISTINCT FROM 'approved' AND NEW.status = 'approved')
    EXECUTE FUNCTION public.trigger_notify_host_group_update();


-- ── Permisos ────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.trigger_notify_host_registration_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_notify_host_group_update() FROM PUBLIC, anon, authenticated;
