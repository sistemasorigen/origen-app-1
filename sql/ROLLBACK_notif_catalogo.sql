-- ════════════════════════════════════════════════════════════════════════════
-- DESHACER sql/notif_catalogo.sql
--
-- Vuelve los 10 productores a su definición EXACTA de antes (copiada de
-- pg_proc el 2026-10-29, antes de aplicar), borra el catálogo, las reglas de
-- envío y el cron de los diferidos.
--
-- Los avisos que ya se crearon quedan donde están: lo único que se les cae es
-- la columna alerta_clave, que se borra con el ALTER del final.
--
-- ORDEN PARA DESHACER DE VERDAD
--   1 · Volver a desplegar send-push y notify-host de la versión anterior
--       (commit "feat(notif): catálogo de alertas y emisor central"^).
--   2 · Correr este archivo.
--   Al revés, send-push nuevo llamaría a notif_puede_enviar, que ya no
--   existe: manda igual (está hecho para fallar abriendo), pero deja un
--   error en el log por cada push.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1 · El cron ─────────────────────────────────────────────────────────────
SELECT cron.unschedule('notif-push-diferidos')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notif-push-diferidos');


-- ── 2 · Agenda: tareas ──────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.agenda_registrar_avisos(uuid, text, uuid[], text, jsonb);

CREATE OR REPLACE FUNCTION public.agenda_registrar_avisos(
    p_tarea uuid, p_tipo text, p_users uuid[],
    p_titulo text, p_mensaje text, p_tipo_notificacion text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_uid uuid;
    v_id uuid;
    v_nuevas integer := 0;
BEGIN
    FOREACH v_uid IN ARRAY COALESCE(p_users, '{}'::uuid[]) LOOP
        CONTINUE WHEN v_uid IS NULL;

        -- El INSERT con ON CONFLICT es el que decide: si esta persona ya fue
        -- avisada de esto por esta tarea, no hay fila nueva y no hay
        -- notificación. Reasignar y volver, o reabrir y completar otra vez,
        -- no repite nada.
        v_id := NULL;
        INSERT INTO public.agenda_avisos (tarea_id, user_id, tipo, canal, estado, enviado_at)
        VALUES (p_tarea, v_uid, p_tipo, 'app', 'enviado', now())
        ON CONFLICT (tarea_id, user_id, tipo, canal) DO NOTHING
        RETURNING id INTO v_id;

        IF v_id IS NOT NULL THEN
            INSERT INTO public.app_notifications (user_id, title, message, type, action_url)
            VALUES (v_uid, p_titulo, p_mensaje, p_tipo_notificacion, '/agenda?tarea=' || p_tarea);
            v_nuevas := v_nuevas + 1;
        END IF;
    END LOOP;
    RETURN v_nuevas;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.agenda_tareas_avisar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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

        PERFORM public.agenda_registrar_avisos(
            NEW.id, 'asignada', v_users,
            'Nueva tarea: ' || NEW.nombre,
            COALESCE(v_sub_nombre, 'Tu equipo') || ' · ' || v_fecha || ' · ' || v_horario,
            'AGENDA_TAREA_ASIGNADA');
    END IF;

    -- COMPLETADA: pasa a 'completada' desde otro estado.
    IF TG_OP = 'UPDATE' AND NEW.estado = 'completada' AND OLD.estado IS DISTINCT FROM 'completada' THEN
        SELECT array_agg(e.user_id) INTO v_users
          FROM public.agenda_departamento_encargados e
          JOIN public.users u ON u.id = e.user_id AND u.is_active IS NOT FALSE
         WHERE e.departamento_id = NEW.departamento_id
           AND e.user_id IS DISTINCT FROM COALESCE(auth.uid(), NEW.completada_por);

        SELECT NULLIF(btrim(COALESCE(name, '')), '') INTO v_quien FROM public.users WHERE id = NEW.completada_por;

        PERFORM public.agenda_registrar_avisos(
            NEW.id, 'completada', v_users,
            'Tarea completada: ' || NEW.nombre,
            COALESCE(v_sub_nombre, 'Sin equipo') || ' · por ' || COALESCE(v_quien, 'alguien del equipo'),
            'AGENDA_TAREA_COMPLETADA');
    END IF;

    RETURN NULL;
END;
$fn$;


-- ── 3 · Agenda: solicitudes ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.agenda_solicitudes_avisar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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
            '/perfil/solicitudes'
        );
    END IF;
    RETURN NULL;
