-- ════════════════════════════════════════════════════════════════════════════
-- TESTIMONIOS DE LOS GCX — los interruptores de /testimonios y /testimonios-gcx
-- 2026-11-03 · ⏳ PENDIENTE
--
-- QUÉ PIDIÓ IGNACIO. Dos botones en /panel-admin?tab=testimonios que habilitan
-- las dos páginas, cada una por su lado:
--   'galeria' · /testimonios y /testimonios/:id (leer y dar corazón)
--   'carga'   · /testimonios-gcx (dejar un testimonio)
-- Apagada, la página se abre igual pero muestra un cartel: "todavía no están
-- habilitados, se habilitan cuando termine la temporada". Las dos arrancan
-- APAGADAS.
--
-- LO DECIDE EL BOTÓN, NO LA FECHA. Ninguna fecha prende ni apaga nada: la
-- página queda como Sistemas la dejó hasta que alguien toque el botón. Con el
-- botón prendido siguen valiendo las reglas de siempre (testimonios_gcx.sql):
-- la temporada vigente, quién puede publicar y el plazo de carga (hasta un mes
-- después del fin). El botón es una llave más, adelante de esas reglas: no
-- abre la carga si el plazo ya cerró.
--
-- DÓNDE SE CORTA. En la base, no sólo en la pantalla: las funciones públicas
-- (testimonios_grupos, _grupo, _corazon, _mis_grupos, _publicar) contestan
-- { ok: false, motivo: 'no_habilitado', temporada } si su página está
-- apagada, así que tampoco se puede leer ni publicar llamando a la API. Las
-- versiones _en (las que prueban las suites) no cambian. Lo que no se corta:
-- "Mis testimonios" (testimonios_mios y el pedido de eliminación) y todo lo
-- de Sistemas: lo que alguien ya publicó lo puede seguir viendo y pedir que
-- se elimine, y Sistemas lo sigue moderando.
--
-- testimonios_temporada() suma { habilitado: { galeria, carga } } para que la
-- pantalla muestre el cartel antes de pedir que se inicie sesión.
--
-- Pruebas: sql/PROBAR_testimonios_habilitar.sql
-- Deshacer: sql/ROLLBACK_testimonios_habilitar.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 · La tabla: una fila por página ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.testimonios_habilitacion (
    pagina        text PRIMARY KEY CHECK (pagina IN ('galeria', 'carga')),
    habilitada    boolean NOT NULL DEFAULT false,
    -- Quién la cambió por última vez y cuándo (NULL: nadie todavía).
    cambiado_at   timestamptz,
    cambiado_por  uuid REFERENCES public.users(id) ON DELETE SET NULL
);

INSERT INTO public.testimonios_habilitacion (pagina, habilitada)
VALUES ('galeria', false), ('carga', false)
ON CONFLICT (pagina) DO NOTHING;

-- Como las otras tablas de testimonios: RLS sin policies y sin permisos. Se
-- lee y se escribe sólo por funciones.
ALTER TABLE public.testimonios_habilitacion ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.testimonios_habilitacion FROM PUBLIC, anon, authenticated;


-- ── 2 · La llave ────────────────────────────────────────────────────────────
-- Si la página está prendida. Sin fila, apagada.
CREATE OR REPLACE FUNCTION public.testimonios_habilitada(p_pagina text)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public
AS $fn$
    SELECT COALESCE((SELECT h.habilitada FROM public.testimonios_habilitacion h WHERE h.pagina = p_pagina), false);
$fn$;

-- La respuesta de una página apagada: el motivo y la temporada vigente.
CREATE OR REPLACE FUNCTION public.testimonios_no_habilitada()
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public
AS $fn$
    SELECT jsonb_build_object('ok', false, 'motivo', 'no_habilitado',
                              'temporada', public.testimonios_temporada_en(now()));
$fn$;


-- ── 3 · Las funciones públicas, con la llave adelante ───────────────────────
-- Mismas firmas, mismo SECURITY DEFINER y mismos permisos (CREATE OR REPLACE
-- los conserva). Prendida, hacen exactamente lo de antes.

CREATE OR REPLACE FUNCTION public.testimonios_temporada()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
    SELECT jsonb_build_object(
        'ok', true,
        'temporada', public.testimonios_temporada_en(now()),
        'habilitado', jsonb_build_object(
            'galeria', public.testimonios_habilitada('galeria'),
            'carga', public.testimonios_habilitada('carga')));
$fn$;

