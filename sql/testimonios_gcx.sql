-- ════════════════════════════════════════════════════════════════════════════
-- TESTIMONIOS DE LOS GCX — la base
-- 2026-11-02 · ✅ APLICADO el 2026-11-02 (PROBAR_testimonios_gcx 109/109 contra producción)
--
-- La gente que fue parte de un GCX en la temporada cuenta lo que vivió, y los
-- testimonios quedan publicados para que cualquiera los lea, con o sin sesión.
-- Diseños: design-claude/GCX Testimonios - Dejar testimonio.dc.html y
-- design-claude/GCX Testimonios - Testimonios.dc.html; inventario en
-- design-claude/INVENTARIO-TESTIMONIOS-GCX.md. Pruebas: PROBAR_testimonios_gcx.sql.
-- Deshacer: ROLLBACK_testimonios_gcx.sql.
--
-- LA TEMPORADA VIGENTE (testimonios_temporada_en)
--   Es la última que EMPEZÓ, con las fechas de inicio y fin de la
--   configuración de temporadas (app_config 'global' → groupsConfig.
--   seasonSettings, las que edita /admingcx/temporadas), en hora argentina,
--   mirando este año y el anterior. Mientras dura y hasta UN MES después de su
--   fin, la carga está abierta; después se cierra, pero lo publicado se sigue
--   viendo hasta que empiece la temporada siguiente. A principios de enero la
--   vigente es la Tercera del año anterior.
--   `isOpen` y `activeYear` NO deciden cuál es la vigente: dicen si los
--   anfitriones pueden crear grupos, y Sistemas cierra la temporada cuando
--   termina; si contaran, el mes extra se cortaría el día que se cierra.
--
-- UN GRUPO ES DE LA TEMPORADA con la misma regla que el resto de la app
--   (getSeasonFromDate de services/supabaseService.ts, más el año de su fecha
--   de inicio), copiada en testimonios_temporada_de_fecha. Esa regla tiene sus
--   fechas fijas; si Sistemas las cambia en la configuración, NO coinciden
--   (hoy difiere el fin de la Primera: 31/5 en la regla, 17/5 en la
--   configuración). Se usa la de la app, que es la que ven los reportes.
--
-- TODO SE ESCRIBE POR FUNCIONES. Las tablas tienen RLS y ninguna policy, y ni
-- anon ni authenticated las pueden leer: la lectura pública va por funciones
-- que devuelven sólo lo que se muestra. A anon nunca le llega un id de
-- usuario, un email ni un teléfono: de las personas, sólo nombre y foto (la
-- foto sólo del anfitrión y del co-anfitrión; de quien escribe, sólo el nombre).
--
-- MENORES (decisión de Ignacio, 2026-11-02): quien escribió y tiene menos de
-- 18 años al momento de mostrarlo (hora argentina, por users.birth_date) se ve
-- "Nombre I." ("Sofía G."); sin fecha de nacimiento, igual que un menor. Vale
-- en todo lo que devuelve un nombre de autor, y la búsqueda pública sólo lo
-- encuentra por eso que se muestra. Sistemas ve el nombre completo.
--
-- QUIÉN PUBLICA: quien tiene inscripción aprobada, y también el anfitrión y el
-- co-anfitrión del GCX, con las mismas reglas.
--
-- AUDITORÍA SIN TEXTO: gcx_testimonios se audita con su propio trigger
-- (testimonios_auditar), igual al genérico pero sin el texto ni el motivo del
-- pedido. El genérico (log_audit_event) no se toca.
--
-- Cada función contesta { ok: true, … } o { ok: false, motivo }, como las de
-- Agenda y Notificaciones.
-- ════════════════════════════════════════════════════════════════════════════

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1 · LAS TABLAS                                                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.gcx_testimonios (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id                text NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    autor_id                uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    -- La temporada y el año del GCX, tal como se publicó.
    temporada               text NOT NULL CHECK (temporada IN ('S1', 'S2', 'S3')),
    anio                    integer NOT NULL CHECK (anio BETWEEN 2020 AND 2100),
    texto                   text NOT NULL,
    -- publicado · eliminacion_solicitada (lo pidió quien lo escribió: se oculta
    -- en el acto, mientras Sistemas decide) · oculto (lo ocultó Sistemas).
    estado                  text NOT NULL DEFAULT 'publicado'
                            CHECK (estado IN ('publicado', 'eliminacion_solicitada', 'oculto')),
    -- Cómo estaba cuando se pidió eliminarlo: si Sistemas rechaza el pedido,
    -- vuelve a eso (uno que Sistemas había ocultado sigue oculto).
    estado_antes_del_pedido text CHECK (estado_antes_del_pedido IN ('publicado', 'oculto')),
    consentimiento_at       timestamptz NOT NULL,
    created_at              timestamptz NOT NULL DEFAULT now(),
    eliminacion_pedida_at   timestamptz,
    eliminacion_motivo      text CHECK (eliminacion_motivo IS NULL OR char_length(eliminacion_motivo) BETWEEN 1 AND 500),
    -- La última decisión de Sistemas. Eliminar no deja fila: queda en audit_logs.
    decision                text CHECK (decision IN ('pedido_rechazado', 'oculto', 'mostrado')),
    decidido_at             timestamptz,
    decidido_por            uuid REFERENCES public.users(id) ON DELETE SET NULL,

    -- Un testimonio por persona y por GCX.
    CONSTRAINT gcx_testimonios_uno_por_grupo UNIQUE (autor_id, group_id),
    -- El mismo largo que el contador del front: de 1 a 1000 caracteres, sin
    -- espacios ni saltos de línea al principio ni al final.
    CONSTRAINT gcx_testimonios_texto_ok CHECK (
        char_length(texto) BETWEEN 1 AND 1000 AND texto !~ '^\s' AND texto !~ '\s$'),
    CONSTRAINT gcx_testimonios_pedido_ok CHECK (
        estado <> 'eliminacion_solicitada' OR eliminacion_pedida_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS gcx_testimonios_grupo_idx
    ON public.gcx_testimonios (group_id, estado, created_at DESC);
CREATE INDEX IF NOT EXISTS gcx_testimonios_autor_idx
    ON public.gcx_testimonios (autor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS gcx_testimonios_pedidos_idx
    ON public.gcx_testimonios (eliminacion_pedida_at) WHERE estado = 'eliminacion_solicitada';

-- Los corazones. Se van con el testimonio.
CREATE TABLE IF NOT EXISTS public.gcx_testimonios_corazones (
    testimonio_id uuid NOT NULL REFERENCES public.gcx_testimonios(id) ON DELETE CASCADE,
    user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (testimonio_id, user_id)
);
CREATE INDEX IF NOT EXISTS gcx_testimonios_corazones_user_idx
    ON public.gcx_testimonios_corazones (user_id);

-- Cuántas veces tocó el corazón cada persona en cada minuto: el freno contra
-- el abuso. Contar los corazones dados no alcanza: dar y quitar sin parar no
-- deja filas. Se limpia sola (se borra lo de hace más de 10 minutos).
CREATE TABLE IF NOT EXISTS public.gcx_testimonios_ritmo (
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    minuto  timestamptz NOT NULL,
    n       integer NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, minuto)
);

ALTER TABLE public.gcx_testimonios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gcx_testimonios_corazones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gcx_testimonios_ritmo     ENABLE ROW LEVEL SECURITY;
-- Supabase le da todo a anon y authenticated en cada tabla nueva: se saca.
REVOKE ALL ON public.gcx_testimonios, public.gcx_testimonios_corazones, public.gcx_testimonios_ritmo
    FROM PUBLIC, anon, authenticated;

-- Toda alta, cambio de estado y eliminación queda en audit_logs: quién,
-- cuándo, qué acción y el estado. NUNCA el texto del testimonio ni el motivo
-- del pedido de eliminación (que puede citarlo). Es log_audit_event (el
-- genérico de users, groups y notif_alertas) con esas dos columnas afuera; el
-- genérico queda igual para el resto de la app.
CREATE OR REPLACE FUNCTION public.testimonios_auditar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
    INSERT INTO public.audit_logs (table_name, action, record_id, old_data, new_data, changed_by)
    VALUES (
        TG_TABLE_NAME::text,
        TG_OP::text,
        CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) - 'texto' - 'eliminacion_motivo' END,
        CASE WHEN TG_OP IN ('UPDATE', 'INSERT') THEN to_jsonb(NEW) - 'texto' - 'eliminacion_motivo' END,
        auth.uid());
    RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS audit_gcx_testimonios_changes ON public.gcx_testimonios;
CREATE TRIGGER audit_gcx_testimonios_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.gcx_testimonios
    FOR EACH ROW EXECUTE FUNCTION public.testimonios_auditar();


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2 · PIEZAS (sólo las usan las funciones de abajo)                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Para buscar sin distinguir mayúsculas ni acentos: "Gómez" = "gomez".
CREATE OR REPLACE FUNCTION public.testimonios_norm(p text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $fn$
    SELECT btrim(regexp_replace(lower(translate(COALESCE(p, ''),
        'ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑÇáàäâéèëêíìïîóòöôúùüûñç',
        'AAAAEEEEIIIIOOOOUUUUNCaaaaeeeeiiiioooouuuunc')), '\s+', ' ', 'g'));
$fn$;

-- La temporada de un grupo por su fecha de inicio ('YYYY-MM-DD'). Es
-- getSeasonFromDate de services/supabaseService.ts, igual: si cambia una,
-- cambia la otra. plpgsql y no sql a propósito: así nunca se evalúa el
-- ::integer de una fecha mal escrita.
CREATE OR REPLACE FUNCTION public.testimonios_temporada_de_fecha(p_fecha text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $fn$
DECLARE
    v_md integer;
BEGIN
    IF p_fecha IS NULL OR p_fecha !~ '^\d{4}-\d{2}-\d{2}$' THEN
        RETURN NULL;
    END IF;
    v_md := substr(p_fecha, 6, 2)::integer * 100 + substr(p_fecha, 9, 2)::integer;
    IF v_md BETWEEN 323 AND 531 THEN RETURN 'S1'; END IF;
    IF v_md BETWEEN 629 AND 823 THEN RETURN 'S2'; END IF;
    IF v_md BETWEEN 1005 AND 1129 THEN RETURN 'S3'; END IF;
    RETURN NULL;
END;
$fn$;

-- Una fecha 'MM-DD' de la configuración, en un año. Si viene vacía o mal
-- escrita, la de siempre.
CREATE OR REPLACE FUNCTION public.testimonios_fecha_md(p_anio integer, p_md text, p_md_defecto text)
RETURNS date
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $fn$
BEGIN
    IF p_md ~ '^\d{2}-\d{2}$' THEN
        BEGIN
            RETURN make_date(p_anio, substr(p_md, 1, 2)::integer, substr(p_md, 4, 2)::integer);
        EXCEPTION WHEN others THEN
            NULL;
        END;
    END IF;
    RETURN make_date(p_anio, substr(p_md_defecto, 1, 2)::integer, substr(p_md_defecto, 4, 2)::integer);
END;
$fn$;

-- La temporada vigente en un momento dado. El parámetro es para poder probar
-- cualquier fecha; la app la pide con now() (testimonios_temporada).
CREATE OR REPLACE FUNCTION public.testimonios_temporada_en(p_ahora timestamptz)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public
AS $fn$
DECLARE
    -- Las fechas de DEFAULT_SEASON_SETTINGS (types.ts), por si la
    -- configuración no está o tiene una fecha imposible.
    DEFECTO constant jsonb := '{"S1":["03-23","05-17"],"S2":["06-29","08-23"],"S3":["10-05","11-29"]}';
    v_hoy  date := (p_ahora AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
    v_cfg  jsonb;
    v_anio integer;
    v_k    text;
    v_ini  date;
    v_fin  date;
    b_k    text;
    b_anio integer;
    b_ini  date;
    b_fin  date;
    v_hasta date;
BEGIN
    SELECT config->'groupsConfig'->'seasonSettings'->'seasons'
      INTO v_cfg
      FROM public.app_config WHERE id = 'global';

    FOR v_anio IN (extract(year FROM v_hoy)::integer - 1) .. extract(year FROM v_hoy)::integer LOOP
        FOREACH v_k IN ARRAY ARRAY['S1', 'S2', 'S3'] LOOP
            v_ini := public.testimonios_fecha_md(v_anio, v_cfg->v_k->>'startDate', DEFECTO->v_k->>0);
            v_fin := public.testimonios_fecha_md(v_anio, v_cfg->v_k->>'endDate',   DEFECTO->v_k->>1);
            IF v_fin < v_ini THEN   -- configuración al revés: las de siempre
                v_ini := public.testimonios_fecha_md(v_anio, NULL, DEFECTO->v_k->>0);
                v_fin := public.testimonios_fecha_md(v_anio, NULL, DEFECTO->v_k->>1);
            END IF;
            IF v_ini <= v_hoy AND (b_ini IS NULL OR v_ini > b_ini) THEN
                b_k := v_k; b_anio := v_anio; b_ini := v_ini; b_fin := v_fin;
            END IF;
        END LOOP;
    END LOOP;

    v_hasta := (b_fin + interval '1 month')::date;

    RETURN jsonb_build_object(
        'temporada', b_k,
        'anio', b_anio,
        'nombre', CASE b_k WHEN 'S1' THEN 'Primera temporada'
                           WHEN 'S2' THEN 'Segunda temporada'
                           ELSE 'Tercera temporada' END,
        'inicio', b_ini,
        'fin', b_fin,
        'en_curso', v_hoy <= b_fin,
        'carga_abierta', v_hoy <= v_hasta,
        'carga_hasta', v_hasta,
        'hoy', v_hoy);
END;
$fn$;

-- Si un grupo es un GCX aprobado de la temporada t.
CREATE OR REPLACE FUNCTION public.testimonios_grupo_es_de(p_status text, p_start_date text, t jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $fn$
    SELECT lower(COALESCE(p_status, '')) = 'approved'
       AND public.testimonios_temporada_de_fecha(p_start_date) = t->>'temporada'
       AND substr(p_start_date, 1, 4) = t->>'anio';
$fn$;

-- El anfitrión y el co-anfitrión de un grupo: nombre, foto y rol. Nada más.
-- El nombre del co-anfitrión sale de las columnas del grupo (es lo que lee la
-- app; co_host_id puede faltar) y, si están vacías, de su cuenta.
CREATE OR REPLACE FUNCTION public.testimonios_anfitriones(p_group_id text)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public
AS $fn$
    SELECT COALESCE(jsonb_agg(x.persona ORDER BY x.orden), '[]'::jsonb)
      FROM public.groups g
      CROSS JOIN LATERAL (
          SELECT 1 AS orden, jsonb_build_object(
                     'nombre', COALESCE(NULLIF(btrim(h.name), ''),
                                        NULLIF(btrim(concat_ws(' ', g.leader_name, g.leader_surname)), '')),
                     'foto', NULLIF(btrim(h.avatar_url), ''),
                     'rol', CASE WHEN h.gender = 'Femenino' THEN 'Anfitriona' ELSE 'Anfitrión' END) AS persona
            FROM (SELECT 1) uno
            LEFT JOIN public.users h ON h.id = g.host_id
           WHERE COALESCE(NULLIF(btrim(h.name), ''),
                          NULLIF(btrim(concat_ws(' ', g.leader_name, g.leader_surname)), '')) IS NOT NULL
          UNION ALL
          SELECT 2, jsonb_build_object(
                     'nombre', COALESCE(NULLIF(btrim(concat_ws(' ', g.co_host_first_name, g.co_host_last_name)), ''),
                                        NULLIF(btrim(c.name), '')),
                     'foto', NULLIF(btrim(c.avatar_url), ''),
                     'rol', CASE WHEN c.gender = 'Femenino' THEN 'Co-anfitriona' ELSE 'Co-anfitrión' END)
            FROM (SELECT 1) uno
            LEFT JOIN public.users c ON c.id = g.co_host_id
           WHERE COALESCE(NULLIF(btrim(concat_ws(' ', g.co_host_first_name, g.co_host_last_name)), ''),
                          NULLIF(btrim(c.name), '')) IS NOT NULL
      ) x
     WHERE g.id = p_group_id;
$fn$;

-- Si una persona tiene una inscripción APROBADA en un grupo. Las parejas se
-- inscriben en una sola fila: quien está en partner_user_id también cuenta.
CREATE OR REPLACE FUNCTION public.testimonios_inscripto(p_user uuid, p_group_id text)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public
AS $fn$
    SELECT EXISTS (
        SELECT 1 FROM public.group_registrations r
         WHERE r.group_id = p_group_id
           AND upper(COALESCE(r.status, '')) = 'APPROVED'
           AND (r.user_id = p_user OR r.partner_user_id = p_user));
$fn$;

CREATE OR REPLACE FUNCTION public.testimonios_es_sistemas(p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public
AS $fn$
    SELECT EXISTS (
        SELECT 1 FROM public.users u
         WHERE u.id = p_user
           AND ((u.role)::text = 'SUPER_ADMIN' OR COALESCE(u.roles, '{}') && ARRAY['SUPER_ADMIN']));
$fn$;

-- El nombre de quien escribió, tal como se muestra. Mayor de 18 (en hora
-- argentina, en p_ahora): nombre completo. Menor, o sin fecha de nacimiento:
-- la primera palabra y la inicial de la segunda ("Sofía Gómez Pérez" →
-- "Sofía G."). Con una sola palabra, esa palabra. Sin nombre, NULL.
CREATE OR REPLACE FUNCTION public.testimonios_nombre_publico(p_nombre text, p_nacimiento date, p_ahora timestamptz)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $fn$
    SELECT CASE
        WHEN n = '' THEN NULL
        WHEN p_nacimiento IS NOT NULL
             AND p_nacimiento <= ((p_ahora AT TIME ZONE 'America/Argentina/Buenos_Aires')::date - interval '18 years')::date
            THEN n
        ELSE split_part(n, ' ', 1)
             || CASE WHEN split_part(n, ' ', 2) <> '' THEN ' ' || upper(left(split_part(n, ' ', 2), 1)) || '.' ELSE '' END
    END
    FROM (SELECT regexp_replace(btrim(COALESCE(p_nombre, '')), '\s+', ' ', 'g') AS n) x;
$fn$;

-- Qué es una persona en un grupo: 'anfitrion', 'coanfitrion', 'participante'
-- (inscripción aprobada) o NULL. Si es anfitrión e inscripto, es anfitrión: el
-- grupo aparece una sola vez.
CREATE OR REPLACE FUNCTION public.testimonios_rol_en_grupo(p_user uuid, p_group_id text)
RETURNS text
LANGUAGE sql STABLE
SET search_path = public
AS $fn$
    SELECT CASE
        WHEN p_user IS NULL THEN NULL
        WHEN g.host_id = p_user THEN 'anfitrion'
        WHEN g.co_host_id = p_user THEN 'coanfitrion'
        WHEN public.testimonios_inscripto(p_user, g.id) THEN 'participante'
    END
    FROM public.groups g WHERE g.id = p_group_id;
$fn$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3 · LECTURA PÚBLICA (anon y authenticated)                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- La temporada vigente: nombre, año, fechas, si la carga está abierta y
-- hasta cuándo.
CREATE OR REPLACE FUNCTION public.testimonios_temporada()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
    SELECT jsonb_build_object('ok', true, 'temporada', public.testimonios_temporada_en(now()));
$fn$;

-- La galería: TODOS los GCX aprobados de la temporada vigente, tengan o no
-- testimonios, con la búsqueda por nombre del GCX, del anfitrión o del
-- co-anfitrión, o de alguien que dejó un testimonio publicado. Cada grupo
-- dice por qué coincidió: 'grupo', 'anfitrion' o 'testimonio' (y, en ese
-- caso, de quiénes: hasta dos nombres y cuántos son).
CREATE OR REPLACE FUNCTION public.testimonios_grupos_en(p_busqueda text, p_ahora timestamptz)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public
AS $fn$
DECLARE
    t jsonb := public.testimonios_temporada_en(p_ahora);
    q text  := NULLIF(left(public.testimonios_norm(p_busqueda), 100), '');
    v jsonb;
BEGIN
    WITH g AS (
        SELECT g.id, g.name, NULLIF(btrim(g.image_url), '') AS portada,
               public.testimonios_anfitriones(g.id) AS anfitriones
          FROM public.groups g
         WHERE public.testimonios_grupo_es_de(g.status, g.start_date, t)
    ), cuenta AS (
        SELECT x.group_id, count(*) AS n
          FROM public.gcx_testimonios x
         WHERE x.estado = 'publicado' AND x.group_id IN (SELECT id FROM g)
         GROUP BY x.group_id
    ), publicos AS (
        -- Quién escribió, con el nombre que se muestra: a un menor sólo se lo
        -- encuentra por "Nombre I.", nunca por su apellido completo.
        SELECT x.group_id, x.created_at,
               public.testimonios_nombre_publico(u.name, u.birth_date, p_ahora) AS nombre
          FROM public.gcx_testimonios x
          JOIN public.users u ON u.id = x.autor_id
         WHERE q IS NOT NULL
           AND x.estado = 'publicado' AND x.group_id IN (SELECT id FROM g)
    ), autores AS (
        SELECT pu.group_id, array_agg(pu.nombre ORDER BY pu.created_at DESC) AS nombres
          FROM publicos pu
         WHERE position(q IN public.testimonios_norm(pu.nombre)) > 0
         GROUP BY pu.group_id
    ), fila AS (
        SELECT g.*, COALESCE(c.n, 0) AS n, a.nombres,
               CASE
                   WHEN q IS NULL THEN NULL
                   WHEN position(q IN public.testimonios_norm(g.name)) > 0 THEN 'grupo'
                   WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(g.anfitriones) h
                                 WHERE position(q IN public.testimonios_norm(h->>'nombre')) > 0) THEN 'anfitrion'
                   WHEN a.nombres IS NOT NULL THEN 'testimonio'
               END AS coincide
          FROM g
          LEFT JOIN cuenta c ON c.group_id = g.id
          LEFT JOIN autores a ON a.group_id = g.id
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id', f.id,
               'nombre', f.name,
               'portada', f.portada,
               'anfitriones', f.anfitriones,
               'testimonios', f.n,
               'coincide', f.coincide,
               'autores', CASE WHEN f.coincide = 'testimonio' THEN to_jsonb(f.nombres[1:2]) END,
               'autores_total', CASE WHEN f.coincide = 'testimonio' THEN cardinality(f.nombres) END)
           ORDER BY public.testimonios_norm(f.name), f.id), '[]'::jsonb)
      INTO v
      FROM fila f
     WHERE q IS NULL OR f.coincide IS NOT NULL;

    RETURN jsonb_build_object('ok', true, 'temporada', t, 'busqueda', q, 'grupos', v);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.testimonios_grupos(p_busqueda text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
    SELECT public.testimonios_grupos_en(p_busqueda, now());
$fn$;

-- El detalle de un GCX: portada, nombre, descripción completa, anfitrión y
-- co-anfitrión, y sus testimonios PUBLICADOS, más nuevos primero. Con
-- sesión, cada uno dice si yo le di corazón y si es mío.
CREATE OR REPLACE FUNCTION public.testimonios_grupo_en(p_group_id text, p_ahora timestamptz)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public
AS $fn$
DECLARE
    t  jsonb := public.testimonios_temporada_en(p_ahora);
    yo uuid  := auth.uid();
    g  record;
    v  jsonb;
BEGIN
    SELECT * INTO g FROM public.groups WHERE id = p_group_id;
    IF NOT FOUND OR lower(COALESCE(g.status, '')) <> 'approved' THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF NOT public.testimonios_grupo_es_de(g.status, g.start_date, t) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'fuera_de_temporada', 'temporada', t);
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id', x.id,
               'autor', COALESCE(public.testimonios_nombre_publico(u.name, u.birth_date, p_ahora), 'Alguien de Origen'),
               'temporada', CASE x.temporada WHEN 'S1' THEN 'Primera temporada'
                                             WHEN 'S2' THEN 'Segunda temporada'
                                             ELSE 'Tercera temporada' END,
               'anio', x.anio,
               'texto', x.texto,
               'corazones', (SELECT count(*) FROM public.gcx_testimonios_corazones c WHERE c.testimonio_id = x.id),
               'yo_di', yo IS NOT NULL AND EXISTS (SELECT 1 FROM public.gcx_testimonios_corazones c
                                                    WHERE c.testimonio_id = x.id AND c.user_id = yo),
               'es_mio', yo IS NOT NULL AND x.autor_id = yo)
           ORDER BY x.created_at DESC, x.id), '[]'::jsonb)
      INTO v
      FROM public.gcx_testimonios x
      LEFT JOIN public.users u ON u.id = x.autor_id
     WHERE x.group_id = g.id AND x.estado = 'publicado';

    RETURN jsonb_build_object(
        'ok', true,
        'temporada', t,
        'grupo', jsonb_build_object(
            'id', g.id,
            'nombre', g.name,
            'portada', NULLIF(btrim(g.image_url), ''),
            'descripcion', COALESCE(g.description, ''),
            'anfitriones', public.testimonios_anfitriones(g.id)),
        'testimonios', v);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.testimonios_grupo(p_group_id text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
    SELECT public.testimonios_grupo_en(p_group_id, now());
$fn$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4 · CON SESIÓN                                                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Mis GCX de la temporada vigente: donde tengo inscripción aprobada o soy
-- anfitrión o co-anfitrión (una sola vez cada uno), con mi rol, su anfitrión y
-- si ya dejé testimonio. Trae mi nombre COMO SE VA A VER para la vista previa
-- del modal ("Así se va a ver"): un menor ve "Nombre I.".
CREATE OR REPLACE FUNCTION public.testimonios_mis_grupos_en(p_ahora timestamptz)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public
AS $fn$
DECLARE
    yo uuid  := auth.uid();
    t  jsonb := public.testimonios_temporada_en(p_ahora);
    v  jsonb;
BEGIN
    IF yo IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id', g.id,
               'nombre', g.name,
               'portada', NULLIF(btrim(g.image_url), ''),
               'anfitriones', public.testimonios_anfitriones(g.id),
               'mi_rol_clave', r.rol,
               'mi_rol', CASE r.rol WHEN 'anfitrion' THEN 'Anfitrión'
                                    WHEN 'coanfitrion' THEN 'Co-anfitrión'
                                    ELSE 'Participante' END,
               'ya_publicado', x.id IS NOT NULL,
               'testimonio_id', x.id,
               'estado', x.estado)
           ORDER BY public.testimonios_norm(g.name), g.id), '[]'::jsonb)
      INTO v
      FROM public.groups g
      CROSS JOIN LATERAL (SELECT public.testimonios_rol_en_grupo(yo, g.id) AS rol) r
      LEFT JOIN public.gcx_testimonios x ON x.group_id = g.id AND x.autor_id = yo
     WHERE public.testimonios_grupo_es_de(g.status, g.start_date, t)
       AND r.rol IS NOT NULL;

    RETURN jsonb_build_object(
        'ok', true,
        'temporada', t,
        'mi_nombre', (SELECT public.testimonios_nombre_publico(name, birth_date, p_ahora) FROM public.users WHERE id = yo),
        'grupos', v);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.testimonios_mis_grupos()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
    SELECT public.testimonios_mis_grupos_en(now());
