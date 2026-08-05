-- RPC de reversión de check-in para Día del Niño.
-- "Desacreditar" vuelve un ticket de CHECKED_IN a PENDING
-- (corregir errores de tildado, o limpiar datos de prueba).
-- Mismo patrón que checkin_dianino_ticket (ver
-- create_dianino_tables.sql ~línea 245): SECURITY DEFINER,
-- chequeo de is_dianino_staff() adentro, UPDATE atómico con
-- WHERE status = '...' para evitar carreras.

CREATE OR REPLACE FUNCTION public.uncheckin_dianino_ticket(p_ticket_id UUID)
RETURNS TABLE (
    result TEXT,  -- 'SUCCESS' | 'ALREADY_PENDING' | 'NOT_FOUND'
    first_name TEXT,
    last_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated public.dianino_tickets%ROWTYPE;
    v_existing public.dianino_tickets%ROWTYPE;
BEGIN
    IF NOT public.is_dianino_staff() THEN
        RAISE EXCEPTION 'No tenés permisos para desacreditar entradas';
    END IF;

    UPDATE public.dianino_tickets
    SET status = 'PENDING', checked_in_at = NULL, checked_in_by = NULL
    WHERE id = p_ticket_id AND status = 'CHECKED_IN'
    RETURNING * INTO v_updated;

    IF FOUND THEN
        RETURN QUERY SELECT 'SUCCESS'::TEXT, v_updated.first_name, v_updated.last_name;
        RETURN;
    END IF;

    SELECT * INTO v_existing FROM public.dianino_tickets WHERE id = p_ticket_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 'NOT_FOUND'::TEXT, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    RETURN QUERY SELECT 'ALREADY_PENDING'::TEXT, v_existing.first_name, v_existing.last_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.uncheckin_dianino_ticket(UUID) TO authenticated;

-- ── Verificación estructural ─────────────────────────────────
SELECT proname FROM pg_proc WHERE proname = 'uncheckin_dianino_ticket';

-- ── Verificación funcional (YA EJECUTADA contra el proyecto
-- real oqtumgalnozppqnnjjdb, simulando cada rol con
-- BEGIN...ROLLBACK — sin tocar datos reales) ─────────────────
-- 1. Ticket CHECKED_IN ('Tadeo GC') como SUPER_ADMIN → SUCCESS.
-- 2. Mismo ticket, ya PENDING tras el paso 1 → ALREADY_PENDING
--    (confirma que el revert del paso 1 tomó efecto de verdad).
-- 3. UUID inexistente → NOT_FOUND.
-- 4. Usuario VIEWER (sin rol de Eventos) → falla con
--    "No tenés permisos para desacreditar entradas" (P0001).
