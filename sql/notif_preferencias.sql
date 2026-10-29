-- ════════════════════════════════════════════════════════════════════════════
-- GESTIÓN DE NOTIFICACIONES · cada persona elige qué le llega
-- 2026-10-29 · prompt 4 de 4
-- ✅ APLICADO el 2026-10-29 (20:28 UTC), después de send-push v5 (20:28).
--    PROBAR_ 36/36 contra producción; catálogo 77/77, programadas 93/93 y
--    prueba 18/18 siguen iguales.
--
-- QUÉ ES "APAGAR"
--   Apagar una alerta = no te suena el teléfono con ella, en ninguno de tus
--   dispositivos. El aviso IGUAL queda en /notificaciones (la misma regla que
--   pausar una automática): nadie se pierde que le asignaron una tarea.
--   Sistemas decide qué se puede apagar (notif_alertas.permite_apagar). Si una
--   alerta deja de ser apagable, lo que la gente eligió no se borra: sólo no se
--   aplica mientras siga así.
--
-- LO QUE AGREGA
--   1 · notif_alertas: permite_apagar, nombre_publico, descripcion_publica,
--       area y principal_id (los avisos repetidos apuntan a su alerta
--       principal: a la persona le aparece una sola entrada y apagarla apaga
--       las dos).
--   2 · notif_silenciadas: sólo lo apagado. RLS: cada uno ve lo suyo; se
--       escribe sólo por RPC.
--   3 · notif_puede_enviar (el punto ÚNICO que decide si sale un push) suma
--       la decisión 'silenciada', que queda en notif_push_log. Por ahí pasan
--       el trigger fila por fila, el lote de las programadas y los diferidos.
--   4 · notif_mis_preferencias() y notif_silenciar() para la persona.
--   5 · notif_alertas_admin() suma apagada_por y permite_apagar; los dos
--       "guardar" aceptan p_permite_apagar.
--
-- ORDEN DE APLICACIÓN (IMPORTANTE)
--   1 · PRIMERO desplegar send-push con la decisión 'silenciada' (armado.ts).
--       El send-push de antes no la conoce y, como falla abriendo, la
--       mandaría igual.
--   2 · Después, este archivo.
--
-- notif_probar_texto (la prueba a uno mismo) NO respeta lo apagado: su aviso
-- va sin alerta_clave, y notif_puede_enviar manda siempre lo que no tiene
-- clave.
--
-- Pruebas: sql/PROBAR_notif_preferencias.sql · Deshacer: sql/ROLLBACK_notif_preferencias.sql
-- ════════════════════════════════════════════════════════════════════════════


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1 · LAS COLUMNAS DEL CATÁLOGO                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.notif_alertas
    ADD COLUMN IF NOT EXISTS permite_apagar boolean NOT NULL DEFAULT true,
    -- Lo que ve la persona en sus preferencias. Las programadas usan su
    -- nombre y su alcance.
    ADD COLUMN IF NOT EXISTS nombre_publico text,
    ADD COLUMN IF NOT EXISTS descripcion_publica text,
    ADD COLUMN IF NOT EXISTS area text,
    -- Los avisos repetidos (mismo hecho, dos productores) apuntan a la
    -- alerta principal. Lo apagado se guarda en la principal.
    ADD COLUMN IF NOT EXISTS principal_id uuid REFERENCES public.notif_alertas(id) ON DELETE SET NULL;

ALTER TABLE public.notif_alertas DROP CONSTRAINT IF EXISTS notif_alertas_principal_ok;
ALTER TABLE public.notif_alertas ADD CONSTRAINT notif_alertas_principal_ok
    CHECK (principal_id IS NULL OR principal_id <> id);

COMMENT ON COLUMN public.notif_alertas.permite_apagar IS
    'Si cada persona la puede apagar en /notificaciones. Lo decide Sistemas. Apagada = no suena; el aviso queda en la app.';
COMMENT ON COLUMN public.notif_alertas.principal_id IS
    'Aviso repetido: la alerta principal del mismo hecho. La persona ve una sola entrada y apagarla apaga las dos.';


-- ── Los nombres para la persona, el área y los repetidos ───────────────────
UPDATE public.notif_alertas a SET
    nombre_publico = x.nombre, descripcion_publica = x.descripcion, area = x.area