$fn$;

-- Publicar. Sólo con el consentimiento del modal, y se guarda cuándo se dio.
-- Si se corta la conexión y se reintenta con el mismo texto, devuelve el que
-- ya estaba (ya_existia) en vez de contestar ya_publicado.
CREATE OR REPLACE FUNCTION public.testimonios_publicar_en(
    p_group_id  text,
    p_texto     text,
    p_consiento boolean,
    p_ahora     timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE
SET search_path = public
AS $fn$
DECLARE
    TOPE_DIA constant integer := 5;
    yo      uuid  := auth.uid();
    t       jsonb := public.testimonios_temporada_en(p_ahora);
    g       record;
    v_texto text;
    v_prev  record;
    v_n     integer;
    v_id    uuid;
BEGIN
    IF yo IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF NOT (t->>'carga_abierta')::boolean THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'fuera_de_plazo', 'temporada', t);
    END IF;

    SELECT * INTO g FROM public.groups WHERE id = p_group_id;
    IF NOT FOUND OR lower(COALESCE(g.status, '')) <> 'approved' THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF NOT public.testimonios_grupo_es_de(g.status, g.start_date, t) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'fuera_de_temporada', 'temporada', t);
    END IF;
    -- Inscripción aprobada, o anfitrión / co-anfitrión del GCX.
    IF public.testimonios_rol_en_grupo(yo, g.id) IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_inscripto');
    END IF;

    v_texto := regexp_replace(COALESCE(p_texto, ''), '^\s+|\s+$', '', 'g');
    IF char_length(v_texto) NOT BETWEEN 1 AND 1000 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'texto_invalido', 'limite', 1000);
    END IF;
    IF p_consiento IS NOT TRUE THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_consentimiento');
    END IF;

    SELECT id, texto INTO v_prev FROM public.gcx_testimonios WHERE autor_id = yo AND group_id = g.id;
    IF FOUND THEN
        IF v_prev.texto = v_texto THEN
            RETURN jsonb_build_object('ok', true, 'id', v_prev.id, 'ya_existia', true, 'grupo', g.name);
        END IF;
        RETURN jsonb_build_object('ok', false, 'motivo', 'ya_publicado', 'id', v_prev.id);
    END IF;

    SELECT count(*) INTO v_n FROM public.gcx_testimonios
     WHERE autor_id = yo
       AND (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
         = (p_ahora AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
    IF v_n >= TOPE_DIA THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'tope', 'limite', TOPE_DIA);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = yo AND NULLIF(btrim(name), '') IS NOT NULL) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_nombre');
    END IF;

    BEGIN
        -- p_ahora es now() en la app; en las pruebas, la fecha que se prueba.
        INSERT INTO public.gcx_testimonios (group_id, autor_id, temporada, anio, texto, consentimiento_at, created_at)
        VALUES (g.id, yo, t->>'temporada', (t->>'anio')::integer, v_texto, p_ahora, p_ahora)
        RETURNING id INTO v_id;
    EXCEPTION WHEN unique_violation THEN
        -- Dos envíos a la vez: el otro ganó.
        SELECT id INTO v_id FROM public.gcx_testimonios WHERE autor_id = yo AND group_id = g.id;
        RETURN jsonb_build_object('ok', false, 'motivo', 'ya_publicado', 'id', v_id);
    END;

    RETURN jsonb_build_object('ok', true, 'id', v_id, 'ya_existia', false, 'grupo', g.name);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.testimonios_publicar(p_group_id text, p_texto text, p_consiento boolean)
RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
    SELECT public.testimonios_publicar_en(p_group_id, p_texto, p_consiento, now());
$fn$;

-- Dar o quitar el corazón. Idempotente: dar dos veces deja uno. Sólo sobre
-- testimonios publicados de la temporada vigente. Devuelve el contador nuevo.
-- Tope: 30 toques por minuto.
CREATE OR REPLACE FUNCTION public.testimonios_corazon_en(p_testimonio_id uuid, p_dar boolean, p_ahora timestamptz)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE
SET search_path = public
AS $fn$
DECLARE
    TOPE_MINUTO constant integer := 30;
    yo  uuid  := auth.uid();
    t   jsonb := public.testimonios_temporada_en(p_ahora);
    v_n integer;
BEGIN
    IF yo IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.gcx_testimonios x
                    WHERE x.id = p_testimonio_id AND x.estado = 'publicado'
                      AND x.temporada = t->>'temporada' AND x.anio = (t->>'anio')::integer) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = yo) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;

    DELETE FROM public.gcx_testimonios_ritmo WHERE user_id = yo AND minuto < p_ahora - interval '10 minutes';
    INSERT INTO public.gcx_testimonios_ritmo (user_id, minuto, n)
    VALUES (yo, date_trunc('minute', p_ahora), 1)
    ON CONFLICT (user_id, minuto) DO UPDATE SET n = gcx_testimonios_ritmo.n + 1
    RETURNING n INTO v_n;
    IF v_n > TOPE_MINUTO THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'tope', 'limite', TOPE_MINUTO);
    END IF;

    IF p_dar IS TRUE THEN
        INSERT INTO public.gcx_testimonios_corazones (testimonio_id, user_id)
        VALUES (p_testimonio_id, yo)
        ON CONFLICT DO NOTHING;
    ELSE
        DELETE FROM public.gcx_testimonios_corazones WHERE testimonio_id = p_testimonio_id AND user_id = yo;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'di', p_dar IS TRUE,
        'corazones', (SELECT count(*) FROM public.gcx_testimonios_corazones WHERE testimonio_id = p_testimonio_id));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.testimonios_corazon(p_testimonio_id uuid, p_dar boolean)
RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
    SELECT public.testimonios_corazon_en(p_testimonio_id, p_dar, now());
$fn$;

-- Los míos, de todas las temporadas, con su estado y sus corazones (para
-- "Mis testimonios" en el Perfil). `visible` dice si hoy se ve en /testimonios.
CREATE OR REPLACE FUNCTION public.testimonios_mios()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    yo uuid  := auth.uid();
    t  jsonb := public.testimonios_temporada_en(now());
    v  jsonb;
BEGIN
    IF yo IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id', x.id,
               'grupo', jsonb_build_object('id', g.id, 'nombre', g.name, 'portada', NULLIF(btrim(g.image_url), '')),
               'temporada', CASE x.temporada WHEN 'S1' THEN 'Primera temporada'
                                             WHEN 'S2' THEN 'Segunda temporada'
                                             ELSE 'Tercera temporada' END,
               'anio', x.anio,
               'texto', x.texto,
               'estado', x.estado,
               'corazones', (SELECT count(*) FROM public.gcx_testimonios_corazones c WHERE c.testimonio_id = x.id),
               'creado', x.created_at,
               'eliminacion_pedida', x.eliminacion_pedida_at,
               'eliminacion_motivo', x.eliminacion_motivo,
               'decision', x.decision,
               'decidido', x.decidido_at,
               'visible', x.estado = 'publicado' AND x.temporada = t->>'temporada' AND x.anio = (t->>'anio')::integer)
           ORDER BY x.created_at DESC, x.id), '[]'::jsonb)
      INTO v
      FROM public.gcx_testimonios x
      JOIN public.groups g ON g.id = x.group_id
     WHERE x.autor_id = yo;

    RETURN jsonb_build_object('ok', true, 'temporada', t, 'testimonios', v);
