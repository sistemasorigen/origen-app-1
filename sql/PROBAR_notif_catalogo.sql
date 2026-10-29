-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de sql/notif_catalogo.sql
--
-- BEGIN … ROLLBACK, y el final es un RAISE EXCEPTION a propósito: se deshace
-- TODO, incluida la cola de pg_net. NO SALE NI UN PUSH NI UN EMAIL, ni a las
-- personas de prueba ni a las reales. NUNCA COMMIT.
--
-- Ojo: crear un grupo y un reporte de prueba dispara los webhooks de
-- email-notifier y send-reporte-problema, y avisar_actualizacion() le crea el
-- aviso a las personas reales que tienen la app instalada. Las tres cosas
-- quedan en la transacción y el ROLLBACK se las lleva (pg_net guarda el
-- pedido en una tabla común, que también se deshace).
--
-- QUÉ PRUEBA
--   T · Los 21 textos: cada productor genera EXACTAMENTE el mismo título,
--       mensaje, type y ruta que antes, ahora con su alerta_clave.
--   D · Las decisiones de envío (pausa, no molestar con el horario que cruza
--       la medianoche, tope por día, aviso sin clave).
--   P · Permisos: quién puede llamar a qué.
--   E · El estado de la semilla y las RPC de la pantalla.
--
-- Personas: Ana (anfitriona), Beto (co-anfitrión y encargado del depto),
-- Caro (inscripta y líder del sub), Dani (pareja de Caro), Eva (SUPER_ADMIN).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE TEMP TABLE r (orden serial, n text, caso text, esperado text, obtenido text);

-- Un renglón del reporte.
CREATE FUNCTION pg_temp.chk(p_n text, p_caso text, p_esperado text, p_obtenido text)
RETURNS void LANGUAGE sql AS $f$
    INSERT INTO r (n, caso, esperado, obtenido) VALUES (p_n, p_caso, p_esperado, p_obtenido);
$f$;

-- Los avisos de una persona, en una línea, para comparar contra el texto
-- exacto de hoy: título § mensaje § type § ruta § clave.
CREATE FUNCTION pg_temp.firma(p uuid) RETURNS text LANGUAGE sql AS $f$
    SELECT string_agg(a.title || ' § ' || a.message || ' § ' || a.type || ' § '
                      || COALESCE(a.action_url, '(sin ruta)') || ' § '
                      || COALESCE(a.alerta_clave, '(sin clave)'),
                      ' ‖ ' ORDER BY a.title, a.message)
      FROM public.app_notifications a WHERE a.user_id = p;
$f$;

CREATE FUNCTION pg_temp.limpiar(p uuid) RETURNS void LANGUAGE sql AS $f$
    DELETE FROM public.app_notifications WHERE user_id = p;
$f$;

CREATE FUNCTION pg_temp.sesion(p uuid) RETURNS void LANGUAGE sql AS $f$
    SELECT set_config('request.jwt.claims',
                      CASE WHEN p IS NULL THEN ''
                           ELSE json_build_object('sub', p::text, 'role', 'authenticated')::text END,
                      true);
$f$;

-- La decisión de notif_puede_enviar para el último aviso creado.
CREATE FUNCTION pg_temp.decision(p uuid) RETURNS text LANGUAGE sql AS $f$
    SELECT public.notif_puede_enviar(p)->>'decision';
$f$;


DO $suite$
DECLARE
    ZONA constant text := 'America/Argentina/Buenos_Aires';
    ana  uuid := gen_random_uuid();
    beto uuid := gen_random_uuid();
    caro uuid := gen_random_uuid();
    dani uuid := gen_random_uuid();
    eva  uuid := gen_random_uuid();
    -- Con forma de uuid a propósito: log_audit_event() castea groups.id a uuid.
    v_grupo  text := gen_random_uuid()::text;
    v_reg    uuid := gen_random_uuid();
    v_venta  uuid := gen_random_uuid();
    v_dep    uuid;
    v_sub    uuid;
    v_tarea  uuid;
    v_sol    uuid;
    v_sol2   uuid;
    v_rep    integer;
    v_num    integer;
    v_av     uuid;
    v_esp    text;
    v_url    text;
    v_j      jsonb;
    v_t      text;
    v_n      integer;
    v_hoy    date := (now() AT TIME ZONE ZONA)::date;
    v_hora   integer := extract(hour FROM (now() AT TIME ZONE ZONA))::integer;
    v_fallos integer;
    v_salida text;
BEGIN
-- ══════════════════════════════════════════════════════════════════════════
-- Fixture
-- ══════════════════════════════════════════════════════════════════════════
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
SELECT x, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'prueba.notif.' || left(x::text, 8) || '@test.local', '', now(), now()
  FROM unnest(ARRAY[ana, beto, caro, dani, eva]) x;

INSERT INTO public.users (id, name, email, role, roles, is_active) VALUES
    (ana,  'Ana PRUEBA',  'prueba.notif.ana@test.local',  'ANFITRION',   ARRAY['ANFITRION'],   true),
    (beto, 'Beto PRUEBA', 'prueba.notif.beto@test.local', 'ANFITRION',   ARRAY['ANFITRION'],   true),
    (caro, 'Caro PRUEBA', 'prueba.notif.caro@test.local', 'VIEWER',      ARRAY['VIEWER'],      true),
    (dani, 'Dani PRUEBA', 'prueba.notif.dani@test.local', 'VIEWER',      ARRAY['VIEWER'],      true),
    (eva,  'Eva PRUEBA',  'prueba.notif.eva@test.local',  'SUPER_ADMIN', ARRAY['SUPER_ADMIN'], true)
-- handle_new_user ya creó la fila al insertar en auth.users, y la deja
-- con is_active en false: hay que ponerlo a mano o media prueba no corre.
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role,
                              roles = EXCLUDED.roles, is_active = true;

INSERT INTO public.groups (id, name, leader_name, host_id, co_host_id, status, meeting_day, meeting_time)
VALUES (v_grupo, 'Grupo PRUEBA', 'Ana PRUEBA', ana, beto, 'approved',
        (ARRAY['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'])[extract(dow FROM (now() AT TIME ZONE ZONA))::int + 1],
        to_char(((now() AT TIME ZONE ZONA) - interval '3 hours 30 minutes')::time, 'HH24:MI'));

