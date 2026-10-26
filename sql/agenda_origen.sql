-- ════════════════════════════════════════════════════════════════════════════
-- Agenda Origen · departamentos, sub-departamentos, tareas y solicitudes
-- 2026-10-26 · ✅ APLICADO el 2026-10-26 (PROBAR_: 25 casos en verde contra la base real)
--
-- Diseños: design-claude/Agenda Origen.dc.html · Sistemas - Departamentos ·
--          Departamentos - Inicio · Departamento - Tareas · Departamento -
--          Equipo · Sub-departamento - Panel · Solicitudes · Email - Tarea
--          asignada · Email - Tarea completada. Los datos de ejemplo y los
--          colores de los estados están en design-claude/agenda-core.js.
--
-- QUÉ AGREGA
--   1 · Ocho tablas agenda_*: departamentos y sus encargados, sub-departamentos
--       y sus miembros, carpetas, prioridades, solicitudes y tareas.
--   2 · RLS prendido en las ocho. Sólo dos policies, de lectura, en
--       departamentos y prioridades (no tienen datos de personas y /solicitudes
--       las necesita). Todo lo demás —incluida TODA escritura— va por las RPC
--       de abajo, SECURITY DEFINER.
--   3 · Helpers internos de permiso y de validación (nadie de afuera los llama).
--   4 · Las RPC: acceso, Sistemas, panel del departamento, panel del
--       sub-departamento, la Agenda de cada uno y las solicitudes.
--
-- POR QUÉ ASÍ
--   · El acceso NO va por rol: va por pertenencia. Ser encargado de
--     "Creativos" no es un rol de la app, es una fila en
--     agenda_departamento_encargados. No hay UserRole nuevo ni ALTER TYPE.
--     SUPER_ADMIN se comporta como encargado de todos los departamentos.
--   · Los estados de las tareas los pone la BASE (sección "Reglas de estado"
--     en agenda_crear_tarea / agenda_editar_tarea). El cliente nunca manda un
--     estado salvo en agenda_cambiar_estado_tarea, que sólo acepta los dos
--     que tiene sentido marcar a mano.
--   · users sigue cerrada: los nombres y las fotos salen sólo adentro de
--     estas funciones, y sólo los de la gente con la que uno trabaja.
--   · Los ids de lo que se crea los genera el cliente (p_id): si el envío se
--     corta y se reintenta, la base devuelve lo que ya había en vez de
--     duplicarlo. Mismo patrón que las ventas de voluntarios.
--   · Las columnas email_* de agenda_tareas quedan para el prompt 8 (los
--     emails de tarea asignada y completada). Hoy no las usa nadie.
--
-- Pruebas: sql/PROBAR_agenda_origen.sql · Deshacer: sql/ROLLBACK_agenda_origen.sql
-- ORDEN: no depende de ninguna función de Edge. Se aplica entero, en una sola
--        transacción (sin BEGIN/COMMIT adentro: así se puede ensayar dentro
--        de un BEGIN … ROLLBACK junto con las pruebas).
-- ════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- 1 · TABLAS
-- ════════════════════════════════════════════════════════════════════════════
-- Los nombres se guardan ya recortados (el CHECK exige nombre = btrim(nombre)):
-- así la unicidad por lower(btrim(nombre)) y lo que se muestra son lo mismo.

