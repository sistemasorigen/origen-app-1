-- ════════════════════════════════════════════════════════════════════════
-- ASISTENCIA · fecha de aprobación y padrón de cada reunión
-- ════════════════════════════════════════════════════════════════════════
--
-- El problema: los porcentajes de asistencia se calculan contra el padrón de
-- HOY. Quien entra al grupo en la semana 6 figura ausente en las reuniones 1
-- a 5, y como una baja BORRA la fila de group_registrations, después de cada
-- baja los porcentajes viejos cambian solos.
--
-- Esto no arregla ninguna pantalla todavía: deja los dos datos que faltan.
--
--   A · group_registrations.approved_at — cuándo quedó aprobada cada
--       inscripción. NULL significa "desde siempre".
--   B · group_attendance.expected_members — la foto del padrón de esa
--       reunión: quiénes estaban aprobados ESE día. Una vez escrita no se
--       vuelve a calcular, así que una baja posterior ya no la mueve.
--
-- Las dos las pone la base sola, con un trigger. El status cambia en muchos
-- lugares (manage_group_registration_v3, derivar_miembro, inserts del
-- cliente, el "agregar miembro" del admin que inserta y después actualiza a
-- APPROVED): un trigger los cubre a todos y no hay que tocar ninguno.
--
-- Zona horaria: toda comparación de fecha se hace en hora argentina. Ya hubo
-- 27 asistencias guardadas con la fecha corrida por usar UTC.
--
-- El orden importa: los backfills van ANTES de crear los triggers, porque el
-- trigger pisaría lo que el backfill escribe.
--
-- Vuelta atrás: sql/ROLLBACK_asistencia_padron.sql
-- Pruebas:     sql/PROBAR_asistencia_padron.sql
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 2.1 · La columna ────────────────────────────────────────────────────
ALTER TABLE public.group_registrations
    ADD COLUMN IF NOT EXISTS approved_at timestamptz;

COMMENT ON COLUMN public.group_registrations.approved_at IS
    'Cuándo quedó aprobada la inscripción. La pone el trigger '
    'trg_fijar_fecha_aprobacion. NULL = no aprobada, o aprobada desde '
    'siempre (inscripciones viejas sin rastro).';

-- ── 2.2 · Backfill de approved_at ───────────────────────────────────────
--
-- La más temprana entre el alta y la primera reunión en la que esa persona
-- figura presente —como titular o como pareja—. Si alguien ya estaba en una
-- lista de asistencia antes de su propio alta, mandó la reunión: estaba en el
-- grupo. LEAST ignora los NULL; si las dos faltan, queda NULL.
--
-- Se apagan dos triggers AFTER mientras corre, en esta misma transacción:
--
--   · audit_group_registrations_changes escribiría una fila en audit_logs por
--     cada inscripción aprobada, con changed_by NULL: cientos de ediciones
--     fantasma en el registro que sirve justamente para saber quién tocó qué.
--   · trg_update_members_count recalcularía members_count de cada grupo una
--     vez por inscripción, para dejarlo en el mismo número.
--
-- Los dos de email NO se tocan y no hacen falta tocar: notify_gcx_welcome sólo
-- dispara cuando cambia el status —acá no cambia— y notify_host_new_registration
-- es sólo de INSERT. DISABLE adentro de una transacción toma un lock, así que
-- ninguna otra sesión ve la tabla sin triggers, y si algo falla el ROLLBACK los
-- devuelve prendidos.
ALTER TABLE public.group_registrations DISABLE TRIGGER audit_group_registrations_changes;
ALTER TABLE public.group_registrations DISABLE TRIGGER trg_update_members_count;

UPDATE public.group_registrations g
   SET approved_at = LEAST(
           g.timestamp,
           (SELECT MIN(a.date)::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires'
              FROM public.group_attendance a
             WHERE a.group_id = g.group_id
               AND (a.present_members ? g.id
                    OR a.present_members ? (g.id || '-partner')))
       )
 WHERE upper(g.status) = 'APPROVED';

ALTER TABLE public.group_registrations ENABLE TRIGGER audit_group_registrations_changes;
ALTER TABLE public.group_registrations ENABLE TRIGGER trg_update_members_count;

-- ── 2.3 · El trigger de approved_at ─────────────────────────────────────
--
-- Manda la base, no el cliente: lo que venga en approved_at desde afuera se
-- ignora siempre.
CREATE OR REPLACE FUNCTION public.fijar_fecha_aprobacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF upper(NEW.status) = 'APPROVED' THEN
            NEW.approved_at := now();
        ELSE
            NEW.approved_at := NULL;
        END IF;
        RETURN NEW;
    END IF;

    -- UPDATE
    IF upper(NEW.status) IS DISTINCT FROM 'APPROVED' THEN
        -- Dejó de estar aprobada: deja de tener fecha.
        NEW.approved_at := NULL;
    ELSIF upper(OLD.status) IS DISTINCT FROM 'APPROVED' THEN
        -- Recién aprobada.
        NEW.approved_at := now();
    ELSIF NEW.group_id IS DISTINCT FROM OLD.group_id THEN
        -- Sigue aprobada pero se mudó: en el grupo nuevo entra hoy.
        NEW.approved_at := now();
    ELSE
        -- Cualquier otra edición no la toca.
        NEW.approved_at := OLD.approved_at;
    END IF;
    RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_fijar_fecha_aprobacion ON public.group_registrations;
