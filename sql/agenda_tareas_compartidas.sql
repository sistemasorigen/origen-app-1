-- ═══════════════════════════════════════════════════════════════════════════
-- Agenda Origen · tareas compartidas entre sub-departamentos
-- 2026-11-04 · docs/superpowers/specs/2026-11-04-tareas-compartidas-design.md
-- ✅ APLICADO en producción el 2026-11-04.
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

    IF p_contexto IS NOT NULL
       AND (public.agenda_es_encargado(t.departamento_id) OR public.agenda_es_miembro(p_contexto)) THEN
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
                                     JOIN public.agenda_subdepartamentos s ON s.id = e.subdepartamento_id
                                    WHERE e.tarea_id = t.id AND s.archivado_at IS NULL
                                      AND public.agenda_es_miembro(e.subdepartamento_id)))));
$function$
;

-- ── 5 · El detalle ────────────────────────────────────────────────────────
DROP FUNCTION public.agenda_tarea(p_id uuid);
CREATE OR REPLACE FUNCTION public.agenda_tarea(p_id uuid, p_contexto uuid DEFAULT NULL::uuid)
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
        public.agenda_tarea_json(t, p_contexto) || jsonb_build_object(
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
    SELECT q.completada_por INTO v_quien FROM public.agenda_tarea_vista(t, p_contexto) q;
    RETURN jsonb_set(v_res, '{tarea}', (v_res->'tarea') || jsonb_build_object(
        'la_tienen', public.agenda_gente_de_tarea(t),
        'completada_por', public.agenda_persona(v_quien),
        'puede_cambiar_estado', v_encargado OR EXISTS (
            SELECT 1 FROM public.agenda_tarea_equipos e
             WHERE e.tarea_id = t.id AND e.finalizado_at IS NULL
               AND e.subdepartamento_id = ANY (
                   CASE WHEN p_contexto = ANY (public.agenda_mis_equipos_de_tarea(t.id)) THEN ARRAY[p_contexto]
                        ELSE public.agenda_mis_equipos_de_tarea(t.id) END))));
END;
$function$
;
REVOKE ALL ON FUNCTION public.agenda_tarea(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_tarea(uuid, uuid) TO authenticated;

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

-- ── 9 · Auxiliares de escritura ───────────────────────────────────────────
-- Deja el estado de la tarea de acuerdo con sus equipos. Sólo cuentan los que no
-- están archivados. Toma la fila primero: dos equipos que terminan a la vez
-- pasan de a uno, y uno solo la cierra.
CREATE FUNCTION public.agenda_recalcular_compartida(p_tarea uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    t public.agenda_tareas;
    v_cuentan integer;
    v_faltan integer;
    v_terminaron integer;
BEGIN
    SELECT * INTO t FROM public.agenda_tareas WHERE id = p_tarea FOR UPDATE;
    IF NOT FOUND OR NOT t.compartida THEN
        RETURN;
    END IF;
    SELECT count(*) FILTER (WHERE s.archivado_at IS NULL),
           count(*) FILTER (WHERE s.archivado_at IS NULL AND e.finalizado_at IS NULL),
           count(*) FILTER (WHERE e.finalizado_at IS NOT NULL)
      INTO v_cuentan, v_faltan, v_terminaron
      FROM public.agenda_tarea_equipos e
      JOIN public.agenda_subdepartamentos s ON s.id = e.subdepartamento_id
     WHERE e.tarea_id = p_tarea;

    IF v_faltan > 0 THEN
        IF t.estado <> 'en_proceso' THEN
            UPDATE public.agenda_tareas SET
                estado = 'en_proceso', completada_at = NULL, completada_por = NULL,
                asignada_at = COALESCE(asignada_at, now()), updated_at = now()
             WHERE id = p_tarea;
        END IF;
    ELSIF v_cuentan > 0 OR v_terminaron > 0 THEN
        IF t.estado <> 'completada' THEN
            UPDATE public.agenda_tareas SET
                estado = 'completada', completada_at = now(), completada_por = auth.uid(), updated_at = now()
             WHERE id = p_tarea;
        END IF;
    ELSIF t.estado <> 'completada' THEN
        -- Sin equipos que cuenten y nadie terminó: que el departamento asigne otros.
        UPDATE public.agenda_tareas SET
            estado = 'esperando', asignada_at = NULL, updated_at = now()
         WHERE id = p_tarea;
    END IF;
END;
$$;

-- Deja a la tarea con esos equipos. Los que siguen conservan lo que terminaron.
CREATE FUNCTION public.agenda_aplicar_equipos(p_tarea uuid, p_subs uuid[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    PERFORM 1 FROM public.agenda_tareas WHERE id = p_tarea FOR UPDATE;
    DELETE FROM public.agenda_tarea_equipos
     WHERE tarea_id = p_tarea AND NOT (subdepartamento_id = ANY (p_subs));
    INSERT INTO public.agenda_tarea_equipos (tarea_id, subdepartamento_id)
    SELECT p_tarea, q FROM unnest(p_subs) q
    ON CONFLICT (tarea_id, subdepartamento_id) DO NOTHING;
    PERFORM public.agenda_recalcular_compartida(p_tarea);
END;
$$;
REVOKE ALL ON FUNCTION public.agenda_recalcular_compartida(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_aplicar_equipos(uuid, uuid[]) FROM PUBLIC, anon, authenticated;

-- ── 10 · Finalizar y deshacer ─────────────────────────────────────────────
DROP FUNCTION public.agenda_cambiar_estado_tarea(p_id uuid, p_estado text);
CREATE OR REPLACE FUNCTION public.agenda_cambiar_estado_tarea(p_id uuid, p_estado text, p_sub uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    t public.agenda_tareas;
    v_encargado boolean;
    v_equipos uuid[];
    v_n integer;
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
    -- Compartida: lo que cambia es la parte de un equipo, no la tarea.
    IF t.compartida THEN
        v_encargado := public.agenda_es_encargado(t.departamento_id);
        IF p_sub IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM public.agenda_tarea_equipos
                            WHERE tarea_id = p_id AND subdepartamento_id = p_sub) THEN
                RETURN jsonb_build_object('ok', false, 'motivo', 'sub_ajeno');
            END IF;
            IF NOT (v_encargado OR public.agenda_es_miembro(p_sub)) THEN
                RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
            END IF;
            IF EXISTS (SELECT 1 FROM public.agenda_subdepartamentos
                        WHERE id = p_sub AND archivado_at IS NOT NULL) THEN
                RETURN jsonb_build_object('ok', false, 'motivo', 'archivado');
            END IF;
            v_equipos := ARRAY[p_sub];
        ELSIF v_encargado THEN
            -- El encargado siempre dice de qué equipo: no es "su" parte.
            RETURN jsonb_build_object('ok', false, 'motivo', 'sin_equipos');
        ELSE
            v_equipos := public.agenda_mis_equipos_de_tarea(p_id);
            IF cardinality(v_equipos) = 0 THEN
                RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
            END IF;
        END IF;

        IF p_estado = 'en_proceso' THEN
            IF NOT v_encargado THEN
                RETURN jsonb_build_object('ok', false, 'motivo', 'solo_el_departamento');
            END IF;
            UPDATE public.agenda_tarea_equipos SET finalizado_at = NULL, finalizado_por = NULL
             WHERE tarea_id = p_id AND subdepartamento_id = ANY (v_equipos) AND finalizado_at IS NOT NULL;
        ELSE
            UPDATE public.agenda_tarea_equipos SET finalizado_at = now(), finalizado_por = auth.uid()
             WHERE tarea_id = p_id AND subdepartamento_id = ANY (v_equipos) AND finalizado_at IS NULL;
        END IF;
        GET DIAGNOSTICS v_n = ROW_COUNT;
        IF v_n > 0 THEN
            PERFORM public.agenda_recalcular_compartida(p_id);
            SELECT * INTO t FROM public.agenda_tareas WHERE id = p_id;
        END IF;
        RETURN jsonb_build_object('ok', true, 'sin_cambios', v_n = 0, 'tarea', public.agenda_tarea_json(t, p_sub));
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
REVOKE ALL ON FUNCTION public.agenda_cambiar_estado_tarea(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_cambiar_estado_tarea(uuid, text, uuid) TO authenticated;

-- ── 11 · Reasignar ────────────────────────────────────────────────────────
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
    -- Los equipos de una compartida se cambian editándola.
    IF t.compartida THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'es_compartida');
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

-- ── 12 · Editar ───────────────────────────────────────────────────────────
DROP FUNCTION public.agenda_editar_tarea(p_id uuid, p_sub uuid, p_carpeta uuid, p_prioridad uuid, p_nombre text, p_detalles text, p_fecha date, p_todo_el_dia boolean, p_desde time without time zone, p_hasta time without time zone, p_fecha_hasta date, p_frecuencia text, p_alcance text);
CREATE OR REPLACE FUNCTION public.agenda_editar_tarea(p_id uuid, p_sub uuid, p_carpeta uuid, p_prioridad uuid, p_nombre text, p_detalles text, p_fecha date, p_todo_el_dia boolean, p_desde time without time zone, p_hasta time without time zone, p_fecha_hasta date DEFAULT NULL::date, p_frecuencia text DEFAULT NULL::text, p_alcance text DEFAULT 'solo_esta'::text, p_subs uuid[] DEFAULT NULL::uuid[])
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
    v_subs uuid[];
    v_equipo uuid;
    v_equipos uuid[];
    v_nueva uuid;
    v_una uuid;
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

    -- Una compartida no se vuelve común ni al revés. Sus equipos vienen en p_subs.
    IF (t.compartida AND p_sub IS NOT NULL) OR (NOT t.compartida AND p_subs IS NOT NULL) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'es_compartida');
    END IF;
    IF p_subs IS NOT NULL THEN
        SELECT array_agg(DISTINCT q) INTO v_subs FROM unnest(p_subs) q WHERE q IS NOT NULL;
        IF COALESCE(cardinality(v_subs), 0) = 0 THEN
            RETURN jsonb_build_object('ok', false, 'motivo', 'sin_equipos');
        END IF;
        FOREACH v_equipo IN ARRAY v_subs LOOP
            -- Un equipo que ya está se puede conservar aunque esté archivado.
            v_motivo := public.agenda_valida_del_departamento(t.departamento_id, v_equipo, NULL, NULL,
                (SELECT e.subdepartamento_id FROM public.agenda_tarea_equipos e
                  WHERE e.tarea_id = p_id AND e.subdepartamento_id = v_equipo));
            IF v_motivo IS NOT NULL THEN
                RETURN jsonb_build_object('ok', false, 'motivo', v_motivo);
            END IF;
        END LOOP;
        IF t.estado = 'completada'
           AND v_subs IS DISTINCT FROM (SELECT array_agg(e.subdepartamento_id ORDER BY e.subdepartamento_id)
                                          FROM public.agenda_tarea_equipos e WHERE e.tarea_id = p_id) THEN
            RETURN jsonb_build_object('ok', false, 'motivo', 'completada');
        END IF;
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
            estado = CASE WHEN compartida THEN estado
                          WHEN p_sub IS NULL THEN 'esperando'
                          WHEN v_cambia_sub THEN 'en_proceso'
                          ELSE estado END,
            asignada_at = CASE WHEN compartida THEN asignada_at
                               WHEN p_sub IS NULL THEN NULL
                               WHEN v_cambia_sub THEN now()
                               ELSE asignada_at END,
            updated_at = now()
         WHERE id = p_id
        RETURNING * INTO t;

        IF v_subs IS NOT NULL THEN
            PERFORM public.agenda_aplicar_equipos(p_id, v_subs);
            SELECT * INTO t FROM public.agenda_tareas WHERE id = p_id;
        END IF;

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
        -- Antes de borrar: las repeticiones nuevas llevan los mismos equipos.
        SELECT array_agg(q.id) INTO v_equipos
          FROM public.agenda_subdepartamentos q
         WHERE q.archivado_at IS NULL
           AND q.id = ANY (COALESCE(v_subs, (SELECT array_agg(e.subdepartamento_id)
                                               FROM public.agenda_tarea_equipos e WHERE e.tarea_id = p_id)));

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
                estado, asignada_at, created_by, serie_id, numero_en_serie, compartida)
            VALUES (
                t.departamento_id, p_sub, p_carpeta, p_prioridad,
                btrim(p_nombre), NULLIF(btrim(COALESCE(p_detalles, '')), ''), v_fecha, v_todo,
                CASE WHEN v_todo THEN NULL ELSE p_desde END,
                CASE WHEN v_todo THEN NULL ELSE p_hasta END,
                CASE WHEN p_sub IS NULL AND NOT t.compartida THEN 'esperando' ELSE 'en_proceso' END,
                CASE WHEN p_sub IS NULL AND NOT t.compartida THEN NULL ELSE now() END,
                auth.uid(), s.id,
                -- Provisorio: agenda_serie_renumerar deja los definitivos.
                1000000 + (v_fecha - s.desde), t.compartida)
            RETURNING id INTO v_nueva;
            IF t.compartida THEN
                INSERT INTO public.agenda_tarea_equipos (tarea_id, subdepartamento_id)
                SELECT v_nueva, q FROM unnest(v_equipos) q;
                PERFORM public.agenda_recalcular_compartida(v_nueva);
            END IF;
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
        estado = CASE WHEN compartida THEN estado
                      WHEN p_sub IS NULL THEN 'esperando'
                      WHEN p_sub IS DISTINCT FROM subdepartamento_id THEN 'en_proceso'
                      ELSE estado END,
        asignada_at = CASE WHEN compartida THEN asignada_at
                           WHEN p_sub IS NULL THEN NULL
                           WHEN p_sub IS DISTINCT FROM subdepartamento_id THEN now()
                           ELSE asignada_at END,
        updated_at = now()
     WHERE id IN (SELECT id FROM public.agenda_serie_pendientes(s.id));

    IF v_subs IS NOT NULL THEN
        FOR v_una IN SELECT id FROM public.agenda_serie_pendientes(s.id) LOOP
            PERFORM public.agenda_aplicar_equipos(v_una, v_subs);
        END LOOP;
    END IF;

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
REVOKE ALL ON FUNCTION public.agenda_editar_tarea(uuid, uuid, uuid, uuid, text, text, date, boolean, time, time, date, text, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_editar_tarea(uuid, uuid, uuid, uuid, text, text, date, boolean, time, time, date, text, text, uuid[]) TO authenticated;

-- ── 13 · El aviso nuevo ───────────────────────────────────────────────────
-- `tipo` también dice de qué equipo: terminó A y terminó B son dos avisos.
ALTER TABLE public.agenda_avisos DROP CONSTRAINT agenda_avisos_tipo_check;
ALTER TABLE public.agenda_avisos ADD CONSTRAINT agenda_avisos_tipo_check CHECK (
    tipo IN ('asignada', 'completada') OR tipo LIKE 'equipo\_termino:%'
);

INSERT INTO public.notif_alertas
    (clave, tipo, nombre, descripcion_evento, destinatario_texto, variables,
     titulo_plantilla, mensaje_plantilla, url_plantilla, type_legacy,
     permite_apagar, nombre_publico, descripcion_publica, area)
VALUES
    ('agenda_tarea_equipo_termino', 'automatica',
     'Un equipo terminó su parte (Agenda)',
     'un equipo termina su parte de una tarea compartida y todavía falta otro',
     'Los encargados del departamento, menos quien dio el finalizado',
     ARRAY['tarea', 'subdepartamento', 'pendientes'],
     'Terminó {subdepartamento}: {tarea}',
     'Falta: {pendientes}',
     '/agenda', 'AGENDA_TAREA_EQUIPO_TERMINO',
     true, 'Avance de tareas compartidas',
     'Cuando un equipo termina su parte de una tarea compartida de un departamento que encargás.',
     'Agenda');
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
        'pedido', 'la baja',
        'pendientes', 'Sonido y Video');
$function$
;

-- ── 14 · Auxiliares de los avisos ─────────────────────────────────────────
-- "Equipo A y Equipo B". Con p_faltan, sólo los que no terminaron y cuentan.
CREATE FUNCTION public.agenda_nombres_de_equipos(p_tarea uuid, p_faltan boolean DEFAULT false)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    WITH n AS (
        SELECT array_agg(s.nombre ORDER BY lower(s.nombre)) AS l
          FROM public.agenda_tarea_equipos e
          JOIN public.agenda_subdepartamentos s ON s.id = e.subdepartamento_id
         WHERE e.tarea_id = p_tarea
           AND (NOT p_faltan OR (e.finalizado_at IS NULL AND s.archivado_at IS NULL))
    )
    SELECT CASE WHEN cardinality(l) = 1 THEN l[1]
                WHEN cardinality(l) > 1 THEN array_to_string(l[1:cardinality(l) - 1], ', ') || ' y ' || l[cardinality(l)]
           END
      FROM n;
$$;

-- Quien dirige un equipo y sus miembros, sin los encargados del departamento.
CREATE FUNCTION public.agenda_gente_de_equipo(p_dep uuid, p_sub uuid)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT array_agg(DISTINCT x.uid)
      FROM (SELECT s.lider_id AS uid FROM public.agenda_subdepartamentos s
             WHERE s.id = p_sub AND s.lider_id IS NOT NULL
            UNION
            SELECT m.user_id FROM public.agenda_subdepartamento_miembros m
             WHERE m.subdepartamento_id = p_sub) x
      JOIN public.users u ON u.id = x.uid AND u.is_active IS NOT FALSE
     WHERE NOT EXISTS (SELECT 1 FROM public.agenda_departamento_encargados e
                        WHERE e.departamento_id = p_dep AND e.user_id = x.uid);
$$;

-- Avisa a un equipo que le toca esta tarea.
CREATE FUNCTION public.agenda_avisar_equipo(t public.agenda_tareas, p_sub uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_cuando jsonb := public.agenda_cuando_json(t);
BEGIN
    RETURN public.agenda_registrar_avisos(
        t.id, 'asignada', public.agenda_gente_de_equipo(t.departamento_id, p_sub), 'agenda_tarea_asignada',
        jsonb_build_object(
            'tarea', t.nombre,
            'subdepartamento', COALESCE((SELECT nombre FROM public.agenda_subdepartamentos WHERE id = p_sub), 'Tu equipo'),
            'fecha', v_cuando->>'fecha',
            'horario', v_cuando->>'horario'));
END;
$$;

CREATE FUNCTION public.agenda_tarea_equipos_avisar()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    t public.agenda_tareas;
    v_faltan text;
    v_users uuid[];
BEGIN
    SELECT * INTO t FROM public.agenda_tareas WHERE id = NEW.tarea_id;

    IF TG_OP = 'INSERT' THEN
        -- La serie avisa una sola vez, desde la RPC que la armó.
        IF COALESCE(current_setting('agenda.serie_en_lote', true), '') <> '1' THEN
            PERFORM public.agenda_avisar_equipo(t, NEW.subdepartamento_id);
        END IF;
        RETURN NULL;
    END IF;

    -- Terminó un equipo. Si era el último, avisa la tarea completada: dos avisos
    -- por el mismo hecho serían ruido.
    IF NEW.finalizado_at IS NOT NULL AND OLD.finalizado_at IS NULL THEN
        v_faltan := public.agenda_nombres_de_equipos(t.id, true);
        IF v_faltan IS NOT NULL THEN
            SELECT array_agg(e.user_id) INTO v_users
              FROM public.agenda_departamento_encargados e
              JOIN public.users u ON u.id = e.user_id AND u.is_active IS NOT FALSE
             WHERE e.departamento_id = t.departamento_id
               AND e.user_id IS DISTINCT FROM COALESCE(auth.uid(), NEW.finalizado_por);
            PERFORM public.agenda_registrar_avisos(
                t.id, 'equipo_termino:' || NEW.subdepartamento_id, v_users, 'agenda_tarea_equipo_termino',
                jsonb_build_object(
                    'tarea', t.nombre,
                    'subdepartamento', (SELECT nombre FROM public.agenda_subdepartamentos WHERE id = NEW.subdepartamento_id),
                    'pendientes', v_faltan));
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_agenda_tarea_equipos_avisar
    AFTER INSERT OR UPDATE OF finalizado_at ON public.agenda_tarea_equipos
    FOR EACH ROW EXECUTE FUNCTION public.agenda_tarea_equipos_avisar();
REVOKE ALL ON FUNCTION public.agenda_nombres_de_equipos(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_gente_de_equipo(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_avisar_equipo(public.agenda_tareas, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_tarea_equipos_avisar() FROM PUBLIC, anon, authenticated;

-- ── 15 · Avisos de la tarea ───────────────────────────────────────────────
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
    -- Una compartida no tiene un equipo: los nombra a todos. Su "asignada" sale
    -- del trigger de agenda_tarea_equipos.
    IF NEW.compartida THEN
        v_sub_nombre := public.agenda_nombres_de_equipos(NEW.id);
    END IF;

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

-- ── 16 · El aviso de una serie ────────────────────────────────────────────
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
    v_n integer;
BEGIN
    SELECT * INTO t FROM public.agenda_tareas WHERE id = p_tarea;
    IF FOUND AND t.compartida THEN
        -- Un aviso por persona y por tarea: quien está en dos equipos recibe uno.
        SELECT COALESCE(sum(public.agenda_avisar_equipo(t, e.subdepartamento_id)), 0)::integer INTO v_n
          FROM public.agenda_tarea_equipos e
          JOIN public.agenda_subdepartamentos s ON s.id = e.subdepartamento_id
         WHERE e.tarea_id = t.id AND s.archivado_at IS NULL;
        RETURN v_n;
    END IF;
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

-- ── 17 · Plazos vencidos ──────────────────────────────────────────────────
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
        SELECT x.id, x.nombre, x.departamento_id, x.subdepartamento_id, x.fecha_hasta, x.compartida
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
        -- En una compartida, los que todavía no terminaron.
        IF t.compartida THEN
            v_sub := public.agenda_nombres_de_equipos(t.id, true);
        END IF;
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

-- ── 18 · Los contadores ───────────────────────────────────────────────────
-- Lo que le queda a un equipo de sus tareas compartidas.
CREATE FUNCTION public.agenda_partes_pendientes(p_sub uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT count(*)::integer
      FROM public.agenda_tarea_equipos e
      JOIN public.agenda_tareas t ON t.id = e.tarea_id
     WHERE e.subdepartamento_id = p_sub AND e.finalizado_at IS NULL AND t.estado = 'en_proceso';
$$;
REVOKE ALL ON FUNCTION public.agenda_partes_pendientes(uuid) FROM PUBLIC, anon, authenticated;

-- ── 19 · El panel de un equipo ────────────────────────────────────────────
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
                            WHERE t.subdepartamento_id = s.id AND t.estado = 'en_proceso')
                          + public.agenda_partes_pendientes(s.id),
            'completadas_mes', (SELECT count(*) FROM public.agenda_tareas t
                                 WHERE t.subdepartamento_id = s.id AND t.estado = 'completada'
                                   AND (t.completada_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
                                       >= date_trunc('month', v_hoy)::date)
                               + (SELECT count(*) FROM public.agenda_tarea_equipos e
                                   WHERE e.subdepartamento_id = s.id AND e.finalizado_at IS NOT NULL
                                     AND (e.finalizado_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
                                         >= date_trunc('month', v_hoy)::date),
            'para_hoy', (SELECT count(*) FROM public.agenda_tareas t
                          WHERE t.subdepartamento_id = s.id AND t.fecha = v_hoy
                            AND t.estado <> 'completada')
                        + (SELECT count(*) FROM public.agenda_tarea_equipos e
                             JOIN public.agenda_tareas t ON t.id = e.tarea_id
                            WHERE e.subdepartamento_id = s.id AND e.finalizado_at IS NULL
                              AND t.fecha = v_hoy AND t.estado <> 'completada'))
    );
END;
$function$
;

-- ── 20 · Los equipos de un departamento ───────────────────────────────────
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
                                       WHERE t.subdepartamento_id = s.id AND t.estado = 'en_proceso')
                                     + public.agenda_partes_pendientes(s.id))
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

-- ── 21 · Mi acceso ────────────────────────────────────────────────────────
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
                                       WHERE t.subdepartamento_id = s.id AND t.estado = 'en_proceso')
                                     + public.agenda_partes_pendientes(s.id))
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

-- ── 22 · Archivar un equipo ───────────────────────────────────────────────
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
    v_tarea uuid;
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

    -- En una compartida, este equipo deja de contar para completarla.
    FOR v_tarea IN SELECT tarea_id FROM public.agenda_tarea_equipos WHERE subdepartamento_id = p_id LOOP
        PERFORM public.agenda_recalcular_compartida(v_tarea);
    END LOOP;

    RETURN jsonb_build_object('ok', true, 'id', p_id,
                              'tareas_a_esperando', v_a_esperando,
                              'completadas_conservadas', v_conservadas);
END;
$function$
;

-- ── 23 · Eliminar un equipo ───────────────────────────────────────────────
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
    v_compartidas uuid[];
    v_tarea uuid;
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

    -- Se calculan después de borrar: su fila de equipos se va por cascada.
    SELECT array_agg(tarea_id) INTO v_compartidas FROM public.agenda_tarea_equipos WHERE subdepartamento_id = p_id;

    DELETE FROM public.agenda_subdepartamentos WHERE id = p_id;

    FOREACH v_tarea IN ARRAY COALESCE(v_compartidas, '{}'::uuid[]) LOOP
        PERFORM public.agenda_recalcular_compartida(v_tarea);
    END LOOP;

    RETURN jsonb_build_object('ok', true, 'id', p_id,
                              'pasaron_a_esperando', v_esperando,
                              'completadas_borradas', v_completadas);
END;
$function$
;

-- ── 24 · Que la API vea las firmas nuevas ─────────────────────────────────
NOTIFY pgrst, 'reload schema';

COMMIT;