FROM (VALUES
    ('gcx_solicitud_ingreso',       'Solicitudes para sumarse a tu grupo', 'Cuando alguien quiere sumarse a un grupo que liderás.', 'GCX'),
    ('gcx_solicitud_ingreso_app',   'Solicitudes para sumarse a tu grupo', 'Cuando alguien quiere sumarse a un grupo que liderás.', 'GCX'),
    ('gcx_solicitud_pareja_app',    'Solicitudes para sumarse a tu grupo', 'Cuando una pareja quiere sumarse a un grupo que liderás.', 'GCX'),
    ('gcx_inscripcion_aprobada',    'Te aceptaron en un grupo',            'Cuando el anfitrión aprueba tu inscripción a un GCX.', 'GCX'),
    ('gcx_inscripcion_rechazada',   'Respuesta a tu inscripción',          'Cuando el anfitrión no puede sumarte a un GCX.', 'GCX'),
    ('gcx_asistencia_guardada',     'Asistencia guardada',                 'Cuando cargás la asistencia de una reunión de tu grupo.', 'GCX'),
    ('gcx_recordatorio_asistencia', 'Recordatorio de asistencia',          'Cuando terminó la reunión de tu grupo y todavía no cargaste la asistencia.', 'GCX'),
    ('gcx_grupo_aprobado',          'Tu grupo fue aprobado',               'Cuando aprueban un grupo que creaste.', 'GCX'),
    ('gcx_grupo_aprobado_app',      'Tu grupo fue aprobado',               'Cuando aprueban un grupo que creaste.', 'GCX'),
    ('gcx_grupo_rechazado_app',     'Tu grupo no fue aprobado',            'Cuando no pueden aprobar un grupo que creaste.', 'GCX'),
    ('agenda_tarea_asignada',       'Tareas nuevas',                       'Cuando le asignan una tarea a tu equipo en Agenda Origen.', 'Agenda'),
    ('agenda_tarea_completada',     'Tareas completadas',                  'Cuando alguien completa una tarea de un departamento que encargás.', 'Agenda'),
    ('agenda_solicitud_nueva',      'Pedidos a tu departamento',           'Cuando alguien le pide algo a un departamento que encargás.', 'Agenda'),
    ('agenda_solicitud_aceptada',   'Tu pedido fue aceptado',              'Cuando un departamento acepta algo que le pediste.', 'Agenda'),
    ('agenda_solicitud_rechazada',  'Tu pedido no fue aceptado',           'Cuando un departamento no puede tomar algo que le pediste.', 'Agenda'),
    ('punto_pedido_listo',          'Tu compra está lista',                'Cuando tu pedido está listo para retirar en el Punto de Información.', 'Punto de información'),
    ('sistemas_reporte_problema',   'Reportes de problemas',               'Cuando alguien reporta un problema en la app.', 'Sistemas'),
    ('sistemas_solicitud_datos',    'Pedidos de datos personales',         'Cuando alguien pide ver, corregir o borrar sus datos.', 'Sistemas'),
    ('app_version_nueva',           'Versión nueva de la app',             'Cuando sale una actualización de Origen.', 'App'),
    ('push_prueba',                 'Notificación de prueba',              'Cuando probás las notificaciones desde Mi cuenta.', 'App')
) AS x(clave, nombre, descripcion, area)
WHERE a.clave = x.clave;

-- La prueba que uno se manda a sí mismo no tiene sentido apagarla.
UPDATE public.notif_alertas SET permite_apagar = false WHERE clave = 'push_prueba';

-- Los repetidos (sección 40, "Avisos repetidos"): mismo hecho, dos productores.
UPDATE public.notif_alertas r SET principal_id = p.id
  FROM public.notif_alertas p
 WHERE (r.clave, p.clave) IN (
        ('gcx_solicitud_ingreso_app', 'gcx_solicitud_ingreso'),
        ('gcx_solicitud_pareja_app',  'gcx_solicitud_ingreso'),
        ('gcx_grupo_aprobado_app',    'gcx_grupo_aprobado'));


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2 · LO APAGADO                                                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- user_id apunta a public.users (como app_notifications y notif_alertas), no a
-- profiles: profiles es una tabla vieja que no tiene a 6 de cada 10 cuentas.
CREATE TABLE IF NOT EXISTS public.notif_silenciadas (
    user_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    alerta_id uuid NOT NULL REFERENCES public.notif_alertas(id) ON DELETE CASCADE,
    creado_en timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, alerta_id)
);

CREATE INDEX IF NOT EXISTS notif_silenciadas_alerta_idx ON public.notif_silenciadas (alerta_id);

ALTER TABLE public.notif_silenciadas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notif_silenciadas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.notif_silenciadas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notif_silenciadas TO service_role;

