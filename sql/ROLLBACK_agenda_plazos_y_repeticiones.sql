-- ════════════════════════════════════════════════════════════════════════════
-- DESHACER sql/agenda_plazos_y_repeticiones.sql
-- 2026-11-03
--
-- Deja la Agenda exactamente como estaba: las nueve funciones vuelven a su
-- definición de antes (copia literal de pg_get_functiondef en producción,
-- tomada el 2026-11-03 ANTES de aplicar), se van las piezas nuevas, el cron y
-- las dos tablas, y las tareas pierden plazo y serie.
--
-- SE PIERDEN DATOS si ya se usó: al sacar `fecha_hasta` toda tarea con plazo
-- pasa a ser de un día, y al borrar `agenda_series` las repeticiones quedan
-- como tareas sueltas (NO se borran: cada una es una tarea con su estado, y
-- varias pueden estar completadas). El bloque de abajo dice cuántas hay antes
-- de tocar nada.
-- ════════════════════════════════════════════════════════════════════════════

DO $aviso$
DECLARE
    v_plazos integer; v_series integer; v_rep integer;
BEGIN
    SELECT count(*) INTO v_plazos FROM public.agenda_tareas WHERE fecha_hasta IS NOT NULL;
    SELECT count(*) INTO v_series FROM public.agenda_series;
    SELECT count(*) INTO v_rep    FROM public.agenda_tareas WHERE serie_id IS NOT NULL;
    RAISE NOTICE 'Deshaciendo: % tareas con plazo pasan a ser de un dia; % series se borran y sus % repeticiones quedan sueltas.',
        v_plazos, v_series, v_rep;
END;
$aviso$;


-- ── 1 · El cron ─────────────────────────────────────────────────────────────
SELECT cron.unschedule('agenda-plazos-vencidos')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agenda-plazos-vencidos');


-- ── 2 · Las RPC que cambiaron de firma ──────────────────────────────────────
DROP FUNCTION IF EXISTS public.agenda_crear_tarea(uuid, uuid, uuid, uuid, uuid, text, text, date, boolean, time, time, uuid, date, text);
DROP FUNCTION IF EXISTS public.agenda_editar_tarea(uuid, uuid, uuid, uuid, text, text, date, boolean, time, time, date, text, text);
DROP FUNCTION IF EXISTS public.agenda_eliminar_tarea(uuid, text);
DROP FUNCTION IF EXISTS public.agenda_reasignar_tarea(uuid, uuid, text);


-- ── 3 · Las nueve funciones, como estaban ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.agenda_tarea_json(t agenda_tareas)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT jsonb_build_object(
        'id', t.id,
        'departamento', (SELECT jsonb_build_object('id', d.id, 'nombre', d.nombre, 'color', d.color, 'icono', d.icono)
                           FROM public.agenda_departamentos d WHERE d.id = t.departamento_id),
        'subdepartamento', (SELECT jsonb_build_object('id', s.id, 'nombre', s.nombre, 'color', s.color,
                                                      'archivado', s.archivado_at IS NOT NULL)
                              FROM public.agenda_subdepartamentos s WHERE s.id = t.subdepartamento_id),
        'carpeta', (SELECT jsonb_build_object('id', c.id, 'nombre', c.nombre, 'color', c.color)
                      FROM public.agenda_carpetas c WHERE c.id = t.carpeta_id),
        'prioridad', (SELECT jsonb_build_object('id', p.id, 'nombre', p.nombre, 'color', p.color, 'orden', p.orden)
                        FROM public.agenda_prioridades p WHERE p.id = t.prioridad_id),
        'nombre', t.nombre,
        'fecha', t.fecha,
        'todo_el_dia', t.todo_el_dia,
        'hora_desde', to_char(t.hora_desde, 'HH24:MI'),
        'hora_hasta', to_char(t.hora_hasta, 'HH24:MI'),
        'estado', t.estado,
        'asignada_at', t.asignada_at,
        'completada_at', t.completada_at,
        'created_at', t.created_at,
        'updated_at', t.updated_at,
        'creador', (SELECT jsonb_build_object('id', u.id, 'nombre', u.name)
                      FROM public.users u WHERE u.id = t.created_by),
        'solicitud', (SELECT jsonb_build_object(
                                'id', r.id, 'numero', r.numero, 'created_at', r.created_at,
                                'prioridad_nombre', r.prioridad_nombre,
                                'solicitante', public.agenda_persona(r.solicitante_id))
                        FROM public.agenda_solicitudes r WHERE r.id = t.solicitud_id)
    );
