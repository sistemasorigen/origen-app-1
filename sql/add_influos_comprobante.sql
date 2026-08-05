-- TRIBAL WARS: comprobante de transferencia (entrada paga)
-- Agrega comprobante_url a influos_dia_registrations y un
-- parámetro opcional a register_influos_dia para guardarlo.

ALTER TABLE public.influos_dia_registrations
ADD COLUMN IF NOT EXISTS comprobante_url TEXT;

COMMENT ON COLUMN public.influos_dia_registrations.comprobante_url IS 'URL del comprobante de transferencia subido para el evento Tribal Wars (entrada paga). Puede ser NULL para inscripciones anteriores a este cambio.';

CREATE OR REPLACE FUNCTION public.register_influos_dia(
    p_first_name TEXT,
    p_last_name TEXT,
    p_age INTEGER,
    p_tribu TEXT,
    p_comprobante_url TEXT DEFAULT NULL
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

    INSERT INTO public.influos_dia_registrations (first_name, last_name, age, tribu, comprobante_url)
    VALUES (btrim(p_first_name), btrim(p_last_name), p_age, p_tribu, p_comprobante_url)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_influos_dia(TEXT, TEXT, INTEGER, TEXT, TEXT) TO anon, authenticated;

-- IMPORTANTE: CREATE OR REPLACE FUNCTION con un parámetro nuevo
-- (aunque tenga DEFAULT) NO reemplaza la función existente en
-- Postgres — crea un overload nuevo (identidad = tipos de los
-- argumentos declarados, sin importar los defaults). Sin este
-- DROP, quedarían 2 funciones register_influos_dia (4 args y 5
-- args) y cualquier llamado con exactamente 4 argumentos habría
-- seguido yendo a la versión vieja, que ni siquiera conoce
-- comprobante_url.
DROP FUNCTION IF EXISTS public.register_influos_dia(TEXT, TEXT, INTEGER, TEXT);

-- ── Verificación estructural ─────────────────────────────────
SELECT column_name FROM information_schema.columns
WHERE table_name = 'influos_dia_registrations' AND column_name = 'comprobante_url';

SELECT proname, pg_get_function_identity_arguments(oid) AS args
FROM pg_proc WHERE proname = 'register_influos_dia';
-- → debe devolver UNA sola fila (5 args), no dos.

-- ── Verificación funcional (YA EJECUTADA contra el proyecto
-- real oqtumgalnozppqnnjjdb, dentro de BEGIN...ROLLBACK — sin
-- dejar datos de prueba) ──────────────────────────────────────
-- 1. register_influos_dia('Test','Test',15,'Garra','https://ejemplo.com/comprobante.jpg')
--    → fila creada con comprobante_url = la URL pasada.
-- 2. register_influos_dia('Test2','Test2',15,'Trueno') (sin 5to
--    parámetro) → fila creada con comprobante_url = NULL.
