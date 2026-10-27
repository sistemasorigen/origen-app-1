-- ════════════════════════════════════════════════════════════════════════════
-- Agenda Origen · los sub-departamentos se ARCHIVAN en vez de borrarse
-- 2026-10-26 · ✅ APLICADO el 2026-10-26 (PROBAR_: 29 casos en verde contra la base real)
--
-- Decisión de Ignacio (prompt 3 de 8). Va DESPUÉS de sql/agenda_origen.sql.
-- Diseño: design-claude/Departamento - Equipo.dc.html (detalle del sub).
--
-- POR QUÉ
--   agenda_eliminar_subdepartamento borraba las tareas completadas del sub
--   (una completada exige sub-departamento y el sub dejaba de existir). Se
--   perdía el historial de lo que hizo ese equipo. Archivar lo conserva.
--
-- QUÉ CAMBIA
--   1 · agenda_subdepartamentos: archivado_at y archivado_por.
--   2 · El nombre único por departamento pasa a índice PARCIAL (sólo los no
--       archivados): un nombre archivado no bloquea crear otro igual.
--   3 · agenda_archivar_subdepartamento(p_id): las tareas no completadas
--       vuelven a 'esperando' sin sub; las completadas quedan con su sub; los
--       miembros quedan (historial). Devuelve tareas_a_esperando y
--       completadas_conservadas.
--   4 · agenda_eliminar_subdepartamento: se le saca EXECUTE a authenticated.
--       No se borra: el rollback la necesita.
--   5 · Un sub archivado no aparece en agenda_departamento, agenda_mi_acceso
--       (dirijo/miembro) ni en los conteos de agenda_departamentos_admin, y
--       no se puede usar como destino (crear, editar, reasignar, mover
--       miembro) ni editar (guardar sub, agregar/quitar miembros, cambiar
--       quién dirige), ni abrir su panel (agenda_subdepartamento y sus
--       tareas): motivo 'archivado'. Tampoco se reabre una completada suya
--       (agenda_cambiar_estado_tarea).
--       Sus tareas COMPLETADAS siguen en agenda_mis_tareas,
--       agenda_tareas_departamento y agenda_tarea, con subdepartamento.archivado
--       = true.
--   6 · agenda_valida_del_departamento suma p_sub_actual (ver abajo).
--
-- Las funciones de abajo son las de sql/agenda_origen.sql con el filtro de
-- archivados y nada más. Las armó un script a partir de ese archivo, con
-- cada reemplazo verificado, para no tipear de nuevo 600 líneas.
--
-- Pruebas: sql/PROBAR_agenda_origen.sql (casos 10, 10b–10f)
-- Deshacer: sql/ROLLBACK_agenda_archivar_subdepartamentos.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 · Columnas ────────────────────────────────────────────────────────────
ALTER TABLE public.agenda_subdepartamentos
    ADD COLUMN IF NOT EXISTS archivado_at  timestamptz,
    ADD COLUMN IF NOT EXISTS archivado_por uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- ── 2 · Nombre único sólo entre los activos ─────────────────────────────────
DROP INDEX IF EXISTS public.agenda_subdepartamentos_nombre_uq;
CREATE UNIQUE INDEX agenda_subdepartamentos_nombre_uq
    ON public.agenda_subdepartamentos (departamento_id, lower(btrim(nombre)))
    WHERE archivado_at IS NULL;

