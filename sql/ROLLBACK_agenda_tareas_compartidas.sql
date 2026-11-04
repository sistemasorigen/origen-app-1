-- ═══════════════════════════════════════════════════════════════════════════
-- Vuelta atrás de sql/agenda_tareas_compartidas.sql
--
-- Deja la base como estaba: las mismas funciones, sin la tabla ni la columna.
-- Si ya hay tareas compartidas, FRENA: borrarlas sería perder datos, y antes de
-- volver atrás alguien tiene que decidir qué pasa con ellas.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

DO $$
DECLARE
    v_hay integer;
BEGIN
    SELECT count(*) INTO v_hay FROM public.agenda_tareas WHERE compartida;
    IF v_hay > 0 THEN
        RAISE EXCEPTION 'Hay % tareas compartidas: no se vuelve atrás sin decidir qué hacer con ellas.', v_hay;
    END IF;
END;
$$;

DROP TRIGGER trg_agenda_tarea_equipos_avisar ON public.agenda_tarea_equipos;

DROP FUNCTION public.agenda_tarea_json(public.agenda_tareas, uuid);
DROP FUNCTION public.agenda_crear_tarea(uuid, uuid, uuid, uuid, uuid, text, text, date, boolean, time, time, uuid, date, text, uuid[]);
DROP FUNCTION public.agenda_editar_tarea(uuid, uuid, uuid, uuid, text, text, date, boolean, time, time, date, text, text, uuid[]);
DROP FUNCTION public.agenda_cambiar_estado_tarea(uuid, text, uuid);