END;
$fn$;

-- "Solicitar eliminación": sólo sobre los míos. Lo oculta en el acto y le
-- avisa a Sistemas UNA vez (pedirlo de nuevo mientras está pendiente no
-- vuelve a avisar).
CREATE OR REPLACE FUNCTION public.testimonios_solicitar_eliminacion(p_id uuid, p_motivo text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    yo       uuid := auth.uid();
    x        record;
    v_motivo text := NULLIF(regexp_replace(COALESCE(p_motivo, ''), '^\s+|\s+$', '', 'g'), '');
    v_vars   jsonb;
    v_admin  record;
BEGIN
    IF yo IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;

    SELECT * INTO x FROM public.gcx_testimonios WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF x.autor_id <> yo THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_es_tuyo');
    END IF;
    IF x.estado = 'eliminacion_solicitada' THEN
        RETURN jsonb_build_object('ok', true, 'ya_solicitado', true);
    END IF;
    IF char_length(v_motivo) > 500 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'motivo_largo', 'limite', 500);
    END IF;

    UPDATE public.gcx_testimonios
       SET estado = 'eliminacion_solicitada',
           estado_antes_del_pedido = x.estado,
           eliminacion_pedida_at = now(),
           eliminacion_motivo = v_motivo,
           decision = NULL, decidido_at = NULL, decidido_por = NULL
     WHERE id = p_id;

    v_vars := jsonb_build_object(
        'nombre', COALESCE((SELECT NULLIF(btrim(name), '') FROM public.users WHERE id = yo), 'Alguien'),
        'grupo',  COALESCE((SELECT name FROM public.groups WHERE id = x.group_id), 'un GCX'));
    FOR v_admin IN
        SELECT id FROM public.users
         WHERE (role)::text = 'SUPER_ADMIN' OR COALESCE(roles, '{}') && ARRAY['SUPER_ADMIN']
    LOOP
        PERFORM public.notif_emitir('testimonios_eliminacion_solicitada', v_admin.id, v_vars);
    END LOOP;

    RETURN jsonb_build_object('ok', true, 'ya_solicitado', false);