INSERT INTO public.group_registrations (id, group_id, user_id, partner_user_id, first_name, last_name, status)
VALUES (v_reg, v_grupo, caro, dani, 'Caro', 'PRUEBA', 'PENDING');

-- Eva tiene la app instalada (para push_enviar_prueba y notif_enviar_prueba).
INSERT INTO public.push_suscripciones (user_id, endpoint, p256dh, auth, plataforma, navegador)
VALUES (eva, 'https://ejemplo.prueba/notif/eva', 'p256dh-PRUEBA', 'auth-PRUEBA', 'ios', 'PRUEBA');

-- Agenda: departamento, sub, encargado y miembro.
INSERT INTO public.agenda_departamentos (nombre, color, icono)
VALUES ('Depto PRUEBA', '#111111', 'star') RETURNING id INTO v_dep;
INSERT INTO public.agenda_subdepartamentos (departamento_id, nombre, color, lider_id)
VALUES (v_dep, 'Sub PRUEBA', '#111111', caro) RETURNING id INTO v_sub;
INSERT INTO public.agenda_departamento_encargados (departamento_id, user_id) VALUES (v_dep, beto);

-- Una venta del Punto, para el pedido listo.
INSERT INTO public.ventas_voluntarios (id, codigo, user_id, total, unidades, comprobante_path)
VALUES (v_venta, 'VOL-PR2B', caro, 0, 1, 'prueba/comprobante.png');


-- ══════════════════════════════════════════════════════════════════════════
-- T · LOS TEXTOS: idénticos a los de hoy
-- ══════════════════════════════════════════════════════════════════════════

-- ── T1 · notify-host: nueva solicitud de ingreso ──────────────────────────
PERFORM pg_temp.limpiar(ana);
PERFORM public.notif_emitir('gcx_solicitud_ingreso', ana,
    jsonb_build_object('nombre', 'Caro PRUEBA', 'grupo', 'Grupo PRUEBA'), '/');
PERFORM pg_temp.chk('T1', 'notify-host · nueva solicitud de ingreso',
    'Nueva solicitud de ingreso 👤 § Caro PRUEBA quiere unirse a "Grupo PRUEBA". Revisá las solicitudes pendientes. § info § / § gcx_solicitud_ingreso',
    pg_temp.firma(ana));

-- ── T2/T3 · el modal de inscripción (firma vieja y firma nueva) ───────────
v_url := '/panel-admin/groups?groupId=' || v_grupo;
v_esp := 'Nueva solicitud de miembro § Caro PRUEBA se unió a Grupo PRUEBA. § REGISTRATION § '
         || v_url || ' § gcx_solicitud_ingreso_app';

PERFORM pg_temp.sesion(caro);   -- quien se inscribe le avisa al anfitrión
PERFORM pg_temp.limpiar(ana);
PERFORM public.crear_aviso(ana, 'REGISTRATION', 'Nueva solicitud de miembro',
                           'Caro PRUEBA se unió a Grupo PRUEBA.', v_url);
PERFORM pg_temp.chk('T2', 'modal de inscripción · firma VIEJA de crear_aviso', v_esp, pg_temp.firma(ana));

PERFORM pg_temp.limpiar(ana);
PERFORM public.crear_aviso(ana, 'gcx_solicitud_ingreso_app',
    jsonb_build_object('nombre', 'Caro PRUEBA', 'grupo', 'Grupo PRUEBA'), v_url);
PERFORM pg_temp.chk('T3', 'modal de inscripción · firma NUEVA (clave + variables)', v_esp, pg_temp.firma(ana));

-- ── T4 · la inscripción de pareja ─────────────────────────────────────────
v_esp := 'Nueva solicitud de pareja § Caro PRUEBA y Dani PRUEBA se inscribieron como pareja en Grupo PRUEBA. § REGISTRATION § '
         || v_url || ' § gcx_solicitud_pareja_app';
PERFORM pg_temp.limpiar(ana);
PERFORM public.crear_aviso(ana, 'REGISTRATION', 'Nueva solicitud de pareja',
    'Caro PRUEBA y Dani PRUEBA se inscribieron como pareja en Grupo PRUEBA.', v_url);
PERFORM pg_temp.chk('T4a', 'inscripción de pareja · firma VIEJA', v_esp, pg_temp.firma(ana));

PERFORM pg_temp.limpiar(ana);
PERFORM public.crear_aviso(ana, 'gcx_solicitud_pareja_app',
    jsonb_build_object('nombre', 'Caro PRUEBA', 'pareja', 'Dani PRUEBA', 'grupo', 'Grupo PRUEBA'), v_url);
PERFORM pg_temp.chk('T4b', 'inscripción de pareja · firma NUEVA', v_esp, pg_temp.firma(ana));

-- ── T5 · asistencia guardada ──────────────────────────────────────────────
PERFORM pg_temp.sesion(ana);    -- el anfitrión se avisa a sí mismo
v_url := '/mis-grupos/' || v_grupo || '/asistencia?vista=historial';
v_esp := '✅ Asistencia registrada § Registraste 4 presente(s) en Grupo PRUEBA el 29-octubre. ¡Seguí así! § ATTENDANCE § '
         || v_url || ' § gcx_asistencia_guardada';

PERFORM pg_temp.limpiar(ana);
PERFORM public.crear_aviso(ana, 'ATTENDANCE', '✅ Asistencia registrada',
    'Registraste 4 presente(s) en Grupo PRUEBA el 29-octubre. ¡Seguí así!', v_url);
PERFORM pg_temp.chk('T5a', 'asistencia guardada · firma VIEJA', v_esp, pg_temp.firma(ana));

PERFORM pg_temp.limpiar(ana);
PERFORM public.crear_aviso(ana, 'gcx_asistencia_guardada',
    jsonb_build_object('presentes', 4, 'grupo', 'Grupo PRUEBA', 'fecha', '29-octubre'), v_url);
PERFORM pg_temp.chk('T5b', 'asistencia guardada · firma NUEVA', v_esp, pg_temp.firma(ana));

-- ── T6 · notify-host: grupo aprobado ──────────────────────────────────────
PERFORM pg_temp.limpiar(ana);
PERFORM public.notif_emitir('gcx_grupo_aprobado', ana, jsonb_build_object('grupo', 'Grupo PRUEBA'), '/');
PERFORM pg_temp.chk('T6', 'notify-host · grupo aprobado',
    '¡Tu grupo fue aprobado! 🎉 § El grupo "Grupo PRUEBA" fue aprobado y ya está visible en la app. § success § / § gcx_grupo_aprobado',
    pg_temp.firma(ana));

