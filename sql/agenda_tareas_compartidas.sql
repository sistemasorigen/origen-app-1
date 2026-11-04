-- ═══════════════════════════════════════════════════════════════════════════
-- Agenda Origen · tareas compartidas entre sub-departamentos
-- 2026-11-04 · docs/superpowers/specs/2026-11-04-tareas-compartidas-design.md
--
-- Una tarea compartida es UNA fila de agenda_tareas, con `compartida` en true y
-- `subdepartamento_id` NULL. Sus equipos y lo que terminó cada uno viven en
-- agenda_tarea_equipos. Se completa cuando terminaron todos los equipos que no
-- están archivados.
--
-- Lo que ve cada uno lo arma agenda_tarea_json:
--   · el integrante recibe SU equipo y el estado de SU equipo, sin los otros;
--   · el encargado recibe el estado de la tarea entera y la lista `equipos`.
--
-- Compatible con el front ya publicado: los parámetros nuevos son opcionales y
-- una tarea no compartida responde igual, más `compartida: false, equipos: null`.
-- Pruebas: sql/PROBAR_agenda_tareas_compartidas.sql. Vuelta atrás:
-- sql/ROLLBACK_agenda_tareas_compartidas.sql.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1 · El modelo ─────────────────────────────────────────────────────────
ALTER TABLE public.agenda_tareas ADD COLUMN compartida boolean NOT NULL DEFAULT false;

-- Completar era cosa de UN equipo. En una compartida lo deciden sus equipos.
ALTER TABLE public.agenda_tareas DROP CONSTRAINT agenda_tareas_completada_ck;
ALTER TABLE public.agenda_tareas ADD CONSTRAINT agenda_tareas_completada_ck CHECK (
    estado <> 'completada' OR subdepartamento_id IS NOT NULL OR compartida
);
-- Los equipos de una compartida están en la tabla nueva: si además hubiera uno
-- en esta columna, cada consulta que filtra por ella contaría una historia aparte.
ALTER TABLE public.agenda_tareas ADD CONSTRAINT agenda_tareas_compartida_ck CHECK (
    NOT compartida OR subdepartamento_id IS NULL
);

CREATE TABLE public.agenda_tarea_equipos (
    tarea_id            uuid NOT NULL REFERENCES public.agenda_tareas(id) ON DELETE CASCADE,
    subdepartamento_id  uuid NOT NULL REFERENCES public.agenda_subdepartamentos(id) ON DELETE CASCADE,
    finalizado_at       timestamptz,
    finalizado_por      uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tarea_id, subdepartamento_id)
);
CREATE INDEX agenda_tarea_equipos_sub_idx ON public.agenda_tarea_equipos (subdepartamento_id, finalizado_at);
-- Como el resto de las tareas: nadie la toca de afuera, sólo las RPC.
ALTER TABLE public.agenda_tarea_equipos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agenda_tarea_equipos FROM PUBLIC, anon, authenticated;

-- ── 2 · Auxiliares de lectura ─────────────────────────────────────────────
-- Los equipos de quien llama en esa tarea, sin los archivados.
CREATE FUNCTION public.agenda_mis_equipos_de_tarea(p_tarea uuid)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT COALESCE(array_agg(e.subdepartamento_id ORDER BY lower(s.nombre)), '{}'::uuid[])
      FROM public.agenda_tarea_equipos e
      JOIN public.agenda_subdepartamentos s ON s.id = e.subdepartamento_id
     WHERE e.tarea_id = p_tarea
       AND s.archivado_at IS NULL
       AND public.agenda_es_miembro(s.id);
$$;

