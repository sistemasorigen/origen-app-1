-- ════════════════════════════════════════════════════════════════════════════
-- email-notifier seguro · los triggers mandan { evento, id } con la clave
-- 2026-10-28
--
-- ANTES
--   · send_webhook_event() era un solo disparador para los 5 triggers y le
--     mandaba a email-notifier el payload de un webhook nativo:
--       { type, table, record: row_to_json(NEW), old_record: row_to_json(OLD) }
--     SIN ninguna clave. Con `users` eso significaba la fila entera de una
--     persona (email, teléfono, fecha de nacimiento) escrita en el cuerpo del
--     pedido, que pg_net guarda en net._http_request_queue.
--   · email-notifier aceptaba cualquier pedido, sin clave, y decidía a quién
--     escribirle con lo que venía en `record`. Un pedido armado a mano hacía
--     salir "🎉 ¡Bienvenido como Anfitrión de Origen!" desde el dominio de
--     Origen a cualquier dirección, con el nombre que quisiera y sin escapar.
--   · La condición de cada aviso vivía mitad en el trigger y mitad en la
--     función (el INSERT de `groups` llamaba siempre; la función decidía).
--
-- AHORA (mismos avisos, mismos destinatarios, mismos asuntos)
--   · Un solo disparador, email_notifier_avisar(), que recibe el nombre del
--     evento como argumento del trigger y manda SÓLO { evento, id }.
--   · Con la clave de Vault (webhook_service_role_key), timeout 20000 y su
--     propio bloque de excepción: si pg_net falla, la fila se guarda igual.
--   · Los cinco triggers conservan su nombre y su condición exacta.
--   · email_notifier_hechos: lo que la función ya mandó (para no repetir) y la
--     cuenta del tope diario de 40 emails.
--   · send_webhook_event() se va: no la llama nadie más.
--
-- LOS CINCO AVISOS (ninguno se pierde)
--   | trigger                     | tabla               | cuándo                          | evento          | a quién     |
--   | on_group_created            | groups              | INSERT                          | grupo_nuevo     | admins      |
--   | on_host_applicant_created   | leader_applications | INSERT                          | postulacion     | admins      |
--   | on_group_updated_notify     | groups              | UPDATE → status 'approved'      | grupo_aprobado  | anfitrión   |
--   | on_user_role_updated_notify | users               | UPDATE → roles gana 'ANFITRION' | nuevo_anfitrion | esa persona |
--   | on_welcome_visitor_created  | welcome_visitors    | INSERT                          | ingresante      | bienvenida@ |
--
-- ORDEN: desplegar la función email-notifier NUEVA y, en el mismo minuto, esto.
-- Pruebas: sql/PROBAR_email_notifier_seguro.sql
-- Deshacer: sql/ROLLBACK_email_notifier_seguro.sql (y volver a desplegar la
-- versión vieja, la del commit "chore: versiona 7 edge functions…").
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1 · Lo ya hecho ─────────────────────────────────────────────────────────
-- Una fila por email mandado ('<evento>:<id>:<destino>'). Sin direcciones
-- adentro: para los admins va su posición en la lista (admin#0, admin#1…) y
-- para una persona, su id.
CREATE TABLE IF NOT EXISTS public.email_notifier_hechos (
    clave      text PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_notifier_hechos_fecha_idx ON public.email_notifier_hechos (created_at);

ALTER TABLE public.email_notifier_hechos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_notifier_hechos FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.email_notifier_hechos IS
    'Emails que ya mandó email-notifier (idempotencia y tope diario de 40). Sólo la usa la función, con la clave de servicio.';


-- ── 2 · El disparador ───────────────────────────────────────────────────────
-- Uno solo para los cinco triggers: el evento viene en TG_ARGV[0], así que el
-- cuerpo del pedido es siempre { evento, id } y nada más.
CREATE OR REPLACE FUNCTION public.email_notifier_avisar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key text;
    v_evento text := TG_ARGV[0];
BEGIN
    BEGIN
        SELECT decrypted_secret INTO v_key
          FROM vault.decrypted_secrets
         WHERE name = 'webhook_service_role_key';

        IF v_key IS NULL THEN
            RAISE WARNING '[email-notifier] falta el secreto webhook_service_role_key: sin email de % para %', v_evento, NEW.id;
            RETURN NULL;
        END IF;

        PERFORM net.http_post(
            url := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/email-notifier',
            body := jsonb_build_object('evento', v_evento, 'id', NEW.id),
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || v_key
            ),
            timeout_milliseconds := 20000
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[email-notifier] no se pudo encolar % de %: %', v_evento, NEW.id, SQLERRM;
    END;
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.email_notifier_avisar() IS
    'Encola un aviso de email-notifier. El evento va en el argumento del trigger; el cuerpo lleva sólo { evento, id }, con la clave de Vault. Reemplazó a send_webhook_event, que mandaba la fila entera y sin clave (2026-10-28).';


-- ── 3 · Los cinco triggers ──────────────────────────────────────────────────
-- Mismos nombres y mismas condiciones que antes. Las dos condiciones que ya
-- estaban en un WHEN se copian palabra por palabra; las tres que no tenían
-- WHEN siguen sin tenerlo (la función no filtraba nada en esos tres casos).

DROP TRIGGER IF EXISTS on_group_created ON public.groups;
CREATE TRIGGER on_group_created
    AFTER INSERT ON public.groups
    FOR EACH ROW
    EXECUTE FUNCTION public.email_notifier_avisar('grupo_nuevo');

DROP TRIGGER IF EXISTS on_group_updated_notify ON public.groups;
CREATE TRIGGER on_group_updated_notify
    AFTER UPDATE ON public.groups
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'approved'::text)
    EXECUTE FUNCTION public.email_notifier_avisar('grupo_aprobado');

DROP TRIGGER IF EXISTS on_host_applicant_created ON public.leader_applications;
CREATE TRIGGER on_host_applicant_created
    AFTER INSERT ON public.leader_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.email_notifier_avisar('postulacion');

DROP TRIGGER IF EXISTS on_user_role_updated_notify ON public.users;
CREATE TRIGGER on_user_role_updated_notify
    AFTER UPDATE ON public.users
    FOR EACH ROW
    WHEN (NOT (OLD.roles @> ARRAY['ANFITRION'::text]) AND NEW.roles @> ARRAY['ANFITRION'::text])
    EXECUTE FUNCTION public.email_notifier_avisar('nuevo_anfitrion');

DROP TRIGGER IF EXISTS on_welcome_visitor_created ON public.welcome_visitors;
CREATE TRIGGER on_welcome_visitor_created
    AFTER INSERT ON public.welcome_visitors
    FOR EACH ROW
    EXECUTE FUNCTION public.email_notifier_avisar('ingresante');


-- ── 4 · Lo que ya no existe ─────────────────────────────────────────────────
-- Era el disparador de los cinco triggers de arriba y de nadie más.
DROP FUNCTION IF EXISTS public.send_webhook_event();


-- ── Permisos ────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.email_notifier_avisar() FROM PUBLIC, anon, authenticated;
