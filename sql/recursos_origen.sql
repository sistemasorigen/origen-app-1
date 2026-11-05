-- ════════════════════════════════════════════════════════════════════════
-- RECURSOS ORIGEN · el material de Origen y los podcasts de los pastores
-- ════════════════════════════════════════════════════════════════════════
--
-- ✅ APLICADO en producción el 2026-11-05, y probado ahí con PROBAR_.
--
-- Reemplaza al bloque "Origen en Youvers" del inicio. Sigue el patrón de
-- novedades_links, con cuatro tipos: link, archivo (PDF o imagen), video de
-- YouTube y podcast de Spotify. Lo carga sólo Sistemas (SUPER_ADMIN) y lo lee
-- cualquiera, con sesión o sin ella.
--
-- Cuatro cosas que no son obvias:
--
-- 1 · El destino está acotado por un CHECK según el tipo. Termina adentro de
--     un window.open o de un iframe, así que la base no acepta otra cosa. El
--     front vuelve a mirar lo mismo (services/recursos.ts): son dos barreras
--     para lo mismo, a propósito. Si se toca una, se toca la otra.
--
-- 2 · Los archivos van a un bucket propio, público para leer: es material para
--     difundir y se comparte con su URL. Leer por URL pública NO pasa por las
--     políticas de storage.objects; por eso el SELECT de abajo es sólo para
--     SUPER_ADMIN: nadie más puede LISTAR el bucket, y un recurso oculto no
--     se descubre por su nombre. El SELECT del admin es además lo que permite
--     borrar: la API de Storage busca el objeto antes de borrarlo.
--
-- 3 · La migración copia los slides de app_config.config.youversBanner, con el
--     id del slide como id del recurso: correr esto de nuevo no duplica nada.
--     youversBanner NO se borra (queda para la vuelta atrás); sólo se deja de
--     leer.
--
-- 4 · No hay vencimiento: a diferencia de un enlace, un recurso no caduca.
--
-- Vuelta atrás: sql/ROLLBACK_recursos_origen.sql
-- Pruebas:      sql/PROBAR_recursos_origen.sql
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · La tabla ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.recursos_origen (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo       text NOT NULL,
    descripcion  text,
    tipo         text NOT NULL,
    -- Derivada del tipo. El inicio no la usa: muestra todo en un solo carrusel.
    categoria    text NOT NULL,
    destino      text NOT NULL,
    -- La portada de la tarjeta, con su encuadre. NULL = tarjeta blanca.
    imagen_url   text,
    focal_x      smallint      NOT NULL DEFAULT 50,
    focal_y      smallint      NOT NULL DEFAULT 50,
    zoom         numeric(3, 2) NOT NULL DEFAULT 1,
    -- Sólo tipo 'archivo'. El path es lo que permite borrarlo del bucket.
    archivo_path text,
    archivo_tipo text,
    -- Sólo tipo 'podcast'.
    pastor       text,
    duracion     text,
    visible      boolean NOT NULL DEFAULT true,
    orden        integer NOT NULL DEFAULT 0,
    created_at   timestamptz DEFAULT now(),
    updated_at   timestamptz DEFAULT now(),
    created_by   uuid DEFAULT auth.uid(),

    CONSTRAINT recursos_origen_titulo_largo
        CHECK (char_length(titulo) BETWEEN 1 AND 60),
    CONSTRAINT recursos_origen_descripcion_larga
        CHECK (descripcion IS NULL OR char_length(descripcion) <= 140),
    CONSTRAINT recursos_origen_tipo
        CHECK (tipo IN ('link', 'archivo', 'video', 'podcast')),
    CONSTRAINT recursos_origen_categoria_del_tipo CHECK (
           (tipo =  'podcast' AND categoria = 'podcast')
        OR (tipo <> 'podcast' AND categoria = 'material')
    ),

    -- La barrera. Las mismas reglas que services/recursos.ts.
    CONSTRAINT recursos_origen_destino_valido CHECK (
           (tipo = 'link'    AND (destino ~ '^/[^/\s]' OR destino ~* '^https://[^/\s]+'))
        OR (tipo = 'archivo' AND destino ~* '^https://[^/\s]+/storage/v1/object/public/recursos/[^\s]+$')
        OR (tipo = 'video'   AND destino ~ '^https://(www\.|m\.)?(youtube\.com/(watch\?([^\s#]*&)?v=|shorts/|live/|embed/)|youtu\.be/)[A-Za-z0-9_-]{11}([?&#/][^\s]*)?$')
        OR (tipo = 'podcast' AND destino ~ '^https://open\.spotify\.com/episode/[A-Za-z0-9]{22}(\?[^\s]*)?$')
    ),

    CONSTRAINT recursos_origen_imagen_valida
        CHECK (imagen_url IS NULL OR imagen_url ~* '^https://[^/\s]+'),
    CONSTRAINT recursos_origen_encuadre_valido
        CHECK (focal_x BETWEEN 0 AND 100
           AND focal_y BETWEEN 0 AND 100
           AND zoom    BETWEEN 1 AND 3),

    -- El archivo viene entero o no viene, y sólo en los de tipo archivo.
    CONSTRAINT recursos_origen_archivo_del_tipo CHECK (
           (tipo =  'archivo' AND archivo_path IS NOT NULL AND char_length(archivo_path) >= 1
                              -- El IS NOT NULL hace falta: NULL IN (...) da NULL, y un
                              -- CHECK deja pasar lo que da NULL.
                              AND archivo_tipo IS NOT NULL AND archivo_tipo IN ('pdf', 'imagen'))
        OR (tipo <> 'archivo' AND archivo_path IS NULL AND archivo_tipo IS NULL)
    ),

    -- El pastor es obligatorio en un podcast; la duración, no.
    CONSTRAINT recursos_origen_podcast_del_tipo CHECK (
           (tipo =  'podcast' AND pastor IS NOT NULL AND char_length(btrim(pastor)) BETWEEN 1 AND 60
                              AND (duracion IS NULL OR char_length(duracion) <= 20))
        OR (tipo <> 'podcast' AND pastor IS NULL AND duracion IS NULL)
    )
);