-- ── T7 · Gestión de grupos: aprobado ──────────────────────────────────────
PERFORM pg_temp.sesion(eva);    -- la gestora aprueba
v_esp := '¡Tu grupo fue aprobado! 🎉 § Tu grupo "Grupo PRUEBA" ha sido aprobado. Recuerda registrar asistencia cada Jueves. § GROUP_APPROVED § /mis-grupos § gcx_grupo_aprobado_app';

PERFORM pg_temp.limpiar(ana);
PERFORM public.crear_aviso(ana, 'GROUP_APPROVED', '¡Tu grupo fue aprobado! 🎉',
    'Tu grupo "Grupo PRUEBA" ha sido aprobado. Recuerda registrar asistencia cada Jueves.', '/mis-grupos');
PERFORM pg_temp.chk('T7a', 'grupo aprobado desde la pantalla · firma VIEJA', v_esp, pg_temp.firma(ana));

PERFORM pg_temp.limpiar(ana);
PERFORM public.crear_aviso(ana, 'gcx_grupo_aprobado_app',
    jsonb_build_object('grupo', 'Grupo PRUEBA', 'dia', 'Jueves'), '/mis-grupos');
PERFORM pg_temp.chk('T7b', 'grupo aprobado desde la pantalla · firma NUEVA', v_esp, pg_temp.firma(ana));

-- ── T8 · Gestión de grupos: rechazado, con y sin nota ─────────────────────
v_esp := 'Actualización sobre tu grupo § Tu grupo "Grupo PRUEBA" no ha podido ser aprobado en este momento. Motivo: faltan el día y el horario. § GROUP_REJECTED § /mis-grupos § gcx_grupo_rechazado_app';

PERFORM pg_temp.limpiar(ana);
PERFORM public.crear_aviso(ana, 'GROUP_REJECTED', 'Actualización sobre tu grupo',
    'Tu grupo "Grupo PRUEBA" no ha podido ser aprobado en este momento. Motivo: faltan el día y el horario.', '/mis-grupos');
PERFORM pg_temp.chk('T8a', 'grupo rechazado con nota · firma VIEJA', v_esp, pg_temp.firma(ana));

PERFORM pg_temp.limpiar(ana);
PERFORM public.crear_aviso(ana, 'gcx_grupo_rechazado_app',
    jsonb_build_object('grupo', 'Grupo PRUEBA', 'motivo', ' Motivo: faltan el día y el horario.'), '/mis-grupos');
PERFORM pg_temp.chk('T8b', 'grupo rechazado con nota · firma NUEVA', v_esp, pg_temp.firma(ana));

PERFORM pg_temp.limpiar(ana);
PERFORM public.crear_aviso(ana, 'gcx_grupo_rechazado_app',
    jsonb_build_object('grupo', 'Grupo PRUEBA', 'motivo', ''), '/mis-grupos');
PERFORM pg_temp.chk('T8c', 'grupo rechazado SIN nota · la variable vacía no deja huecos',
    'Actualización sobre tu grupo § Tu grupo "Grupo PRUEBA" no ha podido ser aprobado en este momento. § GROUP_REJECTED § /mis-grupos § gcx_grupo_rechazado_app',
    pg_temp.firma(ana));

-- ── T9/T10 · inscripción aprobada y rechazada ─────────────────────────────
PERFORM pg_temp.sesion(ana);    -- la anfitriona resuelve
v_esp := 'Solicitud Aprobada § Tu solicitud para unirte a Grupo PRUEBA ha sido aprobada. § REGISTRATION_APPROVED § / § gcx_inscripcion_aprobada';

PERFORM pg_temp.limpiar(caro);
PERFORM public.crear_aviso(caro, 'REGISTRATION_APPROVED', 'Solicitud Aprobada',
    'Tu solicitud para unirte a Grupo PRUEBA ha sido aprobada.', '/');
PERFORM pg_temp.chk('T9a', 'inscripción aprobada · firma VIEJA', v_esp, pg_temp.firma(caro));

PERFORM pg_temp.limpiar(caro);
PERFORM public.crear_aviso(caro, 'gcx_inscripcion_aprobada', jsonb_build_object('grupo', 'Grupo PRUEBA'), '/');
PERFORM pg_temp.chk('T9b', 'inscripción aprobada · firma NUEVA', v_esp, pg_temp.firma(caro));

PERFORM pg_temp.limpiar(dani);
PERFORM public.crear_aviso(dani, 'gcx_inscripcion_rechazada', jsonb_build_object('grupo', 'Grupo PRUEBA'), '/');
PERFORM pg_temp.chk('T10', 'inscripción rechazada · le llega también a la pareja',
    'Solicitud Rechazada § Tu solicitud para unirte a Grupo PRUEBA no ha podido ser aceptada en este momento. § REGISTRATION_REJECTED § / § gcx_inscripcion_rechazada',
    pg_temp.firma(dani));

-- ── T11 · recordatorio de asistencia (el trigger de verdad) ───────────────
PERFORM pg_temp.limpiar(ana);
IF v_hora >= 4 THEN
    v_n := public.check_attendance_reminders();
    PERFORM pg_temp.chk('T11', 'recordatorio de asistencia · check_attendance_reminders()',
        'Recordatorio: Pasá asistencia 📋 § La reunión de "Grupo PRUEBA" terminó hace más de 3 horas. Registrá la asistencia. § attendance_reminder § /groups/host?group='
        || v_grupo || ' § gcx_recordatorio_asistencia',
        pg_temp.firma(ana));
    -- Y no repite: la segunda corrida no crea nada (la marca es la ruta).
    PERFORM pg_temp.chk('T11b', 'recordatorio de asistencia · no repite en el día', '0',
        public.check_attendance_reminders()::text);
ELSE
    PERFORM pg_temp.chk('T11', 'recordatorio de asistencia', 'omitido',
        'omitido: son las ' || v_hora || ' h en Argentina y la reunión tendría que haber sido hace 3 h');
END IF;

