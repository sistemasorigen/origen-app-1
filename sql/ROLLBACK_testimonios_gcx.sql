-- ════════════════════════════════════════════════════════════════════════════
-- Deshacer sql/testimonios_gcx.sql
--
-- ⚠️ BORRA TODOS LOS TESTIMONIOS Y SUS CORAZONES. Antes de correrlo, guardar
-- una copia: select * from gcx_testimonios / gcx_testimonios_corazones.
-- Lo que ya quedó en audit_logs no se toca. Los avisos de "Pedido para
-- eliminar un testimonio" que ya están en las campanitas se quedan (con
-- alerta_clave apuntando a una clave que deja de existir, como un aviso viejo).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

DROP FUNCTION IF EXISTS public.testimonios_admin_resolver(uuid, text);
DROP FUNCTION IF EXISTS public.testimonios_admin_listar(text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.testimonios_solicitar_eliminacion(uuid, text);
DROP FUNCTION IF EXISTS public.testimonios_mios();
DROP FUNCTION IF EXISTS public.testimonios_corazon(uuid, boolean);
DROP FUNCTION IF EXISTS public.testimonios_corazon_en(uuid, boolean, timestamptz);
DROP FUNCTION IF EXISTS public.testimonios_publicar(text, text, boolean);
DROP FUNCTION IF EXISTS public.testimonios_publicar_en(text, text, boolean, timestamptz);
DROP FUNCTION IF EXISTS public.testimonios_mis_grupos();
DROP FUNCTION IF EXISTS public.testimonios_mis_grupos_en(timestamptz);
DROP FUNCTION IF EXISTS public.testimonios_grupo(text);
DROP FUNCTION IF EXISTS public.testimonios_grupo_en(text, timestamptz);
DROP FUNCTION IF EXISTS public.testimonios_grupos(text);
DROP FUNCTION IF EXISTS public.testimonios_grupos_en(text, timestamptz);
DROP FUNCTION IF EXISTS public.testimonios_temporada();
DROP FUNCTION IF EXISTS public.testimonios_es_sistemas(uuid);
DROP FUNCTION IF EXISTS public.testimonios_inscripto(uuid, text);
DROP FUNCTION IF EXISTS public.testimonios_anfitriones(text);
DROP FUNCTION IF EXISTS public.testimonios_grupo_es_de(text, text, jsonb);
DROP FUNCTION IF EXISTS public.testimonios_temporada_en(timestamptz);
DROP FUNCTION IF EXISTS public.testimonios_fecha_md(integer, text, text);
DROP FUNCTION IF EXISTS public.testimonios_temporada_de_fecha(text);
DROP FUNCTION IF EXISTS public.testimonios_norm(text);

DROP TABLE IF EXISTS public.gcx_testimonios_ritmo;
DROP TABLE IF EXISTS public.gcx_testimonios_corazones;
DROP TABLE IF EXISTS public.gcx_testimonios;   -- se lleva su trigger de auditoría

-- La alerta del catálogo (y lo que alguien haya apagado de ella).
DELETE FROM public.notif_silenciadas
 WHERE alerta_id IN (SELECT id FROM public.notif_alertas WHERE clave = 'testimonios_eliminacion_solicitada');
DELETE FROM public.notif_alertas WHERE clave = 'testimonios_eliminacion_solicitada';

COMMIT;