$function$;

CREATE OR REPLACE FUNCTION public.agenda_tareas_departamento(p_dep uuid, p_desde date, p_hasta date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF NOT public.agenda_es_encargado(p_dep) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;
    IF p_desde IS NULL OR p_hasta IS NULL OR p_hasta < p_desde THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'rango_invalido');
    END IF;
    IF p_hasta - p_desde > 400 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'rango_grande');
    END IF;

    RETURN jsonb_build_object('ok', true, 'tareas', COALESCE((
        SELECT jsonb_agg(public.agenda_tarea_json(t)
                         ORDER BY t.fecha, t.todo_el_dia DESC, t.hora_desde, t.created_at)
          FROM public.agenda_tareas t
         WHERE t.departamento_id = p_dep AND t.fecha BETWEEN p_desde AND p_hasta), '[]'::jsonb));
END;
$function$;

CREATE OR REPLACE FUNCTION public.agenda_tareas_subdepartamento(p_sub uuid, p_desde date, p_hasta date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_dep uuid;
    v_archivado timestamptz;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    SELECT departamento_id, archivado_at INTO v_dep, v_archivado FROM public.agenda_subdepartamentos WHERE id = p_sub;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF NOT (public.agenda_dirige(p_sub) OR public.agenda_es_encargado(v_dep)) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;
    IF v_archivado IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'archivado');
    END IF;
    IF p_desde IS NULL OR p_hasta IS NULL OR p_hasta < p_desde THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'rango_invalido');
    END IF;
    IF p_hasta - p_desde > 400 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'rango_grande');
    END IF;

    RETURN jsonb_build_object('ok', true, 'tareas', COALESCE((
        SELECT jsonb_agg(public.agenda_tarea_json(t)
                         ORDER BY t.fecha, t.todo_el_dia DESC, t.hora_desde, t.created_at)
          FROM public.agenda_tareas t
         WHERE t.subdepartamento_id = p_sub AND t.fecha BETWEEN p_desde AND p_hasta), '[]'::jsonb));
END;
$function$;

CREATE OR REPLACE FUNCTION public.agenda_mis_tareas(p_desde date, p_hasta date, p_todo_el_departamento boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_uid uuid := auth.uid();
    v_super boolean;
    v_todo boolean := COALESCE(p_todo_el_departamento, false);
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF p_desde IS NULL OR p_hasta IS NULL OR p_hasta < p_desde THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'rango_invalido');
    END IF;
    IF p_hasta - p_desde > 100 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'rango_grande');
    END IF;
    v_super := public.agenda_es_super_admin();

    RETURN jsonb_build_object('ok', true, 'tareas', COALESCE((
        SELECT jsonb_agg(public.agenda_tarea_json(t)
                         ORDER BY t.fecha, t.todo_el_dia DESC, t.hora_desde, t.created_at)
          FROM public.agenda_tareas t
         WHERE t.fecha BETWEEN p_desde AND p_hasta
           AND (
                -- Mis equipos: miembro o quien dirige.
                EXISTS (SELECT 1 FROM public.agenda_subdepartamentos s
                         WHERE s.id = t.subdepartamento_id
                           AND (s.lider_id = v_uid
                                OR EXISTS (SELECT 1 FROM public.agenda_subdepartamento_miembros m
                                            WHERE m.subdepartamento_id = s.id AND m.user_id = v_uid)))
                OR (v_todo AND (v_super
                                OR EXISTS (SELECT 1 FROM public.agenda_departamento_encargados e
                                            WHERE e.departamento_id = t.departamento_id
                                              AND e.user_id = v_uid)))
           )), '[]'::jsonb));
END;
$function$;