COMMENT ON TABLE public.recursos_origen IS
    'Recursos Origen del inicio: link, archivo, video o podcast. Los carga un SUPER_ADMIN; los visibles los lee todo el mundo.';
COMMENT ON COLUMN public.recursos_origen.categoria IS
    'material (link, archivo, video) o podcast. Derivada del tipo, con CHECK.';
COMMENT ON COLUMN public.recursos_origen.archivo_path IS
    'Path dentro del bucket recursos, para poder borrar el archivo junto con la fila.';

CREATE INDEX IF NOT EXISTS recursos_origen_orden_idx
    ON public.recursos_origen (orden, created_at);

-- ── 2 · updated_at ──────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS recursos_origen_updated_at ON public.recursos_origen;
CREATE TRIGGER recursos_origen_updated_at
    BEFORE UPDATE ON public.recursos_origen
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── 3 · Quién ve qué ────────────────────────────────────────────────────

ALTER TABLE public.recursos_origen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recursos_origen_publico       ON public.recursos_origen;
DROP POLICY IF EXISTS recursos_origen_admin_lectura ON public.recursos_origen;
DROP POLICY IF EXISTS recursos_origen_admin_alta    ON public.recursos_origen;
DROP POLICY IF EXISTS recursos_origen_admin_edicion ON public.recursos_origen;
DROP POLICY IF EXISTS recursos_origen_admin_baja    ON public.recursos_origen;

CREATE POLICY recursos_origen_publico ON public.recursos_origen
    FOR SELECT TO anon, authenticated
    USING (visible);

CREATE POLICY recursos_origen_admin_lectura ON public.recursos_origen
    FOR SELECT TO authenticated
    USING (public.tiene_rol(ARRAY['SUPER_ADMIN']));

CREATE POLICY recursos_origen_admin_alta ON public.recursos_origen
    FOR INSERT TO authenticated
    WITH CHECK (public.tiene_rol(ARRAY['SUPER_ADMIN']));

CREATE POLICY recursos_origen_admin_edicion ON public.recursos_origen
    FOR UPDATE TO authenticated
    USING (public.tiene_rol(ARRAY['SUPER_ADMIN']))
    WITH CHECK (public.tiene_rol(ARRAY['SUPER_ADMIN']));

CREATE POLICY recursos_origen_admin_baja ON public.recursos_origen
    FOR DELETE TO authenticated
    USING (public.tiene_rol(ARRAY['SUPER_ADMIN']));

REVOKE ALL ON public.recursos_origen FROM anon, authenticated;
GRANT SELECT                         ON public.recursos_origen TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recursos_origen TO authenticated;

-- ── 4 · El bucket ───────────────────────────────────────────────────────
-- 20 MB = 20971520 bytes. El mismo tope y los mismos tipos que el front.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('recursos', 'recursos', true, 20971520,
        ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
    SET public = EXCLUDED.public,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS recursos_bucket_lectura ON storage.objects;
DROP POLICY IF EXISTS recursos_bucket_subida  ON storage.objects;
DROP POLICY IF EXISTS recursos_bucket_cambio  ON storage.objects;
DROP POLICY IF EXISTS recursos_bucket_borrado ON storage.objects;

CREATE POLICY recursos_bucket_lectura ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'recursos' AND public.tiene_rol(ARRAY['SUPER_ADMIN']));

CREATE POLICY recursos_bucket_subida ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'recursos' AND public.tiene_rol(ARRAY['SUPER_ADMIN']));

CREATE POLICY recursos_bucket_cambio ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'recursos' AND public.tiene_rol(ARRAY['SUPER_ADMIN']))
    WITH CHECK (bucket_id = 'recursos' AND public.tiene_rol(ARRAY['SUPER_ADMIN']));

CREATE POLICY recursos_bucket_borrado ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'recursos' AND public.tiene_rol(ARRAY['SUPER_ADMIN']));

-- ── 5 · La migración ────────────────────────────────────────────────────
-- Cada slide pasa a ser un recurso de tipo link, en el mismo orden. Se lee de
-- la fila 'global', que es la única que lee la app. Si algún slide no entrara
-- en los CHECKs, este INSERT revienta y no se aplica nada: no se pierde
-- ninguno en silencio.

INSERT INTO public.recursos_origen
    (id, titulo, tipo, categoria, destino, imagen_url, focal_x, focal_y, zoom, orden)
SELECT
    (s.slide ->> 'id')::uuid,
    s.slide ->> 'title',
    'link',
    'material',
    s.slide ->> 'targetUrl',
    NULLIF(s.slide ->> 'imageUrl', ''),
    COALESCE(round((s.slide ->> 'focalX')::numeric)::smallint, 50),
    COALESCE(round((s.slide ->> 'focalY')::numeric)::smallint, 50),
    COALESCE((s.slide ->> 'zoom')::numeric, 1),
    (s.posicion - 1)::integer
FROM public.app_config c
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c.config -> 'youversBanner' -> 'slides', '[]'::jsonb))
    WITH ORDINALITY AS s (slide, posicion)
WHERE c.id = 'global'
ON CONFLICT (id) DO NOTHING;

COMMIT;