CREATE TABLE public.agenda_departamentos (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre      text NOT NULL CHECK (nombre = btrim(nombre) AND char_length(nombre) BETWEEN 1 AND 80),
    color       text NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
    icono       text NOT NULL CHECK (icono ~ '^[a-z0-9-]{2,30}$'),
    created_at  timestamptz NOT NULL DEFAULT now(),
    created_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX agenda_departamentos_nombre_uq
    ON public.agenda_departamentos (lower(btrim(nombre)));

-- Si se borra la cuenta de un encargado, el departamento puede quedar sin
-- ninguno: SUPER_ADMIN lo sigue administrando y le pone otro.
CREATE TABLE public.agenda_departamento_encargados (
    departamento_id uuid NOT NULL REFERENCES public.agenda_departamentos(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
    PRIMARY KEY (departamento_id, user_id)
);
CREATE INDEX agenda_departamento_encargados_user_idx
    ON public.agenda_departamento_encargados (user_id);

-- lider_id admite NULL sólo por el ON DELETE SET NULL: las RPC exigen uno al
-- crear. Quien dirige NO va en la tabla de miembros (cuenta una sola vez).
CREATE TABLE public.agenda_subdepartamentos (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    departamento_id uuid NOT NULL REFERENCES public.agenda_departamentos(id) ON DELETE CASCADE,
    nombre          text NOT NULL CHECK (nombre = btrim(nombre) AND char_length(nombre) BETWEEN 1 AND 80),
    color           text NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
    lider_id        uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX agenda_subdepartamentos_nombre_uq
    ON public.agenda_subdepartamentos (departamento_id, lower(btrim(nombre)));
CREATE INDEX agenda_subdepartamentos_lider_idx
    ON public.agenda_subdepartamentos (lider_id);

CREATE TABLE public.agenda_subdepartamento_miembros (
    subdepartamento_id uuid NOT NULL REFERENCES public.agenda_subdepartamentos(id) ON DELETE CASCADE,
    user_id            uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at         timestamptz NOT NULL DEFAULT now(),
    agregado_por       uuid REFERENCES public.users(id) ON DELETE SET NULL,
    PRIMARY KEY (subdepartamento_id, user_id)
);
CREATE INDEX agenda_subdepartamento_miembros_user_idx
    ON public.agenda_subdepartamento_miembros (user_id);

-- created_at es la "fecha de creación" que muestra la hoja de la carpeta.
CREATE TABLE public.agenda_carpetas (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    departamento_id uuid NOT NULL REFERENCES public.agenda_departamentos(id) ON DELETE CASCADE,
    nombre          text NOT NULL CHECK (nombre = btrim(nombre) AND char_length(nombre) BETWEEN 1 AND 80),
    color           text NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
    created_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES public.users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX agenda_carpetas_nombre_uq
    ON public.agenda_carpetas (departamento_id, lower(btrim(nombre)));

CREATE TABLE public.agenda_prioridades (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    departamento_id uuid NOT NULL REFERENCES public.agenda_departamentos(id) ON DELETE CASCADE,
    nombre          text NOT NULL CHECK (nombre = btrim(nombre) AND char_length(nombre) BETWEEN 1 AND 80),
    color           text NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
    orden           integer NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX agenda_prioridades_nombre_uq
    ON public.agenda_prioridades (departamento_id, lower(btrim(nombre)));

-- Las tareas van antes que las solicitudes y la referencia cruzada
-- (tarea.solicitud_id) se agrega después, cuando existen las dos.
CREATE TABLE public.agenda_tareas (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    departamento_id     uuid NOT NULL REFERENCES public.agenda_departamentos(id) ON DELETE CASCADE,
    -- SET NULL es la red de seguridad; el camino normal es
    -- agenda_eliminar_subdepartamento, que primero las pasa a 'esperando'.
    subdepartamento_id  uuid REFERENCES public.agenda_subdepartamentos(id) ON DELETE SET NULL,
    carpeta_id          uuid REFERENCES public.agenda_carpetas(id) ON DELETE SET NULL,
    prioridad_id        uuid REFERENCES public.agenda_prioridades(id) ON DELETE SET NULL,
    solicitud_id        uuid,
    nombre              text NOT NULL CHECK (nombre = btrim(nombre) AND char_length(nombre) BETWEEN 1 AND 120),
    detalles            text CHECK (detalles IS NULL OR char_length(detalles) <= 4000),
    fecha               date NOT NULL,
    todo_el_dia         boolean NOT NULL DEFAULT true,
    hora_desde          time,
    hora_hasta          time,
    estado              text NOT NULL CHECK (estado IN ('esperando', 'en_proceso', 'completada')),
    -- Cada vez que recibe un sub-departamento nuevo. La usa el email de
    -- "tarea asignada" (prompt 8) para saber qué falta mandar.
    asignada_at         timestamptz,
    completada_at       timestamptz,
    completada_por      uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    created_by          uuid REFERENCES public.users(id) ON DELETE SET NULL,
    updated_at          timestamptz NOT NULL DEFAULT now(),
    -- Prompt 8. Hoy no se usan.
    email_asignada_at   timestamptz,
    email_completada_at timestamptz,
    email_error         text,
    CONSTRAINT agenda_tareas_horario_ck CHECK (
        todo_el_dia
        OR (hora_desde IS NOT NULL AND hora_hasta IS NOT NULL AND hora_hasta > hora_desde)
    ),
    -- Todo el día no lleva horas: si quedaran, la tarea se dibujaría en dos
    -- lugares según qué pantalla mire qué columna.
    CONSTRAINT agenda_tareas_todo_el_dia_ck CHECK (
        NOT todo_el_dia OR (hora_desde IS NULL AND hora_hasta IS NULL)
    ),
    -- Completar es cosa de un equipo: sin sub-departamento no hay quién.
    CONSTRAINT agenda_tareas_completada_ck CHECK (
        estado <> 'completada' OR subdepartamento_id IS NOT NULL
    )
);
CREATE INDEX agenda_tareas_dep_fecha_idx ON public.agenda_tareas (departamento_id, fecha);
CREATE INDEX agenda_tareas_sub_fecha_idx ON public.agenda_tareas (subdepartamento_id, fecha);

CREATE TABLE public.agenda_solicitudes (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    numero           integer GENERATED ALWAYS AS IDENTITY UNIQUE,
    departamento_id  uuid NOT NULL REFERENCES public.agenda_departamentos(id) ON DELETE CASCADE,
    solicitante_id   uuid REFERENCES public.users(id) ON DELETE SET NULL,
    prioridad_id     uuid REFERENCES public.agenda_prioridades(id) ON DELETE SET NULL,
    -- Copia del nombre al pedirla: si después se borra la prioridad, la
    -- solicitud sigue diciendo qué urgencia pidió la persona.
    prioridad_nombre text,
    detalles         text NOT NULL CHECK (char_length(btrim(detalles)) BETWEEN 10 AND 2000),
    estado           text NOT NULL DEFAULT 'nueva'
                     CHECK (estado IN ('nueva', 'aceptada', 'rechazada', 'asignada')),
    created_at       timestamptz NOT NULL DEFAULT now(),
    revisada_at      timestamptz,
    revisada_por     uuid REFERENCES public.users(id) ON DELETE SET NULL,
    tarea_id         uuid REFERENCES public.agenda_tareas(id) ON DELETE SET NULL
);
CREATE INDEX agenda_solicitudes_dep_estado_idx ON public.agenda_solicitudes (departamento_id, estado);
-- Para el tope diario por persona.
CREATE INDEX agenda_solicitudes_solicitante_idx ON public.agenda_solicitudes (solicitante_id, created_at);

ALTER TABLE public.agenda_tareas
    ADD CONSTRAINT agenda_tareas_solicitud_fk
    FOREIGN KEY (solicitud_id) REFERENCES public.agenda_solicitudes(id) ON DELETE SET NULL;


-- ════════════════════════════════════════════════════════════════════════════
-- 2 · RLS Y PRIVILEGIOS DE TABLA
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.agenda_departamentos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_departamento_encargados  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_subdepartamentos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_subdepartamento_miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_carpetas                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_prioridades              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_solicitudes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_tareas                   ENABLE ROW LEVEL SECURITY;

-- Las dos únicas policies. Nombre, color, ícono y orden: nada de personas.
CREATE POLICY agenda_departamentos_select_autenticados
    ON public.agenda_departamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY agenda_prioridades_select_autenticados
    ON public.agenda_prioridades FOR SELECT TO authenticated USING (true);

-- Supabase le da ALL sobre cada tabla nueva a anon y a authenticated. Con RLS
-- y sin policies ya no leen ni escriben nada, pero se cierra igual:
--   · anon: nada de nada.
--   · authenticated: sólo SELECT (lo filtra RLS). Sin INSERT/UPDATE/DELETE,
--     una escritura directa da error de permiso en vez de "0 filas", y sin
--     TRUNCATE, que RLS no frena.
REVOKE ALL ON public.agenda_departamentos, public.agenda_departamento_encargados,
              public.agenda_subdepartamentos, public.agenda_subdepartamento_miembros,
              public.agenda_carpetas, public.agenda_prioridades,
              public.agenda_solicitudes, public.agenda_tareas
    FROM anon, authenticated;
GRANT SELECT ON public.agenda_departamentos, public.agenda_departamento_encargados,
                public.agenda_subdepartamentos, public.agenda_subdepartamento_miembros,
                public.agenda_carpetas, public.agenda_prioridades,
                public.agenda_solicitudes, public.agenda_tareas
    TO authenticated;
REVOKE ALL ON SEQUENCE public.agenda_solicitudes_numero_seq FROM anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 3 · HELPERS INTERNOS
-- ════════════════════════════════════════════════════════════════════════════
-- Ninguna policy los usa, así que nadie de afuera los puede llamar (ver §6):
-- los usan las RPC, que corren como su dueño.
-- Sin sesión, auth.uid() es NULL: cada uno lo chequea explícito, porque
-- "lider_id = NULL" no es falso sino NULL (regla 12.1).

CREATE OR REPLACE FUNCTION public.agenda_es_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT auth.uid() IS NOT NULL AND public.tiene_rol(ARRAY['SUPER_ADMIN']);
$$;

CREATE OR REPLACE FUNCTION public.agenda_es_encargado(p_dep uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT auth.uid() IS NOT NULL
       AND p_dep IS NOT NULL
       AND (public.tiene_rol(ARRAY['SUPER_ADMIN'])
            OR EXISTS (SELECT 1 FROM public.agenda_departamento_encargados e
                        WHERE e.departamento_id = p_dep AND e.user_id = auth.uid()));
$$;

CREATE OR REPLACE FUNCTION public.agenda_dirige(p_sub uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT auth.uid() IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.agenda_subdepartamentos s
                    WHERE s.id = p_sub AND s.lider_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.agenda_es_miembro(p_sub uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT auth.uid() IS NOT NULL
       AND (EXISTS (SELECT 1 FROM public.agenda_subdepartamento_miembros m
                     WHERE m.subdepartamento_id = p_sub AND m.user_id = auth.uid())
            OR public.agenda_dirige(p_sub));
$$;

-- Ver una tarea: el encargado de su departamento, o quien está en el equipo
-- que la tiene. Una 'esperando' (sin equipo) la ven sólo los encargados.
CREATE OR REPLACE FUNCTION public.agenda_puede_ver_tarea(p_tarea uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT auth.uid() IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.agenda_tareas t
                    WHERE t.id = p_tarea
                      AND (public.agenda_es_encargado(t.departamento_id)
                           OR (t.subdepartamento_id IS NOT NULL
                               AND public.agenda_es_miembro(t.subdepartamento_id))));
$$;

-- Que el sub, la carpeta y la prioridad de una tarea sean del MISMO
-- departamento. Sin esto, un encargado de A podría colgar su tarea de un
-- equipo de B y aparecerle en la Agenda a gente que no es suya.
-- La usan crear, editar, reasignar y el reemplazo de prioridad (regla 12.5).
-- Devuelve el motivo, o NULL si está todo bien.
CREATE OR REPLACE FUNCTION public.agenda_valida_del_departamento(
    p_dep uuid, p_sub uuid, p_carpeta uuid, p_prioridad uuid
) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT CASE
        WHEN p_sub IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.agenda_subdepartamentos WHERE id = p_sub AND departamento_id = p_dep)
            THEN 'sub_ajeno'
        WHEN p_carpeta IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.agenda_carpetas WHERE id = p_carpeta AND departamento_id = p_dep)
            THEN 'carpeta_ajena'
        WHEN p_prioridad IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.agenda_prioridades WHERE id = p_prioridad AND departamento_id = p_dep)
            THEN 'prioridad_ajena'
    END;
$$;

-- Los campos propios de una tarea. La misma regla para crear y para editar.
CREATE OR REPLACE FUNCTION public.agenda_valida_campos_tarea(
    p_nombre text, p_detalles text, p_fecha date,
    p_todo_el_dia boolean, p_desde time, p_hasta time
) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
    SELECT CASE
        WHEN char_length(btrim(COALESCE(p_nombre, ''))) NOT BETWEEN 1 AND 120 THEN 'nombre_invalido'
        WHEN char_length(COALESCE(p_detalles, '')) > 4000 THEN 'detalles_largos'
        WHEN p_fecha IS NULL THEN 'fecha_invalida'
        WHEN COALESCE(p_todo_el_dia, true) = false
             AND (p_desde IS NULL OR p_hasta IS NULL OR p_hasta <= p_desde) THEN 'horario_invalido'
    END;
$$;

-- Nombre / color de los catálogos (departamento, sub, carpeta, prioridad).
CREATE OR REPLACE FUNCTION public.agenda_valida_nombre_color(p_nombre text, p_color text)
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
    SELECT CASE
        WHEN char_length(btrim(COALESCE(p_nombre, ''))) NOT BETWEEN 1 AND 80 THEN 'nombre_invalido'
        WHEN COALESCE(p_color, '') !~ '^#[0-9a-fA-F]{6}$' THEN 'color_invalido'
    END;
$$;

-- Una persona como la ven las pantallas: id, nombre y foto. Nada más.
CREATE OR REPLACE FUNCTION public.agenda_persona(p_user uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT jsonb_build_object('id', u.id, 'nombre', u.name, 'avatar_url', u.avatar_url)
      FROM public.users u WHERE u.id = p_user;
$$;

-- Sin acentos ni mayúsculas, para buscar "Lucia" y encontrar "Lucía".
-- La extensión unaccent no está instalada (verificado el 2026-10-26): esto
-- cubre el español sin agregar una extensión.
CREATE OR REPLACE FUNCTION public.agenda_sin_acentos(p text)
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
    SELECT translate(lower(COALESCE(p, '')), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc');
$$;

-- "ju•••@gmail.com": alcanza para distinguir a dos Juan Pérez sin dar la
-- dirección. Lo usa la búsqueda cuando quien busca no es SUPER_ADMIN.
CREATE OR REPLACE FUNCTION public.agenda_email_enmascarado(p_email text)
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
    SELECT CASE
        WHEN p_email IS NULL OR position('@' IN p_email) = 0 THEN NULL
        ELSE left(split_part(p_email, '@', 1),
                  CASE WHEN char_length(split_part(p_email, '@', 1)) > 2 THEN 2 ELSE 1 END)
             || '•••@' || split_part(p_email, '@', 2)
    END;
$$;

-- La tarea como la reciben las listas (sin detalles: los trae agenda_tarea).
CREATE OR REPLACE FUNCTION public.agenda_tarea_json(t public.agenda_tareas)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'id', t.id,
        'departamento', (SELECT jsonb_build_object('id', d.id, 'nombre', d.nombre, 'color', d.color, 'icono', d.icono)
                           FROM public.agenda_departamentos d WHERE d.id = t.departamento_id),
        'subdepartamento', (SELECT jsonb_build_object('id', s.id, 'nombre', s.nombre, 'color', s.color)
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

-- Los ids de la lista que existen como usuarios. Para avisar "usuario
-- inexistente" en vez de dejar que el FK tire un error sin explicación.
CREATE OR REPLACE FUNCTION public.agenda_faltan_usuarios(p_users uuid[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM unnest(COALESCE(p_users, '{}')) x(id)
         WHERE x.id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = x.id));
$$;

-- La fecha de hoy en Argentina: "para hoy" y el tope diario se cuentan así,
-- no en UTC (a las 21 h ya sería mañana).
CREATE OR REPLACE FUNCTION public.agenda_hoy()
RETURNS date
LANGUAGE sql STABLE SET search_path = public
AS $$
    SELECT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- 4 · RPC — ACCESO
-- ════════════════════════════════════════════════════════════════════════════

-- Qué ve cada uno. La usan el menú, las rutas y /departamentos.
--   encargado: los departamentos que administra (todos, si es SUPER_ADMIN).
--   dirijo:    los sub-departamentos que dirige.
--   miembro:   TODOS los sub-departamentos donde participa —como miembro o
--              dirigiéndolo—, una vez cada uno, con 'dirige' para distinguir.
--              Es la lista de "Mis sub-departamentos" de la Agenda.
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
             WHERE s.lider_id = v_uid), '[]'::jsonb),
        'miembro', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                       'id', s.id, 'departamento_id', s.departamento_id, 'departamento_nombre', d.nombre,
                       'nombre', s.nombre, 'color', s.color, 'dirige', s.lider_id IS NOT DISTINCT FROM v_uid)
                   ORDER BY lower(d.nombre), lower(s.nombre))
              FROM public.agenda_subdepartamentos s
              JOIN public.agenda_departamentos d ON d.id = s.departamento_id
             WHERE s.lider_id = v_uid
                OR EXISTS (SELECT 1 FROM public.agenda_subdepartamento_miembros m
                            WHERE m.subdepartamento_id = s.id AND m.user_id = v_uid)), '[]'::jsonb)
    );
END;
$$;

-- Buscar a quién sumar. Sólo SUPER_ADMIN y encargados: el resto no tiene a
-- quién agregar, y una búsqueda abierta sería un directorio de la iglesia.
CREATE OR REPLACE FUNCTION public.agenda_buscar_usuarios(p_texto text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_super boolean;
    v_q text := public.agenda_sin_acentos(btrim(COALESCE(p_texto, '')));
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    v_super := public.agenda_es_super_admin();
    IF NOT v_super AND NOT EXISTS (SELECT 1 FROM public.agenda_departamento_encargados
                                    WHERE user_id = v_uid) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;
    IF char_length(v_q) < 2 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'texto_corto');
    END IF;

    RETURN jsonb_build_object('ok', true, 'usuarios', COALESCE((
        SELECT jsonb_agg(x.fila ORDER BY x.orden_nombre)
          FROM (SELECT jsonb_build_object(
                           'id', u.id, 'nombre', u.name,
                           'email', CASE WHEN v_super THEN u.email
                                         ELSE public.agenda_email_enmascarado(u.email) END,
                           'avatar_url', u.avatar_url) AS fila,
                       lower(COALESCE(u.name, u.email, '')) AS orden_nombre
                  FROM public.users u
                 WHERE u.is_active IS NOT FALSE
                   AND (public.agenda_sin_acentos(u.name) LIKE '%' || v_q || '%'
                        OR public.agenda_sin_acentos(u.email) LIKE '%' || v_q || '%')
                 ORDER BY lower(COALESCE(u.name, u.email, ''))
                 LIMIT 20) x), '[]'::jsonb));
END;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- 5 · RPC — SISTEMAS (sólo SUPER_ADMIN)
-- ════════════════════════════════════════════════════════════════════════════

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
                                              WHERE s.departamento_id = d.id),
                   -- Personas distintas: quien dirige y los miembros, una vez
                   -- cada una aunque esté en dos equipos.
                   'cant_miembros', (SELECT count(DISTINCT p.user_id) FROM (
                                         SELECT s.lider_id AS user_id FROM public.agenda_subdepartamentos s
                                          WHERE s.departamento_id = d.id AND s.lider_id IS NOT NULL
                                         UNION
                                         SELECT m.user_id FROM public.agenda_subdepartamento_miembros m
                                           JOIN public.agenda_subdepartamentos s ON s.id = m.subdepartamento_id
                                          WHERE s.departamento_id = d.id) p),
                   'cant_tareas', (SELECT count(*) FROM public.agenda_tareas t WHERE t.departamento_id = d.id))
               ORDER BY lower(d.nombre))
          FROM public.agenda_departamentos d), '[]'::jsonb));
