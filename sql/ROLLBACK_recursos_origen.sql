-- ════════════════════════════════════════════════════════════════════════
-- VUELTA ATRÁS de sql/recursos_origen.sql
-- ════════════════════════════════════════════════════════════════════════
--
-- Borra la tabla, con todos los recursos cargados desde el panel, y las
-- políticas del bucket. Antes hay que volver el front al commit anterior: el
-- inicio vuelve a leer app_config.config.youversBanner, que nunca se borró, y
-- "Origen en Youvers" aparece igual que estaba. Un slide cargado después de la
-- migración, sólo en recursos_origen, se pierde.
--
-- Si lo que se quiere es apagar el bloque sin perder nada, NO correr esto:
-- alcanza con UPDATE public.recursos_origen SET visible = false.
--
-- El bucket no se borra acá. La base no deja borrar objetos a mano
-- (storage.protect_delete) y un bucket con archivos no se puede borrar: si
-- hace falta, primero se vacía desde el panel de Supabase y después se corre
-- la última línea, que quedó comentada a propósito.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

DROP POLICY IF EXISTS recursos_bucket_lectura ON storage.objects;
DROP POLICY IF EXISTS recursos_bucket_subida  ON storage.objects;
DROP POLICY IF EXISTS recursos_bucket_cambio  ON storage.objects;
DROP POLICY IF EXISTS recursos_bucket_borrado ON storage.objects;

DROP TABLE IF EXISTS public.recursos_origen;

-- DELETE FROM storage.buckets WHERE id = 'recursos';

COMMIT;
