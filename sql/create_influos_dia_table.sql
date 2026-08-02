-- ============================================================
-- EVENTO "DÍA DE INFLUOS" — esquema
-- ============================================================
-- 1 persona = 1 inscripción (nombre, apellido, edad, tribu).
-- Sin DNI, sin email, sin QR, sin escáner — es una lista de
-- anotación simple, no un sistema de entradas. Los duplicados
-- por nombre NO se bloquean: el formulario público solo muestra
-- un aviso no bloqueante si ya existe alguien con ese nombre
-- exacto (evita rechazar por homonimia real).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.influos_dia_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    age INTEGER NOT NULL CHECK (age > 0 AND age < 100),
    tribu TEXT NOT NULL CHECK (tribu IN ('Garra', 'Trueno', 'No tengo')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_influos_dia_name ON public.influos_dia_registrations(lower(first_name), lower(last_name));

COMMENT ON TABLE public.influos_dia_registrations IS 'Evento Día de Influos: 1 fila por persona inscripta (nombre, apellido, edad, tribu). Sin QR ni check-in — es solo una lista de anotación.';


-- ── RLS: mismo criterio que Día del Niño ────────────────────
-- Reusa public.is_dianino_staff() (SUPER_ADMIN/PASTOR/
-- ENCARGADO_EVENTOS), ya creada en sql/create_dianino_tables.sql
-- — no hace falta duplicar el chequeo de rol.

ALTER TABLE public.influos_dia_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "influos_dia_staff_all" ON public.influos_dia_registrations
FOR ALL
TO authenticated
USING (public.is_dianino_staff())
WITH CHECK (public.is_dianino_staff());

-- Sin policy para anon — todo el acceso público pasa por los
-- RPCs de abajo.


-- ── RPCs ─────────────────────────────────────────────────────

-- Chequeo NO bloqueante — el frontend lo usa para mostrar un
-- aviso, no para impedir el envío.
CREATE OR REPLACE FUNCTION public.check_influos_name_exists(
    p_first_name TEXT,
    p_last_name TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.influos_dia_registrations
        WHERE lower(btrim(first_name)) = lower(btrim(p_first_name))
        AND lower(btrim(last_name)) = lower(btrim(p_last_name))
    );
$$;

GRANT EXECUTE ON FUNCTION public.check_influos_name_exists(TEXT, TEXT) TO anon, authenticated;

-- Registrar
CREATE OR REPLACE FUNCTION public.register_influos_dia(
    p_first_name TEXT,
    p_last_name TEXT,
    p_age INTEGER,
    p_tribu TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    IF p_tribu NOT IN ('Garra', 'Trueno', 'No tengo') THEN
        RAISE EXCEPTION 'Tribu inválida: %', p_tribu;
    END IF;

    INSERT INTO public.influos_dia_registrations (first_name, last_name, age, tribu)
    VALUES (btrim(p_first_name), btrim(p_last_name), p_age, p_tribu)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_influos_dia(TEXT, TEXT, INTEGER, TEXT) TO anon, authenticated;

-- Auto-consulta (buscar por nombre+apellido)
CREATE OR REPLACE FUNCTION public.search_influos_dia(
    p_first_name TEXT,
    p_last_name TEXT
)
RETURNS TABLE (
    id UUID,
    first_name TEXT,
    last_name TEXT,
    age INTEGER,
    tribu TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT r.id, r.first_name, r.last_name, r.age, r.tribu
    FROM public.influos_dia_registrations r
    WHERE lower(btrim(r.first_name)) = lower(btrim(p_first_name))
    AND lower(btrim(r.last_name)) = lower(btrim(p_last_name));
$$;

GRANT EXECUTE ON FUNCTION public.search_influos_dia(TEXT, TEXT) TO anon, authenticated;


-- ── Verificación ─────────────────────────────────────────────

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'influos_dia_registrations';

SELECT proname FROM pg_proc WHERE proname IN (
    'check_influos_name_exists', 'register_influos_dia', 'search_influos_dia'
);

SELECT policyname, roles, cmd FROM pg_policies
WHERE tablename = 'influos_dia_registrations';

-- Probado de punta a punta contra el proyecto real
-- (oqtumgalnozppqnnjjdb): check→false, register→UUID,
-- check→true, register duplicado→UUID distinto (no bloquea),
-- search case-insensitive→devuelve ambos registros, tribu
-- inválida→excepción "Tribu inválida: Invalida". Datos de
-- prueba borrados al terminar (tabla queda en 0 filas).
