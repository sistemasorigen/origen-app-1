-- ════════════════════════════════════════════════════════════════════════════
-- send-gcx-welcome seguro · el trigger manda sólo el id, y el reenvío a mano
-- pasa por una RPC que valida quién lo pide
-- 2026-10-28
--
-- ANTES
--   · trigger_gcx_welcome (AFTER UPDATE en group_registrations, TODAS las
--     filas) llamaba a notify_gcx_welcome, que decidía adentro si el estado
--     pasó a APPROVED y mandaba { type, table, schema, record: row_to_json(NEW),
--     old_record: row_to_json(OLD) }. La clave de Vault ya iba, pero la
--     función no la miraba.
--   · El cuerpo llevaba la inscripción entera: nombre, email, teléfono y DNI,
--     que pg_net escribe en net._http_request_queue, ida y vuelta.
--   · El REENVÍO a mano lo hacía el frontend llamando a la función directo
--     (supabaseService.resendGroupConfirmationEmails → functions.invoke) con
--     la clave anon, que viaja en el bundle. Es decir: cualquiera, sin sesión,
--     podía mandar una lista de ids y hacer salir la bienvenida en masa a los
--     inscriptos aprobados, gastando la cuota de Resend (100 por día).
--
-- AHORA
--   · El trigger manda { inscripcion_id } y nada más, con la condición en el
--     WHEN (la misma que miraba la función) y la clave de Vault.
--   · El reenvío a mano pasa por gcx_reenviar_bienvenida(text[]), una RPC
--     SECURITY DEFINER que exige sesión y que quien pide sea gestor de grupos
--     (SUPER_ADMIN, ADMIN_GROUPS, ENCARGADO_GRUPOS o PASTOR — los mismos roles
--     que usa crear_aviso) o anfitrión/co-anfitrión de TODOS los grupos de
--     esas inscripciones. El frontend no llama más a la función.
--   · gcx_welcome_hechos: la aprobación manda un email por inscripción; el
--     reenvío a mano, uno por inscripción y por día (reenviar es justo lo que
--     el botón hace, así que no puede ser idempotente para siempre).
--
-- ORDEN: desplegar la función NUEVA y, en el mismo minuto, esto.
-- Pruebas: sql/PROBAR_send_gcx_welcome_seguro.sql
-- Deshacer: sql/ROLLBACK_send_gcx_welcome_seguro.sql
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1 · Lo ya hecho ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gcx_welcome_hechos (
    clave      text PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gcx_welcome_hechos_fecha_idx ON public.gcx_welcome_hechos (created_at);

ALTER TABLE public.gcx_welcome_hechos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gcx_welcome_hechos FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.gcx_welcome_hechos IS
    'Bienvenidas de GCX ya mandadas. gcx:auto:<inscripción> (la aprobación, una sola vez) y gcx:reenvio:<inscripción>:<día> (el botón de reenviar, una vez por día). Idempotencia y tope diario. Sólo la usa la función, con la clave de servicio.';


-- ── 2 · El disparador de la aprobación ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_gcx_welcome()
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
            RAISE WARNING '[gcx-welcome] falta el secreto webhook_service_role_key: sin bienvenida para %', NEW.id;
            RETURN NULL;
        END IF;

        PERFORM net.http_post(
            url := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/send-gcx-welcome',
            body := jsonb_build_object('inscripcion_id', NEW.id),
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || v_key
            ),
            timeout_milliseconds := 30000
        );
    EXCEPTION WHEN OTHERS THEN
        -- Si esto falla, la aprobación tiene que quedar guardada igual.
        RAISE WARNING '[gcx-welcome] no se pudo encolar la bienvenida de %: %', NEW.id, SQLERRM;
    END;
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.notify_gcx_welcome() IS
    'Encola la bienvenida de GCX cuando una inscripción pasa a APPROVED. Manda sólo { inscripcion_id } con la clave de Vault; antes mandaba la inscripción entera (nombre, email, teléfono, DNI) y la función no pedía la clave (2026-10-28).';

