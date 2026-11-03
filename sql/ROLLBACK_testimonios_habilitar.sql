-- ════════════════════════════════════════════════════════════════════════════
-- Deshace sql/testimonios_habilitar.sql: las funciones públicas vuelven a ser
-- las de testimonios_gcx.sql (sin llave: las dos páginas quedan abiertas) y
-- se borran los botones de Sistemas, las piezas y la tabla.
-- No toca ningún testimonio.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE OR REPLACE FUNCTION public.testimonios_temporada()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
    SELECT jsonb_build_object('ok', true, 'temporada', public.testimonios_temporada_en(now()));
$fn$;

CREATE OR REPLACE FUNCTION public.testimonios_grupos(p_busqueda text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
    SELECT public.testimonios_grupos_en(p_busqueda, now());
$fn$;

CREATE OR REPLACE FUNCTION public.testimonios_grupo(p_group_id text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
    SELECT public.testimonios_grupo_en(p_group_id, now());
$fn$;

CREATE OR REPLACE FUNCTION public.testimonios_corazon(p_testimonio_id uuid, p_dar boolean)
RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
    SELECT public.testimonios_corazon_en(p_testimonio_id, p_dar, now());
$fn$;

CREATE OR REPLACE FUNCTION public.testimonios_mis_grupos()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
    SELECT public.testimonios_mis_grupos_en(now());
$fn$;

CREATE OR REPLACE FUNCTION public.testimonios_publicar(p_group_id text, p_texto text, p_consiento boolean)
RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
    SELECT public.testimonios_publicar_en(p_group_id, p_texto, p_consiento, now());
$fn$;

DROP FUNCTION IF EXISTS public.testimonios_admin_habilitar(text, boolean);
DROP FUNCTION IF EXISTS public.testimonios_admin_habilitacion();
DROP FUNCTION IF EXISTS public.testimonios_no_habilitada();
DROP FUNCTION IF EXISTS public.testimonios_habilitada(text);
DROP TABLE IF EXISTS public.testimonios_habilitacion;

COMMIT;
