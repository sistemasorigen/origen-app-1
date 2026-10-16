-- ════════════════════════════════════════════════════════════════════════
-- VUELTA ATRÁS de sql/novedades_links_imagen.sql
-- ════════════════════════════════════════════════════════════════════════
--
-- Saca las cuatro columnas de la imagen. Los enlaces quedan como estaban:
-- tarjeta blanca, con el texto solo. Las imágenes que se hayan subido
-- siguen en el storage; esto sólo borra a cuál apuntaba cada enlace.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.novedades_links
    DROP CONSTRAINT IF EXISTS novedades_links_imagen_valida,
    DROP CONSTRAINT IF EXISTS novedades_links_encuadre_valido;

ALTER TABLE public.novedades_links
    DROP COLUMN IF EXISTS imagen_url,
    DROP COLUMN IF EXISTS focal_x,
    DROP COLUMN IF EXISTS focal_y,
    DROP COLUMN IF EXISTS zoom;

COMMIT;
