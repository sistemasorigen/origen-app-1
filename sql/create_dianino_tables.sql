-- ============================================================
-- EVENTO "DÍA DEL NIÑO" — esquema completo
-- ============================================================
-- Inscripción + entrada por QR, sin cupo. Un adulto responsable
-- se inscribe a sí mismo y a sus niños en una sola sesión. Cada
-- persona es un ticket individual con su propio QR.
--
-- Decisión de arquitectura: los datos incluyen DNI de menores,
-- así que NO hay ninguna policy de RLS para `anon`. Todo el
-- acceso público pasa por RPCs SECURITY DEFINER acotados, que
-- devuelven exactamente lo necesario y nada más.
-- ============================================================


-- ── PASO 1 — Tablas ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dianino_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    declaracion_jurada_aceptada BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dianino_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.dianino_sessions(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    dni TEXT NOT NULL,
    is_adult BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CHECKED_IN')),
    checked_in_at TIMESTAMPTZ,
    checked_in_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT dianino_tickets_dni_unique UNIQUE (dni)
);

CREATE INDEX IF NOT EXISTS idx_dianino_tickets_session ON public.dianino_tickets(session_id);
CREATE INDEX IF NOT EXISTS idx_dianino_tickets_dni ON public.dianino_tickets(dni);

COMMENT ON TABLE public.dianino_sessions IS 'Evento Día del Niño: una fila por sesión de inscripción (1 adulto + N niños). El nombre/DNI de cada persona vive en dianino_tickets, no acá.';
COMMENT ON TABLE public.dianino_tickets IS 'Un ticket por persona inscripta (adulto o niño). El id de cada fila es el contenido del QR. dni es UNIQUE global — no se permite duplicar entre sesiones distintas ni dentro de la misma sesión.';


-- ── PASO 2 — RLS ────────────────────────────────────────────

ALTER TABLE public.dianino_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dianino_tickets ENABLE ROW LEVEL SECURITY;

-- Helper de rol. Chequea las DOS columnas de users: `role`
-- (enum singular) y `roles` (text[]). Es imprescindible: los
-- usuarios con Eventos lo tienen en `roles[]` y su `role`
-- singular es otro (INFLUOS, ANFITRION...), así que mirar solo
-- `role` los dejaría afuera. Es el mismo criterio que hasRole()
-- en services/authUtils.ts.
-- SECURITY DEFINER para que la consulta a `users` dentro de una
-- policy no quede sujeta a la RLS de `users`.
CREATE OR REPLACE FUNCTION public.is_dianino_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND (
                u.role::text = ANY (ARRAY['SUPER_ADMIN','PASTOR','ENCARGADO_EVENTOS'])
             OR u.roles      && ARRAY['SUPER_ADMIN','PASTOR','ENCARGADO_EVENTOS']
          )
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_dianino_staff() TO authenticated;

CREATE POLICY "dianino_staff_all_sessions" ON public.dianino_sessions
FOR ALL TO authenticated
USING (public.is_dianino_staff())
WITH CHECK (public.is_dianino_staff());

CREATE POLICY "dianino_staff_all_tickets" ON public.dianino_tickets
FOR ALL TO authenticated
USING (public.is_dianino_staff())
WITH CHECK (public.is_dianino_staff());

-- No se crea NINGUNA policy para `anon` en ninguna de las 2
-- tablas. Ver la nota de arquitectura al inicio del archivo.


-- ── PASO 3A — Chequeo de DNI disponible ─────────────────────