END;
$fn$;


-- ── 4 · Sistemas: reportes ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reportes_problemas_avisar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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
$fn$;


-- ── 5 · Sistemas: pedidos de datos ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.solicitudes_datos_avisar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
declare
    v_admin record;
    v_tipo text := case new.tipo
        when 'acceso' then 'Acceso a mis datos'
        when 'rectificacion' then 'Corrección de datos'
        else 'Eliminar mi cuenta' end;
begin
    for v_admin in
        select id from public.users
         where (role)::text = 'SUPER_ADMIN'
            or coalesce(roles, '{}') && array['SUPER_ADMIN']
    loop
        insert into public.app_notifications (user_id, title, message, type, action_url)
        values (
            v_admin.id,
            'Nueva solicitud de datos N.º ' || lpad(new.numero::text, 4, '0'),
            v_tipo,
            'SOLICITUD_DATOS',
            '/panel-admin/solicitudes-datos'
        );
    end loop;
    return null;
end;
$fn$;


-- ── 6 · Punto: pedido listo ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.marcar_venta(p_id uuid, p_estado text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
declare
    v_uid uuid := auth.uid();
    v_venta record;
    v_aviso boolean := false;
begin
    if not public.atiende_el_punto() then
        return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    end if;

    if p_estado is null or p_estado not in ('lista', 'retirada') then
        return jsonb_build_object('ok', false, 'motivo', 'estado_invalido');
    end if;

    select id, codigo, user_id, lista_at, retirada_at
      into v_venta
      from public.ventas_voluntarios
     where id = p_id
       for update;

    if not found then
        return jsonb_build_object('ok', false, 'motivo', 'no_existe');
    end if;

    if p_estado = 'lista' then
        if v_venta.lista_at is null then
            update public.ventas_voluntarios
               set lista_at = now(), lista_por = v_uid
             where id = p_id;
            v_aviso := true;
        end if;
    else
        if v_venta.retirada_at is null then
            update public.ventas_voluntarios
               set retirada_at = now(),
                   retirada_por = v_uid,
                   -- Se lo llevó: si nunca se marcó listo, lo estuvo igual.
                   lista_at = coalesce(lista_at, now()),
                   lista_por = coalesce(lista_por, v_uid)
             where id = p_id;
        end if;
    end if;

    if v_aviso and v_venta.user_id is not null then
        insert into public.app_notifications (user_id, title, message, type, action_url)
        values (
            v_venta.user_id,
            'Tu pedido ' || v_venta.codigo || ' está listo',
            'Retiralo en el Punto de Información.',
            'PEDIDO_LISTO',
            '/perfil/compras/' || p_id::text
        );
    end if;

    select lista_at, retirada_at into v_venta
      from public.ventas_voluntarios where id = p_id;

    return jsonb_build_object(
        'ok', true,
        'estado', public.estado_venta(v_venta.lista_at, v_venta.retirada_at),
        'lista_at', v_venta.lista_at,
        'retirada_at', v_venta.retirada_at
    );
end;
$fn$;


-- ── 7 · GCX: recordatorio de asistencia ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_attendance_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_host_id uuid;
  v_now timestamptz;
  v_today date;
  v_current_minutes integer;
  v_day_names text[] := ARRAY['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  v_es_day_names text[] := ARRAY['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  v_today_day_es text;
  v_group RECORD;
  v_meeting_hour integer;
  v_meeting_minute integer;
  v_meeting_total_minutes integer;
  v_minutes_since integer;
  v_has_attendance boolean;
  v_already_notified boolean;
  v_notified_count integer := 0;
BEGIN
  -- Argentina timezone: UTC-3
  v_now := NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires';
  v_today := v_now::date;
  v_current_minutes := EXTRACT(HOUR FROM v_now)::integer * 60 + EXTRACT(MINUTE FROM v_now)::integer;

  -- Day of week in Spanish (0=Sunday)
  v_today_day_es := v_es_day_names[EXTRACT(DOW FROM v_now)::integer + 1];

  -- Only run for the currently authenticated user who is a host
  v_host_id := auth.uid();
  IF v_host_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_group IN
    SELECT g.id, g.name, g.host_id, g.co_host_id, g.meeting_time
    FROM groups g
    WHERE g.meeting_day = v_today_day_es
      AND g.status = 'approved'
      AND (g.host_id = v_host_id OR g.co_host_id = v_host_id)
  LOOP
    -- Parse meeting_time (HH:MM)
    BEGIN
      v_meeting_hour   := SPLIT_PART(v_group.meeting_time, ':', 1)::integer;
      v_meeting_minute := SPLIT_PART(v_group.meeting_time, ':', 2)::integer;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;

    v_meeting_total_minutes := v_meeting_hour * 60 + v_meeting_minute;
    v_minutes_since := v_current_minutes - v_meeting_total_minutes;

    -- Window: 3h to 4h after meeting start
    IF v_minutes_since < 180 OR v_minutes_since >= 240 THEN
      CONTINUE;
    END IF;

    -- Check if attendance already registered today
    SELECT EXISTS (
      SELECT 1 FROM group_attendance
      WHERE group_id = v_group.id AND date = v_today
    ) INTO v_has_attendance;

    IF v_has_attendance THEN
      CONTINUE;
    END IF;

    -- Check if reminder already sent today for this group (dedup)
    SELECT EXISTS (
      SELECT 1 FROM app_notifications
      WHERE user_id = v_host_id
        AND type = 'attendance_reminder'
        AND action_url = '/groups/host?group=' || v_group.id
        AND created_at >= (v_today::timestamptz AT TIME ZONE 'UTC')
    ) INTO v_already_notified;

    IF v_already_notified THEN
      CONTINUE;
    END IF;

    -- Insert notification for host (and co-host if applicable)
    INSERT INTO app_notifications (user_id, title, message, type, action_url)
    VALUES (
      v_host_id,
      'Recordatorio: Pasá asistencia 📋',
      'La reunión de "' || v_group.name || '" terminó hace más de 3 horas. Registrá la asistencia.',
      'attendance_reminder',
      '/groups/host?group=' || v_group.id
    );

    v_notified_count := v_notified_count + 1;
  END LOOP;

  RETURN v_notified_count;
END;
$fn$;


-- ── 8 · La notificación de prueba ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.push_enviar_prueba()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_uid uuid := auth.uid();
    v_hoy timestamptz := date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires';
    n integer;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.push_suscripciones WHERE user_id = v_uid) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_dispositivos');
    END IF;

    SELECT count(*) INTO n FROM public.app_notifications
     WHERE user_id = v_uid AND type = 'PUSH_PRUEBA' AND created_at >= v_hoy;
    IF n >= 5 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'tope', 'quedan', 0);
    END IF;

    INSERT INTO public.app_notifications (user_id, title, message, type, action_url)
    VALUES (v_uid, 'Notificación de prueba',
            'Si ves esto, las notificaciones de Origen llegan a este dispositivo.',
            'PUSH_PRUEBA', '/notificaciones');

    RETURN jsonb_build_object('ok', true, 'quedan', 4 - n);