-- ── T12/T13 · Agenda: tarea asignada y completada (triggers de verdad) ────
PERFORM pg_temp.sesion(NULL);
PERFORM pg_temp.limpiar(caro);
INSERT INTO public.agenda_tareas (departamento_id, subdepartamento_id, nombre, fecha,
                                  todo_el_dia, hora_desde, hora_hasta, estado, asignada_at)
VALUES (v_dep, v_sub, 'Tarea PRUEBA', DATE '2026-11-05', false, '20:00', '21:30', 'esperando', now())
RETURNING id INTO v_tarea;
PERFORM pg_temp.chk('T12', 'Agenda · tarea asignada (trigger)',
    'Nueva tarea: Tarea PRUEBA § Sub PRUEBA · jue 05/11 · 20:00 – 21:30 § AGENDA_TAREA_ASIGNADA § /agenda?tarea='
    || v_tarea || ' § agenda_tarea_asignada',
    pg_temp.firma(caro));

PERFORM pg_temp.limpiar(beto);
UPDATE public.agenda_tareas SET estado = 'completada', completada_por = caro, completada_at = now()
 WHERE id = v_tarea;
PERFORM pg_temp.chk('T13', 'Agenda · tarea completada (trigger)',
    'Tarea completada: Tarea PRUEBA § Sub PRUEBA · por Caro PRUEBA § AGENDA_TAREA_COMPLETADA § /agenda?tarea='
    || v_tarea || ' § agenda_tarea_completada',
    pg_temp.firma(beto));

-- ── T14/T15/T16 · Agenda: solicitudes (triggers de verdad) ────────────────
PERFORM pg_temp.limpiar(beto);
INSERT INTO public.agenda_solicitudes (departamento_id, solicitante_id, detalles)
VALUES (v_dep, caro, 'Necesitamos un flyer para el anuncio del domingo')
RETURNING id INTO v_sol;
PERFORM pg_temp.chk('T14', 'Agenda · solicitud nueva (trigger)',
    'Solicitud nueva para Depto PRUEBA § Caro PRUEBA · Necesitamos un flyer para el anuncio del domingo § AGENDA_SOLICITUD_NUEVA § /departamentos/'
    || v_dep || '?tab=solicitudes § agenda_solicitud_nueva',
    pg_temp.firma(beto));

PERFORM pg_temp.limpiar(caro);
UPDATE public.agenda_solicitudes SET estado = 'aceptada', revisada_por = beto, revisada_at = now()
 WHERE id = v_sol;
PERFORM pg_temp.chk('T15', 'Agenda · solicitud aceptada (trigger)',
    'Tu solicitud a Depto PRUEBA fue aceptada § El equipo ya la tiene en cuenta para organizarla. ¡Gracias por escribir! § AGENDA_SOLICITUD_REVISADA § /perfil/solicitudes § agenda_solicitud_aceptada',
    pg_temp.firma(caro));

INSERT INTO public.agenda_solicitudes (departamento_id, solicitante_id, detalles)
VALUES (v_dep, caro, 'Otra cosa para el domingo que viene') RETURNING id INTO v_sol2;
PERFORM pg_temp.limpiar(caro);
UPDATE public.agenda_solicitudes SET estado = 'rechazada', revisada_por = beto, revisada_at = now()
 WHERE id = v_sol2;
PERFORM pg_temp.chk('T16', 'Agenda · solicitud rechazada (trigger)',
    'Tu solicitud a Depto PRUEBA no fue aceptada § Esta vez no la pueden tomar. Gracias por escribirles. § AGENDA_SOLICITUD_REVISADA § /perfil/solicitudes § agenda_solicitud_rechazada',
    pg_temp.firma(caro));

-- ── T17 · Sistemas: reporte de problema (trigger de verdad) ───────────────
PERFORM pg_temp.limpiar(eva);
INSERT INTO public.reportes_problemas (user_id, descripcion, pantalla)
VALUES (caro, 'No carga la lista de inscriptos', 'Eventos')
RETURNING numero INTO v_rep;
PERFORM pg_temp.chk('T17', 'Sistemas · reporte de problema (trigger)',
    'Nuevo reporte ' || public.codigo_reporte(v_rep)
    || ' § Eventos · No carga la lista de inscriptos § REPORTE_PROBLEMA § /panel-admin/reportes?id='
    || (SELECT id FROM public.reportes_problemas WHERE numero = v_rep) || ' § sistemas_reporte_problema',
    pg_temp.firma(eva));

-- ── T18 · Sistemas: pedido de datos personales (trigger de verdad) ────────
PERFORM pg_temp.limpiar(eva);
INSERT INTO public.solicitudes_datos (user_id, tipo, mensaje)
VALUES (caro, 'acceso', 'Quiero ver qué datos tienen míos') RETURNING numero INTO v_num;
PERFORM pg_temp.chk('T18', 'Sistemas · pedido de datos personales (trigger)',
    'Nueva solicitud de datos N.º ' || lpad(v_num::text, 4, '0')
    || ' § Acceso a mis datos § SOLICITUD_DATOS § /panel-admin/solicitudes-datos § sistemas_solicitud_datos',
    pg_temp.firma(eva));

-- ── T19 · Punto: pedido listo (marcar_venta de verdad) ────────────────────
PERFORM pg_temp.sesion(eva);
PERFORM pg_temp.limpiar(caro);
v_j := public.marcar_venta(v_venta, 'lista');
PERFORM pg_temp.chk('T19', 'Punto · pedido listo (marcar_venta)',
    'Tu pedido VOL-PR2B está listo § Retiralo en el Punto de Información. § PEDIDO_LISTO § /perfil/compras/'
    || v_venta || ' § punto_pedido_listo',
    pg_temp.firma(caro));

-- ── T20 · la notificación de prueba del dispositivo ───────────────────────
PERFORM pg_temp.limpiar(eva);
v_j := public.push_enviar_prueba();
PERFORM pg_temp.chk('T20', 'Mi cuenta · notificación de prueba (push_enviar_prueba)',
    'Notificación de prueba § Si ves esto, las notificaciones de Origen llegan a este dispositivo. § PUSH_PRUEBA § /notificaciones § push_prueba',
    pg_temp.firma(eva));

-- ── T21 · el push de "hay una versión nueva" ──────────────────────────────
PERFORM pg_temp.sesion(NULL);
PERFORM pg_temp.limpiar(eva);
v_n := public.avisar_actualizacion();
PERFORM pg_temp.chk('T21', 'Deploy · hay una versión nueva (avisar_actualizacion)',
    'Hay una versión nueva § Tocá acá y fijate si ya la tenés. § info § /perfil/app § app_version_nueva',
    pg_temp.firma(eva));