-- Las funciones como estaban
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
        'fecha_hasta', t.fecha_hasta,
        'todo_el_dia', t.todo_el_dia,
        'hora_desde', to_char(t.hora_desde, 'HH24:MI'),
        'hora_hasta', to_char(t.hora_hasta, 'HH24:MI'),
        'estado', t.estado,
        -- Días que faltan hasta el último día de la tarea. Negativo si ya pasó.
        'dias_restantes', COALESCE(t.fecha_hasta, t.fecha) - public.agenda_hoy(),
        'vencida', t.estado <> 'completada'
                   AND (t.fecha_hasta IS NOT NULL OR t.serie_id IS NOT NULL)
                   AND COALESCE(t.fecha_hasta, t.fecha) < public.agenda_hoy(),
        'serie', (SELECT jsonb_build_object(
                             'id', s.id,
                             'frecuencia', s.frecuencia,
                             'frecuencia_texto', public.agenda_frecuencia_texto(s.frecuencia),
                             'desde', s.desde,
                             'hasta', s.hasta,
                             'numero', t.numero_en_serie,
                             'total', (SELECT count(*) FROM public.agenda_tareas o WHERE o.serie_id = s.id))
                    FROM public.agenda_series s WHERE s.id = t.serie_id),
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
$function$
;
REVOKE ALL ON FUNCTION public.agenda_tarea_json(public.agenda_tareas) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.agenda_tarea_json(public.agenda_tareas) FROM authenticated;
CREATE OR REPLACE FUNCTION public.agenda_crear_tarea(p_id uuid, p_dep uuid, p_sub uuid, p_carpeta uuid, p_prioridad uuid, p_nombre text, p_detalles text, p_fecha date, p_todo_el_dia boolean, p_desde time without time zone, p_hasta time without time zone, p_solicitud uuid DEFAULT NULL::uuid, p_fecha_hasta date DEFAULT NULL::date, p_frecuencia text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_uid uuid := auth.uid();
    -- Una tarea con plazo sin repetir es siempre todo el día.
    v_todo boolean := CASE WHEN p_fecha_hasta IS NOT NULL AND p_frecuencia IS NULL THEN true
                           ELSE COALESCE(p_todo_el_dia, true) END;
    v_motivo text;
    v_previa public.agenda_tareas;
    v_serie public.agenda_series;
    v_sol public.agenda_solicitudes;
    v_tarea public.agenda_tareas;
    v_fecha date;
    v_n integer := 0;
    v_primera uuid;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF p_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'id_requerido');
    END IF;

    -- El reintento. Con repetición, p_id es el id de la SERIE; sin ella, el de
    -- la tarea. En los dos casos, mandar lo mismo dos veces devuelve lo que ya
    -- se había guardado.
    IF p_frecuencia IS NOT NULL THEN
        SELECT * INTO v_serie FROM public.agenda_series WHERE id = p_id;
        IF FOUND THEN
            IF v_serie.created_by IS NOT DISTINCT FROM v_uid THEN
                RETURN jsonb_build_object('ok', true, 'id', v_serie.id, 'ya_existia', true,
                    'serie', public.agenda_serie_json(v_serie),
                    'tareas', COALESCE((SELECT jsonb_agg(public.agenda_tarea_json(t) ORDER BY t.fecha)
                                          FROM public.agenda_tareas t WHERE t.serie_id = v_serie.id), '[]'::jsonb));
            END IF;
            RETURN jsonb_build_object('ok', false, 'motivo', 'id_en_uso');
        END IF;
    ELSE
        SELECT * INTO v_previa FROM public.agenda_tareas WHERE id = p_id;
        IF FOUND THEN
            IF v_previa.created_by IS NOT DISTINCT FROM v_uid THEN
                RETURN jsonb_build_object('ok', true, 'id', v_previa.id, 'ya_existia', true,
                                          'tarea', public.agenda_tarea_json(v_previa));
            END IF;
            RETURN jsonb_build_object('ok', false, 'motivo', 'id_en_uso');
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.agenda_departamentos WHERE id = p_dep) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF NOT public.agenda_es_encargado(p_dep) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    v_motivo := COALESCE(
        public.agenda_valida_campos_tarea(p_nombre, p_detalles, p_fecha, v_todo, p_desde, p_hasta),
        public.agenda_valida_plazo(p_fecha, p_fecha_hasta, p_frecuencia, v_todo),
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

    -- ── Con repetición: la serie y sus días ─────────────────────────────────
    IF p_frecuencia IS NOT NULL THEN
        INSERT INTO public.agenda_series (id, departamento_id, frecuencia, desde, hasta,
                                          todo_el_dia, hora_desde, hora_hasta, created_by)
        VALUES (p_id, p_dep, p_frecuencia, p_fecha, p_fecha_hasta, v_todo,
                CASE WHEN v_todo THEN NULL ELSE p_desde END,
                CASE WHEN v_todo THEN NULL ELSE p_hasta END,
                v_uid)
        RETURNING * INTO v_serie;

        -- Mientras dura el lote, el trigger no avisa por cada repetición.
        PERFORM set_config('agenda.serie_en_lote', '1', true);

        FOR v_fecha IN SELECT * FROM public.agenda_serie_fechas(p_frecuencia, p_fecha, p_fecha_hasta) LOOP
            v_n := v_n + 1;
            INSERT INTO public.agenda_tareas (
                departamento_id, subdepartamento_id, carpeta_id, prioridad_id, solicitud_id,
                nombre, detalles, fecha, todo_el_dia, hora_desde, hora_hasta,
                estado, asignada_at, created_by, serie_id, numero_en_serie)
            VALUES (
                p_dep, p_sub, p_carpeta, p_prioridad,
                CASE WHEN v_n = 1 THEN p_solicitud ELSE NULL END,
                btrim(p_nombre), NULLIF(btrim(COALESCE(p_detalles, '')), ''), v_fecha, v_todo,
                CASE WHEN v_todo THEN NULL ELSE p_desde END,
                CASE WHEN v_todo THEN NULL ELSE p_hasta END,
                CASE WHEN p_sub IS NULL THEN 'esperando' ELSE 'en_proceso' END,
                CASE WHEN p_sub IS NULL THEN NULL ELSE now() END,
                v_uid, v_serie.id, v_n)
            RETURNING * INTO v_tarea;
            IF v_n = 1 THEN v_primera := v_tarea.id; END IF;
        END LOOP;

        PERFORM set_config('agenda.serie_en_lote', '', true);
        -- UN solo aviso por serie, con el plazo y cuántas veces.
        PERFORM public.agenda_avisar_serie(v_primera);

        IF p_solicitud IS NOT NULL THEN
            UPDATE public.agenda_solicitudes SET estado = 'asignada', tarea_id = v_primera
             WHERE id = p_solicitud;
        END IF;

        RETURN jsonb_build_object('ok', true, 'id', v_serie.id, 'ya_existia', false,
            'serie', public.agenda_serie_json(v_serie), 'veces', v_n,
            'tareas', COALESCE((SELECT jsonb_agg(public.agenda_tarea_json(t) ORDER BY t.fecha)
                                  FROM public.agenda_tareas t WHERE t.serie_id = v_serie.id), '[]'::jsonb));
    END IF;

    -- ── De un día, o con plazo ──────────────────────────────────────────────
    INSERT INTO public.agenda_tareas (
        id, departamento_id, subdepartamento_id, carpeta_id, prioridad_id, solicitud_id,
        nombre, detalles, fecha, fecha_hasta, todo_el_dia, hora_desde, hora_hasta,
        estado, asignada_at, created_by)
    VALUES (
        p_id, p_dep, p_sub, p_carpeta, p_prioridad, p_solicitud,
        btrim(p_nombre), NULLIF(btrim(COALESCE(p_detalles, '')), ''), p_fecha, p_fecha_hasta, v_todo,
        CASE WHEN v_todo THEN NULL ELSE p_desde END,
        CASE WHEN v_todo THEN NULL ELSE p_hasta END,
        CASE WHEN p_sub IS NULL THEN 'esperando' ELSE 'en_proceso' END,
        CASE WHEN p_sub IS NULL THEN NULL ELSE now() END,
        v_uid)
    ON CONFLICT (id) DO NOTHING
    RETURNING * INTO v_tarea;

    IF v_tarea.id IS NULL THEN
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
$function$
;
REVOKE ALL ON FUNCTION public.agenda_crear_tarea(uuid, uuid, uuid, uuid, uuid, text, text, date, boolean, time, time, uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_crear_tarea(uuid, uuid, uuid, uuid, uuid, text, text, date, boolean, time, time, uuid, date, text) TO authenticated;
CREATE OR REPLACE FUNCTION public.agenda_editar_tarea(p_id uuid, p_sub uuid, p_carpeta uuid, p_prioridad uuid, p_nombre text, p_detalles text, p_fecha date, p_todo_el_dia boolean, p_desde time without time zone, p_hasta time without time zone, p_fecha_hasta date DEFAULT NULL::date, p_frecuencia text DEFAULT NULL::text, p_alcance text DEFAULT 'solo_esta'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_alcance text := COALESCE(NULLIF(btrim(COALESCE(p_alcance, '')), ''), 'solo_esta');
    v_todo boolean;
    v_motivo text;
    t public.agenda_tareas;
    s public.agenda_series;
    v_cambia_sub boolean;
    v_pendientes integer;
    v_fecha date;
    v_primera uuid;
    v_hay integer := 0;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF v_alcance NOT IN ('solo_esta', 'las_que_faltan') THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'alcance_invalido');
    END IF;
    SELECT * INTO t FROM public.agenda_tareas WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF NOT public.agenda_es_encargado(t.departamento_id) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;
    IF v_alcance = 'las_que_faltan' AND t.serie_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'alcance_invalido');
    END IF;
    -- Una repetición nunca lleva plazo, y una tarea suelta no se convierte en
    -- serie editándola: para eso se crea una serie.
    IF t.serie_id IS NULL AND p_frecuencia IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'serie_invalida');
    END IF;
    IF t.serie_id IS NOT NULL AND v_alcance = 'solo_esta'
       AND (p_frecuencia IS NOT NULL OR p_fecha_hasta IS NOT NULL) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'alcance_invalido');
    END IF;

    v_todo := CASE WHEN t.serie_id IS NULL AND p_fecha_hasta IS NOT NULL THEN true
                   ELSE COALESCE(p_todo_el_dia, true) END;

    v_motivo := public.agenda_valida_campos_tarea(p_nombre, p_detalles, p_fecha, v_todo, p_desde, p_hasta);
    IF v_motivo IS NULL AND t.serie_id IS NULL THEN
        v_motivo := public.agenda_valida_plazo(p_fecha, p_fecha_hasta, NULL, v_todo);
    END IF;
    IF v_motivo IS NULL AND t.serie_id IS NOT NULL AND p_frecuencia IS NOT NULL THEN
        v_motivo := public.agenda_valida_plazo(p_fecha, p_fecha_hasta, p_frecuencia, v_todo);
    END IF;
    IF v_motivo IS NULL THEN
        -- El 5º argumento es el sub que la tarea YA tiene: se puede conservar
        -- uno archivado (historial), pero no mudarse a uno archivado.
        v_motivo := public.agenda_valida_del_departamento(
            t.departamento_id, p_sub, p_carpeta, p_prioridad, t.subdepartamento_id);
    END IF;
    IF v_motivo IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', v_motivo);
    END IF;

    -- ── Una sola tarea (o una sola repetición) ──────────────────────────────
    IF v_alcance = 'solo_esta' THEN
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
            fecha_hasta = CASE WHEN t.serie_id IS NULL THEN p_fecha_hasta ELSE NULL END,
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

        IF t.serie_id IS NOT NULL THEN
            PERFORM public.agenda_serie_renumerar(t.serie_id);
            SELECT * INTO t FROM public.agenda_tareas WHERE id = p_id;
        END IF;
        RETURN jsonb_build_object('ok', true, 'id', t.id, 'tarea', public.agenda_tarea_json(t));
    END IF;

    -- ── Toda la serie, de hoy en adelante ───────────────────────────────────
    SELECT * INTO s FROM public.agenda_series WHERE id = t.serie_id FOR UPDATE;
    SELECT count(*) INTO v_pendientes FROM public.agenda_serie_pendientes(t.serie_id);
    IF v_pendientes = 0 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'serie_completada');
    END IF;
    IF p_sub IS DISTINCT FROM t.subdepartamento_id AND t.estado = 'completada' THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'completada');
    END IF;

    PERFORM set_config('agenda.serie_en_lote', '1', true);

    -- Cambió el plazo o la frecuencia: se rehacen los días que faltan.
    IF p_frecuencia IS NOT NULL THEN
        DELETE FROM public.agenda_tareas
         WHERE id IN (SELECT id FROM public.agenda_serie_pendientes(s.id));

        UPDATE public.agenda_series SET
            frecuencia = p_frecuencia, desde = p_fecha, hasta = p_fecha_hasta,
            todo_el_dia = v_todo,
            hora_desde = CASE WHEN v_todo THEN NULL ELSE p_desde END,
            hora_hasta = CASE WHEN v_todo THEN NULL ELSE p_hasta END,
            updated_at = now()
         WHERE id = s.id;

        FOR v_fecha IN SELECT * FROM public.agenda_serie_fechas(p_frecuencia, p_fecha, p_fecha_hasta) LOOP
            -- Un día que ya tiene una repetición completada no se duplica.
            CONTINUE WHEN v_fecha < public.agenda_hoy()
                       OR EXISTS (SELECT 1 FROM public.agenda_tareas
                                   WHERE serie_id = s.id AND fecha = v_fecha);
            INSERT INTO public.agenda_tareas (
                departamento_id, subdepartamento_id, carpeta_id, prioridad_id,
                nombre, detalles, fecha, todo_el_dia, hora_desde, hora_hasta,
                estado, asignada_at, created_by, serie_id, numero_en_serie)
            VALUES (
                t.departamento_id, p_sub, p_carpeta, p_prioridad,
                btrim(p_nombre), NULLIF(btrim(COALESCE(p_detalles, '')), ''), v_fecha, v_todo,
                CASE WHEN v_todo THEN NULL ELSE p_desde END,
                CASE WHEN v_todo THEN NULL ELSE p_hasta END,
                CASE WHEN p_sub IS NULL THEN 'esperando' ELSE 'en_proceso' END,
                CASE WHEN p_sub IS NULL THEN NULL ELSE now() END,
                auth.uid(), s.id,
                -- Provisorio: agenda_serie_renumerar deja los definitivos.
                1000000 + (v_fecha - s.desde));
            v_hay := v_hay + 1;
        END LOOP;
    END IF;

    -- Lo demás se aplica a todas las que faltan.
    UPDATE public.agenda_tareas SET
        subdepartamento_id = p_sub,
        carpeta_id = p_carpeta,
        prioridad_id = p_prioridad,
        nombre = btrim(p_nombre),
        detalles = NULLIF(btrim(COALESCE(p_detalles, '')), ''),
        todo_el_dia = v_todo,
        hora_desde = CASE WHEN v_todo THEN NULL ELSE p_desde END,
        hora_hasta = CASE WHEN v_todo THEN NULL ELSE p_hasta END,
        estado = CASE WHEN p_sub IS NULL THEN 'esperando'
                      WHEN p_sub IS DISTINCT FROM subdepartamento_id THEN 'en_proceso'
                      ELSE estado END,
        asignada_at = CASE WHEN p_sub IS NULL THEN NULL
                           WHEN p_sub IS DISTINCT FROM subdepartamento_id THEN now()
                           ELSE asignada_at END,
        updated_at = now()
     WHERE id IN (SELECT id FROM public.agenda_serie_pendientes(s.id));

    PERFORM public.agenda_serie_renumerar(s.id);
    PERFORM set_config('agenda.serie_en_lote', '', true);

    SELECT id INTO v_primera FROM public.agenda_serie_pendientes(s.id) LIMIT 1;
    IF v_primera IS NOT NULL THEN
        PERFORM public.agenda_avisar_serie(v_primera);
    END IF;

    SELECT * INTO s FROM public.agenda_series WHERE id = s.id;
    RETURN jsonb_build_object('ok', true, 'id', p_id, 'alcance', v_alcance,
        'serie', public.agenda_serie_json(s),
        'tareas', COALESCE((SELECT jsonb_agg(public.agenda_tarea_json(x) ORDER BY x.fecha)
                              FROM public.agenda_tareas x WHERE x.serie_id = s.id), '[]'::jsonb));