-- ── 3 · Validación de destino ───────────────────────────────────────────────
-- Ahora con p_sub_actual: un sub archivado no puede ser DESTINO de una tarea,
-- pero sí seguir siendo el de una que ya lo tenía (editar el nombre de una
-- completada de un sub archivado no la cambia de equipo). Cambia la firma, así
-- que la de cuatro parámetros se borra: con las dos, un llamado de cuatro
-- argumentos sería ambiguo.
DROP FUNCTION IF EXISTS public.agenda_valida_del_departamento(uuid, uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.agenda_valida_del_departamento(
    p_dep uuid, p_sub uuid, p_carpeta uuid, p_prioridad uuid, p_sub_actual uuid DEFAULT NULL
) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT CASE
        WHEN p_sub IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.agenda_subdepartamentos WHERE id = p_sub AND departamento_id = p_dep)
            THEN 'sub_ajeno'
        WHEN p_sub IS NOT NULL AND p_sub IS DISTINCT FROM p_sub_actual AND EXISTS (
            SELECT 1 FROM public.agenda_subdepartamentos WHERE id = p_sub AND archivado_at IS NOT NULL)
            THEN 'archivado'
        WHEN p_carpeta IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.agenda_carpetas WHERE id = p_carpeta AND departamento_id = p_dep)
            THEN 'carpeta_ajena'
        WHEN p_prioridad IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.agenda_prioridades WHERE id = p_prioridad AND departamento_id = p_dep)
            THEN 'prioridad_ajena'
    END;
$$;

-- ── 4 · Las funciones que leen sub-departamentos, con el filtro ─────────────

