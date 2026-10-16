-- ════════════════════════════════════════════════════════════════════════
-- VUELTA ATRÁS de sql/novedades_links.sql
-- ════════════════════════════════════════════════════════════════════════
--
-- Borra la tabla entera y con ella los links cargados. No hay nada más que
-- deshacer: el trigger y las policies se van con la tabla, y
-- public.handle_updated_at() no es de acá —la usan otras tablas— así que
-- no se toca.
--
-- Si lo que se quiere es apagar la sección sin perder los links, NO correr
-- esto: alcanza con UPDATE public.novedades_links SET visible = false.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

DROP TABLE IF EXISTS public.novedades_links;

COMMIT;