END;
$function$
;
REVOKE ALL ON FUNCTION public.agenda_editar_tarea(uuid, uuid, uuid, uuid, text, text, date, boolean, time, time, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_editar_tarea(uuid, uuid, uuid, uuid, text, text, date, boolean, time, time, date, text, text) TO authenticated;
CREATE OR REPLACE FUNCTION public.agenda_cambiar_estado_tarea(p_id uuid, p_estado text)
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
    IF p_estado IS NULL OR p_estado NOT IN ('completada', 'en_proceso') THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'estado_invalido');
    END IF;
    SELECT * INTO t FROM public.agenda_tareas WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF NOT (public.agenda_es_encargado(t.departamento_id)
            OR (t.subdepartamento_id IS NOT NULL AND public.agenda_es_miembro(t.subdepartamento_id))) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;
    IF t.subdepartamento_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sub');
    END IF;
    -- Las completadas de un sub archivado son historial: volverlas a 'en
    -- proceso' las dejaría pendientes en un equipo que ya no existe.
    IF EXISTS (SELECT 1 FROM public.agenda_subdepartamentos
                WHERE id = t.subdepartamento_id AND archivado_at IS NOT NULL) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'archivado');
    END IF;
    IF t.estado = p_estado THEN
        RETURN jsonb_build_object('ok', true, 'sin_cambios', true, 'tarea', public.agenda_tarea_json(t));
    END IF;

    UPDATE public.agenda_tareas SET
        estado = p_estado,
        completada_at = CASE WHEN p_estado = 'completada' THEN now() END,
        completada_por = CASE WHEN p_estado = 'completada' THEN auth.uid() END,
        updated_at = now()
     WHERE id = p_id
    RETURNING * INTO t;

    RETURN jsonb_build_object('ok', true, 'tarea', public.agenda_tarea_json(t));