END;
$fn$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 5 · SISTEMAS (sólo SUPER_ADMIN)                                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Todos, con estado y autor; los pedidos de eliminación primero (el más viejo
-- arriba) y después los más nuevos. Filtros opcionales: estado, búsqueda (GCX,
-- autor o texto), temporada y año. Trae cuántos hay en cada estado.
CREATE OR REPLACE FUNCTION public.testimonios_admin_listar(
    p_estado    text DEFAULT NULL,
    p_busqueda  text DEFAULT NULL,
    p_temporada text DEFAULT NULL,
    p_anio      integer DEFAULT NULL,
    p_limite    integer DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    yo uuid := auth.uid();
    q  text := NULLIF(left(public.testimonios_norm(p_busqueda), 100), '');
    v  jsonb;
    c  jsonb;
BEGIN
    IF yo IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF NOT public.testimonios_es_sistemas(yo) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    END IF;
    IF p_estado IS NOT NULL AND p_estado NOT IN ('publicado', 'eliminacion_solicitada', 'oculto') THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'estado_invalido');
    END IF;

    SELECT COALESCE(jsonb_agg(f.j ORDER BY f.pedido DESC, f.orden_pedido, f.created_at DESC, f.id), '[]'::jsonb)
      INTO v
      FROM (
        SELECT x.id, x.created_at,
               x.estado = 'eliminacion_solicitada' AS pedido,
               CASE WHEN x.estado = 'eliminacion_solicitada' THEN x.eliminacion_pedida_at END AS orden_pedido,
               jsonb_build_object(
                   'id', x.id,
                   'estado', x.estado,
                   'texto', x.texto,
                   'autor', jsonb_build_object('id', u.id, 'nombre', u.name, 'email', u.email),
                   'grupo', jsonb_build_object('id', g.id, 'nombre', g.name),
                   'temporada', x.temporada,
                   'anio', x.anio,
                   'corazones', (SELECT count(*) FROM public.gcx_testimonios_corazones k WHERE k.testimonio_id = x.id),
                   'creado', x.created_at,
                   'consentimiento', x.consentimiento_at,
                   'eliminacion_pedida', x.eliminacion_pedida_at,
                   'eliminacion_motivo', x.eliminacion_motivo,
                   'estado_antes_del_pedido', x.estado_antes_del_pedido,
                   'decision', x.decision,
                   'decidido', x.decidido_at,
                   'decidido_por', (SELECT name FROM public.users d WHERE d.id = x.decidido_por)) AS j
          FROM public.gcx_testimonios x
          JOIN public.users u ON u.id = x.autor_id
          JOIN public.groups g ON g.id = x.group_id
         WHERE (p_estado IS NULL OR x.estado = p_estado)
           AND (p_temporada IS NULL OR x.temporada = p_temporada)
           AND (p_anio IS NULL OR x.anio = p_anio)
           AND (q IS NULL
                OR position(q IN public.testimonios_norm(g.name)) > 0
                OR position(q IN public.testimonios_norm(u.name)) > 0
                OR position(q IN public.testimonios_norm(x.texto)) > 0)
         ORDER BY (x.estado = 'eliminacion_solicitada') DESC,
                  CASE WHEN x.estado = 'eliminacion_solicitada' THEN x.eliminacion_pedida_at END,
                  x.created_at DESC
         LIMIT LEAST(GREATEST(COALESCE(p_limite, 200), 1), 500)
      ) f;

    SELECT jsonb_build_object(
               'publicado', count(*) FILTER (WHERE estado = 'publicado'),
               'eliminacion_solicitada', count(*) FILTER (WHERE estado = 'eliminacion_solicitada'),
               'oculto', count(*) FILTER (WHERE estado = 'oculto'))
      INTO c FROM public.gcx_testimonios;

    RETURN jsonb_build_object('ok', true, 'testimonios', v, 'cantidades', c);