END;
$$;

-- Crea o edita (p_id lo genera el cliente) y REEMPLAZA los encargados.
CREATE OR REPLACE FUNCTION public.agenda_guardar_departamento(
    p_id uuid, p_nombre text, p_color text, p_icono text, p_encargados uuid[]
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_id uuid := COALESCE(p_id, gen_random_uuid());
    v_nombre text := btrim(COALESCE(p_nombre, ''));
    v_encargados uuid[];
    v_motivo text;
    v_existe boolean;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF NOT public.agenda_es_super_admin() THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    v_motivo := public.agenda_valida_nombre_color(v_nombre, p_color);
    IF v_motivo IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', v_motivo);
    END IF;
    IF COALESCE(p_icono, '') !~ '^[a-z0-9-]{2,30}$' THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'icono_invalido');
    END IF;

    SELECT COALESCE(array_agg(DISTINCT x), '{}') INTO v_encargados
      FROM unnest(COALESCE(p_encargados, '{}')) x WHERE x IS NOT NULL;
    IF cardinality(v_encargados) = 0 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_encargados');
    END IF;
    IF public.agenda_faltan_usuarios(v_encargados) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'usuario_inexistente');
    END IF;

    IF EXISTS (SELECT 1 FROM public.agenda_departamentos
                WHERE lower(nombre) = lower(v_nombre) AND id <> v_id) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'nombre_duplicado');
    END IF;

    PERFORM 1 FROM public.agenda_departamentos WHERE id = v_id FOR UPDATE;
    v_existe := FOUND;

    BEGIN
        IF v_existe THEN
            UPDATE public.agenda_departamentos
               SET nombre = v_nombre, color = p_color, icono = p_icono, updated_at = now()
             WHERE id = v_id;
        ELSE
            INSERT INTO public.agenda_departamentos (id, nombre, color, icono, created_by)
            VALUES (v_id, v_nombre, p_color, p_icono, v_uid);
        END IF;
    EXCEPTION WHEN unique_violation THEN
        -- Dos altas con el mismo nombre al mismo tiempo: la segunda llega acá.
        RETURN jsonb_build_object('ok', false, 'motivo', 'nombre_duplicado');
    END;

    DELETE FROM public.agenda_departamento_encargados
     WHERE departamento_id = v_id AND user_id <> ALL (v_encargados);
    INSERT INTO public.agenda_departamento_encargados (departamento_id, user_id, created_by)
    SELECT v_id, x, v_uid FROM unnest(v_encargados) x
    ON CONFLICT (departamento_id, user_id) DO NOTHING;

    RETURN jsonb_build_object('ok', true, 'id', v_id, 'creado', NOT v_existe);
