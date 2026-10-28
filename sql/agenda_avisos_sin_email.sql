-- ════════════════════════════════════════════════════════════════════════════
-- Agenda Origen · los avisos de tareas dejan de ir por email
-- 2026-10-28 · decisión de Ignacio
--
-- QUÉ CAMBIA. "Tarea asignada" y "Tarea completada" se avisaban por dos
-- canales: la notificación en la app y un email por Resend (send-agenda-aviso).
-- El email se va. Queda la notificación en la app, que es la que ve la
-- campanita, la que pinta la marca roja y la que dispara el aviso del sistema
-- cuando la app está abierta.
--
-- NO cambia a quién se le avisa ni cuándo:
--   Tarea asignada   → quien dirige + los integrantes del sub, SIN los
--                      encargados del departamento.
--   Tarea completada → los encargados del departamento, menos quien la completó.
--   Solicitudes      → igual que siempre (nunca tuvieron email).
--
-- NADIE SE PIERDE NADA POR EL CAMINO: los emails se activaban recién el
-- 2/11/2026 (agenda_emails_desde) y al 28/10 no había salido ninguno — de
-- hecho no hay una sola fila en agenda_avisos ni una tarea en la base. Así
-- que esto no interrumpe nada que estuviera andando.
--
-- QUÉ SE VA:
--   · El canal 'email' de agenda_avisos (y su índice, y el CHECK que lo
--     permitía). La tabla sigue: es la que impide avisar dos veces lo mismo.
--   · agenda_pedir_emails() — el pg_net a la función.
--   · agenda_emails_desde() — la fecha de activación.
--   · La edge function send-agenda-aviso, que ya no la llama nadie.
--
-- Pruebas: sql/PROBAR_agenda_avisos_sin_email.sql (en BEGIN … ROLLBACK).
-- Para volver atrás: sql/agenda_avisos.sql vuelve a dejar todo como estaba.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1 · Registrar los avisos: sólo el canal de la app ───────────────────────
-- Misma firma y mismo tipo de retorno que antes (así no hay que tirar la
-- función), pero ahora el número que devuelve es cuántas notificaciones
-- NUEVAS se crearon. El trigger ya no lo usa para nada; se devuelve porque
-- sirve para mirar desde una prueba qué hizo.
CREATE OR REPLACE FUNCTION public.agenda_registrar_avisos(
    p_tarea uuid,
    p_tipo text,
    p_users uuid[],
    p_titulo text,
    p_mensaje text,
    p_tipo_notificacion text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;


-- ── 2 · El trigger de las tareas, sin el pedido de emails ───────────────────
-- Idéntico al de sql/agenda_avisos.sql salvo las dos líneas que pedían los
-- emails: ahora se llama a agenda_registrar_avisos y se sigue de largo.
CREATE OR REPLACE FUNCTION public.agenda_tareas_avisar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;


-- ── 3 · Lo que ya no existe ─────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.agenda_pedir_emails(uuid, text);
DROP FUNCTION IF EXISTS public.agenda_emails_desde();

-- El índice era para contar los emails del día contra el tope de 40.
DROP INDEX IF EXISTS public.agenda_avisos_emails_enviados;

-- Las filas de email que pudieran existir (al 28/10 no hay ninguna): se van
-- antes de apretar el CHECK, que si no las rechazaría.
DELETE FROM public.agenda_avisos WHERE canal = 'email';

ALTER TABLE public.agenda_avisos DROP CONSTRAINT IF EXISTS agenda_avisos_canal_check;
ALTER TABLE public.agenda_avisos ADD CONSTRAINT agenda_avisos_canal_check CHECK (canal = 'app');


-- ── 4 · Qué dice cada cosa ──────────────────────────────────────────────────
COMMENT ON TABLE public.agenda_avisos IS
    'Agenda Origen: un aviso por tarea, persona y tipo (asignada/completada). El UNIQUE impide repetirlo. Desde el 28/10/2026 el único canal es la app: los emails se sacaron. Sin acceso para anon ni authenticated.';
COMMENT ON FUNCTION public.agenda_registrar_avisos(uuid, text, uuid[], text, text, text) IS
    'Agenda Origen (interna): registra el aviso de una tarea, sin repetir, y crea la notificación en la app. Devuelve cuántas notificaciones nuevas creó.';
COMMENT ON FUNCTION public.agenda_tareas_avisar() IS
    'Agenda Origen: trigger de agenda_tareas. Asignada → equipo del sub sin los encargados; completada → encargados menos quien la completó. Sólo notificaciones en la app.';