END;
$fn$;


-- ── 9 · El push de "hay una versión nueva" ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.avisar_actualizacion(
    p_titulo  text    DEFAULT 'Hay una versión nueva',
    p_mensaje text    DEFAULT 'Tocá acá y fijate si ya la tenés.',
    p_horas   integer DEFAULT 6
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_n integer;
BEGIN
    INSERT INTO public.app_notifications (user_id, title, message, type, action_url)
    SELECT DISTINCT p.user_id,
           p_titulo,
           p_mensaje,
           'info',
           -- "Sobre la app": ahí está el botón para chequear la versión.
           '/perfil/app'
      FROM public.push_suscripciones p
      JOIN public.users u ON u.id = p.user_id
     WHERE u.is_active IS NOT FALSE
       AND NOT EXISTS (
            SELECT 1
              FROM public.app_notifications a
             WHERE a.user_id = p.user_id
               AND a.title = p_titulo
               AND a.created_at > now() - make_interval(hours => GREATEST(p_horas, 0))
       );

    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN v_n;
END;
$fn$;


-- ── 10 · crear_aviso, como estaba ───────────────────────────────────────────
DROP FUNCTION IF EXISTS public.crear_aviso(uuid, text, jsonb, text);

CREATE OR REPLACE FUNCTION public.crear_aviso(
    p_destinatario uuid,
    p_tipo         text,
    p_titulo       text,
    p_mensaje      text,
    p_url          text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_uid     uuid := auth.uid();
    v_titulo  text := btrim(COALESCE(p_titulo, ''));
    v_mensaje text := btrim(COALESCE(p_mensaje, ''));
    v_url     text := NULLIF(btrim(COALESCE(p_url, '')), '');
    v_gestor  boolean;
    v_ok      boolean := false;
    n integer;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;

    IF p_tipo IS NULL OR p_tipo NOT IN (
        'ATTENDANCE', 'REGISTRATION', 'REGISTRATION_APPROVED', 'REGISTRATION_REJECTED',
        'GROUP_APPROVED', 'GROUP_REJECTED'
    ) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'tipo_invalido');
    END IF;

    IF v_titulo = '' OR v_mensaje = '' OR length(v_titulo) > 120 OR length(v_mensaje) > 500 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'texto_invalido');
    END IF;

    IF v_url IS NOT NULL AND (
           left(v_url, 1) <> '/'
        OR left(v_url, 2) = '//'
        OR v_url ~* 'https?:'
        OR v_url ~ '[[:space:][:cntrl:]\\]'
        OR length(v_url) > 300
    ) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'url_invalida');
    END IF;

    v_gestor := public.tiene_rol(ARRAY['SUPER_ADMIN', 'ADMIN_GROUPS', 'ENCARGADO_GRUPOS', 'PASTOR']);

    IF p_tipo = 'ATTENDANCE' THEN
        v_ok := p_destinatario = v_uid;

    ELSIF p_tipo = 'REGISTRATION' THEN
        v_ok := EXISTS (
            SELECT 1
              FROM public.group_registrations r
              JOIN public.groups g ON g.id = r.group_id
             WHERE (r.user_id = v_uid OR r.partner_user_id = v_uid)
               AND p_destinatario IN (g.host_id, g.co_host_id)
        );

    ELSIF p_tipo IN ('REGISTRATION_APPROVED', 'REGISTRATION_REJECTED') THEN
        v_ok := EXISTS (
            SELECT 1
              FROM public.group_registrations r
              JOIN public.groups g ON g.id = r.group_id
             WHERE p_destinatario IN (r.user_id, r.partner_user_id)
               AND (v_gestor OR v_uid IN (g.host_id, g.co_host_id))
        );

    ELSIF p_tipo IN ('GROUP_APPROVED', 'GROUP_REJECTED') THEN
        v_ok := v_gestor AND EXISTS (
            SELECT 1 FROM public.groups g WHERE p_destinatario IN (g.host_id, g.co_host_id)
        );
    END IF;

    IF NOT COALESCE(v_ok, false) OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_destinatario) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    IF NOT public.tiene_rol(ARRAY['SUPER_ADMIN']) THEN
        SELECT count(*) INTO n FROM public.app_notifications
         WHERE creado_por = v_uid AND created_at > now() - interval '1 hour';
        IF n >= 60 THEN
            RETURN jsonb_build_object('ok', false, 'motivo', 'limite');
        END IF;
    END IF;

    INSERT INTO public.app_notifications (user_id, title, message, type, action_url, creado_por)
    VALUES (p_destinatario, v_titulo, v_mensaje, p_tipo, v_url, v_uid);

    RETURN jsonb_build_object('ok', true);