END;
$$;

-- Borra el departamento con todo lo que cuelga de él y devuelve qué borró.
-- Las tareas van primero a mano: si las borrara la cascada, el SET NULL del
-- sub-departamento podría tocar una 'completada' antes de borrarla y chocar
-- con agenda_tareas_completada_ck.
CREATE OR REPLACE FUNCTION public.agenda_eliminar_departamento(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_conteos jsonb;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF NOT public.agenda_es_super_admin() THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;
    PERFORM 1 FROM public.agenda_departamentos WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;

    v_conteos := jsonb_build_object(
        'subdepartamentos', (SELECT count(*) FROM public.agenda_subdepartamentos WHERE departamento_id = p_id),
        'tareas', (SELECT count(*) FROM public.agenda_tareas WHERE departamento_id = p_id),
        'carpetas', (SELECT count(*) FROM public.agenda_carpetas WHERE departamento_id = p_id),
        'prioridades', (SELECT count(*) FROM public.agenda_prioridades WHERE departamento_id = p_id),
        'solicitudes', (SELECT count(*) FROM public.agenda_solicitudes WHERE departamento_id = p_id));

    DELETE FROM public.agenda_tareas WHERE departamento_id = p_id;
    DELETE FROM public.agenda_departamentos WHERE id = p_id;

    RETURN jsonb_build_object('ok', true, 'borrados', v_conteos);
END;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- 6 · RPC — PANEL DEL DEPARTAMENTO (encargado o SUPER_ADMIN)
-- ════════════════════════════════════════════════════════════════════════════

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
              FROM public.agenda_subdepartamentos s WHERE s.departamento_id = p_dep), '[]'::jsonb),
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
         WHERE t.departamento_id = p_dep AND t.fecha BETWEEN p_desde AND p_hasta), '[]'::jsonb));
END;
$$;

-- REGLAS DE ESTADO al crear: sin sub → 'esperando'; con sub → 'en_proceso'
-- y asignada_at. Desde una solicitud: tiene que ser del mismo departamento y
-- estar 'aceptada'; pasa a 'asignada' con el id de la tarea.
-- Idempotente: el mismo p_id dos veces devuelve la tarea que ya había.
CREATE OR REPLACE FUNCTION public.agenda_crear_tarea(
    p_id uuid, p_dep uuid, p_sub uuid, p_carpeta uuid, p_prioridad uuid,
    p_nombre text, p_detalles text, p_fecha date, p_todo_el_dia boolean,
    p_desde time, p_hasta time, p_solicitud uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
$$;

-- REGLAS DE ESTADO al editar:
--   · sub NULL → 'esperando' (sin asignada_at).
--   · el mismo sub → el estado no cambia: una 'completada' sigue completada.
--   · otro sub → es reasignar: sólo desde 'esperando' o 'en_proceso'
--     (motivo 'completada' si no); queda 'en_proceso' con asignada_at nuevo.
-- Sacarle el sub a una completada también es reasignar, y también se frena:
-- para cambiarle el equipo, primero se la vuelve a 'en proceso'.
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
        public.agenda_valida_del_departamento(t.departamento_id, p_sub, p_carpeta, p_prioridad));
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