CREATE OR REPLACE FUNCTION public.agenda_tarea_json(t public.agenda_tareas)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.agenda_mi_acceso()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.agenda_departamentos_admin()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF NOT public.agenda_es_super_admin() THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    RETURN jsonb_build_object('ok', true, 'departamentos', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                   'id', d.id, 'nombre', d.nombre, 'color', d.color, 'icono', d.icono,
                   'created_at', d.created_at,
                   'encargados', COALESCE((
                       SELECT jsonb_agg(public.agenda_persona(e.user_id) ORDER BY e.created_at)
                         FROM public.agenda_departamento_encargados e
                        WHERE e.departamento_id = d.id), '[]'::jsonb),
                   'cant_subdepartamentos', (SELECT count(*) FROM public.agenda_subdepartamentos s
                                              WHERE s.departamento_id = d.id AND s.archivado_at IS NULL),
                   -- Personas distintas: quien dirige y los miembros, una vez
                   -- cada una aunque esté en dos equipos.
                   'cant_miembros', (SELECT count(DISTINCT p.user_id) FROM (
                                         SELECT s.lider_id AS user_id FROM public.agenda_subdepartamentos s
                                          WHERE s.departamento_id = d.id AND s.lider_id IS NOT NULL AND s.archivado_at IS NULL
                                         UNION
                                         SELECT m.user_id FROM public.agenda_subdepartamento_miembros m
                                           JOIN public.agenda_subdepartamentos s ON s.id = m.subdepartamento_id
                                          WHERE s.departamento_id = d.id AND s.archivado_at IS NULL) p),
                   'cant_tareas', (SELECT count(*) FROM public.agenda_tareas t WHERE t.departamento_id = d.id))
               ORDER BY lower(d.nombre))
          FROM public.agenda_departamentos d), '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.agenda_departamento(p_dep uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.agenda_editar_tarea(
    p_id uuid, p_sub uuid, p_carpeta uuid, p_prioridad uuid,
    p_nombre text, p_detalles text, p_fecha date, p_todo_el_dia boolean,
    p_desde time, p_hasta time
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.agenda_guardar_subdepartamento(
    p_id uuid, p_dep uuid, p_nombre text, p_color text, p_lider uuid, p_miembros uuid[]
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_id uuid := COALESCE(p_id, gen_random_uuid());
    v_nombre text := btrim(COALESCE(p_nombre, ''));
    v_dep_actual uuid;
    v_archivado timestamptz;
    v_motivo text;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF NOT public.agenda_es_encargado(p_dep) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;
    v_motivo := public.agenda_valida_nombre_color(v_nombre, p_color);
    IF v_motivo IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', v_motivo);
    END IF;

    SELECT departamento_id, archivado_at INTO v_dep_actual, v_archivado
      FROM public.agenda_subdepartamentos WHERE id = v_id FOR UPDATE;
    IF FOUND THEN
        IF v_dep_actual <> p_dep THEN
            RETURN jsonb_build_object('ok', false, 'motivo', 'sub_ajeno');
        END IF;
        IF v_archivado IS NOT NULL THEN
            RETURN jsonb_build_object('ok', false, 'motivo', 'archivado');
        END IF;
        BEGIN
            UPDATE public.agenda_subdepartamentos
               SET nombre = v_nombre, color = p_color, updated_at = now()
             WHERE id = v_id;
        EXCEPTION WHEN unique_violation THEN
            RETURN jsonb_build_object('ok', false, 'motivo', 'nombre_duplicado');
        END;
        RETURN jsonb_build_object('ok', true, 'id', v_id, 'creado', false);
    END IF;

    IF p_lider IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'lider_requerido');
    END IF;
    IF public.agenda_faltan_usuarios(array_append(COALESCE(p_miembros, '{}'), p_lider)) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'usuario_inexistente');
    END IF;

    BEGIN
        INSERT INTO public.agenda_subdepartamentos (id, departamento_id, nombre, color, lider_id, created_by)
        VALUES (v_id, p_dep, v_nombre, p_color, p_lider, v_uid);
    EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'nombre_duplicado');
    END;

    -- Quien dirige no va como miembro: cuenta una sola vez.
    INSERT INTO public.agenda_subdepartamento_miembros (subdepartamento_id, user_id, agregado_por)
    SELECT DISTINCT v_id, x, v_uid FROM unnest(COALESCE(p_miembros, '{}')) x
     WHERE x IS NOT NULL AND x <> p_lider
    ON CONFLICT DO NOTHING;

    RETURN jsonb_build_object('ok', true, 'id', v_id, 'creado', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.agenda_agregar_miembros(p_sub uuid, p_users uuid[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    s public.agenda_subdepartamentos;
    v_agregados integer;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    SELECT * INTO s FROM public.agenda_subdepartamentos WHERE id = p_sub;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF NOT public.agenda_es_encargado(s.departamento_id) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;
    IF s.archivado_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'archivado');
    END IF;
    IF public.agenda_faltan_usuarios(p_users) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'usuario_inexistente');
    END IF;

    INSERT INTO public.agenda_subdepartamento_miembros (subdepartamento_id, user_id, agregado_por)
    SELECT DISTINCT p_sub, x, auth.uid() FROM unnest(COALESCE(p_users, '{}')) x
     WHERE x IS NOT NULL AND x IS DISTINCT FROM s.lider_id
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_agregados = ROW_COUNT;

    RETURN jsonb_build_object('ok', true, 'agregados', v_agregados);
END;
$$;

CREATE OR REPLACE FUNCTION public.agenda_quitar_miembro(p_sub uuid, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    s public.agenda_subdepartamentos;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    SELECT * INTO s FROM public.agenda_subdepartamentos WHERE id = p_sub;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF NOT public.agenda_es_encargado(s.departamento_id) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;
    IF s.archivado_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'archivado');
    END IF;
    IF p_user IS NOT DISTINCT FROM s.lider_id THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'es_quien_dirige');
    END IF;
    DELETE FROM public.agenda_subdepartamento_miembros
     WHERE subdepartamento_id = p_sub AND user_id = p_user;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_es_miembro');
    END IF;
    RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.agenda_mover_miembro(p_sub_origen uuid, p_sub_destino uuid, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    o public.agenda_subdepartamentos;
    d public.agenda_subdepartamentos;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    SELECT * INTO o FROM public.agenda_subdepartamentos WHERE id = p_sub_origen;
    SELECT * INTO d FROM public.agenda_subdepartamentos WHERE id = p_sub_destino;
    IF o.id IS NULL OR d.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF NOT public.agenda_es_encargado(o.departamento_id) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;
    IF d.departamento_id <> o.departamento_id THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sub_ajeno');
    END IF;
    IF o.archivado_at IS NOT NULL OR d.archivado_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'archivado');
    END IF;
    IF o.id = d.id THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'mismo_sub');
    END IF;
    IF p_user IS NOT DISTINCT FROM o.lider_id THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'es_quien_dirige');
    END IF;

    DELETE FROM public.agenda_subdepartamento_miembros
     WHERE subdepartamento_id = o.id AND user_id = p_user;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_es_miembro');
    END IF;
    IF p_user IS DISTINCT FROM d.lider_id THEN
        INSERT INTO public.agenda_subdepartamento_miembros (subdepartamento_id, user_id, agregado_por)
        VALUES (d.id, p_user, auth.uid())
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.agenda_cambiar_lider(p_sub uuid, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    s public.agenda_subdepartamentos;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    SELECT * INTO s FROM public.agenda_subdepartamentos WHERE id = p_sub FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF NOT public.agenda_es_encargado(s.departamento_id) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;
    IF s.archivado_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'archivado');
    END IF;
    IF p_user IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'lider_requerido');
    END IF;
    IF public.agenda_faltan_usuarios(ARRAY[p_user]) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'usuario_inexistente');
    END IF;
    IF p_user IS NOT DISTINCT FROM s.lider_id THEN
        RETURN jsonb_build_object('ok', true, 'sin_cambios', true);
    END IF;

    UPDATE public.agenda_subdepartamentos SET lider_id = p_user, updated_at = now() WHERE id = p_sub;
    DELETE FROM public.agenda_subdepartamento_miembros WHERE subdepartamento_id = p_sub AND user_id = p_user;
    IF s.lider_id IS NOT NULL THEN
        INSERT INTO public.agenda_subdepartamento_miembros (subdepartamento_id, user_id, agregado_por)
        VALUES (p_sub, s.lider_id, auth.uid())
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.agenda_subdepartamento(p_sub uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.agenda_tareas_subdepartamento(p_sub uuid, p_desde date, p_hasta date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.agenda_tarea(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.agenda_cambiar_estado_tarea(p_id uuid, p_estado text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
$$;

-- ── 5 · Archivar ─────────────────────────────────────────────────────────────
-- Archivar en vez de borrar. Lo que no estaba completado vuelve a
-- 'esperando' (sin equipo) para que el encargado lo asigne a otro; lo
-- completado queda como estaba, con su sub, porque es historial. Las filas de
-- miembros también quedan: dicen quién estaba en el equipo.
CREATE OR REPLACE FUNCTION public.agenda_archivar_subdepartamento(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
$$;

-- ── 6 · Borrar ya no: nadie de afuera la llama ─────────────────────────────
REVOKE EXECUTE ON FUNCTION public.agenda_eliminar_subdepartamento(uuid) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.agenda_eliminar_subdepartamento(uuid) IS
    'Agenda Origen: EN DESUSO desde sql/agenda_archivar_subdepartamentos.sql (los sub-departamentos se archivan con agenda_archivar_subdepartamento). Sin EXECUTE para authenticated; queda para el rollback.';

-- ── 7 · Permisos ────────────────────────────────────────────────────────────
-- CREATE OR REPLACE puede devolverle EXECUTE a PUBLIC (regla 12.3): se repasa
-- todo lo que se tocó.
REVOKE EXECUTE ON FUNCTION public.agenda_valida_del_departamento(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agenda_tarea_json(public.agenda_tareas) FROM PUBLIC, anon, authenticated;
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'agenda_mi_acceso()',
        'agenda_departamentos_admin()',
        'agenda_departamento(uuid)',
        'agenda_editar_tarea(uuid, uuid, uuid, uuid, text, text, date, boolean, time, time)',
        'agenda_guardar_subdepartamento(uuid, uuid, text, text, uuid, uuid[])',
        'agenda_agregar_miembros(uuid, uuid[])',
        'agenda_quitar_miembro(uuid, uuid)',
        'agenda_mover_miembro(uuid, uuid, uuid)',
        'agenda_cambiar_lider(uuid, uuid)',
        'agenda_subdepartamento(uuid)',
        'agenda_tareas_subdepartamento(uuid, date, date)',
        'agenda_tarea(uuid)',
        'agenda_cambiar_estado_tarea(uuid, text)',
        'agenda_archivar_subdepartamento(uuid)'
    ] LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
    END LOOP;
END;
$$;

COMMENT ON FUNCTION public.agenda_archivar_subdepartamento(uuid) IS
    'Agenda Origen: archiva un sub-departamento. Sus tareas no completadas pasan a esperando; las completadas y los miembros se conservan como historial. Encargado o SUPER_ADMIN.';