DROP POLICY IF EXISTS notif_silenciadas_ver_propias ON public.notif_silenciadas;
CREATE POLICY notif_silenciadas_ver_propias ON public.notif_silenciadas
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

COMMENT ON TABLE public.notif_silenciadas IS
    'Las alertas que cada persona apagó (sólo lo apagado). Se lee lo propio; se escribe sólo por notif_silenciar().';


-- ── El log acepta 'silenciada' ──────────────────────────────────────────────
ALTER TABLE public.notif_push_log DROP CONSTRAINT IF EXISTS notif_push_log_resultado_check;
ALTER TABLE public.notif_push_log ADD CONSTRAINT notif_push_log_resultado_check
    CHECK (resultado IN ('enviado', 'pausada', 'tope', 'diferido', 'fallo', 'prueba', 'silenciada'));


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3 · EL PUNTO ÚNICO: notif_puede_enviar                                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Igual que antes más un paso: después de la pausa de Sistemas, lo que apagó
-- la persona. Se mira la alerta principal (repetidos) y sólo si permite_apagar.
CREATE OR REPLACE FUNCTION public.notif_puede_enviar(p_notificacion_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    ZONA constant text := 'America/Argentina/Buenos_Aires';
    v_n record;
    v_a record;
    v_hoy timestamptz;
    v_hasta timestamptz;
    v_usados integer;
BEGIN
    SELECT user_id, alerta_clave INTO v_n
      FROM public.app_notifications WHERE id = p_notificacion_id;

    IF NOT FOUND OR v_n.alerta_clave IS NULL THEN
        RETURN jsonb_build_object('decision', 'enviar');
    END IF;

    SELECT id, principal_id, activa, no_molestar, no_molestar_desde, no_molestar_hasta, max_por_dia
      INTO v_a
      FROM public.notif_alertas WHERE clave = v_n.alerta_clave;

    -- Una clave que ya no está en el catálogo tampoco frena nada.
    IF NOT FOUND THEN
        RETURN jsonb_build_object('decision', 'enviar');
    END IF;

    IF NOT v_a.activa THEN
        RETURN jsonb_build_object('decision', 'pausada');
    END IF;

    -- Lo que apagó la persona: en la principal, y si la principal se puede
    -- apagar (si Sistemas la volvió no apagable, lo elegido no se aplica).
    IF EXISTS (
        SELECT 1
          FROM public.notif_silenciadas s
          JOIN public.notif_alertas p ON p.id = s.alerta_id
         WHERE s.user_id = v_n.user_id
           AND s.alerta_id = COALESCE(v_a.principal_id, v_a.id)
           AND p.permite_apagar
    ) THEN
        RETURN jsonb_build_object('decision', 'silenciada');
    END IF;

    -- El tope, contado sobre lo que REALMENTE salió hoy (hora argentina).
    IF v_a.max_por_dia IS NOT NULL THEN
        v_hoy := (date_trunc('day', now() AT TIME ZONE ZONA)) AT TIME ZONE ZONA;
        SELECT count(*) INTO v_usados
          FROM public.notif_push_log
         WHERE user_id = v_n.user_id
           AND alerta_clave = v_n.alerta_clave
           AND resultado = 'enviado'
           AND enviado_at >= v_hoy;
        IF v_usados >= v_a.max_por_dia THEN
            RETURN jsonb_build_object('decision', 'tope');
        END IF;
    END IF;

    -- No molestar: el push no se pierde, se manda cuando el horario termina.
    IF v_a.no_molestar THEN
        v_hasta := public.notif_no_molestar_hasta(now(), v_a.no_molestar_desde, v_a.no_molestar_hasta);
        IF v_hasta IS NOT NULL THEN
            RETURN jsonb_build_object('decision', 'diferir', 'enviar_en', v_hasta);
        END IF;
    END IF;

    RETURN jsonb_build_object('decision', 'enviar');
END;
$fn$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4 · LO QUE USA LA PERSONA                                                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── Mis preferencias ────────────────────────────────────────────────────────
-- Las alertas que tienen sentido para quien pregunta:
--   · automáticas que le llegaron alguna vez (por su principal);
--   · programadas activas cuya audiencia lo incluye (notif_audiencia, la misma
--     del motor);
--   · las que ya tiene apagadas, para que las pueda volver a prender.
-- Sólo las que se pueden apagar y no están eliminadas. Una por pareja de
-- repetidos (la principal).
CREATE OR REPLACE FUNCTION public.notif_mis_preferencias()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_uid uuid := auth.uid();
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;

    RETURN jsonb_build_object('ok', true, 'alertas', COALESCE((
        WITH candidatas AS (
            SELECT COALESCE(a.principal_id, a.id) AS id
              FROM public.notif_alertas a
             WHERE a.tipo = 'automatica'
               AND EXISTS (SELECT 1 FROM public.app_notifications n
                            WHERE n.user_id = v_uid AND n.alerta_clave = a.clave)
            UNION
            SELECT a.id
              FROM public.notif_alertas a
             WHERE a.tipo = 'programada' AND a.activa AND a.eliminada_at IS NULL
               AND EXISTS (SELECT 1 FROM public.notif_audiencia(a.audiencia_todos, a.audiencia_roles, a.audiencia_usuarios) x
                            WHERE x.user_id = v_uid)
            UNION
            SELECT s.alerta_id FROM public.notif_silenciadas s WHERE s.user_id = v_uid
        )
        SELECT jsonb_agg(jsonb_build_object(
                   'id', a.id,
                   'nombre', CASE WHEN a.tipo = 'programada' THEN a.nombre ELSE COALESCE(a.nombre_publico, a.nombre) END,
                   'descripcion', CASE
                        WHEN a.tipo = 'programada' THEN
                            (SELECT (al->>'frecuencia') || ' a las ' || (al->>'horario')
                               FROM public.notif_alcance_programada(a.cada_n_dias, a.horas, a.siempre_activa, a.desde, a.hasta) al)
                        ELSE COALESCE(a.descripcion_publica, 'Cuando ' || a.descripcion_evento || '.') END,
                   'area', CASE WHEN a.tipo = 'programada' THEN 'Avisos de la iglesia' ELSE COALESCE(a.area, 'App') END,
                   'tipo', a.tipo,
                   'apagada', EXISTS (SELECT 1 FROM public.notif_silenciadas s WHERE s.user_id = v_uid AND s.alerta_id = a.id))
               ORDER BY CASE COALESCE(CASE WHEN a.tipo = 'programada' THEN 'Avisos de la iglesia' END, a.area, 'App')
                            WHEN 'Avisos de la iglesia' THEN 1 WHEN 'GCX' THEN 2 WHEN 'Agenda' THEN 3
                            WHEN 'Punto de información' THEN 4 WHEN 'Sistemas' THEN 5 ELSE 6 END,
                        lower(COALESCE(a.nombre_publico, a.nombre)))
          FROM candidatas c
          JOIN public.notif_alertas a ON a.id = c.id
         WHERE a.permite_apagar
           AND a.eliminada_at IS NULL
           AND a.principal_id IS NULL
    ), '[]'::jsonb));
END;
$fn$;


-- ── Apagar o prender una alerta para uno mismo ──────────────────────────────
-- Sólo para auth.uid(): no recibe a quién. Un repetido se guarda en su
-- principal, así apagar cualquiera de los dos apaga los dos.
CREATE OR REPLACE FUNCTION public.notif_silenciar(p_alerta_id uuid, p_apagada boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_uid uuid := auth.uid();
    v_principal uuid;
    v_apagable boolean;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF p_apagada IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'estado_invalido');
    END IF;

    SELECT COALESCE(a.principal_id, a.id) INTO v_principal
      FROM public.notif_alertas a
     WHERE a.id = p_alerta_id AND a.eliminada_at IS NULL;
    IF v_principal IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;

    SELECT permite_apagar INTO v_apagable FROM public.notif_alertas WHERE id = v_principal;
    IF NOT COALESCE(v_apagable, false) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_apagable');
    END IF;

    IF p_apagada THEN
        INSERT INTO public.notif_silenciadas (user_id, alerta_id)
        VALUES (v_uid, v_principal)
        ON CONFLICT (user_id, alerta_id) DO NOTHING;
    ELSE
        DELETE FROM public.notif_silenciadas
         WHERE user_id = v_uid
           AND alerta_id IN (v_principal, p_alerta_id);
    END IF;

    RETURN jsonb_build_object('ok', true, 'apagada', p_apagada);
END;
$fn$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 5 · LO QUE USA SISTEMAS                                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- notif_alertas_admin(): las mismas claves de antes más permite_apagar,
-- apagada_por, principal_id y principal_nombre. Copiada de producción el
-- 2026-10-29 y con esas cuatro sumadas.
CREATE OR REPLACE FUNCTION public.notif_alertas_admin()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_personas integer;
BEGIN
    IF auth.uid() IS NULL OR NOT public.tiene_rol(ARRAY['SUPER_ADMIN']) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    SELECT count(DISTINCT p.user_id) INTO v_personas
      FROM public.push_suscripciones p
      JOIN public.users u ON u.id = p.user_id
     WHERE u.is_active IS NOT FALSE;

    RETURN jsonb_build_object(
        'ok', true,
        'personas_con_push', v_personas,
        'alertas', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', a.id,
                'clave', a.clave,
                'tipo', a.tipo,
                'nombre', a.nombre,
                'descripcion_evento', a.descripcion_evento,
                'destinatario_texto', a.destinatario_texto,
                'variables', COALESCE(a.variables, '{}'),
                'titulo_plantilla', a.titulo_plantilla,
                'mensaje_plantilla', a.mensaje_plantilla,
                'url_plantilla', a.url_plantilla,
                'type_legacy', a.type_legacy,
                'activa', a.activa,
                'no_molestar', a.no_molestar,
                'no_molestar_desde', a.no_molestar_desde,
                'no_molestar_hasta', a.no_molestar_hasta,
                'max_por_dia', a.max_por_dia,
                'siempre_activa', a.siempre_activa,
                'desde', a.desde,
                'hasta', a.hasta,
                'cada_n_dias', a.cada_n_dias,
                'horas', a.horas,
                'audiencia_todos', a.audiencia_todos,
                'audiencia_roles', a.audiencia_roles,
                'audiencia_usuarios', a.audiencia_usuarios,
                'updated_at', a.updated_at,
                'enviados_7d', COALESCE((
                    SELECT count(*) FROM public.notif_push_log l
                     WHERE l.alerta_clave = a.clave
                       AND l.resultado = 'enviado'
                       AND l.enviado_at > now() - interval '7 days'), 0),
                'personas_con_push', v_personas,
                'permite_apagar', a.permite_apagar,
                -- Cuántas personas la apagaron (en un repetido, las de su principal).
                'apagada_por', (SELECT count(*) FROM public.notif_silenciadas s
                                 WHERE s.alerta_id = COALESCE(a.principal_id, a.id)),
                'principal_id', a.principal_id,
                'principal_nombre', (SELECT p.nombre FROM public.notif_alertas p WHERE p.id = a.principal_id)
            ) || CASE WHEN a.tipo = 'programada' THEN (
                SELECT jsonb_build_object(
                    'alcance', al->>'alcance',
                    'alcance_detalle', al - 'alcance',
                    'audiencia_personas', au.personas,
                    'audiencia_con_push', au.con_push,
                    'audiencia_detalle', COALESCE((
                        SELECT jsonb_agg(jsonb_build_object('id', u.id, 'nombre', u.name,
                                                            'activa', u.is_active IS NOT FALSE)
                                         ORDER BY lower(COALESCE(u.name, '')))
                          FROM public.users u WHERE u.id = ANY (COALESCE(a.audiencia_usuarios, '{}'))), '[]'::jsonb),
                    'proximo_envio', public.notif_proximo_envio(a.id))
                  FROM public.notif_alcance_programada(a.cada_n_dias, a.horas, a.siempre_activa, a.desde, a.hasta) al,
                       LATERAL (SELECT count(*) AS personas,
                                       count(*) FILTER (WHERE EXISTS (
                                           SELECT 1 FROM public.push_suscripciones p WHERE p.user_id = x.user_id)) AS con_push
                                  FROM public.notif_audiencia(a.audiencia_todos, a.audiencia_roles, a.audiencia_usuarios) x) au
            ) ELSE '{}'::jsonb END
            ORDER BY a.tipo, a.nombre)
            FROM public.notif_alertas a
           WHERE a.eliminada_at IS NULL
        ), '[]'::jsonb));