-- Cambiar de equipo (o sacarla de todos, con p_sub_nuevo NULL). Mismo
-- departamento siempre; una completada no se reasigna.
CREATE OR REPLACE FUNCTION public.agenda_reasignar_tarea(p_id uuid, p_sub_nuevo uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
$$;

-- Si la tarea salió de una solicitud, la solicitud vuelve a 'aceptada': sin
-- esto quedaría 'asignada' a una tarea que ya no existe, sin forma de
-- volver a asignarla.
CREATE OR REPLACE FUNCTION public.agenda_eliminar_tarea(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
$$;

-- ── Carpetas ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.agenda_guardar_carpeta(
    p_id uuid, p_dep uuid, p_nombre text, p_color text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_id uuid := COALESCE(p_id, gen_random_uuid());
    v_nombre text := btrim(COALESCE(p_nombre, ''));
    v_dep_actual uuid;
    v_motivo text;
    c public.agenda_carpetas;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF NOT public.agenda_es_encargado(p_dep) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;
    SELECT departamento_id INTO v_dep_actual FROM public.agenda_carpetas WHERE id = v_id FOR UPDATE;
    IF FOUND AND v_dep_actual <> p_dep THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'carpeta_ajena');
    END IF;
    v_motivo := public.agenda_valida_nombre_color(v_nombre, p_color);
    IF v_motivo IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', v_motivo);
    END IF;

    BEGIN
        INSERT INTO public.agenda_carpetas (id, departamento_id, nombre, color, created_by)
        VALUES (v_id, p_dep, v_nombre, p_color, v_uid)
        ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, color = EXCLUDED.color
        RETURNING * INTO c;
    EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'nombre_duplicado');
    END;

    RETURN jsonb_build_object('ok', true, 'id', c.id, 'carpeta',
        jsonb_build_object('id', c.id, 'nombre', c.nombre, 'color', c.color, 'created_at', c.created_at));
END;
$$;

CREATE OR REPLACE FUNCTION public.agenda_eliminar_carpeta(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_dep uuid;
    v_tareas integer;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    SELECT departamento_id INTO v_dep FROM public.agenda_carpetas WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF NOT public.agenda_es_encargado(v_dep) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;
    SELECT count(*) INTO v_tareas FROM public.agenda_tareas WHERE carpeta_id = p_id;
    -- Las tareas quedan sin carpeta (ON DELETE SET NULL).
    DELETE FROM public.agenda_carpetas WHERE id = p_id;
    RETURN jsonb_build_object('ok', true, 'id', p_id, 'tareas_sin_carpeta', v_tareas);
END;
$$;

-- ── Prioridades ─────────────────────────────────────────────────────────────
-- Una nueva va al final del orden.
CREATE OR REPLACE FUNCTION public.agenda_guardar_prioridad(
    p_id uuid, p_dep uuid, p_nombre text, p_color text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_id uuid := COALESCE(p_id, gen_random_uuid());
    v_nombre text := btrim(COALESCE(p_nombre, ''));
    v_dep_actual uuid;
    v_motivo text;
    p public.agenda_prioridades;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF NOT public.agenda_es_encargado(p_dep) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;
    SELECT departamento_id INTO v_dep_actual FROM public.agenda_prioridades WHERE id = v_id FOR UPDATE;
    IF FOUND AND v_dep_actual <> p_dep THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'prioridad_ajena');
    END IF;
    v_motivo := public.agenda_valida_nombre_color(v_nombre, p_color);
    IF v_motivo IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', v_motivo);
    END IF;

    BEGIN
        INSERT INTO public.agenda_prioridades (id, departamento_id, nombre, color, orden)
        VALUES (v_id, p_dep, v_nombre, p_color,
                (SELECT COALESCE(max(orden), -1) + 1 FROM public.agenda_prioridades WHERE departamento_id = p_dep))
        ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, color = EXCLUDED.color
        RETURNING * INTO p;
    EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'nombre_duplicado');
    END;

    RETURN jsonb_build_object('ok', true, 'id', p.id, 'prioridad',
        jsonb_build_object('id', p.id, 'nombre', p.nombre, 'color', p.color, 'orden', p.orden));
END;
$$;

-- p_ids tiene que ser EXACTAMENTE la lista de prioridades del departamento,
-- en el orden nuevo: ni una de menos (quedaría con un orden viejo mezclado)
-- ni una de otro departamento.
CREATE OR REPLACE FUNCTION public.agenda_ordenar_prioridades(p_dep uuid, p_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_cant integer;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF NOT public.agenda_es_encargado(p_dep) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;
    PERFORM 1 FROM public.agenda_prioridades WHERE departamento_id = p_dep FOR UPDATE;
    SELECT count(*) INTO v_cant FROM public.agenda_prioridades WHERE departamento_id = p_dep;

    IF cardinality(COALESCE(p_ids, '{}')) <> v_cant
       OR (SELECT count(DISTINCT x) FROM unnest(p_ids) x WHERE x IS NOT NULL) <> v_cant
       OR EXISTS (SELECT 1 FROM unnest(p_ids) x
                   WHERE NOT EXISTS (SELECT 1 FROM public.agenda_prioridades
                                      WHERE id = x AND departamento_id = p_dep)) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'lista_incompleta');
    END IF;

    UPDATE public.agenda_prioridades p SET orden = x.pos - 1
      FROM unnest(p_ids) WITH ORDINALITY AS x(id, pos)
     WHERE p.id = x.id;

    RETURN jsonb_build_object('ok', true);
END;
$$;

-- En uso y sin reemplazo: no se borra y se dice cuántas la usan. Con
-- reemplazo del mismo departamento: las tareas pasan a esa y se borra.
-- Las solicitudes no se mueven: guardan prioridad_nombre, que es lo que la
-- persona pidió, y eso no cambia porque el equipo reorganice sus prioridades.
CREATE OR REPLACE FUNCTION public.agenda_eliminar_prioridad(p_id uuid, p_reemplazo uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_dep uuid;
    v_uso integer;
    v_motivo text;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    SELECT departamento_id INTO v_dep FROM public.agenda_prioridades WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF NOT public.agenda_es_encargado(v_dep) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    SELECT count(*) INTO v_uso FROM public.agenda_tareas WHERE prioridad_id = p_id;
    IF v_uso > 0 AND p_reemplazo IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'en_uso', 'cantidad', v_uso);
    END IF;
    IF p_reemplazo IS NOT NULL THEN
        IF p_reemplazo = p_id THEN
            RETURN jsonb_build_object('ok', false, 'motivo', 'reemplazo_invalido');
        END IF;
        v_motivo := public.agenda_valida_del_departamento(v_dep, NULL, NULL, p_reemplazo);
        IF v_motivo IS NOT NULL THEN
            RETURN jsonb_build_object('ok', false, 'motivo', v_motivo);
        END IF;
        UPDATE public.agenda_tareas SET prioridad_id = p_reemplazo, updated_at = now()
         WHERE prioridad_id = p_id;
    END IF;

    DELETE FROM public.agenda_prioridades WHERE id = p_id;
    RETURN jsonb_build_object('ok', true, 'id', p_id, 'tareas_movidas', v_uso);
END;
$$;

-- Las cuatro de siempre, sólo si el departamento no tiene ninguna.
CREATE OR REPLACE FUNCTION public.agenda_prioridades_sugeridas(p_dep uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF NOT public.agenda_es_encargado(p_dep) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;
    -- El lock es para que dos clicks seguidos no creen dos juegos.
    PERFORM 1 FROM public.agenda_departamentos WHERE id = p_dep FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF EXISTS (SELECT 1 FROM public.agenda_prioridades WHERE departamento_id = p_dep) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'ya_tiene');
    END IF;

    INSERT INTO public.agenda_prioridades (departamento_id, nombre, color, orden) VALUES
        (p_dep, 'Baja',    '#9ca3af', 0),
        (p_dep, 'Normal',  '#2563eb', 1),
        (p_dep, 'Alta',    '#f97316', 2),
        (p_dep, 'Urgente', '#dc2626', 3);

    RETURN jsonb_build_object('ok', true, 'prioridades', (
        SELECT jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'color', color, 'orden', orden) ORDER BY orden)
          FROM public.agenda_prioridades WHERE departamento_id = p_dep));