END;
$fn$;

-- Lo que decide Sistemas:
--   eliminar → se borra de verdad, con sus corazones (queda en audit_logs).
--   rechazar → el pedido de eliminación se rechaza y vuelve a como estaba.
--   ocultar  → un publicado deja de verse.
--   mostrar  → un oculto vuelve a verse.
CREATE OR REPLACE FUNCTION public.testimonios_admin_resolver(p_id uuid, p_accion text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    yo uuid := auth.uid();
    x  record;
BEGIN
    IF yo IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF NOT public.testimonios_es_sistemas(yo) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    END IF;
    IF p_accion IS NULL OR p_accion NOT IN ('eliminar', 'rechazar', 'ocultar', 'mostrar') THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'accion_invalida');
    END IF;

    SELECT * INTO x FROM public.gcx_testimonios WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;

    IF p_accion = 'eliminar' THEN
        DELETE FROM public.gcx_testimonios WHERE id = p_id;
        RETURN jsonb_build_object('ok', true, 'accion', 'eliminar', 'estado', NULL);
    END IF;

    IF p_accion = 'rechazar' THEN
        IF x.estado <> 'eliminacion_solicitada' THEN
            RETURN jsonb_build_object('ok', false, 'motivo', 'estado_invalido', 'estado', x.estado);
        END IF;
        UPDATE public.gcx_testimonios
           SET estado = COALESCE(x.estado_antes_del_pedido, 'publicado'),
               estado_antes_del_pedido = NULL,
               decision = 'pedido_rechazado', decidido_at = now(), decidido_por = yo
         WHERE id = p_id;
        RETURN jsonb_build_object('ok', true, 'accion', 'rechazar', 'estado', COALESCE(x.estado_antes_del_pedido, 'publicado'));
    END IF;

    -- ocultar / mostrar: con un pedido pendiente, primero se resuelve el pedido.
    IF x.estado = 'eliminacion_solicitada' THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'estado_invalido', 'estado', x.estado);
    END IF;
    IF (p_accion = 'ocultar' AND x.estado = 'oculto') OR (p_accion = 'mostrar' AND x.estado = 'publicado') THEN
        RETURN jsonb_build_object('ok', true, 'accion', p_accion, 'estado', x.estado, 'sin_cambios', true);
    END IF;
    UPDATE public.gcx_testimonios
       SET estado = CASE p_accion WHEN 'ocultar' THEN 'oculto' ELSE 'publicado' END,
           decision = CASE p_accion WHEN 'ocultar' THEN 'oculto' ELSE 'mostrado' END,
           decidido_at = now(), decidido_por = yo
     WHERE id = p_id;
    RETURN jsonb_build_object('ok', true, 'accion', p_accion,
                              'estado', CASE p_accion WHEN 'ocultar' THEN 'oculto' ELSE 'publicado' END);
