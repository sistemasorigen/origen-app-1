-- ════════════════════════════════════════════════════════════════════════
-- ENLACES ORIGEN · imagen de fondo con encuadre
-- ════════════════════════════════════════════════════════════════════════
--
-- Una tarjeta de enlace puede tener una imagen que ocupa todo el fondo, con
-- el título, la bajada y el botón encima. No es una miniatura: es el fondo.
--
-- Con la imagen viaja su encuadre, igual que en los banners de la home: la
-- proporción del archivo casi nunca es la de la tarjeta, así que sobra
-- imagen y hay que decidir qué parte sobrevive. El punto focal (0-100 %) es
-- lo que se mantiene a la vista y el zoom recorta todavía más.
--
-- La URL está acotada por un CHECK, como el destino: sólo https. Lo que
-- carga el panel sale del storage del proyecto, pero la regla no depende de
-- eso — una imagen es algo que el navegador va a ir a buscar.
--
-- Vuelta atrás: sql/ROLLBACK_novedades_links_imagen.sql
-- Pruebas:      sql/PROBAR_novedades_links_imagen.sql
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.novedades_links
    ADD COLUMN IF NOT EXISTS imagen_url text,
    ADD COLUMN IF NOT EXISTS focal_x    smallint      NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS focal_y    smallint      NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS zoom       numeric(3, 2) NOT NULL DEFAULT 1;

ALTER TABLE public.novedades_links
    DROP CONSTRAINT IF EXISTS novedades_links_imagen_valida,
    DROP CONSTRAINT IF EXISTS novedades_links_encuadre_valido;

ALTER TABLE public.novedades_links
    ADD CONSTRAINT novedades_links_imagen_valida
        CHECK (imagen_url IS NULL OR imagen_url ~* '^https://[^/\s]+'),
    ADD CONSTRAINT novedades_links_encuadre_valido
        CHECK (focal_x BETWEEN 0 AND 100
           AND focal_y BETWEEN 0 AND 100
           AND zoom    BETWEEN 1 AND 3);

COMMENT ON COLUMN public.novedades_links.imagen_url IS
    'Fondo de la tarjeta. NULL = tarjeta blanca, como siempre.';
COMMENT ON COLUMN public.novedades_links.focal_x IS
    'Punto focal horizontal, 0-100 %. Es la parte de la imagen que no se recorta.';
COMMENT ON COLUMN public.novedades_links.zoom IS
    'Acercamiento, 1 a 3. Recorta más todavía, alrededor del punto focal.';

COMMIT;