END;
$function$
;
REVOKE ALL ON FUNCTION public.agenda_cambiar_estado_tarea(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_cambiar_estado_tarea(uuid, text) TO authenticated;
CREATE OR REPLACE FUNCTION public.agenda_puede_ver_tarea(p_tarea uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT auth.uid() IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.agenda_tareas t
                    WHERE t.id = p_tarea
                      AND (public.agenda_es_encargado(t.departamento_id)
                           OR (t.subdepartamento_id IS NOT NULL
                               AND public.agenda_es_miembro(t.subdepartamento_id))));
$function$
;
CREATE OR REPLACE FUNCTION public.agenda_tarea(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    t public.agenda_tareas;
    s public.agenda_subdepartamentos;
    v_encargado boolean;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    SELECT * INTO t FROM public.agenda_tareas WHERE id = p_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF NOT public.agenda_puede_ver_tarea(p_id) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;
    SELECT * INTO s FROM public.agenda_subdepartamentos WHERE id = t.subdepartamento_id;
    v_encargado := public.agenda_es_encargado(t.departamento_id);

    RETURN jsonb_build_object('ok', true, 'tarea',
        public.agenda_tarea_json(t) || jsonb_build_object(
            'detalles', t.detalles,
            -- Quien dirige primero y después los miembros, sin repetir.
            'la_tienen', CASE WHEN s.id IS NULL THEN '[]'::jsonb ELSE
                COALESCE((SELECT jsonb_agg(x.p || jsonb_build_object('dirige', x.dirige) ORDER BY x.dirige DESC, x.creado)
                            FROM (SELECT public.agenda_persona(s.lider_id) AS p, true AS dirige,
                                         '-infinity'::timestamptz AS creado
                                   WHERE s.lider_id IS NOT NULL
                                  UNION ALL
                                  SELECT public.agenda_persona(m.user_id), false, m.created_at
                                    FROM public.agenda_subdepartamento_miembros m
                                   WHERE m.subdepartamento_id = s.id
                                     AND m.user_id IS DISTINCT FROM s.lider_id) x
                           WHERE x.p IS NOT NULL), '[]'::jsonb) END,
            'creador', public.agenda_persona(t.created_by),
            'completada_por', public.agenda_persona(t.completada_por),
            'puede_editar', v_encargado,
            -- Una completada de un sub archivado es historial: no se reabre.
            'puede_cambiar_estado', t.subdepartamento_id IS NOT NULL
                                    AND s.archivado_at IS NULL
                                    AND (v_encargado OR public.agenda_es_miembro(t.subdepartamento_id))));
END;
$function$
;
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
         WHERE t.fecha <= p_hasta
           AND COALESCE(t.fecha_hasta, t.fecha) >= p_desde
           AND (
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
$function$
;
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
    SELECT departamento_id, archivado_at INTO v_dep, v_archivado
      FROM public.agenda_subdepartamentos WHERE id = p_sub;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF v_archivado IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'archivado');
    END IF;
    IF NOT (public.agenda_dirige(p_sub) OR public.agenda_es_encargado(v_dep)) THEN
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
         WHERE t.subdepartamento_id = p_sub
           AND t.fecha <= p_hasta
           AND COALESCE(t.fecha_hasta, t.fecha) >= p_desde), '[]'::jsonb));