-- Cómo ve la tarea quien llama. Con p_contexto (el panel de un equipo), como la
-- ve ese equipo. Un encargado sin contexto ve la tarea entera; un integrante, la
-- de su equipo, y si está en dos, la del que le falta terminar.
CREATE FUNCTION public.agenda_tarea_vista(t public.agenda_tareas, p_contexto uuid DEFAULT NULL)
RETURNS TABLE (sub uuid, estado text, completada_at timestamptz, completada_por uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_sub uuid;
    e public.agenda_tarea_equipos;
BEGIN
    IF NOT t.compartida THEN
        RETURN QUERY SELECT t.subdepartamento_id, t.estado, t.completada_at, t.completada_por;
        RETURN;
    END IF;

    IF p_contexto IS NOT NULL THEN
        SELECT * INTO e FROM public.agenda_tarea_equipos q
         WHERE q.tarea_id = t.id AND q.subdepartamento_id = p_contexto;
    ELSIF NOT public.agenda_es_encargado(t.departamento_id) THEN
        SELECT * INTO e FROM public.agenda_tarea_equipos q
         WHERE q.tarea_id = t.id
           AND q.subdepartamento_id = ANY (public.agenda_mis_equipos_de_tarea(t.id))
         ORDER BY q.finalizado_at IS NOT NULL, q.created_at, q.subdepartamento_id
         LIMIT 1;
    END IF;
    v_sub := e.subdepartamento_id;

    IF v_sub IS NULL THEN
        RETURN QUERY SELECT NULL::uuid, t.estado, t.completada_at, t.completada_por;
        RETURN;
    END IF;
    RETURN QUERY SELECT v_sub,
        CASE WHEN e.finalizado_at IS NOT NULL OR t.estado = 'completada' THEN 'completada' ELSE 'en_proceso' END,
        COALESCE(e.finalizado_at, t.completada_at),
        COALESCE(e.finalizado_por, t.completada_por);
END;
$$;

-- La gente que tiene la tarea: para el encargado, la de todos los equipos; para
-- un integrante, la de los suyos. Quien está en dos equipos aparece una vez.
CREATE FUNCTION public.agenda_gente_de_tarea(t public.agenda_tareas)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    WITH equipos AS (
        SELECT e.subdepartamento_id AS sub
          FROM public.agenda_tarea_equipos e
          JOIN public.agenda_subdepartamentos s ON s.id = e.subdepartamento_id
         WHERE e.tarea_id = t.id AND s.archivado_at IS NULL
           AND (public.agenda_es_encargado(t.departamento_id) OR public.agenda_es_miembro(s.id))
    ), gente AS (
        SELECT s.lider_id AS uid, true AS dirige
          FROM public.agenda_subdepartamentos s JOIN equipos q ON q.sub = s.id
         WHERE s.lider_id IS NOT NULL
        UNION ALL
        SELECT m.user_id, false
          FROM public.agenda_subdepartamento_miembros m JOIN equipos q ON q.sub = m.subdepartamento_id
    ), una_vez AS (
        SELECT DISTINCT ON (g.uid) g.uid, g.dirige, public.agenda_persona(g.uid) AS p
          FROM gente g ORDER BY g.uid, g.dirige DESC
    )
    SELECT COALESCE(jsonb_agg(u.p || jsonb_build_object('dirige', u.dirige)
                              ORDER BY u.dirige DESC, u.p->>'nombre'), '[]'::jsonb)
      FROM una_vez u WHERE u.p IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.agenda_mis_equipos_de_tarea(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_tarea_vista(public.agenda_tareas, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_gente_de_tarea(public.agenda_tareas) FROM PUBLIC, anon, authenticated;

-- ── 3 · La tarea en JSON, según quién mira ────────────────────────────────
DROP FUNCTION public.agenda_tarea_json(t agenda_tareas);
CREATE OR REPLACE FUNCTION public.agenda_tarea_json(t agenda_tareas, p_contexto uuid DEFAULT NULL::uuid)
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
                              FROM public.agenda_subdepartamentos s WHERE s.id = v.sub),
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
        'estado', v.estado,
        'compartida', t.compartida,
        -- El avance es sólo para el encargado: un integrante no ve a los otros equipos.
        'equipos', CASE WHEN t.compartida AND public.agenda_es_encargado(t.departamento_id) THEN COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                       'id', s.id, 'nombre', s.nombre, 'color', s.color,
                       'archivado', s.archivado_at IS NOT NULL,
                       'finalizado_at', e.finalizado_at,
                       'finalizado_por', public.agenda_persona(e.finalizado_por))
                   ORDER BY lower(s.nombre))
              FROM public.agenda_tarea_equipos e
              JOIN public.agenda_subdepartamentos s ON s.id = e.subdepartamento_id
             WHERE e.tarea_id = t.id), '[]'::jsonb) END,
        -- Días que faltan hasta el último día de la tarea. Negativo si ya pasó.
        'dias_restantes', COALESCE(t.fecha_hasta, t.fecha) - public.agenda_hoy(),
        'vencida', v.estado <> 'completada'
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
        'completada_at', v.completada_at,
        'created_at', t.created_at,
        'updated_at', t.updated_at,
        'creador', (SELECT jsonb_build_object('id', u.id, 'nombre', u.name)
                      FROM public.users u WHERE u.id = t.created_by),
        'solicitud', (SELECT jsonb_build_object(
                                'id', r.id, 'numero', r.numero, 'created_at', r.created_at,
                                'prioridad_nombre', r.prioridad_nombre,
                                'solicitante', public.agenda_persona(r.solicitante_id))
                        FROM public.agenda_solicitudes r WHERE r.id = t.solicitud_id)
    )
      FROM public.agenda_tarea_vista(t, p_contexto) v;