END;
$function$;


-- ── Los dos "guardar" aceptan p_permite_apagar ──────────────────────────────
-- Copiadas de producción el 2026-10-29 con el parámetro nuevo al final y
-- DEFAULT NULL (= no se toca): los llamados de antes siguen andando igual.
-- Cambia la firma, así que primero se borra la vieja (si no, quedan dos).
DROP FUNCTION IF EXISTS public.notif_guardar_automatica(uuid, text, text, boolean, boolean, time, time, integer);
DROP FUNCTION IF EXISTS public.notif_guardar_programada(uuid, text, text, text, text, boolean, date, date, integer, time[], boolean, text[], uuid[], boolean, time, time, integer, boolean);

CREATE OR REPLACE FUNCTION public.notif_guardar_automatica(p_id uuid, p_titulo text, p_mensaje text, p_activa boolean, p_no_molestar boolean, p_desde time without time zone DEFAULT NULL::time without time zone, p_hasta time without time zone DEFAULT NULL::time without time zone, p_max_por_dia integer DEFAULT NULL::integer, p_permite_apagar boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_uid uuid := auth.uid();
    v_a record;
    v_titulo  text := btrim(COALESCE(p_titulo, ''));
    v_mensaje text := btrim(COALESCE(p_mensaje, ''));
    v_sueltas text[];
BEGIN
    IF v_uid IS NULL OR NOT public.tiene_rol(ARRAY['SUPER_ADMIN']) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    SELECT * INTO v_a FROM public.notif_alertas WHERE id = p_id AND tipo = 'automatica';
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;

    IF v_titulo = '' OR length(v_titulo) > 120 OR v_mensaje = '' OR length(v_mensaje) > 500 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'texto_invalido');
    END IF;

    -- Sólo las variables de esta alerta: una {que_no_existe} llegaría al
    -- teléfono como un hueco.
    SELECT array_agg(DISTINCT m[1]) INTO v_sueltas
      FROM regexp_matches(v_titulo || ' ' || v_mensaje, '\{([a-z][a-z0-9_]{0,29})\}', 'g') m
     WHERE NOT (m[1] = ANY (COALESCE(v_a.variables, '{}')));
    IF v_sueltas IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'variable_invalida', 'variables', v_sueltas);
    END IF;

    IF p_max_por_dia IS NOT NULL AND p_max_por_dia NOT BETWEEN 1 AND 20 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'tope_invalido');
    END IF;

    IF COALESCE(p_no_molestar, false) AND (p_desde IS NULL OR p_hasta IS NULL OR p_desde = p_hasta) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'horario_invalido');
    END IF;

    UPDATE public.notif_alertas
       SET titulo_plantilla  = v_titulo,
           mensaje_plantilla = v_mensaje,
           activa            = COALESCE(p_activa, true),
           no_molestar       = COALESCE(p_no_molestar, false),
           no_molestar_desde = CASE WHEN COALESCE(p_no_molestar, false) THEN p_desde END,
           no_molestar_hasta = CASE WHEN COALESCE(p_no_molestar, false) THEN p_hasta END,
           max_por_dia       = p_max_por_dia,
           -- NULL = no se toca (los llamados de antes no lo mandan).
           permite_apagar    = COALESCE(p_permite_apagar, permite_apagar),
           updated_at        = now(),
           updated_by        = v_uid
     WHERE id = p_id;

    RETURN jsonb_build_object('ok', true);