PERFORM pg_temp.chk('T21b', 'Deploy · le crea el aviso a todos los que tienen la app', 'al menos 1',
    CASE WHEN v_n >= 1 THEN 'al menos 1' ELSE v_n::text END);


-- ══════════════════════════════════════════════════════════════════════════
-- D · LAS DECISIONES DE ENVÍO
-- ══════════════════════════════════════════════════════════════════════════

-- ── D1 · el horario de no molestar, a cualquier hora del reloj ────────────
-- notif_no_molestar_hasta toma el instante por parámetro, así que se puede
-- probar a las 23:30 y a las 02:00 sin esperar a esa hora.
v_t := (public.notif_no_molestar_hasta((v_hoy || ' 23:30')::timestamp AT TIME ZONE ZONA, '23:00', '08:00')
        AT TIME ZONE ZONA)::text;
PERFORM pg_temp.chk('D1', 'no molestar 23:00–08:00 · a las 23:30 se difiere a las 08:00 de mañana',
    ((v_hoy + 1) || ' 08:00:00')::text, v_t);

v_t := (public.notif_no_molestar_hasta((v_hoy || ' 02:00')::timestamp AT TIME ZONE ZONA, '23:00', '08:00')
        AT TIME ZONE ZONA)::text;
PERFORM pg_temp.chk('D2', 'no molestar 23:00–08:00 · a las 02:00 se difiere a las 08:00 de hoy',
    (v_hoy || ' 08:00:00')::text, v_t);

PERFORM pg_temp.chk('D3', 'no molestar 23:00–08:00 · a las 12:00 no frena nada', '(nada)',
    COALESCE(public.notif_no_molestar_hasta((v_hoy || ' 12:00')::timestamp AT TIME ZONE ZONA, '23:00', '08:00')::text, '(nada)'));

PERFORM pg_temp.chk('D4', 'no molestar 23:00–08:00 · las 23:00 en punto ya están adentro',
    ((v_hoy + 1) || ' 08:00:00')::text,
    (public.notif_no_molestar_hasta((v_hoy || ' 23:00')::timestamp AT TIME ZONE ZONA, '23:00', '08:00') AT TIME ZONE ZONA)::text);

PERFORM pg_temp.chk('D5', 'no molestar 23:00–08:00 · las 08:00 en punto ya están afuera', '(nada)',
    COALESCE(public.notif_no_molestar_hasta((v_hoy || ' 08:00')::timestamp AT TIME ZONE ZONA, '23:00', '08:00')::text, '(nada)'));

PERFORM pg_temp.chk('D6', 'no molestar 09:00–17:00 (sin cruzar la medianoche) · a las 10:00 espera hasta las 17:00',
    (v_hoy || ' 17:00:00')::text,
    (public.notif_no_molestar_hasta((v_hoy || ' 10:00')::timestamp AT TIME ZONE ZONA, '09:00', '17:00') AT TIME ZONE ZONA)::text);

PERFORM pg_temp.chk('D7', 'no molestar 09:00–17:00 · a las 18:00 no frena nada', '(nada)',
    COALESCE(public.notif_no_molestar_hasta((v_hoy || ' 18:00')::timestamp AT TIME ZONE ZONA, '09:00', '17:00')::text, '(nada)'));

PERFORM pg_temp.chk('D8', 'no molestar con desde = hasta · no frena nada', '(nada)',
    COALESCE(public.notif_no_molestar_hasta(now(), '08:00', '08:00')::text, '(nada)'));

-- ── D9 · activa, pausada, diferir, tope ───────────────────────────────────
PERFORM pg_temp.limpiar(caro);
v_av := public.notif_emitir('gcx_inscripcion_aprobada', caro, jsonb_build_object('grupo', 'Grupo PRUEBA'));
PERFORM pg_temp.chk('D9', 'alerta activa · se manda', 'enviar', pg_temp.decision(v_av));

UPDATE public.notif_alertas SET activa = false WHERE clave = 'gcx_inscripcion_aprobada';
PERFORM pg_temp.chk('D10', 'alerta pausada · no sale push (el aviso ya está en la campanita)',
    'pausada', pg_temp.decision(v_av));
PERFORM pg_temp.chk('D10b', 'alerta pausada · el aviso igual se creó', '1',
    (SELECT count(*)::text FROM public.app_notifications WHERE id = v_av));
UPDATE public.notif_alertas SET activa = true WHERE clave = 'gcx_inscripcion_aprobada';

-- Un horario de no molestar que contiene a AHORA, sea la hora que sea.
UPDATE public.notif_alertas
   SET no_molestar = true,
       no_molestar_desde = ((now() AT TIME ZONE ZONA) - interval '1 hour')::time,
       no_molestar_hasta = ((now() AT TIME ZONE ZONA) + interval '1 hour')::time
 WHERE clave = 'gcx_inscripcion_aprobada';
v_j := public.notif_puede_enviar(v_av);
PERFORM pg_temp.chk('D11', 'dentro del horario de no molestar · se difiere', 'diferir', v_j->>'decision');
PERFORM pg_temp.chk('D11b', 'el diferido sale cuando termina el horario, dentro de las próximas 24 h', 'sí',
    CASE WHEN (v_j->>'enviar_en')::timestamptz > now()
          AND (v_j->>'enviar_en')::timestamptz <= now() + interval '24 hours'
          AND ((v_j->>'enviar_en')::timestamptz AT TIME ZONE ZONA)::time
              = (SELECT no_molestar_hasta FROM public.notif_alertas WHERE clave = 'gcx_inscripcion_aprobada')
         THEN 'sí' ELSE 'no: ' || (v_j->>'enviar_en') END);

-- Un horario que NO contiene a ahora (arranca en una hora).
UPDATE public.notif_alertas
   SET no_molestar_desde = ((now() AT TIME ZONE ZONA) + interval '1 hour')::time,
       no_molestar_hasta = ((now() AT TIME ZONE ZONA) + interval '2 hours')::time
 WHERE clave = 'gcx_inscripcion_aprobada';