$function$
;
REVOKE ALL ON FUNCTION public.agenda_tarea_json(public.agenda_tareas, uuid) FROM PUBLIC, anon, authenticated;

-- ── 4 · Quién la ve ───────────────────────────────────────────────────────
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
                               AND public.agenda_es_miembro(t.subdepartamento_id))
                           OR (t.compartida AND EXISTS (
                                   SELECT 1 FROM public.agenda_tarea_equipos e
                                    WHERE e.tarea_id = t.id
                                      AND public.agenda_es_miembro(e.subdepartamento_id)))));
$function$
;

-- ── 5 · El detalle ────────────────────────────────────────────────────────
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
    v_res jsonb;
    v_quien uuid;
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

    v_res := jsonb_build_object('ok', true, 'tarea',
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
    IF NOT t.compartida THEN
        RETURN v_res;
    END IF;

    -- Una compartida: la gente y lo que puede hacer dependen de quién mira. Un
    -- integrante con su parte terminada ya no tiene nada para cambiar: deshacer
    -- es del departamento.
    SELECT q.completada_por INTO v_quien FROM public.agenda_tarea_vista(t) q;
    RETURN jsonb_set(v_res, '{tarea}', (v_res->'tarea') || jsonb_build_object(
        'la_tienen', public.agenda_gente_de_tarea(t),
        'completada_por', public.agenda_persona(v_quien),
        'puede_cambiar_estado', v_encargado OR EXISTS (
            SELECT 1 FROM public.agenda_tarea_equipos e
             WHERE e.tarea_id = t.id AND e.finalizado_at IS NULL
               AND e.subdepartamento_id = ANY (public.agenda_mis_equipos_de_tarea(t.id)))));
END;
$function$
;

-- ── 6 · Mis tareas ────────────────────────────────────────────────────────
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
                -- Una compartida sale de la Agenda de quien ya terminó su parte.
                OR (t.compartida AND EXISTS (
                        SELECT 1 FROM public.agenda_tarea_equipos e
                          JOIN public.agenda_subdepartamentos s ON s.id = e.subdepartamento_id
                         WHERE e.tarea_id = t.id AND e.finalizado_at IS NULL AND s.archivado_at IS NULL
                           AND (s.lider_id = v_uid
                                OR EXISTS (SELECT 1 FROM public.agenda_subdepartamento_miembros m
                                            WHERE m.subdepartamento_id = s.id AND m.user_id = v_uid))))
                OR (v_todo AND (v_super
                                OR EXISTS (SELECT 1 FROM public.agenda_departamento_encargados e
                                            WHERE e.departamento_id = t.departamento_id
                                              AND e.user_id = v_uid)))
           )), '[]'::jsonb));
END;
$function$
;

-- ── 7 · Las tareas de un equipo ───────────────────────────────────────────
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
        SELECT jsonb_agg(public.agenda_tarea_json(t, p_sub)
                         ORDER BY t.fecha, t.todo_el_dia DESC, t.hora_desde, t.created_at)
          FROM public.agenda_tareas t
         WHERE (t.subdepartamento_id = p_sub
                OR (t.compartida AND EXISTS (SELECT 1 FROM public.agenda_tarea_equipos e
                                              WHERE e.tarea_id = t.id AND e.subdepartamento_id = p_sub)))
           AND t.fecha <= p_hasta
           AND COALESCE(t.fecha_hasta, t.fecha) >= p_desde), '[]'::jsonb));
END;
$function$
;