END;
$function$
;
CREATE OR REPLACE FUNCTION public.agenda_reasignar_tarea(p_id uuid, p_sub_nuevo uuid, p_alcance text DEFAULT 'solo_esta'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_alcance text := COALESCE(NULLIF(btrim(COALESCE(p_alcance, '')), ''), 'solo_esta');
    t public.agenda_tareas;
    v_motivo text;
    v_ids uuid[];
    v_primera uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF v_alcance NOT IN ('solo_esta', 'las_que_faltan') THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'alcance_invalido');
    END IF;
    SELECT * INTO t FROM public.agenda_tareas WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF NOT public.agenda_es_encargado(t.departamento_id) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;
    IF v_alcance = 'las_que_faltan' AND t.serie_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'alcance_invalido');
    END IF;
    v_motivo := public.agenda_valida_del_departamento(t.departamento_id, p_sub_nuevo, NULL, NULL);
    IF v_motivo IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', v_motivo);
    END IF;

    IF v_alcance = 'solo_esta' THEN
        IF t.estado = 'completada' THEN
            RETURN jsonb_build_object('ok', false, 'motivo', 'completada');
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
    END IF;

    -- Toda la serie, de hoy en adelante. Las completadas se quedan con el
    -- equipo que las hizo.
    SELECT array_agg(id) INTO v_ids FROM public.agenda_serie_pendientes(t.serie_id);
    IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'serie_completada');
    END IF;

    PERFORM set_config('agenda.serie_en_lote', '1', true);
    UPDATE public.agenda_tareas SET
        subdepartamento_id = p_sub_nuevo,
        estado = CASE WHEN p_sub_nuevo IS NULL THEN 'esperando' ELSE 'en_proceso' END,
        asignada_at = CASE WHEN p_sub_nuevo IS NULL THEN NULL ELSE now() END,
        updated_at = now()
     WHERE id = ANY (v_ids);
    PERFORM set_config('agenda.serie_en_lote', '', true);

    v_primera := v_ids[1];
    IF p_sub_nuevo IS NOT NULL THEN
        PERFORM public.agenda_avisar_serie(v_primera);
    END IF;

    RETURN jsonb_build_object('ok', true, 'id', p_id, 'alcance', v_alcance,
        'reasignadas', array_length(v_ids, 1),
        'tareas', COALESCE((SELECT jsonb_agg(public.agenda_tarea_json(x) ORDER BY x.fecha)
                              FROM public.agenda_tareas x WHERE x.serie_id = t.serie_id), '[]'::jsonb));
END;
$function$
;
CREATE OR REPLACE FUNCTION public.agenda_tareas_avisar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_sub_nombre text;
    v_users uuid[];
    v_cuando jsonb;
    v_quien text;
