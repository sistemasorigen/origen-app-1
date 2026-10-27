-- ════════════════════════════════════════════════════════════════════════════
-- Agenda Origen · los avisos (prompt 8)
-- 2026-10-27 · ✅ APLICADO el 2026-10-27 (PROBAR_ en verde antes y después; send-agenda-aviso desplegada antes)
--
-- Emails (Resend, con send-agenda-aviso) y notificaciones en la app:
--
--   Tarea asignada   → quien dirige + los integrantes del sub-departamento,
--                      SIN los encargados del departamento. Email + app.
--   Tarea completada → los encargados del departamento, menos quien la
--                      completó. Email + app.
--   Solicitud nueva  → los encargados del departamento. Sólo app.
--   Solicitud revisada (aceptada o no) → quien la pidió. Sólo app.
--
-- REGLAS (decisiones de Ignacio)
--   · Los emails se activan solos el lunes 2/11/2026 a las 00:00 (hora
--     argentina): agenda_emails_desde(). Lo que pasa antes queda 'pausado' y
--     NO se manda después. Las notificaciones en la app van desde ya.
--   · Nadie recibe dos veces el mismo aviso por la misma tarea: lo garantiza
--     el UNIQUE (tarea_id, user_id, tipo, canal) de agenda_avisos. Reasignar
--     y volver, o reabrir y completar de nuevo, no repite nada.
--   · El tope de 40 emails por día lo aplica la función (sección 35).
--
-- MOLDE: sql/reportes_sistemas.sql. El trigger manda SÓLO {tarea_id, tipo}
-- (nada de row_to_json(NEW): pg_net guarda el cuerpo de cada pedido), la
-- clave sale de Vault, el envío va en su propio BEGIN … EXCEPTION y con
-- timeout de 20000. Si pg_net falla o falta el secreto, la tarea se guarda
-- igual y los avisos quedan 'pendiente' con el error anotado.
--
-- ORDEN: desplegar la función send-agenda-aviso ANTES de correr esto.
-- Pruebas: sql/PROBAR_agenda_avisos.sql · Deshacer: sql/ROLLBACK_agenda_avisos.sql
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1 · El registro de qué salió y qué no ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agenda_avisos (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tarea_id   uuid NOT NULL REFERENCES public.agenda_tareas(id) ON DELETE CASCADE,
    user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    tipo       text NOT NULL CHECK (tipo IN ('asignada', 'completada')),
    canal      text NOT NULL CHECK (canal IN ('email', 'app')),
    estado     text NOT NULL CHECK (estado IN ('pendiente', 'enviado', 'pausado', 'tope_diario', 'error', 'sin_email')),
    error      text,
    created_at timestamptz NOT NULL DEFAULT now(),
    enviado_at timestamptz,
    CONSTRAINT agenda_avisos_una_vez UNIQUE (tarea_id, user_id, tipo, canal)
);

-- El tope diario cuenta los emails enviados desde las 00:00 de hoy.
CREATE INDEX IF NOT EXISTS agenda_avisos_emails_enviados
    ON public.agenda_avisos (enviado_at)
    WHERE canal = 'email' AND estado = 'enviado';

-- Nadie de afuera la toca: sólo los triggers (SECURITY DEFINER) y la
-- función, con la clave de servicio.
ALTER TABLE public.agenda_avisos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agenda_avisos FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.agenda_avisos IS
    'Agenda Origen: un aviso por tarea, persona, tipo (asignada/completada) y canal (email/app). El UNIQUE impide repetirlo. Sin acceso para anon ni authenticated.';


-- ── 2 · La fecha de activación, en un solo lugar ────────────────────────────
-- El mismo instante que EMAILS_AGENDA_DESDE en services/agenda.ts.
-- Argentina no tiene horario de verano: -03 es exacto.
CREATE OR REPLACE FUNCTION public.agenda_emails_desde()
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT '2026-11-02 00:00:00-03'::timestamptz;
$$;