-- ── 8 · Crear ─────────────────────────────────────────────────────────────
DROP FUNCTION public.agenda_crear_tarea(p_id uuid, p_dep uuid, p_sub uuid, p_carpeta uuid, p_prioridad uuid, p_nombre text, p_detalles text, p_fecha date, p_todo_el_dia boolean, p_desde time without time zone, p_hasta time without time zone, p_solicitud uuid, p_fecha_hasta date, p_frecuencia text);
CREATE OR REPLACE FUNCTION public.agenda_crear_tarea(p_id uuid, p_dep uuid, p_sub uuid, p_carpeta uuid, p_prioridad uuid, p_nombre text, p_detalles text, p_fecha date, p_todo_el_dia boolean, p_desde time without time zone, p_hasta time without time zone, p_solicitud uuid DEFAULT NULL::uuid, p_fecha_hasta date DEFAULT NULL::date, p_frecuencia text DEFAULT NULL::text, p_subs uuid[] DEFAULT NULL::uuid[])
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
    v_subs uuid[];
    v_equipo uuid;
    v_compartida boolean := false;
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

    -- Compartida: al menos dos equipos distintos, todos válidos.
    IF p_subs IS NOT NULL THEN
        SELECT array_agg(DISTINCT q) INTO v_subs FROM unnest(p_subs) q WHERE q IS NOT NULL;
        IF p_sub IS NOT NULL OR COALESCE(cardinality(v_subs), 0) < 2 THEN
            RETURN jsonb_build_object('ok', false, 'motivo', 'compartida_minimo');
        END IF;
        FOREACH v_equipo IN ARRAY v_subs LOOP
            v_motivo := public.agenda_valida_del_departamento(p_dep, v_equipo, NULL, NULL);
            IF v_motivo IS NOT NULL THEN
                RETURN jsonb_build_object('ok', false, 'motivo', v_motivo);
            END IF;
        END LOOP;
        v_compartida := true;
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
                estado, asignada_at, created_by, serie_id, numero_en_serie, compartida)
            VALUES (
                p_dep, p_sub, p_carpeta, p_prioridad,
                CASE WHEN v_n = 1 THEN p_solicitud ELSE NULL END,
                btrim(p_nombre), NULLIF(btrim(COALESCE(p_detalles, '')), ''), v_fecha, v_todo,
                CASE WHEN v_todo THEN NULL ELSE p_desde END,
                CASE WHEN v_todo THEN NULL ELSE p_hasta END,
                CASE WHEN p_sub IS NULL AND NOT v_compartida THEN 'esperando' ELSE 'en_proceso' END,
                CASE WHEN p_sub IS NULL AND NOT v_compartida THEN NULL ELSE now() END,
                v_uid, v_serie.id, v_n, v_compartida)
            RETURNING * INTO v_tarea;
            IF v_compartida THEN
                INSERT INTO public.agenda_tarea_equipos (tarea_id, subdepartamento_id)
                SELECT v_tarea.id, q FROM unnest(v_subs) q;
            END IF;
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
        estado, asignada_at, created_by, compartida)
    VALUES (
        p_id, p_dep, p_sub, p_carpeta, p_prioridad, p_solicitud,
        btrim(p_nombre), NULLIF(btrim(COALESCE(p_detalles, '')), ''), p_fecha, p_fecha_hasta, v_todo,
        CASE WHEN v_todo THEN NULL ELSE p_desde END,
        CASE WHEN v_todo THEN NULL ELSE p_hasta END,
        CASE WHEN p_sub IS NULL AND NOT v_compartida THEN 'esperando' ELSE 'en_proceso' END,
        CASE WHEN p_sub IS NULL AND NOT v_compartida THEN NULL ELSE now() END,
        v_uid, v_compartida)
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

    IF v_compartida THEN
        INSERT INTO public.agenda_tarea_equipos (tarea_id, subdepartamento_id)
        SELECT v_tarea.id, q FROM unnest(v_subs) q;
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
REVOKE ALL ON FUNCTION public.agenda_crear_tarea(uuid, uuid, uuid, uuid, uuid, text, text, date, boolean, time, time, uuid, date, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_crear_tarea(uuid, uuid, uuid, uuid, uuid, text, text, date, boolean, time, time, uuid, date, text, uuid[]) TO authenticated;

COMMIT;