PERFORM pg_temp.chk('D12', 'fuera del horario de no molestar · se manda', 'enviar', pg_temp.decision(v_av));
UPDATE public.notif_alertas SET no_molestar = false, no_molestar_desde = NULL, no_molestar_hasta = NULL
 WHERE clave = 'gcx_inscripcion_aprobada';

-- ── D13 · el tope por día ─────────────────────────────────────────────────
UPDATE public.notif_alertas SET max_por_dia = 2 WHERE clave = 'gcx_inscripcion_aprobada';
INSERT INTO public.notif_push_log (notificacion_id, alerta_clave, user_id, resultado)
VALUES (v_av, 'gcx_inscripcion_aprobada', caro, 'enviado');
PERFORM pg_temp.chk('D13', 'tope 2 con 1 push mandado hoy · todavía se manda', 'enviar', pg_temp.decision(v_av));

INSERT INTO public.notif_push_log (notificacion_id, alerta_clave, user_id, resultado)
VALUES (v_av, 'gcx_inscripcion_aprobada', caro, 'enviado');
PERFORM pg_temp.chk('D14', 'tope 2 con 2 push mandados hoy · no sale', 'tope', pg_temp.decision(v_av));

-- Lo que no salió no gasta el tope.
DELETE FROM public.notif_push_log WHERE user_id = caro;
INSERT INTO public.notif_push_log (notificacion_id, alerta_clave, user_id, resultado) VALUES
    (v_av, 'gcx_inscripcion_aprobada', caro, 'pausada'),
    (v_av, 'gcx_inscripcion_aprobada', caro, 'diferido'),
    (v_av, 'gcx_inscripcion_aprobada', caro, 'fallo');
PERFORM pg_temp.chk('D15', 'el tope cuenta sólo lo que salió de verdad', 'enviar', pg_temp.decision(v_av));

-- El tope es por persona y por alerta.
DELETE FROM public.notif_push_log WHERE user_id IN (caro, dani);
INSERT INTO public.notif_push_log (notificacion_id, alerta_clave, user_id, resultado) VALUES
    (v_av, 'gcx_inscripcion_aprobada', dani, 'enviado'),
    (v_av, 'gcx_inscripcion_aprobada', dani, 'enviado'),
    (v_av, 'gcx_asistencia_guardada',  caro, 'enviado'),
    (v_av, 'gcx_asistencia_guardada',  caro, 'enviado');
PERFORM pg_temp.chk('D16', 'el tope es por persona y por alerta', 'enviar', pg_temp.decision(v_av));

-- Y los de ayer no cuentan.
DELETE FROM public.notif_push_log WHERE user_id = caro;
INSERT INTO public.notif_push_log (notificacion_id, alerta_clave, user_id, resultado, enviado_at) VALUES
    (v_av, 'gcx_inscripcion_aprobada', caro, 'enviado', now() - interval '1 day'),
    (v_av, 'gcx_inscripcion_aprobada', caro, 'enviado', now() - interval '1 day');
PERFORM pg_temp.chk('D17', 'el tope se reinicia cada día', 'enviar', pg_temp.decision(v_av));
UPDATE public.notif_alertas SET max_por_dia = NULL WHERE clave = 'gcx_inscripcion_aprobada';
DELETE FROM public.notif_push_log WHERE user_id IN (caro, dani);

-- ── D18 · un aviso sin clave se manda siempre ─────────────────────────────
INSERT INTO public.app_notifications (user_id, title, message, type)
VALUES (caro, 'Aviso viejo PRUEBA', 'De antes del catálogo', 'info') RETURNING id INTO v_av;
PERFORM pg_temp.chk('D18', 'aviso sin alerta_clave (de antes, o una prueba) · se manda', 'enviar',
    pg_temp.decision(v_av));

-- ── D19 · los diferidos ───────────────────────────────────────────────────
INSERT INTO public.notif_push_diferidos (notificacion_id, enviar_en) VALUES
    (v_av, now() - interval '1 minute'),
    (gen_random_uuid(), now() + interval '3 hours');
v_j := public.notif_diferidos_tomar();
PERFORM pg_temp.chk('D19', 'notif_diferidos_tomar · se lleva el vencido y deja el que falta', '1 y 1',
    jsonb_array_length(v_j->'ids') || ' y ' || (SELECT count(*) FROM public.notif_push_diferidos));
PERFORM pg_temp.chk('D19b', 'notif_diferidos_tomar · dos corridas no lo mandan dos veces', '0',
    jsonb_array_length(public.notif_diferidos_tomar()->'ids')::text);
DELETE FROM public.notif_push_diferidos;