CREATE OR REPLACE FUNCTION public.testimonios_grupos(p_busqueda text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
    SELECT CASE WHEN public.testimonios_habilitada('galeria')
                THEN public.testimonios_grupos_en(p_busqueda, now())
                ELSE public.testimonios_no_habilitada() END;
$fn$;

CREATE OR REPLACE FUNCTION public.testimonios_grupo(p_group_id text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
    SELECT CASE WHEN public.testimonios_habilitada('galeria')
                THEN public.testimonios_grupo_en(p_group_id, now())
                ELSE public.testimonios_no_habilitada() END;
$fn$;

CREATE OR REPLACE FUNCTION public.testimonios_corazon(p_testimonio_id uuid, p_dar boolean)
RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
    SELECT CASE WHEN public.testimonios_habilitada('galeria')
                THEN public.testimonios_corazon_en(p_testimonio_id, p_dar, now())
                ELSE public.testimonios_no_habilitada() END;
$fn$;

CREATE OR REPLACE FUNCTION public.testimonios_mis_grupos()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
    SELECT CASE WHEN public.testimonios_habilitada('carga')
                THEN public.testimonios_mis_grupos_en(now())
                ELSE public.testimonios_no_habilitada() END;
$fn$;

CREATE OR REPLACE FUNCTION public.testimonios_publicar(p_group_id text, p_texto text, p_consiento boolean)
RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
    SELECT CASE WHEN public.testimonios_habilitada('carga')
                THEN public.testimonios_publicar_en(p_group_id, p_texto, p_consiento, now())
                ELSE public.testimonios_no_habilitada() END;
$fn$;


-- ── 4 · Sistemas: ver y tocar los botones ───────────────────────────────────
-- Sólo SUPER_ADMIN (testimonios_es_sistemas), como la moderación.

-- Las dos páginas: si están prendidas, quién las tocó por última vez y cuándo.
CREATE OR REPLACE FUNCTION public.testimonios_admin_habilitacion()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    yo uuid := auth.uid();
BEGIN
    IF yo IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF NOT public.testimonios_es_sistemas(yo) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    END IF;
    RETURN jsonb_build_object('ok', true, 'paginas', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                   'pagina', p.pagina,
                   'habilitada', COALESCE(h.habilitada, false),
                   'cambiado', h.cambiado_at,
                   'cambiado_por', NULLIF(btrim(u.name), ''))
               ORDER BY p.orden), '[]'::jsonb)
          FROM (VALUES ('galeria', 1), ('carga', 2)) p(pagina, orden)
          LEFT JOIN public.testimonios_habilitacion h ON h.pagina = p.pagina
          LEFT JOIN public.users u ON u.id = h.cambiado_por));
END;
$fn$;

-- Prender o apagar una. Tocar el mismo valor que ya tiene no cambia nada (ni
-- quién ni cuándo): contesta sin_cambios.
CREATE OR REPLACE FUNCTION public.testimonios_admin_habilitar(p_pagina text, p_habilitada boolean)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    yo uuid := auth.uid();
    v_antes boolean;
BEGIN
    IF yo IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF NOT public.testimonios_es_sistemas(yo) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    END IF;
    IF p_pagina IS NULL OR p_pagina NOT IN ('galeria', 'carga') OR p_habilitada IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'pagina_invalida');
    END IF;

    INSERT INTO public.testimonios_habilitacion (pagina, habilitada)
    VALUES (p_pagina, false)
    ON CONFLICT (pagina) DO NOTHING;

    SELECT habilitada INTO v_antes FROM public.testimonios_habilitacion WHERE pagina = p_pagina FOR UPDATE;
    IF v_antes = p_habilitada THEN
        RETURN jsonb_build_object('ok', true, 'pagina', p_pagina, 'habilitada', p_habilitada, 'sin_cambios', true);
    END IF;

    UPDATE public.testimonios_habilitacion
       SET habilitada = p_habilitada, cambiado_at = now(), cambiado_por = yo
     WHERE pagina = p_pagina;

    RETURN jsonb_build_object('ok', true, 'pagina', p_pagina, 'habilitada', p_habilitada, 'sin_cambios', false);
END;
$fn$;


-- ── 5 · Permisos ────────────────────────────────────────────────────────────
-- Las piezas, para nadie de afuera. Las de Sistemas, para authenticated (la
-- función se fija el rol). Las públicas conservan los permisos que tenían.
REVOKE ALL ON FUNCTION
    public.testimonios_habilitada(text),
    public.testimonios_no_habilitada(),
    public.testimonios_admin_habilitacion(),
    public.testimonios_admin_habilitar(text, boolean)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
    public.testimonios_admin_habilitacion(),
    public.testimonios_admin_habilitar(text, boolean)
TO authenticated;
