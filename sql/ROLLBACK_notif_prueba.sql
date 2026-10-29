-- ════════════════════════════════════════════════════════════════════════════
-- DESHACER sql/notif_prueba.sql
-- La pantalla sigue andando: el botón "Enviarme una prueba" avisa que la
-- función no está disponible. Las pruebas que ya se mandaron quedan en
-- app_notifications y notif_push_log.
-- ════════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.notif_probar_texto(text, text, text, uuid);
DROP FUNCTION IF EXISTS public.notif_ejemplos();