END;
$fn$;

REVOKE ALL ON FUNCTION public.crear_aviso(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_aviso(uuid, text, text, text, text) TO authenticated;


-- ── 11 · El catálogo, el emisor y las reglas ────────────────────────────────
DROP FUNCTION IF EXISTS public.notif_enviar_prueba(uuid, jsonb);
DROP FUNCTION IF EXISTS public.notif_guardar_automatica(uuid, text, text, boolean, boolean, time, time, integer);
DROP FUNCTION IF EXISTS public.notif_alertas_admin();
DROP FUNCTION IF EXISTS public.notif_diferidos_tomar(integer);
DROP FUNCTION IF EXISTS public.notif_puede_enviar(uuid);
DROP FUNCTION IF EXISTS public.crear_aviso_permitido(uuid, text);
DROP FUNCTION IF EXISTS public.notif_emitir(text, uuid, jsonb, text, uuid);
DROP FUNCTION IF EXISTS public.notif_emitir_texto(text, uuid, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.notif_no_molestar_hasta(timestamptz, time, time);
DROP FUNCTION IF EXISTS public.notif_render(text, jsonb, integer);
DROP FUNCTION IF EXISTS public.notif_url_interna(text);
DROP FUNCTION IF EXISTS public.notif_recortar(text, integer);

DROP TABLE IF EXISTS public.notif_push_diferidos;
DROP TABLE IF EXISTS public.notif_push_log;
DROP TABLE IF EXISTS public.notif_alertas;

ALTER TABLE public.app_notifications DROP COLUMN IF EXISTS alerta_clave;