END;
$fn$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 6 · EL AVISO A SISTEMAS (catálogo de notificaciones)                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Una alerta automática más, con el patrón de sistemas_solicitud_datos. La
-- emite testimonios_solicitar_eliminacion con notif_emitir. Abre la pestaña
-- de moderación de Sistemas (la arma el prompt 4).
INSERT INTO public.notif_alertas
    (clave, tipo, nombre, descripcion_evento, destinatario_texto, variables,
     titulo_plantilla, mensaje_plantilla, url_plantilla, type_legacy,
     permite_apagar, nombre_publico, descripcion_publica, area)
VALUES
    ('testimonios_eliminacion_solicitada', 'automatica',
     'Pedido para eliminar un testimonio',
     'alguien pide eliminar su testimonio de un GCX',
     'Sistemas (SUPER_ADMIN)',
     ARRAY['nombre', 'grupo'],
     'Pedido para eliminar un testimonio',
     '{nombre} pidió eliminar su testimonio de "{grupo}". Ya no se ve mientras lo revisás.',
     '/panel-admin?tab=testimonios', 'ADMIN',
     true, 'Pedidos para eliminar testimonios',
     'Cuando alguien pide eliminar su testimonio de un GCX.', 'Sistemas')
ON CONFLICT (clave) DO NOTHING;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 7 · PERMISOS                                                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Supabase le da EXECUTE a anon y authenticated en cada función nueva: se
-- saca de todas y se da sólo donde corresponde.
REVOKE ALL ON FUNCTION
    public.testimonios_norm(text),
    public.testimonios_temporada_de_fecha(text),
    public.testimonios_fecha_md(integer, text, text),
    public.testimonios_temporada_en(timestamptz),
    public.testimonios_grupo_es_de(text, text, jsonb),
    public.testimonios_anfitriones(text),
    public.testimonios_inscripto(uuid, text),
    public.testimonios_es_sistemas(uuid),
    public.testimonios_nombre_publico(text, date, timestamptz),
    public.testimonios_rol_en_grupo(uuid, text),
    public.testimonios_auditar(),
    public.testimonios_grupos_en(text, timestamptz),
    public.testimonios_grupo_en(text, timestamptz),
    public.testimonios_mis_grupos_en(timestamptz),
    public.testimonios_publicar_en(text, text, boolean, timestamptz),
    public.testimonios_corazon_en(uuid, boolean, timestamptz),
    public.testimonios_temporada(),
    public.testimonios_grupos(text),
    public.testimonios_grupo(text),
    public.testimonios_mis_grupos(),
    public.testimonios_publicar(text, text, boolean),
    public.testimonios_corazon(uuid, boolean),
    public.testimonios_mios(),
    public.testimonios_solicitar_eliminacion(uuid, text),
    public.testimonios_admin_listar(text, text, text, integer, integer),
    public.testimonios_admin_resolver(uuid, text)
FROM PUBLIC, anon, authenticated;

-- Públicas: se ven sin sesión.
GRANT EXECUTE ON FUNCTION
    public.testimonios_temporada(),
    public.testimonios_grupos(text),
    public.testimonios_grupo(text)
TO anon, authenticated;

-- Con sesión (las de Sistemas miran el rol adentro).
GRANT EXECUTE ON FUNCTION
    public.testimonios_mis_grupos(),
    public.testimonios_publicar(text, text, boolean),
    public.testimonios_corazon(uuid, boolean),
    public.testimonios_mios(),
    public.testimonios_solicitar_eliminacion(uuid, text),
    public.testimonios_admin_listar(text, text, text, integer, integer),
    public.testimonios_admin_resolver(uuid, text)
TO authenticated;
