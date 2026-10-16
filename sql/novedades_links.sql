-- ════════════════════════════════════════════════════════════════════════
-- NOVEDADES · la grilla de links de /novedades
-- ════════════════════════════════════════════════════════════════════════
--
-- Una lista corta de links que se muestra en la página pública: formularios,
-- inscripciones, pantallas de la misma app. La carga y la ordena un
-- SUPER_ADMIN desde el panel; la lee cualquiera, con sesión o sin ella.
--
-- Dos cosas no son obvias:
--
-- 1 · El destino está acotado por un CHECK, no por confianza. Un link que
--     se carga desde un panel termina adentro de un window.open o de un
--     navigate, así que la base no acepta otra cosa que una ruta interna
--     ('/algo') o un https:// con dominio. Eso deja afuera 'javascript:',
--     'data:', 'http://' y las rutas protocolo-relativas ('//dominio'),
--     que el navegador trata como externas. El cliente vuelve a mirar lo
--     mismo antes de abrir (services/novedades.ts, abrirLink): son dos
--     barreras para lo mismo a propósito.
--
-- 2 · El vencimiento se compara en hora argentina. Con la fecha del
--     servidor (UTC) un link que vence hoy desaparecería a las 21:00 de
--     ayer para nosotros. Se ve hasta el final del día de vencimiento
--     inclusive.
--
-- Vuelta atrás: sql/ROLLBACK_novedades_links.sql
-- Pruebas:      sql/PROBAR_novedades_links.sql
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · La tabla ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.novedades_links (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo       text NOT NULL,
    descripcion  text,
    tipo_destino text NOT NULL,
    destino      text NOT NULL,
    -- Último día en que se muestra. NULL = no vence.
    vence        date,
    visible      boolean NOT NULL DEFAULT true,
    orden        integer NOT NULL DEFAULT 0,
    created_at   timestamptz DEFAULT now(),
    updated_at   timestamptz DEFAULT now(),
    created_by   uuid DEFAULT auth.uid(),

    CONSTRAINT novedades_links_titulo_largo
        CHECK (char_length(titulo) BETWEEN 1 AND 60),
    CONSTRAINT novedades_links_descripcion_larga
        CHECK (descripcion IS NULL OR char_length(descripcion) <= 140),
    CONSTRAINT novedades_links_tipo_destino
        CHECK (tipo_destino IN ('interno', 'externo')),

    -- La barrera. 'interno' tiene que arrancar con una sola barra; 'externo'
    -- con https:// y al menos un carácter de dominio.
    CONSTRAINT novedades_links_destino_valido CHECK (
           (tipo_destino = 'interno' AND destino ~  '^/[^/]')
        OR (tipo_destino = 'externo' AND destino ~* '^https://[^/\s]+')
    )
);

COMMENT ON TABLE public.novedades_links IS
    'Links de la página /novedades. Los carga un SUPER_ADMIN; los lee todo el mundo.';
COMMENT ON COLUMN public.novedades_links.vence IS
    'Último día en que se muestra, en hora argentina. NULL = no vence.';

-- El orden lo elige quien carga; a igual orden, primero el más viejo.
CREATE INDEX IF NOT EXISTS novedades_links_orden_idx
    ON public.novedades_links (orden, created_at);

-- ── 2 · updated_at ──────────────────────────────────────────────────────
-- public.handle_updated_at() ya existe y hace exactamente esto.

DROP TRIGGER IF EXISTS novedades_links_updated_at ON public.novedades_links;
CREATE TRIGGER novedades_links_updated_at
    BEFORE UPDATE ON public.novedades_links
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── 3 · Quién ve qué ────────────────────────────────────────────────────

ALTER TABLE public.novedades_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS novedades_links_publico         ON public.novedades_links;
DROP POLICY IF EXISTS novedades_links_admin_lectura   ON public.novedades_links;
DROP POLICY IF EXISTS novedades_links_admin_alta      ON public.novedades_links;
DROP POLICY IF EXISTS novedades_links_admin_edicion   ON public.novedades_links;
DROP POLICY IF EXISTS novedades_links_admin_baja      ON public.novedades_links;

-- Cualquiera: sólo los visibles y sin vencer.
CREATE POLICY novedades_links_publico ON public.novedades_links
    FOR SELECT TO anon, authenticated
    USING (
        visible
        AND (vence IS NULL
             OR vence >= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date)
    );

-- El admin ve además los ocultos y los vencidos, que es lo que necesita el
-- panel. Va TO authenticated a propósito: así anon nunca llega a evaluar
-- tiene_rol() (que sí tiene EXECUTE para anon, pero sin sesión da false).
CREATE POLICY novedades_links_admin_lectura ON public.novedades_links
    FOR SELECT TO authenticated
    USING (public.tiene_rol(ARRAY['SUPER_ADMIN']));

CREATE POLICY novedades_links_admin_alta ON public.novedades_links
    FOR INSERT TO authenticated
    WITH CHECK (public.tiene_rol(ARRAY['SUPER_ADMIN']));

CREATE POLICY novedades_links_admin_edicion ON public.novedades_links
    FOR UPDATE TO authenticated
    USING (public.tiene_rol(ARRAY['SUPER_ADMIN']))
    WITH CHECK (public.tiene_rol(ARRAY['SUPER_ADMIN']));

CREATE POLICY novedades_links_admin_baja ON public.novedades_links
    FOR DELETE TO authenticated
    USING (public.tiene_rol(ARRAY['SUPER_ADMIN']));

-- ── 4 · Permisos de tabla ───────────────────────────────────────────────
-- Sin sesión sólo se lee. Las policies ya lo dicen, pero el GRANT es la
-- primera puerta y no depende de que una policy esté bien escrita.

REVOKE ALL ON public.novedades_links FROM anon, authenticated;
GRANT SELECT                         ON public.novedades_links TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.novedades_links TO authenticated;

COMMIT;