CREATE OR REPLACE FUNCTION public.agenda_crear_tarea(p_id uuid, p_dep uuid, p_sub uuid, p_carpeta uuid, p_prioridad uuid, p_nombre text, p_detalles text, p_fecha date, p_todo_el_dia boolean, p_desde time without time zone, p_hasta time without time zone, p_solicitud uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_uid uuid := auth.uid();
    v_todo boolean := COALESCE(p_todo_el_dia, true);
    v_motivo text;
    v_previa public.agenda_tareas;
    v_sol public.agenda_solicitudes;
    v_tarea public.agenda_tareas;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF p_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'id_requerido');
    END IF;

    -- El reintento: misma tarea, misma persona → la que ya había.
    SELECT * INTO v_previa FROM public.agenda_tareas WHERE id = p_id;
    IF FOUND THEN
        IF v_previa.created_by IS NOT DISTINCT FROM v_uid THEN
            RETURN jsonb_build_object('ok', true, 'id', v_previa.id, 'ya_existia', true,
                                      'tarea', public.agenda_tarea_json(v_previa));
        END IF;
        RETURN jsonb_build_object('ok', false, 'motivo', 'id_en_uso');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.agenda_departamentos WHERE id = p_dep) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF NOT public.agenda_es_encargado(p_dep) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    v_motivo := COALESCE(
        public.agenda_valida_campos_tarea(p_nombre, p_detalles, p_fecha, v_todo, p_desde, p_hasta),
        public.agenda_valida_del_departamento(p_dep, p_sub, p_carpeta, p_prioridad));
    IF v_motivo IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', v_motivo);
    END IF;

    IF p_solicitud IS NOT NULL THEN
        SELECT * INTO v_sol FROM public.agenda_solicitudes WHERE id = p_solicitud FOR UPDATE;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'motivo', 'solicitud_inexistente');
        END IF;
        IF v_sol.departamento_id <> p_dep THEN
            RETURN jsonb_build_object('ok', false, 'motivo', 'solicitud_ajena');
        END IF;
        IF v_sol.estado <> 'aceptada' THEN
            RETURN jsonb_build_object('ok', false, 'motivo', 'solicitud_no_aceptada', 'estado', v_sol.estado);
        END IF;
    END IF;

    INSERT INTO public.agenda_tareas (
        id, departamento_id, subdepartamento_id, carpeta_id, prioridad_id, solicitud_id,
        nombre, detalles, fecha, todo_el_dia, hora_desde, hora_hasta,
        estado, asignada_at, created_by)
    VALUES (
        p_id, p_dep, p_sub, p_carpeta, p_prioridad, p_solicitud,
        btrim(p_nombre), NULLIF(btrim(COALESCE(p_detalles, '')), ''), p_fecha, v_todo,
        CASE WHEN v_todo THEN NULL ELSE p_desde END,
        CASE WHEN v_todo THEN NULL ELSE p_hasta END,
        CASE WHEN p_sub IS NULL THEN 'esperando' ELSE 'en_proceso' END,
        CASE WHEN p_sub IS NULL THEN NULL ELSE now() END,
        v_uid)
    ON CONFLICT (id) DO NOTHING
    RETURNING * INTO v_tarea;

    IF v_tarea.id IS NULL THEN
        -- Otro envío con el mismo id ganó la carrera entre el SELECT y el INSERT.
        SELECT * INTO v_previa FROM public.agenda_tareas WHERE id = p_id;
        IF v_previa.created_by IS NOT DISTINCT FROM v_uid THEN
            RETURN jsonb_build_object('ok', true, 'id', v_previa.id, 'ya_existia', true,
                                      'tarea', public.agenda_tarea_json(v_previa));
        END IF;
        RETURN jsonb_build_object('ok', false, 'motivo', 'id_en_uso');
    END IF;

    IF p_solicitud IS NOT NULL THEN
        UPDATE public.agenda_solicitudes SET estado = 'asignada', tarea_id = v_tarea.id
         WHERE id = p_solicitud;
    END IF;

    RETURN jsonb_build_object('ok', true, 'id', v_tarea.id, 'ya_existia', false,
                              'tarea', public.agenda_tarea_json(v_tarea));
END;
$function$;

CREATE OR REPLACE FUNCTION public.agenda_editar_tarea(p_id uuid, p_sub uuid, p_carpeta uuid, p_prioridad uuid, p_nombre text, p_detalles text, p_fecha date, p_todo_el_dia boolean, p_desde time without time zone, p_hasta time without time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_todo boolean := COALESCE(p_todo_el_dia, true);
    v_motivo text;
    t public.agenda_tareas;
    v_cambia_sub boolean;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    SELECT * INTO t FROM public.agenda_tareas WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF NOT public.agenda_es_encargado(t.departamento_id) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    v_motivo := COALESCE(
        public.agenda_valida_campos_tarea(p_nombre, p_detalles, p_fecha, v_todo, p_desde, p_hasta),
        public.agenda_valida_del_departamento(t.departamento_id, p_sub, p_carpeta, p_prioridad, t.subdepartamento_id));
    IF v_motivo IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', v_motivo);
    END IF;

    v_cambia_sub := p_sub IS DISTINCT FROM t.subdepartamento_id;
    IF v_cambia_sub AND t.estado = 'completada' THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'completada');
    END IF;

    UPDATE public.agenda_tareas SET
        subdepartamento_id = p_sub,
        carpeta_id = p_carpeta,
        prioridad_id = p_prioridad,
        nombre = btrim(p_nombre),
        detalles = NULLIF(btrim(COALESCE(p_detalles, '')), ''),
        fecha = p_fecha,
        todo_el_dia = v_todo,
        hora_desde = CASE WHEN v_todo THEN NULL ELSE p_desde END,
        hora_hasta = CASE WHEN v_todo THEN NULL ELSE p_hasta END,
        estado = CASE WHEN p_sub IS NULL THEN 'esperando'
                      WHEN v_cambia_sub THEN 'en_proceso'
                      ELSE estado END,
        asignada_at = CASE WHEN p_sub IS NULL THEN NULL
                           WHEN v_cambia_sub THEN now()
                           ELSE asignada_at END,
        updated_at = now()
     WHERE id = p_id
    RETURNING * INTO t;

    RETURN jsonb_build_object('ok', true, 'id', t.id, 'tarea', public.agenda_tarea_json(t));