DROP TRIGGER IF EXISTS trigger_gcx_welcome ON public.group_registrations;
CREATE TRIGGER trigger_gcx_welcome
    AFTER UPDATE ON public.group_registrations
    FOR EACH ROW
    -- La misma condición que aplicaba la función
    -- (NEW.status = 'APPROVED' AND OLD.status IS DISTINCT FROM NEW.status),
    -- ahora antes de llamar: las demás ediciones no gastan un pedido.
    WHEN (NEW.status = 'APPROVED' AND OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.notify_gcx_welcome();


-- ── 3 · El reenvío a mano, con permiso ──────────────────────────────────────
-- Antes el frontend llamaba a la función con la clave anon. Ahora pide esto,
-- que valida la sesión y la relación con el grupo, y encola el pedido con la
-- clave de Vault. Devuelve cuántas quedaron encoladas: el envío es asincrónico
-- (pg_net), así que acá no se sabe todavía cuántas salieron.
CREATE OR REPLACE FUNCTION public.gcx_reenviar_bienvenida(p_inscripciones text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_gestor boolean;
    v_ids text[];
    v_n integer;
    v_key text;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;

    v_ids := ARRAY(
        SELECT DISTINCT x FROM unnest(COALESCE(p_inscripciones, '{}'::text[])) x
         WHERE x IS NOT NULL AND btrim(x) <> ''
    );
    v_n := COALESCE(array_length(v_ids, 1), 0);
    IF v_n = 0 OR v_n > 100 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'cantidad_invalida');
    END IF;

    v_gestor := public.tiene_rol(ARRAY['SUPER_ADMIN', 'ADMIN_GROUPS', 'ENCARGADO_GRUPOS', 'PASTOR']);

    -- Un gestor puede reenviar cualquiera. Un anfitrión, sólo las de SUS
    -- grupos: si en la lista hay una sola que no le corresponde (o que no
    -- existe), no se manda ninguna. Así el botón no sirve para ir probando
    -- ids de a uno y averiguar cuáles existen.
    IF NOT v_gestor AND EXISTS (
        SELECT 1 FROM unnest(v_ids) AS t(ins)
         WHERE NOT EXISTS (
            SELECT 1
              FROM public.group_registrations r
              JOIN public.groups g ON g.id = r.group_id
             WHERE r.id = t.ins
               AND v_uid IN (g.host_id, g.co_host_id)
         )
    ) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    SELECT decrypted_secret INTO v_key
      FROM vault.decrypted_secrets
     WHERE name = 'webhook_service_role_key';

    IF v_key IS NULL THEN
        RAISE WARNING '[gcx-welcome] falta el secreto webhook_service_role_key: no se pudo reenviar';
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_secreto');
    END IF;

    PERFORM net.http_post(
        url := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/send-gcx-welcome',
        body := jsonb_build_object('inscripciones', to_jsonb(v_ids)),
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_key
        ),
        timeout_milliseconds := 30000
    );

    RETURN jsonb_build_object('ok', true, 'encoladas', v_n);
END;
$$;

COMMENT ON FUNCTION public.gcx_reenviar_bienvenida(text[]) IS
    'Reenvía la bienvenida de GCX de las inscripciones que se le pasan. Pide sesión y que quien llama sea gestor de grupos o anfitrión/co-anfitrión de todos esos grupos. Encola un pedido a send-gcx-welcome con la clave de Vault. Reemplaza al functions.invoke que hacía el frontend con la clave anon (2026-10-28).';


-- ── Permisos ────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.notify_gcx_welcome() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.gcx_reenviar_bienvenida(text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gcx_reenviar_bienvenida(text[]) FROM anon;
GRANT  EXECUTE ON FUNCTION public.gcx_reenviar_bienvenida(text[]) TO authenticated;
