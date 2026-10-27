-- ════════════════════════════════════════════════════════════════════════════
-- AGENDA ORIGEN · "Mis solicitudes" — lo que cada uno pidió desde /solicitudes
-- ════════════════════════════════════════════════════════════════════════════
--
-- POR QUÉ HACE FALTA. `agenda_solicitudes` tiene RLS prendido y NINGUNA policy
-- (sql/agenda_origen.sql §2): authenticated tiene el GRANT SELECT pero RLS no
-- le deja ver una sola fila, ni siquiera las propias. Las dos lecturas que
-- había son del lado del equipo —agenda_solicitudes_departamento, sólo
-- encargados— así que quien pide algo no tenía forma de volver a verlo.
--
-- Esta RPC es la única lectura del lado de quien pide, y devuelve SÓLO lo
-- suyo: el WHERE es `solicitante_id = auth.uid()`, no un parámetro. No hay
-- manera de pedir las de otro porque no se puede nombrar a otro.
--
-- QUÉ MUESTRA DE MÁS. Si la solicitud ya se convirtió en tarea, van el nombre
-- de la tarea y su estado. Es el resultado de lo que esa persona pidió, y es
-- lo que convierte la lista en un seguimiento en vez de un archivo. NO va
-- quién la revisó ni a qué equipo se asignó: eso es de adentro del
-- departamento.
--
-- Se aplica sola y no toca nada de lo que ya existe.

CREATE OR REPLACE FUNCTION public.agenda_mis_solicitudes()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;

    RETURN jsonb_build_object('ok', true, 'solicitudes', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                   'id',          r.id,
                   'numero',      r.numero,
                   'estado',      r.estado,
                   'detalles',    r.detalles,
                   'created_at',  r.created_at,
                   'revisada_at', r.revisada_at,
                   -- El departamento no se borra en cascada sin llevarse la
                   -- solicitud (FK ON DELETE CASCADE), así que siempre está.
                   'departamento', jsonb_build_object(
                       'id', d.id, 'nombre', d.nombre, 'color', d.color, 'icono', d.icono),
                   -- Si la prioridad se borró, queda el nombre que se pidió:
                   -- la persona ve lo que eligió, no un hueco.
                   'prioridad', CASE
                       WHEN p.id IS NOT NULL
                           THEN jsonb_build_object('id', p.id, 'nombre', p.nombre, 'color', p.color)
                       WHEN r.prioridad_nombre IS NOT NULL
                           THEN jsonb_build_object('id', NULL, 'nombre', r.prioridad_nombre, 'color', NULL)
                   END,
                   -- La tarea que salió de este pedido, si ya la crearon.
                   'tarea', CASE WHEN t.id IS NOT NULL THEN jsonb_build_object(
                       'nombre', t.nombre, 'estado', t.estado, 'fecha', t.fecha) END)
               ORDER BY r.created_at DESC)
          FROM public.agenda_solicitudes r
          JOIN public.agenda_departamentos d ON d.id = r.departamento_id
          LEFT JOIN public.agenda_prioridades p ON p.id = r.prioridad_id
          LEFT JOIN public.agenda_tareas t     ON t.id = r.tarea_id
         WHERE r.solicitante_id = auth.uid()), '[]'::jsonb));
END;
$$;

-- CREATE OR REPLACE le devuelve EXECUTE a PUBLIC, y Supabase se lo da aparte
-- a anon y authenticated (regla 12.3): se revoca a los tres y se da a uno.
REVOKE EXECUTE ON FUNCTION public.agenda_mis_solicitudes() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.agenda_mis_solicitudes() TO authenticated;

COMMENT ON FUNCTION public.agenda_mis_solicitudes() IS
    'Las solicitudes que hizo quien llama, de la más nueva a la más vieja. Única lectura de agenda_solicitudes del lado de quien pide.';