-- ── 3 · Registrar los avisos de una tarea ───────────────────────────────────
-- Para cada persona: el aviso 'app' (y, si es nuevo, la notificación) y el
-- aviso 'email' con su estado. Devuelve cuántos emails quedaron 'pendiente'
-- (los que hay que pedirle a la función).
CREATE OR REPLACE FUNCTION public.agenda_registrar_avisos(
    p_tarea uuid,
    p_tipo text,
    p_users uuid[],
    p_titulo text,
    p_mensaje text,
    p_tipo_notificacion text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid;
    v_id uuid;
    v_email text;
    v_estado text;
    v_pendientes integer := 0;
BEGIN
    FOREACH v_uid IN ARRAY COALESCE(p_users, '{}'::uuid[]) LOOP
        CONTINUE WHEN v_uid IS NULL;

        v_id := NULL;
        INSERT INTO public.agenda_avisos (tarea_id, user_id, tipo, canal, estado, enviado_at)
        VALUES (p_tarea, v_uid, p_tipo, 'app', 'enviado', now())
        ON CONFLICT (tarea_id, user_id, tipo, canal) DO NOTHING
        RETURNING id INTO v_id;

        IF v_id IS NOT NULL THEN
            INSERT INTO public.app_notifications (user_id, title, message, type, action_url)
            VALUES (v_uid, p_titulo, p_mensaje, p_tipo_notificacion, '/agenda?tarea=' || p_tarea);
        END IF;

        SELECT NULLIF(btrim(COALESCE(email, '')), '') INTO v_email FROM public.users WHERE id = v_uid;
        v_estado := CASE WHEN v_email IS NULL THEN 'sin_email'
                         WHEN now() >= public.agenda_emails_desde() THEN 'pendiente'
                         ELSE 'pausado' END;

        v_id := NULL;
        INSERT INTO public.agenda_avisos (tarea_id, user_id, tipo, canal, estado)
        VALUES (p_tarea, v_uid, p_tipo, 'email', v_estado)
        ON CONFLICT (tarea_id, user_id, tipo, canal) DO NOTHING
        RETURNING id INTO v_id;

        IF v_id IS NOT NULL AND v_estado = 'pendiente' THEN
            v_pendientes := v_pendientes + 1;
        END IF;
    END LOOP;
    RETURN v_pendientes;
END;
$$;


-- ── 4 · Pedirle los emails a la función ─────────────────────────────────────
-- SÓLO el id y el tipo viajan. Si falta el secreto o pg_net falla, la tarea
-- se guarda igual: los avisos quedan 'pendiente' con el error anotado.
CREATE OR REPLACE FUNCTION public.agenda_pedir_emails(p_tarea uuid, p_tipo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key text;
    v_error text;
BEGIN
    BEGIN
        SELECT decrypted_secret INTO v_key
          FROM vault.decrypted_secrets
         WHERE name = 'webhook_service_role_key';

        IF v_key IS NULL THEN
            v_error := 'Falta el secreto webhook_service_role_key: el email no se pidió.';
        ELSE
            PERFORM net.http_post(
                url := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/send-agenda-aviso',
                body := jsonb_build_object('tarea_id', p_tarea, 'tipo', p_tipo),
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || v_key
                ),
                timeout_milliseconds := 20000
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_error := 'No se pudo pedir el envío: ' || left(SQLERRM, 200);
    END;

    IF v_error IS NOT NULL THEN
        RAISE WARNING '[agenda] % (tarea %)', v_error, p_tarea;
        UPDATE public.agenda_avisos
           SET error = v_error
         WHERE tarea_id = p_tarea AND tipo = p_tipo AND canal = 'email' AND estado = 'pendiente';
    END IF;
END;
$$;


-- ── 5 · Los avisos de las tareas ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.agenda_tareas_avisar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sub_nombre text;
    v_users uuid[];
    v_horario text;
    v_fecha text;
    v_quien text;
BEGIN
    SELECT nombre INTO v_sub_nombre FROM public.agenda_subdepartamentos WHERE id = NEW.subdepartamento_id;

    -- ASIGNADA: se crea con sub, o le cambia asignada_at (reasignar, editar
    -- el sub, asignar una que esperaba). También si cambia el sub: dentro de
    -- una misma transacción now() no avanza y asignada_at quedaría igual.
    IF NEW.subdepartamento_id IS NOT NULL
       AND (TG_OP = 'INSERT'
            OR NEW.asignada_at IS DISTINCT FROM OLD.asignada_at
            OR NEW.subdepartamento_id IS DISTINCT FROM OLD.subdepartamento_id) THEN

        SELECT array_agg(DISTINCT x.uid) INTO v_users
          FROM (SELECT s.lider_id AS uid FROM public.agenda_subdepartamentos s
                 WHERE s.id = NEW.subdepartamento_id AND s.lider_id IS NOT NULL
                UNION
                SELECT m.user_id FROM public.agenda_subdepartamento_miembros m
                 WHERE m.subdepartamento_id = NEW.subdepartamento_id) x
          JOIN public.users u ON u.id = x.uid AND u.is_active IS NOT FALSE
         WHERE NOT EXISTS (SELECT 1 FROM public.agenda_departamento_encargados e
                            WHERE e.departamento_id = NEW.departamento_id AND e.user_id = x.uid);

        v_fecha := (ARRAY['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'])[extract(dow FROM NEW.fecha)::int + 1]
                   || ' ' || to_char(NEW.fecha, 'DD/MM');
        v_horario := CASE WHEN NEW.todo_el_dia OR NEW.hora_desde IS NULL THEN 'Todo el día'
                          ELSE to_char(NEW.hora_desde, 'HH24:MI')
                               || COALESCE(' – ' || to_char(NEW.hora_hasta, 'HH24:MI'), '') END;

        IF public.agenda_registrar_avisos(
               NEW.id, 'asignada', v_users,
               'Nueva tarea: ' || NEW.nombre,
               COALESCE(v_sub_nombre, 'Tu equipo') || ' · ' || v_fecha || ' · ' || v_horario,
               'AGENDA_TAREA_ASIGNADA') > 0 THEN
            PERFORM public.agenda_pedir_emails(NEW.id, 'asignada');
        END IF;
    END IF;

    -- COMPLETADA: pasa a 'completada' desde otro estado.
    IF TG_OP = 'UPDATE' AND NEW.estado = 'completada' AND OLD.estado IS DISTINCT FROM 'completada' THEN
        SELECT array_agg(e.user_id) INTO v_users
          FROM public.agenda_departamento_encargados e
          JOIN public.users u ON u.id = e.user_id AND u.is_active IS NOT FALSE
         WHERE e.departamento_id = NEW.departamento_id
           AND e.user_id IS DISTINCT FROM COALESCE(auth.uid(), NEW.completada_por);

        SELECT NULLIF(btrim(COALESCE(name, '')), '') INTO v_quien FROM public.users WHERE id = NEW.completada_por;

        IF public.agenda_registrar_avisos(
               NEW.id, 'completada', v_users,
               'Tarea completada: ' || NEW.nombre,
               COALESCE(v_sub_nombre, 'Sin equipo') || ' · por ' || COALESCE(v_quien, 'alguien del equipo'),
               'AGENDA_TAREA_COMPLETADA') > 0 THEN
            PERFORM public.agenda_pedir_emails(NEW.id, 'completada');
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_agenda_tareas_avisar ON public.agenda_tareas;
CREATE TRIGGER trg_agenda_tareas_avisar
    AFTER INSERT OR UPDATE ON public.agenda_tareas
    FOR EACH ROW EXECUTE FUNCTION public.agenda_tareas_avisar();


-- ── 6 · Los avisos de las solicitudes (sólo en la app) ──────────────────────
CREATE OR REPLACE FUNCTION public.agenda_solicitudes_avisar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_dep text;
    v_quien text;
BEGIN
    SELECT nombre INTO v_dep FROM public.agenda_departamentos WHERE id = NEW.departamento_id;

    IF TG_OP = 'INSERT' THEN
        SELECT NULLIF(btrim(COALESCE(name, '')), '') INTO v_quien FROM public.users WHERE id = NEW.solicitante_id;
        -- A cada encargado. Si quien la pide es encargado de ese mismo
        -- departamento, a él no: ya sabe lo que pidió.
        INSERT INTO public.app_notifications (user_id, title, message, type, action_url)
        SELECT e.user_id,
               'Solicitud nueva para ' || COALESCE(v_dep, 'tu departamento'),
               COALESCE(v_quien, 'Alguien de la iglesia') || ' · '
                   || left(btrim(regexp_replace(NEW.detalles, '\s+', ' ', 'g')), 90),
               'AGENDA_SOLICITUD_NUEVA',
               '/departamentos/' || NEW.departamento_id || '?tab=solicitudes'
          FROM public.agenda_departamento_encargados e
         WHERE e.departamento_id = NEW.departamento_id
           AND e.user_id IS DISTINCT FROM NEW.solicitante_id;

    ELSIF OLD.estado = 'nueva' AND NEW.estado IN ('aceptada', 'rechazada')
          AND NEW.solicitante_id IS NOT NULL
          AND NEW.solicitante_id IS DISTINCT FROM NEW.revisada_por THEN
        INSERT INTO public.app_notifications (user_id, title, message, type, action_url)
        VALUES (
            NEW.solicitante_id,
            CASE NEW.estado
                WHEN 'aceptada' THEN 'Tu solicitud a ' || COALESCE(v_dep, 'el departamento') || ' fue aceptada'
                ELSE 'Tu solicitud a ' || COALESCE(v_dep, 'el departamento') || ' no fue aceptada'
            END,
            CASE NEW.estado
                WHEN 'aceptada' THEN 'El equipo ya la tiene en cuenta para organizarla. ¡Gracias por escribir!'
                ELSE 'Esta vez no la pueden tomar. Gracias por escribirles.'
            END,
            'AGENDA_SOLICITUD_REVISADA',
            -- Mi cuenta → Solicitudes: donde ve en qué quedó lo que pidió
            -- (sql/agenda_avisos_link_mis_solicitudes.sql; antes /solicitudes).
            '/perfil/solicitudes'
        );
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_agenda_solicitudes_avisar ON public.agenda_solicitudes;
CREATE TRIGGER trg_agenda_solicitudes_avisar
    AFTER INSERT OR UPDATE OF estado ON public.agenda_solicitudes
    FOR EACH ROW EXECUTE FUNCTION public.agenda_solicitudes_avisar();


-- ── 7 · Permisos ────────────────────────────────────────────────────────────
-- Nadie de afuera ejecuta nada de esto: lo corren los triggers.
REVOKE ALL ON FUNCTION public.agenda_emails_desde() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_registrar_avisos(uuid, text, uuid[], text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_pedir_emails(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_tareas_avisar() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_solicitudes_avisar() FROM PUBLIC, anon, authenticated;
-- La función la lee con la clave de servicio (doble chequeo de la fecha).
GRANT EXECUTE ON FUNCTION public.agenda_emails_desde() TO service_role;

COMMENT ON FUNCTION public.agenda_emails_desde() IS
    'Agenda Origen: desde cuándo salen los emails (lunes 2/11/2026 00:00, hora argentina). Antes, quedan pausados. El mismo instante que EMAILS_AGENDA_DESDE en services/agenda.ts.';
COMMENT ON FUNCTION public.agenda_registrar_avisos(uuid, text, uuid[], text, text, text) IS
    'Agenda Origen (interna): registra los avisos app y email de una tarea, sin repetir, y crea las notificaciones. Devuelve cuántos emails quedaron pendientes.';
COMMENT ON FUNCTION public.agenda_pedir_emails(uuid, text) IS
    'Agenda Origen (interna): pide los emails pendientes a send-agenda-aviso con sólo {tarea_id, tipo}. Si falla, anota el error y la tarea se guarda igual.';
COMMENT ON FUNCTION public.agenda_tareas_avisar() IS
    'Agenda Origen: trigger de agenda_tareas. Asignada → equipo del sub sin los encargados; completada → encargados menos quien la completó.';
COMMENT ON FUNCTION public.agenda_solicitudes_avisar() IS
    'Agenda Origen: trigger de agenda_solicitudes. Nueva → encargados; aceptada o no → quien la pidió. Sólo notificaciones en la app.';