CREATE TRIGGER trg_fijar_fecha_aprobacion
    BEFORE INSERT OR UPDATE ON public.group_registrations
    FOR EACH ROW EXECUTE FUNCTION public.fijar_fecha_aprobacion();

-- ── 2.4 · La columna del padrón ─────────────────────────────────────────
ALTER TABLE public.group_attendance
    ADD COLUMN IF NOT EXISTS expected_members jsonb;

COMMENT ON COLUMN public.group_attendance.expected_members IS
    'Foto del padrón del día de la reunión: ids de inscripción aprobados a esa '
    'fecha, más "<id>-partner" por cada pareja, más cualquier presente que no '
    'estuviera en el padrón. La pone el trigger trg_fijar_padron_reunion y no '
    'se recalcula, para que una baja posterior no mueva porcentajes viejos.';

-- ── 2.5 · Quiénes estaban aprobados ese día ─────────────────────────────
--
-- De uso interno: la llaman los triggers, nadie más.
CREATE OR REPLACE FUNCTION public.padron_de_reunion(p_group_id text, p_date date)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
    SELECT COALESCE(jsonb_agg(v ORDER BY v), '[]'::jsonb)
      FROM (
            SELECT r.id AS v
              FROM public.group_registrations r
             WHERE r.group_id = p_group_id
               AND upper(r.status) = 'APPROVED'
               AND (r.approved_at IS NULL
                    OR (r.approved_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date <= p_date)
            UNION ALL
            -- La pareja va como una persona más, con el sufijo que usa la app.
            SELECT r.id || '-partner'
              FROM public.group_registrations r
             WHERE r.group_id = p_group_id
               AND upper(r.status) = 'APPROVED'
               AND r.partner_data IS NOT NULL
               AND r.partner_data <> 'null'::jsonb
               AND (r.approved_at IS NULL
                    OR (r.approved_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date <= p_date)
           ) q;
$fn$;

REVOKE EXECUTE ON FUNCTION public.padron_de_reunion(text, date) FROM PUBLIC, anon, authenticated;

-- ── 2.6 · Backfill del padrón ───────────────────────────────────────────
--
-- Padrón calculado ∪ presentes. La unión es la que garantiza que nadie que
-- estuvo presente quede afuera del padrón —un porcentaje nunca pasa del
-- 100%— y es la que conserva a quienes después se dieron de baja, que ya no
-- tienen fila donde buscarlos.
UPDATE public.group_attendance a
   SET expected_members = (
           SELECT COALESCE(jsonb_agg(v ORDER BY v), '[]'::jsonb)
             FROM (
                   SELECT x.v FROM jsonb_array_elements_text(
                          public.padron_de_reunion(a.group_id, a.date)) x(v)
                   UNION
                   SELECT y.v FROM jsonb_array_elements_text(
                          COALESCE(a.present_members, '[]'::jsonb)) y(v)
                  ) u
       )
 WHERE a.expected_members IS NULL;

-- ── 2.7 · El trigger del padrón ─────────────────────────────────────────
--
-- Una reunión vieja que se edita NO recalcula su padrón: si lo recalculara,
-- una baja posterior volvería a correr los porcentajes, que es el problema
-- que esto viene a cerrar. Sólo se recalcula si la reunión cambia de fecha o
-- de grupo, porque entonces es otra reunión.
--
-- El cliente guarda con upsert (ON CONFLICT DO UPDATE): ahí corre primero el
-- BEFORE INSERT y después el BEFORE UPDATE con la fila vieja como OLD. Con la
-- regla de arriba, el segundo conserva la foto y sólo suma los presentes
-- nuevos.
CREATE OR REPLACE FUNCTION public.fijar_padron_reunion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    base jsonb;
BEGIN
    IF TG_OP = 'INSERT' THEN
        base := public.padron_de_reunion(NEW.group_id, NEW.date);
    ELSIF NEW.date IS DISTINCT FROM OLD.date
       OR NEW.group_id IS DISTINCT FROM OLD.group_id THEN
        base := public.padron_de_reunion(NEW.group_id, NEW.date);
    ELSE
        base := COALESCE(OLD.expected_members,
                         public.padron_de_reunion(NEW.group_id, NEW.date));
    END IF;

    NEW.expected_members := (
        SELECT COALESCE(jsonb_agg(v ORDER BY v), '[]'::jsonb)
          FROM (
                SELECT x.v FROM jsonb_array_elements_text(
                       COALESCE(base, '[]'::jsonb)) x(v)
                UNION
                SELECT y.v FROM jsonb_array_elements_text(
                       COALESCE(NEW.present_members, '[]'::jsonb)) y(v)
               ) u
    );
    RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_fijar_padron_reunion ON public.group_attendance;
CREATE TRIGGER trg_fijar_padron_reunion
    BEFORE INSERT OR UPDATE ON public.group_attendance
    FOR EACH ROW EXECUTE FUNCTION public.fijar_padron_reunion();

REVOKE EXECUTE ON FUNCTION public.fijar_padron_reunion() FROM PUBLIC, anon, authenticated;

COMMIT;
