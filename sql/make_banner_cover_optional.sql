-- ============================================================
-- PORTADA DE VIDEO OPCIONAL — home_musica_banner_slides + ninez_banner_slides
-- ============================================================
-- La portada/poster de un slide de tipo 'video' deja de ser obligatoria.
-- Sin ella, el fallback público es directamente pantalla negra:
--   - components/ui/CarruselHero.tsx (banner principal del Home y Niñez,
--     que reusa este mismo carrusel): poster={slide.imageUrl || undefined},
--     wrapper con bg-black.
--   - pages/home/Home.tsx, MusicaCarousel: mismo criterio.
-- Sigue siendo requerida a nivel de aplicación para slides de tipo 'image'
-- (ahí la imagen ES el contenido, no una portada) — esa regla se valida en
-- el cliente (Administrador.tsx / ConfiguracionNinez.tsx), no en la base.
--
-- El banner principal (config.banner.slides) no tiene tabla propia — vive
-- como JSON dentro de app_config, así que no hay columna que migrar ahí.
-- ============================================================

ALTER TABLE public.home_musica_banner_slides ALTER COLUMN media_url DROP NOT NULL;
ALTER TABLE public.ninez_banner_slides ALTER COLUMN image_url DROP NOT NULL;


-- ── Verificación (YA EJECUTADA contra oqtumgalnozppqnnjjdb) ──
-- SELECT table_name, column_name, is_nullable FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name IN ('home_musica_banner_slides', 'ninez_banner_slides')
--   AND column_name IN ('media_url', 'image_url');
-- → ambas columnas quedaron is_nullable = 'YES'.
