-- ════════════════════════════════════════════════════════════════════════════
-- Reportes de problemas · la sección de Sistemas y el email
-- 2026-10-22 · ✅ APLICADO el 2026-10-22 (pruebas de PROBAR_ en verde)
--
-- Diseños: design-claude/Panel Admin - Reportes.dc.html y
--          design-claude/Email - Nuevo Reporte.dc.html
-- Base:    sql/mi_cuenta.sql §4 (tabla, crear_reporte_problema, bucket).
--
-- POR QUÉ NO SE VEÍAN (diagnóstico del 2026-10-22)
--   · En producción había 0 reportes: nadie había mandado uno todavía. El
--     camino funcionaba: crear_reporte_problema guarda con una sesión común y
--     un SUPER_ADMIN lo lee (probado en una transacción deshecha).
--   · Pero aunque hubiera, estaban escondidos: /panel-admin → menú Sistema →
--     Datos → segunda pestaña. Y la notificación que crea la base llevaba a
--     /panel-admin/reportes, una ruta que no existía.
--
-- QUÉ AGREGA
--   1 · Columnas para la gestión y el historial (visto, resuelto, reabierto,
--       nota editada) y para el email (enviado, error).
--   2 · codigo_reporte(numero) → 'REP-0042'. El mismo formato que el helper
--       de TS codigoReporte() en services/miCuenta.ts.
--   3 · gestionar_reporte(id, accion, nota): visto · resuelto · reabrir ·
--       nota. Sólo SUPER_ADMIN.
--   4 · reportes_admin(): los reportes con nombre, email y teléfono de quien
--       lo mandó. SECURITY DEFINER y sólo SUPER_ADMIN: `users` sigue cerrada
--       para todos los demás.
--   5 · El trigger del email: manda SÓLO el id a send-reporte-problema. Si
--       pg_net falla, el reporte se guarda igual.
--   6 · La notificación in-app lleva a /panel-admin/reportes?id=<id>.
--
-- Pruebas: sql/PROBAR_reportes_sistemas.sql · Deshacer: sql/ROLLBACK_reportes_sistemas.sql
-- ORDEN: desplegar la función send-reporte-problema ANTES de correr esto.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1 · Columnas ────────────────────────────────────────────────────────────
ALTER TABLE public.reportes_problemas
    ADD COLUMN IF NOT EXISTS visto_at         timestamptz,
    ADD COLUMN IF NOT EXISTS visto_por        uuid REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS resuelto_at      timestamptz,
    ADD COLUMN IF NOT EXISTS resuelto_por     uuid REFERENCES public.users(id) ON DELETE SET NULL,
    -- Reabrir no borra el "resuelto" anterior: el historial lo cuenta todo.
    ADD COLUMN IF NOT EXISTS reabierto_at     timestamptz,
    ADD COLUMN IF NOT EXISTS reabierto_por    uuid REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS nota_editada_at  timestamptz,
    ADD COLUMN IF NOT EXISTS email_enviado_at timestamptz,
    -- Por qué no salió el email: tope diario, error de Resend… El reporte
    -- igual está en el panel.
    ADD COLUMN IF NOT EXISTS email_error      text;


