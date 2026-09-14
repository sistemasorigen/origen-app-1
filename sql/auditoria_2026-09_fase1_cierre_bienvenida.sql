-- ============================================================================
-- Auditoría 2026-09 — FASE 1, paso final: cerrar welcome_visitors al público
--
-- Correr DESPUÉS de desplegar el frontend que usa
-- completar_formulario_bienvenida(). Si se corre antes, el formulario /form
-- que está en producción deja de encontrar a las personas.
--
-- Elimina:
-- · welcome_visitors_public_search: SELECT a anon con USING (true). Exponía
--   los 77 registros completos (nombre, teléfono, email, pedido de oración…).
-- · welcome_visitors_public_fill_form: UPDATE a anon sobre cualquier fila en
--   etapa NEW/FILLED_FORM, sin saber de quién era.
-- Y quita a anon la ejecución de search_welcome_visitor, que devolvía los
-- teléfonos de todas las personas con un nombre dado.
-- ============================================================================

DROP POLICY IF EXISTS welcome_visitors_public_search ON public.welcome_visitors;
DROP POLICY IF EXISTS welcome_visitors_public_fill_form ON public.welcome_visitors;

REVOKE EXECUTE ON FUNCTION public.search_welcome_visitor(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_welcome_visitor(text, text) TO authenticated;