CREATE OR REPLACE FUNCTION public.check_dianino_dni_available(p_dni TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT NOT EXISTS (
        SELECT 1 FROM public.dianino_tickets WHERE dni = btrim(p_dni)
    );
$$;

GRANT EXECUTE ON FUNCTION public.check_dianino_dni_available(TEXT) TO anon, authenticated;


-- ── PASO 3B — Registro atómico de la sesión ─────────────────
-- Valida TODOS los DNIs (adulto + cada niño) ANTES de insertar
-- nada, y devuelve el DNI puntual que chocó. No depende de
-- parsear el error de Postgres.

CREATE OR REPLACE FUNCTION public.register_dianino_session(
    p_email TEXT,
    p_declaracion_aceptada BOOLEAN,
    p_adult JSONB,          -- { "firstName": "...", "lastName": "...", "dni": "..." }
    p_children JSONB        -- [{ "firstName": "...", "lastName": "...", "dni": "..." }, ...]
)
RETURNS TABLE (session_id UUID, error_dni TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session_id UUID;
    v_child JSONB;
    v_dnis TEXT[];
    v_dup TEXT;
BEGIN
    -- Juntar todos los DNIs normalizados, adulto primero.
    v_dnis := ARRAY[ btrim(p_adult->>'dni') ];
    FOR v_child IN SELECT * FROM jsonb_array_elements(COALESCE(p_children, '[]'::jsonb))
    LOOP
        v_dnis := v_dnis || btrim(v_child->>'dni');
    END LOOP;

    -- 1) Duplicado DENTRO del mismo envío (el UNIQUE de la tabla
    --    lo atraparía igual, pero acá sabemos cuál es).
    SELECT d INTO v_dup
    FROM unnest(v_dnis) AS d
    GROUP BY d HAVING count(*) > 1
    LIMIT 1;

    IF v_dup IS NOT NULL THEN
        RETURN QUERY SELECT NULL::UUID, v_dup;
        RETURN;
    END IF;

    -- 2) Duplicado contra lo ya inscripto en el evento.
    SELECT t.dni INTO v_dup
    FROM public.dianino_tickets t
    WHERE t.dni = ANY (v_dnis)
    LIMIT 1;

    IF v_dup IS NOT NULL THEN
        RETURN QUERY SELECT NULL::UUID, v_dup;
        RETURN;
    END IF;

    -- Sub-bloque con EXCEPTION: si algo falla acá adentro,
    -- Postgres revierte también el INSERT de la sesión, así que
    -- no quedan sesiones huérfanas sin tickets.
    BEGIN
        INSERT INTO public.dianino_sessions (email, declaracion_jurada_aceptada)
        VALUES (btrim(p_email), p_declaracion_aceptada)
        RETURNING id INTO v_session_id;

        INSERT INTO public.dianino_tickets (session_id, first_name, last_name, dni, is_adult)
        VALUES (
            v_session_id,
            btrim(p_adult->>'firstName'),
            btrim(p_adult->>'lastName'),
            btrim(p_adult->>'dni'),
            true
        );

        FOR v_child IN SELECT * FROM jsonb_array_elements(COALESCE(p_children, '[]'::jsonb))
        LOOP
            INSERT INTO public.dianino_tickets (session_id, first_name, last_name, dni, is_adult)
            VALUES (
                v_session_id,
                btrim(v_child->>'firstName'),
                btrim(v_child->>'lastName'),
                btrim(v_child->>'dni'),
                false
            );
        END LOOP;
    EXCEPTION
        WHEN unique_violation THEN
            -- Solo se llega acá por carrera: dos envíos simultáneos
            -- con el mismo DNI que pasaron la validación previa.
            SELECT t.dni INTO v_dup
            FROM public.dianino_tickets t
            WHERE t.dni = ANY (v_dnis)
            LIMIT 1;
            RETURN QUERY SELECT NULL::UUID, COALESCE(v_dup, btrim(p_adult->>'dni'));
            RETURN;
    END;

    RETURN QUERY SELECT v_session_id, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_dianino_session(TEXT, BOOLEAN, JSONB, JSONB) TO anon, authenticated;


-- ── PASO 3C — Auto-consulta ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.search_dianino_session(
    p_first_name TEXT,
    p_last_name TEXT,
    p_dni TEXT
)
RETURNS TABLE (
    ticket_id UUID,
    first_name TEXT,
    last_name TEXT,
    is_adult BOOLEAN,
    status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT t.id, t.first_name, t.last_name, t.is_adult, t.status
    FROM public.dianino_tickets t
    WHERE t.session_id = (
        SELECT adult.session_id
        FROM public.dianino_tickets adult
        WHERE adult.is_adult = true
          AND lower(btrim(adult.first_name)) = lower(btrim(p_first_name))
          AND lower(btrim(adult.last_name))  = lower(btrim(p_last_name))
          AND adult.dni = btrim(p_dni)
        LIMIT 1
    )
    ORDER BY t.is_adult DESC, t.first_name;
$$;

GRANT EXECUTE ON FUNCTION public.search_dianino_session(TEXT, TEXT, TEXT) TO anon, authenticated;


-- ── PASO 3D — Check-in atómico (escáner) ────────────────────

CREATE OR REPLACE FUNCTION public.checkin_dianino_ticket(p_ticket_id UUID)
RETURNS TABLE (
    result TEXT,  -- 'SUCCESS' | 'ALREADY_CHECKED_IN' | 'NOT_FOUND'
    first_name TEXT,
    last_name TEXT,
    is_adult BOOLEAN,
    declaracion_jurada_aceptada BOOLEAN,
    checked_in_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated public.dianino_tickets%ROWTYPE;
    v_existing public.dianino_tickets%ROWTYPE;
    v_declaracion BOOLEAN;
BEGIN
    -- La función es SECURITY DEFINER, así que el chequeo de rol
    -- va explícito acá adentro: el GRANT es a `authenticated` en
    -- general, pero solo el staff de Eventos puede escanear.
    IF NOT public.is_dianino_staff() THEN
        RAISE EXCEPTION 'No tenés permisos para escanear entradas';
    END IF;

    UPDATE public.dianino_tickets
    SET status = 'CHECKED_IN', checked_in_at = now(), checked_in_by = auth.uid()
    WHERE id = p_ticket_id AND status = 'PENDING'
    RETURNING * INTO v_updated;

    IF FOUND THEN
        SELECT s.declaracion_jurada_aceptada INTO v_declaracion
        FROM public.dianino_sessions s WHERE s.id = v_updated.session_id;

        RETURN QUERY SELECT 'SUCCESS'::TEXT, v_updated.first_name, v_updated.last_name,
            v_updated.is_adult, v_declaracion, v_updated.checked_in_at;
        RETURN;
    END IF;

    SELECT * INTO v_existing FROM public.dianino_tickets WHERE id = p_ticket_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 'NOT_FOUND'::TEXT, NULL::TEXT, NULL::TEXT, NULL::BOOLEAN, NULL::BOOLEAN, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    SELECT s.declaracion_jurada_aceptada INTO v_declaracion
    FROM public.dianino_sessions s WHERE s.id = v_existing.session_id;

    RETURN QUERY SELECT 'ALREADY_CHECKED_IN'::TEXT, v_existing.first_name, v_existing.last_name,
        v_existing.is_adult, v_declaracion, v_existing.checked_in_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.checkin_dianino_ticket(UUID) TO authenticated;