END;
$$;

-- ── Sub-departamentos ───────────────────────────────────────────────────────
-- Crear: con quién lo dirige y sus miembros. Editar: sólo nombre y color
-- (quien dirige y los miembros van por sus propias RPC, que cuidan que nadie
-- quede dos veces).
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

    SELECT departamento_id INTO v_dep_actual FROM public.agenda_subdepartamentos WHERE id = v_id FOR UPDATE;
    IF FOUND THEN
        IF v_dep_actual <> p_dep THEN
            RETURN jsonb_build_object('ok', false, 'motivo', 'sub_ajeno');
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

-- Las tareas que tenía y no estaban completadas vuelven a 'esperando' (sin
-- equipo), para que el encargado las asigne a otro. Las COMPLETADAS se borran
-- con el sub: una completada exige sub-departamento (la marcó ese equipo) y
-- ya no existe; dejarla sin sub rompería esa regla. La respuesta dice
-- cuántas, para que la pantalla lo avise antes de confirmar.
CREATE OR REPLACE FUNCTION public.agenda_eliminar_subdepartamento(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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

-- A quien dirige no se lo quita: primero se cambia quién dirige.
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

-- De un equipo a otro del mismo departamento, en una sola transacción: no
-- hay un momento en que la persona no esté en ninguno.
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

-- Quien dirigía QUEDA como miembro (no pierde sus tareas ni su Agenda). El
-- nuevo sale de la tabla de miembros si estaba, para no contarlo dos veces.
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

-- Los encargados del departamento, siempre al menos uno. Lo puede hacer un
-- encargado (incluso sacarse a sí mismo, si deja a otro) o SUPER_ADMIN.
CREATE OR REPLACE FUNCTION public.agenda_cambiar_encargados(p_dep uuid, p_users uuid[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_users uuid[];
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    PERFORM 1 FROM public.agenda_departamentos WHERE id = p_dep FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF NOT public.agenda_es_encargado(p_dep) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;
    SELECT COALESCE(array_agg(DISTINCT x), '{}') INTO v_users
      FROM unnest(COALESCE(p_users, '{}')) x WHERE x IS NOT NULL;
    IF cardinality(v_users) = 0 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_encargados');
    END IF;
    IF public.agenda_faltan_usuarios(v_users) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'usuario_inexistente');
    END IF;

    DELETE FROM public.agenda_departamento_encargados
     WHERE departamento_id = p_dep AND user_id <> ALL (v_users);
    INSERT INTO public.agenda_departamento_encargados (departamento_id, user_id, created_by)
    SELECT p_dep, x, auth.uid() FROM unnest(v_users) x
    ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── Solicitudes, del lado del departamento ─────────────────────────────────
-- Las que esperan algo del equipo: nuevas (revisar) y aceptadas (asignar).
CREATE OR REPLACE FUNCTION public.agenda_solicitudes_departamento(p_dep uuid)
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

    RETURN jsonb_build_object('ok', true, 'solicitudes', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                   'id', r.id, 'numero', r.numero, 'estado', r.estado, 'detalles', r.detalles,
                   'created_at', r.created_at, 'revisada_at', r.revisada_at,
                   'solicitante', public.agenda_persona(r.solicitante_id),
                   -- Si la prioridad se borró, queda el nombre que se pidió.
                   'prioridad', CASE
                       WHEN p.id IS NOT NULL THEN jsonb_build_object('id', p.id, 'nombre', p.nombre, 'color', p.color)
                       WHEN r.prioridad_nombre IS NOT NULL THEN jsonb_build_object('id', NULL, 'nombre', r.prioridad_nombre, 'color', NULL)
                   END)
               ORDER BY r.created_at DESC)
          FROM public.agenda_solicitudes r
          LEFT JOIN public.agenda_prioridades p ON p.id = r.prioridad_id
         WHERE r.departamento_id = p_dep AND r.estado IN ('nueva', 'aceptada')), '[]'::jsonb));
END;
$$;

-- Sólo desde 'nueva'. El FOR UPDATE frena a dos encargados revisándola a la vez.
CREATE OR REPLACE FUNCTION public.agenda_revisar_solicitud(p_id uuid, p_accion text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    r public.agenda_solicitudes;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF p_accion IS NULL OR p_accion NOT IN ('aceptar', 'rechazar') THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'accion_desconocida');
    END IF;
    SELECT * INTO r FROM public.agenda_solicitudes WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF NOT public.agenda_es_encargado(r.departamento_id) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;
    IF r.estado <> 'nueva' THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'ya_revisada', 'estado', r.estado);
    END IF;

    UPDATE public.agenda_solicitudes
       SET estado = CASE p_accion WHEN 'aceptar' THEN 'aceptada' ELSE 'rechazada' END,
           revisada_at = now(), revisada_por = auth.uid()
     WHERE id = p_id;
    RETURN jsonb_build_object('ok', true, 'estado',
        CASE p_accion WHEN 'aceptar' THEN 'aceptada' ELSE 'rechazada' END);
END;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- 7 · RPC — PANEL DEL SUB-DEPARTAMENTO (quien dirige, encargado o SUPER_ADMIN)
-- ════════════════════════════════════════════════════════════════════════════

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
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    SELECT departamento_id INTO v_dep FROM public.agenda_subdepartamentos WHERE id = p_sub;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
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
         WHERE t.subdepartamento_id = p_sub AND t.fecha BETWEEN p_desde AND p_hasta), '[]'::jsonb));
END;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- 8 · RPC — AGENDA (cualquiera con sesión; cada uno ve lo suyo)
-- ════════════════════════════════════════════════════════════════════════════

-- Lo de mis equipos. Con p_todo_el_departamento, el encargado suma todo lo de
-- sus departamentos (también las 'esperando'); SUPER_ADMIN, todo. Para quien
-- no es encargado el interruptor no cambia nada.
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
$$;

-- El detalle completo, para quien puede verla. Trae además qué puede hacer
-- quien la mira, para que la pantalla no tenga que adivinarlo.
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
            'puede_cambiar_estado', t.subdepartamento_id IS NOT NULL
                                    AND (v_encargado OR public.agenda_es_miembro(t.subdepartamento_id))));
END;
$$;