-- ── 2 · El código ───────────────────────────────────────────────────────────
-- Cuatro dígitos como mínimo; del 10000 en adelante, el número entero (lpad
-- recortaría).
CREATE OR REPLACE FUNCTION public.codigo_reporte(p_numero integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT 'REP-' || CASE WHEN length(p_numero::text) >= 4 THEN p_numero::text
                          ELSE lpad(p_numero::text, 4, '0') END;
$$;


-- ── 3 · Gestionar ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.gestionar_reporte(
    p_id uuid,
    p_accion text,
    p_nota text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_estado text;
BEGIN
    IF v_uid IS NULL OR NOT public.tiene_rol(ARRAY['SUPER_ADMIN']) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    SELECT estado INTO v_estado FROM public.reportes_problemas WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;

    IF p_accion = 'visto' THEN
        -- Sólo desde 'nuevo': abrir uno resuelto no lo devuelve a visto.
        IF v_estado = 'nuevo' THEN
            UPDATE public.reportes_problemas
               SET estado = 'visto', visto_at = now(), visto_por = v_uid
             WHERE id = p_id;
        END IF;

    ELSIF p_accion = 'resuelto' THEN
        UPDATE public.reportes_problemas
           SET estado = 'resuelto', resuelto_at = now(), resuelto_por = v_uid,
               -- Resolver sin haberlo marcado visto también es haberlo visto.
               visto_at  = COALESCE(visto_at, now()),
               visto_por = COALESCE(visto_por, v_uid)
         WHERE id = p_id;

    ELSIF p_accion = 'reabrir' THEN
        IF v_estado = 'resuelto' THEN
            UPDATE public.reportes_problemas
               SET estado = 'visto', reabierto_at = now(), reabierto_por = v_uid
             WHERE id = p_id;
        END IF;

    ELSIF p_accion = 'nota' THEN
        IF p_nota IS NOT NULL AND char_length(p_nota) > 4000 THEN
            RETURN jsonb_build_object('ok', false, 'motivo', 'nota_larga');
        END IF;
        UPDATE public.reportes_problemas
           SET nota_interna = NULLIF(btrim(COALESCE(p_nota, '')), ''),
               nota_editada_at = now()
         WHERE id = p_id;

    ELSE
        RETURN jsonb_build_object('ok', false, 'motivo', 'accion_desconocida');
    END IF;

    RETURN jsonb_build_object('ok', true,
        'estado', (SELECT estado FROM public.reportes_problemas WHERE id = p_id));
END;
$$;


-- ── 4 · La lista para Sistemas, con quién lo mandó ──────────────────────────
CREATE OR REPLACE FUNCTION public.reportes_admin()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT public.tiene_rol(ARRAY['SUPER_ADMIN']) THEN
        RETURN '[]'::jsonb;
    END IF;

    RETURN COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'id', r.id,
            'numero', r.numero,
            'codigo', public.codigo_reporte(r.numero),
            'descripcion', r.descripcion,
            'pantalla', r.pantalla,
            'captura_path', r.captura_path,
            'version_app', r.version_app,
            'dispositivo', r.dispositivo,
            'estado', r.estado,
            'nota_interna', r.nota_interna,
            'created_at', r.created_at,
            'visto_at', r.visto_at,
            'resuelto_at', r.resuelto_at,
            'reabierto_at', r.reabierto_at,
            'nota_editada_at', r.nota_editada_at,
            'email_enviado_at', r.email_enviado_at,
            'user_id', r.user_id,
            'nombre', u.name,
            'email', u.email,
            'telefono', NULLIF(btrim(COALESCE(u.phone, '')), ''),
            -- Para el historial alcanza el nombre de pila de quien gestionó.
            'visto_por', split_part(btrim(COALESCE(uv.name, '')), ' ', 1),
            'resuelto_por', split_part(btrim(COALESCE(ur.name, '')), ' ', 1),
            'reabierto_por', split_part(btrim(COALESCE(ua.name, '')), ' ', 1)
        ) ORDER BY r.created_at DESC)
          FROM public.reportes_problemas r
          LEFT JOIN public.users u  ON u.id  = r.user_id
          LEFT JOIN public.users uv ON uv.id = r.visto_por
          LEFT JOIN public.users ur ON ur.id = r.resuelto_por
          LEFT JOIN public.users ua ON ua.id = r.reabierto_por
    ), '[]'::jsonb);
END;
$$;


-- ── 5 · El email a Sistemas ─────────────────────────────────────────────────
-- Mismo molde que trigger_nocturna_entrada: sólo el id viaja (en la cola de
-- pg_net no queda ni el texto ni quién lo mandó) y la función lee el resto
-- con la clave de servicio. A diferencia de aquel, el envío va envuelto en su
-- propio bloque: si pg_net falla, el reporte se guarda igual.
CREATE OR REPLACE FUNCTION public.reportes_problemas_email()
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
            RAISE WARNING '[reportes] falta el secreto webhook_service_role_key: sin email para %', NEW.id;
            RETURN NULL;
        END IF;

        PERFORM net.http_post(
            url := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/send-reporte-problema',
            body := jsonb_build_object('reporte_id', NEW.id),
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || v_key
            ),
            timeout_milliseconds := 20000
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[reportes] no se pudo encolar el email de %: %', NEW.id, SQLERRM;
    END;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_reportes_problemas_email ON public.reportes_problemas;
CREATE TRIGGER trg_reportes_problemas_email
    AFTER INSERT ON public.reportes_problemas
    FOR EACH ROW EXECUTE FUNCTION public.reportes_problemas_email();


-- ── 6 · La notificación in-app lleva al reporte ─────────────────────────────
CREATE OR REPLACE FUNCTION public.reportes_problemas_avisar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin record;
BEGIN
    FOR v_admin IN
        SELECT id FROM public.users
         WHERE (role)::text = 'SUPER_ADMIN'
            OR COALESCE(roles, '{}') && ARRAY['SUPER_ADMIN']
    LOOP
        INSERT INTO public.app_notifications (user_id, title, message, type, action_url)
        VALUES (
            v_admin.id,
            'Nuevo reporte ' || public.codigo_reporte(NEW.numero),
            COALESCE(NULLIF(btrim(NEW.pantalla), ''), 'Sin pantalla')
                || ' · ' || left(btrim(NEW.descripcion), 90),
            'REPORTE_PROBLEMA',
            '/panel-admin/reportes?id=' || NEW.id
        );
    END LOOP;
    RETURN NULL;
END;
$$;


-- ── Permisos ────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.gestionar_reporte(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reportes_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reportes_problemas_email() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gestionar_reporte(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reportes_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.codigo_reporte(integer) TO authenticated;

COMMENT ON FUNCTION public.gestionar_reporte(uuid, text, text) IS
    'Sistemas gestiona un reporte: visto · resuelto · reabrir · nota. Sólo SUPER_ADMIN.';
COMMENT ON FUNCTION public.reportes_admin() IS
    'Los reportes con nombre, email y teléfono de quien los mandó. Sólo SUPER_ADMIN.';
