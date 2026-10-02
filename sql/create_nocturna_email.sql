-- ════════════════════════════════════════════════════════════════════════════
-- NOCTURNA — email con la entrada
-- 2026-10-01
--
-- Al crearse una inscripción (pública o cargada por el staff) se dispara la
-- Edge Function `send-nocturna-entrada`, que manda el email con el QR.
--
-- El plan de Resend permite 100 emails por día. Un viernes con muchas
-- inscripciones, algunos van a fallar. Por eso cada inscripción lleva su
-- propio registro de qué pasó con su email, y hay una RPC para reintentar.
--
-- Mismo mecanismo de disparo que el Día del Niño (ver
-- sql/create_dianino_tickets_webhook.sql): la clave de servicio vive en Vault
-- porque `ALTER DATABASE ... SET` pide superusuario y en Supabase hosted el
-- rol `postgres` no lo es.
-- ════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 1 — Columnas de seguimiento
-- ════════════════════════════════════════════════════════════════════════════
-- Separadas a propósito: `email_enviado_at` responde "¿llegó?",
-- `email_error` responde "¿por qué no?" y `email_intentos` distingue
-- "nunca se intentó" de "se intentó y falló cinco veces". Con una sola
-- columna de estado no se puede saber lo último, que es justo lo que el
-- staff necesita para decidir a quién llamar por teléfono.

ALTER TABLE public.nocturna_inscripciones
    ADD COLUMN IF NOT EXISTS email_enviado_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS email_error      TEXT,
    ADD COLUMN IF NOT EXISTS email_intentos   INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.nocturna_inscripciones.email_enviado_at IS
    'Cuándo Resend aceptó el email de la entrada. NULL = nunca llegó a salir.';
COMMENT ON COLUMN public.nocturna_inscripciones.email_error IS
    'Último error al mandar el email, en español y listo para mostrar en el panel.';
COMMENT ON COLUMN public.nocturna_inscripciones.email_intentos IS
    'Cuántas veces se intentó mandar. Sube también cuando falla.';

-- Para la vista del panel: "a quiénes no les llegó".
CREATE INDEX IF NOT EXISTS idx_nocturna_insc_email_pendiente
    ON public.nocturna_inscripciones(edicion)
    WHERE email_enviado_at IS NULL;


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 2A — El disparo automático
-- ════════════════════════════════════════════════════════════════════════════
-- Sólo viaja el `inscripcion_id`. No es una preferencia de estilo: pg_net
-- guarda el cuerpo del pedido en `net.http_request_queue` hasta procesarlo y
-- la respuesta en `net._http_response` por un rato. Mandar `row_to_json(NEW)`
-- —como hace el del Día del Niño— dejaría el DNI y el email del adulto
-- escritos en esas tablas. Con el id solo, no hay nada que filtrar: la
-- función lee los datos ella misma, con la clave de servicio.
--
-- ORDEN: las RPCs insertan la inscripción y después los chicos, todo en una
-- transacción. El INSERT en la cola de pg_net también es transaccional, así
-- que el worker recién lo ve después del commit y la función encuentra a los
-- chicos. Verificado, no asumido (ver el reporte de P4).

CREATE OR REPLACE FUNCTION public.notify_nocturna_entrada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key text;
BEGIN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'webhook_service_role_key';

    IF v_key IS NULL THEN
        -- Sin clave no hay email, pero la inscripción NO se cae: la familia
        -- ya pagó y ya tiene su código en pantalla. Queda anotado para que
        -- el staff lo reenvíe desde el panel.
        RAISE WARNING '[nocturna] falta el secreto webhook_service_role_key: no se mandó el email de %', NEW.id;
        RETURN NEW;
    END IF;

    PERFORM net.http_post(
        url := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/send-nocturna-entrada',
        body := jsonb_build_object('inscripcion_id', NEW.id),
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_key
        ),
        -- Los 5000 ms que trae por defecto no alcanzan: generar el QR y que
        -- Resend conteste tarda más que eso, y pg_net cortaba la conexión
        -- antes de poder registrar qué respondió la función.
        timeout_milliseconds := 20000
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_nocturna_entrada ON public.nocturna_inscripciones;

CREATE TRIGGER trigger_nocturna_entrada
    AFTER INSERT ON public.nocturna_inscripciones
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_nocturna_entrada();


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 2B — Reenvío manual, sólo staff
-- ════════════════════════════════════════════════════════════════════════════
-- El reenvío pasa por la base y no por el navegador a propósito: así la Edge
-- Function acepta únicamente la clave de servicio y no tiene que autenticar
-- usuarios del staff por su cuenta. Quien decide acá es `is_nocturna_staff()`,
-- la misma función que gobierna el resto del módulo.

CREATE OR REPLACE FUNCTION public.reenviar_nocturna_email(p_inscripcion_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key    text;
    v_existe boolean;
BEGIN
    IF NOT public.is_nocturna_staff() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No tenés permiso para reenviar entradas.');
    END IF;

    SELECT EXISTS (SELECT 1 FROM public.nocturna_inscripciones WHERE id = p_inscripcion_id)
    INTO v_existe;

    IF NOT v_existe THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Esa inscripción no existe.');
    END IF;

    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'webhook_service_role_key';

    IF v_key IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Falta la configuración del envío de emails.');
    END IF;

    PERFORM net.http_post(
        url := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/send-nocturna-entrada',
        body := jsonb_build_object('inscripcion_id', p_inscripcion_id),
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_key
        ),
        timeout_milliseconds := 20000
    );

    -- "Se pidió", no "llegó": el envío es asincrónico. Quien mira el panel
    -- tiene que refrescar para ver si `email_enviado_at` se completó.
    RETURN jsonb_build_object('ok', true, 'mensaje', 'Se pidió el reenvío. En unos segundos se actualiza el estado.');
END;
$$;

-- CREATE OR REPLACE vuelve a otorgarle permiso a PUBLIC: hay que revocarlo
-- de nuevo cada vez, y de anon aparte, porque anon no hereda de PUBLIC en
-- todos los casos.
REVOKE EXECUTE ON FUNCTION public.reenviar_nocturna_email(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reenviar_nocturna_email(UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.reenviar_nocturna_email(UUID) TO authenticated;

-- La de trigger no se puede invocar ni por RPC (devuelve `trigger`), pero los
-- privilegios por defecto de Supabase igual se la otorgan a `authenticated`.
-- Se la saca: nadie más que el trigger tiene por qué ejecutarla.
REVOKE EXECUTE ON FUNCTION public.notify_nocturna_entrada() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_nocturna_entrada() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_nocturna_entrada() FROM authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 3 — Recargar el esquema de PostgREST
-- ════════════════════════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════════════════════
-- Verificación
-- ════════════════════════════════════════════════════════════════════════════
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'nocturna_inscripciones' AND column_name LIKE 'email%';
--
-- SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'trigger_nocturna_entrada';
--
-- SELECT proname, proacl FROM pg_proc WHERE proname = 'reenviar_nocturna_email';