-- Marcar completada o volver a 'en proceso'. Lo puede hacer el equipo que la
-- tiene (miembros y quien dirige), los encargados y SUPER_ADMIN. Una
-- 'esperando' no se completa: todavía no la tiene nadie.
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


-- ════════════════════════════════════════════════════════════════════════════
-- 9 · RPC — SOLICITUDES (cualquiera con sesión)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.agenda_departamentos_para_solicitar()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    RETURN jsonb_build_object('ok', true, 'departamentos', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                   'id', d.id, 'nombre', d.nombre, 'color', d.color, 'icono', d.icono,
                   'prioridades', COALESCE((
                       SELECT jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre,
                                                           'color', p.color, 'orden', p.orden)
                                        ORDER BY p.orden, p.created_at)
                         FROM public.agenda_prioridades p WHERE p.departamento_id = d.id), '[]'::jsonb))
               ORDER BY lower(d.nombre))
          FROM public.agenda_departamentos d), '[]'::jsonb));
END;
$$;

-- Idempotente (p_id del cliente). Prioridad del mismo departamento, u
-- obligatoriamente NULL si el departamento no tiene ninguna.
-- Tope: 10 por persona por día argentino, con el mismo patrón que los
-- reportes de problemas (lock por persona antes de contar: dos envíos
-- simultáneos no se cuelan los dos como "el décimo").
CREATE OR REPLACE FUNCTION public.agenda_crear_solicitud(
    p_id uuid, p_dep uuid, p_prioridad uuid, p_detalles text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    c_limite CONSTANT integer := 10;
    v_uid uuid := auth.uid();
    v_detalles text := btrim(COALESCE(p_detalles, ''));
    v_previa public.agenda_solicitudes;
    v_prio public.agenda_prioridades;
    v_hoy integer;
    r public.agenda_solicitudes;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF p_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'id_requerido');
    END IF;

    -- El reintento va antes que el tope: reenviar la décima no es una undécima.
    SELECT * INTO v_previa FROM public.agenda_solicitudes WHERE id = p_id;
    IF FOUND THEN
        IF v_previa.solicitante_id IS NOT DISTINCT FROM v_uid THEN
            RETURN jsonb_build_object('ok', true, 'id', v_previa.id, 'numero', v_previa.numero,
                                      'ya_existia', true);
        END IF;
        RETURN jsonb_build_object('ok', false, 'motivo', 'id_en_uso');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.agenda_departamentos WHERE id = p_dep) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF char_length(v_detalles) < 10 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'detalles_cortos');
    END IF;
    IF char_length(v_detalles) > 2000 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'detalles_largos');
    END IF;

    IF p_prioridad IS NULL THEN
        IF EXISTS (SELECT 1 FROM public.agenda_prioridades WHERE departamento_id = p_dep) THEN
            RETURN jsonb_build_object('ok', false, 'motivo', 'prioridad_requerida');
        END IF;
    ELSE
        SELECT * INTO v_prio FROM public.agenda_prioridades
         WHERE id = p_prioridad AND departamento_id = p_dep;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'motivo', 'prioridad_ajena');
        END IF;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('agenda_solicitudes:' || v_uid::text));
    SELECT count(*) INTO v_hoy
      FROM public.agenda_solicitudes s
     WHERE s.solicitante_id = v_uid
       AND s.created_at >= (date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires')
                            AT TIME ZONE 'America/Argentina/Buenos_Aires');
    IF v_hoy >= c_limite THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'limite_diario', 'limite', c_limite);
    END IF;

    INSERT INTO public.agenda_solicitudes
        (id, departamento_id, solicitante_id, prioridad_id, prioridad_nombre, detalles)
    VALUES (p_id, p_dep, v_uid, v_prio.id, v_prio.nombre, v_detalles)
    ON CONFLICT (id) DO NOTHING
    RETURNING * INTO r;

    IF r.id IS NULL THEN
        -- Mismo id en dos envíos simultáneos: el lock por persona los ordena,
        -- así que el que llega acá es de otra persona.
        RETURN jsonb_build_object('ok', false, 'motivo', 'id_en_uso');
    END IF;

    RETURN jsonb_build_object('ok', true, 'id', r.id, 'numero', r.numero, 'ya_existia', false,
                              'restantes', c_limite - v_hoy - 1);
END;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- 10 · PERMISOS DE LAS FUNCIONES
-- ════════════════════════════════════════════════════════════════════════════
-- CREATE OR REPLACE le vuelve a dar EXECUTE a PUBLIC, y Supabase además se lo
-- da a anon y authenticated aparte (regla 12.3). Por eso se revoca a los tres
-- nombres y se da sólo a authenticated, función por función.

-- Helpers: nadie de afuera. Las RPC los llaman como su dueño.
REVOKE EXECUTE ON FUNCTION public.agenda_es_super_admin()                                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agenda_es_encargado(uuid)                                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agenda_dirige(uuid)                                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agenda_es_miembro(uuid)                                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agenda_puede_ver_tarea(uuid)                              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agenda_valida_del_departamento(uuid, uuid, uuid, uuid)    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agenda_valida_campos_tarea(text, text, date, boolean, time, time) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agenda_valida_nombre_color(text, text)                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agenda_persona(uuid)                                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agenda_sin_acentos(text)                                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agenda_email_enmascarado(text)                            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agenda_tarea_json(public.agenda_tareas)                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agenda_faltan_usuarios(uuid[])                            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agenda_hoy()                                              FROM PUBLIC, anon, authenticated;

-- RPC: sólo authenticated.
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'agenda_mi_acceso()',
        'agenda_buscar_usuarios(text)',
        'agenda_departamentos_admin()',
        'agenda_guardar_departamento(uuid, text, text, text, uuid[])',
        'agenda_eliminar_departamento(uuid)',
        'agenda_departamento(uuid)',
        'agenda_tareas_departamento(uuid, date, date)',
        'agenda_crear_tarea(uuid, uuid, uuid, uuid, uuid, text, text, date, boolean, time, time, uuid)',
        'agenda_editar_tarea(uuid, uuid, uuid, uuid, text, text, date, boolean, time, time)',
        'agenda_reasignar_tarea(uuid, uuid)',
        'agenda_eliminar_tarea(uuid)',
        'agenda_guardar_carpeta(uuid, uuid, text, text)',
        'agenda_eliminar_carpeta(uuid)',
        'agenda_guardar_prioridad(uuid, uuid, text, text)',
        'agenda_ordenar_prioridades(uuid, uuid[])',
        'agenda_eliminar_prioridad(uuid, uuid)',
        'agenda_prioridades_sugeridas(uuid)',
        'agenda_guardar_subdepartamento(uuid, uuid, text, text, uuid, uuid[])',
        'agenda_eliminar_subdepartamento(uuid)',
        'agenda_agregar_miembros(uuid, uuid[])',
        'agenda_quitar_miembro(uuid, uuid)',
        'agenda_mover_miembro(uuid, uuid, uuid)',
        'agenda_cambiar_lider(uuid, uuid)',
        'agenda_cambiar_encargados(uuid, uuid[])',
        'agenda_solicitudes_departamento(uuid)',
        'agenda_revisar_solicitud(uuid, text)',
        'agenda_subdepartamento(uuid)',
        'agenda_tareas_subdepartamento(uuid, date, date)',
        'agenda_mis_tareas(date, date, boolean)',
        'agenda_tarea(uuid)',
        'agenda_cambiar_estado_tarea(uuid, text)',
        'agenda_departamentos_para_solicitar()',
        'agenda_crear_solicitud(uuid, uuid, uuid, text)'
    ] LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
    END LOOP;