END;
$function$;

CREATE OR REPLACE FUNCTION public.agenda_eliminar_tarea(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    t public.agenda_tareas;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    SELECT * INTO t FROM public.agenda_tareas WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF NOT public.agenda_es_encargado(t.departamento_id) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    UPDATE public.agenda_solicitudes SET estado = 'aceptada', tarea_id = NULL
     WHERE tarea_id = p_id AND estado = 'asignada';
    DELETE FROM public.agenda_tareas WHERE id = p_id;

    RETURN jsonb_build_object('ok', true, 'id', p_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.agenda_reasignar_tarea(p_id uuid, p_sub_nuevo uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    t public.agenda_tareas;
    v_motivo text;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    SELECT * INTO t FROM public.agenda_tareas WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF NOT public.agenda_es_encargado(t.departamento_id) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;
    IF t.estado = 'completada' THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'completada');
    END IF;
    v_motivo := public.agenda_valida_del_departamento(t.departamento_id, p_sub_nuevo, NULL, NULL);
    IF v_motivo IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', v_motivo);
    END IF;
    IF p_sub_nuevo IS NOT DISTINCT FROM t.subdepartamento_id THEN
        RETURN jsonb_build_object('ok', true, 'id', t.id, 'sin_cambios', true,
                                  'tarea', public.agenda_tarea_json(t));
    END IF;

    UPDATE public.agenda_tareas SET
        subdepartamento_id = p_sub_nuevo,
        estado = CASE WHEN p_sub_nuevo IS NULL THEN 'esperando' ELSE 'en_proceso' END,
        asignada_at = CASE WHEN p_sub_nuevo IS NULL THEN NULL ELSE now() END,
        updated_at = now()
     WHERE id = p_id
    RETURNING * INTO t;

    RETURN jsonb_build_object('ok', true, 'id', t.id, 'tarea', public.agenda_tarea_json(t));
END;
$function$;

CREATE OR REPLACE FUNCTION public.agenda_tareas_avisar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
            NEW.id, 'asignada', v_users, 'agenda_tarea_asignada',
            jsonb_build_object(
                'tarea', NEW.nombre,
                'subdepartamento', COALESCE(v_sub_nombre, 'Tu equipo'),
                'fecha', v_fecha,
                'horario', v_horario));
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
            NEW.id, 'completada', v_users, 'agenda_tarea_completada',
            jsonb_build_object(
                'tarea', NEW.nombre,
                'subdepartamento', COALESCE(v_sub_nombre, 'Sin equipo'),
                'nombre', COALESCE(v_quien, 'alguien del equipo')));
    END IF;

    RETURN NULL;
END;
$function$;


-- ── 4 · Los permisos, como estaban ──────────────────────────────────────────
REVOKE ALL ON FUNCTION
    public.agenda_tarea_json(public.agenda_tareas)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION
    public.agenda_crear_tarea(uuid, uuid, uuid, uuid, uuid, text, text, date, boolean, time, time, uuid),
    public.agenda_editar_tarea(uuid, uuid, uuid, uuid, text, text, date, boolean, time, time),
    public.agenda_eliminar_tarea(uuid),
    public.agenda_reasignar_tarea(uuid, uuid),
    public.agenda_tareas_departamento(uuid, date, date),
    public.agenda_tareas_subdepartamento(uuid, date, date),
    public.agenda_mis_tareas(date, date, boolean)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
    public.agenda_crear_tarea(uuid, uuid, uuid, uuid, uuid, text, text, date, boolean, time, time, uuid),
    public.agenda_editar_tarea(uuid, uuid, uuid, uuid, text, text, date, boolean, time, time),
    public.agenda_eliminar_tarea(uuid),
    public.agenda_reasignar_tarea(uuid, uuid),
    public.agenda_tareas_departamento(uuid, date, date),
    public.agenda_tareas_subdepartamento(uuid, date, date),
    public.agenda_mis_tareas(date, date, boolean)
    TO authenticated;


