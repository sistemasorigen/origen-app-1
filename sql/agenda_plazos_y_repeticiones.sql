-- ════════════════════════════════════════════════════════════════════════════
-- Agenda Origen · tareas con plazo y tareas que se repiten
-- 2026-11-03 · prompt 1 de 2 (la base; las pantallas van en el prompt 2)
--
-- HASTA HOY una tarea era de UN día: `fecha`, todo el día o con horario.
-- Se suman dos formas más, sin tocar la primera:
--
--   1 · DE UN DÍA — igual que siempre. `fecha_hasta` NULL y sin serie. Las que
--       ya existen quedan exactamente como están, y nunca se marcan vencidas.
--   2 · CON PLAZO — `fecha` (desde) y `fecha_hasta` (hasta). UNA tarea que se
--       completa cualquier día del plazo y que se ve en todos los días que
--       abarca. Siempre todo el día: un horario no significaría nada repartido
--       en seis semanas.
--   3 · CON PLAZO Y REPETICIÓN — una fila en `agenda_series` guarda el plazo,
--       la frecuencia y el horario, y las repeticiones son TAREAS DE UN DÍA de
--       `agenda_tareas`, con su estado propio. Se completan por separado.
--
-- POR QUÉ LAS REPETICIONES SON FILAS. Es la decisión que sostiene todo lo
-- demás: la Agenda, los paneles, los permisos, los contadores, el completar,
-- los avisos y las pruebas que ya existen siguen funcionando sin enterarse de
-- que hay series. Si una repetición fuera algo calculado al vuelo, cada una de
-- esas pantallas tendría que aprender a expandirla, y no habría dónde guardar
-- que la del martes está hecha y la del jueves no.
--
-- LO QUE SE AGREGA
--   · `agenda_series` y tres columnas en `agenda_tareas`.
--   · `agenda_serie_fechas` — los días exactos de una frecuencia. UNA sola
--     fuente: la usan la validación, la creación y el recálculo.
--   · `agenda_repeticiones_posibles(desde, hasta)` — qué opciones entran en
--     ese plazo y cuántas veces. La misma que va a usar el formulario.
--   · VENCIDA: dato calculado que devuelven las RPC, no un estado nuevo.
--   · La alerta `agenda_plazo_vencido` y su cron de las 9:00.
--   · Las RPC de crear, editar, eliminar y reasignar, con el alcance de una
--     serie ("solo esta" / "todas las que faltan").
--
-- ⚠️ LOS EMAILS DE AGENDA NO EXISTEN desde el 2026-10-28
-- (`sql/agenda_avisos_sin_email.sql`, decisión de Ignacio): se borraron el
-- canal 'email' de `agenda_avisos`, `agenda_pedir_emails`,
-- `agenda_emails_desde`, el tope diario y la edge function
-- `send-agenda-aviso`. Por eso acá el plazo y la repetición viajan en el
-- PUSH, que es el único canal que quedó. No se resucita nada de aquello.
--
-- Pruebas: sql/PROBAR_agenda_plazos_y_repeticiones.sql
-- Deshacer: sql/ROLLBACK_agenda_plazos_y_repeticiones.sql
-- ════════════════════════════════════════════════════════════════════════════


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1 · EL MODELO                                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.agenda_series (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    departamento_id  uuid NOT NULL REFERENCES public.agenda_departamentos(id) ON DELETE CASCADE,
    frecuencia       text NOT NULL CHECK (frecuencia IN (
                         'todos_los_dias', 'dia_por_medio', 'cada_semana',
                         'semana_por_medio', 'por_mes')),
    desde            date NOT NULL,
    hasta            date NOT NULL,
    todo_el_dia      boolean NOT NULL DEFAULT true,
    hora_desde       time,
    hora_hasta       time,
    created_at       timestamptz NOT NULL DEFAULT now(),
    created_by       uuid REFERENCES public.users(id) ON DELETE SET NULL,
    updated_at       timestamptz NOT NULL DEFAULT now(),
    -- El mismo tope que una tarea con plazo: un año.
    CONSTRAINT agenda_series_plazo_ck CHECK (hasta > desde AND hasta - desde <= 366),
    CONSTRAINT agenda_series_horario_ck CHECK (
        todo_el_dia
        OR (hora_desde IS NOT NULL AND hora_hasta IS NOT NULL AND hora_hasta > hora_desde)),
    CONSTRAINT agenda_series_todo_el_dia_ck CHECK (
        NOT todo_el_dia OR (hora_desde IS NULL AND hora_hasta IS NULL))
);

