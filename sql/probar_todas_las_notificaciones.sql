-- ════════════════════════════════════════════════════════════════════════════
-- Mandarse TODAS las notificaciones de la app, para ver cómo se ven
-- 2026-10-28 · pedido de Ignacio
--
-- QUÉ HACE. Crea un aviso de cada tipo que existe en la app, para UNA sola
-- persona: la del email de abajo. Cada uno dispara su push
-- (trg_app_notifications_push → send-push), así que llegan al teléfono como
-- llegarían de verdad, con su ícono, su texto y su link.
--
-- ⚠️ MANDA PUSHES DE VERDAD, pero sólo a esa persona. Nadie más recibe nada.
-- El `tag` de cada push es `notif-<id>`, distinto para cada uno, así que NO se
-- pisan: llegan los 16 y quedan apilados.
--
-- LOS DATOS SON INVENTADOS. Los nombres de personas y de grupos dicen PRUEBA.
-- Los textos sí son los reales: están copiados de donde cada aviso se crea
-- (notify-host, crear_aviso, agenda_avisos.sql, push_notificaciones.sql…), para
-- que lo que se ve en el teléfono sea lo que va a ver la gente.
--
-- PARA LIMPIAR DESPUÉS, si molestan en la campanita. Por fecha y no por la
-- palabra PRUEBA: tres de los dieciséis no la dicen en el mensaje (la de
-- prueba del dispositivo, la solicitud revisada y la del reporte). Mirar
-- primero con un SELECT, porque la ventana se lleva también cualquier aviso
-- de verdad que haya llegado en esos minutos:
--   SELECT created_at, type, title FROM public.app_notifications
--    WHERE user_id = (SELECT id FROM public.users WHERE lower(email) = '<el email>')
--      AND created_at > now() - interval '15 minutes' ORDER BY created_at;
--   -- y si es todo lo que se quiere borrar, el mismo WHERE con DELETE.
--
-- Para ensayarlo sin mandar nada: envolver en BEGIN … ROLLBACK.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    -- ── Cambiar acá a quién se le manda ─────────────────────────────────────
    v_email text := 'nachoqueipo27@gmail.com';

    v_uid uuid;
    v_subs integer;
    v_n integer;
BEGIN
    SELECT id INTO v_uid FROM public.users WHERE lower(email) = lower(v_email);
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'No hay ninguna cuenta con el email %', v_email;
    END IF;

    SELECT count(*) INTO v_subs FROM public.push_suscripciones WHERE user_id = v_uid;

    INSERT INTO public.app_notifications (user_id, title, message, type, action_url) VALUES
    -- ── Los que tienen ícono propio en la pantalla de notificaciones ────────
    (v_uid, 'Notificación de prueba',
            'Si ves esto, las notificaciones de Origen llegan a este dispositivo.',
            'PUSH_PRUEBA', '/notificaciones'),

    (v_uid, 'Nueva solicitud de ingreso 👤',
            'Mara PRUEBA quiere unirse a "Grupo PRUEBA". Revisá las solicitudes pendientes.',
            'REGISTRATION', '/mis-grupos'),

    (v_uid, '✅ Asistencia registrada',
            'Registraste 4 presente(s) en Grupo PRUEBA el 28-octubre. ¡Seguí así!',
            'ATTENDANCE', '/mis-grupos'),

    (v_uid, '🔄 Grupo Re-enviado para Revisión',
            'Hugo PRUEBA editó y re-envió el grupo "Grupo PRUEBA". Requiere nueva revisión.',
            'ADMIN', '/admingcx/gestion-de-grupos'),

    (v_uid, '¡Tu grupo fue aprobado! 🎉',
            'El grupo "Grupo PRUEBA" fue aprobado y ya está visible en la app.',
            'success', '/mis-grupos'),

    (v_uid, 'Revisá los datos de tu grupo',
            'Faltan el día y el horario de "Grupo PRUEBA". Sin eso no aparece en el catálogo.',
            'warning', '/mis-grupos'),

    (v_uid, 'Nuevo Aspirante',
            'Hugo PRUEBA se postuló para ser anfitrión de un Grupo de Conexión.',
            'info', '/admingcx/gestion-de-anfitriones'),

    -- ── Agenda Origen (sql/agenda_avisos.sql) ───────────────────────────────
    (v_uid, 'Nueva tarea: Armar el video del domingo',
            'Diseño PRUEBA · mié 29/10 · 20:00 – 21:30',
            'AGENDA_TAREA_ASIGNADA', '/agenda'),

    (v_uid, 'Tarea completada: Armar el video del domingo',
            'Diseño PRUEBA · por Hugo PRUEBA',
            'AGENDA_TAREA_COMPLETADA', '/agenda'),

    (v_uid, 'Solicitud nueva para Comunicación PRUEBA',
            'Hugo PRUEBA · Necesitamos un flyer para el anuncio del domingo',
            'AGENDA_SOLICITUD_NUEVA', '/departamentos'),

    (v_uid, 'Tu solicitud a Comunicación PRUEBA fue aceptada',
            'El equipo ya la tiene en cuenta para organizarla. ¡Gracias por escribir!',
            'AGENDA_SOLICITUD_REVISADA', '/perfil/solicitudes'),

    -- ── Los que hoy caen en la campana genérica (no tienen ícono propio) ────
    (v_uid, 'Solicitud Aprobada',
            'Tu solicitud para unirte a Grupo PRUEBA ha sido aprobada. ¡Nos vemos!',
            'REGISTRATION_APPROVED', '/mis-grupos'),

    (v_uid, 'Solicitud Rechazada',
            'Tu solicitud para unirte a Grupo PRUEBA no ha podido ser aceptada.',
            'REGISTRATION_REJECTED', '/'),

    (v_uid, '¡Tu grupo fue aprobado! 🎉',
            'Tu grupo "Grupo PRUEBA" ha sido aprobado. Recuerda registrar asistencia cada Jueves.',
            'GROUP_APPROVED', '/mis-grupos'),

    (v_uid, 'Recordatorio: Pasá asistencia 📋',
            'La reunión de "Grupo PRUEBA" terminó hace más de 3 horas. Registrá la asistencia.',
            'attendance_reminder', '/mis-grupos'),

    (v_uid, 'Nuevo reporte REP-PRUEBA',
            'Eventos · No carga la lista de inscriptos',
            'REPORTE_PROBLEMA', '/panel-admin/reportes');

    GET DIAGNOSTICS v_n = ROW_COUNT;

    RAISE NOTICE 'Avisos creados: % · para: % · suscripciones de esa persona: %',
                 v_n, v_email, v_subs;

    IF v_subs = 0 THEN
        RAISE WARNING 'Esa persona NO tiene la app instalada con notificaciones: los avisos van a quedar sólo en la campanita, sin push.';
    END IF;
END;
$$;
