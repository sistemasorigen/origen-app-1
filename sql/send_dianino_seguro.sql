-- ════════════════════════════════════════════════════════════════════════════
-- send-dianino-tickets seguro · el trigger manda sólo el id de la sesión
-- 2026-10-28
--
-- ANTES
--   · trigger_dianino_tickets (AFTER INSERT en dianino_sessions) le mandaba a
--     send-dianino-tickets { type, table, schema, record: row_to_json(NEW) }.
--     La clave de Vault ya iba, pero la función no la miraba: cualquiera, sin
--     sesión, podía mandarle el id y el email de cualquier sesión y hacer
--     salir las entradas de esa familia, gastando la cuota de Resend.
--   · El cuerpo del pedido llevaba el email de la familia, que pg_net escribe
--     en net._http_request_queue.
--
-- AHORA
--   · El cuerpo es { sesion_id } y nada más. El email se lee de la base.
--   · La función exige el bearer contra la clave de servicio.
--   · dianino_hechos: una fila por sesión. El email no sale dos veces y hay
--     cuenta para el tope diario (90, ver armado.ts).
--   · Mismo timeout de 30000: generar el QR, subirlo y esperar a Resend no
--     entra en los 5000 de pg_net por defecto (y tampoco en 20000 cómodo).
--
-- EL EVENTO YA PASÓ: la última sesión es del 2026-08-15 y no hay ninguna en
-- los últimos 60 días. El trigger se deja PRENDIDO para la próxima edición —
-- apagarlo es decisión de Ignacio (ver el reporte).
--
-- ORDEN: desplegar la función NUEVA y, en el mismo minuto, esto.
-- Pruebas: sql/PROBAR_send_dianino_seguro.sql
-- Deshacer: sql/ROLLBACK_send_dianino_seguro.sql
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1 · Lo ya hecho ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dianino_hechos (
    clave      text PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dianino_hechos_fecha_idx ON public.dianino_hechos (created_at);

ALTER TABLE public.dianino_hechos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dianino_hechos FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.dianino_hechos IS
    'Emails de entradas del Día del Niño ya mandados (clave dianino:<sesión>). Idempotencia y tope diario. Sólo la usa la función, con la clave de servicio.';


-- ── 2 · El disparador ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_dianino_tickets()
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
            RAISE WARNING '[dianino] falta el secreto webhook_service_role_key: sin entradas para la sesión %', NEW.id;
            RETURN NULL;
        END IF;

        PERFORM net.http_post(
            url := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/send-dianino-tickets',
            body := jsonb_build_object('sesion_id', NEW.id),
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || v_key
            ),
            timeout_milliseconds := 30000
        );
    EXCEPTION WHEN OTHERS THEN
        -- Si esto falla, la inscripción tiene que quedar guardada igual.
        RAISE WARNING '[dianino] no se pudo encolar la sesión %: %', NEW.id, SQLERRM;
    END;
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.notify_dianino_tickets() IS
    'Encola el email con el QR del Día del Niño. Manda sólo { sesion_id } con la clave de Vault; antes mandaba la fila entera (con el email) y la función no pedía la clave (2026-10-28).';

DROP TRIGGER IF EXISTS trigger_dianino_tickets ON public.dianino_sessions;
CREATE TRIGGER trigger_dianino_tickets
    AFTER INSERT ON public.dianino_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_dianino_tickets();


-- ── Permisos ────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.notify_dianino_tickets() FROM PUBLIC, anon, authenticated;