END;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- 11 · COMENTARIOS
-- ════════════════════════════════════════════════════════════════════════════
COMMENT ON FUNCTION public.agenda_mi_acceso() IS
    'Agenda Origen: qué ve quien llama (encargado de, dirige, participa en). Para el menú, las rutas y /departamentos.';
COMMENT ON FUNCTION public.agenda_buscar_usuarios(text) IS
    'Agenda Origen: hasta 20 personas por nombre o email (sin acentos). Sólo SUPER_ADMIN y encargados; el email va enmascarado si no es SUPER_ADMIN.';
COMMENT ON FUNCTION public.agenda_departamentos_admin() IS
    'Agenda Origen · Sistemas: todos los departamentos con encargados y conteos. Sólo SUPER_ADMIN.';
COMMENT ON FUNCTION public.agenda_guardar_departamento(uuid, text, text, text, uuid[]) IS
    'Agenda Origen · Sistemas: crea o edita un departamento (id del cliente) y reemplaza sus encargados (al menos uno). Sólo SUPER_ADMIN.';
COMMENT ON FUNCTION public.agenda_eliminar_departamento(uuid) IS
    'Agenda Origen · Sistemas: borra el departamento con todo lo suyo y devuelve los conteos. Sólo SUPER_ADMIN.';
COMMENT ON FUNCTION public.agenda_departamento(uuid) IS
    'Agenda Origen: el panel del departamento (encargados, sub-departamentos con su gente, carpetas, prioridades). Encargado o SUPER_ADMIN.';
COMMENT ON FUNCTION public.agenda_tareas_departamento(uuid, date, date) IS
    'Agenda Origen: tareas del departamento en un rango de hasta 400 días. Encargado o SUPER_ADMIN.';
COMMENT ON FUNCTION public.agenda_crear_tarea(uuid, uuid, uuid, uuid, uuid, text, text, date, boolean, time, time, uuid) IS
    'Agenda Origen: crea una tarea (idempotente por id). El estado lo pone la base. Opcionalmente desde una solicitud aceptada.';
COMMENT ON FUNCTION public.agenda_editar_tarea(uuid, uuid, uuid, uuid, text, text, date, boolean, time, time) IS
    'Agenda Origen: edita una tarea. Cambiar de sub a una completada devuelve motivo completada.';
COMMENT ON FUNCTION public.agenda_reasignar_tarea(uuid, uuid) IS
    'Agenda Origen: cambia el sub-departamento de una tarea no completada (mismo departamento).';
COMMENT ON FUNCTION public.agenda_eliminar_tarea(uuid) IS
    'Agenda Origen: borra una tarea; si venía de una solicitud, la solicitud vuelve a aceptada.';
COMMENT ON FUNCTION public.agenda_guardar_carpeta(uuid, uuid, text, text) IS
    'Agenda Origen: crea o edita una carpeta del departamento (id del cliente).';
COMMENT ON FUNCTION public.agenda_eliminar_carpeta(uuid) IS
    'Agenda Origen: borra una carpeta; sus tareas quedan sin carpeta.';
COMMENT ON FUNCTION public.agenda_guardar_prioridad(uuid, uuid, text, text) IS
    'Agenda Origen: crea (al final del orden) o edita una prioridad del departamento.';
COMMENT ON FUNCTION public.agenda_ordenar_prioridades(uuid, uuid[]) IS
    'Agenda Origen: nuevo orden de las prioridades; la lista tiene que traerlas todas.';
COMMENT ON FUNCTION public.agenda_eliminar_prioridad(uuid, uuid) IS
    'Agenda Origen: borra una prioridad. En uso, exige un reemplazo del mismo departamento y le pasa las tareas.';
COMMENT ON FUNCTION public.agenda_prioridades_sugeridas(uuid) IS
    'Agenda Origen: crea Baja, Normal, Alta y Urgente si el departamento no tiene ninguna.';
COMMENT ON FUNCTION public.agenda_guardar_subdepartamento(uuid, uuid, text, text, uuid, uuid[]) IS
    'Agenda Origen: crea un sub-departamento con quien lo dirige y sus miembros, o edita nombre y color.';
COMMENT ON FUNCTION public.agenda_eliminar_subdepartamento(uuid) IS
    'Agenda Origen: borra un sub-departamento. Sus tareas no completadas pasan a esperando; las completadas se borran.';
COMMENT ON FUNCTION public.agenda_agregar_miembros(uuid, uuid[]) IS
    'Agenda Origen: suma miembros a un sub-departamento (sin duplicar ni sumar a quien lo dirige).';
COMMENT ON FUNCTION public.agenda_quitar_miembro(uuid, uuid) IS
    'Agenda Origen: saca a un miembro de un sub-departamento (no a quien lo dirige).';
COMMENT ON FUNCTION public.agenda_mover_miembro(uuid, uuid, uuid) IS
    'Agenda Origen: pasa a un miembro de un sub-departamento a otro del mismo departamento.';
COMMENT ON FUNCTION public.agenda_cambiar_lider(uuid, uuid) IS
    'Agenda Origen: cambia quién dirige; el anterior queda como miembro.';
COMMENT ON FUNCTION public.agenda_cambiar_encargados(uuid, uuid[]) IS
    'Agenda Origen: reemplaza los encargados del departamento (al menos uno). Encargado o SUPER_ADMIN.';
COMMENT ON FUNCTION public.agenda_solicitudes_departamento(uuid) IS
    'Agenda Origen: solicitudes nuevas y aceptadas del departamento, con quién las pidió.';
COMMENT ON FUNCTION public.agenda_revisar_solicitud(uuid, text) IS
    'Agenda Origen: acepta o rechaza una solicitud nueva.';
COMMENT ON FUNCTION public.agenda_subdepartamento(uuid) IS
    'Agenda Origen: el panel del sub-departamento (gente, encargados y contadores en hora argentina). Quien dirige, encargado o SUPER_ADMIN.';
COMMENT ON FUNCTION public.agenda_tareas_subdepartamento(uuid, date, date) IS
    'Agenda Origen: tareas de un sub-departamento en un rango de hasta 400 días.';
COMMENT ON FUNCTION public.agenda_mis_tareas(date, date, boolean) IS
    'Agenda Origen: las tareas de mis equipos en un rango de hasta 100 días; con el interruptor, todo lo de los departamentos que administro.';
COMMENT ON FUNCTION public.agenda_tarea(uuid) IS
    'Agenda Origen: el detalle de una tarea para quien la puede ver, con qué puede hacer.';
COMMENT ON FUNCTION public.agenda_cambiar_estado_tarea(uuid, text) IS
    'Agenda Origen: marca una tarea completada o la vuelve a en_proceso. El equipo que la tiene, encargados o SUPER_ADMIN.';
COMMENT ON FUNCTION public.agenda_departamentos_para_solicitar() IS
    'Agenda Origen: departamentos con sus prioridades, para elegir a quién pedirle.';
COMMENT ON FUNCTION public.agenda_crear_solicitud(uuid, uuid, uuid, text) IS
    'Agenda Origen: manda una solicitud a un departamento (idempotente por id). Máximo 10 por persona por día argentino.';