-- ══════════════════════════════════════════════════════════════════════════
-- P · PERMISOS
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.chk('P1', 'notif_emitir no es ejecutable por anon ni authenticated', 'no, no',
    CASE WHEN has_function_privilege('anon', 'public.notif_emitir(text, uuid, jsonb, text, uuid)', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ', ' ||
    CASE WHEN has_function_privilege('authenticated', 'public.notif_emitir(text, uuid, jsonb, text, uuid)', 'EXECUTE') THEN 'sí' ELSE 'no' END);

PERFORM pg_temp.chk('P2', 'notif_emitir_texto tampoco', 'no, no',
    CASE WHEN has_function_privilege('anon', 'public.notif_emitir_texto(text, uuid, text, text, text, uuid)', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ', ' ||
    CASE WHEN has_function_privilege('authenticated', 'public.notif_emitir_texto(text, uuid, text, text, text, uuid)', 'EXECUTE') THEN 'sí' ELSE 'no' END);

PERFORM pg_temp.chk('P3', 'notif_puede_enviar y notif_diferidos_tomar: sólo la clave de servicio', 'no, no, sí, sí',
    CASE WHEN has_function_privilege('authenticated', 'public.notif_puede_enviar(uuid)', 'EXECUTE') THEN 'sí' ELSE 'no' END || ', ' ||
    CASE WHEN has_function_privilege('authenticated', 'public.notif_diferidos_tomar(integer)', 'EXECUTE') THEN 'sí' ELSE 'no' END || ', ' ||
    CASE WHEN has_function_privilege('service_role', 'public.notif_puede_enviar(uuid)', 'EXECUTE') THEN 'sí' ELSE 'no' END || ', ' ||
    CASE WHEN has_function_privilege('service_role', 'public.notif_diferidos_tomar(integer)', 'EXECUTE') THEN 'sí' ELSE 'no' END);

PERFORM pg_temp.chk('P4', 'las tablas nuevas: ni anon ni authenticated las leen', 'nadie',
    COALESCE((SELECT string_agg(DISTINCT grantee || ' ' || privilege_type, ', ')
                FROM information_schema.role_table_grants
               WHERE table_schema = 'public'
                 AND table_name IN ('notif_alertas', 'notif_push_log', 'notif_push_diferidos')
                 AND grantee IN ('anon', 'authenticated', 'PUBLIC')), 'nadie'));

PERFORM pg_temp.chk('P5', 'las dos firmas de crear_aviso siguen siendo de authenticated', 'sí, sí',
    CASE WHEN has_function_privilege('authenticated', 'public.crear_aviso(uuid, text, text, text, text)', 'EXECUTE') THEN 'sí' ELSE 'no' END
    || ', ' ||
    CASE WHEN has_function_privilege('authenticated', 'public.crear_aviso(uuid, text, jsonb, text)', 'EXECUTE') THEN 'sí' ELSE 'no' END);

-- Una variable que no es de esa alerta se rechaza.
PERFORM pg_temp.sesion(ana);
PERFORM pg_temp.chk('P6', 'crear_aviso con una variable que no es de la alerta · rechazada',
    'variable_invalida',
    public.crear_aviso(caro, 'gcx_inscripcion_aprobada',
        jsonb_build_object('grupo', 'Grupo PRUEBA', 'telefono', '11-5555-5555'))->>'motivo');

PERFORM pg_temp.chk('P7', 'crear_aviso con una clave que no existe · rechazada', 'alerta_invalida',
    public.crear_aviso(caro, 'no_existe_esta_alerta', '{}'::jsonb)->>'motivo');

PERFORM pg_temp.chk('P8', 'crear_aviso con una ruta externa · rechazada', 'url_invalida',
    public.crear_aviso(caro, 'gcx_inscripcion_aprobada', jsonb_build_object('grupo', 'G'),
                       'https://otro.sitio/robar')->>'motivo');

-- La relación sigue valiendo: Caro no le puede avisar a Dani "grupo aprobado".
PERFORM pg_temp.sesion(caro);
PERFORM pg_temp.chk('P9', 'la firma nueva respeta las mismas reglas de relación', 'sin_permiso',
    public.crear_aviso(dani, 'gcx_grupo_aprobado_app', jsonb_build_object('grupo', 'G', 'dia', 'Jueves'))->>'motivo');

PERFORM pg_temp.sesion(NULL);
PERFORM pg_temp.chk('P10', 'sin sesión no se puede crear un aviso', 'sin_sesion, sin_sesion',
    (public.crear_aviso(ana, 'gcx_solicitud_ingreso_app', jsonb_build_object('nombre', 'X', 'grupo', 'G'))->>'motivo')
    || ', ' ||
    (public.crear_aviso(ana, 'REGISTRATION', 'T', 'M')->>'motivo'));

-- Las RPC de la pantalla: sólo SUPER_ADMIN.
PERFORM pg_temp.sesion(caro);
PERFORM pg_temp.chk('P11', 'las RPC de la pantalla, con alguien sin rol', 'sin_permiso ×3',
    (SELECT CASE WHEN count(*) = 3 THEN 'sin_permiso ×3' ELSE string_agg(m, ', ') END
       FROM (VALUES
          (public.notif_alertas_admin()->>'motivo'),
          (public.notif_guardar_automatica((SELECT id FROM public.notif_alertas WHERE clave = 'push_prueba'),
                                           'T', 'M', true, false)->>'motivo'),
          (public.notif_enviar_prueba((SELECT id FROM public.notif_alertas WHERE clave = 'push_prueba'))->>'motivo')
       ) t(m) WHERE m = 'sin_permiso'));

PERFORM pg_temp.sesion(eva);
PERFORM pg_temp.chk('P12', 'notif_alertas_admin con SUPER_ADMIN · trae el catálogo', 'true 20',
    (public.notif_alertas_admin()->>'ok') || ' ' || jsonb_array_length(public.notif_alertas_admin()->'alertas'));

PERFORM pg_temp.chk('P13', 'notif_guardar_automatica con una variable que no es de la alerta · rechazada',
    'variable_invalida',
    public.notif_guardar_automatica((SELECT id FROM public.notif_alertas WHERE clave = 'gcx_inscripcion_aprobada'),
        'Solicitud Aprobada', 'Tu solicitud a {grupo} ({telefono}) fue aprobada.', true, false)->>'motivo');

PERFORM pg_temp.chk('P14', 'notif_guardar_automatica con no molestar sin horas · rechazada', 'horario_invalido',
    public.notif_guardar_automatica((SELECT id FROM public.notif_alertas WHERE clave = 'gcx_inscripcion_aprobada'),
        'Solicitud Aprobada', 'Tu solicitud para unirte a {grupo} ha sido aprobada.', true, true, NULL, NULL)->>'motivo');

PERFORM pg_temp.chk('P15', 'notif_guardar_automatica con un tope de 99 · rechazada', 'tope_invalido',
    public.notif_guardar_automatica((SELECT id FROM public.notif_alertas WHERE clave = 'gcx_inscripcion_aprobada'),
        'Solicitud Aprobada', 'Tu solicitud para unirte a {grupo} ha sido aprobada.', true, false, NULL, NULL, 99)->>'motivo');

-- Primero se guarda y DESPUÉS se lee: el orden en que Postgres evalúa los
-- dos lados de un || no está garantizado.
v_t := public.notif_guardar_automatica((SELECT id FROM public.notif_alertas WHERE clave = 'gcx_inscripcion_aprobada'),
        'Solicitud Aprobada', 'Tu solicitud para unirte a {grupo} ha sido aprobada.',
        false, true, '23:00', '08:00', 3)->>'ok';
PERFORM pg_temp.chk('P16', 'notif_guardar_automatica bien hecha · guarda', 'true, pausada y con tope 3',
    v_t || ', ' ||
    (SELECT CASE WHEN NOT activa AND no_molestar AND no_molestar_desde = '23:00' AND max_por_dia = 3
                 THEN 'pausada y con tope 3' ELSE 'no se guardó bien' END
       FROM public.notif_alertas WHERE clave = 'gcx_inscripcion_aprobada'));

-- La prueba va sólo a quien la pide, sin clave (para que no la frene su
-- propio horario de no molestar) y con el ícono de la alerta.
PERFORM pg_temp.limpiar(eva);
v_j := public.notif_enviar_prueba((SELECT id FROM public.notif_alertas WHERE clave = 'gcx_inscripcion_aprobada'));
PERFORM pg_temp.chk('P17', 'notif_enviar_prueba · se la manda sólo a quien la pide, con datos de ejemplo',
    'Solicitud Aprobada § Tu solicitud para unirte a GCX Palermo Martes ha sido aprobada. § REGISTRATION_APPROVED § / § (sin clave)',
    pg_temp.firma(eva));
PERFORM pg_temp.chk('P18', 'notif_enviar_prueba · queda anotada como prueba y no gasta el tope de nadie', '1, 0',
    (SELECT count(*) FROM public.notif_push_log WHERE user_id = eva AND resultado = 'prueba')::text
    || ', ' ||
    (SELECT count(*) FROM public.notif_push_log WHERE user_id = eva AND resultado = 'enviado')::text);
PERFORM pg_temp.chk('P19', 'notif_enviar_prueba · el aviso de prueba se manda igual (no tiene clave)',
    'enviar',
    pg_temp.decision((SELECT id FROM public.app_notifications WHERE user_id = eva LIMIT 1)));


-- ══════════════════════════════════════════════════════════════════════════
-- E · ESTADO DE LA SEMILLA
-- ══════════════════════════════════════════════════════════════════════════
PERFORM pg_temp.sesion(NULL);
PERFORM pg_temp.chk('E1', 'el catálogo tiene las 20 alertas automáticas', '20 automáticas, 0 programadas',
    (SELECT count(*) FILTER (WHERE tipo = 'automatica') || ' automáticas, '
            || count(*) FILTER (WHERE tipo = 'programada') || ' programadas'
       FROM public.notif_alertas));

-- Ojo: esto corre después de P16, que pausó gcx_inscripcion_aprobada a
-- propósito. Por eso se cuenta sobre las demás.
PERFORM pg_temp.chk('E2', 'la semilla no cambia nada: todas activas, sin no molestar y sin tope',
    'sí', (SELECT CASE WHEN count(*) = 0 THEN 'sí'
                       ELSE 'no: ' || string_agg(clave, ', ') END
             FROM public.notif_alertas
            WHERE clave <> 'gcx_inscripcion_aprobada'
              AND (NOT activa OR no_molestar OR max_por_dia IS NOT NULL)));

PERFORM pg_temp.chk('E3', 'todas las alertas apuntan a un type que la app sabe dibujar', 'sí',
    (SELECT CASE WHEN count(*) = 0 THEN 'sí' ELSE 'no: ' || string_agg(type_legacy, ', ') END
       FROM public.notif_alertas
      WHERE type_legacy NOT IN ('info', 'success', 'warning', 'ADMIN', 'REGISTRATION', 'ATTENDANCE',
            'REGISTRATION_APPROVED', 'REGISTRATION_REJECTED', 'GROUP_APPROVED', 'GROUP_REJECTED',
            'attendance_reminder', 'REPORTE_PROBLEMA', 'SOLICITUD_DATOS', 'PEDIDO_LISTO', 'PUSH_PRUEBA',
            'AGENDA_TAREA_ASIGNADA', 'AGENDA_TAREA_COMPLETADA', 'AGENDA_SOLICITUD_NUEVA', 'AGENDA_SOLICITUD_REVISADA')));

PERFORM pg_temp.chk('E4', 'todas las plantillas usan sólo sus propias variables', 'sí',
    (SELECT CASE WHEN count(*) = 0 THEN 'sí' ELSE 'no: ' || string_agg(clave || ' → ' || v, ', ') END
       FROM (SELECT a.clave, m[1] v FROM public.notif_alertas a,
                    regexp_matches(a.titulo_plantilla || ' ' || a.mensaje_plantilla || ' ' || COALESCE(a.url_plantilla, ''),
                                   '\{([a-z][a-z0-9_]{0,29})\}', 'g') m
              WHERE NOT (m[1] = ANY (COALESCE(a.variables, '{}')))) q));

PERFORM pg_temp.chk('E5', 'el cron de los diferidos está creado y activo', 'sí, cada 5 minutos',
    COALESCE((SELECT CASE WHEN active THEN 'sí, ' ELSE 'creado pero apagado, ' END
                     || CASE WHEN schedule = '*/5 * * * *' THEN 'cada 5 minutos' ELSE schedule END
                FROM cron.job WHERE jobname = 'notif-push-diferidos'), 'no está'));

PERFORM pg_temp.chk('E6', 'el trigger que manda los push sigue prendido', 'sí',
    COALESCE((SELECT CASE WHEN tgenabled = 'O' THEN 'sí' ELSE 'apagado (' || tgenabled::text || ')' END
                FROM pg_trigger WHERE tgname = 'trg_app_notifications_push' AND NOT tgisinternal), 'no está'));

PERFORM pg_temp.chk('E7', 'el cron no lleva la clave escrita adentro', 'la lee de Vault',
    COALESCE((SELECT CASE WHEN command LIKE '%vault.decrypted_secrets%' AND command NOT LIKE '%eyJ%'
                          THEN 'la lee de Vault' ELSE 'TIENE LA CLAVE ESCRITA' END
                FROM cron.job WHERE jobname = 'notif-push-diferidos'), 'no está'));


-- ══════════════════════════════════════════════════════════════════════════
-- El reporte
-- ══════════════════════════════════════════════════════════════════════════
SELECT count(*) INTO v_fallos FROM r WHERE esperado IS DISTINCT FROM obtenido;
SELECT string_agg(format('| %s | %s | %s | %s | %s |',
            n, caso, esperado,
            CASE WHEN esperado IS NOT DISTINCT FROM obtenido THEN 'igual' ELSE COALESCE(obtenido, '(nada)') END,
            CASE WHEN esperado IS NOT DISTINCT FROM obtenido THEN '✅' ELSE '❌' END),
       E'\n' ORDER BY orden)
  INTO v_salida FROM r;

RAISE EXCEPTION E'RESULTADO % %/%\n%',
    CASE WHEN v_fallos = 0 THEN '✅' ELSE '❌' END,
    (SELECT count(*) FROM r) - v_fallos, (SELECT count(*) FROM r), v_salida;
END;
$suite$;

ROLLBACK;