ALTER TABLE public.agenda_tareas
    ADD COLUMN IF NOT EXISTS fecha_hasta     date,
    ADD COLUMN IF NOT EXISTS serie_id        uuid REFERENCES public.agenda_series(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS numero_en_serie integer;

-- Con plazo: hasta posterior a desde, un año como mucho, y siempre todo el día.
ALTER TABLE public.agenda_tareas DROP CONSTRAINT IF EXISTS agenda_tareas_plazo_ck;
ALTER TABLE public.agenda_tareas ADD CONSTRAINT agenda_tareas_plazo_ck CHECK (
    fecha_hasta IS NULL
    OR (fecha_hasta > fecha AND fecha_hasta - fecha <= 366 AND todo_el_dia)
);

-- Una repetición es de UN día: tiene serie y no tiene plazo. Y al revés: una
-- tarea con plazo no pertenece a ninguna serie. Sin esto habría una tercera
-- forma a medio camino que ninguna pantalla sabría dibujar.
ALTER TABLE public.agenda_tareas DROP CONSTRAINT IF EXISTS agenda_tareas_serie_ck;
ALTER TABLE public.agenda_tareas ADD CONSTRAINT agenda_tareas_serie_ck CHECK (
    serie_id IS NULL OR fecha_hasta IS NULL
);

-- El número va con la serie, y empieza en 1.
ALTER TABLE public.agenda_tareas DROP CONSTRAINT IF EXISTS agenda_tareas_numero_serie_ck;
ALTER TABLE public.agenda_tareas ADD CONSTRAINT agenda_tareas_numero_serie_ck CHECK (
    (serie_id IS NULL AND numero_en_serie IS NULL)
    OR (serie_id IS NOT NULL AND numero_en_serie >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS agenda_tareas_serie_numero_idx
    ON public.agenda_tareas (serie_id, numero_en_serie) WHERE serie_id IS NOT NULL;

-- Las consultas por rango ahora preguntan por superposición.
CREATE INDEX IF NOT EXISTS agenda_tareas_dep_plazo_idx
    ON public.agenda_tareas (departamento_id, fecha, fecha_hasta);
CREATE INDEX IF NOT EXISTS agenda_tareas_sub_plazo_idx
    ON public.agenda_tareas (subdepartamento_id, fecha, fecha_hasta);

ALTER TABLE public.agenda_series ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agenda_series FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.agenda_series IS
    'Agenda Origen: el plazo, la frecuencia y el horario de una tarea que se repite. Las repeticiones son filas de agenda_tareas con serie_id. Sin acceso para anon ni authenticated: todo por RPC.';
COMMENT ON COLUMN public.agenda_tareas.fecha_hasta IS
    'Tarea con plazo: el último día. NULL = de un día. Nunca convive con serie_id.';
COMMENT ON COLUMN public.agenda_tareas.serie_id IS
    'Repetición: a qué serie pertenece. NULL = no se repite.';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2 · LOS DÍAS DE UNA FRECUENCIA (una sola fuente)                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Los días exactos, desde el inicio del plazo y sin pasarse del fin.
--   todos_los_dias   · cada día          dia_por_medio · cada 2 días
--   cada_semana      · cada 7 días       semana_por_medio · cada 14
--   por_mes          · el mismo día del mes
--
-- "Por mes" se apoya en cómo suma meses Postgres, que ya hace lo que pide la
-- regla: siempre desde la fecha ORIGINAL, recortando al último día del mes que
-- no tenga ese número. Del 31/1: +1 mes = 28/2, +2 meses = 31/3. Si en cambio
-- se fuera sumando un mes al resultado anterior, de febrero no se volvería
-- nunca al 31.
CREATE OR REPLACE FUNCTION public.agenda_serie_fechas(p_frecuencia text, p_desde date, p_hasta date)
RETURNS SETOF date
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
    SELECT f FROM (
        SELECT CASE p_frecuencia
                   WHEN 'por_mes' THEN (p_desde + make_interval(months => k))::date
                   WHEN 'todos_los_dias'   THEN p_desde + k
                   WHEN 'dia_por_medio'    THEN p_desde + k * 2
                   WHEN 'cada_semana'      THEN p_desde + k * 7
                   WHEN 'semana_por_medio' THEN p_desde + k * 14
               END AS f
          FROM generate_series(0, 400) k
    ) x
    WHERE p_desde IS NOT NULL AND p_hasta IS NOT NULL
      AND f IS NOT NULL AND f >= p_desde AND f <= p_hasta
    ORDER BY f;
$$;

-- Cómo se lee cada frecuencia.
CREATE OR REPLACE FUNCTION public.agenda_frecuencia_texto(p_frecuencia text)
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
    SELECT CASE p_frecuencia
        WHEN 'todos_los_dias'   THEN 'Todos los días'
        WHEN 'dia_por_medio'    THEN 'Día por medio'
        WHEN 'cada_semana'      THEN 'Cada semana'
        WHEN 'semana_por_medio' THEN 'Semana por medio'
        WHEN 'por_mes'          THEN 'Por mes'
    END;
$$;

-- Qué repeticiones entran en un plazo, y cuántas veces daría cada una.
--
-- UNA opción está disponible si entra al menos DOS veces: una sola vez no es
-- repetir, es la misma tarea del primer día. Esa única regla da exactamente
-- los mínimos pedidos (2 días para todos los días, 3 para día por medio, 8
-- para cada semana, 15 para semana por medio) sin tener que escribirlos uno
-- por uno, y "por mes" sale igual sin ningún caso especial.
--
-- `supera_tope` avisa que esa opción daría más de 200 repeticiones: la base la
-- va a rechazar al crearla, y el formulario puede decirlo antes.
CREATE OR REPLACE FUNCTION public.agenda_repeticiones_posibles(p_desde date, p_hasta date)
RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public
AS $$
    SELECT CASE
        WHEN p_desde IS NULL OR p_hasta IS NULL OR p_hasta <= p_desde
             OR p_hasta - p_desde > 366
            THEN jsonb_build_object('ok', false, 'motivo', 'plazo_invalido')
        ELSE jsonb_build_object(
            'ok', true,
            'desde', p_desde,
            'hasta', p_hasta,
            'dias', (p_hasta - p_desde) + 1,
            'opciones', (
                SELECT jsonb_agg(jsonb_build_object(
                           'frecuencia', f.clave,
                           'nombre', public.agenda_frecuencia_texto(f.clave),
                           'veces', v.veces,
                           'disponible', v.veces >= 2 AND v.veces <= 200,
                           'supera_tope', v.veces > 200) ORDER BY f.orden)
                  FROM (VALUES ('todos_los_dias', 1), ('dia_por_medio', 2),
                               ('cada_semana', 3), ('semana_por_medio', 4),
                               ('por_mes', 5)) f(clave, orden)
                  CROSS JOIN LATERAL (
                      SELECT count(*)::integer AS veces
                        FROM public.agenda_serie_fechas(f.clave, p_desde, p_hasta)) v))
    END;
$$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3 · VALIDACIÓN Y TEXTOS                                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- El plazo y la frecuencia, con la misma regla para crear y para editar.
-- `agenda_valida_campos_tarea` sigue intacta: valida lo de siempre, y esta se
-- suma. Separarlas evita cambiarle la firma a algo que ya anda.
CREATE OR REPLACE FUNCTION public.agenda_valida_plazo(
    p_fecha date, p_fecha_hasta date, p_frecuencia text, p_todo_el_dia boolean
) RETURNS text
LANGUAGE sql STABLE SET search_path = public
AS $$
    SELECT CASE
        WHEN p_fecha IS NULL THEN 'fecha_invalida'
        -- Sin plazo no hay nada más que mirar.
        WHEN p_fecha_hasta IS NULL AND p_frecuencia IS NULL THEN NULL
        -- Una repetición necesita su plazo: sin fin no se sabe hasta cuándo.
        WHEN p_fecha_hasta IS NULL THEN 'plazo_invalido'
        WHEN p_fecha_hasta <= p_fecha OR p_fecha_hasta - p_fecha > 366 THEN 'plazo_invalido'
        -- Una tarea con plazo (sin repetir) es siempre todo el día.
        WHEN p_frecuencia IS NULL AND COALESCE(p_todo_el_dia, true) = false THEN 'horario_invalido'
        WHEN p_frecuencia IS NOT NULL AND public.agenda_frecuencia_texto(p_frecuencia) IS NULL
            THEN 'repeticion_no_disponible'
        WHEN p_frecuencia IS NOT NULL AND (
                SELECT count(*) FROM public.agenda_serie_fechas(p_frecuencia, p_fecha, p_fecha_hasta)) < 2
            THEN 'repeticion_no_disponible'
        WHEN p_frecuencia IS NOT NULL AND (
                SELECT count(*) FROM public.agenda_serie_fechas(p_frecuencia, p_fecha, p_fecha_hasta)) > 200
            THEN 'demasiadas_repeticiones'
    END;
$$;

CREATE OR REPLACE FUNCTION public.agenda_fecha_dm(p_fecha date)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT to_char(p_fecha, 'FMDD/FMMM'); $$;

CREATE OR REPLACE FUNCTION public.agenda_horario_texto(p_todo boolean, p_desde time, p_hasta time)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
    SELECT CASE WHEN COALESCE(p_todo, true) OR p_desde IS NULL THEN 'Todo el día'
                ELSE to_char(p_desde, 'HH24:MI') || COALESCE(' – ' || to_char(p_hasta, 'HH24:MI'), '') END;
$$;

-- Cuándo pasa una tarea, en una línea, para el aviso de "tarea asignada".
-- Devuelve { fecha, horario }, los dos nombres que ya usa la plantilla del
-- catálogo, así el texto nuevo entra sin tocar la alerta.
--   un día    → "mié 12/11"                     · "Todo el día"
--   con plazo → "del 1/11 al 12/12"             · "Todo el día"
--   serie     → "cada semana, del 1/11 al 12/12" · "6 veces · Todo el día"
CREATE OR REPLACE FUNCTION public.agenda_cuando_json(t public.agenda_tareas)
RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path = public
AS $$
DECLARE
    s public.agenda_series;
    v_veces integer;
BEGIN
    IF t.serie_id IS NOT NULL THEN
        SELECT * INTO s FROM public.agenda_series WHERE id = t.serie_id;
        IF FOUND THEN
            SELECT count(*) INTO v_veces FROM public.agenda_tareas WHERE serie_id = s.id;
            RETURN jsonb_build_object(
                'fecha', lower(public.agenda_frecuencia_texto(s.frecuencia))
                         || ', del ' || public.agenda_fecha_dm(s.desde)
                         || ' al ' || public.agenda_fecha_dm(s.hasta),
                'horario', v_veces || ' ' || CASE WHEN v_veces = 1 THEN 'vez' ELSE 'veces' END
                           || ' · ' || public.agenda_horario_texto(t.todo_el_dia, t.hora_desde, t.hora_hasta));
        END IF;
    END IF;

    IF t.fecha_hasta IS NOT NULL THEN
        RETURN jsonb_build_object(
            'fecha', 'del ' || public.agenda_fecha_dm(t.fecha) || ' al ' || public.agenda_fecha_dm(t.fecha_hasta),
            'horario', public.agenda_horario_texto(t.todo_el_dia, t.hora_desde, t.hora_hasta));
    END IF;

    RETURN jsonb_build_object(
        'fecha', (ARRAY['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'])[extract(dow FROM t.fecha)::int + 1]
                 || ' ' || to_char(t.fecha, 'DD/MM'),
        'horario', public.agenda_horario_texto(t.todo_el_dia, t.hora_desde, t.hora_hasta));
END;
$$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4 · LO QUE DEVUELVEN LAS RPC                                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- VENCIDA es un dato calculado, no un estado: los estados siguen siendo
-- esperando / en_proceso / completada. Está vencida una tarea sin completar
-- cuyo último día ya pasó, y sólo si tiene plazo o es una repetición. Una
-- tarea de un día de las de siempre NUNCA se marca vencida: cambiarlo sería
-- cambiarle el comportamiento a todo lo que ya existe.
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
$$;

-- Una tarea cae en el rango si lo TOCA, no si empieza adentro: la del 1/11 al
-- 12/12 tiene que verse también la semana del 20/11. Para las de un día y las
-- repeticiones, `fecha_hasta` es NULL y la condición es la de siempre.
CREATE OR REPLACE FUNCTION public.agenda_tareas_departamento(p_dep uuid, p_desde date, p_hasta date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
         WHERE t.departamento_id = p_dep
           AND t.fecha <= p_hasta
           AND COALESCE(t.fecha_hasta, t.fecha) >= p_desde), '[]'::jsonb));
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
$$;

-- El tope de 100 días sigue siendo del RANGO QUE SE PIDE, no del largo de un
-- plazo: una tarea de seis meses se ve igual en una semana cualquiera.
CREATE OR REPLACE FUNCTION public.agenda_mis_tareas(
    p_desde date, p_hasta date, p_todo_el_departamento boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
$$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 5 · LOS AVISOS: UNA SERIE AVISA UNA SOLA VEZ                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- El trigger avisa por FILA, y una serie de 26 repeticiones mandaría 26 avisos
-- iguales. Mientras una RPC está creando o reasignando una serie entera pone
-- `agenda.serie_en_lote`, el trigger se saltea el aviso de "asignada" de esas
-- filas, y la RPC manda UNO solo al terminar. Es una marca de transacción: si
-- algo falla, se va con el ROLLBACK.
--
-- "Completada" no se toca: cada repetición se completa por su cuenta y cada
-- una avisa, que es lo que se quiere.
CREATE OR REPLACE FUNCTION public.agenda_tareas_avisar()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
$$;

-- El aviso único de una serie, anclado en la repetición que se nombre. Se
-- llama DESPUÉS de crear o reasignar, con el lote ya cerrado.
CREATE OR REPLACE FUNCTION public.agenda_avisar_serie(p_tarea uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
$$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 6 · CREAR, EDITAR, ELIMINAR Y REASIGNAR                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Las cuatro cambian de firma (plazo, frecuencia y alcance), así que se tiran
-- y se vuelven a crear: CREATE OR REPLACE no puede sumar parámetros, y dejar
-- dos versiones haría ambigua cada llamada. Los parámetros nuevos tienen
-- DEFAULT, así que el front de hoy sigue llamándolas igual.
DROP FUNCTION IF EXISTS public.agenda_crear_tarea(uuid, uuid, uuid, uuid, uuid, text, text, date, boolean, time, time, uuid);
DROP FUNCTION IF EXISTS public.agenda_editar_tarea(uuid, uuid, uuid, uuid, text, text, date, boolean, time, time);
DROP FUNCTION IF EXISTS public.agenda_eliminar_tarea(uuid);
DROP FUNCTION IF EXISTS public.agenda_reasignar_tarea(uuid, uuid);

-- Las repeticiones que todavía se pueden tocar: de hoy en adelante y sin
-- completar. Las completadas no se tocan NUNCA, ni para editar, ni para
-- eliminar, ni para reasignar: son historial de algo que alguien hizo.
CREATE OR REPLACE FUNCTION public.agenda_serie_pendientes(p_serie uuid)
RETURNS SETOF public.agenda_tareas
LANGUAGE sql STABLE SET search_path = public
AS $$
    SELECT * FROM public.agenda_tareas
     WHERE serie_id = p_serie AND estado <> 'completada' AND fecha >= public.agenda_hoy()
     ORDER BY fecha, numero_en_serie;
$$;

-- Después de agregar o sacar repeticiones, los números vuelven a ir 1..N por
-- fecha. Es lo único que una repetición completada puede ver cambiar: su
-- posición. Si no se renumerara, el "3 de 6" del detalle mentiría.
--
-- En DOS pasadas: el índice único (serie_id, numero_en_serie) se chequea fila
-- por fila, así que reordenar de una sola vez puede chocar a mitad de camino
-- con un número que todavía no se liberó. Correrlos todos a un rango alto
-- primero deja el 1..N libre.
CREATE OR REPLACE FUNCTION public.agenda_serie_renumerar(p_serie uuid)
RETURNS void
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
    UPDATE public.agenda_tareas SET numero_en_serie = numero_en_serie + 1000000
     WHERE serie_id = p_serie;

    UPDATE public.agenda_tareas t SET numero_en_serie = x.n
      FROM (SELECT id, row_number() OVER (ORDER BY fecha, created_at) AS n
              FROM public.agenda_tareas WHERE serie_id = p_serie) x
     WHERE t.id = x.id;
END;
$$;

-- Una serie como la ven las pantallas. No sale `created_by` crudo: el id de
-- una persona sólo viaja donde hace falta.
CREATE OR REPLACE FUNCTION public.agenda_serie_json(s public.agenda_series)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'id', s.id,
        'frecuencia', s.frecuencia,
        'frecuencia_texto', public.agenda_frecuencia_texto(s.frecuencia),
        'desde', s.desde,
        'hasta', s.hasta,
        'todo_el_dia', s.todo_el_dia,
        'hora_desde', to_char(s.hora_desde, 'HH24:MI'),
        'hora_hasta', to_char(s.hora_hasta, 'HH24:MI'),
        'total', (SELECT count(*) FROM public.agenda_tareas t WHERE t.serie_id = s.id),
        'pendientes', (SELECT count(*) FROM public.agenda_serie_pendientes(s.id)),
        'creador', (SELECT jsonb_build_object('id', u.id, 'nombre', u.name)
                      FROM public.users u WHERE u.id = s.created_by));
$$;

CREATE OR REPLACE FUNCTION public.agenda_crear_tarea(
    p_id uuid, p_dep uuid, p_sub uuid, p_carpeta uuid, p_prioridad uuid,
    p_nombre text, p_detalles text, p_fecha date, p_todo_el_dia boolean,
    p_desde time, p_hasta time, p_solicitud uuid DEFAULT NULL,
    p_fecha_hasta date DEFAULT NULL, p_frecuencia text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
$$;

-- EDITAR. `p_alcance`:
--   'solo_esta'      · esta tarea (o esta repetición). Lo de siempre.
--   'las_que_faltan' · sólo en una serie: las repeticiones de hoy en adelante
--                      sin completar. Con p_fecha_hasta y p_frecuencia, además
--                      recalcula los días de la serie.
--
-- El RECÁLCULO se hace borrando las que faltan y creando las nuevas en la
-- MISMA serie. Hacerlo "moviendo" cada fila sería más prolijo en el papel,
-- pero no hay forma de saber qué repetición nueva se corresponde con cuál
-- vieja cuando cambia la frecuencia, y cualquier regla que se invente estaría
-- adivinando. Las completadas quedan donde están, con su día y su estado; las
-- que faltan son días que todavía no pasaron y no hay nada que conservar.
CREATE OR REPLACE FUNCTION public.agenda_editar_tarea(
    p_id uuid, p_sub uuid, p_carpeta uuid, p_prioridad uuid,
    p_nombre text, p_detalles text, p_fecha date, p_todo_el_dia boolean,
    p_desde time, p_hasta time,
    p_fecha_hasta date DEFAULT NULL, p_frecuencia text DEFAULT NULL,
    p_alcance text DEFAULT 'solo_esta'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.agenda_eliminar_tarea(p_id uuid, p_alcance text DEFAULT 'solo_esta')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_alcance text := COALESCE(NULLIF(btrim(COALESCE(p_alcance, '')), ''), 'solo_esta');
    t public.agenda_tareas;
    v_ids uuid[];
    v_quedan integer;
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

    IF v_alcance = 'solo_esta' THEN
        v_ids := ARRAY[p_id];
    ELSE
        SELECT array_agg(id) INTO v_ids FROM public.agenda_serie_pendientes(t.serie_id);
        IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'motivo', 'serie_completada');
        END IF;
    END IF;

    UPDATE public.agenda_solicitudes SET estado = 'aceptada', tarea_id = NULL
     WHERE tarea_id = ANY (v_ids) AND estado = 'asignada';
    DELETE FROM public.agenda_tareas WHERE id = ANY (v_ids);

    IF t.serie_id IS NOT NULL THEN
        SELECT count(*) INTO v_quedan FROM public.agenda_tareas WHERE serie_id = t.serie_id;
        IF v_quedan = 0 THEN
            DELETE FROM public.agenda_series WHERE id = t.serie_id;
        ELSE
            PERFORM public.agenda_serie_renumerar(t.serie_id);
        END IF;
    END IF;

    RETURN jsonb_build_object('ok', true, 'id', p_id, 'alcance', v_alcance,
                              'eliminadas', COALESCE(array_length(v_ids, 1), 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.agenda_reasignar_tarea(
    p_id uuid, p_sub_nuevo uuid, p_alcance text DEFAULT 'solo_esta'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
$$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 7 · EL AVISO DE PLAZO VENCIDO                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- `type_legacy = 'warning'`: el triángulo que /notificaciones ya dibuja. No se
-- inventa un tipo nuevo porque eso obligaría a tocar una pantalla, y las
-- pantallas son del prompt 2.
INSERT INTO public.notif_alertas
    (clave, tipo, area, nombre, nombre_publico, descripcion_evento, descripcion_publica,
     destinatario_texto, variables, titulo_plantilla, mensaje_plantilla, url_plantilla,
     type_legacy, permite_apagar)
VALUES (
    'agenda_plazo_vencido', 'automatica', 'Agenda',
    'Venció el plazo de una tarea',
    'Plazos vencidos',
    'una tarea con plazo llega al día siguiente de su fecha de fin sin completarse',
    'Cuando vence el plazo de una tarea de un departamento que encargás.',
    'Los encargados del departamento',
    ARRAY['tarea', 'subdepartamento', 'fecha'],
    'Venció un plazo',
    '«{tarea}» de {subdepartamento} venció el {fecha} sin completarse.',
    '/departamentos',
    'warning', true)
ON CONFLICT (clave) DO NOTHING;

-- El patrón *_hechos: la reserva se hace ANTES de emitir, así dos corridas no
-- mandan dos veces. La clave lleva `fecha_hasta`: si se cambia el plazo de una
-- tarea ya avisada y vuelve a vencer, es otra fila y se avisa de nuevo.
CREATE TABLE IF NOT EXISTS public.agenda_plazos_avisados (
    tarea_id    uuid NOT NULL REFERENCES public.agenda_tareas(id) ON DELETE CASCADE,
    fecha_hasta date NOT NULL,
    avisado_at  timestamptz NOT NULL DEFAULT now(),
    personas    integer NOT NULL DEFAULT 0,
    PRIMARY KEY (tarea_id, fecha_hasta)
);
ALTER TABLE public.agenda_plazos_avisados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agenda_plazos_avisados FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.agenda_plazos_avisados IS
    'Agenda Origen: qué plazo vencido ya se avisó. La clave incluye fecha_hasta: cambiar el plazo y volver a vencer avisa de nuevo. Sin acceso para anon ni authenticated.';

-- Las tareas CON PLAZO sin completar cuyo último día ya pasó y de las que
-- todavía no se avisó. Las repeticiones NO entran: se ven vencidas y nada más
-- (una serie de 26 mandaría 26 avisos y nadie los leería).
--
-- Busca TODAS las que faltan, no sólo las que vencieron ayer: si el cron no
-- corrió un día, al día siguiente se pone al día solo.
CREATE OR REPLACE FUNCTION public.agenda_plazos_vencidos_tick(p_ahora timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
$$;

-- 12:00 UTC = 9:00 en Argentina (UTC−3 todo el año). SQL directo, sin HTTP,
-- como el cron de las programadas.
SELECT cron.unschedule('agenda-plazos-vencidos')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agenda-plazos-vencidos');
SELECT cron.schedule('agenda-plazos-vencidos', '0 12 * * *',
                     $cron$SELECT public.agenda_plazos_vencidos_tick();$cron$);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 8 · PERMISOS                                                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Nada nuevo se abre. Las piezas internas quedan cerradas y las cuatro RPC de
-- tareas vuelven a tener lo mismo que tenían (CREATE las deja abiertas a
-- PUBLIC: sección 12, regla 3).
REVOKE ALL ON FUNCTION
    public.agenda_serie_fechas(text, date, date),
    public.agenda_frecuencia_texto(text),
    public.agenda_valida_plazo(date, date, text, boolean),
    public.agenda_fecha_dm(date),
    public.agenda_horario_texto(boolean, time, time),
    public.agenda_cuando_json(public.agenda_tareas),
    public.agenda_tarea_json(public.agenda_tareas),
    public.agenda_serie_pendientes(uuid),
    public.agenda_serie_json(public.agenda_series),
    public.agenda_serie_renumerar(uuid),
    public.agenda_avisar_serie(uuid),
    public.agenda_plazos_vencidos_tick(timestamptz)
    FROM PUBLIC, anon, authenticated;

-- La que usa el formulario del prompt 2 para saber qué repeticiones ofrecer.
REVOKE ALL ON FUNCTION public.agenda_repeticiones_posibles(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_repeticiones_posibles(date, date) TO authenticated;

REVOKE ALL ON FUNCTION
    public.agenda_crear_tarea(uuid, uuid, uuid, uuid, uuid, text, text, date, boolean, time, time, uuid, date, text),
    public.agenda_editar_tarea(uuid, uuid, uuid, uuid, text, text, date, boolean, time, time, date, text, text),
    public.agenda_eliminar_tarea(uuid, text),
    public.agenda_reasignar_tarea(uuid, uuid, text),
    public.agenda_tareas_departamento(uuid, date, date),
    public.agenda_tareas_subdepartamento(uuid, date, date),
    public.agenda_mis_tareas(date, date, boolean)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
    public.agenda_crear_tarea(uuid, uuid, uuid, uuid, uuid, text, text, date, boolean, time, time, uuid, date, text),
    public.agenda_editar_tarea(uuid, uuid, uuid, uuid, text, text, date, boolean, time, time, date, text, text),
    public.agenda_eliminar_tarea(uuid, text),
    public.agenda_reasignar_tarea(uuid, uuid, text),
    public.agenda_tareas_departamento(uuid, date, date),
    public.agenda_tareas_subdepartamento(uuid, date, date),
    public.agenda_mis_tareas(date, date, boolean)
    TO authenticated;