-- ── 5 · Las piezas nuevas ───────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.agenda_plazos_vencidos_tick(timestamptz);
DROP FUNCTION IF EXISTS public.agenda_avisar_serie(uuid);
DROP FUNCTION IF EXISTS public.agenda_serie_json(public.agenda_series);
DROP FUNCTION IF EXISTS public.agenda_serie_renumerar(uuid);
DROP FUNCTION IF EXISTS public.agenda_serie_pendientes(uuid);
DROP FUNCTION IF EXISTS public.agenda_cuando_json(public.agenda_tareas);
DROP FUNCTION IF EXISTS public.agenda_repeticiones_posibles(date, date);
DROP FUNCTION IF EXISTS public.agenda_valida_plazo(date, date, text, boolean);
DROP FUNCTION IF EXISTS public.agenda_horario_texto(boolean, time, time);
DROP FUNCTION IF EXISTS public.agenda_fecha_dm(date);
DROP FUNCTION IF EXISTS public.agenda_frecuencia_texto(text);
DROP FUNCTION IF EXISTS public.agenda_serie_fechas(text, date, date);


-- ── 6 · Las columnas, los CHECKs y las tablas ───────────────────────────────
ALTER TABLE public.agenda_tareas DROP CONSTRAINT IF EXISTS agenda_tareas_plazo_ck;
ALTER TABLE public.agenda_tareas DROP CONSTRAINT IF EXISTS agenda_tareas_serie_ck;
ALTER TABLE public.agenda_tareas DROP CONSTRAINT IF EXISTS agenda_tareas_numero_serie_ck;
DROP INDEX IF EXISTS public.agenda_tareas_serie_numero_idx;
DROP INDEX IF EXISTS public.agenda_tareas_dep_plazo_idx;
DROP INDEX IF EXISTS public.agenda_tareas_sub_plazo_idx;

ALTER TABLE public.agenda_tareas
    DROP COLUMN IF EXISTS numero_en_serie,
    DROP COLUMN IF EXISTS serie_id,
    DROP COLUMN IF EXISTS fecha_hasta;

DROP TABLE IF EXISTS public.agenda_plazos_avisados;
DROP TABLE IF EXISTS public.agenda_series;


-- ── 7 · La alerta ───────────────────────────────────────────────────────────
-- Si ya avisó algo, NO se borra: los avisos de /notificaciones quedarían con
-- una clave que no existe. Se marca eliminada.
DO $rb$
DECLARE
    v_avisos integer;
BEGIN
    SELECT count(*) INTO v_avisos FROM public.app_notifications
     WHERE alerta_clave = 'agenda_plazo_vencido';
    IF v_avisos = 0 THEN
        DELETE FROM public.notif_alertas WHERE clave = 'agenda_plazo_vencido';
        RAISE NOTICE 'La alerta agenda_plazo_vencido se borro: nunca aviso nada.';
    ELSE
        UPDATE public.notif_alertas SET activa = false, eliminada_at = now()
         WHERE clave = 'agenda_plazo_vencido';
        RAISE NOTICE 'La alerta agenda_plazo_vencido quedo marcada eliminada: ya mando % avisos.', v_avisos;
    END IF;
END;
$rb$;


-- ── 8 · Cómo quedó ──────────────────────────────────────────────────────────
SELECT (SELECT count(*) FROM public.notif_alertas
         WHERE tipo = 'automatica' AND eliminada_at IS NULL)                  AS automaticas_activas,
       (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'agenda_tareas'
           AND column_name IN ('fecha_hasta', 'serie_id', 'numero_en_serie')) AS columnas_nuevas,
       (SELECT count(*) FROM pg_class WHERE relname IN ('agenda_series', 'agenda_plazos_avisados')) AS tablas_nuevas,
       (SELECT count(*) FROM cron.job WHERE jobname = 'agenda-plazos-vencidos') AS cron,
       (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname LIKE 'agenda_%'
           AND pg_get_functiondef(p.oid) ILIKE '%serie_en_lote%')             AS rastros;