END;
$function$;


CREATE OR REPLACE FUNCTION public.notif_guardar_programada(p_id uuid, p_nombre text, p_titulo text, p_mensaje text, p_url text, p_siempre_activa boolean, p_desde date, p_hasta date, p_cada_n_dias integer, p_horas time without time zone[], p_audiencia_todos boolean, p_audiencia_roles text[], p_audiencia_usuarios uuid[], p_no_molestar boolean DEFAULT false, p_nm_desde time without time zone DEFAULT NULL::time without time zone, p_nm_hasta time without time zone DEFAULT NULL::time without time zone, p_max_por_dia integer DEFAULT NULL::integer, p_activa boolean DEFAULT true, p_permite_apagar boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    ZONA constant text := 'America/Argentina/Buenos_Aires';
    v_uid     uuid := auth.uid();
    v_id      uuid := COALESCE(p_id, gen_random_uuid());
    v_nombre  text := btrim(COALESCE(p_nombre, ''));
    v_titulo  text := btrim(COALESCE(p_titulo, ''));
    v_mensaje text := btrim(COALESCE(p_mensaje, ''));
    v_url     text := NULLIF(btrim(COALESCE(p_url, '')), '');
    v_siempre boolean := COALESCE(p_siempre_activa, true);
    v_desde   date := COALESCE(p_desde, (now() AT TIME ZONE ZONA)::date);
    v_hasta   date := CASE WHEN COALESCE(p_siempre_activa, true) THEN NULL ELSE p_hasta END;
    v_todos   boolean := COALESCE(p_audiencia_todos, false);
    v_roles   text[];
    v_users   uuid[];
    v_horas   time[];
    v_malos   text[];
    v_malos_u uuid[];
    v_nm      boolean := COALESCE(p_no_molestar, false);
    v_activa  boolean := COALESCE(p_activa, true);
    v_actual  record;
    v_clave   text;
BEGIN
    IF v_uid IS NULL OR NOT public.tiene_rol(ARRAY['SUPER_ADMIN']) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    -- ── El texto ──
    IF length(v_nombre) NOT BETWEEN 1 AND 120 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'texto_invalido', 'campo', 'nombre');
    END IF;
    IF length(v_titulo) NOT BETWEEN 1 AND 60 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'texto_invalido', 'campo', 'titulo');
    END IF;
    IF length(v_mensaje) NOT BETWEEN 1 AND 160 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'texto_invalido', 'campo', 'mensaje');
    END IF;
    -- Texto fijo: una programada no tiene de dónde sacar un {nombre}.
    IF (v_titulo || ' ' || v_mensaje) ~ '\{[^{}]*\}' THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'variable_invalida');
    END IF;
    IF v_url IS NOT NULL AND NOT public.notif_url_interna(v_url) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'url_invalida');
    END IF;

    -- ── La programación ──
    IF NOT v_siempre AND (v_hasta IS NULL OR v_hasta < v_desde) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'fechas_invalidas');
    END IF;
    IF p_cada_n_dias IS NULL OR p_cada_n_dias NOT BETWEEN 1 AND 365 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'frecuencia_invalida');
    END IF;
    -- Al minuto: "10:00:30" es "10:00". Así dos horarios del mismo minuto
    -- cuentan como repetidos.
    SELECT array_agg(make_time(extract(hour FROM h)::int, extract(minute FROM h)::int, 0) ORDER BY h)
      INTO v_horas FROM unnest(p_horas) h;
    IF v_horas IS NULL OR cardinality(v_horas) NOT BETWEEN 1 AND 5 OR array_position(v_horas, NULL) IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'horas_invalidas');
    END IF;
    IF NOT public.notif_horas_ok(v_horas) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'horas_repetidas');
    END IF;

    -- ── La audiencia ──
    IF NOT v_todos THEN
        SELECT array_agg(DISTINCT btrim(r)) INTO v_roles
          FROM unnest(COALESCE(p_audiencia_roles, '{}')) r WHERE btrim(COALESCE(r, '')) <> '';
        SELECT array_agg(DISTINCT u) INTO v_users
          FROM unnest(COALESCE(p_audiencia_usuarios, '{}')) u WHERE u IS NOT NULL;
    END IF;
    IF NOT v_todos AND v_roles IS NULL AND v_users IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'audiencia_vacia');
    END IF;
    SELECT array_agg(r) INTO v_malos FROM unnest(COALESCE(v_roles, '{}')) r
     WHERE NOT (r = ANY (public.notif_roles_validos()));
    IF v_malos IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'rol_invalido', 'roles', v_malos);
    END IF;
    SELECT array_agg(u) INTO v_malos_u FROM unnest(COALESCE(v_users, '{}')) u
     WHERE NOT EXISTS (SELECT 1 FROM public.users x WHERE x.id = u);
    IF v_malos_u IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'usuario_invalido', 'usuarios', v_malos_u);
    END IF;

    -- ── No molestar y tope (las mismas reglas que las automáticas) ──
    IF p_max_por_dia IS NOT NULL AND p_max_por_dia NOT BETWEEN 1 AND 20 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'tope_invalido');
    END IF;
    IF v_nm AND (p_nm_desde IS NULL OR p_nm_hasta IS NULL OR p_nm_desde = p_nm_hasta) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'horario_invalido');
    END IF;

    -- ── Crear o editar ──
    SELECT * INTO v_actual FROM public.notif_alertas WHERE id = v_id FOR UPDATE;

    IF FOUND AND v_actual.tipo <> 'programada' THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_es_programada');
    END IF;
    IF FOUND AND v_actual.eliminada_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'eliminada');
    END IF;

    IF NOT FOUND THEN
        v_clave := 'prog_' || left(replace(v_id::text, '-', ''), 12);
        IF EXISTS (SELECT 1 FROM public.notif_alertas WHERE clave = v_clave) THEN
            v_clave := 'prog_' || replace(v_id::text, '-', '');
        END IF;

        BEGIN
            INSERT INTO public.notif_alertas (
                id, clave, tipo, nombre, variables, titulo_plantilla, mensaje_plantilla,
                url_plantilla, type_legacy, activa, no_molestar, no_molestar_desde,
                no_molestar_hasta, max_por_dia, siempre_activa, desde, hasta, cada_n_dias,
                horas, audiencia_todos, audiencia_roles, audiencia_usuarios, reloj_desde,
                created_by, permite_apagar)
            VALUES (
                v_id, v_clave, 'programada', v_nombre, '{}', v_titulo, v_mensaje,
                v_url, 'PROGRAMADA', v_activa, v_nm,
                CASE WHEN v_nm THEN p_nm_desde END, CASE WHEN v_nm THEN p_nm_hasta END,
                p_max_por_dia, v_siempre, v_desde, v_hasta, p_cada_n_dias,
                v_horas, v_todos, COALESCE(v_roles, '{}'), COALESCE(v_users, '{}'), now(),
                v_uid, COALESCE(p_permite_apagar, true));
        EXCEPTION WHEN unique_violation THEN
            -- Otro pedido con el mismo id ganó la carrera: ya está creada.
            RETURN jsonb_build_object('ok', true, 'id', v_id, 'creada', false);
        END;

        RETURN jsonb_build_object('ok', true, 'id', v_id, 'clave', v_clave, 'creada', true);
    END IF;

    UPDATE public.notif_alertas
       SET nombre             = v_nombre,
           titulo_plantilla   = v_titulo,
           mensaje_plantilla  = v_mensaje,
           url_plantilla      = v_url,
           activa             = v_activa,
           no_molestar        = v_nm,
           no_molestar_desde  = CASE WHEN v_nm THEN p_nm_desde END,
           no_molestar_hasta  = CASE WHEN v_nm THEN p_nm_hasta END,
           max_por_dia        = p_max_por_dia,
           siempre_activa     = v_siempre,
           desde              = v_desde,
           hasta              = v_hasta,
           cada_n_dias        = p_cada_n_dias,
           horas              = v_horas,
           audiencia_todos    = v_todos,
           audiencia_roles    = COALESCE(v_roles, '{}'),
           audiencia_usuarios = COALESCE(v_users, '{}'),
           permite_apagar     = COALESCE(p_permite_apagar, v_actual.permite_apagar),
           -- El reloj vuelve a contar si se activó o si cambió cuándo sale.
           reloj_desde = CASE
               WHEN (v_activa AND NOT v_actual.activa)
                 OR v_siempre IS DISTINCT FROM v_actual.siempre_activa
                 OR v_desde IS DISTINCT FROM v_actual.desde
                 OR v_hasta IS DISTINCT FROM v_actual.hasta
                 OR p_cada_n_dias IS DISTINCT FROM v_actual.cada_n_dias
                 OR v_horas IS DISTINCT FROM v_actual.horas
               THEN now() ELSE v_actual.reloj_desde END,
           updated_at = now(),
           updated_by = v_uid
     WHERE id = v_id;

    RETURN jsonb_build_object('ok', true, 'id', v_id, 'clave', v_actual.clave, 'creada', false);
