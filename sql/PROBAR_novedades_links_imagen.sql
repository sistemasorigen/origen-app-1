-- ════════════════════════════════════════════════════════════════════════
-- PRUEBAS de sql/novedades_links_imagen.sql
-- ════════════════════════════════════════════════════════════════════════
--
-- Dos preguntas:
--
--   A · ¿Entra cualquier cosa como imagen?  Se le tiran cuatro urls
--       peligrosas y tres encuadres imposibles, y los siete tienen que
--       rebotar. Una https de verdad, con su encuadre, tiene que entrar.
--
--   B · ¿Sigue funcionando lo de antes?  Un enlace sin imagen se guarda
--       igual y arranca con el encuadre del medio (50/50, zoom 1), que es
--       lo que espera la pantalla.
--
-- Todo se deshace solo: el script TERMINA SIEMPRE EN EXCEPCIÓN a propósito.
-- Si algo falla, el mensaje empieza con "FALLÓ".
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

DO $prueba$
DECLARE
    mal       record;
    rebotaron int := 0;
    colados   text := '';
    id_nuevo  uuid;
    sin_img   record;
    con_img   record;
    entro     boolean := false;
    fallas    text := '';
    reporte   text := '';
BEGIN
    -- ── A · Lo que no puede entrar ──────────────────────────────────────
    FOR mal IN
        SELECT * FROM (VALUES
            ('http://cdn.x.com/foto.jpg', 50,  50,  1.0),
            ('javascript:alert(1)',       50,  50,  1.0),
            ('//cdn.x.com/foto.jpg',      50,  50,  1.0),
            ('https://',                  50,  50,  1.0),
            ('https://cdn.x.com/f.jpg',  150,  50,  1.0),
            ('https://cdn.x.com/f.jpg',   50,  -1,  1.0),
            ('https://cdn.x.com/f.jpg',   50,  50,  9.0)
        ) AS v(img, fx, fy, z)
    LOOP
        BEGIN
            INSERT INTO public.novedades_links (titulo, tipo_destino, destino, imagen_url, focal_x, focal_y, zoom)
            VALUES ('PRUEBA imagen mala', 'interno', '/eventos', mal.img, mal.fx, mal.fy, mal.z);
            colados := colados || ' · ' || mal.img || ' ' || mal.fx || '/' || mal.fy || ' x' || mal.z;
        EXCEPTION WHEN check_violation OR numeric_value_out_of_range THEN
            rebotaron := rebotaron + 1;
        END;
    END LOOP;

    -- ── Una buena, con su encuadre ──────────────────────────────────────
    BEGIN
        INSERT INTO public.novedades_links (titulo, tipo_destino, destino, imagen_url, focal_x, focal_y, zoom)
        VALUES ('PRUEBA con imagen', 'externo', 'https://forms.gle/prueba',
                'https://oqtumgalnozppqnnjjdb.supabase.co/storage/v1/object/public/media/enlaces/prueba.jpg',
                30, 70, 1.4)
        RETURNING id INTO id_nuevo;
        entro := true;
    EXCEPTION WHEN OTHERS THEN
        entro := false;
    END;

    SELECT imagen_url, focal_x, focal_y, zoom INTO con_img
      FROM public.novedades_links WHERE id = id_nuevo;

    -- ── B · Sin imagen, como siempre ────────────────────────────────────
    INSERT INTO public.novedades_links (titulo, tipo_destino, destino)
    VALUES ('PRUEBA sin imagen', 'interno', '/eventos');

    SELECT imagen_url, focal_x, focal_y, zoom INTO sin_img
      FROM public.novedades_links WHERE titulo = 'PRUEBA sin imagen';

    -- ── El veredicto ────────────────────────────────────────────────────
    IF rebotaron <> 7 THEN fallas := fallas || ' · ENTRARON imágenes o encuadres prohibidos:' || colados; END IF;
    IF NOT entro    THEN fallas := fallas || ' · no entró una imagen válida'; END IF;
    IF con_img.focal_x <> 30 OR con_img.focal_y <> 70 OR con_img.zoom <> 1.4 THEN
        fallas := fallas || ' · el encuadre no se guardó como se mandó';
    END IF;
    IF sin_img.imagen_url IS NOT NULL THEN fallas := fallas || ' · sin imagen quedó con imagen'; END IF;
    IF sin_img.focal_x <> 50 OR sin_img.focal_y <> 50 OR sin_img.zoom <> 1 THEN
        fallas := fallas || ' · el encuadre por defecto no es 50/50 zoom 1';
    END IF;

    reporte := format(
        'imágenes y encuadres prohibidos rebotados: %s/7 | una buena entró: %s, con encuadre %s/%s x%s | sin imagen: url %s, encuadre %s/%s x%s',
        rebotaron,
        CASE WHEN entro THEN 'sí' ELSE 'NO' END,
        con_img.focal_x, con_img.focal_y, con_img.zoom,
        COALESCE(sin_img.imagen_url, 'vacía'), sin_img.focal_x, sin_img.focal_y, sin_img.zoom);

    IF fallas <> '' THEN
        RAISE EXCEPTION 'FALLÓ:%  —  %', fallas, reporte;
    END IF;

    RAISE EXCEPTION 'TODO BIEN. %', reporte;
END
$prueba$;

ROLLBACK;