BEGIN
    SELECT nombre INTO v_sub_nombre FROM public.agenda_subdepartamentos WHERE id = NEW.subdepartamento_id;

    -- ASIGNADA: se crea con sub, o le cambia asignada_at (reasignar, editar
    -- el sub, asignar una que esperaba). También si cambia el sub: dentro de
    -- una misma transacción now() no avanza y asignada_at quedaría igual.
    IF NEW.subdepartamento_id IS NOT NULL
       AND (TG_OP = 'INSERT'
            OR NEW.asignada_at IS DISTINCT FROM OLD.asignada_at
            OR NEW.subdepartamento_id IS DISTINCT FROM OLD.subdepartamento_id)
       -- La serie avisa una sola vez, desde la RPC que la armó.
       AND NOT (NEW.serie_id IS NOT NULL
                AND COALESCE(current_setting('agenda.serie_en_lote', true), '') = '1') THEN

        SELECT array_agg(DISTINCT x.uid) INTO v_users
          FROM (SELECT s.lider_id AS uid FROM public.agenda_subdepartamentos s
                 WHERE s.id = NEW.subdepartamento_id AND s.lider_id IS NOT NULL
                UNION
                SELECT m.user_id FROM public.agenda_subdepartamento_miembros m
                 WHERE m.subdepartamento_id = NEW.subdepartamento_id) x
          JOIN public.users u ON u.id = x.uid AND u.is_active IS NOT FALSE
         WHERE NOT EXISTS (SELECT 1 FROM public.agenda_departamento_encargados e
                            WHERE e.departamento_id = NEW.departamento_id AND e.user_id = x.uid);

        v_cuando := public.agenda_cuando_json(NEW);

        PERFORM public.agenda_registrar_avisos(
            NEW.id, 'asignada', v_users, 'agenda_tarea_asignada',
            jsonb_build_object(
                'tarea', NEW.nombre,
                'subdepartamento', COALESCE(v_sub_nombre, 'Tu equipo'),
                'fecha', v_cuando->>'fecha',
                'horario', v_cuando->>'horario'));
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
$function$
;
CREATE OR REPLACE FUNCTION public.agenda_avisar_serie(p_tarea uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    t public.agenda_tareas;
    v_sub_nombre text;
    v_users uuid[];
    v_cuando jsonb;
BEGIN
    SELECT * INTO t FROM public.agenda_tareas WHERE id = p_tarea;
    IF NOT FOUND OR t.subdepartamento_id IS NULL THEN
        RETURN 0;
    END IF;
    SELECT nombre INTO v_sub_nombre FROM public.agenda_subdepartamentos WHERE id = t.subdepartamento_id;

    SELECT array_agg(DISTINCT x.uid) INTO v_users
      FROM (SELECT s.lider_id AS uid FROM public.agenda_subdepartamentos s
             WHERE s.id = t.subdepartamento_id AND s.lider_id IS NOT NULL
            UNION
            SELECT m.user_id FROM public.agenda_subdepartamento_miembros m
             WHERE m.subdepartamento_id = t.subdepartamento_id) x
      JOIN public.users u ON u.id = x.uid AND u.is_active IS NOT FALSE
     WHERE NOT EXISTS (SELECT 1 FROM public.agenda_departamento_encargados e
                        WHERE e.departamento_id = t.departamento_id AND e.user_id = x.uid);

    v_cuando := public.agenda_cuando_json(t);

    RETURN public.agenda_registrar_avisos(
        t.id, 'asignada', v_users, 'agenda_tarea_asignada',
        jsonb_build_object(
            'tarea', t.nombre,
            'subdepartamento', COALESCE(v_sub_nombre, 'Tu equipo'),
            'fecha', v_cuando->>'fecha',
            'horario', v_cuando->>'horario'));
END;
$function$
;
CREATE OR REPLACE FUNCTION public.agenda_plazos_vencidos_tick(p_ahora timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_hoy date := (p_ahora AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
    t record;
    v_sub text;
    v_quien uuid;
    v_personas integer;
    v_tareas integer := 0;
BEGIN
    FOR t IN
        SELECT x.id, x.nombre, x.departamento_id, x.subdepartamento_id, x.fecha_hasta
          FROM public.agenda_tareas x
         WHERE x.fecha_hasta IS NOT NULL
           AND x.serie_id IS NULL
           AND x.estado <> 'completada'
           AND x.fecha_hasta < v_hoy
           AND NOT EXISTS (SELECT 1 FROM public.agenda_plazos_avisados a
                            WHERE a.tarea_id = x.id AND a.fecha_hasta = x.fecha_hasta)
         ORDER BY x.fecha_hasta
    LOOP
        -- Reservar primero: si esto no entra, otra corrida ya lo tomó.
        INSERT INTO public.agenda_plazos_avisados (tarea_id, fecha_hasta)
        VALUES (t.id, t.fecha_hasta)
        ON CONFLICT (tarea_id, fecha_hasta) DO NOTHING;
        CONTINUE WHEN NOT FOUND;

        SELECT nombre INTO v_sub FROM public.agenda_subdepartamentos WHERE id = t.subdepartamento_id;
        v_personas := 0;

        -- Sólo los encargados del departamento. A nadie más: una tarea
        -- vencida es algo que resuelve quien lleva el departamento.
        FOR v_quien IN
            SELECT e.user_id FROM public.agenda_departamento_encargados e
              JOIN public.users u ON u.id = e.user_id AND u.is_active IS NOT FALSE
             WHERE e.departamento_id = t.departamento_id
        LOOP
            PERFORM public.notif_emitir(
                'agenda_plazo_vencido', v_quien,
                jsonb_build_object(
                    'tarea', t.nombre,
                    'subdepartamento', COALESCE(v_sub, 'Sin equipo'),
                    'fecha', public.agenda_fecha_dm(t.fecha_hasta)),
                '/departamentos/' || t.departamento_id || '?tarea=' || t.id);
            v_personas := v_personas + 1;
        END LOOP;

        UPDATE public.agenda_plazos_avisados SET personas = v_personas
         WHERE tarea_id = t.id AND fecha_hasta = t.fecha_hasta;

        v_tareas := v_tareas + 1;
    END LOOP;

    RETURN v_tareas;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.agenda_subdepartamento(p_sub uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    s public.agenda_subdepartamentos;
    d public.agenda_departamentos;
    v_hoy date := public.agenda_hoy();
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    SELECT * INTO s FROM public.agenda_subdepartamentos WHERE id = p_sub;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF NOT (public.agenda_dirige(p_sub) OR public.agenda_es_encargado(s.departamento_id)) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;
    IF s.archivado_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'archivado');
    END IF;
    SELECT * INTO d FROM public.agenda_departamentos WHERE id = s.departamento_id;

    RETURN jsonb_build_object(
        'ok', true,
        'hoy', v_hoy,
        'subdepartamento', jsonb_build_object('id', s.id, 'nombre', s.nombre, 'color', s.color),
        'departamento', jsonb_build_object('id', d.id, 'nombre', d.nombre, 'color', d.color, 'icono', d.icono),
        'lider', public.agenda_persona(s.lider_id),
        'miembros', COALESCE((
            SELECT jsonb_agg(public.agenda_persona(m.user_id) ORDER BY m.created_at)
              FROM public.agenda_subdepartamento_miembros m
             WHERE m.subdepartamento_id = s.id AND m.user_id IS DISTINCT FROM s.lider_id), '[]'::jsonb),
        -- Sólo nombre y foto: "a quién recurrir".
        'encargados', COALESCE((
            SELECT jsonb_agg(public.agenda_persona(e.user_id) ORDER BY e.created_at)
              FROM public.agenda_departamento_encargados e WHERE e.departamento_id = d.id), '[]'::jsonb),
        'contadores', jsonb_build_object(
            'en_proceso', (SELECT count(*) FROM public.agenda_tareas t
                            WHERE t.subdepartamento_id = s.id AND t.estado = 'en_proceso'),
            'completadas_mes', (SELECT count(*) FROM public.agenda_tareas t
                                 WHERE t.subdepartamento_id = s.id AND t.estado = 'completada'
                                   AND (t.completada_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
                                       >= date_trunc('month', v_hoy)::date),
            'para_hoy', (SELECT count(*) FROM public.agenda_tareas t
                          WHERE t.subdepartamento_id = s.id AND t.fecha = v_hoy
                            AND t.estado <> 'completada'))
    );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.agenda_departamento(p_dep uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    d public.agenda_departamentos;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    SELECT * INTO d FROM public.agenda_departamentos WHERE id = p_dep;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF NOT public.agenda_es_encargado(p_dep) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'departamento', jsonb_build_object('id', d.id, 'nombre', d.nombre, 'color', d.color,
                                           'icono', d.icono, 'created_at', d.created_at),
        'encargados', COALESCE((
            SELECT jsonb_agg(public.agenda_persona(e.user_id) ORDER BY e.created_at)
              FROM public.agenda_departamento_encargados e WHERE e.departamento_id = p_dep), '[]'::jsonb),
        'subdepartamentos', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                       'id', s.id, 'nombre', s.nombre, 'color', s.color,
                       'lider', public.agenda_persona(s.lider_id),
                       -- Sin quien dirige: ya viene en 'lider'.
                       'miembros', COALESCE((
                           SELECT jsonb_agg(public.agenda_persona(m.user_id) ORDER BY m.created_at)
                             FROM public.agenda_subdepartamento_miembros m
                            WHERE m.subdepartamento_id = s.id
                              AND m.user_id IS DISTINCT FROM s.lider_id), '[]'::jsonb),
                       'cant_miembros', (SELECT count(DISTINCT p.user_id) FROM (
                                             SELECT s.lider_id AS user_id WHERE s.lider_id IS NOT NULL
                                             UNION
                                             SELECT m.user_id FROM public.agenda_subdepartamento_miembros m
                                              WHERE m.subdepartamento_id = s.id) p),
                       'en_proceso', (SELECT count(*) FROM public.agenda_tareas t
                                       WHERE t.subdepartamento_id = s.id AND t.estado = 'en_proceso'))
                   ORDER BY lower(s.nombre))
              FROM public.agenda_subdepartamentos s
             WHERE s.departamento_id = p_dep AND s.archivado_at IS NULL), '[]'::jsonb),
        'carpetas', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                       'id', c.id, 'nombre', c.nombre, 'color', c.color, 'created_at', c.created_at,
                       'cant_tareas', (SELECT count(*) FROM public.agenda_tareas t WHERE t.carpeta_id = c.id))
                   ORDER BY c.created_at)
              FROM public.agenda_carpetas c WHERE c.departamento_id = p_dep), '[]'::jsonb),
        'prioridades', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                       'id', p.id, 'nombre', p.nombre, 'color', p.color, 'orden', p.orden,
                       -- "La usan N tareas" de la hoja de borrar.
                       'cant_tareas', (SELECT count(*) FROM public.agenda_tareas t WHERE t.prioridad_id = p.id))
                   ORDER BY p.orden, p.created_at)
              FROM public.agenda_prioridades p WHERE p.departamento_id = p_dep), '[]'::jsonb)
    );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.agenda_mi_acceso()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_uid uuid := auth.uid();
    v_super boolean;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    v_super := public.agenda_es_super_admin();

    RETURN jsonb_build_object(
        'ok', true,
        'super_admin', v_super,
        'encargado', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                       'id', d.id, 'nombre', d.nombre, 'color', d.color, 'icono', d.icono,
                       'en_proceso', (SELECT count(*) FROM public.agenda_tareas t
                                       WHERE t.departamento_id = d.id AND t.estado = 'en_proceso'),
                       'esperando', (SELECT count(*) FROM public.agenda_tareas t
                                      WHERE t.departamento_id = d.id AND t.estado = 'esperando'),
                       'solicitudes_nuevas', (SELECT count(*) FROM public.agenda_solicitudes r
                                               WHERE r.departamento_id = d.id AND r.estado = 'nueva'))
                   ORDER BY lower(d.nombre))
              FROM public.agenda_departamentos d
             WHERE v_super
                OR EXISTS (SELECT 1 FROM public.agenda_departamento_encargados e
                            WHERE e.departamento_id = d.id AND e.user_id = v_uid)), '[]'::jsonb),
        'dirijo', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                       'id', s.id, 'departamento_id', d.id, 'departamento_nombre', d.nombre,
                       'nombre', s.nombre, 'color', s.color,
                       'en_proceso', (SELECT count(*) FROM public.agenda_tareas t
                                       WHERE t.subdepartamento_id = s.id AND t.estado = 'en_proceso'))
                   ORDER BY lower(d.nombre), lower(s.nombre))
              FROM public.agenda_subdepartamentos s
              JOIN public.agenda_departamentos d ON d.id = s.departamento_id
             WHERE s.lider_id = v_uid AND s.archivado_at IS NULL), '[]'::jsonb),
        'miembro', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                       'id', s.id, 'departamento_id', s.departamento_id, 'departamento_nombre', d.nombre,
                       'nombre', s.nombre, 'color', s.color, 'dirige', s.lider_id IS NOT DISTINCT FROM v_uid)
                   ORDER BY lower(d.nombre), lower(s.nombre))
              FROM public.agenda_subdepartamentos s
              JOIN public.agenda_departamentos d ON d.id = s.departamento_id
             WHERE s.archivado_at IS NULL
               AND (s.lider_id = v_uid
                    OR EXISTS (SELECT 1 FROM public.agenda_subdepartamento_miembros m
                                WHERE m.subdepartamento_id = s.id AND m.user_id = v_uid))), '[]'::jsonb)
    );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.agenda_archivar_subdepartamento(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_uid uuid := auth.uid();
    s public.agenda_subdepartamentos;
    v_a_esperando integer;
    v_conservadas integer;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    SELECT * INTO s FROM public.agenda_subdepartamentos WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF NOT public.agenda_es_encargado(s.departamento_id) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;
    IF s.archivado_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'archivado');
    END IF;

    UPDATE public.agenda_tareas
       SET subdepartamento_id = NULL, estado = 'esperando', asignada_at = NULL, updated_at = now()
     WHERE subdepartamento_id = p_id AND estado <> 'completada';
    GET DIAGNOSTICS v_a_esperando = ROW_COUNT;

    SELECT count(*) INTO v_conservadas
      FROM public.agenda_tareas WHERE subdepartamento_id = p_id AND estado = 'completada';

    UPDATE public.agenda_subdepartamentos
       SET archivado_at = now(), archivado_por = v_uid, updated_at = now()
     WHERE id = p_id;

    RETURN jsonb_build_object('ok', true, 'id', p_id,
                              'tareas_a_esperando', v_a_esperando,
                              'completadas_conservadas', v_conservadas);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.agenda_eliminar_subdepartamento(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_dep uuid;
    v_esperando integer;
    v_completadas integer;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    SELECT departamento_id INTO v_dep FROM public.agenda_subdepartamentos WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF NOT public.agenda_es_encargado(v_dep) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    UPDATE public.agenda_tareas
       SET subdepartamento_id = NULL, estado = 'esperando', asignada_at = NULL, updated_at = now()
     WHERE subdepartamento_id = p_id AND estado <> 'completada';
    GET DIAGNOSTICS v_esperando = ROW_COUNT;

    UPDATE public.agenda_solicitudes SET estado = 'aceptada', tarea_id = NULL
     WHERE estado = 'asignada'
       AND tarea_id IN (SELECT id FROM public.agenda_tareas
                         WHERE subdepartamento_id = p_id AND estado = 'completada');
    DELETE FROM public.agenda_tareas WHERE subdepartamento_id = p_id AND estado = 'completada';
    GET DIAGNOSTICS v_completadas = ROW_COUNT;

    DELETE FROM public.agenda_subdepartamentos WHERE id = p_id;

    RETURN jsonb_build_object('ok', true, 'id', p_id,
                              'pasaron_a_esperando', v_esperando,
                              'completadas_borradas', v_completadas);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.notif_ejemplos()
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
    SELECT jsonb_build_object(
        'nombre', 'Sofía Ejemplo',
        'pareja', 'Martín Ejemplo',
        'grupo', 'GCX Palermo Martes',
        'fecha', '28/10',
        'horario', '20:00 – 21:30',
        'presentes', '7',
        'dia', 'Martes',
        'motivo', ' Motivo: faltan el día y el horario.',
        'tarea', 'Armar la mesa de bienvenida',
        'departamento', 'Bienvenida',
        'subdepartamento', 'Recepción',
        'detalle', 'Necesitamos un flyer para el anuncio del domingo',
        'codigo', 'REP-0001',
        'numero', '0001',
        'tipo', 'Acceso a mis datos',
        'pantalla', 'Eventos',
        'resultado', 'aprobado',
        'pedido', 'la baja');
$function$
;

-- Lo que se agregó
DROP FUNCTION public.agenda_tarea_equipos_avisar();
DROP FUNCTION public.agenda_avisar_equipo(public.agenda_tareas, uuid);
DROP FUNCTION public.agenda_gente_de_equipo(uuid, uuid);
DROP FUNCTION public.agenda_nombres_de_equipos(uuid, boolean);
DROP FUNCTION public.agenda_partes_pendientes(uuid);
DROP FUNCTION public.agenda_aplicar_equipos(uuid, uuid[]);
DROP FUNCTION public.agenda_recalcular_compartida(uuid);
DROP FUNCTION public.agenda_gente_de_tarea(public.agenda_tareas);
DROP FUNCTION public.agenda_tarea_vista(public.agenda_tareas, uuid);
DROP FUNCTION public.agenda_mis_equipos_de_tarea(uuid);

DROP TABLE public.agenda_tarea_equipos;
ALTER TABLE public.agenda_tareas DROP CONSTRAINT agenda_tareas_compartida_ck;
ALTER TABLE public.agenda_tareas DROP CONSTRAINT agenda_tareas_completada_ck;
ALTER TABLE public.agenda_tareas ADD CONSTRAINT agenda_tareas_completada_ck CHECK (
    estado <> 'completada' OR subdepartamento_id IS NOT NULL
);
ALTER TABLE public.agenda_tareas DROP COLUMN compartida;

DELETE FROM public.agenda_avisos WHERE tipo LIKE 'equipo\_termino:%';
ALTER TABLE public.agenda_avisos DROP CONSTRAINT agenda_avisos_tipo_check;
ALTER TABLE public.agenda_avisos ADD CONSTRAINT agenda_avisos_tipo_check CHECK (
    tipo = ANY (ARRAY['asignada'::text, 'completada'::text])
);
DELETE FROM public.notif_alertas WHERE clave = 'agenda_tarea_equipo_termino';

COMMIT;