END;
$function$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 6 · PERMISOS                                                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
REVOKE ALL ON FUNCTION public.notif_puede_enviar(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notif_puede_enviar(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.notif_mis_preferencias() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notif_mis_preferencias() TO authenticated;
REVOKE ALL ON FUNCTION public.notif_silenciar(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notif_silenciar(uuid, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.notif_alertas_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notif_alertas_admin() TO authenticated;
REVOKE ALL ON FUNCTION public.notif_guardar_automatica(uuid, text, text, boolean, boolean, time, time, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notif_guardar_automatica(uuid, text, text, boolean, boolean, time, time, integer, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.notif_guardar_programada(uuid, text, text, text, text, boolean, date, date, integer, time[], boolean, text[], uuid[], boolean, time, time, integer, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notif_guardar_programada(uuid, text, text, text, text, boolean, date, date, integer, time[], boolean, text[], uuid[], boolean, time, time, integer, boolean, boolean) TO authenticated;

COMMENT ON FUNCTION public.notif_puede_enviar(uuid) IS
    'Si el push de ese aviso sale: {decision: enviar | pausada | silenciada | tope | diferir, enviar_en}. La llama send-push en los tres caminos (aviso, lote, diferidos). Un aviso sin alerta_clave se manda siempre.';
COMMENT ON FUNCTION public.notif_mis_preferencias() IS
    'Las alertas que quien pregunta puede apagar: automáticas que le llegaron, programadas activas que lo incluyen y las que ya apagó. Una por pareja de repetidos.';
COMMENT ON FUNCTION public.notif_silenciar(uuid, boolean) IS
    'Apaga o prende una alerta SÓLO para auth.uid() (no recibe a quién). Un repetido se guarda en su principal. Motivos: sin_sesion, no_existe, no_apagable.';
COMMENT ON FUNCTION public.notif_alertas_admin() IS
    'El catálogo para la pantalla de Sistemas, sin las eliminadas; en las programadas suma alcance, personas y próximo envío; en todas, permite_apagar y apagada_por. Sólo SUPER_ADMIN.';
